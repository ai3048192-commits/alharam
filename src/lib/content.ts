import type { ItemId as MirrorItem, MsgId as MirrorMsg } from '../mirror/checks'

export const DOOR_SECONDS = 45

export type SignId = 'std' | 'contact' | 'droplet' | 'airborne' | 'contact_droplet' | 'airborne_contact' | 'enteric'
export const SIGNS: Record<SignId, { ar: string; en: string; bg: string[]; fg: string }> = {
  std: { ar: 'احتياطات قياسية', en: 'STANDARD', bg: ['#5B6B7A'], fg: '#fff' },
  contact: { ar: 'عزل تلامسي', en: 'CONTACT', bg: ['#E3A21A'], fg: '#2A1C00' },
  droplet: { ar: 'عزل رذاذ', en: 'DROPLET', bg: ['#2E9E5B'], fg: '#fff' },
  airborne: { ar: 'عزل هوائي', en: 'AIRBORNE', bg: ['#2F6FD1'], fg: '#fff' },
  contact_droplet: { ar: 'تلامسي + رذاذ', en: 'CONTACT + DROPLET', bg: ['#E3A21A', '#2E9E5B'], fg: '#fff' },
  airborne_contact: { ar: 'هوائي + تلامسي', en: 'AIRBORNE + CONTACT', bg: ['#2F6FD1', '#E3A21A'], fg: '#fff' },
  enteric: { ar: 'تلامسي مُعزّز', en: 'ENTERIC CONTACT', bg: ['#8A5A2B'], fg: '#fff' },
}
export const SIGN_IDS = Object.keys(SIGNS) as SignId[]
export const PPE: Record<string, string> = { gloves: 'جوانتي', gown: 'جاون', mask: 'ماسك جراحي', n95: 'ماسك N95', eye: 'واقي عين' }
export const PPE_ORDER = ['gloves', 'gown', 'mask', 'n95', 'eye']
export const HAND: Record<string, string> = { alcohol: 'كحول (هاند رَب)', soap: 'مية وصابون', none: 'مش لازم، كنت لابس جوانتي' }
export const PCOL = ['#FF9F1C', '#C9A7FF']

export const signBG = (id: string) => {
  const s = SIGNS[id as SignId]; if (!s) return '#999'
  return s.bg.length > 1 ? `linear-gradient(135deg, ${s.bg[0]} 0 50%, ${s.bg[1]} 50% 100%)` : s.bg[0]
}
export const signShadow = (id: string) => (SIGNS[id as SignId]?.bg.length ?? 1) > 1 ? '0 1px 2px rgba(0,0,0,.5)' : undefined
export const ar = (n: number | string) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d])
export const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0)
export const initial = (n?: string) => (String(n || '').trim()[0] || '؟')
export const ppeList = (l: string[]) => (l.length ? l.map(k => PPE[k]).join(' + ') : 'ولا حاجة')

const ERR: Record<string, string> = {
  not_signed_in: 'مش متصل. حدّث الصفحة وجرب تاني.',
  no_profile: 'اكتب اسمك وقسمك الأول.',
  set_not_found: 'اللينك ده مش موجود أو الكود غلط.',
  duel_full: 'المبارزة دي اتلعبت خلاص بين اتنين. اعمل مبارزة جديدة.',
  solo_set: 'ده تدريب خاص بحد تاني ومينفعش تدخله.',
  wrong_door: 'حصل لخبطة في ترتيب الأوض. حدّث الصفحة.',
  attempt_finished: 'انت خلّصت اللعبة دي خلاص.',
  attempt_not_found: 'اللعبة دي مش موجودة.',
  no_cases: 'مفيش أسئلة متاحة دلوقتي.',
  not_manager: 'الحساب ده مش متسجل كرئيس قسم.',
  not_allowed: 'مش مسموحلك تعدّل السؤال ده. تقدر تعدّل الأسئلة اللي انت كاتبها بس.',
  answer_not_in_options: 'الإجابة الصح لازم تكون من ضمن اللافتات اللي هتظهر للاعب.',
  missing_text: 'اكتب العنوان ووصف المريض والمطلوب.',
  missing_explanation: 'اكتب شرح للإجابات التلاتة.',
  missing_file: 'اكتب سطر واحد على الأقل في ملف المريض.',
  bad_level: 'اختار المستوى.',
  bad_name: 'اكتب اسمك (من ٢ لـ ٤٠ حرف).',
  bad_role: 'اختار تمريض أو طبيب.',
  'row-level security': 'مشكلة في تسجيل الدخول. اعمل ريفريش للصفحة وجرب تاني.',
  bad_hand: 'اختار طريقة نظافة الإيدين.',
  choose_department: 'اختار القسم الأول.',
  'Invalid login credentials': 'الإيميل أو الباسورد غلط.',
  'Anonymous sign-ins are disabled': 'لازم تفعّل Anonymous sign-ins في Supabase (Authentication → Sign In / Providers).',
  'Failed to fetch': 'مفيش اتصال بالإنترنت.',
  cam_insecure: 'الكاميرا محتاجة لينك آمن (https). افتح اللعبة من اللينك الأصلي.',
  cam_unsupported: 'المتصفح ده مش بيفتح الكاميرا (زي المتصفح اللي جوه فيسبوك أو إنستجرام). افتح اللينك في Chrome أو Safari أو Edge.',
  cam_denied: 'مفيش إذن للكاميرا. اسمح للكاميرا من علامة القفل جنب اللينك (على الآيفون: الإعدادات ← Safari ← الكاميرا) وجرب تاني.',
  cam_none: 'مش لاقيين كاميرا على الجهاز ده.',
  cam_busy: 'الكاميرا مشغولة في برنامج تاني. اقفله وجرب تاني.',
  models_failed: 'مقدرناش نحمّل ملفات الفحص. اتأكد من الإنترنت أول مرة وجرب تاني.',
  bad_state: 'نتيجة الفحص مش مظبوطة. جرب تاني.',
}

