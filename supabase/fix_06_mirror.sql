-- =====================================================================
--  إصلاح ٦: المراية الذكية (فحص الواقيات بالكاميرا)
--  شغّله مرة واحدة في Supabase → SQL Editor (بعد fix_05_multi_hand.sql)
--  آمن لو اتشغل مرتين. بيتحفظ نتيجة الفحص بس، مفيش أي صورة.
-- =====================================================================
create table if not exists public.mirror_checks (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  mask       text not null check (mask   in ('ok','missing','wrong','uncertain')),
  gown       text not null check (gown   in ('ok','missing','wrong','uncertain')),
  gloves     text not null check (gloves in ('ok','missing','wrong','uncertain')),
  overall    text not null check (overall in ('pass','fail','uncertain')),
  created_at timestamptz not null default now()
);
create index if not exists mirror_player_idx on public.mirror_checks(player_id);

-- no policies = only reachable through save_mirror_check() and dashboard()
alter table public.mirror_checks enable row level security;

-- only the result is saved (never an image); "pass" only when all three are ok
create or replace function public.save_mirror_check(p_mask text, p_gown text, p_gloves text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := _require_player(); s text[] := array[p_mask, p_gown, p_gloves];
begin
  if p_mask is null or p_gown is null or p_gloves is null
     or not (s <@ array['ok','missing','wrong','uncertain']) then raise exception 'bad_state'; end if;
  insert into mirror_checks(player_id, mask, gown, gloves, overall)
  values (uid, p_mask, p_gown, p_gloves,
          case when s <@ array['ok'] then 'pass'
               when s && array['missing','wrong'] then 'fail'
               else 'uncertain' end);
end $$;

-- everything the dashboard shows, filtered to the manager's department (admins: all, or one) + 'mirror'
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
  ),
  mc as (
    select c.* from mirror_checks c join players p on p.id = c.player_id
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
    'mirror', jsonb_build_object(
       'checks',   (select count(*) from mc),
       'pass_pct', (select coalesce(round(100.0*count(*) filter (where overall = 'pass')/nullif(count(*),0)),0) from mc),
       'items', (select jsonb_build_object(
          'mask',   jsonb_build_object('ok',     coalesce(round(100.0*count(*) filter (where mask = 'ok')/nullif(count(*),0)),0),
                                       'bad',    coalesce(round(100.0*count(*) filter (where mask in ('missing','wrong'))/nullif(count(*),0)),0),
                                       'unsure', coalesce(round(100.0*count(*) filter (where mask = 'uncertain')/nullif(count(*),0)),0)),
          'gown',   jsonb_build_object('ok',     coalesce(round(100.0*count(*) filter (where gown = 'ok')/nullif(count(*),0)),0),
                                       'bad',    coalesce(round(100.0*count(*) filter (where gown in ('missing','wrong'))/nullif(count(*),0)),0),
                                       'unsure', coalesce(round(100.0*count(*) filter (where gown = 'uncertain')/nullif(count(*),0)),0)),
          'gloves', jsonb_build_object('ok',     coalesce(round(100.0*count(*) filter (where gloves = 'ok')/nullif(count(*),0)),0),
                                       'bad',    coalesce(round(100.0*count(*) filter (where gloves in ('missing','wrong'))/nullif(count(*),0)),0),
                                       'unsure', coalesce(round(100.0*count(*) filter (where gloves = 'uncertain')/nullif(count(*),0)),0))) from mc)),
    'roster', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'dept', d.name,
                   'played', exists (select 1 from players p where btrim(p.name) = btrim(r.name) and p.dept_id = r.dept_id
                                       and (exists (select 1 from attempts a where a.player_id = p.id and a.finished_at is not null)
                                            or exists (select 1 from spot_attempts s where s.player_id = p.id)))) order by r.name), '[]'::jsonb)
                 from roster r join departments d on d.id = r.dept_id where dept is null or r.dept_id = dept)
  ) into res;
  return res;
end $$;

revoke execute on function public.save_mirror_check(text,text,text), public.dashboard(int) from public, anon;
grant  execute on function public.save_mirror_check(text,text,text), public.dashboard(int) to authenticated;
