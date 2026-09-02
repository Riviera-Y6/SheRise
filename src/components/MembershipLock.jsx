import React from 'react';
import { HiLockClosed, HiHeart, HiShieldCheck } from 'react-icons/hi';

export default function MembershipLock({ lang, feature, membership, onMembership }) {
  const trialEnded = membership?.status === 'trial_expired';
  return (
    <section className="feature-lock-page membership-lock fade-in">
      <div className="feature-lock-card">
        <div className="feature-lock-icon"><HiLockClosed /></div>
        <div className="eyebrow">WE-RISE MEMBERSHIP</div>
        <h2>{lang === 'en' ? `${feature} is a member benefit` : `${feature} is ’n lidvoordeel`}</h2>
        <p>{trialEnded
        ? (lang === 'en'
          ? 'Your 7-day free trial has ended. Complete your once-off joining payment to continue with full access.'
          : 'Jou gratis proeftydperk van 7 dae is verby. Voltooi jou eenmalige aansluitingsbetaling om volle toegang voort te sit.')
        : (lang === 'en'
          ? 'Your membership needs attention before this feature can be used.'
          : 'Jou lidmaatskap kort aandag voordat hierdie funksie gebruik kan word.')}</p>
        <div className="membership-lock-points">
          <span><HiShieldCheck /> {lang === 'en' ? 'Secure PayFast checkout' : 'Veilige PayFast-betaling'}</span>
          <span><HiHeart /> {lang === 'en' ? 'Monthly BackMi foundation allocation included' : 'Maandelikse BackMi-fondstoewysing ingesluit'}</span>
        </div>
        <button className="btn btn-primary" onClick={onMembership}>
          {lang === 'en' ? 'View Membership' : 'Sien Lidmaatskap'}
        </button>
      </div>
    </section>
  );
}
