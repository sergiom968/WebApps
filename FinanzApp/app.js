'use strict';
// ════════════════════════════════════════════
// CONFIGURACIÓN Y ESTADO GLOBAL
// ════════════════════════════════════════════
let SUPABASE_URL = localStorage.getItem('fin_sb_url') || '';
let SUPABASE_KEY = localStorage.getItem('fin_sb_key') || '';
let sb = null;          // Cliente Supabase (null en modo demo)
let isDemo = true;      // true = datos en memoria, false = Supabase

// Almacén local para el modo demo
let DS = { accounts:[], credit_cards:[], categories:[], transactions:[], budgets:[], savings_goals:[], debts:[], recurring_expenses:[] };



// Tipo de transacción activo en el modal
let curTxnType = 'expense';

// Factores para convertir cualquier frecuencia a mensual
const FREQ_FACTOR = { monthly:1, weekly:4.33, biweekly:2, yearly:1/12 };
const FREQ_LABEL  = { monthly:'Mensual', weekly:'Semanal', biweekly:'Quincenal', yearly:'Anual' };

// ════════════════════════════════════════════
// INICIALIZACIÓN
// ════════════════════════════════════════════

// Oculta el loader y muestra la app — se llama desde DOMContentLoaded y también como fallback
function showApp() {
  const shell  = document.getElementById('app-shell');
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.style.display   = 'none';
    loader.style.opacity   = '0';
    loader.style.visibility = 'hidden';
    loader.style.pointerEvents = 'none';
    loader.setAttribute('aria-hidden', 'true');
  }
  if (shell) {
    shell.style.display    = 'block';
    shell.style.visibility = 'visible';
  }
}

// Fallback: si en 4 segundos no se ha mostrado la app, la mostramos igual
setTimeout(showApp, 4000);

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Fechas por defecto en los campos date/month
    const hoy = new Date().toISOString().split('T')[0];
    const mes  = hoy.slice(0,7);
    ['txn-date','txn-tr-date','tr-date','pay-date','rec-next'].forEach(id => setV(id, hoy));
    ['f-month','bud-month'].forEach(id => setV(id, mes));

    // Fecha en el header del dashboard
    const de = document.getElementById('dash-date');
    if (de) de.textContent = new Date().toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

    // Intentar conectar Supabase si hay credenciales guardadas
    if (SUPABASE_URL && SUPABASE_KEY) {
      try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); isDemo = false; }
      catch(e) { console.warn('Supabase no disponible, modo demo:', e); }
    }

    // Cargar datos de demostración en memoria
    loadDemoData();

    // Mostrar banner si no hay Supabase configurado
    if (!SUPABASE_URL) document.getElementById('config-banner').style.display = 'block';
    // Pre-rellenar el modal de configuración con las credenciales guardadas
    if (SUPABASE_URL) setV('cfg-url', SUPABASE_URL);
    if (SUPABASE_KEY) setV('cfg-key', SUPABASE_KEY);

    // Inicializar widgets del dashboard
    try { initWidgets(); } catch(e) { console.warn('initWidgets error:', e); }

    // Ejecutar auto-cobros pendientes al arrancar (silencioso)
    setTimeout(() => { try { processAutoCharges({ silent: true }); } catch(e){} }, 800);

    // Inicializar iconos Lucide (con guard por si la librería no cargó)
    try { if(window.lucide) lucide.createIcons(); } catch(e) { console.warn('Lucide error:', e); }

    // Sincronizar control de modo oscuro en sidebar
    const savedDark = localStorage.getItem('fin_dark') || 'system';
    try { applyDarkMode(savedDark); } catch(e) {}

  } catch(e) {
    console.error('Error al inicializar FinanzApp:', e);
  } finally {
    // Siempre ocultar el loader y mostrar la app, sin importar errores
    showApp();
    try { go('dashboard'); } catch(e) { console.warn('go(dashboard) error:', e); }
  }
});

