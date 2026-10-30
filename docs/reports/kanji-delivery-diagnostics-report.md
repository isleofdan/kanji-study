# Kanji delivery diagnostics — draft report

## What stands

Draft PR15 adds unique synthetic crash correlation, a fixed internal-only
grouping fingerprint and bounded SDK receipts. Its first real Linux runs
confirmed two captured loopback events but failed the final envelope policy
assertion: client-report and session items also arrived. No production release
or retest occurred.

The approved continuation permits only narrow aggregate error-loss diagnostics,
and blocks session/activity tracking. `lib/crash-envelope.js` enforces that
policy before the existing Node transport serializes/sends anything. It rebuilds
client reports from bounded numbers and known reason/category values; it passes
already-scrubbed single error envelopes unchanged and blocks other item types.
Request and process session collectors are disabled. Authentication, normal
error scrub/deduplication and browser behavior are unchanged.

## What the brief got wrong

Earlier mocks did not model SDK side envelopes. Explicit flush exposed existing
default collectors; CI supplies a release through its environment, which enables
session sending. These observations do not prove production sent session data.
Neither HTTP500, a capture ID nor SDK flush proves server storage.

## Deliberate divergences

The event-only test policy now has an explicitly approved diagnostic exception.
It independently checks report fields and rejects other envelope types, rather
than ignoring additional traffic. BeforeEnvelope cannot veto sends in SDK11.9.0,
so a small wrapper delegates to the existing transport factory; no networking,
retry implementation or dependency is added. Diagnostic envelope metadata is
empty; only error loss categories are retained, not activity/tracing counts.

## Verify results

Local malformed/unknown envelope unit checks and JavaScript syntax checks pass.
The repository includes a real-SDK isolated loopback test for generated loss
reports, mixed categories, extra-field stripping, unknown/session rejection and
flush/close. Complete real-SDK and full app checks must be read from the final
draft-head CI run; they are not claimed passed by this pre-CI report. Earlier
external16+38harnesses are not repository CI coverage.

## Asks

1. No deployment or merge requested. Review the exact final draft and CI evidence
   before considering a separately scoped release.

## What the next session needs

Retained count/time metadata helps diagnose losses but is still operational
information. Missing/malformed reports fail closed, and guard-rejected traffic
does not generate recursive diagnostics. Browser coverage and production stored
event privacy/grouping verification remain separate. The existing Deploy
workflow may provision resources, stage credentials and emits its own crash test;
do not treat a later deployment plus manual dispatch as a single invocation.
