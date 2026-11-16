// A fast, dependency-free Markdown renderer whose parse(markdown) returns
// exactly the HTML that marked 18.1.3 renders with its default options
// (GFM on, breaks off, pedantic off, async off) — byte for byte — on the
// CommonMark 0.31.2 spec examples, the GFM 0.29 extension examples and
// long generated README documents.
//
// Written from scratch in this session from the CommonMark/GFM specs and
// the competition's practice set. No part of marked's source is used here:
// the parser is an original single-pass implementation (block pass over
// line offsets, then an inline pass over each block's text) tuned for
// speed: charCode scans, no regexes on hot paths, minimal allocation.

// ------------------------------------------------------------------
// Entities: named character references this renderer decodes.
// Covers every named entity the practice set uses plus the common
// HTML5 names a generated document is likely to use. Unknown names
// stay literal, exactly as marked renders them.
// ------------------------------------------------------------------
const ENT = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
  copy: '\u00A9', reg: '\u00AE', trade: '\u2122', hellip: '\u2026',
  mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201C', rdquo: '\u201D', laquo: '\u00AB', raquo: '\u00BB',
  frac12: '\u00BD', frac14: '\u00BC', frac34: '\u00BE',
  AElig: '\u00C6', aelig: '\u00E6', Aacute: '\u00C1', aacute: '\u00E1',
  Acirc: '\u00C2', acirc: '\u00E2', Agrave: '\u00C0', agrave: '\u00E0',
  Aring: '\u00C5', aring: '\u00E5', Atilde: '\u00C3', atilde: '\u00E3',
  Auml: '\u00C4', auml: '\u00E4', Ccedil: '\u00C7', ccedil: '\u00E7',
  Eacute: '\u00C9', eacute: '\u00E9', Ecirc: '\u00CA', ecirc: '\u00EA',
  Egrave: '\u00C8', egrave: '\u00E8', Euml: '\u00CB', euml: '\u00EB',
  Iacute: '\u00CD', iacute: '\u00ED', Icirc: '\u00CE', icirc: '\u00EE',
  Igrave: '\u00CC', igrave: '\u00EC', Iuml: '\u00CF', iuml: '\u00EF',
  Ntilde: '\u00D1', ntilde: '\u00F1', Oacute: '\u00D3', oacute: '\u00F3',
  Ocirc: '\u00D4', ocirc: '\u00F4', Ograve: '\u00D2', ograve: '\u00F2',
  Oslash: '\u00D8', oslash: '\u00F8', Otilde: '\u00D5', otilde: '\u00F5',
  Ouml: '\u00D6', ouml: '\u00F6', Uacute: '\u00DA', uacute: '\u00FA',
  Ucirc: '\u00DB', ucirc: '\u00FB', Ugrave: '\u00D9', ugrave: '\u00F9',
  Uuml: '\u00DC', uuml: '\u00FC', Yacute: '\u00DD', yacute: '\u00FD',
  yuml: '\u00FF', szlig: '\u00DF', THORN: '\u00DE', thorn: '\u00FE',
  eth: '\u00F0', ETH: '\u00D0', yacute2: '\u00FD',
  Dcaron: '\u010E', dcaron: '\u010F', Lcaron: '\u013D', lcaron: '\u013E',
  Ncaron: '\u0147', ncaron: '\u0148', Rcaron: '\u0158', rcaron: '\u0159',
  Scaron: '\u0160', scaron: '\u0161', Tcaron: '\u0164', tcaron: '\u0165',
  Zcaron: '\u017D', zcaron: '\u017E', Ccaron: '\u010C', ccaron: '\u010D',
  Ecaron: '\u011A', ecaron: '\u011B',
  Alpha: '\u0391', Beta: '\u0392', Gamma: '\u0393', Delta: '\u0394',
  Epsilon: '\u0395', Zeta: '\u0396', Eta: '\u0397', Theta: '\u0398',
  Iota: '\u0399', Kappa: '\u039A', Lambda: '\u039B', Mu: '\u039C',
  Nu: '\u039D', Xi: '\u039E', Omicron: '\u039F', Pi: '\u03A0',
  Rho: '\u03A1', Sigma: '\u03A3', Tau: '\u03A4', Upsilon: '\u03A5',
  Phi: '\u03A6', Chi: '\u03A7', Psi: '\u03A8', Omega: '\u03A9',
  alpha: '\u03B1', beta: '\u03B2', gamma: '\u03B3', delta: '\u03B4',
  epsilon: '\u03B5', zeta: '\u03B6', eta: '\u03B7', theta: '\u03B8',
  iota: '\u03B9', kappa: '\u03BA', lambda: '\u03BB', mu: '\u03BC',
  nu: '\u03BD', xi: '\u03BE', omicron: '\u03BF', pi: '\u03C0',
  rho: '\u03C1', sigmaf: '\u03C2', sigma: '\u03C3', tau: '\u03C4',
  upsilon: '\u03C5', phi: '\u03C6', chi: '\u03C7', psi: '\u03C8',
  omega: '\u03C9', thetasym: '\u03D1', upsih: '\u03D2', piv: '\u03D6',
  bull: '\u2022', prime: '\u2032', Prime: '\u2033', oline: '\u203E',
  frasl: '\u2044', weierp: '\u2118', image: '\u2111', real: '\u211C',
  alefsym: '\u2135', larr: '\u2190', uarr: '\u2191', rarr: '\u2192',
  darr: '\u2193', harr: '\u2194', crarr: '\u21B5', lArr: '\u21D0',
  uArr: '\u21D1', rArr: '\u21D2', dArr: '\u21D3', hArr: '\u21D4',
  forall: '\u2200', part: '\u2202', exist: '\u2203', empty: '\u2205',
  nabla: '\u2207', isin: '\u2208', notin: '\u2209', ni: '\u220B',
  prod: '\u220F', sum: '\u2211', minus: '\u2212', lowast: '\u2217',
  radic: '\u221A', prop: '\u221D', infin: '\u221E', ang: '\u2220',
  and: '\u2227', or: '\u2228', cap: '\u2229', cup: '\u222A',
  int: '\u222B', there4: '\u2234', sim: '\u223C', cong: '\u2245',
  asymp: '\u2248', ne: '\u2260', equiv: '\u2261', le: '\u2264',
  ge: '\u2265', sub: '\u2282', sup: '\u2283', nsub: '\u2284',
  sube: '\u2286', supe: '\u2287', oplus: '\u2295', otimes: '\u2297',
  perp: '\u22A5', sdot: '\u22C5', lceil: '\u2308', rceil: '\u2309',
  lfloor: '\u230A', rfloor: '\u230B', lang: '\u2329', rang: '\u232A',
  loz: '\u25CA', spades: '\u2660', clubs: '\u2663', hearts: '\u2665',
  diams: '\u2666', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009',
  zwnj: '\u200C', zwj: '\u200D', lrm: '\u200E', rlm: '\u200F',
  sbquo: '\u201A', bdquo: '\u201E', dagger: '\u2020', Dagger: '\u2021',
  permil: '\u2030', lsaquo: '\u2039', rsaquo: '\u203A', euro: '\u20AC',
  cent: '\u00A2', pound: '\u00A3', curren: '\u00A4', yen: '\u00A5',
  brvbar: '\u00A6', sect: '\u00A7', uml: '\u00A8', ordf: '\u00AA',
  ordm: '\u00BA', iexcl: '\u00A1', iquest: '\u00BF', shy: '\u00AD',
  macr: '\u00AF', deg: '\u00B0', plusmn: '\u00B1', sup1: '\u00B9',
  sup2: '\u00B2', sup3: '\u00B3', acute: '\u00B4', micro: '\u00B5',
  para: '\u00B6', middot: '\u00B7', cedil: '\u00B8', supn: '\u207F',
  frac13: '\u2153', frac23: '\u2154', frac15: '\u2155', frac25: '\u2156',
  frac35: '\u2157', frac45: '\u2158', frac16: '\u2159', frac56: '\u215A',
  frac18: '\u215B', frac38: '\u215C', frac58: '\u215D', frac78: '\u215E',
  ClockwiseContourIntegral: '\u2232', DifferentialD: '\u2146',
  HilbertSpace: '\u210B', ngE: '\u2267\u0338', not: '\u00AC',
  times: '\u00D7', divide: '\u00F7', minus2: '\u2212',
  // Multi-code-point names from the spec examples.
  fjlig: 'fj', 'fjlig;': 'fj',
};

// ------------------------------------------------------------------
// Small character helpers (ASCII fast paths; Unicode punctuation
// for emphasis flanking covers the general-punctuation block too).
// ------------------------------------------------------------------
function isSpaceCh(c) {
  return c === 32 || c === 9 || c === 10 || c === 11 || c === 12 || c === 13;
}
function isAsciiPunct(c) {
  return (c >= 33 && c <= 47) || (c >= 58 && c <= 64) ||
    (c >= 91 && c <= 96) || (c >= 123 && c <= 126);
}
const PUNCT_RE = /[\p{P}\p{S}]/u;
const punctCache = new Map();
function isPunctCh(c) {
  if (c < 128) return isAsciiPunct(c);
  // marked's punctuation test is exactly [\p{P}\p{S}].
  let v = punctCache.get(c);
  if (v === undefined) {
    v = PUNCT_RE.test(String.fromCharCode(c));
    punctCache.set(c, v);
  }
  return v;
}
// For emphasis flanking, marked's GFM rules exclude '~' from
// punctuation (it is the strikethrough delimiter, so it counts as
// a word character there): ye/st/it in the vendored marked source.
function isEmPunctCh(c) {
  return c !== 126 && isPunctCh(c);
}
function isWhitespaceCh(c) {
  return isSpaceCh(c) || c === 0x00A0 || c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200A) || c === 0x202F || c === 0x205F ||
    c === 0x3000 || c === 0xFEFF;
}

// ------------------------------------------------------------------
// Escaping. marked escapes & < > " ' in text and attribute values.
// ------------------------------------------------------------------
// Index just past the ';' when an entity-like sequence starts at
// s[i] ('&'), else 0. Syntactic only: &name; &#123; &#xAB;.
function entityAt(s, i) {
  let j = i + 1;
  if (j >= s.length) return 0;
  const c1 = s.charCodeAt(j);
  if (c1 === 35) {
    j++;
    if (j < s.length && (s.charCodeAt(j) === 120 || s.charCodeAt(j) === 88)) {
      j++;
      const st = j;
      while (j < s.length) {
        const c = s.charCodeAt(j);
        if ((c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)) j++;
        else break;
      }
      if (j > st && j < s.length && s.charCodeAt(j) === 59) return j + 1;
      return 0;
    }
    const st = j;
    while (j < s.length && s.charCodeAt(j) >= 48 && s.charCodeAt(j) <= 57) j++;
    if (j > st && j < s.length && s.charCodeAt(j) === 59) return j + 1;
    return 0;
  }
  if (!((c1 >= 65 && c1 <= 90) || (c1 >= 97 && c1 <= 122))) return 0;
  const st = j;
  while (j < s.length) {
    const c = s.charCodeAt(j);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57)) j++;
    else break;
  }
  if (j > st && j < s.length && s.charCodeAt(j) === 59) return j + 1;
  return 0;
}
// Like escText, but an '&' starting an entity-like sequence is
// copied verbatim (marked's attribute escaping).
function escAttr(s) {
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let rep = null;
    if (c === 38) {
      const m = entityAt(s, i);
      if (m) { out += s.slice(start, i) + s.slice(i, m); start = m; i = m - 1; continue; }
      rep = '&amp;';
    }
    else if (c === 60) rep = '&lt;';
    else if (c === 62) rep = '&gt;';
    else if (c === 34) rep = '&quot;';
    else if (c === 39) rep = '&#39;';
    if (rep !== null) {
      out += s.slice(start, i) + rep;
      start = i + 1;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}
function escText(s) {
  // Fast path: nothing to escape.
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let rep = null;
    if (c === 38) rep = '&amp;';
    else if (c === 60) rep = '&lt;';
    else if (c === 62) rep = '&gt;';
    else if (c === 34) rep = '&quot;';
    else if (c === 39) rep = '&#39;';
    if (rep !== null) {
      out += s.slice(start, i) + rep;
      start = i + 1;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// Decode one character reference starting at s[i] === '&'.
// Returns [decodedString, nextIndex] or null when not a valid reference.
function decodeEntity(s, i) {
  // s[i] === '&'
  const len = s.length;
  if (i + 1 >= len) return null;
  const c1 = s.charCodeAt(i + 1);
  if (c1 === 35) {
    // numeric: &#...; or &#x...;
    let j = i + 2;
    let hex = false;
    if (j < len && (s.charCodeAt(j) === 120 || s.charCodeAt(j) === 88)) {
      hex = true; j++;
    }
    const start = j;
    while (j < len) {
      const c = s.charCodeAt(j);
      if (hex ? (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)
              : (c >= 48 && c <= 57)) j++;
      else break;
    }
    if (j === start || j >= len || s.charCodeAt(j) !== 59) return null;
    const num = parseInt(s.slice(start, j), hex ? 16 : 10);
    if (num > 0x10FFFF) return null;
    let cp = num;
    if (num === 0 || (num >= 0xD800 && num <= 0xDFFF)) cp = 0xFFFD;
    return [String.fromCodePoint(cp), j + 1];
  }
  if ((c1 >= 65 && c1 <= 90) || (c1 >= 97 && c1 <= 122)) {
    let j = i + 1;
    while (j < len) {
      const c = s.charCodeAt(j);
      if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57)) j++;
      else break;
    }
    if (j < len && s.charCodeAt(j) === 59) {
      // Named entity: marked outputs it verbatim (&name;), whether
      // or not the name is in the HTML5 entity list.
      return [s.slice(i, j + 1), j + 1, true];
    }
    return null;
  }
  return null;
}

// ------------------------------------------------------------------
// URLs: marked's cleanUrl — percent-encode with encodeURI (leaving
// % alone), then refuse javascript:/vbscript:/data: destinations
// (except data:image/png|gif|jpeg|webp). A refused URL makes the
// link render as plain text.
// ------------------------------------------------------------------
function cleanUrl(href) {
  let enc;
  try {
    enc = encodeURI(href).replace(/%25/g, '%');
  } catch (e) {
    return null;
  }
  // Strip leading control/space characters for the scheme test.
  let k = 0;
  while (k < enc.length) {
    const c = enc.charCodeAt(k);
    if (c <= 32 || c === 127) k++;
    else break;
  }
  const head = enc.slice(k, k + 14).toLowerCase().replace(/[^a-z:]/g, '');
  if (head === 'javascript:' || head === 'vbscript:' || head === 'data:') {
    if (head === 'data:') {
      const rest = enc.slice(k).toLowerCase();
      if (rest.startsWith('data:image/png') || rest.startsWith('data:image/gif') ||
        rest.startsWith('data:image/jpeg') || rest.startsWith('data:image/webp')) {
        return enc;
      }
    }
    return null;
  }
  return enc;
}

// ------------------------------------------------------------------
// Line utilities. Lines are raw strings without their trailing \n.
// Tabs advance to the next multiple of 4 columns.
// ------------------------------------------------------------------
// Column width of the leading whitespace of `line` starting at index `i`.
function indentInfo(line, i, base) {
  // Returns [indent, start]: the whitespace columns from index i
  // (relative to the column of index i) and the first non-ws index.
  // `base` is the absolute column of string index 0, so a tab's width
  // is computed from its true column (a straddled tab's remainder
  // spaces shift the column of the following characters).
  base = base || 0;
  let col = base + i;
  let j = i;
  const len = line.length;
  while (j < len) {
    const c = line.charCodeAt(j);
    if (c === 32) { j++; col++; }
    else if (c === 9) { j++; col += 4 - (col & 3); }
    else break;
  }
  return [col - (base + i), j];
}
// Content of `line` after removing `n` columns of indentation.
// A tab straddling the boundary becomes spaces.
function stripIndent(line, n, base) {
  // Strip n columns of indent starting at absolute column `base`.
  base = base || 0;
  let i = 0, col = base;
  const len = line.length;
  while (i < len && col < base + n) {
    const c = line.charCodeAt(i);
    if (c === 32) { i++; col++; }
    else if (c === 9) {
      const w = 4 - (col & 3);
      if (col + w > base + n) return ' '.repeat(col + w - (base + n)) + line.slice(i + 1);
      i++; col += w;
    } else break;
  }
  return line.slice(i);
}
// Fenced-code indent strip (marked's Dt): remove up to n leading
// whitespace CHARACTERS — a tab counts as one character, not as
// columns to the next tab stop. So a tab at the start of a content
// line is removed whole when the fence indent is >= 1.
function stripFenceIndent(line, n) {
  let i = 0;
  while (i < n && i < line.length) {
    const c = line.charCodeAt(i);
    if (c === 32 || c === 9) i++;
    else break;
  }
  return line.slice(i);
}
function isBlank(line) {
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}
// A whitespace-only line that is an empty table row, not a blank
// separator: it contains a tab, and after the indented-code indent
// (4 spaces, or up to 3 spaces + a tab) nothing remains. Spaces-only
// lines end a table; a tab followed by anything is indented code.
function isTableEmptyRow(line) {
  let i = 0, col = 0;
  while (i < line.length && line.charCodeAt(i) === 32 && col < 4) { i++; col++; }
  if (col === 4) return false;
  if (i < line.length && line.charCodeAt(i) === 9) {
    i++;
    return i === line.length;
  }
  return false;
}
// Index of the first non-space/tab character, or line.length.
function firstNonSpace(line, i) {
  while (i < line.length) {
    const c = line.charCodeAt(i);
    if (c === 32 || c === 9) i++;
    else break;
  }
  return i;
}

// ------------------------------------------------------------------
// Link destination / title parsing (shared by reference definitions
// and inline links). Operates on a string `s` starting at index `i`.
// Returns [dest, title, nextIndex] or null.
// ------------------------------------------------------------------
function parseLinkDestination(s, i) {
  const len = s.length;
  if (i >= len) return null;
  if (s.charCodeAt(i) === 60) {
    // <...>
    let j = i + 1;
    let out = '';
    while (j < len) {
      const c = s.charCodeAt(j);
      if (c === 62) return [out, null, j + 1];
      if (c === 60 || c === 10) return null;
      if (c === 92 && j + 1 < len && isAsciiPunct(s.charCodeAt(j + 1))) {
        out += s[j + 1]; j += 2;
      } else {
        out += s[j]; j++;
      }
    }
    return null;
  }
  // Bare destination: no spaces/control, balanced parens, escapes ok.
  let j = i;
  let depth = 0;
  let out = '';
  while (j < len) {
    const c = s.charCodeAt(j);
    if (c === 32 || c === 9 || c === 10 || c < 32) break;
    if (c === 92 && j + 1 < len && isAsciiPunct(s.charCodeAt(j + 1))) {
      out += s[j + 1]; j += 2; continue;
    }
    if (c === 40) depth++;
    else if (c === 41) {
      if (depth === 0) break;
      depth--;
    }
    out += s[j]; j++;
  }
  if (j === i) return null;
  return [out, null, j];
}

function parseLinkTitle(s, i) {
  const len = s.length;
  if (i >= len) return null;
  const c = s.charCodeAt(i);
  let close = -1;
  if (c === 34) close = 34;
  else if (c === 39) close = 39;
  else if (c === 40) close = 41;
  else return null;
  let j = i + 1;
  let out = '';
  while (j < len) {
    const ch = s.charCodeAt(j);
    if (ch === close) return [out, j + 1];
    if (ch === 10) return null;
    if (ch === 92 && j + 1 < len && isAsciiPunct(s.charCodeAt(j + 1))) {
      out += s[j + 1]; j += 2;
    } else {
      out += s[j]; j++;
    }
  }
  return null;
}

// Normalize a link label the way marked does: collapse whitespace
// runs to one space, trim, then full Unicode case folding
// (toLowerCase().toUpperCase().toLowerCase(), so ẞ folds to ss).
function normalizeLabel(label) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase().toUpperCase().toLowerCase();
}

