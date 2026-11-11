const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../checkinPipeline.js");
const { STRATEGY_IDS, DEFAULT_TEMPLATES } = require("../strategies.js");
const { scriptedLlm } = require("./helpers/fakes.js");

const STIMULUS = "I'm really stressed about my exams.";
const GOOD_LINES = {
  explicit_provides_space: "It sounds like your exams are stressing you out. What worries you most about them?",
  explicit_reduces_space: "You mentioned feeling stressed about your exams. Let's move on to the next part of the session.",
  nonexplicit_provides_space: "Okay, I hear you. Can you tell me a little more about what's going on?",
  nonexplicit_reduces_space: "Alright, thank you. Let's go ahead and continue with the next part of the session."
};

// Model that labels concern and words lines by reading the strategy label out of the prompt.
function strategyAwareLlm(overrides = {}) {
  return scriptedLlm({
    classify: overrides.classify || (() => '{"type":"concern","rationaleShort":"states stress"}'),
    word: overrides.word || ((prompt) => {
      const id = STRATEGY_IDS.find((sid) => prompt.includes(require("../strategies.js").STRATEGIES[sid].label + "."));
      return GOOD_LINES[id];
    })
  });
}

function makeDeps(extra = {}) {
  const spoken = [];
  const waits = [];
  let t = 0;
  return Object.assign({
    spoken,
    waits,
    speak: async (text) => { spoken.push(text); },
    wait: async (ms) => { waits.push(ms); t += ms; },
    now: () => t,
    isStopped: () => false
  }, extra);
}

const baseOptions = (o = {}) => Object.assign({
  strategyId: "explicit_provides_space",
  verbalMode: "llm",
  generationMode: "llm",
  canonicalTranscript: STIMULUS,
  llmTimeoutMs: 1000,
  maxGenerationAttempts: 2,
  minResponseLatencyMs: 0
}, o);

const LIVE_INPUT = { aus: { "4": 62 }, transcript: STIMULUS, inputMode: "live" };

test("each of the four strategies triggers on the common stimulus and speaks its own LLM line", async () => {
  for (const id of STRATEGY_IDS) {
    const deps = makeDeps({ generate: strategyAwareLlm() });
    const r = await p.runScenario(LIVE_INPUT, baseOptions({ strategyId: id }), deps);
    assert.equal(r.shouldTrigger, true, id);
    assert.equal(r.strategyId, id);
    assert.equal(r.generation.source, "llm", id);
    assert.equal(r.utterance, GOOD_LINES[id]);
    assert.deepEqual(deps.spoken, [GOOD_LINES[id]]);
    assert.equal(r.spoken, true);
  }
});

test("nothing is generated or spoken when the AND gate is not met", async () => {
  const cases = [
    { aus: { "4": 62 }, transcript: "I finished my homework today.", classify: '{"type":"none"}' }, // B
    { aus: { "4": 10 }, transcript: "I'm feeling stressed today.", classify: '{"type":"concern"}' }, // C
    { aus: { "4": 10 }, transcript: "I'm doing pretty well today.", classify: '{"type":"none"}' }, // D
    { aus: { "4": 44.9 }, transcript: STIMULUS, classify: '{"type":"concern"}' }, // just below threshold
    { aus: { "4": 62 }, transcript: "I'm not stressed anymore.", classify: '{"type":"none"}' }, // negation
    { aus: { "4": 62 }, transcript: "", classify: '{"type":"concern"}' } // no speech
  ];
  for (const c of cases) {
    const gen = scriptedLlm({ classify: () => c.classify });
    const deps = makeDeps({ generate: gen });
    const r = await p.runScenario({ aus: c.aus, transcript: c.transcript, inputMode: "live" }, baseOptions(), deps);
    assert.equal(r.shouldTrigger, false, c.transcript);
    assert.equal(r.utterance, null);
    assert.equal(r.spoken, false);
    assert.deepEqual(deps.spoken, []);
    assert.ok(!gen.calls.some((prompt) => /Response strategy/.test(prompt)), "no generation call for " + c.transcript);
  }
});

