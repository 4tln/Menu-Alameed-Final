const WHATSAPP_NUMBER = "966536261408";
const CART_KEY = "alameed_cart_v2";
const PLATE_DEPOSIT = 12;
const LAMMA_ITEM_NAME = "صحن اللمة";
const POPULAR_THRESHOLD = 25;
const productOrderCounts = {};
const ORDER_COUNTS_KEY = "alameed_product_order_counts_v1";
function loadProductOrderCounts(){
  try{
    const saved = JSON.parse(localStorage.getItem(ORDER_COUNTS_KEY) || "{}");
    if(saved && typeof saved === "object" && !Array.isArray(saved)){
      Object.assign(productOrderCounts, saved);
    }
  }catch{}
  if(typeof renderMenu === "function") renderMenu();
}
function registerOrderedProducts(){
  cart.forEach(item => {
    productOrderCounts[item.name] = Number(productOrderCounts[item.name] || 0) + Number(item.qty || 0);
  });
  try{
    localStorage.setItem(ORDER_COUNTS_KEY, JSON.stringify(productOrderCounts));
  }catch{}
}
let activeCategory = window.MENU_DATA[0]?.category || "";
let searchTerm = "";
let cart = loadCart();
const categoryTabs = document.getElementById("categoryTabs");
const menuArea = document.getElementById("menuArea");
const searchInput = document.getElementById("searchInput");
const headerSearchBtn = document.getElementById("headerSearchBtn");
const cartBar = document.getElementById("cartBar");
const cartModal = document.getElementById("cartModal");
const cartItems = document.getElementById("cartItems");
const cartItemsPanel = document.getElementById("cartItemsPanel");
const toggleCartItemsBtn = document.getElementById("toggleCartItemsBtn");
const cartPreviewCount = document.getElementById("cartPreviewCount");
const toggleCheckoutBtn = document.getElementById("toggleCheckoutBtn");
const checkoutPanel = document.getElementById("checkoutPanel");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const sheetTotal = document.getElementById("sheetTotal");
const sheetCount = document.getElementById("sheetCount");
const clearCartBtn = document.getElementById("clearCartBtn");
const phoneInput = document.getElementById("phoneInput");
const locationInput = document.getElementById("locationInput");
const locationWrap = document.getElementById("locationWrap");
const notesInput = document.getElementById("notesInput");
const sendOrderBtn = document.getElementById("sendOrderBtn");
const toast = document.getElementById("toast");
const PHONE_KEY = "alameed_phone";
const SEND_DELAY_MS = 30000;
let customerLocation = {
  link: "",
  latitude: null,
  longitude: null,
  address: ""
};
let lastSend = 0;
const locationStatus = document.getElementById("locationStatus");
const locationStatusIcon = document.getElementById("locationStatusIcon");
const locationStatusText = document.getElementById("locationStatusText");
const retryLocationBtn = document.getElementById("retryLocationBtn");
phoneInput.value = localStorage.getItem(PHONE_KEY) || "";
phoneInput.addEventListener("input", () => {
  const cleanPhone = phoneInput.value.replace(/\D/g, "").slice(0, 10);
  phoneInput.value = cleanPhone;
  localStorage.setItem(PHONE_KEY, cleanPhone);
});
function setLocationStatus(type, text){
  locationStatus.className = `location-status ${type}`;
  locationStatusIcon.textContent = type === "success" ? "✅" : type === "error" ? "❌" : "⏳";
  locationStatusText.textContent = text;
  retryLocationBtn.hidden = type !== "error";
}
async function getLocationName(latitude, longitude){
  try{
    const endpoint = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    endpoint.searchParams.set("latitude", latitude);
    endpoint.searchParams.set("longitude", longitude);
    endpoint.searchParams.set("localityLanguage", "ar");
    const response = await fetch(endpoint.toString());
    if(!response.ok) return "";
    const data = await response.json();
    const district = data.locality || data.localityInfo?.administrative?.[4]?.name || "";
    const city = data.city || data.principalSubdivision || "";
    return [...new Set([district, city].filter(Boolean))].join(" - ");
  }catch{
    return "";
  }
}
function requestLocation(){
  if(!navigator.geolocation){
    setLocationStatus("error", "جهازك لا يدعم تحديد الموقع");
    return;
  }
  setLocationStatus("loading", "حدد موقعك من خرائط الجوال وأرسله إذا طلبه المطعم");
  navigator.geolocation.getCurrentPosition(async position => {
    const {latitude, longitude} = position.coords;
    const link = `https://maps.google.com/?q=${latitude},${longitude}`;
    customerLocation = {link, latitude, longitude, address: ""};
    locationInput.value = link;
    setLocationStatus("success", "تم تحديد موقعك بنجاح");
    const address = await getLocationName(latitude, longitude);
    if(address){
      customerLocation.address = address;
      setLocationStatus("success", address);
    }
  }, error => {
    const message = error.code === 1
      ? "لم يتم السماح بالوصول للموقع"
      : "تعذر تحديد الموقع، حاول مرة أخرى";
    setLocationStatus("error", message);
  }, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 60000
  });
}
retryLocationBtn.addEventListener("click", requestLocation);
window.addEventListener("load", requestLocation);
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
  return Number(value).toLocaleString("en-US");
}
function sarIcon(extraClass = ""){
  const className = extraClass ? `sar-symbol ${extraClass}` : "sar-symbol";
  return `<img class="${className}" src="sar-symbol.png" alt="ريال سعودي">`;
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
      <div class="items-grid">
        ${section.items.map(item => `
          <article class="item-card ${Number(productOrderCounts[item.name] || 0) >= POPULAR_THRESHOLD ? "is-popular" : ""}">
            <div class="item-card-head">
              <div class="item-name">${escapeHtml(item.name)}</div>
              ${Number(productOrderCounts[item.name] || 0) >= POPULAR_THRESHOLD ? '<span class="popular-badge">🔥 الأكثر طلبًا</span>' : ''}
            </div>
            <div class="variant-grid">
              ${item.variants.map(variant => `
                <button type="button" class="variant-btn"
                  data-name="${escapeHtml(item.name)}"
                  data-size="${escapeHtml(variant.size)}"
                  data-price="${variant.price}">
                  <span>${escapeHtml(variant.size)}</span>
                  <span class="price"><span>${money(variant.price)}</span>${sarIcon()}</span>
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
  const itemQty = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const productsTotal = cart.reduce((sum, item) => {
    return sum + (Number(item.price || 0) * Number(item.qty || 0));
  }, 0);
  const depositQty = lammaQty();
  const depositTotal = depositQty * PLATE_DEPOSIT;
  return {
    itemQty,
    productsTotal,
    depositQty,
    depositTotal,
    total: productsTotal + depositTotal
  };
}
function updateCartUI(){
  const info = totals();
  cartCount.textContent = money(info.itemQty);
  cartTotal.textContent = money(info.total);
  sheetTotal.textContent = money(info.total);
  if(sheetCount) sheetCount.textContent = money(cart.length);
  if(cartPreviewCount) cartPreviewCount.textContent = money(cart.length);
  if(toggleCartItemsBtn){
    toggleCartItemsBtn.disabled = cart.length === 0;
    toggleCartItemsBtn.classList.toggle("is-empty", cart.length === 0);
  }
}
function renderCart(){
  const info = totals();
  if(!cart.length){
    cartItems.innerHTML = '<div class="empty-state cart-empty"><span aria-hidden="true">🛒</span><strong>السلة فارغة</strong><small>أضف الأصناف التي تريدها ثم راجع طلبك هنا.</small></div>';
    updateCartUI();
    return;
  }
  cartItems.innerHTML = cart.map(item => {
    const hasDeposit = item.name === LAMMA_ITEM_NAME;
    const depositLine = hasDeposit
      ? `<div class="deposit-note"><span>تأمين الصحن</span><strong>${money(PLATE_DEPOSIT)}${sarIcon("sar-symbol-small")}</strong></div>`
      : "";
    const lineTotal = (Number(item.price || 0) * Number(item.qty || 0))
      + (hasDeposit ? PLATE_DEPOSIT * Number(item.qty || 0) : 0);
    return `
      <article class="cart-item cart-row">
        <div class="cart-row-info">
          <div class="cart-row-heading">
            <h4>${escapeHtml(item.name)}</h4>
            <button class="remove-btn" type="button" data-remove="${escapeHtml(item.key)}" aria-label="حذف ${escapeHtml(item.name)}">حذف</button>
          </div>
          <div class="cart-row-meta">
            <span class="size-badge">${escapeHtml(item.size || "عادي")}</span>
            <span class="unit-price">سعر الوحدة: <strong>${money(item.price)}</strong>${sarIcon("sar-symbol-small")}</span>
          </div>
          ${depositLine}
        </div>
        <div class="cart-row-bottom">
          <div class="qty-controls" aria-label="تعديل الكمية">
            <button class="qty-btn" type="button" data-change="-1" data-key="${escapeHtml(item.key)}" aria-label="تقليل الكمية">−</button>
            <strong>${money(item.qty)}</strong>
            <button class="qty-btn" type="button" data-change="1" data-key="${escapeHtml(item.key)}" aria-label="زيادة الكمية">+</button>
          </div>
          <div class="cart-line-total">
            <span>إجمالي الصنف</span>
            <strong>${money(lineTotal)}${sarIcon("sar-symbol-small")}</strong>
          </div>
        </div>
      </article>
    `;
  }).join("");
  updateCartUI();
}

function setCartItemsExpanded(expanded){
  if(!cartItemsPanel || !toggleCartItemsBtn) return;
  const shouldExpand = Boolean(expanded) && cart.length > 0;
  cartItemsPanel.hidden = !shouldExpand;
  toggleCartItemsBtn.setAttribute("aria-expanded", String(shouldExpand));
  toggleCartItemsBtn.classList.toggle("expanded", shouldExpand);
  const label = toggleCartItemsBtn.querySelector(".cart-items-toggle-copy strong");
  if(label) label.textContent = shouldExpand ? "إخفاء الأصناف المضافة" : "عرض الأصناف المضافة";
}
function setCheckoutExpanded(expanded){
  if(!checkoutPanel || !toggleCheckoutBtn) return;
  const shouldExpand = Boolean(expanded);
  checkoutPanel.hidden = !shouldExpand;
  toggleCheckoutBtn.setAttribute("aria-expanded", String(shouldExpand));
  toggleCheckoutBtn.classList.toggle("expanded", shouldExpand);
  const label = toggleCheckoutBtn.querySelector(".checkout-toggle-copy strong");
  if(label) label.textContent = shouldExpand ? "إخفاء بيانات الطلب" : "إكمال الطلب";
}
function openCart(){
  renderCart();
  setCartItemsExpanded(false);
  setCheckoutExpanded(false);
  cartModal.classList.add("open");
  cartModal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
  document.body.style.overflow = "hidden";
}
function closeCart(){
  cartModal.classList.remove("open");
  cartModal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
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
function generateOrderNumber(){
  const datePart = new Date().toISOString().slice(5,10).replace("-", "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${datePart}${randomPart}`;
}
function formatOrderDate(){
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date());
}
function sendOrder(){
  if(!cart.length){
    alert("لا يمكن إرسال الطلب، السلة فارغة.");
    return;
  }
  const orderType = selectedOrderType();
  const phone = phoneInput.value.replace(/\D/g, "");
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
  if(orderType === "توصيل" && !customerLocation.link){
    alert("يرجى السماح بالوصول للموقع ثم إعادة المحاولة.");
    locationWrap.hidden = false;
    requestLocation();
    return;
  }
  const remaining = SEND_DELAY_MS - (Date.now() - lastSend);
  if(remaining > 0){
    alert(`انتظر ${Math.ceil(remaining / 1000)} ثانية قبل إرسال طلب جديد.`);
    return;
  }
  if(!confirm("هل تريد إرسال الطلب إلى واتساب المطعم؟")) return;
  lastSend = Date.now();
  const info = totals();
  const orderNumber = generateOrderNumber();
  const lines = [
    "📦 طلب جديد",
    "",
    `${orderType === "توصيل" ? "🚚" : "🏪"} ${orderType}`,
    `📞 ${phone}`
  ];
  if(orderType === "توصيل"){
    lines.push(`📍 ${customerLocation.address || customerLocation.link}`);
  }
  lines.push("");
  cart.forEach(item => {
    lines.push(`• ${item.name}${item.size ? " "+item.size : ""} ×${item.qty}`);
  });
  if(info.depositQty > 0){
    lines.push(`• تأمين الصحن ×${info.depositQty}`);
  }
  if(notes){
    lines.push("",`📝 ${notes}`);
  }
  registerOrderedProducts();
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url, "_blank", "noopener");
}
categoryTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if(!button) return;
  activeCategory = button.dataset.category;
  searchTerm = "";
  searchInput.value = "";
  renderTabs();
  renderMenu();
  const stickyHeight = document.querySelector(".sticky-tools")?.offsetHeight || 0;
  const menuTop = document.getElementById("menuArea").getBoundingClientRect().top + window.scrollY;
  window.scrollTo({top: Math.max(0, menuTop - stickyHeight - 8), behavior:"smooth"});
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
headerSearchBtn?.addEventListener("click",() => {
  searchInput.scrollIntoView({behavior:"smooth",block:"start"});
  window.setTimeout(() => searchInput.focus({preventScroll:true}),250);
});
cartBar.addEventListener("click",openCart);
toggleCartItemsBtn?.addEventListener("click",() => {
  const expanded = toggleCartItemsBtn.getAttribute("aria-expanded") === "true";
  setCheckoutExpanded(false);
  setCartItemsExpanded(!expanded);
});
toggleCheckoutBtn?.addEventListener("click",() => {
  const expanded = toggleCheckoutBtn.getAttribute("aria-expanded") === "true";
  setCartItemsExpanded(false);
  setCheckoutExpanded(!expanded);
});
document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click",closeCart));
clearCartBtn.addEventListener("click",() => {
  if(!cart.length) return;
  if(confirm("هل تريد إفراغ السلة؟")){
    cart = [];
    saveCart();
    renderCart();
    setCartItemsExpanded(false);
  }
});
document.querySelectorAll('input[name="orderType"]').forEach(input => {
  input.addEventListener("change", () => {
    const isDelivery = selectedOrderType() === "توصيل";
    locationWrap.hidden = !isDelivery;
    if(isDelivery && !customerLocation.link) requestLocation();
  });
});
sendOrderBtn.addEventListener("click",sendOrder);
document.getElementById("shareBtn")?.addEventListener("click",async () => {
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
loadProductOrderCounts();
