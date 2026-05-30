/* ================================================================
   SECCIÓN 4: NAVEGACIÓN ENTRE VISTAS
   ================================================================ */

function switchView(viewName) {
  if (AppState.editMode && viewName !== 'calendario') exitEditMode();

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + viewName).classList.add('active');
  document.getElementById('nav-' + viewName).classList.add('active');

  document.getElementById('fab-btn').style.display        = viewName === 'calendario' ? 'flex' : 'none';
  document.getElementById('fab-turnos').style.display     = viewName === 'turnos'     ? 'flex' : 'none';
  document.getElementById('fab-informes').style.display   = viewName === 'informes'   ? 'flex' : 'none';

  AppState.currentView = viewName;

  if (viewName === 'calendario') renderCalendar();
  if (viewName === 'turnos')     renderShiftsList();
  if (viewName === 'informes')   renderInformes();
  if (viewName === 'ajustes')    syncSettingsUI();
}

/* ================================================================
   SECCIÓN 5: CALENDARIO
   ================================================================ */

function renderCalendar() {
  const d = AppState.currentDate;
  const year  = d.getFullYear();
  const month = d.getMonth();

  document.getElementById('cal-month-title').textContent = MONTHS_ES[month];

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const today     = new Date();
  const todayStr  = dateToStr(today);

  const ws = AppState.weekStart;
  for (let i = 0; i < 7; i++) {
    const dayIdx = (ws + i) % 7;
    const el = document.createElement('div');
    el.className = 'cal-weekday' + (dayIdx === 0 || dayIdx === 6 ? ' weekend' : '');
    el.textContent = DAYS_ES_SHORT[dayIdx];
    grid.appendChild(el);
  }

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let offset = (firstDay - ws + 7) % 7;

  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr   = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const jsDate    = new Date(year, month, day);
    const dayOfWeek = jsDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday   = dateStr === todayStr;

    const cell = document.createElement('div');
    cell.className = 'cal-day' + (isWeekend ? ' weekend' : '') + (isToday ? ' today' : '');
    cell.dataset.date = dateStr;
    cell.onclick = () => handleDayClick(dateStr);

    const numEl = document.createElement('div');
    numEl.className = 'day-num';
    numEl.textContent = day;
    cell.appendChild(numEl);

    const dayAssignments = AppState.assignments
      .filter(a => a.fecha === dateStr)
      .map(a => ({ assignment: a, shift: AppState.shifts.find(s => s.id === a.shiftId) }))
      .filter(x => x.shift)
      .sort((a, b) => {
        const ma = a.assignment.overrideInicio
          ? timeToMinutes(a.assignment.overrideInicio)
          : timeToMinutes(a.shift.inicio);
        const mb = b.assignment.overrideInicio
          ? timeToMinutes(b.assignment.overrideInicio)
          : timeToMinutes(b.shift.inicio);
        return ma - mb;
      });

    const max = Math.min(AppState.maxShiftsPerDay, 3);

    dayAssignments.slice(0, max).forEach(({ assignment, shift }) => {
      if (AppState.editMode && AppState.selectedShiftTemplate === shift.id) {
        cell.style.outline = '2px solid ' + shift.color;
      }
      const chip = document.createElement('div');
      chip.className = 'shift-chip';
      chip.style.backgroundColor = shift.color;
      chip.textContent = `${shift.lugar} - ${shift.nombre}`;
      chip.title = `${shift.lugar} - ${shift.nombre}`;
      cell.appendChild(chip);
    });

    const dayEvents = AppState.events.filter(ev => ev.fecha === dateStr);
    const maxEventos = Math.max(0, 2 - Math.max(0, dayAssignments.length - max));
    dayEvents.slice(0, maxEventos).forEach(ev => {
      const dot = document.createElement('div');
      dot.className = 'event-dot';
      dot.textContent = ev.nombre;
      cell.appendChild(dot);
    });

    const extraShifts = Math.max(0, dayAssignments.length - max);
    const extraEvents = Math.max(0, dayEvents.length - maxEventos);
    const extra = extraShifts + extraEvents;
    if (extra > 0) {
      const moreEl = document.createElement('div');
      moreEl.className = 'more-indicator';
      moreEl.textContent = `+${extra} más`;
      cell.appendChild(moreEl);
    }

    grid.appendChild(cell);
  }
}

function handleDayClick(dateStr) {
  if (AppState.editMode) {
    if (!AppState.selectedShiftTemplate) return;
    toggleShiftAssignment(dateStr, AppState.selectedShiftTemplate);
    renderCalendar();
  } else {
    openDaySheet(dateStr);
  }
}

function toggleShiftAssignment(dateStr, shiftId) {
  const existing = AppState.assignments.find(a => a.fecha === dateStr && a.shiftId === shiftId);
  if (existing) {
    AppState.assignments = AppState.assignments.filter(a => a.id !== existing.id);
    persist('assignment', 'delete', existing.id);
  } else {
    const newA = {
      id: genUUID(),
      shiftId,
      fecha: dateStr,
    };
    AppState.assignments.push(newA);
    persist('assignment', 'upsert', newA);
  }
}

/* ── Swipe para cambiar de mes en calendario ── */
let touchStartX = 0;
let touchStartY = 0;

document.getElementById('cal-swipe-area').addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.getElementById('cal-swipe-area').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
    if (dx < 0) navigateMonth(1);
    else navigateMonth(-1);
  }
}, { passive: true });

/* ── Swipe para cambiar de mes en informes ── */
let infTouchStartX = 0;
let infTouchStartY = 0;

document.getElementById('informes-swipe-area').addEventListener('touchstart', e => {
  infTouchStartX = e.touches[0].clientX;
  infTouchStartY = e.touches[0].clientY;
}, { passive: true });

document.getElementById('informes-swipe-area').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - infTouchStartX;
  const dy = e.changedTouches[0].clientY - infTouchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
    navigateInformePeriod(dx < 0 ? 1 : -1);
  }
}, { passive: true });

function navigateMonth(delta) {
  const d = AppState.currentDate;
  AppState.currentDate = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  AppState.informePeriod = {
    year:  AppState.currentDate.getFullYear(),
    month: AppState.currentDate.getMonth(),
  };

  const grid = document.getElementById('calendar-grid');
  const animClass = delta > 0 ? 'anim-right' : 'anim-left';
  grid.classList.remove('anim-right', 'anim-left');
  void grid.offsetWidth;
  renderCalendar();
  grid.classList.add(animClass);
  grid.addEventListener('animationend', () => grid.classList.remove(animClass), { once: true });

  if (AppState.currentView === 'informes') renderInformes();
}

/* ================================================================
   SECCIÓN 6: MODO EDICIÓN DEL CALENDARIO
   ================================================================ */

function toggleEditMode() {
  if (AppState.editMode) exitEditMode();
  else enterEditMode();
}

function enterEditMode() {
  AppState.editMode = true;
  AppState.selectedShiftTemplate = null;

  const fab = document.getElementById('fab-btn');
  fab.classList.add('edit-mode');
  document.getElementById('fab-icon').textContent = 'close';

  document.getElementById('nav-bar').classList.add('hidden-nav');

  renderEditBar();
  document.getElementById('edit-bar').classList.add('visible');
  document.getElementById('edit-bar').style.bottom = '0';

  renderCalendar();
}

function exitEditMode() {
  AppState.editMode = false;
  AppState.selectedShiftTemplate = null;

  const fab = document.getElementById('fab-btn');
  fab.classList.remove('edit-mode');
  document.getElementById('fab-icon').textContent = 'edit_calendar';

  document.getElementById('nav-bar').classList.remove('hidden-nav');

  document.getElementById('edit-bar').classList.remove('visible');

  renderCalendar();
}

