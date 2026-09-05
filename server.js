const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// ---------- CONFIG DEL ADMIN PRINCIPAL ----------
const ADMIN_USER = 'Just_Matt';
const ADMIN_PASS = 'Matt5b0ard2026!'; // puedes cambiarla aquí cuando quieras

const db = new DatabaseSync('./4chan_clon.db');

db.exec(`CREATE TABLE IF NOT EXISTS hilos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT,
    comentario TEXT,
    imagen TEXT,
    autor TEXT DEFAULT 'Anónimo',
    ip TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.exec(`CREATE TABLE IF NOT EXISTS respuestas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hilo_id INTEGER,
    comentario TEXT,
    imagen TEXT,
    autor TEXT DEFAULT 'Anónimo',
    ip TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.exec(`CREATE TABLE IF NOT EXISTS moderadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE,
    clave TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS baneos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    razon TEXT,
    baneado_por TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.exec(`CREATE TABLE IF NOT EXISTS noticias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT,
    contenido TEXT,
    autor TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Migraciones por si la base ya existía sin estas columnas
try { db.exec(`ALTER TABLE hilos ADD COLUMN autor TEXT DEFAULT 'Anónimo'`); } catch (e) {}
try { db.exec(`ALTER TABLE hilos ADD COLUMN ip TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE respuestas ADD COLUMN autor TEXT DEFAULT 'Anónimo'`); } catch (e) {}
try { db.exec(`ALTER TABLE respuestas ADD COLUMN ip TEXT`); } catch (e) {}

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));
app.use('/public', express.static('public'));

// ---------- HELPERS ----------
function getIP(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').replace('::ffff:', '');
}
function esAdmin(req) {
  return req.cookies && req.cookies.rol === 'admin';
}
function esMod(req) {
  return req.cookies && (req.cookies.rol === 'admin' || req.cookies.rol === 'mod');
}
function nombreUsuario(req) {
  if (esAdmin(req)) return ADMIN_USER;
  if (req.cookies && req.cookies.rol === 'mod') return req.cookies.usuario;
  return 'Anónimo';
}
function estaBaneado(ip) {
  return db.prepare('SELECT * FROM baneos WHERE ip = ? ORDER BY id DESC LIMIT 1').get(ip);
}

// Middleware: bloquea publicar si la IP está baneada
function bloquearBaneados(req, res, next) {
  const ban = estaBaneado(getIP(req));
  if (ban) {
    return res.send(PaginaHTML(`
      <div style="max-width:400px; margin:40px auto; background:#fdd; border:1px solid red; padding:20px; text-align:center;">
        <h2 style="color:red; margin-top:0;">Estás baneado</h2>
        <p><b>Razón:</b> ${ban.razon}</p>
        <p style="font-size:12px; color:#666;">Fecha: ${ban.fecha}</p>
      </div>
    `, req));
  }
  next();
}

// ---------- PLANTILLA BASE ----------
function PaginaHTML(contenido, req) {
  const admin = esAdmin(req);
  const mod = esMod(req);
  let barra = `<a href="/login" style="color:#fff; text-decoration:none; float:right; font-size:12px;">Login</a>`;
  if (admin) {
    barra = `<span style="color:#ffd700; font-weight:bold; margin-left:15px;">👑 ${ADMIN_USER}</span>
              <a href="/panel" style="color:#fff; margin-left:10px; font-size:12px;">Panel Admin</a>
              <a href="/logout" style="color:#fff; margin-left:10px; font-size:12px;">(salir)</a>`;
  } else if (mod) {
    barra = `<span style="color:#87ceeb; font-weight:bold; margin-left:15px;">🛡️ ${nombreUsuario(req)}</span>
              <a href="/logout" style="color:#fff; margin-left:10px; font-size:12px;">(salir)</a>`;
  }

  return `
  <html>
  <head><meta charset="utf-8"><title>5b0ard</title></head>
  <body style="background:#fffff0; font-family:sans-serif;">
    <div style="background:#1d2f6f; padding:8px 10px;">
      <a href="/" style="color:#fff; text-decoration:none; font-weight:bold; margin-right:15px;">5b0ard</a>
      <a href="/b" style="color:#fff; text-decoration:none;">/b/ - Random</a>
      ${barra}
    </div>
    ${contenido}
  </body>
  </html>`;
}

