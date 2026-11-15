import { api } from "../api";
import { useRecurso } from "../hooks";
import { formatoCOP, formatoNumero, porcentaje } from "../formato";
import {
  Alerta,
  Barra,
  Boton,
  Cargando,
  Etiqueta,
  Icono,
  Kpi,
  Medidor,
  Tarjeta,
  Vacio
} from "../componentes/ui";

const ACCESOS = [
  {
    ruta: "#/matricula",
    icono: "matricula",
    titulo: "Consultar matrículas",
    texto: "Revisa las materias inscritas por cada estudiante en el periodo y el estado de sus notas."
  },
  {
    ruta: "#/notas",
    icono: "notas",
    titulo: "Registrar notas",
    texto: "Carga las tres notas y consulta el promedio y la aprobación al instante."
  },
  {
    ruta: "#/materias",
    icono: "materia",
    titulo: "Oferta académica",
    texto: "Crea materias para el periodo y revisa la ocupación de sus cupos."
  }
];

export default function Dashboard() {
  const { datos, cargando, error, recargar } = useRecurso(api.obtenerDashboard, []);

  const hoy = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  if (cargando && !datos) {
    return <Cargando texto="Calculando indicadores institucionales…" />;
  }

  if (error) {
    return (
      <div className="vista">
        <Alerta tipo="error" titulo="No se pudieron cargar los indicadores">
          {error.message}
        </Alerta>
        <Boton variante="secundario" onClick={recargar}>
          <Icono nombre="refrescar" /> Reintentar
        </Boton>
      </div>
    );
  }

  const { kpis, porFacultad, materiasDemandadas, historicos, periodo } = datos;
  const maxFacultad = Math.max(...porFacultad.map((f) => f.matriculas), 1);
  const maxHistorico = Math.max(...historicos.map((h) => h.creditos), 1);
  const sinDatos = kpis.estudiantes === 0 && kpis.matriculasPeriodo === 0;

  return (
    <div className="vista vista--panel">
      <header className="portada animar-arriba">
        <div>
          <p className="portada__saludo">Bienvenido al portal</p>
          <h2>Panel institucional</h2>
          <p className="portada__texto">
            Resumen de la operación académica y financiera del periodo <strong>{periodo}</strong>.
            <span className="portada__fecha">{hoy}</span>
          </p>
        </div>
        <div className="portada__acciones">
          <a className="boton boton--primario" href="#/matricula">
            Consultar matrículas <Icono nombre="flecha" />
          </a>
          <a className="boton boton--secundario" href="#/recibos">
            <Icono nombre="recibo" /> Ver recibos
          </a>
        </div>
      </header>

      {sinDatos ? (
        <Tarjeta titulo="Aún no hay datos para el periodo" className="animar-arriba">
          <Vacio titulo="Comienza registrando la estructura académica">
            Crea facultades, carreras, estudiantes y materias para que los indicadores se calculen
            automáticamente. Los datos se leen en vivo de la base de datos.
            <div className="vacio__acciones">
              <a className="boton boton--primario" href="#/facultades">
                Registrar facultad
              </a>
              <a className="boton boton--secundario" href="#/estudiantes">
                Registrar estudiante
              </a>
            </div>
          </Vacio>
        </Tarjeta>
      ) : (
        <>
          <div className="rejilla rejilla--kpis">
            <Kpi
              titulo="Recaudación estimada"
              valor={formatoCOP(kpis.recaudacionPeriodo)}
              detalle={`${formatoNumero(kpis.creditosPeriodo)} créditos matriculados · histórico ${formatoCOP(kpis.recaudacionTotal)}`}
              icono="dinero"
              retraso={0}
            />
            <Kpi
              titulo="Ocupación de cupos"
              valor={porcentaje(kpis.ocupacionCupos)}
              detalle={`${formatoNumero(kpis.matriculasPeriodo)} matrículas · ${formatoNumero(kpis.cuposDisponibles)} cupos libres`}
              icono="cupo"
              tono="verde"
              retraso={70}
            >
              <Barra valor={kpis.ocupacionCupos} tono="verde" etiqueta="Ocupación de cupos" />
            </Kpi>
            <Kpi
              titulo="Aprobación institucional"
              valor={porcentaje(kpis.aprobacion)}
              detalle={`${formatoNumero(kpis.notasRegistradas)} notas registradas · promedio ${kpis.promedioGeneral.toFixed(2)}`}
              icono="aprobacion"
              tono="ambar"
              retraso={140}
            >
              <Barra valor={kpis.aprobacion} tono="ambar" etiqueta="Aprobación institucional" />
            </Kpi>
            <Kpi
              titulo="Comunidad académica"
              valor={formatoNumero(kpis.estudiantes)}
              detalle={`${formatoNumero(kpis.estudiantesMatriculados)} con matrícula en ${periodo} · ${formatoNumero(kpis.materias)} materias`}
              icono="estudiante"
              tono="violeta"
              retraso={210}
            />
          </div>

          <div className="rejilla rejilla--analitica">
            <Tarjeta
              titulo="Matrículas por facultad"
              descripcion={`Distribución de la demanda y del ingreso estimado en ${periodo}.`}
              className="animar-arriba"
              acciones={<Etiqueta>{porFacultad.length} facultades</Etiqueta>}
            >
              {porFacultad.length ? (
                <ul className="lista-barras">
                  {porFacultad.map((facultad, indice) => (
                    <li key={facultad.facultad} className="animar-arriba" style={{ animationDelay: `${indice * 55}ms` }}>
                      <div className="lista-barras__fila">
                        <span>{facultad.facultad}</span>
                        <span>
                          {formatoNumero(facultad.matriculas)} mat. · {formatoCOP(facultad.recaudacion)}
                        </span>
                      </div>
                      <Barra
                        valor={(facultad.matriculas / maxFacultad) * 100}
                        etiqueta={`Matrículas de ${facultad.facultad}`}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <Vacio titulo="Sin matrículas en el periodo" />
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Ocupación general"
              descripcion="Relación entre matrículas y cupos ofertados."
              className="animar-arriba"
            >
              <Medidor
                valor={kpis.ocupacionCupos}
                titulo="cupos ocupados"
                detalle={`${formatoNumero(kpis.matriculasPeriodo)} de ${formatoNumero(kpis.matriculasPeriodo + kpis.cuposDisponibles)} cupos`}
              />
              <dl className="datos-lista">
                <div>
                  <dt>Estudiantes matriculados</dt>
                  <dd>{formatoNumero(kpis.estudiantesMatriculados)}</dd>
                </div>
                <div>
                  <dt>Créditos del periodo</dt>
                  <dd>{formatoNumero(kpis.creditosPeriodo)}</dd>
                </div>
                <div>
                  <dt>Facultades / carreras</dt>
                  <dd>
                    {formatoNumero(kpis.facultades)} / {formatoNumero(kpis.carreras)}
                  </dd>
                </div>
              </dl>
            </Tarjeta>
          </div>

          <div className="rejilla rejilla--analitica">
            <Tarjeta
              titulo="Materias más demandadas"
              descripcion={`Ocupación de los cupos en ${periodo}, de mayor a menor demanda.`}
              acciones={<Etiqueta>{periodo}</Etiqueta>}
              className="animar-arriba"
            >
              {materiasDemandadas.length ? (
                <ul className="lista-demanda">
                  {materiasDemandadas.map((materia, indice) => (
                    <li key={materia.materia} className="animar-arriba" style={{ animationDelay: `${indice * 55}ms` }}>
                      <div className="lista-demanda__texto">
                        <strong>{materia.materia}</strong>
                        <span>
                          {formatoNumero(materia.matriculados)} matriculados ·{" "}
                          {formatoNumero(materia.cuposDisponibles)} cupos libres · {materia.creditos} cr.
                        </span>
                      </div>
                      <div className="lista-demanda__medida">
                        <span className="lista-demanda__porcentaje">
                          {porcentaje(materia.ocupacion)}
                        </span>
                        <Barra valor={materia.ocupacion} tono="verde" etiqueta={`Ocupación de ${materia.materia}`} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vacio titulo="Aún no hay matrículas que analizar" />
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Histórico por periodo"
              descripcion="Créditos matriculados en cada periodo registrado."
              className="animar-arriba"
            >
              {historicos.length ? (
                <div className="columnas" role="img" aria-label="Créditos matriculados por periodo">
                  {historicos.map((item, indice) => (
                    <div className="columnas__item animar-arriba" key={item.periodo} style={{ animationDelay: `${indice * 60}ms` }}>
                      <span className="columnas__valor">{formatoNumero(item.creditos)}</span>
                      <div className="columnas__pista">
                        <div
                          className="columnas__barra"
                          style={{ height: `${Math.max((item.creditos / maxHistorico) * 100, 4)}%` }}
                          title={`${item.periodo}: ${item.creditos} créditos`}
                        />
                      </div>
                      <span className="columnas__etiqueta">{item.periodo}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Vacio titulo="Sin historial todavía" />
              )}
            </Tarjeta>
          </div>
        </>
      )}

      <div className="rejilla rejilla--accesos">
        {ACCESOS.map((acceso, indice) => (
          <a
            className="acceso animar-arriba"
            href={acceso.ruta}
            key={acceso.ruta}
            style={{ animationDelay: `${indice * 70}ms` }}
          >
            <span className="acceso__icono">
              <Icono nombre={acceso.icono} />
            </span>
            <span className="acceso__titulo">{acceso.titulo}</span>
            <span className="acceso__texto">{acceso.texto}</span>
            <span className="acceso__flecha">
              Ir al módulo <Icono nombre="flecha" />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
