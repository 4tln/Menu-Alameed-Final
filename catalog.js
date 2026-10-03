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
  optionsTarget.hidden = !config;
  if(!config){ optionsTarget.innerHTML = ''; return; }
  optionsTarget.innerHTML = [
    optionSectionHtml('addons','إضافات البيتزا',5,config.addons,true),
    optionSectionHtml('removals','إزالة مكونات',8,config.removals,false)
  ].join('');
  productSelection.modifiers = emptyModifiers();
}
function openProduct(name, trigger){
  const item = findProduct(name);
  if(!item) return;
  productReturnFocus = trigger;
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
  const isPizza = categoryForProduct(item.name) === 'البيتزا';
  if(noteLabel) noteLabel.hidden = isPizza;
  noteInput.hidden = isPizza;
  noteInput.value = '';
  updateProductPrice();
  productDialog.showModal();
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
  const note = document.getElementById('productNote').value.trim();
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
function renderOrderSummary(){
  const target=document.getElementById('orderSummary');
  if(!target) return;
  target.hidden = cart.length === 0;
  if(!cart.length){target.innerHTML='';return;}
  const info=totals();
  target.innerHTML=`<h3>ملخص الطلب</h3>${cart.map(item=>`<div class="summary-line"><div><span><b>${money(item.qty)} ×</b> ${escapeHtml(item.name)}${item.size && item.size !== 'السعر' ? ` — ${escapeHtml(item.size)}` : ''}</span>${modifierSummaryHtml(item.modifiers)}${item.note && !item.note.includes('إضافات:') && !item.note.includes('إزالة:') ? `<small>${escapeHtml(item.note)}</small>` : ''}</div><strong>${money(item.price*item.qty)}${sarIcon()}</strong></div>`).join('')}
  ${info.depositTotal ? `<div class="summary-line"><span>تأمين الصحن</span><strong>${money(info.depositTotal)}${sarIcon()}</strong></div>` : ''}
  <div class="summary-total"><span>الإجمالي</span><strong>${money(info.total)}${sarIcon()}</strong></div>`;
}
