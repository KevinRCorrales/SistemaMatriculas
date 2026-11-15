import { useState } from "react";
import { api } from "../api";
import { useSesion } from "../sesion";
import { Alerta, Boton, Entrada, Etiqueta, Icono } from "../componentes/ui";

const ROLES = [
  {
    clave: "estudiante",
    etiqueta: "Estudiante",
    descripcion: "Correo y documento",
    icono: "estudiante"
  },
  {
    clave: "administrativo",
    etiqueta: "Administrativo",
    descripcion: "Contraseña institucional",
    icono: "candado"
  }
];

const BENEFICIOS = {
  estudiante: [
    "Realiza y consulta tus matrículas por periodo.",
    "Revisa las notas cargadas en tus materias.",
    "Genera y descarga tus recibos de matrícula."
  ],
  administrativo: [
    "Gestiona facultades, carreras, estudiantes y materias.",
    "Registra notas y consulta matrículas y recibos.",
    "Analiza los indicadores institucionales por periodo."
  ]
};

export default function Login() {
  const { iniciar } = useSesion();
  const [rol, setRol] = useState("estudiante");
  const [correo, setCorreo] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [clave, setClave] = useState("");
  const [mostrarClave, setMostrarClave] = useState(false);
  const [error, setError] = useState(null);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  function cambiarRol(nuevo) {
    setRol(nuevo);
    setError(null);
    setErrores({});
    setClave("");
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando) return;

    const encontrados = {};
    if (rol === "estudiante") {
      if (!correo.trim()) encontrados.correo = "Escribe tu correo institucional.";
      if (!identificacion.trim()) encontrados.identificacion = "Escribe tu documento de identidad.";
    } else if (!clave.trim()) {
      encontrados.clave = "Escribe la contraseña administrativa.";
    }

    setErrores(encontrados);
    setError(null);
    if (Object.keys(encontrados).length) return;

    setEnviando(true);
    try {
      const respuesta =
        rol === "estudiante"
          ? await api.accederEstudiante({ correo, identificacion })
          : await api.accederAdministrativo({ clave });
      iniciar(respuesta);
    } catch (fallo) {
      setError(fallo);
      if (fallo?.campo && fallo.campo !== "acceso" && fallo.campo !== "clave") {
        setErrores({ [fallo.campo]: fallo.message });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="acceso">
      <section className="acceso__presentacion">
        <div className="acceso__marca">
          <img src="/assets/image.png" alt="Universidad Cooperativa de Colombia" width="64" height="64" />
          <div>
            <p className="marca__universidad">Universidad Cooperativa de Colombia</p>
            <p className="acceso__marca-texto">Portal de Gestión Universitaria</p>
          </div>
        </div>

        <div className="acceso__mensaje">
          <Etiqueta tono="claro">Acceso institucional</Etiqueta>
          <h1>Bienvenido de nuevo</h1>
          <p>
            Un solo lugar para tu matrícula, tus notas y tus recibos. Los administrativos
            encuentran aquí la gestión académica completa de la universidad.
          </p>
        </div>

        <ul className="acceso__lista">
          {BENEFICIOS[rol].map((beneficio) => (
            <li key={beneficio}>
              <Icono nombre="cheque" />
              <span>{beneficio}</span>
            </li>
          ))}
        </ul>

        <p className="acceso__pie">
          <Icono nombre="escudo" />
          Conexión cifrada y acceso restringido a la comunidad universitaria.
        </p>
      </section>

      <main className="acceso__panel">
        <div className="acceso__tarjeta">
          <div className="acceso__cabecera">
            <p className="vista__modulo">Iniciar sesión</p>
            <h2>¿Cómo deseas entrar?</h2>
            <p>Selecciona tu tipo de usuario para continuar.</p>
          </div>

          <div className="acceso__roles" role="tablist" aria-label="Tipo de usuario">
            {ROLES.map((opcion) => (
              <button
                key={opcion.clave}
                type="button"
                role="tab"
                aria-selected={rol === opcion.clave}
                className={`acceso__rol ${rol === opcion.clave ? "acceso__rol--activo" : ""}`}
                onClick={() => cambiarRol(opcion.clave)}
              >
                <Icono nombre={opcion.icono} />
                <span>
                  <strong>{opcion.etiqueta}</strong>
                  <small>{opcion.descripcion}</small>
                </span>
              </button>
            ))}
          </div>

          <form className="acceso__formulario" onSubmit={enviar} noValidate>
            {rol === "estudiante" ? (
              <>
                <Entrada
                  etiqueta="Correo institucional"
                  id="acceso-correo"
                  type="email"
                  autoComplete="username"
                  placeholder="nombre@universidad.edu.co"
                  value={correo}
                  error={errores.correo}
                  onChange={(evento) => setCorreo(evento.target.value)}
                  requerido
                />
                <Entrada
                  etiqueta="Documento de identidad"
                  id="acceso-documento"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Solo números"
                  value={identificacion}
                  error={errores.identificacion}
                  onChange={(evento) => setIdentificacion(evento.target.value)}
                  requerido
                />
                <p className="acceso__ayuda">
                  Usa el correo y el documento con los que la universidad registró tu matrícula.
                </p>
              </>
            ) : (
              <>
                <Entrada
                  etiqueta="Contraseña administrativa"
                  id="acceso-clave"
                  type={mostrarClave ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Contraseña compartida por la universidad"
                  value={clave}
                  error={errores.clave}
                  onChange={(evento) => setClave(evento.target.value)}
                  requerido
                />
                <label className="acceso__verclave">
                  <input
                    type="checkbox"
                    checked={mostrarClave}
                    onChange={(evento) => setMostrarClave(evento.target.checked)}
                  />
                  Mostrar contraseña
                </label>
                <p className="acceso__ayuda">
                  La contraseña la administra la universidad y no se muestra en el portal.
                </p>
              </>
            )}

            {error && (
              <Alerta tipo="error">
                {error.message}
                {error.estado === 429 ? " Espera un minuto antes de reintentar." : ""}
              </Alerta>
            )}

            <Boton type="submit" cargando={enviando} className="acceso__enviar">
              {enviando ? "Verificando…" : `Entrar como ${rol}`}
              {!enviando && <Icono nombre="flecha" />}
            </Boton>
          </form>

          <p className="acceso__nota">
            <Icono nombre="info" />
            El registro de estudiantes lo realiza únicamente la Secretaría Académica. Si aún no
            tienes acceso, comunícate con la universidad.
          </p>
        </div>
      </main>
    </div>
  );
}
