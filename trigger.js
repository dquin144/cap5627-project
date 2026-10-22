
/**
 * CAP 5627 — Team 3.2
 * Offline Empathic Check-In Trigger v0.3
 *
 * node trigger.js
 *    Default simulated conversation
 *
 * node trigger.js --interactive
 *    Manual numeric AU intensity inputs
 *
 * node trigger.js --binary
 *    Manual yes/no facial observations
 *
 * Node.js 18+. No external packages.
 */

const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");

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

// =====================================
// 6. PREDEFINED SIMULATED CONVERSATION
// =====================================

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

function displayTurn(number, {
  line,
  aus,
  annotations
}) {
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

async function askYesNo(rl, question) {
  while (true) {
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

async function interactiveMode(binary = false) {
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

  let turn = 1;

  try {
    while (true) {
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
        // Human-observed facial movements.
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
        // Numeric AU intensities.
        const aus = {};

        for (const au of CONFIG.facialAUs) {
          while (true) {
            const entry = (
              await rl.question(
                `AU${au} intensity (0-100, blank=0): `
              )
            ).trim();

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

if (require.main === module) {
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
