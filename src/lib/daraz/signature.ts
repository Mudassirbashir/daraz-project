import crypto from "crypto";

/**
 * Calculates HMAC-SHA256 signature for Daraz / Lazada Open Platform API requests.
 * Complies strictly with official Daraz Open Platform (IOP) protocol:
 * 1. apiPath must start with leading slash (e.g. "/orders/get", "/product/price_quantity/update")
 * 2. Parameter keys sorted in ASCII ascending order (excluding 'sign' & null/undefined)
 * 3. String to sign = apiPath + key1 + value1 + key2 + value2 ... (raw unencoded values)
 * 4. HMAC-SHA256 using appSecret, returned as uppercase hex string.
 */
export function generateDarazSignature(
  apiPath: string,
  params: Record<string, any>,
  appSecret: string
): string {
  const cleanPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const cleanSecret = (appSecret || "").trim();

  // Filter out 'sign' and null/undefined values, then sort parameter keys alphabetically (ASCII order)
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== null)
    .sort();

  // Concatenate path + key1value1key2value2...
  let stringToSign = cleanPath;
  for (const key of sortedKeys) {
    const val = params[key];
    const valStr = typeof val === "object" ? JSON.stringify(val) : String(val);
    stringToSign += `${key}${valStr}`;
  }

  // Cross-runtime Node & Web Crypto compatibility
  try {
    if (typeof crypto !== "undefined" && typeof crypto.createHmac === "function") {
      return crypto
        .createHmac("sha256", cleanSecret)
        .update(stringToSign, "utf8")
        .digest("hex")
        .toUpperCase();
    }
  } catch (_) {}

  // Fallback for Edge / Web Crypto runtimes
  try {
    const nodeCrypto = require("crypto");
    return nodeCrypto
      .createHmac("sha256", cleanSecret)
      .update(stringToSign, "utf8")
      .digest("hex")
      .toUpperCase();
  } catch (err: any) {
    throw new Error(`HMAC-SHA256 signature calculation failed: ${err.message}`);
  }
}
