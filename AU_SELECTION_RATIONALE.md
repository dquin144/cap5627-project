# Why AU4? (and why AU7 was dropped)

## The facial cue: AU4

- **AU4 — brow lowerer:** A visible brow-lowering movement potentially associated with frowning, concern, or concentration.

We chose it as a **simple, observable candidate facial cue**, not a reliable stand-alone indicator of sadness, stress, or emotional distress. Its meaning depends on context. Our baseline therefore requires **a facial cue AND a verbal distress cue** before issuing a check-in. The baseline reads AU4 from OpenFace 3.0 on eEVA, which is **not formally validated FACS coding**. The numeric threshold of 45 (on the 0–100 scale the trial reads) comes from the dry-run readings and is not formally calibrated.

## AU7 was originally the second facial cue, and was dropped

- **AU7 — lid tightener:** A tightening around the eyelids that can accompany tension or concentration. The proposal's rule used AU4 **or** AU7 as the facial cue.

**What was tried (dry runs, 2026-10-25):**
- **PyFeat (first baseline analyzer).** AU7 was read, but the readings were **too sensitive and changed very rapidly**, so they were inaccurate and added noise. The person tested has rather small-looking eyes, and AU7 is an eyelid-tightening cue, so the resting eye shape may have affected the readings; this is an observation from one person, not a tested explanation. A per-user neutral calibration might help, but that decision is deferred until after the dry runs. In one capture PyFeat also returned only 3 readings in 8 seconds, against 20 for OpenFace, so a trial sees very few PyFeat frames.
- **OpenFace 3.0.** AU7 is **not supported**. In the dry-run capture, eEVA's `openface3` returned only 8 AUs: AU1, AU2, AU4, AU6, AU9, AU12, AU25 and AU26. AU7 was never returned, so it stays at 0 and cannot contribute.

**Decision:** OpenFace 3.0 is the baseline's analyzer (as the proposal named). AU7 was **dropped** as the second facial cue for two reasons:
1. OpenFace 3.0 does not support it.
2. The PyFeat AU7 readings were too sensitive and inaccurate, creating noise.

The facial cue is now AU4 alone. The code keeps the original `["4", "7"]` as a comment in `trigger.js`, and the baseline slide must report this change from the proposal.

## Research alignment

Our P1 proposal cites **Gentsch et al. (2015)** on relationships between facial muscle activity and emotional appraisal, while cautioning against treating any single movement as proof of emotion. It also cites **Zimmermann et al. (2011)** (VR-CoDES) for verbal expressions of concern. Those sources support combining facial behavior and verbal context; **they do not establish AU4 (or AU7) as validated distress markers or determine our threshold**.

**Status:** The Capture AU dry runs with OpenFace 3.0 are finished and the tool is commented out for the baseline. Revise the cue selection based on the baseline data and feedback.
