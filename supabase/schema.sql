-- =====================================================================
--  على الباب — Supabase schema
--  شغّل الملف ده مرة واحدة في Supabase → SQL Editor → New query → Run
--  بعده شغّل seed.sql
-- =====================================================================

-- gen_random_uuid() is built into Postgres 13+ (Supabase uses 15+)

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.departments (
  id    serial primary key,
  name  text not null unique,
  sort  int  not null default 0
);

-- one row per device / anonymous user
create table if not exists public.players (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 2 and 40),
  dept_id    int  not null references public.departments(id),
  role       text not null check (role in ('nurse','doctor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- heads of department + admins (rows are added by you in the SQL editor)
create table if not exists public.managers (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  dept_id      int references public.departments(id),   -- null = all departments (admin)
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now(),
  check (is_admin or dept_id is not null)
);

-- question content that players may read
create table if not exists public.cases (
  id         uuid primary key default gen_random_uuid(),
  code       text unique,                                 -- seed cases only (b1, a3 ...)
  level      text not null check (level in ('basic','adv')),
  room       text not null,
  title      text not null,
  who        text not null,
  file       text[] not null,
  task       text not null,
  opts       text[] not null,
  active     boolean not null default true,
  dept_id    int references public.departments(id),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_length(opts,1) between 2 and 6),
  check (opts <@ array['std','contact','droplet','airborne','contact_droplet','airborne_contact','enteric']),
  check (array_length(file,1) between 1 and 8)
);

-- the answer key: nobody reads this table directly
create table if not exists public.case_answers (
  case_id  uuid primary key references public.cases(id) on delete cascade,
  iso      text   not null check (iso in ('std','contact','droplet','airborne','contact_droplet','airborne_contact','enteric')),
  ppe      text[] not null default '{}' check (ppe <@ array['gloves','gown','mask','n95','eye']),
  hand     text   not null check (hand in ('alcohol','soap','none')),
  partial  jsonb  not null default '{}'::jsonb,          -- {"droplet":{"p":15,"n":"..."}}
  why_iso  text   not null,
  why_ppe  text   not null,
  why_hand text   not null
);

-- a fixed set of doors played by one (solo) or two (duel) players
create table if not exists public.game_sets (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  mode       text not null check (mode in ('duel','solo')),
  level      text not null check (level in ('basic','adv')),
  case_ids   uuid[] not null,
  orders     jsonb  not null,                             -- [["airborne","droplet",...], ...]
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id              uuid primary key default gen_random_uuid(),
  set_id          uuid not null references public.game_sets(id) on delete cascade,
  player_id       uuid not null references public.players(id) on delete cascade,
  next_door       int  not null default 0,
  started_idx     int,
  door_started_at timestamptz,
  score           int  not null default 0,               -- incl. speed bonus
  base            int  not null default 0,               -- without speed bonus (used for %)
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (set_id, player_id)
);

create table if not exists public.attempt_doors (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  idx        int  not null,
  case_id    uuid references public.cases(id) on delete set null,
  iso text, ppe text[], hand text,
  iso_pts int not null, ppe_pts int not null, hand_pts int not null, speed int not null, total int not null,
  iso_state text not null, ppe_state text not null, hand_state text not null,
  created_at timestamptz not null default now(),
  primary key (attempt_id, idx)
);

create table if not exists public.spot_attempts (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  scene      text not null default 'room1',
  found      text[] not null,                             -- checked against spot_items in save_spot()
  shown      text[],                                      -- the errors that were in this picture
  total      int  not null check (total between 1 and 20),
  score      int  not null check (score between 0 and 5000),
  reason     text not null check (reason in ('all','time','hearts','giveup')),
  created_at timestamptz not null default now()
);

-- the mistakes hidden in each "طلّع الغلطات" room (filled by seed.sql)
create table if not exists public.spot_items (
  scene      text not null,
  scene_name text not null,
  id         text not null,
  title      text not null,
  primary key (scene, id)
);

create table if not exists public.roster (
  id      serial primary key,
  dept_id int  not null references public.departments(id) on delete cascade,
  name    text not null check (char_length(btrim(name)) between 2 and 40),
  unique (dept_id, name)
);

create index if not exists attempts_player_idx on public.attempts(player_id);
create index if not exists attempts_set_idx on public.attempts(set_id);
create index if not exists spot_player_idx on public.spot_attempts(player_id);
create index if not exists players_dept_idx on public.players(dept_id);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from managers where user_id = auth.uid())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from managers where user_id = auth.uid()), false)
$$;

