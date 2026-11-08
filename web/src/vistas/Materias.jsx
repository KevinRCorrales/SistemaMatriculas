import { api } from "../api";
import { useDatos } from "../contexto";
import { useFormulario, useRecurso } from "../hooks";
import { validarMateria } from "../validaciones";
import { Alerta, Boton, Entrada, Etiqueta, Seleccion, Tarjeta, Tabla, Vacio } from "../componentes/ui";

export default function Materias() {
  const { facultades, periodo } = useDatos();
  const { datos: materias, cargando, error, recargar } = useRecurso(() => api.listarMaterias(), []);

  const INICIAL = {
    id: "",
    nombre: "",
    creditos: "3",
    idFacultad: "",
    periodo,
    cupos: "20",
    horario: ""
  };

  const formulario = useFormulario(INICIAL, validarMateria, async (valores) => {
    const creada = await api.crearMateria(valores);
    await recargar();
    return `La materia ${creada.nombre} quedó registrada para el periodo ${creada.periodo} con horario ${creada.horario}.`;
  });

  if (!facultades.length) {
    return (
      <div className="vista">
        <header className="vista__encabezado">
          <p className="vista__modulo">Módulo 4</p>
          <h2>Materias</h2>
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
            Cada materia pertenece a una facultad y a un periodo académico.
          </Vacio>
        </Tarjeta>
      </div>
    );
  }

  const filas = (materias || []).map((materia) => ({
    id: materia.id,
    codigo: materia.id,
    nombre: materia.nombre,
    facultad: materia.facultad,
    periodo: materia.periodo,
    creditos: materia.creditos,
    cupos: materia.cupos,
    horario: materia.horario
  }));

  return (
    <div className="vista">
      <header className="vista__encabezado animar-arriba">
        <p className="vista__modulo">Módulo 4</p>
        <h2>Materias</h2>
        <p>
          Registra la oferta de cada periodo. El horario se guarda en mayúsculas aunque lo escribas en
          minúsculas.
        </p>
      </header>

      <div className="rejilla rejilla--dos">
        <Tarjeta titulo="Datos de la materia" descripcion={`Periodo actual: ${periodo}.`} className="animar-arriba">
          {formulario.exito && <Alerta tipo="exito">{formulario.exito}</Alerta>}
          {formulario.error && <Alerta tipo="error">{formulario.error.message}</Alerta>}

          <form className="formulario" onSubmit={formulario.enviar} noValidate>
            <div className="rejilla rejilla--campos">
              <Entrada
                etiqueta="Código"
                id="codigo-materia"
                requerido
                inputMode="numeric"
                placeholder="Ej.: 101105"
                ayuda="Entero mayor a 100000."
                value={formulario.valores.id}
                error={formulario.errores.id}
                onChange={(evento) => formulario.setCampo("id", evento.target.value)}
              />
              <Entrada
                etiqueta="Nombre"
                id="nombre-materia"
                requerido
                maxLength={30}
                placeholder="Ej.: Bases de Datos"
                value={formulario.valores.nombre}
                error={formulario.errores.nombre}
                onChange={(evento) => formulario.setCampo("nombre", evento.target.value)}
              />
              <Seleccion
                etiqueta="Facultad"
                id="facultad-materia"
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
              <Entrada
                etiqueta="Periodo"
                id="periodo-materia"
                requerido
                maxLength={7}
                placeholder="2026-2"
                ayuda="Formato AAAA-1 o AAAA-2."
                value={formulario.valores.periodo}
                error={formulario.errores.periodo}
                onChange={(evento) => formulario.setCampo("periodo", evento.target.value)}
              />
              <Entrada
                etiqueta="Créditos"
                id="creditos-materia"
                requerido
                inputMode="numeric"
                value={formulario.valores.creditos}
                error={formulario.errores.creditos}
                onChange={(evento) => formulario.setCampo("creditos", evento.target.value)}
              />
              <Entrada
                etiqueta="Cupos"
                id="cupos-materia"
                requerido
                inputMode="numeric"
                value={formulario.valores.cupos}
                error={formulario.errores.cupos}
                onChange={(evento) => formulario.setCampo("cupos", evento.target.value)}
              />
              <Entrada
                etiqueta="Horario"
                id="horario-materia"
                requerido
                maxLength={40}
                placeholder="Ej.: MIÉRCOLES 2:00PM-6:00PM"
                ayuda="Se almacena en mayúsculas."
                className="campo__control--ancho"
                value={formulario.valores.horario}
                error={formulario.errores.horario}
                onChange={(evento) => formulario.setCampo("horario", evento.target.value)}
              />
            </div>

            <div className="acciones-formulario">
              <Boton variante="secundario" type="button" onClick={formulario.limpiar}>
                Limpiar
              </Boton>
              <Boton type="submit" cargando={formulario.guardando}>
                Guardar materia
              </Boton>
            </div>
          </form>
        </Tarjeta>

        <aside className="panel-contexto animar-arriba">
          <Tarjeta titulo="Reglas de la oferta" className="tarjeta--suave">
            <ul className="lista-check">
              <li>Créditos entre 1 y 4; cupos entre 1 y 50.</li>
              <li>El horario admite hasta 40 caracteres y se normaliza a mayúsculas.</li>
              <li>Las materias de Humanidades e Inglés se abren a todas las facultades.</li>
              <li>Los cupos se descuentan automáticamente al matricular.</li>
            </ul>
            <div className="dato-clave">
              <span>Materias registradas</span>
              <strong>{(materias || []).length}</strong>
            </div>
          </Tarjeta>
        </aside>
      </div>

      <Tarjeta
        titulo="Oferta académica"
        descripcion="Materias de todos los periodos registrados."
        acciones={<Etiqueta>{(materias || []).length}</Etiqueta>}
        className="animar-arriba"
      >
        {error && <Alerta tipo="error">{error.message}</Alerta>}
        {cargando && !materias ? (
          <p className="texto-tenue">Cargando materias…</p>
        ) : (
          <Tabla
            columnas={[
              { clave: "codigo", titulo: "Código" },
              { clave: "nombre", titulo: "Materia" },
              { clave: "facultad", titulo: "Facultad" },
              { clave: "periodo", titulo: "Periodo" },
              { clave: "creditos", titulo: "Créditos" },
              {
                clave: "cupos",
                titulo: "Cupos",
                render: (fila) => <Etiqueta tono={fila.cupos > 0 ? "verde" : "rojo"}>{fila.cupos}</Etiqueta>
              },
              { clave: "horario", titulo: "Horario" }
            ]}
            filas={filas}
            vacio="Todavía no hay materias registradas."
          />
        )}
      </Tarjeta>
    </div>
  );
}
