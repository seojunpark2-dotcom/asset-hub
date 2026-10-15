# 1.9.0 계좌 연동 검증 기록

- 소스: connect / 1f8e0180a5de39593ef8397489397406ebe1dc9c. MINOR 1.9.0, versionCode 19.
- TypeScript 검사 및 앱·게이트웨이·DB 테스트 26개 통과. 업비트 잠금 수량·소수 수량·원금 0, 키움 ETF 분류·중복 현금 잔고 합산·연속조회·토큰 재사용, 게이트웨이 인증/소유자/주문 경로 차단, 트랜잭션·RLS·연결 해제를 검증했다.
- GitHub Actions 38749268651에서 Android 28/33 네이티브 위젯·예약·원금 0 검사 통과 및 기존 서명 APK 생성·업로드.
- 새 DB 마이그레이션 적용 후 익명/앱 사용자의 기기 토큰 테이블 접근과 잔고 반영 RPC 호출이 차단됨을 확인했다. 실제 사용자 자산은 연결이 없는 상태로 유지했다.
- portfolio-accounts 활성 배포, 기본 JWT 검증 true. 사용자 JWT와 별도 기기 토큰을 검증한다. 위젯에는 관리 키 대신 공개 anon JWT 및 제한된 기기 토큰을 사용한다.
- 배포 서버의 임시 사용자로 JWT 차단, 본인 상태 조회, 서버 미설정 시 연결 실패, 기기 토큰 인증·폐기를 확인했다. 임시 사용자 삭제 후 남은 테스트 계정 0개 및 실제 계좌 연결 생성 0개를 확인했다.
- 보안 점검의 기존 유출 비밀번호 보호 경고는 이번 변경 전과 동일하다. https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. 새 기기 테이블은 서버 전용으로 RLS 및 클라이언트 권한 회수를 적용하여 정책 없는 RLS 정보 항목이 의도된 상태다.
- 다운로드 APK: 42,370,230 bytes / com.portfolio.assettracker / 1.9.0 / versionCode 19 / Android 7 이상 ARM 32·64비트. 계좌 화면·기기 토큰 브리지·Android Keystore AES-GCM 저장·네이티브 동기화 코드 포함을 확인했다. 서버 전용 계좌 키 설정은 번들에 없다.
- APK v2 서명 검증 및 기존 인증서 SHA256 57c07158be546f5c1224a0f9af83bc7bf8ea8b237ab13746fe4095416a6b4ada 일치.
- APK SHA256: 66633af24abeb25f718a75019a9f08fb99803214ab38f9366982e4c61c4ca3b7. GitHub digest·재다운로드·확인 파일·ZIP 내부 APK 모두 일치했다. GitHub 파일명 정규화 때문에 직접 자산명은 asset-hub-1.9.0.apk이며 ZIP 내부에 통합 자산관리 - 1.9.0.apk를 보존했다.
- Latest v1.9.0 및 태그 소스 확인. main과 api-key 브랜치는 변경하지 않았다. 과거 APK·태그를 보존했다.

## 아직 확인하지 못한 항목

개인 고정 IP 서버와 키움·업비트 API 키가 없어 실제 계좌 잔고는 조회하지 않았다. 서버 HTTPS·송신 IP·기관 권한과 실계좌별 응답, 실제 휴대폰의 Keystore·자정 갱신·배터리 소모량은 설정 후 검증해야 한다. 유료 서버는 생성하지 않았다. [설정 안내](ACCOUNT_CONNECTIONS.md)를 따른다.
