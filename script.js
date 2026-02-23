
// --- CONFIGURACIÓN ---
const ID_SHEET = '1jKoiVaK619iS7hGGsqtxsrWgzePmF_VY33VbIgdc-ag'; 
const SHEET_TAB = 'rauda'; 

const CONFIG = {
    whatsappNumber: '5493447402198',
    businessName: 'Rauda',
    menuUrl: `https://opensheet.elk.sh/${ID_SHEET}/${SHEET_TAB}`,
};

// Mapeo de columnas (Asegúrate que en tu Excel se llamen así)
const KEYS = {
    id: 'id',
    categoria: 'categoria',
    producto: 'producto',
    precio: 'precio',
    descripcion: 'descripcion',
    imagen: 'imagen',
    destacado: 'destacado',
    disponible: 'disponible',
    vinoDeLaSemana: 'vinoDeLaSemana',
    tipoVino: 'tipoVino', // Nueva columna para tipo de vino (tinto, blanco, rosado)
    descuento: 'precioConDescuento' // Precio con descuento (si tiene valor, el producto está en oferta)
};

let CATALOG = []; 
let cart = [];
let selectedPayment = 'Efectivo';
let modalLockCount = 0;
let lockedScrollY = 0;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    loadCart();
    initMobileModalGestures();
});