create or replace function public.manager_dept() returns int
language sql stable security definer set search_path = public as $$
  select dept_id from managers where user_id = auth.uid()
$$;

create or replace function public._require_player() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from players where id = uid) then raise exception 'no_profile'; end if;
  return uid;
end $$;

create or replace function public._require_manager() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from managers where user_id = uid) then raise exception 'not_manager'; end if;
  return uid;
end $$;

create or replace function public._shuffle(arr text[]) returns text[]
language sql volatile as $$
  select coalesce(array_agg(x order by random()), '{}') from unnest(arr) x
$$;

create or replace function public._new_code() returns text
language plpgsql volatile as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from game_sets where code = c);
  end loop;
  return c;
end $$;

-- ---------------------------------------------------------------------
-- Game RPCs (players)
-- ---------------------------------------------------------------------

-- full public view of a set, for the caller
create or replace function public.get_set(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s game_sets;
  n int;
  my attempts;
  me_done boolean;
  doors jsonb;
  ppl jsonb;
  prev_best int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from game_sets where code = upper(btrim(p_code));
  if not found then raise exception 'set_not_found'; end if;
  n := array_length(s.case_ids, 1);
  select * into my from attempts where set_id = s.id and player_id = uid;
  me_done := my.finished_at is not null;

  select jsonb_agg(jsonb_build_object(
           'idx', t.ord - 1, 'case_id', c.id, 'room', c.room, 'title', c.title, 'who', c.who,
           'file', to_jsonb(c.file), 'task', c.task, 'order', s.orders -> (t.ord::int - 1)) order by t.ord)
    into doors
    from unnest(s.case_ids) with ordinality as t(cid, ord)
    join cases c on c.id = t.cid;

  -- other players: details only after the caller finished (or if caller is a manager)
  select coalesce(jsonb_agg(jsonb_build_object(
           'player_id', a.player_id, 'name', p.name, 'dept', d.name, 'role', p.role,
           'is_me', a.player_id = uid, 'finished', a.finished_at is not null, 'progress', a.next_door,
           'score', case when me_done or a.player_id = uid or is_manager() then a.score end,
           'base',  case when me_done or a.player_id = uid or is_manager() then a.base end,
           'doors', case when me_done or a.player_id = uid or is_manager() then (
               select coalesce(jsonb_agg(jsonb_build_object('idx', ad.idx, 'iso', ad.iso_state, 'ppe', ad.ppe_state, 'hand', ad.hand_state,
                                                            'iso_pts', ad.iso_pts, 'ppe_pts', ad.ppe_pts, 'hand_pts', ad.hand_pts) order by ad.idx), '[]'::jsonb)
               from attempt_doors ad where ad.attempt_id = a.id) end
         ) order by a.created_at), '[]'::jsonb)
    into ppl
    from attempts a join players p on p.id = a.player_id join departments d on d.id = p.dept_id
   where a.set_id = s.id;

  select max(round(a.base * 100.0 / (array_length(gs.case_ids,1) * 100)))::int into prev_best
    from attempts a join game_sets gs on gs.id = a.set_id
   where a.player_id = uid and a.finished_at is not null and a.set_id <> s.id;

  return jsonb_build_object(
    'id', s.id, 'code', s.code, 'mode', s.mode, 'level', s.level, 'doors', coalesce(doors, '[]'::jsonb), 'n', n,
    'owner_is_me', s.created_by = uid,
    'my_attempt', case when my.id is null then null else jsonb_build_object(
        'id', my.id, 'next_door', my.next_door, 'score', my.score, 'base', my.base, 'finished', me_done) end,
    'players', ppl,
    'prev_best', prev_best
  );
end $$;

create or replace function public.create_set(p_mode text, p_level text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := _require_player();
  ids uuid[];
  extra uuid[];
  ord jsonb;
  c text;
  sid uuid;
begin
  if p_mode not in ('duel','solo') then raise exception 'bad_mode'; end if;
  if p_level not in ('basic','adv') then raise exception 'bad_level'; end if;

  if p_level = 'basic' then
    select array_agg(id) into ids from (select id from cases where active and level = 'basic' order by random() limit 6) q;
  else
    select array_agg(id) into ids from (
      (select id from cases where active and level = 'adv'   order by random() limit 3)
      union all
      (select id from cases where active and level = 'basic' order by random() limit 3)) q;
  end if;
  ids := coalesce(ids, '{}');
  if coalesce(array_length(ids,1),0) < 6 then          -- not enough of a level: fill from any active case
    select array_agg(id) into extra from (
      select id from cases where active and not (id = any(ids)) order by random() limit 6 - coalesce(array_length(ids,1),0)) q;
    ids := ids || coalesce(extra, '{}');
  end if;
  if coalesce(array_length(ids,1),0) = 0 then raise exception 'no_cases'; end if;
  select array_agg(x order by random()) into ids from unnest(ids) x;

  select jsonb_agg(to_jsonb(_shuffle(c2.opts)) order by t.ord) into ord
    from unnest(ids) with ordinality t(cid, ord) join cases c2 on c2.id = t.cid;

  c := _new_code();
  insert into game_sets(code, mode, level, case_ids, orders, created_by)
       values (c, p_mode, p_level, ids, ord, uid) returning id into sid;
  insert into attempts(set_id, player_id) values (sid, uid);
  return get_set(c);
end $$;

create or replace function public.join_set(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := _require_player();
  s game_sets;
  cnt int;
begin
  select * into s from game_sets where code = upper(btrim(p_code));
  if not found then raise exception 'set_not_found'; end if;
  if exists (select 1 from attempts where set_id = s.id and player_id = uid) then return get_set(s.code); end if;
  if s.mode = 'solo' then raise exception 'solo_set'; end if;
  select count(*) into cnt from attempts where set_id = s.id;
  if cnt >= 2 then raise exception 'duel_full'; end if;
  insert into attempts(set_id, player_id) values (s.id, uid);
  return get_set(s.code);
end $$;

-- marks the start time of a door; a reload never resets the clock
create or replace function public.open_door(p_attempt uuid, p_idx int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := _require_player(); a attempts;
begin
  select * into a from attempts where id = p_attempt and player_id = uid for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if a.finished_at is not null then raise exception 'attempt_finished'; end if;
  if p_idx <> a.next_door then raise exception 'wrong_door'; end if;
  if a.started_idx is distinct from p_idx then
    update attempts set started_idx = p_idx, door_started_at = now() where id = a.id returning * into a;
  end if;
  return jsonb_build_object('seconds_left', greatest(0, 45 - extract(epoch from now() - a.door_started_at))::numeric(6,2));
end $$;

-- server-side scoring; returns the score and the answer key for this door only
-- (answer_door: see fix_05 section at the end)

-- profile + spot results are written through these (the id always comes from the sign-in)
create or replace function public.save_profile(p_name text, p_dept int, p_role text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); n text := btrim(coalesce(p_name, ''));
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if char_length(n) not between 2 and 40 then raise exception 'bad_name'; end if;
  if p_role not in ('nurse','doctor') then raise exception 'bad_role'; end if;
  if not exists (select 1 from departments where id = p_dept) then raise exception 'choose_department'; end if;
  insert into players(id, name, dept_id, role) values (uid, n, p_dept, p_role)
  on conflict (id) do update set name = excluded.name, dept_id = excluded.dept_id, role = excluded.role, updated_at = now();
  return jsonb_build_object('id', uid, 'name', n, 'dept_id', p_dept, 'role', p_role);
end $$;

create or replace function public.save_spot(p_scene text, p_found text[], p_reason text, p_score int, p_shown text[] default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := _require_player(); sh text[]; f text[];
begin
  -- the errors that were actually in this picture (all of the room's errors if not sent)
  select coalesce(array_agg(i.id order by i.id), '{}') into sh from spot_items i
   where i.scene = p_scene and (p_shown is null or i.id = any(p_shown));
  if array_length(sh, 1) is null then raise exception 'unknown_scene'; end if;
  select coalesce(array_agg(distinct x), '{}') into f from unnest(coalesce(p_found, '{}')) x where x = any(sh);
  insert into spot_attempts(player_id, scene, found, shown, total, score, reason)
  values (uid, p_scene, f, sh, array_length(sh, 1), least(greatest(coalesce(p_score, 0), 0), 5000), p_reason);
end $$;

-- ---------------------------------------------------------------------
-- Manager RPCs
-- ---------------------------------------------------------------------
create or replace function public.my_manager() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when m.user_id is null then null else jsonb_build_object(
    'display_name', m.display_name, 'dept_id', m.dept_id, 'dept', d.name, 'is_admin', m.is_admin) end
  from (select 1) x left join managers m on m.user_id = auth.uid() left join departments d on d.id = m.dept_id
$$;

-- (list_cases_admin: see fix_05 section at the end)

-- (save_case: see fix_05 section at the end)

create or replace function public.set_case_active(p_id uuid, p_active boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := _require_manager(); owner uuid;
begin
  select created_by into owner from cases where id = p_id;
  if not found then raise exception 'case_not_found'; end if;
  if not (is_admin() or coalesce(owner = uid, false)) then raise exception 'not_allowed'; end if;
  update cases set active = p_active, updated_at = now() where id = p_id;
end $$;

-- everything the dashboard shows, filtered to the manager's department (admins: all, or one)
-- (dashboard: see fix_05 section at the end)

create or replace function public.roster_add(p_names text[], p_dept int default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := _require_manager(); d int := case when is_admin() then coalesce(p_dept, manager_dept()) else manager_dept() end;
begin
  if d is null then raise exception 'choose_department'; end if;
  insert into roster(dept_id, name) select d, btrim(x) from unnest(p_names) x where char_length(btrim(x)) between 2 and 40
  on conflict do nothing;
end $$;

create or replace function public.roster_remove(p_id int) returns void
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := _require_manager();
begin
  delete from roster where id = p_id and (is_admin() or dept_id = manager_dept());
end $$;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.departments   enable row level security;
alter table public.players       enable row level security;
alter table public.managers      enable row level security;
alter table public.cases         enable row level security;
alter table public.case_answers  enable row level security;
alter table public.game_sets     enable row level security;
alter table public.attempts      enable row level security;
alter table public.attempt_doors enable row level security;
alter table public.spot_attempts enable row level security;
alter table public.roster        enable row level security;
alter table public.spot_items    enable row level security;

drop policy if exists dep_read on public.departments;
create policy dep_read on public.departments for select using (true);

drop policy if exists players_read on public.players;
create policy players_read on public.players for select using (id = auth.uid() or public.is_manager());
drop policy if exists players_insert on public.players;
create policy players_insert on public.players for insert with check (id = auth.uid());
drop policy if exists players_update on public.players;
create policy players_update on public.players for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists managers_read on public.managers;
create policy managers_read on public.managers for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists cases_read on public.cases;
create policy cases_read on public.cases for select using (auth.uid() is not null and (active or public.is_manager()));

drop policy if exists spot_insert on public.spot_attempts;   -- results are saved only through save_spot()
drop policy if exists spot_read on public.spot_attempts;
create policy spot_read on public.spot_attempts for select using (player_id = auth.uid() or public.is_manager());

-- case_answers, game_sets, attempts, attempt_doors, roster: no policies = only reachable through the functions above

-- ---------------------------------------------------------------------
-- Function permissions: signed-in users only (anonymous sign-in counts)
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant  execute on function public.get_set(text), public.create_set(text,text), public.join_set(text),
                           public.open_door(uuid,int), 
                           public.my_manager(), 
                           public.set_case_active(uuid,boolean), 
                           public.roster_add(text[],int), public.roster_remove(int),
                           public.save_profile(text,int,text), public.save_spot(text,text[],text,int,text[]),
                           public.is_manager(), public.is_admin(), public.manager_dept()
  to authenticated;

-- ---- included from fix_04_no_levels.sql ----
alter table public.game_sets drop constraint if exists game_sets_level_check;
alter table public.game_sets add constraint game_sets_level_check check (level in ('basic','adv','all'));

create or replace function public.create_set(p_mode text, p_level text default 'all') returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := _require_player();
  ids uuid[];
  ord jsonb;
  c text;
  sid uuid;
begin
  if p_mode not in ('duel','solo') then raise exception 'bad_mode'; end if;

  -- 6 random active questions, any level
  select array_agg(id) into ids from (select id from cases where active order by random() limit 6) q;
  if coalesce(array_length(ids,1),0) = 0 then raise exception 'no_cases'; end if;

  select jsonb_agg(to_jsonb(_shuffle(c2.opts)) order by t.ord) into ord
    from unnest(ids) with ordinality t(cid, ord) join cases c2 on c2.id = t.cid;

  c := _new_code();
  insert into game_sets(code, mode, level, case_ids, orders, created_by)
       values (c, p_mode, 'all', ids, ord, uid) returning id into sid;
  insert into attempts(set_id, player_id) values (sid, uid);
  return get_set(c);
end $$;

revoke execute on function public.create_set(text,text) from public, anon;
grant  execute on function public.create_set(text,text) to authenticated;

-- ---- included from fix_05_multi_hand.sql ----
alter table public.case_answers  add column if not exists hands text[];
update public.case_answers set hands = array[hand] where hands is null;
alter table public.case_answers  drop constraint if exists case_answers_hands_check;
alter table public.case_answers  add constraint case_answers_hands_check check (hands is null or hands <@ array['alcohol','soap','none']);
alter table public.attempt_doors add column if not exists hands text[];

drop function if exists public.answer_door(uuid, int, text, text[], text);

create or replace function public.answer_door(p_attempt uuid, p_idx int, p_iso text, p_ppe text[], p_hand text default null, p_hands text[] default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := _require_player();
  a attempts; s game_sets; c cases; k case_answers;
  n int; elapsed numeric; remaining numeric;
  iso_pts int := 0; iso_state text := 'no'; note text := null;
  ppe_pts int := 0; ppe_state text := 'no';
  hand_pts int := 0; hand_state text := 'no';
  sel text[]; hit int; extra int; need int; v_base int; speed int; total int;
  hsel text[]; key_hands text[];
  done boolean;
begin
  select * into a from attempts where id = p_attempt and player_id = uid for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if a.finished_at is not null then raise exception 'attempt_finished'; end if;
  if p_idx <> a.next_door or a.started_idx is distinct from p_idx then raise exception 'wrong_door'; end if;
  select * into s from game_sets where id = a.set_id;
  n := array_length(s.case_ids, 1);
  select * into c from cases where id = s.case_ids[p_idx + 1];
  select * into k from case_answers where case_id = c.id;

  elapsed := extract(epoch from now() - a.door_started_at);
  remaining := greatest(0, 45 - elapsed);

  -- sign: 50
  if p_iso = k.iso then iso_pts := 50; iso_state := 'ok';
  elsif p_iso is not null and k.partial ? p_iso then
    iso_pts := coalesce((k.partial -> p_iso ->> 'p')::int, 0); iso_state := 'half'; note := k.partial -> p_iso ->> 'n';
  end if;

  -- PPE: 30
  if p_ppe is not null then
    select coalesce(array_agg(distinct x), '{}') into sel from unnest(p_ppe) x where x = any(array['gloves','gown','mask','n95','eye']);
    need := coalesce(array_length(k.ppe,1), 0);
    select count(*) into hit   from unnest(sel) x where x = any(k.ppe);
    select count(*) into extra from unnest(sel) x where not (x = any(k.ppe));
    if need = 0 then ppe_pts := greatest(0, 30 - 10*extra);
    else ppe_pts := greatest(0, round(30.0 * hit / need)::int - 10*extra); end if;
    ppe_state := case when ppe_pts = 30 then 'ok' when ppe_pts > 0 then 'half' else 'no' end;
  end if;

  -- hand hygiene: 20 — one or more correct answers, scored like PPE
  key_hands := coalesce(k.hands, array[k.hand]);
  hsel := coalesce(p_hands, case when p_hand is null then null else array[p_hand] end);
  if hsel is not null then
    select coalesce(array_agg(distinct x), '{}') into hsel from unnest(hsel) x where x = any(array['alcohol','soap','none']);
    need := array_length(key_hands, 1);
    select count(*) into hit   from unnest(hsel) x where x = any(key_hands);
    select count(*) into extra from unnest(hsel) x where not (x = any(key_hands));
    if 'none' = any(hsel) and array_length(hsel, 1) > 1 then extra := extra + 1; end if;  -- "no need" can't be combined
    hand_pts := greatest(0, round(20.0 * hit / need)::int - 10*extra);
    hand_state := case when hand_pts = 20 then 'ok' when hand_pts > 0 then 'half' else 'no' end;
  end if;

  v_base := iso_pts + ppe_pts + hand_pts;
  speed := round(20 * (remaining / 45.0) * (v_base / 100.0))::int;
  total := v_base + speed;

  insert into attempt_doors(attempt_id, idx, case_id, iso, ppe, hand, hands, iso_pts, ppe_pts, hand_pts, speed, total, iso_state, ppe_state, hand_state)
       values (a.id, p_idx, c.id, p_iso, sel, hsel[1], hsel, iso_pts, ppe_pts, hand_pts, speed, total, iso_state, ppe_state, hand_state);

  done := p_idx + 1 >= n;
  update attempts set next_door = p_idx + 1, score = score + total, base = attempts.base + v_base,
         started_idx = null, door_started_at = null,
         finished_at = case when done then now() else null end
   where id = a.id;

  return jsonb_build_object(
    'iso', iso_pts, 'ppe', ppe_pts, 'hand', hand_pts, 'speed', speed, 'total', total,
    'iso_state', iso_state, 'ppe_state', ppe_state, 'hand_state', hand_state, 'iso_note', note,
    'timed_out', elapsed > 46,
    'correct', jsonb_build_object('iso', k.iso, 'ppe', to_jsonb(k.ppe), 'hand', key_hands[1], 'hands', to_jsonb(key_hands)),
    'why', jsonb_build_object('iso', k.why_iso, 'ppe', k.why_ppe, 'hand', k.why_hand),
    'finished', done
  );
end $$;

create or replace function public.list_cases_admin() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := _require_manager(); adm boolean := is_admin();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'level', c.level, 'room', c.room, 'title', c.title, 'who', c.who, 'file', to_jsonb(c.file), 'task', c.task,
      'opts', to_jsonb(c.opts), 'active', c.active, 'dept', d.name, 'author', coalesce(m.display_name, case when c.code is not null then 'المحتوى الأساسي' end),
      'updated_at', c.updated_at,
      'can_edit', adm or c.created_by = uid,
      'iso', k.iso, 'ppe', to_jsonb(k.ppe), 'hand', k.hand, 'hands', to_jsonb(coalesce(k.hands, array[k.hand])), 'partial', k.partial,
      'why_iso', k.why_iso, 'why_ppe', k.why_ppe, 'why_hand', k.why_hand) order by c.active desc, c.level, c.created_at)
    from cases c join case_answers k on k.case_id = c.id
    left join departments d on d.id = c.dept_id
    left join managers m on m.user_id = c.created_by), '[]'::jsonb);
end $$;

create or replace function public.save_case(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := _require_manager();
  cid uuid := nullif(p->>'id','')::uuid;
  v_opts text[]; v_file text[]; v_ppe text[]; v_hands text[];
  v_iso text := p->>'iso'; v_hand text := p->>'hand'; v_level text := p->>'level';
  v_partial jsonb := coalesce(p->'partial', '{}'::jsonb);
  owner uuid;
begin
  select coalesce(array_agg(btrim(x)), '{}') into v_file from jsonb_array_elements_text(coalesce(p->'file','[]')) x where btrim(x) <> '';
  select coalesce(array_agg(distinct x), '{}') into v_opts from jsonb_array_elements_text(coalesce(p->'opts','[]')) x;
  select coalesce(array_agg(distinct x), '{}') into v_ppe  from jsonb_array_elements_text(coalesce(p->'ppe','[]')) x;

  if coalesce(btrim(p->>'title'),'') = '' or coalesce(btrim(p->>'who'),'') = '' or coalesce(btrim(p->>'task'),'') = '' then raise exception 'missing_text'; end if;
  if coalesce(btrim(p->>'why_iso'),'') = '' or coalesce(btrim(p->>'why_ppe'),'') = '' or coalesce(btrim(p->>'why_hand'),'') = '' then raise exception 'missing_explanation'; end if;
  if array_length(v_file,1) is null then raise exception 'missing_file'; end if;
  if v_level is null or v_level not in ('basic','adv') then v_level := 'basic'; end if;
  if not (v_iso = any(v_opts)) then raise exception 'answer_not_in_options'; end if;
  select coalesce(array_agg(distinct x order by x), '{}') into v_hands
    from jsonb_array_elements_text(case when jsonb_typeof(p->'hands') = 'array' then p->'hands' else jsonb_build_array(v_hand) end) x
   where x is not null;
  if array_length(v_hands,1) is null or not (v_hands <@ array['alcohol','soap','none']) then raise exception 'bad_hand'; end if;
  if 'none' = any(v_hands) and array_length(v_hands,1) > 1 then raise exception 'bad_hand'; end if;
  v_hand := case when 'soap' = any(v_hands) then 'soap' else v_hands[1] end;
  -- keep only partial credits for options that exist and are not the answer, capped below full marks
  select coalesce(jsonb_object_agg(key, jsonb_build_object('p', least(45, greatest(0, (value->>'p')::int)), 'n', coalesce(value->>'n',''))), '{}'::jsonb)
    into v_partial from jsonb_each(v_partial) where key = any(v_opts) and key <> v_iso and (value->>'p') ~ '^\d+$';

  if cid is null then
    insert into cases(level, room, title, who, file, task, opts, dept_id, created_by)
    values (v_level, coalesce(nullif(btrim(p->>'room'),''),'—'), btrim(p->>'title'), btrim(p->>'who'), v_file, btrim(p->>'task'), v_opts, manager_dept(), uid)
    returning id into cid;
    insert into case_answers(case_id, iso, ppe, hand, hands, partial, why_iso, why_ppe, why_hand)
    values (cid, v_iso, v_ppe, v_hand, v_hands, v_partial, btrim(p->>'why_iso'), btrim(p->>'why_ppe'), btrim(p->>'why_hand'));
  else
    select created_by into owner from cases where id = cid;
    if not found then raise exception 'case_not_found'; end if;
    if not (is_admin() or coalesce(owner = uid, false)) then raise exception 'not_allowed'; end if;
    update cases set level = v_level, room = coalesce(nullif(btrim(p->>'room'),''),'—'), title = btrim(p->>'title'), who = btrim(p->>'who'),
           file = v_file, task = btrim(p->>'task'), opts = v_opts, updated_at = now() where id = cid;
    update case_answers set iso = v_iso, ppe = v_ppe, hand = v_hand, hands = v_hands, partial = v_partial,
           why_iso = btrim(p->>'why_iso'), why_ppe = btrim(p->>'why_ppe'), why_hand = btrim(p->>'why_hand') where case_id = cid;
  end if;
  return cid;
end $$;

create or replace function public.dashboard(p_dept int default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := _require_manager();
  dept int := case when is_admin() then p_dept else manager_dept() end;
  res jsonb;
begin
  with fin as (
    select a.*, p.name, p.dept_id, p.role, gs.mode, array_length(gs.case_ids,1) as n,
           round(a.base * 100.0 / (array_length(gs.case_ids,1) * 100))::int as pct
      from attempts a join players p on p.id = a.player_id join game_sets gs on gs.id = a.set_id
     where a.finished_at is not null and (dept is null or p.dept_id = dept)
  ),
  wins as (
    select f.id, exists (select 1 from attempts o where o.set_id = f.set_id and o.id <> f.id and o.finished_at is not null and o.score < f.score) as won
      from fin f where f.mode = 'duel'
  ),
  doors as (
    select ad.*, f.dept_id from attempt_doors ad join fin f on f.id = ad.attempt_id
  ),
  sp as (
    select s.*, p.name, p.dept_id from spot_attempts s join players p on p.id = s.player_id
     where dept is null or p.dept_id = dept
  )
  select jsonb_build_object(
    'dept_filter', dept,
    'kpis', jsonb_build_object(
       'games',   (select count(*) from fin),
       'players', (select count(distinct player_id) from fin) ,
       'avg',     (select coalesce(round(avg(pct)),0) from fin),
       'spot_games', (select count(*) from sp)),
    'comp', (select jsonb_build_object(
       'iso',  coalesce(round(100.0*sum(case iso_state when 'ok' then 1 when 'half' then .5 else 0 end)/nullif(count(*),0)),0),
       'ppe',  coalesce(round(100.0*sum(case ppe_state when 'ok' then 1 when 'half' then .5 else 0 end)/nullif(count(*),0)),0),
       'hand', coalesce(round(100.0*sum(case hand_state when 'ok' then 1 when 'half' then .5 else 0 end)/nullif(count(*),0)),0)) from doors),
    'misses', (select coalesce(jsonb_agg(m order by (m->>'rate')::int desc, (m->>'n')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('title', c.title, 'part', part, 'rate', round(100.0*wrong/n)::int, 'wrong', wrong, 'n', n) as m
          from (
            select case_id, 'iso' as part, count(*) filter (where iso_state <> 'ok') as wrong, count(*) as n from doors group by case_id
            union all select case_id, 'ppe', count(*) filter (where ppe_state <> 'ok'), count(*) from doors group by case_id
            union all select case_id, 'hand', count(*) filter (where hand_state <> 'ok'), count(*) from doors group by case_id
          ) z join cases c on c.id = z.case_id
         where wrong > 0
         order by round(100.0*wrong/n) desc, n desc limit 8) q),
    'depts', (select coalesce(jsonb_agg(jsonb_build_object('dept', d.name, 'players', x.players, 'games', x.games, 'avg', x.avg) order by x.avg desc), '[]'::jsonb)
                from (select dept_id, count(distinct player_id) players, count(*) games, round(avg(pct))::int avg from fin group by dept_id) x
                join departments d on d.id = x.dept_id),
    'people', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'dept', d.name, 'role', x.role, 'games', x.games, 'wins', x.wins, 'avg', x.avg, 'last', x.last) order by x.avg desc), '[]'::jsonb)
                from (select f.player_id, max(f.name) name, max(f.dept_id) dept_id, max(f.role) role, count(*) games,
                             count(*) filter (where w.won) wins, round(avg(f.pct))::int avg, max(f.finished_at) last
                        from fin f left join wins w on w.id = f.id group by f.player_id) x
                join departments d on d.id = x.dept_id),
    'spot', jsonb_build_object(
       'games', (select count(*) from sp),
       'avg_found', (select coalesce(round(avg(coalesce(array_length(sp.found,1),0)),1),0) from sp),
       'avg_pct',   (select coalesce(round(avg(100.0*coalesce(array_length(sp.found,1),0)/nullif(sp.total,0))),0) from sp),
       'items', (select coalesce(jsonb_agg(x order by (x->>'rate')::int), '[]'::jsonb) from (
                   select jsonb_build_object('id', i.id, 'title', i.title, 'scene', i.scene_name, 'n', count(sp.id),
                          'rate', round(100.0*count(sp.id) filter (where i.id = any(sp.found))/count(sp.id))) as x
                     from spot_items i join sp on sp.scene = i.scene and (sp.shown is null or i.id = any(sp.shown))
                    group by i.scene, i.scene_name, i.id, i.title) q)),
    'roster', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'dept', d.name,
                   'played', exists (select 1 from players p where btrim(p.name) = btrim(r.name) and p.dept_id = r.dept_id
                                       and (exists (select 1 from attempts a where a.player_id = p.id and a.finished_at is not null)
                                            or exists (select 1 from spot_attempts s where s.player_id = p.id)))) order by r.name), '[]'::jsonb)
                 from roster r join departments d on d.id = r.dept_id where dept is null or r.dept_id = dept)
  ) into res;
  return res;
end $$;

revoke execute on function public.answer_door(uuid,int,text,text[],text,text[]) from public, anon;
grant  execute on function public.answer_door(uuid,int,text,text[],text,text[]) to authenticated;

revoke execute on function public.list_cases_admin(), public.save_case(jsonb), public.dashboard(int) from public, anon;
grant  execute on function public.list_cases_admin(), public.save_case(jsonb), public.dashboard(int) to authenticated;
