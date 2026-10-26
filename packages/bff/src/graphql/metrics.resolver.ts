import { Args, Query, Resolver } from '@nestjs/graphql';
import type { CrimeCategory, ExposureMeasure, InstitutionScope } from '@nyc-atlas/shared';
import { MetricsService, type MetricsQuery } from '../metrics/metrics.service.js';
import {
  AccessGapsPayload,
  CorrelationPayload,
  GapUnitEnum,
  InstitutionPoint,
  InstitutionScopeEnum,
  MetricsInput,
  MetricsPayload,
  OutcomeModeEnum,
  QualityReportPayload,
  QuintilePayload,
} from './models/metrics.model.js';
import {
  IncidentsInput,
  IncidentsPayload,
} from './models/incidents.model.js';
import { IncidentsService } from '../incidents/incidents.service.js';
import { isBboxServiceable } from '../incidents/incident-points.js';

@Resolver()
export class MetricsResolver {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly incidentsService: IncidentsService,
  ) {}

  @Query(() => IncidentsPayload, {
    description:
      'Point-level incidents inside a viewport. The ingest keeps only NTA-by-month ' +
      'aggregates, so these are fetched upstream on demand — which is why the box is ' +
      'required and the rows are capped. Intended for the hexbin layer at z13+.',
  })
  async incidents(@Args('input') input: IncidentsInput): Promise<IncidentsPayload> {
    const bbox = { west: input.west, south: input.south, east: input.east, north: input.north };

    if (!isBboxServiceable(bbox)) {
      return { points: [], capped: false, serviceable: false };
    }

    const result = await this.incidentsService.fetchPoints({
      bbox,
      category: input.category as unknown as CrimeCategory,
      from: input.from,
      to: input.to,
      ...(input.limit === undefined ? {} : { limit: input.limit }),
    });

    return { points: result.points, capped: result.capped, serviceable: true };
  }

  @Query(() => MetricsPayload, {
    description:
      'Per-neighborhood crime, cultural-institution exposure and demographics. ' +
      'Rates are empirical-Bayes smoothed; residuals adjust for socioeconomic confounders.',
  })
  metrics(@Args('input') input: MetricsInput): MetricsPayload {
    const result = this.metricsService.compute(toQuery(input));
    return {
      outcomeMode: result.outcomeMode as unknown as OutcomeModeEnum,
      rows: result.rows.map((r) => ({
        ...r,
        confidenceInterval: r.confidenceInterval ? [...r.confidenceInterval] : null,
        centroid: [...r.centroid],
      })),
      scaleBreaks: result.scaleBreaks,
      residualExtent: result.residualExtent ? [...result.residualExtent] : null,
      caveats: result.caveats,
      demographicsAvailable: result.demographicsAvailable,
    };
  }

  @Query(() => QuintilePayload, {
    description:
      'Neighborhoods binned by cultural-institution exposure, lowest to highest, with the ' +
      'pooled outcome rate and a Poisson interval per bin. This is the direct answer to ' +
      '"what is crime like where cultural institutions are absent?"',
  })
  quintiles(@Args('input') input: MetricsInput): QuintilePayload {
    const query = toQuery(input);
    const buckets = this.metricsService.quintiles(query);
    const { caveats, demographicsAvailable, outcomeMode } = this.metricsService.compute(query);
    return {
      outcomeMode: outcomeMode as unknown as OutcomeModeEnum,
      buckets: buckets.map((b) => ({
        quintile: b.quintile,
        exposureRange: [...b.exposureRange],
        meanOutcomeRate: b.meanOutcomeRate,
        confidenceInterval: [...b.confidenceInterval],
        neighborhoodCount: b.neighborhoodCount,
        totalPopulation: b.totalPopulation,
        totalCount: b.totalCount,
      })),
      caveats,
      demographicsAvailable,
    };
  }

  @Query(() => AccessGapsPayload, {
    description:
      'The fifth of neighborhoods with the least cultural access per resident set against the ' +
      'fifth with the most, on income, poverty, supermarkets, school proficiency and clinics. ' +
      'Figures are pooled across each group so large and small neighborhoods are not weighted ' +
      'alike. A description of two groups, not an effect of institutions.',
  })
  accessGaps(@Args('input') input: MetricsInput): AccessGapsPayload {
    const result = this.metricsService.accessGaps(toQuery(input));
    return {
      ...result,
      measures: result.measures.map((m) => ({
        ...m,
        unit: m.unit as unknown as GapUnitEnum,
      })),
      least: { ...result.least, examples: [...result.least.examples] },
      most: { ...result.most, examples: [...result.most.examples] },
    };
  }

  @Query(() => CorrelationPayload, {
    description:
      'Raw and confounder-adjusted association between cultural access and the outcome. ' +
      'The interpretation field is non-nullable by design.',
  })
  correlation(@Args('input') input: MetricsInput): CorrelationPayload {
    return this.metricsService.correlation(toQuery(input));
  }

  @Query(() => [InstitutionPoint], { description: 'Cultural institutions at the requested scope.' })
  institutions(
    @Args('scope', { type: () => InstitutionScopeEnum, defaultValue: InstitutionScopeEnum.STANDARD })
    scope: InstitutionScopeEnum,
  ): InstitutionPoint[] {
    return this.metricsService.getInstitutions(scope as unknown as InstitutionScope).map((i) => ({
      id: i.id,
      name: i.name,
      source: i.source,
      lon: i.lon,
      lat: i.lat,
      nta2020: i.nta2020,
      scope: i.scope,
      discipline: i.discipline,
      facilitySubgroup: i.facilitySubgroup,
      facilityType: i.facilityType,
    }));
  }

  @Query(() => QualityReportPayload, { nullable: true })
  dataQualityReport(): QualityReportPayload | null {
    return this.metricsService.qualityReport;
  }
}

function toQuery(input: MetricsInput): MetricsQuery {
  return {
    category: input.category as unknown as CrimeCategory,
    exposure: input.exposure as unknown as ExposureMeasure,
    scope: input.scope as unknown as InstitutionScope,
    from: input.from,
    to: input.to,
    ...(input.boroughCodes ? { boroughCodes: input.boroughCodes } : {}),
  };
}
