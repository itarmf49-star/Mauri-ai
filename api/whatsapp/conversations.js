// api/whatsapp/conversations.js — سجل رسائل واتساب التي ردّ عليها وكيل الأعمال تلقائياً
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const conversations = (await kv.get('mauri:wa-conversations')) || [];
    return res.status(200).json({ conversations });
  } catch (err) {
    return res.status(200).json({ conversations: [] });
  }
}