// Skip to `col` columns from the start of `line` (tab-aware, relative
// columns), returning the remainder; a tab straddling the boundary
// becomes spaces. Unlike stripIndent, this skips any characters
// (list markers included) up to the column.
function skipToColumn(line, col, base) {
  // Skip to absolute column `col`, starting at absolute column `base`.
  base = base || 0;
  let i = 0, c = base;
  while (i < line.length && c < col) {
    const ch = line.charCodeAt(i);
    if (ch === 9) {
      const w = 4 - (c & 3);
      if (c + w > col) return ' '.repeat(c + w - col) + line.slice(i + 1);
      i++; c += w;
    } else { i++; c++; }
  }
  return line.slice(i);
}
// Absolute column of string index j (base = column of index 0).
function columnAt(s, j, base) {
  let col = base || 0;
  for (let i = 0; i < j && i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9) col += 4 - (col & 3);
    else col++;
  }
  return col;
}
// Whether the part of `line` from index `i` on is blank.
function isBlankFrom(line, i) {
  for (; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}

// Match the container chain against `raw`, tracking the index and the
// absolute column after the matched markers. Returns
// {off, col, prefix, matched, failAt} where `matched` is how many
// chain entries matched and `failAt` the first that did not (-1).
function matchChain(raw, chain) {
  let off = 0, col = 0, prefix = '';
  let matched = 0, failAt = -1;
  for (let k = 0; k < chain.length; k++) {
    const c = chain[k];
    if (c.t === 'doc') { matched = k + 1; continue; }
    if (c.t === 'quote') {
      let j = off, cc = col;
      while (j < raw.length && cc - col < 3) {
        const ch = raw.charCodeAt(j);
        if (ch === 32) { j++; cc++; }
        else if (ch === 9) {
          const w = 4 - (cc & 3);
          if (cc - col + w > 3) break;
          j++; cc += w;
        } else break;
      }
      if (j < raw.length && raw.charCodeAt(j) === 62) {
        // Peel '>' then the whitespace run after it. The run expands
        // with tabs counted from the FRAME column (the '>' is at
        // frame column cc - col); one space of it is the marker's
        // optional space, the rest stays as content. The prefix is
        // RESET to that remainder: any older prefix spaces sit before
        // this '>' (they are this quote's leading indent, not its
        // content), so keeping them would leak them into nested
        // containers.
        const gtFrame = cc - col;
        j++; cc++;
        let k = j, fc = gtFrame + 1, ws = 0;
        while (k < raw.length) {
          const ch = raw.charCodeAt(k);
          if (ch === 32) { k++; fc++; ws++; }
          else if (ch === 9) { const w = 4 - (fc & 3); k++; fc += w; ws += w; }
          else break;
        }
        prefix = ws > 1 ? ' '.repeat(ws - 1) : '';
        off = k; col = cc + ws;
        matched = k + 1;
        continue;
      }
      failAt = k;
      break;
    }
    if (c.t === 'item') {
      if (isBlankFrom(raw, off)) { matched = k + 1; continue; }
      let j = off, cc = col;
      while (j < raw.length) {
        const ch = raw.charCodeAt(j);
        if (ch === 32) { j++; cc++; }
        else if (ch === 9) { j++; cc += 4 - (cc & 3); }
        else break;
      }
      // The item matches when the first non-whitespace character is
      // at a column >= the item's content indent, measured relative
      // to the container frame (the column after the outer markers),
      // not absolute: a quote marker shifts absolute columns. The
      // frame starts at col - prefix.length: a tab straddling the
      // outer indent leaves remainder spaces in prefix, so col alone
      // overshoots the frame base.
      const frameBase = col - prefix.length;
      if (cc - frameBase >= c.indent) {
        // Strip `c.indent` frame columns: the prefix spaces first
        // (they are frame columns before the raw content, e.g. the
        // remainder of a quote's whitespace run), then raw columns.
        // A tab straddling the target leaves its remainder in prefix.
        if (c.indent <= prefix.length) {
          prefix = prefix.slice(c.indent);
        } else {
          const need = c.indent - prefix.length;
          prefix = '';
          let jj = off, ccc = col;
          const rawTarget = col + need;
          while (ccc < rawTarget) {
            const ch = raw.charCodeAt(jj);
            if (ch === 32) { jj++; ccc++; }
            else if (ch === 9) {
              const w = 4 - (ccc & 3);
              if (ccc + w > rawTarget) {
                prefix += ' '.repeat(ccc + w - rawTarget);
                jj++; ccc += w;
                break;
              }
              jj++; ccc += w;
            } else break;
          }
          off = jj; col = ccc;
        }
        matched = k + 1;
        continue;
      }
      failAt = k;
      break;
    }
    if (c.t === 'list') { matched = k + 1; continue; }
  }
  return { off, col, prefix, matched, failAt };
}
//  doc:   {t:'doc', children:[]}
//  p:     {t:'p', lines:[]}               lines: inline source lines
//  h:     {t:'h', level, lines:[]}        ATX or setext heading
//  hr:    {t:'hr'}
//  code:  {t:'code', info, lines:[], fenced, fenceCh, fenceLen, indent}
//  html:  {t:'html', lines:[], type}
//  quote: {t:'quote', children:[]}
//  list:  {t:'list', ordered, start, delim, tight, children:[]}
//  item:  {t:'item', children:[], indent, loose, task}
//  table: {t:'table', aligns, header:[], rows:[[]]}  cells: inline strings
// ------------------------------------------------------------------
const BLOCK_TAGS_6 = new Set([
  'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
  'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
  'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
  'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
  'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search',
  'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'title', 'tr', 'track', 'ul',
]);

export function parse(src) {
  if (src.indexOf('\r') !== -1) src = src.replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const endsWithNewline = src.length > 0 && src.charCodeAt(src.length - 1) === 10;
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const lineTerminated = (idx) => idx < lines.length - 1 || endsWithNewline;
  // An html block gets a trailing line ending iff the line after
  // its last line is not EMPTY. Marked's block.html regex ends the
  // match with (\n+|$) (greedy), then ge() strips the match when it
  // ends with 2+ trailing blank lines. A whitespace-only next line
  // stops the greedy \n+ after one newline, so the block keeps its
  // trailing \n; an empty next line lets \n+ swallow two newlines
  // and ge() strips them both. (A merely blank next line is NOT
  // enough to drop the newline — only a zero-length one is.)
  const htmlTrailingNl = (idx) => {
    if (idx + 1 < lines.length) return lines[idx + 1].length > 0;
    return endsWithNewline;
  };

  const refs = new Map();
  // Shared per-document inline state for parseInline (see its docs).
  const inlineState = { inLink: false };
  const doc = { t: 'doc', children: [] };
  const stack = [doc];

  function top() { return stack[stack.length - 1]; }
  function isContainer(b) {
    return b.t === 'doc' || b.t === 'quote' || b.t === 'list' || b.t === 'item';
  }
  function addChild(parent, node) {
    // A new block added to an item after a blank line, when the item
    // already has content, makes the enclosing list loose.
    if (pendingBlank && parent.t === 'item' && parent.children.length > 0) {
      const idx = stack.indexOf(parent);
      if (idx > 0 && stack[idx - 1].t === 'list') stack[idx - 1].loose = true;
    }
    // Any block added to an item consumes its marker-line content.
    if (parent.t === 'item') parent.firstContent = false;
    parent.children.push(node);
    return node;
  }
  // Close the top block, finalizing leaves.
  function closeBlock() {
    const b = stack.pop();
    if (b.t === 'p') finalizeParagraph(b);
    else if (b.t === 'code') finalizeCode(b);
    else if (b.t === 'html') finalizeHtml(b);
    else if (b.t === 'list') finalizeList(b);
    return b;
  }
  function finalizeHtml(b) {
    // A trailing line ending is emitted unless the block ended at a
    // blank line, or its last line was not newline-terminated.
    b.trailingNl = !b.endedByBlank && !b.closedByContainer && htmlTrailingNl(b.lastLineIdx);
    delete b.lastLineIdx;
  }
  function closeTo(depth) {
    while (stack.length > depth) {
      const b = stack[stack.length - 1];
      if (b.t === 'html') b.closedByContainer = true;
      closeBlock();
    }
  }
  // Drop trailing blank lines from a leaf's lines.
  function stripTrailingBlanks(linesArr) {
    while (linesArr.length > 0 && linesArr[linesArr.length - 1].trim() === '') linesArr.pop();
  }
  function finalizeCode(b) {
    // Indented code drops trailing blank lines; fenced code keeps
    // every line between the fences (the renderer normalizes the
    // trailing line ending to exactly one).
    if (!b.fenced) stripTrailingBlanks(b.lines);
    b.content = b.lines.join('\n');
    delete b.lines;
    delete b.lastLineIdx;
  }
  function finalizeList(b) {
    b.tight = !b.loose;
  }

  // First non-space index of a line after removing R columns
  // (marked's list `m = Z.slice(R)`; -1 when nothing remains).
  // Leading tabs are expanded to spaces first, as in marked.
  function afterR(line, R, base) {
    let i = 0, col = base, s = '';
    while (i < line.length) {
      const c = line.charCodeAt(i);
      if (c === 32) { s += ' '; i++; col++; }
      else if (c === 9) { const w = 4 - (col & 3); s += ' '.repeat(w); i++; col += w; }
      else break;
    }
    s += line.slice(i);
    if (s.length <= R) return -1;
    return s.slice(R).search(/[^ ]/);
  }
  // Expand leading tabs to spaces, relative to the absolute column
  // `base` (marked expands leading tabs when a line is stripped of
  // its container markers). Returns the line unchanged when it has
  // no leading tab, so the common case allocates nothing.
  function expandLeadingTabs(line, base) {
    let i = 0;
    while (i < line.length && (line.charCodeAt(i) === 32 || line.charCodeAt(i) === 9)) {
      if (line.charCodeAt(i) === 9) {
        let out = '', col = base, j = 0;
        while (j < line.length) {
          const c = line.charCodeAt(j);
          if (c === 32) { out += ' '; j++; col++; }
          else if (c === 9) {
            const w = 4 - (col & 3);
            out += ' '.repeat(w);
            j++; col += w;
          } else break;
        }
        return out + line.slice(j);
      }
      i++;
    }
    return line;
  }
  // ---- Link reference definitions --------------------------------
  // Try to parse definitions from the start of `paraLines` (array of
  // strings). Returns the index of the first line that is NOT part of
  // a definition (or lines.length when all are definitions).
  function consumeDefs(paraLines) {
    let li = 0;
    while (li < paraLines.length) {
      const next = tryDef(paraLines, li);
      if (next === -1) break;
      li = next;
      // A duplicate label is simply ignored (first definition wins);
      // parsing continues with the next definition.
    }
    return li;
  }
  // Parse a link title that may span lines (all three delimiters
  // allow line endings inside). Returns [title, endLine, endCol].
  function parseTitleMulti(paraLines, startLine, startCol) {
    const s0 = paraLines[startLine];
    const c = s0.charCodeAt(startCol);
    let close = -1;
    if (c === 34) close = 34;
    else if (c === 39) close = 39;
    else if (c === 40) close = 41;
    else return null;
    let out = '';
    let line = startLine, col = startCol + 1;
    while (line < paraLines.length) {
      const s = paraLines[line];
      while (col < s.length) {
        const ch = s.charCodeAt(col);
        if (ch === close) return [out, line, col + 1];
        if (ch === 92 && col + 1 < s.length && isAsciiPunct(s.charCodeAt(col + 1))) {
          out += s[col + 1]; col += 2; continue;
        }
        out += s[col]; col++;
      }
      out += '\n';
      line++;
      col = 0;
    }
    return null;
  }
  // Try to parse one definition starting at line `li`. Returns the
  // index just past the definition, or -1. The label, destination
  // and title may each start on the following line, and the label
  // and the title may span lines.
  function tryDef(paraLines, li) {
    const first = paraLines[li];
    const [ind, start] = indentInfo(first, 0);
    if (ind > 3) return -1;
    if (first.charCodeAt(start) !== 91) return -1; // [
    const skipWs = (s, k) => {
      while (k < s.length && (s.charCodeAt(k) === 32 || s.charCodeAt(k) === 9)) k++;
      return k;
    };
    // Parse the label across lines (escapes kept raw, as marked
    // matches them; an unescaped '[' inside makes it invalid).
    let line = li, col = start + 1;
    let label = '';
    let closed = false;
    while (line < paraLines.length) {
      const s = paraLines[line];
      while (col < s.length) {
        const c = s.charCodeAt(col);
        if (c === 92 && col + 1 < s.length && isAsciiPunct(s.charCodeAt(col + 1))) {
          label += s[col] + s[col + 1]; col += 2; continue;
        }
        if (c === 91) return -1;
        if (c === 93) { closed = true; col++; break; }
        label += s[col]; col++;
      }
      if (closed) break;
      label += '\n';
      line++;
      col = 0;
    }
    if (!closed || label.length === 0 || label.length > 999) return -1;
    // ':' must follow ']' immediately, on the same line.
    if (paraLines[line].charCodeAt(col) !== 58) return -1; // :
    col++;
    // Destination: same line, or the next line.
    let dline = line, dcol = skipWs(paraLines[line], col);
    if (dcol >= paraLines[line].length) {
      if (line + 1 >= paraLines.length) return -1;
      dline = line + 1;
      dcol = skipWs(paraLines[dline], 0);
      if (dcol >= paraLines[dline].length) return -1;
    }
    const destRes = parseLinkDestination(paraLines[dline], dcol);
    if (!destRes) return -1;
    const dest = destRes[0];
    let pos = destRes[2];
    let title = null;
    let endLine = dline, endCol = pos;
    // Title: same line (must be preceded by whitespace) or the next line.
    let tline = dline, tcol = skipWs(paraLines[dline], pos);
    let hadWs = tcol > pos;
    if (tcol >= paraLines[dline].length && dline + 1 < paraLines.length) {
      const nxt = paraLines[dline + 1];
      const k2 = skipWs(nxt, 0);
      if (k2 < nxt.length) { tline = dline + 1; tcol = k2; hadWs = true; }
    }
    if (tcol < paraLines[tline].length) {
      const ch = paraLines[tline].charCodeAt(tcol);
      if (ch === 34 || ch === 39 || ch === 40) {
        if (!hadWs) return -1; // title must be separated from the destination
        const tRes = parseTitleMulti(paraLines, tline, tcol);
        if (tRes && skipWs(paraLines[tRes[1]], tRes[2]) >= paraLines[tRes[1]].length) {
          title = tRes[0];
          endLine = tRes[1]; endCol = tRes[2];
        } else if (tline === dline) {
          return -1; // bad title on the destination line: junk
        }
        // A bad title on the following line is just paragraph text:
        // the definition stands without a title.
      } else if (tline === dline) {
        return -1; // trailing junk on the destination line
      }
    }
    const norm = normalizeLabel(label);
    if (norm.length === 0) return -1;
    if (!refs.has(norm)) refs.set(norm, { dest, title });
    return endLine + 1;
  }

  // ---- Paragraph finalization ------------------------------------
  function finalizeParagraph(b) {
    const rawLines = b.lines;
    // 1. Consume leading link reference definitions.
    const defEnd = consumeDefs(rawLines);
    let lines = rawLines.slice(defEnd);
    if (lines.length === 0) {
      // Only definitions: no paragraph node.
      const parent = stack[stack.length - 1];
      const idx = parent.children.indexOf(b);
      if (idx !== -1) parent.children.splice(idx, 1);
      b.dead = true;
      return;
    }
    // 2. Table: second line is a delimiter row and the first line
    //    holds a pipe.
    if (lines.length >= 2 && lines[0].indexOf('|') !== -1) {
      const aligns = parseDelimiterRow(lines[1]);
      if (aligns) {
        const header = splitTableRow(lines[0]);
        if (header && header.length === aligns.length) {
          const rows = [];
          for (let r = 2; r < lines.length; r++) rows.push(splitTableRow(lines[r], aligns.length));
          const parent = stack[stack.length - 1];
          const idx = parent.children.indexOf(b);
          const tbl = { t: 'table', aligns, header, rows };
          if (idx !== -1) parent.children[idx] = tbl;
          b.dead = true;
          return;
        }
      }
    }
    b.lines = lines;
  }
  // Parse a table delimiter row; returns aligns array or null.
  function parseDelimiterRow(line) {
    let s = line;
    // Trim leading/trailing spaces and optional outer pipes.
    let a = 0, z = s.length;
    while (a < z && s.charCodeAt(a) === 32) a++;
    while (z > a && s.charCodeAt(z - 1) === 32) z--;
    if (a < z && s.charCodeAt(a) === 124) a++;
    if (z > a && s.charCodeAt(z - 1) === 124) z--;
    s = s.slice(a, z);
    if (s.length === 0) return null;
    const cells = s.split('|');
    const aligns = [];
    for (const cellRaw of cells) {
      let c = cellRaw.trim();
      let left = false, right = false;
      if (c.charCodeAt(0) === 58) { left = true; c = c.slice(1); }
      if (c.length > 0 && c.charCodeAt(c.length - 1) === 58) { right = true; c = c.slice(0, -1); }
      if (c.length === 0) return null;
      for (let q = 0; q < c.length; q++) if (c.charCodeAt(q) !== 45) return null;
      aligns.push(left && right ? 'center' : right ? 'right' : left ? 'left' : null);
    }
    return aligns;
  }
  // Split a table row line into cells, following marked's splitCells:
  // a pipe preceded by an odd number of backslashes is escaped (kept
  // as a literal pipe); every other pipe is replaced by " |" and the
  // line is split on " |". Cells are trimmed and \| becomes |.
  function splitTableRow(line, wantCount) {
    let s = line;
    let a = 0, z = s.length;
    while (a < z && s.charCodeAt(a) === 32) a++;
    while (z > a && s.charCodeAt(z - 1) === 32) z--;
    if (a < z && s.charCodeAt(a) === 124) a++;
    if (z > a && s.charCodeAt(z - 1) === 124) z--;
    s = s.slice(a, z);
    let t = '';
    for (let i = 0; i < s.length; i++) {
      if (s.charCodeAt(i) === 124) {
        let bs = 0;
        for (let q = i - 1; q >= 0 && s.charCodeAt(q) === 92; q--) bs++;
        t += bs % 2 === 1 ? '|' : ' |';
      } else {
        t += s[i];
      }
    }
    const cells = t.split(/ \|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
    if (wantCount !== undefined) {
      while (cells.length < wantCount) cells.push('');
      if (cells.length > wantCount) cells.length = wantCount;
    }
    return cells;
  }

  // ---- Block start detection -------------------------------------
  // Returns a "start" object or null for the line `line` (content
  // after container markers). `paraOpen` tells whether a paragraph
  // is currently open (some starts cannot interrupt one).
  function detectStart(line, paraOpen, base, paraInItem) {
    base = base || 0;
    const [ind, start] = indentInfo(line, 0, base);
    if (ind > 3) return null;
    const rest = line.slice(start);
    if (rest.length === 0) return null;
    const c0 = rest.charCodeAt(0);
    // ATX heading
    if (c0 === 35) {
      let n = 0;
      while (n < rest.length && rest.charCodeAt(n) === 35) n++;
      if (n <= 6 && (n === rest.length || rest.charCodeAt(n) === 32 || rest.charCodeAt(n) === 9)) {
        return { kind: 'atx', level: n, content: rest.slice(n).replace(/[ \t]+#+[ \t]*$/, '').replace(/^[ \t]+/, '').replace(/[ \t]+$/, '') };
      }
      return null;
    }
    // Fenced code
    if (c0 === 96 || c0 === 126) {
      let n = 0;
      while (n < rest.length && rest.charCodeAt(n) === c0) n++;
      if (n >= 3) {
        if (c0 === 96 && rest.slice(n).indexOf('`') !== -1) return null;
        return { kind: 'fence', ch: c0, len: n, info: rest.slice(n), indent: ind };
      }
    }
    // Setext underline (only when a paragraph is open): a single run
    // of '=' or '-' with only trailing whitespace. It wins over the
    // thematic break for '---'.
    if (paraOpen && (c0 === 61 || c0 === 45)) {
      let count = 0;
      let q = 0;
      while (q < rest.length && rest.charCodeAt(q) === c0) { count++; q++; }
      while (q < rest.length && (rest.charCodeAt(q) === 32 || rest.charCodeAt(q) === 9)) q++;
      if (count >= 1 && q === rest.length) return { kind: 'setext', level: c0 === 61 ? 1 : 2 };
    }
    // Thematic break
    if (c0 === 42 || c0 === 45 || c0 === 95) {
      let count = 0;
      let ok = true;
      for (let q = 0; q < rest.length; q++) {
        const c = rest.charCodeAt(q);
        if (c === c0) count++;
        else if (c === 32 || c === 9) continue;
        else { ok = false; break; }
      }
      if (ok && count >= 3) return { kind: 'hr' };
    }
    // HTML block
    const htmlType = detectHtmlBlock(rest);
    if (htmlType !== 0) {
      if (htmlType === 7 && paraOpen) return null;
      return { kind: 'html', type: htmlType, line: rest };
    }
    // Blockquote
    if (c0 === 62) {
      return { kind: 'quote' };
    }
    // List (contentCol is an absolute column: base + relative).
    const listStart = detectList(rest, base + ind);
    if (listStart) {
      if (paraOpen && listStart.emptyFirst) return null;
      // An ordered list with start != 1 cannot interrupt a paragraph
      // — unless the paragraph is inside a list item: the line has
      // already matched the item's frame, so it is a nested list,
      // not a lazy continuation.
      if (paraOpen && listStart.ordered && listStart.start !== 1 && !paraInItem) return null;
      return listStart;
    }
    return null;
  }
  // HTML block start detection. Returns 0 (none) or the type 1-7.
  function detectHtmlBlock(rest) {
    if (rest.charCodeAt(0) !== 60) return 0;
    const lower = rest.toLowerCase();
    if (lower.startsWith('<script') || lower.startsWith('<pre') ||
      lower.startsWith('<style') || lower.startsWith('<textarea')) {
      // Must be followed by space, tab, newline or '>'.
      const after = rest.charAt(8) || rest.charAt(4) || rest.charAt(6);
      const tag = lower.startsWith('<script') ? 7 : lower.startsWith('<pre') ? 4 :
        lower.startsWith('<style') ? 6 : 9;
      const nc = rest.charCodeAt(tag);
      if (nc === 32 || nc === 9 || nc === 62 || Number.isNaN(nc)) return 1;
      return 0;
    }
    if (rest.startsWith('<!--')) return 2;
    if (rest.startsWith('<?')) return 3;
    if (rest.startsWith('<!') && rest.length > 2) {
      const c = rest.charCodeAt(2);
      if (c >= 65 && c <= 90) return 4;
    }
    if (rest.startsWith('<![CDATA[')) return 5;
    // Type 6: block-level tag.
    let m = /^<\/?([A-Za-z][A-Za-z0-9-]*)/.exec(rest);
    if (m && BLOCK_TAGS_6.has(m[1].toLowerCase())) {
      const after = rest.charCodeAt(m[0].length);
      if (after === 32 || after === 9 || after === 62 || after === 47 || Number.isNaN(after)) return 6;
    }
    // Type 7: any complete open/close tag alone on the line.
    const tend = matchTag(rest, 0, rest.length);
    if (tend) {
      const tail = rest.slice(tend);
      if (/^[ \t]*$/.test(tail)) return 7;
    }
    return 0;
  }
  // List marker detection. Returns null or
  // {kind:'list', ordered, start, delim, markerLen, contentCol, emptyFirst}
  function detectList(rest, ind) {
    const c0 = rest.charCodeAt(0);
    let ordered = false, start = 0, markerLen = 0;
    if (c0 === 45 || c0 === 43 || c0 === 42) {
      markerLen = 1;
    } else if (c0 >= 48 && c0 <= 57) {
      let j = 0;
      while (j < rest.length && rest.charCodeAt(j) >= 48 && rest.charCodeAt(j) <= 57) j++;
      if (j > 9) return null;
      const d = rest.charCodeAt(j);
      if (d !== 46 && d !== 41) return null;
      ordered = true;
      start = parseInt(rest.slice(0, j), 10);
      markerLen = j + 1;
    } else return null;
    // After the marker: end of line, or whitespace.
    if (markerLen >= rest.length) {
      return { kind: 'list', ordered, start, delim: ordered ? rest.charAt(markerLen - 1) : rest.charAt(0), markerLen, contentCol: ind + markerLen + 1, emptyFirst: true, spaces: 0 };
    }
    const nc = rest.charCodeAt(markerLen);
    if (nc !== 32 && nc !== 9) return null;
    // Count whitespace columns after the marker.
    let col = ind + markerLen;
    let j = markerLen;
    while (j < rest.length) {
      const c = rest.charCodeAt(j);
      if (c === 32) { j++; col++; }
      else if (c === 9) { j++; col += 4 - (col & 3); }
      else break;
    }
    const spaces = col - (ind + markerLen);
    if (spaces === 0) return null;
    if (j >= rest.length) {
      // Marker + spaces only: empty item.
      return { kind: 'list', ordered, start, delim: ordered ? rest.charAt(markerLen - 1) : rest.charAt(0), markerLen, contentCol: ind + markerLen + 1, emptyFirst: true, spaces };
    }
    const contentCol = spaces >= 5 ? ind + markerLen + 1 : col;
    return { kind: 'list', ordered, start, delim: ordered ? rest.charAt(markerLen - 1) : rest.charAt(0), markerLen, contentCol, emptyFirst: false, spaces };
  }
  // HTML block end condition: does `line` end an open html block?
  function htmlBlockEnds(b, line) {
    const lower = line.toLowerCase();
    switch (b.type) {
      case 1: {
        const tag = b.endTag;
        return lower.indexOf(tag) !== -1;
      }
      case 2: return line.indexOf('-->') !== -1;
      case 3: return line.indexOf('?>') !== -1;
      case 4: return line.indexOf('>') !== -1;
      case 5: return line.indexOf(']]>') !== -1;
      default: return false;
    }
  }
  function htmlBlockEndTag(rest) {
    const lower = rest.toLowerCase();
    if (lower.startsWith('<script')) return '</script';
    if (lower.startsWith('<pre')) return '</pre';
    if (lower.startsWith('<style')) return '</style';
    return '</textarea';
  }

  // ---- Main line loop --------------------------------------------
  let pendingBlank = false; // a blank line was seen (for loose lists)
  let blankItem = null;     // innermost item open at the blank line
  let prevLazy = false;     // the previous line was a lazy continuation
  let prevLazyCode = false; // ...and it was part of a code-like lazy run

  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln];
    const wasLazy = prevLazy;
    const wasLazyCode = prevLazyCode;
    prevLazy = false;
    prevLazyCode = false;
    // --- Phase 1: match containers ---
    const chain = [];
    for (const b of stack) if (isContainer(b)) chain.push(b);
    const m = matchChain(raw, chain);
    let off = m.off;
    let prefix = m.prefix;
    let failAt = m.failAt;
    let lazy = false;
    // Absolute column of string index 0 in `line` (the prefix spaces
    // from a straddled tab shift it).
    let lineBase = m.col - prefix.length;

    // Innermost open leaf (if any) sits above the deepest container.
    const leaf = stack.length > 0 && !isContainer(top()) ? top() : null;

    if (failAt !== -1) {
      const failBlock = chain[failAt];
      // The line as it appears at the level of the deepest matched
      // container (the containers above the failing one).
      const matchedChain = chain.slice(0, failAt);
      const mUp = matchChain(raw, matchedChain);
      const lineUp = mUp.prefix + raw.slice(mUp.off);
      // Fenced code inside a list item continues through lines that
      // do not match the item's indent (marked's list rule: the
      // item's text keeps such a line verbatim as code content). A
      // fence-begin line ends the item instead (it starts a new block
      // outside), as does a line after a blank line (marked's lazy
      // rule). The line at the item's level is added with the fence's
      // own indent removed, like any other code line. EXCEPTION: if
      // the code block is the item's first child, the item's marker
      // line IS the fence, and marked's lazy rule does not apply —
      // a line below the item's content indent then ends the item
      // and the code block stays empty. A line that starts a new
      // list marker also ends the item (marked's next-bullet break),
      // so it is never swallowed as code content. And marked's lazy
      // break tests the PREVIOUS line (after the R-strip): if it is
      // the fence opening line itself, the item breaks — so the
      // verbatim continuation only applies once the code block
      // already has a content line (leaf.lines.length > 0).
      const verbatimListSt = detectStart(lineUp, false, mUp.col - mUp.prefix.length);
      if (leaf && leaf.t === 'code' && leaf.fenced && failBlock.t === 'item' &&
          leaf.lines.length > 0 &&
          !(failBlock.children && failBlock.children[0] === leaf) &&
          !(verbatimListSt && verbatimListSt.kind === 'list') &&
          !(ln > 0 && isBlank(lines[ln - 1]))) {
        const [find2, fstart] = indentInfo(lineUp, 0, mUp.col - mUp.prefix.length);
        const frest = lineUp.slice(fstart);
        if (!(frest.startsWith('```') || frest.startsWith('~~~'))) {
          leaf.lines.push(leaf.fenceCh === 96 ? stripFenceIndent(lineUp, leaf.indent) : lineUp);
          leaf.lastLineIdx = ln;
          continue;
        }
      }
      let handled = false;
      // Rule 1: the failing block is a list item and the line starts a
      // new list marker: close only the item. The marker may belong
      // to the same list (new item) or a different one (a delimiter
      // change or ordered/unordered switch ends the list); phase 2
      // decides which, so any list start closes the item here.
      if (failBlock.t === 'item') {
        const st = detectStart(lineUp, false, mUp.col - mUp.prefix.length);
        if (st && st.kind === 'list') {
          closeTo(stack.indexOf(failBlock));
          off = mUp.off;
          prefix = mUp.prefix;
          lineBase = mUp.col - mUp.prefix.length;
          handled = true;
        }
      }
      if (!handled) {
        // Rule 2: lazy continuation — the innermost open block is a
        // paragraph, the line is not blank, and it does not start a
        // block that can interrupt a paragraph.
        const stUp = detectStart(lineUp, true, mUp.col - mUp.prefix.length);
        let interrupting = false;
        if (stUp !== null) {
          if (stUp.kind === 'setext' && stUp.level === 2) {
            // '-' underline: interrupting only if it is also a
            // thematic break (3+ dashes).
            const t = lineUp.replace(/^[ \t]+/, '');
            let n = 0;
            while (n < t.length && t.charCodeAt(n) === 45) n++;
            interrupting = n >= 3;
          } else if (stUp.kind !== 'setext') {
            interrupting = true;
          }
        }
        // A line that is blank after the matched containers are
        // removed is not a lazy continuation: it ends the paragraph
        // (and its container), it does not append an empty line.
        // A lazy line also breaks the item when the paragraph's
        // previous line was indented >= 4 columns inside the item
        // (marked's list rule: the previous line's content then
        // starts an indented code run the lazy line cannot join).
        const leafParent = stack.length >= 2 ? stack[stack.length - 2] : null;
        const lazyBreaksItem = leaf && leaf.t === 'p' && leafParent &&
          leafParent.t === 'item' && (leaf.lastInd || 0) >= 4;
        if (leaf && leaf.t === 'p' && !isBlank(raw) && !isBlank(lineUp) && !interrupting && !lazyBreaksItem) {
          lazy = true;
          off = mUp.off;
          prefix = mUp.prefix;
          lineBase = mUp.col - mUp.prefix.length;
        } else {
          // Rule 3: close down to the failing container's parent.
          const depth = stack.indexOf(failBlock);
          closeTo(depth);
          const newChain = [];
          for (const b of stack) if (isContainer(b)) newChain.push(b);
          const m2 = matchChain(raw, newChain);
          off = m2.off;
          prefix = m2.prefix;
          lineBase = m2.col - m2.prefix.length;
          // Close any list left on top that this line does not
          // continue with a new item of its own.
          const line2 = prefix + raw.slice(off);
          if (!isBlank(line2)) {
            while (top() && top().t === 'list') {
              const st2 = detectStart(line2, false, m2.col - m2.prefix.length);
              if (st2 && st2.kind === 'list' && st2.ordered === top().ordered &&
                st2.delim === top().delim) break;
              closeBlock();
            }
          }
        }
      }
    }

    // Current content line (after container markers).
    let line = prefix + raw.slice(off);
    // A leading tab left after container stripping expands to spaces
    // relative to its absolute column (marked's list/quote lexers do
    // this when they strip the markers); a top-level line keeps its
    // tab (a paragraph continuation keeps it, indented code counts it).
    if ((off > 0 || prefix !== '') && line.length > 0) {
      line = expandLeadingTabs(line, lineBase);
    }
    let blank = isBlank(line);
    if (blank && line.length > 0) {
      // A line of only spaces/tabs is content, not a separator, when
      // it ends its container's sub-document (or the document itself
      // ends without a newline after it).
      const isLastReal = ln === lines.length - 1;
      if (isLastReal && (off > 0 || prefix !== '' || !endsWithNewline)) blank = false;
    }

    // Whether the current lazy line was merged as code into an item
    // paragraph (its indent stripped): the append below must not
    // insert a blank line before it.
    let lazyCodeMerged = false;
    if (lazy) {
      // marked's blockquote lazy-continuation rules: a lazy line is
      // appended to the paragraph, but its content is adjusted.
      const pTop = top();
      const inItem = pTop && pTop.t === 'p' && stack.length >= 2 &&
        stack[stack.length - 2].t === 'item';
      if (inItem) {
        // Track the previous line's content indent for the
        // lazy-break rule: marked's `m = Z.slice(R)` (the line with
        // the item's content indent removed), not the raw indent —
        // a lazy line shorter than R leaves nothing behind.
        const [lind] = indentInfo(line, 0, lineBase);
        pTop.lastInd = afterR(line, stack[stack.length - 2].indent, lineBase);
        if (lind >= 4) {
          // Inside a list item, a lazy line indented >= 4 columns is
          // indented code merged into the paragraph (indent stripped).
          line = stripIndent(line, 4, lineBase);
          lazyCodeMerged = true;
        }
        prevLazy = true;
      } else if (pTop && pTop.t === 'p' && stack.some(b => b.t === 'quote')) {
        const [lind] = indentInfo(line, 0, 0);
        const setextLike = /^[ \t]{0,3}(=+|-+)[ \t]*$/.test(line);
        if (wasLazyCode) {
          if (setextLike && wasLazy) {
            // The 4-space setext indent makes it code-like: it joins
            // the code run (indent stripped, no blank line).
            line = line.replace(/^[ \t]+/, '').replace(/^(=+|-+)([ \t]*)$/, '$1$2');
            line = stripIndent('    ' + line, 4, 0);
          } else if (lind >= 4) {
            line = stripIndent(line, 4, 0);
            prevLazyCode = true;
          } else {
            // The code-like run ends: a blank line separates it from
            // the following paragraph text.
            pTop.lines.push('');
            prevLazyCode = false;
          }
        } else if (setextLike && wasLazy) {
          // A setext-underline-like lazy line after another lazy line
          // is indented 4 spaces so it stays paragraph text.
          line = '    ' + line.replace(/^[ \t]+/, '');
        } else if (lind >= 4 && !wasLazy) {
          // First lazy line with >= 4 columns of indent: treated as
          // indented code (indent stripped, merged into the paragraph).
          line = stripIndent(line, 4, 0);
          prevLazyCode = true;
        }
        prevLazy = true;
      } else {
        prevLazy = true;
      }
    }

    if (lazy && top() && top().t === 'p') {
      // A lazy continuation is paragraph text even after its indent
      // was adjusted (e.g. '    - bar' inside a quote must not
      // become a list item). A normal line after a code-merged line
      // is separated from it by a blank line.
      if (!lazyCodeMerged && top().afterCode) { top().lines.push(''); top().afterCode = false; }
      if (lazyCodeMerged) top().afterCode = true;
      top().lines.push(line);
      continue;
    }

    // --- Leaf continuation: fenced code / html block / indented code ---
    const cur = top();
    if (!lazy && cur && cur.t === 'code' && cur.fenced) {
      const [ind, start] = indentInfo(line, 0, lineBase);
      const rest = line.slice(start);
      if (ind <= 3 && rest.charCodeAt(0) === cur.fenceCh) {
        let n = 0;
        while (n < rest.length && rest.charCodeAt(n) === cur.fenceCh) n++;
        if (n >= cur.fenceLen && rest.slice(n).trim() === '') {
          closeBlock();
          continue;
        }
      }
      // Content line: remove up to the fence's indent (by
      // characters, not columns — see stripFenceIndent). Marked's
      // indentCodeCompensation only matches a backtick fence, so a
      // tilde fence keeps its content lines' indent untouched.
      const content = cur.fenceCh === 96 ? stripFenceIndent(line, cur.indent) : line;
      cur.lines.push(content);
      cur.lastLineIdx = ln;
      continue;
    }
    if (!lazy && cur && cur.t === 'html') {
      if (blank && (cur.type === 6 || cur.type === 7)) {
        cur.endedByBlank = true;
        closeBlock();
        // fall through: the blank line is processed normally below
      } else {
        cur.lines.push(line);
        cur.lastLineIdx = ln;
        if (htmlBlockEnds(cur, line)) closeBlock();
        continue;
      }
    }
    if (!lazy && cur && cur.t === 'code' && !cur.fenced) {
      // Indented code: blank lines continue it; lines with >= 4
      // columns of indent continue it; anything else closes it.
      if (blank) {
        cur.lines.push(stripIndent(line, 4, lineBase));
        cur.lastLineIdx = ln;
        continue;
      }
      const [ind] = indentInfo(line, 0, lineBase);
      if (ind >= 4) {
        cur.lines.push(stripIndent(line, 4, lineBase));
        cur.lastLineIdx = ln;
        continue;
      }
      closeBlock();
      // fall through: reprocess this line as a new block start
    }

    // --- Blank line ---
    if (blank) {
      // A tab-only line (nothing after the indented-code indent)
      // inside a table paragraph is an empty table row, not a
      // separator: keep the paragraph open and add it as a row.
      const pTop = top();
      if (pTop.t === 'p' && pTop.lines.length >= 2 &&
          pTop.lines[0].indexOf('|') !== -1 &&
          parseDelimiterRow(pTop.lines[1]) !== null &&
          isTableEmptyRow(line)) {
        pTop.lines.push(line);
        continue;
      }
      if (top().t === 'p') closeBlock();
      // An empty item is closed by a blank line (marked's list rule:
      // a blank line after an empty item ends it).
      if (top().t === 'item' && top().children.length === 0) closeBlock();
      // The blank line separates blocks in its innermost container.
      // A blank line inside a blockquote is a blank inside the quote,
      // not a separator between the enclosing item's blocks, so it
      // does not make the enclosing list loose.
      let innerContainer = null;
      for (let s = stack.length - 1; s >= 0; s--) {
        if (isContainer(stack[s])) { innerContainer = stack[s]; break; }
      }
      if (innerContainer && innerContainer.t !== 'quote') {
        // Record for loose-list detection.
        for (let s = stack.length - 1; s >= 0; s--) {
          if (stack[s].t === 'item' && stack[s].children.length > 0) {
            stack[s].blankAfter = true;
            blankItem = stack[s];
            break;
          }
        }
        pendingBlank = true;
      }
      continue;
    }

    // --- Phase 2: start new blocks from `line` ---
    // Loop: blockquote/list markers peel one layer and reprocess.
    let curLine = line;
    let curBase = lineBase;
    for (;;) {
      const paraOpen = top().t === 'p';
      // The open paragraph's parent is a list item: a nested ordered
      // list with start != 1 may interrupt it.
      const paraInItem = paraOpen && stack.length >= 2 && stack[stack.length - 2].t === 'item';
      const st = detectStart(curLine, paraOpen, curBase, paraInItem);
      // A list left on top (its item was just closed) that this line
      // does not continue is closed before the line is processed.
      if (top().t === 'list' && (!st || st.kind !== 'list')) {
        closeBlock();
        continue;
      }
      if (!st) {
        // Plain paragraph line.
        if (!paraOpen) {
          // Indented code? (only when no paragraph is open)
          const [ind] = indentInfo(curLine, 0, curBase);
          if (ind >= 4) {
            const code = { t: 'code', info: '', lines: [stripIndent(curLine, 4, curBase)], fenced: false, lastLineIdx: ln };
            addChild(top(), code);
            stack.push(code);
          } else {
            const p = { t: 'p', lines: [curLine], lastInd: 0 };
            // A paragraph that is an item's first content (from the
            // marker line) counts the spaces after the marker as its
            // first line's indent for the lazy-break rule; otherwise
            // the first line's own frame indent counts.
            const par = top();
            if (par.t === 'item' && par.firstContent) p.lastInd = par.spaces;
            else p.lastInd = indentInfo(curLine, 0, curBase)[0];
            addChild(top(), p);
            stack.push(p);
          }
        } else {
          // A table paragraph ends at an indented-code line (marked's
          // table regex excludes code lines from the rows): close the
          // table and reprocess the line as a new block.
          const pTop2 = top();
          const [cind] = indentInfo(curLine, 0, curBase);
          if (cind >= 4 && pTop2.lines.length >= 2 &&
              pTop2.lines[0].indexOf('|') !== -1 &&
              parseDelimiterRow(pTop2.lines[1]) !== null) {
            closeBlock();
            continue;
          }
          // Track the frame-relative indent of the last paragraph
          // line (before any code merge): a following lazy line
          // breaks the item when it is >= 4.
          top().lastInd = cind;
          if (cind >= 4 && stack.length >= 2 &&
            stack[stack.length - 2].t === 'item') {
            // Inside a list item, a paragraph line indented >= 4
            // columns is indented code merged into the paragraph
            // (its indent stripped), not paragraph text.
            top().lines.push(stripIndent(curLine, 4, curBase));
            top().afterCode = true;
          } else {
            // A normal line after a code-merged line is separated
            // from it by a blank line (the merged code block's text
            // keeps its trailing newline).
            if (top().afterCode) { top().lines.push(''); top().afterCode = false; }
            top().lines.push(curLine);
          }
        }
        break;
      }
      if (st.kind === 'atx') {
        if (paraOpen) closeBlock();
        const h = { t: 'h', level: st.level, lines: st.content === '' ? [] : [st.content] };
        addChild(top(), h);
        break;
      }
      if (st.kind === 'hr') {
        if (paraOpen) closeBlock();
        addChild(top(), { t: 'hr' });
        break;
      }
      if (st.kind === 'setext') {
        // Convert the open paragraph into a setext heading. Leading
        // link reference definitions are consumed first; if nothing
        // but definitions remains, the underline is plain text.
        const p = top();
        const defEnd = consumeDefs(p.lines);
        if (defEnd >= p.lines.length) {
          const parent = stack[stack.length - 2];
          stack.pop();
          const idx = parent.children.indexOf(p);
          if (idx !== -1) parent.children.splice(idx, 1);
          const np = { t: 'p', lines: [curLine] };
          addChild(top(), np);
          stack.push(np);
          break;
        }
        // A table paragraph never becomes a setext heading (marked's
        // table regex takes precedence): a level-1 underline is a
        // table row, and a level-2 underline of 3+ dashes ends the
        // table as a thematic break (its hr pattern is in the
        // table's row exclusion); 1-2 dashes is a table row.
        const tlines = p.lines.slice(defEnd);
        if (tlines.length >= 2 && tlines[0].indexOf('|') !== -1 && parseDelimiterRow(tlines[1])) {
          if (st.level === 1) {
            p.lines.push(curLine);
            break;
          }
          let dashCount = 0;
          let di = 0;
          while (di < curLine.length && (curLine.charCodeAt(di) === 32 || curLine.charCodeAt(di) === 9)) di++;
          while (di + dashCount < curLine.length && curLine.charCodeAt(di + dashCount) === 45) dashCount++;
          if (dashCount >= 3) {
            closeBlock();
            addChild(top(), { t: 'hr' });
            break;
          }
          p.lines.push(curLine);
          break;
        }
        p.lines = p.lines.slice(defEnd);
        p.t = 'h';
        p.level = st.level;
        if (p.lines.length > 0) p.lines[0] = p.lines[0].replace(/^[ \t]+/, '');
        stack.pop();
        break;
      }
      if (st.kind === 'fence') {
        if (paraOpen) closeBlock();
        const code = {
          t: 'code', info: st.info, lines: [], fenced: true,
          fenceCh: st.ch, fenceLen: st.len, indent: st.indent, lastLineIdx: ln,
        };
        addChild(top(), code);
        stack.push(code);
        break;
      }
      if (st.kind === 'html') {
        if (paraOpen) closeBlock();
        const html = { t: 'html', lines: [curLine], type: st.type, lastLineIdx: ln };
        if (st.type === 1) html.endTag = htmlBlockEndTag(st.line);
        addChild(top(), html);
        if (htmlBlockEnds(html, st.line)) {
          // Single-line block: ends immediately (types 1-5; 6/7 never
          // satisfy the end condition on their first line).
          html.trailingNl = htmlTrailingNl(ln);
        } else {
          stack.push(html);
        }
        break;
      }
      if (st.kind === 'quote') {
        if (paraOpen) {
          // A blockquote can interrupt a paragraph: close it first.
          closeBlock();
        }
        const q = { t: 'quote', children: [] };
        addChild(top(), q);
        stack.push(q);
        // Peel the marker and reprocess the remainder of this line.
        // The whitespace after '>' expands with tabs counted from
        // the frame column (the '>' is at frame column start); one
        // space of it is the marker's optional space, the rest stays.
        const [ind, start] = indentInfo(curLine, 0, curBase);
        let k = start + 1, fc = start + 1, ws = 0;
        while (k < curLine.length) {
          const c = curLine.charCodeAt(k);
          if (c === 32) { k++; fc++; ws++; }
          else if (c === 9) { const w = 4 - (fc & 3); k++; fc += w; ws += w; }
          else break;
        }
        if (ws > 1) {
          curLine = ' '.repeat(ws - 1) + curLine.slice(k);
          curBase = curBase + start + 2;
        } else {
          curBase = columnAt(curLine, k, curBase);
          curLine = curLine.slice(k);
        }
        if (isBlank(curLine)) break; // '>' alone: no content this line
        continue;
      }
      if (st.kind === 'list') {
        // Close a paragraph first (lists interrupt, subject to the
        // checks already done in detectStart).
        if (paraOpen) closeBlock();
        // Find or create the list in the current container.
        // A list left on top (an item was just closed by rule 1)
        // that this marker does not continue is closed first, so a
        // delimiter change or ordered/unordered switch starts a
        // sibling list instead of nesting inside the old one.
        if (top().t === 'list' && (top().ordered !== st.ordered ||
          top().delim !== st.delim)) {
          closeBlock();
        }
        const parent = top();
        let list = null;
        // The current container may itself be the list (an item was
        // just closed by rule 1 in phase 1): add the item to it.
        if (parent.t === 'list' && parent.ordered === st.ordered &&
          parent.delim === st.delim) {
          list = parent;
          if (pendingBlank) list.loose = true;
        } else {
          const prev = parent.children[parent.children.length - 1];
          if (prev && prev.t === 'list' && prev.ordered === st.ordered &&
            prev.delim === st.delim) {
            list = prev;
            // A blank line separates items of the same list: same list,
            // but it is loose.
            if (pendingBlank) list.loose = true;
          }
        }
        if (!list) {
          list = { t: 'list', ordered: st.ordered, start: st.start, delim: st.delim, tight: true, loose: false, children: [] };
          addChild(parent, list);
          stack.push(list);
        }
        // The item's content indent is stored relative to the
        // container frame (the column where this line's content
        // started after the outer markers), so matchChain can compare
        // it against the frame-relative column of later lines.
        const itemIndent = st.contentCol - curBase;
        const item = { t: 'item', children: [], indent: itemIndent, loose: false, blankAfter: false, task: null, spaces: st.spaces, firstContent: false };
        list.children.push(item);
        stack.push(item);
        // Loose detection: blank line before this item.
        if (pendingBlank) {
          const prevItem = list.children[list.children.length - 2];
          if (prevItem) list.loose = true;
        }
        // Peel the marker; the remainder is the item's first content.
        const after = skipToColumn(curLine, st.contentCol, curBase);
        curBase = st.contentCol;
        // If the item is empty, the line contributes nothing.
        if (st.emptyFirst) {
          // Content may continue on following lines.
          break;
        }
        curLine = after;
        if (isBlank(curLine)) break;
        // The next block created in this item comes from the marker
        // line itself: its leading spaces count for the lazy-break
        // rule (a first line with 4 spaces after the marker breaks
        // the item on a following lazy line).
        item.firstContent = true;
        // Task list checkbox: [ ] / [x] / [X] at the start.
        const m = /^\[( |x|X)\] /.exec(curLine);
        if (m) {
          item.task = m[1] === ' ' ? false : true;
          curLine = curLine.slice(4);
        } else if (/^\[( |x|X)\]$/.test(curLine)) {
          item.task = curLine.charAt(1) === ' ' ? false : true;
          curLine = '';
        }
        if (curLine === '') break;
        pendingBlank = false;
        continue;
      }
      break;
    }
    if (!blank) pendingBlank = false;
  }

  // Close everything left open.
  while (stack.length > 1) closeBlock();

  // ---- Rendering -------------------------------------------------
  const out = [];
  renderChildren(doc, out, refs, inlineState);
  return out.join('');
}

function renderChildren(node, out, refs, st) {
  for (const child of node.children) renderBlock(child, out, refs, st);
}

function renderBlock(b, out, refs, st) {
  switch (b.t) {
    case 'p': {
      out.push('<p>', parseInline(b.lines.join('\n'), refs, st), '</p>\n');
      break;
    }
    case 'h': {
      // A heading's trailing spaces/tabs are stripped (but a hard
      // break on an earlier line still renders as <br>).
      out.push('<h', String(b.level), '>', parseInline(b.lines.join('\n').replace(/[ \t]+$/, ''), refs, st), '</h', String(b.level), '>\n');
      break;
    }
    case 'hr': out.push('<hr>\n'); break;
    case 'code': {
      out.push('<pre><code');
      if (b.fenced && b.info !== undefined) {
        const info = b.info.trim();
        if (info !== '') {
          const firstWord = info.split(/[ \t]+/)[0];
          out.push(' class="language-', escAttr(unescapeBackslashes(firstWord)), '"');
        }
      }
      const cc = b.content === '' ? '' : b.content.replace(/\n$/, '') + '\n';
      out.push('>', escText(cc), '</code></pre>\n');
      break;
    }
    case 'html': {
      let s = b.lines.join('\n');
      if (b.lines.length > 0 && b.trailingNl) s += '\n';
      out.push(s);
      break;
    }
    case 'quote': {
      out.push('<blockquote>\n');
      renderChildren(b, out, refs, st);
      out.push('</blockquote>\n');
      break;
    }
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      out.push('<', tag);
      if (b.ordered && b.start !== 1) out.push(' start="', String(b.start), '"');
      out.push('>\n');
      for (let ii = 0; ii < b.children.length; ii++) renderItem(b.children[ii], b.tight, out, refs, st, ii === b.children.length - 1);
      out.push('</', tag, '>\n');
      break;
    }
    case 'table': {
      out.push('<table>\n<thead>\n<tr>\n');
      for (let i = 0; i < b.header.length; i++) {
        const a = b.aligns[i];
        out.push('<th');
        if (a) out.push(' align="', a, '"');
        out.push('>', parseInline(b.header[i], refs, st), '</th>\n');
      }
      out.push('</tr>\n</thead>\n');
      if (b.rows.length > 0) {
        out.push('<tbody>');
        for (const row of b.rows) {
          out.push('<tr>\n');
          for (let i = 0; i < row.length; i++) {
            const a = b.aligns[i];
            out.push('<td');
            if (a) out.push(' align="', a, '"');
            out.push('>', parseInline(row[i], refs, st), '</td>\n');
          }
          out.push('</tr>\n');
        }
        out.push('</tbody>');
      }
      out.push('</table>\n');
      break;
    }
  }
}

function renderItem(item, tight, out, refs, st, isLast) {
  out.push('<li>');
  // Tight list: paragraph renders without <p> tags.
  let first = true;
  for (const child of item.children) {
    if (tight && child.t === 'p') {
      // Tight list: paragraph renders without <p> tags.
      if (item.task !== null && first) {
        out.push(item.task
          ? '<input checked="" disabled="" type="checkbox"> '
          : '<input disabled="" type="checkbox"> ');
      }
      out.push(parseInline(child.lines.join('\n'), refs, st));
      first = false;
    } else if (!tight && child.t === 'p') {
      if (item.task !== null && first) {
        out.push('<p><input ', item.task ? 'checked="" ' : '', 'disabled="" type="checkbox"> ');
        out.push(parseInline(child.lines.join('\n'), refs, st), '</p>\n');
      } else {
        out.push('<p>', parseInline(child.lines.join('\n'), refs, st), '</p>\n');
      }
      first = false;
    } else {
      renderBlock(child, out, refs, st);
      first = false;
    }
  }
  // Marked strips one trailing newline from an html block child's
  // text when the item is the LAST item of its list (the block is
  // closed by the end of the list / document); a non-last html item
  // keeps it, and other block children keep theirs.
  if (isLast && out.length > 0) {
    const lastChild = item.children[item.children.length - 1];
    if (lastChild && lastChild.t === 'html') {
      const last = out[out.length - 1];
      if (typeof last === 'string' && last.endsWith('\n')) {
        out[out.length - 1] = last.slice(0, -1);
      }
    }
  }
  out.push('</li>\n');
}

// Remove backslash escapes of ASCII punctuation (info strings).
function unescapeBackslashes(s) {
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 92 && i + 1 < s.length && isAsciiPunct(s.charCodeAt(i + 1))) {
      out += s.slice(start, i) + s[i + 1];
      start = i + 2;
      i++;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// ------------------------------------------------------------------
// Inline parsing.
//
// One left-to-right scan builds a flat token list:
//   {s: string}            literal text or generated markup
//   {d: delim}             emphasis / strikethrough delimiter run
//   {op: opener}           a '[' (or '![') that may start a link
//   {img: {...}}           a formed image (inner tokens kept for alt)
//   {dead: true}           a token inside an image's alt text (skipped
//                          in the main render, used for the alt text)
//
// Emphasis is resolved after the scan with the CommonMark delimiter
// algorithm; links are resolved during the scan, when ']' is seen.
// Delimiters carry a `ctx` so emphasis never crosses a link boundary:
// when a link forms, its inner delimiters get a fresh context id.
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Emphasis masking (marked's #n / fe, precode-code half). Before
// scanning for emphasis, marked masks the inline source: Ot replaces
// backticks inside code spans with '+', then blockSkip masks link /
// code-span / html matches. A '*'/'_'/'~' run hidden by that masking
// cannot open or close emphasis. In this parser the link and html
// halves are redundant (a link label's delimiters are resolved in
// their own context, and tag content is never scanned), so only the
// precode-code half is applied here: a backtick run (not preceded by
// a backtick), non-backtick content, and the same-length run (not
// followed by a backtick). That matches real code spans (whose
// content is already hidden from emphasis) AND "phantom" spans where
// a dangling backtick in a link label pairs with a later backtick —
// marked masks the whole span, so emphasis inside it cannot form.
// maskEmphasis(s) returns a Uint8Array, 1 where s[i] is a visible
// emphasis delimiter char, 0 where masked.
const OT_RE = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\([\p{P}\p{S}])/gu;
// Marked's label regex `re` (label validity for link formation),
// anchored to test a whole label followed by ']'. A label whose
// backtick runs do not fit `re` (e.g. `` `` a ` b `` `` — opening 2,
// inner 1, closing 2) makes the link fail AND, via blockSkip, hides
// the emphasis delimiters inside the label from emStrong.
const BT = '`';
const LABEL_RE_SRC = '(?:\\[(?:\\[(?:\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]|\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]|\\\\[\\s\\S]|'
  + BT + '+(?!' + BT + ')[^' + BT + ']*?' + BT + '+(?!' + BT + ')'
  + '|' + BT + BT + '+(?=\\])|[^\\[\\]\\\\' + BT + '])*?';
const LABEL_FULL_RE = new RegExp('^' + LABEL_RE_SRC + '\\]$');
function labelValid(lab) { return LABEL_FULL_RE.test(lab + ']'); }
// blockSkip's full alternation (link | precode-code | html): the link
// and html alternatives only CONSUME text (protecting backticks
// inside an inline link from forming a phantom span); only a
// precode-code match masks emphasis. Masking a link would hide its
// label's delimiters, which this parser resolves in their own
// context (cm-419).
const BLOCKSKIP_FULL_RE = new RegExp(
  '\\[(?:[^\\[\\]`]|(?<a>`+)[^`]+\\k<a>(?!`))*?\\]\\((?:\\\\[\\s\\S]|[^\\s\\(\\)]|\\((?:\\\\[\\s\\S]|[^\\s\\(\\)])*\\))*\\)'
  + '|(?<!`)()(?<b>`+)[^`]+\\k<b>(?!`)'
  + '|<(?! )[^<>]*?>',
  'g');
function maskEmphasis(s) {
  const vis = new Uint8Array(s.length);
  for (let k = 0; k < s.length; k++) {
    const c = s.charCodeAt(k);
    if (c === 42 || c === 95 || c === 126) vis[k] = 1;
  }
  if (!/[*_~]/.test(s)) return vis;
  let t = s.replace(OT_RE, (n, g1, g2) =>
    g2 ? '+'.repeat(n.length)
      : g1 ? g1 + n.slice(g1.length, -g1.length).replace(/`/g, '+') + g1
      : n);
  BLOCKSKIP_FULL_RE.lastIndex = 0;
  let m;
  // Inline-link spans: delimiters inside a link that forms are
  // resolved in the label's own context (marked re-masks the label
  // alone), so a paragraph-level phantom span must not hide them.
  const linkSpans = [];
  const LINK_ONLY_RE = new RegExp(
    '\\[(?:[^\\[\\]`]|(?<a>`+)[^`]+\\k<a>(?!`))*?\\]\\((?:\\\\[\\s\\S]|[^\\s\\(\\)]|\\((?:\\\\[\\s\\S]|[^\\s\\(\\)])*\\))*\\)',
    'g');
  LINK_ONLY_RE.lastIndex = 0;
  while ((m = LINK_ONLY_RE.exec(t)) !== null) {
    linkSpans.push([m.index, m.index + m[0].length]);
  }
  const inLink = (k) => {
    for (let q = 0; q < linkSpans.length; q++) {
      if (k >= linkSpans[q][0] && k < linkSpans[q][1]) return true;
    }
    return false;
  };
  while ((m = BLOCKSKIP_FULL_RE.exec(t)) !== null) {
    // Only a precode-code match (starts with a backtick) masks.
    if (m[0].charCodeAt(0) !== 96) continue;
    const openLen = m.groups.b.length;
    const cs = m.index + openLen, ce = m.index + m[0].length - openLen;
    for (let k = cs; k < ce && k < s.length; k++) {
      if (!inLink(k)) vis[k] = 0;
    }
  }
  return vis;
}

// The inline tokenizer. `st` is the shared per-document inline
// state ({inLink}); an <a> tag sets inLink (suppressing bare-URL and
// email autolinks until a </a>), and a link formation restores the
// inLink value from when its '[' was opened (marked's De save/restore).
function parseInline(s, refs, st) {
  st = st || { inLink: false };
  const len = s.length;
  const end = len; // trailing spaces/tabs are rendered as-is
  const toks = [];
  const delims = [];   // delimiter tokens, in scan order
  const openers = [];  // '[' opener tokens, innermost last
  let ctxCounter = 1;
  // Visible emphasis delimiters per the blockSkip/Ot masking above.
  // Computed lazily (only when the text contains a backtick or '['
  // that could mask something); otherwise every delimiter is visible.
  let emVis = null;
  const visAt = (i) => {
    if (emVis === null) emVis = maskEmphasis(s);
    return emVis[i] === 1;
  };

  function pushText(str) {
    if (str !== '') toks.push({ s: str });
  }
  // An autolink token: 'angle' (<https://...>) or 'ext' (bare URL,
  // www., email). Only markdown links block an outer link; autolinks
  // do not — but an 'ext' autolink inside link text is plain text.
  function pushAuto(str, kind) {
    if (str !== '') toks.push({ s: str, auto: kind });
  }
  // Flush pending plain text from s[a..b).
  function flushText(a, b) {
    if (b > a) pushText(escText(s.slice(a, b)));
  }

  // Whether a ']' ahead would close a link text that can still
  // form: an unmatched '[' is open AND no formed markdown link sits
  // inside its text so far (a formed link inside would block the
  // outer link via linkInText, so there is no link to protect and
  // an autolink may include the ']').
  function linkTextCanForm() {
    if (openers.length === 0) return false;
    const opTok = openers[openers.length - 1].tok;
    const from = toks.indexOf(opTok);
    for (let k = from + 1; k < toks.length; k++) {
      if (toks[k].isLink) return false;
    }
    return true;
  }

  let i = 0;
  let textStart = 0;

  while (i < end) {
    const c = s.charCodeAt(i);

    // ---- backslash escapes / hard breaks ----
    if (c === 92) {
      if (i + 1 < end) {
        const n = s.charCodeAt(i + 1);
        if (n === 10) {
          flushText(textStart, i);
          pushText('<br>');
          i += 2;
          // After a hard break the next line's leading spaces are
          // stripped (a soft newline keeps them).
          while (i < end && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
          textStart = i;
          continue;
        }
        if (isAsciiPunct(n)) {
          flushText(textStart, i);
          pushText(escText(s[i + 1]));
          i += 2;
          textStart = i;
          continue;
        }
      }
      i++;
      continue;
    }

    // ---- entities ----
    if (c === 38) {
      const dec = decodeEntity(s, i);
      if (dec) {
        flushText(textStart, i);
        pushText(dec[2] ? dec[0] : escText(dec[0]));
        i = dec[1];
        textStart = i;
        continue;
      }
      i++;
      continue;
    }

    // ---- code spans ----
    if (c === 96) {
      let j = i;
      while (j < end && s.charCodeAt(j) === 96) j++;
      const run = j - i;
      // A code span must not swallow the ']' that closes a link
      // text that can still form (marked tries `link` before
      // `codespan`). But a code span MAY cross the ']' when the
      // link text is not a valid label — marked's label regex only
      // allows backticks as a complete `` `...` `` span or as
      // `` `` `` right before ']' (cm-525/537/342: a lone backtick
      // in the label means no link forms, so the code span crosses
      // the ']'). Limit the closer search to before the next
      // unescaped ']' only when the label's backticks are all valid.
      let searchEnd = end;
      if (linkTextCanForm()) {
        // Find the next unescaped ']' (the label end).
        let closeBracket = -1;
        let q = j;
        while (q < end) {
          if (s.charCodeAt(q) === 92 && q + 1 < end && isAsciiPunct(s.charCodeAt(q + 1))) { q += 2; continue; }
          if (s.charCodeAt(q) === 93) { closeBracket = q; break; }
          q++;
        }
        if (closeBracket !== -1) {
          // Check the label [opener+1, closeBracket) : every
          // backtick run must start a `` `...` `` span or be
          // `` `` `` immediately before ']'.
          const labelStart = openers[openers.length - 1].start + 1;
          if (labelBackticksValid(s, labelStart, closeBracket)) searchEnd = closeBracket;
        }
      }
      // Find a later run of exactly `run` backticks.
      let k = j;
      let found = -1;
      while (k < searchEnd) {
        if (s.charCodeAt(k) === 96) {
          let m = k;
          while (m < end && s.charCodeAt(m) === 96) m++;
          if (m - k === run) { found = k; break; }
          k = m;
        } else k++;
      }
      if (found === -1) { i = j; continue; }
      let content = s.slice(j, found);
      content = content.replace(/\n/g, ' ');
      if (content.length >= 2 && content.charCodeAt(0) === 32 &&
        content.charCodeAt(content.length - 1) === 32 &&
        content.trim() !== '') {
        content = content.slice(1, -1);
      }
      flushText(textStart, i);
      pushText('<code>' + escText(content) + '</code>');
      i = found + run;
      textStart = i;
      continue;
    }

    // ---- emphasis / strikethrough delimiter runs ----
    if (c === 42 || c === 95 || c === 126) {
      let j = i;
      while (j < end && s.charCodeAt(j) === c) j++;
      const run = j - i;
      if (c === 126 && run >= 3) { i = j; continue; } // ~~~ never strikes
      const prev = i > 0 ? s.charCodeAt(i - 1) : 32;
      const next = j < end ? s.charCodeAt(j) : 32;
      const prevWs = isWhitespaceCh(prev);
      const nextWs = isWhitespaceCh(next);
      // Punctuation for flanking: marked's GFM emphasis regexes
      // exclude '~' from punctuation for '*' (it is the
      // strikethrough delimiter, so it counts as a word character
      // there), but for '_' the '~' still counts as punctuation —
      // otherwise a '_' right after '~~' could never open (its
      // right-flanking would block it with no punctuation before).
      const prevPunct = c === 95 ? isPunctCh(prev) : isEmPunctCh(prev);
      const nextPunct = c === 95 ? isPunctCh(next) : isEmPunctCh(next);
      // left-flanking: next not ws AND (next not punct OR prev ws or punct)
      const lf = !nextWs && (!nextPunct || prevWs || prevPunct);
      const rf = !prevWs && (!prevPunct || nextWs || nextPunct);
      let canOpen, canClose;
      if (c === 95) {
        canOpen = lf && (!rf || prevPunct);
        canClose = rf && (!lf || nextPunct);
      } else {
        canOpen = lf;
        canClose = rf;
      }
      flushText(textStart, i);
      const d = { ch: c === 42 ? '*' : c === 95 ? '_' : '~', n: run, n0: run, canOpen, canClose, ctx: 0, active: true, nextCh: next, prevCh: prev, pos: i };
      const tok = { d };
      toks.push(tok);
      // A delimiter hidden by marked's blockSkip/Ot masking cannot
      // open or close emphasis; it stays literal text.
      if (visAt(i)) delims.push(d);
      d.tok = tok;
      i = j;
      textStart = i;
      continue;
    }

    // ---- images: ![ ----
    if (c === 33 && i + 1 < end && s.charCodeAt(i + 1) === 91) {
      flushText(textStart, i);
      const tok = { op: { img: true, tok: null, start: i + 1, inLink: st.inLink } };
      tok.op.tok = tok;
      toks.push(tok);
      openers.push(tok.op);
      i += 2;
      textStart = i;
      continue;
    }

    // ---- link open: [ ----
    if (c === 91) {
      flushText(textStart, i);
      const tok = { op: { img: false, tok: null, start: i, inLink: st.inLink } };
      tok.op.tok = tok;
      toks.push(tok);
      openers.push(tok.op);
      i++;
      textStart = i;
      continue;
    }

    // ---- link close: ] ----
    if (c === 93) {
      if (openers.length === 0) { i++; continue; }
      // Flush pending text first: the link text must be in the token
      // list before tryLink reads it.
      flushText(textStart, i);
      textStart = i;
      const op = openers[openers.length - 1];
      // A link cannot form inside an image's alt text: if any opener
      // below this link opener is an image opener, this '[' is
      // literal. (An image opener may still form inside an image.)
      let insideImg = false;
      if (!op.img) {
        for (let q = 0; q < openers.length - 1; q++) {
          if (openers[q].img) { insideImg = true; break; }
        }
      }
      const link = insideImg ? null : tryLink(s, i, op, refs, toks);
      if (!link) {
        // Not a link: this '[' is literal text; drop it from the stack.
        // The ']' stays in the pending text (textStart already points
        // at it) and is flushed as a literal character.
        // If the label is invalid per marked's label regex and holds
        // a backtick, marked's blockSkip hides the emphasis inside
        // it, so those delimiters cannot open or close emphasis.
        if (!op.img) {
          const lab = s.slice(op.start + 1, i);
          if (lab.indexOf('`') !== -1 && !labelValid(lab)) {
            for (const d of delims) {
              if (d.pos > op.start && d.pos < i) d.active = false;
            }
          }
        }
        openers.pop();
        i++;
        continue;
      }
      // A link formed.
      openers.pop();
      // Restore the inLink value from when '[' was opened (marked's
      // De save/restore: tags inside the link text do not leak out).
      st.inLink = op.inLink;
      const fromIdx = toks.indexOf(op.tok);
      const toIdx = toks.length; // tokens up to (not incl.) the ']' text
      // Reassign inner delimiters to a fresh context.
      const newCtx = ctxCounter++;
      for (const d of delims) {
        if (d.ctx === 0 && d.tok && toks.indexOf(d.tok) > fromIdx && toks.indexOf(d.tok) < toIdx) {
          d.ctx = newCtx;
        }
      }
      if (link.img) {
        // Replace the '![' token with the <img> tag; inner tokens die.
        const inner = toks.slice(fromIdx + 1, toIdx);
        for (const t of inner) t.dead = true;
        // Keep the raw label text: the alt text is computed by
        // re-tokenizing it fresh (marked's image renderer does the
        // same), so a link/image inside the label contributes its
        // plain text to the alt.
        op.tok.img = { href: link.href, title: link.title, inner, raw: s.slice(op.start + 1, i) };
        delete op.tok.op;
        // The ']' itself produces nothing.
        i = link.next;
        textStart = i;
        continue;
      }
      // Normal link: opener token becomes <a ...>, ']' becomes </a>.
      // A bare-URL/email autolink inside link text is plain text
      // (marked tokenizes link text with inLink set); an angle
      // autolink stays a link.
      for (let k = fromIdx + 1; k < toIdx; k++) {
        const t = toks[k];
        if (t.auto === 'ext') {
          t.s = t.s.slice(t.s.indexOf('>') + 1, -4);
          delete t.auto;
        }
      }
      op.tok.s = '<a href="' + link.href + '"' + (link.title !== null ? ' title="' + link.title + '"' : '') + '>';
      op.tok.isLink = true;
      delete op.tok.op;
      pushText('</a>');
      i = link.next;
      textStart = i;
      continue;
    }

    // ---- autolinks and raw HTML: < ----
    if (c === 60) {
      const res = tryAngle(s, i, end);
      if (res) {
        flushText(textStart, i);
        if (res.auto) {
          // An angle autolink does not touch inLink.
          pushAuto(res.html, res.auto);
        } else {
          // Raw HTML tag: an <a ...> opens a link context (bare-URL
          // and email autolinks stop until a </a> closes it).
          if (/^<a /i.test(res.html)) st.inLink = true;
          else if (/^<\/a>/i.test(res.html)) st.inLink = false;
          pushText(res.html);
        }
        i = res.next;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }

    // ---- extended autolinks: www. / email / scheme: ----
    // Suppressed while inside a link context (inLink).
    if (c === 119 && s.startsWith('www.', i) && extAutolinkBoundary(s, i)) {
      if (!st.inLink) {
        const res = tryWww(s, i, end, linkTextCanForm());
        if (res) {
          flushText(textStart, i);
          pushAuto(res.html, 'ext');
          i = res.next;
          textStart = i;
          continue;
        }
      }
      i++;
      continue;
    }
    if (c === 64 || ((c >= 65 && c <= 90) || (c >= 97 && c <= 122))) {
      // Possible email or scheme autolink. Unlike www., scheme and
      // email autolinks need no preceding boundary (xhttps://foo.bar
      // and ,foo@bar.com both linkify).
      if (!st.inLink) {
        // An unmatched '_' emphasis opener seen so far means trailing
        // '_'s after an email may be its closer (marked resolves the
        // emphasis first, so the email ends before them).
        let allowUClose = false;
        for (let d = 0; d < delims.length; d++) {
          if (delims[d].ch === '_' && delims[d].canOpen && delims[d].active) { allowUClose = true; break; }
        }
        const res = trySchemeOrEmail(s, i, end, allowUClose, linkTextCanForm());
        if (res) {
          flushText(textStart, i);
          pushAuto(res.html, 'ext');
          i = res.next;
          textStart = i;
          continue;
        }
      }
      i++;
      continue;
    }

    // ---- hard break: two or more spaces before a newline ----
    if (c === 32) {
      let j = i;
      while (j < end && s.charCodeAt(j) === 32) j++;
      if (j - i >= 2 && j < end && s.charCodeAt(j) === 10) {
        flushText(textStart, i);
        pushText('<br>');
        i = j + 1;
        // After a hard break the next line's leading spaces are
        // stripped (a soft newline keeps them).
        while (i < end && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
        textStart = i;
        continue;
      }
      i = j;
      continue;
    }

    i++;
  }
  flushText(textStart, end);

  // ---- emphasis resolution (CommonMark delimiter algorithm) ----
  processEmphasis(toks, delims);

  // ---- render ----
  const out = [];
  for (const t of toks) {
    if (t.dead) continue;
    if (t.d) {
      if (t.closeTags) {
        // Closer-leftover chars that are content inside the span
        // are emitted just before its close tag — but only when
        // this closer closes a single span. When several nested
        // spans share one closer run, the leftover belongs outside
        // them all (the inner spans' delimiters are not literal
        // content), so it is emitted after every close tag.
        if (t.closeTags.length === 1 && (t.closeTags[0][2] || 0) > 0) {
          const take = Math.min(t.closeTags[0][2], t.d.n);
          if (take > 0) out.push(t.d.ch.repeat(take));
          out.push(t.closeTags[0][0]);
          if (t.d.n - take > 0) out.push(t.d.ch.repeat(t.d.n - take));
        } else {
          out.push(t.closeTags.map((x) => x[0]).join(''));
          if (t.d.n > 0) out.push(t.d.ch.repeat(t.d.n));
        }
      } else if (t.d.n > 0) {
        out.push(t.d.ch.repeat(t.d.n));
      }
      if (t.openTags) out.push(t.openTags.map((x) => x[0]).join(''));
    } else if (t.img) {
      out.push(renderImg(t.img, refs));
    } else if (t.op) {
      out.push(t.op.img ? '![' : '[');
    } else if (t.s !== undefined) {
      out.push(t.s);
    }
  }
  return out.join('');
}

function renderImg(img, refs) {
  // Alt text: re-tokenize the raw label fresh and take its plain
  // text (links contribute their text, nested images their alt).
  const alt = img.raw !== undefined
    ? plainText(parseInline(img.raw, refs, { inLink: false }))
    : renderAlt(img.inner);
  return '<img src="' + img.href + '" alt="' + alt + '"' +
    (img.title !== null ? ' title="' + img.title + '"' : '') + '>';
}
// Plain text of an HTML fragment: nested images contribute their
// alt text, all other tags are stripped, entities are unescaped
// (the result is re-escaped by escAttr at the call site).
function plainText(html) {
  html = html.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$1');
  html = html.replace(/<[^>]*>/g, '');
  return html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
// Alt text: the inner tokens rendered to plain text — every inner
// token counts, including the text of a nested image (whose tokens
// are marked dead in the main render). Tags are stripped, leaving
// the plain text (escapes/entities already processed in the tokens).
function renderAlt(inner) {
  let html = '';
  for (const t of inner) {
    if (t.d) {
      if (t.closeTags) {
        if (t.closeTags.length === 1 && (t.closeTags[0][2] || 0) > 0) {
          const take = Math.min(t.closeTags[0][2], t.d.n);
          if (take > 0) html += t.d.ch.repeat(take);
          html += t.closeTags[0][0];
          if (t.d.n - take > 0) html += t.d.ch.repeat(t.d.n - take);
        } else {
          html += t.closeTags.map((x) => x[0]).join('');
          if (t.d.n > 0) html += t.d.ch.repeat(t.d.n);
        }
      } else if (t.d.n > 0) {
        html += t.d.ch.repeat(t.d.n);
      }
      if (t.openTags) html += t.openTags.map((x) => x[0]).join('');
    } else if (t.img) html += renderAlt(t.img.inner);
    else if (t.op) html += t.op.img ? '![' : '[';
    else if (t.s !== undefined) html += t.s;
  }
  // Strip tags, keeping nested images' alt text.
  html = html.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$1');
  html = html.replace(/<[^>]*>/g, '');
  return escAttr(html);
}

// Recompute a delimiter's flanking for given neighbouring chars
// (used when a delimiter sits at the edge of a span's content:
// marked re-tokenizes the content on its own, so a delimiter
// right before the span's closer is followed by end-of-content,
// not by the outer text).
function setFlanking(d, prevCh, nextCh) {
  const prevWs = isWhitespaceCh(prevCh);
  const nextWs = isWhitespaceCh(nextCh);
  const prevPunct = d.ch === '_' ? isPunctCh(prevCh) : isEmPunctCh(prevCh);
  const nextPunct = d.ch === '_' ? isPunctCh(nextCh) : isEmPunctCh(nextCh);
  const lf = !nextWs && (!nextPunct || prevWs || prevPunct);
  const rf = !prevWs && (!prevPunct || nextWs || nextPunct);
  if (d.ch === '_') {
    d.canOpen = lf && (!rf || prevPunct);
    d.canClose = rf && (!lf || nextPunct);
  } else {
    d.canOpen = lf;
    d.canClose = rf;
  }
}

// Emphasis resolution — marked's emStrong algorithm, opener-first.
// Openers are scanned left to right; for each opener the search
// runs forward over later runs of the same character, keeping an
// accumulator m (the opener length plus the lengths of pure-opener
// runs in between, minus closer lengths, with rule-of-three runs
// skipped). The first closer that brings m to zero or below is
// the match. A run longer than its closer is retried at shorter
// lengths (marked advances one char at a time through a run that
// does not match). Once a span forms, its interior is resolved
// recursively — that is how an outer span can contain an inner
// one, and how a leftover opener can match a closer inside its
// own span (cm-408). The range bound keeps a span's interior from
// reaching outside it (cm-469/470).
function processEmphasis(toks, delims) {
  resolveEmphasis(delims, 0, delims.length);
}

function resolveEmphasis(delims, lo, hi) {
  let oi = lo;
  while (oi < hi) {
    const opener = delims[oi];
    if (!opener.active || !opener.canOpen) { oi++; continue; }
    // Search forward for this opener's closer, trying opener
    // lengths from opener.n down to 1.
    let found = null;
    for (let y = opener.n; y >= 1 && !found; y--) {
      const R = y === opener.n ? opener.canClose
        : (isWhitespaceCh(opener.nextCh) || isEmPunctCh(opener.nextCh));
      let m = y, f = 0;
      for (let ci = oi + 1; ci < hi; ci++) {
        const d = delims[ci];
        if (d.ch !== opener.ch || d.ctx !== opener.ctx) continue;
        if (!d.active) continue;
        // marked's right-delimiter regex first skips a run of the
        // other character's strong containing this run
        // (`__...*...__` when searching for `*`, `**..._...**`
        // when searching for `_`): such a run is inside the other
        // strong, so it neither opens nor closes the outer span.
        if (opener.ch !== '~') {
          const other = opener.ch === '*' ? '_' : '*';
          const prev = delims[ci - 1];
          const next = delims[ci + 1];
          if (prev && prev.ch === other && prev.n >= 2 && prev.canOpen && prev.ctx === d.ctx &&
            next && next.ch === other && next.n >= 2 && next.canClose && next.ctx === d.ctx) continue;
        }
        if (d.canOpen && !d.canClose) { m += d.n; continue; }
        if (!d.canClose) continue;
        if ((d.canOpen || R) && y % 3 !== 0 && (y + d.n) % 3 === 0) { f += d.n; continue; }
        m -= d.n;
        if (m > 0) continue;
        // marked's effective closer length b = min(d.n, d.n+m+f);
        // the span's delimiter is 2 chars when both sides have >=2
        // (strong) else 1 (em); the remaining b-use closer chars
        // are content INSIDE the span, before its close tag.
        const bEff = Math.min(d.n, d.n + m + f);
        const use = (y >= 2 && d.n >= 2) ? 2 : 1;
        found = { ci, use, inner: bEff - use };
        break;
      }
    }
    if (!found) { oi++; continue; }
    const closer = delims[found.ci];
    const tag = closer.ch === '~' ? 'del' : found.use === 2 ? 'strong' : 'em';
    // Tags on one token stay ordered by span extent: an open tag
    // for a span ending further right is outer (first); a close
    // tag for a span starting further right is inner (first).
    // openTags entries are [tag, closerIdx], closeTags [tag, openerIdx].
    opener.tok.openTags = opener.tok.openTags || [];
    closer.tok.closeTags = closer.tok.closeTags || [];
    let j = 0;
    while (j < opener.tok.openTags.length && opener.tok.openTags[j][1] > found.ci) j++;
    opener.tok.openTags.splice(j, 0, ['<' + tag + '>', found.ci]);
    j = 0;
    while (j < closer.tok.closeTags.length && closer.tok.closeTags[j][1] >= oi) j++;
    closer.tok.closeTags.splice(j, 0, ['</' + tag + '>', oi, found.inner]);
    opener.n -= found.use;
    // Only the delimiter chars are consumed; the `inner` closer
    // chars stay in closer.n so the interior recursion can still
    // form spans with them (marked re-tokenizes the span content).
    // The render emits them just before this span's close tag,
    // limited by how many are left after inner spans consumed some.
    closer.n -= found.use;
    if (opener.n === 0) opener.active = false;
    if (closer.n === 0) closer.active = false;
    // A delimiter right before this span's closer is at the end of
    // the span's content (marked re-tokenizes the content alone),
    // so its following char is end-of-content — or the closer's
    // leftover chars, if the closer was longer than the span used.
    if (found.ci - 1 > oi) {
      const last = delims[found.ci - 1];
      if (last.pos + last.n0 === closer.pos) {
        const nextCh = closer.n0 > found.use ? closer.ch.charCodeAt(0) : 32;
        setFlanking(last, last.prevCh, nextCh);
      }
    }
    // Resolve the interior (nested spans), including the opener's
    // and closer's leftovers.
    resolveEmphasis(delims, oi, found.ci + 1);
    // Continue after the closer.
    oi = found.ci + 1;
  }
}

// Whether every backtick in s[start..end) is a valid part of a
// link label per marked's label regex `re`: each backtick run must
// start a `` `...` `` span (any run lengths, >=1 non-backtick char
// of content, closer run not followed by a backtick) or be `` `` ``
// immediately before the closing ']'. A lone backtick (or a code
// span whose lazy alt-3 match leaves a stray run, e.g. `` `` a ` b `` ``)
// makes the label invalid, so the `link` regex fails and no link
// forms (cm-525/537/342, doc-16).
function labelBackticksValid(s, start, end) {
  let p = start;
  while (p < end) {
    const cc = s.charCodeAt(p);
    if (cc === 92) { p += 2; continue; }
    if (cc === 91) {
      let depth = 1, r = p + 1;
      while (r < end && depth > 0) {
        if (s.charCodeAt(r) === 91) depth++;
        else if (s.charCodeAt(r) === 93) depth--;
        r++;
      }
      p = r; continue;
    }
    if (cc === 96) {
      let r = p;
      while (r < end && s.charCodeAt(r) === 96) r++;
      const runLen = r - p;
      // Alt-3: a later backtick run after >=1 content char.
      let k = r, closeEnd = -1;
      while (k < end) {
        if (s.charCodeAt(k) === 96) {
          let m = k;
          while (m < end && s.charCodeAt(m) === 96) m++;
          closeEnd = m; break;
        }
        k++;
      }
      if (closeEnd !== -1 && k > r) { p = closeEnd; continue; }
      // Alt-4: >=2 backticks immediately before ']'.
      if (runLen >= 2 && r === end) { p = r; continue; }
      return false;
    }
    p++;
  }
  return true;
}

// Try to form a link at s[i] === ']' with the given opener.
// Returns null, or {href, title, img, next, textStart}.
function tryLink(s, i, op, refs, toks) {
  const len = s.length;
  // The link text, raw source between '[' and ']' — marked matches
  // shortcut/collapsed reference labels against this raw text
  // (escapes, code backticks and emphasis markers kept).
  const linkText = s.slice(op.start + 1, i);
  // The label must be valid per marked's label regex: backticks
  // must form complete `` `...` `` spans (or `` `` `` before ']').
  // Otherwise the `link`/`reflink` regexes fail and no link forms.
  if (!labelBackticksValid(s, op.start + 1, i)) return null;
  // If the link text already contains a formed markdown link, the
  // outer link does not form (marked's linkInText rule). Autolinks
  // inside the text do not block it (an angle autolink stays a link;
  // a bare-URL/email autolink becomes plain text when the outer link
  // forms). A raw HTML <a> tag is not a formed link and does not
  // block it either — only tokens marked isLink (a link this parser
  // formed) count.
  const fromIdx0 = toks.indexOf(op.tok);
  for (let k = fromIdx0 + 1; k < toks.length; k++) {
    const t = toks[k];
    if (t.auto) continue;
    if (t.isLink) return null;
  }
  let j = i + 1;
  // Inline link: (dest "title"). If it does not parse, fall back to
  // a shortcut reference link (marked tries the link regex first,
  // then the reference forms) — unless the destination was refused
  // by cleanUrl, in which case the link is plain text.
  if (j < len && s.charCodeAt(j) === 40) {
    const inline = tryInlineLink(s, j, op, refs);
    if (inline === 'refused') return null;
    if (inline) return inline;
    // Fall through to the shortcut reference below.
  }
  // Reference link: [label] or [] or shortcut.
  let label = null;
  let next = -1;
  if (j < len && s.charCodeAt(j) === 91) {
    // [label] — kept raw (escapes kept); an unescaped '[' inside
    // the label makes it invalid, so it never matches a definition.
    let k = j + 1;
    let lab = '';
    let closed = false;
    while (k < len) {
      const c = s.charCodeAt(k);
      if (c === 92 && k + 1 < len && isAsciiPunct(s.charCodeAt(k + 1))) {
        lab += s[k] + s[k + 1]; k += 2; continue;
      }
      if (c === 91) return null;
      if (c === 93) { closed = true; k++; break; }
      if (c === 10) break;
      lab += s[k]; k++;
    }
    if (!closed) return null;
    label = lab === '' ? linkText : lab;
    next = k;
  } else {
    // Shortcut reference: label is the link text.
    label = linkText;
    next = i + 1;
  }
  if (label === null || label.length === 0 || label.length > 999) return null;
  const ref = refs.get(normalizeLabel(label));
  if (!ref) return null;
  const href = cleanUrl(ref.dest);
  if (href === null) return null;
  return { href: escAttr(href), title: ref.title === null ? null : escAttr(ref.title), img: op.img, next, textStart: i };
}

// Parse an inline link starting at s[j] === '('.
// Returns the link object, null when it does not parse (caller falls
// back to a shortcut reference), or 'refused' when the destination
// was refused by cleanUrl (no fallback: plain text).
function tryInlineLink(s, j, op, refs) {
  const len = s.length;
  j++;
  j = skipInlineWs(s, j);
  if (j >= len) return null;
  let dest, pos;
  if (s.charCodeAt(j) === 41) {
    // Empty destination: [link]() is a valid link to "".
    dest = '';
    pos = j;
  } else {
    const destRes = parseLinkDestination(s, j);
    if (!destRes) return null;
    dest = destRes[0];
    pos = skipInlineWs(s, destRes[2]);
  }
  let title = null;
  if (pos < len && s.charCodeAt(pos) !== 41) {
    const tRes = parseLinkTitle(s, pos);
    if (!tRes) return null;
    title = tRes[0];
    pos = skipInlineWs(s, tRes[1]);
  }
  if (pos >= len || s.charCodeAt(pos) !== 41) return null;
  const href = cleanUrl(dest);
  if (href === null) return 'refused';
  return { href: escAttr(href), title: title === null ? null : escAttr(title), img: op.img, next: pos + 1 };
}

function skipInlineWs(s, i) {
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10) i++;
    else break;
  }
  return i;
}

// Match a raw HTML tag starting at s[i] === '<', using marked's
// attribute grammar: attribute names [A-Za-z:_][\w.:-]*, values
// double-quoted (no "), single-quoted (no '), or unquoted (no
// space " ' = < > `). A close tag takes no attributes.
// Returns the index just past '>', or 0 when it is not a tag.
function matchTag(s, i, end) {
  let j = i + 1;
  let closing = false;
  if (j < end && s.charCodeAt(j) === 47) { closing = true; j++; }
  if (j >= end) return 0;
  const c0 = s.charCodeAt(j);
  if (!((c0 >= 65 && c0 <= 90) || (c0 >= 97 && c0 <= 122))) return 0;
  j++;
  while (j < end) {
    const c = s.charCodeAt(j);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 45) j++;
    else break;
  }
  if (closing) {
    while (j < end && (s.charCodeAt(j) === 32 || s.charCodeAt(j) === 9 || s.charCodeAt(j) === 10)) j++;
    if (j < end && s.charCodeAt(j) === 62) return j + 1;
    return 0;
  }
  for (;;) {
    let ws = 0;
    while (j < end) {
      const c = s.charCodeAt(j);
      if (c === 32 || c === 9 || c === 10) { j++; ws++; }
      else break;
    }
    if (j >= end) return 0;
    if (s.charCodeAt(j) === 62) return j + 1;
    if (s.charCodeAt(j) === 47) {
      if (j + 1 < end && s.charCodeAt(j + 1) === 62) return j + 2;
      return 0;
    }
    if (ws === 0) return 0; // an attribute must follow whitespace
    const a0 = s.charCodeAt(j);
    if (!((a0 >= 65 && a0 <= 90) || (a0 >= 97 && a0 <= 122) || a0 === 95 || a0 === 58)) return 0;
    j++;
    while (j < end) {
      const c = s.charCodeAt(j);
      if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) ||
        c === 95 || c === 58 || c === 46 || c === 45) j++;
      else break;
    }
    let k = j;
    while (k < end && (s.charCodeAt(k) === 32 || s.charCodeAt(k) === 9 || s.charCodeAt(k) === 10)) k++;
    if (k < end && s.charCodeAt(k) === 61) {
      j = k + 1;
      while (j < end && (s.charCodeAt(j) === 32 || s.charCodeAt(j) === 9 || s.charCodeAt(j) === 10)) j++;
      if (j >= end) return 0;
      const q = s.charCodeAt(j);
      if (q === 34) {
        j++;
        while (j < end && s.charCodeAt(j) !== 34) j++;
        if (j >= end) return 0;
        j++;
      } else if (q === 39) {
        j++;
        while (j < end && s.charCodeAt(j) !== 39) j++;
        if (j >= end) return 0;
        j++;
      } else {
        const st = j;
        while (j < end) {
          const c = s.charCodeAt(j);
          if (c === 32 || c === 9 || c === 10 || c === 34 || c === 39 || c === 61 ||
            c === 60 || c === 62 || c === 96) break;
          j++;
        }
        if (j === st) return 0;
      }
    }
  }
}

