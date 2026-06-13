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
      // Fall back to template if API fails
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
      new Notification('Guardian Alert', {
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
  };
}
