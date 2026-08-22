import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HiArrowLeft,
  HiChat,
  HiHeart,
  HiPaperAirplane,
  HiPhone,
  HiRefresh,
  HiShieldCheck,
} from 'react-icons/hi';
import { apiRequest } from '../lib/api';

const MAX_COMMUNITY_CHARS = 250;

function formatTopicTime(createdAt, lang) {
  if (!createdAt) return '';
  const raw = String(createdAt).replace(' ', 'T');
  const date = new Date(raw.endsWith('Z') ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return lang === 'en' ? 'Just now' : 'Nou net';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return lang === 'en' ? `${minutes} min ago` : `${minutes} min gelede`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === 'en' ? `${hours}h ago` : `${hours}u gelede`;
  const days = Math.floor(hours / 24);
  if (days < 7) return lang === 'en' ? `${days}d ago` : `${days}d gelede`;
  return date.toLocaleDateString(lang === 'en' ? 'en-ZA' : 'af-ZA', {
    day: 'numeric', month: 'short', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function initials(name) {
  const clean = String(name || '').trim();
  if (!clean) return 'W';
  return clean.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}


function CommunityAvatar({ name, small = false }) {
  return (
    <div className={`community-avatar ${small ? 'community-avatar-small' : ''}`} aria-hidden="true">
      {initials(name)}
    </div>
  );
}

export default function Community({ t, lang, showToast, userName, memberKey, isAuthenticated = false, onRequireAuth, onConversationChange }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);
  const [supportBusy, setSupportBusy] = useState(null);

  const authorName = userName?.trim() || (lang === 'en' ? 'Anonymous We-Rise Lady' : 'Anonieme We-Rise Lady');
  const selectedTopic = useMemo(
    () => topics.find(topic => String(topic.id) === String(selectedTopicId)) || null,
    [topics, selectedTopicId],
  );

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await apiRequest('/api/topics');
      setTopics(Array.isArray(data) ? data : []);
    } catch {
      setTopics([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComments = useCallback(async (topicId) => {
    if (!topicId) return;
    setCommentsLoading(true);
    try {
      const data = await apiRequest(`/api/topics/${topicId}/comments`);
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setComments([]);
      showToast(lang === 'en' ? 'Could not load comments.' : 'Kon nie kommentaar laai nie.');
    } finally {
      setCommentsLoading(false);
    }
  }, [lang, showToast]);

  useEffect(() => { loadTopics(); }, [loadTopics]);

  useEffect(() => {
    onConversationChange?.(Boolean(selectedTopicId));
    return () => onConversationChange?.(false);
  }, [selectedTopicId, onConversationChange]);

  useEffect(() => {
    if (selectedTopicId) loadComments(selectedTopicId);
  }, [selectedTopicId, loadComments]);

  const handleCreatePost = async () => {
    if (!isAuthenticated) { onRequireAuth?.(); return; }
    const content = postText.trim();
    if (!content || content.length > MAX_COMMUNITY_CHARS || posting) return;
    setPosting(true);
    try {
      const created = await apiRequest('/api/topics', {
        method: 'POST',
        body: JSON.stringify({ title: content }),
      });
      setPostText('');
      await loadTopics();
      if (created?.id) setSelectedTopicId(created.id);
      showToast(lang === 'en' ? 'Your post is live 💗' : 'Jou plasing is nou live 💗');
    } catch (error) {
      showToast(error?.message || (lang === 'en' ? 'Could not publish your post.' : 'Kon nie jou plasing publiseer nie.'));
    } finally {
      setPosting(false);
    }
  };

  const handleCreateComment = async () => {
    if (!isAuthenticated) { onRequireAuth?.(); return; }
    const content = commentText.trim();
    if (!selectedTopicId || !content || content.length > MAX_COMMUNITY_CHARS || commentPosting) return;
    setCommentPosting(true);
    try {
      await apiRequest(`/api/topics/${selectedTopicId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setCommentText('');
      await Promise.all([loadComments(selectedTopicId), loadTopics()]);
      showToast(lang === 'en' ? 'Comment added 💗' : 'Kommentaar bygevoeg 💗');
    } catch (error) {
      showToast(error?.message || (lang === 'en' ? 'Could not add your comment.' : 'Kon nie jou kommentaar byvoeg nie.'));
    } finally {
      setCommentPosting(false);
    }
  };

  const toggleSupport = async (topicId) => {
    if (!isAuthenticated) { onRequireAuth?.(); return; }
    if (supportBusy) return;
    setSupportBusy(topicId);
    try {
      const result = await apiRequest(`/api/topics/${topicId}/support`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setTopics(current => current.map(topic => String(topic.id) === String(topicId)
        ? { ...topic, supports: Number(result.supports || 0), supported: Boolean(result.supported) }
        : topic));
    } catch {
      showToast(lang === 'en' ? 'Could not update support.' : 'Kon nie ondersteuning opdateer nie.');
    } finally {
      setSupportBusy(null);
    }
  };

  const handleComposerKeyDown = (event, callback) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      callback();
    }
  };

  const helpline = {
    name: lang === 'en' ? 'South Africa GBV Command Centre' : 'Suid-Afrika GBV Command Centre',
    number: '0800 428 428',
  };

  if (selectedTopic) {
    return (
      <div className="community-screen fade-in">
        <div className="community-detail-header">
          <button
            type="button"
            className="community-back-button"
            onClick={() => {
              setSelectedTopicId(null);
              setCommentText('');
            }}
            aria-label={lang === 'en' ? 'Back to community' : 'Terug na gemeenskap'}
          >
            <HiArrowLeft />
          </button>
          <div>
            <div className="community-detail-kicker">{lang === 'en' ? 'WE-RISE COMMUNITY' : 'WE-RISE GEMEENSKAP'}</div>
            <h2 className="community-detail-title">{lang === 'en' ? 'Conversation' : 'Gesprek'}</h2>
          </div>
        </div>

        <article className="community-post-card community-post-card-featured">
          <div className="community-post-header">
            <CommunityAvatar name={selectedTopic.author} />
            <div className="community-author-block">
              <div className="community-author-line">
                <strong>{selectedTopic.author || authorName}</strong>
                <span className="community-lady-badge">We-Rise Lady</span>
              </div>
              <span className="community-time">{formatTopicTime(selectedTopic.created_at, lang)}</span>
            </div>
          </div>
          <p className="community-post-copy">{selectedTopic.title}</p>
          <div className="community-actions">
            <button
              type="button"
              className={`community-action ${selectedTopic.supported ? 'is-supported' : ''}`}
              onClick={() => toggleSupport(selectedTopic.id)}
              disabled={supportBusy === selectedTopic.id}
            >
              <HiHeart />
              <span>{lang === 'en' ? 'Support' : 'Ondersteun'}</span>
              <b>{Number(selectedTopic.supports || 0)}</b>
            </button>
            <div className="community-action community-action-static">
              <HiChat />
              <span>{lang === 'en' ? 'Comments' : 'Kommentaar'}</span>
              <b>{Number(selectedTopic.replies || 0)}</b>
            </div>
          </div>
        </article>

        <section className="community-comments-section">
          <div className="community-section-heading-row">
            <div>
              <div className="community-section-kicker">{lang === 'en' ? 'SUPPORT CIRCLE' : 'ONDERSTEUNINGSKRING'}</div>
              <h3>{lang === 'en' ? 'Comments & advice' : 'Kommentaar & raad'}</h3>
            </div>
            <span className="community-count-pill">{comments.length}</span>
          </div>

          {commentsLoading ? (
            <div className="community-loading-stack" aria-label={lang === 'en' ? 'Loading comments' : 'Laai kommentaar'}>
              <div className="community-skeleton" />
              <div className="community-skeleton community-skeleton-short" />
            </div>
          ) : comments.length === 0 ? (
            <div className="community-empty-conversation">
              <div className="community-empty-icon"><HiChat /></div>
              <h4>{lang === 'en' ? 'Be the first to respond' : 'Wees die eerste om te antwoord'}</h4>
              <p>{lang === 'en'
                ? 'A thoughtful word can make someone feel seen. Keep it kind, useful and respectful.'
                : '’n Bedagsame woord kan iemand raakgesien laat voel. Hou dit vriendelik, nuttig en respekvol.'}</p>
            </div>
          ) : (
            <div className="community-comment-list">
              {comments.map(comment => (
                <div key={comment.id} className="community-comment">
                  <CommunityAvatar name={comment.author} small />
                  <div className="community-comment-bubble">
                    <div className="community-comment-meta">
                      <strong>{comment.author || authorName}</strong>
                      <span>{formatTopicTime(comment.created_at, lang)}</span>
                    </div>
                    <p>{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="community-comment-composer">
          <div className="community-composer-topline">
            <span>{lang === 'en' ? 'Add to the conversation' : 'Voeg by die gesprek'}</span>
            <span className={commentText.length >= 230 ? 'community-counter is-near-limit' : 'community-counter'}>
              {commentText.length}/{MAX_COMMUNITY_CHARS}
            </span>
          </div>
          <div className="community-comment-input-row">
            <textarea
              className="community-comment-input"
              value={commentText}
              maxLength={MAX_COMMUNITY_CHARS}
              rows={2}
              readOnly={!isAuthenticated}
              onFocus={() => { if (!isAuthenticated) onRequireAuth?.(); }}
              onChange={event => setCommentText(event.target.value)}
              onKeyDown={event => handleComposerKeyDown(event, handleCreateComment)}
              placeholder={isAuthenticated
                ? (lang === 'en' ? 'Write a kind, helpful comment…' : 'Skryf ’n vriendelike, nuttige kommentaar…')
                : (lang === 'en' ? 'Log in to join this conversation' : 'Meld aan om by hierdie gesprek aan te sluit')}
            />
            <button
              type="button"
              className="community-send-button"
              onClick={handleCreateComment}
              disabled={isAuthenticated ? (!commentText.trim() || commentPosting) : false}
              aria-label={lang === 'en' ? 'Send comment' : 'Stuur kommentaar'}
            >
              <HiPaperAirplane />
            </button>
          </div>
          <div className="community-composer-hint">{lang === 'en' ? 'Ctrl/⌘ + Enter to send' : 'Ctrl/⌘ + Enter om te stuur'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="community-screen fade-in">
      <section className="community-hero">
        <div className="community-hero-glow" aria-hidden="true" />
        <div className="community-kicker">{lang === 'en' ? 'A SAFE CIRCLE FOR WE-RISE LADIES' : '’N VEILIGE KRING VIR WE-RISE LADIES'}</div>
        <h2>{t.communityTitle}</h2>
        <p>{lang === 'en'
          ? 'Share what is on your heart, ask for advice, and support another woman with a thoughtful word.'
          : 'Deel wat op jou hart is, vra raad en ondersteun ’n ander vrou met ’n bedagsame woord.'}</p>
        <div className="community-hero-meta">
          <span><span className="community-live-dot" />{lang === 'en' ? 'Community open' : 'Gemeenskap oop'}</span>
          <span>•</span>
          <span>{MAX_COMMUNITY_CHARS} {lang === 'en' ? 'characters per message' : 'karakters per boodskap'}</span>
        </div>
      </section>

      <div className="community-safety-strip">
        <div className="community-safety-icon"><HiShieldCheck /></div>
        <div className="community-safety-copy">
          <strong>{lang === 'en' ? 'Need urgent support?' : 'Het jy dringende hulp nodig?'}</strong>
          <span>{helpline.name}</span>
        </div>
        <a href={`tel:${helpline.number.replace(/\s/g, '')}`} className="community-safety-call" aria-label={`${t.callHelpline} ${helpline.number}`}>
          <HiPhone />
          <span>{helpline.number}</span>
        </a>
      </div>

      <section className="community-composer-card">
        <div className="community-composer-header">
          <CommunityAvatar name={authorName} />
          <div>
            <strong>{userName || (lang === 'en' ? 'We-Rise Lady' : 'We-Rise Lady')}</strong>
            <span>{lang === 'en' ? 'Share with the community' : 'Deel met die gemeenskap'}</span>
          </div>
        </div>
        <textarea
          className="community-composer-textarea"
          value={postText}
          maxLength={MAX_COMMUNITY_CHARS}
          rows={4}
          readOnly={!isAuthenticated}
          onFocus={() => { if (!isAuthenticated) onRequireAuth?.(); }}
          onChange={event => setPostText(event.target.value)}
          onKeyDown={event => handleComposerKeyDown(event, handleCreatePost)}
          placeholder={isAuthenticated
            ? (lang === 'en' ? 'What would you like to share or ask today?' : 'Wat wil jy vandag deel of vra?')
            : (lang === 'en' ? 'Log in to share with the We-Rise community' : 'Meld aan om met die We-Rise gemeenskap te deel')}
        />
        <div className="community-composer-footer">
          <div>
            <span className={postText.length >= 230 ? 'community-counter is-near-limit' : 'community-counter'}>
              {postText.length}/{MAX_COMMUNITY_CHARS}
            </span>
            <span className="community-kindness-note">{lang === 'en' ? 'Kindness first 💗' : 'Vriendelikheid eerste 💗'}</span>
          </div>
          <button
            type="button"
            className="community-post-button"
            onClick={handleCreatePost}
            disabled={isAuthenticated ? (!postText.trim() || posting) : false}
          >
            <HiPaperAirplane />
            {!isAuthenticated ? (lang === 'en' ? 'Log in to post' : 'Meld aan om te plaas') : posting ? (lang === 'en' ? 'Posting…' : 'Plaas…') : (lang === 'en' ? 'Post' : 'Plaas')}
          </button>
        </div>
      </section>

      <section className="community-feed-section">
        <div className="community-section-heading-row">
          <div>
            <div className="community-section-kicker">{lang === 'en' ? 'THE COMMUNITY' : 'DIE GEMEENSKAP'}</div>
            <h3>{lang === 'en' ? 'Latest conversations' : 'Nuutste gesprekke'}</h3>
          </div>
          {!loading && !loadError && topics.length > 0 && (
            <span className="community-count-pill">{topics.length}</span>
          )}
        </div>

        {loading ? (
          <div className="community-loading-stack" aria-label={lang === 'en' ? 'Loading community' : 'Laai gemeenskap'}>
            <div className="community-skeleton" />
            <div className="community-skeleton" />
            <div className="community-skeleton community-skeleton-short" />
          </div>
        ) : loadError ? (
          <div className="community-feed-state">
            <div className="community-state-icon"><HiRefresh /></div>
            <h4>{lang === 'en' ? 'Community could not connect' : 'Gemeenskap kon nie koppel nie'}</h4>
            <p>{lang === 'en'
              ? 'Start the We-Rise backend and try again.'
              : 'Begin die We-Rise-agterkant en probeer weer.'}</p>
            <button type="button" className="community-retry-button" onClick={loadTopics}><HiRefresh /> {lang === 'en' ? 'Try again' : 'Probeer weer'}</button>
          </div>
        ) : topics.length === 0 ? (
          <div className="community-feed-state">
            <div className="community-state-icon"><HiChat /></div>
            <h4>{lang === 'en' ? 'Start the first conversation' : 'Begin die eerste gesprek'}</h4>
            <p>{t.noTopics}</p>
          </div>
        ) : (
          <div className="community-feed-list">
            {topics.map(topic => (
              <article key={topic.id} className="community-post-card">
                <button type="button" className="community-post-main" onClick={() => setSelectedTopicId(topic.id)}>
                  <div className="community-post-header">
                    <CommunityAvatar name={topic.author} />
                    <div className="community-author-block">
                      <div className="community-author-line">
                        <strong>{topic.author || authorName}</strong>
                        <span className="community-lady-badge">We-Rise Lady</span>
                      </div>
                      <span className="community-time">{formatTopicTime(topic.created_at, lang)}</span>
                    </div>
                  </div>
                  <p className="community-post-copy">{topic.title}</p>
                </button>
                <div className="community-actions">
                  <button
                    type="button"
                    className={`community-action ${topic.supported ? 'is-supported' : ''}`}
                    onClick={() => toggleSupport(topic.id)}
                    disabled={supportBusy === topic.id}
                  >
                    <HiHeart />
                    <span>{lang === 'en' ? 'Support' : 'Ondersteun'}</span>
                    <b>{Number(topic.supports || 0)}</b>
                  </button>
                  <button type="button" className="community-action" onClick={() => setSelectedTopicId(topic.id)}>
                    <HiChat />
                    <span>{lang === 'en' ? 'Comment' : 'Kommentaar'}</span>
                    <b>{Number(topic.replies || 0)}</b>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="community-values-card">
        <div className="community-values-icon">W</div>
        <div>
          <strong>{lang === 'en' ? 'Women supporting women' : 'Vroue wat vroue ondersteun'}</strong>
          <p>{lang === 'en'
            ? 'Advice should feel supportive, respectful and useful. Every voice helps shape the culture of We-Rise.'
            : 'Raad moet ondersteunend, respekvol en nuttig voel. Elke stem help om We-Rise se kultuur te vorm.'}</p>
        </div>
      </div>
    </div>
  );
}