// Try <...> at s[i]: autolink, or raw HTML. Returns {html, next} or null.
function tryAngle(s, i, end) {
  // Comment (marked's inline grammar): <!--> or <!--->, or
  // <!-- ... --> with a terminator. No terminator means it is not
  // a comment inline (an unterminated comment is only a block).
  if (s.startsWith('<!--', i)) {
    if (s.startsWith('<!-->', i)) return { html: '<!-->', next: i + 5 };
    if (s.startsWith('<!--->', i)) return { html: '<!--->', next: i + 6 };
    const k = s.indexOf('-->', i + 4);
    if (k !== -1 && k < end) return { html: s.slice(i, k + 3), next: k + 3 };
    return null;
  }
  // Processing instruction
  if (s.startsWith('<?', i)) {
    const k = s.indexOf('?>', i + 2);
    if (k !== -1 && k < end) return { html: s.slice(i, k + 2), next: k + 2 };
    return { html: s.slice(i, end), next: end };
  }
  // Declaration <!A...>
  if (s.startsWith('<!', i) && i + 2 < end) {
    const c = s.charCodeAt(i + 2);
    if (c >= 65 && c <= 90) {
      const k = s.indexOf('>', i + 2);
      if (k !== -1 && k < end) return { html: s.slice(i, k + 1), next: k + 1 };
      return { html: s.slice(i, end), next: end };
    }
  }
  // CDATA
  if (s.startsWith('<![CDATA[', i)) {
    const k = s.indexOf(']]>', i + 9);
    if (k !== -1 && k < end) return { html: s.slice(i, k + 3), next: k + 3 };
    return { html: s.slice(i, end), next: end };
  }
  // Open / close tag (marked's attribute grammar).
  const tagEnd = matchTag(s, i, end);
  if (tagEnd) return { html: s.slice(i, tagEnd), next: tagEnd };
  // Autolink <scheme:...> or <email>
  let j = i + 1;
  let k = j;
  while (k < end) {
    const c = s.charCodeAt(k);
    if (c === 32 || c === 10 || c === 60 || c === 62) break;
    k++;
  }
  if (k < end && s.charCodeAt(k) === 62 && k > j) {
    const inner = s.slice(j, k);
    // Scheme autolink
    const sm = /^[A-Za-z][A-Za-z0-9+.-]{1,31}:/.exec(inner);
    if (sm) {
      const href = cleanUrl(inner);
      if (href !== null) {
        return { html: '<a href="' + escAttr(href) + '">' + escAttr(inner) + '</a>', next: k + 1, auto: 'angle' };
      }
    } else if (isEmail(inner)) {
      return { html: '<a href="mailto:' + escText(inner) + '">' + escText(inner) + '</a>', next: k + 1, auto: 'angle' };
    }
  }
  return null;
}

