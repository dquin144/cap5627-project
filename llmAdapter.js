/**
 * CAP 5627 — Team 3.2 — v0.5 evaluation build
 * Thin wrapper around the eEVA platform LLM helper. No API keys, no direct network requests:
 * the platform keeps provider keys on its backend.
 *
 * Documented helper names (verify on sage.cs.fiu.edu; the startup diagnostics print which one
 * was found):
 *   - context.llm.generate(prompt)          Project Studio helper API
 *   - context.helpers.llm.generate(prompt)  student module guide (helpers.llm.generate)
 * The documented return value is "generated text"; extractGeneratedText() also accepts the
 * common object shapes in case the platform wraps it.
 *
 * Browser-safe CommonJS; uses only the global setTimeout/clearTimeout.
 */

// Returns { generate, name } for the first available LLM helper, or null if none exists.
// generate(prompt) is bound to its owner object so `this` is preserved.
function resolveLlm(context) {
  const candidates = [
    ["context.llm.generate", context && context.llm],
    ["context.helpers.llm.generate", context && context.helpers && context.helpers.llm]
  ];
  for (const [name, owner] of candidates) {
    if (owner && typeof owner.generate === "function") {
      return { name, generate: (prompt) => owner.generate(prompt) };
    }
  }
  return null;
}

// Pulls the text out of a helper result: a string, or an object with a common text field.
// Returns "" when no text can be found.
function extractGeneratedText(result) {
  if (typeof result === "string") return result.trim();
  if (!result || typeof result !== "object") return "";
  const direct = [result.text, result.content, result.output, result.response, result.reply,
    result.completion, result.result, result.message];
  for (const value of direct) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && typeof value.content === "string") return value.content.trim();
  }
  // OpenAI-style { choices: [{ message: { content } }] } or { choices: [{ text }] }.
  const choice = Array.isArray(result.choices) ? result.choices[0] : null;
  if (choice) {
    if (choice.message && typeof choice.message.content === "string") return choice.message.content.trim();
    if (typeof choice.text === "string") return choice.text.trim();
  }
  // Anthropic-style { content: [{ type: "text", text }] }.
  if (Array.isArray(result.content)) {
    const joined = result.content.map((p) => (p && typeof p.text === "string" ? p.text : "")).join("").trim();
    if (joined) return joined;
  }
  return "";
}

class LlmTimeoutError extends Error {
  constructor(ms) {
    super("LLM call timed out after " + ms + " ms");
    this.name = "LlmTimeoutError";
  }
}

// Resolves with the promise's value, or rejects with LlmTimeoutError after ms. The underlying
// request cannot be cancelled; a late result is simply ignored. The timer is always cleared.
function withTimeout(promise, ms) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new LlmTimeoutError(ms)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

// One LLM call, never throws. Returns
//   { ok: true, text, latencyMs }  or
//   { ok: false, reason: "unavailable" | "timeout" | "error" | "empty", error, latencyMs }.
// No retries happen here; callers decide (bounded) retries.
async function callLlm(generate, prompt, { timeoutMs = 8000, now = Date.now } = {}) {
  const started = now();
  if (typeof generate !== "function") {
    return { ok: false, reason: "unavailable", error: "no platform LLM helper", latencyMs: 0 };
  }
  try {
    const raw = await withTimeout(generate(prompt), timeoutMs);
    const text = extractGeneratedText(raw);
    const latencyMs = now() - started;
    if (!text) return { ok: false, reason: "empty", error: "empty or unrecognised LLM output", latencyMs };
    return { ok: true, text, latencyMs };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof LlmTimeoutError ? "timeout" : "error",
      error: err && err.message ? err.message : String(err),
      latencyMs: now() - started
    };
  }
}

module.exports = {
  resolveLlm,
  extractGeneratedText,
  withTimeout,
  callLlm,
  LlmTimeoutError
};
