const header = document.querySelector("[data-header]");
const areaRange = document.querySelector("#area-range");
const areaOutput = document.querySelector("#area-output");
const priceOutput = document.querySelector("#price-output");
const calcNote = document.querySelector("#calc-note");

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
areaRange.addEventListener("input", updateCalculator);

updateHeader();
updateCalculator();
