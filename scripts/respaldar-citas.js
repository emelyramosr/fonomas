// Guarda una copia de todas las citas de MongoDB en backups/citas-AAAA-MM-DD.json
// Uso: npm run backup
try {
  process.loadEnvFile();
} catch (e) {}

const fs = require("fs");
const path = require("path");
const db = require("../db");

async function main() {
  await db.conectar();
  const documentos = await db.citas().find().sort({ creadoEn: 1 }).toArray();

  const carpeta = path.join(__dirname, "..", "backups");
  fs.mkdirSync(carpeta, { recursive: true });
  const archivo = path.join(carpeta, `citas-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(archivo, JSON.stringify(documentos.map(db.aCita), null, 2), "utf8");

  console.log(`Copia de ${documentos.length} citas guardada en ${archivo}`);
}

main()
  .catch((error) => {
    console.error("Error al respaldar:", error.message);
    process.exitCode = 1;
  })
  .finally(() => db.desconectar());
