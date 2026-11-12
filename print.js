/* Halaman borang boleh cetak */
const printId = new URLSearchParams(location.search).get("id") || "";
const printClaim = findClaim(printId);

function paint() {
  const withImages = $("#withImages").checked;
  $("#docRoot").innerHTML = claimFormHtml(printClaim, { withImages });
}

if (!printClaim) {
  document.body.innerHTML = '<div class="doc-toolbar"><a class="toolbar-back" href="index.html">← Kembali</a></div>' +
    '<p class="doc-tip">Tuntutan ini tidak dijumpai. Ia mungkin sudah dipadam.</p>';
} else {
  document.title = `${printClaim.claimNo || "Tuntutan"} · ${printClaim.staffName || "Claim Tracker"}`;
  $("#backLink").href = `claim.html?id=${encodeURIComponent(printClaim.id)}`;
  paint();
  $("#withImages").addEventListener("change", paint);
  document.addEventListener("claim-cloud-data", () => { const fresh = findClaim(printId); if (fresh) { Object.assign(printClaim, fresh); paint(); } });
  document.addEventListener("claim-cloud-ready", () => { if (window.ctCloud && window.ctCloud.user) window.ctCloud.receipts(printId); });
  if (window.ctCloud && window.ctCloud.user) window.ctCloud.receipts(printId);
  $("#printButton").addEventListener("click", () => window.print());
  $("#wordButton").addEventListener("click", () => downloadWord(printClaim));
}
