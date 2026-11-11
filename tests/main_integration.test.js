// Headless run of main.js against a mocked eEVA context and a minimal fake DOM. Exercises the
// SIMULATED path end to end, re-entrancy, recording view and stop() cleanup. Camera, speech
// recognition, TTS and the real LLM are NOT exercised here; see the on-platform smoke test.
const test = require("node:test");
const assert = require("node:assert/strict");
const { installDom, uninstallDom, mockContext, scriptedLlm } = require("./helpers/fakes.js");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// conversation: false runs the one-shot v0.5 flow (no opening question / reply / closing).
async function boot({ generate, speakMs, conversation = false } = {}) {
  installDom();
  delete require.cache[require.resolve("../main.js")];
  const main = require("../main.js");
  const ctx = mockContext({ generate, speakMs });
  const running = main.run(ctx);
  await tick(20);
  const panel = ctx.overlays[0];
  const button = (text) => panel.findByText(text);
  const selects = panel.findAll("select");
  const [strategySel, inputSel, verbalSel, wordingSel] = selects;
  const conversationLabel = panel.findAll("label").find((l) => l.children.some((c) => typeof c === "string" && c.includes("Conversation (")));
  const conversationBox = conversationLabel.children[0];
  conversationBox.checked = conversation;
  return { main, ctx, running, panel, button, strategySel, inputSel, verbalSel, wordingSel, conversationBox };
}

async function setSelect(sel, value) {
  sel.value = value;
  await sel.dispatch("change");
}

async function shutdown(b) {
  await b.main.stop(b.ctx);
  b.ctx.cleanups.forEach((cb) => cb());
  await b.running;
  uninstallDom();
}

test("simulated scenario: triggers, speaks one strategy line, logs v0.5 metrics with simulated=true", async () => {
  const gen = scriptedLlm({
    classify: () => '{"type":"concern","rationaleShort":"stress"}',
    word: () => "It sounds like your exams are stressing you out. What worries you most about them?"
  });
  const b = await boot({ generate: gen });
  try {
    await setSelect(b.inputSel, "simulated");
    await b.button("Start scenario").dispatch("click");
    assert.deepEqual(b.ctx.spoken, ["It sounds like your exams are stressing you out. What worries you most about them?"]);
    const decision = b.ctx.metricsLog.find((m) => m[0] === "trigger_decision_v05");
    assert.equal(decision[1], "check_in");
    assert.match(decision[2], /simulated=true/);
    assert.match(decision[2], /generation_source=llm/);
    const report = b.panel.findAll("pre")[0].textContent;
    assert.match(report, /SIMULATED DEMO/);
    assert.match(report, /\[SIMULATED\]/);
    assert.match(report, /Decision: CHECK IN/);
  } finally {
    await shutdown(b);
  }
});

test("each strategy selection reaches the generation prompt", async () => {
  const gen = scriptedLlm({ classify: () => '{"type":"concern"}', word: () => "garbage" });
  const b = await boot({ generate: gen });
  try {
    await setSelect(b.inputSel, "simulated");
    for (const [id, label] of [
      ["explicit_provides_space", "Explicit, provides space"],
      ["explicit_reduces_space", "Explicit, reduces space"],
      ["nonexplicit_provides_space", "Non-explicit, provides space"],
      ["nonexplicit_reduces_space", "Non-explicit, reduces space"]
    ]) {
      b.strategySel.value = id;
      await b.button("Start scenario").dispatch("click");
      const last = gen.calls[gen.calls.length - 1];
      assert.match(last, new RegExp("follow it exactly\\): " + label + "\\."), id);
    }
    // garbage wording -> template fallback spoken each time (4 runs).
    assert.equal(b.ctx.spoken.length, 4);
  } finally {
    await shutdown(b);
  }
});

test("double clicks do not start overlapping scenarios", async () => {
  const b = await boot({ generate: scriptedLlm(), speakMs: 30 });
  try {
    await setSelect(b.inputSel, "simulated");
    const first = b.button("Start scenario").dispatch("click");
    // Buttons are disabled while busy; even a forced second call must be ignored.
    b.button("Start scenario").disabled = false;
    const second = b.button("Start scenario").dispatch("click");
    await Promise.all([first, second]);
    assert.equal(b.ctx.spoken.length, 1);
  } finally {
    await shutdown(b);
  }
});

test("no check-in for a neutral fixed transcript", async () => {
  const b = await boot({ generate: scriptedLlm({ classify: () => '{"type":"none"}' }) });
  try {
    await setSelect(b.inputSel, "simulated");
    b.panel.findAll("input").find((i) => i.type === "text").value = "I'm doing pretty well today.";
    await b.button("Start scenario").dispatch("click");
    assert.deepEqual(b.ctx.spoken, []);
    assert.equal(b.ctx.metricsLog.find((m) => m[0] === "trigger_decision_v05")[1], "no_check_in");
  } finally {
    await shutdown(b);
  }
});

