const WHATSAPP_NUMBER = "966536261408";
const CART_KEY = "alameed_cart_v2";
const PLATE_DEPOSIT = 12;
const LAMMA_ITEM_NAME = "صحن اللمة";
const OFFER_ITEM_PREFIX = "عرض العميد";
const POPULAR_THRESHOLD = 25;
const RESTAURANT_TIME_ZONE = "Asia/Riyadh";
const RESTAURANT_COORDINATES = Object.freeze({latitude:17.33848,longitude:43.13289});
const NORMAL_PRAYER_NOTICE_MINUTES = 30;
const FRIDAY_PRAYER_NOTICE_MINUTES = 45;
const BANK_IBAN = "SA1580000417608010132485";
const BANK_IBAN_WITHOUT_COUNTRY_CODE = "1580000417608010132485";
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
const locationInput = document.getElementById("locationInput");
const locationWrap = document.getElementById("locationWrap");
const placeNameInput = document.getElementById("placeNameInput");
const notesInput = document.getElementById("notesInput");
const bankTransferPanel = document.getElementById("bankTransferPanel");
const copyIbanBtn = document.getElementById("copyIbanBtn");
const openAlRajhiBtn = document.getElementById("openAlRajhiBtn");
const sendOrderBtn = document.getElementById("sendOrderBtn");
const toast = document.getElementById("toast");
const SEND_DELAY_MS = 30000;
try{
  localStorage.removeItem("alameed_phone");
  localStorage.removeItem("alameed_phone_gate_v1");
}catch{}
let customerLocation = {
  link: "",
  latitude: null,
  longitude: null,
  address: "",
  accuracy: null
};
let lastSend = 0;
const locationStatus = document.getElementById("locationStatus");
const locationStatusIcon = document.getElementById("locationStatusIcon");
const locationStatusText = document.getElementById("locationStatusText");
const retryLocationBtn = document.getElementById("retryLocationBtn");
const brandSplash = document.getElementById("brandSplash");
const offersBadge = document.getElementById("offersBadge");
const OFFERS_BADGE_DURATION_MS = 15000;
let offersBadgeExpired = false;
let offersBadgeTimer = 0;
const shareBtn = document.getElementById("shareBtn");
const refreshBtn = document.getElementById("refreshBtn");
const storeStatusBtn = document.getElementById("storeStatusBtn");
const storeStatusIcon = document.getElementById("storeStatusIcon");
const storeStatusTitle = document.getElementById("storeStatusTitle");
const storeStatusNote = document.getElementById("storeStatusNote");
const storeHoursPanel = document.getElementById("storeHoursPanel");
const LOCATION_TARGET_ACCURACY_METERS = 25;
const LOCATION_MAX_WAIT_MS = 18000;
let locationWatchId = null;
let locationWaitTimer = 0;
let bestLocationPosition = null;
let locationRequestSerial = 0;

function syncOffersBadgeVisibility(){
  if(!offersBadge) return;
  offersBadge.hidden = offersBadgeExpired || activeCategory === "العروض";
}

function startOffersBadgeWindow(){
  if(!offersBadge || offersBadgeTimer) return;
  offersBadgeExpired = false;
  offersBadge.classList.remove("is-hiding");
  syncOffersBadgeVisibility();
  offersBadgeTimer = window.setTimeout(() => {
    offersBadgeExpired = true;
    offersBadge.classList.add("is-hiding");
    window.setTimeout(() => {
      offersBadge.hidden = true;
      offersBadge.classList.remove("is-hiding");
    }, 320);
  }, OFFERS_BADGE_DURATION_MS);
}

const restaurantPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: RESTAURANT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});
const restaurantClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: RESTAURANT_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

function restaurantDateParts(date = new Date()){
  const values = {};
  restaurantPartsFormatter.formatToParts(date).forEach(part => {
    if(part.type !== "literal") values[part.type] = part.value;
  });
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const hour = Number(values.hour === "24" ? "0" : values.hour);
  const minute = Number(values.minute);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second:Number(values.second),
    minuteOfDay:(hour * 60) + minute,
    weekday:new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  };
}

