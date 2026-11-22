/* ---------- change 23 (22-11-2026): official signature of every staff login ----------
   Each Super Admin, Principal and Clerk has one official signature. They add or replace it themselves from
   Profile → Official signature by uploading a photo / scan of it (change 24: upload only, with a crop box and
   smart cleaning; drawing it on screen was removed).
   The invoice shows the signature of the person who issued it, above "Authorised Signatory":
   - Cash / Cheque: the staff member who entered the payment (typed the invoice no.)
   - UPI: the staff member who confirmed the payment and added the invoice no.
   db.signs keeps the saved signatures {id,userId,png,bits,w,h,at,by,sample}; user.signId = the current one.
   An invoice remembers the signature it was issued with (payment.signId), so a new signature later does not change
   invoices already issued. Older invoices issued before this change use the issuer's current signature.
   Staff logins that existed before this change got a SAMPLE (dummy) signature made from their name (sample:true),
   shown as "Sample" until they add their own. A login created later starts without one and is asked to add it.
   png  = transparent PNG for the screen; bits = the same signature as a 1-bit mask for the PDF (base64). */
const SIGN_MAX_W=600,SIGN_MAX_H=170,SIGN_INK='#1b2a5e';
const staffUser=u=>!!u&&u.role!=='Student';
const signById=id=>(id&&(db.signs||[]).find(x=>x.id===id))||null;
const signOf=u=>u?signById(u.signId):null;
const signState=u=>{const s=signOf(u);return!s?'none':s.sample?'sample':'own'};

/* who signs this invoice, and with which signature (null: invoice not issued yet / nobody known) */
function invSigner(p){if(!p||p.needsRc)return null;
  const byId=id=>id?db.users.find(x=>x.id===id&&staffUser(x)):null;
  const byName=n=>n?db.users.find(x=>staffUser(x)&&x.name===n):null;
  let u=byId(p.rcById)||byId(p.byId)||byName(p.rcBy||p.confirmedBy)||(p.mode==='UPI'?null:byName(p.by));
  const sg=signById(p.signId)||signOf(u);
  if(!u&&sg)u=byId(sg.userId);
  return u||sg?{name:u?u.name:'',role:u?u.role:'',sign:sg}:null}

/* ---------- change 24: smart cleaning of an uploaded signature photo ----------
   Works on plain arrays (no screen needed), so it is tested in tests/logic.test.js.
   1. Shadows / uneven light: the paper brightness is measured in small blocks (the light 10% of each block),
      and every pixel is compared with the paper around it (n = 255 is paper, low n is ink).
   2. Ink = clearly darker than its paper (threshold chosen from the picture itself, Otsu).
   3. Notebook / printed lines are removed: perfectly straight lines that run from edge to edge, and thin lines
      that cross the whole area. A pen stroke that crosses such a line is kept.
   4. Specks and dust are removed; big dark patches (table, phone, shadow edge, the paper's border) are removed.
   5. The first crop box = the main signature (largest stroke + the strokes near it); the person can move / resize it.
   6. Only the ink inside the box is kept, with soft edges, on a transparent background, cut tight. */
function signOtsu(h,tot){let all=0;for(let t=0;t<256;t++)all+=t*h[t];let sB=0,wB=0,best=-1,th=128;
  for(let t=0;t<256;t++){wB+=h[t];if(!wB)continue;const wF=tot-wB;if(!wF)break;sB+=t*h[t];const v=wB*wF*(sB/wB-(all-sB)/wF)**2;if(v>best){best=v;th=t}}return th}
