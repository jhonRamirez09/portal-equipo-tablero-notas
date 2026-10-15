const { app, pool, request, reiniciarBase, login, conToken, insertarNota } = require('./helpers');

let tokenAdmin;
let tokenUsuario;
beforeEach(async () => {
  await reiniciarBase();
  tokenAdmin = await login('admin@demo.com');
  tokenUsuario = await login('usuario@demo.com');
});
afterAll(() => pool.end());

const editar = (token, id, cuerpo) =>
  request(app).put(`/api/notas/${id}`).set(conToken(token)).send(cuerpo);

describe('Detección de modificaciones simultáneas', () => {
  test('guardar con la versión actual funciona e incrementa la versión', async () => {
    const nota = await insertarNota({ titulo: 'Original' });

    const res = await editar(tokenAdmin, nota.id, {
      titulo: 'Cambio A', texto: '', estado: 'pendiente', version: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    expect(res.body.modificado_por).toBe(1);
  });

  test('guardar con una versión vieja responde 409 y NO sobrescribe el cambio del otro usuario', async () => {
    const nota = await insertarNota({ titulo: 'Original' });

    // Los dos usuarios abren la nota cuando está en la versión 1.
    // El administrador guarda primero:
    await editar(tokenAdmin, nota.id, { titulo: 'Cambio del admin', texto: '', estado: 'pendiente', version: 1 });

    // El usuario guarda después, todavía con la versión 1:
    const conflicto = await editar(tokenUsuario, nota.id, {
      titulo: 'Cambio del usuario', texto: '', estado: 'pendiente', version: 1,
    });

    expect(conflicto.status).toBe(409);
    expect(conflicto.body.error).toMatch(/modificada por otra persona/i);

    const { rows } = await pool.query('SELECT titulo, version, modificado_por FROM notas WHERE id = $1', [nota.id]);
    expect(rows[0]).toEqual({ titulo: 'Cambio del admin', version: 2, modificado_por: 1 });
  });

  test('tras recargar la nota (versión nueva) el usuario sí puede guardar', async () => {
    const nota = await insertarNota({ titulo: 'Original' });
    await editar(tokenAdmin, nota.id, { titulo: 'Cambio del admin', texto: '', estado: 'pendiente', version: 1 });

    const recargada = await request(app).get('/api/notas').set(conToken(tokenUsuario));
    const versionActual = recargada.body[0].version;
    expect(versionActual).toBe(2);

    const res = await editar(tokenUsuario, nota.id, {
      titulo: 'Cambio del usuario', texto: '', estado: 'hecho', version: versionActual,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ titulo: 'Cambio del usuario', version: 3, modificado_por: 2 });
  });

  test('dos guardados realmente simultáneos con la misma versión: uno gana y el otro recibe 409', async () => {
    const nota = await insertarNota({ titulo: 'Original' });

    const [a, b] = await Promise.all([
      editar(tokenAdmin, nota.id, { titulo: 'Desde admin', texto: '', estado: 'pendiente', version: 1 }),
      editar(tokenUsuario, nota.id, { titulo: 'Desde usuario', texto: '', estado: 'pendiente', version: 1 }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const { rows } = await pool.query('SELECT version FROM notas WHERE id = $1', [nota.id]);
    expect(rows[0].version).toBe(2); // solo se aplicó un cambio
  });

  test('modificar una nota que ya no existe responde 404', async () => {
    const nota = await insertarNota({ titulo: 'Efímera' });
    await request(app).delete(`/api/notas/${nota.id}`).set(conToken(tokenAdmin));

    const res = await editar(tokenUsuario, nota.id, {
      titulo: 'Tarde', texto: '', estado: 'pendiente', version: 1,
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/ya no existe/i);
  });

  test('eliminar una nota que ya no existe responde 404', async () => {
    const res = await request(app).delete('/api/notas/9999').set(conToken(tokenAdmin));
    expect(res.status).toBe(404);
  });

  test('la fecha de última modificación se actualiza y la de creación no cambia', async () => {
    const nota = await insertarNota({ titulo: 'Original' });
    await pool.query("UPDATE notas SET actualizado_en = NOW() - INTERVAL '1 hour' WHERE id = $1", [nota.id]);
    const antes = (await pool.query('SELECT creado_en, actualizado_en FROM notas WHERE id = $1', [nota.id])).rows[0];

    const res = await editar(tokenAdmin, nota.id, { titulo: 'Nuevo', texto: '', estado: 'pendiente', version: 1 });
    expect(res.status).toBe(200);

    const despues = (await pool.query('SELECT creado_en, actualizado_en FROM notas WHERE id = $1', [nota.id])).rows[0];
    expect(despues.creado_en).toEqual(antes.creado_en);
    expect(despues.actualizado_en.getTime()).toBeGreaterThan(antes.actualizado_en.getTime());
  });

  test('mover una nota por el tablero no cambia su versión (no genera conflictos falsos)', async () => {
    const nota = await insertarNota({ titulo: 'Móvil' });

    const mover = await request(app)
      .patch(`/api/notas/${nota.id}/posicion`)
      .set(conToken(tokenUsuario))
      .send({ posicion_x: 300, posicion_y: 150 });
    expect(mover.status).toBe(200);

    const res = await editar(tokenAdmin, nota.id, { titulo: 'Editada', texto: '', estado: 'pendiente', version: 1 });
    expect(res.status).toBe(200);
  });
});
