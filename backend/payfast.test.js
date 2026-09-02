import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkoutReference,
  createPayFastSignature,
  dateAfterDays,
  moneyString,
  normalizePaymentStatus,
  parsePayFastBody,
  phpUrlEncode,
  signaturePayload,
  verifyPayFastSignature,
} from './payfast.js';

test('PayFast encoding follows form-url-encoded rules', () => {
  assert.equal(phpUrlEncode('We Rise & BackMi'), 'We+Rise+%26+BackMi');
  assert.equal(phpUrlEncode("Oom's plan"), 'Oom%27s+plan');
});

test('signature ignores an existing signature and blank fields', () => {
  const fields = { merchant_id: '10000100', amount: '194.00', item_name: 'We-Rise', blank: '' };
  const signature = createPayFastSignature(fields, 'secret phrase');
  assert.match(signature, /^[a-f0-9]{32}$/);
  assert.equal(signaturePayload({ ...fields, signature }, 'secret phrase'), signaturePayload(fields, 'secret phrase'));
  assert.equal(verifyPayFastSignature({ ...fields, signature }, 'secret phrase'), true);
  assert.equal(verifyPayFastSignature({ ...fields, amount: '195.00', signature }, 'secret phrase'), false);
});

test('ITN form body parser preserves PayFast fields', () => {
  const fields = parsePayFastBody('m_payment_id=WR-123&amount_gross=166.00&payment_status=COMPLETE');
  assert.deepEqual(fields, { m_payment_id: 'WR-123', amount_gross: '166.00', payment_status: 'COMPLETE' });
});

test('money and checkout references are safe', () => {
  assert.equal(moneyString(194), '194.00');
  assert.throws(() => moneyString(-1));
  assert.match(checkoutReference('WR-MEM'), /^WR-MEM-[0-9a-f-]+$/);
  assert.match(dateAfterDays(30), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(normalizePaymentStatus('COMPLETE'), 'complete');
  assert.equal(normalizePaymentStatus('FAILED'), 'failed');
});
