
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