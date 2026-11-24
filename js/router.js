/* Router theo hash (#/duong-dan) + khung giao diện (header, sidebar) + kiểm tra phân quyền */
WMS.router = (function () {
  const { esc, icon } = WMS.ui;
  const store = WMS.store;

  function parse() {
    const h = location.hash.slice(1) || '/';
    const [path, q] = h.split('?');
    return { path, params: Object.fromEntries(new URLSearchParams(q || '')) };
  }
  const go = (path) => { if (location.hash === '#' + path) render(); else location.hash = '#' + path; };

  function topbarHtml(user, path) {
    const link = (p, label) => `<a class="topbar__link ${path === p ? 'topbar__link--active' : ''}" href="#${p}">${label}</a>`;
    let tools;
    if (user) {
      const unread = store.myNotifications(user).filter(n => !n.read).length;
      tools = `<button class="icon-btn" data-action="menu.bell" aria-label="Thông báo" aria-haspopup="true">${icon('bell')}${unread ? `<span class="icon-btn__dot">${unread}</span>` : ''}</button>
        <button class="btn btn--ghost btn--sm" data-action="menu.user" aria-haspopup="true">${icon('user')}<span class="hide-sm">${esc(user.name)}</span></button>${dropdownHtml(user)}`;
    } else {
      tools = `<a class="btn btn--ghost btn--sm" href="#/login">Đăng nhập</a><a class="btn btn--sm hide-sm" href="#/register">Đăng ký</a>`;
    }
    return `<button class="icon-btn topbar__menu-btn" data-action="nav.toggle" aria-label="Mở menu">${icon('menu')}</button>
      <a class="topbar__brand" href="#/"><img src="assets/logo.svg" alt="" width="34" height="34"><span>WMS <em>Logistics</em></span></a>
      <nav class="topbar__nav" id="topnav" aria-label="Điều hướng chính">${link('/', 'Trang chủ')}${link('/track', 'Tra cứu vận đơn')}${user ? '' : link('/register', 'Đăng ký')}</nav>
      <div class="topbar__spacer"></div><div class="topbar__tools">${tools}</div>`;
  }

  // Dropdown chuông thông báo / menu người dùng
  function dropdownHtml(user) {
    const m = WMS.state.menu;
    if (m === 'bell') {
      const list = store.myNotifications(user).slice(0, 8);
      const unreadIds = WMS.state.unreadIds || [];
      return `<div class="dropdown" role="menu"><div class="dropdown__head">Thông báo</div>` +
        (list.length ? list.map(n => `<a class="dropdown__item ${unreadIds.includes(n.id) ? 'dropdown__item--unread' : ''}" href="#/track?code=${esc(n.code)}">${esc(n.text)}<br><small class="muted">${WMS.ui.dt(n.time)}</small></a>`).join('') : '<div class="dropdown__item muted">Chưa có thông báo</div>') + '</div>';
    }
    if (m === 'user') {
      return `<div class="dropdown" role="menu"><div class="dropdown__head">${esc(user.name)}<br><small class="muted">${WMS.ROLES[user.role]}</small></div>
        <a class="dropdown__item" href="#/profile">Hồ sơ cá nhân</a>
        <a class="dropdown__item" href="#" data-action="logout">Đăng xuất</a></div>`;
    }
    return '';
  }
  function sidebarHtml(user, path) {
    let html = '', pendingGroup = null;
    WMS.NAV.forEach(n => {
      if (n.group) { pendingGroup = n.group; return; }
      if (!n.roles.includes(user.role)) return;
      if (pendingGroup) { html += `<div class="sidebar__title">${pendingGroup}</div>`; pendingGroup = null; }
      html += `<a class="sidebar__link ${path === n.path ? 'sidebar__link--active' : ''}" href="#${n.path}">${icon(n.icon)}${n.label}</a>`;
    });
    return html;
  }

  function render() {
    const { path, params } = parse();
    const user = store.currentUser();
    const page = WMS.pages[path];
    const app = document.getElementById('app');
    WMS.ui.closeModal();
    WMS.state.menu = null;

    let allowed = true, denied = '';
    if (page && page.roles) {
      if (!user) { return go('/login?next=' + encodeURIComponent(path)); }
      if (page.roles !== '*' && !page.roles.includes(user.role)) { allowed = false; denied = 'Vai trò "' + WMS.ROLES[user.role] + '" không có quyền truy cập trang này.'; }
    }
    app.innerHTML = `<header class="topbar" id="topbar"></header>
      <div class="shell">${user ? '<aside class="sidebar" id="sidebar" aria-label="Menu chức năng"></aside><div class="overlay" id="overlay" data-action="nav.toggle"></div>' : ''}
      <main class="main ${user ? '' : 'main--public'}" id="view" tabindex="-1"></main></div>
      <footer class="footer">Đồ án Web Design · WMS Logistics (bản demo, dữ liệu lưu trên trình duyệt) · <a href="#" data-action="demo.reset">Reset dữ liệu demo</a></footer>`;
    document.getElementById('topbar').innerHTML = topbarHtml(user, path);
    if (user) document.getElementById('sidebar').innerHTML = sidebarHtml(user, path);

    const view = document.getElementById('view');
    if (!page) { view.innerHTML = notice('Không tìm thấy trang', 'Đường dẫn không tồn tại. <a href="#/">Về trang chủ</a>'); document.title = 'Không tìm thấy · WMS'; }
    else if (!allowed) { view.innerHTML = notice('Không có quyền truy cập', esc(denied) + ' <a href="#' + WMS.HOME[user.role] + '">Về trang của bạn</a>'); store.audit('Truy cập bị chặn', `${user.name} truy cập ${path}`); }
    else {
      document.title = page.title + ' · WMS Logistics';
      try { page.render(view, params, user); } catch (err) { console.error(err); view.innerHTML = notice('Có lỗi xảy ra', 'Không thể hiển thị trang này. Thử reset dữ liệu demo ở cuối trang.'); }
    }
    window.scrollTo(0, 0);
  }
  const notice = (title, html) => `<div class="card auth-box"><h1>${title}</h1><p>${html}</p></div>`;

  // Chỉ vẽ lại topbar (khi mở/đóng dropdown) để không mất trạng thái trang
  function refreshTopbar() {
    const user = store.currentUser(), tb = document.getElementById('topbar');
    if (tb) tb.innerHTML = topbarHtml(user, parse().path);
  }

  window.addEventListener('hashchange', render);
  return { render, refresh: render, go, parse, refreshTopbar };
})();

