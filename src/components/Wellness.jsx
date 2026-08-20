import React, { useState, useEffect } from 'react';
import { HiHeart, HiCheckCircle, HiPlus, HiSparkles, HiCalendar, HiStar } from 'react-icons/hi';

const HABIT_OPTIONS = {
  en: [
    { id: 'water', label: '💧 Drink 8 glasses of water', icon: '💧' },
    { id: 'walk', label: '🚶‍♀️ 15 min walk outside', icon: '🚶‍♀️' },
    { id: 'meditate', label: '🧘‍♀️ Meditate for 5 min', icon: '🧘‍♀️' },
    { id: 'read', label: '📖 Read 10 pages', icon: '📖' },
    { id: 'gratitude', label: '🙏 Write 3 gratitudes', icon: '🙏' },
    { id: 'stretch', label: '🤸‍♀️ Morning stretch', icon: '🤸‍♀️' },
    { id: 'skincare', label: '🧴 Skincare routine', icon: '🧴' },
    { id: 'affirm', label: '💗 Say 3 affirmations', icon: '💗' },
  ],
  af: [
    { id: 'water', label: '💧 Drink 8 glase water', icon: '💧' },
    { id: 'walk', label: '🚶‍♀️ 15 min stap buite', icon: '🚶‍♀️' },
    { id: 'meditate', label: '🧘‍♀️ Mediteer vir 5 min', icon: '🧘‍♀️' },
    { id: 'read', label: '📖 Lees 10 bladsye', icon: '📖' },
    { id: 'gratitude', label: '🙏 Skryf 3 dankbaarhede', icon: '🙏' },
    { id: 'stretch', label: '🤸‍♀️ Oggend strek', icon: '🤸‍♀️' },
    { id: 'skincare', label: '🧴 Velroetine', icon: '🧴' },
    { id: 'affirm', label: '💗 Sê 3 bevestigings', icon: '💗' },
  ],
};

const CHALLENGES = {
  en: [
    { id: '7day-water', title: '💧 7-Day Hydration', desc: 'Drink 8 glasses of water every day for 7 days', days: 7, icon: '💧' },
    { id: '7day-move', title: '🚶‍♀️ 7-Day Movement', desc: 'Move your body for 15 min every day', days: 7, icon: '🚶‍♀️' },
    { id: '7day-mindful', title: '🧘‍♀️ 7-Day Mindfulness', desc: 'Meditate or journal for 5 min daily', days: 7, icon: '🧘‍♀️' },
    { id: '21day-glow', title: '🌟 21-Day Glow Up', desc: 'Complete all 8 habits daily for 21 days', days: 21, icon: '🌟' },
  ],
  af: [
    { id: '7day-water', title: '💧 7-Dag Hidrasie', desc: 'Drink 8 glase water elke dag vir 7 dae', days: 7, icon: '💧' },
    { id: '7day-move', title: '🚶‍♀️ 7-Dag Beweging', desc: 'Beweeg jou lyf vir 15 min elke dag', days: 7, icon: '🚶‍♀️' },
    { id: '7day-mindful', title: '🧘‍♀️ 7-Dag Bewustheid', desc: 'Mediteer of joernaal vir 5 min daagliks', days: 7, icon: '🧘‍♀️' },
    { id: '21day-glow', title: '🌟 21-Dag Gloed', desc: 'Voltooi al 8 gewoontes daagliks vir 21 dae', days: 21, icon: '🌟' },
  ],
};

