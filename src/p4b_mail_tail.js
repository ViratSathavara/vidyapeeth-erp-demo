const rs=p=>'Rs. '+(Math.round(p||0)/100).toLocaleString('en-IN',{maximumFractionDigits:2});
const pdfBytes=str=>{const u=new Uint8Array(str.length);for(let i=0;i<str.length;i++)u[i]=str.charCodeAt(i)&255;return u};
const fmtSize=n=>n<1024?n+' B':(n/1024).toFixed(1)+' KB';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* The PDF is rebuilt from the payment every time it is opened, so an edited invoice date always shows on the receipt.
   NOTE: this browser PDF uses Helvetica (Latin only). The real server PDF embeds Noto Sans Gujarati (spec §1). */
function receiptPdf(p){
  const s=stu(p.studentId),c=db.college;const ts=new Date(p.entryAt||Date.now());const cancelled=p.status==='CANCELLED';
  const stamp=`${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  return makePdf(g=>{
    const INK='#14284b',MUT='#5b6679',LINE='#d7dce5',NAVY='#14284b',GOLD='#b8862b';
    g.rect(0,0,595,104,NAVY);g.rect(0,104,595,4,GOLD);
    g.text(40,40,c.name,{size:15,bold:true,color:'#ffffff'});
    g.text(40,60,`${c.trust} · ${c.address}`,{size:9,color:'#d7def0'});
    g.text(40,78,`Phone ${c.phone} · ${c.email}`,{size:9,color:'#d7def0'});
    g.text(555,40,'FEE RECEIPT',{size:10,bold:true,color:'#f3d9a4',align:'right'});
    g.text(555,62,p.rc,{size:14,bold:true,color:'#ffffff',align:'right'});
    g.text(555,80,'Invoice date '+fmtD(p.invoiceDate),{size:9.5,color:'#d7def0',align:'right'});
    if(cancelled){g.rect(40,124,515,26,'#fdeaea');g.text(52,141,`CANCELLED on ${fmtD(istDate(p.cancelledAt))} - ${p.cancelReason}`,{size:10,bold:true,color:'#b42318'})}
    else{g.rect(40,124,150,24,'#e5f6ec');g.text(52,140,'PAYMENT RECEIVED',{size:10,bold:true,color:'#1a7f45'})}
    const mode=modeName(p.mode)+(p.mode==='CHEQUE'?` No. ${p.chequeNo}, ${p.bank}, dated ${fmtD(p.chequeDate)}`:'')+(p.mode==='UPI'?` (${p.upiRef})`:'');
    const info=[['Student',s.name],['Enrolment no.',s.enrol],['Course',course(s.course).name],['Batch',batchOf(p)],['Semester',String(p.sem)],['Mode of payment',mode],['Category',s.category],['Entered by',p.by||'-'],['Entered on',fmtT(p.entryAt)]];if(p.mode==='EXPENSE'&&p.reason)info.push(['Used for (expense)',p.reason]);
    let y=180;info.forEach((r,i)=>{const cx=i%2?310:40;if(i%2===0&&i>0)y+=40;g.text(cx,y,r[0].toUpperCase(),{size:7.5,bold:true,color:MUT});g.wrap(cx,y+15,r[1],240,{size:11,color:INK})});
    y+=64;g.rect(40,y,515,24,'#eef2fb');
    g.text(50,y+16,'PARTICULARS',{size:8,bold:true,color:MUT});g.text(545,y+16,'AMOUNT',{size:8,bold:true,color:MUT,align:'right'});y+=24;
    g.text(50,y+18,`${course(s.course).name} Semester ${p.sem} fee`,{size:11});g.text(545,y+18,rs(p.amount),{size:11,align:'right',bold:true});y+=28;g.line(40,y,555,y,LINE,.6);
    const m=semSummary(s,p.sem);
    y+=18;g.rect(300,y,255,64,'#f3f5fa');
    g.text(314,y+22,'AMOUNT RECEIVED',{size:8,bold:true,color:MUT});g.text(541,y+50,rs(p.amount),{size:22,bold:true,color:cancelled?'#b42318':INK,align:'right'});
    g.text(40,y+22,`Semester ${p.sem} fee ${rs(m.amount)} · paid ${rs(m.paid)}`,{size:10,color:MUT});g.text(40,y+44,'Balance '+rs(m.due),{size:14,bold:true});
    y+=92;g.line(40,y,555,y,LINE);
    g.wrap(40,y+22,'This is a computer generated receipt and does not need a signature. Please keep it for your records. For any query contact the college accounts office with the receipt number.',515,{size:9,color:MUT});
    if((p.dateEdits||[]).length)g.wrap(40,y+60,'Invoice date updated on '+fmtT(p.dateEdits.at(-1).at)+'.',515,{size:8.5,color:MUT});
    g.text(40,806,`${c.short} · ${c.website}`,{size:8.5,color:MUT});g.text(555,806,`Receipt ${p.rc}`,{size:8.5,color:MUT,align:'right'});
    if(cancelled)g.stamp('CANCELLED',{size:84,color:'#f6caca',x:300,y:480});
  },{title:`Fee receipt ${p.rc}`,author:c.name,date:stamp});
}
async function savePdf(p){download(p.rc.replace(/[^\w-]+/g,'_')+'.pdf',pdfBytes(receiptPdf(p)),'application/pdf');}
ACT.dlPdf=el=>{const p=db.payments.find(x=>x.id===el.dataset.id);if(!p)throw new Error('Receipt not found');guardStudent(p.studentId);savePdf(p)};

/* ---------- email outbox (receipts, login details). Demo mode: shown, nothing sent. Live: /api/send-receipt (Resend) ---------- */
const MAIL_DELAY=900;
function mailBody(rec){
  const s=stu(rec.studentId),c=db.college;
  if(rec.kind==='credentials')return{text:`Dear ${s.name},\n\nYour ${c.short} student portal is ready.\n\nPortal: ${location.origin}/\nLogin ID: ${s.enrol.toLowerCase()} (or ${s.email})\nTemporary password: ${rec.pw?'(sent in this email)':'—'}\n\nYou must choose your own password at the first sign-in.\n\nInstall as an app: open the portal in Chrome on Android and tap "Install app", or on iPhone open it in Safari, tap Share and then "Add to Home Screen".\n\n${c.name}\n${c.phone} · ${c.email}`};
  const p=db.payments.find(x=>x.id===rec.paymentId);
  return{text:`Dear ${s.name},\n\n${p.status==='CANCELLED'?'This receipt has been cancelled.':'We have received your fee payment.'}\nReceipt: ${p.rc}\nAmount: ${rs(p.amount)}\nSemester: ${p.sem}\nMode: ${modeName(p.mode)}\nInvoice date: ${fmtD(p.invoiceDate)}\n\nThe receipt PDF is attached.\n\n${c.name}\n${c.phone} · ${c.email}`,pdf:receiptPdf(p),filename:p.rc.replace(/[^\w-]+/g,'_')+'.pdf'};
}
function queueMail(o){
  const rec={id:uid('o'),ts:Date.now(),kind:o.kind,paymentId:o.paymentId||'',studentId:o.studentId,to:(o.to||[]).filter(e=>MAIL_OK.test(e||'')),subject:o.subject,status:'Queued',mode:db.settings.mail.mode,attempts:0,error:'',why:o.why||''};
  /* the temporary password lives only in the in-memory copy of the email, never in the outbox list that is saved */
  if(o.pw)Object.defineProperty(rec,'pw',{value:o.pw,enumerable:false});
  db.outbox.unshift(rec);if(db.outbox.length>300)db.outbox.length=300;
  if(!rec.to.length){rec.status='Skipped';rec.error='No valid email address on file';return rec}
  setTimeout(()=>deliver(rec.id,rec.pw),MAIL_DELAY);return rec;
}
async function deliver(id,pw){
  const rec=db.outbox.find(x=>x.id===id);if(!rec||/^Sent/.test(rec.status))return;const m=db.settings.mail;
  rec.status='Sending';rec.attempts++;
  try{
    if(m.mode==='live'&&rec.kind==='receipt'){
      const b=mailBody(rec);const r=await fetch('/api/send-receipt',{method:'POST',headers:{'content-type':'application/json','x-api-key':m.key||''},body:JSON.stringify({to:rec.to,subject:rec.subject,html:'<pre style="font:14px sans-serif;white-space:pre-wrap">'+E(b.text)+'</pre>',text:b.text,filename:b.filename,pdfBase64:btoa(b.pdf),fromName:m.fromName,replyTo:m.replyTo})});
      let j={};try{j=await r.json()}catch(e){}if(!r.ok||!j.ok)throw new Error(j.error||'Mail server answered '+r.status);rec.status='Sent';
    }else{await sleep(250);rec.status='Sent (demo)'}
    rec.sentAt=Date.now();rec.error='';
  }catch(e){rec.status='Failed';rec.error=e.message||'Could not send'}
  if(rec.kind==='credentials'){const s=stu(rec.studentId);if(s&&s.cred&&s.cred.mailId===rec.id){s.cred.status=rec.status;s.cred.at=rec.sentAt||Date.now()}}
  if(rec.status==='Failed')notify('mailfail',`Email failed · ${rec.subject}`,rec.error,{roles:['Super Admin','Principal','Clerk'],staff:'students',tone:'bad',self:true,key:'mf:'+rec.id});
  save();refreshMailUi();
}
function mailPill(st){return pill(st,/^Sent/.test(st)?'good':st==='Failed'?'bad':st==='Skipped'?'warn':'')}
function mailLineHtml(p){const o=db.outbox.find(x=>x.paymentId===p.id);if(!o)return`<span class="muted">Receipt email not sent yet</span>`;return`${mailPill(o.status)} <span class="muted">${o.error?E(o.error):'PDF to '+E(o.to.join(', '))}${o.sentAt?' · '+E(fmtT(o.sentAt)):''}</span>`}
const mailLine=p=>`<div class="maillive" data-mailpay="${E(p.id)}" style="margin-top:10px;font-size:13px">${mailLineHtml(p)}</div>`;
function refreshMailUi(){$$('.maillive').forEach(el=>{const p=db.payments.find(x=>x.id===el.dataset.mailpay);if(p)el.innerHTML=mailLineHtml(p)})}
ACT.emailReceipt=el=>{need('fees.view');const p=db.payments.find(x=>x.id===el.dataset.id);const s=stu(p.studentId);const r=queueMail({kind:'receipt',paymentId:p.id,studentId:s.id,to:[s.email],subject:`Fee receipt ${p.rc} - ${db.college.short}`});save();refreshMailUi();toast(r.status==='Skipped'?'No email address on file':'Receipt is being emailed to '+s.email,r.status==='Skipped')};
