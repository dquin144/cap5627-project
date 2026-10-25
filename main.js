/*
 * Context-Aware Empathic Check-In: eEVA Project Studio entry point.
 *
 * What it does: during a trial the experimenter clicks "Start trial", the participant says a
 * line, and the module records the strongest AU4 facial reading seen while they spoke.
 * The facial reading and the spoken words are passed to evaluateCheckIn(); only when BOTH show
 * a cue does the agent speak a check-in.
 *
 * Buttons: "Start trial", which runs one trial, and "Capture AU (dry run)", a dry-run-only
 * tool that is not part of the frozen baseline (see the DRY-RUN TOOL block). This is the
 * baseline on eEVA with OpenFace 3.0: an experimenter presses Start trial and annotates each
 * result by hand, so the module only needs to answer "did the cues fire the check-in?". The
 * participant is a teammate or classmate, and no video or audio is kept.
 *
 * On start it also checks that the platform functions it needs exist and that the chosen
 * strategy is accepted, and reports any problem on screen and in the console.
 *
 * The project checker loads this file as CommonJS, so it must expose run(context) and
 * stop(context) through module.exports. The research rationale and the setting descriptions
 * for config.json are in the README.
 */

// Settings: the allowed check-in strategies (config.strategies), the one used this run
// (config.strategy), values passed to the strategy, and the facial analyzer name.
const config = require("./config.json");

// CONFIG holds the AU threshold, the AU ids to watch and the distress phrase list.
// evaluateCheckIn(...) applies the rule: facial cue AND verbal cue.
// trigger.js is the single copy of the decision logic.
const { CONFIG, evaluateCheckIn } = require("./trigger.js");

// ---------------------------------------------------------------
// Shared state. Declared at module level so stop() can release it.
// ---------------------------------------------------------------

// Speech recognizer (AudioToText instance). Created during setup.
let recognizer = null;

// Camera object returned by the webcam helper. camera.video feeds the AU analysis.
let camera = null;

// Timer ids for listenOnce(): the end-of-speech silence timer and the maximum-wait timer.
let silenceTimer = null;
let listenLimitTimer = null;

// Function that ends the current listenOnce() early. Null when nothing is listening.
let finishListening = null;

// True once Stop has been pressed. Checked after every await so work ends quietly.
let stopped = false;

// Longest time a trial listens for the participant's line, in milliseconds. A trial's peak
// AU window runs from Start trial until the speech ends (1.2 s of silence), and never longer
// than this. The Capture AU dry-run tool uses it as its capture window.
const LISTEN_MAX_WAIT_MS = 8000;

// Number of recognizer callbacks received during the current listen.
let speechEvents = 0;

// Optional callback that receives each partial transcript so it can be shown on screen.
let onInterim = null;

// Optional callback that receives the analyzer's raw AU result for every frame the analysis
// loop reads while listening is on. Only the dry-run Capture AU tool sets it (to list every
// AU the analyzer returns); it stays null otherwise.
let onAuFrame = null;

// ---------------------------------------------------------------
// listenOnce: capture one spoken answer.
// Keeps the latest transcript, finishes after silenceMs of silence, and gives up after
// maxWaitMs so a silent participant can never freeze the trial.
// Returns the final transcript, or "" if nothing was said.
// ---------------------------------------------------------------
// Original: function listenOnce(silenceMs = 1200, maxWaitMs = 8000) {
function listenOnce(silenceMs = 1200, maxWaitMs = LISTEN_MAX_WAIT_MS) {
  return new Promise((resolve) => {
    // Most recent transcript from the recognizer. It is refined as the person keeps talking.
    let latest = "";
    // Guards against resolving twice when silence and the maximum wait expire together.
    let finished = false;

    finishListening = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(silenceTimer);
      window.clearTimeout(listenLimitTimer);
      recognizer.stopRecognition();
      finishListening = null;
      resolve(latest.trim());
    };

    recognizer.startContinuousRecognition((transcript) => {
      speechEvents++;
      latest = transcript || "";
      onInterim?.(latest);
      // New speech arrived, so restart the silence countdown.
      window.clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(finishListening, silenceMs);
    });

    // If no speech arrives at all, stop after maxWaitMs and resolve with "".
    listenLimitTimer = window.setTimeout(finishListening, maxWaitMs);
  });
}

