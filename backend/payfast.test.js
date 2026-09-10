import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiSignaturePayload,
  checkoutReference,
  createPayFastApiSignature,
  createPayFastSignature,
  dateAfterDays,
  moneyString,
  normalizePaymentStatus,
  parsePayFastBody,
  payFastApiTimestamp,
  payFastApiUrl,
  payFastCardUpdateUrl,
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

test('PayFast API signatures sort fields and exclude the sandbox testing flag', () => {
  const fields = {
    version: 'v1',
    testing: 'true',
    timestamp: '2026-09-10T12:00:00Z',
    'merchant-id': '10000100',
  };
  assert.equal(
    apiSignaturePayload(fields, 'secret phrase'),
    'merchant-id=10000100&passphrase=secret+phrase&timestamp=2026-09-10T12%3A00%3A00Z&version=v1',
  );
  assert.match(createPayFastApiSignature(fields, 'secret phrase'), /^[a-f0-9]{32}$/);
});

test('PayFast subscription URLs stay on PayFast and switch sandbox safely', () => {
  const token = 'dc0521d3-55fe-269b-fa00-b647310d760f';
  assert.equal(payFastApiUrl(token, 'cancel', 'sandbox'), `https://api.payfast.co.za/subscriptions/${token}/cancel?testing=true`);
  assert.equal(payFastApiUrl(token, 'fetch', 'live'), `https://api.payfast.co.za/subscriptions/${token}/fetch`);
  assert.equal(
    payFastCardUpdateUrl(token, 'https://werise-mu.vercel.app/?card=updated', 'live'),
    `https://www.payfast.co.za/eng/recurring/update/${token}?return=https%3A%2F%2Fwerise-mu.vercel.app%2F%3Fcard%3Dupdated`,
  );
  assert.equal(payFastApiTimestamp(new Date('2026-09-10T12:00:00.123Z')), '2026-09-10T12:00:00Z');
  assert.throws(() => payFastApiUrl('bad', 'cancel', 'live'));
});
