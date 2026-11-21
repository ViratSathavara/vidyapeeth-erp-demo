/* =====================================================================
   Cash (change 4 → 6 → 7, 21-11-2026; spec §5.6). Everything about CASH in one place: Audit → Cash.
   Cheque and UPI go to the bank directly, so the office manages only cash:
     - fee cash still to deposit (the "to bank" part of cash receipts, not yet deposited)
     - cash in hand (part of a cash fee kept in the college, one pool per course)
     - expenses: "expense now" (taken when the fee is collected) and expenses paid later from cash in hand
       (they use the OLDEST student money first, so every rupee stays linked to a student)
     - bank deposits: one deposit (one bank slip, one course = one bank account) can hold fee cash and students' cash in hand
   Total in drawer = fee cash to deposit + cash in hand. The cash book's balance is the same number.
   Core numbers (feeCashLeft, cihLeft, cihAllocate …) live in p1_core.js.
   ===================================================================== */
const CIH_OLD_DAYS=180; /* cash in hand older than this shows "deposit it" */
const cashCourses=()=>scopeCourses().filter(c=>mayCourse(c.id));
const isBoss=()=>['Super Admin','Principal'].includes((cur()||{}).role);
const payById=id=>db.payments.find(p=>p.id===id);
const lotWho=p=>{const s=p&&stu(p.studentId);return s?s.name:'—'};
const allocText=x=>x.alloc.map(a=>{const p=payById(a.pid);return p?`${lotWho(p)} ${inr(a.amount)}`:inr(a.amount)}).join(', ');
/* '' = every course this login manages; a course it does not manage gives nothing (never another course's money) */
const cashIds=cid=>{const cs=cashCourses().map(c=>c.id);return cid?(cs.includes(cid)?[cid]:[]):cs};
/* fee cash waiting for the bank, and students' cash in hand with money left (oldest first) */
const depPending=cid=>{const ids=cashIds(cid);return db.payments.filter(p=>feeCashLeft(p)>0&&ids.includes(payCourse(p))).sort(lotOrder)};
const cihOpen=cid=>cashIds(cid).flatMap(c=>cihLots(c)).filter(p=>cihLeft(p)>0).sort(lotOrder);
function cashNow(cid){const d=sum(depPending(cid),feeCashLeft),h=sum(cihOpen(cid),cihLeft);return{dep:d,cih:h,total:d+h,old:sum(cihOpen(cid).filter(p=>diffDays(today(),p.invoiceDate)>CIH_OLD_DAYS),cihLeft)}}
/* change 11: where every rupee of cash fees went (all time). Collected = deposited + to deposit + expenses + cash in hand, always. */
function cashTotals(cid){const ids=cashIds(cid);const pays=db.payments.filter(p=>p.status==='SUCCESS'&&p.mode==='CASH'&&ids.includes(payCourse(p)));
  const o={n:pays.length,collected:sum(pays,p=>p.amount),expNow:sum(pays,payExp),expCih:sum(pays,cihUsed),depFee:sum(pays.filter(p=>p.depositId),payToBank),depCih:sum(pays,cihDeposited),pending:sum(pays,feeCashLeft),cih:sum(pays,cihLeft)};
  o.exp=o.expNow+o.expCih;o.dep=o.depFee+o.depCih;o.drawer=o.pending+o.cih;return o}
/* the receipts inside one bank deposit (fee cash parts + cash-in-hand lines; old deposits may also hold cheques) */
const depLines=d=>[...db.payments.filter(p=>p.depositId===d.id).map(p=>({p,amount:p.mode==='CASH'?payToBank(p):p.amount,kind:p.mode==='CASH'?'Fee cash':modeName(p.mode)})),
  ...(d.cihLines||[]).map(a=>({p:payById(a.pid),amount:a.amount,kind:'Cash in hand'}))].filter(x=>x.p);
const cashF=()=>ui.f['cash.book']=Object.assign({course:'',batch:'',kind:'',split:'',sub:'',ref:'',q:'',page:0},ui.f['cash.book']||{});

