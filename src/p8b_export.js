/* =====================================================================
   One export for every list: the Export button opens a dialog, the user ticks the fields
   (columns) and picks Excel (.xlsx), CSV or PDF. The file has exactly the rows of the list
   as filtered and sorted on screen (all pages), in the same format as the screen.
   Each list registers {title, perm, rows(), cols:[{k,label,type,get,def,g}], sub?(), okRow?(), summary?()}
   type: text | int | money (paise) | date (yyyy-mm-dd) | datetime (timestamp)
   ===================================================================== */
const EXPORTS={};
const XC=(k,label,type,get,def,g)=>({k,label,type:type||'text',get,def:!!def,g:g||''});
const yesNo=v=>v?'Yes':'No';
const SEM_STATUS=x=>!x.amount?'No fee':x.due===0?'Paid':!x.started?'Upcoming':x.overdue?'Overdue':x.paid?'Part paid':'Due';

/* ---------- the lists ---------- */
const stuCols=(g='Student')=>[XC('enrol','Enrolment no','text',r=>r.s.enrol,1,g),XC('name','Student name','text',r=>r.s.name,1,g),XC('phone','Mobile','text',r=>r.s.phone,0,g),XC('email','Email','text',r=>r.s.email,0,g),
  XC('course','Course','text',r=>course(r.s.course).name,1,'Course'),XC('batch','Batch','text',r=>defaultBatch(r.s),1,'Course'),XC('sem','Semester','int',r=>r.s.sem,1,'Course'),
  XC('cat','Category','text',r=>r.s.category,0,'Course'),XC('fund','Funding','text',r=>fundLabel(r.s.funding),0,'Course'),XC('ref','Admission reference','text',r=>r.s.ref||'',0,'Course')];
EXPORTS.students={title:'Students',perm:'students.view',rows:()=>studentsFiltered(),cols:()=>[...stuCols(),
  XC('gender','Gender','text',r=>({F:'Female',M:'Male',O:'Other'}[r.s.gender]||''),0,'Student'),XC('dob','Date of birth','date',r=>r.s.dob,0,'Student'),XC('address','Address','text',r=>r.s.address,0,'Student'),
  XC('status','Status','text',r=>statusLabel[r.s.status],0,'Course'),
  ...SEMS_ALL().map(n=>XC('fee'+n,`Sem ${n} fee`,'money',r=>(semFee(r.s,n)||{}).amount||0,0,'Fees')),
  XC('total','Total fee','money',r=>r.sm.total,0,'Fees'),XC('paid','Paid','money',r=>r.sm.paid,1,'Fees'),XC('due','Due now','money',r=>r.sm.payable,1,'Fees'),XC('upc','Upcoming','money',r=>r.sm.upcoming,0,'Fees'),XC('over','Overdue','text',r=>yesNo(r.sm.overdue),0,'Fees')]};
EXPORTS['fees.collect']={title:'Fee collection',perm:'fees.view',rows:()=>colRows(),cols:()=>[...stuCols(),
  ...SEMS_ALL().flatMap(n=>[XC('d'+n,`Sem ${n} due`,'money',r=>r.sm.sems[n-1]?r.sm.sems[n-1].due:0,1,'Semesters'),XC('st'+n,`Sem ${n} status`,'text',r=>r.sm.sems[n-1]?SEM_STATUS(r.sm.sems[n-1]):'',0,'Semesters')]),
  XC('total','Total fee','money',r=>r.sm.total,0,'Fees'),XC('paid','Paid','money',r=>r.sm.paid,1,'Fees'),XC('due','Due now','money',r=>r.sm.payable,1,'Fees'),XC('upc','Upcoming','money',r=>r.sm.upcoming,0,'Fees')]};
EXPORTS['fees.dues']={title:'Pending dues',perm:'fees.view',rows:()=>duesFiltered(),cols:()=>[...stuCols().map(c=>['phone','cat','fund'].includes(c.k)?{...c,def:true}:c),
  XC('sems','Semesters due','text',r=>r.sm.sems.filter(x=>x.started&&x.due>0).map(x=>`Sem ${x.sem} ${inr(x.due)}${x.overdue?' (overdue)':''}`).join('; '),1,'Fees'),
  XC('oldest','Oldest due date','date',r=>(r.sm.sems.find(x=>x.started&&x.due>0)||{}).dueDate||'',0,'Fees'),XC('over','Overdue','text',r=>yesNo(r.sm.overdue),1,'Fees'),XC('due','Due now','money',r=>r.sm.payable,1,'Fees')]};
