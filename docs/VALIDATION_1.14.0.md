# 계좌 조회 전 최신 키 자동 수신 검증 · 2026-10-18

- 앱 1.14.0/versionCode 24, 호환되는 기능 추가(minor). connect만 변경. main/api-key는 이전 배포 SHA와 동일함을 확인.
- Supabase Secrets 등록은 이름 5개(기관 키 4개+소유자 ID)만 확인. 실제 개인 키 값과 개인 계좌는 개발 도구로 조회하지 않음.
- DB migration 20261017171555_device_credential_refresh_scope: 기존 기기 credential_providers 기본값 빈 배열. service_role 전용 SECURITY INVOKER 함수로 원자적 기관 권한 부여/해제. anon/authenticated 함수 실행과 기기 테이블 접근 금지 검증. 새 DB 키 저장 테이블 없음.
- 서버 portfolio-accounts v12 ACTIVE/verify_jwt=true. 초기 JWT 인증+기기 증명으로 기관 권한 등록. 이후 background-credentials에서 유효 기기·현재 소유자·해당 기관 권한을 대조. 예전 스냅샷 토큰·공개 anon JWT만으로 수신 불가. no-store 응답 유지.
- TypeScript 및 앱/DB/기관 어댑터/시세 테스트 27개 통과. 더미 키로 신규/교체 키 수신, scope 없는 기기/다른 기관/다른 사용자/만료·폐기 거부, 권한 등록 실패 시 키 미반환, 일반 앱 역할의 RPC 권한 금지, DB 원자적 추가/삭제/중복 처리를 확인.
- 실제 배포 함수는 임시 Auth 사용자로 기존 스냅샷 저장/조회·교체 동의·잘못된 잔고 거부·연결 해제·기기 폐기와 background-credentials의 소유자 우회 거부를 검증. 임시 사용자·데이터 삭제 완료. 실제 사용자 키는 받지 않음.
- Supabase 보안 advisor는 이전과 동일한 서버 전용 테이블 RLS-no-policy INFO 및 Auth leaked-password protection WARN. 새 공개 키 경로·SECURITY DEFINER 없음.
- Android는 조회 조건/일일 기록을 먼저 확인하고, 실제 신규 잔고가 필요할 때 최신 키를 받아 기관을 조회. 키 수신 실패 시 이전 저장 키 fallback 없음. 정상 수신한 pending 잔고는 키/기관 조회 없이 재전송. 최근 키 수신 시각 표시. 신규 기관은 첫 연결 동의, 기존 연결은 앱 시작 시 본인 JWT로 기관 권한 이전. 사용자 JWT/refresh token을 네이티브 백그라운드용으로 저장하지 않음.
- 앱 시작의 기기 등록/권한 이전이 계좌 조회보다 먼저 완료되도록 순서를 보장. 기존 foreground 중복 실행 방지/serial 기기 등록을 유지하고 독립적인 상태 조회는 병렬 실행. React 스킬 기준으로 변경 TSX의 hooks·중복 요청·제어 비밀 노출을 점검.
- 주기: 계좌 한국 날짜·기관·기기당 정상 잔고 1회, WorkManager 15분 실행 기회 및 30분 실패 간격. 위젯은 별도 자정 일일 시세+계좌 반영 직후+앱 활성 시 설정한 시세 간격(기본 1분). Yahoo 5분 캐시/일별 기준 환율 유지. 정확한 정각은 보장하지 않음.
- Supabase changelog/Secrets와 Android 공식 WorkManager 문서를 확인. 실제 기관 키/계좌·휴대폰 설치·Wi-Fi 및 절전 상태 실행은 미검증.

## 배포 APK 검증 완료

- 소스/태그: 9e257c9b4bcb1585c2f148a2d189ac008d36ce5e / v1.14.0. Latest 정식 릴리스와 태그 소스 일치 확인.
- [빌드 및 테스트](https://github.com/seojunpark2-dotcom/asset-hub/actions/runs/39053188681): TypeScript/앱 27개 및 Android 28/33 네이티브 52개 검사 통과. 네이티브에서 최신 키 사용·오래된 키 fallback 금지·pending 업로드 시 키/기관 재조회 금지·로그인 변경 거부·기존 Wi-Fi/위젯 회귀를 검증.
- GitHub에 게시된 APK/체크섬/ZIP을 별도 경로로 재다운로드. APK 42,420,626 bytes, com.portfolio.assettracker, 1.14.0/versionCode 24, 표시 이름 통합 자산관리, minSdk 24/targetSdk 36, arm64-v8a/armeabi-v7a 확인.
- APK Dex에서 background-credentials/lastKeyFetched 경로·기존 기기 보안 저장소와 계좌/위젯 코드를 확인. JS에는 연결 브리지/안내만 포함하며 서버 서비스 역할 설정과 gateway 비밀 설정이 없음. Secrets 항목명과 실제 비밀값은 구별.
- apksigner v2 무결성 검증 및 1.13.0 인증서 일치: SHA256 57c07158be546f5c1224a0f9af83bc7bf8ea8b237ab13746fe4095416a6b4ada.
- APK SHA256 38174747fda998095a3e7bfa6b5ba79f24f53e295f0b2759773e35cd707a4581: GitHub digest 및 직접 APK 체크섬과 일치. ZIP의 통합 자산관리 - 1.14.0.apk도 같은 해시. GitHub 파일명 정규화 제한으로 직접 APK는 ASCII 파일명, 요청한 한글 파일명은 ZIP 안에 보존.
- [다운로드](https://github.com/seojunpark2-dotcom/asset-hub/releases/download/v1.14.0/asset-hub-1.14.0.apk) / [릴리스](https://github.com/seojunpark2-dotcom/asset-hub/releases/tag/v1.14.0). 실제 휴대폰 설치/개인 계좌 조회는 별도 확인 필요.

