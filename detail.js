/* Halaman butiran satu tuntutan */

const claimId = new URLSearchParams(location.search).get("id") || "";
let claim = findClaim(claimId);
let editingItem = null;      // id butiran yang sedang diedit, null = baharu
let pendingReceipt = null;   // { dataUrl, name, width, height } atau null
let confirmDeleteClaim = false;
let confirmDeleteItem = false;

function persist() {
  // Staf tidak boleh kekalkan status keputusan admin selepas mengedit —
  // tuntutan kembali kepada "Dihantar" untuk disemak semula.
  if (!isAdminUser() && ADMIN_STATUSES.includes(claim.status)) {
    claim.status = "dihantar";
    claim.decidedBy = "";
    claim.decidedAt = "";
    toast("Tuntutan dikembalikan kepada status Dihantar untuk semakan semula admin.");
  }
  return saveClaim(claim);
}

/* ---------- Paparan ---------- */
function renderHero() {
  const total = claimTotal(claim);
  const rejected = rejectedTotal(claim);
  $("#claimNoLabel").textContent = claim.claimNo || "TUNTUTAN";
  $("#claimTitleLabel").textContent = claim.title || "Tuntutan tanpa tajuk";
  document.title = `${claim.claimNo || "Tuntutan"} · Claim Tracker`;
  $("#heroStaff").textContent = [claim.staffName, claim.position].filter(Boolean).join(" · ") || "Nama staf belum diisi";
  $("#heroTotal").textContent = money(rejected > 0 ? approvedTotal(claim) : total);
  $("#heroTotal").title = rejected > 0 ? `Jumlah asal ${money(total)}, ditolak ${money(rejected)}` : "";
  $("#heroItems").textContent = itemsOf(claim).length;
  $("#heroReceipts").textContent = receiptCount(claim);
  $("#heroPeriod").textContent = monthLabel(claim.period);
  $("#heroStatus").textContent = STATUS_LABEL[claim.status] || "Draf";
  renderRemark();
  renderDecision();
}

/* ---------- Jalur remark (nampak oleh staf & admin) ---------- */
function renderRemark() {
  const banner = $("#remarkBanner");
  const rejected = rejectedTotal(claim);
  if (claim.status !== "tak-boleh" && !claim.remark && rejected <= 0) { banner.hidden = true; banner.innerHTML = ""; return; }
  banner.hidden = false;
  banner.className = `remark-banner${claim.status === "tak-boleh" ? " is-blocked" : " is-partial"}`;
  const heading = claim.status === "tak-boleh"
    ? "Tuntutan ini tak boleh claim"
    : `${rejectedCount(claim)} butiran tak boleh claim — ${money(rejected)} ditolak`;
  banner.innerHTML = `<b></b><p></p>${claim.decidedBy ? `<span class="remark-by"></span>` : ""}`;
  banner.querySelector("b").textContent = heading;
  banner.querySelector("p").textContent = claim.remark || "Lihat baris yang bertanda dalam senarai perbelanjaan di bawah.";
  if (claim.decidedBy) banner.querySelector(".remark-by").textContent = `Oleh ${claim.decidedBy}${claim.decidedAt ? ` · ${dateLabel(claim.decidedAt)}` : ""}`;
}

/* ---------- Panel keputusan (admin sahaja) ---------- */
function renderDecision() {
  const panel = $("#decisionSection");
  if (!panel) return;
  const admin = isAdminUser();
  panel.hidden = !admin;
  $("#itemAdmin").hidden = !admin;
  if (!admin) return;
  $("#decisionWho").textContent = claim.ownerEmail || claim.staffName || "";
  if (document.activeElement !== $("#decisionRemark")) $("#decisionRemark").value = claim.remark || "";
  document.querySelectorAll("[data-decide]").forEach(button => {
    button.classList.toggle("is-current", button.dataset.decide === claim.status);
  });
}

function decide(status) {
  const user = currentUser();
  claim.status = status;
  claim.remark = $("#decisionRemark").value.trim();
  if (ADMIN_STATUSES.includes(status)) {
    claim.decidedBy = (user && (user.name || user.email)) || "Admin";
    claim.decidedAt = today();
  } else { claim.decidedBy = ""; claim.decidedAt = ""; }
  if (status === "tak-boleh" && !claim.remark) {
    $("#decisionStatus").textContent = "Isi sebab dalam kotak remark dahulu sebelum tandakan tak boleh claim.";
    $("#decisionRemark").focus();
    return;
  }
  if (saveClaim(claim)) {
    $("#decisionStatus").textContent = `Status ditukar kepada "${STATUS_LABEL[status]}".`;
    $("#fStatus").value = claim.status;
    render();
  }
}

