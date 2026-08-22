import React, { useState, useEffect } from 'react';
import { HiSparkles, HiHeart, HiChat, HiCurrencyDollar, HiDownload, HiUserAdd } from 'react-icons/hi';

export default function Home({ t, lang, onNavigate, userName, campaigns = [], isAuthenticated = false, onLogin, onRegister }) {
  const [affirmationIndex, setAffirmationIndex] = useState(0);

  const affirmations = [
    t.affirmation1, t.affirmation2, t.affirmation3, t.affirmation4,
    t.affirmation5, t.affirmation6, t.affirmation7, t.affirmation8,
    t.affirmation9, t.affirmation10,
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setAffirmationIndex(prev => (prev + 1) % affirmations.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [affirmations.length]);

  const quickActions = [
    { icon: HiSparkles, label: t.aiAssistant, tab: 'ai' },
    { icon: HiHeart, label: t.backMi, tab: 'backmi' },
    { icon: HiChat, label: t.community, tab: 'community' },
    { icon: HiCurrencyDollar, label: t.resell, tab: 'resell' },
  ];

  const totalRaised = campaigns.reduce((sum, campaign) => sum + Number(campaign.raised || 0), 0);
  const displayRaised = totalRaised >= 1000
    ? `R${(totalRaised / 1000).toFixed(totalRaised >= 10000 ? 0 : 1)}K`
    : `R${Math.round(totalRaised).toLocaleString()}`;

  return (
    <div className="fade-in">
      <div className="welcome-hero">
        <h2>{isAuthenticated && userName ? t.welcomeBackName.replace('{name}', userName) : (lang === 'en' ? 'Welcome to We-Rise' : 'Welkom by We-Rise')}</h2>
        <p>{isAuthenticated ? t.joinMovement : (lang === 'en' ? 'Explore the movement freely. Create an account when you are ready to use your personal features.' : 'Verken die beweging vrylik. Skep ’n rekening wanneer jy gereed is om jou persoonlike funksies te gebruik.')}</p>
      </div>

      <div className="tagline">{t.tagline}</div>

      {!isAuthenticated && (
        <div className="guest-home-card">
          <div className="guest-home-badge">{lang === 'en' ? 'PUBLIC WEBSITE' : 'PUBLIEKE WEBWERF'}</div>
          <h3>{lang === 'en' ? 'Browse first. Join when you are ready.' : 'Kyk eers rond. Sluit aan wanneer jy gereed is.'}</h3>
          <p>{lang === 'en'
            ? 'You do not need an account to open We-Rise. Login is only required when you want to use personal, community or safety features.'
            : 'Jy het nie ’n rekening nodig om We-Rise oop te maak nie. Aanmelding is net nodig wanneer jy persoonlike, gemeenskap- of veiligheidsfunksies wil gebruik.'}</p>
          <div className="guest-home-actions">
            <button className="btn btn-primary" onClick={onRegister}>{lang === 'en' ? 'Create account' : 'Skep rekening'}</button>
            <button className="btn btn-secondary" onClick={onLogin}>{lang === 'en' ? 'Log in' : 'Meld aan'}</button>
          </div>
        </div>
      )}

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-number">—</div>
          <div className="stat-label">{t.statsMembers}</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{campaigns.length}</div>
          <div className="stat-label">{t.statsCampaigns}</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{displayRaised}</div>
          <div className="stat-label">{t.statsRaised}</div>
        </div>
      </div>

      <div className="affirmation-card">
        <div className="affirmation-text" key={affirmationIndex}>{affirmations[affirmationIndex]}</div>
        <div className="affirmation-share"><HiSparkles /> {t.dailyAffirmation}</div>
      </div>

      <div className="quick-actions">
        {quickActions.map((action, i) => {
          const Icon = action.icon;
          return (
            <button key={i} className="quick-action-btn" onClick={() => onNavigate(action.tab)}>
              <Icon />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">{t.backMiTitle}</div>
        <div className="card-subtitle">{t.supportEachOther}</div>
        <button className="btn btn-primary btn-full" onClick={() => onNavigate('backmi')}>
          <HiHeart /> {t.backMi}
        </button>
      </div>

      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(255,105,180,.07), rgba(255,20,147,.025))' }}>
        <div className="card-title">{lang === 'en' ? 'Join the We-Rise Waitlist' : 'Sluit aan by die We-Rise Waglys'}</div>
        <div className="card-subtitle">{lang === 'en' ? 'Tell us why you want to be part of the movement and be ready for future member onboarding.' : 'Vertel ons hoekom jy deel van die beweging wil wees en wees gereed vir toekomstige lidregistrasie.'}</div>
        <button className="btn btn-secondary btn-full" onClick={() => onNavigate('waitlist')}>
          <HiUserAdd /> {lang === 'en' ? 'Join Waitlist' : 'Sluit aan by Waglys'}
        </button>
      </div>

      <div className="card" style={{ border: '1px solid rgba(255, 193, 7, 0.2)', background: 'rgba(255, 193, 7, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255, 193, 7, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            <HiDownload style={{ color: '#FFC107', fontSize: 18 }} />
          </div>
          <div>
            <div className="card-title" style={{ fontSize: 14, marginBottom: 2 }}>{t.addToHome}</div>
            <div className="card-subtitle" style={{ marginBottom: 0, fontSize: 12 }}>{t.addToHomeDesc}</div>
          </div>
        </div>
        <div className="install-steps">
          <div className="install-step"><span className="install-device">🍎 iPhone</span><span className="install-desc">{t.addToHomeIOS}</span></div>
          <div className="install-step"><span className="install-device">🤖 Android</span><span className="install-desc">{t.addToHomeAndroid}</span></div>
        </div>
      </div>
    </div>
  );
}