function lockBodyScroll() {
    if (modalLockCount === 0) {
        lockedScrollY = window.scrollY || window.pageYOffset || 0;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${lockedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
    }
    modalLockCount++;
}

function unlockBodyScroll() {
    if (modalLockCount === 0) return;

    modalLockCount--;
    if (modalLockCount > 0) return;

    const top = document.body.style.top;

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';

    const scrollToY = top ? Math.abs(parseInt(top, 10)) : lockedScrollY;
    window.scrollTo(0, Number.isNaN(scrollToY) ? lockedScrollY : scrollToY);
}

async function initApp() {
    const container = document.getElementById('main-content');
    
    try {
        // Spinner de carga
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 fade-in-up">
                <div class="w-8 h-8 border-4 border-rauda-terracotta border-t-transparent rounded-full animate-spin mb-4"></div>
                <p class="text-rauda-leather font-serif italic">Preparando la boutique...</p>
            </div>
        `;

        const response = await fetch(CONFIG.menuUrl);
        if (!response.ok) throw new Error('Error de conexión con Google Sheets');
        const data = await response.json();

        // Procesar datos (Aquí aplicamos la lógica de Pelican para imágenes y precio)
        CATALOG = data
            .map((item, index) => ({
                id: String(item[KEYS.id] || index), 
                categoria: (item[KEYS.categoria] || 'Varios').trim(),
                producto: (item[KEYS.producto] || '').trim(),
                precio: parsePrice(item[KEYS.precio]),
                descripcion: (item[KEYS.descripcion] || '').trim(),
                imagen: procesarURLImagen(item[KEYS.imagen]),
                destacado: isTrue(item[KEYS.destacado]),
                disponible: isTrue(item[KEYS.disponible] || 'TRUE'),
                vinoDeLaSemana: isTrue(item[KEYS.vinoDeLaSemana]),
                tipoVino: (item[KEYS.tipoVino] || '').trim(), // LEEMOS EL NUEVO DATO
                descuento: parsePrice(item[KEYS.descuento]) || null // Precio con descuento
            }))
            .filter(item => item.producto && item.disponible); 

        if (CATALOG.length === 0) {
            container.innerHTML = '<div class="text-center py-20 opacity-50 font-serif">No se encontraron productos disponibles.</div>';
            return;
        }

        renderCategories();
        
        // Cargar la PRIMERA categoría real del Excel (Ya no "Destacados" forzado)
        const categories = [...new Set(CATALOG.map(item => item.categoria))];
        if (categories.length > 0) {
            renderProducts(categories[0]); 
        }

    } catch (error) {
        console.error('Error cargando datos:', error);
        container.innerHTML = `
            <div class="text-center py-20 text-red-800 opacity-60">
                <p class="font-bold">Error al cargar.</p>
                <p class="text-xs mt-2">Verifica la conexión o el ID de la hoja.</p>
            </div>
        `;
    }
}

// --- RENDERIZADO ---

function renderCategories() {
    const nav = document.getElementById('nav-tabs');
    const categories = [...new Set(CATALOG.map(item => item.categoria))];
    
    let navHtml = '';

    categories.forEach((cat, index) => {
        // La primera categoría activa por defecto visualmente
        const isActive = index === 0 ? 'active text-rauda-terracotta border-b-rauda-terracotta' : 'text-rauda-dark/50';
        
        navHtml += `
        <li>
            <button onclick="renderProducts('${cat}', this)" class="nav-tab ${isActive} text-xs md:text-sm font-bold uppercase tracking-widest px-4 py-2 hover:text-rauda-terracotta whitespace-nowrap">
                ${cat}
            </button>
        </li>
    `;
    });
    
    nav.innerHTML = navHtml;
}

function renderProducts(category, btnElement) {
    // UI: Actualizar pestañas activas
    if (btnElement) {
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.classList.remove('active', 'text-rauda-terracotta');
            btn.classList.add('text-rauda-dark/50');
        });
        btnElement.classList.add('active', 'text-rauda-terracotta');
        btnElement.classList.remove('text-rauda-dark/50');
        btnElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    const container = document.getElementById('main-content');
    
    // 1. Filtrar items de la categoría principal
    const allItems = CATALOG.filter(i => i.categoria === category);

    // 2. Buscar Destacado (Vino de la semana)
    const featuredItem = allItems.find(i => i.vinoDeLaSemana);
    
    // 3. Items normales (excluyendo el destacado) y guardar copia original
    let gridItems = featuredItem ? allItems.filter(i => i.id !== featuredItem.id) : allItems;
    const originalGridItems = [...gridItems];

    // Animación de salida
    container.style.opacity = '0';
    container.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
        container.innerHTML = ''; 

        // Título de Categoría
        const titleDiv = document.createElement('div');
        titleDiv.className = 'flex items-center gap-3 mb-8 md:mb-10 fade-in-up';
        titleDiv.innerHTML = `
            <span class="h-px bg-rauda-leather/10 flex-1"></span>
            <h2 class="text-xl md:text-3xl font-display font-bold text-rauda-leather text-center uppercase tracking-wider">${category}</h2>
            <span class="h-px bg-rauda-leather/10 flex-1"></span>
        `;
        container.appendChild(titleDiv);

        // --- LÓGICA VINO DE LA SEMANA ---
        if (featuredItem) {
            container.innerHTML += createFeaturedCardHtml(featuredItem);
            container.innerHTML += `
                <div class="w-full flex justify-center items-center mb-12 fade-in-up delay-100 opacity-60">
                    <span class="h-px w-16 md:w-32 bg-gradient-to-r from-transparent via-rauda-leather/40 to-transparent"></span>
                    <i class="ph-fill ph-diamond text-[10px] text-rauda-leather/60 mx-3"></i>
                    <span class="h-px w-16 md:w-32 bg-gradient-to-r from-transparent via-rauda-leather/40 to-transparent"></span>
                </div>
            `;
        }

        // --- CONTROLES: FILTROS Y ORDENAMIENTO ---
        const subCategories = [...new Set(gridItems.map(i => i.tipoVino).filter(v => v !== '' && v !== undefined))];
        
        const controlsDiv = document.createElement('div');
        // Usamos flex para separar filtros a la izquierda y ordenamiento a la derecha en PC, apilado en móviles
        controlsDiv.className = 'flex flex-col md:flex-row justify-between items-center w-full gap-4 mb-8 fade-in-up delay-200';
        
        // 1. HTML de Sub-Filtros
        let filterHtml = '<div class="flex flex-wrap gap-2 justify-center md:justify-start">';
        if (subCategories.length > 0) {
            filterHtml += `<button class="sub-filter-btn px-4 py-1.5 rounded-full border border-rauda-terracotta bg-rauda-terracotta text-white text-[10px] uppercase tracking-wider font-bold transition-all shadow-md" data-filter="all">Todos</button>`;
            subCategories.forEach(sub => {
                filterHtml += `<button class="sub-filter-btn px-4 py-1.5 rounded-full border border-rauda-leather/20 text-rauda-leather hover:border-rauda-terracotta text-[10px] uppercase tracking-wider font-bold transition-all bg-white shadow-sm" data-filter="${sub}">${sub}</button>`;
            });
        }
        filterHtml += '</div>';

        // 2. HTML de Select de Ordenamiento
        const sortHtml = `
            <div class="relative flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-rauda-leather/20 shadow-sm shrink-0 cursor-pointer hover:border-rauda-terracotta transition-colors group">
                <i class="ph-bold ph-sort-ascending text-rauda-leather group-hover:text-rauda-terracotta transition-colors"></i>
                
                <span id="sort-display" class="text-rauda-leather text-[10px] md:text-xs uppercase tracking-wider font-bold pointer-events-none group-hover:text-rauda-terracotta transition-colors">
                    Recomendados
                </span>
                
                <i class="ph-bold ph-caret-down text-rauda-leather/50 text-xs ml-1 pointer-events-none group-hover:text-rauda-terracotta/50 transition-colors"></i>
                
                <select id="sort-select" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none">
                    <option value="default">Recomendados</option>
                    <option value="alpha">A - Z</option>
                    <option value="price-asc">Menor Precio</option>
                    <option value="price-desc">Mayor Precio</option>
                </select>
            </div>
        `;

        controlsDiv.innerHTML = filterHtml + sortHtml;
        container.appendChild(controlsDiv);

        // Contenedor dinámico de la grilla de productos
        const gridDivContainer = document.createElement('div');
        gridDivContainer.id = 'grid-container';
        gridDivContainer.className = 'w-full';
        container.appendChild(gridDivContainer);

        // --- LÓGICA DE ESTADO (FILTROS + ORDEN) ---
        let currentFilter = 'all';
        let currentSort = 'default';

        function updateGrid() {
            let filtered = [...originalGridItems];
            
            // 1. Aplicar filtro
            if (currentFilter !== 'all') {
                filtered = filtered.filter(i => i.tipoVino === currentFilter);
            }

            // 2. Aplicar ordenamiento
            if (currentSort === 'alpha') {
                filtered.sort((a, b) => a.producto.localeCompare(b.producto));
            } else if (currentSort === 'price-asc') {
                // Considera el precio con descuento si existe
                filtered.sort((a, b) => (a.descuento || a.precio) - (b.descuento || b.precio));
            } else if (currentSort === 'price-desc') {
                filtered.sort((a, b) => (b.descuento || b.precio) - (a.descuento || a.precio));
            }

            // 3. Renderizar resultados
            if (filtered.length === 0 && !featuredItem) {
                gridDivContainer.innerHTML = `<div class="text-center py-10 opacity-40 font-serif italic w-full">No hay productos en esta categoría.</div>`;
            } else {
                const gridHtml = `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 pb-10">` + 
                    filtered.map((item, index) => createCardHtml(item, index)).join('') + 
                `</div>`;
                gridDivContainer.innerHTML = gridHtml;
                
                // Reiniciamos el observador de animaciones tras actualizar el DOM
                setTimeout(initScrollAnimations, 50);
            }
        }

        function updateSortDisplay(value) {
            const sortDisplay = document.getElementById('sort-display');
            if (!sortDisplay) return;

            const labels = {
                'default': 'Recomendados',
                'alpha': 'A - Z',
                'price-asc': 'Menor Precio',
                'price-desc': 'Mayor Precio'
            };

            sortDisplay.innerText = labels[value] || 'Recomendados';
        }

        // Asignar Event Listeners una vez inyectado el HTML
        setTimeout(() => { 
            // Botones de filtro
            const buttons = container.querySelectorAll('.sub-filter-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    buttons.forEach(b => {
                        b.classList.remove('bg-rauda-terracotta', 'text-white', 'border-rauda-terracotta');
                        b.classList.add('border-rauda-leather/20', 'text-rauda-leather', 'bg-white');
                    });
                    btn.classList.remove('border-rauda-leather/20', 'text-rauda-leather', 'bg-white');
                    btn.classList.add('bg-rauda-terracotta', 'text-white', 'border-rauda-terracotta');

                    currentFilter = btn.getAttribute('data-filter');
                    updateGrid();
                });
            });

            // Selector de ordenamiento
            const sortSelect = document.getElementById('sort-select');
            if(sortSelect) {
                sortSelect.value = currentSort;
                updateSortDisplay(currentSort);

                sortSelect.addEventListener('change', (e) => {
                    currentSort = e.target.value;
                    updateSortDisplay(currentSort);
                    updateGrid();
                });
            }
            
            // Cargar grilla inicial
            updateGrid();
        }, 10);

        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 300);
}

