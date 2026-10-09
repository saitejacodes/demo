-- Road to Expert: accounts, progress, proofs and the activity timeline.
-- Students own their rows; a parent can read (never write) the rows of students linked to them.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('student', 'parent')),
  display_name text not null default '',
  cf_handle text,
  invite_code text unique,
  unlocked_stage int not null default 0,
  created_at timestamptz not null default now()
);

create table public.links (
  parent_id uuid not null references public.profiles on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

create table public.manual_done (          -- CSES tasks (via proof upload) and milestones
  student_id uuid not null references public.profiles on delete cascade,
  item_id text not null,
  done_at timestamptz not null default now(),
  primary key (student_id, item_id)
);

create table public.reflections (
  student_id uuid not null references public.profiles on delete cascade,
  item_id text not null,
  answers jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (student_id, item_id)
);

create table public.proofs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  item_id text not null,
  path text not null,
  created_at timestamptz not null default now()
);

create table public.activity (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_student_time on public.activity (student_id, created_at desc);

create table public.cf_cache (             -- last Codeforces sync result
  student_id uuid primary key references public.profiles on delete cascade,
  data jsonb not null,
  synced_at timestamptz not null default now()
);

create table public.cf_secrets (           -- Codeforces API key; readable only by the server (service role)
  student_id uuid primary key references public.profiles on delete cascade,
  api_key text not null,
  api_secret text not null,
  updated_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function public.can_view(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sid = auth.uid() or exists (select 1 from links where parent_id = auth.uid() and student_id = sid)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role', 'student');
begin
  if r not in ('student', 'parent') then r := 'student'; end if;
  insert into profiles (id, role, display_name, invite_code)
  values (new.id, r, coalesce(new.raw_user_meta_data->>'name', ''),
          case when r = 'student' then upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) end);
  if r = 'student' then insert into activity (student_id, kind) values (new.id, 'joined'); end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.link_student(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if (select role from profiles where id = auth.uid()) is distinct from 'parent' then
    raise exception 'Only parent accounts can link a student.';
  end if;
  select id into sid from profiles where invite_code = upper(trim(code)) and role = 'student';
  if sid is null then raise exception 'No student with that code.'; end if;
  insert into links (parent_id, student_id) values (auth.uid(), sid) on conflict do nothing;
  return sid;
end $$;

create or replace function public.set_cf_secret(key text, secret text) returns void
language sql security definer set search_path = public as $$
  insert into cf_secrets (student_id, api_key, api_secret) values (auth.uid(), key, secret)
  on conflict (student_id) do update set api_key = excluded.api_key, api_secret = excluded.api_secret, updated_at = now()
$$;
create or replace function public.clear_cf_secret() returns void
language sql security definer set search_path = public as $$ delete from cf_secrets where student_id = auth.uid() $$;
create or replace function public.has_cf_secret(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select can_view(sid) and exists (select 1 from cf_secrets where student_id = sid)
$$;

-- ---------- privileges (explicit, so it works whether or not new tables are auto-exposed) ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.links, public.manual_done, public.reflections,
  public.proofs, public.activity, public.cf_cache to authenticated;
revoke all on public.cf_secrets from anon, authenticated;
revoke all on all tables in schema public from anon;
grant execute on function public.link_student(text), public.set_cf_secret(text, text), public.clear_cf_secret(),
  public.has_cf_secret(uuid), public.can_view(uuid) to authenticated;
revoke execute on function public.link_student(text), public.set_cf_secret(text, text), public.clear_cf_secret(),
  public.has_cf_secret(uuid) from public, anon;

-- ---------- row-level security ----------
alter table public.profiles enable row level security;
alter table public.links enable row level security;
alter table public.manual_done enable row level security;
alter table public.reflections enable row level security;
alter table public.proofs enable row level security;
alter table public.activity enable row level security;
alter table public.cf_cache enable row level security;
alter table public.cf_secrets enable row level security;   -- no policies: clients can't touch it directly

create policy "see self, linked students and linked parents" on public.profiles for select to authenticated
  using (can_view(id) or exists (select 1 from links where student_id = auth.uid() and parent_id = profiles.id));
create policy "edit own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name, cf_handle, unlocked_stage) on public.profiles to authenticated;   -- role / invite code stay fixed

create policy "see own links" on public.links for select to authenticated using (parent_id = auth.uid() or student_id = auth.uid());
create policy "parent unlinks" on public.links for delete to authenticated using (parent_id = auth.uid());

create policy "read" on public.manual_done for select to authenticated using (can_view(student_id));
create policy "write own" on public.manual_done for insert to authenticated with check (student_id = auth.uid());
create policy "update own" on public.manual_done for update to authenticated using (student_id = auth.uid());
create policy "delete own" on public.manual_done for delete to authenticated using (student_id = auth.uid());

create policy "read" on public.reflections for select to authenticated using (can_view(student_id));
create policy "write own" on public.reflections for insert to authenticated with check (student_id = auth.uid());
create policy "update own" on public.reflections for update to authenticated using (student_id = auth.uid());

create policy "read" on public.proofs for select to authenticated using (can_view(student_id));
create policy "write own" on public.proofs for insert to authenticated with check (student_id = auth.uid());

create policy "read" on public.activity for select to authenticated using (can_view(student_id));
create policy "write own" on public.activity for insert to authenticated with check (student_id = auth.uid());

create policy "read" on public.cf_cache for select to authenticated using (can_view(student_id));
create policy "write own" on public.cf_cache for insert to authenticated with check (student_id = auth.uid());
create policy "update own" on public.cf_cache for update to authenticated using (student_id = auth.uid());

-- ---------- proof screenshots (private bucket, folder = student id) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "students upload own proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "students and linked parents view proofs" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and public.can_view(((storage.foldername(name))[1])::uuid));
