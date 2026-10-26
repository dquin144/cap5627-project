# CAP 5627 Team 3.2: Context-Aware Empathic Check-In (eEVA)

When a participant's face shows a brow-lowering movement (AU4) **and** they voice a concern, the agent checks in. The trigger is a transparent rule: `shouldTrigger = facialCue AND verbalCue`.

## Research rationale

- **Why AU4.** A simple, observable candidate cue: AU4 is a brow-lowering movement that may accompany frowning, concern or concentration. It is **not** a reliable stand-alone indicator of sadness, stress or distress, and its meaning depends on context. Details: `AU_SELECTION_RATIONALE.md`.
- **AU7 was dropped as the second facial cue.** The proposal's facial cue was AU4 or AU7 (AU7 is the lid tightener). AU7 was tried with PyFeat, whose readings were **too sensitive and changed very rapidly**, so they were inaccurate and added noise (the person tested has rather small-looking eyes, which may have affected an eyelid-tightening reading). OpenFace 3.0 does **not support** AU7: in the dry-run capture, eEVA's `openface3` returned only AU1, 2, 4, 6, 9, 12, 25 and 26. The facial cue is therefore AU4 alone. Full account: `AU_SELECTION_RATIONALE.md`. The baseline slide must report this change from the proposal.
- **Why both a facial and a verbal cue.** Because no single facial movement proves an emotion, the rule requires a verbal expression of concern as well. Gentsch et al. (2015) relate facial muscle activity to emotional appraisal while cautioning against treating any single movement as proof of emotion. Zimmermann et al. (2011), the VR-CoDES system, concerns verbal expressions of concern. These sources support **combining** facial behavior and verbal context; they do **not** validate AU4 as a distress marker or determine the numeric threshold.
- **Current design (proposal, latest revision).** Rule-based trigger (facial cue AND verbal cue); PETS questionnaire; check-in wording reworked into four VR-CoDES-P-based strategies, evaluated with scripted video vignettes instead of a live study. Earlier iterations (four response styles, then five strategies without a "no check-in" condition) are kept only for traceability.
- **Baseline scope.** The baseline tests the **end-to-end trigger** on eEVA: OpenFace 3.0 peak AU4 against the threshold, speech-to-text followed by the phrase match, and the AND rule. Recognition errors (a missed facial movement, a misheard word) are therefore part of what is measured. The expected labels (should the check-in fire?) are **design labels** taken from the trial's condition, not independent judgments of whether a check-in would feel appropriate.
- **Facial analyzer.** The baseline uses **OpenFace 3.0** (`openface3` on eEVA), as the proposal names. PyFeat, eEVA's other analyzer, was tried first and set aside: its AU7 readings were too noisy, and it returned very few readings per second in the dry runs (3 in 8 seconds, against 20 for OpenFace). Switching analyzers is the single `biofeedbackEngine` value in `config.json`.

## Study phases

1. **Baseline (now).** Runs on eEVA with OpenFace 3.0 and speech-to-text. Participants are teammates and classmates. An experimenter presses **Start trial** and annotates each result by hand. This tests only whether the cues fire the check-in when they should. Each participant gets one randomly assigned set of scenarios, assigned offline by hand; there is no randomization or counterbalancing in code.
2. **Later phases (deferred, not built).** Do not build or stub these yet:
   - a scripted dialogue between the agent and a social actor, with the agent firing automatically each time with a new strategy (randomized strategy order and its schedule log belong here);
   - video captures of scenarios;
   - interactive conversations that gather context (more than one ongoing dialogue);
   - a context-driven check-in.
3. **Participant phase (after that).** Participants watch the pre-recorded scenarios and answer the PETS questionnaire (how they would have felt in a similar circumstance), plus more specific helpfulness and engagement questions. This is where participant feedback is gathered.

## Files

