/* Camera + on-device landmark detection for the smart PPE mirror.
   No frame ever leaves the device: frames are drawn to an in-memory canvas, analysed, and dropped. */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { FaceLandmarker, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision'
import { CFG, CAL_KEY, analyzeFrame, parseCalibration, prepCalibration, voteAll, type Dbg, type FrameResult, type ItemId, type PatchClass, type Pt, type Verdict } from './checks'

export type CamError = 'cam_insecure' | 'cam_unsupported' | 'cam_denied' | 'cam_none' | 'cam_busy' | 'models_failed'

export const loadCalibration = () => { try { return parseCalibration(localStorage.getItem(CAL_KEY)) } catch { return parseCalibration(null) } }

/* ---------------- camera: phones, tablets, laptops, USB webcams ---------------- */
const CAM_KEY = 'mirror.camera'   // the camera picked with «غيّر الكاميرا» on this device
const store = { get: () => { try { return localStorage.getItem(CAM_KEY) } catch { return null } }, set: (id: string | null) => { try { id ? localStorage.setItem(CAM_KEY, id) : localStorage.removeItem(CAM_KEY) } catch { /* blocked */ } } }
const errName = (e: unknown) => (e as { name?: string })?.name || ''

function camError(e: unknown): CamError {
  const n = errName(e)
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'cam_denied'
  if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return 'cam_none'
  return 'cam_busy'   // NotReadableError, AbortError, TrackStartError…
}

/** Ask for the best stream this device allows, relaxing the request step by step (old webcams/phones reject exact sizes or facingMode). */
async function openStream(deviceId: string | null): Promise<MediaStream> {
  const size = { width: { ideal: 1280 }, height: { ideal: 720 } }
  const tries: MediaStreamConstraints[] = [
    ...(deviceId ? [{ video: { deviceId: { exact: deviceId }, ...size } }] : []),
    { video: { facingMode: 'user', ...size } },   // phones/tablets: front camera; laptops ignore it
    { video: size },
    { video: true },                               // anything at all
  ]
  let last: unknown
  for (const c of tries) {
    try { return await navigator.mediaDevices.getUserMedia({ audio: false, ...c }) } catch (e) {
      last = e
      if (camError(e) === 'cam_denied') throw e   // no point retrying when permission is refused
      if (deviceId && c === tries[0]) store.set(null)   // the saved camera is gone (unplugged webcam…)
    }
  }
  throw last
}

/** Camera into `video` while `on`; the stream is stopped and released when `on` turns false or on unmount. */
export function useCamera(video: RefObject<HTMLVideoElement>, on: boolean) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<CamError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [cams, setCams] = useState<string[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [mirrored, setMirrored] = useState(true)

  useEffect(() => {
    if (!on) return
    let alive = true, stream: MediaStream | null = null
    setReady(false); setError(null)
    ;(async () => {
      if (!window.isSecureContext) { setError('cam_insecure'); return }
      if (!navigator.mediaDevices?.getUserMedia) { setError('cam_unsupported'); return }   // in-app browsers (Facebook, Instagram…)
      try {
        stream = await openStream(store.get())
        const v = video.current
        if (!alive || !v) { stream.getTracks().forEach(t => t.stop()); return }
        const track = stream.getVideoTracks()[0]
        const s = track?.getSettings?.() || {}
        setCurrent(s.deviceId || null)
        setMirrored(s.facingMode !== 'environment')   // selfie view for front cameras and webcams, true view for back cameras
        track?.addEventListener('ended', () => { if (alive) { setReady(false); setError('cam_busy') } })   // unplugged, or another app took it
        v.srcObject = stream
        v.muted = true; v.playsInline = true
        await v.play().catch(() => {})
        // device labels/ids are only complete after permission is granted
        const list = await navigator.mediaDevices.enumerateDevices?.().catch(() => []) || []
        if (!alive) return
        setCams(list.filter(d => d.kind === 'videoinput' && d.deviceId).map(d => d.deviceId))
        setReady(true)
      } catch (e) { if (alive) setError(camError(e)) }
    })()
    return () => {
      alive = false
      stream?.getTracks().forEach(t => t.stop())
      if (video.current) video.current.srcObject = null
      setReady(false)
    }
  }, [on, attempt, video])

  const retry = useCallback(() => setAttempt(a => a + 1), [])
  /** Next camera on this device (front ↔ back, laptop ↔ USB webcam); remembered for next time. */
  const switchCamera = useCallback(() => {
    if (cams.length < 2) return
    store.set(cams[(cams.indexOf(current || '') + 1) % cams.length])
    setAttempt(a => a + 1)
  }, [cams, current])

  return { ready, error, retry, mirrored, canSwitch: cams.length > 1, switchCamera }
}

/* ---------------- models: loaded once per page, served from Cache Storage after the first visit ---------------- */
const BASE = import.meta.env.BASE_URL + 'mediapipe/'
const CACHE = 'mirror-models-v1'

async function fetchCached(url: string): Promise<ArrayBuffer> {
  const good = (r: Response) => r.ok && !(r.headers.get('content-type') || '').includes('text/html')   // the SPA rewrite answers missing files with index.html
  try {
    const c = await caches.open(CACHE)
    const hit = await c.match(url)
    if (hit) return await hit.arrayBuffer()
    const r = await fetch(url)
    if (!good(r)) throw new Error('models_failed')
    await c.put(url, r.clone()).catch(() => {})
    return await r.arrayBuffer()
  } catch {
    const r = await fetch(url)          // Cache Storage blocked (private mode…) → plain network
    if (!good(r)) throw new Error('models_failed')
    return await r.arrayBuffer()
  }
}
const blobUrl = async (url: string, type: string) => URL.createObjectURL(new Blob([await fetchCached(url)], { type }))

type Kind = 'face' | 'hand' | 'pose'
type Task = FaceLandmarker | HandLandmarker | PoseLandmarker
type Models = { face: FaceLandmarker; hand: HandLandmarker; pose: PoseLandmarker; gpu: Record<Kind, boolean>; recreate: (k: Kind) => Promise<void> }
let modelsP: Promise<Models> | null = null

function loadModels(): Promise<Models> {
  if (modelsP) return modelsP
  modelsP = (async () => {
    const vision = await import('@mediapipe/tasks-vision')
    const name = 'wasm/vision_wasm' + ((await vision.FilesetResolver.isSimdSupported()) ? '' : '_nosimd') + '_internal'
    const fileset = { wasmLoaderPath: await blobUrl(BASE + name + '.js', 'text/javascript'), wasmBinaryPath: await blobUrl(BASE + name + '.wasm', 'application/wasm') }
    const files: Record<Kind, string> = { face: 'face_landmarker.task', hand: 'hand_landmarker.task', pose: 'pose_landmarker_lite.task' }
    const bytes: Partial<Record<Kind, Uint8Array>> = {}
    const create = async (k: Kind, delegate: 'GPU' | 'CPU'): Promise<Task> => {
      bytes[k] ||= new Uint8Array(await fetchCached(BASE + files[k]))
      const baseOptions = { modelAssetBuffer: bytes[k], delegate }
      if (k === 'face') return vision.FaceLandmarker.createFromOptions(fileset, { baseOptions, runningMode: 'VIDEO', numFaces: 1 })
      if (k === 'hand') return vision.HandLandmarker.createFromOptions(fileset, { baseOptions, runningMode: 'VIDEO', numHands: 2 })
      return vision.PoseLandmarker.createFromOptions(fileset, { baseOptions, runningMode: 'VIDEO', numPoses: 1 })
    }
    const m = { gpu: { face: true, hand: true, pose: true } } as Models
    const make = async (k: Kind) => {
      let t: Task
      try { t = await create(k, m.gpu[k] ? 'GPU' : 'CPU') } catch { m.gpu[k] = false; t = await create(k, 'CPU') }   // no WebGL → CPU
      ;(m as any)[k] = t
    }
    m.recreate = async (k: Kind) => { try { (m as any)[k].close() } catch { /* already gone */ } m.gpu[k] = false; await make(k) }
    for (const k of ['face', 'hand', 'pose'] as Kind[]) await make(k)   // one at a time: lower memory peak on tablets
    return m
  })()
  modelsP.catch(() => { modelsP = null })   // allow a retry after a failed download
  return modelsP
}

/* ---------------- analysis loop ---------------- */
const COLORS: Record<PatchClass, string> = { item: '#22C38E', skin: '#FF5D6C', other: '#FF9F1C', ref: '#7CC6FF' }

function drawDebug(cv: HTMLCanvasElement, w: number, h: number, d: Dbg, r: FrameResult, fps: number, mirrored: boolean) {
  cv.width = w; cv.height = h
  const g = cv.getContext('2d')!
  g.clearRect(0, 0, w, h)
  const X = (x: number) => (mirrored ? w - x : x)   // the front-camera preview is mirrored, the frame is not
  g.fillStyle = 'rgba(255,255,255,.8)'
  for (const p of d.points) { g.beginPath(); g.arc(X(p.x * w), p.y * h, 2, 0, 7); g.fill() }
  g.font = '10px sans-serif'; g.lineWidth = 2
  for (const p of d.patches) {
    g.strokeStyle = COLORS[p.cls]; g.fillStyle = `rgb(${p.rgb.join(',')})`
    g.fillRect(X(p.x) - p.r, p.y - p.r, 2 * p.r, 2 * p.r); g.strokeRect(X(p.x) - p.r, p.y - p.r, 2 * p.r, 2 * p.r)
    if (p.cls !== 'ref') { g.fillStyle = '#fff'; g.fillText(Number.isFinite(p.d) ? String(Math.round(p.d)) : '–', X(p.x) + p.r + 2, p.y + 3) }
  }
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, 230, 54)
  g.fillStyle = '#fff'; g.font = '11px monospace'
  g.fillText(`luma ${Math.round(r.luma)}  fps ${fps.toFixed(1)}`, 6, 14)
  ;(['mask', 'gown', 'gloves'] as ItemId[]).forEach((k, i) => g.fillText(`${k}: ${r[k].state} ${r[k].msg}`, 6, 28 + i * 12))
}

