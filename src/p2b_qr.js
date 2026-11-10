/* =====================================================================
   Real, scannable QR code (byte mode, error correction M, versions 1-20, automatic mask).
   Follows the QR spec (ISO/IEC 18004) in the compact style of Nayuki's reference encoder.
   qrSvg(text) returns an <svg> any phone camera or UPI app can scan.
   ===================================================================== */
const QR=(()=>{
  /* error correction level M: codewords per block and number of blocks, versions 1..40 */
  const ECC_CW=[-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28];
  const BLOCKS=[-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49];
  const FMT_M=0; /* format bits for level M */
  function rawModules(v){let r=(16*v+128)*v+64;if(v>=2){const n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36}return r}
  const dataCw=v=>Math.floor(rawModules(v)/8)-ECC_CW[v]*BLOCKS[v];
  function alignPos(v){if(v===1)return[];const n=Math.floor(v/7)+2;const step=v===32?26:Math.ceil((v*4+4)/(n*2-2))*2;const out=[6];for(let p=v*4+10;out.length<n;p-=step)out.splice(1,0,p);return out}
  /* Reed-Solomon over GF(256) with polynomial 0x11D */
  function rsMul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x}return z&255}
  function rsDivisor(deg){const r=new Array(deg).fill(0);r[deg-1]=1;let root=1;for(let i=0;i<deg;i++){for(let j=0;j<r.length;j++){r[j]=rsMul(r[j],root);if(j+1<r.length)r[j]^=r[j+1]}root=rsMul(root,2)}return r}
  function rsRem(data,div){const r=div.map(()=>0);for(const b of data){const f=b^r.shift();r.push(0);div.forEach((c,i)=>r[i]^=rsMul(c,f))}return r}
  function utf8(s){return Array.from(new TextEncoder().encode(s))}
  function encode(text){
    const bytes=utf8(text);let v=1;
    for(;v<=40;v++){const cc=v<10?8:16;if(4+cc+bytes.length*8<=dataCw(v)*8)break}
    if(v>40)throw new Error('Text too long for a QR code');
    /* bit stream: mode 0100 (byte), count, data, terminator, pad */
    const bits=[];const put=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push((val>>>i)&1)};
    put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));
    const cap=dataCw(v)*8;put(0,Math.min(4,cap-bits.length));put(0,(8-bits.length%8)%8);
    for(let p=0xEC;bits.length<cap;p^=0xEC^0x11)put(p,8);
    const data=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(''),2));
    /* split into blocks, add ECC, interleave */
    const nb=BLOCKS[v],ecl=ECC_CW[v],raw=Math.floor(rawModules(v)/8),nShort=nb-raw%nb,shortLen=Math.floor(raw/nb);
    const div=rsDivisor(ecl);const blocks=[];
    for(let i=0,k=0;i<nb;i++){const dl=shortLen-ecl+(i<nShort?0:1);const d=data.slice(k,k+dl);k+=dl;const e=rsRem(d,div);if(i<nShort)d.push(0);blocks.push(d.concat(e))}
    const all=[];for(let i=0;i<blocks[0].length;i++)blocks.forEach((b,j)=>{if(i!==shortLen-ecl||j>=nShort)all.push(b[i])});
    /* matrix */
    const size=v*4+17;const M=[...Array(size)].map(()=>new Array(size).fill(false));const F=[...Array(size)].map(()=>new Array(size).fill(false));
    const set=(x,y,d)=>{M[y][x]=d;F[y][x]=true};
    for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
    const finder=(x,y)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),xx=x+dx,yy=y+dy;if(xx>=0&&xx<size&&yy>=0&&yy<size)set(xx,yy,d!==2&&d!==4)}};
    finder(3,3);finder(size-4,3);finder(3,size-4);
    const ap=alignPos(v);ap.forEach((a,i)=>ap.forEach((b,j)=>{if(!(i===0&&j===0||i===0&&j===ap.length-1||i===ap.length-1&&j===0))for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(a+dx,b+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)}));
    const drawFormat=mask=>{const d=FMT_M<<3|mask;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const b=(d<<10|r)^0x5412;const g=i=>((b>>>i)&1)!==0;
      for(let i=0;i<=5;i++)set(8,i,g(i));set(8,7,g(6));set(8,8,g(7));set(7,8,g(8));for(let i=9;i<15;i++)set(14-i,8,g(i));
      for(let i=0;i<8;i++)set(size-1-i,8,g(i));for(let i=8;i<15;i++)set(8,size-15+i,g(i));set(8,size-8,true)};
    drawFormat(0);
    if(v>=7){let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);const b=v<<12|r;for(let i=0;i<18;i++){const bit=((b>>>i)&1)!==0,a=size-11+i%3,c=Math.floor(i/3);set(a,c,bit);set(c,a,bit)}}
    /* data in zig-zag */
    let i=0;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){const x=right-j,up=((right+1)&2)===0,y=up?size-1-vert:vert;
      if(!F[y][x]&&i<all.length*8){M[y][x]=((all[i>>>3]>>>(7-(i&7)))&1)!==0;i++}}}
    const MASKS=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
    const applyMask=m=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!F[y][x]&&MASKS[m](x,y))M[y][x]=!M[y][x]};
    const penalty=()=>{let p=0;const run=(get)=>{for(let a=0;a<size;a++){let c=get(a,0),n=1;const line=[c];for(let b=1;b<size;b++){const v=get(a,b);line.push(v);if(v===c){n++;if(n===5)p+=3;else if(n>5)p++}else{c=v;n=1}}
        const s=line.map(x=>x?1:0).join('');for(const pat of ['10111010000','00001011101'])for(let k=s.indexOf(pat);k>=0;k=s.indexOf(pat,k+1))p+=40}};
      run((a,b)=>M[a][b]);run((a,b)=>M[b][a]);
      for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=M[y][x];if(c===M[y][x+1]&&c===M[y+1][x]&&c===M[y+1][x+1])p+=3}
      let dark=0;M.forEach(r=>r.forEach(c=>{if(c)dark++}));const total=size*size;p+=Math.floor(Math.abs(dark*20-total*10)/total)*10;return p};
    let best=0,bestP=Infinity;for(let m=0;m<8;m++){applyMask(m);drawFormat(m);const p=penalty();if(p<bestP){bestP=p;best=m}applyMask(m)}
    applyMask(best);drawFormat(best);return M;
  }
  return{encode};
})();
function qrSvg(text){let M;try{M=QR.encode(String(text))}catch(e){return`<p class="err">${E(e.message)}</p>`}const n=M.length,q=4,s=n+q*2;let d='';
  M.forEach((r,y)=>r.forEach((c,x)=>{if(c)d+=`M${x+q} ${y+q}h1v1h-1z`}));
  return`<svg viewBox="0 0 ${s} ${s}" role="img" aria-label="QR code to pay" shape-rendering="crispEdges" style="background:#fff;display:block;width:100%;height:auto"><path d="${d}" fill="#000"/></svg>`}
