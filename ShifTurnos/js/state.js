const AppState = {
  currentView: 'calendario',
  currentDate: new Date(),
  selectedDate: null,
  editMode: false,
  selectedShiftTemplate: null,
  weekStart: 1,
  maxShiftsPerDay: 3,
  theme: 'auto',
  supabaseConnected: false,
  supabaseClient: null,
  editingShiftId: null,
  editingDetailShiftId: null,
  informePeriod: { year: 2026, month: 2 },
  shifts: [],
  assignments: [],
  events: [],
  informes: [],
};

const SHIFT_COLORS = [
  '#FF4D6D','#FF6B35','#FF9F1C','#FFCA3A','#8AC926',
  '#1982C4','#6A4C93','#C77DFF','#E040FB','#F72585',
  '#06D6A0','#118AB2','#073B4C','#264653','#2A9D8F',
  '#E9C46A','#F4A261','#E76F51','#3D405B','#81B29A',
];

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES_LONG  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DAYS_ES_SHORT = ['D','L','M','M','J','V','S'];

const DEMO_SHIFTS = [
  { id: 'shift_1', lugar: 'ESE', nombre: 'Presencial',     inicio: '07:00', fin: '13:00', color: '#FF4D6D', totalHoras: 6,  allDay: false },
  { id: 'shift_2', lugar: 'ESE', nombre: 'Disponibilidad', inicio: '13:00', fin: '07:00', color: '#1982C4', totalHoras: 18, allDay: false },
  { id: 'shift_3', lugar: 'ESE', nombre: 'Consulta',       inicio: '13:00', fin: '18:00', color: '#06D6A0', totalHoras: 5,  allDay: false },
  { id: 'shift_4', lugar: 'SR',  nombre: 'Revista',        inicio: '07:00', fin: '19:00', color: '#8AC926', totalHoras: 12, allDay: false },
  { id: 'shift_5', lugar: 'SOG', nombre: 'Consulta',       inicio: '07:00', fin: '13:00', color: '#E040FB', totalHoras: 6,  allDay: false },
  { id: 'shift_6', lugar: 'SOG', nombre: 'Programa',       inicio: '13:00', fin: '19:00', color: '#FF6B35', totalHoras: 6,  allDay: false },
];

const DEMO_ASSIGNMENTS = [
  { id: 'a1',  shiftId: 'shift_1', fecha: '2026-03-06' },
  { id: 'a2',  shiftId: 'shift_2', fecha: '2026-03-06' },
  { id: 'a3',  shiftId: 'shift_3', fecha: '2026-03-06' },
  { id: 'a4',  shiftId: 'shift_1', fecha: '2026-03-13' },
  { id: 'a5',  shiftId: 'shift_2', fecha: '2026-03-13' },
  { id: 'a6',  shiftId: 'shift_3', fecha: '2026-03-13' },
  { id: 'a14', shiftId: 'shift_1', fecha: '2026-03-14' },
  { id: 'a7',  shiftId: 'shift_1', fecha: '2026-03-20' },
  { id: 'a8',  shiftId: 'shift_2', fecha: '2026-03-20' },
  { id: 'a9',  shiftId: 'shift_3', fecha: '2026-03-20' },
  { id: 'a15', shiftId: 'shift_1', fecha: '2026-03-21' },
  { id: 'a16', shiftId: 'shift_2', fecha: '2026-03-21' },
  { id: 'a10', shiftId: 'shift_1', fecha: '2026-03-22' },
  { id: 'a11', shiftId: 'shift_2', fecha: '2026-03-22' },
  { id: 'a17', shiftId: 'shift_1', fecha: '2026-03-27' },
  { id: 'a18', shiftId: 'shift_2', fecha: '2026-03-27' },
  { id: 'a19', shiftId: 'shift_3', fecha: '2026-03-27' },
  { id: 'a20', shiftId: 'shift_4', fecha: '2026-03-28' },
  { id: 'a21', shiftId: 'shift_5', fecha: '2026-03-28' },
  { id: 'a12', shiftId: 'shift_5', fecha: '2026-03-30' },
  { id: 'a13', shiftId: 'shift_6', fecha: '2026-03-30' },
];

const DEMO_EVENTS = [
  { id: 'ev1', nombre: 'Clase ped',   fecha: '2026-03-10', inicio: '08:00', fin: '10:00' },
  { id: 'ev2', nombre: 'Clase ped',   fecha: '2026-03-11', inicio: '08:00', fin: '10:00' },
  { id: 'ev3', nombre: 'Entrega M',   fecha: '2026-03-14', inicio: '09:00', fin: '11:00' },
];

const DEMO_INFORMES = [
  {
    id: 'inf_1',
    titulo: 'E.S.E Santiago',
    mesCreacion: '2026-03',
    turnoIds: ['shift_1','shift_2','shift_3'],
    salarioBase: { nombre: 'Salario por hora', valorHora: 0 },
    pagosExtra: [
      { id: 'pe_1', nombre: 'Presencial',     valorHora: 99225,  turnoIds: ['shift_1'] },
      { id: 'pe_2', nombre: 'Consulta',       valorHora: 99225,  turnoIds: ['shift_3'] },
      { id: 'pe_3', nombre: 'Disponibilidad', valorHora: 39690,  turnoIds: ['shift_2'] },
    ],
    pagosFijos: [],
  },
  {
    id: 'inf_2',
    titulo: 'Sogamoso',
    mesCreacion: '2026-03',
    turnoIds: ['shift_5','shift_6'],
    salarioBase: { nombre: 'Salario por hora', valorHora: 85000 },
    pagosExtra: [],
    pagosFijos: [],
  },
];
