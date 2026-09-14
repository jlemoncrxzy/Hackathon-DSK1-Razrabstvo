"""
Мост между бэкендом и фронтом дизайнера.
НЕ меняет логику бэка — только адаптирует данные под DSK_DATA.
"""
import os
import json
from datetime import datetime

from backend.app.cache import get_erp_data, get_dialogs_data
from backend.app.user_data import (
    get_proposals, save_proposal, get_cart,
    add_to_cart, remove_from_cart,
)
from backend.app.analyzers import analyze_dialog_text


PROJECT_COLORS = ['sage', 'sand', 'blue']
CLIENT_COLORS = ['purple', 'sand', 'blue', 'sage', 'peach']

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CLIENTS_FILE = os.path.join(DATA_DIR, "clients.json")


# ---------- утилиты ----------

def _quarter(date_str):
    try:
        d = datetime.strptime(str(date_str), '%Y-%m-%d')
        q = (d.month - 1) // 3 + 1
        return f"{['I', 'II', 'III', 'IV'][q - 1]} кв. {d.year}"
    except Exception:
        return 'IV кв. 2026'


def _apt_status(apt):
    s = str(apt.get('status') or 'свободна').lower()
    return 'available' if s.startswith('свобод') else 'reserved'


def _clamp_int(v, lo, hi, default):
    try:
        return max(lo, min(hi, int(v)))
    except Exception:
        return default


def _clamp_float(v, lo, hi, default):
    try:
        return max(lo, min(hi, float(v)))
    except Exception:
        return default


def _read_clients_file():
    if not os.path.exists(CLIENTS_FILE):
        return []
    try:
        with open(CLIENTS_FILE, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return []
            data = json.loads(content)
            return data.get("clients", []) if isinstance(data, dict) else []
    except Exception as e:
        print(f"⚠️ clients.json повреждён: {e}")
        return []


def _write_clients_file(clients):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CLIENTS_FILE, "w", encoding="utf-8") as f:
        json.dump({"clients": clients}, f, ensure_ascii=False, indent=2)


# ---------- сборка workspace ----------

