#!/usr/bin/env node
/**
 * scripts/make-production-ready.mjs
 *
 * Converts the project from development state to production state by removing
 * every dev-only behaviour that was added to make local testing convenient.
 *
 * WHAT IT CHANGES
 * ───────────────
 * 1. Strips all blocks marked with // __DEV_ONLY_START__ … // __DEV_ONLY_END__
 *    from the TypeScript/TSX source files.  Currently that covers:
 *      • The GET /api/auth/dev-session endpoint (auth.ts)
 *      • The automatic dev_user login in AuthContext.tsx
 *      • The explanatory comment about the dev_user fallback in adminAuth.ts
 *
 * 2. Updates the ADMIN_USERNAME line in adminAuth.ts so that the "dev_user"
 *    fallback is removed — the variable now requires the env var to be set
 *    (matches the existing production guard that throws if it is absent).
 *
 * 3. Renumbers the auth-flow step comments in AuthContext.tsx so they are
 *    consecutive again after the dev step is removed.
 *
 * WHAT IT DOES NOT CHANGE
 * ───────────────────────
 * • No files outside the source tree are touched.
 * • No .env files, Docker configs, or deployment artefacts are modified.
 * • The changes are applied in-place to the working tree so you can review
 *   them with `git diff` before committing.
 *
 * HOW TO USE
 * ──────────
 * Run once from the project root when you are ready to go to production:
 *
 *   node scripts/make-production-ready.mjs
 *
 * Then:
 *   git diff                         # review every change
 *   git add -A && git commit -m "chore: switch to production auth"
 *   # follow deploy/DEPLOYMENT.md from here
 *
 * The script is idempotent — running it again on an already-converted project
 * produces no further changes (the markers no longer exist, so nothing is stripped).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Helpers ───────────────────────────────────────────────────────────────────

const BOLD  = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED   = "\x1b[31m";
const RESET = "\x1b[0m";

function pass(msg)  { console.log(`  ${GREEN}✔${RESET}  ${msg}`); }
function skip(msg)  { console.log(`  ${YELLOW}–${RESET}  ${msg} ${YELLOW}(already done)${RESET}`); }
function fail(msg)  { console.error(`  ${RED}✘${RESET}  ${msg}`); process.exitCode = 1; }

function readSrc(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function writeSrc(rel, content) {
  writeFileSync(resolve(ROOT, rel), content, "utf8");
}

/**
 * Strips every block delimited by
 *   // __DEV_ONLY_START__
 *   ...
 *   // __DEV_ONLY_END__
 * (both delimiter lines inclusive, including any leading whitespace/indentation).
 *
 * Returns { result, count } where count is the number of blocks removed.
 */
function stripDevOnlyBlocks(content) {
  const START = /^[^\S\n]*\/\/ __DEV_ONLY_START__\n/m;
  const END   = /[^\S\n]*\/\/ __DEV_ONLY_END__\n/m;

  let result = content;
  let count  = 0;

  for (;;) {
    const sm = START.exec(result);
    if (!sm) break;

    // Find the matching END after the start
    const afterStart = result.slice(sm.index + sm[0].length);
    const em = END.exec(afterStart);
    if (!em) {
      fail("Found __DEV_ONLY_START__ without a matching __DEV_ONLY_END__ — aborting.");
      process.exit(1);
    }

    // Remove everything from the start marker up to and including the end marker
    const endAbsolute = sm.index + sm[0].length + em.index + em[0].length;
    result = result.slice(0, sm.index) + result.slice(endAbsolute);
    count++;
  }

  return { result, count };
}

// ── 1. auth.ts — remove the GET /dev-session route ───────────────────────────

console.log(`\n${BOLD}1. artifacts/api-server/src/routes/auth.ts${RESET}`);

const AUTH_REL = "artifacts/api-server/src/routes/auth.ts";
try {
  const original = readSrc(AUTH_REL);
  const { result, count } = stripDevOnlyBlocks(original);

  if (count === 0) {
    skip("No dev-only blocks found — already converted.");
  } else if (result === original) {
    skip("Content unchanged after stripping (no-op).");
  } else {
    writeSrc(AUTH_REL, result);
    pass(`Removed ${count} dev-only block(s) (GET /dev-session route).`);
  }
} catch (err) {
  fail(`Could not process ${AUTH_REL}: ${err.message}`);
}

