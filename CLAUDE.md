# CLAUDE.md — Contexto para Claude Code

## Qué es este proyecto

**THE-BOT Sorteos Oficina** — App Next.js 16 para gestionar turnos de almuerzo y limpieza de un equipo de oficina. Sistema de sorteo ponderado por frecuencia + antigüedad de asignación.

## Stack

- Next.js 16 App Router + React 19 + TypeScript 5
- Tailwind CSS 4 (sin librerías de componentes, todo custom)
- MySQL 2 sobre AWS RDS (eu-west-1) — sin ORM, SQL crudo
- Autenticación: cookie `auth_session` (7 días, httpOnly), contraseña única vía `ADMIN_PASSWORD`

## Puntos clave de arquitectura

- Todas las páginas son Client Components (`"use client"`) — no hay Server Components en uso.
- El pool de MySQL es un singleton en `lib/db.ts` que reutiliza conexiones en desarrollo.
- El middleware (`middleware.ts`) protege todas las rutas excepto `/login`; redirige a `/login` si no hay cookie.
- No hay ORM ni migraciones — el schema debe crearse manualmente en RDS.
- Los estilos se aplican mayoritariamente con clases Tailwind inline; hay bloques `<style>` dentro de componentes para estilos que Tailwind no cubre.
- El color de acento es `#df30a4` (rosa THE-ARE).

## Tipos principales (types/index.ts)

```ts
interface Persona {
  id: number; nombre: string; telegram_id: string;
  almuerzo: string;          // 'Le toca' | 'No puede' | null
  limpieza: string;          // 'Le toca' | 'No puede' | null
  veces_almuerzo: number;    // contador de turnos de almuerzo
  veces_limpieza: number;    // contador de turnos de limpieza
  ultimo_almuerzo: string | null;
  ultima_limpieza: string | null;
  updated_at: string;
  rebotes: number;
}
```

## Lógica del sorteo (app/page.tsx)

Ordenación: `veces_X` ASC → `ultimo_X` ASC → nombre ASC. Se eligen 2 para almuerzo y 1 para limpieza. El usuario puede intercambiar candidatos con la lista de reserva (siguientes 3) antes de confirmar. Al confirmar se hace PATCH a `/api/personas` para cada persona afectada.

## Rutas API

- `POST /api/login` — valida `ADMIN_PASSWORD`, setea cookie
- `GET|POST|PATCH|DELETE /api/personas` — CRUD de personas
- `POST /api/sorteo` — sorteo legacy (no usado desde la UI actual)

## Comandos frecuentes

```bash
npm run dev     # desarrollo en localhost:3000
npm run build   # build de producción
npm run lint    # ESLint
```

## Variables de entorno necesarias

`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `DATABASE_URL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_BASE_URL`

## Convenciones de este proyecto

- Sin comentarios en el código salvo que sea imprescindible.
- Sin ORM — mantener SQL crudo con `mysql2/promise`.
- Estilo inline con Tailwind; bloques `<style>` solo si Tailwind no llega.
- No añadir dependencias sin necesidad clara.
- `ignoreBuildErrors: true` en next.config.mjs — no bloquear builds por errores de tipos.
