"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "portalEscritorio",
  Object.freeze({
    reintentar: () => ipcRenderer.invoke("portal:reintentar"),
    abrirNavegador: () => ipcRenderer.invoke("portal:abrir-navegador"),
    guardarPdf: (nombre) => ipcRenderer.invoke("portal:guardar-pdf", nombre)
  })
);
