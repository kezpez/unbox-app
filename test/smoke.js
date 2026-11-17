// Smoke test: boots the server in mock mode and walks search → product → cart → checkout.
import { spawn } from 'node:child_process';
const PORT = 3999;
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, MOCK: '1', PORT: String(PORT) }, stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, b) => { const r = await fetch(`http://localhost:${PORT}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json(); if (!r.ok) throw new Error(p + ': ' + j.error); return j; };
const ok = (c, m) => { if (!c) throw new Error('FAIL ' + m); console.log('✓', m); };
try {
  await sleep(500);
  const st = await (await fetch(`http://localhost:${PORT}/api/status`)).json();
  ok(st.mode === 'mock', 'status reports mock mode');
  const s = await post('/api/search', { item: 'sofa', spot: { width: 84, depth: 38 }, style: { vibe: 'warm minimal', palette: ['rust', 'cream'] }, budget: { max: 1500 }, heightIn: 64 });
  ok(s.results.length > 0, `search returned ${s.results.length} ranked sofas`);
  ok(s.results.every((r, i, a) => i === 0 || a[i - 1].match >= r.match), 'results sorted by match');
  ok(s.results.every((r) => r.price <= 150000), 'budget filter applied');
  const top = s.results[0];
  console.log('  top:', top.title, top.match + '%', '|', top.fitText, '|', top.seatText, '|', top.reasons.join(', '));
  ok(s.results.some((r) => r.fits === false) || s.results.every((r) => r.fits), 'fit computed');
  const pr = await post('/api/product', { id: top.id });
  ok(pr.product?.id === top.id, 'get_product round-trip');
  const second = s.results.find((r) => r.seller.name !== top.seller.name);
  const lines = [top, second].map((p) => ({ variantId: p.variantId, checkoutUrl: p.checkoutUrl, seller: p.seller, quantity: 1 }));
  const c = await post('/api/cart', { lines });
  ok(c.stores.length === 2 && c.stores.every((x) => x.mode === 'ucp' && x.cartId), 'one UCP cart per store');
  const co = await post('/api/checkout', { origin: c.stores[0].origin, cartId: c.stores[0].cartId, email: 'test@example.com' });
  ok(co.status && co.continueUrl, `checkout created: ${co.status}`);
  console.log('\nAll smoke tests passed.');
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { srv.kill(); }
