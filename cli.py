from rich.console import Console
from rich.table import Table

consola = Console()


def limpiar():
    consola.clear()


def error(texto: str):
    consola.print(f"[bold red]{texto}[/bold red]")


def prompt(texto: str = "", obligatorio: bool = True):
    if obligatorio:
        intentos = 0
        while intentos <= 3:
            valor: str = (
                consola.input(f"[bold blue]{texto}[/bold blue]").strip()  # Eliminar espacios en blanco al inicio y al final de la entrada del usuario
            )
            if valor:  # Si el valor no está vacío, se devuelve el valor ingresado
                return valor
            intentos += 1
            print("Este campo es obligatorio.")
        if intentos == 3:
            print("Demasiados intentos fallidos! Abortando...")
            return
    else:
        return consola.input(f"[bold blue]{texto}[/bold blue]").strip()


def tabla(cabeceras: list[str], titulo: str, contenidos: list[list[str]]):
    table = Table(*cabeceras, title=titulo)
    for contenido in contenidos:
        table.add_row(*contenido)
    consola.print(table)


if __name__ == "__main__":
    limpiar()
    error("Prueba de error.")
    estudiante = prompt("Ingrese el nombre: ")
    tabla(["ID", "Nombre"], "estudiantes", [["1", estudiante]])
