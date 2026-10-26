import tkinter as tk
from datetime import date
from pathlib import Path
from tkinter import messagebox, ttk

import sv_ttk
from fpdf import FPDF
from fpdf.fonts import FontFace
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from rich.console import Console

estilo_encabezado = FontFace(emphasis="BOLD")

root = tk.Tk()
root.title("Sistema de Matrículas")
root.minsize(500, 500)

ruta_archivo = Path(__file__).with_name("Registro_Matriculas.xlsx")
ruta_logo = Path(__file__).with_name("image.png")
imagen_tk = tk.PhotoImage(file=ruta_logo).subsample(3, 3)

VALOR_CREDITO: int = 70_000

consola = Console()


def button(
    root: tk.Tk | tk.Toplevel,
    text: str,
    command,
    ancho: int = 30,
    estilo: str = "Accent.TButton",
    padx=5,
    pady=5,
):
    boton = ttk.Button(root, text=text, command=command, width=ancho, style=estilo)
    boton.pack(padx=padx, pady=pady)


def crear_archivo_excel():
    if not ruta_archivo.exists():
        Nuevo_Archivo_Excel = Workbook()
        hoja_estudiante = Nuevo_Archivo_Excel.active
        hoja_estudiante.title = "Estudiantes"
        Nuevo_Archivo_Excel.create_sheet("Materias")
        Nuevo_Archivo_Excel.create_sheet("Matriculas")
        Nuevo_Archivo_Excel.create_sheet("Facultades")
        Nuevo_Archivo_Excel.create_sheet("Notas")
        Nuevo_Archivo_Excel.create_sheet("Carreras")

        Encabezados: dict[str, list[str]] = {
            "Materias": ["Código", "Nombre", "Creditos", "ID_Facultad"],
            "Facultades": ["Id facultad", "Nombre"],
            "Estudiantes": [
                "Cedula",
                "Nombres",
                "Apellidos",
                "Correo",
                "Telefono",
                "ID_Carrera",  # llave foránea
            ],
            "Carreras": ["Id carrera", "Nombre", "ID_Facultad"],
            "Matriculas": [
                "Id matricula",
                "Cedula",
                "Codigo materia",
                "Periodo",
                "Creditos",  # Debe estar entre 2 y 12 créditos
                "Fecha matricula",
            ],
            "Notas": [
                "Id_Nota",
                "id_matricula",
                "id_materia",
                "cedula estudiante",
                "Nota 1",
                "Nota 2",
                "Nota 3",
                "Promedio",
            ],
        }

        for (
            nombre_hoja,
            lista_encabezados,
        ) in (
            Encabezados.items()
        ):  # Establecer los encabezados en la primera fila de cada hoja
            hoja_actual = Nuevo_Archivo_Excel[nombre_hoja]
            for columnas, encabezado in enumerate(
                lista_encabezados, start=1
            ):  # Establecer los encabezados en la primera fila de cada hoja
                celda = hoja_actual.cell(
                    row=1, column=columnas, value=encabezado
                )  # Establecer el valor de la celda en la primera fila y columna correspondiente al encabezado
                celda.font = Font(
                    bold=True, color="FFFFFF"
                )  # Establecer el estilo de fuente en negrita y color blanco para los encabezados
                celda.fill = PatternFill(
                    start_color="4F81BD", end_color="4F81BD", fill_type="solid"
                )  # Establecer el color de fondo azul para los encabezados
                celda.alignment = Alignment(
                    horizontal="center", vertical="center"
                )  # Alinear el texto de los encabezados al centro horizontal y verticalmente

        Nuevo_Archivo_Excel.save(ruta_archivo)
        consola.log(f"Archivo de Excel creado exitosamente: {ruta_archivo}")
    else:
        Nuevo_Archivo_Excel = load_workbook(ruta_archivo)
        consola.log(f"El archivo ya existe y fue abierto: {ruta_archivo}")

    return Nuevo_Archivo_Excel


