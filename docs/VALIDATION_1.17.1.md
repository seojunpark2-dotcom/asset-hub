# 앱 아이콘 개선 · 1.17.1 · 2026-10-18

- connect에서만 변경. 기능 추가 없는 아이콘 디자인 개선에 patch: 1.17.1/versionCode 28.
- 기존 기본 Android 아이콘을 앱 전용 도넛·성장 막대 심벌로 교체. 앱 분석 화면과 같은 보라 #8D6BEB / 청록 #12B9A5 / 파랑 #3366FF, 다크 UI 배경 #101723 / #1B2536, 텍스트색 #F4F7FC 사용.
- SVG 원본과 생성 스크립트, 1024px PNG 일반/적응형 전경·배경/단색 레이어 보관. Expo 설정에 일반·Android·적응형·테마 아이콘을 명시.
- 원형·둥근 사각형 마스크 및 실제 생성된 192px Android 아이콘을 시각 확인. 전경 최대 반경 273.7px로 1024px 이미지의 Android 66dp 안전 원(반경 312.9px) 이내.
- 모든 PNG 1024×1024 확인. 전경·단색 투명 배경, 일반·배경 불투명.
- 로컬 Expo prebuild 성공. mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi 일반·원형·전경·배경·단색 WebP 생성 및 adaptive-icon XML의 foreground/background/monochrome 연결 확인.
- TypeScript 및 앱/패키지/잠금 파일/Android 버전 일치 확인. 저위험 디자인 변경으로 신규 기능 테스트는 추가하지 않음.
- 실제 휴대폰의 런처 표시/테마 아이콘 설정은 별도 확인 필요.

## APK 배포 검증

- GitHub Actions 39127620347 전체 성공: TypeScript·앱 테스트 28개·Android 28/33 회귀 테스트·서명 APK·GitHub 업로드.
- 소스/태그: 6784701466ceb93204c59142a30051087520b15a / v1.17.1. Latest 정식 릴리스 확인.
- 재다운로드 APK 42522213 bytes, com.portfolio.assettracker, 통합 자산관리, versionName 1.17.1/versionCode 28, minSdk24/target36, ARM32·64.
- APK v2 서명 무결성 확인 및 1.17.0과 동일 인증서 SHA256 57c07158be546f5c1224a0f9af83bc7bf8ea8b237ab13746fe4095416a6b4ada.
- APK의 실제 일반 아이콘 res/sK.webp 추출·시각 확인 및 로컬 생성 아이콘과 바이트 일치. 적응형 XML res/BW.xml은 배경 0x7f0e0001, 전경 0x7f0e0002, 단색 0x7f0e0003에 연결됨. xxxhdpi 전경 res/5c.webp와 단색 res/IG.webp도 추출해 시각 확인.
- GitHub digest·재다운로드 체크섬·ZIP 내부 통합 자산관리 - 1.17.1.apk가 SHA256 d31615dd83572c57a46cad36d772aa58e48f9e2c41c0806318f81b8796f18b72로 일치. 직접 APK는 GitHub 파일명 정규화 때문에 asset-hub-1.17.1.apk.
- main 0b5489c968d3a9e14bed26dff9b0b487c12bbd33, api-key cf6c1f61517e7dcfa84b64204c4fd4fba797ea72 유지.
- [APK](https://github.com/seojunpark2-dotcom/asset-hub/releases/download/v1.17.1/asset-hub-1.17.1.apk) / [릴리스](https://github.com/seojunpark2-dotcom/asset-hub/releases/tag/v1.17.1). 실제 휴대폰 런처 표시는 설치 후 확인해야 함.
