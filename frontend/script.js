let clientId = localStorage.getItem('clientId') || generateUUID();
let clientName = localStorage.getItem('clientName') || 'Гость';
let currentProposal = null;

document.addEventListener('DOMContentLoaded', () => {
    localStorage.setItem('clientId', clientId);
    document.getElementById('clientName').value = clientName;

    document.getElementById('saveNameBtn').addEventListener('click', () => {
        const name = document.getElementById('clientName').value.trim();
        if (name) {
            clientName = name;
            localStorage.setItem('clientName', name);
            alert('Имя сохранено!');
        }
    });

    loadHistory();
    document.getElementById('chatForm').addEventListener('submit', sendMessage);
    document.getElementById('cartIcon').addEventListener('click', toggleCart);
    document.getElementById('closeCartBtn').addEventListener('click', () => {
        document.getElementById('cartDropdown').style.display = 'none';
    });
    document.getElementById('saveProposalBtn').addEventListener('click', saveProposal);

    // Демо-анализ диалогов
    document.getElementById('demoDialogForm').addEventListener('submit', analyzeDemoDialog);

    checkNotifications();
    setInterval(checkNotifications, 30000);
});

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

async function loadHistory() {
    try {
        const resp = await fetch(`/history?client_id=${clientId}`);
        if (!resp.ok) throw new Error('Ошибка загрузки истории');
        const data = await resp.json();
        data.history.forEach(msg => addMessageToChat(msg.role, msg.text));
    } catch (e) {
        console.error('Ошибка загрузки истории:', e);
    }
}

async function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    addMessageToChat('user', text);
    try {
        const resp = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, client_id: clientId })
        });
        if (!resp.ok) throw new Error('Ошибка сервера');
        const data = await resp.json();
        addMessageToChat('assistant', data.response);

        if (data.response.includes('предлож') || data.response.includes('коммерческое предложение')) {
            document.getElementById('proposalActions').style.display = 'block';
            currentProposal = {
                client_id: clientId,
                client_name: clientName,
                project_id: extractProjectId(data.response) || 'P001',
                apartment_id: extractApartmentId(data.response) || 'A101',
                total_price: extractPrice(data.response) || 0,
                discount: extractDiscount(data.response) || 0,
                proposal_text: data.response,
                original_completion: '2026-12-31',
                current_completion: '2026-12-31'
            };
        }
        await updateCartDisplay();
        checkNotifications();
    } catch (e) {
        console.error('Ошибка отправки:', e);
        addMessageToChat('assistant', 'Извините, произошла ошибка. Попробуйте позже.');
    }
}

function addMessageToChat(role, text) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function toggleCart() {
    const dropdown = document.getElementById('cartDropdown');
    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
        return;
    }
    await updateCartDisplay();
    dropdown.style.display = 'block';
}

async function updateCartDisplay() {
    try {
        const resp = await fetch(`/cart?client_id=${clientId}`);
        if (!resp.ok) throw new Error('Ошибка загрузки корзины');
        const data = await resp.json();
        const cart = data.cart || [];
        document.getElementById('cartCount').textContent = cart.length;

        const container = document.getElementById('cartItems');
        if (cart.length === 0) {
            container.innerHTML = '<p>Корзина пуста</p>';
        } else {
            let html = '';
            cart.forEach(item => {
                html += `<div class="cart-item">
                    <span><strong>${item.project_name}</strong> — кв. ${item.apartment_id}<br>
                    ${item.rooms} комн., ${item.area} м², ${item.price.toLocaleString()} руб.<br>
                    <small>Срок сдачи: ${item.completion}</small></span>
                    <button onclick="removeFromCart('${item.project_id}', '${item.apartment_id}')">✕</button>
                </div>`;
            });
            container.innerHTML = html;
        }
    } catch (e) {
        console.error('Ошибка обновления корзины:', e);
    }
}

async function removeFromCart(projectId, apartmentId) {
    try {
        await fetch('/cart/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId, project_id: projectId, apartment_id: apartmentId })
        });
        await updateCartDisplay();
        checkNotifications();
    } catch (e) {
        console.error('Ошибка удаления:', e);
    }
}

