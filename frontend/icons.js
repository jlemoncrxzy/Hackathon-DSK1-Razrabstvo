/* DSK icon system. Static semantic icons; no external library. */
(() => {
  const paths = {
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    building:'<path d="M4 21V7a1 1 0 0 1 1-1h7v15M12 3h6a1 1 0 0 1 1 1v17M2 21h20M7 10h2M7 14h2M7 18h2M15 7h1M15 11h1M15 15h1M15 19h1"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',
    grid:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 12h18M12 3v18"/>',
    file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"/>',
    sparkles:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3zM20 2v4M18 4h4"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
    settings:'<path d="m9 3-.7 2.2-2 .8-2.1-.4L2 9l1.6 1.8v2.4L2 15l2.2 3.4 2.1-.4 2 .8L9 21h6l.7-2.2 2-.8 2.1.4L22 15l-1.6-1.8v-2.4L22 9l-2.2-3.4-2.1.4-2-.8L15 3z"/><circle cx="12" cy="12" r="3"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01"/>',
    database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    chevrons:'<path d="m8 8 4-4 4 4M8 16l4 4 4-4"/>',
    'chevron-down':'<path d="m6 9 6 6 6-6"/>',
    'chevron-right':'<path d="m9 6 6 6-6 6"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2"/>',
    refresh:'<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
    wallet:'<path d="M20 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V6M20 12h-5v4h5M16 14h.01"/>',
    'trend-up':'<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
    alert:'<path d="M10.3 4a2 2 0 0 1 3.4 0L22 18a2 2 0 0 1-1.7 3H3.7A2 2 0 0 1 2 18zM12 9v5M12 17h.01"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    x:'<path d="m6 6 12 12M6 18 18 6"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    message:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l1.7-5A8.5 8.5 0 1 1 21 11.5zM8 9h8M8 13h5"/>',
    filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
    copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v14h5"/>',
    percent:'<circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="m4 20 16-16"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="3"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    sliders: '<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    documentCheck: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 14l3 3 5-6"/>',
    circleCheck: '<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
    briefcase: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M3 12c4 4 14 4 18 0M10 14h4"/>'
  };
  const safe = s => String(s).replace(/[^a-zA-Z0-9_-]/g, '');
  window.DskIcons = {
    render(name, className = '') {
      const key = Object.hasOwn(paths, name) ? name : 'file';
      return `<svg class="icon icon-${safe(key)} ${safe(className)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[key]}</svg>`;
    },
    hydrate(root = document) {
      root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = this.render(el.dataset.icon); });
    }
  };
})();
