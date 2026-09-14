/* Система уведомлений. Проверяет корзину пользователя при входе,
   обновляет бейдж на колокольчике и открывает панель со списком.
   Работает для всех ролей: менеджер, руководитель и клиент. */
(() => {
  'use strict';
  const Dsk = window.Dsk;
  if (!Dsk) {
    console.warn('notifications_bridge: Dsk не найден');
    return;
  }

  const state = { unread: 0, items: [] };

  function getClientId() {
    const actor = (Dsk.D && Dsk.D.actor) || {};
    if (actor.role === 'client' && actor.clientId) return actor.clientId;
    // Для менеджера/руководителя используем user1 как «свой» ящик
    return 'user1';
  }

  function updateBadge() {
    const badge = document.querySelector('.notification-button i');
    const button = document.querySelector('.notification-button');
    if (!badge || !button) return;

    if (state.unread > 0) {
      badge.hidden = false;
      badge.textContent = String(state.unread);
      Object.assign(badge.style, {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '17px',
        height: '17px',
        padding: '0 4px',
        borderRadius: '9px',
        fontSize: '10px',
        fontWeight: '700',
        color: '#fff',
        background: '#e2401b',
        position: 'absolute',
        top: '-3px',
        right: '-4px',
        border: '2px solid #fff',
        boxShadow: '0 2px 6px rgba(226,64,27,.35)',
        zIndex: 5
      });
      button.setAttribute('aria-label', `Уведомления: ${state.unread} новых`);
    } else {
      badge.hidden = true;
      badge.textContent = '';
      button.setAttribute('aria-label', 'Уведомления');
    }
  }

  async function loadNotifications() {
    const cid = getClientId();
    try {
      const r = await fetch(`/user-notifications?client_id=${encodeURIComponent(cid)}`);
      if (!r.ok) return;
      const data = await r.json();
      state.items = data.notifications || [];
      state.unread = data.unread || 0;
      updateBadge();
    } catch (e) {
      console.warn('notifications_bridge: load failed', e);
    }
  }

  async function checkAndLoad(silent = false) {
    const cid = getClientId();
    try {
      const r = await fetch('/user-notifications/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: cid })
      });
      if (!r.ok) return;
      const data = await r.json();
      state.items = data.notifications || [];
      state.unread = data.unread || 0;
      updateBadge();
      if (!silent && data.new > 0) {
        Dsk.toast(`Новых уведомлений: ${data.new}`);
      }
    } catch (e) {
      console.warn('notifications_bridge: check failed', e);
    }
  }

  async function markRead(ids) {
    const cid = getClientId();
    try {
      const r = await fetch('/user-notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: cid, ids: ids || null })
      });
      if (!r.ok) return;
      const data = await r.json();
      state.items = data.notifications || [];
      state.unread = data.unread || 0;
      updateBadge();
    } catch {}
  }

  function renderBody() {
    if (!state.items.length) {
      return `<div class="empty-state" style="padding:35px 20px;">
        <h3 style="color:#8d7e81;font-size:18px;margin-bottom:8px;">Уведомлений пока нет</h3>
        <p style="color:#a8a4af;font-size:13px;line-height:1.7;">
          Здесь появятся изменения по квартирам в вашей корзине и по условиям сделок.
        </p>
      </div>`;
    }
    const rows = state.items.map(n => {
      const dt = new Date(n.created_at).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      const bg = n.read ? '#fff' : '#fff5ee';
      const border = n.read ? '#efe8e2' : '#f1cbb6';
      const dot = n.read ? '' :
        `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#e2401b;margin-right:8px;vertical-align:middle;"></span>`;
      return `<article style="padding:14px 16px;border:1px solid ${border};border-radius:12px;background:${bg};margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <strong style="color:#3a3129;font-size:14px;line-height:1.4;">${dot}${Dsk.esc(n.title || 'Уведомление')}</strong>
          <small style="color:#a3968c;white-space:nowrap;font-size:11px;">${dt}</small>
        </div>
        <p style="margin:8px 0 0;color:#6d635c;font-size:13px;line-height:1.6;">${Dsk.esc(n.text || '')}</p>
      </article>`;
    }).join('');

    const hasUnread = state.unread > 0;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;">
        <span style="color:#8d827a;font-size:13px;">Всего: ${state.items.length} · Новых: ${state.unread}</span>
        ${hasUnread ? `<button type="button" class="button ui-button" data-action="mark-all-notifications-read" style="min-height:36px;font-size:13px;">Отметить прочитанными</button>` : ''}
      </div>
      ${rows}`;
  }

  function openPanel() {
    const dialog = Dsk.dialog;
    const content = dialog.querySelector('#dialog-content');
    if (!content) return;

    content.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-heading"><h2 id="dialog-title">Уведомления</h2></div>
        <button class="icon-button" data-action="close" aria-label="Закрыть">${Dsk.icon('x')}</button>
      </div>
      <div class="dialog-body">${renderBody()}</div>`;

    dialog.classList.remove('wide-dialog');
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add('dialog-open');

    // Правильно заполняем стек, чтобы кнопка «Закрыть» и Escape работали через app.js
    Dsk.state.stack = [{ kind: 'userNotifications', data: {} }];
    Dsk.state.returnFocus = document.activeElement;

    // Помечаем всё прочитанным чуть позже, чтобы пользователь успел увидеть непрочитанные
    if (state.unread > 0) {
      setTimeout(async () => {
        await markRead(null);
        const body = dialog.querySelector('.dialog-body');
        if (body) body.innerHTML = renderBody();
      }, 500);
    }
  }

  // Перехватываем action колокольчика
  Dsk.actions.notifications = async () => {
    await loadNotifications();
    openPanel();
  };

  // Кнопка "отметить всё прочитанным"
  Dsk.actions['mark-all-notifications-read'] = async () => {
    await markRead(null);
    const body = Dsk.dialog.querySelector('.dialog-body');
    if (body) body.innerHTML = renderBody();
  };

  // Заглушка в panels на случай если кто-то вызовет openPanel('userNotifications')
  Dsk.panels.userNotifications = () => ({ title: 'Уведомления', body: renderBody() });

  // Обёртка над setDemoRole: после смены роли перепроверяем уведомления
  if (Dsk.API && typeof Dsk.API.setDemoRole === 'function') {
    const originalSetRole = Dsk.API.setDemoRole.bind(Dsk.API);
    Dsk.API.setDemoRole = async (role) => {
      const result = await originalSetRole(role);
      // Небольшая задержка, чтобы D.actor успел обновиться в UI
      setTimeout(() => checkAndLoad(true), 200);
      return result;
    };
  }

  // При старте — проверяем корзину и обновляем бейдж
  window.addEventListener('load', () => {
    setTimeout(() => checkAndLoad(true), 900);
    setInterval(() => checkAndLoad(true), 60000);
  });

  console.log('✅ notifications_bridge: система уведомлений подключена');
})();