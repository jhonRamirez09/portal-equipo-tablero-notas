const DIA_MS = 24 * 60 * 60 * 1000;
const ESTADOS = ['pendiente', 'en_curso', 'hecho'];

function porcentaje(cantidad, total) {
  return total === 0 ? 0 : Math.round((cantidad / total) * 1000) / 10;
}

// Función pura: recibe las notas ya leídas y la fecha actual, y devuelve las métricas.
// No toca la base de datos, por eso se puede probar sin ninguna infraestructura.
function calcularMetricas(notas, ahora = new Date()) {
  const limite = new Date(ahora.getTime() - 7 * DIA_MS);
  const total = notas.length;
  const distribucion = { pendiente: 0, en_curso: 0, hecho: 0 };
  const porUsuario = new Map();
  let creadas = 0;
  let modificadas = 0;

  for (const nota of notas) {
    if (Object.hasOwn(distribucion, nota.estado)) distribucion[nota.estado] += 1;
    if (new Date(nota.creado_en) >= limite) creadas += 1;
    if (new Date(nota.actualizado_en) >= limite) modificadas += 1;

    const actual = porUsuario.get(nota.creado_por) || {
      usuario_id: nota.creado_por,
      nombre: nota.creador,
      cantidad: 0,
    };
    actual.cantidad += 1;
    porUsuario.set(nota.creado_por, actual);
  }

  const porcentajes = {};
  for (const estado of ESTADOS) {
    porcentajes[estado] = porcentaje(distribucion[estado], total);
  }

  const notas_por_usuario = [...porUsuario.values()].sort(
    (a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre)
  );

  return {
    total,
    distribucion,
    porcentajes,
    ultimos_7_dias: { creadas, modificadas },
    notas_por_usuario,
    ultima_actualizacion: ahora.toISOString(),
  };
}

module.exports = { calcularMetricas };