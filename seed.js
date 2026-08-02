// seed.js — carga inicial del contenido (64 artículos) y del usuario admin.
// Reejecutar es seguro: solo inserta si las tablas están vacías (no duplica).
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'seed-data.json'), 'utf8'));

const insCat = db.prepare('INSERT INTO categories (id, icon, title, blurb, position) VALUES (?,?,?,?,?)');
const insSec = db.prepare('INSERT INTO sections (category_id, name, position) VALUES (?,?,?)');
const insArt = db.prepare(`INSERT INTO articles (section_id, slug, title, excerpt, body, status, position)
                           VALUES (?,?,?,?,?,?,?)`);

const contentCount = db.prepare('SELECT COUNT(*) n FROM categories').get().n;

const loadContent = db.transaction(() => {
  seed.categories.forEach((cat, ci) => {
    insCat.run(cat.id, cat.icon || '', cat.title, cat.blurb || '', ci);
    cat.sections.forEach((sec, si) => {
      const secId = insSec.run(cat.id, sec.name, si).lastInsertRowid;
      sec.articles.forEach((art, ai) => {
        // Contenido semilla se publica por defecto para que el sitio funcione de inmediato.
        insArt.run(secId, art.id, art.title, art.excerpt || '', art.body || '', 'published', ai);
      });
    });
  });
  // Guarda los datos de contacto como settings editables
  if (seed.contact) {
    const insSet = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)');
    Object.entries(seed.contact).forEach(([k, v]) => insSet.run('contact.' + k, v));
  }
});

if (contentCount === 0) {
  loadContent();
  let n = db.prepare('SELECT COUNT(*) n FROM articles').get().n;
  console.log(`✓ Contenido cargado: ${seed.categories.length} categorías, ${n} artículos.`);
} else {
  console.log('• El contenido ya existe, no se recarga (borra data/futura-help.db para reiniciar).');
}

// Usuario administrador inicial
const userCount = db.prepare('SELECT COUNT(*) n FROM users').get().n;
if (userCount === 0) {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASS || 'futura123';
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)').run(username, hash, 'admin');
  console.log(`✓ Usuario admin creado: ${username} / ${password}  (cámbialo en producción)`);
} else {
  console.log('• Ya existe al menos un usuario, no se crea el admin por defecto.');
}
