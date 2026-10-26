# Team 3.2 — Baseline Protocol

**What this tests:** the **end-to-end trigger** on eEVA: OpenFace 3.0 peak AU4 against the threshold, speech-to-text followed by the phrase match, and the AND rule. Recognition errors are included, so a misheard line or a missed movement counts. The agent's check-in wording is not evaluated here. Participants are teammates and classmates. An experimenter presses **Start trial** and annotates each trial.

Items in **[TO BE SUPPLIED]** are decisions the team has not made yet. They are left visible on purpose and must be filled in with the exact wording before trial 1. Items marked **[Assumption]** are not confirmed.

**Facial cue:** AU4 (brow lowering) alone. AU7 was the proposal's second cue and was dropped: OpenFace 3.0 does not support it, and PyFeat's AU7 readings were too sensitive and noisy. See `AU_SELECTION_RATIONALE.md`. The slide must report this change.

**Conditions:** A both cues, B facial only, C verbal only, D neither. `Should fire?` is **yes for A** and **no for B, C and D**.

## 1. Setup

- eEVA project and module on sage.cs.fiu.edu, browser, webcam, microphone or headset, room and lighting.
- Version fields, recorded at the freeze (see README, Freeze procedure): version **v0.4** (shown on the panel at startup and written with every trial decision), eEVA project and module, date frozen, commit hash, analyzer (`openface3`), `auThreshold`, the peak/listening window, the keyword list, and the fixed `strategy` value.
- Keep the code, threshold, window and keyword list unchanged during counted trials.
- The Team 3.2 trial log (Excel tab "3.2 Check-in"). Do not edit the shaded formula cells.

## 2. Start

- Assign a participant ID: P01, P02, ... Never record names.
- Ask for consent to participate and, separately, for webcam and microphone processing. **No video or audio is kept** in the baseline.

## 3. Instructions (read aloud)

**[TO BE SUPPLIED by the team.]** Rule: never state the hypothesis or the expected outcome.

## 4. Tasks

**[TO BE SUPPLIED]** Task cards for conditions A–D: the pose, the line and the timing relative to **Start trial**, word for word. Do not improvise them. The criteria for a "proper" pose and line are defined together with the cards.

## 5. Steps

- Dry runs come first (they used **Capture AU** to learn the AU scale and set the threshold). Mark them "dry run" in Notes; they never count. The dry runs are finished and Capture AU is commented out; **Start trial** is the only button in the baseline.
- Each participant gets one randomly assigned set of scenarios, **assigned offline by hand** (no code). Record the order in Notes.
- The experimenter presses **Start trial**; the participant performs the card. Timing: **[TO BE SUPPLIED]**.
- Before the run, write down the condition and `Should fire?`. After the run, read the module's decision.
- The conditions must be tested equally.

## 6. Record and score

Outcome labels (defined before trial 1):

| Should fire? | Fired? | Statistic | Template label |
|---|---|---|---|
| yes | yes | TP | correct trigger |
| no | yes | FP | false trigger |
| yes | no | FN | missed |
| no | no | TN | correct no-fire |

Items recorded per trial (trial log columns):

| Item | Column | Notes |
|---|---|---|
| Trial ID | A | |
| Date and time | B | |
| Version (module, date, commit) | C | |
| Participant ID | D | P01, P02, ... |
| Trigger condition | E | In words, for example "A: both cues" |
| Should fire? | F | yes/no, assigned from the condition before the run |
| Fired? | G | yes/no |
| Outcome | H | formula, do not type |
| Notes | I | Scenario order, "dry run" for dry runs, exclusions with reasons |
| Facial cues present (AUs) | N | **[Assumption]** peak AU4 and whether it met the threshold, from the metrics log |
| Verbal cue (VR-CoDES) | O | dropdown: concern, cue, none |
| Self-reported emotion | Q | dropdown of 8 labels |
| Match (1 = yes) | R | formula; see the open decisions below |

**Invalid performance.** If the participant does not perform the pose (or the line) properly, the trial **does not count** and is retried.
- The experimenter judges this at the time of the trial, **before** reading the outcome, using the criteria defined with the task cards (pending).
- Log the invalid attempt as its own row with `Should fire?` and `Fired?` left blank (so the template's n and outcome formulas skip it) and Notes "invalid pose/line, not counted, retried". Never delete the row. The retry is a new row.
- **[Assumption]** A correctly spoken line that speech-to-text mishears is a pipeline error and counts (as a miss), not a user mistake.

**Descriptive statistics** (no significance tests). Report n overall **and per condition**, as counts, "k of n" and rates:
- n, and TP, FP, FN, TN.
- Accuracy = (TP + TN) / n. Report it next to the counts: with 15 of 20 trials negative, "never fire" already scores 75%.
- Precision = TP / (TP + FP).
- Recall = TP / (TP + FN).
- F1 = 2 · precision · recall / (precision + recall).
- The template computes precision and recall only. Add accuracy and F1 cells; do not type into shaded cells.
- Excluded and invalid attempts are not in n; their reasons are in Notes.
- The positive class is the moment when the check-in should fire (condition A).

## 7. End

Save the trial log, thank the participant, and give a one-line debrief.

## 8. If it fails

- **Crash or module failure:** log the failure and repeat once.
- **Invalid performance:** follow the rule above.
- Never drop a trial silently. If the code, threshold, window or keywords change, record a new version and restart the counted trials.

## Limitations

- The expected labels are design labels from the condition; they are not independent judgments of whether a check-in would feel appropriate. In condition C a person may reasonably want a check-in despite a neutral face.
- The threshold comes from a small number of dry runs and is not formally calibrated. Negation and paraphrases are not handled by the keyword list.
- Confirm with the instructor that live posing in eEVA is acceptable.

## Open decisions for the team

1. Match and emotions: the template's Match compares an analyzer-emotion column with self-reported emotion; that analyzer column is not in the recorded list, so Match will be blank. Add the column, or drop Match. Decide when and how self-reported emotion is asked.
2. The verbal cue column: the VR-CoDES category of the scripted line (design label), or what the trigger detected? Assumed: the scripted line's category.
3. A "set" of scenarios: assumed to be one trial per condition A–D per participant. Confirm.
4. ~~The version name for the frozen build.~~ Decided: **v0.4**.
5. False-trigger rate: keep or drop? The earlier documents reported it; the current list omits it.
