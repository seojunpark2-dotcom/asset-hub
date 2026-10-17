# 1.10.0 검증 기록 · 2026-10-17

- 소스: connect / 1b87e45bc610e2486545ad6bdba55f2a0db1d560. main 0b5489c968d3a9e14bed26dff9b0b487c12bbd33 및 api-key cf6c1f61517e7dcfa84b64204c4fd4fba797ea72 유지.
- GitHub Actions 39017596561 전체 성공. TypeScript 및 앱/게이트웨이/DB 테스트 26개 통과. Android 28/33 네이티브 테스트 통과(일일 게이트, 실패 재시도 간격, 정확한 원금·수량, HS512 JWT, 키움 전체 페이지 및 불완전 응답 거부 포함). 네이티브 테스트 BUILD SUCCESSFUL 1m31s, APK 빌드 5m13s.
- 초기 빌드 39017333483은 커밋 작성자 설정 누락으로 이전 소스에 시작되어 취소. 39017380217은 연결 해제 재시도 UI 보정 후 최종 빌드로 교체하여 취소. 게시된 APK의 소스는 최종 커밋과 일치한다.
- 배포된 portfolio-accounts version 5 ACTIVE / verify_jwt true. 기기 테이블 local_snapshots 기본값 false. 과거 읽기용 토큰은 잔고 제출 403, 로그인 사용자 신규 등록으로만 제출 권한 부여.
- 임시 테스트 사용자로 실제 배포 함수의 JWT 검증, 잘못된 기기 토큰 401, 기존 토큰 제출 403, 교체 동의 누락 거부, 정상 잔고 저장/본인 조회, 음수/잘못된 수량 거부 및 기존 데이터 유지, 연결 해제, 기기 폐기 후 401 확인. 임시 사용자·연결·자산은 삭제. 실제 기관 API/실제 사용자 잔고 조회 없음.
- DB 보안 검사에서 새 경고 없음. 기존 Auth leaked-password protection disabled 경고 유지(이번 작업 범위 밖). 기기 테이블은 앱/anon 직접 접근 불가.
- GitHub Releases v1.10.0 정식 Latest 확인. APK 재다운로드 42,393,302 bytes, package com.portfolio.assettracker, label 통합 자산관리, versionName 1.10.0/versionCode20, minSdk24/target36, arm64-v8a/armeabi-v7a 확인.
- apksigner v2 서명 무결성 및 기존 인증서 SHA256 57c07158be546f5c1224a0f9af83bc7bf8ea8b237ab13746fe4095416a6b4ada 일치.
- 원격 다운로드 APK SHA256 16e5cdaf429ec7d91001152d2180026bd714efe49607c882ac1b9bde3f20bae2가 GitHub asset digest·SHA256 파일과 일치. ZIP 안의 `통합 자산관리 - 1.10.0.apk`도 같은 해시. GitHub 파일명 정규화 제약으로 직접 APK 이름은 asset-hub-1.10.0.apk.
- 재다운로드 APK에 HomeAccountSync/HomeAccountWorker/DeviceVault, 기관 고정 HTTPS 엔드포인트, Keystore AES-GCM, 정확한/백그라운드 위치 권한과 집 Wi-Fi 설정 UI 포함 확인. 서버 전용 비밀 환경변수 구성은 번들에 없음.

실제 키·휴대폰이 없어 기관 실계좌 응답, 공유기 IP 변경, Android 위치 권한, 실제 밤사이 작업·배터리 사용량은 아직 검증하지 않았다. 휴대폰의 강제 종료/권한 제한/절전과 IP 변경 조건은 ACCOUNT_CONNECTIONS.md를 따른다. 로컬 Windows 생성 프로젝트는 한글 경로 검사 후 NDK 미설치로 실행 불가여서 Linux CI의 검사를 사용했다.
