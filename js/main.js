/**
 * RouteView - Logica principal del proyecto
 * Curso: ISW-521 Programacion en Ambiente Web I - UTN
 * Desarrollado por: Mia & David
 */

document.addEventListener('DOMContentLoaded', () => {

    // Devuelve la clave de localStorage para las rutas del usuario activo.
    // Si hay sesion, usa la clave unica del UID para aislar los datos por cuenta.
    function getRoutesKey() {
        try {
            const user = JSON.parse(localStorage.getItem('rv_user'));
            return (user && user.uid) ? ('misRutasFavoritas_' + user.uid) : 'misRutasFavoritas';
        } catch (e) {
            return 'misRutasFavoritas';
        }
    }

    // Menu movil
    // Controla la apertura y cierre del menu hamburguesa en pantallas pequenas.
    const hamburger = document.getElementById('hamburger');
    const menuMovil  = document.getElementById('menu-movil');
    if (hamburger && menuMovil) {
        hamburger.addEventListener('click', () => {
            const expanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', !expanded);
            menuMovil.classList.toggle('open');
            menuMovil.style.display = menuMovil.classList.contains('open') ? 'block' : 'none';
        });
    }

    // 1. CATALOGO DE RUTAS (rutas.html)
    // Carga el catalogo desde rutas.json y lo enriquece con datos en vivo del servidor.
    // Tambien maneja los filtros de busqueda y el boton de agregar a favoritos.

    const contenedorCatalogo = document.getElementById('contenedor-catalogo-rutas');

    if (contenedorCatalogo) {
        const inputBusqueda  = document.getElementById('input-busqueda');
        const filtroEstado   = document.getElementById('filtro-estado');
        const sinResultados  = document.getElementById('sin-resultados');
        let todasLasRutas    = [];
        const rutasExpandidas = new Set(); // guarda los IDs de tarjetas abiertas entre refrescos

        cargarCatalogo();
        setInterval(enriquecerConKML, 8000); // actualiza los datos en vivo cada 8 segundos

        // Carga el catalogo base y luego intenta enriquecerlo con datos del servidor.
        async function cargarCatalogo() {
            await cargarDesdeJSON();
            enriquecerConKML();
        }

        // Lee rutas.json y construye la lista base del catalogo.
        async function cargarDesdeJSON() {
            try {
                const response = await fetch('data/rutas.json');
                if (!response.ok) throw new Error();
                const rutas = await response.json();
                todasLasRutas = rutas.map(r => ({
                    id:             r.id,
                    numeroRuta:     r.numeroRuta,
                    nombreRuta:     r.nombreRuta,
                    categoria:      r.categoria,
                    descripcion:    r.descripcion,
                    estado:         r.estado || 'Regular',
                    paradasIda:     (r.paradas && r.paradas.ida)    ? r.paradas.ida    : [],
                    paradasVuelta:  (r.paradas && r.paradas.vuelta) ? r.paradas.vuelta : [],
                    cantidadBuses:  0,
                    pasajerosHoy:   0,
                    velocidadPromedio: 0,
                    buses:          []
                }));
                filtrarCatalogo();
            } catch (err) {
                contenedorCatalogo.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:red; padding:20px; font-weight:bold;">Error al cargar el catalogo. Verifica que data/rutas.json existe.</p>';
            }
        }

        // Consulta el servidor de buses y cruza los ramales con las rutas del catalogo.
        // Si hay coincidencia, actualiza la cantidad de buses activos y la velocidad promedio.
        async function enriquecerConKML() {
            try {
                const response = await fetch('http://localhost:3000/api/buses', { signal: AbortSignal.timeout(4000) });
                if (!response.ok) return;

                const data  = await response.json();
                const buses = Array.isArray(data) ? data : (data.buses || data.data || []);

                // Agrupa los buses por nombre de ramal para comparar con el catalogo.
                const mapaRamal = new Map();
                buses.forEach(bus => {
                    const ramal = bus.ramal && bus.ramal.trim() ? bus.ramal.trim() : null;
                    if (!ramal) return;
                    if (!mapaRamal.has(ramal)) mapaRamal.set(ramal, []);
                    mapaRamal.get(ramal).push(bus);
                });

                // Actualiza cada ruta del catalogo con los buses que coincidan.
                todasLasRutas.forEach(ruta => {
                    let busesRuta = [];
                    mapaRamal.forEach((lista, ramalKML) => {
                        const r1 = ramalKML.toLowerCase().trim();
                        const r2 = ruta.nombreRuta.toLowerCase().trim();
                        if (r1 === r2 || r1.includes(r2) || r2.includes(r1)) {
                            busesRuta = busesRuta.concat(lista);
                        }
                    });
                    if (busesRuta.length > 0) {
                        ruta.cantidadBuses     = busesRuta.length;
                        ruta.velocidadPromedio = Math.round(busesRuta.reduce((s, b) => s + (b.velocidad || 0), 0) / busesRuta.length);
                        ruta.estado            = 'Activo';
                        ruta.buses             = busesRuta;
                    }
                });

                filtrarCatalogo();
            } catch (_) {
                // Si el servidor no responde, el catalogo se mantiene con los datos base.
            }
        }

        // Genera las tarjetas HTML para cada ruta y las inserta en el contenedor.
        function renderizarTarjetas(rutas) {
            contenedorCatalogo.innerHTML = '';

            if (rutas.length === 0) {
                if (sinResultados) sinResultados.style.display = 'block';
                return;
            }
            if (sinResultados) sinResultados.style.display = 'none';

            rutas.forEach(ruta => {

                // Color del borde izquierdo segun el estado de la ruta.
                const colorBorde = ({
                    'Activo':          '#28a745',
                    'Regular':         '#007AFF',
                    'Demorado':        '#fd7e14',
                    'Fuera de Horario':'#6c757d',
                    'Sin unidades':    '#adb5bd'
                })[ruta.estado] || '#007AFF';

                const estaExpandida = rutasExpandidas.has(ruta.id);
                const tieneParadas  = ruta.paradasIda && ruta.paradasIda.length > 0;

                // Contenido del panel expandible: lista de paradas o lista de buses activos.
                let contenidoExpandible = '';
                if (tieneParadas) {
                    const listaIda = ruta.paradasIda.map((p, i) => `
                        <li style="padding:5px 0; border-top:1px solid #eef2ff; font-size:0.8rem; color:#555; display:flex; align-items:center; gap:6px;">
                            <span style="background:#007AFF; color:#fff; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:0.65rem; flex-shrink:0;">${i + 1}</span>
                            ${p.nombre}
                            <span style="margin-left:auto; font-size:0.72rem; color:#94a3b8;">+${p.tiempoEstimado} min</span>
                        </li>`).join('');

                    const listaVuelta = ruta.paradasVuelta && ruta.paradasVuelta.length > 0
                        ? ruta.paradasVuelta.map((p, i) => `
                        <li style="padding:5px 0; border-top:1px solid #eef2ff; font-size:0.8rem; color:#555; display:flex; align-items:center; gap:6px;">
                            <span style="background:#00C48C; color:#fff; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:0.65rem; flex-shrink:0;">${i + 1}</span>
                            ${p.nombre}
                            <span style="margin-left:auto; font-size:0.72rem; color:#94a3b8;">+${p.tiempoEstimado} min</span>
                        </li>`).join('')
                        : '<li style="font-size:0.8rem; color:#999; padding:4px 0;">Sin datos de vuelta.</li>';

                    contenidoExpandible = `
                        <div class="tabs-paradas" style="margin-bottom:10px;">
                            <button class="tab-ida"    style="padding:5px 12px; border:none; border-radius:4px 0 0 4px; background:#007AFF; color:#fff; font-size:0.78rem; font-weight:bold; cursor:pointer;">Ida (${ruta.paradasIda.length})</button>
                            <button class="tab-vuelta" style="padding:5px 12px; border:none; border-radius:0 4px 4px 0; background:#e2e8f0; color:#555; font-size:0.78rem; font-weight:bold; cursor:pointer;">Vuelta (${ruta.paradasVuelta ? ruta.paradasVuelta.length : 0})</button>
                        </div>
                        <ul class="lista-paradas-ida"    style="list-style:none; padding:0; margin:0 0 10px; max-height:200px; overflow-y:auto;">${listaIda}</ul>
                        <ul class="lista-paradas-vuelta" style="display:none; list-style:none; padding:0; margin:0 0 10px; max-height:200px; overflow-y:auto;">${listaVuelta}</ul>`;
                } else {
                    // Si no hay paradas registradas, muestra la lista de buses activos.
                    const detalleBuses = (ruta.buses || []).map(b => `
                        <li style="padding:6px 0; border-top:1px solid #eee; font-size:0.8rem; color:#555;">
                            Unidad #${b.bus_id} - ${b.velocidad ?? 0} km/h
                        </li>`).join('');
                    contenidoExpandible = `
                        <ul style="list-style:none; padding:0; margin:0 0 15px;">
                            ${detalleBuses || '<li style="font-size:0.8rem; color:#999;">Sin unidades activas.</li>'}
                        </ul>`;
                }

                // Bloque de informacion en tiempo real, visible solo cuando hay buses activos.
                let infoTiempoReal = '';
                if (ruta.cantidadBuses > 0) {
                    const listaBuses = (ruta.buses || []).map(b => `
                        <li style="font-size:0.78rem; padding:4px 0; border-top:1px solid #f1f5f9; display:flex; align-items:center; gap:6px;">
                            <span style="background:#007AFF; color:#fff; border-radius:4px; padding:1px 5px; font-weight:bold; font-size:0.72rem;">Bus #${b.bus || b.id || '?'}</span>
                            <span style="color:#475569;">${b.ramal || 'Sin ramal'}</span>
                            <span style="margin-left:auto; color:#94a3b8; font-size:0.72rem;">${b.velocidad ?? 0} km/h</span>
                        </li>`).join('');

                    infoTiempoReal = `
                        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:8px 10px; margin-bottom:10px;">
                            <p style="font-size:0.8rem; font-weight:bold; color:#0369a1; margin:0 0 6px;">${ruta.cantidadBuses} unidad(es) activa(s) ahora</p>
                            <ul style="list-style:none; padding:0; margin:0;">${listaBuses}</ul>
                        </div>`;
                }

                const descripcion  = ruta.descripcion ? `<p style="font-size:0.82rem; color:#777; margin:0 0 10px; font-style:italic;">${ruta.descripcion}</p>` : '';
                const numeroBadge  = ruta.numeroRuta  ? `<span style="background:#f1f5f9; color:#475569; padding:3px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold; font-family:monospace;">${ruta.numeroRuta}</span>` : '';

                const tarjeta = document.createElement('div');
                tarjeta.className      = 'tarjeta-ruta';
                tarjeta.dataset.rutaId = ruta.id;
                tarjeta.style.cssText  = `background:#fff; padding:20px; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.07); display:flex; flex-direction:column; justify-content:space-between; border-left:5px solid ${colorBorde};`;

                tarjeta.innerHTML = `
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
                            <span style="background:${colorBorde}; color:#fff; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${ruta.estado}</span>
                            ${numeroBadge}
                        </div>
                        <h3 style="margin:0 0 6px; font-size:1.15rem; color:#1e293b;">${ruta.nombreRuta}</h3>
                        ${descripcion}
                        ${infoTiempoReal}
                        <button class="btn-ver-paradas" style="background:none; border:1px solid #cbd5e1; border-radius:4px; color:#475569; font-size:0.8rem; font-weight:bold; cursor:pointer; padding:5px 10px; margin-bottom:10px; width:100%; text-align:left;">
                            ${estaExpandida ? 'Ocultar paradas' : 'Ver paradas'}
                        </button>
                        <div class="detalle-expandible" style="display:${estaExpandida ? 'block' : 'none'};">
                            ${contenidoExpandible}
                        </div>
                    </div>
                    <button class="btn-agregar-fav" data-id="${ruta.id}" style="background:#00C48C; color:white; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px;">
                        Añadir a Favoritos
                    </button>`;

                contenedorCatalogo.appendChild(tarjeta);
            });

            // Listeners de las tarjetas generadas: expandir paradas y cambiar tabs ida/vuelta.
            document.querySelectorAll('.tarjeta-ruta').forEach(tarjetaEl => {
                const boton   = tarjetaEl.querySelector('.btn-ver-paradas');
                const detalle = tarjetaEl.querySelector('.detalle-expandible');
                const rutaId  = tarjetaEl.dataset.rutaId;
                if (!boton || !detalle) return;

                boton.addEventListener('click', () => {
                    const abrir = detalle.style.display !== 'block';
                    detalle.style.display = abrir ? 'block' : 'none';
                    boton.textContent     = abrir ? 'Ocultar paradas' : 'Ver paradas';
                    abrir ? rutasExpandidas.add(rutaId) : rutasExpandidas.delete(rutaId);
                });

                const tabIda      = tarjetaEl.querySelector('.tab-ida');
                const tabVuelta   = tarjetaEl.querySelector('.tab-vuelta');
                const listaIda    = tarjetaEl.querySelector('.lista-paradas-ida');
                const listaVuelta = tarjetaEl.querySelector('.lista-paradas-vuelta');

                if (tabIda && tabVuelta) {
                    tabIda.addEventListener('click', () => {
                        listaIda.style.display    = 'block';
                        listaVuelta.style.display  = 'none';
                        tabIda.style.background   = '#007AFF';
                        tabIda.style.color        = '#fff';
                        tabVuelta.style.background = '#e2e8f0';
                        tabVuelta.style.color      = '#555';
                    });
                    tabVuelta.addEventListener('click', () => {
                        listaIda.style.display    = 'none';
                        listaVuelta.style.display  = 'block';
                        tabVuelta.style.background = '#00C48C';
                        tabVuelta.style.color      = '#fff';
                        tabIda.style.background   = '#e2e8f0';
                        tabIda.style.color        = '#555';
                    });
                }
            });

            // Listener del boton de agregar a favoritos en cada tarjeta.
            document.querySelectorAll('.btn-agregar-fav').forEach(boton => {
                boton.addEventListener('click', e => {
                    const ruta = todasLasRutas.find(r => r.id === e.target.getAttribute('data-id'));
                    if (ruta) agregarAFavoritosLocalStorage(ruta);
                });
            });
        }

        // Aplica los filtros de texto y estado sobre el catalogo completo.
        function filtrarCatalogo() {
            const texto  = inputBusqueda ? inputBusqueda.value.toLowerCase().trim() : '';
            const estado = filtroEstado  ? filtroEstado.value : 'todos';
            renderizarTarjetas(todasLasRutas.filter(r => {
                const coincideTexto  = r.nombreRuta.toLowerCase().includes(texto) || (r.numeroRuta && r.numeroRuta.toLowerCase().includes(texto));
                const coincideEstado = estado === 'todos' || r.estado === estado;
                return coincideTexto && coincideEstado;
            }));
        }

        if (inputBusqueda) inputBusqueda.addEventListener('input',  filtrarCatalogo);
        if (filtroEstado)  filtroEstado.addEventListener('change', filtrarCatalogo);

        // Guarda una ruta del catalogo en los favoritos del usuario.
        // Requiere sesion activa; si no hay, redirige al login.
        function agregarAFavoritosLocalStorage(ruta) {
            const user = JSON.parse(localStorage.getItem('rv_user') || 'null');
            if (!user || !user.uid) {
                alert('Necesitas iniciar sesion para guardar rutas favoritas.');
                window.location.href = 'login.html';
                return;
            }
            let favs = JSON.parse(localStorage.getItem(getRoutesKey())) || [];
            if (favs.some(f => f.id === ruta.id)) {
                alert(`"${ruta.nombreRuta}" ya esta en tus favoritas.`);
                return;
            }
            favs.push({
                id:          ruta.id,
                alias:       'Acceso Rapido',
                linea:       ruta.nombreRuta,
                categoria:   ruta.categoria || 'Regular',
                parada:      '',
                descripcion: ruta.descripcion || `Ruta ${ruta.numeroRuta || ''}`
            });
            localStorage.setItem(getRoutesKey(), JSON.stringify(favs));
            alert(`"${ruta.nombreRuta}" se añadio a Mis Rutas.`);
        }
    }

    // 2. FORMULARIO DE MIS RUTAS (registro.html)
    // Maneja el formulario de registro de rutas favoritas, la lista de rutas guardadas
    // y el control de acceso: solo usuarios con sesion pueden guardar o ver sus rutas.

    const formulario = document.getElementById('formulario-ruta');

    if (formulario) {
        const contenedorFavoritas = document.getElementById('contenedor-rutas-favoritas');
        const btnLimpiarTodo      = document.getElementById('btn-limpiar');
        const mensajeExitoGlobal  = document.getElementById('mensaje-exito');
        const txtAlias            = document.getElementById('alias-ruta');
        const selBus              = document.getElementById('nombre-bus');
        const selCategoria        = document.getElementById('categoria-ruta');
        const selParada           = document.getElementById('parada-usuario');
        const txtDescripcion      = document.getElementById('descripcion-ruta');

        // Si el usuario esta logueado, elimina la clave generica antigua para evitar
        // que vea rutas guardadas antes de implementar el aislamiento por cuenta.
        try {
            const _u = JSON.parse(localStorage.getItem('rv_user'));
            if (_u && _u.uid && localStorage.getItem('misRutasFavoritas')) {
                localStorage.removeItem('misRutasFavoritas');
            }
        } catch (_) {}

        // Carga el dropdown de rutas desde rutas.json y el segundo dropdown de paradas
        // segun el ramal seleccionado.
        let catalogoRutas = [];
        if (selBus) {
            (async function cargarDropdown() {
                try {
                    const res = await fetch('data/rutas.json');
                    if (!res.ok) throw new Error();
                    catalogoRutas = await res.json();
                    selBus.innerHTML = '<option value="">-- Selecciona un ramal --</option>';
                    catalogoRutas.forEach(r => {
                        const o = document.createElement('option');
                        o.value = r.nombreRuta;
                        o.textContent = r.nombreRuta;
                        selBus.appendChild(o);
                    });
                } catch (e) {
                    selBus.innerHTML = '<option value="">Error cargando rutas</option>';
                }
            })();

            selBus.addEventListener('change', () => {
                validarCampoVacio(selBus, 'error-bus', 'Selecciona un ramal.');
                if (!selParada) return;

                const rutaSel = catalogoRutas.find(r => r.nombreRuta === selBus.value);
                selParada.innerHTML = '<option value="">-- Selecciona una parada --</option>';

                if (!rutaSel) { selParada.disabled = true; return; }
                selParada.disabled = false;

                const ida    = (rutaSel.paradas && rutaSel.paradas.ida)    || [];
                const vuelta = (rutaSel.paradas && rutaSel.paradas.vuelta) || [];

                if (ida.length > 0) {
                    const g = document.createElement('optgroup');
                    g.label = 'Ida';
                    ida.forEach(p => { const o = document.createElement('option'); o.value = p.nombre; o.textContent = p.nombre; g.appendChild(o); });
                    selParada.appendChild(g);
                }
                if (vuelta.length > 0) {
                    const g = document.createElement('optgroup');
                    g.label = 'Vuelta';
                    vuelta.forEach(p => { const o = document.createElement('option'); o.value = p.nombre; o.textContent = p.nombre; g.appendChild(o); });
                    selParada.appendChild(g);
                }
                if (ida.length === 0 && vuelta.length === 0) {
                    selParada.innerHTML = '<option value="">Sin paradas registradas</option>';
                    selParada.disabled  = true;
                }
            });
        }

        cargarFavoritosDOM();
        setInterval(cargarFavoritosDOM, 10000); // recarga la lista cada 10 segundos

        // Validacion en tiempo real de cada campo del formulario.
        txtAlias?.addEventListener('input',    () => validarCampoVacio(txtAlias,    'error-alias',     'El alias es obligatorio.'));
        selCategoria?.addEventListener('change',() => validarCampoVacio(selCategoria,'error-categoria', 'Selecciona una categoria.'));
        selParada?.addEventListener('change',   () => validarCampoVacio(selParada,   'error-parada',    'Selecciona tu parada.'));
        txtDescripcion?.addEventListener('input', () => {
            const errDesc = document.getElementById('error-descripcion');
            if (errDesc) errDesc.textContent = txtDescripcion.value.trim().length < 10 ? 'Minimo 10 caracteres.' : '';
        });

        // Devuelve true si el campo tiene valor, false si esta vacio y muestra el mensaje.
        function validarCampoVacio(input, idError, mensaje) {
            const el = document.getElementById(idError);
            if (!el || !input) return true;
            const vacio = !input.value || input.value.trim() === '';
            el.textContent = vacio ? mensaje : '';
            return !vacio;
        }

        // Al enviar el formulario, verifica sesion, valida campos y guarda la ruta.
        formulario.addEventListener('submit', e => {
            e.preventDefault();

            // Bloquear el guardado si no hay sesion activa.
            const user = JSON.parse(localStorage.getItem('rv_user') || 'null');
            if (!user || !user.uid) {
                if (mensajeExitoGlobal) {
                    mensajeExitoGlobal.style.cssText = 'display:block; background:#fff3cd; color:#856404; border:1px solid #ffc107; padding:15px; border-radius:5px; font-weight:bold; text-align:center; margin-bottom:20px;';
                    mensajeExitoGlobal.innerHTML     = 'Necesitas <a href="login.html" style="color:#856404; font-weight:bold; text-decoration:underline;">iniciar sesion</a> para guardar rutas.';
                    setTimeout(() => { mensajeExitoGlobal.style.display = 'none'; }, 5000);
                }
                return;
            }

            const v1 = txtAlias      ? validarCampoVacio(txtAlias,     'error-alias',     'El alias es obligatorio.')    : true;
            const v2 = selBus        ? validarCampoVacio(selBus,       'error-bus',       'Selecciona un ramal.')        : true;
            const v3 = selCategoria  ? validarCampoVacio(selCategoria, 'error-categoria', 'Selecciona una categoria.')   : true;
            const v4 = selParada     ? validarCampoVacio(selParada,    'error-parada',    'Selecciona tu parada.')       : true;
            const v5 = txtDescripcion ? txtDescripcion.value.trim().length >= 10 : true;

            const errDesc = document.getElementById('error-descripcion');
            if (!v5 && errDesc) errDesc.textContent = 'La descripcion debe tener minimo 10 caracteres.';

            if (v1 && v2 && v3 && v4 && v5) {
                const nueva = {
                    id:          'FAV-' + Date.now(),
                    alias:       txtAlias?.value.trim()       || '',
                    linea:       selBus?.value.trim()         || '',
                    categoria:   selCategoria?.value          || 'Regular',
                    parada:      selParada?.value.trim()      || '',
                    descripcion: txtDescripcion?.value.trim() || ''
                };
                const favs = JSON.parse(localStorage.getItem(getRoutesKey())) || [];
                favs.push(nueva);
                localStorage.setItem(getRoutesKey(), JSON.stringify(favs));

                formulario.reset();
                if (selParada) {
                    selParada.innerHTML = '<option value="">-- Primero selecciona un ramal --</option>';
                    selParada.disabled  = true;
                }
                if (mensajeExitoGlobal) {
                    mensajeExitoGlobal.style.cssText = 'display:block; background:#d4edda; color:#155724; padding:15px; border-radius:5px; font-weight:bold; text-align:center; margin-bottom:20px;';
                    mensajeExitoGlobal.textContent   = 'Ruta registrada correctamente en tus favoritos.';
                    setTimeout(() => { mensajeExitoGlobal.style.display = 'none'; }, 4000);
                }
                cargarFavoritosDOM();
            }
        });

        // Renderiza la lista de rutas guardadas del usuario.
        // Si no hay sesion, muestra un aviso con enlace al login.
        function cargarFavoritosDOM() {
            if (!contenedorFavoritas) return;

            const user = JSON.parse(localStorage.getItem('rv_user') || 'null');
            if (!user || !user.uid) {
                contenedorFavoritas.innerHTML = `
                    <div style="text-align:center; padding:40px 20px; color:#475569;">
                        <p style="font-weight:bold; color:#0f172a; margin-bottom:8px;">Inicia sesion para ver tus rutas</p>
                        <p style="font-size:0.9rem; margin-bottom:20px;">Tus rutas son privadas y se sincronizan con tu cuenta.</p>
                        <a href="login.html" style="background:#00C48C; color:#fff; padding:10px 24px; border-radius:50px; font-weight:bold; text-decoration:none; font-size:0.95rem;">Iniciar sesion</a>
                    </div>`;
                return;
            }

            const favs = JSON.parse(localStorage.getItem(getRoutesKey())) || [];

            if (favs.length === 0) {
                contenedorFavoritas.innerHTML = `
                    <div style="text-align:center; color:#777; padding:40px 20px;">
                        <p>Aun no has registrado rutas personalizadas.</p>
                    </div>`;
                return;
            }

            contenedorFavoritas.innerHTML = '';
            favs.forEach(fav => {
                const item = document.createElement('div');
                item.className = 'tarjeta-favorita-guardada';
                item.style.cssText = 'background:#f8f9fa; border:1px solid #e2e8f0; padding:15px; border-radius:6px; margin-bottom:15px; position:relative;';
                item.innerHTML = `
                    <h3 style="margin:0 0 5px; color:#00C48C; font-size:1.15rem;">${fav.alias}</h3>
                    <p style="margin:0 0 5px; font-weight:bold; font-size:0.9rem;">
                        ${fav.linea}
                        <span style="font-size:0.75rem; font-weight:normal; background:#cbd5e1; padding:2px 6px; border-radius:3px; margin-left:5px;">${fav.categoria}</span>
                    </p>
                    ${fav.parada ? `<p style="margin:0 0 8px; font-size:0.85rem; color:#475569;"><strong>Abordaje:</strong> ${fav.parada}</p>` : ''}
                    <p style="margin:0; font-size:0.85rem; color:#64748b; font-style:italic;">"${fav.descripcion}"</p>
                    <button class="btn-eliminar-individual" data-id="${fav.id}" style="position:absolute; top:15px; right:15px; background:none; border:none; color:#dc3545; font-size:1.1rem; cursor:pointer;" title="Eliminar">X</button>`;
                contenedorFavoritas.appendChild(item);
            });

            // Listener para eliminar una ruta individual de la lista.
            document.querySelectorAll('.btn-eliminar-individual').forEach(btn => {
                btn.addEventListener('click', e => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (confirm('Desea eliminar esta ruta?')) {
                        let f = JSON.parse(localStorage.getItem(getRoutesKey())) || [];
                        localStorage.setItem(getRoutesKey(), JSON.stringify(f.filter(x => x.id !== id)));
                        cargarFavoritosDOM();
                    }
                });
            });
        }

        // Elimina todas las rutas guardadas del usuario tras confirmacion.
        if (btnLimpiarTodo) {
            btnLimpiarTodo.addEventListener('click', () => {
                const f = JSON.parse(localStorage.getItem(getRoutesKey())) || [];
                if (f.length === 0) { alert('No hay rutas guardadas para limpiar.'); return; }
                if (confirm('Desea borrar TODAS sus rutas guardadas?')) {
                    localStorage.removeItem(getRoutesKey());
                    cargarFavoritosDOM();
                }
            });
        }
    }
});

