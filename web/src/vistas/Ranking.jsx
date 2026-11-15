import { useState } from "react";
import { api } from "../api";
import { useRecurso } from "../hooks";
import { formatoNumero } from "../formato";
import {
  Alerta,
  Boton,
  Cargando,
  Etiqueta,
  Icono,
  Seleccion,
  Tarjeta,
  Tabla,
  Vacio
} from "../componentes/ui";

function carreraDesdeLaUrl() {
  const consulta = window.location.hash.split("?")[1] || "";
  return new URLSearchParams(consulta).get("carrera") || "";
}

export default function Ranking() {
  const { datos, cargando, error, recargar } = useRecurso(api.obtenerRanking, []);
  const [carrera, setCarrera] = useState(carreraDesdeLaUrl);

  if (cargando && !datos) {
    return <Cargando texto="Calculando los puestos por carrera…" />;
  }

  if (error) {
    return (
      <div className="vista">
        <Alerta tipo="error" titulo="No se pudieron cargar los puestos">
          {error.message}
        </Alerta>
        <Boton variante="secundario" onClick={recargar}>
          <Icono nombre="refrescar" /> Reintentar
        </Boton>
      </div>
    );
  }

  const carreras = carrera
    ? datos.carreras.filter((item) => String(item.id) === carrera)
    : datos.carreras;

  return (
    <div className="vista">
      <header className="vista__encabezado animar-arriba">
        <p className="vista__modulo">Panel administrativo</p>
        <h2>Puestos por carrera</h2>
        <p>
          Clasificación completa de los estudiantes con notas en el periodo{" "}
          <strong>{datos.periodo}</strong>, ordenada únicamente por el promedio académico. Los
          empates comparten el mismo puesto. Esta información solo está disponible para
          administrativos.
        </p>
      </header>

      <div className="rejilla rejilla--tres">
        <Tarjeta className="resumen-ranking animar-arriba">
          <span>Periodo</span>
          <strong>{datos.periodo}</strong>
          <small>Clasificación actual</small>
        </Tarjeta>
        <Tarjeta className="resumen-ranking animar-arriba">
          <span>Carreras</span>
          <strong>{formatoNumero(datos.carreras.length)}</strong>
          <small>Con estudiantes clasificados</small>
        </Tarjeta>
        <Tarjeta className="resumen-ranking animar-arriba">
          <span>Estudiantes</span>
          <strong>{formatoNumero(datos.totalEstudiantes)}</strong>
          <small>Con al menos una nota</small>
        </Tarjeta>
      </div>

      <Tarjeta className="animar-arriba">
        <div className="filtro-ranking">
          <Seleccion
            etiqueta="Carrera"
            id="ranking-carrera"
            value={carrera}
            onChange={(evento) => setCarrera(evento.target.value)}
          >
            <option value="">Todas las carreras</option>
            {datos.carreras.map((item) => (
              <option key={item.id} value={item.id}>
                {item.carrera} · {item.facultad}
              </option>
            ))}
          </Seleccion>
          <Etiqueta tono="azul">Solo administrativos</Etiqueta>
        </div>
      </Tarjeta>

      {carreras.length ? (
        carreras.map((item) => (
          <Tarjeta
            key={item.id}
            titulo={item.carrera}
            descripcion={`${item.facultad} · ${formatoNumero(item.total)} estudiantes clasificados en ${datos.periodo}.`}
            acciones={
              <Etiqueta>
                {formatoNumero(item.total)} {item.total === 1 ? "puesto" : "puestos"}
              </Etiqueta>
            }
            className="animar-arriba"
          >
            <Tabla
              columnas={[
                { clave: "posicion", titulo: "Puesto" },
                {
                  clave: "estudiante",
                  titulo: "Estudiante",
                  render: (fila) => (
                    <div>
                      <strong>{fila.nombres} {fila.apellidos}</strong>
                      <span className="texto-tenue"> · {fila.identificacion}</span>
                    </div>
                  )
                },
                {
                  clave: "promedio",
                  titulo: "Promedio",
                  render: (fila) => <strong>{fila.promedio.toFixed(2)}</strong>
                }
              ]}
              filas={item.estudiantes.map((estudiante) => ({
                ...estudiante,
                id: estudiante.identificacion
              }))}
              vacio="Esta carrera no tiene estudiantes con notas en el periodo."
            />
          </Tarjeta>
        ))
      ) : (
        <Tarjeta className="animar-arriba">
          <Vacio titulo="Sin puestos para el periodo actual">
            Aún no hay estudiantes con notas registradas en {datos.periodo}. Cuando se registren,
            aparecerán aquí agrupados por carrera.
          </Vacio>
        </Tarjeta>
      )}
    </div>
  );
}
