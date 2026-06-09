export interface Persona {
  id: number;
  nombre: string;
  telegram_id: string;
  almuerzo: string; 
  limpieza: string;
  veces_almuerzo: number;
  veces_limpieza: number;
  ultimo_almuerzo: string | null;
  ultima_limpieza: string | null;
  updated_at: string;
  rebotes: number;
}

export interface ResultadoSorteo {
  almuerzo: Persona[];
  limpieza: Persona;
}

export interface HistorialEntry {
  id: number;
  semana: string;          // YYYY-MM-DD (lunes de la semana)
  tipo: 'almuerzo' | 'limpieza';
  persona_id: number | null;
  persona_nombre: string;
  created_at: string;
}

export interface SemanaHistorial {
  semana: string;
  almuerzo: HistorialEntry[];
  limpieza: HistorialEntry[];
}