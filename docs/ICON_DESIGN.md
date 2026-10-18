# 앱 아이콘

앱 분석 화면의 자산 구성 도넛을 모티프로 삼았습니다. 보라 #8D6BEB, 청록 #12B9A5, 파랑 #3366FF와 다크 화면의 #101723 / #1B2536, 본문색 #F4F7FC를 사용합니다. 왼쪽 보라색 호와 세 개의 둥근 막대로 자산 구성·성장을 표현합니다.

assets/icon.svg는 일반 아이콘, icon-foreground.svg와 icon-background.svg는 Android 적응형 레이어, icon-monochrome.svg는 Android 13 테마 레이어입니다. PNG는 모두 1024×1024이며 전경·단색은 투명 배경입니다. 마스크는 런처가 적용하므로 적응형 전경에 사각 배경이나 모서리를 그리지 않습니다.

108dp 좌표계에서 전경의 최대 반경은 약 29dp로 66dp 지름의 안전 원 안에 있습니다. preview-circle.png와 preview-rounded.png는 잘림/작은 크기 확인용 미리보기입니다.

재생성: node scripts/generate-icons.cjs <sharp 모듈 경로>. SVG와 커밋한 PNG를 함께 갱신합니다. GitHub 빌드는 PNG를 사용하므로 생성 도구용 의존성을 별도로 설치하지 않습니다. Expo 사전 빌드로 일반·원형·배경·전경·단색의 5개 밀도 리소스와 adaptive-icon XML 생성을 확인했습니다.
