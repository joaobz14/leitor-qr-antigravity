import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pathsToTry = [
  path.join(rootDir, 'node_modules', 'qrcode-generator', 'dist', 'qrcode.js'),
  path.join(rootDir, 'node_modules', 'qrcode-generator', 'qrcode.js'),
];

let srcPath = pathsToTry.find(p => fs.existsSync(p));

if (!srcPath) {
  console.error(`[ERRO] Pacote qrcode-generator não encontrado em nenhuma das rotas esperadas.`);
  console.error('Execute "npm install" antes de rodar este script.');
  process.exit(1);
}


const destDir = path.join(rootDir, 'site', 'assets', 'vendor');
const destPath = path.join(destDir, 'qrcode.js');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(srcPath, destPath);
console.log(`[OK] qrcode.js copiado para ${destPath}`);

