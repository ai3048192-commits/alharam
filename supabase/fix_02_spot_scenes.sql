-- =====================================================================
--  إصلاح ٢: أكتر من أوضة في "طلّع الغلطات"
--  شغّله مرة واحدة في Supabase → SQL Editor (بعد fix_01_profile.sql)
-- =====================================================================
create table if not exists public.spot_items (
  scene      text not null,
  scene_name text not null,
  id         text not null,
  title      text not null,
  primary key (scene, id)
);
alter table public.spot_items enable row level security;

-- results now come only through save_spot(), which checks them against spot_items
alter table public.spot_attempts drop constraint if exists spot_attempts_found_check;
drop policy if exists spot_insert on public.spot_attempts;
drop function if exists public.save_spot(text[], text, int);

create or replace function public.save_spot(p_scene text, p_found text[], p_reason text, p_score int) returns void
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := _require_player(); n int; f text[];
begin
  select count(*) into n from spot_items where scene = p_scene;
  if n = 0 then raise exception 'unknown_scene'; end if;
  select coalesce(array_agg(distinct x), '{}') into f from unnest(coalesce(p_found, '{}')) x
   where exists (select 1 from spot_items i where i.scene = p_scene and i.id = x);
  insert into spot_attempts(player_id, scene, found, total, score, reason)
  values (uid, p_scene, f, n, least(greatest(coalesce(p_score, 0), 0), 5000), p_reason);
end $$;

-- everything the dashboard shows, filtered to the manager's department (admins: all, or one)
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
       'hand', coalesce(round(100.0*sum(case hand_state when 'ok' then 1 else 0 end)/nullif(count(*),0)),0)) from doors),
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
                     from spot_items i join sp on sp.scene = i.scene
                    group by i.scene, i.scene_name, i.id, i.title) q)),
    'roster', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'dept', d.name,
                   'played', exists (select 1 from players p where btrim(p.name) = btrim(r.name) and p.dept_id = r.dept_id
                                       and (exists (select 1 from attempts a where a.player_id = p.id and a.finished_at is not null)
                                            or exists (select 1 from spot_attempts s where s.player_id = p.id)))) order by r.name), '[]'::jsonb)
                 from roster r join departments d on d.id = r.dept_id where dept is null or r.dept_id = dept)
  ) into res;
  return res;
end $$;

-- غلطات أوض "طلّع الغلطات"
insert into public.spot_items(scene, scene_name, id, title) values
  ('room1', 'أوضة مريض', 'sign', 'الباب من غير لافتة عزل'),
  ('room1', 'أوضة مريض', 'rub', 'جهاز الكحول فاضي'),
  ('room1', 'أوضة مريض', 'mask', 'الماسك نازل تحت الأنف والبق'),
  ('room1', 'أوضة مريض', 'phone', 'بيمسك الموبايل بالجوانتي'),
  ('room1', 'أوضة مريض', 'sharps', 'صندوق الإبر مليان على الآخر'),
  ('room1', 'أوضة مريض', 'waste', 'شاش عليه دم في الكيس الأسود'),
  ('room1', 'أوضة مريض', 'urine', 'كيس البول على الأرض'),
  ('room1', 'أوضة مريض', 'linen', 'ملايات متسخة على الأرض'),
  ('icu', 'الرعاية المركزة', 'icu_hob', 'رأس السرير مفرود'),
  ('icu', 'الرعاية المركزة', 'icu_line', 'غيار القسطرة متسخ ومش لازق'),
  ('icu', 'الرعاية المركزة', 'icu_needle', 'سرنجة بإبرة على سرير المريض'),
  ('icu', 'الرعاية المركزة', 'icu_tube', 'خرطوم المحلول نازل على الأرض'),
  ('icu', 'الرعاية المركزة', 'icu_suction', 'طرف الشفط مرمي على الأرض'),
  ('icu', 'الرعاية المركزة', 'icu_cup', 'كوباية شاي جنب المريض'),
  ('icu', 'الرعاية المركزة', 'icu_gown', 'جاون متعلّق عشان يتلبس تاني'),
  ('icu', 'الرعاية المركزة', 'icu_bin', 'سلة الزبالة مليانة ومفتوحة'),
  ('dress', 'غرفة الغيار', 'dr_towel', 'فوطة قماش جنب الحوض'),
  ('dress', 'غرفة الغيار', 'dr_gloves', 'علبة الجوانتي على حرف الحوض'),
  ('dress', 'غرفة الغيار', 'dr_watch', 'لابس ساعة في إيده'),
  ('dress', 'غرفة الغيار', 'dr_pack', 'الغيار المعقم مفتوح ومتساب'),
  ('dress', 'غرفة الغيار', 'dr_phone', 'موبايل على ترولي الغيار'),
  ('dress', 'غرفة الغيار', 'dr_dirty', 'غيار متسخ على الترولي النضيف'),
  ('dress', 'غرفة الغيار', 'dr_vial', 'إبرة متسابة في الفيال'),
  ('dress', 'غرفة الغيار', 'dr_box', 'كرتونة مستلزمات على الأرض'),
  ('station', 'محطة التمريض', 'st_fridge', 'أكل في تلاجة الأدوية'),
  ('station', 'محطة التمريض', 'st_rub', 'حامل الكحول فاضي'),
  ('station', 'محطة التمريض', 'st_iv', 'محلول متعلق من غير تاريخ'),
  ('station', 'محطة التمريض', 'st_syr', 'سرنجات متحضرة من غير اسم'),
  ('station', 'محطة التمريض', 'st_gloves', 'جوانتي مستعمل على الترابيزة'),
  ('station', 'محطة التمريض', 'st_sharps', 'صندوق الإبر مفتوح'),
  ('station', 'محطة التمريض', 'st_linen', 'عربية الملايات النضيفة مكشوفة'),
  ('station', 'محطة التمريض', 'st_mop', 'جردل مسح بمية متسخة متساب')
on conflict (scene, id) do update set scene_name = excluded.scene_name, title = excluded.title;


revoke execute on function public.save_spot(text,text[],text,int) from public, anon;
grant  execute on function public.save_spot(text,text[],text,int), public.dashboard(int) to authenticated;