function formatRestaurantTime(date){
  const values = {};
  restaurantClockFormatter.formatToParts(date).forEach(part => {
    if(part.type !== "literal") values[part.type] = part.value;
  });
  const period = values.dayPeriod === "AM" ? "ص" : "م";
  return `${values.hour}:${values.minute} ${period}`;
}

function isRamadanAtRestaurant(date){
  try{
    const formatter = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
      timeZone: RESTAURANT_TIME_ZONE,
      month: "numeric"
    });
    const month = formatter.formatToParts(date).find(part => part.type === "month")?.value;
    return Number(month) === 9;
  }catch{
    return false;
  }
}

function prayerScheduleFor(date = new Date()){
  if(!window.adhan?.PrayerTimes) return [];
  try{
    const parts = restaurantDateParts(date);
    const coordinates = new window.adhan.Coordinates(
      RESTAURANT_COORDINATES.latitude,
      RESTAURANT_COORDINATES.longitude
    );
    const params = window.adhan.CalculationMethod.UmmAlQura();
    if(window.adhan.Madhab?.Shafi) params.madhab = window.adhan.Madhab.Shafi;
    if(isRamadanAtRestaurant(date)){
      params.adjustments.isha = Number(params.adjustments.isha || 0) + 30;
    }
    const calculationDate = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
    const times = new window.adhan.PrayerTimes(coordinates, calculationDate, params);
    const isFriday = parts.weekday === 5;
    return [
      {key:"fajr",name:"الفجر",start:times.fajr,duration:NORMAL_PRAYER_NOTICE_MINUTES},
      {key:"dhuhr",name:isFriday ? "صلاة الجمعة" : "الظهر",start:times.dhuhr,duration:isFriday ? FRIDAY_PRAYER_NOTICE_MINUTES : NORMAL_PRAYER_NOTICE_MINUTES},
      {key:"asr",name:"العصر",start:times.asr,duration:NORMAL_PRAYER_NOTICE_MINUTES},
      {key:"maghrib",name:"المغرب",start:times.maghrib,duration:NORMAL_PRAYER_NOTICE_MINUTES},
      {key:"isha",name:"العشاء",start:times.isha,duration:NORMAL_PRAYER_NOTICE_MINUTES}
    ].map(prayer => ({
      ...prayer,
      end:new Date(prayer.start.getTime() + (prayer.duration * 60000))
    }));
  }catch{
    return [];
  }
}

function businessStatusFor(date, prayers){
  const parts = restaurantDateParts(date);
  const minute = parts.minuteOfDay;
  const isFriday = parts.weekday === 5;

  if(minute < 30){
    return {type:"open",title:"مفتوح الآن",note:"يستقبل الطلبات حتى 12:30 ص",isOpen:true};
  }

  if(isFriday){
    const fridayPrayer = prayers.find(prayer => prayer.key === "dhuhr");
    const fridayOpening = fridayPrayer?.end || null;
    const fridayOpeningMinute = fridayOpening
      ? restaurantDateParts(fridayOpening).minuteOfDay
      : 13 * 60;
    const fridayOpeningText = fridayOpening
      ? formatRestaurantTime(fridayOpening)
      : "بعد صلاة الجمعة";

    if(minute >= fridayOpeningMinute && minute < 15 * 60){
      return {type:"open",title:"مفتوح الآن",note:"يستقبل الطلبات حتى 3:00 م",isOpen:true};
    }
    if(minute >= 15 * 60 && minute < 16 * 60){
      return {type:"break",title:"استراحة",note:"يبدأ التجهيز مرة أخرى 4:00 م",isOpen:false};
    }
    if(minute >= 16 * 60){
      return {type:"open",title:"مفتوح الآن",note:"يستقبل الطلبات حتى 12:30 ص",isOpen:true};
    }
    return {
      type:"closed",
      title:"مغلق الآن",
      note:`يبدأ التجهيز بعد صلاة الجمعة ${fridayOpeningText}`,
      isOpen:false
    };
  }

  if(minute >= 11 * 60 && minute < 15 * 60){
    return {type:"open",title:"مفتوح الآن",note:"يستقبل الطلبات حتى 3:00 م",isOpen:true};
  }
  if(minute >= 15 * 60 && minute < 16 * 60){
    return {type:"break",title:"استراحة",note:"يبدأ التجهيز مرة أخرى 4:00 م",isOpen:false};
  }
  if(minute >= 16 * 60){
    return {type:"open",title:"مفتوح الآن",note:"يستقبل الطلبات حتى 12:30 ص",isOpen:true};
  }
  return {type:"closed",title:"مغلق الآن",note:"يبدأ التجهيز عند الفتح 11:00 ص",isOpen:false};
}

