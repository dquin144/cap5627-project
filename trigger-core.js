/**
 * CAP 5627 — Team 3.2
 * Check-in decision logic, browser-safe (no Node built-ins).
 *
 * Sections 1-5 below are a VERBATIM copy of trigger.js v0.3 (CONFIGURATION through
 * CHECK-IN DECISION MAKER). trigger.js keeps the Node CLI for the offline baseline and
 * requires node:readline, which eEVA's browser runtime cannot load, so main.js requires
 * this file instead. If the keyword list or rule changes in one file, change both.
 */

// =====================================
// 1. CONFIGURATION
// =====================================

const CONFIG = {
  auThreshold: 45, // Provisional, not calibrated

  facialAUs: ["4", "7"],

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

  // Used later in the check-in wording experiment
  checkInStrategy: "tentative_uncertainty"
};

// =====================================
// 2. NUMERIC FACIAL AU DETECTION
// =====================================

function detectFacialCue(aus) {
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

function detectBinaryFacialCue(annotations) {
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

function detectVerbalCue(transcript) {
  const text = String(transcript)
    .toLowerCase()
    .replace(/[’]/g, "'");

  const matchedPhrases = CONFIG.distressPhrases.filter(
    phrase => {
      const escaped = phrase.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

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

function evaluateCheckIn({
  aus,
  annotations,
  transcript
}) {
  const facial = annotations !== undefined
    ? detectBinaryFacialCue(annotations)
    : detectFacialCue(aus || {});

  const verbal = detectVerbalCue(transcript);

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
