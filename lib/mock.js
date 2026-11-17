// Mock mode: returns the same UCP structuredContent shapes as the real MCP servers,
// so the whole app (normalizing, ranking, cart, checkout) runs offline.
import crypto from 'node:crypto';

const STORES = [
  { name: 'Hearth & Loom', domain: 'hearth-and-loom.example' },
  { name: 'Field Supply Co.', domain: 'field-supply.example' },
  { name: 'Oak & Ember', domain: 'oak-and-ember.example' },
  { name: 'Northbound Home', domain: 'northbound-home.example' },
  { name: 'Little Atelier', domain: 'little-atelier.example' }
];

const BASE = {
  sofa: [
    ['Mara Curved Sofa', 'Terracotta boucle', '#C2573A', 78, 34, 31, 17, 118000, 0],
    ['Olen Linen 3-Seater', 'Oatmeal linen', '#E4D3BC', 80, 36, 33, 18, 94000, 1],
    ['Wren Tufted Sofa', 'Cream, mid-century tapered legs', '#EFE6D6', 82, 35, 32, 17, 105000, 2],
    ['Sable Low Sofa', 'Sage velvet, japandi low profile', '#8A9A7B', 76, 38, 27, 15, 142000, 3],
    ['Juno Loveseat', 'Mustard, small-space pick', '#AD862B', 62, 32, 31, 18, 69000, 4],
    ['Bryce Modular Sectional', 'Charcoal grey, reconfigurable', '#6E6B66', 96, 38, 30, 17, 189000, 3],
    ['Ines Rattan Settee', 'Natural rattan, bohemian', '#C8A877', 58, 30, 32, 17, 54000, 4],
    ['Cole Leather Sofa', 'Cognac leather, industrial steel base', '#8A4A2A', 84, 37, 31, 18, 165000, 2]
  ],
  chair: [
    ['Pia Lounge Chair', 'Rust boucle, curved minimal', '#B65A3C', 30, 32, 29, 16, 48000, 0],
    ['Hugo Accent Chair', 'Walnut frame, cream cushion, mid-century', '#7A5236', 27, 30, 31, 17, 39000, 2],
    ['Noor Rattan Chair', 'Natural woven rattan', '#C8A877', 26, 28, 33, 17, 29000, 4],
    ['Otto Armchair', 'Sage linen, oak legs', '#8A9A7B', 29, 31, 30, 18, 52000, 1]
  ],
  table: [
    ['Rho Oak Coffee Table', 'Light oak, round minimal', '#C9A57A', 36, 36, 16, 0, 32000, 1],
    ['Tove Walnut Coffee Table', 'Walnut, mid-century oval', '#6A4630', 44, 24, 15, 0, 41000, 2],
    ['Isla Travertine Table', 'Cream stone, low japandi', '#E6DCCB', 40, 22, 14, 0, 68000, 3]
  ],
  rug: [
    ['Dune Wool Rug 5x8', 'Cream and rust stripe, flatweave', '#E9D9C4', 96, 60, 1, 0, 26000, 0],
    ['Moss Jute Rug 6x9', 'Natural jute, bohemian', '#B9A27C', 108, 72, 1, 0, 31000, 4]
  ]
};

const pickType = (q = '') => {
  q = q.toLowerCase();
  if (/chair|armchair|lounge/.test(q)) return 'chair';
  if (/table|desk/.test(q)) return 'table';
  if (/rug|carpet/.test(q)) return 'rug';
  return 'sofa';
};

const svgImage = (hex) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#F5F4F1"/>` +
  `<rect x="80" y="90" width="240" height="70" rx="28" fill="${hex}"/><rect x="62" y="140" width="276" height="56" rx="18" fill="${hex}" style="filter:brightness(.9)"/>` +
  `<rect x="50" y="120" width="40" height="76" rx="16" fill="${hex}"/><rect x="310" y="120" width="40" height="76" rx="16" fill="${hex}"/>` +
  `<rect x="86" y="196" width="8" height="18" fill="#3A2A1E"/><rect x="306" y="196" width="8" height="18" fill="#3A2A1E"/></svg>`);

