
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
const mapStatus = document.getElementById("mapStatus");
const deliveryInfo = document.getElementById("deliveryInfo");
const distanceText = document.getElementById("distanceText");
const deliveryFeeText = document.getElementById("deliveryFeeText");

// موقع المطعم الثابت - الدائر، جازان
const RESTAURANT_LOCATION = {
  latitude: 17.3392252,
  longitude: 43.1311069,
  name: "فطائر العميد"
};
const DELIVERY_RATE_PER_KM = 3;
const DELIVERY_LIMIT_KM = 15;

// عدادات عامة تعمل على الموقع المنشور
const COUNTER_API_BASE = "https://api.counterapi.dev/v1";
const COUNTER_NAMESPACE = "fataer-alameed-menu-2026";
const POPULAR_THRESHOLD = 25;
const VISITOR_MARK_KEY = "alameed_visitor_counted_v1";
const VISITOR_CACHE_KEY = "alameed_visitor_last_value_v1";
const visitorCount = document.getElementById("visitorCount");
const productOrderCounts = Object.create(null);

function counterValue(data){
  const candidates = [data?.count, data?.value, data?.data?.count, data?.data?.value];
  const found = candidates.find(value => Number.isFinite(Number(value)));
  return found === undefined ? 0 : Number(found);
}

function counterNameForProduct(name){
  let hash = 2166136261;
  for(const char of name){
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `product-${(hash >>> 0).toString(36)}`;
}

async function counterRequest(name, action = "", attempt = 1){
  const safeName = encodeURIComponent(name);
  const suffix = action ? `/${action}` : "";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try{
    const response = await fetch(`${COUNTER_API_BASE}/${COUNTER_NAMESPACE}/${safeName}${suffix}`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });
    if(!response.ok) throw new Error("counter unavailable");
    const value = counterValue(await response.json());
    if(!Number.isFinite(value)) throw new Error("invalid counter value");
    return value;
  }catch(error){
    if(attempt < 3){
      await new Promise(resolve => setTimeout(resolve, 900 * attempt));
      return counterRequest(name, action, attempt + 1);
    }
    throw error;
  }finally{
    clearTimeout(timeoutId);
  }
}

async function initVisitorCounter(){
  if(!visitorCount) return;

  const cachedValue = Number(localStorage.getItem(VISITOR_CACHE_KEY));
  if(Number.isFinite(cachedValue) && cachedValue >= 0){
    visitorCount.textContent = money(cachedValue);
  }

  try{
    let value;
    if(!localStorage.getItem(VISITOR_MARK_KEY)){
      value = await counterRequest("visitors", "up");
      localStorage.setItem(VISITOR_MARK_KEY, "1");
    }else{
      value = await counterRequest("visitors");
    }

    localStorage.setItem(VISITOR_CACHE_KEY, String(value));
    visitorCount.textContent = money(value);
  }catch{
    // لا نمسح الرقم عند تعطل خدمة العداد أو حظرها في بعض المتصفحات.
    if(!(Number.isFinite(cachedValue) && cachedValue >= 0)){
      visitorCount.textContent = "غير متاح مؤقتًا";
    }
  }
}

function allProductNames(){
  return [...new Set(window.MENU_DATA.flatMap(section => section.items.map(item => item.name)))];
}

async function loadProductOrderCounts(){
  await Promise.allSettled(allProductNames().map(async name => {
    productOrderCounts[name] = await counterRequest(counterNameForProduct(name));
  }));
  renderMenu();
}

function registerOrderedProducts(){
  const orderedNames = [...new Set(cart.map(item => item.name))];
  orderedNames.forEach(name => {
    productOrderCounts[name] = (productOrderCounts[name] || 0) + 1;
    counterRequest(counterNameForProduct(name), "up").catch(() => {});
  });
  renderMenu();
}

let map;
let restaurantMarker;
let customerMarker;
let distanceLine;
let deliveryDistanceKm = null;
let deliveryFee = null;
let deliveryFeeByRestaurant = false;

function refreshMapSize(){
  if(!map) return;
  requestAnimationFrame(() => {
    map.invalidateSize({pan: false, animate: false});
    setTimeout(() => map && map.invalidateSize({pan: false, animate: false}), 250);
  });
}

function initMap(){
  if(map){
    refreshMapSize();
    return;
  }

  if(!window.L){
    if(mapStatus) mapStatus.textContent = "جارٍ تحميل الخريطة...";
    setTimeout(initMap, 500);
    return;
  }

  map = L.map("map", {
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true
  }).setView(
    [RESTAURANT_LOCATION.latitude, RESTAURANT_LOCATION.longitude],
    16
  );

  const tiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    crossOrigin: true,
    updateWhenIdle: false,
    keepBuffer: 4,
    attribution:'&copy; Esri World Imagery'
  });

  let tileErrors = 0;
  tiles.on("tileerror", event => {
    tileErrors += 1;
    const tile = event.tile;
    if(tile && tileErrors <= 12){
      const original = tile.src;
      setTimeout(() => {
        if(tile && !tile.complete) tile.src = original.split("?")[0] + `?retry=${Date.now()}`;
      }, 700);
    }
  });
  tiles.addTo(map);

  restaurantMarker = L.circleMarker([
    RESTAURANT_LOCATION.latitude,
    RESTAURANT_LOCATION.longitude
  ], {
    radius: 9,
    weight: 3,
    color: "#7a1f1f",
    fillColor: "#ffffff",
    fillOpacity: 1
  }).addTo(map).bindPopup("📍 موقع مطعم فطائر العميد").openPopup();

  refreshMapSize();
  if(mapStatus) mapStatus.textContent = "موقع المطعم ثابت على الخريطة";
}

