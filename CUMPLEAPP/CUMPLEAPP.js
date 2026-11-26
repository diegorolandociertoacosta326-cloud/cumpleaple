
"use strict";

/* ======================================================
   1. CONFIGURACIÓN GENERAL
====================================================== */

const CONFIG = {
  appName: "CUMPLEAPP",
  className: " VI - APSTI",
  storageKey: "cumpleapp_members_v1",
  celebrationsKey: "cumpleapp_celebrations_v1",
  maxPhotoSize: 8 * 1024 * 1024,
  notificationDays: 7,
  toastDuration: 3500
};

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril",
  "Mayo", "Junio", "Julio", "Agosto",
  "Septiembre", "Octubre", "Noviembre",
  "Diciembre"
];

/* ======================================================
   2. ESTADO DE LA APLICACIÓN
====================================================== */

const state = {
  members: [],
  celebrations: {},

  currentPage: "dashboard",
  currentFilter: "all",
  celebrationTab: "celebrated",

  selectedMemberId: null,
  editingMemberId: null,

  photoData: null,

  calendarDate: new Date(),
  selectedDate: new Date(),

  confirmCallback: null
};

/* ======================================================
   3. UTILIDADES DOM
====================================================== */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) =>
  Array.from(document.querySelectorAll(selector));

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = getElement(id);

  if (element) {
    element.textContent = String(value);
  }
}

function showElement(element) {
  if (element) {
    element.classList.remove("hidden");
  }
}

function hideElement(element) {
  if (element) {
    element.classList.add("hidden");
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createId() {
  if (window.crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12)
  );
}

function getToday() {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function dateOnly(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function toISODate(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDate(value, options = {}) {
  const date = value instanceof Date
    ? value
    : parseLocalDate(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options
  });
}

function formatShortBirthday(value) {
  const date = parseLocalDate(value);

  if (!date) return "--/--";

  return (
    String(date.getDate()).padStart(2, "0") +
    "/" +
    String(date.getMonth() + 1).padStart(2, "0")
  );
}

function fullName(member) {
  return `${member.firstName} ${member.lastName}`.trim();
}

function memberTypeLabel(type) {
  return type === "teacher"
    ? "Docente"
    : "Estudiante";
}

/* ======================================================
   4. ALMACENAMIENTO LOCAL
====================================================== */

function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);

    if (!stored) {
      return fallback;
    }

    return JSON.parse(stored);
  } catch (error) {
    console.error("Error leyendo almacenamiento:", error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

    return true;
  } catch (error) {
    console.error("Error guardando información:", error);

    showToast(
      "No se pudo guardar. Revisa el espacio disponible del navegador.",
      "error"
    );

    return false;
  }
}

function normalizeMember(member) {
  if (
    !member ||
    typeof member !== "object" ||
    !parseLocalDate(member.birthDate)
  ) {
    return null;
  }

  const firstName =
    String(member.firstName ?? "").trim();

  const lastName =
    String(member.lastName ?? "").trim();

  if (!firstName || !lastName) {
    return null;
  }

  return {
    id: String(member.id || createId()),
    firstName,
    lastName,
    type: member.type === "teacher"
      ? "teacher"
      : "student",
    birthDate: member.birthDate,
    photo: typeof member.photo === "string" &&
      /^data:image\/(jpeg|png|webp);base64,/i.test(member.photo)
        ? member.photo
        : null,
    createdAt: member.createdAt || new Date().toISOString()
  };
}

function loadData() {
  const storedMembers = readStorage(
    CONFIG.storageKey,
    null
  );

  if (Array.isArray(storedMembers)) {
    state.members = storedMembers
      .map(normalizeMember)
      .filter(Boolean);
  } else {
    state.members = createDemoMembers();

    if (storedMembers === null) {
      writeStorage(
        CONFIG.storageKey,
        state.members
      );
    }
  }

  const savedCelebrations = readStorage(
    CONFIG.celebrationsKey,
    {}
  );

  state.celebrations =
    savedCelebrations &&
    typeof savedCelebrations === "object" &&
    !Array.isArray(savedCelebrations)
      ? savedCelebrations
      : {};
}

function saveMembers() {
  return writeStorage(
    CONFIG.storageKey,
    state.members
  );
}

function saveCelebrations() {
  return writeStorage(
    CONFIG.celebrationsKey,
    state.celebrations
  );
}

/* ======================================================
   5. DATOS DE DEMOSTRACIÓN

   Se cargan únicamente en el primer uso.
   Puedes editar o eliminar estos registros.
====================================================== */

function createDemoMembers() {
  const demo = [
    {
      firstName: "Ana",
      lastName: "López",
      type: "student",
      birthDate: "2005-11-20"
    },
    {
      firstName: "Carlos",
      lastName: "Ruiz",
      type: "student",
      birthDate: "2004-12-15"
    },
    {
      firstName: "María",
      lastName: "Pérez",
      type: "student",
      birthDate: "2006-01-05"
    },
    {
      firstName: "Lucía",
      lastName: "Torres",
      type: "student",
      birthDate: "2005-02-28"
    }
  ];

  return demo.map(member => ({
    id: createId(),
    ...member,
    photo: null,
    createdAt: new Date().toISOString()
  }));
}

/* ======================================================
   6. CÁLCULOS DE CUMPLEAÑOS
====================================================== */

function birthdayInYear(birthDate, year) {
  const birth = parseLocalDate(birthDate);

  if (!birth) return null;

  const month = birth.getMonth();
  const day = birth.getDate();

  // Los nacidos el 29 de febrero celebran
  // el 28 de febrero en años no bisiestos.
  if (
    month === 1 &&
    day === 29 &&
    new Date(year, 1, 29).getMonth() !== 1
  ) {
    return new Date(year, 1, 28);
  }

  return new Date(year, month, day);
}

function daysBetween(start, end) {
  const a = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );

  const b = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate()
  );

  return Math.round(
    (b - a) / 86400000
  );
}

