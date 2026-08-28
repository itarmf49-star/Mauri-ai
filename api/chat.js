// api/chat.js
// خادم وسيط يستقبل رسائل الدردشة من الواجهة الأمامية (عامة أو لوحة تحكم)
// ويرسلها إلى Anthropic باستخدام مفتاح API محفوظ بأمان في متغيرات البيئة على Vercel.
// يدمج تلقائياً تعديلات الوكيل وقاعدة المعرفة وآخر الأخبار (نفس طبقات api/_lib/agent.js)
// إلا إذا أرسلت الواجهة نظام تعليمات مخصص خاص بها (مثل اقتراح منشور).

import { buildSystemPrompt } from './_lib/agent.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY غير مُعرّف في متغيرات البيئة على Vercel. أضفه من Project Settings > Environment Variables.'
    });
  }

  const { system, messages, useAgentPersona } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages مطلوبة' });
  }

  try {
    const finalSystem = useAgentPersona === false ? system : await buildSystemPrompt();

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: finalSystem || system || undefined,
        messages
      })
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json({ error: data?.error?.message || 'خطأ من Anthropic API' });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('chat proxy error', err);
    return res.status(500).json({ error: 'تعذر الاتصال بخدمة الذكاء الاصطناعي' });
  }
}
