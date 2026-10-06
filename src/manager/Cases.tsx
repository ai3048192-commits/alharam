import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { rpc } from '../lib/supabase'
import { useSession } from '../lib/session'
import { errorText, HAND, PPE, PPE_ORDER, SIGN_IDS, SIGNS, signBG, signShadow, ar } from '../lib/content'
import { Field, Loading } from '../components/ui'
import { ManagerLogin } from './ManagerHome'

type Case = {
  id?: string; level: 'basic' | 'adv'; room: string; title: string; who: string; file: string[]; task: string; opts: string[]
  iso: string; ppe: string[]; hand: string; hands?: string[]; partial: Record<string, { p: number; n: string }>
  why_iso: string; why_ppe: string; why_hand: string
  active?: boolean; dept?: string | null; author?: string | null; can_edit?: boolean
}
const EMPTY: Case = { level: 'basic', room: '', title: '', who: '', file: [''], task: '', opts: ['std', 'contact', 'droplet', 'airborne'], iso: 'contact', ppe: [], hand: 'alcohol', hands: [], partial: {}, why_iso: '', why_ppe: '', why_hand: '' }

function Editor({ init, onDone }: { init: Case; onDone: (saved: boolean) => void }) {
  const [c, setC] = useState<Case>({ ...init, file: init.file.length ? init.file : [''] })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Case>(k: K, v: Case[K]) => setC(x => ({ ...x, [k]: v }))
  const hands = c.hands ?? [c.hand]
  const toggleHand = (k: string) => setC(x => {
    const cur = x.hands ?? [x.hand]
    const on = cur.includes(k)
    const next = k === 'none' ? (on ? [] : ['none']) : on ? cur.filter(h => h !== k) : [...cur.filter(h => h !== 'none'), k]
    return { ...x, hands: next, hand: next[0] || x.hand }
  })
  const toggleOpt = (id: string) => setC(x => {
    const opts = x.opts.includes(id) ? x.opts.filter(o => o !== id) : [...x.opts, id]
    const partial = { ...x.partial }; if (!opts.includes(id)) delete partial[id]
    return { ...x, opts, partial, iso: opts.includes(x.iso) ? x.iso : opts[0] || '' }
  })
  const save = async () => {
    setErr('')
    if (c.opts.length < 2) return setErr('اختار لافتتين على الأقل تظهر للاعب.')
    if (!hands.length) return setErr('علّم على إجابة واحدة على الأقل لنظافة الإيدين.')
    setBusy(true)
    try { await rpc('save_case', { p: { ...c, hands, hand: hands.includes('soap') ? 'soap' : hands[0], file: c.file.map(s => s.trim()).filter(Boolean) } }); onDone(true) }
    catch (e) { setErr(errorText(e)) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <div className="mhead"><h2>{c.id ? 'تعديل سؤال' : 'سؤال جديد'}</h2><button className="linkbtn" onClick={() => onDone(false)}>إلغاء</button></div>

      <div className="card stack" style={{ gap: 10 }}>
        <h3 className="ed-h">ملف المريض</h3>
        <Field label="عنوان قصير (بيظهر في النتايج)"><input id="title" value={c.title} onChange={e => set('title', e.target.value)} placeholder="مثلًا: اشتباه درن رئوي" /></Field>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <Field label="رقم الأوضة"><input id="room" value={c.room} onChange={e => set('room', e.target.value)} placeholder="204" style={{ width: 90 }} /></Field>
          <Field label="المريض"><input id="who" value={c.who} onChange={e => set('who', e.target.value)} placeholder="راجل، 45 سنة" /></Field>
        </div>
        <Field label="ملف المريض (معلومة في كل سطر)"><textarea id="file" value={c.file.join('\n')} onChange={e => set('file', e.target.value.split('\n'))} placeholder={'كحة بقالها 4 أسابيع\nعرق بالليل'} /></Field>
        <Field label="المطلوب من اللاعب"><input id="task" value={c.task} onChange={e => set('task', e.target.value)} placeholder="هتدخل تاخد العلامات الحيوية" /></Field>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <h3 className="ed-h">١. اللافتة</h3>
        <p className="small muted">اختار اللافتات اللي هتظهر للاعب (٢ لـ ٦)، وبعدين دوس على الإجابة الصح منهم.</p>
        <div className="optgrid">{SIGN_IDS.map(id => (
          <label key={id} className={'opt' + (c.opts.includes(id) ? ' on' : '')}>
            <input type="checkbox" checked={c.opts.includes(id)} onChange={() => toggleOpt(id)} />
            <span className="chipsign" style={{ background: signBG(id), color: SIGNS[id].fg, textShadow: signShadow(id) }}>{SIGNS[id].ar}</span>
          </label>))}</div>
        <Field label="الإجابة الصح"><select id="iso" value={c.iso} onChange={e => setC(x => { const p = { ...x.partial }; delete p[e.target.value]; return { ...x, iso: e.target.value, partial: p } })}>
          {c.opts.map(id => <option key={id} value={id}>{SIGNS[id as keyof typeof SIGNS].ar}</option>)}</select></Field>
        <details>
          <summary className="small" style={{ fontWeight: 800, cursor: 'pointer' }}>درجة جزئية لإجابات قريبة (اختياري)</summary>
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            {c.opts.filter(o => o !== c.iso).map(o => (
              <div key={o} className="partial">
                <span className="chipsign" style={{ background: signBG(o), color: SIGNS[o as keyof typeof SIGNS].fg, textShadow: signShadow(o) }}>{SIGNS[o as keyof typeof SIGNS].ar}</span>
                <input type="number" min={0} max={45} placeholder="٠" value={c.partial[o]?.p ?? ''} aria-label="نقط من ٥٠"
                  onChange={e => setC(x => { const p = { ...x.partial }; if (e.target.value === '') delete p[o]; else p[o] = { p: Math.min(45, Math.max(0, +e.target.value)), n: p[o]?.n || '' }; return { ...x, partial: p } })} />
                <input placeholder="ليه نص صح؟" value={c.partial[o]?.n ?? ''} disabled={c.partial[o] == null}
                  onChange={e => setC(x => ({ ...x, partial: { ...x.partial, [o]: { p: x.partial[o]?.p ?? 0, n: e.target.value } } }))} />
              </div>))}
            <p className="small muted">الإجابة الصح بـ ٥٠ نقطة. الجزئية من ٠ لـ ٤٥.</p>
          </div>
        </details>
        <Field label="ليه دي الإجابة الصح؟"><textarea id="why_iso" value={c.why_iso} onChange={e => set('why_iso', e.target.value)} /></Field>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <h3 className="ed-h">٢. الواقيات الصح</h3>
        <div className="optgrid">{PPE_ORDER.map(k => (
          <label key={k} className={'opt' + (c.ppe.includes(k) ? ' on' : '')}>
            <input type="checkbox" checked={c.ppe.includes(k)} onChange={() => set('ppe', c.ppe.includes(k) ? c.ppe.filter(x => x !== k) : [...c.ppe, k])} />{PPE[k]}
          </label>))}</div>
        <p className="small muted">لو مش محتاج أي واقيات سيبها كلها فاضية.</p>
        <Field label="الشرح"><textarea id="why_ppe" value={c.why_ppe} onChange={e => set('why_ppe', e.target.value)} /></Field>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <h3 className="ed-h">٣. نظافة الإيدين الصح</h3>
        <div className="optgrid">{Object.keys(HAND).map(k => (
          <label key={k} className={'opt' + (hands.includes(k) ? ' on' : '')}><input type="checkbox" checked={hands.includes(k)} onChange={() => toggleHand(k)} />{HAND[k]}</label>))}</div>
        <p className="small muted">ممكن تعلّم على أكتر من إجابة لو كلهم مطلوبين. اللاعب لازم يختارهم كلهم عشان ياخد الدرجة كاملة. «مش لازم» متتجمعش مع حاجة تانية.</p>
        <Field label="الشرح"><textarea id="why_hand" value={c.why_hand} onChange={e => set('why_hand', e.target.value)} /></Field>
      </div>

      {err && <p className="err">{err}</p>}
      <p className="foot">السؤال هيظهر للاعبين على طول بعد الحفظ. راجع الإجابة كويس.</p>
      <button className="btn mint" disabled={busy} onClick={save}>{busy ? 'بنحفظ...' : 'احفظ ونزّل السؤال'}</button>
    </div>
  )
}

export default function Cases() {
  const { manager } = useSession()
  const [list, setList] = useState<Case[] | null>(null)
  const [edit, setEdit] = useState<Case | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [show, setShow] = useState<'active' | 'off' | 'mine'>('active')
  const load = useCallback(async () => { try { setList(await rpc<Case[]>('list_cases_admin')) } catch (e) { setErr(errorText(e)) } }, [])
  useEffect(() => { if (manager) load() }, [manager, load])

  if (!manager) return <ManagerLogin />
  if (edit) return <Editor init={edit} onDone={s => { setEdit(null); if (s) load(); window.scrollTo({ top: 0 }) }} />
  if (err) return <p className="err">{err}</p>
  if (!list) return <Loading />

  const shown = list.filter(c => (show === 'active' ? c.active : show === 'off' ? !c.active : c.can_edit)).filter(c => !q || (c.title + c.who + c.file.join(' ')).includes(q))
  return (
    <div className="stack">
      <div className="mhead"><h2>الأسئلة</h2><Link className="linkbtn" to="/manager">رجوع</Link></div>
      <button className="btn mint" onClick={() => setEdit({ ...EMPTY })}>+ سؤال جديد</button>
      <div className="seg three" role="group">
        <button aria-pressed={show === 'active'} onClick={() => setShow('active')}>شغالة ({ar(list.filter(c => c.active).length)})</button>
        <button aria-pressed={show === 'mine'} onClick={() => setShow('mine')}>أقدر أعدّلها</button>
        <button aria-pressed={show === 'off'} onClick={() => setShow('off')}>متوقفة</button>
      </div>
      <input placeholder="دوّر في الأسئلة" value={q} onChange={e => setQ(e.target.value)} aria-label="بحث" />
      {shown.length === 0 && <p className="hint">مفيش أسئلة هنا.</p>}
      {shown.map(c => (
        <div key={c.id} className="card case-row">
          <div className="case-top">
            <span className="chipsign" style={{ background: signBG(c.iso), color: SIGNS[c.iso as keyof typeof SIGNS].fg, textShadow: signShadow(c.iso) }}>{SIGNS[c.iso as keyof typeof SIGNS].ar}</span>
            {!c.active && <span className="tag2" style={{ background: '#FFE5E8', color: 'var(--coral-dk)' }}>متوقف</span>}
          </div>
          <h4>{c.title}</h4>
          <p className="small muted">{c.who} · {c.file.join(' · ')}</p>
          <p className="small muted">كتبه: {c.author || '—'}{c.dept ? ' · ' + c.dept : ''}</p>
          {c.can_edit && <div className="row" style={{ marginTop: 6 }}>
            <button className="btn white sm" onClick={() => setEdit(c)}>تعديل</button>
            <button className="btn ghost sm dark" onClick={async () => { await rpc('set_case_active', { p_id: c.id, p_active: !c.active }); load() }}>{c.active ? 'وقّفه' : 'رجّعه'}</button>
          </div>}
        </div>))}
    </div>
  )
}
