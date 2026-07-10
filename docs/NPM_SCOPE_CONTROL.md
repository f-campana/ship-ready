# npm scope control

Read-only verification on 2026-07-10 established the package naming posture for this repository. It did not publish or mutate npm state.

- `npm whoami` returned `kobol909`.
- `npm owner ls @imageforge/cli` returned `kobol909 <campana.fabien@gmail.com>`; ImageForge remains a separate product and namespace.
- `npm org ls ship-ready --json` returned `{ "kobol909": "owner" }`.
- `npm view @ship-ready/cli --json`, `npm view @f-campana/shipready --json`, and `npm view shipready --json` each returned `E404` at check time.

The controlled target is `@ship-ready/cli`, with executable `shipready`. The fallback remains `@f-campana/shipready`. An `E404` is availability evidence at check time, not a reservation or publication guarantee.

`package.json.name` is now `@ship-ready/cli`, but `private: true` remains and npm usage is not live. No npm login, token use, publish, owner mutation, organization mutation, or access mutation is authorized by this record.
