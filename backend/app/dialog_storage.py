import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DIALOGS_FILE = os.path.join(DATA_DIR, "dialogs.json")

def load_dialogs():
    with open(DIALOGS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_dialogs(data):
    with open(DIALOGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_dialog(dialog_id: str):
    data = load_dialogs()
    for d in data.get("dialogs", []):
        if d["dialog_id"] == dialog_id:
            return d
    return None

def update_dialog_insights(dialog_id: str, insights: dict):
    data = load_dialogs()
    for d in data["dialogs"]:
        if d["dialog_id"] == dialog_id:
            d["extracted_insights"] = insights
            break
    save_dialogs(data)

def find_similar_dialogs(issues: list, threshold: float = 0.3) -> list:
    """
    Ищет в базе диалогов те, у которых extracted_insights.issues пересекаются
    с переданным списком проблем (по ключевым словам).
    Возвращает список диалогов с совпадениями.
    """
    data = load_dialogs()
    results = []
    for dialog in data.get("dialogs", []):
        insights = dialog.get("extracted_insights")
        if not insights or not insights.get("issues"):
            continue
        dialog_issues = [issue.lower() for issue in insights["issues"]]
        # Проверяем пересечение: хотя бы одно слово из issues встречается в dialog_issues
        for issue in issues:
            issue_lower = issue.lower()
            # Простая проверка вхождения (можно улучшить)
            for d_issue in dialog_issues:
                if issue_lower in d_issue or d_issue in issue_lower:
                    results.append(dialog)
                    break
            if dialog in results:
                break
    return results

def update_dialog_summary(dialog_id: str, summary: str):
    """Сохраняет краткую сводку диалога"""
    data = load_dialogs()
    for d in data["dialogs"]:
        if d["dialog_id"] == dialog_id:
            d["summary"] = summary
            break
    save_dialogs(data)

def find_similar_dialogs_by_text(query: str, threshold: float = 0.3) -> list:
    """
    Ищет диалоги, у которых summary или issues содержат ключевые слова из query.
    Возвращает список диалогов с совпадениями.
    """
    data = load_dialogs()
    results = []
    query_words = set(query.lower().split())
    for dialog in data.get("dialogs", []):
        # Собираем текст для поиска: summary + issues
        text_parts = []
        if dialog.get("summary"):
            text_parts.append(dialog["summary"].lower())
        insights = dialog.get("extracted_insights")
        if insights and insights.get("issues"):
            text_parts.append(" ".join(insights["issues"]).lower())
        full_text = " ".join(text_parts)
        # Проверяем пересечение слов
        if any(word in full_text for word in query_words):
            results.append(dialog)
    return results