# 통합 자산관리 · Asset Hub

국내 주식·ETF, 미국주식, 비트코인을 원화로 합산하는 Android 앱입니다. 보유수량과 매입가격을 직접 등록합니다.

## 현재 버전 1.6.0
국내 코스피·코스닥 주식과 ETF는 휴대폰에서 Yahoo Finance로 조회합니다. 별도 국내 시세 키나 계좌 등록은 필요 없습니다. 미국주식은 Finnhub, 비트코인은 업비트, 환율은 Frankfurter를 사용합니다. [조회 방식과 제한](docs/YAHOO_FINANCE.md).

[APK 다운로드](https://github.com/seojunpark2-dotcom/asset-hub/releases/download/v1.6.0/asset-hub-1.6.0.apk) · [릴리스](https://github.com/seojunpark2-dotcom/asset-hub/releases/tag/v1.6.0). 비공개 GitHub 계정 로그인 후 기존 앱을 삭제하지 않고 업데이트합니다. ZIP 안에는 통합 자산관리 - 1.6.0.apk 이름을 보존합니다.

가격은 5분간 재사용하며 실패 시 실제 캐시 가격 또는 시세 미확인 상태를 표시합니다. 조회한 가격이 평가금액·손익·원금 대비 수익률·분석 비중·위젯에 반영됩니다. 수수료·세금·배당은 제외합니다. 공급자 지원·실시간 제공·영구 사용을 보장하지 않습니다.

## 개발
npm ci → npm run typecheck → npm test → npm start. .env에는 Supabase URL과 공개 publishable key만 설정합니다. [설정](docs/SETUP.md), [미국주식 키](docs/API_KEYS.md), [설계](docs/ARCHITECTURE.md), [검증 이력](docs/VALIDATION.md).

Expo/React Native SDK를 사용하지만 EAS 클라우드 빌드는 사용하지 않습니다. npm run build:apk는 codex/yahoo-finance GitHub Actions를 실행하며 기존 서명·패키지를 유지합니다. 버전은 변경 종류에 따라 major/minor/patch 및 증가하는 Android versionCode를 사용합니다. [버전 이력](docs/VERSIONS.md).

modules/asset-expiry의 이름·위젯 클래스는 기존 위젯 호환성을 위해 유지합니다. 이 모듈은 위젯·휴대폰 설정 열기·이전 설치본 알림 정리만 제공하며 예약·만료일 계산 기능은 없습니다. 과거 APK·태그·검증 기록과 master는 보존합니다.
