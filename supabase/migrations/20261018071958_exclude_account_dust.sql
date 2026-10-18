create or replace function public.portfolio_commit_account(p_user uuid,p_provider text,p_positions jsonb,p_connect boolean default false)
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
 -- Delete account dust after full validation/upsert, before the portfolio limit check.
 delete from public.portfolio_holdings where user_id=p_user and connection_id=cid and original_investment_krw < 1;
 if (select count(*) from public.portfolio_holdings where user_id=p_user)>49 then raise exception 'too many assets'; end if;
 update public.portfolio_connections set last_synced_at=now() where id=cid;
 return cid;
end $$;
revoke all on function public.portfolio_commit_account(uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.portfolio_commit_account(uuid,text,jsonb,boolean) to service_role;


-- One-time cleanup: never delete manual holdings.
delete from public.portfolio_holdings where connection_id is not null and original_investment_krw < 1;
