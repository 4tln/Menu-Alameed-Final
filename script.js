
const WHATSAPP_NUMBER = "966536261408";
const CART_KEY = "alameed_cart_v2";
const PLATE_DEPOSIT = 12;
const LAMMA_ITEM_NAME = "صحن اللمة";

let activeCategory = window.MENU_DATA[0]?.category || "";
let searchTerm = "";
let cart = loadCart();

const categoryTabs = document.getElementById("categoryTabs");
const menuArea = document.getElementById("menuArea");
const searchInput = document.getElementById("searchInput");
const cartBar = document.getElementById("cartBar");
const cartModal = document.getElementById("cartModal");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const sheetTotal = document.getElementById("sheetTotal");
const clearCartBtn = document.getElementById("clearCartBtn");
const phoneInput = document.getElementById("phoneInput");
const locationInput = document.getElementById("locationInput");
const locationWrap = document.getElementById("locationWrap");
const notesInput = document.getElementById("notesInput");
const sendOrderBtn = document.getElementById("sendOrderBtn");
const toast = document.getElementById("toast");

const PHONE_KEY="alameed_phone";
let autoLocationLink="";
phoneInput.value=localStorage.getItem(PHONE_KEY)||"";
phoneInput.addEventListener("input",()=>localStorage.setItem(PHONE_KEY,phoneInput.value));

function requestLocation(){
 if(!navigator.geolocation)return;
 showToast("جارٍ تحديد موقعك...");
 navigator.geolocation.getCurrentPosition(p=>{
   autoLocationLink=`https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}`;
   if(locationInput) locationInput.value=autoLocationLink;
   showToast("تم تحديد الموقع");
 },()=>showToast("تعذر تحديد الموقع"));
}
window.addEventListener("load",requestLocation);
let lastSend=0;


function loadCart(){
  try{
    const value = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(value) ? value : [];
  }catch{
    return [];
  }
}

function saveCart(){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function money(value){
  return Number(value).toLocaleString("ar-SA");
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[char]);
}

function renderTabs(){
  categoryTabs.innerHTML = window.MENU_DATA.map(section => `
    <button type="button" class="tab-btn ${section.category === activeCategory ? "active" : ""}"
      data-category="${escapeHtml(section.category)}">
      ${escapeHtml(section.category)}
    </button>
  `).join("");
}

