import tkinter as tk
from datetime import date
from pathlib import Path
from tkinter import messagebox, ttk

import sv_ttk
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from reportlab.lib import colors  # Colores predefinidos para usar en el PDF.
from reportlab.lib.enums import (
    TA_CENTER,  # Constantes para alinear texto en el PDF (por ejemplo, centrar texto).
)
from reportlab.lib.pagesizes import (
    letter,  # Tamaño de página predefinido para el PDF (carta).
)
from reportlab.lib.styles import (  # Crear estilos de párrafo y obtener estilos de muestra para el PDF.
    getSampleStyleSheet,
)
from reportlab.lib.units import cm  # Unidades de medida para el PDF (centímetros).
from reportlab.platypus import (  # Elementos para crear el PDF: párrafos, documentos, espacios y tablas.
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from utils import button, consola

root = tk.Tk()
root.title("Sistema de Matrículas")
root.minsize(500, 500)

ruta_archivo = Path(__file__).with_name("Registro_Matriculas.xlsx")
ruta_logo = Path(__file__).with_name("image.png")
imagen_tk = tk.PhotoImage(file=ruta_logo).subsample(3, 3)

VALOR_CREDITO: int = 70_000


def crear_archivo_excel():
    if not ruta_archivo.exists():
        Nuevo_Archivo_Excel = Workbook()
        hoja_estudiante = Nuevo_Archivo_Excel.active
        hoja_estudiante.title = "Estudiantes"
        Nuevo_Archivo_Excel.create_sheet("Materias")
        Nuevo_Archivo_Excel.create_sheet("Matriculas")
        Nuevo_Archivo_Excel.create_sheet("Facultades")
        Nuevo_Archivo_Excel.create_sheet("Notas")

        Encabezados: dict[str, list[str]] = {
            "Materias": ["Código", "Nombre", "Creditos", "ID_Facultad"],
            "Facultades": ["Id facultad", "Nombre"],
            "Estudiantes": [
                "Cedula",
                "Nombres",
                "Apellidos",
                "Programa",
                "Correo",
                "ID_Facultad",
            ],
            "Matriculas": [
                "Id matricula",
                "Cedula",
                "Codigo materia",
                "Periodo",
                "Creditos",
                "Fecha matricula",
            ],
            "Notas": [
                "Id matricula",
                "Nota 1",
                "Nota 2",
                "Nota 3",
                "Definitiva",
                "Estado",
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
                )  # Esrablecer el valor de la celda en la primera fila y columna correspondiente al encabezado
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
        fila[0]
        for fila in hoja.iter_rows(min_row=2, values_only=True)
        if isinstance(fila[0], int)
    ]
    return max(identificadores, default=0) + 1


def registrar_facultad():
    libro = load_workbook(ruta_archivo)
    hoja_facultades = libro["Facultades"]

    def gen_id():
        nombre_facultad = facultad.get().strip().lower()
        max_id = 0
        for fila in hoja_facultades.iter_rows(min_row=2, values_only=True):
            if fila[1] == nombre_facultad:
                messagebox.showerror("Error", "La facultad ya existe.")
                return
            max_id = int(fila[0])

        datos_facultad = [str(max_id + 1), nombre_facultad]
        guardar_datos(hoja_facultades, datos_facultad)

    rf_window = tk.Tk()
    rf_window.title("Registrar Facultad")
    rf_window.minsize(300, 120)

    ttk.Label(rf_window, text="Ingrese el nombre de la facultad:").pack(padx=5, pady=5)
    facultad = ttk.Entry(rf_window, width=30)
    facultad.pack(padx=5, pady=5)
    button(rf_window, "Registrar", gen_id)

    sv_ttk.use_dark_theme(rf_window)
    rf_window.mainloop()


def validar(hoja, datos, columna, id_get, tipo = "estudiante"):
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
    materia_estudiante = load_workbook(ruta_archivo)
    hoja_estudiantes = materia_estudiante["Estudiantes"]

    re_window = tk.Tk()
    re_window.title("Registrar Estudiante")
    re_window.minsize(400, 450)

    ttk.Label(re_window, text="Ingrese CC/TI del estudiante:").pack(padx=5, pady=5)
    cedula = ttk.Entry(re_window, width=30)
    cedula.pack(padx=5, pady=5)

    ttk.Label(re_window, text="Ingrese el nombre del estudiante:").pack(padx=5, pady=5)
    nombre = ttk.Entry(re_window, width=30)
    nombre.pack(padx=5, pady=5)

    ttk.Label(re_window, text="Ingrese el apellido del estudiante:").pack(
        padx=5, pady=5
    )
    apellido = ttk.Entry(re_window, width=30)
    apellido.pack(padx=5, pady=5)

    ttk.Label(re_window, text="Ingrese el correo del estudiante:").pack(padx=5, pady=5)
    correo = ttk.Entry(re_window, width=30)
    correo.pack(padx=5, pady=5)

    ttk.Label(re_window, text="Ingrese el teléfono del estudiante:").pack(
        padx=5, pady=5
    )
    telefono = ttk.Entry(re_window, width=30)
    telefono.pack(padx=5, pady=5)

    ttk.Label(
        re_window, text="Ingrese la facultad a la que pertenecerá el estudiante:"
    ).pack(padx=5, pady=5)
    facultad = ttk.Entry(re_window, width=30)
    facultad.pack(padx=5, pady=5)

    datos_estudiante = [cedula, nombre, apellido, correo, telefono, facultad]

    button(
        re_window,
        "Registrar",
        lambda: validar(hoja_estudiantes, datos_estudiante, 0, cedula),
    )
    sv_ttk.use_dark_theme(re_window)
    re_window.mainloop()


def registrar_materia():
    libro = load_workbook(ruta_archivo)
    hoja_materias = libro["Materias"]

    rm_window = tk.Tk()
    rm_window.title("Registrar Materia")
    rm_window.minsize(300, 350)
    
    ttk.Label(rm_window, text="Ingrese el código de la materia:").pack(padx=5, pady=5)
    codigo_materia = ttk.Entry(rm_window, width=30)
    codigo_materia.pack(padx=5, pady=5)
    
    ttk.Label(rm_window, text="Ingrese el nombre de la materia:").pack(padx=5, pady=5)
    nombre = ttk.Entry(rm_window, width=30)
    nombre.pack(padx=5, pady=5)
    
    ttk.Label(rm_window, text="Ingrese los créditos de la materia:").pack(padx=5, pady=5)
    creditos = ttk.Entry(rm_window, width=30)
    creditos.pack(padx=5, pady=5)
    
    ttk.Label(rm_window, text="Ingrese la facultad de la materia:").pack(padx=5, pady=5)
    facultad = ttk.Entry(rm_window, width=30)
    facultad.pack(padx=5, pady=5)
    
    datos_materia = [codigo_materia, nombre, creditos, facultad]
    
    button(rm_window, "Registrar", lambda: validar(hoja_materias, datos_materia, 0, codigo_materia, "materia"))
    
    sv_ttk.use_dark_theme(rm_window)
    rm_window.mainloop()


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
        periodo_fila = str(fila[4]).strip()
        if cedula_fila == cedula and periodo_fila == periodo:
            total_creditos += int(str(fila[3]).strip())

    return total_creditos


def registrar_matricula():
    libro = load_workbook(ruta_archivo)
    hoja_matriculas = libro["Matriculas"]
    hoja_estudiantes = libro["Estudiantes"]
    hoja_materias = libro["Materias"]
    
    def procesar_matricula(datos):
        datos_registro = [generar_id_matricula(hoja_matriculas)]

        id_get = datos[0].get().strip()
        datos_registro.append(id_get)

        nombre_materia = datos[1].get().strip()
        materia_id = buscar_fila(hoja_materias, 1, nombre_materia)[0]
        datos_registro.append(materia_id)

        if not buscar_fila(hoja_estudiantes, 0, id_get):
            messagebox.showinfo("Fallo de registro", "El estudiante no está registrado.")
            return

        fecha_matricula = date.today().strftime("%Y-%m-%d")
        fecha_list = fecha_matricula.split(
            "-"
        )  # Convertir str a list usando '-' como separador
        periodo = fecha_list[0]  # Año

        total_creditos = obtener_total_creditos_estudiante(
            hoja_matriculas, id_get, periodo
        )

        if total_creditos == 18:
            messagebox.showinfo(
                "Fallo de registro",
                "El estudiante tiene el máximo de créditos matriculados.\nNo se pueden matricular más materias."
            )
            return

        if not buscar_fila(hoja_materias, 1, nombre_materia):
            messagebox.showinfo("Fallo de registro", "La materia no está registrada.")
            return

        # Si el mes es el mes 6 o anterior, usamos el periodo 1 (primer semestre)
        # De lo contrario usamos el periodo 2 (Segundo semestre)
        if int(fecha_list[1]) <= 6:
            periodo = f"{periodo}-1"
        else:
            periodo = f"{periodo}-2"

        datos_registro.append(periodo)

        creditos = buscar_fila(hoja_materias, 0, materia_id)[2]

        datos_registro.append(creditos)
        datos_registro.append(fecha_matricula)

        if (total_creditos + int(creditos)) >= 18:
            messagebox.showinfo(
                "Fallo de registro",
                "La materia seleccionada excede el total de créditos permitidos."
            )
            return
        guardar_datos(hoja_matriculas, datos_registro)

    materias = []

    for fila in hoja_materias.iter_rows(min_row=2, values_only=True):
        materias.append(str(fila[1]).strip())

    rma_window = tk.Tk()
    rma_window.title("Registrar Matrícula")
    rma_window.minsize(400, 300)

    ttk.Label(rma_window, text="Ingrese la identificación del estudiante:").pack(padx=5, pady=5)
    id_estudiante = ttk.Entry(rma_window, width=30)
    id_estudiante.pack(padx=5, pady=5)

    # Esto ahorra tener que validar a mano si la materia existe
    ttk.Label(rma_window, text="Seleccione la materia:").pack(padx=5, pady=5)
    materia = ttk.Combobox(rma_window, width=30, state="readonly", values=materias)
    materia.pack(padx=5, pady=5)

    button(rma_window, "Registrar Matrícula", lambda: procesar_matricula([id_estudiante, materia]))

    sv_ttk.use_dark_theme(rma_window)
    rma_window.mainloop()


def registrar_notas():
    rn_window = tk.Tk()
    rn_window.title("Registrar Notas")
    rn_window.minsize(400, 500)

    sv_ttk.use_dark_theme(rn_window)
    rn_window.mainloop()


def generar_factura(id_estudiante, periodo):
    materia = load_workbook(ruta_archivo)
    hoja_matriculas = materia["Matriculas"]
    hoja_estudiantes = materia["Estudiantes"]
    hoja_materias = materia["Materias"]

    # Obtengo la información del estudiante
    fila_estudiante = buscar_fila(hoja_estudiantes, 0, id_estudiante)
    if not fila_estudiante:
        consola.log("El estudiante no está registrado.")
        return

    total_creditos = obtener_total_creditos_estudiante(
        hoja_matriculas, id_estudiante, periodo
    )
    if total_creditos < 2:
        consola.log(
            f"No se puede generar la factura: El estudiante solo tiene {total_creditos} crédito(s) matriculado(s). Se requiere un mínimo de 2 créditos."
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
        if str(fila[1]).strip() == id_estudiante and str(fila[4]).strip() == periodo:
            cod_materia = str(fila[2]).strip()
            nombre_mat = dict_materias[cod_materia]
            matriculas_estudiante.append(
                [str(fila[0]).strip(), cod_materia, nombre_mat, str(fila[3]).strip()]
            )

    fecha_actual = date.today().strftime("%Y-%m-%d")

    carpeta_facturas = Path(__file__).parent / "Facturas_Matriculas"
    carpeta_facturas.mkdir(exist_ok=True)

    archivo_pdf = carpeta_facturas / f"Factura_{id_estudiante}.pdf"

    documento = SimpleDocTemplate(
        str(archivo_pdf),
        pagesize=letter,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    estilos = getSampleStyleSheet()
    estilo_titulo = estilos["Title"]
    estilo_titulo.alignment = TA_CENTER
    estilo_texto = estilos["BodyText"]

    contenido = []
    contenido.append(Image(ruta_logo, width=4 * cm, height=4 * cm))
    contenido.append(Spacer(1, 12))
    contenido.append(Paragraph("Factura de Matrículas", estilo_titulo))
    contenido.append(Paragraph(f"Fecha: {fecha_actual}", estilo_texto))
    contenido.append(Spacer(1, 12))

    tabla = Table(matriculas_estudiante, colWidths=[3.5 * cm, 3 * cm, 6 * cm, 2.5 * cm])
    tabla.setStyle(
        TableStyle(
            [
                # Encabezado: todas las columnas
                ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 14),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                # Filas de datos: todas las columnas
                ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                # Tabla completa
                ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ]
        )
    )
    contenido.append(tabla)
    contenido.append(Spacer(1, 12))
    tabla_estudiante = Table(info_estudiante, colWidths=[5 * cm, 10 * cm])
    tabla_estudiante.setStyle(
        TableStyle(
            [
                # Encabezado: todas las columnas
                ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 14),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                # Filas de datos: todas las columnas
                ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                # Tabla completa
                ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ]
        )
    )
    contenido.append(tabla_estudiante)

    contenido.append(Spacer(1, 12))
    contenido.append(
        Paragraph(
            f"Total a pagar: {total_creditos}x{VALOR_CREDITO} = ${total_creditos * VALOR_CREDITO}",
            estilo_texto,
        )
    )

    documento.build(contenido)
    consola.log(f"Factura generada exitosamente: {archivo_pdf}")


def menu_principal():
    crear_archivo_excel()

    etiqueta_logo = ttk.Label(root, image=imagen_tk)
    etiqueta_logo.pack(pady=(25, 10))

    button(root, "Registrar facultad", registrar_facultad)
    button(root, "Registrar estudiante", registrar_estudiante)
    button(root, "Registrar materia", registrar_materia)
    button(root, "Matricular estudiante", registrar_matricula)
    button(root, "Registrar notas", registrar_notas)
    button(root, "Generar recibo de matrícula", generar_factura)

    sv_ttk.set_theme("dark")

    root.mainloop()


if __name__ == "__main__":
    try:
        menu_principal()
    except KeyboardInterrupt:
        consola.log("Saliendo por interrupción del teclado...")
