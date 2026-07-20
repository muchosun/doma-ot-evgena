"use strict";

const { randomUUID } = require("node:crypto");
const { requestMax } = require("./max-client");

const PURPOSES = new Set(["Дом для себя", "Дом для семьи", "Индивидуальное решение"]);
const FLOORS = new Set(["1 этаж", "2 этажа", "Мансарда"]);
const MAX_MESSAGE_LIMIT = 4000;

function allowedOrigins() {
  const configured = String(
    process.env.LEAD_ORIGINS
      || process.env.LEAD_ORIGIN
      || "https://sipdom-krd.ru,https://www.sipdom-krd.ru",
  );

  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);
}

function getHeader(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const target = name.toLowerCase();
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === target);
  const value = key ? headers[key] : "";
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function getRequest(event) {
  const request = event && typeof event === "object" ? event : {};
  const headers = request.headers || {};
  const method = String(
    request.httpMethod || request.requestContext?.httpMethod || request.requestContext?.http?.method || "POST",
  ).toUpperCase();

  return { headers, method, request };
}

function parseBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") {
    const body = request.isBase64Encoded
      ? Buffer.from(request.body, "base64").toString("utf8")
      : request.body;
    return JSON.parse(body);
  }

  if (request && typeof request === "object" && "phone" in request) return request;
  throw new Error("Request body is missing");
}

function formatPhone(rawPhone) {
  let digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.startsWith("8") && digits.length === 11) digits = `7${digits.slice(1)}`;
  if (!/^7\d{10}$/.test(digits)) return null;

  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

function formatPhoneTarget(phone) {
  return String(phone).replace(/\D/g, "");
}

function parseArea(rawArea) {
  const area = typeof rawArea === "string"
    ? Number(rawArea.replace(",", "."))
    : Number(rawArea);
  if (!Number.isFinite(area) || area < 24 || area > 240) return null;
  return Math.round(area);
}

function formatArea(area) {
  return `${new Intl.NumberFormat("ru-RU").format(area)} м²`;
}

function formatContactName(lead) {
  return `Клиент SIP PRO #${lead.id.slice(0, 8)}`;
}

function formatContactAttachment(lead) {
  const name = formatContactName(lead);
  const phone = `+${formatPhoneTarget(lead.phone)}`;
  const vcfInfo = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `TEL;TYPE=CELL:${phone}`,
    "END:VCARD",
    "",
  ].join("\r\n");

  return [{
    type: "contact",
    payload: {
      name,
      vcf_phone: `TEL;TYPE=CELL:${phone}`,
      vcf_info: vcfInfo,
    },
  }];
}

function formatMentions() {
  const recipients = [
    { id: process.env.MAX_MANAGER_USER_ID, name: process.env.MAX_MANAGER_NAME },
    { id: process.env.MAX_EVGENIY_USER_ID, name: process.env.MAX_EVGENIY_NAME },
  ];

  return recipients
    .map(({ id, name }) => ({ id: String(id || "").trim(), name: String(name || "").trim() }))
    .filter(({ id, name }) => /^-?\d+$/.test(id) && name)
    .map(({ id, name }) => `[${name}](max://user/${id})`);
}

function normalizeSource(rawSource, origins) {
  try {
    const url = new URL(String(rawSource || ""));
    if (origins.includes(url.origin)) return `${url.pathname}${url.search}${url.hash}`.slice(0, 240);
  } catch {
    // Source is only manager-facing metadata. Invalid values are replaced below.
  }
  return "/";
}

function validateLead(payload, origins) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "Некорректные данные заявки." };
  }

  if (typeof payload.website === "string" && payload.website.trim()) {
    return { ok: true, honeypot: true };
  }

  const purpose = String(payload.purpose || "").trim();
  const floors = String(payload.floors || "").trim();
  const area = parseArea(payload.area);
  const phone = formatPhone(payload.phone);

  if (!PURPOSES.has(purpose)) return { ok: false, message: "Выберите сценарий строительства." };
  if (area === null) return { ok: false, message: "Укажите площадь от 24 до 240 м²." };
  if (!FLOORS.has(floors)) return { ok: false, message: "Выберите этажность." };
  if (!phone) return { ok: false, message: "Укажите корректный номер телефона." };

  return {
    ok: true,
    lead: {
      id: randomUUID(),
      purpose,
      area,
      floors,
      phone,
      source: normalizeSource(payload.source, origins),
      receivedAt: new Date().toISOString(),
    },
  };
}