// ── 2. AuthContext.tsx — remove dev login block + renumber step comments ──────

console.log(`\n${BOLD}2. artifacts/eitashot/src/contexts/AuthContext.tsx${RESET}`);

const CTX_REL = "artifacts/eitashot/src/contexts/AuthContext.tsx";
try {
  let content = readSrc(CTX_REL);
  const { result: stripped, count } = stripDevOnlyBlocks(content);

  if (count === 0 && !stripped.includes("// 3. Auto-login via Eitaa SDK")) {
    skip("No dev-only blocks found and numbering already fixed — already converted.");
  } else {
    let updated = stripped;

    // After removing step 2 (dev-session), renumber the remaining steps:
    //   "// 3. Auto-login …" → "// 2. Auto-login …"
    //   "// 4. Guest fallback" → "// 3. Guest fallback"
    const before = updated;
    updated = updated.replace(
      /\/\/ 3\. Auto-login via Eitaa SDK/,
      "// 2. Auto-login via Eitaa SDK",
    );
    updated = updated.replace(
      /\/\/ 4\. Guest fallback/,
      "// 3. Guest fallback",
    );

    const renumbered = updated !== before;

    if (updated === content) {
      skip("Content unchanged after stripping (no-op).");
    } else {
      writeSrc(CTX_REL, updated);
      const parts = [];
      if (count > 0) parts.push(`removed ${count} dev-only block(s)`);
      if (renumbered) parts.push("renumbered auth-flow step comments");
      pass(parts.join(", ") + ".");
    }
  }
} catch (err) {
  fail(`Could not process ${CTX_REL}: ${err.message}`);
}

// ── 3. adminAuth.ts — remove dev comment + drop "dev_user" fallback ───────────

console.log(`\n${BOLD}3. artifacts/api-server/src/lib/adminAuth.ts${RESET}`);

const ADMIN_REL = "artifacts/api-server/src/lib/adminAuth.ts";
try {
  let content = readSrc(ADMIN_REL);
  const { result: stripped, count } = stripDevOnlyBlocks(content);

  // Replace the dev_user fallback with a non-null assertion.
  // After this the variable requires ADMIN_USERNAME to be set (the production
  // guard at the top of the file already throws if it is absent in production).
  const FALLBACK_PATTERN = /rawAdminUsername \?\? "dev_user"/;
  const hasFallback = FALLBACK_PATTERN.test(stripped);
  const updated = hasFallback
    ? stripped.replace(FALLBACK_PATTERN, "rawAdminUsername!")
    : stripped;

  if (count === 0 && !hasFallback) {
    skip("No dev-only blocks or fallback found — already converted.");
  } else if (updated === content) {
    skip("Content unchanged after transformation (no-op).");
  } else {
    writeSrc(ADMIN_REL, updated);
    const parts = [];
    if (count > 0)    parts.push(`removed ${count} dev-only block(s)`);
    if (hasFallback)  parts.push(`replaced "dev_user" fallback with non-null assertion`);
    pass(parts.join(", ") + ".");
  }
} catch (err) {
  fail(`Could not process ${ADMIN_REL}: ${err.message}`);
}

// ── Done ──────────────────────────────────────────────────────────────────────

if (!process.exitCode) {
  console.log(`
${GREEN}${BOLD}═══════════════════════════════════════════════════════${RESET}
${GREEN}${BOLD}  Project converted to production auth state.${RESET}
${GREEN}${BOLD}═══════════════════════════════════════════════════════${RESET}

  Next steps:

  1. Review all changes:
       git diff

  2. Commit:
       git add -A && git commit -m "chore: switch to production auth"

  3. Follow deploy/DEPLOYMENT.md to build and deploy.

  ${YELLOW}Note:${RESET} This change is intentionally one-way. To restore the
  dev conveniences, check out the pre-conversion commit with git.
`);
} else {
  console.log(`\n${RED}${BOLD}Conversion finished with errors — see above.${RESET}\n`);
}