function getNextBirthday(member, fromDate = getToday()) {
  const today = dateOnly(fromDate);

  let birthday = birthdayInYear(
    member.birthDate,
    today.getFullYear()
  );

  if (!birthday) return null;

  if (birthday < today) {
    birthday = birthdayInYear(
      member.birthDate,
      today.getFullYear() + 1
    );
  }

  return {
    date: birthday,
    days: daysBetween(today, birthday),
    year: birthday.getFullYear()
  };
}

function getDaysUntilBirthday(member) {
  return getNextBirthday(member)?.days ?? 0;
}

function getAge(member, year = getToday().getFullYear()) {
  const birth = parseLocalDate(member.birthDate);

  if (!birth) return 0;

  const birthday = birthdayInYear(
    member.birthDate,
    year
  );

  return year - birth.getFullYear() -
    (birthday > getToday() &&
     year === getToday().getFullYear() ? 1 : 0);
}

function isBirthdayOnDate(member, date) {
  const birthday = birthdayInYear(
    member.birthDate,
    date.getFullYear()
  );

  return birthday &&
    birthday.getMonth() === date.getMonth() &&
    birthday.getDate() === date.getDate();
}

function getTodaysBirthdays() {
  const today = getToday();

  return state.members.filter(member =>
    isBirthdayOnDate(member, today)
  );
}

function getUpcomingBirthdays() {
  return state.members
    .map(member => ({
      ...member,
      nextBirthday: getNextBirthday(member)
    }))
    .filter(member => member.nextBirthday)
    .sort((a, b) => {
      const difference =
        a.nextBirthday.days - b.nextBirthday.days;

      return difference ||
        fullName(a).localeCompare(
          fullName(b),
          "es"
        );
    });
}

function daysLabel(days) {
  if (days === 0) return "¡Hoy!";
  if (days === 1) return "1 día";

  return `${days} días`;
}

function countdownMessage(days) {
  if (days === 0) {
    return "🎉 ¡Feliz cumpleaños!";
  }

  if (days === 1) {
    return "🎂 ¡Falta 1 día!";
  }

  return `Faltan ${days} días`;
}

/* ======================================================
   7. FOTOGRAFÍAS Y AVATARES
====================================================== */

function avatarEmoji(member) {
  return member.type === "teacher"
    ? "👩‍🏫"
    : "👩‍🎓";
}

function avatarHTML(member, className = "member-avatar") {
  if (member.photo) {
    return `
      <div class="${className}">
        <img
          src="${member.photo}"
          alt="Foto de ${escapeHTML(fullName(member))}"
          loading="lazy"
        >
      </div>
    `;
  }

  return `
    <div class="${className}">
      ${avatarEmoji(member)}
    </div>
  `;
}

function resetPhotoPreview() {
  state.photoData = null;

  const preview = getElement("photoPreview");
  const placeholder = getElement("photoPlaceholder");
  const input = getElement("memberPhoto");

  preview.removeAttribute("src");
  hideElement(preview);
  showElement(placeholder);

  input.value = "";
}

function updatePhotoPreview(data) {
  const preview = getElement("photoPreview");
  const placeholder = getElement("photoPlaceholder");

  if (!data) {
    resetPhotoPreview();
    return;
  }

  state.photoData = data;

  preview.src = data;

  showElement(preview);
  hideElement(placeholder);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("No se pudo leer la imagen."));
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(new Error("La imagen no es válida."));
      };

      image.onload = () => {
        try {
          const maxSize = 420;

          const scale = Math.min(
            1,
            maxSize / Math.max(
              image.width,
              image.height
            )
          );

          const canvas = document.createElement("canvas");

          canvas.width = Math.max(
            1,
            Math.round(image.width * scale)
          );

          canvas.height = Math.max(
            1,
            Math.round(image.height * scale)
          );

          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Canvas no disponible.");
          }

          context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
          );

          resolve(
            canvas.toDataURL("image/jpeg", 0.72)
          );
        } catch (error) {
          reject(error);
        }
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

