/* =====================================================================
   Cash in hand (change 4, 21-11-2026; spec §5.6)
   Money kept in the college from cash fees, one pool per course (B.Ed, M.Ed …).
   In  : the "cash in hand" part of a cash receipt (Collect fee → By Cash).
   Out : expenses paid from it (amount + reason + bill, like any expense), taken from the OLDEST student money first,
         and deposits to the bank, made student by student, so what is left is banked in that student's name.
   Core numbers (cihLeft, cihAllocate …) live in p1_core.js.
   ===================================================================== */
const CASH_TABS=[['lots','Students'],['register','Register'],['spends','Expenses'],['deposits','Bank deposits']];
const CIH_OLD_DAYS=180; /* money older than this shows "deposit it" */
const cashCourses=()=>scopeCourses().filter(c=>mayCourse(c.id));
const isBoss=()=>['Super Admin','Principal'].includes((cur()||{}).role);
const payById=id=>db.payments.find(p=>p.id===id);
const lotWho=p=>{const s=stu(p.studentId);return s?s.name:'—'};
const cashCids=f=>{const cs=cashCourses().map(c=>c.id);return f.course&&cs.includes(f.course)?[f.course]:cs};
function cashSummary(cid){const lots=cihLots(cid);return{in:sum(lots,payCih),spent:sum(cashbox().spends.filter(x=>x.course===cid&&x.status==='ACTIVE'),x=>x.amount),
  dep:sum(cashbox().deposits.filter(x=>x.course===cid),x=>x.total),bal:sum(lots,cihLeft),old:sum(lots.filter(p=>cihLeft(p)>0&&diffDays(today(),p.invoiceDate)>CIH_OLD_DAYS),cihLeft)}}
const cashF=k=>ui.f['cash.'+k]=Object.assign({course:'',q:'',st:k==='lots'?'open':'',from:'',to:'',page:0},ui.f['cash.'+k]||{});
const courseSel=k=>cashCourses().length>1?sel('cash.'+k,'course','Course',[['','All courses'],...cashCourses().map(c=>[c.id,c.name])]):'';
const dateFilters=k=>{const f=cashF(k);return`<label class="dl">From <input type="date" value="${E(f.from)}" data-change="sf" data-scope="cash.${k}" data-k="from"></label><label class="dl">To <input type="date" value="${E(f.to)}" data-change="sf" data-scope="cash.${k}" data-k="to"></label>`};

function viewCash(){
  need('cash.view','cash in hand');const cs=cashCourses();
  let t=ui.tab.cash||'lots';if(!CASH_TABS.some(x=>x[0]===t))t='lots';ui.tab.cash=t;
  const acts=`${can('cash.spend')?'<button class="btn" data-act="cashSpend">Add expense</button>':''}${can('cash.deposit')?'<button class="btn primary" data-act="cashDeposit">Deposit to bank</button>':''}`;
  const cards=cs.map(c=>{const m=cashSummary(c.id);return`<div class="kpi cih-card"><span class="label">${E(c.name)} · cash in hand</span><div class="v">${inr(m.bal)}</div>
    <div class="s">In ${inr(m.in)} · spent ${inr(m.spent)} · to bank ${inr(m.dep)}</div>${m.old?`<div class="s t-warn">${inr(m.old)} is older than 6 months. Deposit it.</div>`:''}</div>`}).join('');
  return head('Cash in hand','Cash kept in the college from cash fees. Expenses use the oldest student money first; what is left goes to the bank in that student\'s name.',acts)+
   `<div class="cih-kpis">${cards}</div>`+tabsBar('cash',CASH_TABS,t)+({lots:cashLots,register:cashRegister,spends:cashSpends,deposits:cashDeps}[t])();
}

