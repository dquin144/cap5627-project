/**
 * CAP 5627 — Team 3.2 — v0.5 evaluation build
 * One evaluation scenario, from captured inputs to the spoken check-in:
 *   facial cue (frozen AU4 threshold) -> verbal cue (LLM or keywords) -> AND gate ->
 *   strategy-constrained wording -> optional fixed response delay -> speak -> record.
 *
 * All platform access is injected (deps), so this runs unchanged in tests and in eEVA.
 * The selected strategy always comes from the operator; the LLM never chooses it.
 * The gate is the baseline rule: shouldTrigger = facialCue && verbalCue.
 *
 * Browser-safe CommonJS.
 */

const { CONFIG, detectFacialCue } = require("./trigger.js");
const { callLlm } = require("./llmAdapter.js");
const { classifyVerbalConcern } = require("./verbalClassifier.js");
const {
  getStrategy,
  buildGenerationPrompt,
  cleanGeneratedLine,
  validateUtterance,
  getTemplateUtterance
} = require("./strategies.js");

const VERSION = "v0.5.1";

const VERBAL_MODES = ["llm", "keywords"];
const GENERATION_MODES = ["llm", "approved", "template", "platform_helper"];
const INPUT_MODES = ["live", "live_face_typed_text", "simulated"];

// Crisis wording. If present, no strategy line is generated (a reduces-space line would be
// inappropriate); a fixed supportive line is spoken instead and the record is flagged so the
// operator follows the study's safety procedure.
const CRISIS_PATTERN = /\b(suicid\w*|kill (myself|me)|end (my|it all)|self[- ]?harm|hurt myself|want to die|don'?t want to (live|be alive))\b/i;
const SAFETY_LINE =
  "It sounds like you're going through something really serious. Please reach out to someone you trust, or call or text 988 to talk to someone right now.";

function isCrisisText(text) {
  return CRISIS_PATTERN.test(String(text || ""));
}

// Words the strategy line with the platform LLM. At most maxAttempts calls (default 2): a
// second attempt is made only when the first line breaks the strategy rules, and it is told why.
// Returns { ok, text, attempts, issues, error, latencyMs }.
async function generateWithLlm({ generate, strategyId, transcript, timeoutMs, maxAttempts, now }) {
  let feedback = "";
  let lastIssues = [];
  let lastError = null;
  let totalLatency = 0;
  const attemptsAllowed = Math.max(1, Math.min(3, maxAttempts || 2));
  for (let attempt = 1; attempt <= attemptsAllowed; attempt++) {
    const call = await callLlm(generate, buildGenerationPrompt({ strategyId, transcript, feedback }), { timeoutMs, now });
    totalLatency += call.latencyMs;
    if (!call.ok) {
      // Unavailable, timeout or error: retrying would only add delay.
      return { ok: false, attempts: attempt, issues: lastIssues, error: "llm_" + call.reason + (call.error ? ": " + call.error : ""), latencyMs: totalLatency };
    }
    const line = cleanGeneratedLine(call.text);
    const check = validateUtterance(line, strategyId, transcript);
    if (check.ok) return { ok: true, text: line, attempts: attempt, issues: [], error: null, latencyMs: totalLatency };
    lastIssues = check.issues;
    lastError = "strategy_validation_failed";
    feedback = check.issues.join("; ");
  }
  return { ok: false, attempts: attemptsAllowed, issues: lastIssues, error: lastError, latencyMs: totalLatency };
}

// Chooses the words for the check-in according to generationMode. Never throws for an expected
// failure; returns { text, source, ... }. text is null when nothing may be spoken.
async function produceUtterance({ strategyId, transcript, options, deps }) {
  const mode = options.generationMode;
  const templateFallback = (reason, extra) => {
    const t = getTemplateUtterance(strategyId, transcript, options);
    return Object.assign({
      text: t.text,
      source: "template_fallback",
      fallbackReason: reason,
      templateMismatch: t.templateMismatch
    }, extra || {});
  };

  if (mode === "approved") {
    const approved = (options.approvedUtterances || {})[strategyId];
    const text = approved && typeof approved === "object" ? approved.text : approved;
    if (typeof text === "string" && text.trim()) {
      return { text: text.trim(), source: "approved", approvedOrigin: approved && approved.origin ? approved.origin : "config" };
    }
    // For recordings a silent template substitute would be worse than nothing: stop here.
    return { text: null, source: "none", error: "No approved line for " + strategyId + ". Approve one first or pick another wording mode." };
  }

  if (mode === "template") {
    const t = getTemplateUtterance(strategyId, transcript, options);
    return { text: t.text, source: "template", templateMismatch: t.templateMismatch };
  }

  if (mode === "platform_helper") {
    try {
      const text = deps.platformStrategyUtterance ? deps.platformStrategyUtterance(strategyId) : null;
      if (typeof text === "string" && text.trim()) return { text: text.trim(), source: "platform_helper" };
      return templateFallback("platform_helper_unavailable_or_empty");
    } catch (err) {
      return templateFallback("platform_helper_error: " + (err && err.message ? err.message : err));
    }
  }

  // mode === "llm"
  const gen = await generateWithLlm({
    generate: deps.generate,
    strategyId,
    transcript,
    timeoutMs: options.llmTimeoutMs,
    maxAttempts: options.maxGenerationAttempts,
    now: deps.now
  });
  if (gen.ok) {
    return { text: gen.text, source: "llm", attempts: gen.attempts, latencyMs: gen.latencyMs };
  }
  return templateFallback(gen.error, { attempts: gen.attempts, validationIssues: gen.issues, latencyMs: gen.latencyMs });
}

/**
 * Runs one scenario.
 * input:   { aus: { "4": number }, transcript, inputMode, facialSource, transcriptSource }
 * options: { strategyId, verbalMode, generationMode, approvedUtterances, templates,
 *            canonicalTranscript, llmTimeoutMs, maxGenerationAttempts, minResponseLatencyMs }
 * deps:    { generate|null, speak(text), wait(ms), now(), isStopped(), platformStrategyUtterance?,
 *            onStage?(stage) }
 * Returns the trial record. Throws only for programming errors (bad strategy/mode ids).
 */
async function runScenario(input, options, deps) {
  getStrategy(options.strategyId); // throws on an unknown id
  if (!VERBAL_MODES.includes(options.verbalMode)) throw new Error("Unknown verbal mode: " + options.verbalMode);
  if (!GENERATION_MODES.includes(options.generationMode)) throw new Error("Unknown generation mode: " + options.generationMode);
  if (!INPUT_MODES.includes(input.inputMode)) throw new Error("Unknown input mode: " + input.inputMode);

  const now = deps.now || Date.now;
  const isStopped = deps.isStopped || (() => false);
  const stage = deps.onStage || (() => {});
  const t0 = now();
  const transcript = String(input.transcript == null ? "" : input.transcript).trim();
  const aus = input.aus || {};

  const record = {
    version: VERSION,
    timestamp: new Date().toISOString(),
    inputMode: input.inputMode,
    facialSource: input.facialSource || (input.inputMode === "simulated" ? "simulated" : "live"),
    transcriptSource: input.transcriptSource || (input.inputMode === "live" ? "stt" : input.inputMode === "simulated" ? "fixture" : "typed"),
    simulated: input.inputMode === "simulated",
    strategyId: options.strategyId,
    verbalMode: options.verbalMode,
    generationMode: options.generationMode,
    transcript,
    au4Peak: Number.isFinite(aus["4"]) ? aus["4"] : null,
    auThreshold: CONFIG.auThreshold,
    facialCue: false,
    verbalCue: false,
    verbal: null,
    shouldTrigger: false,
    safetyOverride: false,
    utterance: null,
    generation: null,
    responseLatencyMs: null,
    spoken: false,
    aborted: false,
    error: null
  };

  // 1. Facial cue: the frozen AU4 threshold from trigger.js.
  const facial = detectFacialCue(aus);
  record.facialCue = facial.detected;

  // 2. Verbal cue: once per trial, after speech ended.
  stage("classifying");
  const verbal = await classifyVerbalConcern(transcript, {
    mode: options.verbalMode,
    generate: deps.generate,
    timeoutMs: options.llmTimeoutMs,
    now
  });
  record.verbal = verbal;
  record.verbalCue = verbal.verbalCue;
  if (isStopped()) { record.aborted = true; return record; }

  // 3. The AND gate. No check-in, nothing spoken, when either cue is missing.
  record.shouldTrigger = record.facialCue && record.verbalCue;
  if (!record.shouldTrigger) return record;

  // 4. Words for the check-in.
  let produced;
  if (isCrisisText(transcript)) {
    record.safetyOverride = true;
    produced = { text: SAFETY_LINE, source: "safety_override" };
  } else {
    stage("generating");
    produced = await produceUtterance({ strategyId: options.strategyId, transcript, options, deps });
  }
  record.generation = produced;
  if (isStopped()) { record.aborted = true; return record; }
  if (!produced.text) {
    record.error = produced.error || "No check-in line available.";
    return record;
  }
  record.utterance = produced.text;

  // 5. Optional fixed response delay, so all four recordings respond after the same pause
  //    regardless of LLM latency. Measured from the end of the participant's line.
  const minLatency = Math.max(0, Number(options.minResponseLatencyMs) || 0);
  const elapsed = now() - t0;
  if (elapsed < minLatency && deps.wait) {
    await deps.wait(minLatency - elapsed);
    if (isStopped()) { record.aborted = true; return record; }
  }
  record.responseLatencyMs = now() - t0;

  // 6. Speak.
  stage("speaking");
  try {
    await deps.speak(record.utterance);
    record.spoken = !isStopped();
    if (isStopped()) record.aborted = true;
  } catch (err) {
    record.error = "speak failed: " + (err && err.message ? err.message : err);
  }
  return record;
}

// Compact, privacy-respecting copy of a record for the exported session log and metrics:
// live speech transcripts are omitted unless keepLiveTranscript is true.
function toLogRecord(record, { keepLiveTranscript = false } = {}) {
  const copy = JSON.parse(JSON.stringify(record));
  if (copy.transcriptSource === "stt" && !keepLiveTranscript) {
    copy.transcript = "[omitted: live speech]";
  }
  return copy;
}

// One-line metrics detail string, in the baseline's key=value;... style. No transcript.
function metricsDetail(record) {
  const v = record.verbal || {};
  const g = record.generation || {};
  return [
    "version=" + record.version,
    "input=" + record.inputMode,
    "simulated=" + record.simulated,
    "strategy=" + record.strategyId,
    "facial=" + record.facialCue,
    "peak_au4=" + record.au4Peak,
    "threshold=" + record.auThreshold,
    "verbal=" + record.verbalCue,
    "verbal_source=" + (v.source || "none"),
    "llm_type=" + (v.llmType || "none"),
    "keyword_verbal=" + (v.keywordVerbalCue === true),
    "generation_source=" + (g.source || "none"),
    "spoken=" + record.spoken,
    "safety_override=" + record.safetyOverride
  ].join(";");
}

module.exports = {
  VERSION,
  VERBAL_MODES,
  GENERATION_MODES,
  INPUT_MODES,
  SAFETY_LINE,
  isCrisisText,
  generateWithLlm,
  produceUtterance,
  runScenario,
  toLogRecord,
  metricsDetail
};
