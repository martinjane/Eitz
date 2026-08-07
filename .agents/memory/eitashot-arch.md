---
name: Eitashot architecture decisions
description: Key patterns for pan/zoom, upload bug, studio tools, Eitaa login prototype, dark theme, undo/redo, new logo, ad/channel management, admin panel
---

## Upload bug fix
`loadImage()` in EditorContext is async (downsampleIfNeeded). Never call `setLocation("/editor")` directly after `loadImage()` — use a `useEffect` in Home.tsx that watches `state.sourceImage`.  
Clear `state.sourceImage` in `handleBack` (Editor.tsx) so Home.tsx useEffect doesn't immediately redirect back.

**Why:** `setLocation` fired before `setState` completed inside the Promise, so the editor saw null sourceImage and redirected to Home.

## Pan/zoom viewport (EditorCanvas)
- `containerRef` (absolute inset-0, overflow: hidden) holds `viewportDivRef` (absolute, top:0 left:0, transform-origin:0 0) which holds the canvas.
- `applyViewportTransform()` mutates `viewportDivRef.style.transform` directly (bypasses React state = no re-renders during gesture).
- `toCanvasCoords` uses `canvas.getBoundingClientRect()` — CSS transforms are automatically accounted for, no math changes needed.
- Pinch zoom uses **incremental per-frame deltas** (prevDist/prevMidX/prevMidY) not a frozen start snapshot — supports simultaneous two-finger placement and natural pan+zoom together.
- Zoom widget (bottom-right): `−` slider `+` `%` — all refs, no React state.

## Toolbar position toggle
`toolbarPosition` state in `Editor.tsx` ("bottom"|"left"). Canvas area uses `dir="ltr"` flex row so left toolbar is physically on the left. ToolBar accepts `position` + `onToggle` props.

## Dark theme
- CSS variables in `index.css` under `.dark {}` block (warm dark: background `22 18% 9%`).
- `@custom-variant dark (&:is(.dark *))` already defined — toggle adds/removes `.dark` on `<html>`.
- `src/hooks/useTheme.ts` — `isDark` + `toggle`, persists to `localStorage('eitashot-theme')`.
- No-flash: inline `<script>` in `index.html` sets `.dark` class before React mounts.
- Dark canvas-bg override: `.dark .canvas-bg` with dark warm checkerboard (`#2a1f18` / `#1e1510`).

## Undo/redo (EditorContext)
- `pastRef` / `futureRef` (useRef arrays of `HistorySnapshot`) — MAX_HISTORY=20.
- `historySize` state drives `canUndo`/`canRedo` reactivity without flooding renders.
- `stateRef.current = state` (sync mirror) — async ops read from this instead of stale closure.
- `recordHistory()` called BEFORE each mutation. Async ops (applyCrop/Resize etc.) now live outside setState callback and use `stateRef.current` directly.
- FilterPreview MUST use `setFilter()` (not `setState`) — setFilter calls recordHistory.
- Adjustment reset MUST use `resetAdjustments()` (not `setState`) — same reason.

## Logo (EitashotLogo)
- Shared component: `src/components/EitashotLogo.tsx` — imported in both Home.tsx and Editor.tsx.
- Uses `React.useId()` for gradient IDs (sanitized with `.replace(/:/g, "")`).
- Design: InShot-style rounded square badge (`rx=9`), orange→amber gradient, camera body + lens + 4-point star sparkle.

## Studio-exclusive tool badges
`STUDIO_EXCLUSIVE = Set(["لوگو","واترمارک","بلور","کادر","کتابخانه","لایه‌ها"])`. Amber ★ in top-right corner of button when in studio mode and not active.

## Eitaa login prototype
`IS_EITAA_LOGGED_IN = false` constant in ToolPanel.tsx. Button does nothing until Eitaa Messenger SDK is integrated. Library panel shows locked state when not logged in.

## applyBlur / applyFrame
Both create a temp canvas, draw filtered image, and setState with new sourceImage dataURL. `applyBlur` uses `ctx.filter = blur(Npx)`. `applyFrame` expands canvas by borderWidth*2 on each side.

## Panel height
ToolPanel max-h is `162px`. Panels with more content use compact spacing (`space-y-2`, sliders instead of steppers).

## Ad / channel management (Settings page)
- Saved ads created in Settings; scheduled in AdvertisePage (separate concerns).
- POST /api/ads/create accepts `channelVerificationId` (int FK → channelVerifications); derives channelLink/channelName from DB row — user never types a URL.
- Ad image compressed client-side to ≤500 KB via canvas+JPEG in `compressImage()` before upload.
- ChannelRow shows a cancel button (calls DELETE /api/channels/:id) only when status="pending".
- Max 20 channels / 5 saved ads per user enforced server-side with `count()`.

## Admin panel (AdminPage.tsx)
- Four tabs: channels, ads, defaults, pricing.
- DefaultAdsPanel: CRUD for custom default ads stored as JSON array in pricingConfig key `default_custom_ads`.
- PricingPanel: includes donation_monthly_target_tomans + ad_submissions_disabled (maintenance mode toggle).
- Built-in defaults (app promo + donation) always available; custom defaults are randomly selected by GET /api/ads/current when no paid ad is running.

## Rate limiting architecture
- `globalLimiter` (500/15min) applied to all /api/* in app.ts — baseline defense.
- Targeted limiters on top: authLoginLimiter, signupLimiter, channelSubmitLimiter, adSubmitLimiter, adPayLimiter, donationStartLimiter, uploadWriteLimiter, generalReadLimiter, adminActionLimiter.
- adminActionLimiter applied via router.use() inside admin.ts after requireAdmin.

## Post-login role picker (RolePickerModal)
- `src/components/RolePickerModal.tsx` — shows once after first login (auth.status === "authenticated").
- Persists choice in localStorage key `eitashot_role_chosen`.
- Channel Owner → navigate to `/guide?tab=styles`; Normal User → `/guide?tab=tools`.
- Guide.tsx reads `?tab=` via `useSearch()` from wouter and initializes view state accordingly.

## Jalali export filename
- `toJalaliFilename()` in `lib/jalali.ts` — uses `Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn")` for ASCII digits.
- ToolPanel.tsx export: `a.download = \`${toJalaliFilename()}.jpg\``

## Advertisement upload and fallback behavior
- Advertisement image processing must have its own loading state and always clear it from success, decode/read failure, and exceptions; the submit handler must use `try/finally` so network/JSON errors cannot leave the button spinning.
- Server-side ad image validation is capped at 500 KB to match the client compression target.
- Fallback ads use a persisted `active_default_ad` pricing key (`built_in_promo`, `built_in_donation`, or `custom:<index>`); paid ads always take precedence and invalid custom selections fall back to the built-in promotion.

**Why:** The ad image flow previously had silent image errors and no submit `finally`, which could leave users in an unrecoverable loading state. Explicit fallback selection avoids random or unexpectedly changing default promotions.

## Admin removal safeguards
- Admin removal is limited to approved channels and approved saved/legacy ads; ads with reserved or paid windows are refused rather than deleted, preventing orphaned bookings.

**Why:** Removing active ad content without handling dependent windows would break payment/display records and create inconsistent scheduling state.
