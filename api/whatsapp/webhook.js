// api/whatsapp/webhook.js
// نقطة الاستقبال لرسائل واتساب عبر WhatsApp Cloud API.
// GET  = خطوة التحقق التي يطلبها Meta عند إضافة الرابط.
// POST = رسالة واردة فعلية — يردّ عليها وكيل الأعمال تلقائياً.
//
// إعداد مطلوب فِ Meta for Developers (تطبيقك > WhatsApp > Configuration):
//   Callback URL = https://your-domain.com/api/whatsapp/webhook
//   Verify Token = نفس قيمة WHATSAPP_VERIFY_TOKEN فِ متغيرات البيئة
//   Subscribe to = messages

import { kv } from '@vercel/kv';
import { getAgentReply } from '../_lib/agent.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('فشل التحقق — تأكد من WHATSAPP_VERIFY_TOKEN');
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const entry = (body.entry || [])[0];
      const change = entry && (entry.changes || [])[0];
      const value = change && change.value;
      const messages = (value && value.messages) || [];

      for (const msg of messages) {
        if (msg.type === 'text' && msg.text && msg.text.body) {
          await handleIncomingMessage(msg.from, msg.text.body);
        }
      }
    } catch (err) {
      console.error('whatsapp webhook parse error', err);
    }
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(405).send('Method not allowed');
}

async function handleIncomingMessage(fromNumber, text) {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      console.warn('WHATSAPP_TOKEN أو WHATSAPP_PHONE_NUMBER_ID غير معرّفين');
      return;
    }

    const reply = await getAgentReply(text);

    await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: fromNumber,
        text: { body: reply }
      })
    });

    const log = (await kv.get('mauri:wa-conversations')) || [];
    log.unshift({ from: fromNumber, userMessage: text, agentReply: reply, time: new Date().toLocaleString('ar') });
    await kv.set('mauri:wa-conversations', log.slice(0, 100));
  } catch (err) {
    console.error('whatsapp handleIncomingMessage error', err);
  }
}
