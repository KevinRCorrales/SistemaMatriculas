/* =========================================================================
   LÓGICA DE LA INTERFAZ · PORTAL DE GESTIÓN UNIVERSITARIA
   -------------------------------------------------------------------------
   Este archivo no contiene datos ni URLs de backend. Toda la información
   pasa por window.Api (js/api.js), que es la pieza que se reemplaza al
   conectar el backend real.
   ========================================================================= */

(function () {
  "use strict";

  const VISTAS = {
    facultades: "Registrar facultad",
    carreras: "Registrar carrera",
    estudiantes: "Registrar estudiante",
    materias: "Registrar materia",
    matriculas: "Matricular estudiante",
    notas: "Registro de notas",
    recibos: "Recibo de matrícula"
  };

  const formateadorMoneda = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  });

  const formateadorNota = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const estado = {
    facultades: [],
    carreras: [],
    materias: [],
    estudiantes: [],
    matriculasNotas: [],
    periodoActual: "",
    solicitudMatricula: 0,
    solicitudNotas: 0,
    solicitudRecibo: 0
  };

  const MAX_OPCIONES_BUSQUEDA = 80;
  const selectsBuscables = new Map();

  const $ = (selector, contexto = document) => contexto.querySelector(selector);
  const $$ = (selector, contexto = document) => Array.from(contexto.querySelectorAll(selector));

  document.addEventListener("DOMContentLoaded", iniciar);

  /* ----------------------------- Arranque ------------------------------- */
  async function iniciar() {
    enlazarNavegacion();
    enlazarFormulariosComunes();
    enlazarFormularioFacultad();
    enlazarFormularioCarrera();
    enlazarFormularioEstudiante();
    enlazarFormularioMateria();
    enlazarFormularioMatricula();
    enlazarFormularioNotas();
    enlazarFormularioRecibo();
    inicializarSelectsBuscables();

    mostrarVistaActual(false);
    await cargarCatalogos();
  }

  async function cargarCatalogos() {
    try {
      const [facultades, carreras, materias, estudiantes] = await Promise.all([
        window.Api.listarFacultades(),
        window.Api.listarCarreras(),
        window.Api.listarMaterias(),
        window.Api.listarEstudiantes()
      ]);

      estado.facultades = facultades;
      estado.carreras = carreras;
      estado.materias = materias;
      estado.estudiantes = estudiantes;
      estado.periodoActual = window.Api.obtenerPeriodoActual();

      $("#periodo-actual").textContent = estado.periodoActual;
      $("#matricula-periodo-acciones").textContent = estado.periodoActual;

      poblarFacultades();
      poblarCarreras();
      poblarSelectsEstudiantes();
      actualizarContadores();
      actualizarFacultadCarrera();
      prepararFormularioMateria();
      refrescarSelectsBuscables();
    } catch (error) {
      mostrarAlerta(
        $("#alerta-global"),
        error.message || "No se pudieron cargar los datos iniciales. Recarga la página o contacta a soporte.",
        "error"
      );
    }
  }

  /* --------------------------- Navegación ------------------------------- */
  function enlazarNavegacion() {
    window.addEventListener("hashchange", () => mostrarVistaActual(true));
  }

  function vistaDesdeHash() {
    const vista = window.location.hash.replace(/^#/, "");
    return Object.prototype.hasOwnProperty.call(VISTAS, vista) ? vista : "estudiantes";
  }

  function mostrarVistaActual(enfocar) {
    const vista = vistaDesdeHash();

    $$(".vista").forEach((seccion) => {
      seccion.hidden = seccion.dataset.vista !== vista;
    });

    $$(".nav-enlace").forEach((enlace) => {
      const activo = enlace.getAttribute("href") === `#${vista}`;
      enlace.classList.toggle("activo", activo);
      if (activo) {
        enlace.setAttribute("aria-current", "page");
      } else {
        enlace.removeAttribute("aria-current");
      }
    });

    document.title = `${VISTAS[vista]} · Universidad Cooperativa de Colombia`;

    if (enfocar) {
      window.scrollTo({ top: 0, behavior: "auto" });
      const titulo = document.getElementById(`titulo-${vista}`);
      if (titulo) {
        titulo.setAttribute("tabindex", "-1");
        titulo.focus({ preventScroll: true });
      }
    }
  }

  /* ------------------------- Utilidades de UI --------------------------- */
  function escaparHtml(valor) {
    const reemplazos = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return String(valor ?? "").replace(/[&<>"']/g, (caracter) => reemplazos[caracter]);
  }

  function nuevaOpcion(valor, texto) {
    const opcion = document.createElement("option");
    opcion.value = String(valor);
    opcion.textContent = texto;
    return opcion;
  }

  function nombreCompleto(estudiante) {
    return `${estudiante.nombres} ${estudiante.apellidos}`.trim();
  }

  function iniciales(estudiante) {
    return `${(estudiante.nombres || " ").charAt(0)}${(estudiante.apellidos || " ").charAt(0)}`.toUpperCase();
  }

  function formatearFecha(iso) {
    if (!iso) {
      return "—";
    }
    const partes = String(iso).split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : iso;
  }

  function mostrarAlerta(elemento, mensaje, tipo) {
    if (!elemento) {
      return;
    }
    elemento.className = `alerta alerta--${tipo}`;
    elemento.textContent = mensaje;
    elemento.hidden = false;
  }

  function ocultarAlerta(elemento) {
    if (!elemento) {
      return;
    }
    elemento.hidden = true;
    elemento.textContent = "";
  }

  function anunciarExito(elemento, mensaje) {
    mostrarAlerta(elemento, mensaje, "exito");
    elemento.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function limpiarErrores(form) {
    $$(".mensaje-error", form).forEach((mensaje) => {
      mensaje.textContent = "";
      mensaje.hidden = true;
    });
    $$(".campo--error", form).forEach((campo) => campo.classList.remove("campo--error"));
    $$('[aria-invalid="true"]', form).forEach((control) => control.removeAttribute("aria-invalid"));

    const resumen = $(".alerta--error", form);
    if (resumen) {
      resumen.hidden = true;
      resumen.textContent = "";
    }
  }

  function limpiarErrorCampo(form, nombreCampo) {
    const contenedor = form.querySelector(`[data-campo="${nombreCampo}"]`);
    if (!contenedor) {
      return;
    }

    contenedor.classList.remove("campo--error");
    const mensaje = $(".mensaje-error", contenedor);
    if (mensaje) {
      mensaje.textContent = "";
      mensaje.hidden = true;
    }
    $$('[aria-invalid="true"]', contenedor).forEach((control) => {
      control.removeAttribute("aria-invalid");
    });

    const resumen = $(".alerta--error", form);
    if (resumen && !$(".campo--error", form)) {
      resumen.hidden = true;
      resumen.textContent = "";
    }
  }

  function mostrarErrores(form, errores) {
    limpiarErrores(form);

    const nombres = Object.keys(errores);
    nombres.forEach((nombre) => {
      const contenedor = form.querySelector(`[data-campo="${nombre}"]`);
      if (!contenedor) {
        return;
      }

      const mensaje = $(".mensaje-error", contenedor);
      if (mensaje) {
        mensaje.textContent = errores[nombre];
        mensaje.hidden = false;
      }
      contenedor.classList.add("campo--error");

      const control = contenedor.querySelector("input, select, textarea");
      if (control) {
        control.setAttribute("aria-invalid", "true");
      }
    });

    const resumen = $(".alerta--error", form);
    if (resumen) {
      resumen.textContent =
        nombres.length === 1
          ? "Hay un dato por corregir. Revisa el campo marcado."
          : "Hay varios datos por corregir. Revisa los campos marcados.";
      resumen.hidden = false;
    }

    const primerContenedor = $(".campo--error", form);
    if (primerContenedor) {
      const foco = primerContenedor.querySelector("input, select, textarea") || primerContenedor;
      foco.focus({ preventScroll: true });
      primerContenedor.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function mostrarErrorServidor(form, error) {
    const resumen = $(".alerta--error", form);

    if (error.campo) {
      const contenedor = form.querySelector(`[data-campo="${error.campo}"]`);
      if (contenedor) {
        mostrarErrores(form, { [error.campo]: error.message });
        return;
      }
    }

    mostrarAlerta(resumen, error.message || "No se pudo completar la operación. Inténtalo de nuevo.", "error");
    if (resumen) {
      resumen.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function alternarCargando(boton, cargando, textoCargando = "Guardando…") {
    if (!boton) {
      return;
    }

    if (cargando) {
      boton.dataset.textoOriginal = boton.textContent.trim();
      boton.textContent = textoCargando;
      boton.disabled = true;
      boton.setAttribute("aria-busy", "true");
    } else {
      boton.textContent = boton.dataset.textoOriginal || boton.textContent;
      boton.removeAttribute("aria-busy");
      boton.disabled = false;
    }
  }

  function actualizarContadores() {
    $("#contador-facultades").textContent = estado.facultades.length;
    $("#contador-carreras").textContent = estado.carreras.length;
    $("#contador-estudiantes").textContent = estado.estudiantes.length;
    $("#contador-materias").textContent = estado.materias.length;
  }

  function poblarFacultades() {
    ["facultad-materia", "facultad-para-carrera"].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) {
        return;
      }

      const valorAnterior = select.value;
      select.innerHTML = "";
      select.appendChild(nuevaOpcion("", "Selecciona una facultad"));

      estado.facultades.forEach((facultad) => {
        select.appendChild(nuevaOpcion(facultad.id, facultad.nombre));
      });

      if (valorAnterior && estado.facultades.some((facultad) => String(facultad.id) === valorAnterior)) {
        select.value = valorAnterior;
      }
    });
  }

  function poblarCarreras() {
    const select = $("#carrera-estudiante");
    const valorAnterior = select.value;
    select.innerHTML = "";
    select.appendChild(nuevaOpcion("", "Selecciona una carrera"));

    estado.facultades.forEach((facultad) => {
      const carrerasFacultad = estado.carreras
        .filter((carrera) => Number(carrera.idFacultad) === Number(facultad.id))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

      if (!carrerasFacultad.length) {
        return;
      }

      const grupo = document.createElement("optgroup");
      grupo.label = facultad.nombre;
      carrerasFacultad.forEach((carrera) => {
        grupo.appendChild(nuevaOpcion(carrera.id, carrera.nombre));
      });
      select.appendChild(grupo);
    });

    if (valorAnterior && estado.carreras.some((carrera) => String(carrera.id) === valorAnterior)) {
      select.value = valorAnterior;
    }
  }

  function poblarSelectsEstudiantes() {
    const idsSelects = ["matricula-estudiante", "notas-estudiante", "recibo-estudiante"];
    const ordenados = [...estado.estudiantes].sort((a, b) => {
      return `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, "es");
    });

    idsSelects.forEach((id) => {
      const select = document.getElementById(id);
      if (!select) {
        return;
      }

      const valorAnterior = select.value;
      select.innerHTML = "";
      select.appendChild(nuevaOpcion("", "Selecciona un estudiante"));

      ordenados.forEach((estudiante) => {
        select.appendChild(
          nuevaOpcion(
            estudiante.identificacion,
            `${nombreCompleto(estudiante)} — Doc. ${estudiante.identificacion}`
          )
        );
      });

      if (valorAnterior && ordenados.some((estudiante) => String(estudiante.identificacion) === valorAnterior)) {
        select.value = valorAnterior;
      }
    });
  }

  function actualizarFacultadCarrera() {
    const idCarrera = $("#carrera-estudiante").value;
    const carrera = estado.carreras.find((item) => String(item.id) === String(idCarrera));
    const facultad = carrera
      ? estado.facultades.find((item) => Number(item.id) === Number(carrera.idFacultad))
      : null;
    const valor = $("#facultad-carrera");

    valor.textContent = facultad
      ? facultad.nombre
      : "Selecciona una carrera para conocer la facultad.";
    valor.classList.toggle("valor-derivado--vacio", !facultad);
  }

  function prepararFormularioMateria() {
    const periodo = $("#periodo-materia");
    if (periodo && !periodo.value) {
      periodo.value = estado.periodoActual;
    }
  }

  /* ------------------- Selects con búsqueda integrada ------------------- */
  /*
   * Convierte cada <select data-buscable> en un combobox que permite escribir
   * el nombre, el documento o el ID. El <select> original se conserva oculto
   * como fuente de verdad, de modo que el resto de la lógica no cambia.
   */
  function normalizarBusqueda(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function inicializarSelectsBuscables() {
    $$("select[data-buscable]").forEach((select) => {
      if (!select.id || select.dataset.buscableIniciado === "true") {
        return;
      }
      select.dataset.buscableIniciado = "true";

      const contenedor = document.createElement("div");
      contenedor.className = "select-buscable";
      select.parentNode.insertBefore(contenedor, select);

      const entrada = document.createElement("input");
      entrada.type = "text";
      entrada.className = "select-buscable__entrada";
      entrada.id = `${select.id}-busqueda`;
      entrada.autocomplete = "off";
      entrada.spellcheck = false;
      entrada.setAttribute("role", "combobox");
      entrada.setAttribute("aria-autocomplete", "list");
      entrada.setAttribute("aria-expanded", "false");
      entrada.setAttribute("aria-haspopup", "listbox");
      entrada.setAttribute("aria-controls", `${select.id}-opciones`);
      entrada.required = select.required;

      if (select.required) {
        entrada.setAttribute("aria-required", "true");
      }

      const descrito = select.getAttribute("aria-describedby");
      if (descrito) {
        entrada.setAttribute("aria-describedby", descrito);
      }

      const etiqueta = document.querySelector(`label[for="${select.id}"]`);
      if (etiqueta) {
        etiqueta.htmlFor = entrada.id;
      }

      const flecha = document.createElement("span");
      flecha.className = "select-buscable__flecha";
      flecha.setAttribute("aria-hidden", "true");

      const lista = document.createElement("div");
      lista.className = "select-buscable__lista";
      lista.id = `${select.id}-opciones`;
      lista.setAttribute("role", "listbox");
      lista.setAttribute("aria-label", etiqueta ? etiqueta.textContent.trim() : "Opciones");
      lista.hidden = true;

      contenedor.appendChild(entrada);
      contenedor.appendChild(flecha);
      contenedor.appendChild(lista);
      contenedor.appendChild(select);

      select.classList.add("select-buscable__nativo");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");

      const instancia = {
        select,
        entrada,
        lista,
        contenedor,
        abierta: false,
        activa: -1,
        opciones: []
      };

      function opcionesDisponibles() {
        return Array.from(select.options).filter((opcion) => opcion.value !== "");
      }

      function opcionSeleccionada() {
        return select.value ? select.selectedOptions[0] || null : null;
      }

      function actualizarPlaceholder() {
        const primera = Array.from(select.options).find((opcion) => opcion.value === "");
        const placeholder = instancia.entrada.dataset.placeholder ||
          select.dataset.buscablePlaceholder ||
          (primera ? primera.textContent.trim() : "Busca o selecciona una opción");

        instancia.entrada.placeholder = select.disabled
          ? (primera ? primera.textContent.trim() : "No disponible")
          : placeholder;
      }

      function sincronizar() {
        instancia.entrada.disabled = select.disabled;
        actualizarPlaceholder();

        if (select.disabled) {
          cerrar(false);
        }

        if (!instancia.abierta) {
          const seleccionada = opcionSeleccionada();
          instancia.entrada.value = seleccionada ? seleccionada.textContent.trim() : "";
        }
      }

      function ordenarOpciones(consulta) {
        const q = normalizarBusqueda(consulta);
        const opciones = opcionesDisponibles();

        return opciones
          .map((opcion, orden) => {
            const texto = normalizarBusqueda(opcion.textContent);
            const valor = normalizarBusqueda(opcion.value);
            let puntaje = 0;

            if (q) {
              if (valor === q || texto === q) {
                puntaje = 0;
              } else if (valor.startsWith(q)) {
                puntaje = 1;
              } else if (texto.startsWith(q)) {
                puntaje = 2;
              } else if (texto.split(/[\s·—,-]+/).some((palabra) => palabra.startsWith(q))) {
                puntaje = 3;
              } else if (valor.includes(q) || texto.includes(q)) {
                puntaje = 4;
              } else {
                return null;
              }
            }

            return { opcion, puntaje, orden };
          })
          .filter(Boolean)
          .sort((a, b) => (q ? a.puntaje - b.puntaje : 0) || a.orden - b.orden)
          .map((resultado) => resultado.opcion);
      }

      function marcarActiva(indice) {
        const nodos = $$(".select-buscable__opcion", lista);
        nodos.forEach((nodo) => {
          nodo.classList.remove("select-buscable__opcion--activa");
          nodo.removeAttribute("aria-selected");
        });

        instancia.activa = indice;

        if (indice < 0 || !nodos[indice]) {
          entrada.removeAttribute("aria-activedescendant");
          return;
        }

        nodos[indice].classList.add("select-buscable__opcion--activa");
        entrada.setAttribute("aria-activedescendant", nodos[indice].id);
        nodos[indice].scrollIntoView({ block: "nearest" });
      }

      function renderizarLista(consulta) {
        const coincidencias = ordenarOpciones(consulta);
        const visibles = coincidencias.slice(0, MAX_OPCIONES_BUSQUEDA);
        instancia.opciones = visibles;
        instancia.activa = -1;
        lista.innerHTML = "";

        if (!visibles.length) {
          const vacio = document.createElement("p");
          vacio.className = "select-buscable__vacio";
          vacio.textContent = "No hay coincidencias. Prueba con otro nombre, documento o ID.";
          lista.appendChild(vacio);
          entrada.removeAttribute("aria-activedescendant");
          return;
        }

        const fragmento = document.createDocumentFragment();
        visibles.forEach((opcion, indice) => {
          const texto = opcion.textContent.trim();
          const nodo = document.createElement("div");
          nodo.className = "select-buscable__opcion";
          nodo.id = `${entrada.id}-opcion-${indice}`;
          nodo.setAttribute("role", "option");
          nodo.dataset.indice = String(indice);

          if (opcion.selected) {
            nodo.setAttribute("aria-selected", "true");
          }

          const textoSpan = document.createElement("span");
          textoSpan.className = "select-buscable__opcion-texto";
          textoSpan.textContent = texto;
          nodo.appendChild(textoSpan);

          const agregarCodigo = !normalizarBusqueda(texto).includes(normalizarBusqueda(opcion.value));
          if (agregarCodigo) {
            const codigo = document.createElement("span");
            codigo.className = "select-buscable__opcion-codigo";
            codigo.textContent = `ID ${opcion.value}`;
            nodo.appendChild(codigo);
          }

          fragmento.appendChild(nodo);
        });
        lista.appendChild(fragmento);

        const pie = document.createElement("p");
        pie.className = "select-buscable__pie";
        pie.textContent = coincidencias.length > MAX_OPCIONES_BUSQUEDA
          ? `Mostrando ${MAX_OPCIONES_BUSQUEDA} de ${coincidencias.length} resultados. Escribe para afinar la búsqueda.`
          : "Usa ↑ ↓ y Enter para elegir.";
        lista.appendChild(pie);
      }

      function abrir() {
        if (select.disabled || instancia.abierta) {
          return;
        }

        instancia.abierta = true;
        lista.hidden = false;
        entrada.setAttribute("aria-expanded", "true");
        renderizarLista("");

        const seleccionada = opcionSeleccionada();
        if (seleccionada) {
          const indice = instancia.opciones.indexOf(seleccionada);
          marcarActiva(indice);
        }
      }

      function cerrar(restaurar) {
        if (!instancia.abierta) {
          return;
        }

        instancia.abierta = false;
        lista.hidden = true;
        entrada.setAttribute("aria-expanded", "false");
        entrada.removeAttribute("aria-activedescendant");
        instancia.activa = -1;

        if (restaurar !== false) {
          const seleccionada = opcionSeleccionada();
          entrada.value = seleccionada ? seleccionada.textContent.trim() : "";
        }
      }

      function elegirOpcion(opcion) {
        if (!opcion) {
          return;
        }

        select.value = opcion.value;
        entrada.value = opcion.textContent.trim();
        cerrar(false);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }

      function elegirPrimeraCoincidencia(consulta) {
        const coincidencias = ordenarOpciones(consulta);
        if (coincidencias.length === 1) {
          elegirOpcion(coincidencias[0]);
          return true;
        }
        return false;
      }

      entrada.addEventListener("focus", () => {
        if (select.disabled) {
          return;
        }
        entrada.select();
        abrir();
      });

      entrada.addEventListener("input", () => {
        abrir();

        const seleccionada = opcionSeleccionada();
        if (seleccionada && entrada.value !== seleccionada.textContent.trim()) {
          select.value = "";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }

        renderizarLista(entrada.value);
      });

      entrada.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
          evento.preventDefault();
          cerrar(true);
          return;
        }

        if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
          evento.preventDefault();
          if (!instancia.abierta) {
            abrir();
          }
          if (!instancia.opciones.length) {
            return;
          }

          const paso = evento.key === "ArrowDown" ? 1 : -1;
          const inicio = instancia.activa < 0
            ? (paso === 1 ? 0 : instancia.opciones.length - 1)
            : instancia.activa + paso;
          const indice = Math.max(0, Math.min(inicio, instancia.opciones.length - 1));
          marcarActiva(indice);
          return;
        }

        if (evento.key === "Home" && instancia.abierta) {
          evento.preventDefault();
          marcarActiva(0);
          return;
        }

        if (evento.key === "End" && instancia.abierta) {
          evento.preventDefault();
          marcarActiva(instancia.opciones.length - 1);
          return;
        }

        if (evento.key === "Enter") {
          if (!instancia.abierta) {
            return;
          }

          evento.preventDefault();
          const consulta = entrada.value.trim();
          const exacta = instancia.opciones.find((opcion) => {
            return normalizarBusqueda(opcion.value) === normalizarBusqueda(consulta) ||
              normalizarBusqueda(opcion.textContent) === normalizarBusqueda(consulta);
          });

          if (instancia.activa >= 0 && instancia.opciones[instancia.activa]) {
            elegirOpcion(instancia.opciones[instancia.activa]);
          } else if (exacta) {
            elegirOpcion(exacta);
          } else {
            elegirPrimeraCoincidencia(consulta);
          }
        }
      });

      entrada.addEventListener("blur", () => {
        window.setTimeout(() => {
          if (contenedor.contains(document.activeElement)) {
            return;
          }

          const consulta = entrada.value.trim();
          const estabaAbierta = instancia.abierta;

          if (estabaAbierta) {
            cerrar(false);
          }

          if (opcionSeleccionada()) {
            sincronizar();
            return;
          }

          if (!consulta) {
            entrada.value = "";
            return;
          }

          const coincidencia = ordenarOpciones(consulta).find((opcion) => {
            return normalizarBusqueda(opcion.value) === normalizarBusqueda(consulta) ||
              normalizarBusqueda(opcion.textContent) === normalizarBusqueda(consulta);
          });

          if (coincidencia) {
            elegirOpcion(coincidencia);
          } else {
            entrada.value = "";
          }
        }, 140);
      });

      lista.addEventListener("mousedown", (evento) => evento.preventDefault());
      lista.addEventListener("click", (evento) => {
        const nodo = evento.target.closest(".select-buscable__opcion");
        if (!nodo) {
          return;
        }
        const indice = Number(nodo.dataset.indice);
        elegirOpcion(instancia.opciones[indice]);
      });

      select.addEventListener("change", sincronizar);
      new MutationObserver(() => {
        if (select.disabled && instancia.abierta) {
          cerrar(false);
        }
        sincronizar();
        if (instancia.abierta) {
          renderizarLista(entrada.value);
        }
      }).observe(select, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["disabled"]
      });

      const form = select.closest("form");
      if (form) {
        form.addEventListener("reset", () => {
          window.setTimeout(() => {
            cerrar(false);
            sincronizar();
          }, 0);
        });
      }

      instancia.sincronizar = sincronizar;
      selectsBuscables.set(select.id, instancia);
      sincronizar();
    });
  }

  function refrescarSelectsBuscables() {
    selectsBuscables.forEach((instancia) => instancia.sincronizar());
  }

  /* --------------------- Comportamiento general ------------------------- */
  function enlazarFormulariosComunes() {
    $$("form").forEach((form) => {
      form.addEventListener("input", (evento) => {
        if (evento.target.name) {
          limpiarErrorCampo(form, evento.target.name);
        }
      });
      form.addEventListener("change", (evento) => {
        if (evento.target.name) {
          limpiarErrorCampo(form, evento.target.name);
        }
      });
    });

    $$("[data-limpiar]").forEach((boton) => {
      boton.addEventListener("click", () => {
        const form = document.getElementById(boton.dataset.limpiar);
        if (form) {
          limpiarFormulario(form);
        }
      });
    });
  }

  function limpiarFormulario(form) {
    form.reset();
    limpiarErrores(form);
    $$(".alerta", form).forEach(ocultarAlerta);

    if (form.id === "form-estudiante") {
      actualizarFacultadCarrera();
    }

    if (form.id === "form-materia") {
      prepararFormularioMateria();
    }

    if (form.id === "form-notas") {
      reiniciarFormularioNotas();
    }

    refrescarSelectsBuscables();

    const primerCampo = form.querySelector(
      'input:not([type="hidden"]):not(:disabled), select:not(:disabled)'
    );
    if (primerCampo) {
      primerCampo.focus();
    }
  }

  /* ---------------------- Módulo 1: facultad ---------------------------- */
  function enlazarFormularioFacultad() {
    $("#form-facultad").addEventListener("submit", guardarFacultad);
  }

  async function guardarFacultad(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const boton = $("#btn-guardar-facultad");
    const exito = $("#exito-facultad");
    ocultarAlerta(exito);

    const datos = {
      nombre: form.elements.nombre.value.trim()
    };

    const errores = window.Validaciones.validarFacultad(datos);
    if (Object.keys(errores).length) {
      mostrarErrores(form, errores);
      return;
    }

    alternarCargando(boton, true, "Guardando…");
    try {
      const facultad = await window.Api.crearFacultad(datos);

      estado.facultades.push(facultad);
      estado.facultades.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      poblarFacultades();
      poblarCarreras();
      actualizarContadores();
      refrescarSelectsBuscables();

      form.reset();
      anunciarExito(
        exito,
        `La facultad ${facultad.nombre} quedó registrada con el ID ${facultad.id}. Ya está disponible para carreras y materias.`
      );
      form.elements.nombre.focus();
    } catch (error) {
      mostrarErrorServidor(form, error);
    } finally {
      alternarCargando(boton, false);
    }
  }

  /* ---------------------- Módulo 2: carrera ----------------------------- */
  function enlazarFormularioCarrera() {
    $("#form-carrera").addEventListener("submit", guardarCarrera);
  }

  async function guardarCarrera(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const boton = $("#btn-guardar-carrera");
    const exito = $("#exito-carrera");
    ocultarAlerta(exito);

    const datos = {
      nombre: form.elements.nombre.value.trim(),
      idFacultad: form.elements.idFacultad.value
    };

    const errores = window.Validaciones.validarCarrera(datos);
    if (Object.keys(errores).length) {
      mostrarErrores(form, errores);
      return;
    }

    alternarCargando(boton, true, "Guardando…");
    try {
      const carrera = await window.Api.crearCarrera({
        nombre: datos.nombre,
        idFacultad: Number(datos.idFacultad)
      });

      estado.carreras.push(carrera);
      estado.carreras.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      poblarCarreras();
      actualizarContadores();

      const facultad = estado.facultades.find(
        (item) => Number(item.id) === Number(carrera.idFacultad)
      );

      form.reset();
      anunciarExito(
        exito,
        `La carrera ${carrera.nombre} quedó asociada a la facultad ${facultad ? facultad.nombre : "seleccionada"}. Ya está disponible al registrar estudiantes.`
      );
      form.elements.nombre.focus();
    } catch (error) {
      mostrarErrorServidor(form, error);
    } finally {
      alternarCargando(boton, false);
    }
  }

  /* ---------------------- Módulo 3: estudiante -------------------------- */
  function enlazarFormularioEstudiante() {
    $("#carrera-estudiante").addEventListener("change", actualizarFacultadCarrera);
    $("#form-estudiante").addEventListener("submit", guardarEstudiante);
  }

  async function guardarEstudiante(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const boton = $("#btn-guardar-estudiante");
    const exito = $("#exito-estudiante");
    ocultarAlerta(exito);

    const datos = {
      documento: form.elements.documento.value.trim(),
      nombres: form.elements.nombres.value.trim(),
      apellidos: form.elements.apellidos.value.trim(),
      correo: form.elements.correo.value.trim(),
      telefono: form.elements.telefono.value.trim(),
      idCarrera: form.elements.idCarrera.value
    };

    const errores = window.Validaciones.validarEstudiante(datos);
    if (Object.keys(errores).length) {
      mostrarErrores(form, errores);
      return;
    }

    alternarCargando(boton, true, "Guardando…");
    try {
      const estudiante = await window.Api.crearEstudiante({
        ...datos,
        idCarrera: Number(datos.idCarrera)
      });

      estado.estudiantes.push(estudiante);
      poblarSelectsEstudiantes();
      actualizarContadores();

      form.reset();
      actualizarFacultadCarrera();

      anunciarExito(
        exito,
        `${nombreCompleto(estudiante)} quedó registrado con el documento ${estudiante.identificacion}. Ya está disponible para matrícula, notas y recibos.`
      );
      form.elements.documento.focus();
    } catch (error) {
      mostrarErrorServidor(form, error);
    } finally {
      alternarCargando(boton, false);
    }
  }

  /* ------------------------ Módulo 4: materia --------------------------- */
  function enlazarFormularioMateria() {
    $("#form-materia").addEventListener("submit", guardarMateria);
  }

  async function guardarMateria(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const boton = $("#btn-guardar-materia");
    const exito = $("#exito-materia");
    ocultarAlerta(exito);

    const datos = {
      id: form.elements.id.value.trim(),
      nombre: form.elements.nombre.value.trim(),
      creditos: form.elements.creditos.value.trim(),
      idFacultad: form.elements.idFacultad.value,
      periodo: form.elements.periodo.value.trim(),
      cupos: form.elements.cupos.value.trim(),
      horario: form.elements.horario.value.trim()
    };

    const errores = window.Validaciones.validarMateria(datos);
    if (Object.keys(errores).length) {
      mostrarErrores(form, errores);
      return;
    }

    alternarCargando(boton, true, "Guardando…");
    try {
      const materia = await window.Api.crearMateria({
        id: Number(datos.id),
        nombre: datos.nombre,
        creditos: Number(datos.creditos),
        idFacultad: Number(datos.idFacultad),
        periodo: datos.periodo,
        cupos: Number(datos.cupos),
        horario: datos.horario
      });

      estado.materias.push(materia);
      estado.materias.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      actualizarContadores();

      const facultad = estado.facultades.find((item) => Number(item.id) === Number(materia.idFacultad));

      form.reset();
      prepararFormularioMateria();
      anunciarExito(
        exito,
        `La materia ${materia.nombre} (código ${materia.id}) se registró para el periodo ${materia.periodo}, en la facultad de ${facultad ? facultad.nombre : "la facultad seleccionada"}, con ${materia.cupos} cupos y horario ${materia.horario}.`
      );
      form.elements.nombre.focus();
    } catch (error) {
      mostrarErrorServidor(form, error);
    } finally {
      alternarCargando(boton, false);
    }
  }

  /* ----------------------- Módulo 5: matrícula -------------------------- */
  function enlazarFormularioMatricula() {
    $("#matricula-estudiante").addEventListener("change", manejarCambioEstudianteMatricula);
    $("#matricula-materias").addEventListener("change", (evento) => {
      if (evento.target.name === "materias") {
        actualizarResumenMatricula();
      }
    });
    $("#form-matricula").addEventListener("submit", guardarMatricula);
  }

  async function manejarCambioEstudianteMatricula() {
    const identificacion = $("#matricula-estudiante").value;
    const contexto = $("#matricula-contexto");
    const contenedorMaterias = $("#matricula-materias-contenedor");
    const sinEstudiante = $("#matricula-sin-estudiante");
    const form = $("#form-matricula");

    ocultarAlerta($("#exito-matricula"));
    ocultarAlerta($("#error-matricula"));
    limpiarErrores(form);

    estado.solicitudMatricula += 1;

    if (!identificacion) {
      contexto.hidden = true;
      contenedorMaterias.hidden = true;
      sinEstudiante.hidden = false;
      $("#matricula-materias").innerHTML = "";
      actualizarResumenMatricula();
      return;
    }

    const estudiante = estado.estudiantes.find(
      (item) => String(item.identificacion) === String(identificacion)
    );
    if (!estudiante) {
      mostrarAlerta($("#error-matricula"), "No se encontró el estudiante seleccionado.", "error");
      return;
    }

    const carrera = estado.carreras.find((item) => Number(item.id) === Number(estudiante.idCarrera));
    const facultad = carrera
      ? estado.facultades.find((item) => Number(item.id) === Number(carrera.idFacultad))
      : null;

    $("#matricula-iniciales").textContent = iniciales(estudiante);
    $("#matricula-nombre").textContent = nombreCompleto(estudiante);
    $("#matricula-documento").textContent = `Documento ${estudiante.identificacion}`;
    $("#matricula-carrera").textContent = carrera ? carrera.nombre : "Carrera no disponible";
    $("#matricula-facultad").textContent = facultad ? facultad.nombre : "Facultad no disponible";
    $("#matricula-periodo").textContent = estado.periodoActual;

    contexto.hidden = false;
    sinEstudiante.hidden = true;
    contenedorMaterias.hidden = false;
    $("#matricula-materias").innerHTML = '<p class="estado-vacio">Consultando las materias disponibles…</p>';

    await cargarMateriasMatricula(estudiante, carrera, facultad);
  }

  async function cargarMateriasMatricula(estudiante, carrera, facultad) {
    const token = ++estado.solicitudMatricula;
    const contenedor = $("#matricula-materias");

    try {
      const [disponibles, matriculadas] = await Promise.all([
        window.Api.listarMateriasParaEstudiante(estudiante.identificacion, estado.periodoActual),
        window.Api.listarMatriculas({
          identificacion: estudiante.identificacion,
          periodo: estado.periodoActual
        })
      ]);

      if (token !== estado.solicitudMatricula) {
        return;
      }

      renderizarMateriasMatricula(disponibles, matriculadas, carrera, facultad);
    } catch (error) {
      if (token !== estado.solicitudMatricula) {
        return;
      }
      contenedor.innerHTML = "";
      $("#matricula-materias-contenedor").hidden = true;
      mostrarAlerta($("#error-matricula"), error.message || "No se pudieron cargar las materias.", "error");
    }
  }

  function renderizarMateriasMatricula(materiasDisponibles, matriculasPeriodo, carrera, facultad) {
    const idsMatriculadas = new Set(
      matriculasPeriodo.map((matricula) => Number(matricula.codMateria))
    );

    const deLaFacultad = materiasDisponibles.filter((materia) => {
      return Number(materia.idFacultad) === Number(carrera ? carrera.idFacultad : -1);
    });
    const deServicio = materiasDisponibles.filter((materia) => {
      return (
        materia.esServicioGeneral &&
        Number(materia.idFacultad) !== Number(carrera ? carrera.idFacultad : -1)
      );
    });

    const bloques = [];

    if (deLaFacultad.length) {
      bloques.push(
        plantillaGrupoMaterias(
          `Materias de ${facultad ? facultad.nombre : "tu facultad"}`,
          `Ofertas registradas para el periodo ${estado.periodoActual}. Corresponden a la facultad de la carrera del estudiante.`,
          deLaFacultad,
          idsMatriculadas
        )
      );
    }

    if (deServicio.length) {
      bloques.push(
        plantillaGrupoMaterias(
          "Materias de servicio general",
          "Disponibles para todas las carreras (Humanidades e Inglés).",
          deServicio,
          idsMatriculadas
        )
      );
    }

    $("#matricula-materias").innerHTML = bloques.length
      ? bloques.join("")
      : `<p class="estado-vacio">La facultad de este estudiante aún no tiene materias registradas. Puedes crear una en el módulo “Registrar materia”.</p>`;

    actualizarResumenMatricula();
  }

  function plantillaGrupoMaterias(titulo, descripcion, materias, idsMatriculadas) {
    return `
      <section class="materias-grupo" aria-label="${escaparHtml(titulo)}">
        <div class="materias-grupo__encabezado">
          <h4>${escaparHtml(titulo)}</h4>
          <p>${escaparHtml(descripcion)}</p>
        </div>
        <div class="materias-lista">
          ${materias
            .map((materia) => plantillaMateriaOpcion(materia, idsMatriculadas.has(Number(materia.id))))
            .join("")}
        </div>
      </section>
    `;
  }

  function plantillaMateriaOpcion(materia, yaMatriculada) {
    const idCheckbox = `materia-${materia.id}`;
    return `
      <label class="materia-opcion${yaMatriculada ? " materia-opcion--inscrita" : ""}" for="${idCheckbox}">
        <input
          type="checkbox"
          id="${idCheckbox}"
          name="materias"
          value="${escaparHtml(materia.id)}"
          data-creditos="${escaparHtml(materia.creditos)}"
          data-nombre="${escaparHtml(materia.nombre)}"
          data-horario="${escaparHtml(materia.horario)}"
          ${yaMatriculada ? "disabled checked" : ""}
        >
        <span class="materia-opcion__contenido">
          <span class="materia-opcion__nombre">${escaparHtml(materia.nombre)}</span>
          <span class="materia-opcion__meta">${escaparHtml(materia.creditos)} créditos · Código ${escaparHtml(materia.id)}</span>
          <span class="materia-opcion__meta">Periodo ${escaparHtml(materia.periodo)} · ${escaparHtml(materia.cupos)} cupos</span>
          <span class="materia-opcion__meta">Horario ${escaparHtml(materia.horario)}</span>
        </span>
        ${yaMatriculada ? '<span class="etiqueta etiqueta--inscrita">Ya matriculada</span>' : ""}
      </label>
    `;
  }

  function actualizarResumenMatricula() {
    const form = $("#form-matricula");
    if (!form) {
      return;
    }

    const seleccionadas = $$('input[name="materias"]:checked:not(:disabled)', form);
    const totalCreditos = seleccionadas.reduce(
      (total, input) => total + Number(input.dataset.creditos || 0),
      0
    );

    $("#matricula-cantidad").textContent = seleccionadas.length;
    $("#matricula-creditos").textContent = totalCreditos;

    const barra = $("#matricula-barra");
    const barraContenedor = barra.parentElement;
    barra.style.width = `${Math.min((totalCreditos / 16) * 100, 100)}%`;
    barraContenedor.classList.toggle("barra-creditos--excedida", totalCreditos > 16);

    const rango = $("#matricula-rango");
    let mensajeRango = "Selecciona entre 2 y 16 créditos.";

    if (totalCreditos > 0 && totalCreditos < 2) {
      mensajeRango = `Faltan ${2 - totalCreditos} crédito(s) para llegar al mínimo de 2.`;
    } else if (totalCreditos > 16) {
      mensajeRango = `Excedes el máximo en ${totalCreditos - 16} crédito(s). Ajusta tu selección.`;
    } else if (totalCreditos >= 2) {
      mensajeRango = "Cumples el rango de créditos permitido.";
    }

    rango.textContent = mensajeRango;
    rango.classList.toggle("resumen-matricula__rango--error", totalCreditos > 0 && (totalCreditos < 2 || totalCreditos > 16));

    $("#matricula-lista-seleccion").innerHTML = seleccionadas
      .map((input) => {
        return `<li>${escaparHtml(input.dataset.nombre)} <span>${escaparHtml(input.dataset.creditos)} cr.</span></li>`;
      })
      .join("");

    $("#btn-matricular").disabled = seleccionadas.length === 0;
  }

  async function guardarMatricula(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const boton = $("#btn-matricular");
    const exito = $("#exito-matricula");
    const identificacion = $("#matricula-estudiante").value;
    const seleccionadas = $$('input[name="materias"]:checked:not(:disabled)', form);
    const codigosMaterias = seleccionadas.map((input) => Number(input.value));
    const totalCreditos = seleccionadas.reduce(
      (total, input) => total + Number(input.dataset.creditos || 0),
      0
    );

    ocultarAlerta(exito);

    const materiasConHorario = $$('#form-matricula input[name="materias"]:checked', form).map((input) => ({
      nombre: input.dataset.nombre,
      horario: input.dataset.horario
    }));

    const errores = window.Validaciones.validarMatricula({
      identificacion,
      codigosMaterias,
      totalCreditos,
      materias: materiasConHorario
    });

    if (Object.keys(errores).length) {
      mostrarErrores(form, errores);
      return;
    }

    const estudiante = estado.estudiantes.find(
      (item) => String(item.identificacion) === String(identificacion)
    );
    if (!estudiante) {
      mostrarAlerta($("#error-matricula"), "No se encontró el estudiante seleccionado.", "error");
      return;
    }

    const carrera = estado.carreras.find((item) => Number(item.id) === Number(estudiante.idCarrera));
    const facultad = carrera
      ? estado.facultades.find((item) => Number(item.id) === Number(carrera.idFacultad))
      : null;

    alternarCargando(boton, true, "Matriculando…");
    try {
      const resultado = await window.Api.registrarMatricula({
        identificacion,
        periodo: estado.periodoActual,
        codigosMaterias
      });

      await cargarMateriasMatricula(estudiante, carrera, facultad);

      anunciarExito(
        exito,
        `Se matricularon ${resultado.matriculas.length} materia(s) para ${nombreCompleto(estudiante)} en el periodo ${resultado.periodo}, con un total de ${resultado.totalCreditos} créditos.`
      );
    } catch (error) {
      mostrarErrorServidor(form, error);
    } finally {
      alternarCargando(boton, false);
    }

    actualizarResumenMatricula();
  }

  /* ------------------------- Módulo 6: notas ----------------------------- */
  function enlazarFormularioNotas() {
    $("#notas-estudiante").addEventListener("change", manejarCambioEstudianteNotas);
    $("#notas-materia").addEventListener("change", seleccionarMateriaNotas);
    ["nota1", "nota2", "nota3"].forEach((campo) => {
      $(`#${campo}`).addEventListener("input", actualizarVistaPreviaNotas);
    });
    $("#form-notas").addEventListener("submit", guardarNotas);
  }

  async function manejarCambioEstudianteNotas() {
    const identificacion = $("#notas-estudiante").value;
    const form = $("#form-notas");

    ocultarAlerta($("#exito-notas"));
    ocultarAlerta($("#info-notas"));
    limpiarErrores(form);

    await cargarMateriasNotas(identificacion);
  }

  async function cargarMateriasNotas(identificacion) {
    const token = ++estado.solicitudNotas;
    const selectMateria = $("#notas-materia");
    const info = $("#info-notas");

    estado.matriculasNotas = [];
    selectMateria.innerHTML = "";
    selectMateria.appendChild(nuevaOpcion("", "Selecciona un estudiante primero"));
    selectMateria.disabled = true;
    $("#btn-guardar-notas").disabled = true;
    ocultarAlerta(info);
    limpiarCamposNotas();

    if (!identificacion) {
      return;
    }

    try {
      const matriculas = await window.Api.listarMatriculas({ identificacion });
      if (token !== estado.solicitudNotas) {
        return;
      }

      estado.matriculasNotas = matriculas;

      if (!matriculas.length) {
        selectMateria.innerHTML = "";
        selectMateria.appendChild(nuevaOpcion("", "Sin materias matriculadas"));
        mostrarAlerta(
          info,
          "Este estudiante no tiene matrículas registradas. Primero matricula una materia en el módulo “Matricular estudiante”.",
          "info"
        );
        return;
      }

      selectMateria.innerHTML = "";
      selectMateria.appendChild(nuevaOpcion("", "Selecciona una materia"));
      matriculas.forEach((matricula) => {
        const sufijo = matricula.nota ? " · con notas" : "";
        selectMateria.appendChild(
          nuevaOpcion(
            matricula.idMatricula,
            `${matricula.nombreMateria} · ${matricula.periodo}${sufijo}`
          )
        );
      });
      selectMateria.disabled = false;
    } catch (error) {
      if (token !== estado.solicitudNotas) {
        return;
      }
      mostrarAlerta($("#error-notas"), error.message || "No se pudieron consultar las matrículas.", "error");
    }
  }

  function seleccionarMateriaNotas() {
    const form = $("#form-notas");
    const idMatricula = form.elements.idMatricula.value;
    const matricula = estado.matriculasNotas.find(
      (item) => String(item.idMatricula) === String(idMatricula)
    );
    const info = $("#info-notas");

    ocultarAlerta(info);
    limpiarCamposNotas();

    if (!matricula) {
      $("#btn-guardar-notas").disabled = true;
      return;
    }

    if (matricula.nota) {
      ["nota1", "nota2", "nota3"].forEach((campo) => {
        form.elements[campo].value = String(matricula.nota[campo]);
        form.elements[campo].readOnly = true;
      });
      mostrarAlerta(
        info,
        `Esta materia ya tiene notas registradas (promedio ${formateadorNota.format(matricula.nota.promedio)}). No es posible registrarlas de nuevo.`,
        "info"
      );
      actualizarVistaPreviaNotas();
      $("#btn-guardar-notas").disabled = true;
      return;
    }

    $("#btn-guardar-notas").disabled = false;
  }

  function limpiarCamposNotas() {
    const form = $("#form-notas");
    ["nota1", "nota2", "nota3"].forEach((campo) => {
      const input = form.elements[campo];
      input.value = "";
      input.readOnly = false;
    });
    reiniciarVistaPrevia();
  }

  function reiniciarVistaPrevia() {
    const promedio = $("#promedio-preview");
    promedio.textContent = "—";
    promedio.classList.remove("promedio--aprueba", "promedio--reprueba");

    const estadoPreview = $("#estado-preview");
    estadoPreview.textContent = "Sin notas";
    estadoPreview.className = "etiqueta";

    $("#detalle-preview").textContent = "Ingresa las tres notas para calcular el promedio.";
  }

  function actualizarVistaPreviaNotas() {
    const form = $("#form-notas");
    const valores = ["nota1", "nota2", "nota3"].map((campo) => form.elements[campo].value.trim());
    const completos = valores.every((valor) => valor !== "");
    const validos = completos && valores.every((valor) => !window.Validaciones.validarNota(valor));

    if (!validos) {
      reiniciarVistaPrevia();
      return;
    }

    const numeros = valores.map((valor) => window.Validaciones.aNumero(valor));
    const promedio = Math.round(((numeros[0] + numeros[1] + numeros[2]) / 3) * 100) / 100;
    const aprueba = promedio >= 3;

    const elementoPromedio = $("#promedio-preview");
    elementoPromedio.textContent = formateadorNota.format(promedio);
    elementoPromedio.classList.toggle("promedio--aprueba", aprueba);
    elementoPromedio.classList.toggle("promedio--reprueba", !aprueba);

    const estadoPreview = $("#estado-preview");
    estadoPreview.textContent = aprueba ? "Aprueba" : "Reprueba";
    estadoPreview.className = aprueba ? "etiqueta etiqueta--exito" : "etiqueta etiqueta--error";

    $("#detalle-preview").textContent = aprueba
      ? "El promedio alcanza la nota mínima de 3.0."
      : "El promedio no alcanza la nota mínima de 3.0.";
  }

  async function guardarNotas(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const boton = $("#btn-guardar-notas");
    const exito = $("#exito-notas");
    const identificacion = form.elements.identificacion.value;
    const idMatricula = form.elements.idMatricula.value;
    const matricula = estado.matriculasNotas.find(
      (item) => String(item.idMatricula) === String(idMatricula)
    );

    ocultarAlerta(exito);
    ocultarAlerta($("#info-notas"));

    const datos = {
      idMatricula,
      nota1: form.elements.nota1.value.trim(),
      nota2: form.elements.nota2.value.trim(),
      nota3: form.elements.nota3.value.trim()
    };

    const errores = window.Validaciones.validarNotas(datos);
    if (Object.keys(errores).length) {
      mostrarErrores(form, errores);
      return;
    }

    if (matricula && matricula.nota) {
      mostrarAlerta(
        $("#error-notas"),
        "Esta materia ya tiene notas registradas. Selecciona otra materia para continuar.",
        "error"
      );
      return;
    }

    alternarCargando(boton, true, "Guardando…");
    try {
      const resultado = await window.Api.registrarNotas({
        idMatricula: Number(idMatricula),
        nota1: window.Validaciones.aNumero(datos.nota1),
        nota2: window.Validaciones.aNumero(datos.nota2),
        nota3: window.Validaciones.aNumero(datos.nota3)
      });

      await cargarMateriasNotas(identificacion);

      anunciarExito(
        exito,
        `Notas registradas para ${resultado.nombreMateria}. Promedio: ${formateadorNota.format(resultado.promedio)}. El estudiante ${resultado.aprobada ? "aprueba" : "no aprueba"} la materia.`
      );
    } catch (error) {
      mostrarErrorServidor(form, error);
    } finally {
      alternarCargando(boton, false);
    }

    $("#btn-guardar-notas").disabled = true;
  }

  function reiniciarFormularioNotas() {
    estado.solicitudNotas += 1;
    estado.matriculasNotas = [];

    const selectMateria = $("#notas-materia");
    selectMateria.innerHTML = "";
    selectMateria.appendChild(nuevaOpcion("", "Selecciona un estudiante primero"));
    selectMateria.disabled = true;

    limpiarCamposNotas();
    ocultarAlerta($("#info-notas"));
    $("#btn-guardar-notas").disabled = true;
  }

  /* ------------------------- Módulo 7: recibo ---------------------------- */
  function enlazarFormularioRecibo() {
    $("#recibo-estudiante").addEventListener("change", manejarCambioEstudianteRecibo);
    $("#recibo-periodo").addEventListener("change", () => {
      const token = ++estado.solicitudRecibo;
      mostrarReciboVacio("Generando el recibo del periodo seleccionado…");
      generarRecibo(token);
    });
    $("#btn-imprimir").addEventListener("click", () => {
      if ($("#recibo-contenedor .recibo")) {
        window.print();
      }
    });
  }

  async function manejarCambioEstudianteRecibo() {
    const identificacion = $("#recibo-estudiante").value;
    const selectPeriodo = $("#recibo-periodo");
    const botonImprimir = $("#btn-imprimir");

    ocultarAlerta($("#error-recibo"));
    botonImprimir.disabled = true;

    selectPeriodo.innerHTML = "";
    selectPeriodo.disabled = true;
    mostrarReciboVacio("Consultando las matrículas del estudiante…");

    if (!identificacion) {
      selectPeriodo.appendChild(nuevaOpcion("", "Selecciona un estudiante primero"));
      mostrarReciboVacio("Selecciona un estudiante y un periodo para ver el detalle de sus matrículas y el total a pagar.");
      return;
    }

    selectPeriodo.appendChild(nuevaOpcion("", "Cargando periodos…"));
    const token = ++estado.solicitudRecibo;

    try {
      const periodos = await window.Api.listarPeriodos(identificacion);
      if (token !== estado.solicitudRecibo) {
        return;
      }

      const estudiante = estado.estudiantes.find(
        (item) => String(item.identificacion) === String(identificacion)
      );

      if (!periodos.length) {
        selectPeriodo.innerHTML = "";
        selectPeriodo.appendChild(nuevaOpcion("", "Sin periodos con matrículas"));
        mostrarReciboVacio(
          `${estudiante ? nombreCompleto(estudiante) : "El estudiante"} no tiene matrículas registradas. Registra una matrícula para poder generar el recibo.`
        );
        return;
      }

      selectPeriodo.innerHTML = "";
      selectPeriodo.appendChild(nuevaOpcion("", "Selecciona un periodo"));
      periodos.forEach((periodo) => {
        selectPeriodo.appendChild(nuevaOpcion(periodo, periodo));
      });
      selectPeriodo.disabled = false;
      selectPeriodo.value = periodos[0];

      await generarRecibo(token);
    } catch (error) {
      if (token !== estado.solicitudRecibo) {
        return;
      }
      selectPeriodo.innerHTML = "";
      selectPeriodo.appendChild(nuevaOpcion("", "No se pudieron cargar los periodos"));
      mostrarAlerta($("#error-recibo"), error.message || "No se pudieron consultar los periodos.", "error");
      mostrarReciboVacio("No fue posible consultar los periodos del estudiante.");
    }
  }

  async function generarRecibo(token) {
    const identificacion = $("#recibo-estudiante").value;
    const periodo = $("#recibo-periodo").value;
    const botonImprimir = $("#btn-imprimir");
    const contenedor = $("#recibo-contenedor");

    botonImprimir.disabled = true;

    if (!identificacion || !periodo) {
      mostrarReciboVacio("Selecciona un estudiante y un periodo para generar el recibo.");
      return;
    }

    ocultarAlerta($("#error-recibo"));
    contenedor.setAttribute("aria-busy", "true");

    try {
      const recibo = await window.Api.obtenerRecibo({ identificacion, periodo });
      if (token !== estado.solicitudRecibo) {
        return;
      }

      if (!recibo) {
        mostrarReciboVacio(
          "No hay matrículas registradas para ese periodo. Elige otro periodo o registra primero la matrícula."
        );
        return;
      }

      contenedor.innerHTML = plantillaRecibo(recibo);
      botonImprimir.disabled = false;
    } catch (error) {
      if (token !== estado.solicitudRecibo) {
        return;
      }
      mostrarAlerta($("#error-recibo"), error.message || "No se pudo generar el recibo.", "error");
      mostrarReciboVacio("No fue posible generar el recibo seleccionado.");
    } finally {
      contenedor.removeAttribute("aria-busy");
    }
  }

  function mostrarReciboVacio(mensaje) {
    $("#recibo-contenedor").innerHTML = `
      <div class="estado-vacio estado-vacio--grande no-impresion">
        <svg class="estado-vacio__icono" aria-hidden="true"><use href="#icono-recibo"></use></svg>
        <h3>Sin recibo para mostrar</h3>
        <p>${escaparHtml(mensaje)}</p>
      </div>
    `;
    $("#btn-imprimir").disabled = true;
  }

  function plantillaRecibo(recibo) {
    const estudiante = recibo.estudiante;

    const filas = recibo.matriculas
      .map((matricula) => {
        return `
          <tr>
            <td>${escaparHtml(matricula.idMatricula)}</td>
            <td>
              <strong>${escaparHtml(matricula.nombreMateria)}</strong>
              <span class="recibo__codigo">Código ${escaparHtml(matricula.codMateria)} · ${escaparHtml(matricula.periodoMateria)} · ${escaparHtml(matricula.horario)}</span>
            </td>
            <td class="texto-derecha">${escaparHtml(matricula.creditos)}</td>
            <td class="texto-derecha">${formateadorMoneda.format(matricula.valorCredito)}</td>
            <td class="texto-derecha">${formateadorMoneda.format(matricula.subtotal)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <article class="recibo" id="recibo" aria-labelledby="recibo-titulo">
        <header class="recibo__cabecera">
          <div class="recibo__marca">
            <img class="recibo__logo" src="assets/image.png" alt="Universidad Cooperativa de Colombia" width="56" height="56">
            <div>
              <strong>Universidad Cooperativa de Colombia</strong>
              <span>Oficina de Registro Académico</span>
            </div>
          </div>
          <div class="recibo__identificacion">
            <p id="recibo-titulo">Recibo de matrícula</p>
            <strong>${escaparHtml(recibo.numero)}</strong>
            <span>Periodo ${escaparHtml(recibo.periodo)}</span>
          </div>
        </header>

        <section class="recibo__seccion" aria-labelledby="recibo-datos-estudiante">
          <h3 id="recibo-datos-estudiante">Información del estudiante</h3>
          <dl class="recibo__datos">
            <div>
              <dt>Documento</dt>
              <dd>${escaparHtml(estudiante.identificacion)}</dd>
            </div>
            <div>
              <dt>Nombre completo</dt>
              <dd>${escaparHtml(`${estudiante.nombres} ${estudiante.apellidos}`)}</dd>
            </div>
            <div>
              <dt>Correo electrónico</dt>
              <dd>${escaparHtml(estudiante.correo)}</dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd>${escaparHtml(estudiante.telefono)}</dd>
            </div>
            <div>
              <dt>Carrera</dt>
              <dd>${escaparHtml(estudiante.carrera)}</dd>
            </div>
            <div>
              <dt>Facultad</dt>
              <dd>${escaparHtml(estudiante.facultad)}</dd>
            </div>
            <div>
              <dt>Periodo académico</dt>
              <dd>${escaparHtml(recibo.periodo)}</dd>
            </div>
            <div>
              <dt>Fecha de emisión</dt>
              <dd>${formatearFecha(recibo.fechaEmision)}</dd>
            </div>
          </dl>
        </section>

        <section class="recibo__seccion" aria-labelledby="recibo-detalle">
          <h3 id="recibo-detalle">Detalle de matrículas</h3>
          <div class="tabla-contenedor">
            <table class="tabla recibo__tabla">
              <caption class="solo-lectores">Materias matriculadas en el periodo ${escaparHtml(recibo.periodo)}</caption>
              <thead>
                <tr>
                  <th scope="col">ID matrícula</th>
                  <th scope="col">Materia</th>
                  <th scope="col" class="texto-derecha">Créditos</th>
                  <th scope="col" class="texto-derecha">Valor crédito</th>
                  <th scope="col" class="texto-derecha">Subtotal</th>
                </tr>
              </thead>
              <tbody>${filas}</tbody>
            </table>
          </div>

          <div class="recibo__totales">
            <div>
              <span>Total de créditos</span>
              <strong>${escaparHtml(recibo.totalCreditos)}</strong>
            </div>
            <div>
              <span>Valor del crédito</span>
              <strong>${formateadorMoneda.format(recibo.valorCredito)}</strong>
            </div>
            <div class="recibo__total">
              <span>Total a pagar</span>
              <strong>${formateadorMoneda.format(recibo.totalPagar)}</strong>
            </div>
          </div>
        </section>

        <footer class="recibo__pie">
          <p>
            Documento generado electrónicamente el ${formatearFecha(recibo.fechaEmision)} desde el Portal de Gestión Universitaria.
            Este recibo certifica las materias matriculadas en el periodo ${escaparHtml(recibo.periodo)}.
          </p>
          <div class="recibo__firma">Firma y sello</div>
        </footer>
      </article>
    `;
  }
})();
