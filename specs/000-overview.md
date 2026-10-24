# 000 — Project Overview

**Project:** NYC Cultural Infrastructure & Neighborhood Safety Atlas
**Status:** Spec v1 — scaffold in progress
**Last updated:** 2026-10-24

## Purpose

An interactive 3D atlas that maps the distribution of cultural institutions across New
York City neighborhoods alongside reported crime and shooting incidents, so that the
relationship between cultural infrastructure and neighborhood safety can be examined —
with explicit attention to the socioeconomic conditions that shape both.

## The research question, stated precisely

The motivating question is often phrased as *"does the presence of cultural institutions
reduce local violence?"* That is a **causal** question. The data available through NYC
Open Data is **observational and cross-sectional**, and cannot answer it. What this
application can rigorously answer:

> Across NYC's 197 residential Neighborhood Tabulation Areas, how does cultural
> institution density co-vary with reported crime and shooting rates, and how much of
> that association persists after adjusting for population density, income, poverty,
> and age structure?

The distinction is not pedantry. Cultural institutions are disproportionately sited in
wealthier, already-safer neighborhoods, and endowment-funded institutions follow
property values. A raw negative correlation between institutions and crime is close to
guaranteed and tells us almost nothing. The analytical value is in the *residual* — what
remains after confounders are accounted for — and in making the confounding visible
rather than hiding it.

See [007-methodology.md](007-methodology.md) for threats to validity and the design a
genuine causal claim would require.

## Scope

**In scope (v1)**
- NTA-level choropleth and 3D extrusion of crime/shooting rates by category
- Cultural institution inventory from two independent sources (DCLA directory, FacDB)
- Socioeconomic context layer from current ACS data
- Bivariate views: institution density vs. crime rate, with confounder adjustment
- Filtering by crime category, date range, institution type, borough
- Reproducible ingest pipeline with a documented data-quality report

**Out of scope (v1)**
- Causal effect estimates or policy recommendations
- Individual-level or address-level inference
- Predictive/forecasting models
- Authenticated users, saved views, collaboration

## Documents

| Doc | Contents |
|---|---|
| [001-requirements.md](001-requirements.md) | Functional and non-functional requirements |
| [002-data-sources.md](002-data-sources.md) | Verified dataset registry, schemas, quirks |
| [003-domain-model.md](003-domain-model.md) | Core entities and TypeScript contracts |
| [004-architecture.md](004-architecture.md) | System design, spatial join strategy |
| [005-graphql-schema.md](005-graphql-schema.md) | BFF GraphQL contract |
| [006-visualization.md](006-visualization.md) | deck.gl layer specs and interaction model |
| [007-methodology.md](007-methodology.md) | Statistical approach, confounders, validity |
| [008-task-breakdown.md](008-task-breakdown.md) | Implementation tasks in dependency order |

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript, Webpack 5, styled-components 6 |
| State | Redux Toolkit + RTK Query (GraphQL via `graphql-request`) |
| 3D / geo | deck.gl 9 + MapLibre GL (no Mapbox token required) |
| BFF | NestJS 11 + GraphQL (Apollo Server 4), code-first schema |
| Monorepo | npm workspaces: `shared`, `bff`, `web` |
| Runtime | Node 24 LTS |
