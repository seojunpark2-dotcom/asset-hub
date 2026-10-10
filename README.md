# 통합 자산관리 · Asset Hub

여러 증권사와 업비트의 주식·ETF·암호화폐를 원화 기준으로 모아 보는 **Android 네이티브 앱**입니다. Expo / React Native / TypeScript / Supabase를 사용하며, 보유수량과 매입가격을 직접 등록합니다.

## 현재 상태
- 소스 구현: 이메일 인증, 자산 등록/수정/삭제, 대시보드, 상세정보, 정렬, 도넛 차트, 금융기관별 합산, 다크모드, 갱신 설정.
- 서버: 사용자별 RLS, 로그인 검증, 등록 종목만 시세 조회, 공급자별 캐시/호출 잠금, 실패 시 마지막 정상 가격.
- APK 생성용 EAS 프로필 구성. **설치형 APK 생성 완료. 실기기 설치 확인은 아직 완료하지 않았습니다.**
- Supabase 서버와 로그인 연결은 완료했습니다. 현재 서버에서 미국주식·국내 ETF 실제 시세 조회까지 확인했습니다. 별도 서버를 구축하면 공급자 API 키 설정이 필요합니다.
- 샘플 잔고와 가짜 시세를 앱에 넣지 않습니다. 일부 종목의 시세가 없으면 전체 평가금액/수익률을 숨기고 확인된 평가금액을 별도로 표시합니다.

## APK 다운로드
[EAS 설치/다운로드 화면](https://expo.dev/accounts/seojunpark2/projects/asset-hub/builds/9cc823bc-2b1f-4076-a3f3-25ffaa826a6b) · Android 7.0 이상 · 앱 1.1.0 · 약 74MB

미국주식·국내 ETF 시세는 [서버 API 키 설정](docs/API_KEYS.md) 후 활성화됩니다.

## 실행
Node.js LTS를 설치한 뒤 작업 폴더에서:

```sh
npm ci
cp .env.example .env
# .env에 Supabase URL과 공개 publishable key 설정
npm run typecheck
npm test
npm start
```

Windows에서는 `Copy-Item .env.example .env`를 사용합니다. Android Expo Go를 통한 개발 실행과 설치형 APK 배포는 별개입니다.

## 서버와 APK 설정
[설정/빌드 안내](docs/SETUP.md), [설계 및 시세 공급자](docs/ARCHITECTURE.md), [검증 기록](docs/VALIDATION.md)을 참고하세요.

## 주요 구조
```text
App.tsx                         인증·탭·대시보드·상세·설정
src/HoldingForm.tsx              자산 등록/수정
src/Charts.tsx                   SVG 도넛 차트
src/finance.ts                  Decimal 기반 원화 평가와 손익
src/portfolio.ts                사용자별 서버 데이터/캐시
src/storage.ts                  SecureStore 분할 암호화 저장
supabase/migrations/            SQL 및 RLS
supabase/functions/              서버 전용 시세 Providers
tests/                          계산·시장구분·오류·RLS 테스트
eas.json                        설치형 APK 프로필
```

## 계산 및 한계
해외자산 평가금액 = 현재 USD 가격 × 수량 × 최신 일별 USD/KRW 기준환율. 원화 투자원금은 사용자가 입력한 값 또는 매입 당시 USD 가격 × 수량 × 매입 당시 환율입니다. 전체 수익률은 합산 손익 / 합산 원금이며 종목 수익률의 단순 평균이 아닙니다. 소수점 입력은 12자리까지 지원하고 PostgreSQL numeric 값을 문자열로 읽습니다.

수수료·세금·배당은 제외합니다. 국내 ETF는 한국 시장의 일별 종가를 사용하며 미국 추종지수 가격으로 대체하지 않습니다. 계좌 자동연동, 일별 손익 기록, 가격 차트, 거래내역은 향후 기능입니다. 종목 검색은 기본 내장 목록이며 나머지는 수동 입력할 수 있습니다.

## API 이용기간 만료 알림 (1.1.0)
설정에서 만료예정일과 남은 일수를 확인하고, 30·7·1일 전과 당일 오전9시 한국시간 알림을 예약합니다. 기본 만료일은 2028-10-11이며 연장 후 직접 수정합니다. 설치와 알림 허용은 [사용 안내](docs/API_EXPIRY.md)를 참고하세요.
