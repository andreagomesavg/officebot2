"use client";
import { Persona } from '@/types';
import { useEffect, useState } from 'react';

export default function SorteoPage() {
  // Aseguramos que siempre sea un array al inicio
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  const [sorteoActivo, setSorteoActivo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [almuerzoWinners, setAlmuerzoWinners] = useState<Persona[]>([]);
  const [limpiezaWinner, setLimpiezaWinner] = useState<Persona | null>(null);
  
  const [almuerzoPool, setAlmuerzoPool] = useState<Persona[]>([]);
  const [limpiezaPool, setLimpiezaPool] = useState<Persona[]>([]);

  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/personas', { cache: 'no-store' });
      const data = await res.json();
      // Si la data no es un array, ponemos uno vacío para evitar el crash
      setPersonas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error al cargar personas:", e);
      setPersonas([]);
    } finally {
      setLoading(false);
    }
  };

  // BLINDAJE: Usamos (personas || []) para que .filter nunca falle
  const obtenerTurnoActual = () => {
    const lista = Array.isArray(personas) ? personas : [];
    const almuerzos = lista.filter(p => p.almuerzo === 'Le toca');
    const limpieza = lista.find(p => p.limpieza === 'Le toca') || null;
    return { almuerzos, limpieza };
  };
  
  const turnoActual = obtenerTurnoActual();

  // BLINDAJE: También aquí para los excluidos
  const excluidosAlmuerzo = (personas || []).filter(p => p.almuerzo === 'No puede');
  const excluidosLimpieza = (personas || []).filter(p => p.limpieza === 'No puede');

  const sortSorteo = (a: Persona, b: Persona, tipo: 'almuerzo' | 'limpieza') => {
    const vecesA = tipo === 'almuerzo' ? a.veces_almuerzo : a.veces_limpieza;
    const vecesB = tipo === 'almuerzo' ? b.veces_almuerzo : b.veces_limpieza;
    if (vecesA !== vecesB) return vecesA - vecesB;
    const dateA = tipo === 'almuerzo' ? a.ultimo_almuerzo : a.ultima_limpieza;
    const dateB = tipo === 'almuerzo' ? b.ultimo_almuerzo : b.ultima_limpieza;
    const timeA = dateA ? new Date(dateA).getTime() : 0; 
    const timeB = dateB ? new Date(dateB).getTime() : 0;
    return timeA - timeB || a.nombre.localeCompare(b.nombre); 
  };

  const sustituirTitular = async (titularActual: Persona, tipo: 'almuerzo' | 'limpieza') => {
    const elegibles = personas.filter(p => {
      const estado = tipo === 'almuerzo' ? p.almuerzo : p.limpieza;
      if (estado === 'No puede') return false;
      if (tipo === 'almuerzo') return !turnoActual.almuerzos.some(t => t.id === p.id);
      return turnoActual.limpieza?.id !== p.id;
    }).sort((a, b) => sortSorteo(a, b, tipo));

    const sustituto = elegibles[0];
    if (!sustituto) return alert("No hay nadie disponible para sustituir.");
    if (!confirm(`¿Cambiar a ${titularActual.nombre} por ${sustituto.nombre}?`)) return;

    setGuardando(true);
    const ahora = new Date().toISOString();
    const vecesKey = tipo === 'almuerzo' ? 'veces_almuerzo' : 'veces_limpieza';
    const dateKey = tipo === 'almuerzo' ? 'ultimo_almuerzo' : 'ultima_limpieza';

    try {
      await fetch('/api/personas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: titularActual.id, [vecesKey]: Math.max(0, titularActual[vecesKey] - 1), [dateKey]: null, [tipo]: null }),
      });
      await fetch('/api/personas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sustituto.id, [vecesKey]: sustituto[vecesKey] + 1, [dateKey]: ahora, [tipo]: 'Le toca' }),
      });
      await fetchPersonas();
    } catch (e) { alert("Error al sustituir."); } finally { setGuardando(false); }
  };

  const iniciarSorteo = () => {
    const eligibleAlmuerzo = personas.filter(p => p.almuerzo !== 'No puede').sort((a, b) => sortSorteo(a, b, 'almuerzo'));
    const eligibleLimpieza = personas.filter(p => p.limpieza !== 'No puede').sort((a, b) => sortSorteo(a, b, 'limpieza'));
    setAlmuerzoWinners(eligibleAlmuerzo.slice(0, 2));
    setLimpiezaWinner(eligibleLimpieza[0] || null);
    setAlmuerzoPool(eligibleAlmuerzo.slice(2));
    setLimpiezaPool(eligibleLimpieza.slice(1));
    setSorteoActivo(true);
  };

  const confirmarResultados = async () => {
    setGuardando(true);
    const ahora = new Date().toISOString();

    try {
      const requests = [];
      for (const p of personas) {
        let changed = false;
        let patchData: any = { id: p.id };

        const esNuevoAlmuerzo = almuerzoWinners.some(w => w.id === p.id);
        if (esNuevoAlmuerzo) {
          patchData.almuerzo = 'Le toca';
          patchData.veces_almuerzo = p.veces_almuerzo + 1;
          patchData.ultimo_almuerzo = ahora;
          changed = true;
        } else if (p.almuerzo === 'Le toca') {
          patchData.almuerzo = null;
          changed = true;
        }

        const esNuevoLimpieza = limpiezaWinner?.id === p.id;
        if (esNuevoLimpieza) {
          patchData.limpieza = 'Le toca';
          patchData.veces_limpieza = p.veces_limpieza + 1;
          patchData.ultima_limpieza = ahora;
          changed = true;
        } else if (p.limpieza === 'Le toca') {
          patchData.limpieza = null;
          changed = true;
        }

        if (changed) {
          requests.push(fetch('/api/personas', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchData)
          }));
        }
      }
      await Promise.all(requests);
      await fetchPersonas();
      setSorteoActivo(false);
    } catch (e) { alert("Error al guardar."); } finally { setGuardando(false); }
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, system-ui, sans-serif; background: #f8f9fa; color: #1a1a1a; }
        .page { padding: 40px 24px; max-width: 950px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .btn-large { background: #df30a4; color: #fff; border: none; border-radius: 8px; padding: 16px 32px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-large:hover { background: #b01e7a; transform: translateY(-1px); }
        .cards-grid { display: grid; grid-template-columns: 1fr; gap: 24px; margin-top: 24px; }
        @media (min-width: 768px) { .cards-grid { grid-template-columns: 1fr 1fr; } }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .winner-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #fafafa; border-radius: 8px; margin-top: 8px; }
        .excluidos-box { margin-top: 32px; background: #fff; border: 1px dashed #e5e7eb; border-radius: 12px; padding: 20px; }
        .excluido-tag { background: #f3f4f6; color: #666; padding: 4px 10px; border-radius: 20px; font-size: 12px; border: 1px solid #e5e7eb; display: inline-block; margin: 4px; }
      `}</style>

      <div className="page">
        <div className="header">
          <h1 style={{fontSize: 32, fontWeight: 800}}>OfficeBot</h1>
          <p style={{color: '#666'}}>Turnos de equipo</p>
        </div>

        {loading ? (
            <div style={{textAlign: 'center', padding: '50px', color: '#888'}}>Cargando datos del equipo...</div>
        ) : !sorteoActivo ? (
          <>
            <div className="cards-grid">
              <div className="card">
                <div style={{fontWeight: 700, marginBottom: 12}}>🥪 Almuerzo Vigente</div>
                {turnoActual.almuerzos.length === 0 ? <p>Sin sorteo.</p> :
                  turnoActual.almuerzos.map(p => (
                    <div className="winner-row" key={p.id}>
                      <b>{p.nombre}</b>
                      <button onClick={() => sustituirTitular(p, 'almuerzo')} style={{cursor:'pointer', fontSize: 11}}>🔄 Sustituir</button>
                    </div>
                  ))
                }
              </div>
              <div className="card">
                <div style={{fontWeight: 700, marginBottom: 12}}>🧹 Limpieza Vigente</div>
                {turnoActual.limpieza ? (
                  <div className="winner-row">
                    <b>{turnoActual.limpieza.nombre}</b>
                    <button onClick={() => sustituirTitular(turnoActual.limpieza!, 'limpieza')} style={{cursor:'pointer', fontSize: 11}}>🔄 Sustituir</button>
                  </div>
                ) : <p>Sin sorteo.</p>}
              </div>
            </div>
            <div style={{textAlign:'center', marginTop:40}}>
              <button className="btn-large" onClick={iniciarSorteo}>🎲 Nuevo Sorteo</button>
            </div>
          </>
        ) : (
          <>
            <div className="cards-grid">
              <div className="card">
                <div style={{fontWeight: 700, marginBottom: 12, color:'#df30a4'}}>🥪 Propuesta Almuerzo</div>
                {almuerzoWinners.map((winner, index) => (
                  <div className="winner-row" key={winner.id}>
                    <b>{winner.nombre}</b>
                    <button onClick={() => {
                      if (almuerzoPool.length === 0) return alert("Sin suplentes");
                      const w = [...almuerzoWinners]; const p = [...almuerzoPool];
                      w[index] = p.shift()!; setAlmuerzoWinners(w); setAlmuerzoPool(p);
                    }}>🎲</button>
                  </div>
                ))}
              </div>
              <div className="card">
                <div style={{fontWeight: 700, marginBottom: 12, color:'#df30a4'}}>🧹 Propuesta Limpieza</div>
                {limpiezaWinner && (
                  <div className="winner-row">
                    <b>{limpiezaWinner.nombre}</b>
                    <button onClick={() => {
                      if (limpiezaPool.length === 0) return alert("Sin suplentes");
                      const p = [...limpiezaPool]; setLimpiezaWinner(p.shift()!); setLimpiezaPool(p);
                    }}>🎲</button>
                  </div>
                )}
              </div>
            </div>

            {(excluidosAlmuerzo.length > 0 || excluidosLimpieza.length > 0) && (
              <div className="excluidos-box">
                <p style={{fontSize:13, fontWeight:700, color:'#888', marginBottom:10}}>🚫 Excluidos :</p>
                {excluidosAlmuerzo.map(p => <span key={p.id} className="excluido-tag">🥪 {p.nombre}</span>)}
                {excluidosLimpieza.map(p => <span key={p.id} className="excluido-tag">🧹 {p.nombre}</span>)}
              </div>
            )}

            <div style={{textAlign:'center', marginTop:40}}>
              <button className="btn-large" onClick={confirmarResultados} disabled={guardando}>✓ Guardar Nuevos Turnos</button>
              <button onClick={() => setSorteoActivo(false)} style={{marginLeft:20, background:'none', border:'none', color:'#888', cursor:'pointer'}}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}