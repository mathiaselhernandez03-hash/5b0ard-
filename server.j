7const http = require('http');
const fs = require('fs');
const path = require('path');

// ========== CONFIGURACIÓN ==========
const PORT = process.env.PORT || 3000;
const ADMIN_PASS = "pon-tu-contraseña-aqui"; // ← CAMBIA ESTA POR LA TUYA
const BANNED_FILE = path.join(__dirname, 'datos', 'baneados.json');
const THREADS_FILE = path.join(__dirname, 'datos', 'hilos.json');
const LOGO_PATH = path.join(__dirname, 'public', 'logo.png');

// ========== CREAR CARPETAS ==========
['datos', 'uploads', 'public'].forEach(folder => {
  const dir = path.join(__dirname, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ========== FUNCIONES AUXILIARES ==========
function cargarJSON(archivo, defecto) {
  try {
    return fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, 'utf8')) : defecto;
  } catch { return defecto; }
}
function guardarJSON(archivo, datos) {
  fs.writeFileSync(archivo, JSON.stringify(datos, null, 2));
}
function obtenerIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
}
function obtenerRol(url) {
  const pass = url.searchParams.get('pass') || '';
  if (pass === ADMIN_PASS) return 'admin';
  return 'usuario';
}
function estaBaneado(ip) {
  const baneados = cargarJSON(BANNED_FILE, []);
  return baneados.some(b => b.ip === ip);
}

