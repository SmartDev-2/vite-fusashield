"""Fuzzy 3 input (tanpa pH): kelembapan tanah, suhu, gejala CNN. MIN=AND, MAX=agregasi, weighted average singleton."""
SETS = {
    "moist": {"kering": (0, 0, 35, 50), "lembap": (35, 50, 70, 80), "basah": (70, 80, 100, 100)},
    "temp":  {"dingin": (0, 0, 22, 26), "optimal": (22, 26, 30, 33), "panas": (30, 33, 50, 50)},
    "sym":   {"ringan": (0, 0, 20, 40), "sedang": (20, 40, 60, 70), "berat": (60, 70, 100, 100)},
}
SINGLETON = {"aman": 0, "preventif": 25, "waspada": 55, "kritis": 90}
# (kelembapan, suhu atau None, gejala, output)
RULES = [
    ("basah", "panas", "berat", "kritis"), ("basah", "optimal", "berat", "kritis"),
    ("lembap", "panas", "berat", "kritis"), ("lembap", "optimal", "berat", "kritis"),
    ("basah", "dingin", "berat", "waspada"), ("lembap", "dingin", "berat", "waspada"),
    ("kering", None, "berat", "waspada"),
    ("basah", "panas", "sedang", "kritis"), ("basah", "optimal", "sedang", "waspada"),
    ("lembap", None, "sedang", "waspada"), ("basah", "dingin", "sedang", "preventif"),
    ("kering", None, "sedang", "preventif"),
    ("basah", "panas", "ringan", "preventif"), ("basah", "optimal", "ringan", "preventif"),
    ("basah", "dingin", "ringan", "aman"), ("lembap", None, "ringan", "aman"),
    ("kering", None, "ringan", "aman"),
]
DOSE_ML = {"aman": 0, "preventif": 20, "waspada": 50, "kritis": 100}


def symptom_score(p_healthy: float, p_nutrition: float) -> float:
    return max(0.0, min(100.0, (1.0 - p_healthy) * 60.0 + p_nutrition * 40.0))


def _mu(x, p):
    a, b, c, d = p
    if b <= x <= c:
        return 1.0
    if x < a or x > d:
        return 0.0
    return (x - a) / (b - a) if x < b else (d - x) / (d - c)


def _fuzzify(var, x):
    return {k: _mu(x, p) for k, p in SETS[var].items()}


def infer(moist: float, temp: float, sym: float) -> dict:
    m, t, s = _fuzzify("moist", moist), _fuzzify("temp", temp), _fuzzify("sym", sym)
    agg = {k: 0.0 for k in SINGLETON}
    for rm, rt, rs, out in RULES:
        w = min(m[rm], t[rt] if rt else 1.0, s[rs])
        agg[out] = max(agg[out], w)
    den = sum(agg.values())
    score = sum(agg[k] * SINGLETON[k] for k in agg) / den if den else 0.0
    level = "kritis" if score >= 70 else "waspada" if score >= 35 else "preventif" if score >= 10 else "aman"
    return {"score": round(score, 2), "level": level, "dose_ml": DOSE_ML[level]}
