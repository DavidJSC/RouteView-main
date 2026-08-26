/**
 * auth.js / RouteView
 * Servicio de autenticación usando Firebase Auth REST API.
 * Curso: Programación en Ambiente Web I
 *
 * Endpoints consumidos:
 *  1. POST accounts:signUp             → registrarUsuario()
 *  2. POST accounts:signInWithPassword → iniciarSesion()
 *  3. POST accounts:lookup             → obtenerPerfil()
 *  4. POST accounts:update             → actualizarNombre()
 */

const FIREBASE_API_KEY = 'AIzaSyCUA9h2t5x0azluTFHyrRQriVec7b3SYDI';
const FIREBASE_BASE    = 'https://identitytoolkit.googleapis.com/v1/accounts';

const TOKEN_KEY = 'rv_token';
const USER_KEY  = 'rv_user';

//  Sesión local 

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
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
}

export function estaAutenticado() {
    return !!obtenerToken();
}

//  Endpoint 1: Registro 
// POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=API_KEY
// Body: { email, password, displayName, returnSecureToken }

export async function registrarUsuario({ fullName, email, password }) {
    const res = await fetch(`${FIREBASE_BASE}:signUp?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            password,
            displayName: fullName,
            returnSecureToken: true
        })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(traducirError(data.error?.message));
    return data; // { idToken, email, displayName, localId, ... }
}

//  Endpoint 2: Login 
// POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=API_KEY
// Body: { email, password, returnSecureToken }

export async function iniciarSesion({ email, password }) {
    const res = await fetch(`${FIREBASE_BASE}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(traducirError(data.error?.message));
    return data; // { idToken, email, displayName, localId, ... }
}

//  Endpoint 3: Perfil (ruta protegida con token) 
// POST https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=API_KEY
// Body: { idToken }   ← requiere el token guardado en sesión

export async function obtenerPerfil() {
    const token = obtenerToken();
    if (!token) throw new Error('No hay sesión activa');

    const res = await fetch(`${FIREBASE_BASE}:lookup?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(traducirError(data.error?.message));
    return data.users[0]; // { localId, email, displayName, createdAt, ... }
}

//  Endpoint 4: Actualizar nombre 
// POST https://identitytoolkit.googleapis.com/v1/accounts:update?key=API_KEY
// Body: { idToken, displayName, returnSecureToken }

export async function actualizarNombre(nuevoNombre) {
    const token = obtenerToken();
    if (!token) throw new Error('No hay sesión activa');

    const res = await fetch(`${FIREBASE_BASE}:update?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            idToken: token,
            displayName: nuevoNombre,
            returnSecureToken: true
        })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(traducirError(data.error?.message));

    // Actualizar el nombre en localStorage también
    const usuario = obtenerUsuario();
    if (usuario) {
        usuario.fullName = nuevoNombre;
        localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    }
    return data;
}

//  Helper: mensajes de error en español 

function traducirError(codigo) {
    const errores = {
        'EMAIL_EXISTS':            'Este correo ya está registrado.',
        'INVALID_EMAIL':           'El formato del correo no es válido.',
        'WEAK_PASSWORD':           'La contraseña debe tener al menos 6 caracteres.',
        'EMAIL_NOT_FOUND':         'No existe una cuenta con ese correo.',
        'INVALID_PASSWORD':        'Contraseña incorrecta.',
        'USER_DISABLED':           'Esta cuenta ha sido deshabilitada.',
        'INVALID_LOGIN_CREDENTIALS': 'Correo o contraseña incorrectos.',
        'TOO_MANY_ATTEMPTS_TRY_LATER': 'Demasiados intentos. Intentá más tarde.',
    };
    return errores[codigo] || 'Ocurrió un error. Intentá de nuevo.';
}

//  Actualiza el navbar en cualquier página 

export function actualizarNavbar() {
    const usuario = obtenerUsuario();
    const slot = document.getElementById('nav-auth-slot');
    const contenedorNav = document.querySelector('.nav-links');

    if (slot) slot.innerHTML = '';
    contenedorNav?.querySelectorAll('.nav-auth').forEach(el => el.remove());

    if (usuario) {
        const html = `
            <span class="nav-username">👤 ${usuario.fullName?.split(' ')[0] || 'Usuario'}</span>
            <a href="perfil.html" class="btn-nav-perfil">Mi perfil</a>
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

    document.getElementById('btn-logout')?.addEventListener('click', (e) => {
        e.preventDefault();
        cerrarSesion();
        window.location.href = 'index.html';
    });
}