function botonBanear(ip, tipo, id, hiloId) {
  if (!ip) return '';
  const redirigirA = tipo === 'hilo' ? `/b` : `/hilo/${hiloId}`;
  return `
    <form method="POST" action="/banear" style="display:inline;"
      onsubmit="return this.razon.value.trim() !== '';">
      <input type="hidden" name="ip" value="${ip}">
      <input type="hidden" name="volver" value="${redirigirA}">
      <input type="text" name="razon" placeholder="Razón del baneo" required
        style="font-size:11px; width:110px;">
      <button type="submit" style="font-size:11px; color:#fff; background:#800; border:none; cursor:pointer;">Banear</button>
    </form>`;
}

// ---------- LOGIN (admin o mod) ----------
app.get('/login', (req, res) => {
  res.send(PaginaHTML(`
    <div style="max-width:300px; margin:40px auto; background:#e0e0f0; padding:20px;">
      <h2 style="text-align:center; margin-top:0;">Login</h2>
      <form method="POST" action="/login">
        <input type="text" name="usuario" placeholder="Usuario" style="width:100%; margin-bottom:8px; box-sizing:border-box;"><br>
        <input type="password" name="clave" placeholder="Contraseña" style="width:100%; margin-bottom:8px; box-sizing:border-box;"><br>
        <button type="submit" style="width:100%;">Entrar</button>
      </form>
    </div>
  `, req));
});

app.post('/login', (req, res) => {
  const { usuario, clave } = req.body;

  if (usuario === ADMIN_USER && clave === ADMIN_PASS) {
    res.cookie('rol', 'admin', { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 30 });
    res.cookie('usuario', ADMIN_USER, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 30 });
    return res.redirect('/b');
  }

  const mod = db.prepare('SELECT * FROM moderadores WHERE usuario = ? AND clave = ?').get(usuario, clave);
  if (mod) {
    res.cookie('rol', 'mod', { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 30 });
    res.cookie('usuario', mod.usuario, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 30 });
    return res.redirect('/b');
  }

  res.send(PaginaHTML('<p style="text-align:center; color:red;">Usuario o contraseña incorrectos. <a href="/login">Volver a intentar</a></p>', req));
});

app.get('/logout', (req, res) => {
  res.clearCookie('rol');
  res.clearCookie('usuario');
  res.redirect('/b');
});

// ---------- PANEL ADMIN ----------
app.get('/panel', (req, res) => {
  if (!esAdmin(req)) return res.status(403).send('No autorizado.');

  const mods = db.prepare('SELECT * FROM moderadores').all();
  const baneos = db.prepare('SELECT * FROM baneos ORDER BY id DESC').all();

  const modsHTML = mods.length
    ? mods.map(m => `
        <li>${m.usuario}
          <form method="POST" action="/panel/quitar-mod/${m.id}" style="display:inline;" onsubmit="return confirm('¿Quitar a este moderador?');">
            <button type="submit" style="font-size:11px; color:red;">Quitar</button>
          </form>
        </li>`).join('')
    : '<li>No hay moderadores todavía.</li>';

  const baneosHTML = baneos.length
    ? baneos.map(b => `
        <li>${b.ip} — <i>${b.razon}</i> (por ${b.baneado_por}, ${b.fecha})
          <form method="POST" action="/panel/desbanear/${b.id}" style="display:inline;">
            <button type="submit" style="font-size:11px;">Desbanear</button>
          </form>
        </li>`).join('')
    : '<li>No hay baneos activos.</li>';

  res.send(PaginaHTML(`
    <div style="max-width:500px; margin:20px auto;">
      <h2>Panel de Admin</h2>

      <div style="background:#e0e0f0; padding:15px; margin-bottom:15px;">
        <h3 style="margin-top:0;">Agregar Moderador</h3>
        <form method="POST" action="/panel/agregar-mod">
          <input type="text" name="usuario" placeholder="Usuario del mod" style="width:100%; margin-bottom:5px; box-sizing:border-box;"><br>
          <input type="text" name="clave" placeholder="Contraseña del mod" style="width:100%; margin-bottom:5px; box-sizing:border-box;"><br>
          <button type="submit" style="width:100%;">Agregar</button>
        </form>
        <h4>Moderadores actuales:</h4>
        <ul>${modsHTML}</ul>
      </div>

      <div style="background:#e0e0f0; padding:15px; margin-bottom:15px;">
        <h3 style="margin-top:0;">Publicar Noticia</h3>
        <form method="POST" action="/panel/noticia">
          <input type="text" name="titulo" placeholder="Título" style="width:100%; margin-bottom:5px; box-sizing:border-box;"><br>
          <textarea name="contenido" placeholder="Contenido..." rows="4" style="width:100%; margin-bottom:5px; box-sizing:border-box;"></textarea><br>
          <button type="submit" style="width:100%;">Publicar</button>
        </form>
      </div>

      <div style="background:#e0e0f0; padding:15px;">
        <h3 style="margin-top:0;">Baneos activos</h3>
        <ul>${baneosHTML}</ul>
      </div>
    </div>
  `, req));
});