/* ---------- the cash book: every rupee of cash in and out, balance = cash in the office ---------- */
function cashBook(ids){const ev=[];
  db.payments.filter(p=>p.status==='SUCCESS'&&p.mode==='CASH'&&ids.includes(payCourse(p))).forEach(p=>{const s=stu(p.studentId);
    ev.push({key:'in'+p.id,id:p.id,date:p.invoiceDate,at:p.entryAt||0,kind:'Fee cash',ref:p.rc,bats:[batchOf(p)],text:`Fee of ${s.name} (${s.enrol})`+(payCih(p)?` · ${inr(payCih(p))} kept as cash in hand`:''),who:s.name,studs:[s],inA:p.amount,outA:0,course:payCourse(p),by:p.by||'',pay:p});
    if(payExp(p))ev.push({key:'xn'+p.id,id:p.id,date:p.invoiceDate,at:(p.entryAt||0)+1,kind:'Expense',sub:'now',bats:[batchOf(p)],ref:p.rc,text:(p.expenseItems||[]).map(i=>i.reason).join('; '),who:s.name,studs:[s],inA:0,outA:payExp(p),course:payCourse(p),by:p.by||'',pay:p})});
  cashbox().spends.filter(x=>ids.includes(x.course)).forEach(x=>{const off=x.status!=='ACTIVE';
    ev.push({key:'sp'+x.id,id:x.id,date:x.date,at:x.at,kind:'Expense',sub:'cih',bats:[...new Set(x.alloc.map(a=>payById(a.pid)).filter(Boolean).map(batchOf))],ref:x.ref,text:x.items.map(i=>i.reason).join('; '),who:allocText(x),studs:x.alloc.map(a=>stu((payById(a.pid)||{}).studentId)).filter(Boolean),inA:0,outA:off?0:x.amount,shown:x.amount,cancelled:off,course:x.course,by:x.by,rec:x})});
  db.deposits.forEach(d=>{const l=depLines(d).filter(y=>y.p.mode==='CASH'&&ids.includes(payCourse(y.p)));const out=sum(l,y=>y.amount);if(!out)return;
    ev.push({key:'dp'+d.id,id:d.id,date:d.depositedOn,at:d.at||0,kind:'Bank deposit',bats:[...new Set(l.map(y=>batchOf(y.p)))],ref:d.ref||'Deposit',text:`${d.bankRef} · ${l.length} receipt${l.length===1?'':'s'}`,who:[...new Set(l.map(y=>lotWho(y.p)))].join(', '),studs:l.map(y=>stu(y.p.studentId)).filter(Boolean),inA:0,outA:out,course:d.course||payCourse(l[0].p),courses:[...new Set(l.map(y=>payCourse(y.p)))],by:d.by,rec:d})});
  ev.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.at-b.at);let bal=0;ev.forEach(e=>{bal+=e.inA-e.outA;e.bal=bal});return ev}
function cashBookRows(){const f=cashF();const{from,to}=depPeriod();const q=f.q.trim().toLowerCase();if(f.kind!=='Fee cash')f.split='';if(f.kind!=='Expense')f.sub='';
  return cashBook(cashIds(f.course)).filter(e=>(!from||e.date>=from)&&(!to||e.date<=to)&&(!f.kind||e.kind===f.kind)&&(!f.batch||(e.bats||[]).includes(f.batch))&&(!f.split||(e.pay&&splitOk(e.pay,f.split)))&&(!f.sub||e.sub===f.sub)&&(!f.ref||e.studs.some(s=>refOk(s,f.ref)))&&(!q||[e.ref,e.text,e.who].some(v=>String(v).toLowerCase().includes(q))))}

