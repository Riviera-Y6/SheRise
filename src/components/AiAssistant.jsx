import React, { useEffect, useRef, useState } from 'react';
import { HiExclamation, HiLockClosed, HiShieldCheck, HiSparkles } from 'react-icons/hi';
import { apiRequest } from '../lib/api';

export default function AiAssistant({ t, lang, userName }) {
  const welcome = userName
    ? (lang === 'af'
      ? `Hallo ${userName}! Ek is Ask We-Rise. Waarmee kan ek jou vandag help?`
      : `Hi ${userName}! I am Ask We-Rise. What can I help you with today?`)
    : t.aiWelcome;

  const [messages, setMessages] = useState([{ role: 'ai', content: welcome, status: 'answer' }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [config, setConfig] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    setMessages([{ role: 'ai', content: welcome, status: 'answer' }]);
    setInput('');
  }, [lang, userName, welcome]);

  useEffect(() => {
    let active = true;
    apiRequest('/api/ai/config')
      .then(result => { if (active) setConfig(result); })
      .catch(() => { if (active) setConfig({ available: false }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const userMsg = input.trim();
    if (!userMsg || isTyping || config?.available === false) return;
    const recentMessages = messages.slice(1).slice(-8).map(message => ({
      role: message.role === 'ai' ? 'assistant' : 'user',
      content: message.content,
    }));

    setInput('');
    setMessages(previous => [...previous, { role: 'user', content: userMsg }]);
    setIsTyping(true);
    try {
      const response = await apiRequest('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ question: userMsg, lang, messages: recentMessages }),
      });
      setMessages(previous => [...previous, {
        role: 'ai',
        content: response.answer,
        status: response.status || 'answer',
        topic: response.topic || '',
      }]);
      setConfig(previous => ({
        ...(previous || {}),
        available: true,
        remaining: response.remaining,
        daily_limit: response.daily_limit,
      }));
    } catch (error) {
      setMessages(previous => [...previous, {
        role: 'ai',
        status: 'error',
        content: error?.message || (lang === 'af'
          ? 'Ask We-Rise kon nie nou antwoord nie. Probeer asseblief weer.'
          : 'Ask We-Rise could not answer right now. Please try again.'),
      }]);
      if (error?.code === 'AI_DAILY_LIMIT') setConfig(previous => ({ ...(previous || {}), remaining: 0 }));
    } finally {
      setIsTyping(false);
    }
  };

  const available = config?.available !== false;

  return (
    <section className="ai-page fade-in">
      <div className="ai-hero-card">
        <div className="ai-hero-icon"><HiSparkles /></div>
        <div>
          <div className="eyebrow">ASK WE-RISE</div>
          <h2 className="section-title">{t.aiAssistant}</h2>
          <p className="section-subtitle">{lang === 'en'
            ? 'Practical, guided support for life inside the We-Rise ecosystem.'
            : 'Praktiese, begeleide ondersteuning vir die lewe binne die We-Rise-ekosisteem.'}</p>
        </div>
      </div>

      <div className="ai-boundary-strip">
        <span><HiShieldCheck /> {lang === 'en'
          ? 'Ask about growth, wellbeing, relationships, safety, Welvaart, BackMi or We-Rise.'
          : 'Vra oor groei, welstand, verhoudings, veiligheid, Welvaart, BackMi of We-Rise.'}</span>
        <span><HiLockClosed /> {lang === 'en'
          ? 'Gemini processes your question; the conversation is not saved in the We-Rise database. Do not share passwords or card details.'
          : 'Gemini verwerk jou vraag; die gesprek word nie in die We-Rise-databasis gestoor nie. Moenie wagwoorde of kaartbesonderhede deel nie.'}</span>
      </div>

      {!available && (
        <div className="ai-unavailable-note">
          <HiExclamation />
          <div><strong>{lang === 'en' ? 'Ask We-Rise is not connected yet' : 'Ask We-Rise is nog nie gekoppel nie'}</strong><p>{lang === 'en' ? 'The secure Gemini connection must first be enabled on the We-Rise server.' : 'Die veilige Gemini-verbinding moet eers op die We-Rise-bediener geaktiveer word.'}</p></div>
        </div>
      )}

      <div className="chat-container" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${index}-${message.role}`} className={`chat-message ${message.role} chat-status-${message.status || 'answer'}`}>
            <div className={`chat-avatar ${message.role}`}>{message.role === 'ai' ? 'W' : '👤'}</div>
            <div className="chat-bubble">
              {message.status === 'crisis' && <small className="chat-safety-label"><HiShieldCheck /> {lang === 'en' ? 'Safety first' : 'Veiligheid eerste'}</small>}
              <span>{message.content}</span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="chat-message ai">
            <div className="chat-avatar ai">W</div>
            <div className="chat-bubble"><div className="typing-indicator"><span></span><span></span><span></span></div></div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          value={input}
          maxLength={1600}
          rows={2}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder={t.askQuestion}
          disabled={isTyping || !available || config?.remaining === 0}
          aria-label={t.askQuestion}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim() || isTyping || !available || config?.remaining === 0} aria-label={t.send}>
          <HiSparkles />
        </button>
      </div>
      <div className="ai-input-meta">
        <span>{lang === 'en' ? 'Ask We-Rise offers guidance, not emergency, medical, legal or financial-adviser services.' : 'Ask We-Rise bied leiding, nie nood-, mediese, regs- of finansiële adviseursdienste nie.'}</span>
        {Number.isFinite(config?.remaining) && <strong>{config.remaining} {lang === 'en' ? 'questions left today' : 'vrae vandag oor'}</strong>}
      </div>
    </section>
  );
}
