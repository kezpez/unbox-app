// Turns UCP catalog products into UNBOX results: dimensions, fit, style match, % score.

const COLOR_WORDS = {
  rust: ['rust', 'terracotta', 'clay', 'burnt orange', 'cognac', 'brick', 'copper', 'orange'],
  cream: ['cream', 'ivory', 'off-white', 'oatmeal', 'natural', 'linen', 'beige', 'bone', 'sand', 'white'],
  sage: ['sage', 'olive', 'green', 'moss', 'eucalyptus'],
  brass: ['brass', 'mustard', 'gold', 'ochre', 'amber', 'yellow'],
  charcoal: ['charcoal', 'black', 'graphite', 'slate', 'grey', 'gray'],
  walnut: ['walnut', 'brown', 'chocolate', 'espresso', 'oak', 'teak', 'wood'],
  blue: ['blue', 'navy', 'indigo', 'denim', 'teal']
};
const VIBE_WORDS = {
  'warm minimal': ['minimal', 'modern', 'clean', 'simple', 'linen', 'boucle', 'oak', 'curved', 'low'],
  'mid-century': ['mid-century', 'mid century', 'tapered', 'walnut', 'retro', 'tufted', 'teak'],
  scandinavian: ['scandi', 'scandinavian', 'nordic', 'oak', 'light wood', 'minimal'],
  japandi: ['japandi', 'low', 'oak', 'natural', 'linen', 'minimal', 'wabi'],
  bohemian: ['boho', 'bohemian', 'rattan', 'woven', 'jute', 'velvet', 'pattern'],
  industrial: ['industrial', 'metal', 'leather', 'steel', 'iron', 'reclaimed'],
  traditional: ['traditional', 'rolled arm', 'chesterfield', 'tufted', 'classic', 'skirted']
};

const IN_PER_CM = 1 / 2.54;
const num = (s) => parseFloat(String(s).replace(',', '.'));

