/* Dialog flows, validation feedback and explicit demo actions. */
(() => {
  'use strict';
  const A = window.Dsk;
  const { D, API, Domain, $, icon, motion, esc, dec, money, date, project, client, apartment, proposal, state, scoped, cost, tag, qTag, avatar, btn, kv, empty, source, panels, actions, submissions, inputs, toast, render, openPanel, closePanel, paintPanel, currentPanel, navigate, formValues } = A;
  const apartmentArt = rooms => ({ 1: './apartment-one-room-glass-v1.webp', 2: './apartment-two-room-glass-v1.webp', 3: './apartment-three-room-glass-v1.webp' }[rooms] || './apartment-two-room-glass-v1.webp');
  const caption = text => `<p class="dialog-caption">${text}</p>`;
  const risk = (title, text, green = false) => `<div class="risk-note ${green ? 'green' : ''}">${icon(green ? 'circleCheck' : 'alert')}<div><strong>${title}</strong><p>${text}</p></div></div>`;
  const footer = body => `<div class="dialog-actions">${body}</div>`;
  const required = id => `data-id="${esc(id)}"`;
  const submit = (text, glyph = 'check', cls = 'primary', value = '') => `<button type="submit" class="button ui-button ${cls}" ${value ? `name="decision" value="${value}"` : ''}>${icon(glyph)}<span>${text}</span></button>`;
  const field = (label, id, content, hint = '') => `<div class="field"><label for="${id}">${label}</label>${content}${hint ? `<small>${hint}</small>` : ''}</div>`;
  const clientHead = c => `<div class="client-detail-head">${avatar(c)}<div><h3>${esc(c.name)}</h3><p>${esc(c.contact || c.phone)}</p></div></div>`;
  function quoteValues() {
    const form = $('#proposal-form');
    return { ...formValues(form), renovation: form.elements.renovation.checked, parking: form.elements.parking.checked };
  }
  function quotePreview() {
    const form = $('#proposal-form'); if (!form) return;
    const q = quoteValues(), a = apartment(q.apartmentId), c = client(q.clientId), p = project(a?.projectId);
    const box = $('#quote-preview'), button = $('#quote-submit');
    if (!a || !p || !c) { box.innerHTML = caption('Выберите клиента и квартиру.'); button.disabled = true; return; }
    let v;
    try { v = Domain.quote(q); }
    catch (e) { box.innerHTML = risk('Проверьте скидку', esc(e.message)); button.disabled = true; return; }
    const over = v.percentage > p.limit;
    const reason = $('#quote-reason');
    $('#reason-field').hidden = !over; reason.required = over; reason.disabled = !over;
    const budgetOver = v.total > c.budget;
    box.innerHTML = `<div class="quote-property"><span class="building-thumb ${p.color}">${icon('building')}</span><div><strong>${esc(p.name)}</strong><p>№${a.number} · ${a.rooms}-комн. · ${dec(a.area)} м²</p></div></div><div class="quote-summary">${kv('Стоимость квартиры', money(v.base))}${kv('Скидка ' + dec(v.percentage) + '%', '− ' + money(v.discount))}${q.renovation ? kv('Чистовая отделка', '+ ' + money(v.renovation)) : ''}${q.parking ? kv('Машиноместо', '+ ' + money(v.parking)) : ''}<div class="quote-total"><span>Итоговая стоимость</span><strong>${money(v.total)}</strong></div>${caption('Скидка применяется только к квартире.')}</div><div class="model-check ${over ? 'over' : ''}">${icon(over ? 'shield' : 'circleCheck')}<div><strong>${over ? 'Требуется согласование' : 'В пределах финансовой модели'}</strong><span>Лимит ${p.limit}% · модель ${D.model.version}</span></div></div>${kv('Договорный срок', p.planned)}${kv('Прогноз ключей', p.forecast)}${p.risk === 'risk' ? risk('Прогноз изменился', 'Поставка ЖБИ задержана. Причина и новый прогноз будут указаны в КП.') : ''}${budgetOver ? risk('Выше бюджета клиента', `На ${money(v.total - c.budget)}. Уточните бюджет или подберите другой вариант.`) : ''}${a.status !== 'available' ? risk('Квартира недоступна', 'Этот вариант уже в резерве. Выберите другую квартиру.') : ''}`;
    button.disabled = a.status !== 'available';
    button.innerHTML = icon(over ? 'shield' : 'file') + `<span>${over ? 'Запросить согласование' : 'Сформировать КП'}</span>`;
    $('#discount-hint').textContent = `Без согласования — до ${p.limit}%. Допустимый ввод: 0–15%, шаг 0,1%.`;
    const current = String(v.total);
    if (box.dataset.lastTotal !== current) { motion.text($('.quote-total strong', box), 0, true); box.dataset.lastTotal = current; }
  }
  panels.quote = data => {
    const saved = data.initial || D.quoteDrafts.find(d => d.id === data.draftId);
    const c = client(saved?.clientId || data.clientId) || D.clients[0];
    const candidates = Domain.matchesFor(c.id);
    const chosen = apartment(saved?.apartmentId || data.apartmentId) || candidates[0]?.apartment;
    if (!chosen) return { title: 'Новое предложение', body: empty('Свободных квартир нет.', 'Подбор станет доступен после обновления остатков.', btn('close', 'Вернуться')) };
    const q = { clientId: c.id, apartmentId: chosen.id, discount: Math.min(3, project(chosen.projectId).limit), renovation: false, parking: false, reason: '', ...saved };
    const options = D.apartments.filter(a => a.status === 'available' || a.id === q.apartmentId);
    return { title: data.draftId ? 'Продолжить предложение' : 'Новое предложение', wide: true, body: `<form id="proposal-form"><div class="quote-layout"><div class="quote-fields"><div class="form-section-title"><span>01</span><h3>Клиент и квартира</h3></div>${field('Клиент', 'quote-client', `<select name="clientId" id="quote-client">${D.clients.map(x => `<option value="${x.id}" ${x.id === q.clientId ? 'selected' : ''}>${esc(x.name)} · ${esc(x.interest)}</option>`).join('')}</select>`)}${field('Квартира', 'quote-apartment', `<select name="apartmentId" id="quote-apartment">${options.map(a => `<option value="${a.id}" ${a.id === q.apartmentId ? 'selected' : ''}>${a.status !== 'available' ? 'В резерве · ' : ''}${esc(project(a.projectId).name)} · №${a.number} · ${dec(a.area)} м²</option>`).join('')}</select>`)}<p class="subtle-hint">Подбор учитывает интерес и бюджет. Вы можете выбрать другой объект.</p><div class="form-section-title"><span>02</span><h3>Индивидуальные условия</h3></div>${field('Скидка, %', 'quote-discount', `<input type="number" id="quote-discount" name="discount" min="0" max="15" step="0.1" value="${esc(q.discount)}" required><small id="discount-hint"></small>`)}<label class="checkbox-line"><input class="toggle-control" type="checkbox" role="switch" name="renovation" ${q.renovation ? 'checked' : ''}><span><strong>Чистовая отделка</strong><small>18 000 ₽/м²</small></span></label><label class="checkbox-line"><input class="toggle-control" type="checkbox" role="switch" name="parking" ${q.parking ? 'checked' : ''}><span><strong>Машиноместо</strong><small>900 000 ₽</small></span></label><div class="field" id="reason-field" hidden><label for="quote-reason">Обоснование индивидуальной скидки</label><textarea id="quote-reason" name="reason" minlength="10" maxlength="2000" placeholder="Почему для этой сделки нужны особые условия?">${esc(q.reason || '')}</textarea><small>Будет приложено к запросу руководителю. Минимум 10 символов.</small></div></div><aside class="quote-review"><div class="form-section-title"><span>03</span><h3>Проверьте расчёт</h3></div><div id="quote-preview" aria-live="polite"></div></aside></div><div class="quote-form-footer"><span class="save-indicator">Изменения сохранятся в черновик при закрытии</span>${btn('close', 'Сохранить и закрыть')}${submit('Сформировать КП', 'file').replace('<button ', '<button id="quote-submit" ')}</div>${caption('Демо-среда: данные и черновики доступны до перезагрузки страницы.')}</form>`, init() { const form = $('#proposal-form'); quotePreview(); form.dataset.baseline = JSON.stringify(quoteValues()); data.requestKey ||= globalThis.crypto?.randomUUID?.() || 'request-' + Date.now() + '-' + Math.random(); } };
  };
  panels.drafts = () => ({ title: 'Черновики предложений', body: D.quoteDrafts.length ? `<div class="draft-list">${D.quoteDrafts.map(d => `<div class="draft-item"><span class="draft-symbol">${icon('edit')}</span><div><strong>${esc(client(d.clientId)?.name || 'Клиент не выбран')}</strong><p>${esc(project(apartment(d.apartmentId)?.projectId)?.name || 'Квартира не выбрана')} · ${d.discount === '' ? 'скидка не указана' : 'скидка ' + esc(d.discount) + '%'}</p></div>${btn('resume-draft', 'Продолжить', 'arrow', 'small', required(d.id))}<button class="icon-button" data-action="delete-draft" data-id="${d.id}" aria-label="Удалить черновик для ${esc(client(d.clientId)?.name)}">${icon('x')}</button></div>`).join('')}</div>${caption('Черновики сохраняются в текущем сеансе. Перезагрузка страницы сбросит демо-данные.')}` : empty('Черновиков пока нет.', 'Незавершённое предложение сохранится при закрытии окна.', btn('new-proposal', 'Создать КП', 'plus', 'primary')) });
  panels.client = ({ id }) => {
    const c = client(id); if (!c) return { title: 'Клиент недоступен', body: empty('Клиент не найден.', 'Обновите данные.') };
    const p = project(c.projectId), matches = Domain.matchesFor(id, { onlyFits: true }).slice(0, 2);
    return { title: 'Карточка клиента', body: clientHead(c) + tag(c.stage, 'blue') + `<div class="detail-block">${kv('Интерес', esc(c.interest))}${kv('Бюджет', money(c.budget))}${kv('Жилой комплекс', esc(p.name))}${kv('Последний контакт', esc(c.last))}</div><div class="detail-block"><h3>Что важно клиенту</h3><p>${esc(c.note || 'Пожелания пока не добавлены.')}</p></div>${p.risk === 'risk' ? risk('Обсудите изменение прогноза', `Прогноз ключей: ${p.forecast}. Договорный срок: ${p.planned}.`) : ''}<div class="detail-block"><h3>Варианты в рамках бюджета</h3>${matches.map(m => `<button class="match-row" data-action="new-proposal" data-client="${id}" data-apartment="${m.apartment.id}"><span>${icon('home')}</span><span><strong>${esc(m.project.name)} · №${m.apartment.number}</strong><small>${m.apartment.rooms}-комн. · ${dec(m.apartment.area)} м² · скидка ${m.discount}%</small></span><span><strong>${money(m.total)}</strong>${icon('arrow')}</span></button>`).join('') || caption('В текущей выборке нет свободной квартиры нужной комнатности в бюджете. Уточните пожелания или рассмотрите другие объекты.')}</div>` + footer(btn('edit-client', 'Редактировать', 'edit', '', required(id)) + btn('analysis', 'Разобрать диалог', 'sparkles', '', required(id)) + btn('new-proposal', 'Создать КП', 'plus', 'primary', `data-client="${id}"`)) };
  };
  panels.clientForm = ({ id }) => {
    const c = client(id), cacheKey = 'client-' + (id || 'new'), cached = state.formCache.get(cacheKey);
    const values = { name: '', contact: '', phone: '', budget: 10000000, rooms: 2, projectId: state.project === 'all' ? 'p1' : state.project, note: '', ...c, ...cached };
    values.rooms ||= Number(c?.interest.match(/\d+/)?.[0]) || 2;
    return { title: c ? 'Редактировать клиента' : 'Новый клиент', body: `<form id="client-form" data-cache="${cacheKey}" data-id="${id || ''}">${field('Имя и фамилия', 'client-name', `<input id="client-name" name="name" value="${esc(values.name)}" minlength="3" maxlength="100" autocomplete="name" required>`)}<div class="form-grid">${field('Email', 'client-email', `<input id="client-email" name="contact" type="email" value="${esc(values.contact)}" maxlength="150" autocomplete="email">`)}${field('Телефон', 'client-phone', `<input id="client-phone" name="phone" type="tel" value="${esc(values.phone)}" maxlength="40" autocomplete="tel">`)}</div>${caption('Укажите хотя бы один способ связи.')}<div class="form-grid">${field('Бюджет, ₽', 'client-budget', `<input type="number" id="client-budget" name="budget" value="${esc(values.budget)}" min="1000000" max="100000000" step="1000" required>`)}${field('Количество комнат', 'client-rooms', `<select id="client-rooms" name="rooms">${[1, 2, 3].map(n => `<option value="${n}" ${Number(values.rooms) === n ? 'selected' : ''}>${n}-комнатная</option>`).join('')}</select>`)}</div>${field('Интересующий объект', 'client-project', `<select id="client-project" name="projectId">${D.projects.map(p => `<option value="${p.id}" ${values.projectId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`)}${field('Пожелания и контекст', 'client-note', `<textarea id="client-note" name="note" maxlength="2000">${esc(values.note)}</textarea>`)}${footer(btn('close', 'Закрыть') + submit('Сохранить клиента'))}${caption('Демо-данные сохраняются до перезагрузки страницы.')}</form>` };
  };
  panels.apartment = ({ id }) => {
    const a = apartment(id), p = project(a.projectId), clientMode = D.actor.role === 'client';
    const details = `${kv(clientMode ? 'Стоимость квартиры' : 'Базовая стоимость', money(a.price))}${clientMode ? '' : kv('Стоимость за м²', money(p.price))}${kv('Этаж', a.floor + ' из ' + a.floors)}${kv('Договорный срок', p.planned)}${kv('Прогноз ключей', p.forecast)}${kv('Готовность корпуса', p.progress + '%')}${clientMode ? '' : kv('Лимит скидки', p.limit + '%')}`;
    const controls = clientMode ? btn('open-client-chat', 'Задать вопрос', 'message', 'primary') : btn('project', 'График строительства', 'building', '', required(p.id)) + (a.status === 'available' ? btn('new-proposal', 'Создать предложение', 'plus', 'primary', `data-apartment="${id}"`) : '');
    return { title: `Квартира №${a.number}`, body: `<div class="property-visual"><img src="${apartmentArt(a.rooms)}" alt="" width="1268" height="793"><div class="property-visual-shade"></div><span class="property-visual-number">№ ${String(a.number).padStart(3, '0')}</span>${tag(a.status === 'available' ? 'Свободна' : 'В резерве', a.status === 'available' ? 'green' : 'orange', true)}</div><div class="property-title"><span class="building-thumb ${p.color}">${icon('home')}</span><div><h3>${a.rooms}-комнатная · ${dec(a.area)} м²</h3><p>${esc(p.name)} · ${p.building}</p></div></div><div class="detail-block">${details}</div>${p.risk === 'risk' ? risk('Есть риск изменения срока', esc(p.reason)) : risk('По графику', esc(p.reason), true)}${a.status === 'reserved' ? caption(clientMode ? 'Квартира находится в резерве.' : 'Квартира в резерве у ' + esc(client(a.reservedBy)?.name || 'другого клиента') + '. Новое КП на неё создать нельзя.') : ''}${footer(controls)}` };
  };
  panels.project = ({ id }) => {
    const p = project(id), targets = D.clients.filter(c => c.projectId === id), clientMode = D.actor.role === 'client';
    const staffDetails = clientMode ? '' : kv('Материалы на площадке', esc(p.stock)) + kv('Свободных квартир в ERP', p.available);
    const affectedClients = !clientMode && p.risk === 'risk' ? `<div class="detail-block"><h3>Клиенты, которых касается изменение</h3>${targets.map(c => `<div class="recipient-row"><span class="client-cell">${avatar(c)}<strong>${esc(c.name)}</strong></span>${btn('notification', 'Уведомление', 'message', 'small', `data-id="${id}" data-client="${c.id}"`)}</div>`).join('') || caption('В текущей выборке клиентов по этому объекту нет.')}</div>` : '';
    const controls = clientMode ? btn('open-client-chat', 'Уточнить у помощника', 'message', 'primary') : btn('project-apartments', 'Подобрать квартиру', 'arrow', 'primary', required(id));
    return { title: esc(p.name) + ' · ' + p.building, body: tag(p.risk === 'risk' ? 'Есть риск изменения срока' : 'Строительство по графику', p.risk === 'risk' ? 'orange' : 'green', true) + caption(esc(p.address) + (clientMode ? '' : ' · Срез ERP: 5 сентября, 10:42')) + `<div class="detail-block">${kv('Договорный срок', p.planned)}${kv('Прогноз ключей', p.forecast)}${staffDetails}</div><div class="detail-block"><h3>Готовность по этапам</h3>${p.tasks.map(([t, n]) => `<div class="objection-row"><div class="objection-label"><span>${esc(t)}</span><strong>${n}%</strong></div><div class="progress-track ${p.risk}"><span style="width:${n}%"></span></div></div>`).join('')}</div>${risk(p.risk === 'risk' ? 'Причина изменения прогноза' : 'Строительный контроль', esc(p.reason), p.risk !== 'risk')}${affectedClients}${footer(controls)}` };
  };
  panels.document = ({ id, doc }) => {
    const p = project(id);
    if (!p) return { title: 'Документ недоступен', body: empty('Объект не найден.', 'Обновите данные.') };
    const common = `<div class="document-cover ${p.color}"><span class="document-cover-icon">${icon(doc === 'schedule' ? 'calendar' : doc === 'materials' ? 'database' : p.risk === 'risk' ? 'alert' : 'documentCheck')}</span><div><span class="section-kicker">${esc(p.name)} · ${esc(p.building)}</span><h3>${doc === 'schedule' ? 'График работ' : doc === 'materials' ? 'Материалы и поставки' : 'Изменения проекта'}</h3><p>Срез ERP · 5 сентября, 10:42</p></div></div>`;
    let body = '';
    if (doc === 'schedule') {
      body = `<div class="detail-block"><h3>Готовность по этапам</h3>${p.tasks.map(([title, value]) => `<div class="objection-row"><div class="objection-label"><span>${esc(title)}</span><strong>${value}%</strong></div><div class="progress-track ${p.risk}"><span style="width:${value}%"></span></div></div>`).join('')}</div>${kv('Общая готовность', p.progress + '%')}${kv('Договорный срок', p.planned)}${kv('Текущий прогноз', p.forecast)}`;
    } else if (doc === 'materials') {
      body = `<div class="document-metric"><span>Материалы в наличии</span><strong>${p.materials}<small>%</small></strong><div class="progress-track ${p.risk}"><span style="width:${p.materials}%"></span></div></div><div class="detail-block">${kv('Остаток на площадке', esc(p.stock))}${kv('Текущий этап', esc(p.stage))}${kv('Статус поставок', p.risk === 'risk' ? 'Требует внимания' : 'По графику')}</div>${risk(p.risk === 'risk' ? 'Зафиксирована задержка' : 'Поставки подтверждены', esc(p.reason), p.risk !== 'risk')}`;
    } else {
      body = p.risk === 'risk' ? `${risk('Изменение влияет на прогноз', esc(p.reason))}<div class="detail-block">${kv('Договорный срок', p.planned)}${kv('Обновлённый прогноз', p.forecast)}${kv('Статус документа', 'Зарегистрировано')}</div>` : `${risk('Новых изменений нет', 'Планировки, договорный срок и конфигурация квартир в текущем срезе не менялись.', true)}<div class="detail-block">${kv('Договорный срок', p.planned)}${kv('Текущий прогноз', p.forecast)}${kv('Статус документа', 'Актуально')}</div>`;
    }
    return { title: 'Документ объекта', body: common + body + `<div class="source-list">${source('ERP · строительство')}${source(doc === 'materials' ? 'Снабжение' : 'Проектная документация')}</div>` + footer(btn('project', 'Открыть карточку объекта', 'building', 'primary', required(id))) };
  };
  panels.proposal = ({ id, created = false }) => {
    const q = proposal(id), clientMode = D.actor.role === 'client';
    if (clientMode && q?.clientId !== D.actor.clientId) return { title: 'Документ недоступен', body: empty('Это предложение относится к другому обращению.', 'Вернитесь в личный кабинет.', btn('open-client-cabinet', 'В кабинет', 'home', 'primary')) };
    const a = apartment(q.apartmentId), c = client(q.clientId), p = project(a.projectId), v = cost(q), s = q.snapshot;
    const controls = [];
    if (!clientMode && q.status === 'pending') controls.push(btn('approval', 'Открыть согласование', 'shield', '', required(id)));
    if (!clientMode && ['rejected', 'unavailable'].includes(q.status)) controls.push(btn('revise-proposal', 'Новый расчёт', 'edit', 'primary', required(id)));
    if (['ready', 'pending', 'accepted'].includes(q.status)) controls.push(btn('download-proposal', q.status === 'pending' ? 'Скачать предварительное КП' : 'Скачать КП', 'download', '', required(id)));
    if (!clientMode && q.status === 'ready') controls.push(btn('confirm-reservation', 'Клиент согласен', 'check', 'primary', required(id)));
    if (clientMode) controls.push(btn('open-client-chat', 'Задать вопрос', 'message', 'primary'));
    const history = clientMode ? '' : `<details class="history-details"><summary>История предложения <span>${q.history.length}</span></summary>${q.history.map(h => `<div class="history-event"><span>${icon('check')}</span><div><strong>${esc(h.label)}</strong><small>${esc(h.actor)} · ${date(h.at)}</small></div></div>`).join('')}</details>`;
    const note = clientMode ? 'Документ сформирован по текущим условиям вашего обращения.' : 'КП выгружается в HTML. Для PDF откройте файл и выберите печать. Условия зафиксированы по модели ' + s.version + ' на момент создания.';
    return { title: created ? 'Предложение подготовлено' : q.id, body: `${created ? `<div class="success-panel"><div class="proposal-success-art"><img src="./proposal-orange-house-v1.webp" width="900" height="900" alt=""><canvas data-matrix="proposal" data-matrix-once aria-hidden="true"></canvas></div><span class="success-symbol">${icon(q.status === 'pending' ? 'shield' : 'circleCheck')}</span><h3>${q.status === 'pending' ? 'Запрос отправлен в очередь.' : 'Можно переходить к разговору.'}</h3><p>${q.status === 'pending' ? 'Индивидуальную скидку подтвердит руководитель в демо-сценарии.' : 'Стоимость проверена по финансовой модели.'}</p></div>` : ''}${qTag(q)}<div class="detail-block">${kv('Клиент', esc(c.name))}${kv('Объект', esc(p.name) + ' · ' + p.building)}${kv('Квартира', `№${a.number} · ${a.rooms}-комн. · ${dec(a.area)} м²`)}${kv('Договорный срок', s.planned)}${kv('Прогноз в предложении', s.forecast)}</div><div class="quote-summary">${kv('Стоимость квартиры', money(v.base))}${kv('Скидка ' + dec(q.discount) + '%', '− ' + money(v.discount))}${kv('Отделка', q.renovation ? money(v.renovation) : 'Не включена')}${kv('Машиноместо', q.parking ? money(v.parking) : 'Не включено')}<div class="quote-total"><span>Итоговая стоимость</span><strong>${money(v.total)}</strong></div></div>${q.status === 'pending' ? risk('Предварительные условия', `Скидка ${dec(q.discount)}% превышает лимит ${s.limit}%. До решения руководителя условия не подтверждены.`) : ''}${q.approval && !clientMode ? `<div class="decision-note ${q.approval.status === 'approve' ? 'approved' : ''}"><strong>${q.approval.status === 'approve' ? 'Одобрено' : 'Отклонено'} · ${esc(q.approval.by)}</strong><p>${esc(q.approval.comment)}</p></div>` : ''}${q.status === 'unavailable' ? risk('Нужна другая квартира', 'Этот вариант забронирован по другому предложению. Старое КП не подтверждает доступность квартиры.') : ''}${s.risk === 'risk' ? risk('Риск изменения срока', esc(s.reason)) : ''}${history}${footer(controls.join(''))}${caption(note)}` };
  };
  panels.approval = ({ id }) => {
    const q = proposal(id), v = cost(q);
    if (q.status !== 'pending') return panels.proposal({ id });
    const reviewer = D.actor.role === 'lead' && D.actor.id !== q.createdBy;
    const reasonCache = state.formCache.get('approval-' + id)?.reason ?? q.reason ?? '';
    return { title: 'Согласование · ' + q.id, body: tag('Ожидает решения', 'orange') + `<div class="detail-block">${kv('Клиент', esc(client(q.clientId).name))}${kv('Запрошенная скидка', dec(q.discount) + '% · ' + money(v.discount))}${kv('Допустимый лимит', q.snapshot.limit + '%')}${kv('Сумма сверх лимита', money(v.base * (q.discount - q.snapshot.limit) / 100))}${kv('Итог с допуслугами', money(v.total))}</div>${reviewer ? `<div class="approval-explainer"><h3>Обоснование менеджера</h3><p>${esc(q.reason || 'Обоснование ещё не добавлено. Уточните условия у менеджера перед решением.')}</p></div><form id="decision-form" data-id="${id}">${field('Комментарий к решению', 'decision-reason', '<textarea id="decision-reason" name="reason" minlength="10" maxlength="2000" required placeholder="Зафиксируйте причину одобрения или отказа"></textarea>')}${footer(submit('Отклонить', 'x', 'danger', 'reject') + submit('Одобрить скидку', 'check', 'primary', 'approve'))}${caption('Демо-решение применяется только к этому предложению; лимит финансовой модели не меняется.')}</form>` : `<form id="approval-form" data-id="${id}" data-cache="approval-${id}">${field('Обоснование для руководителя', 'approval-reason', `<textarea id="approval-reason" name="reason" minlength="10" maxlength="2000" required placeholder="Опишите условия сделки и причину исключения">${esc(reasonCache)}</textarea>`)}<div class="info-strip">${icon('shield')}<span>Решение принимает руководитель. Проверить этот этап можно, сменив демо-роль в профиле.</span></div>${footer(btn('profile', 'Демо-роль', 'users') + submit('Сохранить обоснование'))}</form>`}` };
  };
  panels.reservation = ({ id }) => {
    const q = proposal(id), a = apartment(q.apartmentId);
    return { title: 'Подтвердить согласие клиента?', body: `<div class="reservation-check"><span class="success-symbol">${icon('home')}</span><h3>Квартира №${a.number}</h3><p>${esc(project(a.projectId).name)} · ${esc(client(q.clientId).name)}</p><strong>${money(cost(q).total)}</strong></div><p class="body-copy">В демо-сценарии предложение перейдёт в резерв. Квартира станет недоступна для новых КП, а другие открытые предложения на неё потребуют пересмотра.</p><form id="reservation-form" data-id="${id}">${footer(btn('panel-back', 'Вернуться к условиям') + submit('Подтвердить резерв', 'check'))}</form>` };
  };
  panels.notification = ({ id }) => {
    const d = D.drafts.find(x => x.id === id), c = client(d.clientId), p = project(d.projectId);
    const cached = state.formCache.get('notification-' + id);
    return { title: 'Уведомление об изменении прогноза', body: clientHead(c) + tag(d.status === 'reviewed' ? 'Текст проверен' : 'Черновик', d.status === 'reviewed' ? 'green' : 'blue') + `<div class="detail-block">${kv('Жилой комплекс', esc(p.name))}${kv('Договорный срок', p.planned)}${kv('Новый прогноз', p.forecast)}</div><form id="notification-form" data-id="${id}" data-cache="notification-${id}">${field('Текст для клиента', 'notification-text', `<textarea id="notification-text" name="text" minlength="20" maxlength="3000" required class="message-editor">${esc(cached?.text ?? d.text)}</textarea>`)}<label class="checkbox-filter review-checkbox"><input type="checkbox" name="reviewed" ${d.status === 'reviewed' ? 'checked' : ''}>Я проверил текст и актуальность прогноза</label><div class="info-strip">${icon('info')}<span>Демо-среда готовит черновик. Отправка клиенту не подключена.</span></div>${footer(btn('copy-notification', 'Скопировать', 'copy') + submit('Сохранить текст'))}</form>${caption('После проверки задача подготовки исчезнет из приоритетов. Статус не означает отправку сообщения.')}` };
  };
  panels.notifications = () => ({ title: 'Центр внимания', body: `<div class="notification-scope">${source(state.project === 'all' ? 'Все объекты' : project(state.project).name)}</div><div class="priority-list">${A.viewHelpers.priorityList()}</div>${D.drafts.filter(d => scoped(d.projectId)).length ? `<div class="detail-block"><h3>Подготовленные уведомления</h3>${D.drafts.filter(d => scoped(d.projectId)).map(d => `<button class="search-result" data-action="open-notification" data-id="${d.id}">${icon('message')}<span><strong>${esc(client(d.clientId).name)}</strong><small>${esc(project(d.projectId).name)}</small></span>${tag(d.status === 'reviewed' ? 'Проверено' : 'Черновик', d.status === 'reviewed' ? 'green' : 'blue')}</button>`).join('')}</div>` : ''}` });
  function findingsHTML(result) {
    return `<div class="analysis-result"><div class="analysis-result-heading"><span class="ai-emblem">${icon('sparkles')}</span><div><h3>${result.findings.length ? 'Контекст стал яснее.' : 'Нужно больше контекста.'}</h3><p>Локальный анализ по заданным признакам</p></div></div>${result.findings.map((f, i) => `<article class="finding"><div class="finding-title"><span>${String(i + 1).padStart(2, '0')}</span><h3>${esc(f.title)}</h3></div><blockquote>«${esc(f.evidence)}»</blockquote><p>${esc(f.recommendation)}</p>${source(f.source)}</article>`).join('')}<div class="next-step">${icon('arrow')}<p>${esc(result.next)}</p></div></div>`;
  }
  panels.analysis = ({ id, result }) => {
    const c = client(id), saved = state.formCache.get('analysis-' + id);
    return { title: 'Разбор диалога', wide: true, body: clientHead(c) + `<div class="analysis-layout"><form id="analysis-form" data-id="${id}" data-cache="analysis-${id}"><div class="form-section-title"><span>01</span><h3>Контекст разговора</h3></div>${field('Фрагмент диалога', 'analysis-text', `<textarea id="analysis-text" name="transcript" class="transcript-editor" minlength="20" maxlength="6000" required placeholder="Вставьте фрагмент разговора менеджера с клиентом…">${esc(saved?.transcript ?? c.objection ?? '')}</textarea>`, 'От 20 до 6 000 символов. Текст не отправляется внешнему AI-сервису в демо-режиме.')}<div class="analysis-context">${kv('Бюджет клиента', money(c.budget))}${kv('Объект', esc(project(c.projectId).name))}${kv('Прогноз ключей', project(c.projectId).forecast)}</div>${submit('Проанализировать', 'sparkles')}<p class="dialog-caption">Разбор ищет признаки тем, а не определяет намерения человека. Подтверждайте выводы в разговоре.</p></form><div id="analysis-result" aria-live="polite">${result ? findingsHTML(result) : `<div class="analysis-placeholder"><span class="large-ai">${icon('sparkles')}</span><h3>Результат анализа</h3><p>Система выделит вопросы о цене, сроках, планировке и оплате и свяжет рекомендации с контекстом клиента.</p><div class="source-list">${source('ERP')}${source('Финмодель')}${source('Карточка клиента')}</div></div>`}</div></div>${footer(btn('client', 'Карточка клиента', 'users', '', required(id)) + btn('new-proposal', 'Подготовить КП', 'plus', 'primary', `data-client="${id}"`))}` };
  };
  function answerFor(question, clientId, surface = 'dialog') {
    const q = question.toLocaleLowerCase('ru').trim();
    const clientMode = D.actor.role === 'client';
    const named = D.clients.find(c => q.includes(c.name.split(' ').at(-1).toLowerCase().slice(0, 5)));
    const c = clientMode ? client(D.actor.clientId) : named || client(clientId);
    const scopeProjects = D.projects.filter(p => c ? p.id === c.projectId : scoped(p.id));
    const sources = [];
    let title, body;
    if (clientMode && c && /сегодня|вниман|приоритет|начат|важн|статус|обращен/iu.test(q)) {
      const p = project(c.projectId);
      title = 'Следующий шаг по вашему обращению.';
      body = `<p><strong>${esc(c.stage)}.</strong> Ваш интерес: ${esc(c.interest)}.</p><p><strong>${esc(p.name)}:</strong> готовность ${p.progress}%, прогноз передачи ключей — ${p.forecast}.</p><p>Помощник может подобрать свободные варианты или уточнить данные по срокам.</p>`;
      sources.push('Карточка обращения', 'Ход строительства');
    } else if (clientMode && c && /скид|цен|стоим|бюджет|дешев/iu.test(q) && !/подоб|квартир.*до/iu.test(q)) {
      title = 'Условия проверит менеджер.';
      body = `<p>Ваш ориентир — ${money(c.budget)}. Итоговая стоимость зависит от квартиры и выбранных услуг.</p><p>Я покажу подходящие варианты, а индивидуальные условия менеджер подтвердит в коммерческом предложении.</p>`;
      sources.push('Карточка обращения', 'Актуальные предложения');
    } else if (/сегодня|вниман|приоритет|начат|важн/iu.test(q)) {
      const a = Domain.attention(c?.projectId || state.project);
      title = a.total ? 'Начните с того, что влияет на сделку.' : 'Открытых задач нет.';
      body = `<p>Запросов на скидку: <strong>${a.pending.length}</strong>. Объектов с риском: <strong>${a.risks.length}</strong>. Уведомлений к подготовке: <strong>${a.unnotified.length}</strong>.</p>${a.risks.map(p => `<p><strong>${esc(p.name)}:</strong> прогноз — ${p.forecast}. ${esc(p.reason)}</p>`).join('')}`;
      sources.push('ERP · 5 сентября, 10:42', 'Очередь согласований');
    } else if (/скид|цен|стоим|бюджет|дешев/iu.test(q) && !/подоб|квартир.*до/iu.test(q)) {
      title = 'Гибкость зависит от финансовой модели.';
      body = scopeProjects.map(p => `<p><strong>${esc(p.name)} — до ${p.limit}%</strong> без согласования. Превышение отправляется руководителю.</p>`).join('') + '<p>Скидка применяется к квартире. Отделка — 18 000 ₽/м², машиноместо — 900 000 ₽.</p>';
      sources.push('Финансовая модель ' + D.model.version);
    } else if (/срок|строй|строител|ключ|задерж|готовн|постав/iu.test(q)) {
      title = 'Разделяем договор и текущий прогноз.';
      body = scopeProjects.map(p => `<p><strong>${esc(p.name)} · ${p.progress}% готовности.</strong><br>Договор: ${p.planned}. Прогноз ключей: ${p.forecast}.<br>${esc(p.reason)}</p>`).join('');
      sources.push('ERP · строительный контроль', 'План поставок ЖБИ');
    } else if (/подоб|квартир|вариант/iu.test(q)) {
      const budgetMatch = q.match(/до\s*(\d+(?:[.,]\d+)?)\s*млн/u);
      const budget = budgetMatch ? Number(budgetMatch[1].replace(',', '.')) * 1000000 : c?.budget;
      const matches = c ? Domain.matchesFor(c.id, { onlyFits: true }) : D.apartments.filter(a => a.status === 'available' && scoped(a.projectId)).map(a => { const p = project(a.projectId), discount = Math.min(3, p.limit); return { apartment: a, project: p, discount, total: Domain.quote({ apartmentId: a.id, discount }).total }; });
      const selected = matches.filter(m => !budget || m.total <= budget).slice(0, 3);
      title = selected.length ? (c ? 'Варианты для ' + esc(c.name) : 'Свободные варианты в выборке.') : 'Подходящего варианта пока нет.';
      body = selected.map(m => `<div class="ai-match"><strong>${esc(m.project.name)} · №${m.apartment.number}</strong><p>${m.apartment.rooms}-комн. · ${dec(m.apartment.area)} м² · ${money(m.total)} со скидкой ${m.discount}%</p>${clientMode ? btn('apartment', 'Посмотреть квартиру', 'arrow', 'subtle', `data-id="${m.apartment.id}"`) : btn('new-proposal', 'Подготовить КП', 'arrow', 'subtle', `data-apartment="${m.apartment.id}" ${c ? `data-client="${c.id}"` : ''}`)}</div>`).join('') || '<p>Уточните бюджет, комнатность или рассмотрите другой объект.</p>';
      if (!c) body += '<p>Выберите клиента, чтобы учесть его комнатность, бюджет и пожелания.</p>';
      sources.push('Остатки квартир', 'Финмодель ' + D.model.version);
    } else if (clientMode && /диалог|возраж|разговор/iu.test(q)) {
      title = 'Опишите вопрос своими словами.';
      body = '<p>Спросите о квартире, стоимости или сроках передачи ключей. Если вопрос требует решения сотрудника, помощник предложит связаться с менеджером.</p>';
      sources.push('Карточка обращения');
    } else if (/диалог|возраж|разговор/iu.test(q)) {
      title = 'Начнём с реальной фразы клиента.';
      body = '<p>Выберите клиента и вставьте фрагмент диалога. Разбор покажет найденную тему, подтверждающий фрагмент и рекомендацию с источником.</p>' + btn('analysis', 'Разобрать диалог', 'sparkles', '', required(c?.id || D.clients[0].id));
      sources.push('Сценарный анализ');
    } else {
      title = 'Для точного ответа нужен контекст.';
      const action = surface === 'cabinet' ? 'client-cabinet-quick' : surface === 'drawer' ? 'assistant-panel-quick' : 'ai';
      body = (clientMode ? '<p>Если помощник не отвечает на ваш вопрос, откройте <a href="#support">Поддержку</a>.</p>' : '') + '<p>В демо-среде доступны вопросы о скидках, сроках, подборе квартир и приоритетах. Свободный AI-диалог пока не подключён.</p><div class="suggestion-chips">' + ['Какие лимиты скидок?', 'Что сегодня требует внимания?', 'Какие сроки передачи ключей?'].map(t => btn(action, t, '', 'small', `data-question="${esc(t)}"`)).join('') + '</div>';
    }
    return `<div class="ai-answer"><h3>${title}</h3>${body}<div class="source-list">${sources.map(source).join('')}</div></div>`;
  }
  A.answerFor = answerFor;
  panels.ai = ({ question = '', clientId = '' }) => ({ title: 'ДСК Intelligence', wide: false, body: `<form id="ai-form"><label class="context-select">Контекст<select name="clientId" aria-label="Контекст клиента"><option value="">Весь отдел</option>${D.clients.map(c => `<option value="${c.id}" ${clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><div class="ai-question-line">${icon('message')}<input name="question" aria-label="Вопрос ассистенту" value="${esc(question)}" placeholder="Спросите о следующем шаге…" maxlength="500" required><button type="submit" aria-label="Задать вопрос">${icon('arrow')}</button></div></form><div id="ai-result" aria-live="polite">${question ? answerFor(question, clientId) : ''}</div>${caption('Ответы опираются на текущие демо-данные и заданные сценарии. Они не являются ответами подключённой языковой модели.')}` });
  panels.search = () => ({ title: 'Найти в пространстве', body: `<div class="global-search-field">${icon('search')}<input id="global-search" type="search" placeholder="Клиент, квартира, объект или КП" aria-label="Поиск" aria-controls="search-results" autocomplete="off"><kbd>ESC</kbd></div><p class="search-tip">↑ ↓ — перемещение · Enter — открыть</p><div id="search-results" class="search-results" aria-live="polite"></div>`, init() { searchResults(''); $('#global-search').focus(); } });
  function searchResults(query) {
    const needle = query.trim().toLocaleLowerCase('ru'), rows = [];
    D.clients.filter(c => `${c.name} ${c.contact} ${c.phone}`.toLocaleLowerCase('ru').includes(needle)).forEach(c => rows.push(`<button class="search-result" data-action="client" data-id="${c.id}">${avatar(c)}<span><strong>${esc(c.name)}</strong><small>${esc(c.interest)}</small></span>${tag('Клиент')}</button>`));
    D.projects.filter(p => p.name.toLocaleLowerCase('ru').includes(needle)).forEach(p => rows.push(`<button class="search-result" data-action="project" data-id="${p.id}">${icon('building')}<span><strong>${esc(p.name)}</strong><small>${p.building} · ${p.progress}% готовности</small></span>${tag('Объект')}</button>`));
    if (needle) {
      D.apartments.filter(a => `${a.number} квартира ${project(a.projectId).name}`.toLocaleLowerCase('ru').includes(needle)).forEach(a => rows.push(`<button class="search-result" data-action="apartment" data-id="${a.id}">${icon('home')}<span><strong>Квартира №${a.number} · ${esc(project(a.projectId).name)}</strong><small>${a.rooms}-комн. · ${money(a.price)}</small></span>${tag(a.status === 'available' ? 'Свободна' : 'Резерв', a.status === 'available' ? 'green' : 'orange')}</button>`));
      D.proposals.filter(q => `${q.id} ${client(q.clientId).name}`.toLocaleLowerCase('ru').includes(needle)).forEach(q => rows.push(`<button class="search-result" data-action="proposal" data-id="${q.id}">${icon('file')}<span><strong>${q.id} · ${esc(client(q.clientId).name)}</strong><small>${money(cost(q).total)}</small></span>${qTag(q)}</button>`));
    }
    $('#search-results').innerHTML = rows.slice(0, 15).join('') || empty('Ничего не найдено.', 'Попробуйте фамилию, номер квартиры или название комплекса.');
  }
  panels.profile = () => {
    const labels = { manager: 'Менеджер', lead: 'Руководитель', client: 'Клиент' };
    const glyphs = { manager: 'users', lead: 'shield', client: 'message' };
    const footerAction = D.actor.role === 'client' ? btn('open-client-cabinet', 'Открыть кабинет', 'home', 'primary') : btn('go-approvals', 'Открыть согласования', 'arrow', 'primary');
    const actorContext = D.actor.role === 'client' ? 'Личный кабинет · демо' : `${D.actor.label} · ГК «ДСК»`;
    return { title: 'Профиль и демо-роль', body: `<div class="client-detail-head"><span class="avatar">${D.actor.initials}</span><div><h3>${D.actor.name}</h3><p>${actorContext}</p></div></div><div class="detail-block"><h3>Выберите участника сценария</h3><p>Менеджер готовит предложение, руководитель принимает решение, клиент видит только своё обращение и общается с помощником.</p></div><div class="role-options">${Object.entries(Domain.actors).map(([role, actor]) => `<button class="role-option ${D.actor.role === role ? 'selected' : ''}" data-action="set-role" data-role="${role}" aria-pressed="${D.actor.role === role}"><span class="role-icon">${icon(glyphs[role])}</span><span><strong>${labels[role]}</strong><small>${actor.name}</small></span>${D.actor.role === role ? icon('check') : icon('arrow')}</button>`).join('')}</div>${caption('Это симуляция ролей в демо-интерфейсе. Реальные права назначает сервер авторизации.')}${footer(btn('logout', 'Выйти из демо', 'back') + footerAction)}` };
  };
  panels.settings = () => ({ title: 'Настройки пространства', body: `<section class="detail-block first"><h3>Движение интерфейса</h3><p>Плавное появление текста и мягкая реакция кнопок. Иконки остаются статичными. Системная настройка уменьшения движения имеет приоритет.</p><div class="motion-options" role="group" aria-label="Анимации"><button class="chip ${motion.preference !== 'off' ? 'active' : ''}" data-action="motion-preference" data-value="system" aria-pressed="${motion.preference !== 'off'}">Плавные анимации</button><button class="chip ${motion.preference === 'off' ? 'active' : ''}" data-action="motion-preference" data-value="off" aria-pressed="${motion.preference === 'off'}">Без движения</button></div>${motion.systemReduced ? caption('В вашей системе включено уменьшение движения. Анимации отключены.') : btn('preview-motion', 'Посмотреть эффект', 'play', 'subtle')}<div class="motion-preview"><h3 id="motion-preview-text">Заголовок раздела</h3></div></section><div class="detail-block"><h3>Источники и модель</h3><div class="connection-table">${kv('ERP · строительство и материалы', tag('Демо-срез', 'blue'))}${kv('CRM · клиенты и КП', tag('Демо-срез', 'blue'))}${kv('Финансовая модель', tag(D.model.version, 'green'))}${kv('AI-анализ диалогов', tag('Сценарный', 'purple'))}${kv('Банки и конкуренты', tag('Не подключены'))}</div></div><div class="detail-block"><h3>Лимиты скидок</h3>${D.projects.map(p => kv(esc(p.name), p.limit + '%')).join('')}</div>${caption('Все бизнес-данные хранятся в памяти до перезагрузки. Настройка анимаций сохраняется только на этом устройстве.')}` });
  panels.help = () => ({ title: 'От клиента до резерва', body: [['01', 'Уточните пожелания', 'Добавьте клиента, бюджет, комнатность и контекст. В карточке появятся подходящие свободные варианты.'], ['02', 'Рассчитайте предложение', 'Выберите квартиру и услуги. Проверка покажет итог, бюджет, лимит скидки и прогноз. Изменения сохранятся в черновик при закрытии.'], ['03', 'Согласуйте исключение', 'Для скидки выше лимита добавьте обоснование. В профиле переключитесь на демо-руководителя, примите решение и вернитесь в роль менеджера.'], ['04', 'Зафиксируйте результат', 'В готовом КП нажмите «Клиент согласен», чтобы проверить резерв. Выгрузите HTML и сохраните в PDF через печать браузера.'], ['05', 'Обсудите изменения', 'Откройте риск строительства, подготовьте и проверьте текст уведомления. Реальные сообщения из демо-среды не отправляются.']].map(([n, t, p]) => `<div class="insight"><span class="insight-number">${n}</span><div><h3>${t}</h3><p>${p}</p></div></div>`).join('') + caption('Ctrl K / ⌘ K — поиск. Escape — закрыть окно. В мобильном меню и диалогах доступна навигация с клавиатуры. Перезагрузка сбрасывает демо-сеанс.') });
  panels.chart = () => {
    const r = Domain.report(state.period, state.project);
    return { title: 'Продажи · точные значения', wide: true, body: caption(r.label + ' · ' + (state.project === 'all' ? 'Все объекты' : project(state.project).name)) + A.viewHelpers.chart(true) + `<div class="table-scroll"><table><thead><tr><th>Период</th><th>Продажи</th><th>Аналогичный период</th></tr></thead><tbody>${r.labels.map((t, i) => `<tr><td>${t}</td><td>${money(r.current[i])}</td><td>${money(r.previous[i])}</td></tr>`).join('')}</tbody><tfoot><tr><th>Всего</th><th>${money(r.total)}</th><th>${money(r.before)}</th></tr></tfoot></table></div>${caption('Демо-сводка ERP по заключённым договорам. Новый резерв квартиры не считается заключённым договором. Сравниваются одинаковые части периодов.')}${footer(btn('export-sales', 'Выгрузить CSV', 'download', 'primary'))}` };
  };
  panels.deleteDraft = ({ id }) => ({ title: 'Удалить черновик?', body: `<p class="body-copy">Удалится только незавершённый расчёт. Клиент и квартира останутся в списках.</p><form id="delete-draft-form" data-id="${esc(id)}">${footer(btn('panel-back', 'Сохранить черновик') + submit('Удалить', 'x', 'danger'))}</form>` });
  Object.assign(actions, {
    'new-proposal': el => openPanel('quote', { clientId: el.dataset.client, apartmentId: el.dataset.apartment }),
    client: el => openPanel('client', { id: el.dataset.id }),
    'edit-client': el => openPanel('clientForm', { id: el.dataset.id }),
    apartment: el => {
      const card = el.closest('.apartment-card');
      if (!card) return openPanel('apartment', { id: el.dataset.id });
      const rect = card.getBoundingClientRect();
      return openPanel('apartment', { id: el.dataset.id, sourceRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } });
    },
    project: el => openPanel('project', { id: el.dataset.id }),
    document: el => openPanel('document', { id: el.dataset.id, doc: el.dataset.doc }),
    'dossier-toggle': el => {
      const folder = el.closest('.dossier-folder'), expanded = !folder.classList.contains('is-open');
      folder.classList.toggle('is-open', expanded); el.setAttribute('aria-expanded', String(expanded));
    },
    proposal: el => openPanel('proposal', { id: el.dataset.id }),
    approval: el => openPanel('approval', { id: el.dataset.id }),
    analysis: el => openPanel('analysis', { id: el.dataset.id || D.clients[0].id }),
    ai: el => openPanel('ai', { question: el.dataset.question || 'Что сегодня требует внимания?' }),
    notifications: () => openPanel('notifications'),
    'draft-list': () => openPanel('drafts'),
    'resume-draft': el => openPanel('quote', { draftId: el.dataset.id }),
    'delete-draft': el => openPanel('deleteDraft', { id: el.dataset.id }),
    'confirm-reservation': el => openPanel('reservation', { id: el.dataset.id }),
    profile: () => openPanel('profile'), settings: () => openPanel('settings'), help: () => openPanel('help'), search: () => openPanel('search'),
    'chart-details': () => openPanel('chart'),
    'go-approvals': () => navigate('approvals'),
    'project-apartments': el => navigate('apartments', { project: el.dataset.id, rooms: 'all', budget: '', availability: 'available' }),
    'open-notification': el => openPanel('notification', { id: el.dataset.id }),
    notification: async el => { const d = await API.prepareNotification(el.dataset.id, el.dataset.client); render('quiet'); await openPanel('notification', { id: d.id }); },
    'set-role': async el => {
      A.setAssistantPanel(false, { focus: false, restoreFocus: false });
      document.querySelectorAll('#assistant-chat-log .assistant-message:not(.assistant-message-system)').forEach(el => el.remove());
      await API.setDemoRole(el.dataset.role);
      if (D.actor.role === 'client') {
        A.setAssistantPanel(false, { focus: false, restoreFocus: false });
        await navigate('cabinet');
      } else if (['cabinet', 'my-offers', 'support'].includes(state.page)) await navigate('overview');
      else { render('quiet'); paintPanel(); }
      toast('Демо-роль: ' + D.actor.label);
    },
    'open-client-cabinet': async () => {
      await navigate('cabinet');
    },
    'open-client-chat': async () => {
      await closePanel({ force: true });
      A.setAssistantPanel(true);
    },
    'client-cabinet-quick': el => {
      const input = $('#client-cabinet-input');
      input.value = el.dataset.question || '';
      $('#client-cabinet-form').requestSubmit();
    },
    'motion-preference': el => {
      const root = el.closest('.motion-options'), previous = window.DskControls.capture(A.dialog);
      motion.setPreference(el.dataset.value);
      root.querySelectorAll('button').forEach(button => {
        const active = button.dataset.value === motion.preference;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      window.DskControls.mount(A.dialog, previous, true);
    },
    'preview-motion': () => { $('#motion-preview-text').innerHTML = 'На шаг <em>впереди.</em>'; delete $('#motion-preview-text').dataset.revealPrepared; motion.text($('#motion-preview-text')); },
    'copy-notification': async () => {
      const field = $('#notification-text');
      try { await navigator.clipboard.writeText(field.value); toast('Текст скопирован. Сообщение не отправлено.'); }
      catch { field.focus(); field.select(); toast('Текст выделен. Нажмите Ctrl C или ⌘ C.'); }
    },
    'revise-proposal': el => { const q = proposal(el.dataset.id), a = apartment(q.apartmentId); return openPanel('quote', { clientId: q.clientId, apartmentId: a.status === 'available' ? a.id : undefined, initial: a.status === 'available' ? { ...q, discount: Math.min(q.discount, project(a.projectId).limit), reason: '' } : undefined }); },
    'download-proposal': el => { window.DskExports.proposal(el.dataset.id); toast('КП выгружено в HTML. PDF доступен через печать.'); },
    report: () => { const records = state.page === 'proposals' ? A.viewHelpers.filteredProposals() : D.proposals.filter(q => scoped(apartment(q.apartmentId).projectId)); window.DskExports.proposals(records); toast('Предложения выгружены в CSV с текущими фильтрами.'); },
    'export-sales': () => { window.DskExports.sales(Domain.report(state.period, state.project)); toast('Данные графика выгружены в CSV.'); }
  });
  actions['matrix-signal'] = el => {
    const section = el.closest('.matrix-insights');
    section.dataset.matrixTone = el.dataset.tone;
    section.querySelectorAll('[data-action="matrix-signal"]').forEach(button => button.setAttribute('aria-pressed', String(button === el)));
    section.querySelectorAll('.matrix-signal').forEach((panel,i) => { panel.hidden = i !== Number(el.dataset.index); });
    window.DskMatrix?.sync();
  };
  Object.assign(submissions, {
    'proposal-form': async form => {
      const panel = currentPanel(), values = quoteValues();
      const pending = document.createElement('div');
      pending.className = 'proposal-generating'; pending.setAttribute('role', 'status');
      pending.innerHTML = '<span class="proposal-loading-ring" aria-hidden="true"></span><span>Формируем предложение…</span>';
      form.prepend(pending); form.setAttribute('aria-busy', 'true');
      try {
        const q = await API.createProposal({ ...values, draftId: panel.data.draftId, requestKey: panel.data.requestKey });
        form.dataset.submitted = 'true'; render('filter'); state.stack = [];
        await openPanel('proposal', { id: q.id, created: true });
      } finally { pending.remove(); form.removeAttribute('aria-busy'); }
    },
    'client-form': async form => {
      const c = await API.saveClient({ ...formValues(form), id: form.dataset.id || undefined });
      state.formCache.delete(form.dataset.cache); form.removeAttribute('data-cache');
      render('quiet'); await openPanel('client', { id: c.id }, true); toast('Карточка клиента сохранена.');
    },
    'approval-form': async form => {
      const q = await API.saveApprovalReason(form.dataset.id, form.elements.reason.value);
      state.formCache.delete(form.dataset.cache); form.removeAttribute('data-cache');
      render('quiet'); await openPanel('proposal', { id: q.id }, true); toast('Обоснование приложено к запросу.');
    },
    'decision-form': async (form, submitter) => {
      const q = await API.decideProposal(form.dataset.id, submitter.value, form.elements.reason.value);
      render('filter'); await openPanel('proposal', { id: q.id }, true); toast(q.status === 'ready' ? 'Скидка одобрена. КП готово.' : 'Скидка отклонена. Причина сохранена.');
    },
    'reservation-form': async form => {
      const q = await API.acceptProposal(form.dataset.id);
      render('filter'); await openPanel('proposal', { id: q.id }, true); toast('Квартира в резерве за клиентом.');
    },
    'notification-form': async form => {
      const d = await API.saveNotification({ id: form.dataset.id, text: form.elements.text.value, reviewed: form.elements.reviewed.checked });
      state.formCache.delete(form.dataset.cache); form.removeAttribute('data-cache');
      render('quiet'); await openPanel('notification', { id: d.id }, true); toast(d.status === 'reviewed' ? 'Текст проверен и готов. Отправка не выполнялась.' : 'Черновик уведомления сохранён.');
    },
    'analysis-form': async form => {
      const value = form.elements.transcript.value;
      const result = await API.analyzeDialogue(value, form.dataset.id);
      state.formCache.set(form.dataset.cache, { transcript: value });
      currentPanel().data.result = result;
      $('#analysis-result').innerHTML = findingsHTML(result);
      motion.animate($('#analysis-result'), [{ opacity: 0, filter: 'blur(5px)', transform: 'translateY(5px)' }, { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' }], { duration: 500 });
    },
    'assistant-form': async form => { const question = form.elements.question.value.trim(); if (!question) throw new Error('Введите вопрос.'); await openPanel('ai', { question }); },
    'ai-form': async form => {
      const question = form.elements.question.value.trim();
      if (!question) throw new Error('Введите вопрос.');
      currentPanel().data = { question, clientId: form.elements.clientId.value };
      $('#ai-result').innerHTML = answerFor(question, form.elements.clientId.value);
      motion.text($('#ai-result h3'), 0, true);
    },
    'client-cabinet-form': async form => {
      const question = form.elements.question.value.trim();
      if (!question) throw new Error('Введите вопрос.');
      const c = client(D.actor.clientId);
      const log = $('#client-cabinet-chat-log');
      const userMessage = document.createElement('div');
      userMessage.className = 'client-chat-message user';
      userMessage.innerHTML = `<span>Вы · ${esc(D.actor.name)}</span><p>${esc(question)}</p>`;
      const assistantMessage = document.createElement('div');
      assistantMessage.className = 'client-chat-message answer';
      assistantMessage.innerHTML = `<span>Помощник</span>${answerFor(question, c?.id || '', 'cabinet')}`;
      log.append(userMessage, assistantMessage);
      log.scrollTop = log.scrollHeight;
      form.reset();
      form.elements.question.focus({ preventScroll: true });
    },
    'delete-draft-form': async form => { await API.deleteQuoteDraft(form.dataset.id); render('quiet'); state.stack = []; await openPanel('drafts'); toast('Черновик удалён.'); }
  });
  inputs.quote = quotePreview;
  inputs['global-search'] = el => searchResults(el.value);
  inputs.keydown = e => {
    if (!A.dialog.open || currentPanel()?.kind !== 'search') return;
    const results = [...A.dialog.querySelectorAll('.search-result')];
    const index = results.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); results[Math.min(index + 1, results.length - 1)].focus(); }
    if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); if (index <= 0) $('#global-search').focus(); else results[index - 1].focus(); }
    if (e.key === 'Enter' && document.activeElement === $('#global-search') && results.length) { e.preventDefault(); results[0].click(); }
  };
})();
