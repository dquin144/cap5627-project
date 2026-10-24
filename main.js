// eEVA Project Studio entry point. The project checker parses src/main.js as CommonJS, so
// ES module syntax is rejected; it requires module.exports.run(context) and
// module.exports.stop(context). A My Modules version in the guide's start()/stop() form
// is kept in archive/my-modules/main.module.js.
const config = require("./config.json");
// trigger.js (Node CLI, frozen) requires node:readline, which eEVA cannot load. The same
// decision logic lives in trigger-core.js, a verbatim copy of its sections 1-5.
const { CONFIG, evaluateCheckIn } = require("./trigger-core.js");

// ---- Module-scope resources so stop() can reach them (guide Sec. 3.3) ----
let recognizer = null;
let camera = null;
let silenceTimer = null;
let listenLimitTimer = null;
let finishListening = null;
let stopped = false;

// ---- Listen-once helper, copied unchanged from the guide (Sec. 6.1) ----
function listenOnce(silenceMs = 1200, maxWaitMs = 8000) {
  return new Promise((resolve) => {
    let latest = "";
    let finished = false;

    finishListening = () => {
      if (finished) return;          // Resolve exactly once.
      finished = true;
      window.clearTimeout(silenceTimer);
      window.clearTimeout(listenLimitTimer);
      recognizer.stopRecognition();
      finishListening = null;
      resolve(latest.trim());
    };

    recognizer.startContinuousRecognition((transcript) => {
      latest = transcript || "";
      window.clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(finishListening, silenceMs);
    });

    // Resolve with "" if no speech arrives at all.
    listenLimitTimer = window.setTimeout(finishListening, maxWaitMs);
  });
}

