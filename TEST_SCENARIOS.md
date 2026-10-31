# Team 3.2 — Baseline Test Scenarios

**Purpose:** Test the end-to-end check-in trigger on eEVA (OpenFace 3.0 peak AU4, speech-to-text, phrase match, AND rule). Each trial belongs to one of four conditions, and an experimenter presses **Start trial** and annotates the result from the trial report the module shows afterwards. See `BASELINE_PROTOCOL.md` for the full protocol, the instructions read aloud, and the timing.

**Version:** v0.4 (frozen baseline, including the trial report). Record the module, date, commit hash and tested settings at the freeze, before counted trials. **Status:** Prepared conditions and task cards, not collected data.

## Conditions

| ID | Condition | Log label (dropdown) | Facial cue | Verbal cue | Should fire? |
|---|---|---|---|---|---|
| A | Both cues | A: both cues | present | present | **yes** |
| B | Facial only | B: facial only | present | absent | no |
| C | Verbal only | C: verbal only | absent | present | no |
| D | Neither | D: neither | absent | absent | no |

The conditions must be tested equally. Each participant gets one randomly assigned order of the four conditions and one line per condition, assigned offline by hand (no randomization in code); record the order in Notes. The assignment for P01 to P05 is in `BASELINE_PROTOCOL.md`, section 5.

## Task cards

One printed card per line. The participant sees only the front. The back carries the line ID, for the experimenter only. Never show the condition letter or the expected outcome. The card wording is the one in `BASELINE_PROTOCOL.md`, section 4:

- **Frown card (A and B).** Pose: "Lower your eyebrows and pull them together, as if you were frowning or concentrating hard. Start at the nod and keep it until I say 'thank you.'" Say, once, exactly: "<line>"
- **Relaxed card (C and D).** Pose: "Keep your face relaxed and still, as if you were listening. Do not frown. Start at the nod and keep it until I say 'thank you.'" Say, once, exactly: "<line>"

The pose and line criteria for a proper performance, and the timing, are in `BASELINE_PROTOCOL.md`, section 4. A trial where the pose or line is not performed properly does not count and is retried with the same card (see the protocol).

### Lines

5 per condition, 20 in total, each used once across P01 to P05. All frown cards use brow lowering (AU4); AU7 is no longer a facial cue. Every A and C line contains a phrase from the frozen `distressPhrases` list in `trigger.js`, and no B or D line does (checked by hand against the list). The check is on the written lines; the module hears them through speech-to-text, and a mishearing is a result, not an exclusion.

| Line ID | Condition | Pose | Line | Should fire? |
|---|---|---|---|---|
| A1 | Both cues | Frown (lower brows) | I'm really stressed about my exams. | yes |
| A2 | Both cues | Frown (lower brows) | I've been having a rough week. | yes |
| A3 | Both cues | Frown (lower brows) | I'm overwhelmed with schoolwork. | yes |
| A4 | Both cues | Frown (lower brows) | I'm frustrated with this assignment. | yes |
| A5 | Both cues | Frown (lower brows) | I'm struggling to keep up. | yes |
| B1 | Facial only | Frown (lower brows) | I finished my homework today. | no |
| B2 | Facial only | Frown (lower brows) | I'm going to class tomorrow. | no |
| B3 | Facial only | Frown (lower brows) | This is an interesting topic. | no |
| B4 | Facial only | Frown (lower brows) | I had breakfast this morning. | no |
| B5 | Facial only | Frown (lower brows) | I'm working on my project. | no |
| C1 | Verbal only | Relaxed | I'm feeling stressed today. | no |
| C2 | Verbal only | Relaxed | I've had a difficult week. | no |
| C3 | Verbal only | Relaxed | I'm worried about my grades. | no |
| C4 | Verbal only | Relaxed | I'm exhausted from studying. | no |
| C5 | Verbal only | Relaxed | I'm having a hard time. | no |
| D1 | Neither | Relaxed | I'm doing pretty well today. | no |
| D2 | Neither | Relaxed | My classes are going fine. | no |
| D3 | Neither | Relaxed | I'm enjoying this course. | no |
| D4 | Neither | Relaxed | I finished my assignment. | no |
| D5 | Neither | Relaxed | I'm looking forward to the weekend. | no |

## Short procedure

1. Get consent for participation and, separately, for webcam and microphone processing; assign an anonymous participant ID. The dry runs (done with **Capture AU**, now commented out) are finished and are excluded from the counts.
2. Read the instructions aloud (`BASELINE_PROTOCOL.md`, section 3). Give the participant the task card for the trial without telling them the expected trigger decision. Write down the condition and `Should fire?` before the run.
3. Press **Start trial** and nod; the participant performs the card. Mark the performance valid or invalid on the paper sheet, then read the trial report (transcript, AU values, cue flags, decision).
4. Record the row in the **Team 3.2** trial-log tab: ID, date and time, version, participant, condition (from the column E dropdown), `Should fire?`, `Fired?`, outcome, notes, and the trial-report columns (`BASELINE_PROTOCOL.md`, section 6). Log failures too; an invalid performance is its own row (see the protocol).
5. When every condition has been tested equally, report n overall and per condition, the confusion matrix, accuracy, precision, recall and F1, and the per-participant score (mean, median, range) from the workbook's Summary tab. State that the baseline used OpenFace 3.0 and the end-to-end trigger, with AU4 as the only facial cue (AU7 was dropped; see `AU_SELECTION_RATIONALE.md`).

## Interpretation and limitations

- The `Should fire?` labels are **design labels** for the current rule (`facial cue AND verbal cue`). They are **not independent human judgments** of whether an empathetic check-in would feel appropriate.
- In particular, condition C contains real statements of distress; a human may reasonably want a check-in despite a neutral face. This limitation should be discussed rather than described as correct social behavior.
- The measured AU4 values come from OpenFace 3.0 and are not validated evidence of an actual emotional state. The frowns are posed on request.
- Lines chosen to match the keyword vocabulary make these trials an initial **controlled functionality test** rather than a robust test of general-language understanding. Negation and paraphrases are not handled and will be addressed separately.
- Follow the instructor's approved consent, retention and participant rules; ask before involving anyone outside the class. Freeze the code version before counted trials and record any subsequent changes.