const payCols=g=>[XC('rc','Receipt no','text',p=>p.rc,1,'Invoice'),XC('date','Invoice date','date',p=>p.invoiceDate,1,'Invoice'),XC('entry','Entry time','datetime',p=>p.entryAt,0,'Invoice'),
  XC('name','Student name','text',p=>stu(p.studentId).name,1,'Student'),XC('enrol','Enrolment no','text',p=>stu(p.studentId).enrol,1,'Student'),XC('course','Course','text',p=>course(stu(p.studentId).course).name,1,'Course'),
  XC('batch','Batch','text',p=>batchOf(p),1,'Course'),XC('sem','Semester','int',p=>p.sem,1,'Course'),XC('cat','Category','text',p=>stu(p.studentId).category,0,'Student'),XC('fund','Funding','text',p=>fundLabel(stu(p.studentId).funding),0,'Student'),
  XC('ref','Admission reference','text',p=>stu(p.studentId).ref||'',0,'Student'),
  XC('mode','Mode','text',p=>modeName(p.mode),1,'Payment'),XC('amount','Amount','money',p=>p.amount,1,'Payment'),XC('exp','Expense now','money',p=>payExp(p),0,'Payment'),XC('cih','Cash in hand','money',p=>payCih(p),0,'Payment'),XC('tobank','To bank','money',p=>payToBank(p),0,'Payment'),XC('status','Status','text',p=>({SUCCESS:'Success',CANCELLED:'Cancelled',FAILED:'Failed'}[p.status]||p.status),1,'Payment'),
  XC('dep','Deposited','text',p=>payToBank(p)>0?yesNo(p.depositId):'',0,'Payment'),XC('chq','Cheque no','text',p=>p.chequeNo||'',0,'Payment'),XC('bank','Bank','text',p=>p.bank||'',0,'Payment'),
  XC('chqd','Cheque date','date',p=>p.chequeDate||'',0,'Payment'),XC('upi','UPI ref','text',p=>p.upiRef||'',0,'Payment'),XC('reason','Expense / reason','text',p=>p.reason||'',0,'Payment'),
  XC('note','Office note','text',p=>p.note||'',0,'Payment'),XC('by','Entered by','text',p=>p.by||'',0,'Payment'),XC('cancel','Cancel reason','text',p=>p.cancelReason||'',0,'Payment')];
const modeTotals=(l,get)=>{const ok=l.filter(x=>get(x).status==='SUCCESS');return[...PAY_MODES.map(m=>[modeName(m)+' (successful)',sum(ok.filter(x=>get(x).mode===m),x=>get(x).amount)]),['Of cash: expense now',sum(ok,x=>payExp(get(x)))],['Of cash: cash in hand',sum(ok,x=>payCih(get(x)))]]};
EXPORTS['fees.receipts']={title:'Receipts',perm:'fees.view',rows:()=>receiptsFiltered(),cols:()=>payCols(),okRow:p=>p.status==='SUCCESS',summary:l=>modeTotals(l,p=>p)};
EXPORTS['audit.tx']={title:'Transactions audit',perm:'audit.view',rows:()=>txFiltered().map(r=>r.rec),cols:()=>payCols(),okRow:p=>p.status==='SUCCESS',summary:l=>modeTotals(l,p=>p),
  sub:()=>{const f=txFilter();return`${f.from?fmtD(f.from):'Start'} to ${f.to?fmtD(f.to):fmtD(today())}${f.modes.length?' · '+f.modes.map(modeName).join(', '):''}`}};
EXPORTS['audit.dep']={title:'Not yet deposited',perm:'audit.view',rows:()=>depPending(),cols:()=>payCols().filter(c=>['rc','date','name','enrol','course','batch','sem','mode','amount','tobank','chq','bank','chqd','by'].includes(c.k)).map(c=>({...c,def:['rc','date','name','course','mode','tobank','chq'].includes(c.k)})),
  sub:()=>{const{from,to}=depPeriod();return`${fmtD(from)} to ${fmtD(to)}`}};
