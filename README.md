# UNBOX: code prototype

Furniture that fits your space and your style. This is a rough working prototype of the UNBOX flow running on **Shopify's Catalog API** for discovery and the **Universal Commerce Protocol (UCP)** for cart and checkout.

```
Room (spot + room size) → Style (vibe, palette, optional image, budget, height)
  → Results: Global Catalog search, ranked by fit + style
      swipe / catalog / saved (♥) · try it in a top-down plan of your room (drag, turn, back to suggested)
  → Cart: one UCP cart per store → UCP checkout → hand-off to the store to pay
```

## Run it

Needs Node 18+. There are no dependencies to install.

```bash
cp .env.example .env      # optional
npm start                 # http://localhost:3000  (live, falls back to mock data)
npm run mock              # always use mock data (works offline)
npm test                  # smoke test: search → product → cart → checkout (mock)
```

Open it in a phone-sized window, or with device emulation turned on.

## How it uses Shopify

| Step | Server | Tool | File |
|---|---|---|---|
| Auth (optional) | `POST https://api.shopify.com/auth/access_token` (client_credentials) | n/a | `lib/ucp.js` `getToken` |
| Search | Global Catalog MCP `https://catalog.shopify.com/api/ucp/mcp` | `search_catalog` with `query`, `filters.price` (minor units), `ships_to`, `available`, optional `like` (image), `pagination.limit` | `lib/ucp.js` `searchCatalog` |
| Product detail | Global Catalog MCP | `get_product` | `lib/ucp.js` `getProduct` |
| Cart | Each merchant's UCP MCP, found via `/.well-known/ucp` (falls back to `{origin}/api/ucp/mcp`) | `create_cart` | `lib/ucp.js` `createCart` |
| Checkout | Merchant UCP MCP | `create_checkout` (from `cart_id`), `get_checkout`, `update_checkout` (buyer email, PUT-style) | `lib/ucp.js` |
| Payment | Merchant UCP MCP | `complete_checkout` is wrapped but **not called**. Unless your agent is trusted, checkouts come back `requires_escalation` and the buyer pays at `continue_url`. | `lib/ucp.js` `completeCheckout` |

Every call is JSON-RPC `tools/call` with `meta["ucp-agent"].profile`. Merchant calls also send `Shopify-Buyer-IP`. If a call gets a 429, the client waits for `Retry-After` and backs off before retrying.

If a store's Cart MCP refuses the request, the app builds a **cart permalink** for that store (`/cart/{variant}:{qty}`), so the buyer still gets a working link.

## What UNBOX adds on top (`lib/rank.js`)

- **Dimensions.** Catalog has no structured size field, so width, depth, height and seat height are read from the title, description and options. It handles formats like `84"W x 36"D`, `Width: 213 cm` and `82 x 35 x 31 in`, and converts cm to inches.
- **Match %.** Fit counts for 45%, style 35% (palette color words plus vibe words), budget 12% and rating 8%. Each result also gets a fit line ("Fits · 78″ wide, 6″ to spare" or "Too wide by 4″"), a seat-height check based on your height, and up to three reasons.
- **Try in my room.** A top-down plan in inches. The suggested spot is drawn dashed. You can drag the piece anywhere in the room and turn it, and it warns you if it blocks the door swing.

## Deploy to Vercel

The repo is Vercel-ready: `public/` is served as static files, and `api/index.js` runs the API as a serverless function (see `vercel.json`).

1. On vercel.com, click **Add New → Project** and import this GitHub repo. Leave the framework preset as **Other** and the build settings empty.
2. Under **Environment Variables**, add `CLIENT_ID` and `CLIENT_SECRET`. Don't commit `.env`.
3. Click **Deploy**.

On Vercel, the buyer IP comes from the visitor's real address, so leave `BUYER_IP` unset. The merchant agent profile defaults to this app's own `https://<your-app>.vercel.app/profiles/unbox-agent.json`.

## Going live locally

1. In the Shopify **Dev Dashboard**, create an app to get `CLIENT_ID` and `CLIENT_SECRET`. Without them, the Global Catalog is called keyless and is rate limited.
2. Host `public/profiles/unbox-agent.json` at a public URL. It declares the cart and checkout capabilities. Set `AGENT_PROFILE` to that URL. The default is Shopify's example profile, which is fine for search.
3. When testing locally, set `BUYER_IP` to your real public IP. Merchant MCPs reject requests without a valid buyer IP.
4. Set `MOCK=0` to see real errors instead of the mock fallback.

## Known gaps (it's a prototype)

- The exact `like` (image search) payload shape is a best guess: `[{ image: { url } }]`. If it fails, the server retries the search text-only.
- No room scan. You type in the room measurements.
- Saved items and the cart are kept in localStorage in the browser, with no accounts and no Shop sign-in.
- Delivery dates, the same-week toggle and feng shui from the design aren't wired up yet.

Docs: https://shopify.dev/docs/agents · Catalog: https://shopify.dev/docs/agents/catalog · Cart: https://shopify.dev/docs/agents/get-started/build-a-cart · Checkout: https://shopify.dev/docs/agents/get-started/checkout
