const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelectorAll(".main-nav a");
const quizSection = document.querySelector("#quiz");
const mobileQuickCta = document.querySelector("[data-mobile-cta]");
const quizModal = document.querySelector("[data-quiz-modal]");
const quizSheet = document.querySelector(".quiz-sheet");
const quizOpenButtons = [...document.querySelectorAll("[data-quiz-open]")];
const quizCloseButtons = [...document.querySelectorAll("[data-quiz-close]")];
const leadForm = document.querySelector("[data-lead-form]");
const formStatus = document.querySelector("[data-form-status]");
const phoneInput = document.querySelector("[data-phone-input]");
const areaInput = document.querySelector("#area-input");
const priceOutput = document.querySelector("#price-output");
const calcNote = document.querySelector("#calc-note");
const requestSummary = document.querySelector("[data-request-summary]");
const summaryPurpose = document.querySelector("[data-summary-purpose]");
const summaryFeatures = document.querySelector("[data-summary-features]");
const summaryContact = document.querySelector("[data-summary-contact]");
const whatsappLink = document.querySelector("[data-whatsapp-link]");
const copyRequestButton = document.querySelector("[data-copy-request]");
const callLink = document.querySelector("[data-call-link]");
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

const BASE_PRICE_PER_METER = 30000;
const TURNKEY_PRICE_PER_METER = 45000;
const BASE_AREA = 56;
const STEP_LABELS = ["Дом", "Площадь и участок", "Телефон"];

let currentLeadMessage = "";
let hasSubmitted = false;
let currentStep = 0;
let maxStep = 0;
let lastQuizTrigger = null;

const formatPrice = (value) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

const updateHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

const updateMobileCta = () => {
  const shouldShow = window.matchMedia("(max-width: 760px)").matches && window.scrollY > 320;
  document.body.classList.toggle("show-mobile-cta", shouldShow);
};

const setMenuOpen = (isOpen) => {
  header.classList.toggle("is-menu-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
};

const openQuiz = (trigger = null) => {
  lastQuizTrigger = trigger;
  quizModal.classList.add("is-open");
  quizModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-quiz-open");
  setMenuOpen(false);
  setTimeout(() => {
    const activeStep = quizSteps[currentStep];
    const focusTarget = activeStep?.querySelector(".is-selected:not([disabled]), button:not([disabled]), input, textarea");
    focusTarget?.focus({ preventScroll: true });
  }, 120);
};

const closeQuiz = () => {
  quizModal.classList.remove("is-open");
  quizModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-quiz-open");
  lastQuizTrigger?.focus?.({ preventScroll: true });
};

const setHiddenField = (name, value) => {
  const field = hiddenFields.find((input) => input.name === name);
  if (field) field.value = value;
};

const getSelectedFeatures = (formData) => {
  const selected = formData.getAll("features").map((value) => String(value).trim());
  return selected.length ? selected : ["Комплектацию нужно уточнить"];
};

const normalizeArea = (value) => {
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return BASE_AREA;
  return Math.max(24, Math.min(180, Math.round(parsed)));
};

const getFormData = () => {
  const formData = new FormData(leadForm);
  return {
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    purpose: String(formData.get("purpose") || "").trim(),
    floors: String(formData.get("floors") || "").trim(),
    plot: String(formData.get("plot") || "").trim(),
    finish: String(formData.get("finish") || "Базовый домокомплект").trim(),
    location: String(formData.get("location") || "").trim(),
    contactMethod: String(formData.get("contactMethod") || "").trim(),
    contactTime: String(formData.get("contactTime") || "").trim(),
    message: String(formData.get("message") || "").trim(),
    features: getSelectedFeatures(formData),
    area: normalizeArea(formData.get("area") || BASE_AREA),
  };
};

const getPricePerMeter = (finish) =>
  finish.toLowerCase().includes("под ключ") ? TURNKEY_PRICE_PER_METER : BASE_PRICE_PER_METER;

const normalizePhone = (phone) => phone.replace(/[^\d+]/g, "");

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

const buildLeadMessage = (data, price, pricePerMeter) => {
  const lines = [
    "Заявка на расчет СИП-дома",
    `Имя: ${data.name || "не указано"}`,
    `Телефон: ${data.phone || "не указан"}`,
    `Канал связи: ${data.contactMethod || "не указан"}, ${data.contactTime || "время не указано"}`,
    `Назначение: ${data.purpose}`,
    `Площадь: ${data.area} м²`,
    `Этажность: ${data.floors}`,
    `Участок: ${data.plot}`,
    `Город или район: ${data.location || "не указан"}`,
    `Комплектация: ${data.finish}`,
    "Производство: собственные СИП-панели, можно показать цех и материалы",
    `Что входит в базу: ${data.features.join(", ")}`,
    `Ориентир: ${formatPrice(price)} (${formatPrice(pricePerMeter)} за м²)`,
  ];

  if (data.message) {
    lines.push(`Комментарий: ${data.message}`);
  }

  return lines.join("\n");
};

const updateDeliveryLinks = (message, phone) => {
  const encodedMessage = encodeURIComponent(message);
  const normalizedPhone = normalizePhone(phone);
  const phoneDigits = getPhoneDigits(phone);

  whatsappLink.href = `https://wa.me/?text=${encodedMessage}`;
  callLink.href = phoneDigits.length >= 10 ? `tel:${normalizedPhone}` : "#quiz";
};

const syncActiveChoices = () => {
  const data = getFormData();
  const formData = new FormData(leadForm);

  presetButtons.forEach((button) => {
    const isSelected =
      button.dataset.purpose === data.purpose &&
      button.dataset.floors === data.floors &&
      Number(button.dataset.area) === data.area;
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
    const formValue = String(formData.get(fieldName) || "");
    const isSelected = button.dataset.choiceValue === formValue;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const updateCalculator = () => {
  const data = getFormData();
  const pricePerMeter = getPricePerMeter(data.finish);
  const price = data.area * pricePerMeter;
  const phoneDigits = getPhoneDigits(data.phone);

  if (document.activeElement !== areaInput && String(areaInput.value) !== String(data.area)) {
    areaInput.value = data.area;
  }

  priceOutput.textContent = formatPrice(price);

  if (data.finish.toLowerCase().includes("под ключ")) {
    calcNote.textContent = "Дом под ключ считается отдельно: ориентир от 45 000 ₽/м², состав фиксируется в смете.";
  } else if (data.area === BASE_AREA) {
    calcNote.textContent = "Для дома 56 м²: 7 × 8 м, 1 этаж, свайный фундамент.";
  } else {
    calcNote.textContent =
      data.area < BASE_AREA
        ? "Компактный вариант для дачи, бани или гостевого дома."
        : "Точную планировку и комплектацию уточним перед сметой.";
  }

  summaryPurpose.textContent = `${data.purpose}, ${data.floors}, ${data.plot}`;
  summaryFeatures.textContent = `${data.finish}, свои СИП-панели, ввод коммуникаций, проект в подарок`;
  summaryContact.textContent =
    phoneDigits.length >= 10
      ? `${data.contactMethod}, ${data.phone}`
      : `${data.contactMethod}, телефон пока не указан`;

  currentLeadMessage = buildLeadMessage(data, price, pricePerMeter);
  updateDeliveryLinks(currentLeadMessage, data.phone);
  syncActiveChoices();

  if (!hasSubmitted || phoneDigits.length >= 10) {
    phoneInput.setAttribute("aria-invalid", "false");
  }
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
        : activeStep.querySelector(".is-selected:not([disabled]), button:not([disabled]), input, textarea");
    setTimeout(() => focusTarget?.focus({ preventScroll: true }), 80);
  }
};

const setArea = (value) => {
  areaInput.value = normalizeArea(value);
  updateCalculator();
};

const copyLeadMessage = async () => {
  try {
    await navigator.clipboard.writeText(currentLeadMessage);
    if (formStatus) formStatus.textContent = "Текст заявки скопирован. Можно отправить в Max.";
  } catch {
    if (formStatus) formStatus.textContent = currentLeadMessage;
  }
};

window.addEventListener("scroll", () => {
  updateHeader();
  updateMobileCta();
}, { passive: true });

window.addEventListener("resize", updateMobileCta);

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
    setHiddenField("floors", button.dataset.floors);
    setArea(button.dataset.area);
    setStep(1);
  });
});

areaButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setArea(button.dataset.areaOption);
  });
});

choiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setHiddenField(button.dataset.choiceName, button.dataset.choiceValue);
    updateCalculator();
  });
});

nextStepButtons.forEach((button) => {
  button.addEventListener("click", () => setStep(currentStep + 1));
});

prevStepButtons.forEach((button) => {
  button.addEventListener("click", () => setStep(currentStep - 1));
});

stepNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setStep(Number(button.dataset.stepNav));
  });
});

leadForm.addEventListener("input", updateCalculator);
leadForm.addEventListener("change", updateCalculator);

areaInput.addEventListener("blur", () => {
  setArea(areaInput.value);
});

phoneInput.addEventListener("focus", () => {
  if (!phoneInput.value) phoneInput.value = "+7 ";
});

phoneInput.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
  updateCalculator();
});

copyRequestButton.addEventListener("click", copyLeadMessage);

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  hasSubmitted = true;
  updateCalculator();

  const data = getFormData();
  const phoneDigits = getPhoneDigits(data.phone);

  if (phoneDigits.length < 10) {
    phoneInput.setAttribute("aria-invalid", "true");
    formStatus.textContent = "Укажите телефон, чтобы Евгений смог связаться по расчету.";
    phoneInput.focus();
    return;
  }

  phoneInput.setAttribute("aria-invalid", "false");
  formStatus.textContent =
    "Заявка готова: откройте WhatsApp или скопируйте текст для Max.";
  closeQuiz();
  requestSummary.scrollIntoView({ behavior: "smooth", block: "start" });
});

if ("IntersectionObserver" in window && quizSection && mobileQuickCta) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      document.body.classList.toggle("is-quiz-visible", entry.isIntersecting && entry.intersectionRatio > 0.18);
    },
    { threshold: [0, 0.18, 0.4] },
  );
  observer.observe(quizSection);
}

updateHeader();
updateMobileCta();
updateCalculator();
setStep(0, false);
