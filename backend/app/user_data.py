import os
import json
import uuid
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
PROPOSALS_FILE = os.path.join(DATA_DIR, "proposals.json")
os.makedirs(DATA_DIR, exist_ok=True)


def get_client_files(client_id):
    chat_file = os.path.join(DATA_DIR, f"chat_history_{client_id}.json")
    cart_file = os.path.join(DATA_DIR, f"cart_{client_id}.json")
    return chat_file, cart_file


def load_json_file(filepath, default=None):
    """Читает JSON безопасно. При пустом/битом файле возвращает default."""
    if not os.path.exists(filepath):
        return default if default is not None else []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return default if default is not None else []
            return json.loads(content)
    except (json.JSONDecodeError, OSError) as e:
        print(f"⚠️ {filepath} повреждён или пуст: {e}. Возвращаю default.")
        return default if default is not None else []


def save_json_file(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_chat_history(client_id):
    chat_file, _ = get_client_files(client_id)
    return load_json_file(chat_file, [])


def add_message_to_history(client_id, role, text):
    chat_file, _ = get_client_files(client_id)
    history = load_json_file(chat_file, [])
    history.append({
        "role": role,
        "text": text,
        "timestamp": datetime.now().isoformat()
    })
    save_json_file(chat_file, history[-100:])


def get_cart(client_id):
    _, cart_file = get_client_files(client_id)
    return load_json_file(cart_file, [])


def save_cart(client_id, cart):
    _, cart_file = get_client_files(client_id)
    save_json_file(cart_file, cart)


def add_to_cart(client_id, project_id, apartment_id):
    cart = get_cart(client_id)
    for item in cart:
        if item["project_id"] == project_id and item["apartment_id"] == apartment_id:
            return False
    cart.append({
        "project_id": project_id,
        "apartment_id": apartment_id,
        "added_at": datetime.now().isoformat(),
        "last_completion_check": datetime.now().isoformat()
    })
    save_cart(client_id, cart)
    return True


def remove_from_cart(client_id, project_id, apartment_id):
    cart = get_cart(client_id)
    cart = [item for item in cart if not (
        item["project_id"] == project_id and item["apartment_id"] == apartment_id
    )]
    save_cart(client_id, cart)


def get_proposals():
    return load_json_file(PROPOSALS_FILE, [])


def save_proposal(client_id, client_name, project_id, apartment_id,
                  total_price, discount, proposal_text,
                  original_completion, current_completion):
    proposals = get_proposals()
    proposal = {
        "proposal_id": str(uuid.uuid4())[:12],
        "client_id": client_id,
        "client_name": client_name,
        "project_id": project_id,
        "apartment_id": apartment_id,
        "total_price": total_price,
        "discount": discount,
        "created_at": datetime.now().isoformat(),
        "status": "confirmed",
        "original_completion": original_completion,
        "current_completion": current_completion,
        "proposal_text": proposal_text
    }
    proposals.append(proposal)
    save_json_file(PROPOSALS_FILE, proposals)
    return proposal


def get_client_proposals(client_id):
    proposals = get_proposals()
    return [p for p in proposals if p.get("client_id") == client_id]