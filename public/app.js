/* =========================================================================
   0.1 DARK/LIGHT MODE LOGIC
   (Optimized: uses transitionend instead of chained setTimeout guesses,
   and a re-entrancy guard so rapid clicks can't stack animations.)
========================================================================= */
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const htmlEl = document.documentElement;
const overlay = document.getElementById('theme-overlay');

const currentHour = new Date().getHours();
const isNightTime = currentHour >= 18 || currentHour < 6;

let initialTheme = 'light';
if (localStorage.getItem('theme')) {
  initialTheme = localStorage.getItem('theme');
} else {
  initialTheme = isNightTime ? 'dark' : 'light';
}

if (initialTheme === 'dark') {
  htmlEl.classList.add('dark');
  themeIcon.textContent = 'light_mode';
} else {
  htmlEl.classList.remove('dark');
  themeIcon.textContent = 'dark_mode';
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function applyTheme(toDark) {
  if (toDark) {
    htmlEl.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    themeIcon.textContent = 'light_mode';
  } else {
    htmlEl.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    themeIcon.textContent = 'dark_mode';
  }
}

let themeTransitionInProgress = false;

themeToggleBtn.addEventListener('click', () => {
  if (themeTransitionInProgress) return; // guard against rapid double-clicks stacking animations

  if (prefersReducedMotion) {
    applyTheme(!htmlEl.classList.contains('dark'));
    return;
  }

  themeTransitionInProgress = true;
  overlay.style.transition = 'none';
  overlay.style.clipPath = 'circle(0% at 90% 90%)';

  requestAnimationFrame(() => {
    overlay.style.transition = 'clip-path 0.8s cubic-bezier(0.645, 0.045, 0.355, 1)';
    overlay.style.clipPath = 'circle(150% at 90% 90%)';
  });

  const onExpandEnd = (e) => {
    if (e.propertyName !== 'clip-path') return;
    overlay.removeEventListener('transitionend', onExpandEnd);

    if (htmlEl.classList.contains('dark')) {
      applyTheme(false);
    } else {
      applyTheme(true);
    }

    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity = '0';

    const onFadeEnd = (e2) => {
      if (e2.propertyName !== 'opacity') return;
      overlay.removeEventListener('transitionend', onFadeEnd);
      overlay.style.clipPath = 'circle(0% at 90% 90%)';
      overlay.style.opacity = '1';
      overlay.style.transition = 'none';
      themeTransitionInProgress = false;
    };
    overlay.addEventListener('transitionend', onFadeEnd);
  };
  overlay.addEventListener('transitionend', onExpandEnd);
});

/* =========================================================================
   0. WHATSAPP & FILTER LOGIC
========================================================================= */
const WA_NUMBER = "6285640485743";
let currentProductWA = "Kopi Robusta Getas (250g)";

function openWhatsApp(type, productName = '') {
  let message = "";
  if (type === 'general') {
    message = "Halo GetasMart, saya ingin bertanya mengenai produk dan layanan UMKM Desa Getas.";
  } else if (type === 'partnership') {
    message = "Halo BUMDes Mitra Mandiri, saya tertarik untuk mendiskusikan peluang kemitraan bisnis dengan UMKM Desa Getas.";
  } else if (type === 'order') {
    message = `Halo GetasMart, saya tertarik untuk memesan *${productName}*. Mohon info ketersediaan stok dan prosedur pembayarannya ya. Terima kasih!`;
  }
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodedMessage}`, '_blank', 'noopener,noreferrer');
}

function filterCatalog(category, btnElement) {
  const allBtns = document.querySelectorAll('.filter-btn');
  allBtns.forEach(btn => {
    btn.classList.remove('bg-primary', 'text-white', 'shadow-lg');
    btn.classList.add('glass-panel', 'text-on-surface-variant');
  });
  btnElement.classList.remove('glass-panel', 'text-on-surface-variant');
  btnElement.classList.add('bg-primary', 'text-white', 'shadow-lg');

  const items = document.querySelectorAll('.catalog-item');
  items.forEach(item => {
    if (category === 'all' || item.dataset.category === category) {
      item.style.display = 'flex';
      item.classList.remove('visible');
      setTimeout(() => { item.classList.add('visible'); }, 50);
    } else {
      item.style.display = 'none';
      item.classList.remove('visible');
    }
  });
}

/* =========================================================================
   0.5 DYNAMIC PRODUCT DATA — dimuat dari Firestore (collection "products")
   Satu sumber data untuk katalog & halaman detail (tidak ada lagi hardcode
   dobel di HTML + JS). CRUD produk dilakukan lewat /admin.html.
========================================================================= */
let PRODUCTS = {};

/* Optimized: string-based escaping instead of creating/discarding a DOM
   node for every field of every product on every render. */
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const ESCAPE_RE = /[&<>"']/g;
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(ESCAPE_RE, ch => ESCAPE_MAP[ch]);
}

function formatPrice(n) {
  const num = Number(n);
  return 'Rp ' + (isNaN(num) ? '0' : num.toLocaleString('id-ID'));
}

function largeCardHTML(id, p) {
  return `
    <div data-product-id="${esc(id)}" data-category="${esc(p.category)}" class="catalog-item cursor-pointer glass-card rounded-2xl md:rounded-3xl md:col-span-8 overflow-hidden group relative flex flex-col md:flex-row reveal">
      <div class="w-full md:w-[61.8%] relative aspect-golden md:aspect-auto md:h-full overflow-hidden skeleton-bg image-wrapper">
        <img class="lazy-image w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" data-src="${esc(p.imgMain)}" alt="${esc(p.name)}" loading="lazy"/>
      </div>
      <div class="w-full md:w-[38.2%] p-5 md:p-8 flex flex-col justify-center bg-white/20 dark:bg-black/20 flex-grow">
        <span class="inline-block bg-secondary-container/50 dark:bg-secondary-container/20 text-on-secondary-container dark:text-secondary-fixed font-semibold text-[10px] md:text-xs px-2 md:px-3 py-1 rounded-full w-fit mb-3 md:mb-4">${esc(p.badge)}</span>
        <h2 class="text-2xl md:text-3xl font-bold text-primary mb-2 md:mb-3">${esc(p.name)}</h2>
        <p class="text-sm md:text-base text-on-surface-variant mb-6 md:mb-8 desc-clamp">${esc(p.desc)}</p>
        <div class="flex items-center justify-between mt-auto pt-4 border-t md:border-none border-primary/5">
          <span class="text-xl md:text-2xl font-extrabold text-primary">${formatPrice(p.price)}</span>
          <button data-wa-order="${esc(id)}" aria-label="Pesan ${esc(p.name)} via WhatsApp" class="liquid-btn w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-on-secondary-fixed shadow-md"><span class="material-symbols-outlined text-[20px] md:text-[24px]" aria-hidden="true">shopping_cart</span></button>
        </div>
      </div>
    </div>`;
}

function normalCardHTML(id, p) {
  return `
    <div data-product-id="${esc(id)}" data-category="${esc(p.category)}" class="catalog-item cursor-pointer glass-card rounded-2xl md:rounded-3xl md:col-span-4 overflow-hidden group flex flex-col hover:shadow-lg transition-shadow reveal">
      <div class="w-full aspect-[4/3] relative overflow-hidden skeleton-bg image-wrapper">
        <img class="lazy-image w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" data-src="${esc(p.imgMain)}" alt="${esc(p.name)}" loading="lazy"/>
      </div>
      <div class="p-5 md:p-6 flex flex-col flex-grow bg-white/10 dark:bg-black/20">
        <h3 class="text-lg md:text-xl font-bold text-primary mb-1 md:mb-2">${esc(p.name)}</h3>
        <p class="text-on-surface-variant text-xs md:text-sm mb-4 md:mb-6 desc-clamp">${esc(p.desc)}</p>
        <div class="flex items-center justify-between mt-auto pt-3 border-t border-primary/5">
          <span class="text-base md:text-lg text-secondary dark:text-secondary-fixed font-bold">${formatPrice(p.price)} <span class="text-[10px] md:text-xs font-normal">${esc(p.unit)}</span></span>
          <button data-wa-order="${esc(id)}" aria-label="Pesan ${esc(p.name)} via WhatsApp" class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white flex items-center justify-center text-primary shadow-sm hover:scale-110 transition-transform"><span class="material-symbols-outlined text-[20px] md:text-[24px]" aria-hidden="true">add_shopping_cart</span></button>
        </div>
      </div>
    </div>`;
}

/* =========================================================================
   0.55 HOME "HASIL PANEN PILIHAN" — disinkronkan dengan data katalog
   Memakai data Firestore yang sama persis dengan katalog (tidak ada lagi
   produk/gambar yang di-hardcode di beranda). Kartu besar = produk
   unggulan pertama, dua kartu kecil = dua produk berikutnya. Di mobile,
   dua kartu kecil disusun berdampingan (grid 2 kolom, aspect-square) agar
   total tinggi gambar di beranda tidak berlebihan.
========================================================================= */
function homeLargeCardHTML(id, p) {
  return `
    <div data-product-id="${esc(id)}" class="cursor-pointer glass-card rounded-2xl md:rounded-3xl p-5 md:p-8 flex flex-col justify-end relative overflow-hidden group md:col-span-2 aspect-[4/3] sm:aspect-[1.618/1] md:aspect-auto reveal">
      <div class="absolute inset-0 skeleton-bg image-wrapper z-0">
        <img class="lazy-image w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" data-src="${esc(p.imgMain)}" alt="${esc(p.name)}" loading="lazy">
      </div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 transition-opacity group-hover:opacity-90"></div>
      <div class="relative z-20 transform transition-transform duration-500 group-hover:-translate-y-2 mt-auto">
        <span class="px-2 md:px-3 py-1 bg-white/20 text-white rounded-full text-[10px] md:text-xs font-semibold backdrop-blur-md mb-2 md:mb-3 inline-block">${esc(p.badge || 'Best Seller')}</span>
        <h3 class="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">${esc(p.name)}</h3>
        <p class="text-white/80 text-xs md:text-base w-[85%] md:w-3/4 desc-clamp">${esc(p.desc)}</p>
      </div>
    </div>`;
}

function homeSmallCardHTML(id, p) {
  return `
    <div data-product-id="${esc(id)}" class="cursor-pointer glass-card rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col justify-end relative overflow-hidden group aspect-square md:aspect-[4/3] reveal">
      <div class="absolute inset-0 skeleton-bg image-wrapper z-0">
        <img class="lazy-image w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" data-src="${esc(p.imgMain)}" alt="${esc(p.name)}" loading="lazy"/>
      </div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent z-10"></div>
      <div class="relative z-20 mt-auto">
        <h3 class="text-base md:text-xl font-bold text-white mb-0.5 md:mb-1">${esc(p.name)}</h3>
        <p class="text-white/80 text-[11px] md:text-sm desc-clamp">${esc(p.shortDesc || p.desc)}</p>
      </div>
    </div>`;
}

function renderHomeFeatured(list) {
  const container = document.getElementById('home-featured-grid');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '';
    return;
  }
  const [first, ...rest] = list;
  const smalls = rest.slice(0, 2);
  let html = homeLargeCardHTML(first.id, first.data);
  if (smalls.length) {
    html += `<div class="grid grid-cols-2 gap-3 md:flex md:flex-col md:gap-6 md:col-span-1">
      ${smalls.map(({ id, data }) => homeSmallCardHTML(id, data)).join('')}
    </div>`;
  }
  container.innerHTML = html;
}

document.getElementById('home-featured-wrap').addEventListener('click', (e) => {
  const card = e.target.closest('[data-product-id]');
  if (card) showProduct(card.dataset.productId);
});

function renderCatalog(list) {
  const container = document.getElementById('catalog-dynamic-items');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<p class="col-span-12 text-center text-on-surface-variant py-10">Belum ada produk. Tambahkan lewat <a href="/admin.html" class="underline font-semibold">admin panel</a>.</p>';
    return;
  }
  container.innerHTML = list.map(({ id, data }) =>
    data.size === 'large' ? largeCardHTML(id, data) : normalCardHTML(id, data)
  ).join('');
}

async function loadProducts() {
  const container = document.getElementById('catalog-dynamic-items');
  try {
    const snap = await window.db.collection('products').orderBy('order', 'asc').get();
    const list = [];
    PRODUCTS = {};
    snap.forEach(doc => {
      const data = doc.data();
      if (data.active === false) return;
      PRODUCTS[doc.id] = data;
      list.push({ id: doc.id, data });
    });
    renderCatalog(list);

    // Beranda memakai produk yang ditandai featured:true di Firestore;
    // jika belum ada yang ditandai, tampilkan 3 produk pertama (urutan "order").
    const featured = list.filter(item => item.data.featured === true);
    renderHomeFeatured(featured.length ? featured.slice(0, 3) : list.slice(0, 3));

    initLazyLoading(document.getElementById('page-catalog'));
    resetReveals(document.getElementById('page-catalog'));
    initLazyLoading(document.getElementById('page-home'));
    resetReveals(document.getElementById('page-home'));
  } catch (err) {
    console.error('[GetasMart] Gagal memuat produk dari Firestore:', err);
    if (container) {
      container.innerHTML = '<p class="col-span-12 text-center text-red-500 py-10">Gagal memuat produk. Cek koneksi internet atau konfigurasi Firebase di firebase-config.js.</p>';
    }
    const homeContainer = document.getElementById('home-featured-grid');
    if (homeContainer) {
      homeContainer.innerHTML = '<p class="md:col-span-3 text-center text-on-surface-variant py-6 text-sm">Belum bisa memuat produk pilihan.</p>';
    }
  }
}

document.getElementById('catalog-grid').addEventListener('click', (e) => {
  const waBtn = e.target.closest('[data-wa-order]');
  if (waBtn) {
    e.stopPropagation();
    const p = PRODUCTS[waBtn.dataset.waOrder];
    if (p) openWhatsApp('order', p.waMessage || p.name);
    return;
  }
  const card = e.target.closest('[data-product-id]');
  if (card) showProduct(card.dataset.productId);
});

loadProducts();

function showProduct(id) {
  const p = PRODUCTS[id];
  if (!p) return;

  document.getElementById('product-badge-category').textContent = p.categoryLabel || p.category;
  document.getElementById('product-badge-special').textContent = p.badge;
  document.getElementById('product-title').textContent = p.name;
  document.getElementById('product-price').textContent = formatPrice(p.price);
  document.getElementById('product-unit').textContent = p.unit;
  document.getElementById('product-desc').textContent = p.desc;
  document.getElementById('product-spec1-label').textContent = p.spec1Label;
  document.getElementById('product-spec1-value').textContent = p.spec1Value;
  document.getElementById('product-spec1-bar').style.width = p.spec1Pct;
  document.getElementById('product-spec2-label').textContent = p.spec2Label;
  document.getElementById('product-spec2-value').textContent = p.spec2Value;
  document.getElementById('product-spec2-bar').style.width = p.spec2Pct;
  currentProductWA = p.waMessage || p.name;

  const imgMain = document.getElementById('product-img-main');
  const img1 = document.getElementById('product-img-1');
  const img2 = document.getElementById('product-img-2');
  [ [imgMain, p.imgMain], [img1, p.img1], [img2, p.img2] ].forEach(([imgEl, src]) => {
    imgEl.classList.remove('loaded');
    imgEl.dataset.src = src;
    if (imgEl.parentElement && imgEl.parentElement.classList.contains('image-wrapper')) {
      imgEl.parentElement.classList.add('skeleton-bg');
    }
  });

  showPage('product');
  setTimeout(() => { initLazyLoading(document.getElementById('page-product')); }, 50);
}

/* =========================================================================
   0.6 FAQ ACCORDION LOGIC
========================================================================= */
function toggleFaq(btnElement) {
  const item = btnElement.closest('.faq-item');
  const wasOpen = item.classList.contains('faq-open');
  document.querySelectorAll('.faq-item.faq-open').forEach(el => {
    el.classList.remove('faq-open');
    const btn = el.querySelector('button');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
  if (!wasOpen) {
    item.classList.add('faq-open');
    btnElement.setAttribute('aria-expanded', 'true');
  }
}

/* =========================================================================
   1. SPLASH SCREEN LOGIC
========================================================================= */
window.addEventListener('load', () => {
  const splash = document.getElementById('splash-screen');
  setTimeout(() => {
    splash.classList.add('hidden-splash');
    showPage('home', true);
  }, 1200);
});

/* =========================================================================
   2. SPA NAVIGATION & ANTI-BUG LOGIC
========================================================================= */
let isTransitioning = false; 
const pageOrder = ['home', 'catalog', 'village', 'about', 'faq'];
let currentPageIndex = 0;
const PAGE_TITLES = {
  home: 'Beranda', catalog: 'Katalog', product: 'Detail Produk',
  village: 'Desa Kami', about: 'Tentang', faq: 'FAQ'
};
const pageAnnouncer = document.getElementById('page-announcer');

function showPage(name, isInitial = false) {
  if (isTransitioning && !isInitial) return;
  
  const targetPage = document.getElementById('page-' + name);
  if (!targetPage) return;

  if (targetPage.classList.contains('active') && !isInitial) return;

  currentPageIndex = pageOrder.indexOf(name) !== -1 ? pageOrder.indexOf(name) : 0;
  isTransitioning = true; 
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (pageAnnouncer && PAGE_TITLES[name]) {
    pageAnnouncer.textContent = 'Halaman ' + PAGE_TITLES[name];
  }

  document.querySelectorAll('.nav-link').forEach(a => { a.classList.remove('active-link'); a.removeAttribute('aria-current'); });
  document.querySelectorAll('.nav-link[data-page="' + name + '"]').forEach(a => { a.classList.add('active-link'); a.setAttribute('aria-current', 'page'); });
  document.querySelectorAll('.bnav-item').forEach(a => { a.classList.remove('active-item'); a.removeAttribute('aria-current'); });
  document.querySelectorAll('.bnav-item[data-page="' + name + '"]').forEach(a => { a.classList.add('active-item'); a.setAttribute('aria-current', 'page'); });

  let hasActive = false;
  const pages = document.querySelectorAll('.page');
  
  pages.forEach(p => {
    if (p.classList.contains('active') && p.id !== ('page-' + name)) {
      hasActive = true;
      p.classList.remove('show'); 
      
      setTimeout(() => {
        p.classList.remove('active'); 
        targetPage.classList.add('active'); 
        
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            targetPage.classList.add('show');
            initLazyLoading(targetPage);
            resetReveals(targetPage);
            setTimeout(() => { isTransitioning = false; }, 400);
          });
        });
      }, 400); 
    }
  });

  if (!hasActive) {
    targetPage.classList.add('active');
    requestAnimationFrame(() => {
      targetPage.classList.add('show');
      initLazyLoading(targetPage);
      resetReveals(targetPage);
      isTransitioning = false;
    });
  }
}

/* =========================================================================
   3. SWIPE GESTURE DETECTION (MOBILE)
========================================================================= */
let touchstartX = 0; let touchendX = 0;
let touchstartY = 0; let touchendY = 0;

function handleGesture() {
  const diffX = touchstartX - touchendX;
  const diffY = touchstartY - touchendY;

  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
    if (diffX > 0) {
      if (currentPageIndex < pageOrder.length - 1) showPage(pageOrder[currentPageIndex + 1]);
    } else {
      if (currentPageIndex > 0) showPage(pageOrder[currentPageIndex - 1]);
    }
  }
}

const appContainer = document.getElementById('app-container');
appContainer.addEventListener('touchstart', e => {
  touchstartX = e.changedTouches[0].screenX;
  touchstartY = e.changedTouches[0].screenY;
}, { passive: true });
  
appContainer.addEventListener('touchend', e => {
  touchendX = e.changedTouches[0].screenX;
  touchendY = e.changedTouches[0].screenY;
  handleGesture();
}, { passive: true });

/* =========================================================================
   4. SCROLL REVEAL (ANTI-BUG) & LAZY LOADING
   (Optimized: reveal check uses `offsetParent` instead of
   `getComputedStyle`, which avoids a synchronous style/layout
   recalculation per element. Image loading now waits for elements to
   actually enter the viewport instead of firing every request at once.)
========================================================================= */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.05, rootMargin: "0px 0px -20px 0px" }); 

function resetReveals(container) {
  const reveals = container.querySelectorAll('.reveal');
  
  reveals.forEach(el => {
    revealObserver.unobserve(el); 
    el.style.transition = 'none';
    el.classList.remove('visible');
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      reveals.forEach(el => {
        // offsetParent is null for display:none (and fixed-position) elements;
        // checking it is far cheaper than getComputedStyle, which forces a
        // full style recalculation for every element in the loop.
        if (el.offsetParent !== null) {
          el.style.transition = ''; 
          revealObserver.observe(el);
        }
      });
    });
  });
}

let lazyImageObserver = null;
function getLazyImageObserver() {
  if (lazyImageObserver) return lazyImageObserver;
  lazyImageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      loadLazyImage(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '200px 0px', threshold: 0.01 });
  return lazyImageObserver;
}

function loadLazyImage(img) {
  if (!img.dataset.src || img.classList.contains('loaded')) return;
  if (img.src !== img.dataset.src) img.src = img.dataset.src;
  img.onload = function () {
    img.classList.add('loaded');
    if (img.parentElement && img.parentElement.classList.contains('skeleton-bg')) {
      setTimeout(() => { img.parentElement.classList.remove('skeleton-bg'); }, 500);
    }
  };
  if (img.complete) img.onload();
}

function initLazyLoading(container = document) {
  const observer = getLazyImageObserver();
  const lazyImages = container.querySelectorAll('.lazy-image:not(.loaded)');
  lazyImages.forEach(img => observer.observe(img));
}

/* Navbar Effect on Scroll (rAF-throttled for smoother low-end performance) */
const mainNavEl = document.getElementById('main-nav');
let navScrollTicking = false;
window.addEventListener('scroll', () => {
  if (navScrollTicking) return;
  navScrollTicking = true;
  requestAnimationFrame(() => {
    mainNavEl.classList.toggle('scrolled', window.scrollY > 50);
    navScrollTicking = false;
  });
}, { passive: true });