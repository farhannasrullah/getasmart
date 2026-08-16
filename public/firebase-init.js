/**
 * firebase-init.js
 * Firebase + Firestore Offline Persistence
 */

(function () {
  if (!window.firebaseConfig) {
    console.error(
      "[GetasMart] firebase-config.js tidak ditemukan."
    );

    return;
  }

  if (!window.firebase) {
    console.error(
      "[GetasMart] Firebase SDK belum dimuat."
    );

    return;
  }

  /*
   * Initialize Firebase
   */
  firebase.initializeApp(window.firebaseConfig);

  /*
   * Firestore instance
   */
  const db = firebase.firestore();

  /*
   * Simpan promise supaya app.js bisa menunggu
   * konfigurasi persistence selesai.
   */
  window.firestoreReady = db
    .enablePersistence()
    .then(() => {

      console.log(
        "[GetasMart] Firestore offline persistence aktif ✅"
      );

      return true;

    })
    .catch(error => {

      if (error.code === "failed-precondition") {

        console.warn(
          "[GetasMart] Firestore persistence tidak aktif " +
          "karena aplikasi sedang dibuka di lebih dari satu tab."
        );

      } else if (error.code === "unimplemented") {

        console.warn(
          "[GetasMart] Browser tidak mendukung " +
          "Firestore offline persistence."
        );

      } else {

        console.error(
          "[GetasMart] Gagal mengaktifkan Firestore persistence:",
          error
        );
      }

      return false;
    });

  /*
   * Tetap expose db ke seluruh aplikasi
   */
  window.db = db;
})();