def guardar_datos(hoja, datos):
    datos_get = []
    for dato in datos:
        if isinstance(dato, ttk.Entry):
            dato_get = dato.get()
        else:
            dato_get = dato

        datos_get.append(dato_get.strip())

        if dato_get == "":
            messagebox.showerror(
                title="Error", message="Uno o más campos están vacíos."
            )
            return
    hoja.append(datos_get)  # Agregar los datos a la hoja de cálculo
    hoja.parent.save(ruta_archivo)  # Guardar los cambios en el archivo de Excel
    messagebox.showinfo(title="Éxito", message="Datos guardados exitosamente.")


def buscar_fila(hoja, columna, valor):
    buscado = (
        str(valor).strip().lower()
    )  # Convertir el valor a minúsculas y eliminar espacios en blanco al inicio y al final para una búsqueda más flexible.
    for fila in hoja.iter_rows(
        min_row=2,
        values_only=True,  # Comenzar desde la fila 2 para omitir los encabezados
    ):
        if (
            str(fila[columna]).strip().lower() == buscado
        ):  # Comparar el valor de la celda con el valor buscado, ignorando mayúsculas y minúsculas y espacios en blanco
            return fila
    return None


def siguiente_id(hoja):
    identificadores = [
        int(fila[0]) for fila in hoja.iter_rows(min_row=2, values_only=True)
    ]
    return max(identificadores, default=0) + 1


def registrar_facultad():
    libro = load_workbook(ruta_archivo)
    hoja_facultades = libro["Facultades"]

    def guardar(valores):
        nombre_facultad = valores["nombre_facultad"].strip().lower()

        max_id = 0
        for fila in hoja_facultades.iter_rows(min_row=2, values_only=True):
            if fila and len(fila) > 1 and fila[1]:
                if str(fila[1]).strip().lower() == nombre_facultad:
                    messagebox.showerror(
                        title="Error", message="La facultad ya existe."
                    )
                    return False
                if fila[0] is not None:
                    try:
                        max_id = max(max_id, int(fila[0]))
                    except ValueError:
                        pass

        nuevo_id = str(max_id + 1)
        hoja_facultades.append([nuevo_id, nombre_facultad])
        libro.save(ruta_archivo)
        messagebox.showinfo(title="Exito", message="Facultad registrada exitosamente.")
        return True

    ventana_formulario(
        root,
        "Registrar Facultad",
        [("nombre_facultad", "Nombre de la facultad:")],
        guardar,
    )


def registrar_carrera():
    libro = load_workbook(ruta_archivo)
    hoja_carreras = libro["Carreras"]
    hoja_facultades = libro["Facultades"]

    def guardar(valores):
        for carrera in hoja_carreras.iter_rows(min_row=2, values_only=True):
            if (
                str(carrera[1]).strip().lower()
                == valores["nombre_carrera"].strip().lower()
            ):
                messagebox.showerror(title="Error", message="La carrera ya existe.")
                return False
        id_facultad = buscar_fila(hoja_facultades, 1, valores["facultad"])[0]
        hoja_carreras.append(
            [siguiente_id(hoja_carreras), valores["nombre_carrera"], id_facultad]
        )
        libro.save(ruta_archivo)
        messagebox.showinfo(title="Exito", message="Carrera registrada exitosamente.")
        return True

    facultades = []

    for fila in hoja_facultades.iter_rows(min_row=2, values_only=True):
        facultades.append(str(fila[1]).strip())

    ventana_formulario(
        root,
        "Registrar Carrera",
        [
            ("nombre_carrera", "Nombre de la carrera:"),
            ("facultad", "Facultad:", facultades),
        ],
        guardar,
    )