/* ---------- 1. students: every cash receipt that kept cash in hand, and what happened to it ---------- */
function cashLotRows(){const f=cashF('lots');const q=f.q.trim().toLowerCase();
  return cashCids(f).flatMap(cid=>cihLots(cid)).filter(p=>(f.st!=='open'||cihLeft(p)>0)&&(!q||[lotWho(p),stu(p.studentId).enrol,p.rc].some(v=>String(v).toLowerCase().includes(q)))).sort(lotOrder)}
function cashLots(){const f=cashF('lots');const l=cashLotRows();const pg=pageRows(f,l);const multi=cashCourses().length>1;
  return`<div class="panel"><h2>Students' cash in hand ${pill(inr(sum(l,cihLeft))+' left','acc')}<button class="btn exp-btn" data-act="expOpen" data-key="cash.lots">Export</button></h2>
   <div class="filters"><input type="search" placeholder="Student, enrolment no. or receipt" aria-label="Search" data-live="sq" data-scope="cash.lots" value="${E(f.q)}">${courseSel('lots')}${sel('cash.lots','st','Show',[['open','Money still left'],['','All, also used up']])}</div>
   <div class="tablewrap"><table><thead><tr><th>Received</th><th>Student</th><th>Receipt</th>${multi?'<th>Course</th>':''}<th class="num">Kept</th><th class="num">Used</th><th class="num">To bank</th><th class="num">Left</th><th></th></tr></thead><tbody>
   ${pg.map(p=>{const s=stu(p.studentId),left=cihLeft(p),age=diffDays(today(),p.invoiceDate);return`<tr><td>${fmtD(p.invoiceDate)}${left&&age>CIH_OLD_DAYS?' '+pill(Math.floor(age/30)+' months','warn'):''}</td>
    <td><button class="lnk" data-act="openStudent" data-id="${E(s.id)}"><b>${E(s.name)}</b></button><small class="muted mono" style="display:block">${E(s.enrol)}</small></td><td class="mono"><button class="lnk mono" data-act="viewReceipt" data-id="${E(p.id)}">${E(p.rc)}</button></td>${multi?`<td>${E(course(s.course).name)}</td>`:''}
    <td class="num amt">${inr(payCih(p))}</td><td class="num amt">${inr(cihUsed(p))}</td><td class="num amt">${inr(cihDeposited(p))}</td><td class="num amt"><b>${left?inr(left):'—'}</b>${left?'':` ${pill(cihDeposited(p)?'Done':'Used up','good')}`}</td>
    <td><button class="btn sm" data-act="cihTrail" data-id="${E(p.id)}">Where it went</button></td></tr>`}).join('')||`<tr><td colspan="${multi?9:8}" class="empty">${f.st==='open'?'No cash in hand left. Turn on "All" to see used-up money.':'No cash in hand yet. Keep cash in hand from Collect fee → By Cash.'}</td></tr>`}</tbody></table></div>${pager('cash.lots',l.length)}
   <p class="note">Expenses are taken from the oldest money first (received date, then entry time). The receipt of a student whose cash in hand is already used or deposited cannot be cancelled or re-dated.</p></div>`}
ACT.cihTrail=el=>{need('cash.view');const p=payById(el.dataset.id);if(!p)throw new Error('Receipt not found');guardStudent(p.studentId);
  const sp=cashbox().spends.filter(x=>x.alloc.some(a=>a.pid===p.id)),dp=cashbox().deposits.filter(d=>d.lines.some(a=>a.pid===p.id));const part=(l,id)=>sum(l.filter(a=>a.pid===id),a=>a.amount);
  dialog(`<h3>${E(lotWho(p))} · cash in hand</h3><p class="muted" style="margin:0 0 10px">Receipt ${E(p.rc)} · ${fmtD(p.invoiceDate)} · kept ${inr(payCih(p))}</p><div class="list">
   ${sp.map(x=>`<div class="li"><div><b>${E(x.ref)} · ${E(x.items.map(i=>i.reason).join('; '))}</b><small>Expense on ${fmtD(x.date)} by ${E(x.by)}${x.status==='CANCELLED'?' · cancelled, money returned':''}</small></div><span class="amt ${x.status==='CANCELLED'?'muted':''}">${inr(part(x.alloc,p.id))}</span></div>`).join('')}
   ${dp.map(d=>`<div class="li"><div><b>${E(d.ref)} · deposited to bank</b><small>${fmtD(d.depositedOn)} · ${E(d.bankRef)} · by ${E(d.by)}</small></div><span class="amt">${inr(part(d.lines,p.id))}</span></div>`).join('')}
   <div class="li"><div><b>Still in cash in hand</b></div><b class="amt">${inr(cihLeft(p))}</b></div></div>
   <div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-act="closeDialog">Close</button></div>`,'Where it went')};

