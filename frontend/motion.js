/* Air Reveal: vanilla adaptation of the supplied TypingText motion brief.
   No width/ch animation: proportional Cyrillic text wraps without clipping.
   No loops or fake counting on business data. Final values remain accessible. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let preference = 'system';
  try { preference = localStorage.getItem('dsk-motion') || 'system'; } catch { /* Private browser mode. */ }
  const running = new Set();
  const allowed = () => !reduced.matches && preference !== 'off';
  function sync() {
    document.documentElement.dataset.motion = allowed() ? 'on' : 'off';
    if (!allowed()) running.forEach(a => { try { a.finish(); } catch { a.cancel(); } running.delete(a); });
  }
  const animate = (el, frames, options) => {
    if (!allowed() || !el.animate) return;
    const animation = el.animate(frames, { fill: 'backwards', easing: 'cubic-bezier(.16,1,.3,1)', ...options });
    running.add(animation);
    animation.finished.then(() => running.delete(animation)).catch(() => running.delete(animation));
    return animation;
  };
  function text(el, baseDelay = 0) {
    if (!el || !allowed() || el.dataset.revealPrepared) return;
    el.dataset.revealPrepared = 'true';
    animate(el, [{ opacity: .5 }, { opacity: 1 }], { duration: 220, delay: Math.min(baseDelay, 80) });
  }
  function run(root, mode = 'route') {
    if (!allowed()) return;
    if (mode === 'route') {
      root.querySelectorAll('.page-heading,.hero-content,.stats-grid,.middle-grid,.section-grid,.catalog-grid,.project-cards,.dossier-grid,.analytics-grid,.table-card').forEach(el => {
        animate(el, [{ opacity: .65 }, { opacity: 1 }], { duration: 220 });
      });
    }
    if (mode !== 'quiet') {
      root.querySelectorAll('.chart-svg .bar,.chart-svg .previous-bar').forEach(el => animate(el, [{ transform: 'scaleY(.05)' }, { transform: 'scaleY(1)' }], { duration: 360 }));
      root.querySelectorAll('.progress-track>span').forEach(el => animate(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 360 }));
    }
  }
  function dialog(root, sourceRect) {
    if (sourceRect) {
      const surface = root.closest('dialog') || root;
      const target = surface.getBoundingClientRect();
      const sourceX = sourceRect.left + sourceRect.width / 2;
      const sourceY = sourceRect.top + sourceRect.height / 2;
      const targetX = target.left + target.width / 2;
      const targetY = target.top + target.height / 2;
      const scale = Math.max(.18, Math.min(.62, sourceRect.width / Math.max(target.width, 1)));
      animate(surface, [
        { opacity: .82, transform: `translate3d(${sourceX - targetX}px,${sourceY - targetY}px,0) scale(${scale})`, filter: 'blur(1px)', borderRadius: '12px' },
        { opacity: 1, transform: 'translate3d(0,0,0) scale(1)', filter: 'blur(0)', borderRadius: '22px' }
      ], { duration: 520 });
    } else {
      animate(root, [{ opacity: 0, transform: 'translate3d(0,12px,0) scale(.985)', filter: 'blur(3px)' }, { opacity: 1, transform: 'translate3d(0,0,0) scale(1)', filter: 'blur(0)' }], { duration: 340 });
    }
    root.querySelectorAll('.dialog-header h2').forEach(el => text(el, 30, true));
  }
  function closeDialog(surface, sourceRect) {
    if (!sourceRect || !surface) return;
    const target = surface.getBoundingClientRect();
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const targetX = target.left + target.width / 2;
    const targetY = target.top + target.height / 2;
    const scale = Math.max(.18, Math.min(.62, sourceRect.width / Math.max(target.width, 1)));
    return animate(surface, [
      { opacity: 1, transform: 'translate3d(0,0,0) scale(1)', filter: 'blur(0)' },
      { opacity: .15, transform: `translate3d(${sourceX - targetX}px,${sourceY - targetY}px,0) scale(${scale})`, filter: 'blur(2px)' }
    ], { duration: 330, easing: 'cubic-bezier(.4,0,.2,1)' });
  }
  reduced.addEventListener?.('change', sync);
  sync();
  window.DskMotion = {
    run, text, dialog, closeDialog, animate,
    get preference() { return preference; },
    get systemReduced() { return reduced.matches; },
    get enabled() { return allowed(); },
    setPreference(value) { preference = value === 'off' ? 'off' : 'system'; try { localStorage.setItem('dsk-motion', preference); } catch { /* Optional device preference. */ } sync(); }
  };
})();
