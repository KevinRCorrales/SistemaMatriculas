const TRAZOS = {
  panel: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  facultad: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 10h.01M15 10h.01" />
    </>
  ),
  carrera: (
    <>
      <path d="M22 9 12 4 2 9l10 5 10-5Z" />
      <path d="M6 11v5c0 1.5 2.69 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 9v6" />
    </>
  ),
  estudiante: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </>
  ),
  materia: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z" />
    </>
  ),
  matricula: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  notas: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  recibo: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </>
  ),
  impresora: (
    <>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </>
  ),
  dinero: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 8.5a2.5 2.5 0 0 0-2.5-2c-1.5 0-2.5.8-2.5 2s1 1.8 2.5 2 2.5.9 2.5 2-1 1.8-2.5 1.8a2.5 2.5 0 0 1-2.5-1.8" />
      <line x1="12" y1="5" x2="12" y2="19" />
    </>
  ),
  cupo: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20v-1.4A4.6 4.6 0 0 1 8 14h2a4.6 4.6 0 0 1 4.5 4.6V20" />
      <path d="M18 8v6M21 11h-6" />
    </>
  ),
  aprobacion: (
    <>
      <path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
  promedio: (
    <>
      <line x1="4" y1="20" x2="20" y2="20" />
      <path d="M5 16.5 9.5 12l3 3L20 7.5" />
      <polyline points="15.5 7.5 20 7.5 20 12" />
    </>
  ),
  menu: (
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </>
  ),
  cerrar: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  flecha: (
    <>
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </>
  ),
  cheque: <polyline points="4 12.5 9 17.5 20 6.5" />,
  alerta: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7.5" x2="12" y2="13" />
      <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <line x1="12" y1="7.5" x2="12.01" y2="7.5" />
    </>
  ),
  refrescar: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <polyline points="21 3 21 8 16 8" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7.5 12 12.5 15.5 14.5" />
    </>
  ),
  candado: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <line x1="12" y1="14.5" x2="12" y2="17" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  salir: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  )
};

export function Icono({ nombre, className = "" }) {
  return (
    <svg
      className={`icono ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre] || TRAZOS.info}
    </svg>
  );
}

export function Boton({ variante = "primario", cargando = false, className = "", children, ...props }) {
  return (
    <button
      {...props}
      className={`boton boton--${variante} ${className}`.trim()}
      disabled={cargando || props.disabled}
    >
      {cargando && <span className="girador" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Campo({ etiqueta, htmlFor, ayuda, error, requerido = false, className = "", children }) {
  return (
    <div className={`campo ${error ? "campo--error" : ""} ${className}`.trim()}>
      {etiqueta && (
        <label className="campo__etiqueta" htmlFor={htmlFor}>
          {etiqueta}
          {requerido && (
            <span className="campo__obligatorio" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {ayuda && <p className="campo__ayuda">{ayuda}</p>}
      {error && (
        <p className="campo__mensaje" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Entrada({ etiqueta, ayuda, error, requerido, id, className = "", ...props }) {
  return (
    <Campo etiqueta={etiqueta} htmlFor={id} ayuda={ayuda} error={error} requerido={requerido}>
      <input
        id={id}
        className={`campo__control ${className}`.trim()}
        aria-invalid={Boolean(error)}
        {...props}
      />
    </Campo>
  );
}

export function Seleccion({ etiqueta, ayuda, error, requerido, id, children, className = "", ...props }) {
  return (
    <Campo etiqueta={etiqueta} htmlFor={id} ayuda={ayuda} error={error} requerido={requerido}>
      <select
        id={id}
        className={`campo__control campo__control--select ${className}`.trim()}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </select>
    </Campo>
  );
}

export function Alerta({ tipo = "error", titulo, children, onCerrar, className = "" }) {
  return (
    <div className={`alerta alerta--${tipo} ${className}`.trim()} role={tipo === "error" ? "alert" : "status"}>
      <Icono nombre={tipo === "exito" ? "cheque" : tipo === "info" ? "info" : "alerta"} />
      <div className="alerta__cuerpo">
        {titulo && <strong>{titulo}</strong>}
        {children && <p>{children}</p>}
      </div>
      {onCerrar && (
        <button type="button" className="alerta__cerrar" onClick={onCerrar} aria-label="Cerrar aviso">
          <Icono nombre="cerrar" />
        </button>
      )}
    </div>
  );
}

export function Tarjeta({ titulo, descripcion, acciones, children, className = "", ...props }) {
  return (
    <section className={`tarjeta ${className}`.trim()} {...props}>
      {(titulo || acciones) && (
        <header className="tarjeta__cabecera">
          <div>
            {titulo && <h3>{titulo}</h3>}
            {descripcion && <p>{descripcion}</p>}
          </div>
          {acciones && <div className="tarjeta__acciones">{acciones}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Etiqueta({ tono = "neutra", children }) {
  return <span className={`etiqueta etiqueta--${tono}`}>{children}</span>;
}

export function Vacio({ titulo, children, accion }) {
  return (
    <div className="vacio">
      <p className="vacio__titulo">{titulo}</p>
      {children && <div className="vacio__texto">{children}</div>}
      {accion}
    </div>
  );
}

export function Cargando({ texto = "Cargando información…" }) {
  return (
    <div className="cargando" role="status">
      <span className="girador" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function Kpi({ titulo, valor, detalle, icono, tono = "azul", retraso = 0, children }) {
  return (
    <article className={`kpi kpi--${tono} animar-arriba`} style={{ animationDelay: `${retraso}ms` }}>
      <header className="kpi__cabecera">
        <span className="kpi__icono">
          <Icono nombre={icono} />
        </span>
        <h3>{titulo}</h3>
      </header>
      <p className="kpi__valor">{valor}</p>
      {detalle && <p className="kpi__detalle">{detalle}</p>}
      {children}
    </article>
  );
}

export function Barra({ valor, tono = "azul", etiqueta }) {
  const ancho = Math.min(Math.max(Number(valor) || 0, 0), 100);
  return (
    <div
      className={`barra barra--${tono}`}
      role="progressbar"
      aria-valuenow={ancho}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta}
    >
      <span className="barra__relleno" style={{ width: `${ancho}%` }} />
    </div>
  );
}

export function Medidor({ valor, titulo, detalle, tono = "azul" }) {
  const ancho = Math.min(Math.max(Number(valor) || 0, 0), 100);
  return (
    <div className={`medidor medidor--${tono}`}>
      <div
        className="medidor__aro"
        style={{ "--valor": `${ancho * 3.6}deg` }}
        role="img"
        aria-label={`${titulo}: ${ancho} %`}
      >
        <div className="medidor__centro">
          <strong>{ancho.toFixed(1)} %</strong>
          <span>{titulo}</span>
        </div>
      </div>
      {detalle && <p className="medidor__detalle">{detalle}</p>}
    </div>
  );
}

export function Tabla({ columnas, filas, vacio = "Sin registros todavía." }) {
  if (!filas.length) {
    return <Vacio titulo={vacio} />;
  }
  return (
    <div className="tabla-contenedor">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna.clave} scope="col">
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indice) => (
            <tr key={fila.id ?? fila.clave ?? indice} className="animar-arriba">
              {columnas.map((columna) => (
                <td key={columna.clave} data-etiqueta={columna.titulo}>
                  {columna.render ? columna.render(fila) : fila[columna.clave]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