function renderEditBar() {
  const container = document.getElementById('edit-bar-scroll');
  container.innerHTML = '';

  AppState.shifts.forEach(shift => {
    const initials = getInitials(shift.lugar);
    const chip = document.createElement('div');
    chip.className = 'edit-shift-chip' + (AppState.selectedShiftTemplate === shift.id ? ' selected' : '');
    chip.onclick = () => selectEditShift(shift.id);
    chip.innerHTML = `
      <div class="edit-shift-avatar" style="background-color:${shift.color}">${initials}</div>
      <div class="edit-shift-name">${shift.lugar} - ${shift.nombre}</div>
    `;
    container.appendChild(chip);
  });

  const addBtn = document.createElement('div');
  addBtn.className = 'edit-add-btn';
  addBtn.onclick = () => openModal('modal-nuevo-turno');
  addBtn.innerHTML = `
    <div class="edit-add-circle">
      <span class="material-symbols-rounded" style="font-size:20px;">add</span>
    </div>
    <div class="edit-add-label">Nuevo turno</div>
  `;
  container.appendChild(addBtn);
}

function selectEditShift(shiftId) {
  AppState.selectedShiftTemplate = AppState.selectedShiftTemplate === shiftId ? null : shiftId;
  renderEditBar();
  renderCalendar();
}

/* ================================================================
   SECCIÓN 7: TARJETA DE DÍA (BOTTOM SHEET)
   ================================================================ */

function openDaySheet(dateStr) {
  AppState.selectedDate = dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month-1, day);
  const dayName = DAYS_ES_LONG[date.getDay()];
  const monthName = MONTHS_ES[month-1];

  document.getElementById('sheet-date-label').textContent =
    `${dayName}, ${day} de ${monthName} de ${year}`;

  renderSheetContent(dateStr);

  document.getElementById('day-sheet-overlay').classList.add('visible');
  document.getElementById('day-sheet').classList.add('visible');
}

function closeDaySheet() {
  document.getElementById('day-sheet-overlay').classList.remove('visible');
  document.getElementById('day-sheet').classList.remove('visible');
  AppState.selectedDate = null;
}

function renderSheetContent(dateStr) {
  const container = document.getElementById('sheet-content');
  container.innerHTML = '';

  const dayAssignments = AppState.assignments
    .filter(a => a.fecha === dateStr)
    .map(a => ({ assignment: a, shift: AppState.shifts.find(s => s.id === a.shiftId) }))
    .filter(x => x.shift)
    .sort((a, b) => {
      const ma = a.assignment.overrideInicio
        ? timeToMinutes(a.assignment.overrideInicio)
        : timeToMinutes(a.shift.inicio);
      const mb = b.assignment.overrideInicio
        ? timeToMinutes(b.assignment.overrideInicio)
        : timeToMinutes(b.shift.inicio);
      return ma - mb;
    });

  const titleTurnos = document.createElement('div');
  titleTurnos.className = 'sheet-section-title';
  titleTurnos.textContent = 'Turnos';
  container.appendChild(titleTurnos);

  if (dayAssignments.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sheet-empty';
    empty.textContent = 'Sin turnos asignados';
    container.appendChild(empty);
  } else {
    dayAssignments.forEach(({ assignment, shift }) => {
      const efectivoInicio = assignment.overrideInicio || shift.inicio;
      const efectivoFin    = assignment.overrideFin    || shift.fin;
      const efectivoAllDay = assignment.overrideAllDay !== undefined ? assignment.overrideAllDay : shift.allDay;
      const efectivoHoras  = assignment.overrideHoras  !== undefined ? assignment.overrideHoras  : shift.totalHoras;

      const item = document.createElement('div');
      item.className = 'sheet-shift-item';
      item.style.cursor = 'pointer';

      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'sheet-shift-avatar';
      avatarDiv.style.backgroundColor = shift.color;
      avatarDiv.textContent = getInitials(shift.lugar);

      const infoDiv = document.createElement('div');
      infoDiv.className = 'sheet-shift-info';
      infoDiv.innerHTML = `
        <div class="sheet-shift-name">${shift.lugar} - ${shift.nombre}</div>
        <div class="sheet-shift-time">${efectivoAllDay ? 'Todo el día' : formatTime(efectivoInicio) + ' – ' + formatTime(efectivoFin)}</div>
      `;

      const horasDiv = document.createElement('div');
      horasDiv.className = 'sheet-shift-hours';
      horasDiv.textContent = efectivoHoras + 'h';

      const editBtn = document.createElement('button');
      editBtn.title = 'Editar horario solo este día';
      editBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px;color:var(--text-secondary);display:flex;align-items:center;';
      editBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px;">schedule</span>';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        openOverrideModal(assignment.id, dateStr);
      };

      const delBtn = document.createElement('button');
      delBtn.title = 'Quitar turno de este día';
      delBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px;color:var(--weekend);display:flex;align-items:center;';
      delBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px;">remove_circle</span>';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        AppState.assignments = AppState.assignments.filter(a => a.id !== assignment.id);
        persist('assignment', 'delete', assignment.id);
        renderCalendar();
        renderSheetContent(dateStr);
      };

      item.appendChild(avatarDiv);
      item.appendChild(infoDiv);
      item.appendChild(horasDiv);
      item.appendChild(editBtn);
      item.appendChild(delBtn);
      container.appendChild(item);
    });
  }

  const dayEvents = AppState.events.filter(ev => ev.fecha === dateStr);
  const titleEventos = document.createElement('div');
  titleEventos.className = 'sheet-section-title';
  titleEventos.textContent = 'Eventos';
  container.appendChild(titleEventos);

  if (dayEvents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sheet-empty';
    empty.textContent = 'Sin eventos';
    container.appendChild(empty);
  } else {
    dayEvents.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'sheet-event-item';
      item.style.justifyContent = 'space-between';

      const leftDiv = document.createElement('div');
      leftDiv.style.cssText = 'display:flex;align-items:flex-start;gap:10px;flex:1;';
      leftDiv.innerHTML = `
        <div class="sheet-event-dot"></div>
        <div>
          <div class="sheet-event-name">${ev.nombre}</div>
          <div class="sheet-event-time">${formatTime(ev.inicio)} – ${formatTime(ev.fin)}</div>
        </div>
      `;

      const actionsDiv = document.createElement('div');
      actionsDiv.style.cssText = 'display:flex;align-items:center;gap:2px;flex-shrink:0;';

      const editBtn = document.createElement('button');
      editBtn.title = 'Editar evento';
      editBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px;color:var(--text-secondary);display:flex;align-items:center;';
      editBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px;">edit</span>';
      editBtn.onclick = () => openEditEvento(ev.id);

      const delBtn = document.createElement('button');
      delBtn.title = 'Eliminar evento';
      delBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px;color:var(--weekend);display:flex;align-items:center;';
      delBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px;">delete</span>';
      delBtn.onclick = () => {
        AppState.events = AppState.events.filter(e => e.id !== ev.id);
        persist('evento', 'delete', ev.id);
        renderCalendar();
        renderSheetContent(dateStr);
      };

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(delBtn);
      item.appendChild(leftDiv);
      item.appendChild(actionsDiv);
      container.appendChild(item);
    });
  }

  container.appendChild(document.createElement('div')).style.height = '8px';
}

function openAddShiftFromSheet() {
  if (AppState.shifts.length === 0) {
    document.getElementById('edit-shift-id').value = '';
    document.getElementById('modal-turno-title').textContent = 'Nuevo Turno';
    openModal('modal-nuevo-turno');
    return;
  }
  renderShiftSelectorModal();
  openModal('modal-select-shift');
}

