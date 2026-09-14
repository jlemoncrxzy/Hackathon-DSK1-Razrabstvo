import json
import re
import traceback
from gigachat.models import Chat, Messages, MessagesRole
from backend.app.llm_factory import get_gigachat_client, get_model_name
from backend.app.dialog_storage import get_dialog, update_dialog_insights, update_dialog_summary

def analyze_dialog_text(dialog_text: str) -> dict:
    try:
        prompt = f"""
Ты — AI-ассистент отдела продаж. Проанализируй диалог менеджера и клиента.
Выдели:
1. Ключевые проблемы и возражения клиента (список).
2. Действия менеджера по их решению (список).
3. Рекомендации для дальнейшей коммуникации (если есть).

Ответь строго в формате JSON:
{{
    "issues": ["проблема 1", "проблема 2"],
    "resolved_actions": ["действие 1", "действие 2"],
    "recommendations": ["рекомендация 1"]
}}

Диалог:
{dialog_text}
"""
        client = get_gigachat_client()
        chat = Chat(
            model=get_model_name(),
            messages=[Messages(role=MessagesRole.USER, content=prompt)]
        )
        resp = client.chat(chat)
        content = resp.choices[0].message.content
        print("📨 Сырой ответ от GigaChat (анализ):")
        print(content)  # печатаем полный ответ

        # Пытаемся найти JSON в ответе
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            # Проверяем наличие ключей
            for key in ["issues", "resolved_actions", "recommendations"]:
                if key not in result:
                    result[key] = []
            return result
        else:
            print("❌ Не удалось найти JSON в ответе. Ответ будет пустым.")
            return {"issues": [], "resolved_actions": [], "recommendations": []}
    except Exception as e:
        print("❌ Ошибка в analyze_dialog_text:")
        traceback.print_exc()
        return {"issues": [], "resolved_actions": [], "recommendations": []}

def analyze_and_store(dialog_id: str):
    dialog = get_dialog(dialog_id)
    if not dialog:
        return None
    messages = dialog["messages"]
    full_text = "\n".join([f"{m['role']}: {m['text']}" for m in messages])
    insights = analyze_dialog_text(full_text)
    update_dialog_insights(dialog_id, insights)
    # Генерируем и сохраняем сводку
    summary = generate_summary(insights.get("issues", []), insights.get("resolved_actions", []))
    update_dialog_summary(dialog_id, summary)
    return insights

def generate_summary(issues: list, actions: list) -> str:
    """Генерирует краткую сводку диалога на основе проблем и действий"""
    if not issues and not actions:
        return "Диалог не содержит значимой информации."
    try:
        prompt = f"""
Сформулируй краткую суть диалога (1-2 предложения) на основе проблем и действий.
Проблемы: {', '.join(issues)}
Действия: {', '.join(actions)}
Ответ должен быть одним предложением, без лишних деталей.
"""
        client = get_gigachat_client()
        chat = Chat(
            model=get_model_name(),
            messages=[Messages(role=MessagesRole.USER, content=prompt)]
        )
        resp = client.chat(chat)
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print("❌ Ошибка в generate_summary:", e)
        return f"Проблемы: {', '.join(issues)}; Действия: {', '.join(actions)}"