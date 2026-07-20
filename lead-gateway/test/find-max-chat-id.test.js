"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { extractChatEvents, formatTimestamp } = require("../scripts/find-max-chat-id");

test("keeps only unique chat IDs from bot additions and messages", () => {
  const chats = extractChatEvents([
    { update_type: "message_created", chat_id: 10 },
    { update_type: "bot_added", chat_id: 22, timestamp: 1, is_channel: false },
    { update_type: "bot_added", chat_id: 22, timestamp: 2, is_channel: false },
    { update_type: "bot_added", chat_id: "33" },
    {
      update_type: "message_created",
      timestamp: 3,
      is_channel: true,
      message: { recipient: { chat: { chat_id: 44 } } },
    },
  ]);

  assert.deepEqual(chats, [
    { chatId: 10, updateType: "message_created", timestamp: null, isChannel: false },
    { chatId: 22, updateType: "bot_added", timestamp: "1970-01-01T00:00:01.000Z", isChannel: false },
    { chatId: 44, updateType: "message_created", timestamp: "1970-01-01T00:00:03.000Z", isChannel: true },
  ]);
});

test("accepts Unix timestamps in seconds and milliseconds", () => {
  assert.equal(formatTimestamp(1), "1970-01-01T00:00:01.000Z");
  assert.equal(formatTimestamp(1_700_000_000_000), "2023-11-14T22:13:20.000Z");
});