// Pull W x D x H (inches) out of free text. Handles `84"W x 36"D x 32"H`, `Width: 84 in`, `213 cm W`, `84 x 36 x 32 in`.
export function parseDimensions(text) {
  if (!text) return {};
  const t = text.replace(/<[^>]+>/g, ' ').replace(/[”″]/g, '"').replace(/&quot;/g, '"');
  const out = {};
  const unitToIn = (v, u) => (/cm|centim/i.test(u || '') ? v * IN_PER_CM : v);

  const N = '(\\d+(?:[.,]\\d+)?)', U = '("|in\\b|inch(?:es)?|cm)';
  const labeled = [
    ['width', new RegExp(`${N}\\s*${U}\\s*(?:w\\b|wide|width)`, 'i')],
    ['width', new RegExp(`(?:\\bwidth|\\bw\\b|\\bwide\\b)\\s*[:\\-]?\\s*${N}\\s*${U}?`, 'i')],
    ['depth', new RegExp(`${N}\\s*${U}\\s*(?:d\\b|deep|depth)`, 'i')],
    ['depth', new RegExp(`(?:\\bdepth|\\bd\\b|\\bdeep\\b)\\s*[:\\-]?\\s*${N}\\s*${U}?`, 'i')],
    ['seat', new RegExp(`seat\\s*height\\s*[:\\-]?\\s*${N}\\s*${U}?`, 'i')],
    ['height', new RegExp(`${N}\\s*${U}\\s*(?:h\\b|high|tall|height)`, 'i')],
    ['height', new RegExp(`(?<!seat\\s{0,3})(?:\\bheight|\\bh\\b|\\btall\\b)\\s*[:\\-]?\\s*${N}\\s*${U}?`, 'i')]
  ];
  for (const [key, re] of labeled) {
    if (out[key]) continue;
    const m = t.match(re);
    if (m) out[key] = unitToIn(num(m[1]), m[2]);
  }
  if (!out.width) {
    const m = t.match(/(\d+(?:[.,]\d+)?)\s*"?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*"?\s*(?:[x×]\s*(\d+(?:[.,]\d+)?))?\s*("|in\b|inch(?:es)?|cm)?/i);
    if (m) {
      out.width = unitToIn(num(m[1]), m[4]);
      out.depth = out.depth || unitToIn(num(m[2]), m[4]);
      if (m[3]) out.height = out.height || unitToIn(num(m[3]), m[4]);
    }
  }
  for (const k of Object.keys(out)) {
    out[k] = Math.round(out[k] * 10) / 10;
    if (out[k] < 8 || out[k] > 200) delete out[k]; // nonsense guard
  }
  return out;
}

const money = (minor, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format((minor || 0) / 100);

// UCP product -> flat object the UI uses.
export function normalize(p) {
  const v = p.variants?.[0] || {};
  const price = v.price?.amount ?? p.price_range?.min?.amount ?? 0;
  const currency = v.price?.currency || p.price_range?.min?.currency || 'USD';
  const desc = p.description?.html || p.description?.plain || '';
  const optionText = (p.options || []).map((o) => `${o.name}: ${(o.values || []).map((x) => x.label).join(', ')}`).join(' · ');
  const blob = [p.title, desc, optionText, v.title, v.description?.plain].filter(Boolean).join(' \n ');
  const image = (p.media || []).find((m) => m.type === 'image')?.url || null;
  return {
    id: p.id,
    title: p.title,
    url: p.url,
    image,
    price,
    priceText: money(price, currency),
    listPriceText: v.list_price?.amount > price ? money(v.list_price.amount, currency) : null,
    currency,
    rating: p.rating || null,
    categories: (p.categories || []).map((c) => c.value),
    colors: (p.options || []).filter((o) => /colou?r/i.test(o.name)).flatMap((o) => o.values.map((x) => x.label)),
    variantId: v.id || null,
    checkoutUrl: v.checkout_url || null,
    available: v.availability?.available !== false,
    seller: v.seller ? { name: v.seller.name, domain: v.seller.domain, url: v.seller.url } : null,
    dims: parseDimensions(blob),
    _text: blob.toLowerCase()
  };
}

// Score 0–100 from fit, style, budget and rating. Weights mirror the UNBOX promise: fit first, then style.
export function rank(products, { spot = {}, style = {}, budget = {}, heightIn } = {}) {
  const palette = (style.palette || []).map((c) => c.toLowerCase());
  const vibe = (style.vibe || '').toLowerCase();
  const vibeWords = VIBE_WORDS[vibe] || vibe.split(/\s+/).filter(Boolean);
  const idealSeat = heightIn ? heightIn * 0.265 : null;

  return products.map((p) => {
    const reasons = [];
    // --- fit (45) ---
    let fit = 0.5, fitText = 'Size not listed: check the product page', fits = null;
    if (p.dims.width && spot.width) {
      const spare = spot.width - p.dims.width;
      const depthOk = !p.dims.depth || !spot.depth || p.dims.depth <= spot.depth;
      fits = spare >= 0 && depthOk;
      if (!depthOk) { fit = 0.1; fitText = `Too deep by ${Math.round(p.dims.depth - spot.depth)}″`; }
      else if (spare < 0) { fit = 0; fitText = `Too wide by ${Math.round(-spare)}″`; }
      else {
        fit = spare <= 12 ? 1 : Math.max(0.6, 1 - (spare - 12) / 40); // fills the wall nicely
        fitText = `Fits · ${Math.round(p.dims.width)}″ wide, ${Math.round(spare)}″ to spare`;
        reasons.push('Fits your spot');
      }
    }
    // --- style (35): palette color words + vibe words found in title/desc/options ---
    const colorHits = palette.filter((c) => (COLOR_WORDS[c] || [c]).some((w) => p._text.includes(w)));
    const vibeHits = vibeWords.filter((w) => p._text.includes(w));
    const styleScore = Math.min(1, colorHits.length * 0.45 + vibeHits.length * 0.2 + 0.15);
    if (colorHits.length) reasons.push(`${cap(colorHits[0])} fits your palette`);
    if (vibeHits.length) reasons.push(`${cap(vibeHits[0])} look`);
    // --- budget (12) ---
    let budgetScore = 1;
    if (budget.max && p.price > budget.max * 100) budgetScore = Math.max(0, 1 - (p.price / 100 - budget.max) / budget.max);
    // --- rating (8) ---
    const ratingScore = p.rating?.value ? p.rating.value / (p.rating.scale_max || 5) : 0.7;
    // --- seat height (optional) ---
    let seatText = null;
    if (idealSeat && p.dims.seat) {
      const d = p.dims.seat - idealSeat;
      seatText = `Seat ${Math.round(p.dims.seat)}″ · ${Math.abs(d) <= 1.5 ? 'just right for you' : d < 0 ? 'low for your height' : 'high for your height'}`;
    }

    const match = Math.round(100 * (0.45 * fit + 0.35 * styleScore + 0.12 * budgetScore + 0.08 * ratingScore));
    const { _text, ...clean } = p;
    return { ...clean, match, fits, fitText, seatText, reasons: reasons.slice(0, 3) };
  }).sort((a, b) => b.match - a.match);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Merchant origin for the Cart/Checkout MCP, taken from the variant's checkout_url.
export function originOf(p) {
  const u = p.checkoutUrl || p.url;
  try { return new URL(u).origin; } catch (_) { return null; }
}
