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
    if (!response.ok || !result || (result.rCode != null && String(result.rCode) !== '0')) {
      // Never log the Authorization header, full request URL, or credential values.
      const error = new Error('COUPANG_UPSTREAM_ERROR');
      error.httpStatus = response.status;
      error.operation = method === 'GET' ? 'search' : 'deeplink';
      error.rCode = typeof result?.rCode === 'string' && /^[a-zA-Z0-9_-]{1,20}$/.test(result.rCode)
        ? result.rCode : null;
      console.error('Coupang API request unsuccessful', {
        operation: error.operation, httpStatus: error.httpStatus, rCode: error.rCode
      });
      throw error;
    }
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

// Search API normally returns already-attributed partner links
// (link.coupang.com/re/AFFSDP?...). Do not reprocess these in the deeplink API.
export async function searchCoupang(keyword, limit = 10) {
  const query = new URLSearchParams({
    keyword,
    limit: String(Math.max(1, Math.min(10, limit)))
  });
  const data = await call('GET', SEARCH + '?' + query.toString());
  const found = Array.isArray(data?.productData)
    ? data.productData : Array.isArray(data) ? data : [];

  const records = found
    .filter(x => x && /^\\d+$/.test(String(x.productId)) && validProductUrl(x.productUrl))
    .slice(0, 10);

  // The product search endpoint itself can produce valid affiliate URLs.
  // Only plain coupang.com URLs need a separate deeplink conversion.
  const missingLinks = records.filter(x => !validAffiliateUrl(x.productUrl));
  const convertedLinks = new Map();

  if (missingLinks.length) {
    try {
      const converted = await call('POST', DEEPLINK, {
        coupangUrls: missingLinks.map(x => x.productUrl)
      });
      if (Array.isArray(converted)) {
        for (const x of converted) {
          if (x && validAffiliateUrl(x.shortenUrl)) {
            convertedLinks.set(x.originalUrl, x.shortenUrl);
          }
        }
      }
    } catch (e) {
      // Preserve valid search-returned affiliate links even if optional conversion
      // fails for unrelated ordinary product URLs.
      console.error('Optional Coupang deeplink conversion unavailable', {
        httpStatus: e.httpStatus || null,
        operation: 'deeplink'
      });
    }
  }
  return records.map(x => ({
    productId: String(x.productId),
    name: String(x.productName || '').slice(0, 180),
    image: /^https:\\/\\//.test(x.productImage || '') ? String(x.productImage) : '',
    price: Number(x.productPrice) || 0,
    url: validAffiliateUrl(x.productUrl) ? x.productUrl : (convertedLinks.get(x.productUrl) || ''),
    rocket: Boolean(x.isRocket),
    freeShipping: Boolean(x.isFreeShipping)
  })).filter(x => x.name && validAffiliateUrl(x.url));
}
