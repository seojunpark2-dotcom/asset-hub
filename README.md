# 통합 자산관리 · Asset Hub

국내 주식·ETF, 미국주식, 비트코인을 원화로 합산하는 Android 앱입니다. 자산을 수동 등록하거나 지원 계좌에서 자동으로 가져옵니다.

## 현재 버전 1.17.0
국내 코스피·코스닥 주식과 ETF는 휴대폰에서 Yahoo Finance로 조회합니다. 별도 국내 시세 키나 계좌 등록은 필요 없습니다. 미국주식·미국상장 ETF도 Yahoo, 비트코인은 업비트, 환율은 Frankfurter를 사용합니다. [조회 방식과 제한](docs/YAHOO_FINANCE.md).

[APK 다운로드](https://github.com/seojunpark2-dotcom/asset-hub/releases/download/v1.17.0/asset-hub-1.17.0.apk) · [릴리스](https://github.com/seojunpark2-dotcom/asset-hub/releases/tag/v1.17.0) · [최신 배포 확인](https://github.com/seojunpark2-dotcom/asset-hub/releases/latest). 비공개 GitHub 계정 로그인 후 기존 앱을 삭제하지 않고 업데이트합니다. ZIP 안에는 통합 자산관리 - 1.17.0.apk 이름을 보존합니다. 설정 맨 위에서 계좌 실행·성공 시각·사용 IP·위젯 반영 상태를 확인합니다.

키움 국내 현금 주식·ETF와 업비트 KRW 기준 코인을 등록 Wi-Fi에서 휴대폰으로 직접 조회합니다. **별도 중계 서버 없이 등록 Wi-Fi 등록·기관 허용 IP·API 키와 위치 권한 설정이 필요합니다.** 한국 날짜 기준 기관별·기기별 하루 한 번 정상 잔고를 가져옵니다. [등록 Wi-Fi·키 발급·연결 순서](docs/ACCOUNT_CONNECTIONS.md). 실제 키와 휴대폰 검증은 설정 후 진행합니다. 미래에셋·키움 해외주식·예수금·신용거래 계좌 연동은 지원하지 않습니다.

계좌 조회와 위젯 시세·수익률은 WorkManager로 등록 Wi-Fi에서 한국 날짜 기준 하루 한 번 함께 자동 갱신합니다. 업데이트 후 앱을 한 번 열어 주세요. 절전·네트워크 제한으로 실행이 늦어질 수 있으며 연결 즉시 실행을 보장하지 않습니다. 로그아웃하거나 등록 Wi-Fi를 모두 삭제하면 중단됩니다. 앱 화면의 시세는 설정한 1·5·15분 간격으로 별도 갱신하며 위젯은 하루 통합 갱신 시에만 반영합니다. [백그라운드 갱신 안내](docs/WIDGET_BACKGROUND.md).

가격은 5분간 재사용하며 실패 시 실제 캐시 가격 또는 시세 미확인 상태를 표시합니다. 조회한 가격이 평가금액·손익·원금 대비 수익률·분석 비중·위젯에 반영됩니다. 수수료·세금·배당은 제외합니다. 공급자 지원·실시간 제공·영구 사용을 보장하지 않습니다.

계좌로 가져온 자산은 투자원금이 1원 미만이면 저장 데이터·앱 캐시·위젯에서 삭제합니다. 정확히 1원 이상과 수동 입력 자산은 유지합니다. 금융기관 실제 계좌의 잔고는 변경하지 않습니다.

위젯 갱신이 대기 중이면 설정 상단에서 처리 단계·실패 종목·최근 시도 시각을 확인할 수 있습니다. 위젯 갱신 다시 시도는 등록 Wi-Fi에서 저장된 계좌 자료로만 재시도하며 계좌 API를 다시 호출하지 않습니다.

## 개발
npm ci → npm run typecheck → npm test → npm start. .env에는 Supabase URL과 공개 publishable key만 설정합니다. [설정](docs/SETUP.md), [미국주식 키](docs/API_KEYS.md), [설계](docs/ARCHITECTURE.md), [검증 이력](docs/VALIDATION.md).

Expo/React Native SDK를 사용하지만 EAS 클라우드 빌드는 사용하지 않습니다. npm run build:apk는 connect GitHub Actions를 실행하며 기존 서명·패키지를 유지합니다. 버전은 변경 종류에 따라 major/minor/patch 및 증가하는 Android versionCode를 사용합니다. [버전 이력](docs/VERSIONS.md).

modules/asset-expiry의 이름·위젯 클래스는 기존 위젯 호환성을 위해 유지합니다. 이 모듈은 위젯·일일 백그라운드 시세 조회·휴대폰 설정 열기·이전 설치본 알림 정리를 제공합니다. 폐기한 API 만료일 알림은 없습니다. 과거 APK·태그·검증 기록과 master는 보존합니다.

Wi-Fi 이름·공인 IPv4 조합을 최대 10곳까지 추가·수정·삭제할 수 있습니다. 모든 장소에서 기관별 하루 한 번 조회 기록을 공유하며 기존 설정은 자동 이전합니다.
