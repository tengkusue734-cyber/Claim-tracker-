/* Halaman utama — senarai tuntutan + tetapan */

let claims = readClaims();
let filter = "all";
let search = "";

/* ---------- Tab ---------- */
function setTab(name) {
  $("#listPanel").hidden = name !== "list";
  $("#settingsPanel").hidden = name !== "settings";
  $$("[data-tab]").forEach(link => link.classList.toggle("active", link.dataset.tab === name));
  if (name === "settings") refreshStorage();
}
$$("[data-tab]").forEach(link => {
  link.addEventListener("click", event => { event.preventDefault(); setTab(link.dataset.tab); });
});

/* ---------- Ringkasan ---------- */
function renderStats() {
  const drafts = claims.filter(claim => claim.status === "draf");
  const waiting = claims.filter(claim => ["dihantar", "lulus"].includes(claim.status));
  const paid = claims.filter(claim => claim.status === "dibayar");
  $("#statAll").textContent = claims.length;
  $("#statAllNote").textContent = `${claims.reduce((sum, claim) => sum + itemsOf(claim).length, 0)} butiran`;
  $("#statDraft").textContent = drafts.length;
  $("#statDraftNote").textContent = drafts.length ? "Belum dihantar" : "Tiada draf";
  $("#statWaiting").textContent = money(waiting.reduce((sum, claim) => sum + claimTotal(claim), 0));
  $("#statWaitingNote").textContent = `${waiting.length} tuntutan`;
  $("#statPaid").textContent = money(paid.reduce((sum, claim) => sum + claimTotal(claim), 0));
  $("#statPaidNote").textContent = `${paid.length} tuntutan`;
}

/* ---------- Senarai ---------- */
function visibleClaims() {
  const needle = search.trim().toLowerCase();
  return claims
    .filter(claim => filter === "all" ? true : claim.status === filter)
    .filter(claim => !needle || [claim.claimNo, claim.staffName, claim.title, claim.department]
      .some(value => String(value || "").toLowerCase().includes(needle)))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || (b.createdAt || 0) - (a.createdAt || 0));
}

function renderList() {
  const list = $("#claimList");
  const items = visibleClaims();
  $("#claimCount").textContent = `${items.length} tuntutan`;
  list.innerHTML = "";

  if (!claims.length) { list.append($("#emptyClaimTemplate").content.cloneNode(true)); return; }
  if (!items.length) { list.innerHTML = `<p class="all-clear">Tiada tuntutan sepadan dengan tapisan atau carian kau.</p>`; return; }

  items.forEach(claim => {
    const total = claimTotal(claim);
    const card = document.createElement("article");
    card.className = `claim-card status-${claim.status || "draf"}`;
    card.innerHTML = `<a class="claim-link" href="claim.html?id=${encodeURIComponent(claim.id)}">
        <div class="claim-top">
          <div class="claim-ident">
            <span class="claim-no"></span>
            <h3></h3>
            <p class="claim-sub"></p>
          </div>
          <div class="claim-amount"><strong>${money(total)}</strong><span class="status-chip">${STATUS_LABEL[claim.status] || "Draf"}</span></div>
        </div>
        <p class="claim-meta"></p>
      </a>
      <div class="claim-actions">
        <button type="button" class="claim-act" data-open="${claim.id}">Buka</button>
        <button type="button" class="claim-act" data-print="${claim.id}">PDF</button>
        <button type="button" class="claim-act" data-word="${claim.id}">Word</button>
      </div>`;
    card.querySelector(".claim-no").textContent = claim.claimNo || "—";
    card.querySelector("h3").textContent = claim.title || "Tuntutan tanpa tajuk";
    card.querySelector(".claim-sub").textContent = [claim.staffName, claim.department].filter(Boolean).join(" · ") || "Tiada nama staf";
    card.querySelector(".claim-meta").textContent =
      `${monthLabel(claim.period)} · ${itemsOf(claim).length} butiran · ${receiptCount(claim)} resit · ${dateLabel(claim.date)}`;
    list.append(card);
  });
}

