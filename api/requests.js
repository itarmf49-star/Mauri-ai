// api/requests.js
// يستقبل طلبات "تقديم طلب" و"تواصل مباشر" من الواجهة العامة (public/index.html)
// ويضيفها إلى نفس بيانات لوحة التحكم المخزنة في Vercel KV، لتظهر فوراً في تبويب "الطلبات الواردة".

import { kv } from '@vercel/kv';

const KEY = 'mauri:data';
const DEFAULT_DATA = { opportunities: [], companies: [], activity: [], requests: [] };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, subject, message, time } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: 'الاسم ورقم الهاتف مطلوبان' });
  }

  try {
    const data = (await kv.get(KEY)) || DEFAULT_DATA;
    data.requests = data.requests || [];
    data.requests.unshift({ name, phone, subject: subject || 'طلب عام', message: message || '', time: time || new Date().toISOString() });
    data.activity = data.activity || [];
    data.activity.unshift({ text: `طلب جديد من الواجهة العامة: ${name} — ${subject || 'طلب عام'}`, time: new Date().toLocaleString('ar') });
    data.activity = data.activity.slice(0, 8);
    await kv.set(KEY, data);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('requests api error', err);
    return res.status(500).json({
      error: 'تعذر حفظ الطلب. تأكد من إنشاء وربط Vercel KV بالمشروع (راجع README).'
    });
  }
}