async function checkNotifications() {
    try {
        const resp = await fetch(`/notifications?client_id=${clientId}`);
        if (!resp.ok) throw new Error('Ошибка проверки уведомлений');
        const data = await resp.json();
        const notifs = data.notifications || [];
        const badge = document.getElementById('cartNotification');
        if (notifs.length > 0) {
            badge.style.display = 'inline';
            badge.textContent = notifs.length;
        } else {
            badge.style.display = 'none';
        }
        const container = document.getElementById('cartNotifications');
        if (notifs.length > 0) {
            let html = '<h4>Уведомления</h4>';
            notifs.forEach(n => {
                html += `<div class="notification-item">
                    ⚠️ Квартира ${n.apartment_id} в ЖК ${n.project_id}: срок сдачи изменён с ${n.old_completion} на ${n.new_completion}
                </div>`;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = '';
        }
    } catch (e) {
        console.error('Ошибка проверки уведомлений:', e);
    }
}

async function saveProposal() {
    if (!currentProposal) {
        alert('Нет предложения для сохранения. Сначала получите предложение от консультанта.');
        return;
    }
    try {
        const resp = await fetch('/save-proposal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentProposal)
        });
        if (!resp.ok) throw new Error('Ошибка сохранения');
        const data = await resp.json();
        alert('Предложение сохранено! ID: ' + data.proposal.proposal_id);
        document.getElementById('proposalActions').style.display = 'none';
        const projId = currentProposal.project_id;
        const aptId = currentProposal.apartment_id;
        currentProposal = null;
        await fetch('/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId, project_id: projId, apartment_id: aptId })
        });
        await updateCartDisplay();
    } catch (e) {
        console.error('Ошибка сохранения предложения:', e);
        alert('Ошибка сохранения. Попробуйте ещё раз.');
    }
}

// --- Демонстрационный раздел: анализ диалогов ---
async function analyzeDemoDialog(e) {
    e.preventDefault();
    const dialogId = document.getElementById('demoDialogId').value.trim();
    const resultDiv = document.getElementById('demoDialogResult');
    const btn = document.getElementById('demoDialogBtn');

    if (!dialogId) {
        showResult(resultDiv, '⚠️ Введите ID диалога', true);
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Анализ...';
    showResult(resultDiv, '⏳ Отправка запроса...', false);

    try {
        const resp = await fetch('/analyze-dialog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dialog_id: dialogId })
        });
        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'Ошибка сервера');
        }
        const data = await resp.json();
        const insights = data.insights || {};
        let formatted = `🔍 Инсайты по диалогу ${dialogId}:\n\n`;
        formatted += `Проблемы клиента:\n${insights.issues?.map(i => `  • ${i}`).join('\n') || '—'}\n\n`;
        formatted += `Действия менеджера:\n${insights.resolved_actions?.map(a => `  • ${a}`).join('\n') || '—'}\n\n`;
        formatted += `Рекомендации:\n${insights.recommendations?.map(r => `  • ${r}`).join('\n') || '—'}`;
        showResult(resultDiv, formatted, false);
    } catch (err) {
        showResult(resultDiv, `❌ Ошибка: ${err.message}`, true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Анализировать';
    }
}

// Вспомогательная функция показа результата в демо-секции
function showResult(element, text, isError) {
    element.textContent = text;
    element.className = 'result-box show' + (isError ? ' error' : '');
}

// Вспомогательные функции извлечения (оставляем)
function extractProjectId(text) {
    const match = text.match(/проект\s*["']?(.+?)["']?/i);
    return match ? match[1] : null;
}
function extractApartmentId(text) {
    const match = text.match(/A\d{3}/i);
    return match ? match[0] : null;
}
function extractPrice(text) {
    const match = text.match(/(\d+[\s,]?\d*)\s*руб/i);
    return match ? parseFloat(match[1].replace(/\s/g,'')) : 0;
}
function extractDiscount(text) {
    const match = text.match(/(\d+)\s*%/i);
    return match ? parseInt(match[1]) : 0;
}