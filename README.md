# Centro de Ayuda Futura Labs — v1

Sitio de ayuda self-serve para doctores **+ backend simple** para que el equipo edite el contenido sin tocar código. Implementa el PR *"Centro de Ayuda (FAQ) en el Portal Clínico"*.

- **Sitio público** (`/`): centro de ayuda estilo Dandy — categorías, buscador, artículos con navegación real. Lee el contenido desde la API.
- **Panel de administración** (`/admin`): login, CRUD de categorías/secciones/artículos, editor de texto enriquecido, estado **borrador/publicado**, reordenar y edición de datos de contacto.
- Contenido semilla: **64 artículos** ya cargados (los del prototipo, redactados con IA a partir de los chats reales de soporte).

---

## Requisitos

- Node.js 18 o superior (probado en Node 22).

## Instalación y arranque

```bash
npm install        # instala dependencias
npm run seed       # crea la base de datos y carga los 64 artículos + usuario admin
npm start          # arranca el servidor
```

Luego abre:

- Sitio: **http://localhost:3000/**
- Admin: **http://localhost:3000/admin**

**Usuario admin por defecto:** `admin` / `futura123` — cámbialo antes de usarlo en serio (ver Configuración).

> Si `npm start` se ejecuta sin haber hecho `npm run seed`, la base se crea vacía. Corre el seed una vez.

---

## Configuración (variables de entorno)

Copia `.env.example` a `.env` o expórtalas antes de arrancar:

| Variable | Para qué | Default |
|----------|----------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `JWT_SECRET` | Firma de sesiones — **cámbialo en producción** | `dev-secret-...` |
| `ADMIN_USER` / `ADMIN_PASS` | Usuario admin creado en el primer seed | `admin` / `futura123` |
| `DB_PATH` | Ruta del archivo SQLite | `data/futura-help.db` |

Ejemplo:

```bash
JWT_SECRET="una-clave-larga-y-secreta" ADMIN_PASS="miClaveSegura" npm run seed
JWT_SECRET="una-clave-larga-y-secreta" npm start
```

---

## Cómo usa el panel el equipo

1. Entra a `/admin` e inicia sesión.
2. En la columna izquierda ves el árbol **Categorías → Secciones → Artículos**. Cada artículo muestra si está **Publicado** o en **Borrador**.
3. Clic en un artículo para editarlo: título, extracto, sección y contenido (con barra de formato: negrita, listas, H2, enlaces, **tablas**, **notas** y **placeholders** para datos por confirmar). El botón `</> HTML` permite editar el código directamente.
4. **Guardar** conserva los cambios; **Publicar / Despublicar** controla si el doctor lo ve; **Eliminar** lo borra.
5. Botones `+ Categoría`, `+ sec`, `+ art` para crear; flechas ▲▼ para reordenar; `Contacto` (arriba) edita teléfono, WhatsApp, horario, etc.

Los artículos nuevos nacen como **borrador**: no se muestran en el sitio hasta publicarse. Ideal para completar los datos marcados como *[POR CONFIRMAR]* antes de exponerlos.

---

## Roles

- **admin**: todo, incluido publicar y eliminar.
- **publisher**: editar + publicar/eliminar.
- **editor**: crear y editar (guarda como borrador); no publica ni elimina.

Los usuarios adicionales se crean por ahora en la base de datos (tabla `users`, contraseña con bcrypt). Un ABM de usuarios en el panel es una mejora de fase 2.

---

## Arquitectura

```
futura-help/
├── server.js         API REST + servidor estático (Express)
├── db.js             Esquema y conexión SQLite
├── seed.js           Carga inicial de contenido y usuario admin
├── data/
│   ├── seed-data.json  Contenido semilla (64 artículos)
│   └── futura-help.db  Base de datos (se crea con el seed)
└── public/
    ├── index.html    Sitio público
    ├── app.js        Motor del sitio (consume /api/content)
    ├── styles.css    Estilos del sitio
    ├── admin.html    Panel de administración
    └── admin.js      Lógica del panel
```

