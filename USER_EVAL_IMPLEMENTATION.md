# v0.5 Evaluation Build — Implementation, Deployment and Smoke Test

**Branch:** `feature/user-eval-llm-v0.5` · **Version string:** `v0.5` · **Frozen baseline:** `v0.4` (local tag `v0.4-baseline-frozen` → commit `989907e`; branches `baseline-v0.4`, `baseline-v0.4-with-outputs`).

v0.5 exists to record the four strategy vignettes for the user evaluation. It is a **separate build**: its output must not be pooled with, or compared as equivalent to, the v0.4 baseline trials.

## 1. What changed and what did not

| Unchanged (frozen v0.4) | New in v0.5 |
|---|---|
| `trigger.js`: AU4 threshold 45 (0–100), `facialAUs: ["4"]`, phrase list, `evaluateCheckIn`. A test fails if it differs from the tag. | `strategies.js`: the four VR-CoDES-P strategies, generation prompt, strategy validator, template lines |
| `config.json` (also guarded by a test) | `llmAdapter.js`: wrapper around the platform LLM helper (timeout, response-shape handling, no keys) |
| `BASELINE_PROTOCOL.md`, `TRIAL_PROCEDURE.md`, `TEST_SCENARIOS.md`, `AU_SELECTION_RATIONALE.md` | `verbalClassifier.js`: LLM verbal-concern classifier with keyword fallback |
| The AND gate: `shouldTrigger = facialCue && verbalCue` | `checkinPipeline.js`: one scenario from inputs to the spoken line, platform access injected |
| Webcam, AU peak tracking, `listenOnce`, AU recorder (copied unchanged into v0.5 `main.js`) | `main.js` (v0.5): operator panel, input modes, approvals, recording view, export, diagnostics |
| | `eval_config.json`, `tests/`, `package.json`, this file, `VIGNETTE_RECORDING_PLAN.md` |

`project.json` gained one entry, `helpers.llm.generate`, following the existing unverified naming pattern (see section 4).

## 2. How a scenario runs

1. **Capture**, by input mode:
   - **LIVE**: camera AU4 peak plus speech-to-text, exactly as in v0.4 (`listenOnce`, 1.2 s silence / 8 s cap).
   - **LIVE FACE + TYPED TEXT**: camera AU4 peak over a fixed window (`typedCaptureMs`, 5 s); the transcript is the text box. This is the fallback when speech-to-text fails on a machine.
   - **SIMULATED DEMO**: AU4 = the synthetic value (default 70) and the transcript = the text box, after a fixed stimulus pause (`simulatedStimulusMs`, 3 s). The camera and microphone are switched **off** in this mode, so a live preview never appears next to synthetic numbers. Every report, log record and metric says `simulated=true`.
2. **Facial cue**: `detectFacialCue` from the frozen `trigger.js`.
3. **Verbal cue**: one call, after speech ends (never per frame or per partial transcript).
4. **Gate**: facial AND verbal. If either is false, nothing is generated and nothing is spoken.
5. **Wording**, by the operator's choice: LLM, approved (frozen) line, template, or the platform `createCheckInStrategy` helper.
6. **Optional fixed response delay**: pads the time from the end of the line to the start of the agent's reply up to N ms, so that LLM latency does not differ between recordings. It never shortens a slow response, and the actual delay is recorded.
7. **Speak** with `context.agent.speak`, show the line on the panel (and in the caption if enabled), then log.

The **strategy is always the operator's selection**. The LLM only words it; no code path lets the model choose or change the condition.

## 3. Deterministic policies

**Verbal classifier (`verbalClassifier.js`)**

| Situation | Result | `source` |
|---|---|---|
| Empty transcript | no LLM call, verbal cue false | `empty_transcript` |
| Detector set to "Keywords only" | v0.4 phrase list | `keywords` |
| LLM returns `concern` or `cue` | verbal cue true | `llm` |
| LLM returns `none` | verbal cue false | `llm` |
| LLM returns `uncertain` | verbal cue false (**fails closed**) | `llm` |
| LLM missing, error, timeout (8 s), non-JSON, invalid `type` | v0.4 phrase list, with `fallbackReason` | `keywords_fallback` |

