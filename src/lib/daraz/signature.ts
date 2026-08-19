export interface DarazSignParams {
  [key: string]: string | number | boolean | undefined | null;
}

export function normalizeApiPath(apiPath: string): string {
  if (!apiPath) return '/';
  const cleanPath = apiPath.replace(/^https?:\/\/[^\/]+/, '');
  return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
}

export function buildSignString(apiPath: string, params: DarazSignParams): string {
  const normalizedPath = normalizeApiPath(apiPath);
  const filteredKeys = Object.keys(params).filter((key) => {
    return key !== 'sign' && params[key] !== undefined && params[key] !== null && params[key] !== '';
  });

  filteredKeys.sort();

  let signString = normalizedPath;
  for (const key of filteredKeys) {
    signString += `${key}${String(params[key])}`;
  }
  return signString;
}

export async function generateHmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function signDarazRequest(
  apiPath: string,
  params: DarazSignParams,
  appSecret: string
): Promise<string> {
  if (!appSecret) throw new Error('[Daraz Signature] Missing appSecret');
  const signString = buildSignString(apiPath, params);
  return generateHmacSha256(signString, appSecret);
}

export async function verifyDarazWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !appSecret) return false;
  const computed = await generateHmacSha256(rawBody, appSecret);
  return computed.toUpperCase() === signatureHeader.trim().toUpperCase();
}

/**
 * Backward compatibility alias for legacy callers & test suite
 */
export const generateDarazSignature = signDarazRequest;
