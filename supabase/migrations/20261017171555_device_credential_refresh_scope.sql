-- Existing snapshot/read devices receive no credential permission by default.
alter table public.portfolio_widget_devices add column credential_providers text[] not null default '{}'
  check (credential_providers <@ array['kiwoom','upbit']::text[]);

-- Invoker privileges: callable by the server role only, never directly by app users.
create function public.portfolio_device_credentials(p_user uuid,p_device uuid,p_provider text,p_enable boolean)
returns boolean language sql security invoker set search_path = '' as $$
 with changed as (
  update public.portfolio_widget_devices
  set credential_providers = case when p_enable then
    array(select distinct unnest(credential_providers || array[p_provider]))
    else array_remove(credential_providers,p_provider) end
  where user_id=p_user and p_provider in ('kiwoom','upbit')
    and (id=p_device or (p_device is null and not p_enable))
    and (not p_enable or (local_snapshots and expires_at > now()))
  returning id
 ) select exists(select 1 from changed);
$$;
revoke all on function public.portfolio_device_credentials(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.portfolio_device_credentials(uuid,uuid,text,boolean) to service_role;
