# 통합 자산관리 · Asset Hub

국내 주식·ETF, 미국주식, 비트코인을 원화로 합산하는 Android 앱입니다. 자산을 수동 등록하거나 지원 계좌에서 자동으로 가져옵니다.

## 현재 버전 1.9.0
국내 코스피·코스닥 주식과 ETF는 휴대폰에서 Yahoo Finance로 조회합니다. 별도 국내 시세 키나 계좌 등록은 필요 없습니다. 미국주식·미국상장 ETF도 Yahoo, 비트코인은 업비트, 환율은 Frankfurter를 사용합니다. [조회 방식과 제한](docs/YAHOO_FINANCE.md).

[APK 다운로드](https://github.com/seojunpark2-dotcom/asset-hub/releases/download/v1.9.0/asset-hub-1.9.0.apk) · [릴리스](https://github.com/seojunpark2-dotcom/asset-hub/releases/tag/v1.9.0). 비공개 GitHub 계정 로그인 후 기존 앱을 삭제하지 않고 업데이트합니다. ZIP 안에는 통합 자산관리 - 1.9.0.apk 이름을 보존합니다.

키움 국내 현금 주식·ETF와 업비트 KRW 기준 코인의 자동 계좌 연동을 제공합니다. **실제 연동에는 본인 소유 고정 IP 서버·API 키 설정이 필요하며 현재 설정은 대기 상태입니다.** 설정 → 계좌 자동 연동에서 준비 상태를 확인하고 잔고 조회 성공 후 연결합니다. [서버 준비·키 발급·연결 순서](docs/ACCOUNT_CONNECTIONS.md). 미래에셋·키움 해외주식·예수금·신용거래는 이번 자동 연동 범위가 아닙니다.

위젯은 WorkManager로 한국 시간 매일 자정 00:00 이후 하루 한 번 자동 갱신합니다. 업데이트 후 앱을 한 번 열어 보유자산을 저장하세요. 절전·네트워크 제한으로 실행이 늦어질 수 있으며 로그아웃하거나 위젯을 모두 삭제하면 중단됩니다. [백그라운드 갱신 안내](docs/WIDGET_BACKGROUND.md).

가격은 5분간 재사용하며 실패 시 실제 캐시 가격 또는 시세 미확인 상태를 표시합니다. 조회한 가격이 평가금액·손익·원금 대비 수익률·분석 비중·위젯에 반영됩니다. 수수료·세금·배당은 제외합니다. 공급자 지원·실시간 제공·영구 사용을 보장하지 않습니다.

## 개발
npm ci → npm run typecheck → npm test → npm start. .env에는 Supabase URL과 공개 publishable key만 설정합니다. [설정](docs/SETUP.md), [미국주식 키](docs/API_KEYS.md), [설계](docs/ARCHITECTURE.md), [검증 이력](docs/VALIDATION.md).

Expo/React Native SDK를 사용하지만 EAS 클라우드 빌드는 사용하지 않습니다. npm run build:apk는 connect GitHub Actions를 실행하며 기존 서명·패키지를 유지합니다. 버전은 변경 종류에 따라 major/minor/patch 및 증가하는 Android versionCode를 사용합니다. [버전 이력](docs/VERSIONS.md).

modules/asset-expiry의 이름·위젯 클래스는 기존 위젯 호환성을 위해 유지합니다. 이 모듈은 위젯·일일 백그라운드 시세 조회·휴대폰 설정 열기·이전 설치본 알림 정리를 제공합니다. 폐기한 API 만료일 알림은 없습니다. 과거 APK·태그·검증 기록과 master는 보존합니다.
