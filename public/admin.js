/* admin.js — Panel de administración del Centro de Ayuda */
const TOKEN_KEY = 'futura_token';
let state = { tree: [], contact: {}, currentId: null, htmlMode: false, user: null };

/* ---------- API ---------- */
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' },
      localStorage.getItem(TOKEN_KEY) ? { Authorization: 'Bearer ' + localStorage.getItem(TOKEN_KEY) } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) { logout(); throw new Error('Sesión expirada'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

/* ---------- Login ---------- */
async function doLogin() {
  const u = document.getElementById('u').value.trim();
  const p = document.getElementById('p').value;
  const err = document.getElementById('loginErr');
  err.textContent = '';
  try {
    const r = await api('POST', '/api/login', { username: u, password: p });
    localStorage.setItem(TOKEN_KEY, r.token);
    state.user = r;
    startApp();
  } catch (e) { err.textContent = e.message; }
}
function logout() {
  localStorage.removeItem(TOKEN_KEY);
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login').classList.remove('hidden');
}
document.getElementById('p').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function startApp() {
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  try { const me = await api('GET', '/api/me'); state.user = me; document.getElementById('who').textContent = me.username + ' · ' + me.role; } catch {}
  await reloadTree();
}

/* ---------- Árbol ---------- */
async function reloadTree() {
  const d = await api('GET', '/api/admin/content');
  state.tree = d.categories; state.contact = d.contact;
  renderTree();
}
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function renderTree() {
  const el = document.getElementById('tree');
  el.innerHTML = state.tree.map((c, ci) => `
    <div class="cat-block">
      <div class="cat-h">
        <span>${c.icon || ''} ${esc(c.title)}</span>
        <span class="mv">
          <span class="mvbtns"><button title="Subir" onclick="moveCat(${ci},-1)">▲</button><button title="Bajar" onclick="moveCat(${ci},1)">▼</button></span>
          <button class="btn sm sec" onclick="editCategory('${c.id}')">✎</button>
          <button class="btn sm sec" onclick="newSection('${c.id}')">+ sec</button>
        </span>
      </div>
      ${c.sections.map((s, si) => `
        <div class="sec-h"><span>${esc(s.name)}</span>
          <span class="mvbtns">
            <button onclick="editSection(${s.id},'${esc(s.name)}')">✎</button>
            <button onclick="newArticle(${s.id})">+ art</button>
          </span></div>
        ${s.articles.map((a, ai) => `
          <div class="art ${state.currentId === a.id ? 'active' : ''}" onclick="openArticle(${a.id})">
            <span class="t">${esc(a.title)}</span>
            <span class="badge ${a.status === 'published' ? 'pub' : 'draft'}">${a.status === 'published' ? 'Publicado' : 'Borrador'}</span>
            <span class="mvbtns"><button onclick="event.stopPropagation();moveArt(${s.id},${ai},-1)">▲</button><button onclick="event.stopPropagation();moveArt(${s.id},${ai},1)">▼</button></span>
          </div>`).join('')}
      `).join('')}
    </div>`).join('');
}

function findArticle(id) {
  for (const c of state.tree) for (const s of c.sections) { const a = s.articles.find(x => x.id === id); if (a) return { c, s, a }; }
  return null;
}

/* ---------- Editor de artículo ---------- */
function sectionOptions(selected) {
  return state.tree.map(c => `<optgroup label="${esc(c.title)}">` +
    c.sections.map(s => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('') +
    `</optgroup>`).join('');
}
function openArticle(id) {
  const f = findArticle(id); if (!f) return;
  state.currentId = id; state.htmlMode = false;
  const a = f.a;
  document.getElementById('main').innerHTML = `
    <div class="ed-head">
      <h2>Editar artículo</h2>
      <span class="badge ${a.status === 'published' ? 'pub' : 'draft'}">${a.status === 'published' ? 'Publicado' : 'Borrador'}</span>
    </div>
    <div class="row2">
      <div><label>Título</label><input type="text" id="fTitle" value="${esc(a.title)}"></div>
      <div><label>Sección</label><select id="fSection">${sectionOptions(a.section_id || f.s.id)}</select></div>
    </div>
    <label>Extracto (resumen corto)</label>
    <input type="text" id="fExcerpt" value="${esc(a.excerpt)}">
    <label>Contenido</label>
    <div class="toolbar">
      <button onclick="exec('bold')"><b>N</b></button>
      <button onclick="exec('italic')"><i>K</i></button>
      <button onclick="fmt('h2')">H2</button>
      <button onclick="fmt('p')">¶</button>
      <button onclick="exec('insertUnorderedList')">• Lista</button>
      <button onclick="exec('insertOrderedList')">1. Lista</button>
      <button onclick="addLink()">🔗 Enlace</button>
      <button onclick="addTable()">▦ Tabla</button>
      <button onclick="addCallout()">💡 Nota</button>
      <button onclick="addPh()">⬛ Placeholder</button>
      <button onclick="toggleHtml()" style="margin-left:auto">&lt;/&gt; HTML</button>
    </div>
    <div class="editor" id="editor" contenteditable="true">${a.body || ''}</div>
    <textarea class="htmlarea hidden" id="htmlarea"></textarea>
    <div class="hint">Consejo: usa el botón Placeholder para marcar datos por confirmar (precios, tiempos, etc.).</div>
    <div class="savebar">
      <button class="btn" onclick="saveArticle()">Guardar</button>
      ${a.status === 'published'
        ? `<button class="btn sec" onclick="setStatus('unpublish')">Despublicar</button>`
        : `<button class="btn sec" onclick="setStatus('publish')">Publicar</button>`}
      <button class="btn danger" onclick="deleteArticle()">Eliminar</button>
      <span class="savedmsg hidden" id="saved">✓ Guardado</span>
    </div>`;
  renderTree();
}
function exec(cmd) { document.getElementById('editor').focus(); document.execCommand(cmd, false, null); }
function fmt(tag) { document.getElementById('editor').focus(); document.execCommand('formatBlock', false, tag); }
function addLink() {
  const slug = prompt('Slug del artículo destino (ej. aprobar-diseno) o URL completa:');
  if (!slug) return;
  const href = slug.startsWith('http') ? slug : ('#/articulo/' + slug);
  document.getElementById('editor').focus();
  document.execCommand('createLink', false, href);
}
function insertHtml(html) {
  const ed = document.getElementById('editor'); ed.focus();
  document.execCommand('insertHTML', false, html);
}
function addTable() { insertHtml('<table><tr><th>Columna A</th><th>Columna B</th></tr><tr><td>Dato</td><td>Dato</td></tr></table><p></p>'); }
function addCallout() { insertHtml('<div class="callout">Escribe aquí una nota destacada.</div><p></p>'); }
function addPh() { insertHtml('<span class="ph">[POR CONFIRMAR]</span>&nbsp;'); }
function toggleHtml() {
  const ed = document.getElementById('editor'), ta = document.getElementById('htmlarea');
  state.htmlMode = !state.htmlMode;
  if (state.htmlMode) { ta.value = ed.innerHTML; ed.classList.add('hidden'); ta.classList.remove('hidden'); }
  else { ed.innerHTML = ta.value; ta.classList.add('hidden'); ed.classList.remove('hidden'); }
}
function currentBody() {
  const ed = document.getElementById('editor'), ta = document.getElementById('htmlarea');
  return state.htmlMode ? ta.value : ed.innerHTML;
}
async function saveArticle() {
  const body = {
    title: document.getElementById('fTitle').value.trim(),
    excerpt: document.getElementById('fExcerpt').value.trim(),
    body: currentBody(),
    section_id: parseInt(document.getElementById('fSection').value, 10)
  };
  await api('PUT', '/api/admin/articles/' + state.currentId, body);
  const s = document.getElementById('saved'); s.classList.remove('hidden'); setTimeout(() => s.classList.add('hidden'), 1800);
  await reloadTree();
}
async function setStatus(action) {
  await api('POST', '/api/admin/articles/' + state.currentId + '/' + action);
  await reloadTree(); openArticle(state.currentId);
}
async function deleteArticle() {
  if (!confirm('¿Eliminar este artículo? Esta acción no se puede deshacer.')) return;
  await api('DELETE', '/api/admin/articles/' + state.currentId);
  state.currentId = null;
  document.getElementById('main').innerHTML = '<div class="empty">Artículo eliminado. Selecciona otro.</div>';
  await reloadTree();
}

/* ---------- Crear / editar categorías, secciones, artículos ---------- */
function openForm(title, fields) {
  return new Promise(resolve => {
    const dlg = document.getElementById('dlg');
    document.getElementById('dlgContent').innerHTML = `<h3>${title}</h3>` +
      fields.map(f => `<label>${f.label}</label><input type="text" id="dlg_${f.key}" value="${esc(f.value || '')}">`).join('') +
      `<div style="margin-top:18px;display:flex;gap:8px;justify-content:flex-end">
         <button class="btn sec" id="dlgCancel">Cancelar</button>
         <button class="btn" id="dlgOk">Guardar</button></div>`;
    dlg.showModal();
    document.getElementById('dlgCancel').onclick = () => { dlg.close(); resolve(null); };
    document.getElementById('dlgOk').onclick = () => {
      const out = {}; fields.forEach(f => out[f.key] = document.getElementById('dlg_' + f.key).value.trim());
      dlg.close(); resolve(out);
    };
  });
}
async function newCategory() {
  const r = await openForm('Nueva categoría', [{ key: 'title', label: 'Título' }, { key: 'icon', label: 'Ícono (emoji)' }, { key: 'blurb', label: 'Descripción' }]);
  if (!r || !r.title) return;
  await api('POST', '/api/admin/categories', r); await reloadTree();
}
async function editCategory(id) {
  const c = state.tree.find(x => x.id === id);
  const r = await openForm('Editar categoría', [{ key: 'title', label: 'Título', value: c.title }, { key: 'icon', label: 'Ícono (emoji)', value: c.icon }, { key: 'blurb', label: 'Descripción', value: c.blurb }]);
  if (!r) return; await api('PUT', '/api/admin/categories/' + id, r); await reloadTree();
}
async function newSection(catId) {
  const r = await openForm('Nueva sección', [{ key: 'name', label: 'Nombre de la sección' }]);
  if (!r || !r.name) return; await api('POST', '/api/admin/sections', { category_id: catId, name: r.name }); await reloadTree();
}
async function editSection(id, name) {
  const r = await openForm('Editar sección', [{ key: 'name', label: 'Nombre', value: name }]);
  if (!r) return; await api('PUT', '/api/admin/sections/' + id, { name: r.name }); await reloadTree();
}
async function newArticle(sectionId) {
  const r = await openForm('Nuevo artículo', [{ key: 'title', label: 'Título del artículo' }]);
  if (!r || !r.title) return;
  const res = await api('POST', '/api/admin/articles', { section_id: sectionId, title: r.title, excerpt: '', body: '<p>Escribe el contenido…</p>' });
  await reloadTree(); openArticle(res.id);
}

/* ---------- Reordenar ---------- */
async function moveCat(ci, dir) {
  const arr = state.tree.slice(); const ni = ci + dir; if (ni < 0 || ni >= arr.length) return;
  [arr[ci], arr[ni]] = [arr[ni], arr[ci]];
  await api('PATCH', '/api/admin/reorder', { type: 'categorias', items: arr.map(c => ({ id: c.id })) });
  await reloadTree();
}
async function moveArt(sectionId, ai, dir) {
  let arts;
  for (const c of state.tree) for (const s of c.sections) if (s.id === sectionId) arts = s.articles.slice();
  if (!arts) return; const ni = ai + dir; if (ni < 0 || ni >= arts.length) return;
  [arts[ai], arts[ni]] = [arts[ni], arts[ai]];
  await api('PATCH', '/api/admin/reorder', { type: 'articulos', items: arts.map(a => ({ id: a.id })) });
  await reloadTree();
}

/* ---------- Contacto ---------- */
async function editContact() {
  const c = state.contact || {};
  const r = await openForm('Datos de contacto', [
    { key: 'whatsapp', label: 'WhatsApp', value: c.whatsapp },
    { key: 'telefono', label: 'Teléfono', value: c.telefono },
    { key: 'correo', label: 'Correo', value: c.correo },
    { key: 'horario', label: 'Horario', value: c.horario },
    { key: 'portal', label: 'Portal', value: c.portal },
    { key: 'cobertura', label: 'Cobertura', value: c.cobertura }
  ]);
  if (!r) return; await api('PUT', '/api/admin/contact', r); await reloadTree();
}

/* ---------- Init ---------- */
if (localStorage.getItem(TOKEN_KEY)) startApp();
