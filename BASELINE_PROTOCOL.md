# Team 3.2 — Baseline Protocol

**What this tests:** the **end-to-end trigger** on eEVA: OpenFace 3.0 peak AU4 against the threshold, speech-to-text followed by the phrase match, and the AND rule. Recognition errors are included, so a misheard line or a missed movement counts. The agent's check-in wording is not evaluated here. Participants are teammates and classmates. An experimenter presses **Start trial** and annotates each trial. After every trial the module shows a **trial report** (section 6) with everything needed to annotate it.

The wording of the instructions and task cards must not change once counted trials start.

**Facial cue:** AU4 (brow lowering) alone. AU7 was the proposal's second cue and was dropped: OpenFace 3.0 does not support it, and PyFeat's AU7 readings were too sensitive and noisy. See `AU_SELECTION_RATIONALE.md`. The slide must report this change.

**Conditions:** A both cues, B facial only, C verbal only, D neither. `Should fire?` is **yes for A** and **no for B, C and D**.

## 1. Setup

- eEVA project and module on sage.cs.fiu.edu, browser, webcam, microphone or headset, room and lighting.
- Same room, laptop, webcam and headset for every participant. Participant seated facing the camera, face evenly lit and fully visible, no hat or hand near the face. Quiet room: nobody speaks between **Start trial** and the end of the trial except the participant (the microphone would hear it). The experimenter sits beside the participant and watches the participant's face, not the screen, until the trial has ended.
- Version fields, recorded at the freeze (see README, Freeze procedure): version **v0.4** (shown on the panel at startup and written with every trial decision; the frozen build includes the trial report), eEVA project and module, date frozen, commit hash, analyzer (`openface3`), `auThreshold`, the peak/listening window, the keyword list, and the fixed `strategy` value.
- Keep the code, threshold, window and keyword list unchanged during counted trials.
- The Team 3.2 trial log, workbook `cap5627-sia-p2-trialLog-template-fall2026-v4.xlsx`: tab "3.2 Check-in" for counted trials, tab "Summary" for per-condition and per-participant results. Dry runs go on a separate tab, not on "3.2 Check-in". Do not edit the shaded formula cells. The trial-report columns listed in section 6 are added after column O.
- Materials: 20 printed task cards (see `TEST_SCENARIOS.md`), the experimenter's key sheet (card number to line ID), a paper validity sheet, and the participant's set (section 5).

## 2. Start

- Assign a participant ID: P01, P02, ... Never record names.
- Ask for consent to participate and, separately, for webcam and microphone processing. **No video or audio is kept** in the baseline. The trial report shows the transcript of the scripted line on screen and in the browser console only; it is copied into the trial log (scripted text, no names) and is not written to the metrics log.

## 3. Instructions (read aloud)

Rule: never state the hypothesis or the expected outcome. Read exactly this once per participant, after consent:

> "Thank you for helping us. This will take a few minutes. You will do four short tasks in front of the camera. In each one you will read a card, make a facial expression or keep your face relaxed, and say one sentence. The system will respond to what you do, or it may not. There are no right or wrong answers: we are testing the system, not you. The sentences are scripted, so you do not need to feel what they say. If the system says something to you, just listen; you do not need to answer. The camera and microphone are used live and no video or audio is saved. You can stop at any time."

If a participant asks what to do, answer only: "Please follow the card as written." If a participant needs more than this, the card wording needs fixing: stop, and revise it in a new pilot, not mid-baseline.

## 4. Tasks

Each trial uses one printed card. The front of the card is what the participant sees; it never shows the condition letter or the expected outcome. The back carries the line ID (for example A3) for the experimenter only. The 20 lines are listed in `TEST_SCENARIOS.md`. Do not improvise or reword them.

**Card, frown version (conditions A and B), word for word:**

> **Pose:** Lower your eyebrows and pull them together, as if you were frowning or concentrating hard. Start at the nod and keep it until I say "thank you."
> **Say, once, exactly:** "<line>"

**Card, relaxed version (conditions C and D), word for word:**

> **Pose:** Keep your face relaxed and still, as if you were listening. Do not frown. Start at the nod and keep it until I say "thank you."
> **Say, once, exactly:** "<line>"

**Timing relative to Start trial** (the listening window runs from **Start trial** until 1.2 s of silence after speech, and never longer than 8 s):

| Time | Who | What |
|---|---|---|
| Before | Participant | Reads the card silently and says "ready." |
| Before | Experimenter | Says: "Look at the camera and relax your face. When I press the button I will nod. At the nod, do what the card says." Checks the participant's face is relaxed. |
| 0 s | Experimenter | Presses **Start trial**, nods once, then stays completely silent. |
| 0 to 3 s | Participant | Starts the pose at the nod. Starts the line within 3 s of the nod. |
| about 3 to 6 s | Participant | Says the line once at a natural pace, then stops talking and holds the pose, silent, until the experimenter says "thank you." |
| End | Experimenter | Marks the trial valid or invalid on the paper sheet (below), then reads the trial report, then says "thank you." |

