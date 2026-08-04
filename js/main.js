/**
 * RouteView - Lógica Global del Mini Proyecto
 * Curso: ISW-521 Programación en Ambiente Web I - UTN
 * Desarrollado por: Mía & David
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA REUTILIZABLE: MENÚ MÓVIL (HAMBURGUESA) ---
    const hamburger = document.getElementById('hamburger');
    const menuMovil = document.getElementById('menu-movil');

    if (hamburger && menuMovil) {
        hamburger.addEventListener('click', () => {
            const indexploded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', !indexploded);
            menuMovil.classList.toggle('open');
            menuMovil.style.display = menuMovil.classList.contains('open') ? 'block' : 'none';
        });
    }

    // =========================================================================
    // 1. LÓGICA PARA LA PÁGINA DE CATÁLOGO (rutas.html)
    //    Ya NO usa datos de prueba (rutas.json). Ahora construye el catálogo
    //    agrupando los buses reales del KML por el texto de ruta que traen.
    // =========================================================================
    const contenedorCatalogo = document.getElementById('contenedor-catalogo-rutas');
    
    if (contenedorCatalogo) {
        const inputBusqueda = document.getElementById('input-busqueda');
        const filtroEstado = document.getElementById('filtro-estado');
        const sinResultados = document.getElementById('sin-resultados');

        let todasLasRutas = [];
        const rutasExpandidas = new Set(); // recuerda qué tarjetas dejaste abiertas entre refrescos

        cargarRutasDesdeBuses();
        setInterval(cargarRutasDesdeBuses, 8000); // refresca el catálogo cada 8s

        async function cargarRutasDesdeBuses() {
            try {
                const response = await fetch('http://localhost:3000/api/buses');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const kmlText = await response.text();
                const buses = parsearKML(kmlText);

                todasLasRutas = agruparBusesPorRuta(buses);
                filtrarCatalogo(); // aplica los filtros actuales (si hay) y renderiza
            } catch (error) {
                console.error("Error en RouteView:", error);
                contenedorCatalogo.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: red; font-weight: bold; padding: 20px;">Error al conectar con el servidor de buses (http://localhost:3000/api/buses). Verifica que server.js esté corriendo.</p>`;
            }
        }

        // Agrupa la lista plana de buses en un catálogo de rutas únicas
        function agruparBusesPorRuta(buses) {
            const mapa = new Map();

            buses.forEach((bus) => {
                const nombreRuta = bus.ruta && bus.ruta !== 'No asignada' ? bus.ruta : null;
                if (!nombreRuta) return; // Ignoramos buses sin ruta asignada en el catálogo

                if (!mapa.has(nombreRuta)) {
                    mapa.set(nombreRuta, {
                        id: 'ruta-' + nombreRuta.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                        nombreRuta: nombreRuta,
                        buses: []
                    });
                }
                mapa.get(nombreRuta).buses.push(bus);
            });

            return Array.from(mapa.values()).map((ruta) => {
                const cantidadBuses = ruta.buses.length;
                const pasajerosHoy = ruta.buses.reduce((sum, b) => sum + (b.pasajeros_hoy || 0), 0);
                const velocidadPromedio = cantidadBuses > 0
                    ? Math.round(ruta.buses.reduce((sum, b) => sum + (b.velocidad || 0), 0) / cantidadBuses)
                    : 0;

                return {
                    id: ruta.id,
                    nombreRuta: ruta.nombreRuta,
                    cantidadBuses: cantidadBuses,
                    pasajerosHoy: pasajerosHoy,
                    velocidadPromedio: velocidadPromedio,
                    estado: cantidadBuses > 0 ? 'Activo' : 'Sin unidades',
                    buses: ruta.buses // lista individual, para el detalle expandible
                };
            });
        }

        function renderizarTarjetas(rutas) {
            contenedorCatalogo.innerHTML = ''; 

            if (rutas.length === 0) {
                if (sinResultados) sinResultados.style.display = 'block';
                return;
            }
            if (sinResultados) sinResultados.style.display = 'none';

            rutas.forEach(ruta => {
                const colorEstado = ruta.estado === 'Activo' ? '#28a745' : '#6c757d';

                // Genera el detalle de cada bus individual (con ETA si eta-utils.js está cargado)
                const detalleBuses = (ruta.buses || []).map((bus) => {
                    let lineaEta = '';
                    if (typeof window.calcularETAParadaMasCercana === 'function' && bus.lat && bus.lng) {
                        const eta = window.calcularETAParadaMasCercana(bus.lat, bus.lng, bus.velocidad || 0);
                        if (eta) {
                            lineaEta = ` · ⏱️ ~${eta.minutos} min a ${eta.parada}`;
                        }
                    }
                    return `
                        <li style="padding: 6px 0; border-top: 1px solid #eee; font-size: 0.8rem; color: #555;">
                            🚌 <b>Unidad #${bus.bus_id}</b> · ${bus.velocidad ?? 0} km/h${lineaEta}
                        </li>
                    `;
                }).join('');

                const estaExpandida = rutasExpandidas.has(ruta.id);

                const tarjeta = document.createElement('div');
                tarjeta.className = 'tarjeta-ruta';
                tarjeta.dataset.rutaId = ruta.id;
                tarjeta.style = 'background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; border-left: 5px solid ' + colorEstado;

                tarjeta.innerHTML = `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <span style="background: ${colorEstado}; color: #fff; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.75rem;">${ruta.estado}</span>
                        </div>
                        <h3 style="margin: 0 0 10px 0; font-size: 1.15rem; color: #333;">${ruta.nombreRuta}</h3>
                        <p style="font-size: 0.85rem; color: #666; margin: 4px 0;">🚌 <b>${ruta.cantidadBuses}</b> unidad(es) en tiempo real</p>
                        <p style="font-size: 0.85rem; color: #666; margin: 4px 0;">👥 <b>${ruta.pasajerosHoy}</b> pasajeros movilizados hoy</p>
                        <p style="font-size: 0.85rem; color: #666; margin: 4px 0 10px;">⚡ <b>${ruta.velocidadPromedio}</b> km/h promedio</p>

                        <button class="btn-ver-buses" style="background: none; border: none; color: #007AFF; font-size: 0.8rem; font-weight: bold; cursor: pointer; padding: 0 0 10px 0;">
                            ${estaExpandida ? 'Ocultar unidades ▴' : 'Ver unidades ▾'}
                        </button>
                        <ul class="lista-buses-detalle" style="display: ${estaExpandida ? 'block' : 'none'}; list-style: none; padding: 0; margin: 0 0 15px 0;">
                            ${detalleBuses || '<li style="font-size: 0.8rem; color: #999;">Sin unidades activas por ahora.</li>'}
                        </ul>
                    </div>
                    <button class="btn-agregar-fav" data-id="${ruta.id}" style="background: #00C48C; color: white; border: none; padding: 10px; border-radius: 4px; font-weight: bold; cursor: pointer; width: 100%;">
                         Añadir a Favoritos
                    </button>
                `;
                contenedorCatalogo.appendChild(tarjeta);
            });

            // Expandir/colapsar la lista de buses de cada tarjeta (y recordarlo en rutasExpandidas
            // para que sobreviva a los refrescos automáticos cada 8 segundos)
            document.querySelectorAll('.tarjeta-ruta').forEach((tarjetaEl) => {
                const boton = tarjetaEl.querySelector('.btn-ver-buses');
                const lista = tarjetaEl.querySelector('.lista-buses-detalle');
                const rutaId = tarjetaEl.dataset.rutaId;
                if (!boton || !lista) return;

                boton.addEventListener('click', () => {
                    const abrirAhora = lista.style.display !== 'block';
                    lista.style.display = abrirAhora ? 'block' : 'none';
                    boton.textContent = abrirAhora ? 'Ocultar unidades ▴' : 'Ver unidades ▾';

                    if (abrirAhora) {
                        rutasExpandidas.add(rutaId);
                    } else {
                        rutasExpandidas.delete(rutaId);
                    }
                });
            });

            const botonesFav = document.querySelectorAll('.btn-agregar-fav');
            botonesFav.forEach(boton => {
                boton.addEventListener('click', (e) => {
                    const idRuta = e.target.getAttribute('data-id');
                    const rutaSeleccionada = todasLasRutas.find(r => r.id === idRuta);
                    agregarAFavoritosLocalStorage(rutaSeleccionada);
                });
            });
        }

        function filtrarCatalogo() {
            const textoBusqueda = inputBusqueda ? inputBusqueda.value.toLowerCase().trim() : '';
            const estSeleccionado = filtroEstado ? filtroEstado.value : 'todos';

            const rutasFiltradas = todasLasRutas.filter(ruta => {
                const coincideTexto = ruta.nombreRuta.toLowerCase().includes(textoBusqueda);
                const coincideEstado = estSeleccionado === 'todos' || ruta.estado === estSeleccionado;
                return coincideTexto && coincideEstado;
            });

            renderizarTarjetas(rutasFiltradas);
        }

        if (inputBusqueda) inputBusqueda.addEventListener('input', filtrarCatalogo);
        if (filtroEstado) filtroEstado.addEventListener('change', filtrarCatalogo);

        function agregarAFavoritosLocalStorage(ruta) {
            let favoritos = JSON.parse(localStorage.getItem('misRutasFavoritas')) || [];
            
            if (favoritos.some(fav => fav.id === ruta.id)) {
                alert(`La ruta "${ruta.nombreRuta}" ya se encuentra en tus favoritas.`);
                return;
            }

            const nuevoFavorito = {
                id: ruta.id,
                alias: "Acceso Rápido",
                linea: ruta.nombreRuta,
                descripcion: `${ruta.cantidadBuses} unidad(es) activas · ${ruta.pasajerosHoy} pasajeros movilizados hoy`
            };

            favoritos.push(nuevoFavorito);
            localStorage.setItem('misRutasFavoritas', JSON.stringify(favoritos));
            alert(`¡"${ruta.nombreRuta}" se añadió exitosamente a Mis Rutas!`);
        }
    }

    // =========================================================================
    // 2. LÓGICA PARA LA PÁGINA DE GESTIÓN Y FORMULARIO (registro.html)
    // =========================================================================
    const formulario = document.getElementById('formulario-ruta');
    
    if (formulario) {
        const contenedorFavoritas = document.getElementById('contenedor-rutas-favoritas');
        const btnLimpiarTodo = document.getElementById('btn-limpiar');
        const mensajeExitoGlobal = document.getElementById('mensaje-exito');

        const txtAlias = document.getElementById('alias-ruta');
        const txtBus = document.getElementById('nombre-bus');
        const selCategoria = document.getElementById('categoria-ruta');
        const txtParada = document.getElementById('parada-usuario');
        const txtDescripcion = document.getElementById('descripcion-ruta');

        cargarFavoritosDOM();

        txtAlias.addEventListener('input', () => validarCampoVacio(txtAlias, 'error-alias', 'El alias es obligatorio para personalizar la ruta.'));
        txtBus.addEventListener('input', () => validarCampoVacio(txtBus, 'error-bus', 'Debe indicar el número o nombre oficial de la línea.'));
        selCategoria.addEventListener('change', () => validarCampoVacio(selCategoria, 'error-categoria', 'Seleccione una categoría válida.'));
        txtParada.addEventListener('input', () => validarCampoVacio(txtParada, 'error-parada', 'Escriba el punto o parada donde aborda el bus.'));
        txtDescripcion.addEventListener('input', () => {
            const errDesc = document.getElementById('error-descripcion');
            if (txtDescripcion.value.trim().length < 10) {
                if (errDesc) errDesc.textContent = 'La descripción debe ser más detallada (mínimo 10 caracteres).';
            } else {
                if (errDesc) errDesc.textContent = '';
            }
        });

        function validarCampoVacio(input, idError, mensaje) {
            const contenedorError = document.getElementById(idError);
            if (!contenedorError) return false;
            if (input.value.trim() === '') {
                contenedorError.textContent = mensaje;
                return false;
            } else {
                contenedorError.textContent = '';
                return true;
            }
        }

        formulario.addEventListener('submit', (e) => {
            e.preventDefault(); 

            const v1 = validarCampoVacio(txtAlias, 'error-alias', 'El alias es obligatorio.');
            const v2 = validarCampoVacio(txtBus, 'error-bus', 'Debe indicar la línea de bus.');
            const v3 = validarCampoVacio(selCategoria, 'error-categoria', 'Seleccione una categoría.');
            const v4 = validarCampoVacio(txtParada, 'error-parada', 'Escriba su parada usual.');
            const v5 = txtDescripcion.value.trim().length >= 10;
            
            const errDesc = document.getElementById('error-descripcion');
            if (!v5 && errDesc) {
                errDesc.textContent = 'La descripción debe tener mínimo 10 caracteres.';
            }

            if (v1 && v2 && v3 && v4 && v5) {
                const nuevaRutaFavorita = {
                    id: 'FAV-' + Date.now(), 
                    alias: txtAlias.value.trim(),
                    linea: txtBus.value.trim(),
                    categoria: selCategoria.value,
                    parada: txtParada.value.trim(),
                    descripcion: txtDescripcion.value.trim()
                };

                let favoritos = JSON.parse(localStorage.getItem('misRutasFavoritas')) || [];
                favoritos.push(nuevaRutaFavorita);
                localStorage.setItem('misRutasFavoritas', JSON.stringify(favoritos));

                formulario.reset();
                mostrarMensajeExito();
                cargarFavoritosDOM();
            }
        });

        function mostrarMensajeExito() {
            if (mensajeExitoGlobal) {
                mensajeExitoGlobal.style.display = 'block';
                setTimeout(() => {
                    mensajeExitoGlobal.style.display = 'none';
                }, 4000);
            }
        }

        function cargarFavoritosDOM() {
            if (!contenedorFavoritas) return;
            let favoritos = JSON.parse(localStorage.getItem('misRutasFavoritas')) || [];

            if (favoritos.length === 0) {
                contenedorFavoritas.innerHTML = `
                    <div class="estado-vacio" style="text-align: center; color: #777; padding: 40px 20px;">
                        <p style="font-size: 3rem; margin-bottom: 10px;"> 🚫 </p>
                        <p>Aún no has registrado rutas personalizadas.</p>
                    </div>`;
                return;
            }

            contenedorFavoritas.innerHTML = ''; 

            favoritos.forEach(fav => {
                const item = document.createElement('div');
                item.className = 'tarjeta-favorita-guardada';
                item.style = 'background: #f8f9fa; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin-bottom: 15px; position: relative;';

                item.innerHTML = `
                    <h3 style="margin: 0 0 5px 0; color: #00C48C; font-size: 1.15rem;">${fav.alias}</h3>
                    <p style="margin: 0 0 5px 0; font-weight: bold; font-size: 0.9rem;"> ${fav.linea} <span style="font-size:0.75rem; font-weight:normal; background:#cbd5e1; padding: 2px 6px; border-radius:3px; margin-left:5px;">${fav.categoria}</span></p>
                    <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #475569;"> <strong>Abordaje:</strong> ${fav.parada}</p>
                    <p style="margin: 0; font-size: 0.85rem; color: #64748b; font-style: italic;">"${fav.descripcion}"</p>
                    <button class="btn-eliminar-individual" data-id="${fav.id}" style="position: absolute; top: 15px; right: 15px; background: none; border: none; color: #dc3545; font-size: 1.1rem; cursor: pointer;" title="Eliminar de favoritos">
                        ❌
                    </button>
                `;
                contenedorFavoritas.appendChild(item);
            });

            const botonesEliminar = document.querySelectorAll('.btn-eliminar-individual');
            botonesEliminar.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idEliminar = e.target.getAttribute('data-id');
                    if (confirm('¿Está seguro de que desea eliminar esta ruta de sus favoritos?')) {
                        let favs = JSON.parse(localStorage.getItem('misRutasFavoritas')) || [];
                        favs = favs.filter(f => f.id !== idEliminar);
                        localStorage.setItem('misRutasFavoritas', JSON.stringify(favs));
                        cargarFavoritosDOM();
                    }
                });
            });
        }

        if (btnLimpiarTodo) {
            btnLimpiarTodo.addEventListener('click', () => {
                let favoritos = JSON.parse(localStorage.getItem('misRutasFavoritas')) || [];
                if (favoritos.length === 0) {
                    alert('No hay rutas guardadas para limpiar.');
                    return;
                }
                if (confirm('¿AVISO CRÍTICO?\n¿Desea borrar permanentemente TODAS sus rutas guardadas?')) {
                    localStorage.removeItem('misRutasFavoritas');
                    cargarFavoritosDOM();
                }
            });
        }
    }
});

// =========================================================================
// 3. LÓGICA DE GOOGLE MAPS API & MONITOREO DE BUSES EN TIEMPO REAL (KML)
//    server.js hace de proxy: consulta http://10.0.0.16:8081/Kml_File.kml
//    y lo sirve en /api/buses para evitar el bloqueo CORS del navegador.
// =========================================================================
let map;
const markers = {};
const busPaths = {};       // Guarda el historial de posiciones de cada bus (para dibujar su recorrido)
const busPolylines = {};   // Guarda la línea (Polyline) de cada bus en el mapa
const MAX_PUNTOS_RECORRIDO = 40; // Cuántos puntos de historial mantener por bus antes de descartar los más viejos

const KML_API_URL = 'http://localhost:3000/api/buses';

// Estilo de mapa tipo Uber: base grisácea/monocromática, sin íconos de comercios,
// carreteras resaltadas en blanco/gris claro, agua en un tono azul apagado.
const ESTILO_UBER = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", stylers: [{ visibility: "on" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "transit.line", stylers: [{ visibility: "off" }] },
    { featureType: "transit.station", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d6dc" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
];

function initMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    map = new google.maps.Map(mapElement, {
        center: { lat: 9.9333, lng: -84.0833 },
        zoom: 13,
        disableDefaultUI: false,
        styles: ESTILO_UBER
    });

    // Capa de tráfico de Google (colores en las calles: verde/naranja/rojo)
    // No requiere ninguna API adicional, viene incluida en Maps JavaScript API.
    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);

    fetchBuses();
    setInterval(fetchBuses, 5000);
}

async function fetchBuses() {
    const statsLabel = document.getElementById('stats-buses');

    try {
        const response = await fetch(KML_API_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const kmlText = await response.text();
        let dataBuses = parsearKML(kmlText);

        // Gancho para js/filtro-ruta.js: expone la lista completa (sin filtrar)
        // para que el dropdown pueda construir sus opciones, y aplica el
        // filtro seleccionado si esa función existe (archivo cargado).
        window.ultimosBusesDetectados = dataBuses;
        if (typeof window.aplicarFiltroRuta === 'function') {
            dataBuses = window.aplicarFiltroRuta(dataBuses);
        }

        if (statsLabel) {
            statsLabel.innerText = `${dataBuses.length} buses en tiempo real`;
            statsLabel.style.backgroundColor = '#22c55e';
        }

        renderBuses(dataBuses);
    } catch (error) {
        console.warn('⚠️ No se pudo conectar con el servidor (proxy KML).', error);

        if (statsLabel) {
            statsLabel.innerText = "Error de conexión con el backend";
            statsLabel.style.backgroundColor = '#ef4444';
        }
    }
}

// -------------------------------------------------------------------------
// Parseo del KML -> lista de objetos bus
// -------------------------------------------------------------------------
function parsearKML(kmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "text/xml");

    const errorNode = xmlDoc.querySelector('parsererror');
    if (errorNode) {
        console.error('Error parseando KML:', errorNode.textContent);
        return [];
    }

    const placemarks = Array.from(xmlDoc.getElementsByTagName('Placemark'));
    const buses = [];

    placemarks.forEach((placemark) => {
        const nameNode = placemark.getElementsByTagName('name')[0];
        const busId = nameNode ? nameNode.textContent.trim() : null;
        if (!busId) return;

        const pointNode = placemark.getElementsByTagName('Point')[0];
        const coordsNode = pointNode ? pointNode.getElementsByTagName('coordinates')[0] : null;
        if (!coordsNode) return;

        // En KML el orden es: longitud,latitud,altura
        const partesCoords = coordsNode.textContent.trim().split(',');
        const lng = parseFloat(partesCoords[0]);
        const lat = parseFloat(partesCoords[1]);

        if (isNaN(lat) || isNaN(lng)) return;

        // Validar rango de Costa Rica
        if (lat < 8 || lat > 12 || lng > -82 || lng < -86) return;

        const descNode = placemark.getElementsByTagName('description')[0];
        const descTexto = descNode ? descNode.textContent : '';

        buses.push({
            bus_id: busId,
            lat: lat,
            lng: lng,
            ...extraerDatosDescripcion(descTexto)
        });
    });

    return buses;
}

// Extrae "Velocidad: 15 Km/h", "Abordos: 40", "Ruta: ...", etc del texto plano
function extraerDatosDescripcion(texto) {
    const buscar = (etiqueta) => {
        const regex = new RegExp(etiqueta + '\\s*:\\s*(.+)', 'i');
        const match = texto.match(regex);
        return match ? match[1].trim() : null;
    };

    const velocidadTexto = buscar('Velocidad');
    const velocidad = velocidadTexto ? parseFloat(velocidadTexto) || 0 : 0;

    const abordosTexto = buscar('Abordos');
    const abordos = abordosTexto ? parseInt(abordosTexto, 10) || 0 : 0;

    const pasajerosHoyTexto = buscar('Pasajeros movilizados hoy');
    const pasajerosHoy = pasajerosHoyTexto ? parseInt(pasajerosHoyTexto, 10) || 0 : 0;

    return {
        actualizado: buscar('Actualizado'),
        velocidad: velocidad,
        pasajeros_abordo: abordos,
        pasajeros_hoy: pasajerosHoy,
        conductor: buscar('Conductor'),
        ruta: buscar('Ruta')
    };
}

// -------------------------------------------------------------------------
// Actualiza el historial de posiciones de un bus y dibuja/redibuja su rastro
// -------------------------------------------------------------------------
function actualizarRecorridoBus(busId, position) {
    if (!busPaths[busId]) {
        busPaths[busId] = [];
    }

    const historial = busPaths[busId];
    const ultimoPunto = historial[historial.length - 1];

    // Evita acumular puntos duplicados si el bus no se ha movido
    if (!ultimoPunto || ultimoPunto.lat !== position.lat || ultimoPunto.lng !== position.lng) {
        historial.push(position);
    }

    // Limita el historial para no acumular memoria infinitamente
    if (historial.length > MAX_PUNTOS_RECORRIDO) {
        historial.shift();
    }

    if (busPolylines[busId]) {
        busPolylines[busId].setPath(historial);
    } else {
        busPolylines[busId] = new google.maps.Polyline({
            path: historial,
            geodesic: true,
            strokeColor: '#007AFF',
            strokeOpacity: 0.6,
            strokeWeight: 3,
            map: map
        });
    }
}

// -------------------------------------------------------------------------
// Render de marcadores en el mapa
// -------------------------------------------------------------------------
function renderBuses(buses) {
    if (!Array.isArray(buses) || !map) return;

    const bounds = new google.maps.LatLngBounds();
    let busesDibujados = 0;

    buses.forEach((bus) => {
        const busId = bus.bus_id;
        const position = { lat: bus.lat, lng: bus.lng };

        actualizarRecorridoBus(busId, position);

        const iconoBus = {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="11" fill="#007AFF" stroke="#FFFFFF" stroke-width="1.5"/>
                    <path fill="#FFFFFF" d="M6 6.5C6 5.67 6.67 5 7.5 5h9C17.33 5 18 5.67 18 6.5v9c0 .6-.35 1.11-.85 1.36l.35.64h-1l-.5-.75h-7.5l-.5.75h-1l.35-.64A1.5 1.5 0 0 1 6 15.5v-9zM7.5 7v4.5h9V7h-9zM8 13.25a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm8 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"/>
                </svg>
            `),
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18)
        };

        const lugar = bus.ruta && bus.ruta !== 'No asignada' ? bus.ruta : 'En recorrido';
        const vel = bus.velocidad ?? 0;
        const abordo = bus.pasajeros_abordo ?? 0;
        const conductor = bus.conductor && bus.conductor !== 'No asignado' ? bus.conductor : 'Sin asignar';

        // ETA a la parada más cercana (usa js/eta-utils.js; PARADAS_EJEMPLO mientras
        // no tengas coordenadas reales de tus paradas — ver ese archivo)
        let filaEta = '';
        if (typeof window.calcularETAParadaMasCercana === 'function') {
            const eta = window.calcularETAParadaMasCercana(bus.lat, bus.lng, vel);
            if (eta) {
                filaEta = `<p style="margin: 3px 0; font-size: 0.85rem;">⏱️ <b>Llega a ${eta.parada} en:</b> ~${eta.minutos} min (${eta.distanciaKm} km)</p>`;
            }
        }

        const contenidoInfo = `
            <div style="color: #1e293b; padding: 6px; font-family: system-ui, sans-serif;">
                <h4 style="margin: 0 0 6px 0; color: #007AFF; font-size: 0.95rem;">
                    Unidad #${busId}
                </h4>
                <p style="margin: 3px 0; font-size: 0.85rem;">📍 <b>Sector/Ruta:</b> ${lugar}</p>
                <p style="margin: 3px 0; font-size: 0.85rem;">⚡ <b>Velocidad:</b> ${vel} km/h</p>
                <p style="margin: 3px 0; font-size: 0.85rem;">👥 <b>A bordo:</b> ${abordo} pasajeros</p>
                <p style="margin: 3px 0; font-size: 0.85rem;">🧑‍✈️ <b>Conductor:</b> ${conductor}</p>
                <p style="margin: 3px 0; font-size: 0.85rem;">📊 <b>Movilizados hoy:</b> ${bus.pasajeros_hoy ?? 0}</p>
                ${filaEta}
                <p style="margin: 3px 0; font-size: 0.75rem; color: #64748b;">🕒 ${bus.actualizado ?? ''}</p>
            </div>
        `;

        if (markers[busId]) {
            markers[busId].setPosition(position);
            if (markers[busId].infoWindow) {
                markers[busId].infoWindow.setContent(contenidoInfo);
            }
        } else {
            const marker = new google.maps.Marker({
                position: position,
                map: map,
                title: `Unidad #${busId}`,
                icon: iconoBus
            });

            const infoWindow = new google.maps.InfoWindow({
                content: contenidoInfo
            });

            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });

            marker.infoWindow = infoWindow;
            markers[busId] = marker;
        }

        bounds.extend(position);
        busesDibujados++;
    });

    if (busesDibujados > 0 && !window.mapaAjustado) {
        map.fitBounds(bounds);
        window.mapaAjustado = true;
    }

    // Oculta (sin borrar el historial) los buses que no vienen en esta lista,
    // ya sea porque el filtro de ruta los excluyó o porque dejaron de reportar.
    const idsActivos = new Set(buses.map(b => b.bus_id));
    Object.keys(markers).forEach((idExistente) => {
        const visible = idsActivos.has(idExistente);
        markers[idExistente].setVisible(visible);
        if (busPolylines[idExistente]) {
            busPolylines[idExistente].setMap(visible ? map : null);
        }
    });
}

window.initMap = initMap;
