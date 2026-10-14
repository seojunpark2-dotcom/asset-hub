# Asset Hub 프로젝트 작업 지침

## 앱 버전 (사용자 최신 요청: 2026-10-11)
- 마지막 숫자만 올리던 이전 규칙은 폐기한다. major.minor.patch를 변경 종류에 따라 사용한다.
- major: 기존 사용 방식·데이터·연동과 호환되지 않는 큰 변경. minor: 호환되는 기능 추가. patch: 오류 수정 또는 기능 추가 없는 UI·문서·설정 정리. 여러 변경이 있으면 가장 높은 종류를 적용한다.
- major를 올리면 중간·마지막을 0, minor를 올리면 마지막을 0으로 초기화한다. 단순한 디자인·개발 도구 변경만으로 major를 올리지 않는다.
- 과거 실제 버전 1.0.0/1.1.0/1.2.0/1.0.3과 APK·태그를 보존한다. 현재 기능 기준 1.2.0에 이번 규칙 수정을 patch로 적용해 1.2.1/versionCode 6을 사용한다. docs/VERSIONS.md 참고.
- 마지막 성공 배포를 release-history.json에 기록하고 plannedRelease를 제거한 뒤 npm run version:bump -- major|minor|patch로 앱/패키지/잠금 파일과 Android versionCode를 갱신한다. 변경 종류를 명시하며 내부 수정·테스트·재시도는 별도 버전으로 세지 않는다.
- versionCode는 이전 설치본보다 반드시 증가시키고 기존 서명을 유지한다. 새 버전은 GitHub Release의 Latest로 명시한다.

## APK 빌드와 배포 (사용자 요청: 2026-10-11)
- 앞으로 앱 수정 후 APK 생성에 Expo EAS 클라우드 빌드를 사용하지 않는다.
- APK는 GitHub Actions 또는 로컬 Android 빌드 환경에서 생성하고 GitHub Releases에 업로드한다.
- Expo/React Native SDK를 사용하는 앱 소스는 유지할 수 있다. SDK 사용과 Expo 클라우드 빌드 서비스 사용은 구분한다.
- npm run build:apk는 GitHub Actions android-apk.yml을 실행한다. eas.json은 이전 설정으로 보관하며 새 빌드에 사용하지 않는다.
- 기존 설치 앱을 업데이트할 수 있도록 같은 Android 패키지와 기존 서명키를 유지하고 versionCode를 증가시킨다. 서명키·비밀번호는 저장소에 커밋하거나 로그·채팅에 출력하지 않는다.
- 빌드가 완료된 실제 APK와 SHA256을 GitHub Releases에 올리고 업로드 상태와 파일 해시를 확인한다.
- 사용자에게 GitHub APK 다운로드 링크 및 설치 순서를 제공한다. 현재 저장소는 비공개이므로 접근 가능한 GitHub 계정의 로그인이 필요하다.
- GitHub Actions/Gradle 빌드 경로는 2026-10-11에 앱 1.2.0으로 검증 완료했다. 네이티브 알림 테스트, APK 서명 무결성 및 기존 인증서 일치, GitHub 업로드와 다운로드 해시를 확인했다. 실기기 설치·알림 수신은 별도 확인한다.

## Yahoo Finance 작업 (2026-10-12)
- codex/yahoo-finance에서만 변경하며 master는 유지한다. 국내 ETF는 휴대폰 직접 Yahoo 조회·5분 캐시를 사용한다. 별도 키나 계좌 등록은 없으며 영구 제공을 보장하지 않는다. docs/YAHOO_FINANCE.md 참고.


## 국내 시세 전체 Yahoo 전환 (2026-10-13)
- 1.6.0부터 국내 개별주식·ETF 모두 Yahoo 직접 조회한다. 폐기 공급자의 소스·설정·예약 기능은 현재 브랜치에서 제거한다. 기존 위젯 식별자와 알림 취소용 업그레이드 정리는 유지한다. master와 과거 배포 이력은 보존한다.

## 미국 시세 Yahoo 전환 및 작업 브랜치 (2026-10-14)
- 미국주식·미국상장 ETF도 Yahoo 휴대폰 직접 조회로 전환한다. 이후 이 앱의 작업은 codex/yahoo-finance에서만 진행하고 master 및 다른 브랜치는 변경하지 않는다. 코인·환율 공급자는 유지한다.
