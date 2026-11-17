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

  if (message === 'COUPANG_UPSTREAM_ERROR') {
    const operation = error.operation === 'deeplink' ? '제휴 링크 변환' : '상품 검색';
    const code = Number(error.httpStatus);
    if (code === 401) return res.status(502).json({
      error: '쿠팡 ' + operation + ' 인증 거절(401). Access Key와 Secret Key가 같은 계정의 발급값인지, 최종승인 상태인지 확인해 주세요.',
      diagnostic: 'COUPANG_401'
    });
    if (code === 403) return res.status(502).json({
      error: '쿠팡 ' + operation + ' 권한 거절(403). 쿠팡 파트너스 계정의 API 사용 권한을 확인해 주세요.',
      diagnostic: 'COUPANG_403'
    });
    if (code === 429) return res.status(429).json({
      error: '쿠팡 API 호출 횟수 제한(429). 잠시 검색을 중단하고 파트너스 API 정책을 확인해 주세요.',
      diagnostic: 'COUPANG_429'
    });
    return res.status(502).json({
      error: '쿠팡 ' + operation + ' 요청이 거절되었습니다. 응답 상태: HTTP ' + (Number.isInteger(code) ? code : '알 수 없음') + '.',
      diagnostic: 'COUPANG_UPSTREAM'
    });
  }

  return res.status(502).json({ error: '요청에 실패했습니다. API 키, 승인 상태 또는 상품 링크를 확인해 주세요.' });
}
