import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, establecerToken } from "./api";

const CLAVE_ALMACENAMIENTO = "portal.sesion";
const ContextoSesion = createContext(null);

function leerSesionGuardada() {
  try {
    const guardada = JSON.parse(window.localStorage.getItem(CLAVE_ALMACENAMIENTO) || "null");
    if (!guardada?.token || !guardada?.usuario?.rol) return null;
    if (guardada.expiraEn && guardada.expiraEn * 1000 <= Date.now()) return null;
    return guardada;
  } catch {
    return null;
  }
}

function olvidarSesionLocal() {
  establecerToken(null);
  window.localStorage.removeItem(CLAVE_ALMACENAMIENTO);
}

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(() => {
    const guardada = leerSesionGuardada();
    establecerToken(guardada?.token || null);
    return guardada;
  });
  const [validando, setValidando] = useState(Boolean(sesion));

  const iniciar = useCallback((respuesta) => {
    const nueva = {
      token: respuesta.token,
      expiraEn: respuesta.expiraEn,
      usuario: respuesta.usuario
    };
    establecerToken(nueva.token);
    window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(nueva));
    setSesion(nueva);
  }, []);

  const cerrar = useCallback(async () => {
    try {
      if (sesion) await api.cerrarSesion();
    } catch {
      // Aunque falle la red, la sesión local se descarta igualmente.
    }
    olvidarSesionLocal();
    setSesion(null);
  }, [sesion]);

  useEffect(() => {
    const alExpirar = () => {
      olvidarSesionLocal();
      setSesion(null);
    };
    window.addEventListener("portal:sesion-expirada", alExpirar);
    return () => window.removeEventListener("portal:sesion-expirada", alExpirar);
  }, []);

  useEffect(() => {
    const token = sesion?.token;
    if (!token) {
      setValidando(false);
      return undefined;
    }

    let vigente = true;
    setValidando(true);
    api
      .obtenerSesion()
      .then((usuario) => {
        if (!vigente) return;
        setSesion((actual) => {
          if (!actual) return actual;
          const renovada = { ...actual, usuario };
          window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(renovada));
          return renovada;
        });
      })
      .catch(() => {
        // Si el token dejó de ser válido, el cliente API emite sesion-expirada.
        // Un fallo de red no debe expulsar al usuario.
      })
      .finally(() => {
        if (vigente) setValidando(false);
      });

    return () => {
      vigente = false;
    };
  }, [sesion?.token]);

  const valor = {
    sesion,
    usuario: sesion?.usuario || null,
    rol: sesion?.usuario?.rol || null,
    esAdmin: sesion?.usuario?.rol === "administrativo",
    validando,
    iniciar,
    cerrar
  };

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  const contexto = useContext(ContextoSesion);
  if (!contexto) {
    throw new Error("useSesion debe usarse dentro de ProveedorSesion");
  }
  return contexto;
}
