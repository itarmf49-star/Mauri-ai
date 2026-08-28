// api/news/list.js — عرض آخر الأخبار المحفوظة (للوحة التحكم فقط، الوكيل يقرأها مباشرة من KV)
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const news = (await kv.get('mauri:news')) || [];
    return res.status(200).json({ news });
  } catch (err) {
    return res.status(200).json({ news: [] });
  }
}
