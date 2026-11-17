import { createHmac } from 'node:crypto';

const BASE = 'https://api-gateway.coupang.com';
const SEARCH = '/v2/providers/affiliate_open_api/apis/openapi/products/search';
const DEEPLINK = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';

export function signedDate(now = new Date()) {
  return now.toISOString().slice(2, 19).replace(/[-:]/g, '') + 'Z';
}

export function authorization(method, pathAndQuery, access, secret, now = new Date()) {
  const when = signedDate(now);
  const i = pathAndQuery.indexOf('?');
  const message = when + method + (i < 0 ? pathAndQuery : pathAndQuery.slice(0, i) + pathAndQuery.slice(i + 1));
  const signature = createHmac('sha256', secret).update(message).digest('hex');
  return 'CEA algorithm=HmacSHA256, access-key=' + access + ', signed-date=' + when + ', signature=' + signature;
}

async function call(method, path, body) {
  const access = process.env.COUPANG_ACCESS_KEY, secret = process.env.COUPANG_SECRET_KEY;
  if (!access || !secret) throw new Error('COUPANG_NOT_CONFIGURED');
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12000);
  try {
    const response = await fetch(BASE + path, {
      method,
      headers: {
        Authorization: authorization(method, path, access, secret),
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: ctrl.signal
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || (result.rCode != null && String(result.rCode) !== '0'))
      throw new Error('COUPANG_REQUEST_FAILED');
    return result.data;
  } finally { clearTimeout(timeout); }
}

export function validProductUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ['www.coupang.com', 'm.coupang.com', 'link.coupang.com', 'coupa.ng'].includes(u.hostname);
  } catch { return false; }
}

export function validAffiliateUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ['link.coupang.com', 'coupa.ng'].includes(u.hostname);
  } catch { return false; }
}

export async function searchCoupang(keyword, limit = 10) {
  const query = new URLSearchParams({ keyword, limit: String(Math.max(1, Math.min(10, limit))) });
  const data = await call('GET', SEARCH + '?' + query.toString());
  const found = Array.isArray(data?.productData) ? data.productData : Array.isArray(data) ? data : [];
  const records = found.filter(x => x && /^\d+$/.test(String(x.productId)) && validProductUrl(x.productUrl)).slice(0, 10);
  if (!records.length) return [];
  // Deep links are obtained from Coupang, never invented by the app.
  const converted = await call('POST', DEEPLINK, { coupangUrls: records.map(x => x.productUrl) });
  const links = Array.isArray(converted) ? converted : [];
  const linkFor = new Map(links.filter(x => x && validAffiliateUrl(x.shortenUrl)).map(x => [x.originalUrl, x.shortenUrl]));
  return records.map(x => ({
    productId: String(x.productId),
    name: String(x.productName || '').slice(0, 180),
    image: /^https:\/\//.test(x.productImage || '') ? String(x.productImage) : '',
    price: Number(x.productPrice) || 0,
    url: linkFor.get(x.productUrl) || '',
    rocket: Boolean(x.isRocket),
    freeShipping: Boolean(x.isFreeShipping)
  })).filter(x => x.name && validAffiliateUrl(x.url));
}