function formatMaxMessage(lead) {
  const mentions = formatMentions();
  const lines = [
    "Новая заявка с сайта SIP PRO",
    `Заявка: #${lead.id.slice(0, 8)}`,
    `Телефон: ${lead.phone}`,
    `Сценарий: ${lead.purpose}`,
    `Площадь: ${formatArea(lead.area)}`,
    `Этажность: ${lead.floors}`,
    "Производство: СИП-панели собственного цеха",
  ];

  if (mentions.length) lines.push(`Ответственные: ${mentions.join(" ")}`);
  lines.push(`Страница: ${lead.source}`);
  return lines.join("\n").slice(0, MAX_MESSAGE_LIMIT);
}

async function sendToMax(lead, maxRequest = requestMax) {
  const token = String(process.env.MAX_BOT_TOKEN || "").trim();
  const chatId = String(process.env.MAX_CHAT_ID || "").trim();
  const apiBase = String(process.env.MAX_API_BASE || "https://platform-api2.max.ru").replace(/\/$/, "");

  if (!token || !chatId) {
    throw new Error("MAX delivery is not configured");
  }

  const endpoint = new URL(`${apiBase}/messages`);
  endpoint.searchParams.set("chat_id", chatId);

  const response = await maxRequest(endpoint, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: formatMaxMessage(lead),
      attachments: formatContactAttachment(lead),
      format: "markdown",
      notify: true,
      disable_link_preview: true,
    }),
  });

  if (!response.ok) throw new Error(`MAX responded with ${response.status}`);
}

function response(statusCode, body, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "600";
    headers.Vary = "Origin";
  }

  return { statusCode, headers, body: JSON.stringify(body) };
}

function createHandler({ maxRequest = requestMax } = {}) {
  return async function handler(event) {
    const { headers, method, request } = getRequest(event);
    const origins = allowedOrigins();
    const requestOrigin = getHeader(headers, "origin");
    const path = String(request.path || request.rawPath || request.requestContext?.http?.path || "");
    const corsOrigin = origins.includes(requestOrigin) ? requestOrigin : "";

    if (method === "GET" && (!path || path === "/" || path === "/health" || path.endsWith("/health"))) {
      return response(200, { status: "ok" });
    }

    if (!corsOrigin) {
      return response(403, { status: "forbidden" });
    }

    if (method === "OPTIONS") return response(204, {}, corsOrigin);
    if (method !== "POST") return response(405, { status: "method_not_allowed" }, corsOrigin);

    const contentType = getHeader(headers, "content-type");
    if (contentType && !contentType.toLowerCase().startsWith("application/json")) {
      return response(415, { status: "unsupported_media_type" }, corsOrigin);
    }

    let payload;
    try {
      payload = parseBody(request);
    } catch {
      return response(400, { status: "invalid_json" }, corsOrigin);
    }

    const result = validateLead(payload, origins);
    if (!result.ok) return response(400, { status: "invalid_lead", message: result.message }, corsOrigin);
    if (result.honeypot) return response(202, { status: "accepted" }, corsOrigin);

    try {
      await sendToMax(result.lead, maxRequest);
    } catch (error) {
      console.error(`[lead] ${result.lead.id} was not delivered: ${error.message}`);
      return response(502, { status: "delivery_failed" }, corsOrigin);
    }

    console.info(`[lead] ${result.lead.id} delivered`);
    return response(201, { status: "accepted", leadId: result.lead.id }, corsOrigin);
  };
}

const handler = createHandler();

module.exports = {
  handler,
  createHandler,
  formatMaxMessage,
  sendToMax,
  validateLead,
};
