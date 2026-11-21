// Copia las citas del antiguo archivo citas.json a MongoDB.
// Uso: npm run importar            (lee citas.json de la carpeta del proyecto)
//      npm run importar -- otra/ruta/citas.json
// Se puede ejecutar varias veces: las citas ya importadas no se duplican.
try {
  process.loadEnvFile();
} catch (e) {}

const fs = require("fs");
const path = require("path");
const db = require("../db");

async function main() {
  const archivo = path.resolve(process.argv[2] || path.join(__dirname, "..", "citas.json"));
  if (!fs.existsSync(archivo)) {
    console.log(`No existe ${archivo}. No hay nada que importar.`);
    return;
  }

  const contenido = fs.readFileSync(archivo, "utf8").trim();
  const lista = contenido ? JSON.parse(contenido) : [];
  await db.conectar();

  let nuevas = 0;
  for (const cita of lista) {
    const { id, ...datos } = cita;
    // Los id antiguos eran la fecha de creación en milisegundos
    const creadoEn = typeof id === "number" ? new Date(id) : new Date();
    const resultado = await db.citas().updateOne(
      { idAnterior: String(id) },
      { $setOnInsert: { ...datos, estado: datos.estado || "Pendiente", creadoEn, actualizadoEn: creadoEn, idAnterior: String(id) } },
      { upsert: true }
    );
    if (resultado.upsertedCount) nuevas++;
  }

  console.log(`Listo: ${nuevas} citas nuevas importadas (${lista.length - nuevas} ya estaban).`);
}

main()
  .catch((error) => {
    console.error("Error al importar:", error.message);
    process.exitCode = 1;
  })
  .finally(() => db.desconectar());
