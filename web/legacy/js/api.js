/* =========================================================================
   CAPA DE ACCESO A DATOS · CLIENTE DEL BACKEND (FastAPI)
   -------------------------------------------------------------------------
   La interfaz (js/app.js) solo habla con este archivo a través de window.Api.

   URL base de la API
   ------------------
   Se resuelve en este orden:
     1. window.API_BASE_URL  (definido antes de cargar este script)
     2. <meta name="api-base" content="..."> en index.html
     3. "/api"  (misma origen: el backend sirve la carpeta web/)

   Con el backend en marcha, abrir http://127.0.0.1:3000/ (no file://),
   porque el navegador bloquea las peticiones desde el origen "null".

   Formato de error esperado del backend:
     { "mensaje": "texto para la persona usuaria", "campo": "opcional" }
   ========================================================================= */

(function () {
  "use strict";

  const metaBase = document.querySelector('meta[name="api-base"]');
  const baseConfigurada =
    (typeof window.API_BASE_URL === "string" && window.API_BASE_URL) ||
    (metaBase && metaBase.getAttribute("content")) ||
    "/api";

  const API_BASE_URL = String(baseConfigurada).replace(/\/+$/, "");

  /* ------------------------------ Utilidades ---------------------------- */
  function errorConCampo(mensaje, campo, estado) {
    const error = new Error(mensaje);
    error.campo = campo || undefined;
    error.status = estado;
    return error;
  }

  function numero(valor) {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : NaN;
  }

  function periodoActual(fecha = new Date()) {
    return `${fecha.getFullYear()}-${fecha.getMonth() + 1 <= 6 ? 1 : 2}`;
  }

  function obtenerPeriodoActual() {
    return periodoActual();
  }

  /**
   * Cliente HTTP común: añade JSON, traduce errores del backend y errores de red.
   */
  async function peticion(ruta, opciones = {}) {
    let respuesta;
    try {
      respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
        headers: {
          "Content-Type": "application/json",
          ...(opciones.headers || {})
        },
        ...opciones
      });
    } catch (error) {
      throw errorConCampo(
        "No se pudo conectar con el backend. Verifica que el servidor FastAPI esté en ejecución.",
        undefined,
        0
      );
    }

    if (respuesta.status === 204) {
      return null;
    }

    const texto = await respuesta.text();
    let cuerpo = null;
    if (texto) {
      try {
        cuerpo = JSON.parse(texto);
      } catch (error) {
        cuerpo = null;
      }
    }

    if (!respuesta.ok) {
      const mensaje =
        (cuerpo && cuerpo.mensaje) ||
        `El servidor respondió con un error (${respuesta.status}). Inténtalo de nuevo.`;
      throw errorConCampo(mensaje, cuerpo && cuerpo.campo, respuesta.status);
    }

    return cuerpo;
  }

  /* ------------------------------ Catálogos ----------------------------- */
  function listarFacultades() {
    return peticion("/facultades");
  }

  function listarCarreras() {
    return peticion("/carreras");
  }

  function listarMaterias() {
    return peticion("/materias");
  }

  function listarEstudiantes() {
    return peticion("/estudiantes");
  }

  /* ------------------------------ Registros ----------------------------- */
  function crearFacultad(datos) {
    return peticion("/facultades", {
      method: "POST",
      body: JSON.stringify({ nombre: datos.nombre })
    });
  }

  function crearCarrera(datos) {
    return peticion("/carreras", {
      method: "POST",
      body: JSON.stringify({
        nombre: datos.nombre,
        idFacultad: numero(datos.idFacultad)
      })
    });
  }

  function crearEstudiante(datos) {
    return peticion("/estudiantes", {
      method: "POST",
      body: JSON.stringify({
        documento: datos.documento,
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        correo: datos.correo,
        telefono: datos.telefono,
        idCarrera: numero(datos.idCarrera)
      })
    });
  }

  function crearMateria(datos) {
    return peticion("/materias", {
      method: "POST",
      body: JSON.stringify({
        id: numero(datos.id),
        nombre: datos.nombre,
        creditos: numero(datos.creditos),
        idFacultad: numero(datos.idFacultad),
        periodo: datos.periodo,
        cupos: numero(datos.cupos),
        horario: datos.horario
      })
    });
  }

  /* ------------------------------ Matrículas ---------------------------- */
  function listarMateriasParaEstudiante(identificacion, periodo) {
    const parametros = new URLSearchParams({ periodo: periodo || periodoActual() });
    return peticion(
      `/estudiantes/${encodeURIComponent(identificacion)}/materias-disponibles?${parametros.toString()}`
    );
  }

  function listarMatriculas(filtros = {}) {
    const parametros = new URLSearchParams();
    if (filtros.identificacion) {
      parametros.set("identificacion", filtros.identificacion);
    }
    if (filtros.periodo) {
      parametros.set("periodo", filtros.periodo);
    }
    const query = parametros.toString();
    return peticion(`/matriculas${query ? `?${query}` : ""}`);
  }

  function registrarMatricula(datos) {
    return peticion("/matriculas", {
      method: "POST",
      body: JSON.stringify({
        identificacion: datos.identificacion,
        periodo: datos.periodo,
        codigosMaterias: (datos.codigosMaterias || []).map(numero)
      })
    });
  }

  /* -------------------------------- Notas ------------------------------- */
  function registrarNotas(datos) {
    return peticion("/notas", {
      method: "POST",
      body: JSON.stringify({
        idMatricula: numero(datos.idMatricula),
        nota1: numero(datos.nota1),
        nota2: numero(datos.nota2),
        nota3: numero(datos.nota3)
      })
    });
  }

  /* --------------------------- Periodos y recibo ------------------------ */
  function listarPeriodos(identificacion) {
    return peticion(`/estudiantes/${encodeURIComponent(identificacion)}/periodos`);
  }

  async function obtenerRecibo({ identificacion, periodo }) {
    const parametros = new URLSearchParams({ identificacion, periodo });
    try {
      return await peticion(`/recibos?${parametros.toString()}`);
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /* ------------------------------- Estado ------------------------------- */
  async function verificarSalud() {
    return peticion("/salud");
  }

  window.Api = {
    API_BASE_URL,
    obtenerPeriodoActual,
    verificarSalud,
    listarFacultades,
    listarCarreras,
    listarMaterias,
    listarEstudiantes,
    crearFacultad,
    crearCarrera,
    crearEstudiante,
    crearMateria,
    listarMateriasParaEstudiante,
    listarMatriculas,
    registrarMatricula,
    registrarNotas,
    listarPeriodos,
    obtenerRecibo
  };
})();
