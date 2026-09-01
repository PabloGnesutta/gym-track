# Feature / improvement ideas backlog

Brainstormed 2026-08-31. Not commitments — pull from here when picking up new work.
Status tags: `[ ]` not started, `[~]` in progress, `[x]` done.

## Quick wins

- [~] Exercise favoriting/pinning — pin regulars above the "most recently used" sort.
- [ ] kg/lb unit toggle — per-user display preference.
- [ ] Plate calculator — given a target weight + bar type, show plates to load.
- [ ] CSV/JSON export of session history — doubles as a manual backup given there's
      no account-deletion/backup story yet.
- [ ] Suggested next weight — "last time: 40kg x 10,8 → try 42.5kg" using the same
      PR data `analyticsService.getPersonalRecords` already computes.

## Medium

- [~] Volume trend chart — total working weight (kg × reps) per week, alongside the
      existing muscle-balance/frequency/PR widgets.
- [ ] Routines/templates — save a named list of exercises (e.g. "Push Day") to
      populate a session-start flow instead of picking exercises one at a time.
- [ ] RPE or RIR per set — one extra optional field on a set; would enrich analytics
      (e.g. flag when volume is up but RPE is also creeping up).
- [ ] Active-session management — list/revoke `auth_sessions` rows ("log out other
      devices"), now that accounts are multi-device.
- [ ] Login rate-limiting — CLAUDE.md's "Still not done" list flags this as missing;
      worth doing before this is used beyond a single trusted user.

## Bigger lifts

- [ ] Offline support — every read/write currently fails outright with no network.
      Fridge-track's outbox/LWW sync engine is the documented reference model if
      this is ever wanted.
- [ ] Account deletion — needs cascade-delete across exercises/sessions/muscles/
      auth_sessions.
- [ ] Workout reminders via push notifications — PWA/service worker already exists,
      so push is plausible, but needs a subscription-storage table and a scheduler.

## Notes

- Password reset was already shipped (`004_password_reset` migration,
  `requestPasswordReset`/`resetPassword` routes) — CLAUDE.md's "Still not done"
  section is stale on that point as of this writing.
