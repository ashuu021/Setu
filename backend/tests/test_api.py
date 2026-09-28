from fastapi.testclient import TestClient
from app import database
from app.main import app

client=TestClient(app)

def test_health_config_and_calculated_simulation(tmp_path,monkeypatch):
    monkeypatch.setattr(database,"DB_PATH",tmp_path/"test.sqlite3")
    assert client.get("/api/health").json()["status"]=="ok"
    assert client.get("/api/demo/config").json()["disclaimer"].startswith("SYNTHETIC")
    response=client.post("/api/simulate",json={"delay_days":30,"trials":1000,"seed":7})
    assert response.status_code==200
    assert response.json()["assumptions"]["projected_arrival_day"]==95

def test_scenario_and_action_history_persist(tmp_path,monkeypatch):
    monkeypatch.setattr(database,"DB_PATH",tmp_path/"test.sqlite3")
    created=client.post("/api/scenarios",json={"id":"demo","name":"Demo","config":{"delay":7}})
    assert created.status_code==200
    action=client.post("/api/scenarios/demo/actions",json={"action":{"type":"airlift","liters":10000}})
    assert action.status_code==200
    assert client.get("/api/scenarios/demo/history").json()[0]["action"]["liters"]==10000
    assert client.post("/api/scenarios/missing/actions",json={"action":{}}).status_code==404