/* ---------- 2. register: a passbook (in, out, running balance) with opening and closing balance ---------- */
function cashEvents(cids){const ev=[];
  db.payments.filter(p=>p.status==='SUCCESS'&&payCih(p)>0&&cids.includes(payCourse(p))).forEach(p=>{const s=stu(p.studentId);ev.push({date:p.invoiceDate,at:p.entryAt||0,kind:'In',ref:p.rc,text:`Fee of ${s.name} (${s.enrol})`,inA:payCih(p),outA:0,course:payCourse(p)})});
  cashbox().spends.filter(x=>x.status==='ACTIVE'&&cids.includes(x.course)).forEach(x=>ev.push({date:x.date,at:x.at,kind:'Expense',ref:x.ref,text:x.items.map(i=>i.reason).join('; '),inA:0,outA:x.amount,course:x.course}));
  cashbox().deposits.filter(d=>cids.includes(d.course)).forEach(d=>ev.push({date:d.depositedOn,at:d.at,kind:'To bank',ref:d.ref,text:`Deposited · ${d.bankRef} · ${d.lines.length} student${d.lines.length===1?'':'s'}`,inA:0,outA:d.total,course:d.course}));
  ev.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.at-b.at);let bal=0;ev.forEach(e=>{bal+=e.inA-e.outA;e.bal=bal});return ev}
function cashRegRows(){const f=cashF('register');const ev=cashEvents(cashCids(f));return ev.filter(e=>(!f.from||e.date>=f.from)&&(!f.to||e.date<=f.to))}
function cashRegister(){const f=cashF('register');const all=cashEvents(cashCids(f));const l=cashRegRows();const pg=pageRows(f,l);const multi=cashCourses().length>1&&!f.course;
  const before=f.from?all.filter(e=>e.date<f.from):[];const open=before.length?before.at(-1).bal:0;const close=l.length?l.at(-1).bal:open;
  return`<div class="panel"><h2>Register<span style="flex:1"></span><button class="btn" data-act="cashRegPrint">Print</button><button class="btn exp-btn" data-act="expOpen" data-key="cash.register">Export</button></h2>
   <div class="filters">${courseSel('register')}${dateFilters('register')}</div>
   <div class="totals four"><div class="tt"><span>Opening balance</span><b>${inr(open)}</b></div><div class="tt m-cash"><span>In</span><b>${inr(sum(l,e=>e.inA))}</b></div><div class="tt m-exp"><span>Out (expense + bank)</span><b>${inr(sum(l,e=>e.outA))}</b></div><div class="tt sum"><span>Closing balance</span><b>${inr(close)}</b></div></div>
   <div class="tablewrap"><table><thead><tr><th>Date</th><th>Type</th><th>Ref</th><th>Details</th>${multi?'<th>Course</th>':''}<th class="num">In</th><th class="num">Out</th><th class="num">Balance</th></tr></thead><tbody>
   ${pg.map(e=>`<tr><td>${fmtD(e.date)}</td><td>${e.kind==='In'?pill('In','good'):e.kind==='Expense'?pill('Expense','warn'):pill('To bank','acc')}</td><td class="mono">${E(e.ref)}</td><td>${E(e.text)}</td>${multi?`<td>${E(course(e.course).name)}</td>`:''}<td class="num amt">${e.inA?inr(e.inA):''}</td><td class="num amt">${e.outA?inr(e.outA):''}</td><td class="num amt"><b>${inr(e.bal)}</b></td></tr>`).join('')||`<tr><td colspan="${multi?8:7}" class="empty">Nothing in this period.</td></tr>`}</tbody></table></div>${pager('cash.register',l.length)}</div>`}
