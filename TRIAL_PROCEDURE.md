# Team 3.2 — Quick Trial Procedure

Summary of `BASELINE_PROTOCOL.md` for the day of the trials. The baseline runs on eEVA with OpenFace 3.0 and speech-to-text. An experimenter presses **Start trial** and annotates each trial. Items in **[TO BE SUPPLIED]** are team decisions that are still open.

1. **Before class:** Complete the freeze (README, Freeze procedure) and note the module, date, commit hash, analyzer, `auThreshold`, peak window, keyword list and fixed `strategy`. Open the Team 3.2 trial log tab. Have the task cards for conditions A–D ready: **[TO BE SUPPLIED]**. Each participant's scenario set was assigned offline by hand.
2. **Dry runs:** Run the team through a few trials and use **Capture AU** to check the AU values. Mark them "dry run" in Notes; they never count. After the freeze, Capture AU is commented out.
3. **For each trial:** Assign the participant ID → ask consent (participation, and separately webcam and microphone processing) → read the instructions **[TO BE SUPPLIED]** → give the task card → write down the condition and `Should fire?` → press **Start trial** → the participant performs the card → read the decision → record the row.
4. **Log:** Trial ID, date and time, version, participant ID, condition, `Should fire?`, `Fired?`, and Notes (scenario order, dry run, exclusions with reasons). The outcome column is a formula. Add facial cues, verbal cue and self-reported emotion as the protocol specifies.
5. **Invalid performance:** If the pose or line is not performed properly, judged before reading the outcome, log it as its own row with `Should fire?` and `Fired?` blank, Notes "invalid pose/line, not counted, retried", and retry. If the module crashes, log it and repeat once. Never delete a row.
6. **After:** Check that the conditions were tested equally. Compute n overall and per condition, TP/FP/FN/TN, accuracy, precision, recall and F1, then report setup, limitations and findings on the baseline slide (slides due Oct 26, presented Oct 27, complete baseline due Nov 9). State that the facial cue is AU4 alone and why AU7 was dropped (OpenFace 3.0 does not support it; PyFeat's AU7 readings were too noisy).

**Reminders:** Dry runs do not count. Do not change the keyword list, threshold, window or code during counted trials; any change means a new version and a restart.