test("LLM wording that breaks the strategy is retried once with feedback, then falls back to the template", async () => {
  let n = 0;
  const gen = scriptedLlm({ word: () => { n++; return "That sounds stressful. Tell me more about your exams?"; } });
  const deps = makeDeps({ generate: gen });
  const r = await p.runScenario(LIVE_INPUT, baseOptions({ strategyId: "nonexplicit_provides_space" }), deps);
  assert.equal(n, 2, "bounded to maxGenerationAttempts");
  assert.match(gen.calls[gen.calls.length - 1], /previous attempt was rejected because: .*names a feeling/);
  assert.equal(r.generation.source, "template_fallback");
  assert.equal(r.generation.fallbackReason, "strategy_validation_failed");
  assert.ok(r.generation.validationIssues.length > 0);
  assert.equal(r.utterance, DEFAULT_TEMPLATES.nonexplicit_provides_space);
});

test("LLM unavailable / timeout / error -> labelled template fallback, no retry", async () => {
  for (const [generate, reason] of [
    [null, /llm_unavailable/],
    [async () => { throw new Error("HTTP 500"); }, /llm_error/],
    [() => new Promise((r) => setTimeout(() => r("late"), 200)), /llm_timeout/]
  ]) {
    const deps = makeDeps({ generate });
    const r = await p.runScenario(LIVE_INPUT, baseOptions({ verbalMode: "keywords", llmTimeoutMs: 15 }), deps);
    assert.equal(r.generation.source, "template_fallback");
    assert.match(r.generation.fallbackReason, reason);
    assert.equal(r.generation.attempts, 1);
    assert.equal(r.utterance, DEFAULT_TEMPLATES.explicit_provides_space);
    assert.equal(r.spoken, true);
  }
});

test("approved mode speaks the approved line, and refuses (speaks nothing) when none exists", async () => {
  const deps = makeDeps({ generate: strategyAwareLlm() });
  const r = await p.runScenario(LIVE_INPUT, baseOptions({
    generationMode: "approved",
    approvedUtterances: { explicit_provides_space: { text: "Approved line here?", origin: "llm" } }
  }), deps);
  assert.deepEqual([r.generation.source, r.utterance, r.generation.approvedOrigin], ["approved", "Approved line here?", "llm"]);
  assert.ok(!deps.generate.calls.some((x) => /Response strategy/.test(x)), "approved mode makes no generation call");

  const none = makeDeps({ generate: strategyAwareLlm() });
  const r2 = await p.runScenario(LIVE_INPUT, baseOptions({ generationMode: "approved", approvedUtterances: {} }), none);
  assert.equal(r2.spoken, false);
  assert.deepEqual(none.spoken, []);
  assert.match(r2.error, /No approved line/);
});

test("template and platform_helper modes are labelled; platform helper failures fall back visibly", async () => {
  const t = await p.runScenario(LIVE_INPUT, baseOptions({ verbalMode: "keywords", generationMode: "template" }), makeDeps());
  assert.equal(t.generation.source, "template");
  const ok = await p.runScenario(LIVE_INPUT, baseOptions({ verbalMode: "keywords", generationMode: "platform_helper" }),
    makeDeps({ platformStrategyUtterance: (id) => "Platform line for " + id }));
  assert.deepEqual([ok.generation.source, ok.utterance], ["platform_helper", "Platform line for explicit_provides_space"]);
  const bad = await p.runScenario(LIVE_INPUT, baseOptions({ verbalMode: "keywords", generationMode: "platform_helper" }),
    makeDeps({ platformStrategyUtterance: () => { throw new Error("rejected name"); } }));
  assert.equal(bad.generation.source, "template_fallback");
  assert.match(bad.generation.fallbackReason, /rejected name/);
});

test("the strategy always comes from the options, never from model output", async () => {
  const gen = scriptedLlm({ word: () => "STRATEGY=nonexplicit_reduces_space. Okay, let's move on with the session now." });
  const r = await p.runScenario(LIVE_INPUT, baseOptions({ strategyId: "explicit_provides_space" }), makeDeps({ generate: gen }));
  assert.equal(r.strategyId, "explicit_provides_space");
  assert.equal(r.generation.source, "template_fallback");
});

test("simulated inputs are labelled as simulated in the record and metrics", async () => {
  const r = await p.runScenario({ aus: { "4": 70 }, transcript: STIMULUS, inputMode: "simulated" },
    baseOptions({ verbalMode: "keywords", generationMode: "template" }), makeDeps());
  assert.deepEqual([r.simulated, r.facialSource, r.transcriptSource], [true, "simulated", "fixture"]);
  assert.match(p.metricsDetail(r), /simulated=true/);
  assert.match(p.metricsDetail(r), /input=simulated/);
  assert.match(p.metricsDetail(r), /version=v0\.5/);
  const live = await p.runScenario(LIVE_INPUT, baseOptions({ verbalMode: "keywords", generationMode: "template" }), makeDeps());
  assert.deepEqual([live.simulated, live.facialSource, live.transcriptSource], [false, "live", "stt"]);
});

