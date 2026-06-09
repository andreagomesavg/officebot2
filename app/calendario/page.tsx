"use client";
import { HistorialEntry, Persona, SemanaHistorial } from '@/types';
import { useEffect, useState } from 'react';

// ── helpers de fecha ──────────────────────────────────────────────────────────

function getLunesDeSemana(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day2 = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day2}`;
}

function formatRangoSemana(lunes: string): string {
  const d = new Date(lunes + 'T00:00:00');
  const viernes = new Date(d);
  viernes.setDate(d.getDate() + 4);
  const optsA: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short' };
  const optsB: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
  return (
    d.toLocaleDateString('es-ES', optsA).toUpperCase() +
    ' – ' +
    viernes.toLocaleDateString('es-ES', optsB).toUpperCase()
  );
}

function agruparPorSemana(entries: HistorialEntry[]): SemanaHistorial[] {
  const map = new Map<string, SemanaHistorial>();
  for (const e of entries) {
    if (!map.has(e.semana)) map.set(e.semana, { semana: e.semana, almuerzo: [], limpieza: [] });
    const s = map.get(e.semana)!;
    if (e.tipo === 'almuerzo') s.almuerzo.push(e);
    else s.limpieza.push(e);
  }
  for (const s of map.values()) {
    const uniq = (arr: HistorialEntry[]) => {
      const seen = new Set<string>();
      return arr.filter(e => { const k = e.persona_nombre; return seen.has(k) ? false : (seen.add(k), true); });
    };
    s.almuerzo = uniq(s.almuerzo);
    s.limpieza = uniq(s.limpieza);
  }
  return Array.from(map.values()).sort((a, b) => b.semana.localeCompare(a.semana));
}

// ── helpers de calendario ─────────────────────────────────────────────────────

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function primerDiaSemana(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function diasEnMes(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ── tipos del formulario de edición ──────────────────────────────────────────

interface EditState {
  almuerzo1: string; // persona_nombre o ''
  almuerzo2: string;
  limpieza: string;
}

// ── componente principal ──────────────────────────────────────────────────────

export default function CalendarioPage() {
  const [semanas, setSemanas] = useState<SemanaHistorial[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [edit, setEdit] = useState<EditState>({ almuerzo1: '', almuerzo2: '', limpieza: '' });

  const hoy = new Date();
  const semanaActual = getLunesDeSemana(hoy);

  const [viewYear, setViewYear] = useState(hoy.getFullYear());
  const [viewMonth, setViewMonth] = useState(hoy.getMonth());
  const [semanaSel, setSemanaSel] = useState<string | null>(null);

  useEffect(() => {
    fetchPersonas();
    fetchHistorial();
  }, []);

  const fetchPersonas = async () => {
    try {
      const res = await fetch('/api/personas');
      const data = await res.json();
      setPersonas(Array.isArray(data) ? data.sort((a: Persona, b: Persona) => a.nombre.localeCompare(b.nombre)) : []);
    } catch { /* silencioso */ }
  };

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/historial');
      const data = await res.json();
      const agrupadas = Array.isArray(data) ? agruparPorSemana(data) : [];
      setSemanas(agrupadas);
      if (agrupadas.length > 0) {
        const reciente = agrupadas[0];
        setSemanaSel(reciente.semana);
        const d = new Date(reciente.semana + 'T00:00:00');
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const eliminarSemana = async (semana: string) => {
    setEliminando(semana);
    try {
      await fetch(`/api/historial?semana=${semana}`, { method: 'DELETE' });
      await fetchHistorial();
      setSemanaSel(null);
      setEditando(false);
    } catch {
      alert('Error al eliminar el registro.');
    } finally {
      setEliminando(null);
      setConfirmarEliminar(false);
    }
  };

  const entrarEdicion = (detalle: SemanaHistorial | null) => {
    setEdit({
      almuerzo1: detalle?.almuerzo[0]?.persona_nombre ?? '',
      almuerzo2: detalle?.almuerzo[1]?.persona_nombre ?? '',
      limpieza: detalle?.limpieza[0]?.persona_nombre ?? '',
    });
    setEditando(true);
  };

  const guardarEdicion = async () => {
    if (!semanaSel) return;
    setGuardando(true);
    try {
      const entries: { tipo: 'almuerzo' | 'limpieza'; persona_id: number; persona_nombre: string }[] = [];
      for (const nombre of [edit.almuerzo1, edit.almuerzo2].filter(Boolean)) {
        const p = personas.find(x => x.nombre === nombre);
        if (p) entries.push({ tipo: 'almuerzo', persona_id: p.id, persona_nombre: p.nombre });
      }
      if (edit.limpieza) {
        const p = personas.find(x => x.nombre === edit.limpieza);
        if (p) entries.push({ tipo: 'limpieza', persona_id: p.id, persona_nombre: p.nombre });
      }

      // PUT hace el diff en el servidor y ajusta veces automáticamente
      const res = entries.length === 0
        ? await fetch(`/api/historial?semana=${semanaSel}`, { method: 'DELETE' })
        : await fetch('/api/historial', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ semana: semanaSel, entries }),
          });

      if (!res.ok) throw new Error();
      await fetchHistorial();
      setEditando(false);
    } catch {
      alert('Error al guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  };

  const semanasConDatos = new Set(semanas.map(s => s.semana));
  const detalleSel = semanas.find(s => s.semana === semanaSel) ?? null;

  const prevMes = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMes = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const offset = primerDiaSemana(viewYear, viewMonth);
  const totalDias = diasEnMes(viewYear, viewMonth);
  const celdas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanaDeDia = (dia: number) =>
    getLunesDeSemana(new Date(viewYear, viewMonth, dia));

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, system-ui, sans-serif; background: #f8f9fa; color: #1a1a1a; }

        .cal-layout {
          display: flex; gap: 24px; padding: 40px 24px;
          max-width: 860px; margin: 0 auto; align-items: flex-start;
        }

        .cal-left { flex: 0 0 300px; position: sticky; top: 80px; }

        .cal-card {
          background: #fff; border: 1px solid #e5e7eb;
          border-radius: 14px; padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .cal-nav {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 16px;
        }
        .cal-nav h2 { font-size: 15px; font-weight: 800; }
        .cal-nav button {
          background: none; border: none; cursor: pointer;
          font-size: 18px; color: #888; padding: 4px 8px;
          border-radius: 6px; line-height: 1;
        }
        .cal-nav button:hover { background: #f3f4f6; color: #1a1a1a; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .cal-day-header {
          text-align: center; font-size: 10px; font-weight: 800;
          color: #bbb; text-transform: uppercase; padding: 4px 0 6px; letter-spacing: 0.04em;
        }
        .cal-cell {
          aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 500; border-radius: 6px;
          cursor: pointer; transition: background 0.15s; color: #444; position: relative;
        }
        .cal-cell.empty { cursor: default; }
        .cal-cell.has-data { font-weight: 700; color: #1a1a1a; }
        .cal-cell.has-data::after {
          content: ''; position: absolute; bottom: 3px; left: 50%;
          transform: translateX(-50%); width: 4px; height: 4px;
          border-radius: 50%; background: #df30a4;
        }
        .cal-cell.selected { background: #df30a4 !important; color: #fff !important; font-weight: 800; }
        .cal-cell.selected::after { background: rgba(255,255,255,0.7); }
        .cal-cell.in-selected-week { background: rgba(223,48,164,0.08); color: #df30a4; font-weight: 700; }
        .cal-cell.today { outline: 2px solid #df30a4; outline-offset: -2px; }
        .cal-cell:not(.empty):not(.selected):hover { background: #f3f4f6; }

        .cal-right { flex: 1; min-width: 0; }

        .detalle-card {
          background: #fff; border: 1px solid #e5e7eb;
          border-radius: 14px; padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06); min-height: 240px;
        }
        .detalle-card.semana-actual {
          border-color: #df30a4;
          box-shadow: 0 0 0 2px rgba(223,48,164,0.1), 0 2px 8px rgba(0,0,0,0.06);
        }
        .detalle-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 20px; gap: 12px;
        }
        .detalle-semana-label {
          font-size: 12px; font-weight: 800; color: #aaa;
          text-transform: uppercase; letter-spacing: 0.08em;
          display: flex; align-items: center; gap: 8px;
        }
        .current-tag {
          background: #df30a4; color: #fff; font-size: 9px;
          font-weight: 800; padding: 2px 8px; border-radius: 99px; letter-spacing: 0.1em;
        }
        .header-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .btn-icon {
          background: none; border: 1px solid #e5e7eb; cursor: pointer;
          color: #888; font-size: 12px; font-weight: 700;
          padding: 5px 10px; border-radius: 6px;
          transition: all 0.15s; display: flex; align-items: center; gap: 4px;
        }
        .btn-icon:hover { border-color: #df30a4; color: #df30a4; background: rgba(223,48,164,0.04); }
        .btn-icon.danger:hover { border-color: #e53e3e; color: #e53e3e; background: #fff5f5; }

        .turnos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 500px) { .turnos-grid { grid-template-columns: 1fr; } }
        .turno-bloque { background: #f8f9fa; border-radius: 10px; padding: 14px 16px; }
        .turno-titulo {
          font-size: 11px; font-weight: 800; color: #aaa;
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px;
        }
        .turno-persona { font-size: 14px; font-weight: 600; color: #1a1a1a; padding: 3px 0; }
        .turno-empty { font-size: 13px; color: #ccc; font-style: italic; }

        /* edit mode */
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 500px) { .edit-grid { grid-template-columns: 1fr; } }
        .edit-bloque { background: #f8f9fa; border-radius: 10px; padding: 14px 16px; }
        .edit-label {
          font-size: 11px; font-weight: 800; color: #aaa;
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px;
        }
        .edit-select {
          width: 100%; background: #fff; border: 1px solid #e5e7eb;
          border-radius: 7px; padding: 8px 10px; font-size: 13px;
          font-weight: 600; color: #1a1a1a; cursor: pointer;
          margin-bottom: 8px; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center;
          padding-right: 28px;
        }
        .edit-select:last-child { margin-bottom: 0; }
        .edit-select:focus { outline: 2px solid #df30a4; border-color: transparent; }
        .edit-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
        .btn-save {
          background: #df30a4; color: #fff; border: none;
          border-radius: 8px; padding: 9px 20px; font-size: 13px;
          font-weight: 700; cursor: pointer; transition: background 0.15s;
        }
        .btn-save:hover:not(:disabled) { background: #b01e7a; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-cancel-edit {
          background: #f3f4f6; color: #555; border: none;
          border-radius: 8px; padding: 9px 20px; font-size: 13px;
          font-weight: 600; cursor: pointer;
        }
        .btn-cancel-edit:hover { background: #e5e7eb; }

        .placeholder {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; min-height: 200px; color: #ccc; gap: 10px;
        }
        .placeholder span { font-size: 36px; }
        .placeholder p { font-size: 14px; }

        .confirm-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.25);
          display: flex; align-items: center; justify-content: center; z-index: 100;
        }
        .confirm-box {
          background: #fff; border-radius: 14px; padding: 24px 28px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.18); max-width: 320px; width: 100%; text-align: center;
        }
        .confirm-box p { font-size: 15px; color: #333; margin-bottom: 6px; font-weight: 600; }
        .confirm-box small { font-size: 12px; color: #aaa; display: block; margin-bottom: 20px; }
        .confirm-actions { display: flex; gap: 10px; justify-content: center; }
        .btn-confirmar-eliminar {
          background: #e53e3e; color: #fff; border: none;
          border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .btn-cancelar-eliminar {
          background: #f3f4f6; color: #555; border: none;
          border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer;
        }

        @media (max-width: 620px) {
          .cal-layout { flex-direction: column; padding: 24px 16px; }
          .cal-left { flex: none; width: 100%; position: static; }
        }
      `}</style>

      <div className="cal-layout">
        {/* ── COLUMNA IZQUIERDA ── */}
        <div className="cal-left">
          <div className="cal-card">
            <div className="cal-nav">
              <button onClick={prevMes}>‹</button>
              <h2>{MESES[viewMonth]} {viewYear}</h2>
              <button onClick={nextMes}>›</button>
            </div>
            <div className="cal-grid">
              {DIAS.map(d => <div key={d} className="cal-day-header">{d}</div>)}
              {celdas.map((dia, i) => {
                if (dia === null) return <div key={`e-${i}`} className="cal-cell empty" />;
                const semana = semanaDeDia(dia);
                const tieneData = semanasConDatos.has(semana);
                const enSemanaSeleccionada = semanaSel !== null && semanaSel === semana;
                const esDiaSeleccionado =
                  semanaSel !== null &&
                  new Date(semanaSel + 'T00:00:00').getDate() === dia &&
                  new Date(semanaSel + 'T00:00:00').getMonth() === viewMonth &&
                  new Date(semanaSel + 'T00:00:00').getFullYear() === viewYear;
                const esHoy =
                  dia === hoy.getDate() && viewMonth === hoy.getMonth() && viewYear === hoy.getFullYear();
                const clases = [
                  'cal-cell',
                  tieneData ? 'has-data' : '',
                  esDiaSeleccionado ? 'selected' : enSemanaSeleccionada ? 'in-selected-week' : '',
                  esHoy && !esDiaSeleccionado ? 'today' : '',
                ].filter(Boolean).join(' ');
                return (
                  <div key={`d-${dia}`} className={clases}
                    onClick={() => { setSemanaSel(semana); setEditando(false); }}>
                    {dia}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 14, paddingLeft: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#aaa' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#df30a4', display: 'inline-block' }} />
              Con registro
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#aaa' }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, outline: '2px solid #df30a4', display: 'inline-block' }} />
              Hoy
            </div>
          </div>

        </div>

        {/* ── COLUMNA DERECHA ── */}
        <div className="cal-right">
          {loading ? (
            <div className="detalle-card">
              <div style={{ textAlign: 'center', padding: '60px', color: '#aaa' }}>Cargando...</div>
            </div>
          ) : !semanaSel ? (
            <div className="detalle-card">
              <div className="placeholder">
                <span>📅</span>
                <p>Selecciona una semana en el calendario</p>
              </div>
            </div>
          ) : (
            <div className={`detalle-card${semanaSel === semanaActual ? ' semana-actual' : ''}`}>
              <div className="detalle-header">
                <div className="detalle-semana-label">
                  {formatRangoSemana(semanaSel)}
                  {semanaSel === semanaActual && <span className="current-tag">Esta semana</span>}
                </div>
                {!editando && (
                  <div className="header-actions">
                    <button className="btn-icon" onClick={() => entrarEdicion(detalleSel)}>
                      ✏️ Editar
                    </button>
                    {detalleSel && (
                      <button className="btn-icon danger" onClick={() => setConfirmarEliminar(true)}>
                        🗑️ Borrar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {editando ? (
                <>
                  <div className="edit-grid">
                    <div className="edit-bloque">
                      <div className="edit-label">🥪 Almuerzo del viernes</div>
                      <select className="edit-select" value={edit.almuerzo1}
                        onChange={e => setEdit(s => ({ ...s, almuerzo1: e.target.value }))}>
                        <option value="">— Sin registro —</option>
                        {personas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                      </select>
                      <select className="edit-select" value={edit.almuerzo2}
                        onChange={e => setEdit(s => ({ ...s, almuerzo2: e.target.value }))}>
                        <option value="">— Sin registro —</option>
                        {personas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div className="edit-bloque">
                      <div className="edit-label">🧹 Limpieza de la semana</div>
                      <select className="edit-select" value={edit.limpieza}
                        onChange={e => setEdit(s => ({ ...s, limpieza: e.target.value }))}>
                        <option value="">— Sin registro —</option>
                        {personas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="edit-actions">
                    <button className="btn-cancel-edit" onClick={() => setEditando(false)}>
                      Cancelar
                    </button>
                    <button className="btn-save" disabled={guardando} onClick={guardarEdicion}>
                      {guardando ? 'Guardando...' : '✓ Guardar'}
                    </button>
                  </div>
                </>
              ) : detalleSel ? (
                <div className="turnos-grid">
                  <div className="turno-bloque">
                    <div className="turno-titulo">🥪 Almuerzo del viernes</div>
                    {detalleSel.almuerzo.length > 0
                      ? detalleSel.almuerzo.map(e => <div className="turno-persona" key={e.id}>{e.persona_nombre}</div>)
                      : <div className="turno-empty">Sin registro</div>}
                  </div>
                  <div className="turno-bloque">
                    <div className="turno-titulo">🧹 Limpieza de la semana</div>
                    {detalleSel.limpieza.length > 0
                      ? detalleSel.limpieza.map(e => <div className="turno-persona" key={e.id}>{e.persona_nombre}</div>)
                      : <div className="turno-empty">Sin registro</div>}
                  </div>
                </div>
              ) : (
                <div className="placeholder">
                  <span>🗓️</span>
                  <p>No hay sorteo registrado para esta semana</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal confirmación eliminar ── */}
      {confirmarEliminar && semanaSel && detalleSel && (
        <div className="confirm-overlay" onClick={() => setConfirmarEliminar(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <p>¿Eliminar esta semana?</p>
            <small>{formatRangoSemana(semanaSel)}</small>
            <div className="confirm-actions">
              <button className="btn-cancelar-eliminar" onClick={() => setConfirmarEliminar(false)}>
                Cancelar
              </button>
              <button className="btn-confirmar-eliminar" disabled={eliminando === semanaSel}
                onClick={() => eliminarSemana(semanaSel)}>
                {eliminando === semanaSel ? 'Borrando...' : 'Sí, borrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
