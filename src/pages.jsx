import { COLOR, MSG, dash, level, photoUrl } from './lib';

function Chart({ labels, series }) {
  const W = 640, H = 220, L = 34, B = 24, T = 8;
  const x = (i) => L + (labels.length < 2 ? 0 : (i * (W - L - 8)) / (labels.length - 1));
  const y = (v) => T + (1 - v / 100) * (H - T - B);
  const path = (data) => {
    let d = '', pen = false;
    data.forEach((v, i) => {
      if (v === null || v === undefined) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; pen = true;
    });
    return d;
  };
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Grafik tren sensor dan gejala">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}><line x1={L} x2={W - 8} y1={y(g)} y2={y(g)} stroke="var(--line)" />
            <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--mute)">{g}</text></g>
        ))}
        {series.map((s) => <path key={s.name} d={path(s.data)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />)}
        {labels.length > 0 && <>
          <text x={L} y={H - 6} fontSize="11" fill="var(--mute)">{labels[0]}</text>
          <text x={W - 8} y={H - 6} fontSize="11" textAnchor="end" fill="var(--mute)">{labels[labels.length - 1]}</text></>}
      </svg>
      <div className="legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>
    </>
  );
}

export function Ringkasan({ mon, hist }) {
  const f = mon?.fuzzy_output || {};
  const lv = level(f);
  const soilOk = !!mon?.soil_valid;
  const warns = [];
  if (mon && !soilOk) warns.push(`Sensor kelembapan tanah belum terbaca (nilai mentah ${dash(mon.soil_raw)}, biasanya probe di udara atau kabel lepas).`);
  if (f.foto_basi) warns.push('Foto daun sudah expired, ambil foto baru.');
  if (f.alasan_blokir) warns.push('Pompa tertahan: ' + f.alasan_blokir + '.');
  const pumpOn = mon?.pump_status === 'ON';
  const img = photoUrl(f.foto_sumber);

  return (
    <div className="stack">
      <section className={'alert' + (lv === 'kritis' ? ' pulse' : '')} style={{ background: mon ? COLOR[lv] : 'var(--mute)' }}>
        <div className="t">{mon ? `${dash(f.status_mitigasi)} · ${lv.toUpperCase()}` : 'Menunggu data Firebase…'}</div>
        <div className="s">{mon ? `${MSG[lv]} Dosis rekomendasi ${f.dosis_rekomendasi_ml ?? 0} ml.` : '–'}</div>
      </section>
      {warns.length > 0 && <div className="warn">{warns.join(' ')}</div>}

      <div className="grid4">
        <div className="card"><div className="mute">Suhu</div><div className="big">{dash(mon?.temperature)}<small> °C</small></div></div>
        <div className="card"><div className="mute">Kelembapan udara</div><div className="big">{dash(mon?.humidity)}<small> %</small></div></div>
        <div className="card"><div className="mute">Kelembapan tanah</div>
          <div className="big">{soilOk ? mon.soil_moisture : dash(f.input_kelembapan)}<small> %</small></div>
          <div className="mute sm">{soilOk ? 'Sensor valid' : 'Nilai demo (sensor tidak terbaca)'}</div></div>
        <div className="card"><div className="mute">Pompa Trichoderma</div><div className="big">{pumpOn ? 'MENYALA' : 'OFF'}</div>
          <div className="mute sm">{f.sisa_cooldown_detik > 0 ? `Cooldown ${Math.ceil(f.sisa_cooldown_detik / 3600)} jam lagi` : `Siap · agitator ${f.agitator_detik || 15} dtk`}</div></div>
      </div>

      <div className="grid3">
        <div className="card span2"><b>Tren (50 catatan terakhir)</b>
          <Chart labels={hist.map((h) => (h.last_updated || '').slice(5, 16))} series={[
            { name: 'Suhu (°C)', color: 'var(--wasp)', data: hist.map((h) => h.input_suhu ?? null) },
            { name: 'RH udara (%)', color: 'var(--aman)', data: hist.map((h) => h.input_kelembapan_udara ?? null) },
            { name: 'Gejala CNN (%)', color: 'var(--krit)', dash: '5 4', data: hist.map((h) => h.cnn_symptom_score ?? null) },
          ]} /></div>
        <div className="card"><b>Foto terakhir</b>
          {img ? <img className="photo" src={img} alt="Foto daun terakhir" /> : <div className="photo" />}
          <div className="sm"><b>{dash(f.cnn_label)}</b> <span className="mute">{f.cnn_confidence != null ? f.cnn_confidence + '%' : ''}</span></div>
          <div className="mute sm">Skor gejala: {dash(f.cnn_symptom_score)}%</div>
          <div className="mute sm">{f.foto_umur_jam != null ? `Diambil ${f.foto_umur_jam} jam lalu` : ''}</div></div>
      </div>
    </div>
  );
}