export function useMirror(video: RefObject<HTMLVideoElement>, overlay: RefObject<HTMLCanvasElement>, on: boolean, debug: boolean) {
  const cam = useCamera(video, on)
  const [models, setModels] = useState<Models | null>(null)
  const [modelErr, setModelErr] = useState(false)
  const [live, setLive] = useState<{ voted: Record<ItemId, Verdict>; frame: FrameResult; count: number } | null>(null)
  const frames = useRef<FrameResult[]>([])
  const dbgRef = useRef(debug)
  dbgRef.current = debug
  const mirRef = useRef(cam.mirrored)
  mirRef.current = cam.mirrored

  const load = useCallback(() => {
    setModelErr(false)
    loadModels().then(setModels, () => setModelErr(true))
  }, [])
  useEffect(() => { if (on) load() }, [on, load])

  useEffect(() => {
    if (!on || !cam.ready || !models) return
    const cal = prepCalibration(loadCalibration())
    frames.current = []   // new camera (or switched camera) → start voting from scratch
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    let raf = 0, last = 0, lastT = -1, ts = 0, fps = 0, alive = true
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const v = video.current
      if (!v || v.readyState < 2 || !v.videoWidth) return
      const now = performance.now()
      if (now - last < 1000 / CFG.fps || v.currentTime === lastT) return   // throttle + skip repeated frames
      fps = last ? 0.8 * fps + 0.2 * (1000 / (now - last)) : 0
      last = now; lastT = v.currentTime
      const s = Math.min(1, CFG.analysisSize / Math.max(v.videoWidth, v.videoHeight))
      const w = Math.round(v.videoWidth * s), h = Math.round(v.videoHeight * s)
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      ctx.drawImage(v, 0, 0, w, h)
      const px = ctx.getImageData(0, 0, w, h)
      ts = Math.max(ts + 1, Math.round(now))   // timestamps must strictly increase
      let face: Pt[] | null = null, hands: Pt[][] = [], pose: Pt[] | null = null, step: Kind = 'face'
      try {
        face = models.face.detectForVideo(canvas, ts).faceLandmarks[0] || null
        step = 'hand'; hands = models.hand.detectForVideo(canvas, ts).landmarks
        step = 'pose'; pose = models.pose.detectForVideo(canvas, ts).landmarks[0] || null
      } catch {
        // some Android GPUs accept the GPU delegate but fail on the first frame → rebuild that one on CPU
        cancelAnimationFrame(raf)
        if (models.gpu[step]) models.recreate(step).then(() => { if (alive) raf = requestAnimationFrame(tick) }, () => setModelErr(true))
        else setModelErr(true)
        return
      }
      const dbg: Dbg | undefined = dbgRef.current ? { patches: [], points: [] } : undefined
      const r = analyzeFrame(px, { face, hands, pose }, cal, dbg)
      frames.current = [...frames.current, r].slice(-CFG.vote.window)
      setLive({ voted: voteAll(frames.current), frame: r, count: frames.current.length })
      const ov = overlay.current
      if (ov) { if (dbg) drawDebug(ov, w, h, dbg, r, fps, mirRef.current); else if (ov.width) ov.width = 0 }
    }
    raf = requestAnimationFrame(tick)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [on, cam.ready, models, video, overlay])

  useEffect(() => { if (!on) { frames.current = []; setLive(null) } }, [on])

  const error: CamError | null = cam.error || (modelErr ? 'models_failed' : null)
  return {
    error,
    loading: on && !error && (!cam.ready || !models),
    mirrored: cam.mirrored, canSwitch: cam.canSwitch, switchCamera: cam.switchCamera,
    live,
    /** Forget the frames seen so far (start of the countdown). */
    reset: useCallback(() => { frames.current = []; setLive(l => (l ? { ...l, count: 0 } : l)) }, []),
    /** The voted result over the current window. */
    snapshot: useCallback(() => ({ verdicts: voteAll(frames.current), count: frames.current.length }), []),
    retry: useCallback(() => { if (cam.error) cam.retry(); if (modelErr) load() }, [cam, modelErr, load]),
  }
}
