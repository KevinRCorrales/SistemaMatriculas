import { api } from "../api";
import { useDatos } from "../contexto";
import { useFormulario } from "../hooks";
import { validarEstudiante } from "../validaciones";
import { Alerta, Boton, Entrada, Etiqueta, Seleccion, Tarjeta, Tabla, Vacio } from "../componentes/ui";

const INICIAL = {
  documento: "",
  nombres: "",
  apellidos: "",
  correo: "",
  telefono: "",
  idCarrera: ""
};

export default function Estudiantes() {
  const { carreras, facultades, estudiantes, recargarEstudiantes } = useDatos();

  const formulario = useFormulario(INICIAL, validarEstudiante, async (valores) => {
    const creado = await api.crearEstudiante(valores);
    await recargarEstudiantes();
    return `${creado.nombres} ${creado.apellidos} quedó registrado con el documento ${creado.identificacion}.`;
  });

  const carreraNombre = (id) => carreras.find((carrera) => Number(carrera.id) === Number(id))?.nombre || "—";
  const facultadNombre = (idCarrera) => {
    const carrera = carreras.find((item) => Number(item.id) === Number(idCarrera));
    const facultad = facultades.find((item) => Number(item.id) === Number(carrera?.idFacultad));
    return facultad?.nombre || "—";
  };

  if (!carreras.length) {
    return (
      <div className="vista">
        <header className="vista__encabezado">
          <p className="vista__modulo">Módulo 3</p>
          <h2>Estudiantes</h2>
        </header>
        <Tarjeta>
          <Vacio
            titulo="Primero registra una carrera"
            accion={
              <a className="boton boton--primario" href="#/carreras">
                Ir a carreras
              </a>
            }
          >
            Cada estudiante se asocia a una carrera y, por medio de ella, a una facultad.
          </Vacio>
        </Tarjeta>
      </div>
    );
  }

  const filas = estudiantes.map((estudiante) => ({
    id: estudiante.identificacion,
    documento: estudiante.identificacion,
    nombre: `${estudiante.nombres} ${estudiante.apellidos}`,
    carrera: carreraNombre(estudiante.idCarrera),
    facultad: facultadNombre(estudiante.idCarrera),
    correo: estudiante.correo,
    telefono: estudiante.telefono
  }));

  return (
    <div className="vista">
      <header className="vista__encabezado animar-arriba">
        <p className="vista__modulo">Módulo 3</p>
        <h2>Estudiantes</h2>
        <p>Registra a los estudiantes una sola vez. Documento, correo y teléfono deben ser únicos.</p>
      </header>

      <div className="rejilla rejilla--dos">
        <Tarjeta titulo="Datos del estudiante" descripcion="Los campos marcados son obligatorios." className="animar-arriba">
          {formulario.exito && <Alerta tipo="exito">{formulario.exito}</Alerta>}
          {formulario.error && <Alerta tipo="error">{formulario.error.message}</Alerta>}

          <form className="formulario" onSubmit={formulario.enviar} noValidate>
            <div className="rejilla rejilla--campos">
              <Entrada
                etiqueta="Documento"
                id="documento"
                requerido
                inputMode="numeric"
                maxLength={20}
                placeholder="Ej.: 1098765432"
                ayuda="Entre 6 y 20 dígitos."
                value={formulario.valores.documento}
                error={formulario.errores.documento}
                onChange={(evento) => formulario.setCampo("documento", evento.target.value)}
              />
              <Entrada
                etiqueta="Nombres"
                id="nombres"
                requerido
                maxLength={40}
                autoComplete="off"
                placeholder="Ej.: Ana María"
                value={formulario.valores.nombres}
                error={formulario.errores.nombres}
                onChange={(evento) => formulario.setCampo("nombres", evento.target.value)}
              />
              <Entrada
                etiqueta="Apellidos"
                id="apellidos"
                requerido
                maxLength={40}
                autoComplete="off"
                placeholder="Ej.: Gómez Ruiz"
                value={formulario.valores.apellidos}
                error={formulario.errores.apellidos}
                onChange={(evento) => formulario.setCampo("apellidos", evento.target.value)}
              />
              <Entrada
                etiqueta="Correo electrónico"
                id="correo"
                type="email"
                requerido
                maxLength={70}
                placeholder="nombre@universidad.edu.co"
                value={formulario.valores.correo}
                error={formulario.errores.correo}
                onChange={(evento) => formulario.setCampo("correo", evento.target.value)}
              />
              <Entrada
                etiqueta="Teléfono"
                id="telefono"
                requerido
                inputMode="numeric"
                maxLength={10}
                placeholder="Ej.: 3001234567"
                ayuda="Entre 7 y 10 dígitos."
                value={formulario.valores.telefono}
                error={formulario.errores.telefono}
                onChange={(evento) => formulario.setCampo("telefono", evento.target.value)}
              />
              <Seleccion
                etiqueta="Carrera"
                id="carrera"
                requerido
                value={formulario.valores.idCarrera}
                error={formulario.errores.idCarrera}
                onChange={(evento) => formulario.setCampo("idCarrera", evento.target.value)}
              >
                <option value="">Selecciona una carrera</option>
                {carreras.map((carrera) => (
                  <option key={carrera.id} value={carrera.id}>
                    {carrera.nombre} · {facultadNombre(carrera.id)}
                  </option>
                ))}
              </Seleccion>
            </div>

            <div className="acciones-formulario">
              <Boton variante="secundario" type="button" onClick={formulario.limpiar}>
                Limpiar
              </Boton>
              <Boton type="submit" cargando={formulario.guardando}>
                Guardar estudiante
              </Boton>
            </div>
          </form>
        </Tarjeta>

        <aside className="panel-contexto animar-arriba">
          <Tarjeta titulo="Antes de guardar" className="tarjeta--suave">
            <ul className="lista-check">
              <li>Verifica que el documento no esté registrado.</li>
              <li>El correo y el teléfono identifican al estudiante en los recibos.</li>
              <li>La carrera define la facultad y las materias disponibles.</li>
            </ul>
            <div className="dato-clave">
              <span>Estudiantes registrados</span>
              <strong>{estudiantes.length}</strong>
            </div>
          </Tarjeta>
        </aside>
      </div>

      <Tarjeta
        titulo="Estudiantes registrados"
        descripcion="Consulta la carrera y la facultad de cada estudiante."
        acciones={<Etiqueta>{estudiantes.length}</Etiqueta>}
        className="animar-arriba"
      >
        <Tabla
          columnas={[
            { clave: "documento", titulo: "Documento" },
            { clave: "nombre", titulo: "Estudiante" },
            { clave: "carrera", titulo: "Carrera" },
            { clave: "facultad", titulo: "Facultad" },
            { clave: "correo", titulo: "Correo" }
          ]}
          filas={filas}
          vacio="Todavía no hay estudiantes registrados."
        />
      </Tarjeta>
    </div>
  );
}
