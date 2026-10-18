# 하루 Wi-Fi 통합 갱신 검증 · 1.15.0 · 2026-10-18

- 범위: connect 브랜치. 호환되는 통합 갱신 기능 추가(minor), versionCode 25. main/api-key 원격 SHA는 이전 배포와 동일함을 확인.
- 계좌·시세·위젯을 HomeAccountWorker 한 진입점에서 실행. 등록 SSID/공인 IPv4와 한국 날짜 완료 기록을 먼저 확인. 계좌 중복 조회 방지·키 최신 수신·암호화 outbox는 유지.
- 모든 활성 기관의 오늘 잔고 업로드가 완료되어야 위젯 조회. 일부 계좌 실패는 완료 기록과 outbox를 유지하고 실패 기관만 재시도. 전체 시세가 완전할 때만 위젯을 원자 반영하며 dailyWifiDay도 같은 AtomicFile 쓰기로 저장. 다음 실행은 완료 날짜를 보고 네트워크 전에 종료.
- WidgetRefreshEngine.refreshOnWifi는 실제 price/FX HTTP를 검증한 Android Network에 고정하고 commit 전에도 같은 Wi-Fi인지 확인. Wi-Fi를 잃어도 모바일 데이터로 우회하지 않음.
- 기존 자정 태그 전체를 취소하고 영속 예약된 WidgetRefreshWorker는 네트워크/쓰기 없는 no-op으로 유지. 별도 자정 enqueue 경로 제거. 하나의 기존 주기 작업은 15분 작업 기회에 조건만 확인하며 당일 완료 후에는 조회하지 않음.
- 앱 foreground의 1/5/15분 시세와 Yahoo 5분 캐시·일별 환율을 유지. foreground widget snapshot 쓰기 effect를 제거하고 이전 updateWidget 브리지는 마지막 화면 redraw만 수행. 시세만 바뀐 입력은 widget revision을 바꾸지 않음. 색상·보유자산 변경은 정당한 revision 변경으로 지연 결과를 거부.
- TypeScript 및 앱/기관 어댑터/DB/가격/금융 계산 테스트 27개 통과. 변경 TSX는 React 스킬 기준으로 기존 hooks cleanup·병렬 상태 조회와 serial 기기 등록을 유지하는지 점검.
- Supabase 서버 함수·DB·Secrets 변경 없음. 실제 개인 키나 계좌는 개발 도구로 조회하지 않음. 기존 소유자/기관별 기기 권한·Keystore 암호화·로그아웃 정리를 유지.
- 실제 휴대폰 설치·Wi-Fi·기관 계좌·절전 중 실행은 미검증. Android 공식 문서의 최소 15분 주기/실행 제약을 확인했으며 연결 즉시/정각 실행을 보장하지 않음.

## 최종 검증 완료

- GitHub Actions [39104735747](https://github.com/seojunpark2-dotcom/asset-hub/actions/runs/39104735747) 전체 성공. 앱 27개 검사 및 Android 28/33 네이티브 검사 통과. 초기 취소 테스트의 nullable WorkInfo 처리를 수정한 뒤 동일 배포 단위로 재검증.
- 네이티브 검증: 모든 활성 기관의 당일 업로드 완료 대기, partial-price 미반영, 당일 두 번째 snapshot commit 거부, foreground updateWidget의 값 덮어쓰기 방지, quote-only 입력 revision 유지, 미래 시각의 기존 자정 예약 취소, 기존 키/일일 기록/outbox/금융 계산/위젯 레이아웃 회귀.
- 소스/태그: e76062e7ee1838550f7dd8d8fa04e9e5beffab1b / v1.15.0. Latest 정식 릴리스와 태그 소스 확인.
- 게시된 APK/체크섬/ZIP을 별도 경로로 재다운로드. APK 42,418,926 bytes, com.portfolio.assettracker, 1.15.0/versionCode 25, 통합 자산관리, minSdk 24/targetSdk 36, arm64-v8a/armeabi-v7a 확인.
- APK Dex의 dailyWifiDay/refreshOnWifi/기존 계좌 경로 확인, JS foreground syncPortfolioWidget 경로 제거 확인. 서버 비밀 설정은 번들에 포함하지 않음.
- apksigner v2 서명 무결성과 1.14.0 인증서 일치 확인: SHA256 57c07158be546f5c1224a0f9af83bc7bf8ea8b237ab13746fe4095416a6b4ada.
- APK SHA256 77e00223fbb5fb81c3a98c59bdb5fe8aa47608f2c2e2a0461c9f985e3c45c029: GitHub digest와 체크섬 일치. ZIP 내부 통합 자산관리 - 1.15.0.apk도 같은 해시. GitHub 파일명 정규화로 직접 파일은 ASCII이며 요청한 한글 파일명은 ZIP에 보존.
- [APK](https://github.com/seojunpark2-dotcom/asset-hub/releases/download/v1.15.0/asset-hub-1.15.0.apk) / [릴리스](https://github.com/seojunpark2-dotcom/asset-hub/releases/tag/v1.15.0). 실제 휴대폰 설치/개인 계좌/Wi-Fi/절전 실행은 별도 확인 필요.

