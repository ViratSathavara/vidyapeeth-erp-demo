/* =====================================================================
   Fee Collection (spec §5): Collect fee (every student, semester-wise) · Pending dues · Receipts · Fee setup
   Modes in one dropdown: Cash / Cheque / UPI / Expense. Only tuition fee is collected.
   ===================================================================== */
const MODES=[['CASH','By Cash'],['CHEQUE','By Cheque'],['UPI','By UPI'],['EXPENSE','By Expense']];
const modeName=m=>({CASH:'Cash',CHEQUE:'Cheque',UPI:'UPI',EXPENSE:'Expense'}[m]||m);
const MODE_TONE={CASH:'m-cash',CHEQUE:'m-cheque',UPI:'m-upi',EXPENSE:'m-exp'};
const modePill=m=>`<span class="pill ${MODE_TONE[m]||''}">${E(modeName(m))}</span>`;
const payPill=st=>st==='SUCCESS'?pill('Success','good'):st==='CANCELLED'?pill('Cancelled','bad'):st==='FAILED'?pill('Failed','bad'):pill('Pending','warn');
function feeTabs(){const t=[['collect','Collect fee']];t.push(['dues','Pending dues'],['receipts','Receipts']);if(can('fees.setup'))t.push(['setup','Fee setup']);return t}
function viewFees(){
  const tabs=feeTabs();let t=ui.tab.fees||'collect';if(!tabs.some(x=>x[0]===t))t='collect';ui.tab.fees=t;
  const T=today();const tp=vPayments().filter(p=>p.status==='SUCCESS'&&p.invoiceDate===T);
  return head('Fee Collection',`Today: ${inr(sum(tp,p=>p.amount))} in ${tp.length} receipt${tp.length===1?'':'s'} · ${fmtD(T)}`,'')+tabsBar('fees',tabs,t)+
   ({collect:feeCollect,dues:feeDues,receipts:feeReceipts,setup:feeSetup}[t])();
}

/* ---------- 1. collect fee: every student, semester by semester ----------
   One row per student (cards on a phone). "Collect" opens a panel: pick the semester, pick the mode
   from a dropdown (Cash / Cheque / UPI / Expense), pick the batch, save -> receipt. */
const MODE_OK=k=>k==='EXPENSE'?can('expenses.manage'):can('fees.collect');
function colFilter(){return ui.f['fees.collect']=Object.assign({q:'',course:'',sem:'',batch:'',st:'',sort:'name',dir:1,page:0},ui.f['fees.collect']||{})}
function colRows(){const f=colFilter();const q=f.q.trim().toLowerCase();
  let l=vStudents().filter(s=>s.status==='ACTIVE').map(s=>({s,sm:feeSum(s)})).filter(({s,sm})=>(!f.course||s.course===f.course)&&(!f.sem||s.sem===+f.sem)&&(!f.batch||defaultBatch(s)===f.batch)
    &&(!f.st||(f.st==='due'?sm.payable>0:f.st==='overdue'?sm.overdue:f.st==='paid'?sm.payable===0:true))&&(!q||[s.name,s.enrol,s.phone].some(v=>String(v).toLowerCase().includes(q))));
  const k={name:x=>x.s.name.toLowerCase(),course:x=>x.s.course+x.s.sem,due:x=>x.sm.payable,paid:x=>x.sm.paid,bal:x=>x.sm.total-x.sm.paid}[f.sort]||(x=>x.s.name);
  l.sort((a,b)=>{const A=k(a),B=k(b);return(A<B?-1:A>B?1:0)*f.dir});return l}
function semCell(x){if(!x.amount)return'<span class="muted">—</span>';
  if(!x.due)return`<span class="sc ok" title="Paid ${inr(x.paid)}">✓ Paid</span>`;
  if(!x.started)return`<span class="sc up" title="Not started yet">${inr(x.due)}<small>upcoming</small></span>`;
  return`<span class="sc ${x.overdue?'bad':'due'}">${inr(x.due)}<small>${x.overdue?'overdue':x.paid?'part paid':'due'}</small></span>`}
