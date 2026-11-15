"use strict";

(() => {
  const parametros = new URLSearchParams(window.location.search);
  const url = parametros.get("url") || "";
  const codigo = parametros.get("codigo") || "";
  const detalle = parametros.get("detalle") || "Sin detalle adicional";

  document.querySelector("[data-url]").textContent = url;
  document.querySelector("[data-detalle]").textContent = codigo
    ? `${codigo} · ${detalle}`
    : detalle;

  const botonReintentar = document.querySelector("#reintentar");
  const botonNavegador = document.querySelector("#navegador");

  botonReintentar.addEventListener("click", async () => {
    botonReintentar.disabled = true;
    botonReintentar.textContent = "Reintentando…";
    try {
      if (window.portalEscritorio?.reintentar) {
        await window.portalEscritorio.reintentar();
      } else if (url) {
        window.location.href = url;
      }
    } catch {
      // Si el portal sigue caído, la ventana vuelve a esta pantalla.
    } finally {
      botonReintentar.disabled = false;
      botonReintentar.textContent = "Reintentar";
    }
  });

  botonNavegador.addEventListener("click", () => {
    if (window.portalEscritorio?.abrirNavegador) {
      window.portalEscritorio.abrirNavegador();
    } else if (url) {
      window.open(url, "_blank");
    }
  });
})();
