# SIA Project 3.2: eEVA live-integration v1.1

This package is a **Project Studio browser-JavaScript project** that uses the actual signatures copied from the user's Helper APIs panel. It is NOT an external Node.js web service and is NOT the frozen offline baseline.

## What the current source implements

1. Starts the eEVA camera with `await context.webcam.start(context.container)`.
2. Polls `await context.biofeedback.analyzeVideo(video,'pyfeat')` without overlapping requests, extracting only AU4 and AU7 numeric readings when present.
3. Collects real speech with `context.speech.listenOnce({timeoutMs:...})`; transcribed words go to a transparent cue detector.
4. Triggers a check-in when **two above-threshold facial observations within 10 seconds AND a verbal concern** coincide. Adds a 90-second cooldown.
5. Uses `context.llm.generate(prompt)` to generate a short check-in in the **assigned** `explicit_space` or `nonexplicit_space` experimental condition. Validates content and uses a labeled deterministic wording fallback if needed.
6. Asks the agent to say the check-in with `context.agent.speak(text)` and receives a response via microphone or participant buttons.
7. Honors `pause`, `continue`, `share`, and `correction`. If the user pauses, a Resume button returns to the scripted conversation.
8. Sets avatar AU12 at a provisional light intensity of 25 using `context.agent.setAUs([{au:'12',intensity:25}])` and reapplies before and after agent speech.
9. Cleans up timers, owned camera tracks, agent speech, and participant panel on Stop.
10. Logs diagnostic and research events through eEVA's metrics helper.

## Installing in your EXISTING eEVA project

**Back up your current project first.** Your course project number is `3.2`, but the platform template may be labeled `4.2` in the guide; do not change its platform identifier without permission.

- Replace `src/main.js` and `src/config.json` with the versions supplied here.
- Replace `src/trigger.js` with this **enhanced live controller** (do not overwrite a frozen offline-baseline commit).
- Add `src/checkin.js` and `src/platform_bindings.js`.
- Keep your `project.json` entry set to `src/main.js` and the `browser-js` runtime; retain existing `helperGroups` while verifying that webcam, biofeedback, llm and agent APIs are exposed.
- Save, select **Check code**, then **Run**. Permit camera and microphone access.
- Say something like **“I've been feeling overwhelmed with school lately.”** while making a visible facial movement. The system will check in **only if numeric AU4 or AU7 readings meet the configured threshold at least twice**. Normal expressions may not reach that threshold.
- The page's debug status should initially display `LIVE AU values (debug only): AU4=..., AU7=...` once genuine readings arrive. If it instead displays an AU-format or analysis error, collect the eEVA output error and a nonidentifying sample shape for refinement.

## Important runtime uncertainty and calibration

The Helper APIs panel specifies method names and arguments but **does not specify**:
- what exact object `context.webcam.start(context.container)` returns;
- the schema, units, range, face selection and cadence of the results from `analyzeVideo`;
- whether `setAUs` survives all Unity idle/speech animations;
- the response shape of `llm.generate` (string and common `{text:...}`-like shapes are supported).

The adapter accepts common AU key representations: `AU04`, `AU4`, `4`, `au04`, `AU04_r`, nested `aus` / `AUs` / `features`, and lists like `{au:'4',intensity:2.5}`. It explicitly **rejects categorical-emotion outputs**. It does not extrapolate a numeric AU from an anger/sadness label. If no recognizable numeric AU readings are returned, facial triggering remains disabled (fail closed).

**Threshold 2.0 is provisional only.** The actual `pyfeat` numeric range might be very different. Observe AU4/AU7 in debug output, verify the measurement scale, then calibrate and freeze the threshold before any counted live trials. Do not silently translate a 0-1 confidence score into a 0-5 AU intensity.

The AU12 value **25** is an engineering starting point; visually verify that it yields a light smile and stays consistent while speaking. Never use a full `happy` expression in one study condition and a light smile in another.

## Experimental safeguards

- `config.condition` fixes the communication-strategy independent variable. **The LLM generates the wording, not the choice of IV condition.** Set `explicit_space` or `nonexplicit_space` according to the counterbalancing plan.
- The current dialogue asks three semi-structured questions. The check-in is **not** forced at the end: it requires both measured cues.
- `config.allowDeveloperManualAU` defaults to `false`; if ever enabled, it is only for engineering debugging. Injected observations cannot be counted as real participant trials.
- `config.debug.showAUReadings` defaults to `true` for the first engineering test. Turn it `false` for any participant-facing controlled experiment so detection scores do not affect perception.
- Use real consent/approved participant procedure and record failures; don't count local unit-test results as experimental data.
- If facial data are not returned from the platform, do not claim the end-to-end trigger is working.
- Do not store raw face videos unnecessarily or expose participant-identifying data in reports.

## Local tests (NOT an eEVA runtime test)

```bash
node tests/trigger.test.js
node tests/platform_bindings.test.js
```

The code cannot be certified as running on the FIU Project Studio instance until you execute it there. The first desired runtime validation is: visible live AU4/AU7 values with confirmed units and a successful trigger using actual webcam + microphone, followed by an LLM spoken check-in and pause/continue response.