// ---- Hành động chung của khung giao diện ----
WMS.actions['nav.toggle'] = () => {
  const sb = document.getElementById('sidebar');
  if (sb) { sb.classList.toggle('sidebar--open'); document.getElementById('overlay').classList.toggle('overlay--open'); }
  else document.getElementById('topnav').classList.toggle('topbar__nav--open');
};
WMS.actions['menu.bell'] = () => {
  const user = WMS.store.currentUser();
  if (WMS.state.menu === 'bell') { WMS.state.menu = null; }
  else {
    WMS.state.menu = 'bell';
    const mine = WMS.store.myNotifications(user);
    WMS.state.unreadIds = mine.filter(n => !n.read).map(n => n.id); // giữ để tô đậm lần mở này
    mine.forEach(n => { if (n.to.user === user.id) n.read = true; });
    WMS.store.save();
  }
  WMS.router.refreshTopbar();
};
WMS.actions['menu.user'] = () => { WMS.state.menu = WMS.state.menu === 'user' ? null : 'user'; WMS.router.refreshTopbar(); };
WMS.actions.logout = () => { WMS.store.logout(); WMS.ui.toast('Đã đăng xuất'); WMS.router.go('/'); };
WMS.actions['demo.reset'] = () => WMS.ui.confirmDialog('Khôi phục toàn bộ dữ liệu mẫu ban đầu? Mọi thay đổi bạn đã thực hiện sẽ mất.', () => { WMS.store.reset(); WMS.ui.toast('Đã reset dữ liệu demo', 'success'); WMS.router.go('/'); }, { danger: true, yesText: 'Reset' });