EXPORTS['audit.depmade']={title:'Deposits made',perm:'audit.view',rows:()=>db.deposits.slice().sort((a,b)=>b.at-a.at),cols:()=>[XC('on','Deposited on','date',d=>d.depositedOn,1,'Deposit'),XC('from','Period from','date',d=>d.periodFrom,1,'Deposit'),
  XC('to','Period to','date',d=>d.periodTo,1,'Deposit'),XC('n','Entries','int',d=>d.count,1,'Deposit'),XC('total','Total','money',d=>d.total,1,'Deposit'),XC('ref','Bank ref','text',d=>d.bankRef,1,'Deposit'),XC('by','Marked by','text',d=>d.by,1,'Deposit'),XC('at','Marked on','datetime',d=>d.at,0,'Deposit')]};
/* change 4: cash in hand lists */
EXPORTS['cash.lots']={title:'Cash in hand by student',perm:'cash.view',rows:()=>cashLotRows(),cols:()=>[XC('date','Received','date',p=>p.invoiceDate,1,'Receipt'),XC('rc','Receipt no','text',p=>p.rc,1,'Receipt'),XC('name','Student name','text',p=>stu(p.studentId).name,1,'Student'),XC('enrol','Enrolment no','text',p=>stu(p.studentId).enrol,1,'Student'),XC('course','Course','text',p=>course(payCourse(p)).name,1,'Student'),
  XC('kept','Kept','money',p=>payCih(p),1,'Cash in hand'),XC('used','Used for expenses','money',p=>cihUsed(p),1,'Cash in hand'),XC('dep','Deposited to bank','money',p=>cihDeposited(p),1,'Cash in hand'),XC('left','Left','money',p=>cihLeft(p),1,'Cash in hand')]};
EXPORTS['cash.register']={title:'Cash in hand register',perm:'cash.view',rows:()=>cashRegRows(),cols:()=>[XC('date','Date','date',e=>e.date,1,'Entry'),XC('kind','Type','text',e=>e.kind,1,'Entry'),XC('ref','Ref','text',e=>e.ref,1,'Entry'),XC('text','Details','text',e=>e.text,1,'Entry'),XC('course','Course','text',e=>course(e.course).name,0,'Entry'),
  XC('in','In','money',e=>e.inA,1,'Amount'),XC('out','Out','money',e=>e.outA,1,'Amount'),XC('bal','Balance','money',e=>e.bal,1,'Amount')]};
EXPORTS['cash.spends']={title:'Expenses from cash in hand',perm:'cash.view',rows:()=>cashSpendRows(),cols:()=>[XC('ref','Ref','text',x=>x.ref,1,'Expense'),XC('date','Date','date',x=>x.date,1,'Expense'),XC('course','Course','text',x=>course(x.course).name,0,'Expense'),XC('reason','Details','text',x=>x.items.map(i=>i.reason+' '+inr(i.amount)).join('; '),1,'Expense'),
  XC('amount','Amount','money',x=>x.amount,1,'Expense'),XC('from','Taken from','text',x=>allocText(x),1,'Expense'),XC('bills','Bills attached','int',x=>x.items.filter(i=>i.doc).length,0,'Expense'),XC('by','Entered by','text',x=>x.by,1,'Expense'),XC('status','Status','text',x=>x.status==='ACTIVE'?'Active':'Cancelled: '+(x.cancelReason||''),1,'Expense')]};
EXPORTS['cash.deposits']={title:'Cash in hand deposited',perm:'cash.view',rows:()=>cashDepRows(),cols:()=>[XC('ref','Ref','text',d=>d.ref,1,'Deposit'),XC('on','Deposited on','date',d=>d.depositedOn,1,'Deposit'),XC('course','Course','text',d=>course(d.course).name,0,'Deposit'),
  XC('who','Students','text',d=>d.lines.map(a=>{const p=payById(a.pid);return p?stu(p.studentId).name+' '+inr(a.amount):''}).join('; '),1,'Deposit'),XC('total','Total','money',d=>d.total,1,'Deposit'),XC('bank','Bank ref','text',d=>d.bankRef,1,'Deposit'),XC('by','Marked by','text',d=>d.by,1,'Deposit')]};
