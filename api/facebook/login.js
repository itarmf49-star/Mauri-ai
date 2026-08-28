// api/facebook/login.js
// يبدأ تدفق OAuth الرسمي لفيسبوك لربط صفحة أعمال (Page) — وليس حساباً شخصياً، لأن Meta لا تسمح بذلك.
// الصلاحيات المطلوبة هنا (pages_show_list, pages_messaging, pages_manage_posts, pages_read_engagement)
// تحتاج مراجعة Meta App Review قبل استخدامها مع مستخدمين حقيقيين خارج فريق التطوير.

export default function handler(req, res) {
  const appId = process.env.FB_APP_ID;
  const redirectUri = process.env.FB_REDIRECT_URI;

  if (!appId || !redirectUri) {
    return res.status(500).send(
      'FB_APP_ID أو FB_REDIRECT_URI غير معرّفين في متغيرات البيئة على Vercel. أضفهما من إعدادات المشروع، راجع README.'
    );
  }

  const scope = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_messaging'
  ].join(',');

  const authUrl =
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code`;

  res.writeHead(302, { Location: authUrl });
  res.end();
}
