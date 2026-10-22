/* =====================================================================
   Parent portal and boot
   ===================================================================== */
const myChild=()=>{const u=cur();return isPortal(u)?stu(u.studentId):null};
const portalName=()=>cur().role==='Student'?'Student portal':'Parent portal';
function viewParentHome(){
  const s=myChild();const sm=feeSum(s);const a=attPct(s);const c=course(s.course);
  const marks=[];db.marks.filter(m=>m.divId===s.div&&m.scores[s.id]!==undefined).slice(-4).forEach(m=>{const sb=db.subjects.find(x=>x.id===m.subjectId);marks.push([sb?sb.name:'',m.exam,m.scores[s.id],m.max])});
  const nx=sm.nextInst;
  return head(`Welcome, ${s.guardian.name}`,`Fee and progress details for ${s.name}`)+
  `<div class="grid even"><div class="panel"><h2>Fee status ${feePill(sm)}</h2>
    <div class="rline"><span>Semester ${E(s.fee.sem)} fee</span><b>${inr(sm.total)}</b></div><div class="rline"><span>Paid so far</span><b>${inr(sm.paid)}</b></div>
    <div class="rline"><span>Balance</span><b>${inr(sm.balance)}</b></div>${sm.lateDue>0?`<div class="rline"><span>Late fee</span><b style="color:var(--bad)">${inr(sm.lateDue)}</b></div>`:''}
    <div class="rline tot"><span>Payable now</span><span>${inr(sm.payable)}</span></div>
    ${nx?`<p class="note">${E(nx.label)}: ${inr(nx.remaining)} due ${fmtD(nx.due)}${nx.overdue?' (overdue)':''}</p>`:''}
    <div class="actions" style="margin-top:10px">${sm.payable>0?`<button class="btn primary" data-act="parentPay">Pay now</button>`:pill('Nothing due','good')}<button class="btn" data-act="go" data-to="pfees">Receipts</button></div></div>
   <div class="panel"><h2>Student</h2><div class="who" style="margin-bottom:10px"><div class="av">${E(initials(s.name))}</div><div><b>${E(s.name)}</b><br><small class="muted">${E(s.id)}</small></div></div>
    <div class="rline"><span>Class</span><span>${E(classLabel(s))}</span></div><div class="rline"><span>Course</span><span>${E(c.name)}</span></div>
    <div class="rline"><span>Attendance</span><span>${a===null?'Not marked yet':a+'%'} ${a!==null&&a<75?pill('Low','bad'):''}</span></div></div>
   <div class="panel"><h2>Recent internal marks</h2>${marks.length?`<div class="list">${marks.map(m=>`<div class="li"><span>${E(m[0])}<small>${E(m[1])}</small></span><b>${E(m[2])}/${E(m[3])}</b></div>`).join('')}</div>`:'<p class="note">No marks entered yet.</p>'}</div>
   <div class="panel"><h2>Latest notice</h2>${(()=>{const n=myNotices(s)[0];return n?`<b>${E(n.title)}</b><small class="muted" style="display:block">${fmtD(n.date)}</small><p>${E(n.body)}</p>`:'<p class="note">No notices.</p>'})()}</div></div>`;
}
const myNotices=s=>db.notices.filter(n=>n.audience==='all'||n.audience===s.course);
function viewParentNotices(){
  const s=myChild();const l=myNotices(s);const m=db.messages.filter(x=>x.studentId===s.id).slice(0,15);
  return head('Notices','From the college office')+`<div class="grid two"><div class="panel"><h2>Notices</h2><div class="list">${l.map(n=>`<div class="li" style="display:block"><b>${E(n.title)}</b><small class="muted" style="display:block">${fmtD(n.date)} · ${E(n.by)}</small><p style="margin:6px 0 0">${E(n.body)}</p></div>`).join('')||'<p class="note">No notices.</p>'}</div></div>
   <div class="panel"><h2>Messages sent to you</h2><div class="list">${m.map(x=>`<div class="li" style="display:block"><small class="muted">${E(x.channel)} · ${fmtT(x.ts)}</small><div class="bubble" style="margin-top:6px">${E(x.text)}</div></div>`).join('')||'<p class="note">No messages yet.</p>'}</div></div></div>`;
}
function viewParentFees(){
  const s=myChild();const sm=feeSum(s);const f=s.fee;const pays=paysOf(s,false);
  return head('Fees and Receipts',`${s.name} · Semester ${f.sem}${f.planName?' · '+f.planName:''}`,sm.payable>0?`<button class="btn primary" data-act="parentPay">Pay now</button>`:'')+
  `<div class="grid two"><div class="panel"><h2>Installments</h2><div class="tablewrap"><table><thead><tr><th>Installment</th><th>Due</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>${sm.inst.map(i=>`<tr><td>${E(i.label)}</td><td>${fmtD(i.due)}</td><td class="num">${inr(i.amt)}</td><td>${i.state==='Paid'?pill('Paid','good'):i.overdue?pill(i.state+' · overdue','bad'):pill(i.state,'warn')}</td></tr>`).join('')}</tbody></table></div>
    <div class="rline"><span>Total fee</span><b>${inr(sm.total)}</b></div>
    ${f.concession.status==='approved'?`<div class="rline"><span>Concession applied</span><span>${f.concession.type==='gov'?'Government scholarship':'Management concession'}</span></div>`:''}
    <div class="rline"><span>Paid</span><b>${inr(sm.paid)}</b></div><div class="rline"><span>Balance</span><b>${inr(sm.balance)}</b></div>${sm.lateDue>0?`<div class="rline"><span>Late fee</span><b style="color:var(--bad)">${inr(sm.lateDue)}</b></div>`:''}<div class="rline tot"><span>Payable now</span><span>${inr(sm.payable)}</span></div></div>
   <div class="panel"><h2>Receipts ${pill(String(pays.length))}</h2><div class="list">${pays.map(p=>`<div class="li"><div><b class="mono">${E(p.rc)}</b>${p.status!=='ok'?' '+pill('Cancelled','bad'):''}<small>${fmtD(p.date)} · ${E(p.mode)}</small></div><div class="right"><span class="amt">${inr(p.amount)}</span><br><button class="btn sm" data-act="pReceipt" data-id="${E(p.id)}">View</button></div></div>`).join('')||'<p class="note">No payments yet.</p>'}</div></div>${contactPanel()}</div>`;
}
ACT.pReceipt=el=>{const p=db.payments.find(x=>x.id===el.dataset.id);const s=myChild();if(!p||p.studentId!==s.id)throw new Error('Receipt not found');
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Receipt ${E(p.rc)}</h2><div style="margin-top:14px">${receiptHtml(p)}</div><div class="actions" style="margin-top:14px"><button class="btn primary" data-act="emailReceipt" data-id="${E(p.id)}">Email me this PDF</button><button class="btn" data-act="dlPdf" data-id="${E(p.id)}">Download PDF</button><button class="btn" data-act="copyReceipt" data-id="${E(p.id)}">Copy receipt text</button></div>${mailLine(p)}`)};
ACT.parentPay=()=>{
  const s=myChild();const sm=feeSum(s);if(sm.payable<=0){toast('Nothing is due');return}
  dialog(`<h3>Pay fees online</h3><form data-form="parentPayGo" class="grid" style="gap:12px"><div class="hl"><div class="rline" style="padding:0"><span>Payable now</span><b>${inr(sm.payable)}</b></div><div class="rline" style="padding:0"><span>Current installment</span><b>${inr(sm.suggest)}</b></div></div>
   ${F('amount','Amount to pay (₹)',{type:'number',val:sm.suggest||sm.payable,req:1,attrs:`min="1" max="${sm.payable}"`})}${F('mode','Pay with',{opts:ONLINE_MODES})}
   <div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Cancel</button><button class="btn primary">Continue to payment</button></div></form>`);
};
FORM.parentPayGo=(f,d)=>{
  const s=myChild();const sm=feeSum(s);const amount=+d.amount;if(!(amount>0))throw new Error('Enter an amount above ₹0');if(amount>sm.payable)throw new Error(`Amount is more than the payable ${inr(sm.payable)}`);
  const r={id:'rq'+(db.counters.req++),studentId:s.id,amount,mode:d.mode,status:'waiting',created:Date.now(),by:portalName()};db.requests.push(r);save();
  dialog(`<h3>${E(d.mode)}</h3><div class="flow" style="margin-bottom:12px"><div class="qr">${qrSvg(r.id)}</div><div><p style="margin:0"><b>${inr(amount)}</b> to ${E(db.settings.college)}</p><p class="note" style="margin:6px 0 0">This is a demo gateway screen. In the live system the Google Pay Business page opens here.</p></div></div>
   <div class="actions" style="justify-content:flex-end"><button class="btn" data-act="pFail" data-id="${E(r.id)}">Payment fails</button><button class="btn gold" data-act="pOk" data-id="${E(r.id)}">Payment succeeds</button></div>`);
};
ACT.pOk=el=>{
  const r=db.requests.find(x=>x.id===el.dataset.id);const s=myChild();if(!r||r.status!=='waiting'||r.studentId!==s.id)throw new Error('This payment request is no longer valid');
  const p=recordPayment(s,{amount:r.amount,mode:r.mode,channel:'online',ref:'UTR'+Math.floor(Math.random()*9e11+1e11),by:portalName()});
  r.status='paid';r.paymentId=p.id;log('Online payment confirmed',`${p.rc}: ${inr(p.amount)} from ${s.name} (${portalName().toLowerCase()})`);autoReceipt(p);save();closeDialog();toast(`Payment received · ${p.rc}`);renderPage();
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Payment successful</h2><div style="margin-top:14px">${receiptHtml(p)}</div><div class="actions" style="margin-top:14px"><button class="btn" data-act="dlPdf" data-id="${E(p.id)}">Download PDF</button><button class="btn" data-act="copyReceipt" data-id="${E(p.id)}">Copy receipt text</button></div>${mailLine(p)}`);
};
ACT.pFail=el=>{const s=myChild();const r=db.requests.find(x=>x.id===el.dataset.id);if(!s||!r||r.status!=='waiting'||r.studentId!==s.id)throw new Error('This payment request is no longer valid');r.status='failed';notifyPayFail(r);log('Online payment failed',`${inr(r.amount)} (${portalName().toLowerCase()})`);save();closeDialog();toast('Payment failed. You were not charged.',true)};

/* ---------- keep several tabs in step ---------- */
window.addEventListener('storage',e=>{
  if(e.key!==LS_KEY||!e.newValue)return;
  let n;try{n=JSON.parse(e.newValue)}catch(x){return}if(!n||n.ver!==3)return;
  db=n;if(!cur()){if(!$('form[data-form=login]'))renderLogin();return}
  if(!$('#page'))return;
  const busy=$('#layer').innerHTML||$('#dlg').innerHTML||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
  if(!busy){renderPage();toast('Updated from another tab')}
});

/* ---------- boot ---------- */
load();applyTheme();
if(cur()){ev('Auth','Session resumed','Page opened again');ntSync();save();renderApp()}else renderLogin();themeLabels();new MutationObserver(themeLabels).observe($('#root'),{childList:true,subtree:true});try{matchMedia('(prefers-color-scheme:dark)').addEventListener('change',themeLabels)}catch(e){}
