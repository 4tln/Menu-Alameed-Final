/* Presentation-only localization: cart keys, prices and order payloads stay canonical. */
window.AlameedLanguage = (() => {
  const dictionary = window.ALAMEED_EN;
  const keys = Object.keys(dictionary).sort((a,b) => b.length-a.length);
  const pattern = new RegExp(keys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const records = new WeakMap();
  const attributes = ['aria-label', 'title', 'placeholder', 'alt'];
  let language = 'ar';
  try { if(localStorage.getItem('alameed_language_v1') === 'en') language = 'en'; } catch {}
  function translate(value) {
    if(language !== 'en') return String(value);
    return String(value).replace(pattern, text => dictionary[text]).replace(/(\d:\d{2}) ص/g,'$1 AM').replace(/(\d:\d{2}) م/g,'$1 PM');
  }
  function localize(node, key, read, write) {
    const current = read();
    let record = records.get(node);
    if(!record) { record = {}; records.set(node,record); }
    if(!record[key] || current !== record[key].output) record[key] = {source:current,output:current};
    const next = translate(record[key].source);
    record[key].output = next;
    if(current !== next) write(next);
  }
  function refresh() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())) {
      if(node.parentElement?.closest('script,style,textarea,input,#languageSwitch,[translate="no"]')) continue;
      const text = node;
      localize(text, 'text', () => text.nodeValue, value => { text.nodeValue=value; });
    }
    document.body.querySelectorAll('[aria-label],[title],[placeholder],[alt]').forEach(el => {
      if(el.closest('#languageSwitch,[translate="no"]')) return;
      attributes.forEach(attr => { if(el.hasAttribute(attr)) localize(el, attr, () => el.getAttribute(attr), value => el.setAttribute(attr,value)); });
    });
  }
  function setLanguage(next, persist=true) {
    language = next === 'en' ? 'en' : 'ar';
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
    document.title = language === 'en' ? 'Alameed Fatayer Restaurant' : 'مطعم فطائر العميد';
    const control = document.getElementById('languageSwitch');
    control.dataset.language = language;
    control.setAttribute('aria-checked',String(language === 'en'));
    control.setAttribute('aria-label',language === 'en' ? 'Language: English. Switch to Arabic' : 'اللغة العربية. التبديل إلى الإنجليزية');
    if(persist) { try { localStorage.setItem('alameed_language_v1',language); } catch {} }
    refresh();
  }
  function init() {
    const control = document.getElementById('languageSwitch');
    let gesture = null, suppressClick = false;
    control.addEventListener('pointerdown', event => {
      if(event.button !== 0) return;
      gesture = {x:event.clientX,id:event.pointerId};
      suppressClick = false;
      control.setPointerCapture(event.pointerId);
    });
    control.addEventListener('pointermove', event => {
      if(!gesture || gesture.id !== event.pointerId) return;
      const dx=event.clientX-gesture.x;
      if(Math.abs(dx)>5) {
        control.classList.add('is-dragging');
        const rect=control.getBoundingClientRect();
        const offset=Math.max(3,Math.min(rect.width/2-1,event.clientX-rect.left-rect.width/4));
        control.style.setProperty('--thumb-left',offset+'px');
      }
    });
    const clearGesture = () => { gesture=null; control.classList.remove('is-dragging'); control.style.removeProperty('--thumb-left'); };
    control.addEventListener('pointerup', event => {
      if(!gesture) return;
      const distance=event.clientX-gesture.x;
      if(Math.abs(distance)>8) {
        suppressClick=true;
        setLanguage(distance<0 ? 'en' : 'ar');
      }
      clearGesture();
    });
    control.addEventListener('pointercancel',clearGesture);
    control.addEventListener('lostpointercapture',clearGesture);
    control.addEventListener('click',() => {
      if(suppressClick) { suppressClick=false; return; }
      setLanguage(language === 'ar' ? 'en' : 'ar');
    });
    control.addEventListener('keydown',event => {
      if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
        event.preventDefault();
        setLanguage(['ArrowLeft','Home'].includes(event.key) ? 'en' : 'ar');
      }
    });
    setLanguage(language,false);
    new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  }
  return {init,translate,refresh,setLanguage};
})();
