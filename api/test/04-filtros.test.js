const { app, pool, request, reiniciarBase, login, conToken, insertarNota } = require('./helpers');

let token;
beforeEach(async () => {
  await reiniciarBase();
  token = await login('usuario@demo.com');

  // id 1: creada por el admin (1); id 2 y 3: por el usuario (2); id 4: por el admin (1)
  await insertarNota({ titulo: 'Reunión semanal', texto: 'preparar agenda', estado: 'pendiente', creadoPor: 1 });
  await insertarNota({ titulo: 'Informe', texto: 'Incluye la agenda del lunes', estado: 'en_curso', creadoPor: 2 });
  await insertarNota({ titulo: 'Compras', texto: 'Descuento del 100% en cables', estado: 'hecho', creadoPor: 2 });
  await insertarNota({ titulo: 'Plan de AGENDA', texto: '', estado: 'hecho', creadoPor: 1 });
});
afterAll(() => pool.end());

async function buscar(parametros = '') {
  const res = await request(app).get(`/api/notas${parametros}`).set(conToken(token));
  return { status: res.status, ids: res.body.map ? res.body.map((n) => n.id) : [], body: res.body };
}

describe('Búsqueda y filtros de notas (se aplican en la base de datos)', () => {
  test('sin filtros devuelve todas las notas (equivale a limpiar los filtros)', async () => {
    const { status, ids } = await buscar();
    expect(status).toBe(200);
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  test('parámetros vacíos tampoco filtran', async () => {
    const { ids } = await buscar('?q=&estado=&creador=');
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  test('busca en el título y en el contenido, sin distinguir mayúsculas', async () => {
    const { ids } = await buscar('?q=agenda');
    expect(ids).toEqual([1, 2, 4]); // 1 y 2 por contenido, 4 por título ("AGENDA")
  });

  test('busca solo en el contenido cuando la palabra no está en ningún título', async () => {
    const { ids } = await buscar('?q=cables');
    expect(ids).toEqual([3]);
  });

  test('filtra por estado', async () => {
    expect((await buscar('?estado=hecho')).ids).toEqual([3, 4]);
    expect((await buscar('?estado=pendiente')).ids).toEqual([1]);
    expect((await buscar('?estado=en_curso')).ids).toEqual([2]);
  });

  test('filtra por usuario creador', async () => {
    expect((await buscar('?creador=1')).ids).toEqual([1, 4]);
    expect((await buscar('?creador=2')).ids).toEqual([2, 3]);
  });

  test('combina búsqueda, estado y creador', async () => {
    expect((await buscar('?q=agenda&estado=hecho')).ids).toEqual([4]);
    expect((await buscar('?q=agenda&creador=2')).ids).toEqual([2]);
    expect((await buscar('?estado=hecho&creador=2')).ids).toEqual([3]);
    expect((await buscar('?q=agenda&estado=pendiente&creador=1')).ids).toEqual([1]);
  });

  test('una combinación sin coincidencias devuelve una lista vacía', async () => {
    const { status, ids } = await buscar('?q=agenda&estado=en_curso&creador=1');
    expect(status).toBe(200);
    expect(ids).toEqual([]);
  });

  test('los caracteres % y _ se buscan como texto normal, no como comodines', async () => {
    expect((await buscar('?q=%25')).ids).toEqual([3]);       // "%" aparece solo en la nota 3
    expect((await buscar('?q=100%25')).ids).toEqual([3]);
    expect((await buscar('?q=_')).ids).toEqual([]);          // ninguna nota tiene "_"
  });

  test('un intento de inyección SQL se trata como texto y no rompe la consulta', async () => {
    const { status, ids } = await buscar("?q=' OR '1'='1");
    expect(status).toBe(200);
    expect(ids).toEqual([]);
    const { rows } = await pool.query('SELECT count(*)::int AS total FROM notas');
    expect(rows[0].total).toBe(4);
  });

  test('rechaza un estado que no existe y un creador que no es numérico', async () => {
    expect((await buscar('?estado=xyz')).status).toBe(400);
    expect((await buscar('?creador=abc')).status).toBe(400);
  });

  test('los resultados incluyen quién creó y quién modificó cada nota', async () => {
    const { body } = await buscar('?creador=2');
    expect(body[0]).toMatchObject({
      creado_por_nombre: 'Usuario Demo',
      modificado_por_nombre: 'Usuario Demo',
    });
  });

  test('refleja los cambios guardados (busca sobre datos reales, no sobre una copia)', async () => {
    expect((await buscar('?q=presupuesto')).ids).toEqual([]);

    const editar = await request(app)
      .put('/api/notas/1')
      .set(conToken(token))
      .send({ titulo: 'Reunión semanal', texto: 'revisar el presupuesto', estado: 'pendiente', version: 1 });
    expect(editar.status).toBe(200);

    expect((await buscar('?q=presupuesto')).ids).toEqual([1]);
  });

  test('la lista de creadores incluye solo a quienes han creado notas', async () => {
    const res = await request(app).get('/api/notas/creadores').set(conToken(token));
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.nombre)).toEqual(['Admin Demo', 'Usuario Demo']);
  });
});
