# 1.12.0 검증 · 2026-10-17

- connect 소스 94d4049677919db5f48353ff0cbac38a4588d5b2 / GitHub Actions 39031433975 전체 성공. main 0b5489c968d3a9e14bed26dff9b0b487c12bbd33 및 api-key cf6c1f61517e7dcfa84b64204c4fd4fba797ea72 유지. 이전 빌드 39031116715는 설정 이전·예약 직렬화 보정 후 최종 소스로 교체해 취소.
- TypeScript 및 앱/게이트웨이/DB 테스트 26개 통과. Android 28/33 네이티브 테스트 통과. 추가 사례: 이전 집 Wi-Fi와 키/당일 기록/전송 대기 보존, 삭제 후 재실행 시 복원 방지, 복수 장소의 정확한 SSID/IP 조합, 같은 이름의 여러 IP, 중복·상한·잘못된 IP·사설 IP 거부, 편집/장소 이동에도 기관별 일일 제한 유지. 기존 위젯·시세·잔고 검증 회귀 검사 통과.
- Wi-Fi 목록 변경·자동 이전·백그라운드 작업 예약을 계좌 처리와 같은 잠금으로 직렬화. 여러 작업이 초기 이전 데이터를 뒤늦게 저장해 최신 목록/계좌 기록을 덮어쓰지 않도록 함. 마지막 Wi-Fi 삭제 시 계좌 주기 작업 취소, 추가 시 재예약. API 키/일일 기록은 Wi-Fi 목록과 분리 유지.
- Supabase 스키마·함수·비밀 설정 변경 없음. 등록 장소의 IP를 기관 허용 IP 목록에 등록하는 절차는 사용자 설정으로 남음.
- v1.12.0 정식 Latest·태그 소스 확인. GitHub 재다운로드 APK 42,418,162 bytes, package com.portfolio.assettracker, label 통합 자산관리, versionName1.12.0 / versionCode22, minSdk24 / target36, ARM32·64 확인.
- apksigner v2 무결성 및 기존 인증서 SHA256 57c07158be546f5c1224a0f9af83bc7bf8ea8b237ab13746fe4095416a6b4ada 일치.
- 재다운로드 APK SHA256 41c8ac2e61c7af4d392b4198d9dd6c13f3998406aa62f12268e7a18d07c9e898가 GitHub digest 및 체크섬과 일치. ZIP 안의 `통합 자산관리 - 1.12.0.apk`도 같은 해시. GitHub 이름 정규화로 직접 APK는 asset-hub-1.12.0.apk.
- 재다운로드 APK에 AccountWifiRegistry, wifiNetworks, updateAccountWifi/removeAccountWifi 및 기존 일일 작업·위젯·암호화 경로 포함 확인. 서버 관리 키·기관 키용 서버 환경변수는 번들에 없음.

실제 기관 키·휴대폰·여러 장소 Wi-Fi는 이번 검사에서 사용하지 않았다. 장소별 공인 IP 허용 등록, 실제 연결·위치 권한·밤사이 자동 조회·위젯 반영은 설치 후 확인이 필요하다. 등록 목록은 최대 10개 조합이며 기관별 허용 IP 등록 한도와는 별도다.
