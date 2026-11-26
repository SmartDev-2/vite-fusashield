import { useEffect, useRef, useState } from 'react';
import { CFG, MSG, dash, level, photoUrl } from './lib';
import { clearMonitoring } from './firebase';
import { Icon } from './icons.jsx';
import './upload.css';

const LEVELS = ['aman', 'preventif', 'waspada', 'kritis'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const hideBroken = (e) => { e.currentTarget.style.visibility = 'hidden'; };

/* Grafik tren dengan tooltip dan filter seri */
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

export function Ringkasan({ mon, hist, live }) {
  const f = mon?.fuzzy_output || {};
  const S = f.sumber_sensor || {};
  const lv = level(f);
  const soilOk = !!mon?.soil_valid;
  const pumpOn = mon?.pump_status === 'ON';
  const img = photoUrl(f.foto_sumber);

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

/* ---------- Unggah foto ---------- */
const MAX_PILIH = 15 * 1024 * 1024; // batas file asli, sebelum dikecilkan
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Kecilkan ke maksimal 1024 px dan jadikan JPEG (sama seperti yang dilakukan API mobile)
async function keJpeg(file, sisi = 1024) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error('Gambar tidak bisa dibaca. Coba pakai format JPG atau PNG.'); }
  const skala = Math.min(1, sisi / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * skala);
  c.height = Math.round(bmp.height * skala);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((ok, gagal) =>
    c.toBlob((b) => (b ? ok(b) : gagal(new Error('Gagal memproses gambar'))), 'image/jpeg', 0.88));
}

