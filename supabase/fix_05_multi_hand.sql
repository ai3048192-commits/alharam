-- =====================================================================
--  إصلاح ٥: نظافة الإيدين ممكن يبقى ليها أكتر من إجابة صح
--  شغّله مرة واحدة في Supabase → SQL Editor (بعد fix_04_no_levels.sql)
-- =====================================================================
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
