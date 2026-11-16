/**
 * POST /api/chat
 * FusaBot – Live Telemetry-Aware Chatbot + XAI Interactive
 *
 * Body JSON:
 *   {
 *     "message": "pertanyaan petani",
 *     "history": [          // opsional, max 10 giliran terakhir
 *       { "role": "user",      "content": "..." },
 *       { "role": "assistant", "content": "..." }
 *     ]
 *   }
 *
 * Response JSON:
 *   {
 *     "reply": "...",
 *     "context_snapshot": { sensors, decision }   // snapshot data yang dipakai
 *   }
 */

import { DEVICE, callGroq, fbGet, handle, json, limit, preflight } from '../server/lib.js';

export const OPTIONS = preflight;

// Batas: 20 pesan per 60 detik (per instance Vercel)
const RATE_KEY = 'chat:mobile';

// ----- Helper: rakit system prompt dari data Firebase -----
function buildSystemPrompt(mon) {
  const f = mon?.fuzzy_output || {};
  const hasSensors = Boolean(mon && (mon.temperature != null || mon.humidity != null || mon.soil_moisture != null || mon.soil_raw != null));
  const hasFuzzy = Boolean(mon?.fuzzy_output && Object.keys(mon.fuzzy_output).length > 0);
  const hasIot = Boolean(hasSensors || hasFuzzy || mon?.pump_status != null);

  if (!hasIot) {
    return `Anda adalah FusaBot — asisten agronomi presisi FusaShield untuk budidaya cabai organik dengan Trichoderma harzianum sebagai agen hayati melawan Fusarium oxysporum.

STATUS SISTEM REALTIME:
⚠️ PERINGATAN KRUSIAL: TIDAK ADA DATA SENSOR IOT DARI ESP32 MAUPUN KEPUTUSAN FUZZY DI FIREBASE SAAT INI.
- Data suhu, kelembapan udara, kelembapan tanah, dan pompa ESP32: BELUM TERSEDIA (belum ada data masuk).
- Data klasifikasi daun CNN dan dosis rekomendasi: BELUM TERSEDIA.

ATURAN WAJIB (JANGAN PERNAH DILANGGAR):
1. JANGAN PERNAH MENAMPILKAN, MENGARANG, ATAU MENGGUNAKAN DATA DUMMY / SIMULASI / ANGKA FIKTIF (misal suhu 31°C, kelembapan 70%, dosis 25ml, dsb).
2. Jika pengguna menanyakan kondisi sensor saat ini, status tanaman, dosis penyiraman, atau pompa, TEGASKAN SECARA JUJUR bahwa saat ini BELUM ADA data sensor yang masuk dari perangkat IoT (ESP32) di Firebase.
3. Sarankan pengguna untuk memeriksa apakah perangkat ESP32 sudah menyala dan terhubung ke Firebase.
4. Anda tetap dapat menjawab pertanyaan umum edukatif seputar budidaya cabai, pencegahan jamur Fusarium oxysporum, dan peran Trichoderma harzianum, tanpa mengaitkannya dengan data sensor fiktif.
5. Jawab dalam Bahasa Indonesia yang ramah, ringkas (maks 3 paragraf), dan mudah dipahami.`;
  }

  const sen = {
    suhu       : mon?.temperature   ?? 'Belum ada data',
    kelembapan : mon?.humidity      ?? 'Belum ada data',
    tanah      : (mon?.soil_valid ? mon?.soil_moisture : (mon?.soil_moisture ?? f.input_kelembapan)) ?? 'Belum ada data',
    pompa      : mon?.pump_status   ?? 'Belum ada data',
    hst        : f.hst              ?? '–',
  };
  const dec = {
    cnn_label       : f.cnn_label               ?? 'Belum dianalisis',
    cnn_conf        : f.cnn_confidence           ?? null,
    gejala          : f.cnn_symptom_score        ?? null,
    fase            : f.fase_hst                 ?? '–',
    dosis           : f.dosis_rekomendasi_ml     ?? null,
    tingkat         : f.tingkat_dosis            ?? 'Belum dianalisis',
    mitigasi        : f.status_mitigasi          ?? 'Belum dianalisis',
    cooldown        : f.sisa_cooldown_detik      ?? 0,
    llm_advisory    : f.llm_advisory             ?? null,
    alasan_blokir   : f.alasan_blokir            ?? null,
  };

  // Peringatan kelembapan tinggi (risiko Fusarium)
  const kelNum = parseFloat(sen.kelembapan);
  const kelWarning = !isNaN(kelNum) && kelNum > 75
    ? `⚠️ KELEMBAPAN TINGGI (${kelNum}% > 75%) – kondisi SANGAT KONDUSIF penyebaran Fusarium!`
    : '';

  const cooldownInfo = Number(dec.cooldown) > 0
    ? `Pompa masih cooldown ${dec.cooldown} detik`
    : (mon?.pump_status ? 'Pompa siap diaktifkan' : 'Status pompa belum diketahui');

  const advisoryBlock = dec.llm_advisory
    ? `\n ADVISORY TERAKHIR DARI SISTEM:\n"${dec.llm_advisory.slice(0, 300)}"\n`
    : '';

  const blokirBlock = dec.alasan_blokir
    ? `\n ALASAN BLOKIR TERAKHIR: ${dec.alasan_blokir}\n`
    : '';

  return `Anda adalah FusaBot — asisten agronomi presisi FusaShield untuk budidaya cabai organik dengan Trichoderma harzianum sebagai agen hayati melawan Fusarium oxysporum.

📡 DATA SENSOR LAPANGAN SAAT INI (REALTIME dari ESP32):
  Suhu Udara        : ${sen.suhu}${sen.suhu !== 'Belum ada data' ? '°C' : ''}
  Kelembapan Udara  : ${sen.kelembapan}${sen.kelembapan !== 'Belum ada data' ? '%RH' : ''}  ${kelWarning}
  Kelembapan Tanah  : ${sen.tanah}${sen.tanah !== 'Belum ada data' ? '%' : ''}
  Status Pompa      : ${sen.pompa}
  HST Tanaman       : ${sen.hst} hari
${advisoryBlock}${blokirBlock}
🧠 HASIL ANALISIS AI TERBARU:
  CNN Klasifikasi   : ${dec.cnn_label}${dec.cnn_conf != null ? ` (akurasi ${dec.cnn_conf}%)` : ''}
  Skor Gejala       : ${dec.gejala != null ? `${dec.gejala}%` : 'Belum dihitung'}
  Fase Pertumbuhan  : ${dec.fase}
  Fuzzy Decision    : ${dec.tingkat}${dec.dosis != null ? ` → Dosis Rekomendasi ${dec.dosis} ml` : ''}
  Status Mitigasi   : ${dec.mitigasi}
  Cooldown Pompa    : ${cooldownInfo}

PANDUAN PERAN ANDA:
1. Jawab pertanyaan petani berdasarkan DATA SENSOR dan ANALISIS AI di atas. Jika data bertuliskan 'Belum ada data' atau 'Belum dianalisis', sampaikan apa adanya dan JANGAN mengarang angka.
2. Jika ditanya "kenapa" sebuah keputusan diambil — jelaskan logika CNN (deteksi visual) dan Fuzzy Logic (keputusan dosis) secara sederhana dan mudah dipahami petani awam.
3. Gunakan analogi sehari-hari saat menjelaskan AI (mis. "seperti dokter yang melihat foto, lalu membuat resep").
4. Jangan merekomendasikan fungisida kimia tanpa memperingatkan dampaknya terhadap Trichoderma.
5. Jika sensor menunjukkan kondisi berisiko, proaktif ingatkan petani tanpa menakut-nakuti.
6. Jawab dalam Bahasa Indonesia yang ramah, singkat (maks 3 paragraf), dan mudah dipahami.
7. JANGAN mengarang data sensor atau menampilkan data dummy — hanya gunakan fakta yang tercantum di atas.`;
}

