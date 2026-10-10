# 주식·ETF 시세 키 연결

현재 앱은 Supabase 로그인/자산관리와 업비트 공개 시세가 연결되어 있습니다. 미국주식 및 국내 ETF는 아래 키를 서버에 추가하면 활성화됩니다. APK를 재설치할 필요는 없습니다.

## Finnhub 미국주식
1. https://finnhub.io/ 에서 개인용 무료 계정을 생성합니다.
2. 대시보드에서 API key를 발급받습니다.
3. 개인 포트폴리오 앱 화면 표시가 허용되는지와 quote API의 무료 호출 한도를 확인합니다. 유료 가입은 필요 시 별도로 판단합니다.

## 국내상장 ETF
1. https://www.data.go.kr/data/15094806/openapi.do 에서 금융위원회 증권상품시세정보 활용신청을 합니다.
2. ETF 시세 조회 서비스의 승인과 개발계정 호출 한도를 확인합니다.
3. 일반 인증키 중 **디코딩된 키**를 사용합니다.
4. 국내 개별주식도 등록할 경우 https://www.data.go.kr/data/15094808/openapi.do 의 주식시세정보도 활용신청합니다.

이 데이터는 한국 시장의 일별 종가입니다. 미국 지수를 추종하는 ETF도 한국 ETF 종가로 평가합니다. 실시간 가격이나 미국 기초지수 가격으로 표시하지 않습니다.

## 안전한 서버 설정
작업 폴더의 supabase/functions/.env.example을 .env로 복사합니다.

```powershell
Copy-Item supabase/functions/.env.example supabase/functions/.env
```

텍스트 편집기에서 각 키를 해당 항목 뒤에 입력합니다.
```env
FINNHUB_API_KEY=발급받은_키
DATA_GO_KR_SERVICE_KEY=발급받은_디코딩_키
```

서버에 업로드합니다.
```sh
npx supabase secrets set --env-file supabase/functions/.env
```

현재 서버 함수는 이미 배포했습니다. 앱을 아래로 당겨 새로고침하세요. 이전 실패 호출의 제한 때문에 60초 정도 기다린 후 갱신해야 할 수 있습니다. 키 승인/한도 오류가 계속되면 공급자의 계정 설정을 확인해야 합니다.

비밀키는 앱의 .env(EXPO_PUBLIC_), GitHub, 채팅에 넣지 않습니다. 서버 설정파일은 .gitignore로 제외되어 있습니다. 인증이 필요한 시세는 앱이 아닌 Supabase Edge Function이 호출합니다.

## 현재 연결 정보
- 저장소: https://github.com/seojunpark2-dotcom/asset-hub (비공개)
- Supabase: https://supabase.com/dashboard/project/dznohmimroyfgopjiqki
- 함수: portfolio-quotes
- Expo: https://expo.dev/accounts/seojunpark2/projects/asset-hub

자산은 사용자의 계정에 저장되며, 시세 키와 증권사 보유계좌는 독립적입니다. 미래에셋/키움 계좌 비밀번호나 공동인증서를 제공하지 않습니다.
