/**
 * Admin Panel — CRUD produk GetasMart via Firestore.
 * Password gate di sini hanya penghalang sisi-client (lihat catatan
 * di admin-config.js). Pastikan Firestore Security Rules sudah diatur
 * sesuai firestore.rules sebelum dipakai serius.
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

if (isAuthed()) showAdmin(); else showLogin();

/* ============ CRUD PRODUK ============ */

const tableBody = document.getElementById('product-table-body');
const emptyState = document.getElementById('empty-state');
const productCountEl = document.getElementById('product-count');
const loadErrorEl = document.getElementById('load-error');

const modal = document.getElementById('product-modal');
const modalTitle = document.getElementById('modal-title');
const form = document.getElementById('product-form');
const saveStatus = document.getElementById('save-status');

const FIELDS = [
  'name', 'category', 'categoryLabel', 'price', 'unit', 'badge', 'size', 'desc',
  'imgMain', 'img1', 'img2',
  'spec1Label', 'spec1Value', 'spec1Pct',
  'spec2Label', 'spec2Value', 'spec2Pct',
  'waMessage', 'order'
];

function openModal(id, data) {
  form.reset();
  document.getElementById('f-id').value = id || '';
  modalTitle.textContent = id ? 'Edit Produk' : 'Tambah Produk';
  if (data) {
    FIELDS.forEach(f => {
      const el = document.getElementById('f-' + f);
      if (el) el.value = data[f] ?? '';
    });
    document.getElementById('f-active').checked = data.active !== false;
  } else {
    document.getElementById('f-active').checked = true;
    document.getElementById('f-order').value = 0;
  }
  saveStatus.textContent = '';
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
}

document.getElementById('add-product-btn').addEventListener('click', () => openModal(null, null));
document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('f-id').value;
  const payload = {
    name: document.getElementById('f-name').value.trim(),
    category: document.getElementById('f-category').value,
    categoryLabel: document.getElementById('f-categoryLabel').value.trim(),
    price: Number(document.getElementById('f-price').value) || 0,
    unit: document.getElementById('f-unit').value.trim(),
    badge: document.getElementById('f-badge').value.trim(),
    size: document.getElementById('f-size').value,
    desc: document.getElementById('f-desc').value.trim(),
    imgMain: document.getElementById('f-imgMain').value.trim(),
    img1: document.getElementById('f-img1').value.trim(),
    img2: document.getElementById('f-img2').value.trim(),
    spec1Label: document.getElementById('f-spec1Label').value.trim(),
    spec1Value: document.getElementById('f-spec1Value').value.trim(),
    spec1Pct: document.getElementById('f-spec1Pct').value.trim(),
    spec2Label: document.getElementById('f-spec2Label').value.trim(),
    spec2Value: document.getElementById('f-spec2Value').value.trim(),
    spec2Pct: document.getElementById('f-spec2Pct').value.trim(),
    waMessage: document.getElementById('f-waMessage').value.trim(),
    order: Number(document.getElementById('f-order').value) || 0,
    active: document.getElementById('f-active').checked,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  saveStatus.textContent = 'Menyimpan...';
  try {
    if (id) {
      await window.db.collection('products').doc(id).update(payload);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await window.db.collection('products').add(payload);
    }
    saveStatus.textContent = '';
    closeModal();
    loadProductList();
  } catch (err) {
    console.error(err);
    saveStatus.textContent = 'Gagal menyimpan. Cek konsol.';
  }
});

async function deleteProduct(id, name) {
  if (!confirm(`Hapus produk "${name}"? Aksi ini tidak bisa dibatalkan.`)) return;
  try {
    await window.db.collection('products').doc(id).delete();
    loadProductList();
  } catch (err) {
    console.error(err);
    alert('Gagal menghapus produk. Cek konsol.');
  }
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function rowHTML(id, p) {
  const statusBadge = p.active !== false
    ? '<span class="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">Aktif</span>'
    : '<span class="bg-gray-100 text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full">Nonaktif</span>';
  return `
    <tr>
      <td class="px-4 py-3">
        <div class="flex items-center gap-3">
          <img src="${esc(p.imgMain)}" class="w-10 h-10 rounded-lg object-cover bg-gray-100" onerror="this.style.visibility='hidden'"/>
          <div>
            <p class="font-semibold text-gray-800">${esc(p.name)}</p>
            <p class="text-xs text-gray-400">${esc(p.unit)}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-gray-600">${esc(p.category)}</td>
      <td class="px-4 py-3 text-gray-600">Rp ${Number(p.price || 0).toLocaleString('id-ID')}</td>
      <td class="px-4 py-3 text-gray-600">${esc(p.order ?? 0)}</td>
      <td class="px-4 py-3">${statusBadge}</td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <button data-edit="${esc(id)}" class="text-sm text-[#012d1d] font-semibold hover:underline mr-3">Edit</button>
        <button data-delete="${esc(id)}" data-name="${esc(p.name)}" class="text-sm text-red-500 font-semibold hover:underline">Hapus</button>
      </td>
    </tr>`;
}

let productCache = {};

async function loadProductList() {
  loadErrorEl.classList.add('hidden');
  try {
    const snap = await window.db.collection('products').orderBy('order', 'asc').get();
    productCache = {};
    const rows = [];
    snap.forEach(doc => {
      productCache[doc.id] = doc.data();
      rows.push(rowHTML(doc.id, doc.data()));
    });
    tableBody.innerHTML = rows.join('');
    emptyState.classList.toggle('hidden', rows.length > 0);
    productCountEl.textContent = `${rows.length} produk`;
  } catch (err) {
    console.error(err);
    loadErrorEl.textContent = 'Gagal memuat produk dari Firestore. Cek konfigurasi firebase-config.js dan Firestore Security Rules.';
    loadErrorEl.classList.remove('hidden');
  }
}

tableBody.addEventListener('click', (e) => {
  const editId = e.target.closest('[data-edit]')?.dataset.edit;
  if (editId) return openModal(editId, productCache[editId]);
  const delBtn = e.target.closest('[data-delete]');
  if (delBtn) return deleteProduct(delBtn.dataset.delete, delBtn.dataset.name);
});
