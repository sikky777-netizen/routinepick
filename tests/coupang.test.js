import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { authorization, signedDate, validAffiliateUrl, validProductUrl } from '../api/_lib/coupang.js';

test('UTC HMAC timestamp is formatted according to the Coupang specification', () => {
  assert.equal(signedDate(new Date('2026-11-17T09:07:03.000Z')), '261117T090703Z');
});

test('GET signature signs the path and raw query without a question mark', () => {
  const date = new Date('2026-11-17T09:07:03.000Z');
  const path = '/test/path?keyword=%ED%81%B4%EB%A0%8C%EC%A0%80&limit=10';
  const expected = createHmac('sha256', 'fake-secret')
    .update('261117T090703ZGET/test/pathkeyword=%ED%81%B4%EB%A0%8C%EC%A0%80&limit=10').digest('hex');
  assert.equal(authorization('GET', path, 'fake-access', 'fake-secret', date),
    'CEA algorithm=HmacSHA256, access-key=fake-access, signed-date=261117T090703Z, signature=' + expected);
});

test('only Coupang sites qualify for product sources and tracked affiliate links', () => {
  assert.ok(validProductUrl('https://www.coupang.com/vp/products/123'));
  assert.ok(validAffiliateUrl('https://link.coupang.com/a/abc'));
  assert.ok(validAffiliateUrl('https://coupa.ng/x'));
  assert.equal(validAffiliateUrl('https://www.coupang.com/vp/products/123'), false);
  assert.equal(validAffiliateUrl('https://link.coupang.com.evil.test/x'), false);
  assert.equal(validProductUrl('http://www.coupang.com/x'), false);
});
