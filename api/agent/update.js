// api/agent/update.js
// عندما تطلب تعديلاً على الوكيل (مثلاً: "خلي رده أقصر" أو "زيد عليه يعرف يهدر عن أسعار الاستضافة")،
// هذا الملف يستعمل الذكاء الاصطناعي نفسه ليصوغ التعديل كـ"تعليمة إضافية" واضحة،
// ويحفظها فِ KV — فتتفعّل فوراً فِ كل رد جاي للوكيل (ماسنجر، واتساب، الدردشة)
// بلا ما نحتاج نعيد نشر أي كود. هذا هو "التعديل التلقائي" بطريقة آمنة.

import { kv } from '@vercel/kv';

const KEY = 'mauri:agent-custom-instructions';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const current = (await kv.get(KEY)) || [];
    return res.status(200).json({ instructions: current });
  }

  if (req.method === 'POST') {
    const { request } = req.body || {};
    if (!request || !request.trim()) {
      return res.status(400).json({ error: 'اكتب وش تبغي تعدّل فِ الوكيل' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY غير معرّف' });

    try {
      // نحوّل طلب صاحب العمل (بأي صياغة) إلى تعليمة واضحة ومختصرة نضيفها لشخصية الوكيل
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          system: `حوّل طلب صاحب العمل التالي إلى تعليمة واحدة واضحة ومباشرة (سطر أو سطرين بالعربية) تُضاف لتعليمات وكيل أعمال ذكي.
اكتب التعليمة فقط بلا أي مقدمة أو شرح.`,
          messages: [{ role: 'user', content: request }]
        })
      });
      const data = await r.json();
      const instruction = (data.content || []).map(b => b.type === 'text' ? b.text : '').join('\n').trim();
      if (!instruction) return res.status(500).json({ error: 'تعذر صياغة التعديل' });

      const list = (await kv.get(KEY)) || [];
      list.unshift({ instruction, requestedAs: request, time: new Date().toLocaleString('ar') });
      await kv.set(KEY, list.slice(0, 30)); // آخر 30 تعديل كافية لتوجيه الوكيل بلا إثقاله

      return res.status(200).json({ ok: true, instruction });
    } catch (err) {
      console.error('agent update error', err);
      return res.status(500).json({ error: 'تعذر تطبيق التعديل' });
    }
  }

  if (req.method === 'DELETE') {
    await kv.set(KEY, []);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
