import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export function payFastProcessUrl(mode = 'sandbox') {
  return String(mode).toLowerCase() === 'live'
    ? 'https://www.payfast.co.za/eng/process'
    : 'https://sandbox.payfast.co.za/eng/process';
}

export function payFastValidationUrl(mode = 'sandbox') {
  return String(mode).toLowerCase() === 'live'
    ? 'https://www.payfast.co.za/eng/query/validate'
    : 'https://sandbox.payfast.co.za/eng/query/validate';
}

export function payFastApiUrl(token, action, mode = 'sandbox') {
  const safeToken = String(token || '').trim();
  const safeAction = String(action || '').trim().toLowerCase();
  if (!/^[a-zA-Z0-9-]{20,160}$/.test(safeToken)) throw new Error('Invalid PayFast subscription token.');
  if (!['fetch', 'pause', 'unpause', 'cancel', 'update'].includes(safeAction)) throw new Error('Invalid PayFast subscription action.');
  const testing = String(mode).toLowerCase() === 'live' ? '' : '?testing=true';
  return `https://api.payfast.co.za/subscriptions/${encodeURIComponent(safeToken)}/${safeAction}${testing}`;
}

export function payFastCardUpdateUrl(token, returnUrl, mode = 'sandbox') {
  const safeToken = String(token || '').trim();
  if (!/^[a-zA-Z0-9-]{20,160}$/.test(safeToken)) throw new Error('Invalid PayFast subscription token.');
  const host = String(mode).toLowerCase() === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
  const query = String(returnUrl || '').trim() ? `?return=${encodeURIComponent(String(returnUrl).trim())}` : '';
  return `https://${host}/eng/recurring/update/${encodeURIComponent(safeToken)}${query}`;
}

export function phpUrlEncode(value) {
  return encodeURIComponent(String(value ?? '').trim())
    .replace(/%20/g, '+')
    .replace(/[!'()~]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function signaturePayload(fields, passphrase = '') {
  const pairs = [];
  for (const [key, rawValue] of Object.entries(fields || {})) {
    if (key === 'signature' || rawValue === undefined || rawValue === null || String(rawValue).trim() === '') continue;
    pairs.push(`${key}=${phpUrlEncode(rawValue)}`);
  }
  if (String(passphrase || '').trim()) pairs.push(`passphrase=${phpUrlEncode(passphrase)}`);
  return pairs.join('&');
}

export function createPayFastSignature(fields, passphrase = '') {
  return createHash('md5').update(signaturePayload(fields, passphrase)).digest('hex');
}

export function apiSignaturePayload(fields, passphrase = '') {
  const values = { ...(fields || {}) };
  delete values.signature;
  delete values.testing;
  if (String(passphrase || '').trim()) values.passphrase = String(passphrase).trim();
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${phpUrlEncode(value)}`)
    .join('&');
}

export function createPayFastApiSignature(fields, passphrase = '') {
  return createHash('md5').update(apiSignaturePayload(fields, passphrase)).digest('hex');
}

export function payFastApiTimestamp(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) throw new Error('Invalid PayFast API timestamp.');
  return value.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function verifyPayFastSignature(fields, passphrase = '') {
  const supplied = String(fields?.signature || '').trim().toLowerCase();
  const expected = createPayFastSignature(fields, passphrase).toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(supplied) || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function parsePayFastBody(rawBody) {
  const fields = {};
  for (const [key, value] of new URLSearchParams(String(rawBody || '')).entries()) fields[key] = value;
  return fields;
}

export function validationBody(fields) {
  return Object.entries(fields || {})
    .filter(([key, value]) => key !== 'signature' && value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${key}=${phpUrlEncode(value)}`)
    .join('&');
}

export function moneyString(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid PayFast amount.');
  return amount.toFixed(2);
}

export function checkoutReference(prefix = 'WR') {
  return `${String(prefix || 'WR').replace(/[^A-Z0-9-]/gi, '').slice(0, 16)}-${randomUUID()}`.slice(0, 100);
}

export function dateAfterDays(days) {
  const safeDays = Math.max(1, Math.min(365, Math.round(Number(days) || 30)));
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + safeDays);
  return date.toISOString().slice(0, 10);
}

export function normalizePaymentStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'COMPLETE') return 'complete';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'FAILED') return 'failed';
  if (status === 'REFUNDED') return 'refunded';
  if (status === 'REVERSED') return 'reversed';
  return 'pending';
}
