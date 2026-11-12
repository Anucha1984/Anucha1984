/* Scene library #2 — flat "dev-explainer" scene types.
   Every type is data-driven from scenes.js and uses the shared PAL (black + one yellow accent).
   Phrase indices (ph) refer to entries of the scene's `subs`; an element appears when its phrase is spoken.
   Layout contract (720x1280): visuals live in y 100–600, the centered caption sits at ~y 640, y>760 stays calm. */

const MONO='font-family:M,K,monospace;';
function typed(txt,lt,t0,cps=16){
  const n=Math.max(0,Math.floor((lt-t0)*cps)), blink=Math.floor(lt*2.2)%2===0;
  return txt.slice(0,n)+((n<txt.length||blink)?`<span style="color:${PAL.acc}">▌</span>`:'');
}
const card=(extra='')=>`background:${PAL.card};border:1px solid ${PAL.line};border-radius:18px;${extra}`;

/* headline — two-line hook (white + yellow) with an optional chat card whose text types in.
   s.h1, s.h2, [s.h1Size, s.h2Size], [s.card={label,text,ph}] */
function headline(s,lt){
  const a=s.h1Size||64, b=s.h2Size||64;
  let h=`<div class="c" style="top:100px;font-size:${a}px;font-weight:800;line-height:1.2;${pop(lt,0)}">${s.h1}</div>
  <div class="c" style="top:${100+a*1.25}px;font-size:${b}px;font-weight:800;line-height:1.2;color:${PAL.acc};${pop(lt,ph(s,1),.3)}">${s.h2}</div>`;
  if(s.card){const t=ph(s,s.card.ph??2);
    h+=`<div class="abs" style="left:100px;top:380px;width:520px;${card('padding:14px 22px;')}${pop(lt,t)}">
      <div style="${MONO}font-size:20px;color:${PAL.dim};text-align:right">${s.card.label||'คุณ'}</div>
      <div style="font-size:32px;font-weight:600;margin-top:6px;min-height:46px">${typed(s.card.text,lt,t+.15,18)}</div></div>`;}
  return h;
}

/* ticker — one huge monospace number that counts up.
   s.kicker, s.tick={ph,value,unit,icon,size,sub,src,dur} */
function ticker(s,lt){
  const T=s.tick, sz=T.size||190, tn=ph(s,T.ph), k=eo((lt-tn)/(T.dur||1.1)), v=Math.round(T.value*k), done=k>=.999;
  let h=`<div class="c" style="top:120px;font-size:30px;font-weight:600;color:${PAL.dim};${rise(lt,0)}">${s.kicker}</div>
  <div class="c" style="${MONO}top:190px;font-size:${sz}px;font-weight:800;line-height:1.1;white-space:nowrap;color:${done?PAL.acc:PAL.txt};${pop(lt,.1)}">${T.icon?`<span style="color:${PAL.acc};font-size:.55em">${T.icon}</span> `:''}${v.toLocaleString('en')}<span style="font-size:.42em;color:${PAL.dim}">${T.unit||''}</span></div>`;
  const y=190+sz*1.1+14;
  if(T.sub)h+=`<div class="c" style="top:${y}px;font-size:32px;font-weight:600;color:${PAL.txt};${rise(lt,ph(s,T.subPh??T.ph+1))}">${T.sub}</div>`;
  if(T.src)h+=`<div class="c" style="top:${y+54}px;font-size:19px;color:${PAL.dim};${rise(lt,ph(s,T.subPh??T.ph+1)+.2)}">ที่มา: ${T.src}</div>`;
  return h;
}

/* bars — compare up to 3 values as horizontal bars.
   s.title, s.rows=[{label,value,ph,hi}] */
function bars(s,lt){
  let h=`<div class="c" style="top:110px;font-size:${s.titleSize||46}px;font-weight:800;${pop(lt,0)}">${s.title}</div>`;
  s.rows.forEach((r,i)=>{const t0=ph(s,r.ph), w=eo((lt-t0)/.8)*r.value, y=250+i*112;
    h+=`<div class="abs" style="left:50px;top:${y}px;width:620px;${rise(lt,t0,.3)}">
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:30px;font-weight:600"><span>${r.label}</span><span style="${MONO}font-size:34px;font-weight:800;color:${r.hi?PAL.acc:PAL.dim}">${Math.round(w)}%</span></div>
      <div style="height:24px;background:${PAL.line};border-radius:12px;margin-top:10px;overflow:hidden"><div style="width:${w}%;height:100%;border-radius:12px;background:${r.hi?PAL.acc:'#5b6573'}"></div></div></div>`});
  if(s.src)h+=`<div class="c" style="top:${250+s.rows.length*112+4}px;font-size:19px;color:${PAL.dim};${rise(lt,ph(s,s.rows[s.rows.length-1].ph)+.4)}">ที่มา: ${s.src}</div>`;
  return h;
}