ACT.cashRegPrint=()=>{need('cash.view');const f=cashF('register');const l=cashRegRows();const all=cashEvents(cashCids(f));const before=f.from?all.filter(e=>e.date<f.from):[];const open=before.length?before.at(-1).bal:0;
  printReport('Cash in hand register',`${cashCids(f).map(id=>course(id).name).join(' + ')} · ${f.from?fmtD(f.from):'Start'} to ${f.to?fmtD(f.to):fmtD(today())}`,['Date','Type','Ref','Details','In','Out','Balance'],
   [['','','','Opening balance','','',inr(open)],...l.map(e=>[fmtD(e.date),e.kind,e.ref,e.text,e.inA?inr(e.inA):'',e.outA?inr(e.outA):'',inr(e.bal)])],
   `<p class="pt">Closing balance ${inr(l.length?l.at(-1).bal:open)}</p><p class="pt">Prepared by: ____________________ &nbsp; Checked by: ____________________</p>`);log('Cash in hand register printed','Cash in hand','')};

/* ---------- 3. expenses paid from cash in hand ---------- */
function cashSpendRows(){const f=cashF('spends');const cids=cashCids(f);return cashbox().spends.filter(x=>cids.includes(x.course)&&(!f.st||x.status===f.st)&&(!f.from||x.date>=f.from)&&(!f.to||x.date<=f.to)).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:b.at-a.at)}
const allocText=x=>x.alloc.map(a=>{const p=payById(a.pid);return p?`${lotWho(p)} ${inr(a.amount)}`:inr(a.amount)}).join(', ');
function cashSpends(){const f=cashF('spends');const l=cashSpendRows();const pg=pageRows(f,l);const multi=cashCourses().length>1;
  return`<div class="panel"><h2>Expenses from cash in hand ${pill(inr(sum(l.filter(x=>x.status==='ACTIVE'),x=>x.amount)),'warn')}<button class="btn exp-btn" data-act="expOpen" data-key="cash.spends">Export</button></h2>
   <div class="filters">${courseSel('spends')}${sel('cash.spends','st','Status',[['','All'],['ACTIVE','Active'],['CANCELLED','Cancelled']])}${dateFilters('spends')}</div>
   <div class="tablewrap"><table><thead><tr><th>Ref</th><th>Date</th>${multi?'<th>Course</th>':''}<th>Details</th><th class="num">Amount</th><th>Taken from</th><th>By</th><th></th></tr></thead><tbody>
   ${pg.map(x=>`<tr class="${x.status==='CANCELLED'?'muted':''}"><td class="mono">${E(x.ref)}</td><td>${fmtD(x.date)}</td>${multi?`<td>${E(course(x.course).name)}</td>`:''}
    <td>${x.items.map((i,k)=>`<div>${E(i.reason)} <small class="muted">${inr(i.amount)}</small>${i.doc?` <button class="lnk" data-act="cashDoc" data-id="${E(x.id)}" data-i="${k}">📎 bill</button>`:''}</div>`).join('')}${x.status==='CANCELLED'?`<small class="t-bad">Cancelled: ${E(x.cancelReason)}</small>`:''}</td>
    <td class="num amt">${inr(x.amount)}</td><td><small>${E(allocText(x))}</small></td><td><small>${E(x.by)}</small></td>
    <td>${x.status==='ACTIVE'&&isBoss()?`<button class="btn sm danger" data-act="cashSpendCancel" data-id="${E(x.id)}">Cancel</button>`:x.status==='CANCELLED'?pill('Cancelled','bad'):''}</td></tr>`).join('')||`<tr><td colspan="${multi?8:7}" class="empty">No expenses from cash in hand for these filters.</td></tr>`}</tbody></table></div>${pager('cash.spends',l.length)}
   <p class="note">Only the Principal can cancel an expense; its money goes back to the same students' cash in hand.</p></div>`}
