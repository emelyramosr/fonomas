const formulario = document.getElementById("formulario-agendar");
const respuesta = document.getElementById("respuesta-formulario");

// Si llegas desde una página de servicio (agendar.html?servicio=Psicología),
// el servicio ya aparece seleccionado.
const servicioElegido = new URLSearchParams(window.location.search).get("servicio");
if (servicioElegido) {
  formulario.servicio.value = servicioElegido;
}

// No permitir elegir fechas pasadas
const hoy = new Date();
formulario.fecha.min =
  hoy.getFullYear() + "-" +
  String(hoy.getMonth() + 1).padStart(2, "0") + "-" +
  String(hoy.getDate()).padStart(2, "0");

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const datos = {
    servicio: formulario.servicio.value,
    modalidad: formulario.modalidad.value,
    fecha: formulario.fecha.value,
    hora: formulario.hora.value,
    nombre: formulario.nombre.value,
    telefono: formulario.telefono.value,
    correo: formulario.correo.value,
    mensaje: formulario.mensaje.value
  };

  try {
    const peticion = await fetch("/api/citas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(datos)
    });

    let resultado = {};
    try {
      resultado = await peticion.json();
    } catch (e) {
      // La respuesta no era JSON; se usa el mensaje genérico
    }

    if (!peticion.ok) {
      throw new Error(resultado.mensaje || "No se pudo enviar la solicitud.");
    }
    respuesta.textContent = resultado.mensaje;
    respuesta.style.color = "green";
    formulario.reset();
  } catch (error) {
    respuesta.textContent = error.message || "No se pudo enviar la solicitud.";
    respuesta.style.color = "red";
  }
});