app.post('/panel/agregar-mod', (req, res) => {
  if (!esAdmin(req)) return res.status(403).send('No autorizado.');
  try {
    db.prepare('INSERT INTO moderadores (usuario, clave) VALUES (?, ?)').run(req.body.usuario, req.body.clave);
  } catch (e) {}
  res.redirect('/panel');
});

app.post('/panel/quitar-mod/:id', (req, res) => {
  if (!esAdmin(req)) return res.status(403).send('No autorizado.');
  db.prepare('DELETE FROM moderadores WHERE id = ?').run(req.params.id);
  res.redirect('/panel');
});

app.post('/panel/noticia', (req, res) => {
  if (!esAdmin(req)) return res.status(403).send('No autorizado.');
  db.prepare('INSERT INTO noticias (titulo, contenido, autor) VALUES (?, ?, ?)')
    .run(req.body.titulo, req.body.contenido, ADMIN_USER);
  res.redirect('/panel');
});

app.post('/panel/desbanear/:id', (req, res) => {
  if (!esAdmin(req)) return res.status(403).send('No autorizado.');
  db.prepare('DELETE FROM baneos WHERE id = ?').run(req.params.id);
  res.redirect('/panel');
});

// ---------- BANEAR (admin o mod) ----------
app.post('/banear', (req, res) => {
  if (!esMod(req)) return res.status(403).send('No autorizado.');
  const { ip, razon, volver } = req.body;
  db.prepare('INSERT INTO baneos (ip, razon, baneado_por) VALUES (?, ?, ?)')
    .run(ip, razon, nombreUsuario(req));
  res.redirect(volver || '/b');
});

// ---------- BORRAR HILO / RESPUESTA (admin o mod) ----------
app.post('/borrar-hilo/:id', (req, res) => {
  if (!esMod(req)) return res.status(403).send('No autorizado.');
  db.prepare('DELETE FROM respuestas WHERE hilo_id = ?').run(req.params.id);
  db.prepare('DELETE FROM hilos WHERE id = ?').run(req.params.id);
  res.redirect('/b');
});

app.post('/borrar-respuesta/:id/:hiloId', (req, res) => {
  if (!esMod(req)) return res.status(403).send('No autorizado.');
  db.prepare('DELETE FROM respuestas WHERE id = ?').run(req.params.id);
  res.redirect('/hilo/' + req.params.hiloId);
});

// ---------- PÁGINA DE BIENVENIDA ----------
app.get('/', (req, res) => {
  const noticias = db.prepare('SELECT * FROM noticias ORDER BY id DESC LIMIT 5').all();
  const noticiasHTML = noticias.length
    ? noticias.map(n => `
        <div style="border-bottom:1px solid #ddd; padding:8px 0;">
          <b>${n.titulo}</b> <span style="font-size:11px; color:#888;">— ${n.autor}, ${n.fecha}</span>
          <p style="margin:4px 0 0 0;">${n.contenido}</p>
        </div>`).join('')
    : `<p><b>ES:</b> Aquí todo se vale. Socializa de lo que quieras, di lo que quieras.
       No te tomes nada en serio — si lo haces, eres un imbécil.<br><br>
       <b>EN:</b> Anything goes here. Talk about whatever you want, say whatever you want.
       Don't take anything seriously — if you do, you're an idiot.</p>`;

  res.send(`
    <html>
    <head><meta charset="utf-8"><title>5b0ard</title></head>
    <body style="background:#ffffee; font-family:'Times New Roman', serif; color:#000; margin:0; padding:0;">
      <table width="100%" cellpadding="10" cellspacing="0">
        <tr valign="top">
          <td width="160" style="border-right:1px solid #ccc; font-size:13px;">
            <b>Tablones</b><br><br>
            <a href="/b" style="color:#0000EE;">/b/ - Random</a>
          </td>
          <td align="center">
            <img src="/public/5board-logo.png" alt="5b0ard" style="max-width:320px; width:90%; margin-bottom:10px;" onerror="this.style.display='none'">

            <hr width="80%">
            <h2 style="color:#800000; font-size:20px;">NOTICIAS / NEWS</h2>

            <table width="80%" cellpadding="8" style="border:1px solid #ccc; background:#f0e0d6; text-align:left; font-size:14px;">
              <tr><td>${noticiasHTML}</td></tr>
            </table>

            <br>
            <a href="/b" style="display:inline-block; background:#800000; color:#fff; text-decoration:none; padding:8px 18px; font-family:sans-serif; font-size:14px;">
              Entrar a /b/ - Random
            </a>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `);
});

