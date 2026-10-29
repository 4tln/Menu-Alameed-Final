/* Presentation-only photo matting. Source image files and product data stay intact. */
(() => {
  const selector = '.category-cover-photo img, img.catalog-photo, #productPhoto img.detail-photo';
  const cache = new Map();
  const pending = [];
  let active = 0;
  function enqueue(job) { pending.push(job); pump(); }
  function pump() {
    while(active < 2 && pending.length) {
      active++;
      Promise.resolve().then(pending.shift()).finally(() => { active--; pump(); });
    }
  }
  function prepare(source) {
    if(cache.has(source)) return cache.get(source);
    const promise = new Promise(resolve => enqueue(async () => {
      const img = new Image();
      img.decoding = 'async';
      img.src = source;
      try {
        await img.decode();
        const scale = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const sample = document.createElement('canvas'); sample.width=w;sample.height=h;
        const ctx=sample.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);
        const pixels=ctx.getImageData(0,0,w,h), d=pixels.data;
        const corners=[0,w-1,(h-1)*w,w*h-1].map(i=>[d[i*4],d[i*4+1],d[i*4+2]]);
        const pale=corners.filter(c=>Math.min(...c)>200 && Math.max(...c)-Math.min(...c)<36);
        const bg=pale.length ? [0,1,2].map(k=>pale.reduce((n,c)=>n+c[k],0)/pale.length) : null;
        const removed=new Uint8Array(w*h), queue=new Int32Array(w*h);let head=0,tail=0;
        function eligible(i){
          const n=i*4;if(d[n+3]<12)return true;
          if(!bg)return false;
          const r=d[n],g=d[n+1],b=d[n+2];
          return Math.min(r,g,b)>205 && Math.max(r,g,b)-Math.min(r,g,b)<30 && Math.max(Math.abs(r-bg[0]),Math.abs(g-bg[1]),Math.abs(b-bg[2]))<25;
        }
        function push(i){if(!removed[i]&&eligible(i)){removed[i]=1;queue[tail++]=i;}}
        for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}
        for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
        while(head<tail){const i=queue[head++],x=i%w;if(x)push(i-1);if(x<w-1)push(i+1);if(i>=w)push(i-w);if(i<w*(h-1))push(i+w);}
        // Preserve enclosed whites (cheese, sauces and plates); only edge-connected background is masked.
        let left=w,top=h,right=-1,bottom=-1;
        for(let i=0;i<w*h;i++){
          const n=i*4;
          if(removed[i])d[n+3]=0;
          else if(d[n+3]>32){const x=i%w,y=Math.floor(i/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
          d[n]=255;d[n+1]=255;d[n+2]=255;
        }
        if(right<left || (right-left)*(bottom-top)<w*h*.04){resolve(null);return;}
        const pad=Math.ceil(Math.max(w,h)*.025);left=Math.max(0,left-pad);top=Math.max(0,top-pad);right=Math.min(w-1,right+pad);bottom=Math.min(h-1,bottom+pad);
        ctx.putImageData(pixels,0,0);
        const full=document.createElement('canvas');full.width=img.naturalWidth;full.height=img.naturalHeight;
        const fc=full.getContext('2d');fc.drawImage(img,0,0);fc.globalCompositeOperation='destination-in';fc.drawImage(sample,0,0,full.width,full.height);
        const sx=left/scale,sy=top/scale,sw=(right-left+1)/scale,sh=(bottom-top+1)/scale;
        const out=document.createElement('canvas');out.width=Math.ceil(sw);out.height=Math.ceil(sh);
        out.getContext('2d').drawImage(full,sx,sy,sw,sh,0,0,out.width,out.height);
        const blob=await new Promise(r=>out.toBlob(r,'image/png'));
        resolve(blob ? URL.createObjectURL(blob) : null);
      } catch {resolve(null);}
    }));
    cache.set(source,promise);return promise;
  }
  function visit(root){
    const images=[...(root.matches?.(selector)?[root]:[]),...(root.querySelectorAll?.(selector)||[])];
    for(const img of images){
      const source=img.getAttribute('src');
      if(!source||source.startsWith('blob:')||img.dataset.preparingPhoto===source)continue;
      img.dataset.preparingPhoto=source;
      prepare(source).then(url=>{if(url&&img.isConnected&&img.getAttribute('src')===source){img.src=url;img.dataset.photoReady='true';}});
    }
  }
  visit(document);
  new MutationObserver(records=>{
    for(const r of records){if(r.type==='attributes')visit(r.target);else for(const n of r.addedNodes)if(n.nodeType===1)visit(n);}
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
})();
