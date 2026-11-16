// Frozen v0.4 rule regression: trigger.js must behave exactly as at the baseline freeze.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { CONFIG, detectFacialCue, detectVerbalCue, evaluateCheckIn } = require("../trigger.js");

const ROOT = path.join(__dirname, "..");
const FROZEN_TAG = "v0.4-baseline-frozen";

test("frozen files are byte-identical to the v0.4 tag (line endings normalised)", (t) => {
  for (const file of ["trigger.js", "config.json"]) {
    let frozen;
    try {
      frozen = execFileSync("git", ["show", FROZEN_TAG + ":" + file], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch (err) {
      t.skip("git tag " + FROZEN_TAG + " not available");
      return;
    }
    const current = fs.readFileSync(path.join(ROOT, file), "utf8");
    const norm = (s) => s.replace(/\r\n/g, "\n");
    assert.equal(norm(current), norm(frozen), file + " was modified after the baseline freeze");
  }
});

test("threshold constants are the frozen values", () => {
  assert.equal(CONFIG.auThreshold, 45);
  assert.deepEqual(CONFIG.facialAUs, ["4"]);
});

test("AU4 threshold boundary 44.9 / 45 / 45.1", () => {
  assert.equal(detectFacialCue({ "4": 44.9 }).detected, false);
  assert.equal(detectFacialCue({ "4": 45 }).detected, true);
  assert.equal(detectFacialCue({ "4": 45.1 }).detected, true);
});

test("missing or malformed AU values never count as a facial cue", () => {
  for (const aus of [{}, { "4": null }, { "4": undefined }, { "4": NaN }, { "4": "60" }, { "4": Infinity }, { "7": 99 }]) {
    assert.equal(detectFacialCue(aus).detected, false, JSON.stringify(aus));
  }
  assert.equal(evaluateCheckIn({ aus: undefined, transcript: "I'm stressed" }).shouldTrigger, false);
});

const LINES = {
  A: ["I'm really stressed about my exams.", "I've been having a rough week.", "I'm overwhelmed with schoolwork.", "I'm frustrated with this assignment.", "I'm struggling to keep up."],
  B: ["I finished my homework today.", "I'm going to class tomorrow.", "This is an interesting topic.", "I had breakfast this morning.", "I'm working on my project."],
  C: ["I'm feeling stressed today.", "I've had a difficult week.", "I'm worried about my grades.", "I'm exhausted from studying.", "I'm having a hard time."],
  D: ["I'm doing pretty well today.", "My classes are going fine.", "I'm enjoying this course.", "I finished my assignment.", "I'm looking forward to the weekend."]
};
const FROWN = { "4": 61 };
const RELAXED = { "4": 10 };

test("the 20 baseline task-card lines give the designed decisions under the AND rule", () => {
  for (const line of LINES.A) assert.equal(evaluateCheckIn({ aus: FROWN, transcript: line }).shouldTrigger, true, "A: " + line);
  for (const line of LINES.B) assert.equal(evaluateCheckIn({ aus: FROWN, transcript: line }).shouldTrigger, false, "B: " + line);
  for (const line of LINES.C) {
    const r = evaluateCheckIn({ aus: RELAXED, transcript: line });
    assert.equal(r.verbalCue, true, "C verbal: " + line);
    assert.equal(r.shouldTrigger, false, "C: " + line);
  }
  for (const line of LINES.D) assert.equal(evaluateCheckIn({ aus: RELAXED, transcript: line }).shouldTrigger, false, "D: " + line);
});

test("documented keyword limitations are still present (baseline is not silently 'fixed')", () => {
  assert.equal(detectVerbalCue("I'm not stressed").detected, true); // negation not handled in v0.4
  assert.equal(detectVerbalCue("Everything is piling up").detected, false); // paraphrase missed
  assert.equal(detectVerbalCue("I'm riding my saddle").detected, false); // whole-phrase match
});