/* lum: lightness 0..255 of each pixel (W*H). Returns {W,H,n}: lightness compared with the local paper. */
function signPrepLum(lum,W,H){
  const B=Math.max(12,Math.round(Math.max(W,H)/40)),bw=Math.ceil(W/B),bh=Math.ceil(H/B),blk=new Float32Array(bw*bh),h=new Uint32Array(256);
  for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){h.fill(0);let c=0;const x1=Math.min(W,(bx+1)*B),y1=Math.min(H,(by+1)*B);
    for(let y=by*B;y<y1;y++)for(let x=bx*B;x<x1;x++){h[lum[y*W+x]]++;c++}
    let k=c*.1,v=255;for(;v>0;v--){k-=h[v];if(k<=0)break}blk[by*bw+bx]=v}
  const nb=(a,f)=>{const o=new Float32Array(bw*bh);for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){let m=f==='max'?0:0,c=0;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=x+i,yy=y+j;if(xx<0||yy<0||xx>=bw||yy>=bh)continue;const v=a[yy*bw+xx];if(f==='max'){if(v>m)m=v}else{m+=v;c++}}
    o[y*bw+x]=f==='max'?m:m/c}return o};
  const bg=nb(nb(blk,'max'),'mean');
  h.fill(0);for(let i=0;i<W*H;i++)h[lum[i]]++;let k=W*H*.1,gp=255;for(;gp>0;gp--){k-=h[gp];if(k<=0)break}
  /* where even the "paper" is much darker than the real paper (a dark table, outside the page) nothing is ink */
  const off=Math.max(40,gp*.45),n=new Uint8Array(W*H);
  for(let y=0;y<H;y++){const fy=Math.min(bh-1,Math.max(0,(y+.5)/B-.5)),y0=Math.floor(fy),y1=Math.min(bh-1,y0+1),ty=fy-y0;
    for(let x=0;x<W;x++){const fx=Math.min(bw-1,Math.max(0,(x+.5)/B-.5)),x0=Math.floor(fx),x1=Math.min(bw-1,x0+1),tx=fx-x0;
      const v=(bg[y0*bw+x0]*(1-tx)+bg[y0*bw+x1]*tx)*(1-ty)+(bg[y1*bw+x0]*(1-tx)+bg[y1*bw+x1]*tx)*ty;
      n[y*W+x]=v<off?255:Math.min(255,Math.round(lum[y*W+x]*255/v))}}
  return{W,H,n}}
/* ink mask of an area, with straight edge-to-edge lines removed (a stroke crossing a line is kept) */
function signInk(P,x0,y0,w,h){const{W,n}=P,hist=new Uint32Array(256);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)hist[n[(y0+y)*W+x0+x]]++;
  const th=Math.max(110,Math.min(200,signOtsu(hist,w*h))),m=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)m[y*w+x]=n[(y0+y)*W+x0+x]<th?1:0;
  const kill=new Uint8Array(w*h),eh=Math.max(2,Math.round(w*.02)),ev=Math.max(2,Math.round(h*.02));
  for(let y=0;y<h;y++){let x=0;while(x<w){if(!m[y*w+x]){x++;continue}const s=x;while(x<w&&m[y*w+x])x++;if(s<=eh&&x>=w-eh&&x-s>=40)for(let i=s;i<x;i++)kill[y*w+i]|=1}}
  for(let x=0;x<w;x++){let y=0;while(y<h){if(!m[y*w+x]){y++;continue}const s=y;while(y<h&&m[y*w+x])y++;if(s<=ev&&y>=h-ev&&y-s>=40)for(let i=s;i<y;i++)kill[i*w+x]|=2}}
  const out=m.slice();
  for(let i=0;i<w*h;i++){if(!kill[i])continue;const x=i%w,y=(i/w)|0;let keep=false;
    if(kill[i]&1)keep=y>=4&&y+4<h&&m[i-4*w]&&m[i+4*w]&&!(kill[i-4*w]&1)&&!(kill[i+4*w]&1);
    if(!keep&&kill[i]&2)keep=x>=4&&x+4<w&&m[i-4]&&m[i+4]&&!(kill[i-4]&2)&&!(kill[i+4]&2);
    if(!keep)out[i]=0}
  return{mask:out,th}}
/* connected strokes (8 neighbours): label per pixel + {id,a(area),x0,y0,x1,y1} */
function signComps(m,w,h){const L=new Int32Array(w*h),st=new Int32Array(w*h),list=[];let id=0;
  for(let i=0;i<w*h;i++){if(!m[i]||L[i])continue;id++;let sp=0,a=0,x0=w,y0=h,x1=-1,y1=-1;st[sp++]=i;L[i]=id;
    while(sp){const j=st[--sp],x=j%w,y=(j/w)|0;a++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const k=yy*w+xx;if(m[k]&&!L[k]){L[k]=id;st[sp++]=k}}}}
    list.push({id,a,x0,y0,x1,y1})}
  return{L,list}}
