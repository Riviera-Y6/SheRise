import React from 'react';
import { HiHeart } from 'react-icons/hi';

export default function Footer({ t }) {
  return (
    <footer className="app-footer">
      <div className="footer-name">{t.footer}</div>
      <div className="footer-role">
        <HiHeart style={{ color: 'var(--pink)', fontSize: 12, verticalAlign: 'middle', marginRight: 4 }} />
        {t.footerRole}
      </div>
      <div className="footer-rights">{t.footerRights}</div>
    </footer>
  );
}
