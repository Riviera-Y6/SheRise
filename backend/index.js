import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { serve } from '@hono/node-server';
import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import sharp from 'sharp';
import {
  checkoutReference,
  cleanPaystackPayload,
  createPaystackSubscription,
  dateAfterDays,
  disablePaystackSubscription,
  fromSubunit,
  fetchPaystackPlan,
  generatePaystackManageLink,
  initializePaystackTransaction,
  paystackEventKey,
  toSubunit,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from './paystack.js';
import { DEFAULT_MODEL, generateWeRiseAnswer, localAiGuard } from './gemini.js';

const app = new Hono();

const MAX_COMMUNITY_CHARS = 250;
const FREE_PRIVATE_MESSAGE_CHARS = 150;
const PREMIUM_PRIVATE_MESSAGE_CHARS = 2000;
const MAX_MESSAGE_PAGE_SIZE = 30;
const MAX_BACKMI_DOCUMENTS = 10;
const MAX_BACKMI_DOCUMENT_SIZE = 5 * 1024 * 1024;
const MAX_PROFILE_PHOTO_SIZE = 8 * 1024 * 1024;
const MAX_SUPPORT_ATTACHMENT_SIZE = 8 * 1024 * 1024;
const PROFILE_PHOTO_BUCKET = 'we-rise-profile-photos';
const SUPPORT_ATTACHMENT_BUCKET = 'we-rise-support-attachments';
const SUPPORT_CATEGORIES = new Set(['account', 'profile_photo', 'technical', 'membership_payment', 'backmi', 'community_messages', 'safety', 'other']);
const PROFILE_COLUMNS = 'member_key, auth_user_id, email, display_name, plan, role, membership_status, trial_started_at, trial_ends_at, joining_paid_at, payfast_subscription_token, payfast_subscription_status, subscription_started_at, subscription_next_billing_date, subscription_cancelled_at, subscription_monthly_amount_zar, subscription_grace_ends_at, subscription_status_updated_at, paystack_customer_code, paystack_authorization_code, paystack_email_token, avatar_path, avatar_updated_at, profile_photo_completed_at, created_at, updated_at, last_seen_at';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const TWILIO_ACCOUNT_SID = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
const TWILIO_AUTH_TOKEN = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
const TWILIO_FROM_NUMBER = String(process.env.TWILIO_FROM_NUMBER || '').trim();
const EMERGENCY_SMS_ENABLED = String(process.env.ENABLE_EMERGENCY_SMS || '').trim().toLowerCase() === 'true';
const SMS_CONFIGURED = Boolean(EMERGENCY_SMS_ENABLED && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
const PAYSTACK_SECRET_KEY = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
const PAYSTACK_PLAN_CODE = String(process.env.PAYSTACK_PLAN_CODE || '').trim();
const PAYSTACK_CURRENCY = String(process.env.PAYSTACK_CURRENCY || 'ZAR').trim().toUpperCase();
const PAYSTACK_ENABLED = String(process.env.ENABLE_PAYSTACK || '').trim().toLowerCase() === 'true';
const BACKMI_PAYMENTS_ENABLED = String(process.env.ENABLE_BACKMI_PAYMENTS || '').trim().toLowerCase() === 'true';
const API_PUBLIC_URL = String(process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
const OWNER_EMAILS = new Set(String(process.env.WE_RISE_OWNER_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
const ADMIN_EMAILS = new Set(String(process.env.WE_RISE_ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
const BACKMI_REVIEWER_EMAILS = new Set(String(process.env.BACKMI_REVIEWER_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
const SUPPORT_TO_EMAIL = String(process.env.SUPPORT_TO_EMAIL || 'request4.support@gmail.com').trim().toLowerCase();
const SUPPORT_EMAIL_ENABLED = String(process.env.SUPPORT_EMAIL_ENABLED || '').trim().toLowerCase() === 'true';
const SUPPORT_EMAIL_PROVIDER = 'brevo';
const BREVO_API_KEY = String(process.env.BREVO_API_KEY || '').trim();
const SUPPORT_FROM_EMAIL = String(process.env.SUPPORT_FROM_EMAIL || 'request4.support@gmail.com').trim().toLowerCase();
const SUPPORT_FROM_NAME = String(process.env.SUPPORT_FROM_NAME || 'We-Rise Support').trim().slice(0, 80);
const SUPPORT_EMAIL_CONFIGURED = Boolean(SUPPORT_EMAIL_ENABLED && SUPPORT_TO_EMAIL && SUPPORT_FROM_EMAIL && BREVO_API_KEY);
const VAPID_PUBLIC_KEY = String(process.env.VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY = String(process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = String(process.env.VAPID_SUBJECT || `mailto:${SUPPORT_FROM_EMAIL}`).trim();
const ADMIN_PUSH_CONFIGURED = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && /^(mailto:|https:\/\/)/i.test(VAPID_SUBJECT));
let webPushClientPromise = null;
const PAYSTACK_CONFIGURED = Boolean(PAYSTACK_ENABLED && PAYSTACK_SECRET_KEY && PAYSTACK_PLAN_CODE && PAYSTACK_CURRENCY === 'ZAR');
const GEMINI_ENABLED = String(process.env.ENABLE_GEMINI_AI || '').trim().toLowerCase() === 'true';
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
const GEMINI_TIMEOUT_MS = Math.max(5000, Math.min(60000, Number(process.env.GEMINI_TIMEOUT_MS || 25000)));
const GEMINI_TRIAL_DAILY_LIMIT = Math.max(1, Math.min(200, Number(process.env.GEMINI_TRIAL_DAILY_LIMIT || 10)));
const GEMINI_MEMBER_DAILY_LIMIT = Math.max(1, Math.min(500, Number(process.env.GEMINI_MEMBER_DAILY_LIMIT || 30)));
const GEMINI_STAFF_DAILY_LIMIT = Math.max(1, Math.min(2000, Number(process.env.GEMINI_STAFF_DAILY_LIMIT || 100)));
const GEMINI_CONFIGURED = Boolean(GEMINI_ENABLED && GEMINI_API_KEY && /^[a-zA-Z0-9._-]{2,100}$/.test(GEMINI_MODEL));

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
  if (OWNER_EMAILS.has(normalized)) return 'owner';
  if (ADMIN_EMAILS.has(normalized)) return 'admin';
  if (BACKMI_REVIEWER_EMAILS.has(normalized)) return 'backmi_reviewer';
  return 'member';
}

function isAdmin(profile) {
  return profile?.role === 'owner' || profile?.role === 'admin';
}

function isReviewer(profile) {
  return isAdmin(profile) || profile?.role === 'backmi_reviewer';
}

function membershipSummary(profile) {
  const now = Date.now();
  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : 0;
  const graceEnd = profile?.subscription_grace_ends_at ? new Date(profile.subscription_grace_ends_at).getTime() : 0;
  const paidThrough = profile?.subscription_next_billing_date
    ? new Date(`${profile.subscription_next_billing_date}T23:59:59.999Z`).getTime()
    : 0;
  const administrativeAccess = isReviewer(profile);
  let status = String(profile?.membership_status || 'trialing');

  if (status === 'trialing' && trialEnd && trialEnd <= now) status = 'trial_expired';
  if (status === 'past_due' && graceEnd && graceEnd <= now) status = 'suspended';

  const trialActive = status === 'trialing' && trialEnd > now;
  const paidActive = status === 'active';
  const cancelledPaidThrough = status === 'cancelled' && paidThrough > now && Boolean(profile?.joining_paid_at);
  return {
    status,
    access_allowed: administrativeAccess || trialActive || paidActive || cancelledPaidThrough || (status === 'past_due' && graceEnd > now),
    trial_active: trialActive,
    trial_started_at: profile?.trial_started_at || null,
    trial_ends_at: profile?.trial_ends_at || null,
    trial_days_remaining: trialActive ? Math.max(1, Math.ceil((trialEnd - now) / 86400000)) : 0,
    joining_paid_at: profile?.joining_paid_at || null,
    subscription_started_at: profile?.subscription_started_at || null,
    next_billing_date: profile?.subscription_next_billing_date || null,
    cancelled_at: profile?.subscription_cancelled_at || null,
    monthly_amount_zar: profile?.subscription_monthly_amount_zar ? Number(profile.subscription_monthly_amount_zar) : null,
    subscription_status: profile?.payfast_subscription_status || null,
    has_subscription: Boolean(profile?.payfast_subscription_token),
    grace_ends_at: profile?.subscription_grace_ends_at || null,
    access_ends_at: cancelledPaidThrough ? profile.subscription_next_billing_date : null,
  };
}

function profilePhotoRequired(profile) {
  return Boolean(profile && (profile.role || 'member') === 'member' && !profile.avatar_path);
}

function canViewMemberPhotos(auth) {
  return Boolean(auth?.user?.id && auth?.membership?.access_allowed && !profilePhotoRequired(auth.profile));
}

function safeProfile(profile, avatarUrl = null) {
  if (!profile) return null;
  return {
    member_key: profile.member_key,
    auth_user_id: profile.auth_user_id,
    email: profile.email,
    display_name: profile.display_name,
    plan: profile.plan,
    role: profile.role || 'member',
    avatar_url: avatarUrl,
    avatar_updated_at: profile.avatar_updated_at || null,
    profile_photo_completed_at: profile.profile_photo_completed_at || null,
    photo_required: profilePhotoRequired(profile),
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    last_seen_at: profile.last_seen_at,
  };
}

async function signedAvatarUrl(path, expiresIn = 3600) {
  const objectPath = String(path || '').trim();
  if (!objectPath) return null;
  const { data, error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(objectPath, expiresIn);
  if (error) {
    console.error('Could not create a signed member photo URL:', error.message);
    return null;
  }
  return data?.signedUrl || null;
}

async function safeProfileWithAvatar(profile) {
  return safeProfile(profile, await signedAvatarUrl(profile?.avatar_path));
}

async function avatarUrlMap(memberRows) {
  const rows = Array.isArray(memberRows) ? memberRows : [];
  const pairs = await Promise.all(rows.map(async row => [row.member_key, await signedAvatarUrl(row.avatar_path)]));
  return new Map(pairs.filter(([, url]) => Boolean(url)));
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
    subscription_grace_days: Number(settings.subscription_grace_days || 5),
    minimum_gift_zar: Number(settings.minimum_gift_zar),
    maximum_gift_zar: Number(settings.maximum_gift_zar),
    membership_payments_enabled: Boolean(settings.membership_payments_enabled && PAYSTACK_CONFIGURED),
    backmi_gifts_enabled: Boolean(settings.backmi_gifts_enabled && PAYSTACK_CONFIGURED && BACKMI_PAYMENTS_ENABLED),
    payment_provider: 'paystack',
    paystack_mode: PAYSTACK_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test',
    paystack_configured: PAYSTACK_CONFIGURED,
    subscription_management_enabled: Boolean(PAYSTACK_CONFIGURED),
    payouts_enabled: false,
  };
}

function subscriptionStartIso(dateValue) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || '')) ? String(dateValue) : dateAfterDays(30);
  return `${date}T00:00:00+02:00`;
}

function paystackBillingDate(value, fallback = null) {
  const raw = String(value || '');
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : fallback;
}

function paystackTransactionId(data) {
  return String(data?.id || data?.transaction?.id || data?.reference || data?.transaction?.reference || '').trim().slice(0, 120);
}

function paystackSubscriptionCode(data) {
  return String(data?.subscription_code || data?.subscription?.subscription_code || '').trim().slice(0, 160);
}

function paystackReference(data) {
  return String(data?.reference || data?.transaction?.reference || '').trim().slice(0, 100);
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
  if (profilePhotoRequired(auth.profile)) {
    return {
      ...auth,
      response: c.json({
        error: 'Add your required profile photo before using this We-Rise feature.',
        code: 'PROFILE_PHOTO_REQUIRED',
      }, 428),
    };
  }
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
  const allowed = adminOnly ? isAdmin(auth.profile) : isReviewer(auth.profile);
  if (!allowed) return { ...auth, response: c.json({ error: adminOnly ? 'We-Rise admin access is required.' : 'BackMi reviewer access is required.', code: adminOnly ? 'ADMIN_REQUIRED' : 'REVIEWER_REQUIRED' }, 403) };
  return auth;
}

async function adminContext(c) {
  const auth = await authContext(c);
  if (auth.response) return auth;
  if (!isAdmin(auth.profile)) return { ...auth, response: c.json({ error: 'We-Rise admin access is required.', code: 'ADMIN_REQUIRED' }, 403) };
  return auth;
}

async function recordAdminAudit(auth, action, targetType = null, targetKey = null, metadata = {}) {
  try {
    const { error } = await supabase.from('admin_audit_log').insert({
      actor_member_key: auth?.memberKey || null,
      actor_email: String(auth?.user?.email || '').trim().toLowerCase().slice(0, 320) || null,
      actor_role: String(auth?.profile?.role || 'admin').slice(0, 30),
      action: String(action || 'admin_action').slice(0, 80),
      target_type: targetType ? String(targetType).slice(0, 60) : null,
      target_key: targetKey ? String(targetKey).slice(0, 180) : null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
    if (error) console.error('Could not write admin audit log:', error.message);
  } catch (error) {
    console.error('Could not write admin audit log:', error?.message || error);
  }
}

async function getWebPushClient() {
  if (!ADMIN_PUSH_CONFIGURED) return null;
  if (!webPushClientPromise) {
    webPushClientPromise = import('web-push').then((module) => {
      const client = module.default || module;
      client.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      return client;
    });
  }
  return webPushClientPromise;
}

async function sendAdminPush(notification) {
  if (!ADMIN_PUSH_CONFIGURED || !notification?.id) return;
  try {
    const client = await getWebPushClient();
    if (!client) return;
    const { data: subscriptions, error } = await supabase.from('admin_push_subscriptions')
      .select('id, endpoint, p256dh, auth');
    if (error) throw error;
    if (!subscriptions?.length) return;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: notification.url || '/admin',
      type: notification.type,
      member_key: notification.member_key || null,
      notification_id: Number(notification.id),
      tag: `we-rise-admin-${notification.id}`,
    });

    const staleIds = [];
    await Promise.allSettled(subscriptions.map(async (row) => {
      try {
        await client.sendNotification({
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        }, payload, { TTL: 3600, headers: { Urgency: 'high' } });
      } catch (error) {
        const status = Number(error?.statusCode || error?.status || 0);
        if (status === 404 || status === 410) staleIds.push(row.id);
        else console.error('Admin push delivery failed:', error?.message || error);
      }
    }));

    if (staleIds.length) {
      const { error: cleanupError } = await supabase.from('admin_push_subscriptions').delete().in('id', staleIds);
      if (cleanupError) console.error('Could not remove stale push subscriptions:', cleanupError.message);
    }
  } catch (error) {
    console.error('Admin push notification failed:', error?.message || error);
  }
}

async function createAdminNotification({ type, memberKey = null, title, body, url = '/admin', metadata = {} }) {
  try {
    const { data, error } = await supabase.from('admin_notifications').insert({
      type: String(type || 'admin_event').slice(0, 60),
      member_key: cleanMemberKey(memberKey) || null,
      title: String(title || 'We-Rise Admin').slice(0, 160),
      body: String(body || 'There is a new We-Rise admin notification.').slice(0, 500),
      url: String(url || '/admin').slice(0, 500),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    }).select('id, type, member_key, title, body, url, metadata, created_at').single();
    if (error) throw error;
    void sendAdminPush(data);
    return data;
  } catch (error) {
    // Notification failures must never block registration or other member flows.
    console.error('Could not create admin notification:', error?.message || error);
    return null;
  }
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

async function profilePhotoJpeg(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Choose a profile photo to continue.');
  if (!String(file.type || '').startsWith('image/')) throw new Error('The selected profile photo must be an image.');
  if (Number(file.size || 0) < 1 || Number(file.size || 0) > MAX_PROFILE_PHOTO_SIZE) {
    throw new Error('Profile photos may not be larger than 8 MB.');
  }
  const input = Buffer.from(await file.arrayBuffer());
  try {
    return await sharp(input, { failOn: 'error', limitInputPixels: 40000000 })
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error('We could not read that image. Use a JPG, PNG or WebP photo.');
  }
}

async function supportAttachmentJpeg(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || Number(file.size || 0) < 1) return null;
  if (!String(file.type || '').startsWith('image/')) throw new Error('The support attachment must be an image.');
  if (Number(file.size || 0) > MAX_SUPPORT_ATTACHMENT_SIZE) throw new Error('Support screenshots may not be larger than 8 MB.');
  const input = Buffer.from(await file.arrayBuffer());
  try {
    return await sharp(input, { failOn: 'error', limitInputPixels: 50000000 })
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error('We could not read that screenshot. Use a JPG, PNG or WebP image.');
  }
}

async function emailSupportTicket(ticket, attachmentBuffer = null) {
  if (!SUPPORT_EMAIL_CONFIGURED) return { sent: false, status: 'disabled', providerId: null, error: 'Brevo support email is not configured.' };

  const body = [
    'A new We-Rise support request was received.',
    '',
    `Reference: ${ticket.ticket_code}`,
    `Date: ${ticket.created_at || new Date().toISOString()}`,
    `Name: ${ticket.requester_name}`,
    `Email: ${ticket.requester_email}`,
    `Member ID: ${ticket.member_key || 'Guest / not logged in'}`,
    `Category: ${ticket.category}`,
    `Subject: ${ticket.subject}`,
    `Page: ${ticket.page_context || 'Not supplied'}`,
    '',
    'Message:',
    ticket.message,
    '',
    `Reply directly to this email to answer ${ticket.requester_name}.`,
  ].join('\n');

  try {
    const requestBody = {
      sender: { name: SUPPORT_FROM_NAME.replace(/["\r\n]/g, ''), email: SUPPORT_FROM_EMAIL },
      to: [{ name: 'We-Rise Support', email: SUPPORT_TO_EMAIL }],
      replyTo: { name: ticket.requester_name, email: ticket.requester_email },
      subject: `[We-Rise ${ticket.ticket_code}] ${ticket.subject}`,
      textContent: body,
    };
    if (attachmentBuffer) {
      requestBody.attachment = [{
        name: `${ticket.ticket_code}-screenshot.jpg`,
        content: attachmentBuffer.toString('base64'),
      }];
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000),
    });

    let result = null;
    try { result = await response.json(); } catch {}
    if (!response.ok) {
      const detail = result?.message || result?.code || `Brevo returned HTTP ${response.status}`;
      throw new Error(detail);
    }

    return { sent: true, status: 'sent', providerId: result?.messageId || null, error: null };
  } catch (error) {
    console.error(`Brevo support email ${ticket.ticket_code} failed:`, error?.message || error);
    return { sent: false, status: 'failed', providerId: null, error: String(error?.message || error || 'Email delivery failed.').slice(0, 500) };
  }
}

const supportIpAttempts = new Map();
function supportRequestAllowed(c) {
  const ip = String(c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown').split(',')[0].trim().slice(0, 80);
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;
  const recent = (supportIpAttempts.get(ip) || []).filter(value => value >= cutoff);
  if (recent.length >= 8) return false;
  recent.push(now);
  supportIpAttempts.set(ip, recent);
  if (supportIpAttempts.size > 1000) {
    for (const [key, values] of supportIpAttempts.entries()) {
      if (!values.some(value => value >= cutoff)) supportIpAttempts.delete(key);
    }
  }
  return true;
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
      profile: await safeProfileWithAvatar(auth.profile),
      membership: auth.membership,
    });
  } catch (error) {
    return fail(c, error);
  }
});

function aiDailyLimitFor(auth) {
  if (isReviewer(auth?.profile)) return GEMINI_STAFF_DAILY_LIMIT;
  return auth?.membership?.trial_active ? GEMINI_TRIAL_DAILY_LIMIT : GEMINI_MEMBER_DAILY_LIMIT;
}

async function finishAiUsage(requestId, values) {
  const update = {
    status: values.status,
    category: String(values.category || '').slice(0, 80) || null,
    output_chars: Math.max(0, Math.min(10000, Number(values.output_chars || 0))),
    prompt_tokens: Math.max(0, Number(values.prompt_tokens || 0)),
    output_tokens: Math.max(0, Number(values.output_tokens || 0)),
    total_tokens: Math.max(0, Number(values.total_tokens || 0)),
    latency_ms: Math.max(0, Number(values.latency_ms || 0)),
    error_code: String(values.error_code || '').slice(0, 80) || null,
    completed_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('ai_usage_events').update(update).eq('request_id', requestId);
  if (error) console.error('Could not finish AI usage audit:', error.message);
}

app.get('/api/ai/config', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    const dailyLimit = aiDailyLimitFor(auth);
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count, error } = await supabase.from('ai_usage_events')
      .select('request_id', { count: 'exact', head: true })
      .eq('member_key', auth.memberKey)
      .gte('created_at', dayStart.toISOString());
    if (error) throw error;
    return c.json({
      available: GEMINI_CONFIGURED,
      model: GEMINI_CONFIGURED ? GEMINI_MODEL : null,
      daily_limit: dailyLimit,
      used_today: Number(count || 0),
      remaining: Math.max(0, dailyLimit - Number(count || 0)),
      stores_conversation_content: false,
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/ai/chat', async (c) => {
  const startedAt = Date.now();
  let requestId = null;
  try {
    const auth = await memberAccessContext(c);
    if (auth.response) return auth.response;
    if (!GEMINI_CONFIGURED) {
      return c.json({ error: 'Ask We-Rise is temporarily unavailable while its secure AI connection is being configured.', code: 'AI_NOT_CONFIGURED' }, 503);
    }

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') return c.json({ error: 'Send a valid Ask We-Rise question.' }, 400);
    const question = String(body?.question || '').trim();
    const lang = body?.lang === 'af' ? 'af' : 'en';
    const messages = Array.isArray(body?.messages) ? body.messages.slice(-8) : [];
    const historyChars = messages.reduce((total, message) => total + String(message?.content || '').length, 0);
    if (question.length < 2) return c.json({ error: 'Type a question for Ask We-Rise.' }, 400);
    if (question.length > 1600 || historyChars > 10000) return c.json({ error: 'Keep the question and recent conversation a little shorter.' }, 400);

    requestId = randomUUID();
    const dailyLimit = aiDailyLimitFor(auth);
    const { data: reservation, error: reservationError } = await supabase.rpc('reserve_ai_request', {
      p_member_key: auth.memberKey,
      p_request_id: requestId,
      p_model: GEMINI_MODEL,
      p_daily_limit: dailyLimit,
      p_prompt_chars: question.length + historyChars,
    });
    if (reservationError) throw reservationError;
    if (!reservation?.allowed) {
      return c.json({
        error: lang === 'af'
          ? 'Jy het vandag se Ask We-Rise-vrae gebruik. Probeer asseblief môre weer.'
          : 'You have used today’s Ask We-Rise questions. Please try again tomorrow.',
        code: 'AI_DAILY_LIMIT',
        remaining: 0,
        daily_limit: dailyLimit,
      }, 429);
    }

    const guarded = localAiGuard(question, lang);
    const result = guarded || await generateWeRiseAnswer({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      lang,
      messages,
      question,
      timeoutMs: GEMINI_TIMEOUT_MS,
    });
    const usage = result.usage || {};
    await finishAiUsage(requestId, {
      status: guarded ? 'redirected' : result.status === 'redirect' ? 'redirected' : result.status === 'crisis' ? 'completed' : 'completed',
      category: result.topic,
      output_chars: result.answer.length,
      prompt_tokens: usage.prompt_tokens,
      output_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
      latency_ms: Date.now() - startedAt,
    });

    return c.json({
      request_id: requestId,
      status: result.status,
      topic: result.topic,
      answer: result.answer,
      remaining: Number(reservation.remaining || 0),
      daily_limit: Number(reservation.daily_limit || dailyLimit),
    });
  } catch (error) {
    if (requestId) {
      await finishAiUsage(requestId, {
        status: error?.code === 'AI_RESPONSE_BLOCKED' ? 'blocked' : 'failed',
        error_code: error?.code || 'AI_ERROR',
        latency_ms: Date.now() - startedAt,
      });
    }
    console.error('Ask We-Rise failed:', error?.message || error);
    if (error?.code === 'AI_RESPONSE_BLOCKED') {
      return c.json({ error: 'Ask We-Rise could not safely answer that request. Try asking it in a different way.', code: error.code }, 422);
    }
    if (error?.code === 'AI_RATE_LIMITED' || error?.status === 429) {
      return c.json({ error: 'Ask We-Rise is busy right now. Please wait a moment and try again.', code: 'AI_PROVIDER_BUSY' }, 503);
    }
    if (error?.code === 'AI_TIMEOUT') return c.json({ error: error.message, code: error.code }, 504);
    return c.json({ error: 'Ask We-Rise could not answer right now. Please try again shortly.', code: 'AI_UNAVAILABLE' }, 503);
  }
});

app.post('/api/profile/photo', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;

    if (auth.profile.avatar_path || auth.profile.profile_photo_completed_at) {
      return c.json({ error: 'Your registration selfie is permanent and cannot be changed.' }, 409);
    }

    const form = await c.req.formData();
    const photo = form.get('photo');
    const captureSource = String(form.get('capture_source') || '');
    if (captureSource !== 'live_selfie_camera') {
      return c.json({ error: 'A live camera selfie is required. Gallery uploads are not accepted.' }, 400);
    }
    const jpeg = await profilePhotoJpeg(photo);
    const objectPath = `members/${auth.memberKey}/registration-selfie-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(objectPath, jpeg, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase.from('member_profiles').update({
      avatar_path: objectPath,
      avatar_updated_at: now,
      profile_photo_completed_at: now,
      updated_at: now,
    }).eq('member_key', auth.memberKey).select(PROFILE_COLUMNS).single();

    if (updateError) {
      await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([objectPath]);
      throw updateError;
    }

    if ((updated.role || 'member') === 'member') {
      await createAdminNotification({
        type: 'new_member',
        memberKey: updated.member_key,
        title: 'New We-Rise member',
        body: `${updated.display_name || 'A new member'} completed registration.`,
        url: '/admin',
        metadata: { email: updated.email || null },
      });
    }

    return c.json({ profile: await safeProfileWithAvatar(updated), success: true });
  } catch (error) {
    const known = String(error?.message || '');
    if (known.includes('Choose a profile photo') || known.includes('Profile photos') || known.includes('selected profile') || known.includes('could not read') || known.includes('live camera selfie')) {
      return c.json({ error: known }, 400);
    }
    return fail(c, error);
  }
});

app.get('/api/support/config', (c) => c.json({
  available: true,
  email_provider: SUPPORT_EMAIL_PROVIDER,
  email_delivery_ready: SUPPORT_EMAIL_CONFIGURED,
  attachments_allowed: true,
}));

app.post('/api/support/tickets', async (c) => {
  let uploadedPath = null;
  try {
    if (!supportRequestAllowed(c)) return c.json({ error: 'Too many support requests were sent from this connection. Please try again later.' }, 429);

    const form = await c.req.formData();
    if (String(form.get('website') || '').trim()) {
      return c.json({ success: true, ticket_code: 'SUPPORT-RECEIVED', email_sent: true }, 201);
    }

    const auth = await authContext(c, false);
    const requesterName = auth?.profile?.display_name
      ? cleanName(auth.profile.display_name)
      : cleanName(form.get('name'), '');
    const requesterEmail = String(auth?.user?.email || form.get('email') || '').trim().toLowerCase().slice(0, 320);
    const category = String(form.get('category') || '').trim();
    const subject = String(form.get('subject') || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 140);
    const message = String(form.get('message') || '').trim().slice(0, 4000);
    const pageContext = String(form.get('page_context') || '').trim().slice(0, 240);

    if (!requesterName || requesterName.length > 80) return c.json({ error: 'Enter your name.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) return c.json({ error: 'Enter a valid email address.' }, 400);
    if (!SUPPORT_CATEGORIES.has(category)) return c.json({ error: 'Choose the type of problem.' }, 400);
    if (subject.length < 4) return c.json({ error: 'Enter a short subject for the problem.' }, 400);
    if (message.length < 10) return c.json({ error: 'Tell us a little more about the problem.' }, 400);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase.from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('requester_email', requesterEmail)
      .gte('created_at', oneHourAgo);
    if (countError) throw countError;
    if (Number(count || 0) >= 5) return c.json({ error: 'Too many support requests were sent for this email address. Please try again later.' }, 429);

    const attachment = form.get('attachment');
    const attachmentBuffer = await supportAttachmentJpeg(attachment);
    const { data: ticketCode, error: codeError } = await supabase.rpc('next_support_ticket_code');
    if (codeError) throw codeError;

    if (attachmentBuffer) {
      uploadedPath = `tickets/${ticketCode}/screenshot.jpg`;
      const { error: uploadError } = await supabase.storage.from(SUPPORT_ATTACHMENT_BUCKET).upload(uploadedPath, attachmentBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;
    }

    const { data: ticket, error: insertError } = await supabase.from('support_tickets').insert({
      ticket_code: ticketCode,
      member_key: auth?.memberKey || null,
      requester_name: requesterName,
      requester_email: requesterEmail,
      category,
      subject,
      message,
      attachment_path: uploadedPath,
      page_context: pageContext || null,
      email_status: SUPPORT_EMAIL_CONFIGURED ? 'pending' : 'disabled',
    }).select('*').single();
    if (insertError) throw insertError;

    const delivery = await emailSupportTicket(ticket, attachmentBuffer);
    const { error: deliveryUpdateError } = await supabase.from('support_tickets').update({
      email_status: delivery.status,
      email_provider_id: delivery.providerId,
      email_error: delivery.error,
      updated_at: new Date().toISOString(),
    }).eq('id', ticket.id);
    if (deliveryUpdateError) console.error('Could not update support email status:', deliveryUpdateError.message);

    return c.json({
      success: true,
      ticket_code: ticket.ticket_code,
      email_sent: delivery.sent,
      email_delivery_ready: SUPPORT_EMAIL_CONFIGURED,
    }, 201);
  } catch (error) {
    if (uploadedPath) {
      const { error: removeError } = await supabase.storage.from(SUPPORT_ATTACHMENT_BUCKET).remove([uploadedPath]);
      if (removeError) console.error('Could not remove unused support attachment:', removeError.message);
    }
    const known = String(error?.message || '');
    if (known.includes('support attachment') || known.includes('Support screenshots') || known.includes('could not read that screenshot')) {
      return c.json({ error: known }, 400);
    }
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

    const canManageSubscription = Boolean(
      PAYSTACK_CONFIGURED
      && auth.profile.payfast_subscription_token
      && !auth.profile.subscription_cancelled_at,
    );
    let updateCardUrl = null;
    if (canManageSubscription) {
      try {
        const link = await generatePaystackManageLink(PAYSTACK_SECRET_KEY, auth.profile.payfast_subscription_token);
        updateCardUrl = String(link?.link || '').trim() || null;
      } catch (error) {
        console.error('Could not generate Paystack card-management link:', error?.message || error);
      }
    }

    return c.json({
      membership: auth.membership,
      profile: await safeProfileWithAvatar(auth.profile),
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
      subscription_actions: {
        can_update_card: Boolean(canManageSubscription && updateCardUrl),
        can_cancel: Boolean(canManageSubscription && auth.profile.paystack_email_token),
        update_card_url: updateCardUrl,
      },
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/billing/membership/checkout', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    const checkoutConsent = await c.req.json().catch(() => ({}));
    if (checkoutConsent?.accepted_recurring_terms !== true) {
      return c.json({ error: 'Confirm the once-off and recurring membership terms before continuing to Paystack.', code: 'PAYMENT_CONSENT_REQUIRED' }, 400);
    }
    if (profilePhotoRequired(auth.profile)) {
      return c.json({
        error: 'Add your required profile photo before completing We-Rise membership.',
        code: 'PROFILE_PHOTO_REQUIRED',
      }, 428);
    }
    const membership = auth.membership;
    if (membership.status === 'active') return c.json({ error: 'Your We-Rise membership is already active.', code: 'ALREADY_ACTIVE' }, 409);
    if (membership.trial_active) {
      return c.json({
        error: `Your free trial still has ${membership.trial_days_remaining} day(s) remaining. No payment is due yet.`,
        code: 'TRIAL_ACTIVE',
        membership,
      }, 409);
    }
    const restartingCancelledMembership = Boolean(
      membership.joining_paid_at
      && membership.status === 'cancelled'
      && !membership.access_allowed,
    );
    if (membership.joining_paid_at && !restartingCancelledMembership) {
      return c.json({
        error: 'Your joining payment is already recorded. Please do not pay it again; the monthly subscription needs attention.',
        code: 'SUBSCRIPTION_ATTENTION',
        membership,
      }, 409);
    }

    const settings = await getPaymentSettings();
    if (!settings.membership_payments_enabled) return c.json({ error: 'We-Rise membership payments are temporarily unavailable.' }, 503);
    if (!PAYSTACK_CONFIGURED) return c.json({ error: 'Paystack has not been configured on the We-Rise server yet.', code: 'PAYSTACK_NOT_CONFIGURED' }, 503);

    const plan = await fetchPaystackPlan(PAYSTACK_SECRET_KEY, PAYSTACK_PLAN_CODE);
    const expectedMonthlySubunit = Number(toSubunit(settings.monthly_fee_zar));
    if (String(plan?.plan_code || '') !== PAYSTACK_PLAN_CODE
      || String(plan?.currency || '').toUpperCase() !== PAYSTACK_CURRENCY
      || String(plan?.interval || '').toLowerCase() !== 'monthly'
      || Number(plan?.amount) !== expectedMonthlySubunit) {
      return c.json({
        error: `The Paystack monthly plan does not match the We-Rise R${Number(settings.monthly_fee_zar).toFixed(2)} monthly setting. Update the Paystack test plan before checkout.`,
        code: 'PAYSTACK_PLAN_MISMATCH',
      }, 503);
    }

    const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const paymentPurpose = restartingCancelledMembership ? 'membership_recurring' : 'membership_joining';
    const { data: recent, error: recentError } = await supabase.from('payment_transactions')
      .select('checkout_reference, expected_amount_zar, metadata, created_at')
      .eq('member_key', auth.memberKey)
      .eq('purpose', paymentPurpose)
      .eq('status', 'pending')
      .gte('created_at', recentCutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentError) throw recentError;

    const reference = recent?.checkout_reference || checkoutReference('WR-MEM');
    const initialChargeZar = recent
      ? Number(recent.expected_amount_zar)
      : restartingCancelledMembership ? Number(settings.monthly_fee_zar) : Number(settings.joining_fee_zar);
    const monthlyFeeZar = recent?.metadata?.monthly_fee_zar ? Number(recent.metadata.monthly_fee_zar) : Number(settings.monthly_fee_zar);
    const firstBillingDate = recent?.metadata?.first_billing_date || dateAfterDays(settings.first_recurring_delay_days);
    const itemName = restartingCancelledMembership ? 'We-Rise Monthly Membership Restart' : 'We-Rise Joining & Monthly Membership';
    const recurringTermsAcceptedAt = new Date().toISOString();

    if (!recent) {
      const { error } = await supabase.from('payment_transactions').insert({
        member_key: auth.memberKey,
        purpose: paymentPurpose,
        checkout_reference: reference,
        expected_amount_zar: initialChargeZar,
        item_name: itemName,
        status: 'pending',
        metadata: {
          joining_fee_usd: Number(settings.joining_fee_usd),
          joining_fee_zar: Number(settings.joining_fee_zar),
          monthly_fee_usd: Number(settings.monthly_fee_usd),
          monthly_fee_zar: Number(settings.monthly_fee_zar),
          first_billing_date: firstBillingDate,
          subscription_restart: restartingCancelledMembership,
          recurring_terms_version: '2026-09-15-paystack',
          recurring_terms_accepted_at: recurringTermsAcceptedAt,
          paystack_plan_code: PAYSTACK_PLAN_CODE,
        },
      });
      if (error) throw error;
    } else if (!recent.metadata?.recurring_terms_accepted_at) {
      const { error } = await supabase.from('payment_transactions').update({
        metadata: {
          ...(recent.metadata || {}),
          recurring_terms_version: '2026-09-15-paystack',
          recurring_terms_accepted_at: recurringTermsAcceptedAt,
          paystack_plan_code: PAYSTACK_PLAN_CODE,
        },
        updated_at: recurringTermsAcceptedAt,
      }).eq('checkout_reference', reference);
      if (error) throw error;
    }

    const checkout = await initializePaystackTransaction(PAYSTACK_SECRET_KEY, {
      email: auth.user.email || auth.profile.email || '',
      amount: toSubunit(initialChargeZar),
      currency: PAYSTACK_CURRENCY,
      reference,
      channels: ['card'],
      callback_url: `${primaryFrontendUrl}/?payment=success&kind=membership`,
      metadata: JSON.stringify({
        provider: 'paystack',
        purpose: paymentPurpose,
        member_key: auth.memberKey,
        item_name: itemName,
        first_billing_date: firstBillingDate,
        monthly_fee_zar: monthlyFeeZar,
      }),
    });

    return c.json({
      authorization_url: checkout?.authorization_url,
      access_code: checkout?.access_code,
      reference: checkout?.reference || reference,
      mode: PAYSTACK_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test',
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/billing/subscription/cancel', async (c) => {
  let paystackAccepted = false;
  let cancellingMemberKey = null;
  let cancellingMembership = null;
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    if (!PAYSTACK_CONFIGURED) return c.json({ error: 'Paystack subscription management is temporarily unavailable.' }, 503);
    if (!auth.profile.payfast_subscription_token) return c.json({ error: 'No Paystack subscription is linked to this membership.' }, 404);
    if (!auth.profile.paystack_email_token) return c.json({ error: 'This Paystack subscription is missing its management token. Please contact We-Rise Support.' }, 409);
    if (auth.profile.subscription_cancelled_at || auth.membership.status === 'cancelled') {
      return c.json({ error: 'This subscription is already cancelled.', code: 'ALREADY_CANCELLED' }, 409);
    }
    const body = await c.req.json().catch(() => ({}));
    if (body?.confirmation !== 'CANCEL') return c.json({ error: 'Cancellation confirmation is required.' }, 400);

    cancellingMemberKey = auth.memberKey;
    cancellingMembership = auth.membership;
    await disablePaystackSubscription(PAYSTACK_SECRET_KEY, auth.profile.payfast_subscription_token, auth.profile.paystack_email_token);
    paystackAccepted = true;

    const settings = await getPaymentSettings();
    const syntheticEvent = {
      event: 'subscription.not_renew',
      data: {
        subscription_code: auth.profile.payfast_subscription_token,
        status: 'cancelled',
        member_key: auth.memberKey,
        source: 'member_request',
      },
    };
    const { data, error } = await supabase.rpc('record_paystack_status_event', {
      p_event_key: paystackEventKey(syntheticEvent),
      p_member_key: auth.memberKey,
      p_transaction_id: null,
      p_purpose: 'membership_recurring',
      p_merchant_reference: `MEMBER-CANCEL-${auth.memberKey}`,
      p_pf_payment_id: null,
      p_subscription_token: auth.profile.payfast_subscription_token,
      p_payment_status: 'cancelled',
      p_payload: cleanPaystackPayload(syntheticEvent),
      p_grace_days: Number(settings.subscription_grace_days || 5),
    });
    if (error) throw error;
    if (!data?.success) throw new Error('The cancellation could not be recorded.');

    const { data: updated, error: profileError } = await supabase.from('member_profiles')
      .select(PROFILE_COLUMNS)
      .eq('member_key', auth.memberKey)
      .single();
    if (profileError) throw profileError;
    return c.json({
      success: true,
      membership: membershipSummary(updated),
      message: 'Your recurring Paystack subscription has been cancelled. No further monthly charges will be requested.',
    });
  } catch (error) {
    console.error('Paystack subscription cancellation failed:', error?.message || error);
    if (paystackAccepted && cancellingMemberKey) {
      const now = new Date().toISOString();
      const { data: recovered } = await supabase.from('member_profiles').update({
        membership_status: 'cancelled',
        payfast_subscription_status: 'cancelled',
        subscription_cancelled_at: now,
        subscription_grace_ends_at: null,
        subscription_status_updated_at: now,
        updated_at: now,
      }).eq('member_key', cancellingMemberKey).select(PROFILE_COLUMNS).maybeSingle();
      return c.json({
        success: true,
        pending_audit_sync: true,
        membership: recovered ? membershipSummary(recovered) : {
          ...(cancellingMembership || {}),
          status: 'cancelled',
          subscription_status: 'cancelled',
        },
        message: 'Paystack accepted the cancellation. We-Rise is completing the local audit record.',
      }, 202);
    }
    return c.json({ error: 'We could not cancel the Paystack subscription right now. No local cancellation was recorded. Please try again or contact We-Rise Support.' }, 502);
  }
});

async function paystackMemberBySubscription(subscriptionCode) {
  if (!subscriptionCode) return null;
  const { data, error } = await supabase.from('member_profiles')
    .select(PROFILE_COLUMNS)
    .eq('payfast_subscription_token', subscriptionCode)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function recordPaystackAudit({ event, transaction, transactionId, reference, subscriptionCode, paymentStatus = 'complete' }) {
  const { error } = await supabase.from('payment_notification_events').insert({
    event_key: paystackEventKey(event),
    provider: 'paystack',
    pf_payment_id: transactionId || null,
    subscription_token: subscriptionCode || null,
    merchant_reference: reference || null,
    payment_status: paymentStatus,
    member_key: transaction?.member_key || null,
    payment_transaction_id: transaction?.id || null,
    payload: cleanPaystackPayload(event),
    processing_status: 'processed',
    processed_at: new Date().toISOString(),
  });
  if (error && error.code !== '23505') console.error('Could not store Paystack notification audit:', error.message);
}

async function finalizeVerifiedPaystackCharge(event, verified, knownTransaction = null, subscriptionCode = null, billingDate = null) {
  const reference = String(verified?.reference || '').trim();
  const transactionId = paystackTransactionId(verified);
  const amountGross = fromSubunit(verified?.amount);
  const amountFee = fromSubunit(verified?.fees || 0);
  const amountNet = Math.max(0, amountGross - amountFee);
  if (!reference || !transactionId || String(verified?.status || '').toLowerCase() !== 'success') throw new Error('Paystack transaction is not successful.');
  if (String(verified?.currency || '').toUpperCase() !== PAYSTACK_CURRENCY) throw new Error('Paystack currency mismatch.');

  let transaction = knownTransaction;
  if (!transaction) {
    const { data, error } = await supabase.from('payment_transactions')
      .select('id, expected_amount_zar, purpose, member_key, status, metadata')
      .eq('checkout_reference', reference)
      .maybeSingle();
    if (error) throw error;
    transaction = data || null;
  }

  let subscriptionMember = subscriptionCode ? await paystackMemberBySubscription(subscriptionCode) : null;
  if (!transaction && subscriptionMember) {
    transaction = {
      purpose: 'membership_recurring',
      member_key: subscriptionMember.member_key,
      expected_amount_zar: subscriptionMember.subscription_monthly_amount_zar,
    };
  }
  if (!transaction) return { ignored: true };
  if (Math.abs(Number(transaction.expected_amount_zar) - amountGross) > 0.01) throw new Error('Paystack amount mismatch.');

  const { data, error } = await supabase.rpc('finalize_paystack_payment', {
    p_merchant_reference: reference,
    p_pf_payment_id: transactionId,
    p_amount_gross: amountGross,
    p_amount_fee: amountFee,
    p_amount_net: amountNet,
    p_subscription_token: subscriptionCode || null,
    p_billing_date: billingDate || null,
    p_payload: cleanPaystackPayload({ event, verified }),
  });
  if (error) throw error;
  if (!data?.success) throw new Error('Paystack payment could not be finalised.');

  if (transaction?.metadata?.subscription_restart) {
    const now = new Date().toISOString();
    const { error: restartError } = await supabase.from('member_profiles').update({
      subscription_next_billing_date: billingDate || transaction.metadata.first_billing_date || null,
      subscription_cancelled_at: null,
      payfast_subscription_status: 'active',
      subscription_status_updated_at: now,
      updated_at: now,
    }).eq('member_key', transaction.member_key);
    if (restartError) throw restartError;
  }

  return { ignored: false, transaction: { ...transaction, id: data.transaction_id || transaction.id || null }, transactionId, reference };
}

app.post('/api/paystack/webhook', async (c) => {
  try {
    if (!PAYSTACK_SECRET_KEY) return c.text('Paystack is not configured', 503);
    const contentLength = Number(c.req.header('content-length') || 0);
    if (contentLength > 262144) return c.text('Payload too large', 413);
    const rawBody = await c.req.text();
    if (rawBody.length > 262144) return c.text('Payload too large', 413);
    const signature = c.req.header('x-paystack-signature');
    if (!verifyPaystackWebhookSignature(PAYSTACK_SECRET_KEY, rawBody, signature)) return c.text('Invalid signature', 401);

    let event;
    try { event = JSON.parse(rawBody); } catch { return c.text('Invalid JSON', 400); }
    const eventType = String(event?.event || '').trim();
    const eventData = event?.data || {};

    if (eventType === 'charge.success') {
      const reference = paystackReference(eventData);
      if (!reference) return c.text('OK', 200);
      const { data: transaction, error: transactionError } = await supabase.from('payment_transactions')
        .select('id, expected_amount_zar, purpose, member_key, status, metadata')
        .eq('checkout_reference', reference)
        .maybeSingle();
      if (transactionError) throw transactionError;

      // Subscription recurring charges are finalised from invoice.update, where the SUB_ code is present.
      if (!transaction) return c.text('OK', 200);

      const verified = await verifyPaystackTransaction(PAYSTACK_SECRET_KEY, reference);
      const amountGross = fromSubunit(verified?.amount);
      if (String(verified?.status || '').toLowerCase() !== 'success') return c.text('Transaction not successful', 400);
      if (String(verified?.currency || '').toUpperCase() !== PAYSTACK_CURRENCY) return c.text('Currency mismatch', 400);
      if (Math.abs(Number(transaction.expected_amount_zar) - amountGross) > 0.01) return c.text('Amount mismatch', 400);

      let subscriptionCode = null;
      let billingDate = null;
      if (transaction.purpose === 'membership_joining' || transaction.purpose === 'membership_recurring') {
        const { data: member, error: memberError } = await supabase.from('member_profiles')
          .select(PROFILE_COLUMNS)
          .eq('member_key', transaction.member_key)
          .single();
        if (memberError) throw memberError;

        const isRestartPending = Boolean(transaction.metadata?.subscription_restart && transaction.status !== 'complete');
        const needsSubscription = !member.payfast_subscription_token || isRestartPending;
        if (needsSubscription) {
          const authorizationCode = String(verified?.authorization?.authorization_code || '').trim();
          const customerCode = String(verified?.customer?.customer_code || '').trim();
          if (!authorizationCode || verified?.authorization?.reusable !== true) throw new Error('The Paystack card authorization is not reusable for the monthly membership.');
          if (!customerCode && !verified?.customer?.email) throw new Error('Paystack did not return a customer code for the membership.');

          const firstBillingDate = transaction.metadata?.first_billing_date || dateAfterDays(30);

          // Persist the verified Paystack customer/authorization before creating the subscription.
          // If Paystack creates the subscription but the API response is interrupted, the
          // subscription.create webhook can still resolve this member by customer code.
          const preSubscriptionNow = new Date().toISOString();
          const { error: preSubscriptionSaveError } = await supabase.from('member_profiles').update({
            paystack_customer_code: customerCode || null,
            paystack_authorization_code: authorizationCode,
            subscription_status_updated_at: preSubscriptionNow,
            updated_at: preSubscriptionNow,
          }).eq('member_key', transaction.member_key);
          if (preSubscriptionSaveError) throw preSubscriptionSaveError;

          const created = await createPaystackSubscription(PAYSTACK_SECRET_KEY, {
            customer: customerCode || verified.customer.email,
            plan: PAYSTACK_PLAN_CODE,
            authorization: authorizationCode,
            start_date: subscriptionStartIso(firstBillingDate),
          });
          subscriptionCode = String(created?.subscription_code || '').trim();
          const emailToken = String(created?.email_token || '').trim();
          if (!subscriptionCode || !emailToken) throw new Error('Paystack created the membership without subscription management details.');
          billingDate = paystackBillingDate(created?.next_payment_date, firstBillingDate);

          const now = new Date().toISOString();
          const { error: saveError } = await supabase.from('member_profiles').update({
            paystack_customer_code: customerCode || null,
            paystack_authorization_code: authorizationCode,
            paystack_email_token: emailToken,
            payfast_subscription_token: subscriptionCode,
            payfast_subscription_status: String(created?.status || 'active').toLowerCase(),
            subscription_status_updated_at: now,
            updated_at: now,
          }).eq('member_key', transaction.member_key);
          if (saveError) throw saveError;
        } else {
          subscriptionCode = member.payfast_subscription_token;
          billingDate = transaction.metadata?.first_billing_date || member.subscription_next_billing_date || null;
        }
      }

      const result = await finalizeVerifiedPaystackCharge(event, verified, transaction, subscriptionCode, billingDate);
      if (!result.ignored) await recordPaystackAudit({ event, transaction: result.transaction, transactionId: result.transactionId, reference: result.reference, subscriptionCode });
      return c.text('OK', 200);
    }

    if (eventType === 'invoice.update' && (eventData?.paid === true || Number(eventData?.paid) === 1) && String(eventData?.transaction?.status || '').toLowerCase() === 'success') {
      const reference = paystackReference(eventData);
      const subscriptionCode = paystackSubscriptionCode(eventData);
      if (!reference || !subscriptionCode) return c.text('OK', 200);
      const verified = await verifyPaystackTransaction(PAYSTACK_SECRET_KEY, reference);
      const billingDate = paystackBillingDate(eventData?.period_start || eventData?.paid_at || verified?.paid_at, null);
      const result = await finalizeVerifiedPaystackCharge(event, verified, null, subscriptionCode, billingDate);
      if (!result.ignored) {
        const member = await paystackMemberBySubscription(subscriptionCode);
        if (member) {
          const now = new Date().toISOString();
          const nextBilling = paystackBillingDate(eventData?.subscription?.next_payment_date, null);
          const { error: updateError } = await supabase.from('member_profiles').update({
            paystack_customer_code: String(eventData?.customer?.customer_code || member.paystack_customer_code || '').trim() || null,
            paystack_authorization_code: String(eventData?.authorization?.authorization_code || member.paystack_authorization_code || '').trim() || null,
            paystack_email_token: String(eventData?.subscription?.email_token || member.paystack_email_token || '').trim() || null,
            payfast_subscription_status: String(eventData?.subscription?.status || 'active').toLowerCase(),
            ...(nextBilling ? { subscription_next_billing_date: nextBilling } : {}),
            subscription_status_updated_at: now,
            updated_at: now,
          }).eq('member_key', member.member_key);
          if (updateError) throw updateError;
        }
        await recordPaystackAudit({ event, transaction: result.transaction, transactionId: result.transactionId, reference: result.reference, subscriptionCode });
      }
      return c.text('OK', 200);
    }

    if (eventType === 'invoice.payment_failed') {
      const subscriptionCode = paystackSubscriptionCode(eventData);
      const member = await paystackMemberBySubscription(subscriptionCode);
      if (!member) return c.text('OK', 200);
      const settings = await getPaymentSettings();
      const { data, error } = await supabase.rpc('record_paystack_status_event', {
        p_event_key: paystackEventKey(event),
        p_member_key: member.member_key,
        p_transaction_id: null,
        p_purpose: 'membership_recurring',
        p_merchant_reference: paystackReference(eventData) || null,
        p_pf_payment_id: paystackTransactionId(eventData) || null,
        p_subscription_token: subscriptionCode,
        p_payment_status: 'failed',
        p_payload: cleanPaystackPayload(event),
        p_grace_days: Number(settings.subscription_grace_days || 5),
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Paystack failed-payment status could not be recorded.');
      return c.text('OK', 200);
    }

    if (eventType === 'subscription.create') {
      const subscriptionCode = paystackSubscriptionCode(eventData);
      const customerCode = String(eventData?.customer?.customer_code || '').trim();
      let query = null;
      if (subscriptionCode) query = supabase.from('member_profiles').select(PROFILE_COLUMNS).eq('payfast_subscription_token', subscriptionCode).maybeSingle();
      else if (customerCode) query = supabase.from('member_profiles').select(PROFILE_COLUMNS).eq('paystack_customer_code', customerCode).maybeSingle();
      if (query) {
        const { data: member, error } = await query;
        if (error) throw error;
        if (member) {
          const now = new Date().toISOString();
          const { error: updateError } = await supabase.from('member_profiles').update({
            payfast_subscription_token: subscriptionCode || member.payfast_subscription_token,
            paystack_customer_code: customerCode || member.paystack_customer_code,
            paystack_authorization_code: String(eventData?.authorization?.authorization_code || member.paystack_authorization_code || '').trim() || null,
            paystack_email_token: String(eventData?.email_token || member.paystack_email_token || '').trim() || null,
            payfast_subscription_status: String(eventData?.status || 'active').toLowerCase(),
            subscription_status_updated_at: now,
            updated_at: now,
          }).eq('member_key', member.member_key);
          if (updateError) throw updateError;
        }
      }
      return c.text('OK', 200);
    }

    if (eventType === 'subscription.not_renew' || eventType === 'subscription.disable') {
      const subscriptionCode = paystackSubscriptionCode(eventData);
      const member = await paystackMemberBySubscription(subscriptionCode);
      if (!member) return c.text('OK', 200);
      const settings = await getPaymentSettings();
      const { data, error } = await supabase.rpc('record_paystack_status_event', {
        p_event_key: paystackEventKey(event),
        p_member_key: member.member_key,
        p_transaction_id: null,
        p_purpose: 'membership_recurring',
        p_merchant_reference: null,
        p_pf_payment_id: null,
        p_subscription_token: subscriptionCode,
        p_payment_status: 'cancelled',
        p_payload: cleanPaystackPayload(event),
        p_grace_days: Number(settings.subscription_grace_days || 5),
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Paystack cancellation status could not be recorded.');
      return c.text('OK', 200);
    }

    if (eventType === 'refund.processed') {
      const reference = paystackReference(eventData);
      if (!reference) return c.text('OK', 200);
      const { data: transaction, error: txError } = await supabase.from('payment_transactions')
        .select('id, purpose, member_key, pf_payment_id')
        .eq('provider_merchant_reference', reference)
        .maybeSingle();
      if (txError) throw txError;
      if (!transaction) return c.text('OK', 200);
      const settings = await getPaymentSettings();
      const { data, error } = await supabase.rpc('record_paystack_status_event', {
        p_event_key: paystackEventKey(event),
        p_member_key: transaction.member_key,
        p_transaction_id: transaction.id,
        p_purpose: transaction.purpose,
        p_merchant_reference: reference,
        p_pf_payment_id: transaction.pf_payment_id || null,
        p_subscription_token: null,
        p_payment_status: 'refunded',
        p_payload: cleanPaystackPayload(event),
        p_grace_days: Number(settings.subscription_grace_days || 5),
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Paystack refund status could not be recorded.');
      return c.text('OK', 200);
    }

    return c.text('OK', 200);
  } catch (error) {
    console.error('Paystack webhook failed:', error?.message || error);
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
      subscription_grace_days: Math.round(number('subscription_grace_days', 0, 30)),
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
    if (!PAYSTACK_CONFIGURED) return c.json({ error: 'Paystack has not been configured on the We-Rise server yet.' }, 503);
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
      metadata: { request_code: request.request_code, maturity_date: request.maturity_date, provider: 'paystack' },
    });
    if (transactionError) throw transactionError;

    const checkout = await initializePaystackTransaction(PAYSTACK_SECRET_KEY, {
      email: auth.user.email || auth.profile.email || '',
      amount: toSubunit(numericAmount),
      currency: PAYSTACK_CURRENCY,
      reference,
      callback_url: `${primaryFrontendUrl}/?payment=success&kind=backmi&request=${encodeURIComponent(request.request_code)}`,
      metadata: JSON.stringify({
        provider: 'paystack',
        purpose: 'backmi_gift',
        member_key: auth.memberKey,
        request_code: request.request_code,
      }),
    });

    return c.json({
      authorization_url: checkout?.authorization_url,
      access_code: checkout?.access_code,
      reference: checkout?.reference || reference,
      mode: PAYSTACK_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test',
    });
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
    const topics = (data || []).map(topic => ({
      ...topic,
      id: Number(topic.id),
      replies: Number(topic.replies || 0),
      supports: Number(topic.supports || 0),
      supported: Boolean(topic.supported),
      avatar_url: null,
    }));

    if (canViewMemberPhotos(auth) && topics.length) {
      const topicIds = topics.map(topic => topic.id);
      const { data: authors, error: authorError } = await supabase.from('community_topics')
        .select('id, author_user_id')
        .in('id', topicIds)
        .not('author_user_id', 'is', null);
      if (authorError) throw authorError;
      const userIds = [...new Set((authors || []).map(row => row.author_user_id).filter(Boolean))];
      if (userIds.length) {
        const { data: profiles, error: profileError } = await supabase.from('member_profiles')
          .select('member_key, auth_user_id, avatar_path')
          .in('auth_user_id', userIds);
        if (profileError) throw profileError;
        const avatarByMember = await avatarUrlMap(profiles || []);
        const memberByUser = new Map((profiles || []).map(row => [row.auth_user_id, row.member_key]));
        const userByTopic = new Map((authors || []).map(row => [Number(row.id), row.author_user_id]));
        for (const topic of topics) {
          const member = memberByUser.get(userByTopic.get(topic.id));
          topic.avatar_url = avatarByMember.get(member) || null;
        }
      }
    }

    return c.json(topics);
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
    const auth = await authContext(c, false);
    const topicId = Number(c.req.param('id'));
    if (!Number.isInteger(topicId) || topicId <= 0) return c.json({ error: 'Invalid topic.' }, 400);
    const { data: topic, error: topicError } = await supabase.from('community_topics').select('id').eq('id', topicId).maybeSingle();
    if (topicError) throw topicError;
    if (!topic) return c.json({ error: 'Conversation not found.' }, 404);
    const { data, error } = await supabase.from('community_comments').select('id, topic_id, author, author_user_id, content, created_at').eq('topic_id', topicId).order('created_at', { ascending: true }).order('id', { ascending: true });
    if (error) throw error;
    const comments = data || [];
    let avatarByUser = new Map();
    if (canViewMemberPhotos(auth)) {
      const userIds = [...new Set(comments.map(row => row.author_user_id).filter(Boolean))];
      if (userIds.length) {
        const { data: profiles, error: profileError } = await supabase.from('member_profiles')
          .select('member_key, auth_user_id, avatar_path')
          .in('auth_user_id', userIds);
        if (profileError) throw profileError;
        const avatarByMember = await avatarUrlMap(profiles || []);
        avatarByUser = new Map((profiles || []).map(row => [row.auth_user_id, avatarByMember.get(row.member_key) || null]));
      }
    }
    return c.json(comments.map(({ author_user_id: authorUserId, ...comment }) => ({
      ...comment,
      avatar_url: avatarByUser.get(authorUserId) || null,
    })));
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
      .select('member_key, display_name, plan, last_seen_at, avatar_path')
      .neq('member_key', auth.memberKey)
      .eq('role', 'member')
      .not('auth_user_id', 'is', null)
      .order('display_name', { ascending: true })
      .limit(100);
    if (error) throw error;
    const avatarByMember = await avatarUrlMap(data || []);
    return c.json((data || []).map(({ avatar_path, ...member }) => ({
      ...member,
      avatar_url: avatarByMember.get(member.member_key) || null,
    })));
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
    const items = data || [];
    const memberKeys = [...new Set(items.map(item => item.other_member_key).filter(Boolean))];
    let avatarByMember = new Map();
    if (memberKeys.length) {
      const { data: profiles, error: profileError } = await supabase.from('member_profiles')
        .select('member_key, avatar_path')
        .in('member_key', memberKeys);
      if (profileError) throw profileError;
      avatarByMember = await avatarUrlMap(profiles || []);
    }
    return c.json(items.map(item => ({
      ...item,
      id: Number(item.id),
      unread_count: Number(item.unread_count || 0),
      avatar_url: avatarByMember.get(item.other_member_key) || null,
    })));
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
    const { name, email, age, province, city_town, country, explanation } = await c.req.json();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const numericAge = Number(age);
    if (!String(name || '').trim() || !/^\S+@\S+\.\S+$/.test(cleanEmail) || !Number.isFinite(numericAge) || numericAge < 18 || numericAge > 120 || !String(province || '').trim() || !String(city_town || '').trim() || !String(country || '').trim() || !String(explanation || '').trim()) {
      return c.json({ error: 'All waitlist fields are required and age must be 18 or older.' }, 400);
    }

    const { data: registeredMember, error: registeredError } = await supabase.from('member_profiles')
      .select('member_key')
      .eq('email', cleanEmail)
      .maybeSingle();
    if (registeredError) throw registeredError;
    if (registeredMember) return c.json({ error: 'This email address is already registered with We-Rise.' }, 409);

    const { data, error } = await supabase.from('waitlist_entries').insert({
      name: cleanName(name),
      email: cleanEmail.slice(0, 320),
      age: numericAge,
      province: String(province).trim().slice(0, 80),
      city_town: String(city_town).trim().slice(0, 100),
      country: String(country).trim().slice(0, 80),
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


// ---------------------------------------------------------------------------
// We-Rise Admin Control Centre V1
// ---------------------------------------------------------------------------
app.get('/api/admin/push/config', async (c) => {
  const auth = await adminContext(c);
  if (auth.response) return auth.response;
  return c.json({
    configured: ADMIN_PUSH_CONFIGURED,
    public_key: ADMIN_PUSH_CONFIGURED ? VAPID_PUBLIC_KEY : null,
  });
});

app.post('/api/admin/push/subscribe', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    if (!ADMIN_PUSH_CONFIGURED) return c.json({ error: 'Admin push notifications are not configured on Render yet.', code: 'PUSH_NOT_CONFIGURED' }, 503);
    const body = await c.req.json();
    const subscription = body?.subscription || body || {};
    const endpoint = String(subscription.endpoint || '').trim();
    const p256dh = String(subscription.keys?.p256dh || '').trim();
    const authKey = String(subscription.keys?.auth || '').trim();
    if (!/^https:\/\//i.test(endpoint) || !p256dh || !authKey) {
      return c.json({ error: 'The browser push subscription is incomplete.' }, 400);
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from('admin_push_subscriptions').upsert({
      admin_member_key: auth.memberKey,
      endpoint: endpoint.slice(0, 4000),
      p256dh: p256dh.slice(0, 1000),
      auth: authKey.slice(0, 1000),
      user_agent: String(c.req.header('user-agent') || '').slice(0, 500) || null,
      updated_at: now,
    }, { onConflict: 'endpoint' });
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    return fail(c, error);
  }
});

app.delete('/api/admin/push/subscribe', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const body = await c.req.json();
    const endpoint = String(body?.endpoint || '').trim();
    if (!endpoint) return c.json({ error: 'Push endpoint is required.' }, 400);
    const { error } = await supabase.from('admin_push_subscriptions').delete()
      .eq('admin_member_key', auth.memberKey)
      .eq('endpoint', endpoint);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/notifications', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const requested = Number(c.req.query('limit') || 40);
    const limit = Math.max(10, Math.min(100, Number.isFinite(requested) ? Math.floor(requested) : 40));
    const [{ data: items, error: itemError }, { count: totalCount, error: totalError }, { count: readCount, error: readError }] = await Promise.all([
      supabase.from('admin_notifications').select('id, type, member_key, title, body, url, metadata, created_at').order('created_at', { ascending: false }).limit(limit),
      supabase.from('admin_notifications').select('id', { count: 'exact', head: true }),
      supabase.from('admin_notification_reads').select('notification_id', { count: 'exact', head: true }).eq('admin_member_key', auth.memberKey),
    ]);
    if (itemError) throw itemError;
    if (totalError) throw totalError;
    if (readError) throw readError;
    const ids = (items || []).map(row => row.id);
    let readIds = new Set();
    if (ids.length) {
      const { data: reads, error } = await supabase.from('admin_notification_reads')
        .select('notification_id')
        .eq('admin_member_key', auth.memberKey)
        .in('notification_id', ids);
      if (error) throw error;
      readIds = new Set((reads || []).map(row => Number(row.notification_id)));
    }
    return c.json({
      unread_count: Math.max(0, Number(totalCount || 0) - Number(readCount || 0)),
      items: (items || []).map(row => ({ ...row, id: Number(row.id), read: readIds.has(Number(row.id)) })),
      push_configured: ADMIN_PUSH_CONFIGURED,
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/admin/notifications/:id/read', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const notificationId = Number(c.req.param('id'));
    if (!Number.isInteger(notificationId) || notificationId <= 0) return c.json({ error: 'Invalid notification.' }, 400);
    const { error } = await supabase.from('admin_notification_reads').upsert({
      notification_id: notificationId,
      admin_member_key: auth.memberKey,
      read_at: new Date().toISOString(),
    }, { onConflict: 'notification_id,admin_member_key' });
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/admin/notifications/read-all', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const { error } = await supabase.rpc('mark_all_admin_notifications_read', { p_admin_member_key: auth.memberKey });
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/overview', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const [{ data: metrics, error: metricError }, settingsResult] = await Promise.all([
      supabase.rpc('get_we_rise_admin_metrics'),
      getPaymentSettings(),
    ]);
    if (metricError) throw metricError;
    return c.json({
      metrics: metrics || {},
      payment_settings: publicPaymentSettings(settingsResult),
      system: {
        paystack_configured: PAYSTACK_CONFIGURED,
        paystack_mode: PAYSTACK_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test',
        gemini_configured: GEMINI_CONFIGURED,
        sms_configured: SMS_CONFIGURED,
        support_email_configured: SUPPORT_EMAIL_CONFIGURED,
        backmi_payments_enabled: BACKMI_PAYMENTS_ENABLED,
        admin_push_configured: ADMIN_PUSH_CONFIGURED,
      },
      admin: { role: auth.profile.role, email: auth.user.email || null },
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/activity', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const requested = Number(c.req.query('limit') || 60);
    const limit = Math.max(10, Math.min(150, Number.isFinite(requested) ? Math.floor(requested) : 60));
    const each = Math.max(15, Math.ceil(limit / 2));
    const [memberResult, paymentResult, waitlistResult] = await Promise.all([
      supabase.from('member_profiles').select('member_key, display_name, email, role, created_at').order('created_at', { ascending: false }).limit(each),
      supabase.from('payment_transactions').select('id, member_key, purpose, status, expected_amount_zar, amount_gross_zar, created_at, verified_at').order('created_at', { ascending: false }).limit(each),
      supabase.from('waitlist_entries').select('id, name, email, created_at').order('created_at', { ascending: false }).limit(each),
    ]);
    if (memberResult.error) throw memberResult.error;
    if (paymentResult.error) throw paymentResult.error;
    if (waitlistResult.error) throw waitlistResult.error;

    const paymentMemberKeys = [...new Set((paymentResult.data || []).map(row => row.member_key).filter(Boolean))];
    const paymentMembers = new Map();
    if (paymentMemberKeys.length) {
      const { data, error } = await supabase.from('member_profiles').select('member_key, display_name, email').in('member_key', paymentMemberKeys);
      if (error) throw error;
      for (const row of data || []) paymentMembers.set(row.member_key, row);
    }

    const items = [];
    for (const row of memberResult.data || []) {
      items.push({ id: row.member_key, type: 'member', at: row.created_at, title: `${row.display_name || 'A member'} joined We-Rise`, detail: row.email || 'New member account' });
    }
    for (const row of paymentResult.data || []) {
      const member = paymentMembers.get(row.member_key);
      const amount = Number(row.amount_gross_zar ?? row.expected_amount_zar ?? 0);
      const kind = row.purpose === 'membership_joining' ? 'joining payment' : row.purpose === 'membership_recurring' ? 'monthly membership' : 'BackMi gift';
      items.push({ id: row.id, type: 'payment', at: row.verified_at || row.created_at, title: `${member?.display_name || 'Member'} · ${row.status} ${kind}`, detail: `R${amount.toFixed(2)}${member?.email ? ` · ${member.email}` : ''}` });
    }
    for (const row of waitlistResult.data || []) {
      items.push({ id: row.id, type: 'waitlist', at: row.created_at, title: `${row.name || 'Someone'} joined the waitlist`, detail: row.email || 'Waitlist entry' });
    }
    items.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
    return c.json({ items: items.slice(0, limit) });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/members', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const page = Math.max(1, Math.floor(Number(c.req.query('page') || 1)));
    const pageSize = Math.max(10, Math.min(100, Math.floor(Number(c.req.query('page_size') || 30))));
    const status = String(c.req.query('status') || 'all').trim().toLowerCase();
    const search = String(c.req.query('search') || '').trim().slice(0, 100).replace(/[,%()]/g, ' ');
    const from = (page - 1) * pageSize;
    let query = supabase.from('member_profiles').select(PROFILE_COLUMNS, { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + pageSize - 1);
    if (['active', 'trialing', 'past_due', 'cancelled', 'suspended'].includes(status)) query = query.eq('membership_status', status);
    if (search) query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    const avatars = await avatarUrlMap(data || []);
    const items = (data || []).map(row => ({
      member_key: row.member_key,
      display_name: row.display_name,
      email: row.email,
      role: row.role || 'member',
      membership_status: row.membership_status,
      membership: membershipSummary(row),
      avatar_url: avatars.get(row.member_key) || null,
      profile_photo_completed_at: row.profile_photo_completed_at || null,
      created_at: row.created_at,
      last_seen_at: row.last_seen_at,
    }));
    return c.json({ items, total: Number(count || 0), page, page_size: pageSize, has_more: from + items.length < Number(count || 0) });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/members/:memberKey', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const memberKey = cleanMemberKey(c.req.param('memberKey'));
    if (!memberKey) return c.json({ error: 'Invalid member id.' }, 400);
    const { data: profile, error } = await supabase.from('member_profiles').select(PROFILE_COLUMNS).eq('member_key', memberKey).maybeSingle();
    if (error) throw error;
    if (!profile) return c.json({ error: 'Member not found.' }, 404);
    const [{ data: payments, error: paymentError }, avatarUrl] = await Promise.all([
      supabase.from('payment_transactions').select('id, purpose, currency, expected_amount_zar, amount_gross_zar, amount_fee_zar, amount_net_zar, status, checkout_reference, provider_merchant_reference, created_at, verified_at').eq('member_key', memberKey).order('created_at', { ascending: false }).limit(50),
      signedAvatarUrl(profile.avatar_path, 900),
    ]);
    if (paymentError) throw paymentError;
    let authUser = null;
    if (profile.auth_user_id) {
      const { data, error: authError } = await supabase.auth.admin.getUserById(profile.auth_user_id);
      if (!authError && data?.user) authUser = data.user;
    }
    return c.json({
      profile: {
        member_key: profile.member_key,
        display_name: profile.display_name,
        email: profile.email,
        role: profile.role || 'member',
        membership_status: profile.membership_status,
        avatar_url: avatarUrl,
        profile_photo_completed_at: profile.profile_photo_completed_at || null,
        paystack_customer_code: profile.paystack_customer_code || null,
        subscription_code: profile.payfast_subscription_token || null,
        subscription_status: profile.payfast_subscription_status || null,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        last_seen_at: profile.last_seen_at,
      },
      membership: membershipSummary(profile),
      auth: authUser ? {
        phone: authUser.phone || null,
        email_confirmed_at: authUser.email_confirmed_at || null,
        last_sign_in_at: authUser.last_sign_in_at || null,
        created_at: authUser.created_at || null,
      } : {},
      payments: payments || [],
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/payments', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const page = Math.max(1, Math.floor(Number(c.req.query('page') || 1)));
    const pageSize = Math.max(10, Math.min(100, Math.floor(Number(c.req.query('page_size') || 40))));
    const status = String(c.req.query('status') || 'all').trim().toLowerCase();
    const purpose = String(c.req.query('purpose') || 'all').trim().toLowerCase();
    const from = (page - 1) * pageSize;
    let query = supabase.from('payment_transactions').select('id, member_key, purpose, request_id, checkout_reference, provider_merchant_reference, pf_payment_id, currency, expected_amount_zar, amount_gross_zar, amount_fee_zar, amount_net_zar, item_name, status, created_at, updated_at, verified_at', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + pageSize - 1);
    if (['pending', 'complete', 'failed', 'cancelled', 'refunded', 'reversed'].includes(status)) query = query.eq('status', status);
    if (['membership_joining', 'membership_recurring', 'backmi_gift'].includes(purpose)) query = query.eq('purpose', purpose);
    const { data, error, count } = await query;
    if (error) throw error;
    const memberKeys = [...new Set((data || []).map(row => row.member_key).filter(Boolean))];
    const members = new Map();
    if (memberKeys.length) {
      const { data: memberRows, error: memberError } = await supabase.from('member_profiles').select('member_key, display_name, email').in('member_key', memberKeys);
      if (memberError) throw memberError;
      for (const row of memberRows || []) members.set(row.member_key, row);
    }
    const items = (data || []).map(row => ({ ...row, member_name: members.get(row.member_key)?.display_name || null, member_email: members.get(row.member_key)?.email || null }));
    return c.json({ items, total: Number(count || 0), page, page_size: pageSize, has_more: from + items.length < Number(count || 0) });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/waitlist', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const page = Math.max(1, Math.floor(Number(c.req.query('page') || 1)));
    const pageSize = Math.max(10, Math.min(500, Math.floor(Number(c.req.query('page_size') || 100))));
    const search = String(c.req.query('search') || '').trim().slice(0, 100).replace(/[,%()]/g, ' ');
    const from = (page - 1) * pageSize;
    let query = supabase.from('waitlist_entries').select('id, name, email, age, province, city_town, country, explanation, status, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + pageSize - 1);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    return c.json({ items: data || [], total: Number(count || 0), page, page_size: pageSize, has_more: from + (data?.length || 0) < Number(count || 0) });
  } catch (error) {
    return fail(c, error);
  }
});

app.delete('/api/admin/waitlist/:id', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id < 1) return c.json({ error: 'Invalid waitlist id.' }, 400);
    const { data: existing, error: findError } = await supabase.from('waitlist_entries').select('id, name, email').eq('id', id).maybeSingle();
    if (findError) throw findError;
    if (!existing) return c.json({ error: 'Waitlist entry not found.' }, 404);
    const { error } = await supabase.from('waitlist_entries').delete().eq('id', id);
    if (error) throw error;
    await recordAdminAudit(auth, 'waitlist_entry_removed', 'waitlist', String(id), { email: existing.email, name: existing.name });
    return c.json({ success: true });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/community', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const requested = Number(c.req.query('limit') || 100);
    const limit = Math.max(10, Math.min(250, Number.isFinite(requested) ? Math.floor(requested) : 100));
    const [{ data: topics, error: topicError }, { data: comments, error: commentError }] = await Promise.all([
      supabase.from('community_topics').select('id, title, author, author_user_id, created_at').order('created_at', { ascending: false }).limit(limit),
      supabase.from('community_comments').select('id, topic_id, author, content, author_user_id, created_at').order('created_at', { ascending: false }).limit(limit),
    ]);
    if (topicError) throw topicError;
    if (commentError) throw commentError;
    return c.json({ topics: topics || [], comments: comments || [] });
  } catch (error) {
    return fail(c, error);
  }
});

app.delete('/api/admin/community/topics/:id', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id < 1) return c.json({ error: 'Invalid topic id.' }, 400);
    const { data: existing, error: findError } = await supabase.from('community_topics').select('id, title, author').eq('id', id).maybeSingle();
    if (findError) throw findError;
    if (!existing) return c.json({ error: 'Community post not found.' }, 404);
    const { error } = await supabase.from('community_topics').delete().eq('id', id);
    if (error) throw error;
    await recordAdminAudit(auth, 'community_topic_removed', 'community_topic', String(id), { author: existing.author, title: existing.title });
    return c.json({ success: true });
  } catch (error) {
    return fail(c, error);
  }
});

app.delete('/api/admin/community/comments/:id', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id < 1) return c.json({ error: 'Invalid comment id.' }, 400);
    const { data: existing, error: findError } = await supabase.from('community_comments').select('id, topic_id, author, content').eq('id', id).maybeSingle();
    if (findError) throw findError;
    if (!existing) return c.json({ error: 'Community comment not found.' }, 404);
    const { error } = await supabase.from('community_comments').delete().eq('id', id);
    if (error) throw error;
    await recordAdminAudit(auth, 'community_comment_removed', 'community_comment', String(id), { topic_id: existing.topic_id, author: existing.author, content_preview: String(existing.content || '').slice(0, 160) });
    return c.json({ success: true });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/resellers', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const requested = Number(c.req.query('limit') || 200);
    const limit = Math.max(10, Math.min(500, Number.isFinite(requested) ? Math.floor(requested) : 200));
    const { data, error, count } = await supabase.from('referrals').select('id, referrer, referred_email, commission, status, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    const keys = [...new Set((data || []).map(row => row.referrer).filter(Boolean))];
    const members = new Map();
    if (keys.length) {
      const { data: rows, error: memberError } = await supabase.from('member_profiles').select('member_key, display_name, email').in('member_key', keys);
      if (memberError) throw memberError;
      for (const row of rows || []) members.set(row.member_key, row);
    }
    const items = (data || []).map(row => ({ ...row, commission: Number(row.commission || 0), referrer_name: members.get(row.referrer)?.display_name || null, referrer_email: members.get(row.referrer)?.email || null }));
    return c.json({ items, total: Number(count || 0), total_commission_zar: items.reduce((sum, row) => sum + Number(row.commission || 0), 0) });
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/admin/audit', async (c) => {
  try {
    const auth = await adminContext(c);
    if (auth.response) return auth.response;
    const requested = Number(c.req.query('limit') || 250);
    const limit = Math.max(10, Math.min(500, Number.isFinite(requested) ? Math.floor(requested) : 250));
    const { data, error } = await supabase.from('admin_audit_log').select('id, actor_member_key, actor_email, actor_role, action, target_type, target_key, metadata, created_at').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return c.json({ items: data || [] });
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
