// db.js — conexión y esquema SQLite
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'futura-help.db');
// Asegura que la carpeta del archivo exista (evita fallas al desplegar)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id        TEXT PRIMARY KEY,          -- slug (ej. "primeros-pasos")
  icon      TEXT DEFAULT '',
  title     TEXT NOT NULL,
  blurb     TEXT DEFAULT '',
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS articles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  slug        TEXT UNIQUE NOT NULL,     -- URL del artículo (ej. "abrir-cuenta")
  title       TEXT NOT NULL,
  excerpt     TEXT DEFAULT '',
  body        TEXT DEFAULT '',          -- HTML
  status      TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published'
  position    INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'editor', -- 'admin' | 'publisher' | 'editor'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`);

module.exports = db;