/* pictogram — N dots, the first `pct/100*N` light up one by one.
   s.kicker, s.pic={ph,pct,total,big,bigPh,src} */
function pictogram(s,lt){
  const P=s.pic, N=P.total||10, on=Math.round(P.pct/100*N), t0=ph(s,P.ph), cols=5, rows=Math.ceil(N/cols);
  let h=`<div class="c" style="top:120px;font-size:34px;font-weight:700;color:${PAL.dim};${rise(lt,0)}">${s.kicker}</div>`;
  for(let i=0;i<N;i++){const r=Math.floor(i/cols), c=i%cols, lit=i<on, ti=lit?t0+i*.13:0;
    h+=`<div class="abs" style="left:${148+c*90}px;top:${200+r*96}px;width:64px;height:64px;border-radius:32px;background:${lit&&lt>=ti?PAL.acc:PAL.line};${lit?pop(lt,ti,.25):'opacity:1;'}"></div>`;}
  const by=200+rows*96+24;
  h+=`<div class="c" style="${MONO}top:${by}px;font-size:84px;font-weight:800;color:${PAL.acc};${pop(lt,ph(s,P.bigPh??P.ph+1))}">${P.big}</div>`;
  if(P.src)h+=`<div class="c" style="top:${by+104}px;font-size:19px;color:${PAL.dim};${rise(lt,ph(s,P.bigPh??P.ph+1)+.2)}">ที่มา: ${P.src}</div>`;
  return h;
}

/* steps — segmented progress bar + a checklist that fills in.
   s.name, s.n, s.items=[{k,t,ph}] */
function steps(s,lt){
  const cur=s.items.filter(it=>lt>=ph(s,it.ph)).length;
  let h=`<div class="abs" style="left:110px;top:110px;width:500px;display:flex;gap:10px">`
    +[...Array(s.n)].map((_,i)=>`<div style="flex:1;height:8px;border-radius:4px;background:${i<cur?PAL.acc:PAL.line}"></div>`).join('')+`</div>
  <div class="c" style="${MONO}top:134px;font-size:24px;color:${PAL.dim};${pop(lt,0)}">${Math.max(cur,1)}/${s.n} · ${s.name}</div>`;
  s.items.forEach((it,i)=>{const t0=ph(s,it.ph);
    h+=`<div class="abs" style="left:70px;top:${210+i*92}px;width:580px;height:78px;${card('padding:0 22px;display:flex;align-items:center;justify-content:space-between;')}${i===cur-1?`border-color:${PAL.acc};`:''}${rise(lt,t0,.3)}">
      <span style="${MONO}font-size:22px;color:${PAL.dim}">${it.k}</span><span style="font-size:30px;font-weight:700;text-align:right">${it.t}</span></div>`});
  return h;
}

/* stack — table of rows that pop in; the row being spoken is outlined.
   s.title, s.rows=[{k,v,ph,c}], [s.src,s.srcPh] */
function stack(s,lt){
  let h=`<div class="c" style="top:100px;font-size:${s.titleSize||46}px;font-weight:800;${pop(lt,0)}">${s.title}</div>`;
  s.rows.forEach((r,i)=>{const t0=ph(s,r.ph??i+1), nxt=s.rows[i+1]?ph(s,s.rows[i+1].ph??i+2):1e9, cur=lt>=t0&&lt<nxt;
    h+=`<div class="abs" style="left:50px;top:${186+i*76}px;width:620px;height:64px;${card('padding:0 22px;display:flex;align-items:center;justify-content:space-between;')}${cur?`border-color:${PAL.acc};`:''}${rise(lt,t0,.3)}">
      <span style="font-size:28px;font-weight:600">${r.k}</span><span style="${MONO}font-size:30px;font-weight:800;color:${r.c||PAL.acc}">${r.v}</span></div>`});
  if(s.src)h+=`<div class="c" style="top:${186+s.rows.length*76+6}px;font-size:19px;color:${PAL.dim};${rise(lt,ph(s,s.srcPh??s.rows.length+1))}">ที่มา: ${s.src}</div>`;
  return h;
}

/* browser — a fake browser window inside a pastel gradient frame (README-style page).
   s.url, s.page={title,tag,lines:[..],ph:[titlePh,tagPh,linesPh,focusPh]} */
