# 현재 시세 API 설정

국내 주식·ETF는 Yahoo Finance 휴대폰 직접 조회입니다. 키나 계좌 등록이 필요 없습니다. 업비트와 Frankfurter도 별도 키를 사용하지 않습니다.

미국주식에는 Finnhub 개인용 키가 필요합니다. Finnhub에서 발급받은 값을 Supabase asset-hub → Edge Functions → Secrets의 FINNHUB_API_KEY에 저장합니다. 키 값은 채팅·GitHub·앱 EXPO_PUBLIC_ 변수에 넣지 않습니다. 저장 후 새로고침하며 APK 재빌드는 필요 없습니다.

현재 함수는 portfolio-quotes-yahoo-domestic입니다. 기존 배포본을 위한 이전 서버 함수·Secrets는 별개로 유지합니다. 새 앱의 국내 조회는 이전 공급자를 호출하지 않습니다. [전체 국내 조회 안내](YAHOO_FINANCE.md).
