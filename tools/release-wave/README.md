# Per-wave release checks

Run from the repository root with Node 22:

```sh
node --test tools/release-wave/gates.test.mjs apps/web/test/legacy-theme-repair.test.mjs
```

This dependency-free module validates explicit public-source manifests and the
consistency of per-candidate test, source-review, actual-browser, remote-tree,
CI, merge, staged-readback and production-baseline evidence. It never uploads,
deploys, sends email, changes roles/bindings, or infers files from a home/corpus.
Unknown or missing evidence fails closed. Public manifests reject private roots,
database/media payloads, embedded media, secrets and symlinks escaping the root.
Resolved symlink targets must also be public paths, including inside the project.
Only the listed source-text extensions (MJS/CJS/JS/JSX/TS/TSX/CSS/JSON/MD/TXT/YML/
YAML/CSV) and losslessly round-tripping UTF-8 without binary NUL are supported.

`assessRelease` takes explicit operator expectations. A stage may precede merge;
publication requires the exact merged head and staged artifact readback. Current
scope supports the existing 23-binding deployment without account/mail/config
changes. Such changes need a separately reviewed release rather than a boolean
being used to bypass this check. Original business acceptance remains separate:
successful evidence validation always returns `waveComplete: false`.

Actual browser evidence explicitly records `candidateUiExercised: true` and
`syntheticDataUsed: true|false`. A real candidate UI using a clearly synthetic DB
is valid UI evidence, not real-account or full business acceptance. It must not be
mislabelled as real user data merely to pass a gate.

This tool cannot establish that a claimed review, approval or browser test really
happened. The operator must read real receipts and applicable approval state.
Content provenance and per-asset rights are not proved by a secret-shape scan.
Physical-device hearing, real mailbox delivery, human content review and all 45
requirements are not replaced by portable CI tests.

The W01 owned theme repair changes only a fingerprinted public Next UI bootstrap.
It leaves unknown scripts, RSC/data requests, private paths and blocking CSP
untouched. See [the third-party fixture notice](NEXT-THEMES-NOTICE.md). Full
retained-runtime build/preview receipts stay private and must not enter Git.
