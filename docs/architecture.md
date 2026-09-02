# Architecture

```text
React + TypeScript
      |
      | REST/JSON
      v
FastAPI
  |-- Health reports
  |-- Explainable risk engine
  |-- Spatiotemporal cluster detector
  |-- Alerts
  |-- Investigations
  |
  +--> AI abstraction (next step: local/mock + external provider)
  |
  +--> PostgreSQL/PostGIS (schema supplied; MVP fallback is in-memory)
      |
      +--> GIS / historical surveillance
```

## End-to-end flow

Farmer Report → Offline/Online Sync → AI Structuring → Risk Engine →
Spatial/Temporal Cluster → Veterinary Alert → Investigation → Sample →
Laboratory → Advisory → Resolution.

## Production hardening next

- JWT/OAuth authentication + RBAC
- PostgreSQL repositories and Alembic migrations
- PostGIS ST_DWithin / time-window clustering
- Background task queue for scoring and notifications
- Service worker + IndexedDB queue for true offline-first sync
- Object storage for photos/documents
- FCM/SMS notification adapters
- Full i18n catalog
- Audit/event trail
- Rate limiting and input sanitization