// ---------- TABLÓN /b/ ----------
app.get('/b', (req, res) => {
  const mod = esMod(req);
  const hilos = db.prepare('SELECT * FROM hilos ORDER BY id DESC').all();

  let hilosHTML = '';
  if (hilos.length === 0) {
    hilosHTML = '<p style="color:red; text-align:center;">No hay hilos activos. ¡Sé el primero!</p>';
  } else {
    hilos.forEach(h => {
      const esAutorAdmin = h.autor === ADMIN_USER;
      const nombreMostrado = esAutorAdmin
        ? `<span style="color:#b8860b; font-weight:bold;">👑 ${h.autor}</span>`
        : (h.autor && h.autor !== 'Anónimo' ? `<span style="color:#4682b4; font-weight:bold;">🛡️ ${h.autor}</span>` : 'Anónimo');
      const botonBorrar = mod
        ? `<form method="POST" action="/borrar-hilo/${h.id}" style="display:inline;" onsubmit="return confirm('¿Borrar este hilo?');">
             <button type="submit" style="font-size:11px; color:red; background:none; border:1px solid red; cursor:pointer;">Borrar</button>
           </form> ${botonBanear(h.ip, 'hilo', h.id)}`
        : '';
      hilosHTML += `
      <div style="border:1px solid #ccc; margin:10px 0; padding:10px; background:#f0e0d6;">
        <span class="meta">${nombreMostrado} ${h.titulo ? '- ' + h.titulo : ''} (${h.fecha || ''}) <span class="num">No. ${h.id}</span><br>${botonBorrar}</span><br><br>
        ${h.imagen ? `<a href="/uploads/${h.imagen}" target="_blank"><img src="/uploads/${h.imagen}" style="max-width:200px; float:left; margin-right:10px;"></a>` : ''}
        <p>${h.comentario}</p>
        <div style="clear:both;"></div>
        <a href="/hilo/${h.id}" style="font-size:13px;">Ver hilo / responder</a>
      </div>`;
    });
  }

  const formulario = `
    <div style="max-width:400px; margin:20px auto; background:#e0e0f0; padding:15px;">
      <h2 style="text-align:center; background:#f0d6d0; padding:10px; margin-top:0;">/b/ - Tablón Anónimo</h2>
      <form method="POST" action="/crear-hilo" enctype="multipart/form-data">
        <input type="text" name="titulo" placeholder="Título (Opcional)" style="width:100%; margin-bottom:5px; box-sizing:border-box;"><br>
        <textarea name="comentario" placeholder="Comentario..." rows="5" style="width:100%; margin-bottom:5px; box-sizing:border-box;"></textarea><br>
        <input type="file" name="imagen"><br><br>
        <button type="submit" style="width:100%;">Publicar Hilo</button>
      </form>
    </div>
    <div style="max-width:500px; margin:0 auto;">${hilosHTML}</div>
  `;

  res.send(PaginaHTML(formulario, req));
});

// ---------- CREAR HILO ----------
app.post('/crear-hilo', bloquearBaneados, upload.single('imagen'), (req, res) => {
  if (!req.file) return res.send('Error: Es obligatorio subir una imagen.');
  const autor = nombreUsuario(req);
  db.prepare(`INSERT INTO hilos (titulo, comentario, imagen, autor, ip) VALUES (?, ?, ?, ?, ?)`)
    .run(req.body.titulo, req.body.comentario, req.file.filename, autor, getIP(req));
  res.redirect('/b');
});

