---
name: scope-reticle-calibration
description: >-
  Calibrate scope FOV, reticle optical centre, rotation, and hold-over so dial
  clicks match mil hashes on glass. Use when tuning reticles, FOV at max zoom,
  opticalCenter, imageRotationDeg, RETICLE_SUBTENSION_CAL, or when the user
  asks to calibrate Kahles, Nightforce, S&B, Vortex, Element, or ZCO scopes.
---

# Scope / reticle calibration

Repeat the **ZCO 5-27 MPCT3X** process for every premium reticle. Shared optic
pipeline is already in place; per-scope work is asset + FOV fine-tune only.

## Admin sandbox

**Admin Office → Scopes** (`AdminScopeTestPanel`): free catalog scope pick,
skyteskive *or* bird sprite, distance 10–1500 m (1 m steps), power ring, drag
to pan. Reticle uses `opticReticleImgScale` (zoom only). Skive paper uses
`zeroingTargetAndReticleScale` like ShootingRange. At fixed zoom the MPCT3X
tree must look identical on CBA and any bird. Button «= Range 100 m» resets
CBA / 100 m / max zoom.

## Shared contracts (do not break)

| Concern | Rule | Where |
|--------|------|--------|
| Dial click | 1 klikk = 0.1 mil = 10 mm @ 100 m | `ZERO_CLICK_MM` in `player.ts` |
| Reticle size | FFP ∝ optic zoom only (100 m ref) — not subject/distance | `opticReticleImgScale` |
| Paper / bird | Distance + true-angular ×0.1 (skive); hunt bird FOV separate | `zeroingTargetAndReticleScale` / `birdScopeImageScale` |
| FFP asset map | `centerTo1MilPx` → 1 mil (MRAD) or 1 MOA (MOA scopes) via diamond tip × 29.4/100 | `ffpReticleImageScale` |
| Global subtension | Keep `RETICLE_SUBTENSION_CAL = 1` | `precision.ts` |
| Premium FOV | +15 % circle diameter | `SCOPE_FOV_DIAMETER_PREMIUM` / catalog |

True-angular paper: `RANGE_TRUE_ANGULAR_TARGET_SCALE = 0.1` on zeroing lane
(so 1 mil on zoom-only reticle ≈ 100 mm on paper @ 100 m).

## Reference: ZCO (done)

Reticle id `mpct3x` · asset `zco527b.png` · scope `scope-zco-527-mct`

| Knob | Value | Meaning |
|------|-------|---------|
| `centerTo1MilPx` | `55.5` | Native px centre → 1.0 mil hash |
| `opticalCenterX/Y` | `909.724` / `894.6925` | −10.32 klikk X, +5.35 klikk Y from geometric guess |
| `imageRotationDeg` | `0.02` | CW, around optical centre |
| FOV at 27× | ±7.2 mrad (real ZCO) | `SCOPE_FOV_CAL_HALF_MRAD` + design viewport |
| Felt mag @ 27× | ×`SCOPE_ZOOM_MAG_CAL` (=1) | shared image scale + hunt birds |

Global FOV constants in `precision.ts` were locked against ZCO max power. Other
scopes share that world scale; only change globals if the *shared* FOV is wrong.

## Per-scope checklist

Do these in order on the **100 m zeroing range**, calm rifle, max zoom.

### 1. Asset + subtension

1. Put PNG in `public/range/reticles/`.
2. Measure `centerTo1MilPx` (centre → first major 1 mil / 1 MOA hash).
3. Add/update `RETICLES[id]` in `src/lib/range/reticles.ts`.
4. Wire `reticleId` (+ `fovDiameterScale` if premium) in `catalog.ts`.

### 2. Optical centre (POA)

Floating dot / crosshair must sit on scope centre.

- User: “N klikk høyre/venstre, M klikk opp/ned”.
- 1 klikk = `0.1 * centerTo1MilPx` native px.
- **Høyre** → decrease `opticalCenterX`; **venstre** → increase.
- **Opp** → increase `opticalCenterY`; **ned** → decrease
  (CSS +Y down; margins pin optical pixel to POA).
- Optional skew: `imageRotationDeg` (positive = CW) via `ScopeReticle`.

### 3. FOV at engraved max zoom

1. Admin → Scopes → **Calibrate max zoom** (forces engraved max; orange mil
   rings to glass edge). Wanted half-FOV for ZCO: ±7.2 mrad @ 27×.
2. Adjust `zoomMagCal` until rings / reticle mil-count match the wanted FOV
   (narrower FOV → larger `zoomMagCal`). Save with **Lagre FOV til repo**
   (`catalog.ts`).
3. Prefer per-scope `zoomMagCal` over retuning global
   `SCOPE_FOV_CAL_HALF_MRAD` / `SCOPE_IMAGE_SCALE_PER_ZOOM`.

### 4. Hold-over / hashmarks (dial vs hash)

1. Admin → Scopes → **Calibrate reticle hashmarks** (cyan mil rings on
   reticle). Tune `centerTo1MilPx` until rings sit on the hashes; include in
   **Lagre til repo** (`reticles.ts`).
2. Dial a known elev (e.g. 45 klikk = 4.5 mil).
3. POI must land on the matching reticle hash (4.5 mil / 45-klikksmerke).
4. If dial D lands on hash H (in klikk-equivalent):
   - Reticle too **large** (H < D): prefer fixing `centerTo1MilPx` first.
   - Reticle too **small** (H > D): increase `centerTo1MilPx`.
5. **Do not** reintroduce a global `RETICLE_SUBTENSION_CAL ≠ 1` unless every
   scope needs the same fudge; prefer per-reticle `centerTo1MilPx`.

### 5. Sign off

Note calibrated values in the `ReticleDef` comment block (same style as ZCO).

## Remaining reticles

| Reticle id | Typical scopes | Status |
|------------|----------------|--------|
| `mpct3x` | ZCO 5-27 | **Calibrated** |
| `kahles` | K318i / K525i / K624i / K16i | TODO |
| `nightforce-mil-r` | NX8 / ATACR MRAD | TODO |
| `nf_moa` | NX8 MOA | TODO (MOA paper) |
| `sb` | S&B PM II | TODO |
| (Vortex / Element / …) | may share generic or need assets | TODO |

## Files

- `src/lib/range/reticles.ts` — defs, optical centre, rotation, `centerTo1MilPx`
- `src/lib/range/precision.ts` — FOV scale, true-angular paper, `RETICLE_SUBTENSION_CAL`
- `src/components/range/ScopeReticle.tsx` — render + rotate about optical centre
- `src/lib/optics/spec.ts` / `src/lib/shop/catalog.ts` — premium FOV + `zoomMagCal`
- `src/components/town/AdminScopeTestPanel.tsx` — live cal UI (rot / centre /
  max zoom / hashmarks)
- `src/app/api/admin/reticle-cal` · `scope-fov-cal` — bake to repo (dev)
- Call sites: `ShootingRange`, `HuntShootView`, Field Impact, MoaComp
