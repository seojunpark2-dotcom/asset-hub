# 현재 시세 설정 · 1.7.0

국내·미국 주식과 ETF는 Yahoo Finance 휴대폰 직접 조회입니다. 비트코인은 업비트, USD/KRW 환율은 Frankfurter입니다. 모든 시세 공급자에 별도 API 키나 증권사 계좌 등록이 필요 없습니다.

앱의 Supabase URL과 공개 publishable key는 로그인·자산 저장을 위해 계속 필요합니다. 이 공개 설정을 삭제하지 마세요. 현재 서버 함수는 portfolio-quotes-yahoo-all입니다. 이전 배포본의 서버 함수·Secrets는 별개로 보존하며 새 앱은 Finnhub를 호출하지 않습니다. [전체 조회 안내](YAHOO_FINANCE.md).
