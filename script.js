const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelectorAll(".main-nav a");
const quizModal = document.querySelector("[data-quiz-modal]");
const quizOpenButtons = [...document.querySelectorAll("[data-quiz-open]")];
const quizCloseButtons = [...document.querySelectorAll("[data-quiz-close]")];
const leadForm = document.querySelector("[data-lead-form]");
const quizSuccess = document.querySelector("[data-quiz-success]");
const formStatus = document.querySelector("[data-form-status]");
const phoneInput = document.querySelector("[data-phone-input]");
const areaInput = document.querySelector("#area-input");
const planSummary = document.querySelector("[data-plan-summary]");
const quizSteps = [...document.querySelectorAll("[data-quiz-step]")];
const stepNavButtons = [...document.querySelectorAll("[data-step-nav]")];
const nextStepButtons = [...document.querySelectorAll("[data-next-step]")];
const prevStepButtons = [...document.querySelectorAll("[data-prev-step]")];
const presetButtons = [...document.querySelectorAll("[data-preset]")];
const areaButtons = [...document.querySelectorAll("[data-area-option]")];
const choiceButtons = [...document.querySelectorAll("[data-choice-name]")];
const hiddenFields = [...document.querySelectorAll("[data-hidden-field]")];
const stepCount = document.querySelector("#step-count");
const stepLabel = document.querySelector("#step-label");
const progressBar = document.querySelector("[data-progress-bar]");
const successPhone = document.querySelector("[data-success-phone]");

const BASE_AREA = 56;
const STEP_LABELS = ["Назначение", "Площадь и этажность", "Телефон"];

let currentStep = 0;
let maxStep = 0;
let lastQuizTrigger = null;
let hasSubmitted = false;

const updateHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

const setMenuOpen = (isOpen) => {
  header.classList.toggle("is-menu-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
};

const setHiddenField = (name, value) => {
  const field = hiddenFields.find((input) => input.name === name);
  if (field) field.value = value;
};

const normalizeArea = (value) => {
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return BASE_AREA;
  return Math.max(24, Math.min(240, Math.round(parsed)));
};

const getPhoneDigits = (phone) => phone.replace(/\D/g, "");

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
  const normalized = digits.startsWith("7") ? digits : `7${digits}`;
  const rest = normalized.slice(1);
  const parts = [
    rest.slice(0, 3),
    rest.slice(3, 6),
    rest.slice(6, 8),
    rest.slice(8, 10),
  ].filter(Boolean);

  if (!parts.length) return "+7 ";
  if (parts.length === 1) return `+7 (${parts[0]}`;
  if (parts.length === 2) return `+7 (${parts[0]}) ${parts[1]}`;
  if (parts.length === 3) return `+7 (${parts[0]}) ${parts[1]}-${parts[2]}`;
  return `+7 (${parts[0]}) ${parts[1]}-${parts[2]}-${parts[3]}`;
};

