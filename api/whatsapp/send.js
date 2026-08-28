// api/whatsapp/send.js
// إرسال رسالة واتساب مباشرة من لوحة التحكم (مثلاً بعد توليد رسالة فِ "مركز رسائل واتساب").
//
// ملاحظة مهمة من قواعد واتساب نفسها (وليست قيداً من الكود):
// يمكنك إرسال رسالة نصية حرة فقط إذا كان الزبون قد راسلك خلال آخر 24 ساعة (نافذة خدمة العملاء).
// خارج هذه النافذة، يجب استخدام "قالب رسالة" (Message Template) معتمد مسبقاً من Meta —
// وهذا يتطلب إنشاء القالب من لوحة WhatsApp Manager وانتظار موافقته قبل استخدامه هنا.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: 'رقم المستلم ونص الرسالة مطلوبان' });

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return res.status(500).json({ error: 'إعدادات واتساب غير مكتملة على الخادم (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).' });
  }

  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        text: { body: message }
      })
    });
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('whatsapp send error', err);
    return res.status(500).json({ error: 'تعذر إرسال الرسالة عبر واتساب' });
  }
}
