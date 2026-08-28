// api/facebook/publish-post.js
// ينشر منشوراً فعلياً على صفحة فيسبوك المربوطة (نص، أو صورة برابط + نص).
// يُستدعى من زر "انشر على فيسبوك الآن" فِ تبويب "المنشورات" بلوحة التحكم.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, imageUrl } = req.body || {};
  if (!message) return res.status(400).json({ error: 'نص المنشور مطلوب' });

  try {
    const conn = await kv.get('mauri:fb-connection');
    if (!conn || !conn.pageAccessToken) {
      return res.status(400).json({ error: 'الصفحة غير مربوطة بعد. اربطها من تبويب "ربط الحسابات".' });
    }

    const endpoint = imageUrl
      ? `https://graph.facebook.com/v19.0/${conn.pageId}/photos`
      : `https://graph.facebook.com/v19.0/${conn.pageId}/feed`;

    const body = imageUrl
      ? { url: imageUrl, caption: message, access_token: conn.pageAccessToken }
      : { message, access_token: conn.pageAccessToken };

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const log = (await kv.get('mauri:fb-posts')) || [];
    log.unshift({ message, imageUrl: imageUrl || null, postId: data.id || data.post_id, time: new Date().toLocaleString('ar') });
    await kv.set('mauri:fb-posts', log.slice(0, 50));

    return res.status(200).json({ ok: true, id: data.id || data.post_id });
  } catch (err) {
    console.error('publish-post error', err);
    return res.status(500).json({ error: 'تعذر النشر على فيسبوك' });
  }
}