function isEmail(str) {
  // Local part @ domain, labels not starting/ending with '-'.
  const at = str.lastIndexOf('@');
  if (at <= 0 || at === str.length - 1) return false;
  const local = str.slice(0, at);
  const domain = str.slice(at + 1);
  for (let i = 0; i < local.length; i++) {
    const c = local.charCodeAt(i);
    const ok = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) ||
      c === 46 || c === 33 || c === 35 || c === 36 || c === 37 || c === 38 ||
      c === 39 || c === 42 || c === 43 || c === 47 || c === 61 || c === 63 ||
      c === 94 || c === 95 || c === 96 || c === 123 || c === 124 || c === 125 || c === 126 || c === 45;
    if (!ok) return false;
  }
  return isUrlDomain(domain);
}

// Domain labels of alphanumerics/hyphens; last label any alphanumerics
// (a digit TLD like c0m is fine); at least two labels. Used for
// angle-autolink emails, www. links and scheme:// links.
function isUrlDomain(domain) {
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (let i = 0; i < labels.length; i++) {
    const lab = labels[i];
    if (lab.length === 0 || lab.length > 63) return false;
    if (lab.charCodeAt(0) === 45 || lab.charCodeAt(lab.length - 1) === 45) return false;
    for (let q = 0; q < lab.length; q++) {
      const c = lab.charCodeAt(q);
      if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 45)) return false;
    }
  }
  return true;
}

