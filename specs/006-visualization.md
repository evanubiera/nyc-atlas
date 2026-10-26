# 006 — Visualization Specification

## Form selection

Each view's chart type follows from the data's job, not from preference.

| View | Data job | Form |
|---|---|---|
| Main map | Magnitude over geography | Sequential choropleth, 3D-extruded |
| Institution layer | Identity + position | Point/column layer, categorical by scope |
| Incident density | Magnitude over position at high zoom | Hexbin aggregation |
| Exposure vs outcome | Correlation between two measures | Scatter, NTA-level |
| Quintile comparison | Magnitude across ordered groups | Horizontal bar with CI whiskers |
| Residual map | **Polarity** — more/less crime than predicted | Diverging choropleth |
| Neighborhood detail | A few headline values | Stat tiles, not charts |
| Category composition | Part-to-whole over one neighborhood | Stacked bar, single row |
| Access gaps | Two groups compared, per measure | **Dumbbell, one per measure** |
| Every neighborhood | Identity + many measures at once | **Table** |

The neighborhood detail panel deliberately uses **stat tiles rather than charts**. Four
numbers for one neighborhood — population, rate, CI, institution count — is not chart
data; a bar chart of four unrelated quantities would be decoration.

### The access-gap panel is small multiples, not one chart

Five measures, two groups each. The measures share no unit — dollars, stores per
10,000 residents, a share of students — so **each row is its own chart with its own
scale**, and both ends carry a direct value label. Putting income and supermarket
density on one axis would be the dual-axis error wearing a different shape: the
alignment would be arbitrary and would manufacture a comparison the data does not
contain.

Each row is normalised to its own maximum, which means bar *length* is only ever
comparable within a row. That is acceptable precisely because the labels are
always present; the geometry carries the direction and the size of the gap, the
labels carry the quantity.

The gap headline is phrased from `higherIsBetter`, not from the sign of the
ratio. "0.72×" is an improvement for poverty and a deficit for income, and a
reader should not have to work out which.

### The table is a first-class view, not a fallback

`NeighborhoodTable` is both the per-neighborhood detail view and the **table-view
twin** that 006's accessibility section requires of every chart. Every value the
choropleth and the gap panel encode in color or position is legible there as a
number, sortable, for all 197 neighborhoods.

Its institution cell is a disclosure: the count expands in place to the full list
of institutions in that neighborhood, with each venue's discipline or facility
type. The count alone answers "how many"; the expansion answers "which", which is
the question a reader actually has about their own neighborhood. The disclosure
triangle is drawn with borders rather than set as a glyph — at 8px a text
triangle renders as an indeterminate smudge and reads as a stray dot beside the
number.

## Color

### Choropleth (outcome magnitude) — sequential blue

Single hue, light→dark, from the validated ramp:

```
100 #cde2fb · 150 #b7d3f6 · 200 #9ec5f4 · 250 #86b6ef · 300 #6da7ec
350 #5598e7 · 400 #3987e5 · 450 #2a78d6 · 500 #256abf · 550 #1c5cab
600 #184f95 · 650 #104281 · 700 #0d366b
```

**Blue, not red.** This is both the system default for sequential magnitude and the
right call for this subject: a red "heat map" of violence over neighborhoods where
people live reads as a threat map and invites exactly the moral reading
[007-methodology.md](007-methodology.md) §9 prohibits. Blue encodes magnitude without
encoding judgment.

Breaks are **quantile-based on the smoothed rate**, computed server-side
(`MetricsResult.scale`) so map, legend and scatter cannot drift apart.

### Residual map — diverging blue ↔ red, gray midpoint

For "observed minus predicted after confounder adjustment," polarity is the data's job,
so a diverging scale is correct: blue = fewer incidents than the confounder model
predicts, red = more, neutral gray (`#f0efec` light / `#383835` dark) at zero. Equal
step count per arm; **no hue at the midpoint**.

### Access-gap dumbbell — one hue, two shades

A paired before/after comparison takes **one hue in two shades**, not two
categorical hues: the two ends are one ordered measure, not two identities, and
spending a categorical slot on them would be a category error as well as a waste.

Each mode's steps are chosen against that mode's surface rather than flipped, and
validated as an ordinal ramp:

| Mode | Least-served | Best-served | Light-end contrast | Result |
|---|---|---|---|---|
| light | `#5598e7` | `#104281` | 2.91:1 | PASS |
| dark | `#3987e5` | `#cde2fb` | 4.79:1 | PASS |

`#9ec5f4` was the first choice for the light-mode low end and **failed** at
1.74:1 against the light surface, below the 2:1 ordinal floor. It was snapped to
the next step down the ramp rather than kept and excused.

Both ends carry direct value labels regardless, so the shade never has to carry
the number alone.

### Categorical — fixed order, capped at 3

Choropleth and scatter are all-pairs forms, so the series cap is three. Validated with
`scripts/validate_palette.js --pairs all` in both modes:

| Slot | Light | Dark |
|---|---|---|
| 1 | `#2a78d6` | `#3987e5` |
| 2 | `#eb6834` | `#d95926` |
| 3 | `#1baf7a` | `#199e70` |

Measured: light — CVD ΔE 9.2 worst all-pairs, normal-vision 24.0; dark — CVD ΔE 9.4,
normal-vision 20.9. All gates pass.

