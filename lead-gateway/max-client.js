"use strict";

const { readFileSync } = require("node:fs");
const { request } = require("node:https");
const { join } = require("node:path");

// MAX uses the Russian Trusted CA chain. The bundle is downloaded from the
// official Gosuslugi source and scopes this additional trust to MAX requests.
const maxTrustedCa = readFileSync(join(__dirname, "certs", "russiantrustedca.pem"));

function requestMax(url, { method = "GET", headers = {}, body = "", timeoutMs = 7000 } = {}) {
  const target = url instanceof URL ? url : new URL(url);
  if (target.protocol !== "https:") throw new Error("MAX API must use HTTPS");

  return new Promise((resolve, reject) => {
    const req = request(target, {
      method,
      headers,
      ca: maxTrustedCa,
      minVersion: "TLSv1.2",
    }, (res) => {
      const chunks = [];
      res.on("error", reject);
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const status = res.statusCode || 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    req.setTimeout(timeoutMs, () => req.destroy(new Error("MAX request timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { requestMax };
