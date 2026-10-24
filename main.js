/*
 * Context-Aware Empathic Check-In: eEVA Project Studio entry point.
 *
 * What it does: during a trial the experimenter clicks "Start trial", the participant says a
 * line, and the module records the strongest AU4 / AU7 facial reading seen while they spoke.
 * The facial reading and the spoken words are passed to evaluateCheckIn(); only when BOTH show
 * a cue does the agent speak a check-in. Participant answers (Pause / Continue) are logged.
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
// trigger-core.js is the browser-safe copy of trigger.js, which cannot load in eEVA.
const { CONFIG, evaluateCheckIn } = require("./trigger-core.js");

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

// Number of recognizer callbacks received during the current listen.
let speechEvents = 0;

// Optional callback that receives each partial transcript so it can be shown on screen.
let onInterim = null;

// ---------------------------------------------------------------
// listenOnce: capture one spoken answer.
// Keeps the latest transcript, finishes after silenceMs of silence, and gives up after
// maxWaitMs so a silent participant can never freeze the trial.
// Returns the final transcript, or "" if nothing was said.
// ---------------------------------------------------------------
function listenOnce(silenceMs = 1200, maxWaitMs = 8000) {
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

  // Metrics logger. Every trial decision and participant response is recorded here. If the
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

  // Participant's answers to a spoken check-in. Both stay disabled until a check-in is spoken.
  const pause = document.createElement("button");
  pause.type = "button";
  pause.textContent = "Pause";
  const continueButton = document.createElement("button");
  continueButton.type = "button";
  continueButton.textContent = "Continue / correct the agent";
  pause.disabled = true;
  continueButton.disabled = true;

  // True while a spoken check-in is waiting for the participant's Pause / Continue answer.
  let awaitingResponse = false;

  // Manual check-in that skips the trigger rule. For testing only, not for counted trials.
  const checkInButton = document.createElement("button");
  checkInButton.type = "button";
  checkInButton.textContent = "Check In";

  // Starts one trial: listen for the line and read the face at the same time.
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

  // Check-in strategy object created for the current check-in. Used to answer Pause / Continue.
  let strategy = null;

  // True while the microphone is open and AU readings should count toward the peak.
  let listening = false;

  // True while a trial or manual check-in is running. Blocks overlapping clicks.
  let busy = false;

  panel.append(prompt, statusLine, camHost, listenButton, checkInButton, pause, continueButton);
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
    if (!created ||
        typeof created.getUtterance !== "function" ||
        typeof created.handleUserResponse !== "function") {
      throw new Error(
        'Strategy "' + config.strategy + '" did not return getUtterance and handleUserResponse.'
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
  // triggerSource says why it ran ("facial+verbal" or "manual") and is only used for logging.
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
    if (stopped) return;

    // Now the participant can answer with Pause or Continue.
    awaitingResponse = true;
    pause.disabled = false;
    continueButton.disabled = false;
  }

  // Manual check-in. It skips the trigger rule, so do not use it during counted trials.
  checkInButton.addEventListener("click", async () => {
    if (busy || stopped) return;
    busy = true;
    listenButton.disabled = true;
    try {
      // Logged as "manual" so these never mix with real triggered check-ins.
      await runCheckIn("manual");
    } catch (err) {
      console.error("Manual check-in failed:", err);
      setStatus("Check-in error: " + (err && err.message ? err.message : err));
    } finally {
      busy = false;
      if (!stopped && camera && recognizer) listenButton.disabled = false;
    }
  });

  // ---------------------------------------------------------------
  // Facial AU analysis: keep the strongest AU4 and AU7 seen while the participant speaks.
  // ---------------------------------------------------------------

  // Platform helper functions: webcam, biofeedback (AU analysis) and wait.
  const helpers = context.helpers;

  // Strongest reading of each watched AU during the current listen,
  // for example { "4": 31.2, "7": 12.0 }. This is the facial input to evaluateCheckIn().
  let peak = {};

  // Most recent single-frame reading, in the same shape as peak.
  let latest = {};

  // Sets every watched AU in peak back to 0 at the start of a trial.
  const resetPeak = () => {
    peak = {};
    CONFIG.facialAUs.forEach((id) => { peak[id] = 0; });
  };
  resetPeak();

  // Turns one analyzer result into { "4": n, "7": n }: the strongest intensity per watched AU.
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

  // Reads the camera over and over until Stop. Each pass waits for the previous analysis to
  // finish, so slow frames never pile up. While listening, it raises peak to the highest
  // reading seen.
  async function analysisLoop() {
    // Analyzer name: the platform setting if present, then config.json, then "pyfeat".
    const engine =
      (context.settings && context.settings.biofeedbackEngine) ||
      config.biofeedbackEngine ||
      "pyfeat";
    while (!stopped) {
      try {
        const result = await helpers.biofeedback.analyzeVideo(camera.video, engine);
        if (stopped) return;
        if (result && result.aus) {
          latest = extractCueAUs(result.aus);
          if (listening) {
            CONFIG.facialAUs.forEach((id) => {
              peak[id] = Math.max(peak[id], latest[id]);
            });
          }
        }
      } catch (err) {
        console.error("AU analysis failed:", err);
        // Pause briefly so a repeating error does not spin the loop.
        await helpers.wait(500);
      }
      // Short pause between frames.
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
    onInterim = (text) => { if (!stopped) setStatus("Hearing: \"" + text + "\""); };

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
  // One trial: listen to the line while tracking peak AU4 / AU7, decide, then maybe check in.
  // ---------------------------------------------------------------
  listenButton.addEventListener("click", async () => {
    if (busy || stopped) return;
    busy = true;
    listenButton.disabled = true;
    try {
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
        metrics.record("trigger_decision", "no_speech", "peak_au4=" + peak["4"] + ";peak_au7=" + peak["7"]);
        return;
      }

      // Apply the rule. The facial cue is the peak AU intensity during the listen, compared
      // with the threshold in CONFIG; the verbal cue is a phrase match on the transcript.
      const result = evaluateCheckIn({ aus: peak, transcript });

      setStatus(
        "Heard: \"" + transcript + "\" | AU4 peak " + peak["4"].toFixed(1) +
        ", AU7 peak " + peak["7"].toFixed(1) +
        " | Facial: " + result.facialCue + ", Verbal: " + result.verbalCue +
        " -> " + (result.shouldTrigger ? "CHECK IN" : "DO NOT CHECK IN")
      );

      // Log the decision with its inputs. The spoken sentence itself is not logged.
      metrics.record(
        "trigger_decision",
        result.shouldTrigger ? "check_in" : "no_check_in",
        "facial=" + result.facialCue +
          ";verbal=" + result.verbalCue +
          ";peak_au4=" + peak["4"] +
          ";peak_au7=" + peak["7"] +
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
      listening = false;
      busy = false;
      if (!stopped) listenButton.disabled = false;
    }
  });

  // ---------------------------------------------------------------
  // Setup: start the camera and the recognizer, then begin reading the face.
  // ---------------------------------------------------------------
  try {
    if (!helpers?.webcam || !helpers?.biofeedback) {
      throw new Error("helpers.webcam / helpers.biofeedback not exposed on context.helpers (see console)");
    }
    camera = await helpers.webcam.start(
      (context.containerRef && context.containerRef.current) || camHost,
      { overlay: true, width: 420, height: 315 }
    );
    if (stopped) return;

    recognizer = new AudioToText();
    await recognizer.initializeRecognizer();
    if (stopped) return;

    // Runs in the background until Stop, so it is deliberately not awaited.
    analysisLoop();
    listenButton.disabled = false;
    setStatus("Ready. Click Start trial, then have the participant say the line.");
  } catch (err) {
    console.error("Webcam/recognizer setup failed:", err);
    setStatus("Setup failed: " + (err && err.message ? err.message : err) + " (manual Check In still works)");
  }

  // ---------------------------------------------------------------
  // Participant response: Pause or Continue, answering the most recent check-in once.
  // ---------------------------------------------------------------
  async function handleResponse(response) {
    if (!awaitingResponse || !strategy || stopped) return;
    awaitingResponse = false;
    pause.disabled = true;
    continueButton.disabled = true;
    // The strategy says whether it accepts the response and what the agent replies if it does not.
    const outcome = strategy.handleUserResponse(response);
    metrics.record(
      "user_response",
      outcome.accepted ? "accepted" : "rejected",
      response
    );
    if (!outcome.accepted) {
      await context.agent.speak(outcome.reply);
    }
  }
  pause.addEventListener("click", () => handleResponse("pause"));
  continueButton.addEventListener("click", () => handleResponse("continue"));

  // Keep run() open until the platform signals cleanup, so the buttons stay active.
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
