/**
 * CAP 5627 — Team 3.2
 * Check-in decision logic, browser-safe (no Node built-ins).
 *
 * The rule: check in only when a facial cue (AU4 or AU7) AND a verbal cue (a listed phrase of
 * concern) are both present. See the README for the research rationale.
 *
 * Sections 1-5 below are a verbatim copy of trigger.js (CONFIGURATION through CHECK-IN
 * DECISION MAKER). trigger.js also holds the Node command-line modes, and its Node-only
 * requires cannot load in the eEVA browser runtime, so main.js requires this file instead.
 * If the keyword list or rule changes in one file, change both.
 */

// =====================================
// 1. CONFIGURATION
// =====================================

const CONFIG = {
  // Minimum AU intensity (0-100 scale) that counts as a facial cue in numeric mode.
  // Provisional and uncalibrated. Not used in binary mode.
  auThreshold: 45, // Provisional, not calibrated

  // Action Unit ids watched for the facial cue: AU4 (brow lowerer) and AU7 (lid tightener).
  facialAUs: ["4", "7"],

  // Phrases that count as a verbal expression of concern. Matched case-insensitively and as
  // whole phrases. Frozen during counted baseline trials. "anxious" is listed twice; this is
  // harmless and left unchanged because the list is frozen.
  distressPhrases: [
    "stressed",
    "stressful",
    "overwhelmed",
    "frustrated",
    "worried",
    "anxious",
    "upset",
    "struggling",
    "having a hard time",
    "difficult time",
    "difficult week",
    "rough week",
    "rough day",
    "bad day",
    "exhausted",
    "burned out",
    "burnt out",
    "falling behind",
    "under pressure",
    "having trouble",
    "feeling down",
    "not doing well",
    "can't keep up",
    "cannot keep up",
    "too much to handle",
    "need help",
    "sad",
    "depressed",
    "anxious"
  ],

  // Name of the check-in wording strategy to use after a trigger. Not used by the decision
  // itself; it is for the later wording experiment.
  checkInStrategy: "tentative_uncertainty"
};

// =====================================
// 2. NUMERIC FACIAL AU DETECTION
// =====================================

// Facial cue from measured intensities. aus maps an AU id to its intensity, for example
// { "4": 61, "7": 48 }. Returns whether any watched AU reached the threshold and which ones.
function detectFacialCue(aus) {
  // Watched AU ids whose intensity is a real number at or above the threshold.
  const matchedAUs = CONFIG.facialAUs.filter(
    id => Number.isFinite(aus[id]) &&
          aus[id] >= CONFIG.auThreshold
  );

  return {
    detected: matchedAUs.length > 0,
    matchedAUs
  };
}

// =====================================
// 3. BINARY FACIAL ANNOTATION
// =====================================

// Facial cue from a human observer's yes/no marks. annotations maps an AU id to true or
// false, for example { "4": true, "7": false }. These are AU-like observations, not
// validated FACS coding. Returns whether any watched AU was marked and which ones.
function detectBinaryFacialCue(annotations) {
  // Watched AU ids the observer marked as seen.
  const matchedAUs = CONFIG.facialAUs.filter(
    id => annotations[id] === true
  );

  return {
    detected: matchedAUs.length > 0,
    matchedAUs
  };
}

// =====================================
// 4. VERBAL CUE DETECTION
// =====================================

// Verbal cue from the spoken sentence. Returns whether any listed phrase appears and which
// ones. Matching ignores case and curly apostrophes, and requires a whole phrase, so "sad"
// does not match inside "saddle".
function detectVerbalCue(transcript) {
  // Lowercased sentence with curly apostrophes replaced by straight ones.
  const text = String(transcript)
    .toLowerCase()
    .replace(/[’]/g, "'");

  // Listed phrases found in the sentence.
  const matchedPhrases = CONFIG.distressPhrases.filter(
    phrase => {
      // The phrase with regex special characters escaped, so it matches literally.
      const escaped = phrase.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      // Phrase surrounded by the start/end of the text or a non-letter on each side.
      const regex = new RegExp(
        `(^|[^a-z])${escaped}(?=$|[^a-z])`,
        "i"
      );

      return regex.test(text);
    }
  );

  return {
    detected: matchedPhrases.length > 0,
    matchedPhrases
  };
}

// =====================================
// 5. CHECK-IN DECISION MAKER
// =====================================

// The rule: check in only when BOTH a facial cue and a verbal cue are present.
// Pass aus (numeric intensities) or annotations (yes/no observations) for the face, plus the
// transcript. If annotations is given it is used and aus is ignored.
function evaluateCheckIn({
  aus,
  annotations,
  transcript
}) {
  // Facial result from whichever input was supplied.
  const facial = annotations !== undefined
    ? detectBinaryFacialCue(annotations)
    : detectFacialCue(aus || {});

  // Verbal result from the spoken sentence.
  const verbal = detectVerbalCue(transcript);

  // True only when both cues are present.
  const shouldTrigger =
    facial.detected && verbal.detected;

  return {
    facialCue: facial.detected,
    verbalCue: verbal.detected,
    matchedAUs: facial.matchedAUs,
    matchedPhrases: verbal.matchedPhrases,
    shouldTrigger
  };
}

module.exports = {
  CONFIG,
  detectFacialCue,
  detectBinaryFacialCue,
  detectVerbalCue,
  evaluateCheckIn
};