export function Riwayat({ hist }) {
  const rows = [...hist].reverse();
  return (
    <div className="card nopad"><div className="scroll"><table>
      <thead><tr>{['Waktu', 'Foto', 'Hasil CNN', 'Skor', 'Suhu', 'RH udara', 'Tanah', 'Dosis', 'Durasi', 'Pompa', 'Level', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan="12" className="mute">Belum ada data.</td></tr>}
        {rows.map((h) => { const lv = level(h); const u = photoUrl(h.foto_sumber); return (
          <tr key={h.k}>
            <td>{dash(h.last_updated)}</td>
            <td>{u ? <img className="thumb" src={u} alt="" loading="lazy" /> : '–'}</td>
            <td>{dash(h.cnn_label)} <span className="mute">{h.cnn_confidence != null ? h.cnn_confidence + '%' : ''}</span></td>
            <td>{dash(h.cnn_symptom_score)}</td><td>{dash(h.input_suhu)}</td><td>{dash(h.input_kelembapan_udara)}</td><td>{dash(h.input_kelembapan)}</td>
            <td>{h.dosis_ml ?? 0} ml <span className="mute">(rek. {dash(h.dosis_rekomendasi_ml)})</span></td>
            <td>{h.durasi_pompa_detik ?? 0} s</td><td>{h.pump_command === 'ON' ? 'ON' : 'OFF'}</td>
            <td><span className="pill" style={{ background: COLOR[lv] }}>{lv}</span></td>
            <td className="mute">{dash(h.status_mitigasi)}</td>
          </tr>); })}
      </tbody></table></div></div>
  );
}

export function Foto({ hist }) {
  const seen = new Set();
  const items = [...hist].reverse().filter((h) => h.foto_sumber && !seen.has(h.foto_sumber) && seen.add(h.foto_sumber));
  return (
    <div className="gallery">
      {items.length === 0 && <div className="mute">Belum ada foto.</div>}
      {items.map((h) => (
        <div className="card nopad" key={h.foto_sumber}>
          <img className="photo" src={photoUrl(h.foto_sumber)} alt={h.cnn_label} loading="lazy" />
          <div className="pad sm"><b>{dash(h.cnn_label)}</b> <span className="mute">{h.cnn_confidence != null ? h.cnn_confidence + '%' : ''}</span>
            <div className="mute">{dash(h.last_updated)}</div></div>
        </div>))}
    </div>
  );
}

export function Perangkat({ mon }) {
  const f = mon?.fuzzy_output || {}, S = f.sumber_sensor || {}, A = mon?.ack || {}, C = mon?.command || {};
  const rows = [
    ['Mode keputusan', f.mode_keputusan], ['Status IoT', f.status_iot],
    ['Sumber suhu / RH / tanah', [S.temperature, S.humidity, S.soil_moisture].map(dash).join(' / ')],
    ['Tanah valid', mon?.soil_valid ? 'Ya' : 'Tidak'], ['Nilai mentah tanah', mon?.soil_raw],
    ['Uptime', mon?.uptime_ms ? Math.round(mon.uptime_ms / 60000) + ' menit' : null],
    ['Pompa terakhir', mon?.last_pump_epoch ? new Date(mon.last_pump_epoch * 1000).toLocaleString('id-ID') : null],
    ['Perintah terakhir', C.dosis_ml != null ? `${C.dosis_ml} ml, ${C.durasi_detik} dtk` : null],
    ['Konfirmasi (ACK)', A.status ? `${A.status} (${((A.durasi_aktual_ms || 0) / 1000).toFixed(1)} dtk)` : null],
    ['Update fuzzy', f.last_updated],
  ];
  return (
    <div className="card"><dl className="kv">{rows.map(([k, v]) => <div key={k}><dt className="mute">{k}</dt><dd>{dash(v)}</dd></div>)}</dl></div>
  );
}
