const express = require('express');
const path = require('path');
const open = require('open');
const fs = require('fs');
const multer = require('multer');
const xlsx = require('xlsx');
const AdmZip = require('adm-zip');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8080;

// Determinar directorio base tanto en entorno de desarrollo como en pkg
const isPkg = typeof process.pkg !== 'undefined';
const basePath = isPkg ? path.dirname(process.execPath) : process.cwd();
const uploadsDir = path.join(basePath, 'uploads');
const backgroundsDir = path.join(basePath, 'uploads', 'backgrounds');
const fontsDir = path.join(basePath, 'uploads', 'fonts');
const backupsTempDir = path.join(basePath, 'uploads', 'temp_backups');

[uploadsDir, backgroundsDir, fontsDir, backupsTempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error(`No se pudo crear carpeta ${dir}:`, e.message);
    }
  }
});

// Configuración de Multer para catálogos Excel
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.xlsx';
    cb(null, 'ultimo_catalogo' + ext);
  }
});
const uploadExcel = multer({
  storage: excelStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Configuración de Multer para Backups ZIP
const zipStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, backupsTempDir),
  filename: (req, file, cb) => cb(null, `restore_${Date.now()}.zip`)
});
const uploadZip = multer({
  storage: zipStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Configuración de Multer para Imágenes de Fondo de Plantillas
const bgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, backgroundsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `bg_${Date.now()}_${cleanName}${ext}`);
  }
});
const uploadBg = multer({
  storage: bgStorage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// Configuración de Multer para Fuentes de Texto (.ttf, .otf, .woff, .woff2)
const fontStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, fontsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `font_${Date.now()}_${cleanName}${ext}`);
  }
});
const uploadFont = multer({
  storage: fontStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de fuentes (.ttf, .otf, .woff, .woff2)'));
    }
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Helper para obtener configuraciones
const getConfigValue = (clave) => {
  return new Promise((resolve) => {
    db.get("SELECT valor FROM configuraciones WHERE clave = ?", [clave], (err, row) => {
      if (err || !row) resolve(null);
      else resolve(row.valor);
    });
  });
};

const setConfigValue = (clave, valor) => {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT OR REPLACE INTO configuraciones (clave, valor, actualizado_en) VALUES (?, ?, CURRENT_TIMESTAMP)",
      [clave, String(valor)],
      function(err) {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
};

// --- RUTAS DE AUTENTICACIÓN ---

const handleLogin = (req, res) => {
  const username = req.body.usuario || req.body.username || '';
  const password = req.body.password || req.body.contrasena || '';

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos', error: 'Usuario y contraseña requeridos' });
  }

  db.get("SELECT * FROM usuarios WHERE LOWER(usuario) = LOWER(?) AND password = ?", [username.trim(), password], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message, error: err.message });
    if (row) {
      if (row.activo === 0) {
        return res.status(403).json({ success: false, message: 'Usuario inhabilitado. Contacte al Administrador', error: 'Usuario inhabilitado. Contacte al Administrador' });
      }
      const userPayload = {
        id: row.id,
        usuario: row.usuario,
        username: row.usuario,
        rol: row.rol,
        role: row.rol,
        activo: row.activo ?? 1
      };
      res.json({ success: true, user: userPayload });
    } else {
      res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos', error: 'Usuario o contraseña incorrectos' });
    }
  });
};

app.post('/api/login', handleLogin);
app.post('/api/auth/login', handleLogin);

app.get('/api/me', (req, res) => {
  res.json({ success: true, message: 'Sesión activa' });
});

app.post('/api/logout', (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada' });
});

// --- RUTAS DE USUARIOS (CRUD CON PROTECCIÓN ADMIN) ---

const getUsersHandler = (req, res) => {
  db.all("SELECT * FROM usuarios ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message, error: err.message });
    const formatted = (rows || []).map(r => ({
      id: r.id,
      usuario: r.usuario,
      username: r.usuario,
      rol: r.rol,
      role: r.rol,
      activo: r.activo ?? 1,
      createdAt: r.created_at || r.fecha_creacion || null
    }));
    res.json(formatted);
  });
};

app.get('/api/users', getUsersHandler);
app.get('/api/usuarios', getUsersHandler);

const createUserHandler = (req, res) => {
  const username = (req.body.usuario || req.body.username || '').trim();
  const password = req.body.password || '';
  let role = req.body.rol || req.body.role || 'Operador';
  const activo = req.body.activo !== undefined ? (req.body.activo ? 1 : 0) : 1;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña obligatorios', error: 'Usuario y contraseña obligatorios' });
  }

  const rolNormalizado = role.toLowerCase().includes('admin') ? 'Administrador' : 'Operador';

  db.run("INSERT INTO usuarios (usuario, password, rol, activo) VALUES (?, ?, ?, ?)", [username, password, rolNormalizado, activo], function(err) {
    if (err) return res.status(400).json({ success: false, message: 'El usuario ya existe', error: 'El usuario ya existe' });
    res.json({ success: true, id: this.lastID, user: { id: this.lastID, usuario: username, rol: rolNormalizado, activo } });
  });
};

