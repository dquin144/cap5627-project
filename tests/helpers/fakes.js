/**
 * Test doubles: a scripted LLM, a minimal DOM for main.js, and a mocked eEVA context.
 * These mock the platform's documented shapes only; on-platform behaviour must still be checked
 * on sage.cs.fiu.edu (see USER_EVAL_IMPLEMENTATION.md, smoke test).
 */

// Pulls the student's sentence back out of a prompt built by strategies/verbalClassifier.
function saidIn(prompt) {
  const m = String(prompt).match(/<student_said>\n([\s\S]*?)\n<\/student_said>/);
  return m ? m[1] : "";
}

function isClassifierPrompt(prompt) {
  return /Reply with ONLY a JSON object/.test(prompt);
}

// Scripted LLM. classify(said) -> model text for classifier prompts; word(prompt) -> model text
// for generation prompts. Records every prompt.
function scriptedLlm({ classify, word } = {}) {
  const calls = [];
  const generate = async (prompt) => {
    calls.push(prompt);
    if (isClassifierPrompt(prompt)) return classify ? classify(saidIn(prompt), prompt) : '{"type":"concern","rationaleShort":"x"}';
    return word ? word(prompt) : "It sounds like your exams are stressing you. What worries you most about them?";
  };
  generate.calls = calls;
  return generate;
}

// ---------------- minimal DOM ----------------
class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.style = {};
    this.children = [];
    this.listeners = {};
    this.textContent = "";
    this.value = "";
    this.disabled = false;
    this.checked = false;
    this.open = false;
    this.parent = null;
  }
  append(...nodes) {
    nodes.forEach((n) => {
      if (n instanceof FakeElement) { n.parent = this; this.children.push(n); }
      else this.children.push(String(n));
    });
  }
  appendChild(n) { this.append(n); return n; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  async dispatch(type) {
    // Mirrors the browser: a disabled button ignores clicks.
    if (type === "click" && this.disabled) return;
    for (const fn of this.listeners[type] || []) await fn({ type, target: this });
  }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.removed = true; }
  select() {}
  // Depth-first search helpers for tests.
  all() { return [this, ...this.children.filter((c) => c instanceof FakeElement).flatMap((c) => c.all())]; }
  findByText(text) { return this.all().find((e) => e.textContent === text); }
  findAll(tag) { return this.all().filter((e) => e.tagName === tag.toUpperCase()); }
}

function installDom() {
  const store = {};
  const body = new FakeElement("body");
  global.document = { createElement: (t) => new FakeElement(t), body };
  global.window = {
    setTimeout: (...a) => setTimeout(...a),
    clearTimeout: (t) => clearTimeout(t),
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    }
  };
  return { body, store };
}

function uninstallDom() {
  delete global.document;
  delete global.window;
}

// Mocked eEVA Project Studio context. Records spoken lines, metrics and overlays.
function mockContext({ generate = null, speakMs = 0 } = {}) {
  const spoken = [];
  const metrics = [];
  const overlays = [];
  const cleanups = [];
  const ctx = {
    helpers: {
      wait: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
      webcam: { start: async () => ({ video: {}, stop() {} }) },
      biofeedback: { analyzeVideo: async () => ({ aus: {} }), getTopAUs: () => [] },
      project: {}
    },
    agent: {
      speak: async (text) => { spoken.push(text); if (speakMs) await new Promise((r) => setTimeout(r, speakMs)); },
      stopSpeaking() { ctx.stoppedSpeaking = true; },
      neutral() {}
    },
    metrics: { create: () => ({ record: (...args) => metrics.push(args) }) },
    ui: {
      mountOverlay: (node) => overlays.push(node),
      setRunnerControlsVisible: (v) => { ctx.runnerVisible = v; },
      clear: () => { ctx.cleared = true; }
    },
    settings: { labelElement: () => {} },
    onCleanup: (cb) => cleanups.push(cb),
    spoken,
    metricsLog: metrics,
    overlays,
    cleanups
  };
  if (generate) ctx.llm = { generate };
  return ctx;
}

module.exports = { saidIn, isClassifierPrompt, scriptedLlm, FakeElement, installDom, uninstallDom, mockContext };
