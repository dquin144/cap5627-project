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
| `strategies` | The proposal's four VR-CoDES-P check-in strategies: `explicit_provides_space`, `explicit_reduces_space`, `nonexplicit_provides_space`, `nonexplicit_reduces_space`, plus the earlier `tentative_uncertainty` (see below). | The only values `strategy` may take. The sentence for each is defined by the platform's `createCheckInStrategy`, not in this repo. The four VR-CoDES-P identifiers are my naming; if the platform uses different ones, change them here. |
| `strategy` | Which of the four strategies this run uses, passed to `createCheckInStrategy`. | Set per experimental condition. `nonexplicit_provides_space` is a placeholder default, not a research decision. |
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
- On every start `main.js` checks the platform functions it calls (webcam, analyzer, `wait`, `AudioToText`, `createCheckInStrategy`, `agent.speak`, metrics, overlay), prints the helper and context names, and lists any missing ones in the console and on the preview line. A missing metrics logger falls back to the console and a missing overlay to adding the panel to the page.
- Status: runs on sage.cs.fiu.edu. The camera preview, panel, buttons and speech capture work. A full triggered check-in (spoken strategy sentence, then Pause / Continue) and the logged AU values have not yet been confirmed.

### Open items before counted eEVA trials

1. **Strategy names.** At startup the console reports which of the `strategies` names `createCheckInStrategy` accepts. If any are rejected, rename them in `config.json` to the identifiers the platform uses.
2. **AU scale.** The scale of the analyzer's AU values is not documented. Compare the logged peak AU values against the threshold of 45 (it may be 0–1) before trusting decisions.
3. **Peak vs. binary.** Peak-over-listening-window biases toward firing and differs from binary-mode observation. Do not merge eEVA and offline datasets.
4. **Analyzer.** Pyfeat (eEVA) vs. OpenFace 3.0 (planned); see Research rationale.

## Why `tentative_uncertainty` is kept

It is not one of the four VR-CoDES-P strategies; it is the label from an earlier design iteration (a tentative, uncertain check-in). `CONFIG.checkInStrategy` in `trigger.js` and `trigger-core.js` still uses it. It only labels the demo output and does not affect any decision, and those files are frozen for the counted baseline, so it was left unchanged. It is listed in `config.json` so the name there matches the frozen files. Whether `createCheckInStrategy` accepts it is confirmed by the startup console report. Do not use it as an experimental condition unless the proposal says so.