app.post('/api/users', createUserHandler);
app.post('/api/usuarios', createUserHandler);

const updateUserHandler = (req, res) => {
  const { id } = req.params;
  let { rol, role, password, activo } = req.body;
  const targetRole = rol || role;

  db.get("SELECT * FROM usuarios WHERE id = ?", [id], (err, user) => {
    if (err) return res.status(500).json({ success: false, message: err.message, error: err.message });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado', error: 'Usuario no encontrado' });

    let finalRole = user.rol;
    let finalActivo = user.activo ?? 1;

    const isMainAdmin = user.usuario.toLowerCase() === 'admin' || Number(id) === 1;

    if (isMainAdmin) {
      finalRole = 'Administrador';
      finalActivo = 1; // Admin principal siempre activo
    } else {
      if (targetRole) {
        finalRole = targetRole.toLowerCase().includes('admin') ? 'Administrador' : 'Operador';
      }
      if (activo !== undefined) {
        finalActivo = activo ? 1 : 0;
      }
    }

    if (password && password.trim() !== '') {
      db.run("UPDATE usuarios SET rol = ?, password = ?, activo = ? WHERE id = ?", [finalRole, password, finalActivo, id], function(updateErr) {
        if (updateErr) return res.status(500).json({ success: false, message: updateErr.message, error: updateErr.message });
        res.json({ success: true, message: 'Usuario actualizado con éxito' });
      });
    } else {
      db.run("UPDATE usuarios SET rol = ?, activo = ? WHERE id = ?", [finalRole, finalActivo, id], function(updateErr) {
        if (updateErr) return res.status(500).json({ success: false, message: updateErr.message, error: updateErr.message });
        res.json({ success: true, message: 'Usuario actualizado con éxito' });
      });
    }
  });
};

app.put('/api/users/:id', updateUserHandler);
app.put('/api/usuarios/:id', updateUserHandler);

const deleteUserHandler = (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM usuarios WHERE id = ?", [id], (err, user) => {
    if (err) return res.status(500).json({ success: false, message: err.message, error: err.message });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado', error: 'Usuario no encontrado' });

    if (user.usuario.toLowerCase() === 'admin' || Number(id) === 1) {
      return res.status(403).json({ success: false, message: 'El usuario principal "admin" no puede ser eliminado.', error: 'No permitido' });
    }

    db.run("DELETE FROM usuarios WHERE id = ?", [id], (delErr) => {
      if (delErr) return res.status(500).json({ success: false, message: delErr.message, error: delErr.message });
      res.json({ success: true, message: 'Usuario eliminado con éxito' });
    });
  });
};

app.delete('/api/users/:id', deleteUserHandler);
app.delete('/api/usuarios/:id', deleteUserHandler);

// --- EXCEL & PRODUCTOS ---

const parsePrice = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let str = String(val).replace(/[^0-9.,-]/g, '').trim();
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  return parseFloat(str) || 0;
};

