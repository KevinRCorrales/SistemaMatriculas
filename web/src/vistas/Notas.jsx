import { useState } from "react";
import { api } from "../api";
import { useDatos } from "../contexto";
import { aNumero, validarNotas } from "../validaciones";
import {
  Alerta,
  Boton,
  Entrada,
  Etiqueta,
  Seleccion,
  Tarjeta,
  Vacio
} from "../componentes/ui";

export default function Notas() {
  const { estudiantes, periodo: periodoActual } = useDatos();

  const [identificacion, setIdentificacion] = useState("");
  const [matriculas, setMatriculas] = useState([]);
  const [periodoFiltro, setPeriodoFiltro] = useState("");
  const [cargando, setCargando] = useState(false);
  const [idMatricula, setIdMatricula] = useState("");
  const [notas, setNotas] = useState({ nota1: "", nota2: "", nota3: "" });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState("");
  const [error, setError] = useState(null);

  async function cargarMatriculas(documento) {
    setIdentificacion(documento);
    setPeriodoFiltro("");
    setIdMatricula("");
    setNotas({ nota1: "", nota2: "", nota3: "" });
    setErrores({});
    setExito("");
    setError(null);
    if (!documento) {
      setMatriculas([]);
      return;
    }
    setCargando(true);
    try {
      const lista = await api.listarMatriculas({ identificacion: documento });
      setMatriculas(lista);
      const periodosLista = [...new Set(lista.map((matricula) => matricula.periodo))]
        .sort()
        .reverse();
      setPeriodoFiltro(
        periodosLista.includes(periodoActual) ? periodoActual : periodosLista[0] || ""
      );
    } catch (fallo) {
      setError(fallo);
      setMatriculas([]);
    } finally {
      setCargando(false);
    }
  }

  function cambiarPeriodo(valor) {
    setPeriodoFiltro(valor);
    setIdMatricula("");
    setNotas({ nota1: "", nota2: "", nota3: "" });
    setErrores({});
    setExito("");
    setError(null);
  }

  function seleccionar(matricula) {
    setIdMatricula(String(matricula.idMatricula));
    setErrores({});
    setExito("");
    setError(null);
    setNotas(
      matricula.nota
        ? {
            nota1: String(matricula.nota.nota1),
            nota2: String(matricula.nota.nota2),
            nota3: String(matricula.nota.nota3)
          }
        : { nota1: "", nota2: "", nota3: "" }
    );
  }

  const periodos = [...new Set(matriculas.map((matricula) => matricula.periodo))]
    .sort()
    .reverse();
  const visibles = periodoFiltro
    ? matriculas.filter((matricula) => matricula.periodo === periodoFiltro)
    : matriculas;

  const seleccionada = matriculas.find(
    (matricula) => String(matricula.idMatricula) === String(idMatricula)
  );
  const pendiente = seleccionada && !seleccionada.nota;

  const valores = ["nota1", "nota2", "nota3"].map((campo) => aNumero(notas[campo]));
  const completas = valores.every((valor) => Number.isFinite(valor));
  const promedio = completas ? valores.reduce((total, valor) => total + valor, 0) / 3 : null;

  async function enviar(evento) {
    evento.preventDefault();
    if (guardando) return;

    const encontrados = validarNotas({ idMatricula, ...notas });
    setErrores(encontrados);
    setExito("");
    setError(null);
    if (Object.keys(encontrados).length) return;

    setGuardando(true);
    try {
      const resultado = await api.registrarNotas({ idMatricula, ...notas });
      setMatriculas(await api.listarMatriculas({ identificacion }));
      setExito(
        `Notas registradas para ${resultado.nombreMateria}. Promedio ${resultado.promedio.toFixed(2)}: ` +
          `${resultado.aprobada ? "aprobada" : "reprobada"}.`
      );
      setIdMatricula("");
      setNotas({ nota1: "", nota2: "", nota3: "" });
    } catch (fallo) {
      setError(fallo);
      if (fallo?.campo === "idMatricula") {
        setErrores({ idMatricula: fallo.message });
      }
    } finally {
      setGuardando(false);
    }
  }

  if (!estudiantes.length) {
    return (
      <div className="vista">
        <header className="vista__encabezado">
          <p className="vista__modulo">Módulo 6</p>
          <h2>Notas</h2>
        </header>
        <Tarjeta>
          <Vacio
            titulo="Primero registra estudiantes y matrículas"
            accion={
              <a className="boton boton--primario" href="#/matricula">
                Ir a matrícula
              </a>
            }
          >
            Las notas se registran sobre una materia matriculada.
          </Vacio>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div className="vista">
      <header className="vista__encabezado animar-arriba">
        <p className="vista__modulo">Módulo 6</p>
        <h2>Notas</h2>
        <p>
          Selecciona una materia matriculada, registra las tres notas y observa el promedio antes de
          guardar. Cada materia admite un único registro de notas.
        </p>
      </header>

      <div className="rejilla rejilla--dos">
        <div className="columna-principal">
          <Tarjeta
            titulo="Estudiante y periodo"
            descripcion="Limita la lista a un periodo para ubicar la materia más rápido."
            className="animar-arriba"
          >
            <div className="rejilla rejilla--campos">
              <Seleccion
                etiqueta="Estudiante"
                id="notas-estudiante"
                value={identificacion}
                onChange={(evento) => cargarMatriculas(evento.target.value)}
              >
                <option value="">Selecciona un estudiante</option>
                {estudiantes.map((estudiante) => (
                  <option key={estudiante.identificacion} value={estudiante.identificacion}>
                    {estudiante.identificacion} · {estudiante.nombres} {estudiante.apellidos}
                  </option>
                ))}
              </Seleccion>
              <Seleccion
                etiqueta="Periodo"
                id="notas-periodo"
                value={periodoFiltro}
                disabled={!matriculas.length}
                onChange={(evento) => cambiarPeriodo(evento.target.value)}
              >
                <option value="">Todos los periodos</option>
                {periodos.map((periodo) => (
                  <option key={periodo} value={periodo}>
                    {periodo}
                  </option>
                ))}
              </Seleccion>
            </div>
          </Tarjeta>

          {error && !idMatricula && <Alerta tipo="error">{error.message}</Alerta>}

          {identificacion && (
            <Tarjeta
              titulo="Materias matriculadas"
              descripcion={
                periodoFiltro
                  ? `Materias del periodo ${periodoFiltro}.`
                  : "Materias de todos los periodos del estudiante."
              }
              acciones={<Etiqueta>{visibles.length}</Etiqueta>}
              className="animar-arriba"
            >
              {cargando ? (
                <p className="texto-tenue">Cargando matrículas…</p>
              ) : visibles.length ? (
                <ul className="lista-notas">
                  {visibles.map((matricula) => {
                    const activa = String(matricula.idMatricula) === String(idMatricula);
                    return (
                      <li key={matricula.idMatricula}>
                        <button
                          type="button"
                          className={`opcion-nota ${activa ? "opcion-nota--activa" : ""}`}
                          onClick={() => seleccionar(matricula)}
                          aria-pressed={activa}
                          disabled={Boolean(matricula.nota)}
                        >
                          <span>
                            <strong>{matricula.nombreMateria}</strong>
                            <span>
                              {matricula.periodo} · {matricula.creditos} créditos ·{" "}
                              {matricula.horario}
                            </span>
                          </span>
                          {matricula.nota ? (
                            <Etiqueta tono={matricula.nota.promedio >= 3 ? "verde" : "rojo"}>
                              {matricula.nota.promedio.toFixed(2)}
                            </Etiqueta>
                          ) : (
                            <Etiqueta tono="ambar">Pendiente</Etiqueta>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : matriculas.length ? (
                <Vacio titulo={`Sin matrículas en ${periodoFiltro}`}>
                  Elige otro periodo o consulta «Todos los periodos» para ver las demás materias.
                </Vacio>
              ) : (
                <Vacio titulo="Este estudiante no tiene matrículas">
                  Matricula materias primero para poder registrar notas.
                </Vacio>
              )}
            </Tarjeta>
          )}
        </div>

        <aside className="columna-resumen">
          <form className="tarjeta animar-arriba" onSubmit={enviar} noValidate>
            <h3>Calificaciones</h3>

            {exito && <Alerta tipo="exito">{exito}</Alerta>}
            {error && <Alerta tipo="error">{error.message}</Alerta>}
            {errores.idMatricula && <Alerta tipo="error">{errores.idMatricula}</Alerta>}

            {seleccionada ? (
              <>
                <p className="nota-materia">
                  <strong>{seleccionada.nombreMateria}</strong>
                  <span>{seleccionada.periodo}</span>
                </p>

                <Entrada
                  etiqueta="Nota 1"
                  id="nota1"
                  inputMode="decimal"
                  placeholder="0.0 – 5.0"
                  value={notas.nota1}
                  error={errores.nota1}
                  onChange={(evento) => setNotas({ ...notas, nota1: evento.target.value })}
                />
                <Entrada
                  etiqueta="Nota 2"
                  id="nota2"
                  inputMode="decimal"
                  placeholder="0.0 – 5.0"
                  value={notas.nota2}
                  error={errores.nota2}
                  onChange={(evento) => setNotas({ ...notas, nota2: evento.target.value })}
                />
                <Entrada
                  etiqueta="Nota 3"
                  id="nota3"
                  inputMode="decimal"
                  placeholder="0.0 – 5.0"
                  value={notas.nota3}
                  error={errores.nota3}
                  onChange={(evento) => setNotas({ ...notas, nota3: evento.target.value })}
                />

                <div className="vista-previa">
                  <span>Promedio</span>
                  <strong>{promedio === null ? "—" : promedio.toFixed(2)}</strong>
                  {promedio !== null && (
                    <Etiqueta tono={promedio >= 3 ? "verde" : "rojo"}>
                      {promedio >= 3 ? "Aprueba" : "No aprueba"}
                    </Etiqueta>
                  )}
                </div>

                <Boton type="submit" cargando={guardando} disabled={!pendiente}>
                  {seleccionada.nota ? "Esta materia ya tiene notas" : "Guardar notas"}
                </Boton>
              </>
            ) : (
              <Vacio titulo="Selecciona una materia">
                Las notas se habilitan cuando eliges una materia pendiente en la lista.
              </Vacio>
            )}
          </form>
        </aside>
      </div>
    </div>
  );
}
