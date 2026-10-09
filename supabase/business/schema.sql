begin;
create table public.mioko_billing_settings (
  id boolean primary key default true check(id), price_cents integer not null default 10000 check(price_cents between 100 and 10000000),
  access_days integer not null default 30 check(access_days between 1 and 366),
  pix_key text not null default '', pix_owner text not null default '', pix_bank text not null default '',
  mercado_pago_url text not null default '', updated_at timestamptz not null default now()
);
insert into public.mioko_billing_settings(id, pix_key, pix_owner, pix_bank) values(true,'','','');
create table public.mioko_visits (
  id uuid primary key, session_id uuid not null, kind text not null check(kind in ('visit','checkout','apk')),
  path text not null check(length(path)<=120), country_code text check(country_code ~ '^[A-Z]{2}$'), city text check(length(city)<=100),
  geo_consent boolean not null default false, created_at timestamptz not null default now(),
  check(geo_consent or (country_code is null and city is null))
);
create index mioko_visits_created_idx on public.mioko_visits(created_at);
create index mioko_visits_session_idx on public.mioko_visits(session_id,created_at);
create table public.mioko_leads (
  id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(email) and length(email)<=254),
  name text not null check(length(name) between 1 and 120), consent boolean not null check(consent), created_at timestamptz not null default now()
);
create index mioko_leads_created_idx on public.mioko_leads(created_at);
create table public.mioko_payment_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reference text not null check(length(reference) between 6 and 120), method text not null check(method in ('pix','mercadopago')),
  status text not null default 'pending' check(status in ('pending','confirmed')), created_at timestamptz not null default now(),
  unique(user_id,reference)
);
create index mioko_payment_requests_user_idx on public.mioko_payment_requests(user_id);
create index mioko_payment_requests_status_idx on public.mioko_payment_requests(status,created_at);
create table public.mioko_confirmed_payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), reference text not null unique,
  method text not null check(method in ('pix','mercadopago')), amount_cents integer not null check(amount_cents>0),
  confirmed_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index mioko_confirmed_payments_user_idx on public.mioko_confirmed_payments(user_id);
create index mioko_confirmed_payments_created_idx on public.mioko_confirmed_payments(created_at);
alter table public.mioko_billing_settings enable row level security;
alter table public.mioko_visits enable row level security;
alter table public.mioko_leads enable row level security;
alter table public.mioko_payment_requests enable row level security;
alter table public.mioko_confirmed_payments enable row level security;
revoke all on public.mioko_billing_settings,public.mioko_visits,public.mioko_leads,public.mioko_payment_requests,public.mioko_confirmed_payments from public,anon,authenticated;
grant all on public.mioko_billing_settings,public.mioko_visits,public.mioko_leads,public.mioko_payment_requests,public.mioko_confirmed_payments to service_role;
-- Minimal fields for server-side reporting; no password or auth-token columns.
grant usage on schema auth to service_role;
grant select(id,email,created_at,email_confirmed_at) on auth.users to service_role;

