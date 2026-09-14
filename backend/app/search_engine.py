import re
import json
import traceback
from gigachat.models import Chat, Messages, MessagesRole
from backend.app.llm_factory import get_gigachat_client, get_model_name
from backend.app.cache import get_erp_data, get_apartment_index

def analyze_intent(query: str) -> dict:
    """Анализирует запрос, извлекает критерии и определяет намерение."""
    try:
        prompt = f"""
Ты — AI-помощник по недвижимости. Извлеки из запроса пользователя все возможные критерии поиска.

Критерии:
- project_name: название ЖК (если упоминается)
- address: улица, район, метро (если упоминается)
- rooms: количество комнат (число)
- price_max: максимальная цена (число)
- area_min: минимальная площадь (число)
- discount_min: минимальная скидка (число)
- apartment_id: ID квартиры (если есть)

Также определи намерение:
- "search_apartments": если есть rooms, price_max, area_min, discount_min, apartment_id
- "search_projects": если есть project_name или address, но нет критериев квартир
- "ask_question": если запрос — это вопрос о процессах, документах, ипотеке и т.п.
- "general_help": если не удалось ничего извлечь

Верни JSON:
{{
    "intent": "search_apartments" | "search_projects" | "ask_question" | "general_help",
    "criteria": {{
        "project_name": null,
        "address": null,
        "rooms": null,
        "price_max": null,
        "area_min": null,
        "discount_min": null,
        "apartment_id": null
    }},
    "confidence": 0.0..1.0
}}

Запрос: {query}
Ответ только JSON.
"""
        client = get_gigachat_client()
        chat = Chat(
            model=get_model_name(),
            messages=[Messages(role=MessagesRole.USER, content=prompt)]
        )
        resp = client.chat(chat)
        content = resp.choices[0].message.content
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            if "confidence" not in result:
                result["confidence"] = 0.8
            return result
        else:
            return {"intent": "general_help", "criteria": {}, "confidence": 0.5}
    except Exception as e:
        print("❌ Ошибка в analyze_intent:", e)
        traceback.print_exc()
        return {"intent": "general_help", "criteria": {}, "confidence": 0.5}

def search_projects_by_text(query: str) -> list:
    """Ищет ЖК, в названии или адресе которых есть слова из запроса."""
    erp = get_erp_data()
    projects = erp.get("projects", [])
    if not projects:
        return []

    # Разбиваем запрос на слова (игнорируем стоп-слова)
    stop_words = {"на", "в", "с", "по", "у", "из", "от", "до", "это", "что", "как", "где", "когда", "почему", "за", "перед"}
    words = [w.lower() for w in re.findall(r'\b\w+\b', query) if w.lower() not in stop_words]
    if not words:
        return []

    found = []
    for p in projects:
        name_lower = p["name"].lower()
        address_lower = p["address"].lower()
        text = name_lower + " " + address_lower
        # Проверяем, есть ли хоть одно слово в тексте
        if any(word in text for word in words):
            found.append(p)
    return found

