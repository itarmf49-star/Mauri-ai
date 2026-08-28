// api/agent/knowledge.js
// "قاعدة معرفة" الوكيل — معلومات ثابتة تضيفها له أنت يدوياً (أسعار، سياسات، تفاصيل خدمات...)
// تُضاف لسياق كل رد يعطيه الوكيل. هذا بديل واقعي وآمن عن فكرة "يعرف كل شيء" —
// هو يعرف بالضبط اللي تعطيه إياه، بلا اختلاق معلومات.

import { kv } from '@vercel/kv';

const KEY = 'mauri:agent-knowledge';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const notes = (await kv.get(KEY)) || [];
    return res.status(200).json({ notes });
  }

  if (req.method === 'POST') {
    const { note } = req.body || {};
    if (!note || !note.trim()) return res.status(400).json({ error: 'اكتب المعلومة أولاً' });

    const notes = (await kv.get(KEY)) || [];
    notes.unshift({ note: note.trim(), time: new Date().toLocaleString('ar') });
    await kv.set(KEY, notes.slice(0, 50));
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { index } = req.body || {};
    const notes = (await kv.get(KEY)) || [];
    if (typeof index === 'number' && notes[index]) {
      notes.splice(index, 1);
      await kv.set(KEY, notes);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
