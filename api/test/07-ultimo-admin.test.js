const { app, pool, request, reiniciarBase, login, conToken } = require('./helpers');

let tokenAdmin;
beforeEach(async () => {
  await reiniciarBase();
  tokenAdmin = await login('admin@demo.com');
});
afterAll(() => pool.end());

const MENSAJE = /al menos un administrador activo/i;

const desactivar = (token, id) =>
  request(app).patch(`/api/usuarios/${id}/estado`).set(conToken(token)).send({ activo: false });
const cambiarRol = (token, id, nombre, correo, rol) =>
  request(app).put(`/api/usuarios/${id}`).set(conToken(token)).send({ nombre, correo, rol });

async function crearSegundoAdmin() {
  const res = await request(app).post('/api/usuarios').set(conToken(tokenAdmin))
    .send({ nombre: 'Segundo Admin', correo: 'admin2@demo.com', password: 'Admin21234', rol: 'admin' });
  expect(res.status).toBe(201);
  return res.body.id;
}

async function adminsActivos() {
  const { rows } = await pool.query("SELECT count(*)::int AS total FROM usuarios WHERE rol = 'admin' AND activo = true");
  return rows[0].total;
}

describe('Protección del último administrador activo', () => {
  test('no se puede desactivar al único administrador', async () => {
    const res = await desactivar(tokenAdmin, 1);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(MENSAJE);
    expect(await adminsActivos()).toBe(1);
  });

  test('no se puede quitar el rol de administrador al único administrador', async () => {
    const res = await cambiarRol(tokenAdmin, 1, 'Admin Demo', 'admin@demo.com', 'usuario');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(MENSAJE);
    expect(await adminsActivos()).toBe(1);
  });

  test('desactivar a un usuario normal no se ve afectado por la regla', async () => {
    const res = await desactivar(tokenAdmin, 2);
    expect(res.status).toBe(200);
    expect(res.body.activo).toBe(false);
  });

  test('con dos administradores se puede desactivar a uno, pero no al que queda', async () => {
    const idSegundo = await crearSegundoAdmin();

    const primera = await desactivar(tokenAdmin, idSegundo);
    expect(primera.status).toBe(200);

    const segunda = await desactivar(tokenAdmin, 1);
    expect(segunda.status).toBe(400);
    expect(segunda.body.error).toMatch(MENSAJE);
    expect(await adminsActivos()).toBe(1);
  });

  test('un administrador desactivado no cuenta: el otro queda protegido', async () => {
    const idSegundo = await crearSegundoAdmin();
    await desactivar(tokenAdmin, idSegundo);

    const res = await cambiarRol(tokenAdmin, 1, 'Admin Demo', 'admin@demo.com', 'usuario');
    expect(res.status).toBe(400);
  });

  test('al reactivar al segundo administrador, el primero vuelve a poder dejar de serlo', async () => {
    const idSegundo = await crearSegundoAdmin();
    await desactivar(tokenAdmin, idSegundo);
    await request(app).patch(`/api/usuarios/${idSegundo}/estado`).set(conToken(tokenAdmin)).send({ activo: true });

    const res = await cambiarRol(tokenAdmin, 1, 'Admin Demo', 'admin@demo.com', 'usuario');
    expect(res.status).toBe(200);
    expect(await adminsActivos()).toBe(1);

    // y ahora el segundo es el único: queda protegido
    const tokenSegundo = await login('admin2@demo.com', 'Admin21234');
    const bloqueo = await desactivar(tokenSegundo, idSegundo);
    expect(bloqueo.status).toBe(400);
  });

  test('un rechazo por esta regla no deja eventos en el historial', async () => {
    await desactivar(tokenAdmin, 1);
    const { rows } = await pool.query('SELECT count(*)::int AS total FROM historial');
    expect(rows[0].total).toBe(0);
  });

  test('si dos administradores se desactivan entre sí al mismo tiempo, siempre queda uno activo', async () => {
    const idSegundo = await crearSegundoAdmin();
    const tokenSegundo = await login('admin2@demo.com', 'Admin21234');

    const [a, b] = await Promise.all([
      desactivar(tokenAdmin, idSegundo),
      desactivar(tokenSegundo, 1),
    ]);

    // Nunca debe haber un error del servidor, y a lo sumo una de las dos operaciones se aplica
    expect([a.status, b.status].some((s) => s >= 500)).toBe(false);
    expect([a.status, b.status].filter((s) => s === 200).length).toBeLessThanOrEqual(1);
    expect(await adminsActivos()).toBeGreaterThanOrEqual(1);
  });
});