const processExcelUpload = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se subió ningún archivo Excel' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;

  let workbook;
  try {
    // Leer la Hoja 1 forzando todas las celdas como texto para no perder valores en cero
    workbook = xlsx.readFile(filePath, { type: 'file', cellDates: true, raw: false });
  } catch (parseErr) {
    console.error('Error al leer archivo Excel:', parseErr);
    return res.status(400).json({ success: false, message: 'No se pudo leer el archivo Excel: ' + parseErr.message });
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return res.status(400).json({ success: false, message: 'El archivo Excel no contiene hojas de cálculo válidas.' });
  }

  // Siempre usar la Hoja 1 (índice 0)
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // defval: null preserva las celdas vacías sin saltear filas
  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: null });

  if (!rows || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'La hoja de cálculo está vacía o no contiene filas con datos.' });
  }

  // ── Mapear TODAS las filas sin filtro de omisión ──────────────────────────────
  const mappedProducts = rows.map(r => {
    const cod_1    = String(r['COD 1']  ?? r['cod_1']  ?? r['COD1']  ?? '').trim();
    const cod_2    = String(r['COD 2']  ?? r['cod_2']  ?? r['COD2']  ?? '').trim();
    const producto = String(r['Producto'] ?? r['PRODUCTO'] ?? r['producto'] ?? '').trim();
    const title    = String(r['Title']  ?? r['TITLE']  ?? r['title'] ?? r['descripcion'] ?? producto ?? '').trim();
    const spec_1   = String(r['Spec1']  ?? r['SPEC1']  ?? r['spec_1'] ?? '').trim();
    const spec_2   = String(r['Spec2']  ?? r['SPEC2']  ?? r['spec_2'] ?? '').trim();
    const spec_3   = String(r['Spec3']  ?? r['SPEC3']  ?? r['spec_3'] ?? '').trim();
    const spec_4   = String(r['Spec4']  ?? r['SPEC4']  ?? r['spec_4'] ?? '').trim();
    const spec_5   = String(r['Spec5']  ?? r['SPEC5']  ?? r['spec_5'] ?? '').trim();
    const moneda   = String(r['Moneda'] ?? r['MONEDA'] ?? r['moneda'] ?? '$').trim() || '$';
    const publico  = parsePrice(r['PUBLICO']      ?? r['Publico']      ?? r['publico']      ?? r['precio_1']);
    const distribuidor = parsePrice(r['DISTRIBUIDOR'] ?? r['Distribuidor'] ?? r['distribuidor'] ?? r['DISTRIB'] ?? r['precio_2']);

    // Mapeo de columna "Tamaño" → campo etiqueta_tamano
    const etiqueta_tamano = String(
      r['Tamaño']          ?? r['TAMAÑO']          ?? r['tamano']         ?? r['Tamano']         ?? r['TAMANO']         ??
      r['Etiqueta Tamaño'] ?? r['ETIQUETA TAMAÑO'] ?? r['Etiqueta Tamano'] ??
      r['etiqueta_tamano'] ?? r['SECCION']          ?? r['seccion']        ?? ''
    ).trim();

    return {
      cod_1,
      cod_2,
      producto,
      title: title || (cod_1 ? `Producto ${cod_1}` : ''),
      spec_1,
      spec_2,
      spec_3,
      spec_4,
      spec_5,
      moneda,
      publico,
      distribuidor,
      etiqueta_tamano
    };
  });

  // ── Transacción atómica BEGIN … COMMIT ────────────────────────────────────────
  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (beginErr) => {
      if (beginErr) {
        console.error('Error al iniciar transacción:', beginErr);
        return res.status(500).json({ success: false, message: 'Error al iniciar transacción SQLite: ' + beginErr.message });
      }

      // Reemplazo total: borrar lista anterior
      db.run('DELETE FROM productos', (delErr) => {
        if (delErr) {
          db.run('ROLLBACK');
          return res.status(500).json({ success: false, message: 'Error al vaciar tabla productos: ' + delErr.message });
        }

        const stmt = db.prepare(`
          INSERT INTO productos (
            cod_1, cod_2, producto, title, spec_1, spec_2, spec_3, spec_4, spec_5,
            moneda, publico, distribuidor, etiqueta_tamano
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let insertError = null;
        mappedProducts.forEach(p => {
          if (!insertError) {
            stmt.run(
              p.cod_1, p.cod_2, p.producto, p.title,
              p.spec_1, p.spec_2, p.spec_3, p.spec_4, p.spec_5,
              p.moneda, p.publico, p.distribuidor, p.etiqueta_tamano,
              (err) => { if (err && !insertError) insertError = err; }
            );
          }
        });

        stmt.finalize((finalErr) => {
          const err = finalErr || insertError;
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ success: false, message: 'Error al insertar productos: ' + err.message });
          }

          db.run('COMMIT', async (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: 'Error al confirmar transacción: ' + commitErr.message });
            }

            // Actualizar metadatos de configuración
            const nowIso = new Date().toISOString();
            try {
              await setConfigValue('fecha_ultima_carga', nowIso);
              await setConfigValue('nombre_archivo_catalogo', originalName);
              await setConfigValue('total_productos', String(mappedProducts.length));
            } catch (cfgErr) {
              console.warn('Advertencia: no se pudieron actualizar configuraciones:', cfgErr.message);
            }

            console.log(`[Import] ${mappedProducts.length} productos importados desde "${originalName}" (Hoja: ${firstSheetName})`);

            return res.json({
              success: true,
              message: `Lista de productos actualizada con éxito (${mappedProducts.length} productos importados)`,
              total: mappedProducts.length,
              filename: originalName,
              fecha_carga: nowIso
            });
          });
        });
      });
    });
  });
};

app.post('/api/productos/upload-excel', uploadExcel.single('excel'), processExcelUpload);
app.post('/api/products/upload-excel',  uploadExcel.single('excel'), processExcelUpload);
app.post('/api/productos/upload-file',  uploadExcel.single('excelFile'), processExcelUpload);
app.post('/api/products/import',        uploadExcel.single('excel'), processExcelUpload);
app.post('/api/productos/import',       uploadExcel.single('excel'), processExcelUpload);

const downloadCurrentExcel = async (req, res) => {
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    const targetFile = files.find(f => f.startsWith('ultimo_catalogo'));

    if (targetFile) {
      const originalName = (await getConfigValue('nombre_archivo_catalogo')) || targetFile;
      return res.download(path.join(uploadsDir, targetFile), originalName);
    }
  }

  return res.status(404).json({ success: false, message: 'No hay ningún archivo Excel cargado en el sistema.' });
};

app.get('/api/productos/download-last', downloadCurrentExcel);
app.get('/api/productos/download-current', downloadCurrentExcel);
app.get('/api/products/download-current', downloadCurrentExcel);

// --- OBSOLESCENCIA ---

app.get('/api/config/obsolescencia', async (req, res) => {
  try {
    const diasGraciaStr = (await getConfigValue('dias_gracia_obsolescencia')) || '7';
    const fechaUltimaCarga = await getConfigValue('fecha_ultima_carga');
    const nombreArchivo = (await getConfigValue('nombre_archivo_catalogo')) || 'Sin archivo cargado';
    const totalProductos = parseInt((await getConfigValue('total_productos')) || '0', 10);

    const diasGracia = parseInt(diasGraciaStr, 10) || 7;
    let diasTranscurridos = null;
    let estaObsoleto = false;
    let mensaje = '';

    if (!fechaUltimaCarga) {
      estaObsoleto = true;
      mensaje = 'No se ha cargado ningún catálogo de precios en el sistema.';
    } else {
      const fechaCarga = new Date(fechaUltimaCarga);
      const hoy = new Date();
      const diffMs = hoy.getTime() - fechaCarga.getTime();
      diasTranscurridos = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      if (diasTranscurridos > diasGracia) {
        estaObsoleto = true;
        mensaje = `La lista de precios tiene ${diasTranscurridos} día(s) de antigüedad (Límite configurado: ${diasGracia} días). Los precios podrían estar desactualizados.`;
      } else {
        estaObsoleto = false;
        const diasRestantes = diasGracia - diasTranscurridos;
        mensaje = `Catálogo al día. Cargado hace ${diasTranscurridos} día(s) (${diasRestantes} día(s) de vigencia restante).`;
      }
    }

    res.json({
      success: true,
      dias_gracia: diasGracia,
      fecha_ultima_carga: fechaUltimaCarga,
      nombre_archivo: nombreArchivo,
      total_productos: totalProductos,
      dias_transcurridos: diasTranscurridos,
      esta_obsoleto: estaObsoleto,
      mensaje
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/config/obsolescencia', async (req, res) => {
  const { dias_gracia } = req.body;
  const dias = parseInt(dias_gracia, 10);

  if (isNaN(dias) || dias < 1 || dias > 30) {
    return res.status(400).json({ success: false, message: 'El rango de días de gracia debe ser entre 1 y 30.' });
  }

  try {
    await setConfigValue('dias_gracia_obsolescencia', dias);
    res.json({ success: true, message: `Días de gracia actualizados a ${dias} día(s)`, dias_gracia: dias });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- BACKUPS ZIP ---

app.get('/api/backup/export', async (req, res) => {
  try {
    const zip = new AdmZip();
    const dbFilePath = path.join(basePath, 'etiquetas.db');

    if (fs.existsSync(dbFilePath)) {
      zip.addLocalFile(dbFilePath);
    }

    if (fs.existsSync(uploadsDir)) {
      zip.addLocalFolder(uploadsDir, 'uploads');
    }

    const fechaCarga = await getConfigValue('fecha_ultima_carga');
    const diasGracia = await getConfigValue('dias_gracia_obsolescencia');
    const manifest = {
      app: 'Etiquetas de Precios',
      version: '1.0.0',
      fecha_exportacion: new Date().toISOString(),
      configuraciones: {
        dias_gracia_obsolescencia: diasGracia,
        fecha_ultima_carga: fechaCarga
      }
    };
    zip.addFile('backup_manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    const zipBuffer = zip.toBuffer();
    const dateStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `backup_etiquetas_${dateStamp}.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': zipBuffer.length
    });

    res.send(zipBuffer);
  } catch (err) {
    console.error('Error al exportar backup:', err);
    res.status(500).json({ success: false, message: 'Error al generar la copia de seguridad: ' + err.message });
  }
});