function feeCollect(){
  need('fees.view');const f=colFilter();const sc='fees.collect';const l=colRows();const pg=l.slice(f.page*PAGE,(f.page+1)*PAGE);const SEMS=SEMS_ALL();
  const T=today();const ok=vPayments().filter(p=>p.status==='SUCCESS'&&p.invoiceDate===T);
  const bats=[...new Set(vStudents().map(defaultBatch))].sort().reverse();
  const tot={fee:sum(l,x=>x.sm.total),paid:sum(l,x=>x.sm.paid),due:sum(l,x=>x.sm.payable)};
  return`<div class="kpis k4 kpis-sm"><div class="kpi "><span class="label">Students</span><div class="v">${l.length}</div></div><div class="kpi "><span class="label">Total tuition fee</span><div class="v">${inr(tot.fee)}</div></div><div class="kpi good"><span class="label">Paid</span><div class="v">${inr(tot.paid)}</div></div><div class="kpi bad"><span class="label">Due now</span><div class="v">${inr(tot.due)}</div></div></div>
   <div class="today-strip"><b>Today</b>${['CASH','CHEQUE','UPI','EXPENSE'].map(m=>`<span>${modePill(m)} ${inr(sum(ok.filter(p=>p.mode===m),p=>p.amount))}</span>`).join('')}</div>
   <div class="panel"><h2>Students and their fees</h2>
   <div class="filters"><input type="search" placeholder="Name, enrolment no. or mobile" aria-label="Search students" data-live="sq" data-scope="${sc}" value="${E(f.q)}">
    ${scopeCourses().length>1?sel(sc,'course','Course',COURSE_OPTS()):''}${sel(sc,'batch','Batch',[['','All batches'],...bats.map(b=>[b,b])])}${sel(sc,'sem','Semester',[['','All semesters'],...SEMS.map(n=>[n,'Semester '+n])])}
    ${sel(sc,'st','Status',[['','All students'],['due','Fee due now'],['overdue','Overdue'],['paid','Fully paid (so far)']])}</div>
   <div class="tablewrap"><table class="feetable"><thead><tr>${sortTh(sc,'name','Student')}${sortTh(sc,'course','Course · Batch')}${SEMS.map(n=>`<th>Sem ${n}</th>`).join('')}${sortTh(sc,'paid','Paid',1)}${sortTh(sc,'due','Due now',1)}<th></th></tr></thead><tbody>
   ${pg.map(({s,sm})=>`<tr><td><button class="lnk" data-act="openStudent" data-id="${E(s.id)}"><b>${E(s.name)}</b></button><small class="muted mono" style="display:block">${E(s.enrol)}</small></td>
    <td>${E(course(s.course).name)} · Sem ${s.sem}<small class="muted" style="display:block">Batch ${E(defaultBatch(s))}</small></td>
    ${SEMS.map(n=>`<td>${n>semsOf(s.course).length?'<span class="muted">—</span>':semCell(sm.sems[n-1])}</td>`).join('')}
    <td class="num amt t-good">${inr(sm.paid)}</td><td class="num amt ${sm.payable?'t-bad':''}">${inr(sm.payable)}</td>
    <td>${sm.total>sm.paid?`<button class="btn sm primary" data-act="collectFor" data-id="${E(s.id)}">Collect</button>`:pill('Fully paid','good')}</td></tr>`).join('')||`<tr><td colspan="${5+SEMS.length}" class="empty">No students for these filters.</td></tr>`}</tbody></table></div>${pager(sc,l.length)}
   <p class="note">Due now = semesters that have started and are not fully paid. Upcoming semesters are shown in grey and can also be collected in advance.</p></div>`;
}
/* the collect panel (opens from any Collect button: this list, Pending dues, a student's profile) */
function openCollect(sid,sem){
  const s=stu(sid);if(!s)throw new Error('Student not found');guardStudent(sid);if(s.status!=='ACTIVE')throw new Error('This student is not active');
  const sm=feeSum(s);if(!sem){const fs=sm.sems.find(x=>x.started&&x.due>0)||sm.sems.find(x=>x.due>0);sem=fs?fs.sem:0}
  const prev=ui.col&&ui.col.mode;ui.col={sid,sem,mode:prev&&MODE_OK(prev)?prev:(MODES.map(m=>m[0]).find(MODE_OK)||'CASH')};
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Collect fee</h2><div id="colBox" style="margin-top:12px">${collectBox()}</div>`,true,'Collect fee');
}
function collectBox(){
  const c=ui.col;const s=stu(c.sid);const sm=feeSum(s);const m=c.sem&&semSummary(s,c.sem);
  return`<div class="li" style="border:0;padding:0 0 10px"><div class="who">${avatar(s)}<div><b>${E(s.name)}</b><small>${E(s.enrol)} · ${E(classLabel(s))} · Batch ${E(defaultBatch(s))}</small></div></div><b class="amt">${inr(sm.total-sm.paid)} <small class="muted">balance</small></b></div>
   <h3 style="margin-top:4px">1 · Semester</h3><div class="sempick" role="radiogroup" aria-label="Semester">${sm.sems.map(x=>`<button type="button" role="radio" aria-checked="${c.sem===x.sem}" class="sp ${x.due?'':'done'}" data-act="colSem" data-sem="${x.sem}" ${x.due?'':'disabled'}><b>Sem ${x.sem}</b><span>${x.due?inr(x.due)+' due':'Paid'}</span><small>${x.started?(x.overdue?'Overdue':x.dueDate?'Due '+fmtD(x.dueDate):'Started'):'Upcoming'}</small></button>`).join('')}</div>
   ${m?`<h3 style="margin-top:14px">2 · Payment details</h3><div class="form" style="margin-bottom:10px"><div class="field"><label class="label" for="f_mode">Mode of payment *</label><select id="f_mode" data-change="colMode">${MODES.filter(([k])=>MODE_OK(k)).map(([k,l])=>`<option value="${k}" ${c.mode===k?'selected':''}>${E(l)}</option>`).join('')}</select></div></div>${collectForm(s,m,c.mode)}`:'<p class="note">Every semester of this student is fully paid.</p>'}`;
}
const reCol=()=>{const b=$('#colBox');if(b)b.innerHTML=collectBox()};
function batchField(s){const b=defaultBatch(s);const opts=batchOptions(s.course);if(b&&!opts.includes(b))opts.push(b);
  return`<div class="field"><label class="label" for="f_batch">Batch *</label><select id="f_batch" name="batch" required><option value="">Choose batch</option>${opts.map(o=>`<option ${o===b?'selected':''}>${E(o)}</option>`).join('')}</select></div>`}
function collectForm(s,m,mode){
  const T=today();const amt=F('amount','Tuition fee amount (₹)',{val:m.due/100,req:true,attrs:`inputmode="decimal" max="${m.due/100}" data-live="colAmt"`})+batchField(s);
  if(mode==='CASH')return`<form data-form="collect" data-mode="CASH" class="form">${amt}${F('invoiceDate','Invoice date',{type:'date',val:T,req:true})}${F('note','Note (optional)',{span:1,attrs:'maxlength="120"'})}
   <p class="note span">Invoice date = the date you enter here (default today). The receipt uses this date. You can change it later in Receipts.</p><div class="actions span"><button class="btn primary big">Save cash payment · issue receipt</button></div></form>`;
  if(mode==='CHEQUE')return`<form data-form="collect" data-mode="CHEQUE" class="form">${amt}${F('chequeNo','Cheque no.',{req:true,attrs:'inputmode="numeric" maxlength="10"'})}${F('bank','Bank',{req:true,attrs:'maxlength="60" list="banks"'})}<datalist id="banks"><option>State Bank of India</option><option>Bank of Baroda</option><option>Mehsana Urban Co-op Bank</option><option>HDFC Bank</option><option>ICICI Bank</option></datalist>
   ${F('chequeDate','Cheque date',{type:'date',val:T,req:true})}${F('invoiceDate','Invoice date',{type:'date',val:T,req:true})}<div class="actions span"><button class="btn primary big">Save cheque payment · issue receipt</button></div></form>`;
  if(mode==='UPI'){const pv=upiInvoiceDate(Date.now());return`<form data-form="upiPay" class="form">${amt}<div class="field"><span class="label">Invoice date</span><div class="ro">${fmtD(pv)} <small class="muted">(payment date + 1 day, set automatically)</small></div></div>
   <p class="note span">A UPI order is created with ${E(db.settings.upi.provider)} (${E(db.settings.upi.mode)}). The student scans the QR with Google Pay or any UPI app. The payment becomes Success only when the gateway's verified webhook arrives — never from this screen.</p>
   <div class="actions span"><button class="btn primary big">Create UPI request · show QR</button></div></form>`}
  if(!ui.exp||ui.exp.sid!==s.id)ui.exp={sid:s.id,rows:[{amount:'',reason:'',doc:null}]};
  return`<form data-form="collect" data-mode="EXPENSE" class="form">${amt}${F('invoiceDate','Invoice date',{type:'date',val:T,req:true,attrs:`max="${T}"`})}
   <fieldset class="fs span expbox"><legend>Expense details</legend><p class="note" style="margin:0 0 8px">Where did this fee money go? Add one line per bill. Amount and reason are required; a bill photo or PDF is optional. <b>The lines must add up exactly to the fee amount.</b></p>
    <div id="expRows">${expRowsHtml()}</div><div class="actions"><button type="button" class="btn sm" data-act="expAdd">+ Add another line</button></div><div id="expTotal" class="exptotal">${expTotalHtml()}</div></fieldset>
   <p class="note span">By Expense: this student's fee was used directly for a college expense. The fee counts as paid: a receipt is issued and the due goes down. It shows as Expense in Receipts, Audit and the Dashboard. The student only sees the receipt, not the mode.</p>
   <div class="actions span"><button class="btn primary big">Save fee by expense · issue receipt</button></div></form>`;
}
/* expense lines: amount + reason + optional bill (image or PDF) */
const EXP_DOC_MAX=700*1024;
function expRowsHtml(){return ui.exp.rows.map((r,i)=>`<div class="exprow" data-i="${i}"><div class="field"><label class="label" for="ea${i}">Amount (₹) *</label><input id="ea${i}" inputmode="decimal" value="${E(r.amount)}" data-live="expAmt" data-i="${i}" required></div>
  <div class="field"><label class="label" for="er${i}">Reason *</label><input id="er${i}" maxlength="120" value="${E(r.reason)}" data-live="expReason" data-i="${i}" placeholder="e.g. University exam form fees" required></div>
  <div class="field"><span class="label">Bill / document (optional)</span><div class="actions nowrap">${r.doc?`<button type="button" class="btn sm" data-act="expView" data-i="${i}">📎 ${E(r.doc.name.slice(0,22))}</button><button type="button" class="btn sm" data-act="expDocDel" data-i="${i}" aria-label="Remove document">✕</button>`:`<label class="btn sm"><input type="file" class="sr" accept="image/*,application/pdf" data-change="expDoc" data-i="${i}"> Upload</label>`}
  ${ui.exp.rows.length>1?`<button type="button" class="btn sm danger" data-act="expDel" data-i="${i}">Remove line</button>`:''}</div></div></div>`).join('')}
function expTotalHtml(){const f=$('#f_amount');const want=toPaise(f?f.value:0)||0;const got=ui.exp.rows.reduce((a,r)=>a+(toPaise(r.amount)||0),0);const ok=want>0&&got===want;
  return`<span>Lines total <b>${inr(got)}</b> of fee amount <b>${inr(want)}</b></span>${ok?pill('Matches','good'):pill(got<want?`${inr(want-got)} still to add`:`${inr(got-want)} too much`,'bad')}`}
const reExp=()=>{const r=$('#expRows');if(r)r.innerHTML=expRowsHtml();expTot()};
const expTot=()=>{const t=$('#expTotal');if(t)t.innerHTML=expTotalHtml()};
LIVE.expAmt=el=>{ui.exp.rows[+el.dataset.i].amount=el.value;expTot()};
LIVE.expReason=el=>{ui.exp.rows[+el.dataset.i].reason=el.value};
ACT.expAdd=()=>{ui.exp.rows.push({amount:'',reason:'',doc:null});reExp();const l=$$('#expRows input[data-live=expAmt]');l.length&&l[l.length-1].focus()};
ACT.expDel=el=>{ui.exp.rows.splice(+el.dataset.i,1);reExp()};
ACT.expDocDel=el=>{ui.exp.rows[+el.dataset.i].doc=null;reExp()};
CHG.expDoc=el=>{const file=el.files&&el.files[0];const i=+el.dataset.i;if(!file)return;
  if(/^image\//.test(file.type)){const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{const k=Math.min(1,1400/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
      const data=c.toDataURL('image/jpeg',.72);if(data.length*.75>EXP_DOC_MAX){toast('This photo is too large even after shrinking',true);return}ui.exp.rows[i].doc={name:file.name.replace(/\.[^.]+$/,'')+'.jpg',type:'image/jpeg',data};reExp();toast('Bill attached')};img.onerror=()=>toast('Could not read this image',true);img.src=url;return}
  if(file.type==='application/pdf'){if(file.size>EXP_DOC_MAX)throw new Error('PDF must be under 700 KB in this demo');const fr=new FileReader();fr.onload=()=>{ui.exp.rows[i].doc={name:file.name,type:'application/pdf',data:fr.result};reExp();toast('Bill attached')};fr.readAsDataURL(file);return}
  throw new Error('Upload a photo (JPG / PNG) or a PDF')};
function docOpen(doc){if(!doc)return;const bin=atob(doc.data.split(',')[1]);const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);const url=URL.createObjectURL(new Blob([u8],{type:doc.type}));
  if(doc.type==='application/pdf'){window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);return}
  dialog(`<h3>${E(doc.name)}</h3><img src="${url}" alt="${E(doc.name)}" style="max-width:100%;border-radius:8px;border:1px solid var(--line)"><div class="actions" style="justify-content:flex-end;margin-top:10px"><a class="btn" href="${url}" download="${E(doc.name)}">Download</a><button class="btn primary" data-act="closeDialog">Close</button></div>`,'Document')}
ACT.expView=el=>docOpen(ui.exp.rows[+el.dataset.i].doc);
ACT.expDocOpen=el=>{const p=db.payments.find(x=>x.id===el.dataset.id);if(!p)return;if(isStudentUser(cur()))throw new Error('Not available');guardStudent(p.studentId);docOpen((p.expenseItems||[])[+el.dataset.i].doc)};
LIVE.colAmt=()=>expTot();
ACT.colSem=el=>{ui.col.sem=+el.dataset.sem;reCol()};
CHG.colMode=el=>{if(!MODE_OK(el.value))throw new Error('You do not have access to this mode');ui.col.mode=el.value;reCol();const a=$('#f_amount');if(a)a.focus()};
ACT.collectFor=el=>{if(!canAny('fees.collect','expenses.manage'))throw new Error('You do not have access to collect fees');openCollect(el.dataset.id,+el.dataset.sem||0)};
function amountOf(d,m){const a=toPaise(d.amount);if(!(a>0))throw new Error('Enter the amount');if(a>m.due)throw new Error(`Amount is more than the semester ${m.sem} due (${inr(m.due)})`);return a}
FORM.collect=(f,d)=>{
  const mode=f.dataset.mode;if(mode==='EXPENSE')need('expenses.manage','add expenses');else need('fees.collect','collect fees');
  const c=ui.col;const s=stu(c.sid);if(!s||s.status!=='ACTIVE')throw new Error('Choose an active student');guardStudent(s.id);const m=semSummary(s,c.sem);
  const o={sem:c.sem,mode,amount:amountOf(d,m),batch:cleanBatch(d.batch),invoiceDate:d.invoiceDate,note:capText(d.note,'Note',120)};
  if(mode==='EXPENSE'){if(!validIso(o.invoiceDate))throw new Error('Choose a valid invoice date');const rows=(ui.exp&&ui.exp.sid===s.id?ui.exp.rows:[]);if(!rows.length)throw new Error('Add the expense details');
    const items=rows.map((r,i)=>{const a=toPaise(r.amount);if(!(a>0))throw new Error(`Expense line ${i+1}: enter the amount`);const rs=capText(r.reason,`Expense line ${i+1} reason`,120);if(rs.length<3)throw new Error(`Expense line ${i+1}: write the reason`);return{amount:a,reason:rs,doc:r.doc||null}});
    const tot=items.reduce((a,x)=>a+x.amount,0);if(tot!==o.amount)throw new Error(`Expense lines add up to ${inr(tot)} but the fee amount is ${inr(o.amount)}. They must match exactly.`);
    o.expenseItems=items;o.reason=items.map(x=>x.reason).join('; ').slice(0,300)}
  if(mode==='CHEQUE'){o.chequeNo=String(d.chequeNo||'').trim();if(!/^\d{6}$/.test(o.chequeNo))throw new Error('Cheque no. must be 6 digits');o.bank=capText(d.bank,'Bank',60);if(!o.bank)throw new Error('Enter the bank name');if(!validIso(d.chequeDate))throw new Error('Enter the cheque date');o.chequeDate=d.chequeDate;
    if(db.payments.some(p=>p.status==='SUCCESS'&&p.mode==='CHEQUE'&&p.chequeNo===o.chequeNo&&p.bank.toLowerCase()===o.bank.toLowerCase()))throw new Error('This cheque no. of this bank is already entered')}
  if(o.invoiceDate>addDays(today(),0))throw new Error('Invoice date cannot be in the future');
  const p=recordPayment(s,o);if(o.expenseItems)p.expenseItems=o.expenseItems;
  if(!save()){db.payments.splice(db.payments.indexOf(p),1);if(db.audit[0]&&db.audit[0].entityId===p.rc)db.audit.shift();db.college.nextReceipt--;save();throw new Error('Not enough browser storage for these documents. Use smaller photos or fewer documents.')}
  afterPayment(p);save();
  if(mode==='EXPENSE')ui.exp=null;closeLayer();renderPage();showReceipt(p,true);
};
/* everything that happens after a successful payment (spec §5.2): receipt no + PDF, email, notification to the student, live update for staff */
function afterPayment(p){
  const s=stu(p.studentId);
  if(db.settings.mail.sendReceipts)queueMail({kind:'receipt',paymentId:p.id,studentId:s.id,to:[s.email],subject:`Fee receipt ${p.rc} - ${db.college.short}`});
  notify('payment',`Fee received · ${inr(p.amount)}`,`Tuition fee · Semester ${p.sem} · receipt ${p.rc}`,{students:[s.id],portal:'sfees',tone:'good',self:true});
  notify('payment',`${modeName(p.mode)} payment · ${s.name}`,`${inr(p.amount)} for semester ${p.sem} · ${p.rc}`,{roles:['Super Admin','Principal','Clerk'],staff:'fees',tab:'receipts',tone:'good',sid:s.id});
}

/* ---------- UPI: PaymentProvider adapter (spec §5.4) ---------- */
/* The interface the server implements: createOrder, verifyWebhook, getStatus. Razorpay / Cashfree / PhonePe adapters and a Google Pay stub plug in here.
   In the demo the "gateway" is simulated in the browser and signs its webhook with a secret the UI code never uses to mark a payment. */
const PaymentProviders={
  Razorpay:{name:'Razorpay'},Cashfree:{name:'Cashfree'},PhonePe:{name:'PhonePe PG'},GooglePay:{name:'Google Pay (stub, off until approved)',stub:true}};
const GW_SECRET=uid('whsec_');
const sig=(s)=>{let h=2166136261;for(const ch of s+GW_SECRET){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return h.toString(16)};
const provider={
  createOrder(s,sem,amount,by){const o={id:'order_'+Math.random().toString(36).slice(2,12),studentId:s.id,sem,amount,status:'CREATED',createdAt:Date.now(),by,provider:db.settings.upi.provider,vpa:db.settings.upi.vpa};db.upiOrders.unshift(o);if(db.upiOrders.length>200)db.upiOrders.length=200;return o},
  verifyWebhook(evt){return !!evt&&evt.signature===sig(evt.orderId+'|'+evt.status+'|'+evt.amount+'|'+evt.paidAt)},
  getStatus(id){const o=db.upiOrders.find(x=>x.id===id);return o?o.status:'UNKNOWN'}};
/* server side: the only place a UPI payment becomes SUCCESS */
function handleUpiWebhook(evt){
  if(!provider.verifyWebhook(evt)){log('Webhook rejected','UPI order',evt&&evt.orderId,null,null,'Bad signature');throw new Error('Webhook signature did not verify. Payment NOT marked.')}
  const o=db.upiOrders.find(x=>x.id===evt.orderId);if(!o)throw new Error('Unknown order');if(o.status!=='CREATED')return null; /* webhooks may arrive twice: idempotent */
  if(evt.status==='captured'){const s=stu(o.studentId);const p=recordPayment(s,{sem:o.sem,mode:'UPI',amount:o.amount,batch:o.batch,paidAt:evt.paidAt,upiRef:evt.utr,providerTxnId:evt.txnId});p.by='UPI · '+o.provider;p.orderId=o.id;o.status='PAID';o.paymentId=p.id;afterPayment(p);return p}
  o.status='FAILED';o.failedAt=evt.paidAt;const s=stu(o.studentId);
  log('UPI payment failed','UPI order',o.id,null,{amount:inr(o.amount),student:s.enrol});
  notify('payfail','UPI payment failed',`${inr(o.amount)} for semester ${o.sem} did not go through. No money was taken.`,{students:[s.id],portal:'sfees',tone:'bad',self:true});
  notify('payfail',`UPI payment failed · ${s.name}`,`${inr(o.amount)} · semester ${o.sem}`,{sid:s.id,roles:['Super Admin','Principal','Clerk'],staff:'fees',tab:'receipts',tone:'bad'});
  return null;
}
/* ---------- UPI flow (office and student portal) ----------
   1. An order is created for an exact amount (office: Collect → UPI; student: Fees → Pay with UPI).
   2. A real QR code is shown. Live mode: upi://pay with the college merchant VPA (dynamic QR from the gateway).
      Sandbox / demo: the QR opens our demo UPI payment page, so no real money can move by mistake.
   3. The office can also send the request to the student's portal (notification + "Pay now" there).
   4. Only the verified gateway webhook marks it paid → receipt, email, notifications; every open screen updates by itself. */
const UPI_TTL=15*60*1000;
const orderOf=id=>db.upiOrders.find(x=>x.id===id);
const orderLive=o=>o&&o.status==='CREATED'&&Date.now()-o.createdAt<UPI_TTL;
const payPageUrl=o=>`${location.origin}/?pay=${encodeURIComponent(o.id)}`;
function upiLink(o){const s=stu(o.studentId);return`upi://pay?pa=${encodeURIComponent(o.vpa)}&pn=${encodeURIComponent(db.college.short)}&am=${(o.amount/100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(s.enrol+' Sem '+o.sem+' tuition fee')}&tr=${encodeURIComponent(o.id)}`}
const qrTarget=o=>db.settings.upi.mode==='Live'?upiLink(o):payPageUrl(o);
function expireOrders(){let n=0;db.upiOrders.forEach(o=>{if(o.status==='CREATED'&&Date.now()-o.createdAt>=UPI_TTL){o.status='EXPIRED';n++}});return n}
function upiBox(o){
  const s=stu(o.studentId);const st=isStudentUser(cur());expireOrders();const p=o.paymentId&&db.payments.find(x=>x.id===o.paymentId);
  if(o.status==='PAID'&&p)return`<div class="paydone"><div class="tick"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path d="M10 16.5l4 4 8-9"/></svg>Payment received</div>
    <p style="margin:6px 0 12px"><b>${inr(o.amount)}</b> · ${E(s.name)} · Semester ${o.sem} · receipt <b class="mono">${E(p.rc)}</b></p>
    <div class="actions" style="justify-content:flex-end"><button class="btn" data-act="closeDialog">Close</button><button class="btn primary" data-act="viewReceipt" data-id="${E(p.id)}">Open receipt</button></div></div>`;
  if(o.status!=='CREATED')return`<p class="err" style="margin:0 0 10px">${o.status==='FAILED'?'The payment failed. No money was taken.':o.status==='CANCELLED'?'This payment request was cancelled.':'This QR has expired (15 minutes).'}</p><div class="actions" style="justify-content:flex-end"><button class="btn" data-act="closeDialog">Close</button></div>`;
  const left=Math.max(0,Math.ceil((UPI_TTL-(Date.now()-o.createdAt))/60000));const live=db.settings.upi.mode==='Live';
  return`<div class="upi-wrap"><div class="qr">${qrSvg(qrTarget(o))}</div>
   <div class="upi-info"><div class="amt-big">${inr(o.amount)}</div><div>${E(s.name)} · ${E(s.enrol)}</div><small class="muted">Semester ${o.sem} tuition fee · Batch ${E(o.batch||defaultBatch(s))}</small>
    <div class="waiting"><span class="spin" aria-hidden="true"></span> Waiting for payment… <small class="muted">QR valid ${left} min</small></div>
    <p class="note" style="margin:6px 0 0">${st?'Scan with Google Pay, PhonePe, Paytm or any UPI app, or tap the button below.':'Show this QR to the student. They scan it with any UPI app and pay. This screen updates by itself.'}
    ${live?'':'<br><b>Demo mode:</b> the QR opens the demo UPI payment page, so no real money moves.'} Invoice date will be ${fmtD(upiInvoiceDate(Date.now()))} (payment date + 1 day).</p></div></div>
   <div class="actions" style="margin-top:12px">
    ${st?`<a class="btn primary big" href="${E(live?upiLink(o):payPageUrl(o))}" ${live?'':'data-act="openPayPage" data-id="'+E(o.id)+'"'}>Pay ${inr(o.amount)} in UPI app</a>`:`<button class="btn primary" data-act="upiSend" data-id="${E(o.id)}" ${o.sentAt?'disabled':''}>${o.sentAt?'Sent to student portal ✓':'Send to student portal'}</button><button class="btn" data-act="upiShare" data-id="${E(o.id)}">Share pay link</button>${live?'':`<button class="btn" data-act="openPayPage" data-id="${E(o.id)}">Open pay page (demo scan)</button>`}`}
    <button class="btn danger" data-act="upiCancel" data-id="${E(o.id)}">Cancel request</button></div>
   ${st||live?'':`<details class="panel sim" style="margin-top:12px"><summary><b>Demo gateway</b> <small class="muted">(in the live system the bank calls our server)</small></summary><div class="actions" style="margin-top:8px"><button class="btn" data-act="gwFail" data-id="${E(o.id)}">Webhook: payment failed</button><button class="btn primary" data-act="gwOk" data-id="${E(o.id)}">Webhook: payment captured</button></div></details>`}`;
}
let upiOpen='',upiTimer=0;
function upiDialog(o){upiOpen=o.id;dialog(`<h3>Pay ${inr(o.amount)} with UPI</h3><p class="muted mono" style="margin:0 0 10px;font-size:12px">Order ${E(o.id)}</p><div id="upiBox" data-st="${E(o.status+(o.sentAt?'s':''))}">${upiBox(o)}</div>`,'UPI payment');
  clearInterval(upiTimer);upiTimer=setInterval(upiRefresh,1500)}
/* the waiting screen refreshes itself: a payment from another tab / the student's portal / the webhook shows up at once */
function upiRefresh(){const box=document.getElementById('upiBox');if(!box||!upiOpen){clearInterval(upiTimer);upiOpen='';return}
  const raw=lsGet(LS_KEY);if(raw){try{const n=JSON.parse(raw);if(n&&n.ver===DB_VER)db=n}catch(e){}}
  expireOrders();const o=orderOf(upiOpen);if(!o)return;const was=box.dataset.st;const st=o.status+(o.sentAt?'s':'');box.dataset.st=st;
  if(was!==st)box.innerHTML=upiBox(o);else if(o.status==='CREATED'){const m=box.querySelector('.waiting small');if(m)m.textContent=`QR valid ${Math.max(0,Math.ceil((UPI_TTL-(Date.now()-o.createdAt))/60000))} min`}
  if(o.status!=='CREATED')clearInterval(upiTimer)}
FORM.upiPay=(f,d)=>{
  const u=cur();let s,sem;
  if(isStudentUser(u)){s=stu(u.studentId);sem=+f.dataset.sem}else{need('fees.collect','collect fees');s=stu(ui.col.sid);sem=ui.col.sem;guardStudent(s&&s.id)}
  if(!s||s.status!=='ACTIVE')throw new Error('Choose an active student');const m=semSummary(s,sem);const amount=amountOf(d,m);
  const batch=isStudentUser(u)?(([...db.payments].reverse().find(p=>p.studentId===s.id&&p.batch)||{}).batch||defaultBatch(s)):cleanBatch(d.batch);
  const o=provider.createOrder(s,sem,amount,u.name);Object.assign(o,{batch,source:isStudentUser(u)?'portal':'office',byRole:u.role});
  log('UPI order created','UPI order',o.id,null,{student:s.enrol,sem,amount:inr(amount),from:o.source});save();closeLayer();closeDialog();upiDialog(o);
};
ACT.upiSend=el=>{need('fees.collect');const o=orderOf(el.dataset.id);if(!orderLive(o))throw new Error('This QR is no longer valid');const s=stu(o.studentId);o.sentAt=Date.now();
  notify('payment',`Pay ${inr(o.amount)} · Semester ${o.sem}`,`The college office sent you a UPI payment request. Open Fees and tap Pay now.`,{students:[s.id],portal:'sfees',tone:'warn',self:true});
  log('UPI request sent to portal','UPI order',o.id,null,{student:s.enrol,amount:inr(o.amount)});save();upiRefresh();toast(`Sent to ${s.name}'s portal`)};
ACT.upiShare=async el=>{const o=orderOf(el.dataset.id);if(!orderLive(o))throw new Error('This QR is no longer valid');const s=stu(o.studentId);
  const text=`${db.college.short}: pay ${inr(o.amount)} tuition fee for semester ${o.sem} (${s.name}). Pay here: ${db.settings.upi.mode==='Live'?upiLink(o):payPageUrl(o)}`;
  if(navigator.share){try{await navigator.share({title:'NPCTE fee payment',text});return}catch(e){if(e&&e.name==='AbortError')return}}
  window.open(`https://wa.me/${s.phone?'91'+s.phone:''}?text=${encodeURIComponent(text)}`,'_blank','noopener')};
ACT.upiCancel=el=>{const o=orderOf(el.dataset.id);if(!o||o.status!=='CREATED')return closeDialog();const u=cur();if(isStudentUser(u))guardStudent(o.studentId);else need('fees.collect');
  o.status='CANCELLED';log('UPI request cancelled','UPI order',o.id);save();upiRefresh();toast('Payment request cancelled')};
ACT.openPayPage=(el,e)=>{if(e)e.preventDefault();const o=orderOf(el.dataset.id);if(!o)return;
  if(isStudentUser(cur())){location.href=payPageUrl(o);return}window.open(payPageUrl(o),'_blank','noopener')};
function gwEvent(id,status){const o=orderOf(id);if(!o)throw new Error('Order not found');const paidAt=Date.now();const evt={orderId:o.id,status,amount:o.amount,paidAt,utr:'UTR'+Math.floor(Math.random()*9e11+1e11),txnId:'pay_'+Math.random().toString(36).slice(2,14)};evt.signature=sig(evt.orderId+'|'+evt.status+'|'+evt.amount+'|'+evt.paidAt);return evt}
ACT.gwOk=el=>{const p=handleUpiWebhook(gwEvent(el.dataset.id,'captured'));save();renderPage();upiRefresh();toast(p?'UPI payment captured · '+p.rc:'This order was already handled')};
ACT.gwFail=el=>{handleUpiWebhook(gwEvent(el.dataset.id,'failed'));save();renderPage();upiRefresh();toast('Payment failed. No money was taken.',true)};

/* ---------- demo UPI payment page (what a UPI app shows after scanning). Opened from the QR: /?pay=<order id> ---------- */
function renderPayPage(id){
  const root=$('#root');const o=orderOf(id);expireOrders();const s=o&&stu(o.studentId);
  const shell=b=>`<main class="paypage"><div class="pp-card"><div class="pp-h"><div class="seal" aria-hidden="true">₹</div><div><b>UPI payment</b><small>Demo UPI app · sandbox</small></div></div>${b}</div></main>`;
  if(!o){root.innerHTML=shell(`<p>This payment request is not on this device.</p><p class="note">The demo keeps its data in one browser. Open the QR on the same device as the office screen, or ask the office to use “Webhook: payment captured”. In the live system any phone can pay.</p><a class="btn primary" href="/">Open NPCTE</a>`);return}
  if(o.status==='PAID'){const p=db.payments.find(x=>x.id===o.paymentId);root.innerHTML=shell(`<div class="paydone"><div class="tick"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path d="M10 16.5l4 4 8-9"/></svg>Paid ${inr(o.amount)}</div><p>To ${E(db.college.short)} · ${E(s.name)} · Semester ${o.sem}</p>${p?`<p class="mono">UTR ${E(p.upiRef)} · Receipt ${E(p.rc)}</p>`:''}<a class="btn primary big" href="/">Done</a></div>`);return}
  if(o.status!=='CREATED'){root.innerHTML=shell(`<p class="err">${o.status==='EXPIRED'?'This QR has expired.':o.status==='CANCELLED'?'This request was cancelled.':'This payment failed.'}</p><a class="btn" href="/">Back</a>`);return}
  root.innerHTML=shell(`<div class="pp-amt">${inr(o.amount)}</div><div class="rline"><span>Pay to</span><b>${E(db.college.name)}</b></div><div class="rline"><span>UPI ID</span><span class="mono">${E(o.vpa)}</span></div>
   <div class="rline"><span>For</span><span>${E(s.name)} · Sem ${o.sem} tuition fee</span></div><div class="rline"><span>Order</span><span class="mono" style="font-size:12px">${E(o.id)}</span></div>
   <div class="actions" style="margin-top:16px"><button class="btn big" data-act="ppDecline" data-id="${E(o.id)}">Decline</button><button class="btn primary big" data-act="ppPay" data-id="${E(o.id)}">Pay ${inr(o.amount)}</button></div>
   <p class="note">Demo: no real money moves. Tapping Pay sends the signed gateway webhook; the office screen and the student portal update at once.</p>`);
}
ACT.ppPay=el=>{const p=handleUpiWebhook(gwEvent(el.dataset.id,'captured'));save();ev('Form','UPI paid on pay page',el.dataset.id);renderPayPage(el.dataset.id);if(p)toast('Payment successful · '+p.rc)};
ACT.ppDecline=el=>{handleUpiWebhook(gwEvent(el.dataset.id,'failed'));save();renderPayPage(el.dataset.id)};

/* ---------- receipt view ---------- */
function receiptHtml(p){
  const s=stu(p.studentId);const sv=isStudentUser(cur());const c=db.college;const bal=semSummary(s,p.sem).due;
  return`<div class="receipt ${p.status==='CANCELLED'?'cancelled':''}"><div class="hd"><div><b>${E(c.name)}</b><div class="muted" style="font-size:12px">${E(c.trust)} · ${E(c.address)}</div></div><div class="right"><b class="mono">${E(p.rc)}</b><div class="muted" style="font-size:12px">Invoice date ${fmtD(p.invoiceDate)}</div></div></div>
   ${p.status==='CANCELLED'?`<p class="err" style="margin:0 0 10px">Cancelled on ${fmtT(p.cancelledAt)} by ${E(p.cancelledBy)} · ${E(p.cancelReason)}</p>`:`<div class="tick"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path d="M10 16.5l4 4 8-9"/></svg>Payment received</div>`}
   <div class="rline"><span>Student</span><b>${E(s.name)}</b></div><div class="rline"><span>Enrolment no.</span><span class="mono">${E(s.enrol)}</span></div><div class="rline"><span>Course</span><span>${E(course(s.course).name)} · Semester ${p.sem}</span></div><div class="rline"><span>Batch</span><b>${E(batchOf(p))}</b></div><div class="rline"><span>Fee</span><span>Tuition fee</span></div>
   ${sv?'':`<div class="rline"><span>Mode</span><span>${modeName(p.mode)}${p.mode==='CHEQUE'?` · No. ${E(p.chequeNo)}, ${E(p.bank)}, dated ${fmtD(p.chequeDate)}`:''}${p.mode==='UPI'?` · ${E(p.upiRef)}`:''}</span></div>${p.mode==='EXPENSE'?(p.expenseItems&&p.expenseItems.length?`<div class="expitems"><b>Expense details</b>${p.expenseItems.map((x,i)=>`<div class="rline"><span>${E(x.reason)}${x.doc?` <button class="lnk" data-act="expDocOpen" data-id="${E(p.id)}" data-i="${i}">📎 bill</button>`:''}</span><span>${inr(x.amount)}</span></div>`).join('')}</div>`:p.reason?`<div class="rline"><span>Used for</span><span>${E(p.reason)}</span></div>`:''):''}
   ${p.mode==='UPI'?`<div class="rline"><span>Paid on</span><span>${fmtT(p.paidAt)}</span></div>`:''}<div class="rline"><span>Entered</span><span>${fmtT(p.entryAt)} · ${E(p.by)}</span></div>${p.note?`<div class="rline"><span>Note</span><span>${E(p.note)}</span></div>`:''}`}
   <div class="rline tot"><span>Amount</span><span>${inr(p.amount)}</span></div><div class="rline"><span>Semester ${p.sem} balance now</span><span>${inr(bal)}</span></div>
   ${(p.dateEdits||[]).length?`<p class="note">Invoice date changed: ${p.dateEdits.map(x=>`${fmtD(x.from)} → ${fmtD(x.to)} (${E(x.by)})`).join('; ')}</p>`:''}</div>`;
}
function showReceipt(p,fresh){
  drawer(`<button class="btn x" data-act="close">Close</button><h2>${fresh?'Receipt issued':'Receipt'}</h2><div style="margin-top:14px">${receiptHtml(p)}</div>
   <div class="actions" style="margin-top:14px"><button class="btn primary" data-act="dlPdf" data-id="${E(p.id)}">Download PDF</button><button class="btn" data-act="printReceipt" data-id="${E(p.id)}">Print</button>${isStudentUser(cur())?'':`<button class="btn" data-act="emailReceipt" data-id="${E(p.id)}">Email again</button>`}
   ${!isStudentUser(cur())&&p.status==='SUCCESS'&&can('fees.cancel')?`<button class="btn danger" data-act="cancelAsk" data-id="${E(p.id)}">Cancel receipt</button>`:''}</div>${mailLine(p)}`,false,'Receipt '+p.rc);
}
ACT.viewReceipt=el=>{const p=db.payments.find(x=>x.id===el.dataset.id);if(!p)throw new Error('Receipt not found');guardStudent(p.studentId);if(!isStudentUser(cur()))need('fees.view');showReceipt(p)};
ACT.printReceipt=el=>{const p=db.payments.find(x=>x.id===el.dataset.id);guardStudent(p.studentId);const w=$('#printArea')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'printArea'}));w.innerHTML=receiptHtml(p);document.body.classList.add('printing');setTimeout(()=>{window.print();document.body.classList.remove('printing')},50)};
ACT.cancelAsk=el=>{need('fees.cancel','cancel receipts');const p=db.payments.find(x=>x.id===el.dataset.id);
  dialog(`<h3>Cancel receipt ${E(p.rc)}?</h3><p class="muted" style="margin:0 0 10px">${inr(p.amount)} from ${E(stu(p.studentId).name)}. The receipt stays in the records marked CANCELLED and the semester due goes back up. This cannot be undone.</p>
   <form data-form="cancelReceipt" data-id="${E(p.id)}" class="grid" style="gap:10px">${F('reason','Reason (required)',{type:'textarea',req:true,rows:2,attrs:'maxlength="200" minlength="4"'})}
   <div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Keep receipt</button><button class="btn danger">Cancel receipt</button></div></form>`,'Cancel receipt');$('#f_reason').focus()};
