
# PashuRakshak — Role-Based Working Model

Run with `python app.py`. No Node/npm setup is needed.

## Roles
- Farmer: register animals, submit a simple health concern, see own reports.
- Veterinary Officer: see incoming farmer reports, review risk, view potential clusters, assign a field worker, track investigations and laboratory results.
- Field Worker: see only assigned investigations and collect samples.
- Existing surveillance areas remain available through the shared dashboard / APIs.

## Demo accounts
farmer@demo.local / demo123
vet@demo.local / demo123
worker@demo.local / demo123

## Key workflow
Farmer login
→ Animal registration
→ Health report
→ AI-style symptom structuring
→ Risk assessment
→ Veterinary Officer incoming report
→ Potential cluster detection
→ Assign Field Worker
→ Field assessment
→ Sample collection
→ Laboratory
→ Result

## One-click Windows
`RUN_PASHURAKSHAK.bat` starts the app. This project intentionally remains plain HTML/CSS/JS + FastAPI for low setup and easy judging.

## Note
Risk indicators and AI outputs are surveillance support, not confirmed veterinary diagnoses.
