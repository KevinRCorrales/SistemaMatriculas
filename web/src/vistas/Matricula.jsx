import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useDatos } from "../contexto";
import { formatoNumero, iniciales, nombreCompleto } from "../formato";
import { MAX_CREDITOS, conflictoHorario, validarMatricula } from "../validaciones";
import {
  Alerta,
  Barra,
  Boton,
  Cargando,
  Etiqueta,
  Icono,
  Seleccion,
  Tarjeta,
  Vacio
} from "../componentes/ui";

export default function Matricula() {
  const { estudiantes, carreras, facultades, periodo } = useDatos();

  const [identificacion, setIdentificacion] = useState("");
  const [disponibles, setDisponibles] = useState([]);
  const [matriculadas, setMatriculadas] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState("");
  const [error, setError] = useState(null);
  const [errores, setErrores] = useState({});

  const estudiante = estudiantes.find(
    (item) => String(item.identificacion) === String(identificacion)
  );
  const carrera = carreras.find((item) => Number(item.id) === Number(estudiante?.idCarrera));
  const facultad = facultades.find((item) => Number(item.id) === Number(carrera?.idFacultad));

  useEffect(() => {
    setSeleccion([]);
    setExito("");
    setError(null);
    setErrores({});

    if (!identificacion) {
      setDisponibles([]);
      setMatriculadas([]);
      setErrorCarga(null);
      return undefined;
    }

    let vigente = true;
    setCargando(true);
    setErrorCarga(null);

    Promise.all([
      api.listarMateriasParaEstudiante(identificacion, periodo),
      api.listarMatriculas({ identificacion, periodo })
    ])
      .then(([ofertadas, inscritas]) => {
        if (!vigente) return;
        setDisponibles(ofertadas);
        setMatriculadas(inscritas);
      })
      .catch((fallo) => {
        if (vigente) setErrorCarga(fallo);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [identificacion, periodo]);

  const idsMatriculadas = useMemo(
    () => new Set(matriculadas.map((matricula) => Number(matricula.codMateria))),
    [matriculadas]
  );
  const seleccionables = disponibles.filter((materia) => !idsMatriculadas.has(Number(materia.id)));

  const seleccionadas = seleccionables.filter((materia) => seleccion.includes(Number(materia.id)));
  const creditosPrevios = matriculadas.reduce((total, matricula) => total + Number(matricula.creditos || 0), 0);
  const creditosSeleccionados = seleccionadas.reduce((total, materia) => total + Number(materia.creditos || 0), 0);
  const creditosPeriodo = creditosPrevios + creditosSeleccionados;
  const restantes = Math.max(MAX_CREDITOS - creditosPrevios, 0);
  const excede = creditosPeriodo > MAX_CREDITOS;

  const grupos = [
    {
      clave: "facultad",
      titulo: `Materias de ${facultad?.nombre || "la facultad"}`,
      descripcion: `Oferta del periodo ${periodo} para la carrera del estudiante.`,
      materias: seleccionables.filter(
        (materia) => Number(materia.idFacultad) === Number(carrera?.idFacultad)
      )
    },
    {
      clave: "servicio",
      titulo: "Materias de servicio general",
      descripcion: "Humanidades e Inglés, abiertas a todas las carreras.",
      materias: seleccionables.filter(
        (materia) =>
          materia.esServicioGeneral &&
          Number(materia.idFacultad) !== Number(carrera?.idFacultad)
      )
    }
  ].filter((grupo) => grupo.materias.length);

  const alternar = (id) => {
    const codigo = Number(id);
    setSeleccion((previos) =>
      previos.includes(codigo) ? previos.filter((item) => item !== codigo) : [...previos, codigo]
    );
    setErrores({});
    setExito("");
    setError(null);
  };

  async function enviar(evento) {
    evento.preventDefault();
    if (guardando) return;

    const materiasConHorario = [
      ...matriculadas.map((matricula) => ({
        nombre: matricula.nombreMateria,
        horario: matricula.horario
      })),
      ...seleccionadas.map((materia) => ({ nombre: materia.nombre, horario: materia.horario }))
    ];

    const encontrados = validarMatricula({
      identificacion,
      codigosMaterias: seleccion,
      totalCreditos: creditosSeleccionados,
      creditosPrevios,
      materias: materiasConHorario
    });
    setErrores(encontrados);
    setExito("");
    setError(null);
    if (Object.keys(encontrados).length) return;

    setGuardando(true);
    try {
      const resultado = await api.registrarMatricula({
        identificacion,
        periodo,
        codigosMaterias: seleccion
      });
      const [ofertadas, inscritas] = await Promise.all([
        api.listarMateriasParaEstudiante(identificacion, periodo),
        api.listarMatriculas({ identificacion, periodo })
      ]);
      setDisponibles(ofertadas);
      setMatriculadas(inscritas);
      setSeleccion([]);
      setExito(
        `Se matricularon ${resultado.matriculas.length} materia(s) en ${resultado.periodo}. ` +
          `El estudiante acumula ${resultado.creditosPeriodo} de ${MAX_CREDITOS} créditos ` +
          `(${resultado.totalCreditos} en esta matrícula).`
      );
    } catch (fallo) {
      setError(fallo);
      if (fallo?.campo === "materias") {
        setErrores({ materias: fallo.message });
      }
    } finally {
      setGuardando(false);
    }
  }

  if (!estudiantes.length) {
    return (
      <div className="vista">
        <header className="vista__encabezado">
          <p className="vista__modulo">Módulo 5</p>
          <h2>Matrícula</h2>
        </header>
        <Tarjeta>
          <Vacio
            titulo="Primero registra estudiantes"
            accion={
              <a className="boton boton--primario" href="#/estudiantes">
                Ir a estudiantes
              </a>
            }
          >
            Necesitas al menos un estudiante y materias del periodo para matricular.
          </Vacio>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div className="vista">
      <header className="vista__encabezado animar-arriba">
        <p className="vista__modulo">Módulo 5</p>
        <h2>Matrícula</h2>
        <p>
          El tope de {MAX_CREDITOS} créditos es por estudiante y periodo: si ya matriculó materias en{" "}
          {periodo}, solo podrás agregar las que quepan en el saldo restante.
        </p>
      </header>

      <div className="rejilla rejilla--matricula">
        <div className="columna-principal">
          <Tarjeta className="animar-arriba">
            <div className="selector-estudiante">
              <Seleccion
                etiqueta="Estudiante"
                id="matricula-estudiante"
                value={identificacion}
                onChange={(evento) => setIdentificacion(evento.target.value)}
              >
                <option value="">Selecciona un estudiante</option>
                {estudiantes.map((item) => (
                  <option key={item.identificacion} value={item.identificacion}>
                    {item.identificacion} · {nombreCompleto(item)}
                  </option>
                ))}
              </Seleccion>
              <Etiqueta tono="azul">Periodo {periodo}</Etiqueta>
            </div>

            {estudiante && (
              <div className="ficha-estudiante animar-arriba">
                <span className="avatar">{iniciales(estudiante)}</span>
                <div>
                  <strong>{nombreCompleto(estudiante)}</strong>
                  <span>Documento {estudiante.identificacion}</span>
                </div>
                <div className="ficha-estudiante__meta">
                  <span>{carrera?.nombre || "Carrera no disponible"}</span>
                  <span>{facultad?.nombre || "Facultad no disponible"}</span>
                </div>
                <div className="ficha-estudiante__creditos">
                  <span>Créditos del periodo</span>
                  <strong>
                    {creditosPrevios} / {MAX_CREDITOS}
                  </strong>
                </div>
              </div>
            )}
          </Tarjeta>

          {errorCarga && <Alerta tipo="error">{errorCarga.message}</Alerta>}

          {cargando && <Cargando texto="Consultando materias y matrículas del periodo…" />}

          {!identificacion && (
            <Tarjeta className="animar-arriba">
              <Vacio titulo="Selecciona un estudiante para comenzar">
                Verás las materias de su facultad y las de servicio general disponibles en {periodo}.
              </Vacio>
            </Tarjeta>
          )}

          {identificacion && !cargando && (
            <>
              {matriculadas.length > 0 && (
                <Tarjeta
                  titulo="Ya matriculadas en el periodo"
                  descripcion="Estas materias ya cuentan para el tope de créditos."
                  acciones={<Etiqueta tono="verde">{creditosPrevios} créditos</Etiqueta>}
                  className="animar-arriba"
                >
                  <ul className="materias-inscritas">
                    {matriculadas.map((matricula) => (
                      <li key={matricula.idMatricula}>
                        <div>
                          <strong>{matricula.nombreMateria}</strong>
                          <span>
                            {matricula.creditos} créditos · {matricula.horario}
                          </span>
                        </div>
                        <Etiqueta tono={matricula.nota ? "verde" : "azul"}>
                          {matricula.nota ? `Promedio ${matricula.nota.promedio.toFixed(2)}` : "Sin nota"}
                        </Etiqueta>
                      </li>
                    ))}
                  </ul>
                </Tarjeta>
              )}

              {grupos.length ? (
                grupos.map((grupo) => (
                  <Tarjeta
                    key={grupo.clave}
                    titulo={grupo.titulo}
                    descripcion={grupo.descripcion}
                    className="animar-arriba"
                  >
                    <div className="materias-lista">
                      {grupo.materias.map((materia) => {
                        const activa = seleccion.includes(Number(materia.id));
                        return (
                          <label
                            key={materia.id}
                            className={`materia-opcion ${activa ? "materia-opcion--activa" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={activa}
                              onChange={() => alternar(materia.id)}
                            />
                            <span className="materia-opcion__contenido">
                              <span className="materia-opcion__nombre">{materia.nombre}</span>
                              <span className="materia-opcion__meta">
                                {materia.creditos} créditos · Código {materia.id} · {materia.cupos} cupos
                              </span>
                              <span className="materia-opcion__meta">Horario {materia.horario}</span>
                            </span>
                            {materia.esServicioGeneral && (
                              <Etiqueta tono="violeta">Servicio general</Etiqueta>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </Tarjeta>
                ))
              ) : (
                <Tarjeta className="animar-arriba">
                  <Vacio titulo="No hay materias disponibles">
                    La facultad de este estudiante no tiene materias en {periodo} y tampoco hay oferta
                    de Humanidades o Inglés.
                  </Vacio>
                </Tarjeta>
              )}
            </>
          )}
        </div>

        <aside className="columna-resumen">
          <form className="tarjeta resumen-matricula animar-arriba" onSubmit={enviar} noValidate>
            <h3>Resumen de matrícula</h3>

            {exito && <Alerta tipo="exito">{exito}</Alerta>}
            {error && !errores.materias && <Alerta tipo="error">{error.message}</Alerta>}
            {errores.materias && <Alerta tipo="error">{errores.materias}</Alerta>}
            {errores.identificacion && <Alerta tipo="error">{errores.identificacion}</Alerta>}

            <dl className="resumen-cifras">
              <div>
                <dt>Créditos previos</dt>
                <dd>{formatoNumero(creditosPrevios)}</dd>
              </div>
              <div>
                <dt>Seleccionados ahora</dt>
                <dd>{formatoNumero(creditosSeleccionados)}</dd>
              </div>
              <div className="resumen-cifras__total">
                <dt>Total del periodo</dt>
                <dd>
                  {formatoNumero(creditosPeriodo)} / {MAX_CREDITOS}
                </dd>
              </div>
            </dl>

            <Barra
              valor={(creditosPeriodo / MAX_CREDITOS) * 100}
              tono={excede ? "rojo" : creditosPeriodo >= MAX_CREDITOS ? "verde" : "azul"}
              etiqueta="Créditos acumulados en el periodo"
            />

            <p className={`resumen-matricula__rango ${excede ? "resumen-matricula__rango--error" : ""}`}>
              {restantes === 0
                ? `El estudiante alcanzó el máximo de ${MAX_CREDITOS} créditos en ${periodo}.`
                : `Puedes matricular hasta ${restantes} crédito(s) más en este periodo.`}
            </p>

            <div className="resumen-lista">
              <span>Selección actual</span>
              {seleccionadas.length ? (
                <ul>
                  {seleccionadas.map((materia) => (
                    <li key={materia.id}>
                      <span>{materia.nombre}</span>
                      <span>{materia.creditos} cr.</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="texto-tenue">Aún no has seleccionado materias.</p>
              )}
            </div>

            <Boton type="submit" cargando={guardando} disabled={!seleccion.length || excede}>
              <Icono nombre="matricula" />
              {guardando ? "Matriculando…" : "Matricular selección"}
            </Boton>
          </form>
        </aside>
      </div>
    </div>
  );
}
