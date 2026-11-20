/* ---------- date picker in the app's own colours (light and dark) ----------
   The browser's built-in calendar cannot be styled (in dark mode Chrome shows a plain grey one), so every
   <input type="date"> opens this calendar instead. The input itself stays a normal date input: its value
   (YYYY-MM-DD), min / max, required, typing on a laptop and all 'change' handlers work as before.
   - Click / tap the field, or press Enter, Space or Alt+Down on it: the calendar opens.
   - Arrow keys move the day, PageUp / PageDown the month, Enter picks, Esc closes.
   - Month and year can be chosen from lists, so a date of birth is quick to set. */
const DP={el:null,input:null,view:null,focus:null};
const DP_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const dpIso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dpParse=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return null;const[y,m,d]=s.split('-').map(Number);const x=new Date(y,m-1,d);return x.getMonth()===m-1?x:null};
const dpToday=()=>dpParse(typeof today==='function'?today():'')||new Date();
const dpOk=(iso,inp)=>!((inp.min&&iso<inp.min)||(inp.max&&iso>inp.max));
const dpCoarse=()=>{try{return matchMedia('(pointer:coarse)').matches}catch(e){return false}};

function dpOpen(inp){
  if(DP.input===inp&&DP.el)return;dpClose(false);
  const sel=dpParse(inp.value),t=dpToday();
  /* an empty date of birth opens about 22 years back, not on this month */
  let f=sel||(inp.name==='dob'?new Date(t.getFullYear()-22,0,1):t);if(inp.max&&dpIso(f)>inp.max)f=dpParse(inp.max)||f;if(inp.min&&dpIso(f)<inp.min)f=dpParse(inp.min)||f;
  DP.input=inp;DP.focus=f;DP.view=new Date(f.getFullYear(),f.getMonth(),1);
  /* phones: stop the phone's own picker from opening while ours is open */
  if(dpCoarse()&&inp.dataset.dpRo==null){inp.dataset.dpRo=inp.readOnly?'1':'0';inp.readOnly=true}
  const el=document.createElement('div');el.className='dp';el.setAttribute('role','dialog');el.setAttribute('aria-modal','false');
  const lab=inp.id&&document.querySelector(`label[for="${CSS.escape(inp.id)}"]`);el.setAttribute('aria-label','Choose date'+(lab?': '+lab.textContent.replace('*','').trim():''));
  DP.el=el;document.body.appendChild(el);dpDraw(true);dpPlace();
  inp.setAttribute('aria-expanded','true');
}
function dpClose(refocus){
  const inp=DP.input;if(DP.el)DP.el.remove();DP.el=null;DP.input=null;
  if(!inp)return;inp.setAttribute('aria-expanded','false');
  if(inp.dataset.dpRo!=null){inp.readOnly=inp.dataset.dpRo==='1';delete inp.dataset.dpRo}
  if(refocus&&inp.isConnected){try{inp.focus({preventScroll:true})}catch(e){}}
}
function dpPick(iso){
  const inp=DP.input;if(!inp)return;
  if(iso&&!dpOk(iso,inp))return;
  dpClose(true);
  if(inp.value!==iso){inp.value=iso;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}))}
}
function dpDraw(focusDay){
  const inp=DP.input,el=DP.el;if(!inp||!el)return;
  const v=DP.view,y=v.getFullYear(),m=v.getMonth(),sel=inp.value,tIso=dpIso(dpToday()),fIso=dpIso(DP.focus);
  const minY=inp.min?+inp.min.slice(0,4):Math.min(y,dpToday().getFullYear())-80,maxY=inp.max?+inp.max.slice(0,4):Math.max(y,dpToday().getFullYear())+10;
  const years=[];for(let i=maxY;i>=minY;i--)years.push(i);
  const first=(new Date(y,m,1).getDay()+6)%7;/* Monday first */const days=new Date(y,m+1,0).getDate();
  const prevOk=!inp.min||dpIso(new Date(y,m,0))>=inp.min,nextOk=!inp.max||dpIso(new Date(y,m+1,1))<=inp.max;
  let cells='';for(let i=0;i<first;i++)cells+='<span class="dp-pad"></span>';
  for(let d=1;d<=days;d++){const iso=dpIso(new Date(y,m,d)),ok=dpOk(iso,inp);
    cells+=`<button type="button" class="dp-day${iso===sel?' on':''}${iso===tIso?' today':''}" data-iso="${iso}" tabindex="${iso===fIso?0:-1}" ${ok?'':'disabled'} aria-pressed="${iso===sel}" aria-label="${d} ${DP_MONTHS[m]} ${y}${iso===tIso?', today':''}">${d}</button>`}
  const tOk=dpOk(tIso,inp);
  el.innerHTML=`<div class="dp-head"><button type="button" class="dp-nav" data-dp="prev" aria-label="Previous month" ${prevOk?'':'disabled'}>‹</button>
   <select class="dp-sel" data-dp="month" aria-label="Month">${DP_MONTHS.map((n,i)=>`<option value="${i}" ${i===m?'selected':''}>${n}</option>`).join('')}</select>
   <select class="dp-sel" data-dp="year" aria-label="Year">${years.map(n=>`<option ${n===y?'selected':''}>${n}</option>`).join('')}</select>
   <button type="button" class="dp-nav" data-dp="next" aria-label="Next month" ${nextOk?'':'disabled'}>›</button></div>
   <div class="dp-week" aria-hidden="true"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div>
   <div class="dp-grid">${cells}</div>
   <div class="dp-foot">${inp.required?'<span></span>':'<button type="button" class="dp-link" data-dp="clear">Clear</button>'}<button type="button" class="dp-link" data-dp="today" ${tOk?'':'disabled'}>Today</button></div>`;
  if(focusDay){const b=el.querySelector('.dp-day[tabindex="0"]')||el.querySelector('.dp-day:not([disabled])');if(b)b.focus({preventScroll:true})}
}
function dpPlace(){
  const inp=DP.input,el=DP.el;if(!inp||!el)return;
  const r=inp.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight,vw=document.documentElement.clientWidth,vh=window.innerHeight;
  let left=Math.min(Math.max(8,r.left),vw-w-8),top=r.bottom+6;
  if(top+h>vh-8&&r.top-h-6>=8)top=r.top-h-6;else if(top+h>vh-8)top=Math.max(8,vh-h-8);
  el.style.left=Math.max(8,left)+'px';el.style.top=top+'px';
}
function dpMove(days,months){
  const f=DP.focus;let n=months?new Date(f.getFullYear(),f.getMonth()+months,Math.min(f.getDate(),28)):new Date(f.getFullYear(),f.getMonth(),f.getDate()+days);
  const iso=dpIso(n);if(DP.input.min&&iso<DP.input.min)n=dpParse(DP.input.min);if(DP.input.max&&iso>DP.input.max)n=dpParse(DP.input.max);
  DP.focus=n;DP.view=new Date(n.getFullYear(),n.getMonth(),1);dpDraw(true);
}
/* open on click / tap (also blocks the browser's own calendar) */
document.addEventListener('click',e=>{
  const inp=e.target.closest&&e.target.closest('input[type=date]');
  if(inp&&!inp.disabled&&!(inp.readOnly&&inp.dataset.dpRo==null)){e.preventDefault();dpOpen(inp);return}
  if(!DP.el)return;
  const b=e.target.closest('.dp [data-dp], .dp .dp-day');
  if(b&&DP.el.contains(b)){const a=b.dataset.dp;
    if(b.dataset.iso)dpPick(b.dataset.iso);
    else if(a==='prev'||a==='next'){DP.view=new Date(DP.view.getFullYear(),DP.view.getMonth()+(a==='prev'?-1:1),1);DP.focus=new Date(DP.view);dpDraw(false);dpPlace()}
    else if(a==='today')dpPick(dpIso(dpToday()));else if(a==='clear')dpPick('');
    return}
  if(!DP.el.contains(e.target))dpClose(false);
},true);
/* phones: make the field read-only before the tap lands, so the phone's own picker does not open */
document.addEventListener('pointerdown',e=>{const inp=e.target.closest&&e.target.closest('input[type=date]');
  if(inp&&e.pointerType!=='mouse'&&!inp.disabled&&!inp.readOnly){inp.dataset.dpRo='0';inp.readOnly=true;setTimeout(()=>{if(DP.input!==inp&&inp.dataset.dpRo==='0'){inp.readOnly=false;delete inp.dataset.dpRo}},800)}},true);
