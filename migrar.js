const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');
let cambios = 0;

function aplicar(oldStr, newStr, nombre) {
  if (s.indexOf(oldStr) === -1) {
    console.log('⚠️  NO ENCONTRADO (se omite): ' + nombre);
    return;
  }
  s = s.split(oldStr).join(newStr);
  cambios++;
  console.log('✅ Aplicado: ' + nombre);
}

// 1. Agregar configuración de tablones
aplicar(
  "const ADMIN_PASS = 'Matt5b0ard2026!'; // puedes cambiarla aquí cuando quieras",
  "const ADMIN_PASS = 'Matt5b0ard2026!'; // puedes cambiarla aquí cuando quieras\n\nconst BOARDS = {\n  b: 'Random',\n  v: 'Videojuegos y Fandoms'\n};",
  'Configuración de tablones (BOARDS)'
);

// 2. Migración de columna "board" en la base de datos
aplicar(
  "try { db.exec(`ALTER TABLE hilos ADD COLUMN ip TEXT`); } catch (e) {}",
  "try { db.exec(`ALTER TABLE hilos ADD COLUMN ip TEXT`); } catch (e) {}\ntry { db.exec(`ALTER TABLE hilos ADD COLUMN board TEXT DEFAULT 'b'`); } catch (e) {}",
  'Columna "board" en base de datos'
);

// 3. Menú de arriba: mostrar todos los tablones + link a FAQ
aplicar(
  '      <a href="/b" style="color:#fff; text-decoration:none;">/b/ - Random</a>',
  '      ${Object.keys(BOARDS).map(sl => `<a href="/${sl}" style="color:#fff; text-decoration:none; margin-right:10px;">/${sl}/ - ${BOARDS[sl]}</a>`).join("")}\n      <a href="/faq" style="color:#fff; text-decoration:none; margin-right:10px;">FAQ / Reglas</a>',
  'Menú superior con todos los tablones + FAQ'
);

// 4. botonBanear: que redirija al tablón correcto, no siempre a /b
aplicar(
  "function botonBanear(ip, tipo, id, hiloId) {\n  if (!ip) return '';\n  const redirigirA = tipo === 'hilo' ? `/b` : `/hilo/${hiloId}`;",
  "function botonBanear(ip, tipo, id, hiloId, board) {\n  if (!ip) return '';\n  const redirigirA = tipo === 'hilo' ? `/${board || 'b'}` : `/hilo/${hiloId}`;",
  'botonBanear ahora recibe el tablón'
);

// 5. Portada: mostrar todos los tablones en la barra lateral
aplicar(
  '            <a href="/b" style="color:#0000EE;">/b/ - Random</a>',
  '            ${Object.keys(BOARDS).map(sl => `<a href="/${sl}" style="color:#0000EE; display:block; margin-bottom:4px;">/${sl}/ - ${BOARDS[sl]}</a>`).join("")}',
  'Portada con todos los tablones'
);

