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
    // =========================================================================
    const contenedorCatalogo = document.getElementById('contenedor-catalogo-rutas');
    
    if (contenedorCatalogo) {
        const inputBusqueda = document.getElementById('input-busqueda');
        const filtroCategoria = document.getElementById('filtro-categoria');
        const filtroEstado = document.getElementById('filtro-estado');
        const sinResultados = document.getElementById('sin-resultados');

        let todasLasRutas = []; 

        fetch('./data/rutas.json')
            .then(response => {
                if (!response.ok) throw new Error('No se pudo cargar el archivo rutas.json');
                return response.json();
            })
            .then(data => {
                todasLasRutas = data;
                renderizarTarjetas(todasLasRutas); 
            })
            .catch(error => {
                console.error("Error en RouteView:", error);
                contenedorCatalogo.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: red; font-weight: bold; padding: 20px;">Error al conectar con la base de datos de rutas (rutas.json). Verifica que el archivo esté guardado con ese nombre exacto dentro de la carpeta 'data'.</p>`;
            });

        function renderizarTarjetas(rutas) {
            contenedorCatalogo.innerHTML = ''; 

            if (rutas.length === 0) {
                if (sinResultados) sinResultados.style.display = 'block';
                return;
            }
            if (sinResultados) sinResultados.style.display = 'none';

            rutas.forEach(ruta => {
                let colorEstado = '#28a745';
                if (ruta.estado === 'Demorado') colorEstado = '#ffc107';
                if (ruta.estado === 'Fuera de Horario') colorEstado = '#dc3545';

                const listaParadas = ruta.paradas.map(p => `<li> <img src="images/icon-parada-pin.svg" alt="" style="width: 18px; height: 18px; flex-shrink: 0;">
                ${p.nombre} (${p.tiempoEstimado} min)</li>`).join('');

                const tarjeta = document.createElement('div');
                tarjeta.className = 'tarjeta-ruta';
                tarjeta.style = 'background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; border-left: 5px solid ' + colorEstado;

                tarjeta.innerHTML = `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <span style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.85rem;">Línea ${ruta.numeroRuta}</span>
                            <span style="background: ${colorEstado}; color: ${ruta.estado === 'Demorado' ? '#333' : '#fff'}; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.75rem;">${ruta.estado}</span>
                        </div>
                        <h3 style="margin: 0 0 10px 0; font-size: 1.25rem; color: #333;">${ruta.nombreRuta}</h3>
                        <p style="font-size: 0.85rem; color: #666; margin-bottom: 15px;">${ruta.descripcion}</p>
                        <strong style="font-size: 0.9rem; display:block; margin-bottom: 5px;">Recorrido Principal:</strong>
                        <ul style="list-style: none; padding: 0; margin: 0 0 15px 0; font-size: 0.85rem; line-height: 1.5; color: #555;">
                            ${listaParadas}
                        </ul>
                    </div>
                    <button class="btn-agregar-fav" data-id="${ruta.id}" style="background: #00C48C; color: white; border: none; padding: 10px; border-radius: 4px; font-weight: bold; cursor: pointer; width: 100%;">
                         Añadir a Favoritos
                    </button>
                `;
                contenedorCatalogo.appendChild(tarjeta);
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
            const textoBusqueda = inputBusqueda.value.toLowerCase().trim();
            const catSeleccionada = filtroCategoria.value;
            const estSeleccionado = filtroEstado.value;

            const rutasFiltradas = todasLasRutas.filter(ruta => {
                const coincideTexto = ruta.nombreRuta.toLowerCase().includes(textoBusqueda) || 
                                     ruta.numeroRuta.toLowerCase().includes(textoBusqueda) ||
                                     ruta.paradas.some(p => p.nombre.toLowerCase().includes(textoBusqueda));
                
                const coincideCategoria = catSeleccionada === 'todos' || ruta.categoria === catSeleccionada;
                const coincideEstado = estSeleccionado === 'todos' || ruta.estado === estSeleccionado;

                return coincideTexto && coincideCategoria && coincideEstado;
            });

            renderizarTarjetas(rutasFiltradas);
        }

        if (inputBusqueda) inputBusqueda.addEventListener('input', filtrarCatalogo);
        if (filtroCategoria) filtroCategoria.addEventListener('change', filtrarCatalogo);
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
                linea: `Línea ${ruta.numeroRuta} - ${ruta.nombreRuta}`,
                categoria: ruta.categoria,
                parada: ruta.paradas[1] ? ruta.paradas[1].nombre : ruta.paradas[0].nombre,
                descripcion: ruta.descripcion
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
// 3. LÓGICA DE GOOGLE MAPS API & MONITOREO DE BUSES EN TIEMPO REAL
// =========================================================================
let map;
const markers = {};

function initMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    map = new google.maps.Map(mapElement, {
        center: { lat: 9.9333, lng: -84.0833 },
        zoom: 13,
        disableDefaultUI: false,
    });

    fetchBuses();
    setInterval(fetchBuses, 5000);
}

async function fetchBuses() {
    const statsLabel = document.getElementById('stats-buses');

    try {
        const response = await fetch('http://localhost:3000/api/buses');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.status === 'ok' || Array.isArray(result)) {
            const dataBuses = result.data || result;
            if (statsLabel) {
                statsLabel.innerText = `${dataBuses.length} buses en tiempo real`;
                statsLabel.style.backgroundColor = '#22c55e';
            }
            renderBuses(dataBuses);
        }
    } catch (error) {
        console.warn('⚠️ No se pudo conectar con el servidor Node.js (http://localhost:3000).', error);
        
        if (statsLabel) {
            statsLabel.innerText = "Error de conexión con el backend";
            statsLabel.style.backgroundColor = '#ef4444';
        }
    }
}

// Convierte "9.58.99836.N" -> 9.5899836
function parsearLatitud(valor) {
    if (!valor) return null;
    let str = valor.toString().trim().toUpperCase().replace(/[NSEW]/g, '');
    
    // Si viene como "9.58.99836", dejamos el primer punto y quitamos el segundo -> "9.5899836"
    let partes = str.split('.');
    if (partes.length > 2) {
        str = partes[0] + '.' + partes.slice(1).join('');
    }

    let lat = parseFloat(str);
    return isNaN(lat) ? null : Math.abs(lat);
}

// Convierte "84.0.8921814.W" -> -84.08921814
function parsearLongitud(valor) {
    if (!valor) return null;
    let str = valor.toString().trim().toUpperCase().replace(/[NSEW]/g, '');

    // Si viene como "84.0.8921814", dejamos el primer punto y quitamos el segundo -> "84.08921814"
    let partes = str.split('.');
    if (partes.length > 2) {
        str = partes[0] + '.' + partes.slice(1).join('');
    }

    let lng = parseFloat(str);
    return isNaN(lng) ? null : -Math.abs(lng); // SIEMPRE NEGATIVA (Oeste)
}

function renderBuses(buses) {
    if (!Array.isArray(buses) || !map) return;

    const bounds = new google.maps.LatLngBounds();
    let busesDibujados = 0;

    buses.forEach((bus, index) => {
        const busId = bus.bus_id || bus.id_bus || bus.id || (index + 1);

        const latRaw = bus.latitud ?? bus.lat;
        const lngRaw = bus.longitud ?? bus.lng;

        const lat = parsearLatitud(latRaw);
        const lng = parsearLongitud(lngRaw);

        // Validar que la coordenada esté dentro del rango de Costa Rica (Lat ~9.x, Lng ~ -84.x)
        if (!lat || !lng || lat < 8 || lat > 12 || lng > -82 || lng < -86) return;

        const position = { lat: lat, lng: lng };

        const iconoPunto = {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#007AFF",
            fillOpacity: 0.9,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
        };

        if (markers[busId]) {
            markers[busId].setPosition(position);
        } else {
            const marker = new google.maps.Marker({
                position: position,
                map: map,
                title: `Unidad #${busId}`,
                icon: iconoPunto
            });

            const lugar = bus.lugar || bus.ruta || 'En recorrido';
            const vel = bus.velocidad ?? 0;
            const abordo = bus.pasajeros_abordo ?? 0;

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="color: #1e293b; padding: 6px; font-family: system-ui, sans-serif;">
                        <h4 style="margin: 0 0 6px 0; color: #007AFF; font-size: 0.95rem;">
                            Unidad #${busId}
                        </h4>
                        <p style="margin: 3px 0; font-size: 0.85rem;">📍 <b>Sector/Ruta:</b> ${lugar}</p>
                        <p style="margin: 3px 0; font-size: 0.85rem;">⚡ <b>Velocidad:</b> ${vel} km/h</p>
                        <p style="margin: 3px 0; font-size: 0.85rem;">👥 <b>A bordo:</b> ${abordo} pasajeros</p>
                    </div>
                `
            });

            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });

            markers[busId] = marker;
        }

        bounds.extend(position);
        busesDibujados++;
    });

    if (busesDibujados > 0 && !window.mapaAjustado) {
        map.fitBounds(bounds);
        window.mapaAjustado = true;
    }
}

window.initMap = initMap;