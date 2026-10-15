-- Account credentials stay on the user's fixed-IP gateway, never in public tables.
create table public.portfolio_connections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider in ('kiwoom','upbit')),
 enabled boolean not null default true,
 last_synced_at timestamptz,
 unique(user_id,provider), unique(id,user_id)
);
alter table public.portfolio_connections enable row level security;
create policy connection_read on public.portfolio_connections for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.portfolio_connections from anon,authenticated;
grant select on public.portfolio_connections to authenticated;
grant all on public.portfolio_connections to service_role;

alter table public.portfolio_holdings add column connection_id uuid;
alter table public.portfolio_holdings add constraint holdings_connection_owner foreign key(connection_id,user_id) references public.portfolio_connections(id,user_id);
create unique index portfolio_connected_symbol on public.portfolio_holdings(connection_id,symbol) where connection_id is not null;
create index portfolio_connections_user on public.portfolio_connections(user_id);
alter table public.portfolio_holdings drop constraint portfolio_holdings_average_purchase_price_check;
alter table public.portfolio_holdings add constraint portfolio_holdings_average_purchase_price_check check(average_purchase_price>=0 and average_purchase_price<1e18 and scale(average_purchase_price)<=12);
alter table public.portfolio_holdings drop constraint portfolio_holdings_original_investment_krw_check;
alter table public.portfolio_holdings add constraint portfolio_holdings_original_investment_krw_check check(original_investment_krw>=0 and original_investment_krw<1e60 and scale(original_investment_krw)<=12);
alter table public.portfolio_holdings drop constraint market_currency;
alter table public.portfolio_holdings add constraint market_currency check (
 (asset_type in ('foreign_stock','foreign_etf') and purchase_currency='USD' and symbol ~ '^[A-Z][A-Z0-9.\-]{0,14}$') or
 (asset_type in ('domestic_stock','domestic_etf') and purchase_currency='KRW' and symbol ~ '^[A-Z0-9]{6}$') or
 (asset_type='crypto' and purchase_currency='KRW' and symbol ~ '^KRW-[A-Z0-9]{2,15}$')
);
create or replace view public.portfolio_holdings_read with (security_invoker=true) as
select id,user_id,institution,asset_type,symbol,name,quantity::text,average_purchase_price::text,purchase_currency,purchase_exchange_rate::text,
 original_investment_krw::text,created_at,updated_at,connection_id from public.portfolio_holdings;

-- Connected rows are managed by the server's validated full snapshots only.
drop policy holdings_insert on public.portfolio_holdings;
drop policy holdings_update on public.portfolio_holdings;
drop policy holdings_delete on public.portfolio_holdings;
create policy holdings_insert on public.portfolio_holdings for insert to authenticated with check((select auth.uid())=user_id and connection_id is null and not exists(
 select 1 from public.portfolio_connections c where c.user_id=(select auth.uid()) and c.enabled and
 ((c.provider='kiwoom' and institution='키움증권' and asset_type in ('domestic_stock','domestic_etf')) or (c.provider='upbit' and institution='업비트' and asset_type='crypto'))));
create policy holdings_update on public.portfolio_holdings for update to authenticated using((select auth.uid())=user_id and connection_id is null) with check((select auth.uid())=user_id and connection_id is null and not exists(
 select 1 from public.portfolio_connections c where c.user_id=(select auth.uid()) and c.enabled and
 ((c.provider='kiwoom' and institution='키움증권' and asset_type in ('domestic_stock','domestic_etf')) or (c.provider='upbit' and institution='업비트' and asset_type='crypto'))));
create policy holdings_delete on public.portfolio_holdings for delete to authenticated using((select auth.uid())=user_id and connection_id is null);

create table public.portfolio_widget_devices (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null default now()+interval '365 days'
);
alter table public.portfolio_widget_devices enable row level security;
revoke all on public.portfolio_widget_devices from public,anon,authenticated;
grant all on public.portfolio_widget_devices to service_role;
create index portfolio_widget_devices_user on public.portfolio_widget_devices(user_id);

create function public.portfolio_commit_account(p_user uuid,p_provider text,p_positions jsonb,p_connect boolean default false)
returns uuid language plpgsql security invoker set search_path='' as $$
declare cid uuid; inst text; item jsonb;
begin
 if p_provider not in ('kiwoom','upbit') or jsonb_typeof(p_positions)<>'array' or jsonb_array_length(p_positions)>49 then raise exception 'invalid account snapshot'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_provider,0));
 inst=case when p_provider='kiwoom' then '키움증권' else '업비트' end;
 if p_connect then
  insert into public.portfolio_connections(user_id,provider,enabled) values(p_user,p_provider,true)
   on conflict(user_id,provider) do update set enabled=true returning id into cid;
 else
  select id into cid from public.portfolio_connections where user_id=p_user and provider=p_provider and enabled for update;
  if cid is null then raise exception 'account disconnected'; end if;
 end if;
 if exists(select 1 from jsonb_array_elements(p_positions) x group by x->>'symbol' having count(*)>1) then raise exception 'duplicate position'; end if;
 if exists(select 1 from jsonb_array_elements(p_positions) x where x->>'purchase_currency' is distinct from 'KRW' or
    (p_provider='kiwoom' and coalesce(x->>'asset_type','') not in ('domestic_stock','domestic_etf')) or
    (p_provider='upbit' and x->>'asset_type' is distinct from 'crypto')) then raise exception 'invalid account asset'; end if;
 -- Explicit first-connect consent replaces only this provider's supported manual assets.
 if p_connect then delete from public.portfolio_holdings where user_id=p_user and connection_id is null and institution=inst and
   ((p_provider='kiwoom' and asset_type in ('domestic_stock','domestic_etf')) or (p_provider='upbit' and asset_type='crypto')); end if;
 delete from public.portfolio_holdings where user_id=p_user and connection_id=cid and symbol not in(select x->>'symbol' from jsonb_array_elements(p_positions) x);
 for item in select * from jsonb_array_elements(p_positions) loop
  insert into public.portfolio_holdings(user_id,connection_id,institution,asset_type,symbol,name,quantity,average_purchase_price,purchase_currency,original_investment_krw)
   values(p_user,cid,inst,item->>'asset_type',item->>'symbol',item->>'name',(item->>'quantity')::numeric,(item->>'average_purchase_price')::numeric,'KRW',(item->>'original_investment_krw')::numeric)
   on conflict(connection_id,symbol) where connection_id is not null do update set name=excluded.name,asset_type=excluded.asset_type,
    quantity=excluded.quantity,average_purchase_price=excluded.average_purchase_price,original_investment_krw=excluded.original_investment_krw;
 end loop;
 if (select count(*) from public.portfolio_holdings where user_id=p_user)>49 then raise exception 'too many assets'; end if;
 update public.portfolio_connections set last_synced_at=now() where id=cid;
 return cid;
end $$;
revoke all on function public.portfolio_commit_account(uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.portfolio_commit_account(uuid,text,jsonb,boolean) to service_role;

create function public.portfolio_disconnect_account(p_user uuid,p_provider text) returns void
language plpgsql security invoker set search_path='' as $$
declare cid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_provider,0));
 select id into cid from public.portfolio_connections where user_id=p_user and provider=p_provider for update;
 update public.portfolio_holdings set connection_id=null where user_id=p_user and connection_id=cid;
 update public.portfolio_connections set enabled=false where id=cid;
end $$;
revoke all on function public.portfolio_disconnect_account(uuid,text) from public,anon,authenticated;
grant execute on function public.portfolio_disconnect_account(uuid,text) to service_role;
