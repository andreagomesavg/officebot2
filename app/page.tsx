"use client";
import { Persona, HistorialEntry } from '@/types';
import { useEffect, useState } from 'react';

function getLunesDeSemana(date = new Date()): string {
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

function formatSemana(lunes: string): string {
  const d = new Date(lunes + 'T00:00:00');
  const viernes = new Date(d);
  viernes.setDate(d.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  return `${d.toLocaleDateString('es-ES', opts)} – ${viernes.toLocaleDateString('es-ES', opts)}`;
}

interface VerifEdit {
  almuerzo1: string;
  almuerzo2: string;
  limpieza: string;
}

export default function SorteoPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorteoActivo, setSorteoActivo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [almuerzoWinners, setAlmuerzoWinners] = useState<Persona[]>([]);
  const [limpiezaWinner, setLimpiezaWinner] = useState<Persona | null>(null);
  const [almuerzoPool, setAlmuerzoPool] = useState<Persona[]>([]);
  const [limpiezaPool, setLimpiezaPool] = useState<Persona[]>([]);

  const [showVerificacion, setShowVerificacion] = useState(false);
  const [ultimaSemana, setUltimaSemana] = useState<HistorialEntry[]>([]);
  const [cargandoVerificacion, setCargandoVerificacion] = useState(false);
  const [verifEdit, setVerifEdit] = useState<VerifEdit>({ almuerzo1: '', almuerzo2: '', limpieza: '' });
  const [guardandoVerif, setGuardandoVerif] = useState(false);

  useEffect(() => { fetchPersonas(); }, []);

  const fetchPersonas = async (): Promise<Persona[]> => {
    setLoading(true);
    try {
      const res = await fetch('/api/personas', { cache: 'no-store' });
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setPersonas(lista);
      return lista;
    } catch (e) {
      console.error('Error al cargar personas:', e);
      setPersonas([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return 'Nunca';
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const turnoActual = {
    almuerzos: personas.filter(p => p.almuerzo === 'Le toca'),
    limpieza: personas.find(p => p.limpieza === 'Le toca') ?? null,
  };

  const sortSorteo = (a: Persona, b: Persona, tipo: 'almuerzo' | 'limpieza') => {
    const vecesA = tipo === 'almuerzo' ? a.veces_almuerzo : a.veces_limpieza;
    const vecesB = tipo === 'almuerzo' ? b.veces_almuerzo : b.veces_limpieza;
    if (vecesA !== vecesB) return vecesA - vecesB;
    const dateA = tipo === 'almuerzo' ? a.ultimo_almuerzo : a.ultima_limpieza;
    const dateB = tipo === 'almuerzo' ? b.ultimo_almuerzo : b.ultima_limpieza;
    // null = nunca asignado → tratar como "ahora" para que vayan al final de su grupo de veces
    const timeA = dateA ? new Date(dateA).getTime() : Date.now();
    const timeB = dateB ? new Date(dateB).getTime() : Date.now();
    return timeA - timeB || a.nombre.localeCompare(b.nombre);
  };

  const ejecutarSorteo = (lista: Persona[]) => {
    const eligibleAlmuerzo = lista.filter(p => p.almuerzo !== 'No puede').sort((a, b) => sortSorteo(a, b, 'almuerzo'));
    const eligibleLimpieza = lista.filter(p => p.limpieza !== 'No puede').sort((a, b) => sortSorteo(a, b, 'limpieza'));
    setAlmuerzoWinners(eligibleAlmuerzo.slice(0, 2));
    setLimpiezaWinner(eligibleLimpieza[0] ?? null);
    setAlmuerzoPool(eligibleAlmuerzo.slice(2));
    setLimpiezaPool(eligibleLimpieza.slice(1));
    setSorteoActivo(true);
    setShowVerificacion(false);
  };

  const iniciarSorteo = async () => {
    setCargandoVerificacion(true);
    try {
      const res = await fetch('/api/historial?ultima=true');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setUltimaSemana(data);
        // poblar el formulario de edición con los datos actuales del historial
        const al = data.filter((e: HistorialEntry) => e.tipo === 'almuerzo');
        const li = data.filter((e: HistorialEntry) => e.tipo === 'limpieza');
        setVerifEdit({
          almuerzo1: al[0]?.persona_nombre ?? '',
          almuerzo2: al[1]?.persona_nombre ?? '',
          limpieza: li[0]?.persona_nombre ?? '',
        });
        setShowVerificacion(true);
      } else {
        const lista = await fetchPersonas();
        ejecutarSorteo(lista);
      }
    } catch {
      const lista = await fetchPersonas();
      ejecutarSorteo(lista);
    } finally {
      setCargandoVerificacion(false);
    }
  };

  const confirmarVerificacion = async () => {
    const semanaHistorial = ultimaSemana[0]?.semana;
    if (!semanaHistorial) {
      const lista = await fetchPersonas();
      ejecutarSorteo(lista);
      return;
    }

    // Comparar con los datos originales para saber si hubo cambios
    const al = ultimaSemana.filter(e => e.tipo === 'almuerzo');
    const li = ultimaSemana.filter(e => e.tipo === 'limpieza');
    const originalAlmuerzo1 = al[0]?.persona_nombre ?? '';
    const originalAlmuerzo2 = al[1]?.persona_nombre ?? '';
    const originalLimpieza = li[0]?.persona_nombre ?? '';
    const hubocambios =
      verifEdit.almuerzo1 !== originalAlmuerzo1 ||
      verifEdit.almuerzo2 !== originalAlmuerzo2 ||
      verifEdit.limpieza !== originalLimpieza;

    if (hubocambios) {
      setGuardandoVerif(true);
      try {
        const pl = personas.length > 0 ? personas : await fetchPersonas();

        const entries: { tipo: 'almuerzo' | 'limpieza'; persona_id: number; persona_nombre: string }[] = [];
        for (const nombre of [verifEdit.almuerzo1, verifEdit.almuerzo2].filter(Boolean)) {
          const p = pl.find(x => x.nombre === nombre);
          if (p) entries.push({ tipo: 'almuerzo', persona_id: p.id, persona_nombre: p.nombre });
        }
        if (verifEdit.limpieza) {
          const p = pl.find(x => x.nombre === verifEdit.limpieza);
          if (p) entries.push({ tipo: 'limpieza', persona_id: p.id, persona_nombre: p.nombre });
        }

        // PUT calcula el diff en el servidor y ajusta veces
        await fetch('/api/historial', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ semana: semanaHistorial, entries }),
        });
      } catch {
        alert('Error al corregir el historial.');
        setGuardandoVerif(false);
        return;
      }
      setGuardandoVerif(false);
    }

    // re-fetch para que veces/fechas estén actualizados desde historial
    const listaActualizada = await fetchPersonas();
    ejecutarSorteo(listaActualizada);
  };

  const confirmarResultados = async () => {
    setGuardando(true);
    const ahora = new Date().toISOString();
    const semanaActual = getLunesDeSemana();

    try {
      // 1. Actualizar personas: estado Le toca + veces + fechas
      const requests: Promise<Response>[] = [];
      for (const p of personas) {
        let changed = false;
        const patch: Record<string, unknown> = { id: p.id };
        if (almuerzoWinners.some(w => w.id === p.id)) {
          patch.almuerzo = 'Le toca';
          patch.veces_almuerzo = p.veces_almuerzo + 1;
          patch.ultimo_almuerzo = ahora;
          changed = true;
        } else if (p.almuerzo === 'Le toca') {
          patch.almuerzo = null;
          changed = true;
        }
        if (limpiezaWinner?.id === p.id) {
          patch.limpieza = 'Le toca';
          patch.veces_limpieza = p.veces_limpieza + 1;
          patch.ultima_limpieza = ahora;
          changed = true;
        } else if (p.limpieza === 'Le toca') {
          patch.limpieza = null;
          changed = true;
        }
        if (changed) requests.push(patchPersona(patch));
      }
      await Promise.all(requests);

      // 2. Guardar en historial
      const entries = [
        ...almuerzoWinners.map(p => ({ tipo: 'almuerzo' as const, persona_id: p.id, persona_nombre: p.nombre })),
        ...(limpiezaWinner ? [{ tipo: 'limpieza' as const, persona_id: limpiezaWinner.id, persona_nombre: limpiezaWinner.nombre }] : []),
      ];
      await fetch('/api/historial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semana: semanaActual, entries }),
      });

      await fetchPersonas();
      setSorteoActivo(false);
    } catch {
      alert('Error al guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const semanaLabel = ultimaSemana[0]?.semana ? formatSemana(ultimaSemana[0].semana) : '';
  const personasOrdenadas = [...personas].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, system-ui, sans-serif; background: #f8f9fa; color: #1a1a1a; }
        .page { padding: 40px 24px; max-width: 950px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .btn-large { background: #df30a4; color: #fff; border: none; border-radius: 8px; padding: 16px 32px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 15px; }
        .btn-large:hover:not(:disabled) { background: #b01e7a; transform: translateY(-1px); }
        .btn-large:disabled { opacity: 0.6; cursor: not-allowed; }
        .cards-grid { display: grid; grid-template-columns: 1fr; gap: 24px; margin-top: 24px; }
        @media (min-width: 768px) { .cards-grid { grid-template-columns: 1fr 1fr; } }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); position: relative; overflow: hidden; }
        .winner-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #fafafa; border-radius: 8px; margin-top: 8px; }
        .name-info b { display: block; font-size: 15px; }
        .name-info span { font-size: 11px; color: #888; }
        .badge { position: absolute; top: 12px; right: -30px; background: #df30a4; color: white; font-size: 10px; font-weight: 800; padding: 4px 35px; transform: rotate(45deg); text-transform: uppercase; letter-spacing: 1px; }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 2000; padding: 24px;
        }
        .modal {
          background: #fff; border-radius: 16px; padding: 32px;
          max-width: 480px; width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .modal-title { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
        .modal-subtitle { font-size: 13px; color: #888; margin-bottom: 24px; }
        .modal-section { background: #f8f9fa; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
        .modal-section-label {
          font-size: 11px; font-weight: 800; color: #999;
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;
        }
        .modal-select {
          width: 100%; background: #fff; border: 1px solid #e5e7eb;
          border-radius: 7px; padding: 8px 10px; font-size: 13px;
          font-weight: 600; color: #1a1a1a; cursor: pointer;
          margin-bottom: 8px; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
        }
        .modal-select:last-child { margin-bottom: 0; }
        .modal-select:focus { outline: 2px solid #df30a4; border-color: transparent; }
        .modal-actions { display: flex; gap: 12px; margin-top: 24px; }
        .btn-confirm {
          flex: 1; background: #df30a4; color: #fff; border: none;
          border-radius: 8px; padding: 12px 20px; font-weight: 700;
          cursor: pointer; font-size: 14px; transition: background 0.2s;
        }
        .btn-confirm:hover:not(:disabled) { background: #b01e7a; }
        .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-cancel {
          flex: 1; background: #f3f4f6; color: #444; border: none;
          border-radius: 8px; padding: 12px 20px; font-weight: 600;
          cursor: pointer; font-size: 14px; transition: background 0.2s;
        }
        .btn-cancel:hover { background: #e5e7eb; }
        .cambios-badge {
          display: inline-block; background: #fef3c7; color: #92400e;
          font-size: 11px; font-weight: 700; padding: 2px 8px;
          border-radius: 99px; margin-left: 8px;
        }
      `}</style>

      {/* ── Modal de verificación editable ── */}
      {showVerificacion && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Verificar semana anterior</div>
            <div className="modal-subtitle">
              Semana del {semanaLabel} — corrige si algo fue diferente
            </div>

            <div className="modal-section">
              <div className="modal-section-label">
                🥪 Almuerzo del viernes
                {(verifEdit.almuerzo1 !== (ultimaSemana.filter(e=>e.tipo==='almuerzo')[0]?.persona_nombre ?? '') ||
                  verifEdit.almuerzo2 !== (ultimaSemana.filter(e=>e.tipo==='almuerzo')[1]?.persona_nombre ?? '')) &&
                  <span className="cambios-badge">modificado</span>}
              </div>
              <select className="modal-select" value={verifEdit.almuerzo1}
                onChange={e => setVerifEdit(s => ({ ...s, almuerzo1: e.target.value }))}>
                <option value="">— Sin registro —</option>
                {personasOrdenadas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
              <select className="modal-select" value={verifEdit.almuerzo2}
                onChange={e => setVerifEdit(s => ({ ...s, almuerzo2: e.target.value }))}>
                <option value="">— Sin registro —</option>
                {personasOrdenadas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </div>

            <div className="modal-section">
              <div className="modal-section-label">
                🧹 Limpieza de la semana
                {verifEdit.limpieza !== (ultimaSemana.filter(e=>e.tipo==='limpieza')[0]?.persona_nombre ?? '') &&
                  <span className="cambios-badge">modificado</span>}
              </div>
              <select className="modal-select" value={verifEdit.limpieza}
                onChange={e => setVerifEdit(s => ({ ...s, limpieza: e.target.value }))}>
                <option value="">— Sin registro —</option>
                {personasOrdenadas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowVerificacion(false)}>
                Cancelar
              </button>
              <button className="btn-confirm" disabled={guardandoVerif} onClick={confirmarVerificacion}>
                {guardandoVerif ? 'Guardando...' : 'Confirmar y lanzar sorteo ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page">
        <div className="header">
          <h1 style={{fontSize: 32, fontWeight: 800}}>OfficeBot</h1>
          <p style={{color: '#666'}}>Turnos de equipo</p>
        </div>

        {loading ? (
          <div style={{textAlign: 'center', padding: '50px', color: '#888'}}>Cargando datos...</div>
        ) : !sorteoActivo ? (
          <>
            <div className="cards-grid">
              <div className="card">
                <div style={{fontWeight: 700, marginBottom: 12}}>🥪 Almuerzo Vigente</div>
                {turnoActual.almuerzos.length === 0
                  ? <p style={{color:'#aaa'}}>Sin sorteo activo.</p>
                  : turnoActual.almuerzos.map(p => (
                    <div className="winner-row" key={p.id}>
                      <div className="name-info">
                        <b>{p.nombre}</b>
                        <span>Último: {formatFecha(p.ultimo_almuerzo)}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
              <div className="card">
                <div style={{fontWeight: 700, marginBottom: 12}}>🧹 Limpieza Vigente</div>
                {turnoActual.limpieza
                  ? (
                    <div className="winner-row">
                      <div className="name-info">
                        <b>{turnoActual.limpieza.nombre}</b>
                        <span>Último: {formatFecha(turnoActual.limpieza.ultima_limpieza)}</span>
                      </div>
                    </div>
                  )
                  : <p style={{color:'#aaa'}}>Sin sorteo activo.</p>
                }
              </div>
            </div>
            <div style={{textAlign:'center', marginTop:40}}>
              <button className="btn-large" onClick={iniciarSorteo} disabled={cargandoVerificacion}>
                {cargandoVerificacion ? 'Verificando...' : '🎲 Nuevo Sorteo'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="cards-grid">
              <div className="card" style={{borderColor: '#df30a4'}}>
                <div className="badge">Borrador</div>
                <div style={{fontWeight: 700, marginBottom: 12, color:'#df30a4'}}>🥪 Propuesta Almuerzo</div>
                {almuerzoWinners.map((winner, index) => (
                  <div className="winner-row" key={winner.id}>
                    <div className="name-info">
                      <b>{winner.nombre}</b>
                      <span>Último: {formatFecha(winner.ultimo_almuerzo)} ({winner.veces_almuerzo} veces)</span>
                    </div>
                    <button style={{background:'none', border:'none', cursor:'pointer', fontSize: 18}} onClick={() => {
                      const w = [...almuerzoWinners]; const p = [...almuerzoPool];
                      if (p.length > 0) {
                        const old = w[index]; w[index] = p.shift()!; p.push(old);
                        setAlmuerzoWinners(w); setAlmuerzoPool(p);
                      }
                    }}>🎲</button>
                  </div>
                ))}
              </div>

              <div className="card" style={{borderColor: '#df30a4'}}>
                <div className="badge">Borrador</div>
                <div style={{fontWeight: 700, marginBottom: 12, color:'#df30a4'}}>🧹 Propuesta Limpieza</div>
                {limpiezaWinner && (
                  <div className="winner-row">
                    <div className="name-info">
                      <b>{limpiezaWinner.nombre}</b>
                      <span>Último: {formatFecha(limpiezaWinner.ultima_limpieza)} ({limpiezaWinner.veces_limpieza} veces)</span>
                    </div>
                    <button style={{background:'none', border:'none', cursor:'pointer', fontSize: 18}} onClick={() => {
                      const p = [...limpiezaPool];
                      if (p.length > 0) {
                        const old = limpiezaWinner; setLimpiezaWinner(p.shift()!); p.push(old); setLimpiezaPool(p);
                      }
                    }}>🎲</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #eee' }}>
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#df30a4' }}>📊 Próximos en lista (Suplentes):</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#999', textTransform: 'uppercase', marginBottom: 5 }}>Sig. Almuerzo</p>
                  {almuerzoPool.slice(0, 3).map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', padding: '4px 0', borderBottom: '1px solid #f9f9f9' }}>
                      <span>{p.nombre}</span><span>{p.veces_almuerzo} veces</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#999', textTransform: 'uppercase', marginBottom: 5 }}>Sig. Limpieza</p>
                  {limpiezaPool.slice(0, 3).map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', padding: '4px 0', borderBottom: '1px solid #f9f9f9' }}>
                      <span>{p.nombre}</span><span>{p.veces_limpieza} veces</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{textAlign:'center', marginTop:40}}>
              <button className="btn-large" onClick={confirmarResultados} disabled={guardando}>
                {guardando ? 'Guardando...' : '✓ Guardar Nuevos Turnos'}
              </button>
              <br />
              <button onClick={() => setSorteoActivo(false)}
                style={{marginTop:20, background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:14, textDecoration:'underline'}}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
