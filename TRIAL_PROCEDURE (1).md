# Team 3.2 — Quick Trial Procedure

**Reason for fallback:** Because eEVA is down and automatic AU detection is not implemented, we will use `trigger.js` with manually observed facial cues and typed verbal input. **The instructor specifically requested recorded posed expressions and lines**; use recordings with consent unless she authorizes live-only observations.

1. **Before class:** Freeze `trigger.js` on GitHub; note commit and trigger settings. Open the Team 3.2 Excel tab. Prepare **5 pre-labeled scenarios each** for A (both cues), B (facial only), C (verbal only), D (neither) = **20 trials total**. Agree on labels *before* testing. If an external observer is unsure of a cue, mark uncertainty rather than guessing.
2. **Pilot:** Run 1–2 team dry runs; mark them **DRY RUN**; exclude from baseline counts.
3. **For each trial:** Assign participant ID → obtain consent → give the expression + line → record if consented / approved → note observed AU4-like and AU7-like movements → run `node trigger.js --binary` → enter spoken line and yes/no observations → record output.
4. **Log:** Trial ID, time, Git commit, participant ID, condition, preassigned `Should fire?`, program `Fired?`, and notes (including whether observations were live or recorded, any uncertain cues/failures). The Excel template calculates outcomes and precision/recall.
5. **After:** Check totals (≥5 per condition), compute TP/FP/FN/TN, precision, recall, F1 and false-trigger rate, then report setup, limitations and findings on the Oct 27 baseline slide (slides due Oct 26).

**Mode reminder:** `node trigger.js` = simulated demo; `--interactive` = numeric demonstration; `--binary` = manual observation. **Dummy runs do not count.** Do not change the keyword list during the measured baseline.
