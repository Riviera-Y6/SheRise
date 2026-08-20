import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HiArrowLeft,
  HiChatAlt2,
  HiChevronRight,
  HiPaperAirplane,
  HiRefresh,
  HiSearch,
  HiSparkles,
  HiUserGroup,
} from 'react-icons/hi';
import { apiRequest } from '../lib/api';

const FREE_MESSAGE_LIMIT = 150;
const PREMIUM_MESSAGE_LIMIT = 2000;
const PAGE_SIZE = 20;
const ACTIVE_CHAT_POLL_MS = 5000;

function initials(name) {
  const clean = String(name || '').trim();
  if (!clean) return 'W';
  return clean.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function formatListTime(value, lang) {
  if (!value) return '';
  const raw = String(value).replace(' ', 'T');
  const date = new Date(raw.endsWith('Z') ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(lang === 'en' ? 'en-ZA' : 'af-ZA', { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString(lang === 'en' ? 'en-ZA' : 'af-ZA', { weekday: 'short' });
  return date.toLocaleDateString(lang === 'en' ? 'en-ZA' : 'af-ZA', { day: '2-digit', month: 'short' });
}

function formatMessageTime(value, lang) {
  if (!value) return '';
  const raw = String(value).replace(' ', 'T');
  const date = new Date(raw.endsWith('Z') ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(lang === 'en' ? 'en-ZA' : 'af-ZA', { hour: '2-digit', minute: '2-digit' });
}

function Avatar({ name, size = 'normal' }) {
  return <div className={`messages-avatar messages-avatar-${size}`}>{initials(name)}</div>;
}

function mergeMessages(current, incoming) {
  const byId = new Map();
  [...current, ...incoming].forEach(message => byId.set(String(message.id), message));
  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

export default function Messages({ lang, showToast, userName, memberKey, memberPlan = 'free', onConversationChange }) {
  const [view, setView] = useState('inbox');
  const [inbox, setInbox] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [startingWith, setStartingWith] = useState(null);
  const bottomRef = useRef(null);

  const strings = lang === 'en' ? {
    title: 'Messages',
    subtitle: 'Direct conversations between We-Rise Ladies',
    newMessage: 'New message',
    inbox: 'Inbox',
    ladies: 'We-Rise Ladies',
    emptyTitle: 'Your inbox is quiet',
    emptyCopy: 'Start a direct conversation with another We-Rise Lady.',
    findLady: 'Find a We-Rise Lady',
    search: 'Search by name...',
    noLadies: 'No other We-Rise Ladies are available yet.',
    noSearch: 'No We-Rise Ladies match that search.',
    message: 'Message',
    directChat: 'DIRECT MESSAGE',
    typeMessage: 'Write a message...',
    loadEarlier: 'Load earlier messages',
    noMessages: 'Start the conversation with a kind hello.',
    freePlan: 'Free',
    premiumPlan: 'Premium',
    chars: 'characters',
    premiumNudge: 'Need more room to say it?',
    premiumCopy: 'We-Rise Premium allows up to 2,000 characters per message.',
    upgrade: 'See Premium',
    overLimit: 'Your message is over the Free limit. Your text is safe — shorten it or upgrade to send the full message.',
    lightFast: 'Messages load 20 at a time to keep We-Rise light and fast.',
    retry: 'Retry',
    couldNotLoad: 'We could not load Messages. Make sure the Phase 2 database migration has been run.',
    sent: 'Message sent 💗',
    sendError: 'Could not send your message.',
    startError: 'Could not start the conversation.',
    premiumSoon: 'Premium billing will be connected in the next billing phase.',
    unread: 'unread',
  } : {
    title: 'Boodskappe',
    subtitle: 'Direkte gesprekke tussen We-Rise Ladies',
    newMessage: 'Nuwe boodskap',
    inbox: 'Inkassie',
    ladies: 'We-Rise Ladies',
    emptyTitle: 'Jou inkassie is stil',
    emptyCopy: 'Begin ’n direkte gesprek met ’n ander We-Rise Lady.',
    findLady: 'Vind ’n We-Rise Lady',
    search: 'Soek volgens naam...',
    noLadies: 'Geen ander We-Rise Ladies is nog beskikbaar nie.',
    noSearch: 'Geen We-Rise Ladies pas by daardie soektog nie.',
    message: 'Boodskap',
    directChat: 'DIREKTE BOODSKAP',
    typeMessage: 'Skryf ’n boodskap...',
    loadEarlier: 'Laai vroeër boodskappe',
    noMessages: 'Begin die gesprek met ’n vriendelike hallo.',
    freePlan: 'Gratis',
    premiumPlan: 'Premium',
    chars: 'karakters',
    premiumNudge: 'Het jy meer plek nodig om dit te sê?',
    premiumCopy: 'We-Rise Premium laat tot 2 000 karakters per boodskap toe.',
    upgrade: 'Sien Premium',
    overLimit: 'Jou boodskap is oor die Gratis limiet. Jou teks bly veilig — verkort dit of gradeer op om die volle boodskap te stuur.',
    lightFast: 'Boodskappe laai 20 op ’n slag om We-Rise lig en vinnig te hou.',
    retry: 'Probeer weer',
    couldNotLoad: 'Ons kon nie Boodskappe laai nie. Maak seker die Fase 2 databasis-migrasie is uitgevoer.',
    sent: 'Boodskap gestuur 💗',
    sendError: 'Kon nie jou boodskap stuur nie.',
    startError: 'Kon nie die gesprek begin nie.',
    premiumSoon: 'Premium-betaling word in die volgende betalingsfase gekoppel.',
    unread: 'ongelees',
  };

  const messageLimit = memberPlan === 'premium' ? PREMIUM_MESSAGE_LIMIT : FREE_MESSAGE_LIMIT;
  const overLimit = draft.length > messageLimit;
  const nearLimit = draft.length >= Math.floor(messageLimit * 0.8);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter(member => String(member.display_name || '').toLowerCase().includes(query));
  }, [members, search]);

  const loadInbox = useCallback(async () => {
    if (!memberKey) return;
    setLoading(true);
    setError(false);
    try {
      const data = await apiRequest(`/api/inbox?member_key=${encodeURIComponent(memberKey)}`);
      setInbox(Array.isArray(data) ? data : []);
    } catch {
      setInbox([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [memberKey]);

  const loadMembers = useCallback(async () => {
    if (!memberKey) return;
    try {
      const data = await apiRequest(`/api/members?member_key=${encodeURIComponent(memberKey)}`);
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      setMembers([]);
    }
  }, [memberKey]);

  useEffect(() => {
    loadInbox();
    loadMembers();
  }, [loadInbox, loadMembers]);

  useEffect(() => {
    onConversationChange?.(view === 'conversation');
    return () => onConversationChange?.(false);
  }, [view, onConversationChange]);

  const markRead = useCallback(async (conversationId) => {
    if (!conversationId || !memberKey) return;
    try {
      await apiRequest(`/api/conversations/${conversationId}/read`, {
        method: 'POST',
        body: JSON.stringify({ member_key: memberKey }),
      });
    } catch {}
  }, [memberKey]);

  const loadConversationMessages = useCallback(async (conversationId, { beforeId = null, prepend = false, quiet = false } = {}) => {
    if (!conversationId || !memberKey) return;
    if (!quiet) prepend ? setLoadingEarlier(true) : setMessagesLoading(true);
    try {
      const params = new URLSearchParams({ member_key: memberKey, limit: String(PAGE_SIZE) });
      if (beforeId) params.set('before_id', String(beforeId));
      const data = await apiRequest(`/api/conversations/${conversationId}/messages?${params.toString()}`);
      const incoming = Array.isArray(data?.messages) ? data.messages : [];
      setMessages(current => prepend ? mergeMessages(incoming, current) : mergeMessages(current, incoming));
      if (!quiet || beforeId) {
        setHasMore(Boolean(data?.has_more));
        setNextBeforeId(data?.next_before_id || null);
      }
      if (incoming.some(message => message.receiver_key === memberKey && !message.read_at)) {
        await markRead(conversationId);
      }
    } catch {
      if (!quiet) showToast(lang === 'en' ? 'Could not load this conversation.' : 'Kon nie hierdie gesprek laai nie.');
    } finally {
      if (!quiet) prepend ? setLoadingEarlier(false) : setMessagesLoading(false);
    }
  }, [lang, markRead, memberKey, showToast]);

  const openConversation = useCallback(async (conversation) => {
    setSelectedConversation(conversation);
    setMessages([]);
    setHasMore(false);
    setNextBeforeId(null);
    setDraft('');
    setView('conversation');
    await loadConversationMessages(conversation.id);
    loadInbox();
  }, [loadConversationMessages, loadInbox]);

  useEffect(() => {
    if (view !== 'conversation' || !selectedConversation?.id) return undefined;
    const timer = window.setInterval(() => {
      loadConversationMessages(selectedConversation.id, { quiet: true });
    }, ACTIVE_CHAT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [view, selectedConversation?.id, loadConversationMessages, loadInbox]);

  useEffect(() => {
    if (view === 'conversation' && !messagesLoading) {
      window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    }
  }, [messages.length, messagesLoading, view]);

  const startConversation = async (member) => {
    if (!member?.member_key || startingWith) return;
    setStartingWith(member.member_key);
    try {
      if (userName?.trim()) {
        await apiRequest('/api/members/upsert', {
          method: 'POST',
          body: JSON.stringify({ member_key: memberKey, display_name: userName.trim() }),
        });
      }
      const conversation = await apiRequest('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ member_key: memberKey, other_member_key: member.member_key }),
      });
      await openConversation({
        ...conversation,
        other_member_key: member.member_key,
        other_name: member.display_name,
      });
    } catch (error) {
      showToast(error?.message || strings.startError);
    } finally {
      setStartingWith(null);
    }
  };

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || !selectedConversation?.id || sending || content.length > messageLimit) return;
    setSending(true);
    try {
      const created = await apiRequest(`/api/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ member_key: memberKey, content }),
      });
      setDraft('');
      if (created?.message) setMessages(current => mergeMessages(current, [created.message]));
      await loadInbox();
    } catch (error) {
      showToast(error?.message || strings.sendError);
    } finally {
      setSending(false);
    }
  };

  const handleDraftKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      sendMessage();
    }
  };

  if (view === 'conversation' && selectedConversation) {
    const otherName = selectedConversation.other_name || (lang === 'en' ? 'We-Rise Lady' : 'We-Rise Lady');
    return (
      <div className="messages-screen messages-conversation-screen fade-in">
        <header className="messages-chat-header">
          <button
            type="button"
            className="messages-icon-button"
            onClick={() => {
              setView('inbox');
              setSelectedConversation(null);
              setMessages([]);
              setDraft('');
              loadInbox();
            }}
            aria-label={lang === 'en' ? 'Back to inbox' : 'Terug na inkassie'}
          >
            <HiArrowLeft />
          </button>
          <Avatar name={otherName} size="small" />
          <div className="messages-chat-person">
            <strong>{otherName}</strong>
            <span>{strings.directChat}</span>
          </div>
          <div className="messages-chat-lock" title={lang === 'en' ? 'We-Rise direct message' : 'We-Rise direkte boodskap'}>
            <HiSparkles />
          </div>
        </header>

        <div className="messages-chat-body">
          {hasMore && (
            <button
              type="button"
              className="messages-load-earlier"
              disabled={loadingEarlier}
              onClick={() => loadConversationMessages(selectedConversation.id, { beforeId: nextBeforeId, prepend: true })}
            >
              {loadingEarlier ? '...' : strings.loadEarlier}
            </button>
          )}

          {messagesLoading && messages.length === 0 ? (
            <div className="messages-loading-stack">
              <div className="messages-message-skeleton" />
              <div className="messages-message-skeleton messages-message-skeleton-mine" />
              <div className="messages-message-skeleton messages-message-skeleton-short" />
            </div>
          ) : messages.length === 0 ? (
            <div className="messages-empty-chat">
              <div className="messages-empty-chat-icon"><HiChatAlt2 /></div>
              <p>{strings.noMessages}</p>
            </div>
          ) : (
            <div className="messages-bubble-list">
              {messages.map(message => {
                const mine = message.sender_key === memberKey;
                return (
                  <div key={message.id} className={`messages-bubble-row ${mine ? 'is-mine' : 'is-theirs'}`}>
                    {!mine && <Avatar name={otherName} size="tiny" />}
                    <div className={`messages-bubble ${mine ? 'messages-bubble-mine' : 'messages-bubble-theirs'}`}>
                      <p>{message.content}</p>
                      <div className="messages-bubble-meta">
                        <span>{formatMessageTime(message.created_at, lang)}</span>
                        {mine && <span className="messages-read-state">{message.read_at ? '✓✓' : '✓'}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="messages-composer-shell">
          {memberPlan !== 'premium' && overLimit && (
            <div className="messages-over-limit-note">{strings.overLimit}</div>
          )}
          {memberPlan !== 'premium' && draft.length > FREE_MESSAGE_LIMIT && (
            <div className="messages-premium-nudge messages-premium-nudge-compact">
              <HiSparkles />
              <div>
                <strong>{strings.premiumNudge}</strong>
                <span>{strings.premiumCopy}</span>
              </div>
              <button type="button" onClick={() => showToast(strings.premiumSoon)}>{strings.upgrade}</button>
            </div>
          )}
          <div className={`messages-composer ${overLimit ? 'is-over-limit' : ''}`}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, PREMIUM_MESSAGE_LIMIT))}
              onKeyDown={handleDraftKeyDown}
              placeholder={strings.typeMessage}
              rows={1}
              aria-label={strings.typeMessage}
            />
            <div className="messages-composer-actions">
              <span className={`messages-char-counter ${nearLimit ? 'is-near' : ''} ${overLimit ? 'is-over' : ''}`}>
                {draft.length}/{messageLimit}
              </span>
              <button
                type="button"
                className="messages-send-button"
                onClick={sendMessage}
                disabled={!draft.trim() || overLimit || sending}
                aria-label={lang === 'en' ? 'Send message' : 'Stuur boodskap'}
              >
                <HiPaperAirplane />
              </button>
            </div>
          </div>
          <div className="messages-plan-line">
            <span className={`messages-plan-badge ${memberPlan === 'premium' ? 'is-premium' : ''}`}>
              {memberPlan === 'premium' ? strings.premiumPlan : strings.freePlan}
            </span>
            <span>{messageLimit.toLocaleString('en-ZA')} {strings.chars}</span>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'directory') {
    return (
      <div className="messages-screen fade-in">
        <div className="messages-page-header messages-directory-header">
          <button type="button" className="messages-icon-button" onClick={() => setView('inbox')}>
            <HiArrowLeft />
          </button>
          <div>
            <div className="messages-kicker">WE-RISE</div>
            <h2>{strings.findLady}</h2>
          </div>
        </div>

        <div className="messages-search-box">
          <HiSearch />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={strings.search} />
        </div>

        <section className="messages-directory-card">
          <div className="messages-section-label">
            <HiUserGroup />
            <span>{strings.ladies}</span>
            <b>{filteredMembers.length}</b>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="messages-directory-empty">
              <Avatar name="We-Rise" />
              <p>{members.length === 0 ? strings.noLadies : strings.noSearch}</p>
              {members.length === 0 && (
                <small>{lang === 'en'
                  ? 'Tip: open We-Rise in another browser or phone, enter a different member name, then refresh this list to test Phase 2.'
                  : 'Wenk: maak We-Rise in ’n ander blaaier of foon oop, voer ’n ander lidnaam in en verfris dan hierdie lys om Fase 2 te toets.'}</small>
              )}
            </div>
          ) : (
            <div className="messages-member-list">
              {filteredMembers.map(member => (
                <button
                  type="button"
                  key={member.member_key}
                  className="messages-member-row"
                  onClick={() => startConversation(member)}
                  disabled={startingWith === member.member_key}
                >
                  <Avatar name={member.display_name} />
                  <div className="messages-member-copy">
                    <strong>{member.display_name}</strong>
                    <span>We-Rise Lady</span>
                  </div>
                  <div className="messages-member-action">
                    <span>{strings.message}</span>
                    <HiChevronRight />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="messages-screen fade-in">
      <section className="messages-hero-card">
        <div className="messages-hero-icon"><HiChatAlt2 /></div>
        <div className="messages-hero-copy">
          <div className="messages-kicker">WE-RISE CONNECTION</div>
          <h2>{strings.title}</h2>
          <p>{strings.subtitle}</p>
        </div>
        <button type="button" className="messages-new-button" onClick={() => { setSearch(''); setView('directory'); loadMembers(); }}>
          <span>+</span> {strings.newMessage}
        </button>
      </section>

      <div className="messages-cost-note">
        <HiSparkles />
        <span>{strings.lightFast}</span>
      </div>

      <section className="messages-inbox-card">
        <div className="messages-inbox-heading">
          <div>
            <span className="messages-kicker">{strings.inbox.toUpperCase()}</span>
            <h3>{lang === 'en' ? 'Your conversations' : 'Jou gesprekke'}</h3>
          </div>
          <button type="button" className="messages-refresh-button" onClick={() => { loadInbox(); loadMembers(); }} aria-label={strings.retry}>
            <HiRefresh />
          </button>
        </div>

        {loading ? (
          <div className="messages-inbox-skeletons">
            <div className="messages-inbox-skeleton" />
            <div className="messages-inbox-skeleton" />
            <div className="messages-inbox-skeleton messages-inbox-skeleton-short" />
          </div>
        ) : error ? (
          <div className="messages-inbox-empty">
            <div className="messages-state-icon"><HiRefresh /></div>
            <h4>{strings.couldNotLoad}</h4>
            <button type="button" onClick={loadInbox}>{strings.retry}</button>
          </div>
        ) : inbox.length === 0 ? (
          <div className="messages-inbox-empty">
            <div className="messages-state-icon"><HiChatAlt2 /></div>
            <h4>{strings.emptyTitle}</h4>
            <p>{strings.emptyCopy}</p>
            <button type="button" onClick={() => { setSearch(''); setView('directory'); loadMembers(); }}>{strings.newMessage}</button>
          </div>
        ) : (
          <div className="messages-inbox-list">
            {inbox.map(item => (
              <button type="button" key={item.id} className="messages-inbox-row" onClick={() => openConversation(item)}>
                <div className="messages-avatar-wrap">
                  <Avatar name={item.other_name} />
                  {Number(item.unread_count || 0) > 0 && <span className="messages-unread-dot" />}
                </div>
                <div className="messages-inbox-copy">
                  <div className="messages-inbox-name-row">
                    <strong>{item.other_name || 'We-Rise Lady'}</strong>
                    <span>{formatListTime(item.last_message_at || item.created_at, lang)}</span>
                  </div>
                  <div className="messages-inbox-preview-row">
                    <p>{item.last_message || (lang === 'en' ? 'Conversation started' : 'Gesprek begin')}</p>
                    {Number(item.unread_count || 0) > 0 && (
                      <b className="messages-unread-count" aria-label={`${item.unread_count} ${strings.unread}`}>{item.unread_count}</b>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
