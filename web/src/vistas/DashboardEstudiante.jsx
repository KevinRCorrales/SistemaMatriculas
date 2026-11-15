import { api } from "../api";
import { useRecurso } from "../hooks";
import { formatoNumero } from "../formato";
import {
  Alerta,
  Boton,
  Cargando,
  Etiqueta,
  Icono,
  Kpi,
  Tarjeta,
  Tabla,
  Vacio
} from "../componentes/ui";

function NotaExtrema({ tipo, nota }) {
  if (!nota) {
    return (
      <div className="nota-extrema nota-extrema--vacia">
        <span className="nota-extrema__etiqueta">{tipo === "alta" ? "Más alta" : "Más baja"}</span>
        <strong>—</strong>
        <span>Sin notas registradas</span>
      </div>
    );
  }

  return (
    <div className={`nota-extrema nota-extrema--${tipo}`}>
      <span className="nota-extrema__etiqueta">{tipo === "alta" ? "Más alta" : "Más baja"}</span>
      <strong>{nota.valor.toFixed(2)}</strong>
      <span>{nota.nombreMateria}</span>
      <small>
        {nota.evaluacion} · {nota.creditos} crédito(s)
      </small>
    </div>
  );
}

export default function DashboardEstudiante() {
  const { datos, cargando, error, recargar } = useRecurso(api.obtenerPanelEstudiante, []);

  const hoy = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  if (cargando && !datos) {
    return <Cargando texto="Calculando tus indicadores académicos…" />;
  }

  if (error) {
    return (
      <div className="vista">
        <Alerta tipo="error" titulo="No se pudieron cargar tus indicadores">
          {error.message}
        </Alerta>
        <Boton variante="secundario" onClick={recargar}>
          <Icono nombre="refrescar" /> Reintentar
        </Boton>
      </div>
    );
  }

  const { estudiante, periodo, kpis, mejorNota, peorNota, puesto, materias } = datos;
  const sinNotas = kpis.materiasConNota === 0;

  return (
    <div className="vista vista--panel">
      <header className="portada animar-arriba">
        <div>
          <p className="portada__saludo">Hola, {estudiante.nombres}</p>
          <h2>Mi panel académico</h2>
          <p className="portada__texto">
            Tus indicadores del periodo <strong>{periodo}</strong> en{" "}
            {estudiante.carrera}. Esta información es privada y solo tú puedes consultarla.
            <span className="portada__fecha">{hoy}</span>
          </p>
        </div>
        <div className="portada__acciones">
          <a className="boton boton--primario" href="#/notas">
            Ver mis notas <Icono nombre="flecha" />
          </a>
          <a className="boton boton--secundario" href="#/matricula">
            <Icono nombre="matricula" /> Mi matrícula
          </a>
        </div>
      </header>

      <div className="rejilla rejilla--kpis">
        <Kpi
          titulo="Promedio del periodo"
          valor={kpis.promedio === null ? "—" : kpis.promedio.toFixed(2)}
          detalle={
            sinNotas
              ? "Aún no tienes notas registradas"
              : `Promedio de tus materias con nota · ${formatoNumero(kpis.materiasConNota)} ${
                  kpis.materiasConNota === 1 ? "registrada" : "registradas"
                }`
          }
          icono="promedio"
          retraso={0}
        />
        <Kpi
          titulo="Créditos matriculados"
          valor={formatoNumero(kpis.creditos)}
          detalle={`${formatoNumero(kpis.materias)} ${
            kpis.materias === 1 ? "materia" : "materias"
          } en ${periodo}`}
          icono="matricula"
          tono="verde"
          retraso={70}
        />
        <Kpi
          titulo="Materias aprobadas"
          valor={`${formatoNumero(kpis.aprobadas)} / ${formatoNumero(kpis.materiasConNota)}`}
          detalle={`Aprueba con ${kpis.notaAprobacion.toFixed(1)} o más`}
          icono="aprobacion"
          tono="ambar"
          retraso={140}
        />
        <Kpi
          titulo="Tu puesto en la carrera"
          valor={puesto ? `#${puesto.posicion}` : "—"}
          detalle={
            puesto
              ? `De ${formatoNumero(puesto.total)} ${
                  puesto.total === 1 ? "estudiante" : "estudiantes"
                } con notas en ${puesto.carrera}`
              : "Se calcula cuando tengas notas registradas"
          }
          icono="panel"
          tono="violeta"
          retraso={210}
        />
      </div>

      <div className="rejilla rejilla--analitica">
        <Tarjeta
          titulo="Tu puesto académico"
          descripcion={`Clasificación de ${periodo} en ${estudiante.carrera}.`}
          className="animar-arriba"
          acciones={<Etiqueta tono="azul">Privado</Etiqueta>}
        >
          {puesto ? (
            <div className="puesto-propio">
              <div className="puesto-propio__numero">
                <span>Puesto</span>
                <strong>#{puesto.posicion}</strong>
                <small>de {formatoNumero(puesto.total)}</small>
              </div>
              <div className="puesto-propio__detalle">
                <p>
                  <strong>{estudiante.nombres} {estudiante.apellidos}</strong>
                  <span>{estudiante.carrera} · {estudiante.facultad}</span>
                </p>
                <dl className="datos-lista">
                  <div>
                    <dt>Promedio del periodo</dt>
                    <dd>{puesto.promedio.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Periodo</dt>
                    <dd>{periodo}</dd>
                  </div>
                </dl>
                <Alerta tipo="info">
                  Solo tú puedes ver este puesto. La plataforma no te muestra la información ni
                  los puestos de los demás estudiantes.
                </Alerta>
              </div>
            </div>
          ) : (
            <Vacio titulo="Aún no hay un puesto para calcular">
              Cuando la administración registre las notas de tus materias del periodo, aquí verás
              tu posición dentro de tu carrera. Nadie más puede consultar tu puesto.
            </Vacio>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Tus notas extremas"
          descripcion="La calificación más alta y la más baja de tus matrículas del periodo."
          className="animar-arriba"
        >
          <div className="notas-extremas">
            <NotaExtrema tipo="alta" nota={mejorNota} />
            <NotaExtrema tipo="baja" nota={peorNota} />
          </div>
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Mis materias del periodo"
        descripcion={`Calificaciones registradas en ${periodo}.`}
        acciones={
          <Etiqueta>
            {formatoNumero(materias.length)} {materias.length === 1 ? "materia" : "materias"}
          </Etiqueta>
        }
        className="animar-arriba"
      >
        <Tabla
          columnas={[
            {
              clave: "nombreMateria",
              titulo: "Materia",
              render: (fila) => (
                <div>
                  <strong>{fila.nombreMateria}</strong>
                  <span className="texto-tenue"> · {fila.creditos} créditos</span>
                </div>
              )
            },
            {
              clave: "nota",
              titulo: "Notas",
              render: (fila) =>
                fila.nota ? (
                  <span>
                    {fila.nota.nota1.toFixed(2)} · {fila.nota.nota2.toFixed(2)} ·{" "}
                    {fila.nota.nota3.toFixed(2)}
                  </span>
                ) : (
                  <Etiqueta tono="ambar">Pendiente</Etiqueta>
                )
            },
            {
              clave: "promedio",
              titulo: "Promedio",
              render: (fila) =>
                fila.nota ? (
                  <Etiqueta tono={fila.nota.promedio >= kpis.notaAprobacion ? "verde" : "rojo"}>
                    {fila.nota.promedio.toFixed(2)}
                  </Etiqueta>
                ) : (
                  "—"
                )
            }
          ]}
          filas={materias.map((materia) => ({
            ...materia,
            id: materia.idMatricula
          }))}
          vacio="Aún no tienes materias matriculadas en este periodo."
        />
      </Tarjeta>
    </div>
  );
}
