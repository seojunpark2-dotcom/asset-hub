-- Dedicated app tables. Holdings are never shared between users.
create table public.portfolio_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{"dark":false,"interval":60,"colors":"kr"}'::jsonb,
  constraint valid_settings check (
    settings ?& array['dark','interval','colors'] and jsonb_typeof(settings->'dark') = 'boolean' and
    settings->>'interval' in ('60','300','900') and settings->>'colors' in ('kr','global')
  )
);
create table public.portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution text not null check (institution in ('미래에셋증권','키움증권','업비트','기타 증권사','기타 거래소')),
  asset_type text not null check (asset_type in ('domestic_stock','foreign_stock','domestic_etf','foreign_etf','crypto')),
  symbol text not null, name text not null check (length(name) between 1 and 120),
  quantity numeric not null check (quantity > 0 and quantity < 1e18 and scale(quantity) <= 12),
  average_purchase_price numeric not null check (average_purchase_price > 0 and average_purchase_price < 1e18 and scale(average_purchase_price) <= 12),
  purchase_currency text not null check (purchase_currency in ('KRW','USD')),
  purchase_exchange_rate numeric check (purchase_exchange_rate > 0 and purchase_exchange_rate < 1e18 and scale(purchase_exchange_rate) <= 12),
  original_investment_krw numeric not null check (original_investment_krw > 0 and original_investment_krw < 1e60 and scale(original_investment_krw) <= 12),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint market_currency check (
    (asset_type in ('foreign_stock','foreign_etf') and purchase_currency='USD' and symbol ~ '^[A-Z][A-Z0-9.\-]{0,14}$')
    or (asset_type in ('domestic_stock','domestic_etf') and purchase_currency='KRW' and symbol ~ '^[0-9]{6}$')
    or (asset_type='crypto' and purchase_currency='KRW' and symbol ~ '^KRW-[A-Z0-9]{2,15}$')
  )
);
create index portfolio_holdings_user_idx on public.portfolio_holdings(user_id);
create function public.portfolio_touch_updated_at() returns trigger
language plpgsql security invoker set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
create trigger portfolio_holdings_updated before update on public.portfolio_holdings
for each row execute function public.portfolio_touch_updated_at();
-- Decimal strings prevent JSON number precision loss in JavaScript.
create view public.portfolio_holdings_read with (security_invoker=true) as
select id,user_id,institution,asset_type,symbol,name,quantity::text,
average_purchase_price::text,purchase_currency,purchase_exchange_rate::text,
original_investment_krw::text,created_at,updated_at from public.portfolio_holdings;

create table public.portfolio_quote_cache (
  symbol text not null, market text not null check (market in ('KR','US','UPBIT','FX')),
  currency text not null check (currency in ('KRW','USD')),
  current_price text not null check (current_price ~ '^[0-9]+(\.[0-9]+)?$' and current_price::numeric > 0),
  updated_at timestamptz not null, fetched_at timestamptz not null,
  source text not null, delayed boolean not null,
  primary key(market,symbol)
);
create table public.portfolio_quote_locks (
  key text primary key, next_at timestamptz not null
);
-- Atomic provider throttle works across Edge Function instances.
create function public.portfolio_claim_quote(p_key text,p_seconds integer)
returns boolean language sql security invoker set search_path='' as $$
  with claimed as (
    insert into public.portfolio_quote_locks(key,next_at)
    values(p_key,now()+make_interval(secs=>greatest(1,least(p_seconds,86400))))
    on conflict(key) do update set next_at=excluded.next_at
      where portfolio_quote_locks.next_at <= now()
    returning key
  ) select exists(select 1 from claimed);
$$;
revoke all on function public.portfolio_claim_quote(text,integer) from public,anon,authenticated;
grant execute on function public.portfolio_claim_quote(text,integer) to service_role;
revoke all on function public.portfolio_touch_updated_at() from public,anon,authenticated;
alter table public.portfolio_profiles enable row level security;
alter table public.portfolio_holdings enable row level security;
alter table public.portfolio_quote_cache enable row level security;
alter table public.portfolio_quote_locks enable row level security;
create policy profiles_select on public.portfolio_profiles for select to authenticated using ((select auth.uid())=user_id);
create policy profiles_insert on public.portfolio_profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy profiles_update on public.portfolio_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy holdings_select on public.portfolio_holdings for select to authenticated using ((select auth.uid())=user_id);
create policy holdings_insert on public.portfolio_holdings for insert to authenticated with check ((select auth.uid())=user_id);
create policy holdings_update on public.portfolio_holdings for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy holdings_delete on public.portfolio_holdings for delete to authenticated using ((select auth.uid())=user_id);
create policy quote_select on public.portfolio_quote_cache for select to authenticated using (true);
revoke all on public.portfolio_profiles,public.portfolio_holdings,public.portfolio_holdings_read,public.portfolio_quote_cache,public.portfolio_quote_locks from anon,authenticated;
grant select,insert,update on public.portfolio_profiles to authenticated;
grant select,insert,update,delete on public.portfolio_holdings to authenticated;
grant select on public.portfolio_holdings_read,public.portfolio_quote_cache to authenticated;
grant all on public.portfolio_profiles,public.portfolio_holdings,public.portfolio_quote_cache,public.portfolio_quote_locks to service_role;
grant select on public.portfolio_holdings_read to service_role;

-- Shared account budgets keep multiple users from exceeding provider quotas.
create table public.portfolio_provider_budgets (
  provider text primary key, window_start timestamptz not null, calls integer not null
);
alter table public.portfolio_provider_budgets enable row level security;
revoke all on public.portfolio_provider_budgets from anon,authenticated;
grant all on public.portfolio_provider_budgets to service_role;
create function public.portfolio_claim_budget(p_provider text,p_limit integer,p_window integer)
returns boolean language sql security invoker set search_path='' as $$
 with claimed as (
  insert into public.portfolio_provider_budgets(provider,window_start,calls)
  values(p_provider,now(),1)
  on conflict(provider) do update set
   window_start=case when portfolio_provider_budgets.window_start + make_interval(secs=>p_window)<=now() then now() else portfolio_provider_budgets.window_start end,
   calls=case when portfolio_provider_budgets.window_start + make_interval(secs=>p_window)<=now() then 1 else portfolio_provider_budgets.calls+1 end
  where portfolio_provider_budgets.calls<p_limit or portfolio_provider_budgets.window_start + make_interval(secs=>p_window)<=now()
  returning provider
 ) select exists(select 1 from claimed);
$$;
revoke all on function public.portfolio_claim_budget(text,integer,integer) from public,anon,authenticated;
grant execute on function public.portfolio_claim_budget(text,integer,integer) to service_role;
