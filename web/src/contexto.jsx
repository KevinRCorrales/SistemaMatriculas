import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { periodoLocal } from "./formato";

const ContextoDatos = createContext(null);

export function ProveedorDatos({ children }) {
  const [facultades, setFacultades] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [periodo, setPeriodo] = useState(periodoLocal());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const recargarCatalogos = useCallback(async () => {
    const [nuevasFacultades, nuevasCarreras] = await Promise.all([
      api.listarFacultades(),
      api.listarCarreras()
    ]);
    setFacultades(nuevasFacultades);
    setCarreras(nuevasCarreras);
  }, []);

  const recargarEstudiantes = useCallback(async () => {
    setEstudiantes(await api.listarEstudiantes());
  }, []);

  const iniciar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [salud, nuevasFacultades, nuevasCarreras, nuevosEstudiantes] = await Promise.all([
        api.verificarSalud(),
        api.listarFacultades(),
        api.listarCarreras(),
        api.listarEstudiantes()
      ]);
      setFacultades(nuevasFacultades);
      setCarreras(nuevasCarreras);
      setEstudiantes(nuevosEstudiantes);
      if (salud?.periodo_actual) {
        setPeriodo(salud.periodo_actual);
      }
    } catch (fallo) {
      setError(fallo);
    } finally {
      setCargando(false);
    }
  }, []);

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
