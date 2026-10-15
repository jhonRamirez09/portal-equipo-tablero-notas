const { app, pool, request, PASSWORD_DEMO, reiniciarBase } = require('./helpers');

beforeEach(reiniciarBase);
afterAll(() => pool.end());

describe('Inicio de sesión', () => {
  test('con credenciales válidas devuelve un token y los datos del usuario', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ correo: 'usuario@demo.com', password: PASSWORD_DEMO });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.usuario).toEqual({
      id: 2,
      nombre: 'Usuario Demo',
      correo: 'usuario@demo.com',
      rol: 'usuario',
    });
  });

  test('nunca devuelve el hash ni la contraseña', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ correo: 'usuario@demo.com', password: PASSWORD_DEMO });

    const texto = JSON.stringify(res.body);
    expect(texto).not.toContain('password_hash');
    expect(texto).not.toContain(PASSWORD_DEMO);
  });

  test('con contraseña incorrecta responde 401', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ correo: 'usuario@demo.com', password: 'Incorrecta1' });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  test('con un correo inexistente responde 401 con el mismo mensaje (no revela si el correo existe)', async () => {
    const incorrecta = await request(app)
      .post('/api/login')
      .send({ correo: 'usuario@demo.com', password: 'Incorrecta1' });
    const inexistente = await request(app)
      .post('/api/login')
      .send({ correo: 'nadie@demo.com', password: PASSWORD_DEMO });

    expect(inexistente.status).toBe(401);
    expect(inexistente.body.error).toBe(incorrecta.body.error);
  });

  test('sin correo o sin contraseña responde 400', async () => {
    const sinPassword = await request(app).post('/api/login').send({ correo: 'usuario@demo.com' });
    const sinCorreo = await request(app).post('/api/login').send({ password: PASSWORD_DEMO });
    const vacio = await request(app).post('/api/login').send({});

    expect(sinPassword.status).toBe(400);
    expect(sinCorreo.status).toBe(400);
    expect(vacio.status).toBe(400);
  });

  test('rechaza datos que no son texto (por ejemplo un objeto) con 400', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ correo: { $ne: '' }, password: { $ne: '' } });

    expect(res.status).toBe(400);
  });

  test('un usuario desactivado no puede iniciar sesión (403)', async () => {
    await pool.query("UPDATE usuarios SET activo = false WHERE correo = 'usuario@demo.com'");

    const res = await request(app)
      .post('/api/login')
      .send({ correo: 'usuario@demo.com', password: PASSWORD_DEMO });

    expect(res.status).toBe(403);
    expect(res.body.token).toBeUndefined();
  });

  test('un JSON mal formado responde 400 sin revelar detalles internos', async () => {
    const res = await request(app)
      .post('/api/login')
      .set('Content-Type', 'application/json')
      .send('{"correo": "x", ');

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|at .*\.js|node_modules/);
  });
});
