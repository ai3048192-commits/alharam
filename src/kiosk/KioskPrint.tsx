/* /kiosk/print — signs for the station: header strip, «STAND HERE» floor sticker, donning steps card (A4 / A3). */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MIRROR_ITEMS, MIRROR_ITEMS_EN, MIRROR_LIMITS } from '../lib/content'
import { Svg } from '../components/ui'
import { ITEMS, type ItemId } from '../mirror/checks'
import { PPE_ICON, STEP_ICON, footprint } from './icons'
import { loadKiosk } from './settings'
import './kprint.css'

const PAPER = { A4: [210, 297], A3: [297, 420] } as const
const HOW: Record<ItemId, string> = {
  head: 'غطي الشعر كله لحد الودان',
  mask: 'السلك على الأنف، ويغطي لحد تحت الدقن',
  gown: 'من الرقبة للركبة، والكمين لحد الرسغ',
  gloves: 'آخر حاجة، واسحبه فوق كم الجاون',
}

export default function KioskPrint() {
  const [cfg] = useState(loadKiosk)
  const [paper, setPaper] = useState<keyof typeof PAPER>('A4')
  const [w, h] = PAPER[paper]
  const portrait = { '--pw': `${w}mm`, '--ph': `${h}mm`, width: `min(100%, ${w * 2.4}px)`, aspectRatio: `${w} / ${h}` } as React.CSSProperties
  return (
    <div className="kprint">
      <style>{`@page{size:${paper} portrait;margin:0}`}</style>
      <div className="kp-controls stack">
        <div className="mhead"><h2>لافتات المحطة</h2><Link className="linkbtn" to="/kiosk/settings">رجوع</Link></div>
        <div className="card stack" style={{ gap: 10 }}>
          <div className="seg">
            {(Object.keys(PAPER) as (keyof typeof PAPER)[]).map(p => <button key={p} type="button" aria-pressed={paper === p} onClick={() => setPaper(p)}>{p}</button>)}
          </div>
          <p className="small muted">٣ صفحات: الشريط اللي فوق المحطة (نسختين في الصفحة، قص على الخط المتقطّع)، العلامة اللي على الأرض، وخطوات لبس الواقيات. في نافذة الطباعة فعّل «Background graphics» عشان الألوان تطلع.</p>
          <button className="btn mint" onClick={() => window.print()}>اطبع</button>
        </div>
      </div>

      <section className="kp-sheet kp-strip" style={portrait}>
        {[0, 1].map(i => (
          <div className="kp-strip-in" key={i}>
            <h1>{cfg.title}</h1>
            {cfg.subtitle && <p className="sub">{cfg.subtitle}</p>}
            <div className="kp-steps">
              <div><Svg html={STEP_ICON.stand} /><b>STAND</b><span>قف</span></div><i>→</i>
              <div><Svg html={STEP_ICON.check} /><b>CHECK</b><span>افحص</span></div><i>→</i>
              <div><Svg html={STEP_ICON.go} /><b>GO</b><span>ادخل</span></div>
            </div>
            {cfg.tagline && <p className="tag">{cfg.tagline}</p>}
          </div>
        ))}
      </section>

      <section className="kp-sheet kp-floor" style={portrait}>
        <div className="kp-dot">
          <div className="kp-feet"><Svg html={footprint('#1E4FA3')} /><Svg html={footprint('#1E4FA3', true)} /></div>
          <b>STAND HERE</b>
          <span>قف هنا</span>
        </div>
        <p className="kp-cut">قص على الدايرة، والزقها على الأرض قدام المحطة على بعد ١.٥ لـ ٢ متر من الكاميرا.</p>
      </section>

      <section className="kp-sheet kp-don" style={portrait}>
        <header><h1>PPE Donning Steps</h1><p>خطوات لبس الواقيات</p></header>
        <ol>
          {ITEMS.map((k, i) => (
            <li key={k}>
              <span className="n">{'١٢٣٤'[i]}</span>
              <Svg html={PPE_ICON[k]} />
              <span><small>{i + 1}. {MIRROR_ITEMS_EN[k]}</small><b>{MIRROR_ITEMS[k]}</b><em>{HOW[k]}</em></span>
            </li>
          ))}
        </ol>
        <footer>{MIRROR_LIMITS}<br /><b>{cfg.title} · {cfg.tagline}</b></footer>
      </section>
    </div>
  )
}