document.addEventListener('change',e=>{if(!DP.el||!e.target.matches('.dp-sel'))return;e.stopPropagation();
  const y=+DP.el.querySelector('[data-dp=year]').value,m=+DP.el.querySelector('[data-dp=month]').value;
  DP.view=new Date(y,m,1);const d=Math.min(DP.focus.getDate(),new Date(y,m+1,0).getDate());DP.focus=new Date(y,m,d);
  const sel=e.target.dataset.dp;dpDraw(false);dpPlace();const s=DP.el.querySelector(`[data-dp=${sel}]`);if(s)s.focus()},true);
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(t.matches&&t.matches('input[type=date]')&&!DP.el&&(e.key==='Enter'&&!t.form?.dataset.form||e.key===' '||(e.altKey&&e.key==='ArrowDown'))){e.preventDefault();dpOpen(t);return}
  if(!DP.el)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dpClose(true);return}
  if(e.key==='Tab'&&DP.el.contains(t)){const f=[...DP.el.querySelectorAll('button:not([disabled]),select')].filter(x=>!x.classList.contains('dp-day')||x.tabIndex===0);
    const i=f.indexOf(t);if(e.shiftKey&&i===0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}return}
  if(!t.classList||!t.classList.contains('dp-day'))return;
  const k={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[-7,0],ArrowDown:[7,0],PageUp:[0,-1],PageDown:[0,1]}[e.key];
  if(k){e.preventDefault();dpMove(k[0],k[1])}
  else if(e.key==='Home'){e.preventDefault();dpMove(-((DP.focus.getDay()+6)%7),0)}
  else if(e.key==='End'){e.preventDefault();dpMove(6-((DP.focus.getDay()+6)%7),0)}
},true);
document.addEventListener('focusin',e=>{if(!DP.el)return;if(DP.el.contains(e.target)||e.target===DP.input)return;dpClose(false)});
window.addEventListener('resize',()=>dpPlace());
document.addEventListener('scroll',e=>{if(DP.el&&!DP.el.contains(e.target)){if(DP.input&&!DP.input.isConnected)dpClose(false);else dpPlace()}},true);
