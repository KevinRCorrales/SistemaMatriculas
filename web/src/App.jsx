import { useEffect, useState } from "react";
import Layout, { MODULOS } from "./componentes/Layout";
import { ProveedorDatos } from "./contexto";
import Dashboard from "./vistas/Dashboard";
import Facultades from "./vistas/Facultades";
import Carreras from "./vistas/Carreras";
import Estudiantes from "./vistas/Estudiantes";
import Materias from "./vistas/Materias";
import Matricula from "./vistas/Matricula";
import Notas from "./vistas/Notas";
import Recibos from "./vistas/Recibos";

const VISTAS = {
  inicio: Dashboard,
  facultades: Facultades,
  carreras: Carreras,
  estudiantes: Estudiantes,
  materias: Materias,
  matricula: Matricula,
  notas: Notas,
  recibos: Recibos
};

function rutaActual() {
  const clave = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return VISTAS[clave] ? clave : "inicio";
}

export default function App() {
  const [ruta, setRuta] = useState(rutaActual);

  useEffect(() => {
    const alCambiar = () => {
      setRuta(rutaActual());
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);

  useEffect(() => {
    document.title = `${MODULOS.find((m) => m.clave === ruta)?.etiqueta || "Portal"} · Portal de Gestión Universitaria`;
  }, [ruta]);

  const Vista = VISTAS[ruta] || Dashboard;

  return (
    <ProveedorDatos>
      <Layout ruta={ruta}>
        <Vista key={ruta} />
      </Layout>
    </ProveedorDatos>
  );
}
