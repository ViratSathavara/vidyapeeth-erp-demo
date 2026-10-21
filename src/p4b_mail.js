/* =====================================================================
   Receipt PDF and e-mail.
   - Every payment (counter, gateway, parent or student portal) builds a real PDF receipt in the browser
     and e-mails it to the parent and/or the student.
   - Demo mode keeps a visible outbox and sends nothing. Live mode posts the PDF to /api/send-receipt
     (a small server function in the deploy package) which hands it to the mail provider.
   ===================================================================== */
const MAIL_DELAY=900;
const MAIL_RE=/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;
const mailCfg=()=>db.settings.mail;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- PDF writer (A4, Helvetica, no libraries so it works offline) ---------- */
const HELV=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
function pdfSafe(t){
  return String(t??'').replace(/₹/g,'Rs. ').replace(/[–—]/g,'-').replace(/[·•]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...')
    .replace(/[^\x20-\x7e]/g,c=>{let n='';try{n=c.normalize('NFD').replace(/[̀-ͯ]/g,'')}catch(e){}return /^[\x20-\x7e]+$/.test(n)?n:'?'});
}
const pdfW=(t,size,bold)=>sum([...pdfSafe(t)],c=>HELV[c.charCodeAt(0)-32]||556)*size/1000*(bold?1.06:1);
const pdfEsc=t=>pdfSafe(t).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
function makePdf(draw,meta){
  const H=842,out=[];const col=h=>{const n=parseInt(h.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255].map(v=>v.toFixed(3)).join(' ')};
  const api={
    rect(x,y,w,h,fill){out.push(`${col(fill)} rg ${x} ${H-y-h} ${w} ${h} re f`)},
    line(x1,y1,x2,y2,stroke='#d7dce5',w=.8){out.push(`${col(stroke)} RG ${w} w ${x1} ${H-y1} m ${x2} ${H-y2} l S`)},
    text(x,y,t,o={}){const{size=10,bold=false,color='#1b2437',align='left'}=o;const w=pdfW(t,size,bold);const px=align==='right'?x-w:align==='center'?x-w/2:x;
      out.push(`BT /${bold?'F2':'F1'} ${size} Tf ${col(color)} rg ${px.toFixed(2)} ${(H-y).toFixed(2)} Td (${pdfEsc(t)}) Tj ET`)},
    stamp(t,o={}){const{size=70,color='#f3c4c4',x=300,y=470}=o;const w=pdfW(t,size,true);const c=Math.cos(Math.PI/4),s=Math.sin(Math.PI/4);
      out.push(`q ${c.toFixed(4)} ${s.toFixed(4)} ${(-s).toFixed(4)} ${c.toFixed(4)} ${x} ${H-y} cm BT /F2 ${size} Tf ${col(color)} rg ${(-w/2).toFixed(1)} 0 Td (${pdfEsc(t)}) Tj ET Q`)},
    wrap(x,y,t,width,o={}){const size=o.size||10,words=pdfSafe(t).split(/\s+/);let line='',yy=y;words.forEach(w=>{const tr=line?line+' '+w:w;if(pdfW(tr,size,o.bold)>width&&line){api.text(x,yy,line,o);yy+=size+4;line=w}else line=tr});if(line){api.text(x,yy,line,o);yy+=size+4}return yy}
  };
  draw(api);
  const content=out.join('\n');
  const objs=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${pdfEsc(meta.title)}) /Author (${pdfEsc(meta.author)}) /Producer (Vidyapeeth ERP) /CreationDate (D:${meta.date}) >>`
  ];
  let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offs=[];
  objs.forEach((o,i)=>{offs.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});
  const xref=pdf.length;
  pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
const rs=n=>'Rs. '+Math.round(n||0).toLocaleString('en-IN');

/* one place that gathers everything a receipt shows, used by the PDF, the e-mail and the text version */
function receiptData(p){
  const s=stu(p.studentId),c=course(s.course),b=batchOf(s.batch);
  return{p,s,c,b,college:db.settings.college,city:db.settings.city,cancelled:p.status!=='ok',
    rows:(p.alloc||[]).filter(a=>a.applied>0||a.amount>0).map(a=>({name:a.name,before:a.before,applied:a.applied,left:a.amount-a.after})),
    cls:classLabel(s)};
}
function receiptPdf(p){
  const d=receiptData(p),s=d.s;const ts=new Date(p.ts||Date.now());
  const stamp=`${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  return makePdf(g=>{
    const INK='#1b2437',MUT='#5b6679',LINE='#d7dce5',ACC='#2a55c8';
    g.rect(0,0,595,96,ACC);
    g.text(40,44,d.college,{size:19,bold:true,color:'#ffffff'});
    g.text(40,66,`Fee receipt - ${d.c.name}, Semester ${p.sem}`,{size:10.5,color:'#dbe5ff'});
    g.text(555,44,p.rc,{size:16,bold:true,color:'#ffffff',align:'right'});
    g.text(555,66,fmtD(p.date),{size:10.5,color:'#dbe5ff',align:'right'});
    if(d.cancelled){g.rect(40,114,515,26,'#fdeaea');g.text(52,131,`CANCELLED on ${fmtD(isoOf(new Date(p.cancel.ts)))} - ${p.cancel.reason}`,{size:10,bold:true,color:'#b42318'})}
    else{g.rect(40,114,150,24,'#e5f6ec');g.text(52,130,'PAYMENT RECEIVED',{size:10,bold:true,color:'#1a7f45'})}
    const info=[['Student',s.name],['Enrolment no.',s.id],['Class',d.cls],['Batch',d.b?d.b.name:'-'],['Parent / guardian',s.guardian.name||'-'],['Paid by',p.mode+(p.ref?' ('+p.ref+')':'')],['Received by',p.by||'-'],['Channel',p.channel==='online'?'Online':p.channel==='counter'?'College counter':'Imported']];
    let y=168;info.forEach((r,i)=>{const cx=i%2?310:40;if(i%2===0&&i>0)y+=38;g.text(cx,y,r[0].toUpperCase(),{size:7.5,bold:true,color:MUT});g.text(cx,y+15,r[1],{size:11,color:INK})});
    y+=60;
    g.rect(40,y,515,24,'#eef2fb');
    g.text(50,y+16,'FEE HEAD',{size:8,bold:true,color:MUT});g.text(330,y+16,'PAID BEFORE',{size:8,bold:true,color:MUT,align:'right'});g.text(430,y+16,'APPLIED NOW',{size:8,bold:true,color:MUT,align:'right'});g.text(545,y+16,'BALANCE',{size:8,bold:true,color:MUT,align:'right'});
    y+=24;const rows=p.feeAmt>0?d.rows:[];
    rows.forEach(r=>{g.text(50,y+16,r.name,{size:10.5});g.text(330,y+16,rs(r.before),{size:10.5,align:'right',color:MUT});g.text(430,y+16,rs(r.applied),{size:10.5,align:'right',bold:true});g.text(545,y+16,rs(r.left),{size:10.5,align:'right'});y+=24;g.line(40,y,555,y,LINE,.6)});
    if(p.late>0){g.text(50,y+16,'Late fee cleared',{size:10.5});g.text(430,y+16,rs(p.late),{size:10.5,align:'right',bold:true});y+=24;g.line(40,y,555,y,LINE,.6)}
    y+=18;g.rect(300,y,255,64,'#f3f5fa');
    g.text(314,y+22,'AMOUNT RECEIVED',{size:8,bold:true,color:MUT});g.text(541,y+50,rs(p.amount),{size:22,bold:true,color:d.cancelled?'#b42318':INK,align:'right'});
    g.text(40,y+22,'Fee balance after this payment',{size:10,color:MUT});g.text(40,y+44,rs(p.balAfter),{size:15,bold:true});
    y+=92;
    g.line(40,y,555,y,LINE);
    g.wrap(40,y+22,'This is a computer generated receipt and does not need a signature. Please keep it for your records. For any query, contact the college accounts office quoting the receipt number.',515,{size:9,color:MUT});
    g.text(40,800,`${d.college}, ${d.city}`,{size:8.5,color:MUT});g.text(555,800,`Receipt ${p.rc}`,{size:8.5,color:MUT,align:'right'});
    if(d.cancelled)g.stamp('CANCELLED',{size:84,color:'#f6caca',x:300,y:470});
  },{title:`Fee receipt ${p.rc}`,author:d.college,date:stamp});
}
const pdfBytes=str=>{const u=new Uint8Array(str.length);for(let i=0;i<str.length;i++)u[i]=str.charCodeAt(i)&255;return u};
const fmtSize=n=>n<1024?n+' B':(n/1024).toFixed(1)+' KB';

/* ---------- e-mail body ---------- */
function receiptMailFragment(p){
  const d=receiptData(p),s=d.s;const td='padding:8px 0;border-bottom:1px solid #e6e9f0;font-size:14px;color:#1b2437';
  return`<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e1e5ee;border-radius:10px;overflow:hidden">
<div style="background:#2a55c8;color:#ffffff;padding:20px 24px"><div style="font-size:18px;font-weight:bold">${E(d.college)}</div><div style="font-size:13px;opacity:.85;margin-top:4px">Fee receipt ${E(p.rc)}</div></div>
<div style="padding:22px 24px;color:#1b2437;font-size:14px;line-height:1.55">
<p style="margin:0 0 14px">Dear ${E(s.guardian.name||'Parent')},</p>
<p style="margin:0 0 16px">${d.cancelled?'This receipt has been <b style="color:#b42318">cancelled</b>.':'We have received your fee payment.'} The receipt is attached to this email as a PDF (<b>${E(p.rc)}.pdf</b>).</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
<tr><td style="${td};color:#5b6679">Student</td><td style="${td};text-align:right">${E(s.name)} (${E(s.id)})</td></tr>
<tr><td style="${td};color:#5b6679">Class</td><td style="${td};text-align:right">${E(d.cls)}</td></tr>
<tr><td style="${td};color:#5b6679">Date</td><td style="${td};text-align:right">${E(fmtD(p.date))}</td></tr>
<tr><td style="${td};color:#5b6679">Paid by</td><td style="${td};text-align:right">${E(p.mode)}${p.ref?' &middot; '+E(p.ref):''}</td></tr>
<tr><td style="${td};color:#5b6679">Amount received</td><td style="${td};text-align:right;font-size:18px;font-weight:bold">${E(inr(p.amount))}</td></tr>
<tr><td style="padding:8px 0;font-size:14px;color:#5b6679">Fee balance now</td><td style="padding:8px 0;text-align:right;font-size:14px">${E(inr(p.balAfter))}</td></tr></table>
<p style="margin:18px 0 0;font-size:12.5px;color:#5b6679">This is an automatic message from the college fee system. Please keep the attached receipt for your records.</p></div></div>`;
}
function receiptMailText(p){const d=receiptData(p),s=d.s;return`Dear ${s.guardian.name||'Parent'},\n\n${d.cancelled?'This receipt has been cancelled.':'We have received your fee payment.'} Receipt ${p.rc} is attached as a PDF.\n\nStudent: ${s.name} (${s.id})\nClass: ${d.cls}\nDate: ${fmtD(p.date)}\nPaid by: ${p.mode}${p.ref?' · '+p.ref:''}\nAmount: ${inr(p.amount)}\nFee balance now: ${inr(p.balAfter)}\n\n${d.college}`}
function buildReceiptMail(p){
  const pdf=receiptPdf(p),d=receiptData(p);
  return{subject:`Fee receipt ${p.rc} - ${d.college}`,fragment:receiptMailFragment(p),text:receiptMailText(p),pdf,filename:p.rc+'.pdf',
    html:`<!doctype html><html><body style="margin:0;padding:20px;background:#f3f5fa">${receiptMailFragment(p)}</body></html>`};
}

/* ---------- who gets it ---------- */
function mailTargets(s){
  const m=mailCfg(),a=[],seen=new Set();
  const add=(name,email,role)=>{email=String(email||'').trim();if(!MAIL_RE.test(email)||seen.has(email.toLowerCase()))return;seen.add(email.toLowerCase());a.push({name,email,role})};
  if(m.to!=='student')add(s.guardian.name,s.guardian.email,'Parent');
  if(m.to!=='guardian')add(s.name,s.email,'Student');
  return a;
}
const shortList=a=>a.length>2?a.slice(0,2).join(', ')+' +'+(a.length-2):a.join(', ');

/* ---------- queue and send ---------- */
function queueReceiptMail(p,o={}){
  const m=mailCfg(),s=stu(p.studentId);
  if(o.trigger==='auto'&&!m.enabled)return null;
  const to=o.to||mailTargets(s);
  const rec={id:uid('o'),ts:Date.now(),paymentId:p.id,rc:p.rc,studentId:s.id,to:to.map(x=>x.email),names:to.map(x=>x.role),subject:`Fee receipt ${p.rc} - ${db.settings.college}`,filename:p.rc+'.pdf',bytes:0,
    status:'Queued',mode:m.mode,attempts:0,error:'',trigger:o.trigger||'auto'};
  db.outbox.unshift(rec);if(db.outbox.length>300)db.outbox.length=300;
  if(!to.length){rec.status='Skipped';rec.error='No valid email address on file for this student or guardian';ev('Email','Receipt email skipped',`${p.rc}: ${rec.error}`,{status:'fail'});return rec}
  ev('Email','Receipt email queued',`${p.rc} to ${to.map(x=>x.email).join(', ')}`);
  setTimeout(()=>deliver(rec.id),MAIL_DELAY);
  return rec;
}
async function deliver(id){
  const rec=db.outbox.find(x=>x.id===id);if(!rec||/^Sent/.test(rec.status))return;
  const p=db.payments.find(x=>x.id===rec.paymentId),m=mailCfg();
  rec.status='Sending';rec.attempts++;rec.mode=m.mode;refreshMailUi(rec);
  try{
    if(!p)throw new Error('Receipt not found');
    const mail=buildReceiptMail(p);rec.bytes=mail.pdf.length;
    if(m.mode==='live'){
      const redirect=m.redirect&&rec.trigger!=='test'?m.redirect.trim():'';
      const to=redirect?[redirect]:rec.to;
      const subject=redirect?`[TEST for ${shortList(rec.to)}] ${mail.subject}`:mail.subject;
      let r,j={};
      try{r=await fetch(m.endpoint||'/api/send-receipt',{method:'POST',headers:{'content-type':'application/json','x-api-key':m.key||''},body:JSON.stringify({to,subject,html:mail.html,text:mail.text,filename:mail.filename,pdfBase64:btoa(mail.pdf),fromName:m.fromName||db.settings.college,replyTo:m.replyTo||''})})}
      catch(e){throw new Error('Could not reach the mail server. Check the address in Settings, and that the site is deployed with the mail function.')}
      try{j=await r.json()}catch(e){}
      if(!r.ok||!j.ok)throw new Error(j.error||`Mail server answered ${r.status}`);
      rec.providerId=j.id||'';rec.status='Sent';rec.sentTo=to;
    }else{await sleep(250);rec.status='Sent (demo)'}
    rec.error='';rec.sentAt=Date.now();
  }catch(e){rec.status='Failed';rec.error=e.message||'Could not send'}
  ev('Email',rec.status==='Failed'?'Receipt email failed':'Receipt email sent',`${rec.rc} to ${(rec.sentTo||rec.to).join(', ')}${rec.status==='Failed'?': '+rec.error:rec.mode==='live'?' (live)':' (demo)'}`,{user:null,name:'Mail system',status:rec.status==='Failed'?'fail':'ok'});
  if(rec.status==='Failed')notify('mailfail',`Receipt email failed · ${rec.rc}`,rec.error||'Could not send',{key:'mf:'+rec.id,tone:'bad',go:{staff:['fees','outbox']},self:true});
  save();refreshMailUi(rec);
}
function mailPill(st){return pill(st,/^Sent/.test(st)?'good':st==='Failed'?'bad':st==='Skipped'?'warn':'')}
function lastMail(p){return db.outbox.find(o=>o.paymentId===p.id&&o.trigger!=='test')}
function mailLineHtml(p){
  const o=lastMail(p);const s=stu(p.studentId);const t=mailTargets(s);
  if(!o)return t.length?`<span class="muted">Not e-mailed yet. Will go to ${E(shortList(t.map(x=>x.email)))}</span>`:`<span class="muted">No email address on file</span>`;
  const when=o.sentAt?' · '+E(fmtT(o.sentAt)):'';
  return`${mailPill(o.status)} <span class="muted">${o.status==='Skipped'||o.status==='Failed'?E(o.error):'PDF to '+E(shortList(o.to))+when}</span>`;
}
const mailLine=p=>`<div class="maillive" data-mailpay="${E(p.id)}" style="margin-top:10px;font-size:13px">${mailLineHtml(p)}</div>`;
function refreshMailUi(rec){
  $$('.maillive').forEach(el=>{const p=db.payments.find(x=>x.id===el.dataset.mailpay);if(p)el.innerHTML=mailLineHtml(p)});
  const busy=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')||$('#layer').innerHTML||$('#dlg').innerHTML;
  if(!busy&&ui.route==='fees'&&ui.tab.fees==='outbox'&&$('#page'))renderPage();
  const mp=$('#mailPrevStatus');if(mp&&mp.dataset.id===rec.id)mp.innerHTML=mailPill(rec.status)+(rec.error?` <span class="muted">${E(rec.error)}</span>`:'');
}

/* ---------- actions ---------- */
function mayMailReceipt(p){const u=cur();if(!u)return false;if(u.role==='Parent'||u.role==='Student')return p.studentId===u.studentId;return can('fees.view')}
ACT.emailReceipt=el=>{
  const p=db.payments.find(x=>x.id===el.dataset.id);if(!p||!mayMailReceipt(p))throw new Error('Receipt not found');
  const rec=queueReceiptMail(p,{trigger:'manual'});save();
  if(rec&&rec.status==='Skipped')toast('No email address on file. Add one first.',true);else toast('Receipt PDF is being emailed to '+shortList(rec.to));
  refreshMailUi(rec);
};
ACT.mailRetry=el=>{
  const o=db.outbox.find(x=>x.id===el.dataset.id);if(!o||!can('fees.view'))throw new Error('Not allowed');
  const p=db.payments.find(x=>x.id===o.paymentId);
  if(o.status==='Failed'){o.status='Queued';o.error='';save();deliver(o.id);toast('Trying again')}
  else{const rec=queueReceiptMail(p,{trigger:'resend'});save();toast(rec.status==='Skipped'?'No email address on file':'Receipt is being sent again');refreshMailUi(rec);if(ui.route==='fees')renderPage()}
};
ACT.mailRetryAll=()=>{const f=db.outbox.filter(o=>o.status==='Failed');f.forEach(o=>{o.status='Queued';o.error='';deliver(o.id)});save();toast(f.length?`Retrying ${f.length} email${f.length>1?'s':''}`:'Nothing to retry');renderPage()};
ACT.dlPdf=el=>{const p=db.payments.find(x=>x.id===el.dataset.id);if(!p||!mayMailReceipt(p))throw new Error('Receipt not found');savePdf(p).catch(()=>toast('Could not save the PDF',true))};
async function savePdf(p){
  const bytes=pdfBytes(receiptPdf(p)),name=p.rc+'.pdf';
  /* inside the Claude viewer, ask its save prompt; on a normal website, download directly */
  let dl=null;try{if(window.claude&&claude.use)dl=await claude.use('downloads')}catch(e){}
  if(dl){try{await dl.save({filename:name,data:bytes});toast('PDF saved');return}catch(e){if(e&&e.code==='declined')return;if(!e||e.code!=='unavailable'){toast('Could not save the PDF here',true);return}}}
  const blob=new Blob([bytes],{type:'application/pdf'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('PDF downloaded');
}
ACT.mailPreview=el=>{
  const o=db.outbox.find(x=>x.id===el.dataset.id);if(!o)throw new Error('Email not found');const p=db.payments.find(x=>x.id===o.paymentId);const m=mailCfg();
  const mail=buildReceiptMail(p);
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Email preview</h2>
   <div class="panel" style="padding:12px;margin:12px 0"><div class="rline"><span>From</span><span>${E(m.fromName||db.settings.college)}</span></div><div class="rline"><span>To</span><span style="text-align:right">${E(o.to.join(', ')||'-')}</span></div><div class="rline"><span>Subject</span><span style="text-align:right">${E(o.subject)}</span></div>
   <div class="rline"><span>Status</span><span id="mailPrevStatus" data-id="${o.id}">${mailPill(o.status)}${o.error?` <span class="muted">${E(o.error)}</span>`:''}</span></div>
   <div class="rline"><span>Attachment</span><span>${pill('PDF')} ${E(o.filename)} · ${fmtSize(mail.pdf.length)}</span></div></div>
   <div class="mailbody">${mail.fragment}</div>
   <div class="actions" style="margin-top:14px"><button class="btn primary" data-act="mailRetry" data-id="${o.id}">${o.status==='Failed'?'Retry sending':'Send again'}</button><button class="btn" data-act="dlPdf" data-id="${p.id}">Download PDF</button><button class="btn" data-act="viewReceipt" data-id="${p.id}">Open receipt</button></div>
   <p class="note">${m.mode==='live'?'Live mode: this goes through your mail server.':'Demo mode: nothing is actually sent. Switch to live mode in Settings once the mail server is set up.'}</p>`);
};

/* ---------- Fees tab: outbox ---------- */
function feeOutbox(){
  const m=mailCfg();const rows=db.outbox.slice(0,80);const failed=db.outbox.filter(o=>o.status==='Failed').length;
  const toLbl={both:'Parent and student',guardian:'Parent only',student:'Student only'}[m.to];
  return`<div class="panel"><div class="flow" style="margin-bottom:12px"><div>${m.enabled?pill('Auto-email on','good'):pill('Auto-email off','warn')} ${m.mode==='live'?pill('Live server','good'):pill('Demo: nothing is really sent')} ${m.redirect&&m.mode==='live'?pill('Test redirect on','warn'):''}<p class="note" style="margin:8px 0 0">Every payment creates a PDF receipt and emails it to: ${E(toLbl)}.</p></div>
   <div class="actions">${failed?`<button class="btn sm" data-act="mailRetryAll">Retry ${failed} failed</button>`:''}${can('settings.manage')?'<button class="btn sm" data-act="go" data-to="settings">Email settings</button>':''}</div></div>
   <div class="tablewrap"><table><thead><tr><th>Time</th><th>Receipt</th><th>Student</th><th>To</th><th>Status</th><th></th></tr></thead><tbody>
   ${rows.map(o=>{const s=stu(o.studentId);return`<tr><td>${E(fmtT(o.ts))}</td><td class="mono">${E(o.rc)}</td><td>${E(s?s.name:'-')}</td><td>${E(shortList(o.to)||'-')}</td><td>${mailPill(o.status)}${o.error?`<br><small class="muted">${E(o.error)}</small>`:''}</td>
    <td><button class="btn sm" data-act="mailPreview" data-id="${o.id}">Preview</button> <button class="btn sm" data-act="mailRetry" data-id="${o.id}">${o.status==='Failed'?'Retry':'Send again'}</button></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">No emails yet. Collect a payment and its PDF receipt is emailed automatically.</td></tr>'}</tbody></table></div></div>`;
}

/* ---------- Settings: e-mail ---------- */
function mailSettingsPanel(){
  const m=mailCfg();
  return`<div class="panel"><h2>Email receipts</h2><p class="note" style="margin:0 0 12px">A PDF receipt is emailed automatically after every payment: counter, online gateway, parent portal and student portal.</p>
   <form data-form="saveMail" class="form">${F('enabled','Automatic emails',{opts:[['1','On'],['0','Off']],val:m.enabled?'1':'0'})}${F('to','Send to',{opts:[['both','Parent and student'],['guardian','Parent only'],['student','Student only']],val:m.to})}
   ${F('fromName','Sender name',{val:m.fromName,ph:db.settings.college,span:1})}${F('replyTo','Reply-to address',{val:m.replyTo,type:'email',ph:'accounts@yourcollege.edu',span:1})}
   ${F('mode','Sending mode',{opts:[['demo','Demo: show in outbox, send nothing'],['live','Live: send through the mail server']],val:m.mode,span:1})}
   ${F('endpoint','Mail server address',{val:m.endpoint,span:1})}${F('key','Access key (RECEIPT_API_KEY)',{val:m.key,type:'password',span:1,ph:'Same value as in Vercel'})}
   ${F('redirect','Test redirect (optional)',{val:m.redirect,type:'email',span:1,ph:'your@email.com'})}
   <p class="note span" style="margin:0">While you are demonstrating, put your own address in Test redirect: every live email then goes only to you, with the real recipient in the subject.</p>
   <button class="btn primary span">Save email settings</button></form>
   <div class="actions" style="margin-top:12px"><button class="btn" data-act="mailPing">Check mail server</button><button class="btn" data-act="mailTestAsk">Send a test email</button></div><div id="mailPingOut" class="note" role="status"></div></div>`;
}
FORM.saveMail=(f,d)=>{
  if(!can('settings.manage'))throw new Error('You do not have access to settings');
  if(d.redirect&&!MAIL_RE.test(d.redirect.trim()))throw new Error('Test redirect is not a valid email address');
  if(d.replyTo&&!MAIL_RE.test(d.replyTo.trim()))throw new Error('Reply-to is not a valid email address');
  if(d.mode==='live'&&!String(d.endpoint||'').trim())throw new Error('Enter the mail server address (usually /api/send-receipt)');
  Object.assign(db.settings.mail,{enabled:d.enabled==='1',to:d.to,mode:d.mode,endpoint:d.endpoint.trim()||'/api/send-receipt',key:d.key,fromName:d.fromName.trim(),replyTo:d.replyTo.trim(),redirect:d.redirect.trim()});
  log('Settings changed','Email receipts: '+(db.settings.mail.enabled?'on':'off')+', '+db.settings.mail.mode);save();toast('Email settings saved');renderPage();
};
ACT.mailPing=async()=>{
  const m=mailCfg(),out=$('#mailPingOut');out.textContent='Checking...';
  try{const r=await fetch(m.endpoint||'/api/send-receipt');const j=await r.json();
    out.textContent=j.configured?`Mail server is reachable and ready (sending as ${j.from||'configured address'}).`:'Mail server is reachable but not set up: add RESEND_API_KEY, MAIL_FROM and RECEIPT_API_KEY in Vercel, then redeploy.'}
  catch(e){out.textContent='Could not reach the mail server at '+(m.endpoint||'/api/send-receipt')+'. This is expected in the preview: the server exists only on the deployed site.'}
};
ACT.mailTestAsk=()=>{
  if(!db.payments.some(p=>p.status==='ok'))throw new Error('Make a payment first. The test uses the latest receipt.');
  dialog(`<h3>Send a test email</h3><form data-form="mailTest" class="grid" style="gap:12px"><p class="muted" style="margin:0">Sends the latest receipt with its PDF to this address.</p>${F('email','Send to',{type:'email',req:1,ph:'your@email.com'})}<div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Cancel</button><button class="btn primary">Send test</button></div></form>`);
};
FORM.mailTest=(f,d)=>{
  if(!can('settings.manage'))throw new Error('You do not have access to settings');
  const email=d.email.trim();if(!MAIL_RE.test(email))throw new Error('Enter a valid email address');
  const p=db.payments.filter(x=>x.status==='ok').sort((a,b)=>b.ts-a.ts)[0];
  const rec=queueReceiptMail(p,{trigger:'test',to:[{email,role:'Test'}]});save();closeDialog();toast('Test email is being sent to '+email);setTimeout(()=>{if(ui.route==='settings')toast(mailCfg().mode==='live'?'Check your inbox and the Email outbox':'Demo mode: see the Email outbox')},MAIL_DELAY+600);
};