// Panel added to the page directly when the platform has no overlay helper, so stop() can remove it.
let fallbackPanel = null;

// ---------------------------------------------------------------
// findMissingPlatformPieces: names the platform functions this module calls that the current
// project does not provide. Returns an empty list when everything is available.
// ---------------------------------------------------------------
function findMissingPlatformPieces(context) {
  const h = context.helpers || {};
  const needed = [
    ["helpers.webcam.start", h.webcam?.start],
    ["helpers.biofeedback.analyzeVideo", h.biofeedback?.analyzeVideo],
    ["helpers.biofeedback.getTopAUs", h.biofeedback?.getTopAUs],
    ["helpers.wait", h.wait],
    ["helpers.project.createCheckInStrategy", h.project?.createCheckInStrategy],
    ["AudioToText", typeof AudioToText === "undefined" ? undefined : AudioToText],
    ["context.agent.speak", context.agent?.speak],
    ["context.metrics.create", context.metrics?.create],
    ["context.ui.mountOverlay", context.ui?.mountOverlay]
  ];
  return needed
    .filter(([, piece]) => typeof piece !== "function")
    .map(([name]) => name);
}

// ---------------------------------------------------------------
// run: called by the platform when the project starts.
// ---------------------------------------------------------------
module.exports.run = async function run(context) {
  stopped = false;

  // Startup diagnostics: lists what this project actually exposes.
  console.log("project helpers:", Object.keys(context.helpers?.project || {}));
  console.log("helpers:", Object.keys(context.helpers || {}));
  console.log("context:", Object.keys(context));
  console.log("speech helper:", context.speech ? Object.keys(context.speech) : "none");

  // Platform functions this module needs but the project does not provide.
  const missingPieces = findMissingPlatformPieces(context);
  if (missingPieces.length) {
    console.warn("Missing platform pieces:", missingPieces.join(", "));
  } else {
    console.log("All required platform pieces are available.");
  }

  // Metrics logger. Every trial decision is recorded here. If the
  // platform has no metrics helper, records go to the console instead so trials still run.
  const metrics = context.metrics?.create
    ? context.metrics.create("distress-check-in")
    : { record: (...args) => console.log("[metric]", ...args) };

  // ---------------------------------------------------------------
  // On-screen panel: status text, camera preview and the trial buttons.
  // ---------------------------------------------------------------

  // Container for everything the experimenter sees.
  const panel = document.createElement("section");
  panel.style.cssText =
    "bottom:24px; left:50%; width:min(620px,calc(100% - 48px)); " +
    "transform:translateX(-50%); padding:18px; border-radius:10px; " +
    "background:white; color:#183322;";

  // Shows the check-in sentence the agent is about to say or has just said.
  const prompt = document.createElement("p");
  prompt.textContent = "Preview";

  // Starts one trial: listen for the line and read the face at the same time. Also starts
  // the camera and microphone again if setup failed.
  // Stays disabled until the camera and recognizer are ready.
  const listenButton = document.createElement("button");
  listenButton.type = "button";
  listenButton.textContent = "Start trial (listen + read face)";
  listenButton.disabled = true;

  // One line of text showing the current step, what was heard, and the decision.
  const statusLine = document.createElement("p");
  statusLine.textContent = "Starting camera and microphone...";

  // Updates the status line in the panel and the platform's own status label, if it has one.
  const setStatus = (text) => {
    statusLine.textContent = text;
    context.settings?.labelElement?.(text);
  };

  // Place for the camera preview when the project does not provide its own container.
  const camHost = document.createElement("div");

  // Check-in strategy object created for the current check-in.
  let strategy = null;

  // True while the microphone is open and AU readings should count toward the peak.
  let listening = false;

  // True while a trial or a Capture AU run is in progress. Blocks overlapping clicks.
  let busy = false;

  // Switches the dry-run Capture AU button on or off. It does nothing unless the dry-run tool
  // block below is active, so the trial code can call it whether or not that block exists.
  let setDryRunEnabled = () => {};

  panel.append(prompt, statusLine, camHost, listenButton);
  if (typeof context.ui?.mountOverlay === "function") {
    context.ui.mountOverlay(panel);
  } else {
    // No overlay helper: put the panel on the page directly.
    fallbackPanel = panel;
    (context.containerRef?.current || document.body).appendChild(panel);
  }

  // ---------------------------------------------------------------
  // createStrategy: build the check-in strategy named by config.strategy.
  // Throws a message naming the exact problem if config.strategy is not listed in
  // config.strategies, the helper is missing, the platform rejects the name, or the result
  // lacks the methods this module calls.
  // ---------------------------------------------------------------
  function createStrategy() {
    if (!Array.isArray(config.strategies) || !config.strategies.includes(config.strategy)) {
      throw new Error(
        'config.strategy "' + config.strategy + '" is not one of the allowed strategies: ' +
        (Array.isArray(config.strategies) ? config.strategies.join(", ") : "(none listed)")
      );
    }
    const create = context.helpers?.project?.createCheckInStrategy;
    if (typeof create !== "function") {
      throw new Error("createCheckInStrategy is not available in this project.");
    }
    let created;
    try {
      created = create(config.strategy);
    } catch (err) {
      throw new Error(
        'Strategy "' + config.strategy + '" was rejected by createCheckInStrategy: ' +
        (err && err.message ? err.message : err)
      );
    }
    // Only getUtterance is needed to speak the check-in.
    if (!created || typeof created.getUtterance !== "function") {
      throw new Error(
        'Strategy "' + config.strategy + '" did not return getUtterance.'
      );
    }
    return created;
  }

  // Report setup problems on the preview line before the first trial instead of mid-trial.
  if (missingPieces.length) {
    prompt.textContent = "Missing platform pieces: " + missingPieces.join(", ") + " (see console)";
  } else {
    try {
      createStrategy();
    } catch (err) {
      console.warn(err.message);
      prompt.textContent = err.message;
    }
    // Console report of which listed strategy names the platform accepts, so a naming
    // mismatch between config.json and createCheckInStrategy shows up on the first run.
    for (const name of config.strategies || []) {
      try {
        context.helpers.project.createCheckInStrategy(name);
        console.log('Strategy "' + name + '": accepted by createCheckInStrategy');
      } catch (err) {
        console.warn('Strategy "' + name + '": rejected -', err && err.message ? err.message : err);
      }
    }
  }

  // ---------------------------------------------------------------
  // runCheckIn: build the check-in sentence, show it, log it and speak it.
  // triggerSource says why it ran ("facial+verbal") and is only used for logging.
  // ---------------------------------------------------------------
  async function runCheckIn(triggerSource) {
    // Create the strategy named by config.strategy (validated against config.strategies).
    strategy = createStrategy();

    // Ask the strategy for the sentence to say. It receives config.triggerSource rather than
    // the real source, because it is unknown whether getUtterance validates that value.
    // The real source is recorded in the metrics log below.
    const utterance = strategy.getUtterance({
      triggerSource: config.triggerSource,
      confidence: config.sampleConfidence,
    });

    prompt.textContent = utterance;

    metrics.record(
      "check_in_strategy",
      config.strategy,
      "trigger_source=" + triggerSource
    );

    if (typeof context.agent?.speak !== "function") {
      throw new Error("context.agent.speak is not available in this project.");
    }
    await context.agent.speak(utterance);
  }

  // ---------------------------------------------------------------
  // Facial AU analysis: keep the strongest reading of each watched AU (AU4) seen while the
  // participant speaks.
  // ---------------------------------------------------------------

  // Platform helper functions: webcam, biofeedback (AU analysis) and wait.
  const helpers = context.helpers;

  // Strongest reading of each watched AU during the current listen,
  // for example { "4": 31.2 }. This is the facial input to evaluateCheckIn().
  let peak = {};

  // Most recent single-frame reading, in the same shape as peak.
  let latest = {};

  // The peak of every watched AU as log text, for example "peak_au4=31.2".
  const peakDetail = () =>
    CONFIG.facialAUs.map((id) => "peak_au" + id + "=" + peak[id]).join(";");

  // Sets every watched AU in peak back to 0 at the start of a trial.
  const resetPeak = () => {
    peak = {};
    CONFIG.facialAUs.forEach((id) => { peak[id] = 0; });
  };
  resetPeak();

  // Turns one analyzer result into { "4": n }: the strongest intensity per watched AU.
  // The analyzer may label an AU "AU04", "4" or "4L" / "4R", so labels are reduced to the
  // plain number first. AUs that are not found stay 0.
  function extractCueAUs(aus) {
    const out = {};
    CONFIG.facialAUs.forEach((id) => { out[id] = 0; });
    const entries = helpers.biofeedback.getTopAUs(aus, 60) || [];
    for (const item of entries) {
      // Remove letters and leading zeros: "AU04" -> "4".
      const id = String(parseInt(String(item.au).replace(/\D/g, ""), 10));
      if (id in out) out[id] = Math.max(out[id], Number(item.intensity) || 0);
    }
    return out;
  }

  // Analyzer name: the platform setting if present, then config.json, then "openface3", the
  // baseline's analyzer.
  // Original last fallback: "pyfeat".
  const analyzerEngine =
    (context.settings && context.settings.biofeedbackEngine) ||
    config.biofeedbackEngine ||
    "openface3";

  // True while the camera and recognizer are running. If setup failed, Start trial sees false
  // and tries to start them again.
  let sensorsOn = false;

  // Starts the camera and the speech recognizer, then begins reading the face in the
  // background. Returns true when both are running, or false if Stop cancelled it part-way
  // (anything already started is shut down again).
  async function startSensors() {
    if (!helpers?.webcam || !helpers?.biofeedback) {
      throw new Error("helpers.webcam / helpers.biofeedback not exposed on context.helpers (see console)");
    }
    const newCamera = await helpers.webcam.start(
      (context.containerRef && context.containerRef.current) || camHost,
      { overlay: true, width: 420, height: 315 }
    );
    if (stopped) {
      newCamera?.stop?.();
      return false;
    }

    const newRecognizer = new AudioToText();
    await newRecognizer.initializeRecognizer();
    if (stopped) {
      newCamera?.stop?.();
      newRecognizer.stopRecognition?.();
      return false;
    }

    camera = newCamera;
    recognizer = newRecognizer;
    sensorsOn = true;
    // Runs in the background until Stop, so it is deliberately not awaited.
    analysisLoop();
    return true;
  }

  // Reads the camera over and over until Stop. Each pass waits for the previous analysis to
  // finish, so slow frames never pile up. While listening, it raises peak to the highest
  // reading seen.
  async function analysisLoop() {
    // Original: the engine was worked out here with the same three-step fallback. It now
    // lives in analyzerEngine (above) so the Capture AU tool can show the same name.
    // const engine =
    //   (context.settings && context.settings.biofeedbackEngine) ||
    //   config.biofeedbackEngine ||
    //   "pyfeat"; (now "openface3")
    while (!stopped) {
      try {
        const result = await helpers.biofeedback.analyzeVideo(camera.video, analyzerEngine);
        if (stopped) return;
        if (result && result.aus) {
          latest = extractCueAUs(result.aus);
          if (listening) {
            CONFIG.facialAUs.forEach((id) => {
              peak[id] = Math.max(peak[id], latest[id]);
            });
            // Dry-run hook: hands Capture AU the raw result so it can list every AU returned.
            onAuFrame?.(result.aus);
          }
        }
      } catch (err) {
        if (stopped) return;
        console.error("AU analysis failed:", err);
        // Wait briefly so a repeating error does not spin the loop.
        await helpers.wait(500);
      }
      // Short wait between frames.
      await helpers.wait(120);
      if (stopped) return;
    }
  }

  // ---------------------------------------------------------------
  // Speech capture
  // ---------------------------------------------------------------

  // Pulls the transcript text out of a speech-helper result, which may be a string or an
  // object with a transcript or text field. Returns "" if there is none.
  function transcriptFrom(raw) {
    if (typeof raw === "string") return raw.trim();
    if (raw && typeof raw === "object") {
      const t = raw.transcript ?? raw.text ?? "";
      return typeof t === "string" ? t.trim() : "";
    }
    return "";
  }

  // Captures the participant's spoken line and returns it as text ("" if nothing usable).
  async function captureLine() {
    speechEvents = 0;
    onInterim = (text) => {
      if (!stopped) setStatus("Hearing: \"" + text + "\"");
    };

    // Step 1: confirm the browser allows microphone access before listening.
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.error("Microphone check failed:", err);
      throw new Error(
        "Microphone unavailable (" + (err && err.name ? err.name : err) +
        "). Allow the mic for this site in the browser address bar, then retry."
      );
    }
    if (stopped) return "";

    // Step 2: listen with the speech recognizer.
    const heard = await listenOnce();
    if (heard || stopped) return heard;

    // Step 3: if the recognizer returned no events, try the platform's speech helper
    // when this project provides one.
    if (speechEvents === 0 && typeof context.speech?.listenOnce === "function") {
      console.warn("AudioToText produced no events; trying context.speech.listenOnce");
      setStatus("Retrying with the platform speech helper... say the line now.");
      try {
        return transcriptFrom(await context.speech.listenOnce({ timeoutMs: 8000 }));
      } catch (err) {
        console.error("context.speech.listenOnce failed:", err);
      }
    }
    return "";
  }

  // ---------------------------------------------------------------
  // One trial: listen to the line while tracking the peak AU4, decide, then maybe check in.
  // ---------------------------------------------------------------
  listenButton.addEventListener("click", async () => {
    if (busy || stopped) return;
    busy = true;
    listenButton.disabled = true;
    // Capture AU stays off from the start of the trial until the dialogue has finished.
    setDryRunEnabled(false);
    try {
      // If setup failed earlier, start the camera and microphone now.
      if (!sensorsOn) {
        setStatus("Restarting camera and microphone...");
        if (!(await startSensors())) return;
      }
      resetPeak();
      listening = true;
      setStatus("Listening... say the line now.");
      const transcript = await captureLine();
      listening = false;
      if (stopped) return;

      // Nothing usable was heard: report why and log it, but do not evaluate.
      if (!transcript) {
        setStatus(
          speechEvents === 0
            ? "No speech events received from the recognizer. Check the mic (see console) and retry."
            : "Speech was heard but no usable transcript. Click Start trial to retry."
        );
        metrics.record("trigger_decision", "no_speech", peakDetail());
        return;
      }

      // Apply the rule. The facial cue is the peak AU intensity during the listen, compared
      // with the threshold in CONFIG; the verbal cue is a phrase match on the transcript.
      const result = evaluateCheckIn({ aus: peak, transcript });

      setStatus(
        "Heard: \"" + transcript + "\" | " +
        CONFIG.facialAUs.map((id) => "AU" + id + " peak " + peak[id].toFixed(1)).join(", ") +
        " | Facial: " + result.facialCue + ", Verbal: " + result.verbalCue +
        " -> " + (result.shouldTrigger ? "CHECK IN" : "DO NOT CHECK IN")
      );

      // Log the decision with its inputs. The spoken sentence itself is not logged.
      metrics.record(
        "trigger_decision",
        result.shouldTrigger ? "check_in" : "no_check_in",
        "facial=" + result.facialCue +
          ";verbal=" + result.verbalCue +
          ";" + peakDetail() +
          ";threshold=" + CONFIG.auThreshold +
          ";aus=" + (result.matchedAUs.join(",") || "none") +
          ";phrases=" + (result.matchedPhrases.join(",") || "none")
      );

      if (result.shouldTrigger) {
        await runCheckIn("facial+verbal");
        if (stopped) return;
      }
    } catch (err) {
      console.error("Trial failed:", err);
      setStatus("Trial error: " + (err && err.message ? err.message : err));
    } finally {
      // Runs after a check-in finished speaking, after a "do not check in" decision was
      // shown, and after any error, so the buttons always come back.
      listening = false;
      busy = false;
      if (!stopped) {
        listenButton.disabled = false;
        setDryRunEnabled(true);
      }
    }
  });

  // ===== DRY-RUN TOOL START =====
  // Dry runs only. NOT part of the frozen baseline; kept for later OpenFace 3.0 dry runs.
  // At the freeze, comment out this whole block (the button creation included). The
  // setDryRunEnabled() calls and the onAuFrame hook outside it then stay inert.
  //
  // Capture AU shows every AU the analyzer returns for the current face, with the peak and the
  // mean of each over the capture window, so the team can see which AUs exist at all (for
  // example whether the watched AU4 is returned), check the AU scale, set the threshold,
  // and decide whether a per-user neutral calibration is needed. It listens to no speech,
  // speaks nothing and never checks in. Its numbers are never trial data and are not written
  // to the metrics log.

  // Length of the capture: the longest window a trial can use for its peak.
  const captureWindowMs = LISTEN_MAX_WAIT_MS;

  const captureButton = document.createElement("button");
  captureButton.type = "button";
  captureButton.textContent = "Capture AU (dry run)";
  captureButton.disabled = true;
  panel.append(captureButton);

  setDryRunEnabled = (enabled) => { captureButton.disabled = !enabled; };

  captureButton.addEventListener("click", async () => {
    if (busy || stopped) return;
    busy = true;
    // Capture AU and Start trial never run at the same time.
    captureButton.disabled = true;
    listenButton.disabled = true;
    try {
      // If setup failed earlier, start the camera now, as Start trial does.
      if (!sensorsOn) {
        setStatus("Restarting camera and microphone...");
        if (!(await startSensors())) return;
      }

      // Same face reading as a trial: while `listening` is true the analysis loop reads the
      // camera. The hook below also records every AU the analyzer returns, under the label
      // the analyzer uses (for example "AU04" or "4L"): the highest value, and the total for
      // the mean.
      resetPeak();
      const peaks = {};
      const sums = {};
      let samples = 0;
      // Show line breaks in the status text (one AU per line).
      statusLine.style.whiteSpace = "pre-line";
      onAuFrame = (rawAus) => {
        samples++;
        // The first raw result is printed once, so its real shape can be inspected.
        if (samples === 1) console.log("[dry_run_capture] raw analyzer result (first frame):", rawAus);
        // One value per AU in this frame, on the 0-100 scale the trial uses. The analyzer
        // can report the same AU under two labels ("AU1" on a 0-1 scale and "AU01" on 0-100),
        // so labels are reduced to one name per AU first: "AU04" and "AU4" both become "AU4",
        // and an L/R side letter is kept ("4L" -> "AU4L").
        const nameOf = (label) => {
          const m = String(label).match(/(\d+)([LR])?/i);
          return m ? "AU" + parseInt(m[1], 10) + (m[2] ? m[2].toUpperCase() : "") : String(label);
        };
        // getTopAUs gives the values the trial reads (0-100). It leaves out AUs it considers
        // not detected.
        const trialValues = {};
        (helpers.biofeedback.getTopAUs(rawAus, 100) || []).forEach((item) => {
          const v = Number(item.intensity);
          if (Number.isFinite(v)) {
            const name = nameOf(item.au);
            trialValues[name] = Math.max(trialValues[name] ?? -Infinity, v);
          }
        });
        // The raw result is read as well (a list of {au, intensity} items, or an object of
        // label -> number) so AUs that getTopAUs left out still appear, at their raw value.
        const rawValues = {};
        const keepRaw = (label, value) => {
          const v = Number(value);
          if (!label || !Number.isFinite(v)) return;
          const name = nameOf(label);
          rawValues[name] = Math.max(rawValues[name] ?? -Infinity, v);
        };
        if (Array.isArray(rawAus)) {
          rawAus.forEach((item) => {
            keepRaw(String(item?.au ?? item?.name ?? item?.id ?? item?.label ?? ""),
                    item?.intensity ?? item?.value ?? item?.score);
          });
        } else if (rawAus && typeof rawAus === "object") {
          Object.entries(rawAus).forEach(([label, value]) => keepRaw(label, value));
        }
        // The trial's value wins. An AU only in the raw result is shown at its raw value
        // (normally 0, so the scale does not matter).
        const names = new Set([...Object.keys(trialValues), ...Object.keys(rawValues)]);
        names.forEach((name) => {
          const value = trialValues[name] ?? rawValues[name];
          peaks[name] = Math.max(peaks[name] ?? -Infinity, value);
          sums[name] = (sums[name] ?? 0) + value;
        });
      };

      setStatus("Capture AU: hold the face for " + (captureWindowMs / 1000) + " s...");
      listening = true;
      await helpers.wait(captureWindowMs);
      listening = false;
      onAuFrame = null;
      if (stopped) return;

      // Show the result on the status line (and in the console).
      // Short numbers: 1 decimal from 10 up, 2 decimals below (so 0-1 scales stay readable).
      const fmt = (n) => Number(n.toFixed(n >= 10 ? 1 : 2));
      // The plain AU number in a label: "AU04" -> "4", "4L" -> "4".
      const idOf = (label) => String(parseInt(label.replace(/\D/g, ""), 10));
      const shown = (label) => (/^au/i.test(label) ? label : "AU" + label);
      const labels = Object.keys(peaks).sort(
        (a, b) => (idOf(a) - idOf(b)) || a.localeCompare(b)
      );
      // Peak and mean (over all samples) of every AU returned. * marks a watched AU (AU4)
      // whose peak is at or above the threshold.
      const rows = labels.map((label) => ({
        label,
        peak: fmt(peaks[label]),
        avg: fmt(sums[label] / samples),
        atOrAboveThreshold:
          CONFIG.facialAUs.includes(idOf(label)) && peaks[label] >= CONFIG.auThreshold
      }));
      // Watched AUs the analyzer never returned (the reason AU7 is no longer watched: OpenFace
      // 3.0 does not return it).
      const returnedIds = new Set(labels.map(idOf));
      const notReturned = CONFIG.facialAUs.filter((id) => !returnedIds.has(id));
      // One line of header, then one AU per line: "AU4: 61 Peak, 20 Avg".
      setStatus(
        "Capture AU: " + captureWindowMs + " ms | " + analyzerEngine +
        " | threshold " + CONFIG.auThreshold + " | " + samples + " samples" +
        (samples === 0
          ? "\nNo AU readings received (check the camera and analyzer)."
          : (rows.length
              ? "\n" + rows.map((r) =>
                  shown(r.label) + ": " + r.peak + " Peak, " + r.avg + " Avg" +
                  (r.atOrAboveThreshold ? "*" : "")
                ).join("\n") + "\n(* at or above threshold)"
              : "\nNo AUs returned.") +
            (notReturned.length
              ? "\nNot returned: " + notReturned.map((id) => "AU" + id).join(", ")
              : ""))
      );
      console.log("[dry_run_capture]", {
        windowMs: captureWindowMs,
        engine: analyzerEngine,
        threshold: CONFIG.auThreshold,
        samples,
        rows,
        notReturned
      });
    } catch (err) {
      console.error("Capture AU failed:", err);
      setStatus("Capture AU error: " + (err && err.message ? err.message : err));
    } finally {
      listening = false;
      onAuFrame = null;
      busy = false;
      // Feedback is shown (or the capture failed): enable all buttons.
      if (!stopped) {
        listenButton.disabled = false;
        captureButton.disabled = false;
      }
    }
  });
  // ===== DRY-RUN TOOL END =====

  // ---------------------------------------------------------------
  // Setup: start the camera and the recognizer, then begin reading the face.
  // ---------------------------------------------------------------
  try {
    if (await startSensors()) {
      listenButton.disabled = false;
      setDryRunEnabled(true);
      setStatus("Ready. Click Start trial, then have the participant say the line.");
    }
  } catch (err) {
    console.error("Webcam/recognizer setup failed:", err);
    setStatus("Setup failed: " + (err && err.message ? err.message : err) + " (Start trial will try again)");
    // Let Start trial retry the setup instead of leaving the panel unusable.
    listenButton.disabled = false;
    setDryRunEnabled(true);
  }

  // Keep run() open until the platform signals cleanup, so Start trial stays active.
  await new Promise((resolve) => context.onCleanup(() => resolve()));
};

// ---------------------------------------------------------------
// stop: called when the project is stopped. Releases the microphone, camera, timers,
// speech and on-screen panel.
// ---------------------------------------------------------------
module.exports.stop = async function stop(context) {
  stopped = true;
  finishListening?.();
  window.clearTimeout(silenceTimer);
  window.clearTimeout(listenLimitTimer);
  recognizer?.stopRecognition();
  camera?.stop();
  context.agent?.stopSpeaking?.();
  context.agent?.neutral?.();
  context.ui?.clear?.();
  fallbackPanel?.remove();
  fallbackPanel = null;
};