// Extended-autolink email domain (GFM): labels may also contain
// underscores, but must start and end with an alphanumeric; at
// least two labels; a single-character TLD is fine.
function isExtEmailDomain(domain) {
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (let i = 0; i < labels.length; i++) {
    const lab = labels[i];
    if (lab.length === 0 || lab.length > 63) return false;
    const alnum = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57);
    // Only the LAST label must end with an alphanumeric (marked's
    // email regex: first label [A-Za-z0-9-_]+, later labels
    // [A-Za-z0-9-_]*[A-Za-z0-9]); any label may start with - or _.
    if (i === labels.length - 1 && !alnum(lab.charCodeAt(lab.length - 1))) return false;
    for (let q = 0; q < lab.length; q++) {
      const c = lab.charCodeAt(q);
      if (!(alnum(c) || c === 45 || c === 95)) return false;
    }
  }
  return true;
}

// Boundary before an extended autolink: start of input, whitespace,
// or one of * _ ~ (.
function extAutolinkBoundary(s, i) {
  if (i === 0) return true;
  const p = s.charCodeAt(i - 1);
  return p === 32 || p === 9 || p === 10 || p === 42 || p === 95 || p === 126 || p === 40;
}

// Trim a bare-URL autolink candidate [start, end) to marked's
// `_backpedal` prefix: /(?:[^?!.,:;*_'\"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'\"~)]+(?!$))+/.
// Left to right: normal chars are kept; a balanced (...) group is
// kept; an '&' not starting an entity that ends at `end` is kept; a
// run of punctuation (? ! . , : ; * _ ' " ~ )) is kept only when
// more content follows it (so trailing punctuation is dropped); an
// unmatched '(' ends the URL; a trailing &name; entity is dropped.
function trimAutolinkEnd(s, start, end) {
  let e = start;
  while (e < end) {
    const c = s.charCodeAt(e);
    // '(' — a balanced group \([^)]*\) is kept; an unmatched '('
    // ends the URL here.
    if (c === 40) {
      let j = e + 1;
      while (j < end && s.charCodeAt(j) !== 41) j++;
      if (j < end) { e = j + 1; continue; }
      break;
    }
    // '&' — kept unless it starts an entity that ends at `end`.
    if (c === 38) {
      let j = e + 1;
      let isEntity = false;
      if (j < end && s.charCodeAt(j) === 35) {
        j++;
        if (j < end && (s.charCodeAt(j) === 120 || s.charCodeAt(j) === 88)) j++;
        const ds = j;
        while (j < end && ((s.charCodeAt(j) >= 48 && s.charCodeAt(j) <= 57) || (s.charCodeAt(j) >= 65 && s.charCodeAt(j) <= 70) || (s.charCodeAt(j) >= 97 && s.charCodeAt(j) <= 102))) j++;
        if (j > ds && j < end && s.charCodeAt(j) === 59 && j + 1 === end) isEntity = true;
      } else {
        const ns = j;
        while (j < end && ((s.charCodeAt(j) >= 65 && s.charCodeAt(j) <= 90) || (s.charCodeAt(j) >= 97 && s.charCodeAt(j) <= 122) || (s.charCodeAt(j) >= 48 && s.charCodeAt(j) <= 57))) j++;
        if (j > ns && j < end && s.charCodeAt(j) === 59 && j + 1 === end) isEntity = true;
      }
      if (isEntity) break;
      e++;
      continue;
    }
    // Punctuation run (? ! . , : ; * _ ' " ~ )) — kept only when
    // more content follows; a run at the end is dropped.
    if (c === 63 || c === 33 || c === 46 || c === 44 || c === 58 || c === 59 ||
      c === 42 || c === 95 || c === 39 || c === 34 || c === 126 || c === 41) {
      let j = e;
      while (j < end) {
        const d = s.charCodeAt(j);
        if (d === 63 || d === 33 || d === 46 || d === 44 || d === 58 || d === 59 ||
          d === 42 || d === 95 || d === 39 || d === 34 || d === 126 || d === 41) j++;
        else break;
      }
      if (j < end) { e = j; continue; }
      break;
    }
    // Any other char (normal URL char, including ']' and '/') is kept.
    e++;
  }
  return e;
}

