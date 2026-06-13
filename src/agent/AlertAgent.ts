import { Anomaly, Alert, AlertSeverity, NetworkLogEntry } from '../types';
import { buildAlertPrompt } from './prompts';

function getSeverity(anomaly: Anomaly): AlertSeverity {
  if (anomaly.anomalyType === 'fall' || anomaly.anomalyType === 'distress') return 'critical';
  if (anomaly.score > 5) return 'high';
  if (anomaly.score > 3) return 'medium';
  return 'low';
}

function timeBinToString(bin: number): string {
  const totalMinutes = bin * 30;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

async function sendTwilioSMS(body: string, onNetworkLog: (entry: NetworkLogEntry) => void) {
  const sid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const token = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  const from = import.meta.env.VITE_TWILIO_FROM_NUMBER;
  const to = import.meta.env.VITE_TWILIO_TO_NUMBER;

  if (!sid || !token || !from || !to) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const requestBody = new URLSearchParams({ To: to, From: from, Body: body }).toString();

  // Log to PrivacyProof - proves text metadata only (no audio)
  onNetworkLog({
    timestamp: Date.now(),
    url,
    method: 'POST',
    bodyPreview: `To=${to}&Body=${body.substring(0, 80)}`,
    containsAudio: false,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
      },
      body: requestBody,
    });
    if (response.ok) {
      console.log('Twilio SMS sent successfully!');
    } else {
      console.error('Twilio SMS response error:', await response.text());
    }
  } catch (e) {
    console.error('Failed to send Twilio SMS:', e);
  }
}

async function sendTwilioWhatsApp(body: string, onNetworkLog: (entry: NetworkLogEntry) => void) {
  const sid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const token = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  const from = import.meta.env.VITE_TWILIO_WHATSAPP_FROM || import.meta.env.VITE_TWILIO_FROM_NUMBER;
  const to = import.meta.env.VITE_TWILIO_WHATSAPP_TO || import.meta.env.VITE_TWILIO_TO_NUMBER;

  if (!sid || !token || !from || !to) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const formattedFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const requestBody = new URLSearchParams({ To: formattedTo, From: formattedFrom, Body: body }).toString();

  // Log to PrivacyProof - proves text metadata only (no audio)
  onNetworkLog({
    timestamp: Date.now(),
    url,
    method: 'POST',
    bodyPreview: `To=${formattedTo}&Body=${body.substring(0, 80)}`,
    containsAudio: false,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
      },
      body: requestBody,
    });
    if (response.ok) {
      console.log('Twilio WhatsApp sent successfully!');
    } else {
      console.error('Twilio WhatsApp response error:', await response.text());
    }
  } catch (e) {
    console.error('Failed to send Twilio WhatsApp:', e);
  }
}

export async function generateAlert(
  anomaly: Anomaly,
  apiKey: string,
  onNetworkLog: (entry: NetworkLogEntry) => void
): Promise<Alert> {
  const severity = getSeverity(anomaly);
  const timeStr = timeBinToString(anomaly.timeBin);
  
  // Capture exact local time (e.g. 03:43:10 PM)
  const exactTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const prompt = buildAlertPrompt({
    anomalyType: anomaly.anomalyType,
    timeStr,
    timeBin: anomaly.timeBin,
    missingEvents: anomaly.missingEvents,
    observedEvents: anomaly.observedEvents,
    score: anomaly.score,
    exactTime,
  });

  let llmText = `Anomaly detected at ${exactTime} — please check in.`;

  // Try UI-entered apiKey first, then fall back to Vite environment variable
  const finalApiKey = apiKey || (import.meta.env.VITE_GROQ_API_KEY as string) || '';

  if (finalApiKey) {
    const requestBody = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    });

    // Log this request for the PrivacyProof component — proves no audio in body
    onNetworkLog({
      timestamp: Date.now(),
      url: 'https://api.groq.com/openai/v1/chat/completions',
      method: 'POST',
      bodyPreview: requestBody.substring(0, 120),
      containsAudio: false, // always false — body is text only
    });

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalApiKey}`,
        },
        body: requestBody,
      });
      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        llmText = data.choices[0].message.content.trim();
      }
    } catch (error) {
      console.error('Groq Alert Generation Failed:', error);
    }
  }

  // Define default/fallback reasoning points
  const expectedText = anomaly.missingEvents.length 
    ? anomaly.missingEvents.join(', ').replace(/_/g, ' ') 
    : 'normal routine activity';
  const observedText = anomaly.observedEvents.length 
    ? anomaly.observedEvents.join(', ').replace(/_/g, ' ') 
    : 'silence';

  let reasoning: string[] = [
    `Anomaly detection score is ${anomaly.score.toFixed(1)}, reflecting a distinct routine deviation.`,
    `Expected "${expectedText}" at this binned window, but microphone registered "${observedText}".`,
    `Flagged immediately by Guardian's local acoustic Markov transition analyzer.`
  ];

  // Request secondary Chain-of-Thought reasoning explanation from LLM
  if (finalApiKey) {
    const reasoningPrompt = `You are Guardian, an AI safety agent. Explain why the following home safety alert was triggered.
Analyze the expected baseline vs what was actually observed at this time.
Write exactly 2 or 3 bullet points explaining the routine deviation (e.g. "occupant is usually awake and cooking at this hour, but complete silence was observed").
Do not include any greeting, preamble, or markdown titles. Use simple dash "-" bullet points.

Anomaly type: ${anomaly.anomalyType}
Time: ${exactTime}
Expected routine: ${expectedText}
Observed sounds: ${observedText}
KL Score: ${anomaly.score.toFixed(2)}`;

    onNetworkLog({
      timestamp: Date.now(),
      url: 'https://api.groq.com/openai/v1/chat/completions#reasoning',
      method: 'POST',
      bodyPreview: `Reasoning request for anomaly: ${anomaly.anomalyType}`,
      containsAudio: false
    });

    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 120,
          messages: [{ role: 'user', content: reasoningPrompt }],
        }),
      });
      const respData = await resp.json();
      if (respData.choices?.[0]?.message?.content) {
        const text = respData.choices[0].message.content.trim();
        const lines = text.split('\n')
          .map((line: string) => line.replace(/^-\s*/, '').trim())
          .filter(Boolean);
        if (lines.length > 0) {
          reasoning = lines.slice(0, 3);
        }
      }
    } catch (e) {
      console.error('Groq Reasoning Generation Failed:', e);
    }
  }

  // Ensure exact time is prefixed in the sent messages
  const exactMessage = `[🚨 Guardian Alert - ${exactTime}] ${llmText}`;

  // Fire external notifications (if SID/token keys are configured in .env)
  sendTwilioSMS(exactMessage, onNetworkLog);
  sendTwilioWhatsApp(exactMessage, onNetworkLog);

  // Fire browser notification if permission was granted
  if (Notification.permission === 'granted') {
    try {
      new Notification('Alert Triggered', {
        body: exactMessage,
        tag: 'guardian-alert',
      });
    } catch (e) {
      console.warn('Browser Notification could not be triggered:', e);
    }
  }

  return {
    id: `alert-${Date.now()}`,
    timestamp: Date.now(),
    severity,
    anomaly,
    llmText,
    acknowledged: false,
    reasoning,
  };
}
