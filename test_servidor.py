"""Pruebas automáticas del backend (no requieren un servidor MariaDB activo).

Se cubren:

* el endpoint de salud y su contrato (`GET /api/salud`);
* el servicio del portal web estático desde la raíz;
* las validaciones de negocio (periodo, documento, correo, notas, materia);
* la forma JSON de los errores y la cabecera CORS;
* la semántica commit/rollback de la capa transaccional.

Las operaciones que escriben en MariaDB se validan manualmente (ver README),
porque necesitan una instancia local con el esquema `universidad.sql`.
"""

from __future__ import annotations

import time
from datetime import date

import pytest
from fastapi.testclient import TestClient

import servidor


@pytest.fixture(scope="module")
def cliente() -> TestClient:
    return TestClient(servidor.app)


@pytest.fixture(autouse=True)
def limpiar_estado_de_acceso():
    servidor._intentos_acceso.clear()
    servidor._tokens_revocados.clear()
    yield
    servidor._intentos_acceso.clear()
    servidor._tokens_revocados.clear()


@pytest.fixture
def cabecera_admin() -> dict[str, str]:
    return {"Authorization": f"Bearer {servidor.crear_token('administrativo')}"}


@pytest.fixture
def cabecera_estudiante() -> dict[str, str]:
    return {"Authorization": f"Bearer {servidor.crear_token('estudiante', '1020304056')}"}


