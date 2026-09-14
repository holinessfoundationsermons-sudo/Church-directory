import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAAiOuRXLfjcQRV4rA6twknG4ths7K07J4",
  authDomain: "church-directory-a3793.firebaseapp.com",
  projectId: "church-directory-a3793",
  storageBucket: "church-directory-a3793.firebasestorage.app",
  messagingSenderId: "19161243529",
  appId: "1:19161243529:web:2e238ef54b2e0bfedecb58"
};

const ADMIN_PHONE = "+18595443280";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

await setPersistence(auth, browserLocalPersistence);

const loginView = document.querySelector("#loginView");
const registerView = document.querySelector("#registerView");
const directoryView = document.querySelector("#directoryView");

const phoneForm = document.querySelector("#phoneForm");
const codeForm = document.querySelector("#codeForm");
const registerForm = document.querySelector("#registerForm");

const phoneInput = document.querySelector("#phone");
const codeInput = document.querySelector("#code");

const registerName = document.querySelector("#registerName");
const registerPhone = document.querySelector("#registerPhone");

const message = document.querySelector("#message");
const registerMessage = document.querySelector("#registerMessage");

const search = document.querySelector("#search");
const list = document.querySelector("#directoryList");
const empty = document.querySelector("#empty");

let confirmationResult = null;
let registrationConfirmationResult = null;
let members = [];
let currentUser = null;

function showMessage(text) {
  message.textContent = text;
}

function showRegisterMessage(text) {
  registerMessage.textContent = text;
}

function normalizePhone(value) {
  const trimmed = value.trim();

  if (trimmed.startsWith("+")) {
    return trimmed.replace(/[^\d+]/g, "");
  }

  const digits = trimmed.replace(/\D/g, "");

  return digits.length === 10
    ? `+1${digits}`
    : `+${digits}`;
}

function setupRecaptcha() {
  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier;
  }

  window.recaptchaVerifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container",
    {
      size: "normal",
      callback: () => showMessage(""),
      "expired-callback": () => {
        showMessage(
          "The security check expired. Please complete it again."
        );
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
  }
}

function showLogin() {
  loginView.classList.remove("hidden");
  registerView.classList.add("hidden");
  directoryView.classList.add("hidden");
}

function showRegistration() {
  loginView.classList.add("hidden");
  registerView.classList.remove("hidden");
  directoryView.classList.add("hidden");

  showRegisterMessage("");
}

function showDirectory() {
  loginView.classList.add("hidden");
  registerView.classList.add("hidden");
  directoryView.classList.remove("hidden");
}

renderRecaptcha();

document.querySelector("#showRegister").addEventListener(
  "click",
  () => {
    showRegistration();
  }
);

document.querySelector("#backToLogin").addEventListener(
  "click",
  () => {
    showLogin();
    showMessage("");
    showRegisterMessage("");
  }
);

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

    showMessage(
      error.message ||
      "Unable to send the verification code."
    );

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
    await confirmationResult.confirm(
      codeInput.value.trim()
    );

    showMessage("");
  } catch (error) {
    console.error(error);

    showMessage(
      "That code was not accepted. Please try again."
    );
  }
});

document.querySelector("#changeNumber").addEventListener(
  "click",
  () => {
    codeForm.classList.add("hidden");
    phoneForm.classList.remove("hidden");

    codeInput.value = "";
    showMessage("");

    if (!window.recaptchaVerifier) {
      renderRecaptcha();
    }
  }
);

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  showRegisterMessage("");

  const name = registerName.value.trim();
  const phone = normalizePhone(registerPhone.value);

  if (!name || !phone) {
    showRegisterMessage(
      "Please enter your name and phone number."
    );
    return;
  }

  try {
    const verifier = setupRecaptcha();

    registrationConfirmationResult =
      await signInWithPhoneNumber(
        auth,
        phone,
        verifier
      );

    registerForm.classList.add("hidden");

    showRegisterMessage(
      "Verification code sent by text. Enter the code below."
    );

    let codeBox = document.querySelector(
      "#registrationCodeBox"
    );

    if (!codeBox) {
      codeBox = document.createElement("div");
      codeBox.id = "registrationCodeBox";

      codeBox.innerHTML = `
        <label for="registrationCode">
          Verification code
        </label>

        <input
          id="registrationCode"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="123456"
        >

        <button id="verifyRegistration" type="button">
          Verify Registration
        </button>
      `;

      registerForm.parentNode.insertBefore(
        codeBox,
        document.querySelector("#backToLogin")
      );

      document
        .querySelector("#verifyRegistration")
        .addEventListener(
          "click",
          completeRegistration
        );
    }
  } catch (error) {
    console.error("Registration error:", error);

    showRegisterMessage(
      error.message ||
      "Unable to send the verification code."
    );

    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }

    await renderRecaptcha();
  }
});

