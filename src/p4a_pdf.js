/* ---------- PDF writer (A4, standard fonts, JPEG images, no libraries so it works offline) ----------
   Fonts: Helvetica / Helvetica-Bold (default) and Times-Bold / Times-BoldItalic / Times-Italic (o.font 'tb' 'tbi' 'ti').
   Images: JPEG (DCTDecode) from RCPT_IMG (p4c_assets.js), with an optional soft mask and opacity. */
const HELV=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
function pdfSafe(t){
  return String(t??'').replace(/₹/g,'Rs. ').replace(/[–—]/g,'-').replace(/[·•]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...')
    .replace(/[^\x20-\x7e]/g,c=>{let n='';try{n=c.normalize('NFD').replace(/[̀-ͯ]/g,'')}catch(e){}return /^[\x20-\x7e]+$/.test(n)?n:'?'});
}
const PDF_FONT={tb:'F3',tbi:'F4',ti:'F5'};
const pdfW=(t,size,bold,font)=>{const tw=font&&typeof TIMES_W!=='undefined'&&TIMES_W[font];
  return tw?sum([...pdfSafe(t)],c=>tw[c.charCodeAt(0)-32]||500)*size/1000:sum([...pdfSafe(t)],c=>HELV[c.charCodeAt(0)-32]||556)*size/1000*(bold?1.06:1)};
const pdfEsc=t=>pdfSafe(t).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
function makePdf(draw,meta){
  const W=meta.w||595,H=meta.h||842,pages=[[]];let out=pages[0];const col=h=>{const n=parseInt(h.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255].map(v=>v.toFixed(3)).join(' ')};
  const imgs=[],gs=[];
  const fontOf=o=>o.font&&PDF_FONT[o.font]||(o.bold?'F2':'F1');
  const api={
    rect(x,y,w,h,fill){out.push(`${col(fill)} rg ${x} ${H-y-h} ${w} ${h} re f`)},
    line(x1,y1,x2,y2,stroke='#d7dce5',w=.8){out.push(`${col(stroke)} RG ${w} w ${x1} ${H-y1} m ${x2} ${H-y2} l S`)},
    width:(t,o={})=>pdfW(t,o.size||10,o.bold,o.font),
    newPage(){out=[];pages.push(out)},
    text(x,y,t,o={}){const{size=10,bold=false,color='#1b2437',align='left'}=o;const w=pdfW(t,size,bold,o.font);const px=align==='right'?x-w:align==='center'?x-w/2:x;
      out.push(`BT /${fontOf(o)} ${size} Tf ${col(color)} rg ${px.toFixed(2)} ${(H-y).toFixed(2)} Td (${pdfEsc(t)}) Tj ET`)},
    /* text turned 90 degrees, read from bottom to top; (x,y) = start of the baseline */
    textUp(x,y,t,o={}){const{size=10,color='#1b2437'}=o;out.push(`q 0 1 -1 0 ${x.toFixed(2)} ${(H-y).toFixed(2)} cm BT /${fontOf(o)} ${size} Tf ${col(color)} rg 0 0 Td (${pdfEsc(t)}) Tj ET Q`)},
    stamp(t,o={}){const{size=70,color='#f3c4c4',x=300,y=470}=o;const w=pdfW(t,size,true);const c=Math.cos(Math.PI/4),s=Math.sin(Math.PI/4);
      out.push(`q ${c.toFixed(4)} ${s.toFixed(4)} ${(-s).toFixed(4)} ${c.toFixed(4)} ${x} ${H-y} cm BT /F2 ${size} Tf ${col(color)} rg ${(-w/2).toFixed(1)} 0 Td (${pdfEsc(t)}) Tj ET Q`)},
    /* JPEG image from RCPT_IMG; o.alpha = opacity 0..1. Returns false when the image is not available. */
    image(name,x,y,w,h,o={}){const im=typeof RCPT_IMG!=='undefined'&&RCPT_IMG[name];if(!im)return false;
      let k=imgs.findIndex(v=>v.name===name);if(k<0){imgs.push({name,im});k=imgs.length-1}
      let g='';if(o.alpha!=null&&o.alpha<1){let j=gs.indexOf(o.alpha);if(j<0){gs.push(o.alpha);j=gs.length-1}g=`/GS${j+1} gs `}
      out.push(`q ${g}${w} 0 0 ${h} ${x} ${H-y-h} cm /Im${k+1} Do Q`);return true},
    wrap(x,y,t,width,o={}){const size=o.size||10,words=pdfSafe(t).split(/\s+/);let line='',yy=y;words.forEach(w=>{const tr=line?line+' '+w:w;if(pdfW(tr,size,o.bold,o.font)>width&&line){api.text(x,yy,line,o);yy+=size+(o.lead||4);line=w}else line=tr});if(line){api.text(x,yy,line,o);yy+=size+(o.lead||4)}return yy}
  };
  draw(api);
  const contents=pages.map(p=>p.join('\n'));
  /* objects 1-7 keep their old numbers; fonts, images and opacity states follow */
  const objs=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '', // page list, filled below
    '', // page, filled below once the image numbers are known
    `<< /Length ${contents[0].length} >>\nstream\n${contents[0]}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${pdfEsc(meta.title)}) /Author (${pdfEsc(meta.author)}) /Producer (NPCTE ERP) /CreationDate (D:${meta.date}) >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-BoldItalic /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>'
  ];
  const add=o=>{objs.push(o);return objs.length};
  const jpeg=(b64,w,h,gray,extra='')=>{const bin=atob(b64);return add(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /${gray?'DeviceGray':'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode${extra} /Length ${bin.length} >>\nstream\n${bin}\nendstream`)};
  const xo=imgs.map((v,i)=>{const m=v.im.mask?jpeg(v.im.mask,v.im.w,v.im.h,true):0;return`/Im${i+1} ${jpeg(v.im.jpg,v.im.w,v.im.h,v.im.gray,m?` /SMask ${m} 0 R`:'')} 0 R`});
  const gso=gs.map((a,i)=>`/GS${i+1} ${add(`<< /Type /ExtGState /ca ${a} /CA ${a} >>`)} 0 R`);
  const res=`/Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 8 0 R /F4 9 0 R /F5 10 0 R >>${xo.length?` /XObject << ${xo.join(' ')} >>`:''}${gso.length?` /ExtGState << ${gso.join(' ')} >>`:''} >>`;
  const pageObj=c=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ${res} /Contents ${c} 0 R >>`;
  const kids=[3];objs[2]=pageObj(4);
  contents.slice(1).forEach(c=>{const ci=add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);kids.push(add(pageObj(ci)))});
  objs[1]=`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`;
  let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offs=[];
  objs.forEach((o,i)=>{offs.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});
  const xref=pdf.length;
  pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