ACT.cashDoc=el=>{need('cash.view');const x=cashbox().spends.find(s=>s.id===el.dataset.id);if(!x||!mayCourse(x.course))throw new Error('Not found');docOpen((x.items[+el.dataset.i]||{}).doc)};

/* add an expense: same lines as everywhere (amount, reason, bill). It shows live which students' money it will use. */
function spendFormHtml(){const cs=cashCourses();const sp=ui.spend;const T=today();
  return`<button class="btn x" data-act="close">Close</button><h2>Expense from cash in hand</h2><p class="muted" style="margin:4px 0 0">Paid from the cash kept in the college. It uses the oldest student money first.</p>
   <form data-form="cashSpend" class="form" style="margin-top:12px">
    ${cs.length>1?F('course','Whose cash in hand',{val:sp.course,opts:cs.map(c=>[c.id,c.name]),req:true,attrs:'data-change="spendCtx"'}):''}
    ${F('date','Expense date',{type:'date',val:sp.date,req:true,attrs:`max="${T}" data-change="spendCtx"`})}
    <fieldset class="fs span expbox"><legend>Expense details</legend><p class="note" style="margin:0 0 8px">One line per bill. Amount and reason are required; a bill photo or PDF is optional.</p>
     <div id="expRows">${expRowsHtml()}</div><div class="actions"><button type="button" class="btn sm" data-act="expAdd">+ Add another line</button></div><div id="expTotal">${spendSumHtml()}</div></fieldset>
    <div class="actions span"><button class="btn primary big">Save expense</button><button type="button" class="btn" data-act="close">Cancel</button></div></form>`}
function spendSumHtml(){const sp=ui.spend||{};const tot=ui.exp?ui.exp.rows.reduce((a,r)=>a+(toPaise(r.amount)||0),0):0;const date=validIso(sp.date)?sp.date:today();const avail=sp.course?cihBalance(sp.course,date):0;
  let plan='';if(tot>0&&tot<=avail){try{plan=cihAllocate(sp.course,date,tot).map(a=>{const p=payById(a.pid);return`<li><span>${E(lotWho(p))} <small class="muted mono">${E(p.rc)} · ${fmtD(p.invoiceDate)}</small></span><b>${inr(a.amount)}</b></li>`}).join('')}catch(e){}}
  return`<div class="exptotal"><span>Total <b>${inr(tot)}</b> · cash in hand on ${fmtD(date)}: <b>${inr(avail)}</b></span>${tot>avail?pill(`${inr(tot-avail)} more than cash in hand`,'bad'):tot?pill('OK','good'):''}</div>
   ${plan?`<div class="alloc"><span class="label">Will be taken from (oldest first)</span><ul>${plan}</ul></div>`:''}`}
ACT.cashSpend=()=>{need('cash.spend','add expenses from cash in hand');const cs=cashCourses();if(!cs.length)throw new Error('No course to manage');
  const want=(ui.f['cash.lots']||{}).course;ui.spend={course:cs.some(c=>c.id===want)?want:cs[0].id,date:today()};ui.exp={sid:'cash',ctx:'spend',rows:[{amount:'',reason:'',doc:null}]};
  drawer(spendFormHtml(),true,'Expense from cash in hand');const i=$('#ea0');if(i)i.focus()};
