import json
import random
import datetime
from faker import Faker

fake = Faker('ru_RU')
random.seed(42)

def generate_production_data():
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

        # Даты строительства
        planned_start = fake.date_between(start_date='-1y', end_date='-6m')
        planned_end = fake.date_between(start_date='+6m', end_date='+2y')
        actual_end = planned_end + datetime.timedelta(days=random.randint(-60, 90))

        # Этапы строительства с графиком
        stages = [
            {"name": "Фундамент", "planned_duration": 60, "actual_duration": random.randint(50, 80)},
            {"name": "Стены и перекрытия", "planned_duration": 90, "actual_duration": random.randint(80, 120)},
            {"name": "Кровля", "planned_duration": 45, "actual_duration": random.randint(40, 60)},
            {"name": "Инженерные системы", "planned_duration": 60, "actual_duration": random.randint(50, 80)},
            {"name": "Отделка", "planned_duration": 90, "actual_duration": random.randint(70, 120)},
            {"name": "Благоустройство", "planned_duration": 30, "actual_duration": random.randint(20, 50)}
        ]

        # Рассчитываем фактические даты этапов
        current_date = planned_start
        stage_schedule = []
        for idx, stage in enumerate(stages):
            planned_start_date = current_date
            planned_end_date = planned_start_date + datetime.timedelta(days=stage["planned_duration"])
            actual_end_date = planned_start_date + datetime.timedelta(days=stage["actual_duration"])
            stage_schedule.append({
                "name": stage["name"],
                "planned_start": planned_start_date.strftime("%Y-%m-%d"),
                "planned_end": planned_end_date.strftime("%Y-%m-%d"),
                "actual_end": actual_end_date.strftime("%Y-%m-%d"),
                "status": "завершён" if actual_end_date <= datetime.datetime.now().date() else "в процессе" if idx < 4 else "запланирован"
            })
            current_date = actual_end_date + datetime.timedelta(days=random.randint(1, 10))

        # График производства ЖБИ
        zbi_schedule = {
            "wall_panels": {"planned": random.randint(100, 300), "produced": random.randint(50, 250), "unit": "шт"},
            "floor_slabs": {"planned": random.randint(50, 150), "produced": random.randint(30, 130), "unit": "шт"},
            "stair_flights": {"planned": random.randint(20, 60), "produced": random.randint(15, 55), "unit": "шт"}
        }

        # Остатки материалов с динамикой (исправлено: daily_consumption теперь целое число)
        materials = {
            "cement": {"available": random.randint(10, 300), "unit": "т", "daily_consumption": random.randint(1, 5)},
            "rebar": {"available": random.randint(5, 100), "unit": "т", "daily_consumption": random.randint(1, 3)},
            "bricks": {"available": random.randint(500, 20000), "unit": "шт", "daily_consumption": random.randint(50, 500)}
        }

        # Изменения в проекте
        changes = []
        if random.random() > 0.6:
            changes.append({
                "date": fake.date_between(start_date='-3m', end_date='today').strftime("%Y-%m-%d"),
                "description": random.choice([
                    "Задержка поставки панелей на 2 недели",
                    "Изменение планировки этажа 3",
                    "Корректировка фасада по требованию архитектурного надзора",
                    "Увеличение площади остекления",
                    "Перенос ввода инженерных сетей"
                ]),
                "impact": random.choice(["Срок сдачи сдвигается на 1 месяц", "Без изменения сроков", "Требуется пересчет бюджета"])
            })

        # Квартиры
        apartments = []
        for j in range(10):
            apt_id = f"A{str(j+1).zfill(3)}"
            floor = random.randint(1, 20)
            area = round(random.uniform(30, 120), 1)
            rooms = random.choice([1, 2, 3, 4])
            base_price_per_sqm = random.randint(90000, 150000)
            # Скидка зависит от задержки
            delay_days = (actual_end - planned_end).days
            project_discount = min(delay_days // 30 * 1, 5) if delay_days > 0 else 0
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
                "discount_percent": total_discount,
                "status": random.choice(["свободна", "забронирована", "продана"])
            })

        # Процент готовности объекта
        progress = random.randint(20, 95)

        projects.append({
            "project_id": project_id,
            "name": name,
            "address": address,
            "planned_completion": planned_end.strftime("%Y-%m-%d"),
            "actual_completion": actual_end.strftime("%Y-%m-%d"),
            "construction_stage": stage_schedule[-1]["name"] if stage_schedule else "не начат",
            "progress_percent": progress,
            "stage_schedule": stage_schedule,
            "zbi_schedule": zbi_schedule,
            "materials": materials,
            "project_changes": changes,
            "available_apartments": apartments,
            "project_discount": project_discount
        })

    # Конкуренты
    competitors = [
        {"name": "ЖК «Зелёный»", "price_per_sqm": 108000, "distance": "500 м", "completion": "2026-11-01"},
        {"name": "ЖК «Парковый»", "price_per_sqm": 112000, "distance": "1 км", "completion": "2027-03-01"},
        {"name": "ЖК «Речной»", "price_per_sqm": 125000, "distance": "2 км", "completion": "2026-12-15"}
    ]

    return {"projects": projects, "competitors": competitors}

def save_data():
    data = generate_production_data()
    with open("backend/data/erp_data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("✅ База данных обновлена с учётом производственных процессов.")

if __name__ == "__main__":
    save_data()