function renderAll() { claims = readClaims(); renderStats(); renderList(); refreshStorage(); }

/* ---------- Tindakan senarai ---------- */
$("#claimList").addEventListener("click", event => {
  const onboard = event.target.closest("[data-onboard]");
  if (onboard) { createClaim(); return; }
  const open = event.target.closest("[data-open]");
  if (open) { location.href = `claim.html?id=${encodeURIComponent(open.dataset.open)}`; return; }
  const print = event.target.closest("[data-print]");
  if (print) { location.href = `print.html?id=${encodeURIComponent(print.dataset.print)}`; return; }
  const word = event.target.closest("[data-word]");
  if (word) {
    const claim = findClaim(word.dataset.word);
    if (claim) downloadWord(claim);
  }
});

$(".filter-switch").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  filter = button.dataset.filter;
  $$("[data-filter]").forEach(other => other.classList.toggle("active", other === button));
  renderList();
});

$("#searchBox").addEventListener("input", event => { search = event.target.value; renderList(); });

function createClaim() {
  const claim = blankClaim();
  const list = readClaims();
  list.push(claim);
  if (!writeClaims(list)) return;
  location.href = `claim.html?id=${encodeURIComponent(claim.id)}`;
}
$("#newClaim").addEventListener("click", createClaim);

/* ---------- Tetapan ---------- */
const COMPANY_FIELDS = ["company", "companyNo", "companyPhone", "companyEmail", "companyAddress", "note"];
const STAFF_FIELDS = ["staffName", "staffNo", "position", "department", "bankName", "bankAccount", "approver", "prefix"];

function loadSettingsForm() {
  const settings = readSettings();
  [...COMPANY_FIELDS, ...STAFF_FIELDS].forEach(field => {
    const node = $(`#${field}`);
    if (node) node.value = settings[field] || "";
  });
}

$("#companyForm").addEventListener("submit", event => {
  event.preventDefault();
  const settings = readSettings();
  COMPANY_FIELDS.forEach(field => { settings[field] = $(`#${field}`).value.trim(); });
  if (writeSettings(settings)) $("#companyStatus").textContent = "Maklumat syarikat disimpan.";
  refreshStorage();
});

$("#staffForm").addEventListener("submit", event => {
  event.preventDefault();
  const settings = readSettings();
  STAFF_FIELDS.forEach(field => { settings[field] = $(`#${field}`).value.trim(); });
  settings.prefix = (settings.prefix || "CLM").toUpperCase();
  if (writeSettings(settings)) {
    $("#prefix").value = settings.prefix;
    $("#staffStatus").textContent = "Maklumat staf disimpan. Ia akan diisi automatik pada tuntutan baharu.";
  }
  refreshStorage();
});

/* ---------- Sandaran & storan ---------- */
function refreshStorage() {
  const used = storageUsed();
  const limit = 5 * 1024 * 1024;
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const fill = $("#storageFill");
  if (fill) {
    fill.style.width = `${percent}%`;
    fill.className = percent > 85 ? "is-full" : percent > 60 ? "is-warn" : "";
  }
  const note = $("#storageNote");
  if (note) note.textContent = `Storan digunakan: ${sizeLabel(used)} daripada lebih kurang 5 MB (${percent}%). Gambar resit dimampatkan automatik sebelum disimpan.`;
}

$("#exportBackup").addEventListener("click", exportBackup);
$("#importTrigger").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", event => {
  const file = event.target.files && event.target.files[0];
  if (file) importBackup(file, renderAll);
  event.target.value = "";
});

/* ---------- PWA ---------- */
let installEvent = null;
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installEvent = event;
  $("#installButton").hidden = false;
});
$("#installButton").addEventListener("click", async () => {
  if (!installEvent) return;
  installEvent.prompt();
  installEvent = null;
  $("#installButton").hidden = true;
});
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));

/* ---------- Mula ---------- */
loadSettingsForm();
renderAll();
if (location.hash === "#tetapan") setTab("settings");
