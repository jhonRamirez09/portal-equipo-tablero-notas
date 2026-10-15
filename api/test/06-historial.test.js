const { app, pool, request, reiniciarBase, login, conToken, PASSWORD_DEMO } = require('./helpers');

let tokenAdmin;
let tokenUsuario;
beforeEach(async () => {
  await reiniciarBase();
  tokenAdmin = await login('admin@demo.com');
  tokenUsuario = await login('usuario@demo.com');
});
afterAll(() => pool.end());

async function eventos() {
  const { rows } = await pool.query('SELECT * FROM historial ORDER BY id');
  return rows;
}

describe('Registro de eventos en el historial', () => {
  test('crear una nota registra el evento con todos sus campos', async () => {
    const res = await request(app).post('/api/notas').set(conToken(tokenUsuario)).send({ titulo: 'Nueva' });

    const [evento] = await eventos();
    expect(evento).toMatchObject({
      tipo_operacion: 'creacion_nota',
      usuario_id: 2,
      tipo_recurso: 'nota',
      recurso_id: res.body.id,
    });
    expect(evento.id).toBeDefined();
    expect(evento.creado_en).toBeInstanceOf(Date);
    expect(evento.resumen).toContain('Nueva');
  });

  test('editar una nota registra la edición; si cambia el estado, también el cambio de estado', async () => {
    const nota = (await request(app).post('/api/notas').set(conToken(tokenUsuario)).send({ titulo: 'Nota' })).body;

    await request(app).put(`/api/notas/${nota.id}`).set(conToken(tokenAdmin))
      .send({ titulo: 'Nota editada', texto: 'x', estado: 'pendiente', version: 1 });
    await request(app).put(`/api/notas/${nota.id}`).set(conToken(tokenAdmin))
      .send({ titulo: 'Nota editada', texto: 'x', estado: 'hecho', version: 2 });

    const tipos = (await eventos()).map((e) => e.tipo_operacion);
    expect(tipos).toEqual([
      'creacion_nota',
      'edicion_nota',      // 1.ª edición: el estado no cambió
      'edicion_nota',      // 2.ª edición...
      'cambio_estado_nota', // ...que además cambió el estado
    ]);

    const cambio = (await eventos()).find((e) => e.tipo_operacion === 'cambio_estado_nota');
    expect(cambio.usuario_id).toBe(1);
    expect(cambio.resumen).toMatch(/pendiente.*hecho/);
  });

  test('eliminar una nota registra el evento y el historial de esa nota se conserva', async () => {
    const nota = (await request(app).post('/api/notas').set(conToken(tokenUsuario)).send({ titulo: 'Temporal' })).body;
    const borrar = await request(app).delete(`/api/notas/${nota.id}`).set(conToken(tokenAdmin));
    expect(borrar.status).toBe(204);

    // la nota ya no existe...
    const { rows } = await pool.query('SELECT 1 FROM notas WHERE id = $1', [nota.id]);
    expect(rows).toHaveLength(0);

    // ...pero su historial sigue disponible, incluso para un usuario normal
    const res = await request(app)
      .get(`/api/historial?tipo_recurso=nota&recurso_id=${nota.id}`)
      .set(conToken(tokenUsuario));
    expect(res.status).toBe(200);
    expect(res.body.map((e) => e.tipo_operacion).sort()).toEqual(['creacion_nota', 'eliminacion_nota']);
    expect(res.body[0].resumen).toContain('Temporal');
  });

  test('los eventos de usuarios se registran: crear, editar, desactivar y reactivar', async () => {
    const creado = await request(app).post('/api/usuarios').set(conToken(tokenAdmin))
      .send({ nombre: 'Laura', correo: 'laura@demo.com', password: 'Laura1234', rol: 'usuario' });
    const id = creado.body.id;

    await request(app).put(`/api/usuarios/${id}`).set(conToken(tokenAdmin))
      .send({ nombre: 'Laura Gómez', correo: 'laura@demo.com', rol: 'usuario' });
    await request(app).patch(`/api/usuarios/${id}/estado`).set(conToken(tokenAdmin)).send({ activo: false });
    await request(app).patch(`/api/usuarios/${id}/estado`).set(conToken(tokenAdmin)).send({ activo: true });

    const delUsuario = (await eventos()).filter((e) => e.tipo_recurso === 'usuario' && e.recurso_id === id);
    expect(delUsuario.map((e) => e.tipo_operacion)).toEqual([
      'creacion_usuario',
      'edicion_usuario',
      'desactivacion_usuario',
      'reactivacion_usuario',
    ]);
    expect(delUsuario.every((e) => e.usuario_id === 1)).toBe(true); // lo hizo el admin
  });

  test('una operación que falla la validación no deja registros en el historial', async () => {
    await request(app).post('/api/notas').set(conToken(tokenUsuario)).send({ titulo: '' });
    await request(app).post('/api/usuarios').set(conToken(tokenAdmin))
      .send({ nombre: 'X', correo: 'no-es-correo', password: 'abc', rol: 'usuario' });

    expect(await eventos()).toHaveLength(0);
  });

  test('el historial nunca guarda contraseñas ni tokens', async () => {
    await request(app).post('/api/usuarios').set(conToken(tokenAdmin))
      .send({ nombre: 'Marta', correo: 'marta@demo.com', password: 'Secreta1234', rol: 'usuario' });
    const cambio = await request(app).put('/api/cambiar-password').set(conToken(tokenUsuario))
      .send({ password_actual: PASSWORD_DEMO, password_nueva: 'ClaveNueva99' });
    expect(cambio.status).toBe(200);

    const todo = JSON.stringify(await eventos());
    for (const secreto of ['Secreta1234', 'ClaveNueva99', PASSWORD_DEMO, tokenAdmin, tokenUsuario, 'password_hash']) {
      expect(todo).not.toContain(secreto);
    }
    expect((await eventos()).map((e) => e.tipo_operacion)).toContain('cambio_password');
  });

  test('la consulta devuelve los eventos más recientes primero y permite paginar', async () => {
    for (const titulo of ['Uno', 'Dos', 'Tres']) {
      await request(app).post('/api/notas').set(conToken(tokenUsuario)).send({ titulo });
    }

    const pagina1 = await request(app).get('/api/historial?limite=2&desde=0').set(conToken(tokenUsuario));
    const pagina2 = await request(app).get('/api/historial?limite=2&desde=2').set(conToken(tokenUsuario));

    expect(pagina1.body.map((e) => e.resumen)).toEqual(['Se creó la nota "Tres"', 'Se creó la nota "Dos"']);
    expect(pagina2.body.map((e) => e.resumen)).toEqual(['Se creó la nota "Uno"']);
    expect(pagina1.body[0]).toHaveProperty('usuario_nombre', 'Usuario Demo');
  });

  test('rechaza parámetros de paginación inválidos', async () => {
    const res = await request(app).get('/api/historial?limite=100000').set(conToken(tokenUsuario));
    expect(res.status).toBe(400);
  });
});
