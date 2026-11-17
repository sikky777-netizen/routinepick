import { requireAdmin, bodyOf, fail } from '../_lib/auth.js';
import { readCatalog, writeCatalog } from '../_lib/catalog.js';
import { validAffiliateUrl } from '../_lib/coupang.js';

const stages = ['wash', 'first'];
const textures = ['gel', 'foam', 'oil', 'any'];
const textureText = { gel: ['젤', 'Gel'], foam: ['폼', 'Foam'], oil: ['오일', 'Oil'], any: ['기타', 'Other'] };
const roles = { wash: ['일상 세안', 'Daily wash'], first: ['선크림·메이크업 제거', 'First cleanse'] };
const notes = { wash: ['제형과 전성분을 구매 전에 확인하세요.', 'Check texture and ingredients before buying.'], first: ['사용법과 유화·헹굼 방법을 확인하세요.', 'Check instructions, emulsification and rinsing.'] };

function normalize(x) {
  if (!x || !/^\d{1,20}$/.test(String(x.productId)) || !stages.includes(x.stage) ||
      !textures.includes(x.texture) || !validAffiliateUrl(x.url) ||
      typeof x.name !== 'string' || !x.name.trim() || x.name.length > 180)
    throw new Error('INVALID_PRODUCT');
  return {
    id: 'cp-' + String(x.productId),
    productId: String(x.productId),
    store: 'coupang',
    name: x.name.trim(),
    url: x.url,
    image: typeof x.image === 'string' && /^https:\/\//.test(x.image) ? x.image.slice(0, 500) : '',
    stage: x.stage,
    texture: textureText[x.texture],
    role: roles[x.stage],
    note: notes[x.stage],
    price: Number.isFinite(Number(x.price)) ? Math.max(0, Number(x.price)) : 0,
    active: true,
    updatedAt: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  try {
    const catalog = await readCatalog();
    if (req.method === 'GET') return res.status(200).json(catalog);
    const body = bodyOf(req);
    if (body.version !== catalog.version) return fail(res, new Error('CONFLICT'));
    if (req.method === 'POST') {
      if (!Array.isArray(body.products) || body.products.length < 1 || body.products.length > 10)
        return res.status(400).json({ error: '한 번에 상품 1~10개까지 등록할 수 있습니다.' });
      const next = new Map(catalog.products.map(p => [p.id, p]));
      for (const x of body.products) { const p = normalize(x); next.set(p.id, p); }
      catalog.products = [...next.values()];
    } else {
      const id = String(body.id || '');
      if (!/^cp-\d+$/.test(id)) return res.status(400).json({ error: '잘못된 상품 ID입니다.' });
      catalog.products = catalog.products.filter(p => p.id !== id);
    }
    catalog.version += 1;
    await writeCatalog(catalog);
    return res.status(200).json(catalog);
  } catch (e) { return fail(res, e); }
}