async function handlePhotoChange(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    showToast(
      "Selecciona una imagen JPG, PNG o WEBP.",
      "error"
    );

    event.target.value = "";
    return;
  }

  if (file.size > CONFIG.maxPhotoSize) {
    showToast(
      "La fotografía no debe superar los 8 MB.",
      "warning"
    );

    event.target.value = "";
    return;
  }

  try {
    const compressed = await compressImage(file);

    updatePhotoPreview(compressed);

    showToast(
      "Fotografía cargada correctamente.",
      "success"
    );
  } catch (error) {
    console.error(error);

    showToast(
      "No se pudo procesar la fotografía.",
      "error"
    );
  }
}

/* ======================================================
   8. NAVEGACIÓN ENTRE PANTALLAS
====================================================== */

const PAGE_TITLES = {
  dashboard: "¡ VI - APSTI",
  register: "Registrar",
  members: "Mis Compañeros",
  calendar: "Calendario",
  upcoming: "Próximos Cumpleaños",
  celebrations: "Celebraciones"
};

function startApplication() {
  hideElement(getElement("welcomeScreen"));
  showElement(getElement("mainApp"));

  navigateTo("dashboard");
}

function navigateTo(pageName) {
  const page = getElement(`${pageName}Page`);

  if (!page) {
    console.warn("Página no encontrada:", pageName);
    return;
  }

  state.currentPage = pageName;

  $$(".page").forEach(element => {
    element.classList.remove("active");
  });

  page.classList.add("active");

  setText(
    "headerTitle",
    PAGE_TITLES[pageName] || CONFIG.appName
  );

  $$("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === pageName
    );
  });

  closeSidebar();

  const mainContent = $(".main-content");

  if (mainContent) {
    mainContent.scrollTop = 0;
  }

  window.scrollTo({
    top: 0,
    behavior: "instant"
  });

  switch (pageName) {
    case "dashboard":
      renderDashboard();
      break;

    case "members":
      renderMembers();
      break;

    case "calendar":
      renderCalendar();
      break;

    case "upcoming":
      renderUpcoming();
      break;

    case "celebrations":
      renderCelebrations();
      break;

    case "register":
      break;
  }
}

function openSidebar() {
  getElement("sidebar").classList.add("open");

  showElement(
    getElement("sidebarOverlay")
  );
}

function closeSidebar() {
  getElement("sidebar").classList.remove("open");

  hideElement(
    getElement("sidebarOverlay")
  );
}

