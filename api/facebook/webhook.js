// api/facebook/webhook.js
// نقطة الاستقبال (Webhook) التي يرسل إليها فيسبوك رسائل ماسنجر الواردة على صفحتك.
// GET  = خطوة التحقق التي يطلبها Meta عند إضافة الرابط فِ لوحة المطورين.
// POST = رسالة واردة فعلية من زبون — يردّ عليها وكيل الأعمال تلقائياً.
//
// إعداد مطلوب فِ Meta for Developers (تطبيقك > Webhooks > Page):
//   Callback URL   = https://your-domain.com/api/facebook/webhook
//   Verify Token   = نفس قيمة FB_VERIFY_TOKEN فِ متغيرات البيئة
//   Subscribe to   = messages, messaging_postbacks

import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { getAgentReply } from '../_lib/agent.js';

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // ===== خطوة التحقق من فيسبوك =====
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('فشل التحقق — تأكد من FB_VERIFY_TOKEN');
  }

  // ===== استقبال رسالة فعلية =====
  if (req.method === 'POST') {
    const rawBody = await readRawBody(req);

    if (process.env.FB_APP_SECRET) {
      const signature = req.headers['x-hub-signature-256'];
      if (!verifySignature(rawBody, signature, process.env.FB_APP_SECRET)) {
        console.warn('توقيع فيسبوك غير صالح — تم تجاهل الحدث');
        return res.status(200).send('EVENT_RECEIVED');
      }
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return res.status(200).send('EVENT_RECEIVED');
    }

    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const event of entry.messaging || []) {
          if (event.message && event.message.text && !event.message.is_echo) {
            await handleIncomingMessage(event.sender.id, event.message.text);
          }
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(405).send('Method not allowed');
}

async function handleIncomingMessage(senderId, text) {
  try {
    const conn = await kv.get('mauri:fb-connection');
    if (!conn || !conn.pageAccessToken) {
      console.warn('لا توجد صفحة مربوطة — تعذر الرد التلقائي');
      return;
    }

    const reply = await getAgentReply(text);

    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${conn.pageAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: senderId },
        message: { text: reply }
      })
    });

    const log = (await kv.get('mauri:fb-conversations')) || [];
    log.unshift({ senderId, userMessage: text, agentReply: reply, time: new Date().toLocaleString('ar') });
    await kv.set('mauri:fb-conversations', log.slice(0, 100));
  } catch (err) {
    console.error('facebook handleIncomingMessage error', err);
  }
}
