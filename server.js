const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Proxy KML (lógica original sin modificar) ────────────────────────────────
const KML_SOURCE_URL = 'http://10.0.0.16:8081/Kml_File.kml';

app.get('/api/buses', async (req, res) => {
  try {
    const response = await fetch(KML_SOURCE_URL);
    if (!response.ok) throw new Error(`El servidor KML respondió con status ${response.status}`);
    const kmlText = await response.text();
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(kmlText);
  } catch (error) {
    console.error(' Error consultando el KML de origen:', error.message);
    res.status(502).json({
      status: 'error',
      message: 'No se pudo conectar con el servidor KML de origen (10.0.0.16:8081)',
      detalle: error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Proxy de buses funcionando' });
});

// ─── Base de usuarios en memoria (reinicia con el servidor) ───────────────────
// Para persistencia real, reemplazar con una DB o archivo JSON.
const usuarios = [];

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generarToken(userId) {
  // Token simple: base64 de un payload con timestamp
  // En producción usar jsonwebtoken (JWT)
  const payload = JSON.stringify({ userId, ts: Date.now() });
  return Buffer.from(payload).toString('base64');
}

function verificarToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    return usuarios.find(u => u.id === payload.userId) || null;
  } catch {
    return null;
  }
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { fullName, email, password } = req.body;

  // Validaciones básicas
  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Formato de correo inválido' });
  }

  // Verificar que no exista el correo
  if (usuarios.find(u => u.email === email.toLowerCase())) {
    return res.status(409).json({ message: 'Este correo ya está registrado' });
  }

  const nuevoUsuario = {
    id: crypto.randomUUID(),
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    password: hashPassword(password),
    creadoEn: new Date().toISOString()
  };
  usuarios.push(nuevoUsuario);

  console.log(`✅ Nuevo usuario registrado: ${nuevoUsuario.email}`);
  res.status(201).json({
    message: 'Cuenta creada exitosamente',
    user: { id: nuevoUsuario.id, fullName: nuevoUsuario.fullName, email: nuevoUsuario.email }
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
  }

  const usuario = usuarios.find(
    u => u.email === email.toLowerCase() && u.password === hashPassword(password)
  );

  if (!usuario) {
    return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
  }

  const token = generarToken(usuario.id);
  console.log(`🔑 Login: ${usuario.email}`);
  res.json({
    token,
    user: { id: usuario.id, fullName: usuario.fullName, email: usuario.email }
  });
});

// ── GET /api/auth/perfil  (ruta protegida) ───────────────────────────────────
app.get('/api/auth/perfil', (req, res) => {
  const usuario = verificarToken(req.headers.authorization);
  if (!usuario) {
    return res.status(401).json({ message: 'Token inválido o no proporcionado' });
  }
  res.json({
    user: { id: usuario.id, fullName: usuario.fullName, email: usuario.email, creadoEn: usuario.creadoEn }
  });
});

// ─── Arranque ─────────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`READY! Servidor RouteView ejecutándose en http://localhost:${PORT}`);
  console.log(`   Bus proxy:  GET  http://localhost:${PORT}/api/buses`);
  console.log(`   Register:   POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   Login:      POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   Perfil:     GET  http://localhost:${PORT}/api/auth/perfil  (requiere token)`);
});