# ---------------------------------------------------------------------------
# Salud y portal
# ---------------------------------------------------------------------------
def test_salud_responde_contrato(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/salud")

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["estado"] == "ok"
    assert datos["servicio"] == "API de Matrículas"
    assert datos["version"] == "1.0.0"
    assert datos["valor_credito"] == 70_000
    assert datos["periodo_actual"] == servidor.periodo_actual()

    bd = datos["base_de_datos"]
    assert bd["estado"] in {"conectado", "no_conectado"}
    if bd["estado"] == "conectado":
        assert bd["base"]
        assert "version" in bd
    else:
        assert bd["detalle"]


def test_salud_no_expone_credenciales(cliente: TestClient) -> None:
    texto = cliente.get("/api/salud").text.lower()
    for prohibido in ("password", "clave", "passwd", "secret"):
        assert prohibido not in texto


@pytest.mark.skipif(
    not (servidor.CARPETA_DIST / "index.html").exists(),
    reason="El portal React no está compilado (npm run build en web/).",
)
def test_portal_web_se_sirve_desde_la_raiz(cliente: TestClient) -> None:
    respuesta = cliente.get("/")
    assert respuesta.status_code == 200
    assert "Portal de Gestión Universitaria" in respuesta.text
    assert 'id="root"' in respuesta.text
    # El bundle de React se referencia desde el index compilado.
    assert "/assets/index-" in respuesta.text


def test_api_expone_el_dashboard() -> None:
    rutas = {getattr(ruta, "path", "") for ruta in servidor.app.routes}
    assert "/api/dashboard" in rutas


def test_cors_permite_el_origen_local(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/salud", headers={"Origin": "http://127.0.0.1:3000"})
    assert respuesta.headers.get("access-control-allow-origin") == "http://127.0.0.1:3000"


def test_cors_rechaza_origen_desconocido(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/salud", headers={"Origin": "http://sitio-malicioso.example"})
    assert respuesta.headers.get("access-control-allow-origin") is None


# ---------------------------------------------------------------------------
# Validaciones (sin base de datos)
# ---------------------------------------------------------------------------
def test_periodo_actual_sigue_el_calendario_academico() -> None:
    assert servidor.periodo_actual(date(2026, 3, 1)) == "2026-1"
    assert servidor.periodo_actual(date(2026, 6, 30)) == "2026-1"
    assert servidor.periodo_actual(date(2026, 7, 1)) == "2026-2"
    assert servidor.periodo_actual(date(2026, 12, 31)) == "2026-2"


def test_validar_periodo_acepta_y_rechaza() -> None:
    assert servidor.validar_periodo("2026-2") == "2026-2"
    for invalido in ("2026-3", "26-1", "2026/2", "", "2026-12"):
        with pytest.raises(servidor.ErrorNegocio) as error:
            servidor.validar_periodo(invalido)
        assert error.value.campo == "periodo"


def test_validar_documento_exige_digitos_y_longitud() -> None:
    assert servidor.validar_documento("1020304056") == "1020304056"
    for invalido in ("10203", "1020304056A", "", "12 345 678"):
        with pytest.raises(servidor.ErrorNegocio):
            servidor.validar_documento(invalido)


def test_validar_correo() -> None:
    assert servidor.validar_correo("Ana.Rodriguez@Universidad.edu.co") == "ana.rodriguez@universidad.edu.co"
    for invalido in ("ana@universidad", "ana universidad.edu.co", "@universidad.edu.co", ""):
        with pytest.raises(servidor.ErrorNegocio) as error:
            servidor.validar_correo(invalido)
        assert error.value.campo == "correo"


def test_validar_notas_respeta_el_check_del_esquema() -> None:
    assert servidor.validar_notas(4.0, 3.5, 4.25) == (4.0, 3.5, 4.25, 3.92)

    with pytest.raises(servidor.ErrorNegocio) as error:
        servidor.validar_notas(0.0, 3.5, 4.0)
    assert error.value.campo == "nota1"
    assert "CHECK" in error.value.mensaje

    with pytest.raises(servidor.ErrorNegocio):
        servidor.validar_notas(5.5, 3.0, 4.0)

    with pytest.raises(servidor.ErrorNegocio):
        servidor.validar_notas(0.0, 0.0, 0.0)


def test_validar_materia_exige_codigo_mayor_a_100000() -> None:
    base = {
        "nombre": "Bases de Datos",
        "creditos": 3,
        "idFacultad": 1,
        "periodo": "2026-2",
        "cupos": 10,
        "horario": "Lun 18:00-20:00",
    }

    with pytest.raises(servidor.ErrorNegocio) as error:
        servidor.validar_materia(servidor.MateriaEntrada(id=100000, **base))
    assert error.value.campo == "id"

    valores = servidor.validar_materia(servidor.MateriaEntrada(id=101105, **base))
    assert valores["id"] == 101105
    assert valores["nombre"] == "BASES DE DATOS"
    assert valores["periodo"] == "2026-2"


def test_validar_materia_limita_creditos_y_cupos_de_la_plataforma() -> None:
    base = {
        "nombre": "Bases de Datos",
        "idFacultad": 1,
        "periodo": "2026-2",
        "horario": "LUNES 6:00PM-8:00PM",
    }

    for creditos in (0, 5):
        with pytest.raises(servidor.ErrorNegocio) as error:
            servidor.validar_materia(servidor.MateriaEntrada(id=101105, creditos=creditos, cupos=10, **base))
        assert error.value.campo == "creditos"
        assert "1 y 4" in error.value.mensaje

    for cupos in (0, 51):
        with pytest.raises(servidor.ErrorNegocio) as error:
            servidor.validar_materia(servidor.MateriaEntrada(id=101105, creditos=3, cupos=cupos, **base))
        assert error.value.campo == "cupos"
        assert "1 y 50" in error.value.mensaje

    limite = servidor.validar_materia(
        servidor.MateriaEntrada(id=101105, creditos=4, cupos=50, **base)
    )
    assert limite["creditos"] == 4 and limite["cupos"] == 50


def test_horario_admite_los_40_caracteres_del_esquema() -> None:
    horario = "MIERCOLES 2:00PM-6:00PM"
    valores = servidor.validar_materia(
        servidor.MateriaEntrada(
            id=101105,
            nombre="Bases de Datos",
            creditos=3,
            idFacultad=1,
            periodo="2026-2",
            cupos=10,
            horario=horario,
        )
    )
    assert valores["horario"] == horario

    # El esquema de entrada corta en 40 caracteres igual que universidad.sql.
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        servidor.MateriaEntrada(
            id=101105,
            nombre="Bases de Datos",
            creditos=3,
            idFacultad=1,
            periodo="2026-2",
            cupos=10,
            horario="M" * 41,
        )


def test_horario_se_guarda_en_mayusculas_sin_rechazar_minusculas() -> None:
    valores = servidor.validar_materia(
        servidor.MateriaEntrada(
            id=101105,
            nombre="Inglés I",
            creditos=2,
            idFacultad=2,
            periodo="2026-2",
            cupos=10,
            horario="miercoles 2:00pm-6:00pm",
        )
    )
    assert valores["horario"] == "MIERCOLES 2:00PM-6:00PM"


def test_facultades_de_servicio_general_ignoran_tildes_y_mayusculas() -> None:
    for nombre in ("HUMANIDADES", "humanidades", "Inglés", "INGLES", " inglés "):
        assert servidor.es_servicio_general(nombre)
    for nombre in ("INGENIERÍA", "Derecho", ""):
        assert not servidor.es_servicio_general(nombre)


def test_tope_de_creditos_acumula_lo_ya_matriculado_en_el_periodo() -> None:
    assert servidor.validar_creditos_periodo(0, 16, "2026-2") == 16
    assert servidor.validar_creditos_periodo(12, 4, "2026-2") == 16
    assert servidor.validar_creditos_periodo(10, 2, "2026-2") == 12

    with pytest.raises(servidor.ErrorNegocio) as error:
        servidor.validar_creditos_periodo(12, 6, "2026-2")
    assert error.value.campo == "materias"
    assert "ya tiene 12 crédito(s) matriculados en 2026-2" in error.value.mensaje
    assert "solo puede matricular 4 más" in error.value.mensaje

    with pytest.raises(servidor.ErrorNegocio) as error:
        servidor.validar_creditos_periodo(16, 2, "2026-2")
    assert "alcanzó el máximo de 16 créditos en el periodo 2026-2" in error.value.mensaje


def test_porcentaje_seguro() -> None:
    assert servidor._porcentaje(0, 0) == 0.0
    assert servidor._porcentaje(1, 4) == 25.0
    assert servidor._porcentaje(2, 3) == 66.7


def test_franjas_horario_interpreta_12h_y_24h() -> None:
    assert servidor.franjas_horario("MARTES 1:00PM-4:00PM") == [("MARTES", 13 * 60, 16 * 60)]
    assert servidor.franjas_horario("MIÉRCOLES 2:00PM-6:00PM") == [("MIERCOLES", 14 * 60, 18 * 60)]
    assert servidor.franjas_horario("Lun/Mié 18:00-20:00") == [
        ("LUNES", 18 * 60, 20 * 60),
        ("MIERCOLES", 18 * 60, 20 * 60),
    ]
    assert servidor.franjas_horario("sin horario claro") == []


def test_conflicto_horario_rechaza_solapamiento() -> None:
    mensaje = servidor.conflicto_horario(
        [("Bases de Datos", "MARTES 1:00PM-4:00PM"), ("Redes", "MARTES 2:00PM-6:00PM")]
    )
    assert mensaje is not None
    assert "Bases de Datos" in mensaje and "Redes" in mensaje
    assert "martes" in mensaje


def test_conflicto_horario_permite_horarios_que_no_se_cruzan() -> None:
    assert servidor.conflicto_horario(
        [("A", "MARTES 10:00AM-2:00PM"), ("B", "MARTES 2:00PM-6:00PM")]
    ) is None
    assert servidor.conflicto_horario(
        [("A", "MARTES 2:00PM-5:00PM"), ("B", "MIERCOLES 2:00PM-5:00PM")]
    ) is None
    assert servidor.conflicto_horario(
        [("A", "MARTES 9:00AM-12:00PM"), ("B", "MARTES 8:00AM-10:00AM")]
    ) is not None


def test_generar_id_matricula_conserva_el_sufijo_de_fecha() -> None:
    sufijo = date.today().strftime("%d%m%y")
    assert servidor.generar_id_matricula(1) == int(f"1{sufijo}")
    assert servidor.generar_id_matricula(12) == int(f"12{sufijo}")


# ---------------------------------------------------------------------------
# Errores de la API (sin tocar la base de datos)
# ---------------------------------------------------------------------------
def test_error_de_negocio_devuelve_mensaje_y_campo(
    cliente: TestClient, cabecera_admin: dict[str, str]
) -> None:
    respuesta = cliente.post(
        "/api/materias",
        headers=cabecera_admin,
        json={
            "id": 100000,
            "nombre": "Bases de Datos",
            "creditos": 3,
            "idFacultad": 1,
            "periodo": "2026-2",
            "cupos": 10,
            "horario": "Lun 18:00-20:00",
        },
    )
    assert respuesta.status_code == 400
    datos = respuesta.json()
    assert datos["campo"] == "id"
    assert "100000" in datos["mensaje"]


def test_validacion_de_esquema_devuelve_422_con_campo(
    cliente: TestClient, cabecera_admin: dict[str, str]
) -> None:
    respuesta = cliente.post("/api/facultades", headers=cabecera_admin, json={})
    assert respuesta.status_code == 422
    datos = respuesta.json()
    assert datos["campo"] == "nombre"
    assert datos["mensaje"]


def test_matricula_sin_materias_no_llega_a_la_base_de_datos(
    cliente: TestClient, cabecera_estudiante: dict[str, str]
) -> None:
    respuesta = cliente.post(
        "/api/matriculas",
        headers=cabecera_estudiante,
        json={"identificacion": "1020304056", "periodo": "2026-2", "codigosMaterias": []},
    )
    assert respuesta.status_code == 400
    assert respuesta.json()["campo"] == "materias"


def test_nota_cero_se_rechaza_antes_de_escribir(
    cliente: TestClient, cabecera_admin: dict[str, str]
) -> None:
    respuesta = cliente.post(
        "/api/notas",
        headers=cabecera_admin,
        json={"idMatricula": 1, "nota1": 0, "nota2": 3.5, "nota3": 4.0},
    )
    assert respuesta.status_code == 400
    assert respuesta.json()["campo"] == "nota1"


def test_ruta_inexistente_devuelve_404(cliente: TestClient) -> None:
    assert cliente.get("/api/no-existe").status_code == 404


# ---------------------------------------------------------------------------
# Autenticación y autorización
# ---------------------------------------------------------------------------
def test_las_rutas_privadas_exigen_sesion(cliente: TestClient) -> None:
    for ruta in ("/api/dashboard", "/api/facultades", "/api/estudiantes"):
        respuesta = cliente.get(ruta)
        assert respuesta.status_code == 401
        assert respuesta.json()["campo"] == "sesion"


def test_el_estudiante_no_entra_al_panel_ni_a_los_catalogos(
    cliente: TestClient, cabecera_estudiante: dict[str, str]
) -> None:
    for ruta in ("/api/dashboard", "/api/facultades", "/api/estudiantes", "/api/materias"):
        respuesta = cliente.get(ruta, headers=cabecera_estudiante)
        assert respuesta.status_code == 403
        assert respuesta.json()["campo"] == "sesion"


def test_el_estudiante_solo_consulta_su_propia_informacion(
    cliente: TestClient, cabecera_estudiante: dict[str, str]
) -> None:
    respuesta = cliente.get("/api/estudiantes/999999", headers=cabecera_estudiante)
    assert respuesta.status_code == 403

    recibos = cliente.get(
        "/api/recibos?identificacion=999999&periodo=2026-2",
        headers=cabecera_estudiante,
    )
    assert recibos.status_code == 403


def test_el_administrativo_no_hace_matriculas(
    cliente: TestClient, cabecera_admin: dict[str, str]
) -> None:
    respuesta = cliente.post(
        "/api/matriculas",
        headers=cabecera_admin,
        json={"identificacion": "1020304056", "periodo": "2026-2", "codigosMaterias": []},
    )
    assert respuesta.status_code == 403


def test_token_firmado_y_manipulado() -> None:
    token = servidor.crear_token("administrativo")
    datos = servidor.verificar_token(token)
    assert datos["rol"] == "administrativo"
    assert servidor.verificar_token(token + "0") is None
    assert servidor.verificar_token("sin-punto") is None
    assert servidor.verificar_token("") is None


def test_token_expirado_se_rechaza(monkeypatch: pytest.MonkeyPatch) -> None:
    token = servidor.crear_token("administrativo")
    real = time.time
    monkeypatch.setattr(servidor.time, "time", lambda: real() + servidor.DURACION_SESION_SEGUNDOS + 1)
    assert servidor.verificar_token(token) is None


def test_cerrar_sesion_revoca_el_token(
    cliente: TestClient, cabecera_admin: dict[str, str]
) -> None:
    assert cliente.get("/api/auth/sesion", headers=cabecera_admin).status_code == 200
    assert cliente.post("/api/auth/salir", headers=cabecera_admin).status_code == 200
    assert cliente.get("/api/auth/sesion", headers=cabecera_admin).status_code == 401


def test_acceso_administrativo_valida_la_clave(
    cliente: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = servidor.configuracion
    monkeypatch.setattr(
        servidor,
        "configuracion",
        lambda: {**original(), "clave_admin": "clave-de-prueba"},
    )

    correcta = cliente.post("/api/auth/administrativo", json={"clave": "clave-de-prueba"})
    assert correcta.status_code == 200
    assert correcta.json()["usuario"]["rol"] == "administrativo"
    assert correcta.json()["expiraEn"] > time.time()

    incorrecta = cliente.post("/api/auth/administrativo", json={"clave": "otra"})
    assert incorrecta.status_code == 401
    assert "no es correcta" in incorrecta.json()["mensaje"]


def test_limite_de_intentos_en_el_acceso_administrativo(
    cliente: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = servidor.configuracion
    monkeypatch.setattr(
        servidor,
        "configuracion",
        lambda: {**original(), "clave_admin": "clave-de-prueba"},
    )

    for _ in range(servidor.MAX_INTENTOS_ACCESO):
        assert cliente.post("/api/auth/administrativo", json={"clave": "mala"}).status_code == 401

    bloqueada = cliente.post("/api/auth/administrativo", json={"clave": "clave-de-prueba"})
    assert bloqueada.status_code == 429
    assert "Demasiados intentos" in bloqueada.json()["mensaje"]


# ---------------------------------------------------------------------------
# Transacciones
# ---------------------------------------------------------------------------
class CursorFalso:
    def __init__(self, conexion: ConexionFalsa) -> None:
        self._conexion = conexion
        self.rowcount = 0
        self.lastrowid = 0

    def execute(self, consulta, parametros=None):
        self._conexion.consultas.append(consulta)

    def fetchone(self):
        return None

    def fetchall(self):
        return []

    def close(self) -> None:
        self._conexion.cursor_cerrado = True


class ConexionFalsa:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0
        self.cerrada = False
        self.cursor_cerrado = False
        self.consultas: list[str] = []

    def cursor(self):
        return CursorFalso(self)

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1

    def close(self) -> None:
        self.cerrada = True


def test_transaccion_confirma_al_terminar(monkeypatch: pytest.MonkeyPatch) -> None:
    conexion = ConexionFalsa()
    monkeypatch.setattr(servidor, "abrir_conexion", lambda: conexion)

    with servidor.transaccion() as cursor:
        cursor.execute("UPDATE MATERIAS SET CUPOS = CUPOS - 1 WHERE ID = ?", (101101,))

    assert conexion.commits == 1
    assert conexion.rollbacks == 0
    assert conexion.cerrada and conexion.cursor_cerrado
    assert conexion.consultas == ["UPDATE MATERIAS SET CUPOS = CUPOS - 1 WHERE ID = ?"]


def test_transaccion_revierte_todo_si_algo_falla(monkeypatch: pytest.MonkeyPatch) -> None:
    conexion = ConexionFalsa()
    monkeypatch.setattr(servidor, "abrir_conexion", lambda: conexion)

    with pytest.raises(servidor.ErrorNegocio), servidor.transaccion() as cursor:
        cursor.execute("INSERT INTO MATRICULAS ...")
        cursor.execute("UPDATE MATERIAS ...")
        raise servidor.ErrorNegocio("fallo simulado a mitad de la matrícula")

    assert conexion.commits == 0
    assert conexion.rollbacks == 1
    assert len(conexion.consultas) == 2  # ambas sentencias quedaron revertidas


def test_conexion_sin_credenciales_es_un_error_claro(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(servidor, "configuracion", lambda: {
        "usuario": "",
        "clave": "",
        "base": "universidad",
        "host": "localhost",
        "puerto": 3306,
        "origen_frontend": "http://127.0.0.1:3000",
        "host_api": "127.0.0.1",
        "puerto_api": 3000,
        "recargar": False,
    })

    with pytest.raises(servidor.ErrorNegocio) as error:
        servidor.abrir_conexion()

    assert error.value.estado == 503
    assert ".env" in error.value.mensaje