// ========== PLANTILLAS HTML ==========
function paginaInicio() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>5b0ard</title>
  <style>
    body { background: #FFFFEE; font-family: Arial, sans-serif; margin: 0; padding: 20px; text-align: center; color: #800000; }
    .logo-container { margin: 20px 0; }
    .logo-img { max-width: 320px; height: auto; }
    .slogan { font-style: italic; margin: 10px 0 30px; color: #800000; }
    .news-box { background: #F0E0D6; border: 1px solid #D0B0A0; padding: 15px; max-width: 600px; margin: 0 auto 30px; text-align: left; font-size: 14px; }
    .enter-btn { padding: 10px 24px; font-size: 16px; background: #AA0000; color: white; border: none; cursor: pointer; border-radius: 2px; }
    .enter-btn:hover { background: #CC0000; }
    .nav-links { margin-top: 30px; }
    .nav-links a { margin: 0 8px; color: #0000EE; text-decoration: underline; font-size: 14px; }
    .footer { margin-top: 40px; font-size: 11px; color: #808080; }
  </style>
</head>
<body>

  <div class="logo-container">
    <img src="/logo.png" alt="5b0ard" class="logo-img">
  </div>

  <p class="slogan">"todo se vale / anything goes"</p>

  <div class="news-box">
    <strong>NOTICIAS / NEWS</strong>
    <p><strong>ES:</strong> Aquí todo vale. Socializa de lo que quieras, di lo que quieras. No te tomes nada en serio — si lo haces, tú eres el lulz.</p>
    <p><strong>EN:</strong> Anything goes here. Talk about whatever you want, say whatever you want. Don't take anything seriously — if you do, you're an idiot.</p>
  </div>

  <button class="enter-btn" onclick="window.location.href='/b/'">Entra a /b/ - Random</button>

  <div class="nav-links">
    <a href="/b/">Tablero /b/</a> |
    <a href="/admin">Panel Admin</a> |
    <a href="/mod">Panel Moderador</a>
  </div>

  <div class="footer">
    <p>All trademarks and copyrights on this page are owned by their respective parties.<br>
    This site © 2024 5b0ard — Sonic the Hedgehog and related properties are © SEGA.</p>
  </div>

</body>
</html>`;
}

function paginaB(rol = 'usuario', mensaje = '') {
  const hilos = cargarJSON(THREADS_FILE, []);
  const hilosHtml = hilos.length === 0
    ? '<p style="color:#800000; text-align:center;">No hay hilos activos. ¡Sé el primero!</p>'
    : hilos.map((h, i) => `
      <div style="border:1px solid #D0B0A0; background:#F0E0D6; padding:12px; margin:12px auto; max-width:600px; text-align:left;">
        <strong style="color:#800000;">${h.titulo || 'Sin título'}</strong>
        <p style="white-space:pre-wrap;">${h.contenido}</p>
        <small style="color:#666;">Anónimo — ${h.fecha}</small>
        ${rol === 'admin' ? `<br><a href="/borrar-hilo?id=${i}" style="color:red; font-size:13px;">[Borrar hilo]</a>` : ''}
      </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>/b/ - Tablón Anónimo</title>
  <style>
    body { background: #FFFFEE; font-family: Arial, sans-serif; margin: 20px; color: #800000; }
    h2 { text-align: center; background: #F0E0D6; padding: 10px; border: 1px solid #D0B0A0; }
    form { max-width: 500px; margin: 0 auto 30px; background: #F0E0D6; padding: 20px; border: 1px solid #D0B0A0; }
    input, textarea { width: 100%; margin: 5px 0; padding: 8px; border: 1px solid #aaa; box-sizing: border-box; }
    button { padding: 8px 16px; background: #AA0000; color: white; border: none; cursor: pointer; }
    button:hover { background: #CC0000; }
    .mensaje { text-align:center; color:green; }
  </style>
</head>
<body>

  <h2>/b/ - Tablón Anónimo</h2>

  ${mensaje ? `<p class="mensaje">${mensaje}</p>` : ''}

  <form method="post" action="/b/nuevo">
    <input type="text" name="titulo" placeholder="Título (Opcional)">
    <textarea name="contenido" placeholder="Comentario..." rows="4" required></textarea>
    <input type="file" name="archivo">
    <button type="submit">Publicar Hilo</button>
  </form>

  <hr style="border: none; border-top: 1px solid #D0B0A0; max-width: 640px;">

  ${hilosHtml}

  <p style="text-align:center;"><a href="/" style="color:#0000EE;">← Volver al inicio</a></p>

</body>
</html>`;
}

function paginaAdmin(error = false) {
  const baneados = cargarJSON(BANNED_FILE, []);
  const listaBaneados = baneados.map((b, i) => `
    <tr>
      <td>${b.ip}</td>
      <td>${b.razon}</td>
      <td>${b.fecha}</td>
      <td><a href="/desbanear?id=${i}" style="color:red;">[Desbanear]</a></td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Panel de Administración</title>
  <style>
    body { background: #FFFFEE; font-family: Arial; margin: 20px; color: #800000; }
    h2 { text-align: center; color: #AA0000; }
    form { max-width: 500px; margin: 20px auto; background: #F0E0D6; padding: 20px; border: 1px solid #D0B0A0; }
    input, button { padding: 8px; margin: 5px 0; width: 100%; box-sizing: border-box; }
    table { margin: 20px auto; border-collapse: collapse; background: #F0E0D6; }
    th, td { border: 1px solid #D0B0A0; padding: 8px; }
    th { background: #E0C0B0; }
    .error { color: red; text-align: center; }
  </style>
</head>
<body>

  <h2>🔐 Panel de Administración</h2>

  ${error ? '<p class="error">Contraseña incorrecta</p>' : ''}

  <form method="post" action="/banear">
    <h3>Banear Usuario</h3>
    <input type="text" name="ip" placeholder="IP del usuario" required>
    <input type="text" name="razon" placeholder="Razón del baneo" required>
    <input type="password" name="pass" placeholder="Contraseña de Administrador" required>
    <button type="submit">🚫 Banear</button>
  </form>

  <h3 style="text-align:center;">Lista de Usuarios Baneados</h3>
  <table>
    <tr><th>IP</th><th>Razón</th><th>Fecha</th><th>Acción</th></tr>
    ${listaBaneados || '<tr><td colspan="4" style="text-align:center;">No hay usuarios baneados</td></tr>'}
  </table>

  <p style="text-align:center;"><a href="/" style="color:#0000EE;">← Volver al inicio</a></p>

</body>
</html>`;
}

function paginaMod() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Panel de Moderación</title>
  <style>
    body { background: #FFFFEE; font-family: Arial; margin: 20px; text-align:center; color: #800000; }
  </style>
</head>
<body>

  <h2>🛡️ Panel de Moderación</h2>
  <p>Desde aquí puedes gestionar contenido del tablero.</p>
  <p><a href="/b/" style="color:#0000EE;">→ Ir al tablero /b/</a></p>
  <p><a href="/" style="color:#0000EE;">← Volver al inicio</a></p>

</body>
</html>`;
}

function paginaBaneado() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>🚫 Baneado</title>
  <style>
    body { background: #FFFFEE; font-family: Arial; text-align: center; padding-top: 50px; color: #800000; }
    h1 { color: red; }
  </style>
</head>
<body>
  <h1>🚫 Has sido baneado</h1>
  <p>No tienes permiso para acceder a este tablero.</p>
  <p><a href="/" style="color:#0000EE;">← Volver al inicio</a></p>
</body>
</html>`;
}

function pagina404() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>404 - No encontrado</title>
  <style>
    body { background: #FFFFEE; font-family: Arial; text-align: center; padding-top: 50px; color: #800000; }
  </style>
</head>
<body>
  <h1>404 - Página no encontrada</h1>
  <p><a href="/" style="color:#0000EE;">← Volver al inicio</a></p>
</body>
</html>`;
}

// ========== SERVIDOR ==========
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const ip = obtenerIP(req);
  const rol = obtenerRol(url);

  // ========== SERVIR IMAGEN DEL LOGO ==========
  if (req.url === '/logo.png') {
    fs.readFile(LOGO_PATH, (err, data) => {
      if (err) {
        res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'});
        res.end('<h1>Logo no encontrado</h1><p>Coloca tu logo en public/logo.png</p>');
        return;
      }
      res.writeHead(200, {'Content-Type':'image/png'});
      res.end(data);
    });
    return;
  }

  // ========== RUTAS GET ==========
  if (req.method === 'GET') {
    if (url.pathname === '/' || url.pathname === '') {
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(paginaInicio());
    }
    else if (url.pathname === '/b/' || url.pathname === '/b') {
      if (estaBaneado(ip)) {
        res.writeHead(403, {'Content-Type':'text/html; charset=utf-8'});
        res.end(paginaBaneado());
        return;
      }
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(paginaB(rol));
    }
    else if (url.pathname === '/admin') {
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(paginaAdmin());
    }
    else if (url.pathname === '/mod') {
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(paginaMod());
    }
    else if (url.pathname === '/borrar-hilo' && rol === 'admin') {
      const hilos = cargarJSON(THREADS_FILE, []);
      const id = parseInt(url.searchParams.get('id'));
      if (!isNaN(id) && hilos[id]) {
        hilos.splice(id, 1);
        guardarJSON(THREADS_FILE, hilos);
      }
      res.writeHead(302, {Location: '/b/'});
      res.end();
    }
    else if (url.pathname === '/desbanear' && rol === 'admin') {
      const baneados = cargarJSON(BANNED_FILE, []);
      const id = parseInt(url.searchParams.get('id'));
      if (!isNaN(id) && baneados[id]) {
        baneados.splice(id, 1);
        guardarJSON(BANNED_FILE, baneados);
      }
      res.writeHead(302, {Location: '/admin'});
      res.end();
    }
    else {
      res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'});
      res.end(pagina404());
    }
  }

  // ========== RUTAS POST ==========
  else if (req.method === 'POST') {
    let cuerpo = '';
    req.on('data', chunk => cuerpo += chunk);
    req.on('end', () => {
      const params = new URLSearchParams(cuerpo);

      // Crear hilo
      if (url.pathname === '/b/nuevo') {
        if (estaBaneado(ip)) {
          res.writeHead(403, {'Content-Type':'text/html; charset=utf-8'});
          res.end(paginaBaneado());
          return;
        }
        const hilos = cargarJSON(THREADS_FILE, []);
        hilos.unshift({
          titulo: params.get('titulo') || '',
          contenido: params.get('contenido'),
          fecha: new Date().toLocaleString('es-CO'),
          ip: ip
        });
        guardarJSON(THREADS_FILE, hilos);
        res.writeHead(302, {Location: '/b/'});
        res.end();
      }

      // Banear usuario
      else if (url.pathname === '/banear') {
        if (params.get('pass') !== ADMIN_PASS) {
          res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
          res.end(paginaAdmin(true));
          return;
        }
        const baneados = cargarJSON(BANNED_FILE, []);
        baneados.push({
          ip: params.get('ip'),
          razon: params.get('razon'),
          fecha: new Date().toLocaleString('es-CO')
        });
        guardarJSON(BANNED_FILE, baneados);
        res.writeHead(302, {Location: '/admin'});
        res.end();
      }

      else {
        res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'});
        res.end(pagina404());
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`✅ 5b0ard corriendo en el puerto ${PORT}`);
});


