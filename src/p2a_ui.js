/* =====================================================================
   UI plumbing, login, shell, dashboard
   ===================================================================== */
const ui={route:'dashboard',tab:{},f:{}};
const ACT={},FORM={},LIVE={},CHG={};
function toast(msg,bad){
  /* a success message that arrives right after a failed save is replaced by the warning: the work is only in memory */
  if(saveTick&&!bad){msg=SAVE_FAIL_MSG+'. ('+msg+')';bad=true}
  $('.toast')?.remove();const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.setAttribute('role','status');t.textContent=msg;const x=document.createElement('button');x.type='button';x.className='tx';x.setAttribute('aria-label','Dismiss message');x.addEventListener('click',()=>t.remove());t.appendChild(x);document.body.appendChild(t);setTimeout(()=>t.remove(),bad?(saveBad?9000:4200):2600)}
/* ---------- focus management for side panels, dialogs and the phone menu ----------
   Opening one moves focus into it, Tab stays inside it, the page behind is inert, and closing puts focus back where it came from. */
const FOCUSABLE='a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]';
const SIG_ATTRS=['id','name','type','role','data-act','data-key','data-id','data-f','data-k','data-change','data-to','data-sub','data-role','data-p','data-live','aria-label'];
const shown=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
const tabbables=root=>[...root.querySelectorAll(FOCUSABLE)].filter(e=>!e.disabled&&e.tabIndex>=0&&!e.closest('[inert],[hidden]')&&shown(e));
const phoneWidth=()=>matchMedia('(max-width:820px)').matches;
const phoneMenuOpen=()=>{const a=$('.app');return !!a&&a.classList.contains('rail-open')&&phoneWidth()};
/* a small description of a control so it can be found again after its container is re-rendered */
function sigOf(el){
  if(!el||!el.getAttribute||el===document.body||el===document.documentElement)return null;
  const s={tag:el.tagName,a:{}};SIG_ATTRS.forEach(k=>{const v=el.getAttribute(k);if(v!==null)s.a[k]=v});
  const fm=el.closest('form[data-form]');if(fm)s.form=fm.dataset.form;
  if(el.tagName==='BUTTON')s.text=el.textContent.trim().slice(0,40);
  return Object.keys(s.a).length||s.text?s:null;
}
function findSig(sig,root){
  if(!sig||!root)return null;
  return [...root.querySelectorAll(sig.tag)].find(c=>{
    for(const k in sig.a)if(c.getAttribute(k)!==sig.a[k])return false;
    if(sig.form&&c.closest('form[data-form]')?.dataset.form!==sig.form)return false;
    if(sig.text!==undefined&&c.textContent.trim().slice(0,40)!==sig.text)return false;
    return true})||null;
}
const softFocus=(t,o)=>{if(!t||!t.isConnected)return false;try{t.focus(o||{preventScroll:true})}catch(e){}return document.activeElement===t};
/* run fn (which re-renders root) and keep keyboard focus on the same control if it still exists afterwards */
function keepFocus(root,fn){
  const ae=document.activeElement,sig=root&&ae&&ae!==root&&root.contains(ae)?sigOf(ae):null;
  const r=fn();
  if(sig){const t=findSig(sig,root);if(t&&t!==document.activeElement)softFocus(t)}
  return r;
}
function focusH1(){const h=$('#page h1');if(!h)return false;h.tabIndex=-1;return softFocus(h)}
let userDriven=false;
['pointerdown','keydown'].forEach(t=>document.addEventListener(t,()=>{userDriven=true},{capture:true,once:true}));
const ZONES=['#dlg','#layer','#nav','.rail-acct','.topbar','#page'];
function openerNow(){
  const a=document.activeElement;if(!a||a===document.body||!a.isConnected||a.closest('.leaving'))return null;
  const zone=ZONES.find(z=>a.closest(z));return{el:a,sig:sigOf(a),zone};
}
function restoreFocus(op){
  if(op){if(softFocus(op.el))return;const z=op.zone&&$(op.zone);if(z&&softFocus(findSig(op.sig,z)))return}
  const m=$('.menu-btn');if(m&&shown(m)&&softFocus(m))return;
  focusH1();
}
const layerOp={drawer:null,dlg:null};let lblN=0;
function labelLayer(el,fallback){
  if(!el)return;const cur=el.getAttribute('aria-labelledby');if((cur&&document.getElementById(cur))||el.getAttribute('aria-label'))return;
  const h=el.querySelector('h1,h2,h3');
  if(h){if(!h.id)h.id='lyr'+(++lblN);el.setAttribute('aria-labelledby',h.id)}else el.setAttribute('aria-label',fallback)
}
const setInert=(el,on)=>{if(!el)return;if(on)el.setAttribute('inert','');else el.removeAttribute('inert')};
function syncInert(){
  const dlg=!!$('#dlg .dialog:not(.leaving)'),dr=!!$('#layer .drawer:not(.leaving)');
  setInert($('#root'),dlg||dr);setInert($('#layer'),dlg);setInert($('.app>main'),phoneMenuOpen());
}
const trapRoot=()=>$('#dlg .dialog:not(.leaving)')||$('#layer .drawer:not(.leaving)')||(phoneMenuOpen()?$('#rail'):null);
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab'||e.defaultPrevented)return;const r=trapRoot();if(!r)return;
  const f=tabbables(r),a=document.activeElement;
  if(!f.length){e.preventDefault();r.focus();return}
  const first=f[0],last=f[f.length-1];
  if(!r.contains(a)||(a===r&&e.shiftKey)){e.preventDefault();(e.shiftKey?last:first).focus()}
  else if(e.shiftKey&&a===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&a===last){e.preventDefault();first.focus()}
});
/* if a panel's content is rebuilt while it is open, keep its label valid and keep focus inside it */
const layerWatch=new MutationObserver(()=>{
  const d=$('#layer .drawer:not(.leaving)'),g=$('#dlg .dialog:not(.leaving)');
  labelLayer(d,'Details');labelLayer(g,'Dialog');
  const top=g||d,a=document.activeElement;
  if(top&&(!a||a===document.body||!a.isConnected))softFocus(top);
});
['#layer','#dlg'].forEach(q=>layerWatch.observe($(q),{childList:true,subtree:true,attributes:true,attributeFilter:['class']}));

