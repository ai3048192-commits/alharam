/* Smart PPE mirror — pure functions only (no DOM, no React), so they can be unit-tested in Node.
   Everything runs on the device: we read pixels from a frame, compare small patches against calibrated
   PPE colours, and vote over the last ~20 frames. A wrong "ok" is worse than "uncertain", so every
   doubtful case falls back to 'uncertain'. */

/* ===================================================================================
   TUNING — every threshold lives here. Distances are in a Lab space where lightness
   counts half (see colorDist), so ~10 = "same colour, slightly different light",
   ~25 = "same family", 40+ = "clearly different".
   =================================================================================== */
export const CFG = {
  fps: 12,                 // max analysed frames per second (keeps tablets cool)
  analysisSize: 640,       // the longer side of the frame we analyse, in px
  vote: {
    window: 20,            // frames remembered per item (~1.5–2 s at 10–15 fps)
    okFrac: 0.8,           // "ok" only if ≥ 80% of the window is ok
    stateFrac: 0.5,        // a ✗ verdict needs ≥ 50% of the window agreeing, else ⚠️
  },
  light: {
    dark: 50,              // mean luma (0–255) below this → "الإضاءة ضعيفة"
    bright: 205,           // mean luma above this → "الإضاءة قوية قوي"
    step: 8,               // sample every Nth pixel when measuring luma
  },
  color: {
    lightWeight: 0.5,      // weight of the L (lightness) difference in colorDist
    skinSep: 18,           // a PPE patch must be at least this far from the person's own skin sample
    skinMatch: 14,         // a patch this close to the skin sample counts as bare skin
    colorful: 10,          // a calibrated colour with Lab chroma ≥ this is "coloured" (white/grey ones are not)…
    minChromaFrac: 0.5,    // …and then a patch needs ≥ half its chroma to match (so white/grey never passes as light blue)
  },
  skin: {                  // generic skin-tone box in YCbCr (Chai & Ngan), used when no skin sample fits
    cb: [77, 127] as [number, number],
    cr: [133, 173] as [number, number],
    minY: 40,
  },
  mask: {
    match: 24,             // max distance to a calibrated mask colour
    minFace: 0.07,         // face width / longer frame side; smaller → "قرّب"
    maxYaw: 0.22,          // |nose offset| / face width; larger → turned away
    patch: 0.055,          // patch radius as a fraction of face width
    regionFrac: 0.5,       // a region (nose/mouth/chin) is covered/bare if ≥ this share of its patches agree
  },
  gloves: {
    match: 26,
    minHand: 0.04,         // wrist→middle-knuckle length / longer frame side
    patch: 0.13,           // patch radius as a fraction of that length
    need: 2,               // of 3 patches per hand (palm + 2 fingers)
  },
  gown: {
    match: 28,
    minVis: 0.5,           // pose landmark visibility needed for shoulders/elbows
    patch: 0.05,           // patch radius as a fraction of shoulder width
    minTorso: 5,           // of 9 torso points that must be inside the frame
    torsoOk: 0.6,          // share of torso patches that must match the gown
    torsoNone: 0.2,        // at or below this share → no gown
    armsOk: 0.75,          // share of upper-arm patches that must match the gown
    armsBare: 0.25,        // at or below this share → arms not covered
  },
  margin: 0.01,            // landmarks closer than this to the frame edge count as outside
  minPatchPx: 2,
  maxPatchPx: 10,
}

/* default colours: work before calibration (blue / light-blue masks, yellow + blue gowns, blue + purple nitrile gloves) */
export const DEFAULT_COLORS: Record<ItemId, string[]> = {
  mask: ['#6FA3D8', '#A8CBEA'],
  gown: ['#E6CF4A', '#5A8CD2'],
  gloves: ['#4B7FD0', '#7D5CC2'],
}
export const MAX_COLORS = 3