function browser(s,lt){
  const P=s.page, [pt,pg,pl,pf]=P.ph||[1,2,3,4], x=(lt-ph(s,pf))/.4;
  let h=`<div class="abs" style="left:50px;top:96px;width:620px;height:494px;border-radius:28px;background:linear-gradient(135deg,#f4b2d6,#aebdff);${pop(lt,0,.4)}"></div>
  <div class="abs" style="left:76px;top:120px;width:568px;height:446px;border-radius:16px;background:#0d1117;overflow:hidden;${pop(lt,.05,.4)}">
    <div style="height:38px;background:#161b22;display:flex;align-items:center;padding:0 14px;${MONO}font-size:15px;color:${PAL.dim}"><span style="flex:1;text-align:center">${s.url}</span></div>
    <div style="padding:34px 32px">
      <div style="${MONO}font-size:44px;font-weight:800;line-height:1.15;${pop(lt,ph(s,pt))}">${P.title}</div>
      <div style="font-size:24px;font-weight:600;color:${PAL.dim};margin-top:14px;${rise(lt,ph(s,pg))}">${P.tag}</div>`
  +(P.lines||[]).map((w,i)=>`<div style="height:14px;width:${w}%;background:#21262d;border-radius:7px;margin-top:${i?12:34}px;${rise(lt,ph(s,pl)+i*.12,.3)}"></div>`).join('')
  +`</div>${x>0?`<div class="abs" style="left:24px;top:${P.focusTop||128}px;width:${P.focusW||440}px;height:${P.focusH||46}px;border:3px solid ${PAL.acc};border-radius:10px;opacity:${cl(x)};transform:scale(${1+(1-cl(x))*.1})"></div>`:''}</div>`;
  return h;
}

/* code — terminal/editor window; lines appear as they are spoken, errors in red.
   s.file, s.lines=[{t,c:'red'|'grn'|'acc'|undefined,ph}] */
function code(s,lt){
  let h=`<div class="abs" style="left:50px;top:110px;width:620px;${card('overflow:hidden;')}${pop(lt,0,.4)}">
    <div style="height:42px;background:#1c222b;display:flex;align-items:center;padding:0 16px;gap:8px"><i style="width:12px;height:12px;border-radius:6px;background:#ff5f57"></i><i style="width:12px;height:12px;border-radius:6px;background:#febc2e"></i><i style="width:12px;height:12px;border-radius:6px;background:#28c840"></i><span style="${MONO}font-size:16px;color:${PAL.dim};margin-left:12px">${s.file||''}</span></div>
    <div style="padding:18px 22px;${MONO}font-size:23px;line-height:1.7;min-height:300px">`;
  (s.lines||[]).forEach(l=>{const t0=ph(s,l.ph), col=l.c==='red'?PAL.red:l.c==='grn'?PAL.grn:l.c==='acc'?PAL.acc:'#c9d1d9';
    h+=`<div style="color:${col};white-space:pre;${l.c==='red'?`background:${hexa('#ff5a5f',.12)};border-radius:6px;padding:0 8px;margin:2px -8px;`:''}${rise(lt,t0,.2)}">${l.t}</div>`});
  return h+`</div></div>`;
}

/* type — closing call-to-action: "comment ___" input box that types, then a share line.
   s.lead, s.key, s.note, s.share, s.keyPh, s.notePh */
function type(s,lt){
  const tk=ph(s,s.keyPh??1), tn=ph(s,s.notePh??2);
  return `<div class="c" style="top:150px;font-size:56px;font-weight:800;${pop(lt,0)}">${s.lead}</div>
  <div class="abs" style="left:80px;top:270px;width:560px;height:130px;border:3px solid ${PAL.acc};border-radius:22px;${card('display:flex;align-items:center;justify-content:center;')}border-color:${PAL.acc};${pop(lt,.15)}">
    <span style="${MONO}font-size:${s.keySize||54}px;font-weight:800;color:${PAL.acc}">${typed(s.key,lt,tk,12)}</span></div>
  <div class="c" style="top:440px;${pop(lt,tn)}"><span style="${MONO}display:inline-block;font-size:28px;color:${PAL.dim};border:1px solid ${PAL.line};border-radius:999px;padding:8px 26px">${s.note}</span></div>
  ${s.share?`<div class="c" style="top:520px;font-size:34px;font-weight:700;${rise(lt,tn+.3)}">${s.share}</div>`:''}`;
}

const SHIFT=46; // keep clear of TikTok's top search bar
[['headline',headline],['ticker',ticker],['bars',bars],['pictogram',pictogram],['steps',steps],['stack',stack],['browser',browser],['code',code],['type',type]]
  .forEach(([k,f])=>{R[k]=(s,lt)=>`<div class="fill" style="transform:translateY(${SHIFT}px)">${f(s,lt)}</div>`});
