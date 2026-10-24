/* Wording condition is assigned by config, not chosen opportunistically by the LLM. */
const CONDITIONS=['explicit_space','nonexplicit_space'];
function normalizeTranscript(text){return String(text||'').replace(/\s+/g,' ').trim().slice(0,250);}
function makePrompt(transcript,condition){
  if(!CONDITIONS.includes(condition))throw new Error('Unknown condition: '+condition);
  const context=normalizeTranscript(transcript);
  const instruction=condition==='explicit_space'
    ? 'Explicit acknowledgment: briefly refer to the concern the person actually stated. Do not infer their emotion from facial data.'
    : 'Non-explicit acknowledgment: do not repeat the user\'s named concern or inferred emotion; use a general invitation to share.';
  return {
    system:[
      'You are eEVA, a research conversational agent. Write exactly ONE gentle check-in, <=35 words.',
      instruction,
      'Provide space to disclose, but do not pressure the user.',
      'Offer the same three choices in BOTH conditions: share more, take a break, or continue.',
      'Do not diagnose, prescribe, give advice, claim to know the person\'s emotion, or mention facial movements.',
      'Return ONLY the spoken line. Avoid quotation marks around your entire response.'
    ].join(' '),
    user:'Most recent user statement: '+context
  };
}
function deterministicUtterance(transcript,condition){
  if(condition==='explicit_space'){
    const line=normalizeTranscript(transcript).replace(/[.!?]+$/,'');
    if(line.length>0 && line.length<=95) return `You mentioned, “${line}.” Would you like to share more, take a break, or continue?`;
    return 'You mentioned something challenging. Would you like to share more, take a break, or continue?';
  }
  return 'Would you like to share a little more, take a break, or continue?';
}
function validateOutput(output){
  const text=String(output||'').trim();
  if(!text || text.split(/\s+/).length>35 || /\b(?:you are (?:sad|angry|depressed)|your face|facial expression|diagnos)\b/i.test(text))return null;
  if(!/\b(?:break|pause)\b/i.test(text) || !/\bcontinu(?:e|ing)\b/i.test(text)) return null;
  return text;
}
function classifyResponse(input){
  const text=String(input||'').toLowerCase();
  const rejectsBreak=/\b(?:don\'t|do not|no|not)\s+(?:want|need|take|have)\s+(?:a\s+)?(?:break|pause|rest)\b/.test(text);
  if(!rejectsBreak && /\b(?:pause|break|rest|stop for now|take a moment)\b/.test(text)) return 'pause';
  if(/\b(?:continue|keep going|go ahead|move on|next question|i(?:'| a)?m (?:fine|okay|ok))\b/.test(text))return 'continue';
  if(/\b(?:that(?:'s| is) not right|not really|you(?:'re| are) wrong|not how i feel|incorrect)\b/.test(text))return 'correction';
  if(/\b(?:talk|share more|tell you more)\b/.test(text))return 'share';
  return null;
}
module.exports={makePrompt,deterministicUtterance,validateOutput,classifyResponse};