function getRestaurantStatus(date = new Date()){
  const prayers = prayerScheduleFor(date);
  const business = businessStatusFor(date, prayers);
  const activePrayer = prayers.find(prayer => date >= prayer.start && date < prayer.end);
  if(!activePrayer) return {...business,icon:business.type === "open" ? "●" : business.type === "break" ? "◐" : "○"};

  const isFridayPrayer = activePrayer.key === "dhuhr" && restaurantDateParts(date).weekday === 5;
  return {
    type:"prayer",
    title:isFridayPrayer ? "وقت صلاة الجمعة الآن" : "وقت الصلاة الآن",
    note:"يمكنك إرسال الطلب الآن، ويبدأ التجهيز بعد الصلاة",
    icon:"🕌",
    isOpen:false,
    prayer:activePrayer.key
  };
}

function updateStoreStatus(date = new Date()){
  if(!storeStatusBtn || !storeStatusTitle || !storeStatusNote || !storeStatusIcon) return;
  const status = getRestaurantStatus(date);
  storeStatusBtn.classList.remove("is-loading","is-open","is-prayer","is-break","is-closed");
  storeStatusBtn.classList.add(`is-${status.type}`);
  storeStatusBtn.dataset.state = status.type;
  storeStatusIcon.textContent = status.icon;
  storeStatusTitle.textContent = status.title;
  storeStatusNote.textContent = status.note;
  storeStatusBtn.setAttribute("aria-label", `${status.title}. ${status.note}. اضغط لعرض أوقات الدوام`);
}

storeStatusBtn?.addEventListener("click", () => {
  const expanded = storeStatusBtn.getAttribute("aria-expanded") === "true";
  storeStatusBtn.setAttribute("aria-expanded", String(!expanded));
  if(storeHoursPanel) storeHoursPanel.hidden = expanded;
});
updateStoreStatus();
window.setInterval(updateStoreStatus, 30000);
document.addEventListener("visibilitychange", () => {
  if(!document.hidden){
    updateStoreStatus();
  }
});

