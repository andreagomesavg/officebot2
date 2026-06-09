"use client";
import { Persona } from '@/types';
import { useEffect, useState } from 'react';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 1000];

interface HistorialPersona {
  id: number;
  semana: string;
  tipo: 'almuerzo' | 'limpieza';
}

export default function Dashboard() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [estadoAlmuerzo, setEstadoAlmuerzo] = useState('');
  const [estadoLimpieza, setEstadoLimpieza] = useState('');

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Persona>>({});

  const [search, setSearch] = useState('');
  const [filterAlmuerzo, setFilterAlmuerzo] = useState<'all' | 'con' | 'sin'>('all');
  const [filterLimpieza, setFilterLimpieza] = useState<'all' | 'con' | 'sin'>('all');
  const [sortBy, setSortBy] = useState<'nombre' | 'almuerzo' | 'limpieza'>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(1000);

  // Modal historial individual
  const [historialPersona, setHistorialPersona] = useState<{ persona: Persona; entries: HistorialPersona[] } | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  useEffect(() => { fetchPersonas(); }, []);
  useEffect(() => { setPage(1); }, [search, filterAlmuerzo, filterLimpieza, sortBy, sortDir, pageSize]);

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/personas', { cache: 'no-store' });
      const data = await res.json();
      setPersonas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error cargando personas', e);
      setPersonas([]);
    } finally {
      setLoading(false);
    }
  };

  const verHistorial = async (p: Persona) => {
    setCargandoHistorial(true);
    setHistorialPersona({ persona: p, entries: [] });
    try {
      const res = await fetch(`/api/historial?persona_id=${p.id}`);
      const data = await res.json();
      setHistorialPersona({ persona: p, entries: Array.isArray(data) ? data : [] });
    } catch {
      setHistorialPersona({ persona: p, entries: [] });
    } finally {
      setCargandoHistorial(false);
    }
  };

  const agregarPersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          rebotes: 0,
          almuerzo: estadoAlmuerzo || null,
          limpieza: estadoLimpieza || null,
        }),
      });
      if (res.ok) {
        setNombre(''); setEstadoAlmuerzo(''); setEstadoLimpieza('');
        setShowAddForm(false);
        await fetchPersonas();
      }
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const guardarEdicion = async () => {
    if (!editandoId) return;
    await fetch('/api/personas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditandoId(null);
    fetchPersonas();
  };

  const eliminarPersona = async (id: number) => {
    if (!confirm('¿Seguro que quieres eliminar a esta persona?')) return;
    await fetch(`/api/personas?id=${id}`, { method: 'DELETE' });
    fetchPersonas();
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const fmtDate = (d?: string | null) =>
    d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  const fmtSemana = (s: string) => {
    const d = new Date(s + 'T00:00:00');
    const v = new Date(d); v.setDate(d.getDate() + 4);
    const o: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – ${v.toLocaleDateString('es-ES', o)}`;
  };

  const renderBadge = (v?: string | null) => {
    if (!v) return <span style={{ color: '#ccc' }}>—</span>;
    if (v.toLowerCase() === 'le toca') return <span className="badge-toca">Le toca</span>;
    if (v.toLowerCase() === 'no puede') return <span className="badge-nopuede">No puede</span>;
    return <span style={{ color: '#888' }}>{v}</span>;
  };

  const filtered = personas
    .filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()))
    .filter(p => filterAlmuerzo === 'all' ? true : filterAlmuerzo === 'con' ? p.veces_almuerzo > 0 : p.veces_almuerzo === 0)
    .filter(p => filterLimpieza === 'all' ? true : filterLimpieza === 'con' ? p.veces_limpieza > 0 : p.veces_limpieza === 0)
    .sort((a: any, b: any) => {
      let va = a[sortBy] ?? ''; let vb = b[sortBy] ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <span style={{ marginLeft: 4, opacity: sortBy === col ? 1 : 0.25, fontSize: '10px' }}>
      {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const histAlmuerzo = historialPersona?.entries.filter(e => e.tipo === 'almuerzo') ?? [];
  const histLimpieza = historialPersona?.entries.filter(e => e.tipo === 'limpieza') ?? [];

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #1a1a1a; font-size: 14px; }
        .page { padding: 32px 24px; min-height: 100vh; }
        .wrap { max-width: 1200px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
        .page-title { font-size: 24px; font-weight: 700; color: #111; }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .toolbar { display: flex; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; gap: 12px; flex-wrap: wrap; }
        .search-input { height: 36px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0 12px 0 34px; font-size: 13px; outline: none; background: #fdfdfd url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%23aaa' stroke-width='2' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") no-repeat 10px center; }
        select, .edit-input { height: 36px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0 8px; font-size: 13px; color: #555; background: #fff; outline: none; }
        .btn-primary { background: #df30a4; color: #fff; border: none; padding: 0 16px; height: 36px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .add-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; background: #fff5fb; padding: 20px; border-bottom: 1px solid #f0f0f0; }
        .add-label { font-size: 11px; font-weight: 700; color: #df30a4; margin-bottom: 5px; }
        .table-scroll { max-height: 65vh; overflow-y: auto; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 900px; }
        thead { position: sticky; top: 0; z-index: 10; }
        th { background: #fff; padding: 14px 16px; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; border-bottom: 2px solid #f0f0f0; text-align: left; cursor: pointer; }
        th.no-sort { cursor: default; }
        td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .badge-toca { background: #e6f4ea; color: #1e8e3e; border: 1px solid #cce8d6; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .badge-nopuede { background: #fce8e6; color: #c5221f; border: 1px solid #fad2cf; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .badge-count { background: #f3f4f6; color: #555; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 12px; }
        .badge-count.active { background: #fce7f8; color: #df30a4; border: 1px solid #fbcfe8; }
        .btn-ghost { background: transparent; border: none; color: #999; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 12px; }
        .btn-ghost:hover { color: #df30a4; background: rgba(223,48,164,0.05); }
        .btn-ghost.danger:hover { color: #dc2626; background: #fef2f2; }
        .num-input { width: 65px; text-align: center; }
        .pagination-bar { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-top: 1px solid #f0f0f0; }
        .page-btn { border: 1px solid #e5e7eb; background: #fff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; color: #555; }

        /* Modal historial */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; }
        .modal-hist { background: #fff; border-radius: 16px; padding: 0; max-width: 560px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.2); overflow: hidden; max-height: 80vh; display: flex; flex-direction: column; }
        .modal-hist-header { padding: 24px 28px 20px; border-bottom: 1px solid #f0f0f0; }
        .modal-hist-title { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
        .modal-hist-sub { font-size: 13px; color: #aaa; }
        .modal-hist-body { padding: 20px 28px; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .hist-col-title { font-size: 11px; font-weight: 800; color: #aaa; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .hist-entry { font-size: 13px; color: #444; padding: 5px 0; border-bottom: 1px solid #f3f4f6; }
        .hist-empty { font-size: 13px; color: #ccc; font-style: italic; }
        .modal-hist-footer { padding: 16px 28px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; }
        .btn-close { background: #f3f4f6; color: #555; border: none; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-close:hover { background: #e5e7eb; }
      `}</style>

      {/* ── Modal historial individual ── */}
      {historialPersona && (
        <div className="modal-overlay" onClick={() => setHistorialPersona(null)}>
          <div className="modal-hist" onClick={e => e.stopPropagation()}>
            <div className="modal-hist-header">
              <div className="modal-hist-title">{historialPersona.persona.nombre}</div>
              <div className="modal-hist-sub">
                {histAlmuerzo.length} almuerzo{histAlmuerzo.length !== 1 ? 's' : ''} · {histLimpieza.length} limpieza{histLimpieza.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="modal-hist-body">
              <div>
                <div className="hist-col-title">🥪 Almuerzos</div>
                {cargandoHistorial
                  ? <div className="hist-empty">Cargando...</div>
                  : histAlmuerzo.length > 0
                    ? histAlmuerzo.map(e => <div className="hist-entry" key={e.id}>{fmtSemana(e.semana)}</div>)
                    : <div className="hist-empty">Sin registros</div>
                }
              </div>
              <div>
                <div className="hist-col-title">🧹 Limpiezas</div>
                {cargandoHistorial
                  ? <div className="hist-empty">Cargando...</div>
                  : histLimpieza.length > 0
                    ? histLimpieza.map(e => <div className="hist-entry" key={e.id}>{fmtSemana(e.semana)}</div>)
                    : <div className="hist-empty">Sin registros</div>
                }
              </div>
            </div>
            <div className="modal-hist-footer">
              <button className="btn-close" onClick={() => setHistorialPersona(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <div className="page">
        <div className="wrap">
          <div className="page-header">
            <div>
              <div className="page-title">Gestión de Equipo</div>
              <div style={{ color: '#888', fontSize: 13 }}>{personas.length} personas registradas</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n === 1000 ? 'Mostrar Todos' : `${n} por página`}</option>)}
              </select>
              <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
                {showAddForm ? '✕ Cancelar' : '+ Nueva Persona'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="toolbar">
              <input className="search-input" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              <div style={{ display: 'flex', gap: 10 }}>
                <select value={filterAlmuerzo} onChange={e => setFilterAlmuerzo(e.target.value as any)}>
                  <option value="all">Almuerzos: Todos</option>
                  <option value="con">Con turnos</option>
                  <option value="sin">Sin turnos</option>
                </select>
                <select value={filterLimpieza} onChange={e => setFilterLimpieza(e.target.value as any)}>
                  <option value="all">Limpiezas: Todas</option>
                  <option value="con">Con turnos</option>
                  <option value="sin">Sin turnos</option>
                </select>
              </div>
            </div>

            {showAddForm && (
              <form onSubmit={agregarPersona} className="add-row">
                <div><div className="add-label">NOMBRE</div><input className="edit-input" style={{ width: '100%' }} value={nombre} onChange={e => setNombre(e.target.value)} required /></div>
                <div>
                  <div className="add-label">ESTADO ALMUERZO</div>
                  <select className="edit-input" style={{ width: '100%' }} value={estadoAlmuerzo} onChange={e => setEstadoAlmuerzo(e.target.value)}>
                    <option value="">— Sin estado —</option>
                    <option value="Le toca">Le toca</option>
                    <option value="No puede">No puede</option>
                  </select>
                </div>
                <div>
                  <div className="add-label">ESTADO LIMPIEZA</div>
                  <select className="edit-input" style={{ width: '100%' }} value={estadoLimpieza} onChange={e => setEstadoLimpieza(e.target.value)}>
                    <option value="">— Sin estado —</option>
                    <option value="Le toca">Le toca</option>
                    <option value="No puede">No puede</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>+ Crear Compañero</button>
                </div>
              </form>
            )}

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('nombre')}>Compañero <SortIcon col="nombre" /></th>
                    <th className="no-sort">Estado Alm.</th>
                    <th className="no-sort">Estado Limp.</th>
                    <th className="no-sort">Últ. Almuerzo</th>
                    <th className="no-sort">Últ. Limpieza</th>
                    <th onClick={() => toggleSort('almuerzo')}>Turnos Alm. <SortIcon col="almuerzo" /></th>
                    <th onClick={() => toggleSort('limpieza')}>Turnos Limp. <SortIcon col="limpieza" /></th>
                    <th className="no-sort" style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>Cargando...</td></tr>
                  ) : paginated.map(p => (
                    <tr key={p.id}>
                      {editandoId === p.id ? (
                        <>
                          <td><input className="edit-input" value={editForm.nombre ?? ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} /></td>
                          <td><select className="edit-input" value={editForm.almuerzo ?? ''} onChange={e => setEditForm({ ...editForm, almuerzo: e.target.value })}><option value="">—</option><option value="Le toca">Le toca</option><option value="No puede">No puede</option></select></td>
                          <td><select className="edit-input" value={editForm.limpieza ?? ''} onChange={e => setEditForm({ ...editForm, limpieza: e.target.value })}><option value="">—</option><option value="Le toca">Le toca</option><option value="No puede">No puede</option></select></td>
                          <td style={{ color: '#aaa', fontSize: 12 }}>{fmtDate(p.ultimo_almuerzo)}</td>
                          <td style={{ color: '#aaa', fontSize: 12 }}>{fmtDate(p.ultima_limpieza)}</td>
                          <td><input type="number" min={0} className="edit-input" style={{ width: 60, textAlign: 'center' }} value={editForm.veces_almuerzo ?? 0} onChange={e => setEditForm({ ...editForm, veces_almuerzo: parseInt(e.target.value) || 0 })} /></td>
                          <td><input type="number" min={0} className="edit-input" style={{ width: 60, textAlign: 'center' }} value={editForm.veces_limpieza ?? 0} onChange={e => setEditForm({ ...editForm, veces_limpieza: parseInt(e.target.value) || 0 })} /></td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={guardarEdicion} className="btn-primary" style={{ height: 30, padding: '0 10px' }}>✓</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                          <td>{renderBadge(p.almuerzo)}</td>
                          <td>{renderBadge(p.limpieza)}</td>
                          <td style={{ color: '#777' }}>{fmtDate(p.ultimo_almuerzo)}</td>
                          <td style={{ color: '#777' }}>{fmtDate(p.ultima_limpieza)}</td>
                          <td><span className={`badge-count ${p.veces_almuerzo > 0 ? 'active' : ''}`}>{p.veces_almuerzo}</span></td>
                          <td><span className={`badge-count ${p.veces_limpieza > 0 ? 'active' : ''}`}>{p.veces_limpieza}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button className="btn-ghost bg-pink-500" onClick={() => verHistorial(p)}>Historial</button>
                              <button className="btn-ghost" onClick={() => { setEditandoId(p.id); setEditForm(p); }}>Editar</button>
                              <button className="btn-ghost danger" onClick={() => eliminarPersona(p.id)}>Eliminar</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageSize < 1000 && totalPages > 1 && (
              <div className="pagination-bar">
                <span style={{ fontSize: 12, color: '#888' }}>Página <strong>{page}</strong> de {totalPages}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Anterior</button>
                  <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Siguiente</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