const getFormData = () => {
  const formData = new FormData(leadForm);
  return {
    purpose: String(formData.get("purpose") || "").trim(),
    floors: String(formData.get("floors") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    area: normalizeArea(formData.get("area") || BASE_AREA),
  };
};

const buildLeadMessage = (data) =>
  [
    "Заявка на расчет СИП-дома",
    `Телефон: ${data.phone || "не указан"}`,
    `Для кого строится дом: ${data.purpose || "не указано"}`,
    `Площадь: ${data.area} м²`,
    `Этажность: ${data.floors || "не указано"}`,
    "Производство: СИП-панели из собственного цеха",
  ].join("\n");

const syncChoices = () => {
  const data = getFormData();
  const formData = new FormData(leadForm);

  presetButtons.forEach((button) => {
    const isSelected = button.dataset.purpose === data.purpose;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  areaButtons.forEach((button) => {
    const isSelected = Number(button.dataset.areaOption) === data.area;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  choiceButtons.forEach((button) => {
    const fieldName = button.dataset.choiceName;
    const isSelected = button.dataset.choiceValue === String(formData.get(fieldName) || "");
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  if (document.activeElement !== areaInput && String(areaInput.value) !== String(data.area)) {
    areaInput.value = data.area;
  }

  if (planSummary) {
    planSummary.textContent = `Выбрано: ${data.area} м², ${data.floors || "этажность уточним"}.`;
  }

  if (!hasSubmitted || getPhoneDigits(data.phone).length >= 10) {
    phoneInput.setAttribute("aria-invalid", "false");
  }

  return data;
};

const resetQuiz = () => {
  hasSubmitted = false;
  currentStep = 0;
  maxStep = 0;
  setHiddenField("purpose", "Дом для себя");
  setHiddenField("floors", "1 этаж");
  areaInput.value = BASE_AREA;
  phoneInput.value = "";
  phoneInput.setAttribute("aria-invalid", "false");
  leadForm.hidden = false;
  quizSuccess.hidden = true;
  formStatus.textContent = "";
  setStep(0, false);
  syncChoices();
};

const openQuiz = (trigger = null) => {
  lastQuizTrigger = trigger;
  if (leadForm.hidden) resetQuiz();
  quizModal.classList.add("is-open");
  quizModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-quiz-open");
  setMenuOpen(false);

  const presetValue = trigger?.dataset?.presetOpen;
  if (presetValue) {
    setHiddenField("purpose", presetValue);
    const matching = presetButtons.find((button) => button.dataset.purpose === presetValue);
    if (matching?.dataset.area) setArea(matching.dataset.area, false);
    syncChoices();
  }

  setTimeout(() => {
    const activeStep = quizSteps[currentStep];
    const focusTarget = activeStep?.querySelector(".is-selected:not([disabled]), button:not([disabled]), input");
    focusTarget?.focus({ preventScroll: true });
  }, 120);
};

const closeQuiz = () => {
  quizModal.classList.remove("is-open");
  quizModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-quiz-open");
  lastQuizTrigger?.focus?.({ preventScroll: true });
};

const setStep = (nextStep, shouldFocus = true) => {
  const step = Math.max(0, Math.min(quizSteps.length - 1, nextStep));
  currentStep = step;
  maxStep = Math.max(maxStep, step);

  quizSteps.forEach((quizStep, index) => {
    const isActive = index === step;
    quizStep.hidden = !isActive;
    quizStep.classList.toggle("is-active", isActive);
  });

  stepNavButtons.forEach((button, index) => {
    button.disabled = index > maxStep;
    button.classList.toggle("is-active", index === step);
    button.classList.toggle("is-done", index < step);
  });

  stepCount.textContent = `${step + 1} / ${quizSteps.length}`;
  stepLabel.textContent = STEP_LABELS[step];
  progressBar.style.width = `${((step + 1) / quizSteps.length) * 100}%`;

  if (shouldFocus) {
    const activeStep = quizSteps[step];
    const focusTarget =
      step === quizSteps.length - 1
        ? phoneInput
        : activeStep.querySelector(".is-selected:not([disabled]), button:not([disabled]), input");
    setTimeout(() => focusTarget?.focus({ preventScroll: true }), 80);
  }
};

const setArea = (value, shouldSync = true) => {
  areaInput.value = normalizeArea(value);
  if (shouldSync) syncChoices();
};

const showSuccess = () => {
  const data = syncChoices();
  buildLeadMessage(data);
  leadForm.hidden = true;
  quizSuccess.hidden = false;
  if (successPhone) {
    successPhone.textContent = `Телефон: ${data.phone}`;
  }
  stepCount.textContent = "3 / 3";
  stepLabel.textContent = "Заявка принята";
  progressBar.style.width = "100%";
  formStatus.textContent = "";
  setTimeout(() => {
    quizSuccess.querySelector("button")?.focus({ preventScroll: true });
  }, 80);
};

window.addEventListener("scroll", () => {
  updateHeader();
}, { passive: true });

navToggle.addEventListener("click", () => {
  setMenuOpen(!header.classList.contains("is-menu-open"));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => setMenuOpen(false));
});

quizOpenButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openQuiz(button);
  });
});

quizCloseButtons.forEach((button) => {
  button.addEventListener("click", closeQuiz);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && quizModal.classList.contains("is-open")) {
    closeQuiz();
  }
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setHiddenField("purpose", button.dataset.purpose);
    if (button.dataset.area) setArea(button.dataset.area, false);
    syncChoices();
    setStep(1);
  });
});

areaButtons.forEach((button) => {
  button.addEventListener("click", () => setArea(button.dataset.areaOption));
});

choiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setHiddenField(button.dataset.choiceName, button.dataset.choiceValue);
    syncChoices();
  });
});

nextStepButtons.forEach((button) => {
  button.addEventListener("click", () => setStep(currentStep + 1));
});

prevStepButtons.forEach((button) => {
  button.addEventListener("click", () => setStep(currentStep - 1));
});

stepNavButtons.forEach((button) => {
  button.addEventListener("click", () => setStep(Number(button.dataset.stepNav)));
});

leadForm.addEventListener("input", syncChoices);
leadForm.addEventListener("change", syncChoices);

areaInput.addEventListener("blur", () => setArea(areaInput.value));

phoneInput.addEventListener("focus", () => {
  if (!phoneInput.value) phoneInput.value = "+7 ";
});

phoneInput.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
  syncChoices();
});

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  hasSubmitted = true;
  const data = syncChoices();

  if (getPhoneDigits(data.phone).length < 10) {
    phoneInput.setAttribute("aria-invalid", "true");
    formStatus.textContent = "Укажите телефон, чтобы специалист смог связаться с вами.";
    phoneInput.focus();
    return;
  }

  phoneInput.setAttribute("aria-invalid", "false");
  formStatus.textContent = "Формируем заявку...";
  setTimeout(showSuccess, 650);
});

updateHeader();
syncChoices();
setStep(0, false);
