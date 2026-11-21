// 1. IMPORTAR LO NECESARIO
// Carga las variables del archivo .env (MONGODB_URI, ADMIN_PASSWORD...) si existe
try {
  process.loadEnvFile();
} catch (e) {
  // No hay archivo .env: se usan las variables del sistema (por ejemplo, en la nube)
}

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");

// 2. CREAR EL SERVIDOR
const app = express();

// 3. CONFIGURACIÓN
const PORT = process.env.PORT || 3001;

// Contraseña del panel de administración.
// Se define con la variable de entorno ADMIN_PASSWORD.
// Si no existe, se crea una al azar cada vez que arranca el servidor y se muestra en la consola.
const ADMIN_USUARIO = "admin";
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
let passwordAleatoria = false;
if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = crypto.randomBytes(6).toString("hex");
  passwordAleatoria = true;
}

// Valores permitidos (los mismos del formulario)
const SERVICIOS = ["Fonoaudiología", "Psicología", "Refuerzo escolar"];
const MODALIDADES = ["Presencial", "Virtual", "A domicilio"];
const HORAS = [
  "8:00 a. m.", "9:00 a. m.", "10:00 a. m.", "11:00 a. m.",
  "12:00 p. m.", "1:00 p. m.", "2:00 p. m.", "3:00 p. m."
];
const ESTADOS = ["Pendiente", "Confirmada", "Rechazada"];

// 4. PERMITIR RECIBIR DATOS JSON (con tamaño máximo)
app.use(express.json({ limit: "20kb" }));

// En Vercel las peticiones pasan por su proxy: así req.ip es la IP real del visitante
if (process.env.VERCEL) {
  app.set("trust proxy", true);
}

// 5. ARCHIVOS PÚBLICOS
// Todo lo que está en la carpeta "public" se puede ver desde internet.
// server.js, db.js, .env, package.json y node_modules quedan fuera y NO se pueden descargar.
// (En Vercel, la carpeta public la sirve directamente su CDN.)
app.use(express.static(path.join(__dirname, "public")));

// 6. PROTECCIÓN DEL PANEL DE ADMINISTRACIÓN (usuario y contraseña)
function iguales(a, b) {
  const hashA = crypto.createHash("sha256").update(String(a)).digest();
  const hashB = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function protegerAdmin(req, res, next) {
  const cabecera = req.headers.authorization || "";
  const [tipo, codigo] = cabecera.split(" ");

  if (tipo === "Basic" && codigo) {
    const texto = Buffer.from(codigo, "base64").toString("utf8");
    const separador = texto.indexOf(":");
    const usuario = texto.slice(0, separador);
    const clave = texto.slice(separador + 1);

    if (separador >= 0 && iguales(usuario, ADMIN_USUARIO) && iguales(clave, ADMIN_PASSWORD)) {
      return next();
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="Fonomas Admin"');
  res.status(401).send("Acceso restringido.");
}

app.get("/admin.html", protegerAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});
app.get("/admin.js", protegerAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.js"));
});

// 7. LAS CITAS SE GUARDAN EN MONGODB (ver db.js)
// La conexión se abre con la primera petición a la API y luego se reutiliza.
app.use("/api", async (req, res, next) => {
  try {
    await db.conectar();
    next();
  } catch (error) {
    console.error("No se pudo conectar a MongoDB:", error.message);
    res.status(503).json({ mensaje: "El servicio no está disponible. Intenta de nuevo en unos minutos." });
  }
});

// 8. LIMITAR SOLICITUDES (evita que alguien llene la base de datos de basura)
const intentos = new Map();
function limitarEnvios(req, res, next) {
  const ahora = Date.now();
  const ventana = 10 * 60 * 1000; // 10 minutos
  const maximo = 10;
  const lista = (intentos.get(req.ip) || []).filter((t) => ahora - t < ventana);

  if (lista.length >= maximo) {
    return res.status(429).json({
      mensaje: "Has enviado demasiadas solicitudes. Intenta de nuevo en unos minutos."
    });
  }
  lista.push(ahora);
  intentos.set(req.ip, lista);
  next();
}

// 9. VALIDAR LOS DATOS DE UNA CITA
function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function validarCita(cuerpo) {
  const datos = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
  const servicio = texto(datos.servicio);
  const modalidad = texto(datos.modalidad);
  const fecha = texto(datos.fecha);
  const hora = texto(datos.hora);
  const nombre = texto(datos.nombre);
  const telefono = texto(datos.telefono);
  const correo = texto(datos.correo);
  const mensaje = texto(datos.mensaje);

  if (!servicio || !modalidad || !fecha || !hora || !nombre || !telefono) {
    return { error: "Por favor, completa todos los campos obligatorios." };
  }
  if (!SERVICIOS.includes(servicio)) return { error: "El servicio seleccionado no es válido." };
  if (!MODALIDADES.includes(modalidad)) return { error: "La modalidad seleccionada no es válida." };
  if (!HORAS.includes(hora)) return { error: "La hora seleccionada no es válida." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(Date.parse(fecha))) {
    return { error: "La fecha no es válida." };
  }
  if (fecha < hoyISO()) return { error: "La fecha no puede ser anterior a hoy." };
  if (nombre.length < 2 || nombre.length > 100) {
    return { error: "El nombre debe tener entre 2 y 100 caracteres." };
  }
  const soloNumeros = telefono.replace(/[\s+\-()]/g, "");
  if (!/^\d{7,15}$/.test(soloNumeros)) {
    return { error: "El número de teléfono no es válido." };
  }
  if (correo && (correo.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))) {
    return { error: "El correo electrónico no es válido." };
  }
  if (mensaje.length > 1000) {
    return { error: "La información adicional no puede superar los 1000 caracteres." };
  }

  return { datos: { servicio, modalidad, fecha, hora, nombre, telefono, correo, mensaje } };
}