function drawer(html,wide,label){
  const lay=$('#layer');if(!lay.querySelector('.drawer:not(.leaving)'))layerOp.drawer=openerNow();
  lay.innerHTML=`<div class="scrim" data-act="close"></div><aside class="drawer ${wide?'wide':''}" role="dialog" aria-modal="true" tabindex="-1" ${label?`aria-label="${E(label)}"`:''}>${html}</aside>`;
  const d=lay.querySelector('.drawer');labelLayer(d,'Details');syncInert();softFocus(d);
}
function leave(el){const c=el.firstElementChild;if(!c)return;if(matchMedia('(prefers-reduced-motion:reduce)').matches){el.innerHTML='';return}
  el.querySelectorAll('.scrim,.drawer,.dialog').forEach(x=>x.classList.add('leaving'));setTimeout(()=>{if(el.querySelector('.leaving'))el.innerHTML=''},190)}
function closeLayer(){const op=layerOp.drawer;layerOp.drawer=null;leave($('#layer'));syncInert();if(op)restoreFocus(op)}
/* hold=true: a result that is shown only once (for example temporary passwords). Escape and a click outside do not close it; only its own button does. */
function dialog(html,label,hold){
  const el=$('#dlg');if(!el.querySelector('.dialog:not(.leaving)'))layerOp.dlg=openerNow();
  el.innerHTML=`<div class="scrim" style="z-index:54" data-act="closeDialog"></div><div class="dialog" role="dialog" aria-modal="true" tabindex="-1" ${hold?'data-hold="1"':''} ${label?`aria-label="${E(label)}"`:''}>${html}</div>`;
  const d=el.querySelector('.dialog');labelLayer(d,'Dialog');syncInert();softFocus(d);
}
function closeDialog(){const op=layerOp.dlg;layerOp.dlg=null;leave($('#dlg'));syncInert();if(op)restoreFocus(op)}
function confirmBox(title,msg,okLabel,onYes,danger){
  dialog(`<h3>${E(title)}</h3><p class="muted" style="margin:0 0 16px">${E(msg)}</p><div class="actions" style="justify-content:flex-end"><button class="btn" data-act="closeDialog">Cancel</button><button class="btn ${danger?'danger':'primary'}" id="dlgOk">${E(okLabel)}</button></div>`);
  $('#dlgOk').onclick=()=>{closeDialog();onYes()};$('#dlgOk').focus();
}
function F(name,label,o={}){
  const{type='text',val='',opts,span,req,ph='',attrs='',id=name,rows=3}=o;let inner;
  if(opts)inner=`<select name="${E(name)}" id="f_${E(id)}" ${req?'required':''} ${attrs}>${opts.map(x=>{const[v,l]=Array.isArray(x)?x:[x,x];return`<option value="${E(v)}" ${String(v)===String(val)?'selected':''}>${E(l)}</option>`}).join('')}</select>`;
  else if(type==='textarea')inner=`<textarea name="${E(name)}" id="f_${E(id)}" rows="${rows}" placeholder="${E(ph)}" ${req?'required':''} ${attrs}>${E(val)}</textarea>`;
  else inner=`<input name="${E(name)}" id="f_${E(id)}" type="${type}" value="${E(val)}" placeholder="${E(ph)}" ${req?'required':''} ${attrs}>`;
  return`<div class="field ${span?'span':''}"><label class="label" for="f_${E(id)}">${E(label)}${req?' *':''}</label>${inner}</div>`;
}
const pill=(t,tone='')=>`<span class="pill ${tone}">${E(t)}</span>`;
function feePill(sm){return (sm.status==='Paid'?pill('Paid','good'):sm.status==='Partial'?pill('Partial','warn'):pill('Not paid','bad'))+(sm.overdue&&sm.status!=='Paid'?' '+pill('Overdue','bad'):'')}
function head(title,sub,actions=''){return`<div class="top"><div><h1>${E(title)}</h1>${sub?`<p>${E(sub)}</p>`:''}</div><div class="actions">${actions}</div></div>`}
function tabsBar(key,items,cur){return`<div class="tabs" role="tablist">${items.map(([id,l])=>`<button role="tab" aria-selected="${cur===id}" data-act="tab" data-key="${E(key)}" data-id="${E(id)}">${E(l)}</button>`).join('')}</div>`}
function csvOf(cols,rows){const q=v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};return [cols.map(q).join(','),...rows.map(r=>r.map(q).join(','))].join('\n')}
function download(name,data,type){const blob=new Blob([data],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
/* CSV opens straight in Excel (UTF-8 BOM keeps the rupee sign and Gujarati names) */
function showCsv(title,cols,rows){download(title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-'+today()+'.csv','\ufeff'+csvOf(cols,rows),'text/csv;charset=utf-8');toast('Excel file (CSV) downloaded')}
ACT.copyCsv=()=>{const t=$('#csvText');t.select();try{navigator.clipboard.writeText(t.value).then(()=>toast('Copied'),()=>toast('Press Ctrl+C to copy the selected text'))}catch(e){toast('Press Ctrl+C to copy the selected text')}};

/* ---------- events ---------- */
const safe=(fn,...a)=>{try{return fn(...a)}catch(err){toast(err.message||String(err),true);(err instanceof TypeError||err instanceof ReferenceError||err instanceof RangeError?console.error:console.warn)(err)}};
const EV_QUIET=new Set(['close','closeDialog','fillLogin','copyCsv','nav','tab','go','evOpen','evMore','railToggle','railOpen','railClose','setJump','theme','skip']);
const evDetail=el=>{if(el.tagName==='TR'||el.tagName==='LI')return el.dataset.id||'';const t=(el.getAttribute('aria-label')||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,60);return t+(el.dataset.id&&!/\d/.test(t)?' · '+el.dataset.id:'')};
/* run a handler, show errors as a toast, and record the outcome in the event log */
function run(cat,label,detail,fn,...a){
  try{const r=fn(...a);if(r&&typeof r.catch==='function')r.catch(err=>{toast(err.message||String(err),true);ev(cat==='Form'?'Form':'Error',label,err.message||String(err),{status:'fail'})});return true}
  catch(err){toast(err.message||String(err),true);(err instanceof TypeError||err instanceof ReferenceError||err instanceof RangeError?console.error:console.warn)(err);ev(cat==='Form'?'Form':'Error',label,err.message||String(err),{status:'fail'});return false}
}
/* Submit-once guard for everything that moves money or cannot be undone. The first submit disables the buttons and any repeat (double-click, Enter held down, a click during the closing animation) is ignored until the action has finished. If the action is refused the buttons come back so the person can fix the form. The server must still enforce this itself (an Active-receipt check in cancelPayment, a "waiting" check on requests). */
const ONCE_FORMS=new Set(['collect','cancelReceipt','addStudent','expense','deposit','notice','sendRemind','restore','upiPay']);
const ONCE_ACTS=new Set(['gwOk','gwFail','resendCred','resetPw']);
function lockOnce(root,on){
  const bs=root.matches&&root.matches('button')?[root]:$$('button:not([type=button])',root);
  bs.forEach(b=>{if(on){b.disabled=true;b.setAttribute('aria-busy','true')}else{b.disabled=false;b.removeAttribute('aria-busy')}});
  if(on)root.dataset.busy='1';else delete root.dataset.busy;
}
function onceRun(root,fn){
  if(root.dataset.busy==='1')return false;
  const ae=document.activeElement;lockOnce(root,true);let ok=false;
  try{ok=fn()}finally{
    if(!ok){lockOnce(root,false);if(ae&&ae.isConnected&&document.activeElement!==ae)softFocus(ae)}
    else setTimeout(()=>{if(root.isConnected&&!root.closest('.leaving'))lockOnce(root,false)},700);
  }
  return ok;
}
/* the 2nd click of a double-click (e.detail>1) is thrown away on every money button, even if the screen was redrawn under the pointer between the two clicks; holding Enter in a money form repeats the key, and the repeats are dropped too */
document.addEventListener('click',e=>{if(e.detail<2)return;const b=e.target.closest&&e.target.closest('button:not([type=button]),input[type=submit]'),f=b&&b.closest('form[data-form]');if(f&&ONCE_FORMS.has(f.dataset.form)){e.preventDefault();e.stopPropagation()}},true);
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||!e.repeat)return;const f=e.target.closest&&e.target.closest('form[data-form]');if(f&&ONCE_FORMS.has(f.dataset.form))e.preventDefault()},true);
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const name=el.dataset.act,f=ACT[name];if(f){e.preventDefault();const quiet=EV_QUIET.has(name);
  if(ONCE_ACTS.has(name)){if(el.dataset.busy==='1'||e.detail>1)return;if(!quiet)ev('Click',humanize(name),evDetail(el));onceRun(el,()=>run('Click',humanize(name),evDetail(el),f,el,e));return}
  if(!quiet)ev('Click',humanize(name),evDetail(el));run('Click',humanize(name),evDetail(el),f,el,e)}});
