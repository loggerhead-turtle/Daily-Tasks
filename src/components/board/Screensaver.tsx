"use client";

import { useState } from "react";
import { Clock } from "./bits";

// Van Gogh's "The Starry Night" (public domain). Shown from Wikimedia on the
// Pi (its host is allowlisted by the kiosk setup). If it can't load, the SVG
// scene below stands in so the board still shows a starry night.
const STARRY_NIGHT_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1920px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg";

// The stars of the painting, roughly placed for the fallback scene.
const STARS = [
  { x: 210, y: 300, r: 9 },
  { x: 330, y: 210, r: 7 },
  { x: 480, y: 330, r: 8 },
  { x: 640, y: 250, r: 7 },
  { x: 760, y: 360, r: 6 },
  { x: 900, y: 240, r: 8 },
  { x: 1040, y: 330, r: 7 },
  { x: 1180, y: 250, r: 9 },
  { x: 250, y: 470, r: 6 },
  { x: 560, y: 520, r: 6 },
  { x: 1120, y: 480, r: 7 },
];

function StarryNightScene() {
  return (
    <svg
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="sn-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1e42" />
          <stop offset="45%" stopColor="#123a6b" />
          <stop offset="100%" stopColor="#0a1730" />
        </linearGradient>
        <radialGradient id="sn-star" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe680" stopOpacity="1" />
          <stop offset="35%" stopColor="#ffd24d" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffd24d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sn-moon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="60%" stopColor="#f4b942" />
          <stop offset="100%" stopColor="#f4b942" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1600" height="1000" fill="url(#sn-sky)" />

      {/* Swirling sky strokes */}
      <g fill="none" stroke="#6aa0c8" strokeOpacity="0.35" strokeWidth="10" strokeLinecap="round">
        <path d="M420 360 C 560 240, 780 240, 820 360 C 860 480, 620 500, 560 400" />
        <path d="M980 300 C 1120 200, 1300 220, 1320 340 C 1340 460, 1120 470, 1080 380" />
        <path d="M120 560 C 360 500, 700 560, 1040 520 C 1320 490, 1500 540, 1580 520" strokeOpacity="0.2" />
      </g>

      {/* Moon */}
      <circle cx="1400" cy="200" r="150" fill="url(#sn-moon)" />
      <circle cx="1400" cy="200" r="70" fill="#ffe9a8" />

      {/* Stars */}
      {STARS.map((s, i) => (
        <g key={i} className="sn-twinkle" style={{ animationDelay: `${(i % 5) * 0.6}s` }}>
          <circle cx={s.x} cy={s.y} r={s.r * 6} fill="url(#sn-star)" />
          <circle cx={s.x} cy={s.y} r={s.r} fill="#fff3c4" />
        </g>
      ))}

      {/* Hills */}
      <path d="M0 760 C 300 700, 700 800, 1100 740 C 1350 700, 1500 760, 1600 730 L1600 1000 L0 1000 Z" fill="#0a1830" />
      {/* Village */}
      <g fill="#08111f">
        <rect x="640" y="800" width="70" height="70" />
        <rect x="720" y="820" width="60" height="50" />
        <rect x="560" y="820" width="60" height="50" />
        <path d="M840 810 L870 750 L900 810 Z" />
        <rect x="852" y="810" width="36" height="90" />
      </g>
      <g fill="#ffdf7e" opacity="0.9">
        <rect x="660" y="825" width="12" height="16" />
        <rect x="738" y="838" width="10" height="12" />
        <rect x="578" y="838" width="10" height="12" />
      </g>

      {/* Cypress */}
      <path
        d="M230 1000 C 150 820, 220 700, 200 560 C 260 700, 340 820, 300 1000 Z"
        fill="#05130f"
      />
    </svg>
  );
}

// Idle mode: Starry Night with the clock on top. Any touch wakes it.
export function Screensaver() {
  const [imgOk, setImgOk] = useState(true);

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[#0a1730]">
      <StarryNightScene />
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={STARRY_NIGHT_URL}
          alt="Van Gogh — The Starry Night"
          draggable={false}
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Legibility scrim + clock overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-3xl bg-black/25 px-10 py-6 text-center text-white backdrop-blur-sm [&_*]:!text-white [&_.text-slate-400]:!text-white/70 [&_.text-slate-500]:!text-white/80">
          <Clock big />
        </div>
      </div>
    </div>
  );
}
