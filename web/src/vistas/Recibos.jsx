import { useState } from "react";
import { api } from "../api";
import { useDatos } from "../contexto";
import { formatoCOP, formatoFecha, formatoNumero, iniciales, nombreCompleto } from "../formato";
import {
  Alerta,
  Boton,
  Cargando,
  Etiqueta,
  Icono,
  Seleccion,
  Tarjeta,
  Vacio
} from "../componentes/ui";

export default function Recibos() {
  const { estudiantes } = useDatos();

  const [identificacion, setIdentificacion] = useState("");
  const [periodos, setPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState("");
  const [recibo, setRecibo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);
  const [mensajeVacio, setMensajeVacio] = useState("");

  async function cambiarEstudiante(documento) {
    setIdentificacion(documento);
    setRecibo(null);
    setMensajeVacio("");
    setError(null);
    setPeriodos([]);
    setPeriodo("");
    if (!documento) return;

    setCargando(true);
    try {
      const lista = await api.listarPeriodos(documento);
      setPeriodos(lista);
      setPeriodo(lista[0] || "");
      if (!lista.length) {
        setMensajeVacio("Este estudiante aún no tiene matrículas registradas.");
      }
    } catch (fallo) {
      setError(fallo);
    } finally {
      setCargando(false);
    }
  }

  async function generar(evento) {
    evento.preventDefault();
    if (!identificacion || !periodo) return;

    setBuscando(true);
    setError(null);
    setMensajeVacio("");
    try {
      const resultado = await api.obtenerRecibo({ identificacion, periodo });
      setRecibo(resultado);
      if (!resultado) {
        setMensajeVacio(`El estudiante no tiene matrículas registradas en el periodo ${periodo}.`);
      }
    } catch (fallo) {
      setError(fallo);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="vista">
      <header className="vista__encabezado animar-arriba">
        <p className="vista__modulo">Módulo 7</p>
        <h2>Recibo de matrícula</h2>
        <p>
          Genera el comprobante con el detalle de materias, créditos y valor a pagar. Puedes
          imprimirlo o guardarlo como PDF desde el diálogo de impresión.
        </p>
      </header>

      <div className="rejilla rejilla--recibo">
        <Tarjeta titulo="Datos del recibo" className="animar-arriba">
          <form className="formulario" onSubmit={generar}>
            <Seleccion
              etiqueta="Estudiante"
              id="recibo-estudiante"
              value={identificacion}
              onChange={(evento) => cambiarEstudiante(evento.target.value)}
            >
              <option value="">Selecciona un estudiante</option>
              {estudiantes.map((estudiante) => (
                <option key={estudiante.identificacion} value={estudiante.identificacion}>
                  {estudiante.identificacion} · {nombreCompleto(estudiante)}
                </option>
              ))}
            </Seleccion>

            <Seleccion
              etiqueta="Periodo"
              id="recibo-periodo"
              value={periodo}
              onChange={(evento) => setPeriodo(evento.target.value)}
              disabled={!periodos.length}
              ayuda={periodos.length ? undefined : "Selecciona un estudiante con matrículas."}
            >
              {periodos.length ? (
                periodos.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))
              ) : (
                <option value="">Sin periodos disponibles</option>
              )}
            </Seleccion>

            <Boton type="submit" cargando={buscando} disabled={!identificacion || !periodo}>
              <Icono nombre="recibo" /> Generar recibo
            </Boton>
          </form>
        </Tarjeta>

        <div className="columna-recibo">
          {error && <Alerta tipo="error">{error.message}</Alerta>}
          {cargando && <Cargando texto="Buscando periodos del estudiante…" />}
          {mensajeVacio && !recibo && <Alerta tipo="info">{mensajeVacio}</Alerta>}

          {recibo ? (
            <>
              <div className="recibo animar-arriba" id="recibo-impresion">
                <header className="recibo__cabecera">
                  <img src="/assets/image.png" alt="" width="56" height="56" />
                  <div>
                    <p>Universidad Cooperativa de Colombia</p>
                    <h3>Recibo de matrícula</h3>
                    <span>{recibo.numero}</span>
                  </div>
                  <Etiqueta tono="azul">Periodo {recibo.periodo}</Etiqueta>
                </header>

                <div className="recibo__estudiante">
                  <span className="avatar">{iniciales(recibo.estudiante)}</span>
                  <div>
                    <strong>
                      {recibo.estudiante.nombres} {recibo.estudiante.apellidos}
                    </strong>
                    <span>Documento {recibo.estudiante.identificacion}</span>
                    <span>
                      {recibo.estudiante.carrera} · {recibo.estudiante.facultad}
                    </span>
                  </div>
                  <div className="recibo__fecha">
                    <span>Fecha de emisión</span>
                    <strong>{formatoFecha(recibo.fechaEmision)}</strong>
                  </div>
                </div>

                <table className="recibo__tabla">
                  <thead>
                    <tr>
                      <th scope="col">Materia</th>
                      <th scope="col">Horario</th>
                      <th scope="col">Créditos</th>
                      <th scope="col">Valor crédito</th>
                      <th scope="col">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recibo.matriculas.map((matricula) => (
                      <tr key={matricula.idMatricula}>
                        <td>
                          <strong>{matricula.nombreMateria}</strong>
                          <span className="recibo__codigo">Código {matricula.codMateria}</span>
                        </td>
                        <td>{matricula.horario}</td>
                        <td>{matricula.creditos}</td>
                        <td>{formatoCOP(matricula.valorCredito)}</td>
                        <td>{formatoCOP(matricula.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <footer className="recibo__totales">
                  <div>
                    <span>Materias</span>
                    <strong>{recibo.matriculas.length}</strong>
                  </div>
                  <div>
                    <span>Créditos</span>
                    <strong>{formatoNumero(recibo.totalCreditos)}</strong>
                  </div>
                  <div className="recibo__total">
                    <span>Total a pagar</span>
                    <strong>{formatoCOP(recibo.totalPagar)}</strong>
                  </div>
                </footer>

                <p className="recibo__pie">
                  Documento informativo generado automáticamente. El valor corresponde a la matrícula
                  académica del periodo {recibo.periodo}.
                </p>
              </div>

              <Boton variante="secundario" onClick={() => window.print()}>
                <Icono nombre="impresora" /> Imprimir o guardar PDF
              </Boton>
            </>
          ) : (
            !cargando &&
            !mensajeVacio && (
              <Tarjeta className="animar-arriba">
                <Vacio titulo="Aún no hay recibo para mostrar">
                  Selecciona un estudiante y el periodo para generar el comprobante.
                </Vacio>
              </Tarjeta>
            )
          )}
        </div>
      </div>
    </div>
  );
}
