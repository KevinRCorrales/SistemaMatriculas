import { useEffect, useState } from "react";
import { useDatos } from "../contexto";
import { Icono } from "./ui";

export const MODULOS = [
  { clave: "inicio", etiqueta: "Panel institucional", icono: "panel", descripcion: "Indicadores y accesos rápidos" },
  { clave: "facultades", etiqueta: "Facultades", icono: "facultad", descripcion: "Unidades académicas" },
  { clave: "carreras", etiqueta: "Carreras", icono: "carrera", descripcion: "Programas por facultad" },
  { clave: "estudiantes", etiqueta: "Estudiantes", icono: "estudiante", descripcion: "Registro y consulta" },
  { clave: "materias", etiqueta: "Materias", icono: "materia", descripcion: "Oferta académica" },
  { clave: "matricula", etiqueta: "Matrícula", icono: "matricula", descripcion: "Inscripción de materias" },
  { clave: "notas", etiqueta: "Notas", icono: "notas", descripcion: "Calificaciones" },
  { clave: "recibos", etiqueta: "Recibos", icono: "recibo", descripcion: "Comprobante de matrícula" }
];

export default function Layout({ ruta, children }) {
  const { periodo, error } = useDatos();
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    setMenuAbierto(false);
  }, [ruta]);

  const actual = MODULOS.find((modulo) => modulo.clave === ruta) || MODULOS[0];

  return (
    <div className={`app ${menuAbierto ? "app--menu-abierto" : ""}`}>
      <a className="salto-contenido" href="#contenido">
        Saltar al contenido principal
      </a>

      <header className="cabecera">
        <button
          type="button"
          className="cabecera__menu"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
          aria-expanded={menuAbierto}
          aria-controls="navegacion-general"
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
        >
          <Icono nombre={menuAbierto ? "cerrar" : "menu"} />
        </button>

        <div className="marca">
          <img src="/assets/image.png" alt="Universidad Cooperativa de Colombia" width="48" height="48" />
          <div>
            <p className="marca__universidad">Universidad Cooperativa de Colombia</p>
            <h1 className="marca__portal">Portal de Gestión Universitaria</h1>
          </div>
        </div>

        <div className="cabecera__periodo" aria-label="Periodo académico en curso">
          <Icono nombre="reloj" />
          <div>
            <span>Periodo académico</span>
            <strong>{periodo}</strong>
          </div>
        </div>
      </header>

      <div className="disposicion">
        <nav
          id="navegacion-general"
          className="navegacion"
          aria-label="Módulos del portal"
        >
          <p className="navegacion__titulo">Módulos</p>
          <ul className="navegacion__lista">
            {MODULOS.map((modulo) => (
              <li key={modulo.clave}>
                <a
                  className={`nav-enlace ${modulo.clave === ruta ? "nav-enlace--activo" : ""}`}
                  href={`#/${modulo.clave}`}
                  aria-current={modulo.clave === ruta ? "page" : undefined}
                  title={modulo.descripcion}
                >
                  <Icono nombre={modulo.icono} />
                  <span>{modulo.etiqueta}</span>
                </a>
              </li>
            ))}
          </ul>

          <div className="navegacion__pie">
            <p>Datos en vivo desde MariaDB.</p>
            <span className="navegacion__estado">
              <span className={`punto ${error ? "punto--error" : "punto--ok"}`} aria-hidden="true" />
              {error ? "Sin conexión" : "API conectada"}
            </span>
          </div>
        </nav>

        {menuAbierto && (
          <button
            type="button"
            className="velo"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
          />
        )}

        <main id="contenido" className="contenido" tabIndex={-1}>
          <div className="contenido__migas">
            <span>Portal</span>
            <span aria-hidden="true">/</span>
            <strong>{actual.etiqueta}</strong>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
