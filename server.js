const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Crear carpetas necesarias
['datos', 'uploads', 'public'].forEach(carpeta => {
  if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
});

// Guardar y leer datos en archivos JSON
function leer(nombre) {
  try {
    const ruta = path.join('./datos', nombre);
    return fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : [];
  } catch { return []; }
}
function guardar(nombre, datos) {
  fs.writeFileSync(path.join('./datos', nombre), JSON.stringify(datos));
}

// Servir archivos estáticos (imágenes, etc.)
function servirArchivo(ruta, res) {
  const ext = path.extname(ruta).toLowerCase();
  const tipos = {
    '.html': 'text/html; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif'
  };
  const contenidoTipo = tipos[ext] || 'application/octet-stream';

  fs.readFile(ruta, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 No encontrado');
    }
    res.writeHead(200, { 'Content-Type': contenidoTipo });
    res.end(data);
  });
}

// Plantilla con tu logo 530ARD
function plantilla(contenido) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>530ARD - Foro</title>
<style>
  * { box-sizing: border-box; }
  body { background: #000; color: #fff; margin: 0; font-family: Arial, sans-serif; }
  .logo { text-align: center; padding: 20px 20px 10px; }
  .logo img { max-width: 400px; width: 100%; }
  .nav { background: #0066aa; padding: 12px; text-align: center; }
  .nav a { color: #fff; margin: 0 15px; text-decoration: none; font-weight: bold; }
  .nav a:hover { text-decoration: underline; }
  .container { max-width: 900px; margin: 20px auto; padding: 0 15px; }
  .hilo, .respuesta { border: 1px solid #333; background: #111; padding: 15px; margin: 15px 0; overflow: auto; }
  .respuesta { background: #181818; }
  .hilo img, .respuesta img { max-width: 300px; margin: 10px 0; }
  .form-box { background: #1a1a1a; padding: 20px; margin-top: 30px; border-radius: 8px; }
  .form-box h3 { color: #00ccff; margin-top: 0; }
  input, textarea { width: 100%; padding: 10px; margin-bottom: 10px; background: #222; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 16px; }
  button { background: #00ccff; color: #000; border: none; padding: 12px 25px; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 16px; }
  button:hover { background: #33ddff; }
  a.link { color: #00ccff; text-decoration: none; }
  a.link:hover { text-decoration: underline; }
  .error { color: #ff6666; text-align: center; }
  .vacio { color: #888; text-align: center; margin-top: 50px; }
  .admin-tag { color: #ffcc00; font-weight: bold; }
</style>
</head>
<body>

<div class="logo">
<img src="/logo.png" alt="530ARD">
</div>

<div class="nav">
<a href="/">Inicio</a>
<a href="/b/">/b/ - Random</a>
</div>

<div class="container">
${contenido}
</div>

</body>
</html>`;
}

// Parsear formularios con archivos (sin multer)
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
        const ext = path.extname(archivoNom[1]) || '.png';
        const nombreGuardar = Date.now() + '-' + archivoNom[1];
        const rutaGuardar = path.join('./uploads', nombreGuardar);
        fs.writeFileSync(rutaGuardar, contenido);
        archivo = { nombre: nombreGuardar };
      }
    });
    callback(campos, archivo);
  });
}

const server = http.createServer((req, res) => {

  // Servir logo y archivos subidos
  if (req.url === '/logo.png') {
    return servirArchivo(path.join(__dirname, 'public', 'logo.png'), res);
  }
  if (req.url.startsWith('/uploads/')) {
    return servirArchivo(path.join(__dirname, req.url), res);
  }

  // Página de inicio
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(plantilla(`
      <h1 style="text-align:center; color:#00ccff; font-size:42px;">Bienvenido a 530ARD</h1>
      <p style="text-align:center; font-size:18px; color:#aaa;">Todo se vale. Entra, lee y participa.</p>
      <div style="text-align:center; margin-top:40px;">
        <a href="/b/" style="background:#00ccff; color:#000; padding:14px 35px; text-decoration:none; font-weight:bold; border-radius:6px; font-size:18px;">Ir al foro</a>
      </div>
    `));
  }

  // Tablero /b/
  if (req.url === '/b/' && req.method === 'GET') {
    const hilos = leer('hilos.json');
    let html = '';

    if (hilos.length === 0) {
      html = `<p class="vacio">No hay hilos todavía. ¡Sé el primero en publicar!</p>`;
    } else {
      hilos.slice().reverse().forEach(h => {
        const etiquetaAdmin = h.username === 'Admin' ? '<span class="admin-tag">★ Admin</span> — ' : '';
        html += `
          <div class="hilo">
            ${etiquetaAdmin}<strong>${h.username}</strong> — ${h.fecha}
            <h3 style="color:#00ccff; margin:8px 0;">${h.titulo || 'Sin título'}</h3>
            ${h.imagen ? `<img src="/uploads/${h.imagen}" alt="Imagen">` : ''}
            <p>${h.comentario}</p>
            <a href="/hilo/${h.id}" class="link">Ver respuestas &rarr;</a>
          </div>
        `;
      });
    }

    html += `
      <div class="form-box">
        <h3>Crear nuevo hilo</h3>
        <form method="POST" action="/crear-hilo" enctype="multipart/form-data">
          <input type="text" name="titulo" placeholder="Título (opcional)">
          <textarea name="comentario" placeholder="Tu comentario..." rows="4" required></textarea>
          <input type="password" name="password" placeholder="Contraseña (pon soymathias para ser Admin)">
          <input type="file" name="imagen" accept="image/*" required>
          <button type="submit">Publicar hilo</button>
        </form>
      </div>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(plantilla(html));
  }

  // Crear hilo
  if (req.url === '/crear-hilo' && req.method === 'POST') {
    parsearForm(req, (campos, archivo) => {
      if (!archivo) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(plantilla('<p class="error">Error: debes subir una imagen</p>'));
      }
      const hilos = leer('hilos.json');
      const username = campos.password === 'soymathias' ? 'Admin' : 'Anónimo';
      hilos.push({
        id: hilos.length ? Math.max(...hilos.map(h => h.id)) + 1 : 1,
        titulo: campos.titulo || '',
        comentario: campos.comentario || '',
        imagen: archivo.nombre,
        username,
        fecha: new Date().toLocaleString('es-CO')
      });
      guardar('hilos.json', hilos);
      res.writeHead(302, { 'Location': '/b/' });
      res.end();
    });
    return;
  }

  // Ver hilo individual
  const hiloMatch = req.url.match(/^\/hilo\/(\d+)$/);
  if (hiloMatch && req.method === 'GET') {
    const id = parseInt(hiloMatch[1]);
    const hilos = leer('hilos.json');
    const respuestas = leer(`respuestas_${id}.json`);
    const hilo = hilos.find(h => h.id === id);

    if (!hilo) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(plantilla('<p class="error">Hilo no encontrado</p>'));
    }

    const etiquetaAdminHilo = hilo.username === 'Admin' ? '<span class="admin-tag">★ Admin</span> — ' : '';

    let html = `
      <div class="hilo">
        ${etiquetaAdminHilo}<strong>${hilo.username}</strong> — ${hilo.fecha}
        <h3 style="color:#00ccff;">${hilo.titulo || 'Sin título'}</h3>
        ${hilo.imagen ? `<img src="/uploads/${hilo.imagen}" alt="Imagen">` : ''}
        <p>${hilo.comentario}</p>
      </div>
      <h3 style="color:#00ccff;">Respuestas</h3>
    `;

    if (respuestas.length === 0) {
      html += `<p class="vacio">Sé el primero en responder</p>`;
    } else {
      respuestas.forEach(r => {
        const etiquetaAdminResp = r.username === 'Admin' ? '<span class="admin-tag">★ Admin</span> — ' : '';
        html += `
          <div class="respuesta">
            ${etiquetaAdminResp}<strong>${r.username}</strong> — ${r.fecha}
            ${r.imagen ? `<img src="/uploads/${r.imagen}" alt="Imagen">` : ''}
            <p>${r.comentario}</p>
          </div>
        `;
      });
    }

    html += `
      <div class="form-box">
        <h3>Responder</h3>
        <form method="POST" action="/responder/${id}" enctype="multipart/form-data">
          <textarea name="comentario" placeholder="Tu respuesta..." rows="3" required></textarea>
          <input type="password" name="password" placeholder="Contraseña (soymathias = Admin)">
          <input type="file" name="imagen" accept="image/*">
          <button type="submit">Responder</button>
        </form>
      </div>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(plantilla(html));
  }

  // Responder a un hilo
  const respMatch = req.url.match(/^\/responder\/(\d+)$/);
  if (respMatch && req.method === 'POST') {
    const id = parseInt(respMatch[1]);
    parsearForm(req, (campos, archivo) => {
      const respuestas = leer(`respuestas_${id}.json`);
      const username = campos.password === 'soymathias' ? 'Admin' : 'Anónimo';
      respuestas.push({
        id: respuestas.length + 1,
        comentario: campos.comentario || '',
        imagen: archivo ? archivo.nombre : null,
        username,
        fecha: new Date().toLocaleString('es-CO')
      });
      guardar(`respuestas_${id}.json`, respuestas);
      res.writeHead(302, { 'Location': `/hilo/${id}` });
      res.end();
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(plantilla('<h2 class="error">404 — Página no encontrada</h2><p style="text-align:center;"><a href="/" class="link">Volver al inicio</a></p>'));
});

server.listen(PORT, () => {
  console.log(`✅ 530ARD corriendo en puerto ${PORT}`);
});


