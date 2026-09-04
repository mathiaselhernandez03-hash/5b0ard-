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
  username TEXT DEFAULT 'Anonimo',
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hilo_id INTEGER,
  comentario TEXT,
  imagen TEXT,
  username TEXT DEFAULT 'Anonimo',
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
app.use(express.static('public'));

function PaginaHTML(contenido) {
  return `<!html>
<head>
<meta charset="utf-8">
<title>Sonic - Foro</title>
</head>
<body style="background:#fffff0; margin:0; font-family:sans-serif;">

<div style="text-align:center; padding:15px;">
<img src="/logo.png" alt="Sonic" style="max-width:400px;">
</div>

<div style="background:#1d2f6f; padding:8px 15px;">
<a href="/" style="color:#fff; text-decoration:none; font-weight:bold; margin-right:15px;">Inicio</a>
<a href="/b/" style="color:#fff; text-decoration:none;">/b/ - Random</a>
</div>

${contenido}

</body>
</html>`;
}

app.get('/', (req, res) => {
  res.send(PaginaHTML(`
    <div style="padding:15px;">
      <h1 style="text-align:center; color:#008800; font-size:40px;">Sonic</h1>
      <p style="text-align:center; color:#555;">Bienvenido al foro</p>
      <div style="text-align:center; margin-top:30px;">
        <a href="/b/" style="background:#008800; color:#fff; padding:10px 20px; text-decoration:none; border-radius:4px;">Entrar a /b/</a>
      </div>
    </div>
  `));
});

app.get('/b/', (req, res) => {
  const hilos = db.prepare('SELECT * FROM hilos ORDER BY id DESC').all();
  let hilosHTML = '';

  if (hilos.length === 0) {
    hilosHTML = `<p style="color:red; text-align:center; margin-top:40px;">No hay hilos aun. Se el primero!</p>`;
  } else {
    hilos.forEach(h => {
      let imagen = h.imagen ? `<a href="/uploads/${h.imagen}" target="_blank"><img src="/uploads/${h.imagen}" style="max-width:150px;"></a>` : '';
      hilosHTML += `
        <div style="border:1px solid #ccc; margin:15px; padding:10px;">
          <b>${h.username || 'Anonimo'}</b> - ${h.fecha || ''}
          <h3>${h.titulo || 'Sin titulo'}</h3>
          ${imagen}
          <p>${h.comentario || ''}</p>
          <a href="/hilo/${h.id}">Ver respuestas</a>
        </div>
      `;
    });
  }

  const form = `
    <div style="max-width:400px; margin:20px auto; padding:15px; background:#eef;">
      <h3 style="text-align:center;">Crear hilo</h3>
      <form method="POST" action="/crear-hilo" enctype="multipart/form-data">
        <input type="text" name="titulo" placeholder="Titulo" style="width:100%; margin-bottom:8px; padding:6px; box-sizing:border-box;"><br>
        <textarea name="comentario" placeholder="Comentario" rows="4" style="width:100%; margin-bottom:8px; padding:6px; box-sizing:border-box;"></textarea><br>
        <input type="password" name="password" placeholder="Contraseña" style="width:100%; margin-bottom:8px; padding:6px;"><br>
        <input type="file" name="imagen" style="margin-bottom:8px;"><br>
        <button type="submit" style="width:100%; padding:8px; background:#008800; color:#fff; border:none;">Publicar</button>
      </form>
    </div>
  `;

  res.send(PaginaHTML(hilosHTML + form));
});

app.post('/crear-hilo', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.send('Error: sube una imagen');
  const user = req.body.password === 'soymathias' ? 'just matt' : 'Anonimo';
  db.prepare('INSERT INTO hilos (titulo, comentario, imagen, username) VALUES (?, ?, ?, ?)')
    .run(req.body.titulo || null, req.body.comentario, req.file.filename, user);
  res.redirect('/b/');
});

app.get('/hilo/:id', (req, res) => {
  const hilo = db.prepare('SELECT * FROM hilos WHERE id = ?').get(req.params.id);
  if (!hilo) return res.send('Hilo no encontrado');

  const respuestas = db.prepare('SELECT * FROM respuestas WHERE hilo_id = ? ORDER BY id ASC').all(req.params.id);

  let hiloHTML = `
    <div style="border:1px solid #ccc; margin:15px; padding:10px;">
      <b>${h.username || 'Anonimo'}</b> - ${h.fecha || ''}
      <h3>${h.titulo || 'Sin titulo'}</h3>
      ${h.imagen ? `<img src="/uploads/${h.imagen}" style="max-width:200px;">` : ''}
      <p>${h.comentario || ''}</p>
    </div>
  `;

  respuestas.forEach(r => {
    hiloHTML += `
      <div style="border:1px solid #ddd; margin:15px; padding:10px;">
        <b>${r.username || 'Anonimo'}</b> - ${r.fecha || ''}
        ${r.imagen ? `<img src="/uploads/${r.imagen}" style="max-width:150px;">` : ''}
        <p>${r.comentario || ''}</p>
      </div>
    `;
  });

  hiloHTML += `
    <div style="max-width:400px; margin:20px auto; padding:15px; background:#eef;">
      <h3>Responder</h3>
      <form method="POST" action="/responder/${hilo.id}" enctype="multipart/form-data">
        <textarea name="comentario" placeholder="Tu respuesta" rows="3" style="width:100%; margin-bottom:8px; padding:6px;"></textarea><br>
        <input type="password" name="password" placeholder="Contraseña" style="width:100%; margin-bottom:8px; padding:6px;"><br>
        <input type="file" name="imagen" style="margin-bottom:8px;"><br>
        <button type="submit" style="width:100%; padding:8px; background:#008800; color:#fff; border:none;">Responder</button>
      </form>
    </div>
  `;

  res.send(PaginaHTML(hiloHTML));
});

app.post('/responder/:id', upload.single('imagen'), (req, res) => {
  const img = req.file ? req.file.filename : null;
  const user = req.body.password === 'soymathias' ? 'just matt' : 'Anonimo';
  db.prepare('INSERT INTO respuestas (hilo_id, comentario, imagen, username) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.body.comentario, img, user);
  res.redirect(`/hilo/${req.params.id}`);
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});



