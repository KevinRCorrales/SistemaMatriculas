# Sistema de Matrículas · Universidad Cooperativa de Colombia

Portal web en **React** (Vite) con API REST propia sobre el esquema `universidad.sql`. El backend
vive en un solo archivo (`servidor.py`), sirve el portal compilado de `web/dist` y reutiliza las
reglas de negocio de `sistema.py`, que se conserva intacto como aplicación de escritorio.

```
Navegador  ──►  FastAPI (servidor.py)  ──►  MariaDB (universidad)
                 └── sirve web/dist en /      └── esquema universidad.sql
```

La pantalla de bienvenida es un **dashboard institucional** con indicadores calculados en vivo
(recaudación estimada en COP, ocupación de cupos, aprobación y promedio general, demanda por
facultad y por materia, historial por periodo), además de los módulos de facultades, carreras,
estudiantes, materias, matrícula, notas y recibos.

## Requisitos

- Python 3.11 o superior.
- [Hatch](https://hatch.pypa.io/) para crear y usar el entorno del proyecto.
- Node.js 20.19+ (o 22.12+) con npm, para compilar el portal React con Vite.
- MariaDB 10.6 o superior con la base `universidad` creada a partir de `universidad.sql`.
- En Windows hace falta una capa POSIX: **WSL2**, **Git Bash** o **MinGW-w64 con UCRT64**
  (esta última es la opción recomendada).

## Instalación

Se usa Hatch tal como viene por defecto: crea su entorno virtual fuera del repositorio y no necesita
`pyproject.toml` ni configuración adicional.

```bash
pip install --user hatch          # o: pipx install hatch
hatch run python -m pip install -r requirements-dev.txt
cp .env.example .env
cd web && npm install && cd ..    # dependencias del portal React
```

Los comandos siguientes reutilizan ese mismo entorno; no hay que activar nada a mano.

Si la base aún no existe, cárgala una sola vez:

```bash
mariadb -u root -p < universidad.sql
```

No se requieren migraciones: la API no crea ni modifica tablas.

## Configuración (`.env`)

| Variable            | Obligatoria | Descripción                                                        |
| ------------------- | ----------- | ------------------------------------------------------------------ |
| `DATABASE_USER`     | Sí          | Usuario de MariaDB.                                                |
| `DATABASE_PASSWORD` | Sí          | Contraseña del usuario.                                            |
| `DATABASE_NAME`     | Sí          | Base de datos (por defecto `universidad`).                         |
| `DATABASE_HOST`     | No          | Host del servidor (por defecto `localhost`).                       |
| `DATABASE_PORT`     | No          | Puerto (por defecto `3306`).                                       |
| `API_HOST`          | No          | Host de FastAPI (por defecto `127.0.0.1`).                          |
| `API_PORT`          | No          | Puerto de FastAPI (por defecto `3000`).                             |
| `API_RELOAD`        | No          | `true` para recarga automática en desarrollo.                       |
| `FRONTEND_ORIGIN`   | No          | Origen extra permitido por CORS (el portal servido usa mismo origen). |

También se aceptan los nombres históricos de `sistema.py` (`USER`, `PASSWORD`, `DATABASE`,
`HOST`, `PORT`). El archivo `.env` está ignorado por git; `.env.example` no contiene credenciales.

## Ejecución

Compila el portal una vez (y cada vez que cambies el frontend):

```bash
cd web
npm run build                     # genera web/dist
cd ..
hatch run python servidor.py
```

o, con recarga automática del backend:

```bash
hatch run python -m uvicorn servidor:app --host 127.0.0.1 --port 3000 --reload
```

Abre el portal en **http://127.0.0.1:3000/** (no abras `web/index.html` con `file://`: el origen
`null` queda fuera de CORS). El backend sirve `web/dist` en `/` y la API en `/api`, así que frontend
y backend comparten origen. Si `web/dist` no existe, el backend arranca igual pero advierte en el
log que falta compilar el portal.

Para trabajar en el frontend con recarga en caliente, deja el backend en el puerto 3000 y ejecuta en
`web/` `npm run dev`: Vite abre `http://127.0.0.1:5173/` y hace proxy de `/api` al backend.

## Endpoints