create function public.mioko_business_snapshot(p_days integer default 30) returns jsonb
language sql security invoker set search_path='' as $$
with period as (select now()-make_interval(days=>greatest(1,least(90,p_days))) as since),
members as (select u.id,u.email,u.created_at,u.email_confirmed_at from auth.users u where not exists(select 1 from public.mioko_admin_accounts a where a.email=lower(u.email))),
paid as (select s.user_id from public.mioko_subscriptions s where s.status='paid' and s.payment_reference is not null and s.paid_until>now()),
lead_period as (select l.* from public.mioko_leads l,period p where l.created_at>=p.since),
converted as (select l.id from lead_period l join members u on lower(u.email)=l.email where exists(select 1 from public.mioko_confirmed_payments cp where cp.user_id=u.id)),
countries as (select v.country_code,count(*) as visits from public.mioko_visits v,period p where v.created_at>=p.since and v.kind='visit' and v.geo_consent and v.country_code is not null group by v.country_code order by visits desc limit 30),
cities as (select v.city,v.country_code,count(*) as visits from public.mioko_visits v,period p where v.created_at>=p.since and v.kind='visit' and v.geo_consent and v.city is not null group by v.city,v.country_code order by visits desc limit 30),
days as (select (v.created_at at time zone 'America/Sao_Paulo')::date as day,count(*) as visits from public.mioko_visits v,period p where v.created_at>=p.since and v.kind='visit' group by day order by day),
accounts as (select u.id,u.email,u.created_at,u.email_confirmed_at,s.status,s.paid_until from members u left join public.mioko_subscriptions s on s.user_id=u.id order by u.created_at desc limit 100),
requests as (select r.*,u.email from public.mioko_payment_requests r join members u on u.id=r.user_id where r.status='pending' order by r.created_at desc limit 100),
leads as (select l.id,l.email,l.name,l.created_at,exists(select 1 from members u join public.mioko_confirmed_payments cp on cp.user_id=u.id where lower(u.email)=l.email) as converted from lead_period l order by l.created_at desc limit 100)
select jsonb_build_object(
 'days',greatest(1,least(90,p_days)), 'tracking_started_at',(select min(created_at) from public.mioko_visits),
 'metrics',jsonb_build_object(
  'visits',(select count(*) from public.mioko_visits v,period p where v.created_at>=p.since and v.kind='visit'),
  'visitor_sessions',(select count(distinct session_id) from public.mioko_visits v,period p where v.created_at>=p.since and v.kind='visit'),
  'checkout_clicks',(select count(*) from public.mioko_visits v,period p where v.created_at>=p.since and v.kind='checkout'),
  'registrations',(select count(*) from members u,period p where u.created_at>=p.since),
  'registered_total',(select count(*) from members), 'confirmed_total',(select count(*) from members where email_confirmed_at is not null),
  'active_paid',(select count(*) from paid s join members u on u.id=s.user_id), 'leads',(select count(*) from lead_period),
  'converted_leads',(select count(*) from converted),
  'revenue_cents',(select coalesce(sum(amount_cents),0) from public.mioko_confirmed_payments cp,period p where cp.created_at>=p.since)
 ), 'countries',coalesce((select jsonb_agg(countries) from countries),'[]'::jsonb),
 'cities',coalesce((select jsonb_agg(cities) from cities),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(days) from days),'[]'::jsonb),
 'accounts',coalesce((select jsonb_agg(accounts) from accounts),'[]'::jsonb),
 'payment_requests',coalesce((select jsonb_agg(requests) from requests),'[]'::jsonb),
 'leads',coalesce((select jsonb_agg(leads) from leads),'[]'::jsonb),
 'settings',(select to_jsonb(b) from public.mioko_billing_settings b where b.id)
);
$$;
create function public.mioko_confirm_received_payment(p_user_id uuid,p_reference text,p_method text,p_admin_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cfg public.mioko_billing_settings%rowtype; existing public.mioko_confirmed_payments%rowtype; expires timestamptz;
begin
 if not exists(select 1 from auth.users u join public.mioko_admin_accounts a on a.email=lower(u.email) where u.id=p_admin_id and u.email_confirmed_at is not null) then raise exception 'Administrador não autorizado'; end if;
 if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then raise exception 'Cliente precisa confirmar o e-mail'; end if;
 if exists(select 1 from auth.users u join public.mioko_admin_accounts a on a.email=lower(u.email) where u.id=p_user_id) then raise exception 'Administrador não precisa de assinatura'; end if;
 if length(btrim(p_reference)) not between 6 and 120 or p_method not in ('pix','mercadopago') then raise exception 'Transação inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into existing from public.mioko_confirmed_payments where reference=btrim(p_reference);
 if found then
  if existing.user_id<>p_user_id then raise exception 'Transação já vinculada a outro cliente'; end if;
  return jsonb_build_object('already_confirmed',true);
 end if;
 select * into strict cfg from public.mioko_billing_settings where id;
 select greatest(now(),coalesce(paid_until,now())) into expires from public.mioko_subscriptions where user_id=p_user_id for update;
 expires:=coalesce(expires,now())+make_interval(days=>cfg.access_days);
 insert into public.mioko_confirmed_payments(user_id,reference,method,amount_cents,confirmed_by) values(p_user_id,btrim(p_reference),p_method,cfg.price_cents,p_admin_id);
 insert into public.mioko_subscriptions(user_id,status,paid_until,payment_reference,updated_at) values(p_user_id,'paid',expires,btrim(p_reference),now())
 on conflict(user_id) do update set status='paid',paid_until=excluded.paid_until,payment_reference=excluded.payment_reference,updated_at=now();
 update public.mioko_payment_requests set status='confirmed' where user_id=p_user_id and reference=btrim(p_reference);
 return jsonb_build_object('already_confirmed',false,'paid_until',expires);
end;
$$;
revoke all on function public.mioko_business_snapshot(integer),public.mioko_confirm_received_payment(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.mioko_business_snapshot(integer),public.mioko_confirm_received_payment(uuid,text,text,uuid) to service_role;
commit;