function toggleSidebar() {
  const sidebar = getElement("sidebar");

  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

/* ======================================================
   9. PANEL PRINCIPAL
====================================================== */

function renderDashboard() {
  const total = state.members.length;

  const students = state.members.filter(
    member => member.type === "student"
  ).length;

  const teachers = state.members.filter(
    member => member.type === "teacher"
  ).length;

  setText("totalMembers", total);
  setText("totalStudents", students);
  setText("totalTeachers", teachers);

  renderTodaysBirthdays();
  renderNextBirthday();
  updateNotificationDot();
}

function renderTodaysBirthdays() {
  const container = getElement("todayBirthdays");
  const birthdays = getTodaysBirthdays();

  if (birthdays.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>🎁</span>
        <p>
          Hoy no hay cumpleaños registrados.<br>
          ¡Pronto tendremos algo que celebrar!
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML = birthdays.map(member => `
    <div class="birthday-person">
      <div class="birthday-person-icon">🎂</div>

      <div class="birthday-person-info">
        <h4>${escapeHTML(fullName(member))}</h4>

        <p class="birthday-message">
          🎉 ¡Feliz cumpleaños!
        </p>

        <p>
          ¡Que tengas un día maravilloso! 💖
        </p>
      </div>
    </div>
  `).join("");
}

function renderNextBirthday() {
  const container = getElement("nextBirthday");

  const upcoming = getUpcomingBirthdays();

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>📅</span>
        <p>No hay integrantes registrados.</p>
      </div>
    `;

    return;
  }

  const next = upcoming[0];

  container.innerHTML = `
    <div class="birthday-person">
      <div class="birthday-person-icon">📅</div>

      <div class="birthday-person-info">
        <h4>${escapeHTML(fullName(next))}</h4>

        <p>${countdownMessage(next.nextBirthday.days)}</p>

        <p>
          ${formatShortBirthday(next.birthDate)}
        </p>
      </div>

      <i class="fa-solid fa-chevron-right"></i>
    </div>
  `;

  container.style.cursor = "pointer";

  container.onclick = () => {
    openMemberModal(next.id);
  };
}

/* ======================================================
   10. FORMULARIO DE REGISTRO
====================================================== */

function clearForm() {
  getElement("memberForm").reset();

  getElement("memberId").value = "";

  state.editingMemberId = null;

  resetPhotoPreview();

  hideElement(getElement("formError"));

  setText("formTitle", "Nuevo integrante");

  setText(
    "saveBtnText",
    "Guardar integrante"
  );
}

function openRegister() {
  clearForm();
  navigateTo("register");
}

function showFormError(message) {
  const error = getElement("formError");

  error.textContent = message;

  showElement(error);
}

function validateMember(data) {
  if (!data.firstName) {
    return "Ingresa los nombres.";
  }

  if (!data.lastName) {
    return "Ingresa los apellidos.";
  }

  if (
    data.firstName.length > 80 ||
    data.lastName.length > 80
  ) {
    return "El nombre o apellido es demasiado largo.";
  }

  if (
    data.type !== "student" &&
    data.type !== "teacher"
  ) {
    return "Selecciona el tipo de integrante.";
  }

  const birth = parseLocalDate(data.birthDate);

  if (!birth) {
    return "Selecciona una fecha de nacimiento válida.";
  }

  if (birth > getToday()) {
    return "La fecha de nacimiento no puede ser futura.";
  }

  if (birth.getFullYear() < 1900) {
    return "Ingresa un año de nacimiento válido.";
  }

  return null;
}

function handleMemberSubmit(event) {
  event.preventDefault();

  hideElement(getElement("formError"));

  const data = {
    firstName: getElement("firstName").value.trim(),
    lastName: getElement("lastName").value.trim(),
    type: getElement("memberType").value,
    birthDate: getElement("birthDate").value,
    photo: state.photoData
  };

  const error = validateMember(data);

  if (error) {
    showFormError(error);
    return;
  }

  const previousMembers = [...state.members];

  if (state.editingMemberId) {
    const index = state.members.findIndex(
      member => member.id === state.editingMemberId
    );

    if (index === -1) {
      showFormError(
        "No se encontró el integrante para editar."
      );

      return;
    }

    state.members[index] = {
      ...state.members[index],
      ...data
    };
  } else {
    const newMember = {
      id: createId(),
      ...data,
      createdAt: new Date().toISOString()
    };

    state.members.push(newMember);
  }

  if (!saveMembers()) {
    state.members = previousMembers;
    return;
  }

  const wasEditing = Boolean(
    state.editingMemberId
  );

  clearForm();

  showToast(
    wasEditing
      ? "Integrante actualizado correctamente."
      : "¡Integrante registrado con éxito!",
    "success"
  );

  navigateTo("members");
}

function editMember(id) {
  const member = state.members.find(
    item => item.id === id
  );

  if (!member) {
    showToast(
      "No se encontró el integrante.",
      "error"
    );

    return;
  }

  closeMemberModal();
  clearForm();

  state.editingMemberId = id;

  getElement("memberId").value = id;

  getElement("firstName").value =
    member.firstName;

  getElement("lastName").value =
    member.lastName;

  getElement("memberType").value =
    member.type;

  getElement("birthDate").value =
    member.birthDate;

  if (member.photo) {
    updatePhotoPreview(member.photo);
  }

  setText(
    "formTitle",
    "Editar integrante"
  );

  setText(
    "saveBtnText",
    "Guardar cambios"
  );

  navigateTo("register");
}

/* ======================================================
   11. LISTA DE COMPAÑEROS
====================================================== */

function getFilteredMembers() {
  const query = getElement("searchMembers")
    .value
    .trim()
    .toLocaleLowerCase("es");

  return state.members
    .filter(member => {
      const matchesType =
        state.currentFilter === "all" ||
        member.type === state.currentFilter;

      const matchesSearch = fullName(member)
        .toLocaleLowerCase("es")
        .includes(query);

      return matchesType && matchesSearch;
    })
    .sort((a, b) =>
      fullName(a).localeCompare(
        fullName(b),
        "es"
      )
    );
}

function renderMembers() {
  const container = getElement("membersList");

  const members = getFilteredMembers();

  setText(
    "membersCount",
    `${members.length} integrante${members.length !== 1 ? "s" : ""}`
  );

  if (members.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>🔎</span>
        <p>No se encontraron integrantes.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = members.map(member => {
    const days = getDaysUntilBirthday(member);

    return `
      <div
        class="member-card"
        data-member-id="${member.id}"
        role="button"
        tabindex="0"
        aria-label="Ver detalles de ${escapeHTML(fullName(member))}"
      >
        ${avatarHTML(member)}

        <div class="member-info">
          <h4>${escapeHTML(fullName(member))}</h4>

          <p>${memberTypeLabel(member.type)}</p>

          <small>${formatDate(member.birthDate)}</small>
        </div>

        <span class="days-badge ${days <= 7 ? "soon" : ""}">
          ${days === 0 ? "🎉 Hoy" : daysLabel(days)}
        </span>

        <i class="fa-solid fa-chevron-right member-arrow"></i>
      </div>
    `;
  }).join("");
}

function setMemberFilter(filter) {
  state.currentFilter = filter;

  $$(".filter-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.filter === filter
    );
  });

  renderMembers();
}

/* ======================================================
   12. MODAL DE DETALLES
====================================================== */

function openMemberModal(id) {
  const member = state.members.find(
    item => item.id === id
  );

  if (!member) return;

  state.selectedMemberId = id;

  setText(
    "modalMemberName",
    fullName(member)
  );

  setText(
    "modalMemberType",
    memberTypeLabel(member.type)
  );

  setText(
    "modalBirthDate",
    formatDate(member.birthDate)
  );

  const next = getNextBirthday(member);

  setText(
    "modalCountdown",
    next
      ? countdownMessage(next.days)
      : "Sin fecha"
  );

  getElement("modalAvatar").innerHTML =
    member.photo
      ? `<img src="${member.photo}" alt="Fotografía">`
      : avatarEmoji(member);

  showElement(
    getElement("memberModal")
  );
}

function closeMemberModal() {
  hideElement(
    getElement("memberModal")
  );

  state.selectedMemberId = null;
}

/* ======================================================
   13. ELIMINAR INTEGRANTES
====================================================== */

function requestDeleteMember(id) {
  const member = state.members.find(
    item => item.id === id
  );

  if (!member) return;

  openConfirmModal(
    "¿Eliminar integrante?",
    `Se eliminará a ${fullName(member)} y su historial de celebraciones.`,
    () => deleteMember(id)
  );
}

function deleteMember(id) {
  const oldMembers = [...state.members];
  const oldCelebrations = {
    ...state.celebrations
  };

  state.members = state.members.filter(
    member => member.id !== id
  );

  Object.keys(state.celebrations).forEach(key => {
    if (key.endsWith(`:${id}`)) {
      delete state.celebrations[key];
    }
  });

  if (!saveMembers()) {
    state.members = oldMembers;
    state.celebrations = oldCelebrations;
    return;
  }

  saveCelebrations();

  closeMemberModal();

  showToast(
    "Integrante eliminado correctamente.",
    "success"
  );

  refreshCurrentPage();
}

/* ======================================================
   14. MODAL DE CONFIRMACIÓN
====================================================== */

function openConfirmModal(
  title,
  message,
  callback
) {
  setText("confirmTitle", title);
  setText("confirmMessage", message);

  state.confirmCallback = callback;

  showElement(
    getElement("confirmModal")
  );
}

function closeConfirmModal() {
  hideElement(
    getElement("confirmModal")
  );

  state.confirmCallback = null;
}

function acceptConfirmation() {
  const callback = state.confirmCallback;

  closeConfirmModal();

  if (typeof callback === "function") {
    callback();
  }
}

/* ======================================================
   15. CALENDARIO INTERACTIVO
====================================================== */

function changeCalendarMonth(direction) {
  const date = state.calendarDate;

  state.calendarDate = new Date(
    date.getFullYear(),
    date.getMonth() + direction,
    1
  );

  state.selectedDate = new Date(
    state.calendarDate.getFullYear(),
    state.calendarDate.getMonth(),
    1
  );

  renderCalendar();
}

function selectCalendarDate(year, month, day) {
  state.selectedDate = new Date(
    year,
    month,
    day
  );

  renderCalendar();
}

function renderCalendar() {
  const date = state.calendarDate;

  const year = date.getFullYear();
  const month = date.getMonth();

  setText(
    "calendarMonth",
    `${MONTHS[month]} ${year}`
  );

  const container = getElement("calendarDays");

  const firstDay = new Date(
    year,
    month,
    1
  );

  const lastDay = new Date(
    year,
    month + 1,
    0
  );

  const daysInMonth = lastDay.getDate();

  // Lunes = 0, domingo = 6
  const offset = (firstDay.getDay() + 6) % 7;

  let html = "";

  for (let i = 0; i < offset; i++) {
    html += `
      <span class="calendar-day other-month" aria-hidden="true"></span>
    `;
  }

  const today = getToday();

  for (let day = 1; day <= daysInMonth; day++) {
    const current = new Date(
      year,
      month,
      day
    );

    const isToday =
      toISODate(current) === toISODate(today);

    const isSelected =
      toISODate(current) ===
      toISODate(state.selectedDate);

    const hasBirthday = state.members.some(
      member => isBirthdayOnDate(
        member,
        current
      )
    );

    const classes = [
      "calendar-day",
      isToday ? "today" : "",
      isSelected ? "selected" : "",
      hasBirthday ? "has-birthday" : ""
    ].filter(Boolean).join(" ");

    html += `
      <button
        type="button"
        class="${classes}"
        data-calendar-day="${day}"
        aria-label="${day} de ${MONTHS[month]} de ${year}${hasBirthday ? ", con cumpleaños" : ""}"
        aria-pressed="${isSelected}"
      >
        ${day}
      </button>
    `;
  }

  container.innerHTML = html;

  renderSelectedDateBirthdays();
}

function renderSelectedDateBirthdays() {
  const container = getElement(
    "selectedDateBirthdays"
  );

  const selected = state.selectedDate;

  const birthdays = state.members.filter(
    member => isBirthdayOnDate(
      member,
      selected
    )
  );

  if (birthdays.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>📆</span>
        <p>
          No hay cumpleaños el
          ${formatDate(selected)}.
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML = birthdays.map(member => `
    <div class="calendar-birthday-card">
      <span class="cake-icon">🎂</span>

      <div>
        <h4>${escapeHTML(fullName(member))}</h4>

        <p>
          ${toISODate(selected) === toISODate(getToday())
            ? "¡Cumple hoy! 🎉"
            : `Cumpleaños: ${formatShortBirthday(member.birthDate)}`}
        </p>
      </div>
    </div>
  `).join("");
}

/* ======================================================
   16. PRÓXIMOS CUMPLEAÑOS
====================================================== */

function renderUpcoming() {
  const container = getElement("upcomingList");

  const upcoming = getUpcomingBirthdays();

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>🎂</span>
        <p>
          Registra integrantes para ver
          los próximos cumpleaños.
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML = upcoming.map(member => {
    const days = member.nextBirthday.days;

    return `
      <div
        class="upcoming-card"
        data-member-id="${member.id}"
        role="button"
        tabindex="0"
      >
        <div class="upcoming-icon">
          🎂
        </div>

        <div class="upcoming-info">
          <h4>${escapeHTML(fullName(member))}</h4>

          <p>${countdownMessage(days)}</p>

          <small>
            (${formatShortBirthday(member.birthDate)})
          </small>
        </div>

        <i class="fa-solid fa-chevron-right upcoming-arrow"></i>
      </div>
    `;
  }).join("");
}

/* ======================================================
   17. CELEBRACIONES E HISTORIAL
====================================================== */

function celebrationKey(id, year) {
  return `${year}:${id}`;
}

function isCelebrated(id, year) {
  return Boolean(
    state.celebrations[
      celebrationKey(id, year)
    ]
  );
}

function markCelebrated(id, year) {
  const member = state.members.find(
    item => item.id === id
  );

  if (!member) return;

  const key = celebrationKey(id, year);

  const previous = {
    ...state.celebrations
  };

  state.celebrations[key] = {
    celebrated: true,
    date: new Date().toISOString()
  };

  if (!saveCelebrations()) {
    state.celebrations = previous;
    return;
  }

  showToast(
    `🎉 ¡Cumpleaños de ${fullName(member)} celebrado!`,
    "success"
  );

  createConfetti();
  renderCelebrations();
}

function undoCelebration(id, year) {
  const key = celebrationKey(id, year);

  const previous = {
    ...state.celebrations
  };

  delete state.celebrations[key];

  if (!saveCelebrations()) {
    state.celebrations = previous;
    return;
  }

  showToast(
    "Celebración marcada como pendiente.",
    "success"
  );

  renderCelebrations();
}

function changeCelebrationTab(tab) {
  state.celebrationTab = tab;

  $$(".celebration-tab").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.celebration === tab
    );
  });

  renderCelebrations();
}

function getCelebrationRecords() {
  const currentYear = getToday().getFullYear();

  const records = [];

  state.members.forEach(member => {
    // Celebraciones del año actual.
    records.push({
      member,
      year: currentYear,
      birthday: birthdayInYear(
        member.birthDate,
        currentYear
      ),
      celebrated: isCelebrated(
        member.id,
        currentYear
      )
    });

    // Celebraciones guardadas de otros años.
    Object.keys(state.celebrations).forEach(key => {
      const [yearText, memberId] = key.split(":");

      const year = Number(yearText);

      if (
        memberId === member.id &&
        year !== currentYear &&
        Number.isInteger(year) &&
        state.celebrations[key]
      ) {
        records.push({
          member,
          year,
          birthday: birthdayInYear(
            member.birthDate,
            year
          ),
          celebrated: true
        });
      }
    });
  });

  return records;
}

function renderCelebrations() {
  const container = getElement(
    "celebrationsList"
  );

  const records = getCelebrationRecords();

  const filtered = records
    .filter(record =>
      state.celebrationTab === "celebrated"
        ? record.celebrated
        : !record.celebrated
    )
    .sort((a, b) => {
      if (state.celebrationTab === "celebrated") {
        return b.birthday - a.birthday;
      }

      return a.birthday - b.birthday;
    });

  if (filtered.length === 0) {
    const isCelebratedTab =
      state.celebrationTab === "celebrated";

    container.innerHTML = `
      <div class="empty-state">
        <span>${isCelebratedTab ? "⭐" : "🎂"}</span>

        <p>
          ${isCelebratedTab
            ? "Todavía no hay cumpleaños celebrados."
            : "No hay celebraciones pendientes."}
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML = filtered.map(record => {
    const { member, year, celebrated } = record;

    return `
      <div class="celebration-card">

        <div class="celebration-status-icon ${celebrated ? "" : "pending"}">
          <i class="fa-solid ${celebrated ? "fa-check" : "fa-clock"}"></i>
        </div>

        <div class="celebration-info">
          <h4>${escapeHTML(fullName(member))}</h4>

          <p>
            ${formatDate(record.birthday)}
          </p>
        </div>

        ${celebrated
          ? `
            <button
              class="celebrated-badge"
              type="button"
              data-undo-celebration="${member.id}"
              data-year="${year}"
              title="Deshacer celebración"
            >
              ✓ Celebrado
            </button>
          `
          : `
            <button
              class="celebrate-btn"
              type="button"
              data-celebrate="${member.id}"
              data-year="${year}"
            >
              Celebrar
            </button>
          `
        }
      </div>
    `;
  }).join("");
}

/* ======================================================
   18. NOTIFICACIONES
====================================================== */

function getImportantBirthdays() {
  return getUpcomingBirthdays().filter(
    member =>
      member.nextBirthday.days <=
      CONFIG.notificationDays
  );
}

function updateNotificationDot() {
  const important = getImportantBirthdays();

  const dot = getElement("notificationDot");

  if (important.length > 0) {
    showElement(dot);
  } else {
    hideElement(dot);
  }
}

function showBirthdayNotifications() {
  const important = getImportantBirthdays();

  if (important.length === 0) {
    showToast(
      "No hay cumpleaños en los próximos 7 días.",
      "success"
    );

    return;
  }

  const messages = important.map(member => {
    const days = member.nextBirthday.days;

    return `${fullName(member)}: ${countdownMessage(days)}`;
  });

  window.alert(
    "🎂 RECORDATORIOS DE CUMPLEAPP\n\n" +
    messages.join("\n")
  );
}

/* ======================================================
   19. NOTIFICACIONES TOAST
====================================================== */

function showToast(message, type = "success") {
  const container = getElement(
    "toastContainer"
  );

  if (!container) return;

  const toast = document.createElement("div");

  toast.className = `toast ${type}`;

  const icon = document.createElement("i");

  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-xmark",
    warning: "fa-triangle-exclamation"
  };

  icon.className =
    `fa-solid ${icons[type] || icons.success}`;

  const text = document.createElement("span");

  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(30px)";
    toast.style.transition = "0.3s ease";

    setTimeout(() => {
      toast.remove();
    }, 300);
  }, CONFIG.toastDuration);
}

