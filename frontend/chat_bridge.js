/* Мост: подменяет Dsk.answerFor на вызов /chat + кнопки «Оформить КП». */
(() => {
  'use strict';
  const Dsk = window.Dsk;
  if (!Dsk || typeof Dsk.answerFor !== 'function') {
    console.warn('chat_bridge: Dsk.answerFor не найден');
    return;
  }

  const cache = new Map();
  const sessionKey = 'dsk-session-id';
  let sessionId = localStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = 'web-' + Math.random().toString(36).slice(2);
    localStorage.setItem(sessionKey, sessionId);
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function apartmentLabel(aptId) {
    try {
      const apt = (Dsk.D.apartments || []).find(a => a.id === aptId);
      if (apt && apt.number) return `№${apt.number}`;
    } catch {}
    return aptId.toUpperCase();
  }

  function renderSuggestions(ids) {
    if (!ids || !ids.length) return '';
    const buttons = ids.map(id => {
      const label = apartmentLabel(id);
      return `<button type="button"
                class="button ui-button"
                data-action="quick-proposal"
                data-apartment="${esc(id)}"
                style="min-height:38px;font-size:13px;padding:8px 12px;">
                ${Dsk.icon('file')}<span>Оформить КП по ${esc(label)}</span>
              </button>`;
    }).join('');
    return `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">${buttons}</div>`;
  }

  function renderAnswer(text, suggestedIds) {
    return `<div class="ai-answer"><h3>Ответ помощника</h3>` +
           `<p>${esc(text).replace(/\n/g, '<br>')}</p>` +
           `<div class="source-list"><span class="source-tag">GigaChat · RAG</span></div>` +
           renderSuggestions(suggestedIds) +
           `</div>`;
  }

  function renderPending(id) {
    return `<div class="ai-answer" data-pending="${id}">` +
           `<h3>Помощник думает…</h3>` +
           `<div class="source-list"><span class="source-tag">Обработка запроса</span></div></div>`;
  }

  Dsk.answerFor = function (question, clientId, surface) {
    const key = (clientId || '') + '::' + question;
    if (cache.has(key)) {
      const c = cache.get(key);
      return renderAnswer(c.text, c.suggestedIds);
    }

    const pendingId = 'p-' + Math.random().toString(36).slice(2);
    const cid = clientId || sessionId;

    console.log('[chat_bridge] → POST /chat', { question, cid });

    fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, client_id: cid }),
    })
      .then(r => r.json())
      .then(data => {
        console.log('[chat_bridge] ← /chat', data);
        const text = (data && data.response) || 'Не удалось получить ответ.';
        const ids = (data && data.suggested_apartment_ids) || [];
        console.log('[chat_bridge] suggested ids:', ids);
        cache.set(key, { text, suggestedIds: ids });
        const el = document.querySelector(`[data-pending="${pendingId}"]`);
        if (el) {
          el.outerHTML = renderAnswer(text, ids);
        } else {
          console.warn('[chat_bridge] pending-элемент не найден:', pendingId);
        }
      })
      .catch(err => {
        console.error('[chat_bridge] fetch error:', err);
        const el = document.querySelector(`[data-pending="${pendingId}"]`);
        if (el) el.outerHTML = renderAnswer('Помощник недоступен: ' + err.message, []);
      });

    return renderPending(pendingId);
  };

  // ======== Клик по «Оформить КП» ========
  Dsk.actions['quick-proposal'] = (el) => {
    const aptId = el.dataset.apartment;
    const actor = Dsk.D.actor || {};
    console.log('[chat_bridge] quick-proposal', { aptId, role: actor.role, clientId: actor.clientId });

    const apt = (Dsk.D.apartments || []).find(a => a.id === aptId);
    if (!apt) {
      Dsk.toast('Квартира недоступна. Обновите страницу.', true);
      return;
    }
    if (apt.status !== 'available') {
      Dsk.toast('Эта квартира уже в резерве.', true);
      return;
    }

    if (typeof Dsk.setAssistantPanel === 'function') {
      Dsk.setAssistantPanel(false, { focus: false, restoreFocus: false });
    }

    if (actor.role === 'client') {
      console.log('[chat_bridge] → clientInquiry', { id: aptId });
      Dsk.openPanel('clientInquiry', { id: aptId });
      return;
    }

    const clientId = (actor.role === 'client' && actor.clientId)
      || (Dsk.D.clients && Dsk.D.clients[0] && Dsk.D.clients[0].id);
    console.log('[chat_bridge] → quote', { apartmentId: aptId, clientId });
    Dsk.openPanel('quote', { apartmentId: aptId, clientId });
  };

  // Обёртка над client-cabinet-form (клиентский кабинет)
  if (Dsk.submissions && typeof Dsk.submissions['client-cabinet-form'] === 'function') {
    Dsk.submissions['client-cabinet-form'] = async (form) => {
      const question = (form.elements.question.value || '').trim();
      if (!question) throw new Error('Введите вопрос.');
      const log = Dsk.$('#client-cabinet-chat-log');
      if (!log) return;
      const actor = Dsk.D.actor || {};
      const cid = actor.clientId || sessionId;

      const userMsg = document.createElement('div');
      userMsg.className = 'client-chat-message user';
      userMsg.innerHTML = `<span>Вы · ${esc(actor.name || 'Клиент')}</span><p>${esc(question)}</p>`;
      log.appendChild(userMsg);

      const answerMsg = document.createElement('div');
      answerMsg.className = 'client-chat-message answer';
      answerMsg.innerHTML = `<span>Помощник</span>${Dsk.answerFor(question, cid, 'cabinet')}`;
      log.appendChild(answerMsg);

      log.scrollTop = log.scrollHeight;
      form.reset();
      form.elements.question.focus({ preventScroll: true });
    };
  }

  console.log('✅ chat_bridge: чат подключён к /chat');
})();