EXPORTS.activity={title:'Activity log',perm:'activity.view',rows:()=>actFiltered(),cols:()=>[XC('at','Time','datetime',a=>a.at,1,'Who'),XC('who','Who','text',a=>a.actor,1,'Who'),XC('role','Role','text',a=>a.role,1,'Who'),
  XC('action','Action','text',a=>a.action,1,'What'),XC('entity','Entity','text',a=>a.entity,0,'What'),XC('rec','Record','text',a=>a.entityId,1,'What'),XC('change','Before → after','text',a=>diffText(a.before,a.after),1,'What'),
  XC('detail','Detail','text',a=>a.detail,0,'What'),XC('ip','IP','text',a=>a.ip,0,'Device'),XC('dev','Device','text',a=>a.device,0,'Device')]};
EXPORTS.events={title:'Event log',perm:'activity.view',rows:()=>evFiltered(),cols:()=>[XC('at','Time','datetime',e=>e.at,1,'Who'),XC('who','Who','text',e=>e.actor,1,'Who'),XC('role','Role','text',e=>e.role,0,'Who'),
  XC('cat','Type','text',e=>e.cat,1,'What'),XC('what','What','text',e=>e.label,1,'What'),XC('detail','Detail','text',e=>e.detail,1,'What'),XC('page','Page','text',e=>humanize(e.route),0,'What'),
  XC('course','Course','text',e=>e.course?((course(e.course)||{}).name||e.course):'',0,'What'),XC('status','Status','text',e=>e.status,0,'What'),XC('dev','Device','text',e=>e.device,0,'Device')]};

