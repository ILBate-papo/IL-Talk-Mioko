create table if not exists public.mioko_admin_accounts (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
create table if not exists public.mioko_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','paid','blocked','cancelled')),
  paid_until timestamptz,
  payment_reference text,
  updated_at timestamptz not null default now(),
  check (status <> 'paid' or (paid_until is not null and payment_reference is not null and length(btrim(payment_reference)) > 0))
);
alter table public.mioko_admin_accounts enable row level security;
alter table public.mioko_subscriptions enable row level security;
revoke all on public.mioko_admin_accounts from anon, authenticated;
revoke all on public.mioko_subscriptions from anon, authenticated;
grant all on public.mioko_admin_accounts, public.mioko_subscriptions to service_role;
insert into public.mioko_admin_accounts(email) values ('bate.papo@ilchatsmail.com.br') on conflict do nothing;
