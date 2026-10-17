# Supabase 기관 키 수신 검증 · 1.13.0

- 범위: connect 브랜치, 호환되는 키 수신 기능 추가(minor), versionCode 23. main/api-key 원격 SHA는 이전 배포와 동일함을 확인.
- TypeScript 및 앱/기관 어댑터/DB/시세 테스트 27개 통과. 실제 Edge handler를 더미 환경으로 실행해 소유자 불일치·anon JWT·누락된 기기 증명·유효하지 않은 기기·scope 누락·다른 기기 소유자·미등록 키·미설정 소유자 거부, 기관별 분리 수신 및 no-store를 확인.
- Supabase portfolio-accounts v7 ACTIVE, verify_jwt=true. 기존 사용자 1명을 확인한 뒤 ACCOUNT_KEY_OWNER_USER_ID 설정. 기관 키 Secrets 4종은 미등록으로 확인했으며 값 조회/출력/로그 수집은 하지 않음.
- 격리된 임시 Auth 사용자로 실제 배포 함수에서 키 요청과 상태 조회 거부, 공개 anon JWT의 키 수신 거부, 기존 기기 scope·스냅샷 동의·원자적 잔고 저장·잘못된 잔고 거부·연결 해제·기기 폐기를 확인하고 임시 사용자를 삭제.
- DB 스키마/RLS 변경 없음. 보안 advisor는 기존의 leaked-password protection WARN과 의도한 서버 전용 테이블의 RLS-no-policy INFO를 반환. 이번 변경으로 새 공개 키 저장 테이블은 만들지 않음.
- Android 28/33 네이티브 테스트 50개 통과: 로그인 변경 시 키 수신/저장 거부 및 파일 미생성, 기존 Wi-Fi/일일 기록과 위젯 회귀 포함. 첫 시도의 추가 테스트가 JVM에서 지원되지 않는 Android Keystore를 불필요하게 호출해 실패했으며 파일 미생성 확인으로 수정 후 재검증.
- 키는 네이티브 HTTPS 응답에서만 처리하고 Keystore AES-GCM으로 백업 제외 경로에 저장. 사용자 JWT는 저장하지 않음. JS에는 성공/실패만 전달. 기존 저장 키 및 하루 한 번 조회 기록을 보존.
- 실제 개인 키·기관 잔고·Wi-Fi/절전 중 실행과 휴대폰 설치는 미검증. 사용자가 기관 키와 허용 IP를 설정한 뒤 확인 필요.

Supabase 최신 변경 내역(2026-10-14), Edge Functions Secrets 및 auth.getUser 문서를 확인함. 11월 예정 CBC TLS 1.2 폐기는 현대 Android의 GCM 연결을 제거하지 않음.

## 원격 APK 검증 완료

- GitHub Actions [39034111562](https://github.com/seojunpark2-dotcom/asset-hub/actions/runs/39034111562) 성공. 소스/태그: 89fc8da5aa80a04d8f1db48f4a1e236b65bd1d54, v1.13.0. Latest 정식 릴리스 확인.
- GitHub에 게시된 APK·SHA256·ZIP을 별도 경로로 다시 내려받음. APK 42419926 bytes, com.portfolio.assettracker, 1.13.0/versionCode 23, 표시 이름 통합 자산관리, minSdk 24/targetSdk 36, arm64-v8a/armeabi-v7a 확인.
- APK v2 서명 무결성 검증 및 1.12.0과 인증서 일치. 인증서 SHA256: 57c07158be546f5c1224a0f9af83bc7bf8ea8b237ab13746fe4095416a6b4ada.
- APK SHA256: 3cc24e35c80b0367133cc9769226c3d30453da311a9d5bfcffade190aa56149a. GitHub 자산 digest·동봉 체크섬과 일치. ZIP 안의 통합 자산관리 - 1.13.0.apk도 같은 해시.
- APK Dex에 네이티브 importSupabaseAccount/credentials 경로·Keystore 암호화와 기존 계좌/위젯 모듈 확인. JS 번들에 키 가져오기 브리지 확인. 서비스 역할/서버 gateway 비밀 설정은 포함하지 않음. UI에 표시하는 Secrets 항목명과 실제 비밀값은 구분.
- 직접 다운로드: [APK](https://github.com/seojunpark2-dotcom/asset-hub/releases/download/v1.13.0/asset-hub-1.13.0.apk), [릴리스](https://github.com/seojunpark2-dotcom/asset-hub/releases/tag/v1.13.0). GitHub 파일명 정규화 제약으로 직접 APK는 ASCII 이름이며 요청한 한글 파일명은 ZIP 내부에 보존.

