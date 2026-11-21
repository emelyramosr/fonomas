// CONEXIÓN A MONGODB
// MongoDB guarda "documentos" (objetos parecidos a JSON) dentro de "colecciones".
// Aquí usamos la base de datos "fonomas" y la colección "citas".
const { MongoClient, ObjectId } = require("mongodb");

let cliente = null;
let coleccionCitas = null;
let conexionEnCurso = null;

// Se conecta una sola vez y reutiliza la conexión en las siguientes llamadas
function conectar() {
  if (!conexionEnCurso) {
    conexionEnCurso = abrirConexion().catch((error) => {
      conexionEnCurso = null; // si falla, se reintenta en la siguiente petición
      throw error;
    });
  }
  return conexionEnCurso;
}

async function abrirConexion() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Falta la variable MONGODB_URI. Copia .env.example como .env y pega ahí la cadena de conexión de MongoDB Atlas."
    );
  }

  cliente = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await cliente.connect();

  const db = cliente.db(process.env.MONGODB_DB || "fonomas");
  coleccionCitas = db.collection("citas");

  // Índice para listar rápido las citas de la más reciente a la más antigua
  await coleccionCitas.createIndex({ creadoEn: -1 });

  return coleccionCitas;
}

function citas() {
  if (!coleccionCitas) throw new Error("La base de datos no está conectada.");
  return coleccionCitas;
}

async function desconectar() {
  if (cliente) await cliente.close();
}

// Convierte un documento de MongoDB al formato que usa el frontend
// (MongoDB usa "_id" como ObjectId; el frontend espera "id" como texto).
function aCita(doc) {
  const { _id, idAnterior, ...resto } = doc;
  return { id: _id.toHexString(), ...resto };
}

module.exports = { conectar, desconectar, citas, aCita, ObjectId };
