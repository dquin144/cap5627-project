// Conversation flow. The LLM is mocked by routing on prompt content; this checks the turn
// structure, branches, fallbacks and safety, not real model quality.
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("../conversation.js");
const { SAFETY_LINE } = require("../checkinPipeline.js");
const { feelingWordsIn } = require("../strategies.js");

const STIMULUS = "I'm really stressed about my exams.";
const CHECK_IN = "It sounds like your exams are stressing you out. What worries you most about them?";

// Routes each prompt type to a scripted answer; records the kind of every call.
function routedLlm(answers = {}) {
  const kinds = [];
  const generate = async (prompt) => {
    let kind;
    if (/label how a student replied/.test(prompt)) kind = "reply_label";
    else if (/Decide whether the student is expressing/.test(prompt)) kind = "verbal";
    else if (/Response strategy/.test(prompt)) kind = "check_in";
    else if (/Respond naturally and briefly/.test(prompt)) kind = "neutral_close";
    else if (/Briefly acknowledge what the student just shared/.test(prompt)) kind = "elaborate_close";
    kinds.push(kind);
    const a = answers[kind];
    if (typeof a === "function") return a(prompt);
    if (a !== undefined) return a;
    return {
      verbal: '{"type":"concern"}',
      reply_label: '{"label":"elaborate"}',
      check_in: CHECK_IN,
      neutral_close: "Glad to hear it. Thanks for catching up with me today.",
      elaborate_close: "Thanks for telling me about your exams. I hope next week goes smoothly for you."
    }[kind];
  };
  generate.kinds = kinds;
  return generate;
}

// Fake platform: scripted captures per turn, records the order of speech and captures.
function makeDeps({ generate, turn1 = {}, reply = "Yeah, I have three exams next week and I feel really behind.", stopAt } = {}) {
  const events = [];
  const spoken = [];
  let stopped = false;
  let t = 0;
  const deps = {
    generate,
    events,
    spoken,
    speak: async (text) => { events.push("speak"); spoken.push(text); if (stopAt === "speak:" + spoken.length) stopped = true; },
    wait: async (ms) => { t += ms; },
    now: () => t,
    isStopped: () => stopped,
    captureTurn: async (n) => {
      events.push("capture" + n);
      if (stopAt === "capture" + n) stopped = true;
      if (n === 1) {
        return {
          input: Object.assign({ aus: { "4": 70 }, transcript: STIMULUS, inputMode: "simulated" }, turn1),
          capture: { windowMs: 3000, endReason: "simulated", samples: 0 }
        };
      }
      return { input: { transcript: reply, transcriptSource: "fixture" } };
    }
  };
  return deps;
}

const opts = (o = {}) => Object.assign({
  strategyId: "explicit_provides_space",
  verbalMode: "llm",
  generationMode: "llm",
  llmTimeoutMs: 500,
  maxGenerationAttempts: 2,
  minResponseLatencyMs: 0,
  openingQuestion: "How have things been going lately?"
}, o);

test("the opening question is spoken before listening, and it is the same fixed line every run", async () => {
  const deps = makeDeps({ generate: routedLlm() });
  const rec = await c.runConversation(opts(), deps);
  assert.deepEqual(deps.events.slice(0, 2), ["speak", "capture1"]);
  assert.equal(deps.spoken[0], "How have things been going lately?");
  assert.equal(rec.turns[0].kind, "opening");
  const rec2 = await c.runConversation(opts({ strategyId: "nonexplicit_reduces_space" }), makeDeps({ generate: routedLlm() }));
  assert.equal(rec2.turns[0].text, rec.turns[0].text);
});

test("trigger + elaborating reply: opener, check-in, reply, LLM closing (5 turns, 3 agent lines)", async () => {
  const gen = routedLlm();
  const deps = makeDeps({ generate: gen });
  const rec = await c.runConversation(opts(), deps);
  assert.equal(rec.branch, "check_in");
  assert.deepEqual(rec.turns.map((t) => t.speaker + ":" + t.kind),
    ["agent:opening", "student:answer", "agent:check_in", "student:reply", "agent:closing"]);
  assert.equal(deps.spoken.length, 3);
  assert.equal(rec.replyClassification.label, "elaborate");
  assert.equal(rec.closing.source, "llm");
  assert.ok(!/\?/.test(rec.closing.text));
  assert.equal(rec.scenario.strategyId, "explicit_provides_space", "strategy selection unchanged");
});

