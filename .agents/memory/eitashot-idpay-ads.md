---
name: Eitashot IDPay + ads/donation system
description: Donation progress, advertisement booking, and IDPay payment integration architecture.
---

## Donation system
- GET /api/donation/progress — aggregates verified payments in current 30-day cycle
- POST /api/donation/start — creates IDPay session (persists idpayId BEFORE returning link, spec requirement)
- POST /api/donation/callback — IDPay POST redirect; server-to-server verify → update DB → redirect frontend
- Target: 298,000 Tomans/month = 2,980,000 Rials stored in DB
- `DONATION_CYCLE_START` env var sets origin date; defaults to first day of current UTC month

## Advertisement system
- Ads are Eitaa-channel-only (enforced by terms + backend text field)
- Flow: terms → form (channelLink, channelName, adText, adImage base64) → schedule (3 days × 4 slots) → POST /submit → POST /pay/:adId → IDPay → callback → pending_review
- Slot layout: slot 0 = 00-06, 1 = 06-12, 2 = 12-18, 3 = 18-24 Iran time
- Window price: `AD_WINDOW_PRICE_TOMANS` env (default 50,000 Tomans = 500,000 Rials)
- Reservation timeout: `RESERVATION_TIMEOUT_MINUTES` (default 30)
- Abuse guard: `MAX_EXPIRED_RESERVATIONS` in rolling 3-day window per IP (default 3)
- GET /api/ads/current — returns approved ad for current Iran window, or null

## IDPay integration
- lib/idpay.ts — createPayment, verifyPayment using native fetch
- Sandbox auto-enabled when NODE_ENV !== "production" (X-SANDBOX: 1 header)
- Amounts always in Rials (1 Toman = 10 Rials)
- idpayId persisted before returning payment link (idempotency)
- Status 100 = success, 101 = already verified (both treated as verified)

## Frontend overlay
- AdOverlay component: mounts globally in App.tsx; first show after 15s, auto-hides after 5s, repeats every 90s
- Shows ad if /api/ads/current returns one; falls back to donation progress card
- Jalali dates via Intl.DateTimeFormat('fa-IR-u-ca-persian') — no external dependencies

## Required env vars
- IDPAY_API_KEY — secret, set via Replit secrets
- APP_BASE_URL — for IDPay callback (defaults to REPLIT_DEV_DOMAIN)
- FRONTEND_URL — for post-payment redirect (defaults to REPLIT_DEV_DOMAIN)
- DONATION_CYCLE_START — ISO date string for cycle origin
- RESERVATION_TIMEOUT_MINUTES — default 30
- MAX_EXPIRED_RESERVATIONS — default 3
- AD_WINDOW_PRICE_TOMANS — default 50000