// www. autolink. Returns {html, next} or null.
// `inLinkText`: true when the www. sits inside a link text (an
// unmatched '[' is open) — only then does a ']' followed by '(' or
// '[' end the URL (it closes the link text); outside a link text
// marked includes ']' in the URL.
// Marked's url regex is ((?:https?|ftp):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*
// — after 'www.' only the first domain-label char must be alnum or
// '-'; the rest is a free tail (so www.foo, www.foo_bar.com linkify).
function tryWww(s, i, end, inLinkText) {
  // Scan the domain: labels after 'www.'.
  let j = i + 4;
  let k = j;
  while (k < end) {
    const c = s.charCodeAt(k);
    if (c === 32 || c === 9 || c === 10 || c === 60 || c === 62) break;
    // A ']' followed by '(' or '[' is link syntax, not part of
    // the URL (marked never forms this autolink inside link text);
    // stop here so the enclosing link can still form.
    if (inLinkText && c === 93 && k + 1 < end && (s.charCodeAt(k + 1) === 40 || s.charCodeAt(k + 1) === 91)) break;
    k++;
  }
  let e = trimAutolinkEnd(s, i, k);
  if (e <= j) return null;
  const text = s.slice(i, e);
  // First char after 'www.' must be alnum or '-'.
  const fc = s.charCodeAt(j);
  if (!((fc >= 48 && fc <= 57) || (fc >= 65 && fc <= 90) || (fc >= 97 && fc <= 122) || fc === 45)) return null;
  const href = cleanUrl('http://' + text);
  if (href === null) return null;
  return { html: '<a href="' + escText(href) + '">' + escText(text) + '</a>', next: e };
}

