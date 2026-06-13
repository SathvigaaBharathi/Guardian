export function buildAlertPrompt(params: {
  anomalyType: string;
  timeStr: string;
  timeBin: number;
  missingEvents: string[];
  observedEvents: string[];
  score: number;
  exactTime: string;
}): string {
  const { anomalyType, timeStr, missingEvents, observedEvents, score, exactTime } = params;
  const expectedStr = missingEvents.length
    ? missingEvents.join(', ')
    : 'normal routine activity';
  const observedStr = observedEvents.length
    ? observedEvents.join(', ')
    : 'silence';

  return `You are Guardian, a home safety monitoring agent for an elderly person living alone.
An anomaly has been detected. Write ONE clear, calm alert sentence for the family member.
Do not be alarmist. Be specific about what was expected vs what was observed.
You MUST explicitly state the exact local time of the event (e.g., "at ${exactTime}") inside the alert sentence itself.
Do not include any preamble, explanation, or punctuation beyond the sentence itself.

Anomaly type: ${anomalyType}
Time: ${exactTime}
Expected activity: ${expectedStr}
Observed activity: ${observedStr}
Anomaly score: ${score.toFixed(1)} (higher = more unusual)`;
}
