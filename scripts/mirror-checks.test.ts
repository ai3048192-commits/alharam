/* Hand-made checks for src/mirror/checks.ts — run with:  npm run test:mirror   (Node ≥ 22.6 strips the types) */
import {
  CFG, analyzeFrame, checkGloves, checkGown, checkHead, checkMask, classify, colorDist, defaultCalibration, faceSkin, hexToRgb,
  coach, isSkinLike, overall, parseCalibration, prepCalibration, rgbToHex, rgbToHsv, rgbToLab, vote,
  type Pixels, type Pt, type Rgb, type Verdict,
} from '../src/mirror/checks.ts'

let failed = 0
const t = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) console.log('ok  ', name)
  else { failed++; console.error('FAIL', name, extra ?? '') }
}

/* ---------- tiny synthetic frames ---------- */
const W = 640, H = 480
function img(fill: Rgb): Pixels & { data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) data.set([...fill, 255], i * 4)
  return { data, width: W, height: H }
}
function paint(p: Pixels & { data: Uint8ClampedArray }, x: number, y: number, rpx: number, c: Rgb) {
  const cx = Math.round(x * W), cy = Math.round(y * H)
  for (let yy = cy - rpx; yy <= cy + rpx; yy++) for (let xx = cx - rpx; xx <= cx + rpx; xx++)
    if (xx >= 0 && yy >= 0 && xx < W && yy < H) p.data.set([...c, 255], (yy * W + xx) * 4)
}
const pt = (x: number, y: number, visibility = 0.95): Pt => ({ x, y, visibility })

const SKIN: Rgb = [214, 160, 128], SKIN_DARK: Rgb = [110, 72, 52]
const BG: Rgb = [120, 120, 130]
const MASK = hexToRgb('#6FA3D8'), GOWN = hexToRgb('#E6CF4A'), GLOVE = hexToRgb('#4B7FD0'), PURPLE = hexToRgb('#7D5CC2')
const GREEN_SCRUBS: Rgb = [60, 140, 120], WHITE: Rgb = [235, 235, 232]
const cal = prepCalibration(defaultCalibration())

/* ---------- colour utils ---------- */
t('hex round trip', rgbToHex(hexToRgb('#4B7FD0')) === '#4B7FD0')
t('Lab of white ≈ (100,0,0)', (() => { const l = rgbToLab([255, 255, 255]); return Math.abs(l[0] - 100) < 0.5 && Math.abs(l[1]) < 0.5 && Math.abs(l[2]) < 0.5 })())
t('HSV of pure blue', (() => { const h = rgbToHsv([0, 0, 255]); return h[0] === 240 && h[1] === 1 && h[2] === 1 })())
t('same hue in shadow stays close', colorDist(rgbToLab(MASK), rgbToLab([90, 133, 176])) < CFG.mask.match)
t('mask blue far from skin', colorDist(rgbToLab(MASK), rgbToLab(SKIN)) > 40)
t('skin tones are skin-like', [SKIN, SKIN_DARK, [240, 200, 170] as Rgb].every(isSkinLike))
t('PPE colours are not skin-like', [MASK, GOWN, GLOVE, PURPLE].every(c => !isSkinLike(c)))
t('classify: glove patch = item', classify(GLOVE, cal.gloves, CFG.gloves.match, rgbToLab(SKIN), true).cls === 'item')
t('classify: bare hand = skin', classify(SKIN, cal.gloves, CFG.gloves.match, rgbToLab(SKIN), true).cls === 'skin')

