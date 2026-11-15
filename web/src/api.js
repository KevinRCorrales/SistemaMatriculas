/* Cliente de la API. En desarrollo Vite hace proxy de /api al backend. */
const BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

let tokenActual = null;

export function establecerToken(token) {
  tokenActual = token || null;
}

export function obtenerToken() {
  return tokenActual;
}

export class ErrorApi extends Error {
  constructor(mensaje, campo, estado) {
    super(mensaje);
    this.name = "ErrorApi";
    this.campo = campo;
    this.estado = estado;
  }
}

const numero = (valor) => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : NaN;
};

async function peticion(ruta, opciones = {}) {
  const cabeceras = { "Content-Type": "application/json", ...(opciones.headers || {}) };
  if (tokenActual) {
    cabeceras.Authorization = `Bearer ${tokenActual}`;
  }

  let respuesta;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      headers: cabeceras,
      ...opciones
    });
  } catch {
    throw new ErrorApi(
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
    } catch {
      cuerpo = null;
    }
  }

  if (respuesta.status === 401 && !ruta.startsWith("/auth")) {
    window.dispatchEvent(new CustomEvent("portal:sesion-expirada"));
  }

  if (!respuesta.ok) {
    throw new ErrorApi(
      (cuerpo && cuerpo.mensaje) ||
        `El servidor respondió con un error (${respuesta.status}). Inténtalo de nuevo.`,
      cuerpo && cuerpo.campo,
      respuesta.status
    );
  }

  return cuerpo;
}

export const api = {
  verificarSalud: () => peticion("/salud"),

  accederEstudiante: (datos) =>
    peticion("/auth/estudiante", {
      method: "POST",
      body: JSON.stringify({ correo: datos.correo, identificacion: datos.identificacion })
    }),

  accederAdministrativo: (datos) =>
    peticion("/auth/administrativo", {
      method: "POST",
      body: JSON.stringify({ clave: datos.clave })
    }),

  obtenerSesion: () => peticion("/auth/sesion"),

  cerrarSesion: () => peticion("/auth/salir", { method: "POST" }),
  obtenerDashboard: (periodo) =>
    peticion(`/dashboard${periodo ? `?periodo=${encodeURIComponent(periodo)}` : ""}`),

  listarFacultades: () => peticion("/facultades"),
  listarCarreras: () => peticion("/carreras"),
  listarEstudiantes: () => peticion("/estudiantes"),
  listarMaterias: () => peticion("/materias"),

  crearFacultad: (datos) =>
    peticion("/facultades", { method: "POST", body: JSON.stringify({ nombre: datos.nombre }) }),

  crearCarrera: (datos) =>
    peticion("/carreras", {
      method: "POST",
      body: JSON.stringify({ nombre: datos.nombre, idFacultad: numero(datos.idFacultad) })
    }),

  crearEstudiante: (datos) =>
    peticion("/estudiantes", {
      method: "POST",
      body: JSON.stringify({
        documento: datos.documento,
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        correo: datos.correo,
        telefono: datos.telefono,
        idCarrera: numero(datos.idCarrera)
      })
    }),

  crearMateria: (datos) =>
    peticion("/materias", {
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
    }),

  listarMateriasParaEstudiante: (identificacion, periodo) =>
    peticion(
      `/estudiantes/${encodeURIComponent(identificacion)}/materias-disponibles?periodo=${encodeURIComponent(periodo)}`
    ),

  listarMatriculas: ({ identificacion, periodo } = {}) => {
    const parametros = new URLSearchParams();
    if (identificacion) parametros.set("identificacion", identificacion);
    if (periodo) parametros.set("periodo", periodo);
    const query = parametros.toString();
    return peticion(`/matriculas${query ? `?${query}` : ""}`);
  },

  registrarMatricula: (datos) =>
    peticion("/matriculas", {
      method: "POST",
      body: JSON.stringify({
        identificacion: datos.identificacion,
        periodo: datos.periodo,
        codigosMaterias: (datos.codigosMaterias || []).map(numero)
      })
    }),

  registrarNotas: (datos) =>
    peticion("/notas", {
      method: "POST",
      body: JSON.stringify({
        idMatricula: numero(datos.idMatricula),
        nota1: numero(datos.nota1),
        nota2: numero(datos.nota2),
        nota3: numero(datos.nota3)
      })
    }),

  listarPeriodos: (identificacion) =>
    peticion(`/estudiantes/${encodeURIComponent(identificacion)}/periodos`),

  obtenerRecibo: async ({ identificacion, periodo }) => {
    try {
      return await peticion(
        `/recibos?identificacion=${encodeURIComponent(identificacion)}&periodo=${encodeURIComponent(periodo)}`
      );
    } catch (error) {
      if (error.estado === 404) {
        return null;
      }
      throw error;
    }
  }
};