function createCardHtml(item, index) {
    const imgUrl = item.imagen || 'https://via.placeholder.com/400x500?text=Sin+Imagen';
    const priceFormatted = item.precio.toLocaleString('es-AR');
    const itemJson = JSON.stringify(item).replace(/"/g, "&quot;");
    
    const hasDiscount = item.descuento && item.descuento > 0;
    const discountFormatted = hasDiscount ? item.descuento.toLocaleString('es-AR') : null;
    
    const priceHtml = hasDiscount 
        ? `<span class="font-sans text-rauda-dark/40 line-through text-[10px] md:text-xs">$${priceFormatted}</span>
        <span class="font-sans font-bold text-red-700 whitespace-nowrap text-xs md:text-sm tracking-wide">$${discountFormatted}</span>`
        : `<span class="font-sans font-bold text-rauda-leather whitespace-nowrap text-xs md:text-sm tracking-wide">$${priceFormatted}</span>`;

    // Nota: Agregamos 'card-hidden', 'skeleton-bg', 'img-lazy' y el evento onload
    return `
    <article class="product-card group cursor-pointer relative flex flex-col h-full js-product-card card-hidden" data-tipo="${item.tipoVino || ''}" onclick='openProductModal(${itemJson})'>
        
        <div class="relative overflow-hidden aspect-[4/5] bg-gray-200 mb-3 rounded-sm shadow-sm w-full skeleton-bg">
            <img src="${imgUrl}" 
                class="product-image w-full h-full object-cover img-lazy group-hover:scale-105" 
                alt="${item.producto}" 
                loading="lazy" 
                onload="this.classList.add('img-loaded'); this.parentElement.classList.remove('skeleton-bg');">
            
            <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300"></div>
            
            ${hasDiscount ? `<div class="absolute top-2 left-2 bg-red-700 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm shadow-md z-10">Oferta</div>` : ''}
            
            <div class="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm text-rauda-leather w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-lg md:translate-y-12 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 transition-all duration-300 z-10">
                <i class="ph-bold ph-plus text-base md:text-lg"></i>
            </div>
        </div>
        
        <div class="px-1 flex flex-col justify-between flex-1">
            <div class="flex flex-col gap-1">
                <h3 class="font-serif text-sm md:text-base text-rauda-dark leading-tight group-hover:text-rauda-terracotta transition-colors line-clamp-2">${item.producto}</h3>
                <div class="flex items-center gap-2 mt-1">
                    ${priceHtml}
                </div>
            </div>
        </div>
    </article>
    `;
}

// --- HELPERS (PELICAN LOGIC INTEGRADA) ---

function isTrue(val) {
    if (!val) return false;
    const str = String(val).trim().toUpperCase();
    return ['TRUE', 'VERDADERO', 'SI', 'SÍ', '1'].includes(str);
}

// FIX PRECIOS: Remueve puntos de miles antes de parsear
function parsePrice(val) {
    if (!val) return 0;
    // Convierte "10.000" -> "10000"
    let clean = String(val).replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
    return Number(clean);
}

// FIX IMÁGENES: Detecta links de Drive y los convierte
function procesarURLImagen(url) {
    if (!url) return null;
    if (url.includes('drive.google.com')) {
        const idMatch = url.match(/\/d\/(.*?)(?:\/|$)/);
        if (idMatch && idMatch[1]) { 
            return `https://lh3.googleusercontent.com/d/${idMatch[1]}`; 
        }
    }
    return url;
}

// ==========================================
// LOGICA DE CARRITO Y PEDIDOS (MANTENIDA DE RAUDA)
// ==========================================

function addToCart(item) {
    const existing = cart.find(i => String(i.id) === String(item.id));
    if (existing) {
        existing.cantidad++;
    } else {
        // Usar precio con descuento si existe
        const precioFinal = (item.descuento && item.descuento > 0) ? item.descuento : item.precio;
        cart.push({ ...item, precio: precioFinal, precioOriginal: item.precio, cantidad: 1, id: String(item.id) });
    }
    saveCart();
    updateCartIcon();
    showToast(`Agregado: ${item.producto}`);
    closeProductModal();
}

function removeFromCart(id) {
    const index = cart.findIndex(i => String(i.id) === String(id));
    if (index > -1) {
        if (cart[index].cantidad > 1) {
            cart[index].cantidad--;
        } else {
            cart.splice(index, 1);
        }
        saveCart();
        updateCartIcon();
        renderCartItems();
    }
}

function updateCartIcon() {
    const count = cart.reduce((acc, item) => acc + item.cantidad, 0);
    document.getElementById('cart-count').innerText = count;
    const fab = document.getElementById('cart-fab');
    if (count > 0) {
        fab.classList.remove('hidden');
        fab.classList.add('animate-[popIn_0.3s_ease-out]');
        setTimeout(() => fab.classList.remove('animate-[popIn_0.3s_ease-out]'), 300);
    } else {
        fab.classList.add('hidden');
    }
}

function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total');
    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-20 flex flex-col items-center opacity-40">
                <i class="ph-duotone ph-shopping-bag text-5xl mb-3 text-rauda-leather"></i>
                <p class="font-serif italic text-rauda-dark">Tu selección está vacía.</p>
                <button onclick="closeCartModal()" class="mt-4 text-xs font-bold uppercase tracking-widest text-rauda-terracotta hover:underline">Ir al catálogo</button>
            </div>`;
        totalEl.innerText = "$0";
        return;
    }

    container.innerHTML = cart.map(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        return `
        <div class="flex gap-4 py-4 border-b border-rauda-leather/5">
            <div class="w-16 h-16 bg-gray-100 shrink-0 rounded-md overflow-hidden border border-rauda-leather/10">
                <img src="${item.imagen || 'https://via.placeholder.com/100'}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1">
                <h4 class="font-serif text-rauda-dark leading-tight mb-1">${item.producto}</h4>
                <div class="flex justify-between items-center">
                    <p class="text-xs font-sans text-rauda-leather/60 font-bold">$${item.precio.toLocaleString('es-AR')} x ${item.cantidad}</p>
                    <p class="text-sm font-serif text-rauda-dark font-bold">$${subtotal.toLocaleString('es-AR')}</p>
                </div>
            </div>
            <button onclick="removeFromCart('${item.id}')" class="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors self-center">
                <i class="ph-bold ph-trash"></i>
            </button>
        </div>
        `;
    }).join('');

    totalEl.innerText = "$" + total.toLocaleString('es-AR');
}

function selectPayment(method) {
    selectedPayment = method === 'efectivo' ? 'Efectivo' : 'Transferencia';
    const btnCash = document.getElementById('btn-pago-efectivo');
    const btnTransfer = document.getElementById('btn-pago-transferencia');

    const activeClasses = ['bg-rauda-terracotta', 'text-white', 'border-rauda-terracotta'];
    const inactiveClasses = ['bg-white', 'text-rauda-leather', 'border-rauda-leather/20'];

    if (method === 'efectivo') {
        btnCash.classList.add(...activeClasses);
        btnCash.classList.remove(...inactiveClasses);
        btnTransfer.classList.add(...inactiveClasses);
        btnTransfer.classList.remove(...activeClasses);
    } else {
        btnTransfer.classList.add(...activeClasses);
        btnTransfer.classList.remove(...inactiveClasses);
        btnCash.classList.add(...inactiveClasses);
        btnCash.classList.remove(...activeClasses);
    }
}

function sendOrderToWhatsapp() {
    if (cart.length === 0) return;
    
    let message = `¡Hola *${CONFIG.businessName}*!, deseo realizar el siguiente pedido:%0A%0A`;
    let total = 0;
    
    cart.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        message += `▪️ ${item.cantidad}x *${item.producto}* ($${subtotal.toLocaleString('es-AR')})%0A`;
    });
    
    message += `%0A────────────────%0A`;
    message += `*TOTAL ESTIMADO: $${total.toLocaleString('es-AR')}*%0A`;
    message += `%0A💳 *Forma de Pago:* ${selectedPayment}`;
    message += `%0A👤 *Nombre:* (Completar)`;
    message += `%0A📍 *Envío/Retiro:* (Completar)`;

    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${message}`, '_blank');
}

