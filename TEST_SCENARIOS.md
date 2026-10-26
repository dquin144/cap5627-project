# Team 3.2 — Baseline Test Scenarios

**Purpose:** Test the end-to-end check-in trigger on eEVA (OpenFace 3.0 peak AU4, speech-to-text, phrase match, AND rule). Each trial belongs to one of four conditions, and an experimenter presses **Start trial** and annotates the result. See `BASELINE_PROTOCOL.md` for the full protocol.

**Version:** Record the module, date, commit hash and tested settings at the freeze, before counted trials. **Status:** Prepared conditions, not collected data.

## Conditions

| ID | Condition | Facial cue | Verbal cue | Should fire? |
|---|---|---|---|---|
| A | Both cues | present | present | **yes** |
| B | Facial only | present | absent | no |
| C | Verbal only | absent | present | no |
| D | Neither | absent | absent | no |

The conditions must be tested equally. Each participant gets one randomly assigned set of scenarios, assigned offline by hand (no randomization in code); record the order in Notes.

## Task cards

**[TO BE SUPPLIED by the team.]** The pose instruction, the line and the timing relative to **Start trial** for each of A–D, word for word, plus the criteria for a "proper" pose and line. A trial where the pose or line is not performed properly does not count and is retried (see the protocol).

### Draft lines from an earlier version (NOT the final task cards)

Kept only as raw material for the cards. They were written for an earlier plan with posed expressions and 5 trials per condition (20 total), and the team has not confirmed them for the baseline. Rows A4, B2 and B4 originally asked for an eyelid squint (the AU7 pose); AU7 is no longer a facial cue, so they now say brow lowering (AU4). The pose wording is still to be set in the final task cards.

| ID | Condition | Expression instruction | Draft line | Should fire? |
|---|---|---|---|---|
| A1 | Both cues | Lower brows / frown | I'm really stressed about my exams. | yes |
| A2 | Both cues | Lower brows / frown | I've been having a rough week. | yes |
| A3 | Both cues | Lower brows / frown | I'm overwhelmed with schoolwork. | yes |
| A4 | Both cues | Lower brows / frown (was: squint, for AU7) | I'm frustrated with this assignment. | yes |
| A5 | Both cues | Lower brows / frown | I'm struggling to keep up. | yes |
| B1 | Facial only | Lower brows / frown | I finished my homework today. | no |
| B2 | Facial only | Lower brows / frown (was: squint, for AU7) | I'm going to class tomorrow. | no |
| B3 | Facial only | Lower brows / frown | This is an interesting topic. | no |
| B4 | Facial only | Lower brows / frown (was: squint, for AU7) | I had breakfast this morning. | no |
| B5 | Facial only | Lower brows / frown | I'm working on my project. | no |
| C1 | Verbal only | Neutral face | I'm feeling stressed today. | no |
| C2 | Verbal only | Neutral face | I've had a difficult week. | no |
| C3 | Verbal only | Neutral face | I'm worried about my grades. | no |
| C4 | Verbal only | Neutral face | I'm exhausted from studying. | no |
| C5 | Verbal only | Neutral face | I'm having a hard time. | no |
| D1 | Neither | Neutral face | I'm doing pretty well today. | no |
| D2 | Neither | Neutral face | My classes are going fine. | no |
| D3 | Neither | Neutral face | I'm enjoying this course. | no |
| D4 | Neither | Neutral face | I finished my assignment. | no |
| D5 | Neither | Neutral face | I'm looking forward to the weekend. | no |

## Short procedure

1. Get consent for participation and, separately, for webcam and microphone processing; assign an anonymous participant ID. Do dry runs first (see **Capture AU**) and exclude them from the counts.
2. Give the participant the task card for the trial without telling them the expected trigger decision. Write down the condition and `Should fire?` before the run.
3. Press **Start trial**; the participant performs the card. Read the module's decision.
4. Record the row in the **Team 3.2** trial-log tab: ID, date and time, version, participant, condition, `Should fire?`, `Fired?`, outcome and notes. Log failures too; an invalid performance is its own row (see the protocol).
5. When every condition has been tested equally, report n overall and per condition, the confusion matrix, accuracy, precision, recall and F1. State that the baseline used OpenFace 3.0 and the end-to-end trigger, with AU4 as the only facial cue (AU7 was dropped; see `AU_SELECTION_RATIONALE.md`).

## Interpretation and limitations

- The `Should fire?` labels are **design labels** for the current rule (`facial cue AND verbal cue`). They are **not independent human judgments** of whether an empathetic check-in would feel appropriate.
- In particular, condition C contains real statements of distress; a human may reasonably want a check-in despite a neutral face. This limitation should be discussed rather than described as correct social behavior.
- The measured AU4 values come from OpenFace 3.0 and are not validated evidence of an actual emotional state.
- Lines chosen to match the keyword vocabulary make these trials an initial **controlled functionality test** rather than a robust test of general-language understanding. Negation and paraphrases are not handled and will be addressed separately.
- Follow the instructor's approved consent, retention and participant rules; ask before involving anyone outside the class. Freeze the code version before counted trials and record any subsequent changes.
