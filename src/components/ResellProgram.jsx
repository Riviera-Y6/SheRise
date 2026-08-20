import React, { useState } from 'react';
import { HiLink, HiCheck, HiShare } from 'react-icons/hi';

export default function ResellProgram({ t, lang, showToast }) {
  const [copied, setCopied] = useState(false);
  const referralLink = `${window.location.origin}/?ref=risewithme`;
  const resellPrice = lang === 'en' ? '$100' : 'R1,600';
  const yourEarn = lang === 'en' ? '$80' : 'R1,280';
  const founderShare = lang === 'en' ? '$20' : 'R320';

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(referralLink); } catch {}
    setCopied(true);
    showToast(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'We-Rise',
          text: lang === 'en'
            ? 'Join me on We-Rise — an empowerment platform for women. Use my link to get started 💗'
            : 'Sluit by my aan op We-Rise — ’n bemagtigingsplatform vir vroue. Gebruik my skakel om te begin 💗',
          url: referralLink,
        });
        return;
      } catch {}
    }
    handleCopy();
  };

  return (
    <div className="fade-in">
      <div className="resell-hero">
        <div className="resell-percentage">80%</div>
        <div className="resell-label">{t.resellTitle}</div>
        <div className="resell-price-tag">{resellPrice}</div>
      </div>

      <div className="card">
        <div className="card-subtitle">{t.resellDesc}</div>
        <div className="stats-row" style={{ marginBottom: 16 }}>
          <div className="stat-box"><div className="stat-number">{yourEarn}</div><div className="stat-label">{lang === 'en' ? 'You Earn (80%)' : 'Jy Verdien (80%)'}</div></div>
          <div className="stat-box"><div className="stat-number">{founderShare}</div><div className="stat-label">{lang === 'en' ? 'Platform (20%)' : 'Platform (20%)'}</div></div>
          <div className="stat-box"><div className="stat-number">{resellPrice}</div><div className="stat-label">{lang === 'en' ? 'Resell Price' : 'Herverkoopprys'}</div></div>
        </div>

        <div className="form-group">
          <label>{t.yourLink}</label>
          <div className="referral-box">
            <HiLink style={{ color: 'var(--pink)', flexShrink: 0 }} />
            <input type="text" value={referralLink} readOnly />
            <button className="btn btn-primary btn-sm" onClick={handleCopy} style={{ flexShrink: 0 }}>{copied ? <HiCheck /> : t.copyLink}</button>
          </div>
        </div>

        <button className="btn btn-primary btn-full" onClick={handleShare} style={{ marginBottom: 12 }}>
          <HiShare /> {lang === 'en' ? 'Share with We-Rise Ladies' : 'Deel met We-Rise Ladies'}
        </button>

        <div style={{ marginTop: 16 }}>
          <div className="card-title" style={{ fontSize: 16, marginBottom: 12 }}>{lang === 'en' ? 'How It Works' : 'Hoe Dit Werk'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              [lang === 'en' ? 'Share Your Link' : 'Deel Jou Skakel', lang === 'en' ? 'Share your unique referral link with friends, family, We-Rise Ladies, and social media.' : 'Deel jou unieke verwysingsskakel met vriende, familie, We-Rise Ladies en sosiale media.'],
              [lang === 'en' ? 'They Join We-Rise' : 'Hulle Sluit by We-Rise Aan', lang === 'en' ? 'When someone purchases We-Rise using your link, the sale is attributed to your referral.' : 'Wanneer iemand We-Rise met jou skakel koop, word die verkoop aan jou verwysing gekoppel.'],
              [lang === 'en' ? 'You Earn 80%' : 'Jy Verdien 80%', lang === 'en' ? `You earn ${yourEarn}; ${founderShare} supports the We-Rise platform and its continued development.` : `Jy verdien ${yourEarn}; ${founderShare} ondersteun die We-Rise-platform en verdere ontwikkeling.`],
            ].map(([title, desc], index) => (
              <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gradient-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>{index + 1}</div>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: 'rgba(255, 105, 180, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 105, 180, 0.15)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
          {lang === 'en'
            ? `💗 We-Rise resells for ${resellPrice}. You earn ${yourEarn} (80%) per completed sale and ${founderShare} (20%) supports the platform.`
            : `💗 We-Rise herverkoop vir ${resellPrice}. Jy verdien ${yourEarn} (80%) per voltooide verkoop en ${founderShare} (20%) ondersteun die platform.`}
        </div>
      </div>
    </div>
  );
}
