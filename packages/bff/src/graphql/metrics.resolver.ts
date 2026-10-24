import { Args, Query, Resolver } from '@nestjs/graphql';
import type { CrimeCategory, ExposureMeasure, InstitutionScope } from '@nyc-atlas/shared';
import { MetricsService, type MetricsQuery } from '../metrics/metrics.service.js';
import {
  CorrelationPayload,
  InstitutionPoint,
  InstitutionScopeEnum,
  MetricsInput,
  MetricsPayload,
  OutcomeModeEnum,
  QualityReportPayload,
  QuintilePayload,
} from './models/metrics.model.js';

@Resolver()
export class MetricsResolver {
  constructor(private readonly metricsService: MetricsService) {}

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