export function Foto({ hist, pending, pendErr }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const pilih = (f) => {
    setMsg(null);
    if (!f) return;
    if (!f.type.startsWith('image/')) return setMsg({ ok: false, text: 'File harus berupa gambar (JPG, PNG, atau WEBP).' });
    if (f.size > MAX_PILIH) return setMsg({ ok: false, text: 'Foto terlalu besar, maksimal 15 MB.' });
    setFile(f);
  };

  const kirim = async () => {
    if (!file || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const blob = await keJpeg(file);
      const r = await fetch(`${API}/api/upload`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || `Unggahan gagal (${r.status})`);
      setFile(null);
      setMsg({ ok: true, text: 'Foto terkirim. Lihat hasil di ' });
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Unggahan gagal' });
    } finally {
      setBusy(false);
    }
  };

  const rows = Object.entries(pending || {})
    .map(([k, v]) => ({ k, ...v }))
    .filter((p) => p.path)
    .sort((a, b) => (b.uploaded_at || 0) - (a.uploaded_at || 0));

  return (
    <div className="up-grid">
      <div className="card">
        <div className="card-h"><h3><Icon n="image" size={18} /> Unggah foto daun</h3><span className="muted">JPG, PNG, atau WEBP</span></div>

        {file ? (
          <>
            <div className="up-prev">{preview && <img src={preview} alt="Pratinjau foto daun" />}</div>
            <div className="up-name">{file.name}</div>
          </>
        ) : (
          <label className={'dz' + (drag ? ' drag' : '')}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pilih(e.dataTransfer.files[0]); }}>
            <Icon n="camera" size={34} />
            <b>Pilih foto atau seret ke sini</b>
            <small>Foto akan dikecilkan otomatis sebelum dikirim</small>
            <input type="file" accept="image/*" onChange={(e) => { pilih(e.target.files[0]); e.target.value = ''; }} />
          </label>
        )}

        {msg && (
          <div className={'notice up-msg ' + (msg.ok ? 'good' : 'bad')}>
            <Icon n={msg.ok ? 'check' : 'alert'} size={18} />
              <span>{msg.text}{msg.ok && <><a href="#riwayat">Riwayat fuzzy</a> dan <a href="#result">Result klasifikasi</a>.</>}</span>
          </div>
        )}

        {file && (
          <div className="up-actions">
            <button className="btn" onClick={kirim} disabled={busy}>{busy ? 'Mengunggah...' : 'Unggah dan nilai'}</button>
            <button className="btn ghost" onClick={() => { setFile(null); setMsg(null); }} disabled={busy}>Ganti foto</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-h"><h3>Unggahan terakhir</h3><span className="muted">Hasil lengkap ada di Riwayat fuzzy</span></div>
        {pendErr && <div className="notice warn up-msg"><Icon n="alert" size={18} /><span>Daftar unggahan tidak bisa dibaca: {pendErr}. Periksa Rules untuk pending_photos.</span></div>}
        {rows.length === 0 ? (
          <div className="empty small"><Icon n="history" size={22} /><span>Belum ada foto yang diunggah.</span></div>
        ) : (
          <ul className="up-list">
            {rows.map((p) => {
              const h = hist.find((x) => x.foto_sumber === p.path);
              const lv = h ? level(h) : null;
              return (
                <li className="up-item" key={p.k}>
                  <img className="thumb" src={photoUrl(p.path)} alt="" loading="lazy" onError={hideBroken} />
                  <div className="up-info">
                    <b>{p.uploaded_at ? new Date(p.uploaded_at * 1000).toLocaleString('id-ID') : '–'}</b>
                    <span className="muted">{h ? <>{dash(h.cnn_label)}{h.cnn_confidence != null && ` ${h.cnn_confidence}%`}</> : 'Menunggu penilaian'}</span>
                  </div>
                  <span className={`pill lv-${lv || 'none'}`}>{h ? (lv ? cap(lv) : 'Dinilai') : 'Menunggu'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- Result: satu daftar riwayat, detail lewat tombol ---------- */
const waktuProses = (value) => {
  if (!value) return '–';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID');
};

/* Keyakinan bisa berupa "98.5%", 0.985, atau 98.5 -> jadikan angka persen */
const keyakinan = (value) => {
  if (value == null || value === '') return null;
  const n = parseFloat(String(value).replace('%', '').replace(',', '.'));
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n <= 1 ? n * 100 : n));
};

/* "bercak_daun" -> "Bercak daun" */
const namaHasil = (s) => {
  if (s == null || s === '') return '–';
  const t = String(s).replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/* Keyakinan dari model bisa berupa kata ("yakin") atau angka (98.5 / "98.5%" / 0.985) */
const infoKeyakinan = (record) => {
  const pct = keyakinan(record.confidence);
  if (pct != null) {
    const teks = `${pct.toFixed(1)}%`;
    if (pct >= 85) return { pct, teks, singkat: `${pct.toFixed(0)}% yakin`, cls: 'lv-aman', note: 'Sistem sangat yakin dengan hasil ini' };
    if (pct >= 60) return { pct, teks, singkat: `${pct.toFixed(0)}% yakin`, cls: 'lv-preventif', note: 'Cukup yakin, sebaiknya dicek langsung ke tanaman' };
    return { pct, teks, singkat: `${pct.toFixed(0)}% yakin`, cls: 'lv-waspada', note: 'Kurang yakin, coba unggah foto daun yang lebih jelas' };
  }
  const raw = record.confidence;
  const teks = namaHasil(raw);
  const t = String(raw || '').toLowerCase();
  const singkat = raw ? `Keyakinan: ${teks}` : 'Keyakinan –';
  if (/tidak|kurang|ragu|rendah/.test(t)) return { pct: null, teks, singkat, cls: 'lv-waspada', note: 'Sistem kurang yakin, coba unggah foto daun yang lebih jelas' };
  if (/cukup|sedang/.test(t)) return { pct: null, teks, singkat, cls: 'lv-preventif', note: 'Cukup yakin, sebaiknya dicek langsung ke tanaman' };
  if (/yakin|tinggi|pasti/.test(t)) return { pct: null, teks, singkat, cls: 'lv-aman', note: 'Sistem yakin dengan hasil ini' };
  return { pct: null, teks, singkat, cls: 'lv-none', note: 'Tingkat keyakinan dari model' };
};

const daunSehat = (prediction) => /sehat|healthy|normal/i.test(prediction || '');

const gambarRecord = (record) => {
  const im = record.processed_images || {};
  return im.preprocess || im.segmentation || im.reconstruction || null;
};

const fotoKey = (value) => {
  if (!value) return '';
  let path = String(value).trim().split(/[?#]/, 1)[0].replace(/\\/g, '/');
  const storagePath = path.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)$/);
  path = (storagePath?.[1] || path).replace(/^\/+/, '');
  try { return decodeURIComponent(path); }
  catch { return path; }
};

/* Satu kotak besar per bagian, header-nya seragam */
function Panel({ icon, tone, title, desc, badge, children }) {
  return (
    <section className={`card rs rs-${tone}`}>
      <header className="rs-h">
        <span className="rs-ico"><Icon n={icon} size={22} /></span>
        <div className="rs-ht">
          <h2>{title}</h2>
          <p>{desc}</p>
        </div>
        {badge}
      </header>
      <div className="rs-b">{children}</div>
    </section>
  );
}

/* Tiga kotak ringkasan: hasil, keyakinan, waktu */
function Ringkas({ record }) {
  const yk = infoKeyakinan(record);
  const sehat = daunSehat(record.prediction);

  return (
    <div className="tiles">
      <div className={`tile ${sehat ? 'lv-aman' : 'lv-waspada'}`}>
        <span className="tile-l">Hasil pemeriksaan</span>
        <b className="tile-v tile-name"><i className="dot" />{namaHasil(record.prediction)}</b>
        <span className="tile-n">{sehat ? 'Daun terlihat sehat' : 'Daun terindikasi terserang penyakit'}</span>
      </div>

      <div className={`tile ${yk.cls}`}>
        <span className="tile-l">Tingkat keyakinan sistem</span>
        <b className="tile-v">{yk.teks}</b>
        {yk.pct != null && <div className="tile-bar"><i style={{ width: `${yk.pct}%` }} /></div>}
        <span className="tile-n">{yk.note}</span>
      </div>

      <div className="tile">
        <span className="tile-l">Waktu diperiksa</span>
        <b className="tile-v tile-time">{waktuProses(record.processed_at)}</b>
        <span className="tile-n">{record.status === 'ok' ? 'Proses berhasil' : record.status ? `Status: ${record.status}` : 'Foto daun terbaru'}</span>
      </div>
    </div>
  );
}

/* Proses gambar: 3 kotak sejajar, bernomor */
function GambarProses({ record }) {
  const images = record.processed_images;
  const hasImages = images && (images.preprocess || images.segmentation || images.reconstruction);
  if (!hasImages) return <p className="result-no-images">Gambar hasil proses belum tersedia.</p>;

  const steps = [
    ['preprocess', 'Praproses', 'Foto dirapikan supaya mudah dibaca sistem'],
    ['segmentation', 'Segmentasi', 'Bagian daun dipisahkan dari latar belakang'],
    ['reconstruction', 'Rekonstruksi', 'Bagian yang bermasalah ditandai'],
  ].filter(([key]) => images[key]);

  return (
    <ol className="steps">
      {steps.map(([key, title, desc], i) => (
        <li key={key} className="step">
          <div className="step-img">
            <span className="step-no">{i + 1}</span>
            <img src={images[key]} alt={`Hasil ${title.toLowerCase()}`} />
          </div>
          <div className="step-txt"><b>{title}</b><span>{desc}</span></div>
        </li>
      ))}
    </ol>
  );
}

/* Detail teknis dilipat supaya tidak ramai */
function DetailTeknis({ record }) {
  return (
    <details className="tech">
      <summary>Detail teknis <small>(untuk yang ingin tahu lebih dalam)</small></summary>
      <dl className="tech-grid">
        <div><dt>Nama file foto</dt><dd title={record.image_path}>{record.image_path || '–'}</dd></div>
        <div><dt>Status proses</dt><dd>{record.status || '–'}</dd></div>
        <div><dt>Margin (jarak skor ke dugaan lain)</dt><dd>{record.margin ?? '–'}</dd></div>
        <div><dt>Rasio segmentasi</dt><dd>{record.mask_ratio == null ? '–' : `${record.mask_ratio} (${(record.mask_ratio * 100).toFixed(2)}%)`}</dd></div>
      </dl>
    </details>
  );
}

/* Rekomendasi: tiap jenis tindakan jadi satu kotak */
function Rekomendasi({ recommendation }) {
  if (!recommendation) return <p className="result-no-images">Rekomendasi belum tersedia.</p>;

  const groups = [
    ['Tindakan segera', 'Lakukan hari ini', 'urgent', recommendation.tindakan_segera],
    ['Budidaya', 'Perawatan tanaman', 'care', recommendation.budidaya],
    ['Pengendalian hayati', 'Pakai bahan alami', 'bio', recommendation.hayati],
    ['Pengendalian kimia', 'Pilihan terakhir', 'chem', recommendation.kimia],
  ].filter(([, , , items]) => Array.isArray(items) && items.length > 0);

  return (
    <div className="reco">
      <div className="reco-name">{recommendation.nama || 'Rekomendasi pengendalian'}</div>

      {recommendation.kemungkinan_penyebab && (
        <div className="tile tile-wide">
          <span className="tile-l">Kemungkinan penyebab</span>
          <p>{recommendation.kemungkinan_penyebab}</p>
        </div>
      )}

      {groups.length > 0 && (
        <div className="reco-grid">
          {groups.map(([title, hint, tone, items]) => (
            <div className={`reco-box rc-${tone}`} key={title}>
              <div className="reco-box-h"><b>{title}</b><small>{hint}</small></div>
              <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
            </div>
          ))}
        </div>
      )}

      {recommendation.pemantauan && (
        <div className="tile tile-wide">
          <span className="tile-l">Pemantauan lanjutan</span>
          <p>{recommendation.pemantauan}</p>
        </div>
      )}
    </div>
  );
}

/* Satu baris riwayat: ringkas, ada tombol Detail */
function BarisRiwayat({ record, onBuka, terbaru }) {
  const thumb = gambarRecord(record);
  const yk = infoKeyakinan(record);
  const sehat = daunSehat(record.prediction);

  return (
    <li className={`hl-row ${sehat ? 'lv-aman' : 'lv-waspada'}`}>
      <span className="hl-foto">
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="ph"><Icon n="leaf" size={20} /></span>}
      </span>
      <span className="hl-hasil">
        <b>{namaHasil(record.prediction)}{terbaru && <em className="tag-baru">Terbaru</em>}</b>
        <small title={record.image_path}>{record.image_path || '–'}</small>
      </span>
      <span className="hl-waktu">{waktuProses(record.processed_at)}</span>
      <span className="hl-yakin"><span className={`pill ${yk.cls}`}>{yk.singkat}</span></span>
      <span className="hl-aksi">
        <button type="button" className="btn ghost sm" onClick={onBuka}>Detail</button>
      </span>
    </li>
  );
}

/* Kerangka daftar: judul kolom + baris-baris */
function ListBox({ kolom, children }) {
  return (
    <div className="hl">
      <div className="hl-head" aria-hidden="true">
        {kolom.map((k, i) => <span key={i}>{k}</span>)}
      </div>
      <ul className="hl-body">{children}</ul>
    </div>
  );
}

/* Jendela detail: muncul saat tombol Detail ditekan */
function Modal({ judul, sub, onClose, onPrev, onNext, pos, total, children }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && onPrev) onPrev();
      else if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', key);
    const lama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = lama;
    };
  }, [onClose, onPrev, onNext]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [sub]);

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-judul">
        <header className="modal-h">
          <div className="modal-t">
            <h2 id="modal-judul">{judul}</h2>
            <p>{sub}</p>
          </div>
          <button type="button" className="modal-x" aria-label="Tutup" onClick={onClose}>✕</button>
        </header>

        <div className="modal-b" ref={bodyRef}>{children}</div>

        <footer className="modal-f">
          {total ? (
            <div className="modal-nav">
              <button type="button" className="btn ghost sm" disabled={!onPrev} onClick={onPrev}>‹ Sebelumnya</button>
              <span>{pos} dari {total}</span>
              <button type="button" className="btn ghost sm" disabled={!onNext} onClick={onNext}>Berikutnya ›</button>
            </div>
          ) : <span />}
          <button type="button" className="btn sm" onClick={onClose}>Tutup</button>
        </footer>
      </div>
    </div>
  );
}

/* Isi jendela detail klasifikasi */
function KeputusanFuzzy({ decision }) {
  if (!decision) {
    return (
      <>
        <h3 className="rs-sub">Hasil perhitungan fuzzy</h3>
        <p className="result-no-images">Keputusan fuzzy untuk foto ini belum tersedia atau belum cocok dengan catatan riwayat.</p>
      </>
    );
  }

  const fuzzyLevel = level(decision);
  const values = [
    ['Status mitigasi', decision.status_mitigasi],
    ['Tingkat dosis', fuzzyLevel ? cap(fuzzyLevel) : decision.tingkat_dosis],
    ['Dosis rekomendasi Trichoderma', decision.dosis_rekomendasi_ml, 'ml'],
    ['Dosis yang diberikan', decision.dosis_ml, 'ml'],
    ['Durasi pompa', decision.durasi_pompa_detik, 'detik'],
    ['Status pompa', decision.pump_command],
    ['Suhu udara', decision.input_suhu, '°C'],
    ['Kelembapan udara', decision.input_kelembapan_udara, '%'],
    ['Kelembapan tanah', decision.input_kelembapan, '%'],
  ];

  return (
    <Panel icon="bolt" tone="green" title="Hasil perhitungan fuzzy" desc="Keputusan mitigasi dan dosis yang tercatat untuk foto ini">
      <div className="tiles fuzzy-tiles">
        {values.map(([label, value, unit]) => (
          <div className="tile" key={label}>
            <span className="tile-l">{label}</span>
            <b className="tile-v">{value == null || value === '' ? '–' : `${value}${unit ? ` ${unit}` : ''}`}</b>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function IsiDetail({ record, fuzzyDecision }) {
  return (
    <>
      <Ringkas record={record} />
      <KeputusanFuzzy decision={fuzzyDecision} />
      <h3 className="rs-sub">Tahapan pemrosesan citra</h3>
      <GambarProses record={record} />
      <h3 className="rs-sub">Rekomendasi pengendalian</h3>
      <Rekomendasi recommendation={record.recommendation} />
      <DetailTeknis record={record} />
    </>
  );
}

/* ---------- Filter riwayat ---------- */
const BATCH = 10;
const dua = (n) => String(n).padStart(2, '0');
const isoTanggal = (d) => `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
const hariLalu = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoTanggal(d); };

function FilterRiwayat({ f, setF, labels, total, shown, aktif, reset }) {
  const preset = [
    ['Semua', '', ''],
    ['Hari ini', hariLalu(0), hariLalu(0)],
    ['7 hari terakhir', hariLalu(6), hariLalu(0)],
    ['30 hari terakhir', hariLalu(29), hariLalu(0)],
  ];
  const ubah = (patch) => setF({ ...f, ...patch });

  return (
    <div className="rs-filter">
      <div className="rs-presets" role="group" aria-label="Rentang waktu cepat">
        {preset.map(([nama, dari, sampai]) => (
          <button key={nama} type="button" className={'chip' + (f.dari === dari && f.sampai === sampai ? ' on' : '')}
            onClick={() => ubah({ dari, sampai })}>{nama}</button>
        ))}
      </div>

      <div className="rs-fields">
        <label className="fld">Dari tanggal
          <input type="date" value={f.dari} max={f.sampai || undefined} onChange={(e) => ubah({ dari: e.target.value })} />
        </label>
        <label className="fld">Sampai tanggal
          <input type="date" value={f.sampai} min={f.dari || undefined} onChange={(e) => ubah({ sampai: e.target.value })} />
        </label>
        <label className="fld">Hasil klasifikasi
          <select value={f.hasil} onChange={(e) => ubah({ hasil: e.target.value })}>
            <option value="">Semua hasil</option>
            {labels.map((l) => <option key={l} value={l}>{namaHasil(l)}</option>)}
          </select>
        </label>
        <label className="fld">Urutkan
          <select value={f.urut} onChange={(e) => ubah({ urut: e.target.value })}>
            <option value="baru">Terbaru dulu</option>
            <option value="lama">Terlama dulu</option>
          </select>
        </label>
      </div>

      <div className="rs-filter-foot">
        <span>Menampilkan <b>{shown}</b> dari <b>{total}</b> hasil</span>
        {aktif && <button type="button" className="btn ghost sm" onClick={reset}>Reset filter</button>}
      </div>
    </div>
  );
}

const FILTER_AWAL = { dari: '', sampai: '', hasil: '', urut: 'baru' };

export function Result({ latest, predictionHistory, predictionError, hist = [] }) {
  const [f, setF] = useState(FILTER_AWAL);
  const [batas, setBatas] = useState(BATCH);
  const [buka, setBuka] = useState(null); // history_id yang sedang dibuka

  useEffect(() => { setBatas(BATCH); }, [f.dari, f.sampai, f.hasil, f.urut]);

  /* Semua hasil jadi satu daftar. "Terbaru" ikut masuk kalau belum ada di riwayat. */
  const semua = Object.entries(predictionHistory || {})
    .map(([id, record]) => ({ ...record, history_id: record.history_id || id }));

  if (latest) {
    const sudahAda = semua.some((r) => (latest.history_id && r.history_id === latest.history_id)
      || (r.image_path === latest.image_path && r.processed_at === latest.processed_at));
    if (!sudahAda) semua.push({ ...latest, history_id: latest.history_id || 'terbaru' });
  }

  semua.sort((a, b) => {
    const timeA = Date.parse(a.processed_at || '') || 0;
    const timeB = Date.parse(b.processed_at || '') || 0;
    return timeB - timeA;
  });

  const idTerbaru = semua[0]?.history_id;
  const labels = [...new Set(semua.map((r) => r.prediction).filter(Boolean))].sort();

  const mulai = f.dari ? new Date(`${f.dari}T00:00:00`).getTime() : null;
  const akhir = f.sampai ? new Date(`${f.sampai}T23:59:59.999`).getTime() : null;

  const tersaring = semua.filter((r) => {
    if (f.hasil && r.prediction !== f.hasil) return false;
    if (mulai != null || akhir != null) {
      const t = Date.parse(r.processed_at || '');
      if (!t) return false;
      if (mulai != null && t < mulai) return false;
      if (akhir != null && t > akhir) return false;
    }
    return true;
  });
  if (f.urut === 'lama') tersaring.reverse();

  const tampil = tersaring.slice(0, batas);
  const aktif = Boolean(f.dari || f.sampai || f.hasil || f.urut !== 'baru');
  const reset = () => setF(FILTER_AWAL);
  const KOLOM = ['Foto', 'Hasil', 'Waktu diperiksa', 'Keyakinan', ''];

  const idx = buka ? tersaring.findIndex((r) => r.history_id === buka) : -1;
  const recordBuka = idx >= 0 ? tersaring[idx] : null;
  const fuzzyDecision = recordBuka
    ? hist.find((entry) => fotoKey(entry.foto_sumber) === fotoKey(recordBuka.image_path))
    : null;
  const tutup = () => setBuka(null);
  const sebelumnya = idx > 0 ? () => setBuka(tersaring[idx - 1].history_id) : null;
  const berikutnya = idx >= 0 && idx < tersaring.length - 1 ? () => setBuka(tersaring[idx + 1].history_id) : null;

  return (
    <div className="result-page">
      {predictionError && (
        <div className="notice bad"><Icon n="alert" size={18} /><span>Data klasifikasi Firebase tidak bisa dibaca: {predictionError}</span></div>
      )}

      <Panel icon="history" tone="gray" title="Riwayat klasifikasi" desc="Pemeriksaan sebelumnya. Tekan tombol Detail untuk melihat selengkapnya"
        badge={<span className="rs-count">{aktif ? `${tersaring.length} / ${semua.length}` : semua.length} hasil</span>}>
        {semua.length === 0 ? (
          <div className="empty"><Icon n="leaf" size={32} /><span>Belum ada hasil klasifikasi. Unggah foto daun di menu Unggah foto dulu.</span></div>
        ) : (
          <>
            <FilterRiwayat f={f} setF={setF} labels={labels} total={semua.length} shown={tersaring.length} aktif={aktif} reset={reset} />
            {tersaring.length === 0 ? (
              <div className="empty small">
                <Icon n="history" size={22} />
                <span>Tidak ada hasil yang cocok dengan filter ini.</span>
                <button type="button" className="btn ghost sm" onClick={reset}>Reset filter</button>
              </div>
            ) : (
              <ListBox kolom={KOLOM}>
                {tampil.map((record) => (
                  <BarisRiwayat key={record.history_id} record={record} terbaru={record.history_id === idTerbaru}
                    onBuka={() => setBuka(record.history_id)} />
                ))}
              </ListBox>
            )}
            {tersaring.length > tampil.length && (
              <div className="hist-more">
                <button type="button" className="btn ghost" onClick={() => setBatas(batas + BATCH)}>
                  Tampilkan {Math.min(BATCH, tersaring.length - tampil.length)} lagi (sisa {tersaring.length - tampil.length})
                </button>
              </div>
            )}
          </>
        )}
      </Panel>

      {recordBuka && (
        <Modal judul="Detail klasifikasi"
          sub={`${namaHasil(recordBuka.prediction)} · ${waktuProses(recordBuka.processed_at)}`}
          onClose={tutup} onPrev={sebelumnya} onNext={berikutnya} pos={idx + 1} total={tersaring.length}>
          <IsiDetail record={recordBuka} fuzzyDecision={fuzzyDecision} />
        </Modal>
      )}
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

export function Perangkat({ mon, live }) {
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