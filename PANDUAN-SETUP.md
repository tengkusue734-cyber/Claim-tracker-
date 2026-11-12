# Claim Tracker — panduan pasang sync staf & admin

## 1. Salin tetapan Firebase

Buka repo `financial-tracker` kau di GitHub → fail **`firebase-config.js`** → copy semua isinya.

Dalam repo Claim Tracker, buka **`firebase-config.js`** → padam semua → tampal yang kau copy tadi → Commit.

Projek Firebase yang sama. Tak perlu buat projek baharu.

## 2. Tetapkan siapa admin

Buka fail **`app-config.js`**. Tukar emel kepada emel Google yang KAU guna untuk login:

```js
const ADMIN_EMAILS = [
  "emel-kau@gmail.com"
];
```

Boleh letak lebih daripada satu emel (pisah dengan koma) kalau ada lebih seorang admin.

## 3. Pasang Firestore Rules

Firebase Console → **Firestore Database** → tab **Rules**.

Buka fail `firestore.rules` dalam repo ini, copy semua, tampal menggantikan rules sedia ada, tekan **Publish**.

PENTING: dalam rules itu ada senarai emel admin juga — pastikan ia SAMA dengan `app-config.js`.

> Nota: rules ini hanya mengandungi `/users` dan `/claims`. Kalau Financial Tracker & Bisnes Tracker guna projek Firestore yang sama, JANGAN padam blok rules sedia ada mereka — tampal blok `/users` dan `/claims` ini ke dalam rules yang ada, di dalam `match /databases/{database}/documents { ... }` yang sama.

## 4. Benarkan domain

Firebase Console → **Authentication** → **Settings** → **Authorized domains** → **Add domain**:

```
tengkusue734-cyber.github.io
```

Kalau domain ini sudah ada (sebab Financial Tracker guna domain sama), tak perlu tambah lagi.

## 5. Logo syarikat

Logo **Speedofis 99 Academy** sudah dibenamkan dan akan terus muncul pada borang PDF dan fail Word — tiada apa perlu dibuat.

Nak tukar: **Tetapan → Logo syarikat → Tukar logo**. Nak buang: tekan **Tanpa logo**. Nak kembali kepada yang asal: **Guna logo lalai**.

Logo disimpan pada peranti masing-masing, jadi setiap staf perlu set sekali kalau mereka mahu logo pada borang mereka. (Fail `logo.png` dalam repo ialah salinan yang sama.)

## 6. Staf guna

Hantar link yang sama kepada staf. Mereka:
1. Buka link → tekan **Login Google**
2. Pergi **Tetapan** → isi nama, no. pekerja, jawatan, bahagian, bank
3. Buat tuntutan, masuk butiran + gambar resit
4. Tukar status kepada **Dihantar**

Staf hanya nampak tuntutan sendiri.

## 7. Kau (admin) monitor

Login dengan emel admin. Kau akan nampak:
- **Papan Admin** — semua tuntutan semua staf
- Penapis ikut staf
- Buka mana-mana tuntutan → panel **Keputusan Admin**:
  - **Luluskan** / **Tandakan dibayar** / **Tak boleh claim** / **Kembalikan untuk semakan**
  - Kotak **remark** untuk tulis sebab
  - Tekan **✎** pada baris tertentu untuk tolak butiran itu sahaja + sebabnya

Jumlah diluluskan dikira automatik selepas tolak.