app.post('/api/backup/import', uploadZip.single('backupZip'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se subió ningún archivo ZIP de respaldo.' });
  }

  const zipPath = req.file.path;

  try {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    const hasDb = zipEntries.some(e => e.entryName === 'etiquetas.db' || e.entryName.endsWith('/etiquetas.db'));
    if (!hasDb) {
      throw new Error('El archivo ZIP no contiene una base de datos válida (etiquetas.db).');
    }

    zip.extractEntryTo('etiquetas.db', basePath, false, true);

    zipEntries.forEach(entry => {
      if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
        zip.extractEntryTo(entry, uploadsDir, false, true);
      }
    });

    try { fs.unlinkSync(zipPath); } catch (e) {}

    res.json({
      success: true,
      message: 'Copia de seguridad restaurada con éxito. Todos los datos, plantillas y configuraciones han sido recuperados.'
    });

  } catch (err) {
    console.error('Error al restaurar backup:', err);
    try { fs.unlinkSync(zipPath); } catch (e) {}
    res.status(400).json({ success: false, message: 'Error al restaurar copia de seguridad: ' + err.message });
  }
});

// --- GESTIÓN DE FUENTES PERSONALIZADAS ---

app.get('/api/fonts', (req, res) => {
  db.all("SELECT * FROM fuentes ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json(rows || []);
  });
});

