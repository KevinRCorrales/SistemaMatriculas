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
  const { estudiantes, carreras, facultades, periodo, esAdmin } = useDatos();

  const [identificacion, setIdentificacion] = useState(() =>
    esAdmin ? "" : estudiantes[0]?.identificacion || ""
  );
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
  const nombreCarrera = esAdmin ? carrera?.nombre : estudiante?.carrera;
  const nombreFacultad = esAdmin ? facultad?.nombre : estudiante?.facultad;
  const idFacultadEstudiante = esAdmin
    ? carrera?.idFacultad
    : estudiante?.idFacultad;

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
      titulo: `Materias de ${nombreFacultad || "la facultad"}`,
      descripcion: `Oferta del periodo ${periodo} para la carrera del estudiante.`,
      materias: seleccionables.filter(
        (materia) => Number(materia.idFacultad) === Number(idFacultadEstudiante)
      )
    },
    {
      clave: "servicio",
      titulo: "Materias de servicio general",
      descripcion: "Humanidades e Inglés, abiertas a todas las carreras.",
      materias: seleccionables.filter(
        (materia) =>
          materia.esServicioGeneral &&
          Number(materia.idFacultad) !== Number(idFacultadEstudiante)
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

  if (esAdmin) {
    const totalCreditos = matriculadas.reduce(
      (total, matricula) => total + Number(matricula.creditos || 0),
      0
    );
    const conNota = matriculadas.filter((matricula) => matricula.nota).length;

    return (
      <div className="vista">
        <header className="vista__encabezado animar-arriba">
          <p className="vista__modulo">Módulo 5</p>
          <h2>Matrículas</h2>
          <p>
            Consulta las materias que cada estudiante inscribió en el periodo {periodo}. La
            inscripción la realiza el propio estudiante desde su cuenta.
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
                    <span>{nombreCarrera || "Carrera no disponible"}</span>
                    <span>{nombreFacultad || "Facultad no disponible"}</span>
                  </div>
                </div>
              )}
            </Tarjeta>

            {errorCarga && <Alerta tipo="error">{errorCarga.message}</Alerta>}
            {cargando && <Cargando texto="Consultando matrículas del periodo…" />}

            {!identificacion && (
              <Tarjeta className="animar-arriba">
                <Vacio titulo="Consulta la matrícula de un estudiante">
                  Elige un estudiante para ver las materias que inscribió en {periodo}.
                </Vacio>
              </Tarjeta>
            )}

            {identificacion && !cargando && (
              matriculadas.length ? (
                <Tarjeta
                  titulo="Matrículas del periodo"
                  descripcion="Materias inscritas y estado de sus notas."
                  acciones={<Etiqueta tono="verde">{totalCreditos} créditos</Etiqueta>}
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
                          {matricula.nota
                            ? `Promedio ${matricula.nota.promedio.toFixed(2)}`
                            : "Sin nota"}
                        </Etiqueta>
                      </li>
                    ))}
                  </ul>
                </Tarjeta>
              ) : (
                <Tarjeta className="animar-arriba">
                  <Vacio titulo={`Sin matrículas en ${periodo}`}>
                    El estudiante no tiene materias inscritas en este periodo.
                  </Vacio>
                </Tarjeta>
              )
            )}
          </div>

          <aside className="columna-resumen">
            <div className="tarjeta resumen-matricula animar-arriba">
              <h3>Resumen de la consulta</h3>
              {estudiante ? (
                <>
                  <dl className="resumen-cifras">
                    <div>
                      <dt>Materias</dt>
                      <dd>{formatoNumero(matriculadas.length)}</dd>
                    </div>
                    <div>
                      <dt>Créditos</dt>
                      <dd>{formatoNumero(totalCreditos)}</dd>
                    </div>
                    <div className="resumen-cifras__total">
                      <dt>Tope del periodo</dt>
                      <dd>
                        {formatoNumero(totalCreditos)} / {MAX_CREDITOS}
                      </dd>
                    </div>
                  </dl>
                  <Barra
                    valor={(totalCreditos / MAX_CREDITOS) * 100}
                    etiqueta="Créditos matriculados en el periodo"
                  />
                  <p className="texto-tenue">
                    {conNota} de {matriculadas.length} materias con nota registrada. Las notas se
                    cargan desde el módulo Notas.
                  </p>
                  <a className="boton boton--secundario" href="#/recibos">
                    Consultar recibos
                  </a>
                </>
              ) : (
                <p className="texto-tenue">Elige un estudiante para ver su matrícula.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="vista">
      <header className="vista__encabezado animar-arriba">
        <p className="vista__modulo">{esAdmin ? "Módulo 5" : "Tu matrícula"}</p>
        <h2>{esAdmin ? "Matrícula" : "Matricula tus materias"}</h2>
        <p>
          El tope de {MAX_CREDITOS} créditos es por estudiante y periodo: si ya matriculaste materias
          en {periodo}, solo puedes agregar las que quepan en el saldo restante.
        </p>
      </header>

      <div className="rejilla rejilla--matricula">
        <div className="columna-principal">
          <Tarjeta className="animar-arriba">
            <div className="selector-estudiante">
              {esAdmin ? (
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
              ) : (
                <strong className="selector-estudiante__titulo">Tu inscripción del periodo</strong>
              )}
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
                  <span>{nombreCarrera || "Carrera no disponible"}</span>
                  <span>{nombreFacultad || "Facultad no disponible"}</span>
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

          {!identificacion && esAdmin && (
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