async function completeRegistration() {
  const registrationCode =
    document.querySelector("#registrationCode");

  if (!registrationConfirmationResult) {
    showRegisterMessage(
      "Please request a verification code first."
    );
    return;
  }

  if (!registrationCode.value.trim()) {
    showRegisterMessage(
      "Please enter the verification code."
    );
    return;
  }

  try {
    const result =
      await registrationConfirmationResult.confirm(
        registrationCode.value.trim()
      );

    const user = result.user;
    const phone = user.phoneNumber;
    const name = registerName.value.trim();

    const memberRef = doc(
      db,
      "members",
      phone
    );

    const pendingRef = doc(
      db,
      "registrationRequests",
      phone
    );

    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      showRegisterMessage(
        "This phone number is already registered. Please return to Sign In."
      );

      await signOut(auth);
      return;
    }

    const pendingSnap = await getDoc(pendingRef);

    if (pendingSnap.exists()) {
      showRegisterMessage(
        "Your registration is already pending approval."
      );

      await signOut(auth);
      return;
    }

    await setDoc(pendingRef, {
      name: name,
      phone: phone,
      createdAt: new Date().toISOString()
    });

    showRegisterMessage(
      "Registration submitted! Your request is now waiting for church administrator approval."
    );

    registerForm.classList.remove("hidden");

    const codeBox = document.querySelector(
      "#registrationCodeBox"
    );

    if (codeBox) {
      codeBox.remove();
    }

    registerForm.reset();

    await signOut(auth);

  } catch (error) {
    console.error(
      "Registration verification error:",
      error
    );

    showRegisterMessage(
      "That verification code was not accepted. Please try again."
    );
  }
}

document.querySelector("#signOut").addEventListener(
  "click",
  () => {
    signOut(auth);
  }
);

search.addEventListener(
  "input",
  render
);

async function loadDirectory() {
  list.innerHTML =
    "<p class='muted'>Loading directory…</p>";

  const snapshot = await getDocs(
    collection(db, "members")
  );

  members = snapshot.docs
    .map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
    .filter(
      member =>
        member.name &&
        member.phone
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name)
    );

  render();
  renderAdminPanel();
}

function render() {
  const term =
    search.value.trim().toLowerCase();

  const filtered =
    members.filter(member =>
      member.name
        .toLowerCase()
        .includes(term)
    );

  list.innerHTML = "";

  empty.classList.toggle(
    "hidden",
    filtered.length !== 0
  );

  for (const member of filtered) {
    const row =
      document.createElement("div");

    row.className = "member";

    const name =
      document.createElement("div");

    name.className =
      "member-name";

    name.textContent =
      member.name;

    const link =
      document.createElement("a");

    link.className =
      "member-phone";

    link.href =
      `tel:${member.phone}`;

    link.textContent =
      `📞 ${member.phone}`;

    row.append(name, link);

    if (
      currentUser &&
      currentUser.phoneNumber === ADMIN_PHONE
    ) {
      const controls =
        document.createElement("div");

      controls.style.marginTop =
        "12px";

      controls.style.display =
        "flex";

      controls.style.gap =
        "8px";

      const editButton =
        document.createElement("button");

      editButton.textContent =
        "Edit";

      editButton.className =
        "secondary small";

      editButton.onclick =
        () => editMember(member);

      const deleteButton =
        document.createElement("button");

      deleteButton.textContent =
        "Delete";

      deleteButton.className =
        "secondary small";

      deleteButton.onclick =
        () => deleteMember(member);

      controls.append(
        editButton,
        deleteButton
      );

      row.appendChild(controls);
    }

    list.appendChild(row);
  }
}

