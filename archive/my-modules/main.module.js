/**
 * Team 3.2 - Context-Aware Empathic Check-In (eEVA My Modules, guide start()/stop() form)
 *
 * Single-file module. My Modules cannot require() other files, so the decision logic
 * below is a verbatim copy of trigger.js v0.3 (sections 1-5, without the Node CLI).
 * If trigger.js changes, update this copy too, or counted trials will not match.
 *
 * Flow: start camera + recognizer -> chained analysis loop tracks PEAK AU4/AU7 ->
 * experimenter clicks "Start trial" -> listenOnce() captures the line ->
 * evaluateCheckIn({aus: peak, transcript}) -> if it fires, the agent speaks the check-in.
 */

// =====================================
// Settings (replaces config.json)
// =====================================

const SETTINGS = {
  strategy: "tentative_uncertainty",
  biofeedbackEngine: "pyfeat",
};

// PLACEHOLDER wording: replace with the final VR-CoDES-P strategy utterances.
// Code chooses the move; the LLM is not used for control flow (guide Sec. 7.1).
const UTTERANCES = {
  tentative_uncertainty:
    "I might be reading this wrong, but it sounds like things have been hard. " +
    "Would you like to talk about it, take a break, or keep going?",
};

// =====================================
// trigger.js v0.3 (frozen logic, copied verbatim)
// =====================================

const CONFIG = {
  auThreshold: 45, // Provisional, not calibrated

  facialAUs: ["4", "7"],

  distressPhrases: [
    "stressed",
    "stressful",
    "overwhelmed",
    "frustrated",
    "worried",
    "anxious",
    "upset",
    "struggling",
    "having a hard time",
    "difficult time",
    "difficult week",
    "rough week",
    "rough day",
    "bad day",
    "exhausted",
    "burned out",
    "burnt out",
    "falling behind",
    "under pressure",
    "having trouble",
    "feeling down",
    "not doing well",
    "can't keep up",
    "cannot keep up",
    "too much to handle",
    "need help",
    "sad",
    "depressed",
    "anxious"
  ],

  checkInStrategy: "tentative_uncertainty"
};

function detectFacialCue(aus) {
  const matchedAUs = CONFIG.facialAUs.filter(
    id => Number.isFinite(aus[id]) &&
          aus[id] >= CONFIG.auThreshold
  );

  return {
    detected: matchedAUs.length > 0,
    matchedAUs
  };
}

function detectBinaryFacialCue(annotations) {
  const matchedAUs = CONFIG.facialAUs.filter(
    id => annotations[id] === true
  );

  return {
    detected: matchedAUs.length > 0,
    matchedAUs
  };
}

function detectVerbalCue(transcript) {
  const text = String(transcript)
    .toLowerCase()
    .replace(/[’]/g, "'");

  const matchedPhrases = CONFIG.distressPhrases.filter(
    phrase => {
      const escaped = phrase.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const regex = new RegExp(
        `(^|[^a-z])${escaped}(?=$|[^a-z])`,
        "i"
      );

      return regex.test(text);
    }
  );

  return {
    detected: matchedPhrases.length > 0,
    matchedPhrases
  };
}

function evaluateCheckIn({
  aus,
  annotations,
  transcript
}) {
  const facial = annotations !== undefined
    ? detectBinaryFacialCue(annotations)
    : detectFacialCue(aus || {});

  const verbal = detectVerbalCue(transcript);

  const shouldTrigger =
    facial.detected && verbal.detected;

  return {
    facialCue: facial.detected,
    verbalCue: verbal.detected,
    matchedAUs: facial.matchedAUs,
    matchedPhrases: verbal.matchedPhrases,
    shouldTrigger
  };
}

// =====================================
// Module-scope resources so stop() can reach them (guide Sec. 3.3)
// =====================================

let voice = null;
let recognizer = null;
let camera = null;
let panel = null;
let silenceTimer = null;
let listenLimitTimer = null;
let finishListening = null;
let stopped = false;