/* not part of a signature: a big dark patch, a solid blob, or a thin line that crosses the whole area */
function signJunk(c,w,h,auto){const bw=c.x1-c.x0+1,bh=c.y1-c.y0+1,fill=c.a/(bw*bh),eh=Math.max(2,w*.02),ev=Math.max(2,h*.02),thin=Math.max(5,.01*Math.max(w,h));
  const edge=c.x0===0||c.y0===0||c.x1===w-1||c.y1===h-1;
  if(c.a>(auto?.2:.5)*w*h)return true;
  if(fill>.45&&bw>.15*w&&bh>.15*h)return true;
  if(c.x0<=eh&&c.x1>=w-1-eh&&c.a/bw<=thin)return true;
  if(c.y0<=ev&&c.y1>=h-1-ev&&c.a/bh<=thin)return true;
  if(auto&&edge&&(bw>.9*w||bh>.9*h))return true;
  return false}
/* first crop box: the largest stroke and the strokes near it, with a margin. Box = {x0,y0,x1,y1}, x1/y1 exclusive. */
function signAuto(P){const{W,H,n}=P,{mask,th}=signInk(P,0,0,W,H),{L,list}=signComps(mask,W,H),speck=Math.max(14,W*H*2e-5);
  /* strength = how much ink: dark pen strokes win over faint texture of a table or a shadow edge */
  const str=new Float64Array(list.length+1);for(let i=0;i<W*H;i++)if(L[i])str[L[i]]+=th-n[i];list.forEach(c=>c.s=str[c.id]);
  const cand=list.filter(c=>c.a>=speck&&!signJunk(c,W,H,true));if(!cand.length)return{x0:0,y0:0,x1:W,y1:H};
  const seed=cand.reduce((a,b)=>b.s>a.s?b:a),b={x0:seed.x0,y0:seed.y0,x1:seed.x1,y1:seed.y1},used=new Set([seed]);
  const mg=Math.max(.6*(seed.y1-seed.y0+1),.15*(seed.x1-seed.x0+1),.03*Math.max(W,H)); /* a flat underline is wide but not tall: the name above it still belongs */let grew=true;
  const dark=.6*seed.s/seed.a; /* grow only with strokes about as dark as the signature (printed labels are lighter) */
  while(grew){grew=false;for(const c of cand){if(used.has(c)||c.s/c.a<dark)continue;
    if(c.x1>=b.x0-mg*1.5&&c.x0<=b.x1+mg*1.5&&c.y1>=b.y0-mg&&c.y0<=b.y1+mg){const nx0=Math.min(b.x0,c.x0),ny0=Math.min(b.y0,c.y0),nx1=Math.max(b.x1,c.x1),ny1=Math.max(b.y1,c.y1);
      used.add(c);if((nx1-nx0)*(ny1-ny0)>.6*W*H)continue;Object.assign(b,{x0:nx0,y0:ny0,x1:nx1,y1:ny1});grew=true}}}
  const pw=(b.x1-b.x0+1)*.08+8,ph=(b.y1-b.y0+1)*.15+8;
  return{x0:Math.max(0,Math.floor(b.x0-pw)),y0:Math.max(0,Math.floor(b.y0-ph)),x1:Math.min(W,Math.ceil(b.x1+1+pw)),y1:Math.min(H,Math.ceil(b.y1+1+ph))}}
