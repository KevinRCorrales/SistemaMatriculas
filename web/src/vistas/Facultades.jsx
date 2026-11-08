import { api } from "../api";
import { useDatos } from "../contexto";
import { useFormulario } from "../hooks";
import { validarFacultad } from "../validaciones";
import { Alerta, Boton, Entrada, Etiqueta, Tarjeta, Tabla } from "../componentes/ui";

const INICIAL = { nombre: "" };

export default function Facultades() {
  const { facultades, carreras, recargarCatalogos } = useDatos();

  const formulario = useFormulario(INICIAL, validarFacultad, async (valores) => {
    const creada = await api.crearFacultad(valores);
    await recargarCatalogos();
    return `La facultad ${creada.nombre} quedó registrada correctamente.`;
  });

  const filas = facultades.map((facultad) => ({
    id: facultad.id,
    nombre: facultad.nombre,
    carreras: carreras.filter((carrera) => Number(carrera.idFacultad) === Number(facultad.id)).length
  }));

  return (
    <div className="vista">
      <header className="vista__encabezado animar-arriba">
        <p className="vista__modulo">Módulo 1</p>
        <h2>Facultades</h2>
        <p>
          Crea las unidades académicas que agrupan carreras y materias. Debes registrar una facultad
          antes de asociarle carreras.
        </p>
      </header>

      <div className="rejilla rejilla--dos">
        <Tarjeta titulo="Datos de la facultad" descripcion="El nombre es único y se guarda en mayúsculas." className="animar-arriba">
          {formulario.exito && <Alerta tipo="exito">{formulario.exito}</Alerta>}
          {formulario.error && <Alerta tipo="error">{formulario.error.message}</Alerta>}

          <form className="formulario" onSubmit={formulario.enviar} noValidate>
            <Entrada
              etiqueta="Nombre de la facultad"
              id="nombre-facultad"
              ayuda="Entre 3 y 15 caracteres."
              requerido
              maxLength={15}
              autoComplete="off"
              placeholder="Ej.: Ingeniería"
              value={formulario.valores.nombre}
              error={formulario.errores.nombre}
              onChange={(evento) => formulario.setCampo("nombre", evento.target.value)}
            />
            <div className="acciones-formulario">
              <Boton variante="secundario" type="button" onClick={formulario.limpiar}>
                Limpiar
              </Boton>
              <Boton type="submit" cargando={formulario.guardando}>
                Guardar facultad
              </Boton>
            </div>
          </form>
        </Tarjeta>

        <aside className="panel-contexto animar-arriba">
          <Tarjeta titulo="Después de crearla" className="tarjeta--suave">
            <ul className="lista-check">
              <li>La facultad aparecerá de inmediato al registrar carreras y materias.</li>
              <li>Las materias de la facultad se ofrecen a sus carreras, salvo Humanidades e Inglés.</li>
              <li>El identificador se asigna automáticamente.</li>
            </ul>
            <div className="dato-clave">
              <span>Facultades registradas</span>
              <strong>{facultades.length}</strong>
            </div>
          </Tarjeta>
        </aside>
      </div>

      <Tarjeta
        titulo="Facultades registradas"
        descripcion="Catálogo disponible para carreras y materias."
        acciones={<Etiqueta>{facultades.length}</Etiqueta>}
        className="animar-arriba"
      >
        <Tabla
          columnas={[
            { clave: "id", titulo: "#" },
            { clave: "nombre", titulo: "Facultad" },
            {
              clave: "carreras",
              titulo: "Carreras",
              render: (fila) => <Etiqueta tono="azul">{fila.carreras}</Etiqueta>
            }
          ]}
          filas={filas}
          vacio="Todavía no hay facultades registradas."
        />
      </Tarjeta>
    </div>
  );
}
