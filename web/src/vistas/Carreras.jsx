import { api } from "../api";
import { useDatos } from "../contexto";
import { useFormulario } from "../hooks";
import { validarCarrera } from "../validaciones";
import { Alerta, Boton, Entrada, Etiqueta, Seleccion, Tarjeta, Tabla, Vacio } from "../componentes/ui";

const INICIAL = { nombre: "", idFacultad: "" };

export default function Carreras() {
  const { facultades, carreras, estudiantes, recargarCatalogos } = useDatos();

  const formulario = useFormulario(INICIAL, validarCarrera, async (valores) => {
    const creada = await api.crearCarrera(valores);
    await recargarCatalogos();
    return `La carrera ${creada.nombre} quedó asociada a su facultad.`;
  });

  const nombreFacultad = (id) =>
    facultades.find((facultad) => Number(facultad.id) === Number(id))?.nombre || "—";

  if (!facultades.length) {
    return (
      <div className="vista">
        <header className="vista__encabezado">
          <p className="vista__modulo">Módulo 2</p>
          <h2>Carreras</h2>
        </header>
        <Tarjeta>
          <Vacio
            titulo="Primero registra una facultad"
            accion={
              <a className="boton boton--primario" href="#/facultades">
                Ir a facultades
              </a>
            }
          >
            Toda carrera debe pertenecer a una facultad existente.
          </Vacio>
        </Tarjeta>
      </div>
    );
  }

  const filas = carreras.map((carrera) => ({
    id: carrera.id,
    nombre: carrera.nombre,
    facultad: nombreFacultad(carrera.idFacultad),
    estudiantes: estudiantes.filter((estudiante) => Number(estudiante.idCarrera) === Number(carrera.id)).length
  }));

  return (
    <div className="vista">
      <header className="vista__encabezado animar-arriba">
        <p className="vista__modulo">Módulo 2</p>
        <h2>Carreras</h2>
        <p>
          Asocia una carrera a una facultad existente. La facultad determina las materias disponibles
          para los estudiantes de la carrera.
        </p>
      </header>

      <div className="rejilla rejilla--dos">
        <Tarjeta titulo="Datos de la carrera" descripcion="El nombre es único dentro del catálogo." className="animar-arriba">
          {formulario.exito && <Alerta tipo="exito">{formulario.exito}</Alerta>}
          {formulario.error && <Alerta tipo="error">{formulario.error.message}</Alerta>}

          <form className="formulario" onSubmit={formulario.enviar} noValidate>
            <Entrada
              etiqueta="Nombre de la carrera"
              id="nombre-carrera"
              ayuda="Entre 3 y 30 caracteres."
              requerido
              maxLength={30}
              autoComplete="off"
              placeholder="Ej.: Ingeniería de Sistemas"
              value={formulario.valores.nombre}
              error={formulario.errores.nombre}
              onChange={(evento) => formulario.setCampo("nombre", evento.target.value)}
            />
            <Seleccion
              etiqueta="Facultad"
              id="facultad-carrera"
              requerido
              value={formulario.valores.idFacultad}
              error={formulario.errores.idFacultad}
              onChange={(evento) => formulario.setCampo("idFacultad", evento.target.value)}
            >
              <option value="">Selecciona una facultad</option>
              {facultades.map((facultad) => (
                <option key={facultad.id} value={facultad.id}>
                  {facultad.nombre}
                </option>
              ))}
            </Seleccion>
            <div className="acciones-formulario">
              <Boton variante="secundario" type="button" onClick={formulario.limpiar}>
                Limpiar
              </Boton>
              <Boton type="submit" cargando={formulario.guardando}>
                Guardar carrera
              </Boton>
            </div>
          </form>
        </Tarjeta>

        <aside className="panel-contexto animar-arriba">
          <Tarjeta titulo="Cómo se relacionan" className="tarjeta--suave">
            <ul className="lista-check">
              <li>Los estudiantes se matriculan en una carrera y heredan su facultad.</li>
              <li>La facultad define qué materias propias puede ver cada estudiante.</li>
              <li>Humanidades e Inglés son transversales a todas las facultades.</li>
            </ul>
            <div className="dato-clave">
              <span>Carreras registradas</span>
              <strong>{carreras.length}</strong>
            </div>
          </Tarjeta>
        </aside>
      </div>

      <Tarjeta
        titulo="Carreras registradas"
        descripcion="Programas asociados a cada facultad."
        acciones={<Etiqueta>{carreras.length}</Etiqueta>}
        className="animar-arriba"
      >
        <Tabla
          columnas={[
            { clave: "id", titulo: "#" },
            { clave: "nombre", titulo: "Carrera" },
            { clave: "facultad", titulo: "Facultad" },
            {
              clave: "estudiantes",
              titulo: "Estudiantes",
              render: (fila) => <Etiqueta tono="azul">{fila.estudiantes}</Etiqueta>
            }
          ]}
          filas={filas}
          vacio="Todavía no hay carreras registradas."
        />
      </Tarjeta>
    </div>
  );
}
