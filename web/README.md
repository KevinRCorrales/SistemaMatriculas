# Portal de Gestión Universitaria · Universidad Cooperativa de Colombia

Portal web en **React 19 + Vite** que consume la API de `servidor.py`. La pantalla de bienvenida es
un dashboard institucional y los módulos mantienen la misma interfaz y reglas del portal anterior.

## Requisitos

- Node.js 20.19+ (o 22.12+) con npm.
- El backend de `servidor.py` en marcha para tener datos (la API vive en `/api`).

## Desarrollo

```bash
cd web
npm install
npm run dev
```

Vite abre [http://127.0.0.1:5173/](http://127.0.0.1:5173/) y hace proxy de `/api` a `http://127.0.0.1:3000`, así que primero
levanta el backend:

```bash
hatch run fastapi run -e servidor:app --port 3000
```

## Producción

```bash
cd web
npm run build        # genera web/dist
```

El backend sirve `web/dist` en `/`; no abras `index.html` con `file://` (CORS bloquea el origen
`null`). Al iniciar, `servidor.py` compila automáticamente si `web/dist` falta o si alguna fuente
es más nueva (se puede desactivar con `PORTAL_AUTO_BUILD=0`). El HTML se sirve sin caché para que
una recarga normal muestre la última compilación.

## Estructura

```
web/
├── index.html                  # Entrada de Vite (título, fuentes, logo)
├── vite.config.js              # Proxy /api y salida en dist/
├── public/assets/image.png     # Logo institucional
├── src/main.jsx                # Montaje de React
├── src/App.jsx                 # Enrutado por hash (#/matricula, #/notas, …)
├── src/api.js                  # Cliente HTTP tipado por funciones
├── src/validaciones.js         # Validaciones y tope acumulado de créditos
├── src/contexto.jsx            # Catálogos y periodo compartidos
├── src/hooks.js                # useRecurso (cargas) y useFormulario (formularios)
├── src/formato.js              # Moneda COP, fechas, iniciales
├── src/estilos.css             # Tokens, componentes y animaciones
├── src/componentes/ui.jsx      # Botones, campos, alertas, tarjetas, KPIs, tablas
├── src/componentes/Layout.jsx  # Cabecera, navegación lateral y contenido
└── src/vistas/                 # Dashboard, Facultades, Carreras, Estudiantes,
                                # Materias, Matrícula, Notas y Recibos
```

## Vistas

0. **Panel institucional (bienvenida)**: KPIs del periodo y accesos rápidos.
1. **Facultades**: listado y creación.
2. **Carreras**: listado y creación asociada a una facultad.
3. **Estudiantes**: listado y creación con carrera y facultad.
4. **Materias**: oferta con facultad, periodo, créditos, cupos y horario (se guarda en mayúsculas).
5. **Matrícula**: materias de la facultad y de servicio general (Humanidades e Inglés), resumen con
   los créditos previos del periodo, saldo restante y aviso de choque de horarios antes de enviar.
6. **Notas**: materias pendientes con filtro por periodo (por defecto el actual), vista previa del
   promedio y estado de aprobación (`>= 3.0`).
7. **Recibos**: consulta por estudiante y periodo, con impresión o guardado en PDF.

## Indicadores del dashboard

Se calculan en el backend (`GET /api/dashboard?periodo=AAAA-N`) con consultas agregadas:

- **Recaudación estimada (COP)**: créditos matriculados × `$70.000`, con total histórico.
- **Ocupación de cupos**: `matrículas / (matrículas + cupos disponibles)`.
- **Aprobación institucional**: porcentaje de notas con promedio `>= 3.0`.
- **Promedio general**, estudiantes, facultades, carreras y materias del periodo.
- **Matrículas por facultad**, **materias más demandadas** (ocupación de cada una) e **histórico por
  periodo**.

## Tope de créditos

El máximo es **16 créditos por estudiante y periodo**, no por envío: si el estudiante ya matriculó
12 en `2026-2`, la vista muestra `12 / 16` y solo permite agregar 4 más. Al matricular en `2027-1`
el contador vuelve a cero. La API responde con `creditosPrevios`, `creditosPeriodo` y
`creditosDisponibles`, y aplica la misma regla aunque se llame directamente.

## Animaciones y componentes

No se usa una librería de animación: las transiciones se resuelven con CSS (`--transicion`,
`--curva`) y una única clase compartida `animar-arriba` que se reutiliza en KPIs, filas, accesos y
vistas. Los retardos escalonados se pasan con `animationDelay`; las barras crecen con una animación
de escala y los cambios de vista se animan al remontar el componente. `prefers-reduced-motion`
desactiva todo el movimiento.

La lógica también se comparte: `useFormulario` (validación, errores por campo, éxito y error del
servidor), `useRecurso` (cargas con estados de espera y error) y `contexto.jsx` (catálogos y
periodo), de modo que las vistas solo describen su contenido.
