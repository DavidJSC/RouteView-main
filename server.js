const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// URL real del KML del GPS (Optocontrol / dispositivo en tu LAN)
const KML_SOURCE_URL = 'http://10.0.0.16:8081/Kml_File.kml';

// Endpoint que el frontend consume (evita el bloqueo CORS del navegador)
app.get('/api/buses', async (req, res) => {
  try {
    const response = await fetch(KML_SOURCE_URL);

    if (!response.ok) {
      throw new Error(`El servidor KML respondió con status ${response.status}`);
    }

    const kmlText = await response.text();

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(kmlText);
  } catch (error) {
    console.error('❌ Error consultando el KML de origen:', error.message);
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor RouteView (proxy KML) ejecutándose en http://localhost:${PORT}`);
  console.log(`   Endpoint de buses: http://localhost:${PORT}/api/buses`);
  console.log(`   Consultando origen: ${KML_SOURCE_URL}`);
});