/* ======================================================
   20. ANIMACIÓN DE CONFETI
====================================================== */

function createConfetti() {
  const colors = [
    "#7627b5",
    "#ef74c4",
    "#ffca45",
    "#a76ce0",
    "#45c986",
    "#ff6f91"
  ];

  const count = 45;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");

    piece.className = "confetti";

    piece.style.left =
      `${Math.random() * 100}vw`;

    piece.style.backgroundColor =
      colors[
        Math.floor(Math.random() * colors.length)
      ];

    piece.style.animationDelay =
      `${Math.random() * 0.8}s`;

    piece.style.animationDuration =
      `${2 + Math.random() * 2}s`;

    piece.style.width =
      `${6 + Math.random() * 7}px`;

    piece.style.height =
      `${8 + Math.random() * 10}px`;

    document.body.appendChild(piece);

    setTimeout(() => {
      piece.remove();
    }, 5000);
  }
}

/* ======================================================
   21. ACTUALIZAR PANTALLA
====================================================== */

function refreshCurrentPage() {
  switch (state.currentPage) {
    case "dashboard":
      renderDashboard();
      break;

    case "members":
      renderMembers();
      break;

    case "calendar":
      renderCalendar();
      break;

    case "upcoming":
      renderUpcoming();
      break;

    case "celebrations":
      renderCelebrations();
      break;
  }

  updateNotificationDot();
}

