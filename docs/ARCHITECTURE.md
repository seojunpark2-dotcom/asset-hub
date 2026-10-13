# 1.6.0 설계

로그인 → Supabase Auth/getUser → 사용자 RLS/등록 자산 → portfolio-quotes-yahoo-domestic → 국내 종목 목록 반환 → 휴대폰 Yahoo 조회 → Decimal 평가와 위젯 반영.

서버는 미국주식 Finnhub, 업비트, Frankfurter를 조회하고 portfolio_quote_cache_yahoo에 캐시합니다. 캐시에는 RLS가 적용되며 서비스 역할만 직접 접근합니다. 사용자 자산·설정은 기존 사용자별 RLS를 유지합니다. Secrets는 서버에만 있으며 국내 종목에는 공급자 키가 없습니다.

국내 ETF는 .KS / ETF / KOSPI / KRW를 검증합니다. 주식은 .KS / EQUITY / KOSPI, 일치하지 않으면 .KQ / EQUITY / KOSDAQ를 확인합니다. 이름이나 코드를 추정해 다른 자산 가격을 사용하지 않습니다. .KS의 429·네트워크 장애에는 .KQ로 재요청하지 않습니다. [상세](YAHOO_FINANCE.md).

5분 시세 재사용, 유효한 양수 가격·실제 기준시각 검증, 실패 시 stale 실제 캐시 또는 시세 미확인. 전체 수익률은 합산 손익/합산 원금입니다. 저장된 보유수량·원금은 변경하지 않습니다. 가격 제공·시간·호출 제한은 Yahoo 정책에 따릅니다.
