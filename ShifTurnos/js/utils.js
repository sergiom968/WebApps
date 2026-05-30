function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function calcHoras(inicio, fin, allDay) {
  if (allDay) return 24;
  if (!inicio || !fin) return 0;
  const [ih, im] = inicio.split(':').map(Number);
  const [fh, fm] = fin.split(':').map(Number);
  let mins = (fh * 60 + fm) - (ih * 60 + im);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}

function genUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function dateToStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function getInitials(lugar) {
  const words = lugar.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h < 12 ? 'a. m.' : 'p. m.';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumberInput(value) {
  if (value === null || value === undefined || value === '') return '';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseMoney(str) {
  if (!str) return 0;
  const clean = String(str).replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function onMoneyInput(el, storeCallback) {
  const raw = el.value;
  const hasComma   = raw.includes(',');
  const parts      = raw.split(',');
  const intRaw     = parts[0].replace(/\./g, '').replace(/\D/g, '');
  const decRaw     = hasComma ? (parts[1] || '').replace(/\D/g, '').slice(0, 2) : null;
  const intFormatted = intRaw
    ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(parseInt(intRaw, 10))
    : '';
  let display;
  if (hasComma) {
    display = intFormatted + ',' + (decRaw ?? '');
  } else {
    display = intFormatted;
  }
  const cursorPos = el.selectionStart;
  const prevLen   = el.value.length;
  el.value = display;
  const newLen = el.value.length;
  el.setSelectionRange(cursorPos + (newLen - prevLen), cursorPos + (newLen - prevLen));
  storeCallback(parseMoney(display));
}

function onMoneyBlur(el, storeCallback) {
  const raw = parseMoney(el.value);
  storeCallback(raw);
  el.value = raw || raw === 0 ? formatNumberInput(raw) : '';
}
