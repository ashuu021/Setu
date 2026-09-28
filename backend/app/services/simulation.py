"""Transparent, synthetic fuel balance and Monte Carlo calculations for SETU."""
from dataclasses import dataclass
from datetime import date, timedelta
import numpy as np

@dataclass(frozen=True)
class Assumptions:
    initial_liters: float = 180_000
    daily_liters: float = 1_850
    shipment_liters: float = 100_000
    planned_arrival_day: int = 65
    reserve_liters: float = 45_000
    horizon_days: int = 180

def risk_level(probability: float) -> str:
    return "CRITICAL" if probability >= .6 else "ELEVATED" if probability >= .25 else "GUARDED" if probability >= .08 else "LOW"

def forecast(delay_days: int = 0, trials: int = 1000, seed: int = 26062, demand_reduction: float = 0, airlift_liters: float = 0, assumptions: Assumptions = Assumptions()):
    if not 0 <= delay_days <= 30: raise ValueError("delay_days must be between 0 and 30")
    if not 100 <= trials <= 10000: raise ValueError("trials must be between 100 and 10000")
    if not 0 <= demand_reduction <= .4: raise ValueError("demand_reduction must be between 0 and 0.4")
    if not 0 <= airlift_liters <= 20000: raise ValueError("airlift_liters must be between 0 and 20000")
    if not 0 <= seed <= 4294967295: raise ValueError("seed must be between 0 and 4294967295")
    a=assumptions; horizon=a.horizon_days; arrival=a.planned_arrival_day+delay_days
    consumption=a.daily_liters*(1-demand_reduction)
    daily=[]; stock=a.initial_liters+airlift_liters; deterministic_stockout=None
    for day in range(horizon+1):
        if day==arrival: stock+=a.shipment_liters
        if day>0: stock=max(0,stock-consumption)
        daily.append({"day":day,"liters":round(max(0,stock),1),"reserve":a.reserve_liters})
        if stock<=0 and deterministic_stockout is None: deterministic_stockout=day
    rng=np.random.default_rng(seed); outs=[]; reserve_cross=[];pre_arrival_shortfalls=0
    # One vectorized, independently sampled demand and arrival/delivery for each trial.
    demands=np.maximum(0,rng.normal(consumption, consumption*.12, (trials,horizon)))
    arrivals=np.maximum(0,np.rint(rng.normal(arrival, 4, trials)).astype(int))
    deliveries=np.maximum(0,rng.normal(a.shipment_liters, a.shipment_liters*.05, trials))
    for i in range(trials):
        bal=a.initial_liters+airlift_liters; out=None; crossed=None
        for day in range(horizon):
            if day==arrivals[i]: bal+=deliveries[i]
            bal=max(0,bal-demands[i,day])
            if bal<=0 and out is None: out=day+1
            if bal<a.reserve_liters and crossed is None: crossed=day+1
        outs.append(out); reserve_cross.append(crossed)
        if out is not None and out < arrivals[i]:pre_arrival_shortfalls+=1
    valid=[x for x in outs if x is not None]; reserve_valid=[x for x in reserve_cross if x is not None]
    probability=pre_arrival_shortfalls/trials
    runouts=[(date.today()+timedelta(days=x)).isoformat() for x in valid]
    return {"assumptions":{"initial_liters":a.initial_liters,"mean_daily_consumption_liters":round(consumption,1),"planned_arrival_day":a.planned_arrival_day,"delay_days":delay_days,"projected_arrival_day":arrival,"delivery_liters":a.shipment_liters,"reserve_liters":a.reserve_liters,"trials":trials,"seed":seed,"horizon_days":horizon,"demand_sigma_fraction":.12,"arrival_sigma_days":4,"delivery_sigma_fraction":.05,"synthetic":True},"deterministic":{"stockout_day":deterministic_stockout,"days_of_fuel":round((a.initial_liters+airlift_liters)/consumption,1),"series":daily},"monte_carlo":{"shortfall_probability":probability,"shortfall_count":pre_arrival_shortfalls,"reserve_crossing_probability":len(reserve_valid)/trials,"stockout_count":len(valid),"no_stockout_count":trials-len(valid),"stockout_day_percentiles":({"p10":float(np.percentile(valid,10)),"p50":float(np.percentile(valid,50)),"p90":float(np.percentile(valid,90)),"best":int(min(valid)),"worst":int(max(valid))} if valid else None),"reserve_crossing_day_p50":float(np.percentile(reserve_valid,50)) if reserve_valid else None,"trial_stockout_days":outs},"risk":risk_level(probability)}
