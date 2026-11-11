const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveLlm, extractGeneratedText, callLlm } = require("../llmAdapter.js");

test("resolveLlm prefers context.llm.generate, then context.helpers.llm.generate, else null", async () => {
  const a = { llm: { tag: "a", generate() { return this.tag; } }, helpers: { llm: { generate: () => "b" } } };
  assert.equal(resolveLlm(a).name, "context.llm.generate");
  assert.equal(await resolveLlm(a).generate("p"), "a", "this binding preserved");
  assert.equal(resolveLlm({ helpers: { llm: { generate: () => "b" } } }).name, "context.helpers.llm.generate");
  assert.equal(resolveLlm({}), null);
  assert.equal(resolveLlm({ llm: { generate: "not a function" } }), null);
  assert.equal(resolveLlm(undefined), null);
});

test("extractGeneratedText handles string and common object shapes", () => {
  assert.equal(extractGeneratedText("  hi "), "hi");
  assert.equal(extractGeneratedText({ text: "t" }), "t");
  assert.equal(extractGeneratedText({ content: "c" }), "c");
  assert.equal(extractGeneratedText({ message: { content: "m" } }), "m");
  assert.equal(extractGeneratedText({ choices: [{ message: { content: "o" } }] }), "o");
  assert.equal(extractGeneratedText({ content: [{ type: "text", text: "x" }, { type: "text", text: "y" }] }), "xy");
  assert.equal(extractGeneratedText({ foo: 1 }), "");
  assert.equal(extractGeneratedText(null), "");
});

test("callLlm reports unavailable / error / empty / timeout without throwing", async () => {
  assert.equal((await callLlm(null, "p")).reason, "unavailable");
  assert.equal((await callLlm(async () => { throw new Error("401"); }, "p")).reason, "error");
  assert.equal((await callLlm(async () => ({ nothing: true }), "p")).reason, "empty");
  const slow = () => new Promise((r) => setTimeout(() => r("late"), 200));
  const res = await callLlm(slow, "p", { timeoutMs: 20 });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "timeout");
  const ok = await callLlm(async () => "fine", "p");
  assert.deepEqual([ok.ok, ok.text], [true, "fine"]);
});

test("synchronous throw from the helper is caught", async () => {
  const res = await callLlm(() => { throw new Error("boom"); }, "p");
  assert.equal(res.reason, "error");
  assert.match(res.error, /boom/);
});