// 6. Reemplazar la ruta fija /b por una ruta genérica /:board (soporta cualquier tablón)
aplicar(
`// ---------- TABLÓN /b/ ----------
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
        ? \`<span style="color:#b8860b; font-weight:bold;">👑 \${h.autor}</span>\`
        : (h.autor && h.autor !== 'Anónimo' ? \`<span style="color:#4682b4; font-weight:bold;">🛡️ \${h.autor}</span>\` : 'Anónimo');
      const botonBorrar = mod
        ? \`<form method="POST" action="/borrar-hilo/\${h.id}" style="display:inline;" onsubmit="return confirm('¿Borrar este hilo?');">
             <button type="submit" style="font-size:11px; color:red; background:none; border:1px solid red; cursor:pointer;">Borrar</button>
           </form> \${botonBanear(h.ip, 'hilo', h.id)}\`
        : '';
      hilosHTML += \`
      <div style="border:1px solid #ccc; margin:10px 0; padding:10px; background:#f0e0d6;">
        <span class="meta">\${nombreMostrado} \${h.titulo ? '- ' + h.titulo : ''} (\${h.fecha || ''}) <span class="num">No. \${h.id}</span> \${mod ? \`<span style="font-size:10px; color:#888;">[IP: \${h.ip || 'desconocida'}]</span>\` : ''}<br>\${botonBorrar}</span><br><br>
        \${h.imagen ? \`<a href="/uploads/\${h.imagen}" target="_blank"><img src="/uploads/\${h.imagen}" style="max-width:200px; float:left; margin-right:10px;"></a>\` : ''}
        <p>\${h.comentario}</p>
        <div style="clear:both;"></div>
        <a href="/hilo/\${h.id}" style="font-size:13px;">Ver hilo / responder</a>
      </div>\`;
    });
  }

  const formulario = \`
    <div style="max-width:400px; margin:20px auto; background:#e0e0f0; padding:15px;">
      <h2 style="text-align:center; background:#f0d6d0; padding:10px; margin-top:0;">/b/ - Tablón Anónimo</h2>
      <form method="POST" action="/crear-hilo" enctype="multipart/form-data">
        <input type="text" name="titulo" placeholder="Título (Opcional)" style="width:100%; margin-bottom:5px; box-sizing:border-box;"><br>
        <textarea name="comentario" placeholder="Comentario..." rows="5" style="width:100%; margin-bottom:5px; box-sizing:border-box;"></textarea><br>
        <input type="file" name="imagen"><br><br>
        <button type="submit" style="width:100%;">Publicar Hilo</button>
      </form>
    </div>
    <div style="max-width:500px; margin:0 auto;">\${hilosHTML}</div>
  \`;

  res.send(PaginaHTML(formulario, req));
});

// ---------- CREAR HILO ----------
app.post('/crear-hilo', bloquearBaneados, upload.single('imagen'), (req, res) => {
  if (!req.file) return res.send('Error: Es obligatorio subir una imagen.');
  const autor = nombreUsuario(req);
  db.prepare(\`INSERT INTO hilos (titulo, comentario, imagen, autor, ip) VALUES (?, ?, ?, ?, ?)\`)
    .run(req.body.titulo, req.body.comentario, req.file.filename, autor, getIP(req));
  res.redirect('/b');
});`,
`// ---------- TABLÓN (cualquiera de BOARDS) ----------
app.get('/:board', (req, res, next) => {
  const board = req.params.board;
  if (!BOARDS[board]) return next();

  const mod = esMod(req);
  const hilos = db.prepare('SELECT * FROM hilos WHERE board = ? ORDER BY id DESC').all(board);

  let hilosHTML = '';
  if (hilos.length === 0) {
    hilosHTML = '<p style="color:red; text-align:center;">No hay hilos activos. ¡Sé el primero!</p>';
  } else {
    hilos.forEach(h => {
      const esAutorAdmin = h.autor === ADMIN_USER;
      const nombreMostrado = esAutorAdmin
        ? \`<span style="color:#b8860b; font-weight:bold;">👑 \${h.autor}</span>\`
        : (h.autor && h.autor !== 'Anónimo' ? \`<span style="color:#4682b4; font-weight:bold;">🛡️ \${h.autor}</span>\` : 'Anónimo');
      const botonBorrar = mod
        ? \`<form method="POST" action="/borrar-hilo/\${h.id}" style="display:inline;" onsubmit="return confirm('¿Borrar este hilo?');">
             <button type="submit" style="font-size:11px; color:red; background:none; border:1px solid red; cursor:pointer;">Borrar</button>
           </form> \${botonBanear(h.ip, 'hilo', h.id, null, board)}\`
        : '';
      hilosHTML += \`
      <div style="border:1px solid #ccc; margin:10px 0; padding:10px; background:#f0e0d6;">
        <span class="meta">\${nombreMostrado} \${h.titulo ? '- ' + h.titulo : ''} (\${h.fecha || ''}) <span class="num">No. \${h.id}</span> \${mod ? \`<span style="font-size:10px; color:#888;">[IP: \${h.ip || 'desconocida'}]</span>\` : ''}<br>\${botonBorrar}</span><br><br>
        \${h.imagen ? \`<a href="/uploads/\${h.imagen}" target="_blank"><img src="/uploads/\${h.imagen}" style="max-width:200px; float:left; margin-right:10px;"></a>\` : ''}
        <p>\${h.comentario}</p>
        <div style="clear:both;"></div>
        <a href="/hilo/\${h.id}" style="font-size:13px;">Ver hilo / responder</a>
      </div>\`;
    });
  }

  const formulario = \`
    <div style="max-width:400px; margin:20px auto; background:#e0e0f0; padding:15px;">
      <h2 style="text-align:center; background:#f0d6d0; padding:10px; margin-top:0;">/\${board}/ - \${BOARDS[board]}</h2>
      <form method="POST" action="/crear-hilo" enctype="multipart/form-data">
        <input type="hidden" name="board" value="\${board}">
        <input type="text" name="titulo" placeholder="Título (Opcional)" style="width:100%; margin-bottom:5px; box-sizing:border-box;"><br>
        <textarea name="comentario" placeholder="Comentario..." rows="5" style="width:100%; margin-bottom:5px; box-sizing:border-box;"></textarea><br>
        <input type="file" name="imagen"><br><br>
        <button type="submit" style="width:100%;">Publicar Hilo</button>
      </form>
    </div>
    <div style="max-width:500px; margin:0 auto;">\${hilosHTML}</div>
  \`;

  res.send(PaginaHTML(formulario, req));
});

// ---------- CREAR HILO ----------
app.post('/crear-hilo', bloquearBaneados, upload.single('imagen'), (req, res) => {
  if (!req.file) return res.send('Error: Es obligatorio subir una imagen.');
  const autor = nombreUsuario(req);
  const board = BOARDS[req.body.board] ? req.body.board : 'b';
  db.prepare(\`INSERT INTO hilos (board, titulo, comentario, imagen, autor, ip) VALUES (?, ?, ?, ?, ?, ?)\`)
    .run(board, req.body.titulo, req.body.comentario, req.file.filename, autor, getIP(req));
  res.redirect('/' + board);
});

// ---------- FAQ / REGLAS ----------
app.get('/faq', (req, res) => {
  res.send(PaginaHTML(\`
    <div style="max-width:600px; margin:20px auto; padding:0 15px;">
      <h2 style="color:#800000;">FAQ / Reglas — Rules</h2>

      <div style="background:#f0e0d6; border:1px solid #ccc; padding:15px; margin-bottom:15px;">
        <h3 style="margin-top:0; color:#800000;">ES: Reglas del sitio</h3>
        <p>Este es un tablón anónimo donde todo se vale, con estas excepciones que no tienen negociación:</p>
        <ul>
          <li><b>Prohibido contenido de explotación infantil (CP)</b> en cualquier forma. Ban permanente e inmediato sin advertencia.</li>
          <li><b>Prohibido contenido gore extremo / violencia gráfica real</b> (torturas, muertes reales, mutilación real, snuff). Ban permanente e inmediato.</li>
          <li>Fuera de eso: puedes publicar lo que quieras, decir lo que quieras. No te tomes nada en serio.</li>
        </ul>
        <p>Los moderadores pueden borrar cualquier post y banear cualquier IP sin previo aviso si violan estas reglas.</p>
      </div>

      <div style="background:#f0e0d6; border:1px solid #ccc; padding:15px;">
        <h3 style="margin-top:0; color:#800000;">EN: Site Rules</h3>
        <p>This is an anonymous board where anything goes, with these non-negotiable exceptions:</p>
        <ul>
          <li><b>Child exploitation content (CP) is forbidden</b> in any form. Immediate, permanent ban.</li>
          <li><b>Extreme gore / real graphic violence is forbidden</b> (real torture, real death, real mutilation, snuff). Immediate, permanent ban.</li>
          <li>Outside of that: post whatever you want, say whatever you want. Don't take anything seriously.</li>
        </ul>
        <p>Moderators may delete any post and ban any IP without warning if these rules are broken.</p>
      </div>
    </div>
  \`, req));
});`,
  'Ruta /b convertida en ruta multi-tablón + FAQ agregada'
);

