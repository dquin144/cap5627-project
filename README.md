# CAP 5627 Team 3.2: Context-Aware Empathic Check-In (eEVA)

When a participant's face shows a tension pattern (AU4 brow lowerer and/or AU7 lid tightener) **and** they voice a concern, the agent checks in. The trigger is a transparent rule: `shouldTrigger = facialCue AND verbalCue`.

## Research rationale

- **Why AU4 and AU7.** Simple, observable candidate cues: AU4 is a brow-lowering movement that may accompany frowning, concern or concentration; AU7 is a tightening around the eyelids that can accompany tension or concentration. They are **not** reliable stand-alone indicators of sadness, stress or distress, and their meaning depends on context. Details: `AU_SELECTION_RATIONALE.md`.
- **Why both a facial and a verbal cue.** Because no single facial movement proves an emotion, the rule requires a verbal expression of concern as well. Gentsch et al. (2015) relate facial muscle activity to emotional appraisal while cautioning against treating any single movement as proof of emotion. Zimmermann et al. (2011), the VR-CoDES system, concerns verbal expressions of concern. These sources support **combining** facial behavior and verbal context; they do **not** validate AU4/AU7 as distress markers or determine the numeric threshold.
- **Current design (proposal, latest revision).** Rule-based trigger (facial cue AND verbal cue); PETS questionnaire; check-in wording reworked into four VR-CoDES-P-based strategies, evaluated with scripted video vignettes instead of a live study. Earlier iterations (four response styles, then five strategies without a "no check-in" condition) are kept only for traceability.
- **Baseline scope.** The offline baseline tests the **decision rule**, not the accuracy of face or speech recognition. Its expected labels are design labels for the AND rule, not independent judgments of whether a check-in would feel appropriate.
- **Facial analyzer.** The eEVA analyzer (instructor-selected, default `pyfeat`) is what runs today; the proposal plans OpenFace 3.0. Decide which the written project describes.

## Files

| File | Purpose |
|---|---|
| `trigger.js` (v0.3) | **Frozen** decision logic and command-line modes. This is the counted offline-baseline artifact. Do not edit its code during counted trials. |
| `trigger-core.js` | Browser-safe decision logic: a **verbatim copy** of `trigger.js` sections 1-5 with no Node requires. eEVA cannot load `trigger.js` itself ("Project file not found: node:readline/promises"). If the keyword list or rule changes, change both files. |
| `main.js` | eEVA **Project Studio** entry (`src/main.js`): CommonJS `module.exports.run(context)` / `module.exports.stop(context)`, which is what the project checker requires (it rejects `export` with "Unexpected token 'export'"). Needs `trigger-core.js` and `config.json` beside it in `src/`. `trigger.js` does not need to be uploaded. |
| `config.json` | Settings read by `main.js`. See [config.json settings](#configjson-settings). |
| `project.json` | Project entry (`"entry": "src/main.js"`, `browser-js` runtime). Its `helperGroups` gained `helpers.biofeedback.getTopAUs`, `helpers.webcam.start`, `helpers.wait` and `AudioToText`; the names follow the existing entries' pattern and are **unverified**, so remove any the platform rejects. |
| `AU_SELECTION_RATIONALE.md` | Why AU4/AU7. |
| `BASELINE_PROTOCOL.md`, `TRIAL_PROCEDURE.md`, `TEST_SCENARIOS.md` | Offline baseline protocol, per-trial procedure, scenarios. |
| `archive/` | Earlier drafts kept for reference only: `my-modules/main.module.js` (single-file My Modules form using `export start/stop`; fails the Project Studio checker) and `v1.1-live-integration/` (different API and trigger). |

## config.json settings

| Key | What it is | Notes |
|---|---|---|
| `strategy` | Name of the check-in wording strategy, passed to `createCheckInStrategy`. | `tentative_uncertainty` is copied from `trigger.js`. Which names the platform accepts is unconfirmed. Reconcile with the proposal's four VR-CoDES-P strategies. |
| `triggerSource` | Label passed to `getUtterance` describing what triggered the check-in. | Unknown whether `getUtterance` validates it. The real source (`facial+verbal` or `manual`) is recorded separately in the metrics log. |
| `sampleConfidence` | Confidence value passed to `getUtterance`. | A fixed placeholder (0.8), not measured from the face or speech. |
| `biofeedbackEngine` | Name of the facial analyzer. | Used only if the platform setting `biofeedbackEngine` is absent; if both are missing, `pyfeat` is used. |

## Offline baseline (`trigger.js`)

```bash
node trigger.js                # simulated demo, NOT baseline data
node trigger.js --interactive  # numeric AU entry (0-100)
node trigger.js --binary       # manual yes/no AU4-like / AU7-like observation (counted baseline)
```

- Facial cue: AU4 or AU7 ≥ `auThreshold` 45 (numeric mode), or a human-marked yes (binary mode). The threshold is provisional and uncalibrated.
- Verbal cue: whole-phrase match against the frozen `distressPhrases` list. Negation is **not** handled ("I'm not stressed" still matches), and paraphrases are missed.
- Any code change means a new version and restarted counted trials. Record the commit hash for every trial.

## eEVA module (`main.js`)

Flow: start camera (`helpers.webcam.start`) and recognizer (`AudioToText`) → chained `helpers.biofeedback.analyzeVideo` loop tracks **peak** AU4/AU7 → experimenter clicks **Start trial** → `listenOnce()` captures the line → `evaluateCheckIn({aus: peak, transcript})` → if it fires, the strategy's utterance is spoken (`createCheckInStrategy` + `context.agent.speak`). **Pause** / **Continue** then answer that check-in via `strategy.handleUserResponse`.

- `metrics` logs the decision, cue flags, matched phrases, peak AU4/AU7 and the threshold. The raw sentence is not logged.
- **Check In** is a manual override that bypasses the gate. It is logged as `trigger_source=manual`. Do not use it during counted trials.
- Status: verified only against a mock runtime, not yet confirmed working on sage.cs.fiu.edu.

### Open items before counted eEVA trials

1. **Platform helpers.** Unverified inside `run(context)`: that `AudioToText` and `context.helpers.webcam/biofeedback` exist, and that `createCheckInStrategy` accepts `config.strategy`. The first run prints `Object.keys(context.helpers)`, `Object.keys(context)` and the speech helper to the console.
2. **AU scale.** The scale of the analyzer's AU values is not documented. Compare the logged peak AU values against the threshold of 45 (it may be 0–1) before trusting decisions.
3. **Peak vs. binary.** Peak-over-listening-window biases toward firing and differs from binary-mode observation. Do not merge eEVA and offline datasets.
4. **Strategies.** Reconcile `config.strategy` with the proposal's four VR-CoDES-P strategies.
5. **Analyzer.** Pyfeat (eEVA) vs. OpenFace 3.0 (planned); see Research rationale.
6. **Microphone.** If speech is not picked up, the status line reports whether the browser blocked the mic, the recognizer returned nothing, or speech was heard without a usable transcript.