document.addEventListener('submit',e=>{const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();const name=f.dataset.form,h=FORM[name];if(h){
  /* the admission wizard has five steps: submit (Enter in a field, a script) before the last step moves to the next step, with validation */
  const data=Object.fromEntries(new FormData(f));
  const go=()=>{const ok=run('Form',humanize(name)+' form',name,h,f,data);if(ok&&name!=='login')ev('Form',humanize(name)+' form','Saved');return ok};
  if(ONCE_FORMS.has(name))onceRun(f,go);else go()}});
document.addEventListener('input',e=>{const el=e.target.closest('[data-live]');if(el&&LIVE[el.dataset.live])safe(LIVE[el.dataset.live],el,e)});
document.addEventListener('change',e=>{const el=e.target.closest('[data-change]');if(el&&CHG[el.dataset.change]){if(!/^ev/.test(el.dataset.change))ev('Change',humanize(el.dataset.change),((el.name||el.id||'').replace(/^f_/,'')+' = '+(el.type==='checkbox'?(el.checked?'on':'off'):String(el.value).slice(0,60))).trim());run('Change',humanize(el.dataset.change),'',CHG[el.dataset.change],el,e)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('.toast')?.remove();if($('#dlg').innerHTML){if($('#dlg .dialog[data-hold]:not(.leaving)'))return;closeDialog()}else if($('#layer').innerHTML)closeLayer();else railClose()}});
ACT.close=closeLayer;
ACT.closeDialog=el=>{const d=$('#dlg .dialog[data-hold]:not(.leaving)');if(d&&el&&el.classList&&el.classList.contains('scrim'))return;closeDialog()};
ACT.tab=el=>{ui.tab[el.dataset.key]=el.dataset.id;ev('Page','Opened tab',humanize(el.dataset.key)+' › '+el.textContent.trim().slice(0,40));renderPage();playEnter('swap')};
ACT.go=el=>{closeLayer();go(el.dataset.to)};

