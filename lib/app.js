// UNBOX API: shared by the local server (server.js) and Vercel (api/index.js).
// Discovery: Shopify Global Catalog MCP (UCP). Purchase: each merchant's UCP Cart + Checkout MCP.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ucp from './ucp.js';
import * as mock from './mock.js';
import { normalize, rank, originOf } from './rank.js';

loadEnv();
const MODE = (process.env.MOCK || 'auto').toLowerCase(); // '1' = always mock, '0' = always live, 'auto' = live, fall back to mock

export const forceMock = MODE === '1' || MODE === 'true';
export const allowFallback = MODE === 'auto';

// Try live; on failure use mock (auto mode). Returns { data, source, warning? }.
async function liveOr(liveFn, mockFn) {
  if (forceMock) return { data: await mockFn(), source: 'mock' };
  try {
    return { data: await liveFn(), source: 'live' };
  } catch (err) {
    if (!allowFallback) throw err;
    console.warn('[live failed → mock]', err.message);
    return { data: await mockFn(), source: 'mock', warning: err.message };
  }
}

export const routes = {
  'GET /api/status': async () => ({
    mode: forceMock ? 'mock' : allowFallback ? 'auto' : 'live',
    auth: ucp.hasCredentials() ? 'token' : 'keyless',
    profile: ucp.AGENT_PROFILE, catalogProfile: ucp.CATALOG_PROFILE,
    catalog: ucp.CATALOG_URL
  }),

  // Search + rank for fit and style.
  'POST /api/search': async (body) => {
    const { item = 'sofa', spot = {}, style = {}, budget = {}, heightIn, country = 'US', imageUrl } = body;
    const query = [style.vibe, ...(style.palette || []).slice(0, 2), item].filter(Boolean).join(' ');
    const filters = { available: true, ships_to: { country } };
    if (budget.min || budget.max) {
      filters.price = {};
      if (budget.min) filters.price.min = Math.round(budget.min * 100);
      if (budget.max) filters.price.max = Math.round(budget.max * 100);
    }
    const like = imageUrl ? [{ image: { url: imageUrl } }] : undefined;

    const res = await liveOr(async () => {
      try {
        return await ucp.searchCatalog({ query, filters, context: { address_country: country }, like, limit: 30 });
      } catch (err) {
        if (!like) throw err; // image search shape is the least certain part: retry text-only
        console.warn('[image search failed, retrying text only]', err.message);
        return ucp.searchCatalog({ query, filters, context: { address_country: country }, limit: 30 });
      }
    }, () => mock.mockSearch({ query, filters }));

    const products = (res.data?.products || []).map(normalize);
    const results = rank(products, { spot, style, budget, heightIn });
    return { query, source: res.source, warning: res.warning, total: res.data?.pagination?.total_count, results };
  },

  'POST /api/product': async ({ id, selected = [] }) => {
    const res = await liveOr(() => ucp.getProduct(id, selected), () => mock.mockProduct(id));
    const p = res.data?.product;
    return { source: res.source, product: p ? normalize(p) : null, raw: p };
  },

  // One UCP cart per merchant. If a store's Cart MCP refuses, fall back to its cart permalink.
  'POST /api/cart': async ({ lines = [], country = 'US' }, req) => {
    const buyerIp = buyerIpOf(req);
    const byOrigin = new Map();
    for (const l of lines) {
      const o = originOf(l);
      if (!o) continue;
      if (!byOrigin.has(o)) byOrigin.set(o, []);
      byOrigin.get(o).push(l);
    }
    const stores = await Promise.all([...byOrigin].map(async ([origin, group]) => {
      const seller = group[0].seller?.name || new URL(origin).hostname;
      try {
        const res = await liveOr(
          () => ucp.createCart(origin, group, { buyerIp, country }),
          () => mock.mockCreateCart(origin, group));
        const cart = res.data?.cart;
        const fatal = (cart?.messages || []).find((m) => m.severity === 'unrecoverable');
        if (!cart?.id || fatal) throw new Error(fatal?.content || 'No cart returned');
        return { origin, seller, mode: 'ucp', source: res.source, cartId: cart.id, totals: cart.totals,
          continueUrl: cart.continue_url, lines: group };
      } catch (err) {
        return { origin, seller, mode: 'permalink', error: err.message, lines: group,
          continueUrl: permalink(origin, group) };
      }
    }));
    return { stores };
  },

  // Cart → checkout, add buyer email, report status. Payment completes on the store unless the agent is trusted.
  'POST /api/checkout': async ({ origin, cartId, email }, req) => {
    const buyerIp = buyerIpOf(req);
    const created = await liveOr(() => ucp.createCheckout(origin, cartId, { buyerIp }), () => mock.mockCreateCheckout(origin, cartId));
    let checkout = created.data?.checkout;
    if (!checkout?.id) throw new Error('No checkout returned');
    if (email) {
      const upd = created.source === 'mock'
        ? { data: mock.mockUpdateBuyer(checkout.id, { email }) }
        : { data: await ucp.updateCheckoutBuyer(origin, checkout.id, { email }, { buyerIp }) };
      checkout = upd.data?.checkout || checkout;
    }
    return {
      source: created.source,
      id: checkout.id,
      status: checkout.status,
      totals: checkout.totals,
      messages: checkout.messages || [],
      continueUrl: safeContinue(checkout.continue_url)
    };
  }
};

// ---------- helpers ----------
function permalink(origin, group) {
  const items = group.map((l) => `${String(l.variantId).split('/').pop()}:${l.quantity || 1}`).join(',');
  return `${origin}/cart/${items}?utm_source=unbox`;
}
function safeContinue(u) {
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:') return null;
    url.searchParams.set('utm_source', 'unbox');
    return url.toString();
  } catch (_) { return null; }
}
function buyerIpOf(req) {
  if (process.env.BUYER_IP) return process.env.BUYER_IP;
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (fwd || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}
function loadEnv() {
  const f = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}


// Node-style handler for /api/* (works with http.createServer and Vercel functions).
export async function handleApi(req, res) {
  const pathname = new URL(req.url, 'http://x').pathname;
  const fn = routes[`${req.method} ${pathname}`];
  if (!fn) return send(res, 404, { error: 'Not found' });
  try {
    const body = req.method === 'POST' ? await readJson(req) : {};
    return send(res, 200, await fn(body, req));
  } catch (err) {
    console.error(pathname, err);
    return send(res, err.status && err.status < 500 ? err.status : 500, { error: err.message });
  }
}

function readJson(req) {
  if (req.body !== undefined) return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body); // Vercel pre-parses
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(Object.assign(new Error('Bad JSON'), { status: 400 })); } });
  });
}
export function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}
