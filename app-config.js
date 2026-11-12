/* ==========================================================================
   TETAPAN ADMIN — EDIT FAIL INI
   Masukkan emel Google yang KAU guna untuk login sebagai admin/pemilik.
   Sesiapa yang login dengan emel dalam senarai ini akan nampak
   "Papan Admin" dan boleh luluskan / tolak tuntutan semua staf.
   Emel lain = staf biasa (nampak tuntutan sendiri sahaja).

   PENTING: senarai yang SAMA mesti dimasukkan dalam Firestore Rules.
   Lihat fail firestore.rules.
   ========================================================================== */
const ADMIN_EMAILS = [
  "tengkusue734@gmail.com"
];