- There is one call per trial and no retry.
- The decision is taken from `type` and never from a model boolean. A contradictory boolean is flagged as `inconsistentModelOutput`.
- The v0.4 keyword result is always computed and logged (`keywordVerbalCue`), so every record compares the two detectors.
- The labels are the model's judgement. They are **not a validated VR-CoDES coding**, and there is no calibrated confidence. The old `sampleConfidence` 0.8 placeholder is used only by the platform-helper wording mode, as in v0.4.

**Wording (`checkinPipeline.js`)**

| Mode | Behaviour | `generation.source` |
|---|---|---|
| LLM | Prompt with transcript, strategy definition and shared rules. The cleaned line is checked by `validateUtterance`. If it breaks a rule, there is **one** retry that tells the model why. If the call fails, or both attempts break rules, the template is used. | `llm` or `template_fallback` (+ `fallbackReason`, `validationIssues`) |
| Approved line | Speaks the approved line for the selected strategy. **If none is approved it speaks nothing** and reports an error, so the wrong line can never be recorded silently. | `approved` (+ `approvedOrigin`) |
| Template | Fixed line from `strategies.js` or `eval_config.json` `templates`. The explicit templates name the canonical exam stimulus; a different transcript produces a `templateMismatch` warning. | `template` |
| Platform helper | `createCheckInStrategy(id).getUtterance(...)`, as in v0.4. Its wording is unknown and is not checked. Errors fall back to the template. | `platform_helper` or `template_fallback` |

