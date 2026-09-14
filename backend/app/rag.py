import os
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from backend.app.cache import get_erp_data, get_dialogs_data
from backend.app.llm_factory import get_gigachat_client
from backend.app.user_data import (
    get_chat_history, get_cart, get_client_proposals,
    save_cart, add_message_to_history
)
from gigachat.models import Chat, Messages, MessagesRole

chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection_name = "real_estate_data"
EMBED_MODEL = "sergeyzh/rubert-tiny-turbo"

def get_embedding_function():
    return SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)

def build_index():
    try:
        chroma_client.delete_collection(collection_name)
    except:
        pass

    collection = chroma_client.create_collection(
        name=collection_name,
        embedding_function=get_embedding_function()
    )

    erp = get_erp_data()
    dialogs = get_dialogs_data()

    documents = []
    metadatas = []
    ids = []

    for p in erp.get("projects", []):
        text = f"Проект: {p['name']}. Адрес: {p['address']}. Срок сдачи: {p['planned_completion']}. Этап: {p['construction_stage']}."
        if p.get("available_apartments"):
            text += f" Доступно квартир: {len(p['available_apartments'])}."
        documents.append(text)
        metadatas.append({"type": "project", "project_id": p["project_id"]})
        ids.append(f"project_{p['project_id']}")

        for apt in p.get("available_apartments", []):
            text = f"Квартира {apt['id']} в {p['name']}. Комнат: {apt['rooms']}, площадь: {apt['area']} кв.м., этаж: {apt['floor']}, цена: {apt['price_per_sqm']} руб/кв.м."
            if apt.get("discount_percent", 0) > 0:
                text += f" Скидка: {apt['discount_percent']}%."
            documents.append(text)
            metadatas.append({"type": "apartment", "project_id": p["project_id"], "apartment_id": apt["id"]})
            ids.append(f"apt_{p['project_id']}_{apt['id']}")

    for d in dialogs.get("dialogs", []):
        summary = d.get("summary", "")
        issues = d.get("extracted_insights", {}).get("issues", [])
        actions = d.get("extracted_insights", {}).get("resolved_actions", [])
        text = f"Диалог: {summary}. Проблемы: {', '.join(issues)}. Решения: {', '.join(actions)}"
        documents.append(text)
        metadatas.append({"type": "dialog", "dialog_id": d["dialog_id"]})
        ids.append(f"dialog_{d['dialog_id']}")

    batch_size = 100
    for i in range(0, len(documents), batch_size):
        collection.add(
            documents=documents[i:i+batch_size],
            metadatas=metadatas[i:i+batch_size],
            ids=ids[i:i+batch_size]
        )

    print(f"✅ Индекс RAG построен: {len(documents)} документов.")

def retrieve_context(query: str, top_k=7) -> str:
    collection = chroma_client.get_collection(collection_name)
    results = collection.query(query_texts=[query], n_results=top_k)
    if not results or not results["documents"]:
        return ""
    context = ""
    for doc in results["documents"][0]:
        context += doc + "\n\n"
    return context

def get_cart_notifications(client_id):
    cart = get_cart(client_id)
    erp = get_erp_data()
    notifications = []
    for item in cart:
        project = next((p for p in erp.get("projects", []) if p["project_id"] == item["project_id"]), None)
        if not project:
            continue
        current_date = project["actual_completion"]
        if current_date != item.get("last_completion_check"):
            notifications.append({
                "project_id": item["project_id"],
                "apartment_id": item["apartment_id"],
                "new_completion": current_date,
                "old_completion": item.get("last_completion_check")
            })
            item["last_completion_check"] = current_date
    if notifications:
        save_cart(client_id, cart)
    return notifications

def answer_with_rag(query: str, client_id: str = None) -> str:
    history = []
    if client_id:
        history = get_chat_history(client_id)[-5:]
        cart_notifications = get_cart_notifications(client_id)
    else:
        cart_notifications = []

    history_text = ""
    if history:
        history_text = "\n".join([f"{msg['role']}: {msg['text']}" for msg in history])

    rag_context = retrieve_context(query)

    notification_text = ""
    if cart_notifications:
        notification_text = "Уведомления по вашей корзине:\n" + "\n".join([
            f"- Квартира {n['apartment_id']} в ЖК {n['project_id']}: срок сдачи изменён с {n['old_completion']} на {n['new_completion']}."
            for n in cart_notifications
        ])

    prompt = f"""
Ты — дружелюбный консультант по недвижимости. Отвечай живым, связным русским языком, без маркированных списков.

Учти историю нашего разговора:
{history_text}

{notification_text}

Вот дополнительная информация из базы знаний:
{rag_context}

Вопрос клиента: {query}

Дай развёрнутый, связный ответ. Если есть уведомления по корзине, обязательно сообщи о них клиенту в начале ответа. Закончи предложением помощи или вопросом.
"""
    client = get_gigachat_client()
    chat = Chat(
        model=os.getenv("GIGACHAT_MODEL", "GigaChat-2-Pro"),
        messages=[Messages(role=MessagesRole.USER, content=prompt)]
    )
    resp = client.chat(chat)
    response_text = resp.choices[0].message.content

    if client_id:
        add_message_to_history(client_id, "assistant", response_text)

    return response_text