async function renderAdminPanel() {
  const oldPanel =
    document.querySelector(
      "#adminPanel"
    );

  if (oldPanel) {
    oldPanel.remove();
  }

  if (
    !currentUser ||
    currentUser.phoneNumber !== ADMIN_PHONE
  ) {
    return;
  }

  const panel =
    document.createElement("section");

  panel.id =
    "adminPanel";

  panel.className =
    "card";

  panel.style.marginBottom =
    "20px";

  panel.innerHTML = `
    <h2>Admin</h2>

    <p class="muted">
      Manage church directory members.
    </p>

    <h3>Pending Registrations</h3>

    <div id="pendingRequests">
      <p class="muted">
        Loading registration requests…
      </p>
    </div>

    <hr>

    <h3>Add Member Manually</h3>

    <form id="addMemberForm">

      <label for="memberName">
        Member name
      </label>

      <input
        id="memberName"
        type="text"
        placeholder="John Smith"
        required
      >

      <label for="memberPhone">
        Phone number
      </label>

      <input
        id="memberPhone"
        type="tel"
        inputmode="tel"
        placeholder="+1 859 555 1234"
        required
      >

      <button type="submit">
        Add Member
      </button>

    </form>

    <p
      id="adminMessage"
      class="message"
    ></p>
  `;

  directoryView.insertBefore(
    panel,
    search
  );

  document
    .querySelector("#addMemberForm")
    .addEventListener(
      "submit",
      addMember
    );

  await loadPendingRequests();
}

async function loadPendingRequests() {
  const container =
    document.querySelector(
      "#pendingRequests"
    );

  if (!container) return;

  try {
    const snapshot =
      await getDocs(
        collection(
          db,
          "registrationRequests"
        )
      );

    if (snapshot.empty) {
      container.innerHTML =
        "<p class='muted'>No pending registrations.</p>";

      return;
    }

    container.innerHTML = "";

    snapshot.docs.forEach(
      requestDoc => {
        const request =
          requestDoc.data();

        const item =
          document.createElement("div");

        item.className =
          "member";

        item.innerHTML = `
          <div class="member-name">
            ${escapeHtml(
              request.name || ""
            )}
          </div>

          <div>
            ${escapeHtml(
              request.phone || ""
            )}
          </div>

          <div
            style="
              display:flex;
              gap:8px;
              margin-top:12px;
            "
          >
            <button
              class="small"
              data-action="approve"
            >
              Approve
            </button>

            <button
              class="secondary small"
              data-action="reject"
            >
              Reject
            </button>
          </div>
        `;

        item
          .querySelector(
            '[data-action="approve"]'
          )
          .onclick =
          () =>
            approveRequest(
              requestDoc.id,
              request
            );

        item
          .querySelector(
            '[data-action="reject"]'
          )
          .onclick =
          () =>
            rejectRequest(
              requestDoc.id
            );

        container.appendChild(item);
      }
    );
  } catch (error) {
    console.error(error);

    container.innerHTML =
      "<p class='muted'>Unable to load registration requests.</p>";
  }
}

async function approveRequest(
  requestId,
  request
) {
  try {
    await setDoc(
      doc(
        db,
        "members",
        requestId
      ),
      {
        name: request.name,
        phone: request.phone
      }
    );

    await deleteDoc(
      doc(
        db,
        "registrationRequests",
        requestId
      )
    );

    alert(
      `${request.name} has been approved.`
    );

    await loadDirectory();
  } catch (error) {
    console.error(error);

    alert(
      "Unable to approve this registration."
    );
  }
}

async function rejectRequest(
  requestId
) {
  const confirmed =
    confirm(
      "Reject this registration request?"
    );

  if (!confirmed) return;

  try {
    await deleteDoc(
      doc(
        db,
        "registrationRequests",
        requestId
      )
    );

    await loadDirectory();
  } catch (error) {
    console.error(error);

    alert(
      "Unable to reject this registration."
    );
  }
}

