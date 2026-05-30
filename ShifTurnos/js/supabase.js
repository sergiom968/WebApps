const DB = {
  async testConnection() {
    if (!AppState.supabaseClient) return { ok: false, error: 'Sin cliente' };
    try {
      const { error } = await AppState.supabaseClient
        .from('turnos').select('id').limit(1);
      if (error) return { ok: false, error: error.message };
      return { ok: true, error: null };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  },

  async loadAll() {
    const sb = AppState.supabaseClient;
    const [t, a, e, i] = await Promise.all([
      sb.from('turnos').select('*'),
      sb.from('asignaciones').select('*'),
      sb.from('eventos').select('*'),
      sb.from('informes').select('*'),
    ]);

    if (t.error || a.error || e.error || i.error) {
      console.error('Error cargando:', t.error || a.error || e.error || i.error);
      return false;
    }

    AppState.shifts = (t.data || []).map(r => ({
      id: r.id, lugar: r.lugar, nombre: r.nombre,
      inicio: r.inicio, fin: r.fin, allDay: r.all_day,
      totalHoras: parseFloat(r.total_horas), color: r.color,
    }));

    AppState.assignments = (a.data || []).map(r => ({
      id: r.id, shiftId: r.turno_id, fecha: r.fecha,
      overrideInicio: r.override_inicio,
      overrideFin:    r.override_fin,
      overrideAllDay: r.override_all_day,
      overrideHoras:  r.override_horas !== null ? parseFloat(r.override_horas) : undefined,
    }));

    AppState.events = (e.data || []).map(r => ({
      id: r.id, nombre: r.nombre, fecha: r.fecha, inicio: r.inicio, fin: r.fin,
    }));

    AppState.informes = (i.data || []).map(r => ({
      id: r.id, titulo: r.titulo,
      mesCreacion: r.mes_creacion || null,
      turnoIds:    r.turno_ids    || [],
      salarioBase: r.salario_base || { nombre: 'Salario por hora', valorHora: 0 },
      pagosExtra:  r.pagos_extra  || [],
      pagosFijos:  r.pagos_fijos  || [],
    }));

    aplicarOrdenInformes();
    return true;
  },

  async upsertShift(shift) {
    if (!AppState.supabaseClient) return;
    const { error } = await AppState.supabaseClient.from('turnos').upsert({
      id: shift.id,
      lugar: shift.lugar, nombre: shift.nombre,
      inicio: shift.inicio, fin: shift.fin,
      all_day: shift.allDay, total_horas: shift.totalHoras, color: shift.color,
    }, { onConflict: 'id' });
    if (error) { console.error('upsertShift:', error.message); throw error; }
  },

  async deleteShift(id) {
    if (!AppState.supabaseClient) return;
    const { error } = await AppState.supabaseClient
      .from('turnos').delete().eq('id', id);
    if (error) { console.error('deleteShift:', error.message); throw error; }
  },

  async upsertAssignment(a) {
    if (!AppState.supabaseClient) return;
    const { error } = await AppState.supabaseClient.from('asignaciones').upsert({
      id: a.id, turno_id: a.shiftId, fecha: a.fecha,
      override_inicio:  a.overrideInicio  ?? null,
      override_fin:     a.overrideFin     ?? null,
      override_all_day: a.overrideAllDay  ?? null,
      override_horas:   a.overrideHoras   ?? null,
    }, { onConflict: 'id' });
    if (error) { console.error('upsertAssignment:', error.message); throw error; }
  },

  async deleteAssignment(id) {
    if (!AppState.supabaseClient) return;
    const { error } = await AppState.supabaseClient
      .from('asignaciones').delete().eq('id', id);
    if (error) { console.error('deleteAssignment:', error.message); throw error; }
  },

  async deleteAssignmentsByShift(shiftId) {
    if (!AppState.supabaseClient) return;
    const { error } = await AppState.supabaseClient
      .from('asignaciones').delete().eq('turno_id', shiftId);
    if (error) { console.error('deleteAssignmentsByShift:', error.message); throw error; }
  },

  async upsertEvento(ev) {
    if (!AppState.supabaseClient) return;
    const { error } = await AppState.supabaseClient.from('eventos').upsert({
      id: ev.id, nombre: ev.nombre, fecha: ev.fecha, inicio: ev.inicio, fin: ev.fin,
    }, { onConflict: 'id' });
    if (error) { console.error('upsertEvento:', error.message); throw error; }
  },

  async deleteEvento(id) {
    if (!AppState.supabaseClient) return;
    const { error } = await AppState.supabaseClient
      .from('eventos').delete().eq('id', id);
    if (error) { console.error('deleteEvento:', error.message); throw error; }
  },

  async upsertInforme(inf) {
    if (!AppState.supabaseClient) return;
    const { error } = await AppState.supabaseClient.from('informes').upsert({
      id: inf.id, titulo: inf.titulo,
      mes_creacion: inf.mesCreacion || null,
      turno_ids:    inf.turnoIds,
      salario_base: inf.salarioBase,
      pagos_extra:  inf.pagosExtra,
      pagos_fijos:  inf.pagosFijos,
    }, { onConflict: 'id' });
    if (error) { console.error('upsertInforme:', error.message); throw error; }
  },

  async deleteInforme(id) {
    if (!AppState.supabaseClient) return;
    const { error } = await AppState.supabaseClient
      .from('informes').delete().eq('id', id);
    if (error) { console.error('deleteInforme:', error.message); throw error; }
  },
};

async function persist(type, op, payload) {
  Storage.save();
  if (!AppState.supabaseConnected) return;
  try {
    if      (type === 'shift'      && op === 'upsert') await DB.upsertShift(payload);
    else if (type === 'shift'      && op === 'delete') await DB.deleteShift(payload);
    else if (type === 'assignment' && op === 'upsert') await DB.upsertAssignment(payload);
    else if (type === 'assignment' && op === 'delete') await DB.deleteAssignment(payload);
    else if (type === 'evento'     && op === 'upsert') await DB.upsertEvento(payload);
    else if (type === 'evento'     && op === 'delete') await DB.deleteEvento(payload);
    else if (type === 'informe'    && op === 'upsert') await DB.upsertInforme(payload);
    else if (type === 'informe'    && op === 'delete') await DB.deleteInforme(payload);
  } catch(e) {
    showToast('\u26A0\uFE0F Error sincronizando: ' + e.message, 'error');
  }
}

async function initSupabase(url, key, showFeedback = false) {
  const btn = document.getElementById('btn-supa-connect');
  if (btn) { btn.disabled = true; btn.textContent = 'Conectando...'; }

  try {
    AppState.supabaseClient = supabase.createClient(url, key, {
      global: {
        headers: {
          'apikey': key,
          'Authorization': 'Bearer ' + key,
        }
      }
    });
    const { ok, error } = await DB.testConnection();

    if (!ok) {
      AppState.supabaseConnected = false;
      AppState.supabaseClient = null;
      let userMsg = error || 'Error desconocido';
      if (userMsg.includes('401') || userMsg.toLowerCase().includes('unauthorized')) {
        userMsg = '401 No autorizado — Verifica que el Anon Key sea correcto y que RLS esté desactivado en las tablas (ver SQL).';
      } else if (userMsg.includes('Failed to fetch') || userMsg.includes('NetworkError')) {
        userMsg = 'No se pudo alcanzar el servidor — Verifica la URL del proyecto.';
      }
      updateSupabaseStatus(false, userMsg);
      if (showFeedback) showToast('\u274C ' + userMsg, 'error');
      return;
    }

    AppState.supabaseConnected = true;
    updateSupabaseStatus(true);

    const loaded = await DB.loadAll();
    if (loaded) {
      localStorage.removeItem('turnoshift_data');
      if (showFeedback) showToast('\u2705 Conectado a Supabase. Datos cargados.', 'success');
      renderCalendar();
      renderShiftsList();
      renderInformes();
    } else {
      if (showFeedback) showToast('\u2705 Conectado. Sin datos remotos aún.', 'success');
    }

  } catch(e) {
    AppState.supabaseConnected = false;
    AppState.supabaseClient = null;
    updateSupabaseStatus(false, e.message);
    if (showFeedback) showToast('\u274C Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar y conectar'; }
  }
}

function updateSupabaseStatus(connected, errorMsg) {
  const badge = document.getElementById('supabase-status-badge');
  if (!badge) return;
  badge.className = 'supabase-status ' + (connected ? 'connected' : 'disconnected');
  badge.innerHTML = `<span class="status-dot"></span> ${connected ? 'Conectado' : 'No conectado'}`;
  const errEl = document.getElementById('supabase-error-msg');
  if (errEl) errEl.textContent = (!connected && errorMsg) ? errorMsg : '';
}

async function saveSupabaseConfig() {
  const url = document.getElementById('supa-url').value.trim();
  const key = document.getElementById('supa-key').value.trim();
  if (!url || !key) {
    alert('Por favor completa la URL y la clave de Supabase.');
    return;
  }
  Storage.saveSupabase(url, key);
  await initSupabase(url, key, true);
}

function showToast(msg, type = 'success') {
  const existing = document.getElementById('ts-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'ts-toast';
  const bg = type === 'success' ? '#22C55E' : '#EF4444';
  toast.style.cssText = `
    position:fixed; bottom:calc(env(safe-area-inset-bottom) + 90px); left:50%;
    transform:translateX(-50%) translateY(10px);
    background:${bg}; color:#fff; padding:10px 20px; border-radius:20px;
    font-size:14px; font-weight:600; font-family:'DM Sans',sans-serif;
    box-shadow:0 4px 20px rgba(0,0,0,0.25); z-index:9999;
    opacity:0; transition:opacity 0.25s ease, transform 0.25s ease;
    max-width:320px; text-align:center;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  }));
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
