/**
 * Admin Panel — CRUD produk GetasMart via Firestore.
 * Sinkron dengan struktur data yang dipakai app.js.
 */

const AUTH_KEY = 'getasmart_admin_auth';

const loginScreen = document.getElementById('login-screen');
const adminScreen = document.getElementById('admin-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

function isAuthed() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

function showAdmin() {
  loginScreen.classList.add('hidden');
  adminScreen.classList.remove('hidden');
  loadProductList();
}

function showLogin() {
  adminScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const val = document.getElementById('login-password').value;

  if (val === window.ADMIN_PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    loginError.classList.add('hidden');
    showAdmin();
  } else {
    loginError.classList.remove('hidden');
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_KEY);
  showLogin();
});

if (isAuthed()) {
  showAdmin();
} else {
  showLogin();
}


/* =========================================================
   CRUD PRODUK
========================================================= */

const tableBody = document.getElementById('product-table-body');
const emptyState = document.getElementById('empty-state');
const productCountEl = document.getElementById('product-count');
const loadErrorEl = document.getElementById('load-error');

const modal = document.getElementById('product-modal');
const modalTitle = document.getElementById('modal-title');
const form = document.getElementById('product-form');
const saveStatus = document.getElementById('save-status');


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


function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}


function withFallback(value, fallback) {
  return value ? value : fallback;
}


function normalizePct(value, fallback) {
  if (!value) return fallback;
  return value.endsWith('%') ? value : `${value}%`;
}


/* =========================================================
   MODAL
========================================================= */

function openModal(id, data) {
  form.reset();

  document.getElementById('f-id').value = id || '';

  modalTitle.textContent = id
    ? 'Edit Produk'
    : 'Tambah Produk';

  if (data) {

    FIELDS.forEach((f) => {

      const el = document.getElementById('f-' + f);

      if (el) {
        el.value = data[f] ?? '';
      }

    });

    const activeEl =
      document.getElementById('f-active');

    if (activeEl) {
      activeEl.checked = data.active !== false;
    }

    const featuredEl =
      document.getElementById('f-featured');

    if (featuredEl) {
      featuredEl.checked = data.featured === true;
    }

  } else {

    const activeEl =
      document.getElementById('f-active');

    if (activeEl) {
      activeEl.checked = true;
    }

    const featuredEl =
      document.getElementById('f-featured');

    if (featuredEl) {
      featuredEl.checked = false;
    }

    const orderEl =
      document.getElementById('f-order');

    if (orderEl) {
      orderEl.value = 0;
    }
  }

  saveStatus.textContent = '';

  modal.classList.remove('hidden');
}


function closeModal() {
  modal.classList.add('hidden');
}


document
  .getElementById('add-product-btn')
  .addEventListener(
    'click',
    () => openModal(null, null)
  );


document
  .getElementById('modal-close-btn')
  .addEventListener(
    'click',
    closeModal
  );


document
  .getElementById('modal-cancel-btn')
  .addEventListener(
    'click',
    closeModal
  );


/* =========================================================
   SIMPAN PRODUK
========================================================= */

form.addEventListener('submit', async (e) => {

  e.preventDefault();

  const id =
    document.getElementById('f-id').value;

  const name = val('f-name');

  const category =
    document.getElementById('f-category').value ||
    'lainnya';

  const imgMain =
    val('f-imgMain');


  const shortDesc =
    withFallback(
      val('f-shortDesc'),
      val('f-desc')
    );


  const payload = {

    name,

    category,

    categoryLabel:
      withFallback(
        val('f-categoryLabel'),
        CATEGORY_LABELS[category] || category
      ),

    price:
      Number(
        document.getElementById('f-price').value
      ) || 0,

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
      document.getElementById('f-size').value ||
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
      Number(
        document.getElementById('f-order').value
      ) || 0,

    active:
      document.getElementById('f-active').checked,

    featured:
      document.getElementById('f-featured')?.checked === true,

    updatedAt:
      firebase.firestore.FieldValue.serverTimestamp()
  };


  saveStatus.textContent =
    'Menyimpan...';


  try {

    if (id) {

      await window.db
        .collection('products')
        .doc(id)
        .update(payload);

    } else {

      payload.createdAt =
        firebase.firestore.FieldValue
          .serverTimestamp();

      await window.db
        .collection('products')
        .add(payload);
    }


    saveStatus.textContent = '';

    closeModal();

    loadProductList();


  } catch (err) {

    console.error(
      '[GetasMart Admin] Gagal menyimpan produk:',
      err
    );

    saveStatus.textContent =
      'Gagal menyimpan. Cek konsol.';
  }

});