function calculateDistanceKm(lat1, lon1, lat2, lon2){
  const earthRadiusKm = 6371;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
    * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function updateDeliveryCalculation(latitude, longitude){
  deliveryDistanceKm = calculateDistanceKm(
    RESTAURANT_LOCATION.latitude,
    RESTAURANT_LOCATION.longitude,
    latitude,
    longitude
  );

  deliveryFeeByRestaurant = deliveryDistanceKm > DELIVERY_LIMIT_KM;
  deliveryFee = deliveryFeeByRestaurant
    ? null
    : Math.ceil(deliveryDistanceKm * DELIVERY_RATE_PER_KM);

  deliveryInfo.hidden = false;
  distanceText.textContent = `${deliveryDistanceKm.toFixed(1)} كم`;
  deliveryFeeText.textContent = deliveryFeeByRestaurant
    ? "يحددها المطعم"
    : `${money(deliveryFee)} ريال`;
}

function showRestaurantOnMap(){
  initMap();
  if(!map) return;
  map.setView([RESTAURANT_LOCATION.latitude, RESTAURANT_LOCATION.longitude], 16);
  if(customerMarker){ map.removeLayer(customerMarker); customerMarker = null; }
  if(distanceLine){ map.removeLayer(distanceLine); distanceLine = null; }
  deliveryInfo.hidden = true;
  deliveryDistanceKm = null;
  deliveryFee = null;
  deliveryFeeByRestaurant = false;
  if(mapStatus) mapStatus.textContent = "موقع المطعم ثابت على الخريطة";
}

function showCustomerAndRestaurantOnMap(latitude, longitude){
  initMap();
  if(!map) return;

  if(customerMarker) map.removeLayer(customerMarker);
  if(distanceLine) map.removeLayer(distanceLine);

  customerMarker = L.circleMarker([latitude, longitude], {
    radius: 9,
    weight: 3,
    color: "#176b3a",
    fillColor: "#ffffff",
    fillOpacity: 1
  }).addTo(map).bindPopup("📍 موقع العميل");

  distanceLine = L.polyline([
    [RESTAURANT_LOCATION.latitude, RESTAURANT_LOCATION.longitude],
    [latitude, longitude]
  ], {dashArray: "8 8", weight: 4}).addTo(map);

  const bounds = L.latLngBounds([
    [RESTAURANT_LOCATION.latitude, RESTAURANT_LOCATION.longitude],
    [latitude, longitude]
  ]);
  map.fitBounds(bounds, {padding: [35, 35], maxZoom: 16});
  updateDeliveryCalculation(latitude, longitude);

  if(mapStatus) mapStatus.textContent = "تم تحديد موقعك وحساب المسافة ✅";
}

window.addEventListener("DOMContentLoaded", initMap);
window.addEventListener("load", refreshMapSize);
window.addEventListener("resize", refreshMapSize);
window.addEventListener("orientationchange", () => setTimeout(refreshMapSize, 350));
window.addEventListener("pageshow", refreshMapSize);

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

  setLocationStatus("loading", "جارٍ تحديد موقعك...");

  navigator.geolocation.getCurrentPosition(async position => {
    const {latitude, longitude} = position.coords;
    const link = `https://maps.google.com/?q=${latitude},${longitude}`;

    customerLocation = {link, latitude, longitude, address: ""};
    locationInput.value = link;
    setLocationStatus("success", "تم تحديد موقعك بنجاح");
    showCustomerAndRestaurantOnMap(latitude, longitude);

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
    showRestaurantOnMap();
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
    `📦 طلب جديد #${orderNumber}`,
    "",
    `🕒 ${formatOrderDate()}`,
    "",
    `${orderType === "توصيل" ? "🚚" : "🏪"} نوع الطلب: ${orderType}`,
    `📞 رقم الجوال: ${phone}`
  ];

  if(orderType === "توصيل"){
    lines.push("", "📍 موقع العميل:");
    if(customerLocation.address) lines.push(customerLocation.address);
    lines.push(customerLocation.link);
    lines.push(`📏 المسافة: ${deliveryDistanceKm.toFixed(1)} كم`);
    lines.push(deliveryFeeByRestaurant
      ? "🚚 رسوم التوصيل: يحددها المطعم"
      : `🚚 رسوم التوصيل: ${money(deliveryFee)} ريال`);
  }

  lines.push("", "🍽️ الطلبات:");
  cart.forEach(item => {
    lines.push(`• ${item.name} ${item.size} ×${item.qty}`);
  });

  if(info.depositQty > 0){
    lines.push(`• تأمين الصحن ×${info.depositQty}`);
  }

  lines.push("", `💰 إجمالي الطلب: ${money(info.total)} ريال`);
  if(orderType === "توصيل" && !deliveryFeeByRestaurant){
    lines.push(`💵 الإجمالي مع التوصيل: ${money(info.total + deliveryFee)} ريال`);
  }else if(orderType === "توصيل"){
    lines.push("💵 الإجمالي النهائي: يحدده المطعم بعد تحديد رسوم التوصيل");
  }
  lines.push("", "📝 الملاحظات:", notes || "لا توجد");

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
  input.addEventListener("change", () => {
    const isDelivery = selectedOrderType() === "توصيل";
    locationWrap.hidden = !isDelivery;
    if(isDelivery && !customerLocation.link) requestLocation();
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
initVisitorCounter();
loadProductOrderCounts();