**Validator checks** (structural, not a substitute for team review):
- 8–32 words and at most 2 sentences. The prompt asks for exactly 2 sentences (sentence 1 = explicitness, sentence 2 = space) and 12–22 words.
- No advice, tips or reassurance in any arm (the team's definitions contain none).
- No mention of face, camera, detection or AI. No clinical or diagnostic words.
- Provides-space lines must contain a question; reduces-space lines must not.
- Explicit lines must share a topic word with the transcript or name a feeling. Non-explicit lines must do neither.
- Dismissive phrases ("don't worry", "not a big deal") are rejected, because they are VR-CoDES-P Active Blocking, which the study does not use.

**Safety:** if the transcript contains crisis wording (suicide, self-harm, "want to die", and similar), no strategy line is generated. A fixed supportive line pointing to 988 is spoken and the record is flagged `safetyOverride`. The operator then follows the study's safety procedure.

**Privacy:**
- Metrics never contain the transcript.
- The exported session log replaces live speech-to-text transcripts with `[omitted: live speech]`, unless `keepLiveTranscriptInLog` is true. Typed and fixture transcripts (scripted lines) are kept.
- No audio or video is stored by the module.
- The LLM prompts contain only the transcript, so do not put names in it.

**Re-entrancy and stop:**
- A `busy` flag plus disabled controls prevent overlapping scenarios, LLM tests or AU captures.
- `stop()` sets `stopped` and ends any pending listen.
- It clears the timers and stops the recognizer and camera.
- It stops speech, resets the face to neutral, restores the runner controls if the recording view hid them, and removes any fallback overlays.
- The pipeline checks `stopped` after every await and never speaks after Stop.

## 4. Deploying on eEVA (sage.cs.fiu.edu)

Create a **new** eEVA project for v0.5. Do not overwrite the v0.4 project you used for counted trials.

1. `git checkout feature/user-eval-llm-v0.5`, then `npm test` (Node 20+, no install step, no dependencies).
2. In Project Studio create the project. Upload into `src/` these **eight** files, all side by side (the `require("./...")` paths assume one folder):
   `main.js`, `trigger.js`, `config.json`, `eval_config.json`, `strategies.js`, `llmAdapter.js`, `verbalClassifier.js`, `checkinPipeline.js`.
   Do **not** upload `tests/`, `package.json` or the `.md` files.
3. Use `project.json` as the project manifest. If the checker rejects `helpers.llm.generate`, remove that line: the module still runs and shows `LLM helper: not found` with labelled fallbacks. Then ask the instructor or TA how to enable the LLM helper for Project Studio projects. The same applies to any other helper-group name it rejects.
4. Run the project in Chrome or Edge and allow the camera and microphone.
5. Run the smoke test below before recording anything.

To change the canonical stimulus, timings, templates, or to commit approved lines, edit `eval_config.json` and upload it again.

## 5. On-platform smoke test (must be done on sage.cs.fiu.edu)

None of these have been verified on eEVA yet. They are mocked in `tests/`.

| # | Check | Pass when | Where to look |
|---|---|---|---|
| 1 | Project loads (CommonJS checker accepts the 8 files) | The panel appears, titled "Empathic Check-In v0.5" | Screen |
| 2 | Platform pieces | Diagnostics shows "All required platform pieces found" | Panel > Diagnostics; console |
| 3 | LLM helper exists | Diagnostics shows `LLM helper: context.llm.generate` (or `context.helpers.llm.generate`) | Diagnostics; console line `LLM helper:` |
| 4 | LLM responds | **Test LLM** shows "OK in N ms". Note N: if it exceeds about 3000, use a 3000–4000 ms response delay when recording. | Diagnostics |
| 5 | Webcam and analyzer | **Capture AU** while frowning lists AU4 with a peak ≥ 45 (`*`) and samples > 0 | Report |
| 6 | Mic and speech-to-text | LIVE, Start scenario, say the stimulus: the report's transcript matches | Report |
| 7 | LLM classifier | Report shows `Verbal detector: llm`, `LLM label: concern`. Then type (LIVE FACE + TYPED TEXT) "I'm not stressed anymore." while frowning: label `none`, DO NOT CHECK IN. | Report |
| 8 | Text-to-speech | The agent speaks the check-in, with lip sync | Screen/audio |
| 9 | Strategy switching | All four strategies with LLM wording: each line fits its quadrant (questions only in provides-space lines; no feeling or topic words in non-explicit lines) | Report "Check-in:" |
| 10 | No-trigger branch | A relaxed face plus the stimulus, or a frown plus "I finished my homework today.", gives DO NOT CHECK IN and silence | Report; audio |
| 11 | Approve / replay | Approve a line, switch wording to "Approved line", run again: the same line, `Wording source: approved` | Report |
| 12 | Four repeatable outputs | Approved line for each strategy; two runs per strategy give identical lines | Report |
| 13 | Recording view | Only "Run" / "Exit recording view" visible; the panel hides during the run; runner controls hidden | Screen |
| 14 | Stop | Press Stop mid-speech: speech stops, camera light off, no further speech; restart works | Screen |
| 15 | Metrics | `trigger_decision_v05` entries with `version=v0.5` appear in the platform metrics view | Metrics panel |
| 16 | Fallback visible | (Optional) Remove `helpers.llm.generate` or test offline: report shows `keywords_fallback` / `template_fallback` with reasons | Report |

Record the results, the eEVA project name, the date and the commit hash for the dry-run note due Thu Nov 12.

## 6. Running the tests

```
npm test            # or: node --test "tests/*.test.js"
```

There are 51 tests across six files, all with no network access:
- the frozen-rule regression, including the 20 task-card lines, the 44.9/45/45.1 boundary, malformed AUs, and byte-identity of `trigger.js`/`config.json` with the tag;
- the strategy prompts and validator;
- the LLM adapter: timeouts, response shapes, errors;
- classifier semantics with a mocked model: negation, paraphrase, non-personal mention, uncertain, malformed JSON, timeout, rejection;
- the pipeline: gate, the four strategies, retries, fallbacks, approvals, safety, delay, stop, logging;
- a headless `main.js` run against a mocked eEVA context: simulated scenario, strategy reaching the prompt, double clicks, approve and replay, recording view, stop cleanup, and no-LLM fallback.

The classifier tests use a scripted model, so they verify the plumbing and the policy, **not** the real model's accuracy. To measure accuracy, run the classifier-check lines in `VIGNETTE_RECORDING_PLAN.md` §6 on the platform.

## 7. Residual risks

- **Unverified platform APIs:**
  - the exact LLM helper name, its return shape and its latency;
  - whether `helpers.llm.generate` is the right `helperGroups` entry;
  - whether `context.ui.setRunnerControlsVisible` exists in this build (it is called only if present);
  - multiple overlays (the caption is a second overlay).
- **LLM drift:** generated lines vary between runs, so record vignettes with **approved** lines only.
- **The validator is heuristic:**
  - A line can pass and still be miscoded; for example, an explicit line that names only the topic is acceptable under VR-CoDES-P, but the team should check it.
  - A good line can fail the validator, for example by using a feeling word in a non-explicit line. It then falls back to the template.
  - The team must review the four final lines against the manual.
- **Simulated mode** produces no live measurement. Any clip recorded with it must be disclosed as simulated (see the recording plan).
- **The LLM classifier is not validated** against human VR-CoDES coding. If it is used in any counted evaluation, report it as a new detector condition, not as the baseline.
