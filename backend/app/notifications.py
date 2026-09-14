"""
Система пользовательских уведомлений.
Хранит уведомления в JSON-файлах по клиенту.
Использует существующие функции get_cart / get_cart_notifications из rag.py — не дублирует логику.
"""
import os
import json
import uuid
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def _file(client_id: str) -> str:
    safe = ''.join(c for c in (client_id or 'user1') if c.isalnum() or c in '-_')
    return os.path.join(DATA_DIR, f"notifications_{safe}.json")


def _load(client_id: str):
    path = _file(client_id)
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def _save(client_id: str, items: list):
    path = _file(client_id)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def get_user_notifications(client_id: str):
    """Возвращает все уведомления + количество непрочитанных."""
    items = _load(client_id)
    # Сначала новые
    items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    unread = sum(1 for x in items if not x.get('read'))
    return {'notifications': items, 'unread': unread}


def mark_read(client_id: str, ids=None):
    """Отмечает уведомления прочитанными. Если ids=None — все."""
    items = _load(client_id)
    for n in items:
        if ids is None or n.get('id') in ids:
            n['read'] = True
    _save(client_id, items)
    return {'ok': True}


def mark_all_read(client_id: str):
    return mark_read(client_id, None)


def add_notification(client_id: str, title: str, text: str,
                     kind: str = 'info', link: str = None,
                     dedup_key: str = None):
    """Добавляет уведомление. Если dedup_key совпал — обновляет существующее."""
    items = _load(client_id)
    if dedup_key:
        for n in items:
            if n.get('dedup_key') == dedup_key:
                n['title'] = title
                n['text'] = text
                n['created_at'] = datetime.now().isoformat()
                # Если уже прочитано — снова делаем непрочитанным, если данные обновились
                n['read'] = False
                _save(client_id, items)
                return n
    n = {
        'id': str(uuid.uuid4())[:8],
        'title': title,
        'text': text,
        'kind': kind,
        'link': link,
        'read': False,
        'created_at': datetime.now().isoformat(),
        'dedup_key': dedup_key,
    }
    items.append(n)
    _save(client_id, items)
    return n


def check_cart_and_notify(client_id: str):
    """
    Проверяет корзину клиента и создаёт уведомления об изменениях.
    Использует существующую функцию get_cart_notifications из rag.py.
    """
    try:
        from backend.app.rag import get_cart_notifications
    except Exception as e:
        print(f"⚠️ не удалось импортировать get_cart_notifications: {e}")
        return {'new': 0}

    try:
        from backend.app.cache import get_erp_data
    except Exception:
        get_erp_data = lambda: {}

    changes = []
    try:
        changes = get_cart_notifications(client_id) or []
    except Exception as e:
        print(f"⚠️ get_cart_notifications упал: {e}")

    erp = get_erp_data() or {}
    projects_by_id = {p.get('project_id'): p for p in erp.get('projects', [])}

    new_count = 0
    for ch in changes:
        pid = ch.get('project_id', '')
        aid = ch.get('apartment_id', '')
        proj = projects_by_id.get(pid) or {}
        name = proj.get('name', pid or 'объект')
        old = (ch.get('old_completion') or '')[:10]
        new = (ch.get('new_completion') or '')[:10]

        if old:
            title = f'Срок сдачи обновлён: {name}'
            text = f'Квартира {aid}: срок сдачи изменён с {old} на {new}.'
        else:
            title = f'Отслеживание добавлено: {name}'
            text = f'Квартира {aid}: срок сдачи — {new}.'

        add_notification(
            client_id,
            title=title,
            text=text,
            kind='completion_change',
            link='#apartments',
            dedup_key=f'completion:{pid}:{aid}:{new}',
        )
        new_count += 1

    return {'new': new_count}