def build_workspace():
    erp = get_erp_data() or {}
    projects_raw = erp.get('projects', [])

    projects_out = []
    apartments_out = []
    apt_by_old_key = {}
    id_map_short = {}   # 'A101' -> 'a1'

    global_seq = 0

    for idx, p in enumerate(projects_raw):
        old_pid = str(p.get('project_id') or f'P{idx+1}')
        new_pid = f'p{idx+1}'

        planned = str(p.get('planned_completion') or '2026-12-31')
        actual = str(p.get('actual_completion') or planned)
        risk = 'risk' if actual > planned else 'ontrack'
        progress = _clamp_int(p.get('progress_percent', 50), 0, 100, 50)

        tasks = []
        for stage in p.get('stage_schedule') or []:
            st = stage.get('status', '')
            pct = 100 if st == 'завершён' else 50 if st == 'в процессе' else 0
            tasks.append([stage.get('name', 'Этап'), pct])
        if not tasks:
            tasks = [['Строительство', progress]]

        changes = p.get('project_changes') or []
        reason = changes[0].get('description') if changes else None
        if not reason:
            reason = f"{p.get('construction_stage', 'Работы')}. Идут по графику."

        apartments_raw = p.get('available_apartments') or []
        available_count = sum(1 for a in apartments_raw if _apt_status(a) == 'available')
        first_ppsqm = int(apartments_raw[0].get('price_per_sqm', 120000)) if apartments_raw else 120000

        projects_out.append({
            'id': new_pid,
            'name': str(p.get('name') or f'ЖК {idx+1}'),
            'address': str(p.get('address') or ''),
            'building': 'Корпус 1',
            'progress': progress,
            'planned': _quarter(planned),
            'forecast': _quarter(actual),
            'risk': risk,
            'available': available_count,
            'price': first_ppsqm,
            'limit': _clamp_int(p.get('project_discount', 5), 0, 15, 5),
            'stage': str(p.get('construction_stage') or ''),
            'materials': 90,
            'stock': 'ЖБИ: по графику',
            'color': PROJECT_COLORS[idx % len(PROJECT_COLORS)],
            'reason': reason,
            'tasks': tasks,
        })

        for apt in apartments_raw:
            global_seq += 1
            old_aid = str(apt.get('id') or f'A{global_seq:03d}')
            new_aid = f'a{global_seq}'

            area = _clamp_float(apt.get('area', 30), 5, 500, 30)
            ppsqm = _clamp_int(apt.get('price_per_sqm', 100000), 10000, 500000, 100000)

            new_apt = {
                'id': new_aid,
                'projectId': new_pid,
                'number': global_seq,
                'rooms': _clamp_int(apt.get('rooms', 1), 1, 4, 1),
                'area': round(area, 1),
                'floor': _clamp_int(apt.get('floor', 1), 1, 100, 1),
                'floors': 20,
                'price': int(ppsqm * area),
                'status': _apt_status(apt),
            }
            apartments_out.append(new_apt)
            apt_by_old_key[(old_pid, old_aid)] = new_apt
            id_map_short[old_aid] = new_aid

    clients_out = _build_clients(projects_out)
    proposals_out = _build_proposals(apartments_out, clients_out, projects_out, apt_by_old_key)
    report = _build_report()

    return {
        'projects': projects_out,
        'clients': clients_out,
        'apartments': apartments_out,
        'proposals': proposals_out,
        'drafts': [],
        'quoteDrafts': [],
        'actor': {
            'id': 'manager-anna',
            'name': 'Анна Морозова',
            'initials': 'АМ',
            'label': 'Менеджер · демо',
            'role': 'manager',
        },
        'model': {
            'version': '2026.09',
            'renovationPerMeter': 18000,
            'parkingPrice': 900000,
            'maxInputDiscount': 15,
        },
        'report': report,
        'asOf': datetime.now().isoformat(),
        'meta': {
            'apartment_id_map': id_map_short,
        },
    }


def _build_clients(projects_out):
    raw = _read_clients_file()
    proj_ids = [p['id'] for p in projects_out] or ['p1']

    if not raw:
        raw = [{
            "id": "user1", "name": "Иван Иванов", "initials": "ИИ",
            "color": "purple", "contact": "user1@gmail.com",
            "phone": "+7 (900) 111-11-11", "interest": "2-комн.",
            "budget": 12000000, "projectId": proj_ids[0],
            "stage": "Подбор квартиры", "last": "Сегодня",
            "note": "", "objection": "", "advice": "",
            "createdAt": "2026-09-03",
        }]
        _write_clients_file(raw)

    out = []
    for i, c in enumerate(raw):
        pid = c.get('projectId', proj_ids[0])
        if pid.startswith('p') and pid[1:].isdigit():
            idx = int(pid[1:]) - 1
            pid = proj_ids[idx] if idx < len(proj_ids) else proj_ids[0]
        elif pid not in proj_ids:
            pid = proj_ids[0]

        out.append({
            'id': c.get('id', f'c{i+1}'),
            'name': c.get('name', 'Без имени'),
            'initials': c.get('initials', 'БИ'),
            'color': c.get('color', CLIENT_COLORS[i % len(CLIENT_COLORS)]),
            'contact': c.get('contact', ''),
            'phone': c.get('phone', ''),
            'interest': c.get('interest', ''),
            'budget': _clamp_int(c.get('budget', 10000000), 1000000, 100000000, 10000000),
            'projectId': pid,
            'stage': c.get('stage', 'Новый клиент'),
            'last': c.get('last', 'Недавно'),
            'note': c.get('note', ''),
            'objection': c.get('objection', ''),
            'advice': c.get('advice', ''),
            'createdAt': c.get('createdAt', '2026-09-03'),
        })
    return out


