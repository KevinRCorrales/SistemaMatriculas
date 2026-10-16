import tkinter as tk
from tkinter import ttk

from rich.console import Console

consola = Console()


def button(
    root: tk.Tk,
    text: str,
    command,
    ancho: int = 30,
    estilo: str = "Accent.TButton",
    padx=5,
    pady=5,
):
    boton = ttk.Button(root, text=text, command=command, width=ancho, style=estilo)
    boton.pack(padx=padx, pady=pady)
