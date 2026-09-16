const { Client } = require('pg');

exports.handler = async (event) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    const resultado = await client.query(`
      SELECT estado, COUNT(*) as cantidad
      FROM notas
      GROUP BY estado
    `);

    const totalResultado = await client.query('SELECT COUNT(*) as total FROM notas');

    const distribucion = { pendiente: 0, en_curso: 0, hecho: 0 };
    resultado.rows.forEach((fila) => {
      distribucion[fila.estado] = parseInt(fila.cantidad);
    });

    await client.end();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        total: parseInt(totalResultado.rows[0].total),
        distribucion,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al calcular métricas' }),
    };
  }
};