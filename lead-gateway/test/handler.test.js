"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createHandler, handler } = require("../index");

const originalEnvironment = {
  LEAD_ORIGIN: process.env.LEAD_ORIGIN,
  LEAD_ORIGINS: process.env.LEAD_ORIGINS,
  MAX_BOT_TOKEN: process.env.MAX_BOT_TOKEN,
  MAX_CHAT_ID: process.env.MAX_CHAT_ID,
  MAX_API_BASE: process.env.MAX_API_BASE,
  MAX_MANAGER_USER_ID: process.env.MAX_MANAGER_USER_ID,
  MAX_MANAGER_NAME: process.env.MAX_MANAGER_NAME,
  MAX_EVGENIY_USER_ID: process.env.MAX_EVGENIY_USER_ID,
  MAX_EVGENIY_NAME: process.env.MAX_EVGENIY_NAME,
};

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function leadEvent(payload, overrides = {}) {
  return {
    httpMethod: "POST",
    path: "/v1/leads",
    headers: {
      Origin: "https://sipdom-krd.ru",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    ...overrides,
  };
}

function validLead() {
  return {
    purpose: "Дом для семьи",
    area: 72,
    floors: "1 этаж",
    phone: "8 (999) 123-45-67",
    source: "https://sipdom-krd.ru/#quiz",
  };
}

test.afterEach(() => {
  restoreEnvironment();
});

test("health check does not require an Origin header", async () => {
  const result = await handler({ httpMethod: "GET", path: "/health" });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { status: "ok" });
});

test("direct function root works as a health check", async () => {
  const result = await handler({ httpMethod: "GET", path: "/" });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { status: "ok" });
});

test("rejects a request from a different origin", async () => {
  const result = await handler(leadEvent(validLead(), {
    headers: { Origin: "https://example.com", "Content-Type": "application/json" },
  }));

  assert.equal(result.statusCode, 403);
  assert.deepEqual(JSON.parse(result.body), { status: "forbidden" });
});

test("allows the configured www origin", async () => {
  process.env.MAX_BOT_TOKEN = "token";
  process.env.MAX_CHAT_ID = "123";
  const calls = [];
  const testHandler = createHandler({
    maxRequest: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200 };
    },
  });

  const result = await testHandler(leadEvent({
    ...validLead(),
    source: "https://www.sipdom-krd.ru/#quiz",
  }, {
    headers: { Origin: "https://www.sipdom-krd.ru", "Content-Type": "application/json" },
  }));

  assert.equal(result.statusCode, 201);
  assert.equal(calls.length, 1);
  assert.match(JSON.parse(calls[0].options.body).text, /Страница: \/#quiz/);
});

test("validates the lead before attempting delivery", async () => {
  process.env.MAX_BOT_TOKEN = "token";
  process.env.MAX_CHAT_ID = "123";
  const testHandler = createHandler({
    maxRequest: async () => assert.fail("MAX must not be called for invalid data"),
  });

  const result = await testHandler(leadEvent({ ...validLead(), area: 12 }));

  assert.equal(result.statusCode, 400);
  assert.equal(JSON.parse(result.body).status, "invalid_lead");
});

test("normalizes and sends a lead to MAX", async () => {
  process.env.MAX_BOT_TOKEN = "test-token";
  process.env.MAX_CHAT_ID = "987654";
  process.env.MAX_MANAGER_USER_ID = "101";
  process.env.MAX_MANAGER_NAME = "Менеджер SIP";
  process.env.MAX_EVGENIY_USER_ID = "202";
  process.env.MAX_EVGENIY_NAME = "Евгений Тестов";
  const calls = [];
  const testHandler = createHandler({
    maxRequest: async (url, options) => {
      calls.push({ url: String(url), options });
      return { ok: true, status: 200 };
    },
  });

  const result = await testHandler(leadEvent(validLead()));
  const response = JSON.parse(result.body);
  const payload = JSON.parse(calls[0].options.body);
  const message = payload.text;

  assert.equal(result.statusCode, 201);
  assert.equal(response.status, "accepted");
  assert.match(response.leadId, /^[0-9a-f-]{36}$/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://platform-api2.max.ru/messages?chat_id=987654");
  assert.equal(calls[0].options.headers.Authorization, "test-token");
  assert.match(message, /Новая заявка с сайта SIP PRO/);
  assert.match(message, /Телефон: \+7 \(999\) 123-45-67/);
  assert.match(message, /Сценарий: Дом для семьи/);
  assert.match(message, /Площадь: 72 м²/);
  assert.match(message, /Этажность: 1 этаж/);
  assert.match(message, /\[Менеджер SIP\]\(max:\/\/user\/101\)/);
  assert.match(message, /\[Евгений Тестов\]\(max:\/\/user\/202\)/);
  assert.deepEqual(payload.attachments, [{
    type: "contact",
    payload: {
      name: `Клиент SIP PRO #${response.leadId.slice(0, 8)}`,
      vcf_phone: "TEL;TYPE=CELL:+79991234567",
      vcf_info: `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Клиент SIP PRO #${response.leadId.slice(0, 8)}\r\nTEL;TYPE=CELL:+79991234567\r\nEND:VCARD\r\n`,
    },
  }]);
});

test("returns a neutral error when MAX does not accept the lead", async () => {
  process.env.MAX_BOT_TOKEN = "test-token";
  process.env.MAX_CHAT_ID = "987654";
  const testHandler = createHandler({ maxRequest: async () => ({ ok: false, status: 401 }) });

  const result = await testHandler(leadEvent(validLead()));

  assert.equal(result.statusCode, 502);
  assert.deepEqual(JSON.parse(result.body), { status: "delivery_failed" });
});