**Relief rule in force:** light-mode slot 3 (`#1baf7a`) measures 2.74:1 against the
light surface, below 3:1. Wherever it appears, visible direct labels or the table view
are mandatory — it may not carry meaning by hue alone.

A fourth institution category folds into "Other" or becomes a small multiple. Hues are
assigned per entity and never cycled; a borough filter that drops series must not
repaint the survivors.

### Surfaces and ink

| Role | Light | Dark |
|---|---|---|
| Chart surface | `#fcfcfb` | `#1a1a19` |
| Page plane | `#f9f9f7` | `#0d0d0d` |
| Primary ink | `#0b0b0b` | `#f0efec` |
| Secondary ink | `#52514e` | `#c3c2b7` |
| Muted (axis/labels) | `#898781` | `#898781` |
| Gridline | `#e1e0d9` | `#2c2c2a` |
| Baseline / axis | `#c3c2b7` | `#383835` |

Dark mode is **selected, not flipped** — its own steps from the same ramps, validated
against the dark surface. Declared under both `@media (prefers-color-scheme: dark)`
(guarded with `:not([data-theme="light"])`) and `[data-theme="dark"]`.

Text always wears text tokens, never the series color.

## deck.gl layers

Render order bottom→top. One `DeckGL` instance over a MapLibre basemap.

### 1. `GeoJsonLayer` — NTA choropleth (base)
```
id: 'nta-choropleth'
extruded: true
getElevation: d => smoothedRatePer100k * elevationScale   // 0 when excluded
getFillColor: quantile scale over smoothedRatePer100k
getLineColor: gridline token
lineWidthMinPixels: 0.5
pickable: true
material: { ambient: 0.35, diffuse: 0.6, shininess: 32 }
```
Excluded NTAs render at zero elevation with a diagonal texture fill, not absent —
FR-4.4. `updateTriggers` keyed on the filter signature.

### 2. `ScatterplotLayer` / `ColumnLayer` — institutions
Scatterplot below z12, columns at z12+ (3D presence reads better close in). Radius is
constant — **institution size is not encoded**, because the source data has no reliable
capacity or attendance figure and a varying radius would imply one. Minimum 8px markers.

### 3. `HexagonLayer` — incident density (optional, z13+)
Raw points only inside the viewport bbox, hard-capped at 10,000 rows (005). Sequential
blue ramp, same hue as the choropleth, so the two read as one system.

### 4. `TextLayer` — neighborhood labels at z12+
Primary ink with a 2px surface halo for legibility over any fill.

## Interaction

Per the interaction rules, hover is shipped by default — this is an interactive
surface, not a static image.

- **Hover NTA:** tooltip with name, population, raw rate, CI, smoothed rate,
  institution count, and any `denominatorWarning`. Both raw and smoothed are shown; the
  tooltip is where honesty about the smoothing lives.
- **Hover institution:** name, source (DCLA/FacDB), discipline/type, address
- **Click NTA:** detail panel; map does not recenter (destroys spatial context)
- **Hit targets exceed the mark** — institution points get a 12px pick radius
- **Filters sit in one row above the map**, not in a drawer: they are the primary
  control surface and hiding them hides the fact that the view is filtered
- Enforcement-driven categories (DRUGS/DISORDER/TRAFFIC/ADMINISTRATIVE) show a
  persistent inline caveat whenever selected, sourced from `MetricsResult.caveats`

## Marks and anatomy

- 2px lines, ≥8px markers, thin bars with 4px rounded data-ends anchored to the baseline
- 2px surface gap between adjacent/stacked fills; 2px surface ring on overlapping marks
- Selective direct labels — never a number on every point. Scatter labels the extremes
  and the hovered point only
- Recessive grid and axes; CIs as whiskers with 1px caps
- Legend present for ≥2 series; ≤4 series also direct-labeled

## Accessibility

- A **table view** exists for every chart — `NeighborhoodTable` is the standing one,
  always visible rather than behind a toggle. Also the relief mechanism for the
  sub-3:1 light aqua slot
- The institution disclosure is a real `button` carrying `aria-expanded` and
  `aria-controls`; sortable headers carry `aria-sort`. Its hit target clears 24px
  on a dense row
- Texture fill (45° / 135° hand-drawn lines) available for CVD, print and
  `forced-colors`; ordered by magnitude on value scales. Never on by default
- Keyboard: NTAs traversable in a defined order with arrow keys; Enter opens the
  detail panel; all filters reachable by tab
- Never red/green as the sole encoding (NFR-9); the diverging scale pairs with
  a sign in the tooltip and a labeled legend
- `prefers-reduced-motion` disables camera animation and extrusion transitions
- Screen-reader summary per view: a sentence stating the measure, period, geography
  and the association caveat

## Explicitly rejected

- **Dual-axis charts** — never. Crime rate and institution count on one plot with two
  y-scales is the single most common charting error and manufactures correlation out of
  independent scale choices. Two measures → scatter or two charts.
- **Rainbow / viridis-style multi-hue sequential** on the choropleth.
- **3D pie or donut** anywhere.
- **Elevation bound to raw (unsmoothed) rate** — a single shooting in a small-population
  NTA would produce a spike that is a denominator artifact (007 §7).
- **Red-dominant "crime heat map"** — see Color above.
