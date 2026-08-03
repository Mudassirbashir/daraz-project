import crypto from "crypto";

/**
 * Calculates HMAC-SHA256 signature for Daraz Open Platform API requests.
 * @param apiPath Endpoint path (e.g. "/products/get")
 * @param params Query/body parameter dictionary
 * @param appSecret Daraz App Secret key
 */
export function generateDarazSignature(
  apiPath: string,
  params: Record<string, string | number | boolean>,
  appSecret: string
): string {
  // Sort parameters alphabetically by key
  const sortedKeys = Object.keys(params).sort();

  // Concatenate apiPath + key1value1key2value2...
  let stringToSign = apiPath;
  for (const key of sortedKeys) {
    stringToSign += `${key}${params[key]}`;
  }

  // Compute HMAC-SHA256 and return UPPERCASE hexadecimal string
  return crypto
    .createHmac("sha256", appSecret)
    .update(stringToSign, "utf8")
    .digest("hex")
    .toUpperCase();
}
