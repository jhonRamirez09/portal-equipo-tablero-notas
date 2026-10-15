// Se ejecuta antes de cargar la aplicación en cada archivo de pruebas:
// apunta la app a la base de pruebas y fija un secreto de pruebas.
const url = new URL(process.env.DATABASE_URL);
url.pathname = '/portal_test';
process.env.DATABASE_URL = url.toString();
process.env.JWT_SECRET = 'secreto-solo-para-pruebas';