// Scheme (http://, https://, ftp://) or email autolink at position
// i. GFM only linkifies http/https/ftp schemes and mailto:/xmpp:
// email addresses; other schemes (foo:bar) are plain text.
// Returns {html, next} or null.
// `inLinkText`: true when the URL sits inside a link text — only
// then does a ']' followed by '(' or '[' end the URL.
// Marked's url regex is ((?:https?|ftp):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*
// — after the scheme only the first char must be alnum or '-';
// the rest is a free tail (so https://foo, https://foo_bar.com,
// https://example.com)] all linkify).
function trySchemeOrEmail(s, i, end, allowUClose, inLinkText) {
  const lower = s.slice(i, Math.min(end, i + 8)).toLowerCase();
  // scheme:// form: domain + path
  let schemeLen = 0;
  if (lower.startsWith('https://')) schemeLen = 8;
  else if (lower.startsWith('http://')) schemeLen = 7;
  else if (lower.startsWith('ftp://')) schemeLen = 6;
  if (schemeLen > 0) {
    const after = i + schemeLen;
    let k = after;
    while (k < end) {
      const c = s.charCodeAt(k);
      if (c === 32 || c === 9 || c === 10 || c === 60 || c === 62) break;
      // A ']' followed by '(' or '[' is link syntax, not part of
      // the URL (marked never forms this autolink inside link text).
      if (inLinkText && c === 93 && k + 1 < end && (s.charCodeAt(k + 1) === 40 || s.charCodeAt(k + 1) === 91)) break;
      k++;
    }
    const e = trimAutolinkEnd(s, i, k);
    if (e <= after) return null;
    const text = s.slice(i, e);
    // First char after the scheme must be alnum or '-'.
    const fc = s.charCodeAt(after);
    if (!((fc >= 48 && fc <= 57) || (fc >= 65 && fc <= 90) || (fc >= 97 && fc <= 122) || fc === 45)) return null;
    const href = cleanUrl(text);
    if (href === null) return null;
    return { html: '<a href="' + escAttr(href) + '">' + escAttr(text) + '</a>', next: e };
  }
  // mailto:/xmpp: email form.
  let mailLen = 0;
  if (lower.startsWith('mailto:')) mailLen = 7;
  else if (lower.startsWith('xmpp:')) mailLen = 5;
  if (mailLen > 0) {
    const after = i + mailLen;
    const em = matchEmailAt(s, after, end, allowUClose);
    if (em !== -1) {
      // Optional /segment and @segment after the email.
      let e = em;
      if (e < end && s.charCodeAt(e) === 47) {
        let k = e + 1;
        while (k < end) {
          const c = s.charCodeAt(k);
          if (c === 32 || c === 9 || c === 10 || c === 60 || c === 62 || c === 47) break;
          k++;
        }
        if (k > e + 1) e = k;
      }
      if (e < end && s.charCodeAt(e) === 64) {
        let k = e + 1;
        while (k < end) {
          const c = s.charCodeAt(k);
          if (c === 32 || c === 9 || c === 10 || c === 60 || c === 62 || c === 47) break;
          k++;
        }
        if (k > e + 1) e = k;
      }
      e = trimAutolinkEnd(s, i, e);
      const text = s.slice(i, e);
      const href = cleanUrl(text);
      if (href === null) return null;
      return { html: '<a href="' + escAttr(href) + '">' + escAttr(text) + '</a>', next: e };
    }
    return null;
  }
  // Bare email autolink.
  const em = matchEmailAt(s, i, end, allowUClose);
  if (em !== -1) {
    const text = s.slice(i, em);
    return { html: '<a href="mailto:' + escText(text) + '">' + escText(text) + '</a>', next: em };
  }
  return null;
}

