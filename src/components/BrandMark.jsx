import React from 'react';

export default function BrandMark({ variant = 'compact', className = '' }) {
  const full = variant === 'seal';
  const classes = ['brand-mark', `brand-mark-${variant}`, className].filter(Boolean).join(' ');

  return (
    <img
      className={classes}
      src={full ? '/we-rise-emblem.svg?v=2' : '/favicon.svg?v=2'}
      alt={full ? 'We-Rise — Rise Together. Rise Forever.' : 'We-Rise'}
      draggable="false"
    />
  );
}
