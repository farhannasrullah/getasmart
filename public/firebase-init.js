/**
 * Inisialisasi Firebase (compat SDK, tanpa build step).
 * Harus dimuat SETELAH firebase-app-compat.js, firebase-firestore-compat.js,
 * dan firebase-config.js.
 */
(function () {
  if (!window.firebaseConfig || window.firebaseConfig.apiKey === "GANTI_DENGAN_API_KEY") {
    console.error(
      "[GetasMart] firebase-config.js belum diisi kredensial asli. " +
      "Buka public/firebase-config.js dan isi sesuai project Firebase kamu."
    );
  }
  firebase.initializeApp(window.firebaseConfig);
  window.db = firebase.firestore();
})();
