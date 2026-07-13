const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelectorAll(".main-nav a");
const areaRange = document.querySelector("#area-range");
const areaOutput = document.querySelector("#area-output");
const priceOutput = document.querySelector("#price-output");
const calcNote = document.querySelector("#calc-note");
const leadForm = document.querySelector("[data-lead-form]");
const formStatus = document.querySelector("[data-form-status]");
const requestSummary = document.querySelector("[data-request-summary]");
const summaryPurpose = document.querySelector("[data-summary-purpose]");
const summaryFeatures = document.querySelector("[data-summary-features]");
const summaryContact = document.querySelector("[data-summary-contact]");
const whatsappLink = document.querySelector("[data-whatsapp-link]");
const copyRequestButton = document.querySelector("[data-copy-request]");
const callLink = document.querySelector("[data-call-link]");

const PRICE_PER_METER = 25000;
const BASE_AREA = 56;

let currentLeadMessage = "";

const formatPrice = (value) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

const updateHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

const setMenuOpen = (isOpen) => {
  header.classList.toggle("is-menu-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
};

const getSelectedFeatures = (formData) => {
  const selected = formData.getAll("features").map((value) => String(value).trim());
  return selected.length ? selected : ["Комплектацию нужно уточнить"];
};

const getFormData = () => {
  const formData = new FormData(leadForm);
  return {
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    purpose: String(formData.get("purpose") || "").trim(),
    floors: String(formData.get("floors") || "").trim(),
    plot: String(formData.get("plot") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    contactMethod: String(formData.get("contactMethod") || "").trim(),
    contactTime: String(formData.get("contactTime") || "").trim(),
    message: String(formData.get("message") || "").trim(),
    features: getSelectedFeatures(formData),
    area: Number(areaRange.value),
  };
};

const normalizePhone = (phone) => phone.replace(/[^\d+]/g, "");

const getPhoneDigits = (phone) => phone.replace(/\D/g, "");

const buildLeadMessage = (data, price) => {
  const lines = [
    "Заявка на подготовку проекта СИП-дома",
    `Имя: ${data.name || "не указано"}`,
    `Телефон: ${data.phone || "не указан"}`,
    `Канал связи: ${data.contactMethod || "не указан"}, ${data.contactTime || "время не указано"}`,
    `Назначение: ${data.purpose}`,
    `Площадь: ${data.area} м²`,
    `Этажность: ${data.floors}`,
    `Участок: ${data.plot}`,
    `Город или район: ${data.location || "не указан"}`,
    `Что включить: ${data.features.join(", ")}`,
    `Ориентир бюджета: ${formatPrice(price)}`,
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

const updateCalculator = () => {
  const data = getFormData();
  const price = data.area * PRICE_PER_METER;
  const phoneDigits = getPhoneDigits(data.phone);

  areaOutput.value = data.area;
  priceOutput.textContent = formatPrice(price);

  if (data.area === BASE_AREA) {
    calcNote.textContent = "Для дома 56 м²: 7 × 8 м, 1 этаж, свайный фундамент.";
  } else {
    calcNote.textContent =
      data.area < BASE_AREA
        ? "Компактный вариант для дачи, бани или гостевого дома."
        : "Большая площадь требует отдельной планировки и уточнения комплектации.";
  }

  summaryPurpose.textContent = `${data.purpose}, ${data.floors}`;
  summaryFeatures.textContent = data.features.join(", ");
  summaryContact.textContent =
    phoneDigits.length >= 10
      ? `${data.contactMethod}, ${data.phone}`
      : `${data.contactMethod}, телефон пока не указан`;

  currentLeadMessage = buildLeadMessage(data, price);
  updateDeliveryLinks(currentLeadMessage, data.phone);
};

const copyLeadMessage = async () => {
  try {
    await navigator.clipboard.writeText(currentLeadMessage);
    formStatus.textContent = "Текст заявки скопирован. Его можно вставить в Max.";
  } catch {
    formStatus.textContent = currentLeadMessage;
  }
};

window.addEventListener("scroll", updateHeader, { passive: true });
navToggle.addEventListener("click", () => {
  setMenuOpen(!header.classList.contains("is-menu-open"));
});
navLinks.forEach((link) => {
  link.addEventListener("click", () => setMenuOpen(false));
});
leadForm.addEventListener("input", updateCalculator);
leadForm.addEventListener("change", updateCalculator);
copyRequestButton.addEventListener("click", copyLeadMessage);
leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateCalculator();

  const data = getFormData();
  const phoneDigits = getPhoneDigits(data.phone);

  if (phoneDigits.length < 10) {
    formStatus.textContent = "Добавьте корректный телефон, чтобы заявку можно было передать Евгению.";
    return;
  }

  formStatus.textContent =
    "Заявка сформирована. Ее можно открыть в WhatsApp или скопировать для отправки в Max.";
  requestSummary.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

updateHeader();
updateCalculator();
