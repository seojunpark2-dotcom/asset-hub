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
- 실제 휴대폰에서 알림 수신은 사용 안내의 5초 테스트 알림으로 확인해야 합니다.## 앱 1.2.0 달력 선택과 단일 알림
- TypeScript 검사 및 앱/계산/시세/DB 격리 테스트 22개 통과.
- GitHub Actions에서 Android 네이티브 알림 코드 및 테스트 코드 컴파일, JUnit/Robolectric 테스트 4개 통과.
- 7일 전 한국시간 오전9시 단일 예약, 실제 알림일 기준 2년 뒤 날짜 계산과 윤년 처리, 중복 알림 방지, 권한 차단/알림 끄기 시 날짜 유지, 수동 날짜 선택 시 자동 변경 기록 초기화 확인.
- JavaScript 동기화 중 알림이 발생해도 Android에 저장된 자동 변경 날짜를 보존하도록 처리. 설정 수동 저장 중 이전 동기화 결과를 UI에 적용하지 않음.
- 이전 Expo 예약과 테스트 알림 제거, 별도 휴대폰 알림 설정 카드 및 Android 알림 설정 화면 이동 적용.
- 이번 버전의 APK는 Expo EAS 클라우드가 아닌 GitHub Actions/Gradle로 생성. 기존 EAS 서명키는 사용자 명시적 승인 후 GitHub Actions Secrets로 이전했으며 다운로드한 로컬 키/credentials.json은 제거. 기존 EAS 원본은 유지.
- 실제 휴대폰의 달력 UI, 알림 소리/절전/재부팅, 업데이트 설치는 실기기 검증과 별개임.
- 최종 GitHub Actions 빌드 성공: https://github.com/seojunpark2-dotcom/asset-hub/actions/runs/38120088571
- GitHub Release v1.2.0의 APK 및 SHA256 자산 업로드 상태 확인. 업로드된 APK를 다시 다운로드하여 GitHub asset digest·동봉 해시·로컬 SHA256 일치 확인.
- 다운로드 APK: 42,401,455 bytes, com.portfolio.assettracker, versionName 1.2.0/versionCode 4, min API24/target36, ARM 32/64비트.
- Android SDK apksigner로 다운로드 APK의 v2 서명 무결성 검증. 기존 1.1.0과 인증서 SHA256 일치 확인: 57c07158be546f5c1224a0f9af83bc7bf8ea8b237ab13746fe4095416a6b4ada.
- APK SHA256: FEA86F3D8748B196022420214D7FAA987C7646FF09E13EBA69F719106C7A25EC.

## 앱 1.0.3 버전 순번 정리
- 사용자 확인에 따라 APK 배포 기준: 기존 1.0.0 → 1.0.0, 1.1.0 → 1.0.1, 1.2.0 → 1.0.2. 현재 1.0.3/versionCode 5. 과거 파일과 태그를 보존하고 대응표 기록.
- GitHub Actions 성공: https://github.com/seojunpark2-dotcom/asset-hub/actions/runs/38129434365
- 새 APK 및 SHA256 업로드 완료, GitHub latest가 v1.0.3인지 확인. 다운로드 APK 내부 버전 1.0.3/code 5 및 기존 인증서 서명 무결성 검증.
- APK 42,401,451 bytes. 다운로드 SHA256/동봉 파일/GitHub asset digest 일치: 034CD82CE1D6CA552D917631363FC14AEDE0261A8E2FA42984D4058324DF1B4E.
- 별도 복사본에서 다음 버전 1.0.4/code 6, 반복 bump의 동일 결과, 이미 배포한 1.0.3 재사용 차단을 검증. 실제 앱 설정은 1.0.3 유지.

## 앱 1.2.1 변경 종류에 따른 버전 규칙 복원
- 마지막 숫자만 증가하는 이전 규칙 폐기. major=호환되지 않는 큰 변경, minor=호환 기능 추가, patch=오류 수정·기능 추가 없는 정리.
- 기존 기능 기준 1.2.0에 이번 규칙 수정 patch를 적용: 1.2.1/versionCode 6. 기존 APK와 태그 보존.
- 별도 복사본에서 patch 1.2.1/minor 1.3.0/major 2.0.0 및 하위 자리 초기화, 반복 bump 안정성, 변경 종류 생략과 이미 배포한 버전 재사용 차단 확인.
- GitHub Actions run 38130739799: 앱 테스트, 네이티브 알림 테스트, APK 생성, 서명·해시 검사 및 Release 업로드 통과.
- 다운로드 APK 내부 버전 1.2.1/code 6, 패키지 com.portfolio.assettracker, 기존 인증서 SHA256 일치, APK v2 서명 무결성 검증.
- SHA256: 9ED9E199870D36DFEB1808538FBA14FA4335B816DB2B6849C0D3B79FD2D9B8F6 (GitHub asset digest 및 SHA256 파일 일치). GitHub latest=v1.2.1 확인.
- 실제 휴대폰 설치·알림 수신은 이번 작업에서 확인하지 않음.

