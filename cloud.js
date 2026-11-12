/* ==========================================================================
   Cloud sync untuk Claim Tracker
   - Login Google
   - Tuntutan disimpan dalam Firestore: /claims/{id}
   - Gambar resit disimpan berasingan: /claims/{id}/receipts/{itemId}
     (supaya dokumen tuntutan kekal kecil dan laju)
   - Staf nampak tuntutan sendiri sahaja. Admin nampak semua.
   ========================================================================== */

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, deleteDoc, getDoc, getDocs, collection, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const MIRROR_KEY = "claim-tracker-claims-v1";
const PROFILE_KEY = "claim-tracker-profile-v1";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const provider = new GoogleAuthProvider();

let currentUser = null;
let isAdmin = false;
let unsubscribe = null;

/* ---------- Papan status login ---------- */
const bar = document.createElement("div");
bar.className = "auth-bar";
bar.innerHTML = `
  <div class="auth-info"><span class="auth-dot"></span><span id="ctStatus">Menyediakan sync…</span></div>
  <button type="button" id="ctAuthButton" class="auth-button">Login Google</button>`;
const navEl = document.querySelector(".page-nav");
if (navEl) navEl.insertAdjacentElement("afterend", bar);
else document.querySelector(".app-shell")?.querySelector(".topbar")?.insertAdjacentElement("afterend", bar);

const statusText = bar.querySelector("#ctStatus");
const authButton = bar.querySelector("#ctAuthButton");
function setStatus(message, state = "offline") { statusText.textContent = message; bar.dataset.state = state; }

authButton.addEventListener("click", async () => {
  if (currentUser) { await signOut(auth); return; }
  authButton.disabled = true;
  setStatus("Membuka login Google…", "busy");
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithPopup(auth, provider);
  } catch (error) {
    const popupIssue = ["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment"];
    if (popupIssue.includes(error.code)) {
      try { await signInWithRedirect(auth, provider); return; } catch (redirectError) { showAuthError(redirectError); }
    } else { showAuthError(error); }
  } finally { authButton.disabled = false; }
});

function showAuthError(error) {
  console.error("[ClaimTracker] Login gagal:", error);
  const hint = error.code === "auth/unauthorized-domain"
    ? "Domain ini belum dibenarkan dalam Firebase Authentication."
    : error.code === "auth/operation-not-allowed"
      ? "Google Sign-in belum dihidupkan dalam Firebase Console."
      : error.code || "Ralat tidak diketahui";
  setStatus(`Login gagal — ${hint}`, "error");
}
getRedirectResult(auth).catch(showAuthError);

/* ---------- Cermin tempatan ---------- */
function readMirror() { try { const v = JSON.parse(localStorage.getItem(MIRROR_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } }
function writeMirror(list) { try { localStorage.setItem(MIRROR_KEY, JSON.stringify(list)); } catch (e) { console.error(e); } }
function announce() { document.dispatchEvent(new CustomEvent("claim-cloud-data")); }

/* ---------- Aliran auth ---------- */
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  if (!user) {
    isAdmin = false;
    publish();
    authButton.textContent = "Login Google";
    setStatus("Belum login — tekan Login Google untuk sync", "offline");
    document.body.dataset.ctRole = "guest";
    announce();
    return;
  }

  isAdmin = Array.isArray(window.ADMIN_EMAILS)
    ? window.ADMIN_EMAILS.map(e => String(e).toLowerCase()).includes(String(user.email || "").toLowerCase())
    : (typeof ADMIN_EMAILS !== "undefined" && ADMIN_EMAILS.map(e => String(e).toLowerCase()).includes(String(user.email || "").toLowerCase()));

  authButton.textContent = "Logout";
  document.body.dataset.ctRole = isAdmin ? "admin" : "staff";
  publish();
  setStatus(`${isAdmin ? "Admin" : "Staf"} · ${user.email}`, "busy");

  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ uid: user.uid, email: user.email, name: user.displayName || "", isAdmin })); } catch { /* abaikan */ }
  await saveProfile(user);
  await flushQueue();
  watchClaims(user);
});

async function saveProfile(user) {
  try {
    const settings = JSON.parse(localStorage.getItem("claim-tracker-settings-v1") || "{}");
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email || "",
      name: settings.staffName || user.displayName || "",
      staffNo: settings.staffNo || "",
      department: settings.department || "",
      position: settings.position || "",
      updatedAt: Date.now()
    }, { merge: true });
  } catch (error) { console.error("[ClaimTracker] Gagal simpan profil:", error); }
}

