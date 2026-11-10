/* =====================================================================
   Dashboard (spec §4): KPI cards, 4 charts, lists. Every card and chart links to the list behind it.
   Charts are plain SVG (no library; works offline and under the strict CSP).
   ===================================================================== */
const live=()=>vStudents().filter(s=>s.status==='ACTIVE');
const okP=()=>vPayments().filter(p=>p.status==='SUCCESS');
const J=o=>E(JSON.stringify(o));
const kpi=(label,v,sub,to,sub2,f,tone)=>`<button class="kpi ${tone||''}" data-act="goto" data-to="${E(to)}" ${sub2?`data-sub="${E(sub2)}"`:''} ${f?`data-f="${J(f)}"`:''}><span class="label">${E(label)}</span><div class="v">${E(v)}</div><div class="s">${E(sub)}</div></button>`;
function monthKeys(n){const T=today();let y=+T.slice(0,4),m=+T.slice(5,7);const out=[];for(let i=0;i<n;i++){out.unshift(`${y}-${pad(m)}`);m--;if(!m){m=12;y--}}return out}
const monthEnd=k=>addDays(isoOf(new Date(+k.slice(0,4),+k.slice(5,7),1)),-1);
function lineChart(keys,vals){
  const W=640,H=220,L=56,R=12,T=14,B=30;const max=Math.max(1,...vals);const nice=Math.pow(10,Math.floor(Math.log10(max)));const top=Math.ceil(max/nice)*nice;
  const x=i=>L+(W-L-R)*(keys.length===1?0.5:i/(keys.length-1)),y=v=>T+(H-T-B)*(1-v/top);
  const pts=vals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const grid=[0,.25,.5,.75,1].map(t=>`<line x1="${L}" x2="${W-R}" y1="${y(top*t)}" y2="${y(top*t)}" class="gl"/><text x="${L-6}" y="${y(top*t)+4}" text-anchor="end" class="tk">${short(top*t)}</text>`).join('');
  return`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Collection per month, last 12 months">${grid}
   <polygon points="${x(0)},${y(0)} ${pts} ${x(vals.length-1)},${y(0)}" class="area"/><polyline points="${pts}" class="ln"/>
   ${vals.map((v,i)=>`<a data-act="goto" data-to="audit" data-sub="tx" data-f="${J({from:keys[i]+'-01',to:monthEnd(keys[i]),modes:['CASH','CHEQUE','UPI'],status:'SUCCESS'})}" tabindex="0" role="link" aria-label="${MON[+keys[i].slice(5)-1]} ${keys[i].slice(0,4)}: ${inr(v)}"><circle cx="${x(i)}" cy="${y(v)}" r="9" class="hit"/><circle cx="${x(i)}" cy="${y(v)}" r="3.5" class="pt"/><title>${MON[+keys[i].slice(5)-1]} ${keys[i].slice(0,4)}: ${inr(v)}</title></a>
   <text x="${x(i)}" y="${H-10}" text-anchor="middle" class="tk">${MON[+keys[i].slice(5)-1]}</text>`).join('')}</svg>`;
}
const short=p=>{const r=p/100;return r>=1e7?(r/1e7).toFixed(1)+'Cr':r>=1e5?(r/1e5).toFixed(r>=1e6?0:1)+'L':r>=1e3?Math.round(r/1e3)+'k':String(Math.round(r))};
function barsH(items){/* items: [label, value, cls, link{to,sub,f}] */
  const max=Math.max(1,...items.map(i=>i[1]));
  return`<div class="hbars">${items.map(([l,v,c,k])=>`<button class="hb" data-act="goto" data-to="${E(k.to)}" ${k.sub?`data-sub="${E(k.sub)}"`:''} data-f="${J(k.f)}"><span class="hl">${E(l)}</span><span class="ht"><i class="${E(c||'')}" style="width:${Math.max(v?2:0,v/max*100)}%"></i></span><b class="hv">${typeof v==='number'&&k.money?inr(v):E(String(v))}</b></button>`).join('')}</div>`;
}
function groupedBars(){
  const W=640,H=230,L=56,R=12,T=14,B=44;const cs=scopeCourses();const SEMS=SEMS_ALL();
  const data=SEMS.map(n=>cs.map(c=>sum(live().filter(s=>s.course===c.id),s=>{const m=semSummary(s,n);return m.started?m.due:0})));
  const max=Math.max(1,...data.flat());const nice=Math.pow(10,Math.floor(Math.log10(max)));const top=Math.ceil(max/nice)*nice;
  const gw=(W-L-R)/SEMS.length,bw=Math.min(36,(gw-24)/cs.length),y=v=>T+(H-T-B)*(1-v/top);
  return`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Outstanding by course and semester">${[0,.5,1].map(t=>`<line x1="${L}" x2="${W-R}" y1="${y(top*t)}" y2="${y(top*t)}" class="gl"/><text x="${L-6}" y="${y(top*t)+4}" text-anchor="end" class="tk">${short(top*t)}</text>`).join('')}
   ${SEMS.map((n,i)=>{const gx=L+gw*i+(gw-bw*cs.length-6)/2;return cs.map((c,j)=>{const v=data[i][j];const bx=gx+j*(bw+6);return`<a data-act="goto" data-to="fees" data-sub="dues" data-f="${J({course:c.id,sem:'',q:'',page:0,sort:'due',dir:-1})}" role="link" tabindex="0" aria-label="${c.name} semester ${n}: ${inr(v)} outstanding"><rect x="${bx}" y="${y(v)}" width="${bw}" height="${Math.max(0,y(0)-y(v))}" rx="3" class="b${j}"/><title>${c.name} Sem ${n}: ${inr(v)}</title></a>`}).join('')+`<text x="${L+gw*i+gw/2}" y="${H-22}" text-anchor="middle" class="tk">Sem ${n}</text>`}).join('')}
   ${cs.map((c,j)=>`<rect x="${L+j*90}" y="${H-12}" width="10" height="10" rx="2" class="b${j}"/><text x="${L+14+j*90}" y="${H-3}" class="tk" text-anchor="start">${E(c.name)}</text>`).join('')}</svg>`;
}
function donut(parts){/* [label,value,cls,link] */
  const tot=sum(parts,p=>p[1])||1;let a=-Math.PI/2;const R=70,r=44,cx=90,cy=90;
  const arcs=parts.map(([l,v,c,k])=>{if(!v)return'';const a2=a+2*Math.PI*v/tot;const big=a2-a>Math.PI?1:0;const P=(ang,rad)=>`${(cx+rad*Math.cos(ang)).toFixed(2)},${(cy+rad*Math.sin(ang)).toFixed(2)}`;
    const d=v>=tot?`M${cx},${cy-R} A${R},${R} 0 1 1 ${cx-.01},${cy-R} L${cx-.01},${cy-r} A${r},${r} 0 1 0 ${cx},${cy-r} Z`:`M${P(a,R)} A${R},${R} 0 ${big} 1 ${P(a2,R)} L${P(a2,r)} A${r},${r} 0 ${big} 0 ${P(a,r)} Z`;a=a2;
    return`<a data-act="goto" data-to="${E(k.to)}" data-sub="${E(k.sub)}" data-f="${J(k.f)}" role="link" tabindex="0" aria-label="${E(l)}: ${inr(v)}"><path d="${d}" class="${E(c)}"/><title>${E(l)}: ${inr(v)} (${Math.round(v/tot*100)}%)</title></a>`}).join('');
  return`<div class="donutwrap"><svg viewBox="0 0 180 180" class="donut" role="img" aria-label="Collection by mode">${arcs}<text x="90" y="86" text-anchor="middle" class="dl1">This year</text><text x="90" y="104" text-anchor="middle" class="dl2">${short(tot)}</text></svg>
   <div class="dleg">${parts.map(([l,v,c,k])=>`<button data-act="goto" data-to="${E(k.to)}" data-sub="${E(k.sub)}" data-f="${J(k.f)}"><i class="${E(c)}"></i><span>${E(l)}</span><b>${inr(v)}</b></button>`).join('')}</div></div>`;
}
function viewDashboard(){
  need('dashboard.view');const u=cur(),T=today(),M=T.slice(0,7);const L=live();
  const allP=okP();const pays=allP.filter(p=>p.mode!=='EXPENSE');const today_=sum(pays.filter(p=>p.invoiceDate===T),p=>p.amount);const month=sum(pays.filter(p=>p.invoiceDate.slice(0,7)===M),p=>p.amount);
  const dl=L.map(s=>({s,sm:feeSum(s)})).filter(x=>x.sm.payable>0).sort((a,b)=>b.sm.payable-a.sm.payable);const outst=sum(dl,x=>x.sm.payable);
  const expPM=allP.filter(p=>p.mode==='EXPENSE'&&p.invoiceDate.slice(0,7)===M);const expM=sum(expPM,p=>p.amount);const sch=L.filter(s=>s.funding==='SCHOLARSHIP').length;
  const clerk=u.role==='Clerk';const mF={from:M+'-01',to:monthEnd(M),modes:['CASH','CHEQUE','UPI'],status:'SUCCESS'};
  const k=[
    !clerk&&kpi('Students',L.length,`${L.filter(s=>s.course==='BED').length} B.Ed · ${L.filter(s=>s.course==='MED').length} M.Ed`,'students',null,{status:'ACTIVE'}),
    kpi('Collected today',inr(today_),fmtD(T),'audit','tx',{from:T,to:T,modes:['CASH','CHEQUE','UPI'],status:'SUCCESS'},'good'),
    kpi('Collected this month',inr(month),MON[+M.slice(5)-1]+' '+M.slice(0,4),'audit','tx',mF),
    kpi('Total outstanding',inr(outst),dl.length+' students · '+dl.filter(x=>x.sm.overdue).length+' overdue','fees','dues',{},'warn'),
    !clerk&&kpi('Scholarship students',sch,'SC / ST · by scholarship','students',null,{fund:'SCHOLARSHIP',status:'ACTIVE'}),
    kpi('Fees used as expense',inr(expM),expPM.length+(expPM.length===1?' receipt':' receipts')+' this month','audit','tx',{from:M+'-01',to:monthEnd(M),modes:['EXPENSE'],status:'SUCCESS'})].filter(Boolean);
  const keys=monthKeys(12);const vals=keys.map(m=>sum(pays.filter(p=>p.invoiceDate.slice(0,7)===m),p=>p.amount));
  const yFrom=keys[0]+'-01';const inY=allP.filter(p=>p.invoiceDate>=yFrom);
  const modeParts=[['Cash',sum(inY.filter(p=>p.mode==='CASH'),p=>p.amount),'d-cash',{to:'audit',sub:'tx',f:{from:yFrom,modes:['CASH']}}],['Cheque',sum(inY.filter(p=>p.mode==='CHEQUE'),p=>p.amount),'d-cheque',{to:'audit',sub:'tx',f:{from:yFrom,modes:['CHEQUE']}}],
    ['UPI',sum(inY.filter(p=>p.mode==='UPI'),p=>p.amount),'d-upi',{to:'audit',sub:'tx',f:{from:yFrom,modes:['UPI']}}],['Expense',sum(inY.filter(p=>p.mode==='EXPENSE'),p=>p.amount),'d-exp',{to:'audit',sub:'tx',f:{from:yFrom,modes:['EXPENSE']}}]];
  const catBars=CATS.map(c=>[c,L.filter(s=>s.category===c).length,'c-cat',{to:'students',f:{cat:c,status:'ACTIVE'}}]);
  const fundBars=[['By Cash',L.filter(s=>s.funding==='CASH').length,'c-cash',{to:'students',f:{fund:'CASH',status:'ACTIVE'}}],['By Scholarship',sch,'c-sch',{to:'students',f:{fund:'SCHOLARSHIP',status:'ACTIVE'}}]];
  const hr=+new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',hour12:false}).format(Date.now());const greet=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
  const acts=(can('students.edit')?'<button class="btn" data-act="newStudent">Add student</button>':'')+(can('fees.collect')?'<button class="btn primary" data-act="nav" data-id="fees">Collect fee</button>':'');
  return head(`${greet}, ${u.name.split(/[ ,]/)[0]}`,`${db.college.short} · ${fmtD(T)}${clerk?' · fee view':''}`,acts)+
  `<div class="kpis k${k.length}">${k.join('')}</div>
  <div class="grid charts"><div class="panel"><h2>Collection per month <small class="muted">last 12 months · tap a point</small></h2>${lineChart(keys,vals)}</div>
   <div class="panel"><h2>Collection by mode <small class="muted">last 12 months</small></h2>${donut(modeParts)}</div>
   ${clerk?'':`<div class="panel"><h2>Outstanding by course × semester</h2>${groupedBars()}</div>
   <div class="panel"><h2>Students by category</h2>${barsH(catBars)}<h3>Cash vs Scholarship</h3>${barsH(fundBars)}</div>`}</div>
  <div class="grid three-col">
   <div class="panel"><h2>Top pending dues <button class="btn sm" data-act="goto" data-to="fees" data-sub="dues">All</button></h2><div class="list">${dl.slice(0,7).map(x=>`<button class="li pick" data-act="openStudent" data-id="${E(x.s.id)}"><div><b>${E(x.s.name)}</b><small>${E(x.s.enrol)} · ${E(classLabel(x.s))}</small></div><span class="amt ${x.sm.overdue?'t-bad':''}">${inr(x.sm.payable)}</span></button>`).join('')||'<p class="note">No dues. Everyone is paid up.</p>'}</div></div>
   <div class="panel"><h2>Latest 10 payments <button class="btn sm" data-act="goto" data-to="fees" data-sub="receipts">All</button></h2><div class="list">${allP.sort((a,b)=>b.entryAt-a.entryAt).slice(0,10).map(p=>`<button class="li pick" data-act="viewReceipt" data-id="${E(p.id)}"><div><b>${E(stu(p.studentId).name)}</b><small>${E(p.rc)} · ${modeName(p.mode)} · ${fmtD(p.invoiceDate)}</small></div><span class="amt">${inr(p.amount)}</span></button>`).join('')||'<p class="note">No payments yet.</p>'}</div></div>
   <div class="panel"><h2>Latest notices ${can('notices.post')?'<button class="btn sm" data-act="nav" data-id="notices">All</button>':''}</h2><div class="list">${db.notices.slice().sort((a,b)=>b.publishAt-a.publishAt).slice(0,5).map(n=>`<div class="li"><div><b>${E(n.title)}</b><small>${fmtT(n.publishAt)} · ${E(audienceLabel(n.audience))}</small></div>${n.isFeeAlert?pill('Fee','warn'):''}</div>`).join('')||'<p class="note">No notices yet.</p>'}</div></div></div>`;
}
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('svg a[data-act]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
