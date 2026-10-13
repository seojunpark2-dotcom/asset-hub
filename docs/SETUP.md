# 서버와 Android 설정

현재 asset-hub 프로젝트 dznohmimroyfgopjiqki에는 마이그레이션과 portfolio-quotes-yahoo-domestic 함수를 배포했습니다. 동일 SQL을 다시 적용하지 마세요.

신규 환경에서 Supabase Auth 이메일 로그인, 사용자 RLS 마이그레이션을 구성합니다. 앱의 .env에는 EXPO_PUBLIC_SUPABASE_URL과 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY만 넣습니다. 서버의 FINNHUB_API_KEY는 Edge Functions Secrets에 등록합니다. 국내 주식·ETF·업비트·환율에는 키가 필요 없습니다.

함수 배포: npx supabase functions deploy portfolio-quotes-yahoo-domestic --project-ref YOUR_PROJECT_REF --use-api. JWT 검증을 해제하지 않습니다. 서비스 역할 키를 앱에 넣지 않습니다.

검증: npm run typecheck / npm test / npx tsx tests/live-yahoo.ts. 실제 API 검사는 인증된 CLI를 사용하며 임시 테스트 사용자를 만든 뒤 삭제합니다. 사용자 실제 자산은 변경하지 않습니다.

APK: npm run build:apk. GitHub Actions가 앱·위젯·업그레이드 정리 검사, 기존 서명 APK 생성, SHA256 및 ZIP 생성, Releases 업로드를 실행합니다. Android 7 이상 ARM 32/64비트를 지원합니다. 기존 서명 Secrets와 공개 Supabase Repository Variables가 필요합니다. EAS 클라우드 빌드는 사용하지 않습니다.

설치: 권한 있는 GitHub 계정 로그인 → APK 다운로드 → 해당 다운로드 앱의 설치 권한 허용 → 기존 앱 위에 업데이트 → 로그인·새로고침. 기존 앱 삭제부터 진행하지 않습니다. 실기기 동작 확인은 별도로 필요합니다.