/* =========================================================
   HAPUS PRODUK
========================================================= */

async function deleteProduct(id, name) {

  const confirmed =
    confirm(
      `Hapus produk "${name}"? Aksi ini tidak bisa dibatalkan.`
    );

  if (!confirmed) return;


  try {

    await window.db
      .collection('products')
      .doc(id)
      .delete();

    loadProductList();

  } catch (err) {

    console.error(
      '[GetasMart Admin] Gagal menghapus:',
      err
    );

    alert(
      'Gagal menghapus produk. Cek konsol.'
    );
  }
}


/* =========================================================
   ESCAPE HTML
========================================================= */

const ESCAPE_MAP = {

  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'

};

const ESCAPE_RE =
  /[&<>"']/g;


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
   TABLE ROW
========================================================= */

function rowHTML(id, p) {

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
              ${esc(p.name)}
            </p>

            <div
              class="flex flex-wrap items-center gap-1.5 mt-1">

              <span class="text-xs text-gray-400">
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


      <td class="px-4 py-3 text-gray-600">

        ${esc(
          p.categoryLabel ||
          CATEGORY_LABELS[p.category] ||
          p.category ||
          '-'
        )}

      </td>


      <td class="px-4 py-3 text-gray-600">

        Rp ${
          Number(
            p.price || 0
          ).toLocaleString('id-ID')
        }

      </td>


      <td class="px-4 py-3 text-gray-600">

        ${esc(p.order ?? 0)}

      </td>


      <td class="px-4 py-3">

        ${statusBadge}

      </td>


      <td
        class="px-4 py-3 text-right whitespace-nowrap">

        <button
          data-edit="${esc(id)}"
          class="text-sm text-[#012d1d]
          font-semibold hover:underline mr-3">
          Edit
        </button>

        <button
          data-delete="${esc(id)}"
          data-name="${esc(p.name)}"
          class="text-sm text-red-500
          font-semibold hover:underline">
          Hapus
        </button>

      </td>

    </tr>

  `;
}


let productCache = {};


/* =========================================================
   LOAD PRODUK
========================================================= */

async function loadProductList() {

  loadErrorEl.classList.add('hidden');


  try {

    const snap =
      await window.db
        .collection('products')
        .orderBy('order', 'asc')
        .get();


    productCache = {};

    const rows = [];


    snap.forEach((doc) => {

      const data = doc.data();

      productCache[doc.id] =
        data;

      rows.push(
        rowHTML(
          doc.id,
          data
        )
      );

    });


    tableBody.innerHTML =
      rows.join('');


    emptyState.classList.toggle(
      'hidden',
      rows.length > 0
    );


    productCountEl.textContent =
      `${rows.length} produk`;


  } catch (err) {

    console.error(
      '[GetasMart Admin] Gagal memuat produk:',
      err
    );


    loadErrorEl.textContent =
      'Gagal memuat produk dari Firestore. Cek konfigurasi Firebase dan Firestore Security Rules.';


    loadErrorEl.classList.remove(
      'hidden'
    );
  }
}


/* =========================================================
   ACTION EDIT / DELETE
========================================================= */

tableBody.addEventListener(
  'click',
  (e) => {

    const editBtn =
      e.target.closest('[data-edit]');


    if (editBtn) {

      const id =
        editBtn.dataset.edit;

      return openModal(
        id,
        productCache[id]
      );
    }


    const deleteBtn =
      e.target.closest(
        '[data-delete]'
      );


    if (deleteBtn) {

      return deleteProduct(
        deleteBtn.dataset.delete,
        deleteBtn.dataset.name
      );
    }

  }
);