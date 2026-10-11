# 통합 자산관리 · Asset Hub

여러 증권사와 업비트의 주식·ETF·암호화폐를 원화 기준으로 모아 보는 **Android 네이티브 앱**입니다. Expo / React Native / TypeScript / Supabase를 사용하며, 보유수량과 매입가격을 직접 등록합니다.

## 현재 상태
- 소스 구현: 이메일 인증, 자산 등록/수정/삭제, 대시보드, 상세정보, 정렬, 도넛 차트, 금융기관별 합산, 다크모드, 갱신 설정.
- 서버: 사용자별 RLS, 로그인 검증, 등록 종목만 시세 조회, 공급자별 캐시/호출 잠금, 실패 시 마지막 정상 가격.
- GitHub Actions에서 기존 서명을 유지하는 설치형 APK를 빌드해 GitHub Releases에 배포합니다. 실기기 설치 확인은 별도 필요합니다.
- Supabase 서버와 로그인 연결은 완료했습니다. 현재 서버에서 미국주식·국내 ETF 실제 시세 조회까지 확인했습니다. 별도 서버를 구축하면 공급자 API 키 설정이 필요합니다.
- 샘플 잔고와 가짜 시세를 앱에 넣지 않습니다. 일부 종목의 시세가 없으면 전체 평가금액/수익률을 숨기고 확인된 평가금액을 별도로 표시합니다.

## APK 다운로드
[GitHub APK 다운로드](https://github.com/seojunpark2-dotcom/asset-hub/releases/download/v1.2.2/%ED%86%B5%ED%95%A9%20%EC%9E%90%EC%82%B0%EA%B4%80%EB%A6%AC%20-%201.2.2.apk) · [릴리스 페이지](https://github.com/seojunpark2-dotcom/asset-hub/releases/tag/v1.2.2) · Android 7.0 이상 · 앱 1.2.2 · ARM 32/64비트

비공개 저장소이므로 다운로드하려면 접근 권한이 있는 GitHub 계정으로 로그인해야 합니다. APK 생성과 배포는 GitHub Actions/Gradle 및 GitHub Releases를 사용합니다. 미국주식·국내 ETF 시세는 [서버 API 키 설정](docs/API_KEYS.md)을 사용합니다.

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

Windows에서는 `Copy-Item .env.example .env`를 사용합니다. 이 앱의 자체 Android 알림 모듈은 Expo Go에서 실행되지 않습니다. 기능 확인에는 설치형 APK 또는 `npm run android` 네이티브 개발 빌드가 필요합니다.

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
.github/workflows/android-apk.yml GitHub APK 빌드/릴리스
modules/asset-expiry/            Android 단일 알림/자동 날짜 변경
eas.json                        이전 EAS 설정 (새 빌드에 사용하지 않음)
```

## 계산 및 한계
해외자산 평가금액 = 현재 USD 가격 × 수량 × 최신 일별 USD/KRW 기준환율. 원화 투자원금은 사용자가 입력한 값 또는 매입 당시 USD 가격 × 수량 × 매입 당시 환율입니다. 전체 수익률은 합산 손익 / 합산 원금이며 종목 수익률의 단순 평균이 아닙니다. 소수점 입력은 12자리까지 지원하고 PostgreSQL numeric 값을 문자열로 읽습니다.

수수료·세금·배당은 제외합니다. 국내 ETF는 한국 시장의 일별 종가를 사용하며 미국 추종지수 가격으로 대체하지 않습니다. 계좌 자동연동, 일별 손익 기록, 가격 차트, 거래내역은 향후 기능입니다. 종목 검색은 기본 내장 목록이며 나머지는 수동 입력할 수 있습니다.

## API 이용기간 만료 알림 (1.2.2)
만료예정일을 달력에서 선택하고, 7일 전 오전 9시 한국시간 알림을 한 번 예약합니다. 알림이 표시된 날부터 2년 뒤로 앱의 다음 날짜를 자동 변경합니다. 공공데이터포털의 실제 이용기간은 별도로 연장해야 합니다. 휴대폰 알림 설정은 시세 갱신 간격 아래 카드에 있습니다. [사용 안내](docs/API_EXPIRY.md)를 참고하세요.

## APK 빌드
Expo EAS 클라우드를 사용하지 않습니다. 저장소의 Actions → Android APK → Run workflow 또는 `npm run build:apk`를 실행하면 검사, 네이티브 빌드, 기존 서명 검증, SHA256 생성 및 GitHub Releases 업로드를 수행합니다. 변경 종류에 따라 major/minor/patch를 올립니다. `npm run version:bump -- patch` (오류 수정), `-- minor` (기능 추가), `-- major` (호환되지 않는 큰 변경)로 버전과 Android versionCode를 함께 올리세요. 이전 배포를 포함한 [버전 대응표](docs/VERSIONS.md)를 참고하세요. [설정 안내](docs/SETUP.md) 및 [작업 지침](AGENTS.md)을 참고하세요.
