const express = require('express');
const multer = require('multer');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = 3000;
const db = new DatabaseSync('./4chan_clon.db');

db.exec(`CREATE TABLE IF NOT EXISTS hilos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT,
  comentario TEXT,
  imagen TEXT,
  username TEXT DEFAULT 'Anónimo',
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hilo_id INTEGER,
  comentario TEXT,
  imagen TEXT,
  username TEXT DEFAULT 'Anónimo',
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

function PaginaHTML(contenido) {
  return '<html><head><meta charset="utf-8"><title>5b0ard</title></head><body style="background:#fffff0; font-family:sans-serif; margin:0; padding:0;"><div style="background:#1d2f6f; padding:8px 10px;"><a href="/" style="color:#fff; text-decoration:none; font-weight:bold; margin-right:15px;">5b0ard</a><a href="/b" style="color:#fff; text-decoration:none;">/b/ - Random</a></div>' + contenido + '</body></html>';
}

app.get('/', (req, res) => {
  res.send(`<html><head><meta charset="utf-8"><title>5b0ard</title></head><body style="background:#ffffee; font-family:'Times New Roman', serif; color:#000; margin:0; padding:0;"><table width="100%" cellpadding="10" cellspacing="0"><tr valign="top"><td width="160" style="border-right:1px solid #ccc; font-size:13px;"><b>Tablones</b><br><br><a href="/b" style="color:#0000EE;">/b/ - Random</a></td><td align="center"><h1 style="font-family:sans-serif; color:#800000; margin:0; font-size:40px;">5b0ard</h1><p style="font-style:italic; color:#555; margin-top:0;">"todo se vale / anything goes"</p><hr width="80%"><h2 style="color:#800000; font-size:20px;">NOTICIAS / NEWS</h2><table width="80%" cellpadding="8" style="border:1px solid #ccc; background:#f0e0d6; text-align:left; font-size:14px;"><tr><td><b>ES:</b> Aquí todo se vale. Socializa de lo que quieras, di lo que quieras. No te tomes nada en serio — si lo haces, eres un imbécil.<br><br><b>EN:</b> Anything goes here. Talk about whatever you want, say whatever you want. Don't take anything seriously — if you do, you're an idiot.</td></tr></table><br><a href="/b" style="background:#800000; color:white; padding:8px 18px; text-decoration:none; font-family:sans-serif;">Entrar a /b/ - Random</a></td></tr></table></body></html>`);
});

app.get('/b', (req, res) => {
  const hilos = db.prepare('SELECT * FROM hilos ORDER BY id DESC').all();
  let hilosHTML = '';

  if (hilos.length === 0) {
    hilosHTML = '<p style="color:red; text-align:center; margin-top:40px;">No hay hilos activos. ¡Sé el primero!</p>';
  } else {
    hilos.forEach(h => {
      let nombre = h.username === 'just matt' ? '<span style="color:#c00; font-weight:bold; background:#ffe0e0; padding:2px 6px; border-radius:3px;">just matt</span>' : h.username;
      let titulo = h.titulo ? ' - <b>' + h.titulo + '</b>' : '';
      let imagen = h.imagen ? '<a href="/uploads/' + h.imagen + '" target="_blank"><img src="/uploads/' + h.imagen + '" style="max-width:200px; float:left; margin-right:10px;"></a>' : '';
      hilosHTML += '<div style="border:1px solid #ccc; margin:15px 0; padding:10px; background:#f0e0d6;">' + nombre + titulo + ' (' + (h.fecha || '') + ') <a href="/hilo/' + h.id + '" style="color:#00c; margin-left:10px;">No.' + h.id + '</a><br><br>' + imagen + '<p>' + h.comentario + '</p><div style="clear:both;"></div></div>';
    });
  }

  const form = '<div style="max-width:400px; margin:20px auto; background:#e0e0f0; padding:15px;"><h2 style="text-align:center; background:#f0d6d0; padding:10px; margin-top:0;">/b/ - Tablón Anónimo</h2><form method="POST" action="/crear-hilo" enctype="multipart/form-data"><input type="text" name="titulo" placeholder="Título (Opcional)" style="width:100%; margin-bottom:5px; box-sizing:border-box;"><br><textarea name="comentario" placeholder="Comentario..." rows="5" style="width:100%; margin-bottom:5px; box-sizing:border-box;"></textarea><br><input type="password" name="password" placeholder="Contraseña (solo creador)" style="width:100%; margin-bottom:5px; box-sizing:border-box;"><br><input type="file" name="imagen"><br><br><button type="submit" style="width:100%;">Publicar Hilo</button></form></div><div style="max-width:500px; margin:0 auto;">' + hilosHTML + '</div>';

  res.send(PaginaHTML(form));
});

app.post('/crear-hilo', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.send('Error: Es obligatorio subir una imagen.');
  const username = (req.body.password === 'matt2026') ? 'just matt' : 'Anónimo';
  db.prepare('INSERT INTO hilos (titulo, comentario, imagen, username) VALUES (?, ?, ?, ?)').run(req.body.titulo || null, req.body.comentario, req.file.filename, username);
  res.redirect('/b');
});

app.get('/hilo/:id', (req, res) => {
  const hilo = db.prepare('SELECT * FROM hilos WHERE id = ?').get(req.params.id);
  if (!hilo) return res.send('Hilo no encontrado.');
  const resps = db.prepare('SELECT * FROM respuestas WHERE hilo_id = ? ORDER BY id ASC').all(req.params.id);

  let nombreHilo = hilo.username === 'just matt' ? '<span style="color:#c00; font-weight:bold; background:#ffe0e0; padding:2px 6px; border-radius:3px;">just matt</span>' : hilo.username;
  let html = '<div style="max-width:500px; margin:20px auto;"><div style="border:1px solid #ccc; margin:10px 0; padding:10px; background:#f0e0d6;"><span>' + nombreHilo + (hilo.titulo ? ' - ' + hilo.titulo : '') + ' (' + (hilo.fecha || '') + ') No.' + hilo.id + '</span><br><br>';
  if (hilo.imagen) html += '<a href="/uploads/' + hilo.imagen + '" target="_blank"><img src="/uploads/' + hilo.imagen + '" style="max-width:200px; float:left; margin-right:10px;"></a>';
  html += '<p>' + hilo.comentario + '</p><div style="clear:both;"></div></div>';

  resps.forEach(r => {
    let nombre = r.username === 'just matt' ? '<span style="color:#c00; font-weight:bold; background:#ffe0e0; padding:2px 6px; border-radius:3px;">just matt</span>' : r.username;
    html += '<div style="border:1px solid #ddd; margin:10px 0 10px 20px; padding:10px; background:#fafafa;"><span>' + nombre + ' (' + (r.fecha || '') + ') No.' + r.id + '</span><br><br>';
    if (r.imagen) html += '<a href="/uploads/' + r.imagen + '" target="_blank"><img src="/uploads/' + r.imagen + '" style="max-width:150px; float:left; margin-right:10px;"></a>';
    html += '<p>' + r.comentario + '</p><div style="clear:both;"></div></div>';
  });

  html += '<div style="background:#e0e0f0; padding:15px; margin-top:20px;"><form method="POST" action="/responder/' + hilo.id + '" enctype="multipart/form-data"><textarea name="comentario" placeholder="Comentario..." rows="4" style="width:100%; box-sizing:border-box;"></textarea><br><input type="password" name="password" placeholder="Contraseña (solo creador)" style="width:100%; margin:5px 0; box-sizing:border-box;"><br><input type="file" name="imagen"><br><br><button type="submit" style="width:100%;">Responder</button></form></div></div>';
  res.send(PaginaHTML(html));
});

app.post('/responder/:id', upload.single('imagen'), (req, res) => {
  const imagenNom = req.file ? req.file.filename : null;
  const username = (req.body.password === 'matt2026') ? 'just matt' : 'Anónimo';
  db.prepare('INSERT INTO respuestas (hilo_id, comentario, imagen, username) VALUES (?, ?, ?, ?)').run(req.params.id, req.body.comentario, imagenNom, username);
  res.redirect('/hilo/' + req.params.id);
});

app.listen(PORT, () => {
  console.log('Foro corriendo en http://localhost:3000');
});
;

// Si usas archivos estáticos, déjalos también
app.use(express.static('public'));

// Página principal
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu Foro</title>

    <!-- ✅ Tu código de verificación de Google -->
    <meta name="google-site-verification" content="b1PiY1HS_ISl0nhOTIAkygKDnk11S29DmtYqltF-APU" />

</head>
<body>

    <!-- Aquí va TODO tu contenido, formularios, mensajes, etc. -->
    <h1>Bienvenido a mi foro</h1>

</body>
</html>
    `);
});

