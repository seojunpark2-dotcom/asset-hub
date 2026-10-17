-- Existing read/sync-only device tokens cannot submit snapshots. Only authenticated enrollment can opt in.
alter table public.portfolio_widget_devices add column local_snapshots boolean not null default false;
