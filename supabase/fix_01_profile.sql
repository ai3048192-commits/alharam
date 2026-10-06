-- =====================================================================
--  إصلاح ١: حفظ بيانات اللاعب ونتيجة "طلّع الغلطات" عن طريق فنكشن على السيرفر
--  شغّله مرة واحدة في SQL Editor (لو شغّلت schema.sql الجديد مش محتاجه)
-- =====================================================================
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

create or replace function public.save_spot(p_found text[], p_reason text, p_score int) returns void
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := _require_player();
begin
  insert into spot_attempts(player_id, found, total, score, reason)
  values (uid, coalesce(p_found, '{}'), 8, least(greatest(coalesce(p_score, 0), 0), 5000), p_reason);
end $$;

revoke execute on function public.save_profile(text,int,text), public.save_spot(text[],text,int) from public, anon;
grant  execute on function public.save_profile(text,int,text), public.save_spot(text[],text,int) to authenticated;
