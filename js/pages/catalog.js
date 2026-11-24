/* Danh mục (kho, vị trí, sản phẩm, nhà cung cấp, bảng cước) – dùng một bộ CRUD chung cấu hình bằng object */
(function () {
  const { esc, money, toast, table, form, confirmDialog } = WMS.ui;
  const store = WMS.store;
  const whOptions = () => store.all('warehouses').map(w => [w.id, w.name]);
  const whName = (id) => (store.byId('warehouses', id) || {}).name || '';

  // ---------- Hình ảnh hàng hóa ----------
  // Ảnh được thu nhỏ (tối đa 320px, JPEG) rồi lưu dạng data URL trong localStorage để file nhẹ
  const IMG_MAX_PX = 320, IMG_MAX_FILE = 5 * 1024 * 1024;

  // Ảnh nhỏ trong bảng; bấm vào để xem ảnh lớn. Chưa có ảnh thì hiện khung trống.
  WMS.productThumb = function (p) {
    if (!p) return '';
    const inner = p.image ? `<img src="${p.image}" alt="${esc(p.name)}" loading="lazy">` : WMS.ui.icon('box');
    return `<button type="button" class="thumb ${p.image ? '' : 'thumb--empty'}" data-action="product.view" data-id="${p.id}" aria-label="Xem hình ${esc(p.name)}">${inner}</button>`;
  };
  WMS.actions['product.view'] = (el) => {
    const p = store.byId('products', el.dataset.id);
    if (!p) return;
    WMS.ui.modal({
      title: p.name,
      body: `<div class="product-view">${p.image ? `<img class="product-view__img" src="${p.image}" alt="${esc(p.name)}">` : `<div class="product-view__img product-view__img--empty">${WMS.ui.icon('box')}<span>Chưa có hình ảnh</span></div>`}
        <dl class="product-view__info"><dt>SKU</dt><dd>${esc(p.sku)}</dd><dt>Đơn vị tính</dt><dd>${esc(p.unit)}</dd><dt>Đơn giá</dt><dd>${money(p.price)}</dd><dt>Tồn tối thiểu</dt><dd>${p.minStock}</dd></dl></div>`,
      footer: '<button class="btn btn--ghost" data-action="modal.close">Đóng</button>'
    });
  };

  // Đọc file ảnh → thu nhỏ → trả về data URL (Promise). Lỗi trả về Error có thông báo tiếng Việt.
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return reject(new Error('Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF'));
      if (file.size > IMG_MAX_FILE) return reject(new Error('Ảnh quá lớn (tối đa 5 MB)'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('File không phải ảnh hợp lệ'));
        img.onload = () => {
          const scale = Math.min(1, IMG_MAX_PX / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // nền trắng cho ảnh PNG trong suốt
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.75));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Ô chọn ảnh trong form sản phẩm. Ảnh hiện tại giữ ở el._image (rỗng = không có ảnh).
  const imagePickerField = {
    type: 'custom',
    html: `<div class="field__label">Hình ảnh (không bắt buộc)</div>
      <div class="imgpick"><div class="imgpick__preview" aria-live="polite"></div>
        <div class="imgpick__ctrl"><input type="file" class="field__input" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Chọn hình ảnh sản phẩm">
          <button type="button" class="btn btn--ghost btn--sm" data-action="img.clear">Xóa ảnh</button>
          <span class="field__error imgpick__err" role="alert"></span></div></div>`
  };
  function mountImagePicker(el, item) {
    const prev = el.querySelector('.imgpick__preview'), err = el.querySelector('.imgpick__err');
    el._image = (item && item.image) || '';
    const draw = () => { prev.innerHTML = el._image ? `<img src="${el._image}" alt="Xem trước hình sản phẩm">` : `<span class="muted">Chưa có ảnh</span>`; };
    draw();
    el.querySelector('input[type=file]').addEventListener('change', (e) => {
      const f = e.target.files[0];
      err.textContent = '';
      if (!f) return;
      resizeImage(f).then((url) => { el._image = url; draw(); })
        .catch((ex) => { err.textContent = ex.message; e.target.value = ''; });
    });
    el.querySelector('[data-action="img.clear"]').addEventListener('click', () => { el._image = ''; el.querySelector('input[type=file]').value = ''; err.textContent = ''; draw(); });
  }
  WMS.actions['img.clear'] = () => {}; // xử lý riêng trong mountImagePicker

  // Mỗi cấu hình: col (tên mảng trong db), prefix (tiền tố mã), fields (form), cols (cột bảng),
  // unique(v, id) → thông báo nếu trùng, inUse(item) → thông báo nếu không được xóa
  const CFG = {
    warehouses: {
      label: 'kho', prefix: 'W',
      fields: [{ name: 'name', label: 'Tên kho', required: true, wide: true }, { name: 'address', label: 'Địa chỉ', required: true, wide: true }],
      cols: [{ label: 'Mã', key: 'id' }, { label: 'Tên kho', key: 'name' }, { label: 'Địa chỉ', key: 'address' }],
      inUse: (w) => store.db.stock.some(s => s.warehouseId === w.id && s.qty > 0) ? 'Kho còn hàng tồn, không thể xóa'
        : (store.db.routes.some(r => r.warehouseId === w.id) ? 'Kho đang được dùng cho tuyến vận chuyển' : '')
    },
    locations: {
      label: 'vị trí', prefix: 'L',
      fields: [{ name: 'warehouseId', label: 'Kho', type: 'select', options: whOptions, required: true }, { name: 'code', label: 'Mã vị trí (ví dụ A1-01)', required: true, pattern: /^[A-Za-z0-9-]{2,12}$/, patternMsg: 'Mã gồm chữ, số, dấu gạch (2-12 ký tự)' }],
      cols: [{ label: 'Mã', key: 'id' }, { label: 'Kho', render: (l) => esc(whName(l.warehouseId)) }, { label: 'Vị trí', key: 'code' }],
      unique: (v, id) => store.db.locations.some(l => l.id !== id && l.warehouseId === v.warehouseId && l.code.toLowerCase() === v.code.toLowerCase()) ? 'Vị trí này đã tồn tại trong kho' : '',
      inUse: (l) => store.db.stock.some(s => s.locationId === l.id && s.qty > 0) ? 'Vị trí đang chứa hàng' : ''
    },
    products: {
      label: 'sản phẩm', prefix: 'P',
      fields: [
        { name: 'sku', label: 'Mã SKU', required: true, pattern: /^[A-Za-z0-9-]{2,15}$/, patternMsg: 'SKU gồm chữ, số, dấu gạch (2-15 ký tự)' },
        { name: 'name', label: 'Tên sản phẩm', required: true },
        { name: 'unit', label: 'Đơn vị tính', required: true },
        { name: 'minStock', label: 'Tồn tối thiểu (cảnh báo)', type: 'number', required: true, min: 0, integer: true },
        { name: 'price', label: 'Đơn giá (₫)', type: 'number', required: true, min: 0 },
        imagePickerField
      ],
      onMount: mountImagePicker,
      collect: (el) => ({ image: el._image || '' }),
      cols: [{ label: 'Hình', render: (p) => WMS.productThumb(p) }, { label: 'SKU', key: 'sku' }, { label: 'Tên sản phẩm', key: 'name' }, { label: 'ĐVT', key: 'unit' }, { label: 'Tồn tối thiểu', key: 'minStock', cls: 'text-right' }, { label: 'Đơn giá', render: (p) => money(p.price), cls: 'text-right' }],
      unique: (v, id) => store.db.products.some(p => p.id !== id && p.sku.toLowerCase() === v.sku.toLowerCase()) ? 'Mã SKU đã tồn tại' : '',
      inUse: (p) => store.db.stock.some(s => s.productId === p.id && s.qty > 0) ? 'Sản phẩm còn tồn kho, không thể xóa' : ''
    },
    suppliers: {
      label: 'nhà cung cấp', prefix: 'S',
      fields: [{ name: 'name', label: 'Tên nhà cung cấp', required: true, wide: true }, { name: 'phone', label: 'Điện thoại', type: 'tel', required: true, pattern: WMS.RE.phone, patternMsg: 'Số điện thoại không hợp lệ' }, { name: 'address', label: 'Địa chỉ', required: true }],
      cols: [{ label: 'Mã', key: 'id' }, { label: 'Tên', key: 'name' }, { label: 'Điện thoại', key: 'phone' }, { label: 'Địa chỉ', key: 'address' }],
      inUse: (s) => store.db.receipts.some(r => r.supplierId === s.id) ? 'Nhà cung cấp đã có phiếu nhập' : ''
    },
    rates: {
      label: 'bảng giá cước', prefix: 'R',
      fields: [
        { name: 'name', label: 'Tên dịch vụ', required: true, wide: true },
        { name: 'base', label: 'Cước 1kg đầu (₫)', type: 'number', required: true, min: 0 },
        { name: 'perKg', label: 'Mỗi kg tiếp theo (₫)', type: 'number', required: true, min: 0 },
        { name: 'sla', label: 'Thời gian giao (ngày)', type: 'number', required: true, min: 1, max: 30, integer: true }
      ],
      cols: [{ label: 'Dịch vụ', key: 'name' }, { label: 'Cước 1kg đầu', render: (r) => money(r.base), cls: 'text-right' }, { label: 'Mỗi kg tiếp', render: (r) => money(r.perKg), cls: 'text-right' }, { label: 'Giao trong', render: (r) => r.sla + ' ngày' }],
      inUse: (r) => store.db.shipments.some(s => s.rateId === r.id) ? 'Bảng cước đã được dùng cho vận đơn' : ''
    },
    routes: {
      label: 'tuyến vận chuyển', prefix: 'T',
      fields: [{ name: 'name', label: 'Tên tuyến', required: true, wide: true }, { name: 'warehouseId', label: 'Kho xuất phát', type: 'select', options: whOptions, required: true, wide: true }],
      cols: [{ label: 'Mã', key: 'id' }, { label: 'Tên tuyến', key: 'name' }, { label: 'Kho xuất phát', render: (r) => esc(whName(r.warehouseId)) }],
      inUse: (r) => store.db.shipments.some(s => s.routeId === r.id) ? 'Tuyến đã có vận đơn' : ''
    }
  };

  // Vẽ bảng + nút thêm cho một danh mục vào chuỗi HTML
  WMS.crudHtml = function (col) {
    const cfg = CFG[col];
    const actions = (r) => `<div class="table__actions"><button class="btn btn--ghost btn--sm" data-action="crud.edit" data-col="${col}" data-id="${r.id}">Sửa</button><button class="btn btn--ghost btn--sm" data-action="crud.del" data-col="${col}" data-id="${r.id}">Xóa</button></div>`;
    const cols = cfg.cols.concat([{ label: '', render: actions }]);
    return `<div class="card card--flush"><div class="toolbar"><strong class="toolbar__grow">Danh sách ${esc(cfg.label)}</strong><button class="btn btn--sm" data-action="crud.add" data-col="${col}">+ Thêm ${esc(cfg.label)}</button></div>${table(cols, store.all(col))}</div>`;
  };

  WMS.actions['crud.add'] = (el) => {
    const cfg = CFG[el.dataset.col], col = el.dataset.col;
    form({
      title: 'Thêm ' + cfg.label, fields: cfg.fields,
      onMount: cfg.onMount ? (el) => cfg.onMount(el, null) : undefined,
      onSubmit(v, el) {
        if (cfg.collect) Object.assign(v, cfg.collect(el));
        const dup = cfg.unique && cfg.unique(v, null);
        if (dup) return dup;
        store.insert(col, cfg.prefix, v, cfg.label);
        toast('Đã thêm ' + cfg.label, 'success'); WMS.router.refresh();
      }
    });
  };
  WMS.actions['crud.edit'] = (el) => {
    const cfg = CFG[el.dataset.col], col = el.dataset.col, id = el.dataset.id;
    form({
      title: 'Sửa ' + cfg.label, fields: cfg.fields, values: store.byId(col, id),
      onMount: cfg.onMount ? (el) => cfg.onMount(el, store.byId(col, id)) : undefined,
      onSubmit(v, el) {
        if (cfg.collect) Object.assign(v, cfg.collect(el));
        const dup = cfg.unique && cfg.unique(v, id);
        if (dup) return dup;
        store.update(col, id, v, cfg.label);
        toast('Đã cập nhật', 'success'); WMS.router.refresh();
      }
    });
  };
  WMS.actions['crud.del'] = (el) => {
    const cfg = CFG[el.dataset.col], col = el.dataset.col, id = el.dataset.id;
    const why = cfg.inUse && cfg.inUse(store.byId(col, id)); // chặn xóa nếu dữ liệu đang được dùng
    if (why) { toast(why, 'error'); return; }
    confirmDialog('Xóa ' + cfg.label + ' này?', () => { store.remove(col, id, cfg.label); toast('Đã xóa', 'success'); WMS.router.refresh(); }, { danger: true, yesText: 'Xóa' });
  };

  // ---------- Trang Danh mục: tab hiển thị theo vai trò ----------
  const TABS = {
    admin: [['warehouses', 'Kho'], ['locations', 'Vị trí'], ['products', 'Sản phẩm'], ['suppliers', 'Nhà cung cấp'], ['rates', 'Bảng giá cước']],
    wm: [['warehouses', 'Kho'], ['locations', 'Vị trí'], ['products', 'Sản phẩm'], ['suppliers', 'Nhà cung cấp']],
    dispatcher: [['rates', 'Bảng giá cước']]
  };
  WMS.pages['/catalog'] = {
    title: 'Danh mục', roles: ['admin', 'wm', 'dispatcher'],
    render(root, params, user) {
      const items = TABS[user.role];
      let tab = WMS.ui.getTab('catalog', items[0][0]);
      if (!items.some(i => i[0] === tab)) tab = items[0][0];
      root.innerHTML = WMS.ui.pageHead('Danh mục', 'Dữ liệu nền dùng cho kho và vận chuyển') + WMS.ui.tabs('catalog', items, tab) + WMS.crudHtml(tab);
    }
  };
})();
