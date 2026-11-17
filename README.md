# RoutinePick

기존 루틴픽 아마존 추천 화면에 한국 쿠팡 파트너스 상품 검색·관리 기능을 추가한 버전입니다. 서버 기능은 Vercel Node.js Functions를 사용합니다.

## 준비 사항

1. Vercel 프로젝트 `routinepick` → Settings → Environment Variables에서 `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`를 **암호화된 환경변수**로 설정합니다.
2. 같은 위치에서 긴 임의의 관리자 토큰을 `ROUTINEPICK_ADMIN_TOKEN`으로 설정합니다. 토큰은 채팅, GitHub, 브라우저 소스에 기록하지 않습니다.
3. Vercel 프로젝트에 개인 정보 보호 모드의 Blob 스토어 `routinepick-catalog`가 연결되어 있어야 합니다. 연결되면 `BLOB_READ_WRITE_TOKEN`이 자동 생성됩니다.
4. 환경변수를 변경한 뒤 해당 브랜치의 새 배포가 생성되어야 변경사항이 적용됩니다.

## 관리자 사용법

- `/admin.html`에 접속하여 관리자 토큰으로 로그인합니다.
- 쿠팡 상품을 검색합니다. 검색 결과에 생성된 **진짜 쿠팡 제휴 딥링크**가 포함된 상품만 표시됩니다.
- 제품 역할(젤/폼 세안 또는 1차 클렌징)과 제형을 확인하고 상품을 선택하여 일괄 등록합니다.
- 승인 등록한 제품만 `/api/catalog`로 노출되며 기존 4개 아마존 상품은 유지됩니다. 한국/미국 버튼으로 시장을 전환할 수 있습니다.
- `/api/admin/products`에서 삭제한 상품은 즉시 다음 카탈로그 조회에서 제외됩니다.

## 중요 보안·품질 사항

- **쿠팡 파트너스 API는 관리자 서버만 호출합니다.** 방문자의 일반 검색은 저장된 카탈로그만 사용합니다.
- 공식 파트너스 가이드에 검색 API **시간당 최대 10회** 제한이 나옵니다. 관리자 검색에서 보수적으로 8회까지 허용하며 검색 기록은 Blob에 저장합니다. 다중 동시 관리자 요청에 대한 원자적 보장은 없으므로 초과 호출은 별도로 모니터링해야 합니다.
- Vercel Secret Key는 절대 HTML/JS에 넣지 않습니다. 관리자 토큰이 설정되지 않으면 관리자 API는 401로 거부합니다.
- 상품 가격은 관리자 검색 시 참고용으로만 보여 주고 소비자에게는 실시간 가격이라고 표시하지 않습니다.
- 상품은 자동으로 무작위 게시하지 않으며 검색 + 검토 + 승인이라는 흐름으로 등록됩니다. 성분과 개인 피부 적합성은 별도 검증이 필요합니다.
- 블로그와 상품 페이지 등에 경제적 이해관계 고지를 유지해야 합니다.

## API 구조

- `GET /api/catalog`: 공개, 승인 쿠팡 상품 목록
- `GET /api/admin/status`: 관리자 인증 및 환경변수 설정 여부
- `POST /api/admin/search`: 관리자 전용 실시간 쿠팡 상품 검색 + 딥링크 변환
- `GET /api/admin/products`: 관리 상품 목록과 버전
- `POST /api/admin/products`: 최대 10개 일괄 승인 등록
- `DELETE /api/admin/products`: 승인된 상품 삭제

## 로컬 테스트

```bash
npm install
npm test
```

Vercel Functions와 Blob 연결을 포함한 통합 동작은 환경변수를 등록한 **Vercel Preview 배포**에서 확인해야 합니다.

## 문서

- 쿠팡 파트너스 이용자 가이드: https://partners.coupangcdn.com/partners-guide/partners-guide-20241216163254.pdf
- 쿠팡 파트너스 HMAC 서명: https://partner-developers.coupangcorp.com/hc/ko/articles/360053719371
