# Настройки (переменные окружения)

import os
from dotenv import load_dotenv

load_dotenv()

GIGACHAT_CREDENTIALS = os.getenv("GIGACHAT_CREDENTIALS")
GIGACHAT_SCOPE = os.getenv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS")
GIGACHAT_BASE_URL = os.getenv("GIGACHAT_BASE_URL", "https://api.giga.chat/v1")
GIGACHAT_MODEL = os.getenv("GIGACHAT_MODEL", "GigaChat-3-Ultra")

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")