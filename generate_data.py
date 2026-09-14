import json
import random
import datetime
from faker import Faker

fake = Faker('ru_RU')
random.seed(42)

def generate_erp_data():
    projects = []
    project_names = [
        "ЖК «Солнечный»", "ЖК «Зелёный парк»", "ЖК «Речной»",
        "ЖК «Центральный»", "ЖК «Приморский»", "ЖК «Академ»",
        "ЖК «Лесной»", "ЖК «Озерный»", "ЖК «Парковый»",
        "ЖК «Спортивный»"
    ]
    streets = [
        "ул. Солнечная", "ул. Парковая", "наб. Речная",
        "ул. Ленина", "ул. Морская", "пр. Академический",
        "ул. Лесная", "ул. Озерная", "ул. Садовая",
        "ул. Спортивная"
    ]
    for i in range(10):
        project_id = f"P{str(i+1).zfill(3)}"
        name = project_names[i]
        address = f"г. Москва, {streets[i]}, {random.randint(1,20)}"
        planned = fake.date_between(start_date='+1y', end_date='+2y')
        actual = planned + datetime.timedelta(days=random.randint(-30, 60))
        delay_days = (actual - planned).days
        project_discount = min(delay_days // 30 * 1, 5) if delay_days > 0 else 0
        stage_options = [
            "Монтаж этажей", "Заливка фундамента", "Отделочные работы",
            "Возведение стен", "Кровельные работы", "Благоустройство"
        ]
        stage = random.choice(stage_options)
        apartments = []
        for j in range(10):
            apt_id = f"A{str(j+1).zfill(3)}"
            floor = random.randint(1, 20)
            area = round(random.uniform(30, 120), 1)
            rooms = random.choice([1, 2, 3, 4])
            base_price_per_sqm = random.randint(90000, 150000)
            apt_discount = random.randint(0, 8)
            total_discount = min(project_discount + apt_discount, 15)
            price_per_sqm = int(base_price_per_sqm * (1 - total_discount / 100))
            apartments.append({
                "id": apt_id,
                "floor": floor,
                "area": area,
                "rooms": rooms,
                "base_price_per_sqm": base_price_per_sqm,
                "price_per_sqm": price_per_sqm,
                "discount_percent": total_discount
            })
        projects.append({
            "project_id": project_id,
            "name": name,
            "address": address,
            "planned_completion": planned.strftime("%Y-%m-%d"),
            "actual_completion": actual.strftime("%Y-%m-%d"),
            "construction_stage": stage,
            "available_apartments": apartments,
            "materials_remaining": {
                "cement": f"{random.randint(10, 300)} т",
                "rebar": f"{random.randint(5, 100)} т"
            },
            "project_discount": project_discount
        })
    competitors = [
        {"name": "ЖК «Зелёный»", "price_per_sqm": 108000, "distance": "500 м", "completion": "2026-11-01"},
        {"name": "ЖК «Парковый»", "price_per_sqm": 112000, "distance": "1 км", "completion": "2027-03-01"},
        {"name": "ЖК «Речной»", "price_per_sqm": 125000, "distance": "2 км", "completion": "2026-12-15"}
    ]
    return {"projects": projects, "competitors": competitors}

def generate_dialogs():
    dialogs = []
    manager_greetings = [
        "Добрый день! Чем могу помочь?",
        "Здравствуйте! Рад вас приветствовать.",
        "Добрый вечер! Слушаю вас."
    ]
    client_questions = [
        "Интересует квартира в {project}.",
        "Какие есть варианты с {rooms} комнатами?",
        "Мне нужна квартира площадью {area} кв.м.",
        "Хочу купить квартиру в {project}, что можете предложить?",
        "Есть ли скидки или рассрочка?"
    ]
    manager_responses = [
        "У нас есть варианты: {apartments}.",
        "Могу предложить квартиру на {floor} этаже, {area} кв.м., цена {price}.",
        "К сожалению, таких квартир нет, но есть {alternative}.",
        "Мы можем предложить рассрочку на {months} месяцев.",
        "Скидка {discount}% при 100% оплате."
    ]
    client_reactions = [
        "Это дороговато.",
        "А можно посмотреть планировку?",
        "Мне нужно ближе к центру.",
        "Устраивает, давайте забронируем.",
        "Я подумаю, позвоню позже."
    ]

    for i in range(50):
        dialog_id = f"D{str(i+1).zfill(3)}"
        client_id = f"C{random.randint(100,999)}"
        manager_id = f"M{random.randint(100,999)}"
        project = random.choice(["ЖК «Солнечный»", "ЖК «Зелёный парк»", "ЖК «Речной»", "ЖК «Центральный»"])
        rooms = random.choice([1,2,3,4])
        area = random.choice(["40-50", "60-70", "80-90", "100-110"])
        floor = random.randint(1,10)
        price = random.randint(5000000, 15000000)
        discount = random.randint(3,10)
        months = random.choice([6,12,24])

        messages = []
        messages.append({
            "role": "manager",
            "text": random.choice(manager_greetings),
            "timestamp": fake.iso8601()
        })
        q_template = random.choice(client_questions)
        q_text = q_template.format(project=project, rooms=rooms, area=area)
        messages.append({"role": "client", "text": q_text, "timestamp": fake.iso8601()})

        r_template = random.choice(manager_responses)
        apt_ids = [f"A{random.randint(1,10)}" for _ in range(2)]
        r_text = r_template.format(
            apartments=", ".join(apt_ids),
            floor=floor,
            area=area,
            price=price,
            alternative="квартира с меньшей площадью",
            months=months,
            discount=discount
        )
        messages.append({"role": "manager", "text": r_text, "timestamp": fake.iso8601()})

        reaction = random.choice(client_reactions)
        messages.append({"role": "client", "text": reaction, "timestamp": fake.iso8601()})

        if random.random() > 0.5:
            extra = random.choice([
                "А можно посмотреть фото?",
                "Спасибо, я перезвоню.",
                "Какие документы нужны?",
                "Можно ли снизить цену?"
            ])
            messages.append({"role": "client", "text": extra, "timestamp": fake.iso8601()})
            messages.append({
                "role": "manager",
                "text": random.choice(["Конечно, отправлю на почту.", "Да, мы можем обсудить.", "Документы стандартные."]),
                "timestamp": fake.iso8601()
            })

        issues = [random.choice([
            "Клиент считает цену завышенной",
            "Клиент хочет квартиру ближе к центру",
            "Клиента не устраивает этаж",
            "Клиент просит дополнительную скидку"
        ])]
        actions = [random.choice([
            "Менеджер предложил альтернативную квартиру",
            "Менеджер объяснил преимущества района",
            "Менеджер предложил рассрочку",
            "Менеджер пообещал скидку при бронировании"
        ])]
        summary = f"Клиент интересуется {rooms}-комнатной квартирой. Основная проблема: {issues[0]}. Решение: {actions[0]}."

        dialogs.append({
            "dialog_id": dialog_id,
            "client_id": client_id,
            "manager_id": manager_id,
            "project_id": f"P{str(random.randint(1,10)).zfill(3)}",
            "messages": messages,
            "extracted_insights": {
                "issues": issues,
                "resolved_actions": actions,
                "recommendations": [random.choice(["Предложить дополнительный просмотр", "Сделать скидку"])]
            },
            "summary": summary
        })

    return {"dialogs": dialogs}

def save_data():
    erp = generate_erp_data()
    with open("backend/data/erp_data.json", "w", encoding="utf-8") as f:
        json.dump(erp, f, ensure_ascii=False, indent=2)
    dialogs = generate_dialogs()
    with open("backend/data/dialogs.json", "w", encoding="utf-8") as f:
        json.dump(dialogs, f, ensure_ascii=False, indent=2)
    print("✅ Данные успешно сгенерированы: 100 квартир, 50 диалогов.")

if __name__ == "__main__":
    save_data()