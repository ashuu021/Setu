# Synthetic assumptions

| Input | Demo value | Unit |
|---|---:|---|
| Initial usable inventory | 180,000 | liters |
| Mean consumption | 1,850 | liters/day |
| Planned delivery | 100,000 | liters |
| Planned arrival | Day 65 | simulation day |
| Safety reserve | 45,000 | liters |
| Horizon | 180 | days |
| Monte Carlo trials / seed | 1,000 / 26062 | — |
| Consumption variability | 12% normal deviation | — |
| Arrival variability | 4-day normal deviation | days |
| Delivery variability | 5% normal deviation | — |

All values are fictional and configurable in the frontend and Python model defaults. The hypothetical airlift is added to starting inventory at day zero and capped at 20,000 L; its availability is not verified. The Python service validates delay 0–30 days, trials 100–10,000, seed 0–4,294,967,295, demand reduction 0–40%, and airlift 0–20,000 L. Risk thresholds: LOW under 8%, GUARDED 8–24.9%, ELEVATED 25–59.9%, CRITICAL 60% or above. These are prototype thresholds, not NCPOR policy.
