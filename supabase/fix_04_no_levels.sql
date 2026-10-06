-- =====================================================================
--  إصلاح ٤: إلغاء المستوى — كل لعبة بتسحب ٦ أسئلة عشوائي من كل الأسئلة الشغالة
--  شغّله مرة واحدة في Supabase → SQL Editor
-- =====================================================================
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