FORM.cancelReceipt=(f,d)=>{const p=db.payments.find(x=>x.id===f.dataset.id);cancelPayment(p,d.reason);const s=stu(p.studentId);
  notify('cancel',`Receipt ${p.rc} cancelled`,`${inr(p.amount)} · ${p.cancelReason}`,{students:[s.id],portal:'sfees',tone:'bad',self:true});
  notify('cancel',`Receipt cancelled · ${s.name}`,`${p.rc} · ${inr(p.amount)} · ${p.cancelReason}`,{sid:s.id,roles:['Super Admin','Principal','Clerk'],staff:'fees',tab:'receipts',tone:'bad'});
  save();closeDialog();closeLayer();renderPage();toast('Receipt cancelled')};

/* an inline date editor for Cash / Cheque / Expense rows; UPI and cancelled rows show plain text */
function dateCell(kind,rec,iso){const editable=can('fees.editdate')&&rec.mode!=='UPI'&&rec.status==='SUCCESS';
  return editable?`<input type="date" class="inl" value="${E(iso)}" max="${today()}" aria-label="Invoice date of ${E(kind==='x'?rec.ref:rec.rc)}" data-change="invDate" data-kind="${kind}" data-id="${E(rec.id)}">`:`<span>${fmtD(iso)}</span>${kind==='p'&&rec.mode==='UPI'?' <small class="muted" title="Payment date + 1 day">auto</small>':''}`}