// ---- Trial log: in memory, echoed to console, exported with the CSV button ----
const eventLog = [];
function record(event, value, detail) {
  const row = { time: new Date().toISOString(), event, value, detail: detail || "" };
  eventLog.push(row);
  console.log("[metric]", row);
}
function downloadLog() {
  const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const csv = ["time,event,value,detail"]
    .concat(eventLog.map((r) => [r.time, r.event, r.value, r.detail].map(esc).join(",")))
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = "team3-2-trial-log.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

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

// =====================================
// Required entry point (guide Sec. 3.1)
// =====================================

export async function start(animationManager, settings, containerRef, toast) {
  stopped = false; // reset on every run (guide Sec. 3.4)

  voice = VoiceManager.getInstance(animationManager, true);

  let awaitingResponse = false;
  let listening = false;
  let busy = false;
  let peak = {};
  let latest = {};
  const resetPeak = () => {
    peak = {};
    CONFIG.facialAUs.forEach((id) => { peak[id] = 0; });
  };
  resetPeak();

  // ---- Controls ----
  panel = document.createElement("section");
  panel.style.cssText =
    "margin:12px auto; width:min(620px,calc(100% - 48px)); padding:18px; " +
    "border-radius:10px; background:white; color:#183322;";
  const makeButton = (label, disabled) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.disabled = Boolean(disabled);
    return b;
  };
  const prompt = document.createElement("p");
  prompt.textContent = "Preview";
  const statusLine = document.createElement("p");
  statusLine.textContent = "Starting camera and microphone...";
  const camHost = document.createElement("div"); // preview host if containerRef.current is missing
  const listenButton = makeButton("Start trial (listen + read face)", true);
  const checkInButton = makeButton("Check In");
  const pauseButton = makeButton("Pause", true);
  const continueButton = makeButton("Continue / correct the agent", true);
  const logButton = makeButton("Download log (CSV)");
  panel.append(prompt, statusLine, camHost, listenButton, checkInButton, pauseButton, continueButton, logButton);
  (containerRef?.current || document.body).appendChild(panel);

  const setStatus = (text) => {
    statusLine.textContent = text;
    settings.labelElement?.(text);
  };

  // ---- Check-in ----
  async function runCheckIn(triggerSource) {
    const utterance = UTTERANCES[SETTINGS.strategy];
    if (!utterance) throw new Error("Unknown check-in strategy: " + SETTINGS.strategy);

    prompt.textContent = utterance;
    record("check_in_strategy", SETTINGS.strategy, "trigger_source=" + triggerSource);

    // Await speech before anything listens, so the microphone never captures the agent.
    await voice.enqueueText(utterance);
    if (stopped) return;

    awaitingResponse = true;
    pauseButton.disabled = false;
    continueButton.disabled = false;
  }

  // Manual override bypasses the trigger gate: do NOT use during counted trials.
  checkInButton.addEventListener("click", async () => {
    if (busy || stopped) return;
    busy = true;
    listenButton.disabled = true;
    try {
      // Logged as "manual" so these never mix with gated check-ins in the log.
      await runCheckIn("manual");
    } catch (err) {
      console.error("Manual check-in failed:", err);
      setStatus("Check-in error: " + (err && err.message ? err.message : err));
    } finally {
      busy = false;
      if (!stopped && camera && recognizer) listenButton.disabled = false;
    }
  });

  // Pause / Continue answer the most recent check-in.
  function handleResponse(response) {
    if (!awaitingResponse || stopped) return;
    awaitingResponse = false;
    pauseButton.disabled = true;
    continueButton.disabled = true;
    record("user_response", response, "");
    setStatus(response === "pause" ? "Paused by participant." : "Participant chose to continue.");
  }
  pauseButton.addEventListener("click", () => handleResponse("pause"));
  continueButton.addEventListener("click", () => handleResponse("continue"));
  logButton.addEventListener("click", downloadLog);

  // ---- Webcam AU analysis (guide Sec. 6.2 and 6.3) ----
  // Reduce the analyzer's output to {"4": n, "7": n} (strongest L/R variant).
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
    const engine = settings.biofeedbackEngine || SETTINGS.biofeedbackEngine;
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

  // ---- One trial = listen for the spoken line while tracking peak AU4/AU7 ----
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
        record("trigger_decision", "no_speech", "peak_au4=" + peak["4"] + ";peak_au7=" + peak["7"]);
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
      record(
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

  // ---- Start camera + recognizer (guide Sec. 6.1 and 6.2) ----
  try {
    camera = await helpers.webcam.start(
      containerRef?.current || camHost,
      { overlay: true, width: 420, height: 315 }
    );
    if (stopped) return;

    recognizer = new AudioToText();
    await recognizer.initializeRecognizer();
    if (stopped) return;

    listenButton.disabled = false;
    setStatus("Ready. Click Start trial, then have the participant say the line.");
    toast?.("Camera and microphone ready.");
  } catch (err) {
    console.error("Webcam/recognizer setup failed:", err);
    setStatus("Setup failed: " + (err && err.message ? err.message : err) + " (manual Check In still works)");
    return;
  }

  // Runs until stopped, so start() stays pending like the guide's biofeedback template.
  await analysisLoop();
}

// =====================================
// Required exit point (guide Sec. 3.1 and 9.1)
// =====================================

export function stop(animationManager, settings, containerRef) {
  stopped = true;
  finishListening?.();
  window.clearTimeout(silenceTimer);
  window.clearTimeout(listenLimitTimer);
  recognizer?.stopRecognition();
  voice?.stopSpeech();
  camera?.stop();
  panel?.remove();
  panel = null;
  animationManager.clearScheduledChanges?.();
  animationManager.setFaceToNeutral(500);
  settings.labelElement?.("Stopped.");
}