| File | Purpose |
|---|---|
| `main.js` | eEVA **Project Studio** entry (`src/main.js`): CommonJS `module.exports.run(context)` / `module.exports.stop(context)`, which is what the project checker requires (it rejects `export` with "Unexpected token 'export'"). Needs `trigger.js` and `config.json` beside it in `src/`. The panel has one button, **Start trial**. The dry-run-only **Capture AU** tool, marked `DRY-RUN TOOL START` / `END`, is commented out now that the dry runs are finished (kept, not deleted). |
| `trigger.js` | The decision logic: the rule, the distress phrase list and the AU threshold. Browser-safe (no Node requires), loaded by `main.js`. Frozen at the baseline freeze. |
| `config.json` | Settings read by `main.js`. See [config.json settings](#configjson-settings). |
| `project.json` | Project entry (`"entry": "src/main.js"`, `browser-js` runtime). Its `helperGroups` gained `helpers.biofeedback.getTopAUs`, `helpers.webcam.start`, `helpers.wait` and `AudioToText`; the names follow the existing entries' pattern and are **unverified**, so remove any the platform rejects. |
| `AU_SELECTION_RATIONALE.md` | Why AU4, and the history of AU7 (tried with PyFeat, dropped). |
| `BASELINE_PROTOCOL.md`, `TRIAL_PROCEDURE.md`, `TEST_SCENARIOS.md` | Baseline protocol (the instructor's eight sections), per-trial procedure, and the scenario conditions. |

The earlier offline fallback (the command-line trigger v0.3 with its demo, numeric and binary modes, plus the offline baseline documents) is the commit `ab2cded` published by dquin144 ("added few more keywords"). The later drafts that were removed are in the branch history before this change.

## config.json settings

| Key | What it is | Notes |
|---|---|---|
| `strategies` | The proposal's four VR-CoDES-P check-in strategies: `explicit_provides_space`, `explicit_reduces_space`, `nonexplicit_provides_space`, `nonexplicit_reduces_space`. | The only values `strategy` may take. The sentence for each is defined by the platform's `createCheckInStrategy`, not in this repo. The four identifiers are my naming; if the platform uses different ones, change them here. |
| `strategy` | Which of the four strategies this run uses, passed to `createCheckInStrategy`. | Fixed for the baseline and recorded at the freeze. `nonexplicit_provides_space` is a placeholder default, not a research decision. |
| `triggerSource` | Label passed to `getUtterance` describing what triggered the check-in. | Unknown whether `getUtterance` validates it. The real source (`facial+verbal`) is recorded separately in the metrics log. |
| `sampleConfidence` | Confidence value passed to `getUtterance`. | A fixed placeholder (0.8), not measured from the face or speech. |
| `biofeedbackEngine` | Name of the facial analyzer: `pyfeat` or `openface3`. Switching analyzers is only this one value. | `openface3` is the baseline analyzer. It is used only if the platform setting `biofeedbackEngine` is absent (the platform setting wins); if both are missing, `openface3` is used. The Capture AU display (commented out at the baseline freeze) showed which engine was actually in use. `pyfeat` was tried first and set aside (see Research rationale). |

## Decision rule (`trigger.js`)

- Facial cue: AU4 peak ≥ `auThreshold` (45, on the 0–100 scale the trial reads). The threshold was to be set from the Capture AU dry runs, which are now finished. AU7 is no longer watched (see Research rationale); the original `["4", "7"]` is kept as a comment in `trigger.js`.
- Verbal cue: whole-phrase match against the frozen `distressPhrases` list. Negation is **not** handled ("I'm not stressed" still matches), and paraphrases are missed. The team will address this separately.
- Check in only when both cues are present.

## Freeze procedure

Done by the team, in this order: dry runs → decide the threshold and whether a per-user neutral calibration is needed → set the values → comment out the Capture AU block → bump the version string → commit and record the hash → counted trials. **Status:** the frozen baseline is **v0.4** (`VERSION` in `main.js`, continuing from the offline v0.3). The dry runs are finished, the Capture AU block is commented out and **Start trial** is the official trial button; the remaining steps (commit hash, counted trials) are still to do. Record at the freeze: eEVA project and module, date frozen, commit hash, analyzer (`openface3`), `auThreshold`, the peak/listening window, the keyword list, and the fixed `strategy` value. After the freeze, **any** change (code, threshold, window, keywords) means a new version and a restart of the counted trials.

## eEVA module (`main.js`)

Flow: start camera (`helpers.webcam.start`) and recognizer (`AudioToText`) → chained `helpers.biofeedback.analyzeVideo` loop tracks the **peak** AU4 → experimenter clicks **Start trial** → `listenOnce()` captures the line → `evaluateCheckIn({aus: peak, transcript})` → if it fires, the strategy's utterance is spoken (`createCheckInStrategy` + `context.agent.speak`).
- `metrics` logs the version (`v0.4`), the decision, cue flags, matched phrases, the peak of each watched AU (AU4) and the threshold. The raw sentence is not logged.
- **Peak window.** A trial's peak runs from Start trial until the speech ends (1.2 s of silence), and never longer than `LISTEN_MAX_WAIT_MS` (8000 ms).
- **Strategy check.** The check that a strategy is usable (`createStrategy()` in `main.js`) requires only `getUtterance`, the method that produces the check-in sentence.
- **Buttons.**
  - **Start trial** is the official baseline button and runs one trial. It stays disabled from the start of the trial until the dialogue has finished: after the agent finishes speaking if the check-in fired, or when the decision is displayed if it did not. It is always re-enabled, including after an error. (Its earlier label was "Start trial (listen + read face)", kept as a comment in `main.js`.)
  - **Capture AU (dry run)** is **commented out** now that the dry runs are finished; it is not part of the frozen baseline. The description below is kept for when it is restored. While it was active, Start trial also disabled it during a trial. It collects AU readings for one capture window (the same 8000 ms as the longest trial window), using the trial's own peak tracking, with no speech recognition, no agent speech and no check-in. It displays **every AU the analyzer returns**, each with its peak and mean over the window, one AU per line, for example `AU4: 61 Peak, 20 Avg`, under a header line with the window, the analyzer name, the threshold and the sample count. It shows one row per AU on the 0–100 scale the trial uses (values from `getTopAUs`; labels such as `AU1` and `AU01` are merged into one), and also reads the analyzer's raw result so AUs that `getTopAUs` leaves out still appear. It logs the first raw result to the console so its real shape can be inspected. OpenFace 3.0 returns only AU1, 2, 4, 6, 9, 12, 25 and 26. A `*` marks AU4 when its peak is at or above the threshold, and a watched AU the analyzer never returned is listed as "not returned". The numbers are never trial data and are not written to the metrics log. The block is commented out at the freeze, not deleted.
- **Startup checks.** On every start `main.js` checks the platform functions it calls (webcam, analyzer, `wait`, `AudioToText`, `createCheckInStrategy`, `agent.speak`, metrics, overlay), prints the helper and context names, and lists any missing ones in the console and on the preview line. A missing metrics logger falls back to the console and a missing overlay to adding the panel to the page. A missing camera, analyzer or `createCheckInStrategy` still stops the affected step, with a message naming it.
- Status: confirmed running on sage.cs.fiu.edu with **Start trial** working as intended. The dry runs are finished and **Capture AU** is commented out.

### Open items before counted eEVA trials

1. **Strategy names.** At startup the console reports which of the four `strategies` names `createCheckInStrategy` accepts. If any are rejected, rename them in `config.json` to the identifiers the platform uses.
2. **Threshold.** The values the trial reads are on a 0–100 scale. The Capture AU dry runs are finished; record the `auThreshold` they support (currently 45) and the per-user neutral calibration decision at the freeze.
3. **Task cards and instructions.** The word-for-word task cards (pose, line, timing relative to Start trial), the participant instructions and the "proper pose" criteria must exist before trial 1. See `BASELINE_PROTOCOL.md`.
4. **Report the change from the proposal.** The baseline slide must say that AU7 was dropped as the second facial cue (OpenFace 3.0 does not support it, and PyFeat's AU7 readings were too noisy), so the facial cue is AU4 alone.
