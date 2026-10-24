/**
 * CAP 5627 — Team 3.2
 * Offline Empathic Check-In Trigger v0.3
 *
 * Purpose: decide whether an agent should check in on a participant. The decision is a
 * transparent rule, not a learned model:  check in = facial cue AND verbal cue.
 *
 * The two cues:
 *  - Facial cue: AU4 (brow lowerer) or AU7 (lid tightener), measured or observed.
 *  - Verbal cue: a listed expression of concern in the spoken sentence.
 * Requiring BOTH keeps a facial movement alone (concentration, squinting) from triggering a
 * check-in. The research rationale for these choices is in the README.
 *
 * Known limits: the threshold (45) is provisional and uncalibrated; negation is not handled
 * ("I'm not stressed" still matches); only listed phrases are detected, so paraphrases are
 * missed. The keyword list is frozen during counted baseline trials.
 *
 * Run modes:
 * node trigger.js
 *    Default simulated conversation (not baseline data)
 *
 * node trigger.js --interactive
 *    Manual numeric AU intensity inputs
 *
 * node trigger.js --binary
 *    Manual yes/no facial observations (the counted offline baseline)
 *
 * Node.js 18+. No external packages.
 *
 * Sections 1-5 are copied verbatim into trigger-core.js, the browser-safe copy that the
 * eEVA project loads (this file's Node-only requires cannot load there). Keep them identical.
 */

// Node-only: used by the command-line modes at the bottom of this file.
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");

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

// =====================================
// 6. PREDEFINED SIMULATED CONVERSATION
// =====================================

// Scripted turns for the default demo. Each has the spoken line and a set of AU intensities
// (0-100). AU12 (smile) is included for realism but is not watched, so it does not affect the
// decision. The demo is for illustration only and is not baseline data.
const demoTurns = [
  {
    line: "I'm doing pretty well in my courses.",
    aus: { "4": 12, "7": 8, "12": 72 }
  },
  {
    line: "This assignment is pretty interesting.",
    aus: { "4": 61, "7": 48, "12": 6 }
  },
  {
    line: "I'm a little worried about my upcoming exam.",
    aus: { "4": 20, "7": 10, "12": 0 }
  },
  {
    line: "I'm overwhelmed by how much I have to study.",
    aus: { "4": 66, "7": 53, "12": 0 }
  },
  {
    line: "Thanks, I think I can manage now.",
    aus: { "4": 14, "7": 10, "12": 55 }
  }
];

// =====================================
// 7. DISPLAY TRIGGER DECISION
// =====================================

// Evaluates one turn, prints the inputs, each cue, the matches and the decision, and returns
// the evaluation result. number is the turn label; line is the sentence; aus or annotations
// is the facial input.
function displayTurn(number, {
  line,
  aus,
  annotations
}) {
  // Decision for this turn.
  const result = evaluateCheckIn({
    transcript: line,
    aus,
    annotations
  });

  console.log(`\nTurn ${number}: ${line}`);

  console.log(
    "Facial inputs:",
    annotations !== undefined
      ? annotations
      : aus
  );

  console.log(
    `Facial cue: ${result.facialCue}`
  );

  console.log(
    `Matched AUs: ${
      result.matchedAUs.join(", ") || "None"
    }`
  );

  console.log(
    `Verbal cue: ${result.verbalCue}`
  );

  console.log(
    `Matched phrases: ${
      result.matchedPhrases.join(", ") || "None"
    }`
  );

  console.log(
    `Decision: ${
      result.shouldTrigger
        ? "CHECK IN"
        : "DO NOT CHECK IN"
    }`
  );

  if (result.shouldTrigger) {
    console.log(
      "Future LLM strategy:",
      CONFIG.checkInStrategy
    );
  }

  return result;
}

// =====================================
// 8. INPUT HELPER
// =====================================

// Asks a yes/no question on the command line and repeats until the answer is y/yes or n/no.
// Returns true for yes and false for no.
async function askYesNo(rl, question) {
  while (true) {
    // The person's reply, trimmed and lowercased.
    const answer = (
      await rl.question(`${question} (y/n): `)
    ).trim().toLowerCase();

    if (["y", "yes"].includes(answer)) {
      return true;
    }

    if (["n", "no"].includes(answer)) {
      return false;
    }

    console.log("Please enter y or n.");
  }
}

// =====================================
// 9. INTERACTIVE MODES
// =====================================

// Command-line loop: asks for a sentence, then for the facial input, then shows the decision.
// binary = true asks the observer yes/no questions; false asks for numeric AU intensities.
// Typing "exit" at the sentence prompt ends it.
async function interactiveMode(binary = false) {
  // Reads typed answers from the terminal.
  const rl = readline.createInterface({
    input,
    output
  });

  console.log(
    binary
      ? "\nBINARY FACIAL ANNOTATION MODE"
      : "\nNUMERIC AU MODE"
  );

  console.log(
    "Type exit at the sentence prompt to quit."
  );

  // Running turn number shown in the output.
  let turn = 1;

  try {
    while (true) {
      // The participant's spoken line, typed in by the experimenter.
      const line = (
        await rl.question(
          "\nParticipant sentence (or exit): "
        )
      ).trim();

      if (line.toLowerCase() === "exit") {
        break;
      }

      if (!line) {
        continue;
      }

      if (binary) {
        // Human-observed facial movements: AU id -> true/false.
        const annotations = {};

        annotations["4"] = await askYesNo(
          rl,
          "AU4-like brow lowering observed?"
        );

        annotations["7"] = await askYesNo(
          rl,
          "AU7-like lid tightening observed?"
        );

        displayTurn(turn++, {
          line,
          annotations
        });

      } else {
        // Typed AU intensities: AU id -> 0-100.
        const aus = {};

        for (const au of CONFIG.facialAUs) {
          while (true) {
            // The typed intensity text; blank means 0.
            const entry = (
              await rl.question(
                `AU${au} intensity (0-100, blank=0): `
              )
            ).trim();

            // The entry as a number.
            const value = entry === ""
              ? 0
              : Number(entry);

            if (
              Number.isFinite(value) &&
              value >= 0 &&
              value <= 100
            ) {
              aus[au] = value;
              break;
            }

            console.log(
              "Enter a number between 0 and 100."
            );
          }
        }

        displayTurn(turn++, {
          line,
          aus
        });
      }
    }
  } finally {
    rl.close();
  }
}

// =====================================
// 10. PROGRAM ENTRY POINT
// =====================================

// Runs only when this file is started directly with node, not when another file requires it.
if (require.main === module) {
  // The command-line option chosen: --demo (default), --interactive or --binary.
  const mode = process.argv[2];

  if (!mode || mode === "--demo") {
    console.log(
      "SIMULATED CONVERSATION — NOT BASELINE DATA"
    );

    demoTurns.forEach((turn, index) => {
      displayTurn(index + 1, turn);
    });

  } else if (
    mode === "--interactive" ||
    mode === "--binary"
  ) {
    interactiveMode(
      mode === "--binary"
    ).catch(error => {
      console.error(error);
      process.exitCode = 1;
    });

  } else {
    console.error(
      "Usage: node trigger.js " +
      "[--demo|--interactive|--binary]"
    );

    process.exitCode = 1;
  }
}

// =====================================
// 11. EXPORTS
// =====================================

module.exports = {
  CONFIG,
  demoTurns,
  detectFacialCue,
  detectBinaryFacialCue,
  detectVerbalCue,
  evaluateCheckIn
};