// 7. Al ver un hilo: que el botón de banear sepa a qué tablón volver
aplicar(
  "       </form> ${botonBanear(hilo.ip, 'hilo', hilo.id)}`",
  "       </form> ${botonBanear(hilo.ip, 'hilo', hilo.id, null, hilo.board)}`",
  'Vista de hilo individual respeta su tablón'
);

// 8. Al borrar un hilo, volver al tablón correcto (no siempre a /b)
aplicar(
  "app.post('/borrar-hilo/:id', (req, res) => {\n  if (!esMod(req)) return res.status(403).send('No autorizado.');\n  db.prepare('DELETE FROM respuestas WHERE hilo_id = ?').run(req.params.id);\n  db.prepare('DELETE FROM hilos WHERE id = ?').run(req.params.id);\n  res.redirect('/b');\n});",
  "app.post('/borrar-hilo/:id', (req, res) => {\n  if (!esMod(req)) return res.status(403).send('No autorizado.');\n  const hiloBorrado = db.prepare('SELECT board FROM hilos WHERE id = ?').get(req.params.id);\n  db.prepare('DELETE FROM respuestas WHERE hilo_id = ?').run(req.params.id);\n  db.prepare('DELETE FROM hilos WHERE id = ?').run(req.params.id);\n  res.redirect('/' + (hiloBorrado ? hiloBorrado.board : 'b'));\n});",
  'Borrar hilo redirige a su propio tablón'
);

fs.writeFileSync('server.js', s);
console.log('\n' + cambios + ' de 8 cambios aplicados. Revisa arriba si alguno dice "NO ENCONTRADO".');

