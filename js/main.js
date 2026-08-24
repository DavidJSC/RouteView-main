

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
    //    Intenta conectarse al servidor KML (localhost:3000).
    //    Si falla, carga el catálogo desde data/rutas.json como respaldo.
    // =========================================================================
    const contenedorCatalogo = document.getElementById('contenedor-catalogo-rutas');

    if (contenedorCatalogo) {
        const inputBusqueda = document.getElementById('input-busqueda');
        const filtroEstado = document.getElementById('filtro-estado');
        const sinResultados = document.getElementById('sin-resultados');

        let todasLasRutas = [];
        const rutasExpandidas = new Set();

        // Siempre carga rutas.json primero como base del catálogo,
        // luego intenta enriquecer con datos en tiempo real del servidor KML.
        cargarCatalogo();
        setInterval(enriquecerConKML, 8000);

        async function cargarCatalogo() {
            await cargarDesdeJSON();
            enriquecerConKML(); // intenta agregar datos en tiempo real si el servidor está up
        }

        async function cargarDesdeJSON() {
            try {
                const response = await fetch('data/rutas.json');
                if (!response.ok) throw new Error('No se pudo cargar rutas.json');
                const rutas = await response.json();

                todasLasRutas = rutas.map(r => ({
                    id: r.id,
                    numeroRuta: r.numeroRuta,
                    nombreRuta: r.nombreRuta,
                    categoria: r.categoria,
                    descripcion: r.descripcion,
                    estado: r.estado || 'Regular',
                    paradasIda: (r.paradas && r.paradas.ida) ? r.paradas.ida : [],
                    paradasVuelta: (r.paradas && r.paradas.vuelta) ? r.paradas.vuelta : [],
                    cantidadBuses: 0,
                    pasajerosHoy: 0,
                    velocidadPromedio: 0,
                    buses: []
                }));

                filtrarCatalogo();
            } catch (err) {
                contenedorCatalogo.innerHTML = `
                    <p style="grid-column:1/-1; text-align:center; color:red; padding:20px; font-weight:bold;">
                        Error al cargar el catálogo de rutas. Verifica que data/rutas.json existe.
                    </p>`;
            }
        }

        // Enriquece las rutas base con datos en tiempo real de stefserver (si está disponible)
        async function enriquecerConKML() {
            try {
                const response = await fetch('http://localhost:3000/api/buses', { signal: AbortSignal.timeout(4000) });
                if (!response.ok) return;

                const data = await response.json();
                // data puede ser un array directo o un objeto con propiedad de array
                const buses = Array.isArray(data) ? data : (data.buses || data.data || []);

                // Agrupa buses por ramal
                const mapaRamal = new Map();
                buses.forEach(bus => {
                    const ramal = bus.ramal && bus.ramal.trim() !== '' ? bus.ramal.trim() : null;
                    if (!ramal) return;
                    if (!mapaRamal.has(ramal)) mapaRamal.set(ramal, []);
                    mapaRamal.get(ramal).push(bus);
                });

                // Inyecta los datos en tiempo real en las rutas del JSON
                todasLasRutas.forEach(ruta => {
                    let busesRuta = [];
                    mapaRamal.forEach((lista, ramalKML) => {
                        const r1 = ramalKML.toLowerCase().replace(/\s+/g, ' ').trim();
                        const r2 = ruta.nombreRuta.toLowerCase().replace(/\s+/g, ' ').trim();
                        if (r1 === r2 || r1.includes(r2) || r2.includes(r1)) {
                            busesRuta = busesRuta.concat(lista);
                        }
                    });
                    if (busesRuta.length > 0) {
                        ruta.cantidadBuses = busesRuta.length;
                        ruta.velocidadPromedio = Math.round(
                            busesRuta.reduce((s, b) => s + (b.velocidad || 0), 0) / busesRuta.length
                        );
                        ruta.estado = 'Activo';
                        ruta.buses = busesRuta;
                    }
                });

                filtrarCatalogo();
            } catch (_) {
                // Servidor no disponible — catálogo sigue con datos estáticos del JSON
            }
        }

        // Agrupa la lista plana de buses KML en rutas únicas
        function agruparBusesPorRuta(buses) {
            const mapa = new Map();
            buses.forEach((bus) => {
                const nombreRuta = bus.ruta && bus.ruta !== 'No asignada' ? bus.ruta : null;
                if (!nombreRuta) return;

                if (!mapa.has(nombreRuta)) {
                    mapa.set(nombreRuta, { nombreRuta, buses: [] });
                }
                mapa.get(nombreRuta).buses.push(bus);
            });

            return Array.from(mapa.values()).map((ruta) => {
                const cantidadBuses = ruta.buses.length;
                const pasajerosHoy = ruta.buses.reduce((s, b) => s + (b.pasajeros_hoy || 0), 0);
                const velocidadPromedio = cantidadBuses > 0
                    ? Math.round(ruta.buses.reduce((s, b) => s + (b.velocidad || 0), 0) / cantidadBuses)
                    : 0;
                return {
                    id: 'ruta-' + ruta.nombreRuta.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    nombreRuta: ruta.nombreRuta,
                    estado: cantidadBuses > 0 ? 'Activo' : 'Sin unidades',
                    cantidadBuses,
                    pasajerosHoy,
                    velocidadPromedio,
                    paradasIda: [],
                    paradasVuelta: [],
                    buses: ruta.buses
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
                // Color según estado
                const colorBorde = {
                    'Activo': '#28a745',
                    'Regular': '#007AFF',
                    'Demorado': '#fd7e14',
                    'Fuera de Horario': '#6c757d',
                    'Sin unidades': '#adb5bd'
                }[ruta.estado] || '#007AFF';

                const badgeColor = {
                    'Activo': '#28a745',
                    'Regular': '#007AFF',
                    'Demorado': '#fd7e14',
                    'Fuera de Horario': '#6c757d',
                    'Sin unidades': '#adb5bd'
                }[ruta.estado] || '#007AFF';

                // Paradas (modo fallback: muestra lista real; modo KML: muestra buses)
                const tieneParadas = ruta.paradasIda && ruta.paradasIda.length > 0;
                const estaExpandida = rutasExpandidas.has(ruta.id);

                let contenidoExpandible = '';
                if (tieneParadas) {
                    // Modo JSON: mostrar paradas de ida y vuelta
                    const listaIda = ruta.paradasIda.map((p, i) => `
                        <li style="padding:5px 0; border-top: 1px solid #eef2ff; font-size:0.8rem; color:#555; display:flex; align-items:center; gap:6px;">
                            <span style="background:#007AFF; color:#fff; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:0.65rem; flex-shrink:0;">${i + 1}</span>
                            ${p.nombre}
                            <span style="margin-left:auto; font-size:0.72rem; color:#94a3b8;">+${p.tiempoEstimado} min</span>
                        </li>`).join('');

                    const listaVuelta = ruta.paradasVuelta && ruta.paradasVuelta.length > 0
                        ? ruta.paradasVuelta.map((p, i) => `
                        <li style="padding:5px 0; border-top: 1px solid #eef2ff; font-size:0.8rem; color:#555; display:flex; align-items:center; gap:6px;">
                            <span style="background:#00C48C; color:#fff; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:0.65rem; flex-shrink:0;">${i + 1}</span>
                            ${p.nombre}
                            <span style="margin-left:auto; font-size:0.72rem; color:#94a3b8;">+${p.tiempoEstimado} min</span>
                        </li>`).join('')
                        : '<li style="font-size:0.8rem;color:#999;padding:4px 0;">Sin datos de vuelta.</li>';

                    contenidoExpandible = `
                        <div class="tabs-paradas" style="margin-bottom:10px;">
                            <button class="tab-ida tab-activo" style="padding:5px 12px; border:none; border-radius:4px 0 0 4px; background:#007AFF; color:#fff; font-size:0.78rem; font-weight:bold; cursor:pointer;">
                                ↗ Ida (${ruta.paradasIda.length} paradas)
                            </button>
                            <button class="tab-vuelta" style="padding:5px 12px; border:none; border-radius:0 4px 4px 0; background:#e2e8f0; color:#555; font-size:0.78rem; font-weight:bold; cursor:pointer;">
                                ↙ Vuelta (${ruta.paradasVuelta ? ruta.paradasVuelta.length : 0} paradas)
                            </button>
                        </div>
                        <ul class="lista-paradas-ida" style="list-style:none; padding:0; margin:0 0 10px 0; max-height:200px; overflow-y:auto;">
                            ${listaIda}
                        </ul>
                        <ul class="lista-paradas-vuelta" style="display:none; list-style:none; padding:0; margin:0 0 10px 0; max-height:200px; overflow-y:auto;">
                            ${listaVuelta}
                        </ul>`;
                } else {
                    // Modo KML: mostrar buses activos
                    const detalleBuses = (ruta.buses || []).map(bus => `
                        <li style="padding:6px 0; border-top:1px solid #eee; font-size:0.8rem; color:#555;">
                            🚌 <b>Unidad #${bus.bus_id}</b> · ${bus.velocidad ?? 0} km/h
                        </li>`).join('');
                    contenidoExpandible = `
                        <ul class="lista-buses-detalle" style="list-style:none; padding:0; margin:0 0 15px 0;">
                            ${detalleBuses || '<li style="font-size:0.8rem;color:#999;">Sin unidades activas.</li>'}
                        </ul>`;
                }

                // Info en tiempo real con lista de unidades activas
                let infoTiempoReal = '';
                if (ruta.cantidadBuses > 0) {
                    const listaBuses = (ruta.buses || []).map(b => {
                        const ramalBus = b.ramal && b.ramal.trim() !== '' ? b.ramal.trim() : 'Sin ramal';
                        const conductor = (b.despacho && b.despacho.actual && b.despacho.actual.conductor) || b.conductor || 'Sin asignar';
                        return `<li style="font-size:0.78rem; padding:4px 0; border-top:1px solid #f1f5f9; display:flex; align-items:center; gap:6px;">
                            <span style="background:#007AFF; color:#fff; border-radius:4px; padding:1px 5px; font-weight:bold; font-size:0.72rem;">Bus #${b.bus || b.id || '?'}</span>
                            <span style="color:#475569;">${ramalBus}</span>
                            <span style="margin-left:auto; color:#94a3b8; font-size:0.72rem;">⚡${b.velocidad ?? 0} km/h</span>
                        </li>`;
                    }).join('');
                    infoTiempoReal = `
                        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:8px 10px; margin-bottom:10px;">
                            <p style="font-size:0.8rem; font-weight:bold; color:#0369a1; margin:0 0 6px 0;">🟢 ${ruta.cantidadBuses} unidad(es) activa(s) ahora</p>
                            <ul style="list-style:none; padding:0; margin:0;">${listaBuses}</ul>
                            <p style="font-size:0.75rem; color:#64748b; margin:6px 0 0;">⚡ ${ruta.velocidadPromedio} km/h promedio · 📊 ${ruta.pasajerosHoy} pasajeros hoy</p>
                        </div>`;
                }

                // Descripción de la ruta
                const descripcion = ruta.descripcion
                    ? `<p style="font-size:0.82rem; color:#777; margin:0 0 10px; font-style:italic;">${ruta.descripcion}</p>`
                    : '';

                // Número de ruta badge
                const numeroBadge = ruta.numeroRuta
                    ? `<span style="background:#f1f5f9; color:#475569; padding:3px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold; font-family:monospace;">${ruta.numeroRuta}</span>`
                    : '';

                const tarjeta = document.createElement('div');
                tarjeta.className = 'tarjeta-ruta';
                tarjeta.dataset.rutaId = ruta.id;
                tarjeta.style = `background:#fff; padding:20px; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.07); display:flex; flex-direction:column; justify-content:space-between; border-left:5px solid ${colorBorde};`;

                tarjeta.innerHTML = `
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
                            <span style="background:${badgeColor}; color:#fff; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${ruta.estado}</span>
                            ${numeroBadge}
                        </div>
                        <h3 style="margin:0 0 6px 0; font-size:1.15rem; color:#1e293b;">${ruta.nombreRuta}</h3>
                        ${descripcion}
                        ${infoTiempoReal}

                        <button class="btn-ver-paradas" style="background:none; border:1px solid #cbd5e1; border-radius:4px; color:#475569; font-size:0.8rem; font-weight:bold; cursor:pointer; padding:5px 10px; margin-bottom:10px; width:100%; text-align:left;">
                            ${estaExpandida ? '▴ Ocultar paradas' : '▾ Ver paradas'}
                        </button>
                        <div class="detalle-expandible" style="display:${estaExpandida ? 'block' : 'none'};">
                            ${contenidoExpandible}
                        </div>
                    </div>
                    <button class="btn-agregar-fav" data-id="${ruta.id}" style="background:#00C48C; color:white; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px;">
                        ★ Añadir a Favoritos
                    </button>
                `;
                contenedorCatalogo.appendChild(tarjeta);
            });

            // Listeners de expandir/colapsar
            document.querySelectorAll('.tarjeta-ruta').forEach((tarjetaEl) => {
                const boton = tarjetaEl.querySelector('.btn-ver-paradas');
                const detalle = tarjetaEl.querySelector('.detalle-expandible');
                const rutaId = tarjetaEl.dataset.rutaId;
                if (!boton || !detalle) return;

                boton.addEventListener('click', () => {
                    const abrirAhora = detalle.style.display !== 'block';
                    detalle.style.display = abrirAhora ? 'block' : 'none';
                    boton.textContent = abrirAhora ? '▴ Ocultar paradas' : '▾ Ver paradas';
                    if (abrirAhora) rutasExpandidas.add(rutaId);
                    else rutasExpandidas.delete(rutaId);
                });

                // Tabs de ida/vuelta
                const tabIda = tarjetaEl.querySelector('.tab-ida');
                const tabVuelta = tarjetaEl.querySelector('.tab-vuelta');
                const listaIda = tarjetaEl.querySelector('.lista-paradas-ida');
                const listaVuelta = tarjetaEl.querySelector('.lista-paradas-vuelta');

                if (tabIda && tabVuelta) {
                    tabIda.addEventListener('click', () => {
                        listaIda.style.display = 'block';
                        listaVuelta.style.display = 'none';
                        tabIda.style.background = '#007AFF'; tabIda.style.color = '#fff';
                        tabVuelta.style.background = '#e2e8f0'; tabVuelta.style.color = '#555';
                    });
                    tabVuelta.addEventListener('click', () => {
                        listaIda.style.display = 'none';
                        listaVuelta.style.display = 'block';
                        tabVuelta.style.background = '#00C48C'; tabVuelta.style.color = '#fff';
                        tabIda.style.background = '#e2e8f0'; tabIda.style.color = '#555';
                    });
                }
            });

            // Botones de favoritos
            document.querySelectorAll('.btn-agregar-fav').forEach(boton => {
                boton.addEventListener('click', (e) => {
                    const idRuta = e.target.getAttribute('data-id');
                    const rutaSeleccionada = todasLasRutas.find(r => r.id === idRuta);
                    if (rutaSeleccionada) agregarAFavoritosLocalStorage(rutaSeleccionada);
                });
            });
        }

        function filtrarCatalogo() {
            const textoBusqueda = inputBusqueda ? inputBusqueda.value.toLowerCase().trim() : '';
            const estSeleccionado = filtroEstado ? filtroEstado.value : 'todos';

            const rutasFiltradas = todasLasRutas.filter(ruta => {
                const coincideTexto =
                    ruta.nombreRuta.toLowerCase().includes(textoBusqueda) ||
                    (ruta.numeroRuta && ruta.numeroRuta.toLowerCase().includes(textoBusqueda));
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
                alert(`La ruta "${ruta.nombreRuta}" ya está en tus favoritas.`);
                return;
            }
            const nuevoFavorito = {
                id: ruta.id,
                alias: "Acceso Rápido",
                linea: ruta.nombreRuta,
                descripcion: ruta.descripcion || `Ruta ${ruta.numeroRuta || ''} de Autotransportes Moravia`
            };
            favoritos.push(nuevoFavorito);
            localStorage.setItem('misRutasFavoritas', JSON.stringify(favoritos));
            alert(`¡"${ruta.nombreRuta}" se añadió a Mis Rutas!`);
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
        const selBus = document.getElementById('nombre-bus');       // ahora es select
        const selCategoria = document.getElementById('categoria-ruta');
        const selParada = document.getElementById('parada-usuario'); // ahora es select
        const txtDescripcion = document.getElementById('descripcion-ruta');

        // Catálogo de rutas cargado desde rutas.json
        let catalogoRutas = [];

        // 1. Cargar rutas.json y poblar el dropdown de ramales
        async function cargarDropdownRutas() {
            try {
                const res = await fetch('data/rutas.json');
                if (!res.ok) throw new Error('No se pudo cargar rutas.json');
                catalogoRutas = await res.json();

                selBus.innerHTML = '<option value="">-- Seleccioná un ramal --</option>';
                catalogoRutas.forEach(r => {
                    const opt = document.createElement('option');
                    opt.value = r.nombreRuta;
                    opt.textContent = r.nombreRuta;
                    selBus.appendChild(opt);
                });
            } catch (e) {
                selBus.innerHTML = '<option value="">Error cargando rutas</option>';
            }
        }

        // 2. Al elegir un ramal, poblar las paradas de abordaje (ida + vuelta)
        selBus.addEventListener('change', () => {
            validarCampoVacio(selBus, 'error-bus', 'Seleccioná un ramal.');
            const rutaSeleccionada = catalogoRutas.find(r => r.nombreRuta === selBus.value);
            selParada.innerHTML = '<option value="">-- Seleccioná una parada --</option>';

            if (!rutaSeleccionada) {
                selParada.disabled = true;
                return;
            }
            selParada.disabled = false;

            const paradasIda = (rutaSeleccionada.paradas && rutaSeleccionada.paradas.ida) || [];
            const paradasVuelta = (rutaSeleccionada.paradas && rutaSeleccionada.paradas.vuelta) || [];

            if (paradasIda.length > 0) {
                const grupoIda = document.createElement('optgroup');
                grupoIda.label = '↗ Ida (Terminal → San José)';
                paradasIda.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.nombre;
                    opt.textContent = p.nombre;
                    grupoIda.appendChild(opt);
                });
                selParada.appendChild(grupoIda);
            }

            if (paradasVuelta.length > 0) {
                const grupoVuelta = document.createElement('optgroup');
                grupoVuelta.label = '↙ Vuelta (San José → Terminal)';
                paradasVuelta.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.nombre;
                    opt.textContent = p.nombre;
                    grupoVuelta.appendChild(opt);
                });
                selParada.appendChild(grupoVuelta);
            }

            if (paradasIda.length === 0 && paradasVuelta.length === 0) {
                selParada.innerHTML = '<option value="">Sin paradas registradas aún</option>';
                selParada.disabled = true;
            }
        });

        cargarDropdownRutas();
        cargarFavoritosDOM();
        // Actualizar estado en tiempo real cada 10 segundos
        setInterval(cargarFavoritosDOM, 10000);

        txtAlias.addEventListener('input', () => validarCampoVacio(txtAlias, 'error-alias', 'El alias es obligatorio para personalizar la ruta.'));
        selBus.addEventListener('change', () => validarCampoVacio(selBus, 'error-bus', 'Seleccioná un ramal.'));
        selCategoria.addEventListener('change', () => validarCampoVacio(selCategoria, 'error-categoria', 'Seleccione una categoría válida.'));
        selParada.addEventListener('change', () => validarCampoVacio(selParada, 'error-parada', 'Seleccioná tu parada de abordaje.'));
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
            if (!input.value || input.value.trim() === '') {
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
            const v2 = validarCampoVacio(selBus, 'error-bus', 'Seleccioná un ramal.');
            const v3 = validarCampoVacio(selCategoria, 'error-categoria', 'Seleccione una categoría.');
            const v4 = validarCampoVacio(selParada, 'error-parada', 'Seleccioná tu parada de abordaje.');
            const v5 = txtDescripcion.value.trim().length >= 10;

            const errDesc = document.getElementById('error-descripcion');
            if (!v5 && errDesc) {
                errDesc.textContent = 'La descripción debe tener mínimo 10 caracteres.';
            }

            if (v1 && v2 && v3 && v4 && v5) {
                const nuevaRutaFavorita = {
                    id: 'FAV-' + Date.now(),
                    alias: txtAlias.value.trim(),
                    linea: selBus.value.trim(),
                    categoria: selCategoria.value,
                    parada: selParada.value.trim(),
                    descripcion: txtDescripcion.value.trim()
                };

                let favoritos = JSON.parse(localStorage.getItem('misRutasFavoritas')) || [];
                favoritos.push(nuevaRutaFavorita);
                localStorage.setItem('misRutasFavoritas', JSON.stringify(favoritos));

                formulario.reset();
                selParada.innerHTML = '<option value="">-- Primero seleccioná un ramal --</option>';
                selParada.disabled = true;
                mostrarMensajeExito();
                cargarFavoritosDOM();
            }
        });

        function mostrarMensajeExito() {
            if (mensajeExitoGlobal) {
                mensajeExitoGlobal.style.display = 'block';
                setTimeout(() => { mensajeExitoGlobal.style.display = 'none'; }, 4000);
            }
        }

        async function cargarFavoritosDOM() {
            if (!contenedorFavoritas) return;
            let favoritos = JSON.parse(localStorage.getItem('misRutasFavoritas')) || [];

            if (favoritos.length === 0) {
                contenedorFavoritas.innerHTML = `
                    <div class="estado-vacio" style="text-align:center; color:#777; padding:40px 20px;">
                        <p style="font-size:3rem; margin-bottom:10px;">🚫</p>
                        <p>Aún no has registrado rutas personalizadas.</p>
                    </div>`;
                return;
            }

            // Consultar buses en tiempo real para mostrar estado
            let busesActivos = [];
            try {
                const r = await fetch('http://localhost:3000/api/buses', { signal: AbortSignal.timeout(3000) });
                if (r.ok) {
                    const data = await r.json();
                    busesActivos = Array.isArray(data) ? data : (data.buses || data.data || []);
                }
            } catch (_) { /* servidor no disponible */ }

            // Agrupar buses por ramal para consulta rápida
            const mapaRamal = new Map();
            busesActivos.forEach(b => {
                const ramal = b.ramal && b.ramal.trim() !== '' ? b.ramal.trim() : null;
                if (!ramal) return;
                if (!mapaRamal.has(ramal)) mapaRamal.set(ramal, []);
                mapaRamal.get(ramal).push(b);
            });

            contenedorFavoritas.innerHTML = '';

            favoritos.forEach(fav => {
                // Buscar buses activos en el ramal de esta ruta favorita
                let busesEnRuta = [];
                mapaRamal.forEach((lista, ramal) => {
                    const r1 = ramal.toLowerCase().trim();
                    const r2 = fav.linea.toLowerCase().trim();
                    if (r1 === r2 || r1.includes(r2) || r2.includes(r1)) {
                        busesEnRuta = busesEnRuta.concat(lista);
                    }
                });

                const hayBuses = busesEnRuta.length > 0;
                const badgeEstado = hayBuses
                    ? `<span style="background:#22c55e; color:#fff; padding:3px 8px; border-radius:12px; font-size:0.72rem; font-weight:bold;">🟢 ${busesEnRuta.length} bus${busesEnRuta.length > 1 ? 'es' : ''} activo${busesEnRuta.length > 1 ? 's' : ''}</span>`
                    : (busesActivos.length > 0
                        ? `<span style="background:#94a3b8; color:#fff; padding:3px 8px; border-radius:12px; font-size:0.72rem; font-weight:bold;">⚫ Sin unidades ahora</span>`
                        : `<span style="background:#e2e8f0; color:#64748b; padding:3px 8px; border-radius:12px; font-size:0.72rem;">Sin conexión al servidor</span>`);

                // Lista de buses activos (si hay)
                const listaBuses = hayBuses
                    ? `<div style="margin-top:8px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:8px 10px;">
                        <p style="font-size:0.75rem; font-weight:bold; color:#166534; margin:0 0 4px 0;">Unidades en ruta ahora:</p>
                        ${busesEnRuta.map(b => `
                            <div style="font-size:0.78rem; color:#15803d; display:flex; gap:8px; align-items:center; padding:2px 0;">
                                <span>🚌 Bus #${b.bus || b.id || '?'}</span>
                                <span style="color:#94a3b8;">·</span>
                                <span>⚡ ${b.velocidad ?? 0} km/h</span>
                            </div>`).join('')}
                       </div>`
                    : '';

                const colorBorde = hayBuses ? '#22c55e' : '#cbd5e1';

                const item = document.createElement('div');
                item.className = 'tarjeta-favorita-guardada';
                item.style = `background:#fff; border:1px solid ${colorBorde}; border-left:4px solid ${colorBorde}; padding:15px; border-radius:8px; margin-bottom:12px; position:relative; box-shadow:0 2px 6px rgba(0,0,0,0.05);`;
                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                        <h3 style="margin:0; color:#1e293b; font-size:1rem;">${fav.alias}</h3>
                        <button class="btn-eliminar-individual" data-id="${fav.id}" style="background:none; border:none; color:#dc3545; font-size:1rem; cursor:pointer; flex-shrink:0;" title="Eliminar de favoritos">❌</button>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
                        <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-size:0.78rem; font-weight:bold;">🚏 ${fav.linea}</span>
                        <span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px; font-size:0.75rem;">${fav.categoria || 'Regular'}</span>
                        ${badgeEstado}
                    </div>
                    ${fav.parada ? `<p style="margin:0 0 4px 0; font-size:0.83rem; color:#475569;">📍 <strong>Abordaje:</strong> ${fav.parada}</p>` : ''}
                    <p style="margin:0 0 6px 0; font-size:0.82rem; color:#64748b; font-style:italic;">"${fav.descripcion}"</p>
                    ${listaBuses}
                `;
                contenedorFavoritas.appendChild(item);
            });

            document.querySelectorAll('.btn-eliminar-individual').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idEliminar = e.currentTarget.getAttribute('data-id');
                    if (confirm('¿Desea eliminar esta ruta de sus favoritos?')) {
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
                if (favoritos.length === 0) { alert('No hay rutas guardadas para limpiar.'); return; }
                if (confirm('¿Desea borrar permanentemente TODAS sus rutas guardadas?')) {
                    localStorage.removeItem('misRutasFavoritas');
                    cargarFavoritosDOM();
                }
            });
        }
    }
});

// =========================================================================
// 3. LÓGICA DE GOOGLE MAPS API & MONITOREO DE BUSES EN TIEMPO REAL (KML)
// =========================================================================
let map;
const markers = {};
const busPaths = {};
const busPolylines = {};
const MAX_PUNTOS_RECORRIDO = 40;

const KML_API_URL = 'http://localhost:3000/api/buses';

const ESTILO_UBER = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "poi.park", stylers: [{ visibility: "on" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
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

    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);

    fetchBuses();
    setInterval(fetchBuses, 5000);
}

async function fetchBuses() {
    const statsLabel = document.getElementById('stats-buses');

    try {
        const response = await fetch(KML_API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const raw = Array.isArray(data) ? data : (data.buses || data.data || []);

        // Convierte el formato JSON de stefserver al formato interno de buses
        let dataBuses = raw
            .filter(b => b.lat && b.lon)
            .map(b => ({
                bus_id: b.bus || b.id || '?',
                lat: parseFloat(b.lat),
                lng: parseFloat(b.lon),
                velocidad: b.velocidad || 0,
                pasajeros_abordo: (b.despacho && b.despacho.actual) ? 0 : 0,
                pasajeros_hoy: 0,
                conductor: (b.despacho && b.despacho.actual && b.despacho.actual.conductor) || b.conductor || 'Sin asignar',
                ruta: b.ramal || 'No asignada',
                actualizado: b.actualizado || '',
                placa: b.placa || '',
                despacho: b.despacho || null
            }))
            .filter(b => b.lat >= 8 && b.lat <= 12 && b.lng >= -86 && b.lng <= -82);

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
        console.warn('No se pudo conectar con el servidor.', error);
        if (statsLabel) {
            statsLabel.innerText = "Sin conexión al servidor";
            statsLabel.style.backgroundColor = '#ef4444';
        }
    }
}

function parsearKML(kmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "text/xml");

    const errorNode = xmlDoc.querySelector('parsererror');
    if (errorNode) { console.error('Error parseando KML:', errorNode.textContent); return []; }

    const placemarks = Array.from(xmlDoc.getElementsByTagName('Placemark'));
    const buses = [];

    placemarks.forEach((placemark) => {
        const nameNode = placemark.getElementsByTagName('name')[0];
        const busId = nameNode ? nameNode.textContent.trim() : null;
        if (!busId) return;

        const pointNode = placemark.getElementsByTagName('Point')[0];
        const coordsNode = pointNode ? pointNode.getElementsByTagName('coordinates')[0] : null;
        if (!coordsNode) return;

        const partesCoords = coordsNode.textContent.trim().split(',');
        const lng = parseFloat(partesCoords[0]);
        const lat = parseFloat(partesCoords[1]);
        if (isNaN(lat) || isNaN(lng)) return;
        if (lat < 8 || lat > 12 || lng > -82 || lng < -86) return;

        const descNode = placemark.getElementsByTagName('description')[0];
        const descTexto = descNode ? descNode.textContent : '';

        buses.push({ bus_id: busId, lat, lng, ...extraerDatosDescripcion(descTexto) });
    });

    return buses;
}

function extraerDatosDescripcion(texto) {
    const buscar = (etiqueta) => {
        const regex = new RegExp(etiqueta + '\\s*:\\s*(.+)', 'i');
        const match = texto.match(regex);
        return match ? match[1].trim() : null;
    };
    const velocidadTexto = buscar('Velocidad');
    const abordosTexto = buscar('Abordos');
    const pasajerosHoyTexto = buscar('Pasajeros movilizados hoy');
    return {
        actualizado: buscar('Actualizado'),
        velocidad: velocidadTexto ? parseFloat(velocidadTexto) || 0 : 0,
        pasajeros_abordo: abordosTexto ? parseInt(abordosTexto, 10) || 0 : 0,
        pasajeros_hoy: pasajerosHoyTexto ? parseInt(pasajerosHoyTexto, 10) || 0 : 0,
        conductor: buscar('Conductor'),
        ruta: buscar('Ruta')
    };
}

function actualizarRecorridoBus(busId, position) {
    if (!busPaths[busId]) busPaths[busId] = [];
    const historial = busPaths[busId];
    const ultimoPunto = historial[historial.length - 1];
    if (!ultimoPunto || ultimoPunto.lat !== position.lat || ultimoPunto.lng !== position.lng) {
        historial.push(position);
    }
    if (historial.length > MAX_PUNTOS_RECORRIDO) historial.shift();

    if (busPolylines[busId]) {
        busPolylines[busId].setPath(historial);
    } else {
        busPolylines[busId] = new google.maps.Polyline({
            path: historial, geodesic: true,
            strokeColor: '#007AFF', strokeOpacity: 0.6, strokeWeight: 3, map
        });
    }
}

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
                </svg>`),
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18)
        };

        const ramal = bus.ruta && bus.ruta !== 'No asignada' ? bus.ruta : null;
        const vel = bus.velocidad ?? 0;
        const abordo = bus.pasajeros_abordo ?? 0;
        const conductor = bus.conductor && bus.conductor !== 'No asignado' ? bus.conductor : 'Sin asignar';
        const placa = bus.placa ? `<p style="margin:3px 0; font-size:0.85rem;">🪪 <b>Placa:</b> ${bus.placa}</p>` : '';

        // Ramal: mostrar el nombre real o indicar que no tiene asignado
        const filaRamal = ramal
            ? `<p style="margin:3px 0; font-size:0.85rem; background:#e0f2fe; padding:3px 6px; border-radius:4px;">🚏 <b>Ramal:</b> ${ramal}</p>`
            : `<p style="margin:3px 0; font-size:0.85rem; color:#94a3b8;">🚏 <b>Ramal:</b> Sin asignar hoy</p>`;

        const contenidoInfo = `
            <div style="color:#1e293b; padding:6px; font-family:system-ui,sans-serif; min-width:210px;">
                <h4 style="margin:0 0 8px 0; color:#007AFF; font-size:0.95rem; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">🚌 Unidad #${busId}</h4>
                ${filaRamal}
                <p style="margin:3px 0; font-size:0.85rem;">⚡ <b>Velocidad:</b> ${vel} km/h</p>
                <p style="margin:3px 0; font-size:0.85rem;">👥 <b>A bordo:</b> ${abordo} pasajeros</p>
                <p style="margin:3px 0; font-size:0.85rem;">🧑‍✈️ <b>Conductor:</b> ${conductor}</p>
                <p style="margin:3px 0; font-size:0.85rem;">📊 <b>Movilizados hoy:</b> ${bus.pasajeros_hoy ?? 0}</p>
                ${placa}
                <p style="margin:4px 0 0; font-size:0.72rem; color:#94a3b8;">🕒 ${bus.actualizado ?? ''}</p>
            </div>`;

        if (markers[busId]) {
            markers[busId].setPosition(position);
            if (markers[busId].infoWindow) markers[busId].infoWindow.setContent(contenidoInfo);
        } else {
            const marker = new google.maps.Marker({ position, map, title: `Unidad #${busId}`, icon: iconoBus });
            const infoWindow = new google.maps.InfoWindow({ content: contenidoInfo });
            marker.infoWindow = infoWindow;
            marker.addListener('click', () => infoWindow.open(map, marker));
            markers[busId] = marker;
        }

        bounds.extend(position);
        busesDibujados++;
    });

    if (busesDibujados > 0) map.fitBounds(bounds);
}