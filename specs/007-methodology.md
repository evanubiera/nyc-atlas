# 007 — Methodology, Confounders and Validity

This document exists so that the application's claims stay defensible. A map that
shows cultural institutions in green and crime in red, and lets the viewer draw their
own conclusion, is not neutral — it implies a causal story while taking no
responsibility for it. The requirements in this document are as binding as the
functional ones.

## 1. What can and cannot be claimed

**Supportable:** "Across NYC's 197 residential NTAs, neighborhoods in the lowest
quintile of cultural institution density per capita had a shooting rate of X per
100,000 residents, compared with Y in the highest quintile. After adjusting for median
household income, poverty rate, population density and the share of residents aged
15–24, the difference narrows to Z."

**Not supportable:** "Cultural institutions reduce crime." / "Building a library in
Brownsville would lower shootings by N%." / "The absence of cultural investment causes
violence."

The UI must not render the second category, in copy, chart titles, or legend labels.
Any phrasing in the interface uses associative verbs — *co-varies with*, *is associated
with*, *differs between* — never *causes*, *reduces*, *drives*, or *leads to*.

## 2. Unit of analysis

**NTA2020, filtered to `ntatype = '0'` → 197 residential neighborhoods.**

Why NTA rather than the alternatives:

| Geography | n | Why not |
|---|---|---|
| Census tract | ~2,300 | ACS 5-year margins of error at tract level are often ±30% or worse for income and poverty — too noisy for a ratio |
| **NTA2020** | **197** | Designed by DCP for exactly this: large enough for reliable ACS estimates, small enough to be a recognizable neighborhood |
| Community District | 59 | Too coarse; averages away the variation of interest |
| Police precinct | 77 | Defined for police operations, not communities; a confounder-shaped unit for a crime outcome |

NTAs are aggregates of whole census tracts, so the crosswalk is exact and the ACS
aggregation is clean.

## 3. Outcome measures, ranked by trustworthiness

**Primary: shooting incidents** (`5ucz-vwe8`, 24,310 records, 2006–present).

Shootings are the most robust violence measure available because they are the least
dependent on a victim's willingness to call the police. A gunshot wound produces a
hospital record and a police response more or less regardless of community trust in
the NYPD. For a project specifically concerned with marginalized neighborhoods — where
trust in police is lowest and therefore under-reporting is highest — this matters
enormously.

**Secondary: complaint data by category** (`5uac-w243`, `qgea-i56i`), with reporting
bias stated at the point of display.

**Reporting bias is not noise — it is correlated with the exposure of interest.**
Neighborhoods with less cultural and civic investment also tend to have lower
institutional trust and lower reporting rates. Using complaint counts as the outcome
can therefore *understate* crime precisely where the hypothesis predicts it is highest,
biasing the association toward zero or even reversing its sign. This is the single most
important methodological hazard in the project.

### Crime category mapping

All 55 `ofns_desc` values map to analysis categories via an explicit lookup table. The
build fails on an unmapped value, so new offense labels cannot silently fall through.

| Category | Includes |
|---|---|
| `VIOLENT_PERSON` | MURDER & NON-NEGL. MANSLAUGHTER, RAPE, FELONY ASSAULT, ASSAULT 3 & RELATED OFFENSES, SEX CRIMES, OFFENSES AGAINST THE PERSON, KIDNAPPING |
| `VIOLENT_PROPERTY` | ROBBERY, BURGLARY |
| `PROPERTY` | PETIT LARCENY, GRAND LARCENY, GRAND LARCENY OF MOTOR VEHICLE, OTHER OFFENSES RELATED TO THEFT, CRIMINAL MISCHIEF & RELATED OF, ARSON, POSSESSION OF STOLEN PROPERTY |
| `FRAUD` | FORGERY, FRAUDS, THEFT-FRAUD, OFFENSES INVOLVING FRAUD, THEFT OF SERVICES |
| `WEAPONS` | DANGEROUS WEAPONS |
| `DRUGS` | DANGEROUS DRUGS, CANNABIS RELATED OFFENSES |
| `DISORDER` | OFF. AGNST PUB ORD SENSBLTY &, CRIMINAL TRESPASS, HARRASSMENT 2, DISORDERLY CONDUCT, ALCOHOLIC BEVERAGE CONTROL LAW, LOITERING |
| `TRAFFIC` | VEHICLE AND TRAFFIC LAWS, INTOXICATED & IMPAIRED DRIVING |
| `ADMINISTRATIVE` | ADMINISTRATIVE CODE, MISCELLANEOUS PENAL LAW, OFFENSES AGAINST PUBLIC ADMINI, OTHER STATE LAWS |
| `UNKNOWN` | null / unmapped — surfaced, never dropped |

`DRUGS`, `DISORDER`, `TRAFFIC` and `ADMINISTRATIVE` are **enforcement-driven**: their
counts reflect police deployment at least as much as underlying behaviour. They are
excluded from the default view and labelled as enforcement measures where shown. A
neighborhood with many drug arrests is a neighborhood with heavy drug policing.

## 4. Exposure measures

Three operationalizations of "cultural institution presence," user-selectable:

1. **Density** — institutions per square kilometre of NTA land area
2. **Per capita** — institutions per 10,000 residents
3. **Access** — share of the NTA's population within a 10-minute walk (800 m) of at
   least one institution, computed from tract centroids

