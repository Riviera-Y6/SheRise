import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

const MAX_COMMUNITY_CHARS = 250;
const FREE_PRIVATE_MESSAGE_CHARS = 150;
const PREMIUM_PRIVATE_MESSAGE_CHARS = 2000;
const MAX_MESSAGE_PAGE_SIZE = 30;

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const TWILIO_ACCOUNT_SID = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
const TWILIO_AUTH_TOKEN = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
const TWILIO_FROM_NUMBER = String(process.env.TWILIO_FROM_NUMBER || '').trim();
const EMERGENCY_SMS_ENABLED = String(process.env.ENABLE_EMERGENCY_SMS || '').trim().toLowerCase() === 'true';
const SMS_CONFIGURED = Boolean(EMERGENCY_SMS_ENABLED && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy backend/.env.example to backend/.env for local development, or set the variables in Render.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedOrigins = new Set(
  String(process.env.FRONTEND_URL || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
);

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
    .select('member_key, auth_user_id, email, display_name, plan, created_at, updated_at, last_seen_at')
    .eq('member_key', user.id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { data, error } = await supabase.from('member_profiles')
      .update({ auth_user_id: user.id, email, updated_at: now, last_seen_at: now })
      .eq('member_key', user.id)
      .select('member_key, auth_user_id, email, display_name, plan, created_at, updated_at, last_seen_at')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from('member_profiles').insert({
    member_key: user.id,
    auth_user_id: user.id,
    email,
    display_name: profileNameFromUser(user),
    updated_at: now,
    last_seen_at: now,
  }).select('member_key, auth_user_id, email, display_name, plan, created_at, updated_at, last_seen_at').single();
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
  return { user: data.user, memberKey: data.user.id, profile };
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

function formatDonation(row) {
  return {
    ...row,
    amount: Number(row.amount || 0),
    date: row.date || (row.created_at ? String(row.created_at).slice(0, 10) : null),
    time: row.time || (row.created_at ? String(row.created_at).slice(11, 19) : null),
  };
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
      profile: auth.profile,
    });
  } catch (error) {
    return fail(c, error);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const [{ data: campaigns, error: campaignError }, { data: donations, error: donationError }] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('donations').select('*').order('created_at', { ascending: false }),
    ]);
    if (campaignError) throw campaignError;
    if (donationError) throw donationError;

    const grouped = new Map();
    for (const donation of donations || []) {
      const item = formatDonation(donation);
      if (!grouped.has(donation.campaign_id)) grouped.set(donation.campaign_id, []);
      grouped.get(donation.campaign_id).push(item);
    }

    return c.json((campaigns || []).map(campaign => ({
      ...campaign,
      goal: Number(campaign.goal || 0),
      raised: Number(campaign.raised || 0),
      backers: Number(campaign.backers || 0),
      createdAt: campaign.created_at,
      donations: grouped.get(campaign.id) || [],
      dailyDonations: grouped.get(campaign.id) || [],
    })));
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/campaigns', async (c) => {
  try {
    const auth = await authContext(c);
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
    }).select('id').single();
    if (error) throw error;
    return c.json({ id: data.id, success: true }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/campaigns/:id', async (c) => {
  try {
    const campaignId = c.req.param('id');
    const { data: campaign, error: campaignError } = await supabase.from('campaigns').select('*').eq('id', campaignId).maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) return c.json({ error: 'Not found' }, 404);
    const { data: donations, error: donationError } = await supabase.from('donations').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(50);
    if (donationError) throw donationError;
    const items = (donations || []).map(formatDonation);
    return c.json({
      ...campaign,
      goal: Number(campaign.goal || 0),
      raised: Number(campaign.raised || 0),
      backers: Number(campaign.backers || 0),
      createdAt: campaign.created_at,
      donations: items,
      dailyDonations: items,
    });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/campaigns/:id/donate', async (c) => {
  try {
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    const { amount } = await c.req.json();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return c.json({ error: 'A positive donation amount is required.' }, 400);
    const { data, error } = await supabase.rpc('record_donation', {
      p_campaign_id: c.req.param('id'),
      p_donor: auth.profile.display_name,
      p_amount: numericAmount,
      p_donor_user_id: auth.user.id,
    });
    if (error) throw error;
    if (!data) return c.json({ error: 'Campaign not found.' }, 404);
    return c.json({ success: true });
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
    if (auth.response) return auth.response;
    const { data, error } = await supabase.from('member_profiles')
      .select('member_key, display_name, plan, last_seen_at')
      .neq('member_key', auth.memberKey)
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
    const auth = await authContext(c);
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
