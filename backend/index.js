import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
const MAX_COMMUNITY_CHARS = 250;
const FREE_PRIVATE_MESSAGE_CHARS = 150;
const PREMIUM_PRIVATE_MESSAGE_CHARS = 2000;
const MAX_MESSAGE_PAGE_SIZE = 30;

app.use('/*', cors());

app.get('/api/health', (c) => c.json({ status: 'ok', app: 'We-Rise' }));

app.get('/api/campaigns', async (c) => {
  try {
    const { results: campaigns } = await c.env.DB.prepare(
      'SELECT * FROM campaigns ORDER BY created_at DESC'
    ).all();
    const { results: donations } = await c.env.DB.prepare(
      'SELECT * FROM donations ORDER BY date DESC, time DESC'
    ).all();

    const grouped = new Map();
    for (const donation of donations) {
      const item = { ...donation, amount: Number(donation.amount || 0) };
      if (!grouped.has(donation.campaign_id)) grouped.set(donation.campaign_id, []);
      grouped.get(donation.campaign_id).push(item);
    }

    return c.json(campaigns.map(campaign => ({
      ...campaign,
      goal: Number(campaign.goal || 0),
      raised: Number(campaign.raised || 0),
      backers: Number(campaign.backers || 0),
      createdAt: campaign.created_at,
      donations: grouped.get(campaign.id) || [],
      dailyDonations: grouped.get(campaign.id) || [],
    })));
  } catch (e) {
    return c.json({ error: e.message }, 500);
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
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO campaigns (id, title, description, goal, creator) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, cleanTitle, String(description || '').trim(), numericGoal, String(creator || '').trim() || 'Anonymous We-Rise Lady').run();
    return c.json({ id, success: true }, 201);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/campaigns/:id', async (c) => {
  try {
    const campaign = await c.env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(c.req.param('id')).first();
    if (!campaign) return c.json({ error: 'Not found' }, 404);
    const { results: donations } = await c.env.DB.prepare(
      'SELECT * FROM donations WHERE campaign_id = ? ORDER BY date DESC, time DESC LIMIT 50'
    ).bind(c.req.param('id')).all();
    return c.json({ ...campaign, createdAt: campaign.created_at, donations, dailyDonations: donations });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/campaigns/:id/donate', async (c) => {
  try {
    const { amount, donor } = await c.req.json();
    const numericAmount = Number(amount);
    const campaignId = c.req.param('id');
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return c.json({ error: 'A positive donation amount is required.' }, 400);
    const existing = await c.env.DB.prepare('SELECT id FROM campaigns WHERE id = ?').bind(campaignId).first();
    if (!existing) return c.json({ error: 'Campaign not found' }, 404);
    await c.env.DB.prepare('INSERT INTO donations (campaign_id, donor, amount) VALUES (?, ?, ?)')
      .bind(campaignId, String(donor || '').trim() || 'Anonymous', numericAmount).run();
    await c.env.DB.prepare('UPDATE campaigns SET raised = raised + ?, backers = backers + 1 WHERE id = ?')
      .bind(numericAmount, campaignId).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/topics', async (c) => {
  try {
    const supporterKey = String(c.req.query('supporter_key') || '').trim();
    const { results } = await c.env.DB.prepare(`
      SELECT
        t.id,
        t.title,
        t.author,
        t.created_at,
        (SELECT COUNT(*) FROM community_comments cc WHERE cc.topic_id = t.id) AS replies,
        (SELECT COUNT(*) FROM community_supports cs WHERE cs.topic_id = t.id) AS supports,
        CASE
          WHEN ? <> '' AND EXISTS (
            SELECT 1 FROM community_supports mine
            WHERE mine.topic_id = t.id AND mine.supporter_key = ?
          ) THEN 1 ELSE 0
        END AS supported
      FROM community_topics t
      ORDER BY t.created_at DESC, t.id DESC
    `).bind(supporterKey, supporterKey).all();

    return c.json(results.map(topic => ({
      ...topic,
      replies: Number(topic.replies || 0),
      supports: Number(topic.supports || 0),
      supported: Number(topic.supported || 0) === 1,
    })));
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/topics', async (c) => {
  try {
    const { title, author } = await c.req.json();
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return c.json({ error: 'A community message is required.' }, 400);
    if (cleanTitle.length > MAX_COMMUNITY_CHARS) {
      return c.json({ error: `Community messages are limited to ${MAX_COMMUNITY_CHARS} characters.` }, 400);
    }
    const result = await c.env.DB.prepare('INSERT INTO community_topics (title, author) VALUES (?, ?)')
      .bind(cleanTitle, String(author || '').trim() || 'Anonymous We-Rise Lady').run();
    return c.json({ id: result.meta?.last_row_id, success: true }, 201);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/topics/:id/comments', async (c) => {
  try {
    const topicId = Number(c.req.param('id'));
    if (!Number.isInteger(topicId) || topicId <= 0) return c.json({ error: 'Invalid topic.' }, 400);
    const topic = await c.env.DB.prepare('SELECT id FROM community_topics WHERE id = ?').bind(topicId).first();
    if (!topic) return c.json({ error: 'Conversation not found.' }, 404);
    const { results } = await c.env.DB.prepare(`
      SELECT id, topic_id, author, content, created_at
      FROM community_comments
      WHERE topic_id = ?
      ORDER BY created_at ASC, id ASC
    `).bind(topicId).all();
    return c.json(results);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/topics/:id/comments', async (c) => {
  try {
    const topicId = Number(c.req.param('id'));
    if (!Number.isInteger(topicId) || topicId <= 0) return c.json({ error: 'Invalid topic.' }, 400);
    const { content, author } = await c.req.json();
    const cleanContent = String(content || '').trim();
    if (!cleanContent) return c.json({ error: 'A comment is required.' }, 400);
    if (cleanContent.length > MAX_COMMUNITY_CHARS) {
      return c.json({ error: `Comments are limited to ${MAX_COMMUNITY_CHARS} characters.` }, 400);
    }
    const topic = await c.env.DB.prepare('SELECT id FROM community_topics WHERE id = ?').bind(topicId).first();
    if (!topic) return c.json({ error: 'Conversation not found.' }, 404);

    const result = await c.env.DB.prepare(
      'INSERT INTO community_comments (topic_id, author, content) VALUES (?, ?, ?)'
    ).bind(topicId, String(author || '').trim() || 'Anonymous We-Rise Lady', cleanContent).run();

    return c.json({ id: result.meta?.last_row_id, success: true }, 201);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/topics/:id/support', async (c) => {
  try {
    const topicId = Number(c.req.param('id'));
    if (!Number.isInteger(topicId) || topicId <= 0) return c.json({ error: 'Invalid topic.' }, 400);
    const { supporter_key } = await c.req.json();
    const supporterKey = String(supporter_key || '').trim();
    if (!supporterKey || supporterKey.length > 120) return c.json({ error: 'A valid supporter key is required.' }, 400);

    const topic = await c.env.DB.prepare('SELECT id FROM community_topics WHERE id = ?').bind(topicId).first();
    if (!topic) return c.json({ error: 'Conversation not found.' }, 404);

    const existing = await c.env.DB.prepare(
      'SELECT topic_id FROM community_supports WHERE topic_id = ? AND supporter_key = ?'
    ).bind(topicId, supporterKey).first();

    let supported;
    if (existing) {
      await c.env.DB.prepare('DELETE FROM community_supports WHERE topic_id = ? AND supporter_key = ?')
        .bind(topicId, supporterKey).run();
      supported = false;
    } else {
      await c.env.DB.prepare('INSERT INTO community_supports (topic_id, supporter_key) VALUES (?, ?)')
        .bind(topicId, supporterKey).run();
      supported = true;
    }

    const count = await c.env.DB.prepare(
      'SELECT COUNT(*) AS total FROM community_supports WHERE topic_id = ?'
    ).bind(topicId).first();

    return c.json({ supported, supports: Number(count?.total || 0) });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});


function cleanMemberKey(value) {
  const key = String(value || '').trim();
  return key.length >= 8 && key.length <= 120 ? key : '';
}

app.post('/api/members/upsert', async (c) => {
  try {
    const { member_key, display_name } = await c.req.json();
    const memberKey = cleanMemberKey(member_key);
    const displayName = String(display_name || '').trim();
    if (!memberKey) return c.json({ error: 'A valid member key is required.' }, 400);
    if (!displayName || displayName.length > 80) return c.json({ error: 'A member name between 1 and 80 characters is required.' }, 400);

    await c.env.DB.prepare(`
      INSERT INTO member_profiles (member_key, display_name)
      VALUES (?, ?)
      ON CONFLICT(member_key) DO UPDATE SET
        display_name = excluded.display_name,
        updated_at = datetime('now'),
        last_seen_at = datetime('now')
    `).bind(memberKey, displayName).run();

    const profile = await c.env.DB.prepare(`
      SELECT member_key, display_name, plan, created_at, updated_at, last_seen_at
      FROM member_profiles WHERE member_key = ?
    `).bind(memberKey).first();
    return c.json(profile);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/members', async (c) => {
  try {
    const memberKey = cleanMemberKey(c.req.query('member_key'));
    if (!memberKey) return c.json({ error: 'A valid member key is required.' }, 400);
    const { results } = await c.env.DB.prepare(`
      SELECT member_key, display_name, plan, last_seen_at
      FROM member_profiles
      WHERE member_key <> ?
      ORDER BY display_name COLLATE NOCASE ASC
      LIMIT 100
    `).bind(memberKey).all();
    return c.json(results);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/conversations', async (c) => {
  try {
    const { member_key, other_member_key } = await c.req.json();
    const memberKey = cleanMemberKey(member_key);
    const otherKey = cleanMemberKey(other_member_key);
    if (!memberKey || !otherKey) return c.json({ error: 'Two valid members are required.' }, 400);
    if (memberKey === otherKey) return c.json({ error: 'You cannot start a conversation with yourself.' }, 400);

    const first = await c.env.DB.prepare('SELECT member_key FROM member_profiles WHERE member_key = ?').bind(memberKey).first();
    const second = await c.env.DB.prepare('SELECT member_key FROM member_profiles WHERE member_key = ?').bind(otherKey).first();
    if (!first || !second) return c.json({ error: 'One of these We-Rise Ladies is not available.' }, 404);

    const [memberA, memberB] = [memberKey, otherKey].sort();
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO private_conversations (member_a_key, member_b_key)
      VALUES (?, ?)
    `).bind(memberA, memberB).run();

    const conversation = await c.env.DB.prepare(`
      SELECT id, member_a_key, member_b_key, created_at, last_message_at
      FROM private_conversations
      WHERE member_a_key = ? AND member_b_key = ?
    `).bind(memberA, memberB).first();
    return c.json(conversation, 201);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/inbox', async (c) => {
  try {
    const memberKey = cleanMemberKey(c.req.query('member_key'));
    if (!memberKey) return c.json({ error: 'A valid member key is required.' }, 400);

    const { results } = await c.env.DB.prepare(`
      SELECT
        conv.id,
        conv.created_at,
        conv.last_message_at,
        CASE WHEN conv.member_a_key = ? THEN conv.member_b_key ELSE conv.member_a_key END AS other_member_key,
        CASE WHEN conv.member_a_key = ? THEN profile_b.display_name ELSE profile_a.display_name END AS other_name,
        (
          SELECT pm.content FROM private_messages pm
          WHERE pm.conversation_id = conv.id
          ORDER BY pm.id DESC LIMIT 1
        ) AS last_message,
        (
          SELECT pm.sender_key FROM private_messages pm
          WHERE pm.conversation_id = conv.id
          ORDER BY pm.id DESC LIMIT 1
        ) AS last_sender_key,
        (
          SELECT COUNT(*) FROM private_messages unread
          WHERE unread.conversation_id = conv.id
            AND unread.receiver_key = ?
            AND unread.read_at IS NULL
        ) AS unread_count
      FROM private_conversations conv
      JOIN member_profiles profile_a ON profile_a.member_key = conv.member_a_key
      JOIN member_profiles profile_b ON profile_b.member_key = conv.member_b_key
      WHERE conv.member_a_key = ? OR conv.member_b_key = ?
      ORDER BY COALESCE(conv.last_message_at, conv.created_at) DESC, conv.id DESC
      LIMIT 100
    `).bind(memberKey, memberKey, memberKey, memberKey, memberKey).all();

    return c.json(results.map(item => ({
      ...item,
      unread_count: Number(item.unread_count || 0),
    })));
  } catch (e) {
    return c.json({ error: e.message }, 500);
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

    const conversation = await c.env.DB.prepare(`
      SELECT id, member_a_key, member_b_key
      FROM private_conversations WHERE id = ?
    `).bind(conversationId).first();
    if (!conversation) return c.json({ error: 'Conversation not found.' }, 404);
    if (conversation.member_a_key !== memberKey && conversation.member_b_key !== memberKey) {
      return c.json({ error: 'You do not have access to this conversation.' }, 403);
    }

    const fetchLimit = limit + 1;
    let query;
    let rows;
    if (Number.isInteger(beforeId) && beforeId > 0) {
      query = c.env.DB.prepare(`
        SELECT id, conversation_id, sender_key, receiver_key, content, created_at, read_at
        FROM private_messages
        WHERE conversation_id = ? AND id < ?
        ORDER BY id DESC
        LIMIT ?
      `);
      ({ results: rows } = await query.bind(conversationId, beforeId, fetchLimit).all());
    } else {
      query = c.env.DB.prepare(`
        SELECT id, conversation_id, sender_key, receiver_key, content, created_at, read_at
        FROM private_messages
        WHERE conversation_id = ?
        ORDER BY id DESC
        LIMIT ?
      `);
      ({ results: rows } = await query.bind(conversationId, fetchLimit).all());
    }

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    return c.json({
      messages: page,
      has_more: hasMore,
      next_before_id: hasMore && page.length ? page[0].id : null,
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
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

    const conversation = await c.env.DB.prepare(`
      SELECT id, member_a_key, member_b_key
      FROM private_conversations WHERE id = ?
    `).bind(conversationId).first();
    if (!conversation) return c.json({ error: 'Conversation not found.' }, 404);
    if (conversation.member_a_key !== memberKey && conversation.member_b_key !== memberKey) {
      return c.json({ error: 'You do not have access to this conversation.' }, 403);
    }

    const profile = await c.env.DB.prepare('SELECT plan FROM member_profiles WHERE member_key = ?').bind(memberKey).first();
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
    const result = await c.env.DB.prepare(`
      INSERT INTO private_messages (conversation_id, sender_key, receiver_key, content)
      VALUES (?, ?, ?, ?)
    `).bind(conversationId, memberKey, receiverKey, cleanContent).run();

    await c.env.DB.prepare(`
      UPDATE private_conversations SET last_message_at = datetime('now') WHERE id = ?
    `).bind(conversationId).run();
    await c.env.DB.prepare(`
      UPDATE member_profiles SET last_seen_at = datetime('now') WHERE member_key = ?
    `).bind(memberKey).run();

    const message = await c.env.DB.prepare(`
      SELECT id, conversation_id, sender_key, receiver_key, content, created_at, read_at
      FROM private_messages WHERE id = ?
    `).bind(result.meta?.last_row_id).first();
    return c.json({ message }, 201);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/conversations/:id/read', async (c) => {
  try {
    const conversationId = Number(c.req.param('id'));
    const { member_key } = await c.req.json();
    const memberKey = cleanMemberKey(member_key);
    if (!Number.isInteger(conversationId) || conversationId <= 0 || !memberKey) return c.json({ error: 'Invalid conversation request.' }, 400);

    const conversation = await c.env.DB.prepare(`
      SELECT member_a_key, member_b_key FROM private_conversations WHERE id = ?
    `).bind(conversationId).first();
    if (!conversation) return c.json({ error: 'Conversation not found.' }, 404);
    if (conversation.member_a_key !== memberKey && conversation.member_b_key !== memberKey) {
      return c.json({ error: 'You do not have access to this conversation.' }, 403);
    }

    await c.env.DB.prepare(`
      UPDATE private_messages
      SET read_at = COALESCE(read_at, datetime('now'))
      WHERE conversation_id = ? AND receiver_key = ? AND read_at IS NULL
    `).bind(conversationId, memberKey).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/referrals', async (c) => {
  try {
    const { referrer, referred_email } = await c.req.json();
    const cleanReferrer = String(referrer || '').trim();
    if (!cleanReferrer) return c.json({ error: 'Referrer is required.' }, 400);
    await c.env.DB.prepare('INSERT INTO referrals (referrer, referred_email) VALUES (?, ?)')
      .bind(cleanReferrer, String(referred_email || '').trim()).run();
    return c.json({ success: true }, 201);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
