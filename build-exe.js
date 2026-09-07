const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando compilación de EtiquetasLocal.exe...');

const distFolder = path.join(__dirname, 'dist');
if (!fs.existsSync(distFolder)) {
  fs.mkdirSync(distFolder, { recursive: true });
}

try {
  execSync('npx pkg .', { stdio: 'inherit' });
  console.log('✅ ¡Compilación completada con éxito! El archivo ejecutable está listo en dist/etiquetas-app.exe');
} catch (err) {
  console.error('❌ Error durante la compilación:', err.message);
  process.exit(1);
}