module.exports.run = async function run(context) {
  stopped = false; // reset on every run (guide Sec. 3.4)

  // Shows exactly which helpers this project exposes (webcam, biofeedback, wait, ...)
  console.log("project helpers:", Object.keys(context.helpers?.project || {}));
  console.log("helpers:", Object.keys(context.helpers));
  console.log("context:", Object.keys(context));

  const metrics = context.metrics.create("distress-check-in");

  const panel = document.createElement("section");
  panel.style.cssText =
    "bottom:24px; left:50%; width:min(620px,calc(100% - 48px)); " +
    "transform:translateX(-50%); padding:18px; border-radius:10px; " +
    "background:white; color:#183322;";
  const prompt = document.createElement("p");
  prompt.textContent = "Preview";
  const pause = document.createElement("button");
  pause.type = "button";
  pause.textContent = "Pause";
  const continueButton = document.createElement("button");
  continueButton.type = "button";
  continueButton.textContent = "Continue / correct the agent";
  // Enabled only after a check-in has been spoken (see runCheckIn).
  pause.disabled = true;
  continueButton.disabled = true;
  let awaitingResponse = false;

  const checkInButton = document.createElement("button");
  checkInButton.type = "button";
  checkInButton.textContent = "Check In";

  // ---- Trial controls and status ----
  const listenButton = document.createElement("button");
  listenButton.type = "button";
  listenButton.textContent = "Start trial (listen + read face)";
  listenButton.disabled = true; // enabled once camera and recognizer are ready

  const statusLine = document.createElement("p");
  statusLine.textContent = "Starting camera and microphone...";
  const setStatus = (text) => {
    statusLine.textContent = text;
    context.settings?.labelElement?.(text); // optional, as in the guide
  };

  // Fallback host for the camera preview if the project exposes no containerRef.
  const camHost = document.createElement("div");

  let strategy = null;
  let listening = false;
  let busy = false;

  panel.append(prompt, statusLine, camHost, listenButton, checkInButton, pause, continueButton);
  context.ui.mountOverlay(panel);

  // ---------------------------------------------------------------
  // Shared check-in path, parameterized on the trigger source
  // ---------------------------------------------------------------
  async function runCheckIn(triggerSource) {
    // 1. Create selected strategy
    strategy = context.helpers.project.createCheckInStrategy(
      config.strategy
    );

    // 2. Generate check-in using same trigger source and confidence
    // NOTE: still passes config.triggerSource, since I don't know whether
    // getUtterance validates this value. The real source is logged below.
    const utterance = strategy.getUtterance({
      triggerSource: config.triggerSource,
      confidence: config.sampleConfidence,
    });

    // 3. Display generated utterance in Preview
    prompt.textContent = utterance;

    // 4. Log selected strategy
    metrics.record(
      "check_in_strategy",
      config.strategy,
      "trigger_source=" + triggerSource
    );

    await context.agent.speak(utterance);
    if (stopped) return;

    // 5. Accept one Pause / Continue response for this check-in
    awaitingResponse = true;
    pause.disabled = false;
    continueButton.disabled = false;
  }

  // Manual override bypasses the trigger gate: do NOT use during counted trials.
  checkInButton.addEventListener("click", async () => {
    if (busy || stopped) return;
    busy = true;
    listenButton.disabled = true;
    try {
      // Logged as "manual" so these never mix with gated check-ins in the metrics.
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
  // Webcam + AU analysis (guide Sec. 6.2 and 6.3)
  // ---------------------------------------------------------------
  const helpers = context.helpers;
  let peak = {};
  let latest = {};
  const resetPeak = () => {
    peak = {};
    CONFIG.facialAUs.forEach((id) => { peak[id] = 0; });
  };
  resetPeak();

  // Reduce the analyzer's output to {"4": n, "7": n} (strongest L/R variant),
  // the same shape trigger.js expects.
  function extractCueAUs(aus) {
    const out = {};
    CONFIG.facialAUs.forEach((id) => { out[id] = 0; });
    const entries = helpers.biofeedback.getTopAUs(aus, 60) || [];
    for (const item of entries) {
      // Strip letters (L/R suffix, "AU" prefix) and leading zeros: "AU04" -> "4".
      const id = String(parseInt(String(item.au).replace(/\D/g, ""), 10));
      if (id in out) out[id] = Math.max(out[id], Number(item.intensity) || 0);
    }
    return out;
  }

  // Chained loop, not setInterval (guide Sec. 6.3).
  async function analysisLoop() {
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
        await helpers.wait(500); // avoid a tight error loop
      }
      await helpers.wait(120);
      if (stopped) return;
    }
  }

  // ---------------------------------------------------------------
  // One trial = listen for the spoken line while tracking peak AU4/AU7
  // ---------------------------------------------------------------
  listenButton.addEventListener("click", async () => {
    if (busy || stopped) return;
    busy = true;
    listenButton.disabled = true;
    try {
      resetPeak();
      listening = true;
      setStatus("Listening... say the line now.");
      const transcript = await listenOnce();
      listening = false;
      if (stopped) return;

      if (!transcript) {
        setStatus("No speech detected. Click Start trial to retry.");
        metrics.record("trigger_decision", "no_speech", "peak_au4=" + peak["4"] + ";peak_au7=" + peak["7"]);
        return;
      }

      // Facial cue = peak AU intensity during the listening window (numeric mode of trigger.js)
      const result = evaluateCheckIn({ aus: peak, transcript });

      setStatus(
        "Heard: \"" + transcript + "\" | AU4 peak " + peak["4"].toFixed(1) +
        ", AU7 peak " + peak["7"].toFixed(1) +
        " | Facial: " + result.facialCue + ", Verbal: " + result.verbalCue +
        " -> " + (result.shouldTrigger ? "CHECK IN" : "DO NOT CHECK IN")
      );

      // Flags, matches and measured AU peaks only; the raw sentence is not logged.
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
  // Start camera + recognizer (guide Sec. 6.1 and 6.2)
  // ---------------------------------------------------------------
  try {
    if (!helpers.webcam || !helpers.biofeedback) {
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

    analysisLoop(); // runs until stopped; intentionally not awaited
    listenButton.disabled = false;
    setStatus("Ready. Click Start trial, then have the participant say the line.");
  } catch (err) {
    console.error("Webcam/recognizer setup failed:", err);
    setStatus("Setup failed: " + (err && err.message ? err.message : err) + " (manual Check In still works)");
  }

  // Pause / Continue answer the most recent check-in.
  async function handleResponse(response) {
    if (!awaitingResponse || !strategy || stopped) return;
    awaitingResponse = false;
    pause.disabled = true;
    continueButton.disabled = true;
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

  // Keep run() alive until Stop.
  await new Promise((resolve) => context.onCleanup(() => resolve()));
};

module.exports.stop = async function stop(context) {
  // Release everything this module created (guide Sec. 9.1)
  stopped = true;
  finishListening?.();
  window.clearTimeout(silenceTimer);
  window.clearTimeout(listenLimitTimer);
  recognizer?.stopRecognition();
  camera?.stop();
  context.agent.stopSpeaking();
  context.agent.neutral();
  context.ui.clear();
};
