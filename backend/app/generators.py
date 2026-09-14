import json
import traceback
from gigachat.models import Chat, Messages, MessagesRole
from backend.app.llm_factory import get_gigachat_client, get_model_name
from backend.app.erp_simulator import (
    get_project,
    get_competitors,
    get_stage_schedule,
    get_zbi_schedule,
    get_materials,
    get_project_changes
)

def generate_proposal(project_id: str, client_preferences: str = "") -> str:
    """
    Формирует персонализированное коммерческое предложение на основе данных о строительстве.
    """
    try:
        project = get_project(project_id)
        if not project:
            return "К сожалению, проект не найден. Проверьте корректность идентификатора."

        competitors = get_competitors()
        competitors_text = "\n".join(
            [f"- {c['name']}: {c['price_per_sqm']} руб/кв.м, сдача {c.get('completion', 'не указана')}"
             for c in competitors]
        )

        # Получаем производственные данные
        stages = get_stage_schedule(project_id)
        zbi = get_zbi_schedule(project_id)
        materials = get_materials(project_id)
        changes = get_project_changes(project_id)

        # Формируем читаемый текст для промпта
        stage_text = "\n".join([
            f"- {s['name']}: план {s['planned_start']} – {s['planned_end']}, факт {s['actual_end']} ({s['status']})"
            for s in stages
        ]) if stages else "Нет данных по этапам"

        zbi_text = "\n".join([
            f"- {k}: {v['produced']}/{v['planned']} {v['unit']}"
            for k, v in zbi.items()
        ]) if zbi else "Нет данных по ЖБИ"

        materials_text = "\n".join([
            f"- {k}: {v['available']} {v['unit']} (расход в день: {v['daily_consumption']} {v['unit']})"
            for k, v in materials.items()
        ]) if materials else "Нет данных по материалам"

        changes_text = "\n".join([
            f"- {c['date']}: {c['description']} (влияние: {c['impact']})"
            for c in changes
        ]) if changes else "Изменений в проекте не зафиксировано"

        prompt = f"""
Ты — консультант по недвижимости. Используй информацию о ходе строительства, чтобы предложить клиенту наилучшие варианты.

Данные проекта:
- Название: {project['name']}
- Адрес: {project['address']}
- Плановый срок сдачи: {project['planned_completion']}
- Фактический срок сдачи: {project['actual_completion']}
- Процент готовности: {project.get('progress_percent', 'неизвестно')}%

Этапы строительства (план/факт):
{stage_text}

График производства ЖБИ (факт/план):
{zbi_text}

Остатки материалов и ежедневный расход:
{materials_text}

Изменения в проекте:
{changes_text}

Конкуренты в районе:
{competitors_text}

Доступные квартиры:
{json.dumps(project['available_apartments'], ensure_ascii=False, indent=2)}

Дополнительные пожелания клиента: {client_preferences}

Сформируй персонализированное предложение для клиента. Учти реальные сроки сдачи, возможные задержки и изменения в проекте. Предложи оптимальную квартиру с указанием цены и скидки. Ответь связным текстом, без списков и таблиц. Будь доброжелателен и полезен.
"""
        client = get_gigachat_client()
        chat = Chat(
            model=get_model_name(),
            messages=[Messages(role=MessagesRole.USER, content=prompt)]
        )
        resp = client.chat(chat)
        return resp.choices[0].message.content

    except Exception as e:
        print("❌ Ошибка в generate_proposal:")
        traceback.print_exc()
        return "Извините, не удалось сгенерировать предложение. Попробуйте позже или уточните запрос."

def generate_solution(issues: list, client_context: str = "") -> str:
    """
    Генерирует рекомендации для клиента на основе его проблем или вопросов.
    """
    try:
        issues_text = "\n".join([f"- {issue}" for issue in issues]) if issues else "Не указаны"

        prompt = f"""
Ты — консультант по недвижимости. Отвечай связным, естественным русским языком, без списков и таблиц. Расскажи клиенту, как ему лучше поступить, объясни понятно и по делу.

Проблемы/вопросы клиента:
{issues_text}

Дополнительный контекст: {client_context}

Дай полезный, развёрнутый ответ в виде нескольких абзацев. Заверши доброжелательным предложением помощи.
"""
        client = get_gigachat_client()
        chat = Chat(
            model=get_model_name(),
            messages=[Messages(role=MessagesRole.USER, content=prompt)]
        )
        resp = client.chat(chat)
        return resp.choices[0].message.content

    except Exception as e:
        print("❌ Ошибка в generate_solution:", e)
        traceback.print_exc()
        return "Извините, произошла ошибка при формировании ответа. Попробуйте переформулировать вопрос."