/* ---------- mask ---------- */
const FACE_PTS: Record<number, [number, number]> = {
  10: [0.5, 0.14], 152: [0.5, 0.44], 54: [0.43, 0.16], 284: [0.57, 0.16],
  234: [0.4, 0.3], 454: [0.6, 0.3], 151: [0.5, 0.17], 108: [0.46, 0.18], 337: [0.54, 0.18],
  1: [0.5, 0.3], 4: [0.5, 0.285], 0: [0.5, 0.345], 17: [0.5, 0.375], 61: [0.47, 0.355], 291: [0.53, 0.355], 199: [0.5, 0.41], 175: [0.5, 0.425],
}
const face = (dx = 0, scale = 1): Pt[] => Array.from({ length: 478 }, (_, i) => {
  const p = FACE_PTS[i] || [0.5, 0.3]
  return pt(0.5 + (p[0] - 0.5) * scale + dx, 0.3 + (p[1] - 0.3) * scale)
})
function faceImg(nose: Rgb, mouth: Rgb, chin: Rgb, skin = SKIN) {
  const p = img(BG)
  paint(p, 0.5, 0.28, 70, skin)                                    // the head
  for (const i of [1, 4]) paint(p, FACE_PTS[i][0], FACE_PTS[i][1], 9, nose)
  for (const i of [0, 17, 61, 291]) paint(p, FACE_PTS[i][0], FACE_PTS[i][1], 9, mouth)
  for (const i of [199, 175]) paint(p, FACE_PTS[i][0], FACE_PTS[i][1], 9, chin)
  return p
}
const mask = (p: Pixels, f = face()) => checkMask(p, f, cal, faceSkin(p, f), undefined)

t('mask on nose+mouth+chin → ok', mask(faceImg(MASK, MASK, MASK)).state === 'ok', mask(faceImg(MASK, MASK, MASK)))
t('mask on dark skin → ok', mask(faceImg(MASK, MASK, MASK, SKIN_DARK)).state === 'ok')
t('mask under nose → wrong', (v => v.state === 'wrong' && v.msg === 'mask_under_nose')(mask(faceImg(SKIN, MASK, MASK))))
t('mask on chin only → wrong', (v => v.state === 'wrong' && v.msg === 'mask_under_mouth')(mask(faceImg(SKIN, SKIN, MASK))))
t('mask not down over the chin → wrong', (v => v.state === 'wrong' && v.msg === 'mask_chin')(mask(faceImg(MASK, MASK, SKIN))))
t('no mask → missing', (v => v.state === 'missing' && v.msg === 'mask_none')(mask(faceImg(SKIN, SKIN, SKIN))))
t('uncalibrated white mask → uncertain (never ok)', (v => v.state === 'uncertain' && v.msg === 'mask_unknown')(mask(faceImg(WHITE, WHITE, WHITE))), mask(faceImg(WHITE, WHITE, WHITE)))
t('white mask after calibrating white → ok', (() => { const p = faceImg(WHITE, WHITE, WHITE), f = face(); return checkMask(p, f, prepCalibration({ ...defaultCalibration(), mask: ['#EBEBE8'] }), faceSkin(p, f)).state === 'ok' })())
t('grey/white never matches light-blue default', classify(WHITE, cal.mask, CFG.mask.match, rgbToLab(SKIN)).cls !== 'item')
t('no face → uncertain', checkMask(img(BG), null, cal, null).msg === 'face_not_found')
t('face too far → uncertain', mask(faceImg(MASK, MASK, MASK), face(0, 0.25)).msg === 'face_not_found')
t('face turned away → uncertain', (() => { const f = face(); f[1] = pt(0.56, 0.3); return mask(faceImg(MASK, MASK, MASK), f).msg === 'face_not_found' })())
t('blue cap on forehead (skin ref = mask colour) → not ok', (() => {
  const p = faceImg(MASK, MASK, MASK); for (const i of [151, 108, 337]) paint(p, FACE_PTS[i][0], FACE_PTS[i][1], 12, MASK)
  return mask(p).state !== 'ok'
})())

