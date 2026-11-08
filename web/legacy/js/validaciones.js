/* =========================================================================
   VALIDACIONES DE FORMULARIO
   -------------------------------------------------------------------------
   Validaciones de formato y campos obligatorios. Devuelven un objeto
   { nombreDelCampo: "mensaje para la persona usuaria" }.
   Las reglas de negocio que dependen de los datos (unicidad, existencia,
   cupos, etc.) se validan también en js/api.js, que es el punto que se
   reemplazará por el backend.
   ========================================================================= */

(function () {
  "use strict";

  const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RE_DOCUMENTO = /^\d{6,20}$/;
  const RE_TELEFONO = /^\d{7,10}$/;
  const RE_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '\u2019-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
  const RE_NOTAS = /^\d{1,2}([.,]\d{1,2})?$/;
  const RE_PERIODO = /^\d{4}-[12]$/;

  function aNumero(valor) {
    if (typeof valor === "number") {
      return Number.isFinite(valor) ? valor : NaN;
    }
    const texto = String(valor ?? "").trim().replace(",", ".");
    if (!texto) {
      return NaN;
    }
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : NaN;
  }

  function validarNota(valor) {
    const texto = String(valor ?? "").trim();

    if (!texto) {
      return "Ingresa una nota.";
    }
    if (!RE_NOTAS.test(texto)) {
      return "Usa un número entre 0.0 y 5.0, con hasta dos decimales.";
    }

    const numero = aNumero(texto);
    if (!Number.isFinite(numero) || numero < 0 || numero > 5) {
      return "La nota debe estar entre 0.0 y 5.0.";
    }
    return "";
  }

  function validarFacultad(datos) {
    const errores = {};
    const nombre = String(datos.nombre ?? "").trim();

    if (!nombre) {
      errores.nombre = "Ingresa el nombre de la facultad.";
    } else if (nombre.length < 3) {
      errores.nombre = "El nombre debe tener al menos 3 caracteres.";
    } else if (nombre.length > 15) {
      errores.nombre = "El nombre no puede superar los 15 caracteres.";
    } else if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(nombre)) {
      errores.nombre = "El nombre debe incluir al menos una letra.";
    }

    return errores;
  }

  function validarCarrera(datos) {
    const errores = {};
    const nombre = String(datos.nombre ?? "").trim();

    if (!nombre) {
      errores.nombre = "Ingresa el nombre de la carrera.";
    } else if (nombre.length < 3) {
      errores.nombre = "El nombre debe tener al menos 3 caracteres.";
    } else if (nombre.length > 30) {
      errores.nombre = "El nombre no puede superar los 30 caracteres.";
    } else if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(nombre)) {
      errores.nombre = "El nombre debe incluir al menos una letra.";
    }

    if (!String(datos.idFacultad ?? "").trim()) {
      errores.idFacultad = "Selecciona la facultad a la que pertenece la carrera.";
    }

    return errores;
  }

  function validarEstudiante(datos) {
    const errores = {};

    const documento = String(datos.documento ?? "").trim();
    if (!documento) {
      errores.documento = "Ingresa el número de documento.";
    } else if (!RE_DOCUMENTO.test(documento)) {
      errores.documento = "El documento debe tener entre 6 y 20 dígitos, sin puntos ni espacios.";
    }

    const nombres = String(datos.nombres ?? "").trim();
    if (!nombres) {
      errores.nombres = "Ingresa el nombre o los nombres del estudiante.";
    } else if (nombres.length < 2) {
      errores.nombres = "El nombre debe tener al menos 2 caracteres.";
    } else if (!RE_NOMBRE.test(nombres)) {
      errores.nombres = "Usa solo letras y espacios. No incluyas números ni símbolos.";
    }

    const apellidos = String(datos.apellidos ?? "").trim();
    if (!apellidos) {
      errores.apellidos = "Ingresa el apellido o los apellidos del estudiante.";
    } else if (apellidos.length < 2) {
      errores.apellidos = "El apellido debe tener al menos 2 caracteres.";
    } else if (!RE_NOMBRE.test(apellidos)) {
      errores.apellidos = "Usa solo letras y espacios. No incluyas números ni símbolos.";
    }

    const correo = String(datos.correo ?? "").trim();
    if (!correo) {
      errores.correo = "Ingresa el correo electrónico.";
    } else if (correo.length > 70) {
      errores.correo = "El correo no puede superar los 70 caracteres.";
    } else if (!RE_CORREO.test(correo)) {
      errores.correo = "Ingresa un correo válido, por ejemplo nombre@universidad.edu.co.";
    }

    const telefono = String(datos.telefono ?? "").trim();
    if (!telefono) {
      errores.telefono = "Ingresa el número de teléfono.";
    } else if (!RE_TELEFONO.test(telefono)) {
      errores.telefono = "El teléfono debe tener entre 7 y 10 dígitos, sin espacios ni guiones.";
    }

    if (!String(datos.idCarrera ?? "").trim()) {
      errores.idCarrera = "Selecciona la carrera que cursará el estudiante.";
    }

    return errores;
  }

  function validarMateria(datos) {
    const errores = {};

    const idTexto = String(datos.id ?? "").trim();
    const id = aNumero(idTexto);
    if (!idTexto) {
      errores.id = "Ingresa el código de la materia.";
    } else if (!Number.isInteger(id) || id <= 100000) {
      errores.id = "El código debe ser un número entero mayor a 100000.";
    }

    const nombre = String(datos.nombre ?? "").trim();
    if (!nombre) {
      errores.nombre = "Ingresa el nombre de la materia.";
    } else if (nombre.length < 3) {
      errores.nombre = "El nombre debe tener al menos 3 caracteres.";
    } else if (nombre.length > 30) {
      errores.nombre = "El nombre no puede superar los 30 caracteres.";
    } else if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(nombre)) {
      errores.nombre = "El nombre debe incluir al menos una letra.";
    }

    const creditosTexto = String(datos.creditos ?? "").trim();
    const creditos = aNumero(creditosTexto);
    if (!creditosTexto) {
      errores.creditos = "Ingresa la cantidad de créditos.";
    } else if (!Number.isInteger(creditos)) {
      errores.creditos = "Los créditos deben ser un número entero, sin decimales.";
    } else if (creditos < 1 || creditos > 4) {
      errores.creditos = "Los créditos deben estar entre 1 y 4.";
    }

    if (!String(datos.idFacultad ?? "").trim()) {
      errores.idFacultad = "Selecciona la facultad a la que pertenece la materia.";
    }

    const periodo = String(datos.periodo ?? "").trim();
    if (!periodo) {
      errores.periodo = "Ingresa el periodo académico de la materia.";
    } else if (!RE_PERIODO.test(periodo)) {
      errores.periodo = "Usa el formato AAAA-1 o AAAA-2, por ejemplo 2026-2.";
    }

    const cuposTexto = String(datos.cupos ?? "").trim();
    const cupos = aNumero(cuposTexto);
    if (!cuposTexto) {
      errores.cupos = "Ingresa la cantidad de cupos.";
    } else if (!Number.isInteger(cupos)) {
      errores.cupos = "Los cupos deben ser un número entero, sin decimales.";
    } else if (cupos < 1 || cupos > 50) {
      errores.cupos = "Los cupos deben estar entre 1 y 50.";
    }

    const horario = String(datos.horario ?? "").trim();
    if (!horario) {
      errores.horario = "Ingresa el horario de la materia.";
    } else if (horario.length < 3) {
      errores.horario = "El horario debe tener al menos 3 caracteres.";
    } else if (horario.length > 40) {
      errores.horario = "El horario no puede superar los 40 caracteres.";
    }

    return errores;
  }

  const DIAS_HORARIO = {
    LUNES: ["LUNES", "LUN"],
    MARTES: ["MARTES", "MAR"],
    MIERCOLES: ["MIERCOLES", "MIE"],
    JUEVES: ["JUEVES", "JUE"],
    VIERNES: ["VIERNES", "VIE"],
    SABADO: ["SABADO", "SAB"],
    DOMINGO: ["DOMINGO", "DOM"]
  };

  function normalizarHorario(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function minutosDeHora(hora, minutos, meridiano) {
    let valor = Number(hora);
    const minuto = minutos ? Number(minutos) : 0;
    if (valor > 23 || minuto > 59) {
      return null;
    }
    const sufijo = String(meridiano || "").replace(/\./g, "").toUpperCase();
    if (sufijo === "AM") {
      valor = valor === 12 ? 0 : valor;
    } else if (sufijo === "PM") {
      valor = valor < 12 ? valor + 12 : valor;
    } else if (valor <= 7) {
      valor += 12;
    }
    return valor * 60 + minuto;
  }

  function franjasHorario(horario) {
    const texto = normalizarHorario(horario);
    const dias = Object.keys(DIAS_HORARIO).filter((dia) =>
      DIAS_HORARIO[dia].some((alias) => new RegExp(`\\b${alias}\\b`).test(texto))
    );
    if (!dias.length) {
      return [];
    }

    const minutos = [];
    const patron = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A\.M\.|P\.M\.)?/gi;
    let coincidencia;
    while ((coincidencia = patron.exec(texto)) !== null) {
      const valor = minutosDeHora(coincidencia[1], coincidencia[2], coincidencia[3]);
      if (valor !== null) {
        minutos.push(valor);
      }
    }
    if (minutos.length < 2) {
      return [];
    }

    const inicio = minutos[0];
    const fin = minutos[1];
    if (fin <= inicio) {
      return [];
    }
    return dias.map((dia) => ({ dia, inicio, fin }));
  }

  function conflictoHorario(materias) {
    const franjas = [];
    for (const materia of materias || []) {
      const nombre = materia.nombre || "Materia";
      const horario = materia.horario || "";
      for (const franja of franjasHorario(horario)) {
        for (const previa of franjas) {
          if (franja.dia === previa.dia && franja.inicio < previa.fin && previa.inicio < franja.fin) {
            return `Conflicto de horario: ${nombre} (${horario}) se cruza con ${previa.nombre} (${previa.horario}) el ${franja.dia.toLowerCase()}. Elige materias con horarios que no se solapen.`;
          }
        }
        franjas.push({ nombre, horario, ...franja });
      }
    }
    return null;
  }

  function validarMatricula(datos) {
    const errores = {};

    if (!String(datos.identificacion ?? "").trim()) {
      errores.identificacion = "Selecciona el estudiante que deseas matricular.";
    }

    const codigos = Array.isArray(datos.codigosMaterias) ? datos.codigosMaterias : [];
    const totalCreditos = aNumero(datos.totalCreditos);

    if (!codigos.length) {
      errores.materias = "Selecciona al menos una materia para continuar.";
    } else if (!Number.isFinite(totalCreditos) || totalCreditos < 2) {
      errores.materias = "La matrícula debe tener mínimo 2 créditos. Selecciona una materia adicional.";
    } else if (totalCreditos > 16) {
      errores.materias = `La matrícula no puede superar los 16 créditos. Has seleccionado ${totalCreditos}.`;
    }

    if (!errores.materias) {
      const conflicto = conflictoHorario(datos.materias);
      if (conflicto) {
        errores.materias = conflicto;
      }
    }

    return errores;
  }

  function validarNotas(datos) {
    const errores = {};

    if (!String(datos.idMatricula ?? "").trim()) {
      errores.idMatricula = "Selecciona la materia matriculada.";
    }

    ["nota1", "nota2", "nota3"].forEach((campo) => {
      const mensaje = validarNota(datos[campo]);
      if (mensaje) {
        errores[campo] = mensaje;
      }
    });

    return errores;
  }

  window.Validaciones = {
    aNumero,
    validarNota,
    validarFacultad,
    validarCarrera,
    validarEstudiante,
    validarMateria,
    validarMatricula,
    validarNotas,
    franjasHorario,
    conflictoHorario
  };
})();
