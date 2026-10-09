import React from 'react';

const supporters = [
  'Vrede Kirsten',
  'TrendShop',
  'Die Bakhuys',
  'AFG Designs',
  'Mi Liquors',
  'MBT Petroleum',
  'Find At Home',
];

function SupporterTrack({ hidden = false }) {
  return (
    <div className="footer-supporter-track" aria-hidden={hidden ? 'true' : undefined}>
      {supporters.map((name) => (
        <React.Fragment key={`${hidden ? 'copy-' : ''}${name}`}>
          <span className="footer-supporter-name">{name}</span>
          <span className="footer-supporter-dot" aria-hidden="true">•</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Footer({ t, onOpenTerms }) {
  return (
    <footer className="app-footer">
      <div className="footer-supporter-label">{t.footerSupporters}</div>
      <div className="footer-supporter-marquee" aria-label={t.footerSupporters}>
        <div className="footer-supporter-marquee-inner">
          <SupporterTrack />
          <SupporterTrack hidden />
        </div>
      </div>
      <button type="button" className="footer-terms-link" onClick={onOpenTerms}>{t.terms}</button>
      <div className="footer-rights">{t.footerRights}</div>
    </footer>
  );
}
