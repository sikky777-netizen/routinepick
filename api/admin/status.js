import { requireAdmin } from '../_lib/auth.js';
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  return res.status(200).json({
    coupangConfigured: Boolean(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY),
    catalogConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  });
}
