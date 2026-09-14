/* Portable HTML/PDF-through-print and spreadsheet-safe CSV exports. */
(() => {
  'use strict';
  const D = window.DSK_DATA;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => Math.round(v).toLocaleString('ru-RU') + ' ₽';
  const labels = { ready: 'Готово', pending: 'Требует согласования', accepted: 'В резерве', rejected: 'Скидка отклонена', unavailable: 'Квартира недоступна' };
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function csvCell(value) {
    let text = String(value ?? '');
    // Text cells cannot be interpreted as formulas in spreadsheet applications.
    if (/^[\s\uFEFF]*[=+@-]/u.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function csv(rows) { return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n'); }
  function proposalHTML(id) {
    const q = D.proposals.find(q => q.id === id);
    if (!q || !['ready', 'pending', 'accepted'].includes(q.status)) throw new Error('Это предложение нельзя выгрузить. Подготовьте новый расчёт.');
    if (D.actor.role === 'client' && q.clientId !== D.actor.clientId) throw new Error('Это предложение относится к другому клиенту.');
    const c = D.clients.find(c => c.id === q.clientId), a = D.apartments.find(a => a.id === q.apartmentId), p = D.projects.find(p => p.id === a.projectId), s = q.snapshot;
    const v = window.DskDomain.quote(q, s);
    const rows = [ ['Клиент', c.name], ['Объект', p.name + ' · ' + p.building], ['Квартира', `№${a.number} · ${a.rooms}-комнатная · ${a.area.toLocaleString('ru-RU')} м²`], ['Этаж', a.floor + ' из ' + a.floors], ['Готовность на дату расчёта', s.progress + '%'], ['Договорный срок', s.planned], ['Прогноз ключей', s.forecast], ['Базовая стоимость', money(v.base)], ['Скидка ' + q.discount + '%', '− ' + money(v.discount)], ['Чистовая отделка', q.renovation ? money(v.renovation) : 'Не включена'], ['Машиноместо', q.parking ? money(v.parking) : 'Не включено'] ];
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(q.id)} · ДСК</title><style>body{font:15px/1.7 Arial,sans-serif;color:#36363a;max-width:800px;margin:45px auto;padding:0 25px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #ee6833;padding-bottom:18px}.logo{font-size:37px;font-weight:800;letter-spacing:-2px}.logo span{color:#ef632c}h1{font-size:34px;font-weight:500;line-height:1.3;letter-spacing:-1px;margin:35px 0 12px}h1 em{font-family:Arial,sans-serif;font-style:normal;color:#db783e;font-weight:500}p,small{color:#85818a}.status{display:inline-block;padding:5px 9px;background:#f5efe9;border-radius:6px;font-size:12px;color:#a27d62}table{border-collapse:collapse;width:100%;margin:25px 0}td{padding:10px 0;border-bottom:1px solid #efebec;vertical-align:top}td:first-child{color:#9a919a;width:45%}td:last-child{text-align:right}.total{padding:22px;background:linear-gradient(110deg,#fff0de,#fff5ed);border:1px solid #f2deca;border-radius:13px;display:flex;align-items:center;justify-content:space-between;gap:20px}.total strong{font-size:28px;white-space:nowrap}.notice{padding:17px 19px;margin-top:20px;border:1px solid #ecd4c5;background:#fff9f1;border-radius:10px;color:#a7866d;font-size:13px;line-height:1.9}.notice strong{display:block;color:#99714f}button{border:0;border-radius:9px;padding:12px 19px;background:#ef682d;color:#fff;font:inherit;cursor:pointer}.fine{font-size:11px;margin:25px 0;line-height:1.9}@media print{body{margin:15px auto;font-size:12px}h1{font-size:27px;margin-top:25px}button{display:none}table,.total,.notice{break-inside:avoid}.total strong{font-size:23px}@page{size:A4;margin:14mm}}</style></head><body><header><div class="logo">дск<span>.</span></div><div>${esc(q.id)}<br><small>${new Date(q.date + 'T12:00:00').toLocaleDateString('ru-RU')}</small></div></header><h1>Пространство<br><em>для вашей жизни.</em></h1><p>Персональное предложение для ${esc(c.name)}</p><span class="status">${labels[q.status]}</span><table>${rows.map(([k, value]) => `<tr><td>${esc(k)}</td><td>${esc(value)}</td></tr>`).join('')}</table><div class="total"><span>Итоговая стоимость</span><strong>${money(v.total)}</strong></div>${q.status === 'pending' ? `<div class="notice"><strong>Предварительные условия · требуется согласование</strong>Скидка ${q.discount}% превышает лимит ${s.limit}%. Окончательные условия подтвердит руководитель.</div>` : ''}${D.actor.role !== 'client' && q.approval?.status === 'approve' ? `<div class="notice"><strong>Скидка одобрена</strong>${esc(q.approval.by)}: ${esc(q.approval.comment)}</div>` : ''}${s.risk === 'risk' ? `<div class="notice"><strong>Изменение прогноза ключей</strong>${esc(s.reason)}</div>` : ''}<p class="fine">Демонстрационные данные. Предложение не является публичной офертой. Расчёт зафиксирован по финансовой модели ${esc(s.version)}. Скидка применяется только к квартире; дополнительные услуги учитываются отдельно. Прогноз не изменяет договорный срок. Проверка доступности квартиры обязательна перед реальной сделкой.</p><button onclick="window.print()">Печать / Сохранить в PDF</button></body></html>`;
  }
  window.DskExports = {
    csv, csvCell, proposalHTML,
    proposal(id) { download('DSK-' + id + '.html', proposalHTML(id), 'text/html;charset=utf-8'); },
    proposals(items) {
      const rows = [['Демо-отчёт ДСК', '5 сентября 2026'], ['Номер КП', 'Клиент', 'Жилой комплекс', 'Квартира', 'Скидка, %', 'Итого, руб.', 'Статус', 'Дата', 'Модель']];
      items.forEach(q => { const a = D.apartments.find(a => a.id === q.apartmentId); rows.push([q.id, D.clients.find(c => c.id === q.clientId).name, D.projects.find(p => p.id === a.projectId).name, a.number, q.discount, window.DskDomain.quote(q, q.snapshot).total, labels[q.status] || q.status, q.date, q.snapshot.version]); });
      download('DSK-proposals.csv', csv(rows), 'text/csv;charset=utf-8');
    },
    sales(report) {
      const rows = [['Демо-сводка продаж ДСК', report.label], ['Период', 'Продажи, руб.', 'Аналогичный период, руб.'], ...report.labels.map((label, i) => [label, report.current[i], report.previous[i]]), ['Итого', report.total, report.before]];
      download('DSK-sales.csv', csv(rows), 'text/csv;charset=utf-8');
    }
  };
})();
