# Portal UCC · Aplicación de escritorio

Aplicación de escritorio del **Portal de Matrículas de la Universidad Cooperativa de Colombia**.
Carga el mismo portal web que ya se usa en el navegador, dentro de una ventana nativa de
**Electron**, para que los usuarios puedan abrirlo como un programa instalado en Windows, GNU/Linux
o macOS sin cambiar la forma de acceso por navegador.

La aplicación **no replica la lógica de negocio ni accede directamente a MariaDB**. Es un cliente
del portal: todo el acceso, los permisos, las matrículas, las notas y los recibos siguen viviendo en
`servidor.py` y en la API web.

```
Portal UCC (Electron)  ──HTTP──►  servidor.py / web/dist  ──►  MariaDB
```

Por defecto abre:

```
http://192.168.101.82:3000
```

## Contenido

- [Requisitos](#requisitos)
- [Ejecutar en desarrollo](#ejecutar-en-desarrollo)
- [Configurar la dirección del portal](#configurar-la-dirección-del-portal)
- [Generar los ejecutables](#generar-los-ejecutables)
- [Artefactos por plataforma](#artefactos-por-plataforma)
- [Icono](#icono)
- [Qué hace la aplicación](#qué-hace-la-aplicación)
- [Seguridad](#seguridad)
- [Firma y distribución](#firma-y-distribución)
- [Solución de problemas](#solución-de-problemas)
- [Licencia](#licencia)

## Requisitos

### Para usar la aplicación ya compilada

- Windows 10 o superior (x64).
- GNU/Linux x64 con glibc y entorno gráfico (AppImage o paquete `.deb`).
- macOS 12 o superior (Intel o Apple Silicon, según la compilación).
- Conexión a la red donde está publicado el portal.

Nota: En GNU/Linux (y otros Linux como Alpine) es necesario libcrypt.so.1 y si usa el AppImage es necesario adicionalmente libfuse.so.2

No hace falta instalar Python, MariaDB, Node.js ni el navegador: el portal y la API siguen
ejecutándose en el servidor.

### Para compilar

- **Node.js 22.12 o superior** y npm.
- Conexión a Internet la primera vez, para descargar Electron y las herramientas de empaquetado.
- Cada plataforma se compila preferiblemente **en su propio sistema**:
  - Windows: `npm run dist:win` en Windows.
  - GNU/Linux: `npm run dist:linux` en GNU/Linux.
  - macOS: `npm run dist:mac` en macOS.
- Para generar iconos opcionalmente: ImageMagick 7 (`magick`) o Pillow. Los iconos ya están
  incluidos en `assets/`, así que no es necesario regenerarlos.

## Ejecutar en desarrollo

Desde esta carpeta (`escritorio/`):

```bash
npm install
npm start
```

`npm start` abre Electron apuntando a la URL predeterminada. La ventana tiene que poder alcanzar el
servidor: si el portal está en otra máquina, ambas deben estar en la misma red y el puerto debe estar
abierto.

Si el portal aún no está levantado, la aplicación mostrará una pantalla local de **sin conexión**
con un botón para reintentar; no se cierra ni queda en blanco.

## Configurar la dirección del portal

La URL predeterminada está en `main.js` (`URL_PREDETERMINADA`) y es la que se usa al empaquetar para
los usuarios. Para apuntar a otro servidor sin editar el código, hay dos mecanismos:

```bash
# Variable de entorno
PORTAL_URL=http://192.168.101.82:3000 npm start

# Argumento de línea de comandos (también en accesos directos)
npm start -- --url=http://192.168.101.82:3000
```

En una compilación empaquetada el argumento también funciona:

```bash
"Portal UCC.exe" --url=http://192.168.101.82:3000
```

La precedencia es: `--url=` → `PORTAL_URL` → valor predeterminado. Solo se aceptan direcciones
`http://` y `https://`; si el valor no es válido se usa el predeterminado y se deja un aviso en la
consola.

El portal debe estar publicado en una dirección accesible desde los equipos cliente. Si se cambia la
IP del servidor, actualiza `URL_PREDETERMINADA`, vuelve a compilar o entrega un acceso directo con
`--url=...`.

## Generar los ejecutables

```bash
cd escritorio
npm install
npm run dist          # plataforma actual
```

O por plataforma:

```bash
npm run dist:win      # Windows: instalador NSIS + portable x64
npm run dist:linux    # GNU/Linux: AppImage + .deb (x64)
npm run dist:mac      # macOS: .dmg + .zip (arquitectura del equipo)
```

Los resultados quedan en `escritorio/dist/`. Esa carpeta y `node_modules/` están ignoradas por git.

> **Compilación cruzada:** electron-builder puede generar Windows desde Windows y, con limitaciones,
> desde GNU/Linux. Los paquetes de macOS deben generarse en macOS para que el `.dmg` y la firma
> funcionen. Para Linux, compila en Linux o en un contenedor. No se promete un binario macOS
> generado desde Windows.

### Estructura relevante

```
escritorio/
├── main.js              Proceso principal: ventana, menú, navegación y errores
├── preload.js           Puente seguro para la pantalla de sin conexión
├── sin-conexion.html    Pantalla local cuando el portal no responde
├── sin-conexion.js      Reintento y apertura en el navegador
├── assets/
│   ├── icon.png         Icono base 1024 × 1024
│   ├── icon.ico         Icono de Windows (múltiples tamaños)
│   └── icon.icns        Icono de macOS
├── package.json         Dependencias y configuración de electron-builder
└── README.md            Este documento
```

## Artefactos por plataforma

| Plataforma | Comando | Archivos generados | Uso |
| --- | --- | --- | --- |
| Windows | `npm run dist:win` | `Portal-UCC-Instalador-1.0.0.exe` | Instalador con accesos directos y desinstalador. |
| Windows | `npm run dist:win` | `Portal-UCC-Portable-1.0.0.exe` | Ejecutable sin instalación; útil para equipos compartidos. |
| GNU/Linux | `npm run dist:linux` | `Portal-UCC-1.0.0-x86_64.AppImage` | `chmod +x` y doble clic. |
| GNU/Linux | `npm run dist:linux` | `Portal-UCC-1.0.0-amd64.deb` | `sudo apt install ./archivo.deb`. |
| macOS | `npm run dist:mac` | `Portal UCC-1.0.0.dmg` / `.zip` | Arrastrar a Aplicaciones. |

Los nombres exactos pueden variar según la versión, la arquitectura y la plataforma. El instalador
de Windows permite elegir la carpeta de instalación y crea accesos directos en el escritorio y en el
menú Inicio.

## Icono

El icono es el mismo logo del portal, tomado de `web/public/assets/image.png` (500 × 500). Se generó
una versión de 1024 × 1024 y sus equivalentes. Los comandos se ejecutan desde la raíz del
repositorio:

```bash
magick web/public/assets/image.png -filter Lanczos -resize 1024x1024 escritorio/assets/icon.png
magick escritorio/assets/icon.png -define icon:auto-resize=256,128,64,48,32,24,16 escritorio/assets/icon.ico
# ImageMagick no escribe ICNS reales en todas las compilaciones; para el de macOS:
python -m pip install pillow
python - <<'PY'
from PIL import Image
Image.open('escritorio/assets/icon.png').convert('RGBA').save('escritorio/assets/icon.icns', format='ICNS')
PY
```

Si actualizas el logo del portal, repite estos pasos antes de compilar. Electron usa `icon.ico` en
Windows, `icon.icns` en macOS y `icon.png` en GNU/Linux y en la ventana.

## Qué hace la aplicación

- Abre el portal oficial en una ventana nativa de 1280 × 840 (mínimo 980 × 640), con el menú
  adaptado a cada sistema.
- Mantiene el **mismo login y los mismos permisos** del portal web: estudiante o administrativo,
  token, cierre de sesión y las rutas protegidas por rol.
- Conserva la sesión local del portal entre aperturas, igual que el navegador; el token caduca a las
  8 horas y la aplicación valida la sesión al cargar.
- **Aviso al cerrar:** si hay una sesión activa, al cerrar la ventana aparece un diálogo nativo con
  la opción de seguir en el portal o cerrar de todos modos.
- Si el servidor no responde, muestra una pantalla local con un botón para reintentar y otro para
  abrir el portal en el navegador.
- Abre los enlaces externos en el navegador predeterminado, no dentro de la aplicación.
- Permite guardar los recibos como PDF con el diálogo nativo del sistema, sin pasar por una
  impresora, y abre la carpeta donde quedó el archivo.
- Fuerza la carga del `index.html` sin caché en cada apertura y al usar «Recargar portal», para que
  las actualizaciones del servidor se vean aunque Electron conserve una copia anterior.
- Una sola instancia: al abrir de nuevo, se enfoca la ventana existente.

Menú del portal:

| Acción | Atajo |
| --- | --- |
| Recargar portal | `Ctrl/Cmd + R` |
| Abrir en el navegador | Menú **Portal** |
| Acercar / alejar / tamaño real | `Ctrl/Cmd + +`, `Ctrl/Cmd + -`, `Ctrl/Cmd + 0` |
| Pantalla completa | `F11` (Windows/Linux) o `Ctrl/Cmd + F` (macOS) |
| Acerca de / versión | Menú **Ayuda** |

## Seguridad

La aplicación es un contenedor del portal, pero aplica las protecciones recomendadas para Electron:

- `nodeIntegration: false` y `contextIsolation: true`; el contenido remoto no tiene acceso a Node.js.
- `sandbox: true` y `webSecurity: true`.
- Preload mínimo: solo expone `reintentar` y `abrirNavegador` a la página local de error mediante IPC
  controlado; no acepta rutas ni comandos del contenido remoto.
- Navegación restringida al origen del portal; cualquier enlace externo se abre en el navegador del
  sistema y las ventanas emergentes se deniegan dentro de Electron.
- Se rechazan todas las peticiones de permisos del navegador (cámara, micrófono, ubicación, etc.),
  que el portal no necesita.
- No se guardan credenciales en el código ni en archivos de configuración: el login y los tokens
  siguen gestionados por el portal.
- El servidor debe publicarse por HTTPS si la red no es de confianza; la app acepta `http` o `https`.

El aviso de cierre consulta únicamente la marca de sesión guardada por el propio portal en
`localStorage`; no lee datos personales.

## Firma y distribución

Los ejecutables generados sin certificado están **sin firmar**:

- **Windows:** SmartScreen puede mostrar «Windows protegió su PC» la primera vez. Para evitarlo hace
  falta un certificado de firma de código y configurar `win.certificateFile` /
  `win.certificatePassword` (o un proveedor de firma). No se incluye ningún certificado.
- **macOS:** Gatekeeper bloqueará una app sin firmar o sin notarizar. Para distribuirla hace falta
  una cuenta de Apple Developer, firma con `codesign` y notarización. Mientras tanto, se puede abrir
  con clic derecho → **Abrir**.
- **GNU/Linux:** el AppImage solo necesita permiso de ejecución; el `.deb` se instala con el gestor
  de paquetes.

Para distribuir, entrega el archivo correspondiente a cada sistema junto con esta guía. No publiques
la carpeta `node_modules/` ni `dist/` en el repositorio.

## Solución de problemas

- **La ventana dice «No se pudo conectar»**: comprueba que `http://192.168.101.82:3000` abra desde el
  navegador de ese equipo, que el servidor esté encendido y que el firewall permita el puerto 3000.
  Si la IP cambió, recompila o inicia con `--url=http://nueva-ip:3000`.
- **La app muestra una versión anterior del portal**: cierra y vuelve a abrirla; esta versión carga
  el HTML con un parámetro único y cabeceras `no-cache`. Si sigues viendo la versión vieja, confirma
  que estás ejecutando el instalador o portable reconstruido después de este cambio.
- **El portal carga sin estilos o da 404**: falta `web/dist` en el servidor. En el proyecto principal
  ejecuta `cd web && npm run build` y reinicia el backend.
- **`npm install` falla al descargar Electron**: revisa la conexión, el proxy y la versión de Node.
  Borra `node_modules/` y `package-lock.json` y vuelve a intentarlo.
- **`npm run dist:mac` falla en Windows/Linux**: es esperado; compila macOS en macOS.
- **El instalador de Windows no se abre por SmartScreen**: es normal sin firma; usa «Más información»
  → «Ejecutar de todos modos» o distribuye una versión firmada.
- **No aparece el aviso al cerrar**: solo se muestra si hay una sesión activa. Si cerraste sesión
  desde el portal, la ventana se cierra directamente.
- **Se abre el portal en el navegador y no en la app**: algunos enlaces son externos por diseño; los
  enlaces internos del portal sí se quedan en la ventana.

## Autores

Kevin Ramírez (`kevin.ramirezcorr@campusucc.edu.co`) y Mauro Jaramillo
(`mauro.jaramillo@campusucc.edu.co`).

## Licencia

Este programa se distribuye bajo la **GNU Affero General Public License, versión 3 o posterior**
(`AGPL-3.0-or-later`). El texto completo está en [LICENSE](LICENSE).

La AGPL exige que, si el programa se usa a través de una red, los usuarios puedan obtener el código
fuente correspondiente. Este repositorio contiene el código de la aplicación de escritorio; si se
distribuye una versión modificada, debe acompañarse del código fuente y mantenerse la misma licencia.

Electron y las demás dependencias conservan sus propias licencias (MIT, BSD, Apache, etc.), que se
incluyen en los artefactos empaquetados.
