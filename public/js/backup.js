// =========================================================================
// MÓDULO ADMINISTRATIVO: COPIAS DE SEGURIDAD (.ZIP)
// Archivo: public/js/backup.js
// Responsabilidad: Exportación e importación/restauración de copias .zip.
// =========================================================================

async function initBackupModule() {
  // Inicializador de módulo de respaldos en Módulo 4
}

// Exportar copia de seguridad completa (.zip)
function exportBackupZip() {
  window.location.href = '/api/backup/export';
}

// Importar y restaurar copia de seguridad (.zip)
async function importBackupZip() {
  const fileInput = document.getElementById('backup-zip-input');
  if (!fileInput || !fileInput.files[0]) {
    alert('Por favor selecciona un archivo .zip de copia de seguridad.');
    return;
  }

  if (!confirm('⚠️ ATENCIÓN: Al restaurar esta copia de seguridad se sobrescribirá la base de datos actual y todas las configuraciones con los datos del respaldo. ¿Deseas continuar?')) {
    return;
  }

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('backupZip', file);

  try {
    const res = await fetch('/api/backup/import', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al restaurar respaldo');

    alert('✅ ' + (data.message || 'Copia de seguridad restaurada con éxito.'));
    fileInput.value = '';
  } catch (err) {
    alert('Error al restaurar respaldo: ' + err.message);
  }
}

// Exponer funciones en window
window.initBackupModule = initBackupModule;
window.exportBackupZip = exportBackupZip;
window.importBackupZip = importBackupZip;
