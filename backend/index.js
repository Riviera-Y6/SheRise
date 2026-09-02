import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  createPayFastSignature,
  parsePayFastBody,
  payFastProcessUrl,
  payFastValidationUrl,
  validationBody,
  verifyPayFastSignature,
  moneyString,
  checkoutReference,
  dateAfterDays,
  normalizePaymentStatus,
} from './payfast.js';

const app = new Hono();

const MAX_COMMUNITY_CHARS = 250;
const FREE_PRIVATE_MESSAGE_CHARS = 150;
const PREMIUM_PRIVATE_MESSAGE_CHARS = 2000;
const MAX_MESSAGE_PAGE_SIZE = 30;
const MAX_BACKMI_DOCUMENTS = 10;
const MAX_BACKMI_DOCUMENT_SIZE = 5 * 1024 * 1024;
const PROFILE_COLUMNS = 'member_key, auth_user_id, email, display_name, plan, role, membership_status, trial_started_at, trial_ends_at, joining_paid_at, subscription_started_at, subscription_next_billing_date, subscription_cancelled_at, subscription_monthly_amount_zar, subscription_grace_ends_at, created_at, updated_at, last_seen_at';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const TWILIO_ACCOUNT_SID = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
const TWILIO_AUTH_TOKEN = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
const TWILIO_FROM_NUMBER = String(process.env.TWILIO_FROM_NUMBER || '').trim();
const EMERGENCY_SMS_ENABLED = String(process.env.ENABLE_EMERGENCY_SMS || '').trim().toLowerCase() === 'true';
const SMS_CONFIGURED = Boolean(EMERGENCY_SMS_ENABLED && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
const PAYFAST_MODE = String(process.env.PAYFAST_MODE || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
const PAYFAST_MERCHANT_ID = String(process.env.PAYFAST_MERCHANT_ID || '').trim();
const PAYFAST_MERCHANT_KEY = String(process.env.PAYFAST_MERCHANT_KEY || '').trim();
const PAYFAST_PASSPHRASE = String(process.env.PAYFAST_PASSPHRASE || '').trim();
const PAYFAST_ENABLED = String(process.env.ENABLE_PAYFAST || '').trim().toLowerCase() === 'true';
const BACKMI_PAYMENTS_ENABLED = String(process.env.ENABLE_BACKMI_PAYMENTS || '').trim().toLowerCase() === 'true';
const API_PUBLIC_URL = String(process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
const PAYFAST_IP_ALLOWLIST = new Set(String(process.env.PAYFAST_IP_ALLOWLIST || '').split(',').map(value => value.trim()).filter(Boolean));
const ADMIN_EMAILS = new Set(String(process.env.WE_RISE_ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
const BACKMI_REVIEWER_EMAILS = new Set(String(process.env.BACKMI_REVIEWER_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
const PAYFAST_CREDENTIALS_CONFIGURED = Boolean(PAYFAST_MERCHANT_ID && PAYFAST_MERCHANT_KEY && PAYFAST_PASSPHRASE);
const PAYFAST_CONFIGURED = Boolean(PAYFAST_ENABLED && PAYFAST_CREDENTIALS_CONFIGURED);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy backend/.env.example to backend/.env for local development, or set the variables in Render.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const configuredFrontendUrls = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
const allowedOrigins = new Set(configuredFrontendUrls);
const primaryFrontendUrl = configuredFrontendUrls[0] || 'http://localhost:5173';

app.use('/api/*', cors({
  origin: (origin) => {
    if (!origin) return '*';
    const normalized = origin.replace(/\/$/, '');
    if (normalized === 'http://localhost:5173' || normalized === 'http://127.0.0.1:5173') return origin;
    return allowedOrigins.has(normalized) ? origin : '';
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}));

function fail(c, error, status = 500) {
  console.error(error);
  return c.json({ error: error?.message || String(error || 'Unexpected server error.') }, status);
}

function cleanMemberKey(value) {
  const key = String(value || '').trim();
  return key.length >= 8 && key.length <= 120 ? key : '';
}

function cleanName(value, fallback = 'Anonymous We-Rise Lady') {
  const name = String(value || '').trim();
  return name ? name.slice(0, 80) : fallback;
}

function cleanPhone(value) {
  return String(value || '').trim().replace(/[^0-9+]/g, '').slice(0, 32);
}

function configuredRole(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (ADMIN_EMAILS.has(normalized)) return 'admin';
  if (BACKMI_REVIEWER_EMAILS.has(normalized)) return 'backmi_reviewer';
  return 'member';
}

function isReviewer(profile) {
  return profile?.role === 'admin' || profile?.role === 'backmi_reviewer';
}

function membershipSummary(profile) {
  const now = Date.now();
  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : 0;
  const graceEnd = profile?.subscription_grace_ends_at ? new Date(profile.subscription_grace_ends_at).getTime() : 0;
  const administrativeAccess = isReviewer(profile);
  let status = String(profile?.membership_status || 'trialing');

  if (status === 'trialing' && trialEnd && trialEnd <= now) status = 'trial_expired';
  if (status === 'past_due' && graceEnd && graceEnd <= now) status = 'suspended';

  const trialActive = status === 'trialing' && trialEnd > now;
  const paidActive = status === 'active';
  return {
    status,
    access_allowed: administrativeAccess || trialActive || paidActive || (status === 'past_due' && graceEnd > now),
    trial_active: trialActive,
    trial_started_at: profile?.trial_started_at || null,
    trial_ends_at: profile?.trial_ends_at || null,
    trial_days_remaining: trialActive ? Math.max(1, Math.ceil((trialEnd - now) / 86400000)) : 0,
    joining_paid_at: profile?.joining_paid_at || null,
    subscription_started_at: profile?.subscription_started_at || null,
    next_billing_date: profile?.subscription_next_billing_date || null,
    cancelled_at: profile?.subscription_cancelled_at || null,
    monthly_amount_zar: profile?.subscription_monthly_amount_zar ? Number(profile.subscription_monthly_amount_zar) : null,
  };
}

function safeProfile(profile) {
  if (!profile) return null;
  return {
    member_key: profile.member_key,
    auth_user_id: profile.auth_user_id,
    email: profile.email,
    display_name: profile.display_name,
    plan: profile.plan,
    role: profile.role || 'member',
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    last_seen_at: profile.last_seen_at,
  };
}

async function getPaymentSettings() {
  const { data, error } = await supabase.from('payment_settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return data;
}

function publicPaymentSettings(settings) {
  return {
    trial_days: Number(settings.trial_days),
    joining_fee_usd: Number(settings.joining_fee_usd),
    joining_fee_zar: Number(settings.joining_fee_zar),
    monthly_fee_usd: Number(settings.monthly_fee_usd),
    monthly_fee_zar: Number(settings.monthly_fee_zar),
    backmi_allocation_usd: Number(settings.backmi_allocation_usd),
    backmi_allocation_zar: Number(settings.backmi_allocation_zar),
    backmi_allocation_mode: settings.backmi_allocation_mode,
    backmi_allocation_percentage: Number(settings.backmi_allocation_percentage),
    allocation_fee_basis: settings.allocation_fee_basis,
    first_recurring_delay_days: Number(settings.first_recurring_delay_days),
    minimum_gift_zar: Number(settings.minimum_gift_zar),
    maximum_gift_zar: Number(settings.maximum_gift_zar),
    membership_payments_enabled: Boolean(settings.membership_payments_enabled && PAYFAST_CONFIGURED),
    backmi_gifts_enabled: Boolean(settings.backmi_gifts_enabled && PAYFAST_CONFIGURED && BACKMI_PAYMENTS_ENABLED),
    payfast_mode: PAYFAST_MODE,
    payfast_configured: PAYFAST_CONFIGURED,
    payouts_enabled: false,
  };
}

function cleanPayFastPayload(fields) {
  const payload = {};
  for (const [key, value] of Object.entries(fields || {}).slice(0, 100)) {
    if (key === 'signature') continue;
    payload[String(key).slice(0, 100)] = String(value || '').slice(0, 1000);
  }
  return payload;
}

function payFastClientIp(c) {
  const forwarded = String(c.req.header('x-forwarded-for') || '').split(',')[0].trim();
  const remote = String(c.env?.incoming?.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  return forwarded || remote;
}

function apiOrigin(c) {
  if (API_PUBLIC_URL) return API_PUBLIC_URL;
  try { return new URL(c.req.url).origin; } catch { return '';
  }
}

function splitName(displayName) {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || 'We-Rise', last: parts.slice(1).join(' ') || 'Member' };
}

function signedPayFastFields(fields) {
  return { ...fields, signature: createPayFastSignature(fields, PAYFAST_PASSPHRASE) };
}

async function validatePayFastServer(fields) {
  const response = await fetch(payFastValidationUrl(PAYFAST_MODE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: validationBody(fields),
  });
  if (!response.ok) return false;
  return (await response.text()).trim() === 'VALID';
}


function communityPolicyError(value) {
  const content = String(value || '').trim();
  if (!content) return '';

  const hasExternalLink = /(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+(?:com|co\.za|net|org|shop|store|online|biz|io)\b)/i.test(content);
  const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(content);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(content);
  const hasSocialHandle = /(^|\s)@[a-z0-9_.]{3,}\b/i.test(content);
  const hasDirectPromotion = /\b(?:dm me|message me|inbox me|whatsapp me|contact me|call me|order now|buy now|book now|shop now|use my code|promo code|discount code|special offer|for sale|i sell|we sell|my business|my services?|my products?|follow my|visit my|link in bio|stuur my (?:'n|’n|n) boodskap|whatsapp my|kontak my|bel my|bestel nou|koop nou|bespreek nou|te koop|ek verkoop|ons verkoop|my besigheid|my dienste?|my produkte?|volg my|afslagkode|promosiekode|spesiale aanbod)\b/i.test(content);

  if (hasDirectPromotion) {
    return 'Advertising, selling, self-promotion and business solicitation are not allowed in the We-Rise Community.';
  }

  if (hasExternalLink || hasEmail || hasPhone || hasSocialHandle) {
    return 'External links and contact details are not allowed in Community posts or comments. This helps keep We-Rise safe and free from advertising.';
  }

  return '';
}


function privateMessagePolicyError(value) {
  const content = String(value || '').trim();
  if (!content) return '';

  const hasExternalLink = /(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+(?:com|co\.za|net|org|shop|store|online|biz|io)\b)/i.test(content);
  const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(content);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(content);
  const hasSocialHandle = /(^|\s)@[a-z0-9_.]{3,}\b/i.test(content);
  const hasCommercialLanguage = /\b(?:business|businesses|product|products|service|services|customer|customers|client|clients|sale|sales|discount|special|offer|offers|shop|store|brand|marketing|advertis(?:e|ing)|business|besigheid|besighede|produk|produkte|diens|dienste|kli[eë]nt|kliente|verkoop|afslag|aanbieding|winkel|handelsmerk|bemark|adverteer)\b/i.test(content);
  const hasDirectPromotion = /\b(?:dm me|message me|inbox me|whatsapp me|contact me|call me|order now|buy now|book now|shop now|use my code|promo code|discount code|special offer|for sale|i sell|we sell|my business|my services?|my products?|follow my|visit my|link in bio|stuur my (?:'n|’n|n) boodskap|whatsapp my|kontak my|bel my|bestel nou|koop nou|bespreek nou|te koop|ek verkoop|ons verkoop|my besigheid|my dienste?|my produkte?|volg my|afslagkode|promosiekode|spesiale aanbod)\b/i.test(content);

  if (hasDirectPromotion || (hasCommercialLanguage && (hasExternalLink || hasEmail || hasPhone || hasSocialHandle))) {
    return 'Unsolicited business advertising and self-promotion are not allowed in We-Rise Messages.';
  }

  return '';
}

function profileNameFromUser(user) {
  const metadataName = String(user?.user_metadata?.display_name || user?.user_metadata?.full_name || '').trim();
  if (metadataName) return cleanName(metadataName, 'We-Rise Lady');
  const email = String(user?.email || '').trim();
  return cleanName(email ? email.split('@')[0] : '', 'We-Rise Lady');
}

async function ensureMemberProfile(user) {
  if (!user?.id) throw new Error('Authenticated user is missing an id.');
  const now = new Date().toISOString();
  const email = String(user.email || '').trim().toLowerCase().slice(0, 320) || null;

  const { data: existing, error: existingError } = await supabase.from('member_profiles')
    .select(PROFILE_COLUMNS)
    .eq('member_key', user.id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const role = configuredRole(email);
    const membership = membershipSummary(existing);
    const { data, error } = await supabase.from('member_profiles')
      .update({
        auth_user_id: user.id,
        email,
        role,
        membership_status: membership.status,
        updated_at: now,
        last_seen_at: now,
      })
      .eq('member_key', user.id)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw error;
    return data;
  }

  const settings = await getPaymentSettings();
  const trialStartedAt = new Date();
  const trialEndsAt = new Date(trialStartedAt.getTime() + Number(settings.trial_days || 7) * 86400000);
  const { data, error } = await supabase.from('member_profiles').insert({
    member_key: user.id,
    auth_user_id: user.id,
    email,
    display_name: profileNameFromUser(user),
    role: configuredRole(email),
    membership_status: 'trialing',
    trial_started_at: trialStartedAt.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    updated_at: now,
    last_seen_at: now,
  }).select(PROFILE_COLUMNS).single();
  if (error) throw error;
  return data;
}

function bearerToken(c) {
  const header = String(c.req.header('authorization') || '').trim();
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

async function authContext(c, required = true) {
  const token = bearerToken(c);
  if (!token) {
    return required ? { response: c.json({ error: 'Log in to use this We-Rise feature.', code: 'AUTH_REQUIRED' }, 401) } : null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return required ? { response: c.json({ error: 'Your session is no longer valid. Please log in again.', code: 'INVALID_SESSION' }, 401) } : null;
  }
  const profile = await ensureMemberProfile(data.user);
  return { user: data.user, memberKey: data.user.id, profile, membership: membershipSummary(profile) };
}

async function memberAccessContext(c) {
  const auth = await authContext(c);
  if (auth.response) return auth;
  if (!auth.membership.access_allowed) {
    return {
      ...auth,
      response: c.json({
        error: 'Your We-Rise trial has ended. Complete membership to use this feature.',
        code: 'MEMBERSHIP_REQUIRED',
        membership: auth.membership,
      }, 402),
    };
  }
  return auth;
}

async function reviewerContext(c, adminOnly = false) {
  const auth = await authContext(c);
  if (auth.response) return auth;
  const allowed = adminOnly ? auth.profile.role === 'admin' : isReviewer(auth.profile);
  if (!allowed) return { ...auth, response: c.json({ error: 'BackMi reviewer access is required.', code: 'REVIEWER_REQUIRED' }, 403) };
  return auth;
}

function buildEmergencyMessage({ name, locationText, latitude, longitude }) {
  const mapUrl = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `https://maps.google.com/?q=${latitude},${longitude}`
    : '';
  const location = locationText || mapUrl || 'Location not supplied';
  return `WE-RISE SAFETY ALERT: ${name || 'A We-Rise member'} needs you to check on her immediately. Location: ${location}${mapUrl && locationText ? ` | Map: ${mapUrl}` : ''}`.slice(0, 1500);
}

async function sendTwilioSms(to, body) {
  if (!SMS_CONFIGURED) return { accepted: false, reason: 'not_configured' };
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`;
  const payload = new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body });
  const authorization = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) return { accepted: false, error: data?.message || `SMS provider returned ${response.status}` };
  return { accepted: true, provider_id: data?.sid || null, status: data?.status || 'queued' };
}

function formatContribution(row, memberNames = new Map()) {
  return {
    id: row.id,
    amount: Number(row.amount_zar || 0),
    donor: memberNames.get(row.donor_member_key) || 'We-Rise Lady',
    date: row.created_at ? String(row.created_at).slice(0, 10) : null,
    time: row.created_at ? String(row.created_at).slice(11, 19) : null,
    status: row.contribution_status,
  };
}

function formatCampaign(campaign, contributions = []) {
  return {
    ...campaign,
    goal: Number(campaign.goal || 0),
    raised: Number(campaign.raised || 0),
    backers: Number(campaign.backers || 0),
    outstanding: Math.max(0, Number(campaign.goal || 0) - Number(campaign.raised || 0)),
    createdAt: campaign.created_at,
    donations: contributions,
    dailyDonations: contributions,
  };
}

async function contributionsForCampaigns(campaignIds) {
  if (!campaignIds.length) return new Map();
  const { data: contributions, error } = await supabase.from('backmi_contributions')
    .select('id, request_id, donor_member_key, amount_zar, contribution_status, created_at')
    .in('request_id', campaignIds)
    .eq('contribution_status', 'confirmed')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const memberKeys = [...new Set((contributions || []).map(item => item.donor_member_key).filter(Boolean))];
  const names = new Map();
  if (memberKeys.length) {
    const { data: members, error: memberError } = await supabase.from('member_profiles')
      .select('member_key, display_name')
      .in('member_key', memberKeys);
    if (memberError) throw memberError;
    for (const member of members || []) names.set(member.member_key, member.display_name);
  }

  const grouped = new Map();
  for (const contribution of contributions || []) {
    if (!grouped.has(contribution.request_id)) grouped.set(contribution.request_id, []);
    grouped.get(contribution.request_id).push(formatContribution(contribution, names));
  }
  return grouped;
}

app.get('/', (c) => c.json({ app: 'We-Rise API', status: 'online' }));

app.get('/api/health', async (c) => {
  const { error } = await supabase.from('member_profiles').select('member_key').limit(1);
  if (error) return c.json({ status: 'degraded', app: 'We-Rise', database: 'unavailable', error: error.message }, 503);
  return c.json({ status: 'ok', app: 'We-Rise', database: 'supabase' });
});

app.get('/api/auth/profile', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    return c.json({
      user: { id: auth.user.id, email: auth.user.email || null },
      profile: safeProfile(auth.profile),
      membership: auth.membership,
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/billing/config', async (c) => {
  try {
    const settings = await getPaymentSettings();
    return c.json(publicPaymentSettings(settings));
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/billing/status', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    const [{ data: payments, error: paymentError }, settings] = await Promise.all([
      supabase.from('payment_transactions')
        .select('id, purpose, request_id, checkout_reference, pf_payment_id, currency, expected_amount_zar, amount_gross_zar, amount_fee_zar, amount_net_zar, item_name, status, created_at, verified_at')
        .eq('member_key', auth.memberKey)
        .order('created_at', { ascending: false })
        .limit(100),
      getPaymentSettings(),
    ]);
    if (paymentError) throw paymentError;
    return c.json({
      membership: auth.membership,
      profile: safeProfile(auth.profile),
      settings: publicPaymentSettings(settings),
      admin_settings: auth.profile.role === 'admin' ? {
        ...publicPaymentSettings(settings),
        membership_payments_enabled: Boolean(settings.membership_payments_enabled),
        backmi_gifts_enabled: Boolean(settings.backmi_gifts_enabled),
      } : undefined,
      payments: (payments || []).map(payment => ({
        ...payment,
        expected_amount_zar: Number(payment.expected_amount_zar || 0),
        amount_gross_zar: payment.amount_gross_zar === null ? null : Number(payment.amount_gross_zar),
        amount_fee_zar: payment.amount_fee_zar === null ? null : Number(payment.amount_fee_zar),
        amount_net_zar: payment.amount_net_zar === null ? null : Number(payment.amount_net_zar),
      })),
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/billing/membership/checkout', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    const membership = auth.membership;
    if (membership.status === 'active') return c.json({ error: 'Your We-Rise membership is already active.', code: 'ALREADY_ACTIVE' }, 409);
    if (membership.trial_active) {
      return c.json({
        error: `Your free trial still has ${membership.trial_days_remaining} day(s) remaining. No payment is due yet.`,
        code: 'TRIAL_ACTIVE',
        membership,
      }, 409);
    }
    if (membership.joining_paid_at) {
      return c.json({
        error: 'Your joining payment is already recorded. Please do not pay it again; the monthly subscription needs attention.',
        code: 'SUBSCRIPTION_ATTENTION',
        membership,
      }, 409);
    }

    const settings = await getPaymentSettings();
    if (!settings.membership_payments_enabled) return c.json({ error: 'We-Rise membership payments are temporarily unavailable.' }, 503);
    if (!PAYFAST_CONFIGURED) return c.json({ error: 'PayFast has not been configured on the We-Rise server yet.', code: 'PAYFAST_NOT_CONFIGURED' }, 503);

    const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent, error: recentError } = await supabase.from('payment_transactions')
      .select('checkout_reference, expected_amount_zar, metadata, created_at')
      .eq('member_key', auth.memberKey)
      .eq('purpose', 'membership_joining')
      .eq('status', 'pending')
      .gte('created_at', recentCutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentError) throw recentError;

    const reference = recent?.checkout_reference || checkoutReference('WR-MEM');
    const joiningFeeZar = recent ? Number(recent.expected_amount_zar) : Number(settings.joining_fee_zar);
    const monthlyFeeZar = recent?.metadata?.monthly_fee_zar ? Number(recent.metadata.monthly_fee_zar) : Number(settings.monthly_fee_zar);
    const firstBillingDate = recent?.metadata?.first_billing_date || dateAfterDays(settings.first_recurring_delay_days);

    if (!recent) {
      const { error } = await supabase.from('payment_transactions').insert({
        member_key: auth.memberKey,
        purpose: 'membership_joining',
        checkout_reference: reference,
        expected_amount_zar: Number(settings.joining_fee_zar),
        item_name: 'We-Rise Joining & Monthly Membership',
        status: 'pending',
        metadata: {
          joining_fee_usd: Number(settings.joining_fee_usd),
          joining_fee_zar: Number(settings.joining_fee_zar),
          monthly_fee_usd: Number(settings.monthly_fee_usd),
          monthly_fee_zar: Number(settings.monthly_fee_zar),
          first_billing_date: firstBillingDate,
        },
      });
      if (error) throw error;
    }

    const memberName = splitName(auth.profile.display_name);
    const fields = signedPayFastFields({
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: `${primaryFrontendUrl}/?payment=success&kind=membership`,
      cancel_url: `${primaryFrontendUrl}/?payment=cancelled&kind=membership`,
      notify_url: `${apiOrigin(c)}/api/payfast/itn`,
      name_first: memberName.first,
      name_last: memberName.last,
      email_address: auth.user.email || '',
      m_payment_id: reference,
      amount: moneyString(joiningFeeZar),
      item_name: 'We-Rise Joining & Monthly Membership',
      item_description: 'One-time We-Rise joining fee followed by monthly membership',
      custom_str1: 'membership_joining',
      custom_str2: auth.memberKey,
      subscription_type: 1,
      billing_date: firstBillingDate,
      recurring_amount: moneyString(monthlyFeeZar),
      frequency: 3,
      cycles: 0,
      subscription_notify_email: 1,
      subscription_notify_webhook: 1,
      subscription_notify_buyer: 1,
    });

    return c.json({ action: payFastProcessUrl(PAYFAST_MODE), fields, mode: PAYFAST_MODE });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/payfast/itn', async (c) => {
  try {
    if (!PAYFAST_CREDENTIALS_CONFIGURED) return c.text('PayFast is not configured', 503);
    const contentLength = Number(c.req.header('content-length') || 0);
    if (contentLength > 65536) return c.text('Payload too large', 413);
    const rawBody = await c.req.text();
    if (rawBody.length > 65536) return c.text('Payload too large', 413);
    const fields = parsePayFastBody(rawBody);

    if (PAYFAST_IP_ALLOWLIST.size) {
      const sourceIp = payFastClientIp(c);
      if (!sourceIp || !PAYFAST_IP_ALLOWLIST.has(sourceIp)) return c.text('Invalid source', 403);
    }
    if (String(fields.merchant_id || '') !== PAYFAST_MERCHANT_ID) return c.text('Invalid merchant', 400);
    if (!verifyPayFastSignature(fields, PAYFAST_PASSPHRASE)) return c.text('Invalid signature', 400);
    if (!(await validatePayFastServer(fields))) return c.text('Invalid PayFast notification', 400);

    const merchantReference = String(fields.m_payment_id || '').trim();
    const subscriptionToken = String(fields.token || '').trim();
    const pfPaymentId = String(fields.pf_payment_id || '').trim();
    const amountGross = Number(fields.amount_gross);
    if (!pfPaymentId || !Number.isFinite(amountGross) || amountGross <= 0) return c.text('Invalid payment details', 400);

    let { data: pending, error: pendingError } = await supabase.from('payment_transactions')
      .select('id, expected_amount_zar, purpose, member_key')
      .eq('checkout_reference', merchantReference)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingError) throw pendingError;

    if (!pending && subscriptionToken) {
      const { data: subscriptionMember, error: subscriptionError } = await supabase.from('member_profiles')
        .select('member_key, subscription_monthly_amount_zar')
        .eq('payfast_subscription_token', subscriptionToken)
        .maybeSingle();
      if (subscriptionError) throw subscriptionError;
      if (subscriptionMember) pending = {
        purpose: 'membership_recurring',
        member_key: subscriptionMember.member_key,
        expected_amount_zar: subscriptionMember.subscription_monthly_amount_zar,
      };
    }
    if (!pending) return c.text('Unknown payment reference', 400);
    if (Math.abs(Number(pending.expected_amount_zar) - amountGross) > 0.01) return c.text('Amount mismatch', 400);

    const normalizedStatus = normalizePaymentStatus(fields.payment_status);
    if (normalizedStatus !== 'complete') {
      if (pending.id) {
        await supabase.from('payment_transactions').update({ status: normalizedStatus, updated_at: new Date().toISOString() }).eq('id', pending.id);
      }
      if (pending.purpose === 'membership_recurring' && pending.member_key) {
        await supabase.from('member_profiles').update({
          membership_status: 'past_due',
          subscription_grace_ends_at: null,
          updated_at: new Date().toISOString(),
        }).eq('member_key', pending.member_key);
      }
      return c.text('OK', 200);
    }

    const billingDate = /^\d{4}-\d{2}-\d{2}$/.test(String(fields.billing_date || '')) ? fields.billing_date : null;
    const { data, error } = await supabase.rpc('finalize_payfast_payment', {
      p_merchant_reference: merchantReference || null,
      p_pf_payment_id: pfPaymentId,
      p_amount_gross: amountGross,
      p_amount_fee: Number(fields.amount_fee || 0),
      p_amount_net: Number(fields.amount_net || 0) || null,
      p_subscription_token: subscriptionToken || null,
      p_billing_date: billingDate,
      p_payload: cleanPayFastPayload(fields),
    });
    if (error) throw error;
    if (!data?.success) throw new Error('PayFast payment could not be finalised.');
    return c.text('OK', 200);
  } catch (error) {
    console.error('PayFast ITN failed', error);
    return c.text('Payment verification failed', 500);
  }
});

app.put('/api/admin/payment-settings', async (c) => {
  try {
    const auth = await reviewerContext(c, true);
    if (auth.response) return auth.response;
    const body = await c.req.json();
    const current = await getPaymentSettings();
    const number = (key, min, max) => {
      if (body[key] === undefined) return current[key];
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${key}.`);
      return value;
    };
    const next = {
      trial_days: Math.round(number('trial_days', 1, 90)),
      joining_fee_usd: number('joining_fee_usd', 0, 1000000),
      joining_fee_zar: number('joining_fee_zar', 1, 10000000),
      monthly_fee_usd: number('monthly_fee_usd', 0, 1000000),
      monthly_fee_zar: number('monthly_fee_zar', 1, 10000000),
      backmi_allocation_usd: number('backmi_allocation_usd', 0, 1000000),
      backmi_allocation_zar: number('backmi_allocation_zar', 0, 10000000),
      backmi_allocation_mode: ['fixed', 'percentage'].includes(body.backmi_allocation_mode) ? body.backmi_allocation_mode : current.backmi_allocation_mode,
      backmi_allocation_percentage: number('backmi_allocation_percentage', 0, 100),
      allocation_fee_basis: ['gross', 'net'].includes(body.allocation_fee_basis) ? body.allocation_fee_basis : current.allocation_fee_basis,
      first_recurring_delay_days: Math.round(number('first_recurring_delay_days', 1, 365)),
      minimum_gift_zar: number('minimum_gift_zar', 1, 10000000),
      maximum_gift_zar: number('maximum_gift_zar', 1, 10000000),
      membership_payments_enabled: body.membership_payments_enabled === undefined ? current.membership_payments_enabled : Boolean(body.membership_payments_enabled),
      backmi_gifts_enabled: body.backmi_gifts_enabled === undefined ? current.backmi_gifts_enabled : Boolean(body.backmi_gifts_enabled),
      updated_at: new Date().toISOString(),
      updated_by_member_key: auth.memberKey,
    };
    if (next.maximum_gift_zar < next.minimum_gift_zar) return c.json({ error: 'Maximum gift must be greater than the minimum gift.' }, 400);
    const { data, error } = await supabase.from('payment_settings').update(next).eq('id', 1).select('*').single();
    if (error) throw error;
    return c.json({
      ...publicPaymentSettings(data),
      membership_payments_enabled: Boolean(data.membership_payments_enabled),
      backmi_gifts_enabled: Boolean(data.backmi_gifts_enabled),
    });
  } catch (error) {
    return fail(c, error, /Invalid /.test(error?.message || '') ? 400 : 500);
  }
});


function sanitizeWealthPayload(input) {
  const source = input && typeof input === 'object' ? input : {};
  const n = (v, max = 1000000000) => {
    const value = Number(v);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(max, value));
  };
  const text = (v, max = 100) => String(v || '').trim().slice(0, max);
  const incomeStreams = Array.isArray(source.incomeStreams) ? source.incomeStreams.slice(0, 20).map((item, index) => ({
    id: text(item?.id || `income-${index}`, 80),
    name: text(item?.name, 80),
    amount: n(item?.amount),
  })) : [];
  const goals = Array.isArray(source.goals) ? source.goals.slice(0, 20).map((item, index) => ({
    id: text(item?.id || `goal-${index}`, 80),
    name: text(item?.name, 100),
    target: n(item?.target),
    saved: n(item?.saved),
  })) : [];
  return {
    monthlyIncome: n(source.monthlyIncome),
    monthlyExpenses: n(source.monthlyExpenses),
    emergencyFund: n(source.emergencyFund),
    liquidCapital: n(source.liquidCapital),
    assetsValue: n(source.assetsValue),
    debtBalance: n(source.debtBalance),
    debtStatus: ['unknown', 'debt_free', 'has_debt'].includes(source.debtStatus) ? source.debtStatus : (n(source.debtBalance) > 0 ? 'has_debt' : 'unknown'),
    assessed: {
      income: source.assessed?.income === true,
      protection: source.assessed?.protection === true,
      capital: source.assessed?.capital === true,
      assets: source.assessed?.assets === true,
      debt: source.assessed?.debt === true,
      retirement: source.assessed?.retirement === true,
    },
    age: Math.max(18, Math.min(100, Math.round(n(source.age, 100) || 30))),
    retirementAge: Math.max(30, Math.min(100, Math.round(n(source.retirementAge, 100) || 65))),
    retirementSavings: n(source.retirementSavings),
    retirementMonthlyContribution: n(source.retirementMonthlyContribution),
    retirementGrowthRate: Math.min(20, n(source.retirementGrowthRate, 20)),
    incomeStreams,
    goals,
    debtPlanner: {
      balance: n(source.debtPlanner?.balance),
      rate: Math.min(100, n(source.debtPlanner?.rate, 100)),
      payment: n(source.debtPlanner?.payment),
      extra: n(source.debtPlanner?.extra),
    },
    whatIf: {
      scenario: ['partner_income', 'job_loss', 'cannot_work', 'retirement'].includes(source.whatIf?.scenario) ? source.whatIf.scenario : 'partner_income',
      lostIncome: n(source.whatIf?.lostIncome),
    },
  };
}

app.get('/api/wealth', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { data, error } = await supabase.from('wealth_profiles')
      .select('data, updated_at')
      .eq('member_key', auth.memberKey)
      .maybeSingle();
    if (error) throw error;
    return c.json({ data: data?.data || {}, updated_at: data?.updated_at || null });
  } catch (error) {
    return fail(c, error);
  }
});

app.put('/api/wealth', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const body = await c.req.json();
    const clean = sanitizeWealthPayload(body?.data);
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('wealth_profiles').upsert({
      member_key: auth.memberKey,
      data: clean,
      updated_at: now,
    }, { onConflict: 'member_key' }).select('data, updated_at').single();
    if (error) throw error;
    return c.json({ success: true, data: data.data, updated_at: data.updated_at });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/campaigns', async (c) => {
  try {
    const { data: campaigns, error: campaignError } = await supabase.from('campaigns')
      .select('*')
      .in('status', ['active', 'target_reached'])
      .order('approved_at', { ascending: false, nullsFirst: false });
    if (campaignError) throw campaignError;
    const grouped = await contributionsForCampaigns((campaigns || []).map(item => item.id));
    return c.json((campaigns || []).map(campaign => formatCampaign(campaign, grouped.get(campaign.id) || [])));
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/campaigns', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { title, description, goal, reason, category, explanation, age, country, deadline } = await c.req.json();
    const cleanTitle = String(title || '').trim();
    const numericGoal = Number(goal);
    if (!cleanTitle || !Number.isFinite(numericGoal) || numericGoal <= 0) {
      return c.json({ error: 'A title and positive goal amount are required.' }, 400);
    }
    const { data, error } = await supabase.from('campaigns').insert({
      title: cleanTitle.slice(0, 250),
      description: String(description || '').trim(),
      goal: numericGoal,
      creator: auth.profile.display_name,
      creator_user_id: auth.user.id,
      reason: String(reason || '').trim().slice(0, 160) || null,
      category: String(category || '').trim().slice(0, 80) || 'Community support',
      explanation: String(explanation || description || '').trim().slice(0, 4000) || null,
      age: Number.isFinite(Number(age)) && Number(age) >= 18 && Number(age) <= 120 ? Number(age) : null,
      country: String(country || '').trim().slice(0, 80) || null,
      deadline: deadline ? String(deadline).slice(0, 10) : null,
      status: 'pending_review',
      submitted_at: new Date().toISOString(),
      payout_status: 'not_ready',
    }).select('id, request_code, status, submitted_at').single();
    if (error) throw error;
    return c.json({ ...data, success: true }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/campaigns/:id', async (c) => {
  try {
    const campaignId = c.req.param('id');
    const { data: campaign, error: campaignError } = await supabase.from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .in('status', ['active', 'target_reached'])
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) return c.json({ error: 'Not found' }, 404);
    const grouped = await contributionsForCampaigns([campaignId]);
    return c.json(formatCampaign(campaign, grouped.get(campaignId) || []));
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/backmi/my-requests', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    const { data, error } = await supabase.from('campaigns')
      .select('*')
      .eq('creator_user_id', auth.user.id)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return c.json((data || []).map(item => formatCampaign(item)));
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/backmi/review-queue', async (c) => {
  try {
    const auth = await reviewerContext(c);
    if (auth.response) return auth.response;
    const { data, error } = await supabase.from('campaigns')
      .select('*')
      .in('status', ['pending_review', 'info_required'])
      .order('submitted_at', { ascending: true });
    if (error) throw error;
    return c.json((data || []).map(item => formatCampaign(item)));
  } catch (error) {
    return fail(c, error);
  }
});

app.put('/api/backmi/requests/:id/review', async (c) => {
  try {
    const auth = await reviewerContext(c);
    if (auth.response) return auth.response;
    const requestId = c.req.param('id');
    const body = await c.req.json();
    const decision = String(body.decision || '').trim();
    if (!['approve', 'reject', 'info_required'].includes(decision)) {
      return c.json({ error: 'Choose approve, reject or request more information.' }, 400);
    }
    const { data: request, error: requestError } = await supabase.from('campaigns')
      .select('id, status, deadline')
      .eq('id', requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request) return c.json({ error: 'BackMi request not found.' }, 404);
    if (!['pending_review', 'info_required'].includes(request.status)) {
      return c.json({ error: 'This BackMi request has already been reviewed.' }, 409);
    }

    const maturityDate = body.maturity_date ? String(body.maturity_date).slice(0, 10) : request.deadline;
    if (decision === 'approve' && !/^\d{4}-\d{2}-\d{2}$/.test(String(maturityDate || ''))) {
      return c.json({ error: 'An approved request requires a maturity date.' }, 400);
    }
    const now = new Date().toISOString();
    const update = {
      status: decision === 'approve' ? 'active' : decision,
      reviewed_at: now,
      reviewed_by_member_key: auth.memberKey,
      review_notes: String(body.review_notes || '').trim().slice(0, 4000) || null,
      approved_at: decision === 'approve' ? now : null,
      maturity_date: decision === 'approve' ? maturityDate : null,
      payout_status: 'not_ready',
    };
    const { data, error } = await supabase.from('campaigns').update(update).eq('id', requestId).select('*').single();
    if (error) throw error;
    return c.json({ success: true, request: formatCampaign(data) });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/backmi/requests/:id/documents', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    const contentLength = Number(c.req.header('content-length') || 0);
    if (contentLength > MAX_BACKMI_DOCUMENT_SIZE + 1024 * 1024) return c.json({ error: 'Document upload is too large.' }, 413);
    const requestId = c.req.param('id');
    const { data: request, error: requestError } = await supabase.from('campaigns')
      .select('id, request_code, creator_user_id, status')
      .eq('id', requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request) return c.json({ error: 'BackMi request not found.' }, 404);
    if (request.creator_user_id !== auth.user.id && !isReviewer(auth.profile)) return c.json({ error: 'You cannot upload documents for this request.' }, 403);
    if (!['pending_review', 'info_required'].includes(request.status)) return c.json({ error: 'Documents can only be added while a request is being reviewed.' }, 409);

    const { count, error: countError } = await supabase.from('backmi_request_documents')
      .select('id', { count: 'exact', head: true })
      .eq('request_id', requestId);
    if (countError) throw countError;
    if (Number(count || 0) >= MAX_BACKMI_DOCUMENTS) return c.json({ error: `A request can have a maximum of ${MAX_BACKMI_DOCUMENTS} documents.` }, 400);

    const form = await c.req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return c.json({ error: 'Choose a PDF, JPG or PNG document.' }, 400);
    const mimeType = String(file.type || '').toLowerCase();
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType)) return c.json({ error: 'Only PDF, JPG and PNG documents are allowed.' }, 400);
    if (file.size < 1 || file.size > MAX_BACKMI_DOCUMENT_SIZE) return c.json({ error: 'Each document must be smaller than 5 MB.' }, 400);

    const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
    const objectPath = `${auth.user.id}/${request.request_code}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('backmi-evidence').upload(objectPath, file, { contentType: mimeType, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase.from('backmi_request_documents').insert({
      request_id: requestId,
      member_key: auth.memberKey,
      object_path: objectPath,
      file_name: String(file.name || `document.${extension}`).slice(0, 240),
      mime_type: mimeType,
      size_bytes: file.size,
    }).select('id, file_name, mime_type, size_bytes, created_at').single();
    if (error) {
      await supabase.storage.from('backmi-evidence').remove([objectPath]);
      throw error;
    }
    return c.json({ success: true, document: data }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/backmi/requests/:id/documents', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    const requestId = c.req.param('id');
    const { data: request, error: requestError } = await supabase.from('campaigns')
      .select('creator_user_id')
      .eq('id', requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request) return c.json({ error: 'BackMi request not found.' }, 404);
    if (request.creator_user_id !== auth.user.id && !isReviewer(auth.profile)) return c.json({ error: 'You cannot view these documents.' }, 403);
    const { data: documents, error } = await supabase.from('backmi_request_documents')
      .select('id, object_path, file_name, mime_type, size_bytes, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const output = [];
    for (const document of documents || []) {
      const { data: signed, error: signedError } = await supabase.storage.from('backmi-evidence').createSignedUrl(document.object_path, 300);
      if (signedError) throw signedError;
      output.push({ ...document, object_path: undefined, signed_url: signed?.signedUrl || null });
    }
    return c.json(output);
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/backmi/requests/:id/gift-checkout', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { amount } = await c.req.json();
    const numericAmount = Number(amount);
    const settings = await getPaymentSettings();
    if (!settings.backmi_gifts_enabled || !BACKMI_PAYMENTS_ENABLED) {
      return c.json({ error: 'BackMi gifts remain closed until the payment and payout model has been approved.', code: 'BACKMI_GIFTS_DISABLED' }, 503);
    }
    if (!PAYFAST_CONFIGURED) return c.json({ error: 'PayFast has not been configured on the We-Rise server yet.' }, 503);
    if (!Number.isFinite(numericAmount) || numericAmount < Number(settings.minimum_gift_zar) || numericAmount > Number(settings.maximum_gift_zar)) {
      return c.json({ error: `Choose a gift from R${Number(settings.minimum_gift_zar)} to R${Number(settings.maximum_gift_zar)}.` }, 400);
    }

    const requestId = c.req.param('id');
    const { data: request, error: requestError } = await supabase.from('campaigns')
      .select('id, request_code, title, goal, raised, status, maturity_date')
      .eq('id', requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request || request.status !== 'active') return c.json({ error: 'This request is not open for gifts.' }, 409);
    const remaining = Math.max(0, Number(request.goal) - Number(request.raised));
    if (remaining <= 0) return c.json({ error: 'This request has already reached its target.' }, 409);
    if (numericAmount > remaining) return c.json({ error: `The remaining amount is R${remaining.toFixed(2)}.` }, 400);

    const reference = checkoutReference('BACKMI');
    const { error: transactionError } = await supabase.from('payment_transactions').insert({
      member_key: auth.memberKey,
      purpose: 'backmi_gift',
      request_id: request.id,
      checkout_reference: reference,
      expected_amount_zar: numericAmount,
      item_name: `BackMi gift ${request.request_code}`.slice(0, 120),
      status: 'pending',
      metadata: { request_code: request.request_code, maturity_date: request.maturity_date },
    });
    if (transactionError) throw transactionError;

    const memberName = splitName(auth.profile.display_name);
    const fields = signedPayFastFields({
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: `${primaryFrontendUrl}/?payment=success&kind=backmi&request=${encodeURIComponent(request.request_code)}`,
      cancel_url: `${primaryFrontendUrl}/?payment=cancelled&kind=backmi&request=${encodeURIComponent(request.request_code)}`,
      notify_url: `${apiOrigin(c)}/api/payfast/itn`,
      name_first: memberName.first,
      name_last: memberName.last,
      email_address: auth.user.email || '',
      m_payment_id: reference,
      amount: moneyString(numericAmount),
      item_name: `Voluntary BackMi gift ${request.request_code}`.slice(0, 100),
      item_description: `Voluntary gift to approved request ${request.request_code}`.slice(0, 255),
      custom_str1: 'backmi_gift',
      custom_str2: auth.memberKey,
      custom_str3: request.request_code,
    });
    return c.json({ action: payFastProcessUrl(PAYFAST_MODE), fields, mode: PAYFAST_MODE });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/backmi/ledger', async (c) => {
  try {
    const auth = await reviewerContext(c, true);
    if (auth.response) return auth.response;
    const requestedLimit = Number(c.req.query('limit') || 200);
    const limit = Math.max(1, Math.min(500, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 200));
    const [{ data: entries, error: entryError }, { data: transactions, error: transactionError }, { data: balanceRows, error: balanceError }] = await Promise.all([
      supabase.from('backmi_ledger_entries').select('*').order('created_at', { ascending: false }).limit(limit),
      supabase.from('payment_transactions').select('id, purpose, request_id, checkout_reference, pf_payment_id, expected_amount_zar, amount_gross_zar, amount_fee_zar, amount_net_zar, status, created_at, verified_at').order('created_at', { ascending: false }).limit(limit),
      supabase.rpc('get_backmi_ledger_balances'),
    ]);
    if (entryError) throw entryError;
    if (transactionError) throw transactionError;
    if (balanceError) throw balanceError;
    const balances = {};
    for (const row of balanceRows || []) balances[row.account] = Number(row.balance_zar || 0);
    return c.json({ balances, entries: entries || [], transactions: transactions || [], payouts_enabled: false });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/topics', async (c) => {
  try {
    const auth = await authContext(c, false);
    const supporterKey = auth?.memberKey || '';
    const { data, error } = await supabase.rpc('get_community_topics', { p_supporter_key: supporterKey });
    if (error) throw error;
    return c.json((data || []).map(topic => ({
      ...topic,
      id: Number(topic.id),
      replies: Number(topic.replies || 0),
      supports: Number(topic.supports || 0),
      supported: Boolean(topic.supported),
    })));
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/topics', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { title } = await c.req.json();
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return c.json({ error: 'A community message is required.' }, 400);
    if (cleanTitle.length > MAX_COMMUNITY_CHARS) return c.json({ error: `Community messages are limited to ${MAX_COMMUNITY_CHARS} characters.` }, 400);
    const policyError = communityPolicyError(cleanTitle);
    if (policyError) return c.json({ error: policyError, code: 'COMMUNITY_PROMOTION_NOT_ALLOWED' }, 400);
    const { data, error } = await supabase.from('community_topics').insert({
      title: cleanTitle,
      author: auth.profile.display_name,
      author_user_id: auth.user.id,
    }).select('id').single();
    if (error) throw error;
    return c.json({ id: Number(data.id), success: true }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/topics/:id/comments', async (c) => {
  try {
    const topicId = Number(c.req.param('id'));
    if (!Number.isInteger(topicId) || topicId <= 0) return c.json({ error: 'Invalid topic.' }, 400);
    const { data: topic, error: topicError } = await supabase.from('community_topics').select('id').eq('id', topicId).maybeSingle();
    if (topicError) throw topicError;
    if (!topic) return c.json({ error: 'Conversation not found.' }, 404);
    const { data, error } = await supabase.from('community_comments').select('id, topic_id, author, content, created_at').eq('topic_id', topicId).order('created_at', { ascending: true }).order('id', { ascending: true });
    if (error) throw error;
    return c.json(data || []);
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/topics/:id/comments', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const topicId = Number(c.req.param('id'));
    if (!Number.isInteger(topicId) || topicId <= 0) return c.json({ error: 'Invalid topic.' }, 400);
    const { content } = await c.req.json();
    const cleanContent = String(content || '').trim();
    if (!cleanContent) return c.json({ error: 'A comment is required.' }, 400);
    if (cleanContent.length > MAX_COMMUNITY_CHARS) return c.json({ error: `Comments are limited to ${MAX_COMMUNITY_CHARS} characters.` }, 400);
    const policyError = communityPolicyError(cleanContent);
    if (policyError) return c.json({ error: policyError, code: 'COMMUNITY_PROMOTION_NOT_ALLOWED' }, 400);
    const { data: topic, error: topicError } = await supabase.from('community_topics').select('id').eq('id', topicId).maybeSingle();
    if (topicError) throw topicError;
    if (!topic) return c.json({ error: 'Conversation not found.' }, 404);
    const { data, error } = await supabase.from('community_comments').insert({
      topic_id: topicId,
      author: auth.profile.display_name,
      author_user_id: auth.user.id,
      content: cleanContent,
    }).select('id').single();
    if (error) throw error;
    return c.json({ id: Number(data.id), success: true }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/topics/:id/support', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const topicId = Number(c.req.param('id'));
    if (!Number.isInteger(topicId) || topicId <= 0) return c.json({ error: 'Invalid topic.' }, 400);
    const { data, error } = await supabase.rpc('toggle_community_support', { p_topic_id: topicId, p_supporter_key: auth.memberKey });
    if (error) throw error;
    if (!data || !data.length) return c.json({ error: 'Conversation not found.' }, 404);
    return c.json({ supported: Boolean(data[0].supported), supports: Number(data[0].supports || 0) });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/members/upsert', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    const { display_name } = await c.req.json();
    const displayName = String(display_name || '').trim();
    if (!displayName || displayName.length > 80) return c.json({ error: 'A member name between 1 and 80 characters is required.' }, 400);

    const now = new Date().toISOString();
    const { data, error } = await supabase.from('member_profiles').update({
      display_name: displayName,
      updated_at: now,
      last_seen_at: now,
    }).eq('member_key', auth.memberKey).select('member_key, auth_user_id, email, display_name, plan, created_at, updated_at, last_seen_at').single();
    if (error) throw error;
    return c.json(data);
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/members', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { data, error } = await supabase.from('member_profiles')
      .select('member_key, display_name, plan, last_seen_at')
      .neq('member_key', auth.memberKey)
      .eq('role', 'member')
      .not('auth_user_id', 'is', null)
      .order('display_name', { ascending: true })
      .limit(100);
    if (error) throw error;
    return c.json(data || []);
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/conversations', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { other_member_key } = await c.req.json();
    const memberKey = auth.memberKey;
    const otherKey = cleanMemberKey(other_member_key);
    if (!otherKey) return c.json({ error: 'A valid We-Rise member is required.' }, 400);
    if (memberKey === otherKey) return c.json({ error: 'You cannot start a conversation with yourself.' }, 400);

    const { data: otherMember, error: memberError } = await supabase.from('member_profiles').select('member_key, auth_user_id').eq('member_key', otherKey).not('auth_user_id', 'is', null).maybeSingle();
    if (memberError) throw memberError;
    if (!otherMember) return c.json({ error: 'This We-Rise Lady is not available.' }, 404);

    const [memberA, memberB] = [memberKey, otherKey].sort();
    const { data: existing, error: existingError } = await supabase.from('private_conversations').select('id, member_a_key, member_b_key, created_at, last_message_at').eq('member_a_key', memberA).eq('member_b_key', memberB).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return c.json(existing, 201);

    const { data, error } = await supabase.from('private_conversations').insert({ member_a_key: memberA, member_b_key: memberB }).select('id, member_a_key, member_b_key, created_at, last_message_at').single();
    if (error) {
      if (error.code === '23505') {
        const { data: raced, error: racedError } = await supabase.from('private_conversations').select('id, member_a_key, member_b_key, created_at, last_message_at').eq('member_a_key', memberA).eq('member_b_key', memberB).single();
        if (racedError) throw racedError;
        return c.json(raced, 201);
      }
      throw error;
    }
    return c.json(data, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/inbox', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { data, error } = await supabase.rpc('get_member_inbox', { p_member_key: auth.memberKey });
    if (error) throw error;
    return c.json((data || []).map(item => ({ ...item, id: Number(item.id), unread_count: Number(item.unread_count || 0) })));
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/conversations/:id/messages', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const conversationId = Number(c.req.param('id'));
    const memberKey = auth.memberKey;
    const requestedLimit = Number(c.req.query('limit') || 20);
    const limit = Math.max(1, Math.min(MAX_MESSAGE_PAGE_SIZE, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 20));
    const beforeIdRaw = c.req.query('before_id');
    const beforeId = beforeIdRaw ? Number(beforeIdRaw) : null;
    if (!Number.isInteger(conversationId) || conversationId <= 0) return c.json({ error: 'Invalid conversation request.' }, 400);

    const { data: conversation, error: conversationError } = await supabase.from('private_conversations').select('id, member_a_key, member_b_key').eq('id', conversationId).maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return c.json({ error: 'Conversation not found.' }, 404);
    if (conversation.member_a_key !== memberKey && conversation.member_b_key !== memberKey) return c.json({ error: 'You do not have access to this conversation.' }, 403);

    let query = supabase.from('private_messages')
      .select('id, conversation_id, sender_key, receiver_key, content, created_at, read_at')
      .eq('conversation_id', conversationId)
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (Number.isInteger(beforeId) && beforeId > 0) query = query.lt('id', beforeId);
    const { data: rows, error } = await query;
    if (error) throw error;

    const hasMore = (rows || []).length > limit;
    const page = (rows || []).slice(0, limit).reverse();
    return c.json({
      messages: page.map(item => ({ ...item, id: Number(item.id), conversation_id: Number(item.conversation_id) })),
      has_more: hasMore,
      next_before_id: hasMore && page.length ? Number(page[0].id) : null,
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/conversations/:id/messages', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const conversationId = Number(c.req.param('id'));
    const { content } = await c.req.json();
    const memberKey = auth.memberKey;
    const cleanContent = String(content || '').trim();
    if (!Number.isInteger(conversationId) || conversationId <= 0) return c.json({ error: 'Invalid conversation request.' }, 400);
    if (!cleanContent) return c.json({ error: 'A message is required.' }, 400);

    const { data: conversation, error: conversationError } = await supabase.from('private_conversations').select('id, member_a_key, member_b_key').eq('id', conversationId).maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return c.json({ error: 'Conversation not found.' }, 404);
    if (conversation.member_a_key !== memberKey && conversation.member_b_key !== memberKey) return c.json({ error: 'You do not have access to this conversation.' }, 403);

    const messageLimit = auth.profile.plan === 'premium' ? PREMIUM_PRIVATE_MESSAGE_CHARS : FREE_PRIVATE_MESSAGE_CHARS;
    if (cleanContent.length > messageLimit) {
      return c.json({
        error: auth.profile.plan === 'premium'
          ? `Premium messages are limited to ${PREMIUM_PRIVATE_MESSAGE_CHARS} characters.`
          : `Free messages are limited to ${FREE_PRIVATE_MESSAGE_CHARS} characters. Upgrade to We-Rise Premium for up to ${PREMIUM_PRIVATE_MESSAGE_CHARS} characters.`,
        code: 'MESSAGE_LIMIT',
        limit: messageLimit,
      }, 400);
    }

    const policyError = privateMessagePolicyError(cleanContent);
    if (policyError) return c.json({ error: policyError, code: 'MESSAGE_PROMOTION_NOT_ALLOWED' }, 400);

    const receiverKey = conversation.member_a_key === memberKey ? conversation.member_b_key : conversation.member_a_key;
    const { data: message, error } = await supabase.from('private_messages').insert({
      conversation_id: conversationId,
      sender_key: memberKey,
      receiver_key: receiverKey,
      content: cleanContent,
    }).select('id, conversation_id, sender_key, receiver_key, content, created_at, read_at').single();
    if (error) throw error;

    const now = new Date().toISOString();
    await Promise.all([
      supabase.from('private_conversations').update({ last_message_at: now }).eq('id', conversationId),
      supabase.from('member_profiles').update({ last_seen_at: now }).eq('member_key', memberKey),
    ]);

    return c.json({ message: { ...message, id: Number(message.id), conversation_id: Number(message.conversation_id) } }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/conversations/:id/read', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const conversationId = Number(c.req.param('id'));
    const memberKey = auth.memberKey;
    if (!Number.isInteger(conversationId) || conversationId <= 0) return c.json({ error: 'Invalid conversation request.' }, 400);

    const { data: conversation, error: conversationError } = await supabase.from('private_conversations').select('member_a_key, member_b_key').eq('id', conversationId).maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return c.json({ error: 'Conversation not found.' }, 404);
    if (conversation.member_a_key !== memberKey && conversation.member_b_key !== memberKey) return c.json({ error: 'You do not have access to this conversation.' }, 403);

    const { error } = await supabase.from('private_messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('receiver_key', memberKey).is('read_at', null);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/waitlist/count', async (c) => {
  try {
    const { count, error } = await supabase.from('waitlist_entries').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return c.json({ count: Number(count || 0) });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/waitlist', async (c) => {
  try {
    const { name, email, age, country, reason, explanation } = await c.req.json();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const numericAge = Number(age);
    if (!String(name || '').trim() || !/^\S+@\S+\.\S+$/.test(cleanEmail) || !Number.isFinite(numericAge) || numericAge < 18 || numericAge > 120 || !String(country || '').trim() || !String(reason || '').trim() || !String(explanation || '').trim()) {
      return c.json({ error: 'All waitlist fields are required and age must be 18 or older.' }, 400);
    }
    const { data, error } = await supabase.from('waitlist_entries').insert({
      name: cleanName(name),
      email: cleanEmail.slice(0, 320),
      age: numericAge,
      country: String(country).trim().slice(0, 80),
      reason: String(reason).trim().slice(0, 160),
      explanation: String(explanation).trim().slice(0, 1200),
    }).select('id').single();
    if (error) {
      if (error.code === '23505') return c.json({ error: 'This email address is already on the We-Rise waitlist.' }, 409);
      throw error;
    }
    return c.json({ success: true, id: Number(data.id) }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/emergency-contacts', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { data, error } = await supabase.from('emergency_contacts')
      .select('id, member_key, name, phone, relation, position, created_at')
      .eq('member_key', auth.memberKey)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return c.json((data || []).map(item => ({ ...item, id: Number(item.id), position: Number(item.position || 0) })));
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/emergency-contacts', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { name, phone, relation } = await c.req.json();
    const cleanContactName = cleanName(name, '');
    const cleanContactPhone = cleanPhone(phone);
    if (!cleanContactName || cleanContactPhone.length < 7) return c.json({ error: 'A contact name and valid phone number are required.' }, 400);

    const { data: currentContacts, error: countError } = await supabase.from('emergency_contacts').select('position').eq('member_key', auth.memberKey);
    if (countError) throw countError;
    if ((currentContacts || []).length >= 5) return c.json({ error: 'A We-Rise member can save a maximum of 5 emergency contacts.' }, 400);
    const occupied = new Set((currentContacts || []).map(item => Number(item.position)));
    const position = [1, 2, 3, 4, 5].find(slot => !occupied.has(slot));
    if (!position) return c.json({ error: 'No emergency-contact slot is available.' }, 400);

    const { data, error } = await supabase.from('emergency_contacts').insert({
      member_key: auth.memberKey,
      name: cleanContactName,
      phone: cleanContactPhone,
      relation: String(relation || '').trim().slice(0, 80) || null,
      position,
    }).select('id').single();
    if (error) throw error;
    return c.json({ success: true, id: Number(data.id) }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.delete('/api/emergency-contacts/:id', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const contactId = Number(c.req.param('id'));
    if (!Number.isInteger(contactId) || contactId <= 0) return c.json({ error: 'Invalid contact request.' }, 400);
    const { error } = await supabase.from('emergency_contacts').delete().eq('id', contactId).eq('member_key', auth.memberKey);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/emergency-alerts', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { location_text, latitude, longitude } = await c.req.json();
    const memberKey = auth.memberKey;

    const lat = latitude === null || latitude === undefined || latitude === '' ? null : Number(latitude);
    const lng = longitude === null || longitude === undefined || longitude === '' ? null : Number(longitude);
    if ((lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) {
      return c.json({ error: 'Invalid location coordinates.' }, 400);
    }

    const { data: contacts, error: contactsError } = await supabase.from('emergency_contacts')
      .select('id, name, phone, relation, position')
      .eq('member_key', memberKey)
      .order('position', { ascending: true })
      .limit(5);
    if (contactsError) throw contactsError;
    if (!contacts?.length) return c.json({ error: 'Add at least one emergency contact before sending an alert.' }, 400);

    const messageText = buildEmergencyMessage({
      name: auth.profile.display_name,
      locationText: String(location_text || '').trim().slice(0, 300),
      latitude: lat,
      longitude: lng,
    });

    const { data: alert, error: alertError } = await supabase.from('emergency_alerts').insert({
      member_key: memberKey,
      member_name: auth.profile.display_name,
      location_text: String(location_text || '').trim().slice(0, 300) || null,
      latitude: lat,
      longitude: lng,
      message_text: messageText,
      sms_configured: SMS_CONFIGURED,
      status: SMS_CONFIGURED ? 'processing' : 'manual_required',
    }).select('id').single();
    if (alertError) throw alertError;

    let sentCount = 0;
    const deliveryResults = [];
    for (const contact of contacts) {
      let delivery = { accepted: false, reason: 'not_configured' };
      if (SMS_CONFIGURED) {
        try { delivery = await sendTwilioSms(cleanPhone(contact.phone), messageText); }
        catch (smsError) { delivery = { accepted: false, error: smsError?.message || String(smsError) }; }
      }
      if (delivery.accepted) sentCount += 1;
      deliveryResults.push({ contact_id: Number(contact.id), name: contact.name, accepted: Boolean(delivery.accepted), status: delivery.status || (SMS_CONFIGURED ? 'failed' : 'manual_required') });
      const { error: recipientError } = await supabase.from('emergency_alert_recipients').insert({
        alert_id: alert.id,
        contact_id: contact.id,
        contact_name: contact.name,
        phone: cleanPhone(contact.phone),
        status: delivery.accepted ? (delivery.status || 'queued') : (SMS_CONFIGURED ? 'failed' : 'manual_required'),
        provider_message_id: delivery.provider_id || null,
        error_message: delivery.error || null,
      });
      if (recipientError) console.error('Could not log emergency recipient', recipientError);
    }

    await supabase.from('emergency_alerts').update({
      status: SMS_CONFIGURED ? (sentCount > 0 ? 'submitted' : 'failed') : 'manual_required',
      sent_count: sentCount,
    }).eq('id', alert.id);

    return c.json({
      success: true,
      alert_id: Number(alert.id),
      sms_configured: SMS_CONFIGURED,
      contact_count: contacts.length,
      sent_count: sentCount,
      message_text: messageText,
      deliveries: deliveryResults,
    }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/referrals', async (c) => {
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    const { referred_email } = await c.req.json();
    const { error } = await supabase.from('referrals').insert({
      referrer: auth.memberKey,
      referred_email: String(referred_email || '').trim().slice(0, 320) || null,
    });
    if (error) throw error;
    return c.json({ success: true }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.notFound((c) => c.json({ error: 'Route not found.' }, 404));

app.onError((error, c) => fail(c, error));

const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`We-Rise API listening on http://0.0.0.0:${info.port}`);
});

export default app;
