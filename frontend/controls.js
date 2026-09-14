/* Shared selection motion. Native buttons, checkboxes and labels own interaction. */
(() => {
  'use strict';
  const selector = '.period-control,.chip-list[role="group"],.motion-options';
  const motion = window.DskMotion;
  let changedToggle = null;
  const groups = root => [...root.querySelectorAll(selector)];
  const key = el => el.getAttribute('aria-label');
  const selection = el => el.querySelector('button[aria-pressed="true"]');
  const relativeBox = (el, group) => {
    const r = el.getBoundingClientRect(), p = group.getBoundingClientRect();
    return { x: r.left - p.left - group.clientLeft, y: r.top - p.top - group.clientTop, width: r.width, height: r.height };
  };
  function capture(root) {
    const saved = new Map();
    groups(root).forEach(group => {
      const active = selection(group), pill = group.querySelector('.selection-pill');
      if (active) saved.set(key(group), { label: active.textContent, ...relativeBox(pill || active, group) });
    });
    return saved;
  }
  function place(group, previous, move) {
    const active = selection(group);
    if (!active) return;
    let pill = group.querySelector('.selection-pill');
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'selection-pill';
      pill.setAttribute('aria-hidden', 'true');
      group.prepend(pill);
    }
    pill.getAnimations?.().forEach(animation => animation.cancel());
    const box = relativeBox(active, group);
    if (!box.width || !box.height) return;
    Object.assign(pill.style, { left: box.x + 'px', top: box.y + 'px', width: box.width + 'px', height: box.height + 'px' });
    group.classList.add('segmented-ready');
    if (move && previous && previous.label !== active.textContent && previous.width > 0) {
      motion.animate(pill, [
        { transform: `translate(${previous.x - box.x}px,${previous.y - box.y}px) scale(${previous.width / box.width},${previous.height / box.height})` },
        { transform: 'translate(0,0) scale(1,1)' }
      ], { duration: 360 });
    }
  }
  function mount(root, previous = new Map(), move = false) {
    root.querySelectorAll('.button,.icon-button,.table-action,.auth-submit,.auth-demo,.assistant-suggestion,.assistant-input button,.ai-question-line button,.hero-insight button,.assistant-panel-close,.assistant-launch,.assistant-panel-composer button,.client-cabinet-composer button,.assistant-quick-questions button,.client-cabinet-quick button').forEach(el => el.classList.add('ui-button'));
    groups(root).forEach(group => {
      group.classList.add('segmented');
      place(group, previous.get(key(group)), move);
    });
    if (changedToggle) {
      const input = root.querySelector('input.toggle-control[id="' + changedToggle.id + '"]');
      if (input) {
        input.dataset.toggleFrom = changedToggle.checked ? 'off' : 'on';
        input.addEventListener('animationend', () => delete input.dataset.toggleFrom, { once: true });
        changedToggle = null;
      }
    }
  }
  function focused(root) {
    const el = document.activeElement, group = el?.closest?.(selector);
    return group && root.contains(group) ? { group: key(group), label: el.textContent } : null;
  }
  function restore(root, target) {
    if (!target) return;
    const group = groups(root).find(el => key(el) === target.group);
    const button = group && [...group.querySelectorAll('button')].find(el => el.textContent === target.label);
    button?.focus({ preventScroll: true });
  }
  // Coalesce resize/font events. Never retain detached route or dialog elements.
  let frame = 0;
  const reposition = () => {
    if (frame || !window.requestAnimationFrame) return;
    frame = window.requestAnimationFrame(() => { frame = 0; mount(document); });
  };
  window.addEventListener('resize', reposition, { passive: true });
  document.fonts?.ready.then(reposition);
  document.fonts?.addEventListener?.('loadingdone', reposition);
  document.addEventListener('keydown', e => {
    const group = e.target.closest?.(selector);
    if (!group || !e.target.matches('button') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
    const buttons = [...group.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    e.preventDefault();
    const index = buttons.indexOf(e.target), step = ['ArrowLeft','ArrowUp'].includes(e.key) ? -1 : 1;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + step + buttons.length) % buttons.length;
    buttons[next].focus({ preventScroll: true }); buttons[next].click();
  });
  window.DskControls = { capture, mount, focused, restore, rememberToggle(input) { changedToggle = { id: input.id, checked: input.checked }; } };
})();
