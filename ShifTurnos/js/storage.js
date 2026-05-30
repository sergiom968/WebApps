const Storage = {
  load() {
    const raw = localStorage.getItem('turnoshift_data');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        Storage._applyData(data);
      } catch(e) {
        console.error('Error leyendo localStorage', e);
        Storage.initDemo();
      }
    } else {
      Storage.initDemo();
    }

    const cfg = localStorage.getItem('turnoshift_config');
    if (cfg) {
      try {
        const c = JSON.parse(cfg);
        AppState.weekStart        = c.weekStart        ?? 1;
        AppState.maxShiftsPerDay  = c.maxShiftsPerDay  ?? 3;
        AppState.theme            = c.theme            ?? 'auto';
      } catch(e) {}
    }

    const supaRaw = localStorage.getItem('turnoshift_supabase');
    if (supaRaw) {
      try {
        const s = JSON.parse(supaRaw);
        document.getElementById('supa-url').value = s.url || '';
        document.getElementById('supa-key').value = s.key || '';
        if (s.url && s.key) {
          initSupabase(s.url, s.key);
        }
      } catch(e) {}
    }
  },

  initDemo() {
    AppState.shifts      = [...DEMO_SHIFTS];
    AppState.assignments = [...DEMO_ASSIGNMENTS];
    AppState.events      = [...DEMO_EVENTS];
    AppState.informes    = DEMO_INFORMES.map(i => ({...i}));
    Storage.save();
  },

  _applyData(data) {
    AppState.shifts      = data.shifts      || [];
    AppState.assignments = data.assignments || [];
    AppState.events      = data.events      || [];
    AppState.informes    = data.informes    || [];
  },

  save() {
    localStorage.setItem('turnoshift_data', JSON.stringify({
      shifts:      AppState.shifts,
      assignments: AppState.assignments,
      events:      AppState.events,
      informes:    AppState.informes,
    }));
  },

  saveConfig() {
    localStorage.setItem('turnoshift_config', JSON.stringify({
      weekStart:       AppState.weekStart,
      maxShiftsPerDay: AppState.maxShiftsPerDay,
      theme:           AppState.theme,
    }));
  },

  saveSupabase(url, key) {
    localStorage.setItem('turnoshift_supabase', JSON.stringify({ url, key }));
  },
};
