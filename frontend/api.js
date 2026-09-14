/* Domain rules and the single backend boundary. Demo changes live in memory.
   HTTP mode: GET /workspace; POST /actions/:name -> { state, result }.
   A production backend must enforce authentication, roles and all financial rules. */
(() => {
  'use strict';
  const D = window.DSK_DATA;
  const copy = value => JSON.parse(JSON.stringify(value));
  const asOf = '2026-09-05T10:42:00';
  const actors = {
    manager: { id: 'manager-anna', name: 'Анна Морозова', initials: 'АМ', label: 'Менеджер · демо', role: 'manager' },
    lead: { id: 'lead-sergey', name: 'Сергей Белов', initials: 'СБ', label: 'Руководитель · демо', role: 'lead' },
    client: { id: 'client-mikhail', clientId: 'user1', name: 'Иван Иванов', initials: 'ИИ', label: 'Клиент · Иван Иванов', role: 'client' }
  };
  Object.assign(D, { asOf, actor: copy(actors.manager), quoteDrafts: [] });
  let sequence = 249;
  let draftSequence = 1;
  let clientSequence = 6;
  let mutationCounter = 0;
  const changed = () => { mutationCounter++; };
  const find = (list, id, message) => {
    const result = list.find(x => x.id === id);
    if (!result) throw new DomainError(message || 'Запись больше недоступна. Обновите данные.', 'NOT_FOUND');
    return result;
  };
  class DomainError extends Error {
    constructor(message, code = 'VALIDATION', field = '') { super(message); this.name = 'DomainError'; this.code = code; this.field = field; }
  }
  const pFor = a => find(D.projects, a.projectId, 'Объект не найден.');
  const string = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
  const amount = value => Math.round(value);
  const localStamp = () => new Date().toISOString();
  function quote(input, snapshot = null) {
    const a = find(D.apartments, input.apartmentId, 'Выберите квартиру.');
    if (input.discount === '' || input.discount == null || !Number.isFinite(Number(input.discount))) throw new DomainError('Введите скидку от 0 до 15%.', 'VALIDATION', 'discount');
    const percentage = Number(input.discount);
    if (percentage < 0 || percentage > D.model.maxInputDiscount || Math.abs(percentage * 10 - Math.round(percentage * 10)) > 0.00001) throw new DomainError('Скидка — от 0 до 15%, с шагом 0,1%.', 'VALIDATION', 'discount');
    const base = snapshot?.base ?? a.price;
    const discount = amount(base * percentage / 100);
    const renovation = input.renovation ? (snapshot?.renovationPrice ?? amount(a.area * D.model.renovationPerMeter)) : 0;
    const parking = input.parking ? (snapshot?.parkingPrice ?? D.model.parkingPrice) : 0;
    return { base, discount, percentage, renovation, parking, total: base - discount + renovation + parking };
  }
  function makeSnapshot(input) {
    const a = find(D.apartments, input.apartmentId), p = pFor(a);
    return { base: a.price, limit: p.limit, version: D.model.version, renovationPrice: amount(a.area * D.model.renovationPerMeter), parkingPrice: D.model.parkingPrice, forecast: p.forecast, planned: p.planned, risk: p.risk, reason: p.reason, progress: p.progress };
  }
  function validateState(value) {
    if (!value || !['projects', 'clients', 'apartments', 'proposals', 'drafts', 'quoteDrafts'].every(k => Array.isArray(value[k])) || !value.actor || !value.model || !value.report) throw new DomainError('Источник вернул неполные данные. Проверьте подключение.', 'BAD_RESPONSE');
    const idPattern = /^[\p{L}\p{N}_.:~-]+$/u;
    const quarterPattern = /^(I|II|III|IV) кв\. \d{4}$/u;
    for (const key of ['projects', 'clients', 'apartments', 'proposals', 'drafts', 'quoteDrafts']) {
      const ids = new Set();
      for (const record of value[key]) {
        if (typeof record.id !== 'string' || !idPattern.test(record.id) || ids.has(record.id)) throw new DomainError('Источник вернул некорректные идентификаторы записей.', 'BAD_RESPONSE');
        ids.add(record.id);
      }
    }
    value.projects.forEach(p => {
      if (!Number.isFinite(p.progress) || p.progress < 0 || p.progress > 100 || !Number.isFinite(p.limit) || p.limit < 0 || p.limit > 15 || !['sage', 'sand', 'blue'].includes(p.color) || !quarterPattern.test(p.forecast) || !quarterPattern.test(p.planned)) throw new DomainError('Источник вернул некорректные сведения об объекте.', 'BAD_RESPONSE');
    });
    value.apartments.forEach(a => { if (!Number.isSafeInteger(a.price) || a.price <= 0 || !Number.isFinite(a.area) || a.area <= 0 || !['available', 'reserved'].includes(a.status)) throw new DomainError('Проверьте стоимость и статус квартиры в источнике.', 'BAD_RESPONSE'); });
    value.clients.forEach(c => { if (!['purple', 'sand', 'blue', 'sage', 'peach'].includes(c.color) || !Number.isFinite(c.budget) || !value.projects.some(p => p.id === c.projectId)) throw new DomainError('Источник вернул некорректную карточку клиента.', 'BAD_RESPONSE'); });
    value.proposals.forEach(q => { if (!['ready', 'pending', 'accepted', 'rejected', 'unavailable'].includes(q.status) || !q.snapshot || !Number.isFinite(q.discount) || !Array.isArray(q.history) || !quarterPattern.test(q.snapshot.forecast) || !quarterPattern.test(q.snapshot.planned)) throw new DomainError('Источник вернул некорректное предложение.', 'BAD_RESPONSE'); });
    for (const period of ['week', 'month', 'year']) {
      const r = value.report[period];
      if (!r || !Array.isArray(r.labels) || r.labels.length !== r.current?.length || r.labels.length !== r.previous?.length || !r.current.every(Number.isFinite) || !r.previous.every(Number.isFinite) || ![r.label, ...r.labels].every(x => typeof x === 'string' && !/[<>"&]/u.test(x))) throw new DomainError('Проверьте структуру отчёта продаж.', 'BAD_RESPONSE');
    }
    value.apartments.forEach(a => { if (!value.projects.some(p => p.id === a.projectId)) throw new DomainError('В данных есть квартира без объекта.', 'BAD_RESPONSE'); });
    value.proposals.forEach(q => { if (!value.apartments.some(a => a.id === q.apartmentId) || !value.clients.some(c => c.id === q.clientId)) throw new DomainError('В данных есть предложение без клиента или квартиры.', 'BAD_RESPONSE'); });
    return value;
  }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const url = window.DSK_CONFIG.apiBase.replace(/\/$/, '') + path;
    try {
      console.log('[DskAPI] →', options.method || 'GET', url);
      const response = await fetch(url, { credentials: 'same-origin', ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...options.headers } });
      console.log('[DskAPI] ←', response.status, url);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('[DskAPI] error body:', text);
        throw new DomainError(response.status === 403 ? 'Недостаточно прав для этого действия.' : 'Не удалось получить данные. Попробуйте ещё раз.', 'HTTP_ERROR');
      }
      return await response.json();
    } catch (e) {
      if (e.name === 'AbortError') throw new DomainError('Источник не ответил вовремя. Повторите запрос.', 'TIMEOUT');
      if (e instanceof DomainError) throw e;
      console.error('[DskAPI] network error:', e);
      throw new DomainError('Нет связи с источником. Проверьте подключение и повторите.', 'NETWORK');
    } finally { clearTimeout(timeout); }
  }
  async function run(name, payload, demo) {
    if (window.DSK_CONFIG.mode === 'demo') return demo();
    const response = await request('/actions/' + name, { method: 'POST', body: JSON.stringify(payload) });
    Object.assign(D, validateState(response.state));
    changed();
    return response.result;
  }
  function timeline(q, label) { q.history.push({ label, at: localStamp(), actor: D.actor.name }); }
  function attention(projectId = 'all') {
    const scoped = id => projectId === 'all' || id === projectId;
    const pending = D.proposals.filter(q => q.status === 'pending' && scoped(find(D.apartments, q.apartmentId).projectId));
    const risks = D.projects.filter(p => p.risk === 'risk' && scoped(p.id));
    const unnotified = D.clients.filter(c => risks.some(p => p.id === c.projectId) && !D.drafts.some(d => d.clientId === c.id && d.projectId === c.projectId && d.status === 'reviewed'));
    return { pending, risks, unnotified, total: pending.length + risks.length + unnotified.length };
  }
  function report(period = 'month', projectId = 'all') {
    const source = D.report[period] || D.report.month;
    const multiplier = ({ all: 1, p1: 0.45, p2: 0.32, p3: 0.23 })[projectId] ?? 1;
    const current = source.current.map(v => amount(v * 1000000 * multiplier));
    const previous = source.previous.map(v => amount(v * 1000000 * multiplier));
    const total = current.reduce((a, b) => a + b, 0), before = previous.reduce((a, b) => a + b, 0);
    const selected = id => projectId === 'all' || id === projectId;
    return { ...source, current, previous, total, before, delta: before ? (total - before) / before * 100 : null, proposals: D.proposals.filter(q => q.date >= source.start && selected(find(D.apartments, q.apartmentId).projectId)), clients: D.clients.filter(c => selected(c.projectId)), attention: attention(projectId) };
  }
  function matchesFor(clientId, options = {}) {
    const c = find(D.clients, clientId);
    return D.apartments.filter(a => a.status === 'available').map(a => {
      const p = pFor(a), discount = Math.min(3, p.limit);
      const cost = quote({ apartmentId: a.id, discount, renovation: false, parking: false });
      const rooms = c.rooms || Number(c.interest.match(/\d+/)?.[0] || 0);
      return { apartment: a, project: p, discount, total: cost.total, fitsBudget: cost.total <= c.budget, fitsRooms: !rooms || rooms === a.rooms, score: (cost.total <= c.budget ? 4 : 0) + (p.id === c.projectId ? 2 : 0) + (rooms === a.rooms ? 3 : 0) + (p.risk === 'ontrack' ? 1 : 0) };
    }).filter(m => !options.onlyFits || (m.fitsBudget && m.fitsRooms)).sort((a, b) => b.score - a.score || a.total - b.total);
  }
  function analyzeTranscript(text, clientId) {
    const clean = string(text, 6000);
    if (clean.length < 20) throw new DomainError('Добавьте хотя бы 20 символов диалога.', 'VALIDATION', 'transcript');
    const c = find(D.clients, clientId), p = find(D.projects, c.projectId);
    const sentences = clean.split(/(?<=[.!?])\s+|\n/).map(s => s.trim()).filter(Boolean);
    const topics = [
      { key: 'price', title: 'Стоимость и скидка', re: /цен|дорог|дешев|скид|бюджет|стоим|млн/iu, recommendation: `Лимит по ЖК «${p.name}» — ${p.limit}%. Покажите полный расчёт и отделите стоимость дополнительных услуг. Превышение отправьте на согласование.`, source: `Финмодель ${D.model.version}` },
      { key: 'time', title: 'Срок передачи ключей', re: /срок|ключ|задерж|позж|сдач|строитель|успе/iu, recommendation: `Готовность — ${p.progress}%. Договорный срок: ${p.planned}. Прогноз ключей: ${p.forecast}. ${p.risk === 'risk' ? 'Сообщите о задержке поставки и не обещайте исходный прогноз.' : 'Подтвердите срок актуальными данными строительного контроля.'}`, source: 'ERP · 5 сентября, 10:42' },
      { key: 'layout', title: 'Планировка и отделка', re: /планиров|комнат|отделк|ремонт|площад|семь|школ/iu, recommendation: 'Уточните состав семьи, нужную площадь и предпочтения по отделке. В демо-срезе изменений конфигурации квартир не зарегистрировано.', source: 'Карточка клиента / проектная документация' },
      { key: 'payment', title: 'Оплата и ипотека', re: /ипотек|взнос|рассроч|кредит|банк/iu, recommendation: 'Уточните первоначальный взнос и способ оплаты. Банковские ставки и одобрение не подключены: перед обещанием условий получите подтверждённый расчёт.', source: 'Недостающий источник · условия банка' },
      { key: 'competitor', title: 'Предложение конкурента', re: /конкурент|соседн|застройщик|другом жк/iu, recommendation: 'Запросите ссылку на предложение, площадь, отделку и дату сдачи. Без этих данных корректное сравнение невозможно; конкурентный источник пока не подключён.', source: 'Требуется подтверждённое предложение' }
    ];
    const findings = topics.filter(t => t.re.test(clean)).map(t => ({ ...t, re: undefined, evidence: sentences.find(s => t.re.test(s))?.slice(0, 280) || clean.slice(0, 280) }));
    return { findings, clientId, text: clean, next: findings.length ? 'Уточните открытый вопрос и зафиксируйте следующий шаг с клиентом.' : 'В этом фрагменте не найдено достаточно признаков для предметного вывода. Добавьте вопрос клиента о цене, сроках или квартире.' };
  }
  window.DskDomain = { quote, attention, report, matchesFor, analyzeTranscript, validateState, copy, get hasChanges() { return mutationCounter > 0; }, actors };
  window.DskAPI = {
    async getDashboard() {
      if (window.DSK_CONFIG.mode !== 'demo') {
        console.log('[DskAPI] режим http, грузим /workspace');
        try {
          const raw = await request('/workspace');
          const valid = validateState(raw);
          Object.assign(D, valid);
          console.log('[DskAPI] /workspace применён. projects:', D.projects.length, 'apartments:', D.apartments.length, 'clients:', D.clients.length, 'proposals:', D.proposals.length);
          // Привязываем роль "Клиент" к пользователю user1@gmail.com из clients.json
          const loginClient = D.clients.find(c => c.contact === 'user1@gmail.com') || D.clients[0];
          if (loginClient) {
            actors.client.clientId = loginClient.id;
            actors.client.name = loginClient.name;
            actors.client.initials = loginClient.initials;
            actors.client.label = `Клиент · ${loginClient.name}`;
          }
        } catch (e) {
          console.error('[DskAPI] не удалось применить /workspace:', e);
          throw e;
        }
      }
      return D;
    },
    async setDemoRole(role) {
      if (!actors[role]) throw new DomainError('Роль неизвестна.', 'FORBIDDEN');
      const actorCopy = copy(actors[role]);
      // Роль "Клиент" всегда привязываем к актуальному клиенту из D.clients
      if (role === 'client') {
        const loginClient = D.clients.find(c => c.contact === 'user1@gmail.com') || D.clients[0];
        if (loginClient) {
          actorCopy.clientId = loginClient.id;
          actorCopy.name = loginClient.name;
          actorCopy.initials = loginClient.initials;
          actorCopy.label = `Клиент · ${loginClient.name}`;
        }
      }
      D.actor = actorCopy;
      return D.actor;
    },
    async createProposal(input) {
      return run('create-proposal', input, () => {
        const c = find(D.clients, input.clientId, 'Выберите клиента.'), a = find(D.apartments, input.apartmentId, 'Выберите квартиру.');
        const p = pFor(a), cost = quote(input);
        const reason = string(input.reason);
        if (cost.percentage > p.limit && reason.length < 10) throw new DomainError('Обоснуйте скидку выше лимита: минимум 10 символов.', 'VALIDATION', 'reason');
        const previous = input.requestKey && D.proposals.find(q => q.requestKey === input.requestKey);
        if (previous) {
          if (previous.clientId !== input.clientId || previous.apartmentId !== input.apartmentId || previous.discount !== cost.percentage || previous.renovation !== !!input.renovation || previous.parking !== !!input.parking) throw new DomainError('Этот запрос уже сохранён с другими условиями. Откройте новое предложение.', 'CONFLICT');
          return previous;
        }
        if (a.status !== 'available') throw new DomainError('Квартиру уже забронировали. Выберите другой вариант.', 'CONFLICT', 'apartmentId');
        const q = { id: 'КП-' + String(sequence++).padStart(4, '0'), clientId: c.id, apartmentId: a.id, discount: cost.percentage, renovation: !!input.renovation, parking: !!input.parking, reason, status: cost.percentage > p.limit ? 'pending' : 'ready', date: asOf.slice(0, 10), createdBy: D.actor.id, snapshot: makeSnapshot(input), requestKey: input.requestKey || '', history: [] };
        timeline(q, 'Предложение подготовлено');
        if (q.status === 'pending') timeline(q, 'Запрошено согласование скидки');
        D.proposals.unshift(q);
        c.stage = q.status === 'pending' ? 'Согласование скидки' : 'КП подготовлено';
        if (input.draftId) D.quoteDrafts = D.quoteDrafts.filter(d => d.id !== input.draftId);
        changed(); return q;
      });
    },
    async saveQuoteDraft(input) {
      return run('save-quote-draft', input, () => {
        let draft = D.quoteDrafts.find(d => d.id === input.id);
        const fields = { clientId: String(input.clientId || ''), apartmentId: String(input.apartmentId || ''), discount: String(input.discount ?? ''), renovation: !!input.renovation, parking: !!input.parking, reason: string(input.reason), updatedAt: localStamp() };
        if (draft) Object.assign(draft, fields);
        else { draft = { id: 'draft-' + draftSequence++, ...fields }; D.quoteDrafts.unshift(draft); }
        changed(); return draft;
      });
    },
    async deleteQuoteDraft(id) { return run('delete-quote-draft', { id }, () => { D.quoteDrafts = D.quoteDrafts.filter(d => d.id !== id); changed(); }); },
    async saveApprovalReason(id, reason) {
      return run('save-approval-reason', { id, reason }, () => {
        const q = find(D.proposals, id);
        if (q.status !== 'pending') throw new DomainError('По этому запросу уже принято решение.', 'CONFLICT');
        const value = string(reason);
        if (value.length < 10) throw new DomainError('Обоснование должно содержать минимум 10 символов.', 'VALIDATION', 'reason');
        q.reason = value; timeline(q, 'Добавлено обоснование скидки'); changed(); return q;
      });
    },
    async decideProposal(id, decision, reason) {
      return run('decide-proposal', { id, decision, reason }, () => {
        const q = find(D.proposals, id), a = find(D.apartments, q.apartmentId);
        if (D.actor.role !== 'lead' || q.createdBy === D.actor.id) throw new DomainError('Решение принимает другой сотрудник с ролью руководителя.', 'FORBIDDEN');
        if (q.status !== 'pending') throw new DomainError('Запрос уже обработан.', 'CONFLICT');
        if (!['approve', 'reject'].includes(decision)) throw new DomainError('Выберите решение.');
        if (a.status !== 'available') throw new DomainError('Квартира больше не доступна. Условия требуют пересмотра.', 'CONFLICT');
        const text = string(reason);
        if (text.length < 10) throw new DomainError('Поясните решение: минимум 10 символов.', 'VALIDATION', 'reason');
        q.status = decision === 'approve' ? 'ready' : 'rejected';
        q.approval = { status: decision, by: D.actor.name, comment: text, at: localStamp() };
        timeline(q, decision === 'approve' ? 'Руководитель одобрил индивидуальную скидку' : 'Руководитель отклонил скидку');
        find(D.clients, q.clientId).stage = decision === 'approve' ? 'КП подготовлено' : 'Уточнение условий';
        changed(); return q;
      });
    },
    async acceptProposal(id) {
      return run('accept-proposal', { id }, () => {
        const q = find(D.proposals, id), a = find(D.apartments, q.apartmentId), p = pFor(a);
        if (q.status !== 'ready') throw new DomainError('Подтвердить можно только готовое предложение.', 'CONFLICT');
        if (q.discount > q.snapshot.limit && q.approval?.status !== 'approve') throw new DomainError('Сначала согласуйте скидку.', 'FORBIDDEN');
        if (a.status !== 'available') throw new DomainError('Квартира уже в резерве. Выберите другую.', 'CONFLICT');
        q.status = 'accepted'; a.status = 'reserved'; a.reservedBy = q.clientId; p.available = Math.max(0, p.available - 1);
        find(D.clients, q.clientId).stage = 'Бронирование';
        timeline(q, 'Клиент подтвердил условия · квартира в резерве');
        D.proposals.filter(other => other.id !== q.id && other.apartmentId === a.id && ['ready', 'pending'].includes(other.status)).forEach(other => { other.status = 'unavailable'; timeline(other, 'Квартира забронирована по другому предложению'); });
        changed(); return q;
      });
    },
    async saveClient(input) {
      return run('save-client', input, () => {
        const name = string(input.name, 100), contact = string(input.contact, 150), phone = string(input.phone, 40);
        if (name.length < 3) throw new DomainError('Укажите имя и фамилию клиента.', 'VALIDATION', 'name');
        if (!contact && !phone) throw new DomainError('Добавьте email или телефон.', 'VALIDATION', 'contact');
        if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new DomainError('Проверьте email.', 'VALIDATION', 'contact');
        if (phone && phone.replace(/\D/g, '').length < 10) throw new DomainError('В номере телефона должно быть минимум 10 цифр.', 'VALIDATION', 'phone');
        const budget = Number(input.budget);
        if (!Number.isFinite(budget) || budget < 1000000 || budget > 100000000) throw new DomainError('Бюджет — от 1 до 100 млн ₽.', 'VALIDATION', 'budget');
        find(D.projects, input.projectId, 'Выберите жилой комплекс.');
        const rooms = Number(input.rooms);
        if (![1, 2, 3].includes(rooms)) throw new DomainError('Выберите количество комнат.', 'VALIDATION', 'rooms');
        if (contact && D.clients.some(c => c.id !== input.id && c.contact.toLowerCase() === contact.toLowerCase())) throw new DomainError('Клиент с таким email уже есть в списке.', 'DUPLICATE', 'contact');
        let c = input.id ? find(D.clients, input.id) : null;
        const fields = { name, contact, phone, budget: amount(budget), rooms, projectId: input.projectId, note: string(input.note), interest: `${rooms}-комн. · до ${(budget / 1000000).toLocaleString('ru-RU')} млн ₽`, initials: name.split(/\s+/).slice(0, 2).map(w => Array.from(w)[0]).join('') };
        if (c) Object.assign(c, fields);
        else { c = { id: 'c' + clientSequence++, color: 'sage', stage: 'Новый клиент', last: 'Контакта ещё не было', createdAt: asOf.slice(0, 10), objection: '', advice: '', ...fields }; D.clients.push(c); }
        changed(); return c;
      });
    },
    async prepareNotification(projectId, clientId) {
      return run('prepare-notification', { projectId, clientId }, () => {
        const p = find(D.projects, projectId), c = find(D.clients, clientId);
        if (c.projectId !== p.id || p.risk !== 'risk') throw new DomainError('Для этого клиента нет такого изменения прогноза.', 'CONFLICT');
        let draft = D.drafts.find(d => d.projectId === p.id && d.clientId === c.id);
        if (!draft) {
          draft = { id: 'notification-' + c.id + '-' + p.id, projectId: p.id, clientId: c.id, status: 'draft', text: `${c.name.split(' ')[0]}, здравствуйте! Хотим заранее сообщить об изменении прогноза по ЖК «${p.name}». ${p.reason} Договорный срок: ${p.planned}. Уточняем график и сообщим о подтверждённых изменениях.`, updatedAt: localStamp() };
          D.drafts.push(draft); changed();
        }
        return draft;
      });
    },
    async saveNotification(input) {
      return run('save-notification', input, () => {
        const d = find(D.drafts, input.id), text = string(input.text, 3000);
        if (text.length < 20) throw new DomainError('Сообщение должно содержать минимум 20 символов.', 'VALIDATION', 'text');
        d.text = text; d.status = input.reviewed ? 'reviewed' : 'draft'; d.updatedAt = localStamp(); changed(); return d;
      });
    },
    async analyzeDialogue(text, clientId) { return run('analyze-dialogue', { text, clientId }, () => analyzeTranscript(text, clientId)); }
  };
})();