/* ======================================================
   22. EVENTOS DE NAVEGACIÓN
====================================================== */

function setupNavigationEvents() {
  getElement("startBtn").addEventListener(
    "click",
    startApplication
  );

  getElement("menuBtn").addEventListener(
    "click",
    toggleSidebar
  );

  getElement("sidebarOverlay").addEventListener(
    "click",
    closeSidebar
  );

  $$("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;

      if (page === "register") {
        openRegister();
      } else {
        navigateTo(page);
      }
    });
  });

  getElement("addMemberBtn").addEventListener(
    "click",
    openRegister
  );

  getElement("floatingAddBtn").addEventListener(
    "click",
    openRegister
  );

  getElement("notificationBtn").addEventListener(
    "click",
    showBirthdayNotifications
  );
}

/* ======================================================
   23. EVENTOS DEL FORMULARIO
====================================================== */

function setupFormEvents() {
  getElement("memberForm").addEventListener(
    "submit",
    handleMemberSubmit
  );

  getElement("memberPhoto").addEventListener(
    "change",
    handlePhotoChange
  );

  getElement("cancelFormBtn").addEventListener(
    "click",
    () => {
      clearForm();
      navigateTo("members");
    }
  );

  const birthInput = getElement("birthDate");

  birthInput.max = toISODate(getToday());
}

