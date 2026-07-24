// Canal de tiempo real (WebSockets con socket.io).
//
// Guardamos la instancia de io aquí para que los controladores puedan
// emitir eventos sin importar server.js (evita dependencias circulares).

let io = null;

function setIO(instancia) {
  io = instancia;
}

// Emite un evento a todos los clientes conectados.
function emitir(evento, payload) {
  if (io) io.emit(evento, payload);
}

module.exports = { setIO, emitir };
