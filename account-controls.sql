-- IL Chats - controles de conta/contatos (sem acesso a mensagens)
create table if not exists public.il_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.il_user_blocks enable row level security;
drop policy if exists il_blocks_own on public.il_user_blocks;
create policy il_blocks_own on public.il_user_blocks for all to authenticated
using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create table if not exists public.il_admin_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  suspended_at timestamptz not null default now(),
  suspended_by uuid references auth.users(id),
  reason text
);
alter table public.il_admin_suspensions enable row level security;

create or replace function public.il_is_admin(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.app_admins where user_id=p_uid);
$$;
revoke all on function public.il_is_admin(uuid) from public;
grant execute on function public.il_is_admin(uuid) to authenticated;

create or replace function public.il_my_contacts() returns table(id uuid, display_name text, username text)
language sql stable security definer set search_path=public as $$
  select p.id,p.display_name,p.username from public.profiles p
  where p.id=auth.uid() or exists(
    select 1 from public.friendships f where f.status='accepted' and
    ((f.requester_id=auth.uid() and f.addressee_id=p.id) or (f.addressee_id=auth.uid() and f.requester_id=p.id))
  )
  and not exists(select 1 from public.il_user_blocks b where b.blocker_id=auth.uid() and b.blocked_id=p.id);
$$;
grant execute on function public.il_my_contacts() to authenticated;

create or replace function public.il_remove_contact(p_other uuid) returns boolean
language plpgsql security definer set search_path=public as $$ begin
  if auth.uid() is null or p_other=auth.uid() then return false; end if;
  delete from public.friendships where
    (requester_id=auth.uid() and addressee_id=p_other) or (addressee_id=auth.uid() and requester_id=p_other);
  return true;
end $$;
grant execute on function public.il_remove_contact(uuid) to authenticated;

create or replace function public.il_block_user(p_other uuid) returns boolean
language plpgsql security definer set search_path=public as $$ begin
  if auth.uid() is null or p_other=auth.uid() then return false; end if;
  insert into public.il_user_blocks(blocker_id,blocked_id) values(auth.uid(),p_other) on conflict do nothing;
  delete from public.friendships where
    (requester_id=auth.uid() and addressee_id=p_other) or (addressee_id=auth.uid() and requester_id=p_other);
  return true;
end $$;
grant execute on function public.il_block_user(uuid) to authenticated;

create or replace function public.il_admin_list_users() returns table(id uuid, display_name text, username text, created_at timestamptz, suspended boolean)
language sql stable security definer set search_path=public as $$
  select p.id,p.display_name,p.username,u.created_at,
    exists(select 1 from public.il_admin_suspensions s where s.user_id=p.id)
  from public.profiles p join auth.users u on u.id=p.id
  where public.il_is_admin(auth.uid()) order by u.created_at desc;
$$;
grant execute on function public.il_admin_list_users() to authenticated;

create or replace function public.il_admin_set_suspended(p_user uuid,p_suspended boolean) returns boolean
language plpgsql security definer set search_path=public as $$ begin
  if not public.il_is_admin(auth.uid()) or p_user=auth.uid() then return false; end if;
  if p_suspended then
    insert into public.il_admin_suspensions(user_id,suspended_by) values(p_user,auth.uid())
    on conflict(user_id) do update set suspended_at=now(),suspended_by=auth.uid();
  else delete from public.il_admin_suspensions where user_id=p_user; end if;
  return true;
end $$;
grant execute on function public.il_admin_set_suspended(uuid,boolean) to authenticated;

create or replace function public.il_am_i_suspended() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.il_admin_suspensions where user_id=auth.uid());
$$;
grant execute on function public.il_am_i_suspended() to authenticated;

-- Exclusão definitiva. Remove primeiro os dados diretamente ligados à conta e por último auth.users.
create or replace function public.il_delete_user_core(p_user uuid) returns void
language plpgsql security definer set search_path=public as $$ begin
  delete from public.il_user_blocks where blocker_id=p_user or blocked_id=p_user;
  delete from public.il_admin_suspensions where user_id=p_user;
  delete from public.friendships where requester_id=p_user or addressee_id=p_user;
  delete from public.push_subscriptions where user_id=p_user;
  delete from public.conversation_members where user_id=p_user;
  delete from public.profiles where id=p_user;
  delete from auth.users where id=p_user;
end $$;
revoke all on function public.il_delete_user_core(uuid) from public;

create or replace function public.il_delete_my_account() returns boolean
language plpgsql security definer set search_path=public as $$ declare u uuid:=auth.uid(); begin
  if u is null then return false; end if;
  perform public.il_delete_user_core(u); return true;
end $$;
grant execute on function public.il_delete_my_account() to authenticated;

create or replace function public.il_admin_delete_user(p_user uuid) returns boolean
language plpgsql security definer set search_path=public as $$ begin
  if not public.il_is_admin(auth.uid()) or p_user=auth.uid() then return false; end if;
  perform public.il_delete_user_core(p_user); return true;
end $$;
grant execute on function public.il_admin_delete_user(uuid) to authenticated;
