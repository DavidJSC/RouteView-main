/**
 * RouteView - Utilidades de Tiempo Estimado de Llegada (ETA)
 * Archivo independiente: funciones puras para calcular distancia y ETA.
 *
 * IMPORTANTE: el KML del GPS solo trae la posición del BUS, no la de las
 * paradas. Para un ETA real necesitas las coordenadas (lat, lng) de cada
 * parada. Mientras tanto, PARADAS_EJEMPLO abajo tiene una parada de prueba
 * para que veas el cálculo funcionando — reemplázala por tus datos reales.
 */

// 👉 Reemplaza esto con las coordenadas reales de tus paradas cuando las tengas
const PARADAS_EJEMPLO = [
    { id: 'parada-utn', nombre: 'UTN Sede Central', lat: 10.0159, lng: -84.2141 },
    { id: 'parada-parque', nombre: 'Parque Central de Alajuela', lat: 10.0163, lng: -84.2088 }
];

/**
 * Calcula la distancia en kilómetros entre dos coordenadas usando la
 * fórmula de Haversine (distancia sobre la superficie de la Tierra).
 */
function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = gradosARadianes(lat2 - lat1);
    const dLng = gradosARadianes(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(gradosARadianes(lat1)) * Math.cos(gradosARadianes(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function gradosARadianes(grados) {
    return grados * (Math.PI / 180);
}

/**
 * Calcula el tiempo estimado de llegada (en minutos) de un bus a una parada,
 * dada su velocidad actual en km/h.
 * Si el bus está detenido (velocidad 0), usa una velocidad promedio de
 * respaldo para no dividir entre cero.
 */
function calcularETA(busLat, busLng, paradaLat, paradaLng, velocidadKmH) {
    const distanciaKm = calcularDistanciaKm(busLat, busLng, paradaLat, paradaLng);
    const velocidadEfectiva = velocidadKmH > 3 ? velocidadKmH : 15; // km/h de respaldo si está detenido/muy lento

    const horas = distanciaKm / velocidadEfectiva;
    const minutos = Math.round(horas * 60);

    return {
        distanciaKm: Math.round(distanciaKm * 10) / 10,
        minutos: minutos
    };
}

/**
 * Encuentra la parada más cercana a un bus (de la lista de paradas dada)
 * y devuelve su ETA. Útil para mostrar "Llega a X en ~8 min" sin que el
 * usuario tenga que elegir la parada manualmente.
 */
function calcularETAParadaMasCercana(busLat, busLng, velocidadKmH, listaParadas = PARADAS_EJEMPLO) {
    let mejor = null;

    listaParadas.forEach((parada) => {
        const resultado = calcularETA(busLat, busLng, parada.lat, parada.lng, velocidadKmH);
        if (!mejor || resultado.distanciaKm < mejor.distanciaKm) {
            mejor = { ...resultado, parada: parada.nombre };
        }
    });

    return mejor;
}

// Se exponen globalmente para que main.js (u otros scripts) las usen directamente
window.calcularDistanciaKm = calcularDistanciaKm;
window.calcularETA = calcularETA;
window.calcularETAParadaMasCercana = calcularETAParadaMasCercana;
window.PARADAS_EJEMPLO = PARADAS_EJEMPLO;