def validar(hoja, datos, columna, id_get, tipo="estudiante"):
    fila_existente = buscar_fila(hoja, columna, id_get.get())
    if fila_existente:
        if tipo == "estudiante":
            messagebox.showerror(
                title="Error", message="El estudiante con esa identificación ya existe."
            )
            return
        elif tipo == "materia":
            messagebox.showerror(
                title="Error", message="La materia con ese código ya existe."
            )
            return
    facultades = load_workbook(ruta_archivo)["Facultades"]
    f_nombre = datos[-1].get().strip().lower()
    fila = buscar_fila(facultades, 1, f_nombre)
    if not fila:
        messagebox.showerror(title="Error", message="La facultad ingresada no existe.")
        return
    datos[-1] = fila[0]
    guardar_datos(hoja, datos)


def registrar_estudiante():
    libro = load_workbook(ruta_archivo)
    hoja_carreras = libro["Carreras"]

    # Obtener lista de facultades para el Combobox
    carreras = [
        str(fila[1]).strip()
        for fila in hoja_carreras.iter_rows(min_row=2, values_only=True)
        if fila and fila[1]
    ]

    if not carreras:
        messagebox.showwarning(
            "Carreras requeridas",
            "Debe registrar al menos una carrera antes de ingresar estudiantes.",
            parent=root,
        )
        return

    def guardar(valores):
        hoja_estudiantes = libro["Estudiantes"]

        # Validar si la cédula ya existe
        if buscar_fila(hoja_estudiantes, 0, valores["cedula"]):
            messagebox.showerror(
                "Identificación duplicada",
                "Ya existe un estudiante con esa cédula.",
                parent=root,
            )
            return False

        # Buscar el ID de la facultad seleccionada
        fila_carrera = buscar_fila(hoja_carreras, 1, valores["carrera"])
        id_carrera = fila_carrera[0] if fila_carrera else ""

        # Guardar en Excel
        datos = [
            valores["cedula"],
            valores["nombre"],
            valores["apellido"],
            valores["correo"],
            valores["telefono"],
            id_carrera,
        ]

        hoja_estudiantes.append(datos)
        libro.save(ruta_archivo)
        messagebox.showinfo(
            "Éxito", "Estudiante registrado correctamente.", parent=root
        )
        return True

    ventana_formulario(
        root,
        "Registrar Estudiante",
        [
            ("cedula", "CC/TI:"),
            ("nombre", "Nombre:"),
            ("apellido", "Apellido:"),
            ("correo", "Correo electrónico:"),
            ("telefono", "Teléfono:"),
            ("carrera", "Carrera:", carreras),
        ],
        guardar,
    )


def registrar_materia():
    libro = load_workbook(ruta_archivo)
    hoja_facultades = libro["Facultades"]

    facultades = [
        str(fila[1]).strip()
        for fila in hoja_facultades.iter_rows(min_row=2, values_only=True)
        if fila and fila[1]
    ]

    if not facultades:
        messagebox.showwarning(
            "Facultades requeridas",
            "Debe registrar al menos una facultad antes de ingresar materias.",
            parent=root,
        )
        return

    def guardar(valores):
        hoja_materias = libro["Materias"]

        # Validar si el código de la materia ya existe
        if buscar_fila(hoja_materias, 0, valores["codigo"]):
            messagebox.showerror(
                "Código duplicado",
                "Ya existe una materia con ese código.",
                parent=root,
            )
            return False

        # Buscar el ID de la facultad seleccionada
        fila_facultad = buscar_fila(hoja_facultades, 1, valores["facultad"])
        id_facultad = fila_facultad[0] if fila_facultad else ""

        # Guardar en Excel
        datos = [
            valores["codigo"],
            valores["nombre"].lower(),
            valores["creditos"],
            id_facultad,
        ]

        hoja_materias.append(datos)
        libro.save(ruta_archivo)
        messagebox.showinfo("Éxito", "Materia registrada correctamente.", parent=root)
        return True

    # Crear ventana para registrar materia
    ventana_formulario(
        root,
        "Registrar Materia",
        [
            ("codigo", "Código de la materia:"),
            ("nombre", "Nombre de la materia:"),
            ("creditos", "Créditos de la materia:"),
            (
                "facultad",
                "Facultad:",
                facultades,
            ),  # Muestra la lista de facultades registradas en un Combobox para seleccionar la facultad correspondiente a la materia
        ],
        guardar,
    )


