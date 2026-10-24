# CAP 5627 Team 3.2: Context-Aware Empathic Check-In (eEVA)

When a participant's face shows a tension pattern (AU4 brow lowerer and/or AU7 lid tightener) **and** they voice a concern, the agent checks in. The trigger is a transparent rule: `shouldTrigger = facialCue AND verbalCue`.

## Files

| File | Purpose |
|---|---|
| `trigger.js` (v0.3) | **Frozen** decision logic and CLI. This is the counted offline-baseline artifact. Do not edit during counted trials. |
| `trigger-core.js` | Browser-safe decision logic: a **verbatim copy** of `trigger.js` sections 1-5 with no Node requires. eEVA cannot load `trigger.js` itself ("Project file not found: node:readline/promises"). If the keyword list or rule changes, change both files. |
| `main.js` | eEVA **Project Studio** entry (`src/main.js`): CommonJS `module.exports.run(context)` / `module.exports.stop(context)`, which is what the project checker requires. Needs `trigger-core.js` and `config.json` beside it in `src/`. `trigger.js` does not need to be uploaded. |
| `config.json`, `project.json` | Settings and project entry for `main.js`. Deployed as `src/main.js`, `src/config.json`, `src/trigger.js`; `project.json` keeps `"entry": "src/main.js"`. Its `helperGroups` gained `helpers.biofeedback.getTopAUs`, `helpers.webcam.start`, `helpers.wait` and `AudioToText` (names follow the existing entries' pattern; **unverified**, remove any the platform rejects). |
| `archive/my-modules/main.module.js` | Single-file **My Modules** version in the guide's `export async function start` / `export function stop` form (trigger logic inlined). Use only in a My Modules activity; it fails the Project Studio checker. |
| `AU_SELECTION_RATIONALE (1).md` | Why AU4/AU7. |
| `BASELINE_PROTOCOL (1).md`, `TRIAL_PROCEDURE (1).md`, `TEST_SCENARIOS.md` | Offline baseline protocol, per-trial procedure, scenarios. |
| `archive/v1.1-live-integration/` | Earlier unused live-integration draft (different API and trigger). Kept for reference only. |

## Offline baseline (`trigger.js`)

```bash
node trigger.js                # simulated demo, NOT baseline data
node trigger.js --interactive  # numeric AU entry (0-100)
node trigger.js --binary       # manual yes/no AU4-like / AU7-like observation (counted baseline)
```

- Facial cue: AU4 or AU7 ≥ `auThreshold` 45 (numeric mode), or a human-marked yes (binary mode). The threshold is provisional and uncalibrated.
- Verbal cue: whole-phrase match against the frozen `distressPhrases` list. Negation is **not** handled ("I'm not stressed" still matches).
- Any code change means a new version and restarted counted trials. Record the commit hash for every trial.

## eEVA module (`main.js`)

Flow: start camera (`helpers.webcam.start`) and recognizer (`AudioToText`) → chained `helpers.biofeedback.analyzeVideo` loop tracks **peak** AU4/AU7 → experimenter clicks **Start trial** → `listenOnce()` captures the line → `evaluateCheckIn({aus: peak, transcript})` → if it fires, the strategy's utterance is spoken (`createCheckInStrategy` + `context.agent.speak`). **Pause** / **Continue** then answer that check-in via `strategy.handleUserResponse`.

- `metrics` logs the decision, cue flags, matched phrases, peak AU4/AU7 and the threshold. The raw sentence is not logged.
- **Check In** is a manual override that bypasses the gate. It is logged as `trigger_source=manual`. Do not use it during counted trials.
- Status: verified only against a mock runtime, not yet run on sage.cs.fiu.edu.

### Open items before counted eEVA trials

Checked against the eEVA Student Module Guide: the webcam (`camera.video`, `camera.stop()`), `AudioToText`, `listenOnce`, `analyzeVideo`, `getTopAUs` and the chained analysis loop match the documented signatures. Still unverified:

1. **Where it runs.** The Project Studio checker for `src/main.js` rejects the guide's `export` form ("Unexpected token 'export'") and asks for `module.exports.run(context)`, so `main.js` uses that. The guide's `start`/`stop` form belongs to My Modules (see `archive/my-modules/`). Still unverified in `run(context)`: that `AudioToText` and `context.helpers.webcam/biofeedback` exist, and that `createCheckInStrategy` accepts `config.strategy`. The first run prints `Object.keys(context.helpers)` and `Object.keys(context)` to the console.
2. **AU scale.** The guide does not say what scale `analyzeVideo` returns. Compare the logged peak AU values against the threshold of 45 (it may be 0–1) before trusting decisions.
3. Peak-over-listening-window biases toward firing and differs from binary-mode observation. Do not merge eEVA and offline datasets.
4. Confirm `config.strategy` is a name `createCheckInStrategy` accepts, and reconcile it with the revised proposal's four VR-CoDES-P strategies.
5. Pyfeat (eEVA, instructor-selected) vs. OpenFace 3.0 (planned): decide which the written project describes.
