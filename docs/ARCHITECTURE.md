# 설계 및 실제 시세 공급자

## 데이터 흐름
Android 앱 → Supabase Auth → 사용자별 holdings/RLS → portfolio-quotes Edge Function → 공식 또는 허용된 시세 공급자 → 서버 캐시 → Decimal 원화 평가 → 화면.

서버 함수는 사용자 JWT를 검증한 후 RLS로 사용자의 등록 종목만 읽습니다. 모바일 요청에 임의 URL/외부 키/계좌 비밀번호를 받지 않습니다. 서비스 역할 키는 Edge Functions 환경에만 존재합니다.

## 공급자 검토 (2026-10-10)
| 시장 | 구현 공급자 | 특징 및 설정 |
| --- | --- | --- |
| 업비트 KRW 암호화폐 | Upbit ticker API | 공개 키 불필요, 실제 거래 timestamp 표시, 서버 60초 캐시 |
| USD/KRW | Frankfurter v2 | 공개 키 불필요, 중앙은행/공식 기관의 일별 기준환율, 실시간 환율 아님, 6시간 캐시 |
| 미국주식/미국 ETF | Finnhub quote API | 개인용 계정 API key 필요, 최근 거래가격과 timestamp, 기본 60초 캐시, 실시간 정확성 보장 문구 사용 안 함 |
| 한국 ETF | 금융위원회 증권상품시세정보 | data.go.kr 활용신청 key 필요, KRX 일별 종가와 기준일, 1시간 캐시 |
| 국내주식 | 금융위원회 주식시세정보 | 동일 공공데이터 key로 별도 활용신청 필요, 일별 종가 |

기본 앱 갱신은 60초이며 5분/15분 선택이 가능합니다. 앱이 백그라운드에 있을 때 polling하지 않습니다. 서버는 종목별 TTL과 DB 원자 잠금으로 연속 호출을 줄입니다. 개인 포트폴리오의 최대 지원 범위는 서로 다른 49종목 + 환율입니다. 사용자별 다른 API 공급자를 사용하는 대규모 서비스로 공개할 때에는 별도 글로벌 할당량과 라이선스를 검토해야 합니다.

미국 무료 데이터 후보로 Twelve Data도 검토했습니다. Basic의 internal non-display 조건과 앱 화면 표시 권한이 모호해 기본 Provider에서 제외했습니다. Finnhub 사용 전에도 실제 가입 플랜에서 개인 앱 화면 표시 권한과 호출 제한을 확인해야 합니다. 유료 플랜을 자동 신청하지 않습니다. 한국 ETF 일별 API는 무료 후보지만 활용신청 승인·일별 쿼터와 상업적 사용 조건은 사용자 계정에서 확인해야 합니다.

공식 참고:
- https://docs.upbit.com/kr/reference/list-tickers
- https://docs.upbit.com/kr/reference/rate-limits
- https://frankfurter.dev/ko/
- https://finnhub.io/docs/api/quote
- https://finnhub.io/pricing
- https://www.data.go.kr/data/15094806/openapi.do
- https://www.data.go.kr/data/15094808/openapi.do
- https://twelvedata.com/pricing
- https://apiportal.koreainvestment.com/

한국투자증권 API는 장중 가격 조회 후보지만 해당 계정이 없으므로 기본 구현에서 제외했습니다. 필요 시 Provider 추가로 교체할 수 있습니다. 증권사 계좌 자동연동과 시세 조회 공급자는 서로 독립적입니다.

## 데이터 모델
- portfolio_profiles: auth.users와 연결된 설정.
- portfolio_holdings: 기관별 별도 보유행. 동일 종목 중복 보유 가능. 원화 원금/매입 당시 환율 저장.
- portfolio_holdings_read: security_invoker 뷰, numeric를 decimal 문자열로 반환. JSON 숫자 정밀도 손실 방지.
- portfolio_quote_cache: 비민감한 공용 시장시세. authenticated 읽기만 허용, 서버 쓰기만 허용.
- portfolio_quote_locks: 서버 전용 갱신 잠금. service_role만 claim 함수 실행.

로그인 토큰과 로컬 포트폴리오 캐시는 Android SecureStore에 분할 저장합니다. 사용자별 키로 분리하고 로그아웃 시 캐시를 삭제합니다. 오프라인에서는 마지막 동기화 데이터를 보여주며, 자산 수정은 연결이 필요합니다. 이 버전은 오프라인 편집 큐를 제공하지 않습니다.

## 확장 지점
- Provider: 시장별 supports/ttl/get 구현, 시세 기준시각·출처·지연 정보를 유지.
- 거래내역/배당: 별도 사용자별 테이블과 RLS 추가, holdings를 거래 집계로 대체.
- 일별 수익률: 사용자별 snapshot 및 서버 scheduled job 추가.
- 가격 차트: history Provider와 상세화면 확장.
- 계좌연동: 각 금융기관의 공식 API 권한/인증 검증 후 서버 어댑터 추가.
- iOS: 기본 bundleIdentifier 구성. iOS 서명/테스트는 별도 필요.
