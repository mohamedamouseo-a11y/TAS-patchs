# TAS LeadDispatcher Import + Campaign Other Fix V1

Scope only:

- Restore the existing `/import` (Import Sheets / Excel Import) visibility and route access for `LeadDispatcher`.
- Keep using the normal shared import flow; no dispatcher-specific import page.
- In Settings > Campaigns, when `LeadDispatcher` selects `Platform = Other`, expose the exact same extra field and value handling already used by Admin in the current live source.
- Preserve Campaign permissions as create-only for LeadDispatcher; no edit/delete/toggle expansion.
- Preserve existing LeadDispatcher `/leads`, Add Lead, Export, and distribution/queue access.
- Do not grant Service, Parts, Finance, Catalog, or Admin modules.

The live server source may be ahead of GitHub, so this patch is intentionally semantic and must be applied against the current server tree rather than by replacing whole files from the repository.