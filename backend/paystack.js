import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const API_BASE = 'https://api.paystack.co';
const CHECKOUT_ORIGIN = 'https://checkout.paystack.com';

export function checkoutReference(prefix = 'WR') {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${stamp}-${random}`.replace(/[^A-Z0-9.-]/g, '').slice(0, 100);
}

export function dateAfterDays(days) {
  const value = Math.max(0, Math.min(3650, Number(days) || 0));
  const date = new Date(Date.now() + value * 86400000);
  return date.toISOString().slice(0, 10);
}

export function toSubunit(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new Error('Invalid Paystack amount.');
  return Math.round((numeric + Number.EPSILON) * 100);
}

export function fromSubunit(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return 0;
  return numeric / 100;
}

export function isPaystackCheckoutUrl(value) {
  try {
    return new URL(String(value || '')).origin === CHECKOUT_ORIGIN;
  } catch {
    return false;
  }
}

export function verifyPaystackWebhookSignature(secretKey, rawBody, signature) {
  const secret = String(secretKey || '');
  const supplied = String(signature || '').trim().toLowerCase();
  if (!secret || !/^[a-f0-9]{128}$/.test(supplied)) return false;
  const expected = createHmac('sha512', secret).update(String(rawBody || '')).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(supplied, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function paystackEventKey(event) {
  const stable = JSON.stringify({
    event: String(event?.event || ''),
    reference: String(event?.data?.reference || event?.data?.transaction?.reference || ''),
    transactionId: String(event?.data?.id || event?.data?.transaction?.id || ''),
    subscriptionCode: String(event?.data?.subscription_code || event?.data?.subscription?.subscription_code || ''),
    invoiceCode: String(event?.data?.invoice_code || ''),
    status: String(event?.data?.status || ''),
    amount: String(event?.data?.amount || ''),
    paidAt: String(event?.data?.paid_at || event?.data?.paidAt || ''),
  });
  return createHash('sha256').update(stable).digest('hex');
}

export function cleanPaystackPayload(value, depth = 0) {
  if (depth > 5) return null;
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.slice(0, 50).map(item => cleanPaystackPayload(item, depth + 1));
  if (typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 100)) {
      output[String(key).slice(0, 100)] = cleanPaystackPayload(item, depth + 1);
    }
    return output;
  }
  if (typeof value === 'string') return value.slice(0, 2000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value).slice(0, 2000);
}

export async function paystackRequest(secretKey, path, { method = 'GET', body = null, timeoutMs = 20000 } = {}) {
  const secret = String(secretKey || '').trim();
  if (!secret) throw new Error('Paystack is not configured.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status !== true) {
      const error = new Error(payload?.message || `Paystack request failed (${response.status}).`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload.data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Paystack did not respond in time. Please try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function initializePaystackTransaction(secretKey, payload) {
  return paystackRequest(secretKey, '/transaction/initialize', { method: 'POST', body: payload });
}

export function verifyPaystackTransaction(secretKey, reference) {
  return paystackRequest(secretKey, `/transaction/verify/${encodeURIComponent(reference)}`);
}

export function createPaystackSubscription(secretKey, payload) {
  return paystackRequest(secretKey, '/subscription', { method: 'POST', body: payload });
}

export function disablePaystackSubscription(secretKey, code, token) {
  return paystackRequest(secretKey, '/subscription/disable', { method: 'POST', body: { code, token } });
}

export function generatePaystackManageLink(secretKey, code) {
  return paystackRequest(secretKey, `/subscription/${encodeURIComponent(code)}/manage/link`);
}


export function fetchPaystackPlan(secretKey, code) {
  return paystackRequest(secretKey, `/plan/${encodeURIComponent(code)}`);
}

export function fetchPaystackSubscription(secretKey, code) {
  return paystackRequest(secretKey, `/subscription/${encodeURIComponent(code)}`);
}