CHG.spendCtx=el=>{if(el.name==='course')ui.spend.course=el.value;if(el.name==='date')ui.spend.date=el.value;expTot()};
FORM.cashSpend=(f,d)=>{need('cash.spend','add expenses from cash in hand');const cs=cashCourses();const cid=cs.length>1?d.course:cs[0].id;if(!cs.some(c=>c.id===cid))throw new Error('Choose a course you manage');
  if(!validIso(d.date)||d.date>today())throw new Error('Choose the expense date (not in the future)');
  const items=readExpItems(ui.exp&&ui.exp.ctx==='spend'?ui.exp.rows:[]);if(!items.length)throw new Error('Add the expense details');const amount=sum(items,x=>x.amount);
  const alloc=cihAllocate(cid,d.date,amount);const u=cur();
  const x={id:uid('x'),ref:nextCashRef('EXP'),course:cid,date:d.date,items,amount,alloc,by:u.name,byId:u.id,at:Date.now(),status:'ACTIVE'};cashbox().spends.push(x);
  if(!save()){cashbox().spends.pop();db.counters.cashEXP--;save();throw new Error('Not enough browser storage for these documents. Use smaller photos or fewer documents.')}
  log('Cash in hand expense','Cash in hand',x.ref,null,{course:course(cid).name,date:fmtD(x.date),amount:inr(amount),reason:items.map(i=>i.reason).join('; ').slice(0,150),from:alloc.map(a=>{const p=payById(a.pid);return stu(p.studentId).enrol+' '+inr(a.amount)}).join(', ')});
  ui.exp=null;save();closeLayer();ui.tab.cash='spends';renderPage();toast(`${x.ref} saved · ${inr(amount)} from cash in hand`)};
ACT.cashSpendCancel=el=>{if(!isBoss())throw new Error('Only the Principal can cancel an expense');const x=cashbox().spends.find(s=>s.id===el.dataset.id);if(!x||!mayCourse(x.course))throw new Error('Not found');
  dialog(`<h3>Cancel ${E(x.ref)}?</h3><p class="muted" style="margin:0 0 10px">${inr(x.amount)} · ${E(x.items.map(i=>i.reason).join('; '))}. The money goes back to the cash in hand of the same students. The expense stays in the records as cancelled.</p>
   <form data-form="cashSpendCancel" data-id="${E(x.id)}" class="grid" style="gap:10px">${F('reason','Reason (required)',{type:'textarea',req:true,rows:2,attrs:'maxlength="200" minlength="4"'})}
   <div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Keep expense</button><button class="btn danger">Cancel expense</button></div></form>`,'Cancel expense');$('#f_reason').focus()};
FORM.cashSpendCancel=(f,d)=>{if(!isBoss())throw new Error('Only the Principal can cancel an expense');const x=cashbox().spends.find(s=>s.id===f.dataset.id);if(!x||!mayCourse(x.course))throw new Error('Not found');if(x.status!=='ACTIVE')throw new Error('Already cancelled');
  const r=capText(d.reason,'Reason',200);if(r.length<4)throw new Error('Write the reason (at least 4 characters)');
  x.status='CANCELLED';x.cancelReason=r;x.cancelledBy=cur().name;x.cancelledAt=Date.now();log('Cash in hand expense cancelled','Cash in hand',x.ref,{status:'ACTIVE'},{status:'CANCELLED',reason:r});
  save();closeDialog();renderPage();toast(`${x.ref} cancelled · ${inr(x.amount)} back in cash in hand`)};