export const MIRROR_ITEMS: Record<MirrorItem, string> = { head: 'غطا الراس', mask: 'الماسك', gown: 'الجاون', gloves: 'الجوانتي' }
export const MIRROR_ITEMS_EN: Record<MirrorItem, string> = { head: 'Head cover', mask: 'Mask', gown: 'Gown', gloves: 'Gloves' }
/** Fixed note: what the camera cannot see (goggles are transparent, N95 seal and gown ties are invisible). */
export const MIRROR_LIMITS = 'الجهاز مش بيقدر يتأكد من النضارة ولا إحكام الـ N95 ولا ربط الجاون من ورا. اتأكد منهم بنفسك.'
export const MIRROR_MSG: Record<MirrorMsg, string> = {
  ok_head: 'غطا الراس مغطي الشعر.',
  head_none: 'غطا الراس مش لابسه',
  head_hair: 'الشعر باين من تحت غطا الراس',
  head_cut: 'ارجع لورا شوية عشان راسك تبان',
  head_unknown: 'مش قادر أتأكد من غطا الراس. لو لونه مختلف اطلب معايرة الألوان.',
  ok_mask: 'الماسك مغطي الأنف والبق والدقن.',
  ok_gown: 'الجاون لابسه ومغطي الدراعات.',
  ok_gloves: 'الجوانتي في الإيدين الاتنين.',
  mask_under_nose: 'الماسك نازل تحت الأنف.',
  mask_under_mouth: 'الماسك نازل على الدقن بس.',
  mask_chin: 'الماسك مش نازل على الدقن.',
  mask_none: 'مفيش ماسك',
  mask_unknown: 'مش قادر أتأكد من الماسك. لو لونه مختلف اطلب معايرة الألوان.',
  face_not_found: 'بص للكاميرا وقرّب شوية',
  hands_two: 'ارفع إيديك الاتنين قدام الكاميرا',
  hand_bare: 'إيد من غير جوانتي',
  gloves_none: 'مفيش جوانتي في الإيدين',
  gloves_unknown: 'مش قادر أتأكد من الجوانتي. خلي كفوفك ناحية الكاميرا.',
  body_not_visible: 'ارجع لورا شوية عشان جسمك كله يبان',
  gown_arms: 'الجاون مش مغطي الدراعات.',
  gown_one_arm: 'دراع واحد مش متغطي بالكم.',
  gown_none: 'مش شايف جاون. لو لابسه ولونه مختلف، اطلب معايرة الألوان.',
  gown_unknown: 'مش قادر أتأكد من الجاون. متحطش حاجة قدام صدرك.',
  dark: 'الإضاءة ضعيفة',
  bright: 'الإضاءة قوية قوي',
  waiting: 'بيفحص...',
  unsteady: 'ثبت مكانك شوية',
}
/** «اعمل كده»: how to fix each mistake (only for ✗ results). */
export const MIRROR_FIX: Partial<Record<MirrorMsg, string>> = {
  head_none: 'البس غطا راس يغطي الشعر كله لحد الودان.',
  head_hair: 'دخّل الشعر كله جوه غطا الراس من قدام ومن الجناب.',
  mask_under_nose: 'ارفع الماسك لحد ما يغطي الأنف، واضغط السلك اللي فوق على عضمة الأنف.',
  mask_under_mouth: 'ارفع الماسك يغطي البق والأنف، والسلك فوق على الأنف.',
  mask_chin: 'افرد الماسك لتحت لحد ما يغطي تحت الدقن.',
  mask_none: 'البس الماسك: السلك المعدن فوق على الأنف، وافرده لحد تحت الدقن.',
  gown_none: 'البس الجاون الأول: يغطي من الرقبة للركبة، والكمين لحد الرسغ.',
  gown_arms: 'دخّل دراعاتك في الكمين لحد الرسغ.',
  gown_one_arm: 'دخّل دراعك في الكم لحد الرسغ.',
  gloves_none: 'البس الجوانتي آخر حاجة، واسحبه فوق كم الجاون.',
  hand_bare: 'البس جوانتي في الإيد التانية، واسحبه فوق كم الجاون.',
}
/** Next step while putting PPE on, in donning order (head cover → mask → gown → gloves). */
export const MIRROR_NEXT: Record<MirrorItem, string> = {
  head: 'الخطوة الجاية: البس غطا الراس',
  mask: 'الخطوة الجاية: البس الماسك',
  gown: 'الخطوة الجاية: البس الجاون',
  gloves: 'الخطوة الجاية: البس الجوانتي (آخر حاجة)',
}
export const MIRROR_ORDER = 'الترتيب الصح: غطا الراس ← الماسك ← الجاون ← الجوانتي آخر حاجة عشان يتسحب فوق كم الجاون.'
/** Smart PPE Check station: where to get a missing item (the «PPE Corner» shelf next to the screen). */
export const KIOSK_SHELF: Record<MirrorItem, string> = {
  head: 'خد غطا راس من الرف اللي جنبك',
  mask: 'خد ماسك من الرف اللي جنبك',
  gown: 'خد جاون من الرف اللي جنبك',
  gloves: 'خد جوانتي مقاسك من الرف (S / M / L)',
}
/** True when the request failed because there is no (or too weak a) connection. */
export const isNetworkError = (e: unknown) =>
  (typeof navigator !== 'undefined' && navigator.onLine === false) || /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(e instanceof Error ? e.message : String(e))

export function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k]
  return 'حصلت مشكلة: ' + m
}