/* ---------- the dialog ---------- */
const EXP_KEY=k=>'npcte_export_'+k;
function expSaved(k){try{return JSON.parse(lsGet(EXP_KEY(k))||'null')}catch(e){return null}}
ACT.expOpen=el=>{const k=el.dataset.key,X=EXPORTS[k];if(!X)throw new Error('Nothing to export');need(X.perm,'export '+X.title.toLowerCase());
  const cols=X.cols(),n=X.rows().length,sv=expSaved(k)||{};const on=new Set(sv.cols&&sv.cols.some(c=>cols.some(x=>x.k===c))?sv.cols:cols.filter(c=>c.def).map(c=>c.k));const fmt=sv.fmt||'xlsx';
  const groups=[...new Set(cols.map(c=>c.g))];
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Export · ${E(X.title)}</h2>
   <p class="muted" style="margin:2px 0 14px">${n.toLocaleString('en-IN')} row${n===1?'':'s'} · the list as filtered and sorted on screen (all pages)${X.sub?' · '+E(X.sub()):''}</p>
   <div class="exp" data-key="${E(k)}">
    <span class="label">File type</span>
    <div class="exp-fmt" role="radiogroup" aria-label="File type">${[['xlsx','Excel','.xlsx · dates and amounts as real values'],['csv','CSV','.csv · plain text, opens anywhere'],['pdf','PDF','.pdf · ready to print or share']].map(([v,t,d])=>`<label class="exp-opt"><input type="radio" name="expFmt" value="${v}" ${fmt===v?'checked':''}><span><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>
    <div class="exp-head"><span class="label">Fields to include <b id="expCount"></b></span><span class="actions"><button type="button" class="btn sm" data-act="expSet" data-v="all">Select all</button><button type="button" class="btn sm" data-act="expSet" data-v="none">Clear</button><button type="button" class="btn sm" data-act="expSet" data-v="def">Default</button></span></div>
    ${groups.map(g=>`<fieldset class="exp-g">${g?`<legend>${E(g)}</legend>`:''}<div class="exp-cols">${cols.filter(c=>c.g===g).map(c=>`<label class="exp-col"><input type="checkbox" name="expCol" value="${E(c.k)}" data-def="${c.def?1:0}" data-change="expCount" ${on.has(c.k)?'checked':''}><span>${E(c.label)}</span></label>`).join('')}</div></fieldset>`).join('')}
    <p class="note">Columns come out in the order shown here. Amounts are in rupees; ${X.okRow?'totals count successful payments only':'money columns get a total row'}.</p>
    <div class="actions exp-go"><button type="button" class="btn primary big" data-act="expGo" ${n?'':'disabled'}>Export ${n.toLocaleString('en-IN')} rows</button><button type="button" class="btn" data-act="close">Cancel</button></div>
   </div>`,true,'Export '+X.title);
  CHG.expCount();
};
CHG.expCount=()=>{const all=$$('input[name=expCol]'),n=all.filter(i=>i.checked).length;const c=$('#expCount');if(c)c.textContent=`(${n} of ${all.length})`;const b=$('[data-act=expGo]');if(b)b.disabled=!n||b.textContent.startsWith('Export 0 ')};
ACT.expSet=el=>{const v=el.dataset.v;$$('input[name=expCol]').forEach(i=>i.checked=v==='all'||(v==='def'&&i.dataset.def==='1'));CHG.expCount()};
ACT.expGo=()=>{const box=$('.exp');const k=box.dataset.key,X=EXPORTS[k];need(X.perm,'export');
  const keys=$$('input[name=expCol]:checked').map(i=>i.value);if(!keys.length)throw new Error('Tick at least one field');
  const fmt=($('input[name=expFmt]:checked')||{}).value||'xlsx';const all=X.cols();const cols=keys.map(k=>all.find(c=>c.k===k)).filter(Boolean);
  lsSet(EXP_KEY(k),JSON.stringify({cols:keys,fmt}));
  const rows=X.rows();const name=`npcte-${X.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${today()}`;
  const t=expTable(X,cols,rows);
  if(fmt==='csv')download(name+'.csv','﻿'+csvOf(cols.map(c=>c.label),[...t.body.map(r=>r.map((v,i)=>expText(cols[i],v,true))),...t.foot.map(r=>r.map((v,i)=>v==null?'':typeof v==='string'?v:expText(cols[i],v,true)))]),'text/csv;charset=utf-8');
  else if(fmt==='xlsx')download(name+'.xlsx',xlsxOf(X.title,cols,t),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  else download(name+'.pdf',pdfBytes(expPdf(X,cols,t)),'application/pdf');
  log('List exported',X.title,'',null,{rows:rows.length,fields:cols.map(c=>c.label).join(', '),format:fmt.toUpperCase()});save();
  closeLayer();toast(`${X.title}: ${rows.length} rows exported as ${{xlsx:'Excel',csv:'CSV',pdf:'PDF'}[fmt]}`)};

/* ---------- values ---------- */
/* body = raw values per column; foot = total rows ([label or null, ... money values]) */
function expTable(X,cols,rows){
  const body=rows.map(r=>cols.map(c=>{const v=c.get(r);return v==null?'':v}));
  const foot=[];const mi=cols.map((c,i)=>c.type==='money'?i:-1).filter(i=>i>=0);
  if(mi.length&&rows.length){const ok=X.okRow||(()=>true);const okRows=rows.filter(ok);
    const tr=cols.map(()=>null);tr[0]=X.okRow?'Total (successful)':'Total';mi.forEach(i=>{if(i===0)return;tr[i]=sum(okRows,r=>+cols[i].get(r)||0)});foot.push(tr);
    const ai=mi.find(i=>cols[i].k==='amount');
    if(X.summary&&ai!==undefined&&ai>0)X.summary(rows).forEach(([lab,v])=>{const r=cols.map(()=>null);r[0]=lab;r[ai]=v;foot.push(r)})}
  return{body,foot};
}
function expText(c,v,csv){if(v===''||v==null)return'';
  switch(c.type){case'money':return csv?(v/100).toFixed(2):amt2(v);case'date':return fmtD(v);case'datetime':return fmtT(v);case'int':return String(v);default:return String(v)}}

/* ---------- Excel (.xlsx): a real workbook, stored in a zip written here (no library) ---------- */
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC_T[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
function zipOf(files){const enc=new TextEncoder();const parts=[],cent=[];let off=0;
  const u16=n=>[n&255,n>>8&255],u32=n=>[n&255,n>>8&255,n>>16&255,n>>>24&255];
  files.forEach(([name,text])=>{const nm=enc.encode(name),data=enc.encode(text),crc=crc32(data);
    const head=[0x50,0x4b,3,4,...u16(20),...u16(0),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),...u16(0)];
    parts.push(new Uint8Array(head),nm,data);
    cent.push(new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nm);
    off+=head.length+nm.length+data.length});
  const csize=sum(cent,x=>x.length);const end=new Uint8Array([0x50,0x4b,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(csize),...u32(off),0,0]);
  const all=[...parts,...cent,end];const out=new Uint8Array(sum(all,x=>x.length));let p=0;all.forEach(x=>{out.set(x,p);p+=x.length});return out}
const xmlEsc=s=>String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const colName=i=>{let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
const xlDate=iso=>{const [y,m,d]=String(iso).slice(0,10).split('-').map(Number);return(Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/864e5};
const xlDateTime=ts=>{const d=istDate(ts);const p=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ts));const g=t=>+p.find(x=>x.type===t).value;return xlDate(d)+(g('hour')*60+g('minute'))/1440};
function xlsxOf(title,cols,t){
  const S={head:1,date:2,datetime:3,money:4,int:5,tot:6,totMoney:7,text:0};
  const cell=(r,i,v,c,total)=>{const ref=colName(i)+r;if(v===''||v==null)return'';
    if(typeof v==='string'&&(total||c.type==='text'||!c))return`<c r="${ref}" t="inlineStr"${total?` s="${S.tot}"`:''}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    if(c.type==='money')return`<c r="${ref}" s="${total?S.totMoney:S.money}"><v>${(+v/100).toFixed(2)}</v></c>`;
    if(c.type==='int')return`<c r="${ref}" s="${S.int}"><v>${+v}</v></c>`;
    if(c.type==='date')return`<c r="${ref}" s="${S.date}"><v>${xlDate(v)}</v></c>`;
    if(c.type==='datetime')return`<c r="${ref}" s="${S.datetime}"><v>${xlDateTime(v).toFixed(6)}</v></c>`;
    return`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`};
  const head=`<row r="1">${cols.map((c,i)=>`<c r="${colName(i)}1" t="inlineStr" s="${S.head}"><is><t>${xmlEsc(c.label)}</t></is></c>`).join('')}</row>`;
  const body=t.body.map((r,j)=>`<row r="${j+2}">${r.map((v,i)=>cell(j+2,i,v,cols[i])).join('')}</row>`).join('');
  const foot=t.foot.map((r,j)=>{const n=t.body.length+3+j;return`<row r="${n}">${r.map((v,i)=>v==null?'':cell(n,i,v,cols[i],true)).join('')}</row>`}).join('');
  const width=cols.map((c,i)=>{const w=Math.max(c.label.length+2,...t.body.slice(0,300).map(r=>expText(c,r[i]).length+1),c.type==='money'?14:c.type==='datetime'?19:c.type==='date'?12:6);return Math.min(60,w)});
  const last=colName(cols.length-1)+(t.body.length+1);
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${width.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${head}${body}${foot}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<${"s"}tyleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd\\-mm\\-yyyy"/><numFmt numFmtId="165" formatCode="dd\\-mm\\-yyyy\\ hh:mm\\ AM/PM"/><numFmt numFmtId="166" formatCode="[&gt;=10000000]&quot;₹&quot;##\\,##\\,##\\,##0.00;[&gt;=100000]&quot;₹&quot;##\\,##\\,##0.00;&quot;₹&quot;##,##0.00"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF14284B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF6ECD8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="166" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></${"s"}tyleSheet>`;
  const sn=xmlEsc(title.replace(/[\\\/?*\[\]:]/g,' ').slice(0,31));
  return zipOf([
    ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sn}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${sn.replace(/'/g,"''")}'!$A$1:$${colName(cols.length-1)}$${t.body.length+1}</definedName></definedNames></workbook>`],
    ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml',sheet],['xl/styles.xml',styles]]);
}

/* ---------- PDF: a table over as many pages as needed, landscape when the table is wide ---------- */
function expPdf(X,cols,t){
  const SZ=8,LH=10,PADX=5,PADY=5,MX=28;
  const cellTxt=(c,v)=>expText(c,v);
  const natural=cols.map((c,i)=>{const sample=t.body.slice(0,400).map(r=>pdfW(cellTxt(c,r[i]),SZ));return Math.max(pdfW(c.label,SZ,true)*.9,Math.min(230,Math.max(24,...sample)))+PADX*2});
  const totalW=sum(natural,x=>x);const land=totalW>595-MX*2||cols.length>7;const PW=land?842:595,PH=land?595:842,avail=PW-MX*2;
  const scale=Math.min(1.6,avail/totalW);let ws=natural.map(w=>w*scale);if(totalW>avail){const min=46;ws=natural.map(w=>Math.max(min,w*scale));const k=avail/sum(ws,x=>x);ws=ws.map(w=>w*k)}
  const lines=(txt,w,bold)=>{const words=pdfSafe(txt).split(/\s+/).filter(Boolean);const out=[];let cur='';words.forEach(wd=>{const tr=cur?cur+' '+wd:wd;if(pdfW(tr,SZ,bold)>w-PADX*2&&cur){out.push(cur);cur=wd}else cur=tr});if(cur)out.push(cur);
    return(out.length?out:['']).slice(0,4).map((l,i,a)=>{let s=l;while(pdfW(s,SZ,bold)>w-PADX*2&&s.length>1)s=s.slice(0,-1);return i===3&&a.length===4&&out.length>4?s.slice(0,-1)+'...':s})};
  const hdrLines=cols.map((c,i)=>lines(c.label,ws[i],true));const hdrH=Math.max(...hdrLines.map(l=>l.length))*LH+PADY*2;
  const rows=[...t.body.map(r=>({r,foot:false})),...t.foot.map(r=>({r,foot:true}))].map(o=>{const ls=o.r.map((v,i)=>v==null?['']:lines(typeof v==='string'&&o.foot?v:cellTxt(cols[i],v),ws[i],o.foot));return{...o,ls,h:Math.max(...ls.map(l=>l.length))*LH+PADY*2}});
  const top0=84,bottom=PH-34;const pages=[[]];let y=top0+hdrH;rows.forEach(r=>{if(y+r.h>bottom&&pages.at(-1).length){pages.push([]);y=top0+hdrH}pages.at(-1).push(r);y+=r.h});
  const c=db.college,n=pages.length,now=Date.now(),stamp=istDate(now).replace(/-/g,'');
  return makePdf(g=>{pages.forEach((pg,pi)=>{if(pi)g.newPage();
    g.rect(0,0,PW,52,'#14284b');g.rect(0,52,PW,3,'#b8862b');
    g.text(MX,24,c.name,{size:12.5,bold:true,color:'#ffffff'});g.text(MX,40,`${c.short} ERP · ${(c.rcpt&&c.rcpt.address)||c.address}`,{size:8,color:'#d7def0'});
    g.text(PW-MX,24,X.title,{size:12.5,bold:true,color:'#f3d9a4',align:'right'});g.text(PW-MX,40,`${t.body.length.toLocaleString('en-IN')} rows`,{size:8,color:'#d7def0',align:'right'});
    g.text(MX,72,(X.sub?X.sub()+' · ':'')+`Generated ${fmtT(now)} by ${cur()?cur().name:'-'}`,{size:8,color:'#5b6679'});
    let x=MX,yy=top0;const BL=PADY+SZ*.78;g.rect(MX,yy,avail,hdrH,'#2b2c7e');
    cols.forEach((col,i)=>{const right=col.type==='money'||col.type==='int';hdrLines[i].forEach((l,j)=>g.text(right?x+ws[i]-PADX:x+PADX,yy+BL+j*LH,l,{size:SZ,bold:true,color:'#ffffff',align:right?'right':'left'}));x+=ws[i]});
    yy+=hdrH;pg.forEach((r,ri)=>{if(r.foot)g.rect(MX,yy,avail,r.h,'#f6ecd8');else if(ri%2)g.rect(MX,yy,avail,r.h,'#f4f6fb');
      x=MX;cols.forEach((col,i)=>{const right=col.type==='money'||col.type==='int';r.ls[i].forEach((l,j)=>g.text(right?x+ws[i]-PADX:x+PADX,yy+BL+j*LH,l,{size:SZ,bold:r.foot,color:'#1f2328',align:right?'right':'left'}));x+=ws[i]});
      yy+=r.h});
    g.line(MX,yy,MX+avail,yy,'#d3d6e6',.6);
    g.text(MX,PH-16,`${c.short} · ${X.title} · exported ${fmtD(istDate(now))}`,{size:7.5,color:'#6b7280'});g.text(PW-MX,PH-16,`Page ${pi+1} of ${n}`,{size:7.5,color:'#6b7280',align:'right'});
  })},{title:`${c.short} ${X.title}`,author:c.name,date:stamp+'000000',w:PW,h:PH});
}
