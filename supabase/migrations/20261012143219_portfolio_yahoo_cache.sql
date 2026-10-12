create table public.portfolio_quote_cache_yahoo (like public.portfolio_quote_cache including all);
alter table public.portfolio_quote_cache_yahoo enable row level security;
revoke all on public.portfolio_quote_cache_yahoo from public,anon,authenticated;
grant all on public.portfolio_quote_cache_yahoo to service_role;
