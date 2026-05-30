# WebApps — Monorepo

Dos aplicaciones web progresivas (PWA) independientes, de una sola página y sin framework de build. Creadas por **Sergio Mozo**.

---

## FinanzApp

Gestor de finanzas personales. Todo el UI en español, moneda en COP.

### Funcionalidades

- **Dashboard** — Resumen con widgets personalizables (balance, gastos del mes, ingresos, ahorro, tarjetas, presupuestos, metas, deudas próximas, gastos recurrentes). Los widgets se reordenan y ocultan a gusto.
- **Transacciones** — Registro de ingresos, gastos y transferencias. Filtros por tipo, mes y categoría.
- **Cuentas** — Cuentas de ahorro y efectivo. Transferencias entre cuentas.
- **Tarjetas de crédito** — Límites, saldo actual, días de cierre y pago.
- **Gastos recurrentes** — Suscripciones y pagos fijos con frecuencia mensual, semanal, quincenal o anual. Cargo automático programable.
- **Presupuestos** — Presupuestos mensuales o anuales por categoría.
- **Metas de ahorro** — Metas con monto objetivo, progreso y fecha límite.
- **Deudas** — Deudas bidireccionales: lo que debes (`owe`) y lo que te deben (`owed`). Con intereses, cuota mensual, día de pago, y registro de abonos desde transacciones.
- **Reportes** — Gráficos de ingresos vs gastos, evolución mensual, distribución por categoría.
- **Categorías** — Personalizables por tipo (ingreso/gasto), con icono y color.
- **Modo oscuro** — Auto/claro/oscuro.
- **Supabase opcional** — Sin configuración funciona en modo demo con datos en memoria.

### Tecnologías

- Tailwind CSS + DaisyUI
- Chart.js 4.4.2
- Supabase JS 2.39.7
- Lucide Icons
- Google Fonts (Inter)

---

## ShifTurnos

Gestor de turnos y horarios laborales.

### Funcionalidades

- **Calendario** — Vista mensual con turnos asignados por día. Límite configurable de turnos visibles por día (1-3). Navegación por swipe o botones.
- **Turnos** — CRUD de turnos con lugar, nombre, horario (inicio-fin o día completo), horas totales y color. Ordenables A-Z o por lugar.
- **Asignaciones** — Arrastra turnos al calendario. Soporta sobrescritura de horario por fecha específica sin perder el historial.
- **Eventos** — Eventos puntuales en el calendario.
- **Informes** — Cálculo de salario por período: salario base por hora, pagos extra (con selección de turnos específicos), pagos fijos mensuales o únicos.
- **Tema** — Claro, oscuro o automático.
- **Primer día de semana** — Configurable: domingo o lunes.
- **Supabase opcional** — Persistencia en la nube.
- **PWA** — Instalable en dispositivos móviles, con service worker.

### Tecnologías

- Tailwind CSS v3
- Supabase JS v2
- Material Symbols Rounded
- Google Fonts (DM Sans + DM Serif Display)

---

## Base de datos

Ambas apps usan Supabase (PostgreSQL) con esquemas independientes. RLS desactivado (apps de un solo usuario).

### FinanzApp — 8 tablas

| Tabla | Propósito |
|---|---|
| `categories` | Categorías de ingresos y gastos |
| `accounts` | Cuentas bancarias y efectivo |
| `credit_cards` | Tarjetas de crédito |
| `debts` | Deudas (debes / te deben) |
| `recurring_expenses` | Gastos recurrentes o suscripciones |
| `budgets` | Presupuestos mensuales/anuales |
| `savings_goals` | Metas de ahorro |
| `transactions` | Ingresos, gastos y transferencias |

### ShifTurnos — 4 tablas

| Tabla | Propósito |
|---|---|
| `turnos` | Definición de turnos (lugar, horario, color) |
| `asignaciones` | Asignación de turnos a fechas específicas |
| `eventos` | Eventos puntuales |
| `informes` | Configuración de informes de salario |

---

## Desarrollo

No requiere build system ni dependencias. Las apps se abren directamente en el navegador o se sirven con cualquier servidor estático:

```bash
python3 -m http.server 8080
```

Flujo de trabajo: editar `index.html`, refrescar el navegador.

### Archivos importantes

| Ruta | Descripción |
|---|---|
| `FinanzApp/index.html` | App principal de FinanzApp (HTML+CSS+JS inline) |
| `FinanzApp/styles.css` | Estilos adicionales de FinanzApp |
| `FinanzApp/app.js` | Lógica JS de FinanzApp |
| `FinanzApp/manifest.json` | Manifiesto PWA |
| `FinanzApp/base de datos.sql` | Esquema SQL de FinanzApp |
| `ShifTurnos/index.html` | App principal de ShifTurnos |
| `ShifTurnos/css/` | Estilos de ShifTurnos |
| `ShifTurnos/js/` | Lógica JS de ShifTurnos |
| `ShifTurnos/manifest.json` | Manifiesto PWA |
| `ShifTurnos/sw.js` | Service worker |
| `ShifTurnos/base de datos.sql` | Esquema SQL de ShifTurnos |

---

## Licencia

Uso personal.