/* ---------- tables become cards on phones: label every cell with its column name ---------- */
function labelTables(root=document){
  $$('table',root).forEach(t=>{
    const heads=$$('thead th',t).map(h=>h.textContent.trim());
    $$('tbody tr:not([data-l])',t).forEach(tr=>{
      tr.dataset.l='1';const tds=[...tr.children].filter(c=>c.tagName==='TD'||c.tagName==='TH');let col=0;
      tds.forEach(td=>{
        const span=td.colSpan||1;
        td.dataset.label=span>1?'':(heads[col]||'');col+=span;
        const txt=td.textContent.trim();
        const hasUi=td.querySelector('input,select,textarea,button,svg,img,.bar,.stack');
        if(!txt&&!hasUi)td.dataset.empty='1';
        else if(!txt&&td.querySelector('input[type=checkbox]')&&!td.querySelector('button'))td.dataset.check='1';
        else if(!td.dataset.label&&td.querySelector('button')&&span===1&&!td.querySelector('input,select'))td.dataset.actions='1';
      });
      if(tds.length>=5)tr.dataset.many='1';
      const prim=tr.querySelector('.who')?.closest('td')||tds.find(td=>!td.dataset.check&&!td.dataset.empty&&!td.dataset.actions&&td.dataset.label!==undefined);
      if(prim&&tds.length>1)prim.dataset.primary='1';
    });
  });
}
new MutationObserver(()=>labelTables()).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',()=>labelTables());

