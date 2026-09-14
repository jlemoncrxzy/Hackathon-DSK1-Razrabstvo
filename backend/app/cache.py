import os
import json
from collections import defaultdict

erp_data = None
dialogs_data = None
apartment_index = {
    "rooms": defaultdict(list),
    "location": defaultdict(list)
}

def load_all_data():
    global erp_data, dialogs_data, apartment_index
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    with open(os.path.join(data_dir, "erp_data.json"), "r", encoding="utf-8") as f:
        erp_data = json.load(f)
    with open(os.path.join(data_dir, "dialogs.json"), "r", encoding="utf-8") as f:
        dialogs_data = json.load(f)
    rebuild_apartment_index()
    print("✅ Данные загружены в кеш")

def rebuild_apartment_index():
    global apartment_index
    apartment_index = {
        "rooms": defaultdict(list),
        "location": defaultdict(list)
    }
    for project in erp_data.get("projects", []):
        for apt in project.get("available_apartments", []):
            rooms = apt.get("rooms")
            if rooms:
                apartment_index["rooms"][rooms].append({
                    "project": project,
                    "apartment": apt
                })
            loc_text = (project.get("name", "") + " " + project.get("address", "")).lower()
            for word in loc_text.split():
                if len(word) > 3:
                    apartment_index["location"][word].append({
                        "project": project,
                        "apartment": apt
                    })

def get_erp_data():
    return erp_data

def get_dialogs_data():
    return dialogs_data

def get_apartment_index():
    return apartment_index