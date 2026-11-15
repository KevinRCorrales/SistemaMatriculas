"""API REST del sistema de matrículas (FastAPI + MariaDB).

Este archivo concentra todo el backend: configuración, acceso a datos,
validaciones de negocio y rutas HTTP. No importa Tkinter ni abre ventanas;
la lógica se extrajo de ``sistema.py`` respetando el esquema ``universidad.sql``.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
import unicodedata
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

import mariadb
from dotenv import dotenv_values
from fastapi import Depends, FastAPI, Header, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

RAIZ = Path(__file__).resolve().parent
CARPETA_WEB = RAIZ / "web"
CARPETA_DIST = CARPETA_WEB / "dist"
VALOR_CREDITO = 70_000
MAX_CREDITOS_MATRICULA = 16
NOTA_APROBACION = 3.0
FACULTADES_SERVICIO_GENERAL = ("HUMANIDADES", "INGLES")
DURACION_SESION_SEGUNDOS = 8 * 60 * 60
MAX_INTENTOS_ACCESO = 5
VENTANA_INTENTOS_SEGUNDOS = 60

RE_CORREO = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
RE_PERIODO = re.compile(r"^\d{4}-[12]$")
RE_TELEFONO = re.compile(r"^[0-9+\-]{7,20}$")

registro = logging.getLogger("matriculas")


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
def _leer_env() -> dict[str, str]:
    archivo = RAIZ / ".env"
    if not archivo.is_file():
        return {}
    return {clave.strip().lower(): valor for clave, valor in (dotenv_values(archivo).items()) if valor}


@lru_cache(maxsize=1)
def configuracion() -> dict[str, Any]:
    env = _leer_env()

    def tomar(*nombres: str, defecto: str = "") -> str:
        for nombre in nombres:
            valor = os.environ.get(nombre) or env.get(nombre.lower())
            if valor:
                return str(valor).strip()
        return defecto

    return {
        "usuario": tomar("DATABASE_USER", "USER"),
        "clave": tomar("DATABASE_PASSWORD", "PASSWORD"),
        "base": tomar("DATABASE_NAME", "DATABASE", defecto="universidad"),
        "host": tomar("DATABASE_HOST", "HOST", defecto="localhost"),
        "puerto": int(tomar("DATABASE_PORT", "PORT", defecto="3306")),
        "origen_frontend": tomar("FRONTEND_ORIGIN", defecto="http://127.0.0.1:3000"),
        "host_api": tomar("API_HOST", defecto="127.0.0.1"),
        "puerto_api": int(tomar("API_PORT", defecto="3000")),
        "recargar": tomar("API_RELOAD", defecto="false").lower() in {"1", "true", "si", "sí", "yes"},
        "clave_admin": tomar("ADMIN_PASSWORD", "ADMIN_CLAVE"),
        "clave_sesion": tomar("SESSION_SECRET", "SECRETO_SESION"),
    }


# ---------------------------------------------------------------------------
# Errores de negocio
# ---------------------------------------------------------------------------
class ErrorNegocio(Exception):
    """Error controlado que se devuelve al frontend como JSON."""

    def __init__(self, mensaje: str, campo: str | None = None, estado: int = 400) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.campo = campo
        self.estado = estado

    def como_dict(self) -> dict[str, Any]:
        datos: dict[str, Any] = {"mensaje": self.mensaje}
        if self.campo:
            datos["campo"] = self.campo
        return datos


# ---------------------------------------------------------------------------
# Sesiones y control de intentos
# ---------------------------------------------------------------------------
_CLAVE_FALLBACK = secrets.token_bytes(32)
_intentos_acceso: dict[str, list[float]] = {}
_tokens_revocados: dict[str, float] = {}


def _clave_sesion() -> bytes:
    """Clave de firma de los tokens de sesión.

    Se toma de ``SESSION_SECRET`` o, en su defecto, de la contraseña
    administrativa. Si no hay ninguna configurada se usa una clave aleatoria
    del proceso: las sesiones dejan de ser válidas al reiniciar el backend.
    """
    cfg = configuracion()
    material = cfg["clave_sesion"] or cfg["clave_admin"]
    if material:
        return hashlib.sha256(material.encode("utf-8")).digest()
    return _CLAVE_FALLBACK


def _huella(valor: Any) -> bytes:
    """Huella de longitud fija para comparar en tiempo constante."""
    return hashlib.sha256(str(valor or "").encode("utf-8")).digest()


def crear_token(rol: str, identificacion: str | None = None) -> str:
    emision = int(time.time())
    datos = {
        "rol": rol,
        "sub": identificacion,
        "iat": emision,
        "exp": emision + DURACION_SESION_SEGUNDOS,
    }
    cuerpo = (
        base64.urlsafe_b64encode(json.dumps(datos, separators=(",", ":")).encode("utf-8"))
        .decode("ascii")
        .rstrip("=")
    )
    firma = hmac.new(_clave_sesion(), cuerpo.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{cuerpo}.{firma}"


def verificar_token(token: str) -> dict[str, Any] | None:
    """Devuelve los datos del token si la firma y la vigencia son válidas."""
    try:
        cuerpo, firma = str(token or "").split(".", 1)
    except ValueError:
        return None

    esperada = hmac.new(_clave_sesion(), cuerpo.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(firma, esperada):
        return None

    revocado_hasta = _tokens_revocados.get(token)
    if revocado_hasta and revocado_hasta > time.time():
        return None

    try:
        relleno = "=" * (-len(cuerpo) % 4)
        datos = json.loads(base64.urlsafe_b64decode(cuerpo + relleno))
    except (ValueError, TypeError):
        return None

    if not isinstance(datos, dict) or datos.get("rol") not in {"estudiante", "administrativo"}:
        return None
    try:
        if int(datos.get("exp", 0)) <= int(time.time()):
            return None
    except (TypeError, ValueError):
        return None
    return datos


def sesion_desde_cabecera(authorization: str | None) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ErrorNegocio("Inicia sesión para continuar.", campo="sesion", estado=401)
    datos = verificar_token(authorization[7:].strip())
    if not datos:
        raise ErrorNegocio(
            "La sesión no es válida o expiró. Vuelve a iniciar sesión.",
            campo="sesion",
            estado=401,
        )
    return datos


def requiere_rol(*roles: str):
    """Dependencia de FastAPI que exige uno de los roles indicados."""

    def dependencia(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        sesion = sesion_desde_cabecera(authorization)
        if sesion["rol"] not in roles:
            raise ErrorNegocio(
                "Tu usuario no tiene permisos para acceder a esta sección.",
                campo="sesion",
                estado=403,
            )
        return sesion

    return dependencia


def exigir_acceso_propio(sesion: dict[str, Any], identificacion: str) -> None:
    """Un estudiante solo puede operar con su propia identificación."""
    if sesion["rol"] == "administrativo":
        return
    if not hmac.compare_digest(_huella(sesion.get("sub")), _huella(identificacion)):
        raise ErrorNegocio(
            "Solo puedes consultar tu propia información académica.",
            campo="identificacion",
            estado=403,
        )


SesionAdmin = Annotated[dict[str, Any], Depends(requiere_rol("administrativo"))]
SesionUsuario = Annotated[dict[str, Any], Depends(requiere_rol("estudiante", "administrativo"))]


def _clave_intentos(rol: str, request: Request) -> str:
    ip = request.client.host if request.client else "desconocida"
    return f"{rol}:{ip}"


def _limite_intentos_alcanzado(clave: str) -> bool:
    ahora = time.time()
    marcas = [marca for marca in _intentos_acceso.get(clave, []) if marca > ahora - VENTANA_INTENTOS_SEGUNDOS]
    _intentos_acceso[clave] = marcas
    return len(marcas) >= MAX_INTENTOS_ACCESO


def _registrar_intento_fallido(clave: str) -> None:
    _intentos_acceso.setdefault(clave, []).append(time.time())


# ---------------------------------------------------------------------------
# Conexión y transacciones
# ---------------------------------------------------------------------------
def abrir_conexion() -> mariadb.Connection:
    cfg = configuracion()
    if not cfg["usuario"] or not cfg["clave"]:
        raise ErrorNegocio(
            "Faltan las credenciales de MariaDB. Define DATABASE_USER y DATABASE_PASSWORD en el archivo .env.",
            estado=503,
        )
    try:
        return mariadb.connect(
            user=cfg["usuario"],
            password=cfg["clave"],
            host=cfg["host"],
            port=cfg["puerto"],
            database=cfg["base"],
            autocommit=False,
        )
    except mariadb.Error as exc:
        raise ErrorNegocio(
            f"No fue posible conectar con MariaDB ({cfg['host']}:{cfg['puerto']}/{cfg['base']}): {exc}",
            estado=503,
        ) from exc


@contextmanager
def conexion() -> Iterator[mariadb.Connection]:
    con = abrir_conexion()
    try:
        yield con
    finally:
        con.close()


@contextmanager
def lectura() -> Iterator[mariadb.Cursor]:
    with conexion() as con:
        cur = con.cursor()
        try:
            yield cur
        finally:
            cur.close()


@contextmanager
def transaccion() -> Iterator[mariadb.Cursor]:
    """Una sola conexión, commit al final y rollback ante cualquier fallo."""
    with conexion() as con:
        cur = con.cursor()
        try:
            yield cur
            con.commit()
        except BaseException:
            con.rollback()
            raise
        finally:
            cur.close()


def estado_base_de_datos() -> dict[str, Any]:
    cfg = configuracion()
    try:
        with lectura() as cur:
            cur.execute("SELECT VERSION()")
            fila = cur.fetchone()
        return {"estado": "conectado", "version": str(fila[0]) if fila else "", "base": cfg["base"]}
    except ErrorNegocio as exc:
        return {"estado": "no_conectado", "detalle": exc.mensaje}
    except mariadb.Error as exc:
        return {"estado": "no_conectado", "detalle": str(exc)}


# ---------------------------------------------------------------------------
# Validaciones de negocio
# ---------------------------------------------------------------------------
def texto_limpio(valor: Any) -> str:
    return " ".join(str(valor or "").split())


def validar_facultad(nombre: str) -> str:
    valor = texto_limpio(nombre)
    if len(valor) < 3:
        raise ErrorNegocio("El nombre de la facultad debe tener al menos 3 caracteres.", "nombre")
    if len(valor) > 15:
        raise ErrorNegocio("El nombre de la facultad no puede superar 15 caracteres.", "nombre")
    if any(caracter.isdigit() for caracter in valor):
        raise ErrorNegocio("El nombre de la facultad no debe contener números.", "nombre")
    return valor


def validar_carrera(nombre: str) -> str:
    valor = texto_limpio(nombre)
    if len(valor) < 3:
        raise ErrorNegocio("El nombre de la carrera debe tener al menos 3 caracteres.", "nombre")
    if len(valor) > 30:
        raise ErrorNegocio("El nombre de la carrera no puede superar 30 caracteres.", "nombre")
    if any(caracter.isdigit() for caracter in valor):
        raise ErrorNegocio("El nombre de la carrera no debe contener números.", "nombre")
    return valor


def validar_documento(documento: str) -> str:
    valor = str(documento or "").strip()
    if not valor.isdigit():
        raise ErrorNegocio("La cédula debe contener solo números.", "documento")
    if len(valor) < 6 or len(valor) > 20:
        raise ErrorNegocio("La cédula debe tener entre 6 y 20 dígitos.", "documento")
    return valor


def validar_correo(correo: str) -> str:
    valor = str(correo or "").strip().lower()
    if len(valor) > 70:
        raise ErrorNegocio("El correo no puede superar 70 caracteres.", "correo")
    if not RE_CORREO.match(valor):
        raise ErrorNegocio(
            "El correo electrónico no tiene un formato válido. Ejemplo: nombre@universidad.edu.co",
            "correo",
        )
    return valor


def validar_telefono(telefono: str) -> str:
    valor = str(telefono or "").strip()
    if not RE_TELEFONO.match(valor):
        raise ErrorNegocio("El teléfono debe tener entre 7 y 20 caracteres numéricos, con + o - opcionales.", "telefono")
    return valor


def validar_nombres(nombres: str, apellidos: str) -> tuple[str, str]:
    nombre = texto_limpio(nombres)
    apellido = texto_limpio(apellidos)
    if len(nombre) < 2:
        raise ErrorNegocio("El nombre debe tener al menos 2 caracteres.", "nombres")
    if len(nombre) > 50:
        raise ErrorNegocio("El nombre no puede superar 50 caracteres.", "nombres")
    if len(apellido) < 2:
        raise ErrorNegocio("El apellido debe tener al menos 2 caracteres.", "apellidos")
    if len(apellido) > 50:
        raise ErrorNegocio("El apellido no puede superar 50 caracteres.", "apellidos")
    return nombre, apellido


def validar_periodo(periodo: str) -> str:
    valor = str(periodo or "").strip()
    if not RE_PERIODO.match(valor):
        raise ErrorNegocio("El periodo debe tener el formato AAAA-1 o AAAA-2, por ejemplo 2026-2.", "periodo")
    return valor


def validar_materia(datos: MateriaEntrada) -> dict[str, Any]:
    if datos.id <= 100_000:
        raise ErrorNegocio("El código de la materia debe ser un número entero mayor a 100000.", "id")
    nombre = texto_limpio(datos.nombre)
    if len(nombre) < 3:
        raise ErrorNegocio("El nombre de la materia debe tener al menos 3 caracteres.", "nombre")
    if len(nombre) > 30:
        raise ErrorNegocio("El nombre de la materia no puede superar 30 caracteres.", "nombre")
    if datos.creditos < 1 or datos.creditos > 4:
        raise ErrorNegocio("Los créditos deben estar entre 1 y 4.", "creditos")
    if datos.cupos < 1 or datos.cupos > 50:
        raise ErrorNegocio("Los cupos deben estar entre 1 y 50.", "cupos")
    horario = texto_limpio(datos.horario)
    if len(horario) < 3:
        raise ErrorNegocio("El horario debe tener al menos 3 caracteres.", "horario")
    if len(horario) > 40:
        raise ErrorNegocio("El horario no puede superar 40 caracteres.", "horario")
    return {
        "id": datos.id,
        "nombre": nombre.upper(),
        "creditos": datos.creditos,
        "id_facultad": datos.idFacultad,
        "periodo": validar_periodo(datos.periodo),
        "cupos": datos.cupos,
        "horario": horario.upper(),
    }


def validar_notas(nota1: float, nota2: float, nota3: float) -> tuple[float, float, float, float]:
    notas = (float(nota1), float(nota2), float(nota3))
    for indice, nota in enumerate(notas, start=1):
        if nota > 5.0:
            raise ErrorNegocio("Las notas deben estar entre 0.0 y 5.0.", f"nota{indice}")
        if nota <= 0.0:
            raise ErrorNegocio(
                "Cada nota debe ser mayor que 0.0: el esquema universidad.sql define CHECK (NOTA_x > 0.0).",
                f"nota{indice}",
            )
    if notas == (0.0, 0.0, 0.0):
        raise ErrorNegocio("Las notas no pueden ser todas cero.", "nota1")
    promedio = round(sum(notas) / 3, 2)
    return notas[0], notas[1], notas[2], promedio


# ---------------------------------------------------------------------------
# Utilidades de dominio
# ---------------------------------------------------------------------------
def periodo_actual(fecha: date | None = None) -> str:
    hoy = fecha or date.today()
    return f"{hoy.year}-{'1' if hoy.month <= 6 else '2'}"


def es_servicio_general(facultad: str) -> bool:
    nombre = unicodedata.normalize("NFD", texto_limpio(facultad).upper())
    sin_tildes = "".join(letra for letra in nombre if unicodedata.category(letra) != "Mn")
    return sin_tildes in FACULTADES_SERVICIO_GENERAL


def validar_creditos_periodo(creditos_previos: int, creditos_nuevos: int, periodo: str) -> int:
    """Aplica el tope de 16 créditos acumulados en el periodo y devuelve el total."""
    total = int(creditos_previos) + int(creditos_nuevos)
    if total <= MAX_CREDITOS_MATRICULA:
        return total

    disponibles = max(MAX_CREDITOS_MATRICULA - int(creditos_previos), 0)
    if disponibles == 0:
        detalle = (
            f"El estudiante ya alcanzó el máximo de {MAX_CREDITOS_MATRICULA} créditos "
            f"en el periodo {periodo}."
        )
    else:
        detalle = (
            f"El estudiante ya tiene {int(creditos_previos)} crédito(s) matriculados en {periodo} "
            f"y solo puede matricular {disponibles} más "
            f"(máximo {MAX_CREDITOS_MATRICULA} créditos por periodo)."
        )
    raise ErrorNegocio(detalle, "materias")


def _siguiente_consecutivo(cur: mariadb.Cursor) -> int:
    sufijo = date.today().strftime("%d%m%y")
    cur.execute(
        "SELECT MAX(ID_MATRICULA) FROM MATRICULAS WHERE RIGHT(CAST(ID_MATRICULA AS CHAR), 6) = ?",
        (sufijo,),
    )
    fila = cur.fetchone()
    maximo = int(fila[0]) if fila and fila[0] is not None else 0
    if not maximo:
        return 1
    prefijo = str(maximo)[:-6]
    return int(prefijo or 0) + 1


def generar_id_matricula(consecutivo: int) -> int:
    sufijo = date.today().strftime("%d%m%y")
    return int(f"{consecutivo}{sufijo}")


# ---------------------------------------------------------------------------
# Choque de horarios
# ---------------------------------------------------------------------------
DIAS_SEMANA = {
    "LUNES": ("LUNES", "LUN"),
    "MARTES": ("MARTES", "MAR"),
    "MIERCOLES": ("MIERCOLES", "MIE"),
    "JUEVES": ("JUEVES", "JUE"),
    "VIERNES": ("VIERNES", "VIE"),
    "SABADO": ("SABADO", "SAB"),
    "DOMINGO": ("DOMINGO", "DOM"),
}

RE_HORA = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A\.M\.|P\.M\.)?", re.IGNORECASE)


def _normalizar_horario(texto: str) -> str:
    sin_acentos = "".join(
        caracter
        for caracter in unicodedata.normalize("NFD", str(texto or ""))
        if unicodedata.category(caracter) != "Mn"
    )
    return " ".join(sin_acentos.upper().split())


def _minutos(hora: str, minutos: str | None, meridiano: str | None) -> int | None:
    """Convierte una hora del horario a minutos desde la medianoche."""
    valor = int(hora)
    minuto = int(minutos) if minutos else 0
    if valor > 23 or minuto > 59:
        return None
    sufijo = (meridiano or "").replace(".", "").upper()
    if sufijo == "AM":
        valor = 0 if valor == 12 else valor
    elif sufijo == "PM":
        valor = valor + 12 if valor < 12 else valor
    elif valor <= 7:  # "MARTES 2:00-6:00" sin AM/PM se interpreta como tarde
        valor += 12
    return valor * 60 + minuto


def franjas_horario(horario: str) -> list[tuple[str, int, int]]:
    """Extrae (día, minuto inicial, minuto final) de textos como ``MARTES 1:00PM-4:00PM``.

    Si el texto no se puede interpretar se devuelve una lista vacía para no bloquear
    matrículas por formatos que la plataforma no reconoce.
    """
    texto = _normalizar_horario(horario)
    dias = [
        dia
        for dia, alias in DIAS_SEMANA.items()
        if any(re.search(rf"\b{alias_dia}\b", texto) for alias_dia in alias)
    ]
    if not dias:
        return []

    minutos: list[int] = []
    for coincidencia in RE_HORA.finditer(texto):
        hora, minuto, meridiano = coincidencia.groups()
        valor = _minutos(hora, minuto, meridiano)
        if valor is not None:
            minutos.append(valor)
    if len(minutos) < 2:
        return []

    inicio, fin = minutos[0], minutos[1]
    if fin <= inicio:
        return []
    return [(dia, inicio, fin) for dia in dias]


def conflicto_horario(materias: list[tuple[str, str]]) -> str | None:
    """Devuelve un mensaje si dos materias se cruzan en el mismo día.

    Los extremos que solo se tocan no son conflicto: 10:00AM-2:00PM y
    2:00PM-6:00PM pueden convivir.
    """
    franjas: list[tuple[str, str, str, int, int]] = []
    for nombre, horario in materias:
        for dia, inicio, fin in franjas_horario(horario):
            for otro_nombre, otro_horario, otro_dia, otro_inicio, otro_fin in franjas:
                if dia == otro_dia and inicio < otro_fin and otro_inicio < fin:
                    return (
                        f"Conflicto de horario: {nombre} ({horario}) se cruza con "
                        f"{otro_nombre} ({otro_horario}) el {dia.lower()}. "
                        "Elige materias con horarios que no se solapen."
                    )
            franjas.append((nombre, horario, dia, inicio, fin))
    return None


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------
def listar_facultades() -> list[dict[str, Any]]:
    with lectura() as cur:
        cur.execute("SELECT ID, NOMBRE FROM FACULTADES ORDER BY NOMBRE")
        return [{"id": int(fila[0]), "nombre": str(fila[1]).strip()} for fila in cur.fetchall()]


def listar_carreras() -> list[dict[str, Any]]:
    with lectura() as cur:
        cur.execute(
            """
            SELECT C.ID, C.NOMBRE, C.ID_FACULTAD, F.NOMBRE
            FROM CARRERAS C
            JOIN FACULTADES F ON F.ID = C.ID_FACULTAD
            ORDER BY C.NOMBRE
            """
        )
        return [
            {
                "id": int(fila[0]),
                "nombre": str(fila[1]).strip(),
                "idFacultad": int(fila[2]),
                "facultad": str(fila[3]).strip(),
            }
            for fila in cur.fetchall()
        ]


def listar_estudiantes() -> list[dict[str, Any]]:
    with lectura() as cur:
        cur.execute(
            """
            SELECT E.IDENTIFICACION, E.NOMBRES, E.APELLIDOS, E.CORREO, E.TELEFONO,
                   E.ID_CARRERA, C.NOMBRE, F.NOMBRE
            FROM ESTUDIANTES E
            JOIN CARRERAS C ON C.ID = E.ID_CARRERA
            JOIN FACULTADES F ON F.ID = C.ID_FACULTAD
            ORDER BY E.APELLIDOS, E.NOMBRES
            """
        )
        return [
            {
                "identificacion": str(fila[0]).strip(),
                "nombres": str(fila[1]).strip(),
                "apellidos": str(fila[2]).strip(),
                "correo": str(fila[3]).strip(),
                "telefono": str(fila[4]).strip(),
                "idCarrera": int(fila[5]),
                "carrera": str(fila[6]).strip(),
                "facultad": str(fila[7]).strip(),
            }
            for fila in cur.fetchall()
        ]


def obtener_estudiante(identificacion: str) -> dict[str, Any] | None:
    with lectura() as cur:
        cur.execute(
            """
            SELECT E.IDENTIFICACION, E.NOMBRES, E.APELLIDOS, E.CORREO, E.TELEFONO,
                   E.ID_CARRERA, C.NOMBRE, F.NOMBRE, C.ID_FACULTAD
            FROM ESTUDIANTES E
            JOIN CARRERAS C ON C.ID = E.ID_CARRERA
            JOIN FACULTADES F ON F.ID = C.ID_FACULTAD
            WHERE E.IDENTIFICACION = ?
            """,
            (identificacion,),
        )
        fila = cur.fetchone()
    if not fila:
        return None
    return {
        "identificacion": str(fila[0]).strip(),
        "nombres": str(fila[1]).strip(),
        "apellidos": str(fila[2]).strip(),
        "correo": str(fila[3]).strip(),
        "telefono": str(fila[4]).strip(),
        "idCarrera": int(fila[5]),
        "carrera": str(fila[6]).strip(),
        "facultad": str(fila[7]).strip(),
        "idFacultad": int(fila[8]),
    }


# ---------------------------------------------------------------------------
# Autenticación
# ---------------------------------------------------------------------------
def autenticar_estudiante(correo: str, identificacion: str) -> dict[str, Any]:
    """Valida correo + documento sin revelar cuál de los dos falló.

    Se comparan huellas de longitud fija con ``hmac.compare_digest`` y, cuando
    el documento no existe, se compara igualmente contra valores vacíos para
    que el tiempo de respuesta no delate cuentas registradas.
    """
    correo_normalizado = str(correo or "").strip().lower()
    documento = str(identificacion or "").strip()

    with lectura() as cur:
        cur.execute(
            "SELECT IDENTIFICACION, CORREO FROM ESTUDIANTES WHERE IDENTIFICACION = ?",
            (documento,),
        )
        fila = cur.fetchone()

    correo_bd = str(fila[1]).strip().lower() if fila else ""
    documento_bd = str(fila[0]).strip() if fila else ""
    coincide_correo = hmac.compare_digest(_huella(correo_normalizado), _huella(correo_bd))
    coincide_documento = hmac.compare_digest(_huella(documento), _huella(documento_bd))

    if not (fila and coincide_correo and coincide_documento):
        raise ErrorNegocio(
            "El correo y la identificación no coinciden con un estudiante registrado.",
            campo="acceso",
            estado=401,
        )

    perfil = obtener_estudiante(documento_bd)
    if not perfil:
        raise ErrorNegocio(
            "El correo y la identificación no coinciden con un estudiante registrado.",
            campo="acceso",
            estado=401,
        )
    return perfil


def listar_materias() -> list[dict[str, Any]]:
    with lectura() as cur:
        cur.execute(
            """
            SELECT M.ID, M.NOMBRE, M.CREDITOS, M.ID_FACULTAD, M.PERIODO, M.CUPOS, M.HORARIO, F.NOMBRE
            FROM MATERIAS M
            JOIN FACULTADES F ON F.ID = M.ID_FACULTAD
            ORDER BY M.NOMBRE
            """
        )
        return [
            {
                "id": int(fila[0]),
                "nombre": str(fila[1]).strip(),
                "creditos": int(fila[2]),
                "idFacultad": int(fila[3]),
                "periodo": str(fila[4]).strip(),
                "cupos": int(fila[5]),
                "horario": str(fila[6]).strip(),
                "facultad": str(fila[7]).strip(),
            }
            for fila in cur.fetchall()
        ]


def materias_disponibles(identificacion: str, periodo: str) -> list[dict[str, Any]]:
    with lectura() as cur:
        cur.execute(
            """
            SELECT DISTINCT M.ID, M.NOMBRE, M.CREDITOS, M.ID_FACULTAD, M.PERIODO,
                            M.CUPOS, M.HORARIO, F.NOMBRE
            FROM MATERIAS M
            JOIN FACULTADES F ON F.ID = M.ID_FACULTAD
            WHERE M.PERIODO = ?
              AND (
                    F.ID = (SELECT C.ID_FACULTAD
                            FROM ESTUDIANTES E
                            JOIN CARRERAS C ON C.ID = E.ID_CARRERA
                            WHERE E.IDENTIFICACION = ?)
                    OR UPPER(F.NOMBRE) IN ('HUMANIDADES', 'INGLES', 'INGLÉS')
                  )
            ORDER BY M.NOMBRE
            """,
            (periodo, identificacion),
        )
        filas = cur.fetchall()
    return [
        {
            "id": int(fila[0]),
            "nombre": str(fila[1]).strip(),
            "creditos": int(fila[2]),
            "idFacultad": int(fila[3]),
            "periodo": str(fila[4]).strip(),
            "cupos": int(fila[5]),
            "horario": str(fila[6]).strip(),
            "facultad": str(fila[7]).strip(),
            "esServicioGeneral": es_servicio_general(str(fila[7])),
        }
        for fila in filas
    ]


def listar_matriculas(identificacion: str, periodo: str | None = None) -> list[dict[str, Any]]:
    consulta = """
        SELECT MT.ID_MATRICULA, MT.COD_MATERIA, MT.PERIODO, MT.FECHA_MATRICULA,
               M.NOMBRE, M.CREDITOS, M.ID_FACULTAD, M.HORARIO, M.CUPOS,
               N.NOTA_1, N.NOTA_2, N.NOTA_3, N.PROMEDIO
        FROM MATRICULAS MT
        JOIN MATERIAS M ON M.ID = MT.COD_MATERIA
        LEFT JOIN NOTAS N ON N.ID_MATRICULA = MT.ID_MATRICULA
        WHERE MT.IDENTIFICACION = ?
    """
    parametros: list[Any] = [identificacion]
    if periodo:
        consulta += " AND MT.PERIODO = ?"
        parametros.append(periodo)
    consulta += " ORDER BY MT.PERIODO DESC, M.NOMBRE"

    with lectura() as cur:
        cur.execute(consulta, tuple(parametros))
        filas = cur.fetchall()

    resultado: list[dict[str, Any]] = []
    for fila in filas:
        nota = None
        if fila[9] is not None:
            nota = {
                "nota1": float(fila[9]),
                "nota2": float(fila[10]),
                "nota3": float(fila[11]),
                "promedio": float(fila[12]),
            }
        resultado.append(
            {
                "idMatricula": int(fila[0]),
                "codMateria": int(fila[1]),
                "periodo": str(fila[2]).strip(),
                "fechaMatricula": fila[3].isoformat() if hasattr(fila[3], "isoformat") else str(fila[3]),
                "nombreMateria": str(fila[4]).strip(),
                "creditos": int(fila[5]),
                "idFacultad": int(fila[6]),
                "horario": str(fila[7]).strip(),
                "cupos": int(fila[8]),
                "periodoMateria": str(fila[2]).strip(),
                "nota": nota,
            }
        )
    return resultado


def listar_periodos(identificacion: str) -> list[str]:
    with lectura() as cur:
        cur.execute(
            "SELECT DISTINCT PERIODO FROM MATRICULAS WHERE IDENTIFICACION = ? ORDER BY PERIODO DESC",
            (identificacion,),
        )
        return [str(fila[0]).strip() for fila in cur.fetchall()]


# ---------------------------------------------------------------------------
# Escrituras
# ---------------------------------------------------------------------------
def crear_facultad(nombre: str) -> dict[str, Any]:
    valor = validar_facultad(nombre)
    with transaccion() as cur:
        cur.execute("SELECT ID FROM FACULTADES WHERE UPPER(NOMBRE) = UPPER(?)", (valor,))
        if cur.fetchone():
            raise ErrorNegocio("Ya existe una facultad con ese nombre.", "nombre")
        cur.execute("INSERT INTO FACULTADES (NOMBRE) VALUES (?)", (valor,))
        nuevo_id = cur.lastrowid
    return {"id": int(nuevo_id), "nombre": valor}


def crear_carrera(nombre: str, id_facultad: int) -> dict[str, Any]:
    valor = validar_carrera(nombre)
    with transaccion() as cur:
        cur.execute("SELECT ID FROM FACULTADES WHERE ID = ?", (id_facultad,))
        if not cur.fetchone():
            raise ErrorNegocio("La facultad seleccionada no existe.", "idFacultad")
        cur.execute("SELECT ID FROM CARRERAS WHERE UPPER(NOMBRE) = UPPER(?)", (valor,))
        if cur.fetchone():
            raise ErrorNegocio("Ya existe una carrera con ese nombre.", "nombre")
        cur.execute("INSERT INTO CARRERAS (NOMBRE, ID_FACULTAD) VALUES (?, ?)", (valor, id_facultad))
        nuevo_id = cur.lastrowid
    return {"id": int(nuevo_id), "nombre": valor, "idFacultad": id_facultad}


def crear_estudiante(
    documento: str,
    nombres: str,
    apellidos: str,
    correo: str,
    telefono: str,
    id_carrera: int,
) -> dict[str, Any]:
    identificacion = validar_documento(documento)
    nombre, apellido = validar_nombres(nombres, apellidos)
    correo_limpio = validar_correo(correo)
    telefono_limpio = validar_telefono(telefono)

    with transaccion() as cur:
        cur.execute("SELECT ID, NOMBRE, ID_FACULTAD FROM CARRERAS WHERE ID = ?", (id_carrera,))
        carrera = cur.fetchone()
        if not carrera:
            raise ErrorNegocio("La carrera seleccionada no existe.", "idCarrera")

        cur.execute(
            """
            SELECT IDENTIFICACION, CORREO, TELEFONO
            FROM ESTUDIANTES
            WHERE IDENTIFICACION = ? OR UPPER(CORREO) = UPPER(?) OR TELEFONO = ?
            """,
            (identificacion, correo_limpio, telefono_limpio),
        )
        for fila in cur.fetchall():
            if str(fila[0]).strip() == identificacion:
                raise ErrorNegocio("Ya existe un estudiante con ese documento.", "documento")
            if str(fila[1]).strip().lower() == correo_limpio:
                raise ErrorNegocio("El correo electrónico ya está registrado.", "correo")
            if str(fila[2]).strip() == telefono_limpio:
                raise ErrorNegocio("El teléfono ya está registrado.", "telefono")

        cur.execute(
            """
            INSERT INTO ESTUDIANTES (IDENTIFICACION, NOMBRES, APELLIDOS, CORREO, TELEFONO, ID_CARRERA)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (identificacion, nombre.upper(), apellido.upper(), correo_limpio, telefono_limpio, id_carrera),
        )

    return {
        "identificacion": identificacion,
        "nombres": nombre.upper(),
        "apellidos": apellido.upper(),
        "correo": correo_limpio,
        "telefono": telefono_limpio,
        "idCarrera": id_carrera,
        "facultad": str(carrera[2]),
    }