def generar_id_matricula(hoja):
    fecha_hoy = date.today().strftime("%d%m%y")

    ultimo_contador = 0

    for fila in hoja.iter_rows(min_row=2, values_only=True):
        valor = str(fila[0]).strip()

        if not valor:
            continue

        # Si la fila tiene el formato: 01 + ddmmyy  -> 01090926
        if len(valor) >= 8 and valor.endswith(fecha_hoy):
            contador = int(valor[:2])
            ultimo_contador = max(ultimo_contador, contador)

    nuevo_contador = ultimo_contador + 1
    return f"{nuevo_contador:02d}{fecha_hoy}"  # Formato: 01 + ddmmyy


def obtener_total_creditos_estudiante(hoja_matriculas, cedula, periodo) -> int:
    """
    Obtener los créditos totales que el estudiante ha matriculado en
    el periodo actual, la función retorna un entero, esto permitirá que más
    adelante se revise si el estudiante puede matricular más materias o
    excede los créditos máximos, también si un estudiante tiene menos del
    mínimo permitido, negándose a generar la factura hasta que cumpla el rango.
    """
    total_creditos: int = 0
    for fila in hoja_matriculas.iter_rows(min_row=2, values_only=True):
        cedula_fila = str(fila[1]).strip()
        periodo_fila = str(fila[3]).strip()
        if cedula_fila == cedula and periodo_fila == periodo:
            total_creditos += int(str(fila[4]).strip())

    return total_creditos