def _build_proposals(apartments_out, clients_out, projects_out, apt_by_old_key):
    proj_by_id = {p['id']: p for p in projects_out}
    valid_client_ids = {c['id'] for c in clients_out}
    saved = get_proposals() or []
    if not isinstance(saved, list):
        saved = []

    out = []
    for i, p in enumerate(saved):
        old_pid = str(p.get('project_id') or '')
        old_aid = str(p.get('apartment_id') or '')

        new_apt = apt_by_old_key.get((old_pid, old_aid))
        if not new_apt and old_aid:
            for (op, oa), apt in apt_by_old_key.items():
                if oa == old_aid:
                    new_apt = apt
                    break
        if not new_apt:
            num_str = ''.join(filter(str.isdigit, old_aid))
            if num_str:
                num = int(num_str)
                for a in apartments_out:
                    if a['number'] == num:
                        new_apt = a
                        break
        if not new_apt:
            continue

        cid = str(p.get('client_id') or '')
        if cid not in valid_client_ids:
            cid = next(iter(valid_client_ids)) if valid_client_ids else 'user1'

        discount = _clamp_float(p.get('discount', 0), 0, 15, 0)
        status = 'ready' if p.get('status') == 'confirmed' else 'pending'
        created = str(p.get('created_at') or '2026-09-05T10:00:00')

        out.append({
            'id': str(p.get('proposal_id') or f'КП-{240+i:04d}')[:12].upper(),
            'clientId': cid,
            'apartmentId': new_apt['id'],
            'discount': discount,
            'renovation': bool(p.get('renovation', False)),
            'parking': bool(p.get('parking', False)),
            'status': status,
            'date': created[:10],
            'reason': str(p.get('proposal_text') or '')[:200],
            'snapshot': _make_snapshot(new_apt, proj_by_id.get(new_apt['projectId'], {})),
            'history': [{'label': 'Предложение подготовлено', 'at': created, 'actor': 'Анна Морозова'}],
        })
    return out


def _make_snapshot(apt, proj):
    return {
        'base': int(apt['price']),
        'limit': int(proj.get('limit', 5)),
        'version': '2026.09',
        'renovationPrice': int(apt['area'] * 18000),
        'parkingPrice': 900000,
        'forecast': proj.get('forecast', 'IV кв. 2026'),
        'planned': proj.get('planned', 'IV кв. 2026'),
        'risk': proj.get('risk', 'ontrack'),
        'reason': proj.get('reason', ''),
        'progress': proj.get('progress', 0),
    }


def _build_report():
    return {
        'week': {'label': '31 авг — 5 сен 2026', 'start': '2026-08-31',
                 'labels': ['31 авг', '1 сен', '2 сен', '3 сен', '4 сен', '5 сен'],
                 'current': [3.6, 5.1, 4.3, 6.8, 5.4, 6.9],
                 'previous': [3.4, 4.2, 3.9, 5.6, 4.7, 5.4]},
        'month': {'label': '1 — 5 сентября 2026', 'start': '2026-09-01',
                  'labels': ['1 сен', '2 сен', '3 сен', '4 сен', '5 сен'],
                  'current': [5.1, 4.3, 6.8, 5.4, 6.9],
                  'previous': [4.2, 3.9, 5.6, 4.7, 5.4]},
        'year': {'label': 'Январь — сентябрь 2026', 'start': '2026-01-01',
                 'labels': ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен'],
                 'current': [54, 62, 75, 68, 92, 84, 102, 114, 28.5],
                 'previous': [48, 58, 69, 66, 77, 74, 84, 96, 23.8]},
    }


# ---------- действия фронта ----------