const toProduct = (type) => ([title, sub, hex, w, d, h, seat, price, s], i) => {
  const store = STORES[s];
  const pid = `gid://shopify/p/mock-${type}-${i}`;
  const vid = `gid://shopify/ProductVariant/${910000 + i * 7 + type.length}`;
  const color = sub.split(/[ ,]/)[0];
  return {
    id: pid,
    title,
    url: `https://${store.domain}/products/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    description: { html: `<p>${sub}.</p><p>Dimensions: ${w}"W x ${d}"D x ${h}"H${seat ? ` · Seat height ${seat}"` : ''}.</p>` },
    categories: [{ value: `Furniture > ${type}`, taxonomy: 'shopify' }],
    price_range: { min: { amount: price, currency: 'USD' }, max: { amount: price, currency: 'USD' } },
    media: [{ type: 'image', url: svgImage(hex), alt_text: title }],
    options: [{ name: 'Color', values: [{ label: color }] }],
    rating: { value: 4 + ((i * 3) % 10) / 10, scale_max: 5, count: 20 + i * 13 },
    variants: [{
      id: vid, sku: `MOCK-${i}`, title: color,
      price: { amount: price, currency: 'USD' },
      list_price: i % 3 === 0 ? { amount: Math.round(price * 1.15), currency: 'USD' } : undefined,
      checkout_url: `https://${store.domain}/cart/${vid.split('/').pop()}:1`,
      availability: { available: true, status: 'in_stock' },
      seller: { name: store.name, domain: store.domain, url: `https://${store.domain}` }
    }]
  };
};

const all = () => Object.entries(BASE).flatMap(([t, rows]) => rows.map(toProduct(t)));

export function mockSearch({ query, filters = {} }) {
  let products = BASE[pickType(query)].map(toProduct(pickType(query)));
  if (filters.price) products = products.filter((p) =>
    (!filters.price.min || p.price_range.min.amount >= filters.price.min) &&
    (!filters.price.max || p.price_range.min.amount <= filters.price.max));
  return { ucp: { version: '2026-08-25', capabilities: {} }, products, pagination: { has_next_page: false, total_count: products.length } };
}
export function mockProduct(id) {
  return { product: all().find((p) => p.id === id) || null };
}

const carts = new Map(), checkouts = new Map();
const lookupVariant = (vid) => all().find((p) => p.variants[0].id === vid);

export function mockCreateCart(origin, lines) {
  const id = `gid://shopify/Cart/mock-${crypto.randomUUID().slice(0, 8)}`;
  const line_items = lines.map((l, i) => {
    const p = lookupVariant(l.variantId);
    const amount = p ? p.variants[0].price.amount : 0;
    return { id: `li-${i}`, item: { id: l.variantId, title: p?.title, price: amount }, quantity: l.quantity || 1,
      totals: [{ type: 'subtotal', amount: amount * (l.quantity || 1) }] };
  });
  const sub = line_items.reduce((a, li) => a + li.totals[0].amount, 0);
  const cart = { id, currency: 'USD', line_items, continue_url: `${origin}/cart/c/mock?utm_source=unbox`,
    totals: [{ type: 'subtotal', amount: sub, display_text: 'Subtotal' }, { type: 'total', amount: sub, display_text: 'Estimated total' }] };
  carts.set(id, { origin, cart });
  return { cart };
}
export function mockCreateCheckout(origin, cartId) {
  const c = carts.get(cartId)?.cart;
  const id = `gid://shopify/Checkout/mock-${crypto.randomUUID().slice(0, 8)}`;
  const checkout = { id, status: 'incomplete', currency: 'USD', line_items: c?.line_items || [], buyer: {},
    totals: c?.totals || [], continue_url: `${origin}/checkouts/mock?utm_source=unbox`,
    messages: [{ type: 'info', severity: 'recoverable', content: 'Buyer email required' }] };
  checkouts.set(id, checkout);
  return { checkout };
}
export function mockUpdateBuyer(id, buyer) {
  const co = checkouts.get(id);
  if (!co) return { checkout: null };
  co.buyer = { ...co.buyer, ...buyer };
  // Payment needs a trusted-agent payment handler; in mock we escalate like most real stores do.
  co.status = 'requires_escalation';
  co.messages = [{ type: 'info', severity: 'requires_buyer_input', content: 'Payment needs the buyer: continue on the store to pay securely.' }];
  return { checkout: co };
}