function renderMenu(){
  const normalized = searchTerm.trim().toLowerCase();
  const sections = normalized
    ? window.MENU_DATA.map(section => ({
        ...section,
        items: section.items.filter(item => item.name.toLowerCase().includes(normalized))
      })).filter(section => section.items.length)
    : window.MENU_DATA.filter(section => section.category === activeCategory);

  if(!sections.length){
    menuArea.innerHTML = '<div class="empty-state">لم يتم العثور على صنف مطابق.</div>';
    return;
  }

  menuArea.innerHTML = sections.map(section => `
    <section>
      <h2 class="category-title">${escapeHtml(section.category)}</h2>
      <div class="items-grid">
        ${section.items.map(item => `
          <article class="item-card">
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="variant-grid">
              ${item.variants.map(variant => `
                <button type="button" class="variant-btn"
                  data-name="${escapeHtml(item.name)}"
                  data-size="${escapeHtml(variant.size)}"
                  data-price="${variant.price}">
                  <span>${escapeHtml(variant.size)}</span>
                  <span class="price">${money(variant.price)} ريال</span>
                </button>
              `).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function addToCart(name,size,price){
  const key = `${name}|${size}|${price}`;
  const found = cart.find(item => item.key === key);
  if(found) found.qty += 1;
  else cart.push({key,name,size,price:Number(price),qty:1});
  saveCart();
  updateCartUI();
  showToast(`تمت إضافة ${name} (${size})`);
}

function changeQty(key,delta){
  const item = cart.find(row => row.key === key);
  if(!item) return;
  item.qty += delta;
  if(item.qty <= 0) cart = cart.filter(row => row.key !== key);
  saveCart();
  updateCartUI();
  renderCart();
}

function removeItem(key){
  cart = cart.filter(row => row.key !== key);
  saveCart();
  updateCartUI();
  renderCart();
}

function lammaQty(){
  return cart
    .filter(item => item.name === LAMMA_ITEM_NAME)
    .reduce((sum,item) => sum + item.qty,0);
}

function totals(){
  const depositQty = lammaQty();
  return {
    count: cart.reduce((sum,item) => sum + item.qty,0),
    depositQty,
    depositTotal: depositQty * PLATE_DEPOSIT,
    total: cart.reduce((sum,item) => sum + item.qty * item.price,0) + (depositQty * PLATE_DEPOSIT)
  };
}

function updateCartUI(){
  const info = totals();
  cartCount.textContent = info.count;
  cartTotal.textContent = money(info.total);
  sheetTotal.textContent = money(info.total);
}

function renderCart(){
  if(!cart.length){
    cartItems.innerHTML = '<div class="empty-state">السلة فارغة</div>';
  }else{
    cartItems.innerHTML = cart.map(item => `
      <article class="cart-item">
        <div>
          <h4>${escapeHtml(item.name)}</h4>
          <small>${escapeHtml(item.size)} — ${money(item.price)} ريال للحبة</small>
          <div><button class="remove-btn" data-remove="${escapeHtml(item.key)}" type="button">حذف</button></div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-change="-1" data-key="${escapeHtml(item.key)}" type="button">−</button>
          <strong>${item.qty}</strong>
          <button class="qty-btn" data-change="1" data-key="${escapeHtml(item.key)}" type="button">+</button>
        </div>
      </article>
    `).join("");

    const depositQty = lammaQty();
    if(depositQty > 0){
      cartItems.insertAdjacentHTML("beforeend", `
        <article class="cart-item">
          <div>
            <h4>تأمين الصحن</h4>
            <small>مرتبط تلقائيًا بصحن اللمة — ${money(PLATE_DEPOSIT)} ريال للصحن</small>
          </div>
          <div class="qty-controls"></div>
        </article>
      `);
    }
  }
  updateCartUI();
}

function openCart(){
  renderCart();
  cartModal.classList.add("open");
  cartModal.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}

function closeCart(){
  cartModal.classList.remove("open");
  cartModal.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
}

function showToast(message){
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"),1700);
}

function selectedOrderType(){
  return document.querySelector('input[name="orderType"]:checked')?.value || "استلام";
}

function validatePhone(phone){
  return /^05\d{8}$/.test(phone);
}

function sendOrder(){
  if(!cart.length){
    alert("لا يمكن إرسال الطلب، السلة فارغة.");
    return;
  }

  const orderType = selectedOrderType();
  const phone = phoneInput.value.replace(/\s/g,"");
  const location = autoLocationLink || locationInput.value.trim();
  const notes = notesInput.value.trim();

  if(!phone){
    alert("يرجى إدخال رقم الجوال لإكمال الطلب.");
    phoneInput.focus();
    return;
  }

  if(!validatePhone(phone)){
    alert("الرجاء إدخال رقم جوال سعودي صحيح يبدأ بـ 05 ويتكون من 10 أرقام.");
    phoneInput.focus();
    return;
  }

  if(orderType==="توصيل" && !autoLocationLink){ alert("يرجى السماح بالوصول للموقع."); return; }

  if(orderType === "توصيل" && !location){
    alert("يرجى إدخال مكان التوصيل.");
    locationInput.focus();
    return;
  }

  if(Date.now()-lastSend<30000){alert("انتظر 30 ثانية قبل إرسال طلب جديد.");return;} lastSend=Date.now();
  if(!confirm("هل تريد إرسال الطلب إلى واتساب المطعم؟")) return;

  const info = totals();
  const lines = [
    "طلب جديد - فطائر العميد",
    "",
    `نوع الطلب: ${orderType}`,
    `رقم الجوال: ${phone}`
  ];

  if(orderType === "توصيل") lines.push(`المكان: ${location}`);

  lines.push("","الطلبات:");
  cart.forEach(item => {
    lines.push(`${item.qty} - ${item.name} ${item.size}`);
  });

  if(info.depositQty > 0){
    lines.push(`${info.depositQty} - تأمين الصحن (${money(PLATE_DEPOSIT)} ريال للصحن)`);
  }

  lines.push("",`الإجمالي: ${money(info.total)} ريال`,"","الملاحظات:",notes || "لا توجد");

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url,"_blank","noopener");
}

categoryTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if(!button) return;
  activeCategory = button.dataset.category;
  searchTerm = "";
  searchInput.value = "";
  renderTabs();
  renderMenu();
});

menuArea.addEventListener("click", event => {
  const button = event.target.closest(".variant-btn");
  if(!button) return;
  addToCart(button.dataset.name,button.dataset.size,button.dataset.price);
});

cartItems.addEventListener("click", event => {
  const qtyButton = event.target.closest("[data-change]");
  if(qtyButton){
    changeQty(qtyButton.dataset.key,Number(qtyButton.dataset.change));
    return;
  }
  const removeButton = event.target.closest("[data-remove]");
  if(removeButton) removeItem(removeButton.dataset.remove);
});

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value;
  renderMenu();
});

cartBar.addEventListener("click",openCart);
document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click",closeCart));

clearCartBtn.addEventListener("click",() => {
  if(!cart.length) return;
  if(confirm("هل تريد إفراغ السلة؟")){
    cart = [];
    saveCart();
    renderCart();
  }
});

document.querySelectorAll('input[name="orderType"]').forEach(input => {
  input.addEventListener("change",() => {
    locationWrap.hidden = selectedOrderType() !== "توصيل";
  });
});

sendOrderBtn.addEventListener("click",sendOrder);

document.getElementById("shareBtn").addEventListener("click",async () => {
  try{
    if(navigator.share){
      await navigator.share({title:"فطائر العميد",url:location.href});
    }else{
      await navigator.clipboard.writeText(location.href);
      showToast("تم نسخ رابط المنيو");
    }
  }catch{}
});

renderTabs();
renderMenu();
updateCartUI();
