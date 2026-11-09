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
    `<< /Title (${pdfEsc(meta.title)}) /Author (${pdfEsc(meta.author)}) /Producer (NPCTE ERP) /CreationDate (D:${meta.date}) >>`
  ];
  let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offs=[];
  objs.forEach((o,i)=>{offs.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});
  const xref=pdf.length;
  pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
