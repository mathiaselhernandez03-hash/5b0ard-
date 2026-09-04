
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_PASS = process.env.ADMIN_PASS || 'soymathias';

['datos', 'uploads', 'public'].forEach(carpeta => {
  if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
});

function leer(nombre) {
  try {
    const ruta = path.join('./datos', nombre);
    return fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : [];
  } catch { return []; }
}
function guardar(nombre, datos) {
  fs.writeFileSync(path.join('./datos', nombre), JSON.stringify(datos, null, 2));
}

function estaBaneado(ip) {
  const baneos = leer('baneos.json');
  return baneos.find(b => b.ip === ip && (b.hasta === 'perm' || new Date(b.hasta) > new Date()));
}

function getRol(password) {
  if (password === ADMIN_PASS) return 'admin';
  const mods = leer('moderadores.json');
  if (mods.includes(password)) return 'moderador';
  return 'usuario';
}

function servirArchivo(ruta, res) {
  const ext = path.extname(ruta).toLowerCase();
  const tipos = {
    '.html': 'text/html; charset=ISO-8859-1',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif'
  };
  fs.readFile(ruta, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    res.writeHead(200, { 'Content-Type': tipos[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function plantilla(titulo, contenido, rolActual = 'usuario') {
  return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
<meta charset="ISO-8859-1">
<title>${titulo} - 5b0ard</title>
<style type="text/css">
body { background-color: #FFFFEE; color: #800000; font-family: Arial, sans-serif; font-size: 10pt; margin: 0; }
a { color: #0000EE; text-decoration: none; }
a:visited { color: #800080; }
a:hover { text-decoration: underline; }
hr { border: 1px solid #B50000; }
h1, h2, h3 { text-align: center; font-weight: bold; margin: 8px 0; }
h1 { font-size: 16pt; color: #800000; }
h2 { font-size: 14pt; color: #800000; }
h3 { font-size: 12pt; color: #800000; }
.nav { background-color: #FFE4E1; border-bottom: 1px solid #B50000; padding: 4px 8px; text-align: center; }
.nav a { margin: 0 6px; }
.boardTitle { text-align: center; margin: 12px 0; }
.boardTitle img { max-width: 300px; }
.boardTitle .subtitle { color: #800000; font-size: 9pt; }
.post, .newsItem { background-color: #D6DAF0; border: 1px solid #B50000; border-left: 4px solid #B50000; margin: 8px auto; padding: 8px; max-width: 600px; }
.newsItem { background-color: #F0E68C; }
.post .postInfo, .newsItem .postInfo { font-size: 9pt; color: #000; margin-bottom: 4px; }
.post .postInfo .name { font-weight: bold; color: #117743; }
.post .postInfo .mod { font-weight: bold; color: #0066cc; }
.post .postInfo .admin { font-weight: bold; color: #FF0000; }
.post .postInfo .subject, .newsItem .subject { font-weight: bold; color: #0F0C5D; }
.post img { max-width: 200px; border: 1px solid #ccc; margin: 4px 8px 4px 0; float: left; }
.post .message, .newsItem .message { margin-left: 8px; overflow: hidden; white-space: pre-wrap; }
.reply { background-color: #E6E6FA; border: 1px solid #B50000; margin: 8px 8px 8px 32px; padding: 8px; max-width: 550px; }
.formArea { background-color: #D6DAF0; border: 1px solid #B50000; margin: 16px auto; padding: 12px; max-width: 320px; text-align: center; }
.formArea table { margin: 0 auto; }
input, textarea, select { border: 1px solid #aaa; font-family: Arial, sans-serif; font-size: 10pt; }
input[type="text"], input[type="password"], textarea, select { width: 240px; padding: 2px; }
input[type="submit"] { background-color: #FFE4E1; border: 1px solid #B50000; padding: 4px 12px; cursor: pointer; }
.footnote { text-align: center; font-size: 8pt; color: #800000; margin: 16px 0; }
.clear { clear: both; }
.error { color: red; text-align: center; }
.success { color: green; text-align: center; }
.mod-tools { font-size: 8pt; margin-top: 4px; }
.mod-tools a { color: #cc0000; }
</style>
</head>
<body>
<div class="nav">
  [<a href="/">Home</a>]
  [<a href="/b/">/b/ - Random</a>]
  [<a href="/news">News</a>]
  \${rolActual === 'admin' || rolActual === 'moderador' ? '[<a href="/mod-panel">Mod Panel</a>]' : ''}
</div>
<div class="boardTitle">
  <img src="/logo.png" alt="5b0ard"><br>
  <div class="subtitle">"todo se vale / anything goes"</div>
</div>
\${contenido}
<div class="footnote">
  All trademarks and copyrights on this page are owned by their respective parties.<br>
  5b0ard &copy; 2003-2026 — No registration required.
</div>
</body>
</html>`;
}

function parsearForm(req, callback) {
  const tipo = req.headers['content-type'] || '';
  if (!tipo.includes('multipart/form-data')) {
    let cuerpo = '';
    req.on('data', d => cuerpo += d);
    req.on('end', () => callback({ cuerpo }));
    return;
  }
  const boundary = tipo.split('boundary=')[1];
  let datos = Buffer.alloc(0);
  req.on('data', c => datos = Buffer.concat([datos, c]));
  req.on('end', () => {
    const partes = datos.toString('binary').split('--' + boundary);
    const campos = {};
    let archivo = null;
    partes.forEach(p => {
      if (!p || p === '--\r\n') return;
      const separador = '\r\n\r\n';
      const idx = p.indexOf(separador);
      if (idx < 0) return;
      const cabeceras = p.slice(0, idx).toString('utf8');
      const contenido = p.slice(idx + separador.length, p.length - 2);
      const nombre = cabeceras.match(/name="([^"]+)"/);
      const archivoNom = cabeceras.match(/filename="([^"]+)"/);
      if (nombre && !archivoNom) {
        campos[nombre[1]] = contenido.toString('utf8');
      } else if (nombre && archivoNom && archivoNom[1]) {
        const nombreGuardar = Date.now() + '-' + archivoNom[1];
        fs.writeFileSync(path.join('./uploads', nombreGuardar), contenido);
        archivo = { nombre: nombreGuardar };
      }
    });
    callback(campos, archivo);
  });
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.connection?.remoteAddress || '127.0.0.1';
}



const server = http.createServer((req, res) => {
  const ip = getClientIp(req);
  const baneoActivo = estaBaneado(ip);

  if (req.url === '/logo.png') return servirArchivo(path.join(__dirname, 'public', 'logo.png'), res);
  if (req.url.startsWith('/uploads/')) return servirArchivo(path.join(__dirname, req.url), res);

  if (baneoActivo && !req.url.startsWith('/baneado')) {
    res.writeHead(302, { 'Location': '/baneado' });
    return res.end();
  }
  if (req.url === '/baneado' && req.method === 'GET') {
    const baneo = estaBaneado(ip);
    return res.end(`
      <html><body style="background:#ffdddd; color:red; text-align:center; padding-top:50px; font-family:Arial;">
        <h1>⛔ HAS SIDO BANEADO</h1>
        <p><strong>Razón:</strong> \${baneo.razon || 'Sin especificar'}</p>
        <p><strong>Expira:</strong> \${baneo.hasta === 'perm' ? 'Permanentemente' : new Date(baneo.hasta).toLocaleString()}</p>
        <p style="margin-top:30px;"><a href="/" style="color:red;">No intentes volver.</a></p>
      </body></html>
    `);
  }

  let rolActual = 'usuario';
  let cuerpoPost = '';

  if (req.method === 'POST') {
    req.on('data', d => { cuerpoPost += d; });
  }

  if (req.url === '/' && req.method === 'GET') {
    const noticias = leer('noticias.json');
    let noticiasHTML = '';
    if (noticias.length > 0) {
      noticiasHTML = '<h3>📰 Últimas Noticias</h3>';
      noticias.slice(-3).reverse().forEach(n => {
        noticiasHTML += `
          <div class="newsItem">
            <div class="postInfo">
              <span class="subject">\${n.titulo}</span> — \${n.autor} — \${n.fecha}
            </div>
            <div class="message">\${n.contenido}</div>
          </div>
        `;
      });
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
    return res.end(plantilla('Home', `
      <h2>Welcome to 5b0ard</h2>
      <p style="text-align:center;">This is 5b0ard, a simple imageboard in the style of 2003.<br>No registration. Everything goes.</p>
      <div style="text-align:center; margin:24px;">
        [<a href="/b/">Enter /b/ - Random</a>]
        [<a href="/news">View all News</a>]
      </div>
      <hr>\${noticiasHTML}
    `, rolActual));
  }

  if (req.url === '/b/' && req.method === 'GET') {
    const hilos = leer('hilos.json');
    let html = '';
    if (hilos.length === 0) {
      html = '<p style="text-align:center; color:#777;">No threads yet. Be the first to post.</p>';
    } else {
      hilos.slice().reverse().forEach(h => {
        let etiquetaRol = 'name';
        let tituloRol = 'Anonymous';
        if (h.rol === 'admin') { etiquetaRol = 'admin'; tituloRol = '★ Admin'; }
        else if (h.rol === 'moderador') { etiquetaRol = 'mod'; tituloRol = '★ Moderador'; }
        html += `
          <div class="post">
            \${h.imagen ? '<img src="/uploads/' + h.imagen + '" alt="Image">' : ''}
            <div class="postInfo">
              \${h.titulo ? '<span class="subject">' + h.titulo + '</span> ' : ''}
              <span class="\${etiquetaRol}">\${tituloRol}</span> \${h.fecha} No.\${h.id}
            </div>
            <div class="message">\${h.comentario}</div>
            <div class="clear"></div>
            <div style="margin-top:4px; font-size:9pt;">
              [<a href="/hilo/\${h.id}">View replies</a>]
            </div>
          </div>
        `;
      });
    }
    html += `
      <div class="formArea">
        <form method="POST" action="/crear-hilo" enctype="multipart/form-data">
          <table>
            <tr><td>Subject</td><td><input type="text" name="titulo"></td></tr>
            <tr><td>Comment</td><td><textarea name="comentario" rows="3"></textarea></td></tr>
            <tr><td>Password</td><td><input type="password" name="password" placeholder="Tu contraseña"></td></tr>
            <tr><td>File</td><td><input type="file" name="imagen" accept="image/*" required></td></tr>
            <tr><td colspan="2" align="center"><input type="submit" value="Post"></td></tr>
          </table>
        </form>
      </div>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
    return res.end(plantilla('/b/ - Random', html, rolActual));
  }

  if (req.url === '/crear-hilo' && req.method === 'POST') {
    parsearForm(req, (campos, archivo) => {
      if (!archivo) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
        return res.end(plantilla('Error', '<p class="error">You must upload an image.</p>'));
      }
      const rol = getRol(campos.password || '');
      const hilos = leer('hilos.json');
      hilos.push({
        id: hilos.length ? Math.max(...hilos.map(h => h.id)) + 1 : 1,
        titulo: campos.titulo || '',
        comentario: campos.comentario || '',
        imagen: archivo.nombre,
        rol: rol,
        ip: ip,
        fecha: new Date().toLocaleString('en-US', {dateStyle:'medium', timeStyle:'short'})
      });
      guardar('hilos.json', hilos);
      res.writeHead(302, { 'Location': '/b/' });
      res.end();
    });
    return;
  }

  if (req.url === '/news' && req.method === 'GET') {
    const noticias = leer('noticias.json');
    let html = '<h2>📰 News / Anuncios</h2>';
    if (noticias.length === 0) {
      html += '<p style="text-align:center; color:#777;">No hay noticias todavía.</p>';
    } else {
      noticias.slice().reverse().forEach(n => {
        html += `
          <div class="newsItem">
            <div class="postInfo">
              <span class="subject">\${n.titulo}</span> — \${n.autor} — \${n.fecha}
            </div>
            <div class="message">\${n.contenido}</div>
          </div>
        `;
      });
    }
    html += `
      <div class="formArea">
        <form method="POST" action="/post-news">
          <table>
            <tr><td>Password</td><td><input type="password" name="password" placeholder="Solo Admin/Mod"></td></tr>
            <tr><td>Title</td><td><input type="text" name="titulo" required></td></tr>
            <tr><td>Content</td><td><textarea name="contenido" rows="3" required></textarea></td></tr>
            <tr><td colspan="2" align="center"><input type="submit" value="Post News"></td></tr>
          </table>
        </form>
      </div>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
    return res.end(plantilla('News', html, rolActual));
  }

  if (req.url === '/post-news' && req.method === 'POST') {
    req.on('end', () => {
      const params = new URLSearchParams(cuerpoPost);
      const rol = getRol(params.get('password') || '');
      if (rol !== 'admin' && rol !== 'moderador') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
        return res.end(plantilla('Error', '<p class="error">⛔ No tienes permiso para publicar noticias.</p>'));
      }
      const noticias = leer('noticias.json');
      noticias.push({
        titulo: params.get('titulo') || 'Sin título',
        contenido: params.get('contenido') || '',
        autor: rol === 'admin' ? '★ Admin' : '★ Moderador',
        fecha: new Date().toLocaleString('en-US', {dateStyle:'medium', timeStyle:'short'})
      });
      guardar('noticias.json', noticias);
      res.writeHead(302, { 'Location': '/news' });
      res.end();
    });
    return;
  }

  if (req.url === '/mod-panel' && req.method === 'GET') {
    let html = '<h2>🔧 Panel de Moderación</h2>';
    html += `
      <div class="formArea">
        <h3>Agregar Moderador</h3>
        <form method="POST" action="/agregar-mod">
          <table>
            <tr><td>Contraseña Mod</td><td><input type="password" name="mod_pass" placeholder="Clave para el nuevo mod" required></td></tr>
            <tr><td>Tu Pass (Admin)</td><td><input type="password" name="admin_pass" required></td></tr>
            <tr><td colspan="2" align="center"><input type="submit" value="Agregar Mod"></td></tr>
          </table>
        </form>
      </div>
      <div class="formArea">
        <h3>Banear Usuario por IP</h3>
        <form method="POST" action="/banear">
          <table>
            <tr><td>IP</td><td><input type="text" name="ip" placeholder="123.45.67.89" required></td></tr>
            <tr><td>Razón</td><td><input type="text" name="razon" required></td></tr>
            <tr><td>Duración</td><td>
              <select name="duracion">
                <option value="1d">1 Día</option>
                <option value="7d">7 Días</option>
                <option value="30d">30 Días</option>
                <option value="perm">Permanente</option>
              </select>
            </tr>
            <tr><td>Tu Pass</td><td><input type="password" name="password" required></td></tr>
            <tr><td colspan="2" align="center"><input type="submit" value="Banear"></td></tr>
          </table>
        </form>
      </div>
      <div class="formArea">
        <h3>Lista de Baneos Activos</h3>
    `;
    const baneos = leer('baneos.json').filter(b => new Date(b.hasta) > new Date() || b.hasta === 'perm');
    if (baneos.length === 0) {
      html += '<p style="color:#777;">No hay baneos activos.</p>';
    } else {
      baneos.forEach(b => {
        html += `<p><strong>\${b.ip}</strong><br>Razón: \${b.razon}<br>Hasta: \${b.hasta === 'perm' ? 'Permanente' : new Date(b.hasta).toLocaleString()}<br>
          <form method="POST" action="/desbanear" style="display:inline;">
            <input type="hidden" name="ip" value="\${b.ip}">
            <input type="password" name="password" placeholder="Tu pass" style="width:100px;">
            <input type="submit" value="Desbanear">
          </form>
        </p><hr>`;
      });
    }
    html += '</div><p style="text-align:center;">[<a href="/b/">Volver al foro</a>]</p>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
    return res.end(plantilla('Panel de Moderación', html, rolActual));
  }

  if (req.url === '/agregar-mod' && req.method === 'POST') {
    req.on('end', () => {
      const params = new URLSearchParams(cuerpoPost);
      if (params.get('admin_pass') !== ADMIN_PASS) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
        return res.end(plantilla('Error', '<p class="error">⛔ Solo el administrador puede agregar moderadores.</p>'));
      }
      const mods = leer('moderadores.json');
      const nuevaPass = params.get('mod_pass');
      if (!mods.includes(nuevaPass)) mods.push(nuevaPass);
      guardar('moderadores.json', mods);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
      res.end(plantilla('Éxito', '<p class="success">✅ Moderador agregado correctamente.</p><p style="text-align:center;">[<a href="/mod-panel">Volver al panel</a>]</p>'));
    });
    return;
  }

  if (req.url === '/banear' && req.method === 'POST') {
    req.on('end', () => {
      const params = new URLSearchParams(cuerpoPost);
      const rol = getRol(params.get('password') || '');
      if (rol !== 'admin' && rol !== 'moderador') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
        return res.end(plantilla('Error', '<p class="error">⛔ No tienes permiso para banear.</p>'));
      }
      const ipObjetivo = params.get('ip');
      const razon = params.get('razon') || 'Sin especificar';
      const duracion = params.get('duracion');
      let hasta;
      if (duracion === 'perm') {
        hasta = 'perm';
      } else {
        const ms = { '1d': 86400000, '7d': 604800000, '30d': 2592000000 }[duracion] || 86400000;
        hasta = new Date(Date.now() + ms).toISOString();
      }
      let baneos = leer('baneos.json');
      baneos = baneos.filter(b => b.ip !== ipObjetivo);
      baneos.push({ ip: ipObjetivo, razon, hasta, fecha: new Date().toISOString() });
      guardar('baneos.json', baneos);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
      res.end(plantilla('Baneado', `<p class="success">✅ Usuario baneado.<br>IP: \${ipObjetivo}<br>Razón: \${razon}<br>Hasta: \${hasta === 'perm' ? 'Permanente' : new Date(hasta).toLocaleString()}</p><p style="text-align:center;">[<a href="/mod-panel">Volver</a>]</p>`));
    });
    return;
  }

  if (req.url === '/desbanear' && req.method === 'POST') {
    req.on('end', () => {
      const params = new URLSearchParams(cuerpoPost);
      const rol = getRol(params.get('password') || '');
      if (rol !== 'admin' && rol !== 'moderador') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
        return res.end(plantilla('Error', '<p class="error">⛔ Sin permiso.</p>'));
      }
      let baneos = leer('baneos.json');
      baneos = baneos.filter(b => b.ip !== params.get('ip'));
      guardar('baneos.json', baneos);
      res.writeHead(302, { 'Location': '/mod-panel' });
      res.end();
    });
    return;
  }

  const hiloMatch = req.url.match(/^\/hilo\/(\\d+)$/);
  if (hiloMatch && req.method === 'GET') {
    const id = parseInt(hiloMatch[1]);
    const hilos = leer('hilos.json');
    const respuestas = leer(`respuestas_\${id}.json`);
    const hilo = hilos.find(h => h.id === id);
    if (!hilo) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
      return res.end(plantilla('Not Found', '<p class="error">Thread not found.</p>'));
    }
    let etiquetaRol = 'name';
    let tituloRol = 'Anonymous';
    if (hilo.rol === 'admin') { etiquetaRol = 'admin'; tituloRol = '★ Admin'; }
    else if (hilo.rol === 'moderador') { etiquetaRol = 'mod'; tituloRol = '★ Moderador'; }
    let html = `
      <div class="post">
        \${hilo.imagen ? '<img src="/uploads/' + hilo.imagen + '" alt="Image">' : ''}
        <div class="postInfo">
          \${hilo.titulo ? '<span class="subject">' + hilo.titulo + '</span> ' : ''}
          <span class="\${etiquetaRol}">\${tituloRol}</span> \${hilo.fecha} No.\${hilo.id}
        </div>
        <div class="message">\${hilo.comentario}</div>
        <div class="clear"></div>
      </div>
      <hr>
    `;
    respuestas.forEach(r => {
      let rEtiqueta = 'name';
      let rTitulo = 'Anonymous';
      if (r.rol === 'admin') { rEtiqueta = 'admin'; rTitulo = '★ Admin'; }
      else if (r.rol === 'moderador') { rEtiqueta = 'mod'; rTitulo = '★ Moderador'; }
      html += `
        <div class="reply">
          \${r.imagen ? '<img src="/uploads/' + r.imagen + '" alt="Image">' : ''}
          <div class="postInfo">
            <span class="\${rEtiqueta}">\${rTitulo}</span> \${r.fecha} No.\${r.id}
          </div>
          <div class="message">\${r.comentario}</div>
          <div class="clear"></div>
        </div>
      `;
    });
    html += `
      <div class="formArea">
        <form method="POST" action="/responder/\${id}" enctype="multipart/form-data">
          <table>
            <tr><td>Comment</td><td><textarea name="comentario" rows="3"></textarea></td></tr>
            <tr><td>Password</td><td><input type="password" name="password"></td></tr>
            <tr><td>File</td><td><input type="file" name="imagen" accept="image/*"></td></tr>
            <tr><td colspan="2" align="center"><input type="submit" value="Reply"></td></tr>
          </table>
        </form>
      </div>
      <p style="text-align:center;">[<a href="/b/">Return</a>]</p>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
    return res.end(plantilla(`Thread No.\${id}`, html, rolActual));
  }

  const respMatch = req.url.match(/^\/responder\/(\\d+)$/);
  if (respMatch && req.method === 'POST') {
    const id = parseInt(respMatch[1]);
    parsearForm(req, (campos, archivo) => {
      const respuestas = leer(`respuestas_\${id}.json`);
      const rol = getRol(campos.password || '');
      respuestas.push({
        id: respuestas.length + 1,
        comentario: campos.comentario || '',
        imagen: archivo ? archivo.nombre : null,
        rol: rol,
        ip: ip,
        fecha: new Date().toLocaleString('en-US', {dateStyle:'medium', timeStyle:'short'})
      });
      guardar(`respuestas_\${id}.json`, respuestas);
      res.writeHead(302, { 'Location': `/hilo/\${id}` });
      res.end();
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/html; charset=ISO-8859-1' });
  res.end(plantilla('404', '<p class="error">404 — That page does not exist.<br>[<a href="/">Return home</a>]</p>'));
});

server.listen(PORT, () => {
  console.log(`✅ 5b0ard running on port \${PORT}`);
});