function renderShiftSelectorModal() {
  const container = document.getElementById('shift-selector-list');
  container.innerHTML = '';

  const dateStr = AppState.selectedDate;

  const assignedIds = new Set(
    AppState.assignments.filter(a => a.fecha === dateStr).map(a => a.shiftId)
  );

  AppState.shifts.forEach(shift => {
    const alreadyIn = assignedIds.has(shift.id);
    const item = document.createElement('div');
    item.className = 'shift-list-item';
    item.style.opacity = alreadyIn ? '0.45' : '1';
    item.onclick = () => {
      if (alreadyIn) return;
      const newA = {
        id: genUUID(),
        shiftId: shift.id,
        fecha: dateStr,
      };
      AppState.assignments.push(newA);
      persist('assignment', 'upsert', newA);
      closeModal('modal-select-shift');
      renderCalendar();
      renderSheetContent(dateStr);
    };
    item.innerHTML = `
      <div class="shift-avatar" style="background-color:${shift.color}">${getInitials(shift.lugar)}</div>
      <div class="shift-info">
        <div class="shift-name">${shift.lugar} - ${shift.nombre}</div>
        <div class="shift-time">${shift.allDay ? 'Todo el día' : formatTime(shift.inicio) + ' - ' + formatTime(shift.fin)} · ${shift.totalHoras}h</div>
      </div>
      ${alreadyIn
        ? '<span class="material-symbols-rounded" style="font-size:18px;color:var(--accent);">check_circle</span>'
        : '<span class="material-symbols-rounded shift-chevron" style="font-size:20px;">add</span>'
      }
    `;
    container.appendChild(item);
  });
}

/* ================================================================
   SECCIÓN 9: MODAL - NUEVO / EDITAR EVENTO
   ================================================================ */

function openAddEventFromSheet() {
  document.getElementById('btn-guardar-evento').dataset.eventoId = '';
  document.getElementById('modal-evento-title').textContent = 'Nuevo Evento';
  document.getElementById('evento-nombre').value = '';
  document.getElementById('evento-inicio').value = '';
  document.getElementById('evento-fin').value = '';
  if (AppState.selectedDate) {
    document.getElementById('evento-fecha').value = AppState.selectedDate;
  }
  document.getElementById('modal-nuevo-evento').classList.add('visible');
}

function openEditEvento(eventoId) {
  const ev = AppState.events.find(e => e.id === eventoId);
  if (!ev) return;
  document.getElementById('btn-guardar-evento').dataset.eventoId = ev.id;
  document.getElementById('modal-evento-title').textContent = 'Editar Evento';
  document.getElementById('evento-nombre').value = ev.nombre;
  document.getElementById('evento-fecha').value  = ev.fecha;
  document.getElementById('evento-inicio').value = ev.inicio;
  document.getElementById('evento-fin').value    = ev.fin;
  document.getElementById('modal-nuevo-evento').classList.add('visible');
}

function saveEvento() {
  const nombre = document.getElementById('evento-nombre').value.trim();
  const fecha  = document.getElementById('evento-fecha').value;
  const inicio = document.getElementById('evento-inicio').value;
  const fin    = document.getElementById('evento-fin').value;
  const editId = document.getElementById('btn-guardar-evento').dataset.eventoId || '';

  if (!nombre || !fecha || !inicio || !fin) {
    alert('Por favor completa todos los campos del evento.');
    return;
  }

  if (editId) {
    const idx = AppState.events.findIndex(e => e.id === editId);
    if (idx !== -1) {
      AppState.events[idx] = { id: editId, nombre, fecha, inicio, fin };
      persist('evento', 'upsert', AppState.events[idx]);
    }
  } else {
    const newEv = { id: genUUID(), nombre, fecha, inicio, fin };
    AppState.events.push(newEv);
    persist('evento', 'upsert', newEv);
  }

  document.getElementById('btn-guardar-evento').dataset.eventoId = '';
  document.getElementById('modal-nuevo-evento').classList.remove('visible');
  renderCalendar();
  if (AppState.selectedDate) renderSheetContent(AppState.selectedDate);
}

/* ================================================================
   SECCIÓN 8/10: MODAL - NUEVO / EDITAR / DETALLE TURNO
   ================================================================ */

let _selectedColor = SHIFT_COLORS[0];
let _allDay = false;

function openNuevoTurno() {
  AppState.editingShiftId = null;
  document.getElementById('modal-turno-title').textContent = 'Nuevo Turno';
  document.getElementById('edit-shift-id').value = '';
  document.getElementById('shift-lugar').value = '';
  document.getElementById('shift-nombre').value = '';
  document.getElementById('shift-inicio').value = '07:00';
  document.getElementById('shift-fin').value = '13:00';
  _allDay = false;
  _selectedColor = SHIFT_COLORS[0];
  updateAlldayToggle();
  renderColorGrid();
  openModal('modal-nuevo-turno');
}

function openModal(id) {
  if (id === 'modal-nuevo-turno') {
    if (!document.getElementById('edit-shift-id').value) {
      document.getElementById('shift-lugar').value  = '';
      document.getElementById('shift-nombre').value = '';
      document.getElementById('shift-inicio').value = '07:00';
      document.getElementById('shift-fin').value    = '13:00';
      _allDay = false;
      _selectedColor = SHIFT_COLORS[0];
      updateAlldayToggle();
      renderColorGrid();
      document.getElementById('modal-turno-title').textContent = 'Nuevo Turno';
    }
  }
  document.getElementById(id).classList.add('visible');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('visible');
  if (id === 'modal-nuevo-turno') {
    document.getElementById('edit-shift-id').value = '';
  }
}

function handleModalOverlayClick(event, id) {
  if (event.target === document.getElementById(id)) {
    closeModal(id);
  }
}

function renderColorGrid() {
  const grid = document.getElementById('color-grid');
  grid.innerHTML = '';
  SHIFT_COLORS.forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (color === _selectedColor ? ' selected' : '');
    sw.style.backgroundColor = color;
    sw.onclick = () => selectColor(color);
    grid.appendChild(sw);
  });
  updateColorPreview();
}

function selectColor(color) {
  _selectedColor = color;
  renderColorGrid();
}

function selectCustomColor(color) {
  _selectedColor = color;
  renderColorGrid();
}

function updateColorPreview() {
  const preview = document.getElementById('selected-color-preview');
  const dot = document.getElementById('selected-color-dot');
  const hex = document.getElementById('selected-color-hex');
  if (_selectedColor) {
    preview.style.display = 'flex';
    dot.style.backgroundColor = _selectedColor;
    hex.textContent = _selectedColor.toUpperCase();
  }
}

function toggleAllDay() {
  _allDay = !_allDay;
  updateAlldayToggle();
}

function updateAlldayToggle() {
  const toggle = document.getElementById('allday-toggle');
  const finInput = document.getElementById('shift-fin');
  if (_allDay) {
    toggle.classList.add('on');
    finInput.disabled = true;
    finInput.value = '';
  } else {
    toggle.classList.remove('on');
    finInput.disabled = false;
  }
}

function saveShift() {
  const lugar  = document.getElementById('shift-lugar').value.trim();
  const nombre = document.getElementById('shift-nombre').value.trim();
  const inicio = document.getElementById('shift-inicio').value;
  const fin    = document.getElementById('shift-fin').value;
  const editId = document.getElementById('edit-shift-id').value;

  if (!lugar || !nombre) {
    alert('Por favor completa el lugar y el nombre del turno.');
    return;
  }
  if (!_allDay && (!inicio || !fin)) {
    alert('Por favor indica la hora de inicio y fin, o selecciona "Todo el día".');
    return;
  }

  const totalHoras = calcHoras(inicio, fin, _allDay);

  if (editId) {
    const idx = AppState.shifts.findIndex(s => s.id === editId);
    if (idx !== -1) {
      const anterior = AppState.shifts[idx];
      const horarioCambia = anterior.inicio !== inicio || anterior.fin !== fin || anterior.allDay !== _allDay;

      if (horarioCambia) {
        const toFreeze = AppState.assignments.filter(a => a.shiftId === editId && a.overrideHoras === undefined);
        toFreeze.forEach(a => {
          a.overrideInicio = anterior.inicio;
          a.overrideFin    = anterior.fin;
          a.overrideAllDay = anterior.allDay;
          a.overrideHoras  = anterior.totalHoras;
          persist('assignment', 'upsert', a);
        });
      }

      AppState.shifts[idx] = {
        ...anterior, lugar, nombre, inicio, fin,
        color: _selectedColor, totalHoras, allDay: _allDay
      };
      persist('shift', 'upsert', AppState.shifts[idx]);
    }
  } else {
    const newShift = {
      id: genUUID(),
      lugar, nombre, inicio, fin,
      color: _selectedColor, totalHoras, allDay: _allDay,
    };
    AppState.shifts.push(newShift);
    persist('shift', 'upsert', newShift);
  }

  closeModal('modal-nuevo-turno');
  if (AppState.editMode) renderEditBar();
  renderCalendar();
  renderShiftsList();
}