/* the ink inside the box: {alpha (0..255 per pixel), w, h, ox, oy (top-left in the photo)}, cut tight; throws a message for the person */
function signMask(P,box){const{W,n}=P;const x0=Math.max(0,Math.round(box.x0)),y0=Math.max(0,Math.round(box.y0)),w=Math.min(P.W,Math.round(box.x1))-x0,h=Math.min(P.H,Math.round(box.y1))-y0;
  if(w<12||h<12)throw new Error('The box is too small. Make it bigger around the signature.');
  const{mask,th}=signInk(P,x0,y0,w,h),{L,list}=signComps(mask,w,h),area=w*h,speck=Math.max(14,area*5e-5),keepId=new Uint8Array(list.length+1);let ink=0;
  list.forEach(c=>{if(c.a>=speck&&!signJunk(c,w,h,false)){keepId[c.id]=1;ink+=c.a}});
  if(ink<40)throw new Error('No signature found in the box. Move the box over the signature.');
  if(ink/area>.35)throw new Error('Too much dark area in the box. Move the box closer around the signature.');
  const keep=new Uint8Array(area);let bx0=w,by0=h,bx1=-1,by1=-1;
  for(let i=0;i<area;i++)if(L[i]&&keepId[L[i]]){keep[i]=1;const x=i%w,y=(i/w)|0;if(x<bx0)bx0=x;if(x>bx1)bx1=x;if(y<by0)by0=y;if(y>by1)by1=y}
  const pd=3;bx0=Math.max(0,bx0-pd);by0=Math.max(0,by0-pd);bx1=Math.min(w-1,bx1+pd);by1=Math.min(h-1,by1+pd);
  const ow=bx1-bx0+1,oh=by1-by0+1,alpha=new Uint8Array(ow*oh),hi=th+20,span=Math.max(30,hi*.55);
  for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){const gx=bx0+x,gy=by0+y;let near=false;
    for(let j=-1;j<=1&&!near;j++)for(let i=-1;i<=1;i++){const xx=gx+i,yy=gy+j;if(xx>=0&&yy>=0&&xx<w&&yy<h&&keep[yy*w+xx]){near=true;break}}
    if(!near)continue;const v=n[(y0+gy)*W+x0+gx];let a=v>=hi?0:Math.min(255,Math.round((hi-v)/span*255));if(keep[gy*w+gx])a=Math.max(a,140);alpha[y*ow+x]=a}
  return{alpha,w:ow,h:oh,ox:x0+bx0,oy:y0+by0}}

/* ---------- screen side: picture → arrays, arrays → PNG + 1-bit PDF mask ---------- */
function signPrep(cv){const W=cv.width,H=cv.height,d=cv.getContext('2d').getImageData(0,0,W,H).data,lum=new Uint8Array(W*H);
  for(let i=0,j=0;i<d.length;i+=4,j++){const a=d[i+3]/255;lum[j]=Math.round((.299*d[i]+.587*d[i+1]+.114*d[i+2])*a+255*(1-a))}
  return signPrepLum(lum,W,H)}
function signRender(m){
  const cut=document.createElement('canvas');cut.width=m.w;cut.height=m.h;const cg=cut.getContext('2d'),id=cg.createImageData(m.w,m.h);
  const c=parseInt(SIGN_INK.slice(1),16),R=c>>16&255,G=c>>8&255,B=c&255;
  for(let i=0;i<m.w*m.h;i++){id.data[i*4]=R;id.data[i*4+1]=G;id.data[i*4+2]=B;id.data[i*4+3]=m.alpha[i]}cg.putImageData(id,0,0);
  const s=Math.min(1,SIGN_MAX_W/m.w,SIGN_MAX_H/m.h),ow=Math.max(1,Math.round(m.w*s)),oh=Math.max(1,Math.round(m.h*s));
  const out=document.createElement('canvas');out.width=ow;out.height=oh;const og=out.getContext('2d');og.imageSmoothingQuality='high';og.drawImage(cut,0,0,ow,oh);
  /* 1-bit mask for the PDF: rows of bytes, first pixel = highest bit, 1 = ink */
  const a=og.getImageData(0,0,ow,oh).data,rb=Math.ceil(ow/8);let bin='';
  for(let y=0;y<oh;y++)for(let b=0;b<rb;b++){let v=0;for(let i=0;i<8;i++){const x=b*8+i;if(x<ow&&a[(y*ow+x)*4+3]>110)v|=128>>i}bin+=String.fromCharCode(v)}
  return{png:out.toDataURL('image/png'),bits:btoa(bin),w:ow,h:oh}}
const signFromCanvas=cv=>{const P=signPrep(cv);return signRender(signMask(P,{x0:0,y0:0,x1:P.W,y1:P.H}))};
/* the chosen file on a white sheet (big phone photos scaled down to 1600 px) */
function signLoad(file){return new Promise((ok,bad)=>{
  if(!file||!/^image\/(png|jpe?g|webp|gif|bmp)$/.test(file.type))return bad(new Error('Choose a PNG or JPG image of the signature'));
  if(file.size>15*1024*1024)return bad(new Error('Image is too large (more than 15 MB)'));
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{URL.revokeObjectURL(url);try{const k=Math.min(1,1600/img.width,1600/img.height);const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
    const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);ok(c)}catch(e){bad(e)}};
  img.onerror=()=>{URL.revokeObjectURL(url);bad(new Error('Could not read this image'))};img.src=url})}

