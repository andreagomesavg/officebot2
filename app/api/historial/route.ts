import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { PoolConnection } from 'mysql2/promise';

const SELECT = `SELECT id, DATE_FORMAT(semana, '%Y-%m-%d') AS semana, tipo, persona_id, persona_nombre, created_at FROM sorteo_historial`;

// Recalcula veces y fechas de todas las personas a partir del historial
async function recalcularVeces(conn: PoolConnection) {
  await conn.query(`
    UPDATE personas p SET
      veces_almuerzo = COALESCE((
        SELECT COUNT(DISTINCT semana) FROM sorteo_historial
        WHERE persona_id = p.id AND tipo = 'almuerzo'
      ), 0),
      veces_limpieza = COALESCE((
        SELECT COUNT(DISTINCT semana) FROM sorteo_historial
        WHERE persona_id = p.id AND tipo = 'limpieza'
      ), 0),
      ultimo_almuerzo = (
        SELECT DATE_FORMAT(MAX(semana), '%Y-%m-%d') FROM sorteo_historial
        WHERE persona_id = p.id AND tipo = 'almuerzo'
      ),
      ultima_limpieza = (
        SELECT DATE_FORMAT(MAX(semana), '%Y-%m-%d') FROM sorteo_historial
        WHERE persona_id = p.id AND tipo = 'limpieza'
      )
  `);
}

// GET /api/historial
//   ?ultima=true        → semana más reciente
//   ?semana=YYYY-MM-DD  → semana específica
//   ?persona_id=X       → todas las participaciones de una persona
//   (sin params)        → todas las semanas orden DESC
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ultima    = searchParams.get('ultima');
  const semana    = searchParams.get('semana');
  const personaId = searchParams.get('persona_id');

  try {
    const conn = await pool.getConnection();
    let rows;

    if (ultima === 'true') {
      [rows] = await conn.query(
        `${SELECT} WHERE semana = (SELECT MAX(semana) FROM sorteo_historial) ORDER BY tipo, id`
      );
    } else if (semana) {
      [rows] = await conn.query(`${SELECT} WHERE semana = ? ORDER BY tipo, id`, [semana]);
    } else if (personaId) {
      [rows] = await conn.query(
        `SELECT MIN(id) AS id, DATE_FORMAT(semana, '%Y-%m-%d') AS semana, tipo, persona_id, persona_nombre, MIN(created_at) AS created_at
         FROM sorteo_historial
         WHERE persona_id = ?
         GROUP BY semana, tipo, persona_id, persona_nombre
         ORDER BY semana DESC, tipo`,
        [personaId]
      );
    } else {
      [rows] = await conn.query(`${SELECT} ORDER BY semana DESC, tipo, id`);
    }

    conn.release();
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
}

// POST /api/historial — guarda y recalcula (usado al confirmar sorteo nuevo)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { semana, entries } = body as {
    semana: string;
    entries: { tipo: 'almuerzo' | 'limpieza'; persona_id: number; persona_nombre: string }[];
  };

  if (!semana || !Array.isArray(entries)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  try {
    const conn = await pool.getConnection();
    await conn.query('DELETE FROM sorteo_historial WHERE semana = ?', [semana]);
    for (const e of entries) {
      await conn.query(
        'INSERT INTO sorteo_historial (semana, tipo, persona_id, persona_nombre) VALUES (?, ?, ?, ?)',
        [semana, e.tipo, e.persona_id, e.persona_nombre]
      );
    }
    await recalcularVeces(conn);
    conn.release();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al guardar historial' }, { status: 500 });
  }
}

// PUT /api/historial — edición desde calendario: reemplaza la semana y recalcula
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { semana, entries } = body as {
    semana: string;
    entries: { tipo: 'almuerzo' | 'limpieza'; persona_id: number; persona_nombre: string }[];
  };

  if (!semana || !Array.isArray(entries)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  try {
    const conn = await pool.getConnection();
    await conn.query('DELETE FROM sorteo_historial WHERE semana = ?', [semana]);
    for (const e of entries) {
      await conn.query(
        'INSERT INTO sorteo_historial (semana, tipo, persona_id, persona_nombre) VALUES (?, ?, ?, ?)',
        [semana, e.tipo, e.persona_id, e.persona_nombre]
      );
    }
    await recalcularVeces(conn);
    conn.release();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al editar historial' }, { status: 500 });
  }
}

// PATCH /api/historial — limpieza + normalización + recalculo completo (herramienta de corrección)
export async function PATCH() {
  try {
    const conn = await pool.getConnection();
    // Borrar registros anteriores a 2026
    await conn.query(`DELETE FROM sorteo_historial WHERE semana < '2026-01-01'`);
    // Normalizar domingos a lunes (artefacto del bug de timezone UTC)
    await conn.query(`
      UPDATE sorteo_historial SET semana = DATE_ADD(semana, INTERVAL 1 DAY)
      WHERE DAYOFWEEK(semana) = 1
    `);
    await recalcularVeces(conn);
    conn.release();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al recalcular' }, { status: 500 });
  }
}

// DELETE /api/historial?semana=YYYY-MM-DD — borra la semana y recalcula
export async function DELETE(req: NextRequest) {
  const semana = new URL(req.url).searchParams.get('semana');
  if (!semana) return NextResponse.json({ error: 'Se requiere el parámetro semana' }, { status: 400 });
  try {
    const conn = await pool.getConnection();
    await conn.query('DELETE FROM sorteo_historial WHERE semana = ?', [semana]);
    await recalcularVeces(conn);
    conn.release();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al eliminar historial' }, { status: 500 });
  }
}
