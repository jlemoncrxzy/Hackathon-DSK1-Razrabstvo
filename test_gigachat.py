import os
from dotenv import load_dotenv
from gigachat import GigaChat
from gigachat.models import Chat, Messages, MessagesRole

# Загружаем переменные из .env (если файл есть)
load_dotenv('backend/.env')  # или укажите правильный путь к вашему .env

# Инициализируем клиент
client = GigaChat(
    base_url=os.getenv("GIGACHAT_BASE_URL", "https://api.giga.chat/v1"),
    credentials=os.getenv("GIGACHAT_CREDENTIALS"),
    scope=os.getenv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS"),
    verify_ssl_certs=False,
)

# Простой тестовый запрос
PROMPT = "Привет! Напиши одно предложение о том, как ты можешь помочь в продажах недвижимости."

chat = Chat(
    model=os.getenv("GIGACHAT_MODEL", "GigaChat-3-Ultra"),
    messages=[Messages(role=MessagesRole.USER, content=PROMPT)],
)

try:
    resp = client.chat(chat)
    print("✅ Успешный ответ от GigaChat:")
    print(resp.choices[0].message.content)
except Exception as e:
    print("❌ Ошибка при запросе к GigaChat:")
    print(e)