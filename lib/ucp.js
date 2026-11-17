// UCP / Shopify agent APIs: auth, Global Catalog MCP, merchant Cart + Checkout MCP.
// Docs: https://shopify.dev/docs/agents
import crypto from 'node:crypto';

export const CATALOG_URL = process.env.CATALOG_URL || 'https://catalog.shopify.com/api/ucp/mcp';
// Catalog calls use Shopify's example profile (it declares the catalog capabilities that return seller + checkout_url).
// Merchant Cart/Checkout calls use our own profile: AGENT_PROFILE if set, else the copy this app hosts on Vercel.
const SHOPIFY_EXAMPLE_PROFILE = 'https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json';
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
export const CATALOG_PROFILE = process.env.CATALOG_PROFILE || SHOPIFY_EXAMPLE_PROFILE;
export const AGENT_PROFILE = process.env.AGENT_PROFILE || (host ? `https://${host}/profiles/unbox-agent.json` : SHOPIFY_EXAMPLE_PROFILE);
const TOKEN_URL = 'https://api.shopify.com/auth/access_token';

export const hasCredentials = () => !!(process.env.CLIENT_ID && process.env.CLIENT_SECRET);

// ---------- auth: client_credentials token, cached until ~5 min before expiry ----------
let tokenCache = { token: null, exp: 0 };
export async function getToken() {
  if (!hasCredentials()) return null; // keyless (rate-limited) access
  if (tokenCache.token && Date.now() < tokenCache.exp - 5 * 60 * 1000) return tokenCache.token;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  if (!res.ok) throw new Error(`Token request failed: HTTP ${res.status}`);
  const { access_token } = await res.json();
  let exp = Date.now() + 55 * 60 * 1000;
  try {
    const payload = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64').toString('utf8'));
    if (payload.exp) exp = payload.exp * 1000;
  } catch (_) { /* opaque token: keep default */ }
  tokenCache = { token: access_token, exp };
  return access_token;
}

// ---------- JSON-RPC tools/call with 429 Retry-After + backoff ----------
let rpcId = 0;
export async function callTool(endpoint, name, args, { buyerIp } = {}) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (buyerIp && endpoint !== CATALOG_URL) headers['Shopify-Buyer-IP'] = buyerIp;
  const body = JSON.stringify({
    jsonrpc: '2.0', method: 'tools/call', id: ++rpcId,
    params: { name, arguments: { ...args, meta: { 'ucp-agent': { profile: endpoint === CATALOG_URL ? CATALOG_PROFILE : AGENT_PROFILE }, ...(args.meta || {}) } } }
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(endpoint, { method: 'POST', headers, body });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) || 2 ** attempt;
      await sleep(wait * 1000 + Math.random() * 300);
      continue;
    }
    const text = await res.text();
    const data = parseRpc(text);
    if (!res.ok || data?.error) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      const err = new Error(`${name} failed: ${msg}`);
      err.status = res.status;
      throw err;
    }
    return data?.result?.structuredContent ?? null;
  }
  throw new Error(`${name} failed: rate limited`);
}

// Servers may answer plain JSON or a one-shot SSE stream ("data: {...}").
function parseRpc(text) {
  try { return JSON.parse(text); } catch (_) { /* maybe SSE */ }
  const line = text.split('\n').reverse().find((l) => l.startsWith('data:'));
  if (!line) return null;
  try { return JSON.parse(line.slice(5).trim()); } catch (_) { return null; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Global Catalog ----------
export function searchCatalog({ query, filters = {}, context = {}, like, limit = 30, cursor }) {
  const catalog = { query, filters, context, pagination: { limit, ...(cursor ? { cursor } : {}) } };
  if (like) catalog.like = like;
  return callTool(CATALOG_URL, 'search_catalog', { catalog });
}
export function getProduct(id, selected = []) {
  return callTool(CATALOG_URL, 'get_product', { catalog: { id, ...(selected.length ? { selected } : {}) } });
}
export function lookupCatalog(ids, country = 'US') {
  return callTool(CATALOG_URL, 'lookup_catalog', { catalog: { ids: ids.slice(0, 50), context: { address_country: country } } });
}

// ---------- merchant UCP endpoint discovery ----------
const endpointCache = new Map();
export async function merchantEndpoint(origin) {
  if (endpointCache.has(origin)) return endpointCache.get(origin);
  let endpoint = `${origin}/api/ucp/mcp`;
  try {
    const res = await fetch(`${origin}/.well-known/ucp`);
    if (res.ok) {
      const doc = await res.json();
      const svc = [].concat(doc?.services?.['dev.ucp.shopping'] || []);
      const mcp = svc.find((s) => s.transport === 'mcp');
      if (mcp?.endpoint) endpoint = mcp.endpoint;
    }
  } catch (_) { /* fall back to default path */ }
  endpointCache.set(origin, endpoint);
  return endpoint;
}

// ---------- Cart MCP ----------
export async function createCart(origin, lines, { buyerIp, country = 'US' } = {}) {
  const ep = await merchantEndpoint(origin);
  return callTool(ep, 'create_cart', {
    cart: {
      line_items: lines.map((l) => ({ quantity: l.quantity || 1, item: { id: l.variantId } })),
      context: { address_country: country }
    }
  }, { buyerIp });
}

// ---------- Checkout MCP ----------
export async function createCheckout(origin, cartId, { buyerIp } = {}) {
  const ep = await merchantEndpoint(origin);
  return callTool(ep, 'create_checkout', { checkout: { cart_id: cartId, line_items: [] } }, { buyerIp });
}
export async function getCheckout(origin, id, { buyerIp } = {}) {
  const ep = await merchantEndpoint(origin);
  return callTool(ep, 'get_checkout', { id }, { buyerIp });
}
// update_checkout is PUT-like: resend everything we want to keep.
export async function updateCheckoutBuyer(origin, id, buyer, { buyerIp } = {}) {
  const current = (await getCheckout(origin, id, { buyerIp }))?.checkout || {};
  const ep = await merchantEndpoint(origin);
  return callTool(ep, 'update_checkout', {
    id,
    checkout: {
      currency: current.currency,
      context: current.context,
      line_items: (current.line_items || []).map((li) => ({ quantity: li.quantity, item: { id: li.item?.id } })),
      buyer: { ...(current.buyer || {}), ...buyer }
    }
  }, { buyerIp });
}
export async function completeCheckout(origin, id, payment, { buyerIp } = {}) {
  const ep = await merchantEndpoint(origin);
  return callTool(ep, 'complete_checkout', {
    id, checkout: { payment }, meta: { 'idempotency-key': crypto.randomUUID() }
  }, { buyerIp });
}
