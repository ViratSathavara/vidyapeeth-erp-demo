const fs=require('fs'),vm=require('vm');
const SRC=require('path').join(__dirname,'..','src');
const files=['p1_core.js','p1b_notify.js','p2a_ui.js','p2_shell.js','p3_students.js','p4_fees.js','p4a_pdf.js','p4b_mail_tail.js','p6_admin.js','p6b_student.js','p7_pwa.js','p8_dashboard.js','p6d_notify.js'];
let code=files.map(f=>fs.readFileSync(SRC+'/'+f,'utf8')).join('\n');
code=code.replace(/\/\* ---------- boot ---------- \*\/[\s\S]*$/,'');
const el=()=>new Proxy({},{get:(t,k)=>k in t?t[k]:(k==='classList'?{add(){},remove(){},toggle(){},contains(){return false}}:k==='style'?{setProperty(){},removeProperty(){}}:k==='dataset'?{}:typeof k==='string'&&/^(querySelector|closest)$/.test(k)?()=>null:k==='querySelectorAll'?()=>[]:k==='innerHTML'?'':()=>{}),set:(t,k,v)=>{t[k]=v;return true}});
const store={};const ls={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
const ss={};const sess={getItem:k=>ss[k]??null,setItem:(k,v)=>{ss[k]=v},removeItem:k=>{delete ss[k]}};
const ctx={console,Intl,Date,Math,JSON,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,Promise,Set,Map,Uint8Array,Blob:function(){},URL:{createObjectURL:()=>'',revokeObjectURL(){}},btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
 localStorage:ls,sessionStorage:sess,navigator:{userAgent:'Chrome/120 test'},innerWidth:1300,location:{origin:'http://127.0.0.1:5173',protocol:'http:'},
 matchMedia:()=>({matches:false,addEventListener(){}}),MutationObserver:function(){this.observe=()=>{}},addEventListener(){},requestAnimationFrame(){},performance:{now:()=>0},getComputedStyle:()=>({}),MouseEvent:function(){}};
ctx.document={addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],createElement:el,getElementById:()=>null,body:el(),documentElement:el(),hidden:false,activeElement:null};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(code+`
;globalThis.__=()=>({get db(){return db},ui,ACT,FORM,CHG,seed,load,save,cur,can,feeSum,semSummary,recordPayment,cancelPayment,editInvoiceDate,upiInvoiceDate,istDate,handleUpiWebhook,gwEvent,provider,txFiltered,txTotals,auditDeposit,depPeriod,audienceStudents,notify,ntSync,makeStudent,readStudentForm,sesSet,viewDashboard,viewStudents,viewFees,viewAudit,viewNotices,viewSettings,viewStudentHome,viewStudentFees,viewStudentNotices,viewStudentProfile,openStudent,receiptPdf,guardStudent,studentsFiltered,duesFiltered,mayStudent,publishNotice,fundingApplies,toPaise,inr})`,ctx);
module.exports=ctx.__();
