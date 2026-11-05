import { useEffect, useState } from 'react';
import { useDb, useConnected } from './firebase';
import { CFG } from './lib';
import { Ringkasan, Riwayat, Foto, Perangkat } from './pages.jsx';

const NAV = [
  ['ringkasan', 'Ringkasan', Ringkasan],
  ['riwayat', 'Riwayat fuzzy', Riwayat],
  ['foto', 'Foto daun (CNN)', Foto],
  ['perangkat', 'Perangkat IoT', Perangkat],
];

export default function App() {
  const [hash, setHash] = useState(location.hash.slice(1) || 'ringkasan');
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const online = useConnected();
  const [mon, monErr] = useDb(`monitoring/${CFG.device}`);
  const [raw, histErr] = useDb(`history_log/${CFG.device}`, 50);
  const hist = Object.entries(raw || {}).map(([k, v]) => ({ k, ...v }));
  const err = monErr || histErr;

  useEffect(() => {
    const onHash = () => { setHash(location.hash.slice(1) || 'ringkasan'); setOpen(false); window.scrollTo(0, 0); };
    addEventListener('hashchange', onHash);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => { removeEventListener('hashchange', onHash); clearInterval(t); };
  }, []);

  const [key, title, Page] = NAV.find((n) => n[0] === hash) || NAV[0];

  return (
    <>
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand"><b>FusaShield</b><small>Mitigasi layu Fusarium</small></div>
        <nav>
          {NAV.map(([k, label]) => (
            <a key={k} href={'#' + k} className={'nav' + (k === key ? ' on' : '')}>{label}</a>
          ))}
        </nav>
        <div className="dev">Tanaman: <b>{CFG.device}</b></div>
      </aside>

      <div className="main">
        <header className="top">
          <button className="burger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <h1>{title}</h1>
          <span className="phase">{mon?.fuzzy_output?.fase_hst}</span>
          <span className="conn"><i style={{ background: online ? 'var(--aman)' : 'var(--krit)' }} />{online ? 'Firebase terhubung' : 'Terputus'}</span>
          <span className="clock">{now.toLocaleTimeString('id-ID')}</span>
        </header>
        <main>
          {err && <div className="warn">Firebase: {err} (cek Rules dan FIREBASE_DATABASE_URL)</div>}
          <Page mon={mon} hist={hist} />
        </main>
      </div>
    </>
  );
}
