import React from 'react';

const BrandLogo = ({ className = '' }) => (
  <span
    className={className}
    aria-label="CineHub"
    style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}
  >
    {/* Lens icon */}
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="17" stroke="#7c3aed" strokeWidth="2" />
      <circle cx="18" cy="18" r="11" stroke="#a78bfa" strokeWidth="1.5" strokeOpacity="0.6" />
      <circle cx="18" cy="18" r="6" fill="#7c3aed" />
      <circle cx="18" cy="18" r="2.5" fill="#f1f5f9" />
      {/* Aperture markers */}
      <line x1="18" y1="1" x2="18" y2="5" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="31" x2="18" y2="35" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
      <line x1="1" y1="18" x2="5" y2="18" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
      <line x1="31" y1="18" x2="35" y2="18" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
    </svg>

    {/* Wordmark */}
    <svg viewBox="0 0 130 28" height="22" xmlns="http://www.w3.org/2000/svg">
      <text
        x="0"
        y="22"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="22"
        fill="#f1f5f9"
        letterSpacing="-0.5"
      >
        Cine
      </text>
      <text
        x="62"
        y="22"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="22"
        fill="#a78bfa"
        letterSpacing="-0.5"
      >
        Hub
      </text>
    </svg>
  </span>
);

export default BrandLogo;
