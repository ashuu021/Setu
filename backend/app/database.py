"""Small SQLite persistence adapter; replaceable behind this module."""
import json, sqlite3, os
from pathlib import Path
DB_PATH=Path(os.environ.get("SETU_DB_PATH",Path(__file__).resolve().parents[1]/"setu.sqlite3"))

def connection():
    DB_PATH.parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(DB_PATH);db.row_factory=sqlite3.Row
    db.executescript("CREATE TABLE IF NOT EXISTS scenarios(id TEXT PRIMARY KEY,name TEXT NOT NULL,config_json TEXT NOT NULL,updated_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS actions(id INTEGER PRIMARY KEY AUTOINCREMENT,scenario_id TEXT NOT NULL,action_json TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(scenario_id) REFERENCES scenarios(id));")
    return db

def list_scenarios():
    with connection() as db:return [dict(r) | {"config":json.loads(r["config_json"])} for r in db.execute("SELECT * FROM scenarios ORDER BY updated_at DESC")]
def save_scenario(sid,name,config):
    with connection() as db:db.execute("INSERT INTO scenarios(id,name,config_json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,config_json=excluded.config_json,updated_at=CURRENT_TIMESTAMP",(sid,name,json.dumps(config)))
    return next(s for s in list_scenarios() if s["id"]==sid)
def add_action(sid,action):
    with connection() as db:
        if not db.execute("SELECT 1 FROM scenarios WHERE id=?",(sid,)).fetchone():return None
        cur=db.execute("INSERT INTO actions(scenario_id,action_json) VALUES(?,?)",(sid,json.dumps(action)))
        return dict(db.execute("SELECT * FROM actions WHERE id=?",(cur.lastrowid,)).fetchone())
def history(sid):
    with connection() as db:return [dict(r)|{"action":json.loads(r["action_json"])} for r in db.execute("SELECT * FROM actions WHERE scenario_id=? ORDER BY id DESC",(sid,))]
