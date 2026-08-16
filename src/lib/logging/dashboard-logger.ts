/**
 * Dashboard Error Logging Utility
 * Logs structured diagnostic information to Vercel Runtime Logs using console.error.
 * Ensures zero secrets, tokens, keys, cookies, or authorization headers are exposed.
 */

export interface SafeErrorDiagnostic {
  operation: string;
  name?: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  stack?: string;
}

const SENSITIVE_PATTERNS = [
  /sb_secret_[a-zA-Z0-9_-]+/gi,
  /sb_publishable_[a-zA-Z0-9_-]+/gi,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi, // JWT tokens
  /cPQFbmld[a-zA-Z0-9_-]+/gi,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /cookie:\s*[^;\n]+/gi,
  /authorization:\s*[^;\n]+/gi,
];

function sanitizeString(str: string): string {
  if (!str) return str;
  let cleaned = str;
  SENSITIVE_PATTERNS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, "[REDACTED_SECRET]");
  });
  return cleaned;
}

export function logDashboardError(operation: string, error: any): SafeErrorDiagnostic {
  const diagnostic: SafeErrorDiagnostic = {
    operation: sanitizeString(operation),
    name: error?.name ? sanitizeString(String(error.name)) : undefined,
    message: error?.message ? sanitizeString(String(error.message)) : sanitizeString(String(error || "Unknown error")),
    code: error?.code ? sanitizeString(String(error.code)) : undefined,
    details: error?.details ? sanitizeString(String(error.details)) : undefined,
    hint: error?.hint ? sanitizeString(String(error.hint)) : undefined,
    stack: error?.stack ? sanitizeString(String(error.stack)) : undefined,
  };

  console.error(`[DASHBOARD FATAL ERROR] [${diagnostic.operation}]:`, diagnostic);

  return diagnostic;
}
