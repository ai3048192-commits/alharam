/* Static artwork (SVG strings) shared by the games. */
export const esc=(s:any)=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"} as any)[c]);
/* ======================= Art ======================= */
export const STAR=(on:boolean)=>`<svg viewBox="0 0 48 48"><path d="M24 3.5l6.2 12.6 13.9 2-10 9.8 2.4 13.8L24 35.2l-12.4 6.5L14 27.9 4 18.1l13.8-2z" fill="${on?"#FF9F1C":"#E6DDF7"}" stroke="${on?"#D9780A":"#CDB8E8"}" stroke-width="2.5" stroke-linejoin="round"/>${on?'<path d="M17 18l5-1" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>':""}</svg>`;
export const HALFSTAR=`<svg viewBox="0 0 48 48"><defs><clipPath id="hs"><rect x="24" y="0" width="24" height="48"/></clipPath></defs><path d="M24 3.5l6.2 12.6 13.9 2-10 9.8 2.4 13.8L24 35.2l-12.4 6.5L14 27.9 4 18.1l13.8-2z" fill="#E6DDF7" stroke="#CDB8E8" stroke-width="2.5" stroke-linejoin="round"/><path clip-path="url(#hs)" d="M24 3.5l6.2 12.6 13.9 2-10 9.8 2.4 13.8L24 35.2l-12.4 6.5L14 27.9 4 18.1l13.8-2z" fill="#FF9F1C" stroke="#D9780A" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
export const GERM=(c="#5BD06A")=>`<svg viewBox="0 0 40 40"><g fill="${c}" stroke="#2E8B3E" stroke-width="2"><path d="M20 4l3 5 5-3 0 6 6 1-3 5 5 4-5 3 3 5-6 1v6l-5-3-3 5-3-5-5 3v-6l-6-1 3-5-5-3 5-4-3-5 6-1v-6l5 3z"/></g><circle cx="15.5" cy="18" r="3.4" fill="#fff"/><circle cx="24.5" cy="18" r="3.4" fill="#fff"/><circle cx="16" cy="18.6" r="1.6" fill="#24154A"/><circle cx="25" cy="18.6" r="1.6" fill="#24154A"/><path d="M15 25q5 4 10 0" stroke="#24154A" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
export const SPARK=`<svg viewBox="0 0 40 40"><path d="M20 2l4 14 14 4-14 4-4 14-4-14-14-4 14-4z" fill="#FFE27A" stroke="#D9780A" stroke-width="1.5"/></svg>`;
export const TROPHY=`<svg class="trophy" viewBox="0 0 64 64"><path d="M18 8h28v14c0 9-6 16-14 16s-14-7-14-16z" fill="#FF9F1C" stroke="#D9780A" stroke-width="3"/><path d="M18 13H9c0 9 5 13 11 14M46 13h9c0 9-5 13-11 14" fill="none" stroke="#D9780A" stroke-width="3"/><path d="M28 38h8v8h-8z" fill="#D9780A"/><rect x="20" y="46" width="24" height="9" rx="3" fill="#24154A"/><path d="M26 14l3 0" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;

export const IC:Record<string,string>={
 gloves:'<svg viewBox="0 0 48 48"><path d="M15 43V25l-4.5-8.5a2.6 2.6 0 0 1 4.5-2.6L19 20V9a2.6 2.6 0 0 1 5.2 0v10V7a2.6 2.6 0 0 1 5.2 0v12V9a2.6 2.6 0 0 1 5.2 0v11-5a2.6 2.6 0 0 1 5.2 0v14c0 8-4.6 14-11 14z" fill="#8C8CFF" stroke="#4E4EC9" stroke-width="2.2" stroke-linejoin="round"/><rect x="13" y="39" width="20" height="6" rx="2" fill="#6F6FE8" stroke="#4E4EC9" stroke-width="2"/></svg>',
 gown:'<svg viewBox="0 0 48 48"><path d="M17 5l7 5 7-5 10 6-4 10-4-2v24H15V19l-4 2-4-10z" fill="#FFD95E" stroke="#C99A0A" stroke-width="2.2" stroke-linejoin="round"/><path d="M24 10v33" stroke="#C99A0A" stroke-width="2"/><path d="M15 30h18" stroke="#C99A0A" stroke-width="2" stroke-dasharray="3 3"/></svg>',
 mask:'<svg viewBox="0 0 48 48"><path d="M9 17c6-4 24-4 30 0v13c-6 7-24 7-30 0z" fill="#9ED8FF" stroke="#3E8FCC" stroke-width="2.2" stroke-linejoin="round"/><path d="M13 22h22M13 27h22" stroke="#3E8FCC" stroke-width="2"/><path d="M9 19c-5 0-6 3-6 4.5S4 28 9 28.5M39 19c5 0 6 3 6 4.5S44 28 39 28.5" fill="none" stroke="#3E8FCC" stroke-width="2"/></svg>',
 n95:'<svg viewBox="0 0 48 48"><path d="M8 23c0-9 7-13 16-13s16 4 16 13c0 10-7 16-16 16S8 33 8 23z" fill="#F4F6FB" stroke="#7D8AAE" stroke-width="2.2"/><path d="M24 10v29" stroke="#7D8AAE" stroke-width="2"/><path d="M8 20C4 19 2 15 3 12M40 20c4-1 6-5 5-8" fill="none" stroke="#3E8FCC" stroke-width="2.4"/><rect x="15" y="22" width="18" height="8" rx="3" fill="#3E8FCC"/><text x="24" y="28.6" font-size="7" fill="#fff" text-anchor="middle" font-family="system-ui" font-weight="800">N95</text></svg>',
 eye:'<svg viewBox="0 0 48 48"><path d="M4 20h40v6c0 6-5 9-10 9-4 0-6-3-8-6h-4c-2 3-4 6-8 6-5 0-10-3-10-9z" fill="#CFF0FF" stroke="#3E8FCC" stroke-width="2.2" stroke-linejoin="round"/><path d="M4 20l-1-5M44 20l1-5" stroke="#3E8FCC" stroke-width="2.4" stroke-linecap="round"/><path d="M10 24l5 0M31 24l5 0" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
 alcohol:'<svg viewBox="0 0 80 80"><rect x="22" y="30" width="36" height="42" rx="8" fill="#BDE7FF" stroke="#3E8FCC" stroke-width="3"/><rect x="22" y="44" width="36" height="28" rx="0" fill="#8FD3FF"/><rect x="22" y="30" width="36" height="42" rx="8" fill="none" stroke="#3E8FCC" stroke-width="3"/><rect x="33" y="18" width="14" height="12" fill="#fff" stroke="#3E8FCC" stroke-width="3"/><path d="M33 18h20l4 5" fill="none" stroke="#3E8FCC" stroke-width="3" stroke-linecap="round"/><rect x="29" y="50" width="22" height="12" rx="3" fill="#fff"/><path d="M36 56h8M40 52v8" stroke="#6B3FD4" stroke-width="2.6" stroke-linecap="round"/><circle cx="62" cy="26" r="3" fill="#8FD3FF"/></svg>',
 soap:'<svg viewBox="0 0 80 80"><path d="M12 46h56l-6 22H18z" fill="#E6EEF9" stroke="#7D8AAE" stroke-width="3" stroke-linejoin="round"/><path d="M40 46V22h14v8" fill="none" stroke="#7D8AAE" stroke-width="5" stroke-linecap="round"/><path d="M54 34c-3 5-3 8 0 8s3-3 0-8z" fill="#7CC6FF"/><circle cx="27" cy="38" r="6" fill="#fff" stroke="#9ED8FF" stroke-width="2"/><circle cx="20" cy="30" r="4" fill="#fff" stroke="#9ED8FF" stroke-width="2"/><circle cx="31" cy="26" r="3" fill="#fff" stroke="#9ED8FF" stroke-width="2"/><rect x="34" y="18" width="12" height="6" rx="2" fill="#7D8AAE"/></svg>',
 none:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="#FFE5E8" stroke="#D63848" stroke-width="3"/><path d="M12 36L36 12" stroke="#D63848" stroke-width="3.5" stroke-linecap="round"/></svg>'
};

/* the room backdrop: wall tiles, wainscot, floor, door frame, room plate, PPE cart, sanitizer dispenser */
export function roomSVG(room:string){
 return `<svg class="bgsvg" viewBox="0 0 360 250" preserveAspectRatio="none" aria-hidden="true">
  <defs><pattern id="wt" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#F3ECFF"/><path d="M24 0V24H0" fill="none" stroke="#E4D7F7" stroke-width="1.5"/></pattern>
  <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B79AE6"/><stop offset="1" stop-color="#9C7BD8"/></linearGradient></defs>
  <rect width="360" height="250" fill="url(#wt)"/>
  <rect y="150" width="360" height="65" fill="#E2D4F6"/><rect y="148" width="360" height="5" fill="#CDB6EE"/>
  <path d="M0 215h360v35H0z" fill="url(#fl)"/><path d="M0 215h360" stroke="#8462C7" stroke-width="3"/>
  <path d="M40 250l30-35M110 250l18-35M180 250V215M250 250l-18-35M320 250l-30-35" stroke="#C7B0EE" stroke-width="2" opacity=".7"/>
  <!-- door frame -->
  <rect x="125" y="27" width="128" height="190" rx="5" fill="#FFFFFF"/><rect x="129" y="31" width="120" height="186" fill="#EBE1F8"/>
  <!-- room plate -->
  <rect x="160" y="6" width="58" height="18" rx="6" fill="#24154A"/><text x="189" y="19.5" font-size="12" fill="#fff" text-anchor="middle" font-family="Lalezar,system-ui" >${esc(room)}</text>
  <!-- sanitizer dispenser -->
  <g transform="translate(276 64)"><rect width="30" height="44" rx="7" fill="#fff" stroke="#B3A1D8" stroke-width="2"/><rect x="6" y="8" width="18" height="16" rx="4" fill="#9ED8FF"/><path d="M15 12c-3 4-3 7 0 7s3-3 0-7z" fill="#6B3FD4"/><rect x="9" y="30" width="12" height="6" rx="2" fill="#B3A1D8"/><path d="M15 44v6" stroke="#B3A1D8" stroke-width="2"/></g>
  <!-- PPE cart -->
  <g transform="translate(268 140)"><rect x="0" y="0" width="70" height="66" rx="6" fill="#FF9F1C" stroke="#D9780A" stroke-width="2"/><rect x="5" y="8" width="60" height="16" rx="3" fill="#FFC48A"/><rect x="5" y="28" width="60" height="16" rx="3" fill="#FFC48A"/><rect x="5" y="48" width="60" height="14" rx="3" fill="#FFC48A"/><rect x="28" y="14" width="14" height="4" rx="2" fill="#D9780A"/><rect x="28" y="34" width="14" height="4" rx="2" fill="#D9780A"/><rect x="28" y="53" width="14" height="4" rx="2" fill="#D9780A"/><circle cx="10" cy="72" r="5" fill="#24154A"/><circle cx="60" cy="72" r="5" fill="#24154A"/>
   <rect x="8" y="-14" width="26" height="14" rx="2" fill="#8C8CFF" stroke="#4E4EC9" stroke-width="1.5"/><path d="M16 -14c0-4 8-4 8 0" fill="#fff"/><rect x="38" y="-12" width="24" height="12" rx="2" fill="#9ED8FF" stroke="#3E8FCC" stroke-width="1.5"/></g>
  <!-- plant-free hallway bench line -->
  <rect x="14" y="120" width="8" height="30" rx="3" fill="#CDB6EE"/>
 </svg>`;
}
export const ROOM_IN=`<svg viewBox="0 0 100 160" preserveAspectRatio="none"><rect x="10" y="95" width="80" height="22" rx="4" fill="#6A4BB0"/><rect x="10" y="88" width="30" height="12" rx="5" fill="#E9F2FF"/><rect x="16" y="117" width="5" height="25" fill="#3A2560"/><rect x="80" y="117" width="5" height="25" fill="#3A2560"/><path d="M86 30v60" stroke="#A890D8" stroke-width="2.5"/><rect x="80" y="30" width="12" height="16" rx="3" fill="#9ED8FF"/><rect x="0" y="142" width="100" height="18" fill="#2E1D4D"/></svg>`;

/* ======================= Spot the difference ======================= */
export const SPOT_SECONDS=120, SPOT_W=360, SPOT_H=240;
export const DIFFS=[
 {id:"sign",cx:44,cy:105,r:22,t:"الباب من غير لافتة عزل",w:"المريض على عزل تلامسي واللافتة مش موجودة، فاللي داخل مش هيعرف يلبس إيه."},
 {id:"rub",cx:96,cy:84,r:18,t:"جهاز الكحول فاضي",w:"لو الجهاز اللي جنب الباب فاضي، الناس هتدخل وتخرج من غير ما تنضف إيدها. لازم يتملي على طول."},
 {id:"mask",cx:140,cy:91,r:14,t:"الماسك نازل تحت الأنف والبق",w:"الماسك لازم يغطي الأنف والبق والدقن. لو نازل على الدقن يبقى ملوش لازمة، وكمان بيتلوث."},
 {id:"phone",cx:149,cy:136,r:15,t:"بيمسك الموبايل بالجوانتي",w:"الجوانتي بيتلبس لمهمة واحدة مع المريض وبعدها يتقلع. لو لمست بيه الموبايل، الموبايل بيتلوث وبينقل العدوى برّه الأوضة."},
 {id:"sharps",cx:191,cy:124,r:16,t:"صندوق الإبر مليان على الآخر",w:"صندوق الإبر بيتقفل ويتغير لما يوصل لتلات أرباعه. لو اتملى للآخر، الإبر بتطلع برّه وممكن حد يتعور بيها."},
 {id:"waste",cx:100,cy:178,r:20,t:"شاش عليه دم في الكيس الأسود",w:"النفايات الملوثة بالدم مكانها الكيس الأحمر (النفايات الخطرة)، مش الكيس الأسود اللي للنفايات العادية."},
 {id:"urine",cx:246,cy:192,r:24,t:"كيس البول على الأرض",w:"كيس البول بيتعلق تحت مستوى المثانة ومبيلمسش الأرض، عشان البول ميرجعش للمريض والكيس ميتلوثش."},
 {id:"linen",cx:308,cy:213,r:20,t:"ملايات متسخة على الأرض",w:"الملايات المتسخة بتتحط على طول في الكيس أو العربية المخصصة للغسيل، ومتترميش على الأرض."}
];
export function spotSVG(bad:boolean, act?:string[]){
 const B=bad; const on=(id:string)=>B&&(!act||act.includes(id));
 return `<svg viewBox="0 0 ${SPOT_W} ${SPOT_H}" aria-hidden="true">
  <defs><pattern id="sp${B?"b":"a"}t" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#F3ECFF"/><path d="M20 0V20H0" fill="none" stroke="#E4D7F7" stroke-width="1.2"/></pattern>
  <linearGradient id="sp${B?"b":"a"}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B79AE6"/><stop offset="1" stop-color="#9C7BD8"/></linearGradient></defs>
  <rect width="360" height="240" fill="url(#sp${B?"b":"a"}t)"/>
  <rect y="150" width="360" height="50" fill="#E2D4F6"/><rect y="148" width="360" height="4" fill="#CDB6EE"/>
  <rect y="200" width="360" height="40" fill="url(#sp${B?"b":"a"}f)"/><path d="M0 200h360" stroke="#8462C7" stroke-width="2.5"/>
  <!-- window -->
  <rect x="246" y="26" width="84" height="58" rx="6" fill="#fff"/><rect x="251" y="31" width="74" height="48" rx="3" fill="#BFE6FF"/><circle cx="306" cy="46" r="8" fill="#FFE27A"/><path d="M258 66q6-8 14-3 6-6 13 0 7 0 7 6h-34z" fill="#fff"/><path d="M288 31v48" stroke="#fff" stroke-width="3"/>
  <!-- door -->
  <rect x="10" y="36" width="68" height="166" rx="4" fill="#fff"/><rect x="14" y="40" width="60" height="160" fill="#8C5AD8"/><rect x="30" y="50" width="28" height="28" rx="4" fill="#CFF0FF" stroke="#fff" stroke-width="2"/><rect x="19" y="122" width="11" height="4" rx="2" fill="#FF9F1C"/>
  ${on('sign')?`<rect x="22" y="96" width="44" height="18" rx="3" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 2"/>`:`<rect x="22" y="96" width="44" height="18" rx="3" fill="#E3A21A"/><text x="44" y="108.5" font-size="9" fill="#2A1C00" text-anchor="middle" font-family="Lalezar,system-ui">عزل تلامسي</text>`}
  <!-- sanitizer -->
  <rect x="86" y="68" width="20" height="32" rx="4" fill="#fff" stroke="#B3A1D8" stroke-width="1.5"/>
  ${on('rub')?`<rect x="90" y="73" width="12" height="14" rx="2" fill="#F4F6FB" stroke="#E6DDF7"/><circle cx="96" cy="93" r="2.4" fill="#FF5D6C"/>`:`<rect x="90" y="73" width="12" height="14" rx="2" fill="#7CC6FF"/><circle cx="96" cy="93" r="2.4" fill="#22C38E"/>`}
  <rect x="93" y="100" width="6" height="4" rx="1" fill="#B3A1D8"/>
  <!-- bins -->
  <path d="M80 180h18l-2 20H82z" fill="#E63946"/><rect x="79" y="177" width="20" height="5" rx="2" fill="#B71C2B"/>
  <path d="M102 180h18l-2 20h-14z" fill="#2B2D42"/><rect x="101" y="177" width="20" height="5" rx="2" fill="#111"/>
  ${on('waste')?`<rect x="104" y="169" width="13" height="9" rx="2" fill="#fff" stroke="#E6DDF7"/><circle cx="108" cy="172.5" r="1.8" fill="#D62828"/><circle cx="113" cy="175" r="1.5" fill="#D62828"/><circle cx="110.5" cy="176" r="1" fill="#D62828"/>`:`<circle cx="111" cy="175" r="4.5" fill="#E9ECF2" stroke="#C9D2E3"/><rect x="82" y="169" width="13" height="9" rx="2" fill="#fff" stroke="#E6DDF7"/><circle cx="86" cy="172.5" r="1.8" fill="#D62828"/><circle cx="91" cy="175" r="1.5" fill="#D62828"/>`}
  <!-- staff -->
  <ellipse cx="141" cy="201" rx="16" ry="3" fill="rgba(0,0,0,.15)"/>
  <rect x="131" y="148" width="8" height="51" rx="3" fill="#3A2560"/><rect x="142" y="148" width="8" height="51" rx="3" fill="#3A2560"/>
  <rect x="125" y="100" width="31" height="54" rx="10" fill="#3FB8C9"/><path d="M134 101l6 8 6-8" fill="#2E9AAA"/>
  <path d="M127 106L143 136M154 106L153 136" stroke="#3FB8C9" stroke-width="8" stroke-linecap="round"/>
  ${on('phone')?`<rect x="144" y="124" width="11" height="19" rx="2" fill="#24154A"/><rect x="145.5" y="126" width="8" height="14" rx="1" fill="#7CC6FF"/>`:`<rect x="140" y="124" width="17" height="21" rx="2" fill="#C98B4A"/><rect x="142" y="127" width="13" height="16" fill="#fff"/><path d="M144 131h9M144 135h9M144 139h6" stroke="#CDB8E8" stroke-width="1.2"/><rect x="145" y="122.5" width="7" height="3" rx="1" fill="#8A94A6"/>`}
  <circle cx="143" cy="137" r="4.2" fill="${on('phone')?"#8C8CFF":"#F2C094"}" ${on('phone')?'stroke="#4E4EC9" stroke-width="1"':""}/><circle cx="153" cy="137" r="4.2" fill="${on('phone')?"#8C8CFF":"#F2C094"}" ${on('phone')?'stroke="#4E4EC9" stroke-width="1"':""}/>
  <rect x="136" y="93" width="9" height="9" fill="#E8AE7E"/>
  <circle cx="140" cy="84" r="12" fill="#F2C094"/><path d="M128 83q0-15 12-15t12 15q-5-6-12-6t-12 6z" fill="#3FB8C9"/>
  <circle cx="136" cy="82.5" r="1.5" fill="#24154A"/><circle cx="144" cy="82.5" r="1.5" fill="#24154A"/>
  ${on('mask')?`<path d="M140 85v3.5h1.5" stroke="#C98B4A" stroke-width="1.1" fill="none"/><path d="M137 92q3 2 6 0" stroke="#24154A" stroke-width="1.3" fill="none" stroke-linecap="round"/><rect x="132" y="95.5" width="16" height="6" rx="2" fill="#9ED8FF" stroke="#3E8FCC" stroke-width=".8"/><path d="M132 97l-4-12M148 97l4-12" stroke="#3E8FCC" stroke-width=".9"/>`:`<rect x="131" y="85" width="18" height="10" rx="3" fill="#9ED8FF" stroke="#3E8FCC" stroke-width=".8"/><path d="M133 88h14M133 91h14" stroke="#3E8FCC" stroke-width=".7"/><path d="M131 87l-3-4M149 87l3-4" stroke="#3E8FCC" stroke-width=".9"/>`}
  <!-- bedside table + sharps -->
  <rect x="176" y="150" width="30" height="50" rx="3" fill="#F4F6FB" stroke="#CDB8E8" stroke-width="1.5"/><path d="M178 170h26" stroke="#CDB8E8" stroke-width="1.5"/><rect x="187" y="158" width="8" height="3" rx="1.5" fill="#CDB8E8"/>
  ${on('sharps')?`<path d="M184 129l-2-14M190 129l1-16M196 129l3-13M187 129l-4-10" stroke="#8A94A6" stroke-width="1.4"/><rect x="180.5" y="113" width="3" height="4" fill="#FF9F1C"/><rect x="189.5" y="111" width="3" height="4" fill="#22C38E"/><rect x="197.5" y="114" width="3" height="4" fill="#FF9F1C"/><rect x="181.5" y="117" width="3" height="4" fill="#7CC6FF"/>`:""}
  <rect x="180" y="132" width="22" height="18" rx="2" fill="#FFD23F" stroke="#D9780A" stroke-width="1.2"/><rect x="179" y="127.5" width="24" height="5" rx="1.5" fill="#E63946"/><circle cx="191" cy="141" r="3.4" fill="none" stroke="#E63946" stroke-width="1.2"/><path d="M181 136h20" stroke="#D9780A" stroke-width=".8" stroke-dasharray="2 1.5"/>
  <!-- bed -->
  <rect x="220" y="158" width="4" height="38" fill="#8A94A6"/><rect x="328" y="158" width="4" height="38" fill="#8A94A6"/><circle cx="222" cy="198" r="3.5" fill="#24154A"/><circle cx="330" cy="198" r="3.5" fill="#24154A"/>
  <rect x="214" y="152" width="124" height="8" rx="2" fill="#CDB8E8"/><rect x="216" y="140" width="120" height="14" rx="4" fill="#fff" stroke="#E6DDF7"/>
  <rect x="332" y="110" width="9" height="50" rx="3" fill="#A890D8"/>
  <rect x="306" y="129" width="26" height="12" rx="6" fill="#fff" stroke="#E6DDF7"/><circle cx="317" cy="125" r="9" fill="#E8B48A"/><path d="M309 122q8-10 17 0" fill="#5B3A29"/>
  <rect x="216" y="131" width="96" height="18" rx="6" fill="#7CC6FF"/><path d="M226 137h80" stroke="#5FB1F0" stroke-width="2"/>
  <path d="M350 38v162" stroke="#A890D8" stroke-width="2"/><rect x="343" y="42" width="14" height="20" rx="3" fill="#CFF0FF" stroke="#A890D8"/><path d="M350 62q-6 40-30 62" stroke="#CDB8E8" stroke-width="1.2" fill="none"/>
  <!-- urine bag -->
  ${on('urine')?`<path d="M232 150q-6 36 6 60" stroke="#E7D27A" stroke-width="2" fill="none"/><rect x="234" y="208" width="24" height="12" rx="3" fill="#FFE58A" stroke="#D9780A" stroke-width="1.2"/><path d="M238 214h14" stroke="#D9780A" stroke-width=".8"/>`:`<path d="M232 150q2 10 10 14" stroke="#E7D27A" stroke-width="2" fill="none"/><path d="M246 160v4" stroke="#8A94A6" stroke-width="1.5"/><rect x="238" y="164" width="16" height="21" rx="3" fill="#FFE58A" stroke="#D9780A" stroke-width="1.2"/><path d="M241 172h10M241 177h10" stroke="#D9780A" stroke-width=".8"/>`}
  <!-- linen -->
  ${on('linen')?`<path d="M290 216q4-10 14-8 6-6 14 0 8 0 8 8z" fill="#fff" stroke="#CDB8E8" stroke-width="1.2"/><path d="M294 214q8-4 16 0" stroke="#EBE1F8" stroke-width="2" fill="none"/><ellipse cx="311" cy="211" rx="3" ry="2" fill="#E3B07A"/><path d="M300 216q6 5 18 1" stroke="#7CC6FF" stroke-width="2.5" fill="none"/>`:""}
 </svg>`;
}

/* dress-up avatar: base nurse/doctor + PPE layers that switch on */
export function avatarSVG(col:string){
 return `<svg viewBox="0 0 80 150" aria-hidden="true">
  <ellipse cx="40" cy="146" rx="26" ry="4" fill="rgba(0,0,0,.15)"/>
  <rect x="25" y="112" width="12" height="32" rx="5" fill="#3A2560"/><rect x="43" y="112" width="12" height="32" rx="5" fill="#3A2560"/>
  <path d="M18 62q0-12 22-12t22 12v54H18z" fill="#3FB8C9"/><path d="M33 52l7 10 7-10" fill="#2E9AAA"/>
  <rect x="9" y="62" width="11" height="40" rx="5.5" fill="#3FB8C9"/><rect x="60" y="62" width="11" height="40" rx="5.5" fill="#3FB8C9"/>
  <circle cx="14.5" cy="104" r="6" fill="#F2C094"/><circle cx="65.5" cy="104" r="6" fill="#F2C094"/>
  <rect x="35" y="42" width="10" height="10" fill="#E8AE7E"/>
  <circle cx="40" cy="28" r="17" fill="#F2C094"/>
  <path d="M23 26q0-17 17-17t17 17q-4-8-17-8t-17 8z" fill="${col}"/>
  <circle cx="34" cy="29" r="2.2" fill="#24154A"/><circle cx="46" cy="29" r="2.2" fill="#24154A"/>
  <path d="M35 36q5 4 10 0" stroke="#24154A" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="30" cy="34" r="2.6" fill="#FF9AA8" opacity=".6"/><circle cx="50" cy="34" r="2.6" fill="#FF9AA8" opacity=".6"/>
  <g class="lay" data-l="gown"><path d="M16 60q0-10 24-10t24 10v62H16z" fill="#FFD95E" stroke="#C99A0A" stroke-width="1.5"/><rect x="7" y="60" width="14" height="42" rx="7" fill="#FFD95E" stroke="#C99A0A" stroke-width="1.5"/><rect x="59" y="60" width="14" height="42" rx="7" fill="#FFD95E" stroke="#C99A0A" stroke-width="1.5"/><path d="M40 52v68" stroke="#C99A0A" stroke-width="1.5"/></g>
  <g class="lay" data-l="gloves"><circle cx="14.5" cy="104" r="7.5" fill="#8C8CFF" stroke="#4E4EC9" stroke-width="1.5"/><circle cx="65.5" cy="104" r="7.5" fill="#8C8CFF" stroke="#4E4EC9" stroke-width="1.5"/><rect x="8" y="96" width="13" height="6" rx="2" fill="#6F6FE8"/><rect x="59" y="96" width="13" height="6" rx="2" fill="#6F6FE8"/></g>
  <g class="lay" data-l="mask"><path d="M29 32q11-3 22 0v7q-11 7-22 0z" fill="#9ED8FF" stroke="#3E8FCC" stroke-width="1.3"/><path d="M29 33l-6-4M51 33l6-4" stroke="#3E8FCC" stroke-width="1.2"/></g>
  <g class="lay" data-l="n95"><path d="M28 34q0-6 12-6t12 6q0 9-12 9t-12-9z" fill="#F4F6FB" stroke="#7D8AAE" stroke-width="1.4"/><path d="M28 33l-5-6M52 33l5-6" stroke="#3E8FCC" stroke-width="1.6"/><rect x="35" y="33" width="10" height="4" rx="1.5" fill="#3E8FCC"/></g>
  <g class="lay" data-l="eye"><rect x="25" y="24" width="30" height="10" rx="5" fill="#CFF0FF" fill-opacity=".85" stroke="#3E8FCC" stroke-width="1.5"/><path d="M25 28h-3M55 28h3" stroke="#3E8FCC" stroke-width="2"/></g>
 </svg>`;
}

export const MODE_IC:Record<string,string>={
 duel:'<svg viewBox="0 0 48 48"><circle cx="16" cy="16" r="8" fill="#FF9F1C" stroke="#24154A" stroke-width="2.5"/><circle cx="32" cy="16" r="8" fill="#C9A7FF" stroke="#24154A" stroke-width="2.5"/><path d="M4 42c0-9 5-14 12-14s12 5 12 14M20 42c0-9 5-14 12-14s12 5 12 14" fill="none" stroke="#24154A" stroke-width="2.5" stroke-linecap="round"/></svg>',
 solo:'<svg viewBox="0 0 48 48"><circle cx="24" cy="15" r="9" fill="#22C38E" stroke="#24154A" stroke-width="2.5"/><path d="M8 44c0-10 7-16 16-16s16 6 16 16" fill="none" stroke="#24154A" stroke-width="2.5" stroke-linecap="round"/><path d="M36 6l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#FF9F1C" stroke="#24154A" stroke-width="1.5"/></svg>',
 spot:'<svg viewBox="0 0 48 48"><circle cx="20" cy="20" r="12" fill="#CFF0FF" stroke="#24154A" stroke-width="3"/><path d="M29 29l12 12" stroke="#24154A" stroke-width="5" stroke-linecap="round"/><path d="M14 18q2-5 7-6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="23" cy="23" r="3" fill="#FF5D6C"/></svg>'
};
export const HEART=(on:boolean)=>`<svg viewBox="0 0 24 24" class="${on?"":"lost"}"><path d="M12 21s-8-5.3-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.7-8 11-8 11z" fill="#FF5D6C" stroke="#fff" stroke-width="2"/></svg>`;