test("decline, pause, acknowledge and no reply each get their fixed closing (no LLM closing call)", async () => {
  for (const [reply, label, kind] of [
    ["No, I'd rather not talk about it.", "decline", "decline"],
    ["Can we take a break for now?", "pause", "pause"],
    ["Okay, sounds good.", "acknowledge", "acknowledge"],
    ["", null, "no_reply"]
  ]) {
    const gen = routedLlm({ reply_label: label ? JSON.stringify({ label }) : undefined });
    const rec = await c.runConversation(opts(), makeDeps({ generate: gen, reply }));
    assert.equal(rec.closing.kind, kind, reply);
    assert.equal(rec.closing.source, "template");
    assert.equal(rec.closing.text, c.CLOSING_TEMPLATES[kind]);
    assert.ok(!gen.kinds.includes("elaborate_close"));
    if (!reply) assert.ok(!gen.kinds.includes("reply_label"), "no classifier call on an empty reply");
  }
});

test("an 'unclear' reply label is closed with the neutral acknowledge line", async () => {
  const rec = await c.runConversation(opts(), makeDeps({ generate: routedLlm({ reply_label: '{"label":"unclear"}' }), reply: "hmm well" }));
  assert.equal(rec.closing.kind, "acknowledge");
});

test("reply classifier failure falls back to the keyword rules, with the reason", async () => {
  const rec = await c.runConversation(opts(), makeDeps({ generate: routedLlm({ reply_label: "not json" }), reply: "I'd rather not." }));
  assert.equal(rec.replyClassification.source, "keywords_fallback");
  assert.match(rec.replyClassification.fallbackReason, /llm_malformed/);
  assert.equal(rec.closing.kind, "decline");
});

test("no trigger: opener + neutral close, no check-in, no second student turn", async () => {
  const deps = makeDeps({ generate: routedLlm({ verbal: '{"type":"none"}' }), turn1: { transcript: "I'm doing pretty well today." } });
  const rec = await c.runConversation(opts(), deps);
  assert.equal(rec.branch, "no_check_in");
  assert.equal(rec.closing.kind, "neutral_close");
  assert.deepEqual(rec.turns.map((t) => t.kind), ["opening", "answer", "closing"]);
  assert.ok(!deps.events.includes("capture2"));
});

test("no trigger with a verbal concern (relaxed face): the close must not mention feelings", async () => {
  const gen = routedLlm({ neutral_close: "Sorry you're feeling stressed about that. Take care of yourself today." });
  const rec = await c.runConversation(opts(), makeDeps({ generate: gen, turn1: { aus: { "4": 10 } } }));
  assert.equal(rec.scenario.shouldTrigger, false);
  assert.equal(rec.closing.source, "template_fallback");
  assert.equal(rec.closing.fallbackReason, "closing_validation_failed");
  assert.deepEqual(feelingWordsIn(rec.closing.text), []);
  assert.equal(gen.kinds.filter((k) => k === "neutral_close").length, 2, "bounded retry");
});

test("no speech in turn 1: short no-speech close", async () => {
  const rec = await c.runConversation(opts(), makeDeps({ generate: routedLlm(), turn1: { transcript: "" } }));
  assert.equal(rec.closing.kind, "no_speech");
});

test("elaborate closing may echo the student's feeling words but not add new ones", () => {
  const allowed = { allowedFeelingText: STIMULUS + " I feel behind" };
  assert.equal(c.validateClosing("Thanks for sharing why the exams feel so stressful. I hope next week goes smoothly.", allowed).ok, true);
  const bad = c.validateClosing("Thanks for sharing. It sounds like you're also feeling anxious and sad about it.", allowed);
  assert.ok(bad.issues.some((i) => /introduces a feeling/.test(i)));
  assert.ok(c.validateClosing("Thanks for sharing. What else is going on?", allowed).issues.some((i) => /question/.test(i)));
  assert.ok(c.validateClosing("Thanks for sharing. You should make a study plan tonight.", allowed).issues.some((i) => /advice/.test(i)));
});