/* sample (dummy) signature written from the name, for logins that existed before change 23 */
function makeSampleSign(name){
  if(typeof document==='undefined'||!document.createElement)return null;
  const c=document.createElement('canvas');const g=c&&c.getContext&&c.getContext('2d');if(!g||typeof g.fillText!=='function'||typeof g.getImageData!=='function')return null;
  const t=String(name||'Staff').replace(/\s+/g,' ').trim();c.width=1000;c.height=260;g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.fillStyle='#000';g.strokeStyle='#000';
  let sz=92;const font=s=>`italic ${s}px "Segoe Script","Brush Script MT","Lucida Handwriting","Snell Roundhand","Apple Chancery","Dancing Script",cursive`;
  g.font=font(sz);let w=g.measureText(t).width;if(w>900){sz=Math.floor(sz*900/w);g.font=font(sz);w=g.measureText(t).width}
  g.fillText(t,40,160);g.lineWidth=4;g.lineCap='round';g.beginPath();g.moveTo(52,196);g.bezierCurveTo(52+w*.35,222,52+w*.7,176,Math.min(960,60+w),190);g.stroke();
  try{return signFromCanvas(c)}catch(e){return null}}
function addSign(u,s,by,sample){
  const old=signOf(u);const r={id:uid('sg'),userId:u.id,png:s.png,bits:s.bits,w:s.w,h:s.h,at:Date.now(),by:by||'',sample:!!sample};
  db.signs=db.signs||[];db.signs.push(r);u.signId=r.id;
  /* an old signature no invoice was issued with is not kept */
  if(old&&!db.payments.some(p=>p.signId===old.id))db.signs=db.signs.filter(x=>x!==old);
  return r}
/* gives every staff login without a signature a sample one; false when this device cannot draw (then it is tried again later) */
function sampleSigns(){if(!db||!Array.isArray(db.users))return false;db.signs=Array.isArray(db.signs)?db.signs:[];let ok=true;
  db.users.filter(staffUser).forEach(u=>{if(signOf(u))return;const s=makeSampleSign(u.name);if(!s){ok=false;return}addSign(u,s,'System (sample)',true)});return ok}

/* ---------- screens ---------- */
const signImg=(s,alt,cls='')=>s?`<img class="${cls}" src="${E(s.png)}" alt="${E(alt)}" width="${s.w}" height="${s.h}">`:'';
const signPill=u=>{const st=signState(u);return st==='own'?pill('Added','good'):st==='sample'?pill('Sample','warn'):pill('Not added','bad')};
function signPanelHtml(u){u=u||cur();const s=signOf(u),st=signState(u);
  return`<div class="panel sig-panel" id="sigPanel"><h2>Official signature ${signPill(u)}</h2>
   <div class="sig-paper${s?'':' empty'}">${s?signImg(s,'Your signature'):'<span>No signature yet</span>'}</div>
   <p class="note" style="margin:10px 0">${st==='sample'?'<b>This is a sample signature made from your name.</b> Replace it with your real signature. ':st==='own'?`Added on ${E(fmtT(s.at))}. `:'<b>Add your signature.</b> '}It is printed on the invoices you issue: Cash and Cheque payments you enter, and UPI payments you confirm. Invoices already issued keep the signature they were issued with.</p>
   <div class="actions"><button type="button" class="btn sm ${st==='own'?'':'primary'}" data-act="signEdit">${s?'Replace signature':'Add signature'}</button></div></div>`}
