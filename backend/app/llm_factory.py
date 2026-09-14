import os
from dotenv import load_dotenv
from gigachat import GigaChat

import hashlib
import json
from functools import lru_cache
from gigachat.models import Chat, Messages, MessagesRole

# Загружаем .env из папки backend (на уровень выше)
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

def get_gigachat_client():
    credentials = os.getenv("GIGACHAT_CREDENTIALS")
    if not credentials:
        raise ValueError("GIGACHAT_CREDENTIALS не задан в .env")
    return GigaChat(
        base_url=os.getenv("GIGACHAT_BASE_URL", "https://api.giga.chat/v1"),
        credentials=credentials,
        scope=os.getenv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS"),
        model=os.getenv("GIGACHAT_MODEL", "GigaChat-3-Ultra"),
        verify_ssl_certs=False,
    )

def get_model_name():
    return os.getenv("GIGACHAT_MODEL", "GigaChat-3-Ultra")

@lru_cache(maxsize=1000)
def cached_gigachat_response(prompt_hash: str, model: str):
    # Реализация вызова с кешированием по хешу
    pass