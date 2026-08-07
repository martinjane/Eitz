---
name: Eitashot dev session + auth
description: Simulated auth via GET /api/auth/dev-session; blocked in production by NODE_ENV check.
---

- `GET /api/auth/dev-session` returns a JWT for the dev user; only works when `NODE_ENV !== "production"`.
- Donation and ad endpoints are fully public (no auth middleware).
- IDPay callbacks use POST (IDPay redirects the browser via POST form-submit to the callback URL).
