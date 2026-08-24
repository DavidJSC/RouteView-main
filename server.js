const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── Configuración ──────────────────────────────────────────────────────────────
const STEF_BASE    = 'http://stefserver:5001';
const BUSES_API    = `${STEF_BASE}/api/buses`;
const LOGIN_URL    = `${STEF_BASE}/login`;

// Credenciales: ponelas aquí o como variables de entorno
const STEF_USUARIO = process.env.STEF_USUARIO || 'ALANIS';
const STEF_CLAVE   = process.env.STEF_CLAVE   || 'ALEX2021';

// Cookie en memoria — se renueva automáticamente al expirar
let sessionCookie = '';
let loginEnProceso = false;

// ── Login automático ───────────────────────────────────────────────────────────
async function login() {
  if (loginEnProceso) {
    // Esperar a que termine el login en curso
    await new Promise(resolve => setTimeout(resolve, 1500));
    return;
  }
  loginEnProceso = true;
  try {
    console.log('🔑 Iniciando sesión en stefserver...');
    const body = new URLSearchParams({ usuario: STEF_USUARIO, clave: STEF_CLAVE });
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual'   // no seguir el redirect automáticamente
    });

    // El servidor devuelve 302 al redirigir tras login exitoso
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      // Extraer solo "session=..." sin los atributos extra (Path, Expires, etc.)
      sessionCookie = setCookie.split(';')[0].trim();
      console.log('✅ Sesión renovada en stefserver.');
    } else {
      console.warn('⚠️  Login completado pero no se recibió cookie — verificá usuario/clave.');
    }
  } catch (err) {
    console.error('❌ Error al hacer login en stefserver:', err.message);
  } finally {
    loginEnProceso = false;
  }
}

// ── Consulta al API con reintento automático si la sesión expiró 
async function fetchBusesData() {
  if (!sessionCookie) await login();

  const response = await fetch(BUSES_API, {
    headers: { 'Accept': 'application/json', 'Cookie': sessionCookie }
  });

  // Sesión expirada → renovar y reintentar una vez
  if (response.status === 302 || response.status === 401 || response.status === 403) {
    console.warn('⚠️  Sesión expirada. Renovando...');
    sessionCookie = '';
    await login();

    const retry = await fetch(BUSES_API, {
      headers: { 'Accept': 'application/json', 'Cookie': sessionCookie }
    });
    return retry;
  }

  return response;
}

// ── Endpoints ──────────────────────────────────────────────────────────────────
app.get('/api/buses', async (req, res) => {
  try {
    const response = await fetchBusesData();

    if (!response.ok) {
      throw new Error(`stefserver respondió con status ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('❌ Error consultando stefserver:', error.message);
    res.status(502).json({
      status: 'error',
      message: 'No se pudo conectar con stefserver:5001',
      detalle: error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Proxy RouteView funcionando', sesionActiva: !!sessionCookie });
});

// ── Arranque ───────────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`✅ Servidor RouteView ejecutándose en http://localhost:${PORT}`);
  console.log(`   Endpoint: http://localhost:${PORT}/api/buses`);
  console.log(`   Origen:   ${BUSES_API}`);
  await login();   // Login automático al arrancar
});