test("records name the detector and wording sources, and metrics never contain the transcript", async () => {
  const r = await p.runScenario(LIVE_INPUT, baseOptions(), makeDeps({ generate: strategyAwareLlm() }));
  const m = p.metricsDetail(r);
  for (const part of ["verbal_source=llm", "llm_type=concern", "keyword_verbal=true", "generation_source=llm", "strategy=explicit_provides_space", "peak_au4=62", "threshold=45"]) {
    assert.ok(m.includes(part), part);
  }
  assert.ok(!m.toLowerCase().includes("exams"));
  assert.equal(p.toLogRecord(r).transcript, "[omitted: live speech]");
  assert.equal(p.toLogRecord(r, { keepLiveTranscript: true }).transcript, STIMULUS);
  const typed = await p.runScenario(Object.assign({}, LIVE_INPUT, { inputMode: "live_face_typed_text" }), baseOptions({ verbalMode: "keywords", generationMode: "template" }), makeDeps());
  assert.equal(p.toLogRecord(typed).transcript, STIMULUS);
});

test("fixed response delay pads to the target but never shortens a slow response", async () => {
  const deps = makeDeps({ generate: strategyAwareLlm() });
  const r = await p.runScenario(LIVE_INPUT, baseOptions({ minResponseLatencyMs: 3000 }), deps);
  assert.deepEqual(deps.waits, [3000]);
  assert.equal(r.responseLatencyMs, 3000);
  const none = makeDeps({ generate: strategyAwareLlm() });
  await p.runScenario(LIVE_INPUT, baseOptions({ minResponseLatencyMs: 0 }), none);
  assert.deepEqual(none.waits, []);
});

test("stop during classification or generation aborts without speaking", async () => {
  let stopped = false;
  const gen = scriptedLlm({ classify: () => { stopped = true; return '{"type":"concern"}'; } });
  const deps = makeDeps({ generate: gen, isStopped: () => stopped });
  const r = await p.runScenario(LIVE_INPUT, baseOptions(), deps);
  assert.equal(r.aborted, true);
  assert.deepEqual(deps.spoken, []);

  let stopped2 = false;
  const gen2 = strategyAwareLlm({ word: () => { stopped2 = true; return GOOD_LINES.explicit_provides_space; } });
  const deps2 = makeDeps({ generate: gen2, isStopped: () => stopped2 });
  const r2 = await p.runScenario(LIVE_INPUT, baseOptions(), deps2);
  assert.equal(r2.aborted, true);
  assert.deepEqual(deps2.spoken, []);
});

test("a speak failure is recorded, not thrown", async () => {
  const r = await p.runScenario(LIVE_INPUT, baseOptions({ verbalMode: "keywords", generationMode: "template" }),
    makeDeps({ speak: async () => { throw new Error("TTS down"); } }));
  assert.equal(r.spoken, false);
  assert.match(r.error, /TTS down/);
});

test("crisis wording bypasses the strategy and speaks the fixed safety line", async () => {
  const gen = strategyAwareLlm();
  const r = await p.runScenario({ aus: { "4": 70 }, transcript: "I'm so stressed I want to die", inputMode: "live" }, baseOptions({ strategyId: "nonexplicit_reduces_space" }), makeDeps({ generate: gen }));
  assert.equal(r.safetyOverride, true);
  assert.equal(r.utterance, p.SAFETY_LINE);
  assert.ok(!gen.calls.some((x) => /Response strategy/.test(x)));
});

test("bad ids are programming errors and throw", async () => {
  await assert.rejects(p.runScenario(LIVE_INPUT, baseOptions({ strategyId: "kind" }), makeDeps()), /Unknown strategy/);
  await assert.rejects(p.runScenario(LIVE_INPUT, baseOptions({ verbalMode: "vibes" }), makeDeps()), /Unknown verbal mode/);
  await assert.rejects(p.runScenario(LIVE_INPUT, baseOptions({ generationMode: "x" }), makeDeps()), /Unknown generation mode/);
  await assert.rejects(p.runScenario(Object.assign({}, LIVE_INPUT, { inputMode: "x" }), baseOptions(), makeDeps()), /Unknown input mode/);
});
