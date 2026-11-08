export const formatoCOP = (valor) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(valor) || 0);

export const formatoNumero = (valor) =>
  new Intl.NumberFormat("es-CO").format(Number(valor) || 0);

export const formatoFecha = (iso) => {
  if (!iso) return "—";
  const fecha = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return String(iso);
  return fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
};

export const nombreCompleto = (estudiante) =>
  `${estudiante?.nombres || ""} ${estudiante?.apellidos || ""}`.trim();

export const iniciales = (estudiante) =>
  `${(estudiante?.nombres || "?").charAt(0)}${(estudiante?.apellidos || "").charAt(0)}`.toUpperCase();

export const periodoLocal = (fecha = new Date()) =>
  `${fecha.getFullYear()}-${fecha.getMonth() + 1 <= 6 ? 1 : 2}`;

export const porcentaje = (valor) => `${Number(valor || 0).toFixed(1)} %`;
