# 위젯 갱신 대기 진단 및 복구 · 1.17.0 · 2026-10-18

- connect에서만 작업. 위젯 진단·재시도 기능 추가에 minor 적용: 1.17.0/versionCode 27.
- 서버 계좌 동기화 성공 및 기기별 두 기관 권한 활성 확인. 사용자가 위젯 갱신 대기·완료 기록 없음 상태를 보고했으나 기기 로그는 직접 접근할 수 없음.
- 사용자 명시적 허용 후 실제 보유 종목코드만 공개 시세 API에 전송하여 응답 확인. 계좌번호·수량·매입금액·비밀키는 전송하지 않음. 공개 조회에서 Yahoo 종목/통화/종류/거래소 메타데이터 및 Upbit·환율 정상 응답. 개인 보유 종목 목록은 이 문서에 기록하지 않음.
- Android 유사 Dalvik User-Agent 및 redirect:manual 조건에서 Yahoo HTTP 429 재현. 동일 URL에서 node 및 AssetHub/1.17.0 (Android; personal portfolio) 식별자 요청은 200, Upbit·환율은 Dalvik에서도 200. 네이티브 공개 시세 연결에 정직한 앱 식별자와 JSON Accept를 명시. 429 시 다른 호스트로 우회하지 않고 오류·재시도 정책을 유지.
- 위젯 처리 단계·최근 시도 시각·실패 종목/환율·HTTP/시간 초과/DNS/연결/응답 검증 오류를 저장. 원시 예외/비밀키를 UI나 로그로 보내지 않음. Wi-Fi/IP, 기기/자산 목록, 시세, 저장 충돌을 구분.
- 위젯 전용 수동 재시도: 등록 Wi-Fi/IP, 오늘 모든 기관 동기화, 1분 간격을 확인. 서버 저장 자산 목록 및 공개 시세만 요청하며 키/잔고 호출 경로 없음. 성공한 당일 결과는 다시 조회하지 않음. 자동 15분 재시도와 앱 1·5·15분 시세 정책 유지.
- 계좌 원금 1원 미만 삭제 정책 및 이전 위젯 보존·원자적 성공 반영·기기 소유자/권한/일일 기록 유지.
- TypeScript 및 앱/금융/공급자/계좌/DB 테스트 28개 통과.
- 이번 배포는 Supabase 스키마·함수·기관 키·계좌 데이터를 변경하지 않음.
- 실제 휴대폰의 최초 실패가 429였는지는 기기 로그가 없으므로 확정하지 않음. 설치 후 설정 오류/완료 상태로 확인해야 함.

## APK 배포 검증

- 최종 소스/태그: 269fe0c014ae4d7708aa9ded885627b3ca032727 / v1.17.0. GitHub Actions 39115015482 전체 성공, Latest 정식 릴리스 확인.
- Android 28/33 네이티브 테스트 통과: 명시적 앱 식별자, 실패 종목·환율 표시/예외 비노출, 기기/입력 누락 진단, 1분 재시도 간격, 저장 자산으로 재시도, 성공 후 추가 갱신 금지, 오래된 오류 거절.
- 구성한 앱 식별자로 실제 필요한 공개 시세/환율 요청 6개를 최종 재확인: HTTP 200 및 JSON 정상.
- 원격 재다운로드 APK 42421438 bytes, com.portfolio.assettracker, 통합 자산관리, versionName 1.17.0/versionCode 27, minSdk24/target36, ARM32·64.
- APK 내부 앱 식별자, retryHomeWidget, widgetError/widgetStage 마커 확인.
- APK v2 서명 무결성 확인 및 1.16.0과 동일 인증서 SHA256 57c07158be546f5c1224a0f9af83bc7bf8ea8b237ab13746fe4095416a6b4ada.
- GitHub digest·재다운로드 체크섬·ZIP 내부 통합 자산관리 - 1.17.0.apk가 SHA256 f96b6dc3f11cf16ce2b904e76fd44e09440ba57f3a8a88dec917615d55584112로 일치. 직접 APK는 GitHub 파일명 정규화 때문에 asset-hub-1.17.0.apk.
- main 0b5489c968d3a9e14bed26dff9b0b487c12bbd33, api-key cf6c1f61517e7dcfa84b64204c4fd4fba797ea72 유지.
- [APK](https://github.com/seojunpark2-dotcom/asset-hub/releases/download/v1.17.0/asset-hub-1.17.0.apk) / [릴리스](https://github.com/seojunpark2-dotcom/asset-hub/releases/tag/v1.17.0). 실제 휴대폰에서 완료 여부와 표시 오류를 확인해야 함.