def registrar_matricula():
    """
    Registro de matrículas con menú de añadir, registro de golpe, usando únicamente los créditos que el estudiante
    va a inscribir, se debe matricular entre 2 y 12 créditos, si el estudiante selecciona 10 créditos y lleva
    8 matriculados, y selecciona una materia de 3, se le denegará, solo puede matricular esos 8 créditos o
    matricular una materia de 2 créditos. Esta función requiere ventana diferente a formulario sencillo.
    """
    libro = load_workbook(ruta_archivo)
    hoja_matriculas = libro["Matriculas"]
    hoja_estudiantes = libro["Estudiantes"]
    hoja_materias = libro["Materias"]
    hoja_facultades = libro["Facultades"]
    hoja_carreras = libro["Carreras"]

    def procesar_matricula(datos: dict):
        creditos_prematricula: int = 0
        prematriculados: list[str] = []
        row_materia: int = 3

        def validar_materia():
            nonlocal creditos_prematricula
            nonlocal prematriculados
            nonlocal row_materia
            nombre_materia = materia.get().strip()
            info_materia = buscar_fila(hoja_materias, 1, nombre_materia)
            if creditos_prematricula + int(info_materia[2]) > 12:
                messagebox.showinfo(
                    "Fallo de registro",
                    "La cantidad de créditos a matricular excede el máximo permitido (12).",
                )
                return
            creditos_prematricula += int(info_materia[2])
            prematriculados.append(nombre_materia)
            ttk.Label(
                marco, text=f"{nombre_materia}    {info_materia[2]} créditos"
            ).grid(row=row_materia, column=0, sticky="w", padx=(0, 16), pady=7)
            row_materia += 1

        def registrar_creditos():
            nonlocal prematriculados
            if not prematriculados:
                messagebox.showinfo(
                    "Fallo de registro",
                    "No se han seleccionado materias para matricular.",
                )
                return
            fecha_matricula = date.today().strftime("%Y-%m-%d")
            fecha_list = fecha_matricula.split(
                "-"
            )  # Convertir str a list usando '-' como separador
            periodo = fecha_list[0]  # Año

            # Si el mes es el mes 6 o anterior, usamos el periodo 1 (primer semestre)
            # De lo contrario usamos el periodo 2 (Segundo semestre)
            if int(fecha_list[1]) <= 6:
                periodo = f"{periodo}-1"
            else:
                periodo = f"{periodo}-2"

            for nombre_materia in prematriculados:
                datos_registro = []
                materia_info = buscar_fila(hoja_materias, 1, nombre_materia)
                datos_registro.append(generar_id_matricula(hoja_matriculas))
                datos_registro.append(datos["id_estudiante"])
                datos_registro.append(materia_info[0])
                datos_registro.append(periodo)
                datos_registro.append(materia_info[2])
                datos_registro.append(fecha_matricula)
                hoja_matriculas.append(datos_registro)
            libro.save(ruta_archivo)
            messagebox.showinfo(
                "Éxito",
                f"Se han registrado {len(prematriculados)} materias para el estudiante {datos['id_estudiante']}.",
            )
            pma_window.destroy()

        datos_registro = [generar_id_matricula(hoja_matriculas)]

        id_get = datos["id_estudiante"]
        datos_registro.append(id_get)

        total_creditos = int(datos["creditos"])

        if total_creditos < 2 or total_creditos > 12:
            messagebox.showinfo(
                "Fallo de registro",
                "La cantidad de créditos a matricular debe estar entre 2 y 12.",
            )
            return

        pma_window = tk.Toplevel(root)
        pma_window.title("Seleccionar Materias")
        pma_window.resizable(False, False)
        pma_window.transient(root)
        pma_window.grab_set()

        marco = ttk.Frame(pma_window, padding=24)
        marco.grid(sticky="nsew")

        carrera_estudiante = buscar_fila(hoja_estudiantes, 0, id_get)[5]
        facultad_estudiante = buscar_fila(hoja_carreras, 0, carrera_estudiante)[0]

        materias_facultad = []

        for fila in hoja_materias.iter_rows(min_row=2, values_only=True):
            if str(fila[3]).strip() == str(facultad_estudiante):
                materias_facultad.append(str(fila[1]).strip())

        # añadir también materias generales como humanidades e inglés
        try:
            id_humanidades = buscar_fila(hoja_facultades, 1, "humanidades")[0]
            for fila in hoja_materias.iter_rows(min_row=2, values_only=True):
                if str(fila[3]).strip() == str(id_humanidades):
                    materias_facultad.append(str(fila[1]).strip())
        except TypeError:
            pass

        try:
            id_ingles = buscar_fila(hoja_facultades, 1, "ingles")[0]
            for fila in hoja_materias.iter_rows(min_row=2, values_only=True):
                if str(fila[3]).strip() == str(id_ingles):
                    materias_facultad.append(str(fila[1]).strip())
        except TypeError:
            pass

        ttk.Label(marco, text="Seleccione las materias a matricular:").grid(
            row=0, column=0, sticky="w", padx=(0, 16), pady=7
        )
        materia = ttk.Combobox(
            marco,
            width=33,
            state="readonly",
            values=materias_facultad,
        )
        materia.grid(row=0, column=1, sticky="ew", pady=7)

        botones = ttk.Frame(marco)
        ttk.Button(botones, text="Cancelar", command=pma_window.destroy).pack(
            side="right", padx=(8, 0)
        )
        ttk.Button(
            botones, text="Matricular", command=validar_materia, style="Accent.TButton"
        ).pack(side="right")
        botones.grid(row=1, column=0, columnspan=2, sticky="e", pady=(18, 0))

        ttk.Button(
            marco,
            text="Registrar créditos",
            command=registrar_creditos,
            style="Accent.TButton",
        ).grid(row=2, column=1, sticky="ew", pady=7)

        pma_window.wait_visibility()
        pma_window.focus_set()
        pma_window.mainloop()

    materias = []
    estudiantes = []

    for fila in hoja_materias.iter_rows(min_row=2, values_only=True):
        materias.append(str(fila[1]).strip())

    for fila in hoja_estudiantes.iter_rows(min_row=2, values_only=True):
        estudiantes.append(str(fila[0]).strip())

    ventana_formulario(
        root,
        "Registrar Matrícula",
        [
            ("id_estudiante", "Identificación del estudiante:", estudiantes),
            ("creditos", "Cantidad de créditos a matricular:"),
        ],
        procesar_matricula,
        "Comenzar matrícula",
        "normal",
    )


