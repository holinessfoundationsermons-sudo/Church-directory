import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAAiOuRXLfjcQRV4rA6twknG4ths7K07J4",
  authDomain: "church-directory-a3793.firebaseapp.com",
  projectId: "church-directory-a3793",
  storageBucket: "church-directory-a3793.firebasestorage.app",
  messagingSenderId: "19161243529",
  appId: "1:19161243529:web:2e238ef54b2e0bfedecb58"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginView = document.querySelector("#loginView");
const directoryView = document.querySelector("#directoryView");
const phoneForm = document.querySelector("#phoneForm");
const codeForm = document.querySelector("#codeForm");
const phoneInput = document.querySelector("#phone");
const codeInput = document.querySelector("#code");
const message = document.querySelector("#message");
const search = document.querySelector("#search");
const list = document.querySelector("#directoryList");
const empty = document.querySelector("#empty");

let confirmationResult = null;
let members = [];

function showMessage(text) {
  message.textContent = text;
}

function normalizePhone(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

function setupRecaptcha() {
  if (window.recaptchaVerifier) return window.recaptchaVerifier;

  window.recaptchaVerifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container",
    {
      size: "normal",
      callback: () => showMessage(""),
      "expired-callback": () => {
        showMessage("The security check expired. Please complete it again.");
      }
    }
  );

  return window.recaptchaVerifier;
}

async function renderRecaptcha() {
  try {
    const verifier = setupRecaptcha();
    await verifier.render();
  } catch (error) {
    console.error("reCAPTCHA error:", error);
    showMessage("Unable to load the security check. Please reload the page.");
  }
}

renderRecaptcha();

phoneForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");

  try {
    if (!phoneInput.value.trim()) {
      showMessage("Please enter your phone number.");
      return;
    }

    const phone = normalizePhone(phoneInput.value);
    const verifier = setupRecaptcha();

    confirmationResult = await signInWithPhoneNumber(
      auth,
      phone,
      verifier
    );

    phoneForm.classList.add("hidden");
    codeForm.classList.remove("hidden");
    codeInput.focus();

    showMessage("Verification code sent by text.");
  } catch (error) {
    console.error("Phone sign-in error:", error);
    showMessage(error.message || "Unable to send the verification code.");

    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }

    await renderRecaptcha();
  }
});

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!confirmationResult) return;

  try {
    await confirmationResult.confirm(codeInput.value.trim());
    showMessage("");
  } catch (error) {
    console.error(error);
    showMessage("That code was not accepted. Please try again.");
  }
});

document.querySelector("#changeNumber").addEventListener("click", () => {
  codeForm.classList.add("hidden");
  phoneForm.classList.remove("hidden");
  codeInput.value = "";
  showMessage("");

  if (!window.recaptchaVerifier) {
    renderRecaptcha();
  }
});

document.querySelector("#signOut").addEventListener("click", () => {
  signOut(auth);
});

search.addEventListener("input", render);

async function loadDirectory() {
  list.innerHTML = "<p class='muted'>Loading directory…</p>";

  const snapshot = await getDocs(collection(db, "members"));

  members = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(member => member.name && member.phone)
    .sort((a, b) => a.name.localeCompare(b.name));

  render();
}

function render() {
  const term = search.value.trim().toLowerCase();

  const filtered = members.filter(member =>
    member.name.toLowerCase().includes(term)
  );

  list.innerHTML = "";

  empty.classList.toggle("hidden", filtered.length !== 0);

  for (const member of filtered) {
    const row = document.createElement("div");
    row.className = "member";

    const name = document.createElement("div");
    name.className = "member-name";
    name.textContent = member.name;

    const link = document.createElement("a");
    link.className = "member-phone";
    link.href = `tel:${member.phone}`;
    link.textContent = `📞 ${member.phone}`;

    row.append(name, link);
    list.appendChild(row);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginView.classList.remove("hidden");
    directoryView.classList.add("hidden");
    return;
  }

  loginView.classList.add("hidden");
  directoryView.classList.remove("hidden");

  try {
    await loadDirectory();
  } catch (error) {
    console.error(error);

    directoryView.innerHTML = `
      <div class="card">
        <h1>Access denied</h1>
        <p class="muted">
          Your phone number is not listed as a church member,
          or the directory is not configured correctly.
        </p>
        <button id="retrySignOut">Sign out</button>
      </div>
    `;

    document.querySelector("#retrySignOut").onclick = () => signOut(auth);
  }
});
