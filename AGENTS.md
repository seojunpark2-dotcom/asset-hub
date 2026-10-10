# Asset Hub 프로젝트 작업 지침

## APK 빌드와 배포 (사용자 요청: 2026-10-11)
- 앞으로 앱 수정 후 APK 생성에 Expo EAS 클라우드 빌드를 사용하지 않는다.
- APK는 GitHub Actions 또는 로컬 Android 빌드 환경에서 생성하고 GitHub Releases에 업로드한다.
- Expo/React Native SDK를 사용하는 앱 소스는 유지할 수 있다. SDK 사용과 Expo 클라우드 빌드 서비스 사용은 구분한다.
- 현재 npm run build:apk 및 eas.json은 기존 EAS 빌드용 설정이다. 새 APK 생성에 그대로 사용하지 않는다.
- 기존 설치 앱을 업데이트할 수 있도록 같은 Android 패키지와 기존 서명키를 유지하고 versionCode를 증가시킨다. 서명키·비밀번호는 저장소에 커밋하거나 로그·채팅에 출력하지 않는다.
- 빌드가 완료된 실제 APK와 SHA256을 GitHub Releases에 올리고 업로드 상태와 파일 해시를 확인한다.
- 사용자에게 GitHub APK 다운로드 링크 및 설치 순서를 제공한다. 현재 저장소는 비공개이므로 접근 가능한 GitHub 계정의 로그인이 필요하다.
- 새로운 GitHub/로컬 빌드 경로는 아직 구성·검증하지 않았다. 다음 APK 생성 작업에서 설정하고 검증해야 하며, 현재 설정되어 있다고 보고하지 않는다.