// ----- Endpoint utama -----
export async function POST(request) {
  return handle(async () => {
    limit(RATE_KEY, 20, 60_000);

    // Parse body
    let body;
    try { body = await request.json(); }
    catch { throw { status: 400, message: 'Body harus JSON' }; }

    const userMessage = (body?.message ?? '').trim();
    if (!userMessage) throw { status: 400, message: 'Field "message" wajib diisi' };

    // Ambil snapshot data Firebase
    let mon = {};
    try {
      mon = (await fbGet(`monitoring/${DEVICE()}`)) || {};
    } catch (e) {
      console.warn('[chat] Gagal ambil Firebase, lanjut tanpa konteks sensor:', e.message);
    }

    // Siapkan history percakapan (maks 10 giliran terakhir = 20 pesan)
    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    const history = rawHistory
      .filter((m) => m?.role && m?.content)
      .slice(-20)
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 2000) }));

    // Rakit pesan ke Groq
    const messages = [
      { role: 'system', content: buildSystemPrompt(mon) },
      ...history,
      { role: 'user', content: userMessage.slice(0, 1000) },
    ];

    // Panggil Groq (menggunakan API key dari .env)
    const reply = await callGroq(messages, { maxTokens: 768, temperature: 0.65 });

    // Snapshot konteks yang dipakai (untuk debug/transparansi)
    const f = mon?.fuzzy_output || {};
    const context_snapshot = {
      sensors: {
        temperature  : mon?.temperature   ?? null,
        humidity     : mon?.humidity      ?? null,
        soil_moisture: mon?.soil_moisture ?? null,
        pump_status  : mon?.pump_status   ?? null,
      },
      decision: {
        cnn_label           : f.cnn_label            ?? null,
        cnn_confidence      : f.cnn_confidence       ?? null,
        tingkat_dosis       : f.tingkat_dosis        ?? null,
        dosis_rekomendasi_ml: f.dosis_rekomendasi_ml ?? null,
        status_mitigasi     : f.status_mitigasi      ?? null,
        fase_hst            : f.fase_hst             ?? null,
        sisa_cooldown_detik : f.sisa_cooldown_detik  ?? null,
        hst                 : f.hst                  ?? null,
      },
    };

    return json({ reply, context_snapshot });
  });
}