// 10. RECIBIR UNA SOLICITUD (pública: la usa el formulario)
app.post("/api/citas", limitarEnvios, async (req, res) => {
  const { error, datos } = validarCita(req.body);

  if (error) {
    return res.status(400).json({ mensaje: error });
  }

  const ahora = new Date();
  try {
    await db.citas().insertOne({
      ...datos,
      estado: "Pendiente",
      creadoEn: ahora,
      actualizadoEn: ahora
    });
  } catch (e) {
    console.error("No se pudo guardar la cita:", e.message);
    return res.status(500).json({
      mensaje: "No pudimos guardar tu solicitud. Intenta de nuevo en unos minutos."
    });
  }

  // No se devuelven los datos personales, solo la confirmación
  res.status(201).json({ mensaje: "Tu solicitud fue recibida correctamente." });
});

// 11. CONSULTAR LAS SOLICITUDES (solo admin), de la más reciente a la más antigua
app.get("/api/citas", protegerAdmin, async (req, res, next) => {
  try {
    const documentos = await db.citas().find().sort({ creadoEn: -1 }).toArray();
    res.json(documentos.map(db.aCita));
  } catch (e) {
    next(e);
  }
});

// 12. ACTUALIZAR EL ESTADO DE UNA CITA (solo admin)
app.put("/api/citas/:id", protegerAdmin, async (req, res) => {
  const estado = req.body && req.body.estado;

  if (!ESTADOS.includes(estado)) {
    return res.status(400).json({
      mensaje: "Estado no válido. Usa Pendiente, Confirmada o Rechazada."
    });
  }

  if (!db.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ mensaje: "No se encontró la solicitud." });
  }

  try {
    const resultado = await db.citas().updateOne(
      { _id: new db.ObjectId(req.params.id) },
      { $set: { estado, actualizadoEn: new Date() } }
    );

    if (resultado.matchedCount === 0) {
      return res.status(404).json({ mensaje: "No se encontró la solicitud." });
    }
  } catch (e) {
    console.error("No se pudo guardar el cambio:", e.message);
    return res.status(500).json({ mensaje: "No se pudo guardar el cambio." });
  }

  res.json({ mensaje: "Estado actualizado correctamente." });
});

// 13. RUTAS QUE NO EXISTEN Y ERRORES
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ mensaje: "Ruta no encontrada." });
  }
  res.status(404).send("Página no encontrada.");
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    return res.status(400).json({ mensaje: "Los datos enviados no son válidos." });
  }
  console.error(err);
  res.status(500).json({ mensaje: "Ocurrió un error en el servidor." });
});

// 14. INICIAR EL SERVIDOR
// En Vercel no se llama a listen: Vercel usa la app exportada al final.
// En tu computador ("npm start") se conecta a MongoDB y luego abre el puerto.
if (require.main === module) {
  db.conectar()
    .then(() => {
      console.log("Conectado a MongoDB.");
      app.listen(PORT, () => {
        console.log(`Fonomás está funcionando en http://localhost:${PORT}`);
        console.log(`Panel de administración: http://localhost:${PORT}/admin.html`);
        console.log(`Usuario: ${ADMIN_USUARIO}`);
        if (passwordAleatoria) {
          console.log(`Contraseña (temporal, cambia en cada arranque): ${ADMIN_PASSWORD}`);
          console.log("Para fijar una contraseña propia, define ADMIN_PASSWORD en el archivo .env.");
        } else {
          console.log("Contraseña: la definida en ADMIN_PASSWORD.");
        }
      });
    })
    .catch((error) => {
      console.error("No se pudo conectar a MongoDB:", error.message);
      process.exit(1);
    });
}

module.exports = app;