/* ---------- head cover ---------- */
const CAP = hexToRgb('#9CC3E6'), HAIR: Rgb = [45, 32, 25], GREEN_CAP: Rgb = [70, 160, 90]
/** top: the crown above the hairline · sides: around the temples */
function headImg(top: Rgb, sides: Rgb) {
  const p = faceImg(MASK, MASK, MASK)
  for (let y = 0.02; y <= 0.13; y += 0.02) for (let x = 0.36; x <= 0.64; x += 0.02) paint(p, x, y, 8, sides)
  for (let y = 0.02; y <= 0.13; y += 0.02) for (let x = 0.46; x <= 0.54; x += 0.02) paint(p, x, y, 8, top)
  return p
}
const head = (p: Pixels, f = face()) => checkHead(p, f, cal, faceSkin(p, f))
t('head cover on → ok', head(headImg(CAP, CAP)).state === 'ok', head(headImg(CAP, CAP)))
t('hair showing at the temples → wrong «الشعر باين»', (v => v.state === 'wrong' && v.msg === 'head_hair')(head(headImg(CAP, HAIR))), head(headImg(CAP, HAIR)))
t('no head cover (hair) → missing', (v => v.state === 'missing' && v.msg === 'head_none')(head(headImg(HAIR, HAIR))), head(headImg(HAIR, HAIR)))
t('uncalibrated green cover → uncertain, never ok or ✗', head(headImg(GREEN_CAP, GREEN_CAP)).state === 'uncertain')
t('head cut off by the top of the frame → «ارجع لورا»', head(headImg(CAP, CAP), face().map(p => ({ ...p, y: p.y - 0.1 }))).msg === 'head_cut')
t('no face → head uncertain', checkHead(img(BG), null, cal, null).msg === 'face_not_found')
t('green cover calibrated → ok', (() => { const p = headImg(GREEN_CAP, GREEN_CAP), f = face(); return checkHead(p, f, prepCalibration({ ...defaultCalibration(), head: ['#46A05A'] }), faceSkin(p, f)).state === 'ok' })())

/* ---------- gloves ---------- */
function hand(x: number): Pt[] {
  const h = Array.from({ length: 21 }, () => pt(x, 0.45))
  Object.entries({ 0: [x, 0.5], 5: [x - 0.02, 0.42], 6: [x - 0.02, 0.36], 9: [x, 0.4], 13: [x + 0.02, 0.41], 14: [x + 0.02, 0.36], 17: [x + 0.04, 0.43] })
    .forEach(([i, [a, b]]) => { h[+i] = pt(a, b) })
  return h
}
function handsImg(left: Rgb, right: Rgb) {
  const p = img(BG)
  for (const [x, c] of [[0.2, left], [0.8, right]] as [number, Rgb][]) for (let y = 0.33; y <= 0.52; y += 0.02) for (let dx = -0.04; dx <= 0.06; dx += 0.02) paint(p, x + dx, y, 8, c)
  return p
}
const skinLab = rgbToLab(SKIN)
const gl = (p: Pixels, hs = [hand(0.2), hand(0.8)]) => checkGloves(p, hs, cal, skinLab)
t('two blue gloves → ok', gl(handsImg(GLOVE, GLOVE)).state === 'ok', gl(handsImg(GLOVE, GLOVE)))
t('purple gloves → ok', gl(handsImg(PURPLE, PURPLE)).state === 'ok')
t('one bare hand → missing "إيد من غير جوانتي"', (v => v.state === 'missing' && v.msg === 'hand_bare')(gl(handsImg(GLOVE, SKIN))))
t('no gloves → missing', gl(handsImg(SKIN, SKIN)).msg === 'gloves_none')
t('one hand visible → uncertain', gl(handsImg(GLOVE, GLOVE), [hand(0.2)]).msg === 'hands_two')
t('white latex gloves (uncalibrated) → not ok', gl(handsImg(WHITE, WHITE)).state !== 'ok')

