import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { checkoutReference, dateAfterDays, fromSubunit, isPaystackCheckoutUrl, paystackEventKey, toSubunit, verifyPaystackWebhookSignature } from './paystack.js';

test('Paystack currency conversion uses cents', () => {
  assert.equal(toSubunit(194), 19400);
  assert.equal(toSubunit(166.25), 16625);
  assert.equal(fromSubunit(19400), 194);
});

test('Paystack webhook signature validation uses SHA512 HMAC', () => {
  const secret = 'sk_test_example';
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'WR-123' } });
  const signature = createHmac('sha512', secret).update(body).digest('hex');
  assert.equal(verifyPaystackWebhookSignature(secret, body, signature), true);
  assert.equal(verifyPaystackWebhookSignature(secret, `${body}x`, signature), false);
});

test('Paystack checkout validation only accepts hosted checkout', () => {
  assert.equal(isPaystackCheckoutUrl('https://checkout.paystack.com/abc123'), true);
  assert.equal(isPaystackCheckoutUrl('https://evil.example/abc123'), false);
});

test('reference and event keys are stable enough for idempotency', () => {
  assert.match(checkoutReference('WR-MEM'), /^WR-MEM-[A-Z0-9.-]+$/);
  const event = { event: 'charge.success', data: { reference: 'WR-1', id: 42, amount: 19400 } };
  assert.equal(paystackEventKey(event), paystackEventKey(event));
  assert.equal(paystackEventKey(event).length, 64);
});

test('dateAfterDays returns an ISO date', () => {
  assert.match(dateAfterDays(30), /^\d{4}-\d{2}-\d{2}$/);
});