def search_apartments_by_criteria(criteria: dict) -> list:
    """Ищет квартиры по критериям (rooms, price_max, area_min, discount_min, apartment_id, project_name)."""
    index = get_apartment_index()
    results = []
    rooms = criteria.get("rooms")
    location = criteria.get("address")  # address может быть использован как локация
    price_max = criteria.get("price_max")
    area_min = criteria.get("area_min")
    apartment_id = criteria.get("apartment_id")
    discount_min = criteria.get("discount_min")
    project_name = criteria.get("project_name")

    # Если указан конкретный ID квартиры
    if apartment_id:
        erp = get_erp_data()
        for project in erp.get("projects", []):
            for apt in project.get("available_apartments", []):
                if apt["id"].lower() == apartment_id.lower():
                    return [{
                        "project_name": project["name"],
                        "address": project["address"],
                        "apartment": apt,
                        "total_price": apt["price_per_sqm"] * apt["area"],
                        "base_total": apt.get("base_price_per_sqm") * apt["area"] if "base_price_per_sqm" in apt else None
                    }]
        return []

    # Собираем кандидатов из индекса
    candidates = []
    if rooms:
        candidates.extend(index.get("rooms", {}).get(rooms, []))
    if location:
        loc_words = location.lower().split()
        for word in loc_words:
            if len(word) > 2:
                candidates.extend(index.get("location", {}).get(word, []))

    # Если не нашли по индексу — берём все квартиры
    if not candidates:
        erp = get_erp_data()
        for project in erp.get("projects", []):
            for apt in project.get("available_apartments", []):
                candidates.append({"project": project, "apartment": apt})

    # Фильтруем
    unique = {}
    for item in candidates:
        key = item["project"]["name"] + item["apartment"]["id"]
        if key in unique:
            continue
        apt = item["apartment"]
        total = apt["price_per_sqm"] * apt["area"]
        if rooms and apt.get("rooms") != rooms:
            continue
        if area_min and apt.get("area", 0) < area_min:
            continue
        if price_max and total > price_max:
            continue
        if discount_min is not None:
            if apt.get("discount_percent", 0) < discount_min:
                continue
        if project_name:
            if project_name.lower() not in item["project"]["name"].lower():
                continue
        if location:
            loc = location.lower()
            project_text = (item["project"]["name"] + " " + item["project"]["address"]).lower()
            if loc not in project_text:
                continue
        unique[key] = {
            "project_name": item["project"]["name"],
            "address": item["project"]["address"],
            "apartment": apt,
            "total_price": total,
            "base_total": apt.get("base_price_per_sqm") * apt["area"] if "base_price_per_sqm" in apt else None
        }
    return list(unique.values())

def extract_apartment_ids(query: str) -> list:
    pattern = r'\b(A\d{3})\b'
    matches = re.findall(pattern, query, re.IGNORECASE)
    return list(set(matches))

def compare_apartments(ids: list) -> str:
    # ... (без изменений, как в предыдущих версиях)
    pass

def get_project_info(project_name_or_id: str) -> dict:
    erp = get_erp_data()
    projects = erp.get("projects", [])
    for p in projects:
        if p["project_id"].lower() == project_name_or_id.lower():
            return p
        if project_name_or_id.lower() in p["name"].lower():
            return p
    return None

def format_project_info(project: dict) -> str:
    text = f"🏢 {project.get('name', 'Без названия')}\n"
    text += f"📍 Адрес: {project.get('address', 'Не указан')}\n"
    text += f"📅 Плановый срок сдачи: {project.get('planned_completion', 'Не указан')}\n"
    text += f"📅 Фактический срок сдачи: {project.get('actual_completion', 'Не указан')}\n"
    text += f"🏗️ Текущий этап строительства: {project.get('construction_stage', 'Не указан')}\n"
    if project.get("project_discount", 0) > 0:
        text += f"🎯 Скидка за задержку: {project['project_discount']}%\n"
    text += f"\n🏠 Доступные квартиры:\n"
    for apt in project.get("available_apartments", [])[:10]:
        price = apt["price_per_sqm"] * apt["area"]
        text += f"  • {apt['id']}: {apt['rooms']} комн., {apt['area']} кв.м., {apt['floor']} этаж, {apt['price_per_sqm']} руб/кв.м"
        if apt.get("discount_percent", 0) > 0:
            text += f" (скидка {apt['discount_percent']}%)"
        text += f", итого: {price:,.0f} руб.\n"
    if len(project.get("available_apartments", [])) > 10:
        text += f"  ... и ещё {len(project['available_apartments'])-10} квартир.\n"
    return text

def format_projects_list(projects: list) -> str:
    """Форматирует список проектов в читаемый текст."""
    if not projects:
        return "Не найдено подходящих жилых комплексов."
    text = "🏢 Найдены жилые комплексы:\n\n"
    for idx, p in enumerate(projects, 1):
        text += f"{idx}. {p['name']}\n"
        text += f"   📍 {p['address']}\n"
        text += f"   🏗️ Стадия: {p['construction_stage']}\n"
        text += f"   📅 Плановый срок сдачи: {p['planned_completion']}\n"
        if p.get("available_apartments"):
            text += f"   🏠 Доступно квартир: {len(p['available_apartments'])}\n"
        else:
            text += "   🏠 Нет свободных квартир\n"
        text += "\n"
    return text

def search_dialogs_by_text(query: str, limit=5):
    from backend.app.dialog_index import search_dialogs
    return search_dialogs(query, limit)