ui.sig=null;
const SIGN_FILE=`<input type="file" class="sr" accept="image/png,image/jpeg,image/webp" data-change="signFile">`;
ACT.signEdit=()=>{const u=cur();if(!staffUser(u))throw new Error('Only staff logins have an official signature');ui.sig={P:null,cv:null,box:null,auto:null,out:null};
  dialog(`<h3>Your official signature</h3><p class="muted" style="margin:0 0 12px">Upload a photo or scan of your signature. The background is cleaned automatically; only the signature is printed on your invoices, above “Authorised Signatory”.</p>
   <div id="sigPick"><label class="sig-drop" id="sigDrop">${SIGN_FILE}<b>Choose image</b><small>A phone photo is fine: paper, shadows, notebook lines and dust are removed. Best result: dark pen on light paper.</small></label></div>
   <div id="sigCropStep" hidden><p class="note" id="sigCropHelp" style="margin:0 0 8px">Drag the box around your signature. Drag the corners to resize. (Keyboard: arrow keys move it, Shift + arrow keys resize it.)</p>
    <div class="sig-crop-area"><div class="sig-crop" id="sigCrop"><div class="sig-shade" aria-hidden="true"><div class="sig-hole" id="sigHole"></div></div>
     <div class="sig-box" id="sigBox" tabindex="0" role="group" aria-label="Signature area" aria-describedby="sigCropHelp"><span class="sig-h nw" data-h="nw"></span><span class="sig-h ne" data-h="ne"></span><span class="sig-h sw" data-h="sw"></span><span class="sig-h se" data-h="se"></span></div></div></div>
    <div class="actions" style="margin-top:8px"><button type="button" class="btn sm" data-act="signFind">Find signature again</button><button type="button" class="btn sm" data-act="signWhole">Whole image</button><label class="btn sm">${SIGN_FILE}Choose another image</label></div></div>
   <div class="sig-prev-wrap"><span class="label">Preview on the invoice</span><div class="sig-paper empty" id="sigPrev"><span>Your signature will show here</span></div><small class="err" id="sigErr" role="alert"></small></div>
   <div class="actions" style="justify-content:flex-end;margin-top:12px"><button type="button" class="btn" data-act="closeDialog">Cancel</button><button type="button" class="btn primary" id="sigSave" data-act="signSave" disabled>Save signature</button></div>`,'Official signature');
  const d=$('#sigDrop');if(d){d.addEventListener('dragover',e=>{e.preventDefault();d.classList.add('over')});d.addEventListener('dragleave',()=>d.classList.remove('over'));
    d.addEventListener('drop',e=>{e.preventDefault();d.classList.remove('over');const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)signTake(f)})}};
function signShow(out,err,busy){if(!ui.sig)return;ui.sig.out=out||null;const pv=$('#sigPrev'),er=$('#sigErr'),sv=$('#sigSave');if(!pv)return;
  pv.className='sig-paper'+(out?'':' empty');pv.innerHTML=out?signImg(out,'Preview of your signature'):`<span>${busy?'Cleaning the image…':'Your signature will show here'}</span>`;if(er)er.textContent=err||'';if(sv)sv.disabled=!out}
/* a file was chosen: load it, find the signature, show the crop box and the cleaned preview */
function signTake(f){if(!ui.sig)return;signShow(null,'',true);
  signLoad(f).then(cv=>new Promise(r=>setTimeout(()=>r(cv),30))).then(cv=>{if(!ui.sig)return;const P=signPrep(cv),box=signAuto(P);Object.assign(ui.sig,{cv,P,box,auto:{...box}});
    $('#sigPick').hidden=true;$('#sigCropStep').hidden=false;const cr=$('#sigCrop');cr.querySelector('canvas')?.remove();cv.className='sig-src';cr.prepend(cv);
    signCropInit();signPlace();signPreview()}).catch(e=>signShow(null,e.message))}
CHG.signFile=el=>{const f=el.files&&el.files[0];el.value='';if(f)signTake(f)};
function signPreview(){const S=ui.sig;if(!S||!S.P)return;try{signShow(signRender(signMask(S.P,S.box)))}catch(e){signShow(null,e.message)}}
function signPlace(){const S=ui.sig;if(!S||!S.P)return;const{W,H}=S.P,b=S.box;
  [$('#sigBox'),$('#sigHole')].forEach(el=>{if(!el)return;el.style.left=b.x0/W*100+'%';el.style.top=b.y0/H*100+'%';el.style.width=(b.x1-b.x0)/W*100+'%';el.style.height=(b.y1-b.y0)/H*100+'%'})}