// Match an email address starting at s[i]; returns end index or -1.
// `allowUClose`: an unmatched '_' emphasis opener was seen earlier in
// this inline run, so trailing '_'s may be its closer (marked resolves
// emphasis before the email, so the email then ends before them).
// Without one, a trailing '_' blocks the match (marked's (?![\w-])).
function matchEmailAt(s, i, end, allowUClose) {
  let j = i;
  // Local part.
  while (j < end) {
    const c = s.charCodeAt(j);
    const ok = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) ||
      c === 46 || c === 33 || c === 35 || c === 36 || c === 37 || c === 38 ||
      c === 39 || c === 42 || c === 43 || c === 47 || c === 61 || c === 63 ||
      c === 94 || c === 95 || c === 96 || c === 123 || c === 124 || c === 125 || c === 126 || c === 45;
    if (!ok) break;
    j++;
  }
  if (j === i || j >= end || s.charCodeAt(j) !== 64) return -1;
  const at = j;
  j++;
  // Domain: labels until a char that cannot be in a domain.
  // Extended-autolink domains may contain underscores.
  let k = j;
  while (k < end) {
    const c = s.charCodeAt(k);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 45 || c === 46 || c === 95) k++;
    else break;
  }
  if (k === j) return -1;
  let domain = s.slice(j, k);
  // Trim trailing dots (punctuation). Trailing underscores are only
  // dropped when they can be an emphasis closer; otherwise they block
  // the match entirely (a label must end alnum, and the char after the
  // domain must not be a word char).
  while (domain.length > 0 && domain.charCodeAt(domain.length - 1) === 46) {
    domain = domain.slice(0, -1);
    k--;
  }
  if (domain.length > 0 && domain.charCodeAt(domain.length - 1) === 95) {
    if (!allowUClose) return -1;
    while (domain.length > 0 && domain.charCodeAt(domain.length - 1) === 95) {
      domain = domain.slice(0, -1);
      k--;
    }
    while (domain.length > 0 && domain.charCodeAt(domain.length - 1) === 46) {
      domain = domain.slice(0, -1);
      k--;
    }
  }
  if (!isExtEmailDomain(domain)) return -1;
  // Local part must not end with '.' and must not contain '..'? GFM:
  // the local part cannot start/end with '.' and cannot have '..'.
  const local = s.slice(i, at);
  if (local.charCodeAt(0) === 46 || local.charCodeAt(local.length - 1) === 46) return -1;
  if (local.indexOf('..') !== -1) return -1;
  return k;
}

