// Hand-drawn (code-drawn) illustrations: icons, genre key art, art-style thumbnails.
// Everything here is static, trusted markup built from our own strings + preset swatch colours.

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const col = (c, fallback) => (HEX.test(String(c)) ? c : fallback);

const icon = (body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

export const ICONS = {
  spark: icon('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
  pen: icon('<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z"/><path d="M14 7l3 3"/>'),
  brush: icon('<path d="M20 4c-4 1-9 6-10.500 9.500l1.500 1.500C14.500 13.500 19 8 20 4z"/><path d="M8 14.500c-2 0-3.500 1.500-3.500 3.500 0 1-.5 1.500-1.500 2 3 .5 6.500-.5 6.500-3.500"/>'),
  mic: icon('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.500 11a6.500 6.500 0 0013 0M12 17.500V21M9 21h6"/>'),
  clapper: icon('<path d="M3.500 9h17v10a1.500 1.500 0 01-1.500 1.500H5A1.500 1.500 0 013.500 19z"/><path d="M3.500 9l-.5-3L19.500 3l.5 3zM8 4.800l1.800 3.600M13 3.900l1.800 3.600"/>'),
  copy: icon('<rect x="8.500" y="8.500" width="11" height="11" rx="2"/><path d="M5.500 15.500h-1a1 1 0 01-1-1v-10a1 1 0 011-1h10a1 1 0 011 1v1"/>'),
  check: icon('<path d="M5 12.500l4.500 4.500L19 7.500" stroke-width="2.600"/>'),
  trash: icon('<path d="M4 7h16M9.500 7V4.500h5V7M6.500 7l.8 12a1.500 1.500 0 001.500 1.400h6.400a1.500 1.500 0 001.500-1.400l.8-12M10 11v6M14 11v6"/>'),
  download: icon('<path d="M12 4v11M7.500 11l4.500 4.500 4.500-4.500M5 19.500h14"/>'),
  play: icon('<path d="M8 5.500v13l11-6.500z" fill="currentColor"/>'),
  refresh: icon('<path d="M20 12a8 8 0 11-2.600-5.900M20 4.500v4.500h-4.500"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
  next: icon('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  alert: icon('<path d="M12 4L2.800 19.500h18.400z"/><path d="M12 10v4.500M12 17.300v.2"/>'),
  mute: icon('<path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500zM16 9.500l5 5M21 9.500l-5 5"/>'),
  film: icon('<rect x="4" y="3.500" width="16" height="17" rx="2"/><path d="M8 3.500v17M16 3.500v17M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4"/>'),
  grid: icon('<rect x="4" y="4" width="6.500" height="6.500" rx="1.500"/><rect x="13.500" y="4" width="6.500" height="6.500" rx="1.500"/><rect x="4" y="13.500" width="6.500" height="6.500" rx="1.500"/><rect x="13.500" y="13.500" width="6.500" height="6.500" rx="1.500"/>'),
  terminal: icon('<path d="M5 8l4 4-4 4M12 16.500h7"/>'),
  chevron: icon('<path d="M8 10l4 4 4-4"/>'),
  back: icon('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  gear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  clock: icon('<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>'),
};

// ───────────────────────── brand mark ─────────────────────────
// A shadow-play screen: a 9:16 frame lit from behind, a kranok flame for the "play" spark.
export const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <defs><linearGradient id="lg-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE29A"/><stop offset="1" stop-color="#E29A2B"/></linearGradient></defs>
  <rect x="9" y="3" width="22" height="34" rx="6" fill="#141B38" stroke="url(#lg-g)" stroke-width="2.200"/>
  <circle cx="20" cy="17" r="7.500" fill="url(#lg-g)" opacity=".22"/>
  <path d="M16.500 12.500v12l10-6z" fill="url(#lg-g)"/>
  <path d="M14 31.500c2-2.500 4-2.500 6 0 2-2.500 4-2.500 6 0" fill="none" stroke="url(#lg-g)" stroke-width="1.600" stroke-linecap="round"/>
</svg>`;

// ───────────────────────── genre key art (320×140) ─────────────────────────
const GENRE_ART = {
  cdrama: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="cd-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B0D17"/><stop offset="1" stop-color="#14060F"/></linearGradient>
      <radialGradient id="cd-moon" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE7B0"/><stop offset=".7" stop-color="#F2B84B"/><stop offset="1" stop-color="#C8102E"/></radialGradient>
      <radialGradient id="cd-lamp" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#FF9A6B"/><stop offset="1" stop-color="#C8102E"/></radialGradient>
      <pattern id="cd-lat" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M0 11h22M11 0v22M4 4h14v14H4z" fill="none" stroke="#F2C14E" stroke-width=".7" opacity=".16"/></pattern>
    </defs>
    <rect width="320" height="140" fill="url(#cd-bg)"/>
    <rect width="320" height="140" fill="url(#cd-lat)"/>
    <circle cx="160" cy="78" r="56" fill="url(#cd-moon)" opacity=".95"/>
    <circle cx="160" cy="78" r="63" fill="none" stroke="#F2C14E" stroke-width="2" opacity=".55"/>
    <g fill="#1A0710">
      <path d="M128 140c0-22 4-36 12-40-5-3-8-8-8-14 0-8 6-14 13-14s13 6 13 14c0 6-3 11-8 14 4 2 7 7 9 14l-6 26z"/>
      <path d="M192 140c0-24-5-40-13-44 5-3 8-8 8-15 0-9-6-15-14-15s-14 6-14 15c0 5 2 9 5 12-4 6-4 14-2 22l4 25z"/>
      <path d="M159 62c2-7 9-11 17-9 7 2 11 8 11 14-6-5-14-6-22-3z"/>
    </g>
    <g>
      <path d="M52 0v20M268 0v30" stroke="#F2C14E" stroke-width="1.200"/>
      <g transform="translate(52 38)"><ellipse rx="17" ry="20" fill="url(#cd-lamp)"/><path d="M-9-17c-4 11-4 23 0 34M9-17c4 11 4 23 0 34M0-20v40" stroke="#7A0A1C" stroke-width="1" fill="none"/><rect x="-8" y="-23" width="16" height="5" rx="1.500" fill="#F2C14E"/><rect x="-8" y="18" width="16" height="5" rx="1.500" fill="#F2C14E"/><path d="M0 23v16M-4 23v11M4 23v11" stroke="#F2C14E" stroke-width="1.200"/></g>
      <g transform="translate(268 46) scale(.8)"><ellipse rx="17" ry="20" fill="url(#cd-lamp)"/><path d="M-9-17c-4 11-4 23 0 34M9-17c4 11 4 23 0 34M0-20v40" stroke="#7A0A1C" stroke-width="1" fill="none"/><rect x="-8" y="-23" width="16" height="5" rx="1.500" fill="#F2C14E"/><rect x="-8" y="18" width="16" height="5" rx="1.500" fill="#F2C14E"/><path d="M0 23v16M-4 23v11M4 23v11" stroke="#F2C14E" stroke-width="1.200"/></g>
    </g>
    <g fill="#F2C14E" opacity=".8"><circle cx="96" cy="26" r="1.200"/><circle cx="226" cy="18" r="1"/><circle cx="296" cy="96" r="1.200"/><circle cx="22" cy="92" r="1"/></g>
  </svg>`,
  ghost: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="gh-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B1147"/><stop offset="1" stop-color="#090716"/></linearGradient>
      <radialGradient id="gh-moon" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FDFBE8"/><stop offset=".75" stop-color="#D9D2F5"/><stop offset="1" stop-color="#9C8CF0"/></radialGradient>
      <radialGradient id="gh-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#B9A8FF" stop-opacity=".55"/><stop offset="1" stop-color="#B9A8FF" stop-opacity="0"/></radialGradient>
      <pattern id="gh-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#7C5CFF" opacity=".18"/></pattern>
    </defs>
    <rect width="320" height="140" fill="url(#gh-bg)"/>
    <rect width="320" height="140" fill="url(#gh-dots)"/>
    <circle cx="228" cy="48" r="60" fill="url(#gh-glow)"/>
    <circle cx="228" cy="48" r="30" fill="url(#gh-moon)"/>
    <path d="M22 140V74c0-4 3-4 4 0l2 18c7-10 13-20 13-34 0-4 3-4 4 0 1 13-3 25-10 36 9-5 17-13 21-22 2-4 5-2 4 2-4 12-14 22-27 28l-1 38z" fill="#07050F"/>
    <path d="M41 58c-6-8-7-17-4-25M37 76c-9-2-17-8-21-17M66 72c7-2 12-8 14-15" stroke="#07050F" stroke-width="2.200" fill="none" stroke-linecap="round"/>
    <path d="M196 140v-26l-14 2 30-24 4-14 4 14 30 24-14-2v26z" fill="#07050F"/>
    <path d="M216 78c-1-6 1-10 4-13-1 5 0 9 2 13z" fill="#07050F"/>
    <g transform="translate(124 70)">
      <circle r="34" fill="url(#gh-glow)"/>
      <path d="M-18 6c0-16 8-27 18-27s18 11 18 27v22l-6-5-6 5-6-5-6 5-6-5-6 5z" fill="#F4F0FF"/>
      <ellipse cx="-6.500" cy="2" rx="3.200" ry="4.600" fill="#1B1147"/><ellipse cx="6.500" cy="2" rx="3.200" ry="4.600" fill="#1B1147"/>
      <ellipse cx="0" cy="13" rx="3" ry="4" fill="#1B1147"/>
    </g>
    <path d="M0 120c40-10 80-10 120 0s80 10 120 0 60-8 80-4v24H0z" fill="#B9A8FF" opacity=".12"/>
    <path d="M0 130c50-8 90-6 140 0s110 4 180-4v14H0z" fill="#B9A8FF" opacity=".12"/>
  </svg>`,
  folktale: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="ft-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A2A0C"/><stop offset=".6" stop-color="#2A1408"/><stop offset="1" stop-color="#120C12"/></linearGradient>
      <radialGradient id="ft-sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE9A8"/><stop offset=".6" stop-color="#F5A524"/><stop offset="1" stop-color="#F5A524" stop-opacity="0"/></radialGradient>
      <linearGradient id="ft-fish" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9A8"/><stop offset=".5" stop-color="#F5B83D"/><stop offset="1" stop-color="#C77A12"/></linearGradient>
      <linearGradient id="ft-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F4E3D"/><stop offset="1" stop-color="#0C1F22"/></linearGradient>
    </defs>
    <rect width="320" height="140" fill="url(#ft-bg)"/>
    <circle cx="96" cy="58" r="58" fill="url(#ft-sun)" opacity=".85"/>
    <g fill="#160B08">
      <path d="M232 104V60h5v44zM268 104V66h5v38z"/>
      <path d="M218 66l34-30 36 30-8 0-28-21-26 21z"/>
      <path d="M252 36c-1-8 2-13 6-16-2 6-1 11 1 16z"/>
      <path d="M222 66h60v26h-60z" opacity=".92"/>
    </g>
    <rect x="240" y="72" width="10" height="13" rx="1" fill="#F5A524" opacity=".85"/><rect x="258" y="72" width="10" height="13" rx="1" fill="#F5A524" opacity=".55"/>
    <path d="M0 100c30-6 60-6 90 0s70 6 110 0 80-6 120 0v40H0z" fill="url(#ft-water)"/>
    <path d="M20 114c14-4 26-4 40 0M96 122c14-4 26-4 40 0M196 112c14-4 26-4 40 0M250 126c14-4 26-4 40 0" stroke="#F3E3B3" stroke-width="1.300" fill="none" opacity=".4" stroke-linecap="round"/>
    <g transform="translate(150 80) rotate(-16)">
      <path d="M-38 0c12-17 34-21 52-11 8 4 13 9 15 11-2 2-7 7-15 11-18 10-40 6-52-11z" fill="url(#ft-fish)"/>
      <path d="M-34 0l-22-15c3 9 3 21 0 30z" fill="url(#ft-fish)"/>
      <path d="M-12-13c5-10 14-12 22-9l-6 9zM-8 13c4 7 11 8 17 6l-5-7z" fill="#E29A2B"/>
      <path d="M-18-6c4 4 4 8 0 12M-8-9c5 6 5 12 0 18M2-9c5 6 5 12 0 18" stroke="#B36A0C" stroke-width="1.200" fill="none" opacity=".7"/>
      <circle cx="18" cy="-3" r="3" fill="#1A0D05"/><circle cx="19" cy="-4" r="1" fill="#FFF"/>
    </g>
    <g fill="#FFF3C4" opacity=".9"><circle cx="118" cy="104" r="1.600"/><circle cx="186" cy="98" r="1.300"/><circle cx="170" cy="108" r="1"/></g>
    <g transform="translate(44 112)"><path d="M0 0c-8-5-9-12-5-17 3 3 5 8 5 17zM0 0c8-5 9-12 5-17-3 3-5 8-5 17zM0 0c-3-8-2-15 0-19 2 4 3 11 0 19z" fill="#F7A8B8"/><ellipse cx="-14" cy="4" rx="13" ry="3.500" fill="#2E6B4F"/></g>
  </svg>`,
};

export function genreArt(id) {
  return GENRE_ART[id] || GENRE_ART.folktale;
}

// ───────────────────────── art-style thumbnails (120×150) ─────────────────────────
// Same subject (a storyteller's hero, bust shot) rendered seven ways so the styles are comparable at a glance.
const W = 120;
const H = 150;
const open = (extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" ${extra}>`;
const SHOULDERS = 'M14 150c0-24 16-36 46-36s46 12 46 36z';
const NECK = 'M51 98h18v20c-6 5-12 5-18 0z';

const THUMBS = {
  realistic: ([a, b, c, d]) => `${open()}
    <defs><radialGradient id="rl" cx="50%" cy="22%" r="70%"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></radialGradient>
    <linearGradient id="rs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E7B58C"/><stop offset="1" stop-color="#7A4A32"/></linearGradient>
    <filter id="rb"><feGaussianBlur stdDeviation="5"/></filter></defs>
    <rect width="${W}" height="${H}" fill="url(#rl)"/>
    <circle cx="26" cy="30" r="12" fill="${a}" opacity=".7" filter="url(#rb)"/><circle cx="98" cy="46" r="9" fill="${b}" opacity=".7" filter="url(#rb)"/>
    <path d="M14 150c2-26 20-36 46-36s44 10 46 36z" fill="#14181F"/>
    <path d="M50 96h20v22H50z" fill="url(#rs)"/>
    <ellipse cx="60" cy="74" rx="22" ry="27" fill="url(#rs)"/>
    <path d="M37 70c-2-24 10-36 24-36 15 0 26 12 23 36-4-12-12-18-24-19-11 0-18 7-23 19z" fill="#0C0D10"/>
    <path d="M60 47c12 4 20 14 22 30-1 16-10 24-22 24z" fill="#000" opacity=".28"/>
    <rect width="${W}" height="10" fill="#000"/><rect y="${H - 10}" width="${W}" height="10" fill="#000"/>
  </svg>`,
  'dark-fantasy': ([a, b, c, d]) => `${open()}
    <defs><radialGradient id="dg" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></radialGradient>
    <filter id="db"><feGaussianBlur stdDeviation="4"/></filter></defs>
    <rect width="${W}" height="${H}" fill="url(#dg)"/>
    <path d="M92 20a13 13 0 1 0 10 22 16 16 0 0 1-10-22z" fill="#E9E4D0"/>
    <path d="M0 120l18-22 10 8 8-20 8 34z" fill="#06080B"/><path d="M84 120l10-30 8 12 18-16v34z" fill="#06080B"/>
    <path d="M38 150c-4-40 6-58 22-58s26 18 22 58z" fill="#0A0C10"/>
    <path d="M40 60c0-30 8-42 20-42s20 12 20 42c0 30-6 60-8 80H48c-2-20-8-50-8-80z" fill="#0B0B0E"/>
    <ellipse cx="60" cy="62" rx="14" ry="19" fill="#9FB0AE"/>
    <circle cx="54" cy="60" r="6" fill="${a}" opacity=".6" filter="url(#db)"/><circle cx="66" cy="60" r="6" fill="${a}" opacity=".6" filter="url(#db)"/>
    <circle cx="54" cy="60" r="2.600" fill="${a}"/><circle cx="66" cy="60" r="2.600" fill="${a}"/>
    <path d="M53 72c4 4 10 4 14 0" stroke="${b}" stroke-width="2" fill="none"/>
  </svg>`,
  pixar: ([a, b, c, d]) => `${open()}
    <defs>
      <radialGradient id="px-bg" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></radialGradient>
      <radialGradient id="px-skin" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#FFE3C7"/><stop offset="1" stop-color="#EFA676"/></radialGradient>
      <linearGradient id="px-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
      <filter id="px-blur"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#px-bg)"/>
    <g filter="url(#px-blur)" opacity=".7"><circle cx="20" cy="30" r="14" fill="${a}"/><circle cx="102" cy="52" r="18" fill="#FFF" opacity=".5"/><circle cx="92" cy="18" r="9" fill="${b}"/></g>
    <path d="${SHOULDERS}" fill="url(#px-shirt)"/>
    <path d="${NECK}" fill="#E79C6C"/>
    <ellipse cx="60" cy="72" rx="30" ry="32" fill="url(#px-skin)"/>
    <path d="M29 68c-4-26 12-42 32-42 21 0 35 15 31 40-6-12-16-19-30-20-14 1-26 9-33 22z" fill="#5B3420"/>
    <path d="M40 40c8-9 22-12 34-7" stroke="#8C5A3A" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
    <g><ellipse cx="48" cy="76" rx="8" ry="9.500" fill="#FFF"/><ellipse cx="72" cy="76" rx="8" ry="9.500" fill="#FFF"/><circle cx="49.500" cy="77.500" r="5.200" fill="#3B2A1E"/><circle cx="70.500" cy="77.500" r="5.200" fill="#3B2A1E"/><circle cx="51.500" cy="75" r="1.800" fill="#FFF"/><circle cx="72.500" cy="75" r="1.800" fill="#FFF"/></g>
    <path d="M52 92c5 5 11 5 16 0" stroke="#A8502F" stroke-width="2.200" fill="none" stroke-linecap="round"/>
    <path d="M88 56c5 14 3 30-6 42" stroke="#FFF6D6" stroke-width="2.500" fill="none" stroke-linecap="round" opacity=".75"/>
  </svg>`,

  'comic-us': ([a, b, c, d]) => `${open()}
    <defs><pattern id="cu-dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.500" fill="${d}" opacity=".28"/></pattern></defs>
    <rect width="${W}" height="${H}" fill="${c}"/><rect width="${W}" height="${H}" fill="url(#cu-dots)"/>
    <path d="M60 4l10 24 22-16-6 27 28 2-22 17 20 20-28 0 4 28-22-18-12 26-10-26-24 16 6-28-26-2 22-16-18-22 28 2z" fill="${a}" stroke="${d}" stroke-width="2.500" stroke-linejoin="round"/>
    <path d="${SHOULDERS}" fill="${b}" stroke="${d}" stroke-width="3"/>
    <path d="M44 118l16 14 16-14" fill="none" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>
    <path d="${NECK}" fill="#F3B98C" stroke="${d}" stroke-width="3"/>
    <path d="M34 66c0-20 11-32 26-32s26 12 26 32c0 22-12 38-26 38S34 88 34 66z" fill="#FFD2A6" stroke="${d}" stroke-width="3"/>
    <path d="M60 104c12 0 22-12 25-28-6 8-14 12-25 12z" fill="#E59A63" opacity=".8"/>
    <path d="M32 62c-3-22 10-36 29-36 18 0 30 12 28 34-8-8-14-14-24-16-10 6-22 10-33 18z" fill="${d}"/>
    <path d="M44 38c8-6 18-7 26-4" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M41 68l14-3M65 65l14 3" stroke="${d}" stroke-width="3.500" stroke-linecap="round"/>
    <circle cx="49" cy="74" r="2.600" fill="${d}"/><circle cx="71" cy="74" r="2.600" fill="${d}"/>
    <path d="M51 91h18" stroke="${d}" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  china: ([a, b, c, d]) => `${open()}
    <defs>
      <linearGradient id="cn-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".5"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>
      <linearGradient id="cn-robe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#7A0A1C"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="${d}"/>
    <circle cx="90" cy="30" r="15" fill="${a}"/>
    <path d="M0 78l22-34 14 18 16-30 22 34 14-14 32 30v20H0z" fill="url(#cn-mist)"/>
    <path d="M0 96l30-22 22 16 26-24 42 30v14H0z" fill="url(#cn-mist)" opacity=".8"/>
    <path d="${SHOULDERS}" fill="url(#cn-robe)" stroke="${c}" stroke-width="1"/>
    <path d="M42 116l18 26 18-26" fill="none" stroke="${b}" stroke-width="3.500" stroke-linejoin="round"/>
    <path d="${NECK}" fill="#F3D9C4" stroke="${c}" stroke-width=".8"/>
    <path d="M30 150c-6-34-4-66 8-90 6-12 38-12 44 0 12 24 14 56 8 90l-12-36H42z" fill="${c}"/>
    <path d="M39 70c0-18 9-30 21-30s21 12 21 30c0 16-10 34-21 34S39 86 39 70z" fill="#FBE9DC" stroke="${c}" stroke-width="1"/>
    <path d="M37 66c0-20 10-30 23-30s23 10 23 30c-8-6-12-12-14-20-8 10-20 16-32 20z" fill="${c}"/>
    <circle cx="60" cy="28" r="10" fill="${c}"/><path d="M44 26l34-6" stroke="${b}" stroke-width="2.200" stroke-linecap="round"/><circle cx="80" cy="19.500" r="2.600" fill="${b}"/>
    <path d="M44 74c4-3 9-3 12 0M64 74c4-3 9-3 12 0" stroke="${c}" stroke-width="1.800" fill="none" stroke-linecap="round"/>
    <circle cx="50" cy="76.500" r="2" fill="${c}"/><circle cx="70" cy="76.500" r="2" fill="${c}"/>
    <path d="M56 91c3 1.500 5 1.500 8 0" stroke="${a}" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`,

  korea: ([a, b, c, d]) => `${open()}
    <defs>
      <linearGradient id="kr-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
      <linearGradient id="kr-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A5547"/><stop offset="1" stop-color="#4C342E"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#kr-bg)"/>
    <g fill="#FFF"><circle cx="18" cy="24" r="9" opacity=".35"/><circle cx="104" cy="40" r="13" opacity=".3"/><circle cx="96" cy="112" r="7" opacity=".3"/>
      <path d="M22 62l1.800 5 5 1.800-5 1.800-1.800 5-1.800-5-5-1.800 5-1.800z"/><path d="M98 14l1.400 4 4 1.400-4 1.400-1.400 4-1.400-4-4-1.400 4-1.400z"/><path d="M106 78l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></g>
    <path d="${SHOULDERS}" fill="${d}" stroke="#6B4A5E" stroke-width="1"/>
    <path d="M40 116c6 8 34 8 40 0" fill="none" stroke="${b}" stroke-width="3"/>
    <path d="${NECK}" fill="#FCE3D6" stroke="#6B4A5E" stroke-width=".8"/>
    <path d="M38 70c0-19 9-31 22-31s22 12 22 31c0 17-10 34-22 34S38 87 38 70z" fill="#FFF0E8" stroke="#6B4A5E" stroke-width="1"/>
    <path d="M34 78c-5-28 6-46 26-46 21 0 31 18 26 46-2-12-6-20-10-26-10 8-24 12-36 12-3 4-5 9-6 14z" fill="url(#kr-hair)"/>
    <path d="M44 40c6-5 16-6 24-3" stroke="#C99B86" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="49" cy="77" rx="3" ry="4" fill="#4C342E"/><ellipse cx="71" cy="77" rx="3" ry="4" fill="#4C342E"/><circle cx="50" cy="75.500" r="1.100" fill="#FFF"/><circle cx="72" cy="75.500" r="1.100" fill="#FFF"/>
    <ellipse cx="44" cy="86" rx="5" ry="3" fill="${a}" opacity=".6"/><ellipse cx="76" cy="86" rx="5" ry="3" fill="${a}" opacity=".6"/>
    <path d="M56 91c3 2.500 5 2.500 8 0" stroke="#D0607E" stroke-width="1.800" fill="none" stroke-linecap="round"/>
  </svg>`,

  thai: ([a, b, c, d]) => `${open()}
    <defs>
      <linearGradient id="th-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6D77A"/><stop offset="1" stop-color="${a}"/></linearGradient>
      <pattern id="th-kanok" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M10 2c4 4 4 8 0 10-4-2-4-6 0-10zM0 12c4 4 4 8 0 10M20 12c-4 4-4 8 0 10" fill="none" stroke="${a}" stroke-width=".9" opacity=".45"/></pattern>
    </defs>
    <rect width="${W}" height="${H}" fill="${b}"/><rect width="${W}" height="${H}" fill="url(#th-kanok)"/>
    <rect x="4" y="4" width="112" height="142" fill="none" stroke="url(#th-gold)" stroke-width="2"/>
    <path d="${SHOULDERS}" fill="${c}" stroke="url(#th-gold)" stroke-width="1.600"/>
    <path d="M30 150c6-20 20-32 44-36l8 4c-18 6-30 16-36 32z" fill="url(#th-gold)"/>
    <path d="M42 117c6 7 30 7 36 0" fill="none" stroke="url(#th-gold)" stroke-width="4"/>
    <path d="${NECK}" fill="${d}" stroke="${a}" stroke-width="1"/>
    <path d="M38 74c0-17 9-28 22-28s22 11 22 28c0 16-10 30-22 30S38 90 38 74z" fill="${d}" stroke="${a}" stroke-width="1.400"/>
    <path d="M36 62c2-10 10-16 24-16s22 6 24 16c-8-4-16-5-24-5s-16 1-24 5z" fill="url(#th-gold)"/>
    <path d="M46 47c2-9 6-14 9-17 1-8 3-14 5-20 2 6 4 12 5 20 3 3 7 8 9 17z" fill="url(#th-gold)" stroke="${b}" stroke-width=".8"/>
    <path d="M50 38h20M53 30h14" stroke="${b}" stroke-width="1"/>
    <path d="M34 66c-4 2-5 8-2 13l4-3zM86 66c4 2 5 8 2 13l-4-3z" fill="url(#th-gold)"/>
    <path d="M44 73c4-3 9-3 12-1M64 72c3-2 8-2 12 1" stroke="#2B1608" stroke-width="1.600" fill="none" stroke-linecap="round"/>
    <path d="M46 78c3-2 6-2 9 0M65 78c3-2 6-2 9 0" stroke="#2B1608" stroke-width="1.300" fill="none" stroke-linecap="round"/>
    <path d="M55 91c2-2 3-2 5 0 2-2 3-2 5 0-3 3-7 3-10 0z" fill="${b}"/>
  </svg>`,

  'thai-retro': ([a, b, c, d]) => `${open()}
    <defs><pattern id="tr-dots" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.500" cy="2.500" r="1.200" fill="${c}" opacity=".55"/></pattern></defs>
    <rect width="${W}" height="${H}" fill="${d}"/>
    <path d="M0 0h120v92H0z" fill="url(#tr-dots)"/>
    <circle cx="86" cy="30" r="20" fill="${b}"/><circle cx="88" cy="32" r="20" fill="none" stroke="#17120E" stroke-width="2"/>
    <path d="M10 14c6-3 9 2 6 6-3 5 3 8 5 3M16 34c-7 3-2 11 3 7" stroke="#17120E" stroke-width="1.800" fill="none" stroke-linecap="round"/>
    <g transform="translate(3 2)" fill="${a}" opacity=".85"><path d="${SHOULDERS}"/><path d="M33 68c0-21 12-34 27-34s27 13 27 34c0 22-12 38-27 38S33 90 33 68z"/></g>
    <path d="${SHOULDERS}" fill="${c}" stroke="#17120E" stroke-width="3.200" stroke-linejoin="round"/>
    <path d="M30 128l8 22M90 128l-8 22M52 122l-4 28M68 122l4 28" stroke="#17120E" stroke-width="1.400"/>
    <path d="${NECK}" fill="#EBD9A8" stroke="#17120E" stroke-width="2.800"/>
    <path d="M33 68c0-21 12-34 27-34s27 13 27 34c0 22-12 38-27 38S33 90 33 68z" fill="#F2E3B6" stroke="#17120E" stroke-width="3.200"/>
    <path d="M31 62c-3-22 9-36 28-37 20-1 33 14 30 36-5-9-10-15-16-18l-4 7-6-9-6 9-7-8c-8 4-14 11-19 20z" fill="#17120E"/>
    <ellipse cx="48" cy="72" rx="8" ry="9.500" fill="#FFF" stroke="#17120E" stroke-width="2.200"/><ellipse cx="72" cy="72" rx="8" ry="9.500" fill="#FFF" stroke="#17120E" stroke-width="2.200"/>
    <circle cx="48" cy="73" r="2.200" fill="#17120E"/><circle cx="72" cy="73" r="2.200" fill="#17120E"/>
    <path d="M38 58l10 3M82 58l-10 3" stroke="#17120E" stroke-width="2.600" stroke-linecap="round"/>
    <ellipse cx="60" cy="93" rx="6.500" ry="7.500" fill="#17120E"/><path d="M56 97c2-2 6-2 8 0" stroke="${a}" stroke-width="2.200" fill="none"/>
    <path d="M36 80l-3 7M86 78l3 8M90 68l4 2" stroke="#17120E" stroke-width="1.600" stroke-linecap="round"/>
  </svg>`,

  anime: ([a, b, c, d]) => `${open()}
    <defs>
      <linearGradient id="an-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${d}"/><stop offset=".65" stop-color="${a}"/><stop offset="1" stop-color="#BFE3FF"/></linearGradient>
      <linearGradient id="an-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="#9A0044"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#an-sky)"/>
    <path d="M70 0l50 0 0 60zM20 0h18L96 150H70z" fill="#FFF" opacity=".12"/>
    <g fill="#FFF" opacity=".9"><path d="M-4 104c4-12 16-14 22-6 4-10 18-10 22 0 8-2 12 6 8 12H-4z"/><path d="M84 96c4-10 14-12 20-5 5-7 15-5 18 3v8H84z" opacity=".8"/></g>
    <path d="${SHOULDERS}" fill="#F7F9FF" stroke="#1A1E3A" stroke-width="1.600"/>
    <path d="M40 116l20 18 20-18" fill="${d}" stroke="#1A1E3A" stroke-width="1.600" stroke-linejoin="round"/>
    <path d="M56 130l4 12 4-12z" fill="${c}" stroke="#1A1E3A" stroke-width="1"/>
    <path d="${NECK}" fill="#FAD9C3" stroke="#1A1E3A" stroke-width="1.200"/>
    <path d="M37 68c0-19 10-31 23-31s23 12 23 31c0 12-8 24-14 31-5 5-13 5-18 0-6-7-14-19-14-31z" fill="#FFE8D8" stroke="#1A1E3A" stroke-width="1.600"/>
    <path d="M30 76c-8-30 6-52 30-52 25 0 38 22 30 52l-8-20-6 12-8-18-8 16-8-16-6 14-6-10z" fill="url(#an-hair)" stroke="#1A1E3A" stroke-width="1.600" stroke-linejoin="round"/>
    <path d="M52 22l6-14 6 12 10-8-2 16z" fill="url(#an-hair)" stroke="#1A1E3A" stroke-width="1.600" stroke-linejoin="round"/>
    <g><ellipse cx="49" cy="76" rx="6" ry="8" fill="#FFF" stroke="#1A1E3A" stroke-width="1.400"/><ellipse cx="71" cy="76" rx="6" ry="8" fill="#FFF" stroke="#1A1E3A" stroke-width="1.400"/>
      <ellipse cx="49.500" cy="77.500" rx="4" ry="6" fill="${a}"/><ellipse cx="70.500" cy="77.500" rx="4" ry="6" fill="${a}"/><circle cx="49.500" cy="79" r="2" fill="#0B132B"/><circle cx="70.500" cy="79" r="2" fill="#0B132B"/><circle cx="51" cy="74" r="1.600" fill="#FFF"/><circle cx="72" cy="74" r="1.600" fill="#FFF"/></g>
    <path d="M56 93c3 2 5 2 8 0" stroke="#1A1E3A" stroke-width="1.500" fill="none" stroke-linecap="round"/>
    <path d="M98 22l2.500 7 7 2.500-7 2.500-2.500 7-2.500-7-7-2.500 7-2.500z" fill="${c}"/>
  </svg>`,
};

const FALLBACK_SWATCH = ['#F3C253', '#E5484D', '#7C5CFF', '#101733'];

/** SVG thumbnail for an art style (falls back to colour bands for styles added later). */
export function styleThumb(style) {
  const sw = [0, 1, 2, 3].map((i) => col(style?.swatch?.[i], FALLBACK_SWATCH[i]));
  const draw = THUMBS[style?.id];
  if (draw) return draw(sw);
  return `${open()}<rect width="${W}" height="${H}" fill="${sw[3]}"/><circle cx="84" cy="36" r="22" fill="${sw[0]}"/><path d="M0 98l40-34 30 22 50-40v104H0z" fill="${sw[1]}"/><path d="M0 122l44-26 34 16 42-22v60H0z" fill="${sw[2]}"/></svg>`;
}