app.post('/api/fonts/upload', uploadFont.single('fontFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No se subió ningún archivo de fuente.' });

  const customFamily = req.body.nombre_familia ? req.body.nombre_familia.trim() : path.basename(req.file.originalname, path.extname(req.file.originalname));
  const relativePath = `/uploads/fonts/${req.file.filename}`;

  db.run(`
    INSERT INTO fuentes (nombre_familia, nombre_archivo, ruta)
    VALUES (?, ?, ?)
  `, [customFamily, req.file.originalname, relativePath], function(err) {
    if (err) {
      // Si ya existía con ese nombre
      return res.json({ success: true, font: { nombre_familia: customFamily, ruta: relativePath } });
    }
    res.json({ success: true, font: { id: this.lastID, nombre_familia: customFamily, ruta: relativePath } });
  });
});

app.delete('/api/fonts/:id', (req, res) => {
  db.get("SELECT * FROM fuentes WHERE id = ?", [req.params.id], (err, font) => {
    if (err || !font) return res.status(404).json({ success: false, message: 'Fuente no encontrada' });

    db.run("DELETE FROM fuentes WHERE id = ?", [req.params.id], () => {
      const fullPath = path.join(basePath, font.ruta.replace(/^\//, ''));
      try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (e) {}
      res.json({ success: true, message: 'Fuente eliminada' });
    });
  });
});

// --- GESTIÓN DE FONDOS DE PLANTILLAS ---

app.post('/api/templates/background-upload', uploadBg.single('bgFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No se subió ninguna imagen.' });
  const relativePath = `/uploads/backgrounds/${req.file.filename}`;
  res.json({ success: true, url: relativePath, filename: req.file.originalname });
});

// --- GESTIÓN DE PLANTILLAS (CRUD COMPLETO) ---

app.get('/api/templates', (req, res) => {
  db.all("SELECT * FROM plantillas ORDER BY LOWER(nombre) ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    
    const parsed = (rows || []).map(r => {
      let slots_fondo      = [];
      let campos_habilitados = [];
      let elementos        = {};   // objeto, no array
      let matriz_a4        = {};

      try { slots_fondo        = JSON.parse(r.slots_fondo        || '[]'); } catch (e) {}
      try { campos_habilitados = JSON.parse(r.campos_habilitados || '[]'); } catch (e) {}
      try { elementos          = JSON.parse(r.elementos          || '{}'); } catch (e) {}
      try { matriz_a4          = JSON.parse(r.matriz_a4          || '{}'); } catch (e) {}

      // Asegurar que elementos es objeto (no array)
      if (!elementos || Array.isArray(elementos) || typeof elementos !== 'object') elementos = {};
      // Asegurar que campos_habilitados es array
      if (!Array.isArray(campos_habilitados)) campos_habilitados = [];

      // ancho/alto: se guardan en la DB ya en cm como float
      const ancho = parseFloat(r.ancho) || 10.0;
      const alto  = parseFloat(r.alto)  || 5.0;

      return {
        id: r.id,
        nombre: r.nombre,
        ancho,
        alto,
        etiqueta_tamano: r.etiqueta_tamano || 'Personalizado',
        orientacion: r.orientacion || 'horizontal',
        slots_fondo,
        slot_activo: r.slot_activo != null ? r.slot_activo : 0,
        campos_habilitados,
        elementos,
        matriz_a4,
        fondo: r.fondo || '',
        fecha_creacion: r.fecha_creacion,
        fecha_modificacion: r.fecha_modificacion
      };
    });

    res.json(parsed);
  });
});

app.get('/api/templates/:id', (req, res) => {
  db.get("SELECT * FROM plantillas WHERE id = ?", [req.params.id], (err, r) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!r) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    let slots_fondo        = [];
    let campos_habilitados = [];
    let elementos          = {};   // objeto, no array
    let matriz_a4          = {};

    try { slots_fondo        = JSON.parse(r.slots_fondo        || '[]'); } catch (e) {}
    try { campos_habilitados = JSON.parse(r.campos_habilitados || '[]'); } catch (e) {}
    try { elementos          = JSON.parse(r.elementos          || '{}'); } catch (e) {}
    try { matriz_a4          = JSON.parse(r.matriz_a4          || '{}'); } catch (e) {}

    // Asegurar tipos correctos
    if (!elementos || Array.isArray(elementos) || typeof elementos !== 'object') elementos = {};
    if (!Array.isArray(campos_habilitados)) campos_habilitados = [];

    const ancho = parseFloat(r.ancho) || 10.0;
    const alto  = parseFloat(r.alto)  || 5.0;

    res.json({
      id: r.id,
      nombre: r.nombre,
      ancho,
      alto,
      etiqueta_tamano: r.etiqueta_tamano || 'Personalizado',
      orientacion: r.orientacion || 'horizontal',
      slots_fondo,
      slot_activo: r.slot_activo != null ? r.slot_activo : 0,
      campos_habilitados,
      elementos,
      matriz_a4,
      fondo: r.fondo || '',
      fecha_creacion: r.fecha_creacion,
      fecha_modificacion: r.fecha_modificacion
    });
  });
});

