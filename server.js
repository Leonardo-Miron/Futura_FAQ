// server.js — API + servidor estático del Centro de Ayuda de Futura Labs
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

// Auto-carga el contenido semilla y el usuario admin en el primer arranque
// (idempotente: no duplica si ya hay datos). Útil al desplegar en la nube.
try { require('./seed'); } catch (e) { console.error('Seed:', e.message); }

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion';

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

/* ---------------- Helpers ---------------- */
function slugify(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || ('item-' + Date.now());
}
function uniqueSlug(base) {
  let slug = slugify(base), i = 2;
  while (db.prepare('SELECT 1 FROM articles WHERE slug = ?').get(slug)) slug = slugify(base) + '-' + i++;
  return slug;
}
function buildTree(onlyPublished) {
  const cats = db.prepare('SELECT * FROM categories ORDER BY position, title').all();
  const secStmt = db.prepare('SELECT * FROM sections WHERE category_id = ? ORDER BY position, id');
  const artStmt = onlyPublished
    ? db.prepare("SELECT * FROM articles WHERE section_id = ? AND status='published' ORDER BY position, id")
    : db.prepare('SELECT * FROM articles WHERE section_id = ? ORDER BY position, id');
  return cats.map(c => ({
    id: c.id, icon: c.icon, title: c.title, blurb: c.blurb, position: c.position,
    sections: secStmt.all(c.id).map(s => ({
      id: s.id, name: s.name, position: s.position,
      articles: artStmt.all(s.id).map(a => ({
        id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt,
        body: a.body, status: a.status, position: a.position, updated_at: a.updated_at
      }))
    }))
  })).filter(c => onlyPublished ? c.sections.some(s => s.articles.length) : true);
}
function contactSettings() {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'contact.%'").all();
  const out = {};
  rows.forEach(r => out[r.key.replace('contact.', '')] = r.value);
  return out;
}

/* ---------------- Auth ---------------- */
function auth(roles) {
  return (req, res, next) => {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : req.cookies.token;
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (roles && roles.length && !roles.includes(payload.role))
        return res.status(403).json({ error: 'Sin permiso para esta acción' });
      next();
    } catch { return res.status(401).json({ error: 'Sesión inválida o expirada' }); }
  };
}
const canPublish = ['admin', 'publisher'];

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !bcrypt.compareSync(password || '', u.password_hash))
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const token = jwt.sign({ id: u.id, username: u.username, role: u.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, username: u.username, role: u.role });
});
app.get('/api/me', auth(), (req, res) => res.json(req.user));

/* ---------------- API pública ---------------- */
app.get('/api/content', (req, res) => res.json({ categories: buildTree(true), contact: contactSettings() }));

/* ---------------- API admin: leer todo ---------------- */
app.get('/api/admin/content', auth(), (req, res) => res.json({ categories: buildTree(false), contact: contactSettings() }));

/* ------ Categorías ------ */
app.post('/api/admin/categories', auth(), (req, res) => {
  const { title, icon = '', blurb = '' } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Falta el título' });
  let id = slugify(title), i = 2;
  while (db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)) id = slugify(title) + '-' + i++;
  const pos = (db.prepare('SELECT MAX(position) m FROM categories').get().m ?? -1) + 1;
  db.prepare('INSERT INTO categories (id, icon, title, blurb, position) VALUES (?,?,?,?,?)').run(id, icon, title, blurb, pos);
  res.json({ id });
});
app.put('/api/admin/categories/:id', auth(), (req, res) => {
  const { title, icon, blurb } = req.body || {};
  const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Categoría no encontrada' });
  db.prepare('UPDATE categories SET title=?, icon=?, blurb=? WHERE id=?')
    .run(title ?? c.title, icon ?? c.icon, blurb ?? c.blurb, c.id);
  res.json({ ok: true });
});
app.delete('/api/admin/categories/:id', auth(canPublish), (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ------ Secciones ------ */
app.post('/api/admin/sections', auth(), (req, res) => {
  const { category_id, name } = req.body || {};
  if (!category_id || !name) return res.status(400).json({ error: 'Falta categoría o nombre' });
  const pos = (db.prepare('SELECT MAX(position) m FROM sections WHERE category_id=?').get(category_id).m ?? -1) + 1;
  const id = db.prepare('INSERT INTO sections (category_id, name, position) VALUES (?,?,?)').run(category_id, name, pos).lastInsertRowid;
  res.json({ id });
});
app.put('/api/admin/sections/:id', auth(), (req, res) => {
  const { name } = req.body || {};
  db.prepare('UPDATE sections SET name=? WHERE id=?').run(name, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/sections/:id', auth(canPublish), (req, res) => {
  db.prepare('DELETE FROM sections WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ------ Artículos ------ */
app.post('/api/admin/articles', auth(), (req, res) => {
  const { section_id, title, excerpt = '', body = '' } = req.body || {};
  if (!section_id || !title) return res.status(400).json({ error: 'Falta sección o título' });
  const slug = uniqueSlug(title);
  const pos = (db.prepare('SELECT MAX(position) m FROM articles WHERE section_id=?').get(section_id).m ?? -1) + 1;
  const id = db.prepare(`INSERT INTO articles (section_id, slug, title, excerpt, body, status, position)
                         VALUES (?,?,?,?,?,'draft',?)`).run(section_id, slug, title, excerpt, body, pos).lastInsertRowid;
  res.json({ id, slug });
});
app.put('/api/admin/articles/:id', auth(), (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Artículo no encontrado' });
  const { title, excerpt, body, section_id } = req.body || {};
  db.prepare(`UPDATE articles SET title=?, excerpt=?, body=?, section_id=?, updated_at=datetime('now') WHERE id=?`)
    .run(title ?? a.title, excerpt ?? a.excerpt, body ?? a.body, section_id ?? a.section_id, a.id);
  res.json({ ok: true });
});
app.post('/api/admin/articles/:id/publish', auth(canPublish), (req, res) => {
  db.prepare("UPDATE articles SET status='published', updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});
app.post('/api/admin/articles/:id/unpublish', auth(canPublish), (req, res) => {
  db.prepare("UPDATE articles SET status='draft', updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/articles/:id', auth(canPublish), (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ------ Reordenar (categorías | secciones | articulos) ------ */
app.patch('/api/admin/reorder', auth(), (req, res) => {
  const { type, items } = req.body || {};
  const table = { categorias: 'categories', secciones: 'sections', articulos: 'articles' }[type];
  if (!table || !Array.isArray(items)) return res.status(400).json({ error: 'Parámetros inválidos' });
  const upd = db.prepare(`UPDATE ${table} SET position=? WHERE id=?`);
  const tx = db.transaction(() => items.forEach((it, i) => upd.run(i, it.id)));
  tx(); res.json({ ok: true });
});

/* ------ Contacto (settings) ------ */
app.put('/api/admin/contact', auth(), (req, res) => {
  const ins = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)');
  Object.entries(req.body || {}).forEach(([k, v]) => ins.run('contact.' + k, String(v)));
  res.json({ ok: true });
});

/* ---------------- Estáticos ---------------- */
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Futura Help corriendo en http://localhost:${PORT}  (admin: /admin)`));
