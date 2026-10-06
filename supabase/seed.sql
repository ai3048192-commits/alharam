-- =====================================================================
--  على الباب — seed data (departments + the 14 reviewed starter cases)
--  شغّله بعد schema.sql. ينفع يتشغّل أكتر من مرة من غير ما يكرر حاجة.
-- =====================================================================
insert into public.departments(name, sort) values
  ('الباطنة', 0),
  ('الجراحة', 1),
  ('الرعاية المركزة', 2),
  ('الأطفال', 3),
  ('الطوارئ', 4),
  ('النسا والتوليد', 5),
  ('أخرى', 6)
on conflict (name) do nothing;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('b1', 'basic', '204', 'اشتباه درن رئوي', 'راجل، 45 سنة', array['كحة بقالها 4 أسابيع','عرق بالليل ونزل 6 كيلو','الأشعة: كهف في الرئة الفوقانية اليمين']::text[], 'هتدخل تاخد العلامات الحيوية', array['airborne','droplet','contact','std']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'airborne', array['n95']::text[], 'alcohol', '{"droplet":{"p":15,"n":"الرذاذ مش كفاية. الدرن بيفضل في الهوا."}}'::jsonb, 'اشتباه درن رئوي يعني عزل هوائي، ويفضل غرفة ضغط سلبي لو متاحة.', 'N95 للي داخل الأوضة. الماسك الجراحي مش بيحمي من الدرن، وبيلبسه المريض نفسه بس لو هيخرج من الأوضة.', 'إيدك مش متسخة بشكل واضح، فالكحول كفاية.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('b2', 'basic', '118', 'MRSA في جرح', 'ست، 60 سنة، بعد تغيير مفصل ركبة', array['الجرح فيه صديد','المزرعة: MRSA','مفيش أعراض تنفسية']::text[], 'هتغيّر على الجرح', array['contact','droplet','airborne','std']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'contact', array['gloves','gown']::text[], 'alcohol', '{}'::jsonb, 'الميكروبات المقاومة زي MRSA بتنتقل باللمس، سواء لمس مباشر أو عن طريق الأسطح، فعزلها تلامسي.', 'جوانتي وجاون قبل ما تدخل، وتقلعهم قبل ما تخرج. الماسك مش مطلوب غير لو فيه احتمال رشاش.', 'الكحول فعّال ضد MRSA. اغسل إيدك على طول بعد ما تقلع الجوانتي.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('b3', 'basic', '310', 'إسهال C. difficile', 'راجل، 72 سنة، على مضاد حيوي واسع المدى', array['إسهال مائي 5 مرات في اليوم','C. difficile toxin: إيجابي']::text[], 'هتساعده يتنقل من السرير للكرسي', array['enteric','contact','droplet','std']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'enteric', array['gloves','gown']::text[], 'soap', '{"contact":{"p":30,"n":"العزل التلامسي صح كبداية، بس الـ C. diff محتاج كمان غسيل بالمية والصابون وتطهير بالكلور."}}'::jsonb, 'تلامسي مُعزّز: عزل تلامسي، وغسيل الإيدين بالمية والصابون، وتطهير الأوضة بمطهر بيقتل الحويصلات (spores).', 'جوانتي وجاون لأي تعامل مع المريض أو الأوضة.', 'الكحول مش بيقتل حويصلات الـ C. diff. لازم مية وصابون.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('b4', 'basic', 'PED-6', 'إنفلونزا', 'طفل، 7 سنين', array['حرارة 39 وكحة ورشح','وجع في الجسم','مسحة الأنف: Influenza A إيجابي']::text[], 'هتديله العلاج اللي بيتاخد بالبق', array['droplet','airborne','contact','std']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'droplet', array['mask']::text[], 'alcohol', '{"airborne":{"p":15,"n":"الإنفلونزا بتنتقل أساسًا بالرذاذ، وN95 بيتلبس بس وقت الإجراءات اللي بتطلع رذاذ صغير في الهوا (aerosol)."}}'::jsonb, 'الإنفلونزا بتنتقل برذاذ كبير الحجم لمسافة قريبة، فعزلها رذاذ.', 'ماسك جراحي تلبسه وانت داخل. الجوانتي حسب الاحتياطات القياسية.', 'الكحول فعّال ضد فيروس الإنفلونزا.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('b5', 'basic', 'PED-2', 'حصبة', 'طفلة، 3 سنين، مش متطعّمة', array['حرارة عالية وكحة','طفح بدأ من الوش ونازل','بقع بيضا صغيرة جوه الخد (Koplik)']::text[], 'هتقيس الحرارة', array['airborne','droplet','contact_droplet','std']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'airborne', array['n95']::text[], 'alcohol', '{"droplet":{"p":15,"n":"الحصبة من أكتر الأمراض عدوى، وفيروسها بيفضل في الهوا."}}'::jsonb, 'الحصبة عزلها هوائي. ويفضل اللي يدخل يكون عنده مناعة ضدها (متطعّم أو اتصاب قبل كده).', 'N95 لأي حد داخل الأوضة.', 'الكحول كفاية لأن إيدك مش متسخة بشكل واضح.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('b6', 'basic', '215', 'HIV مستقر', 'راجل، 38 سنة، HIV متابَع وعلى علاج', array['داخل لعملية زايدة','مفيش إسهال ولا أعراض تنفسية','مفيش جروح مفتوحة']::text[], 'هتقيس الضغط والحرارة', array['std','contact','droplet','airborne']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'std', '{}'::text[], 'alcohol', '{}'::jsonb, 'HIV وفيروس B وفيروس C بيتنقلوا بالدم، فالاحتياطات القياسية كفاية. العزل هنا مالوش لازمة وبيضر المريض نفسيًا (وصمة).', 'قياس الضغط مش محتاج أي واقيات. الجوانتي بيتلبس بس لو هتلمس دم أو سوائل.', 'نظافة الإيدين بالكحول قبل وبعد ما تلمس المريض.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('b7', 'basic', 'ICU-3', 'Klebsiella مقاومة (CRE)', 'راجل، 55 سنة، على جهاز تنفس', array['مزرعة البلغم: Klebsiella pneumoniae','مقاومة للكاربابينيم (CRE)','حرارة 38.4']::text[], 'هتعدّل وضع المريض في السرير', array['contact','droplet','airborne','std']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'contact', array['gloves','gown']::text[], 'alcohol', '{"droplet":{"p":10,"n":"ميكروبات الـ CRE بتنتقل باللمس والأسطح، مش بالرذاذ، حتى لو موجودة في البلغم."}}'::jsonb, 'البكتيريا سالبة الجرام المقاومة للمضادات (CRE وESBL وAcinetobacter) عزلها تلامسي.', 'جوانتي وجاون. ولو هتعمل شفط مفتوح للمريض، تزوّد ماسك وواقي عين.', 'الكحول فعّال. والأهم إنك تنضف إيدك قبل ما تلمس أي حاجة برا السرير.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('b8', 'basic', '220', 'اشتباه نوروفيرس', 'ست، 80 سنة', array['3 مرضى في نفس العنبر جالهم ترجيع وإسهال فجأة','الاشتباه: Norovirus','المريضة مش قادرة تتحكم في الإخراج']::text[], 'هتغيّر لها الحفاضة', array['enteric','droplet','airborne','std']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'enteric', array['gloves','gown']::text[], 'soap', '{}'::jsonb, 'وقت التفشي، ومع مريض مش متحكم في الإخراج، العزل بيبقى تلامسي، مع مية وصابون وتطهير مكثف للأوضة.', 'جوانتي وجاون. ولو فيه احتمال ترجيع يطرطش، تزوّد ماسك.', 'النوروفيرس مش بيتأثر بالكحول كويس، فالمية والصابون أفضل.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('a1', 'adv', 'ONC-5', 'حزام ناري منتشر', 'ست، 52 سنة، على علاج كيماوي', array['حويصلات في أكتر من جلدية (Disseminated zoster)','مناعتها ضعيفة']::text[], 'هتفحص الجلد', array['airborne_contact','contact','droplet','std']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'airborne_contact', array['n95','gown','gloves']::text[], 'alcohol', '{"contact":{"p":20,"n":"التلامسي لوحده مش كفاية مع الحزام الناري المنتشر. الفيروس بيتنقل في الهوا كمان."}}'::jsonb, 'الحزام الناري المنتشر، أو أي حزام ناري عند حد مناعته ضعيفة، عزله هوائي وتلامسي لحد ما كل الحويصلات تنشف.', 'N95 وجاون وجوانتي. واللي ملوش مناعة ضد الجديري ميدخلش.', 'الكحول فعّال ضد فيروس الحزام الناري (VZV).' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('a2', 'adv', '231', 'حزام ناري موضعي', 'راجل، 70 سنة، مناعته سليمة', array['حزام ناري في جلدية واحدة في الصدر','الحويصلات متغطية بالكامل']::text[], 'هتراجع العلاج معاه', array['std','airborne_contact','contact','droplet']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'std', '{}'::text[], 'alcohol', '{}'::jsonb, 'لو الحزام الناري في جلدية واحدة، والمريض مناعته سليمة، والحويصلات متغطية، يبقى الاحتياطات القياسية كفاية.', 'مفيش واقيات مطلوبة للكلام والمراجعة. واللي ملوش مناعة ضد الجديري يبعد عن رعايته.', 'الكحول قبل وبعد ما تلمس المريض.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('a3', 'adv', 'ICU-7', 'التهاب سحائي بعد 48 ساعة', 'شاب، 19 سنة', array['التهاب سحائي بالمكورات السحائية (N. meningitidis)','بقاله 48 ساعة على Ceftriaxone','متحسن']::text[], 'هتعمله الكشف اليومي', array['std','droplet','airborne','contact']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'std', '{}'::text[], 'alcohol', '{"droplet":{"p":20,"n":"عزل الرذاذ كان صح في أول 24 ساعة من العلاج بس."}}'::jsonb, 'عزل الرذاذ بيستمر لحد ما يعدّي 24 ساعة على العلاج الفعّال، وبعدها نرجع للاحتياطات القياسية.', 'مفيش واقيات مطلوبة للكشف العادي بعد ما العزل اتشال.', 'الكحول.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('a4', 'adv', '126', 'التهاب رئوي Adenovirus', 'راجل، 24 سنة', array['التهاب رئوي','Respiratory PCR: Adenovirus','التهاب في الملتحمة']::text[], 'هتسمع الصدر', array['contact_droplet','droplet','airborne','contact']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'contact_droplet', array['mask','gown','gloves']::text[], 'alcohol', '{"droplet":{"p":25,"n":"الأدينوفيرس بيعيش على الأسطح كمان، فمحتاج عزل تلامسي جنب الرذاذ."},"contact":{"p":25,"n":"ناقصك عزل الرذاذ عشان الالتهاب الرئوي."}}'::jsonb, 'الالتهاب الرئوي بالأدينوفيرس عزله رذاذ وتلامسي مع بعض.', 'ماسك جراحي وجاون وجوانتي.', 'الكحول، ولازم كمان تطهير كويس للسماعة والأسطح.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('a5', 'adv', '208', 'درن على العلاج', 'راجل، 50 سنة', array['درن رئوي، بقاله أسبوعين على العلاج','الكحة قلّت','آخر عينة بلغم: لسه AFB إيجابية']::text[], 'هتراجع معاه الأدوية', array['airborne','droplet','std','contact']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'airborne', array['n95']::text[], 'alcohol', '{}'::jsonb, 'العزل الهوائي مبيتشالش لمجرد إن المريض اتحسن. لازم تحسن إكلينيكي، و3 عينات بلغم سلبية، وفترة كافية على العلاج.', 'N95.', 'الكحول.' from c;

with c as (
  insert into public.cases(code, level, room, title, who, file, task, opts)
  values ('a6', 'adv', 'NICU-4', 'سعال ديكي', 'رضيع، شهرين', array['نوبات كحة شديدة بتخلص بشهقة','أحيانًا يرجّع بعد الكحة','PCR: Bordetella pertussis','بدأ Azithromycin امبارح']::text[], 'هتشفط إفرازات من مناخيره', array['droplet','airborne','contact','std']::text[])
  on conflict (code) do nothing returning id)
insert into public.case_answers(case_id, iso, ppe, hand, partial, why_iso, why_ppe, why_hand)
select id, 'droplet', array['mask','gloves']::text[], 'alcohol', '{"airborne":{"p":15,"n":"السعال الديكي بينتقل بالرذاذ، مش هوائي."}}'::jsonb, 'عزل رذاذ لحد ما يكمّل 5 أيام على العلاج الفعّال.', 'ماسك جراحي للرذاذ، وجوانتي عشان هتلمس إفرازات. ويفضل تزوّد واقي عين لو فيه احتمال رشاش.', 'الكحول بعد ما تقلع الجوانتي.' from c;

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

