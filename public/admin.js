/**
 * ============================================================
 * GETASMART ADMIN PANEL
 * ============================================================
 *
 * CRUD Produk GetasMart via Firestore
 *
 * Proteksi:
 * - Initialization aman
 * - Session admin
 * - Auto re-login saat credential/auth expired
 * - Firestore error handling
 * - Retry exponential backoff
 * - Timeout request
 * - Anti duplicate request
 * - Anti double click
 * - HTML escaping
 * - Cache produk
 * - Modal error handling
 *
 * Catatan:
 * Sistem login saat ini menggunakan:
 * window.ADMIN_PASSWORD
 *
 * sessionStorage hanya menyimpan status login browser.
 * Firestore tetap menjadi sumber validasi akses sebenarnya.
 */

(() => {
  'use strict';

  /* =========================================================
     CONFIG
  ========================================================= */

  const CONFIG = {
    AUTH_KEY: 'getasmart_admin_auth',

    PRODUCTS_COLLECTION: 'products',

    MAX_RETRIES: 3,

    RETRY_BASE_DELAY: 800,

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

  let isLoggingOut = false;

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
     PRODUCT FIELDS
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
     DEFAULT VALUES
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
     BASIC UTILITY
  ========================================================= */

  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }


  function getNow() {
    return Date.now();
  }


  function getElement(id) {
    try {
      return document.getElementById(id);
    } catch (err) {
      console.error(
        '[GetasMart Admin] getElement error:',
        err
      );

      return null;
    }
  }


  function val(id) {
    const el = getElement(id);

    if (!el) {
      return '';
    }

    return String(
      el.value ?? ''
    ).trim();
  }


  function withFallback(
    value,
    fallback
  ) {
    return value
      ? value
      : fallback;
  }


  function normalizePct(
    value,
    fallback
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    const str =
      String(value).trim();

    if (!str) {
      return fallback;
    }

    return str.endsWith('%')
      ? str
      : `${str}%`;
  }


  function normalizeNumber(
    value,
    fallback = 0
  ) {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
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


  function esc(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    return String(value).replace(
      ESCAPE_RE,
      (char) => ESCAPE_MAP[char]
    );
  }


  /* =========================================================
     FIREBASE VALIDATION
  ========================================================= */

  function getDb() {
    try {
      if (
        !window.db
      ) {
        throw new Error(
          'Firebase Firestore belum tersedia. window.db tidak ditemukan.'
        );
      }


      if (
        typeof window.db.collection !==
        'function'
      ) {
        throw new Error(
          'window.db bukan instance Firestore yang valid.'
        );
      }


      return window.db;

    } catch (err) {

      console.error(
        '[GetasMart Admin] Firebase DB error:',
        err
      );

      throw err;
    }
  }


  /* =========================================================
     FIREBASE AUTH ERROR DETECTION
  ========================================================= */

  function isAuthError(err) {
    if (!err) {
      return false;
    }


    const code =
      String(
        err.code || ''
      ).toLowerCase();


    const message =
      String(
        err.message || ''
      ).toLowerCase();


    const authCodes = [
      'permission-denied',
      'unauthenticated',
      'auth/id-token-expired',
      'auth/user-token-expired',
      'auth/user-disabled',
      'auth/requires-recent-login',
      'auth/invalid-user-token',
      'auth/session-cookie-expired',
      'auth/invalid-credential'
    ];


    if (
      authCodes.some(
        (authCode) =>
          code === authCode ||
          code.includes(authCode)
      )
    ) {
      return true;
    }


    const authMessages = [
      'credential',
      'authentication',
      'unauthenticated',
      'permission denied',
      'token expired',
      'id token expired',
      'user token expired',
      'invalid user token',
      'invalid credential'
    ];


    return authMessages.some(
      (text) =>
        message.includes(text)
    );
  }


  /* =========================================================
     FORCE RE-LOGIN
  ========================================================= */

  function forceRelogin(
    message =
      'Sesi admin telah berakhir. Silakan login kembali.'
  ) {
    if (isLoggingOut) {
      return;
    }


    isLoggingOut = true;


    console.warn(
      '[GetasMart Admin] Sesi/auth expired. Meminta login ulang.'
    );


    try {

      /* -----------------------------------------------------
         Hapus session admin browser
      ----------------------------------------------------- */

      try {
        sessionStorage.removeItem(
          CONFIG.AUTH_KEY
        );
      } catch (storageError) {
        console.warn(
          '[GetasMart Admin] Gagal menghapus session:',
          storageError
        );
      }


      /* -----------------------------------------------------
         Bersihkan cache produk
      ----------------------------------------------------- */

      productCache = {};


      /* -----------------------------------------------------
         Tutup modal
      ----------------------------------------------------- */

      if (modal) {
        modal.classList.add(
          'hidden'
        );
      }


      /* -----------------------------------------------------
         Reset status UI
      ----------------------------------------------------- */

      if (saveStatus) {
        saveStatus.textContent =
          '';
      }


      if (loadErrorEl) {
        loadErrorEl.textContent =
          '';

        loadErrorEl.classList.add(
          'hidden'
        );
      }


      /* -----------------------------------------------------
         Tampilkan pesan login
      ----------------------------------------------------- */

      if (loginError) {

        loginError.textContent =
          message;

        loginError.classList.remove(
          'hidden'
        );
      }


      /* -----------------------------------------------------
         Sembunyikan admin
      ----------------------------------------------------- */

      if (adminScreen) {
        adminScreen.classList.add(
          'hidden'
        );
      }


      /* -----------------------------------------------------
         Tampilkan login
      ----------------------------------------------------- */

      if (loginScreen) {
        loginScreen.classList.remove(
          'hidden'
        );
      }


      /* -----------------------------------------------------
         Reset login form
      ----------------------------------------------------- */

      try {

        if (
          loginForm &&
          typeof loginForm.reset ===
            'function'
        ) {
          loginForm.reset();
        }


        const passwordInput =
          getElement(
            'login-password'
          );


        if (passwordInput) {
          passwordInput.value = '';

          setTimeout(() => {
            try {
              passwordInput.focus();
            } catch (_) {}
          }, 50);
        }

      } catch (focusError) {

        console.warn(
          '[GetasMart Admin] Login form reset error:',
          focusError
        );
      }


    } catch (err) {

      console.error(
        '[GetasMart Admin] forceRelogin error:',
        err
      );

    } finally {

      setTimeout(() => {
        isLoggingOut = false;
      }, 500);
    }
  }


  /* =========================================================
     FRIENDLY ERROR
  ========================================================= */

  function getFriendlyError(err) {

    if (!err) {
      return (
        'Terjadi kesalahan yang tidak diketahui.'
      );
    }


    const code =
      String(
        err.code || ''
      ).toLowerCase();


    const message =
      String(
        err.message || ''
      );


    if (
      isAuthError(err)
    ) {
      return (
        'Sesi admin telah berakhir. Silakan login kembali.'
      );
    }


    switch (code) {

      case 'permission-denied':

        return (
          'Akses Firestore ditolak oleh Security Rules.'
        );


      case 'unauthenticated':

        return (
          'Autentikasi Firebase tidak valid.'
        );


      case 'not-found':

        return (
          'Data tidak ditemukan.'
        );


      case 'already-exists':

        return (
          'Data sudah ada.'
        );


      case 'resource-exhausted':

        return (
          'Quota/rate limit Firebase sedang tercapai. Silakan coba lagi beberapa saat.'
        );


      case 'unavailable':

        return (
          'Firebase sedang tidak tersedia. Silakan coba lagi.'
        );


      case 'deadline-exceeded':

        return (
          'Request terlalu lama. Periksa koneksi internet.'
        );


      case 'failed-precondition':

        return (
          'Firestore membutuhkan konfigurasi/index tertentu.'
        );


      case 'network-request-failed':

        return (
          'Koneksi internet bermasalah.'
        );


      default:

        return (
          message ||
          'Terjadi kesalahan. Cek Console browser.'
        );
    }
  }


  /* =========================================================
     UI STATUS
  ========================================================= */

  function setLoadError(
    message = ''
  ) {
    try {

      if (!loadErrorEl) {
        return;
      }


      if (!message) {

        loadErrorEl.textContent =
          '';

        loadErrorEl.classList.add(
          'hidden'
        );

        return;
      }


      loadErrorEl.textContent =
        message;

      loadErrorEl.classList.remove(
        'hidden'
      );

    } catch (err) {

      console.error(
        '[GetasMart Admin] setLoadError error:',
        err
      );
    }
  }


  function setSaveStatus(
    message = ''
  ) {
    try {

      if (saveStatus) {
        saveStatus.textContent =
          message;
      }

    } catch (err) {

      console.error(
        '[GetasMart Admin] setSaveStatus error:',
        err
      );
    }
  }


  function setButtonsDisabled(
    disabled
  ) {
    try {

      const buttonIds = [
        'add-product-btn',
        'modal-close-btn',
        'modal-cancel-btn'
      ];


      buttonIds.forEach(
        (id) => {

          const button =
            getElement(id);


          if (button) {
            button.disabled =
              disabled;
          }
        }
      );

    } catch (err) {

      console.warn(
        '[GetasMart Admin] Button state error:',
        err
      );
    }
  }


  /* =========================================================
     RETRY HELPER
  ========================================================= */

  function isRetryableError(err) {

    if (!err) {
      return false;
    }


    if (
      isAuthError(err)
    ) {
      return false;
    }


    const code =
      String(
        err.code || ''
      ).toLowerCase();


    const message =
      String(
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
        (item) =>
          code.includes(item)
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
      (item) =>
        message.includes(item)
    );
  }


  async function withRetry(
    operation,
    maxRetries =
      CONFIG.MAX_RETRIES
  ) {

    let attempt = 0;


    while (true) {

      try {

        return await operation();

      } catch (err) {

        if (
          !isRetryableError(err) ||
          attempt >= maxRetries
        ) {
          throw err;
        }


        const exponential =
          CONFIG.RETRY_BASE_DELAY *
          Math.pow(
            2,
            attempt
          );


        const jitter =
          Math.floor(
            Math.random() * 400
          );


        const delay =
          exponential +
          jitter;


        console.warn(
          `[GetasMart Admin] Firebase retry ${attempt + 1}/${maxRetries} dalam ${delay}ms`,
          err
        );


        await sleep(
          delay
        );


        attempt++;
      }
    }
  }


  /* =========================================================
     TIMEOUT
  ========================================================= */

  async function withTimeout(
    promise,
    timeout =
      CONFIG.REQUEST_TIMEOUT
  ) {

    let timer = null;


    const timeoutPromise =
      new Promise(
        (_, reject) => {

          timer =
            setTimeout(() => {

              reject(
                new Error(
                  'Request timeout. Silakan coba lagi.'
                )
              );

            }, timeout);
        }
      );


    try {

      return await Promise.race([
        promise,
        timeoutPromise
      ]);

    } finally {

      if (timer) {
        clearTimeout(
          timer
        );
      }
    }
  }


  /* =========================================================
     AUTH SESSION
  ========================================================= */

  function isAuthed() {

    try {

      return (
        sessionStorage.getItem(
          CONFIG.AUTH_KEY
        ) === 'true'
      );

    } catch (err) {

      console.error(
        '[GetasMart Admin] Session error:',
        err
      );

      return false;
    }
  }


  function setAuthed(
    value
  ) {

    try {

      if (value) {

        sessionStorage.setItem(
          CONFIG.AUTH_KEY,
          'true'
        );

      } else {

        sessionStorage.removeItem(
          CONFIG.AUTH_KEY
        );
      }

    } catch (err) {

      console.error(
        '[GetasMart Admin] Session update error:',
        err
      );
    }
  }


  /* =========================================================
     SHOW ADMIN
  ========================================================= */

  async function showAdmin() {

    try {

      if (
        !loginScreen ||
        !adminScreen
      ) {

        console.error(
          '[GetasMart Admin] Login/Admin screen belum tersedia.'
        );

        return;
      }


      loginScreen.classList.add(
        'hidden'
      );


      adminScreen.classList.remove(
        'hidden'
      );


      /*
       * Penting:
       * loadProductList dipanggil SETELAH semua DOM reference
       * selesai diinisialisasi.
       */

      await loadProductList();

    } catch (err) {

      console.error(
        '[GetasMart Admin] showAdmin error:',
        err
      );


      if (
        isAuthError(err)
      ) {
        forceRelogin();
      }
    }
  }


  /* =========================================================
     SHOW LOGIN
  ========================================================= */

  function showLogin(
    message = ''
  ) {

    try {

      if (
        adminScreen
      ) {
        adminScreen.classList.add(
          'hidden'
        );
      }


      if (
        loginScreen
      ) {
        loginScreen.classList.remove(
          'hidden'
        );
      }


      if (
        loginError
      ) {

        if (message) {

          loginError.textContent =
            message;

          loginError.classList.remove(
            'hidden'
          );

        } else {

          loginError.textContent =
            '';

          loginError.classList.add(
            'hidden'
          );
        }
      }


    } catch (err) {

      console.error(
        '[GetasMart Admin] showLogin error:',
        err
      );
    }
  }


  /* =========================================================
     LOGIN
  ========================================================= */

  function handleLogin(
    event
  ) {

    try {

      event.preventDefault();


      const passwordInput =
        getElement(
          'login-password'
        );


      const password =
        passwordInput?.value ||
        '';


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
            'Konfigurasi password admin tidak ditemukan.';

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
        password !==
        String(
          adminPassword
        )
      ) {

        if (loginError) {

          loginError.textContent =
            'Password salah.';

          loginError.classList.remove(
            'hidden'
          );
        }


        return;
      }


      /* -----------------------------------------------------
         LOGIN BERHASIL
      ----------------------------------------------------- */

      setAuthed(
        true
      );


      if (loginError) {

        loginError.textContent =
          '';

        loginError.classList.add(
          'hidden'
        );
      }


      if (passwordInput) {
        passwordInput.value =
          '';
      }


      showAdmin();

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


  /* =========================================================
     LOGOUT
  ========================================================= */

  function logout() {

    try {

      setAuthed(
        false
      );


      productCache = {};


      closeModal();


      showLogin(
        'Anda telah keluar dari Admin Panel.'
      );


    } catch (err) {

      console.error(
        '[GetasMart Admin] Logout error:',
        err
      );
    }
  }


  /* =========================================================
     MODAL OPEN
  ========================================================= */

  function openModal(
    id = null,
    data = null
  ) {

    try {

      if (
        !form ||
        !modal ||
        !modalTitle
      ) {

        throw new Error(
          'Elemen modal belum tersedia di HTML.'
        );
      }


      form.reset();


      const idEl =
        getElement(
          'f-id'
        );


      if (idEl) {
        idEl.value =
          id || '';
      }


      modalTitle.textContent =
        id
          ? 'Edit Produk'
          : 'Tambah Produk';


      if (data) {

        FIELDS.forEach(
          (field) => {

            const el =
              getElement(
                'f-' + field
              );


            if (!el) {
              return;
            }


            el.value =
              data[field] ??
              '';
          }
        );


        const activeEl =
          getElement(
            'f-active'
          );


        if (activeEl) {

          activeEl.checked =
            data.active !== false;
        }


        const featuredEl =
          getElement(
            'f-featured'
          );


        if (featuredEl) {

          featuredEl.checked =
            data.featured === true;
        }


      } else {

        const activeEl =
          getElement(
            'f-active'
          );


        if (activeEl) {
          activeEl.checked =
            true;
        }


        const featuredEl =
          getElement(
            'f-featured'
          );


        if (featuredEl) {
          featuredEl.checked =
            false;
        }


        const orderEl =
          getElement(
            'f-order'
          );


        if (orderEl) {
          orderEl.value =
            0;
        }
      }


      setSaveStatus(
        ''
      );


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


  /* =========================================================
     MODAL CLOSE
  ========================================================= */

  function closeModal() {

    try {

      if (
        modal
      ) {

        modal.classList.add(
          'hidden'
        );
      }


      setSaveStatus(
        ''
      );


    } catch (err) {

      console.error(
        '[GetasMart Admin] closeModal error:',
        err
      );
    }
  }


  /* =========================================================
     BUILD PAYLOAD
  ========================================================= */

  function buildPayload() {

    const name =
      val(
        'f-name'
      );


    if (!name) {

      throw new Error(
        'Nama produk wajib diisi.'
      );
    }


    const categoryEl =
      getElement(
        'f-category'
      );


    const category =
      categoryEl?.value ||
      'lainnya';


    const imgMain =
      val(
        'f-imgMain'
      );


    const shortDesc =
      withFallback(
        val(
          'f-shortDesc'
        ),
        val(
          'f-desc'
        )
      );


    const priceEl =
      getElement(
        'f-price'
      );


    const sizeEl =
      getElement(
        'f-size'
      );


    const orderEl =
      getElement(
        'f-order'
      );


    const activeEl =
      getElement(
        'f-active'
      );


    const featuredEl =
      getElement(
        'f-featured'
      );


    return {

      name,

      category,

      categoryLabel:
        withFallback(
          val(
            'f-categoryLabel'
          ),
          CATEGORY_LABELS[
            category
          ] ||
            category
        ),


      price:
        normalizeNumber(
          priceEl?.value,
          0
        ),


      unit:
        withFallback(
          val(
            'f-unit'
          ),
          DEFAULT_UNIT
        ),


      badge:
        withFallback(
          val(
            'f-badge'
          ),
          DEFAULT_BADGE
        ),


      size:
        sizeEl?.value ||
        'normal',


      desc:
        val(
          'f-desc'
        ),


      shortDesc,


      imgMain,


      img1:
        withFallback(
          val(
            'f-img1'
          ),
          imgMain
        ),


      img2:
        withFallback(
          val(
            'f-img2'
          ),
          imgMain
        ),


      spec1Label:
        withFallback(
          val(
            'f-spec1Label'
          ),
          DEFAULT_SPEC1.label
        ),


      spec1Value:
        withFallback(
          val(
            'f-spec1Value'
          ),
          DEFAULT_SPEC1.value
        ),


      spec1Pct:
        normalizePct(
          val(
            'f-spec1Pct'
          ),
          DEFAULT_SPEC1.pct
        ),


      spec2Label:
        withFallback(
          val(
            'f-spec2Label'
          ),
          DEFAULT_SPEC2.label
        ),


      spec2Value:
        withFallback(
          val(
            'f-spec2Value'
          ),
          DEFAULT_SPEC2.value
        ),


      spec2Pct:
        normalizePct(
          val(
            'f-spec2Pct'
          ),
          DEFAULT_SPEC2.pct
        ),


      waMessage:
        withFallback(
          val(
            'f-waMessage'
          ),
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
        featuredEl?.checked ===
        true,


      updatedAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp()
    };
  }


  /* =========================================================
     SAVE PRODUCT
  ========================================================= */

  async function saveProduct(
    event
  ) {

    event.preventDefault();


    if (
      isSavingProduct
    ) {
      return;
    }


    const current =
      getNow();


    if (
      current -
        lastSaveTime <
      CONFIG.SAVE_COOLDOWN
    ) {

      return;
    }


    lastSaveTime =
      current;


    isSavingProduct =
      true;


    setButtonsDisabled(
      true
    );


    setSaveStatus(
      'Menyimpan...'
    );


    try {

      const db =
        getDb();


      const idEl =
        getElement(
          'f-id'
        );


      const id =
        idEl?.value?.trim() ||
        '';


      const payload =
        buildPayload();


      /* -----------------------------------------------------
         UPDATE
      ----------------------------------------------------- */

      if (id) {

        await withTimeout(

          withRetry(
            () =>

              db
                .collection(
                  CONFIG.PRODUCTS_COLLECTION
                )
                .doc(id)
                .update(
                  payload
                )
          )

        );


        console.log(
          '[GetasMart Admin] Produk diperbarui:',
          id
        );


      /* -----------------------------------------------------
         ADD
      ----------------------------------------------------- */

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
                    CONFIG.PRODUCTS_COLLECTION
                  )
                  .add(
                    payload
                  )
            )

          );


        console.log(
          '[GetasMart Admin] Produk ditambahkan:',
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


      /* -----------------------------------------------------
         AUTH EXPIRED
      ----------------------------------------------------- */

      if (
        isAuthError(err)
      ) {

        forceRelogin(
          'Sesi admin telah berakhir. Silakan login kembali.'
        );


        return;
      }


      setSaveStatus(
        getFriendlyError(err)
      );


    } finally {

      isSavingProduct =
        false;


      setButtonsDisabled(
        false
      );
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


    const current =
      getNow();


    if (
      current -
        lastDeleteTime <
      CONFIG.DELETE_COOLDOWN
    ) {

      return;
    }


    lastDeleteTime =
      current;


    const confirmed =
      window.confirm(
        `Hapus produk "${name || 'produk ini'}"?\n\nAksi ini tidak bisa dibatalkan.`
      );


    if (
      !confirmed
    ) {
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
                CONFIG.PRODUCTS_COLLECTION
              )
              .doc(id)
              .delete()
        )

      );


      delete productCache[
        id
      ];


      await loadProductList(
        true
      );


      console.log(
        '[GetasMart Admin] Produk dihapus:',
        id
      );


    } catch (err) {

      console.error(
        '[GetasMart Admin] Gagal menghapus produk:',
        err
      );


      if (
        isAuthError(err)
      ) {

        forceRelogin(
          'Sesi admin telah berakhir. Silakan login kembali.'
        );


        return;
      }


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
    product
  ) {

    const p =
      product || {};


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


    const category =
      p.categoryLabel ||
      CATEGORY_LABELS[
        p.category
      ] ||
      p.category ||
      '-';


    const price =
      normalizeNumber(
        p.price,
        0
      );


    return `
      <tr>

        <td
          class="px-4 py-3">

          <div
            class="flex items-center gap-3">

            <img
              src="${esc(p.imgMain)}"
              class="w-10 h-10 rounded-lg object-cover bg-gray-100"
              onerror="this.style.visibility='hidden'"
              alt=""
            />

            <div
              class="min-w-0">

              <p
                class="font-semibold text-gray-800 truncate">
                ${esc(
                  p.name ||
                  '-'
                )}
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
            category
          )}

        </td>


        <td
          class="px-4 py-3 text-gray-600">

          Rp ${price.toLocaleString(
            'id-ID'
          )}

        </td>


        <td
          class="px-4 py-3 text-gray-600">

          ${esc(
            p.order ??
            0
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
            data-name="${esc(
              p.name || ''
            )}"
            class="text-sm text-red-500
            font-semibold hover:underline">
            Hapus
          </button>

        </td>

      </tr>
    `;
  }


  /* =========================================================
     LOAD PRODUCTS
  ========================================================= */

  async function loadProductList(
    force = false
  ) {

    /* -------------------------------------------------------
       Anti duplicate request
    ------------------------------------------------------- */

    if (
      isLoadingProducts &&
      !force
    ) {

      return;
    }


    const current =
      getNow();


    if (
      !force &&
      current -
        lastLoadTime <
      CONFIG.LOAD_COOLDOWN
    ) {

      return;
    }


    lastLoadTime =
      current;


    isLoadingProducts =
      true;


    setLoadError(
      ''
    );


    try {

      const db =
        getDb();


      /* -----------------------------------------------------
         Loading UI
      ----------------------------------------------------- */

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


      /* -----------------------------------------------------
         Firestore Query
      ----------------------------------------------------- */

      const snapshot =
        await withTimeout(

          withRetry(
            () =>

              db
                .collection(
                  CONFIG.PRODUCTS_COLLECTION
                )
                .orderBy(
                  'order',
                  'asc'
                )
                .get()
          )

        );


      /* -----------------------------------------------------
         Cache reset
      ----------------------------------------------------- */

      productCache = {};


      const rows = [];


      /* -----------------------------------------------------
         Read Firestore
      ----------------------------------------------------- */

      if (
        snapshot &&
        typeof snapshot.forEach ===
          'function'
      ) {

        snapshot.forEach(
          (doc) => {

            try {

              const data =
                doc.data() ||
                {};


              productCache[
                doc.id
              ] = data;


              rows.push(
                rowHTML(
                  doc.id,
                  data
                )
              );


            } catch (rowError) {

              console.error(
                '[GetasMart Admin] Gagal membaca row:',
                rowError
              );
            }
          }
        );
      }


      /* -----------------------------------------------------
         Render
      ----------------------------------------------------- */

      if (
        tableBody
      ) {

        tableBody.innerHTML =
          rows.join('');
      }


      if (
        emptyState
      ) {

        emptyState.classList.toggle(
          'hidden',
          rows.length > 0
        );
      }


      if (
        productCountEl
      ) {

        productCountEl.textContent =
          `${rows.length} produk`;
      }


      setLoadError(
        ''
      );


      console.log(
        `[GetasMart Admin] ${rows.length} produk dimuat.`
      );


      return rows;


    } catch (err) {

      console.error(
        '[GetasMart Admin] Gagal memuat produk:',
        err
      );


      /* -----------------------------------------------------
         AUTH / CREDENTIAL EXPIRED
      ----------------------------------------------------- */

      if (
        isAuthError(err)
      ) {

        forceRelogin(
          'Sesi admin telah berakhir. Silakan masukkan password kembali.'
        );


        return [];
      }


      /* -----------------------------------------------------
         Normal error
      ----------------------------------------------------- */

      if (
        tableBody
      ) {

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


      if (
        emptyState
      ) {

        emptyState.classList.add(
          'hidden'
        );
      }


      if (
        productCountEl
      ) {

        productCountEl.textContent =
          '0 produk';
      }


      setLoadError(
        getFriendlyError(err)
      );


      return [];


    } finally {

      isLoadingProducts =
        false;
    }
  }


  /* =========================================================
     EVENT LISTENERS
  ========================================================= */

  function setupEventListeners() {

    /* -------------------------------------------------------
       LOGIN FORM
    ------------------------------------------------------- */

    if (
      loginForm
    ) {

      loginForm.addEventListener(
        'submit',
        handleLogin
      );
    }


    /* -------------------------------------------------------
       LOGOUT
    ------------------------------------------------------- */

    const logoutBtn =
      getElement(
        'logout-btn'
      );


    if (
      logoutBtn
    ) {

      logoutBtn.addEventListener(
        'click',
        logout
      );
    }


    /* -------------------------------------------------------
       ADD PRODUCT
    ------------------------------------------------------- */

    const addProductBtn =
      getElement(
        'add-product-btn'
      );


    if (
      addProductBtn
    ) {

      addProductBtn.addEventListener(
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
       CLOSE MODAL
    ------------------------------------------------------- */

    const modalCloseBtn =
      getElement(
        'modal-close-btn'
      );


    if (
      modalCloseBtn
    ) {

      modalCloseBtn.addEventListener(
        'click',
        closeModal
      );
    }


    /* -------------------------------------------------------
       CANCEL MODAL
    ------------------------------------------------------- */

    const modalCancelBtn =
      getElement(
        'modal-cancel-btn'
      );


    if (
      modalCancelBtn
    ) {

      modalCancelBtn.addEventListener(
        'click',
        closeModal
      );
    }


    /* -------------------------------------------------------
       SAVE FORM
    ------------------------------------------------------- */

    if (
      form
    ) {

      form.addEventListener(
        'submit',
        saveProduct
      );
    }


    /* -------------------------------------------------------
       CLICK OUTSIDE MODAL
    ------------------------------------------------------- */

    if (
      modal
    ) {

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
       PRODUCT TABLE ACTIONS
    ------------------------------------------------------- */

    if (
      tableBody
    ) {

      tableBody.addEventListener(
        'click',
        async (event) => {

          try {

            /* EDIT */

            const editBtn =
              event.target.closest(
                '[data-edit]'
              );


            if (
              editBtn
            ) {

              const id =
                editBtn.dataset.edit;


              if (!id) {
                return;
              }


              const data =
                productCache[id];


              if (!data) {

                setLoadError(
                  'Data produk tidak ditemukan. Silakan muat ulang.'
                );


                return;
              }


              openModal(
                id,
                data
              );


              return;
            }


            /* DELETE */

            const deleteBtn =
              event.target.closest(
                '[data-delete]'
              );


            if (
              deleteBtn
            ) {

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
              '[GetasMart Admin] Product table error:',
              err
            );
          }
        }
      );
    }


    /* -------------------------------------------------------
       ESC = CLOSE MODAL
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


    /*
     * PENTING:
     * loadErrorEl sekarang diinisialisasi SEBELUM
     * loadProductList pernah dipanggil.
     */

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
     APPLICATION INIT
  ========================================================= */

  function init() {

    if (
      initialized
    ) {

      return;
    }


    initialized =
      true;


    try {

      /* -----------------------------------------------------
         STEP 1
         Get all DOM elements
      ----------------------------------------------------- */

      initializeDom();


      /* -----------------------------------------------------
         STEP 2
         Register listeners
      ----------------------------------------------------- */

      setupEventListeners();


      /* -----------------------------------------------------
         STEP 3
         Check session
      ----------------------------------------------------- */

      if (
        isAuthed()
      ) {

        /*
         * Jangan panggil loadProductList sebelum DOM
         * benar-benar siap.
         */

        showAdmin();

      } else {

        showLogin();
      }


    } catch (err) {

      console.error(
        '[GetasMart Admin] FATAL INIT ERROR:',
        err
      );


      try {

        if (
          loginScreen
        ) {

          loginScreen.classList.remove(
            'hidden'
          );
        }


        if (
          adminScreen
        ) {

          adminScreen.classList.add(
            'hidden'
          );
        }


        if (
          loginError
        ) {

          loginError.textContent =
            'Admin gagal diinisialisasi. Cek Console browser.';

          loginError.classList.remove(
            'hidden'
          );
        }

      } catch (_) {
        // Ignore secondary error
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
     DEBUG API
  ========================================================= */

  window.GetasMartAdmin = {

    reloadProducts() {
      return loadProductList(
        true
      );
    },


    getProductCache() {
      return productCache;
    },


    openProductModal(
      id,
      data
    ) {

      return openModal(
        id,
        data
      );
    },


    closeProductModal() {

      return closeModal();
    },


    forceRelogin() {

      return forceRelogin();
    },


    isAuthed() {

      return isAuthed();
    }
  };


})();