function renderItems() {
  const list = $("#itemList");
  const items = itemsOf(claim).slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  $("#itemCount").textContent = `${items.length} butiran`;
  list.innerHTML = "";
  if (!items.length) { list.append($("#emptyItemTemplate").content.cloneNode(true)); return; }

  items.forEach((item, index) => {
    const bad = itemRejected(item);
    const row = document.createElement("article");
    row.className = `item-row${bad ? " is-reject" : ""}`;
    row.innerHTML = `<div class="item-thumb">${item.receipt && item.receipt.dataUrl
        ? `<img src="${item.receipt.dataUrl}" alt="Resit" data-photo="${item.id}" />`
        : `<span class="thumb-empty" title="Tiada gambar resit">—</span>`}</div>
      <div class="item-body">
        <p class="item-head"><b class="item-cat"></b><span class="item-date"></span></p>
        <p class="item-desc"></p>
        ${bad ? `<p class="item-reject"><b>Tak boleh claim</b><span></span></p>` : ""}
      </div>
      <div class="item-end">
        <strong class="item-amount">${money(item.amount)}</strong>
        <span class="row-actions">
          <button type="button" class="edit-button" data-edit-item="${item.id}" aria-label="Edit butiran ${index + 1}">✎</button>
        </span>
      </div>`;
    row.querySelector(".item-cat").textContent = item.category || "Tiada perkara";
    row.querySelector(".item-date").textContent = dateLabel(item.date);
    row.querySelector(".item-desc").textContent = item.description || "Tiada keterangan";
    if (bad) row.querySelector(".item-reject span").textContent = item.itemRemark ? ` — ${item.itemRemark}` : "";
    list.append(row);
  });
}

function render() { renderHero(); renderItems(); }

/* ---------- Borang maklumat ---------- */
const FIELD_MAP = {
  fClaimNo: "claimNo", fDate: "date", fTitle: "title", fPeriod: "period", fStatus: "status",
  fStaffName: "staffName", fStaffNo: "staffNo", fPosition: "position", fDepartment: "department",
  fBankName: "bankName", fBankAccount: "bankAccount", fApprover: "approver", fNote: "note"
};

function fillForm() {
  const allowed = isAdminUser() ? STATUSES : STATUSES.filter(s => STAFF_STATUSES.includes(s.value) || s.value === claim.status);
  $("#fStatus").innerHTML = allowed.map(s => `<option value="${s.value}">${s.label}</option>`).join("");
  Object.entries(FIELD_MAP).forEach(([id, key]) => { $(`#${id}`).value = claim[key] || ""; });
  if (!claim.status) $("#fStatus").value = "draf";
}

function start() {
  fillForm();
  $("#categoryList").innerHTML = CATEGORIES.map(name => `<option value="${name}"></option>`).join("");
  render();

  $("#claimForm").addEventListener("submit", event => {
    event.preventDefault();
    Object.entries(FIELD_MAP).forEach(([id, key]) => { claim[key] = $(`#${id}`).value.trim ? $(`#${id}`).value.trim() : $(`#${id}`).value; });
    if (persist()) $("#formStatus").textContent = "Maklumat tuntutan disimpan.";
    render();
  });

  $("#toggleDetails").addEventListener("click", () => {
    const form = $("#claimForm");
    form.hidden = !form.hidden;
    $("#toggleDetails").textContent = form.hidden ? "Tunjuk" : "Sembunyi";
  });

  $("#addItem").addEventListener("click", () => openItemDialog(null));
  $("#itemList").addEventListener("click", event => {
    const photo = event.target.closest("[data-photo]");
    if (photo) {
      const item = itemsOf(claim).find(entry => entry.id === photo.dataset.photo);
      if (item && item.receipt) {
        $("#photoTitle").textContent = `${item.category || "Resit"} · ${dateLabel(item.date)}`;
        $("#photoFull").src = item.receipt.dataUrl;
        $("#photoDialog").showModal();
      }
      return;
    }
    const edit = event.target.closest("[data-edit-item]");
    if (edit) openItemDialog(edit.dataset.editItem);
  });
  $("#closePhoto").addEventListener("click", () => $("#photoDialog").close());

  $("#itemForm").addEventListener("submit", saveItem);
  $("#closeItem").addEventListener("click", () => $("#itemDialog").close());
  $("#deleteItem").addEventListener("click", deleteItem);
  $("#pickReceipt").addEventListener("click", () => $("#receiptFile").click());
  $("#receiptFile").addEventListener("change", handleReceipt);
  $("#dropReceipt").addEventListener("click", () => { pendingReceipt = null; paintReceipt(); });

  $("#iReject").addEventListener("change", () => {
    $("#iRejectField").hidden = !$("#iReject").checked;
    if ($("#iReject").checked) $("#iRemark").focus();
  });
  $(".decision-buttons").addEventListener("click", event => {
    const button = event.target.closest("[data-decide]");
    if (button) decide(button.dataset.decide);
  });
  $("#saveRemark").addEventListener("click", () => {
    claim.remark = $("#decisionRemark").value.trim();
    if (saveClaim(claim)) { $("#decisionStatus").textContent = "Remark disimpan."; render(); }
  });

  /* Muat semula bila data cloud masuk, dan ambil gambar resit dari cloud */
  document.addEventListener("claim-cloud-data", () => {
    const fresh = findClaim(claimId);
    if (fresh) { claim = fresh; fillForm(); render(); }
  });
  document.addEventListener("claim-cloud-ready", () => {
    fillForm(); render();
    if (window.ctCloud && window.ctCloud.user) window.ctCloud.receipts(claimId);
  });
  if (window.ctCloud && window.ctCloud.user) window.ctCloud.receipts(claimId);

  $("#printClaim").addEventListener("click", () => { location.href = `print.html?id=${encodeURIComponent(claim.id)}`; });
  $("#wordClaim").addEventListener("click", () => downloadWord(claim));

  $("#deleteClaim").addEventListener("click", () => {
    if (!confirmDeleteClaim) {
      confirmDeleteClaim = true;
      $("#deleteClaim").textContent = "Tekan sekali lagi untuk padam";
      return;
    }
    deleteClaimById(claim.id);
    location.href = "index.html";
  });
}