/* ─── Detalle de turno ─── */

function openShiftDetail(shiftId) {
  AppState.editingDetailShiftId = shiftId;
  const shift = AppState.shifts.find(s => s.id === shiftId);
  if (!shift) return;

  const container = document.getElementById('detalle-turno-content');
  container.innerHTML = `
    <div style="padding:16px 20px;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
        <div style="width:52px;height:52px;border-radius:50%;background-color:${shift.color};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;">
          ${getInitials(shift.lugar)}
        </div>
        <div>
          <div style="font-size:18px;font-weight:700;color:var(--text-primary);">${shift.lugar} - ${shift.nombre}</div>
          <div style="font-size:14px;color:var(--text-secondary);margin-top:2px;">
            ${shift.allDay ? 'Todo el día' : formatTime(shift.inicio) + ' - ' + formatTime(shift.fin)} · ${shift.totalHoras}h
          </div>
        </div>
      </div>
      <div style="background:var(--bg-primary);border-radius:12px;padding:14px;margin-bottom:12px;">
        <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;font-weight:600;margin-bottom:8px;">Detalles</div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light);">
          <span style="font-size:14px;color:var(--text-secondary);">Lugar</span>
          <span style="font-size:14px;font-weight:600;color:var(--text-primary);">${shift.lugar}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light);">
          <span style="font-size:14px;color:var(--text-secondary);">Turno</span>
          <span style="font-size:14px;font-weight:600;color:var(--text-primary);">${shift.nombre}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light);">
          <span style="font-size:14px;color:var(--text-secondary);">Horario</span>
          <span style="font-size:14px;font-weight:600;color:var(--text-primary);">${shift.allDay ? 'Todo el día' : formatTime(shift.inicio) + ' – ' + formatTime(shift.fin)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;">
          <span style="font-size:14px;color:var(--text-secondary);">Total horas</span>
          <span style="font-size:14px;font-weight:600;color:var(--text-primary);">${shift.totalHoras}h</span>
        </div>
      </div>
    </div>
  `;

  closeDaySheet();
  closeModal('modal-detalle-turno');
  setTimeout(() => openModal('modal-detalle-turno'), 50);
}

function deleteShiftFromDetail() {
  const shiftId = AppState.editingDetailShiftId;
  if (!shiftId) return;
  if (!confirm('¿Eliminar este turno y todas sus asignaciones en el calendario?')) return;

  AppState.assignments.filter(a => a.shiftId === shiftId).forEach(a => persist('assignment', 'delete', a.id));
  AppState.shifts = AppState.shifts.filter(s => s.id !== shiftId);
  AppState.assignments = AppState.assignments.filter(a => a.shiftId !== shiftId);
  persist('shift', 'delete', shiftId);

  closeModal('modal-detalle-turno');
  renderCalendar();
  renderShiftsList();
}

function editShiftFromDetail() {
  const shiftId = AppState.editingDetailShiftId;
  const shift = AppState.shifts.find(s => s.id === shiftId);
  if (!shift) return;

  document.getElementById('edit-shift-id').value = shift.id;
  document.getElementById('shift-lugar').value = shift.lugar;
  document.getElementById('shift-nombre').value = shift.nombre;
  document.getElementById('shift-inicio').value = shift.inicio;
  document.getElementById('shift-fin').value = shift.fin;
  _allDay = shift.allDay || false;
  _selectedColor = shift.color;
  document.getElementById('modal-turno-title').textContent = 'Editar Turno';

  updateAlldayToggle();
  renderColorGrid();

  closeModal('modal-detalle-turno');
  setTimeout(() => openModal('modal-nuevo-turno'), 50);
}

/* ================================================================
   SECCIÓN 11: VISTA TURNOS (lista de plantillas)
   ================================================================ */

AppState.shiftsAlphaSort = false;

function toggleShiftsSort() {
  AppState.shiftsAlphaSort = !AppState.shiftsAlphaSort;
  const label = document.getElementById('sort-shifts-label');
  if (label) label.textContent = AppState.shiftsAlphaSort ? 'Orden original' : 'A–Z';
  renderShiftsList();
}