def registrar_notas():
    libro = load_workbook(ruta_archivo)
    hoja_notas = libro["Notas"]
    hoja_materias = libro["Materias"]
    hoja_estudiantes = libro["Estudiantes"]
    hoja_matriculas = libro["Matriculas"]

    def guardar(datos):
        encontrado: bool = False
        for matricula in hoja_matriculas.iter_rows(min_row=2, values_only=True):
            if (
                str(matricula[1]).strip() == datos["id_estudiante"]
                and str(matricula[2]).strip() == datos["id_materia"]
            ):
                id_matricula = matricula[0]
                encontrado = True
                break

        if not encontrado:
            messagebox.showerror(
                "Error", "El estudiante no está matriculado en la materia seleccionada."
            )
            return False

        promedio = (
            float(datos["nota1"]) + float(datos["nota2"]) + float(datos["nota3"])
        ) / 3

        hoja_notas.append(
            [
                siguiente_id(hoja_notas),
                id_matricula,
                str(datos["id_materia"]).strip(),
                str(datos["id_estudiante"]).strip(),
                datos["nota1"],
                datos["nota2"],
                datos["nota3"],
                str(round(promedio, 2)),
            ]
        )
        libro.save(ruta_archivo)

        if promedio >= 3.0:
            messagebox.showinfo(
                "Registro exitoso",
                f"Notas registradas exitosamente. El estudiante aprobó la materia con un promedio de {round(promedio, 2)}.",
            )
        else:
            messagebox.showwarning(
                "Registro exitoso",
                f"Notas registradas exitosamente. El estudiante reprobó la materia con un promedio de {round(promedio, 2)}.",
            )

    cedulas = []
    for fila in hoja_estudiantes.iter_rows(min_row=2, values_only=True):
        cedulas.append(str(fila[0]).strip())

    materias = []
    for fila in hoja_materias.iter_rows(min_row=2, values_only=True):
        materias.append(str(fila[1]).strip())
    ventana_formulario(
        root,
        "Registrar Notas",
        [
            ("id_estudiante", "Cédula/TI del estudiante:", cedulas),
            ("id_materia", "Nombre de la matrícula:", materias),
            ("nota1", "Nota 1:"),
            ("nota2", "Nota 2:"),
            ("nota3", "Nota 3:"),
        ],
        guardar,
    )


