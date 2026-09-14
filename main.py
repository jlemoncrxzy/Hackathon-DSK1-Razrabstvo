import os
import sys
import re
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import traceback
import uuid

sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

# --- Существующие модули ---
from backend.app.analyzers import analyze_and_store, analyze_dialog_text
from backend.app.dialog_storage import get_dialog, find_similar_dialogs_by_text
from backend.app.generators import generate_proposal, generate_solution
from backend.app.cache import load_all_data
from backend.app.dialog_index import build_index as build_whoosh_index
from backend.app.erp_simulator import get_project, get_erp_data
from backend.app.security import sanitize_response
from backend.app.rag import (
    build_index as build_rag_index,
    answer_with_rag,
    get_cart_notifications,
    retrieve_context,
)
from backend.app.user_data import (
    get_chat_history, add_message_to_history,
    get_cart, add_to_cart, remove_from_cart,
    save_proposal, get_client_proposals,
)

# --- Мост для фронта дизайнера ---
from backend.app.workspace_bridge import build_workspace, handle_action

# --- Уведомления ---
from backend.app.notifications import (
    get_user_notifications,
    mark_read,
    mark_all_read,
    check_cart_and_notify,
)


app = FastAPI(title="AI Sales Assistant", version="0.4")

# ========== ИНИЦИАЛИЗАЦИЯ ==========
print("🔄 Загрузка данных в кеш...")
load_all_data()
print("🔄 Построение Whoosh-индекса...")
build_whoosh_index()
print("🔄 Построение RAG-индекса...")
build_rag_index()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== МОДЕЛИ ЗАПРОСОВ ==========
class AnalyzeDialogRequest(BaseModel):
    dialog_id: str

class ProposalRequest(BaseModel):
    project_id: str
    client_preferences: str = ""

class ChatRequest(BaseModel):
    message: str
    client_id: str

class SaveProposalRequest(BaseModel):
    client_id: str
    client_name: str
    project_id: str
    apartment_id: str
    total_price: float
    discount: int
    proposal_text: str
    original_completion: str
    current_completion: str

class CartAddRequest(BaseModel):
    client_id: str
    project_id: str
    apartment_id: str

class CartRemoveRequest(BaseModel):
    client_id: str
    project_id: str
    apartment_id: str

class NotificationsReadRequest(BaseModel):
    client_id: str
    ids: Optional[List[str]] = None


# ========== ПОДБОР КВАРТИР ==========

# Стоп-слова, чтобы не ловить «а1» из обычных слов
STOP_WORDS = {'а', 'и', 'в', 'на', 'с', 'за', 'по', 'до', 'из', 'к', 'о', 'у'}


def _parse_query_criteria(query: str) -> dict:
    """Извлекает критерии из вопроса: комнаты, бюджет, комнатность словами."""
    q = query.lower()
    crit = {'rooms': None, 'max_price': None, 'project_hint': None}

    # Комнаты цифрой
    m = re.search(r'(\d+)\s*-?\s*комн', q)
    if m:
        crit['rooms'] = int(m.group(1))

    # Комнаты словом
    words = {'одно': 1, 'двух': 2, 'двухкомнатн': 2, 'трёх': 3, 'трех': 3, 'трехкомнатн': 3,
             'четырёх': 4, 'четырех': 4, 'студи': 1, 'студию': 1}
    if crit['rooms'] is None:
        for w, n in words.items():
            if w in q:
                crit['rooms'] = n
                break

    # Бюджет "до X млн"
    m = re.search(r'до\s*(\d+(?:[.,]\d+)?)\s*(?:млн|миллион)', q)
    if m:
        crit['max_price'] = int(float(m.group(1).replace(',', '.')) * 1_000_000)

    # Упоминание ЖК
    for proj in (get_erp_data() or {}).get('projects', []):
        name = (proj.get('name') or '').lower()
        # «жк солнечный», «солнечный»
        short = re.sub(r'жк\s*[«"\']?', '', name).strip(' «»"\'')
        if short and short in q:
            crit['project_hint'] = proj.get('project_id')
            break

    return crit


