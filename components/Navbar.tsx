"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  // usePathname nos dice en qué página estamos para iluminar el botón correcto
  const pathname = usePathname();

  return (
    <>
      <style>{`
        .navbar {
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          padding: 0 32px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        
        .nav-brand {
          font-weight: 700;
          font-size: 18px;
          letter-spacing: 0.05em;
          color: #111;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-brand-dot {
          width: 8px;
          height: 8px;
          background-color: #df30a4ff;
          border-radius: 50%;
        }

        .nav-links {
          display: flex;
          gap: 32px;
          height: 100%;
        }

        .nav-link {
          font-size: 13px;
          font-weight: 600;
          color: #888;
          text-decoration: none;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: flex;
          align-items: center;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
          height: 100%;
          padding-top: 2px; /* Compensate border for perfect centering */
        }

        .nav-link:hover {
          color: #111;
        }

        .nav-link.active {
          color: #df30a4ff;
          border-bottom-color: #df30a4ff;
        }

        /* Profile placeholder */
        .nav-profile {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f0f0f0;
          color: #888;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid #e5e7eb;
          cursor: pointer;
        }
        .nav-profile:hover { background: #e5e7eb; color: #111; }
      `}</style>

      <nav className="navbar">
        <Link href="/" className="nav-brand">
          <div className="nav-brand-dot"></div>
          THE-BOT
        </Link>

        <div className="nav-links">
          <Link 
            href="/" 
            className={`nav-link ${pathname === '/' ? 'active' : ''}`}
          >
            Sorteo
          </Link>
          <Link 
            href="/dashboard" 
            className={`nav-link ${pathname?.includes('/dashboard') ? 'active' : ''}`}
          >
            Personas
          </Link>
          <Link
            href="/calendario"
            className={`nav-link ${pathname?.includes('/calendario') ? 'active' : ''}`}
          >
            Calendario
          </Link>
        </div>

        <div className="nav-profile">
          A
        </div>
      </nav>
    </>
  );
}