/* ---------- Audit → Cash ---------- */
function auditCash(){
  need('audit.view','the cash report');const cs=cashCourses();const f=cashF();const P=depPeriod();const cid=cs.some(c=>c.id===f.course)?f.course:'';
  const all=cashBook(cashIds(cid));const l=cashBookRows();const pg=pageRows(f,l);const multi=cs.length>1&&!cid;const now=cashNow(cid);
  const inR=all.filter(e=>(!P.from||e.date>=P.from)&&(!P.to||e.date<=P.to));const before=P.from?all.filter(e=>e.date<P.from):[];
  const open=before.length?before.at(-1).bal:0;const close=inR.length?inR.at(-1).bal:open;
  const got=sum(inR,e=>e.inA),spent=sum(inR.filter(e=>e.kind==='Expense'),e=>e.outA),banked=sum(inR.filter(e=>e.kind==='Bank deposit'),e=>e.outA);
  const nDep=depPending(cid).length,nCih=cihOpen(cid).length;const T=cashTotals(cid);
  const pct=v=>T.collected?Math.max(0,v/T.collected*100):0;const seg=(cls,v,l)=>v>0?`<i class="${cls}" style="width:${pct(v).toFixed(2)}%" title="${E(l)}: ${inr(v)} (${Math.round(pct(v))}%)"></i>`:'';
  return`<div class="panel cash-now"><h2>Cash fees · where the money is${multi?` <small class="muted">${E(cs.map(c=>c.name+' '+inr(cashTotals(c.id).collected)).join(' · '))}</small>`:''}</h2>
    <div class="cn-grid five">
     <div class="cn c-total"><span class="label">Cash fees collected</span><b>${inr(T.collected)}</b><small>${T.n} cash receipt${T.n===1?'':'s'} · all time</small></div>
     <div class="cn c-dep"><span class="label">Deposited to bank</span><b>${inr(T.dep)}</b><small>fee cash ${inr(T.depFee)} · cash in hand ${inr(T.depCih)}</small></div>
     <div class="cn c-pend"><span class="label">To deposit</span><b>${inr(T.pending)}</b><small>${nDep} receipt${nDep===1?'':'s'} not yet in the bank</small></div>
     <div class="cn c-exp"><span class="label">Spent as expense</span><b>${inr(T.exp)}</b><small>at collection ${inr(T.expNow)} · from cash in hand ${inr(T.expCih)}</small></div>
     <div class="cn c-cih"><span class="label">Cash in hand (college drawer)</span><b>${inr(T.cih)}</b><small>${nCih?`<button class="lnk" data-act="cihList">${nCih} student${nCih===1?'':'s'}' money</button>`:'none'}${now.old?` · <span class="t-warn">${inr(now.old)} older than 6 months</span>`:''}</small></div></div>
    ${T.collected?`<div class="cn-bar" role="img" aria-label="Of ${inr(T.collected)}: deposited ${inr(T.dep)}, to deposit ${inr(T.pending)}, expenses ${inr(T.exp)}, cash in hand ${inr(T.cih)}">${seg('c-dep',T.dep,'Deposited')}${seg('c-pend',T.pending,'To deposit')}${seg('c-exp',T.exp,'Expenses')}${seg('c-cih',T.cih,'Cash in hand')}</div>`:''}
    <div class="cn-eq">${inr(T.collected)} collected = ${inr(T.dep)} deposited + ${inr(T.pending)} to deposit + ${inr(T.exp)} expenses + ${inr(T.cih)} cash in hand</div>
    <div class="cn-drawer"><span>Cash that should be in the office now (to deposit + cash in hand)</span><b>${inr(now.total)}</b></div>
    <div class="actions">${can('audit.deposit')?'<button class="btn primary" data-act="cashDeposit">Deposit to bank</button>':''}${can('cash.spend')?'<button class="btn" data-act="cashSpend">Add expense</button>':''}<button class="btn" data-act="cashRegPrint">Print cash book</button></div>
    <p class="note" style="margin:0">Only cash is managed here. Cheque and UPI go to the bank directly; they are in Transactions.</p></div>
   <div class="panel"><h2>Cash book</h2>
    <div class="filters"><div class="chips" role="group" aria-label="Period">${[['week','This week'],['lastweek','Last week'],['month','This month'],['lastmonth','Last month'],['all','All'],['custom','Custom']].map(([k,t])=>`<button type="button" class="chip" aria-pressed="${P.f.p===k}" data-act="depP" data-p="${k}">${t}</button>`).join('')}</div>
     ${P.f.p==='custom'?`<label class="dl">From <input type="date" value="${E(P.from)}" data-change="sf" data-scope="dep" data-k="from"></label><label class="dl">To <input type="date" value="${E(P.to)}" data-change="sf" data-scope="dep" data-k="to"></label>`:P.from?`<span class="muted">${fmtD(P.from)} to ${fmtD(P.to)}</span>`:''}</div>
    <div class="filters"><input type="search" placeholder="Student, receipt, ref or reason" aria-label="Search the cash book" data-live="sq" data-scope="cash.book" value="${E(f.q)}">
     ${cs.length>1?sel('cash.book','course','Course',[['','All courses'],...cs.map(c=>[c.id,c.name])]):''}${sel('cash.book','batch','Batch',BATCH_OPTS(cashBook(cashIds(f.course)).flatMap(e=>e.bats||[])))}${sel('cash.book','kind','Entry',[['','All entries'],['Fee cash','Fee cash received'],['Expense','Expenses'],['Bank deposit','Bank deposits']])}${f.kind==='Fee cash'?sel('cash.book','split','Cash split',SPLIT_OPTS):''}${f.kind==='Expense'?sel('cash.book','sub','Expense type',[['','All expenses'],['now','Expense now (at fee collection)'],['cih','From cash in hand']]):''}${sel('cash.book','ref','Admission reference',REF_OPTS())}</div>
    <div class="cb-sum"><span>Opening <b>${inr(open)}</b></span><span>+ Cash received <b>${inr(got)}</b></span><span>− Expenses <b>${inr(spent)}</b></span><span>− To bank <b>${inr(banked)}</b></span><span class="cb-close">= Closing <b>${inr(close)}</b></span></div>
    <div class="actions" style="margin:10px 0"><span class="muted">${l.length} entries</span><span style="flex:1"></span><button class="btn exp-btn" data-act="expOpen" data-key="audit.cash">Export</button></div>
    <div class="tablewrap"><table class="dense"><thead><tr><th>Date</th><th>Entry</th><th>Ref</th><th>Batch</th><th>Details</th>${multi?'<th>Course</th>':''}<th class="num">In</th><th class="num">Out</th><th class="num">Balance</th><th></th></tr></thead><tbody>
    ${pg.map(e=>cashRow(e,multi)).join('')||`<tr><td colspan="${multi?10:9}" class="empty">No cash entries for these filters.</td></tr>`}</tbody></table></div>${pager('cash.book',l.length)}
    <p class="note">Balance = cash in the office after each entry (fee cash to deposit + cash in hand). Expenses paid from cash in hand use the oldest student money first. Only the Principal can cancel an expense or undo a bank deposit.</p></div>`}
function cashRow(e,multi){
  const pillOf=e.kind==='Fee cash'?pill('Fee cash','good'):e.kind==='Bank deposit'?pill('To bank','acc'):e.cancelled?pill('Cancelled','bad'):pill(e.sub==='now'?'Expense now':'Expense','warn');
  const refCell=e.pay?`<button class="lnk mono" data-act="viewReceipt" data-id="${E(e.id)}">${E(e.ref)}</button>`:E(e.ref);
  let det=E(e.text);
  if(e.kind==='Expense'&&e.sub==='now')det+=`<small class="muted" style="display:block">At fee collection · ${E(e.who)}</small>`+((e.pay.expenseItems||[]).some(i=>i.doc)?' '+e.pay.expenseItems.map((i,k)=>i.doc?`<button class="lnk" data-act="expDocOpen" data-id="${E(e.id)}" data-i="${k}">📎 bill</button>`:'').join(' '):'');
  if(e.kind==='Expense'&&e.sub==='cih')det+=`<small class="muted" style="display:block">From cash in hand: ${E(e.who)}</small>`+(e.rec.items.some(i=>i.doc)?' '+e.rec.items.map((i,k)=>i.doc?`<button class="lnk" data-act="cashDoc" data-id="${E(e.id)}" data-i="${k}">📎 bill</button>`:'').join(' '):'')+(e.cancelled?`<small class="t-bad" style="display:block">Cancelled: ${E(e.rec.cancelReason||'')}</small>`:'');
  if(e.kind==='Bank deposit')det+=`<small class="muted" style="display:block">${E(e.who)}</small>`;
  const acts=[e.kind==='Fee cash'&&payCih(e.pay)?`<button class="btn sm" data-act="cihTrail" data-id="${E(e.id)}">Cash in hand</button>`:'',
    e.kind==='Bank deposit'?`<button class="btn sm" data-act="cashDepPrint" data-id="${E(e.id)}">Slip</button>`:'',
    isBoss()&&e.kind==='Bank deposit'?`<button class="btn sm" data-act="cashDepUndo" data-id="${E(e.id)}">Undo</button>`:'',
    isBoss()&&e.sub==='cih'&&!e.cancelled?`<button class="btn sm danger" data-act="cashSpendCancel" data-id="${E(e.id)}">Cancel</button>`:''].join('');
  return`<tr class="${e.cancelled?'muted':''}"><td style="white-space:nowrap">${fmtD(e.date)}</td><td>${pillOf}</td><td class="mono">${refCell}</td><td class="mono">${E((e.bats||[]).join(', ')||'—')}</td><td class="wrap">${det}</td>${multi?`<td>${E((e.courses||[e.course]).map(id=>(course(id)||{}).name||'').join(' + '))}</td>`:''}
   <td class="num amt">${e.inA?inr(e.inA):''}</td><td class="num amt">${e.cancelled?`<s>${inr(e.shown)}</s>`:e.outA?inr(e.outA):''}</td><td class="num amt"><b>${inr(e.bal)}</b></td><td><div class="actions nowrap">${acts}</div></td></tr>`}
ACT.cashRegPrint=()=>{need('audit.view');const f=cashF();const P=depPeriod();const l=cashBookRows();const all=cashBook(cashIds(f.course));const before=P.from?all.filter(e=>e.date<P.from):[];const open=before.length?before.at(-1).bal:0;
  printReport('Cash book',`${cashIds(f.course).map(id=>course(id).name).join(' + ')} · ${P.from?fmtD(P.from):'Start'} to ${P.to?fmtD(P.to):fmtD(today())}${f.kind?' · '+f.kind:''}`,['Date','Entry','Ref','Details','Students','In','Out','Balance'],
   [['','','','Opening balance','','','',inr(open)],...l.map(e=>[fmtD(e.date),e.cancelled?'Expense (cancelled)':e.sub==='now'?'Expense now':e.kind,e.ref,e.text,e.who,e.inA?inr(e.inA):'',e.cancelled?'':e.outA?inr(e.outA):'',inr(e.bal)])],
   `<p class="pt">Cash in the office now: to deposit ${inr(cashNow(f.course).dep)} + cash in hand ${inr(cashNow(f.course).cih)} = ${inr(cashNow(f.course).total)}</p><p class="pt">Cash counted: ____________ &nbsp; Prepared by: ____________________ &nbsp; Checked by: ____________________</p>`);log('Cash book printed','Cash','')};
ACT.cashDoc=el=>{need('audit.view');const x=cashbox().spends.find(s=>s.id===el.dataset.id);if(!x||!mayCourse(x.course))throw new Error('Not found');docOpen((x.items[+el.dataset.i]||{}).doc)};

/* students whose cash in hand still has money, and where each one's money went */
ACT.cihList=()=>{need('audit.view');const f=cashF();const l=cihOpen(f.course);
  dialog(`<h3>Cash in hand · ${inr(sum(l,cihLeft))}</h3><p class="muted" style="margin:0 0 10px">Students whose money is still in the office (oldest first). Expenses use the top ones first.</p><div class="list">
   ${l.map(p=>{const s=stu(p.studentId),age=diffDays(today(),p.invoiceDate);return`<div class="li"><div><b>${E(s.name)}</b> <small class="muted mono">${E(s.enrol)}</small><small>${E(p.rc)} · batch ${E(batchOf(p))} · ${fmtD(p.invoiceDate)} · kept ${inr(payCih(p))}${age>CIH_OLD_DAYS?' · '+Math.floor(age/30)+' months old':''}</small></div><div class="actions nowrap"><b class="amt">${inr(cihLeft(p))}</b><button class="btn sm" data-act="cihTrail" data-id="${E(p.id)}">Where it went</button></div></div>`}).join('')||'<p class="note">No cash in hand.</p>'}</div>
   <div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-act="closeDialog">Close</button></div>`,'Cash in hand')};
ACT.cihTrail=el=>{need('audit.view');const p=payById(el.dataset.id);if(!p)throw new Error('Receipt not found');guardStudent(p.studentId);
  const sp=cashbox().spends.filter(x=>x.alloc.some(a=>a.pid===p.id)),dp=db.deposits.filter(d=>(d.cihLines||[]).some(a=>a.pid===p.id));const part=(l,id)=>sum(l.filter(a=>a.pid===id),a=>a.amount);
  dialog(`<h3>${E(lotWho(p))} · cash in hand</h3><p class="muted" style="margin:0 0 10px">Receipt ${E(p.rc)} · ${fmtD(p.invoiceDate)} · kept ${inr(payCih(p))}</p><div class="list">
   ${sp.map(x=>`<div class="li"><div><b>${E(x.ref)} · ${E(x.items.map(i=>i.reason).join('; '))}</b><small>Expense on ${fmtD(x.date)} by ${E(x.by)}${x.status==='CANCELLED'?' · cancelled, money returned':''}</small></div><span class="amt ${x.status==='CANCELLED'?'muted':''}">${inr(part(x.alloc,p.id))}</span></div>`).join('')}
   ${dp.map(d=>`<div class="li"><div><b>${E(d.ref||'Deposit')} · deposited to the bank</b><small>${fmtD(d.depositedOn)} · ${E(d.bankRef)} · by ${E(d.by)}</small></div><span class="amt">${inr(part(d.cihLines,p.id))}</span></div>`).join('')}
   <div class="li"><div><b>Still in cash in hand</b></div><b class="amt">${inr(cihLeft(p))}</b></div></div>
   <div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-act="closeDialog">Close</button></div>`,'Where it went')};

/* ---------- add an expense from cash in hand: same lines as everywhere (amount, reason, bill); shows which students' money it uses ---------- */
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
  const want=cashF().course;ui.spend={course:cs.some(c=>c.id===want)?want:(cs.find(c=>cihBalance(c.id)>0)||cs[0]).id,date:today()};ui.exp={sid:'cash',ctx:'spend',rows:[{amount:'',reason:'',doc:null}]};
  drawer(spendFormHtml(),true,'Expense from cash in hand');const i=$('#ea0');if(i)i.focus()};
CHG.spendCtx=el=>{if(el.name==='course')ui.spend.course=el.value;if(el.name==='date')ui.spend.date=el.value;expTot()};
FORM.cashSpend=(f,d)=>{need('cash.spend','add expenses from cash in hand');const cs=cashCourses();const cid=cs.length>1?d.course:cs[0].id;if(!cs.some(c=>c.id===cid))throw new Error('Choose a course you manage');
  if(!validIso(d.date)||d.date>today())throw new Error('Choose the expense date (not in the future)');
  const items=readExpItems(ui.exp&&ui.exp.ctx==='spend'?ui.exp.rows:[]);if(!items.length)throw new Error('Add the expense details');const amount=sum(items,x=>x.amount);
  const alloc=cihAllocate(cid,d.date,amount);const u=cur();
  const x={id:uid('x'),ref:nextCashRef('EXP'),course:cid,date:d.date,items,amount,alloc,by:u.name,byId:u.id,at:Date.now(),status:'ACTIVE'};cashbox().spends.push(x);
  if(!save()){cashbox().spends.pop();db.counters.cashEXP--;save();throw new Error('Not enough browser storage for these documents. Use smaller photos or fewer documents.')}
  log('Cash in hand expense','Cash',x.ref,null,{course:course(cid).name,date:fmtD(x.date),amount:inr(amount),reason:items.map(i=>i.reason).join('; ').slice(0,150),from:alloc.map(a=>{const p=payById(a.pid);return stu(p.studentId).enrol+' '+inr(a.amount)}).join(', ')});
  ui.exp=null;save();closeLayer();renderPage();toast(`${x.ref} saved · ${inr(amount)} from cash in hand`)};
ACT.cashSpendCancel=el=>{if(!isBoss())throw new Error('Only the Principal can cancel an expense');const x=cashbox().spends.find(s=>s.id===el.dataset.id);if(!x||!mayCourse(x.course))throw new Error('Not found');
  dialog(`<h3>Cancel ${E(x.ref)}?</h3><p class="muted" style="margin:0 0 10px">${inr(x.amount)} · ${E(x.items.map(i=>i.reason).join('; '))}. The money goes back to the cash in hand of the same students. The expense stays in the records as cancelled.</p>
   <form data-form="cashSpendCancel" data-id="${E(x.id)}" class="grid" style="gap:10px">${F('reason','Reason (required)',{type:'textarea',req:true,rows:2,attrs:'maxlength="200" minlength="4"'})}
   <div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Keep expense</button><button class="btn danger">Cancel expense</button></div></form>`,'Cancel expense');$('#f_reason').focus()};
FORM.cashSpendCancel=(f,d)=>{if(!isBoss())throw new Error('Only the Principal can cancel an expense');const x=cashbox().spends.find(s=>s.id===f.dataset.id);if(!x||!mayCourse(x.course))throw new Error('Not found');if(x.status!=='ACTIVE')throw new Error('Already cancelled');
  const r=capText(d.reason,'Reason',200);if(r.length<4)throw new Error('Write the reason (at least 4 characters)');
  x.status='CANCELLED';x.cancelReason=r;x.cancelledBy=cur().name;x.cancelledAt=Date.now();log('Cash in hand expense cancelled','Cash',x.ref,{status:'ACTIVE'},{status:'CANCELLED',reason:r});
  save();closeDialog();renderPage();toast(`${x.ref} cancelled · ${inr(x.amount)} back in cash in hand`)};

/* ---------- deposit to the bank: one slip = one course (one bank account); fee cash ticked, students' cash in hand optional ---------- */
function cdepFormHtml(){const cs=cashCourses();const cid=ui.cdep.course;const fee=depPending(cid),cih=cihOpen(cid);
  const row=(p,name,amt,of,on)=>`<tr><td><input type="checkbox" name="${name}" value="${E(p.id)}" ${on?'checked':''} data-change="cdepCount" aria-label="Deposit ${E(lotWho(p))} ${E(p.rc)}"></td><td>${E(lotWho(p))} <small class="muted mono">${E(stu(p.studentId).enrol)}</small></td><td class="mono">${E(p.rc)}</td><td class="mono">${E(batchOf(p))}</td><td>${fmtD(p.invoiceDate)}</td><td class="num amt">${inr(amt)}${of?`<small class="muted split-line">of ${inr(of)}</small>`:''}</td></tr>`;
  const head=(g,on,t)=>`<thead><tr><th><input type="checkbox" ${on?'checked':''} data-change="cdepAll" data-g="${g}" aria-label="Select all ${t}"></th><th>Student</th><th>Receipt</th><th>Batch</th><th>Date</th><th class="num">Amount</th></tr></thead>`;
  return`<button class="btn x" data-act="close">Close</button><h2>Deposit cash to the bank</h2><p class="muted" style="margin:4px 0 0">Tick what goes into this bank slip. Fee cash is ticked; tick students' cash in hand too if you deposit it now. Each line stays in that student's name.</p>
   <form data-form="cashDeposit" class="form" style="margin-top:12px">
    ${cs.length>1?F('course','Bank account of',{val:cid,opts:cs.map(c=>[c.id,c.name]),req:true,attrs:'data-change="cdepCourse"'}):''}
    <div class="span"><h3 style="margin:4px 0 6px">Fee cash to deposit · ${fee.length}</h3><div class="tablewrap"><table>${head('feep',true,'fee cash')}<tbody>${fee.map(p=>row(p,'feep',feeCashLeft(p),feeCashLeft(p)!==p.amount?p.amount:0,true)).join('')||'<tr><td colspan="6" class="empty">No fee cash waiting.</td></tr>'}</tbody></table></div></div>
    <div class="span"><h3 style="margin:10px 0 6px">Cash in hand · ${cih.length}</h3><div class="tablewrap"><table>${head('lot',false,'cash in hand')}<tbody>${cih.map(p=>row(p,'lot',cihLeft(p),0,false)).join('')||'<tr><td colspan="6" class="empty">No cash in hand.</td></tr>'}</tbody></table></div></div>
    ${fee.length||cih.length?`<div class="field span"><b id="cdepSum">${cdepSumText(fee,[])}</b></div>
    ${F('depositedOn','Deposited on',{type:'date',val:today(),req:true,attrs:`max="${today()}"`})}${F('bankRef','Bank slip / reference',{req:true,attrs:'maxlength="60"'})}
    <div class="actions span"><button class="btn primary big">Mark as deposited</button><button type="button" class="btn" data-act="close">Cancel</button></div>`:''}</form>`}
const cdepSumText=(fee,cih)=>{const a=sum(fee,feeCashLeft),b=sum(cih,cihLeft);return`Fee cash ${inr(a)} + cash in hand ${inr(b)} = ${inr(a+b)} · ${fee.length+cih.length} line${fee.length+cih.length===1?'':'s'}`};
ACT.cashDeposit=()=>{need('audit.deposit','deposit cash');const cs=cashCourses();if(!cs.length)throw new Error('No course to manage');const want=cashF().course;
  ui.cdep={course:cs.some(c=>c.id===want)?want:(cs.find(c=>cashNow(c.id).total>0)||cs[0]).id};drawer(cdepFormHtml(),true,'Deposit cash to the bank')};
CHG.cdepCourse=el=>{ui.cdep.course=el.value;drawer(cdepFormHtml(),true,'Deposit cash to the bank')};
/* ticked lines (d.fees / d.lots = comma lists of receipt ids are accepted too, for tests and a future API) */
const cdepChecked=d=>{const pick=(k,n)=>(d&&d[k]!==undefined?String(d[k]).split(',').filter(Boolean):$$(`input[name=${n}]:checked`).map(i=>i.value)).map(payById).filter(Boolean);return{fee:pick('fees','feep'),cih:pick('lots','lot')}};
CHG.cdepCount=()=>{const c=cdepChecked();const s=$('#cdepSum');if(s)s.textContent=cdepSumText(c.fee,c.cih)};
CHG.cdepAll=el=>{$$(`input[name=${el.dataset.g}]`).forEach(i=>i.checked=el.checked);CHG.cdepCount()};
FORM.cashDeposit=(f,d)=>{need('audit.deposit','deposit cash');const cs=cashCourses();const cid=cs.length>1?d.course:cs[0].id;if(!cs.some(c=>c.id===cid))throw new Error('Choose a course you manage');
  const c=cdepChecked(d);const fee=c.fee.filter(p=>payCourse(p)===cid&&feeCashLeft(p)>0),cih=c.cih.filter(p=>payCourse(p)===cid&&cihLeft(p)>0);if(!fee.length&&!cih.length)throw new Error('Tick at least one line');
  if(!validIso(d.depositedOn)||d.depositedOn>today())throw new Error('Choose the deposit date');const late=[...fee,...cih].find(p=>p.invoiceDate>d.depositedOn);if(late)throw new Error(`${lotWho(late)}'s money came on ${fmtD(late.invoiceDate)}, after the deposit date`);
  const ref=capText(d.bankRef,'Bank reference',60);if(ref.length<2)throw new Error('Enter the bank slip / reference');
  const cihLines=cih.map(p=>({pid:p.id,amount:cihLeft(p)}));const feeTotal=sum(fee,feeCashLeft),cihTotal=sum(cihLines,a=>a.amount);const dates=[...fee,...cih].map(p=>p.invoiceDate).sort();const u=cur();
  const dp={id:uid('d'),ref:nextCashRef('DEP'),type:'CASH',course:cid,periodFrom:dates[0],periodTo:dates.at(-1),total:feeTotal+cihTotal,feeTotal,cihTotal,count:fee.length+cih.length,depositedOn:d.depositedOn,bankRef:ref,by:u.name,byId:u.id,at:Date.now(),cihLines};
  db.deposits.push(dp);fee.forEach(p=>p.depositId=dp.id);
  log('Cash deposited to the bank','Deposit',dp.ref,null,{course:course(cid).name,total:inr(dp.total),feeCash:inr(feeTotal),cashInHand:inr(cihTotal),lines:dp.count,bankRef:ref,on:fmtD(dp.depositedOn)});
  save();closeLayer();renderPage();toast(`${inr(dp.total)} deposited · ${dp.ref}`)};
