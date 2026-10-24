
/* Pure eEVA-compatible browser JS. NO Node built-ins, no emotion categories. */
function normalizeAUs(frame, ids) {
  const raw = frame && typeof frame === 'object' ? frame : {};
  const output = {};
  for (const id of ids) {
    const value = raw[id] ?? raw['AU' + id] ?? raw['AU' + id + '_r'] ?? raw['AU' + id + '_intensity'];
    const number = Number(value);
    output[id] = value === undefined || value === null || value === '' || !Number.isFinite(number)
      ? null : number;
  }
  return output;
}

const CUES = [
  {id:'sad_self_report', re:/\b(?:i'm|i am|i feel|i've been feeling|i have been feeling|i am feeling)\s+(?:(?:really|very|so|pretty)\s+)?sad\b/i},
  {id:'feeling_down', re:/\b(?:i'm|i am|i feel|i've been|i have been)\s+(?:really\s+)?feeling down\b|\bi feel down\b/i},
  {id:'overwhelmed', re:/\boverwhelm(?:ed|ing)?\b/i},
  {id:'stressed', re:/\bstress(?:ed|ful)?\b/i},
  {id:'worried', re:/\bworr(?:y|ied|ying)\b/i},
  {id:'anxious', re:/\banxious\b/i},
  {id:'frustrated', re:/\bfrustrat(?:ed|ing|ion)\b/i},
  {id:'upset', re:/\bupset\b/i},
  {id:'struggling', re:/\bstruggl(?:e|es|ing)\b/i},
  {id:'difficult', re:/\b(?:hard|rough|difficult|bad)\s+(?:week|day|time)\b/i},
  {id:'falling_behind', re:/\bfalling behind\b/i},
  {id:'having_trouble', re:/\b(?:having trouble|having a hard time)\b/i},
  {id:'under_pressure', re:/\bunder pressure\b/i},
  {id:'exhausted', re:/\b(?:exhausted|burned out|burnt out)\b/i}
];

function detectVerbalCue(transcript) {
  const text = String(transcript || '').replace(/\s+/g, ' ').trim();
  const matched = CUES.filter(x => x.re.test(text)).map(x => x.id);

  const deniesCurrentConcern = /\b(?:not|never|no longer|don't feel|do not feel|wasn't|isn't)\s+(?:very\s+|really\s+|that\s+)?(?:stressed|worried|anxious|overwhelmed|upset|frustrated|exhausted|struggling)\b/i.test(text);

  const deniesSadness = /\b(?:i'm|i am)\s+(?:not|never)\s+(?:(?:really|very)\s+)?sad\b|\bi\s+(?:do not|don't)\s+feel\s+sad\b|\bi\s+(?:am not|don't feel|do not feel)\s+(?:feeling\s+)?down\b/i.test(text);

  const reportedOtherPerson = /\b(?:my friend|my sibling|my roommate|my classmate|he|she|they)\s+(?:is|was|felt|feels)\s+(?:stressed|worried|anxious|overwhelmed|upset)\b/i.test(text);

  return {
    active: matched.length > 0 &&
      !deniesCurrentConcern &&
      !deniesSadness &&
      !reportedOtherPerson,
    matched,
    excludes: (deniesCurrentConcern || deniesSadness)
      ? 'negation'
      : reportedOtherPerson
        ? 'other_person'
        : null
  };
}

class TriggerController {
  constructor(settings) {
    this.settings = settings;
    this.frames = [];
    this.lastTriggered = -Infinity;
    this.enabled = true;
  }

  addFrame(frame, at = Date.now()) {
    const f = this.settings.facial;
    const values = normalizeAUs(frame, f.auIds);
    const valid = f.auIds.some(id => values[id] !== null);
    const positive = f.auIds.some(
      id => values[id] !== null && values[id] >= f.threshold
    );

    this.frames.push({ at, valid, positive, values });
    this.frames = this.frames.filter(
      x => at - x.at >= 0 && at - x.at <= f.windowMs
    );

    return { valid, positive, values };
  }

  evaluate(transcript, at = Date.now()) {
    const f = this.settings.facial;
    this.frames = this.frames.filter(
      x => at - x.at >= 0 && at - x.at <= f.windowMs
    );

    const facialSamples = this.frames.filter(
      x => x.valid && x.positive
    ).length;

    const face = facialSamples >= f.requiredPositiveSamples;
    const verbal = detectVerbalCue(transcript);
    const cooldown =
      at - this.lastTriggered >= this.settings.cooldownMs;

    const shouldCheckIn =
      this.enabled && face && verbal.active && cooldown;

    if (shouldCheckIn) this.lastTriggered = at;

    return {
      shouldCheckIn,
      facialCue: face,
      verbalCue: verbal.active,
      facialPositiveSamples: facialSamples,
      verbalMatched: verbal.matched,
      verbalExclusion: verbal.excludes,
      cooldownReady: cooldown,
      reason: shouldCheckIn
        ? 'both_cues'
        : !this.enabled
          ? 'paused'
          : !face
            ? 'facial_not_confirmed'
            : !verbal.active
              ? 'verbal_not_confirmed'
              : 'cooldown'
    };
  }

  clearFrames() {
    this.frames = [];
  }
}

module.exports = {
  normalizeAUs,
  detectVerbalCue,
  TriggerController
};