// ==========================================
// UTILIDADES (TOAST, MODALES)
// ==========================================

function showToast(msg) {
    const div = document.createElement('div');
    div.className = 'fixed top-6 left-1/2 -translate-x-1/2 bg-rauda-leather text-white px-6 py-3 rounded-full shadow-2xl z-[200] text-xs font-bold uppercase tracking-widest flex items-center gap-3 animate-[fadeInUp_0.3s_ease-out]';
    div.innerHTML = `<i class="ph-fill ph-check-circle text-rauda-terracotta text-lg"></i> ${msg}`;
    document.body.appendChild(div);
    setTimeout(() => {
        div.style.opacity = '0';
        div.style.transform = 'translate(-50%, -20px)';
        setTimeout(() => div.remove(), 300);
    }, 2500);
}

function openProductModal(item) {
    const imgUrl = item.imagen || 'https://via.placeholder.com/500';
    document.getElementById('modal-img').src = imgUrl;
    document.getElementById('modal-cat').innerText = item.categoria;
    document.getElementById('modal-title').innerText = item.producto;
    document.getElementById('modal-desc').innerText = item.descripcion || 'Sin descripción disponible.';
    
    // Lógica de precio con descuento en modal
    const priceEl = document.getElementById('modal-price');
    const hasDiscount = item.descuento && item.descuento > 0;
    
    if (hasDiscount) {
        priceEl.innerHTML = `
            <span class="text-rauda-dark/40 line-through text-lg mr-2">$${item.precio.toLocaleString('es-AR')}</span>
            <span class="text-red-600 font-bold">$${item.descuento.toLocaleString('es-AR')}</span>
        `;
    } else {
        priceEl.innerHTML = "$" + item.precio.toLocaleString('es-AR');
    }
    
    const btn = document.getElementById('modal-add-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = () => addToCart(item);

    const modal = document.getElementById('product-modal');
    const panel = document.getElementById('modal-panel');
    const backdrop = document.getElementById('modal-backdrop');

    modal.classList.remove('hidden');
    lockBodyScroll();
    
    panel.classList.add('transition-all', 'duration-500', 'ease-out-expo');

    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        panel.classList.remove('translate-y-full', 'md:opacity-0', 'md:translate-y-8', 'md:scale-95');
        panel.classList.add('translate-y-0', 'md:opacity-100', 'md:translate-y-0', 'md:scale-100');
    });
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    const panel = document.getElementById('modal-panel');
    const backdrop = document.getElementById('modal-backdrop');

    backdrop.classList.add('opacity-0');
    panel.classList.remove('translate-y-0', 'md:opacity-100', 'md:translate-y-0', 'md:scale-100');
    panel.classList.add('translate-y-full', 'md:opacity-0', 'md:translate-y-8', 'md:scale-95');
    
    setTimeout(() => { modal.classList.add('hidden'); unlockBodyScroll(); }, 450);
}

