#!/usr/bin/env node
"use strict";

const { requestMax } = require("../max-client");

const DEFAULT_API_BASE = "https://platform-api2.max.ru";

function formatTimestamp(timestamp) {
  if (!Number.isFinite(timestamp)) return null;
  const milliseconds = timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
  return new Date(milliseconds).toISOString();
}

function getChatId(update) {
  const candidates = [
    update?.chat_id,
    update?.message?.recipient?.chat_id,
    update?.message?.recipient?.chat?.chat_id,
    update?.message?.chat?.chat_id,
  ];

  return candidates.find((candidate) => Number.isInteger(candidate)) || null;
}

function extractChatEvents(updates) {
  const knownIds = new Set();

  return (Array.isArray(updates) ? updates : [])
    .map((update) => ({ update, chatId: getChatId(update) }))
    .filter(({ update, chatId }) => (
      update
      && ["bot_added", "message_created"].includes(update.update_type)
      && chatId !== null
    ))
    .filter(({ chatId }) => {
      if (knownIds.has(chatId)) return false;
      knownIds.add(chatId);
      return true;
    })
    .map(({ update, chatId }) => ({
      chatId,
      updateType: update.update_type,
      timestamp: formatTimestamp(update.timestamp),
      isChannel: Boolean(update.is_channel),
    }));
}

async function main() {
  const token = String(process.env.MAX_BOT_TOKEN || "").trim();
  const apiBase = String(process.env.MAX_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");

  if (!token) {
    throw new Error("Не задана временная переменная MAX_BOT_TOKEN.");
  }

  const endpoint = new URL(`${apiBase}/updates`);
  endpoint.searchParams.set("types", "bot_added,message_created");
  endpoint.searchParams.set("limit", "100");

  const response = await requestMax(endpoint, {
    headers: { Authorization: token },
    // MAX waits up to 30 seconds for an update when Long Polling is used.
    timeoutMs: 35_000,
  });

  if (!response.ok) {
    throw new Error(`MAX вернул HTTP ${response.status}. Проверь токен и отсутствие активного webhook.`);
  }

  const payload = JSON.parse(response.body);
  const chats = extractChatEvents(payload.updates);

  if (!chats.length) {
    console.error("События нужного чата не найдены. Добавь бота в чат или отправь новое сообщение в нём, затем запусти скрипт ещё раз.");
    process.exitCode = 2;
    return;
  }

  for (const chat of chats) {
    const kind = chat.isChannel ? "канал" : "чат";
    const time = chat.timestamp ? `, событие ${chat.timestamp}` : "";
    console.log(`${kind}: ${chat.chatId}, событие ${chat.updateType}${time}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { extractChatEvents, formatTimestamp };
