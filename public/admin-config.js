/**
 * PASSWORD ADMIN PANEL
 * -----------------------------------------------------------------
 * PENTING: ini gerbang password sisi-client (client-side gate), BUKAN
 * pengamanan database. Siapa pun yang tahu URL Firestore API tetap bisa
 * baca/tulis langsung kalau Firestore Rules-nya tidak dibatasi.
 * Cukup untuk pemakaian internal tim (mencegah orang awam iseng),
 * TIDAK cukup kalau data produksi sensitif/publik luas.
 * Kalau nanti butuh lebih aman, upgrade ke Firebase Auth (email+password).
 */
window.ADMIN_PASSWORD = "getas136";
