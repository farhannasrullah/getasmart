/**
 * KONFIGURASI FIREBASE
 * -----------------------------------------------------------------
 * Ambil dari: Firebase Console > Project Settings (ikon gerigi) >
 * scroll ke "Your apps" > pilih app web (</>) > SDK setup and configuration.
 *
 * Catatan: apiKey di sini BUKAN rahasia — memang didesain publik/client-side.
 * Keamanan data diatur lewat Firestore Security Rules (lihat firestore.rules),
 * bukan dengan menyembunyikan apiKey ini.
 */
window.firebaseConfig = {
  apiKey: "AIzaSyCAi0OzHPynjN5d4RzxJqduJKfemBrQuKs",
  authDomain: "getasmart-136.firebaseapp.com",
  projectId: "getasmart-136",
  storageBucket: "getasmart-136.firebasestorage.app",
  messagingSenderId: "171316019735",
  appId: "1:171316019735:web:183e7e83940a32487d9252"
};