| Método | Ruta                                            | Descripción                                                       |
| ------ | ----------------------------------------------- | ----------------------------------------------------------------- |
| GET    | `/api/salud`                                    | Estado del servicio y de la conexión a MariaDB.                    |
| GET    | `/api/dashboard?periodo=AAAA-N`                 | KPIs del periodo (recaudación, ocupación, aprobación, promedios), demanda por facultad y materia e histórico. |
| GET    | `/api/facultades`                               | Lista de facultades.                                               |
| POST   | `/api/facultades`                               | Crea una facultad (`{ "nombre" }`).                                |
| GET    | `/api/carreras`                                 | Lista de carreras con su facultad.                                 |
| POST   | `/api/carreras`                                 | Crea una carrera (`{ "nombre", "idFacultad" }`).                   |
| GET    | `/api/estudiantes`                              | Lista de estudiantes.                                              |
| POST   | `/api/estudiantes`                              | Crea un estudiante (documento, nombres, apellidos, correo, teléfono, `idCarrera`). |
| GET    | `/api/estudiantes/{identificacion}`             | Consulta un estudiante.                                            |
| GET    | `/api/estudiantes/{identificacion}/periodos`    | Periodos con matrículas del estudiante.                            |
| GET    | `/api/estudiantes/{identificacion}/materias-disponibles?periodo=AAAA-N` | Oferta disponible para matrícula.       |
| GET    | `/api/materias`                                 | Lista de ofertas de materias.                                      |
| POST   | `/api/materias`                                 | Crea una oferta (`id`, `nombre`, `creditos`, `idFacultad`, `periodo`, `cupos`, `horario`); el horario se guarda en mayúsculas. |
| GET    | `/api/matriculas?identificacion=...&periodo=...`| Matrículas del estudiante (periodo opcional), con su nota.          |
| POST   | `/api/matriculas`                               | Matricula materias (`{ "identificacion", "periodo", "codigosMaterias": [...] }`). |
| POST   | `/api/notas`                                    | Registra las tres notas (`{ "idMatricula", "nota1", "nota2", "nota3" }`). |
| GET    | `/api/recibos?identificacion=...&periodo=...`   | Datos del recibo de matrícula (estudiante, materias, total a pagar). |

Los errores siempre devuelven `{ "mensaje": "...", "campo": "..." }` con un código coherente:
`422` para datos mal formados, `400` para reglas de negocio, `404` si no existe el recurso,
`409`/`503` para conflictos de base de datos y `503` si no hay conexión.

## Reglas de negocio de la plataforma

Estas reglas se aplican en la API además de las restricciones del esquema:

- **Materias**: código entero mayor a 100000; nombre de 3 a 30 caracteres; **créditos entre 1 y 4**;
  **cupos entre 1 y 50**; periodo `AAAA-1` o `AAAA-2`; **horario de hasta 40 caracteres**
  (por ejemplo `MIERCOLES 2:00PM-6:00PM`). El horario se acepta en minúsculas y se guarda en
  mayúsculas. Los límites de créditos y cupos son de la plataforma: `universidad.sql` no se modifica.
- **Matrícula**: cada matrícula debe sumar entre 2 y 16 créditos y no puede repetir materias en el
  periodo. El tope de **16 créditos es acumulado por estudiante y periodo**: si ya matriculó
  12 créditos en `2026-2`, solo puede agregar 4 más; al matricular en `2027-1` el contador vuelve a
  empezar. La respuesta incluye `creditosPrevios`, `creditosPeriodo` y `creditosDisponibles`.
- **Facultad de la materia**: debe ser la del estudiante, salvo las materias de **Humanidades** e
  **Inglés**, que cualquier estudiante puede matricular (misma regla que `sistema.py`).
- **Choque de horarios**: se rechaza la matrícula si dos materias se cruzan el mismo día, incluidas
  las ya matriculadas en el periodo. Los extremos que solo se tocan no son conflicto
  (`MARTES 10:00AM-2:00PM` convive con `MARTES 2:00PM-6:00PM`; `MARTES 1:00PM-4:00PM` no convive
  con `MARTES 2:00PM-6:00PM`). El mensaje indica las dos materias y el día del cruce.
