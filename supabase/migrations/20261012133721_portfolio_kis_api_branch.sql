-- api branch only: separate quotes and broker credentials from the legacy endpoint.
create table public.portfolio_quote_cache_kis (like public.portfolio_quote_cache including all);
alter table public.portfolio_quote_cache_kis add column time_basis text check(time_basis is null or time_basis='retrieved');
alter table public.portfolio_quote_cache_kis enable row level security;
revoke all on public.portfolio_quote_cache_kis from public,anon,authenticated;
grant all on public.portfolio_quote_cache_kis to service_role;

create schema portfolio_private;
revoke all on schema portfolio_private from public,anon,authenticated;
grant usage on schema portfolio_private to service_role;
create table portfolio_private.kis_sessions (
  key_id text primary key check(key_id ~ '^[0-9a-f]{64}$'),
  token text, expires_at timestamptz,
  retry_after timestamptz not null default 'epoch', lock_id uuid
);
alter table portfolio_private.kis_sessions enable row level security;
revoke all on portfolio_private.kis_sessions from public,anon,authenticated;
grant all on portfolio_private.kis_sessions to service_role;

create function public.portfolio_kis_session_read(p_key text) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('token',token,'expiresAt',expires_at) from portfolio_private.kis_sessions
 where key_id=p_key and token is not null;
$$;
create function public.portfolio_kis_session_claim(p_key text,p_owner uuid) returns boolean
language sql security invoker set search_path='' as $$
 with claimed as (
  insert into portfolio_private.kis_sessions(key_id,retry_after,lock_id) values(p_key,now()+interval '61 seconds',p_owner)
  on conflict(key_id) do update set retry_after=now()+interval '61 seconds',lock_id=p_owner
  where kis_sessions.retry_after<=now() and (kis_sessions.token is null or kis_sessions.expires_at<=now()+interval '90 seconds')
  returning key_id
 ) select exists(select 1 from claimed);
$$;
create function public.portfolio_kis_session_save(p_key text,p_owner uuid,p_token text,p_expires timestamptz) returns boolean
language sql security invoker set search_path='' as $$
 with saved as (
  update portfolio_private.kis_sessions set token=p_token,expires_at=p_expires,lock_id=null
  where key_id=p_key and lock_id=p_owner and p_expires>now() and p_expires<=now()+interval '25 hours' and length(p_token)>0
  returning key_id
 ) select exists(select 1 from saved);
$$;
create function public.portfolio_kis_session_invalidate(p_key text,p_token text) returns void
language sql security invoker set search_path='' as $$
 update portfolio_private.kis_sessions set token=null,expires_at=null where key_id=p_key and token=p_token;
$$;
revoke all on function public.portfolio_kis_session_read(text), public.portfolio_kis_session_claim(text,uuid), public.portfolio_kis_session_save(text,uuid,text,timestamptz), public.portfolio_kis_session_invalidate(text,text) from public,anon,authenticated;
grant execute on function public.portfolio_kis_session_read(text), public.portfolio_kis_session_claim(text,uuid), public.portfolio_kis_session_save(text,uuid,text,timestamptz), public.portfolio_kis_session_invalidate(text,text) to service_role;