Access is the most defensible for the research question: a neighborhood bordering a
major museum district gets no credit under a within-boundary count, yet its residents
may have better real access than a neighborhood with one small institution at its
far edge. Boundary effects are a genuine measurement problem, and the access measure
is what addresses them.

Institution definition is user-toggleable across three nested scopes:
- **Narrow** — DCLA directory only (funded arts organizations)
- **Standard** — FacDB `LIBRARIES AND CULTURAL PROGRAMS` ∪ DCLA, deduplicated by BBL+name
- **Broad** — Standard ∪ parks/gardens/historical sites ∪ youth programs
  ("third places")

## 5. Confounders

Any model or bivariate view must adjust for, or at minimum display alongside:

| Confounder | Source | Why it matters |
|---|---|---|
| Median household income | ACS `B19013_001E` | Drives both institution siting and crime; the dominant confounder |
| Poverty rate | ACS `B17001` | Captures deprivation that median income misses |
| Population density | ACS pop ÷ NTA land area | Density raises both opportunity for crime and viability of institutions |
| Share aged 15–24 | ACS `B01001` | The demographic most involved in violent crime as victims and perpetrators |
| Owner-occupancy | ACS `B25003` | Proxy for residential stability and collective efficacy |
| Educational attainment | ACS `B15003` | Correlated with both outcome and exposure |
| Commercial/daytime population | FacDB commercial counts (proxy) | Separates "busy" from "dangerous" |
| Policing intensity | Precinct-level arrests ÷ complaints | Partially separates enforcement from incidence |

**Unmeasured and acknowledged:** collective efficacy, historical redlining and
disinvestment, public housing siting policy, gentrification trajectory, school quality.
Redlining in particular is a common cause of *both* low cultural investment and high
violence today, and its omission means residual confounding is certain, not merely
possible.

## 6. Threats to validity

Each must appear in the UI's methodology panel, in plain language.

**Reverse causality.** Institutions locate where it is safe and where property and
donors are. Causality plausibly runs outcome → exposure at least as strongly as
exposure → outcome. Cross-sectional data cannot distinguish the directions.

**Modifiable areal unit problem (MAUP).** The same points aggregated to precincts,
tracts or NTAs can yield different and even opposite associations. Mitigation: offer
Community District aggregation as a sensitivity check and show whether the sign and
magnitude hold.

**Ecological fallacy.** A neighborhood-level association says nothing about
individuals. That people in neighborhoods with more institutions experience less
violence does not mean institution users experience less violence.

**Edge effects.** Crime and cultural access do not stop at NTA boundaries. The access
measure mitigates this; a within-boundary count does not.

**Denominator distortion.** Residential population is the wrong denominator where
daytime population dominates. Midtown, FiDi and the airports are the clear cases;
affected NTAs are flagged.

**Selection in the exposure.** DCLA coverage skews toward funded organizations and
under-counts informal cultural space most severely in low-income neighborhoods — the
same neighborhoods the project is about. This biases the measured exposure downward
exactly where accuracy matters most.

**Temporal mismatch.** Institution data is a current snapshot; crime data spans years.
A 2026 institution list cannot explain 2010 crime. Longitudinal work requires institution
opening dates, which the directory does not provide.

## 7. Statistical treatment

v1 is **descriptive and exploratory**, not inferential. Specifically:

- Quintile comparisons of outcome rate across exposure quintiles, with 95% CIs
- Partial correlation of exposure and outcome, adjusting for the confounder set
- Bivariate choropleth showing exposure and outcome jointly, so covariation is visible
  as a pattern rather than asserted as a number
- Poisson/negative-binomial rate models, offset by log(population), reported with
  coefficients and CIs — **framed as association, with residual confounding stated**

Rates use a shrinkage estimator (empirical Bayes) toward the borough mean. Raw rates in
small-population NTAs are extremely unstable: a single shooting in a 4,000-person NTA
produces a rate of 25 per 100,000, which is an artifact of the denominator, not a
finding. Unsmoothed rates must never drive the color scale.

Any NTA with population below 1,000 is excluded from rate displays and listed as
excluded.

## 8. What a causal design would require

Documented so the gap is explicit rather than implied:

1. **Panel data** — institution openings and closures with dates, giving within-NTA
   variation over time
2. **Difference-in-differences** — compare NTAs that gained an institution against
   matched NTAs that did not, before and after, differencing out fixed neighborhood
   characteristics
3. **An instrument or quasi-random variation** — e.g. capital funding decided partly by
   formula or by lottery, or a discontinuity in a funding eligibility threshold
4. **Pre-trend testing** — demonstrating that treated and control neighborhoods were on
   parallel crime trajectories before the institution arrived

DCLA capital funding data includes award years and could support (1) and (2) in a v2.
That is the honest path from this application's descriptive findings to a causal claim,
and it should be named as future work rather than quietly skipped.

## 9. Presentation requirements

- A persistent, non-dismissible "Limitations" affordance in the UI
- Every exported chart or image carries the association-not-causation line
- Confidence intervals shown wherever a rate is shown
- Excluded NTAs (low population, non-residential) visibly marked, not silently absent
- Color scales for crime rates must not use a palette implying moral judgment; these
  are neighborhoods where people live, not threat levels
