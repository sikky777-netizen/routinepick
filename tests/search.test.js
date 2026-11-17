import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCoupang } from '../api/_lib/coupang.js';

const tracked = 'https://link.coupang.com/re/AFFSDP?lptag=AF1234567&pageKey=319834306&itemId=1023216541';
const sample = {
  rCode: '0', data: { productData: [{
    productId: 319834306, productName: '테스트 클렌저', productUrl: tracked,
    productImage: 'https://image.coupangcdn.com/test.jpg', productPrice: 11900,
    isRocket: true, isFreeShipping: true
  }] }
};

test('search keeps tracked productUrl without unnecessary deeplink request', async () => {
  const prevFetch = globalThis.fetch, prevAccess = process.env.COUPANG_ACCESS_KEY,
    prevSecret = process.env.COUPANG_SECRET_KEY;
  const calls = [];
  process.env.COUPANG_ACCESS_KEY = 'fake-access-key';
  process.env.COUPANG_SECRET_KEY = 'fake-secret-key';
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method });
    return { ok: true, status: 200, json: async () => sample };
  };
  try {
    const result = await searchCoupang('약산성 클렌저');
    assert.equal(calls.length, 1, 'Search API returns already-affiliated link, no deeplink call');
    assert.equal(calls[0].method, 'GET');
    assert.equal(result.length, 1);
    assert.equal(result[0].url, tracked);
    assert.equal(result[0].productId, '319834306');
  } finally {
    globalThis.fetch = prevFetch;
    if (prevAccess === undefined) delete process.env.COUPANG_ACCESS_KEY;
    else process.env.COUPANG_ACCESS_KEY = prevAccess;
    if (prevSecret === undefined) delete process.env.COUPANG_SECRET_KEY;
    else process.env.COUPANG_SECRET_KEY = prevSecret;
  }
});

test('non-affiliate product links are converted only when needed', async () => {
  const prevFetch = globalThis.fetch, prevAccess = process.env.COUPANG_ACCESS_KEY,
    prevSecret = process.env.COUPANG_SECRET_KEY;
  process.env.COUPANG_ACCESS_KEY = 'fake-access-key';
  process.env.COUPANG_SECRET_KEY = 'fake-secret-key';
  const raw = 'https://www.coupang.com/vp/products/123';
  const converted = 'https://coupa.ng/test';
  let count = 0;
  globalThis.fetch = async (url, opts) => {
    count += 1;
    if (opts.method === 'GET') return {
      ok: true, status: 200,
      json: async () => ({ rCode: '0', data: { productData: [{...sample.data.productData[0], productUrl: raw}] } })
    };
    return {
      ok: true, status: 200,
      json: async () => ({ rCode: '0', data: [{originalUrl: raw, shortenUrl: converted}] })
    };
  };
  try {
    const result = await searchCoupang('클렌저');
    assert.equal(count, 2);
    assert.equal(result[0].url, converted);
  } finally {
    globalThis.fetch = prevFetch;
    if (prevAccess === undefined) delete process.env.COUPANG_ACCESS_KEY;
    else process.env.COUPANG_ACCESS_KEY = prevAccess;
    if (prevSecret === undefined) delete process.env.COUPANG_SECRET_KEY;
    else process.env.COUPANG_SECRET_KEY = prevSecret;
  }
});