test("approved / template wording modes: closings come from templates (reproducible recordings)", async () => {
  for (const generationMode of ["approved", "template"]) {
    const gen = routedLlm();
    const rec = await c.runConversation(opts({
      generationMode,
      approvedUtterances: { explicit_provides_space: { text: CHECK_IN, origin: "llm" } }
    }), makeDeps({ generate: gen }));
    assert.equal(rec.closing.source, "template", generationMode);
    assert.equal(rec.closing.text, c.CLOSING_TEMPLATES.elaborate);
    assert.ok(!gen.kinds.includes("elaborate_close") && !gen.kinds.includes("check_in"));
  }
});

test("crisis wording ends with the safety line, in turn 1 (no trigger) or in the reply", async () => {
  const r1 = await c.runConversation(opts(), makeDeps({ generate: routedLlm({ verbal: '{"type":"none"}' }), turn1: { aus: { "4": 10 }, transcript: "Honestly I want to die." } }));
  assert.equal(r1.safetyOverride, true);
  assert.equal(r1.turns[r1.turns.length - 1].text, SAFETY_LINE);
  const r2 = await c.runConversation(opts(), makeDeps({ generate: routedLlm(), reply: "I just want to hurt myself." }));
  assert.equal(r2.safetyOverride, true);
  assert.equal(r2.branch, "safety");
  assert.equal(r2.closing, null);
  assert.equal(r2.turns[r2.turns.length - 1].text, SAFETY_LINE);
});

test("stop during a capture ends the conversation without further speech", async () => {
  for (const stopAt of ["capture1", "capture2"]) {
    const deps = makeDeps({ generate: routedLlm(), stopAt });
    const rec = await c.runConversation(opts(), deps);
    assert.equal(rec.aborted, true, stopAt);
    assert.equal(deps.spoken.length, stopAt === "capture1" ? 1 : 2);
  }
});

test("the closing honours the same minimum response delay as the check-in", async () => {
  const deps = makeDeps({ generate: routedLlm() });
  const rec = await c.runConversation(opts({ minResponseLatencyMs: 3000 }), deps);
  assert.equal(rec.scenario.responseLatencyMs, 3000);
  assert.equal(rec.closing.responseLatencyMs, 3000);
});

test("conversation logs hide live speech and metrics hold no transcript", async () => {
  const deps = makeDeps({ generate: routedLlm() });
  const orig = deps.captureTurn;
  deps.captureTurn = async (n) => {
    const r = await orig(n);
    if (n === 1) r.input.transcriptSource = "stt";
    if (n === 1) r.input.inputMode = "live";
    if (n === 2) r.input.transcriptSource = "stt";
    return r;
  };
  const rec = await c.runConversation(opts(), deps);
  const log = c.toConversationLogRecord(rec);
  assert.equal(log.reply, "[omitted: live speech]");
  assert.ok(log.turns.filter((t) => t.speaker === "student").every((t) => t.text === "[omitted: live speech]"));
  assert.equal(log.scenario.transcript, "[omitted: live speech]");
  const m = c.conversationMetricsDetail(rec);
  assert.match(m, /branch=check_in;reply_label=elaborate/);
  assert.ok(!/exam/i.test(m));
});

test("keyword reply rules", () => {
  const cases = {
    "Yeah, I have three exams next week and I feel really behind.": "elaborate",
    "I have an exam later today and two more tomorrow.": "elaborate",
    "Okay, sounds good.": "acknowledge",
    "I'm fine.": "decline",
    "No.": "decline",
    "Can we take a break?": "pause",
    "Not right now.": "pause",
    "hmm": "unclear"
  };
  for (const [text, label] of Object.entries(cases)) assert.equal(c.classifyReplyKeywords(text), label, text);
});