app.post('/api/templates', (req, res) => {
  const {
    nombre,
    ancho,
    alto,
    etiqueta_tamano,
    orientacion,
    slots_fondo,
    slot_activo,
    campos_habilitados,
    elementos,
    matriz_a4,
    fondo
  } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ success: false, message: 'El nombre de la plantilla es obligatorio' });
  }

  const slotsStr  = typeof slots_fondo       === 'string' ? slots_fondo       : JSON.stringify(slots_fondo       || []);
  const camposStr  = typeof campos_habilitados === 'string' ? campos_habilitados : JSON.stringify(campos_habilitados || []);
  const elemStr    = typeof elementos          === 'string' ? elementos          : JSON.stringify(elementos          || {});
  const matrizStr  = typeof matriz_a4          === 'string' ? matriz_a4          : JSON.stringify(matriz_a4          || {});

  db.run(`
    INSERT INTO plantillas (
      nombre, ancho, alto, etiqueta_tamano, orientacion, slots_fondo, slot_activo,
      campos_habilitados, elementos, matriz_a4, fondo, fecha_modificacion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    nombre.trim(),
    parseFloat(ancho) || 10.0,
    parseFloat(alto)  || 5.0,
    etiqueta_tamano || 'Personalizado',
    orientacion || 'horizontal',
    slotsStr,
    parseInt(slot_activo, 10) || 0,
    camposStr,
    elemStr,
    matrizStr,
    fondo || ''
  ], function(err) {
    if (err) {
      return res.status(400).json({ success: false, message: 'Error al guardar plantilla (nombre duplicado o formato inválido): ' + err.message });
    }
    res.json({ success: true, id: this.lastID, message: 'Plantilla guardada con éxito' });
  });
});

app.put('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    ancho,
    alto,
    etiqueta_tamano,
    orientacion,
    slots_fondo,
    slot_activo,
    campos_habilitados,
    elementos,
    matriz_a4,
    fondo
  } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ success: false, message: 'El nombre de la plantilla es obligatorio' });
  }

  const slotsStr  = typeof slots_fondo       === 'string' ? slots_fondo       : JSON.stringify(slots_fondo       || []);
  const camposStr  = typeof campos_habilitados === 'string' ? campos_habilitados : JSON.stringify(campos_habilitados || []);
  const elemStr    = typeof elementos          === 'string' ? elementos          : JSON.stringify(elementos          || {});
  const matrizStr  = typeof matriz_a4          === 'string' ? matriz_a4          : JSON.stringify(matriz_a4          || {});

  db.run(`
    UPDATE plantillas
    SET nombre = ?, ancho = ?, alto = ?, etiqueta_tamano = ?, orientacion = ?,
        slots_fondo = ?, slot_activo = ?, campos_habilitados = ?, elementos = ?,
        matriz_a4 = ?, fondo = ?, fecha_modificacion = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    nombre.trim(),
    parseFloat(ancho) || 10.0,
    parseFloat(alto)  || 5.0,
    etiqueta_tamano || 'Personalizado',
    orientacion || 'horizontal',
    slotsStr,
    parseInt(slot_activo, 10) || 0,
    camposStr,
    elemStr,
    matrizStr,
    fondo || '',
    id
  ], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error al actualizar plantilla: ' + err.message });
    }
    res.json({ success: true, message: 'Plantilla actualizada con éxito' });
  });
});