## 앱 1.2.2 만료일·알림 자동 저장
- 달력 확인 시 즉시 저장·알림 재예약, 취소 시 변경 없음. 켜기·끄기도 자동 저장. 저장 실패 시 선택 표시 복원, 예약 실패와 저장 실패 구분, 중복 저장 차단.
- GitHub Actions run 38134732339: TypeScript, 앱 테스트, 네이티브 알림 테스트, APK 빌드·서명·해시·업로드 통과.
- 다운로드 APK: 1.2.2/versionCode 7, 기존 패키지·인증서 일치 및 v2 서명 무결성 확인. SHA256 D666271F479B771E119069074A3D6524DE93B5E3C9B516CB5AC4ED486D0C8E67, 서버 digest 및 확인 파일 일치.
- GitHub 한글 파일명 정규화 확인: APK 표시 이름은 한글, 실제 URL은 asset-hub-1.2.2.apk. ZIP 안에 요청한 한글 APK 파일명과 해당 SHA256 보존.
- 실제 휴대폰에서의 날짜 선택·저장 동작은 이번 작업에서 직접 확인하지 않음.

## 앱 1.2.3 분석 정렬 개선
- 자산 종류와 금융기관별 원화 평가금액 내림차순 정렬. 비중과 같은 순서, 시세 누락 기관은 마지막, 동률은 기존 순서 유지. 차트·범례 동일 배열 사용. 종목명순 UI와 분기 제거.
- React 코드 점검: 새 네트워크·효과·의존성 없음, 입력 배열 변경 없음, 안정적 key 유지, 소수 비교 유지.
- GitHub Actions run 38135965568: 앱·네이티브 테스트 및 APK 생성·검증·업로드 성공. 태그 소스 4a80fddecb049b1561dabf8d8513f4f3f439bf58. Latest v1.2.3 확인.
- 다운로드 APK 표시 이름 통합 자산관리, 패키지 com.portfolio.assettracker, 1.2.3/versionCode 8, 기존 인증서 일치 및 v2 서명 무결성 확인.
- SHA256 E1FF2B6784251F8E96F3040D9ECE00C9900DE388696AA962DFFF387F2B0CF5A8, 다운로드 파일·서버 digest·SHA256 파일 일치.
- 실제 GitHub APK 이름은 asset-hub-1.2.3.apk (한글·공백 정규화 제한). ZIP의 통합 자산관리 - 1.2.3.apk 이름과 동일 해시 확인.
- 실제 휴대폰 화면 동작은 이번 작업에서 직접 확인하지 않음.

## 앱 1.2.4 차트·탭 배치 개선
- 도넛 SVG에 중심선 기준 좌우 반전 적용: 12시에서 왼쪽으로 반시계 방향. 색상 보라·초록·파랑 순서와 범례 일치. 비중 내림차순 유지.
- 분석은 Analysis만 표시하며 자산 정렬·목록·추가 버튼 분리. 홈은 보유자산 다음 금융기관별 자산, 추가 버튼은 자산 탭 조건에서만 표시. 빈 홈 안내도 자산 탭 등록으로 변경.
- React 점검: 탭 렌더 조건 및 순서 확인, 기존 데이터·키·계산 유지, 새 효과·네트워크 없음.
- GitHub Actions run 38137309919: 앱·네이티브 테스트 및 APK 빌드·검증·업로드 성공. Latest v1.2.4, 태그 소스 983de12a0fa4d18991a395ded20e9f30bca20694 일치.
- 다운로드 APK: 앱 이름 통합 자산관리, 패키지 com.portfolio.assettracker, 1.2.4/versionCode 9, 기존 인증서 일치와 v2 서명 확인.
- SHA256 2D3D1C5EC3442FAFC616860159C033DF8F6013839A710F3494317F87FCCD75D0: 다운로드·확인 파일·서버 digest 일치. ZIP 안의 통합 자산관리 - 1.2.4.apk 파일명과 동일 해시 확인.
- GitHub 파일명 정규화로 직접 APK 이름은 asset-hub-1.2.4.apk. 한글 이름은 ZIP에서 보존. 실기기 차트·탭 화면은 이번 작업에서 직접 확인하지 않음.