def _fallback_pick_apartments(query: str, workspace: dict, limit: int = 3) -> list:
    """
    Если RAG не дал квартир — сами подбираем по критериям из вопроса.
    Возвращает список ID (нормализованных a1, a2, ...).
    """
    available = [a for a in workspace.get('apartments', []) if a.get('status') == 'available']
    if not available:
        return []

    crit = _parse_query_criteria(query)
    proj_by_id = {p['id']: p for p in workspace.get('projects', [])}
    pid_map = (workspace.get('meta') or {}).get('apartment_id_map') or {}

    # Фильтрация по критериям
    candidates = available

    if crit['rooms']:
        filtered = [a for a in candidates if a['rooms'] == crit['rooms']]
        if filtered:
            candidates = filtered

    if crit['max_price']:
        filtered = [a for a in candidates if a['price'] <= crit['max_price']]
        if filtered:
            candidates = filtered

    if crit['project_hint']:
        # project_hint — это P001 из ERP. Смотрим какой p1 ему соответствует.
        target_pid = None
        erp_projects = (get_erp_data() or {}).get('projects', [])
        for idx, p in enumerate(erp_projects):
            if p.get('project_id') == crit['project_hint']:
                target_pid = f'p{idx+1}'
                break
        if target_pid:
            filtered = [a for a in candidates if a['projectId'] == target_pid]
            if filtered:
                candidates = filtered

    # Сортировка по цене (дешевле — первыми)
    candidates = sorted(candidates, key=lambda a: a['price'])

    return [a['id'] for a in candidates[:limit]]


def extract_suggested_apartments(query: str, response_text: str, limit: int = 3) -> list:
    """
    Возвращает ID квартир для кнопки «Оформить КП».

    Алгоритм:
    1. Строим workspace — знаем какие квартиры свободны.
    2. Ищем ID в RAG-контексте и в самом ответе (A101 и a42).
    3. Если ничего не нашли — подбираем по критериям из вопроса.
    4. Если критериев нет — берём первые 3 свободные.
    """
    try:
        workspace = build_workspace()
    except Exception as e:
        print(f"⚠️ extract_suggested_apartments: {e}")
        return []

    id_map = (workspace.get('meta') or {}).get('apartment_id_map') or {}
    available_ids = {
        a['id'] for a in workspace.get('apartments', [])
        if a.get('status') == 'available'
    }
    if not available_ids:
        return []

    # 1) RAG-контекст
    context = ''
    try:
        context = retrieve_context(query) or ''
    except Exception as e:
        print(f"⚠️ retrieve_context упал: {e}")

    haystack = (context or '') + '\n' + (response_text or '')

    found = set()
    # Ищем и A101, и a1, и «квартира 42»/«№42»
    for m in re.finditer(r'\b([aA]\d{1,4})\b', haystack):
        raw = m.group(1)
        raw_upper = raw.upper()
        raw_lower = raw.lower()
        if raw_lower in available_ids:
            found.add(raw_lower)
            continue
        mapped = id_map.get(raw_upper) or id_map.get(raw_lower)
        if mapped and mapped in available_ids:
            found.add(mapped)

    # Дополнительно: «№42» и «квартира 42» — ищем по номеру
    for m in re.finditer(r'(?:№|квартира\s+)(\d{1,3})\b', haystack):
        try:
            num = int(m.group(1))
        except ValueError:
            continue
        for a in workspace.get('apartments', []):
            if a.get('number') == num and a['id'] in available_ids:
                found.add(a['id'])

    if found:
        def sort_key(x):
            d = ''.join(filter(str.isdigit, x))
            return int(d) if d else 0
        result = sorted(found, key=sort_key)[:limit]
        print(f"🔎 suggested (из RAG): {result}")
        return result

    # 2) Fallback — подбираем по критериям
    fallback = _fallback_pick_apartments(query, workspace, limit)
    print(f"🔎 suggested (fallback): {fallback}")
    return fallback


# ========== МОСТ ДЛЯ ФРОНТА ДИЗАЙНЕРА ==========

@app.get("/workspace")
async def workspace():
    try:
        return build_workspace()
    except Exception as e:
        print("❌ Ошибка /workspace:")
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.post("/actions/{action_name}")
async def action_endpoint(action_name: str, payload: Optional[dict] = None):
    try:
        result = handle_action(action_name, payload or {})
        return result
    except Exception as e:
        print(f"❌ Ошибка /actions/{action_name}:")
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


# ========== УВЕДОМЛЕНИЯ ==========

@app.get("/user-notifications")
async def user_notifications(client_id: str):
    if not client_id:
        raise HTTPException(400, "client_id обязателен")
    return get_user_notifications(client_id)


@app.post("/user-notifications/check")
async def user_notifications_check(payload: Optional[dict] = None):
    client_id = (payload or {}).get('client_id', '')
    if not client_id:
        raise HTTPException(400, "client_id обязателен")
    try:
        check_result = check_cart_and_notify(client_id)
    except Exception as e:
        print(f"⚠️ check_cart_and_notify: {e}")
        check_result = {'new': 0}
    data = get_user_notifications(client_id)
    return {**data, 'new': check_result.get('new', 0)}


