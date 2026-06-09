# THE-BOT — Sorteos de Oficina

Aplicación web para gestionar de forma equitativa los turnos de **almuerzo** y **limpieza** del equipo de oficina. Implementa un sistema de sorteo ponderado por frecuencia y antigüedad para garantizar una rotación justa.

## Tecnologías

- **Next.js 16** (App Router, React 19)
- **TypeScript 5**
- **Tailwind CSS 4**
- **MySQL 2** sobre AWS RDS (eu-west-1)
- Autenticación por cookie con contraseña única de admin

## Estructura del proyecto

```
app/
├── api/
│   ├── login/route.ts       # POST autenticación
│   ├── personas/route.ts    # GET/POST/PATCH/DELETE gestión del equipo
│   └── sorteo/route.ts      # POST sorteo (endpoint legacy)
├── dashboard/page.tsx       # CRUD de personas
├── login/page.tsx           # Pantalla de login
├── page.tsx                 # Página principal de sorteo
├── layout.tsx               # Layout con Navbar
└── globals.css
components/
└── Navbar.tsx               # Navegación sticky
lib/
└── db.ts                    # Pool singleton de MySQL
types/
└── index.ts                 # Interfaces Persona y ResultadoSorteo
middleware.ts                # Guard de autenticación por cookie
```

## Variables de entorno

Copia `.env.example` a `.env` y rellena los valores:

```bash
cp .env.example .env
```

| Variable            | Descripción                              |
|---------------------|------------------------------------------|
| `DB_HOST`           | Host de la base de datos MySQL           |
| `DB_USER`           | Usuario de MySQL                         |
| `DB_PASSWORD`       | Contraseña de MySQL                      |
| `DB_NAME`           | Nombre de la base de datos               |
| `DB_PORT`           | Puerto (por defecto 3306)                |
| `DATABASE_URL`      | URL de conexión completa                 |
| `ADMIN_PASSWORD`    | Contraseña para acceder a la aplicación  |
| `NEXT_PUBLIC_BASE_URL` | URL base de la app (ej. http://localhost:3000) |

## Esquema de la base de datos

La tabla `personas` debe existir en la base de datos con la siguiente estructura:

```sql
CREATE TABLE personas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(255) NOT NULL,
  telegram_id     VARCHAR(255),
  almuerzo        VARCHAR(50),      -- 'Le toca' | 'No puede' | NULL
  limpieza        VARCHAR(50),      -- 'Le toca' | 'No puede' | NULL
  veces_almuerzo  INT DEFAULT 0,
  veces_limpieza  INT DEFAULT 0,
  ultimo_almuerzo DATE,
  ultima_limpieza DATE,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  rebotes         INT DEFAULT 0
);
```

## Instalación y arranque

```bash
npm install
npm run dev
```

La app estará disponible en [http://localhost:3000](http://localhost:3000).

## Cómo funciona el sorteo

1. **Elegibles**: Se excluyen las personas marcadas como `No puede`.
2. **Ordenación**: Por `veces_X` ASC → `ultimo_X` ASC → nombre alfabético.
3. **Selección**:
   - **Almuerzo**: las 2 primeras personas del ranking.
   - **Limpieza**: la primera persona del ranking.
4. **Edición manual**: antes de confirmar se pueden intercambiar candidatos (botón 🎲) usando la lista de reserva (siguientes 3 personas en el ranking).
5. **Confirmación**: actualiza contadores y fechas en la base de datos.

## Páginas

| Ruta         | Descripción                                          |
|--------------|------------------------------------------------------|
| `/login`     | Autenticación por contraseña                         |
| `/`          | Vista del sorteo actual y lanzamiento de nuevos sorteos |
| `/dashboard` | Gestión del equipo (CRUD) con filtros, búsqueda y paginación |

## Rutas API

| Método | Ruta              | Descripción                        |
|--------|-------------------|------------------------------------|
| POST   | `/api/login`      | Autenticación, setea cookie        |
| GET    | `/api/personas`   | Lista todas las personas           |
| POST   | `/api/personas`   | Crea una nueva persona             |
| PATCH  | `/api/personas`   | Actualiza una persona por ID       |
| DELETE | `/api/personas`   | Elimina una persona por `?id=`     |
| POST   | `/api/sorteo`     | Realiza el sorteo (endpoint legacy)|

## Producción

```bash
npm run build
npm run start
```
