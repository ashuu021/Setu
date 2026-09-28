# Architecture

The React/TypeScript single-page app owns the interaction state and runs the simulation in the browser so the mission dashboard remains useful offline. `src/simulation.ts` is a pure module with a seeded PRNG and daily balance model. The globe receives forecast state as props; chart and risk components use the same forecast object.

FastAPI exposes health, demo configuration, station, scenario, action-history, and simulation endpoints. The Python simulation module is independent from API request handling. SQLite access is isolated behind `backend/app/database.py` and can be replaced behind the same small repository interface.

The service worker caches same-origin app files after first load. Browser local storage holds user scenario state and a pending sync queue. On reconnection, local API reconciliation compares ISO timestamps in scenario config; the newer record wins, with local changes winning ties. The public globe texture is cached after a successful fetch; a local visual fallback is available when it cannot load. No satellite synchronization or external operational integration is implemented.
