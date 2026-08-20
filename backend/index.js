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
  allowMethods: ['GET', 'POST', 'OPTIONS'],
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
    const { title, description, goal, creator } = await c.req.json();
    const cleanTitle = String(title || '').trim();
    const numericGoal = Number(goal);
    if (!cleanTitle || !Number.isFinite(numericGoal) || numericGoal <= 0) {
      return c.json({ error: 'A title and positive goal amount are required.' }, 400);
    }
    const { data, error } = await supabase.from('campaigns').insert({
      title: cleanTitle.slice(0, 250),
      description: String(description || '').trim(),
      goal: numericGoal,
      creator: cleanName(creator),
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
    const { amount, donor } = await c.req.json();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return c.json({ error: 'A positive donation amount is required.' }, 400);
    const { data, error } = await supabase.rpc('record_donation', {
      p_campaign_id: c.req.param('id'),
      p_donor: cleanName(donor, 'Anonymous'),
      p_amount: numericAmount,
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
    const supporterKey = String(c.req.query('supporter_key') || '').trim();
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
    const { title, author } = await c.req.json();
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return c.json({ error: 'A community message is required.' }, 400);
    if (cleanTitle.length > MAX_COMMUNITY_CHARS) return c.json({ error: `Community messages are limited to ${MAX_COMMUNITY_CHARS} characters.` }, 400);
    const { data, error } = await supabase.from('community_topics').insert({ title: cleanTitle, author: cleanName(author) }).select('id').single();
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
    const topicId = Number(c.req.param('id'));
    if (!Number.isInteger(topicId) || topicId <= 0) return c.json({ error: 'Invalid topic.' }, 400);
    const { content, author } = await c.req.json();
    const cleanContent = String(content || '').trim();
    if (!cleanContent) return c.json({ error: 'A comment is required.' }, 400);
    if (cleanContent.length > MAX_COMMUNITY_CHARS) return c.json({ error: `Comments are limited to ${MAX_COMMUNITY_CHARS} characters.` }, 400);
    const { data: topic, error: topicError } = await supabase.from('community_topics').select('id').eq('id', topicId).maybeSingle();
    if (topicError) throw topicError;
    if (!topic) return c.json({ error: 'Conversation not found.' }, 404);
    const { data, error } = await supabase.from('community_comments').insert({ topic_id: topicId, author: cleanName(author), content: cleanContent }).select('id').single();
    if (error) throw error;
    return c.json({ id: Number(data.id), success: true }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/topics/:id/support', async (c) => {
  try {
    const topicId = Number(c.req.param('id'));
    if (!Number.isInteger(topicId) || topicId <= 0) return c.json({ error: 'Invalid topic.' }, 400);
    const { supporter_key } = await c.req.json();
    const supporterKey = String(supporter_key || '').trim();
    if (!supporterKey || supporterKey.length > 120) return c.json({ error: 'A valid supporter key is required.' }, 400);
    const { data, error } = await supabase.rpc('toggle_community_support', { p_topic_id: topicId, p_supporter_key: supporterKey });
    if (error) throw error;
    if (!data || !data.length) return c.json({ error: 'Conversation not found.' }, 404);
    return c.json({ supported: Boolean(data[0].supported), supports: Number(data[0].supports || 0) });
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/members/upsert', async (c) => {
  try {
    const { member_key, display_name } = await c.req.json();
    const memberKey = cleanMemberKey(member_key);
    const displayName = String(display_name || '').trim();
    if (!memberKey) return c.json({ error: 'A valid member key is required.' }, 400);
    if (!displayName || displayName.length > 80) return c.json({ error: 'A member name between 1 and 80 characters is required.' }, 400);

    const now = new Date().toISOString();
    const { data, error } = await supabase.from('member_profiles').upsert({
      member_key: memberKey,
      display_name: displayName,
      updated_at: now,
      last_seen_at: now,
    }, { onConflict: 'member_key' }).select('member_key, display_name, plan, created_at, updated_at, last_seen_at').single();
    if (error) throw error;
    return c.json(data);
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/members', async (c) => {
  try {
    const memberKey = cleanMemberKey(c.req.query('member_key'));
    if (!memberKey) return c.json({ error: 'A valid member key is required.' }, 400);
    const { data, error } = await supabase.from('member_profiles').select('member_key, display_name, plan, last_seen_at').neq('member_key', memberKey).order('display_name', { ascending: true }).limit(100);
    if (error) throw error;
    return c.json(data || []);
  } catch (error) {
    return fail(c, error);
  }
});

app.post('/api/conversations', async (c) => {
  try {
    const { member_key, other_member_key } = await c.req.json();
    const memberKey = cleanMemberKey(member_key);
    const otherKey = cleanMemberKey(other_member_key);
    if (!memberKey || !otherKey) return c.json({ error: 'Two valid members are required.' }, 400);
    if (memberKey === otherKey) return c.json({ error: 'You cannot start a conversation with yourself.' }, 400);

    const { data: members, error: memberError } = await supabase.from('member_profiles').select('member_key').in('member_key', [memberKey, otherKey]);
    if (memberError) throw memberError;
    if ((members || []).length !== 2) return c.json({ error: 'One of these We-Rise Ladies is not available.' }, 404);

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
    const memberKey = cleanMemberKey(c.req.query('member_key'));
    if (!memberKey) return c.json({ error: 'A valid member key is required.' }, 400);
    const { data, error } = await supabase.rpc('get_member_inbox', { p_member_key: memberKey });
    if (error) throw error;
    return c.json((data || []).map(item => ({ ...item, id: Number(item.id), unread_count: Number(item.unread_count || 0) })));
  } catch (error) {
    return fail(c, error);
  }
});

app.get('/api/conversations/:id/messages', async (c) => {
  try {
    const conversationId = Number(c.req.param('id'));
    const memberKey = cleanMemberKey(c.req.query('member_key'));
    const requestedLimit = Number(c.req.query('limit') || 20);
    const limit = Math.max(1, Math.min(MAX_MESSAGE_PAGE_SIZE, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 20));
    const beforeIdRaw = c.req.query('before_id');
    const beforeId = beforeIdRaw ? Number(beforeIdRaw) : null;
    if (!Number.isInteger(conversationId) || conversationId <= 0 || !memberKey) return c.json({ error: 'Invalid conversation request.' }, 400);

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
    const conversationId = Number(c.req.param('id'));
    const { member_key, content } = await c.req.json();
    const memberKey = cleanMemberKey(member_key);
    const cleanContent = String(content || '').trim();
    if (!Number.isInteger(conversationId) || conversationId <= 0 || !memberKey) return c.json({ error: 'Invalid conversation request.' }, 400);
    if (!cleanContent) return c.json({ error: 'A message is required.' }, 400);

    const { data: conversation, error: conversationError } = await supabase.from('private_conversations').select('id, member_a_key, member_b_key').eq('id', conversationId).maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return c.json({ error: 'Conversation not found.' }, 404);
    if (conversation.member_a_key !== memberKey && conversation.member_b_key !== memberKey) return c.json({ error: 'You do not have access to this conversation.' }, 403);

    const { data: profile, error: profileError } = await supabase.from('member_profiles').select('plan').eq('member_key', memberKey).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return c.json({ error: 'Member profile not found.' }, 404);
    const messageLimit = profile.plan === 'premium' ? PREMIUM_PRIVATE_MESSAGE_CHARS : FREE_PRIVATE_MESSAGE_CHARS;
    if (cleanContent.length > messageLimit) {
      return c.json({
        error: profile.plan === 'premium'
          ? `Premium messages are limited to ${PREMIUM_PRIVATE_MESSAGE_CHARS} characters.`
          : `Free messages are limited to ${FREE_PRIVATE_MESSAGE_CHARS} characters. Upgrade to We-Rise Premium for up to ${PREMIUM_PRIVATE_MESSAGE_CHARS} characters.`,
        code: 'MESSAGE_LIMIT',
        limit: messageLimit,
      }, 400);
    }

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
    const conversationId = Number(c.req.param('id'));
    const { member_key } = await c.req.json();
    const memberKey = cleanMemberKey(member_key);
    if (!Number.isInteger(conversationId) || conversationId <= 0 || !memberKey) return c.json({ error: 'Invalid conversation request.' }, 400);

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

app.post('/api/referrals', async (c) => {
  try {
    const { referrer, referred_email } = await c.req.json();
    const cleanReferrer = String(referrer || '').trim();
    if (!cleanReferrer) return c.json({ error: 'Referrer is required.' }, 400);
    const { error } = await supabase.from('referrals').insert({ referrer: cleanReferrer.slice(0, 120), referred_email: String(referred_email || '').trim().slice(0, 320) || null });
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
