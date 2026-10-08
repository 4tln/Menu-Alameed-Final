(() => {
  const entry=document.getElementById('fullMenuOpen'),dialog=document.getElementById('fullMenuDialog');
  const close=document.getElementById('fullMenuClose'),view=document.getElementById('fullMenuViewport');
  const img=document.getElementById('fullMenuImage'),status=document.getElementById('fullMenuLoading');
  const plus=document.getElementById('fullMenuPlus'),minus=document.getElementById('fullMenuMinus'),output=document.getElementById('fullMenuScale');
  let zoom=1,x=0,y=0,baseW=0,baseH=0,previousOverflow='',loaded=false;
  const points=new Map();
  function paint(){
    if(!baseW)return;
    const w=baseW*zoom,h=baseH*zoom;
    x=w<=view.clientWidth?(view.clientWidth-w)/2:Math.min(0,Math.max(view.clientWidth-w,x));
    y=h<=view.clientHeight?(view.clientHeight-h)/2:Math.min(0,Math.max(view.clientHeight-h,y));
    img.style.width=w+'px';img.style.height=h+'px';
    img.style.transform=`translate(${x}px,${y}px)`;
    output.value=Math.round(zoom*100)+'%';minus.disabled=zoom<=1;plus.disabled=zoom>=5;
  }
  function fit(){
    if(!loaded||!dialog.open)return;
    const ratio=Math.min(view.clientWidth/img.naturalWidth,view.clientHeight/img.naturalHeight);
    baseW=img.naturalWidth*ratio;baseH=img.naturalHeight*ratio;
    img.style.width=baseW+'px';img.style.height=baseH+'px';zoom=1;x=0;y=0;paint();
  }
  function zoomAt(next,cx=view.clientWidth/2,cy=view.clientHeight/2){
    next=Math.max(1,Math.min(5,next));const ratio=next/zoom;
    x=cx-(cx-x)*ratio;y=cy-(cy-y)*ratio;zoom=next;paint();
  }
  entry.addEventListener('click',()=>{
    if(dialog.open)return;
    previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    dialog.showModal();points.clear();
    if(!loaded){status.hidden=false;img.src='full-menu-hd.webp';}else fit();
    close.focus();
  });
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{points.clear();document.body.style.overflow=previousOverflow;entry.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  img.addEventListener('load',()=>{loaded=true;status.hidden=true;fit();});
  img.addEventListener('error',()=>{status.hidden=false;status.textContent=document.documentElement.lang==='en'?'Could not load the menu. Close and try again.':'تعذّر تحميل المنيو. أغلق النافذة وحاول مرة أخرى.';});
  plus.addEventListener('click',()=>zoomAt(zoom+.5));minus.addEventListener('click',()=>zoomAt(zoom-.5));
  view.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});view.setPointerCapture(e.pointerId);});
  view.addEventListener('pointermove',e=>{
    if(!points.has(e.pointerId)||!loaded)return;
    const old=points.get(e.pointerId),before=[...points.values()];
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(points.size===1){x+=e.clientX-old.x;y+=e.clientY-old.y;paint();}
    else if(points.size===2){
      const after=[...points.values()],r=view.getBoundingClientRect();
      const distance=a=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      const bx=(before[0].x+before[1].x)/2-r.left,by=(before[0].y+before[1].y)/2-r.top;
      const ax=(after[0].x+after[1].x)/2-r.left,ay=(after[0].y+after[1].y)/2-r.top;
      const d=distance(before);if(d>0){const next=Math.max(1,Math.min(5,zoom*distance(after)/d));x=ax-(bx-x)*next/zoom;y=ay-(by-y)*next/zoom;zoom=next;paint();}
    }
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>view.addEventListener(type,e=>points.delete(e.pointerId)));
  view.addEventListener('wheel',e=>{e.preventDefault();const r=view.getBoundingClientRect();zoomAt(zoom*(e.deltaY<0?1.15:1/1.15),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  view.addEventListener('dblclick',e=>{const r=view.getBoundingClientRect();zoomAt(zoom>1?1:3,e.clientX-r.left,e.clientY-r.top);});
  new ResizeObserver(()=>fit()).observe(view);
})();
