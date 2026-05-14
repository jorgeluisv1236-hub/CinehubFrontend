import React from 'react';

const BrandLogo = ({ className = '' }) => (
  <span
    className={className}
    aria-label="CineHub"
    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
  >
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#e50914" />
      <circle cx="16" cy="16" r="7" stroke="#fff" strokeWidth="1.8" fill="none" />
      <circle cx="16" cy="16" r="2.5" fill="#fff" />
      <line x1="16" y1="2"  x2="16" y2="7"  stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="25" x2="16" y2="30" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2"  y1="16" x2="7"  y2="16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="25" y1="16" x2="30" y2="16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="5"  cy="5"  r="2" fill="#fff" opacity="0.5" />
      <circle cx="27" cy="5"  r="2" fill="#fff" opacity="0.5" />
      <circle cx="5"  cy="27" r="2" fill="#fff" opacity="0.5" />
      <circle cx="27" cy="27" r="2" fill="#fff" opacity="0.5" />
    </svg>
    <svg viewBox="0 0 130 28" height="22" xmlns="http://www.w3.org/2000/svg">
      <text x="0"  y="22" fontFamily="Inter, system-ui, sans-serif" fontWeight="900" fontSize="23" fill="#ffffff" letterSpacing="-0.5">CINE</text>
      <text x="68" y="22" fontFamily="Inter, system-ui, sans-serif" fontWeight="900" fontSize="23" fill="#e50914" letterSpacing="-0.5">HUB</text>
    </svg>
  </span>
);

export default BrandLogo;
