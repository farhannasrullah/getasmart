/**
 * GetasMart Admin Panel
 * CRUD Produk via Firebase Firestore
 *
 * Fitur:
 * - Login session sederhana
 * - CRUD produk
 * - Safe DOM initialization
 * - Try/catch semua operasi async
 * - Retry otomatis untuk error Firestore sementara
 * - Exponential backoff
 * - Request lock anti double-click / spam
 * - Timeout request
 * - Validasi Firebase
 * - HTML escaping
 * - Empty state
 * - Error state
 * - Cache produk
 */

(() => {
  'use strict';

  /* =========================================================
     CONFIG
  ========================================================= */

  const CONFIG = {
    AUTH_KEY: 'getasmart_admin_auth',

    FIRESTORE_COLLECTION: 'products',

    MAX_RETRIES: 3,

    RETRY_BASE_DELAY: 700,

    REQUEST_TIMEOUT: 15000,

    LOAD_COOLDOWN: 1000,

    SAVE_COOLDOWN: 1000,

    DELETE_COOLDOWN: 1000
  };


  /* =========================================================
     STATE
  ========================================================= */

  let productCache = {};

  let isLoadingProducts = false;

  let isSavingProduct = false;

  let isDeletingProduct = false;

  let lastLoadTime = 0;

  let lastSaveTime = 0;

  let lastDeleteTime = 0;

  let initialized = false;


  /* =========================================================
     DOM REFERENCES
  ========================================================= */

  let loginScreen = null;
  let adminScreen = null;

  let loginForm = null;
  let loginError = null;

  let tableBody = null;
  let emptyState = null;
  let productCountEl = null;
  let loadErrorEl = null;

  let modal = null;
  let modalTitle = null;
  let form = null;
  let saveStatus = null;


  /* =========================================================
     FIELD PRODUK
  ========================================================= */

  const FIELDS = [
    'name',
    'category',
    'categoryLabel',
    'price',
    'unit',
    'badge',
    'size',
    'desc',
    'shortDesc',
    'imgMain',
    'img1',
    'img2',
    'spec1Label',
    'spec1Value',
    'spec1Pct',
    'spec2Label',
    'spec2Value',
    'spec2Pct',
    'waMessage',
    'order'
  ];


  /* =========================================================
     DEFAULT / FALLBACK
  ========================================================= */

  const CATEGORY_LABELS = {
    kopi: 'Kopi',
    gula: 'Gula Aren',
    lainnya: 'Lainnya'
  };


  const DEFAULT_SPEC1 = {
    label: 'Kualitas',
    value: 'Premium',
    pct: '80%'
  };


  const DEFAULT_SPEC2 = {
    label: 'Keaslian',
    value: '100% Asli',
    pct: '100%'
  };


  const DEFAULT_UNIT = '/ pcs';

  const DEFAULT_BADGE = 'Produk Pilihan';


  /* =========================================================
     UTILITY
  ========================================================= */

  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }


  function now() {
    return Date.now();
  }


  function withFallback(value, fallback) {
    return value ? value : fallback;
  }


  function normalizePct(value, fallback) {
    if (!value) {
      return fallback;
    }

    const str = String(value).trim();

    if (!str) {
      return fallback;
    }

    return str.endsWith('%')
      ? str
      : `${str}%`;
  }


  function normalizeNumber(value, fallback = 0) {
    const num = Number(value);

    return Number.isFinite(num)
      ? num
      : fallback;
  }


  function normalizeString(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }


  function getElement(id) {
    return document.getElementById(id);
  }


  function val(id) {
    const el = getElement(id);

    if (!el) {
      return '';
    }

    return normalizeString(el.value);
  }


  /* =========================================================
     HTML ESCAPE
  ========================================================= */

  const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };


  const ESCAPE_RE = /[&<>"']/g;


  function esc(str) {
    if (
      str === null ||
      str === undefined
    ) {
      return '';
    }

    return String(str).replace(
      ESCAPE_RE,
      (ch) => ESCAPE_MAP[ch]
    );
  }


  /* =========================================================
     FIREBASE VALIDATION
  ========================================================= */

  function getDb() {
    try {
      if (!window.db) {
        throw new Error(
          'Firebase Firestore belum tersedia. Pastikan window.db sudah diinisialisasi.'
        );
      }

      if (
        typeof window.db.collection !== 'function'
      ) {
        throw new Error(
          'window.db bukan instance Firestore yang valid.'
        );
      }

      return window.db;

    } catch (err) {
      console.error(
        '[GetasMart Admin] Firebase error:',
        err
      );

      throw err;
    }
  }


  /* =========================================================
     FIREBASE RETRY
  ========================================================= */

  function isRetryableFirebaseError(err) {
    if (!err) {
      return false;
    }

    const code = String(
      err.code || ''
    ).toLowerCase();

    const message = String(
      err.message || ''
    ).toLowerCase();

    const retryableCodes = [
      'unavailable',
      'deadline-exceeded',
      'resource-exhausted',
      'aborted',
      'internal',
      'cancelled',
      'unknown'
    ];

    if (
      retryableCodes.some(
        (item) => code.includes(item)
      )
    ) {
      return true;
    }

    const retryableMessages = [
      'network',
      'timeout',
      'temporarily unavailable',
      'too many requests',
      'resource exhausted',
      'quota'
    ];

    return retryableMessages.some(
      (item) => message.includes(item)
    );
  }


  async function withRetry(
    operation,
    options = {}
  ) {
    const maxRetries =
      Number.isFinite(options.maxRetries)
        ? options.maxRetries
        : CONFIG.MAX_RETRIES;

    const baseDelay =
      Number.isFinite(options.baseDelay)
        ? options.baseDelay
        : CONFIG.RETRY_BASE_DELAY;

    let attempt = 0;

    while (true) {
      try {
        return await operation();

      } catch (err) {
        const retryable =
          isRetryableFirebaseError(err);

        if (
          !retryable ||
          attempt >= maxRetries
        ) {
          throw err;
        }

        const jitter =
          Math.floor(
            Math.random() * 300
          );

        const delay =
          (
            baseDelay *
            Math.pow(2, attempt)
          ) + jitter;

        console.warn(
          `[GetasMart Admin] Retry ${attempt + 1}/${maxRetries} dalam ${delay}ms`,
          err
        );

        await sleep(delay);

        attempt++;
      }
    }
  }


  /* =========================================================
     TIMEOUT
  ========================================================= */

  async function withTimeout(
    promise,
    timeout = CONFIG.REQUEST_TIMEOUT
  ) {
    let timer = null;

    const timeoutPromise =
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              'Request timeout. Silakan coba lagi.'
            )
          );
        }, timeout);
      });

    try {
      return await Promise.race([
        promise,
        timeoutPromise
      ]);

    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }


  /* =========================================================
     FRIENDLY FIREBASE ERROR
  ========================================================= */

  function getFriendlyError(err) {
    if (!err) {
      return 'Terjadi kesalahan yang tidak diketahui.';
    }

    const code = String(
      err.code || ''
    ).toLowerCase();

    switch (code) {
      case 'permission-denied':
        return 'Akses ditolak oleh Firestore Security Rules.';

      case 'unauthenticated':
        return 'Firebase menganggap sesi tidak valid.';

      case 'not-found':
        return 'Data produk tidak ditemukan.';

      case 'already-exists':
        return 'Data sudah ada.';

      case 'resource-exhausted':
        return 'Batas/quota Firebase sedang tercapai. Coba beberapa saat lagi.';

      case 'unavailable':
        return 'Firebase sedang tidak tersedia. Coba lagi.';

      case 'deadline-exceeded':
        return 'Request terlalu lama. Periksa koneksi internet.';

      case 'failed-precondition':
        return 'Firestore membutuhkan konfigurasi/index tertentu.';

      case 'network-request-failed':
        return 'Koneksi internet bermasalah.';

      default:
        return err.message ||
          'Terjadi kesalahan. Cek console browser.';
    }
  }


  /* =========================================================
     UI STATUS
  ========================================================= */

  function setLoadError(message = '') {
    if (!loadErrorEl) {
      return;
    }

    if (!message) {
      loadErrorEl.textContent = '';
      loadErrorEl.classList.add('hidden');
      return;
    }

    loadErrorEl.textContent = message;
    loadErrorEl.classList.remove('hidden');
  }


  function setSaveStatus(message = '') {
    if (!saveStatus) {
      return;
    }

    saveStatus.textContent = message;
  }


  function setButtonsDisabled(
    disabled
  ) {
    try {
      const buttons = [
        getElement('add-product-btn'),
        getElement('modal-close-btn'),
        getElement('modal-cancel-btn')
      ];

      buttons.forEach((button) => {
        if (button) {
          button.disabled = disabled;
        }
      });

    } catch (err) {
      console.warn(
        '[GetasMart Admin] Gagal mengubah status tombol:',
        err
      );
    }
  }


  /* =========================================================
     AUTH
  ========================================================= */

  function isAuthed() {
    try {
      return sessionStorage.getItem(
        CONFIG.AUTH_KEY
      ) === 'true';

    } catch (err) {
      console.error(
        '[GetasMart Admin] SessionStorage error:',
        err
      );

      return false;
    }
  }


  function showAdmin() {
    try {
      if (!adminScreen || !loginScreen) {
        console.error(
          '[GetasMart Admin] Elemen screen belum siap.'
        );

        return;
      }

      loginScreen.classList.add('hidden');

      adminScreen.classList.remove(
        'hidden'
      );

      loadProductList();

    } catch (err) {
      console.error(
        '[GetasMart Admin] showAdmin error:',
        err
      );
    }
  }


  function showLogin() {
    try {
      if (!adminScreen || !loginScreen) {
        return;
      }

      adminScreen.classList.add(
        'hidden'
      );

      loginScreen.classList.remove(
        'hidden'
      );

    } catch (err) {
      console.error(
        '[GetasMart Admin] showLogin error:',
        err
      );
    }
  }


  /* =========================================================
     MODAL
  ========================================================= */

  function openModal(
    id = null,
    data = null
  ) {
    try {
      if (!form || !modal || !modalTitle) {
        throw new Error(
          'Elemen modal belum tersedia.'
        );
      }

      form.reset();

      const idEl =
        getElement('f-id');

      if (idEl) {
        idEl.value = id || '';
      }

      modalTitle.textContent =
        id
          ? 'Edit Produk'
          : 'Tambah Produk';


      if (data) {
        FIELDS.forEach((field) => {
          const el =
            getElement(
              'f-' + field
            );

          if (!el) {
            return;
          }

          el.value =
            data[field] ?? '';
        });


        const activeEl =
          getElement('f-active');

        if (activeEl) {
          activeEl.checked =
            data.active !== false;
        }


        const featuredEl =
          getElement('f-featured');

        if (featuredEl) {
          featuredEl.checked =
            data.featured === true;
        }

      } else {

        const activeEl =
          getElement('f-active');

        if (activeEl) {
          activeEl.checked = true;
        }


        const featuredEl =
          getElement('f-featured');

        if (featuredEl) {
          featuredEl.checked = false;
        }


        const orderEl =
          getElement('f-order');

        if (orderEl) {
          orderEl.value = 0;
        }
      }


      setSaveStatus('');

      modal.classList.remove(
        'hidden'
      );

    } catch (err) {
      console.error(
        '[GetasMart Admin] openModal error:',
        err
      );
    }
  }


  function closeModal() {
    try {
      if (!modal) {
        return;
      }

      modal.classList.add(
        'hidden'
      );

      setSaveStatus('');

    } catch (err) {
      console.error(
        '[GetasMart Admin] closeModal error:',
        err
      );
    }
  }


  /* =========================================================
     BUILD PRODUCT PAYLOAD
  ========================================================= */

  function buildProductPayload() {
    const name =
      val('f-name');


    if (!name) {
      throw new Error(
        'Nama produk wajib diisi.'
      );
    }


    const categoryEl =
      getElement('f-category');


    const category =
      categoryEl?.value ||
      'lainnya';


    const imgMain =
      val('f-imgMain');


    const shortDesc =
      withFallback(
        val('f-shortDesc'),
        val('f-desc')
      );


    const activeEl =
      getElement('f-active');


    const featuredEl =
      getElement('f-featured');


    const priceEl =
      getElement('f-price');


    const sizeEl =
      getElement('f-size');


    const orderEl =
      getElement('f-order');


    const payload = {
      name,

      category,

      categoryLabel:
        withFallback(
          val('f-categoryLabel'),
          CATEGORY_LABELS[
            category
          ] || category
        ),

      price:
        normalizeNumber(
          priceEl?.value,
          0
        ),

      unit:
        withFallback(
          val('f-unit'),
          DEFAULT_UNIT
        ),

      badge:
        withFallback(
          val('f-badge'),
          DEFAULT_BADGE
        ),

      size:
        sizeEl?.value ||
        'normal',

      desc:
        val('f-desc'),

      shortDesc,

      imgMain,

      img1:
        withFallback(
          val('f-img1'),
          imgMain
        ),

      img2:
        withFallback(
          val('f-img2'),
          imgMain
        ),

      spec1Label:
        withFallback(
          val('f-spec1Label'),
          DEFAULT_SPEC1.label
        ),

      spec1Value:
        withFallback(
          val('f-spec1Value'),
          DEFAULT_SPEC1.value
        ),

      spec1Pct:
        normalizePct(
          val('f-spec1Pct'),
          DEFAULT_SPEC1.pct
        ),

      spec2Label:
        withFallback(
          val('f-spec2Label'),
          DEFAULT_SPEC2.label
        ),

      spec2Value:
        withFallback(
          val('f-spec2Value'),
          DEFAULT_SPEC2.value
        ),

      spec2Pct:
        normalizePct(
          val('f-spec2Pct'),
          DEFAULT_SPEC2.pct
        ),

      waMessage:
        withFallback(
          val('f-waMessage'),
          name
        ),

      order:
        normalizeNumber(
          orderEl?.value,
          0
        ),

      active:
        activeEl
          ? activeEl.checked
          : true,

      featured:
        featuredEl?.checked === true,

      updatedAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp()
    };


    return payload;
  }


  /* =========================================================
     SAVE PRODUCT
  ========================================================= */

  async function saveProduct(
    event
  ) {
    event.preventDefault();

    if (isSavingProduct) {
      return;
    }


    const currentTime =
      now();

    if (
      currentTime -
      lastSaveTime <
      CONFIG.SAVE_COOLDOWN
    ) {
      return;
    }

    lastSaveTime = currentTime;

    isSavingProduct = true;

    setButtonsDisabled(true);

    setSaveStatus(
      'Menyimpan...'
    );


    try {
      const db =
        getDb();


      const idEl =
        getElement('f-id');


      const id =
        idEl?.value?.trim() || '';


      const payload =
        buildProductPayload();


      if (id) {

        await withTimeout(
          withRetry(
            () =>
              db
                .collection(
                  CONFIG.FIRESTORE_COLLECTION
                )
                .doc(id)
                .update(payload)
          )
        );

        console.log(
          '[GetasMart Admin] Produk berhasil diperbarui:',
          id
        );

      } else {

        payload.createdAt =
          firebase.firestore
            .FieldValue
            .serverTimestamp();


        const result =
          await withTimeout(
            withRetry(
              () =>
                db
                  .collection(
                    CONFIG.FIRESTORE_COLLECTION
                  )
                  .add(payload)
            )
          );


        console.log(
          '[GetasMart Admin] Produk berhasil ditambahkan:',
          result?.id
        );
      }


      setSaveStatus(
        'Berhasil disimpan.'
      );


      closeModal();


      await loadProductList(
        true
      );


    } catch (err) {

      console.error(
        '[GetasMart Admin] Gagal menyimpan produk:',
        err
      );


      const message =
        getFriendlyError(err);


      setSaveStatus(
        message
      );


    } finally {

      isSavingProduct = false;

      setButtonsDisabled(false);
    }
  }


  /* =========================================================
     DELETE PRODUCT
  ========================================================= */

  async function deleteProduct(
    id,
    name
  ) {
    if (
      !id ||
      isDeletingProduct
    ) {
      return;
    }


    const currentTime =
      now();


    if (
      currentTime -
      lastDeleteTime <
      CONFIG.DELETE_COOLDOWN
    ) {
      return;
    }


    lastDeleteTime =
      currentTime;


    const confirmed =
      window.confirm(
        `Hapus produk "${name || 'ini'}"? Aksi ini tidak bisa dibatalkan.`
      );


    if (!confirmed) {
      return;
    }


    isDeletingProduct =
      true;


    try {
      const db =
        getDb();


      await withTimeout(
        withRetry(
          () =>
            db
              .collection(
                CONFIG.FIRESTORE_COLLECTION
              )
              .doc(id)
              .delete()
        )
      );


      delete productCache[id];


      await loadProductList(
        true
      );


      console.log(
        '[GetasMart Admin] Produk berhasil dihapus:',
        id
      );


    } catch (err) {

      console.error(
        '[GetasMart Admin] Gagal menghapus produk:',
        err
      );


      window.alert(
        `Gagal menghapus produk.\n\n${getFriendlyError(err)}`
      );


    } finally {

      isDeletingProduct =
        false;
    }
  }


  /* =========================================================
     TABLE ROW
  ========================================================= */

  function rowHTML(
    id,
    p
  ) {
    const statusBadge =
      p.active !== false

        ? `
          <span
            class="bg-green-100 text-green-700 text-xs
            font-semibold px-2.5 py-1 rounded-full">
            Aktif
          </span>
        `

        : `
          <span
            class="bg-gray-100 text-gray-500 text-xs
            font-semibold px-2.5 py-1 rounded-full">
            Nonaktif
          </span>
        `;


    const featuredBadge =
      p.featured === true

        ? `
          <span
            class="bg-amber-100 text-amber-700 text-xs
            font-semibold px-2.5 py-1 rounded-full">
            Pilihan
          </span>
        `

        : '';


    return `
      <tr>

        <td class="px-4 py-3">

          <div class="flex items-center gap-3">

            <img
              src="${esc(p.imgMain)}"
              class="w-10 h-10 rounded-lg object-cover bg-gray-100"
              onerror="this.style.visibility='hidden'"
              alt=""
            />

            <div class="min-w-0">

              <p
                class="font-semibold text-gray-800 truncate">
                ${esc(p.name || '-')}
              </p>

              <div
                class="flex flex-wrap items-center gap-1.5 mt-1">

                <span
                  class="text-xs text-gray-400">
                  ${esc(
                    p.unit ||
                    DEFAULT_UNIT
                  )}
                </span>

                ${featuredBadge}

              </div>

            </div>

          </div>

        </td>


        <td
          class="px-4 py-3 text-gray-600">

          ${esc(
            p.categoryLabel ||
            CATEGORY_LABELS[
              p.category
            ] ||
            p.category ||
            '-'
          )}

        </td>


        <td
          class="px-4 py-3 text-gray-600">

          Rp ${normalizeNumber(
            p.price,
            0
          ).toLocaleString(
            'id-ID'
          )}

        </td>


        <td
          class="px-4 py-3 text-gray-600">

          ${esc(
            p.order ?? 0
          )}

        </td>


        <td
          class="px-4 py-3">

          ${statusBadge}

        </td>


        <td
          class="px-4 py-3 text-right whitespace-nowrap">

          <button
            type="button"
            data-edit="${esc(id)}"
            class="text-sm text-[#012d1d]
            font-semibold hover:underline mr-3">
            Edit
          </button>


          <button
            type="button"
            data-delete="${esc(id)}"
            data-name="${esc(p.name || '')}"
            class="text-sm text-red-500
            font-semibold hover:underline">
            Hapus
          </button>

        </td>

      </tr>
    `;
  }


  /* =========================================================
     LOAD PRODUCT LIST
  ========================================================= */

  async function loadProductList(
    force = false
  ) {
    if (
      isLoadingProducts &&
      !force
    ) {
      return;
    }


    const currentTime =
      now();


    if (
      !force &&
      currentTime -
      lastLoadTime <
      CONFIG.LOAD_COOLDOWN
    ) {
      return;
    }


    lastLoadTime =
      currentTime;


    isLoadingProducts =
      true;


    setLoadError('');


    try {

      const db =
        getDb();


      if (
        tableBody
      ) {
        tableBody.innerHTML = `
          <tr>
            <td
              colspan="6"
              class="px-4 py-10 text-center text-gray-400">
              Memuat produk...
            </td>
          </tr>
        `;
      }


      const snap =
        await withTimeout(
          withRetry(
            () =>
              db
                .collection(
                  CONFIG.FIRESTORE_COLLECTION
                )
                .orderBy(
                  'order',
                  'asc'
                )
                .get()
          )
        );


      productCache = {};


      const rows = [];


      if (
        snap &&
        typeof snap.forEach ===
          'function'
      ) {

        snap.forEach(
          (doc) => {
            const data =
              doc.data() || {};


            productCache[
              doc.id
            ] = data;


            rows.push(
              rowHTML(
                doc.id,
                data
              )
            );
          }
        );
      }


      if (tableBody) {
        tableBody.innerHTML =
          rows.join('');
      }


      if (emptyState) {
        emptyState.classList.toggle(
          'hidden',
          rows.length > 0
        );
      }


      if (productCountEl) {
        productCountEl.textContent =
          `${rows.length} produk`;
      }


      console.log(
        `[GetasMart Admin] ${rows.length} produk dimuat.`
      );


    } catch (err) {

      console.error(
        '[GetasMart Admin] Gagal memuat produk:',
        err
      );


      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td
              colspan="6"
              class="px-4 py-10 text-center text-red-500">
              Gagal memuat data produk.
            </td>
          </tr>
        `;
      }


      if (emptyState) {
        emptyState.classList.add(
          'hidden'
        );
      }


      if (productCountEl) {
        productCountEl.textContent =
          '0 produk';
      }


      setLoadError(
        getFriendlyError(err)
      );


    } finally {

      isLoadingProducts =
        false;
    }
  }


  /* =========================================================
     EVENT HANDLERS
  ========================================================= */

  function setupEventListeners() {

    /* -------------------------------------------------------
       LOGIN
    ------------------------------------------------------- */

    if (loginForm) {

      loginForm.addEventListener(
        'submit',
        (event) => {
          try {

            event.preventDefault();


            const passwordEl =
              getElement(
                'login-password'
              );


            const value =
              passwordEl?.value || '';


            const adminPassword =
              window.ADMIN_PASSWORD;


            if (
              adminPassword ===
              undefined ||
              adminPassword ===
              null
            ) {

              if (loginError) {
                loginError.textContent =
                  'Konfigurasi password admin belum tersedia.';
                loginError.classList.remove(
                  'hidden'
                );
              }

              console.error(
                '[GetasMart Admin] window.ADMIN_PASSWORD tidak ditemukan.'
              );

              return;
            }


            if (
              value ===
              String(
                adminPassword
              )
            ) {

              sessionStorage.setItem(
                CONFIG.AUTH_KEY,
                'true'
              );


              if (loginError) {
                loginError.textContent =
                  '';
                loginError.classList.add(
                  'hidden'
                );
              }


              showAdmin();


            } else {

              if (loginError) {
                loginError.textContent =
                  'Password salah.';
                loginError.classList.remove(
                  'hidden'
                );
              }
            }

          } catch (err) {

            console.error(
              '[GetasMart Admin] Login error:',
              err
            );

            if (loginError) {
              loginError.textContent =
                'Terjadi kesalahan saat login.';
              loginError.classList.remove(
                'hidden'
              );
            }
          }
        }
      );
    }


    /* -------------------------------------------------------
       LOGOUT
    ------------------------------------------------------- */

    const logoutBtn =
      getElement(
        'logout-btn'
      );


    if (logoutBtn) {

      logoutBtn.addEventListener(
        'click',
        () => {

          try {

            sessionStorage.removeItem(
              CONFIG.AUTH_KEY
            );


            showLogin();

          } catch (err) {

            console.error(
              '[GetasMart Admin] Logout error:',
              err
            );
          }
        }
      );
    }


    /* -------------------------------------------------------
       ADD PRODUCT
    ------------------------------------------------------- */

    const addBtn =
      getElement(
        'add-product-btn'
      );


    if (addBtn) {

      addBtn.addEventListener(
        'click',
        () => {

          try {
            openModal(
              null,
              null
            );

          } catch (err) {

            console.error(
              '[GetasMart Admin] Add product error:',
              err
            );
          }
        }
      );
    }


    /* -------------------------------------------------------
       MODAL CLOSE
    ------------------------------------------------------- */

    const modalCloseBtn =
      getElement(
        'modal-close-btn'
      );


    if (modalCloseBtn) {

      modalCloseBtn.addEventListener(
        'click',
        closeModal
      );
    }


    /* -------------------------------------------------------
       MODAL CANCEL
    ------------------------------------------------------- */

    const modalCancelBtn =
      getElement(
        'modal-cancel-btn'
      );


    if (modalCancelBtn) {

      modalCancelBtn.addEventListener(
        'click',
        closeModal
      );
    }


    /* -------------------------------------------------------
       CLICK OUTSIDE MODAL
    ------------------------------------------------------- */

    if (modal) {

      modal.addEventListener(
        'click',
        (event) => {

          try {

            if (
              event.target ===
              modal
            ) {
              closeModal();
            }

          } catch (err) {

            console.error(
              '[GetasMart Admin] Modal click error:',
              err
            );
          }
        }
      );
    }


    /* -------------------------------------------------------
       SAVE
    ------------------------------------------------------- */

    if (form) {

      form.addEventListener(
        'submit',
        saveProduct
      );
    }


    /* -------------------------------------------------------
       PRODUCT ACTIONS
    ------------------------------------------------------- */

    if (tableBody) {

      tableBody.addEventListener(
        'click',
        async (event) => {

          try {

            const editBtn =
              event.target.closest(
                '[data-edit]'
              );


            if (editBtn) {

              const id =
                editBtn.dataset.edit;


              if (!id) {
                return;
              }


              const data =
                productCache[id];


              if (!data) {

                setLoadError(
                  'Data produk tidak ditemukan. Muat ulang halaman.'
                );

                return;
              }


              openModal(
                id,
                data
              );


              return;
            }


            const deleteBtn =
              event.target.closest(
                '[data-delete]'
              );


            if (deleteBtn) {

              const id =
                deleteBtn.dataset.delete;


              const name =
                deleteBtn.dataset.name ||
                'produk ini';


              await deleteProduct(
                id,
                name
              );
            }

          } catch (err) {

            console.error(
              '[GetasMart Admin] Product action error:',
              err
            );
          }
        }
      );
    }


    /* -------------------------------------------------------
       ESC CLOSE MODAL
    ------------------------------------------------------- */

    document.addEventListener(
      'keydown',
      (event) => {

        try {

          if (
            event.key ===
            'Escape'
          ) {

            if (
              modal &&
              !modal.classList.contains(
                'hidden'
              )
            ) {
              closeModal();
            }
          }

        } catch (err) {

          console.error(
            '[GetasMart Admin] Keyboard error:',
            err
          );
        }
      }
    );
  }


  /* =========================================================
     DOM INITIALIZATION
  ========================================================= */

  function initializeDom() {

    loginScreen =
      getElement(
        'login-screen'
      );


    adminScreen =
      getElement(
        'admin-screen'
      );


    loginForm =
      getElement(
        'login-form'
      );


    loginError =
      getElement(
        'login-error'
      );


    tableBody =
      getElement(
        'product-table-body'
      );


    emptyState =
      getElement(
        'empty-state'
      );


    productCountEl =
      getElement(
        'product-count'
      );


    loadErrorEl =
      getElement(
        'load-error'
      );


    modal =
      getElement(
        'product-modal'
      );


    modalTitle =
      getElement(
        'modal-title'
      );


    form =
      getElement(
        'product-form'
      );


    saveStatus =
      getElement(
        'save-status'
      );
  }


  /* =========================================================
     START APPLICATION
  ========================================================= */

  function init() {

    if (initialized) {
      return;
    }


    initialized = true;


    try {

      initializeDom();


      setupEventListeners();


      /*
       * PENTING:
       * showAdmin baru dipanggil SETELAH seluruh variable
       * dan event listener selesai dibuat.
       *
       * Ini menghilangkan error:
       *
       * ReferenceError:
       * can't access lexical declaration
       * 'loadErrorEl' before initialization
       */

      if (
        isAuthed()
      ) {

        showAdmin();

      } else {

        showLogin();
      }


    } catch (err) {

      console.error(
        '[GetasMart Admin] Fatal initialization error:',
        err
      );


      try {

        if (loginError) {

          loginError.textContent =
            'Admin gagal diinisialisasi. Cek Console browser.';

          loginError.classList.remove(
            'hidden'
          );
        }

      } catch (_) {
        // Ignore secondary UI error
      }
    }
  }


  /* =========================================================
     DOM READY
  ========================================================= */

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once: true
      }
    );

  } else {

    init();
  }


  /* =========================================================
     GLOBAL DEBUG HELPERS
  ========================================================= */

  window.GetasMartAdmin = {

    reloadProducts: () =>
      loadProductList(true),

    getProductCache: () =>
      productCache,

    openProductModal: (
      id,
      data
    ) =>
      openModal(
        id,
        data
      ),

    closeProductModal: () =>
      closeModal()
  };

})();