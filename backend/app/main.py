from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .services.simulation import forecast
from .database import list_scenarios,save_scenario,add_action,history
from uuid import uuid4

app=FastAPI(title="SETU Polar Mission Risk Simulator",version="0.1.0",description="Synthetic demo simulator; not an operational NCPOR system.")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])
class SimRequest(BaseModel):
    station_id:str="maitri"
    delay_days:int=Field(0,ge=0,le=30)
    trials:int=Field(1000,ge=100,le=10000)
    seed:int=Field(26062,ge=0,le=4294967295)
    demand_reduction:float=Field(0,ge=0,le=.4)
    airlift_liters:float=Field(0,ge=0,le=20000)
class ScenarioRequest(BaseModel):
    id:str|None=None
    name:str=Field(min_length=1,max_length=100)
    config:dict
class ActionRequest(BaseModel):
    action:dict
@app.get("/api/health")
def health(): return {"status":"ok","mode":"synthetic-demo"}
@app.get("/api/demo/config")
def config(): return {"disclaimer":"SYNTHETIC DEMO DATA — not NCPOR operational data","stations":[{"id":"maitri","name":"Maitri","lat":-70.7644,"lng":11.7342},{"id":"bharati","name":"Bharati","lat":-69.40683,"lng":76.19533}],"origin":{"name":"Mumbai","lat":19.076,"lng":72.8777},"assumptions":{"initial_liters":180000,"daily_liters":1850,"delivery_liters":100000,"planned_arrival_day":65,"reserve_liters":45000,"horizon_days":180}}
@app.get("/api/stations")
def stations(): return config()["stations"]
@app.get("/api/scenarios")
def scenarios(): return list_scenarios()
@app.post("/api/scenarios")
def create_scenario(req:ScenarioRequest): return save_scenario(req.id or str(uuid4()),req.name,req.config)
@app.post("/api/scenarios/{scenario_id}/actions")
def scenario_action(scenario_id:str,req:ActionRequest):
    result=add_action(scenario_id,req.action)
    if result is None: raise HTTPException(404,"Scenario not found")
    return result
@app.get("/api/scenarios/{scenario_id}/history")
def scenario_history(scenario_id:str): return history(scenario_id)
@app.post("/api/simulate")
def simulate(req:SimRequest):
    if req.station_id!="maitri": raise HTTPException(422,"Only the synthetic Maitri fuel scenario is configured; Bharati fuel inventory is not modeled in this prototype.")
    try: return forecast(req.delay_days,req.trials,req.seed,req.demand_reduction,req.airlift_liters)
    except ValueError as e: raise HTTPException(422,str(e))
