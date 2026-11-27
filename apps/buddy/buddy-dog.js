/* Бадди — щенок английского бульдога. Векторный, с настроениями и нарядами.
   buddySVG({ mood: "happy" | "cheer" | "oops" | "think" | "sleep", outfit: null | "tophat" | "cap" | "crown" | "scarf" | "bow" }) */
(function () {
  const FUR = "#f2b06a", FUR_D = "#d98a45", FUR_DD = "#b96a2c", WHITE = "#fff7ec", WHITE_S = "#f3e2cc", INK = "#2f1f14";

  function eyes(mood) {
    if (mood === "cheer") return `
      <path d="M54 88 q12 -14 24 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
      <path d="M122 88 q12 -14 24 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    if (mood === "sleep") return `
      <path d="M54 88 q12 9 24 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <path d="M122 88 q12 9 24 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    const look = mood === "think" ? -4 : 0, lx = mood === "think" ? 3 : 0;
    return `<g class="bd-eyes">
      <ellipse cx="66" cy="86" rx="14" ry="15" fill="${INK}"/>
      <ellipse cx="134" cy="86" rx="14" ry="15" fill="${INK}"/>
      <circle cx="${71 + lx}" cy="${80 + look}" r="5.5" fill="#fff"/><circle cx="${139 + lx}" cy="${80 + look}" r="5.5" fill="#fff"/>
      <circle cx="${62 + lx}" cy="${92 + look}" r="2.4" fill="#fff" opacity=".9"/><circle cx="${130 + lx}" cy="${92 + look}" r="2.4" fill="#fff" opacity=".9"/>
    </g>
    ${mood === "oops" ? `<path d="M54 68 q14 -8 26 -2" fill="none" stroke="${FUR_DD}" stroke-width="4" stroke-linecap="round"/><path d="M146 68 q-14 -8 -26 -2" fill="none" stroke="${FUR_DD}" stroke-width="4" stroke-linecap="round"/>` : ""}`;
  }
  function mouth(mood) {
    if (mood === "oops") return `<ellipse cx="100" cy="132" rx="6" ry="7" fill="#7a2f2a"/>`;
    if (mood === "sleep") return `<path d="M92 128 q8 5 16 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    const big = mood === "cheer";
    return `<path d="M100 117 v8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <path d="M84 124 q8 ${big ? 12 : 8} 16 0 q8 ${big ? 12 : 8} 16 0" fill="${big ? "#7a2f2a" : "none"}" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="bd-tongue" d="M93 ${big ? 131 : 128} q7 ${big ? 18 : 12} 14 0 z" fill="#ff7b8f" stroke="#e0546c" stroke-width="1.5"/>
      ${big ? "" : `<path d="M86 136 q14 7 28 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><path d="M89 136 l2.5 -5 l2.5 5z M106 136 l2.5 -5 l2.5 5z" fill="#fff" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`}`;
  }
  function outfitBack(o) {
    if (o === "scarf") return `<path d="M58 146 q42 22 84 0 l4 14 q-46 24 -92 0z" fill="#e8434f"/><path d="M66 150 l6 16 M84 155 l3 17 M104 156 l0 17 M124 153 l-3 17" stroke="#fff" stroke-width="5"/>`;
    return "";
  }
  function outfitFront(o) {
    switch (o) {
      case "tophat": return `<g transform="translate(0,-4)"><ellipse cx="100" cy="40" rx="44" ry="9" fill="#26222e"/><rect x="72" y="0" width="56" height="40" rx="6" fill="#2f2a3a"/><rect x="72" y="26" width="56" height="9" fill="#e8434f"/><rect x="78" y="4" width="8" height="20" rx="4" fill="#fff" opacity=".18"/></g>`;
      case "cap": return `<g><path d="M48 52 q52 -52 104 0 z" fill="#3a6df0"/><path d="M140 50 q30 2 40 12 q-20 4 -44 -2z" fill="#2b54c7"/><circle cx="100" cy="14" r="5" fill="#fff"/><path d="M94 36 l6 -13 l6 13 l-14 -8 h16z" fill="#fff" opacity=".95"/></g>`;
      case "crown": return `<g><path d="M66 46 l8 -28 l14 18 l12 -24 l12 24 l14 -18 l8 28z" fill="#ffc83d" stroke="#e09b14" stroke-width="2" stroke-linejoin="round"/><circle cx="100" cy="36" r="4" fill="#e8434f"/><circle cx="80" cy="40" r="3" fill="#4fb3ff"/><circle cx="120" cy="40" r="3" fill="#3ccf91"/></g>`;
      case "bow": return `<g transform="translate(150,40) rotate(18)"><path d="M0 0 l-20 -12 v24z M0 0 l20 -12 v24z" fill="#ff6fa3" stroke="#e04884" stroke-width="2" stroke-linejoin="round"/><circle r="6" fill="#ff8fb8" stroke="#e04884" stroke-width="2"/></g>`;
      default: return "";
    }
  }

  window.buddySVG = function ({ mood = "happy", outfit = null, cls = "" } = {}) {
    return `<svg class="buddy ${cls} bd-${mood}" viewBox="0 0 200 210" role="img" aria-label="Бадди — щенок бульдога">
  <defs>
    <radialGradient id="bdHead" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#ffc98d"/><stop offset=".6" stop-color="${FUR}"/><stop offset="1" stop-color="${FUR_D}"/></radialGradient>
    <radialGradient id="bdWhite" cx="45%" cy="30%" r="75%"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="${WHITE_S}"/></radialGradient>
    <radialGradient id="bdNose" cx="40%" cy="30%" r="70%"><stop offset="0" stop-color="#6b4a36"/><stop offset="1" stop-color="${INK}"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="203" rx="58" ry="6" fill="#7a4a1f" opacity=".14"/>
  <g class="bd-body">
    <path class="bd-tail" d="M146 168 q20 -6 18 -22 q-2 -6 -8 -2 q0 12 -14 14z" fill="${FUR_D}"/>
    <ellipse cx="100" cy="166" rx="62" ry="38" fill="url(#bdHead)"/>
    <ellipse cx="100" cy="172" rx="30" ry="30" fill="url(#bdWhite)"/>
    <ellipse cx="72" cy="198" rx="17" ry="9" fill="url(#bdWhite)"/><ellipse cx="128" cy="198" rx="17" ry="9" fill="url(#bdWhite)"/>
    <path d="M65 196 v5 M72 196 v6 M79 196 v5 M121 196 v5 M128 196 v6 M135 196 v5" stroke="${WHITE_S}" stroke-width="2" stroke-linecap="round"/>
  </g>
  ${outfitBack(outfit)}
  <g class="bd-head">
    <path class="bd-ear-l" d="M40 50 q-24 -2 -22 24 q14 6 30 -10 z" fill="${FUR_DD}"/><path d="M36 56 q-10 2 -10 14" stroke="#9c5420" stroke-width="2" fill="none" opacity=".5"/>
    <path class="bd-ear-r" d="M160 50 q24 -2 22 24 q-14 6 -30 -10 z" fill="${FUR_DD}"/><path d="M164 56 q10 2 10 14" stroke="#9c5420" stroke-width="2" fill="none" opacity=".5"/>
    <path d="M100 38 C160 38 182 66 180 104 C178 142 146 160 100 160 C54 160 22 142 20 104 C18 66 40 38 100 38z" fill="url(#bdHead)"/>
    <path d="M100 48 C94 48 93 70 90 84 C74 92 58 106 58 124 C58 146 80 156 100 156 C120 156 142 146 142 124 C142 106 126 92 110 84 C107 70 106 48 100 48z" fill="url(#bdWhite)"/>
    <path d="M86 64 q14 -6 28 0" fill="none" stroke="${FUR_D}" stroke-width="3" stroke-linecap="round" opacity=".45"/>
    <ellipse cx="46" cy="112" rx="11" ry="7" fill="#ff8aa0" opacity=".45"/><ellipse cx="154" cy="112" rx="11" ry="7" fill="#ff8aa0" opacity=".45"/>
    ${eyes(mood)}
    <ellipse cx="80" cy="127" rx="26" ry="19" fill="url(#bdWhite)"/><ellipse cx="120" cy="127" rx="26" ry="19" fill="url(#bdWhite)"/><path d="M58 132 q4 12 16 16 M142 132 q-4 12 -16 16" stroke="${WHITE_S}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="72" cy="124" r="1.7" fill="${FUR_DD}" opacity=".55"/><circle cx="80" cy="130" r="1.7" fill="${FUR_DD}" opacity=".55"/><circle cx="70" cy="133" r="1.7" fill="${FUR_DD}" opacity=".55"/><circle cx="128" cy="124" r="1.7" fill="${FUR_DD}" opacity=".55"/><circle cx="120" cy="130" r="1.7" fill="${FUR_DD}" opacity=".55"/><circle cx="130" cy="133" r="1.7" fill="${FUR_DD}" opacity=".55"/>
    ${mouth(mood)}
    <path d="M90 92 q4 -3 8 0 M102 92 q4 -3 8 0" fill="none" stroke="${FUR_D}" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>
    <path d="M80 104 q20 -12 40 0 q2 12 -20 16 q-22 -4 -20 -16z" fill="url(#bdNose)"/>
    <ellipse cx="92" cy="104" rx="6" ry="2.8" fill="#fff" opacity=".55"/><ellipse cx="94" cy="110" rx="2.4" ry="1.6" fill="#1a110b"/><ellipse cx="106" cy="110" rx="2.4" ry="1.6" fill="#1a110b"/>
    ${outfitFront(outfit)}
  </g>
  ${outfit === "scarf" ? "" : `<g class="bd-collar">
    <path d="M60 148 q40 18 80 0 l2 8 q-42 20 -84 0z" fill="#e8434f"/>
    <circle cx="100" cy="166" r="8" fill="#ffc83d" stroke="#e09b14" stroke-width="2"/><path d="M96 166 h8 M100 162 v8" stroke="#e09b14" stroke-width="2"/>
  </g>`}
  ${mood === "sleep" ? `<text x="150" y="40" font-family="Nunito,sans-serif" font-weight="900" font-size="22" fill="#4fb3ff">z</text><text x="166" y="24" font-family="Nunito,sans-serif" font-weight="900" font-size="15" fill="#4fb3ff">z</text>` : ""}
</svg>`;
  };
})();
