const http = require('http');
const { handler } = require('./handler');

const PUERTO = process.env.LAMBDA_PORT || 3001;

// Emula lo que hace API Gateway: convierte la petición HTTP en un "evento",
// llama al handler y devuelve su respuesta.
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname !== '/metricas') {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  }

  const evento = {
    httpMethod: req.method,
    path: url.pathname,
    headers: req.headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: null,
  };

  try {
    const respuesta = await handler(evento);
    res.writeHead(respuesta.statusCode, respuesta.headers || {});
    res.end(respuesta.body || '');
  } catch (error) {
    console.error('Error en el emulador:', error.message);
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Error interno' }));
  }
});

servidor.listen(PUERTO, () => {
  console.log(`Emulador local de Lambda escuchando en el puerto ${PUERTO}`);
});