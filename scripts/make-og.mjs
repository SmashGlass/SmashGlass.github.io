/**
 * Generates public/og.png (1200x630) — the social preview card.
 * Run locally with `node scripts/make-og.mjs` and commit the result, so CI
 * doesn't depend on which fonts the runner happens to have installed.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const W = 1200, H = 630;
const COLORS = ['#4F7DFF', '#22D3A5', '#FFB020', '#FF5C7A'];
const LABELS = ['AGENTS', 'AUTOMATION', 'INTEGRATIONS', 'MODERNIZE'];

// Prism sits right of centre; four rays fan out toward the right edge.
const cx = 858, cy = 315, rad = 74;
const tri = [0, 1, 2]
  .map((i) => {
    const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
    return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad * 1.06).toFixed(1)}`;
  })
  .join(' ');

const rays = COLORS.map((c, i) => {
  const spread = (i - 1.5) * 0.17;
  const ex = cx + Math.cos(spread) * 420;
  const ey = cy + Math.sin(spread) * 420;
  const lx = cx + Math.cos(spread) * 212;
  const ly = cy + Math.sin(spread) * 212;
  return `
    <line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"
          stroke="${c}" stroke-width="9" opacity="0.28" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"
          stroke="${c}" stroke-width="2" opacity="0.95" stroke-linecap="round"/>
    <text x="${lx.toFixed(1)}" y="${(ly - 9).toFixed(1)}" fill="${c}"
          font-family="Menlo, monospace" font-size="13" letter-spacing="2"
          text-anchor="middle" opacity="0.92">${LABELS[i]}</text>`;
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="62%" cy="50%" r="72%">
      <stop offset="0%" stop-color="#11151D"/>
      <stop offset="100%" stop-color="#07080B"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#A0BEE6" stop-opacity="0.22"/>
      <stop offset="50%" stop-color="#7896C8" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#C8DCFF" stop-opacity="0.26"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- incoming white beam: starts clear of the headline so it never reads as a strikethrough -->
  <line x1="792" y1="315" x2="${cx}" y2="${cy}" stroke="#E2E8F0" stroke-width="7" opacity="0.12"/>
  <line x1="792" y1="315" x2="${cx}" y2="${cy}" stroke="#E2E8F0" stroke-width="2" opacity="0.38"/>

  ${rays}

  <polygon points="${tri}" fill="url(#glass)" stroke="#CDE1FF" stroke-width="1.6" stroke-opacity="0.6"/>

  <text x="72" y="96" fill="#5C6472" font-family="Menlo, monospace"
        font-size="15" letter-spacing="4.5">SENIOR-LED ENGINEERING STUDIO</text>

  <text x="72" y="236" fill="#EDEEF2" font-family="Georgia, serif" font-size="66">From plain English</text>
  <text x="72" y="306" fill="#EDEEF2" font-family="Georgia, serif" font-size="66">to production software.</text>

  <text x="72" y="372" fill="#8A919E" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="22">
    AI agents · automation · custom software
  </text>

  <rect x="72" y="520" width="42" height="2" fill="#4F7DFF"/>
  <text x="72" y="566" fill="#EDEEF2" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="25" font-weight="bold" letter-spacing="1">SMASHGLASS</text>
  <text x="${W - 72}" y="566" fill="#5C6472" font-family="Menlo, monospace"
        font-size="16" text-anchor="end">smashglass.com</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync('public/og.png', png);
console.log(`public/og.png — ${W}x${H}, ${(png.length / 1024).toFixed(1)} KB`);
