# Team 3.2 — Baseline Test Scenarios

**Purpose:** Pilot the offline check-in trigger while eEVA is unavailable. The `--binary` mode accepts manually annotated **AU4-like brow lowering** and **AU7-like lid tightening**, plus the participant's spoken sentence. These observations are not automatic AU measurements. Confirm with the instructor whether live observation is acceptable; the announced fallback calls for **consented recordings** of posed expressions and scripted lines.

**Version:** Record the actual Git commit hash and tested settings before counted trials. **Status:** Prepared scenarios, not collected data.

## Proposed conditions (5 trials each; 20 total)

| ID | Condition | Expression instruction | Scripted line | Expected under provisional AND rule |
|---|---|---|---|---|
| A1 | Both cues | Lower brows / frown | I'm really stressed about my exams. | Check in |
| A2 | Both cues | Lower brows / frown | I've been having a rough week. | Check in |
| A3 | Both cues | Lower brows / frown | I'm overwhelmed with schoolwork. | Check in |
| A4 | Both cues | Tighten eyelids / squint slightly | I'm frustrated with this assignment. | Check in |
| A5 | Both cues | Lower brows / frown | I'm struggling to keep up. | Check in |
| B1 | Facial only | Lower brows / frown | I finished my homework today. | No check-in |
| B2 | Facial only | Tighten eyelids / squint slightly | I'm going to class tomorrow. | No check-in |
| B3 | Facial only | Lower brows / frown | This is an interesting topic. | No check-in |
| B4 | Facial only | Tighten eyelids / squint slightly | I had breakfast this morning. | No check-in |
| B5 | Facial only | Lower brows / frown | I'm working on my project. | No check-in |
| C1 | Verbal only | Neutral face | I'm feeling stressed today. | No check-in |
| C2 | Verbal only | Neutral face | I've had a difficult week. | No check-in |
| C3 | Verbal only | Neutral face | I'm worried about my grades. | No check-in |
| C4 | Verbal only | Neutral face | I'm exhausted from studying. | No check-in |
| C5 | Verbal only | Neutral face | I'm having a hard time. | No check-in |
| D1 | Neither | Neutral face | I'm doing pretty well today. | No check-in |
| D2 | Neither | Neutral face | My classes are going fine. | No check-in |
| D3 | Neither | Neutral face | I'm enjoying this course. | No check-in |
| D4 | Neither | Neutral face | I finished my assignment. | No check-in |
| D5 | Neither | Neutral face | I'm looking forward to the weekend. | No check-in |

## Short procedure

1. Get consent **before recording** and assign an anonymous participant ID. Do 1–2 teammate dry runs first; exclude them from baseline counts.
2. Give the participant the expression instruction and line without telling them the expected trigger decision. Have them perform the scenario; record face/voice if they consent.
3. Annotate visible AU4-like and AU7-like movements as **yes/no** using the same predefined criteria for all trials. Enter the **actual spoken sentence** and observations into `node trigger.js --binary`.
4. Record the result in the **Team 3.2** trial-log tab: ID, participant, condition, expected decision, observed decision, outcome, version, and notes. Log failures too.
5. Complete at least five trials per condition by **October 26**, then report counts, precision, recall, and the confusion matrix; mark the method *offline manually annotated fallback*.

## Interpretation and limitations

- The expected labels above are **design labels** for the current rule (`facial cue AND verbal cue`). They are **not independent human judgments** of whether an empathetic check-in would feel appropriate.
- In particular, condition C contains real statements of distress; a human may reasonably want a check-in despite a neutral face. This limitation should be discussed rather than described as correct social behavior.
- Manually observed facial movements are **not** validated AU intensities or evidence of an actual emotional state. If a movement is unclear, note uncertainty rather than guessing.
- The scripted lines were selected to match the current keyword vocabulary; this makes these trials an initial **controlled functionality test** rather than a robust test of general-language understanding. Later tests should include paraphrases, negations, and unexpected language with independently assigned labels.
- Follow the instructor's approved consent, retention and participant rules; ask before involving anyone outside the class. Freeze the code version before counted trials and record any subsequent changes.
