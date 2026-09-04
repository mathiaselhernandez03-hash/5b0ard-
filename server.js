const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Carpeta para guardar datos
const DATA_DIR = './datos';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Configuración multer para imágenes
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

// Funciones para guardar/cargar datos (archivos JSON en vez de SQLite)
function leerArchivo(nombre) {
  try {
    const ruta = path.join(DATA_DIR, nombre);
    if (!fs.existsSync(ruta)) return [];
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch { return []; }
}
function guardarArchivo(nombre, datos) {
  fs.writeFileSync(path.join(DATA_DIR, nombre), JSON.stringify(datos, null, 2));
}

// Plantilla con logo y título Sonic
function PaginaHTML(contenido) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sonic - Foro</title>
</head>
<body style="background:#000; color:#fff; margin:0; font-family:sans-serif;">

<div style="text-align:center; padding:20px;">
<img src="/logo.png" alt="Sonic" style="max-width:300px;">
</div>

<div style="background:#0066aa; padding:10px 20px; text-align:center;">
<a href="/" style="color:#fff; text-decoration:none; margin:0 15px;">Inicio</a>
<a href="/b/" style="color:#fff; text-decoration:none; margin:0 15px;">/b/ - Random</a>
</div>

<div style="max-width:900px; margin:20px auto; padding:0 15px;">
${contenido}
</div>

</body>
</html>`;
}

// Página principal
app.get('/', (req, res) => {
  res.send(PaginaHTML(`
    <h1 style="text-align:center; color:#00ccff; font-size:48px;">SONIC FORO</h1>
    <p style="text-align:center; font-size:18px; color:#aaa;">Todo se vale, socializa de lo que quieras</p>
    <div style="text-align:center; margin-top:40px;">
      <a href="/b/" style="background:#00ccff; color:#000; padding:12px 30px; text-decoration:none; font-weight:bold; border-radius:5px;">Entrar al foro</a>
    </div>
  `));
});

// Tablero /b/
app.get('/b/', (req, res) => {
  const hilos = leerArchivo('hilos.json');
  let html = '';

  if (hilos.length === 0) {
    html = `<p style="text-align:center; color:#888; margin-top:50px;">No hay hilos todavía. ¡Sé el primero en publicar!</p>`;
  } else {
    hilos.reverse().forEach(h => {
      const img = h.imagen ? `<a href="/uploads/${h.imagen}" target="_blank"><img src="/uploads/${h.imagen}" style="max-width:180px; float:left; margin-right:15px; margin-bottom:10px;"></a>` : '';
      html += `
        <div style="border:1px solid #333; background:#111; padding:15px; margin:15px 0; overflow:auto;">
          <strong>${h.username}</strong> - ${h.fecha}
          <h3 style="color:#00ccff; margin:5px 0;">${h.titulo || 'Sin título'}</h3>
          ${img}
          <p style="margin-top:8px;">${h.comentario}</p>
          <div style="clear:both;"></div>
          <a href="/hilo/${h.id}" style="color:#00ccff;">Ver respuestas &rarr;</a>
        </div>
      `;
    });
  }

  html += `
    <div style="background:#1a1a1a; padding:20px; margin-top:30px; border-radius:8px;">
      <h3 style="color:#00ccff; margin-top:0;">Crear nuevo hilo</h3>
      <form method="POST" action="/crear-hilo" enctype="multipart/form-data">
        <input type="text" name="titulo" placeholder="Título (opcional)" style="width:100%; padding:10px; margin-bottom:10px; background:#222; border:1px solid #444; color:#fff; border-radius:4px;"><br>
        <textarea name="comentario" placeholder="Tu comentario..." rows="4" style="width:100%; padding:10px; margin-bottom:10px; background:#222; border:1px solid #444; color:#fff; border-radius:4px;"></textarea><br>
        <input type="password" name="password" placeholder="Contraseña (solo tú)" style="width:100%; padding:10px; margin-bottom:10px; background:#222; border:1px solid #444; color:#fff; border-radius:4px;"><br>
        <input type="file" name="imagen" accept="image/*" style="margin-bottom:10px;"><br>
        <button type="submit" style="background:#00ccff; color:#000; border:none; padding:10px 25px; font-weight:bold; border-radius:4px; cursor:pointer;">Publicar hilo</button>
      </form>
    </div>
  `;

  res.send(PaginaHTML(html));
});

// Crear hilo
app.post('/crear-hilo', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.send(PaginaHTML('<p style="color:red;">Error: debes subir una imagen</p>'));
  
  const hilos = leerArchivo('hilos.json');
  const username = req.body.password === 'matt2026' ? 'just matt' : 'Anónimo';
  
  const nuevo = {
    id: hilos.length ? Math.max(...hilos.map(h => h.id)) + 1 : 1,
    titulo: req.body.titulo || '',
    comentario: req.body.comentario || '',
    imagen: req.file.filename,
    username,
    fecha: new Date().toLocaleString('es-CO')
  };
  
  hilos.push(nuevo);
  guardarArchivo('hilos.json', hilos);
  res.redirect('/b/');
});

// Ver hilo
app.get('/hilo/:id', (req, res) => {
  const hilos = leerArchivo('hilos.json');
  const respuestas = leerArchivo(`respuestas_${req.params.id}.json`);
  const hilo = hilos.find(h => h.id === parseInt(req.params.id));
  
  if (!hilo) return res.send(PaginaHTML('<p style="color:red;">Hilo no encontrado</p>'));

  let html = `
    <div style="border:1px solid #333; background:#111; padding:15px; margin:15px 0;">
      <strong>${hilo.username}</strong> - ${hilo.fecha}
      <h3 style="color:#00ccff;">${hilo.titulo || 'Sin título'}</h3>
      ${hilo.imagen ? `<img src="/uploads/${hilo.imagen}" style="max-width:300px;">` : ''}
      <p>${hilo.comentario}</p>
    </div>
    <h3 style="color:#00ccff;">Respuestas</h3>
  `;

  if (respuestas.length === 0) {
    html += `<p style="color:#888;">Sé el primero en responder</p>`;
  } else {
    respuestas.forEach(r => {
      html += `
        <div style="border:1px solid #222; background:#181818; padding:12px; margin:10px 0;">
          <strong>${r.username}</strong> - ${r.fecha}
          ${r.imagen ? `<img src="/uploads/${r.imagen}" style="max-width:200px;">` : ''}
          <p>${r.comentario}</p>
        </div>
      `;
    });
  }

  html += `
    <div style="background:#1a1a1a; padding:20px; margin-top:20px; border-radius:8px;">
      <h3 style="color:#00ccff; margin-top:0;">Responder</h3>
      <form method="POST" action="/responder/${hilo.id}" enctype="multipart/form-data">
        <textarea name="comentario" placeholder="Tu respuesta..." rows="3" style="width:100%; padding:10px; margin-bottom:10px; background:#222; border:1px solid #444; color:#fff; border-radius:4px;"></textarea><br>
        <input type="password" name="password" placeholder="Contraseña" style="width:100%; padding:10px; margin-bottom:10px; background:#222; border:1px solid #444; color:#fff; border-radius:4px;"><br>
        <input type="file" name="imagen" accept="image/*" style="margin-bottom:10px;"><br>
        <button type="submit" style="background:#00ccff; color:#000; border:none; padding:10px 25px; font-weight:bold; border-radius:4px; cursor:pointer;">Responder</button>
      </form>
    </div>
  `;

  res.send(PaginaHTML(html));
});

// Responder
app.post('/responder/:id', upload.single('imagen'), (req, res) => {
  const respuestas = leerArchivo(`respuestas_${req.params.id}.json`);
  const username = req.body.password === 'matt2026' ? 'just matt' : 'Anónimo';
  
  respuestas.push({
    id: respuestas.length + 1,
    comentario: req.body.comentario || '',
    imagen: req.file ? req.file.filename : null,
    username,
    fecha: new Date().toLocaleString('es-CO')
  });
  
  guardarArchivo(`respuestas_${req.params.id}.json`, respuestas);
  res.redirect(`/hilo/${req.params.id}`);
});

// Crear carpetas necesarias
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('public')) fs.mkdirSync('public');

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});


