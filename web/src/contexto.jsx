import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { periodoLocal } from "./formato";

const ContextoDatos = createContext(null);

export function ProveedorDatos({ children, sesion }) {
  const esAdmin = sesion?.usuario?.rol === "administrativo";
  const [facultades, setFacultades] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [estudiantes, setEstudiantes] = useState(() => {
    const usuario = sesion?.usuario;
    return !esAdmin && usuario?.rol === "estudiante" ? [usuario] : [];
  });
  const [periodo, setPeriodo] = useState(periodoLocal());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const recargarCatalogos = useCallback(async () => {
    if (!esAdmin) return;
    const [nuevasFacultades, nuevasCarreras] = await Promise.all([
      api.listarFacultades(),
      api.listarCarreras()
    ]);
    setFacultades(nuevasFacultades);
    setCarreras(nuevasCarreras);
  }, [esAdmin]);

  const recargarEstudiantes = useCallback(async () => {
    if (!esAdmin) return;
    setEstudiantes(await api.listarEstudiantes());
  }, [esAdmin]);

  const iniciar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const salud = await api.verificarSalud();
      if (salud?.periodo_actual) {
        setPeriodo(salud.periodo_actual);
      }

      if (esAdmin) {
        const [nuevasFacultades, nuevasCarreras, nuevosEstudiantes] = await Promise.all([
          api.listarFacultades(),
          api.listarCarreras(),
          api.listarEstudiantes()
        ]);
        setFacultades(nuevasFacultades);
        setCarreras(nuevasCarreras);
        setEstudiantes(nuevosEstudiantes);
      } else {
        const usuario = sesion?.usuario;
        setEstudiantes(usuario?.rol === "estudiante" ? [usuario] : []);
      }
    } catch (fallo) {
      setError(fallo);
    } finally {
      setCargando(false);
    }
  }, [esAdmin, sesion]);

  useEffect(() => {
    iniciar();
  }, [iniciar]);

  const valor = {
    facultades,
    carreras,
    estudiantes,
    periodo,
    cargando,
    error,
    esAdmin,
    sesion,
    iniciar,
    recargarCatalogos,
    recargarEstudiantes
  };

  return <ContextoDatos.Provider value={valor}>{children}</ContextoDatos.Provider>;
}

export function useDatos() {
  const contexto = useContext(ContextoDatos);
  if (!contexto) {
    throw new Error("useDatos debe usarse dentro de ProveedorDatos");
  }
  return contexto;
}
