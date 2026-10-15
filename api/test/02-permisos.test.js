const {
  app, pool, request, reiniciarBase, login, conToken, insertarNota, tokenExpirado,
} = require('./helpers');

beforeEach(reiniciarBase);
afterAll(() => pool.end());

describe('Sesiones: acceso a recursos protegidos', () => {
  test('sin token todos los recursos protegidos responden 401', async () => {
    for (const ruta of ['/api/notas', '/api/usuarios', '/api/historial']) {
      const res = await request(app).get(ruta);
      expect(res.status).toBe(401);
    }
  });

  test('un token inventado responde 401', async () => {
    const res = await request(app).get('/api/notas').set(conToken('token-falso'));
    expect(res.status).toBe(401);
  });

  test('un token expirado responde 401', async () => {
    const res = await request(app).get('/api/notas').set(conToken(tokenExpirado()));
    expect(res.status).toBe(401);
  });

  test('un usuario desactivado con un token todavía vigente pierde el acceso (403)', async () => {
    const token = await login('usuario@demo.com');
    const antes = await request(app).get('/api/notas').set(conToken(token));
    expect(antes.status).toBe(200);

    await pool.query("UPDATE usuarios SET activo = false WHERE correo = 'usuario@demo.com'");

    const despues = await request(app).get('/api/notas').set(conToken(token));
    expect(despues.status).toBe(403);
  });
});

describe('Permisos por rol (validados en el servidor)', () => {
  test('un usuario normal no puede listar, crear ni modificar usuarios (403)', async () => {
    const token = await login('usuario@demo.com');

    const listar = await request(app).get('/api/usuarios').set(conToken(token));
    const crear = await request(app)
      .post('/api/usuarios')
      .set(conToken(token))
      .send({ nombre: 'Intruso', correo: 'intruso@demo.com', password: 'Intruso1234', rol: 'admin' });
    const editar = await request(app)
      .put('/api/usuarios/2')
      .set(conToken(token))
      .send({ nombre: 'Usuario Demo', correo: 'usuario@demo.com', rol: 'admin' });
    const estado = await request(app)
      .patch('/api/usuarios/1/estado')
      .set(conToken(token))
      .send({ activo: false });

    expect(listar.status).toBe(403);
    expect(crear.status).toBe(403);
    expect(editar.status).toBe(403);
    expect(estado.status).toBe(403);

    // y comprobamos que de verdad no se modificó nada
    const { rows } = await pool.query('SELECT rol, activo FROM usuarios ORDER BY id');
    expect(rows).toEqual([
      { rol: 'admin', activo: true },
      { rol: 'usuario', activo: true },
    ]);
  });

  test('un administrador sí puede listar usuarios', async () => {
    const token = await login('admin@demo.com');
    const res = await request(app).get('/api/usuarios').set(conToken(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  test('el rol se toma de la base de datos, no del token (un admin degradado pierde el acceso)', async () => {
    const token = await login('admin@demo.com'); // el token dice "admin"
    await pool.query("UPDATE usuarios SET rol = 'usuario' WHERE correo = 'admin@demo.com'");

    const res = await request(app).get('/api/usuarios').set(conToken(token));
    expect(res.status).toBe(403);
  });

  test('un usuario normal no puede ver el historial de usuarios (403)', async () => {
    const token = await login('usuario@demo.com');
    const res = await request(app).get('/api/historial?tipo_recurso=usuario').set(conToken(token));
    expect(res.status).toBe(403);
  });

  test('sin filtros, un usuario normal solo ve eventos de notas; el admin ve todo', async () => {
    const admin = await login('admin@demo.com');
    const normal = await login('usuario@demo.com');

    await request(app).post('/api/notas').set(conToken(normal)).send({ titulo: 'Mi nota' });
    await request(app)
      .post('/api/usuarios')
      .set(conToken(admin))
      .send({ nombre: 'Nuevo', correo: 'nuevo@demo.com', password: 'Nuevo1234', rol: 'usuario' });

    const vistoPorNormal = await request(app).get('/api/historial').set(conToken(normal));
    const vistoPorAdmin = await request(app).get('/api/historial').set(conToken(admin));

    expect(vistoPorNormal.status).toBe(200);
    expect(vistoPorNormal.body.every((e) => e.tipo_recurso === 'nota')).toBe(true);
    expect(vistoPorNormal.body).toHaveLength(1);

    const tipos = vistoPorAdmin.body.map((e) => e.tipo_recurso).sort();
    expect(tipos).toEqual(['nota', 'usuario']);
  });

  test('el historial es de solo lectura: no se puede crear, modificar ni borrar registros', async () => {
    const admin = await login('admin@demo.com');
    await request(app).post('/api/notas').set(conToken(admin)).send({ titulo: 'Algo' });

    const crear = await request(app).post('/api/historial').set(conToken(admin)).send({ resumen: 'x' });
    const editar = await request(app).put('/api/historial/1').set(conToken(admin)).send({ resumen: 'x' });
    const borrar = await request(app).delete('/api/historial/1').set(conToken(admin));

    for (const res of [crear, editar, borrar]) {
      expect([404, 405]).toContain(res.status);
    }
    const { rows } = await pool.query('SELECT count(*)::int AS total FROM historial');
    expect(rows[0].total).toBe(1);
  });

  test('un usuario normal sí puede trabajar con las notas', async () => {
    const token = await login('usuario@demo.com');
    await insertarNota({ titulo: 'Existente' });

    const res = await request(app).get('/api/notas').set(conToken(token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
