import React from 'react';
import { HiLockClosed, HiSparkles } from 'react-icons/hi';

export default function FeatureLock({ lang = 'en', feature, onLogin, onRegister }) {
  return (
    <div className="fade-in feature-lock-page">
      <div className="feature-lock-card">
        <div className="feature-lock-icon"><HiLockClosed /></div>
        <div className="eyebrow">WE-RISE MEMBERS</div>
        <h2>{feature}</h2>
        <p>
          {lang === 'en'
            ? 'You can browse We-Rise without an account. Log in or create an account to use this feature and keep your information securely linked to you.'
            : 'Jy kan We-Rise sonder ’n rekening besigtig. Meld aan of skep ’n rekening om hierdie funksie te gebruik en jou inligting veilig aan jou te koppel.'}
        </p>
        <div className="feature-lock-actions">
          <button className="btn btn-primary" onClick={onLogin}><HiLockClosed /> {lang === 'en' ? 'Log in' : 'Meld aan'}</button>
          <button className="btn btn-secondary" onClick={onRegister}><HiSparkles /> {lang === 'en' ? 'Create account' : 'Skep rekening'}</button>
        </div>
        <span className="feature-lock-note">{lang === 'en' ? 'Browsing stays public. Personal actions require an account.' : 'Besigtiging bly publiek. Persoonlike aksies vereis ’n rekening.'}</span>
      </div>
    </div>
  );
}
