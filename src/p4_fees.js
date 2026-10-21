/* =====================================================================
   Fee collection: collect (online + counter), dues, receipts, concessions, day close, bank matching, setup
   ===================================================================== */
const ONLINE_MODES=['Google Pay (UPI)','Any UPI app','Card / Net banking'],COUNTER_MODES=['Cash','Cheque / DD'];
function tpl(kind,s,x={}){
  const sm=feeSum(s),clg=db.settings.short,link='pay.vidyapeeth.example/'+s.id.toLowerCase();
  if(kind==='reminder')return`Dear ${s.guardian.name}, ${inr(sm.payable)} fee for ${s.name} (${s.id}) is due${sm.nextInst?' on '+fmtD(sm.nextInst.due):''}. Pay online: ${link} - ${clg}`;
  if(kind==='overdue'){const o=sm.inst.find(i=>i.overdue);return`Reminder: ${inr(sm.payable)} for ${s.name} was due on ${fmtD(o?o.due:today())}.${sm.lateDue?' Late fee of '+inr(sm.lateDue)+' applies.':''} Please pay to avoid more late fee: ${link} - ${clg}`}
  if(kind==='receipt')return`Payment received: ${inr(x.amount)} on ${fmtD(x.date)} for ${s.name}. Receipt ${x.rc}. Balance ${inr(x.bal)}. - ${clg}`;
  if(kind==='welcome')return`Welcome to ${db.settings.college}. Admission of ${s.name} is confirmed. Enrolment no. ${s.id}. Parent login: ${s.id.toLowerCase()} / parent123. Student login: stu-${s.id.toLowerCase()} / student123. - ${clg}`;
  if(kind==='link')return`Pay ${inr(x.amount)} fee for ${s.name}: pay.vidyapeeth.example/r/${x.id} - ${clg}`;
  return x.text||'';
}
function sendMsg(kind,s,channel,text){db.messages.unshift({id:uid('m'),ts:Date.now(),channel,to:s.whatsapp||s.phone,studentId:s.id,kind,text:text||tpl(kind,s),status:'Delivered (demo)'})}

function feeTabs(){
  const t=[];if(can('fees.collect'))t.push(['collect','Collect payment']);t.push(['dues','Pending dues'],['receipts','Receipts'],['outbox','Email outbox']);
  if(can('fees.concession.approve')||can('fees.concession.request'))t.push(['approvals','Concessions']);
  if(can('fees.dayclose'))t.push(['dayclose','Day close']);if(can('fees.bankmatch'))t.push(['bank','Bank matching']);if(can('fees.setup'))t.push(['setup','Fee setup']);return t;
}
function viewFees(){
  const tabs=feeTabs();let t=ui.tab.fees;if(!tabs.find(x=>x[0]===t))t=ui.tab.fees=tabs[0][0];
  const body={collect:feeCollect,dues:feeDues,receipts:feeReceipts,outbox:feeOutbox,approvals:feeApprovals,dayclose:feeDayClose,bank:feeBank,setup:feeSetup}[t]();
  const tt=todayTotals();
  return head('Fee Collection','Online and counter payments go through one ledger. Each payment is applied to late fee, installments and fee heads automatically.')+
   `<div class="kpis"><div class="kpi"><span class="label">Online today</span><div class="v">${inr(tt.online)}</div><div class="s">Google Pay / UPI, matched by the gateway</div></div><div class="kpi"><span class="label">Cash today</span><div class="v">${inr(tt.cash)}</div><div class="s">${tt.cheque?inr(tt.cheque)+' by cheque · ':''}${db.closures[today()]?'Day closed':'Day open'}</div></div>
   <div class="kpi"><span class="label">Receipts today</span><div class="v">${tt.count}</div><div class="s">Next no. ${E(db.settings.receiptPrefix)}${db.counters.rc}</div></div><div class="kpi"><span class="label">Outstanding</span><div class="v" style="color:var(--warn)">${inr(sum(dueList(),x=>x.sm.payable))}</div><div class="s">${dueList().length} students</div></div></div>`+tabsBar('fees',tabs,t)+body;
}

