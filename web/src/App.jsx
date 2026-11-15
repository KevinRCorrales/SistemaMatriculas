import { useEffect, useState } from "react";
import Layout, { MODULOS } from "./componentes/Layout";
import { ProveedorDatos } from "./contexto";
import { ProveedorSesion, useSesion } from "./sesion";
import Dashboard from "./vistas/Dashboard";
import DashboardEstudiante from "./vistas/DashboardEstudiante";
import Ranking from "./vistas/Ranking";
import Facultades from "./vistas/Facultades";
import Carreras from "./vistas/Carreras";
import Estudiantes from "./vistas/Estudiantes";
import Materias from "./vistas/Materias";
import Matricula from "./vistas/Matricula";
import Notas from "./vistas/Notas";
import Recibos from "./vistas/Recibos";
import Login from "./vistas/Login";

const VISTAS = {
  inicio: Dashboard,
  ranking: Ranking,
  facultades: Facultades,
  carreras: Carreras,
  estudiantes: Estudiantes,
  materias: Materias,
  matricula: Matricula,
  notas: Notas,
  recibos: Recibos
};

function rutaDelHash() {
  return window.location.hash.replace(/^#\/?/, "").split("?")[0];
}

function rutaValida(permitidas, predeterminada) {
  const clave = rutaDelHash();
  return permitidas.includes(clave) ? clave : predeterminada;
}

function Portal() {
  const { sesion, esAdmin, validando } = useSesion();

  if (!sesion) {
    return <Login />;
  }

  if (validando) {
    return (
      <div className="acceso-carga" role="status">
        <span className="girador" aria-hidden="true" />
        <p>Verificando tu sesión…</p>
      </div>
    );
  }

  const modulos = MODULOS.filter((modulo) => esAdmin || !modulo.soloAdmin).map((modulo) => {
    if (modulo.clave === "inicio") {
      return {
        ...modulo,
        etiqueta: esAdmin ? "Panel institucional" : "Mi panel",
        descripcion: esAdmin ? "Indicadores y accesos rápidos" : "Tus indicadores académicos"
      };
    }
    if (modulo.clave === "matricula") {
      return {
        ...modulo,
        etiqueta: esAdmin ? "Matrículas" : "Mi matrícula",
        descripcion: esAdmin ? "Consulta por estudiante" : "Inscripción de materias"
      };
    }
    return modulo;
  });
  const permitidas = modulos.map((modulo) => modulo.clave);
  const predeterminada = permitidas.includes("inicio") ? "inicio" : permitidas[0];

  return (
    <ProveedorDatos sesion={sesion}>
      <PortalAutenticado
        modulos={modulos}
        permitidas={permitidas}
        predeterminada={predeterminada}
      />
    </ProveedorDatos>
  );
}

function PortalAutenticado({ modulos, permitidas, predeterminada }) {
  const { sesion, usuario, esAdmin, cerrar } = useSesion();
  const [ruta, setRuta] = useState(() => rutaValida(permitidas, predeterminada));

  useEffect(() => {
    const alCambiar = () => {
      setRuta(rutaValida(permitidas, predeterminada));
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, [permitidas.join(","), predeterminada]);

  useEffect(() => {
    if (!permitidas.includes(rutaDelHash())) {
      window.history.replaceState(null, "", `#/${predeterminada}`);
      if (ruta !== predeterminada) setRuta(predeterminada);
    }
  }, [ruta, permitidas.join(","), predeterminada]);

  useEffect(() => {
    document.title = `${modulos.find((modulo) => modulo.clave === ruta)?.etiqueta || "Portal"} · Portal de Gestión Universitaria`;
  }, [ruta, modulos]);

  useEffect(() => {
    if (!sesion) return undefined;
    const aviso = (evento) => {
      const mensaje = "Tu sesión sigue abierta. Si cierras el navegador, deberás iniciar sesión de nuevo.";
      evento.preventDefault();
      evento.returnValue = mensaje;
      return mensaje;
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sesion]);

  const Vista =
    !esAdmin && ruta === "inicio"
      ? DashboardEstudiante
      : VISTAS[ruta] || VISTAS[predeterminada];

  return (
    <Layout
      ruta={ruta}
      modulos={modulos}
      usuario={usuario}
      esAdmin={esAdmin}
      onSalir={cerrar}
    >
      <Vista key={ruta} />
    </Layout>
  );
}

export default function App() {
  return (
    <ProveedorSesion>
      <Portal />
    </ProveedorSesion>
  );
}