test("approve -> approved mode replays the identical line without calling the model again", async () => {
  const gen = scriptedLlm({ word: () => "It sounds like your exams are stressing you out. What worries you most about them?" });
  const b = await boot({ generate: gen });
  try {
    await setSelect(b.inputSel, "simulated");
    await b.button("Start scenario").dispatch("click");
    await b.button("Approve last line").dispatch("click");
    const before = gen.calls.filter((c) => /Response strategy/.test(c)).length;
    b.wordingSel.value = "approved";
    await b.button("Start scenario").dispatch("click");
    assert.equal(b.ctx.spoken[0], b.ctx.spoken[1]);
    assert.equal(gen.calls.filter((c) => /Response strategy/.test(c)).length, before);
    const stored = JSON.parse(global.window.localStorage.getItem("sia32.v05.approvedUtterances"));
    assert.equal(stored.explicit_provides_space.origin, "llm");
  } finally {
    await shutdown(b);
  }
});

test("recording view hides runner controls; stop restores them and cleans up", async () => {
  const b = await boot({ generate: scriptedLlm() });
  await b.button("Recording view").dispatch("click");
  assert.equal(b.ctx.runnerVisible, false);
  await b.main.stop(b.ctx);
  assert.equal(b.ctx.runnerVisible, true);
  assert.equal(b.ctx.stoppedSpeaking, true);
  assert.equal(b.ctx.cleared, true);
  b.ctx.cleanups.forEach((cb) => cb());
  await b.running;
  uninstallDom();
});

test("stop immediately after run does not throw, and a stopped module ignores clicks", async () => {
  const b = await boot({ generate: scriptedLlm() });
  await b.main.stop(b.ctx);
  await b.button("Start scenario").dispatch("click");
  assert.deepEqual(b.ctx.spoken, []);
  b.ctx.cleanups.forEach((cb) => cb());
  await b.running;
  uninstallDom();
});

test("without any LLM helper the module still runs and labels the fallback", async () => {
  const b = await boot({ generate: null });
  try {
    await setSelect(b.inputSel, "simulated");
    await b.button("Start scenario").dispatch("click");
    assert.equal(b.ctx.spoken.length, 1);
    const report = b.panel.findAll("pre")[0].textContent;
    assert.match(report, /Verbal detector: keywords_fallback/);
    assert.match(report, /Wording source: template_fallback/);
  } finally {
    await shutdown(b);
  }
});

test("conversation mode (simulated): opener -> check-in -> closing, three agent turns, conversation metric", async () => {
  const generate = async (prompt) => {
    if (/label how a student replied/.test(prompt)) return '{"label":"elaborate"}';
    if (/Reply with ONLY a JSON object/.test(prompt)) return '{"type":"concern"}';
    if (/Briefly acknowledge what the student just shared/.test(prompt)) return "Thanks for telling me about your exams. I hope next week goes smoothly for you.";
    return "It sounds like your exams are stressing you out. What worries you most about them?";
  };
  const b = await boot({ generate, conversation: true });
  try {
    await setSelect(b.inputSel, "simulated");
    await b.button("Start scenario").dispatch("click");
    assert.deepEqual(b.ctx.spoken, [
      "How have things been going lately?",
      "It sounds like your exams are stressing you out. What worries you most about them?",
      "Thanks for telling me about your exams. I hope next week goes smoothly for you."
    ]);
    const convo = b.ctx.metricsLog.find((m) => m[0] === "conversation_v05");
    assert.equal(convo[1], "check_in");
    assert.match(convo[2], /reply_label=elaborate/);
    assert.match(convo[2], /closing_source=llm/);
    const report = b.panel.findAll("pre")[0].textContent;
    assert.match(report, /CONVERSATION \(branch: check_in\)/);
    assert.match(report, /Student \[reply\]: "Yeah, I have three exams next week/);
  } finally {
    await shutdown(b);
  }
});

test("conversation mode: no trigger -> opener + neutral close only", async () => {
  const b = await boot({ generate: null, conversation: true });
  try {
    await setSelect(b.inputSel, "simulated");
    b.panel.findAll("input").find((i) => i.type === "text").value = "I'm doing pretty well today.";
    await b.button("Start scenario").dispatch("click");
    assert.equal(b.ctx.spoken.length, 2);
    assert.equal(b.ctx.spoken[0], "How have things been going lately?");
    assert.doesNotMatch(b.ctx.spoken[1], /\?/);
    assert.equal(b.ctx.metricsLog.find((m) => m[0] === "conversation_v05")[1], "no_check_in");
  } finally {
    await shutdown(b);
  }
});