- Cada materia matriculada descuenta un cupo con `UPDATE MATERIAS SET CUPOS = CUPOS - 1 WHERE ID = ? AND CUPOS > 0`
  dentro de la misma transacción: si algo falla se revierte todo (`rollback`) y los cupos no cambian.
- **Notas**: cada nota debe ser mayor que `0.0` y hasta `5.0` (el esquema declara
  `CHECK (NOTA_x > 0.0)`); el promedio se calcula con dos decimales y se aprueba desde `3.0`.
- **Estudiantes**: documento de 6 a 20 dígitos, correo con formato válido y máximo 70 caracteres,
  teléfono de 7 a 20 caracteres, nombres y apellidos de 2 a 50.
- **Facultades y carreras**: 3 a 15 y 3 a 30 caracteres respectivamente, sin dígitos.
- **Recibo**: el número se compone como `REC-<periodo>-<idMatrícula>` y el total es
  `créditos × $70.000`.
- **Dashboard**: la recaudación estimada es `créditos matriculados × $70.000`; la ocupación de cupos
  es `matrículas / (matrículas + cupos disponibles)`; la aprobación es el porcentaje de notas con
  promedio `>= 3.0`; el promedio general es el `AVG(PROMEDIO)` del periodo. Todos los indicadores se
  calculan con consultas agregadas, sin tablas nuevas.

## Pruebas

```bash
hatch run python -m pytest -q
```

`test_servidor.py` cubre, sin necesidad de MariaDB en ejecución: contrato de `/api/salud`,
servicio del portal compilado desde `/` (se omite si no existe `web/dist`), CORS, validaciones puras
(periodo, documento, correo, notas, límites de materias, horario de 40 caracteres y su conversión a
mayúsculas), el tope acumulado de créditos por periodo, detección de choque de horarios, facultades
de servicio general, formato de errores `422`/`400`/`404` y la semántica commit/rollback de
`transaccion()` con una conexión falsa.

El frontend se valida compilándolo con `cd web && npm run build` (falla ante imports o JSX
inválidos). La verificación funcional contra MariaDB se hizo con la API en marcha: matrícula de
12 créditos + 4 (16), rechazo del siguiente bloque con rollback, 12 + 2 + 2 = 16, reinicio del
contador al matricular en `2027-1`, contraste de los KPIs del dashboard con consultas SQL directas
y recorrido de todas las vistas del portal React en un navegador headless, sin errores de ejecución.
También se comprobó el flujo anterior (facultades, carreras, estudiantes, notas, recibo, cupos y
choques de horario) y se limpiaron los datos de prueba.

## Estructura

```
servidor.py            API FastAPI + acceso a MariaDB + static del portal
test_servidor.py       Pruebas automatizadas (pytest)
universidad.sql        Esquema de la base (referencia, sin cambios)
sistema.py             Aplicación de escritorio original (intacta)
web/                   Portal React (Vite): package.json, index.html, src/ y public/
web/src/vistas/        Dashboard y módulos (facultades, carreras, estudiantes, materias, matrícula, notas, recibos)
web/src/componentes/   Componentes reutilizables (UI y layout) y animaciones compartidas
web/legacy/            CSS/JS de la versión anterior del portal (referencia, no se sirve)
requirements.txt       Dependencias de ejecución
requirements-dev.txt   Dependencias de desarrollo y pruebas
pytest.ini             Configuración de pytest
ruff.toml              Configuración del linter
.env.example           Plantilla de variables de entorno
```

## Problemas frecuentes

- **`file://` no funciona**: abre siempre `http://127.0.0.1:3000/`.
- **La raíz responde 404 o muestra el portal sin estilos**: falta compilar el frontend. Ejecuta
  `cd web && npm install && npm run build` y reinicia el backend.
- **`npm run build` falla por la versión de Node**: Vite 7 exige Node 20.19+ o 22.12+.
- **`/api/salud` muestra `no_conectado`**: revisa que MariaDB esté corriendo y que las credenciales
  de `.env` sean correctas (el detalle aparece en la respuesta).
- **Un valor se rechaza aunque el formulario lo permita**: la API valida los límites de la
  plataforma (créditos, cupos, horario, notas) y el esquema sus `CHECK`; el mensaje indica el campo.
