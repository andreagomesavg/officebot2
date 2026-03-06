import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';



export async function GET() {
  try {
    // Traemos todo de la tabla personas
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM personas');
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Error en DB:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const setClauses = [];
    const values = [];

    // Recorre dinámicamente lo que le enviamos y construye la consulta SQL
    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = ?`);
      // Si enviamos una fecha, la ajusta a formato MySQL
      if ((key === 'ultimo_almuerzo' || key === 'ultima_limpieza') && value) {
        values.push(new Date(value as string).toISOString().slice(0, 19).replace('T', ' '));
      } else {
        values.push(value);
      }
    }

    if (setClauses.length === 0) return NextResponse.json({ message: 'Nada que actualizar' });

    values.push(id);
    const query = `UPDATE personas SET ${setClauses.join(', ')} WHERE id = ?`;
    await pool.query(query, values);

    return NextResponse.json({ message: 'Usuario actualizado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Extraemos las llaves y valores dinámicamente
    const keys = Object.keys(body);
    const values = Object.values(body);

    if (keys.length === 0) {
      return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
    }

    // Preparamos los valores de fecha para MySQL si vienen en el body
    const processedValues = values.map((val, index) => {
      const key = keys[index];
      if ((key === 'ultimo_almuerzo' || key === 'ultima_limpieza') && val) {
        return new Date(val as string).toISOString().slice(0, 19).replace('T', ' ');
      }
      return val;
    });

    // Construimos la consulta: INSERT INTO personas (col1, col2) VALUES (?, ?)
    const placeholders = keys.map(() => '?').join(', ');
    const query = `INSERT INTO personas (${keys.join(', ')}) VALUES (${placeholders})`;
    
    const [result]: any = await pool.query(query, processedValues);

    // IMPORTANTE: Devolvemos el ID recién creado para que el frontend lo sepa
    return NextResponse.json({ 
      id: result.insertId, 
      success: true 
    });
  } catch (error: any) {
    console.error("Error en POST:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// BORRAR PERSONA (Usando el ID de la URL)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await pool.query('DELETE FROM personas WHERE id = ?', [id]);
    return NextResponse.json({ message: 'Persona eliminada' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}