// Duplicar plantilla
app.post('/api/templates/:id/duplicate', (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM plantillas WHERE id = ?", [id], (err, row) => {
    if (err || !row) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    const nuevoNombre = `${row.nombre} (Copia ${Date.now().toString().slice(-4)})`;

    db.run(`
      INSERT INTO plantillas (
        nombre, ancho, alto, etiqueta_tamano, orientacion, slots_fondo, slot_activo,
        campos_habilitados, elementos, matriz_a4, fondo, fecha_modificacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      nuevoNombre,
      row.ancho,
      row.alto,
      row.etiqueta_tamano,
      row.orientacion,
      row.slots_fondo,
      row.slot_activo,
      row.campos_habilitados,
      row.elementos,
      row.matriz_a4,
      row.fondo
    ], function(insertErr) {
      if (insertErr) return res.status(500).json({ success: false, message: insertErr.message });
      res.json({ success: true, id: this.lastID, nombre: nuevoNombre, message: 'Plantilla duplicada con éxito' });
    });
  });
});

app.delete('/api/templates/:id', (req, res) => {
  db.run("DELETE FROM plantillas WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: 'Plantilla eliminada con éxito' });
  });
});

// --- PRODUCTOS CRUD ---

const getProductsHandler = (req, res) => {
  db.all("SELECT * FROM productos ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message, error: err.message });
    
    const mapped = (rows || []).map(r => ({
      id: r.id,
      cod_1: r.cod_1 || r.codigo || '',
      cod_2: r.cod_2 || '',
      producto: r.producto || '',
      Producto: r.producto || '',
      codigo: r.cod_1 || r.codigo || '',
      pn: r.cod_2 || '',
      PN: r.cod_2 || '',
      title: r.title || r.descripcion || '',
      Title: r.title || r.descripcion || '',
      descripcion: r.title || r.descripcion || '',
      spec_1: r.spec_1 || '',
      spec_2: r.spec_2 || '',
      spec_3: r.spec_3 || '',
      spec_4: r.spec_4 || '',
      spec_5: r.spec_5 || '',
      moneda: r.moneda || '$',
      Moneda: r.moneda || '$',
      publico: r.publico ?? r.precio_1 ?? 0,
      PUBLICO: r.publico ?? r.precio_1 ?? 0,
      precio_1: r.publico ?? r.precio_1 ?? 0,
      distribuidor: r.distribuidor ?? r.precio_2 ?? 0,
      DISTRIBUIDOR: r.distribuidor ?? r.precio_2 ?? 0,
      DISTRIB: r.distribuidor ?? r.precio_2 ?? 0,
      precio_2: r.distribuidor ?? r.precio_2 ?? 0,
      etiqueta_tamano: r.etiqueta_tamano || r.seccion || '',
      'Etiqueta Tamaño': r.etiqueta_tamano || r.seccion || '',
      seccion: r.etiqueta_tamano || r.seccion || ''
    }));

    res.json(mapped);
  });
};

app.get('/api/products', getProductsHandler);
app.get('/api/productos', getProductsHandler);

const createProductHandler = (req, res) => {
  const p = req.body;
  const cod_1 = p.cod_1 || p.codigo || '';
  const cod_2 = p.cod_2 || p.pn || p.PN || '';
  const producto = p.producto || p.Producto || '';
  const title = p.title || p.Title || p.descripcion || '';
  const spec_1 = p.spec_1 || p.Spec1 || '';
  const spec_2 = p.spec_2 || p.Spec2 || '';
  const spec_3 = p.spec_3 || p.Spec3 || '';
  const spec_4 = p.spec_4 || p.Spec4 || '';
  const spec_5 = p.spec_5 || p.Spec5 || '';
  const moneda = p.moneda || p.Moneda || '$';
  const publico = parsePrice(p.publico ?? p.PUBLICO ?? p.precio_1);
  const distribuidor = parsePrice(p.distribuidor ?? p.DISTRIBUIDOR ?? p.precio_2);
  const etiqueta_tamano = p.etiqueta_tamano || p['Etiqueta Tamaño'] || p.seccion || '';

  db.run(`
    INSERT INTO productos (
      cod_1, cod_2, producto, title, spec_1, spec_2, spec_3, spec_4, spec_5, moneda, publico, distribuidor, etiqueta_tamano
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [cod_1, cod_2, producto, title, spec_1, spec_2, spec_3, spec_4, spec_5, moneda, publico, distribuidor, etiqueta_tamano], function(err) {
    if (err) return res.status(400).json({ success: false, message: err.message, error: err.message });
    res.json({ success: true, id: this.lastID });
  });
};

app.post('/api/products', createProductHandler);
app.post('/api/productos', createProductHandler);

const updateProductHandler = (req, res) => {
  const { id } = req.params;
  const p = req.body;
  const cod_1 = p.cod_1 || p.codigo || '';
  const cod_2 = p.cod_2 || p.pn || p.PN || '';
  const producto = p.producto !== undefined ? (p.producto || p.Producto || '') : undefined;
  const title = p.title || p.Title || p.descripcion || '';
  const spec_1 = p.spec_1 || p.Spec1 || '';
  const spec_2 = p.spec_2 || p.Spec2 || '';
  const spec_3 = p.spec_3 || p.Spec3 || '';
  const spec_4 = p.spec_4 || p.Spec4 || '';
  const spec_5 = p.spec_5 || p.Spec5 || '';
  const moneda = p.moneda || p.Moneda || '$';
  const publico = parsePrice(p.publico ?? p.PUBLICO ?? p.precio_1);
  const distribuidor = parsePrice(p.distribuidor ?? p.DISTRIBUIDOR ?? p.precio_2);
  const etiqueta_tamano = p.etiqueta_tamano || p['Etiqueta Tamaño'] || p.seccion || '';

  if (producto !== undefined) {
    db.run(`
      UPDATE productos
      SET cod_1 = ?, cod_2 = ?, producto = ?, title = ?, spec_1 = ?, spec_2 = ?, spec_3 = ?, spec_4 = ?, spec_5 = ?,
          moneda = ?, publico = ?, distribuidor = ?, etiqueta_tamano = ?
      WHERE id = ?
    `, [cod_1, cod_2, producto, title, spec_1, spec_2, spec_3, spec_4, spec_5, moneda, publico, distribuidor, etiqueta_tamano, id], function(err) {
      if (err) return res.status(500).json({ success: false, message: err.message, error: err.message });
      res.json({ success: true });
    });
  } else {
    db.run(`
      UPDATE productos
      SET cod_1 = ?, cod_2 = ?, title = ?, spec_1 = ?, spec_2 = ?, spec_3 = ?, spec_4 = ?, spec_5 = ?,
          moneda = ?, publico = ?, distribuidor = ?, etiqueta_tamano = ?
      WHERE id = ?
    `, [cod_1, cod_2, title, spec_1, spec_2, spec_3, spec_4, spec_5, moneda, publico, distribuidor, etiqueta_tamano, id], function(err) {
      if (err) return res.status(500).json({ success: false, message: err.message, error: err.message });
      res.json({ success: true });
    });
  }
};

app.put('/api/products/:id', updateProductHandler);
app.put('/api/productos/:id', updateProductHandler);

// --- VACIAR LISTADO DE PRODUCTOS (DELETE /api/products/clear) ---
// IMPORTANTE: este handler debe registrarse ANTES de /:id para que Express
// no interprete 'clear' como un parámetro de ID.
const clearProductsHandler = (req, res) => {
  // Rollback preventivo: si quedó abierta una transacción fallida
  db.run('ROLLBACK', () => {
    db.serialize(() => {
      // Paso 1: borrar todos los productos
      db.run('DELETE FROM productos', function (delErr) {
        if (delErr) {
          console.error('Error al vaciar productos:', delErr);
          return res.status(500).json({ success: false, message: delErr.message });
        }

        const deleted = this.changes;
        console.log(`[Clear] ${deleted} producto(s) eliminados de la tabla.`);

        // Paso 2: resetear metadatos de configuración
        db.run(
          `UPDATE configuraciones
           SET valor = CASE
             WHEN clave = 'total_productos'          THEN '0'
             WHEN clave = 'fecha_ultima_carga'       THEN ''
             WHEN clave = 'nombre_archivo_catalogo'  THEN ''
           END,
           actualizado_en = CURRENT_TIMESTAMP
           WHERE clave IN ('total_productos', 'fecha_ultima_carga', 'nombre_archivo_catalogo')`,
          (cfgErr) => {
            console.log('[Clear] Listado de productos vaciado correctamente.');
            // Responder exclusivamente con 200 OK + { success: true, count: 0 }
            return res.status(200).json({ success: true, count: 0 });
          }
        );
      });
    });
  });
};

// ⚠️  ORDEN CRÍTICO: /clear ANTES de /:id para evitar que Express
//    capture 'clear' como valor del parámetro :id
app.delete('/api/products/clear',  clearProductsHandler);
app.delete('/api/productos/clear', clearProductsHandler);
app.post('/api/products/clear',    clearProductsHandler);
app.post('/api/productos/clear',   clearProductsHandler);

// --- ELIMINAR SOLO EL ARCHIVO EXCEL ALMACENADO (sin tocar la DB) ---
// DELETE /api/products/excel — borra únicamente el archivo físico en uploads/
const deleteExcelFileHandler = (req, res) => {
  if (!fs.existsSync(uploadsDir)) {
    return res.status(404).json({ success: false, message: 'No hay ningún archivo Excel almacenado.' });
  }

  let deleted = false;
  try {
    fs.readdirSync(uploadsDir)
      .filter(f => f.startsWith('ultimo_catalogo'))
      .forEach(f => {
        fs.unlinkSync(path.join(uploadsDir, f));
        deleted = true;
      });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al eliminar el archivo: ' + err.message });
  }

  if (!deleted) {
    return res.status(404).json({ success: false, message: 'No hay ningún archivo Excel almacenado.' });
  }

  // Limpiar el nombre del archivo en configuraciones (mantiene fecha y total)
  db.run(
    `UPDATE configuraciones SET valor = '', actualizado_en = CURRENT_TIMESTAMP
     WHERE clave = 'nombre_archivo_catalogo'`,
    (err) => {
      if (err) console.warn('[DeleteExcel] No se pudo limpiar nombre en config:', err.message);
    }
  );

  console.log('[DeleteExcel] Archivo Excel eliminado correctamente.');
  return res.status(200).json({ success: true, message: 'Archivo Excel eliminado correctamente.' });
};

app.delete('/api/products/excel',  deleteExcelFileHandler);
app.delete('/api/productos/excel', deleteExcelFileHandler);

const deleteProductHandler = (req, res) => {
  db.run('DELETE FROM productos WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false, message: err.message, error: err.message });
    res.json({ success: true });
  });
};

app.delete('/api/products/:id',  deleteProductHandler);
app.delete('/api/productos/:id', deleteProductHandler);

// Control global de excepciones
process.on('uncaughtException', (err) => {
  console.error('⚠️ Error no capturado:', err);
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`=======================================`);
  console.log(`Servidor activo en ${url}`);
  console.log(`=======================================`);
  try {
    open(url);
  } catch (e) {}
});