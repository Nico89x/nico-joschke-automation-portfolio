const ambiguity = /\b(?:undecided|conflict(?:ing)?|contradict(?:ory|s)?|has not resolved|not confirmed which (?:event|source|trigger)|has not said which (?:event|source|trigger)|not known which (?:event|source|trigger)|either\b.{0,80}\bor\b|ungeklärt|unklar|widersprüchlich|nicht geklärt|nicht bestätigt)\b/i;

const triggerSignals = {
  webhook: /\b(?:webhooks?|http callbacks?|signed http post(?: events?| requests?)?|signed post events?|signed (?:file-ready )?callbacks?)\b/i,
  email: /\b(?:new|incoming|received|receives|arrive|arrives|arriving)\b.{0,100}\b(?:e-?mails?|messages?|mailbox|inbox)\b|\b(?:mailbox|inbox)\b.{0,70}\b(?:receives?|new|incoming|arriv(?:es|ing))\b/i,
  schedule: /\b(?:every (?:weekday|day|night|hour|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d+\s+(?:minutes?|hours?))|(?:on the )?(?:first|last) (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|calendar day) of each (?:month|quarter)|once each night|hourly|daily|weekly|monthly|each night|jeden?\s+(?:werktag|tag|abend|nacht|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|alle\s+\d+\s+(?:minuten|stunden)|täglich|wöchentlich|monatlich)\b/i,
  manual: /\b(?:clicks?|presses?)\b.{0,70}\b(?:start|run|prepare|generate|check|button|preview)\b|\b(?:manually starts?|operator starts?)\b/i,
};

export function resolveExplicitTrigger(processDescription) {
  if (typeof processDescription !== 'string' || ambiguity.test(processDescription) ||
      /\b(?:no|without|lacks|unsupported|unconfirmed|not confirmed|may not support|do not support|hopes?|might|perhaps|potentially)\b.{0,70}\bwebhooks?\b|\bwebhooks?\b.{0,70}\b(?:unconfirmed|not confirmed|not known|uncertain|whether|may|might)\b/i.test(processDescription)) return null;
  const matches = Object.entries(triggerSignals)
    .filter(([, pattern]) => pattern.test(processDescription))
    .map(([triggerType]) => triggerType);
  return matches.length === 1 ? matches[0] : null;
}