def handle_action(name, payload):
    workspace = build_workspace()

    if name == 'create-proposal':
        apt = next((a for a in workspace['apartments'] if a['id'] == payload.get('apartmentId')), None)
        proj = None
        if apt:
            proj = next((p for p in workspace['projects'] if p['id'] == apt['projectId']), None)
        if not apt or not proj:
            return {'state': workspace, 'result': {}}

        discount_pct = _clamp_float(payload.get('discount', 0), 0, 15, 0)
        base = apt['price']
        discount_amt = round(base * discount_pct / 100)
        renovation = int(apt['area'] * 18000) if payload.get('renovation') else 0
        parking = 900000 if payload.get('parking') else 0
        total = base - discount_amt + renovation + parking

        save_proposal(
            client_id=payload.get('clientId', 'user1'),
            client_name='Клиент',
            project_id=apt['projectId'],
            apartment_id=apt['id'],
            total_price=total,
            discount=int(discount_pct),
            proposal_text=payload.get('reason', ''),
            original_completion=proj.get('planned', ''),
            current_completion=proj.get('forecast', ''),
        )

        result = {
            'id': f'КП-{250 + len(get_proposals()):04d}',
            'clientId': payload.get('clientId', 'user1'),
            'apartmentId': apt['id'],
            'discount': discount_pct,
            'renovation': bool(payload.get('renovation')),
            'parking': bool(payload.get('parking')),
            'status': 'ready' if discount_pct <= proj.get('limit', 5) else 'pending',
            'date': datetime.now().strftime('%Y-%m-%d'),
            'reason': payload.get('reason', ''),
            'snapshot': _make_snapshot(apt, proj),
            'history': [{'label': 'Предложение подготовлено',
                         'at': datetime.now().isoformat(),
                         'actor': 'Анна Морозова'}],
        }
        return {'state': build_workspace(), 'result': result}

    if name == 'accept-proposal':
        prop_id = str(payload.get('id') or '')
        for p in get_proposals():
            if str(p.get('proposal_id') or '').upper() == prop_id.upper():
                add_to_cart(
                    p.get('client_id', 'user1'),
                    p.get('project_id', ''),
                    p.get('apartment_id', ''),
                )
                break
        return {'state': build_workspace(), 'result': {'status': 'accepted'}}

    if name == 'analyze-dialogue':
        text = str(payload.get('text') or '')
        try:
            result = analyze_dialog_text(text)
            findings = []
            if result.get('issues'):
                findings.append({
                    'key': 'client-issues',
                    'title': 'Проблемы клиента',
                    'evidence': text[:280],
                    'recommendation': '; '.join(result['issues']),
                    'source': 'AI-анализ диалога',
                })
            if result.get('resolved_actions'):
                findings.append({
                    'key': 'actions',
                    'title': 'Действия менеджера',
                    'evidence': text[:280],
                    'recommendation': '; '.join(result['resolved_actions']),
                    'source': 'AI-анализ диалога',
                })
            return {
                'state': build_workspace(),
                'result': {
                    'findings': findings,
                    'next': (result.get('recommendations') or ['Уточните следующий шаг.'])[0],
                },
            }
        except Exception as e:
            return {'state': build_workspace(),
                    'result': {'findings': [], 'next': f'Ошибка: {e}'}}

    if name == 'save-client':
        raw = _read_clients_file()
        new_client = {
            'id': payload.get('id') or f'c{len(raw)+1}',
            'name': payload.get('name', 'Без имени'),
            'initials': ''.join(w[0] for w in payload.get('name', 'БИ').split()[:2]).upper(),
            'color': CLIENT_COLORS[len(raw) % len(CLIENT_COLORS)],
            'contact': payload.get('contact', ''),
            'phone': payload.get('phone', ''),
            'interest': f"{payload.get('rooms', 2)}-комн.",
            'budget': _clamp_int(payload.get('budget', 10000000), 1000000, 100000000, 10000000),
            'projectId': payload.get('projectId', 'p1'),
            'stage': 'Новый клиент',
            'last': 'Только что',
            'note': payload.get('note', ''),
            'objection': '',
            'advice': '',
            'createdAt': datetime.now().strftime('%Y-%m-%d'),
        }
        existing = next((c for c in raw if c['id'] == new_client['id']), None)
        if existing:
            existing.update(new_client)
        else:
            raw.append(new_client)
        _write_clients_file(raw)
        return {'state': build_workspace(), 'result': new_client}

    return {'state': workspace, 'result': payload}