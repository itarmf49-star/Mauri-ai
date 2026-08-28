// api/facebook/ads-library-search.js
// يبحث في Facebook Ads Library API — وهي بيانات عامة رسمية تعرض الإعلانات النشطة حالياً
// على فيسبوك/إنستغرام حسب اسم صفحة أو كلمة مفتاحية. هذا هو الاستخدام الشرعي والمتاح فعلياً
// لما يشبه "رصد السوق"، بخلاف مسح المنشورات العامة العشوائية وهو غير متاح عبر أي API رسمي.
// ملاحظة: للإعلانات السياسية/القضايا الاجتماعية يشترط فيسبوك توثيق هوية المُعلن قبل ظهورها هنا؛
// الإعلانات التجارية العادية لا تحتاج ذلك عادة.

export default async function handler(req, res) {
  const { q, country } = req.query;
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;

  if (!q) return res.status(400).json({ error: 'كلمة البحث مطلوبة' });
  if (!appId || !appSecret) {
    return res.status(500).json({ error: 'إعدادات فيسبوك غير مكتملة على الخادم.' });
  }

  try {
    // نستخدم App Access Token (app_id|app_secret) — كافٍ للبحث في مكتبة الإعلانات العامة
    const appToken = `${appId}|${appSecret}`;
    const url =
      `https://graph.facebook.com/v19.0/ads_archive` +
      `?search_terms=${encodeURIComponent(q)}` +
      `&ad_reached_countries=${encodeURIComponent(country || 'MR')}` +
      `&ad_active_status=ACTIVE` +
      `&fields=page_name,ad_creative_bodies,ad_snapshot_url` +
      `&access_token=${appToken}`;

    const r = await fetch(url);
    const data = await r.json();

    if (data.error) {
      return res.status(200).json({ error: data.error.message || 'تعذر البحث في مكتبة الإعلانات.' });
    }

    const results = (data.data || []).map(ad => ({
      page_name: ad.page_name,
      ad_creative_body: Array.isArray(ad.ad_creative_bodies) ? ad.ad_creative_bodies[0] : '',
      ad_snapshot_url: ad.ad_snapshot_url
    }));

    return res.status(200).json({ results });
  } catch (err) {
    console.error('ads library search error', err);
    return res.status(500).json({ error: 'تعذر الاتصال بمكتبة إعلانات فيسبوك.' });
  }
}
