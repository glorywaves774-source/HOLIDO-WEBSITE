// Safe formatting helpers for CMS text. All output is HTML-escaped first, so editors can never inject markup.
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// One pass over already-escaped text: [label](url), bare URLs, **bold**, *italic*, e-mail addresses.
const INLINE = /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)'"])|\*\*([^*\n]+)\*\*|(?<![\w*])\*([^*\n]+)\*(?![\w*])|\b([\w.+-]+@[\w-]+\.[\w.-]*[\w])\b/g;
function inline(escaped) {
  return escaped.replace(INLINE, (m, label, url, bare, bold, ital, mail) => {
    if (url) return `<a href="${url}" rel="noopener noreferrer"${url.startsWith('http') ? ' target="_blank"' : ''}>${label}</a>`;
    if (bare) return `<a href="${bare}" rel="noopener noreferrer" target="_blank">${bare}</a>`;
    if (bold) return `<strong>${bold}</strong>`;
    if (ital) return `<em>${ital}</em>`;
    if (mail) return `<a href="mailto:${mail}">${mail}</a>`;
    return m;
  });
}

// Plain text with blank-line paragraphs, "- " bullets, "1. " lists, "## " headings and "> " quotes → HTML.
function rich(text) {
  const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [], list = null, quote = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(l => inline(esc(l))).join('<br>') + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>` + list.items.map(i => '<li>' + inline(esc(i)) + '</li>').join('') + `</${list.tag}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { out.push('<blockquote>' + quote.map(l => inline(esc(l))).join('<br>') + '</blockquote>'); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if (!line.trim()) { flushAll(); continue; }
    if ((m = line.match(/^\s{0,3}(#{1,4})\s+(.+)$/))) { flushAll(); out.push('<h3>' + inline(esc(m[2])) + '</h3>'); continue; }
    if ((m = line.match(/^\s*[-*•–]\s+(.+)$/))) { flushPara(); flushQuote(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*\d{1,3}[.)]\s+(.+)$/))) { flushPara(); flushQuote(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    flushList(); flushQuote(); para.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}

// Strip the lightweight markup to plain text.
function plain(text) {
  return String(text == null ? '' : text).replace(/\r\n?/g, '\n')
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|mailto:)[^\s)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,4}\s+/gm, '').replace(/^\s*[-*•–>]\s+/gm, '').replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, '$1');
}

// First paragraph of a body, trimmed at a word boundary (used only when an item has no summary).
function excerpt(text, max = 260) {
  const first = plain(text).split(/\n\s*\n/).map(s => s.replace(/\s+/g, ' ').trim()).find(Boolean) || '';
  if (first.length <= max) return first;
  const cut = first.slice(0, max); const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, '') + '…';
}

// Summary text for a card. Shows the whole summary; falls back to an excerpt of the body only when there is no summary.
function cardText(item) {
  const t = (item.summary || '').trim();
  if (t) return '<p class="card-text">' + esc(t).replace(/\n/g, '<br>') + '</p>';
  const ex = excerpt(item.body);
  return ex ? '<p class="card-text">' + esc(ex) + '</p>' : '';
}

// Summary + full body, for items that have no detail page (partners, gallery, resources, people).
function fullText(item) {
  let h = '';
  const s = (item.summary || '').trim();
  if (s) h += '<p class="card-text">' + esc(s).replace(/\n/g, '<br>') + '</p>';
  if ((item.body || '').trim()) h += '<div class="rich">' + rich(item.body) + '</div>';
  return h;
}

const POS = /^(\d{1,3})(?:\.\d+)?% (\d{1,3})(?:\.\d+)?%$/;
function normPos(v) { const m = String(v || '').trim().match(POS); if (!m) return ''; return Math.min(100, +m[1]) + '% ' + Math.min(100, +m[2]) + '%'; }
function imgPos(item, fallback = '50% 50%') { return normPos(item && item.image_pos) || fallback; }
// alt + object-position attributes for an <img> (already escaped).
function imgAttrs(item, suffix = '', altOverride = '') {
  const alt = (item.image_alt || '').trim() || altOverride || (item.title || '') + suffix;
  return `alt="${esc(alt)}" style="object-position:${imgPos(item)}"`;
}

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T') + 'Z');
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Plain text with line breaks kept (used for introductions and quotations). Escaped, never raw HTML.
function para(text) { return esc(String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim()).replace(/\n/g, '<br>'); }

// "A, B" or one-per-line text -> clean list of short labels (for personality traits and areas of expertise).
function tags(text, max = 60) {
  return String(text == null ? '' : text).replace(/\r\n?/g, '\n').split(/[\n,;•]+/)
    .map(t => t.replace(/^\s*[-*–]\s*/, '').trim()).filter(Boolean).map(t => t.slice(0, 120)).slice(0, max);
}

// Initials for a portrait placeholder: first and last name, ignoring titles such as Mr., Mrs., Dr., Hon.
const TITLES = /^(mr|mrs|ms|miss|madam|dr|prof|rev|pastor|hon|eng|ing|alhaji|alhaja|chief|nana|sir|dame|apostle|bishop|imam)\.?$/i;
function initials(name) {
  const w = String(name == null ? '' : name).split(/\s+/).filter(Boolean).filter(x => !TITLES.test(x));
  if (!w.length) return '';
  const first = w[0][0], last = w.length > 1 ? w[w.length - 1][0] : '';
  return (first + last).toUpperCase();
}

module.exports = { esc, rich, plain, excerpt, cardText, fullText, para, tags, initials, imgPos, imgAttrs, normPos, fmtDate };