/* ======================================================
   24. EVENTOS DE LISTA Y BÚSQUEDA
====================================================== */

function setupMemberEvents() {
  getElement("searchMembers").addEventListener(
    "input",
    renderMembers
  );

  $$(".filter-btn").forEach(button => {
    button.addEventListener("click", () => {
      setMemberFilter(
        button.dataset.filter
      );
    });
  });

  getElement("membersList").addEventListener(
    "click",
    event => {
      const card = event.target.closest(
        "[data-member-id]"
      );

      if (card) {
        openMemberModal(
          card.dataset.memberId
        );
      }
    }
  );

  getElement("membersList").addEventListener(
    "keydown",
    event => {
      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      const card = event.target.closest(
        "[data-member-id]"
      );

      if (card) {
        event.preventDefault();

        openMemberModal(
          card.dataset.memberId
        );
      }
    }
  );

  getElement("upcomingList").addEventListener(
    "click",
    event => {
      const card = event.target.closest(
        "[data-member-id]"
      );

      if (card) {
        openMemberModal(
          card.dataset.memberId
        );
      }
    }
  );

  getElement("upcomingList").addEventListener(
    "keydown",
    event => {
      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      const card = event.target.closest(
        "[data-member-id]"
      );

      if (card) {
        event.preventDefault();

        openMemberModal(
          card.dataset.memberId
        );
      }
    }
  );
}

