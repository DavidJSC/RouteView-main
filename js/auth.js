/**
 * auth.js – RouteView
 * Servicio centralizado de autenticación.
 * Curso: ISW-521 Programación en Ambiente Web I – UTN
 */

const API_BASE = 'http://localhost:3000';
const TOKEN_KEY = 'rv_token';
const USER_KEY = 'rv_user';

// ─── Almacenamiento del token ────────────────────────────────────────────────

export function guardarSesion(token, usuario) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
}

export function cerrarSesion() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function obtenerToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function obtenerUsuario() {
    const raw = localStorage.getItem(USER_KEY);
    try { return raw ? JSON.parse(raw) : null; }
    catch { return null; }
}

export function estaAutenticado() {
    return !!obtenerToken();
}

// ─── Llamadas al API ─────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
export async function registrarUsuario({ fullName, email, password }) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al registrarse');
    return data; // { message, user }
}

/**
 * POST /api/auth/login
 */
export async function iniciarSesion({ email, password }) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Credenciales incorrectas');
    return data; // { token, user }
}

/**
 * GET /api/auth/perfil  (ruta protegida)
 */
export async function obtenerPerfil() {
    const token = obtenerToken();
    if (!token) throw new Error('No autenticado');
    const res = await fetch(`${API_BASE}/api/auth/perfil`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al obtener perfil');
    return data; // { user }
}

// ─── Helper: actualiza el navbar en cualquier página ─────────────────────────

export function actualizarNavbar() {
    const usuario = obtenerUsuario();

    // Intenta el slot dedicado primero; si no existe, cae en nav-links
    const slot = document.getElementById('nav-auth-slot');
    const contenedorNav = document.querySelector('.nav-links');

    // Limpia inyecciones previas en ambos lugares
    if (slot) slot.innerHTML = '';
    contenedorNav?.querySelectorAll('.nav-auth').forEach(el => el.remove());

    if (usuario) {
        const html = `
        <span class="nav-username">👤 ${usuario.fullName.split(' ')[0]}</span>
        <a href="#" id="btn-logout" class="btn-nav-logout">Cerrar sesión</a>
    `;
        if (slot) {
            slot.innerHTML = html;
        } else if (contenedorNav) {
            const li = document.createElement('li');
            li.className = 'nav-auth';
            li.innerHTML = html;
            contenedorNav.appendChild(li);
        }
    } else {
        const html = `<a href="login.html" class="btn btn-primario btn-nav-login">Iniciar sesión</a>`;
        if (slot) {
            slot.innerHTML = html;
        } else if (contenedorNav) {
            const li = document.createElement('li');
            li.className = 'nav-auth';
            li.innerHTML = html;
            contenedorNav.appendChild(li);
        }
    }

    // Evento cerrar sesión (puede estar en slot o en nav-links)
    document.getElementById('btn-logout')?.addEventListener('click', (e) => {
        e.preventDefault();
        cerrarSesion();
        window.location.href = 'index.html';
    });
}