CHG.invDate=el=>{const kind=el.dataset.kind;const rec=db.payments.find(x=>x.id===el.dataset.id);
  if(!rec)throw new Error('Not found');const v=el.value;if(v>today())throw new Error('Invoice date cannot be in the future');
  const ch=editInvoiceDate(kind,rec,v);if(!ch)return;
  if(kind==='p'){const s=stu(rec.studentId);notify('datechange',`Invoice date changed · ${rec.rc}`,`${fmtD(rec.dateEdits.at(-1).from)} → ${fmtD(v)}. Your receipt was updated.`,{students:[s.id],portal:'sfees',self:true});
    notify('datechange',`Invoice date changed · ${rec.rc}`,`${s.name}: ${fmtD(rec.dateEdits.at(-1).from)} → ${fmtD(v)}`,{sid:s.id,roles:['Super Admin','Principal'],staff:'audit',tab:'activity'})}
  save();toast(`Invoice date saved: ${fmtD(v)}${kind==='p'?' · receipt regenerated':''}`);renderPage()};
/* ---------- 3. pending dues ---------- */
function duesFilter(){return ui.f['fees.dues']=Object.assign({q:'',course:'',sem:'',cat:'',fund:'',over:'',sort:'due',dir:-1,page:0},ui.f['fees.dues']||{})}
function duesFiltered(){const f=duesFilter();const q=f.q.toLowerCase();
  let l=vStudents().filter(s=>s.status==='ACTIVE').map(s=>({s,sm:feeSum(s)})).filter(({s,sm})=>sm.payable>0&&(!f.course||s.course===f.course)&&(!f.sem||s.sem===+f.sem)&&(!f.cat||s.category===f.cat)&&(!f.fund||s.funding===f.fund)&&(!f.over||sm.overdue)&&(!q||[s.name,s.enrol,s.phone].some(v=>v.toLowerCase().includes(q))));
  const k={due:x=>x.sm.payable,name:x=>x.s.name,course:x=>x.s.course+x.s.sem}[f.sort]||(x=>x.sm.payable);l.sort((a,b)=>{const A=k(a),B=k(b);return(A<B?-1:A>B?1:0)*f.dir});return l}
