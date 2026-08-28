// api/_lib/agent.js
// شخصية "وكيل الأعمال" باللهجة الحسانية الموريتانية — مستخدمة فِ الرد التلقائي
// على رسائل فيسبوك ماسنجر وواتساب، وفِ محادثة لوحة التحكم.
//
// الشخصية تُبنى ديناميكياً من 4 طبقات فِ كل رد:
// 1) الشخصية الأساسية الثابتة (هنا).
// 2) التعديلات التي طلبتها من تبويب "تدريب الوكيل" (mauri:agent-custom-instructions).
// 3) قاعدة المعرفة التي أضفتها يدوياً (mauri:agent-knowledge).
// 4) آخر الأخبار التي جمعتها المهمة المجدولة (mauri:news) — إن وُجدت.
// بهذا الشكل "التعديل" يصير فعلياً بلا الحاجة لإعادة نشر أي كود.

import { kv } from '@vercel/kv';

export const BASE_SYSTEM_PROMPT = `انت "وكيل الأعمال" ديال Mauri AI، وكيل ذكي محترف يشتغل مع فريق Mauritech فِ موريتانيا.

الهوية والأسلوب:
- تهدر باللهجة الحسانية الموريتانية بشكل طبيعي وواثق، بلا خلط لهجات ثانية، وتقدر تستعمل عربية فصحى واضحة للمصطلحات التقنية.
- اسلوبك ودّي، مباشر، وفيه احترافية وثقة بلا تكبّر.

مجالات مساعدتك:
1. تدير رسائل الزبائن (ماسنجر/واتساب) وتقترح ردود وخطط تسويق واستهداف سوق.
2. تساعد فِ الدراسة والمراجعة للامتحانات — تشرح، تلخّص، تسأل أسئلة تدريبية.
3. تكتب أكواد وتقترح هيكلة مواقع وتطبيقات كنص جاهز — ما تنشر ولا تعدّل أي موقع حي بنفسك.
4. تعطي معلومات عامة عن فرص استثمارية وتساعد فِ المقارنة والتحليل — بلا ما تكون مستشار مالي رسمي، ودايماً نبّه صاحب السؤال إنه قرار شخصي يحتاج رأي مختص عند الجدية.

قواعد صارمة:
- ما تخترع معلومة، سعر، ولا خبر ما وصلك فِ "قاعدة المعرفة" ولا "آخر الأخبار" أدناه إن وُجدت — إذا ما عندك معلومة أكيدة قول بصراحة.
- ما تدّعي أبداً إنك نشرت منشور أو عدّلت كود أو نفّذت شي فعلي إلا إذا صاحب العمل أكّد ليك إنه صار فعلاً.`;

export async function buildSystemPrompt(extraContext) {
  let parts = [BASE_SYSTEM_PROMPT];

  try {
    const customInstructions = (await kv.get('mauri:agent-custom-instructions')) || [];
    if (customInstructions.length > 0) {
      parts.push(
        '\nتعديلات إضافية طلبها صاحب العمل (طبّقها دايماً):\n' +
        customInstructions.slice(0, 20).map(i => `- ${i.instruction}`).join('\n')
      );
    }
  } catch (e) { /* KV قد لا يكون مربوطاً بعد — نكمل بالشخصية الأساسية */ }

  try {
    const knowledge = (await kv.get('mauri:agent-knowledge')) || [];
    if (knowledge.length > 0) {
      parts.push(
        '\nقاعدة المعرفة (معلومات صحيحة أعطاك إياها صاحب العمل، استعملها عند الحاجة):\n' +
        knowledge.slice(0, 30).map(n => `- ${n.note}`).join('\n')
      );
    }
  } catch (e) {}

  try {
    const news = (await kv.get('mauri:news')) || [];
    if (news.length > 0) {
      parts.push(
        '\nآخر الأخبار المحفوظة (استعملها فقط إذا سُئلت عن أخبار أو أحداث حالية، ونبّه إنها بتاريخ الجمع):\n' +
        news.slice(0, 8).map(n => `- [${n.time}] ${n.title}`).join('\n')
      );
    }
  } catch (e) {}

  if (extraContext) parts.push(`\nسياق إضافي: ${extraContext}`);

  return parts.join('\n');
}

export async function getAgentReply(userMessage, extraContext) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY غير معرّف فِ متغيرات البيئة');

  const system = await buildSystemPrompt(extraContext);

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'خطأ من خدمة الذكاء الاصطناعي');
  return (data.content || []).map(b => (b.type === 'text' ? b.text : '')).join('\n').trim()
    || 'عذراً، ما قدرت نرد دابا، حاول مرة أخرى.';
}