/* move the whole box or one corner; the cleaned preview updates when the finger / mouse is released */
function signCropInit(){const bx=$('#sigBox'),cr=$('#sigCrop');if(!bx||bx._ready)return;bx._ready=true;let st=null,tm=0;
  const lim=()=>{const{W,H}=ui.sig.P;return{W,H,min:Math.max(16,Math.round(.04*Math.max(W,H)))}};
  const set=(x0,y0,x1,y1)=>{const{W,H,min}=lim();x0=Math.max(0,Math.min(x0,W-min));y0=Math.max(0,Math.min(y0,H-min));x1=Math.min(W,Math.max(x1,x0+min));y1=Math.min(H,Math.max(y1,y0+min));ui.sig.box={x0,y0,x1,y1};signPlace()};
  const later=()=>{clearTimeout(tm);tm=setTimeout(signPreview,250)};
  bx.addEventListener('pointerdown',e=>{if(!ui.sig)return;e.preventDefault();bx.setPointerCapture(e.pointerId);st={h:e.target.dataset.h||'move',x:e.clientX,y:e.clientY,b:{...ui.sig.box}};bx.focus({preventScroll:true})});
  bx.addEventListener('pointermove',e=>{if(!st||!ui.sig)return;const r=cr.getBoundingClientRect(),{W,H}=lim(),dx=(e.clientX-st.x)*W/r.width,dy=(e.clientY-st.y)*H/r.height,b=st.b;
    if(st.h==='move'){const w=b.x1-b.x0,h=b.y1-b.y0,x0=Math.max(0,Math.min(W-w,b.x0+dx)),y0=Math.max(0,Math.min(H-h,b.y0+dy));set(x0,y0,x0+w,y0+h);return}
    set(st.h.includes('w')?Math.min(b.x0+dx,b.x1-lim().min):b.x0,st.h.includes('n')?Math.min(b.y0+dy,b.y1-lim().min):b.y0,st.h.includes('e')?b.x1+dx:b.x1,st.h.includes('s')?b.y1+dy:b.y1)});
  const end=()=>{if(!st)return;st=null;signPreview()};bx.addEventListener('pointerup',end);bx.addEventListener('pointercancel',end);
  bx.addEventListener('keydown',e=>{const k={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!k||!ui.sig)return;e.preventDefault();
    const{W,H}=lim(),s=Math.max(2,Math.round(.02*Math.max(W,H))),b=ui.sig.box,dx=k[0]*s,dy=k[1]*s;
    if(e.shiftKey)set(b.x0,b.y0,b.x1+dx,b.y1+dy);else{const w=b.x1-b.x0,h=b.y1-b.y0,x0=Math.max(0,Math.min(W-w,b.x0+dx)),y0=Math.max(0,Math.min(H-h,b.y0+dy));set(x0,y0,x0+w,y0+h)}later()})}
ACT.signFind=()=>{const S=ui.sig;if(!S||!S.P)return;S.box={...S.auto};signPlace();signPreview()};
ACT.signWhole=()=>{const S=ui.sig;if(!S||!S.P)return;S.box={x0:0,y0:0,x1:S.P.W,y1:S.P.H};signPlace();signPreview()};
ACT.signSave=()=>{const u=cur();if(!staffUser(u))throw new Error('Only staff logins have an official signature');const o=ui.sig&&ui.sig.out;if(!o)throw new Error('Upload your signature first');
  const before=signState(u);addSign(u,o,u.name,false);ui.sig=null;
  log('Official signature changed','User',u.username,{signature:{none:'not added',sample:'sample',own:'own'}[before]},{signature:'own (new)'});
  save();closeDialog();const p=$('#sigPanel');if(p)p.outerHTML=signPanelHtml(u);renderSignBar();if(ui.route==='settings')renderPage();toast('Signature saved. It will be on the invoices you issue.')};

/* reminder strip for a staff login that has no signature yet (a sample one counts as added) */
function renderSignBar(){const slot=document.getElementById('signSlot');if(!slot)return;const u=cur();let hide=false;try{hide=sessionStorage.getItem('npcte_sbar')==='1'}catch(e){}
  if(!staffUser(u)||signOf(u)||hide){slot.innerHTML='';return}
  slot.innerHTML=`<div class="installbar ib-app nbar" role="region" aria-label="Official signature"><div class="seal" aria-hidden="true">✍</div><div><b>Add your official signature</b><small>It is printed on the invoices you issue (cash and cheque you enter, UPI you confirm).</small></div>
   <div class="actions nowrap"><button class="btn primary" data-act="signEdit">Add signature</button><button class="btn" data-act="sbarHide" aria-label="Hide">Later</button></div></div>`}
ACT.sbarHide=()=>{try{sessionStorage.setItem('npcte_sbar','1')}catch(e){}renderSignBar()};
