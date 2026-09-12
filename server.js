const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const db = new Database('foro.db');
const PORT = process.env.PORT || 3000;

// ===== CONFIGURACIÓN =====
const ADMIN_PASSWORD = 'admin123'; // Cámbiala por una contraseña segura
const baneados = new Set();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

db.exec(`
  CREATE TABLE IF NOT EXISTS hilos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board TEXT,
    titulo TEXT,
    comentario TEXT,
    imagen TEXT,
    autor TEXT,
    ip TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS respuestas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hilo_id INTEGER,
    comentario TEXT,
    imagen TEXT,
    autor TEXT,
    ip TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function getIP(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'desconocida';
}

function estaBaneado(req) {
  return baneados.has(getIP(req));
}

function esMod(req) {
  return req.body && req.body.password === ADMIN_PASSWORD;
}

// ========== PÁGINA PRINCIPAL (estilo actual) ==========
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>5BOARD</title>
  <style>
    body { margin: 0; font-family: sans-serif; background: #f5f0e6; color: #333; }
    .container { display: flex; min-height: 100vh; }
    .sidebar { width: 180px; background: #f8f4ec; padding: 20px 15px; border-right: 1px solid #ddd; }
    .sidebar a { display: block; color: #0066cc; text-decoration: none; margin: 8px 0; font-size: 14px; }
    .main { flex: 1; padding: 30px 20px; text-align: center; }
    .logo { max-width: 280px; margin-bottom: 20px; }
    .news { background: #f8f0e0; border: 1px solid #e0d5c0; padding: 15px; margin: 20px auto; max-width: 500px; text-align: left; font-size: 14px; }
    .btn { display: inline-block; background: #8B0000; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
    h2 { color: #8B0000; font-size: 16px; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="sidebar">
      <strong>Tablones</strong><br><br>
      <a href="/b/">/b/ - Random</a>
      <a href="/v/">/v/ - Videojuegos</a>
      <a href="/f/">/f/ - Fandoms</a>
      <br>
      <a href="/faq">Reglas / FAQ</a>
    </div>
    <div class="main">
      <img src="https://i.imgur.com/8QZ6Z0x.png" alt="5BOARD" class="logo" onerror="this.style.display='none'">
      <h1 style="color:#0066cc; margin:0;">5BOARD</h1>
      <br>
      <h2>NOTICIAS / NEWS</h2>
      <div class="news">
        <strong>ES:</strong> Aquí todo se vale. Socializa de lo que quieras, di lo que quieras. No te tomes nada en serio — si lo haces, eres un imbécil.<br><br>
        <strong>EN:</strong> Anything goes here. Talk about whatever you want, say whatever you want. Don't take anything seriously — if you do, you're an idiot.
      </div>
      <a href="/b/" class="btn">Entrar a /b/ - Random</a>
    </div>
  </div>
</body>
</html>
  `);
});

