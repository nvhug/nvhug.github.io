/**
 * Master kill-switch for every paid-upgrade surface.
 *
 * The app currently runs FREE for everyone, funded by voluntary donations that
 * unlock nothing. The paid-plan code (payment-config.ts, UpgradeModal.tsx, the
 * /api/upgrade routes, /admin/settings/upgrades) is intentionally kept in the
 * tree, fully typechecked, but unreachable — flipping one env var brings it back.
 *
 * WHY it is off: Vercel's Hobby plan forbids commercial use, and selling
 * subscriptions is commercial use. See ADR-017 in docs/DECISIONS.md for the full
 * re-enable runbook (env var + the SQL that re-gates notes.ai_analysis).
 *
 * NEXT_PUBLIC_ on purpose: the value is inlined at build time and read from both
 * server routes and client components, so both sides can never disagree.
 * Absent env == off. Only the exact string 'on' turns it on.
 *
 * ---------------------------------------------------------------------------
 * RE-ENABLE RUNBOOK — kept here, in a tracked file, because docs/ and sql/ are
 * both gitignored and can be lost. ADR-017 has the reasoning; this has the steps.
 *
 *   1. Move the deployment to a Vercel Pro plan first. Selling on Hobby is what
 *      this switch exists to prevent.
 *   2. Vercel -> Environment Variables -> NEXT_PUBLIC_MONETIZATION=on -> redeploy.
 *   3. Check NEXT_PUBLIC_PAYMENT_BANK_ID / _ACCOUNT_NO / _ACCOUNT_NAME still point
 *      at the right bank account.
 *   4. Re-gate the AI feature in the Supabase SQL editor:
 *        UPDATE page_permissions SET allowed = false
 *         WHERE page_key = 'notes.ai_analysis' AND role = 'user';
 *      (To go back to free: the same statement with allowed = true.)
 *   5. Audit AI_TRIAL_LIMITS in ./ai-trial.ts — every AI feature added after
 *      2026-08-27 needs an entry, or it stays free even with the switch on.
 *   6. Verify with a 'user'-role account: exhaust a quota, expect the UpgradeModal.
 *
 * The pre-change build is frozen at tag `monetization-v1` / branch
 * `feature/monetization` on origin (commit c3905ce).
 * ---------------------------------------------------------------------------
 */
export const MONETIZATION_ENABLED = process.env.NEXT_PUBLIC_MONETIZATION === 'on'
