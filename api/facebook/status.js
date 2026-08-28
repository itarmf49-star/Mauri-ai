// api/facebook/status.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const conn = await kv.get('mauri:fb-connection');
    if (!conn) return res.status(200).json({ connected: false });
    return res.status(200).json({ connected: true, pageName: conn.pageName, connectedAt: conn.connectedAt });
  } catch (err) {
    return res.status(200).json({ connected: false });
  }
}