def generar_factura(datos: dict):
    id_estudiante = datos["id_estudiante"]
    periodo = datos["periodo"]

    libro = load_workbook(ruta_archivo)
    hoja_matriculas = libro["Matriculas"]
    hoja_estudiantes = libro["Estudiantes"]
    hoja_materias = libro["Materias"]

    # Obtengo la información del estudiante
    fila_estudiante = buscar_fila(hoja_estudiantes, 0, id_estudiante)

    total_creditos = obtener_total_creditos_estudiante(
        hoja_matriculas, id_estudiante, periodo
    )
    if total_creditos < 2:
        messagebox.showerror(
            "Error",
            f"No se puede generar la factura: El estudiante solo tiene {total_creditos} crédito(s) matriculado(s). Se requiere un mínimo de 2 créditos.",
        )
        return

    info_estudiante: list[list[str]] = [
        ["Campo", "Valor"],  # Encabezado de la tabla
        ["Cedula", str(fila_estudiante[0]).strip()],
        [
            "Nombre completo",
            str(fila_estudiante[1]).strip() + " " + str(fila_estudiante[2]).strip(),
        ],
        ["Correo", str(fila_estudiante[3]).strip()],
        ["Telefono", str(fila_estudiante[4]).strip()],
    ]

    # diccionario de materias para obtener el nombre de la materia a partir del código
    dict_materias: dict[str, str] = {}
    for fila in hoja_materias.iter_rows(min_row=2, values_only=True):
        if fila:
            dict_materias[str(fila[0]).strip()] = str(fila[1]).strip()

    # Obtener las matrículas del estudiante valores calculados
    matriculas_estudiante: list[list[str]] = [
        ["ID Matrícula", "ID Materia", "Nombre Materia", "Creditos"]
    ]

    # Obtener todas las matriculas y listarlas en la factura
    for fila in hoja_matriculas.iter_rows(min_row=2, values_only=True):
        if str(fila[1]).strip() == id_estudiante and str(fila[3]).strip() == periodo:
            cod_materia = str(fila[2]).strip()
            nombre_mat = dict_materias[cod_materia]
            matriculas_estudiante.append(
                [str(fila[0]).strip(), cod_materia, nombre_mat, str(fila[4]).strip()]
            )

    fecha_actual = date.today().strftime("%Y-%m-%d")

    carpeta_facturas = Path(__file__).parent / "Facturas_Matriculas"
    carpeta_facturas.mkdir(exist_ok=True)

    archivo_pdf = carpeta_facturas / f"Factura_{id_estudiante}.pdf"

    pdf = FPDF(orientation="P", unit="mm", format="Letter")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Logo de la universidad
    if ruta_logo.exists():
        pdf.image(str(ruta_logo), x=88, y=12, w=40)
        pdf.ln(45)  # Salto de línea después del logo
    else:
        pdf.ln(20)  # Salto de línea si no hay logo

    # Titulo
    pdf.set_font("helvetica", "B", 18)
    pdf.cell(0, 10, "Factura de Matrícula", new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_font("helvetica", "", 10)
    pdf.cell(
        0,
        6,
        f"Fecha de emisión: {fecha_actual}",
        new_x="LMARGIN",
        new_y="NEXT",
        align="C",
    )
    pdf.cell(
        0, 6, f"Periodo academico: {periodo}", new_x="LMARGIN", new_y="NEXT", align="C"
    )
    pdf.ln(6)

    # Info del estudiante
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(
        0, 8, "Información del estudiante:", new_x="LMARGIN", new_y="NEXT", align="L"
    )
    pdf.set_font("helvetica", "", 10)

    with pdf.table(text_align="CENTER") as table:
        for i, fila in enumerate(info_estudiante):
            row = table.row()
            for celda in fila:
                if i == 0:
                    row.cell(str(celda), style=estilo_encabezado)
                else:
                    row.cell(str(celda))
    pdf.ln(6)

    # Detalle de la matrícula del estudiante
    with pdf.table(text_align="LEFT") as table:
        for i, fila in enumerate(matriculas_estudiante):
            row = table.row()
            for celda in fila:
                if i == 0:
                    row.cell(str(celda), style=estilo_encabezado)
                else:
                    row.cell(str(celda))

    pdf.ln(6)

    # Resumen financiero
    total_pagar = total_creditos * VALOR_CREDITO
    total_fmt = f"${total_pagar:,.0f}".replace(
        ",", "."
    )  # Formatear con separador de miles y decimales
    valor_credito_fmt = f"${VALOR_CREDITO:,.0f}".replace(
        ",", "."
    )  # Formatear con separador de miles y decimales
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(
        0,
        8,
        f"Total a pagar: {total_creditos} crédito(s) x {valor_credito_fmt} = {total_fmt} COP",
        new_x="LMARGIN",
        new_y="NEXT",
        align="L",
    )

    pdf.output(str(archivo_pdf))
    messagebox.showinfo(
        "Factura generada", f"Factura generada exitosamente: {archivo_pdf}"
    )
    return True


def factura_form():
    libro = load_workbook(ruta_archivo)
    hoja_estudiantes = libro["Estudiantes"]
    cedulas = []
    for estudiante in hoja_estudiantes.iter_rows(min_row=2, values_only=True):
        cedulas.append(str(estudiante[0]).strip())
    ventana_formulario(
        root,
        "Generar Factura",
        [
            ("id_estudiante", "Cédula/TI del estudiante:", cedulas),
            ("periodo", "Periodo académico (ej: 2024-1):"),
        ],
        generar_factura,
        "Generar",
    )


def menu_principal():
    crear_archivo_excel()

    etiqueta_logo = ttk.Label(root, image=imagen_tk)
    etiqueta_logo.pack(pady=(25, 10))

    button(root, "Registrar facultad", registrar_facultad)
    button(root, "Registrar carrera", registrar_carrera)
    button(root, "Registrar estudiante", registrar_estudiante)
    button(root, "Registrar materia", registrar_materia)
    button(root, "Matricular estudiante", registrar_matricula)
    button(root, "Registrar notas", registrar_notas)
    button(root, "Generar recibo de matrícula", factura_form)

    sv_ttk.set_theme("dark")

    root.mainloop()


def ventana_formulario(
    raiz,
    titulo,
    campos,
    al_guardar,
    button_text: str = "Guardar",
    state: str = "readonly",
):
    ventana = tk.Toplevel(raiz)
    ventana.title(titulo)
    ventana.resizable(False, False)
    ventana.transient(raiz)
    ventana.grab_set()

    marco = ttk.Frame(ventana, padding=24)
    marco.grid(sticky="nsew")
    entradas = {}
    for fila, campo in enumerate(campos):
        clave, etiqueta = campo[:2]
        ttk.Label(marco, text=etiqueta).grid(
            row=fila, column=0, sticky="w", padx=(0, 16), pady=7
        )
        if len(campo) == 3:
            entrada = ttk.Combobox(
                marco,
                width=33,
                state=state,
                values=campo[2],
            )
            if campo[2]:
                entrada.current(0)
        else:
            entrada = ttk.Entry(marco, width=36)
        entrada.grid(row=fila, column=1, sticky="ew", pady=7)
        entradas[clave] = entrada

    def guardar():
        valores = {clave: entrada.get().strip() for clave, entrada in entradas.items()}
        if any(not valor for valor in valores.values()):
            messagebox.showwarning(
                "Campos obligatorios",
                "Complete todos los campos antes de guardar.",
                parent=ventana,
            )
            return
        try:
            guardado = al_guardar(valores)
        except OSError as error:
            messagebox.showerror(
                "Error al guardar",
                f"No se pudo acceder al archivo de Excel.\n\nDetalle: {error}",
                parent=ventana,
            )
            return
        except ValueError as error:
            messagebox.showerror("Error en el registro", str(error), parent=ventana)
            return
        if guardado:
            ventana.destroy()

    botones = ttk.Frame(marco)
    ttk.Button(botones, text="Cancelar", command=ventana.destroy).pack(
        side="right", padx=(8, 0)
    )
    ttk.Button(botones, text=button_text, command=guardar, style="Accent.TButton").pack(
        side="right"
    )
    botones.grid(row=len(campos), column=0, columnspan=2, sticky="e", pady=(18, 0))
    next(iter(entradas.values())).focus_set()
    ventana.wait_visibility()
    ventana.focus_set()
    ventana.mainloop()


if __name__ == "__main__":
    try:
        menu_principal()
    except KeyboardInterrupt:
        consola.log("Saliendo por interrupción del teclado...")