ACT.cashDepUndo=el=>{if(!isBoss())throw new Error('Only the Principal can undo a deposit');const dp=db.deposits.find(x=>x.id===el.dataset.id);if(!dp||(dp.course&&!mayCourse(dp.course)))throw new Error('Not found');
  confirmBox('Undo deposit',`${dp.ref||dp.bankRef}: ${inr(dp.total)} goes back to "cash in the office".`,'Undo',()=>{db.payments.forEach(p=>{if(p.depositId===dp.id)p.depositId=''});db.deposits=db.deposits.filter(x=>x!==dp);log('Deposit undone','Deposit',dp.ref||dp.id,{total:inr(dp.total)},null);save();renderPage();toast('Deposit undone')},true)};
ACT.cashDepPrint=el=>{need('audit.view');const dp=db.deposits.find(x=>x.id===el.dataset.id);if(!dp)throw new Error('Not found');const l=depLines(dp);
  printReport('Bank deposit '+(dp.ref||''),`${dp.course?course(dp.course).name+' · ':''}deposited ${fmtD(dp.depositedOn)} · ${dp.bankRef}`,['Student','Enrolment no','Receipt','Received on','Type','Amount'],
   l.map(x=>{const s=stu(x.p.studentId);return[s.name,s.enrol,x.p.rc,fmtD(x.p.invoiceDate),x.kind,inr(x.amount)]}),
   `<p class="pt">Total ${inr(sum(l,x=>x.amount))} · ${l.length} lines · marked by ${E(dp.by)}</p><p class="pt">Deposited by: ____________________ &nbsp; Checked by: ____________________</p>`)};
