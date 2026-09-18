import sys  # Manejo del sistema
from datetime import date
from pathlib import Path

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

ruta_archivo = Path(__file__).parent / "Registro_Matriculas.xlsx"


def crear_archivo_excel():
    if not ruta_archivo.exists():
        Nuevo_Archivo_Excel = Workbook()
        hoja_estudiante = Nuevo_Archivo_Excel.active
        hoja_estudiante.title = "Estudiantes"
        Nuevo_Archivo_Excel.create_sheet("Materias")
        Nuevo_Archivo_Excel.create_sheet("Matriculas")

        Encabezados = {
            "Estudiantes": [
                "Cedula",
                "Nombre",
                "Apellido",
                "Correo",
                "Telefono",
            ],
            "Materias": [
                "Codigo",
                "Nombre",
                "Creditos",
                "Facultad",
            ],
            "Matriculas": [
                "ID",
                "Cedula Estudiante",
                "Codigo Materia",
                "Creditos",
                "Periodo",
                "Fecha Matricula",
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
        print(f"Archivo de Excel creado exitosamente: {ruta_archivo}")
    else:
        Nuevo_Archivo_Excel = load_workbook(ruta_archivo)
        print(f"El archivo ya existe y fue abierto: {ruta_archivo}")

    return Nuevo_Archivo_Excel


def Guardar_datos(hoja, datos):
    hoja.append(datos)  # Agregar los datos a la hoja de cálculo
    hoja.parent.save(ruta_archivo)  # Guardar los cambios en el archivo de Excel
    print("Datos guardados exitosamente.")


def buscar_fila(hoja, columna, valor):
    buscado = (
        str(valor).strip().lower()
    )  # Convertir el valor a minúsculas y eliminar espacios en blanco al inicio y al final para una búsqueda más flexible.
    for fila in hoja.iter_rows(
        min_row=2, values_only=True
    ):  # Comenzar desde la fila 2 para omitir los encabezados
        if (
            str(fila[columna]).strip().lower() == buscado
        ):  # Comparar el valor de la celda con el valor buscado, ignorando mayúsculas y minúsculas y espacios en blanco
            return fila
    return None


def texto_obligatorio(mensaje):
    intentos = 0
    while intentos <= 3:
        valor: str = (
            input(
                mensaje
            ).strip()  # Eliminar espacios en blanco al inicio y al final de la entrada del usuario
        )
        if valor:  # Si el valor no está vacío, se devuelve el valor ingresado
            return valor
        intentos += 1
        print("Este campo es obligatorio.")
    if intentos == 3:
        print("Demasiados intentos fallidos! Abortando sistema...")
        sys.exit(1)


def registrar_estudiante():
    materia_estudiante = load_workbook(ruta_archivo)
    hoja_estudiantes = materia_estudiante["Estudiantes"]

    cedula = texto_obligatorio("Ingrese CC/TI del estudiante: ")

    fila_existente = buscar_fila(hoja_estudiantes, 0, cedula)
    if fila_existente:  # buscar_fila(hoja_estudiantes, 0, identificación):
        print("El estudiante con esa identificación ya existe.")
        return

    nombre = texto_obligatorio("Ingrese el nombre del estudiante: ")
    apellido = texto_obligatorio("Ingrese el apellido del estudiante: ")
    correo = texto_obligatorio("Ingrese el correo del estudiante: ")
    telefono = texto_obligatorio("Ingrese el teléfono del estudiante: ")

    datos_estudiante = [cedula, nombre, apellido, correo, telefono]

    Guardar_datos(hoja_estudiantes, datos_estudiante)


def registrar_materia():
    materia_estudiante = load_workbook(ruta_archivo)
    hoja_materias = materia_estudiante["Materias"]

    codigo_materia = texto_obligatorio("Ingrese el código de la materia: ")

    if buscar_fila(hoja_materias, 0, codigo_materia):
        print("La materia con ese código ya existe.")
        return

    nombre = texto_obligatorio("Ingrese el nombre de la materia: ")
    creditos = texto_obligatorio("Ingrese los créditos de la materia: ")
    facultad = texto_obligatorio("Ingrese la facultad de la materia: ")

    datos_materias = [codigo_materia, nombre, creditos, facultad]

    Guardar_datos(hoja_materias, datos_materias)


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


def obtener_total_creditos_estudiante() -> int:
    """
    Obtener los créditos totales que el estudiante ha matriculado en
    el periodo actual, la función retorna un entero, esto permitirá que más
    adelante se revise si el estudiante puede matricular más materias o
    excede los créditos máximos, también si un estudiante tiene menos del
    mínimo permitido, negandose a generar la factura hasta que cumpla el rango.
    """
    return 0 

def registrar_matricula():
    materia = load_workbook(ruta_archivo)
    hoja_matriculas = materia["Matriculas"]
    hoja_estudiantes = materia["Estudiantes"]
    hoja_materias = materia["Materias"]

    id_matricula = generar_id_matricula(hoja_matriculas)

    id_estudiante = texto_obligatorio("Ingrese la identificación del estudiante: ")
    if not buscar_fila(hoja_estudiantes, 0, id_estudiante):
        print("El estudiante no está registrado.")
        return

    id_materia = texto_obligatorio("Ingrese el código de la materia: ")
    if not buscar_fila(hoja_materias, 0, id_materia):
        print("La materia no está registrada.")
        return

    fecha_matricula = date.today().strftime("%Y-%m-%d")
    fecha_devolucion = texto_obligatorio(
        "Ingrese la fecha de devolución (YYYY-MM-DD): "
    )
    fecha_entrega = texto_obligatorio("Ingrese la fecha de entrega (YYYY-MM-DD): ")

    if fecha_entrega > fecha_devolucion:
        print("La fecha de entrega supera la fecha de devolución")
        dias_mora = (
            date.fromisoformat(fecha_entrega) - date.fromisoformat(fecha_devolucion)
        ).days
        valor_mora = dias_mora * 2000
    else:
        dias_mora = 0
        valor_mora = 0

    datos_matricula = [
        id_matricula,
        id_estudiante,
        id_materia,
        fecha_matricula,
        fecha_devolucion,
        fecha_entrega,
        dias_mora,
        valor_mora,
    ]

    Guardar_datos(hoja_matriculas, datos_matricula)


def generar_factura(id_matricula):
    materia = load_workbook(ruta_archivo)
    hoja_matriculas = materia["Matriculas"]
    hoja_estudiantes = materia["Estudiantes"]
    hoja_materias = materia["Materias"]

    fila_matricula = buscar_fila(hoja_matriculas, 0, id_matricula)
    if not fila_matricula:
        print("La matricula con ese ID no existe.")
        return

    id_estudiante = str(
        fila_matricula[1]
    ).strip()  # Permitir que el ID del estudiante sea tratado como una cadena de texto y eliminar espacios en blanco al inicio y al final.
    id_materia = str(
        fila_matricula[2]
    ).strip()  # Permitir que el ID del materia sea tratado como una cadena de texto y eliminar espacios en blanco al inicio y al final.
    fecha_matricula = fila_matricula[3]
    fecha_devolucion = fila_matricula[4]
    dias_mora = (
        fila_matricula[6]
        if len(fila_matricula) > 6 and fila_matricula[6] is not None
        else 0
    )  # Verificar si la fila tiene al menos 7 elementos antes de acceder al índice 6
    valor_mora = (
        fila_matricula[7]
        if len(fila_matricula) > 7 and fila_matricula[7] is not None
        else 0
    )  # Verificar si la fila tiene al menos 8 elementos antes de acceder al índice 7

    fila_estudiante = buscar_fila(hoja_estudiantes, 0, id_estudiante)
    nombre_estudiante = fila_estudiante[1] if fila_estudiante else "No registrado"

    fila_materia = buscar_fila(hoja_materias, 0, id_materia)
    nombre_materia = fila_materia[1] if fila_materia else "No registrado"

    fecha_actual = date.today().strftime("%Y-%m-%d")

    carpeta_facturas = Path(__file__).parent / "Facturas"
    carpeta_facturas.mkdir(exist_ok=True)

    archivo_pdf = carpeta_facturas / f"Factura_{id_matricula}.pdf"

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

    # logo
    logo_path = Path(__file__).parent / "logo.png"
    if logo_path.exists():
        logo = Image(str(logo_path), width=4 * cm, height=4 * cm)
    else:
        logo = Paragraph("Logo no disponible", estilo_texto)

    contenido = []
    contenido.append(logo)
    contenido.append(Spacer(1, 12))
    contenido.append(Paragraph("Factura de Matrículas", estilo_titulo))
    contenido.append(Paragraph(f"Fecha: {fecha_actual}", estilo_texto))
    contenido.append(Spacer(1, 12))

    datos_tabla = [
        ["Campo", "Valor"],
        ["ID Matrícula", str(id_matricula)],
        ["ID Estudiante", str(id_estudiante)],
        ["Nombre Estudiante", str(nombre_estudiante)],
        ["ID Materia", str(id_materia)],
        ["Nombre Materia", str(nombre_materia)],
        ["Fecha Matrícula", str(fecha_matricula)],
        ["Días Mora", str(dias_mora)],
        ["Valor Mora", f"${valor_mora:.2f}"],
    ]

    tabla = Table(datos_tabla, colWidths=[6 * cm, 10 * cm])
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (1, 0), colors.grey),
                ("TEXTCOLOR", (0, 0), (1, 0), colors.white),
                ("ALIGN", (0, 0), (1, 0), "CENTER"),
                ("FONTNAME", (0, 0), (1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (1, 0), 14),
                ("BOTTOMPADDING", (0, 0), (1, 0), 12),
                ("BACKGROUND", (0, 1), (1, -1), colors.beige),
                ("GRID", (0, 0), (1, -1), 1, colors.black),
            ]
        )
    )
    contenido.append(tabla)

    documento.build(contenido)
    print(f"Factura generada exitosamente: {archivo_pdf}")


def menu_principal():
    crear_archivo_excel()
    intentos = 0
    while intentos <= 3:
        print("""\n--- Menú Principal ---
1. Registrar estudiante
2. Registrar materia
3. Matricular estudiante
4. Generar recibo de matrícula
5. Salir""")
        opcion = input("Seleccione una opción: ").strip()
        if opcion == "1":
            registrar_estudiante()
        elif opcion == "2":
            registrar_materia()
        elif opcion == "3":
            registrar_matricula()
        elif opcion == "4":
            id_estudiante = texto_obligatorio("Ingrese la CC/TI del estudiante: ")
            generar_factura(id_estudiante)
        elif opcion == "5":
            print("Saliendo del programa...")
            break
        else:
            print("Opción no válida. Intente de nuevo.")
            intentos += 1
        if intentos == 3:
            print("Demasiados intentos fallidos! Abortando programa...")


if __name__ == "__main__":
    menu_principal()