function escapeHtml(value) {
  const div =
    document.createElement("div");

  div.textContent =
    value;

  return div.innerHTML;
}

async function addMember(event) {
  event.preventDefault();

  const nameInput =
    document.querySelector(
      "#memberName"
    );

  const phoneInputAdmin =
    document.querySelector(
      "#memberPhone"
    );

  const adminMessage =
    document.querySelector(
      "#adminMessage"
    );

  const name =
    nameInput.value.trim();

  const phone =
    normalizePhone(
      phoneInputAdmin.value
    );

  if (!name || !phone) {
    adminMessage.textContent =
      "Please enter a name and phone number.";

    return;
  }

  try {
    await setDoc(
      doc(
        db,
        "members",
        phone
      ),
      {
        name: name,
        phone: phone
      }
    );

    adminMessage.textContent =
      "Member added successfully.";

    nameInput.value = "";
    phoneInputAdmin.value = "";

    await loadDirectory();

  } catch (error) {
    console.error(error);

    adminMessage.textContent =
      "Unable to add member. Please try again.";
  }
}

async function editMember(member) {
  const newName =
    prompt(
      "Enter the member's name:",
      member.name
    );

  if (newName === null) return;

  const newPhoneInput =
    prompt(
      "Enter the member's phone number:",
      member.phone
    );

  if (newPhoneInput === null) return;

  const newNameClean =
    newName.trim();

  const newPhone =
    normalizePhone(
      newPhoneInput
    );

  if (
    !newNameClean ||
    !newPhone
  ) {
    alert(
      "Name and phone number are required."
    );

    return;
  }

  try {
    await setDoc(
      doc(
        db,
        "members",
        newPhone
      ),
      {
        name: newNameClean,
        phone: newPhone
      }
    );

    if (
      newPhone !== member.id
    ) {
      await deleteDoc(
        doc(
          db,
          "members",
          member.id
        )
      );
    }

    alert(
      "Member updated successfully."
    );

    await loadDirectory();

  } catch (error) {
    console.error(error);

    alert(
      "Unable to update member."
    );
  }
}

async function deleteMember(member) {
  if (
    member.phone === ADMIN_PHONE
  ) {
    alert(
      "You cannot delete the administrator's directory entry."
    );

    return;
  }

  const confirmed =
    confirm(
      `Delete ${member.name} from the directory?`
    );

  if (!confirmed) return;

  try {
    await deleteDoc(
      doc(
        db,
        "members",
        member.id
      )
    );

    await loadDirectory();

  } catch (error) {
    console.error(error);

    alert(
      "Unable to delete member."
    );
  }
}

async function checkMemberAccess(user) {
  const memberRef =
    doc(
      db,
      "members",
      user.phoneNumber
    );

  const memberSnap =
    await getDoc(memberRef);

  return memberSnap.exists();
}

async function checkPendingRequest(user) {
  const pendingRef =
    doc(
      db,
      "registrationRequests",
      user.phoneNumber
    );

  const pendingSnap =
    await getDoc(pendingRef);

  return pendingSnap.exists();
}

onAuthStateChanged(
  auth,
  async (user) => {
    currentUser = user;

    if (!user) {
      showLogin();
      return;
    }

    try {
      const isAdmin =
        user.phoneNumber ===
        ADMIN_PHONE;

      if (isAdmin) {
        showDirectory();
        await loadDirectory();
        return;
      }

      const isMember =
        await checkMemberAccess(
          user
        );

      if (isMember) {
        showDirectory();
        await loadDirectory();
        return;
      }

      const isPending =
        await checkPendingRequest(
          user
        );

      await signOut(auth);

      if (isPending) {
        showLogin();

        showMessage(
          "Your registration is pending church administrator approval."
        );
      } else {
        showLogin();

        showMessage(
          "Your phone number is not approved for the Church Directory."
        );
      }

    } catch (error) {
      console.error(error);

      await signOut(auth);

      showLogin();

      showMessage(
        "Unable to verify your directory access."
      );
    }
  }
);