/* ---------- gown ---------- */
const POSE_PTS: Record<number, [number, number]> = { 11: [0.6, 0.3], 12: [0.4, 0.3], 13: [0.72, 0.5], 14: [0.28, 0.5], 23: [0.58, 0.85], 24: [0.42, 0.85] }
const pose = (vis = 0.95): Pt[] => Array.from({ length: 33 }, (_, i) => { const p = POSE_PTS[i] || [0.5, 0.5]; return pt(p[0], p[1], [11, 12, 13, 14].includes(i) ? vis : 0.95) })
function bodyImg(torso: Rgb, arms: Rgb) {
  const p = img(BG)
  for (let y = 0.3; y <= 0.86; y += 0.02) for (let x = 0.4; x <= 0.6; x += 0.02) paint(p, x, y, 8, torso)
  for (const [s, e] of [[11, 13], [12, 14]]) for (let k = 0; k <= 1; k += 0.05)
    paint(p, POSE_PTS[s][0] + (POSE_PTS[e][0] - POSE_PTS[s][0]) * k, POSE_PTS[s][1] + (POSE_PTS[e][1] - POSE_PTS[s][1]) * k, 10, arms)
  return p
}
const gw = (p: Pixels, ps = pose()) => checkGown(p, ps, cal, skinLab)
t('yellow gown with sleeves → ok', gw(bodyImg(GOWN, GOWN)).state === 'ok', gw(bodyImg(GOWN, GOWN)))
t('blue gown → ok', gw(bodyImg(hexToRgb('#5A8CD2'), hexToRgb('#5A8CD2'))).state === 'ok')
t('gown but bare arms → wrong', (v => v.state === 'wrong' && v.msg === 'gown_arms')(gw(bodyImg(GOWN, SKIN))))
t('one sleeve not covering the arm → wrong', (() => { const p = bodyImg(GOWN, GOWN); for (let k = 0; k <= 1; k += 0.05) paint(p, 0.4 + (0.28 - 0.4) * k, 0.3 + (0.5 - 0.3) * k, 10, SKIN); const v = gw(p); return v.state === 'wrong' && v.msg === 'gown_one_arm' })())
t('green scrubs → missing', gw(bodyImg(GREEN_SCRUBS, GREEN_SCRUBS)).msg === 'gown_none')
t('shoulders not visible → uncertain', gw(bodyImg(GOWN, GOWN), pose(0.2)).msg === 'body_not_visible')

/* ---------- whole frame + lighting ---------- */
t('dark frame → all uncertain "dark"', (r => r.head.msg === 'dark' && r.mask.msg === 'dark' && r.gown.msg === 'dark' && r.gloves.msg === 'dark')(analyzeFrame(img([20, 20, 25]), { face: face(), hands: [hand(0.2), hand(0.8)], pose: pose() }, cal)))
t('bright frame → "bright"', analyzeFrame(img([250, 250, 250]), {}, cal).mask.msg === 'bright')
t('empty frame → nothing seen, no body', (r => !r.seen && !r.body && r.mask.state === 'uncertain')(analyzeFrame(img(BG), { hands: [] }, cal)))
t('face + shoulders → body present (station auto-start)', analyzeFrame(bodyImg(GOWN, GOWN), { face: face(), pose: pose(), hands: [] }, cal).body && !analyzeFrame(bodyImg(GOWN, GOWN), { face: face(), pose: pose(0.2), hands: [] }, cal).body)
t('per-hand states for the station boxes', (r => r.hands.join() === 'gloved,bare')(analyzeFrame(handsImg(GLOVE, SKIN), { hands: [hand(0.2), hand(0.8)] }, cal)))