// ========== FAQ ==========
app.get('/faq', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reglas - 5BOARD</title>
  <style>
    body { font-family: sans-serif; background: #f5f0e6; color: #333; padding: 20px; max-width: 700px; margin: auto; }
    h1 { color: #8B0000; }
    a { color: #0066cc; }
    .regla { background: #fff; border: 1px solid #ddd; padding: 14px; margin: 12px 0; border-left: 5px solid #8B0000; }
  </style>
</head>
<body>
  <h1>📜 Reglas del Foro</h1>
  <p><a href="/">← Volver al inicio</a></p>

  <div class="regla">
    <strong>1. Prohibido contenido ilegal</strong><br>
    Está totalmente prohibido subir o pedir material de abuso infantil (CP) o cualquier contenido ilegal. 
    Quien lo haga será baneado permanentemente.
  </div>

  <div class="regla">
    <strong>2. Prohibido el gore extremo</strong><br>
    No se permite contenido gráfico de violencia real extrema, tortura o muerte real.
  </div>

  <div class="regla">
    <strong>3. Respeta a los demás</strong><br>
    No se permiten ataques personales graves, doxxing ni acoso.
  </div>

  <div class="regla">
    <strong>4. Usa el tablón correcto</strong><br>
    /b/ → Random<br>
    /v/ → Videojuegos<br>
    /f/ → Fandoms
  </div>

  <div class="regla">
    <strong>5. No spamear</strong><br>
    No publiques lo mismo muchas veces seguidas.
  </div>
</body>
</html>
  `);
});
// ========== FUNCIÓN PARA MOSTRAR UN TABLÓN ==========
function mostrarTablon(board, nombre, req, res) {
  if (estaBaneado(req)) return res.send('Estás baneado de este foro.');

  const hilos = db.prepare('SELECT * FROM hilos WHERE board = ? ORDER BY id DESC').all(board);

  let hilosHTML = '';
  if (hilos.length === 0) {
    hilosHTML = '<p style="color:#666;">No hay hilos todavía. ¡Sé el primero!</p>';
  } else {
    hilos.forEach(h => {
      const img = h.imagen ? `<br><img src="/uploads/${h.imagen}" style="max-width:180px; margin-top:6px;">` : '';
      hilosHTML += `
        <div style="background:#fff; border:1px solid #ddd; padding:12px; margin:10px 0; border-radius:4px;">
          <strong>#\( {h.id}</strong> - <a href="/hilo/ \){h.id}">${h.titulo || '(Sin título)'}</a><br>
          <small style="color:#777;">${h.autor || 'Anónimo'} • ${h.fecha}</small>
          <p>${h.comentario || ''}</p>
          ${img}
        </div>
      `;
    });
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>/${board}/ - ${nombre}</title>
  <style>
    body { font-family: sans-serif; background: #f5f0e6; color: #333; margin: 0; padding: 15px; }
    a { color: #0066cc; }
    input, textarea, button { width: 100%; padding: 10px; margin: 6px 0; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
    button { background: #8B0000; color: white; border: none; font-weight: bold; cursor: pointer; }
    .formu { background: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <p><a href="/">← Inicio</a> | <a href="/faq">Reglas</a></p>
  <h2>/${board}/ - ${nombre}</h2>

  <div class="formu">
    <h3>Crear nuevo hilo</h3>
    <form action="/crear-hilo" method="POST" enctype="multipart/form-data">
      <input type="hidden" name="board" value="${board}">
      <input type="text" name="titulo" placeholder="Título (opcional)">
      <textarea name="comentario" rows="4" placeholder="Escribe tu mensaje..." required></textarea>
      <input type="file" name="imagen" accept="image/*">
      <button type="submit">Publicar hilo</button>
    </form>
  </div>

  <h3>Hilos</h3>
  ${hilosHTML}
</body>
</html>
  `);
}

// Rutas de los tablones
app.get('/b/', (req, res) => mostrarTablon('b', 'Random', req, res));
app.get('/v/', (req, res) => mostrarTablon('v', 'Videojuegos', req, res));
app.get('/f/', (req, res) => mostrarTablon('f', 'Fandoms', req, res));

// ========== CREAR HILO ==========
app.post('/crear-hilo', upload.single('imagen'), (req, res) => {
  if (estaBaneado(req)) return res.send('Estás baneado.');

  const { board, titulo, comentario } = req.body;
  const imagen = req.file ? req.file.filename : null;
  const autor = 'Anónimo';
  const ip = getIP(req);

  db.prepare(`
    INSERT INTO hilos (board, titulo, comentario, imagen, autor, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(board, titulo || null, comentario, imagen, autor, ip);

  res.redirect('/' + board + '/');
});

// ========== VER HILO ==========
app.get('/hilo/:id', (req, res) => {
  const hilo = db.prepare('SELECT * FROM hilos WHERE id = ?').get(req.params.id);
  if (!hilo) return res.send('Hilo no encontrado');

  const respuestas = db.prepare('SELECT * FROM respuestas WHERE hilo_id = ? ORDER BY id ASC').all(req.params.id);

  let respuestasHTML = '';
  respuestas.forEach(r => {
    const img = r.imagen ? `<br><img src="/uploads/${r.imagen}" style="max-width:160px;">` : '';
    respuestasHTML += `
      <div style="background:#fff; border:1px solid #ddd; padding:10px; margin:8px 0; border-radius:4px;">
        <small style="color:#777;">#${r.id} • ${r.autor || 'Anónimo'} • ${r.fecha}</small>
        <p>${r.comentario}</p>
        ${img}
      </div>
    `;
  });

  const imagenHilo = hilo.imagen ? `<br><img src="/uploads/${hilo.imagen}" style="max-width:220px;">` : '';

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hilo #${hilo.id}</title>
  <style>
    body { font-family: sans-serif; background: #f5f0e6; color: #333; margin: 0; padding: 15px; }
    a { color: #0066cc; }
    textarea, button, input { width: 100%; padding: 10px; margin: 6px 0; box-sizing: border-box; }
    button { background: #8B0000; color: white; border: none; border-radius: 4px; }
  </style>
</head>
<body>
  <p><a href="/\( {hilo.board}/">← Volver a / \){hilo.board}/</a></p>

  <div style="background:#fff; border:1px solid #ddd; padding:15px; border-radius:6px;">
    <h2>${hilo.titulo || '(Sin título)'}</h2>
    <small style="color:#777;">#${hilo.id} • ${hilo.autor || 'Anónimo'} • ${hilo.fecha}</small>
    <p>${hilo.comentario || ''}</p>
    ${imagenHilo}
  </div>

  <h3>Respuestas</h3>
  ${respuestasHTML || '<p style="color:#666;">Nadie ha respondido aún</p>'}

  <div style="background:#fff; border:1px solid #ddd; padding:15px; border-radius:6px; margin-top:20px;">
    <h3>Responder</h3>
    <form action="/responder/${hilo.id}" method="POST" enctype="multipart/form-data">
      <textarea name="comentario" rows="3" placeholder="Tu respuesta..." required></textarea>
      <input type="file" name="imagen" accept="image/*">
      <button type="submit">Enviar respuesta</button>
    </form>
  </div>
</body>
</html>
  `);
});

// ========== RESPONDER ==========
app.post('/responder/:id', upload.single('imagen'), (req, res) => {
  if (estaBaneado(req)) return res.send('Estás baneado.');

  const comentario = req.body.comentario;
  const imagen = req.file ? req.file.filename : null;
  const ip = getIP(req);

  db.prepare(`
    INSERT INTO respuestas (hilo_id, comentario, imagen, autor, ip)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, comentario, imagen, 'Anónimo', ip);

  res.redirect('/hilo/' + req.params.id);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('Foro corriendo en http://localhost:' + PORT);
});
