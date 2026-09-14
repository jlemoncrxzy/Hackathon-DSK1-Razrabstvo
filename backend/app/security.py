import re

SENSITIVE_PATTERNS = [
    r"(себестоим|cost)\s*[:]\s*[\d\s,]+",
    r"(марж[аин]|margin)\s*[:]\s*[\d\s,%]+",
    r"остатки материалов\s*[:]\s*\{.*?\}",
    r"внутренн(яя|ее|ие)\s*(инструкц|регламент|правила)",
    r"коммерческая тайн",
    r"только для сотрудников",
    r"(CRM|crm)\s*[сc]истем",
    r"(портал|внутренний сайт|справочник|база знаний)\s*застройщик",
    r"проверь\s*(CRM|портал|систему)",
    r"зайди\s*(в|на)\s*(CRM|портал|сайт)",
    r"раздел\s*(Проекты|Объекты|Справочники|Документы)",
]

def sanitize_response(text: str) -> str:
    """Безопасно очищает текст от конфиденциальной информации."""
    if text is None:
        return ""
    if not isinstance(text, str):
        return str(text)
    cleaned = text
    for pattern in SENSITIVE_PATTERNS:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\n\s*\n', '\n\n', cleaned)
    cleaned = re.sub(r' +', ' ', cleaned)
    return cleaned.strip()