The latest the line may start is 3 s after the nod. A line of 5 to 8 words takes about 2 to 3 s and then 1.2 s of silence closes the window, so the window ends at about 7 s at the latest, under the 8 s cap. The report's **Capture window** and **Window ended by** fields show whether a trial stayed inside this margin; a window that ends by the time limit while the participant was still speaking means the line started too late or ran too long. The recognizer starts listening at **Start trial** and is assumed to ignore speech before it; check this with a practice trial, and if it does not hold, use a visual cue only and no spoken countdown.

**What counts as a proper performance.** The experimenter judges this by eye and ear **during the trial and before reading the trial report**, and writes the verdict on the paper sheet at once. The AU4 value is never used to judge it.

- Frown pose (A, B) is proper if the eyebrows are visibly lowered and drawn toward each other (a visible furrow between the brows, or clearly lower than the relaxed face) from shortly after the nod until the line ends, with the face toward the camera and not covered. It is invalid if the brows are not visibly lowered, the frown is released before the line ends, the face is turned away or covered.
- Relaxed pose (C, D) is proper if there is no visible brow lowering or furrow at any time in the trial. It is invalid if the participant frowns or furrows visibly, even briefly.
- The line is proper if it is said once, in the card's words with nothing added or dropped, at a natural pace and volume, clearly audible and intelligible to the experimenter in the room, and begun within 3 s of the nod. It is invalid if the wording differs, it is restarted, whispered or mumbled, said before the nod or later than 3 s after it, or interrupted by laughter or by outside noise.
- A line that the experimenter understood clearly but that speech-to-text mishears is a **proper** performance and counts (it is a pipeline error, not a user mistake). The report's transcript shows what was heard, so a mishearing is visible and is noted.

## 5. Steps

