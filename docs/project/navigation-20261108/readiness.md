# Shared navigation integration

The nine primary destinations now come from one owned navigation module and one canonical stylesheet: home, practice, Buddhist teachers, schools, resources, articles, whitepaper, films and the curated video collection. The brand returns to `/`; practice has the independent `/zh/practice` route. Neutral login and English-language links remain available without inferring account state.

The full header and mobile disclosure menu share the same destinations and current-page decision. Module controls remain separate. The meditation timer and image-reading view preserve their immersive layouts and visible return paths instead of displaying the full site menu over the reading or practice surface.

## Scope and safeguards

- The response wrapper owns a reviewed list of public document routes. It preserves body content and underlying application routing, does not broaden authentication and does not intercept APIs, private responses, login/admin pages, RSC payloads, failed responses, attachments or immersion routes.
- Existing React/legacy navigation nodes are suppressed rather than destructively removed. The client applies only within the approved public scope and uses real full-page links to avoid mismatched Next soft routing.
- The existing CSP remains unchanged. Pages allowing same-origin styles load the canonical stylesheet; nonce-only practice pages include that exact stylesheet in their existing nonce style. Restricted pages are not made permissive to support navigation.
- Private runtime, account-system candidates, private research, databases, media bytes and credentials are excluded from this source publication. Existing Cloudflare bindings, assets and Durable Object exports remain unchanged.

## Validation

`node tools/cloud-navigation/test.mjs` runs portable Node/VM navigation contracts without dependencies or private files. `.github/workflows/cloud-navigation.yml` provides a dedicated read-only CI check and performs no deployment. Existing practice and content validation remain separate checks.

The local release bundle preserves the confirmed deployed Worker prefix byte-for-byte except its final export and layers the owned practice, original-image reader, portal and navigation code. Full workerd checks compare actual source-rendered output, retain 23 binding contracts and named Durable Object exports, and verify existing media hashes and range behavior with isolated local storage and intercepted Worker outbound requests. This is not operating-system network isolation for the browser. These checks do not prove production identity, live mailbox delivery, every physical mobile device or all business requirements.

Root browser observations are recorded against the exact candidate hash. An earlier browser pass found legacy menu injection and mobile disclosure styling conflicts; final source changes require a new candidate and browser recheck. No old-candidate screenshot or test count may be relabeled as final acceptance.

Final private command, UTC, exit-code, source/test pin and artifact receipts are under `.local/nav-unification-20261108/`; that directory must never be uploaded. Publication requires an unchanged current production baseline, exact remote source-tree/CI/merge receipt, staged artifact readback and matching binding/runtime shapes. Existing media objects are retained in place rather than reuploaded. No account or email-binding changes belong to this release.

## Current candidate evidence

The current local candidate has passed 79 portable navigation contracts, 402 practice tests, 116 loopback HTTP checks, 111 Node content checks plus 21 Python content checks, and 1,230 real local workerd integration checks. Exact source/test pins and command times remain in the private ledger. These numbers are not substitutes for actual post-hydration browser navigation. React removal/replacement of the shared header is covered by recovery tests and still requires root's final browser pass.

The fixed retained production baseline contains a pre-existing 548-byte Next theme bootstrap that references undefined bundle name helpers (`t`/`u`). Its executable inline bytes match the candidate exactly; this navigation source did not introduce it. Initial theme selection may fail before later client hydration. No claim of a browser console with zero errors, or permanent theme recovery, is made from this comparison. The private diagnostic excludes Next RSC/JSON data scripts.

The public upload manifest explicitly excludes `practice/recordings.generated.mjs`, which contains existing embedded MP3 payloads. Preserve its already-existing remote blob; do not delete or re-upload it in this navigation change. Source/runtime pins retain the original recordings. No new media bytes or unknown-license assets are published by this manifest.

Local integration explicitly preserves the original non-prefixed article aliases: `/articles` and article details return 307 to their `/en/articles` destinations. Tests compare each original redirect and final document separately. The local preview forwards redirects per hop instead of silently consuming them, so browser URL and document locale agree. This transport correction does not assert an application URL-mutation defect.
