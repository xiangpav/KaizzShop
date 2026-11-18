# KaizzShop — Roblox Top-Up (KHQR)

Static, mobile-first storefront for Roblox Robux top-ups with a real KHQR payment step.
No build step, no dependencies to install.

## Run locally

```bash
python -m http.server 8080
```

Open http://localhost:8080.

## Accept real payments (required)

The shop is wired to the ABA account from `assets/img/aba-qr.jpg`:
Bakong ID `abaakhppxxx@abaa`, KHR `018 047 828` / USD `018 047 827`.
Every checkout builds a dynamic USD KHQR that pays into this account.

Edit `assets/js/config.js` only if the account changes:

| Setting | What to put |
| --- | --- |
| `merchant.bakongId` | Your Bakong account ID, as shown in your banking app, e.g. `sophea@abaa` |
| `merchant.placeholder` | Keep `false` for the live account |
| `merchant.type` | `individual` for a personal Bakong ID (KHQR tag 29), or `merchant` for a business QR (tag 30, needs `merchantId` + `bankName`) |
| `telegramHandle` / `telegramUrl` | Your support account (`@Kaizz`, `https://t.me/Kaizz`) |
| `supportPhone` | Optional; added to the QR extra data |

Scan one live QR with the ABA app and pay $1.00 yourself before announcing the shop.

Each checkout creates a **dynamic KHQR** containing the exact amount, your order ID,
and a 15-minute expiry. It is scannable by ABA, ACLEDA, Wing, Bakong, Pi Pay, TrueMoney
and any other KHQR-enabled app. Test one small payment with your own bank app before launch.

While `merchant.placeholder` is `true`, checkout is blocked on any public host, so a
half-configured deploy can never show customers a QR that pays the wrong account.

## How orders work

There is no backend. The buyer's order is stored in `localStorage` on their phone, and the
"I've paid" button copies the order details and opens your Telegram chat so they can send
the receipt. You verify the payment in your bank app and deliver the Robux manually.

For automatic payment confirmation you would integrate the Bakong Open API (requires a
merchant registration and a server) — the QR itself is already standard-compliant.

## Prices

Prices live in `index.html` as `data-robux` / `data-price` on each `.pkg` button.
Update the visible text, the data attributes, and the poster image together.

## Deploy

Upload the whole folder to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages,
or your own hosting). Use HTTPS: the PWA install prompt and clipboard actions require it.

If you edit cached files after launch, bump `CACHE` in `sw.js` (e.g. `kaizz-v2`).

## Notes

- KaizzShop is not affiliated with Roblox Corporation.
- Never ask customers for their Roblox password — the site never does.
- `assets/img/kaizz-brand.jpg` and `kaizz-poster.jpg` are the supplied brand artwork.