function openCartModal() {
    renderCartItems();
    const modal = document.getElementById('cart-modal');
    const panel = document.getElementById('cart-panel');
    const backdrop = document.getElementById('cart-backdrop');
    
    modal.classList.remove('hidden');
    lockBodyScroll();
    panel.classList.add('transition-all', 'duration-500', 'ease-out-expo');

    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        panel.classList.remove('translate-y-full', 'md:translate-x-full');
        panel.classList.add('translate-y-0', 'md:translate-x-0');
    });
}

function closeCartModal() {
    const modal = document.getElementById('cart-modal');
    const panel = document.getElementById('cart-panel');
    const backdrop = document.getElementById('cart-backdrop');

    backdrop.classList.add('opacity-0');
    panel.classList.remove('translate-y-0', 'md:translate-x-0');
    panel.classList.add('translate-y-full', 'md:translate-x-full');

    setTimeout(() => {
        modal.classList.add('hidden');
        unlockBodyScroll();
    }, 450);
}

function saveCart() { localStorage.setItem('rauda_cart', JSON.stringify(cart)); }
function loadCart() {
    const stored = localStorage.getItem('rauda_cart');
    if (stored) { cart = JSON.parse(stored); updateCartIcon(); }
}

function createFeaturedCardHtml(item) {
    const imgUrl = item.imagen || 'https://via.placeholder.com/800x600?text=Vino+Destacado';
    const priceFormatted = item.precio.toLocaleString('es-AR');
    // Escape seguro para JSON
    const itemJson = JSON.stringify(item).replace(/"/g, "&quot;");
    
    // Lógica de precio con descuento
    const hasDiscount = item.descuento && item.descuento > 0;
    const discountFormatted = hasDiscount ? item.descuento.toLocaleString('es-AR') : null;
    
    const priceHtml = hasDiscount 
        ? `<span class="text-white/50 line-through text-sm md:text-base mr-2">$${priceFormatted}</span>
           <span class="text-lg md:text-2xl font-display font-bold text-red-400">$${discountFormatted}</span>`
        : `<span class="text-lg md:text-2xl font-display font-bold text-white">$${priceFormatted}</span>`;

    return `
    <div class="w-full max-w-4xl mx-auto mb-8 md:mb-10 fade-in-up relative group cursor-pointer overflow-hidden rounded-sm shadow-xl hover:shadow-2xl transition-shadow duration-500" onclick="openProductModal(${itemJson})">
        
        <div class="flex flex-col md:flex-row h-auto md:h-[350px] lg:h-[380px] bg-[#1a1512]">
            
            <div class="w-full aspect-[4/5] md:aspect-auto md:h-full md:w-[40%] relative overflow-hidden shrink-0">
                <div class="absolute inset-0 bg-black/10 z-10 group-hover:bg-transparent transition-colors duration-700"></div>
                ${hasDiscount ? `<div class="absolute top-3 left-3 bg-red-700 text-white text-[10px] md:text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm shadow-lg z-20">En Oferta</div>` : ''}
                 <img src="${imgUrl}" 
                     class="w-full h-full object-contain md:object-cover transform transition-transform duration-[1.5s] ease-in-out group-hover:scale-105" 
                     alt="${item.producto}">
            </div>

            <div class="w-full md:w-[60%] p-5 md:p-6 lg:p-8 flex flex-col justify-center relative text-rauda-base">
                
                <div class="absolute top-2 right-2 opacity-5 pointer-events-none transition-all duration-500 group-hover:opacity-10">
                    <i class="ph-fill ph-wine text-5xl sm:text-6xl md:text-7xl"></i>
                </div>

                <div class="relative z-10 pr-0 md:pr-4">
                    
                    <div class="flex items-center gap-2 mb-2 md:mb-3">
                        <span class="h-[1px] w-4 md:w-6 bg-rauda-terracotta"></span>
                        <span class="text-rauda-terracotta text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase whitespace-nowrap">
                            VINO DE LA SEMANA
                        </span>
                        <span class="h-[1px] w-4 md:w-6 bg-rauda-terracotta"></span>
                    </div>

                    <h3 class="font-display text-xl sm:text-2xl md:text-3xl font-bold leading-tight mb-2 md:mb-3 group-hover:text-rauda-sand transition-colors">
                        ${item.producto}
                    </h3>

                    <p class="font-serif italic text-white/60 text-xs sm:text-sm mb-4 md:mb-5 line-clamp-3 leading-relaxed">
                        ${item.descripcion || "Una elección exclusiva seleccionada por su carácter único."}
                    </p>

                    <div class="flex items-center justify-between border-t border-white/10 pt-3 md:pt-4 mt-auto">
                        <div class="flex flex-col">
                            <span class="text-[9px] uppercase tracking-widest text-white/40 mb-0.5">${hasDiscount ? 'Precio Oferta' : 'Precio'}</span>
                            <div class="flex items-center">
                                ${priceHtml}
                            </div>
                        </div>
                        
                        <button class="group/btn flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white hover:text-rauda-terracotta transition-colors py-1 pl-3">
                            <span>Ver más</span>
                            <i class="ph-bold ph-arrow-right group-hover/btn:translate-x-1 transition-transform text-xs md:text-sm"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

// ==========================================
// DRAG TO SCROLL (Navegación arrastrable en PC)
// ==========================================
const navSlider = document.getElementById('nav-tabs');
let isDown = false;
let startX;
let scrollLeft;

navSlider.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.pageX - navSlider.offsetLeft;
    scrollLeft = navSlider.scrollLeft;
});

navSlider.addEventListener('mouseleave', () => {
    isDown = false;
});

navSlider.addEventListener('mouseup', () => {
    isDown = false;
});

navSlider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault(); // Evita la selección de texto o comportamiento por defecto
    const x = e.pageX - navSlider.offsetLeft;
    const walk = (x - startX) * 2; // Multiplicador de velocidad de arrastre
    navSlider.scrollLeft = scrollLeft - walk;
});



// ==========================================
// LÓGICA DEL BUSCADOR
// ==========================================

function openSearchModal() {
    const modal = document.getElementById('search-modal');
    const panel = document.getElementById('search-panel');
    const backdrop = document.getElementById('search-backdrop');
    const input = document.getElementById('search-input');
    
    input.value = '';
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-empty').classList.add('hidden');

    // Cambiamos a 'flex' para que se centre bien en PC
    modal.classList.remove('hidden');
    modal.classList.add('flex'); 
    lockBodyScroll(); 
    
    requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        
        // Animación combinada (Móvil: baja desde arriba | PC: aparece y hace zoom)
        panel.classList.remove('-translate-y-full', 'md:-translate-y-12', 'md:opacity-0', 'md:scale-95');
        panel.classList.add('translate-y-0', 'md:opacity-100', 'md:scale-100');
        
        setTimeout(() => input.focus(), 300); 
    });
}

function closeSearchModal() {
    const modal = document.getElementById('search-modal');
    const panel = document.getElementById('search-panel');
    const backdrop = document.getElementById('search-backdrop');

    backdrop.classList.add('opacity-0');
    
    panel.classList.remove('translate-y-0', 'md:opacity-100', 'md:scale-100');
    panel.classList.add('-translate-y-full', 'md:-translate-y-12', 'md:opacity-0', 'md:scale-95');
    
    setTimeout(() => { 
        modal.classList.add('hidden'); 
        modal.classList.remove('flex');
        unlockBodyScroll();
    }, 500);
}

function initMobileModalGestures() {
    const setupSwipeToClose = ({ modalId, panelId, backdropId, closeFn }) => {
        const modal = document.getElementById(modalId);
        const panel = document.getElementById(panelId);
        const backdrop = document.getElementById(backdropId);

        if (!modal || !panel || !backdrop) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        panel.addEventListener('touchstart', (e) => {
            if (window.innerWidth >= 768) return;
            if (modal.classList.contains('hidden')) return;

            const touch = e.touches[0];
            const rect = panel.getBoundingClientRect();
            const touchFromTop = touch.clientY - rect.top;

            // Solo habilitamos cierre por gesto desde la parte superior del modal
            if (touchFromTop > 300) return;

            startY = touch.clientY;
            currentY = startY;
            isDragging = true;

            panel.style.transition = 'none';
            backdrop.style.transition = 'none';
        }, { passive: true });

        panel.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            currentY = e.touches[0].clientY;
            const deltaY = Math.max(0, currentY - startY);

            if (deltaY <= 0) return;

            panel.style.transform = `translateY(${deltaY}px)`;
            backdrop.style.opacity = String(Math.max(0, 1 - deltaY / 220));
        }, { passive: true });

        const finishDrag = () => {
            if (!isDragging) return;

            const deltaY = Math.max(0, currentY - startY);
            isDragging = false;

            panel.style.transition = '';
            backdrop.style.transition = '';
            panel.style.transform = '';
            backdrop.style.opacity = '';

            if (deltaY > 110) {
                closeFn();
            }
        };

        panel.addEventListener('touchend', finishDrag, { passive: true });
        panel.addEventListener('touchcancel', finishDrag, { passive: true });
    };

    setupSwipeToClose({
        modalId: 'product-modal',
        panelId: 'modal-panel',
        backdropId: 'modal-backdrop',
        closeFn: closeProductModal
    });

    setupSwipeToClose({
        modalId: 'cart-modal',
        panelId: 'cart-panel',
        backdropId: 'cart-backdrop',
        closeFn: closeCartModal
    });

    setupSwipeToClose({
        modalId: 'search-modal',
        panelId: 'search-panel',
        backdropId: 'search-backdrop',
        closeFn: closeSearchModal
    });
}

// Diseño en formato lista unificado para Móviles y PC
function createSearchItemHtml(item, index) {
    const imgUrl = item.imagen || 'https://via.placeholder.com/400x500?text=Sin+Imagen';
    const priceFormatted = item.precio.toLocaleString('es-AR');
    // Escape seguro de comillas
    const itemJson = JSON.stringify(item).replace(/"/g, "&quot;");
    
    // Lógica de precio con descuento
    const hasDiscount = item.descuento && item.descuento > 0;
    const discountFormatted = hasDiscount ? item.descuento.toLocaleString('es-AR') : null;
    
    const priceHtml = hasDiscount 
        ? `<div class="flex flex-col items-end">
               <span class="font-sans text-rauda-dark/40 line-through text-[10px]">$${priceFormatted}</span>
               <span class="font-sans font-bold text-sm md:text-base text-red-600">$${discountFormatted}</span>
           </div>`
        : `<span class="font-sans font-bold text-sm md:text-base text-rauda-leather">$${priceFormatted}</span>`;

    // Al hacer clic: Cerramos el buscador y abrimos el producto con un leve retraso para fluidez
    const onClickLogic = `closeSearchModal(); setTimeout(() => openProductModal(${itemJson}), 100);`;

    return `
    <article class="group cursor-pointer relative" onclick='${onClickLogic}' style="animation: fadeInUp 0.4s ease-out ${index * 0.03}s backwards">
        
        <div class="flex items-center justify-between p-2 md:p-3 rounded-xl hover:bg-white active:bg-white transition-all border border-transparent hover:border-rauda-leather/10 active:border-rauda-leather/10 shadow-none hover:shadow-sm">
            
            <div class="flex items-center gap-3 md:gap-4 overflow-hidden">
                <div class="relative w-12 h-12 md:w-14 md:h-14 rounded-md overflow-hidden bg-gray-100 shrink-0 shadow-inner">
                    <img src="${imgUrl}" class="w-full h-full object-cover" alt="${item.producto}">
                    ${hasDiscount ? `<div class="absolute top-0 left-0 bg-red-600 text-white text-[6px] font-bold px-1 py-0.5">OFERTA</div>` : ''}
                </div>
                <div class="flex flex-col overflow-hidden pr-2">
                    <h3 class="font-serif text-sm md:text-base text-rauda-dark font-bold group-hover:text-rauda-terracotta truncate transition-colors">${item.producto}</h3>
                    <span class="text-[9px] md:text-[10px] uppercase tracking-widest text-rauda-dark/50 mt-0.5 md:mt-1 truncate">${item.categoria} ${item.tipoVino ? `• ${item.tipoVino}` : ''}</span>
                </div>
            </div>

            <div class="flex items-center gap-3 md:gap-5 pr-1 md:pr-2 shrink-0">
                ${priceHtml}
                <div class="w-7 h-7 md:w-8 md:h-8 rounded-full bg-rauda-leather/5 flex items-center justify-center text-rauda-leather group-hover:bg-rauda-terracotta group-hover:text-white transition-colors">
                    <i class="ph-bold ph-caret-right text-xs md:text-base"></i>
                </div>
            </div>

        </div>

    </article>
    `;
}

// Escuchar lo que escribe el usuario en tiempo real
document.getElementById('search-input').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const resultsContainer = document.getElementById('search-results');
    const emptyMessage = document.getElementById('search-empty');
    
    // Si borró todo, limpiamos la pantalla
    if (query.length === 0) {
        resultsContainer.innerHTML = '';
        emptyMessage.classList.add('hidden');
        return;
    }

    // Buscamos coincidencias
    const filteredItems = CATALOG.filter(item => 
        item.producto.toLowerCase().includes(query) || 
        item.categoria.toLowerCase().includes(query) ||
        (item.tipoVino && item.tipoVino.toLowerCase().includes(query))
    );

    if (filteredItems.length === 0) {
        resultsContainer.innerHTML = ''; // Limpiamos si no hay nada
        emptyMessage.classList.remove('hidden'); // Mostrar "No se encontraron"
    } else {
        emptyMessage.classList.add('hidden');
        
        resultsContainer.innerHTML = filteredItems.map((item, index) => createSearchItemHtml(item, index)).join('');
    }
});

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        // Filtramos para animar solo las que están entrando al viewport
        const intersectingEntries = entries.filter(entry => entry.isIntersecting);
        
        intersectingEntries.forEach((entry, index) => {
            // Efecto cascada: multiplicamos el index por un pequeño delay
            setTimeout(() => {
                entry.target.classList.remove('card-hidden');
                entry.target.classList.add('card-visible');
            }, index * 75); // 75ms de separación entre cada card que aparece
            
            // Dejamos de observar la card una vez que ya se mostró
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.1, // Se dispara cuando el 10% de la card es visible
        rootMargin: "0px 0px 50px 0px" // Carga un poquito antes de que el usuario llegue
    });

    // Asignamos el observador a todas las cards renderizadas
    document.querySelectorAll('.js-product-card').forEach(card => {
        observer.observe(card);
    });
}