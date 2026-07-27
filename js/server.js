const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de la base de datos SQL Server (DFS)
const dbConfig = {
  user: 'usr_lectura_gps',
  password: 'dsamsa.2026', 
  server: '10.0.0.16',
  port: 1434,
  database: 'DFS',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000
  }
};

/**
 * Decodifica tanto Buffers (varbinary) como strings/números directos a una coordenada decimal flotante.
 */
function decodeCoordinateBuffer(val) {
  if (val === null || val === undefined) return null;

  try {
    // Si ya es un número directo desde SQL (decimal / float)
    if (typeof val === 'number') {
      let num = val;
      if (Math.abs(num) > 180) num = num / 10000;
      return num;
    }

    // Convertir a Buffer si viene como array o buffer de Node
    let buf = Buffer.isBuffer(val) ? val : (Array.isArray(val) ? Buffer.from(val) : null);

    let str = '';
    if (buf) {
      // 1. Filtrar bytes nulos si es varbinary
      const cleanBytes = [];
      for (const byte of buf) {
        if (byte !== 0x00) cleanBytes.push(byte);
      }
      str = Buffer.from(cleanBytes).toString('utf-8').trim();
    } else {
      // Si viene como string convencional
      str = String(val).trim();
    }

    str = str.replace(/[^0-9.-]/g, '');

    let num = parseFloat(str);
    if (isNaN(num)) return null;

    // Ajuste de escala si la coordenada sobrepasa los límites geográficos habituales
    if (Math.abs(num) > 180) {
      num = num / 10000; 
    }

    return num;
  } catch (error) {
    return null;
  }
}

// Endpoint para consultar los buses activos
app.get('/api/buses', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT 
        bus_id, 
        fecha_registro, 
        velocidad, 
        pasajeros_abordo, 
        lat_raw, 
        lng_raw 
      FROM dbo.vw_monitoreo_buses_activos
    `);

    const buses = result.recordset.map(row => {
      let lat = decodeCoordinateBuffer(row.lat_raw);
      let lng = decodeCoordinateBuffer(row.lng_raw);

      // Garantizar signo negativo para longitud en Costa Rica / Hemisferio Oeste
      if (lng !== null && lng > 0) {
        lng = -lng;
      }

      return {
        bus_id: row.bus_id,
        fecha_registro: row.fecha_registro,
        velocidad: row.velocidad ?? 0,
        pasajeros_abordo: row.pasajeros_abordo ?? 0,
        latitud: lat,
        longitud: lng,
        en_rango: (lat !== null && lng !== null && lat >= 8.0 && lat <= 11.5 && lng >= -86.0 && lng <= -82.5)
      };
    });

    res.json({ status: 'ok', total: buses.length, data: buses });
  } catch (error) {
    console.error('Error al conectar con SQL Server:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor RouteView ejecutándose en http://localhost:${PORT}`);
});