// ---------- VER UN HILO Y SUS RESPUESTAS ----------
app.get('/hilo/:id', (req, res) => {
  const mod = esMod(req);
  const hilo = db.prepare('SELECT * FROM hilos WHERE id = ?').get(req.params.id);
  if (!hilo) return res.send('Hilo no encontrado.');

  const resps = db.prepare('SELECT * FROM respuestas WHERE hilo_id = ? ORDER BY id ASC').all(req.params.id);

  const nombreHilo = hilo.autor === ADMIN_USER
    ? `<span style="color:#b8860b; font-weight:bold;">👑 ${hilo.autor}</span>`
    : (hilo.autor && hilo.autor !== 'Anónimo' ? `<span style="color:#4682b4; font-weight:bold;">🛡️ ${hilo.autor}</span>` : 'Anónimo');
  const botonBorrarHilo = mod
    ? `<form method="POST" action="/borrar-hilo/${hilo.id}" style="display:inline;" onsubmit="return confirm('¿Borrar este hilo?');">
         <button type="submit" style="font-size:11px; color:red; background:none; border:1px solid red; cursor:pointer;">Borrar hilo</button>
       </form> ${botonBanear(hilo.ip, 'hilo', hilo.id)}`
    : '';

  let hiloHTML = `
    <div style="max-width:500px; margin:20px auto;">
      <div class="hilo" style="border:1px solid #ccc; margin:10px 0; padding:10px; background:#f0e0d6;">
        <span class="meta">${nombreHilo} ${hilo.titulo ? '- ' + hilo.titulo : ''} (${hilo.fecha || ''}) <span class="num">No. ${hilo.id}</span><br>${botonBorrarHilo}</span><br><br>
        ${hilo.imagen ? `<a href="/uploads/${hilo.imagen}" target="_blank"><img src="/uploads/${hilo.imagen}" style="max-width:200px; float:left; margin-right:10px;"></a>` : ''}
        <p>${hilo.comentario}</p>
        <div style="clear:both;"></div>
      </div>`;

  resps.forEach(r => {
    const nombreResp = r.autor === ADMIN_USER
      ? `<span style="color:#b8860b; font-weight:bold;">👑 ${r.autor}</span>`
      : (r.autor && r.autor !== 'Anónimo' ? `<span style="color:#4682b4; font-weight:bold;">🛡️ ${r.autor}</span>` : 'Anónimo');
    const botonBorrarResp = mod
      ? `<form method="POST" action="/borrar-respuesta/${r.id}/${hilo.id}" style="display:inline;" onsubmit="return confirm('¿Borrar esta respuesta?');">
           <button type="submit" style="font-size:11px; color:red; background:none; border:1px solid red; cursor:pointer;">Borrar</button>
         </form> ${botonBanear(r.ip, 'respuesta', r.id, hilo.id)}`
      : '';
    hiloHTML += `
      <div class="respuesta" style="border:1px solid #ddd; margin:8px 0 8px 20px; padding:10px; background:#f9f9f9;">
        <span class="meta">${nombreResp} (${r.fecha || ''}) <span class="num">No. ${r.id}</span><br>${botonBorrarResp}</span><br><br>
        ${r.imagen ? `<a href="/uploads/${r.imagen}" target="_blank"><img src="/uploads/${r.imagen}" style="max-width:150px; float:left; margin-right:10px;"></a>` : ''}
        <p>${r.comentario}</p>
        <div style="clear:both;"></div>
      </div>`;
  });

  hiloHTML += `
      <div style="background:#e0e0f0; padding:15px; margin-top:10px;">
        <form method="POST" action="/responder/${hilo.id}" enctype="multipart/form-data">
          <textarea name="comentario" placeholder="Comentario..." rows="4" style="width:100%; margin-bottom:5px; box-sizing:border-box;"></textarea><br>
          <input type="file" name="imagen"><br><br>
          <button type="submit" style="width:100%;">Responder</button>
        </form>
      </div>
    </div>`;

  res.send(PaginaHTML(hiloHTML, req));
});

// ---------- RESPONDER A UN HILO ----------
app.post('/responder/:id', bloquearBaneados, upload.single('imagen'), (req, res) => {
  const imagenNom = req.file ? req.file.filename : null;
  const autor = nombreUsuario(req);
  db.prepare(`INSERT INTO respuestas (hilo_id, comentario, imagen, autor, ip) VALUES (?, ?, ?, ?, ?)`)
    .run(req.params.id, req.body.comentario, imagenNom, autor, getIP(req));
  res.redirect('/hilo/' + req.params.id);
});

app.listen(PORT, () => console.log(`Foro corriendo en http://localhost:${PORT}`));