def crear_materia(datos: MateriaEntrada) -> dict[str, Any]:
    valores = validar_materia(datos)
    with transaccion() as cur:
        cur.execute("SELECT ID, NOMBRE FROM FACULTADES WHERE ID = ?", (valores["id_facultad"],))
        facultad = cur.fetchone()
        if not facultad:
            raise ErrorNegocio("La facultad seleccionada no existe.", "idFacultad")
        cur.execute("SELECT ID FROM MATERIAS WHERE ID = ?", (valores["id"],))
        if cur.fetchone():
            raise ErrorNegocio("Ya existe una materia con ese código.", "id")
        cur.execute(
            """
            INSERT INTO MATERIAS (ID, NOMBRE, CREDITOS, ID_FACULTAD, PERIODO, CUPOS, HORARIO)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                valores["id"],
                valores["nombre"],
                valores["creditos"],
                valores["id_facultad"],
                valores["periodo"],
                valores["cupos"],
                valores["horario"],
            ),
        )
    return {
        "id": valores["id"],
        "nombre": valores["nombre"],
        "creditos": valores["creditos"],
        "idFacultad": valores["id_facultad"],
        "periodo": valores["periodo"],
        "cupos": valores["cupos"],
        "horario": valores["horario"],
        "facultad": str(facultad[1]).strip(),
    }


def registrar_matricula(identificacion: str, periodo: str, codigos: list[int]) -> dict[str, Any]:
    """Matricula varias materias de forma atómica (todo o nada)."""
    periodo_limpio = validar_periodo(periodo)
    identificacion = str(identificacion or "").strip()
    if not identificacion:
        raise ErrorNegocio("Selecciona el estudiante que deseas matricular.", "identificacion")

    pedidos = list(dict.fromkeys(int(codigo) for codigo in codigos))
    if not pedidos:
        raise ErrorNegocio("Selecciona al menos una materia para continuar.", "materias")

    hoy = date.today()
    marcadores = ", ".join(["?"] * len(pedidos))

    with transaccion() as cur:
        cur.execute(
            """
            SELECT E.IDENTIFICACION, C.ID_FACULTAD, F.NOMBRE
            FROM ESTUDIANTES E
            JOIN CARRERAS C ON C.ID = E.ID_CARRERA
            JOIN FACULTADES F ON F.ID = C.ID_FACULTAD
            WHERE E.IDENTIFICACION = ?
            """,
            (identificacion,),
        )
        estudiante = cur.fetchone()
        if not estudiante:
            raise ErrorNegocio("El estudiante seleccionado no existe.", "identificacion")
        id_facultad_estudiante = int(estudiante[1])

        cur.execute(
            f"""
            SELECT M.ID, M.NOMBRE, M.CREDITOS, M.ID_FACULTAD, M.PERIODO, M.CUPOS, M.HORARIO
            FROM MATERIAS M
            WHERE M.ID IN ({marcadores})
            FOR UPDATE
            """,
            tuple(pedidos),
        )
        encontradas = {int(fila[0]): fila for fila in cur.fetchall()}

        cur.execute("SELECT ID, NOMBRE FROM FACULTADES")
        facultades = {int(fila[0]): str(fila[1]).strip() for fila in cur.fetchall()}

        seleccionadas: list[tuple[Any, ...]] = []
        for codigo in pedidos:
            fila = encontradas.get(codigo)
            if not fila:
                raise ErrorNegocio(f"La materia {codigo} no existe.", "materias")
            if str(fila[4]).strip() != periodo_limpio:
                raise ErrorNegocio(
                    f"La materia {str(fila[1]).strip()} no pertenece al periodo {periodo_limpio}.",
                    "materias",
                )
            if int(fila[5]) <= 0:
                raise ErrorNegocio(
                    f"No hay cupos disponibles para la materia {str(fila[1]).strip()}.",
                    "materias",
                )
            facultad_materia = facultades.get(int(fila[3]), "")
            if int(fila[3]) != id_facultad_estudiante and not es_servicio_general(facultad_materia):
                raise ErrorNegocio(
                    f"La materia {str(fila[1]).strip()} no pertenece a la facultad del estudiante "
                    "ni es de Humanidades o Inglés.",
                    "materias",
                )
            seleccionadas.append(fila)

        cur.execute(
            f"""
            SELECT COD_MATERIA FROM MATRICULAS
            WHERE IDENTIFICACION = ? AND PERIODO = ? AND COD_MATERIA IN ({marcadores})
            """,
            (identificacion, periodo_limpio, *pedidos),
        )
        ya_matriculadas = {int(fila[0]) for fila in cur.fetchall()}
        repetidas = [str(f[1]).strip() for f in seleccionadas if int(f[0]) in ya_matriculadas]
        if repetidas:
            raise ErrorNegocio(
                f"El estudiante ya tiene matriculada(s) la(s) materia(s): {', '.join(repetidas)}.",
                "materias",
            )

        cur.execute(
            """
            SELECT M.NOMBRE, M.HORARIO
            FROM MATRICULAS MT
            JOIN MATERIAS M ON M.ID = MT.COD_MATERIA
            WHERE MT.IDENTIFICACION = ? AND MT.PERIODO = ?
            """,
            (identificacion, periodo_limpio),
        )
        horarios_previos = [
            (str(nombre).strip(), str(horario or "").strip())
            for nombre, horario in cur.fetchall()
        ]
        nuevas = [(str(fila[1]).strip(), str(fila[6]).strip()) for fila in seleccionadas]
        mensaje_conflicto = conflicto_horario(horarios_previos + nuevas)
        if mensaje_conflicto:
            raise ErrorNegocio(mensaje_conflicto, "materias")

        total_creditos = sum(int(fila[2]) for fila in seleccionadas)
        if total_creditos < 2:
            raise ErrorNegocio(
                f"Faltan {2 - total_creditos} crédito(s) para alcanzar el mínimo de 2 créditos.",
                "materias",
            )

        cur.execute(
            """
            SELECT COALESCE(SUM(M.CREDITOS), 0)
            FROM MATRICULAS MT
            JOIN MATERIAS M ON M.ID = MT.COD_MATERIA
            WHERE MT.IDENTIFICACION = ? AND MT.PERIODO = ?
            """,
            (identificacion, periodo_limpio),
        )
        creditos_previos = int(cur.fetchone()[0] or 0)
        creditos_periodo = creditos_previos + total_creditos
        validar_creditos_periodo(creditos_previos, total_creditos, periodo_limpio)

        consecutivo = _siguiente_consecutivo(cur)
        matriculas: list[dict[str, Any]] = []

        for indice, fila in enumerate(seleccionadas):
            id_matricula = generar_id_matricula(consecutivo + indice)
            cur.execute(
                """
                INSERT INTO MATRICULAS (ID_MATRICULA, IDENTIFICACION, COD_MATERIA, PERIODO, FECHA_MATRICULA)
                VALUES (?, ?, ?, ?, ?)
                """,
                (id_matricula, identificacion, int(fila[0]), periodo_limpio, hoy.isoformat()),
            )
            cur.execute(
                "UPDATE MATERIAS SET CUPOS = CUPOS - 1 WHERE ID = ? AND CUPOS > 0",
                (int(fila[0]),),
            )
            if cur.rowcount != 1:
                raise ErrorNegocio(
                    f"Los cupos de la materia {str(fila[1]).strip()} se agotaron durante la matrícula.",
                    "materias",
                )
            matriculas.append(
                {
                    "idMatricula": id_matricula,
                    "identificacion": identificacion,
                    "codMateria": int(fila[0]),
                    "periodo": periodo_limpio,
                    "fechaMatricula": hoy.isoformat(),
                    "nombreMateria": str(fila[1]).strip(),
                    "creditos": int(fila[2]),
                    "horario": str(fila[6]).strip(),
                    "periodoMateria": str(fila[4]).strip(),
                    "cupos": int(fila[5]) - 1,
                    "nota": None,
                }
            )

    return {
        "matriculas": matriculas,
        "periodo": periodo_limpio,
        "totalCreditos": total_creditos,
        "creditosPrevios": creditos_previos,
        "creditosPeriodo": creditos_periodo,
        "creditosDisponibles": MAX_CREDITOS_MATRICULA - creditos_periodo,
    }


def registrar_notas(id_matricula: int, nota1: float, nota2: float, nota3: float) -> dict[str, Any]:
    n1, n2, n3, promedio = validar_notas(nota1, nota2, nota3)

    with transaccion() as cur:
        cur.execute(
            """
            SELECT M.NOMBRE, MT.IDENTIFICACION
            FROM MATRICULAS MT
            JOIN MATERIAS M ON M.ID = MT.COD_MATERIA
            WHERE MT.ID_MATRICULA = ?
            """,
            (id_matricula,),
        )
        fila = cur.fetchone()
        if not fila:
            raise ErrorNegocio("La matrícula seleccionada no existe.", "idMatricula")

        cur.execute("SELECT ID_NOTAS FROM NOTAS WHERE ID_MATRICULA = ?", (id_matricula,))
        if cur.fetchone():
            raise ErrorNegocio("Esta materia ya tiene notas registradas.", "idMatricula")

        cur.execute(
            """
            INSERT INTO NOTAS (ID_MATRICULA, NOTA_1, NOTA_2, NOTA_3, PROMEDIO)
            VALUES (?, ?, ?, ?, ?)
            """,
            (id_matricula, n1, n2, n3, promedio),
        )

    return {
        "idMatricula": id_matricula,
        "nombreMateria": str(fila[0]).strip(),
        "identificacion": str(fila[1]).strip(),
        "nota1": n1,
        "nota2": n2,
        "nota3": n3,
        "promedio": promedio,
        "aprobada": promedio >= NOTA_APROBACION,
    }


def obtener_recibo(identificacion: str, periodo: str) -> dict[str, Any]:
    periodo_limpio = validar_periodo(periodo)
    estudiante = obtener_estudiante(identificacion)
    if not estudiante:
        raise ErrorNegocio("El estudiante seleccionado no existe.", "identificacion", estado=404)

    matriculas = listar_matriculas(identificacion, periodo_limpio)
    if not matriculas:
        raise ErrorNegocio(
            f"El estudiante no tiene matrículas registradas en el periodo {periodo_limpio}.",
            "periodo",
            estado=404,
        )

    detalle = [
        {
            "idMatricula": matricula["idMatricula"],
            "codMateria": matricula["codMateria"],
            "nombreMateria": matricula["nombreMateria"],
            "creditos": matricula["creditos"],
            "periodoMateria": matricula["periodoMateria"],
            "horario": matricula["horario"],
            "valorCredito": VALOR_CREDITO,
            "subtotal": matricula["creditos"] * VALOR_CREDITO,
            "nota": matricula["nota"],
        }
        for matricula in matriculas
    ]
    total_creditos = sum(item["creditos"] for item in detalle)

    return {
        "numero": f"REC-{periodo_limpio}-{detalle[0]['idMatricula']}",
        "periodo": periodo_limpio,
        "fechaEmision": date.today().isoformat(),
        "estudiante": {
            "identificacion": estudiante["identificacion"],
            "nombres": estudiante["nombres"],
            "apellidos": estudiante["apellidos"],
            "correo": estudiante["correo"],
            "telefono": estudiante["telefono"],
            "carrera": estudiante["carrera"],
            "facultad": estudiante["facultad"],
        },
        "matriculas": detalle,
        "totalCreditos": total_creditos,
        "valorCredito": VALOR_CREDITO,
        "totalPagar": total_creditos * VALOR_CREDITO,
    }


def _porcentaje(parte: float, total: float) -> float:
    """Porcentaje redondeado a un decimal; 0.0 cuando el total es cero."""
    if not total:
        return 0.0
    return round((float(parte) / float(total)) * 100, 1)


def resumen_institucional(periodo: str | None = None) -> dict[str, Any]:
    """Indicadores agregados para el dashboard del portal."""
    periodo_limpio = validar_periodo(periodo) if periodo else periodo_actual()

    with lectura() as cur:
        cur.execute("SELECT COUNT(*) FROM ESTUDIANTES")
        estudiantes = int(cur.fetchone()[0] or 0)
        cur.execute("SELECT COUNT(*) FROM FACULTADES")
        facultades = int(cur.fetchone()[0] or 0)
        cur.execute("SELECT COUNT(*) FROM CARRERAS")
        carreras = int(cur.fetchone()[0] or 0)

        cur.execute(
            "SELECT COUNT(*), COALESCE(SUM(CUPOS), 0) FROM MATERIAS WHERE PERIODO = ?",
            (periodo_limpio,),
        )
        materias, cupos_libres = cur.fetchone()
        materias, cupos_libres = int(materias or 0), int(cupos_libres or 0)

        cur.execute(
            """
            SELECT COUNT(*), COALESCE(SUM(M.CREDITOS), 0)
            FROM MATRICULAS MT
            JOIN MATERIAS M ON M.ID = MT.COD_MATERIA
            WHERE MT.PERIODO = ?
            """,
            (periodo_limpio,),
        )
        matriculas_periodo, creditos_periodo = cur.fetchone()
        matriculas_periodo = int(matriculas_periodo or 0)
        creditos_periodo = int(creditos_periodo or 0)

        cur.execute(
            "SELECT COUNT(DISTINCT IDENTIFICACION) FROM MATRICULAS WHERE PERIODO = ?",
            (periodo_limpio,),
        )
        estudiantes_matriculados = int(cur.fetchone()[0] or 0)

        cur.execute(
            """
            SELECT COUNT(N.ID_MATRICULA),
                   COALESCE(SUM(CASE WHEN N.PROMEDIO >= ? THEN 1 ELSE 0 END), 0),
                   COALESCE(AVG(N.PROMEDIO), 0)
            FROM NOTAS N
            JOIN MATRICULAS MT ON MT.ID_MATRICULA = N.ID_MATRICULA
            WHERE MT.PERIODO = ?
            """,
            (NOTA_APROBACION, periodo_limpio),
        )
        notas, aprobadas, promedio = cur.fetchone()
        notas, aprobadas = int(notas or 0), int(aprobadas or 0)
        promedio = float(promedio or 0)

        cur.execute(
            """
            SELECT COALESCE(SUM(M.CREDITOS), 0)
            FROM MATRICULAS MT
            JOIN MATERIAS M ON M.ID = MT.COD_MATERIA
            """
        )
        creditos_historicos = int(cur.fetchone()[0] or 0)

        cur.execute(
            """
            SELECT F.NOMBRE, COUNT(*), COALESCE(SUM(M.CREDITOS), 0)
            FROM MATRICULAS MT
            JOIN MATERIAS M ON M.ID = MT.COD_MATERIA
            JOIN FACULTADES F ON F.ID = M.ID_FACULTAD
            WHERE MT.PERIODO = ?
            GROUP BY F.ID, F.NOMBRE
            ORDER BY COUNT(*) DESC, F.NOMBRE
            """,
            (periodo_limpio,),
        )
        por_facultad = [
            {
                "facultad": str(fila[0]).strip(),
                "matriculas": int(fila[1] or 0),
                "creditos": int(fila[2] or 0),
                "recaudacion": int(fila[2] or 0) * VALOR_CREDITO,
            }
            for fila in cur.fetchall()
        ]

        cur.execute(
            """
            SELECT M.NOMBRE, M.CREDITOS, M.CUPOS, COUNT(*)
            FROM MATRICULAS MT
            JOIN MATERIAS M ON M.ID = MT.COD_MATERIA
            WHERE MT.PERIODO = ?
            GROUP BY M.ID, M.NOMBRE, M.CREDITOS, M.CUPOS
            ORDER BY COUNT(*) DESC, COUNT(*) / (COUNT(*) + M.CUPOS) DESC, M.NOMBRE
            LIMIT 5
            """,
            (periodo_limpio,),
        )
        materias_demandadas = [
            {
                "materia": str(fila[0]).strip(),
                "creditos": int(fila[1] or 0),
                "cuposDisponibles": int(fila[2] or 0),
                "matriculados": int(fila[3] or 0),
                "ocupacion": _porcentaje(int(fila[3] or 0), int(fila[3] or 0) + int(fila[2] or 0)),
            }
            for fila in cur.fetchall()
        ]

        cur.execute(
            """
            SELECT MT.PERIODO, COUNT(*), COALESCE(SUM(M.CREDITOS), 0)
            FROM MATRICULAS MT
            JOIN MATERIAS M ON M.ID = MT.COD_MATERIA
            GROUP BY MT.PERIODO
            ORDER BY MT.PERIODO
            """
        )
        historicos = [
            {
                "periodo": str(fila[0]).strip(),
                "matriculas": int(fila[1] or 0),
                "creditos": int(fila[2] or 0),
                "recaudacion": int(fila[2] or 0) * VALOR_CREDITO,
            }
            for fila in cur.fetchall()
        ]

    return {
        "periodo": periodo_limpio,
        "valorCredito": VALOR_CREDITO,
        "notaAprobacion": NOTA_APROBACION,
        "kpis": {
            "recaudacionPeriodo": creditos_periodo * VALOR_CREDITO,
            "recaudacionTotal": creditos_historicos * VALOR_CREDITO,
            "creditosPeriodo": creditos_periodo,
            "creditosTotal": creditos_historicos,
            "ocupacionCupos": _porcentaje(matriculas_periodo, matriculas_periodo + cupos_libres),
            "matriculasPeriodo": matriculas_periodo,
            "cuposDisponibles": cupos_libres,
            "aprobacion": _porcentaje(aprobadas, notas),
            "promedioGeneral": round(promedio, 2),
            "notasRegistradas": notas,
            "estudiantes": estudiantes,
            "estudiantesMatriculados": estudiantes_matriculados,
            "facultades": facultades,
            "carreras": carreras,
            "materias": materias,
        },
        "porFacultad": por_facultad,
        "materiasDemandadas": materias_demandadas,
        "historicos": historicos,
    }


# ---------------------------------------------------------------------------
# Esquemas de entrada
# ---------------------------------------------------------------------------
class FacultadEntrada(BaseModel):
    nombre: str = Field(..., max_length=40)


class CarreraEntrada(BaseModel):
    nombre: str = Field(..., max_length=60)
    idFacultad: int = Field(..., ge=1)


class EstudianteEntrada(BaseModel):
    documento: str = Field(..., max_length=20)
    nombres: str = Field(..., max_length=50)
    apellidos: str = Field(..., max_length=50)
    correo: str = Field(..., max_length=70)
    telefono: str = Field(..., max_length=20)
    idCarrera: int = Field(..., ge=1)


class MateriaEntrada(BaseModel):
    id: int
    nombre: str = Field(..., max_length=40)
    creditos: int
    idFacultad: int = Field(..., ge=1)
    periodo: str = Field(..., max_length=7)
    cupos: int
    horario: str = Field(..., max_length=40)


class MatriculaEntrada(BaseModel):
    identificacion: str = Field(..., max_length=20)
    periodo: str = Field(..., max_length=7)
    codigosMaterias: list[int] = Field(default_factory=list)


class NotaEntrada(BaseModel):
    idMatricula: int = Field(..., ge=1)
    nota1: float
    nota2: float
    nota3: float


class AccesoEstudiante(BaseModel):
    correo: str = Field(..., max_length=70)
    identificacion: str = Field(..., max_length=20)


class AccesoAdministrativo(BaseModel):
    clave: str = Field(..., max_length=200)


# ---------------------------------------------------------------------------
# Aplicación
# ---------------------------------------------------------------------------
def _manejador_validacion(exc: RequestValidationError) -> JSONResponse:
    errores = exc.errors()
    if errores:
        ubicacion = [str(parte) for parte in errores[0].get("loc", []) if parte != "body"]
        campo = ubicacion[-1] if ubicacion else None
        mensaje = "Revisa los datos enviados: hay campos con formato inválido o incompletos."
    else:
        campo = None
        mensaje = "Los datos enviados no son válidos."
    datos: dict[str, Any] = {"mensaje": mensaje}
    if campo:
        datos["campo"] = campo
    return JSONResponse(status_code=422, content=datos)


def _manejador_bd(exc: mariadb.Error) -> JSONResponse:
    codigo = getattr(exc, "errno", None)
    mensajes = {
        1062: "Ya existe un registro con ese valor único (nombre, documento, correo, teléfono o código).",
        1406: "Un valor excede la longitud permitida por el esquema de la base de datos.",
        1452: "La referencia indicada no existe en la base de datos.",
        3819: "Un valor no cumple una restricción CHECK del esquema universidad.sql.",
        4025: "Un valor no cumple una restricción CHECK del esquema universidad.sql.",
    }
    mensaje = mensajes.get(codigo, "La base de datos rechazó la operación.")
    registro.warning("Error MariaDB %s: %s", codigo, exc)
    return JSONResponse(status_code=409, content={"mensaje": mensaje, "detalle": str(exc)})


def crear_aplicacion() -> FastAPI:
    cfg = configuracion()
    app = FastAPI(
        title="Sistema de Matrículas · API",
        version="1.0.0",
        description="Backend del portal de gestión universitaria. Reutiliza el esquema universidad.sql.",
    )

    origenes = {cfg["origen_frontend"], "http://localhost:3000", "http://127.0.0.1:3000"}
    app.add_middleware(
        CORSMiddleware,
        allow_origins=sorted(origen for origen in origenes if origen),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    app.add_exception_handler(ErrorNegocio, lambda request, exc: JSONResponse(
        status_code=exc.estado, content=exc.como_dict()
    ))
    app.add_exception_handler(RequestValidationError, lambda request, exc: _manejador_validacion(exc))
    app.add_exception_handler(mariadb.Error, lambda request, exc: _manejador_bd(exc))

    @app.exception_handler(Exception)
    async def error_inesperado(request: Request, exc: Exception) -> JSONResponse:
        registro.exception("Error no controlado en %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={"mensaje": "Ocurrió un error interno en el servidor. Revisa los registros del backend."},
        )

    @app.get("/api/salud")
    def salud() -> dict[str, Any]:
        return {
            "estado": "ok",
            "servicio": "API de Matrículas",
            "version": "1.0.0",
            "periodo_actual": periodo_actual(),
            "valor_credito": VALOR_CREDITO,
            "base_de_datos": estado_base_de_datos(),
        }

    # --- Acceso ----------------------------------------------------------
    @app.post("/api/auth/estudiante")
    def post_acceso_estudiante(datos: AccesoEstudiante, request: Request) -> dict[str, Any]:
        clave_intentos = _clave_intentos("estudiante", request)
        if _limite_intentos_alcanzado(clave_intentos):
            raise ErrorNegocio(
                "Demasiados intentos fallidos. Espera un minuto antes de volver a intentarlo.",
                campo="acceso",
                estado=429,
            )
        try:
            perfil = autenticar_estudiante(datos.correo, datos.identificacion)
        except ErrorNegocio:
            _registrar_intento_fallido(clave_intentos)
            raise
        _intentos_acceso.pop(clave_intentos, None)
        return {
            "token": crear_token("estudiante", perfil["identificacion"]),
            "expiraEn": int(time.time()) + DURACION_SESION_SEGUNDOS,
            "usuario": {"rol": "estudiante", **perfil},
        }

    @app.post("/api/auth/administrativo")
    def post_acceso_administrativo(datos: AccesoAdministrativo, request: Request) -> dict[str, Any]:
        clave_intentos = _clave_intentos("administrativo", request)
        if _limite_intentos_alcanzado(clave_intentos):
            raise ErrorNegocio(
                "Demasiados intentos fallidos. Espera un minuto antes de volver a intentarlo.",
                campo="acceso",
                estado=429,
            )

        configurada = configuracion()["clave_admin"]
        if not configurada:
            raise ErrorNegocio(
                "El acceso administrativo no está configurado. Define ADMIN_PASSWORD en el archivo .env.",
                campo="acceso",
                estado=503,
            )

        # Se comparan huellas de longitud fija para no filtrar la longitud de la clave.
        coincide = hmac.compare_digest(_huella(datos.clave), _huella(configurada))
        if not coincide:
            _registrar_intento_fallido(clave_intentos)
            raise ErrorNegocio(
                "La contraseña administrativa no es correcta.",
                campo="clave",
                estado=401,
            )

        _intentos_acceso.pop(clave_intentos, None)
        return {
            "token": crear_token("administrativo"),
            "expiraEn": int(time.time()) + DURACION_SESION_SEGUNDOS,
            "usuario": {"rol": "administrativo", "nombre": "Secretaría académica"},
        }

    @app.get("/api/auth/sesion")
    def get_sesion(sesion: SesionUsuario) -> dict[str, Any]:
        if sesion["rol"] == "administrativo":
            return {"rol": "administrativo", "nombre": "Secretaría académica"}
        perfil = obtener_estudiante(str(sesion.get("sub") or ""))
        if not perfil:
            raise ErrorNegocio("La cuenta ya no existe.", campo="sesion", estado=401)
        return {"rol": "estudiante", **perfil}

    @app.post("/api/auth/salir")
    def post_salir(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
            datos = verificar_token(token)
            if datos:
                _tokens_revocados[token] = float(datos["exp"])
        return {"mensaje": "Sesión cerrada."}

    # --- Panel institucional ---------------------------------------------
    @app.get("/api/dashboard")
    def get_dashboard(
        sesion: SesionAdmin,
        periodo: str | None = Query(None, max_length=7),
    ) -> dict[str, Any]:
        return resumen_institucional(periodo)

    # --- Facultades ------------------------------------------------------
    @app.get("/api/facultades")
    def get_facultades(sesion: SesionAdmin) -> list[dict[str, Any]]:
        return listar_facultades()

    @app.post("/api/facultades", status_code=201)
    def post_facultad(
        datos: FacultadEntrada, sesion: SesionAdmin
    ) -> dict[str, Any]:
        return crear_facultad(datos.nombre)

    # --- Carreras --------------------------------------------------------
    @app.get("/api/carreras")
    def get_carreras(sesion: SesionAdmin) -> list[dict[str, Any]]:
        return listar_carreras()

    @app.post("/api/carreras", status_code=201)
    def post_carrera(
        datos: CarreraEntrada, sesion: SesionAdmin
    ) -> dict[str, Any]:
        return crear_carrera(datos.nombre, datos.idFacultad)

    # --- Estudiantes -----------------------------------------------------
    @app.get("/api/estudiantes")
    def get_estudiantes(sesion: SesionAdmin) -> list[dict[str, Any]]:
        return listar_estudiantes()

    @app.post("/api/estudiantes", status_code=201)
    def post_estudiante(
        datos: EstudianteEntrada, sesion: SesionAdmin
    ) -> dict[str, Any]:
        return crear_estudiante(
            datos.documento,
            datos.nombres,
            datos.apellidos,
            datos.correo,
            datos.telefono,
            datos.idCarrera,
        )

    @app.get("/api/estudiantes/{identificacion}")
    def get_estudiante(
        identificacion: str, sesion: SesionUsuario
    ) -> dict[str, Any]:
        exigir_acceso_propio(sesion, identificacion)
        estudiante = obtener_estudiante(identificacion)
        if not estudiante:
            raise ErrorNegocio("El estudiante seleccionado no existe.", "identificacion", estado=404)
        return estudiante

    @app.get("/api/estudiantes/{identificacion}/materias-disponibles")
    def get_materias_disponibles(
        identificacion: str,
        sesion: SesionUsuario,
        periodo: str = Query(..., max_length=7),
    ) -> list[dict[str, Any]]:
        exigir_acceso_propio(sesion, identificacion)
        periodo_limpio = validar_periodo(periodo)
        if not obtener_estudiante(identificacion):
            raise ErrorNegocio("El estudiante seleccionado no existe.", "identificacion", estado=404)
        return materias_disponibles(identificacion, periodo_limpio)

    @app.get("/api/estudiantes/{identificacion}/periodos")
    def get_periodos(
        identificacion: str, sesion: SesionUsuario
    ) -> list[str]:
        exigir_acceso_propio(sesion, identificacion)
        return listar_periodos(identificacion)

    # --- Materias --------------------------------------------------------
    @app.get("/api/materias")
    def get_materias(sesion: SesionAdmin) -> list[dict[str, Any]]:
        return listar_materias()

    @app.post("/api/materias", status_code=201)
    def post_materia(
        datos: MateriaEntrada, sesion: SesionAdmin
    ) -> dict[str, Any]:
        return crear_materia(datos)

    # --- Matrículas ------------------------------------------------------
    @app.get("/api/matriculas")
    def get_matriculas(
        sesion: SesionUsuario,
        identificacion: str = Query(..., max_length=20),
        periodo: str | None = Query(default=None, max_length=7),
    ) -> list[dict[str, Any]]:
        exigir_acceso_propio(sesion, identificacion)
        periodo_limpio = validar_periodo(periodo) if periodo else None
        return listar_matriculas(identificacion, periodo_limpio)

    @app.post("/api/matriculas", status_code=201)
    def post_matricula(
        datos: MatriculaEntrada,
        sesion: SesionUsuario,
    ) -> dict[str, Any]:
        # Solo el estudiante autenticado puede matricularse a sí mismo.
        if sesion["rol"] != "estudiante":
            raise ErrorNegocio(
                "La matrícula la realiza directamente el estudiante desde su cuenta.",
                campo="sesion",
                estado=403,
            )
        exigir_acceso_propio(sesion, datos.identificacion)
        return registrar_matricula(datos.identificacion, datos.periodo, datos.codigosMaterias)

    # --- Notas -----------------------------------------------------------
    @app.post("/api/notas", status_code=201)
    def post_notas(
        datos: NotaEntrada, sesion: SesionAdmin
    ) -> dict[str, Any]:
        return registrar_notas(datos.idMatricula, datos.nota1, datos.nota2, datos.nota3)

    # --- Recibos ---------------------------------------------------------
    @app.get("/api/recibos")
    def get_recibo(
        sesion: SesionUsuario,
        identificacion: str = Query(..., max_length=20),
        periodo: str = Query(..., max_length=7),
    ) -> dict[str, Any]:
        exigir_acceso_propio(sesion, identificacion)
        return obtener_recibo(identificacion, periodo)

    # --- Portal web (React compilado) ------------------------------------
    if CARPETA_DIST.is_dir():
        app.mount("/", StaticFiles(directory=str(CARPETA_DIST), html=True), name="portal")
    else:
        registro.warning(
            "No existe %s; compila el portal con `npm install && npm run build` en %s.",
            CARPETA_DIST,
            CARPETA_WEB,
        )

    return app


app = crear_aplicacion()
