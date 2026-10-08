// Conjunto de prueba fijo de la Fase 1 (historial de capital).
// "Hoy" en los tests = 2026-10-08. Capital inicial 5000.
// Capital actual esperado sin eventos: 5000 + 100 + 50 - 30 + 120 + 80 - 40 + 60 = 5340.

function t(id, date, symbol, direction, setup, pnl, closeDate) {
  return {
    id, date, symbol, direction, setup, pnl,
    entry: '', stop: '', exit: '', notes: '',
    closeDate, hasImage: false
  };
}

const INITIAL_CAPITAL = 5000;

const trades = [
  t(1001, '2026-08-10', 'EURUSD', 'LONG',  'Ruptura',  '100', '2026-08-10'),
  t(1002, '2026-08-20', 'GBPUSD', 'SHORT', 'Pullback', '50',  '2026-08-20'),
  t(1003, '2026-09-05', 'XAUUSD', 'LONG',  'Ruptura',  '-30', '2026-09-05'),
  t(1004, '2026-09-28', 'EURUSD', 'LONG',  'Pullback', '120', '2026-09-28'),
  // Abierto el 30/09 y cerrado el 05/10 (la fecha efectiva es la de cierre)
  t(1005, '2026-09-30', 'NQ',     'SHORT', 'Ruptura',  '60',  '2026-10-05'),
  t(1006, '2026-10-02', 'GBPUSD', 'LONG',  'Pullback', '80',  '2026-10-02'),
  t(1007, '2026-10-06', 'XAUUSD', 'SHORT', 'Ruptura',  '-40', '2026-10-06'),
  // Abierto, sin P&L
  t(1008, '2026-10-07', 'EURUSD', 'LONG',  '',         '',    '')
];

const EXPECTED_CURRENT_CAPITAL = 5340;

// Eventos de capital (ids crecientes)
const EV_REBASE   = { id: 1, date: '2026-10-08', capital: 6000, adjustment: 660,  rebase: true  };
const EV_ADJ_ONLY = { id: 2, date: '2026-10-08', capital: 6000, adjustment: 660,  rebase: false };
const EV_REBASE_2 = { id: 3, date: '2026-10-08', capital: 6500, adjustment: 500,  rebase: true  };
const EV_PAST     = { id: 4, date: '2026-09-01', capital: 5200, adjustment: 200,  rebase: false };
const EV_NEG      = { id: 5, date: '2026-09-20', capital: 5000, adjustment: -150, rebase: true  };

module.exports = {
  INITIAL_CAPITAL, trades, EXPECTED_CURRENT_CAPITAL,
  EV_REBASE, EV_ADJ_ONLY, EV_REBASE_2, EV_PAST, EV_NEG
};