- The dry runs are finished (they used **Capture AU** to learn the AU scale and set the threshold, and it is now commented out). They were recorded on a separate dry-run tab, never on "3.2 Check-in", and never count. **Start trial** is the only button in the baseline.
- Each participant does one set: one trial per condition A, B, C and D (four counted trials).
- Each participant gets one randomly assigned order of the four conditions, assigned offline by hand (no code), and one line per condition. Record the order in Notes. The assignment for P01 to P05 is in the table below. It uses a balanced rotation for the first four participants (each condition appears once in each position) and a random draw for P05, and it uses each of the 20 lines exactly once. From P06 on, restart the line rotation (P06 uses P01's lines) with a freshly drawn order.

| Participant | Order of conditions | Lines (same order) |
|---|---|---|
| P01 | A, B, D, C | A1, B2, D4, C3 |
| P02 | B, C, A, D | B3, C4, A2, D5 |
| P03 | C, D, B, A | C5, D1, B4, A3 |
| P04 | D, A, C, B | D2, A4, C1, B5 |
| P05 | C, A, D, B | C2, A5, D3, B1 |

- Before the run, write down the condition and `Should fire?` (yes for A only). After the run, read the trial report (section 6).
- Between trials, the participant relaxes their face for about 5 seconds before the next card is handed over, so that no frown carries into the next trial.
- **Invalid performance:** retry with the **same card**. At most 2 retries per card. If the third attempt is also invalid, log it as invalid, stop that condition for that participant, and note it. Every attempt gets its own row.
- The conditions must be tested equally.

## 6. Record and score

Outcome labels:

| Should fire? | Fired? | Statistic | Template label |
|---|---|---|---|
| yes | yes | TP | correct trigger |
| no | yes | FP | false trigger |
| yes | no | FN | missed |
| no | no | TN | correct no-fire |

### Reading the trial report

After every trial the panel shows the trial report (and the browser console logs it as `[trial_report]`; see README, Trial report). The experimenter reads it **after** marking the performance valid or invalid. It contains:

- **Transcript** of what speech-to-text heard (with a note if nothing usable was heard);
- **Capture window** in ms (limit 8000) and **Window ended by**: silence after speech (1200 ms) or time limit reached (8000 ms);
- **Analyzer** and **samples** (the sample size: how many analyzer frames returned AU readings in the window);
- **AU values**: every AU the analyzer returns (OpenFace 3.0: AU1, 2, 4, 6, 9, 12, 25, 26), each with its peak and average on the 0–100 scale; `*` marks AU4 at or above the threshold;
- **AU4 threshold** and **AU4 peak used** (the value compared with the threshold);
- **Facial cue** (true/false), **Matched phrases**, **Verbal cue** (true/false), and the **Decision**: CHECK IN or DO NOT CHECK IN. `Fired?` is the decision.

A trial where no speech was heard still produces a report (transcript "none", Verbal cue false, ended by the time limit); the module does not check in, and it is logged as a valid or invalid attempt by the usual rules.

### Trial log columns

| Item | Column | Notes |
|---|---|---|
| Trial ID | A | |
| Date and time | B | |
| Version (module, date, commit) | C | |
| Participant ID | D | P01, P02, ... |
| Trigger condition | E | Dropdown, exactly one of: "A: both cues", "B: facial only", "C: verbal only", "D: neither". The legend is on the tab (K13:L17). |
| Should fire? | F | yes/no, assigned from the condition before the run |
| Fired? | G | yes/no, from the report's Decision |
| Outcome | H | formula, do not type |
| Notes | I | Line ID (for example A3); scenario order; exclusions with reasons; for an invalid performance, "invalid pose/line, not counted, retried" and which part failed; any mishearing seen in the transcript |
| Facial cues present (AUs) | N | AU4 peak used and whether it met the threshold, from the report (the metrics log also records the peak) |
| Verbal cue (VR-CoDES) | O | dropdown: concern, cue, none. The VR-CoDES category of the scripted line (design label), not what the trigger detected |

**Trial-report columns (added after column O, in this order).** These are additions to the v4 template; the workbook must be extended with them before trial 1, leaving the shaded formula cells untouched.

| Item | Source in the report |
|---|---|
| Transcript (as heard) | Transcript |
| Matched phrases | Matched phrases (`none` if empty) |
| Verbal cue detected (true/false) | Verbal cue |
| Facial cue detected (true/false) | Facial cue |
| Sample size | samples |
| Window length (ms) | Capture window |
| Window ended by | silence / time limit |
| AU4 threshold | AU4 threshold |
| Other AU peaks and averages | optional text paste of the AU values list |

**Invalid performance.** If the participant does not perform the pose (or the line) properly, the trial **does not count** and is retried.
- The experimenter judges this at the time of the trial, **before** reading the outcome, using the criteria in section 4.
- Log the invalid attempt as its own row with `Should fire?` and `Fired?` left blank (so the template's n and outcome formulas skip it) and Notes "invalid pose/line, not counted, retried". Never delete the row. The retry is a new row.
- **Counting rule (confirmed).** If the participant performs the pose and line as specified on the task card, the trial counts, whatever the system does. A misfire, a failure to fire, and a failure to capture (a missing or wrong AU reading, a missing or misheard transcript) are results, not exclusions: record Fired? as what the module actually did (a no-fire is "no"). Only an invalid performance is left blank.

**Descriptive statistics** (no significance tests). Report n overall **and per condition**, as counts, "k of n" and rates:
- n, and TP, FP, FN, TN.
- Accuracy = (TP + TN) / n. Report it next to the counts: with 15 of 20 trials negative, "never fire" already scores 75%.
- Precision = TP / (TP + FP).
- Recall = TP / (TP + FN).
- F1 = 2 · precision · recall / (precision + recall).
- The v4 workbook computes all of them on "3.2 Check-in" (K3:L11): n, TP, FP, FN, TN, precision, recall, F1 and accuracy.
- Per condition (tab "Summary", section 1): n counted, fired, not fired, fire rate and correct rate for A, B, C and D, plus a check that the conditions were tested equally. The fire rate of A is recall; the fire rate of B, C and D is the false-trigger rate.
- Per participant (tab "Summary", section 2): score = (correct triggers + correct no-fires) ÷ counted trials for that participant; report the mean, median and range (min–max) of these scores across participants, with the number of participants. A participant's score takes only the values 0, .25, .5, .75 and 1.
- Excluded and invalid attempts are not in n; their reasons are in Notes.
- The positive class is the moment when the check-in should fire (condition A).

## 7. End

Save the trial log, thank the participant, and give a one-line debrief: "Thank you. The sentences were scripted, and we were testing whether the system responds correctly to what you did and said, not you."

## 8. If it fails

- **Crash or module failure (no decision or report shown):** log the failure and repeat once. See Open decisions, item 1, for how a crash is counted.
- **Invalid performance:** follow the rule above.
- Never drop a trial silently. If the code, threshold, window or keywords change, record a new version and restart the counted trials.

## Limitations

- The expected labels are design labels from the condition; they are not independent judgments of whether a check-in would feel appropriate. In condition C a person may reasonably want a check-in despite a neutral face.
- The facial expressions are posed on request, not spontaneous, and the experimenter judges the pose by eye. AU4 values from a posed frown may differ from those of a natural one.
- The threshold comes from a small number of dry runs and is not formally calibrated. Negation and paraphrases are not handled by the keyword list.
- The lines were chosen to match the keyword vocabulary, so these trials are a controlled functionality test, not a test of general-language understanding.
- The trial report's AU values are a record for annotation. The decision uses only the AU4 peak; the report's AU4 row can differ slightly from the "AU4 peak used" because they come from two collectors.
- Confirm with the instructor that live posing in eEVA is acceptable.

## Open decisions for the team

1. **Module crashes.** A crash that shows no decision is not covered by the counting rule. Option 1: leave `Should fire?` and `Fired?` blank, note "module error", repeat once (excludes it from n, which can flatter recall). Option 2: count it as a missed trigger. Either way, report the number of crashes separately.
2. False-trigger rate: keep or drop? The "Summary" tab already reports it per condition (fire rate for B, C and D); the team still decides whether to report it as its own metric.

Resolved: emotion is no longer captured (the emotion and Match columns were removed from the trial log). The verbal-cue column is the scripted line's VR-CoDES category. A set is one trial per condition A–D. Every A and C line contains a phrase from the frozen `distressPhrases` list in `trigger.js`, and no B or D line does (checked by hand against the list).
