---
id: mc-k7fl
status: open
deps: []
links: []
created: 2026-08-15T16:11:42Z
type: feature
priority: 1
assignee: cc-vps
tags: [foods, api, testing]
---
# Fix custom food creation and fast-track handling

Bring CLI food creation in line with current GetMyMacros endpoints. Fix fast-track parameter names, add proper CreateCustomFood support, expose custom-food browsing/deletion, and handle malformed API records safely. Add fixture-backed tests and document manual/live verification without requiring personal-account credentials.

## Design

Use the observed web requests as the endpoint contract. Fast-track sends protein and carbs (not total_protein/total_carbs). Add a client method and CLI command for CreateCustomFood.php with complete nutrition/serving fields. Align Custom & Favorites category naming and add deletion support if endpoint behavior is testable. Keep paid-only live operations opt-in and never require personal credentials in CI.

## Acceptance Criteria

- Fast-track sends the same field names as the web UI and its successful response is normalized without crashing.
- Proper custom food creation is available from the CLI with serving, brand, nutrition, and food type fields.
- Custom & Favorites browsing returns newly-created custom foods when the account is entitled.
- Custom food deletion is supported or explicitly documented if endpoint behavior prevents safe support.
- Null/malformed API food-log fields do not crash normalization; tests cover this case.
- Unit/integration fixture tests cover request payloads and response handling.
- README/docs include manual verification commands and clearly mark paid-account/live-test requirements.


## Notes

**2026-08-15T16:14:59Z**

Implemented the first pass: fast-track now sends protein/carbs field names used by the web UI; added create-food and delete-food commands/endpoints; aligned Custom & Favorites category name; made daily food normalization null-safe; added request/normalization tests and README manual paid-account verification guidance. Live tests were not run because auth was cleared and paid mutations must remain opt-in.
