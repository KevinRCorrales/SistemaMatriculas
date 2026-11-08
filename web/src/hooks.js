import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorApi } from "./api";

/** Carga asíncrona con estados de carga/error y recarga manual. */
export function useRecurso(cargar, deps = [], { inmediato = true } = {}) {
  const [estado, setEstado] = useState({ datos: null, cargando: inmediato, error: null });
  const contador = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recargar = useCallback(async () => {
    const token = ++contador.current;
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));
    try {
      const datos = await cargar();
      if (token === contador.current) {
        setEstado({ datos, cargando: false, error: null });
      }
      return datos;
    } catch (error) {
      if (token === contador.current) {
        setEstado({ datos: null, cargando: false, error });
      }
      return null;
    }
  }, deps);

  useEffect(() => {
    if (inmediato) {
      recargar();
    }
  }, [recargar, inmediato]);

  return { ...estado, recargar };
}

/**
 * Estado de formulario con validación, mensaje de éxito y error del servidor.
 * `guardar` recibe los valores y devuelve el mensaje de éxito.
 */
export function useFormulario(inicial, validar, guardar) {
  const [valores, setValores] = useState(inicial);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState("");
  const [error, setError] = useState(null);

  const setCampo = useCallback((campo, valor) => {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    setErrores((previos) => (previos[campo] ? { ...previos, [campo]: undefined } : previos));
  }, []);

  const limpiar = useCallback(() => {
    setValores(inicial);
    setErrores({});
    setExito("");
    setError(null);
  }, [inicial]);

  const enviar = useCallback(
    async (evento) => {
      evento?.preventDefault();
      if (guardando) return false;

      const encontrados = validar(valores) || {};
      setErrores(encontrados);
      setExito("");
      setError(null);
      if (Object.keys(encontrados).length) return false;

      setGuardando(true);
      try {
        const mensaje = await guardar(valores);
        setExito(mensaje || "Guardado correctamente.");
        setValores(inicial);
        return true;
      } catch (fallo) {
        if (fallo?.campo && Object.prototype.hasOwnProperty.call(inicial, fallo.campo)) {
          setErrores({ [fallo.campo]: fallo.message });
        }
        setError(fallo instanceof ErrorApi ? fallo : new Error(fallo?.message || "No se pudo guardar."));
        return false;
      } finally {
        setGuardando(false);
      }
    },
    [guardando, guardar, inicial, validar, valores]
  );

  return { valores, errores, setCampo, setValores, enviar, limpiar, guardando, exito, error };
}
