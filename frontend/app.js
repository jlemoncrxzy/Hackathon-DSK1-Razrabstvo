/* Application shell and controller. Views and panels are plain template functions. */
(() => {
  'use strict';
  const D = window.DSK_DATA, API = window.DskAPI, Domain = window.DskDomain;
  const $ = (selector, root = document) => root.querySelector(selector);
  const main = $('#main'), dialog = $('#dialog'), authScreen = $('#auth-screen'), sidebar = $('#sidebar'), app = $('.app');
  const assistantPanel = $('#assistant-panel'), assistantPanelTrigger = $('#assistant-panel-trigger'), assistantPanelScrim = $('#assistant-panel-scrim');
  const icon = window.DskIcons.render, motion = window.DskMotion, controls = window.DskControls;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = value => Math.round(value).toLocaleString('ru-RU');
  const dec = value => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const money = value => num(value) + ' ₽';
  const date = value => new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const project = id => D.projects.find(x => x.id === id);
  const client = id => D.clients.find(x => x.id === id);
  const apartment = id => D.apartments.find(x => x.id === id);
  const proposal = id => D.proposals.find(x => x.id === id);
  const titles = { overview: 'Обзор', cabinet: 'Главная', 'my-offers': 'Мои предложения', support: 'Поддержка', clients: 'Клиенты', apartments: 'Квартиры', proposals: 'Предложения', construction: 'Строительство', analytics: 'Демонстрационный раздел', approvals: 'Согласования' };
  const statuses = { ready: ['КП готово', 'blue'], pending: ['На согласовании', 'orange'], accepted: ['В резерве', 'green'], rejected: ['Скидка отклонена', 'red'], unavailable: ['Квартира недоступна', 'gray'] };
  const state = { page: 'overview', period: 'month', project: 'all', search: '', rooms: 'all', availability: 'all', budget: '', sort: 'recommended', status: 'all', stack: [], returnFocus: null, busy: false, ready: false, authenticated: false, formCache: new Map(), menuOpen: false };
  const clientPages = ['cabinet', 'apartments', 'my-offers', 'support'];
  const rolePage = page => D.actor.role === 'client' ? (clientPages.includes(page) ? page : 'cabinet') : (['cabinet', 'my-offers', 'support'].includes(page) ? 'overview' : page);
  const AUTH_KEY = 'dsk-demo-authenticated';
  const scoped = id => state.project === 'all' || state.project === id;
  const cost = q => Domain.quote(q, q.snapshot);
  const tag = (text, color = 'gray', dot = false) => `<span class="badge ${color}">${dot ? '<i></i>' : ''}${esc(text)}</span>`;
  const qTag = q => tag(q.approval?.status === 'approve' && q.status === 'ready' ? 'Скидка согласована' : statuses[q.status]?.[0] || 'Неизвестный статус', statuses[q.status]?.[1], true);
  const avatar = c => `<span class="avatar ${esc(c.color || '')}">${esc(c.initials)}</span>`;
  const btn = (action, text, glyph = '', cls = '', attrs = '') => `<button type="button" class="button ui-button ${cls}${glyph === 'plus' ? ' button-add' : ''}" data-action="${action}" ${attrs}>${glyph ? icon(glyph) : ''}<span>${text}</span></button>`;
  const kv = (label, value) => `<div class="key-value"><span>${label}</span><strong>${value}</strong></div>`;
  const empty = (title, description, action = '') => `<div class="empty-state"><span class="empty-icon">${icon('search')}</span><h3>${title}</h3><p>${description}</p>${action}</div>`;
  const source = text => `<span class="source-tag">${icon('database')}${esc(text)}</span>`;
  const reset = () => btn('reset-filters', 'Сбросить фильтры', 'refresh', 'subtle');
  const currentPanel = () => state.stack.at(-1);
  const formValues = form => Object.fromEntries(new FormData(form));
  const views = {}, panels = {}, actions = {}, submissions = {}, inputs = {};
  let assistantReturnFocus = null;
  function toast(message, isError = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' error' : '');
    el.innerHTML = icon(isError ? 'alert' : 'check') + `<span>${esc(message)}</span><button aria-label="Закрыть уведомление">${icon('x')}</button>`;
    el.querySelector('button').onclick = () => el.remove();
    $('#toasts').append(el); setTimeout(() => el.remove(), 6500);
  }
  function formError(form, error) {
    let box = $('.form-error', form);
    if (!box) { box = document.createElement('div'); box.className = 'form-error'; box.setAttribute('role', 'alert'); form.prepend(box); }
    box.innerHTML = `${icon('alert')}<span>${esc(error.message || error)}</span>`;
    const field = form.elements?.[error.field];
    if (field?.focus) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    else { box.tabIndex = -1; box.focus(); }
  }
  function updateAuthStats() {
    const stats = document.querySelector('.auth-card-stats');
    if (!stats) return;
    stats.innerHTML =
      `<span><strong>${D.projects.length}</strong> объектов</span>` +
      `<span><strong>${D.apartments.length}</strong> квартир</span>` +
      `<span><strong>${D.clients.length}</strong> клиентов</span>`;
  }
  function updateChrome() {
    const clientMode = D.actor.role === 'client';
    document.querySelectorAll('[data-page]').forEach(a => {
      const active = a.dataset.page === state.page;
      a.classList.toggle('active', active);
      active ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    });
    $('#breadcrumb-current').textContent = titles[state.page];
    $('#approval-count').textContent = D.proposals.filter(q => q.status === 'pending').length;
    $('#client-count').textContent = D.clients.length;
    $('.profile .avatar').textContent = D.actor.initials;
    $('.profile-text strong').textContent = D.actor.name;
    $('.profile-text small').textContent = D.actor.label;
    $('.profile').setAttribute('aria-label', 'Профиль: ' + D.actor.name + ', ' + D.actor.label);
    document.body.dataset.actorRole = D.actor.role;
    document.body.dataset.page = state.page;
    $('#workspace-subtitle').textContent = clientMode ? 'Клиентский кабинет' : 'Отдел продаж';
    $('span', assistantPanelTrigger).textContent = clientMode ? 'Чат с помощником' : 'Помощник';
    $('small', assistantPanelTrigger).textContent = clientMode ? 'Вопрос по квартире' : 'Спросить по сделке';
    $('.assistant-panel-header h2').textContent = clientMode ? 'Ваш помощник' : 'Помощник по продажам';
    $('.assistant-panel-header p').textContent = clientMode ? 'Квартира, стоимость и сроки ключей' : 'Квартиры, клиенты, сроки и скидки';
    $('.assistant-message-system p').textContent = clientMode ? 'Я вижу контекст вашего обращения и помогу проверить квартиру, стоимость или сроки.' : 'Сверю вопрос с текущими данными по строительству, клиентам и финансовой модели.';
    const quickQuestions = clientMode ? [['Статус обращения', 'Что сейчас происходит с моим обращением?'], ['Сроки ключей', 'Какие сроки передачи ключей?'], ['Другие квартиры', 'Покажи подходящие квартиры до 12 млн']] : [['Приоритеты на сегодня', 'Что сегодня требует внимания?'], ['Лимиты скидок', 'Какие лимиты скидок?'], ['Сроки ключей', 'Какие сроки передачи ключей?']];
    document.querySelectorAll('.assistant-quick-questions button').forEach((button, index) => { button.textContent = quickQuestions[index][0]; button.dataset.question = quickQuestions[index][1]; });
    $('#assistant-user-avatar').textContent = D.actor.initials;
    $('#assistant-user-name').textContent = D.actor.name;
    $('#assistant-user-role').textContent = D.actor.label;
    const assistantContext = $('#assistant-panel-client');
    assistantContext.disabled = D.actor.role === 'client';
    if (D.actor.role === 'client' && D.actor.clientId) assistantContext.value = D.actor.clientId;
    const count = Domain.attention().total;
    $('.notification-button').setAttribute('aria-label', `Требуют внимания: ${count}`);
    $('.notification-button i').hidden = count === 0;
    document.title = state.authenticated ? `${titles[state.page]} · ДСК` : 'Вход · ДСК';
  }
  function authRemembered() {
    try { return sessionStorage.getItem(AUTH_KEY) === '1'; }
    catch { return false; }
  }
  function setAuthenticated(active, { remember = true, focus = true } = {}) {
    state.authenticated = Boolean(active);
    if (!state.authenticated) setAssistantPanel(false, { focus: false, restoreFocus: false });
    authScreen.hidden = state.authenticated;
    authScreen.inert = state.authenticated;
    sidebar.inert = !state.authenticated;
    app.inert = !state.authenticated;
    sidebar.setAttribute('aria-hidden', String(!state.authenticated));
    app.setAttribute('aria-hidden', String(!state.authenticated));
    document.body.classList.toggle('auth-locked', !state.authenticated);
    try {
      if (remember) state.authenticated ? sessionStorage.setItem(AUTH_KEY, '1') : sessionStorage.removeItem(AUTH_KEY);
    } catch { /* The demo still works when browser storage is unavailable. */ }
    document.title = state.authenticated ? `${titles[state.page]} · ДСК` : 'Вход · ДСК';
    if (!focus) return;
    requestAnimationFrame(() => (state.authenticated ? main : $('#login-email'))?.focus({ preventScroll: true }));
  }
  function render(mode = 'route') {
    if (!state.ready) return;
    state.page = rolePage(state.page);
    const previous = document.activeElement;
    const selections = controls.capture(main), selectionFocus = controls.focused(main);
    const focusId = previous?.id, start = previous?.selectionStart;
    main.innerHTML = views[state.page]();
    updateChrome();
    window.Dsk.mountClientChat?.();
    main.setAttribute('aria-busy', 'false');
    if (mode !== 'route' && focusId) {
      const target = document.getElementById(focusId);
      target?.focus({ preventScroll: true });
      if (typeof start === 'number' && target?.setSelectionRange) { try { target.setSelectionRange(start, start); } catch { /* Number fields do not expose a selection. */ } }
    }
    controls.mount(main, selections, mode !== 'route');
    if (mode !== 'route') controls.restore(main, selectionFocus);
    motion.run(main, mode); window.DskMatrix?.mount();
  }
  function encodeRoute() {
    const params = new URLSearchParams();
    if (state.project !== 'all') params.set('project', state.project);
    if (state.page === 'overview' && state.period !== 'month') params.set('period', state.period);
    if (['clients', 'proposals'].includes(state.page) && state.search) params.set('q', state.search);
    if (state.page === 'apartments') {
      if (state.rooms !== 'all') params.set('rooms', state.rooms);
      if (state.availability !== 'all') params.set('available', '1');
      if (state.budget) params.set('budget', state.budget);
      if (state.sort !== 'recommended') params.set('sort', state.sort);
    }
    if (state.page === 'proposals' && state.status !== 'all') params.set('status', state.status);
    return '#' + state.page + (params.size ? '?' + params : '');
  }
  function filtersChanged(mode = 'filter') { history.replaceState(null, '', encodeRoute()); render(mode); }
  async function saveCurrentDraft() {
    const form = $('#proposal-form');
    if (form && !form.dataset.submitted) {
      const data = formValues(form), active = currentPanel();
      data.renovation = form.elements.renovation.checked;
      data.parking = form.elements.parking.checked;
      const signature = JSON.stringify(data);
      if (signature !== form.dataset.baseline) {
        const saved = await API.saveQuoteDraft({ ...data, id: active.data.draftId });
        active.data.draftId = saved.id;
        active.data.initial = saved;
        form.dataset.baseline = signature;
        render('quiet');
      }
    }
    const cacheForm = $('[data-cache]', dialog);
    if (cacheForm) state.formCache.set(cacheForm.dataset.cache, formValues(cacheForm));
  }
  async function closePanel({ force = false } = {}) {
    if (!dialog.open) return true;
    if (state.busy && !force) return false;
    try { if (!force) await saveCurrentDraft(); }
    catch (e) { formError($('#proposal-form') || $('.dialog-body'), e); return false; }
    const origin = currentPanel()?.data?.sourceRect;
    if (origin && motion.enabled) {
      const closing = motion.closeDialog(dialog, origin);
      if (closing) await closing.finished.catch(() => {});
    }
    dialog.close(); state.stack = []; document.body.classList.remove('dialog-open');
    if (state.returnFocus?.isConnected) state.returnFocus.focus({ preventScroll: true });
    else main.focus({ preventScroll: true });
    return true;
  }
  function paintPanel() {
    const descriptor = currentPanel();
    const definition = panels[descriptor.kind](descriptor.data);
    $('#dialog-content').innerHTML = `<div class="dialog-header"><div class="dialog-heading">${state.stack.length > 1 ? `<button class="icon-button" data-action="panel-back" aria-label="Назад">${icon('back')}</button>` : ''}<h2 id="dialog-title">${definition.title}</h2></div><button class="icon-button" data-action="close" aria-label="Закрыть окно">${icon('x')}</button></div><div class="dialog-body">${definition.body}</div>`;
    dialog.classList.toggle('wide-dialog', !!definition.wide);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0; document.body.classList.add('dialog-open');
    definition.init?.(); controls.mount(dialog); window.DskMatrix?.mount(); motion.dialog($('#dialog-content'), descriptor.data.sourceRect);
    const title = $('#dialog-title'); title.tabIndex = -1;
    if (descriptor.kind !== 'search') title.focus({ preventScroll: true });
  }
  async function openPanel(kind, data = {}, replace = false) {
    if (!panels[kind]) return;
    if (D.actor.role === 'client' && !['profile','apartment','project','proposal','clientInquiry'].includes(kind)) return;
    try { if (dialog.open && !state.busy) await saveCurrentDraft(); }
    catch (e) { formError($('#proposal-form') || $('.dialog-body'), e); return; }
    if (!dialog.open) { state.stack = []; state.returnFocus = document.activeElement; }
    if (replace) state.stack.pop();
    state.stack.push({ kind, data }); paintPanel();
  }
  async function backPanel() {
    if (state.busy) return;
    try { await saveCurrentDraft(); }
    catch (e) { formError($('#proposal-form') || $('.dialog-body'), e); return; }
    if (state.stack.length < 2) return closePanel();
    state.stack.pop(); paintPanel();
  }
  async function navigate(page, params = {}) {
    if (!Object.hasOwn(titles, page)) return;
    page = rolePage(page);
    if (!await closePanel()) return;
    state.page = page; state.search = ''; state.status = 'all';
    Object.assign(state, params);
    history.pushState(null, '', encodeRoute()); setMenu(false); render();
    window.scrollTo({ top: 0, behavior: 'instant' });
    main.focus({ preventScroll: true }); $('#route-announcement').textContent = titles[page];
  }
  async function fromURL() {
    if (!await closePanel()) { history.replaceState(null, '', encodeRoute()); return; }
    const [route, raw] = location.hash.slice(1).split('?');
    const params = new URLSearchParams(raw);
    state.page = Object.hasOwn(titles, route) ? route : 'overview';
    state.page = rolePage(state.page);
    state.project = project(params.get('project')) ? params.get('project') : 'all';
    state.period = ['week', 'month', 'year'].includes(params.get('period')) ? params.get('period') : 'month';
    state.search = (params.get('q') || '').slice(0, 150);
    state.rooms = ['1', '2', '3'].includes(params.get('rooms')) ? params.get('rooms') : 'all';
    state.availability = params.get('available') === '1' ? 'available' : 'all';
    const budget = Number(params.get('budget'));
    state.budget = budget >= 1 && budget <= 100 ? String(budget) : '';
    state.sort = ['price-up', 'price-down', 'area'].includes(params.get('sort')) ? params.get('sort') : 'recommended';
    state.status = Object.hasOwn(statuses, params.get('status')) ? params.get('status') : 'all';
    setMenu(false); render(); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function setMenu(open) {
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    state.menuOpen = open && mobile;
    $('#sidebar').classList.toggle('open', state.menuOpen);
    $('.mobile-menu').setAttribute('aria-expanded', String(state.menuOpen));
    $('#sidebar').inert = mobile && !state.menuOpen;
    $('.app').inert = state.menuOpen;
    document.body.classList.toggle('menu-open', state.menuOpen);
    if (state.menuOpen) $('#sidebar a').focus();
  }
  function setAssistantPanel(open, { focus = true, restoreFocus = true } = {}) {
    const active = Boolean(open && state.authenticated);
    if (active === !assistantPanel.hidden) return;
    if (active) {
      assistantReturnFocus = document.activeElement;
      assistantPanel.hidden = false;
      assistantPanelScrim.hidden = false;
      assistantPanelTrigger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('assistant-panel-open');
      if (focus) requestAnimationFrame(() => $('#assistant-chat-input')?.focus({ preventScroll: true }));
      return;
    }
    assistantPanel.hidden = true;
    assistantPanelScrim.hidden = true;
    assistantPanelTrigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('assistant-panel-open');
    if (focus && restoreFocus) (assistantReturnFocus?.isConnected ? assistantReturnFocus : assistantPanelTrigger).focus({ preventScroll: true });
  }
  function mountAssistantContexts() {
    const select = $('#assistant-panel-client');
    if (!select || select.options.length > 1) return;
    select.insertAdjacentHTML('beforeend', D.clients.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join(''));
  }
  function appendAssistantAnswer(question, clientId = '') {
    const log = $('#assistant-chat-log');
    const userMessage = document.createElement('div');
    userMessage.className = 'assistant-message assistant-message-user';
    userMessage.innerHTML = `<div class="assistant-message-author"><span class="assistant-message-avatar">${esc(D.actor.initials)}</span><span>Вы · ${esc(D.actor.name)}</span></div><p>${esc(question)}</p>`;
    const assistantMessage = document.createElement('div');
    assistantMessage.className = 'assistant-message assistant-message-answer';
    assistantMessage.innerHTML = `<span>Помощник</span>${window.Dsk.answerFor(question, clientId, 'drawer')}`;
    log.append(userMessage, assistantMessage);
    log.scrollTop = log.scrollHeight;
  }
  async function boot() {
    const remembered = authRemembered();
    setAuthenticated(remembered, { remember: false, focus: false });
    try {
      await API.getDashboard();
      state.ready = true;
      mountAssistantContexts();
      updateAuthStats();
      window.DskIcons.hydrate(); controls.mount(document); await fromURL();
      if (!remembered) $('#login-email')?.focus({ preventScroll: true });
    } catch (e) {
      console.error('[boot] ошибка загрузки:', e);
      main.innerHTML = empty('Не удалось загрузить пространство.', esc(e.message), btn('retry-load', 'Повторить загрузку', 'refresh', 'primary'));
      main.setAttribute('aria-busy', 'false');
    }
  }
  Object.assign(actions, {
    close: () => closePanel(), 'panel-back': backPanel, menu: () => setMenu(!state.menuOpen), 'close-menu': () => { setMenu(false); $('.mobile-menu').focus(); },
    'assistant-panel-toggle': () => setAssistantPanel(assistantPanel.hidden),
    'assistant-panel-close': () => setAssistantPanel(false),
    'assistant-panel-quick': el => {
      const input = $('#assistant-chat-input');
      input.value = el.dataset.question || '';
      $('#assistant-panel-form').requestSubmit();
    },
    'retry-load': boot,
    'demo-login': () => {
      $('#login-email').value = 'user1@gmail.com';
      $('#login-password').value = 'demo';
      $('#login-form').requestSubmit();
    },
    'toggle-password': el => { const field = $('#login-password'), reveal = field.type === 'password'; field.type = reveal ? 'text' : 'password'; el.textContent = reveal ? 'Скрыть' : 'Показать'; el.setAttribute('aria-pressed', String(reveal)); field.focus({ preventScroll: true }); },
    logout: async () => { await closePanel({ force: true }); setMenu(false); setAuthenticated(false); },
    'reset-filters': () => { Object.assign(state, { project: 'all', search: '', rooms: 'all', availability: 'all', budget: '', status: 'all', sort: 'recommended' }); filtersChanged(); }
  });
  submissions['login-form'] = async form => {
    const email = form.elements.email.value.trim().toLowerCase();
    const password = form.elements.password.value;
    if (!email) throw Object.assign(new Error('Введите рабочую почту.'), { field: 'email' });
    if (!/^\S+@\S+\.\S+$/.test(email)) throw Object.assign(new Error('Проверьте формат почты.'), { field: 'email' });
    if (!password) throw Object.assign(new Error('Введите пароль.'), { field: 'password' });
    setAuthenticated(true);
    toast('Пространство открыто. Добро пожаловать!');
  };
  submissions['assistant-panel-form'] = async form => {
    const question = form.elements.question.value.trim();
    if (!question) throw new Error('Введите вопрос.');
    if (typeof window.Dsk.answerFor !== 'function') throw new Error('Помощник ещё загружается.');
    appendAssistantAnswer(question, $('#assistant-panel-client').value);
    form.reset();
    form.elements.question.focus({ preventScroll: true });
  };
  document.addEventListener('click', async e => {
    const a = e.target.closest('a[href^="#"]');
    if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      const page = a.getAttribute('href').slice(1);
      if (Object.hasOwn(titles, page)) { e.preventDefault(); await navigate(page); return; }
      if (page === 'main') { e.preventDefault(); main.focus(); return; }
    }
    const period = e.target.closest('[data-period]');
    if (period) { state.period = period.dataset.period; filtersChanged(); return; }
    const rooms = e.target.closest('[data-rooms]');
    if (rooms) { state.rooms = rooms.dataset.rooms; filtersChanged(); return; }
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const handler = actions[el.dataset.action];
    if (!handler || (state.busy && !['close-menu'].includes(el.dataset.action))) return;
    if (el.closest('#assistant-panel') && !['assistant-panel-close', 'assistant-panel-quick'].includes(el.dataset.action)) setAssistantPanel(false, { focus: false, restoreFocus: false });
    try { await handler(el, e); }
    catch (error) { toast(error.message || 'Не удалось выполнить действие.', true); }
  });
  document.addEventListener('submit', async e => {
    const handler = submissions[e.target.id];
    if (!handler) return;
    e.preventDefault(); if (state.busy) return;
    const form = e.target;
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    $('.form-error', form)?.remove();
    const submit = e.submitter || $('button[type="submit"]', form);
    state.busy = true; if (submit) { submit.disabled = true; submit.setAttribute('aria-busy', 'true'); }
    try { await handler(form, e.submitter); }
    catch (error) { if (form.isConnected) formError(form, error); else toast(error.message, true); }
    finally { state.busy = false; if (submit?.isConnected) { submit.disabled = false; submit.removeAttribute('aria-busy'); } }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'list-search') { state.search = e.target.value; filtersChanged('quiet'); return; }
    if (e.target.id === 'budget-filter') return;
    inputs[e.target.id]?.(e.target);
    if (e.target.closest('#proposal-form')) inputs.quote?.();
  });
  document.addEventListener('change', e => {
    const map = { 'project-filter': 'project', 'status-filter': 'status', 'sort-filter': 'sort' };
    if (map[e.target.id]) { state[map[e.target.id]] = e.target.value; filtersChanged(); }
    if (e.target.id === 'budget-filter') { state.budget = e.target.validity.valid ? e.target.value : ''; filtersChanged('quiet'); }
    if (e.target.id === 'availability-filter') { controls.rememberToggle(e.target); state.availability = e.target.checked ? 'available' : 'all'; filtersChanged(); }
    if (e.target.closest('#proposal-form')) inputs.quote?.();
    inputs['change:' + e.target.id]?.(e.target);
  });
  document.addEventListener('keydown', e => {
    // Ctrl+K — поиск
    if (state.authenticated && D.actor.role !== 'client' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (!state.busy) openPanel('search');
    }
    // Ctrl+1/2/3 — быстрое переключение ролей (менеджер / руководитель / клиент)
    if (state.authenticated && (e.ctrlKey || e.metaKey) && ['1', '2', '3'].includes(e.key)) {
      const roles = { '1': 'manager', '2': 'lead', '3': 'client' };
      const role = roles[e.key];
      if (role && role !== D.actor.role) {
        e.preventDefault();
        API.setDemoRole(role).then(async () => {
          if (D.actor.role === 'client') await navigate('cabinet');
          else await navigate('overview');
          toast('Роль: ' + D.actor.label);
        }).catch(err => toast(err.message || 'Не удалось сменить роль', true));
        return;
      }
    }
    if (!assistantPanel.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); setAssistantPanel(false); return; }
      if (e.key === 'Tab') {
        const all = [...assistantPanel.querySelectorAll('button,select,textarea,[href],[tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.getClientRects().length);
        if (e.shiftKey && document.activeElement === all[0]) { e.preventDefault(); all.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === all.at(-1)) { e.preventDefault(); all[0].focus(); }
      }
    }
    if (state.menuOpen) {
      if (e.key === 'Escape') { setMenu(false); $('.mobile-menu').focus(); }
      if (e.key === 'Tab') {
        const all = [...$('#sidebar').querySelectorAll('a,button')].filter(el => el.getClientRects().length);
        if (e.shiftKey && document.activeElement === all[0]) { e.preventDefault(); all.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === all.at(-1)) { e.preventDefault(); all[0].focus(); }
      }
    }
    inputs.keydown?.(e);
  });
  dialog.addEventListener('cancel', e => { e.preventDefault(); closePanel(); });
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closePanel();
  });
  window.addEventListener('popstate', fromURL);
  window.addEventListener('beforeunload', e => { if (Domain.hasChanges || $('#proposal-form')) { e.preventDefault(); e.returnValue = ''; } });
  window.matchMedia('(max-width: 760px)').addEventListener('change', () => setMenu(false));
  window.Dsk = { D, API, Domain, $, main, dialog, icon, motion, esc, num, dec, money, date, project, client, apartment, proposal, statuses, titles, state, scoped, cost, tag, qTag, avatar, btn, kv, empty, source, reset, views, panels, actions, submissions, inputs, toast, formError, render, openPanel, closePanel, paintPanel, currentPanel, navigate, formValues, boot, setAuthenticated, setAssistantPanel, rolePage };
  document.addEventListener('DOMContentLoaded', boot);
})();