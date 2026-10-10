# 검증 기록 · 2026-10-11

## 완료한 검증
- TypeScript: tsc --noEmit 통과.
- 자동 테스트 20개 통과. 실제 PostgreSQL 엔진(PGlite)에서 스키마 실행 및 사용자 A/B/anon RLS, 문자열 numeric 읽기, 서버 전용 시세 쓰기/갱신 잠금/공급자 공용 할당량 검증.
- 환차손익·소수점 BTC·원금 가중 수익률·시세 누락 처리·국내 ETF 종가 선택·API 실패 처리 검증.
- Expo Doctor 21/21 통과, Deno Edge Function 타입 검사 통과, Android Hermes 번들 생성 성공.
- Upbit KRW-BTC 및 Frankfurter USD/KRW 실 API 응답 확인.
- asset-hub Supabase(싱가포르) 실제 마이그레이션 적용 및 portfolio-quotes 배포 완료.
- 실서버에서 임시 계정 2개로 이메일/비밀번호 로그인, 자산 등록/문자열 정밀도 읽기/수정/삭제, 설정 저장, 계정 간 RLS 격리, 사용자 소유권 변경 차단 검증.
- 실제 로그인 JWT로 Edge Function을 호출하여 업비트 가격 조회 성공. 익명 요청은 401로 거부. 로그아웃 확인. 테스트 계정 모두 삭제.
- 서버 security advisors: 경고/오류 없음. portfolio_quote_locks/portfolio_provider_budgets의 RLS 정책 부재 안내(INFO) 2건은 의도한 클라이언트 접근 차단입니다. 테이블 권한과 RPC는 service_role에만 부여했습니다.
- performance advisors: 알림 없음.
- EAS Free 플랜 및 Android 무료 빌드 0/15회 확인 후 preview APK 빌드 시작.

## 아직 확인하지 못한 항목
- 국내 개별주식 V2 실조회: 주소는 공식 명세로 갱신했으나 별도 활용신청 및 해당 종목 실조회는 미검증입니다.
- Android 스마트폰에서 화면/접근성/실제 설치/재실행을 포함한 전체 사용자 흐름. 서버 테스트와 실기기 테스트는 다릅니다.
- 공급자 가입 플랜의 개인용 화면 표시 권한과 계정별 무료 할당량.

## 의존성 점검
npm audit에서 Expo/Metro 빌드 도구의 braces, node-forge 및 uuid 취약점 알림이 남아 있습니다. 현재 조회된 최신 braces/node-forge에도 알림이 남아 있고, 자동 fix는 Expo/React Native를 오래된 major 버전으로 내리도록 제안하므로 적용하지 않았습니다. EAS CLI는 앱 의존성에서 제거하고 버전을 고정한 npx 명령으로 실행합니다. 업스트림 수정 버전을 확인해야 합니다.

## 최종 APK
- EAS 빌드 성공: https://expo.dev/accounts/seojunpark2/projects/asset-hub/builds/a554cd65-3a34-4270-9d55-b4e8341bb34e
- 파일: artifacts/asset-hub-1.0.0.apk (76,449,885 bytes)
- 패키지: com.portfolio.assettracker, versionName 1.0.0, versionCode 2
- Android 최소 버전: 7.0 (API 24), target API 36
- ABI: arm64-v8a, armeabi-v7a, x86, x86_64
- ZIP/DEX/manifest 구조와 APK 서명 블록 존재 확인. 인증서 체인/실제 설치 검증과 별개입니다.
- 최종 권한: INTERNET, 내부 DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION. 카메라/마이크/외부 저장소/진동/생체인증 권한 없음.
- SHA-256: 0F9AB12DFC4C6F79DCC3B2D220773A97A48E6FE7A0F731945B76D3FE085C042F
- Windows 에뮬레이터 실행 시 가상화 드라이버 부재로 부팅 실패. 드라이버 설치 없는 소프트웨어 모드도 종료되어 UI/설치 실행 검증은 완료하지 못했습니다. 스마트폰 설치 안내를 참고하세요.

## 2026-10-11 API 키 연결 확인
- 공식 포털 Swagger 명세에서 ETF/주식 V2 API 주소 확인. 구 ETF 주소의 SERVICE_KEY_IS_NOT_REGISTERED_ERROR(403)를 새 주소로 변경하여 해결.
- 실제 사용자 서버 키로 AAPL 336.64 USD(2026-10-09), TIGER 미국S&P500(360750) 26,025 KRW(2026-10-07), USD/KRW 1341.99 기준환율 조회 성공. Upbit BTC 및 인증/RLS/CRUD 검증도 통과. 임시 계정과 자산 삭제 완료.
- 키 Encoding/Decoding 자동 처리, 공급자 오류 코드만 표시하며 키/요청 URL/원문 응답은 노출하지 않도록 회귀 테스트 추가.
- 서버 함수 재배포 완료. APK 재설치는 필요하지 않습니다. ETF는 거래일 다음 영업일 이후 제공되는 일별 종가이며 실시간 가격이 아닙니다.
## 앱 1.1.0 API 이용기간 만료 알림
- 날짜 유효성/윤년/한국시간 자정 경계, 30·7·1·0일 전 오전9시 예약, 지난 알림 제외, 중복 방지, 연장일 변경/계정 변경/권한 거부 시 예약 정리 테스트 통과.
- 기존 설정 JSON에 만료일·알림 선호 저장 가능 및 계정 간 RLS 격리: PGlite와 실제 Supabase 임시 계정 검증 통과. 임시 계정 삭제 완료.
- Expo Doctor 21/21, TypeScript, Android Hermes 번들 통과. expo-notifications 57.0.22 고정.
- Android 알림 실제 수신·권한 UI·재부팅 복구·알림 클릭 이동은 실기기 미검증. 앱에 5초 테스트 알림 및 권한 설정 이동을 제공함.
- 특별 exact alarm 권한은 추가하지 않으며, Android의 inexact alarm fallback을 사용하므로 절전 등으로 지연 가능.
## 앱 1.1.0 APK 생성 확인
- EAS 성공: https://expo.dev/accounts/seojunpark2/projects/asset-hub/builds/9cc823bc-2b1f-4076-a3f3-25ffaa826a6b
- APK: https://expo.dev/artifacts/eas/sWsCZp5ADucsw9x5es5t-fZVcJ7m1H8Z9_JA_BJcOjU.apk
- 로컬 artifacts/asset-hub-1.1.0.apk, 77,989,264 bytes, versionName 1.1.0/versionCode 3, min API24/target36.
- 1.0.0과 1.1.0 APK의 v2 서명 인증서 SHA256 일치 확인. APK 서명 무결성 전체 검증 또는 실기기 업데이트 설치 테스트와 별개입니다.
- POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED 포함 확인. 알림 라이브러리의 네트워크/깨우기/FCM 수신/런처 배지 관련 권한도 포함되어 있습니다. 앱에서 원격 푸시 토큰을 요청하거나 배지 표시를 활성화하지 않습니다.
- 파일 SHA256: 8CD7CAB9E8A39D1CF337574C781C19143A93D10B65C65D621685112732B399F8.
- 실제 휴대폰에서 알림 수신은 사용 안내의 5초 테스트 알림으로 확인해야 합니다.