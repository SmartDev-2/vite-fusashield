import { useEffect, useState } from 'react';
import { useDb, useConnected } from './firebase';
import { CFG } from './lib';
import { Icon, Logo } from './icons.jsx';
import { Ringkasan, Riwayat, Foto, Perangkat } from './pages.jsx';

const NAV = [
  ['ringkasan', 'Ringkasan', 'grid', 'Kondisi tanaman dan keputusan pompa saat ini', Ringkasan],
  ['riwayat', 'Riwayat fuzzy', 'history', 'Catatan keputusan fuzzy dari waktu ke waktu', Riwayat],
  ['foto', 'Foto daun', 'image', 'Foto daun yang sudah dianalisis CNN', Foto],
  ['perangkat', 'Perangkat IoT', 'chip', 'Status sensor, pompa, dan perintah terakhir', Perangkat],
];

const tanggal = (d) => d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

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

  const [key, title, , subtitle, Page] = NAV.find((n) => n[0] === hash) || NAV[0];

  return (
    <>
      <div className={'scrim' + (open ? ' show' : '')} onClick={() => setOpen(false)} />
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand">
          <Logo />
          <div><b>FusaShield</b><small>Mitigasi layu Fusarium</small></div>
          <button className="side-close" onClick={() => setOpen(false)} aria-label="Tutup menu"><Icon n="close" /></button>
        </div>

        <div className="side-label">Menu</div>
        <nav>
          {NAV.map(([k, label, icon]) => (
            <a key={k} href={'#' + k} className={'nav' + (k === key ? ' on' : '')} aria-current={k === key ? 'page' : undefined}>
              <Icon n={icon} size={19} />{label}
            </a>
          ))}
        </nav>

        <div className="side-foot">
          <div className="dev-card">
            <span className="dev-ico"><Icon n="leaf" size={18} /></span>
            <div>
              <div className="dev-name">{CFG.device}</div>
              <div className="dev-sub">{mon?.fuzzy_output?.fase_hst || 'Tanaman cabai'}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <button className="burger" onClick={() => setOpen(true)} aria-label="Buka menu"><Icon n="menu" /></button>
          <div className="top-title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="top-right">
            <span className={'conn ' + (online ? 'ok' : 'off')}><i />{online ? 'Firebase terhubung' : 'Firebase terputus'}</span>
            <div className="clock">
              <b>{now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</b>
              <small>{tanggal(now)}</small>
            </div>
          </div>
        </header>

        <main>
          {err && (
            <div className="notice bad"><Icon n="alert" size={18} />
              <span>Data Firebase tidak bisa dibaca: {err}. Periksa Rules database dan nilai VITE_FIREBASE_DATABASE_URL di file .env.</span></div>
          )}
          <Page mon={mon} hist={hist} />
        </main>
      </div>
    </>
  );
}

