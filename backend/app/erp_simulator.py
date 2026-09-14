import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
ERP_FILE = os.path.join(DATA_DIR, "erp_data.json")

def load_erp_data():
    with open(ERP_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def get_erp_data():
    """Возвращает данные ERP (синоним load_erp_data)."""
    return load_erp_data()

def get_project(project_id: str):
    data = load_erp_data()
    for p in data.get("projects", []):
        if p["project_id"] == project_id:
            return p
    return None

def get_competitors():
    data = load_erp_data()
    return data.get("competitors", [])

def get_stage_schedule(project_id: str):
    project = get_project(project_id)
    return project.get("stage_schedule", []) if project else []

def get_zbi_schedule(project_id: str):
    project = get_project(project_id)
    return project.get("zbi_schedule", {}) if project else {}

def get_materials(project_id: str):
    project = get_project(project_id)
    return project.get("materials", {}) if project else {}

def get_project_changes(project_id: str):
    project = get_project(project_id)
    return project.get("project_changes", []) if project else []