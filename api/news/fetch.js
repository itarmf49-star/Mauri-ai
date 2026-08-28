// api/news/fetch.js
// مهمة مجدولة (Vercel Cron) تجلب آخر الأخبار من NewsAPI وتحفظها فِ KV،
// حتى يقدر الوكيل يرجع لها إذا سُئل عن أخبار أو مستجدات.
// مجدولة فِ vercel.json لتشتغل كل ساعة تلقائياً — بلا أي تدخل يدوي.
//
// يتطلب: NEWS_API_KEY من https://newsapi.org (يوجد مستوى مجاني للتجربة).

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // حماية بسيطة: Vercel Cron يرسل هيدر خاص، ونتحقق أيضاً من CRON_SECRET إن وُجد
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send('غير مصرّح');
  }

  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ skipped: true, reason: 'NEWS_API_KEY غير معرّف — لم يتم الجلب' });
  }

  try {
    const query = process.env.NEWS_QUERY || 'موريتانيا OR تقنية OR اقتصاد';
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=ar&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`;
    const r = await fetch(url);
    const data = await r.json();

    if (data.status !== 'ok') {
      return res.status(200).json({ error: data.message || 'تعذر جلب الأخبار' });
    }

    const newItems = (data.articles || []).map(a => ({
      title: a.title,
      url: a.url,
      source: a.source?.name || '',
      time: new Date(a.publishedAt || Date.now()).toLocaleString('ar')
    }));

    const existing = (await kv.get('mauri:news')) || [];
    const merged = [...newItems, ...existing]
      .filter((item, idx, arr) => arr.findIndex(x => x.title === item.title) === idx) // إزالة التكرار
      .slice(0, 40);

    await kv.set('mauri:news', merged);
    return res.status(200).json({ ok: true, added: newItems.length });
  } catch (err) {
    console.error('news fetch error', err);
    return res.status(500).json({ error: 'تعذر جلب الأخبار' });
  }
}