**Modelo de datos:** `Categoría → Sección → Artículo` (título, extracto, cuerpo HTML, estado, orden), más `usuarios` y `settings` (contacto). Es el mismo modelo del prototipo, ahora persistido.

### API principal

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/content` | Contenido **publicado** (sitio público) |
| POST | `/api/login` | Login → token JWT |
| GET | `/api/admin/content` | Todo el contenido, incl. borradores (requiere token) |
| POST/PUT/DELETE | `/api/admin/categories` · `/sections` · `/articles` | CRUD |
| POST | `/api/admin/articles/:id/publish` · `/unpublish` | Cambiar estado |
| PATCH | `/api/admin/reorder` | Reordenar |
| PUT | `/api/admin/contact` | Editar datos de contacto |

---

## Subir a GitHub y publicarlo en línea

GitHub **guarda el código**, pero no ejecuta el servidor. El flujo es: (1) subes el código a GitHub y (2) lo despliegas en un servicio que corra Node (recomendado: **Render**, plan gratis).

### Paso 1 — Subir el código a GitHub

**Opción A — desde la terminal** (ya viene inicializado como repo git):

```bash
# 1. Crea un repositorio vacío en github.com (botón "New", sin README).
# 2. En la carpeta del proyecto, conéctalo y sube:
git remote add origin https://github.com/TU-USUARIO/futura-help.git
git branch -M main
git push -u origin main
```

**Opción B — sin terminal:** en github.com crea el repo → botón **"Add file" → "Upload files"** → arrastra todos los archivos del proyecto (menos `node_modules`) → **Commit**.

> `node_modules` y la base de datos local **no se suben** (están en `.gitignore`); se regeneran solos.

### Paso 2 — Publicarlo en Render (gratis)

1. Entra a **render.com** y regístrate con tu cuenta de GitHub.
2. **New → Web Service** y elige tu repositorio `futura-help`.
3. Render detecta el archivo `render.yaml` y configura todo solo. Si lo pide manual:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. En **Environment**, define `ADMIN_PASS` con una contraseña propia (y opcionalmente `ADMIN_USER`). `JWT_SECRET` se genera solo.
5. **Create Web Service.** En 1–2 minutos tendrás una URL pública tipo `https://futura-help.onrender.com`.
   - Sitio: esa URL · Panel: esa URL + `/admin`.

El servidor **carga los 64 artículos solo en el primer arranque**, así que no necesitas correr el seed a mano.

### ⚠️ Persistencia de las ediciones

En el plan **gratis** de Render el disco es temporal: las ediciones que haga el equipo en el panel **pueden perderse** al reiniciar o redesplegar. Para conservarlas:

- **Recomendado:** en Render agrega un **disco persistente** (plan de pago) montado en `/var/data` — ya viene indicado y comentado en `render.yaml`.
- **Para más escala:** migrar de SQLite a Postgres.

El plan gratis es perfecto para **probar y mostrar** el sistema; para uso real del equipo, activa el disco persistente.

### Otros hosts

Funciona igual en **Railway**, **Fly.io**, un **VPS** (con `pm2`/`systemd`) o cualquier host de Node. El único requisito es correr `npm install` y `npm start`, y montar un volumen persistente para `data/` si quieres conservar las ediciones.

---

## Notas de producción (siguiente paso)

- Cambiar `JWT_SECRET` y la contraseña admin.
- Servir detrás de HTTPS y, en v1, detrás del login del Portal (contenido B2B).
- Respaldos del archivo SQLite (o migrar a Postgres si crece).
- Opcional: widget "¿te fue útil?" con almacenamiento de votos y reporte de búsquedas sin resultado (fase 2 del PR).

---

*Generado como implementación de referencia del PR del Centro de Ayuda. El contenido incluye ~45 campos marcados “[POR CONFIRMAR]” que el equipo debe validar antes de publicar.*