// ════════════════════════════════════════════
// DATOS DE DEMOSTRACIÓN
// ════════════════════════════════════════════
function loadDemoData() {
  // Categorías predeterminadas
  DS.categories = [
    {id:'c1',name:'Salario',type:'income',icon:'briefcase',color:'#22c55e'},
    {id:'c2',name:'Freelance',type:'income',icon:'laptop',color:'#16a34a'},
    {id:'c3',name:'Alimentación',type:'expense',icon:'utensils',color:'#f97316'},
    {id:'c4',name:'Transporte',type:'expense',icon:'car',color:'#3b82f6'},
    {id:'c5',name:'Entretenimiento',type:'expense',icon:'gamepad-2',color:'#ec4899'},
    {id:'c6',name:'Servicios',type:'expense',icon:'lightbulb',color:'#06b6d4'},
    {id:'c7',name:'Deudas',type:'expense',icon:'clipboard-list',color:'#dc2626'},
  ];
  // Cuentas bancarias
  DS.accounts = [
    {id:'a1',name:'Bancolombia',bank:'Bancolombia',type:'ahorros',balance:4500000,color:'#f97316',icon:'landmark'},
    {id:'a2',name:'Nequi',bank:'Nequi',type:'ahorros',balance:850000,color:'#8b5cf6',icon:'smartphone'},
    {id:'a3',name:'Efectivo',bank:'—',type:'efectivo',balance:200000,color:'#22c55e',icon:'banknote'},
  ];
  // Tarjetas de crédito — tres marcas distintas para probar logos
  DS.credit_cards = [
    {id:'cc1',name:'Nubank',bank:'Nubank',brand:'MasterCard',credit_limit:5000000,current_balance:1200000,closing_day:10,due_day:17,color:'#7c3aed'},
    {id:'cc2',name:'Davivienda',bank:'Davivienda',brand:'Visa',credit_limit:3000000,current_balance:800000,closing_day:2,due_day:10,color:'#ef4444'},
    {id:'cc3',name:'Amex Platinum',bank:'American Express',brand:'Amex',credit_limit:10000000,current_balance:3500000,closing_day:15,due_day:22,color:'#1a1f71'},
  ];
  // Helper fecha relativa
  const d = n => { const x=new Date(); x.setDate(x.getDate()-n); return x.toISOString().split('T')[0]; };
  // Transacciones de muestra
  DS.transactions = [
    {id:'t1',type:'income',amount:4500000,description:'Salario mensual',date:d(2),category_id:'c1',account_id:'a1'},
    {id:'t2',type:'expense',amount:350000,description:'Mercado semanal',date:d(1),category_id:'c3',account_id:'a1'},
    {id:'t3',type:'expense',amount:85000,description:'Netflix + Spotify',date:d(3),category_id:'c5',credit_card_id:'cc1'},
    {id:'t4',type:'expense',amount:200000,description:'Gasolina',date:d(4),category_id:'c4',account_id:'a1'},
    {id:'t5',type:'income',amount:800000,description:'Proyecto freelance',date:d(5),category_id:'c2',account_id:'a2'},
    {id:'t6',type:'transfer',amount:300000,description:'Ahorro mensual',date:d(0),account_id:'a1',transfer_to_id:'a2'},
    {id:'t7',type:'expense',amount:150000,description:'Restaurante',date:d(0),category_id:'c3',account_id:'a1'},
  ];
  // Helper próxima fecha de cobro
  // Helper: calcula la próxima fecha de cobro dado el día del mes (usa fecha local, no UTC)
  const nd = day => {
    const x = new Date();
    x.setDate(day);
    // Comparar solo por fecha local, ignorando la hora
    const today = new Date(); today.setHours(0,0,0,0);
    const xDay  = new Date(x.getFullYear(), x.getMonth(), x.getDate());
    if (xDay < today) x.setMonth(x.getMonth()+1);
    // Formato YYYY-MM-DD en fecha LOCAL (no UTC)
    const y = x.getFullYear();
    const m = String(x.getMonth()+1).padStart(2,'0');
    const d = String(x.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  };
  // Gastos recurrentes — con selector unificado (account_id o card_id)
  DS.recurring_expenses = [
    {id:'r1',name:'Netflix',amount:49900,frequency:'monthly',next_date:nd(15),icon:'tv',category_id:'c5',card_id:'cc1',auto_charge:true,active:true},
    {id:'r2',name:'Spotify',amount:17900,frequency:'monthly',next_date:nd(15),icon:'music',category_id:'c5',card_id:'cc1',auto_charge:true,active:true},
    {id:'r3',name:'Arriendo',amount:1200000,frequency:'monthly',next_date:nd(1),icon:'home',category_id:'c6',account_id:'a1',auto_charge:false,active:true},
    {id:'r4',name:'Internet',amount:89000,frequency:'monthly',next_date:nd(20),icon:'globe',category_id:'c6',account_id:'a1',auto_charge:false,active:true},
    {id:'r5',name:'Gimnasio',amount:85000,frequency:'monthly',next_date:nd(5),icon:'dumbbell',category_id:'c5',account_id:'a2',auto_charge:false,active:true},
  ];
  DS.debts = [
    {id:'d1',name:'Crédito consumo',creditor:'Bancolombia',type:'loan',total_amount:8000000,remaining_amount:5200000,interest_rate:18.5,monthly_payment:450000,status:'active'},
    {id:'d2',name:'Crédito celular',creditor:'Claro',type:'personal',total_amount:1800000,remaining_amount:900000,interest_rate:12,monthly_payment:150000,status:'active'},
  ];
  DS.savings_goals = [
    {id:'g1',name:'Fondo emergencia',target_amount:10000000,current_amount:4500000,icon:'shield',color:'#22c55e',status:'active'},
    {id:'g2',name:'Viaje a Europa',target_amount:15000000,current_amount:2000000,icon:'plane',color:'#3b82f6',status:'active'},
  ];
  DS.budgets = [
    {id:'b1',name:'Alimentación',category_id:'c3',amount:800000,period:'monthly'},
    {id:'b2',name:'Transporte',category_id:'c4',amount:400000,period:'monthly'},
    {id:'b3',name:'Entretenimiento',category_id:'c5',amount:200000,period:'monthly'},
  ];
}

// ════════════════════════════════════════════
// CAPA DE BASE DE DATOS
// En modo demo opera sobre DS (memoria).
// Con Supabase conectado opera sobre la BD real.
// ════════════════════════════════════════════
async function dbGet(t)       { if(isDemo)return DS[t]||[]; const{data,error}=await sb.from(t).select('*'); if(error){console.error('dbGet error:',t,error);return[];} return data; }
async function dbIns(t,rec)   { if(isDemo){const id=t[0]+Date.now();const it={id,...rec};DS[t].unshift(it);return{data:it,error:null};} const{data,error}=await sb.from(t).insert(rec).select().single();if(error)console.error('dbIns error:',t,error);return{data,error}; }
async function dbUpd(t,id,rec){ if(isDemo){const i=DS[t].findIndex(r=>r.id===id);if(i>-1)DS[t][i]={...DS[t][i],...rec};return{error:null};} const{error}=await sb.from(t).update(rec).eq('id',id);if(error)console.error('dbUpd error:',t,error);return{error}; }
async function dbDel(t,id)    { if(isDemo){DS[t]=DS[t].filter(r=>r.id!==id);return{error:null};} const{error}=await sb.from(t).delete().eq('id',id);if(error)console.error('dbDel error:',t,error);return{error}; }

// ════════════════════════════════════════════
// HELPER: LUCIDE SVG INLINE
// ════════════════════════════════════════════

// Genera un SVG inline de Lucide a partir del nombre del icono.
// Usa window.lucide.icons (disponible desde el CDN UMD).
function lucideSVG(name, size = 16, stroke = 1.5) {
  const icon = window.lucide?.icons?.[name];
  if (!icon) {
    const pascal = name ? name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^([a-z])/, (_, c) => c.toUpperCase()) : null;
    const pascalIcon = pascal && pascal !== name ? window.lucide?.icons?.[pascal] : null;
    if (pascalIcon) return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;flex-shrink:0">${pascalIcon.contents}</svg>`;
    if (name && /[\u{2600}-\u{27BF}\u{1F000}-\u{1FFFF}]/u.test(name)) return `<span style="font-size:${size}px;line-height:1;display:inline-block">${name}</span>`;
    return `<span style="display:inline-flex;width:${size}px;height:${size}px"></span>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;flex-shrink:0">${icon.contents}</svg>`;
}

// ════════════════════════════════════════════
// NAVEGACIÓN
// ════════════════════════════════════════════
function go(page) {
  // Ocultar todas las páginas
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Desactivar todos los nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('page-'+page);
  if (!el) return;
  el.classList.add('active');
  const ni = document.querySelector(`[data-page="${page}"]`);
  if (ni) ni.classList.add('active');
  // Scroll al tope del contenido principal
  const mc = document.querySelector('.main-content');
  if (mc) mc.scrollTop = 0;
  // Cerrar sidebar en móvil y sincronizar barra inferior
  closeSidebar();
  syncMobNav(page);
  // Ejecutar el cargador de datos de la página
  const loaders = { dashboard:loadDash, transactions:loadTxns, accounts:loadAccs,
    cards:loadCards, recurring:loadRec, budgets:loadBudgets, goals:loadGoals,
    debts:loadDebts, reports:loadReports, categories:loadCategories };
  if (loaders[page]) loaders[page]();
}

// Sincroniza el estado activo de la barra inferior con la página actual
function syncMobNav(page) {
  document.querySelectorAll('#mob-nav .mob-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

// ════════════════════════════════════════════
// FORMATO DE MONEDA (COP)
// Reglas: punto = separador de miles (1.000.000), coma = decimal (1.500,50)
// ════════════════════════════════════════════

function fmt(n) {
  const num = Number(n) || 0;
  const hasDec = num % 1 !== 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: hasDec ? 2 : 0,
    maximumFractionDigits: 2
  }).format(num);
}

// Formatea un money-input mientras el usuario escribe.
// Reglas:
//   - Solo dígitos, coma (,) y punto (.) son válidos
//   - Los puntos son SIEMPRE miles → se ignoran al leer, se reconstruyen al formatear
//   - La coma es el separador decimal (máx 1, máx 2 decimales)
//   - Mientras el usuario escribe la parte decimal (tras la coma) no se reformatea
function fmtInput(inp) {
  const raw = inp.value;

  // Separar en parte entera y decimal usando la COMA como delimitador
  const commaIdx = raw.lastIndexOf(',');
  const hasComma = commaIdx !== -1;

  // Parte entera: todo antes de la coma, quitando puntos de miles y cualquier otro char
  const rawInt = (hasComma ? raw.slice(0, commaIdx) : raw).replace(/[^\d]/g, '');
  // Parte decimal: todo después de la última coma, solo dígitos, máx 2
  const rawDec = hasComma ? raw.slice(commaIdx + 1).replace(/[^\d]/g, '').slice(0, 2) : null;

  if (!rawInt && rawDec === null) { inp.value = ''; return; }

  // Formatear entero con puntos de miles
  const intNum = rawInt ? parseInt(rawInt, 10) : 0;
  const intFmt = intNum.toLocaleString('es-CO');  // ej: "1.500.000"

  // Reconstruir valor
  if (hasComma) {
    // Preservar la coma y los decimales que se estén escribiendo
    inp.value = intFmt + ',' + rawDec;
  } else {
    inp.value = rawInt ? intFmt : '';
  }
}

// Lee el valor numérico de un money-input.
// Quita puntos de miles, convierte coma decimal a punto JS.
function getMoney(id) {
  const raw = getV(id);
  if (!raw) return 0;
  // Quitar puntos de miles, convertir coma decimal → punto
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

// Pone un valor numérico formateado en un money-input
function setMoney(id, n) {
  const el = document.getElementById(id);
  if (!el) return;
  const num = Number(n) || 0;
  if (!num) { el.value = ''; return; }
  const hasDec = num % 1 !== 0;
  el.value = hasDec
    ? num.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : num.toLocaleString('es-CO');
}

// ════════════════════════════════════════════
// ════════════════════════════════════════════
// LOGOS SVG DE MARCAS DE TARJETA
// ════════════════════════════════════════════

// SVGs de cada marca (simplificados pero reconocibles)
const BRAND_SVGS = {
  Visa: `<svg viewBox="0 0 80 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="26" rx="4" fill="#1A1F71"/>
    <text x="8" y="20" font-family="Arial,sans-serif" font-size="18" font-weight="900" font-style="italic" fill="white" letter-spacing="1">VISA</text>
  </svg>`,

  MasterCard: `<svg viewBox="0 0 60 38" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="19" r="15" fill="#EB001B"/>
    <circle cx="38" cy="19" r="15" fill="#F79E1B"/>
    <path d="M30 8.5a15 15 0 0 1 0 21A15 15 0 0 1 30 8.5z" fill="#FF5F00"/>
  </svg>`,

  Amex: `<svg viewBox="0 0 80 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="26" rx="4" fill="#2E77BC"/>
    <text x="6" y="19" font-family="Arial,sans-serif" font-size="11" font-weight="800" fill="white" letter-spacing="0.5">AMERICAN</text>
    <text x="6" y="25" font-family="Arial,sans-serif" font-size="8" font-weight="600" fill="white" letter-spacing="1.5">EXPRESS</text>
  </svg>`,

  Other: `<svg viewBox="0 0 80 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="26" rx="4" fill="#64748b"/>
    <rect x="8" y="9" width="20" height="8" rx="2" fill="white" opacity="0.8"/>
    <text x="34" y="18" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="white">CARD</text>
  </svg>`,
};

const BRAND_LABELS = { Visa:'Visa', MasterCard:'MasterCard', Amex:'American Express', Other:'Otra' };
const BRAND_KEYS   = ['Visa','MasterCard','Amex','Other'];

// Devuelve el SVG inline para usar donde se muestra la marca
function brandSVG(brand, w=48, h=30) {
  const svg = BRAND_SVGS[brand] || BRAND_SVGS.Other;
  return `<span style="display:inline-flex;align-items:center;width:${w}px;height:${h}px;flex-shrink:0">${svg}</span>`;
}

// Para usar en <option> de selects nativos (texto plano)
function brandIcon(brand) {
  if (brand==='Visa')       return 'Visa';
  if (brand==='MasterCard') return 'MC';
  if (brand==='Amex')       return 'Amex';
  return 'Tarjeta';
}

// Para usar en HTML (muestra SVG)
function brandLogo(brand, size) {
  const w = size==='sm' ? 36 : 48;
  const h = size==='sm' ? 22 : 28;
  return brandSVG(brand, w, h);
}

// ── Custom brand selector ──

// Inicializa o actualiza el selector visual de marca
function initBrandSel(selectedBrand) {
  const dropdown = document.getElementById('brand-sel-dropdown');
  if (!dropdown) return;
  dropdown.innerHTML = BRAND_KEYS.map(b => `
    <div class="brand-sel-option${b===selectedBrand?' selected':''}"
         onclick="pickBrand('${b}')">
      ${brandSVG(b, 48, 30)}
      <span>${BRAND_LABELS[b]}</span>
    </div>`).join('');
  updateBrandTrigger(selectedBrand);
}

function updateBrandTrigger(brand) {
  const logo  = document.getElementById('brand-sel-logo');
  const label = document.getElementById('brand-sel-label');
  const input = document.getElementById('card-brand');
  if (logo)  logo.innerHTML  = BRAND_SVGS[brand] || BRAND_SVGS.Other;
  if (label) label.textContent = BRAND_LABELS[brand] || brand;
  if (input) input.value = brand;
}

function toggleBrandSel() {
  const trigger  = document.getElementById('brand-sel-trigger');
  const dropdown = document.getElementById('brand-sel-dropdown');
  if (!trigger || !dropdown) return;
  const isOpen = dropdown.classList.contains('open');
  trigger.classList.toggle('open', !isOpen);
  dropdown.classList.toggle('open', !isOpen);
}

function pickBrand(brand) {
  updateBrandTrigger(brand);
  // Marcar selected en opciones
  document.querySelectorAll('#brand-sel-dropdown .brand-sel-option').forEach(o => {
    o.classList.toggle('selected', o.querySelector('span')?.textContent === BRAND_LABELS[brand]);
  });
  // Cerrar dropdown
  document.getElementById('brand-sel-trigger')?.classList.remove('open');
  document.getElementById('brand-sel-dropdown')?.classList.remove('open');
}

// Cerrar el dropdown si se hace click fuera
document.addEventListener('click', e => {
  if (!e.target.closest('#brand-selector')) {
    document.getElementById('brand-sel-trigger')?.classList.remove('open');
    document.getElementById('brand-sel-dropdown')?.classList.remove('open');
  }
  // Cerrar custom src selector
  if (!e.target.closest('.src-selector')) {
    document.querySelectorAll('.src-selector').forEach(s => s.classList.remove('open'));
  }
});

// ════════════════════════════════════════════
// ÍCONOS SVG PARA CUENTAS
// ════════════════════════════════════════════
const ACCOUNT_ICONS = {
  bank:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11"/></svg>`,
  savings:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.93V18h-2v-1.07C9.19 16.5 8 15.33 8 14c0-1.66 1.34-3 3-3h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1H8c0-1.66 1.34-3 3-3V6h2v1h1c1.66 0 3 1.34 3 3s-1.34 3-3 3h-2c-.55 0-1 .45-1 1s.45 1 1 1h2c.55 0 1-.45 1-1h2c0 1.66-1.34 3-3 3z"/></svg>`,
  wallet:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/><path d="M16 12h5v4h-5a2 2 0 1 1 0-4z"/></svg>`,
  cash:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>`,
  phone:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg>`,
  star:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  home:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
  piggy:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7 7 7 0 017-7m0 14v2m-4-2h8M5 10H3m4-5l-2-2m14 2l-1.5-1.5M12 7v4l2 2"/></svg>`,
  chart:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
  globe:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>`,
  diamond:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M6 3l4 6m8-6l-4 6"/></svg>`,
  shield:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
};

const ACCOUNT_ICON_LABELS = {
  bank:'Banco', savings:'Ahorros', wallet:'Billetera', cash:'Efectivo',
  phone:'Digital', star:'Premium', home:'Casa', piggy:'Alcancía',
  chart:'Inversión', globe:'Internacional', diamond:'Élite', shield:'Seguro',
};

// Renderiza el picker de íconos SVG para cuentas
function renderIconPicker(containerId, inputId, currentIcon) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  // Si no hay valor o es la clave vieja 'bank', usar emoji por defecto
  const cur = (currentIcon && currentIcon !== 'bank') ? currentIcon : '';
  const isRaw = cur.startsWith('<svg') || cur.startsWith('<SVG');
  const previewContent = isRaw ? cur : lucideSVG('landmark', 24);

  wrap.innerHTML = `
    <div style="margin-top:.25rem">
      <label style="font-size:.78rem;font-weight:600;color:#64748b;display:block;margin-bottom:.3rem">
        Pega un SVG (24×24) — o deja vacío para usar el ícono por defecto
      </label>
      <textarea id="${containerId}-svg-input"
        class="textarea textarea-bordered w-full"
        rows="3"
        placeholder='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">...</svg>'
        style="font-size:.72rem;font-family:monospace;resize:vertical"
        oninput="previewCustomIcon('${containerId}','${inputId}')">${isRaw ? cur : ''}</textarea>
      <div style="display:flex;align-items:center;gap:.75rem;margin-top:.5rem">
        <div id="${containerId}-preview"
          style="width:40px;height:40px;border-radius:10px;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;background:#f8fafc;font-size:1.4rem">
          ${previewContent}
        </div>
        <p style="font-size:.75rem;color:#94a3b8">Vista previa · Se usará el ícono por defecto si está vacío</p>
      </div>
    </div>
    <input type="hidden" id="${inputId}" value=""/>`;

  // Guardar valor sin escapar en el input oculto
  const inp = document.getElementById(inputId);
  if (inp) inp.value = isRaw ? cur : '';
}

// Preview en tiempo real del SVG pegado
function previewCustomIcon(containerId, inputId) {
  const ta  = document.getElementById(containerId+'-svg-input');
  const pre = document.getElementById(containerId+'-preview');
  const inp = document.getElementById(inputId);
  const raw = ta?.value?.trim() || '';

  if (!raw) {
    // Sin SVG → usar emoji por defecto
    if (pre) { pre.innerHTML = lucideSVG('landmark', 24); }
    if (inp) inp.value = '';
    return;
  }
  if (raw.startsWith('<svg') || raw.startsWith('<SVG')) {
    // SVG válido → previsualizar y guardar
    if (pre) { pre.textContent = ''; pre.innerHTML = raw; }
    if (inp) inp.value = raw;
  }
}

// Escapa HTML para atributos
function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Devuelve HTML para mostrar el ícono de una cuenta.
// Acepta: nombre de icono Lucide, SVG raw string, o vacío → landmark por defecto
function accIconSVG(key, size=24) {
  if (!key || key === 'bank') {
    return lucideSVG('landmark', size);
  }
  const isRaw = key.startsWith('<svg') || key.startsWith('<SVG');
  if (isRaw) {
    const sized = key.replace(/^(<svg\b)/, `$1 width="${size}" height="${size}" style="width:${size}px;height:${size}px"`);
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;flex-shrink:0;overflow:hidden">${sized}</span>`;
  }
  return lucideSVG(key, size);
}

// ════════════════════════════════════════════
// CUSTOM SELECT: CUENTA / TARJETA CON SVG
// Reemplaza el <select> nativo para mostrar íconos SVG en las opciones
// ════════════════════════════════════════════

// Construye y monta el selector custom en el contenedor indicado
// options: [ { value, label, subLabel, iconHtml, group? } ]
function renderSrcSelector(containerId, inputId, options, placeholder='— Selecciona —') {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const groups = {};
  options.forEach(o => {
    const g = o.group || '';
    if (!groups[g]) groups[g] = [];
    groups[g].push(o);
  });

  let html = `
    <div class="src-selector" id="${containerId}-sel">
      <div class="src-trigger" id="${containerId}-trigger" onclick="toggleSrcSel('${containerId}')">
        <div class="src-trigger-ico" id="${containerId}-ico"></div>
        <span class="src-trigger-txt placeholder" id="${containerId}-lbl">${placeholder}</span>
        <span class="src-arrow">▼</span>
      </div>
      <div class="src-dropdown" id="${containerId}-dd">`;

  Object.entries(groups).forEach(([groupName, opts]) => {
    if (groupName) html += `<div class="src-group-hdr">${groupName}</div>`;
    opts.forEach(o => {
      html += `<div class="src-option" data-val="${o.value}" onclick="pickSrc('${containerId}','${inputId}','${o.value}')">
        <div class="src-option-ico">${o.iconHtml}</div>
        <div><div>${o.label}</div>${o.subLabel?`<div class="src-option-sub">${o.subLabel}</div>`:''}</div>
      </div>`;
    });
  });

  html += `</div></div><input type="hidden" id="${inputId}" value=""/>`;
  wrap.innerHTML = html;
}

// Abre/cierra un src-selector
function toggleSrcSel(containerId) {
  const sel = document.getElementById(containerId+'-sel');
  if (!sel) return;
  const isOpen = sel.classList.contains('open');
  // Cerrar todos los demás
  document.querySelectorAll('.src-selector.open').forEach(s => s.classList.remove('open'));
  document.querySelectorAll('.src-trigger.open').forEach(t => t.classList.remove('open'));
  if (!isOpen) {
    sel.classList.add('open');
    document.getElementById(containerId+'-trigger')?.classList.add('open');
  }
}

// Selecciona una opción del src-selector
function pickSrc(containerId, inputId, value) {
  const dd  = document.getElementById(containerId+'-dd');
  const opt = dd?.querySelector(`[data-val="${value}"]`);
  if (!opt) return;
  // Actualizar hidden input
  const inp = document.getElementById(inputId);
  if (inp) inp.value = value;
  // Actualizar trigger
  const ico = document.getElementById(containerId+'-ico');
  const lbl = document.getElementById(containerId+'-lbl');
  if (ico) ico.innerHTML = opt.querySelector('.src-option-ico')?.innerHTML || '';
  if (lbl) { lbl.textContent = opt.querySelector('div > div:first-child')?.textContent || ''; lbl.classList.remove('placeholder'); }
  // Marcar selected
  dd.querySelectorAll('.src-option').forEach(o => o.classList.toggle('selected', o.dataset.val===value));
  // Cerrar
  document.getElementById(containerId+'-sel')?.classList.remove('open');
  document.getElementById(containerId+'-trigger')?.classList.remove('open');
  // Disparar cambio para que onchange handlers funcionen
  inp?.dispatchEvent(new Event('change'));
}

// Resetea un src-selector a su estado vacío
function resetSrcSel(containerId, inputId, placeholder='— Selecciona —') {
  const inp = document.getElementById(inputId);
  if (inp) inp.value = '';
  const ico = document.getElementById(containerId+'-ico');
  const lbl = document.getElementById(containerId+'-lbl');
  if (ico) ico.innerHTML = '';
  if (lbl) { lbl.textContent = placeholder; lbl.classList.add('placeholder'); }
  document.getElementById(containerId+'-dd')?.querySelectorAll('.src-option').forEach(o => o.classList.remove('selected'));
}

// Restaura un valor preexistente en el src-selector (para edición)
function restoreSrcSel(containerId, inputId, value) {
  if (!value) return;
  const inp = document.getElementById(inputId);
  if (inp) inp.value = value;
  const dd  = document.getElementById(containerId+'-dd');
  const opt = dd?.querySelector(`[data-val="${value}"]`);
  if (!opt) return;
  const ico = document.getElementById(containerId+'-ico');
  const lbl = document.getElementById(containerId+'-lbl');
  if (ico) ico.innerHTML = opt.querySelector('.src-option-ico')?.innerHTML || '';
  if (lbl) { lbl.textContent = opt.querySelector('div > div:first-child')?.textContent || ''; lbl.classList.remove('placeholder'); }
  dd.querySelectorAll('.src-option').forEach(o => o.classList.toggle('selected', o.dataset.val===value));
}

// ════════════════════════════════════════════
// SELECTOR CUSTOM CON ÍCONOS SVG (csel)
// Rellena un .csel-wrap con cuentas y/o tarjetas
// ════════════════════════════════════════════

// Construye la lista de opciones enriquecidas para cuentas y/o tarjetas
async function buildSrcOptions(type='both', rawId=false) {
  const opts = [];
  if (type==='both' || type==='accounts') {
    const accs = (await dbGet('accounts')).filter(a=>!a.archived);
    accs.forEach(a => {
      opts.push({
        value:    rawId ? a.id : `acc:${a.id}`,
        label:    a.name,
        subLabel: `${a.bank} · ${fmt(a.balance)}`,
        iconHtml: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:${a.color}22;color:${a.color}">${accIconSVG(a.icon, 22)}</span>`,
        group:    rawId ? '' : 'Cuentas',
      });
    });
  }
  if (type==='both' || type==='cards') {
    const cards = (await dbGet('credit_cards')).filter(c=>!c.archived);
    cards.forEach(c => {
      const svgRaw = BRAND_SVGS[c.brand] || BRAND_SVGS.Other;
      opts.push({
        value:    rawId ? c.id : `card:${c.id}`,
        label:    c.name,
        subLabel: `${c.bank} · Disponible: ${fmt((c.credit_limit||0)-(c.current_balance||0))}`,
        iconHtml: `<span style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${svgRaw}</span>`,
        group:    rawId ? '' : 'Tarjetas de crédito',
      });
    });
  }
  return opts;
}

// Renderiza un selector custom con íconos SVG en el contenedor indicado
function renderCsel(containerId, inputId, options, placeholder='— Selecciona —', onchangeFn=null) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.classList.add('csel-wrap');

  // Agrupar opciones
  const groups = {};
  options.forEach(o => {
    const g = o.group || '';
    if (!groups[g]) groups[g] = [];
    groups[g].push(o);
  });

  let ddHtml = '';
  Object.entries(groups).forEach(([gname, opts]) => {
    if (gname) ddHtml += `<div class="csel-optgroup-label">${gname}</div>`;
    opts.forEach(o => {
      ddHtml += `<div class="csel-option" data-val="${o.value}" data-label="${o.label.replace(/"/g,'&quot;')}"
        onclick="pickCsel('${containerId}','${inputId}','${o.value}',${onchangeFn?`'${onchangeFn}'`:'null'})">
        <div class="csel-icon">${o.iconHtml}</div>
        <div style="min-width:0">
          <div class="csel-option-label" style="font-size:.875rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.label}</div>
          ${o.subLabel?`<div style="font-size:.72rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.subLabel}</div>`:''}
        </div>
      </div>`;
    });
  });

  wrap.innerHTML = `
    <div class="csel-trigger" onclick="toggleCsel('${containerId}')">
      <div class="csel-icon" id="${containerId}-ico"></div>
      <span class="csel-label csel-placeholder" id="${containerId}-lbl">${placeholder}</span>
      <span class="csel-arrow">▼</span>
    </div>
    <div class="csel-dropdown">${ddHtml}</div>
    <input type="hidden" id="${inputId}" value=""/>`;
}

function toggleCsel(id) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  const isOpen = wrap.classList.contains('open');
  // Cerrar todos
  document.querySelectorAll('.csel-wrap.open').forEach(w => w.classList.remove('open'));
  if (!isOpen) wrap.classList.add('open');
}

function pickCsel(containerId, inputId, value, onchangeFn) {
  const wrap = document.getElementById(containerId);
  const inp  = document.getElementById(inputId);
  if (!wrap || !inp) return;
  inp.value = value;
  // Actualizar trigger
  const opt = wrap.querySelector(`.csel-option[data-val="${value}"]`);
  if (opt) {
    const ico  = document.getElementById(containerId+'-ico');
    const lbl  = document.getElementById(containerId+'-lbl');
    if (ico) ico.innerHTML = opt.querySelector('.csel-icon')?.innerHTML || '';
    if (lbl) { lbl.textContent = opt.dataset.label || opt.querySelector('.csel-option-label')?.textContent?.trim() || ''; lbl.classList.remove('csel-placeholder'); }
  }
  // Marcar selected
  wrap.querySelectorAll('.csel-option').forEach(o => o.classList.toggle('selected', o.dataset.val===value));
  wrap.classList.remove('open');
  // Disparar handler si se especificó
  if (onchangeFn && window[onchangeFn]) window[onchangeFn]();
  // Disparar evento change en el input oculto
  inp.dispatchEvent(new Event('change'));
}

function resetCsel(containerId, inputId, placeholder='— Selecciona —') {
  const inp = document.getElementById(inputId);
  if (inp) inp.value = '';
  const ico = document.getElementById(containerId+'-ico');
  const lbl = document.getElementById(containerId+'-lbl');
  if (ico) ico.innerHTML = '';
  if (lbl) { lbl.textContent = placeholder; lbl.classList.add('csel-placeholder'); }
  document.getElementById(containerId)?.querySelectorAll('.csel-option').forEach(o=>o.classList.remove('selected'));
}

function restoreCsel(containerId, inputId, value) {
  if (!value) return;
  const inp = document.getElementById(inputId);
  if (inp) inp.value = value;
  const wrap = document.getElementById(containerId);
  const opt  = wrap?.querySelector(`.csel-option[data-val="${value}"]`);
  if (!opt) return;
  const ico = document.getElementById(containerId+'-ico');
  const lbl = document.getElementById(containerId+'-lbl');
  if (ico) ico.innerHTML = opt.querySelector('.csel-icon')?.innerHTML || '';
  if (lbl) { lbl.textContent = opt.dataset.label || opt.querySelector('.csel-option-label')?.textContent?.trim() || ''; lbl.classList.remove('csel-placeholder'); }
  wrap.querySelectorAll('.csel-option').forEach(o=>o.classList.toggle('selected', o.dataset.val===value));
}

// Cerrar selectors custom al click fuera
document.addEventListener('click', e => {
  if (!e.target.closest('.csel-wrap')) {
    document.querySelectorAll('.csel-wrap.open').forEach(w=>w.classList.remove('open'));
  }
  if (!e.target.closest('#brand-selector')) {
    document.getElementById('brand-sel-trigger')?.classList.remove('open');
    document.getElementById('brand-sel-dropdown')?.classList.remove('open');
  }
});

// ════════════════════════════════════════════
async function loadDash() {
  const [accs, cards, txns, debts, goals, recs] = await Promise.all([
    dbGet('accounts'), dbGet('credit_cards'), dbGet('transactions'),
    dbGet('debts'), dbGet('savings_goals'), dbGet('recurring_expenses')
  ]);
  const now = new Date();
  const tm  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const mt  = txns.filter(t => t.date?.startsWith(tm));
  const inc = mt.filter(t => t.type==='income').reduce((s,t) => s+t.amount, 0);
  // Excluir pagos de TC de los gastos del mes (is_card_payment=true)
  const ccCat=localStorage.getItem('fin_cc_pay_cat');
  const exp = mt.filter(t => t.type==='expense' && !t.is_card_payment && t.category_id!==ccCat).reduce((s,t) => s+t.amount, 0);
  // Saldo disponible = total cuentas − deuda total de tarjetas
  const totAcc  = accs.filter(a=>!a.archived).reduce((s,a) => s+(a.balance||0), 0);
  const totDebt = cards.filter(c=>!c.archived).reduce((s,c) => s+(c.current_balance||0), 0);
  const saldoDisp = totAcc - totDebt;
  document.getElementById('dash-bal').textContent  = fmt(saldoDisp);
  document.getElementById('dash-inc').textContent  = fmt(inc);
  document.getElementById('dash-exp').textContent  = fmt(exp);
  document.getElementById('dash-net').textContent  = fmt(inc - exp);
  const recMon = recs.filter(r=>r.active!==false).reduce((s,r) => s+(r.amount*(FREQ_FACTOR[r.frequency]||1)), 0);
  const cats = await dbGet('categories');
  renderWContent('balances',     () => renderBalWidget(accs, cards));
  renderWContent('recurring',    () => renderRecPending(recs, debts, cats));
  renderWContent('transactions', () => renderRecentTxns(txns, cats, accs));
}

// Renderiza el contenido de un widget si existe en el grid
function renderWContent(wid, fn) {
  if (document.querySelector(`#dashboard-grid [data-widget="${wid}"]`)) fn();
}

// ── Widget de últimas transacciones ──
function renderRecentTxns(txns, cats, accs) {
  const el = document.getElementById('dash-rec-txns');
  if (!el) return;
  const recent = [...txns].sort((a,b)=>b.date>a.date?1:-1).slice(0,5);
  if (!recent.length) { el.innerHTML='<div class="empty-state"><div style="color:#8B8B8B;margin-bottom:.75rem">'+lucideSVG('clipboard-list', 36)+'</div><p>Sin transacciones aún</p></div>'; return; }
  el.innerHTML = recent.map(t => {
    const cat=cats.find(c=>c.id===t.category_id);
    const isInc=t.type==='income', isTr=t.type==='transfer';
    const amtColor=isTr?'#06b6d4':isInc?'#22c55e':'#ef4444';
    const txnIcon = isTr ? lucideSVG('🔁', 16) : cat?.icon ? lucideSVG(cat.icon, 16) : (isInc ? lucideSVG('arrow-up', 16) : lucideSVG('arrow-down', 16));
    return `<div class="txn-item">
      <div class="txn-icon" style="background:${isTr?'#e0f2fe':cat?.color?cat.color+'22':'#e2e8f0'};color:${isTr?'#0369a1':cat?.color||'#64748b'}">${txnIcon}</div>
      <div class="flex-1 min-w-0"><p style="font-weight:600;font-size:.85rem;color:#111">${t.description||'Transferencia'}</p><p style="color:#8B8B8B;font-size:.6875rem">${isTr?'Transferencia':cat?.name||'Sin categoría'} · ${fmtDate(t.date)}</p></div>
      <span style="font-weight:600;font-size:.875rem;color:${amtColor};flex-shrink:0">${isTr?'→':isInc?'+':'-'}${fmt(t.amount)}</span>
    </div>`;
  }).join('');
}

// ── Widget de gastos recurrentes pendientes ──
function renderRecPending(recs, debts=[], cats=[]) {
  const el = document.getElementById('dash-rec-pend');
  if (!el) return;
  const now    = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();
  const today  = new Date(todayY, todayM, todayD);
  const lim    = new Date(todayY, todayM, todayD + 15);

  const pending = recs
    .filter(r => r.active !== false && r.next_date)
    .filter(r => {
      const [y,m,d] = r.next_date.split('-').map(Number);
      return new Date(y, m-1, d) <= lim;
    })
    .sort((a,b) => a.next_date > b.next_date ? 1 : -1);

  const thisMth = `${todayY}-${String(todayM+1).padStart(2,'0')}`;
  const debtItems = debts
    .filter(d => d.direction !== 'owed' && d.status === 'active' && d.payment_day)
    .filter(d => d.last_paid_month !== thisMth)
    .map(d => {
      const pdThisMonth = new Date(todayY, todayM, d.payment_day);
      const pd = pdThisMonth;
      return { _isDebt:true, _debt:d, id:d.id, name:d.name,
        amount: d.monthly_payment || 0, icon:'clipboard-list', auto_charge:false,
        next_date: `${pd.getFullYear()}-${String(pd.getMonth()+1).padStart(2,'0')}-${String(d.payment_day).padStart(2,'0')}` };
    });

  const all = [...pending, ...debtItems].sort((a,b) => a.next_date > b.next_date ? 1 : -1);

  if (!all.length) {
    el.innerHTML='<div class="empty-state" style="padding:1.5rem"><div style="color:#8B8B8B;margin-bottom:.75rem">'+lucideSVG('check-circle', 32)+'</div><p>Sin cobros pendientes</p></div>';
    return;
  }
  el.innerHTML = all.map(r => {
    const [y,m,d] = r.next_date.split('-').map(Number);
    const rd  = new Date(y, m-1, d);
    const dl  = Math.round((rd - today) / 864e5);
    const overdue = dl < 0;
    const lbl = overdue ? `${Math.abs(dl)}d vencido` : dl === 0 ? 'Hoy' : dl === 1 ? 'Mañana' : `${dl} días`;
    const urgent = dl <= 1;
    const isDebt = !!r._isDebt;
    const badgeClass = overdue ? 'badge-warn' : urgent ? 'badge-danger' : 'badge-ok';
    const rCat = r.category_id && !isDebt ? cats.find(c=>c.id===r.category_id) : null;
    const recBg = isDebt ? '#fee2e222' : rCat?.color ? rCat.color+'22' : '#e2e8f0';
    const recCol = isDebt ? '#dc2626' : rCat?.color || '#64748b';
    return `<div class="pending-row" style="display:flex;align-items:center;gap:.75rem;padding:.625rem .75rem;border-radius:12px;transition:background .15s">
      <span style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${recBg};color:${recCol}">${lucideSVG(r.icon||'repeat', 16)}</span>
      <div style="flex:1;min-width:0">
        <p style="font-weight:600;font-size:.85rem;color:#111">${r.name}${isDebt?' <span style="font-size:.6rem;background:#f5f5f3;color:#8B8B8B;padding:1px 6px;border-radius:99px;font-weight:500">Deuda</span>':''}</p>
        <p style="font-size:.6875rem;color:#8B8B8B">${fmtDate(r.next_date)} ${r.auto_charge?'<span class="tr-badge">Auto</span>':''}</p>
      </div>
      <div style="text-align:right;flex-shrink:0;display:flex;align-items:center;gap:.5rem">
        <p style="font-weight:600;font-size:.875rem;color:#ef4444">${fmt(r.amount)}</p>
        <span class="freq-badge" style="${overdue?'background:#fef3c7;color:#b45309':urgent?'background:#fee2e2;color:#ef4444':'background:#f0fdf4;color:#16a34a'}">${lbl}</span>
      </div>
      ${!r.auto_charge ? `<button class="btn-pill-outline" style="padding:.3rem .6rem;font-size:.65rem" onclick="openVerifyPay('${r.id}',${isDebt})" title="Verificar y pagar">Pagar</button>` : ''}
    </div>`;
  }).join('');
}

// ── Widget de saldos (cuentas y tarjetas) ──
async function renderBalWidget(accs, cards) {
  const el = document.getElementById('dash-bal-w');
  if (!el) return;
  const accsV  = accs.filter(a => !a.archived);
  const cardsV = cards.filter(c => !c.archived);
  if(!accsV.length&&!cardsV.length){el.innerHTML='<div class="empty-state" style="padding:1rem"><p>Sin cuentas ni tarjetas activas</p></div>';return;}
  const tAcc   = accsV.reduce((s,a)=>s+(a.balance||0),0);
  const tDebt  = cardsV.reduce((s,c)=>s+(c.current_balance||0),0);
  const tLim   = cardsV.reduce((s,c)=>s+(c.credit_limit||0),0);
  const debts  = await dbGet('debts');
  const tDebts = debts.filter(d=>d.status==='active' && d.direction!=='owed').reduce((s,d)=>s+(d.remaining_amount||0),0);

  let html=`<div class="bal-grid">
    <div class="bal-item">
      <div class="bi-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg></div>
      <p class="bi-label">En cuentas</p>
      <p class="bi-value">${fmt(tAcc)}</p>
    </div>
    <div class="bal-item">
      <div class="bi-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
      <p class="bi-label">Deuda TC</p>
      <p class="bi-value">${fmt(tDebt)}</p>
    </div>
    <div class="bal-item">
      <div class="bi-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg></div>
      <p class="bi-label">Disponible</p>
      <p class="bi-value">${fmt(tLim-tDebt)}</p>
    </div>
    <div class="bal-item">
      <div class="bi-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
      <p class="bi-label">Deudas</p>
      <p class="bi-value">${fmt(tDebts)}</p>
    </div>
  </div>`;

  if(accsV.length){
    html+=`<p style="font-size:.625rem;font-weight:600;color:#8B8B8B;text-transform:uppercase;letter-spacing:.6px;margin:1rem 0 .5rem">Cuentas</p>`;
    html+=accsV.map(a=>`<div style="display:flex;align-items:center;gap:.75rem;padding:.5rem 0">
      <div style="width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${a.color}15;color:${a.color}">${accIconSVG(a.icon, 18)}</div>
      <div style="flex:1;min-width:0"><p style="font-weight:600;font-size:.85rem;color:#111">${a.name}</p><p style="font-size:.6875rem;color:#8B8B8B">${a.bank} · ${a.type==='ahorros'?'Ahorros':'Efectivo'}</p></div>
      <p style="font-weight:700;font-size:.9rem;color:#16a34a;flex-shrink:0">${fmt(a.balance)}</p>
    </div>`).join('');
  }
  if(cardsV.length){
    html+=`<p style="font-size:.625rem;font-weight:600;color:#8B8B8B;text-transform:uppercase;letter-spacing:.6px;margin:1rem 0 .5rem">Tarjetas</p>`;
    html+=cardsV.map(c=>{
      const used=c.credit_limit>0?(c.current_balance/c.credit_limit*100):0;
      return `<div style="padding:.5rem 0">
        <div style="display:flex;align-items:center;gap:.75rem;width:100%">
          <div style="width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${c.color}15">${brandLogo(c.brand,'sm')}</div>
          <div style="flex:1;min-width:0"><p style="font-weight:600;font-size:.85rem;color:#111">${c.name}</p><p style="font-size:.6875rem;color:#8B8B8B">${c.bank}</p></div>
          <div style="text-align:right;flex-shrink:0"><p style="font-weight:700;font-size:.9rem;color:#ef4444">${fmt(c.current_balance)}</p><p style="font-size:.65rem;color:#8B8B8B">de ${fmt(c.credit_limit)}</p></div>
        </div>
        <div class="prog-thin" style="width:100%;margin-top:.4rem"><div style="width:${Math.min(used,100)}%;background:#d97706" class="prog-thin-fill"></div></div>
      </div>`;
    }).join('');
  }
  const oweDebts = debts.filter(d=>d.status==='active' && d.direction!=='owed');
  if(oweDebts.length){
    html+=`<p style="font-size:.625rem;font-weight:600;color:#8B8B8B;text-transform:uppercase;letter-spacing:.6px;margin:1rem 0 .5rem">Deudas</p>`;
    html+=oweDebts.map(d=>{
      const pct=d.total_amount>0?Math.min((1-d.remaining_amount/d.total_amount)*100,100):0;
      return `<div style="padding:.5rem 0">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:.3rem">
          <div style="min-width:0"><p style="font-weight:600;font-size:.8rem;color:#111">${d.name}</p><p style="font-size:.65rem;color:#8B8B8B">${d.creditor||''}</p></div>
          <p style="font-weight:700;font-size:.85rem;color:#ef4444;flex-shrink:0">${fmt(d.remaining_amount)}</p>
        </div>
        <div class="prog-thin" style="width:100%"><div style="width:${pct}%;background:#d97706" class="prog-thin-fill"></div></div>
      </div>`;
    }).join('');
  }
  el.innerHTML = html;
}

// ════════════════════════════════════════════
// TRANSACCIONES
// ════════════════════════════════════════════
async function loadTxns() {
  const [txns, cats, accs] = await Promise.all([dbGet('transactions'),dbGet('categories'),dbGet('accounts')]);
  // Rellenar filtro de categorías (solo la primera vez)
  const fcat = document.getElementById('f-cat');
  if (fcat && fcat.options.length<=1) cats.forEach(c=>fcat.add(new Option(c.name,c.id)));
  // Aplicar filtros
  let filtered=[...txns].sort((a,b)=>b.date>a.date?1:-1);
  const ft=getV('f-type'),fm=getV('f-month'),fc=getV('f-cat');
  if(ft)filtered=filtered.filter(t=>t.type===ft);
  if(fm)filtered=filtered.filter(t=>t.date?.startsWith(fm));
  if(fc)filtered=filtered.filter(t=>t.category_id===fc);
  // Resumen
  const inc=filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const ccCat=localStorage.getItem('fin_cc_pay_cat');
  const exp=filtered.filter(t=>t.type==='expense'&&!t.is_card_payment&&t.category_id!==ccCat).reduce((s,t)=>s+t.amount,0);
  document.getElementById('txn-summary').innerHTML=`
    <div class="summary-stat"><p class="label" style="font-size:.7rem">Ingresos</p><p class="value text-success" style="font-size:clamp(.75rem,2.5vw,1.15rem);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fmt(inc)}</p></div>
    <div class="summary-stat"><p class="label" style="font-size:.7rem">Gastos</p><p class="value text-error" style="font-size:clamp(.75rem,2.5vw,1.15rem);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fmt(exp)}</p></div>
    <div class="summary-stat"><p class="label" style="font-size:.7rem">Balance</p><p class="value ${inc-exp>=0?'text-success':'text-error'}" style="font-size:clamp(.75rem,2.5vw,1.15rem);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fmt(inc-exp)}</p></div>`;
  const el=document.getElementById('txn-list');
  if(!filtered.length){el.innerHTML='<div class="empty-state"><div style="color:#94a3b8;margin-bottom:.5rem">'+lucideSVG('clipboard-list', 36)+'</div><p>Sin transacciones</p></div>';return;}
  // Agrupar por fecha
  const grp={};
  filtered.forEach(t=>{if(!grp[t.date])grp[t.date]=[];grp[t.date].push(t);});
  el.innerHTML=Object.keys(grp).sort().reverse().map(date=>`
    <div>
      <p class="date-group-hdr">${fmtDate(date)}</p>
      ${grp[date].map(t=>{
        const cat=cats.find(c=>c.id===t.category_id);
        const acc=accs.find(a=>a.id===t.account_id);
        const toAcc=t.type==='transfer'?accs.find(a=>a.id===t.transfer_to_id):null;
        const isInc=t.type==='income',isTr=t.type==='transfer';
        const color=isTr?'#06b6d4':isInc?'#22c55e':'#ef4444';
        const txnIcon2 = isTr ? lucideSVG('🔁', 16) : cat?.icon ? lucideSVG(cat.icon, 16) : (isInc ? lucideSVG('arrow-up', 16) : lucideSVG('arrow-down', 16));
        return `<div class="txn-item">
          <div class="txn-icon" style="background:${isTr?'#e0f2fe':cat?.color?cat.color+'22':'#e2e8f0'};color:${isTr?'#0369a1':cat?.color||'#64748b'}">${txnIcon2}</div>
          <div class="flex-1 min-w-0"><p style="font-weight:600;font-size:.875rem;color:#111">${t.description||'Transferencia'}</p>
            <p style="color:#8B8B8B;font-size:.75rem">${isTr?`${acc?.name||'?'} → ${toAcc?.name||'?'}`:cat?.name||'Sin categoría'}${acc&&!isTr?' · '+acc.name:''}${t.is_card_payment?'<span class="tr-badge ml-1">'+lucideSVG('credit-card', 10)+' Pago tarjeta</span>':''}</p></div>
          <div style="text-align:right;flex-shrink:0">
            <p style="font-weight:700;color:${color}">${isTr?'→':isInc?'+':'-'}${fmt(t.amount)}</p>
            <div style="display:flex;gap:4px;justify-content:flex-end;margin-top:2px">
              <button class="btn btn-ghost btn-xs" onclick="openTxnModal('${t.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="btn btn-ghost btn-xs text-error" onclick="confirmDel('transactions','${t.id}','la transacción')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

function clearF(){setV('f-type','');setV('f-cat','');const now=new Date();setV('f-month',`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);loadTxns();}

// ── Modal nueva/editar transacción ──
async function openTxnModal(id=null) {
  setV('txn-edit-id',id||'');
  document.getElementById('txn-title').textContent=id?'Editar transacción':'Nueva transacción';
  document.getElementById('txn-validation-alert')?.classList.remove('show');
  setV('txn-date',new Date().toISOString().split('T')[0]);
  setV('txn-desc','');setMoney('txn-amount',0);setV('txn-notes','');
  document.getElementById('txn-is-rec').checked=false;
  resetCsel('txn-src-csel','txn-src','— Selecciona cuenta o tarjeta —');
  document.getElementById('txn-rec-panel').style.display='none';
  setV('txn-rec-freq','monthly');setV('txn-rec-icon','🔁');
  setV('txn-rec-next',new Date().toISOString().split('T')[0]);
  setV('txn-tr-date',new Date().toISOString().split('T')[0]);

  // Mostrar el modal INMEDIATAMENTE para que no se perciba el delay
  document.getElementById('modal-txn').showModal();

  // Luego cargar datos en paralelo
  const [debts, , trOpts] = await Promise.all([
    dbGet('debts'),
    setTxnType('expense'),           // carga cats+cuentas del tipo por defecto
    buildSrcOptions('accounts', true) // para transferencias
  ]);

  const ds=document.getElementById('txn-debt-id');
  ds.innerHTML='<option value="">No aplicar a deuda</option>';
  debts.filter(d=>d.status==='active'&&d.direction!=='owed').forEach(d=>ds.add(new Option(`${d.name} (${fmt(d.remaining_amount)} pendiente)`,d.id)));

  renderCsel('txn-tr-from-csel','txn-tr-from', trOpts, '— Cuenta origen —');
  renderCsel('txn-tr-to-csel',  'txn-tr-to',   trOpts, '— Cuenta destino —');

  if(id){
    const all=await dbGet('transactions'),t=all.find(x=>x.id===id);
    if(t){
      await setTxnType(t.type);
      setV('txn-desc',t.description);setMoney('txn-amount',t.amount);setV('txn-date',t.date);setV('txn-notes',t.notes||'');
      if(t.type==='transfer'){
        if(t.account_id)     restoreCsel('txn-tr-from-csel','txn-tr-from',t.account_id);
        if(t.transfer_to_id) restoreCsel('txn-tr-to-csel','txn-tr-to',t.transfer_to_id);
        setV('txn-tr-date',t.date); setV('txn-tr-desc',t.description); setMoney('txn-tr-amt',t.amount);
      } else {
        document.getElementById('txn-cat').value=t.category_id||'';
        const srcVal=t.credit_card_id?`card:${t.credit_card_id}`:t.account_id?`acc:${t.account_id}`:'';
        if(srcVal) restoreCsel('txn-src-csel','txn-src',srcVal);
        if(t.debt_id) ds.value=t.debt_id;
      }
    }
  }
}

// Cambia el tipo de transacción: filtra categorías y fuentes según el tipo
async function setTxnType(type) {
  curTxnType=type;
  ['expense','income','transfer'].forEach(t=>document.getElementById('tab-'+t).classList.toggle('tab-active',t===type));
  document.getElementById('txn-normal').style.display   = type==='transfer'?'none':'grid';
  document.getElementById('txn-transfer').style.display = type==='transfer'?'grid':'none';
  // Panel recurrente solo en gastos
  const rw=document.getElementById('txn-rec-wrap');
  if(rw) rw.style.display=type==='expense'?'block':'none';
  // Panel deuda solo en gastos
  const dw=document.getElementById('txn-debt-wrap');
  if(dw) dw.style.display=type==='expense'?'block':'none';
  if(type!=='expense'){ document.getElementById('txn-is-rec').checked=false; document.getElementById('txn-rec-panel').style.display='none'; }

  // Filtrar categorías según el tipo (income → solo ingresos, expense → solo gastos)
  const cs = document.getElementById('txn-cat');
  if(cs && type!=='transfer') {
    const cats = await dbGet('categories');
    cs.innerHTML='<option value="">Sin categoría</option>';
    cats.filter(c=> type==='income' ? c.type==='income' : c.type==='expense')
        .forEach(c=>cs.add(new Option(`${c.icon} ${c.name}`,c.id)));
  }

  // Fuente de pago con íconos SVG — ingresos: solo cuentas; gastos: cuentas + tarjetas
  if (type !== 'transfer') {
    const prevVal = getV('txn-src');
    const opts = await buildSrcOptions(type === 'income' ? 'accounts' : 'both');
    renderCsel('txn-src-csel', 'txn-src', opts, '— Selecciona cuenta o tarjeta —', 'onTxnSrcChange');
    if (prevVal) restoreCsel('txn-src-csel', 'txn-src', prevVal);
  }
}

// Muestra/oculta el panel de configuración de recurrencia
function toggleRecPanel() {
  const on=document.getElementById('txn-is-rec').checked;
  document.getElementById('txn-rec-panel').style.display=on?'grid':'none';
  if(on){
    const td=getV('txn-date');if(td)setV('txn-rec-next',td);
    const isCard=getV('txn-src').startsWith('card:');
    const aw=document.getElementById('txn-rec-auto-wrap');if(aw)aw.style.display=isCard?'block':'none';
  }
}

// Reacciona al cambio del selector de fuente en el modal de transacción
function onTxnSrcChange() {
  const isCard=getV('txn-src').startsWith('card:');
  const aw=document.getElementById('txn-rec-auto-wrap');if(aw)aw.style.display=isCard?'block':'none';
  if(isCard){
    const ccCat=localStorage.getItem('fin_cc_pay_cat');
    const cs=document.getElementById('txn-cat');
    if(ccCat&&cs&&[...cs.options].some(o=>o.value===ccCat))cs.value=ccCat;
  }
}

// Guarda la transacción (nueva o edición)
async function saveTxn() {
  document.getElementById('txn-spin').style.display = '';
  if (curTxnType === 'transfer') {
    await doTransferFromModal();
  } else {
    const desc   = getV('txn-desc').trim();
    const amt    = getMoney('txn-amount');
    const date   = getV('txn-date');
    const catId  = getV('txn-cat');
    const src    = getV('txn-src');
    const accId  = src.startsWith('acc:')  ? src.slice(4) : null;
    const cardId = src.startsWith('card:') ? src.slice(5) : null;

    // ── Validación de campos obligatorios ──
    const errors = [];
    if (!desc)             errors.push('Descripción');
    if (!amt)              errors.push('Monto');
    if (!date)             errors.push('Fecha');
    if (!catId)            errors.push('Categoría');
    if (!accId && !cardId) errors.push('Cuenta o Tarjeta');

    if (errors.length) {
      // Mostrar alerta con lista de campos faltantes
      const alert = document.getElementById('txn-validation-alert');
      const list  = document.getElementById('txn-validation-list');
      list.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
      alert.classList.add('show');
      // Animar y resaltar los campos vacíos
      if (!catId) {
        const el = document.getElementById('txn-cat');
        if (el) { el.classList.remove('field-error'); void el.offsetWidth; el.classList.add('field-error'); setTimeout(()=>el.classList.remove('field-error'),2500); }
      }
      if (!accId && !cardId) {
        const el = document.querySelector('#txn-src-csel .csel-trigger');
        if (el) { el.classList.remove('error'); void el.offsetWidth; el.classList.add('error'); setTimeout(()=>el.classList.remove('error'),2500); }
      }
      // Scroll al tope del modal para que se vea la alerta
      document.querySelector('#modal-txn .modal-box')?.scrollTo({ top:0, behavior:'smooth' });
      document.getElementById('txn-spin').style.display = 'none';
      return;
    }
    // Ocultar alerta si existía de un intento anterior
    document.getElementById('txn-validation-alert').classList.remove('show');

    const isRec  = document.getElementById('txn-is-rec').checked && curTxnType === 'expense';
    const debtId = getV('txn-debt-id') || null;
    const eid    = getV('txn-edit-id');

    // ── Verificar límite de crédito si el gasto va a una tarjeta ──
    if (!isRec && !eid && cardId && curTxnType === 'expense') {
      const allCards = await dbGet('credit_cards');
      const card = allCards.find(c => c.id === cardId);
      if (card) {
        const disponible = (card.credit_limit || 0) - (card.current_balance || 0);
        if (amt > disponible) {
          const al = document.getElementById('txn-validation-alert');
          const li = document.getElementById('txn-validation-list');
          li.innerHTML = `<li>La tarjeta <b>${card.name}</b> no tiene cupo suficiente.<br>Disponible: <b>${fmt(disponible)}</b> · Intentas gastar: <b>${fmt(amt)}</b></li>`;
          al.classList.add('show');
          document.querySelector('#modal-txn .modal-box')?.scrollTo({top:0,behavior:'smooth'});
          document.getElementById('txn-spin').style.display = 'none';
          return;
        }
      }
    }

    if (isRec && !eid) {
      // ── MODO RECURRENTE: solo crear el registro, NO la transacción ──
      // El cobro ocurrirá en la next_date vía markRecPaid() o processAutoCharges().
      const nd   = getV('txn-rec-next') || date;
      const day  = nd ? new Date(nd + 'T12:00:00').getDate() : null;
      const auto = document.getElementById('txn-rec-auto').checked && !!cardId;
      const { error } = await dbIns('recurring_expenses', {
        name: desc, amount: amt,
        frequency:   getV('txn-rec-freq') || 'monthly', day,
        category_id: catId || null,
        account_id:  accId, card_id: cardId,
        icon:        getV('txn-rec-icon') || '🔁',
        next_date:   nd,
        auto_charge: auto, active: true
      });
      if (error) { toast('Error al crear recurrente', 'error'); }
      else       { toast(`Gasto recurrente creado — primer cobro: ${fmtDate(nd)}`, 'success'); }

    } else {
      // ── MODO NORMAL: guardar transacción y actualizar saldos ──
      const txnRec = {
        type: curTxnType, description: desc, amount: amt, date,
        category_id: catId || null,
        account_id: accId, credit_card_id: cardId,
        debt_id: debtId, notes: getV('txn-notes').trim() || null
      };

      if (eid) {
        // 1. Revertir el efecto de la transacción original en saldos
        await reverseTransaction(eid);
        // 2. Actualizar el registro
        const { error } = await dbUpd('transactions', eid, txnRec);
        if (error) { toast('Error al actualizar', 'error'); }
        else {
          // 3. Aplicar el nuevo efecto en saldos
          if (accId) {
            const allAccs = await dbGet('accounts');
            const acc = allAccs.find(a => a.id === accId);
            if (acc) await dbUpd('accounts', accId, { balance: (acc.balance||0) + (curTxnType==='income' ? amt : -amt) });
          }
          if (cardId && curTxnType === 'expense') {
            const allCards = await dbGet('credit_cards');
            const card = allCards.find(c => c.id === cardId);
            if (card) await dbUpd('credit_cards', cardId, { current_balance: (card.current_balance||0) + amt });
          }
          if (debtId) {
            const allDebts = await dbGet('debts');
            const debt = allDebts.find(d => d.id === debtId);
            if (debt) {
              const newRem = Math.max(0, (debt.remaining_amount||0) - amt);
              await dbUpd('debts', debtId, { remaining_amount: newRem, status: newRem <= 0 ? 'paid' : 'active' });
            }
          }
          toast('Actualizado ✓', 'success');
        }
      } else {
        const { error } = await dbIns('transactions', txnRec);
        if (error) {
          toast('Error al guardar', 'error');
        } else {
          toast('Guardado ✓', 'success');

          // Actualizar saldo de cuenta
          if (accId) {
            const allAccs = await dbGet('accounts');
            const acc = allAccs.find(a => a.id === accId);
            if (acc) {
              const newBal = (acc.balance || 0) + (curTxnType === 'income' ? amt : -amt);
              await dbUpd('accounts', accId, { balance: newBal });
            }
          }
          // Actualizar saldo de tarjeta (solo gastos)
          if (cardId && curTxnType === 'expense') {
            const allCards = await dbGet('credit_cards');
            const card = allCards.find(c => c.id === cardId);
            if (card) await dbUpd('credit_cards', cardId, { current_balance: (card.current_balance || 0) + amt });
          }
          // Reducir saldo de deuda si se enlazó
          if (debtId) {
            const allDebts = await dbGet('debts');
            const debt = allDebts.find(d => d.id === debtId);
            if (debt) {
              const newRem = Math.max(0, (debt.remaining_amount || 0) - amt);
              await dbUpd('debts', debtId, { remaining_amount: newRem, status: newRem <= 0 ? 'paid' : 'active' });
              toast(`Deuda "${debt.name}": ${fmt(newRem)} pendiente`, 'info');
            }
          }
        }
      }
    }
  }

  document.getElementById('txn-spin').style.display = 'none';
  document.getElementById('modal-txn').close();
  const cur = document.querySelector('.page.active')?.id?.replace('page-', '');
  if (cur === 'transactions') loadTxns();
  else if (cur === 'dashboard') loadDash();
}

// Ejecuta transferencia desde el modal de transacción (nueva o edición)
async function doTransferFromModal(){
  const amt=getMoney('txn-tr-amt'),from=getV('txn-tr-from'),to=getV('txn-tr-to'),date=getV('txn-tr-date'),desc=getV('txn-tr-desc')||'Transferencia';
  if(!amt||!from||!to||!date){toast('Completa los campos de transferencia','error');return;}
  if(from===to){toast('Las cuentas deben ser distintas','error');return;}
  const eid=getV('txn-edit-id');
  if(eid){
    // Revertir transferencia original, luego actualizar registro y aplicar nueva
    await reverseTransaction(eid);
    await dbUpd('transactions',eid,{type:'transfer',description:desc,amount:amt,date,account_id:from,transfer_to_id:to});
    await doTransferBalances(amt,from,to);
    toast('Transferencia actualizada ✓','success');
  } else {
    await doTransfer(amt,from,to,date,desc);
  }
}

// ════════════════════════════════════════════
// TRANSFERENCIAS
// ════════════════════════════════════════════
async function openTransferModal(){
  const opts = await buildSrcOptions('accounts', true);
  renderCsel('tr-from-csel','tr-from', opts, '— Cuenta origen —');
  renderCsel('tr-to-csel',  'tr-to',   opts, '— Cuenta destino —');
  setV('tr-desc','');setMoney('tr-amt',0);setV('tr-date',new Date().toISOString().split('T')[0]);
  document.getElementById('modal-transfer').showModal();
}

async function saveTransfer(){
  const amt=getMoney('tr-amt'),from=getV('tr-from'),to=getV('tr-to'),date=getV('tr-date'),desc=getV('tr-desc')||'Transferencia';
  if(!amt||!from||!to||!date){toast('Completa todos los campos','error');return;}
  if(from===to){toast('Las cuentas deben ser distintas','error');return;}
  await doTransfer(amt,from,to,date,desc);
  document.getElementById('modal-transfer').close();loadAccs();
}

// Solo ajusta saldos (sin insertar transacción)
async function doTransferBalances(amt,fromId,toId){
  const accs=await dbGet('accounts');
  const from=accs.find(a=>a.id===fromId),to=accs.find(a=>a.id===toId);
  if(from)await dbUpd('accounts',fromId,{balance:(from.balance||0)-amt});
  if(to)  await dbUpd('accounts',toId,  {balance:(to.balance  ||0)+amt});
}

// Lógica central de transferencia: registra y ajusta saldos
async function doTransfer(amt,fromId,toId,date,desc){
  await dbIns('transactions',{type:'transfer',description:desc,amount:amt,date,account_id:fromId,transfer_to_id:toId});
  await doTransferBalances(amt,fromId,toId);
  toast(`Transferido ${fmt(amt)} ✓`,'success');
}

// ════════════════════════════════════════════
// CUENTAS BANCARIAS
// ════════════════════════════════════════════
async function loadAccs(){
  const allAccs = await dbGet('accounts');
  const active  = allAccs.filter(a => !a.archived);
  const archived= allAccs.filter(a =>  a.archived);

  document.getElementById('accs-total').textContent = fmt(active.reduce((s,a)=>s+(a.balance||0),0));
  const grid = document.getElementById('accs-grid');
  if(!allAccs.length){ grid.innerHTML='<div class="empty-state col-span-3"><div style="color:#8B8B8B;margin-bottom:.5rem">'+lucideSVG('landmark', 36)+'</div><p>Sin cuentas</p></div>'; return; }

  const renderCard = (a, isArchived) => `
    <div class="account-card" style="${isArchived?'opacity:.55;border:2px dashed #e2e2de':''}">
      ${isArchived ? '<div class="section-label" style="display:flex;align-items:center;gap:.3rem">'+lucideSVG('archive', 12)+' Archivada</div>' : ''}
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-center justify-center" style="width:44px;height:44px;border-radius:12px;background:${a.color}22;color:${a.color};flex-shrink:0">${accIconSVG(a.icon, 26)}</div>
        <div class="flex gap-1">
          ${isArchived
            ? `<button class="btn btn-ghost btn-xs" onclick="unarchive('accounts','${a.id}')" title="Reactivar"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
               <button class="btn btn-ghost btn-xs text-error" onclick="confirmDel('accounts','${a.id}','la cuenta')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`
            : `<button class="btn btn-ghost btn-xs" onclick="openAccModal('${a.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
               <button class="btn btn-ghost btn-xs text-error" onclick="confirmDel('accounts','${a.id}','la cuenta')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`}
        </div>
      </div>
      <p class="font-bold" style="font-size:1rem;color:#111">${a.name}</p>
      <p class="text-xs" style="color:#8B8B8B;margin-bottom:.5rem">${a.bank} · ${a.type==='ahorros'?'Ahorros':'Efectivo'}</p>
      <p class="font-extrabold" style="font-size:1.4rem;color:${(a.balance||0)>=0?'#111':'#ef4444'}">${fmt(a.balance)}</p>
      <div style="width:100%;height:3px;border-radius:99px;background:${a.color};margin-top:.75rem"></div>
    </div>`;

  grid.innerHTML = active.map(a => renderCard(a, false)).join('');
  if (archived.length) {
    grid.innerHTML += `<div class="col-span-3" style="margin-top:1rem">
      <button onclick="toggleArchivedAccs()" id="btn-toggle-arch-accs" class="toggle-arch-btn" style="margin-bottom:.75rem">
        ${lucideSVG('archive', 14)}<span id="lbl-toggle-arch-accs">Mostrar archivadas (${archived.length})</span>
      </button>
      <div id="archived-accs-grid" style="display:none">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${archived.map(a=>renderCard(a,true)).join('')}</div>
      </div>
    </div>`;
  }
}

function toggleArchivedAccs() {
  const grid = document.getElementById('archived-accs-grid');
  const lbl  = document.getElementById('lbl-toggle-arch-accs');
  if (!grid) return;
  const visible = grid.style.display !== 'none';
  grid.style.display = visible ? 'none' : 'block';
  const count = grid.querySelectorAll('.account-card').length;
  lbl.textContent = visible ? `Mostrar archivadas (${count})` : `Ocultar archivadas (${count})`;
}

function openAccModal(id=null){
  setV('acc-edit-id',id||'');
  document.getElementById('acc-title').textContent=id?'Editar cuenta':'Nueva cuenta';
  if(!id){
    setV('acc-name','');setV('acc-bank','');setMoney('acc-bal',0);setV('acc-type','ahorros');
    document.getElementById('modal-acc').showModal();
    renderColorPicker('acc-color-picker','acc-color','#3b82f6');
    renderIconPicker('acc-icon-picker','acc-icon','');
  } else {
    dbGet('accounts').then(accs=>{
      const a=accs.find(x=>x.id===id);if(!a)return;
      setV('acc-name',a.name);setV('acc-bank',a.bank);setMoney('acc-bal',a.balance);setV('acc-type',a.type);
      document.getElementById('modal-acc').showModal();
      renderColorPicker('acc-color-picker','acc-color',a.color||'#3b82f6');
      renderIconPicker('acc-icon-picker','acc-icon',a.icon||'');
    });
  }
}

async function saveAcc(){
  const name=getV('acc-name').trim(),bank=getV('acc-bank').trim();
  if(!name||!bank){toast('Completa los campos requeridos','error');return;}
  const rec={name,bank,type:getV('acc-type'),balance:getMoney('acc-bal'),color:getV('acc-color'),icon:getV('acc-icon')||''};
  const eid=getV('acc-edit-id');
  if(eid){await dbUpd('accounts',eid,rec);toast('Cuenta actualizada ✓','success');}
  else{await dbIns('accounts',rec);toast('Cuenta creada ✓','success');}
  document.getElementById('modal-acc').close();loadAccs();
}

// ════════════════════════════════════════════
// TARJETAS DE CRÉDITO
// ════════════════════════════════════════════
async function loadCards(){
  const allCards = await dbGet('credit_cards');
  const active   = allCards.filter(c => !c.archived);
  const archived = allCards.filter(c =>  c.archived);

  const tl = active.reduce((s,c)=>s+(c.credit_limit||0),0);
  const td = active.reduce((s,c)=>s+(c.current_balance||0),0);
  document.getElementById('c-lim').textContent   = fmt(tl);
  document.getElementById('c-debt').textContent  = fmt(td);
  document.getElementById('c-avail').textContent = fmt(tl-td);

  const grid = document.getElementById('cards-grid');
  if(!allCards.length){ grid.innerHTML='<div class="empty-state col-span-2"><div style="color:#8B8B8B;margin-bottom:.5rem">'+lucideSVG('credit-card', 36)+'</div><p>Sin tarjetas</p></div>'; return; }

  const renderCard = (c, isArchived) => {
    const used  = c.credit_limit>0?(c.current_balance/c.credit_limit*100):0;
    const barC  = used>80?'#ef4444':used>60?'#f97316':'#22c55e';
    const opac  = isArchived ? 'opacity:.55;' : '';
    return `<div style="${opac}">
      ${isArchived ? '<div class="section-label" style="display:flex;align-items:center;gap:.3rem">'+lucideSVG('archive', 12)+' Archivada</div>' : ''}
      <div class="cc-visual" style="background:linear-gradient(135deg,${c.color},${c.color}bb)">
        <div class="flex justify-between items-start">
          <div><p style="font-size:.7rem;opacity:.7;font-weight:600;text-transform:uppercase">Tarjeta de crédito</p>
            <p style="font-weight:800;font-size:1.1rem;margin-top:.25rem">${c.name}</p>
            <p style="font-size:.75rem;opacity:.7">${c.bank}</p></div>
          ${brandLogo(c.brand)}
        </div>
        <div style="margin-top:1.25rem">
          <p style="font-size:.7rem;opacity:.7">Saldo actual</p>
          <p style="font-size:1.5rem;font-weight:800">${fmt(c.current_balance)}</p>
          <p style="font-size:.75rem;opacity:.7">Límite: ${fmt(c.credit_limit)}</p>
        </div>
      </div>
      <div class="cc-detail">
        <div class="flex justify-between" style="font-size:.8rem;margin-bottom:6px">
          <span style="color:#8B8B8B">Usado: ${used.toFixed(0)}%</span>
          <span style="color:#8B8B8B">Disponible: ${fmt(c.credit_limit-c.current_balance)}</span>
        </div>
        <div class="bp"><div class="bp-fill" style="width:${Math.min(used,100)}%;background:${barC}"></div></div>
        <div class="flex justify-between" style="margin-top:.75rem;font-size:.78rem;color:#8B8B8B">
          <span>Corte: día ${c.closing_day||'—'}</span><span>Pago: día ${c.due_day||'—'}</span>
        </div>
        <div class="flex gap-2" style="margin-top:.875rem">
          ${isArchived
            ? `<button class="btn btn-ghost btn-sm flex-1" onclick="unarchive('credit_cards','${c.id}')">${lucideSVG('rotate-ccw', 14)} Reactivar</button>`
            : `<button class="btn btn-primary btn-sm flex-1" onclick="openPayModal('${c.id}')" ${(c.current_balance||0)<=0?'disabled title="Sin deuda pendiente"':''}>${lucideSVG('credit-card', 14)} Pagar</button>`}
          <button class="btn btn-ghost btn-sm" onclick="openCardModal('${c.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-sm text-error" onclick="confirmDel('credit_cards','${c.id}','la tarjeta')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div>
      </div>
    </div>`;
  };

  grid.innerHTML = active.map(c => renderCard(c, false)).join('');
  if (archived.length) {
    grid.innerHTML += `<div class="col-span-2" style="margin-top:1rem">
      <button onclick="toggleArchivedCards()" id="btn-toggle-arch-cards" class="toggle-arch-btn" style="margin-bottom:.75rem">
        ${lucideSVG('archive', 14)}<span id="lbl-toggle-arch-cards">Mostrar archivadas (${archived.length})</span>
      </button>
      <div id="archived-cards-grid" style="display:none">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${archived.map(c=>renderCard(c,true)).join('')}</div>
      </div>
    </div>`;
  }
}

function toggleArchivedCards() {
  const grid = document.getElementById('archived-cards-grid');
  const lbl  = document.getElementById('lbl-toggle-arch-cards');
  if (!grid) return;
  const visible = grid.style.display !== 'none';
  grid.style.display = visible ? 'none' : 'block';
  const count = grid.querySelectorAll('.cc-visual').length;
  lbl.textContent = visible ? `Mostrar archivadas (${count})` : `Ocultar archivadas (${count})`;
}

function openCardModal(id=null){
  setV('card-edit-id',id||'');
  document.getElementById('card-title').textContent=id?'Editar tarjeta':'Nueva tarjeta';
  if(!id){
    ['card-name','card-bank','card-close','card-due'].forEach(f=>setV(f,''));
    setMoney('card-limit',0);setMoney('card-bal',0);
    document.getElementById('modal-card').showModal();
    renderColorPicker('card-color-picker','card-color','#7c3aed');
    initBrandSel('Visa');
  } else {
    dbGet('credit_cards').then(cards=>{
      const c=cards.find(x=>x.id===id);if(!c)return;
      setV('card-name',c.name);setV('card-bank',c.bank);
      setMoney('card-limit',c.credit_limit);setMoney('card-bal',c.current_balance);
      setV('card-close',c.closing_day);setV('card-due',c.due_day);
      document.getElementById('modal-card').showModal();
      renderColorPicker('card-color-picker','card-color',c.color||'#7c3aed');
      initBrandSel(c.brand||'Visa');
    });
  }
}

async function saveCard(){
  const name=getV('card-name').trim(),bank=getV('card-bank').trim();
  if(!name||!bank){toast('Completa los campos requeridos','error');return;}
  const rec={name,bank,brand:getV('card-brand'),credit_limit:getMoney('card-limit'),current_balance:getMoney('card-bal'),closing_day:parseInt(getV('card-close'))||null,due_day:parseInt(getV('card-due'))||null,color:getV('card-color')};
  const eid=getV('card-edit-id');
  if(eid){await dbUpd('credit_cards',eid,rec);toast('Tarjeta actualizada ✓','success');}
  else{await dbIns('credit_cards',rec);toast('Tarjeta creada ✓','success');}
  document.getElementById('modal-card').close();loadCards();
}

// ── Pago de tarjeta ──
async function openPayModal(cardId){
  const cards=await dbGet('credit_cards');
  const card=cards.find(c=>c.id===cardId);if(!card)return;
  setV('pay-card-id',cardId);setV('pay-card-name',`${card.name} (${card.brand})`);
  document.getElementById('pay-debt-lbl').textContent=fmt(card.current_balance);
  document.getElementById('pay-sug-lbl').textContent=fmt(card.current_balance);
  setMoney('pay-amt',card.current_balance||0);
  setV('pay-date',new Date().toISOString().split('T')[0]);
  const al=document.getElementById('pay-alert');if(al)al.style.display='none';
  // Selector de cuenta con íconos SVG (rawId=true — no necesita prefijo acc:)
  const accOpts = await buildSrcOptions('accounts', true);
  renderCsel('pay-acc-csel','pay-acc', accOpts, '— Selecciona una cuenta —');
  document.getElementById('modal-pay').showModal();
}

async function processPayment(){
  const cardId=getV('pay-card-id'),amt=getMoney('pay-amt'),date=getV('pay-date'),accId=getV('pay-acc');
  // Validación: todos los campos son obligatorios
  const errs=[];
  if(!amt)    errs.push('Monto a pagar');
  if(!date)   errs.push('Fecha');
  if(!accId)  errs.push('Cuenta desde la que se debita');
  if(errs.length){
    const al=document.getElementById('pay-alert');
    if(al){al.style.display='flex';al.querySelector('span.pay-err-list').textContent=errs.join(', ');}
    else toast(`Campos requeridos: ${errs.join(', ')}','error`);
    return;
  }
  // Obtener tarjeta y registrar transacción con credit_card_id para que reverseTransaction funcione
  const cards=await dbGet('credit_cards'),card=cards.find(c=>c.id===cardId);
  if(!card){toast('Tarjeta no encontrada','error');return;}
  const ccCat=localStorage.getItem('fin_cc_pay_cat');
  await dbIns('transactions',{
    type:'expense', description:`Pago TC: ${card.name}`,
    amount:amt, date,
    account_id:accId, credit_card_id:cardId,
    is_card_payment:true,
    category_id: ccCat||null
  });
  // Reducir saldo de la TC
  await dbUpd('credit_cards',cardId,{current_balance:Math.max(0,(card.current_balance||0)-amt)});
  // Reducir saldo de la cuenta
  const accs=await dbGet('accounts'),acc=accs.find(a=>a.id===accId);
  if(acc)await dbUpd('accounts',accId,{balance:(acc.balance||0)-amt});
  document.getElementById('modal-pay').close();
  toast(`Pago de ${fmt(amt)} registrado ✓`,'success');
  loadCards();
}

// ════════════════════════════════════════════
// CATEGORÍAS RÁPIDAS
// ════════════════════════════════════════════
function openQCat(origin='txn'){
  setV('qcat-origin',origin);setV('qcat-name','');  setV('qcat-icon','🏷️');setV('qcat-type','expense');
  document.getElementById('modal-qcat').showModal();
  renderColorPicker('qcat-color-picker','qcat-color','#8b5cf6');
}

async function saveQCat(){
  const name=getV('qcat-name').trim();
  if(!name){toast('Escribe el nombre','error');return;}
  const rec={name,type:getV('qcat-type'),icon:getV('qcat-icon')||'🏷️',color:getV('qcat-color')};
  const{data,error}=await dbIns('categories',rec);
  if(error){toast('Error','error');return;}
  toast(`"${name}" creada ✓`,'success');
  document.getElementById('modal-qcat').close();
  // Auto-seleccionar la nueva categoría en el selector de origen
  const origin=getV('qcat-origin');
  const selId=origin==='rec'?'rec-cat':'txn-cat';
  const sel=document.getElementById(selId);
  if(sel){const o=new Option(`${rec.icon} ${rec.name}`,data.id);sel.add(o);sel.value=data.id;}
}

// ════════════════════════════════════════════
// GASTOS RECURRENTES
// ════════════════════════════════════════════
async function loadRec(){
  const [recs,cats,accs,cards,debts]=await Promise.all([
    dbGet('recurring_expenses'),dbGet('categories'),dbGet('accounts'),dbGet('credit_cards'),dbGet('debts')
  ]);
  const active=recs.filter(r=>r.active!==false);

  // Crear entradas virtuales para deudas "yo debo" con día de pago configurado
  const now2=new Date();
  const thisMonth = `${now2.getFullYear()}-${String(now2.getMonth()+1).padStart(2,'0')}`;
  const debtRecs = debts
    .filter(d=>d.direction!=='owed' && d.status==='active' && d.payment_day)
    .filter(d=>d.last_paid_month !== thisMonth)   // ya pagado este mes → no mostrar
    .map(d=>{
      // Mostrar siempre la fecha del mes actual: si ya pasó = vencida, si no = próxima
      const pd = new Date(now2.getFullYear(), now2.getMonth(), d.payment_day);
      return {
        _isDebt:true, id:d.id, name:d.name,
        amount: d.monthly_payment || 0,   // cuota mensual configurada
        remaining: d.remaining_amount,
        category_id:d.capital_category_id, account_id:null, card_id:null,
        icon:'clipboard-list', frequency:'monthly', auto_charge:false, active:true,
        next_date:pd.toISOString().split('T')[0], _debt:d
      };
    });

  const allRecs = [...active, ...debtRecs];
  const mon=active.reduce((s,r)=>s+(r.amount*(FREQ_FACTOR[r.frequency]||1)),0);
  document.getElementById('rec-mon').textContent=fmt(mon);
  document.getElementById('rec-yr').textContent=fmt(mon*12);
  document.getElementById('rec-ct').textContent=active.length;

  const today = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate());
  const lim   = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate() + 15);
  const parseDateLocal = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
  const daysDiff = (a, b) => Math.round((a - b) / 864e5);
  const up=allRecs.filter(r=>r.next_date).filter(r=>{ const d=parseDateLocal(r.next_date); return d>=today&&d<=lim; }).sort((a,b)=>a.next_date>b.next_date?1:-1);
  const upBox=document.getElementById('rec-up-box');
  if(up.length){
    upBox.style.display='block';
    document.getElementById('rec-up-list').innerHTML=up.map(r=>{
      const dl=daysDiff(parseDateLocal(r.next_date), today);
      const lbl=dl<=0?'¡Hoy!':dl===1?'Mañana':`En ${dl} días`;
      const isDebt = r._isDebt;
      const rCat = r.category_id ? cats.find(c=>c.id===r.category_id) : null;
      const upBg = isDebt ? '#fee2e222' : rCat?.color ? rCat.color+'22' : '#e2e8f0';
      const upCol = isDebt ? '#dc2626' : rCat?.color || '#64748b';
      return `<div class="upcoming-item">
        <span style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${upBg};color:${upCol}">${lucideSVG(r.icon||'repeat', 16)}</span>
        <div style="flex:1"><b>${r.name}</b>${isDebt?' <span class="badge-premium red">DEUDA</span>':''} — ${fmt(isDebt?r.remaining:r.amount)} ${r.auto_charge?'<span class="tr-badge">Auto</span>':''}</div>
        <span style="color:#b45309;font-weight:600;font-size:.8rem">${lbl}</span>
        ${!r.auto_charge?`<button class="btn btn-xs btn-primary" onclick="openVerifyPay('${r.id}',${isDebt})">Verificar y pagar</button>`:''}
        ${!isDebt&&!r.auto_charge?`<button class="btn btn-xs btn-success ml-1" onclick="markRecPaid('${r.id}')">${lucideSVG('check', 12)}</button>`:''}
      </div>`;
    }).join('');
  } else upBox.style.display='none';
  const el=document.getElementById('rec-list');
  if(!recs.length && !debtRecs.length){el.innerHTML='<div class="empty-state"><div style="color:#94a3b8;margin-bottom:.5rem">'+lucideSVG('repeat', 36)+'</div><p>Sin gastos recurrentes</p></div>';return;}
  // Render debt entries first as cards in the list
  const debtHtml = debtRecs.map(dr => {
    const d = dr._debt;
    return `<div class="rec-card mb-3" style="border-left:3px solid #ef4444">
      <div class="flex justify-between items-start">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center shrink-0" style="width:44px;height:44px;border-radius:12px;background:#fee2e222">${lucideSVG('clipboard-list', 22)}</div>
          <div>
            <p class="font-bold" style="font-size:.95rem;color:#111">${dr.name} <span class="badge-premium red">DEUDA</span></p>
            <div class="flex gap-1 items-center flex-wrap" style="margin-top:3px">
              <span class="freq-badge">Mensual</span>
              <span style="font-size:.72rem;color:#8B8B8B">${lucideSVG('calendar', 12)} Día ${d.payment_day}</span>
              <span style="font-size:.72rem;color:#8B8B8B">Saldo: ${fmt(d.remaining_amount)}</span>
            </div>
          </div>
        </div>
        <p class="font-extrabold shrink-0" style="font-size:1.05rem;color:#ef4444">${fmt(dr.amount||0)}</p>
      </div>
      <div class="flex gap-1 justify-end flex-wrap" style="margin-top:.875rem">
        <button class="btn btn-success btn-xs" onclick="openVerifyPay('${dr.id}',true)">${lucideSVG('credit-card', 12)} Pagar cuota</button>
        <button class="btn btn-ghost btn-xs" onclick="openDebtModal('${dr.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>
    </div>`;
  }).join('');
  el.innerHTML = debtHtml;
  el.innerHTML += recs.map(r=>{
    const cat=cats.find(c=>c.id===r.category_id);
    // Resolver fuente de pago (cuenta o tarjeta) unificada
    const acc=accs.find(a=>a.id===r.account_id);
    const card=cards.find(c=>c.id===r.card_id);
    const isActive=r.active!==false;
    return `<div class="rec-card mb-3" style="${isActive?'':'opacity:.55;border-left:3px solid #8B8B8B'}">
      <div class="flex justify-between items-start">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center shrink-0" style="width:44px;height:44px;border-radius:12px;background:${cat?.color||'#8b5cf6'}22">${lucideSVG(r.icon||'repeat', 22)}</div>
          <div>
            <p class="font-bold" style="font-size:.95rem;color:#111">${r.name}</p>
            <div class="flex gap-1 items-center flex-wrap" style="margin-top:3px">
              <span class="freq-badge">${FREQ_LABEL[r.frequency]||r.frequency}</span>
              ${r.next_date?`<span style="font-size:.72rem;color:#8B8B8B">${lucideSVG('calendar', 12)} ${fmtDate(r.next_date)}</span>`:''}
              ${cat?`<span style="font-size:.72rem;color:#8B8B8B">${lucideSVG(cat.icon, 12)} ${cat.name}</span>`:''}
              ${acc?`<span style="font-size:.72rem;color:#8B8B8B">${lucideSVG('landmark', 12)} ${acc.name}</span>`:''}
              ${card?`<span style="font-size:.72rem;color:#8B8B8B">${brandLogo(card.brand,'sm')} ${card.name}</span>`:''}
              ${r.auto_charge?'<span class="tr-badge" style="display:inline-flex;align-items:center;gap:3px">'+lucideSVG('repeat', 10)+' Auto</span>':''}
              ${!isActive?'<span class="badge-premium gray">Pausado</span>':''}
            </div>
          </div>
        </div>
        <p class="font-extrabold shrink-0" style="font-size:1.05rem;color:#111">${fmt(r.amount)}</p>
      </div>
      <div class="flex gap-1 justify-end flex-wrap" style="margin-top:.875rem">
        ${isActive&&!r.auto_charge?`<button class="btn btn-success btn-xs" onclick="markRecPaid('${r.id}')">${lucideSVG('check', 12)} Registrar</button>`:''}
        ${isActive&&!r.auto_charge?`<button class="btn btn-primary btn-xs" onclick="openVerifyPay('${r.id}',false)">Verificar y pagar</button>`:''}
        <button class="btn btn-ghost btn-xs" onclick="toggleRec('${r.id}',${!isActive})">${isActive?lucideSVG('pause', 14):lucideSVG('play', 14)}</button>
        <button class="btn btn-ghost btn-xs" onclick="openRecModal('${r.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn btn-ghost btn-xs text-error" onclick="confirmDel('recurring_expenses','${r.id}','el recurrente')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </div>
    </div>`;
  }).join('');
}

// Marca un gasto recurrente como pagado y calcula la próxima fecha
async function markRecPaid(id, overrideAccId=null, overrideAmount=null){
  const recs=await dbGet('recurring_expenses'),r=recs.find(x=>x.id===id);if(!r)return;
  const accId  = overrideAccId  || r.account_id || null;
  const amount = overrideAmount || r.amount;
  // Fecha de la transacción = next_date configurada (no la fecha de hoy)
  const txnDate = r.next_date || new Date().toISOString().split('T')[0];
  await dbIns('transactions',{type:'expense',description:r.name,amount,date:txnDate,category_id:r.category_id||null,account_id:accId,credit_card_id:r.card_id||null});
  // Actualizar saldo de cuenta si tiene
  if(accId){
    const accs=await dbGet('accounts'),acc=accs.find(a=>a.id===accId);
    if(acc) await dbUpd('accounts',accId,{balance:(acc.balance||0)-amount});
  }
  const next=nextDate(r.next_date||new Date().toISOString().split('T')[0],r.frequency);
  await dbUpd('recurring_expenses',id,{next_date:next});
  toast(`"${r.name}" registrado ✓`,'success');
  if(document.getElementById('page-recurring').classList.contains('active'))loadRec();else loadDash();
}

// Abre el modal "Verificar y pagar" para un recurrente o deuda
async function openVerifyPay(id, isDebt) {
  setV('vp-rec-id',  isDebt ? '' : id);
  setV('vp-debt-id', isDebt ? id  : '');

  const body         = document.getElementById('vp-body');
  const capitalWrap  = document.getElementById('vp-capital-wrap');
  const interestSumm = document.getElementById('vp-interest-summary');

  if(isDebt){
    const debts = await dbGet('debts');
    const d = debts.find(x=>x.id===id);
    if(!d) return;
    const cuota = d.monthly_payment || 0;
    document.getElementById('vp-title').textContent = `Pago: ${d.name}`;
    body.innerHTML = `
      <div class="stat-card" style="padding:.75rem 1rem">
        <div style="display:flex;justify-content:space-between;margin-bottom:.5rem">
          <span style="color:#64748b;font-size:.85rem">Saldo pendiente</span>
          <span style="font-weight:700">${fmt(d.remaining_amount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:.5rem;border-top:1px solid #e2e8f0">
          <span style="color:#3b82f6;font-size:.85rem;font-weight:600">Cuota este mes</span>
          <div class="money-wrap" style="max-width:160px">
            <span class="money-prefix">$</span>
            <input id="vp-cuota-mes" type="text" inputmode="decimal" placeholder="0"
              class="money-input" oninput="fmtInput(this);recalcDebtInterest()"
              style="text-align:right"/>
          </div>
        </div>
        <p style="font-size:.72rem;color:#94a3b8;margin-top:4px">Cuota configurada: ${fmt(cuota)} · modifica solo si cambia este mes</p>
      </div>`;
    // Ocultar capital por ahora; se mostrará tras showModal
    capitalWrap.style.display = 'none';
    interestSumm.style.display = 'none';

    // Cuenta de origen
    const accOpts = await buildSrcOptions('accounts', true);
    renderCsel('vp-acc-csel','vp-acc-id', accOpts, '— Selecciona cuenta —');
    const defaultAcc = d.default_account_id || null;

    const modal = document.getElementById('modal-verify-pay');
    modal.showModal();
    requestAnimationFrame(() => {
      setMoney('vp-cuota-mes', cuota);   // prellenar cuota editable
      capitalWrap.style.display = 'block';
      interestSumm.style.display = 'block';
      setMoney('vp-capital', cuota);     // aporte capital = cuota por defecto
      recalcDebtInterest();
      if(defaultAcc) restoreCsel('vp-acc-csel','vp-acc-id', defaultAcc);
    });
    return; // ya llamamos showModal

  } else {
    const recs = await dbGet('recurring_expenses');
    const r = recs.find(x=>x.id===id);
    if(!r) return;
    document.getElementById('vp-title').textContent = `Verificar: ${r.name}`;
    body.innerHTML = `
      <div class="stat-card" style="padding:.75rem 1rem">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:#64748b;font-size:.85rem">Monto configurado</span>
          <span style="font-weight:700;font-size:1rem;color:#3b82f6">${fmt(r.amount)}</span>
        </div>
      </div>`;
    // Mostrar campo monto editable para recurrente
    capitalWrap.style.display = 'none';
    interestSumm.style.display = 'none';

    // Cuenta: pre-seleccionar la cuenta asociada al recurrente si existe
    const accOpts = await buildSrcOptions('accounts', true);
    renderCsel('vp-acc-csel','vp-acc-id', accOpts, '— Selecciona cuenta —');

    const modal2 = document.getElementById('modal-verify-pay');
    modal2.showModal();
    requestAnimationFrame(() => {
      // Mostrar campo monto editable
      capitalWrap.style.display = 'block';
      // Reusar el campo vp-capital como "monto a pagar" editable
      document.querySelector('#vp-capital-wrap label .label-text').textContent = 'Monto a pagar *';
      document.querySelector('#vp-capital-wrap .label-text-alt').textContent = 'Puedes modificar el monto real cobrado';
      interestSumm.style.display = 'none';
      setMoney('vp-capital', r.amount);
      if(r.account_id) restoreCsel('vp-acc-csel','vp-acc-id', r.account_id);
    });
    return;
  }
  document.getElementById('modal-verify-pay').showModal();
}

// Recalcula en tiempo real el interés = cuota_mes - aporte capital
function recalcDebtInterest(){
  const cuota   = getMoney('vp-cuota-mes') || 0;
  const capital = getMoney('vp-capital')   || 0;
  const interes = Math.max(0, cuota - capital);
  const el = document.getElementById('vp-interest-val');
  if(el) el.textContent = fmt(interes);
}

// Confirma el pago desde el modal "Verificar y pagar"
async function confirmVerifyPay(){
  const recId  = getV('vp-rec-id');
  const debtId = getV('vp-debt-id');
  const accId  = getV('vp-acc-id');
  if(!accId){ toast('Selecciona una cuenta de origen','error'); return; }
  const today = new Date().toISOString().split('T')[0];

  if(debtId){
    // Pago de deuda: generar 2 transacciones (interés + capital)
    const debts = await dbGet('debts');
    const d = debts.find(x=>x.id===debtId);
    if(!d) return;
    const capital  = getMoney('vp-capital') || 0;
    if(!capital){ toast('Ingresa el aporte a capital','error'); return; }
    const cuota    = getMoney('vp-cuota-mes') || d.monthly_payment || 0;
    const interest = Math.max(0, cuota - capital);
    const total    = cuota || capital;
    const accs     = await dbGet('accounts');
    const acc      = accs.find(a=>a.id===accId);
    if(acc && (acc.balance||0) < total){ toast('Saldo insuficiente en la cuenta','error'); return; }
    // Fecha = día de pago configurado en la deuda (mes actual)
    const now2 = new Date();
    const debtTxnDate = d.payment_day
      ? `${now2.getFullYear()}-${String(now2.getMonth()+1).padStart(2,'0')}-${String(d.payment_day).padStart(2,'0')}`
      : today;

    // Transacción 1: Interés (si hay)
    if(interest > 0){
      await dbIns('transactions',{type:'expense',description:`Interés: ${d.name}`,amount:interest,date:debtTxnDate,category_id:d.interest_category_id||null,account_id:accId});
    }
    // Transacción 2: Abono al capital
    await dbIns('transactions',{type:'expense',description:`Abono capital: ${d.name}`,amount:capital,date:debtTxnDate,category_id:d.capital_category_id||null,account_id:accId,debt_id:debtId});

    // Reducir saldo cuenta
    if(acc) await dbUpd('accounts',accId,{balance:(acc.balance||0)-total});
    // Reducir deuda solo por el capital abonado
    const newRem = Math.max(0, d.remaining_amount - capital);
    // Guardar mes en que se hizo el último pago para ocultar del widget hasta el mes siguiente
    const now3 = new Date();
    const lastPaidMonth = `${now3.getFullYear()}-${String(now3.getMonth()+1).padStart(2,'0')}`;
    await dbUpd('debts',debtId,{remaining_amount:newRem,status:newRem<=0?'paid':'active',last_paid_month:lastPaidMonth});
    toast(`Pago registrado: ${fmt(interest)} interés + ${fmt(capital)} capital`,'success');

  } else if(recId){
    // Pago de recurrente: usar monto editado y fecha configurada
    const recs2 = await dbGet('recurring_expenses');
    const r2 = recs2.find(x=>x.id===recId);
    if(!r2) return;
    const montoReal = getMoney('vp-capital') || r2.amount;
    await markRecPaid(recId, accId, montoReal);
  }

  document.getElementById('modal-verify-pay').close();
  loadRec();
  loadDebts();
}
function nextDate(current, freq) {
  const d = parseLocalDate(current);
  if (freq === 'weekly')   d.setDate(d.getDate() + 7);
  else if (freq === 'biweekly') d.setDate(d.getDate() + 14);
  else if (freq === 'yearly')   d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}
// Alias para uso en saveTxn
const calcNextRecDate = nextDate;
async function unarchive(table, id) {
  await dbUpd(table, id, { archived: false });
  toast('Reactivada ✓', 'success');
  if (table === 'accounts') loadAccs();
  else loadCards();
}

async function toggleRec(id,active){await dbUpd('recurring_expenses',id,{active});toast(active?'Activado':'Pausado','success');loadRec();}

// Reacciona al cambio de fuente de pago en el modal de recurrente
function onRecSrcChange(){
  const val=getV('rec-src');
  document.getElementById('rec-auto-row').style.display=val.startsWith('card:')?'block':'none';
  if(!val.startsWith('card:'))document.getElementById('rec-auto').checked=false;
}

// Abre el modal de gasto recurrente (nuevo o edición)
async function openRecModal(id=null){
  setV('rec-edit-id',id||'');
  document.getElementById('rec-title').textContent=id?'Editar recurrente':'Nuevo gasto recurrente';
  const cats=await dbGet('categories');
  const cs=document.getElementById('rec-cat');cs.innerHTML='<option value="">Sin categoría</option>';
  cats.filter(c=>c.type==='expense').forEach(c=>cs.add(new Option(`${c.icon} ${c.name}`,c.id)));
  // Selector unificado con íconos SVG
  const srcOpts = await buildSrcOptions('both');
  renderCsel('rec-src-csel','rec-src', srcOpts, '— Selecciona cuenta o tarjeta —', 'onRecSrcChange');
  if(!id){
    setV('rec-name','');setMoney('rec-amt',0);setV('rec-icon','🔁');setV('rec-freq','monthly');
    setV('rec-next',new Date().toISOString().split('T')[0]);
    document.getElementById('rec-active').checked=true;
    document.getElementById('rec-auto').checked=false;
    document.getElementById('rec-auto-row').style.display='none';
    resetCsel('rec-src-csel','rec-src','— Selecciona cuenta o tarjeta —');
  } else {
    const all=await dbGet('recurring_expenses'),r=all.find(x=>x.id===id);
    if(r){
      setV('rec-name',r.name);setMoney('rec-amt',r.amount);setV('rec-icon',r.icon||'🔁');
      setV('rec-freq',r.frequency||'monthly');setV('rec-next',r.next_date||'');
      cs.value=r.category_id||'';
      // Restaurar selector csel
      const srcVal = r.card_id ? `card:${r.card_id}` : r.account_id ? `acc:${r.account_id}` : '';
      if(srcVal) restoreCsel('rec-src-csel','rec-src', srcVal);
      document.getElementById('rec-active').checked=r.active!==false;
      document.getElementById('rec-auto').checked=r.auto_charge===true;
      document.getElementById('rec-auto-row').style.display=r.card_id?'block':'none';
    }
  }
  document.getElementById('modal-rec').showModal();
}

async function saveRec(){
  const name=getV('rec-name').trim(),amt=getMoney('rec-amt');
  if(!name||!amt){toast('Completa nombre y monto','error');return;}
  const nd=getV('rec-next');
  const day=nd?new Date(nd+'T12:00:00').getDate():null;
  const src=getV('rec-src');
  const accId=src.startsWith('acc:')?src.slice(4):null;
  const cardId=src.startsWith('card:')?src.slice(5):null;
  const rec={
    name, amount:amt,
    frequency: getV('rec-freq'),
    day,
    category_id: getV('rec-cat')||null,
    account_id:  accId,
    card_id:     cardId,
    icon:        getV('rec-icon')||'🔁',
    next_date:   nd||null,
    auto_charge: document.getElementById('rec-auto').checked && !!cardId,
    active:      document.getElementById('rec-active').checked
  };
  const eid=getV('rec-edit-id');
  if(eid){
    await dbUpd('recurring_expenses',eid,rec);
    toast('Recurrente actualizado ✓','success');
  } else {
    // Solo guarda el registro recurrente.
    // NO crea transacción: el cobro ocurrirá en la next_date configurada,
    // ya sea manualmente (botón "Registrar") o por processAutoCharges().
    await dbIns('recurring_expenses',rec);
    toast('Recurrente creado ✓ — se cobrará el '+fmtDate(nd),'success');
  }
  document.getElementById('modal-rec').close();
  loadRec();
}

// ════════════════════════════════════════════
// PRESUPUESTOS
// ════════════════════════════════════════════
async function loadBudgets(){
  const[buds,cats,txns]=await Promise.all([dbGet('budgets'),dbGet('categories'),dbGet('transactions')]);
  const now=new Date(),tm=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const el=document.getElementById('budgets-list');
  if(!buds.length){el.innerHTML='<div class="empty-state"><div style="color:#8B8B8B;margin-bottom:.5rem">'+lucideSVG('clipboard-list', 36)+'</div><p>Sin presupuestos</p></div>';return;}
  el.innerHTML=buds.map(b=>{
    const cat=cats.find(c=>c.id===b.category_id);
    const ccCat=localStorage.getItem('fin_cc_pay_cat');
    const spent=txns.filter(t=>t.type==='expense'&&t.date?.startsWith(tm)&&t.category_id!==ccCat&&(b.category_id?t.category_id===b.category_id:true)).reduce((s,t)=>s+t.amount,0);
    const pct=b.amount>0?Math.min(spent/b.amount*100,100):0,over=spent>b.amount;
    const barC=pct>90?'#ef4444':pct>70?'#f97316':'#22c55e';
    return`<div class="budget-card mb-3">
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center shrink-0" style="width:40px;height:40px;border-radius:12px;background:${cat?.color||'#6b7280'}22">${cat?.icon?lucideSVG(cat.icon, 20):lucideSVG('package', 20)}</div>
          <div><p class="font-bold" style="color:#111">${b.name}</p><p style="font-size:.75rem;color:#8B8B8B">${cat?.name||'General'}</p></div>
        </div>
        <div style="text-align:right">
          <p class="font-bold" style="font-size:1rem;color:${over?'#ef4444':'#111'}">${fmt(spent)} <span style="color:#8B8B8B;font-size:.8rem">/ ${fmt(b.amount)}</span></p>
          ${over?'<span class="badge-premium red">Excedido</span>':''}
        </div>
      </div>
      <div class="bp"><div class="bp-fill" style="width:${pct}%;background:${barC}"></div></div>
      <div class="flex justify-between items-center" style="margin-top:.5rem">
        <p style="font-size:.75rem;color:#8B8B8B">${pct.toFixed(0)}% · Resta ${fmt(Math.max(0,b.amount-spent))}</p>
        <div class="flex gap-1"><button class="btn btn-ghost btn-xs" onclick="openBudgetModal('${b.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-xs text-error" onclick="confirmDel('budgets','${b.id}','el presupuesto')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button></div>
      </div>
    </div>`;
  }).join('');
}

async function openBudgetModal(id=null){
  setV('bud-edit-id',id||'');
  const cats=await dbGet('categories');
  const cs=document.getElementById('bud-cat');cs.innerHTML='<option value="">General</option>';
  cats.filter(c=>c.type==='expense').forEach(c=>cs.add(new Option(`${c.icon} ${c.name}`,c.id)));
  const now=new Date();setV('bud-month',`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  if(!id){setV('bud-name','');setMoney('bud-amt',0);}
  else{const b=(await dbGet('budgets')).find(x=>x.id===id);if(b){setV('bud-name',b.name);setMoney('bud-amt',b.amount);cs.value=b.category_id||'';setV('bud-period',b.period);}}
  document.getElementById('modal-budget').showModal();
}

async function saveBudget(){
  const name=getV('bud-name').trim(),amt=getMoney('bud-amt');
  if(!name||!amt){toast('Completa los campos','error');return;}
  const mv=getV('bud-month');const[yr,mo]=mv?mv.split('-'):[null,null];
  const rec={name,amount:amt,category_id:getV('bud-cat')||null,period:getV('bud-period'),month:mo?parseInt(mo):null,year:yr?parseInt(yr):null};
  const eid=getV('bud-edit-id');
  if(eid){await dbUpd('budgets',eid,rec);toast('Presupuesto actualizado ✓','success');}
  else{await dbIns('budgets',rec);toast('Presupuesto creado ✓','success');}
  document.getElementById('modal-budget').close();loadBudgets();
}

// ════════════════════════════════════════════
// METAS DE AHORRO
// ════════════════════════════════════════════
async function loadGoals(){
  const goals=await dbGet('savings_goals');
  const grid=document.getElementById('goals-grid');
  if(!goals.length){grid.innerHTML='<div class="empty-state col-span-3"><div style="color:#8B8B8B;margin-bottom:.5rem">'+lucideSVG('target', 36)+'</div><p>Sin metas</p></div>';return;}
  grid.innerHTML=goals.map(g=>{
    const pct=g.target_amount>0?Math.min(g.current_amount/g.target_amount*100,100):0;
    return`<div class="goal-card">
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-center justify-center shrink-0" style="width:48px;height:48px;border-radius:14px;background:${g.color}22;color:${g.color}">${lucideSVG(g.icon||'target', 24)}</div>
        <div class="flex gap-1"><button class="btn btn-ghost btn-xs" onclick="openGoalModal('${g.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-xs text-error" onclick="confirmDel('savings_goals','${g.id}','la meta')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button></div>
      </div>
      <p class="font-bold" style="font-size:1rem;color:#111">${g.name}</p>
      ${g.deadline?`<p style="font-size:.75rem;color:#8B8B8B;margin-bottom:.75rem">${lucideSVG('calendar', 14)} ${fmtDate(g.deadline)}</p>`:'<div style="margin-bottom:.75rem"></div>'}
      <div class="bp mb-2"><div class="bp-fill" style="width:${pct}%;background:${g.color}"></div></div>
      <div class="flex justify-between" style="font-size:.8rem"><span style="color:#8B8B8B">${fmt(g.current_amount)} ahorrado</span><span class="font-bold" style="color:${g.color}">${pct.toFixed(0)}%</span></div>
      <p style="font-size:.8rem;color:#8B8B8B;margin-top:4px">Meta: ${fmt(g.target_amount)} · Falta: ${fmt(Math.max(0,g.target_amount-g.current_amount))}</p>
    </div>`;
  }).join('');
}

async function openGoalModal(id=null){
  setV('goal-edit-id',id||'');
  document.getElementById('goal-title').textContent=id?'Editar meta':'Nueva meta';
  if(!id){
    setV('goal-name','');setMoney('goal-target',0);setMoney('goal-cur',0);setV('goal-dl','');setV('goal-icon','target');
    document.getElementById('modal-goal').showModal();
    renderColorPicker('goal-color-picker','goal-color','#22c55e');
  } else {
    const g=(await dbGet('savings_goals')).find(x=>x.id===id);
    if(g){
      setV('goal-name',g.name);setMoney('goal-target',g.target_amount);setMoney('goal-cur',g.current_amount);
      setV('goal-dl',g.deadline||'');setV('goal-icon',g.icon);
      document.getElementById('modal-goal').showModal();
      renderColorPicker('goal-color-picker','goal-color',g.color||'#22c55e');
    }
  }
}

async function saveGoal(){
  const name=getV('goal-name').trim(),target=getMoney('goal-target');
  if(!name||!target){toast('Completa los campos','error');return;}
  const cur=getMoney('goal-cur');
  const rec={name,target_amount:target,current_amount:cur,deadline:getV('goal-dl')||null,icon:getV('goal-icon')||'target',color:getV('goal-color'),status:cur>=target?'completed':'active'};
  const eid=getV('goal-edit-id');
  if(eid){await dbUpd('savings_goals',eid,rec);toast('Meta actualizada ✓','success');}
  else{await dbIns('savings_goals',rec);toast('Meta creada ✓','success');}
  document.getElementById('modal-goal').close();loadGoals();
}

// ════════════════════════════════════════════
// DEUDAS
// ════════════════════════════════════════════
async function loadDebts(){
  const debts = await dbGet('debts');
  const showPaid = document.getElementById('debts-show-paid')?.checked;
  const owe  = debts.filter(d => d.direction !== 'owed');
  const owed = debts.filter(d => d.direction === 'owed');
  const activeOwe  = owe.filter(d => d.status === 'active');
  const activeOwed = owed.filter(d => d.status === 'active');
  document.getElementById('d-tot').textContent  = fmt(activeOwe.reduce((s,d)=>s+d.remaining_amount,0));
  const owedEl = document.getElementById('d-owed');
  if(owedEl) owedEl.textContent = fmt(activeOwed.reduce((s,d)=>s+d.remaining_amount,0));
  document.getElementById('d-mon').textContent  = fmt(activeOwe.reduce((s,d)=>s+(d.monthly_payment||0),0));
  document.getElementById('d-ct').textContent   = activeOwe.length + activeOwed.length;
  const visible = showPaid ? debts : debts.filter(d=>d.status==='active');
  const el = document.getElementById('debts-list');
  if(!visible.length){ el.innerHTML='<div class="empty-state"><div style="color:#8B8B8B;margin-bottom:.5rem">'+lucideSVG('arrow-down', 36)+'</div><p>Sin deudas</p></div>'; return; }
  const oweVisible  = visible.filter(d=>d.direction!=='owed');
  const owedVisible = visible.filter(d=>d.direction==='owed');
  const tl = {loan:'Préstamo',credit:'Crédito',personal:'Personal',mortgage:'Hipoteca',other:'Otro'};
  const renderDebt = (d) => {
    const pct = d.total_amount>0 ? Math.min((1-d.remaining_amount/d.total_amount)*100,100) : 0;
    const isPaid = d.status === 'paid';
    const isOwed = d.direction === 'owed';
    const accent = isPaid ? '#22c55e' : isOwed ? '#3b82f6' : '#ef4444';
    const editSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    const delSvg  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    return `<div class="rec-card mb-3" style="border-left:3px solid ${accent};${isPaid?'opacity:.65':''}">
      <div class="flex justify-between items-start" style="margin-bottom:.75rem">
        <div>
          <div class="flex items-center gap-1" style="margin-bottom:2px">
            <span class="badge-premium ${isOwed?'blue':'red'}">${isOwed?'ME DEBEN':'YO DEBO'}</span>
            ${isPaid?'<span class="badge-premium green">PAGADA</span>':''}
          </div>
          <p class="font-bold" style="font-size:1rem;color:#111">${d.name}</p>
          <p style="font-size:.8rem;color:#8B8B8B">${d.creditor}${d.type&&d.direction!=='owed'?' · '+(tl[d.type]||d.type):''}</p>
        </div>
        <div style="text-align:right">
          <p class="font-extrabold" style="font-size:1.1rem;color:${accent}">${fmt(d.remaining_amount)}</p>
          <p style="font-size:.75rem;color:#8B8B8B">de ${fmt(d.total_amount)}</p>
        </div>
      </div>
      <div class="bp mb-2"><div class="bp-fill" style="width:${pct}%;background:${isPaid?'#22c55e':isOwed?'#3b82f6':'#22c55e'}"></div></div>
      <div class="flex justify-between flex-wrap gap-1" style="font-size:.78rem;color:#8B8B8B">
        <span>Pagado: ${pct.toFixed(0)}%</span>
        ${d.monthly_payment?`<span>Cuota: ${fmt(d.monthly_payment)}</span>`:''}
        ${d.payment_day?`<span>Día de pago: ${d.payment_day}</span>`:''}
      </div>
      <div class="flex gap-1 justify-end" style="margin-top:.75rem">
        ${!isPaid && isOwed ? `<button class="btn btn-primary btn-xs" onclick="openOwedPayModal('${d.id}')">${lucideSVG('credit-card', 12)} Registrar cobro</button>` : ''}
        ${!isPaid && isOwed ? `<button class="btn btn-success btn-xs" onclick="markDebtPaid('${d.id}')">${lucideSVG('check', 12)} Cobrada</button>` : ''}
        ${!isPaid && !isOwed ? `<button class="btn btn-success btn-xs" onclick="markDebtPaid('${d.id}')">${lucideSVG('check', 12)} Pagada</button>` : ''}
        <button class="btn btn-ghost btn-xs" onclick="openDebtModal('${d.id}')">${editSvg}</button>
        <button class="btn btn-ghost btn-xs text-error" onclick="confirmDel('debts','${d.id}','la deuda')">${delSvg}</button>
      </div>
    </div>`;
  };
  let html2 = '';
  if(oweVisible.length){
    html2 += `<p class="section-label" style="color:#ef4444">YO DEBO</p>`;
    html2 += oweVisible.map(renderDebt).join('');
  }
  if(owedVisible.length){
    html2 += `<p class="section-label" style="color:#3b82f6;margin-top:${oweVisible.length?'1rem':0}">ME DEBEN</p>`;
    html2 += owedVisible.map(renderDebt).join('');
  }
  el.innerHTML = html2;
}

// Abre modal para registrar cobro parcial/total de deuda "me deben"
async function openOwedPayModal(id){
  const debts = await dbGet('debts');
  const d = debts.find(x=>x.id===id);
  if(!d) return;
  setV('owedpay-debt-id', id);
  setV('owedpay-name', d.name);
  document.getElementById('owedpay-remaining').textContent = fmt(d.remaining_amount);
  setMoney('owedpay-amount', d.remaining_amount); // prellenar con saldo total
  setV('owedpay-date', new Date().toISOString().split('T')[0]);
  setV('owedpay-notes', '');
  document.getElementById('owedpay-alert').style.display = 'none';
  const accOpts = await buildSrcOptions('accounts', true);
  renderCsel('owedpay-acc-csel','owedpay-acc-id', accOpts, '— Selecciona cuenta —');
  // Poblar categorías de ingreso
  const cats = await dbGet('categories');
  const catSel = document.getElementById('owedpay-cat');
  catSel.innerHTML = '<option value="">Sin categoría</option>';
  cats.filter(c=>c.type==='income').forEach(c=>catSel.add(new Option(`${c.icon} ${c.name}`,c.id)));
  // Pre-seleccionar cuenta configurada en la deuda
  const modal = document.getElementById('modal-owed-pay');
  modal.showModal();
  requestAnimationFrame(()=>{
    if(d.income_account_id) restoreCsel('owedpay-acc-csel','owedpay-acc-id', d.income_account_id);
    if(d.income_category_id) setV('owedpay-cat', d.income_category_id);
  });
}

// Confirma el cobro parcial/total de una deuda "me deben"
async function confirmOwedPay(){
  const id     = getV('owedpay-debt-id');
  const accId  = getV('owedpay-acc-id');
  const amount = getMoney('owedpay-amount');
  const date   = getV('owedpay-date');
  const alertEl = document.getElementById('owedpay-alert');
  if(!amount || !date || !accId){
    alertEl.style.display='block';
    alertEl.textContent='Completa todos los campos obligatorios.';
    return;
  }
  const debts = await dbGet('debts');
  const d = debts.find(x=>x.id===id);
  if(!d) return;
  if(amount > d.remaining_amount){
    alertEl.style.display='block';
    alertEl.textContent=`El monto (${fmt(amount)}) supera el saldo pendiente (${fmt(d.remaining_amount)}).`;
    return;
  }
  alertEl.style.display='none';
  // 1. Registrar transacción de ingreso
  const notes    = getV('owedpay-notes').trim();
  const catId    = getV('owedpay-cat') || null;
  await dbIns('transactions',{
    type:'income',
    description:`Cobro: ${d.name}`,
    amount, date,
    category_id: catId,
    account_id: accId,
    debt_id: id,
    notes: notes || null
  });
  // 2. Acreditar en cuenta
  const accs = await dbGet('accounts');
  const acc  = accs.find(a=>a.id===accId);
  if(acc) await dbUpd('accounts', accId, {balance:(acc.balance||0)+amount});
  // 3. Reducir saldo pendiente
  const newRem = Math.max(0, d.remaining_amount - amount);
  await dbUpd('debts', id, {remaining_amount:newRem, status:newRem<=0?'paid':'active'});
  document.getElementById('modal-owed-pay').close();
  toast(`Cobro de ${fmt(amount)} registrado ✓`, 'success');
  loadDebts();
  loadDash();
}

async function markDebtPaid(id){
  const debts=await dbGet('debts'), d=debts.find(x=>x.id===id);
  if(!d) return;
  if(d.direction==='owed' && d.income_account_id){
    await dbIns('transactions',{type:'income',description:`Cobro: ${d.name}`,amount:d.remaining_amount,date:new Date().toISOString().split('T')[0],category_id:d.income_category_id||null,account_id:d.income_account_id,notes:'Deuda cobrada'});
    const accs=await dbGet('accounts'),acc=accs.find(a=>a.id===d.income_account_id);
    if(acc) await dbUpd('accounts',d.income_account_id,{balance:(acc.balance||0)+d.remaining_amount});
    toast(`Ingreso de ${fmt(d.remaining_amount)} registrado ✓`,'success');
  }
  await dbUpd('debts',id,{status:'paid',remaining_amount:0});
  toast('¡Deuda pagada!','success');
  loadDebts();
}

function setDebtDir(dir){
  ['owe','owed'].forEach(d=>{document.getElementById(`dtab-${d}`)?.classList.toggle('tab-active',d===dir);});
  setV('debt-direction',dir);
  const isOwe=dir==='owe';
  document.getElementById('debt-owe-fields').style.display  = isOwe?'grid':'none';
  document.getElementById('debt-owed-fields').style.display = isOwe?'none':'grid';
  document.getElementById('debt-type-wrap').style.display   = isOwe?'':'none';
  const lbl=document.getElementById('debt-cred-lbl');
  if(lbl) lbl.textContent=isOwe?'Acreedor *':'Deudor *';
  const ph=document.getElementById('debt-cred');
  if(ph) ph.placeholder=isOwe?'Ej: Bancolombia':'Ej: Juan Pérez';
}

async function openDebtModal(id=null){
  setV('debt-edit-id',id||'');
  document.getElementById('debt-title').textContent=id?'Editar deuda':'Nueva deuda';
  const cats=await dbGet('categories');
  ['debt-cat-capital','debt-cat-interest'].forEach(selId=>{
    const sel=document.getElementById(selId);
    if(!sel) return;
    sel.innerHTML='<option value="">Sin categoría</option>';
    cats.filter(c=>c.type==='expense').forEach(c=>sel.add(new Option(`${c.icon} ${c.name}`,c.id)));
  });
  const selInc=document.getElementById('debt-cat-income');
  if(selInc){
    selInc.innerHTML='<option value="">Sin categoría</option>';
    cats.filter(c=>c.type==='income').forEach(c=>selInc.add(new Option(`${c.icon} ${c.name}`,c.id)));
  }
  const accOpts=await buildSrcOptions('accounts',true);
  renderCsel('debt-acc-csel','debt-acc-id',accOpts,'— Selecciona cuenta —');
  renderCsel('debt-defacc-csel','debt-default-acc-id',accOpts,'— Sin cuenta por defecto —');
  if(!id){
    ['debt-name','debt-cred','debt-notes','debt-day'].forEach(f=>setV(f,''));
    setMoney('debt-monthly-payment',0);
    setMoney('debt-total',0);setMoney('debt-rem',0);setV('debt-type','loan');
    setDebtDir('owe');
  } else {
    const ds=await dbGet('debts'),d=ds.find(x=>x.id===id);
    if(d){
      setDebtDir(d.direction||'owe');
      setV('debt-name',d.name);setV('debt-cred',d.creditor||'');setV('debt-type',d.type||'loan');
      setMoney('debt-total',d.total_amount);setMoney('debt-rem',d.remaining_amount);
      setV('debt-day',d.payment_day||'');
      setMoney('debt-monthly-payment', d.monthly_payment||0);
      setV('debt-notes',d.notes||'');
      if(d.capital_category_id) setV('debt-cat-capital',d.capital_category_id);
      if(d.interest_category_id) setV('debt-cat-interest',d.interest_category_id);
      if(d.income_account_id) restoreCsel('debt-acc-csel','debt-acc-id',d.income_account_id);
      if(d.income_category_id) setV('debt-cat-income',d.income_category_id);
      if(d.default_account_id) restoreCsel('debt-defacc-csel','debt-default-acc-id',d.default_account_id);
    }
  }
  document.getElementById('modal-debt').showModal();
}

async function saveDebt(){
  const name=getV('debt-name').trim(),cred=getV('debt-cred').trim();
  const total=getMoney('debt-total'),rem=getMoney('debt-rem');
  const dir=getV('debt-direction')||'owe';
  if(!name||!total){toast('Completa los campos requeridos','error');return;}
  if(dir==='owe'&&!cred){toast('Indica el acreedor','error');return;}
  const rec={
    name,creditor:cred,direction:dir,
    type:dir==='owe'?(getV('debt-type')||'loan'):null,
    total_amount:total,remaining_amount:rem,
    interest_rate:0,
    payment_day:dir==='owe'?(parseInt(getV('debt-day'))||null):null,
    capital_category_id:dir==='owe'?(getV('debt-cat-capital')||null):null,
    interest_category_id:dir==='owe'?(getV('debt-cat-interest')||null):null,
    income_account_id:dir==='owed'?(getV('debt-acc-id')||null):null,
    income_category_id:dir==='owed'?(getV('debt-cat-income')||null):null,
    monthly_payment:dir==='owe'?(getMoney('debt-monthly-payment')||0):0,
    default_account_id:dir==='owe'?(getV('debt-default-acc-id')||null):null,
    notes:getV('debt-notes').trim()||null,status:'active'
  };
  const eid=getV('debt-edit-id');
  if(eid){await dbUpd('debts',eid,rec);toast('Deuda actualizada ✓','success');}
  else{await dbIns('debts',rec);toast('Deuda registrada ✓','success');}
  document.getElementById('modal-debt').close();loadDebts();
}

// ════════════════════════════════════════════
// REPORTES
// ════════════════════════════════════════════
async function loadReports(){
  const[txns,cats]=await Promise.all([dbGet('transactions'),dbGet('categories')]);
  const ccCat=localStorage.getItem('fin_cc_pay_cat');
  const months=[],incs=[],exps=[];
  for(let i=11;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;months.push(d.toLocaleString('es-ES',{month:'short',year:'2-digit'}));const m=txns.filter(t=>t.date?.startsWith(k));incs.push(m.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));exps.push(m.filter(t=>t.type==='expense'&&!t.is_card_payment&&t.category_id!==ccCat).reduce((s,t)=>s+t.amount,0));}
  // Tabla resumen: 12 meses + fila de balance anual
  const totalInc = incs.reduce((s,v)=>s+v,0);
  const totalExp = exps.reduce((s,v)=>s+v,0);
  const totalNet = totalInc - totalExp;
  document.getElementById('report-tbl').innerHTML=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.875rem">
    <thead><tr style="border-bottom:2px solid #e2e8f0">
      <th style="text-align:left;padding:.625rem .75rem;font-weight:700;color:#8B8B8B;font-size:.75rem;text-transform:uppercase">Mes</th>
      <th style="text-align:right;padding:.625rem .75rem;font-weight:700;color:#8B8B8B;font-size:.75rem;text-transform:uppercase">Ingresos</th>
      <th style="text-align:right;padding:.625rem .75rem;font-weight:700;color:#8B8B8B;font-size:.75rem;text-transform:uppercase">Gastos</th>
      <th style="text-align:right;padding:.625rem .75rem;font-weight:700;color:#8B8B8B;font-size:.75rem;text-transform:uppercase">Balance</th>
    </tr></thead>
    <tbody>
      ${months.map((m,i)=>{const n=incs[i]-exps[i];return`<tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:.625rem .75rem;font-weight:600;color:#111">${m}</td>
        <td style="padding:.625rem .75rem;text-align:right;font-weight:600;color:#111">${fmt(incs[i])}</td>
        <td style="padding:.625rem .75rem;text-align:right;font-weight:600;color:#111">${fmt(exps[i])}</td>
        <td style="padding:.625rem .75rem;text-align:right;font-weight:700;color:#111">${fmt(n)}</td>
      </tr>`;}).join('')}
    </tbody>
    <tfoot><tr style="border-top:2px solid #111;background:#f5f5f322">
      <td style="padding:.75rem;font-weight:800;color:#111">Balance anual</td>
      <td style="padding:.75rem;text-align:right;font-weight:800;color:#111">${fmt(totalInc)}</td>
      <td style="padding:.75rem;text-align:right;font-weight:800;color:#111">${fmt(totalExp)}</td>
      <td style="padding:.75rem;text-align:right;font-weight:800;font-size:1rem;color:${totalNet>=0?'#16a34a':'#dc2626'}">${fmt(totalNet)}</td>
    </tr></tfoot>
  </table></div>`;
  // Gastos por categoría (mes seleccionado)
  const catInput=document.getElementById('report-cat-month');
  if(!catInput)return;
  if(!catInput.value){const n=new Date();catInput.value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;}
  const byCat={};let totalGastos=0;
  txns.filter(t=>t.type==='expense'&&t.category_id!==ccCat&&t.date?.startsWith(catInput.value)).forEach(t=>{
    const c=cats.find(x=>x.id===t.category_id);
    const n=c?.name||'Sin categoría',ico=c?.icon||'📦';
    if(!byCat[n])byCat[n]={total:0,icon:ico};
    byCat[n].total+=t.amount;totalGastos+=t.amount;
  });
  const rows=Object.entries(byCat).sort((a,b)=>b[1].total-a[1].total);
  document.getElementById('report-cat-tbl').innerHTML=!rows.length
    ?'<p style="text-align:center;color:#8B8B8B;padding:1rem 0">Sin gastos este mes</p>'
    :`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.875rem">
      <thead><tr style="border-bottom:2px solid #e2e8f0">
        <th style="text-align:left;padding:.625rem .75rem;font-weight:700;color:#8B8B8B;font-size:.75rem;text-transform:uppercase">Categoría</th>
        <th style="text-align:right;padding:.625rem .75rem;font-weight:700;color:#8B8B8B;font-size:.75rem;text-transform:uppercase">Total</th>
      </tr></thead>
      <tbody>${rows.map(([name,{total,icon}])=>`<tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:.625rem .75rem;font-weight:600;color:#111">${icon} ${name}</td>
        <td style="padding:.625rem .75rem;text-align:right;font-weight:600;color:#111">${fmt(total)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr style="border-top:2px solid #111;background:#f5f5f322">
        <td style="padding:.75rem;font-weight:800;color:#111">Total gastos</td>
        <td style="padding:.75rem;text-align:right;font-weight:800;color:#111">${fmt(totalGastos)}</td>
      </tr></tfoot>
    </table></div>`;
}

// ════════════════════════════════════════════
// SISTEMA DE WIDGETS ARRASTRABLES
// ════════════════════════════════════════════

// Catálogo completo de widgets disponibles
const WIDGETS = [
  { id:'balances',     label:'Saldos cuentas y tarjetas',   def:true },
  { id:'recurring',    label:'Recurrentes pendientes',       def:true },
  { id:'transactions', label:'Últimas transacciones',       def:true },
];

// Genera el HTML de cada widget (se usa al inicializar y al añadir)
function buildWidget(id){
  const w = {
    balances:`<div class="widget-container" data-widget="balances">
      <div class="widget-body">
        <div class="stat-card">
          <div class="widget-hdr">
            <span class="widget-hdr-title">Saldos</span>
            <div style="display:flex;gap:.5rem">
              <button class="widget-hdr-action" onclick="go('accounts')">Cuentas</button>
              <button class="widget-hdr-action" onclick="go('cards')">Tarjetas</button>
            </div>
          </div>
          <div id="dash-bal-w"><div class="empty-state" style="padding:1rem"><p>Cargando...</p></div></div>
        </div>
      </div>
    </div>`,
    recurring:`<div class="widget-container" data-widget="recurring">
      <div class="widget-body">
        <div class="stat-card">
          <div class="widget-hdr">
            <span class="widget-hdr-title">Recurrentes pendientes</span>
            <button class="widget-hdr-action" onclick="go('recurring')">Ver todos</button>
          </div>
          <div id="dash-rec-pend"><div class="empty-state" style="padding:1.5rem"><div style="color:#8B8B8B;margin-bottom:.75rem">${lucideSVG('check-circle', 32)}</div><p>Sin cobros próximos</p></div></div>
        </div>
      </div>
    </div>`,
    transactions:`<div class="widget-container" data-widget="transactions">
      <div class="widget-body">
        <div class="stat-card">
          <div class="widget-hdr">
            <span class="widget-hdr-title">Últimas transacciones</span>
            <button class="widget-hdr-action" onclick="go('transactions')">Ver todas</button>
          </div>
          <div id="dash-rec-txns"><div class="empty-state"><div style="color:#8B8B8B;margin-bottom:.75rem">${lucideSVG('clipboard-list', 36)}</div><p>Sin transacciones</p></div></div>
        </div>
      </div>
    </div>`,
  };
  return w[id]||'';
}

// Inicializa el grid de widgets desde localStorage o configuración por defecto
function initWidgets(){
  const grid=document.getElementById('dashboard-grid');
  if(!grid)return;
  const savedOrder     = JSON.parse(localStorage.getItem('fw_order')||'null');
  const savedVis       = JSON.parse(localStorage.getItem('fw_vis')||'null');
  const savedCollapsed = JSON.parse(localStorage.getItem('fw_collapsed')||'{}');
  const order   = savedOrder || WIDGETS.map(w=>w.id);
  const visible = savedVis   || Object.fromEntries(WIDGETS.map(w=>[w.id,w.def]));
  grid.innerHTML='';
  order.forEach(id=>{ if(visible[id]) grid.insertAdjacentHTML('beforeend',buildWidget(id)); });
  // Restaurar estado colapsado
  Object.entries(savedCollapsed).forEach(([id,col])=>{
    if(col){const w=grid.querySelector(`[data-widget="${id}"]`);if(w){w.classList.add('collapsed');const btn=w.querySelector('.widget-toggle-btn');if(btn)btn.textContent='▼';}}
  });
}

// Renderiza el contenido del catálogo (sin abrir/cerrar el modal)
function renderWCatalog(){
  const savedOrder = JSON.parse(localStorage.getItem('fw_order')||'null');
  const savedVis   = JSON.parse(localStorage.getItem('fw_vis')||'null');
  const order   = savedOrder || WIDGETS.map(w=>w.id);
  const vis     = savedVis   || Object.fromEntries(WIDGETS.map(w=>[w.id,w.def]));
  const labels  = Object.fromEntries(WIDGETS.map(w=>[w.id,w.label]));
  const n       = order.length;
  document.getElementById('w-catalog').innerHTML=order.map((id,i)=>`
    <div class="widget-catalog-item">
      <button class="widget-reorder-btn" onclick="moveWidget('${id}',-1)" ${i===0?'disabled':''}>▲</button>
      <button class="widget-reorder-btn" onclick="moveWidget('${id}',1)" ${i===n-1?'disabled':''}>▼</button>
      <span class="widget-catalog-label">${labels[id]||id}</span>
      <input type="checkbox" class="toggle toggle-primary toggle-sm" ${vis[id]?'checked':''} onchange="setWVis('${id}',this.checked)"/>
    </div>`).join('');
}

// Abre el modal del catálogo para activar/desactivar y reordenar widgets
function openWCatalog(){
  renderWCatalog();
  document.getElementById('modal-widgets').showModal();
}

// Mueve un widget de posición en el orden guardado
function moveWidget(id, dir){
  const savedOrder = JSON.parse(localStorage.getItem('fw_order')||'null');
  const order = savedOrder || WIDGETS.map(w=>w.id);
  const idx = order.indexOf(id);
  if(idx===-1)return;
  const newIdx = idx+dir;
  if(newIdx<0||newIdx>=order.length)return;
  [order[idx],order[newIdx]]=[order[newIdx],order[idx]];
  localStorage.setItem('fw_order',JSON.stringify(order));
  // Re-renderizar grid y reabrir modal
  const savedVis = JSON.parse(localStorage.getItem('fw_vis')||'null');
  const vis = savedVis || Object.fromEntries(WIDGETS.map(w=>[w.id,w.def]));
  const savedCollapsed = JSON.parse(localStorage.getItem('fw_collapsed')||'{}');
  const grid = document.getElementById('dashboard-grid');
  grid.innerHTML='';
  order.forEach(id=>{ if(vis[id]) grid.insertAdjacentHTML('beforeend',buildWidget(id)); });
  Object.entries(savedCollapsed).forEach(([id,col])=>{
    if(col){const w=grid.querySelector(`[data-widget="${id}"]`);if(w){w.classList.add('collapsed');const btn=w.querySelector('.widget-toggle-btn');if(btn)btn.textContent='▼';}}
  });
  renderWCatalog();
}

// Muestra u oculta un widget y actualiza localStorage
function setWVis(id,show){
  const savedVis=JSON.parse(localStorage.getItem('fw_vis')||'null');
  const vis=savedVis||Object.fromEntries(WIDGETS.map(w=>[w.id,w.def]));
  vis[id]=show;
  localStorage.setItem('fw_vis',JSON.stringify(vis));
  const grid=document.getElementById('dashboard-grid');
  if(show){
    if(!grid.querySelector(`[data-widget="${id}"]`)){
      grid.insertAdjacentHTML('beforeend',buildWidget(id));
      loadDash();
    }
  } else {
    const w=grid.querySelector(`[data-widget="${id}"]`);
    if(w)w.remove();
  }
  saveWOrder();
}

// Guarda el orden actual de widgets en localStorage
function saveWOrder(){
  const order=[...document.querySelectorAll('#dashboard-grid .widget-container')].map(w=>w.dataset.widget);
  localStorage.setItem('fw_order',JSON.stringify(order));
}

// Colapsado/expandido de un widget individual
function toggleW(btn){
  const c=btn.closest('.widget-container');
  c.classList.toggle('collapsed');
  btn.textContent=c.classList.contains('collapsed')?'▼':'▲';
  // Persistir estado
  const state={};
  document.querySelectorAll('#dashboard-grid .widget-container').forEach(w=>{state[w.dataset.widget]=w.classList.contains('collapsed');});
  localStorage.setItem('fw_collapsed',JSON.stringify(state));
}

// ════════════════════════════════════════════
// CONFIGURACIÓN DE SUPABASE
// ════════════════════════════════════════════
function saveConfig(){
  const url=getV('cfg-url').trim(),key=getV('cfg-key').trim();
  if(!url||!key){toast('Ingresa URL y Key','error');return;}
  localStorage.setItem('fin_sb_url',url);localStorage.setItem('fin_sb_key',key);
  SUPABASE_URL=url;SUPABASE_KEY=key;
  try{sb=window.supabase.createClient(url,key);isDemo=false;}catch(e){toast('Error conectando','error');return;}
  document.getElementById('modal-config').close();
  document.getElementById('config-banner').style.display='none';
  toast('¡Supabase conectado! Recarga para usar la BD.','success');
}

// ════════════════════════════════════════════
// CONFIRMACIÓN DE ELIMINACIÓN
// ════════════════════════════════════════════
function confirmDel(table, id, label) {
  const canArchive = table === 'accounts' || table === 'credit_cards';
  document.getElementById('confirm-title').textContent = canArchive ? '¿Eliminar o archivar?' : '¿Confirmar eliminación?';
  document.getElementById('confirm-msg').textContent   = canArchive
    ? `¿Qué deseas hacer con ${label}?`
    : `¿Eliminar ${label}? Esta acción no se puede deshacer.`;
  document.getElementById('confirm-archive-info').style.display = canArchive ? 'block' : 'none';
  document.getElementById('archive-btn').style.display           = canArchive ? 'inline-flex' : 'none';

  // Botón archivar: marca como archived:true, no borra
  document.getElementById('archive-btn').onclick = async () => {
    await dbUpd(table, id, { archived: true });
    document.getElementById('modal-confirm').close();
    toast('Archivado ✓ — inactiva para nuevas transacciones', 'success');
    const cur = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (cur === 'accounts') loadAccs();
    else if (cur === 'cards') loadCards();
  };

  // Botón eliminar permanentemente
  document.getElementById('confirm-btn').onclick = async () => {
    if (table === 'transactions') await reverseTransaction(id);
    await dbDel(table, id);
    document.getElementById('modal-confirm').close();
    toast('Eliminado ✓', 'success');
    const cur = document.querySelector('.page.active')?.id?.replace('page-', '');
    const ls = { dashboard:loadDash, transactions:loadTxns, accounts:loadAccs,
      cards:loadCards, recurring:loadRec, budgets:loadBudgets,
      goals:loadGoals, debts:loadDebts, reports:loadReports, categories:loadCategories };
    if (cur && ls[cur]) ls[cur]();
  };

  document.getElementById('modal-confirm').showModal();
}

// Revierte los efectos de una transacción en saldos antes de eliminarla
async function reverseTransaction(id) {
  const all = await dbGet('transactions');
  const t   = all.find(x => x.id === id);
  if (!t) return;

  // Pago de TC: revertir = restaurar saldo de la TC y devolver dinero a la cuenta
  if (t.is_card_payment) {
    // Restaurar saldo de la tarjeta (el pago lo había reducido → sumar de vuelta)
    if (t.credit_card_id) {
      const cards = await dbGet('credit_cards');
      const card  = cards.find(c => c.id === t.credit_card_id);
      if (card) await dbUpd('credit_cards', t.credit_card_id, { current_balance: (card.current_balance||0) + t.amount });
    }
    // Restaurar saldo de la cuenta (el pago lo había restado → sumar de vuelta)
    if (t.account_id) {
      const accs = await dbGet('accounts');
      const acc  = accs.find(a => a.id === t.account_id);
      if (acc) await dbUpd('accounts', t.account_id, { balance: (acc.balance||0) + t.amount });
    }
    return;
  }

  // Gasto normal: revertir saldo de cuenta y/o tarjeta
  if (t.type === 'expense') {
    if (t.account_id) {
      const accs = await dbGet('accounts');
      const acc  = accs.find(a => a.id === t.account_id);
      if (acc) await dbUpd('accounts', t.account_id, { balance: (acc.balance||0) + t.amount });
    }
    if (t.credit_card_id) {
      const cards = await dbGet('credit_cards');
      const card  = cards.find(c => c.id === t.credit_card_id);
      if (card) await dbUpd('credit_cards', t.credit_card_id, { current_balance: Math.max(0,(card.current_balance||0) - t.amount) });
    }
  }

  // Ingreso: revertir saldo de cuenta
  if (t.type === 'income' && t.account_id) {
    const accs = await dbGet('accounts');
    const acc  = accs.find(a => a.id === t.account_id);
    if (acc) await dbUpd('accounts', t.account_id, { balance: (acc.balance||0) - t.amount });
  }

  // Abono a deuda: restaurar remaining_amount
  if (t.debt_id) {
    const debts = await dbGet('debts');
    const debt  = debts.find(d => d.id === t.debt_id);
    if (debt) {
      const restored = (debt.remaining_amount||0) + t.amount;
      await dbUpd('debts', t.debt_id, { remaining_amount: restored, status: restored > 0 ? 'active' : 'paid' });
    }
  }

  // Transferencia: restaurar ambas cuentas
  if (t.type === 'transfer') {
    const accs = await dbGet('accounts');
    const from = accs.find(a => a.id === t.account_id);
    const to   = accs.find(a => a.id === t.transfer_to_id);
    if (from) await dbUpd('accounts', t.account_id,    { balance: (from.balance||0) + t.amount });
    if (to)   await dbUpd('accounts', t.transfer_to_id,{ balance: (to.balance||0)   - t.amount });
  }
}

// ════════════════════════════════════════════
// UTILIDADES
// ════════════════════════════════════════════

// Convierte 'YYYY-MM-DD' a Date local (evita el bug UTC donde new Date('YYYY-MM-DD') = medianoche UTC = día anterior en zonas negativas)
function parseLocalDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Formatea una fecha ISO al formato "12 ene. 2025"
function fmtDate(s) {
  if (!s) return '';
  return parseLocalDate(s).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' });
}

// Muestra un toast de notificación temporal
function toast(msg,type='info'){
  const colors={success:'#22c55e',error:'#ef4444',info:'#3b82f6',warning:'#f59e0b'};
  const d=document.createElement('div');d.className='toast-msg';d.style.background=colors[type]||colors.info;d.textContent=msg;
  document.getElementById('toast-ct').appendChild(d);setTimeout(()=>d.remove(),3500);
}

// Lee el value de un campo por ID
function getV(id){const e=document.getElementById(id);return e?e.value:'';}

// Establece el value de un campo por ID
function setV(id,v){const e=document.getElementById(id);if(e)e.value=v;}

// ════════════════════════════════════════════
// AUTO-COBROS DE GASTOS RECURRENTES
// Llama a processAutoCharges() para ejecutar
// todos los gastos marcados como auto_charge:true
// cuya next_date sea hoy o anterior.
// Puedes también llamarla desde tu backend/cron
// haciendo: window.FinanzApp.processAutoCharges()
// ════════════════════════════════════════════
async function processAutoCharges({ silent = false } = {}) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const recs = await dbGet('recurring_expenses');
  // Filtrar solo los que son auto-cobro, están activos y ya vencen hoy o antes
  const due = recs.filter(r =>
    r.active !== false &&
    r.auto_charge === true &&
    r.next_date &&
    parseLocalDate(r.next_date) <= today
  );

  if (!due.length) {
    if (!silent) toast('Sin cobros automáticos pendientes', 'info');
    return { processed: 0, items: [] };
  }

  const results = [];
  for (const r of due) {
    try {
      // Registrar la transacción de gasto
      await dbIns('transactions', {
        type: 'expense',
        description: r.name,
        amount: r.amount,
        date: r.next_date,          // fecha real del cobro, no hoy
        category_id: r.category_id || null,
        account_id:  r.account_id  || null,
        credit_card_id: r.card_id  || null,
        notes: `Auto-cobro (${FREQ_LABEL[r.frequency] || r.frequency})`
      });
      // Si tiene tarjeta de crédito asociada, incrementar su saldo
      if (r.card_id) {
        const cards = await dbGet('credit_cards');
        const card = cards.find(c => c.id === r.card_id);
        if (card) {
          await dbUpd('credit_cards', r.card_id, {
            current_balance: (card.current_balance || 0) + r.amount
          });
        }
      }
      // Calcular y guardar la próxima fecha de cobro
      const nd = nextDate(r.next_date, r.frequency);
      await dbUpd('recurring_expenses', r.id, { next_date: nd });
      results.push({ id: r.id, name: r.name, amount: r.amount, status: 'ok' });
    } catch (e) {
      console.error('Error en auto-cobro de', r.name, e);
      results.push({ id: r.id, name: r.name, status: 'error', error: e.message });
    }
  }

  const ok = results.filter(r => r.status === 'ok');
  if (!silent && ok.length) {
    toast(`${ok.length} cobro${ok.length > 1 ? 's' : ''} automático${ok.length > 1 ? 's' : ''} procesado${ok.length > 1 ? 's' : ''}`, 'success');
  }

  // Refrescar la página activa si es relevante
  const cur = document.querySelector('.page.active')?.id?.replace('page-', '');
  if (['dashboard', 'transactions', 'recurring', 'cards'].includes(cur)) {
    const loaders = { dashboard: loadDash, transactions: loadTxns, recurring: loadRec, cards: loadCards };
    if (loaders[cur]) loaders[cur]();
  }

  return { processed: ok.length, items: results };
}

// Exponer como API pública para llamar desde consola o scripts externos
window.FinanzApp = { processAutoCharges };

// ════════════════════════════════════════════
// MODO OSCURO
// Modos: 'system' (sigue el SO), 'light' (siempre claro), 'dark' (siempre oscuro)
// ════════════════════════════════════════════

// Aplica el modo oscuro al <html> según la preferencia guardada
function applyDarkMode(mode) {
  const html = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  html.classList.toggle('dark-mode', isDark);
  // Actualizar botones del segmento
  ['sys','off','on'].forEach(k => document.getElementById('dm-'+k)?.classList.remove('active'));
  const map = { system:'dm-sys', light:'dm-off', dark:'dm-on' };
  document.getElementById(map[mode])?.classList.add('active');
}

// Cambia y persiste la preferencia de modo oscuro
function setDarkMode(mode) {
  localStorage.setItem('fin_dark', mode);
  applyDarkMode(mode);
}

// Escuchar cambios del sistema operativo (modo 'system')
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const saved = localStorage.getItem('fin_dark') || 'system';
  if (saved === 'system') applyDarkMode('system');
});

// ════════════════════════════════════════════
// CATEGORÍAS
// ════════════════════════════════════════════
async function loadCategories() {
  const cats = await dbGet('categories');
  const income  = cats.filter(c => c.type === 'income');
  const expense = cats.filter(c => c.type === 'expense');

  const renderList = (list, containerId) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!list.length) { el.innerHTML = '<div class="empty-state" style="padding:1rem"><p>Sin categorías</p></div>'; return; }
    el.innerHTML = list.map(c => `
      <div class="cat-item">
        <div class="cat-item-icon" style="background:${c.color}22">${c.icon?lucideSVG(c.icon, 18):lucideSVG('tag', 18)}</div>
        <div class="cat-item-body">
          <p class="cat-item-name">${c.name}</p>
          <p class="cat-item-sub">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.color}"></span>
            ${c.color}
          </p>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-xs" onclick="openCatModal('${c.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-ghost btn-xs text-error" onclick="confirmDel('categories','${c.id}','la categoría')"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div>
      </div>`).join('');
  };

  renderList(income, 'cats-income-list');
  renderList(expense, 'cats-expense-list');
  // Sincronizar categoría de pago TC desde la BD al localStorage
  const payCat=cats.find(c=>c.is_payment);
  localStorage.setItem('fin_cc_pay_cat', payCat?payCat.id:'');
  // Selector de categoría para pagos de tarjeta de crédito
  const wrap=document.getElementById('cats-cc-pay-wrap');
  if(wrap){
    const ccId=payCat?payCat.id:'';
    wrap.innerHTML=`<div style="background:#f5f5f3;border-radius:12px;padding:.625rem .75rem">
      <label style="font-size:.6875rem;font-weight:600;color:#8B8B8B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.25rem;display:block">Categoría pago TC</label>
      <select id="cc-pay-cat-select" class="select select-bordered select-sm w-full" onchange="setCcPayCat(this.value)">
        <option value="">— Ninguna —</option>
        ${expense.map(c=>`<option value="${c.id}" ${c.id===ccId?'selected':''}>${c.name}</option>`).join('')}
      </select>
    </div>`;
  }
}

async function setCcPayCat(catId){
  const cats=await dbGet('categories');
  const prev=cats.find(c=>c.is_payment);
  if(prev&&prev.id!==catId)await dbUpd('categories',prev.id,{is_payment:false});
  if(catId)await dbUpd('categories',catId,{is_payment:true});
  localStorage.setItem('fin_cc_pay_cat',catId||'');
}

function openCatModal(id = null) {
  setV('cat-edit-id', id || '');
  document.getElementById('cat-modal-title').textContent = id ? 'Editar categoría' : 'Nueva categoría';
  if (!id) {
    setV('cat-name', ''); setV('cat-icon', '🏷️'); setV('cat-type', 'expense');
    document.getElementById('modal-cat').showModal();
    renderColorPicker('cat-color-picker', 'cat-color', '#8b5cf6');
  } else {
    dbGet('categories').then(cats => {
      const c = cats.find(x => x.id === id);
      if (!c) return;
      setV('cat-name', c.name); setV('cat-icon', c.icon || '🏷️'); setV('cat-type', c.type);
      document.getElementById('modal-cat').showModal();
      renderColorPicker('cat-color-picker', 'cat-color', c.color || '#8b5cf6');
    });
  }
}

async function saveCat() {
  const name = getV('cat-name').trim();
  if (!name) { toast('Escribe el nombre', 'error'); return; }
  const rec = { name, type: getV('cat-type'), icon: getV('cat-icon') || '🏷️', color: getV('cat-color') };
  const eid = getV('cat-edit-id');
  if (eid) { await dbUpd('categories', eid, rec); toast('Categoría actualizada ✓', 'success'); }
  else     { await dbIns('categories', rec);      toast('Categoría creada ✓', 'success'); }
  document.getElementById('modal-cat').close();
  loadCategories();
}

// ════════════════════════════════════════════
// PALETA DE COLORES
// Reemplaza los <input type="color"> con una paleta
// de 20 colores predefinidos + opción personalizada.
// Uso: renderColorPicker(containerId, inputId, currentColor)
// ════════════════════════════════════════════
const COLOR_PALETTE = [
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16',
  '#22c55e','#10b981','#14b8a6','#06b6d4','#0ea5e9',
  '#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef',
  '#ec4899','#f43f5e','#64748b','#0f172a','#7c3aed'
];

function renderColorPicker(containerId, inputId, currentColor) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const cur = currentColor || getV(inputId) || COLOR_PALETTE[0];
  wrap.innerHTML = `
    <div class="color-palette">
      ${COLOR_PALETTE.map(c=>`
        <div class="cp-swatch${c===cur?' selected':''}"
             style="background:${c}"
             title="${c}"
             onclick="pickColor('${inputId}','${c}','${containerId}')"></div>
      `).join('')}
      <div class="cp-custom-wrap" title="Color personalizado">
        <div class="cp-custom-btn">${lucideSVG('pen', 14)}</div>
        <input type="color" value="${cur}"
               oninput="pickColor('${inputId}',this.value,'${containerId}')"/>
      </div>
    </div>
    <div class="cp-preview-row">
      <div class="cp-dot" id="${containerId}-dot" style="background:${cur}"></div>
      <span id="${containerId}-hex">${cur}</span>
    </div>
    <input type="hidden" id="${inputId}" value="${cur}"/>
  `;
}

function pickColor(inputId, color, containerId) {
  // Actualizar hidden input
  const inp = document.getElementById(inputId);
  if (inp) inp.value = color;
  // Actualizar swatches seleccionados
  const wrap = document.getElementById(containerId);
  if (wrap) {
    wrap.querySelectorAll('.cp-swatch').forEach(s => {
      s.classList.toggle('selected', s.style.background === color ||
        s.style.backgroundColor === color ||
        rgbToHex(s.style.backgroundColor) === color.toLowerCase());
    });
    const dot = document.getElementById(containerId+'-dot');
    const hex = document.getElementById(containerId+'-hex');
    if (dot) dot.style.background = color;
    if (hex) hex.textContent = color;
    // Sincronizar el custom input si existe
    const ci = wrap.querySelector('input[type=color]');
    if (ci) ci.value = color;
  }
}

// Convierte rgb(r,g,b) a #rrggbb para comparación
function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return rgb;
  return '#' + m.slice(0,3).map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');
}

// PWA: service worker como blob
(function(){
  if ('serviceWorker' in navigator) {
    const swCode = "\nconst CACHE='finanzapp-v1';\nconst STATIC=['./'];\nself.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()));});\nself.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});\nself.addEventListener('fetch',e=>{\n  if(e.request.url.startsWith('http')){\n    e.respondWith(\n      caches.match(e.request).then(cached=>{\n        const fresh=fetch(e.request).then(r=>{const cl=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cl));return r;}).catch(()=>cached);\n        return cached||fresh;\n      })\n    );\n  }\n});\n";
    const swBlob = new Blob([swCode], {type:'text/javascript'});
    const swUrl  = URL.createObjectURL(swBlob);
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(swUrl, {scope:'./'}
      ).then(r=>console.log('[PWA] SW ok')).catch(e=>console.warn('[PWA] SW err',e));
    });
  }
})();

// Abre el sidebar en móvil
function openSidebar(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}

// Cierra el sidebar en móvil
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}