/* ----- collect ----- */
function feeCollect(){
  const mode=ui.feeMode||'online';const online=mode==='online';
  const all=db.students.filter(s=>s.status==='Active').sort((a,b)=>a.name.localeCompare(b.name));
  if(!ui.pre||!all.find(s=>s.id===ui.pre))ui.pre=(dueList()[0]?.s||all[0]).id;
  const s=stu(ui.pre);const sm=feeSum(s);const req=ui.req&&db.requests.find(r=>r.id===ui.req&&r.status==='waiting');const last=ui.last&&db.payments.find(p=>p.id===ui.last);
  return`<div class="grid two"><div class="grid" style="align-content:start"><div class="panel"><h2>Collect payment</h2>
   <div class="tabs" role="tablist"><button role="tab" aria-selected="${online}" data-act="feeMode" data-m="online">Online · Google Pay / UPI</button><button role="tab" aria-selected="${!online}" data-act="feeMode" data-m="counter">At the counter</button></div>
   <div class="field" style="margin-bottom:10px"><label class="label" for="feeSearch">Find student</label><input type="search" id="feeSearch" placeholder="Type name or enrolment no." data-live="feeSearch"></div>
   <form data-form="collect" class="form"><div class="field span"><label class="label" for="f_sid">Student</label><select name="sid" id="f_sid" data-change="feeStudent">${all.map(x=>`<option value="${E(x.id)}" ${x.id===s.id?'selected':''}>${E(x.name)} · ${E(x.id)} · due ${inr(feeSum(x).payable)}</option>`).join('')}</select></div>
    <div class="span hl" style="display:grid;gap:4px"><div class="rline" style="padding:0"><span>${E(classLabel(s))}</span>${feePill(sm)}</div>
     <div class="rline" style="padding:0"><span>Fee balance</span><b>${inr(sm.balance)}</b></div>${sm.lateDue>0?`<div class="rline" style="padding:0"><span>Late fee due (cleared first)</span><b style="color:var(--bad)">${inr(sm.lateDue)}</b></div>`:''}
     <div class="rline" style="padding:0"><span>Payable now</span><b>${inr(sm.payable)}</b></div>${sm.nextInst?`<div class="note" style="margin:0">${E(sm.nextInst.label)}: ${inr(sm.nextInst.remaining)} due ${fmtD(sm.nextInst.due)} · ${E(sm.nextInst.state)}</div>`:''}</div>
    ${F('amount','Amount (₹)',{type:'number',val:sm.suggest||'',req:1,attrs:`min="1" max="${sm.payable}"`})}
    ${F('mode',online?'Pay with':'Mode',{opts:online?ONLINE_MODES:COUNTER_MODES})}
    ${online?'':F('ref','Cheque no. / receipt book no.',{span:1,ph:'Optional for cash'})}
    <button class="btn primary span" ${sm.payable<=0?'disabled':''}>${sm.payable<=0?'Nothing due':online?'Create payment request':'Record payment and issue receipt'}</button></form>
   ${db.closures[today()]&&!online?`<p class="note" style="color:var(--bad)">Today is closed for counter payments. The Principal can reopen the day.</p>`:''}</div>
   ${req?`<div class="panel"><h2>Waiting for payment ${pill('Live','warn')}</h2><div class="flow"><div class="qr">${qrSvg(req.id)}</div><div style="flex:1;min-width:200px"><p style="margin:0 0 4px"><b>${inr(req.amount)}</b> from ${E(stu(req.studentId).name)} · ${E(req.mode)}</p>
    <p class="note" style="margin:0">The parent scans the QR or opens the link in Google Pay. When the gateway confirms, the ledger updates by itself. No one marks it paid by hand.</p>
    <div class="actions" style="margin-top:10px"><button class="btn sm" data-act="reqSend" data-id="${req.id}">Send link on WhatsApp</button><button class="btn sm gold" data-act="reqSim" data-id="${req.id}">Demo: payment succeeds</button><button class="btn sm" data-act="reqFail" data-id="${req.id}">Demo: payment fails</button><button class="btn sm danger" data-act="reqCancel" data-id="${req.id}">Cancel request</button></div></div></div></div>`:''}
   ${last?`<div class="panel"><h2>Receipt ${pill('Issued','good')}</h2>${receiptHtml(last)}<div class="actions" style="margin-top:10px"><button class="btn sm" data-act="copyReceipt" data-id="${last.id}">Copy receipt text</button><button class="btn sm" data-act="sendReceipt" data-id="${last.id}">Send on WhatsApp</button><button class="btn sm" data-act="emailReceipt" data-id="${last.id}">Email PDF again</button><button class="btn sm" data-act="dlPdf" data-id="${last.id}">Download PDF</button></div>${mailLine(last)}</div>`:''}</div>
   <div class="grid" style="align-content:start"><div class="panel"><h2>Pending this semester ${pill(String(dueList().length),'warn')}</h2><div class="list" style="max-height:420px;overflow-y:auto">${dueList().map(x=>`<div class="li"><div><b>${E(x.s.name)}</b><small>${E(classLabel(x.s))}${x.sm.overdue?' · overdue':''}</small></div><div class="right"><span class="amt">${inr(x.sm.payable)}</span><br><button class="btn sm" data-act="collectFor" data-id="${E(x.s.id)}">Collect</button></div></div>`).join('')||'<p class="note">Everyone is paid up.</p>'}</div></div>
   <div class="panel"><h2>How this payment is applied</h2><ol style="margin:0;padding-left:18px;color:var(--muted)"><li>Late fee, if any, is cleared first.</li><li>Then the oldest installment is filled.</li><li>Inside it, fee heads fill in the order set in Fee setup.</li><li>Any amount above what is payable is refused.</li></ol></div></div></div>`;
}
ACT.feeMode=el=>{ui.feeMode=el.dataset.m;ui.req=null;renderPage()};
CHG.feeStudent=el=>{ui.pre=el.value;ui.req=null;ui.last=null;renderPage()};
LIVE.feeSearch=el=>{const q=el.value.toLowerCase();const sel=$('#f_sid');let first=null;$$('option',sel).forEach(o=>{const m=!q||o.textContent.toLowerCase().includes(q);o.hidden=!m;o.disabled=!m;if(m&&!first)first=o});if(first&&sel.selectedOptions[0]?.hidden){sel.value=first.value}};
FORM.collect=(f,d)=>{
  if(!can('fees.collect'))throw new Error('You do not have access to collect fees');
  const s=stu(d.sid);const amount=+d.amount;const online=(ui.feeMode||'online')==='online';ui.pre=s.id;
  if(online){const sm=feeSum(s);if(!(amount>0))throw new Error('Enter an amount above ₹0');if(amount>sm.payable)throw new Error(`Amount is more than the payable ${inr(sm.payable)}`);
    const r={id:'rq'+(db.counters.req++),studentId:s.id,amount,mode:d.mode,status:'waiting',created:Date.now(),by:cur().name};db.requests.push(r);ui.req=r.id;ui.last=null;log('Payment request',`${inr(amount)} for ${s.name} via ${d.mode}`);save();renderPage();return}
  const p=recordPayment(s,{amount,mode:d.mode,channel:'counter',ref:d.ref,by:cur().name});ui.last=p.id;log('Payment received',`${p.rc}: ${inr(amount)} from ${s.name} (${d.mode})`);autoReceipt(p);save();toast(`${inr(amount)} received · ${p.rc}`);renderPage();
};
function autoReceipt(p){const s=stu(p.studentId);sendMsg('receipt',s,'WhatsApp',tpl('receipt',s,{amount:p.amount,date:p.date,rc:p.rc,bal:p.balAfter}));queueReceiptMail(p,{trigger:'auto'});notifyPayment(p,s)}
function notifyPayment(p,s){notify('payment',`${p.channel==='online'?'Online payment':'Payment'} received · ${p.rc}`,`${inr(p.amount)} from ${s.name} (${p.mode}). Balance ${inr(p.balAfter)}.`,{sid:s.id,tone:'good',go:{staff:['fees','receipts'],portal:'pfees'},p:{t:`Payment received · ${p.rc}`,x:`${inr(p.amount)} paid by ${p.mode}. Fee balance ${inr(p.balAfter)}. The PDF receipt is emailed to you.`}})}
function notifyPayFail(r){const s=stu(r.studentId);if(!s)return;notify('payfail','Online payment failed',`${inr(r.amount)} for ${s.name} was not completed. No receipt was issued.`,{sid:s.id,tone:'bad',go:{staff:['fees','dues'],portal:'pfees'},p:{t:'Your payment did not go through',x:`${inr(r.amount)} was not completed and you were not charged. You can try again from Fees and Receipts.`}})}
function notifyReminder(s,kind){const k=kind==='overdue'?'overdue':kind==='reminder'?'reminder':'other';notify('reminder',k==='overdue'?'Fee payment overdue':k==='reminder'?'Fee reminder':'Message from the college office',tpl(kind,s).slice(0,170),{sid:s.id,tone:k==='overdue'?'bad':k==='reminder'?'warn':'info',go:{portal:'pfees'},roles:['Parent','Student'].filter(r=>ntOn('reminder',r))})}
ACT.reqSend=el=>{const r=db.requests.find(x=>x.id===el.dataset.id);const s=stu(r.studentId);sendMsg('link',s,'WhatsApp',tpl('link',s,{amount:r.amount,id:r.id}));save();toast('Payment link sent to '+s.whatsapp)};
ACT.reqSim=el=>{
  const r=db.requests.find(x=>x.id===el.dataset.id);const s=stu(r.studentId);
  const p=recordPayment(s,{amount:r.amount,mode:r.mode,channel:'online',ref:'UTR'+Math.floor(Math.random()*9e11+1e11),by:'Gateway (auto)'});
  r.status='paid';r.paymentId=p.id;ui.req=null;ui.last=p.id;log('Online payment confirmed',`${p.rc}: ${inr(p.amount)} from ${s.name}`);autoReceipt(p);save();toast(`Payment confirmed by the gateway · ${p.rc}`);renderPage();
};
ACT.reqFail=el=>{const r=db.requests.find(x=>x.id===el.dataset.id);r.status='failed';ui.req=null;log('Online payment failed',`${inr(r.amount)} for ${stu(r.studentId).name}`);notifyPayFail(r);save();toast('Payment failed. No receipt was issued.',true);renderPage()};
ACT.reqCancel=el=>{const r=db.requests.find(x=>x.id===el.dataset.id);r.status='cancelled';ui.req=null;save();renderPage()};

