/* Photo catalogue. MENU_DATA image/imageSize fields are the single photo source. */
let productSelection = null;
let productQuantity = 1;
let productReturnFocus = null;
const productDialog = document.getElementById('productDialog');
function openProduct(name, trigger){
  const item = findProduct(name);
  if(!item) return;
  productReturnFocus = trigger;
  const initial = Math.max(0,item.variants.findIndex(v => v.size === item.imageSize));
  productSelection = {item,index:initial};
  productQuantity = 1;
  document.getElementById('productTitle').textContent = item.name;
  document.getElementById('productPhoto').innerHTML = productImage(item,'detail-photo');
  const img = document.querySelector('#productPhoto > img');
  if(img) img.loading = 'eager';
  document.getElementById('productPhotoCaption').textContent = item.imageSize ? `الصورة للحجم: ${item.imageSize}` : '';
  document.getElementById('productSizes').hidden = item.variants.length === 1;
  document.getElementById('productVariants').innerHTML = item.variants.map((v,i) => `<button type="button" data-variant="${i}" aria-pressed="${i === initial}"><span>${escapeHtml(v.size)}</span><strong>${money(v.price)}${sarIcon()}</strong></button>`).join('');
  document.getElementById('productNote').value = '';
  updateProductPrice();
  productDialog.showModal();
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
  document.querySelector('.product-scroll').scrollTop = 0;
  document.getElementById('closeProduct').focus({preventScroll:true});
}
function updateProductPrice(){
  const variant = productSelection.item.variants[productSelection.index];
  document.getElementById('productQty').textContent = productQuantity;
  document.getElementById('productMinus').disabled = productQuantity <= 1;
  document.getElementById('productPlus').disabled = productQuantity >= 99;
  document.getElementById('productPrice').innerHTML = `${money(variant.price * productQuantity)}${sarIcon()}`;
  document.querySelectorAll('[data-variant]').forEach(button => button.setAttribute('aria-pressed',String(Number(button.dataset.variant) === productSelection.index)));
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
document.getElementById('productMinus').addEventListener('click',()=>{productQuantity=Math.max(1,productQuantity-1);updateProductPrice();});
document.getElementById('productPlus').addEventListener('click',()=>{productQuantity=Math.min(99,productQuantity+1);updateProductPrice();});
document.getElementById('productAdd').addEventListener('click',()=>{
  const {item,index}=productSelection;
  const variant=item.variants[index];
  addToCart(item.name,variant.size,variant.price,productQuantity,document.getElementById('productNote').value);
  closeProduct();
});
function renderOrderSummary(){
  const target=document.getElementById('orderSummary');
  if(!target) return;
  target.hidden = cart.length === 0;
  if(!cart.length){target.innerHTML='';return;}
  const info=totals();
  target.innerHTML=`<h3>ملخص الطلب</h3>${cart.map(item=>`<div class="summary-line"><div><span><b>${money(item.qty)} ×</b> ${escapeHtml(item.name)}${item.size && item.size !== 'السعر' ? ` — ${escapeHtml(item.size)}` : ''}</span>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}</div><strong>${money(item.price*item.qty)}${sarIcon()}</strong></div>`).join('')}
  ${info.depositTotal ? `<div class="summary-line"><span>تأمين الصحن</span><strong>${money(info.depositTotal)}${sarIcon()}</strong></div>` : ''}
  <div class="summary-total"><span>الإجمالي</span><strong>${money(info.total)}${sarIcon()}</strong></div>`;
}