export default function Wellness({ t, lang, showToast }) {
  const [habits, setHabits] = useState(() => {
    try {
      const saved = localStorage.getItem('werise_habits') || localStorage.getItem('sherise_habits');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [challenges, setChallenges] = useState(() => {
    try {
      const saved = localStorage.getItem('werise_challenges') || localStorage.getItem('sherise_challenges');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [mood, setMood] = useState(() => {
    try {
      const saved = localStorage.getItem('werise_mood') || localStorage.getItem('sherise_mood');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [activeSection, setActiveSection] = useState('main');

  useEffect(() => {
    localStorage.setItem('werise_habits', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('werise_challenges', JSON.stringify(challenges));
  }, [challenges]);

  useEffect(() => {
    localStorage.setItem('werise_mood', JSON.stringify(mood));
  }, [mood]);

  const today = new Date().toDateString();
  const todayHabits = habits[today] || [];
  const completedCount = todayHabits.length;
  const totalHabits = HABIT_OPTIONS[lang].length;

  const toggleHabit = (habitId) => {
    setHabits(prev => {
      const dayHabits = prev[today] || [];
      const updated = dayHabits.includes(habitId)
        ? dayHabits.filter(h => h !== habitId)
        : [...dayHabits, habitId];
      return { ...prev, [today]: updated };
    });
  };

  const joinChallenge = (challengeId) => {
    if (challenges[challengeId]) {
      showToast(lang === 'en' ? 'Already joined!' : 'Reeds aangesluit!');
      return;
    }
    setChallenges(prev => ({
      ...prev,
      [challengeId]: {
        joined: new Date().toISOString(),
        progress: 0,
        completed: false,
      }
    }));
    showToast(lang === 'en' ? '🎯 Challenge joined! Stay consistent, We-Rise Lady.' : '🎯 Uitdaging aanvaar! Bly konsekwent, We-Rise Lady.');
  };

  const updateChallengeProgress = (challengeId) => {
    setChallenges(prev => {
      const c = prev[challengeId];
      if (!c || c.completed) return prev;
      const newProgress = c.progress + 1;
      const challenge = CHALLENGES[lang].find(ch => ch.id === challengeId);
      const completed = newProgress >= challenge.days;
      if (completed) {
        showToast(lang === 'en' ? '🎉 Challenge complete! You are unstoppable!' : '🎉 Uitdaging voltooi! Jy is onstuitbaar!');
      }
      return {
        ...prev,
        [challengeId]: { ...c, progress: newProgress, completed }
      };
    });
  };

  const moodOptions = [
    { emoji: '💗', label: lang === 'en' ? 'Loved' : 'Geliefd' },
    { emoji: '✨', label: lang === 'en' ? 'Amazing' : 'Wonderlik' },
    { emoji: '😊', label: lang === 'en' ? 'Good' : 'Goed' },
    { emoji: '😔', label: lang === 'en' ? 'Sad' : 'Hartseer' },
    { emoji: '😤', label: lang === 'en' ? 'Stressed' : 'Gestres' },
    { emoji: '🌿', label: lang === 'en' ? 'Calm' : 'Kalm' },
    { emoji: '🔥', label: lang === 'en' ? 'Motivated' : 'Gemotiveerd' },
    { emoji: '😴', label: lang === 'en' ? 'Tired' : 'Moeg' },
  ];

  const todayMood = mood && mood.date === today ? mood.emoji : null;

  if (activeSection === 'challenges') {
    return (
      <div className="fade-in">
        <div className="welcome-hero">
          <h2>🎯 {t.wellnessChallenges}</h2>
          <p>{t.wellnessChallengesDesc}</p>
        </div>
        <button className="btn btn-secondary btn-full" onClick={() => setActiveSection('main')} style={{ marginBottom: 16 }}>
          ← {lang === 'en' ? 'Back to Wellness' : 'Terug na Welstand'}
        </button>
        {CHALLENGES[lang].map(challenge => {
          const userChallenge = challenges[challenge.id];
          const isJoined = !!userChallenge;
          const progress = userChallenge ? userChallenge.progress : 0;
          const pct = isJoined ? Math.min(100, Math.round((progress / challenge.days) * 100)) : 0;
          return (
            <div key={challenge.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div className="card-title" style={{ fontSize: 16, marginBottom: 4 }}>{challenge.title}</div>
                  <div className="card-subtitle" style={{ marginBottom: 0, fontSize: 12 }}>{challenge.desc}</div>
                </div>
                {userChallenge?.completed && <span style={{ fontSize: 28 }}>🏆</span>}
              </div>
              {isJoined && (
                <div className="progress-container" style={{ marginBottom: 10 }}>
                  <div className="progress-bar-bg" style={{ height: 8 }}>
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, height: 8 }} />
                  </div>
                  <div className="progress-stats">
                    <span>{progress}/{challenge.days} {lang === 'en' ? 'days' : 'dae'}</span>
                    <span className="progress-amount">{pct}%</span>
                  </div>
                </div>
              )}
              {!isJoined ? (
                <button className="btn btn-primary btn-full" onClick={() => joinChallenge(challenge.id)}>
                  <HiPlus /> {lang === 'en' ? 'Join Challenge' : 'Aanvaar Uitdaging'}
                </button>
              ) : !userChallenge.completed ? (
                <button className="btn btn-primary btn-full" onClick={() => updateChallengeProgress(challenge.id)}>
                  <HiSparkles /> {lang === 'en' ? 'Log Today' : 'Teken Vandag'}
                </button>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--success)', fontSize: 14, fontWeight: 600 }}>
                  ✅ {lang === 'en' ? 'Completed!' : 'Voltooi!'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="welcome-hero">
        <h2>🌿 {t.wellnessTitle}</h2>
        <p>{t.wellnessDesc}</p>
      </div>

      {/* Mood Tracker */}
      <div className="card">
        <div className="card-title" style={{ fontSize: 15, marginBottom: 4 }}>{t.wellnessMood}</div>
        <div className="card-subtitle" style={{ marginBottom: 12, fontSize: 12 }}>
          {todayMood
            ? (lang === 'en' ? `You are feeling ${moodOptions.find(m => m.emoji === todayMood)?.label || ''} today` : `Jy voel vandag ${moodOptions.find(m => m.emoji === todayMood)?.label || ''}`)
            : (lang === 'en' ? 'How are you feeling?' : 'Hoe voel jy?')}
        </div>
        <div className="mood-selector">
          {moodOptions.map(m => (
            <button
              key={m.emoji}
              className={`mood-btn ${todayMood === m.emoji ? 'active' : ''}`}
              onClick={() => {
                setMood({ emoji: m.emoji, label: m.label, date: today });
                showToast(lang === 'en' ? `Mood logged: ${m.label}` : `Stemming aangeteken: ${m.label}`);
              }}
            >
              <span style={{ fontSize: 24 }}>{m.emoji}</span>
              <span className="mood-label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Daily Habits */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ fontSize: 15, marginBottom: 0 }}>{t.wellnessHabits}</div>
          <div className="badge badge-pink">{completedCount}/{totalHabits}</div>
        </div>
        <div className="progress-container" style={{ marginBottom: 12 }}>
          <div className="progress-bar-bg" style={{ height: 8 }}>
            <div className="progress-bar-fill" style={{ width: `${(completedCount / totalHabits) * 100}%`, height: 8 }} />
          </div>
        </div>
        <div className="habit-list">
          {HABIT_OPTIONS[lang].map(habit => {
            const done = todayHabits.includes(habit.id);
            return (
              <button
                key={habit.id}
                className={`habit-item ${done ? 'done' : ''}`}
                onClick={() => toggleHabit(habit.id)}
              >
                <div className={`habit-check ${done ? 'checked' : ''}`}>
                  {done ? <HiCheckCircle /> : <div className="habit-check-empty" />}
                </div>
                <span className="habit-label">{habit.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Challenges */}
      <button className="safety-action-btn" onClick={() => setActiveSection('challenges')} style={{ marginBottom: 16 }}>
        <div className="safety-action-icon" style={{ background: 'rgba(255, 193, 7, 0.15)' }}>
          <HiStar style={{ color: '#FFC107' }} />
        </div>
        <span className="safety-action-label">{t.wellnessChallenges}</span>
        <span className="safety-action-arrow">→</span>
      </button>

      {/* Streak / reminder */}
      <div className="card" style={{ background: 'rgba(76, 175, 80, 0.05)', border: '1px solid rgba(76, 175, 80, 0.15)', textAlign: 'center' }}>
        <div className="card-title" style={{ fontSize: 14, marginBottom: 4 }}>🌱 {lang === 'en' ? 'Small steps, big changes' : 'Klein stappies, groot veranderinge'}</div>
        <div className="card-subtitle" style={{ marginBottom: 0, fontSize: 12 }}>
          {lang === 'en' ? 'Every habit you complete is a step toward the woman you are becoming.' : 'Elke gewoonte wat jy voltooi is n stap na die vrou wat jy word.'}
        </div>
      </div>
    </div>
  );
}