import { createHash, timingSafeEqual } from 'node:crypto';

export function isAdmin(req) {
  const configured = process.env.ROUTINEPICK_ADMIN_TOKEN;
  const supplied = req.headers['x-routinepick-admin'];
  if (!configured || typeof supplied !== 'string' || !supplied) return false;
  const hash = text => createHash('sha256').update(text).digest();
  return timingSafeEqual(hash(supplied), hash(configured));
}

export function requireAdmin(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdmin(req)) {
    res.status(401).json({ error: '관리자 인증에 실패했습니다. Vercel의 ROUTINEPICK_ADMIN_TOKEN을 확인해 주세요.' });
    return false;
  }
  return true;
}

export function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export function fail(res, error) {
  const message = error && error.message ? error.message : '';
  if (message === 'BLOB_NOT_CONFIGURED') return res.status(503).json({ error: '상품 저장소가 연결되지 않았습니다.' });
  if (message === 'COUPANG_NOT_CONFIGURED') return res.status(503).json({ error: '쿠팡 API 키를 Vercel 환경변수에 등록해 주세요.' });
  if (message === 'SEARCH_LIMIT') return res.status(429).json({ error: '호출 제한 보호를 위해 검색 횟수를 제한했습니다. 1시간 뒤 다시 시도해 주세요.' });
  if (message === 'INVALID_PRODUCT') return res.status(400).json({ error: '상품 데이터 또는 제휴 링크가 올바르지 않습니다.' });
  if (message === 'CONFLICT') return res.status(409).json({ error: '다른 관리자가 상품을 변경했습니다. 새로고침 후 다시 시도해 주세요.' });
  return res.status(502).json({ error: '요청에 실패했습니다. API 키, 승인 상태 또는 상품 링크를 확인해 주세요.' });
}
