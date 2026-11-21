const botonActualizar = document.getElementById("actualizar-citas");
const listaCitas = document.getElementById("lista-citas");
const mensajeAdmin = document.getElementById("mensaje-admin");

function crearLinea(etiqueta, valor) {
  const linea = document.createElement("p");
  const negrita = document.createElement("strong");
  negrita.textContent = etiqueta + " ";
  linea.append(negrita, document.createTextNode(valor));
  return linea;
}

async function cargarCitas() {
  try {
    const respuesta = await fetch("/api/citas");

    if (!respuesta.ok) {
      throw new Error("Respuesta no válida");
    }

    const citas = await respuesta.json();

    listaCitas.innerHTML = "";

    if (citas.length === 0) {
      listaCitas.textContent = "Todavía no hay solicitudes.";
      mensajeAdmin.textContent = "";
      return;
    }

    // El servidor ya las envía de la más reciente a la más antigua
    citas.forEach((cita) => {
      const tarjeta = document.createElement("article");
      tarjeta.className = "tarjeta-cita estado-" + String(cita.estado).toLowerCase();

      const titulo = document.createElement("h3");
      titulo.textContent = cita.nombre;

      const estado = document.createElement("span");
      estado.className = "etiqueta-estado";
      estado.textContent = cita.estado;
      titulo.appendChild(estado);

      const selectorEstado = document.createElement("select");
      ["Pendiente", "Confirmada", "Rechazada"].forEach((opcion) => {
        const elemento = document.createElement("option");
        elemento.value = opcion;
        elemento.textContent = opcion;
        if (opcion === cita.estado) {
          elemento.selected = true;
        }
        selectorEstado.appendChild(elemento);
      });

      const botonGuardar = document.createElement("button");
      botonGuardar.type = "button";
      botonGuardar.textContent = "Guardar estado";

      botonGuardar.addEventListener("click", async () => {
        try {
          const resp = await fetch(`/api/citas/${cita.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: selectorEstado.value })
          });

          const resultado = await resp.json();
          mensajeAdmin.textContent = resultado.mensaje;

          if (resp.ok) {
            cargarCitas();
          }
        } catch (error) {
          mensajeAdmin.textContent = "No se pudo guardar el cambio. Revisa la conexión.";
        }
      });

      const acciones = document.createElement("div");
      acciones.className = "acciones-cita";
      acciones.append(selectorEstado, botonGuardar);

      tarjeta.append(
        titulo,
        crearLinea("Servicio:", `${cita.servicio} | ${cita.modalidad}`),
        crearLinea("Fecha:", `${cita.fecha} | ${cita.hora}`),
        crearLinea("Teléfono:", cita.telefono),
        crearLinea("Correo:", cita.correo || "No indicado"),
        crearLinea("Información adicional:", cita.mensaje || "Ninguna"),
        acciones
      );
      listaCitas.appendChild(tarjeta);
    });

    mensajeAdmin.textContent = "Solicitudes actualizadas.";
  } catch (error) {
    mensajeAdmin.textContent = "No se pudieron cargar las solicitudes.";
  }
}

botonActualizar.addEventListener("click", cargarCitas);

cargarCitas();
