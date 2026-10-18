# 계좌 원금 1원 미만 자산 삭제 · 1.16.0 · 2026-10-18

- 작업 브랜치: connect. 기능 추가로 minor 1.16.0/versionCode 26.
- 키움: 종목별 합산 매입원금, 업비트: balance+locked × 평균 매입가. 부동소수점 대신 Decimal/BigDecimal로 반올림 전 원금을 비교. 0원과 0.999999999999원은 삭제, 정확히 1원 이상은 보존.
- 기존 계좌 데이터만 삭제하며 수동 자산은 유지. 기관의 실제 계좌·주문·잔고는 변경하지 않음.
- 서버 RPC는 전체 스냅샷 검증·업서트 후 동일 트랜잭션에서 저원금 행을 삭제. 과거 앱의 전송 대기도 같은 규칙으로 정리. 앱 로컬 캐시도 읽을 때 해당 계좌 자산을 제거하고 다시 저장.
- 위젯에서 삭제된 행은 즉시 제거하고 마지막 저장 수량·시세로 합계를 다시 계산. dailyWifiDay는 유지하고 추가 계좌·시세 조회는 실행하지 않음. 이후 일반 시세 갱신은 기존 정책 유지.
- TypeScript 및 앱/금융/공급자/계좌/DB 테스트 28개 통과. 1원 경계, 종목 합산 후 판정, 수동 보존, 과거 데이터 삭제, 재동기화 시 재등록 차단과 계좌 권한 회귀 포함.
- Supabase asset-hub에 exclude_account_dust 마이그레이션 적용. 대상 2개 삭제 후 해당 계좌 자산 0개 및 향후 RPC 정리 코드 활성 확인. 익명/인증 사용자 RPC 실행 불가, service_role만 가능.
- 보안 검사 전후 동일: 기존 유출 비밀번호 방지 미활성 경고 및 서버 전용 테이블 RLS 정책 없음 정보가 유지됨. 이번 변경으로 권한 확대 없음.
- 실제 휴대폰 설치·개인 계좌·Wi-Fi·절전 실행은 별도 확인 필요.

## APK 배포 검증

- GitHub Actions 39107533706: 타입·앱·네이티브 테스트, 서명 APK 빌드 및 Release 업로드 성공.
- 소스/태그: 50ec5de9c51f6aedbbca7ea98b94b8bfd98a1f3e / v1.16.0. Latest 정식 릴리스 확인.
- APK 42419530 bytes, com.portfolio.assettracker, versionName 1.16.0/versionCode 26, minSdk24/target36, ARM32·64.
- APK v2 서명 무결성 확인, 1.15.0과 동일 인증서 SHA256 57c07158be546f5c1224a0f9af83bc7bf8ea8b237ab13746fe4095416a6b4ada.
- 원격 APK/체크섬/ZIP 재다운로드 후 GitHub digest와 SHA256 47e5f1666969899caf95b0b2a72a740640959bb1216328abc249ea90c67d6a6e 일치. ZIP 내부 통합 자산관리 - 1.16.0.apk도 같은 해시. 직접 APK는 GitHub 파일명 정규화 때문에 asset-hub-1.16.0.apk.
- main/api-key는 기존 SHA 유지.
- [APK](https://github.com/seojunpark2-dotcom/asset-hub/releases/download/v1.16.0/asset-hub-1.16.0.apk) / [릴리스](https://github.com/seojunpark2-dotcom/asset-hub/releases/tag/v1.16.0). 실제 휴대폰 설치·동작은 별도 확인.