/* ---------- motion helpers ---------- */
const calm=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
function playEnter(kind){
  const pg=$('#page');if(!pg||calm())return;
  pg.classList.remove('enter','swap');void pg.offsetWidth;pg.classList.add(kind);clearTimeout(pg._t);pg._t=setTimeout(()=>pg.classList.remove('enter','swap'),1100);
  if(kind==='enter')countUp(pg);
}
function countUp(root){
  $$('.kpi .v',root).forEach(el=>{
    const txt=el.textContent.trim();if(!/^₹?[\d,]+$/.test(txt))return;
    const rupee=txt[0]==='₹';const target=+txt.replace(/[^\d]/g,'');if(!target)return;
    const t0=performance.now(),dur=900,fmt=n=>(rupee?'₹':'')+Math.round(n).toLocaleString('en-IN');
    const step=now=>{const k=Math.min(1,(now-t0)/dur);const e=1-Math.pow(1-k,3);el.textContent=k<1?fmt(target*e):txt;if(k<1)requestAnimationFrame(step)};
    el.textContent=fmt(0);requestAnimationFrame(step);
  });
}
document.addEventListener('pointermove',e=>{const c=e.target.closest&&e.target.closest('.kpi,.acct');if(!c)return;const r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px')},{passive:true});

/* ---------- theme ---------- */
const isDark=()=>{const a=document.documentElement.getAttribute('data-theme');return a?a==='dark':matchMedia('(prefers-color-scheme:dark)').matches};
const IC=d=>`<svg class="ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_MOON=IC('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),ICON_SUN=IC('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),ICON_OUT=IC('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>');
function themeLabels(){const dark=isDark();const t=dark?'Light mode':'Dark mode';$$('[data-act=theme]').forEach(b=>{const l=b.querySelector('.lbl');if(l){if(l.textContent!==t){l.textContent=t;const i=b.querySelector('.ic');if(i)i.outerHTML=dark?ICON_SUN:ICON_MOON}b.setAttribute('aria-label',t)}else if(b.textContent!==t)b.textContent=t})}
function applyTheme(){const t=lsGet(THEME_KEY);if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);else document.documentElement.removeAttribute('data-theme');themeLabels()}
ACT.theme=()=>{const dark=document.documentElement.getAttribute('data-theme')==='dark'||(!document.documentElement.getAttribute('data-theme')&&matchMedia('(prefers-color-scheme:dark)').matches);lsSet(THEME_KEY,dark?'light':'dark');const h=document.documentElement;h.classList.add('theme-anim');applyTheme();clearTimeout(h._t);h._t=setTimeout(()=>h.classList.remove('theme-anim'),450)};

