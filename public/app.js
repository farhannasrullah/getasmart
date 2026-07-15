/* =========================================================================
   0.1 DARK/LIGHT MODE LOGIC
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

themeToggleBtn.addEventListener('click', () => {
  if (prefersReducedMotion) {
    applyTheme(!htmlEl.classList.contains('dark'));
    return;
  }
  overlay.style.transition = 'none';
  overlay.style.clipPath = 'circle(0% at 90% 90%)';
  
  setTimeout(() => {
    overlay.style.transition = 'clip-path 0.8s cubic-bezier(0.645, 0.045, 0.355, 1)';
    overlay.style.clipPath = 'circle(150% at 90% 90%)';
    
    setTimeout(() => {
      if (htmlEl.classList.contains('dark')) {
        htmlEl.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        themeIcon.textContent = 'dark_mode';
      } else {
        htmlEl.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        themeIcon.textContent = 'light_mode';
      }
      
      setTimeout(() => {
        overlay.style.transition = 'opacity 0.4s ease';
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.style.clipPath = 'circle(0% at 90% 90%)';
          overlay.style.opacity = '1';
          overlay.style.transition = 'none';
        }, 400);
      }, 100);

    }, 400); 
  }, 50);
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
   0.5 DYNAMIC PRODUCT DETAIL LOGIC
========================================================================= */
const PRODUCTS = {
  kopi: {
    category: "Kopi Robusta",
    badge: "Best Seller",
    name: "Kopi Robusta Getas",
    price: "Rp 45.000",
    unit: "/ 250g",
    desc: "Ditanam di ketinggian ideal lereng gunung Desa Getas, kopi Robusta kami menawarkan profil rasa yang kuat dengan tingkat keasaman rendah. Diproses secara tradisional oleh petani lokal.",
    imgMain: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&q=80&w=1000",
    img1: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80&w=600",
    img2: "https://images.unsplash.com/photo-1611162458324-aae1eb4129a4?auto=format&fit=crop&q=80&w=600",
    spec1Label: "Roast Level", spec1Value: "Medium-Dark", spec1Pct: "75%",
    spec2Label: "Body", spec2Value: "Full", spec2Pct: "100%",
    wa: "Kopi Robusta Getas (250g)"
  },
  gula: {
    category: "Gula Aren",
    badge: "Best Seller",
    name: "Gula Aren Getas",
    price: "Rp 28.000",
    unit: "/ 500g",
    desc: "Gula aren cetak asli, dibuat dari nira aren pilihan yang dimasak dan dicetak secara tradisional oleh perajin lokal Desa Getas. Rasa karamel alami tanpa bahan pengawet, cocok untuk minuman tradisional, jamu, maupun masakan sehari-hari.",
    imgMain: "https://images.unsplash.com/photo-1775817590687-f1da5d70d9ad?auto=format&fit=crop&q=80&w=1000",
    img1: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&q=80&w=600",
    img2: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80&w=600",
    spec1Label: "Bentuk", spec1Value: "Cetak Batok", spec1Pct: "60%",
    spec2Label: "Kemurnian", spec2Value: "100% Nira Aren", spec2Pct: "100%",
    wa: "Gula Aren Getas (500g)"
  },
  biting: {
    category: "Kriya Bambu",
    badge: "Kerajinan Lokal",
    name: "Biting Bambu Craft",
    price: "Rp 15.000",
    unit: "/ pack (isi 50)",
    desc: "Tusuk bambu (biting) ukir tradisional buatan tangan pengrajin Desa Getas. Kokoh, ramah lingkungan, dan cocok untuk sate, jajanan pasar, hingga dekorasi hidangan.",
    imgMain: "https://images.unsplash.com/photo-1517045330398-3f5926ec370b?auto=format&fit=crop&q=80&w=1000",
    img1: "https://images.unsplash.com/photo-1584985250499-52e18d6a86ee?auto=format&fit=crop&q=80&w=600",
    img2: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=600",
    spec1Label: "Bahan", spec1Value: "Bambu Pilihan", spec1Pct: "90%",
    spec2Label: "Ketahanan", spec2Value: "Kuat & Tahan Lama", spec2Pct: "85%",
    wa: "Biting Bambu Craft"
  }
};

function showProduct(id) {
  const p = PRODUCTS[id];
  if (!p) return;

  document.getElementById('product-badge-category').textContent = p.category;
  document.getElementById('product-badge-special').textContent = p.badge;
  document.getElementById('product-title').textContent = p.name;
  document.getElementById('product-price').textContent = p.price;
  document.getElementById('product-unit').textContent = p.unit;
  document.getElementById('product-desc').textContent = p.desc;
  document.getElementById('product-spec1-label').textContent = p.spec1Label;
  document.getElementById('product-spec1-value').textContent = p.spec1Value;
  document.getElementById('product-spec1-bar').style.width = p.spec1Pct;
  document.getElementById('product-spec2-label').textContent = p.spec2Label;
  document.getElementById('product-spec2-value').textContent = p.spec2Value;
  document.getElementById('product-spec2-bar').style.width = p.spec2Pct;
  currentProductWA = p.wa;

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
        if(window.getComputedStyle(el).display !== 'none') {
          el.style.transition = ''; 
          revealObserver.observe(el);
        }
      });
    });
  });
}

function initLazyLoading(container = document) {
  const lazyImages = container.querySelectorAll('.lazy-image:not(.loaded)');
  lazyImages.forEach(img => {
    if(img.dataset.src && img.src !== img.dataset.src) { img.src = img.dataset.src; }
    img.onload = function() {
      img.classList.add('loaded');
      if(img.parentElement && img.parentElement.classList.contains('skeleton-bg')) {
         setTimeout(() => { img.parentElement.classList.remove('skeleton-bg'); }, 500);
      }
    }
    if(img.complete) img.onload();
  });
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