/* ======================================================
   25. EVENTOS DE MODALES
====================================================== */

function setupModalEvents() {
  getElement("closeModalBtn").addEventListener(
    "click",
    closeMemberModal
  );

  getElement("editMemberBtn").addEventListener(
    "click",
    () => {
      if (state.selectedMemberId) {
        editMember(
          state.selectedMemberId
        );
      }
    }
  );

  getElement("deleteMemberBtn").addEventListener(
    "click",
    () => {
      if (state.selectedMemberId) {
        requestDeleteMember(
          state.selectedMemberId
        );
      }
    }
  );

  getElement("confirmCancelBtn").addEventListener(
    "click",
    closeConfirmModal
  );

  getElement("confirmAcceptBtn").addEventListener(
    "click",
    acceptConfirmation
  );

  getElement("memberModal").addEventListener(
    "click",
    event => {
      if (
        event.target.id === "memberModal"
      ) {
        closeMemberModal();
      }
    }
  );

  getElement("confirmModal").addEventListener(
    "click",
    event => {
      if (
        event.target.id === "confirmModal"
      ) {
        closeConfirmModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape") return;

      if (
        !getElement("confirmModal")
          .classList.contains("hidden")
      ) {
        closeConfirmModal();
      } else if (
        !getElement("memberModal")
          .classList.contains("hidden")
      ) {
        closeMemberModal();
      } else {
        closeSidebar();
      }
    }
  );
}

/* ======================================================
   26. EVENTOS DEL CALENDARIO
====================================================== */

function setupCalendarEvents() {
  getElement("prevMonth").addEventListener(
    "click",
    () => changeCalendarMonth(-1)
  );

  getElement("nextMonth").addEventListener(
    "click",
    () => changeCalendarMonth(1)
  );

  getElement("calendarDays").addEventListener(
    "click",
    event => {
      const button = event.target.closest(
        "[data-calendar-day]"
      );

      if (!button) return;

      const day = Number(
        button.dataset.calendarDay
      );

      selectCalendarDate(
        state.calendarDate.getFullYear(),
        state.calendarDate.getMonth(),
        day
      );
    }
  );
}

/* ======================================================
   27. EVENTOS DE CELEBRACIONES
====================================================== */

function setupCelebrationEvents() {
  $$(".celebration-tab").forEach(button => {
    button.addEventListener("click", () => {
      changeCelebrationTab(
        button.dataset.celebration
      );
    });
  });

  getElement("celebrationsList").addEventListener(
    "click",
    event => {
      const celebrateButton = event.target.closest(
        "[data-celebrate]"
      );

      if (celebrateButton) {
        const id =
          celebrateButton.dataset.celebrate;

        const year = Number(
          celebrateButton.dataset.year
        );

        markCelebrated(id, year);
        return;
      }

      const undoButton = event.target.closest(
        "[data-undo-celebration]"
      );

      if (undoButton) {
        const id =
          undoButton.dataset.undoCelebration;

        const year = Number(
          undoButton.dataset.year
        );

        openConfirmModal(
          "¿Deshacer celebración?",
          "El cumpleaños volverá a aparecer como pendiente.",
          () => undoCelebration(id, year)
        );
      }
    }
  );
}

/* ======================================================
   28. ACTUALIZACIÓN AUTOMÁTICA DE FECHA
====================================================== */

let lastKnownDate = toISODate(getToday());

function checkDateChange() {
  const currentDate = toISODate(getToday());

  if (currentDate !== lastKnownDate) {
    lastKnownDate = currentDate;

    getElement("birthDate").max =
      currentDate;

    refreshCurrentPage();

    showToast(
      "¡Nuevo día! Cumpleaños actualizados.",
      "success"
    );
  }
}

function setupAutomaticUpdates() {
  // Revisar cambios de fecha cada minuto.
  setInterval(
    checkDateChange,
    60000
  );

  // Actualizar al volver a la pestaña.
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        checkDateChange();
      }
    }
  );

  window.addEventListener(
    "focus",
    checkDateChange
  );
}

/* ======================================================
   29. INICIALIZACIÓN
====================================================== */

function initializeApp() {
  console.log(
    "🎂 CUMPLEAPP iniciando..."
  );

  loadData();

  const today = getToday();

  state.calendarDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  );

  state.selectedDate = today;

  setupNavigationEvents();
  setupFormEvents();
  setupMemberEvents();
  setupModalEvents();
  setupCalendarEvents();
  setupCelebrationEvents();
  setupAutomaticUpdates();

  renderDashboard();
  renderMembers();
  renderCalendar();
  renderUpcoming();
  renderCelebrations();

  updateNotificationDot();

  console.log(
    `✅ CUMPLEAPP lista: ${state.members.length} integrantes`
  );
}

/* ======================================================
   30. INICIAR CUANDO EL HTML ESTÉ LISTO
====================================================== */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );
} else {
  initializeApp();
}

/* ======================================================
   FIN DEL ARCHIVO app.js
====================================================== */
