const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Determinar el directorio base tanto en entorno de desarrollo como en ejecutable empaquetado con pkg
const isPkg = typeof process.pkg !== 'undefined';
const basePath = isPkg ? path.dirname(process.execPath) : process.cwd();

// Soporte para ruta persistente (Docker o ruta personalizada):
// 1. Variable de entorno explícita DB_PATH (ej: /app/data/etiquetas.db)
// 2. Si se define DATA_DIR (ej: /app/data), se guarda en path.join(DATA_DIR, 'etiquetas.db')
// 3. Por defecto en local/pkg: basePath/etiquetas.db
const dataDir = process.env.DATA_DIR || (process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : basePath);
const dbPath = process.env.DB_PATH || path.join(dataDir, 'etiquetas.db');

// Asegurar que el directorio contenedor exista antes de que SQLite intente crear/abrir el archivo
function ensureDbDir() {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch (e) {
      console.error(`No se pudo crear carpeta para la base de datos (${dbDir}):`, e.message);
    }
  }
}

let currentDb = null;

function initSchema(databaseInstance) {
  databaseInstance.serialize(() => {
    // 1. Tabla Usuarios con admin / admin inicial
    databaseInstance.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE,
      password TEXT,
      rol TEXT,
      activo INTEGER DEFAULT 1,
      permisos TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (!err) {
        databaseInstance.run(`INSERT OR IGNORE INTO usuarios (id, usuario, password, rol, activo, permisos) VALUES (1, 'admin', 'admin', 'Administrador', 1, '["generador","plantillas","datos","usuarios"]')`);
      }
    });

    // Migración segura para tablas preexistentes
    databaseInstance.run(`ALTER TABLE usuarios ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});
    databaseInstance.run(`ALTER TABLE usuarios ADD COLUMN activo INTEGER DEFAULT 1`, () => {});
    databaseInstance.run(`ALTER TABLE usuarios ADD COLUMN permisos TEXT`, () => {});
    // Asegurar que el admin principal siempre tenga rol Administrador y todos los módulos
    databaseInstance.run(`UPDATE usuarios SET permisos = '["generador","plantillas","datos","usuarios"]', rol = 'Administrador' WHERE id = 1 OR LOWER(usuario) = 'admin'`, () => {});

    // 2. Tabla Configuraciones del Sistema (clave-valor)
    databaseInstance.run(`CREATE TABLE IF NOT EXISTS configuraciones (
      clave TEXT PRIMARY KEY,
      valor TEXT,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (!err) {
        databaseInstance.run(`INSERT OR IGNORE INTO configuraciones (clave, valor) VALUES ('dias_gracia_obsolescencia', '7')`);
        databaseInstance.run(`INSERT OR IGNORE INTO configuraciones (clave, valor) VALUES ('fecha_ultima_carga', NULL)`);
        databaseInstance.run(`INSERT OR IGNORE INTO configuraciones (clave, valor) VALUES ('nombre_archivo_catalogo', '')`);
        databaseInstance.run(`INSERT OR IGNORE INTO configuraciones (clave, valor) VALUES ('total_productos', '0')`);
      }
    });

    // 3. Tabla Productos completa
    databaseInstance.run(`CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cod_1 TEXT,
      cod_2 TEXT,
      producto TEXT,
      title TEXT,
      spec_1 TEXT,
      spec_2 TEXT,
      spec_3 TEXT,
      spec_4 TEXT,
      spec_5 TEXT,
      moneda TEXT DEFAULT '$',
      publico REAL DEFAULT 0,
      distribuidor REAL DEFAULT 0,
      etiqueta_tamano TEXT,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const columnasProductos = [
      { nombre: 'cod_1', tipo: 'TEXT' },
      { nombre: 'cod_2', tipo: 'TEXT' },
      { nombre: 'producto', tipo: 'TEXT' },
      { nombre: 'title', tipo: 'TEXT' },
      { nombre: 'spec_1', tipo: 'TEXT' },
      { nombre: 'spec_2', tipo: 'TEXT' },
      { nombre: 'spec_3', tipo: 'TEXT' },
      { nombre: 'spec_4', tipo: 'TEXT' },
      { nombre: 'spec_5', tipo: 'TEXT' },
      { nombre: 'moneda', tipo: "TEXT DEFAULT '$'" },
      { nombre: 'publico', tipo: 'REAL DEFAULT 0' },
      { nombre: 'distribuidor', tipo: 'REAL DEFAULT 0' },
      { nombre: 'etiqueta_tamano', tipo: 'TEXT' },
      { nombre: 'fecha_registro', tipo: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
    ];

    columnasProductos.forEach(col => {
      databaseInstance.run(`ALTER TABLE productos ADD COLUMN ${col.nombre} ${col.tipo}`, () => {});
    });

    // 4. Tabla Plantillas de Etiquetas Avanzada
    databaseInstance.run(`CREATE TABLE IF NOT EXISTS plantillas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE,
      ancho REAL DEFAULT 100,
      alto REAL DEFAULT 50,
      etiqueta_tamano TEXT DEFAULT 'Personalizado',
      orientacion TEXT DEFAULT 'horizontal',
      slots_fondo TEXT,
      slot_activo INTEGER DEFAULT 0,
      campos_habilitados TEXT,
      elementos TEXT,
      matriz_a4 TEXT,
      fondo TEXT,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const columnasPlantillas = [
      { nombre: 'etiqueta_tamano', tipo: "TEXT DEFAULT 'Personalizado'" },
      { nombre: 'orientacion', tipo: "TEXT DEFAULT 'horizontal'" },
      { nombre: 'slots_fondo', tipo: 'TEXT' },
      { nombre: 'slot_activo', tipo: 'INTEGER DEFAULT 0' },
      { nombre: 'campos_habilitados', tipo: 'TEXT' },
      { nombre: 'elementos', tipo: 'TEXT' },
      { nombre: 'matriz_a4', tipo: 'TEXT' },
      { nombre: 'fondo', tipo: 'TEXT' },
      { nombre: 'fecha_modificacion', tipo: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
    ];

    columnasPlantillas.forEach(col => {
      databaseInstance.run(`ALTER TABLE plantillas ADD COLUMN ${col.nombre} ${col.tipo}`, () => {});
    });

    // 5. Tabla Fuentes de Texto Personalizadas
    databaseInstance.run(`CREATE TABLE IF NOT EXISTS fuentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_familia TEXT UNIQUE,
      nombre_archivo TEXT,
      ruta TEXT,
      fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

function openDatabase() {
  ensureDbDir();
  currentDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("Error al conectar a SQLite:", err.message);
    } else {
      console.log(`Base de datos SQLite conectada en: ${dbPath}`);
    }
  });
  initSchema(currentDb);
  return currentDb;
}

// Inicializar conexión activa
openDatabase();

// Proxy para delegar dinámicamente llamadas a currentDb y permitir desconexión / reconexión en caliente
const db = new Proxy({}, {
  get(target, prop) {
    if (prop === 'dbPath') return dbPath;
    if (prop === 'closeConnection') {
      return () => new Promise((resolve) => {
        if (currentDb) {
          currentDb.close((err) => {
            if (err) console.warn("Aviso al cerrar conexión SQLite previa:", err.message);
            currentDb = null;
            resolve();
          });
        } else {
          resolve();
        }
      });
    }
    if (prop === 'reopen') {
      return () => new Promise((resolve) => {
        if (currentDb) {
          currentDb.close((err) => {
            if (err) console.warn("Aviso al cerrar DB previa:", err.message);
            openDatabase();
            resolve();
          });
        } else {
          openDatabase();
          resolve();
        }
      });
    }
    if (!currentDb) {
      openDatabase();
    }
    const val = currentDb[prop];
    return typeof val === 'function' ? val.bind(currentDb) : val;
  }
});

module.exports = db;