/**
 * RouteView - Modo Oscuro
 * Archivo independiente: crea el botón de modo oscuro en el navbar,
 * aplica la preferencia guardada y la persiste en localStorage.
 * Requiere: css/dark-mode.css cargado en el <head> de cada página.
 */

document.addEventListener('DOMContentLoaded', () => {
    inicializarModoOscuro();
});

function inicializarModoOscuro() {
    // 1. Aplicar preferencia guardada ANTES de crear el botón
    const preferenciaGuardada = localStorage.getItem('routeview-modo-oscuro');
    if (preferenciaGuardada === 'true') {
        document.documentElement.classList.add('dark-mode');
    }

    // 2. Crear el botón y agregarlo al navbar (justo antes del botón hamburguesa)
    const navContenido = document.querySelector('.nav-contenido');
    if (!navContenido) return;

    const boton = document.createElement('button');
    boton.id = 'btn-modo-oscuro';
    boton.type = 'button';
    boton.setAttribute('aria-label', 'Alternar modo oscuro');
    actualizarTextoBoton(boton);

    const hamburger = document.getElementById('hamburger');
    if (hamburger) {
        navContenido.insertBefore(boton, hamburger);
    } else {
        navContenido.appendChild(boton);
    }

    // 3. Alternar al hacer clic
    boton.addEventListener('click', () => {
        const activo = document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('routeview-modo-oscuro', activo ? 'true' : 'false');
        actualizarTextoBoton(boton);
    });
}

function actualizarTextoBoton(boton) {
    const esOscuro = document.documentElement.classList.contains('dark-mode');
    boton.textContent = esOscuro ? '☀️ Claro' : '🌙 Oscuro';
}