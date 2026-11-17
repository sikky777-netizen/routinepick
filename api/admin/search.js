import { requireAdmin, bodyOf, fail } from '../_lib/auth.js';
import { reserveSearch } from '../_lib/catalog.js';
import { searchCoupang } from '../_lib/coupang.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  const data = bodyOf(req);
  const keyword = typeof data.keyword === 'string' ? data.keyword.trim() : '';
  if (keyword.length < 2 || keyword.length > 70) return res.status(400).json({ error: '검색어는 2~70자로 입력해 주세요.' });
  if (!process.env.COUPANG_ACCESS_KEY || !process.env.COUPANG_SECRET_KEY) return fail(res, new Error('COUPANG_NOT_CONFIGURED'));
  try {
    const remaining = await reserveSearch();
    const products = await searchCoupang(keyword, 10);
    return res.status(200).json({ products, remaining });
  } catch (e) { return fail(res, e); }
}