/* ---------- voting ---------- */
const OK: Verdict = { state: 'ok', msg: 'ok_mask' }, NOSE: Verdict = { state: 'wrong', msg: 'mask_under_nose' }, FACE_LOST: Verdict = { state: 'uncertain', msg: 'face_not_found' }
const rep = (v: Verdict, n: number) => Array(n).fill(v)
t('20/20 ok → ok', vote(rep(OK, 20)).state === 'ok')
t('16/20 ok (80%) → ok', vote([...rep(FACE_LOST, 4), ...rep(OK, 16)]).state === 'ok')
t('15/20 ok (75%) → not ok', vote([...rep(FACE_LOST, 5), ...rep(OK, 15)]).state !== 'ok')
t('12 wrong / 8 ok → wrong', vote([...rep(NOSE, 12), ...rep(OK, 8)]).msg === 'mask_under_nose')
t('short window of ok frames can never be ok', vote(rep(OK, 12)).state !== 'ok')
t('very short window → waiting', vote(rep(OK, 3)).msg === 'waiting')
t('only last 20 frames count', vote([...rep(NOSE, 30), ...rep(OK, 20)]).state === 'ok')
const HEAD_OK: Verdict = { state: 'ok', msg: 'ok_head' }, NO_HEAD: Verdict = { state: 'missing', msg: 'head_none' }
t('overall pass / fail / uncertain', overall({ head: HEAD_OK, mask: OK, gown: OK, gloves: OK }) === 'pass' && overall({ head: HEAD_OK, mask: NOSE, gown: OK, gloves: FACE_LOST }) === 'fail' && overall({ head: HEAD_OK, mask: OK, gown: FACE_LOST, gloves: OK }) === 'uncertain')
t('overall ignores items switched off on the station', overall({ head: NO_HEAD, mask: OK, gown: OK, gloves: OK }, ['mask', 'gown', 'gloves']) === 'pass' && overall({ head: NO_HEAD, mask: OK, gown: OK, gloves: OK }) === 'fail')

/* ---------- live coaching ---------- */
const GOWN_OK: Verdict = { state: 'ok', msg: 'ok_gown' }, GLOVES_OK: Verdict = { state: 'ok', msg: 'ok_gloves' }, NO_GOWN: Verdict = { state: 'missing', msg: 'gown_none' }
t('coach: donning order head cover → mask → gown → gloves', coach({ head: NO_HEAD, mask: NOSE, gown: GOWN_OK, gloves: FACE_LOST }).next === 'head' && coach({ head: HEAD_OK, mask: NOSE, gown: NO_GOWN, gloves: FACE_LOST }).next === 'mask' && coach({ head: HEAD_OK, mask: OK, gown: NO_GOWN, gloves: FACE_LOST }).next === 'gown')
t('coach: skips items switched off', coach({ head: NO_HEAD, mask: NOSE, gown: GOWN_OK, gloves: FACE_LOST }, ['mask', 'gown', 'gloves']).next === 'mask')
t('coach: all ok → nothing next', coach({ head: HEAD_OK, mask: OK, gown: GOWN_OK, gloves: GLOVES_OK }).next === null)
t('coach: gloves on before gown → order warning', coach({ head: HEAD_OK, mask: OK, gown: NO_GOWN, gloves: GLOVES_OK }).order && !coach({ head: HEAD_OK, mask: OK, gown: GOWN_OK, gloves: GLOVES_OK }).order)

/* ---------- calibration storage ---------- */
t('garbage calibration → defaults', JSON.stringify(parseCalibration('{oops')) === JSON.stringify(defaultCalibration()))
t('old calibration without head cover → head gets defaults', (c => c.head.length === 2 && c.mask.join() === '#111111')(parseCalibration(JSON.stringify({ mask: ['#111111'] }))))
t('keeps valid colours, max 3, drops bad', (c => c.mask.join() === '#111111,#222222,#333333' && c.gown.length === 2 && c.pin === '1234')(parseCalibration(JSON.stringify({ mask: ['#111111', 'red', '#222222', '#333333', '#444444'], gown: [], pin: '1234' }))))

console.log(failed ? `\n${failed} failed` : '\nall passed')
if (failed) throw new Error(failed + ' checks failed')
