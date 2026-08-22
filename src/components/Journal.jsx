import React, { useState, useEffect } from 'react';
import { HiPencil, HiTrash, HiCalendar, HiLockClosed, HiHeart } from 'react-icons/hi';

export default function Journal({ t, lang, showToast }) {
  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem('werise_journal') || localStorage.getItem('sherise_journal');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showWrite, setShowWrite] = useState(false);
  const [text, setText] = useState('');
  const [mood, setMood] = useState('');

  useEffect(() => {
    localStorage.setItem('werise_journal', JSON.stringify(entries));
  }, [entries]);

  const moods = [
    { emoji: '💗', label: lang === 'en' ? 'Loved' : 'Geliefd' },
    { emoji: '✨', label: lang === 'en' ? 'Empowered' : 'Bemagtig' },
    { emoji: '😊', label: lang === 'en' ? 'Happy' : 'Gelukkig' },
    { emoji: '😔', label: lang === 'en' ? 'Sad' : 'Hartseer' },
    { emoji: '😮', label: lang === 'en' ? 'Stressed' : 'Gestres' },
    { emoji: '😤', label: lang === 'en' ? 'Frustrated' : 'Gefrustreerd' },
  ];

  const saveEntry = () => {
    if (!text.trim()) return;
    const newEntry = {
      id: Date.now().toString(),
      text: text.trim(),
      mood: mood || '💗',
      date: new Date().toISOString(),
      dateDisplay: new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'af-ZA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }),
      timeDisplay: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'af-ZA', {
        hour: '2-digit', minute: '2-digit'
      }),
    };
    setEntries(prev => [newEntry, ...prev]);
    setText('');
    setMood('');
    setShowWrite(false);
    showToast(lang === 'en' ? 'Journal entry saved ✨' : 'Joernaalinskrywing gestoor ✨');
  };

  const deleteEntry = (id) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    showToast(lang === 'en' ? 'Entry deleted' : 'Inskrywing verwyder');
  };

  const getMoodEmoji = (m) => moods.find(mo => mo.emoji === m)?.emoji || '💗';

  if (showWrite) {
    return (
      <div className="fade-in">
        <div className="welcome-hero">
          <h2>✨ {t.journalNew}</h2>
          <p>{t.journalNewDesc}</p>
        </div>

        <div className="card">
          <div className="card-title" style={{ fontSize: 15, marginBottom: 12 }}>{t.journalHowFeel}</div>
          <div className="mood-selector">
            {moods.map(m => (
              <button
                key={m.emoji}
                className={`mood-btn ${mood === m.emoji ? 'active' : ''}`}
                onClick={() => setMood(m.emoji)}
                title={m.label}
              >
                <span style={{ fontSize: 24 }}>{m.emoji}</span>
                <span className="mood-label">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ fontSize: 15, marginBottom: 12 }}>{t.journalWriteHere}</div>
          <textarea
            className="input journal-textarea"
            placeholder={t.journalPlaceholder}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            autoFocus
          />
          <div className="journal-char-count">{text.length} {lang === 'en' ? 'characters' : 'karakters'}</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-full" onClick={() => setShowWrite(false)}>
            {t.cancel || (lang === 'en' ? 'Cancel' : 'Kanselleer')}
          </button>
          <button className="btn btn-primary btn-full" onClick={saveEntry} disabled={!text.trim()}>
            <HiHeart /> {t.journalSave}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="welcome-hero">
        <h2>📝 {t.journalTitle}</h2>
        <p>{t.journalDesc}</p>
      </div>

      <div className="journal-locked-banner">
        <HiLockClosed />
        <span>{t.journalPrivate}</span>
      </div>

      <button className="btn btn-primary btn-full" onClick={() => setShowWrite(true)} style={{ marginBottom: 20 }}>
        <HiPencil /> {t.journalNew}
      </button>

      {entries.length === 0 ? (
        <div className="empty-state">
          <HiPencil style={{ fontSize: 48, opacity: 0.3 }} />
          <p>{t.journalEmpty}</p>
        </div>
      ) : (
        <div className="journal-entries">
          {entries.map(entry => (
            <div key={entry.id} className="journal-entry-card">
              <div className="journal-entry-header">
                <div className="journal-entry-meta">
                  <span className="journal-entry-mood">{getMoodEmoji(entry.mood)}</span>
                  <div>
                    <div className="journal-entry-date">
                      <HiCalendar style={{ fontSize: 12 }} /> {entry.dateDisplay}
                    </div>
                    <div className="journal-entry-time">{entry.timeDisplay}</div>
                  </div>
                </div>
                <button className="journal-delete-btn" onClick={() => deleteEntry(entry.id)}>
                  <HiTrash />
                </button>
              </div>
              <div className="journal-entry-text">{entry.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}