/* ---------- Dengar tuntutan ---------- */
function watchClaims(user) {
  const ref = isAdmin
    ? collection(db, "claims")
    : query(collection(db, "claims"), where("ownerUid", "==", user.uid));

  unsubscribe = onSnapshot(ref, snapshot => {
    const remote = snapshot.docs.map(d => d.data()).filter(Boolean);
    const local = readMirror();
    const localById = new Map(local.map(c => [c.id, c]));
    const merged = remote.map(claim => {
      const cached = localById.get(claim.id);
      // kekalkan gambar resit yang sudah ada pada peranti ini
      if (cached) {
        const cachedItems = new Map((cached.items || []).map(i => [i.id, i]));
        claim.items = (claim.items || []).map(item => {
          const old = cachedItems.get(item.id);
          return old && old.receipt ? { ...item, receipt: old.receipt } : item;
        });
      }
      return claim;
    });
    // simpan draf tempatan yang belum sempat naik
    local.forEach(claim => { if (!merged.some(c => c.id === claim.id) && claim.pendingSync) merged.push(claim); });
    writeMirror(merged);
    setStatus(`Disegerakkan · ${isAdmin ? "Admin" : "Staf"} · ${user.email}`, "online");
    announce();
  }, error => {
    console.error("[ClaimTracker] Sync gagal:", error);
    setStatus(`Sync gagal — ${error.code || "ralat"}`, "error");
  });
}

/* ---------- Tulis ke cloud ---------- */
function stripReceipts(claim) {
  const copy = JSON.parse(JSON.stringify(claim));
  delete copy.pendingSync;
  copy.items = (copy.items || []).map(item => {
    const { receipt, ...rest } = item;
    return { ...rest, hasReceipt: !!(receipt && receipt.dataUrl) };
  });
  copy.total = (copy.items || []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  copy.updatedAt = Date.now();
  return copy;
}

async function pushClaim(claim) {
  if (!currentUser) return false;
  const payload = stripReceipts(claim);
  if (!payload.ownerUid) payload.ownerUid = currentUser.uid;
  if (!payload.ownerEmail) payload.ownerEmail = currentUser.email || "";
  try {
    await setDoc(doc(db, "claims", claim.id), payload, { merge: true });
    for (const item of (claim.items || [])) {
      const ref = doc(db, "claims", claim.id, "receipts", item.id);
      if (item.receipt && item.receipt.dataUrl) {
        await setDoc(ref, { dataUrl: item.receipt.dataUrl, name: item.receipt.name || "", width: item.receipt.width || 0, height: item.receipt.height || 0, updatedAt: Date.now() });
      }
    }
    return true;
  } catch (error) {
    console.error("[ClaimTracker] Gagal hantar tuntutan:", error);
    setStatus(`Gagal simpan ke cloud — ${error.code || "ralat"}`, "error");
    return false;
  }
}

async function removeClaim(claimId) {
  if (!currentUser) return false;
  try {
    const snapshot = await getDocs(collection(db, "claims", claimId, "receipts"));
    await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "claims", claimId));
    return true;
  } catch (error) { console.error("[ClaimTracker] Gagal padam:", error); return false; }
}

/* Muat turun gambar resit untuk satu tuntutan (dipanggil pada halaman butiran/cetak) */
async function fetchReceipts(claimId) {
  if (!currentUser) return false;
  try {
    const snapshot = await getDocs(collection(db, "claims", claimId, "receipts"));
    if (snapshot.empty) return false;
    const byItem = new Map(snapshot.docs.map(d => [d.id, d.data()]));
    const list = readMirror();
    const claim = list.find(c => c.id === claimId);
    if (!claim) return false;
    let changed = false;
    claim.items = (claim.items || []).map(item => {
      const found = byItem.get(item.id);
      if (found && found.dataUrl && (!item.receipt || !item.receipt.dataUrl)) { changed = true; return { ...item, receipt: found }; }
      return item;
    });
    if (changed) { writeMirror(list); announce(); }
    return changed;
  } catch (error) { console.error("[ClaimTracker] Gagal ambil resit:", error); return false; }
}

/* ---------- Barisan menunggu (bila belum login / belum siap) ---------- */
async function flushQueue() {
  const queue = window.__ctQueue || [];
  window.__ctQueue = [];
  for (const job of queue) {
    if (job.type === "save") await pushClaim(job.claim);
    if (job.type === "delete") await removeClaim(job.id);
  }
}

function publish() {
  window.ctCloud = {
    ready: true,
    user: currentUser ? { uid: currentUser.uid, email: currentUser.email, name: currentUser.displayName } : null,
    isAdmin,
    save: claim => pushClaim(claim),
    remove: id => removeClaim(id),
    receipts: id => fetchReceipts(id),
    flush: flushQueue
  };
  document.dispatchEvent(new CustomEvent("claim-cloud-ready"));
}
publish();
flushQueue();