@app.post("/user-notifications/read")
async def user_notifications_read(req: NotificationsReadRequest):
    if not req.client_id:
        raise HTTPException(400, "client_id обязателен")
    if req.ids:
        mark_read(req.client_id, req.ids)
    else:
        mark_all_read(req.client_id)
    return get_user_notifications(req.client_id)


# ========== ЧАТ ==========

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        query = req.message.strip()
        if not query:
            raise HTTPException(400, "Сообщение не может быть пустым")
        client_id = req.client_id or str(uuid.uuid4())

        add_message_to_history(client_id, "user", query)

        response = answer_with_rag(query, client_id)
        if not response:
            response = "Извините, я не смог найти ответ. Попробуйте переформулировать вопрос."

        suggested_apartment_ids = extract_suggested_apartments(query, response, limit=3)

        return {
            "response": response,
            "client_id": client_id,
            "history": get_chat_history(client_id)[-10:],
            "suggested_apartment_ids": suggested_apartment_ids,
        }
    except Exception as e:
        print("❌ Ошибка в /chat:")
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.get("/history")
async def get_history(client_id: str):
    if not client_id:
        raise HTTPException(400, "client_id обязателен")
    return {"history": get_chat_history(client_id)}


# ========== ОСТАЛЬНЫЕ ЭНДПОИНТЫ ==========

@app.post("/save-proposal")
async def save_proposal_endpoint(req: SaveProposalRequest):
    try:
        proposal = save_proposal(
            req.client_id, req.client_name, req.project_id, req.apartment_id,
            req.total_price, req.discount, req.proposal_text,
            req.original_completion, req.current_completion,
        )
        return {"status": "ok", "proposal": proposal}
    except Exception as e:
        print("❌ Ошибка сохранения предложения:")
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.get("/proposals")
async def get_proposals(client_id: str):
    if not client_id:
        raise HTTPException(400, "client_id обязателен")
    return {"proposals": get_client_proposals(client_id)}


@app.get("/cart")
async def get_cart_endpoint(client_id: str):
    if not client_id:
        raise HTTPException(400, "client_id обязателен")
    cart = get_cart(client_id)
    erp = get_erp_data()
    enriched = []
    for item in cart:
        project = next((p for p in erp.get("projects", []) if p["project_id"] == item["project_id"]), None)
        if project:
            apt = next((a for a in project.get("available_apartments", []) if a["id"] == item["apartment_id"]), None)
            if apt:
                enriched.append({
                    "project_name": project["name"], "address": project["address"],
                    "apartment_id": apt["id"], "rooms": apt["rooms"], "area": apt["area"],
                    "price": apt["price_per_sqm"] * apt["area"],
                    "completion": project["actual_completion"], "added_at": item["added_at"],
                })
    return {"cart": enriched}


@app.post("/cart/add")
async def add_to_cart_endpoint(req: CartAddRequest):
    try:
        success = add_to_cart(req.client_id, req.project_id, req.apartment_id)
        return {"status": "ok", "added": success}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.post("/cart/remove")
async def remove_from_cart_endpoint(req: CartRemoveRequest):
    try:
        remove_from_cart(req.client_id, req.project_id, req.apartment_id)
        return {"status": "ok"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.get("/notifications")
async def get_notifications(client_id: str):
    if not client_id:
        raise HTTPException(400, "client_id обязателен")
    return {"notifications": get_cart_notifications(client_id)}


@app.post("/analyze-dialog")
async def analyze_dialog(req: AnalyzeDialogRequest):
    try:
        dialog = get_dialog(req.dialog_id)
        if not dialog:
            raise HTTPException(404, "Диалог не найден")
        return {"dialog_id": req.dialog_id, "insights": analyze_and_store(req.dialog_id)}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.post("/generate-proposal")
async def proposal(req: ProposalRequest):
    try:
        project = get_project(req.project_id)
        if not project:
            raise HTTPException(404, "Проект не найден")
        text = sanitize_response(generate_proposal(req.project_id, req.client_preferences))
        return {"project_id": req.project_id, "proposal": text}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.post("/admin/reload")
async def reload_cache():
    try:
        load_all_data()
        build_whoosh_index()
        build_rag_index()
        return {"status": "ok"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}


# ========== СТАТИКА ==========
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
    print(f"✅ Фронтенд подключён: {frontend_dir}")
else:
    print(f"❌ Папка frontend не найдена по пути: {frontend_dir}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)