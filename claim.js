/* ==========================================================================
   Claim Tracker — fail kongsi (storan, tarikh, duit, gambar, eksport)
   Sistem berasingan: kunci penyimpanan sendiri, tiada kaitan dengan
   Financial Tracker atau Bisnes Tracker.
   ========================================================================== */

const CLAIMS_KEY = "claim-tracker-claims-v1";
const CSETTINGS_KEY = "claim-tracker-settings-v1";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];

const STATUSES = [
  { value: "draf", label: "Draf" },
  { value: "dihantar", label: "Dihantar" },
  { value: "lulus", label: "Diluluskan" },
  { value: "dibayar", label: "Dibayar" },
  { value: "ditolak", label: "Ditolak" }
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map(s => [s.value, s.label]));

const CATEGORIES = [
  "Tambang / perjalanan", "Minyak kenderaan", "Tol & parkir", "Makan & minum",
  "Penginapan", "Bahan & alatan", "Percetakan & alat tulis", "Kos pos & kurier",
  "Telefon & internet", "Yuran & lesen", "Penyelenggaraan", "Lain-lain"
];

/* ---------- Tarikh ---------- */
function parseDate(value) { const [y, m, d] = String(value || "").split("-").map(Number); return new Date(y || 1970, (m || 1) - 1, d || 1); }
function isoDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function today() { return isoDate(new Date()); }
function thisMonth() { return today().slice(0, 7); }
function dateLabel(value) { if (!value) return "—"; const d = parseDate(value); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`; }
function monthLabel(value) {
  if (!value) return "—";
  const [y, m] = String(value).split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}
function newId() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }

/* ---------- Duit ---------- */
function money(value) {
  return new Intl.NumberFormat("ms-MY", { style: "currency", currency: "MYR" }).format(Number(value) || 0);
}
function money2(value) { return (Number(value) || 0).toFixed(2); }

/* Terbilang — tukar nombor kepada perkataan Bahasa Malaysia */
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "lapan", "sembilan", "sepuluh", "sebelas"];
function terbilangKecil(n) {
  n = Math.floor(n);
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) {
    const puluh = Math.floor(n / 10);
    const baki = n % 10;
    return `${SATUAN[puluh]} puluh${baki ? " " + SATUAN[baki] : ""}`;
  }
  if (n < 200) return `seratus${n % 100 ? " " + terbilangKecil(n % 100) : ""}`;
  if (n < 1000) {
    const ratus = Math.floor(n / 100);
    return `${SATUAN[ratus]} ratus${n % 100 ? " " + terbilangKecil(n % 100) : ""}`;
  }
  if (n < 2000) return `seribu${n % 1000 ? " " + terbilangKecil(n % 1000) : ""}`;
  if (n < 1000000) {
    const ribu = Math.floor(n / 1000);
    return `${terbilangKecil(ribu)} ribu${n % 1000 ? " " + terbilangKecil(n % 1000) : ""}`;
  }
  const juta = Math.floor(n / 1000000);
  return `${terbilangKecil(juta)} juta${n % 1000000 ? " " + terbilangKecil(n % 1000000) : ""}`;
}
function terbilang(value) {
  const total = Math.round((Number(value) || 0) * 100);
  const ringgit = Math.floor(total / 100);
  const sen = total % 100;
  let text = ringgit ? terbilangKecil(ringgit) : "sifar";
  if (sen) text += ` dan ${terbilangKecil(sen)} sen`;
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return `Ringgit Malaysia ${text} sahaja`;
}

/* ---------- Storan ---------- */
function readClaims() { try { const v = JSON.parse(localStorage.getItem(CLAIMS_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } }
function writeClaims(list) { return safeSet(CLAIMS_KEY, JSON.stringify(list)); }

const SETTINGS_DEFAULT = {
  company: "", companyNo: "", companyAddress: "", companyPhone: "", companyEmail: "",
  staffName: "", staffNo: "", department: "", position: "",
  bankName: "", bankAccount: "", approver: "", prefix: "CLM", note: ""
};
function readSettings() {
  try { return { ...SETTINGS_DEFAULT, ...(JSON.parse(localStorage.getItem(CSETTINGS_KEY)) || {}) }; }
  catch { return { ...SETTINGS_DEFAULT }; }
}
function writeSettings(value) { return safeSet(CSETTINGS_KEY, JSON.stringify(value)); }

/* Simpan dengan amaran bila storan penuh (gambar resit makan ruang) */
let quotaWarned = false;
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch (error) {
    if (!quotaWarned) {
      quotaWarned = true;
      toast("Storan peranti penuh. Padam tuntutan lama atau buang gambar resit yang tidak perlu, kemudian cuba lagi.", 7000);
    }
    console.error("[ClaimTracker] Gagal simpan:", error);
    return false;
  }
}

function storageUsed() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith("claim-tracker-")) bytes += (localStorage.getItem(key) || "").length * 2;
    }
  } catch { /* abaikan */ }
  return bytes;
}
function sizeLabel(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/* ---------- Model tuntutan ---------- */
function itemsOf(claim) { return Array.isArray(claim && claim.items) ? claim.items : []; }
function claimTotal(claim) { return itemsOf(claim).reduce((sum, item) => sum + (Number(item.amount) || 0), 0); }
function receiptCount(claim) { return itemsOf(claim).filter(item => item.receipt && item.receipt.dataUrl).length; }
function findClaim(id) { return readClaims().find(claim => claim.id === id); }

function nextClaimNo() {
  const settings = readSettings();
  const prefix = (settings.prefix || "CLM").toUpperCase();
  const year = new Date().getFullYear();
  const used = readClaims()
    .map(claim => String(claim.claimNo || ""))
    .filter(no => no.startsWith(`${prefix}-${year}-`))
    .map(no => Number(no.split("-")[2]) || 0);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
}

function blankClaim() {
  const settings = readSettings();
  return {
    id: newId(),
    claimNo: nextClaimNo(),
    title: "",
    period: thisMonth(),
    date: today(),
    staffName: settings.staffName,
    staffNo: settings.staffNo,
    department: settings.department,
    position: settings.position,
    bankName: settings.bankName,
    bankAccount: settings.bankAccount,
    approver: settings.approver,
    status: "draf",
    note: "",
    items: [],
    createdAt: Date.now()
  };
}

/* ---------- Gambar resit ---------- */
function compressImage(file, maxSide = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("Fail bukan gambar"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal baca fail"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Gagal buka gambar"));
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        resolve({
          name: file.name || "resit.jpg",
          dataUrl: canvas.toDataURL("image/jpeg", quality),
          width, height,
          addedAt: Date.now()
        });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(message, duration = 3200) {
  let node = $("#toast");
  if (!node) {
    node = document.createElement("div");
    node.id = "toast";
    node.className = "toast";
    node.setAttribute("role", "status");
    document.body.append(node);
  }
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, duration);
}

/* ---------- Muat turun ---------- */
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function safeName(text) {
  return String(text || "tuntutan").replace(/[^\wÀ-ɏ -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "tuntutan";
}

/* ---------- Borang tuntutan dalam HTML (dikongsi oleh cetak & Word) ---------- */
function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function claimFormHtml(claim, options) {
  const settings = readSettings();
  const withImages = !options || options.withImages !== false;
  const items = itemsOf(claim);
  const total = claimTotal(claim);

  const rows = items.map((item, index) => `
      <tr>
        <td class="c-no">${index + 1}</td>
        <td class="c-date">${escapeHtml(dateLabel(item.date))}</td>
        <td>${escapeHtml(item.category || "—")}</td>
        <td>${escapeHtml(item.description || "")}</td>
        <td class="c-num">${escapeHtml(money2(item.amount))}</td>
        <td class="c-mid">${item.receipt && item.receipt.dataUrl ? "Ada" : "Tiada"}</td>
      </tr>`).join("");

  const emptyRow = items.length ? "" :
    `<tr><td colspan="6" class="c-mid c-muted">Tiada butiran tuntutan direkod.</td></tr>`;

  const receipts = withImages
    ? items.filter(item => item.receipt && item.receipt.dataUrl).map((item, index) => `
        <div class="receipt">
          <p class="receipt-cap"><b>Resit ${index + 1}</b> — ${escapeHtml(dateLabel(item.date))} ·
            ${escapeHtml(item.category || "")} · RM ${escapeHtml(money2(item.amount))}<br />
            ${escapeHtml(item.description || "")}</p>
          <img src="${item.receipt.dataUrl}" alt="Resit ${index + 1}" />
        </div>`).join("")
    : "";

  return `
  <div class="claim-sheet">
    <header class="doc-top">
      <div class="doc-company">
        <h1>${escapeHtml(settings.company || "Nama syarikat belum diisi")}</h1>
        ${settings.companyNo ? `<p class="muted">No. Pendaftaran: ${escapeHtml(settings.companyNo)}</p>` : ""}
        ${settings.companyAddress ? `<p class="muted">${escapeHtml(settings.companyAddress)}</p>` : ""}
        ${(settings.companyPhone || settings.companyEmail) ? `<p class="muted">${escapeHtml([settings.companyPhone, settings.companyEmail].filter(Boolean).join(" · "))}</p>` : ""}
      </div>
      <div class="doc-title">
        <h2>BORANG TUNTUTAN PERBELANJAAN</h2>
        <p class="doc-no">${escapeHtml(claim.claimNo || "—")}</p>
      </div>
    </header>

    <table class="meta-table">
      <tr>
        <th>Nama staf</th><td>${escapeHtml(claim.staffName || "—")}</td>
        <th>No. pekerja</th><td>${escapeHtml(claim.staffNo || "—")}</td>
      </tr>
      <tr>
        <th>Jawatan</th><td>${escapeHtml(claim.position || "—")}</td>
        <th>Bahagian</th><td>${escapeHtml(claim.department || "—")}</td>
      </tr>
      <tr>
        <th>Bulan tuntutan</th><td>${escapeHtml(monthLabel(claim.period))}</td>
        <th>Tarikh tuntutan</th><td>${escapeHtml(dateLabel(claim.date))}</td>
      </tr>
      <tr>
        <th>Perkara</th><td colspan="3">${escapeHtml(claim.title || "—")}</td>
      </tr>
      <tr>
        <th>Bank</th><td>${escapeHtml(claim.bankName || "—")}</td>
        <th>No. akaun</th><td>${escapeHtml(claim.bankAccount || "—")}</td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th class="c-no">#</th><th class="c-date">Tarikh belian</th><th>Perkara</th>
          <th>Keterangan</th><th class="c-num">Jumlah (RM)</th><th class="c-mid">Resit</th>
        </tr>
      </thead>
      <tbody>${rows}${emptyRow}</tbody>
      <tfoot>
        <tr class="grand"><td colspan="4">JUMLAH TUNTUTAN</td><td class="c-num">${escapeHtml(money2(total))}</td><td></td></tr>
      </tfoot>
    </table>

    <p class="words"><b>Terbilang:</b> ${escapeHtml(terbilang(total))}</p>
    ${claim.note ? `<p class="words"><b>Nota:</b> ${escapeHtml(claim.note)}</p>` : ""}

    <table class="sign-table">
      <tr>
        <td>
          <p class="sign-label">Disediakan oleh (Pemohon)</p>
          <div class="sign-line"></div>
          <p class="sign-name">${escapeHtml(claim.staffName || "")}</p>
          <p class="muted">Tarikh: ______________</p>
        </td>
        <td>
          <p class="sign-label">Disemak &amp; diluluskan oleh</p>
          <div class="sign-line"></div>
          <p class="sign-name">${escapeHtml(claim.approver || settings.approver || "")}</p>
          <p class="muted">Tarikh: ______________</p>
        </td>
      </tr>
    </table>

    ${settings.note ? `<p class="foot-note">${escapeHtml(settings.note)}</p>` : ""}
  </div>
  ${receipts ? `<div class="receipts"><h3 class="receipts-title">Lampiran — gambar resit / bukti belian</h3>${receipts}</div>` : ""}`;
}

/* ---------- Gaya dokumen (dikongsi oleh cetak & Word) ---------- */
const DOC_STYLE = `
  body{font-family:"Times New Roman",Georgia,serif; color:#15201b; font-size:11.5pt; line-height:1.45;}
  h1{font-size:15pt; margin:0 0 2pt;}
  h2{font-size:13pt; letter-spacing:1pt; margin:0;}
  h3{font-size:12pt; margin:0 0 8pt;}
  p{margin:0 0 3pt;}
  .muted{color:#55605a; font-size:9.5pt;}
  .doc-top{width:100%; border-bottom:2px solid #0f766e; padding-bottom:8pt; margin-bottom:12pt;}
  .doc-company{display:inline-block; width:58%; vertical-align:top;}
  .doc-title{display:inline-block; width:40%; vertical-align:top; text-align:right;}
  .doc-title h2{color:#0f766e;}
  .doc-no{font-size:11pt; font-weight:bold; margin-top:3pt;}
  table{border-collapse:collapse; width:100%;}
  .meta-table{margin-bottom:12pt;}
  .meta-table th,.meta-table td{border:1px solid #c8d2cd; padding:5pt 7pt; font-size:10pt; text-align:left; vertical-align:top;}
  .meta-table th{background:#eef4f2; width:15%; font-weight:bold;}
  .items-table th,.items-table td{border:1px solid #c8d2cd; padding:6pt 7pt; font-size:10pt; vertical-align:top;}
  .items-table thead th{background:#0f766e; color:#fff; text-align:left; font-size:9.5pt; letter-spacing:.4pt;}
  .items-table .c-no{width:28pt; text-align:center;}
  .items-table .c-date{width:72pt; white-space:nowrap;}
  .items-table .c-num{width:78pt; text-align:right; white-space:nowrap;}
  .items-table .c-mid{width:46pt; text-align:center;}
  .items-table .c-muted{color:#55605a;}
  .items-table tfoot .grand td{background:#eef4f2; font-weight:bold; font-size:11pt;}
  .items-table tfoot .grand td:first-child{text-align:right;}
  .words{margin-top:10pt; font-size:10.5pt;}
  .sign-table{margin-top:26pt;}
  .sign-table td{width:50%; vertical-align:top; padding-right:18pt;}
  .sign-label{font-size:9.5pt; color:#55605a; font-weight:bold;}
  .sign-line{border-bottom:1px solid #55605a; height:42pt;}
  .sign-name{font-weight:bold; font-size:10.5pt; margin-top:4pt;}
  .foot-note{margin-top:18pt; padding-top:8pt; border-top:1px solid #d6ded9; color:#55605a; font-size:9.5pt;}
  .receipts{margin-top:22pt;}
  .receipts-title{color:#0f766e; border-bottom:1px solid #0f766e; padding-bottom:5pt;}
  .receipt{margin-bottom:18pt;}
  .receipt-cap{font-size:9.5pt; color:#35403a; margin-bottom:5pt;}
  .receipt img{max-width:100%; max-height:560pt; border:1px solid #c8d2cd;}
`;

/* ---------- Eksport Word (.doc) ---------- */
function downloadWord(claim) {
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" />
<title>Tuntutan ${escapeHtml(claim.claimNo || "")}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page{size:A4; margin:18mm 16mm;} ${DOC_STYLE}</style>
</head><body>${claimFormHtml(claim)}</body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword;charset=utf-8" });
  downloadBlob(`${safeName(claim.claimNo || "tuntutan")}-${safeName(claim.staffName)}.doc`, blob);
  toast("Fail Word dimuat turun. Buka dengan Microsoft Word atau Google Docs.");
}

/* ---------- Sandaran JSON ---------- */
function exportBackup() {
  const payload = {
    app: "claim-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: readSettings(),
    claims: readClaims()
  };
  downloadBlob(`claim-tracker-sandaran-${today()}.json`, new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  toast("Sandaran disimpan. Simpan fail ini di tempat selamat.");
}

function importBackup(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || data.app !== "claim-tracker" || !Array.isArray(data.claims)) throw new Error("format");
      const existing = readClaims();
      const byId = new Map(existing.map(claim => [claim.id, claim]));
      data.claims.forEach(claim => { if (claim && claim.id) byId.set(claim.id, claim); });
      if (!writeClaims([...byId.values()])) return;
      if (data.settings) writeSettings({ ...readSettings(), ...data.settings });
      toast(`${data.claims.length} tuntutan dimuat naik.`);
      if (onDone) onDone();
    } catch {
      toast("Fail sandaran tidak sah.");
    }
  };
  reader.readAsText(file);
}
