// Utilidades para calcular la ocupación de garajes por ventana de tiempo.
//
// Una reserva "ocupa" espacio si está activa y su horario se cruza con la
// ventana consultada. Las reservas antiguas (sin inicio/fin) se consideran
// ocupando siempre, hasta que se cancelen — así nada se rompe si la
// migración de horarios aún no se ejecutó.

function espaciosDe(reserva) {
  return Number(reserva.espacios) > 0 ? Number(reserva.espacios) : 1;
}

// ¿La reserva ocupa espacio dentro de la ventana [desde, hasta)?
function reservaOcupaVentana(reserva, desde, hasta) {
  if (reserva.estado !== 'activa') return false;
  if (!reserva.inicio || !reserva.fin) return true; // reserva sin horario
  const inicio = new Date(reserva.inicio);
  const fin = new Date(reserva.fin);
  return inicio < hasta && fin > desde;
}

// ¿La reserva ocupa espacio en este preciso momento?
function reservaOcupaAhora(reserva) {
  const ahora = new Date();
  return reservaOcupaVentana(reserva, ahora, new Date(ahora.getTime() + 1000));
}

// Suma los espacios ocupados de una lista de reservas en una ventana.
function ocupadosEnVentana(reservas, desde, hasta) {
  return (reservas || []).reduce(
    (suma, r) => suma + (reservaOcupaVentana(r, desde, hasta) ? espaciosDe(r) : 0),
    0,
  );
}

// Suma los espacios ocupados en este momento.
function ocupadosAhora(reservas) {
  return (reservas || []).reduce(
    (suma, r) => suma + (reservaOcupaAhora(r) ? espaciosDe(r) : 0),
    0,
  );
}

module.exports = {
  espaciosDe,
  reservaOcupaVentana,
  reservaOcupaAhora,
  ocupadosEnVentana,
  ocupadosAhora,
};
