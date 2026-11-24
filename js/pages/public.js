/* Trang công khai + tài khoản: Trang chủ, Tra cứu vận đơn, Đăng nhập, Đăng ký, Hồ sơ cá nhân */
(function () {
  const { esc, icon, badge, dt, date, money, maskPhone, toast } = WMS.ui;
  const store = WMS.store;

  // ---------- Trang chủ ----------
  WMS.pages['/'] = {
    title: 'Trang chủ',
    render(root) {
      const features = [
        ['box', 'Quản lý kho', 'Nhập, xuất, điều chuyển, kiểm kê và cảnh báo tồn thấp theo thời gian thực.'],
        ['truck', 'Quản lý vận đơn', 'Từ lúc tạo đơn, duyệt, phân công tài xế đến giao thành công kèm POD và thu COD.'],
        ['search', 'Tra cứu hành trình', 'Chỉ cần mã vận đơn là xem được toàn bộ hành trình, không cần đăng nhập.']
      ];
      root.innerHTML = `<section class="hero">
          <h1>Quản lý kho và theo dõi vận đơn<br>cho doanh nghiệp nhỏ</h1>
          <p>Một nơi duy nhất để biết hàng đang ở đâu: trong kho, trên xe hay đã đến tay khách.</p>
          <form class="hero__form" id="hero-form" role="search">
            <label class="sr-only" for="hero-code">Mã vận đơn</label>
            <input class="field__input" id="hero-code" placeholder="Nhập mã vận đơn, ví dụ VD0001" autocomplete="off">
            <button class="btn btn--accent" type="submit">${icon('search')} Tra cứu</button>
          </form>
          <p class="hero__samples">Thử mã mẫu: <a href="#/track?code=VD0001">VD0001</a> · <a href="#/track?code=VD0005">VD0005</a> · <a href="#/track?code=VD0006">VD0006</a></p>
          <div class="hero__art" aria-hidden="true"></div>
          <div class="hero__road"></div>${icon('truck', 'hero__truck')}
        </section>
        <section class="grid grid--3">${features.map(f => `<article class="card feature">${icon(f[0], 'feature__icon')}<h2>${f[1]}</h2><p class="muted">${f[2]}</p></article>`).join('')}</section>
        <section class="card mt-4"><h2>Dành cho ai?</h2>
          <p class="muted">Hệ thống có 7 vai trò: Admin, Quản lý kho, Nhân viên kho, Điều phối vận chuyển, Tài xế, Khách hàng và Khách vãng lai. Đăng nhập bằng tài khoản demo để trải nghiệm từng vai trò.</p>
          <a class="btn" href="#/login">Đăng nhập demo</a></section>`;
      root.querySelector('#hero-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const code = root.querySelector('#hero-code').value.trim();
        WMS.router.go('/track' + (code ? '?code=' + encodeURIComponent(code) : ''));
      });
    }
  };

  // ---------- Tra cứu vận đơn (khách vãng lai) ----------
  const STAGE = { pending: 0, approved: 1, packed: 2, assigned: 2, delivering: 3, failed: 3, delivered: 4, returned: 4 };
  const STEPS = ['Tạo đơn', 'Đã duyệt', 'Đóng gói', 'Đang giao', 'Hoàn tất'];

  // ---------- Sơ đồ tuyến (SVG trừu tượng: kho → điểm giao) ----------
  // Đường cong Bezier bậc 3 trong khung 600x150. Xe tải đặt theo tỉ lệ độ dài đường đi (không phải tham số t),
  // nên ta lấy mẫu đường cong để quy đổi "đi được bao nhiêu phần trăm" ra tọa độ.
  const ROUTE_P = [[40, 112], [170, -10], [330, 170], [560, 38]];
  const bez = (t) => {
    const u = 1 - t, [p0, p1, p2, p3] = ROUTE_P;
    return [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
  };
  function pointAt(fraction) {
    const N = 120, pts = [bez(0)], cum = [0];
    for (let i = 1; i <= N; i++) { const q = bez(i / N), p = pts[i - 1]; pts.push(q); cum.push(cum[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); }
    const goal = cum[N] * fraction;
    let i = 1; while (i < N && cum[i] < goal) i++;
    const k = (goal - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  }
  // Tỉ lệ quãng đường theo trạng thái. Giao thất bại: dừng giữa đường; hoàn hàng: quay về kho.
  const PROGRESS = { pending: 0, approved: 0, packed: 0, assigned: 0.12, delivering: 0.55, failed: 0.8, delivered: 1, returned: 0 };

  function routeMapHtml(s) {
    if (s.status === 'cancelled') return '';
    const wh = (store.byId('warehouses', s.warehouseId) || {}).name || 'Kho';
    const city = s.receiver.address.split(',').pop().trim();
    const f = PROGRESS[s.status], [x, y] = pointAt(f);
    const label = `Sơ đồ tuyến từ ${wh} đến ${city}. Trạng thái hiện tại: ${WMS.STATUS[s.status].label}`;
    const d = `M${ROUTE_P[0]} C${ROUTE_P[1]} ${ROUTE_P[2]} ${ROUTE_P[3]}`;
    const tone = s.status === 'failed' ? 'danger' : (s.status === 'delivered' ? 'success' : 'accent');
    return `<figure class="routemap" role="img" aria-label="${esc(label)}">
      <svg viewBox="0 0 600 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path class="routemap__road" d="${d}" pathLength="100"/>
        <path class="routemap__done" d="${d}" pathLength="100" stroke-dasharray="${(f * 100).toFixed(1)} 100"/>
        <circle class="routemap__node routemap__node--start" cx="${ROUTE_P[0][0]}" cy="${ROUTE_P[0][1]}" r="11"/>
        <circle class="routemap__node routemap__node--end ${f === 1 ? 'routemap__node--reached' : ''}" cx="${ROUTE_P[3][0]}" cy="${ROUTE_P[3][1]}" r="11"/>
        <g class="routemap__truck routemap__truck--${tone}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
          <circle r="19"/><path d="M-10 -5h12v9h-12zM2 -2h6l4 4v2h-10z M-6 6.5a2 2 0 100 .1M6 6.5a2 2 0 100 .1" />
        </g>
      </svg>
      <figcaption class="routemap__labels"><span><strong>Kho xuất</strong> ${esc(wh)}</span><span><strong>Điểm giao</strong> ${esc(city)}</span></figcaption>
    </figure>`;
  }

  function resultHtml(s) {
    const route = store.byId('routes', s.routeId);
    const idx = STAGE[s.status];
    const stepper = s.status === 'cancelled' ? '' : `<div class="stepper" aria-label="Tiến độ vận đơn">
        <div class="stepper__line"><div class="stepper__fill" style="width:${idx / 4 * 100}%"></div></div>
        ${icon('truck', 'stepper__truck').replace('class="icon', `style="left:calc(10% + ${idx * 20}%)" class="icon`)}
        ${STEPS.map((t, i) => `<div class="stepper__step ${i <= idx ? 'stepper__step--done' : ''}">${t}</div>`).join('')}</div>`;
    const city = s.receiver.address.split(',').pop().trim(); // chỉ hiện tỉnh/thành, ẩn địa chỉ chi tiết
    const driver = s.driverId ? store.byId('users', s.driverId) : null;
    return `<div class="card mt-4">
      <div class="page-head page-head--tight"><div><h2 class="mono m-0">${esc(s.code)}</h2><span class="muted">${esc(route.name)}</span></div>${badge(s.status)}</div>
      ${stepper}
      ${routeMapHtml(s)}
      <dl class="info-list">
        <div><dt>Người gửi</dt><dd>${esc(s.sender.name)}</dd></div>
        <div><dt>Người nhận</dt><dd>${esc(s.receiver.name)} · ${esc(maskPhone(s.receiver.phone))}</dd></div>
        <div><dt>Giao đến</dt><dd>${esc(city)}</dd></div>
        <div><dt>Dự kiến giao trước</dt><dd>${date(s.dueAt)}</dd></div>
        <div><dt>Hàng hóa</dt><dd>${esc(s.desc)} (${s.weight} kg)</dd></div>
        <div><dt>Thu hộ COD</dt><dd>${s.cod ? money(s.cod) : 'Không'}</dd></div>
        ${driver ? `<div><dt>Tài xế</dt><dd>${esc(driver.name)}</dd></div>` : ''}
      </dl>
      <h3>Hành trình</h3>
      <ol class="timeline">${s.history.slice().reverse().map(h => `<li class="timeline__item"><strong>${WMS.STATUS[h.status].label}</strong><div>${esc(h.note)}</div><div class="timeline__time">${dt(h.time)}</div></li>`).join('')}</ol>
    </div>`;
  }

  WMS.pages['/track'] = {
    title: 'Tra cứu vận đơn',
    render(root, params) {
      const code = (params.code || '').trim();
      let result = '';
      if (code) {
        const s = store.track(code);
        result = s ? resultHtml(s) : `<div class="card mt-4" role="alert"><h2>Không tìm thấy vận đơn</h2><p class="muted">Không có vận đơn nào với mã "${esc(code)}". Hãy kiểm tra lại mã (ví dụ: VD0001).</p></div>`;
      }
      root.innerHTML = `${WMS.ui.pageHead('Tra cứu hành trình vận đơn', 'Nhập mã vận đơn để xem trạng thái, không cần đăng nhập.')}
        <form class="card hero__form hero__form--full" id="track-form" role="search">
          <label class="sr-only" for="track-code">Mã vận đơn</label>
          <input class="field__input" id="track-code" value="${esc(code)}" placeholder="Ví dụ: VD0001" autocomplete="off">
          <button class="btn" type="submit">${icon('search')} Tra cứu</button>
        </form>${result}`;
      root.querySelector('#track-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const c = root.querySelector('#track-code').value.trim();
        if (!c) { toast('Vui lòng nhập mã vận đơn', 'error'); return; }
        WMS.router.go('/track?code=' + encodeURIComponent(c));
      });
    }
  };

  // ---------- Đăng nhập ----------
  function afterLogin(user, next) {
    const target = next && WMS.pages[next] && (WMS.pages[next].roles === '*' || (WMS.pages[next].roles || []).includes(user.role)) ? next : WMS.HOME[user.role];
    toast('Xin chào ' + user.name, 'success');
    WMS.router.go(target);
  }
  const LOGIN_FIELDS = [
    { name: 'username', label: 'Tên đăng nhập', required: true, wide: true, autocomplete: 'username' },
    { name: 'password', label: 'Mật khẩu', type: 'password', required: true, wide: true, autocomplete: 'current-password' }
  ];
  WMS.pages['/login'] = {
    title: 'Đăng nhập',
    render(root, params) {
      const demos = store.all('users').map(u => `<button class="btn btn--ghost btn--sm" data-action="demo.login" data-u="${u.username}" data-next="${esc(params.next || '')}">${WMS.ROLES[u.role]}</button>`).join('');
      root.innerHTML = `<div class="card auth-box"><h1>Đăng nhập</h1>
        <form id="login-form" novalidate>${WMS.ui.fieldsHtml(LOGIN_FIELDS)}<button class="btn btn--block" type="submit">Đăng nhập</button></form>
        <p class="mt-4">Chưa có tài khoản? <a href="#/register">Đăng ký khách hàng</a></p>
        <hr><h3>Đăng nhập nhanh bằng tài khoản demo</h3>
        <p class="muted">Mật khẩu demo của mọi tài khoản: <span class="mono">123456</span></p><div class="demo-accounts">${demos}</div></div>`;
      WMS.ui.bind(root.querySelector('#login-form'), LOGIN_FIELDS, (v) => {
        const r = store.login(v.username, v.password);
        if (r.error) return r.error;
        afterLogin(r.user, params.next);
      });
    }
  };
  WMS.actions['demo.login'] = (el) => {
    const r = store.login(el.dataset.u, '123456');
    if (r.error) toast(r.error, 'error'); else afterLogin(r.user, el.dataset.next);
  };

  // ---------- Đăng ký ----------
  const REGISTER_FIELDS = [
    { name: 'name', label: 'Họ và tên', required: true, wide: true, minlength: 2, autocomplete: 'name' },
    { name: 'username', label: 'Tên đăng nhập', required: true, pattern: WMS.RE.username, patternMsg: 'Tên đăng nhập 4-20 ký tự: chữ thường, số hoặc _', help: 'Chữ thường không dấu, 4-20 ký tự' },
    { name: 'phone', label: 'Số điện thoại', type: 'tel', required: true, pattern: WMS.RE.phone, patternMsg: 'Số điện thoại không hợp lệ (ví dụ 0912345678)' },
    { name: 'email', label: 'Email', type: 'email', required: true, wide: true, pattern: WMS.RE.email, patternMsg: 'Email không hợp lệ' },
    { name: 'password', label: 'Mật khẩu', type: 'password', required: true, minlength: 6, autocomplete: 'new-password' },
    { name: 'confirm', label: 'Nhập lại mật khẩu', type: 'password', required: true, autocomplete: 'new-password', validate: (x, v) => x !== v.password ? 'Mật khẩu nhập lại không khớp' : '' }
  ];
  WMS.pages['/register'] = {
    title: 'Đăng ký',
    render(root) {
      root.innerHTML = `<div class="card auth-box auth-box--wide"><h1>Đăng ký khách hàng</h1>
        <form id="reg-form" novalidate class="form-grid">${WMS.ui.fieldsHtml(REGISTER_FIELDS)}<button class="btn btn--block field--wide" type="submit">Tạo tài khoản</button></form>
        <p class="mt-4">Đã có tài khoản? <a href="#/login">Đăng nhập</a></p></div>`;
      WMS.ui.bind(root.querySelector('#reg-form'), REGISTER_FIELDS, (v) => {
        const r = store.register(v);
        if (r.error) return r.error;
        store.login(v.username, v.password);
        afterLogin(r.user);
      });
    }
  };

  // ---------- Hồ sơ cá nhân (mọi vai trò đã đăng nhập) ----------
  WMS.pages['/profile'] = {
    title: 'Hồ sơ cá nhân', roles: '*',
    render(root, params, user) {
      const pf = [
        { name: 'name', label: 'Họ và tên', required: true, wide: true, minlength: 2 },
        { name: 'phone', label: 'Số điện thoại', type: 'tel', required: true, pattern: WMS.RE.phone, patternMsg: 'Số điện thoại không hợp lệ', wide: true },
        { name: 'email', label: 'Email', type: 'email', required: true, pattern: WMS.RE.email, patternMsg: 'Email không hợp lệ', wide: true }
      ];
      const pw = [
        { name: 'current', label: 'Mật khẩu hiện tại', type: 'password', required: true, wide: true },
        { name: 'next', label: 'Mật khẩu mới', type: 'password', required: true, minlength: 6, wide: true },
        { name: 'confirm', label: 'Nhập lại mật khẩu mới', type: 'password', required: true, wide: true, validate: (x, v) => x !== v.next ? 'Mật khẩu nhập lại không khớp' : '' }
      ];
      root.innerHTML = `${WMS.ui.pageHead('Hồ sơ cá nhân', `${user.username} · ${WMS.ROLES[user.role]}`)}
        <div class="grid grid--2">
          <section class="card"><h2>Thông tin liên hệ</h2><form id="pf-form" novalidate>${WMS.ui.fieldsHtml(pf, user)}<button class="btn" type="submit">Lưu thay đổi</button></form></section>
          <section class="card"><h2>Đổi mật khẩu</h2><form id="pw-form" novalidate>${WMS.ui.fieldsHtml(pw)}<button class="btn" type="submit">Đổi mật khẩu</button></form></section>
        </div>`;
      WMS.ui.bind(root.querySelector('#pf-form'), pf, (v) => {
        store.updateUser(user.id, { name: v.name, phone: v.phone, email: v.email });
        store.audit('Cập nhật hồ sơ', user.username + ' cập nhật hồ sơ');
        toast('Đã lưu hồ sơ', 'success'); WMS.router.refresh();
      });
      WMS.ui.bind(root.querySelector('#pw-form'), pw, (v) => {
        if (v.current !== user.password) return 'Mật khẩu hiện tại không đúng';
        store.updateUser(user.id, { password: v.next });
        store.audit('Đổi mật khẩu', user.username + ' đổi mật khẩu');
        toast('Đã đổi mật khẩu', 'success'); WMS.router.refresh();
      });
    }
  };
})();
