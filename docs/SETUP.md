# Supabase 연결과 Android APK 설치

## 1. 계정 연결
작업 폴더 터미널에서 실행하세요. 비밀번호·인증 코드·토큰은 채팅 또는 저장소에 넣지 않습니다.

```sh
npx supabase login
gh auth login
```

사용자가 asset-hub 프로젝트를 생성하고 CLI에 로그인했습니다. 연결된 프로젝트는 dznohmimroyfgopjiqki (싱가포르)입니다. 해당 전용 프로젝트에 SQL 마이그레이션과 portfolio-quotes 함수를 배포했으므로 같은 SQL을 다시 실행하지 마세요. 신규 환경에 설치할 때에만 아래 초기 설정을 진행합니다. 유료 플랜을 자동 신청하지 않습니다.

## 2. 데이터베이스
대시보드 프로젝트 URL에서 project-ref를 확인합니다.
```sh
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```
CLI 또는 데이터베이스 인증이 필요하면 로컬 프롬프트에서 입력하세요. SQL Editor에서 supabase/migrations의 SQL을 실행하는 방법도 가능합니다. 기존 다른 서비스 테이블을 덮어쓰지 않습니다.

## 3. 로그인 설정
Supabase Auth에서 Email 로그인과 가입을 활성화합니다. 이메일 확인을 활성화한 경우 가입 후 인증 메일 링크를 클릭한 뒤 앱에서 로그인하세요. 가입/이메일 발송 제한은 해당 플랜을 확인하세요.

앱의 .env에는 공개 키만 넣습니다.
```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```
publishable key는 클라이언트용이며 RLS가 접근을 제한합니다. service_role, sb_secret, 시세 API key는 넣으면 안 됩니다.

## 4. 시세 공급자
- [Finnhub](https://finnhub.io/)에서 개인용 무료 계정을 생성합니다. 화면 표시 권한과 무료 호출 한도를 확인하세요. 미국주식 quote 접근이 실제로 가능한지 가입 후 테스트해야 합니다.
- [금융위원회 증권상품시세정보](https://www.data.go.kr/data/15094806/openapi.do) 활용신청으로 ETF API key를 발급합니다. 국내주식도 사용할 경우 [주식시세정보](https://www.data.go.kr/data/15094808/openapi.do) 활용신청을 추가합니다.
- Upbit와 Frankfurter에는 key가 필요하지 않습니다.

서버용 설정파일은 supabase/functions/.env.example을 복사해 supabase/functions/.env에 저장하세요. DATA_GO_KR_SERVICE_KEY에는 **디코딩된 키**를 사용합니다.

```sh
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy portfolio-quotes
```
portfolio-quotes는 JWT 검증을 유지합니다. --no-verify-jwt를 붙이지 않습니다. SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY는 Supabase Edge 런타임에서 제공됩니다. 모바일에 이 서버 키들을 복사하지 마세요.

## 5. 기능 검증
```sh
npm run typecheck
npm test
npx tsx tests/live-prices.ts
npm start
```
실계정에서 가입/로그인 → 자산 5개 입력 → 재시작 → 수정/삭제 → 시세 조회 → 로그아웃/다른 계정 확인을 수행하세요. 주식 API key가 없으면 설정 필요 안내를 보여주며 전체 수익률은 계산하지 않습니다. 공급자별 실패는 해당 종목만 영향을 받습니다.

## 6. GitHub Actions APK
새 APK는 EAS 클라우드를 사용하지 않습니다. `.github/workflows/android-apk.yml`이 npm 검사 → Expo 네이티브 프로젝트 생성 → Android 알림 테스트 → Gradle release 빌드 → 서명/패키지/버전/해시 검증 → GitHub Releases 업로드를 실행합니다. ARM 32/64비트 Android를 지원합니다.

저장소 Actions Secrets에는 `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`를 설정합니다. 기존 앱의 서명키를 유지해야 합니다. 비밀값은 코드·명령줄·로그에 남기지 않습니다. Repository Variables에는 공개 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정합니다.

`app.json`의 앱 버전과 Android versionCode 및 `package.json` 버전을 올리고 커밋·push합니다. GitHub Actions → Android APK → Run workflow 또는 `npm run build:apk`로 실행합니다. 같은 버전 릴리스가 이미 있으면 새 버전으로 올립니다. Secrets를 사용하는 릴리스 빌드는 수동 실행만 허용하며 PR에서는 실행하지 않습니다. `.env`, 생성된 `/android`, 다운로드한 서명 파일은 커밋하지 않습니다.

기존 `eas.json`은 이전 설정으로 보관하며 새 APK 생성에 사용하지 않습니다.

## 7. Android 설치
1. APK 파일을 스마트폰으로 다운로드합니다.
2. 해당 브라우저/파일 앱에 한해 '알 수 없는 앱 설치'를 허용합니다.
3. APK를 열어 설치하고 '통합 자산관리'를 실행합니다.
4. 로그인·자산등록·가격 조회·당겨서 갱신·재시작 후 유지 여부를 확인합니다.
5. 설치 후 사용하지 않는 설치 권한은 해제합니다.

패키지는 com.portfolio.assettracker입니다. 동일 패키지의 다른 서명 앱이 설치돼 있으면 업데이트가 거부될 수 있습니다. 기존 설치의 데이터 보존 여부를 확인하고 처리하세요.

현재 소스/번들 검증은 APK 설치 테스트와 다릅니다. APK가 생성되기 전에는 설치 완료로 보고하지 않습니다.
