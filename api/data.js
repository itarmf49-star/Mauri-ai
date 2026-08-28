// api/data.js
// تخزين واسترجاع بيانات لوحة التحكم (الفرص، الشركات، النشاطات، الطلبات)
// باستخدام Vercel KV حتى تبقى البيانات محفوظة بين الزيارات ومشتركة بين كل من يفتح لوحة التحكم.
// يتطلب إنشاء قاعدة KV من لوحة Vercel وربط متغيرات KV_REST_API_URL و KV_REST_API_TOKEN تلقائياً.

import { kv } from '@vercel/kv';

const KEY = 'mauri:data';
const DEFAULT_DATA = { opportunities: [], companies: [], activity: [], requests: [] };

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const data = (await kv.get(KEY)) || DEFAULT_DATA;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const safeData = { ...DEFAULT_DATA, ...body };
      await kv.set(KEY, safeData);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('data api error', err);
    return res.status(500).json({
      error: 'تعذر الوصول لقاعدة البيانات. تأكد من إنشاء وربط Vercel KV بالمشروع (راجع README).'
    });
  }
}