/* ---------- 4. deposits: money left in cash in hand goes to the bank, student by student ---------- */
function cashDepRows(){const f=cashF('deposits');const cids=cashCids(f);return cashbox().deposits.filter(d=>cids.includes(d.course)&&(!f.from||d.depositedOn>=f.from)&&(!f.to||d.depositedOn<=f.to)).sort((a,b)=>b.at-a.at)}
function cashDeps(){const f=cashF('deposits');const l=cashDepRows();const pg=pageRows(f,l);const multi=cashCourses().length>1;
  return`<div class="panel"><h2>Cash in hand deposited to the bank ${pill(inr(sum(l,d=>d.total)),'acc')}<button class="btn exp-btn" data-act="expOpen" data-key="cash.deposits">Export</button></h2>
   <div class="filters">${courseSel('deposits')}${dateFilters('deposits')}</div>
   <div class="tablewrap"><table><thead><tr><th>Ref</th><th>Deposited on</th>${multi?'<th>Course</th>':''}<th>Students</th><th class="num">Total</th><th>Bank ref</th><th>By</th><th></th></tr></thead><tbody>
   ${pg.map(d=>`<tr><td class="mono">${E(d.ref)}</td><td>${fmtD(d.depositedOn)}</td>${multi?`<td>${E(course(d.course).name)}</td>`:''}<td><small>${E(d.lines.map(a=>{const p=payById(a.pid);return p?`${lotWho(p)} ${inr(a.amount)}`:''}).join(', '))}</small></td><td class="num amt">${inr(d.total)}</td><td>${E(d.bankRef)}</td><td><small>${E(d.by)}</small></td>
    <td><div class="actions nowrap"><button class="btn sm" data-act="cashDepPrint" data-id="${E(d.id)}">Print</button>${isBoss()?`<button class="btn sm" data-act="cashDepUndo" data-id="${E(d.id)}">Undo</button>`:''}</div></td></tr>`).join('')||`<tr><td colspan="${multi?8:7}" class="empty">No cash in hand deposited yet.</td></tr>`}</tbody></table></div>${pager('cash.deposits',l.length)}
   <p class="note">Each line is that student's own money, so the bank deposit counts as that student's fee. Only the Principal can undo a deposit.</p></div>`}
function cdepFormHtml(){const cs=cashCourses();const cid=ui.cdep.course;const lots=cihLots(cid).filter(p=>cihLeft(p)>0);
  return`<button class="btn x" data-act="close">Close</button><h2>Deposit cash in hand to the bank</h2><p class="muted" style="margin:4px 0 0">Each student's money that is left is deposited as that student's fee. Untick a student to keep their money in cash in hand.</p>
   <form data-form="cashDeposit" class="form" style="margin-top:12px">
    ${cs.length>1?F('course','Whose cash in hand',{val:cid,opts:cs.map(c=>[c.id,c.name]),req:true,attrs:'data-change="cdepCourse"'}):''}
    <div class="span tablewrap"><table><thead><tr><th><input type="checkbox" checked data-change="cdepAll" aria-label="Select all students"></th><th>Student</th><th>Receipt</th><th>Received</th><th class="num">Left</th></tr></thead><tbody>
    ${lots.map(p=>`<tr><td><input type="checkbox" name="lot" value="${E(p.id)}" checked data-change="cdepCount" aria-label="Deposit ${E(lotWho(p))}"></td><td>${E(lotWho(p))} <small class="muted mono">${E(stu(p.studentId).enrol)}</small></td><td class="mono">${E(p.rc)}</td><td>${fmtD(p.invoiceDate)}</td><td class="num amt">${inr(cihLeft(p))}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No cash in hand left for this course.</td></tr>'}</tbody></table></div>
    ${lots.length?`<div class="field span"><b id="cdepSum">Selected: ${lots.length} · ${inr(sum(lots,cihLeft))}</b></div>
    ${F('depositedOn','Deposited on',{type:'date',val:today(),req:true,attrs:`max="${today()}"`})}${F('bankRef','Bank slip / reference',{req:true,attrs:'maxlength="60"'})}
    <div class="actions span"><button class="btn primary big">Mark as deposited</button><button type="button" class="btn" data-act="close">Cancel</button></div>`:''}</form>`}
ACT.cashDeposit=()=>{need('cash.deposit','deposit cash in hand');const cs=cashCourses();if(!cs.length)throw new Error('No course to manage');const want=(ui.f['cash.lots']||{}).course;
  ui.cdep={course:cs.some(c=>c.id===want)?want:(cs.find(c=>cihBalance(c.id)>0)||cs[0]).id};drawer(cdepFormHtml(),true,'Deposit cash in hand')};
CHG.cdepCourse=el=>{ui.cdep.course=el.value;drawer(cdepFormHtml(),true,'Deposit cash in hand')};
/* ticked students (d.lots = comma list of receipt ids is accepted too, for tests and a future API) */
const cdepChecked=d=>(d&&d.lots?String(d.lots).split(','):$$('input[name=lot]:checked').map(i=>i.value)).map(payById).filter(Boolean);
CHG.cdepCount=()=>{const l=cdepChecked();const s=$('#cdepSum');if(s)s.textContent=`Selected: ${l.length} · ${inr(sum(l,cihLeft))}`};
CHG.cdepAll=el=>{$$('input[name=lot]').forEach(i=>i.checked=el.checked);CHG.cdepCount()};
FORM.cashDeposit=(f,d)=>{need('cash.deposit','deposit cash in hand');const cs=cashCourses();const cid=cs.length>1?d.course:cs[0].id;if(!cs.some(c=>c.id===cid))throw new Error('Choose a course you manage');
  const l=cdepChecked(d).filter(p=>payCourse(p)===cid&&cihLeft(p)>0);if(!l.length)throw new Error('Tick at least one student');
  if(!validIso(d.depositedOn)||d.depositedOn>today())throw new Error('Choose the deposit date');const late=l.find(p=>p.invoiceDate>d.depositedOn);if(late)throw new Error(`${lotWho(late)}'s money came on ${fmtD(late.invoiceDate)}, after the deposit date`);
  const ref=capText(d.bankRef,'Bank reference',60);if(ref.length<2)throw new Error('Enter the bank slip / reference');
  const lines=l.map(p=>({pid:p.id,amount:cihLeft(p)}));const u=cur();
  const dp={id:uid('cd'),ref:nextCashRef('DEP'),course:cid,depositedOn:d.depositedOn,bankRef:ref,lines,total:sum(lines,a=>a.amount),by:u.name,byId:u.id,at:Date.now()};cashbox().deposits.push(dp);
  log('Cash in hand deposited','Cash in hand',dp.ref,null,{course:course(cid).name,total:inr(dp.total),students:lines.map(a=>stu(payById(a.pid).studentId).enrol+' '+inr(a.amount)).join(', '),bankRef:ref,on:fmtD(dp.depositedOn)});
  save();closeLayer();ui.tab.cash='deposits';renderPage();toast(`${inr(dp.total)} marked as deposited · ${dp.ref}`)};
