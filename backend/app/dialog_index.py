import os
import shutil
from whoosh.index import create_in, open_dir
from whoosh.fields import Schema, TEXT, ID
from whoosh.qparser import QueryParser
from backend.app.cache import get_dialogs_data

INDEX_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "dialog_index")

def build_index():
    # Удаляем старую папку индекса, если она есть
    if os.path.exists(INDEX_DIR):
        shutil.rmtree(INDEX_DIR)
    os.makedirs(INDEX_DIR, exist_ok=True)

    schema = Schema(dialog_id=ID(stored=True), summary=TEXT(stored=True), issues=TEXT)
    ix = create_in(INDEX_DIR, schema)
    writer = ix.writer()
    data = get_dialogs_data()
    for dialog in data.get("dialogs", []):
        insights = dialog.get("extracted_insights")
        if insights is None:
            insights = {}
        issues_text = " ".join(insights.get("issues", []))
        summary = dialog.get("summary", "")
        if not summary and issues_text:
            summary = issues_text[:200]
        writer.add_document(
            dialog_id=dialog["dialog_id"],
            summary=summary,
            issues=issues_text
        )
    writer.commit()
    print("✅ Индекс диалогов построен")

def search_dialogs(query: str, limit=5):
    try:
        ix = open_dir(INDEX_DIR)
        with ix.searcher() as searcher:
            parser = QueryParser("summary", ix.schema)
            q = parser.parse(query)
            results = searcher.search(q, limit=limit)
            found = []
            data = get_dialogs_data()
            for hit in results:
                dialog_id = hit["dialog_id"]
                for d in data.get("dialogs", []):
                    if d["dialog_id"] == dialog_id:
                        found.append(d)
                        break
            return found
    except Exception as e:
        print("❌ Ошибка поиска в индексе:", e)
        return []