function feeDues(){
  const f=duesFilter();const sc='fees.dues';const l=duesFiltered();const pg=l.slice(f.page*PAGE,(f.page+1)*PAGE);ui.dueSel=ui.dueSel||new Set();
  return`<div class="panel"><h2>Pending dues ${pill(inr(sum(l,x=>x.sm.payable))+' · '+l.length+' students','warn')}</h2>
   <div class="filters"><input type="search" placeholder="Search" aria-label="Search dues" data-live="sq" data-scope="${sc}" value="${E(f.q)}">${sel(sc,'course','Course',COURSE_OPTS())}${sel(sc,'sem','Semester',SEM_OPTS_())}${sel(sc,'cat','Category',CAT_OPTS)}${sel(sc,'fund','Funding type',FUND_OPTS)}${sel(sc,'over','Overdue',[['','Due + overdue'],['1','Only overdue']])}</div>
   ${can('notices.post')?`<div class="actions" style="margin-bottom:10px"><button class="btn" data-act="remindSel" ${ui.dueSel.size?'':'disabled'}>Send reminder to selected (${ui.dueSel.size})</button><button class="btn primary" data-act="remindAll" ${l.length?'':'disabled'}>Send reminder to all ${l.length} shown</button></div>`:''}
   <div class="tablewrap"><table><thead><tr>${can('notices.post')?`<th><input type="checkbox" aria-label="Select all shown" data-change="dueAll" ${pg.length&&pg.every(x=>ui.dueSel.has(x.s.id))?'checked':''}></th>`:''}${sortTh(sc,'name','Student')}${sortTh(sc,'course','Course · Sem')}<th>Category</th><th>Funding</th><th>Semesters due</th>${sortTh(sc,'due','Due now',1)}<th></th></tr></thead><tbody>
   ${pg.map(({s,sm})=>`<tr>${can('notices.post')?`<td><input type="checkbox" aria-label="Select ${E(s.name)}" data-change="dueSel" data-id="${E(s.id)}" ${ui.dueSel.has(s.id)?'checked':''}></td>`:''}<td><button class="lnk" data-act="openStudent" data-id="${E(s.id)}"><b>${E(s.name)}</b></button><small class="muted" style="display:block">${E(s.enrol)} · ${E(s.phone)}</small></td><td>${E(classLabel(s))}</td><td>${E(s.category)}</td><td>${E(fundLabel(s.funding))}</td>
     <td>${sm.sems.filter(x=>x.started&&x.due>0).map(x=>pill(`S${x.sem} ${inr(x.due)}`,x.overdue?'bad':'warn')).join(' ')}</td><td class="num amt"><b>${inr(sm.payable)}</b></td>
     <td><div class="actions nowrap">${can('fees.collect')?`<button class="btn sm primary" data-act="collectFor" data-id="${E(s.id)}">Collect</button>`:''}${can('notices.post')?`<button class="btn sm" data-act="remindOne" data-id="${E(s.id)}">Remind</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="8" class="empty">No pending dues for these filters. 🎉</td></tr>'}</tbody></table></div>${pager(sc,l.length)}
   <p class="note">Automatic alerts go to each student ${db.settings.reminderDays} days before a due date and again when it is overdue (change in Fee setup).</p></div>`;
}
CHG.dueSel=el=>{el.checked?ui.dueSel.add(el.dataset.id):ui.dueSel.delete(el.dataset.id);renderPage()};
CHG.dueAll=el=>{const f=duesFilter();duesFiltered().slice(f.page*PAGE,(f.page+1)*PAGE).forEach(x=>el.checked?ui.dueSel.add(x.s.id):ui.dueSel.delete(x.s.id));renderPage()};
function remindDialog(ids){
  need('notices.post','send reminders');if(!ids.length)throw new Error('Select at least one student');const one=ids.length===1&&stu(ids[0]);const sm=one&&feeSum(one);
  const firstDue=one&&sm.sems.find(x=>x.started&&x.due>0);
  const msg=one?`Dear ${one.name}, Semester ${firstDue?firstDue.sem:''} fee ${inr(firstDue?firstDue.due:sm.payable)} is pending${firstDue&&firstDue.dueDate?` (due ${fmtD(firstDue.dueDate)})`:''}. Please pay at the accounts office or with UPI from the student portal. – ${db.college.short}`:`Dear student, your semester fee is pending. Please check the Fees page in the student portal and pay at the office or with UPI. – ${db.college.short}`;
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Send fee reminder</h2><p class="muted">${one?E(one.name)+' · '+inr(sm.payable)+' due':ids.length+' students'} · goes to their Notice Board with a live notification and phone popup.</p>
   <form data-form="sendRemind" class="grid" style="gap:12px;margin-top:12px" data-ids="${E(ids.join(','))}">${F('title','Title',{val:one?'Fee pending – Semester '+(firstDue?firstDue.sem:''):'Fee reminder',req:true,attrs:'maxlength="80"'})}${F('body','Message',{type:'textarea',val:msg,req:true,rows:5,attrs:'maxlength="600"'})}
   <div class="actions"><button class="btn primary big">Send to ${ids.length} student${ids.length>1?'s':''}</button><button type="button" class="btn" data-act="close">Cancel</button></div></form>`,false,'Send fee reminder');
}
ACT.remindOne=el=>remindDialog([el.dataset.id]);
ACT.remindSel=()=>remindDialog([...ui.dueSel]);
ACT.remindAll=()=>remindDialog(duesFiltered().map(x=>x.s.id));
FORM.sendRemind=(f,d)=>{need('notices.post');const ids=f.dataset.ids.split(',').filter(id=>stu(id));
  const n={id:uid('n'),title:capText(d.title,'Title'),body:capText(d.body,'Message',600),audience:{type:'students',ids},isFeeAlert:true,isPublic:false,publishAt:Date.now(),createdBy:cur().name,attachment:null};
  db.notices.unshift(n);publishNotice(n,'reminder');log('Fee reminder sent','Notice',n.id,null,{to:ids.length+' students',title:n.title});ui.dueSel=new Set();save();closeLayer();renderPage();toast(`Reminder sent to ${ids.length} student${ids.length>1?'s':''}`)};

/* ---------- 4. receipts ---------- */
function rcFilter(){return ui.f['fees.receipts']=Object.assign({q:'',mode:'',status:'',from:'',to:'',sort:'entry',dir:-1,page:0},ui.f['fees.receipts']||{})}
function receiptsFiltered(){const f=rcFilter();const q=f.q.toLowerCase();
  let l=vPayments().filter(p=>(!f.mode||p.mode===f.mode)&&(!f.status||p.status===f.status)&&(!f.from||p.invoiceDate>=f.from)&&(!f.to||p.invoiceDate<=f.to)&&(!q||[p.rc,stu(p.studentId).name,stu(p.studentId).enrol,p.chequeNo,p.upiRef,batchOf(p),p.reason].some(v=>String(v||'').toLowerCase().includes(q))));
  const k={entry:p=>p.entryAt,date:p=>p.invoiceDate,amount:p=>p.amount,rc:p=>p.rc,name:p=>stu(p.studentId).name}[f.sort]||(p=>p.entryAt);l.sort((a,b)=>{const A=k(a),B=k(b);return(A<B?-1:A>B?1:0)*f.dir});return l}
function feeReceipts(){
  const f=rcFilter();const sc='fees.receipts';const l=receiptsFiltered();const pg=l.slice(f.page*PAGE,(f.page+1)*PAGE);
  return`<div class="panel"><h2>Receipts ${pill(inr(sum(l.filter(p=>p.status==='SUCCESS'),p=>p.amount))+' successful','good')}</h2>
   <div class="filters"><input type="search" placeholder="Receipt no, name, batch, cheque no, UTR" aria-label="Search receipts" data-live="sq" data-scope="${sc}" value="${E(f.q)}">${sel(sc,'mode','Mode',[['','All modes'],['CASH','Cash'],['CHEQUE','Cheque'],['UPI','UPI'],['EXPENSE','Expense']])}${sel(sc,'status','Status',[['','All status'],['SUCCESS','Success'],['CANCELLED','Cancelled']])}
    <label class="dl">From <input type="date" value="${E(f.from)}" data-change="sf" data-scope="${sc}" data-k="from"></label><label class="dl">To <input type="date" value="${E(f.to)}" data-change="sf" data-scope="${sc}" data-k="to"></label></div>
   <div class="tablewrap"><table><thead><tr>${sortTh(sc,'rc','Receipt')}${sortTh(sc,'date','Invoice date')}${sortTh(sc,'entry','Entered')}${sortTh(sc,'name','Student')}<th>Batch</th><th>Sem</th><th>Mode</th>${sortTh(sc,'amount','Amount',1)}<th>Status</th><th></th></tr></thead><tbody>
   ${pg.map(p=>{const s=stu(p.studentId);return`<tr><td class="mono">${E(p.rc)}</td><td>${dateCell('p',p,p.invoiceDate)}</td><td><small>${fmtT(p.entryAt)}</small></td><td><button class="lnk" data-act="openStudent" data-id="${E(s.id)}">${E(s.name)}</button></td><td class="mono">${E(batchOf(p))}</td><td>${p.sem}</td><td>${modePill(p.mode)}</td><td class="num amt">${inr(p.amount)}</td><td>${payPill(p.status)}${p.depositId?' '+pill('Deposited'):''}</td>
    <td><div class="actions nowrap"><button class="btn sm" data-act="viewReceipt" data-id="${E(p.id)}">View</button>${p.status==='SUCCESS'&&can('fees.cancel')?`<button class="btn sm danger" data-act="cancelAsk" data-id="${E(p.id)}">Cancel</button>`:''}</div></td></tr>`}).join('')||'<tr><td colspan="10" class="empty">No receipts for these filters.</td></tr>'}</tbody></table></div>${pager(sc,l.length)}
   <p class="note">Change the invoice date of a Cash, Cheque or Expense receipt right in the table: the receipt PDF is regenerated and the change is logged (old → new). UPI dates are fixed. A payment is never deleted; cancel it with a reason.</p></div>`;
}

/* ---------- 5. fee setup ---------- */
function feeSetup(){
  need('fees.setup','fee setup');const st=db.settings,c=db.college;const SEMS=SEMS_ALL();const cs=scopeCourses();const na='<td class="muted">—</td>';
  return`<div class="sgrid">
  <form class="scard" data-form="feeDefaults"><h2>Default tuition fee per semester</h2><p class="note" style="margin:0 0 10px">Only tuition fee is collected. These amounts pre-fill the semesters when a student is added. Existing students keep their own amounts.</p>
   <div class="tablewrap"><table class="matrix"><thead><tr><th>Course</th>${SEMS.map(n=>`<th>Sem ${n} (₹)</th>`).join('')}</tr></thead><tbody>${cs.map(co=>`<tr><td><b>${E(co.name)}</b></td>${SEMS.map(n=>n>co.semesters?na:`<td><input name="${co.id}_${n}" inputmode="decimal" value="${((st.feeDefault[co.id]||[])[n-1]||0)/100}" aria-label="${E(co.name)} semester ${n} tuition fee" class="numin"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
   <h3>Due date per semester <small class="muted">(MM-DD · OPEN: confirm with the college)</small></h3><div class="tablewrap"><table class="matrix"><thead><tr><th>Course</th>${SEMS.map(n=>`<th>Sem ${n}</th>`).join('')}</tr></thead><tbody>${cs.map(co=>`<tr><td><b>${E(co.name)}</b></td>${SEMS.map(n=>n>co.semesters?na:`<td><input name="d_${co.id}_${n}" value="${E((st.dueDates[co.id]||[])[n-1]||'')}" placeholder="MM-DD" pattern="\\d{2}-\\d{2}" aria-label="${E(co.name)} semester ${n} due date" class="numin"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
   <div class="form" style="margin-top:10px">${F('reminderDays','Fee alert: days before due date',{type:'number',val:st.reminderDays,attrs:'min="1" max="60"'})}</div>
   <div class="actions" style="margin-top:12px"><button class="btn primary">Save fees and due dates</button></div></form>
  <form class="scard" data-form="receiptSetup"><h2>Receipt numbering</h2><div class="form">${F('receiptPrefix','Prefix',{val:c.receiptPrefix,req:true,attrs:'maxlength="16"'})}${F('nextReceipt','Next number',{type:'number',val:c.nextReceipt,req:true,attrs:'min="1"'})}</div>
   <p class="note">Next receipt: <b class="mono">${E(c.receiptPrefix+pad(c.nextReceipt,4))}</b>. The number can only go up, never back to a used one. (OPEN: send us the receipt format used today.)</p>
   <div class="actions" style="margin-top:12px"><button class="btn primary">Save</button></div></form>
  <form class="scard" data-form="upiSetup"><h2>UPI / Google Pay</h2><div class="form">${F('provider','Payment gateway',{val:st.upi.provider,opts:Object.entries(PaymentProviders).filter(([k])=>k!=='GooglePay').map(([k,v])=>[k,v.name])})}${F('mode','Mode',{val:st.upi.mode,opts:['Sandbox','Live']})}${F('vpa','College UPI ID (merchant VPA)',{val:st.upi.vpa,req:true,span:1,attrs:'maxlength="60"'})}</div>
   <label class="chk" style="margin-top:10px"><input type="checkbox" name="googlePay" ${st.upi.googlePay?'checked':''}> Use the direct Google Pay adapter (switch on only if Google approves the college's account)</label>
   <p class="note">Gateway keys and the webhook secret are stored on the server only and are never sent to the browser. (OPEN: which bank / gateway does the college allow?)</p>
   <div class="actions" style="margin-top:12px"><button class="btn primary">Save UPI settings</button></div></form></div>`;
}
FORM.feeDefaults=(f,d)=>{need('fees.setup');const st=db.settings;const before={fees:JSON.stringify(st.feeDefault),due:JSON.stringify(st.dueDates),days:st.reminderDays};
  const nf={...st.feeDefault},nd={...st.dueDates};scopeCourses().forEach(co=>{const SEMS=semsOf(co.id);nf[co.id]=SEMS.map(n=>{const a=toPaise(d[co.id+'_'+n]);if(!(a>=0)||a>100000000)throw new Error(`${co.name} semester ${n}: enter a valid amount`);return a});nd[co.id]=SEMS.map(n=>{const v=String(d[`d_${co.id}_${n}`]||'').trim();if(v&&!(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)))throw new Error(`${co.name} semester ${n} due date: use MM-DD`);return v})});
  const rd=+d.reminderDays;if(!(rd>=1&&rd<=60))throw new Error('Reminder days must be 1 to 60');
  st.feeDefault=nf;st.dueDates=nd;st.reminderDays=rd;log('Fee setup changed','Settings','fees',before,{fees:JSON.stringify(nf),due:JSON.stringify(nd),days:rd});ntSync();save();renderPage();toast('Fee setup saved')};
FORM.receiptSetup=(f,d)=>{need('fees.setup');const c=db.college,st=db.settings;const px=capText(d.receiptPrefix,'Prefix',16);if(!/^[A-Za-z0-9\/\-_]+$/.test(px))throw new Error('Prefix can use letters, numbers, / - _');
  const n=+d.nextReceipt;const used=Math.max(0,...db.payments.filter(p=>p.rc.startsWith(px)).map(p=>+p.rc.slice(px.length)||0));if(!(n>=1)||n<=used)throw new Error(`Next number must be more than ${used} (already used)`);
  const before={prefix:c.receiptPrefix,next:c.nextReceipt};c.receiptPrefix=px;c.nextReceipt=n;
  log('Receipt settings changed','Settings','receipts',before,{prefix:px,next:n});save();renderPage();toast('Saved')};
FORM.upiSetup=(f,d)=>{need('fees.setup');const u=db.settings.upi;const vpa=String(d.vpa||'').trim();if(!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(vpa))throw new Error('Enter a valid UPI ID like college@okaxis');const before={...u};
  Object.assign(u,{provider:PaymentProviders[d.provider]?d.provider:'Razorpay',mode:d.mode==='Live'?'Live':'Sandbox',vpa,googlePay:!!d.googlePay});log('UPI settings changed','Settings','upi',before,{...u});save();renderPage();toast('UPI settings saved')};