ACT.cashDepUndo=el=>{if(!isBoss())throw new Error('Only the Principal can undo a deposit');const dp=cashbox().deposits.find(x=>x.id===el.dataset.id);if(!dp||!mayCourse(dp.course))throw new Error('Not found');
  confirmBox('Undo deposit',`${dp.ref}: ${inr(dp.total)} of ${dp.lines.length} student${dp.lines.length===1?'':'s'} goes back to cash in hand.`,'Undo',()=>{cashbox().deposits=cashbox().deposits.filter(x=>x!==dp);log('Cash in hand deposit undone','Cash in hand',dp.ref,{total:inr(dp.total)},null);save();renderPage();toast('Deposit undone')},true)};
ACT.cashDepPrint=el=>{need('cash.view');const dp=cashbox().deposits.find(x=>x.id===el.dataset.id);if(!dp||!mayCourse(dp.course))throw new Error('Not found');
  printReport('Cash in hand deposit '+dp.ref,`${course(dp.course).name} · deposited ${fmtD(dp.depositedOn)} · ${dp.bankRef}`,['Student','Enrolment no','Fee receipt','Received on','Amount'],
   dp.lines.map(a=>{const p=payById(a.pid),s=stu(p.studentId);return[s.name,s.enrol,p.rc,fmtD(p.invoiceDate),inr(a.amount)]}),
   `<p class="pt">Total ${inr(dp.total)} · ${dp.lines.length} students · marked by ${E(dp.by)}</p><p class="pt">Deposited by: ____________________ &nbsp; Checked by: ____________________</p>`)};