/* ---------------- types ---------------- */
export type ItemId = 'mask' | 'gown' | 'gloves'
export const ITEMS: ItemId[] = ['mask', 'gown', 'gloves']
export type State = 'ok' | 'missing' | 'wrong' | 'uncertain'
export type MsgId =
  | 'ok_mask' | 'ok_gown' | 'ok_gloves'
  | 'mask_under_nose' | 'mask_under_mouth' | 'mask_none' | 'mask_unknown' | 'face_not_found'
  | 'hands_two' | 'hand_bare' | 'gloves_none' | 'gloves_unknown'
  | 'body_not_visible' | 'gown_arms' | 'gown_none' | 'gown_unknown'
  | 'dark' | 'bright' | 'waiting' | 'unsteady'
export type Verdict = { state: State; msg: MsgId }
export type Rgb = [number, number, number]
export type Lab = [number, number, number]
/** A MediaPipe NormalizedLandmark (x, y in 0..1 of the analysed frame). */
export type Pt = { x: number; y: number; visibility?: number }
/** Anything shaped like ImageData (RGBA bytes). */
export type Pixels = { data: ArrayLike<number>; width: number; height: number }
export type Calibration = { mask: string[]; gown: string[]; gloves: string[]; pin?: string }
export type Landmarks = { face?: Pt[] | null; hands?: Pt[][]; pose?: Pt[] | null }
export type FrameResult = Record<ItemId, Verdict> & { luma: number; seen: boolean }
export type PatchClass = 'item' | 'skin' | 'other' | 'ref'
/** What the debug overlay draws: sampled patches (px in the analysed frame) and their distances. */
export type Dbg = { patches: { x: number; y: number; r: number; cls: PatchClass; d: number; rgb: Rgb }[]; points: Pt[] }

/* ---------------- colour utils ---------------- */
export function hexToRgb(h: string): Rgb {
  const s = h.replace('#', '')
  const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgbToHex = (c: Rgb) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()

/** sRGB (0–255) → HSV (h 0–360, s/v 0–1). */
export function rgbToHsv([r, g, b]: Rgb): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx]
}

