/* Role-specific navigation surfaces. All accounts and transactions remain demo data. */
(() => {
  'use strict';
  const A = window.Dsk;
  const { D, API, Domain, state, views, panels, actions, submissions, $, esc, money, dec, date, project, client, apartment, cost, btn, kv, tag, empty, navigate, openPanel, closePanel, render, toast } = A;
  const ownClient = () => client(D.actor.clientId);
  const ownOffers = () => D.proposals.filter(q => q.clientId === D.actor.clientId);
  const heading = (title, description) => `<section class="page-heading"><div><h1>${title}</h1><p>${description}</p></div></section>`;
  const clientLogs = new Map();
  const currentLog = () => { if (!clientLogs.has(D.actor.id)) clientLogs.set(D.actor.id, []); return clientLogs.get(D.actor.id); };
  const chatMessages = () => currentLog().map(m => `<div class="client-chat-message user"><span>Вы</span><p>${esc(m.question)}</p></div><div class="client-chat-message answer"><span>Помощник</span>${A.answerFor(m.question, D.actor.clientId, 'cabinet')}</div>`).join('');
  A.mountClientChat = () => {
    const log = $('#client-cabinet-chat-log');
    if (!log || D.actor.role !== 'client') return;
    log.innerHTML = `<div class="client-chat-message answer"><span>Помощник</span><p>Здравствуйте, ${esc(ownClient().name.split(' ')[0])}. Помогу подобрать квартиру, проверить стоимость и сроки передачи ключей.</p></div>` + chatMessages();
    log.scrollTop = log.scrollHeight;
  };
  const chat = () => `<section class="client-cabinet-chat client-home-chat" aria-labelledby="client-chat-title"><header><div><h2 id="client-chat-title">Помощник по продажам</h2><p>Квартиры, стоимость и сроки — по вашему обращению</p></div><a href="#support" class="text-link">Нужна помощь?</a></header><div class="client-cabinet-chat-log" id="client-cabinet-chat-log" role="log" aria-live="polite" aria-relevant="additions"></div><div class="client-cabinet-quick"><button type="button" data-action="client-cabinet-quick" data-question="Покажи подходящие квартиры">Подобрать квартиру</button><button type="button" data-action="client-cabinet-quick" data-question="Какие сроки передачи ключей?">Сроки ключей</button><button type="button" data-action="client-cabinet-quick" data-question="Что со статусом моего обращения?">Моё обращение</button></div><form id="client-cabinet-form" class="client-cabinet-composer"><label class="sr-only" for="client-cabinet-input">Ваш вопрос</label><textarea id="client-cabinet-input" name="question" rows="2" maxlength="500" placeholder="Напишите вопрос…" required></textarea><button type="submit">Отправить</button></form><p>Демо-помощник отвечает по заданным сценариям. История доступна до перезагрузки.</p></section>`;
  views.cabinet = () => {
    if (!ownClient()) return heading('Главная', 'Выберите роль клиента в профиле.');
    const c = ownClient();
    const items = D.apartments.filter(a => a.status === 'available').sort((a,b) => Number(b.projectId === c.projectId) - Number(a.projectId === c.projectId)).slice(0,3);
    const objects = D.projects.map(p => `<button class="client-object" data-action="project" data-id="${p.id}"><span><strong>${esc(p.name)}</strong><small>${esc(p.building)} · ${esc(p.stage)}</small></span><span class="client-object-progress"><strong>${p.progress}%</strong><span class="progress-track"><span style="width:${p.progress}%"></span></span></span><span><strong>${esc(p.forecast)}</strong><small>${p.risk === 'risk' ? 'Есть риск изменения срока' : 'По графику'}</small></span></button>`).join('');
    return heading('Главная', `${esc(c.name)}, здесь можно выбрать квартиру и уточнить детали покупки.`) + `<div class="client-home-grid">${chat()}<section class="client-cabinet-card client-objects"><h2>Состояние объектов</h2>${objects}<a class="button" href="#my-offers">Мои предложения · ${ownOffers().length}</a></section></div><section class="client-catalog-preview"><div class="section-heading"><h2>Квартиры</h2><a class="button" href="#apartments">Весь каталог</a></div><div class="catalog-grid">${A.viewHelpers.apartmentCards(items)}</div></section>`;
  };
  views['my-offers'] = () => {
    const offers = ownOffers();
    const labels = {ready:'Предложение готово',pending:'Условия согласовываются',accepted:'Квартира в резерве',rejected:'Нужно уточнить условия',unavailable:'Вариант недоступен'};
    return heading('Мои предложения', 'Все расчёты и оформляемые сделки по вашему обращению.') + `<div class="personal-offer-grid">${offers.map(q => { const a = apartment(q.apartmentId), p=project(a.projectId); return `<article class="client-cabinet-card personal-offer"><header><strong>${esc(q.id)}</strong>${tag(labels[q.status] || q.status)}</header><h2>${esc(p.name)} · №${a.number}</h2><p>${a.rooms}-комнатная · ${dec(a.area)} м² · этаж ${a.floor}</p><div class="personal-offer-total">${money(cost(q).total)}</div>${kv('Дата расчёта',date(q.date))}${kv('Прогноз ключей',q.snapshot.forecast)}${btn('proposal','Посмотреть условия','','',`data-id="${q.id}"`)}</article>`; }).join('') || empty('Предложений пока нет', 'Выберите квартиру и нажмите «В предложение».', '<a class="button" href="#apartments">Открыть каталог</a>')}</div>`;
  };
  function contacts(kind, title, description) {
    const contact = window.DSK_CONFIG.contacts?.[kind] || {};
    const phone = typeof contact.phone === 'string' && /^[+\d ()-]{7,30}$/.test(contact.phone) ? contact.phone : '';
    const email = typeof contact.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? contact.email : '';
    return `<article class="client-cabinet-card support-contact"><h2>${title}</h2><p>${description}</p>${phone ? `<a href="tel:${phone.replace(/[^+\d]/g,'')}">${esc(phone)}</a>` : '<p>Телефон пока не указан</p>'}${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '<p>Email пока не указан</p>'}<small>${phone || email ? 'Контакты службы' : 'Контакты будут добавлены перед запуском сервиса.'}</small></article>`;
  }
  views.support = () => heading('Поддержка','Если помощник не отвечает или возникла ошибка, помощь доступна здесь.') + `<div class="support-grid">${contacts('sales','Отдел продаж','Подбор квартиры, просмотр, условия и документы.')}${contacts('technical','Техническая поддержка','Ошибки чата, загрузка страниц и работа приложения.')}</div><div class="support-grid"><section class="client-cabinet-card support-guide"><h2>Если чат не работает</h2><ol><li>Проверьте подключение к интернету.</li><li>Скопируйте незавершённый вопрос и попробуйте отправить его ещё раз.</li><li>Опишите ошибку в форме. Перезагрузка страницы сбросит демо-сеанс и историю.</li></ol><a href="#cabinet" class="button">Вернуться к помощнику</a></section><section class="client-cabinet-card"><h2>Подготовить обращение</h2><form id="support-form"><label class="field">Тема<select name="topic"><option>Ошибка чат-бота</option><option>Ошибка на странице</option><option>Вопрос по покупке</option></select></label><label class="field">Описание<textarea name="description" minlength="10" maxlength="3000" required placeholder="Что вы делали и что произошло?"></textarea></label><button type="submit" class="button">Скачать обращение</button><p class="support-note">Сохранится текстовый файл. Автоматическая отправка в поддержку пока не подключена.</p></form></section></div>`;
  submissions['support-form'] = async form => {
    const description = form.elements.description.value.trim();
    if (description.length < 10) throw new Error('Опишите проблему подробнее — не менее 10 символов.');
    const content = `Обращение в поддержку ДСК\nТема: ${form.elements.topic.value}\nКлиент: ${ownClient().name}\nДата: ${new Date().toISOString()}\n\n${description}\n`;
    const url = URL.createObjectURL(new Blob([content], {type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a'); link.href=url; link.download='dsk-support.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000);
    toast('Обращение сохранено в файл. Оно не отправлено.');
  };
  panels.clientInquiry = ({ id }) => {
    const a=apartment(id);
    if (!a || a.status !== 'available') return {title:'Квартира недоступна',body:'Этот вариант уже в резерве. Выберите другой в каталоге.'};
    return {title:'Ваше предложение',body:`<h3>${esc(project(a.projectId).name)} · квартира №${a.number}</h3>${kv('Площадь',dec(a.area)+' м²')}${kv('Стоимость без скидки',money(a.price))}<p>Сохраним расчёт в «Моих предложениях». Квартира останется свободной до подтверждения резерва менеджером.</p><form id="client-inquiry-form" data-id="${a.id}"><button type="submit" class="button">Сформировать предложение</button></form>`};
  };
  actions['client-inquiry'] = el => openPanel('clientInquiry',{id:el.dataset.apartment});
  submissions['client-inquiry-form'] = async form => {
    const a=apartment(form.dataset.id);
    if (D.actor.role !== 'client' || !a) throw new Error('Выберите квартиру в клиентском каталоге.');
    const existing=ownOffers().find(q=>q.apartmentId===a.id && ['ready','pending','accepted'].includes(q.status));
    if (!existing) await API.createProposal({clientId:D.actor.clientId, apartmentId:a.id, discount:0, renovation:false, parking:false});
    await closePanel({force:true}); await navigate('my-offers'); toast(existing ? 'Предложение уже есть в вашем списке.' : 'Предложение добавлено. Резерв ещё не оформлен.');
  };
  submissions['client-cabinet-form'] = async form => {
    const question=form.elements.question.value.trim();
    if (!question) throw new Error('Введите вопрос.');
    // Compute first so failures never consume the user's input or add a broken message.
    A.answerFor(question,D.actor.clientId,'cabinet');
    currentLog().push({question}); A.mountClientChat(); form.reset(); form.elements.question.focus({preventScroll:true});
  };
  actions['open-client-chat'] = async () => {
    await closePanel({force:true});
    if (D.actor.role === 'client') { await navigate('cabinet'); $('#client-cabinet-input')?.focus(); $('#client-chat-title')?.scrollIntoView({block:'nearest'}); }
    else A.setAssistantPanel(true);
  };
})();
