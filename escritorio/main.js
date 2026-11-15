"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  session,
  shell
} = require("electron");

const URL_PREDETERMINADA = "http://192.168.101.82:3000";
const CLAVE_SESION = "portal.sesion";

function normalizarUrl(candidata) {
  try {
    const url = new URL(candidata);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function resolverUrlPortal() {
  const argumento = process.argv.find((valor) => valor.startsWith("--url="));
  const candidata =
    (argumento ? argumento.slice("--url=".length) : "") ||
    process.env.PORTAL_URL ||
    URL_PREDETERMINADA;
  const url = normalizarUrl(candidata);

  if (!url) {
    console.warn(
      `La URL «${candidata}» no es válida; se usará ${URL_PREDETERMINADA}.`
    );
    return URL_PREDETERMINADA;
  }
  return url;
}

const URL_PORTAL = resolverUrlPortal();
const ORIGEN_PORTAL = new URL(URL_PORTAL).origin;

let ventana = null;
let errorVisible = false;
let cerrando = false;
let consultandoCierre = false;

function esDelPortal(url) {
  try {
    return new URL(url).origin === ORIGEN_PORTAL;
  } catch {
    return false;
  }
}

function abrirExterno(url) {
  try {
    const destino = new URL(url);
    if (["http:", "https:", "mailto:"].includes(destino.protocol)) {
      shell.openExternal(destino.href);
    }
  } catch {
    // Las URLs mal formadas simplemente se ignoran.
  }
}

function urlDeCarga() {
  // Un parámetro distinto en cada carga evita que Chromium reutilice el
  // index.html antiguo que quedó guardado en la caché de la aplicación.
  const destino = new URL(URL_PORTAL);
  destino.searchParams.set("portal", String(Date.now()));
  return destino.href;
}

function cargarPortal() {
  if (!ventana || ventana.isDestroyed()) return;
  errorVisible = false;
  ventana
    .loadURL(urlDeCarga(), {
      extraHeaders: "Cache-Control: no-cache\r\nPragma: no-cache"
    })
    .catch(() => {
      // did-fail-load muestra la pantalla de error correspondiente.
    });
}

function mostrarSinConexion(codigo, detalle) {
  if (!ventana || ventana.isDestroyed() || errorVisible) return;
  errorVisible = true;
  ventana
    .loadFile(path.join(__dirname, "sin-conexion.html"), {
      query: {
        url: URL_PORTAL,
        codigo: String(codigo ?? ""),
        detalle: detalle || ""
      }
    })
    .catch(() => {
      // Si ni siquiera se puede cargar el HTML local, no hay más que hacer.
    });
}

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: "Portal UCC",
    backgroundColor: "#f7f9fc",
    icon: path.join(__dirname, "assets", "icon.png"),
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  ventana.once("ready-to-show", () => {
    if (ventana && !ventana.isDestroyed()) ventana.show();
  });

  // Si la red tarda en fallar, no dejamos la ventana oculta indefinidamente.
  setTimeout(() => {
    if (ventana && !ventana.isDestroyed() && !ventana.isVisible()) {
      ventana.show();
    }
  }, 2500);

  ventana.webContents.on("did-finish-load", () => {
    if (!ventana.webContents.getURL().startsWith("file:")) {
      errorVisible = false;
    }
  });

  ventana.webContents.on(
    "did-fail-load",
    (_evento, codigo, descripcion, urlFallida, esMarcoPrincipal) => {
      if (!esMarcoPrincipal || codigo === -3) return;
      if (urlFallida && urlFallida.startsWith("file:")) return;
      mostrarSinConexion(codigo, descripcion);
    }
  );

  ventana.webContents.on("will-navigate", (evento, url) => {
    if (url.startsWith("file:") || esDelPortal(url)) return;
    evento.preventDefault();
    abrirExterno(url);
  });

  ventana.webContents.on(
    "will-redirect",
    (evento, url, _enSitio, esMarcoPrincipal) => {
      if (!esMarcoPrincipal) return;
      if (url.startsWith("file:") || esDelPortal(url)) return;
      evento.preventDefault();
      abrirExterno(url);
    }
  );

  ventana.webContents.setWindowOpenHandler(({ url }) => {
    abrirExterno(url);
    return { action: "deny" };
  });

  ventana.webContents.on("will-attach-webview", (evento) => {
    evento.preventDefault();
  });

  ventana.on("close", (evento) => {
    if (cerrando) return;
    evento.preventDefault();
    if (consultandoCierre) return;
    consultandoCierre = true;

    const comprobarSesion = ventana.webContents.executeJavaScript(
      `(() => {
        try {
          const sesion = JSON.parse(localStorage.getItem(${JSON.stringify(CLAVE_SESION)}) || "null");
          if (!sesion || !sesion.token) return false;
          return !sesion.expiraEn || sesion.expiraEn * 1000 > Date.now();
        } catch {
          return false;
        }
      })()`,
      true
    );

    const limite = new Promise((resolver) =>
      setTimeout(() => resolver(false), 1500)
    );

    Promise.race([comprobarSesion, limite])
      .catch(() => false)
      .then((sesionActiva) => {
        consultandoCierre = false;
        if (!ventana || ventana.isDestroyed()) return;

        if (sesionActiva) {
          const opcion = dialog.showMessageBoxSync(ventana, {
            type: "question",
            title: "Cerrar Portal UCC",
            message: "Tu sesión sigue abierta",
            detail:
              "Si cierras la aplicación tendrás que iniciar sesión de nuevo. ¿Deseas cerrarla de todos modos?",
            buttons: ["Seguir en el portal", "Cerrar de todos modos"],
            defaultId: 0,
            cancelId: 0,
            noLink: true
          });
          if (opcion !== 1) return;
        }

        cerrando = true;
        ventana.destroy();
      });
  });

  ventana.on("closed", () => {
    ventana = null;
  });

  cargarPortal();
}

function mostrarAcercaDe() {
  dialog.showMessageBox(ventana, {
    type: "info",
    title: "Acerca de Portal UCC",
    message: "Portal UCC",
    detail: [
      `Versión ${app.getVersion()}`,
      `Portal: ${URL_PORTAL}`,
      "",
      "Aplicación de escritorio del portal de matrículas de la Universidad Cooperativa de Colombia.",
      "Autores: Kevin Ramírez y Mauro Jaramillo.",
      "Licencia: AGPL-3.0-or-later.",
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`
    ].join("\n"),
    buttons: ["Cerrar"],
    noLink: true
  });
}

function construirMenu() {
  const esMac = process.platform === "darwin";
  const plantilla = [
    ...(esMac ? [{ role: "appMenu" }] : []),
    {
      label: "Portal",
      submenu: [
        {
          label: "Recargar portal",
          accelerator: "CmdOrCtrl+R",
          click: cargarPortal
        },
        { type: "separator" },
        {
          label: "Abrir en el navegador",
          click: () => abrirExterno(URL_PORTAL)
        },
        { type: "separator" },
        esMac
          ? { role: "close", label: "Cerrar ventana" }
          : { role: "quit", label: "Salir" }
      ]
    },
    { role: "editMenu", label: "Edición" },
    {
      label: "Ver",
      submenu: [
        { role: "resetZoom", label: "Tamaño real" },
        { role: "zoomIn", label: "Acercar" },
        { role: "zoomOut", label: "Alejar" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Pantalla completa" },
        ...(esMac
          ? [{ type: "separator" }, { role: "front", label: "Traer al frente" }]
          : [])
      ]
    },
    { role: "windowMenu", label: "Ventana" },
    {
      role: "help",
      label: "Ayuda",
      submenu: [
        {
          label: "Acerca de Portal UCC",
          click: mostrarAcercaDe
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(plantilla));
}

ipcMain.handle("portal:reintentar", () => {
  cargarPortal();
  return true;
});

ipcMain.handle("portal:abrir-navegador", () => {
  abrirExterno(URL_PORTAL);
  return true;
});

ipcMain.handle("portal:guardar-pdf", async (evento, nombre) => {
  const ventanaActual = BrowserWindow.fromWebContents(evento.sender);
  if (!ventanaActual || ventanaActual.isDestroyed()) {
    return { cancelado: true };
  }

  const limpio = String(nombre || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim()
    .slice(0, 120);
  const sugerido = /^.+?\.pdf$/i.test(limpio)
    ? limpio
    : `${limpio || "Recibo-Portal-UCC"}.pdf`;

  const seleccion = await dialog.showSaveDialog(ventanaActual, {
    title: "Guardar recibo en PDF",
    defaultPath: path.join(app.getPath("documents"), sugerido),
    filters: [{ name: "Documento PDF", extensions: ["pdf"] }]
  });

  if (seleccion.canceled || !seleccion.filePath) {
    return { cancelado: true };
  }

  const ruta = /\.pdf$/i.test(seleccion.filePath)
    ? seleccion.filePath
    : `${seleccion.filePath}.pdf`;

  try {
    const pdf = await ventanaActual.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      preferCSSPageSize: true
    });
    await fs.writeFile(ruta, pdf);
    shell.showItemInFolder(ruta);
    return { guardado: true, ruta };
  } catch (fallo) {
    console.error("No se pudo guardar el PDF", fallo);
    return { error: "No pudimos guardar el PDF. Inténtalo de nuevo." };
  }
});

const bloqueo = app.requestSingleInstanceLock();

if (!bloqueo) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.show();
    ventana.focus();
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") {
      app.setAppUserModelId("co.edu.ucc.portal.matriculas");
    }

    app.setAboutPanelOptions({
      applicationName: "Portal UCC",
      applicationVersion: app.getVersion(),
      copyright: "Copyright © 2026 Kevin Ramírez y Mauro Jaramillo",
      credits: "Autores: Kevin Ramírez y Mauro Jaramillo · Licencia AGPL-3.0-or-later"
    });

    // El portal no necesita cámara, micrófono, ubicación ni notificaciones.
    session.defaultSession.setPermissionRequestHandler(
      (_contenido, _permiso, responder) => responder(false)
    );

    construirMenu();
    crearVentana();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
