const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelectorAll(".main-nav a");
const areaRange = document.querySelector("#area-range");
const areaOutput = document.querySelector("#area-output");
const priceOutput = document.querySelector("#price-output");
const calcNote = document.querySelector("#calc-note");
const leadForm = document.querySelector("[data-lead-form]");
const formStatus = document.querySelector("[data-form-status]");

const PRICE_PER_METER = 25000;
const BASE_AREA = 56;

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

const updateCalculator = () => {
  const area = Number(areaRange.value);
  const price = area * PRICE_PER_METER;

  areaOutput.value = area;
  priceOutput.textContent = formatPrice(price);

  if (area === BASE_AREA) {
    calcNote.textContent = "Для дома 56 м²: 7 × 8 м, 1 этаж, свайный фундамент.";
    return;
  }

  calcNote.textContent =
    area < BASE_AREA
      ? "Компактный вариант для дачи, бани или гостевого дома."
      : "Большая площадь требует отдельной планировки и уточнения комплектации.";
};

window.addEventListener("scroll", updateHeader, { passive: true });
navToggle.addEventListener("click", () => {
  setMenuOpen(!header.classList.contains("is-menu-open"));
});
navLinks.forEach((link) => {
  link.addEventListener("click", () => setMenuOpen(false));
});
areaRange.addEventListener("input", updateCalculator);
leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(leadForm);
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!phone) {
    formStatus.textContent = "Добавьте телефон, чтобы заявку можно было передать продавцу.";
    return;
  }

  const appeal = name ? `${name}, заявка подготовлена.` : "Заявка подготовлена.";
  formStatus.textContent = `${appeal} Сейчас ее можно отправить продавцу через Avito или подключить отправку на телефон/мессенджер.`;
});

updateHeader();
updateCalculator();
