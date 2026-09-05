import React, { useState, useEffect } from 'react';
import { HiStar, HiCalendar, HiCheckCircle, HiTrash, HiPlus, HiSparkles } from 'react-icons/hi';

const CATEGORIES = ['career', 'health', 'relationships', 'finance', 'growth'];

export default function VisionBoard({ t, lang, showToast }) {
  const [visions, setVisions] = useState(() => {
    try {
      const saved = localStorage.getItem('werise_visions') || localStorage.getItem('sherise_visions');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', desc: '', category: 'growth', targetDate: '' });
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    localStorage.setItem('werise_visions', JSON.stringify(visions));
  }, [visions]);

  const categoryIcons = {
    career: '💼',
    health: '💪',
    relationships: '💗',
    finance: '💰',
    growth: '🌱',
  };

  const categoryLabels = {
    en: { career: 'Career', health: 'Health', relationships: 'Relationships', finance: 'Finance', growth: 'Personal Growth' },
    af: { career: 'Loopbaan', health: 'Gesondheid', relationships: 'Verhoudings', finance: 'Finansies', growth: 'Persoonlike Groei' },
  };

  const addVision = () => {
    if (!form.title.trim()) return;
    const newVision = {
      id: Date.now().toString(),
      title: form.title.trim(),
      desc: form.desc.trim(),
      category: form.category,
      targetDate: form.targetDate,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setVisions(prev => [newVision, ...prev]);
    setForm({ title: '', desc: '', category: 'growth', targetDate: '' });
    setShowForm(false);
    showToast(lang === 'en' ? '✨ Vision added to your board!' : '✨ Visie by jou bord gevoeg!');
  };

  const toggleComplete = (id) => {
    setVisions(prev => prev.map(v =>
      v.id === id ? { ...v, completed: !v.completed } : v
    ));
  };

  const deleteVision = (id) => {
    setVisions(prev => prev.filter(v => v.id !== id));
    showToast(lang === 'en' ? 'Vision removed' : 'Visie verwyder');
  };

  const filteredVisions = filter === 'all'
    ? visions
    : filter === 'completed'
      ? visions.filter(v => v.completed)
      : visions.filter(v => v.category === filter && !v.completed);

  const activeCount = visions.filter(v => !v.completed).length;
  const completedCount = visions.filter(v => v.completed).length;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'af-ZA', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fade-in">
      <div className="welcome-hero">
        <h2>✨ {t.visionTitle}</h2>
        <p>{t.visionDesc}</p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-number">{visions.length}</div>
          <div className="stat-label">{lang === 'en' ? 'Total' : 'Totaal'}</div>
        </div>
        <div className="stat-box">
          <div className="stat-number" style={{ color: 'var(--success)' }}>{activeCount}</div>
          <div className="stat-label">{lang === 'en' ? 'Active' : 'Aktief'}</div>
        </div>
        <div className="stat-box">
          <div className="stat-number" style={{ color: 'var(--pink)' }}>{completedCount}</div>
          <div className="stat-label">{lang === 'en' ? 'Done' : 'Klaar'}</div>
        </div>
      </div>

      {/* Add button */}
      {!showForm ? (
        <button className="btn btn-primary btn-full" onClick={() => setShowForm(true)} style={{ marginBottom: 16 }}>
          <HiPlus /> {t.visionAdd}
        </button>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ fontSize: 15, marginBottom: 12 }}>{t.visionNew}</div>
          <div className="form-group">
            <label>{t.visionTitleLabel}</label>
            <input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder={lang === 'en' ? 'e.g. Start my own business' : 'bv. Begin my eie besigheid'} />
          </div>
          <div className="form-group">
            <label>{t.visionDescLabel}</label>
            <textarea className="input" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder={lang === 'en' ? 'Describe your vision...' : 'Beskryf jou visie...'} rows={3} />
          </div>
          <div className="form-group">
            <label>{t.visionCategory}</label>
            <div className="vision-category-select">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`vision-cat-btn ${form.category === cat ? 'active' : ''}`}
                  onClick={() => setForm({...form, category: cat})}
                >
                  <span>{categoryIcons[cat]}</span>
                  <span>{categoryLabels[lang][cat]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>{t.visionTargetDate}</label>
            <input className="input" type="date" value={form.targetDate} onChange={e => setForm({...form, targetDate: e.target.value})} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-full" onClick={() => setShowForm(false)}>
              {t.cancel}
            </button>
            <button className="btn btn-primary btn-full" onClick={addVision} disabled={!form.title.trim()}>
              <HiSparkles /> {t.visionSave}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="vision-filters">
        <button className={`vision-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          {lang === 'en' ? 'All' : 'Almal'}
        </button>
        <button className={`vision-filter-btn ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
          ✅ {lang === 'en' ? 'Done' : 'Klaar'}
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`vision-filter-btn ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {categoryIcons[cat]} {categoryLabels[lang][cat]}
          </button>
        ))}
      </div>

      {/* Vision list */}
      {filteredVisions.length === 0 ? (
        <div className="empty-state">
          <HiStar style={{ fontSize: 48, opacity: 0.3 }} />
          <p>{lang === 'en' ? 'No visions yet. Add your first dream!' : 'Nog geen visies nie. Voeg jou eerste droom by!'}</p>
        </div>
      ) : (
        <div className="vision-list">
          {filteredVisions.map(vision => (
            <div key={vision.id} className={`vision-card ${vision.completed ? 'completed' : ''}`}>
              <div className="vision-card-top">
                <div className="vision-card-icon">
                  {categoryIcons[vision.category]}
                </div>
                <div className="vision-card-info">
                  <div className="vision-card-title">{vision.title}</div>
                  {vision.desc && <div className="vision-card-desc">{vision.desc}</div>}
                  <div className="vision-card-meta">
                    <span className="vision-category-tag">
                      {categoryIcons[vision.category]} {categoryLabels[lang][vision.category]}
                    </span>
                    {vision.targetDate && (
                      <span className="vision-date-tag">
                        <HiCalendar /> {formatDate(vision.targetDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="vision-card-actions">
                <button
                  className={`vision-action-btn ${vision.completed ? 'undo' : 'complete'}`}
                  onClick={() => toggleComplete(vision.id)}
                  title={vision.completed ? (lang === 'en' ? 'Mark active' : 'Merk aktief') : (lang === 'en' ? 'Mark done' : 'Merk klaar')}
                >
                  {vision.completed ? <HiSparkles /> : <HiCheckCircle />}
                </button>
                <button
                  className="vision-action-btn delete"
                  onClick={() => deleteVision(vision.id)}
                  title={lang === 'en' ? 'Delete' : 'Verwyder'}
                >
                  <HiTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspiration */}
      <div className="card" style={{ background: 'rgba(255, 193, 7, 0.05)', border: '1px solid rgba(255, 193, 7, 0.15)', textAlign: 'center' }}>
        <div className="card-title" style={{ fontSize: 14, marginBottom: 4 }}>💫 {lang === 'en' ? 'What you focus on, grows' : 'Waarop jy fokus, groei'}</div>
        <div className="card-subtitle" style={{ marginBottom: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          {lang === 'en' ? 'Write down your visions. Believe in them. Watch them become real.' : 'Skryf jou visies neer. Glo daarin. Kyk hoe word hulle werklikheid.'}
        </div>
      </div>
    </div>
  );
}
