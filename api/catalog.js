import { readCatalog } from './_lib/catalog.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const catalog = await readCatalog();
    return res.status(200).json({ products: catalog.products.filter(p => p.active !== false), version: catalog.version });
  } catch {
    return res.status(503).json({ products: [], error: '상품 목록을 불러올 수 없습니다.' });
  }
}
