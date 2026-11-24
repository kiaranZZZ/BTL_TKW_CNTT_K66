/* Điểm khởi động: gắn các bộ lắng nghe sự kiện toàn cục (event delegation) rồi chạy router */
document.addEventListener('click', (e) => {
  // Click ra ngoài thì đóng dropdown
  if (WMS.state.menu && !e.target.closest('.topbar__tools')) { WMS.state.menu = null; WMS.router.refreshTopbar(); }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = WMS.actions[el.dataset.action];
  if (fn) { if (el.tagName === 'A') e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  const fn = el && WMS.changes[el.dataset.change];
  if (fn) fn(el, e);
});
WMS.router.render();
