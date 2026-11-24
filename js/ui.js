/* Tiện ích giao diện dùng chung: escape HTML, định dạng, icon, modal, form + validation, bảng, biểu đồ */
WMS.RE = { phone: /^(0|\+84)\d{9,10}$/, email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, username: /^[a-z0-9_]{4,20}$/ };

WMS.ui = (function () {
  // Escape mọi dữ liệu người dùng trước khi chèn vào HTML (chống XSS)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => Number(n || 0).toLocaleString('vi-VN') + ' ₫';
  const pad = (n) => String(n).padStart(2, '0');
  const date = (t) => { const d = new Date(t); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const dt = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())} ${date(t)}`; };
  const maskPhone = (p) => p.length > 6 ? p.slice(0, 4) + '***' + p.slice(-3) : p;

  const ICONS = {
    truck: '<path d="M3 6h11v10H3zM14 9h4l3 3.5V16h-7zM7 20a2 2 0 100-4 2 2 0 000 4zM17 20a2 2 0 100-4 2 2 0 000 4z"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    file: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8zM7.5 8.5h.01"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
    users: '<path d="M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-2a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8"/>',
    bell: '<path d="M18 16v-5a6 6 0 10-12 0v5l-2 2h16zM10 21h4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    user: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>',
    qr: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v7M14 20h3"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'
  };
  const icon = (name, cls) => `<svg class="icon ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const badge = (status) => { const s = WMS.STATUS[status]; return `<span class="badge badge--${s.tone}">${s.label}</span>`; };
  const tone = (label, t) => `<span class="badge badge--${t}">${esc(label)}</span>`;

  // ---------- Toast ----------
  function toast(msg, type) {
    let box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts'; box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast--' + type : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ---------- Modal ----------
  function closeModal() { const m = document.querySelector('.modal'); if (m) m.remove(); }
  function modal(o) {
    closeModal();
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="modal__box ${o.size === 'lg' ? 'modal__box--lg' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal__head"><h2 id="modal-title">${esc(o.title)}</h2><button class="icon-btn" data-action="modal.close" aria-label="Đóng">${icon('x')}</button></div>
      <div class="modal__body">${o.body}</div>${o.footer ? `<div class="modal__foot">${o.footer}</div>` : ''}</div>`;
    document.body.appendChild(el);
    el.addEventListener('mousedown', (e) => { if (e.target === el) closeModal(); });
    const first = el.querySelector('input:not([type=hidden]), select, textarea, .btn');
    if (first) first.focus();
    if (o.onMount) o.onMount(el);
    return el;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  let confirmYes = null;
  function confirmDialog(message, onYes, opts) {
    opts = opts || {};
    confirmYes = onYes;
    modal({
      title: opts.title || 'Xác nhận', body: `<p>${esc(message)}</p>`,
      footer: `<button class="btn btn--ghost" data-action="modal.close">Hủy</button>
               <button class="btn ${opts.danger ? 'btn--danger' : ''}" data-action="confirm.yes">${esc(opts.yesText || 'Đồng ý')}</button>`
    });
  }
  WMS.actions['modal.close'] = closeModal;
  WMS.actions['confirm.yes'] = () => { const fn = confirmYes; closeModal(); if (fn) fn(); };

  // ---------- Form có validation ----------
  function fieldHtml(f, val) {
    const id = 'f-' + (f.name || Math.random().toString(36).slice(2, 7));
    const cls = 'field' + (f.wide ? ' field--wide' : '') + (f.type === 'checkbox' ? ' field--check' : '');
    if (f.type === 'custom') return `<div class="field--wide">${f.html}</div>`;
    const req = f.required ? ' <span class="field__req" aria-hidden="true">*</span>' : '';
    let input;
    const common = `id="${id}" name="${f.name}" class="field__input" ${f.required ? 'aria-required="true"' : ''} ${f.disabled ? 'disabled' : ''}`;
    if (f.type === 'select') {
      const opts = (typeof f.options === 'function' ? f.options() : f.options).map(o => `<option value="${esc(o[0])}" ${String(val) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('');
      input = `<select ${common}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${opts}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea ${common} rows="3" maxlength="${f.maxlength || 300}">${esc(val)}</textarea>`;
    } else if (f.type === 'checkbox') {
      input = `<input type="checkbox" ${common} ${val ? 'checked' : ''}>`;
    } else {
      input = `<input type="${f.type || 'text'}" ${common} value="${esc(val)}" ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} placeholder="${esc(f.placeholder || '')}" autocomplete="${f.autocomplete || 'off'}">`;
    }
    const label = f.type === 'checkbox' ? '' : `<label class="field__label" for="${id}">${esc(f.label)}${req}</label>`;
    const checkLabel = f.type === 'checkbox' ? `<label class="field__label" for="${id}">${esc(f.label)}</label>` : '';
    return `<div class="${cls}" data-field="${f.name}">${label}${input}${checkLabel}${f.help ? `<span class="field__help">${esc(f.help)}</span>` : ''}<span class="field__error" id="err-${f.name}" role="alert"></span></div>`;
  }

  function readValues(form, fields) {
    const v = {};
    fields.forEach(f => {
      if (f.type === 'custom') return;
      const el = form.elements[f.name];
      if (!el) return;
      if (f.type === 'checkbox') v[f.name] = el.checked;
      else if (f.type === 'number') v[f.name] = el.value === '' ? NaN : parseFloat(el.value);
      else v[f.name] = el.value.trim();
    });
    return v;
  }
  // Trả về object { tênTrường: 'thông báo lỗi' }
  function validate(fields, v) {
    const errs = {};
    fields.forEach(f => {
      if (f.type === 'custom') return;
      const x = v[f.name];
      const empty = x === '' || x === undefined || (typeof x === 'number' && isNaN(x)) || (f.type === 'checkbox' && f.required && !x);
      if (f.required && empty) { errs[f.name] = f.type === 'checkbox' ? 'Bạn cần xác nhận mục này' : 'Vui lòng nhập ' + f.label.toLowerCase(); return; }
      if (empty) return;
      if (f.type === 'number') {
        if (f.min != null && x < f.min) errs[f.name] = `${f.label} phải từ ${f.min} trở lên`;
        else if (f.max != null && x > f.max) errs[f.name] = `${f.label} không vượt quá ${f.max}`;
        else if (f.integer && !Number.isInteger(x)) errs[f.name] = `${f.label} phải là số nguyên`;
      }
      if (!errs[f.name] && f.pattern && !f.pattern.test(x)) errs[f.name] = f.patternMsg || `${f.label} không hợp lệ`;
      if (!errs[f.name] && f.minlength && x.length < f.minlength) errs[f.name] = `${f.label} tối thiểu ${f.minlength} ký tự`;
      if (!errs[f.name] && f.validate) { const m = f.validate(x, v); if (m) errs[f.name] = m; }
    });
    return errs;
  }
  // Gắn kiểm tra hợp lệ cho một <form>. handler(values) trả về chuỗi lỗi hoặc rỗng nếu thành công.
  function bind(formEl, fields, handler) {
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = readValues(formEl, fields);
      const errs = validate(fields, values);
      formEl.querySelectorAll('.field').forEach(d => { d.classList.remove('field--error'); d.querySelector('.field__error').textContent = ''; });
      const names = Object.keys(errs);
      names.forEach(n => {
        const box = formEl.querySelector(`[data-field="${n}"]`);
        box.classList.add('field--error');
        box.querySelector('.field__error').textContent = errs[n];
      });
      if (names.length) { formEl.elements[names[0]].focus(); return; }
      const alertBox = formEl.querySelector('.form-alert');
      const msg = handler(values, formEl);
      if (msg) { alertBox.textContent = msg; alertBox.classList.remove('hidden'); } else alertBox.classList.add('hidden');
    });
  }
  const fieldsHtml = (fields, v) => '<div class="form-alert field--wide hidden" role="alert"></div>' + fields.map(f => fieldHtml(f, (v || {})[f.name])).join('');
  function form(cfg) {
    const body = `<form id="modal-form" novalidate class="form-grid">${fieldsHtml(cfg.fields, cfg.values)}</form>`;
    const el = modal({
      title: cfg.title, body, size: cfg.size,
      footer: `<button class="btn btn--ghost" data-action="modal.close">Hủy</button><button class="btn" type="submit" form="modal-form">${esc(cfg.submitText || 'Lưu')}</button>`,
      onMount: cfg.onMount
    });
    bind(el.querySelector('form'), cfg.fields, (values) => {
      const msg = cfg.onSubmit(values, el);
      if (!msg) closeModal();
      return msg;
    });
    return el;
  }

  // ---------- Bảng (mobile tự chuyển thành thẻ nhờ data-label) ----------
  function table(cols, rows, emptyMsg) {
    if (!rows.length) return `<div class="table__empty">${esc(emptyMsg || 'Chưa có dữ liệu')}</div>`;
    const head = cols.map(c => `<th scope="col" class="${c.cls || ''}">${esc(c.label)}</th>`).join('');
    const body = rows.map(r => '<tr>' + cols.map(c => `<td data-label="${esc(c.label)}" class="${c.cls || ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('') + '</tr>').join('');
    return `<div class="table-wrap"><table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  // ---------- Tab, filter, KPI, biểu đồ ----------
  WMS.state.tabs = {};
  const getTab = (key, def) => WMS.state.tabs[key] || def;
  function tabs(key, items, active) {
    return `<div class="tabs" role="tablist">${items.map(i => `<button role="tab" aria-selected="${i[0] === active}" class="tabs__btn ${i[0] === active ? 'tabs__btn--active' : ''}" data-action="tab" data-key="${key}" data-tab="${i[0]}">${esc(i[1])}</button>`).join('')}</div>`;
  }
  WMS.actions.tab = (el) => { WMS.state.tabs[el.dataset.key] = el.dataset.tab; WMS.router.refresh(); };

  const fv = (key, name) => (WMS.state.filters[key] || {})[name] || '';
  // Ô lọc/tìm kiếm: giá trị được nhớ trong WMS.state.filters để không mất khi vẽ lại trang
  function filterBar(key, list) {
    return '<div class="toolbar">' + list.map(f => {
      const val = fv(key, f.name);
      if (f.kind === 'select') {
        return `<select class="field__input" data-filter="${f.name}" aria-label="${esc(f.label)}"><option value="">${esc(f.label)}</option>${f.options.map(o => `<option value="${esc(o[0])}" ${val === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
      }
      if (f.kind === 'date') return `<label class="muted">${esc(f.label)} <input type="date" class="field__input" data-filter="${f.name}" value="${esc(val)}"></label>`;
      return `<input type="search" class="field__input toolbar__grow" data-filter="${f.name}" placeholder="${esc(f.label)}" aria-label="${esc(f.label)}" value="${esc(val)}">`;
    }).join('') + '</div>';
  }
  function bindFilters(root, key, draw) {
    WMS.state.filters[key] = WMS.state.filters[key] || {};
    root.querySelectorAll('[data-filter]').forEach(el => {
      el.addEventListener('input', () => { WMS.state.filters[key][el.dataset.filter] = el.value; draw(); });
    });
    draw();
  }
  const kpi = (label, value, t) => `<div class="card kpi ${t ? 'kpi--' + t : ''}"><span class="kpi__label">${esc(label)}</span><span class="kpi__value">${value}</span></div>`;
  function bars(items) {
    const max = Math.max(1, ...items.map(i => i.value));
    return `<div class="bars">${items.map(i => `<div class="bars__row"><span>${esc(i.label)}</span><div class="bars__track"><div class="bars__fill ${i.tone ? 'bars__fill--' + i.tone : ''}" style="width:${(i.value / max * 100).toFixed(1)}%"></div></div><strong>${i.text != null ? esc(i.text) : i.value}</strong></div>`).join('')}</div>`;
  }
  const pageHead = (title, sub, actions) => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="muted page-head__sub">${esc(sub)}</p>` : ''}</div><div class="page-head__actions">${actions || ''}</div></div>`;

  return { esc, money, date, dt, maskPhone, icon, badge, tone, toast, modal, closeModal, confirmDialog, form, bind, fieldsHtml, table, tabs, getTab, filterBar, bindFilters, fv, kpi, bars, pageHead };
})();
