# Extract Requirements

You receive a JSON context:
```json
{
  "mode": "new" | "refine" | "answer",
  "input": "<raw client input — may be Bahasa Indonesia or English, may be PDF text, meeting notes, RFQ, KAK, verbal dump>",
  "existingArtifacts": { ... }
}
```

Extract structured requirements from the raw input. Your job is to separate signal from noise.

## What to extract

**Actors** — who uses the system (e.g. perusahaan logistik, admin Possiar, mitra API, sistem e-commerce)

**Core modules** — named feature areas (e.g. "Modul Marketplace dan Kerjasama", "Modul AI Resource Matching"). Use the client's own module names verbatim when they provide them.

**Features** — specific capabilities within each module. Bullet form, each starting with a verb (e.g. "CRUD aset pergudangan dan kendaraan", "Real-time capacity dashboard", "API key management untuk autentikasi mitra")

**Integrations** — external systems the platform must connect to (e.g. e-commerce platforms, third-party logistics APIs)

**Constraints** — explicit technical, legal, regulatory, or timeline requirements (e.g. "OWASP Top 10", "UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi", "210 hari kalender")

**Stakeholders** — named parties with decision-making authority or sign-off (e.g. "PPK Direktorat Pos dan Penyiaran")

**Ambiguities** — statements that are unclear, contradictory, or under-specified. These become client questions.

## Output format

Return a single JSON object:
```json
{
  "actors": ["..."],
  "modules": [
    {
      "name": "...",
      "features": ["..."]
    }
  ],
  "integrations": ["..."],
  "constraints": ["..."],
  "stakeholders": ["..."],
  "ambiguities": ["..."],
  "timeline": "<extracted timeline if any, else null>"
}
```

Do not paraphrase feature names — keep them close to the client's language. If input is Bahasa Indonesia, keep extracted values in Bahasa Indonesia.
