/**
 * CAP 5627 — Team 3.2
 * Check-in decision logic: the rule, the distress phrase list and the AU threshold.
 * Browser-safe (no Node built-ins) and loaded by main.js.
 *
 * The rule: check in only when a facial cue (AU4) AND a verbal cue (a listed phrase of
 * concern) are both present. AU7 was originally a second facial cue and was dropped; the
 * reasons are in AU_SELECTION_RATIONALE.md. See the README for the research rationale.
 *
 * Frozen once the baseline is frozen: after that, any change to the rule, the phrase list or
 * the threshold means a new version and a restart of the counted trials.
 */

// =====================================
// 1. CONFIGURATION
// =====================================

const CONFIG = {
  // Minimum AU intensity (on the 0-100 scale the trial reads) that counts as a facial cue.
  // Provisional and uncalibrated: it is set from the Capture AU dry runs.
  auThreshold: 45, // Provisional, not calibrated

  // Action Unit ids watched for the facial cue: AU4 (brow lowerer) only. AU7 (lid tightener)
  // was dropped as the second cue: OpenFace 3.0, the baseline's analyzer, does not return it,
  // and PyFeat's AU7 readings were too sensitive and noisy to use. See
  // AU_SELECTION_RATIONALE.md.
  // Original: facialAUs: ["4", "7"],
  facialAUs: ["4"],

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
  ]
};

// =====================================
// 2. FACIAL CUE DETECTION
// =====================================

// Facial cue from measured intensities. aus maps an AU id to its intensity, for example
// { "4": 61 }. Returns whether any watched AU reached the threshold and which ones.
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
// 3. VERBAL CUE DETECTION
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
// 4. CHECK-IN DECISION MAKER
// =====================================

// The rule: check in only when BOTH a facial cue and a verbal cue are present.
// aus is the measured AU intensities (the peak per AU during the trial); transcript is the
// spoken sentence.
function evaluateCheckIn({
  aus,
  transcript
}) {
  // Facial result from the measured intensities.
  const facial = detectFacialCue(aus || {});

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
  detectVerbalCue,
  evaluateCheckIn
};
