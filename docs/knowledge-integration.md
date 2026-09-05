# PashuRakshak — Free animal-health knowledge integration

## Sources and role

1. **WOAH Animal Diseases / WAHIS** — global reference for listed diseases, affected animal types and epidemiological surveillance data. Public WAHIS data is available without restriction for analysis.
2. **FAO DAD-IS** — livestock breed, species, population and breed-risk information. Useful for expanding the animal master register.
3. **Government of India DAHD Standard Veterinary Treatment Guidelines** — Indian veterinary guidance, including Annexure-2 on collection, preservation and dispatch of samples for disease diagnosis.

## Implemented MVP API

- `GET /api/knowledge/diseases?species=Cattle`
- `GET /api/knowledge/diseases?species=Goat&symptom=fever`
- `GET /api/knowledge/diseases?q=anthrax`
- `GET /api/knowledge/samples?species=Cattle`
- `GET /api/knowledge/samples?species=Poultry`

The frontend exposes these through the **Disease & sample guide** page for veterinary officers and field workers.

## Why a local reference layer instead of calling a random AI API

For a government-health MVP, disease and specimen information should come from authoritative veterinary sources. The project therefore uses a small, auditable local knowledge layer. It can later be synchronized with official datasets/APIs when a documented public endpoint and permitted usage are available.

The knowledge layer is **not a diagnostic model**. It supports triage and veterinary review only.

## Future upgrade

Add an optional AI layer after the deterministic reference layer:

`Farmer text -> symptom extraction -> disease reference retrieval -> ranked possibilities -> veterinarian review`

The AI should never independently confirm a disease or prescribe treatment.
