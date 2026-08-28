// api/facebook/callback.js
// يستقبل "code" من فيسبوك بعد موافقة المستخدم، يستبدله بـ access token قصير الأمد،
// ثم يحوّله إلى token طويل الأمد (60 يوماً)، ثم يجلب صفحات المستخدم ويحفظ توكن أول صفحة
// (يمكن لاحقاً تعديل هذا لعرض قائمة صفحات واختيار واحدة عبر واجهة).

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { code } = req.query;
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  const redirectUri = process.env.FB_REDIRECT_URI;

  if (!code) return res.status(400).send('لا يوجد كود من فيسبوك.');
  if (!appId || !appSecret || !redirectUri) {
    return res.status(500).send('متغيرات فيسبوك (FB_APP_ID / FB_APP_SECRET / FB_REDIRECT_URI) غير مكتملة.');
  }

  try {
    // 1) استبدال الكود بتوكن مستخدم قصير الأمد
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('fb token exchange failed', tokenData);
      return res.status(400).send('فشل استبدال الكود بتوكن. تحقق من إعدادات التطبيق.');
    }

    // 2) تحويله إلى توكن طويل الأمد (60 يوماً تقريباً)
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}` +
      `&fb_exchange_token=${tokenData.access_token}`
    );
    const longTokenData = await longTokenRes.json();
    const userToken = longTokenData.access_token || tokenData.access_token;

    // 3) جلب صفحات المستخدم وتوكن كل صفحة (Page Access Token لا ينتهي طالما التوكن الأصلي صالح)
    const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`);
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      return res.status(200).send('تم تسجيل الدخول، لكن لا توجد صفحات فيسبوك مرتبطة بهذا الحساب. أنشئ صفحة أعمال أولاً.');
    }

    const page = pagesData.data[0]; // أول صفحة — يمكن لاحقاً بناء واجهة اختيار من عدة صفحات
    await kv.set('mauri:fb-connection', {
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      connectedAt: new Date().toISOString()
    });

    // اشتراك الصفحة فِ أحداث الرسائل حتى يوصل الـ webhook الرسائل الواردة لوكيل الأعمال
    try {
      await fetch(
        `https://graph.facebook.com/v19.0/${page.id}/subscribed_apps` +
        `?subscribed_fields=messages,messaging_postbacks&access_token=${page.access_token}`,
        { method: 'POST' }
      );
    } catch (subErr) {
      console.error('تعذر اشتراك الصفحة فِ أحداث الرسائل تلقائياً', subErr);
    }

    res.writeHead(302, { Location: '/admin.html?fb=connected' });
    res.end();
  } catch (err) {
    console.error('facebook callback error', err);
    res.status(500).send('حدث خطأ أثناء ربط فيسبوك.');
  }
}