/* ----- receipts ----- */
function receiptHtml(p){
  const s=stu(p.studentId);const c=course(s.course);const f=s.fee;const cleared=f.feeId===p.feeId?0:0;
  const allocRows=(p.alloc||[]).filter(a=>a.applied>0||a.amount>0);
  return`<div class="receipt">${p.status==='ok'?'<div class="tick"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="14"/><path d="M11 18.5l5 5 9-10"/></svg>Payment received</div>':''}${p.status!=='ok'?`<p class="err" style="margin:0 0 10px">Cancelled on ${fmtD(isoOf(new Date(p.cancel.ts)))} · ${E(p.cancel.reason)}</p>`:''}
  <div class="hd"><div><b>${E(db.settings.college)}</b><br><small class="muted">Fee receipt · ${E(c.name)} Semester ${p.sem}</small></div><div class="right"><span class="mono">${E(p.rc)}</span><br><small class="muted">${fmtD(p.date)}</small></div></div>
  <div class="rline"><span>Student</span><span>${E(s.name)} (${E(s.id)})</span></div><div class="rline"><span>Paid by</span><span>${E(p.mode)}${p.ref?' · '+E(p.ref):''}</span></div>
  ${p.feeAmt>0?`<div class="tablewrap" style="margin:8px 0"><table><thead><tr><th>Fee head</th><th class="num">Paid before</th><th class="num">Applied now</th><th class="num">Balance</th></tr></thead><tbody>${allocRows.map(a=>`<tr><td>${E(a.name)}</td><td class="num">${inr(a.before)}</td><td class="num"><b>${inr(a.applied)}</b></td><td class="num">${inr(a.amount-a.after)}</td></tr>`).join('')}</tbody></table></div>`:''}
  ${p.late>0?`<div class="rline"><span>Late fee cleared</span><span>${inr(p.late)}</span></div>`:''}
  <div class="rline tot"><span>Amount received</span><span>${inr(p.amount)}</span></div><div class="rline"><span>Fee balance after this payment</span><span>${inr(p.balAfter)}</span></div>
  <p style="margin:10px 0 0;display:flex;gap:6px;flex-wrap:wrap">${pill('Ledger updated','good')}${pill('Receipt number auto-issued','good')}${p.channel==='online'?pill('Matched with gateway','good'):p.mode==='Cash'?pill("Added to today's cash drawer",'warn'):''}</p></div>`;
}
function receiptText(p){const s=stu(p.studentId);return`${db.settings.college}\nFee receipt ${p.rc} · ${fmtD(p.date)}\nStudent: ${s.name} (${s.id})\nPaid by: ${p.mode}${p.ref?' · '+p.ref:''}\nAmount: ${inr(p.amount)}${p.late?' (late fee '+inr(p.late)+')':''}\n${(p.alloc||[]).filter(a=>a.applied>0).map(a=>`  ${a.name}: ${inr(a.applied)}`).join('\n')}\nBalance after: ${inr(p.balAfter)}`}
ACT.viewReceipt=el=>{
  const p=db.payments.find(x=>x.id===el.dataset.id);const s=stu(p.studentId);
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Receipt ${E(p.rc)}</h2><div style="margin-top:14px">${receiptHtml(p)}</div>
   <div class="actions" style="margin-top:14px"><button class="btn" data-act="copyReceipt" data-id="${p.id}">Copy receipt text</button><button class="btn" data-act="sendReceipt" data-id="${p.id}">Send on WhatsApp</button><button class="btn" data-act="emailReceipt" data-id="${p.id}">Email PDF</button><button class="btn" data-act="dlPdf" data-id="${p.id}">Download PDF</button>
   ${p.status==='ok'&&can('fees.reverse')&&p.feeId===s.fee.id?`<button class="btn danger" data-act="cancelReceipt" data-id="${p.id}">Cancel receipt</button>`:''}<button class="btn" data-act="openStudent" data-id="${E(s.id)}">Open student</button></div>${mailLine(p)}
   <p class="note">Printing is disabled in this preview. Use Download PDF, or copy the text.</p>`);
};
ACT.copyReceipt=el=>{const p=db.payments.find(x=>x.id===el.dataset.id);try{navigator.clipboard.writeText(receiptText(p)).then(()=>toast('Receipt text copied'),()=>toast('Copy blocked in this preview',true))}catch(e){toast('Copy blocked in this preview',true)}};
ACT.sendReceipt=el=>{const p=db.payments.find(x=>x.id===el.dataset.id);autoReceipt(p);save();toast('Receipt sent on WhatsApp (demo)')};
ACT.cancelReceipt=el=>{
  const p=db.payments.find(x=>x.id===el.dataset.id);
  dialog(`<h3>Cancel receipt ${E(p.rc)}</h3><form data-form="cancelReceipt" data-id="${p.id}" class="grid" style="gap:12px"><p class="muted" style="margin:0">${inr(p.amount)} will be reversed and the balance restored. The receipt number stays in the register as cancelled.</p>${F('reason','Reason',{req:1,ph:'For example: wrong student, duplicate entry'})}${F('refund','Money returned by',{opts:['Cash','Bank transfer','Original payment method']})}<div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Keep receipt</button><button class="btn danger">Cancel receipt</button></div></form>`);
};
FORM.cancelReceipt=(f,d)=>{
  if(!can('fees.reverse'))throw new Error('You do not have access to cancel receipts');
  const p=db.payments.find(x=>x.id===f.dataset.id);cancelPayment(p,d.reason,d.refund);log('Receipt cancelled',`${p.rc} (${inr(p.amount)}): ${d.reason}`);{const cs=stu(p.studentId);notify('cancel',`Receipt ${p.rc} cancelled`,`${inr(p.amount)} for ${cs.name}. Reason: ${d.reason}`,{sid:cs.id,tone:'warn',go:{staff:['fees','receipts'],portal:'pfees'},p:{t:`Receipt ${p.rc} was cancelled`,x:`${inr(p.amount)} was reversed. Reason: ${d.reason}. Contact the accounts office if this is unexpected.`}})}save();closeDialog();closeLayer();toast(p.rc+' cancelled');renderPage();
};
function feeReceipts(){
  const f=ui.f.receipts=ui.f.receipts||{from:addDays(today(),-30),to:today(),mode:'',status:''};
  const list=db.payments.filter(p=>p.date>=f.from&&p.date<=f.to&&(!f.mode||p.mode===f.mode)&&(!f.status||p.status===f.status)).sort((a,b)=>b.ts-a.ts);
  const ok=list.filter(p=>p.status==='ok');
  return`<div class="panel"><div class="filters"><div class="field"><label class="label" for="rf">From</label><input type="date" id="rf" value="${f.from}" data-change="recF" data-k="from"></div><div class="field"><label class="label" for="rt">To</label><input type="date" id="rt" value="${f.to}" data-change="recF" data-k="to"></div>
   <div class="field"><label class="label" for="rm">Mode</label><select id="rm" data-change="recF" data-k="mode"><option value="">All modes</option>${ONLINE_MODES.concat(COUNTER_MODES,['Imported']).map(m=>`<option ${f.mode===m?'selected':''}>${m}</option>`).join('')}</select></div>
   <div class="field"><label class="label" for="rs">Status</label><select id="rs" data-change="recF" data-k="status"><option value="">All</option><option value="ok" ${f.status==='ok'?'selected':''}>Valid</option><option value="cancelled" ${f.status==='cancelled'?'selected':''}>Cancelled</option></select></div>
   <span style="flex:1"></span><span class="pill acc">${ok.length} receipts · ${inr(sum(ok,p=>p.amount))}</span></div>
   <div class="tablewrap"><table><thead><tr><th>Receipt</th><th>Date</th><th>Student</th><th>Mode</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>${list.map(p=>`<tr class="click" data-act="viewReceipt" data-id="${p.id}"><td class="mono ${p.status==='ok'?'':'cancelled'}">${E(p.rc)}</td><td>${fmtD(p.date)}</td><td>${E(stu(p.studentId).name)}</td><td>${E(p.mode)}</td><td class="num amt ${p.status==='ok'?'':'cancelled'}">${inr(p.amount)}</td><td>${p.status==='ok'?pill('Valid','good'):pill('Cancelled','bad')}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No receipts in this range.</td></tr>'}</tbody></table></div>
   ${db.refunds.length?`<h3>Refunds</h3><div class="list">${db.refunds.slice().reverse().map(r=>`<div class="li"><div><b>${E(r.rc)} · ${E(stu(r.studentId).name)}</b><small>${fmtD(r.date)} · ${E(r.mode)} · ${E(r.reason)}</small></div><span class="amt">${inr(r.amount)}</span></div>`).join('')}</div>`:''}</div>`;
}
CHG.recF=el=>{ui.f.receipts[el.dataset.k]=el.value;renderPage()};

/* ----- dues ----- */
function feeDues(){
  const f=ui.f.dues=ui.f.dues||{course:'',overdue:''};
  const l=dueList().filter(x=>(!f.course||x.s.course===f.course)&&(!f.overdue||x.sm.overdue));
  return`<div class="panel"><div class="filters"><select aria-label="Course" data-change="duesF" data-k="course"><option value="">All courses</option>${db.courses.map(c=>`<option value="${c.id}" ${f.course===c.id?'selected':''}>${E(c.name)}</option>`).join('')}</select>
   <select aria-label="Overdue" data-change="duesF" data-k="overdue"><option value="">All pending</option><option value="1" ${f.overdue?'selected':''}>Overdue only</option></select><span style="flex:1"></span>
   <span class="pill acc">${l.length} students · ${inr(sum(l,x=>x.sm.payable))}</span>${can('messages.send')?`<button class="btn sm gold" data-act="remindAll">Send reminders to these ${l.length}</button>`:''}<button class="btn sm" data-act="exportDues">Copy as CSV</button></div>
   <div class="tablewrap"><table><thead><tr><th>Student</th><th>Class</th><th>Next due</th><th class="num">Fee balance</th><th class="num">Late fee</th><th class="num">Payable</th><th>Status</th><th></th></tr></thead><tbody>
   ${l.map(x=>`<tr><td class="click" data-act="openStudent" data-id="${E(x.s.id)}"><div class="who"><div class="av">${E(initials(x.s.name))}</div>${E(x.s.name)}</div></td><td>${E(classLabel(x.s))}</td><td>${x.sm.nextInst?fmtD(x.sm.nextInst.due):'—'}</td><td class="num">${inr(x.sm.balance)}</td><td class="num">${inr(x.sm.lateDue)}</td><td class="num amt">${inr(x.sm.payable)}</td><td>${feePill(x.sm)}</td><td>${can('fees.collect')?`<button class="btn sm" data-act="collectFor" data-id="${E(x.s.id)}">Collect</button>`:''}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">No pending dues for this filter.</td></tr>'}</tbody></table></div></div>`;
}
CHG.duesF=el=>{ui.f.dues[el.dataset.k]=el.value;renderPage()};
function duesFiltered(){const f=ui.f.dues||{};return dueList().filter(x=>(!f.course||x.s.course===f.course)&&(!f.overdue||x.sm.overdue))}
ACT.exportDues=()=>showCsv('Pending dues (CSV)',['Enrolment','Student','Class','Fee balance','Late fee','Payable'],duesFiltered().map(x=>[x.s.id,x.s.name,classLabel(x.s),x.sm.balance,x.sm.lateDue,x.sm.payable]));
ACT.remindAll=()=>{if(!can('messages.send'))throw new Error('You do not have access to send messages');const l=duesFiltered();l.forEach(x=>{const k=x.sm.overdue?'overdue':'reminder';sendMsg(k,x.s,'WhatsApp');notifyReminder(x.s,k)});log('Reminders sent',l.length+' fee reminders');save();toast(`${l.length} reminders sent (demo). See Messages and Notices.`)};

/* ----- concessions ----- */
function feeApprovals(){
  const pend=db.students.filter(s=>s.fee.concession.status==='pending');const done=db.students.filter(s=>['approved','rejected'].includes(s.fee.concession.status));const appr=can('fees.concession.approve');
  const live=db.students.filter(s=>s.status==='Active'&&s.fee.concession.status==='none');
  return`<div class="grid two"><div class="panel"><h2>Waiting for approval ${pill(String(pend.length),pend.length?'warn':'')}</h2><div class="list">${pend.map(s=>`<div class="li"><div><b>${E(s.name)}</b><small>${E(s.id)} · ${s.fee.concession.type==='gov'?'Government scholarship':'Management concession '+inr(s.fee.concession.amount)} · requested by ${E(s.fee.concession.requestedBy||'-')}</small></div><div class="actions">${appr?`<button class="btn sm primary" data-act="concDecide" data-id="${E(s.id)}" data-v="approved">Approve</button><button class="btn sm danger" data-act="concDecide" data-id="${E(s.id)}" data-v="rejected">Reject</button>`:pill('Pending','warn')}</div></div>`).join('')||'<p class="note">No requests waiting.</p>'}</div>
   <h3>Decided</h3><div class="list">${done.map(s=>`<div class="li"><div><b>${E(s.name)}</b><small>${s.fee.concession.type==='gov'?'Government scholarship':'Management concession '+inr(s.fee.concession.amount)} · ${E(s.fee.concession.approvedBy||'')}</small></div>${pill(s.fee.concession.status,s.fee.concession.status==='approved'?'good':'bad')}</div>`).join('')||'<p class="note">Nothing decided yet.</p>'}</div></div>
   <div class="panel"><h2>New concession request</h2><form data-form="concRequest" class="form">${F('sid','Student',{opts:live.map(s=>[s.id,s.name+' · '+s.id]),span:1})}${F('conc','Type',{opts:CONC_OPTS.slice(1),span:1})}${F('why','Reason',{type:'textarea',span:1,ph:'For example: income certificate submitted'})}<button class="btn primary span">${appr?'Apply concession':'Send for approval'}</button></form>
   <p class="note">Management concessions reduce the tuition head. A government scholarship moves the tuition amount to a receivable from the scholarship portal.</p></div></div>`;
}
FORM.concRequest=(f,d)=>{
  if(!(can('fees.concession.request')||can('fees.concession.approve')))throw new Error('You do not have access to concessions');
  const s=stu(d.sid);if(!s)throw new Error('Choose a student');const c=concFromKey(d.conc);const u=cur();const appr=can('fees.concession.approve');
  s.fee.concession={...c,status:appr?'approved':'pending',requestedBy:u.name,approvedBy:appr?u.name:'',why:d.why};layoutFee(s.fee);recompute(s);
  log('Concession '+(appr?'applied':'requested'),`${s.name}: ${c.type==='gov'?'government scholarship':inr(c.amount)}`);
  {const what=c.type==='gov'?'Government scholarship':inr(c.amount);if(appr)notify('conc_dec',`Concession applied · ${s.name}`,`${what} applied by ${u.name}.`,{sid:s.id,tone:'good',go:{staff:['fees','approvals'],portal:'pfees'},open:'student',p:{t:'Concession applied',x:`${what}: your fee plan has been updated.`}});else notify('conc_req',`Concession to decide · ${s.name}`,`${what} requested by ${u.name}. Reason: ${d.why||'not given'}.`,{sid:s.id,tone:'warn',go:{staff:['fees','approvals']},open:'student'})}save();toast(appr?'Concession applied':'Sent to the Principal');renderPage();
};

/* ----- day close ----- */
function feeDayClose(){
  const d=ui.f.closeDate||today();const cl=db.closures[d];const ex=cashExpected(d);const ok=db.payments.filter(p=>p.status==='ok'&&p.date===d);
  const cheques=ok.filter(p=>p.mode==='Cheque / DD');const online=ok.filter(p=>p.channel==='online');const refCash=sum(db.refunds.filter(r=>r.date===d&&r.mode==='Cash'),r=>r.amount);
  return`<div class="grid two"><div class="panel"><h2>Close the day</h2><div class="field" style="margin-bottom:12px"><label class="label" for="cd">Date</label><input type="date" id="cd" value="${d}" max="${today()}" data-change="closeDate"></div>
   <div class="rline"><span>Cash received</span><b>${inr(ex+refCash)}</b></div>${refCash?`<div class="rline"><span>Cash refunds</span><b>− ${inr(refCash)}</b></div>`:''}<div class="rline tot"><span>Cash expected in drawer</span><b>${inr(ex)}</b></div>
   <div class="rline"><span>Cheques / DDs to deposit</span><b>${inr(sum(cheques,p=>p.amount))}</b></div><div class="rline"><span>Online (settled by gateway)</span><b>${inr(sum(online,p=>p.amount))}</b></div>
   ${cl?`<div class="hl" style="margin-top:12px"><b>Closed</b> by ${E(cl.by)} on ${fmtT(cl.ts)}<br>Counted ${inr(cl.counted)} · ${cl.diff===0?'no difference':(cl.diff>0?'excess ':'short ')+inr(Math.abs(cl.diff))}${cl.reason?'<br>Reason: '+E(cl.reason):''}</div>${can('fees.concession.approve')?`<button class="btn sm" style="margin-top:10px" data-act="reopenDay" data-d="${d}">Reopen this day (Principal)</button>`:''}`
   :`<form data-form="closeDay" data-d="${d}" class="grid" style="gap:12px;margin-top:14px">${F('counted','Cash counted in drawer (₹)',{type:'number',req:1,attrs:'min="0" data-live="countDiff" data-ex="'+ex+'"'})}<div id="diffOut"></div><div class="field" id="reasonBox" style="display:none"><label class="label" for="f_reason">Reason for difference *</label><input name="reason" id="f_reason" placeholder="Explain the difference"></div><button class="btn gold">Close day and lock receipts</button></form>`}</div>
   <div class="panel"><h2>Closing history</h2><div class="list">${Object.values(db.closures).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(c=>`<div class="li"><div><b>${fmtD(c.date)}</b><small>${E(c.by)} · expected ${inr(c.expected)}</small></div><div class="right"><span class="amt">${inr(c.counted)}</span><br>${c.diff===0?pill('Matched','good'):pill((c.diff>0?'Excess ':'Short ')+inr(Math.abs(c.diff)),'bad')}</div></div>`).join('')||'<p class="note">No days closed yet.</p>'}</div></div></div>`;
}
CHG.closeDate=el=>{ui.f.closeDate=el.value;renderPage()};
LIVE.countDiff=el=>{const ex=+el.dataset.ex,v=el.value===''?null:+el.value;const out=$('#diffOut'),rb=$('#reasonBox');if(v===null){out.innerHTML='';rb.style.display='none';return}const d=v-ex;out.innerHTML=d===0?pill('Matches','good'):pill((d>0?'Excess by ':'Short by ')+inr(Math.abs(d)),'bad');rb.style.display=d===0?'none':'flex';$('#f_reason').required=d!==0};
FORM.closeDay=(f,d)=>{
  if(!can('fees.dayclose'))throw new Error('You do not have access to close the day');
  const date=f.dataset.d;const ex=cashExpected(date);const counted=+d.counted;const diff=counted-ex;if(diff!==0&&!(d.reason||'').trim())throw new Error('Explain the difference before closing');
  db.closures[date]={date,expected:ex,counted,diff,reason:(d.reason||'').trim(),by:cur().name,ts:Date.now()};log('Day closed',`${fmtD(date)}: expected ${inr(ex)}, counted ${inr(counted)}`);notify('dayclose',`Day closed · ${fmtD(date)}`,`Expected ${inr(ex)}, counted ${inr(counted)}.${diff?` Difference of ${inr(Math.abs(diff))} (${diff<0?'short':'extra'}).`:' No difference.'}`,{tone:diff?'warn':'good',go:{staff:['fees','dayclose']}});
  db.messages.unshift({id:uid('m'),ts:Date.now(),channel:'WhatsApp',to:'Principal',studentId:null,kind:'custom',text:`Day close ${fmtD(date)}: cash ${inr(counted)}${diff?' ('+(diff>0?'excess ':'short ')+inr(Math.abs(diff))+')':' matched'}.`,status:'Delivered (demo)'});
  save();toast('Day closed');renderPage();
};
ACT.reopenDay=el=>{if(!can('fees.concession.approve'))throw new Error('Only the Principal or admin can reopen a day');delete db.closures[el.dataset.d];log('Day reopened',fmtD(el.dataset.d));notify('dayclose','Day reopened · '+fmtD(el.dataset.d),`Reopened by ${cur().name}. Counter payments are allowed again.`,{tone:'warn',go:{staff:['fees','dayclose']}});save();toast('Day reopened');renderPage()};

/* ----- bank matching ----- */
function feeBank(){
  const on=db.payments.filter(p=>p.channel==='online'&&p.status==='ok').sort((a,b)=>b.ts-a.ts);const pend=on.filter(p=>p.settle.status==='pending');const old=pend.filter(p=>p.date<today());
  return`<div class="panel"><div class="filters"><span class="pill good">Matched ${on.length-pend.length} · ${inr(sum(on.filter(p=>p.settle.status==='matched'),p=>p.amount))}</span><span class="pill warn">Waiting ${pend.length} · ${inr(sum(pend,p=>p.amount))}</span><span style="flex:1"></span>
   <button class="btn gold" data-act="bankImport" ${old.length?'':'disabled'}>Import bank settlement file (demo)</button></div><p class="note" style="margin:0 0 10px">The gateway pays out to the college bank account the next working day. Importing the bank statement matches each payment by reference.</p>
   <div class="tablewrap"><table><thead><tr><th>Receipt</th><th>Date</th><th>Student</th><th>Mode</th><th>Reference</th><th class="num">Amount</th><th>Bank</th></tr></thead><tbody>${on.map(p=>`<tr><td class="mono click" data-act="viewReceipt" data-id="${p.id}">${E(p.rc)}</td><td>${fmtD(p.date)}</td><td>${E(stu(p.studentId).name)}</td><td>${E(p.mode)}</td><td class="mono">${E(p.ref)}</td><td class="num amt">${inr(p.amount)}</td><td>${p.settle.status==='matched'?pill('Matched '+fmtD(p.settle.on),'good'):`${pill('Waiting','warn')} <button class="btn sm" data-act="bankMatch" data-id="${p.id}">Match</button>`}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">No online payments yet.</td></tr>'}</tbody></table></div></div>`;
}
ACT.bankImport=()=>{if(!can('fees.bankmatch'))throw new Error('You do not have access to bank matching');let n=0;db.payments.forEach(p=>{if(p.channel==='online'&&p.status==='ok'&&p.settle.status==='pending'&&p.date<today()){p.settle={status:'matched',on:today()};n++}});log('Bank settlement imported',n+' payments matched');notify('bank','Bank settlement imported',`${n} payment${n===1?'':'s'} matched with the bank statement.`,{tone:'good',go:{staff:['fees','bank']}});save();toast(n+' payments matched');renderPage()};
ACT.bankMatch=el=>{if(!can('fees.bankmatch'))throw new Error('You do not have access to bank matching');const p=db.payments.find(x=>x.id===el.dataset.id);p.settle={status:'matched',on:today()};log('Bank match',p.rc);save();renderPage()};

/* ----- fee setup ----- */
function feeSetup(){
  const st=db.settings;
  return`<div class="grid two"><div class="grid" style="align-content:start">${db.courses.map(c=>`<div class="panel"><h2>${E(c.name)} fee structure per semester <span class="pill acc">${inr(sum(db.feeStructure[c.id],h=>h.amount))}</span></h2>
   <form data-form="feeStruct" data-c="${c.id}"><div class="grid" style="gap:8px" id="heads_${c.id}">${db.feeStructure[c.id].map(h=>headRow(h.name,h.amount)).join('')}</div>
   <div class="actions" style="margin-top:10px"><button type="button" class="btn sm" data-act="addHead" data-c="${c.id}">+ Add fee head</button><button class="btn primary sm">Save structure</button></div></form>
   <p class="note">The first head is the tuition fee. Concessions reduce it. Heads are filled in this order when money arrives.</p></div>`).join('')}</div>
   <div class="grid" style="align-content:start"><div class="panel"><h2>Late fee and due dates</h2><form data-form="feeRules" class="form">${F('lateFeePerDay','Late fee per day (₹)',{type:'number',val:st.lateFeePerDay,attrs:'min="0"'})}${F('lateCap','Cap per installment (₹)',{type:'number',val:st.lateCap,attrs:'min="0"'})}${F('graceDays','Grace days',{type:'number',val:st.graceDays,attrs:'min="0"'})}${F('dueOffsets','Due dates (days after semester start)',{val:st.dueOffsets.join(', '),ph:'0, 45, 90'})}${F('receiptPrefix','Receipt number prefix',{val:st.receiptPrefix})}<button class="btn primary span">Save rules</button></form>
   <p class="note">Late fee runs per overdue installment: days past due, minus grace, times the daily rate, up to the cap.</p></div>
   <div class="panel"><h2>Installment plans</h2><div class="list">${db.plans.map(p=>`<div class="li"><b>${E(p.name)}</b><span class="muted">${p.pct.join(' / ')} %</span></div>`).join('')}</div><p class="note">Changes apply to new admissions and promotions. Students already enrolled keep the fee they were given.</p></div></div></div>`;
}
const headRow=(n,a)=>`<div class="form headrow"><div class="field"><label class="label">Fee head</label><input name="hname" value="${E(n)}" required></div><div class="field"><label class="label">Amount (₹)</label><input name="hamt" type="number" min="0" value="${E(a)}" required></div><button type="button" class="btn sm danger" data-act="delHead" aria-label="Remove fee head">Remove</button></div>`;
ACT.addHead=el=>{$('#heads_'+el.dataset.c).insertAdjacentHTML('beforeend',headRow('','0'))};
ACT.delHead=el=>{const box=el.closest('.grid');if($$('[name=hname]',box).length<=1)throw new Error('A course needs at least one fee head');el.closest('.form').remove()};
FORM.feeStruct=(f)=>{
  if(!can('fees.setup'))throw new Error('You do not have access to fee setup');
  const names=$$('[name=hname]',f).map(i=>i.value.trim()),amts=$$('[name=hamt]',f).map(i=>+i.value);if(names.some(n=>!n))throw new Error('Every fee head needs a name');
  db.feeStructure[f.dataset.c]=names.map((n,i)=>({name:n,amount:amts[i]}));log('Fee structure changed',course(f.dataset.c).name+' now '+inr(sum(amts)));notify('system','Fee structure changed',`${course(f.dataset.c).name} fee is now ${inr(sum(amts))} for new admissions and promotions. Changed by ${cur().name}.`,{tone:'warn',go:{staff:['fees','setup']}});save();toast('Fee structure saved. It applies to new admissions and promotions.');renderPage();
};
FORM.feeRules=(f,d)=>{
  if(!can('fees.setup'))throw new Error('You do not have access to fee setup');
  const off=d.dueOffsets.split(',').map(x=>parseInt(x.trim(),10));if(off.some(x=>isNaN(x))||!off.length)throw new Error('Due dates must be numbers like 0, 45, 90');
  Object.assign(db.settings,{lateFeePerDay:+d.lateFeePerDay,lateCap:+d.lateCap,graceDays:+d.graceDays,dueOffsets:off,receiptPrefix:d.receiptPrefix||'RC-'});
  db.students.forEach(s=>recompute(s));log('Fee rules changed','Late fee '+inr(db.settings.lateFeePerDay)+' per day');notify('system','Fee rules changed',`Late fee is now ${inr(db.settings.lateFeePerDay)} per day. Changed by ${cur().name}.`,{tone:'warn',go:{staff:['fees','setup']}});save();toast('Rules saved');renderPage();
};
