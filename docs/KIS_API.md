# 한국투자 자동 토큰 관리 · api 브랜치 1.4.0

국내 상장 ETF와 국내주식의 공급자를 한국투자증권 실전 REST API로 변경했습니다. 보유 자산을 한국투자로 옮길 필요는 없습니다. 기존 미래에셋·키움 보유수량과 매입가격을 그대로 사용하고, 시세만 한국투자에서 조회합니다.

## 최초 한 번 필요한 설정

현재 사용자는 한국투자 계좌·앱키가 없습니다. 따라서 국내 시세는 아직 활성화되지 않았습니다. 앱이 계좌 개설이나 앱키 발급을 대신하지 않습니다.

1. [한국투자 Open API 포털](https://apiportal.koreainvestment.com/)의 개인고객 신청 절차에 따라 계좌와 실전용 서비스 신청을 완료하고 앱키·시크릿을 발급합니다.
2. [Supabase asset-hub 프로젝트](https://supabase.com/dashboard/project/dznohmimroyfgopjiqki/functions)의 Edge Functions → Secrets에 `KIS_APP_KEY`, `KIS_APP_SECRET`을 각각 저장합니다. Publishable key를 바꾸는 것이 아닙니다. 모의투자용 키와 혼용하지 마세요.
3. 앱에서 새로고침합니다. APK를 다시 빌드할 필요는 없습니다. 키 미등록 상태에서는 안내를 표시하고 국내 시세를 만들지 않습니다. 이전 가격이 남아 있다면 마지막 정상 시세로만 표시합니다.

키·계좌 비밀번호·인증코드를 채팅, 앱의 EXPO_PUBLIC_ 환경변수, GitHub 코드에 넣지 마세요. CLI를 사용할 경우 비밀 값을 명령줄에 직접 쓰지 말고 무시되는 `supabase/functions/.env` 파일과 `--env-file`을 사용합니다.

## 자동 처리

- 국내 시세 요청 시 `/oauth2/tokenP`로 접근 토큰을 발급합니다. 응답의 실제 만료시간을 사용하며 토큰 만료 90초 전부터 재발급합니다. 사용자는 토큰이나 날짜를 입력하지 않습니다.
- 토큰은 서비스 역할만 접근 가능한 비공개 DB에 저장합니다. Edge Function 재시작·동시 실행에도 재사용합니다. 앱키·시크릿의 해시로 저장 대상을 구분해 키 교체 후 이전 토큰을 사용하지 않습니다.
- 원자적 잠금과 61초 발급 간격으로 동시 요청 및 장애 중 중복 발급을 막습니다. 인증 거부 시 해당 토큰만 무효화하고 한 번 재시도합니다. 대기·호출 제한·네트워크 오류는 다음 앱 조회 때 재시도합니다.
- 국내 종목 시세는 60초 캐시와 초당 1회 호출 예산을 사용합니다. 제한 초과 시 반복 호출하거나 0원으로 대체하지 않습니다.
- 앱 설정에 키 등록 여부와 접근 토큰 만료시간을 보여줍니다. 기존 공공데이터 만료일 입력 화면을 제거하고 로그인 시 해당 기기의 기존 만료 알림 예약을 해제합니다. 휴대폰 알림 설정 카드는 유지합니다.

토큰은 필요할 때 발급합니다. 앱을 사용하지 않는 동안 매일 발급할 필요가 없으며 다음 조회 때 자동으로 유효한 토큰을 확보합니다.

## 가격과 날짜의 의미

ETF는 `/uapi/etfetn/v1/quotations/inquire-price` / `FHPST02400000`, 국내주식은 `/uapi/domestic-stock/v1/quotations/inquire-price` / `FHKST01010100`으로 `stck_prpr`을 조회합니다. 시장 구분은 J입니다. 미국 기초지수 가격으로 대체하지 않습니다.

ETF REST 응답에는 최종 체결시각이 없습니다. 따라서 앱은 **조회 시점 현재가**와 조회시각을 표시합니다. 장 마감·휴일에는 마지막 가격일 수 있으며 조회시각을 체결시각으로 보장하지 않습니다.

## 자동화 범위와 기존 앱 보호

**접근 토큰의 재발급과 앱키 자체의 이용기간 연장은 다릅니다.** 앱키 만료·폐기, 서비스 해지, 공급자 정책 변경까지 자동 연장하거나 영구 사용을 보장하지 않습니다. 이런 경우 한국투자 계정에서 조치한 뒤 서버 키를 교체해야 할 수 있습니다. 공공데이터포털 이용기간 자동 연장도 수행하지 않습니다.

`master`는 수정하지 않습니다. 새 앱은 별도 `portfolio-quotes-kis` 함수 및 `portfolio_quote_cache_kis` 캐시를 사용합니다. 기존 `portfolio-quotes` 함수와 공공데이터 키는 유지하므로 기존 APK의 시세 조회 경로를 바꾸지 않습니다. 자산·설정 테이블은 기존 것을 사용하며 사용자별 RLS가 유지됩니다.

## 검증과 공식 명세

토큰 재사용·만료·동시 발급·인증 오류 복구·발급 장애와 DB 접근 제한을 자동 테스트했습니다. 실제 서버의 인증/자산 CRUD/RLS, 신규 업비트 조회, 키 미등록 안내 및 익명 요청 거부도 확인했습니다. **실제 한국투자 토큰 발급·가격 조회는 키가 없어서 아직 검증하지 못했습니다.** 실기기 설치와 기존 알림 해제도 별도 확인이 필요합니다.

- [한국투자 공식 인증 예제](https://github.com/koreainvestment/open-trading-api/blob/main/examples_user/kis_auth.py)
- [한국투자 공식 ETF 현재가 예제](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/etfetn/inquire_price/inquire_price.py)
- [Supabase 비밀번호 보호 안내](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection): 배포 전후 기존 leaked password protection 경고가 유지됨. 이번 변경으로 Auth 설정을 변경하지 않았습니다.
- [RLS 정책 없음 진단 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy): 토큰·신규 서버 캐시는 클라이언트 접근을 막는 service_role 전용이므로 허용 정책이 없는 상태가 의도된 설계입니다.
