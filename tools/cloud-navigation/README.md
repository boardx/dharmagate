# Navigation validation

Run `node tools/cloud-navigation/test.mjs` from the repository root (Node 22+). The runner uses built-in Node test/VM APIs and owned synthetic fixtures; no dependency install, credentials or `.local` files are required.

The workflow `.github/workflows/cloud-navigation.yml` runs the same contracts on relevant source changes. It has read-only repository permissions, does not persist checkout credentials and performs no deployment.

This portable suite verifies navigation routing, markup, CSS contracts and synthetic client behavior. It is not browser, mobile-device, real authentication or production acceptance. Full local workerd/media checks and the private retained build remain separate release evidence and must never be copied into the public repository.
