import { useState } from 'react';
import { CFG, MSG, dash, isLiveIotData, level, photoUrl } from './lib';
import { clearMonitoring } from './firebase';
import { Icon } from './icons.jsx';

const LEVELS = ['aman', 'preventif', 'waspada', 'kritis'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const hideBroken = (e) => { e.currentTarget.style.visibility = 'hidden'; };

 /Grafik tren dengan tooltip dan filter seri/
const W = 720, H = 250, L = 38, R = 14, T = 12, B = 28;

function Chart({ labels, series }) {
  const [off, setOff] = useState({});
  const [idx, setIdx] = useState(null);
  const n = labels.length;
  const x = (i) => L + (n < 2 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - T - B);
  const path = (data) => {
    let d = '', pen = false;
    data.forEach((v, i) => {
      if (v === null || v === undefined) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; pen = true;
    });
    return d;
  };
  const move = (e) => {
    if (n === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setIdx(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))));
  };
  const ticks = n < 2 ? [0] : [0, 1, 2, 3].map((k) => Math.round((k * (n - 1)) / 3));

  return (
    <div className="chart">
      <div className="chips">
        {series.map((s) => (
          <button key={s.name} className={'chip' + (off[s.name] ? ' off' : '')} aria-pressed={!off[s.name]}
            onClick={() => setOff({ ...off, [s.name]: !off[s.name] })}>
            <i style={{ background: s.color }} />{s.name}
          </button>
        ))}
      </div>

      {n === 0 ? (
        <div className="empty small"><Icon n="history" size={22} /><span>Grafik muncul setelah ada catatan di history_log.</span></div>
      ) : (
        <div className="chart-box">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Grafik tren suhu, kelembapan udara, dan gejala CNN"
            onPointerMove={move} onPointerLeave={() => setIdx(null)}>
            {[0, 25, 50, 75, 100].map((g) => (
              <g key={g}>
                <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className="gl" />
                <text x={L - 8} y={y(g) + 4} textAnchor="end" className="gt">{g}</text>
              </g>
            ))}
            {ticks.map((i) => (
              <text key={i} x={x(i)} y={H - 7} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="gt">{labels[i]}</text>
            ))}
            {series.filter((s) => !off[s.name]).map((s) => (
              <path key={s.name} d={path(s.data)} fill="none" stroke={s.color} strokeWidth="2.2"
                strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash} />
            ))}
            {idx !== null && <>
              <line x1={x(idx)} x2={x(idx)} y1={T} y2={H - B} className="cross" />
              {series.filter((s) => !off[s.name] && s.data[idx] != null).map((s) => (
                <circle key={s.name} cx={x(idx)} cy={y(s.data[idx])} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.4" />
              ))}
            </>}
          </svg>
          {idx !== null && (
            <div className="tip" style={{ left: `${(x(idx) / W) * 100}%` }} data-flip={idx > n * 0.6 ? '1' : undefined}>
              <b>{labels[idx]}</b>
              {series.filter((s) => !off[s.name]).map((s) => (
                <div key={s.name}><i style={{ background: s.color }} />{s.name}<span>{dash(s.data[idx])}</span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Ringkasan ---------- */
function Metric({ icon, tone, label, value, unit, note, bar }) {
  const hasVal = value != null && value !== '–';
  return (
    <div className="card metric">
      <div className="m-head"><span className={'m-ico ' + tone}><Icon n={icon} size={20} /></span><span className="m-label">{label}</span></div>
      <div className="m-val">{value}{hasVal && unit && <small>{unit}</small>}</div>
      {bar != null && hasVal && <div className="bar"><i className={tone} style={{ width: Math.max(0, Math.min(100, bar)) + '%' }} /></div>}
      <div className="m-note">{note}</div>
    </div>
  );
}

export function Ringkasan({ mon, hist }) {
  const f = mon?.fuzzy_output || {};
  const S = f.sumber_sensor || {};
  const lv = level(f);
  const soilOk = !!mon?.soil_valid;
  const pumpOn = mon?.pump_status === 'ON';
  const img = photoUrl(f.foto_sumber);

  const live = isLiveIotData(mon);

  if (!live) {
    const isDemo = Boolean(
      S.temperature === 'DEMO' ||
      S.humidity === 'DEMO' ||
      S.soil_moisture === 'DEMO' ||
      (typeof f.mode_keputusan === 'string' && f.mode_keputusan.toUpperCase().includes('DEMO'))
    );

    return (
      <div className="stack">
        <div className="card">
          <div className="empty" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <Icon n="chip" size={48} />
            <h3 style={{ fontSize: '1.25rem', marginTop: '1rem', color: 'var(--ink)' }}>
              {isDemo ? 'Data Demo Dinonaktifkan' : 'Perangkat IoT Sedang Tidak Aktif'}
            </h3>
            <p style={{ maxWidth: '520px', margin: '0.5rem auto 1.2rem', color: 'var(--mute)', lineHeight: '1.5' }}>
              {isDemo
                ? 'Data lama di Firebase terdeteksi sebagai data DEMO/simulasi dan disembunyikan. Nyalakan perangkat IoT ESP32 untuk menampilkan data pembacaan sensor riil.'
                : 'Perangkat ESP32 sedang mati atau tidak mengirim data baru ke Firebase. Dashboard hanya menampilkan data ketika perangkat IoT dalam keadaan aktif.'}
            </p>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.88rem',
                color: 'var(--ink)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
              onClick={async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                btn.textContent = 'Membersihkan data Firebase...';
                const res = await clearMonitoring(CFG.device);
                if (res.ok) {
                  btn.textContent = '✓ Data Sisa di Firebase Berhasil Dibersihkan';
                  btn.style.borderColor = 'var(--aman)';
                  btn.style.color = 'var(--aman)';
                } else {
                  btn.textContent = 'Info: ' + (res.error || 'Akses hapus dibatasi');
                  btn.disabled = false;
                }
              }}
            >
              <Icon n="trash" size={16} /> Bersihkan Sisa Data Demo di Firebase
            </button>
          </div>
        </div>

        {hist && hist.length > 0 && (
          <div className="card">
            <div className="card-h"><h3>Tren riwayat sebelumnya</h3><span className="muted">{hist.length} catatan tersimpan di history_log</span></div>
            <Chart labels={hist.map((h) => (h.last_updated || '').slice(5, 16))} series={[
              { name: 'Suhu (°C)', color: '#e8731a', data: hist.map((h) => h.input_suhu ?? null) },
              { name: 'Kelembapan udara (%)', color: '#2f8fd0', data: hist.map((h) => h.input_kelembapan_udara ?? null) },
              { name: 'Gejala CNN (%)', color: '#d9363e', dash: '6 5', data: hist.map((h) => h.cnn_symptom_score ?? null) },
            ]} />
          </div>
        )}
      </div>
    );
  }

  const warns = [];
  if (mon && !soilOk && mon.soil_raw != null) warns.push(`Sensor kelembapan tanah belum terbaca (nilai mentah ${dash(mon.soil_raw)}). Biasanya probe di udara atau kabel lepas.`);
  if (f.foto_basi) warns.push('Foto daun sudah lama. Ambil foto baru agar analisis akurat.');
  if (f.alasan_blokir) warns.push('Pompa tertahan: ' + f.alasan_blokir + '.');
  const soilVal = soilOk ? mon.soil_moisture : f.input_kelembapan ?? mon.soil_moisture;
  const cooldown = f.sisa_cooldown_detik > 0;

  const pumpVal = mon.pump_status ? (pumpOn ? 'Menyala' : 'Mati') : '–';
  const pumpTone = mon.pump_status ? (pumpOn ? 't-green' : 't-gray') : 't-gray';
  const pumpNote = mon.pump_status
    ? (cooldown ? `Siap lagi sekitar ${Math.ceil(f.sisa_cooldown_detik / 3600)} jam` : f.agitator_detik ? `Siap dipakai, agitator ${f.agitator_detik} detik` : 'Status pompa normal')
    : 'Menunggu status pompa dari ESP32';

  return (
    <div className="stack">
      <section className={`hero lv-${lv || 'none'}` + (lv === 'kritis' ? ' pulse' : '')}>
        <div className="hero-main">
          <span className="hero-ico"><Icon n={lv ? (lv === 'aman' ? 'check' : 'alert') : 'chip'} size={28} sw={2} /></span>
          <div>
            <div className="hero-kicker">Status mitigasi{lv ? <span className={`pill lv-${lv}`}>{cap(lv)}</span> : <span className="pill lv-none">Menunggu Analisis</span>}</div>
            <h2>{lv ? (f.status_mitigasi || cap(lv)) : 'Sensor Terhubung, Menunggu Analisis'}</h2>
            <p>{lv ? (MSG[lv] || 'Kondisi tanaman terpantau.') : 'Data sensor terbaca dari ESP32. Menunggu model AI & logika fuzzy memproses status tanaman.'}</p>
          </div>
        </div>
        <div className="hero-side">
          <div className="dose">
            {lv ? (
              <><b>{f.dosis_rekomendasi_ml ?? f.dosis_ml ?? 0}</b><span>ml</span><small>Dosis rekomendasi Trichoderma</small></>
            ) : (
              <><b>–</b><small>Belum ada rekomendasi dosis</small></>
            )}
          </div>
          <ol className="scale" aria-label="Tingkat dosis">
            {LEVELS.map((l) => (
              <li key={l} className={`lv-${l}` + (l === lv ? ' on' : '')}><i /><span>{cap(l)}</span></li>
            ))}
          </ol>
        </div>
      </section>

      {warns.length > 0 && (
        <div className="notice warn"><Icon n="alert" size={18} /><span>{warns.join(' ')}</span></div>
      )}

      <div className="grid4">
        <Metric icon="thermo" tone="t-orange" label="Suhu udara" value={mon.temperature != null ? mon.temperature : '–'} unit="°C"
          note={mon.temperature != null ? 'Pemantauan suhu lingkungan' : 'Belum ada pembacaan suhu'} />

        <Metric icon="wind" tone="t-blue" label="Kelembapan udara" value={mon.humidity != null ? mon.humidity : '–'} unit="%" bar={mon.humidity}
          note={mon.humidity != null ? 'Pemantauan kelembapan udara' : 'Belum ada pembacaan kelembapan'} />

        <Metric icon="drop" tone="t-green" label="Kelembapan tanah" value={soilVal != null ? soilVal : '–'} unit="%" bar={soilVal}
          note={soilOk ? 'Kondisi tanah terpantau' : mon.soil_raw != null ? 'Periksa probe dan koneksi kabel sensor' : 'Belum ada pembacaan tanah'} />

        <Metric icon="bolt" tone={pumpTone} label="Pompa Trichoderma" value={pumpVal} note={pumpNote} />
      </div>

      <div className="grid3">
        <div className="card">
          <div className="card-h"><h3>Tren 50 catatan terakhir</h3><span className="muted">Arahkan kursor untuk melihat nilainya</span></div>
          <Chart labels={hist.map((h) => (h.last_updated || '').slice(5, 16))} series={[
            { name: 'Suhu (°C)', color: '#e8731a', data: hist.map((h) => h.input_suhu ?? null) },
            { name: 'Kelembapan udara (%)', color: '#2f8fd0', data: hist.map((h) => h.input_kelembapan_udara ?? null) },
            { name: 'Gejala CNN (%)', color: '#d9363e', dash: '6 5', data: hist.map((h) => h.cnn_symptom_score ?? null) },
          ]} />
        </div>

        <div className="card">
          <div className="card-h"><h3>Foto daun terakhir</h3></div>
          <div className="frame">
            {img ? <img src={img} alt="Foto daun terakhir" onError={hideBroken} /> : <div className="empty small"><Icon n="camera" size={26} /><span>Belum ada foto</span></div>}
          </div>
          {img && (
            <div className="photo-meta">
              <div><b>{dash(f.cnn_label)}</b>{f.cnn_confidence != null && <span className="muted"> keyakinan {f.cnn_confidence}%</span>}</div>
              <div className="muted">Skor gejala {dash(f.cnn_symptom_score)}%</div>
              {f.foto_umur_jam != null && <div className="muted">Diambil {f.foto_umur_jam} jam lalu</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Riwayat ---------- */
export function Riwayat({ hist }) {
  const rows = [...hist].reverse();
  const heads = ['Waktu', 'Foto', 'Hasil CNN', 'Skor', 'Suhu', 'RH udara', 'Tanah', 'Dosis', 'Durasi', 'Pompa', 'Level', 'Status'];
  return (
    <div className="card nopad">
      <div className="card-h pad"><h3>Riwayat keputusan fuzzy</h3><span className="muted">{rows.length} catatan terakhir, terbaru di atas</span></div>
      <div className="scroll">
        <table>
          <thead><tr>{heads.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={heads.length}><div className="empty"><Icon n="history" size={26} /><span>Belum ada catatan. Riwayat terisi setelah fuzzy menghasilkan keputusan pertama.</span></div></td></tr>}
            {rows.map((h) => {
              const lv = level(h); const u = photoUrl(h.foto_sumber);
              return (
                <tr key={h.k}>
                  <td>{dash(h.last_updated)}</td>
                  <td>{u ? <img className="thumb" src={u} alt="" loading="lazy" onError={hideBroken} /> : <span className="muted">–</span>}</td>
                  <td>{dash(h.cnn_label)}{h.cnn_confidence != null && <span className="muted"> {h.cnn_confidence}%</span>}</td>
                  <td>{dash(h.cnn_symptom_score)}</td>
                  <td>{dash(h.input_suhu)}</td>
                  <td>{dash(h.input_kelembapan_udara)}</td>
                  <td>{dash(h.input_kelembapan)}</td>
                  <td>{h.dosis_ml ?? 0} ml <span className="muted">(rek. {dash(h.dosis_rekomendasi_ml)})</span></td>
                  <td>{h.durasi_pompa_detik ?? 0} dtk</td>
                  <td><span className={'dot-s ' + (h.pump_command === 'ON' ? 'on' : '')}>{h.pump_command === 'ON' ? 'ON' : 'OFF'}</span></td>
                  <td><span className={`pill lv-${lv}`}>{cap(lv)}</span></td>
                  <td className="muted">{dash(h.status_mitigasi)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Foto ---------- */
export function Foto({ hist }) {
  const seen = new Set();
  const items = [...hist].reverse().filter((h) => h.foto_sumber && !seen.has(h.foto_sumber) && seen.add(h.foto_sumber));
  if (items.length === 0) {
    return <div className="card"><div className="empty"><Icon n="camera" size={30} /><span>Belum ada foto. Foto muncul setelah daun difoto dan diproses CNN.</span></div></div>;
  }
  return (
    <div className="gallery">
      {items.map((h) => {
        const lv = level(h);
        return (
          <figure className="card nopad shot" key={h.foto_sumber}>
            <div className="shot-img">
              <img src={photoUrl(h.foto_sumber)} alt={h.cnn_label || 'Foto daun'} loading="lazy" onError={hideBroken} />
              <span className={`pill lv-${lv}`}>{cap(lv)}</span>
            </div>
            <figcaption>
              <b>{dash(h.cnn_label)}</b>{h.cnn_confidence != null && <span className="muted"> {h.cnn_confidence}%</span>}
              <div className="muted">{dash(h.last_updated)}</div>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/* ---------- Perangkat ---------- */
function KV({ title, icon, rows }) {
  return (
    <div className="card">
      <div className="card-h"><h3><Icon n={icon} size={18} /> {title}</h3></div>
      <dl className="kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{dash(v)}</dd></div>)}</dl>
    </div>
  );
}

export function Perangkat({ mon }) {
  const live = isLiveIotData(mon);

  if (!live) {
    return (
      <div className="card">
        <div className="empty" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <Icon n="chip" size={48} />
          <h3 style={{ fontSize: '1.25rem', marginTop: '1rem', color: 'var(--ink)' }}>Perangkat IoT Sedang Tidak Aktif</h3>
          <p style={{ maxWidth: '520px', margin: '0.4rem auto 0', color: 'var(--mute)', lineHeight: '1.5' }}>
            ESP32 belum mengirimkan telemetri aktif pada node <code>monitoring/{CFG.device}</code>.
            Data konfigurasi perangkat dan sensor akan tampil otomatis setelah ESP32 hidup dan aktif mengirim data sensor.
          </p>
        </div>
      </div>
    );
  }

  const f = mon?.fuzzy_output || {}, S = f.sumber_sensor || {}, A = mon?.ack || {}, C = mon?.command || {};
  return (
    <div className="grid2">
      <KV title="Sensor dan keputusan" icon="chip" rows={[
        ['Mode keputusan', f.mode_keputusan],
        ['Status IoT', f.status_iot],
        ['Sumber suhu, RH, tanah', [S.temperature, S.humidity, S.soil_moisture].filter(Boolean).map(dash).join(' / ') || null],
        ['Sensor tanah valid', mon?.soil_valid != null ? (mon.soil_valid ? 'Ya' : 'Tidak') : null],
        ['Nilai mentah tanah', mon?.soil_raw],
        ['Uptime perangkat', mon?.uptime_ms ? Math.round(mon.uptime_ms / 60000) + ' menit' : null],
        ['Update fuzzy terakhir', f.last_updated],
      ]} />
      <KV title="Pompa dan perintah" icon="bolt" rows={[
        ['Pompa terakhir menyala', mon?.last_pump_epoch ? new Date(mon.last_pump_epoch * 1000).toLocaleString('id-ID') : null],
        ['Perintah terakhir', C.dosis_ml != null ? `${C.dosis_ml} ml, ${C.durasi_detik} dtk` : null],
        ['Konfirmasi perangkat (ACK)', A.status ? `${A.status} (${((A.durasi_aktual_ms || 0) / 1000).toFixed(1)} dtk)` : null],
        ['Status pompa sekarang', mon?.pump_status],
      ]} />
    </div>
  );
}