if(brandSplash){
  let splashFinished = false;
  const removeBrandSplash = () => {
    if(splashFinished) return;
    splashFinished = true;
    if(brandSplash.isConnected) brandSplash.remove();
    startOffersBadgeWindow();
  };
  ["contextmenu","dragstart","selectstart","auxclick"].forEach(eventName => {
    brandSplash.addEventListener(eventName, event => event.preventDefault(), {capture:true});
  });
  brandSplash.addEventListener("animationend", event => {
    if(event.animationName === "brandSplashOut") removeBrandSplash();
  });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(removeBrandSplash, reducedMotion ? 250 : 1850);
}else{
  startOffersBadgeWindow();
}
function setLocationStatus(type, text){
  locationStatus.className = `location-status ${type}`;
  locationStatusIcon.textContent = type === "success" ? "✅" : type === "error" ? "❌" : "⏳";
  locationStatusText.textContent = text;
  retryLocationBtn.hidden = type !== "error";
}
function stopLocationWatcher(){
  if(locationWatchId !== null && navigator.geolocation){
    navigator.geolocation.clearWatch(locationWatchId);
  }
  locationWatchId = null;
  window.clearTimeout(locationWaitTimer);
  locationWaitTimer = 0;
}
function locationAccuracy(position){
  const accuracy = Number(position?.coords?.accuracy);
  return Number.isFinite(accuracy) && accuracy > 0 ? accuracy : Infinity;
}
function locationAccuracyText(accuracy){
  return Number.isFinite(accuracy) ? ` بدقة ±${Math.max(1,Math.round(accuracy))} متر` : "";
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
async function finalizeLocation(serial){
  if(serial !== locationRequestSerial || !bestLocationPosition) return;
  const position = bestLocationPosition;
  bestLocationPosition = null;
  stopLocationWatcher();
  const {latitude, longitude} = position.coords;
  const accuracy = locationAccuracy(position);
  const link = `https://maps.google.com/?q=${latitude},${longitude}`;
  customerLocation = {link, latitude, longitude, address:"", accuracy};
  locationInput.value = link;
  setLocationStatus("success", `تم تحديد موقعك${locationAccuracyText(accuracy)}`);
  const address = await getLocationName(latitude, longitude);
  if(serial !== locationRequestSerial || !address) return;
  customerLocation.address = address;
  setLocationStatus("success", `${address}${locationAccuracyText(accuracy)}`);
}
function requestLocation(){
  const serial = ++locationRequestSerial;
  stopLocationWatcher();
  bestLocationPosition = null;
  customerLocation = {link:"",latitude:null,longitude:null,address:"",accuracy:null};
  locationInput.value = "";
  if(!navigator.geolocation){
    setLocationStatus("error", "جهازك لا يدعم تحديد الموقع");
    return;
  }
  setLocationStatus("loading", "جارٍ تحديد موقعك بأعلى دقة...");
  locationWatchId = navigator.geolocation.watchPosition(position => {
    if(serial !== locationRequestSerial) return;
    const accuracy = locationAccuracy(position);
    if(!bestLocationPosition || accuracy < locationAccuracy(bestLocationPosition)){
      bestLocationPosition = position;
      setLocationStatus("loading", `جارٍ تحسين دقة موقعك...${locationAccuracyText(accuracy)}`);
    }
    if(accuracy <= LOCATION_TARGET_ACCURACY_METERS) finalizeLocation(serial);
  }, error => {
    if(serial !== locationRequestSerial) return;
    if(bestLocationPosition){
      finalizeLocation(serial);
      return;
    }
    stopLocationWatcher();
    const message = error.code === 1
      ? "لم يتم السماح بالوصول للموقع"
      : "تعذر تحديد الموقع، حاول مرة أخرى";
    setLocationStatus("error", message);
  }, {
    enableHighAccuracy: true,
    timeout: LOCATION_MAX_WAIT_MS,
    maximumAge: 0
  });
  locationWaitTimer = window.setTimeout(() => {
    if(serial !== locationRequestSerial) return;
    if(bestLocationPosition) finalizeLocation(serial);
    else{
      stopLocationWatcher();
      setLocationStatus("error", "تعذر تحديد الموقع، حاول مرة أخرى");
    }
  }, LOCATION_MAX_WAIT_MS);
}
retryLocationBtn.addEventListener("click", requestLocation);
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
  return `<span class="${className}" role="img" aria-label="ريال سعودي"></span>`;
}
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[char]);
}
function isAlameedOffer(name){
  return String(name || "").startsWith(OFFER_ITEM_PREFIX);
}
function requiresPlateDeposit(name){
  return name === LAMMA_ITEM_NAME || isAlameedOffer(name);
}
function renderTabs(){
  categoryTabs.innerHTML = window.MENU_DATA.map(section => `
    <button type="button" class="tab-btn ${section.category === activeCategory ? "active" : ""}"
      data-category="${escapeHtml(section.category)}">
      ${escapeHtml(section.category)}
    </button>
  `).join("");
  syncOffersBadgeVisibility();
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
    <section class="${section.category === "العروض" ? "offers-section" : ""}">
      ${section.category === "العروض" ? `
        <div class="offer-photo" role="img" aria-label="صحن اللمة"></div>
      ` : ""}
      <div class="items-grid">
        ${section.items.map(item => {
          const offerItem = section.category === "العروض";
          const popular = Number(productOrderCounts[item.name] || 0) >= POPULAR_THRESHOLD;
          return `
          <article class="item-card ${popular ? "is-popular" : ""} ${offerItem ? "offer-item-card" : ""}">
            <div class="item-card-head">
              <div class="item-name">${escapeHtml(item.name)}</div>
              ${offerItem ? '<span class="offer-card-badge">عرض خاص</span>' : popular ? '<span class="popular-badge">🔥 الأكثر طلبًا</span>' : ''}
            </div>
            ${offerItem ? `
              <div class="offer-components" aria-label="محتويات صحن اللمة">
                <span>4 أسياخ كباب دجاج</span>
                <span>2 سيخ أوصال دجاج</span>
                <span>2 سيخ شيش دجاج</span>
                <span>نصف دجاج فحم</span>
                <span>نصف دجاج برست</span>
                <span>مقبلات</span>
                <span>رز</span>
              </div>
            ` : ""}
            <div class="variant-grid variant-grid-${Math.max(1,Math.min(item.variants.length,3))}">
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
        `}).join("")}
      </div>
    </section>
  `).join("");
}
menuArea.addEventListener("contextmenu", event => {
  if(event.target.closest(".offer-photo")) event.preventDefault();
});
function addToCart(name,size,price){
  const key = `${name}|${size}|${price}`;
  const found = cart.find(item => item.key === key);
  if(found) found.qty += 1;
  else cart.push({key,name,size,price:Number(price),qty:1});
  saveCart();
  updateCartUI();
  const depositMessage = requiresPlateDeposit(name) ? " + تأمين الصحن" : "";
  showToast(`تمت إضافة ${isAlameedOffer(name) ? "عرض العميد" : name}${depositMessage}`);
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
function plateDepositQty(){
  return cart
    .filter(item => requiresPlateDeposit(item.name))
    .reduce((sum,item) => sum + item.qty,0);
}
function totals(){
  const itemQty = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const productsTotal = cart.reduce((sum, item) => {
    return sum + (Number(item.price || 0) * Number(item.qty || 0));
  }, 0);
  const depositQty = plateDepositQty();
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
    const hasDeposit = requiresPlateDeposit(item.name);
    const depositLine = hasDeposit
      ? `<div class="deposit-note"><span>تأمين الصحن ×${money(item.qty)}</span><strong>${money(PLATE_DEPOSIT * Number(item.qty || 0))}${sarIcon("sar-symbol-small")}</strong></div>`
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
  if(shouldExpand){
    window.requestAnimationFrame(() => {
      const sheet = checkoutPanel.closest(".sheet");
      sheet?.scrollTo({top:sheet.scrollHeight,behavior:"smooth"});
    });
  }
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
function selectedPaymentMethod(){
  return document.querySelector('input[name="paymentMethod"]:checked')?.value || "عند الاستلام";
}
function syncPaymentMethod(){
  if(!bankTransferPanel) return;
  bankTransferPanel.hidden = selectedPaymentMethod() !== "تحويل بنكي";
}
async function writeBankIban(value = BANK_IBAN){
  let copied = false;
  try{
    await navigator.clipboard.writeText(value);
    copied = true;
  }catch{
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    copied = document.execCommand("copy");
    helper.remove();
  }
  return copied;
}
async function copyBankIban(){
  const copied = await writeBankIban();
  if(!copied) return showToast("تعذر النسخ، اضغط مطولاً على الآيبان");
  showToast("تم نسخ رقم الآيبان");
  if(copyIbanBtn){
    copyIbanBtn.textContent = "تم النسخ ✓";
    window.setTimeout(() => { copyIbanBtn.textContent = "نسخ"; }, 1600);
  }
}
function prepareAlRajhiAppOpen(){
  void writeBankIban(BANK_IBAN_WITHOUT_COUNTRY_CODE);
  showToast("جاري فتح صفحة إضافة المستفيد");
}
function menuCategoryForOrderItem(name){
  const sections = Array.isArray(window.MENU_DATA) ? window.MENU_DATA : [];
  return sections.find(section => section.items?.some(item => item.name === name))?.category || "";
}
function completeOrderItemName(value){
  const name = String(value || "").trim();
  const category = menuCategoryForOrderItem(name);
  if(category === "الشاورما"){
    if(name.startsWith("ساندويتش")){
      const details = name.slice("ساندويتش".length).trim();
      return details ? `ساندوتش شاورما ${details}` : "ساندوتش شاورما";
    }
    if(name.startsWith("عربي")) return `شاورما ${name}`;
    if(name.startsWith("صحن إسكندر")) return name.replace("صحن إسكندر", "صحن شاورما إسكندر");
  }
  if(category === "السندوتشات" && /^(كباب دجاج|شيش دجاج|مسحب دجاج|تورتيلا دجاج)/.test(name)){
    return `ساندويتش ${name}`;
  }
  return name;
}
function orderItemLabel(item){
  const name = completeOrderItemName(item?.name);
  const size = String(item?.size || "").trim();
  return size && size !== "السعر" ? `${name} ${size}` : name;
}
function orderQuantityLine(label, qty){
  return `*${money(qty)}ـ* ${label}`;
}
function openWhatsAppInCurrentPage(url){
  const link = document.createElement("a");
  link.href = url;
  link.target = "_self";
  link.rel = "noopener";
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
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
  const paymentMethod = selectedPaymentMethod();
  const notes = notesInput.value.trim();
  const placeName = placeNameInput.value.trim();
  if(orderType === "توصيل" && !customerLocation.link){
    alert("يرجى السماح بالوصول للموقع ثم إعادة المحاولة.");
    locationWrap.hidden = false;
    requestLocation();
    return;
  }
  if(orderType === "توصيل" && !placeName){
    alert("يرجى كتابة اسم المكان.");
    locationWrap.hidden = false;
    placeNameInput.focus();
    return;
  }
  const remaining = SEND_DELAY_MS - (Date.now() - lastSend);
  if(remaining > 0){
    alert(`انتظر ${Math.ceil(remaining / 1000)} ثانية قبل إرسال طلب جديد.`);
    return;
  }
  const confirmMessage = paymentMethod === "تحويل بنكي"
    ? "بعد فتح واتساب أرسل صورة إيصال التحويل. هل تريد المتابعة؟"
    : "هل تريد إرسال الطلب إلى واتساب المطعم؟";
  if(!confirm(confirmMessage)) return;
  lastSend = Date.now();
  const lines = ["          ```📦 طلب جديد```", ""];
  if(orderType === "توصيل"){
    lines.push(`             *🚚 توصيل: ${placeName}*`);
    lines.push(customerLocation.link);
  }else if(orderType === "محلي"){
    lines.push("              *# محلــي*");
  }else{
    lines.push("              *# استــلام*");
  }
  cart.forEach(item => {
    lines.push(orderQuantityLine(orderItemLabel(item), item.qty));
  });
  if(paymentMethod === "تحويل بنكي"){
    lines.push("", "*💳 طريقة الدفع: تحويل بنكي*", "*📎 سيتم إرسال إيصال التحويل في المحادثة*");
  }
  if(notes){
    lines.push("", "*📝 الملاحظات:*", notes);
  }
  registerOrderedProducts();
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
  closeCart();
  openWhatsAppInCurrentPage(url);
}
function selectCategory(category){
  if(!window.MENU_DATA.some(section => section.category === category)) return;
  activeCategory = category;
  searchTerm = "";
  searchInput.value = "";
  renderTabs();
  renderMenu();
  const stickyHeight = document.querySelector(".sticky-stack")?.offsetHeight || 0;
  const menuTop = document.getElementById("menuArea").getBoundingClientRect().top + window.scrollY;
  window.scrollTo({top: Math.max(0, menuTop - stickyHeight - 8), behavior:"smooth"});
}
categoryTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if(!button) return;
  selectCategory(button.dataset.category);
});
offersBadge?.addEventListener("click", () => selectCategory("العروض"));
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
    if(isDelivery) requestLocation();
    else{
      ++locationRequestSerial;
      stopLocationWatcher();
    }
  });
});
document.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
  input.addEventListener("change", syncPaymentMethod);
});
copyIbanBtn?.addEventListener("click", copyBankIban);
openAlRajhiBtn?.addEventListener("click", prepareAlRajhiAppOpen);
sendOrderBtn.addEventListener("click",sendOrder);
shareBtn?.addEventListener("click", async () => {
  try{
    if(navigator.share){
      await navigator.share({title:"مطعم فطائر العميد",url:location.href});
    }else{
      await navigator.clipboard.writeText(location.href);
      showToast("تم نسخ رابط المنيو");
    }
  }catch{}
});
refreshBtn?.addEventListener("click", () => location.reload());
syncPaymentMethod();
renderTabs();
renderMenu();
updateCartUI();
loadProductOrderCounts();
