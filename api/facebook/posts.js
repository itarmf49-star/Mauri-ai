// api/facebook/posts.js — سجل المنشورات التي نشرها وكيل الأعمال/صاحب الحساب على فيسبوك
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const posts = (await kv.get('mauri:fb-posts')) || [];
    return res.status(200).json({ posts });
  } catch (err) {
    return res.status(200).json({ posts: [] });
  }
}
