/* Product details, ingredients and item-specific modifier controls. */
let productSelection = null;
let productQuantity = 1;
let productReturnFocus = null;
const productDialog = document.getElementById('productDialog');

function modifierConfig(item){
  const config = item?.optionConfig;
  if(!config) return null;
  return {
    addons: Array.isArray(config.addons) ? config.addons : [],
    removals: Array.isArray(config.removals) ? config.removals : []
  };
}
function categoryForProduct(name){
  const section = (window.MENU_DATA || []).find(group => group.items?.some(item => item.name === name));
  return section?.category || '';
}
function emptyModifiers(){ return {addons: [], removals: []}; }
function normalizeModifiers(value){
  const source = value || {};
  return {
    addons: Array.isArray(source.addons) ? source.addons.map(option => ({
      name: String(option?.name || option || '').trim(), price: Number(option?.price || 0)
    })).filter(option => option.name) : [],
    removals: Array.isArray(source.removals) ? source.removals.map(option => String(option?.name || option || '').trim()).filter(Boolean) : []
  };
}
function modifierUnitTotal(modifiers){
  return normalizeModifiers(modifiers).addons.reduce((sum, option) => sum + Number(option.price || 0), 0);
}
function modifierSummaryHtml(modifiers){
  const normalized = normalizeModifiers(modifiers);
  const lines = [];
  if(normalized.addons.length) lines.push(`<small><b>إضافات:</b> ${normalized.addons.map(option => escapeHtml(option.name)).join('، ')}</small>`);
  if(normalized.removals.length) lines.push(`<small><b>إزالة:</b> ${normalized.removals.map(name => escapeHtml(name)).join('، ')}</small>`);
  return lines.join('');
}
function modifierOptionHtml(option, type){
  const name = typeof option === 'string' ? option : option.name;
  const price = typeof option === 'string' ? 0 : Number(option.price || 0);
  const image = typeof option === 'string' ? '' : String(option.image || '').trim();
  return `<label class="modifier-option">
    <input type="checkbox" data-modifier-type="${type}" data-modifier-name="${escapeHtml(name)}" data-modifier-price="${price}">
    <span class="modifier-check" aria-hidden="true"></span>
    <span class="modifier-option-copy"><b>${escapeHtml(name)}</b>${price > 0 ? `<strong>${money(price)}${sarIcon()}</strong>` : ''}</span>
    ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" onerror="this.hidden=true">` : ''}
  </label>`;
}
function optionSectionHtml(type, title, limit, options, open){
  const count = options.length;
  const description = count ? `حدد عددًا يصل إلى ${limit}` : 'لا توجد خيارات محددة لهذا الصنف حاليًا';
  const content = count ? `<div class="modifier-list">${options.map(option => modifierOptionHtml(option, type)).join('')}</div>` : `<p class="modifier-empty">${description}</p>`;
  return `<section class="modifier-section" data-modifier-section="${type}">
    <button type="button" class="modifier-section-toggle ${open ? 'expanded' : ''}" data-modifier-toggle="${type}" aria-expanded="${open}">
      <span class="modifier-section-copy"><b>${title}</b><small>${description}</small></span><span class="modifier-section-arrow" aria-hidden="true">⌄</span>
    </button>
    <div class="modifier-section-body" data-modifier-body="${type}" ${open ? '' : 'hidden'}>${content}</div>
  </section>`;
}
function renderProductOptions(item){
  const ingredientsTarget = document.getElementById('productIngredients');
  const optionsTarget = document.getElementById('productOptions');
  const ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];
  ingredientsTarget.hidden = ingredients.length === 0;
  ingredientsTarget.innerHTML = ingredients.length ? ingredients.map(escapeHtml).join('، ') : '';
  const config = modifierConfig(item);
  const isPizza = categoryForProduct(item.name) === 'البيتزا';
  optionsTarget.classList.toggle('pizza-removals-only', isPizza);
  optionsTarget.hidden = !config;
  if(!config){ optionsTarget.innerHTML = ''; return; }
  optionsTarget.innerHTML = [
    ...(isPizza ? [] : [optionSectionHtml('addons','إضافات البيتزا',5,config.addons,true)]),
    optionSectionHtml('removals','إزالة مكونات',8,config.removals,false)
  ].join('');
  productSelection.modifiers = emptyModifiers();
}
function openProduct(name, trigger){
  const item = findProduct(name);
  if(!item) return;
  productReturnFocus = trigger || productReturnFocus;
  const singleVariant = item.variants.length === 1;
  productSelection = {item,index:singleVariant ? 0 : -1,modifiers:emptyModifiers()};
  productQuantity = 1;
  document.getElementById('productTitle').textContent = item.name;
  document.getElementById('productPhoto').innerHTML = productImage(item,'detail-photo');
  const img = document.querySelector('#productPhoto > img');
  if(img) img.loading = 'eager';
  document.getElementById('productSizes').hidden = singleVariant;
  document.getElementById('productVariants').innerHTML = item.variants.map((variant,i) => `<button type="button" data-variant="${i}" aria-pressed="${i === productSelection.index}"><span>${escapeHtml(variant.size)}</span><strong>${money(variant.price)}${sarIcon()}</strong></button>`).join('');
  renderProductOptions(item);
  const noteInput = document.getElementById('productNote');
  const noteLabel = document.querySelector('label[for="productNote"]');
  const hideItemNote = !['الشاورما','السندوتشات'].includes(categoryForProduct(item.name));
  if(noteLabel) noteLabel.hidden = hideItemNote;
  noteInput.hidden = hideItemNote;
  noteInput.disabled = hideItemNote;
  noteInput.value = '';
  updateProductPrice();
  if(!productDialog.open){
    productDialog.style.height = '';
    productDialog.showModal();
  }
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
  document.querySelector('.product-scroll').scrollTop = 0;
  document.getElementById('closeProduct').focus({preventScroll:true});
}
function selectedModifierState(){
  const state = emptyModifiers();
  document.querySelectorAll('#productOptions input[data-modifier-type]:checked').forEach(input => {
    const type = input.dataset.modifierType;
    if(type === 'addons') state.addons.push({name:input.dataset.modifierName,price:Number(input.dataset.modifierPrice || 0)});
    if(type === 'removals') state.removals.push(input.dataset.modifierName);
  });
  return state;
}
function updateProductPrice(){
  if(!productSelection) return;
  const variant = productSelection.index >= 0 ? productSelection.item.variants[productSelection.index] : null;
  const photo = document.getElementById('productPhoto');
  const photoSource = productImageSource(productSelection.item,variant?.size);
  if((photo.querySelector('img:not(.product-placeholder img)')?.getAttribute('src') || '') !== photoSource){
    photo.innerHTML = productImage(productSelection.item,'detail-photo',variant?.size);
    const image = photo.querySelector('img');
    if(image) image.loading = 'eager';
  }
  productSelection.modifiers = selectedModifierState();
  const selected = Boolean(variant);
  const productAdd = document.getElementById('productAdd');
  productAdd.querySelector('span').textContent = selected ? 'إضافة إلى السلة' : 'اختر الحجم أولًا';
  document.getElementById('productQty').textContent = productQuantity;
  document.getElementById('productMinus').disabled = productQuantity <= 1;
  document.getElementById('productPlus').disabled = productQuantity >= 99;
  productAdd.disabled = !selected;
  document.getElementById('productPrice').innerHTML = selected ? `${money((variant.price + modifierUnitTotal(productSelection.modifiers)) * productQuantity)}${sarIcon()}` : '—';
  document.querySelectorAll('#productVariants [data-variant]').forEach(button => button.setAttribute('aria-pressed',String(Number(button.dataset.variant) === productSelection.index)));
}
function closeProduct(){productDialog.close();}
productDialog.addEventListener('close',()=>{
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  productReturnFocus?.focus({preventScroll:true});
});
productDialog.addEventListener('click',event=>{if(event.target === productDialog) closeProduct();});
document.getElementById('closeProduct').addEventListener('click',closeProduct);
document.getElementById('productVariants').addEventListener('click',event=>{
  const button=event.target.closest('[data-variant]');
  if(!button)return;
  productSelection.index=Number(button.dataset.variant);
  updateProductPrice();
});
const productOptions = document.getElementById('productOptions');
function handleModifierChange(input){
  if(!input) return;
  const type = input.dataset.modifierType;
  const limit = type === 'addons' ? 5 : 8;
  const checked = document.querySelectorAll(`#productOptions input[data-modifier-type="${type}"]:checked`);
  if(checked.length > limit){
    input.checked = false;
    showToast(`يمكن اختيار ${limit} خيارات كحد أقصى`);
    return;
  }
  productSelection.modifiers = selectedModifierState();
  updateProductPrice();
}
productOptions.addEventListener('change',event=>handleModifierChange(event.target.closest('input[data-modifier-type]')));
productOptions.addEventListener('click',event=>{
  const toggle = event.target.closest('[data-modifier-toggle]');
  if(toggle){
    const type = toggle.dataset.modifierToggle;
    const body = document.querySelector(`[data-modifier-body="${type}"]`);
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded',String(!expanded));
    toggle.classList.toggle('expanded',!expanded);
    body.hidden = expanded;
    return;
  }
});
document.getElementById('productMinus').addEventListener('click',()=>{productQuantity=Math.max(1,productQuantity-1);updateProductPrice();});
document.getElementById('productPlus').addEventListener('click',()=>{productQuantity=Math.min(99,productQuantity+1);updateProductPrice();});
document.getElementById('productAdd').addEventListener('click',()=>{
  if(!productSelection || productSelection.index < 0){ showToast('اختر الحجم أولًا'); return; }
  const {item,index}=productSelection;
  const variant=item.variants[index];
  const modifiers = selectedModifierState();
  const noteInput = document.getElementById('productNote');
  const note = noteInput.disabled ? '' : noteInput.value.trim();
  addToCart(item.name,variant.size,variant.price + modifierUnitTotal(modifiers),productQuantity,note,modifiers,variant.price);
  closeProduct();
});
function modifierSummaryText(modifiers){
  const normalized = normalizeModifiers(modifiers);
  const parts=[];
  if(normalized.addons.length) parts.push(`إضافات: ${normalized.addons.map(option=>option.name).join('، ')}`);
  if(normalized.removals.length) parts.push(`إزالة: ${normalized.removals.join('، ')}`);
  return parts.join(' | ');
}
/* Sheet gestures: scrolling stays native; only deliberate horizontal or edge drags take over. */
(()=>{
  const scroller = productDialog.querySelector('.product-scroll');
  const handle = document.getElementById('closeProduct');
  let gesture = null, suppressClickUntil = 0;
  function adjacentProduct(direction){
    const names = [...document.querySelectorAll('#menuArea .product-open[data-product]')].map(b=>b.dataset.product);
    const index = names.indexOf(productSelection?.item.name);
    const name = names[index + direction];
    if(name) openProduct(name);
  }
  productDialog.addEventListener('touchstart',event=>{
    if(event.touches.length !== 1 || event.target.closest('input,textarea,select,.product-footer,.product-variants,.product-options')) return;
    const t=event.touches[0];
    gesture={x:t.clientX,y:t.clientY,dx:0,dy:0,axis:null,top:scroller.scrollTop<=0,handle:handle.contains(event.target),height:productDialog.getBoundingClientRect().height};
  },{passive:true});
  productDialog.addEventListener('touchmove',event=>{
    if(!gesture || event.touches.length!==1){gesture=null;return;}
    const t=event.touches[0], g=gesture;
    g.dx=t.clientX-g.x; g.dy=t.clientY-g.y;
    if(!g.axis && Math.max(Math.abs(g.dx),Math.abs(g.dy))>10){
      if(Math.abs(g.dx)>Math.abs(g.dy)*1.3) g.axis='x';
      else if(g.handle || (g.top && g.dy>0)) g.axis='y';
      else g.axis='scroll';
    }
    if(g.axis==='x' || g.axis==='y'){
      event.preventDefault();
      if(g.axis==='y'){
        if(g.dy>=0) productDialog.style.transform=`translateY(${g.dy}px)`;
        else productDialog.style.height=`${Math.min(innerHeight*.96,g.height-g.dy)}px`;
      }
    }
  },{passive:false});
  function finish(cancelled){
    const g=gesture; gesture=null;
    productDialog.style.transform='';
    if(!g || !['x','y'].includes(g.axis)) return;
    suppressClickUntil=Date.now()+400;
    if(cancelled){productDialog.style.height=`${g.height}px`;return;}
    if(g.axis==='x' && Math.abs(g.dx)>55) adjacentProduct(g.dx>0 ? 1 : -1);
    if(g.axis==='y'){
      if(g.dy>120) closeProduct();
      else if(g.dy>45) productDialog.style.height='84dvh';
      else if(g.dy< -35) productDialog.style.height='96dvh';
    }
  }
  productDialog.addEventListener('touchend',()=>finish(false));
  productDialog.addEventListener('touchcancel',()=>finish(true));
  productDialog.addEventListener('click',event=>{
    if(Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  productDialog.addEventListener('keydown',event=>{
    if(event.target.matches('input,textarea,select')) return;
    if(event.key==='ArrowLeft' || event.key==='ArrowRight'){
      event.preventDefault(); adjacentProduct(event.key==='ArrowRight'?1:-1);
    }
  });
  productDialog.addEventListener('close',()=>{gesture=null;productDialog.style.transform='';productDialog.style.height='';});
})();

/* Disable pinch/double-tap magnification while keeping page scrolling. */
for(const type of ['gesturestart','gesturechange']) document.addEventListener(type,e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
