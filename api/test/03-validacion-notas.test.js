const { app, pool, request, reiniciarBase, login, conToken, insertarNota } = require('./helpers');

let token;
beforeEach(async () => {
  await reiniciarBase();
  token = await login('usuario@demo.com');
});
afterAll(() => pool.end());

const crear = (cuerpo) => request(app).post('/api/notas').set(conToken(token)).send(cuerpo);

describe('Validación al crear notas', () => {
  test('una nota válida se crea con versión 1, creador y fechas generadas por el servidor', async () => {
    const res = await crear({ titulo: 'Preparar demo', texto: 'Grabar el video' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      titulo: 'Preparar demo',
      texto: 'Grabar el video',
      estado: 'pendiente',
      version: 1,
      creado_por: 2,
      modificado_por: 2,
    });
    expect(res.body.id).toBeDefined();
    expect(new Date(res.body.creado_en).getTime()).not.toBeNaN();
    expect(new Date(res.body.actualizado_en).getTime()).not.toBeNaN();
  });

  test('ignora campos que el cliente no debe controlar (creador, versión, fechas)', async () => {
    const res = await crear({
      titulo: 'Intento de suplantación',
      creado_por: 1,
      modificado_por: 1,
      version: 99,
      creado_en: '2000-01-01T00:00:00Z',
    });

    expect(res.status).toBe(201);
    expect(res.body.creado_por).toBe(2);
    expect(res.body.version).toBe(1);
    expect(new Date(res.body.creado_en).getFullYear()).toBeGreaterThan(2000);
  });

  test('el título es obligatorio', async () => {
    expect((await crear({})).status).toBe(400);
    expect((await crear({ titulo: '' })).status).toBe(400);
    expect((await crear({ titulo: '     ' })).status).toBe(400);
  });

  test('el título debe ser texto', async () => {
    expect((await crear({ titulo: 123 })).status).toBe(400);
    expect((await crear({ titulo: { a: 1 } })).status).toBe(400);
  });

  test('el título admite hasta 200 caracteres y rechaza más', async () => {
    expect((await crear({ titulo: 'a'.repeat(200) })).status).toBe(201);
    const res = await crear({ titulo: 'a'.repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/200/);
  });

  test('el texto admite hasta 2000 caracteres y rechaza más', async () => {
    expect((await crear({ titulo: 'Ok', texto: 'b'.repeat(2000) })).status).toBe(201);
    const res = await crear({ titulo: 'Ok', texto: 'b'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  test('los espacios sobrantes del título se eliminan', async () => {
    const res = await crear({ titulo: '   Con espacios   ' });
    expect(res.body.titulo).toBe('Con espacios');
  });

  test('una nota rechazada no se guarda', async () => {
    await crear({ titulo: '' });
    const { rows } = await pool.query('SELECT count(*)::int AS total FROM notas');
    expect(rows[0].total).toBe(0);
  });
});

describe('Validación al editar notas', () => {
  let nota;
  beforeEach(async () => {
    nota = await insertarNota({ titulo: 'Original', texto: 'Texto', creadoPor: 2 });
  });

  const editar = (id, cuerpo) => request(app).put(`/api/notas/${id}`).set(conToken(token)).send(cuerpo);
  const valido = () => ({ titulo: 'Editada', texto: 'Nuevo', estado: 'en_curso', version: 1 });

  test('una edición válida se guarda y sube la versión', async () => {
    const res = await editar(nota.id, valido());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ titulo: 'Editada', estado: 'en_curso', version: 2 });
  });

  test('rechaza un estado que no existe', async () => {
    const res = await editar(nota.id, { ...valido(), estado: 'terminada' });
    expect(res.status).toBe(400);
  });

  test('rechaza un título vacío o demasiado largo', async () => {
    expect((await editar(nota.id, { ...valido(), titulo: '' })).status).toBe(400);
    expect((await editar(nota.id, { ...valido(), titulo: 'x'.repeat(201) })).status).toBe(400);
  });

  test('rechaza un texto demasiado largo', async () => {
    const res = await editar(nota.id, { ...valido(), texto: 'y'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  test('exige la versión de la nota', async () => {
    const { version, ...sinVersion } = valido();
    const res = await editar(nota.id, sinVersion);
    expect(res.status).toBe(400);
  });

  test('rechaza un id que no es numérico', async () => {
    const res = await editar('abc', valido());
    expect(res.status).toBe(400);
  });

  test('una edición rechazada no cambia la nota guardada', async () => {
    await editar(nota.id, { ...valido(), titulo: '' });
    const { rows } = await pool.query('SELECT titulo, version FROM notas WHERE id = $1', [nota.id]);
    expect(rows[0]).toEqual({ titulo: 'Original', version: 1 });
  });
});