// 3. GOOGLE MAPS Y BUSES EN TIEMPO REAL
// Esta seccion vive fuera del DOMContentLoaded porque initMap() es llamada
// directamente por la API de Google Maps al terminar de cargar.

let map;
const markers      = {};
const busPaths     = {};
const busPolylines = {};
const MAX_PUNTOS_RECORRIDO = 40; // cuantos puntos del historial conservar por bus

const KML_API_URL = 'http://localhost:3000/api/buses';

// Estilo visual del mapa: tono gris neutro similar a apps de movilidad tipo Uber.
const ESTILO_UBER = [
    { elementType: "geometry",              stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon",           stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill",      stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke",    stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative.land_parcel",  stylers: [{ visibility: "off" }] },
    { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
    { featureType: "poi",                   stylers: [{ visibility: "off" }] },
    { featureType: "poi.park",              stylers: [{ visibility: "on" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
    { featureType: "road",     elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road.highway",  elementType: "geometry",         stylers: [{ color: "#dadada" }] },
    { featureType: "road.highway",  elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "transit",       stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry",         stylers: [{ color: "#c9d6dc" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
];

// Callback de la API de Google Maps: inicializa el mapa y arranca el ciclo de actualizacion.
function initMap() {
    const el = document.getElementById("map");
    if (!el) return;

    map = new google.maps.Map(el, {
        center: { lat: 9.9333, lng: -84.0833 },
        zoom:   13,
        styles: ESTILO_UBER
    });

    // Capa de trafico de Google: colorea las calles segun congestion en tiempo real.
    new google.maps.TrafficLayer().setMap(map);

    fetchBuses();
    setInterval(fetchBuses, 5000); // refresca la posicion de los buses cada 5 segundos
}

// Consulta el servidor proxy y actualiza los marcadores en el mapa.
async function fetchBuses() {
    const statsLabel = document.getElementById('stats-buses');
    try {
        const response = await fetch(KML_API_URL);
        if (!response.ok) throw new Error();

        const data = await response.json();
        const raw  = Array.isArray(data) ? data : (data.buses || data.data || []);

        // Normaliza y filtra los datos crudos del servidor.
        const dataBuses = raw
            .filter(b => b.lat && b.lon)
            .map(b => ({
                bus_id:          String(b.bus || b.id || '?'),
                lat:             parseFloat(b.lat),
                lng:             parseFloat(b.lon),
                velocidad:       b.velocidad || 0,
                pasajeros_abordo: 0,
                pasajeros_hoy:   0,
                conductor:       (b.despacho?.actual?.conductor) || b.conductor || 'Sin asignar',
                ruta:            b.ramal || 'No asignada',
                actualizado:     b.actualizado || '',
                placa:           b.placa || ''
            }))
            .filter(b => b.lat >= 8 && b.lat <= 12 && b.lng >= -86 && b.lng <= -82); // dentro de Costa Rica

        if (statsLabel) {
            statsLabel.innerText          = `${dataBuses.length} buses en tiempo real`;
            statsLabel.style.backgroundColor = '#22c55e';
        }
        renderBuses(dataBuses);

    } catch (e) {
        console.warn('No se pudo conectar con el servidor de buses.', e);
        if (statsLabel) {
            statsLabel.innerText          = 'Error de conexion con el backend';
            statsLabel.style.backgroundColor = '#ef4444';
        }
    }
}

// Mantiene el historial de posiciones de cada bus para dibujar su trayectoria.
function actualizarRecorridoBus(busId, position) {
    if (!busPaths[busId]) busPaths[busId] = [];
    const historial = busPaths[busId];
    const ultimo    = historial[historial.length - 1];

    // Solo agrega el punto si el bus se movio desde la ultima posicion.
    if (!ultimo || ultimo.lat !== position.lat || ultimo.lng !== position.lng) {
        historial.push(position);
    }
    if (historial.length > MAX_PUNTOS_RECORRIDO) historial.shift();

    if (busPolylines[busId]) {
        busPolylines[busId].setPath(historial);
    } else {
        busPolylines[busId] = new google.maps.Polyline({
            path:         historial,
            geodesic:     true,
            strokeColor:  '#007AFF',
            strokeOpacity: 0.6,
            strokeWeight: 3,
            map
        });
    }
}

// Coloca o actualiza los marcadores de cada bus en el mapa.
function renderBuses(buses) {
    if (!Array.isArray(buses) || !map) return;

    const bounds = new google.maps.LatLngBounds();
    let dibujados = 0;

    buses.forEach(bus => {
        const busId    = bus.bus_id;
        const position = { lat: bus.lat, lng: bus.lng };

        actualizarRecorridoBus(busId, position);

        // Icono SVG de bus embebido como Data URL para no depender de archivos externos.
        const iconoBus = {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="11" fill="#007AFF" stroke="#FFFFFF" stroke-width="1.5"/>
                    <path fill="#FFFFFF" d="M6 6.5C6 5.67 6.67 5 7.5 5h9C17.33 5 18 5.67 18 6.5v9c0 .6-.35 1.11-.85 1.36l.35.64h-1l-.5-.75h-7.5l-.5.75h-1l.35-.64A1.5 1.5 0 0 1 6 15.5v-9zM7.5 7v4.5h9V7h-9zM8 13.25a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm8 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"/>
                </svg>`),
            scaledSize: new google.maps.Size(36, 36),
            anchor:     new google.maps.Point(18, 18)
        };

        const ramal = bus.ruta && bus.ruta !== 'No asignada' ? bus.ruta : null;

        // Contenido del popup que aparece al hacer clic en un marcador.
        const contenidoInfo = `
            <div style="color:#1e293b; padding:6px; font-family:system-ui,sans-serif; min-width:210px;">
                <h4 style="margin:0 0 8px; color:#007AFF; font-size:0.95rem; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">Unidad #${busId}</h4>
                ${ramal
                    ? `<p style="margin:3px 0; font-size:0.85rem; background:#e0f2fe; padding:3px 6px; border-radius:4px;"><b>Ramal:</b> ${ramal}</p>`
                    : `<p style="margin:3px 0; font-size:0.85rem; color:#94a3b8;">Sin ramal asignado</p>`}
                <p style="margin:3px 0; font-size:0.85rem;"><b>Velocidad:</b> ${bus.velocidad ?? 0} km/h</p>
                <p style="margin:3px 0; font-size:0.85rem;"><b>Conductor:</b> ${bus.conductor}</p>
                ${bus.placa ? `<p style="margin:3px 0; font-size:0.85rem;"><b>Placa:</b> ${bus.placa}</p>` : ''}
                <p style="margin:4px 0 0; font-size:0.72rem; color:#94a3b8;">${bus.actualizado ?? ''}</p>
            </div>`;

        if (markers[busId]) {
            // Actualiza la posicion de un marcador existente.
            markers[busId].setPosition(position);
            if (markers[busId].infoWindow) markers[busId].infoWindow.setContent(contenidoInfo);
        } else {
            // Crea el marcador por primera vez.
            const marker     = new google.maps.Marker({ position, map, title: `Unidad #${busId}`, icon: iconoBus });
            const infoWindow = new google.maps.InfoWindow({ content: contenidoInfo });
            marker.infoWindow = infoWindow;
            marker.addListener('click', () => infoWindow.open(map, marker));
            markers[busId] = marker;
        }

        bounds.extend(position);
        dibujados++;
    });

    // Ajusta el zoom del mapa para mostrar todos los buses la primera vez.
    if (dibujados > 0 && !window.mapaAjustado) {
        map.fitBounds(bounds);
        window.mapaAjustado = true;
    }

    // Oculta los buses que ya no estan en la respuesta del servidor.
    const idsActivos = new Set(buses.map(b => b.bus_id));
    Object.keys(markers).forEach(id => {
        const visible = idsActivos.has(id);
        markers[id].setVisible(visible);
        if (busPolylines[id]) busPolylines[id].setMap(visible ? map : null);
    });
}

window.initMap = initMap;