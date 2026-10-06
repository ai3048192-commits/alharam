/* "طلّع الغلطات" scenes. Each scene = a correct picture + the same picture with 8 infection-control errors.
   Coordinates are in a 360 × 240 viewBox; every diff has a hit circle (cx, cy, r). */
import { DIFFS as ROOM_DIFFS, spotSVG as roomSpotSVG } from './art'

export type Diff = { id: string; cx: number; cy: number; r: number; t: string; w: string }
export type SpotScene = { id: string; name: string; diffs: Diff[]; svg: (bad: boolean, act?: string[]) => string; shown?: string[] }

/* ---------- shared drawing helpers ---------- */
function bg(key: string) {
  return `<defs><pattern id="${key}t" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#F3ECFF"/><path d="M20 0V20H0" fill="none" stroke="#E4D7F7" stroke-width="1.2"/></pattern>
  <linearGradient id="${key}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B79AE6"/><stop offset="1" stop-color="#9C7BD8"/></linearGradient></defs>
  <rect width="360" height="240" fill="url(#${key}t)"/>
  <rect y="150" width="360" height="50" fill="#E2D4F6"/><rect y="148" width="360" height="4" fill="#CDB6EE"/>
  <rect y="200" width="360" height="40" fill="url(#${key}f)"/><path d="M0 200h360" stroke="#8462C7" stroke-width="2.5"/>`
}
const label = (x: number, y: number, w: number, txt: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="15" rx="5" fill="#24154A"/><text x="${x + w / 2}" y="${y + 11}" font-size="9" fill="#fff" text-anchor="middle" font-family="Lalezar,system-ui">${txt}</text>`

/** a standing staff member centred on cx (head at y=84, feet at y=200) */
function staff(cx: number, o: { gloves?: boolean; watch?: boolean; item?: string } = {}) {
  const hand = o.gloves ? '#8C8CFF' : '#F2C094'
  return `<ellipse cx="${cx + 1}" cy="201" rx="16" ry="3" fill="rgba(0,0,0,.15)"/>
  <rect x="${cx - 9}" y="148" width="8" height="51" rx="3" fill="#3A2560"/><rect x="${cx + 2}" y="148" width="8" height="51" rx="3" fill="#3A2560"/>
  <rect x="${cx - 15}" y="100" width="31" height="54" rx="10" fill="#3FB8C9"/><path d="M${cx - 6} 101l6 8 6-8" fill="#2E9AAA"/>
  <path d="M${cx - 13} 106L${cx + 3} 136M${cx + 14} 106L${cx + 13} 136" stroke="#3FB8C9" stroke-width="8" stroke-linecap="round"/>
  ${o.item || ''}
  ${o.watch ? `<rect x="${cx + 9}" y="${126}" width="9" height="5" rx="1.5" fill="#24154A"/><circle cx="${cx + 13.5}" cy="128.5" r="2" fill="#FFE27A"/>` : ''}
  <circle cx="${cx + 3}" cy="137" r="4.2" fill="${hand}"/><circle cx="${cx + 13}" cy="137" r="4.2" fill="${hand}"/>
  <rect x="${cx - 4}" y="93" width="9" height="9" fill="#E8AE7E"/>
  <circle cx="${cx}" cy="84" r="12" fill="#F2C094"/><path d="M${cx - 12} 83q0-15 12-15t12 15q-5-6-12-6t-12 6z" fill="#3FB8C9"/>
  <circle cx="${cx - 4}" cy="82.5" r="1.5" fill="#24154A"/><circle cx="${cx + 4}" cy="82.5" r="1.5" fill="#24154A"/>
  <path d="M${cx - 3} 89q3 2.5 6 0" stroke="#24154A" stroke-width="1.3" fill="none" stroke-linecap="round"/>`
}

/* =====================================================================
   2) ICU bay
   ===================================================================== */
const ICU_DIFFS: Diff[] = [
  { id: 'icu_hob', cx: 120, cy: 124, r: 22, t: 'رأس السرير مفرود', w: 'مريض جهاز التنفس لازم رأس سريره يبقى مرفوع ٣٠ لـ ٤٥ درجة. ده جزء أساسي من الوقاية من الالتهاب الرئوي المرتبط بجهاز التنفس (VAP).' },
  { id: 'icu_line', cx: 167, cy: 131, r: 14, t: 'غيار القسطرة متسخ ومش لازق', w: 'الغيار الشفاف على القسطرة لازم يبقى نضيف ولازق كويس وعليه تاريخ. لو اتسخ أو فك بيتغيّر على طول، عشان ده مدخل مباشر للدم.' },
  { id: 'icu_needle', cx: 232, cy: 133, r: 15, t: 'سرنجة بإبرة على سرير المريض', w: 'الإبرة بتترمي في صندوق الإبر في نفس اللحظة اللي بتخلص فيها. لو اتسابت على السرير ممكن تعوّر المريض أو اللي بيغيّر الملايات.' },
  { id: 'icu_tube', cx: 252, cy: 210, r: 17, t: 'خرطوم المحلول نازل على الأرض', w: 'خراطيم المحاليل متلمسش الأرض. الأرض من أكتر الأماكن تلوثًا، والخرطوم ده رايح على وريد المريض على طول.' },
  { id: 'icu_suction', cx: 304, cy: 213, r: 17, t: 'طرف الشفط مرمي على الأرض', w: 'طرف الشفط بيرجع مكانه أو في غلافه بعد الاستخدام. لو وقع على الأرض بيتغير، ميرجعش بُق المريض.' },
  { id: 'icu_cup', cx: 332, cy: 141, r: 14, t: 'كوباية شاي جنب المريض', w: 'ممنوع الأكل والشرب في أماكن رعاية المرضى. الأكل والشرب بيتلوثوا، وكمان بيلوثوا اللي حواليهم.' },
  { id: 'icu_gown', cx: 207, cy: 82, r: 18, t: 'جاون متعلّق عشان يتلبس تاني', w: 'جاون العزل بيتلبس مرة واحدة ويتقلع قبل الخروج من عند المريض. لو اتعلّق واتلبس تاني، الجزء الملوث بيلمس هدومك.' },
  { id: 'icu_bin', cx: 74, cy: 182, r: 16, t: 'سلة الزبالة مليانة ومفتوحة', w: 'السلة بتتقفل وتتفضى لما توصل لتلات أرباعها. لو فاضت ومفتوحة، الميكروبات بتنتشر في المكان.' },
]
function icuSVG(B: boolean, act?: string[]) {
  const on = (id: string) => B && (!act || act.includes(id))
  const k = 'icu' + (B ? 'b' : 'a')
  const tilt = !on('icu_hob')
  return `<svg viewBox="0 0 360 240" aria-hidden="true">${bg(k)}
  ${label(150, 8, 60, 'رعاية ٣')}
  <!-- monitor -->
  <rect x="66" y="34" width="48" height="32" rx="4" fill="#24154A"/><path d="M71 52h8l3-8 4 14 3-6h20" stroke="#22C38E" stroke-width="1.6" fill="none"/><text x="105" y="44" font-size="6" fill="#FFE27A" font-family="system-ui">98</text>
  <!-- wall clock -->
  <circle cx="158" cy="50" r="10" fill="#fff" stroke="#CDB8E8" stroke-width="2"/><path d="M158 50v-6M158 50l4 3" stroke="#24154A" stroke-width="1.4"/>
  <!-- gown hook -->
  <path d="M203 56h8" stroke="#8A94A6" stroke-width="2.5" stroke-linecap="round"/><path d="M207 56v5" stroke="#8A94A6" stroke-width="2"/>
  ${on('icu_gown') ? `<path d="M196 64l11-4 11 4 4 12-4-1v30h-22v-30l-4 1z" fill="#FFD95E" stroke="#C9620A" stroke-width="1.2"/><path d="M207 61v39" stroke="#C9620A" stroke-width="1"/>` : ''}
  <!-- ventilator -->
  <rect x="14" y="96" width="44" height="100" rx="5" fill="#F4F6FB" stroke="#CDB8E8" stroke-width="1.5"/><rect x="19" y="102" width="34" height="22" rx="2" fill="#24154A"/><path d="M22 116q4-8 8 0t8 0 8 0" stroke="#7CC6FF" stroke-width="1.4" fill="none"/>
  <circle cx="26" cy="134" r="3" fill="#CDB8E8"/><circle cx="36" cy="134" r="3" fill="#CDB8E8"/><circle cx="46" cy="134" r="3" fill="#CDB8E8"/>
  <path d="M58 118q22 -2 ${tilt ? '48 -8' : '50 12'}" stroke="#7CC6FF" stroke-width="3" fill="none"/>
  <!-- bin -->
  <path d="M64 184h20l-2 16H66z" fill="#2B2D42"/>
  ${on('icu_bin') ? `<rect x="62" y="166" width="22" height="4" rx="1.5" fill="#111" transform="rotate(-28 64 170)"/><path d="M65 184q2-9 6-6 2-7 7-3 5-2 6 5z" fill="#E9ECF2" stroke="#C9D2E3"/><circle cx="70" cy="194" r="0" /><path d="M86 196q4 1 6 4" stroke="#C9D2E3" stroke-width="3" stroke-linecap="round"/>` : `<rect x="63" y="180" width="22" height="5" rx="2" fill="#111"/>`}
  <!-- bed -->
  <rect x="100" y="158" width="4" height="38" fill="#8A94A6"/><rect x="290" y="158" width="4" height="38" fill="#8A94A6"/><circle cx="102" cy="198" r="3.5" fill="#24154A"/><circle cx="292" cy="198" r="3.5" fill="#24154A"/>
  <rect x="92" y="152" width="208" height="8" rx="2" fill="#CDB8E8"/>
  <rect x="88" y="120" width="8" height="40" rx="3" fill="#A890D8"/>
  ${tilt
    ? `<path d="M98 112l52 26v14H98z" fill="#fff" stroke="#E8DDF5"/><rect x="150" y="138" width="146" height="14" rx="4" fill="#fff" stroke="#E8DDF5"/>
       <rect x="101" y="104" width="24" height="11" rx="5" fill="#fff" stroke="#E8DDF5" transform="rotate(26 113 110)"/><circle cx="116" cy="108" r="9" fill="#E8B48A"/><path d="M108 104q8-9 17 1" fill="#5B3A29"/>`
    : `<rect x="98" y="138" width="198" height="14" rx="4" fill="#fff" stroke="#E8DDF5"/>
       <rect x="100" y="129" width="24" height="11" rx="5" fill="#fff" stroke="#E8DDF5"/><circle cx="114" cy="129" r="9" fill="#E8B48A"/><path d="M106 125q8-9 17 1" fill="#5B3A29"/>`}
  <rect x="140" y="126" width="152" height="20" rx="6" fill="#B79AE6"/><path d="M150 133h136" stroke="#9C7BD8" stroke-width="2"/>
  <!-- arm + central line dressing -->
  <rect x="152" y="127" width="26" height="8" rx="4" fill="#E8B48A"/>
  ${on('icu_line') ? `<rect x="160" y="125" width="14" height="10" rx="1.5" fill="#F1E6C8" stroke="#C9A36A" stroke-width=".8" transform="rotate(-14 167 130)"/><circle cx="164" cy="131" r="2" fill="#B9853F"/><circle cx="169" cy="128" r="1.4" fill="#B9853F"/>`
       : `<rect x="160" y="126" width="14" height="9" rx="1.5" fill="#EAF6FF" fill-opacity=".9" stroke="#7CC6FF" stroke-width=".9"/><path d="M162 129h6" stroke="#2F6FD1" stroke-width=".8"/>`}
  ${on('icu_needle') ? `<g transform="rotate(-24 232 133)"><rect x="220" y="130" width="20" height="6" rx="1.5" fill="#fff" stroke="#8A94A6" stroke-width=".8"/><rect x="216" y="131.5" width="5" height="3" fill="#8A94A6"/><path d="M240 133h9" stroke="#8A94A6" stroke-width="1"/></g>` : ''}
  <!-- IV pole + tubing -->
  <path d="M272 30v170" stroke="#A890D8" stroke-width="2.2"/><path d="M262 200h20" stroke="#A890D8" stroke-width="2.2"/>
  <rect x="264" y="38" width="16" height="24" rx="3" fill="#CFF0FF" stroke="#A890D8"/><rect x="267" y="44" width="10" height="6" rx="1" fill="#fff"/>
  ${on('icu_tube') ? `<path d="M272 62q-4 60 -14 146q-4 10 -18 6q-40 -8 -64 -82" stroke="#C7B0EE" stroke-width="1.6" fill="none"/>`
       : `<path d="M272 62q-30 40 -96 70" stroke="#C7B0EE" stroke-width="1.6" fill="none"/>`}
  <!-- suction canister on wall -->
  <rect x="296" y="62" width="18" height="26" rx="3" fill="#E6F4FF" stroke="#A890D8"/><rect x="298" y="74" width="14" height="12" rx="2" fill="#F9D7DB"/><rect x="299" y="56" width="12" height="6" rx="2" fill="#A890D8"/>
  <path d="M305 88q4 30 -2 ${on('icu_suction') ? '118' : '20'}" stroke="#C7B0EE" stroke-width="1.6" fill="none"/>
  ${on('icu_suction') ? `<path d="M296 214l18-6" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M296 214l18-6" stroke="#CDB8E8" stroke-width="1"/>`
       : `<path d="M316 66v24" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M316 66v24" stroke="#CDB8E8" stroke-width="1"/>`}
  <!-- bedside table -->
  <rect x="318" y="150" width="30" height="50" rx="3" fill="#F4F6FB" stroke="#CDB8E8" stroke-width="1.5"/><path d="M320 170h26" stroke="#CDB8E8" stroke-width="1.5"/>
  ${on('icu_cup') ? `<path d="M326 138h12l-1.5 12h-9z" fill="#fff" stroke="#CDB8E8"/><rect x="327" y="140" width="10" height="4" fill="#C98B4A"/><path d="M338 141q4 0 3 4l-3 1" stroke="#CDB8E8" fill="none"/><path d="M330 134q2-3 0-6M334 134q2-3 0-6" stroke="#CDB8E8" stroke-width="1" fill="none"/>` : ''}
 </svg>`
}

/* =====================================================================
   3) Treatment / dressing room
   ===================================================================== */
const DRESS_DIFFS: Diff[] = [
  { id: 'dr_towel', cx: 72, cy: 90, r: 18, t: 'فوطة قماش جنب الحوض', w: 'نشف إيدك بمناديل ورق تُستعمل مرة واحدة. الفوطة القماش بتفضل مبلولة وكل الناس بتلمسها، فبترجّع الميكروبات على إيدك بعد ما غسلتها.' },
  { id: 'dr_gloves', cx: 31, cy: 122, r: 14, t: 'علبة الجوانتي على حرف الحوض', w: 'علبة الجوانتي مكانها في الحامل على الحيطة بعيد عن الحوض. رشاش الحوض بيلوث الجوانتي اللي جوه العلبة.' },
  { id: 'dr_watch', cx: 142, cy: 128, r: 12, t: 'لابس ساعة في إيده', w: 'في أماكن الرعاية الإيدين لازم تبقى عريانة لحد الكوع، من غير ساعة ولا خواتم. الساعة بتمنع غسيل الرسغ كويس، وبيتجمع تحتها ميكروبات.' },
  { id: 'dr_pack', cx: 193, cy: 110, r: 15, t: 'الغيار المعقم مفتوح ومتساب', w: 'الغيار المعقم بيتفتح قبل الاستخدام على طول. لو اتفتح بدري واتساب مكشوف، ميبقاش معقم.' },
  { id: 'dr_phone', cx: 229, cy: 113, r: 12, t: 'موبايل على ترولي الغيار', w: 'الحاجات الشخصية زي الموبايل متتحطش على الترولي النضيف. الموبايل من أكتر الحاجات اللي عليها ميكروبات.' },
  { id: 'dr_dirty', cx: 205, cy: 162, r: 14, t: 'غيار متسخ على الترولي النضيف', w: 'المتسخ والنضيف ميتحطوش مع بعض أبدًا. الغيار المستعمل بيترمي على طول في كيس النفايات الخطرة.' },
  { id: 'dr_vial', cx: 286, cy: 123, r: 15, t: 'إبرة متسابة في الفيال', w: 'متسيبش إبرة مغروزة في فيال متعدد الجرعات. كده الدوا بيتلوث، وأي حد هيسحب منه بعد كده هيدّي المريض دوا ملوث.' },
  { id: 'dr_box', cx: 322, cy: 214, r: 18, t: 'كرتونة مستلزمات على الأرض', w: 'المستلزمات النضيفة بتتخزن على الرفوف، بعيد عن الأرض بحوالي ٢٠ سم، عشان متتلوثش من المسح والرشاش.' },
]
function dressSVG(B: boolean, act?: string[]) {
  const on = (id: string) => B && (!act || act.includes(id))
  const k = 'dr' + (B ? 'b' : 'a')
  return `<svg viewBox="0 0 360 240" aria-hidden="true">${bg(k)}
  ${label(150, 8, 70, 'غرفة الغيار')}
  <!-- shelf -->
  <rect x="270" y="58" width="78" height="4" rx="1" fill="#A890D8"/><rect x="276" y="40" width="18" height="18" rx="2" fill="#FFE6CF" stroke="#D9780A" stroke-width=".8"/><rect x="298" y="44" width="22" height="14" rx="2" fill="#E6F4FF" stroke="#7CC6FF" stroke-width=".8"/><rect x="324" y="42" width="18" height="16" rx="2" fill="#F4F6FB" stroke="#CDB8E8" stroke-width=".8"/>
  <!-- glove holder -->
  <rect x="22" y="66" width="32" height="22" rx="2" fill="#E4D7F7" stroke="#A890D8"/>
  ${on('dr_gloves') ? '' : `<rect x="24" y="68" width="28" height="18" rx="2" fill="#8C8CFF" stroke="#4E4EC9" stroke-width=".8"/><path d="M33 70c0-3 10-3 10 0" fill="#fff"/>`}
  <!-- towel dispenser / cloth towel -->
  ${on('dr_towel') ? `<path d="M64 76h18" stroke="#8A94A6" stroke-width="2.5" stroke-linecap="round"/><path d="M64 77h18l-1 34q-8 3-16 0z" fill="#F7E7C6" stroke="#D9B98A"/><path d="M66 90h14M66 98h14" stroke="#E2C89A" stroke-width="1.2"/><circle cx="72" cy="104" r="2" fill="#D9B98A"/>`
       : `<rect x="60" y="70" width="26" height="30" rx="4" fill="#fff" stroke="#CDB8E8" stroke-width="1.5"/><path d="M64 100h18v8H64z" fill="#F4F6FB" stroke="#CDB8E8"/><rect x="66" y="78" width="14" height="4" rx="1" fill="#CDB8E8"/>`}
  <!-- sink -->
  <rect x="16" y="140" width="68" height="60" rx="3" fill="#F4F6FB" stroke="#CDB8E8" stroke-width="1.5"/><path d="M18 160h64" stroke="#CDB8E8"/>
  <path d="M18 128h64l-6 14H24z" fill="#fff" stroke="#CDB8E8" stroke-width="1.5"/><path d="M50 128v-14h8" stroke="#8A94A6" stroke-width="3" fill="none" stroke-linecap="round"/>
  <rect x="62" y="116" width="8" height="12" rx="2" fill="#7CC6FF"/>
  ${on('dr_gloves') ? `<rect x="22" y="116" width="19" height="11" rx="1.5" fill="#8C8CFF" stroke="#4E4EC9" stroke-width=".8"/><path d="M27 118c0-2 9-2 9 0" fill="#fff"/><circle cx="44" cy="121" r="1.2" fill="#7CC6FF"/><circle cx="20" cy="124" r="1" fill="#7CC6FF"/>` : ''}
  <!-- staff -->
  ${staff(130, { watch: on('dr_watch') })}
  <!-- trolley -->
  <rect x="170" y="118" width="80" height="4" rx="1" fill="#A890D8"/><rect x="170" y="170" width="80" height="4" rx="1" fill="#A890D8"/>
  <path d="M173 122v74M247 122v74" stroke="#A890D8" stroke-width="3"/><circle cx="174" cy="199" r="3.5" fill="#24154A"/><circle cx="246" cy="199" r="3.5" fill="#24154A"/>
  ${on('dr_pack') ? `<path d="M178 117l14-9 16 1 10 8z" fill="#9ED8FF" stroke="#3E8FCC" stroke-width=".8"/><rect x="186" y="108" width="14" height="7" rx="1" fill="#fff"/><path d="M188 110h10M189 113h8" stroke="#DCE5F6" stroke-width="1"/><path d="M202 112l8-2" stroke="#8A94A6" stroke-width="1.4"/>`
       : `<rect x="182" y="105" width="24" height="13" rx="2" fill="#9ED8FF" stroke="#3E8FCC" stroke-width=".8"/><path d="M182 105l12 6 12-6" stroke="#3E8FCC" stroke-width=".8" fill="none"/><rect x="189" y="113" width="10" height="3" fill="#22C38E"/>`}
  ${on('dr_phone') ? `<rect x="224" y="106" width="10" height="13" rx="2" fill="#24154A"/><rect x="225.5" y="108" width="7" height="9" rx="1" fill="#7CC6FF"/>` : ''}
  <rect x="180" y="160" width="14" height="10" rx="1.5" fill="#E6F4FF" stroke="#7CC6FF" stroke-width=".8"/><rect x="226" y="160" width="16" height="10" rx="1.5" fill="#FFE6CF" stroke="#D9780A" stroke-width=".8"/>
  ${on('dr_dirty') ? `<path d="M198 170q2-9 8-8 5-3 9 2 3 3 1 6z" fill="#fff" stroke="#DCE5F6"/><circle cx="204" cy="165" r="1.8" fill="#D62828"/><circle cx="209" cy="166" r="1.4" fill="#D62828"/><circle cx="206.5" cy="168" r="1" fill="#D62828"/>` : ''}
  <!-- counter -->
  <rect x="266" y="140" width="82" height="60" rx="3" fill="#F4F6FB" stroke="#CDB8E8" stroke-width="1.5"/><rect x="264" y="136" width="86" height="6" rx="2" fill="#CDB8E8"/><path d="M307 144v54" stroke="#CDB8E8"/>
  <rect x="280" y="124" width="12" height="13" rx="2" fill="#E6F4FF" stroke="#7CC6FF"/><rect x="282" y="120" width="8" height="5" rx="1" fill="#E63946"/><rect x="281" y="128" width="10" height="5" fill="#fff"/>
  ${on('dr_vial') ? `<rect x="284.5" y="100" width="3" height="16" rx="1" fill="#fff" stroke="#8A94A6" stroke-width=".7"/><path d="M286 116v5" stroke="#8A94A6" stroke-width=".9"/><rect x="283.5" y="97" width="5" height="4" fill="#FF9F1C"/>` : ''}
  <rect x="318" y="122" width="20" height="15" rx="2" fill="#FFD23F" stroke="#C9620A" stroke-width="1"/><rect x="317" y="119" width="22" height="4" rx="1" fill="#E63946"/>
  ${on('dr_box') ? `<rect x="306" y="203" width="34" height="22" rx="1.5" fill="#E2B880" stroke="#B88A4E"/><path d="M306 209h34M323 203v6" stroke="#B88A4E" stroke-width="1"/><rect x="312" y="213" width="20" height="7" rx="1" fill="#fff"/>` : ''}
 </svg>`
}

/* =====================================================================
   4) Nursing station / medication prep
   ===================================================================== */
const ST_DIFFS: Diff[] = [
  { id: 'st_fridge', cx: 42, cy: 151, r: 16, t: 'أكل في تلاجة الأدوية', w: 'تلاجة الأدوية للأدوية بس. الأكل بيلوث الأدوية، وكمان فتح التلاجة كتير بيبوّظ درجة حرارتها.' },
  { id: 'st_rub', cx: 98, cy: 95, r: 15, t: 'حامل الكحول فاضي', w: 'لازم يبقى فيه كحول لتطهير الإيدين في كل مكان بتتحضر فيه الأدوية. لو الحامل فاضي، محدش هينضف إيده قبل ما يحضّر الدوا.' },
  { id: 'st_iv', cx: 140, cy: 54, r: 14, t: 'محلول متعلق من غير تاريخ', w: 'أي محلول بيتعلّق لازم يتكتب عليه اسم المريض والتاريخ والساعة، عشان يتغيّر في معاده ومتستعملش شنطة قديمة.' },
  { id: 'st_syr', cx: 172, cy: 131, r: 15, t: 'سرنجات متحضرة من غير اسم', w: 'السرنجة بتتحضر قبل الإعطاء على طول، وبيتكتب عليها اسم الدوا والمريض. لو اتحضرت بدري واتسابت، ممكن تتلوث أو تروح لمريض غلط.' },
  { id: 'st_gloves', cx: 220, cy: 133, r: 14, t: 'جوانتي مستعمل على الترابيزة', w: 'الجوانتي المستعمل بيترمي في السلة على طول. لو اتساب على مكان تحضير الأدوية، بيلوثه.' },
  { id: 'st_sharps', cx: 293, cy: 123, r: 14, t: 'صندوق الإبر مفتوح', w: 'صندوق الإبر بيتقفل قفلة مؤقتة بين كل استعمال والتاني، عشان محدش يتعوّر، وعشان الإبر متقعش منه لو اتخبط.' },
  { id: 'st_linen', cx: 170, cy: 172, r: 20, t: 'عربية الملايات النضيفة مكشوفة', w: 'الملايات النضيفة بتتغطى وهي في العربية أو المخزن، عشان الغبار والرشاش ميوصلهاش قبل ما توصل للمريض.' },
  { id: 'st_mop', cx: 327, cy: 210, r: 18, t: 'جردل مسح بمية متسخة متساب', w: 'مية المسح بتتغيّر بعد كل أوضة، والجردل ميتسابش في مكان الرعاية. المية المتسخة بتنشر الميكروبات بدل ما تشيلها.' },
]
function stationSVG(B: boolean, act?: string[]) {
  const on = (id: string) => B && (!act || act.includes(id))
  const k = 'st' + (B ? 'b' : 'a')
  return `<svg viewBox="0 0 360 240" aria-hidden="true">${bg(k)}
  ${label(170, 8, 76, 'محطة التمريض')}
  <!-- med fridge -->
  <rect x="14" y="72" width="58" height="128" rx="4" fill="#F4F6FB" stroke="#A890D8" stroke-width="1.5"/><rect x="19" y="78" width="48" height="96" rx="2" fill="#E6F4FF" stroke="#CDB8E8"/>
  <path d="M19 108h48M19 138h48" stroke="#CDB8E8" stroke-width="1.5"/><rect x="62" y="110" width="3" height="18" rx="1" fill="#A890D8"/>
  <rect x="22" y="94" width="8" height="13" rx="1" fill="#fff" stroke="#7CC6FF"/><rect x="33" y="96" width="8" height="11" rx="1" fill="#fff" stroke="#E63946"/><rect x="44" y="94" width="8" height="13" rx="1" fill="#fff" stroke="#7CC6FF"/>
  <rect x="22" y="124" width="14" height="13" rx="1" fill="#FFE6CF" stroke="#D9780A" stroke-width=".8"/><rect x="40" y="126" width="8" height="11" rx="1" fill="#fff" stroke="#22C38E"/>
  ${on('st_fridge') ? `<path d="M30 156q12-12 24 0z" fill="#E8B477" stroke="#B9853F"/><path d="M31 155h22" stroke="#7CC66A" stroke-width="2"/><rect x="54" y="144" width="9" height="13" rx="1" fill="#FF9F1C"/><path d="M60 144l2-4" stroke="#fff" stroke-width="1"/>` : `<rect x="24" y="146" width="10" height="10" rx="1" fill="#fff" stroke="#7CC6FF"/>`}
  <text x="43" y="188" font-size="7" fill="#6A5C90" text-anchor="middle" font-family="system-ui">4°C</text>
  <!-- hand rub bracket -->
  <rect x="88" y="80" width="20" height="30" rx="3" fill="#E4D7F7" stroke="#A890D8"/>
  ${on('st_rub') ? `<rect x="91" y="84" width="14" height="22" rx="2" fill="#F4F0FB" stroke="#CDB8E8" stroke-dasharray="2 2"/>` : `<rect x="91" y="84" width="14" height="22" rx="3" fill="#9ED8FF" stroke="#3E8FCC"/><rect x="95" y="79" width="6" height="6" fill="#fff" stroke="#3E8FCC"/><path d="M95 96h6M98 93v6" stroke="#fff" stroke-width="1.6"/>`}
  <!-- IV pole behind counter -->
  <path d="M140 30v110" stroke="#A890D8" stroke-width="2.2"/><path d="M132 32h16" stroke="#A890D8" stroke-width="2"/>
  <rect x="131" y="38" width="18" height="30" rx="4" fill="#CFF0FF" stroke="#A890D8"/>
  ${on('st_iv') ? `<rect x="134" y="46" width="12" height="9" rx="1" fill="#fff"/>` : `<rect x="134" y="46" width="12" height="9" rx="1" fill="#fff"/><path d="M136 49h8M136 52h6" stroke="#2F6FD1" stroke-width="1"/>`}
  <path d="M140 68v20" stroke="#C7B0EE" stroke-width="1.4"/>
  <!-- counter -->
  <rect x="120" y="140" width="190" height="60" rx="3" fill="#F4F6FB" stroke="#CDB8E8" stroke-width="1.5"/><rect x="116" y="136" width="198" height="6" rx="2" fill="#CDB8E8"/>
  <!-- computer -->
  <rect x="238" y="98" width="40" height="28" rx="3" fill="#24154A"/><rect x="241" y="101" width="34" height="20" rx="1" fill="#7CC6FF"/><rect x="254" y="126" width="8" height="10" fill="#A890D8"/><rect x="246" y="134" width="24" height="3" rx="1" fill="#A890D8"/>
  <!-- syringes / tray -->
  ${on('st_syr') ? `<g><rect x="156" y="127" width="22" height="5" rx="1.5" fill="#fff" stroke="#8A94A6" stroke-width=".7"/><rect x="160" y="131" width="22" height="5" rx="1.5" fill="#fff" stroke="#8A94A6" stroke-width=".7" transform="rotate(8 171 133)"/><rect x="168" y="128" width="22" height="5" rx="1.5" fill="#fff" stroke="#8A94A6" stroke-width=".7" transform="rotate(-6 179 130)"/><path d="M178 129h5M182 133h5M190 130h4" stroke="#8A94A6" stroke-width=".8"/></g>`
       : `<rect x="158" y="129" width="30" height="7" rx="2" fill="#E4D7F7" stroke="#A890D8" stroke-width=".8"/>`}
  ${on('st_gloves') ? `<path d="M212 136q-2-8 5-7 4-4 8 1 4 2 1 6z" fill="#8C8CFF" stroke="#4E4EC9" stroke-width=".8"/><path d="M216 131l-3-3M221 130l-1-4" stroke="#4E4EC9" stroke-width="1.6" stroke-linecap="round"/>` : ''}
  <!-- sharps container -->
  <rect x="284" y="120" width="20" height="16" rx="2" fill="#FFD23F" stroke="#C9620A" stroke-width="1"/>
  ${on('st_sharps') ? `<rect x="283" y="108" width="22" height="4" rx="1" fill="#E63946" transform="rotate(-50 284 118)"/><path d="M289 120l-1-6M294 120v-7M299 120l1-5" stroke="#8A94A6" stroke-width="1.2"/>` : `<rect x="283" y="116" width="22" height="5" rx="1" fill="#E63946"/>`}
  <!-- linen cart (foreground) -->
  <rect x="140" y="168" width="62" height="30" rx="3" fill="#A890D8"/><circle cx="146" cy="202" r="3.5" fill="#24154A"/><circle cx="196" cy="202" r="3.5" fill="#24154A"/>
  ${on('st_linen') ? `<rect x="144" y="160" width="54" height="9" rx="2" fill="#fff" stroke="#DCE5F6"/><rect x="146" y="152" width="50" height="9" rx="2" fill="#E6F4FF" stroke="#DCE5F6"/><rect x="148" y="146" width="46" height="7" rx="2" fill="#fff" stroke="#DCE5F6"/>`
       : `<path d="M138 168q2-20 32-20t32 20z" fill="#3E8FCC"/><path d="M146 160q24-8 48 0" stroke="#5FA5DA" stroke-width="1.5" fill="none"/>`}
  <!-- mop bucket -->
  ${on('st_mop') ? `<path d="M312 200h30l-3 22h-24z" fill="#FFD23F" stroke="#C9620A"/><ellipse cx="327" cy="201" rx="15" ry="3" fill="#8D8D7A"/><path d="M334 200l10-46" stroke="#B88A4E" stroke-width="2.5"/><path d="M328 200q6-6 12 0" stroke="#E9ECF2" stroke-width="3" fill="none"/>` : ''}
 </svg>`
}

export const SCENES: SpotScene[] = [
  { id: 'room1', name: 'أوضة مريض', diffs: ROOM_DIFFS as Diff[], svg: roomSpotSVG },
  { id: 'icu', name: 'الرعاية المركزة', diffs: ICU_DIFFS, svg: icuSVG },
  { id: 'dress', name: 'غرفة الغيار', diffs: DRESS_DIFFS, svg: dressSVG },
  { id: 'station', name: 'محطة التمريض', diffs: ST_DIFFS, svg: stationSVG },
]

/* =====================================================================
   A new picture every game: random room, random subset of its errors,
   sometimes mirrored, and different wall / floor / scrubs / door colours.
   Both pictures of a round get the same variation, so only the errors differ.
   ===================================================================== */
const BASE = ['#F3ECFF', '#E4D7F7', '#E2D4F6', '#CDB6EE', '#B79AE6', '#9C7BD8', '#8462C7']
const ROOMS = [
  BASE,
  ['#EAF7F2', '#D3EEE3', '#CFEBDF', '#B3DCCB', '#9FCDB8', '#7FB79F', '#5F9C82'], // mint
  ['#FFF3EA', '#FBE2D0', '#F9DCC6', '#F0C6A8', '#E2B48F', '#CF9A72', '#B88058'], // peach
  ['#EEF5FF', '#D9E8FA', '#D5E5FB', '#BBD3F3', '#A9C4EC', '#8EAEE0', '#7393CF'], // sky
  ['#F6F4EE', '#E7E2D6', '#E6E0D2', '#D3CAB6', '#C2B8A2', '#A99E86', '#8F846C'], // stone
]
const SCRUBS = [['#3FB8C9', '#2E9AAA'], ['#5BBF7A', '#469F62'], ['#6C8EF5', '#4F6FD6'], ['#E77FB3', '#C95E93'], ['#8E7CF0', '#6F5BD6']]
const DOORS = [['#8C5AD8', '#6A3DB8'], ['#2FB5A6', '#1E8C80'], ['#5B8DEF', '#3F6FD0'], ['#E0884A', '#C46A2E']]

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
function swap(svg: string, from: string[], to: string[]) {
  from.forEach((c, i) => { if (c !== to[i]) svg = svg.replace(new RegExp(c, 'gi'), '@@' + i + '@@') })
  from.forEach((c, i) => { if (c !== to[i]) svg = svg.split('@@' + i + '@@').join(to[i]) })
  return svg
}
/** flip the drawing left↔right but keep every text readable */
function mirror(svg: string) {
  svg = svg.replace(/<text x="([\d.]+)"/g, (_m, x) => `<text transform="translate(${2 * +x} 0) scale(-1 1)" x="${x}"`)
  return svg.replace(/(<svg[^>]*>)/, '$1<g transform="translate(360 0) scale(-1 1)">').replace(/<\/svg>\s*$/, '</g></svg>')
}

export type SpotRound = SpotScene & { shown: string[]; key: string }

function makeRound(): SpotRound {
  const scene = pick(SCENES)
  const n = 5 + Math.floor(Math.random() * 3)                       // 5, 6 or 7 errors
  const chosen = [...scene.diffs].sort(() => Math.random() - 0.5).slice(0, n).sort((a, b) => a.cx - b.cx)
  const ids = chosen.map(d => d.id)
  const flip = Math.random() < 0.5
  const room = pick(ROOMS), scrub = pick(SCRUBS), door = pick(DOORS)
  const diffs = chosen.map(d => (flip ? { ...d, cx: 360 - d.cx } : d)).sort((a, b) => a.cx - b.cx)
  const svg = (bad: boolean) => {
    let out = scene.svg(bad, ids)
    out = swap(out, [...BASE, '#3FB8C9', '#2E9AAA', '#8C5AD8', '#6A3DB8'], [...room, ...scrub, ...door])
    return flip ? mirror(out) : out
  }
  return { ...scene, diffs, svg, shown: ids, key: [scene.id, flip ? 'm' : '', ...ids.slice().sort()].join('|') }
}

/** A new round, never the same picture as the last one on this device (and usually a different room). */
export function nextScene(): SpotRound {
  let last = ''
  try { last = localStorage.getItem('spot.lastKey') || '' } catch { /* private mode */ }
  const lastScene = last.split('|')[0]
  let r = makeRound()
  for (let i = 0; i < 20 && (r.key === last || (r.id === lastScene && Math.random() < 0.7)); i++) r = makeRound()
  try { localStorage.setItem('spot.lastKey', r.key) } catch { /* ignore */ }
  return r
}