/** sRGB (0–255) → CIE Lab (D65). */
export function rgbToLab([r, g, b]: Rgb): Lab {
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const R = lin(r), G = lin(g), B = lin(b)
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(X), fy = f(Y), fz = f(Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** Lab distance with lightness down-weighted, so shade/shadow matters less than hue. */
export function colorDist(a: Lab, b: Lab): number {
  const w = CFG.color.lightWeight
  return Math.hypot(w * (a[0] - b[0]), a[1] - b[1], a[2] - b[2])
}
export const chroma = (c: Lab) => Math.hypot(c[1], c[2])
/** Distance to the nearest PPE colour; a washed-out patch can't match a clearly coloured reference. */
export const minDist = (c: Lab, refs: Lab[]) => refs.reduce((m, r) => {
  const cr = chroma(r)
  if (cr >= CFG.color.colorful && chroma(c) < CFG.color.minChromaFrac * cr) return m
  return Math.min(m, colorDist(c, r))
}, Infinity)

/** Generic skin-tone test in YCbCr — catches bare hands even when no face sample is available. */
export function isSkinLike([r, g, b]: Rgb): boolean {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  const { cb: [cb0, cb1], cr: [cr0, cr1], minY } = CFG.skin
  return y >= minY && cb >= cb0 && cb <= cb1 && cr >= cr0 && cr <= cr1
}

/* ---------------- pixels ---------------- */
const median = (a: number[]) => { a.sort((x, y) => x - y); return a[a.length >> 1] }

/** Median colour of the square (cx±r, cy±r) in px. Null if the square is not fully inside the frame. */
export function samplePatch(px: Pixels, cx: number, cy: number, r: number): Rgb | null {
  const x0 = Math.round(cx - r), x1 = Math.round(cx + r), y0 = Math.round(cy - r), y1 = Math.round(cy + r)
  if (x0 < 0 || y0 < 0 || x1 >= px.width || y1 >= px.height) return null
  const R: number[] = [], G: number[] = [], B: number[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * px.width + x) * 4
    R.push(px.data[i]); G.push(px.data[i + 1]); B.push(px.data[i + 2])
  }
  return [median(R), median(G), median(B)]
}

/** Median colour of a box given in 0..1 frame coordinates (calibration). */
export function sampleBox(px: Pixels, box: { x0: number; y0: number; x1: number; y1: number }, step = 2): Rgb {
  const R: number[] = [], G: number[] = [], B: number[] = []
  const xa = Math.max(0, Math.floor(box.x0 * px.width)), xb = Math.min(px.width - 1, Math.ceil(box.x1 * px.width))
  const ya = Math.max(0, Math.floor(box.y0 * px.height)), yb = Math.min(px.height - 1, Math.ceil(box.y1 * px.height))
  for (let y = ya; y <= yb; y += step) for (let x = xa; x <= xb; x += step) {
    const i = (y * px.width + x) * 4
    R.push(px.data[i]); G.push(px.data[i + 1]); B.push(px.data[i + 2])
  }
  return R.length ? [median(R), median(G), median(B)] : [0, 0, 0]
}

/** Per-channel median of several colours (combines calibration frames). */
export const medianColor = (cs: Rgb[]): Rgb => [0, 1, 2].map(k => median(cs.map(c => c[k]))) as Rgb

/** Mean luma (0–255) of the frame, sampling every CFG.light.step-th pixel. */
export function meanLuma(px: Pixels, step = CFG.light.step): number {
  let s = 0, n = 0
  for (let i = 0; i < px.width * px.height; i += step) {
    const k = i * 4
    s += 0.299 * px.data[k] + 0.587 * px.data[k + 1] + 0.114 * px.data[k + 2]; n++
  }
  return n ? s / n : 0
}

/* ---------------- patch classification ---------------- */
export type PrepCal = Record<ItemId, Lab[]>
export function prepCalibration(c: Calibration): PrepCal {
  const pick = (k: ItemId) => (c[k]?.length ? c[k] : DEFAULT_COLORS[k]).map(h => rgbToLab(hexToRgb(h)))
  return { mask: pick('mask'), gown: pick('gown'), gloves: pick('gloves') }
}

/**
 * 'item'  → close to one of the PPE colours AND clearly different from the person's skin
 * 'skin'  → looks like the person's skin (or generic skin when it isn't a PPE colour)
 * 'other' → neither (unknown colour, shadow, background…)
 */
export function classify(c: Rgb, targets: Lab[], match: number, skinRef: Lab | null, notSkinLike = false): { cls: PatchClass; d: number } {
  const lab = rgbToLab(c)
  const d = minDist(lab, targets)
  const dS = skinRef ? colorDist(lab, skinRef) : Infinity
  const sk = isSkinLike(c)
  if (d <= match && dS >= CFG.color.skinSep && !(notSkinLike && sk)) return { cls: 'item', d }
  if (dS <= CFG.color.skinMatch || (sk && d > match)) return { cls: 'skin', d }
  return { cls: 'other', d }
}

type Sampler = (p: Pt, r: number, targets: Lab[], match: number, notSkinLike?: boolean) => PatchClass | null

function makeSampler(px: Pixels, skinRef: Lab | null, dbg?: Dbg): Sampler {
  return (p, r, targets, match, notSkinLike) => {
    const cx = p.x * px.width, cy = p.y * px.height
    const rr = Math.max(CFG.minPatchPx, Math.min(CFG.maxPatchPx, r))
    const c = samplePatch(px, cx, cy, rr)
    if (!c) return null
    const { cls, d } = classify(c, targets, match, skinRef, notSkinLike)
    dbg?.patches.push({ x: cx, y: cy, r: rr, cls, d, rgb: c })
    return cls
  }
}

const inFrame = (p: Pt) => p.x >= CFG.margin && p.x <= 1 - CFG.margin && p.y >= CFG.margin && p.y <= 1 - CFG.margin
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const avg = (ps: Pt[]): Pt => ({ x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length })
/** Distance between two normalised points, in px of the analysed frame. */
const distPx = (px: Pixels, a: Pt, b: Pt) => Math.hypot((a.x - b.x) * px.width, (a.y - b.y) * px.height)
const share = (cs: (PatchClass | null)[], k: PatchClass) => { const v = cs.filter(Boolean); return v.length ? v.filter(c => c === k).length / v.length : 0 }

/* ---------------- MASK (FaceLandmarker, 478 points) ---------------- */
export const FACE = {
  forehead: [151, 108, 337],   // skin reference
  nose: [1, 4],                // nose tip + just above it
  mouth: [0, 17, 61, 291],     // upper lip, below lower lip, both corners
  chin: [199, 175],
  left: 234, right: 454,       // cheek edges → face width
}

/** Skin colour sampled from the forehead (median of three patches), or null if the face isn't usable. */
export function faceSkin(px: Pixels, face: Pt[] | null | undefined, dbg?: Dbg): Lab | null {
  if (!face || face.length < 455) return null
  const w = distPx(px, face[FACE.left], face[FACE.right])
  const cs = FACE.forehead.map(i => {
    const p = face[i], r = Math.max(CFG.minPatchPx, Math.min(CFG.maxPatchPx, w * CFG.mask.patch))
    const c = samplePatch(px, p.x * px.width, p.y * px.height, r)
    if (c) dbg?.patches.push({ x: p.x * px.width, y: p.y * px.height, r, cls: 'ref', d: 0, rgb: c })
    return c
  }).filter((c): c is Rgb => !!c)
  return cs.length >= 2 ? rgbToLab(medianColor(cs)) : null
}

export function checkMask(px: Pixels, face: Pt[] | null | undefined, cal: PrepCal, skinRef: Lab | null, dbg?: Dbg): Verdict {
  const no: Verdict = { state: 'uncertain', msg: 'face_not_found' }
  if (!face || face.length < 455) return no
  const L = face[FACE.left], R = face[FACE.right], nose = face[FACE.nose[0]]
  const w = distPx(px, L, R)
  if (w / Math.max(px.width, px.height) < CFG.mask.minFace) return no                       // too far
  if (Math.abs(nose.x - (L.x + R.x) / 2) * px.width / w > CFG.mask.maxYaw) return no         // turned away
  if (!skinRef) return no
  dbg?.points.push(...[...FACE.nose, ...FACE.mouth, ...FACE.chin, ...FACE.forehead].map(i => face[i]))
  const sample = makeSampler(px, skinRef, dbg)
  const region = (ids: number[]) => {
    const cs = ids.map(i => sample(face[i], w * CFG.mask.patch, cal.mask, CFG.mask.match))
    if (!cs.some(Boolean)) return null
    return share(cs, 'item') >= CFG.mask.regionFrac ? 'covered' : share(cs, 'skin') >= CFG.mask.regionFrac ? 'bare' : 'unknown'
  }
  const n = region(FACE.nose), m = region(FACE.mouth), c = region(FACE.chin)
  if (!n || !m || !c) return no
  if (n === 'covered' && m === 'covered' && c === 'covered') return { state: 'ok', msg: 'ok_mask' }
  if (m === 'covered' && n === 'bare') return { state: 'wrong', msg: 'mask_under_nose' }
  if (c === 'covered' && m === 'bare' && n === 'bare') return { state: 'wrong', msg: 'mask_under_mouth' }
  if (n === 'bare' && m === 'bare' && c !== 'covered') return { state: 'missing', msg: 'mask_none' }
  return { state: 'uncertain', msg: 'mask_unknown' }
}

/* ---------------- GLOVES (HandLandmarker, 21 points per hand) ---------------- */
export const HAND = { palm: [0, 5, 9, 13, 17], index: [5, 6], ring: [13, 14], wrist: 0, middle: 9 }

export function checkGloves(px: Pixels, hands: Pt[][] | undefined, cal: PrepCal, skinRef: Lab | null, dbg?: Dbg): Verdict {
  const two: Verdict = { state: 'uncertain', msg: 'hands_two' }
  const hs = (hands || []).filter(h => h.length >= 21)
  if (hs.length < 2) return two
  const sample = makeSampler(px, skinRef, dbg)
  const each = hs.slice(0, 2).map(h => {
    const size = distPx(px, h[HAND.wrist], h[HAND.middle])
    if (size / Math.max(px.width, px.height) < CFG.gloves.minHand) return null                // hand too small / far
    const pts = [avg(HAND.palm.map(i => h[i])), lerp(h[HAND.index[0]], h[HAND.index[1]], 0.5), lerp(h[HAND.ring[0]], h[HAND.ring[1]], 0.5)]
    if (!pts.every(inFrame)) return null
    dbg?.points.push(...h)
    const cs = pts.map(p => sample(p, size * CFG.gloves.patch, cal.gloves, CFG.gloves.match, true))
    const k = (cls: PatchClass) => cs.filter(c => c === cls).length
    return k('item') >= CFG.gloves.need ? 'gloved' : k('skin') >= CFG.gloves.need ? 'bare' : 'unknown'
  })
  if (each.some(e => e === null)) return two
  const g = each.filter(e => e === 'gloved').length, b = each.filter(e => e === 'bare').length
  if (g === 2) return { state: 'ok', msg: 'ok_gloves' }
  if (b === 2) return { state: 'missing', msg: 'gloves_none' }
  if (g === 1 && b === 1) return { state: 'missing', msg: 'hand_bare' }
  return { state: 'uncertain', msg: 'gloves_unknown' }
}

/* ---------------- GOWN (PoseLandmarker, 33 points) ---------------- */
export const POSE = { ls: 11, rs: 12, le: 13, re: 14, lh: 23, rh: 24 }

export function checkGown(px: Pixels, pose: Pt[] | null | undefined, cal: PrepCal, skinRef: Lab | null, dbg?: Dbg): Verdict {
  const back: Verdict = { state: 'uncertain', msg: 'body_not_visible' }
  if (!pose || pose.length < 25) return back
  const P = (i: number) => pose[i]
  const vis = (i: number) => (P(i).visibility ?? 1) >= CFG.gown.minVis && inFrame(P(i))
  if (![POSE.ls, POSE.rs, POSE.le, POSE.re].every(vis)) return back
  const sw = distPx(px, P(POSE.ls), P(POSE.rs))
  // 3×3 grid between shoulders and hips; hips may be below the frame, so keep only the points inside it
  const torso: Pt[] = []
  for (const v of [0.2, 0.45, 0.7]) for (const u of [0.3, 0.5, 0.7])
    torso.push(lerp(lerp(P(POSE.ls), P(POSE.rs), u), lerp(P(POSE.lh), P(POSE.rh), u), v))
  const tIn = torso.filter(inFrame)
  if (tIn.length < CFG.gown.minTorso) return back
  const arms = [0.35, 0.65].flatMap(t => [lerp(P(POSE.ls), P(POSE.le), t), lerp(P(POSE.rs), P(POSE.re), t)])
  dbg?.points.push(...[POSE.ls, POSE.rs, POSE.le, POSE.re, POSE.lh, POSE.rh].map(P))
  const sample = makeSampler(px, skinRef, dbg)
  const r = sw * CFG.gown.patch
  const t = share(tIn.map(p => sample(p, r, cal.gown, CFG.gown.match)), 'item')
  const a = share(arms.map(p => sample(p, r, cal.gown, CFG.gown.match)), 'item')
  if (t <= CFG.gown.torsoNone) return { state: 'missing', msg: 'gown_none' }
  if (t < CFG.gown.torsoOk) return { state: 'uncertain', msg: 'gown_unknown' }
  if (a >= CFG.gown.armsOk) return { state: 'ok', msg: 'ok_gown' }
  if (a <= CFG.gown.armsBare) return { state: 'wrong', msg: 'gown_arms' }
  return { state: 'uncertain', msg: 'gown_unknown' }
}

/* ---------------- one frame ---------------- */
export function analyzeFrame(px: Pixels, lm: Landmarks, cal: PrepCal, dbg?: Dbg): FrameResult {
  const luma = meanLuma(px)
  const seen = !!(lm.face?.length || lm.pose?.length)
  const light: MsgId | null = luma < CFG.light.dark ? 'dark' : luma > CFG.light.bright ? 'bright' : null
  if (light) {
    const v: Verdict = { state: 'uncertain', msg: light }
    return { mask: v, gown: v, gloves: v, luma, seen }
  }
  const skin = faceSkin(px, lm.face, dbg)
  return {
    mask: checkMask(px, lm.face, cal, skin, dbg),
    gloves: checkGloves(px, lm.hands, cal, skin, dbg),
    gown: checkGown(px, lm.pose, cal, skin, dbg),
    luma, seen,
  }
}

/* ---------------- voting over the last frames ---------------- */
/**
 * ok        → ≥ okFrac of a FULL window is ok (a short window can never be ok)
 * ✗ / ⚠️    → the most common non-ok verdict if it covers ≥ stateFrac of the window
 * otherwise → uncertain "ثبت مكانك"
 */
export function vote(frames: Verdict[], n = CFG.vote.window): Verdict {
  const recent = frames.slice(-n)
  const ok = recent.filter(v => v.state === 'ok')
  if (ok.length >= Math.ceil(CFG.vote.okFrac * n)) return ok[ok.length - 1]
  if (recent.length < Math.ceil(CFG.vote.stateFrac * n)) return { state: 'uncertain', msg: 'waiting' }
  const tally = new Map<string, { v: Verdict; k: number }>()
  for (const v of recent) if (v.state !== 'ok') {
    const key = v.state + ':' + v.msg
    const t = tally.get(key) || { v, k: 0 }
    t.k++; tally.set(key, t)
  }
  const top = [...tally.values()].sort((a, b) => b.k - a.k)[0]
  if (top && top.k >= Math.ceil(CFG.vote.stateFrac * n)) return top.v
  return { state: 'uncertain', msg: 'unsteady' }
}

export const voteAll = (frames: FrameResult[]): Record<ItemId, Verdict> =>
  ({ mask: vote(frames.map(f => f.mask)), gown: vote(frames.map(f => f.gown)), gloves: vote(frames.map(f => f.gloves)) })

export function overall(r: Record<ItemId, Verdict>): 'pass' | 'fail' | 'uncertain' {
  const s = ITEMS.map(k => r[k].state)
  if (s.every(x => x === 'ok')) return 'pass'
  if (s.some(x => x === 'missing' || x === 'wrong')) return 'fail'
  return 'uncertain'
}

/* ---------------- calibration storage (localStorage "mirror.calibration") ---------------- */
export const CAL_KEY = 'mirror.calibration'
export const defaultCalibration = (): Calibration => ({ mask: [...DEFAULT_COLORS.mask], gown: [...DEFAULT_COLORS.gown], gloves: [...DEFAULT_COLORS.gloves] })

export function parseCalibration(raw: string | null): Calibration {
  try {
    const j = JSON.parse(raw || 'null')
    const ok = (a: unknown) => Array.isArray(a) ? a.filter(h => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h)).slice(0, MAX_COLORS) : []
    if (!j || typeof j !== 'object') return defaultCalibration()
    const d = defaultCalibration()
    return {
      mask: ok(j.mask).length ? ok(j.mask) : d.mask,
      gown: ok(j.gown).length ? ok(j.gown) : d.gown,
      gloves: ok(j.gloves).length ? ok(j.gloves) : d.gloves,
      pin: typeof j.pin === 'string' && j.pin ? j.pin : undefined,
    }
  } catch { return defaultCalibration() }
}