function renderShiftsList() {
  const container = document.getElementById('shifts-list-container');
  container.innerHTML = '';

  if (AppState.shifts.length === 0) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:14px;">
        <span class="material-symbols-rounded" style="font-size:40px;display:block;margin-bottom:8px;opacity:0.4;">badge</span>
        Sin turnos creados
      </div>
    `;
    return;
  }

  let list = [...AppState.shifts];
  if (AppState.shiftsAlphaSort) {
    list.sort((a, b) => `${a.lugar} ${a.nombre}`.localeCompare(`${b.lugar} ${b.nombre}`, 'es'));
  }

  list.forEach(shift => {
    const item = document.createElement('div');
    item.className = 'shift-list-item';
    item.onclick = () => openShiftDetail(shift.id);
    item.innerHTML = `
      <div class="shift-avatar" style="background-color:${shift.color}">${getInitials(shift.lugar)}</div>
      <div class="shift-info">
        <div class="shift-name">${shift.lugar} - ${shift.nombre}</div>
        <div class="shift-time">${shift.allDay ? 'Todo el día' : formatTime(shift.inicio) + ' - ' + formatTime(shift.fin)} · ${shift.totalHoras}h</div>
      </div>
      <span class="material-symbols-rounded shift-chevron" style="font-size:20px;">chevron_right</span>
    `;
    container.appendChild(item);
  });
}

/* ================================================================
   SECCIÓN 12: VISTA INFORMES
   ================================================================ */

function calcHorasMes(turnoIds, year, month) {
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
  return AppState.assignments
    .filter(a => a.fecha.startsWith(monthStr) && turnoIds.includes(a.shiftId))
    .reduce((sum, a) => {
      const shift = AppState.shifts.find(s => s.id === a.shiftId);
      if (!shift) return sum;
      return sum + (a.overrideHoras !== undefined ? a.overrideHoras : shift.totalHoras);
    }, 0);
}

const InformesUI = {
  get collapsed() {
    try { return new Set(JSON.parse(localStorage.getItem('ts_inf_collapsed') || '[]')); } catch(e) { return new Set(); }
  },
  setCollapsed(s) { localStorage.setItem('ts_inf_collapsed', JSON.stringify([...s])); },
  get ocultos() {
    try { return JSON.parse(localStorage.getItem('ts_inf_ocultos') || '{}'); } catch(e) { return {}; }
  },
  setOcultos(o) { localStorage.setItem('ts_inf_ocultos', JSON.stringify(o)); },
  verOcultos: false,
};

function informeEstaOcultoEnMes(infId, mesStr) {
  const cfg = InformesUI.ocultos[infId];
  if (!cfg) return false;
  if (typeof cfg === 'string') return mesStr >= cfg;
  if (typeof cfg === 'object' && cfg.meses) return cfg.meses.includes(mesStr);
  return false;
}

function toggleVerOcultos() {
  InformesUI.verOcultos = !InformesUI.verOcultos;
  const btn = document.getElementById('btn-ver-ocultos');
  if (btn) {
    btn.querySelector('.material-symbols-rounded').textContent =
      InformesUI.verOcultos ? 'visibility' : 'visibility_off';
    btn.style.color = InformesUI.verOcultos ? 'var(--accent)' : 'var(--text-secondary)';
  }
  renderInformes();
}

let _ocultarInformeId = null;

function ocultarInforme(infId) {
  _ocultarInformeId = infId;
  const inf = AppState.informes.find(i => i.id === infId);
  const { year, month } = AppState.informePeriod;
  const mes = MONTHS_ES[month] + ' ' + year;
  document.getElementById('ocultar-informe-nombre').textContent = inf ? inf.titulo : '';
  document.getElementById('ocultar-informe-mes').textContent = mes;
  document.getElementById('modal-ocultar-informe').classList.add('visible');
}

function confirmarOcultarInforme(desdeEste) {
  const infId = _ocultarInformeId;
  if (!infId) return;
  const { year, month } = AppState.informePeriod;
  const mesStr = year + '-' + String(month+1).padStart(2,'0');
  const ocultos = InformesUI.ocultos;
  if (desdeEste) {
    ocultos[infId] = mesStr;
  } else {
    if (!ocultos[infId] || typeof ocultos[infId] === 'string') {
      ocultos[infId] = { meses: [mesStr] };
    } else {
      ocultos[infId].meses = [...new Set([...(ocultos[infId].meses||[]), mesStr])];
    }
  }
  InformesUI.setOcultos(ocultos);
  document.getElementById('modal-ocultar-informe').classList.remove('visible');
  _ocultarInformeId = null;
  renderInformes();
}

let _mostrarInformeId = null;

function mostrarInforme(infId) {
  _mostrarInformeId = infId;
  const inf = AppState.informes.find(i => i.id === infId);
  const { year, month } = AppState.informePeriod;
  const mesStr = year + '-' + String(month+1).padStart(2,'0');
  const cfg = InformesUI.ocultos[infId];

  const esDesdeEste = typeof cfg === 'string';

  document.getElementById('mostrar-informe-nombre').textContent = inf ? inf.titulo : '';
  document.getElementById('mostrar-informe-mes').textContent = MONTHS_ES[month] + ' ' + year;

  const optAdelante = document.getElementById('mostrar-opt-adelante');
  optAdelante.style.display = esDesdeEste ? 'flex' : 'none';

  document.getElementById('modal-mostrar-informe').classList.add('visible');
}

function confirmarMostrarInforme(soloEsteMes) {
  const infId = _mostrarInformeId;
  if (!infId) return;
  const { year, month } = AppState.informePeriod;
  const mesStr = year + '-' + String(month+1).padStart(2,'0');
  const ocultos = InformesUI.ocultos;
  const cfg = ocultos[infId];

  if (soloEsteMes) {
    if (typeof cfg === 'string') {
      const [y, m] = cfg.split('-').map(Number);
      const mesActual = new Date(year, month, 1);
      const mesOrigen = new Date(y, m-1, 1);
      if (mesActual <= mesOrigen) {
        delete ocultos[infId];
      } else {
        const mesesOcultos = [];
        const cursor = new Date(mesOrigen);
        while (cursor <= mesActual) {
          const ms = cursor.getFullYear() + '-' + String(cursor.getMonth()+1).padStart(2,'0');
          if (ms !== mesStr) mesesOcultos.push(ms);
          cursor.setMonth(cursor.getMonth()+1);
        }
        if (mesesOcultos.length > 0) {
          ocultos[infId] = { meses: mesesOcultos };
        } else {
          delete ocultos[infId];
        }
      }
    } else if (cfg && cfg.meses) {
      ocultos[infId].meses = cfg.meses.filter(m => m !== mesStr);
      if (ocultos[infId].meses.length === 0) delete ocultos[infId];
    }
  } else {
    delete ocultos[infId];
  }

  InformesUI.setOcultos(ocultos);
  document.getElementById('modal-mostrar-informe').classList.remove('visible');
  _mostrarInformeId = null;
  renderInformes();
}

function toggleCollapseInforme(infId) {
  const collapsed = InformesUI.collapsed;
  if (collapsed.has(infId)) collapsed.delete(infId);
  else collapsed.add(infId);
  InformesUI.setCollapsed(collapsed);
  renderInformes();
}

let _ordenTemp = [];

function openOrdenarInformes() {
  _ordenTemp = [...AppState.informes];
  renderOrdenarList();
  openModal('modal-ordenar-informes');
}

function renderOrdenarList() {
  const container = document.getElementById('ordenar-informes-list');
  container.innerHTML = '';
  _ordenTemp.forEach((inf, idx) => {
    const row = document.createElement('div');
    row.className = 'orden-informe-row';
    row.innerHTML =
      '<span class="orden-informe-nombre">' + inf.titulo + '</span>' +
      '<button class="orden-btn" onclick="moverInforme(' + idx + ',-1)"' + (idx===0?' disabled':'') + '><span class="material-symbols-rounded" style="font-size:18px;">arrow_upward</span></button>' +
      '<button class="orden-btn" onclick="moverInforme(' + idx + ',1)"' + (idx===_ordenTemp.length-1?' disabled':'') + '><span class="material-symbols-rounded" style="font-size:18px;">arrow_downward</span></button>';
    container.appendChild(row);
  });
}

function moverInforme(idx, delta) {
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= _ordenTemp.length) return;
  const tmp = _ordenTemp[idx];
  _ordenTemp[idx] = _ordenTemp[newIdx];
  _ordenTemp[newIdx] = tmp;
  renderOrdenarList();
}

function saveOrdenInformes() {
  AppState.informes = _ordenTemp;
  localStorage.setItem('ts_inf_orden', JSON.stringify(_ordenTemp.map(i => i.id)));
  Storage.save();
  closeModal('modal-ordenar-informes');
  renderInformes();
}

function aplicarOrdenInformes() {
  const ordenRaw = localStorage.getItem('ts_inf_orden');
  if (!ordenRaw) return;
  try {
    const orden = JSON.parse(ordenRaw);
    AppState.informes.sort((a, b) => {
      const ia = orden.indexOf(a.id);
      const ib = orden.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  } catch(e) {}
}

function renderInformes() {
  const { year, month } = AppState.informePeriod;
  const mesStr = year + '-' + String(month+1).padStart(2,'0');
  const collapsed = InformesUI.collapsed;

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  document.getElementById('informe-period-label').textContent =
    DAYS_ES_LONG[firstDay.getDay()].slice(0,3).toLowerCase() + ', ' + firstDay.getDate() + ' de ' +
    MONTHS_ES[month].slice(0,3).toLowerCase() + '. \u2013 ' + lastDay.getDate() + ' de ' +
    MONTHS_ES[month].slice(0,3).toLowerCase() + '. de ' + year;

  const container = document.getElementById('informes-content');
  container.innerHTML = '';

  if (AppState.informes.length === 0) {
    container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-muted);"><span class="material-symbols-rounded" style="font-size:48px;display:block;margin-bottom:12px;opacity:0.3;">bar_chart</span><div style="font-size:16px;font-weight:500;margin-bottom:4px;">Sin informes</div><div style="font-size:13px;">Toca + para crear tu primer informe.</div></div>';
    return;
  }

  const informesDelMes = AppState.informes.filter(inf =>
    !inf.mesCreacion || inf.mesCreacion <= mesStr
  );

  const visibles = informesDelMes.filter(function(inf) { return !informeEstaOcultoEnMes(inf.id, mesStr); });
  const ocultos  = informesDelMes.filter(function(inf) { return  informeEstaOcultoEnMes(inf.id, mesStr); });

  const totalesMap = {};
  let granTotal = 0;
  informesDelMes.forEach(function(inf) {
    let total = calcHorasMes(inf.turnoIds, year, month) * (inf.salarioBase.valorHora || 0);
    (inf.pagosExtra || []).forEach(function(pe) {
      total += calcHorasMes(pe.turnoIds || [], year, month) * (pe.valorHora || 0);
    });
    (inf.pagosFijos || []).forEach(function(pf) {
      if (!pf.mes || pf.mes === mesStr) total += (pf.valor || 0);
    });
    totalesMap[inf.id] = total;
    if (!informeEstaOcultoEnMes(inf.id, mesStr)) granTotal += total;
  });

  const totalMesCard = document.createElement('div');
  totalMesCard.className = 'informe-card';
  totalMesCard.style.cssText = 'background:var(--today-bg);margin-bottom:16px;';
  totalMesCard.innerHTML =
    '<div class="informe-card-header" style="border-bottom-color:rgba(255,255,255,0.12);"><div class="informe-card-title" style="color:var(--today-text);font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Total mes</div></div>' +
    '<div style="padding:14px 16px 4px;"><span style="font-size:28px;font-weight:800;color:var(--today-text);letter-spacing:-0.5px;">' + formatMoney(granTotal) + '</span></div>' +
    visibles.map(function(inf) {
      return '<div style="display:flex;justify-content:space-between;padding:3px 16px;font-size:12px;"><span style="color:var(--today-text);opacity:0.7;">' + inf.titulo + '</span><span style="color:var(--today-text);opacity:0.85;font-weight:600;">' + formatMoney(totalesMap[inf.id]) + '</span></div>';
    }).join('') +
    '<div style="height:10px;"></div>';
  container.appendChild(totalMesCard);

  visibles.forEach(function(inf) {
    const isCollapsed = collapsed.has(inf.id);
    const total = totalesMap[inf.id];
    const card = document.createElement('div');
    card.className = 'informe-card' + (isCollapsed ? ' collapsed' : '');

    const header = document.createElement('div');
    header.className = 'informe-card-header';
    header.style.cursor = 'pointer';
    header.onclick = function() { toggleCollapseInforme(inf.id); };
    header.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">' +
        '<span class="material-symbols-rounded" style="font-size:18px;color:var(--text-muted);transition:transform 0.2s;transform:' + (isCollapsed?'rotate(-90deg)':'rotate(0deg)') + '">expand_more</span>' +
        '<div class="informe-card-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + inf.titulo + '</div>' +
      '</div>' +
      '<div class="informe-card-actions" onclick="event.stopPropagation()">' +
        '<button onclick="openModalInforme(\'' + inf.id + '\')" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--text-secondary);display:flex;" title="Editar"><span class="material-symbols-rounded" style="font-size:18px;">edit</span></button>' +
        '<button onclick="ocultarInforme(\'' + inf.id + '\')" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--text-secondary);display:flex;" title="Ocultar"><span class="material-symbols-rounded" style="font-size:18px;">visibility_off</span></button>' +
        '<button onclick="deleteInforme(\'' + inf.id + '\')" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--weekend);display:flex;" title="Eliminar"><span class="material-symbols-rounded" style="font-size:18px;">delete</span></button>' +
      '</div>';
    card.appendChild(header);

    const colDiv = document.createElement('div');
    colDiv.className = 'informe-total-collapsed';
    colDiv.textContent = formatMoney(total);
    card.appendChild(colDiv);

    const body = document.createElement('div');
    body.className = 'informe-card-body';
    const horasBase = calcHorasMes(inf.turnoIds, year, month);
    body.appendChild(makeInformePagoRow(inf.salarioBase.nombre, horasBase + 'h', formatMoney(horasBase * (inf.salarioBase.valorHora||0)), false));
    (inf.pagosExtra || []).forEach(function(pe) {
      const h = calcHorasMes(pe.turnoIds||[], year, month);
      body.appendChild(makeInformePagoRow(pe.nombre, h+'h', '+'+formatMoney(h*(pe.valorHora||0)), true));
    });
    (inf.pagosFijos || []).forEach(function(pf) {
      if (!pf.mes || pf.mes === mesStr) {
        const ml = pf.mes ? MONTHS_ES[parseInt(pf.mes.split('-')[1])-1]+' '+pf.mes.split('-')[0] : '';
        body.appendChild(makeInformePagoRow(pf.nombre, [pf.nota,ml].filter(Boolean).join(' \u00b7 '), '+'+formatMoney(pf.valor||0), true));
      }
    });
    card.appendChild(body);

    const avatarRow = document.createElement('div');
    avatarRow.className = 'informe-avatars';
    inf.turnoIds.slice(0,4).forEach(function(tid) {
      const s = AppState.shifts.find(function(x) { return x.id === tid; });
      if (!s) return;
      const av = document.createElement('div');
      av.className = 'informe-avatar-sm';
      av.style.backgroundColor = s.color;
      av.textContent = getInitials(s.lugar);
      avatarRow.appendChild(av);
    });
    if (inf.turnoIds.length > 4) {
      const more = document.createElement('div');
      more.className = 'informe-more-btn';
      more.innerHTML = '<span class="material-symbols-rounded" style="font-size:14px;">more_horiz</span>';
      avatarRow.appendChild(more);
    }
    card.appendChild(avatarRow);

    const totalRow = document.createElement('div');
    totalRow.className = 'informe-total-row';
    totalRow.innerHTML = '<span class="informe-total-label">Total</span><span class="informe-total-valor">' + formatMoney(total) + '</span>';
    card.appendChild(totalRow);

    container.appendChild(card);
  });

  if (InformesUI.verOcultos && ocultos.length > 0) {
    const sep = document.createElement('div');
    sep.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;padding:8px 4px 6px;';
    sep.textContent = 'Informes ocultos este mes';
    container.appendChild(sep);
    ocultos.forEach(function(inf) {
      const card = document.createElement('div');
      card.className = 'informe-card';
      card.style.opacity = '0.5';
      card.innerHTML =
        '<div class="informe-card-header">' +
          '<div style="display:flex;align-items:center;gap:8px;flex:1;">' +
            '<span class="material-symbols-rounded" style="font-size:18px;color:var(--text-muted);">visibility_off</span>' +
            '<div class="informe-card-title">' + inf.titulo + '</div>' +
          '</div>' +
          '<div class="informe-card-actions">' +
            '<button onclick="mostrarInforme(\'' + inf.id + '\')" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--accent);display:flex;" title="Reactivar"><span class="material-symbols-rounded" style="font-size:18px;">visibility</span></button>' +
          '</div>' +
        '</div>' +
        '<div style="padding:6px 16px 12px;font-size:13px;color:var(--text-muted);">' + formatMoney(totalesMap[inf.id]) + ' \u00b7 oculto este mes</div>';
      container.appendChild(card);
    });
  }
}

function makeInformePagoRow(nombre, sub, valor, positive) {
  const row = document.createElement('div');
  row.className = 'informe-pago-row';
  row.innerHTML = `
    <div>
      <div class="informe-pago-label">${nombre}</div>
      ${sub ? `<div class="informe-pago-sub">${sub}</div>` : ''}
    </div>
    <div class="informe-pago-valor ${positive ? 'positive' : ''}">${valor}</div>`;
  return row;
}

function deleteInforme(id) {
  if (!confirm('¿Eliminar este informe?')) return;
  AppState.informes = AppState.informes.filter(i => i.id !== id);
  persist('informe', 'delete', id);
  renderInformes();
}

function navigateInformePeriod(delta) {
  const { year, month } = AppState.informePeriod;
  AppState.informePeriod = delta === 1
    ? (month === 11 ? { year: year+1, month: 0  } : { year, month: month+1 })
    : (month === 0  ? { year: year-1, month: 11 } : { year, month: month-1 });
  AppState.currentDate = new Date(AppState.informePeriod.year, AppState.informePeriod.month, 1);

  const el = document.getElementById('informes-content');
  const animClass = delta > 0 ? 'anim-right' : 'anim-left';
  el.classList.remove('anim-right', 'anim-left');
  void el.offsetWidth;
  renderInformes();
  el.classList.add(animClass);
  el.addEventListener('animationend', () => el.classList.remove(animClass), { once: true });
}

document.getElementById('informe-prev').onclick = () => navigateInformePeriod(-1);
document.getElementById('informe-next').onclick = () => navigateInformePeriod(1);

/* ================================================================
   SECCIÓN 12b: MODAL DE INFORME
   ================================================================ */

const _informe = {
  id: null,
  turnosSeleccionados: new Set(),
  pagosExtra: [],
  pagosFijos: [],
  pagosFijosOtrosMeses: [],
};

function openModalInforme(informeId) {
  const inf = informeId ? AppState.informes.find(i => i.id === informeId) : null;
  const { year, month } = AppState.informePeriod;
  const mesStr = `${year}-${String(month+1).padStart(2,'0')}`;

  _informe.id = inf ? inf.id : null;
  document.getElementById('modal-informe-title').textContent = inf ? 'Editar Informe' : 'Nuevo Informe';
  document.getElementById('btn-guardar-informe').dataset.informeId = inf ? inf.id : '';

  document.getElementById('informe-titulo').value = inf ? inf.titulo : '';
  document.getElementById('informe-salario-nombre').value = inf ? (inf.salarioBase.nombre || 'Salario por hora') : 'Salario por hora';
  const vBase = inf ? (inf.salarioBase.valorHora || 0) : 0;
  document.getElementById('informe-salario-valor').value = vBase ? formatNumberInput(vBase) : '';

  _informe.turnosSeleccionados = new Set(inf ? inf.turnoIds : []);

  _informe.pagosExtra = inf ? (inf.pagosExtra || []).map(pe => ({
    ...pe, turnoIds: new Set(pe.turnoIds || [])
  })) : [];

  const todosPagosFijos = inf ? [...(inf.pagosFijos || [])] : [];
  _informe.pagosFijosOtrosMeses = todosPagosFijos.filter(pf =>
    pf.mes && pf.mes !== mesStr
  );
  _informe.pagosFijos = todosPagosFijos.filter(pf =>
    !pf.mes || pf.mes === mesStr
  );

  renderInformeTurnosList();
  renderPagosExtra();
  renderPagosFijos();

  document.getElementById('modal-informe').classList.add('visible');
}

function renderInformeTurnosList() {
  const container = document.getElementById('informe-turnos-list');
  container.innerHTML = '';

  if (AppState.shifts.length === 0) {
    container.innerHTML = '<div style="padding:12px 14px;font-size:13px;color:var(--text-muted);">Sin turnos creados.</div>';
    return;
  }

  AppState.shifts.forEach(shift => {
    const checked = _informe.turnosSeleccionados.has(shift.id);
    const row = document.createElement('div');
    row.className = 'informe-turno-check';
    row.onclick = () => {
      if (_informe.turnosSeleccionados.has(shift.id)) {
        _informe.turnosSeleccionados.delete(shift.id);
      } else {
        _informe.turnosSeleccionados.add(shift.id);
      }
      renderInformeTurnosList();
    };
    row.innerHTML = `
      <div class="check-box ${checked ? 'checked' : ''}"></div>
      <div style="width:28px;height:28px;border-radius:50%;background:${shift.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;">${getInitials(shift.lugar)}</div>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:500;color:var(--text-primary);">${shift.lugar} - ${shift.nombre}</div>
        <div style="font-size:12px;color:var(--text-muted);">${shift.allDay ? 'Todo el día' : formatTime(shift.inicio) + ' – ' + formatTime(shift.fin)}</div>
      </div>`;
    container.appendChild(row);
  });
}

function addPagoExtra() {
  _informe.pagosExtra.push({
    id: genUUID(),
    nombre: '',
    valorHora: 0,
    turnoIds: new Set(),
  });
  renderPagosExtra();
}

function renderPagosExtra() {
  const container = document.getElementById('informe-pagos-extra-container');
  container.innerHTML = '';
  _informe.pagosExtra.forEach((pe, idx) => {
    const block = document.createElement('div');
    block.className = 'pago-extra-block';
    block.innerHTML = `
      <div class="pago-block-title">
        <span>Pago por hora ${idx + 1}</span>
        <button class="pago-remove-btn" onclick="removePagoExtra(${idx})">
          <span class="material-symbols-rounded" style="font-size:16px;">close</span>
        </button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <label class="form-label" style="margin-bottom:4px;">Nombre</label>
          <input type="text" class="form-input" value="${pe.nombre}" oninput="_informe.pagosExtra[${idx}].nombre=this.value" placeholder="Ej: Presencial" style="font-size:13px;padding:8px 10px;">
        </div>
        <div>
          <label class="form-label" style="margin-bottom:4px;">Valor/hora</label>
          <div class="input-money-wrap">
            <span class="money-prefix">$</span>
            <input type="text" inputmode="decimal" class="form-input" value="${pe.valorHora ? formatNumberInput(pe.valorHora) : ''}" oninput="onMoneyInput(this, v => _informe.pagosExtra[${idx}].valorHora=v)" onblur="onMoneyBlur(this, v => _informe.pagosExtra[${idx}].valorHora=v)" placeholder="0" style="font-size:13px;padding:8px 10px 8px 22px;">
          </div>
        </div>
      </div>
      <label class="form-label" style="margin-bottom:4px;">Turnos que aplican</label>
      <div id="pe-turnos-${idx}" style="background:var(--bg-card);border-radius:8px;border:1px solid var(--border);overflow:hidden;"></div>`;
    container.appendChild(block);
    renderPagoExtraTurnos(idx);
  });
}

function renderPagoExtraTurnos(idx) {
  const container = document.getElementById(`pe-turnos-${idx}`);
  if (!container) return;
  container.innerHTML = '';
  AppState.shifts.forEach(shift => {
    const checked = _informe.pagosExtra[idx].turnoIds.has(shift.id);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border-light);cursor:pointer;';
    row.onclick = () => {
      if (_informe.pagosExtra[idx].turnoIds.has(shift.id)) {
        _informe.pagosExtra[idx].turnoIds.delete(shift.id);
      } else {
        _informe.pagosExtra[idx].turnoIds.add(shift.id);
      }
      renderPagoExtraTurnos(idx);
    };
    row.innerHTML = `
      <div class="check-box ${checked ? 'checked' : ''}"></div>
      <div style="width:22px;height:22px;border-radius:50%;background:${shift.color};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0;">${getInitials(shift.lugar)}</div>
      <span style="font-size:13px;color:var(--text-primary);">${shift.lugar} - ${shift.nombre}</span>`;
    container.appendChild(row);
  });
}

function removePagoExtra(idx) {
  _informe.pagosExtra.splice(idx, 1);
  renderPagosExtra();
}

function addPagoFijo() {
  _informe.pagosFijos.push({ id: genUUID(), nombre: '', valor: 0, nota: '', mes: null });
  renderPagosFijos();
}

function renderPagosFijos() {
  const container = document.getElementById('informe-pagos-fijos-container');
  container.innerHTML = '';

  const { year, month } = AppState.informePeriod;
  const mesActivoValue = `${year}-${String(month+1).padStart(2,'0')}`;
  const mesActivoLabel = `${MONTHS_ES[month]} ${year}`;

  _informe.pagosFijos.forEach((pf, idx) => {
    const block = document.createElement('div');
    block.className = 'pago-fijo-block';
    block.innerHTML = `
      <div class="pago-block-title">
        <span>Pago adicional ${idx + 1}</span>
        <button class="pago-remove-btn" onclick="removePagoFijo(${idx})">
          <span class="material-symbols-rounded" style="font-size:16px;">close</span>
        </button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <label class="form-label" style="margin-bottom:4px;">Nombre</label>
          <input type="text" class="form-input" value="${pf.nombre}" oninput="_informe.pagosFijos[${idx}].nombre=this.value" placeholder="Ej: Bono" style="font-size:13px;padding:8px 10px;">
        </div>
        <div>
          <label class="form-label" style="margin-bottom:4px;">Valor</label>
          <div class="input-money-wrap">
            <span class="money-prefix">$</span>
            <input type="text" inputmode="decimal" class="form-input" value="${pf.valor ? formatNumberInput(pf.valor) : ''}" oninput="onMoneyInput(this, v => _informe.pagosFijos[${idx}].valor=v)" onblur="onMoneyBlur(this, v => _informe.pagosFijos[${idx}].valor=v)" placeholder="0" style="font-size:13px;padding:8px 10px 8px 22px;">
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <label class="form-label" style="margin-bottom:4px;">Mes</label>
          <select class="form-input" oninput="_informe.pagosFijos[${idx}].mes=this.value||null" style="font-size:13px;padding:8px 10px;">
            <option value="" ${!pf.mes ? 'selected' : ''}>Todos los meses</option>
            <option value="${mesActivoValue}" ${pf.mes === mesActivoValue ? 'selected' : ''}>${mesActivoLabel}</option>
          </select>
        </div>
        <div>
          <label class="form-label" style="margin-bottom:4px;">Nota</label>
          <input type="text" class="form-input" value="${pf.nota || ''}" oninput="_informe.pagosFijos[${idx}].nota=this.value" placeholder="Descripción" style="font-size:13px;padding:8px 10px;">
        </div>
      </div>`;
    container.appendChild(block);
  });
}

function removePagoFijo(idx) {
  _informe.pagosFijos.splice(idx, 1);
  renderPagosFijos();
}

function saveInforme() {
  const titulo = document.getElementById('informe-titulo').value.trim();
  if (!titulo) { alert('Por favor ingresa un título para el informe.'); return; }

  const salarioBase = {
    nombre:    document.getElementById('informe-salario-nombre').value.trim() || 'Salario por hora',
    valorHora: parseMoney(document.getElementById('informe-salario-valor').value),
  };

  const pagosFijosCompletos = [
    ..._informe.pagosFijos,
    ...(_informe.pagosFijosOtrosMeses || []),
  ];

  const nuevoInforme = {
    id:           _informe.id || genUUID(),
    titulo,
    mesCreacion:  _informe.id
      ? (AppState.informes.find(i => i.id === _informe.id)?.mesCreacion || null)
      : (AppState.informePeriod.year + '-' + String(AppState.informePeriod.month+1).padStart(2,'0')),
    turnoIds:     [..._informe.turnosSeleccionados],
    salarioBase,
    pagosExtra: _informe.pagosExtra.map(pe => ({
      ...pe, turnoIds: [...pe.turnoIds]
    })),
    pagosFijos: pagosFijosCompletos,
  };

  if (_informe.id) {
    const idx = AppState.informes.findIndex(i => i.id === _informe.id);
    if (idx !== -1) AppState.informes[idx] = nuevoInforme;
  } else {
    AppState.informes.push(nuevoInforme);
  }

  persist('informe', 'upsert', nuevoInforme);
  closeModal('modal-informe');
  renderInformes();
}

/* ================================================================
   SECCIÓN 13: AJUSTES
   ================================================================ */

function setTheme(theme) {
  AppState.theme = theme;
  applyTheme();
  Storage.saveConfig();
  syncSettingsUI();
}

function applyTheme() {
  const theme = AppState.theme;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (theme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (AppState.theme === 'auto') applyTheme();
});

function setWeekStart(day) {
  AppState.weekStart = day;
  Storage.saveConfig();
  syncSettingsUI();
  renderCalendar();
}

function changeMaxShifts(delta) {
  const val = Math.max(1, Math.min(3, AppState.maxShiftsPerDay + delta));
  AppState.maxShiftsPerDay = val;
  document.getElementById('max-shifts-val').textContent = val;
  Storage.saveConfig();
  renderCalendar();
}

function syncSettingsUI() {
  document.querySelectorAll('#theme-control .segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === AppState.theme);
  });
  document.querySelectorAll('#weekstart-control .segment-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.start) === AppState.weekStart);
  });
  document.getElementById('max-shifts-val').textContent = AppState.maxShiftsPerDay;
}

/* ================================================================
   SECCIÓN 16: OVERRIDE DE HORARIO POR DÍA
   ================================================================ */

let _overrideAssignmentId = null;
let _overrideAllDay = false;

function openOverrideModal(assignmentId, dateStr) {
  _overrideAssignmentId = assignmentId;
  const assignment = AppState.assignments.find(a => a.id === assignmentId);
  if (!assignment) return;
  const shift = AppState.shifts.find(s => s.id === assignment.shiftId);
  if (!shift) return;

  document.getElementById('override-shift-name').textContent = `${shift.lugar} - ${shift.nombre}`;
  document.getElementById('override-inicio').value = assignment.overrideInicio || shift.inicio;
  document.getElementById('override-fin').value   = assignment.overrideFin    || shift.fin;
  _overrideAllDay = assignment.overrideAllDay !== undefined ? assignment.overrideAllDay : (shift.allDay || false);
  updateOverrideAlldayToggle();

  const [y, m, d] = dateStr.split('-').map(Number);
  document.getElementById('override-fecha-label').textContent =
    `Solo para el ${d} de ${MONTHS_ES[m-1]} de ${y}`;

  openModal('modal-override-horario');
}

function toggleOverrideAllDay() {
  _overrideAllDay = !_overrideAllDay;
  updateOverrideAlldayToggle();
}

function updateOverrideAlldayToggle() {
  const toggle = document.getElementById('override-allday-toggle');
  const finInput = document.getElementById('override-fin');
  if (_overrideAllDay) {
    toggle.classList.add('on');
    finInput.disabled = true;
  } else {
    toggle.classList.remove('on');
    finInput.disabled = false;
  }
}

function saveOverride() {
  const inicio = document.getElementById('override-inicio').value;
  const fin    = document.getElementById('override-fin').value;
  if (!_overrideAllDay && (!inicio || !fin)) {
    alert('Por favor completa los horarios o selecciona "Todo el día".');
    return;
  }
  const totalHoras = calcHoras(inicio, fin, _overrideAllDay);
  const idx = AppState.assignments.findIndex(a => a.id === _overrideAssignmentId);
  if (idx !== -1) {
    AppState.assignments[idx] = {
      ...AppState.assignments[idx],
      overrideInicio: _overrideAllDay ? null : inicio,
      overrideFin:    _overrideAllDay ? null : fin,
      overrideAllDay: _overrideAllDay,
      overrideHoras:  totalHoras,
    };
    persist('assignment', 'upsert', AppState.assignments[idx]);
  }
  closeModal('modal-override-horario');
  renderCalendar();
  if (AppState.selectedDate) renderSheetContent(AppState.selectedDate);
}

function resetOverride() {
  const idx = AppState.assignments.findIndex(a => a.id === _overrideAssignmentId);
  if (idx !== -1) {
    delete AppState.assignments[idx].overrideInicio;
    delete AppState.assignments[idx].overrideFin;
    delete AppState.assignments[idx].overrideAllDay;
    delete AppState.assignments[idx].overrideHoras;
    persist('assignment', 'upsert', AppState.assignments[idx]);
  }
  closeModal('modal-override-horario');
  renderCalendar();
  if (AppState.selectedDate) renderSheetContent(AppState.selectedDate);
}

/* ================================================================
   SECCIÓN 15: INICIALIZACIÓN
   ================================================================ */

function init() {
  Storage.load();
  aplicarOrdenInformes();
  applyTheme();
  syncSettingsUI();
  renderCalendar();
  renderShiftsList();

  const now = new Date();
  AppState.informePeriod = { year: now.getFullYear(), month: now.getMonth() };
  renderInformes();
  renderColorGrid();

  document.getElementById('fab-turnos').style.display   = 'none';
  document.getElementById('fab-informes').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', init);
