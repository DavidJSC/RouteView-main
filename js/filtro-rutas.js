/**
 * RouteView - Filtro de Buses por Ruta
 * Archivo independiente: agrega un <select> arriba del mapa en index.html
 * y filtra qué buses se dibujan según la ruta elegida.
 *
 * Se conecta con main.js mediante 2 "ganchos" globales:
 *   - window.ultimosBusesDetectados  (lista completa que llega del KML)
 *   - window.aplicarFiltroRuta(buses)  (función que main.js llama antes de
 *     dibujar, y que este archivo define)
 *
 * Debe cargarse DESPUÉS de js/main.js en el HTML.
 */

let rutaSeleccionadaActual = 'todas';

document.addEventListener('DOMContentLoaded', () => {
    crearSelectorDeRuta();
    // Revisa cada segundo si ya llegaron buses nuevos, para refrescar las
    // opciones del <select> (rutas nuevas que aparezcan en el KML)
    setInterval(actualizarOpcionesDeRuta, 1000);
});

function crearSelectorDeRuta() {
    const contenedorTitulo = document.querySelector('.mapa-titulo');
    if (!contenedorTitulo) return; // Esta página no tiene el mapa (registro.html, rutas.html)

    const select = document.createElement('select');
    select.id = 'filtro-ruta-mapa';
    select.style.cssText = 'margin-left: 10px; padding: 3px 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.8rem;';

    const opcionTodas = document.createElement('option');
    opcionTodas.value = 'todas';
    opcionTodas.textContent = 'Todas las rutas';
    select.appendChild(opcionTodas);

    select.addEventListener('change', () => {
        rutaSeleccionadaActual = select.value;
        // No esperamos al próximo fetch: si ya tenemos datos, re-renderizamos ya mismo
        if (window.ultimosBusesDetectados && typeof renderBuses === 'function') {
            renderBuses(aplicarFiltroRuta(window.ultimosBusesDetectados));
        }
    });

    contenedorTitulo.appendChild(select);
}

function actualizarOpcionesDeRuta() {
    const select = document.getElementById('filtro-ruta-mapa');
    const buses = window.ultimosBusesDetectados;
    if (!select || !Array.isArray(buses)) return;

    const rutasUnicas = new Set(
        buses
            .map(bus => bus.ruta)
            .filter(ruta => ruta && ruta !== 'No asignada')
    );

    rutasUnicas.forEach((ruta) => {
        const yaExiste = Array.from(select.options).some(op => op.value === ruta);
        if (!yaExiste) {
            const opcion = document.createElement('option');
            opcion.value = ruta;
            opcion.textContent = ruta;
            select.appendChild(opcion);
        }
    });
}

/**
 * Filtra la lista de buses según la ruta seleccionada.
 * main.js llama a esta función (window.aplicarFiltroRuta) antes de dibujar.
 */
function aplicarFiltroRuta(buses) {
    if (rutaSeleccionadaActual === 'todas') return buses;
    return buses.filter(bus => bus.ruta === rutaSeleccionadaActual);
}

window.aplicarFiltroRuta = aplicarFiltroRuta;