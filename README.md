# Setu

## SETU — Polar Mission Risk Simulator

SETU is a student prototype for SIH26062 that demonstrates one planning workflow: model how an Antarctic resupply delay could affect synthetic station fuel reserves, then test a hypothetical corrective action.

**SYNTHETIC DEMO DATA.** SETU is not an official NCPOR operational system. Inventory, fuel use, shipment timing and quantity, vessel movement, action capacity, and uncertainty distributions are fictional prototype assumptions. The simulator has no private NCPOR database access, live AIS, vessel GPS, satellite feed, flight availability, or actual station inventory. Applying an action changes only the local simulation.

## Start locally

Requirements: Node.js 20.19+ (or 22.12+) and Python 3.11+.

```sh
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Run the API in one terminal and frontend in another:

```sh
cd backend && python3 -m app
npm run dev
```

Open the Vite URL (normally http://localhost:5173). FastAPI docs are at http://localhost:8000/docs. Frontend calculations run locally regardless of backend availability. SQLite scenario history is stored in `backend/setu.sqlite3`; override its location with `SETU_DB_PATH`.

## Model summary

The daily balance is opening usable fuel + any arrival delivery − daily consumption. The baseline demonstration uses 180,000 L starting fuel, 1,850 L/day mean consumption, a 100,000 L shipment planned on day 65, a 45,000 L safety reserve, and a 180-day horizon. All are synthetic values. Each scenario runs 1,000 trials with reproducible seed 26062; daily demand has 12% normal deviation, ship arrival has 4-day normal deviation, and delivered quantity has 5% normal deviation. Negative demand/delivery samples are clamped to zero. A trial without a stockout is censored at the horizon and is not assigned a run-out date.

The displayed risk is the fraction of trials that stock out by day 180. Reserve risk is the fraction that crosses below 45,000 L. Test airlift quantities are capped at a fictional 20,000 L, and demand reduction is a hypothetical 0–40% adjustment. Neither represents actual capacity, availability, or approval.

## Offline behavior

The service worker caches the application shell and same-origin assets when visited. Scenario delay, selected scenario, and action history persist in browser local storage; edits update a local pending-sync queue. When connectivity returns (or Demo Offline Mode is switched off), the client reconciles with the local FastAPI scenario endpoint. A last-write-wins policy compares local ISO timestamps embedded in scenario config; a newer server record is loaded, otherwise the local record is uploaded. Demo Offline Mode changes the displayed connectivity mode without disabling calculations. The first visit needs a network connection to download the app and globe texture; the 3D globe uses a public texture URL and degrades to a local fallback if unavailable.

## Project layout

- `src/simulation.ts`: reproducible frontend balance and Monte Carlo model.
- `src/Globe.tsx`: interactive geographic visualization.
- `src/App.tsx`: mission dashboard, scenarios, local history, and assumptions.
- `backend/app/services/simulation.py`: independent NumPy model.
- `backend/app/main.py`: typed FastAPI routes.
- `backend/app/database.py`: SQLite persistence adapter.
- `docs/`: architecture, assumptions, and data source notes.

## Checks

```sh
npm test
npm run build
cd backend && python3 -m pytest
```
