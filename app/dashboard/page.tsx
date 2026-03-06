"use client";
import { Persona } from '@/types';
import { useEffect, useState } from 'react';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 1000];

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
  const [sortBy, setSortBy] = useState<'nombre' | 'almuerzo' | 'limpieza' | 'rebotes'>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(1000);

  useEffect(() => { fetchPersonas(); }, []);
  useEffect(() => { setPage(1); }, [search, filterAlmuerzo, filterLimpieza, sortBy, sortDir, pageSize]);

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/personas', { cache: 'no-store' });
      const data = await res.json();
      // Verificamos que sea un array antes de guardarlo
      setPersonas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error cargando personas", e);
      setPersonas([]);
    } finally {
      setLoading(false);
    }
  };

  const agregarPersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    
    setLoading(true);
    try {
      // Usamos la fecha de "ahora" para que entren al final de la cola
      const ahora = new Date().toISOString();

      const res = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre, 
          rebotes: 0,
          // Si no eliges "Le toca", les ponemos la fecha de hoy 
          // para que no tengan prioridad inmediata
          ultimo_almuerzo: estadoAlmuerzo === 'Le toca' ? ahora : ahora, 
          ultima_limpieza: estadoLimpieza === 'Le toca' ? ahora : ahora,
          veces_almuerzo: estadoAlmuerzo === 'Le toca' ? 1 : 0,
          veces_limpieza: estadoLimpieza === 'Le toca' ? 1 : 0,
          almuerzo: estadoAlmuerzo || null,
          limpieza: estadoLimpieza || null,
        }),
      });

      if (res.ok) {
        setNombre(''); 
        setEstadoAlmuerzo(''); 
        setEstadoLimpieza(''); 
        setShowAddForm(false);
        await fetchPersonas();
      }
    } catch (e) {
      console.error("Error:", e);
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
    setEditandoId(null); fetchPersonas();
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

  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
  const dateForInput = (d?: string | null) => d ? d.substring(0, 10) : '';

const renderBadge = (v?: string | null) => {
    if (!v) return <span style={{ color: '#ccc', fontWeight: 500 }}>—</span>;
    const val = v.toLowerCase().trim();
    
    if (val === 'le toca') {
      return <span className="badge-toca">Le toca</span>;
    }
    if (val === 'no puede') {
      return <span className="badge-nopuede">No puede</span>;
    }
    
    return <span style={{ color: '#888' }}>{v}</span>;
  };

  // BLINDAJE: Usamos (personas || []) por si acaso
  const filtered = (personas || [])
    .filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()))
    .filter(p => filterAlmuerzo === 'all' ? true : filterAlmuerzo === 'con' ? (p.veces_almuerzo || 0) > 0 : (p.veces_almuerzo || 0) === 0)
    .filter(p => filterLimpieza === 'all' ? true : filterLimpieza === 'con' ? (p.veces_limpieza || 0) > 0 : (p.veces_limpieza || 0) === 0)
    .sort((a: any, b: any) => {
      let va = a[sortBy] ?? '';
      let vb = b[sortBy] ?? '';
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

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #1a1a1a; font-size: 14px; }
        .page { padding: 32px 24px; min-height: 100vh; }
        .wrap { max-width: 1500px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
        .page-title { font-size: 24px; font-weight: 700; color: #111; }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; }
        .toolbar { display: flex; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; background: #fff; gap: 12px; flex-wrap: wrap; }
        .search-input { height: 36px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0 12px 0 34px; font-size: 13px; outline: none; background: #fdfdfd url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%23aaa' stroke-width='2' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") no-repeat 10px center; }
        select, .edit-input { height: 36px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0 8px; font-size: 13px; color: #555; background: #fff; outline: none; }
        .btn-primary { background: #df30a4; color: #fff; border: none; padding: 0 16px; height: 36px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .add-row { display: flex; align-items: center; gap: 10px; padding: 16px 20px; background: #fcfcfc; border-bottom: 1px solid #f0f0f0; }
        .table-scroll { max-height: 65vh; overflow-y: auto; position: relative; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 1200px; }
        thead { position: sticky; top: 0; z-index: 10; }
        th { background: #fff; padding: 14px 16px; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; border-bottom: 2px solid #f0f0f0; text-align: left; }
        td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .badge-toca { background: #e6f4ea; color: #1e8e3e; border: 1px solid #cce8d6; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .badge-nopuede { background: #fce8e6; color: #c5221f; border: 1px solid #fad2cf; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .badge-count { background: #f3f4f6; color: #555; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 12px; }
        .badge-count.active { background: #fce7f8; color: #df30a4; border: 1px solid #fbcfe8; }
        .btn-ghost { background: transparent; border: none; color: #999; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 12px; }
        .btn-ghost.danger:hover { color: #dc2626; background: #fef2f2; }
        .num-input { width: 65px; text-align: center; }
        .pagination-bar { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-top: 1px solid #f0f0f0; background: #fff; }
        .page-btn { border: 1px solid #e5e7eb; background: #fff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; color: #555; }
        .page-btn.active { background: #df30a4; color: #fff; border-color: #df30a4; }
        .badge-rebote-rojo { background: #c5221f; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
      `}</style>

      <div className="page">
        <div className="wrap">
          <div className="page-header">
            <div>
              <div className="page-title">Gestión de Equipo</div>
              <div style={{color:'#888', fontSize:13}}>{(personas || []).length} personas registradas</div>
            </div>
            <div style={{display:'flex', gap:10}}>
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
              <div style={{display:'flex', gap:10}}>
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
  <form onSubmit={agregarPersona} className="add-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', background: '#fff5fb', padding: '20px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#df30a4' }}>NOMBRE</label>
      <input className="edit-input" placeholder="" value={nombre} onChange={e => setNombre(e.target.value)} required />
    </div>
    
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#df30a4' }}>ESTADO ALMUERZO</label>
      <select className="edit-input" value={estadoAlmuerzo} onChange={e => setEstadoAlmuerzo(e.target.value)}>
        <option value="">— Sin estado —</option>
        <option value="Le toca">Le toca</option>
        <option value="No puede">No puede</option>
      </select>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#df30a4' }}>ESTADO LIMPIEZA</label>
      <select className="edit-input" value={estadoLimpieza} onChange={e => setEstadoLimpieza(e.target.value)}>
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
                    <th className="sortable" onClick={() => toggleSort('nombre')}>Compañero <SortIcon col="nombre" /></th>
                    <th>Estado Alm.</th>
                    <th>Estado Limp.</th>
                    <th>Últ. Almuerzo</th>
                    <th>Últ. Limpieza</th>
                    <th className="sortable" onClick={() => toggleSort('almuerzo')}>Turnos Almuerzo <SortIcon col="almuerzo" /></th>
                    <th className="sortable" onClick={() => toggleSort('limpieza')}>Turnos Limpieza <SortIcon col="limpieza" /></th>
                    <th className="sortable" onClick={() => toggleSort('rebotes')}>Rebotes <SortIcon col="rebotes" /></th>
                    <th style={{textAlign:'right'}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} style={{textAlign:'center', padding:40}}>Cargando...</td></tr>
                  ) : paginated.map(p => (
                    <tr key={p.id}>
                      {editandoId === p.id ? (
                        <>
                          <td><input className="edit-input" value={editForm.nombre || ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} /></td>
                          <td><select className="edit-input" value={editForm.almuerzo || ''} onChange={e => setEditForm({ ...editForm, almuerzo: e.target.value })}><option value="">—</option><option value="Le toca">Le toca</option><option value="No puede">No puede</option></select></td>
                          <td><select className="edit-input" value={editForm.limpieza || ''} onChange={e => setEditForm({ ...editForm, limpieza: e.target.value })}><option value="">—</option><option value="Le toca">Le toca</option><option value="No puede">No puede</option></select></td>
                          <td><input type="date" className="edit-input" value={dateForInput(editForm.ultimo_almuerzo)} onChange={e => setEditForm({ ...editForm, ultimo_almuerzo: e.target.value ? new Date(e.target.value).toISOString() : null })} /></td>
                          <td><input type="date" className="edit-input" value={dateForInput(editForm.ultima_limpieza)} onChange={e => setEditForm({ ...editForm, ultima_limpieza: e.target.value ? new Date(e.target.value).toISOString() : null })} /></td>
                          <td><input type="number" className="edit-input num-input" value={editForm.veces_almuerzo ?? 0} onChange={e => setEditForm({ ...editForm, veces_almuerzo: parseInt(e.target.value) || 0 })} /></td>
                          <td><input type="number" className="edit-input num-input" value={editForm.veces_limpieza ?? 0} onChange={e => setEditForm({ ...editForm, veces_limpieza: parseInt(e.target.value) || 0 })} /></td>
                          <td><input type="number" className="edit-input num-input" value={editForm.rebotes ?? 0} onChange={e => setEditForm({ ...editForm, rebotes: parseInt(e.target.value) || 0 })} /></td>
                          <td style={{textAlign:'right'}}><button onClick={guardarEdicion} className="btn-primary" style={{height:30, padding:'0 10px'}}>✓</button></td>
                        </>
                      ) : (
                        <>
                          <td style={{fontWeight:600}}>{p.nombre}</td>
                          <td>{renderBadge(p.almuerzo)}</td>
                          <td>{renderBadge(p.limpieza)}</td>
                          <td style={{color:'#777'}}>{fmtDate(p.ultimo_almuerzo)}</td>
                          <td style={{color:'#777'}}>{fmtDate(p.ultima_limpieza)}</td>
                          <td><span className={`badge-count ${p.veces_almuerzo > 0 ? 'active' : ''}`}>{p.veces_almuerzo}</span></td>
                          <td><span className={`badge-count ${p.veces_limpieza > 0 ? 'active' : ''}`}>{p.veces_limpieza}</span></td>
                          <td>{p.rebotes > 0 ? <span className="badge-rebote-rojo">{p.rebotes}</span> : '—'}</td>
                          <td style={{textAlign:'right'}}>
                            <div style={{display:'flex', gap:4, justifyContent:'flex-end'}}>
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
                <span style={{fontSize:12, color:'#888'}}>Página <strong>{page}</strong> de {totalPages}</span>
                <div style={{display:'flex', gap:6}}>
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