/* ---------- Dialog butiran ---------- */
function openItemDialog(itemId) {
  editingItem = itemId || null;
  confirmDeleteItem = false;
  const item = itemId ? itemsOf(claim).find(entry => entry.id === itemId) : null;
  $("#itemDialogTitle").textContent = item ? "Edit butiran" : "Tambah butiran";
  $("#iDate").value = item ? item.date || today() : today();
  $("#iAmount").value = item ? (item.amount != null ? item.amount : "") : "";
  $("#iCategory").value = item ? item.category || "" : "";
  $("#iDescription").value = item ? item.description || "" : "";
  pendingReceipt = item && item.receipt ? { ...item.receipt } : null;
  paintReceipt();
  $("#itemAdmin").hidden = !isAdminUser();
  $("#iReject").checked = !!(item && item.claimable === false);
  $("#iRemark").value = item ? item.itemRemark || "" : "";
  $("#iRejectField").hidden = !$("#iReject").checked;
  $("#deleteItem").hidden = !item;
  $("#deleteItem").textContent = "Padam butiran ini";
  $("#itemDialog").showModal();
  $("#iDate").focus();
}

function paintReceipt() {
  const box = $("#receiptPreview");
  if (pendingReceipt && pendingReceipt.dataUrl) {
    box.innerHTML = `<img src="${pendingReceipt.dataUrl}" alt="Pratonton resit" />`;
    $("#dropReceipt").hidden = false;
    $("#pickReceipt").textContent = "Tukar gambar";
  } else {
    box.innerHTML = `<p class="receipt-empty">Belum ada gambar</p>`;
    $("#dropReceipt").hidden = true;
    $("#pickReceipt").textContent = "Pilih / ambil gambar";
  }
}

async function handleReceipt(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  $("#pickReceipt").disabled = true;
  $("#pickReceipt").textContent = "Memproses…";
  try {
    pendingReceipt = await compressImage(file);
    paintReceipt();
  } catch (error) {
    console.error(error);
    toast("Gambar tidak boleh dibaca. Cuba gambar lain.");
    paintReceipt();
  } finally {
    $("#pickReceipt").disabled = false;
  }
}

function saveItem(event) {
  event.preventDefault();
  const amount = Number($("#iAmount").value);
  const date = $("#iDate").value;
  if (!date || !Number.isFinite(amount)) return;
  const payload = {
    date,
    amount,
    category: $("#iCategory").value.trim(),
    description: $("#iDescription").value.trim(),
    receipt: pendingReceipt || null
  };
  if (isAdminUser()) {
    payload.claimable = !$("#iReject").checked;
    payload.itemRemark = $("#iReject").checked ? $("#iRemark").value.trim() : "";
  }
  if (!Array.isArray(claim.items)) claim.items = [];
  if (editingItem) {
    const item = claim.items.find(entry => entry.id === editingItem);
    if (item) Object.assign(item, payload);
  } else {
    claim.items.push({ id: newId(), ...payload, createdAt: Date.now() });
  }
  if (!persist()) return;
  editingItem = null;
  pendingReceipt = null;
  $("#itemDialog").close();
  render();
}

function deleteItem() {
  if (!editingItem) return;
  if (!confirmDeleteItem) {
    confirmDeleteItem = true;
    $("#deleteItem").textContent = "Tekan sekali lagi untuk padam";
    return;
  }
  claim.items = itemsOf(claim).filter(entry => entry.id !== editingItem);
  persist();
  editingItem = null;
  confirmDeleteItem = false;
  $("#itemDialog").close();
  render();
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));

/* ---------- Mula (dipanggil terakhir supaya semua const sudah siap) ---------- */
if (!claim) {
  document.querySelector(".app-shell").innerHTML =
    '<header class="topbar"><div><p class="eyebrow">CLAIM TRACKER</p><h1>Tuntutan tidak dijumpai</h1></div>' +
    '<a class="icon-button nav-home" href="index.html" aria-label="Kembali">←</a></header>' +
    '<p class="all-clear">Rekod ini mungkin sudah dipadam. <a href="index.html">Kembali ke senarai tuntutan</a>.</p>';
} else {
  start();
}
