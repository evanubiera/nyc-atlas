import { Field, Float, Int, ObjectType, registerEnumType, InputType } from '@nestjs/graphql';
import { CRIME_CATEGORIES, type CrimeCategory } from '@nyc-atlas/shared';

export enum CrimeCategoryEnum {
  VIOLENT_PERSON = 'VIOLENT_PERSON',
  VIOLENT_PROPERTY = 'VIOLENT_PROPERTY',
  PROPERTY = 'PROPERTY',
  FRAUD = 'FRAUD',
  WEAPONS = 'WEAPONS',
  DRUGS = 'DRUGS',
  DISORDER = 'DISORDER',
  TRAFFIC = 'TRAFFIC',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  SHOOTING = 'SHOOTING',
  UNKNOWN = 'UNKNOWN',
}
registerEnumType(CrimeCategoryEnum, { name: 'CrimeCategory' });

export enum ExposureMeasureEnum {
  DENSITY = 'DENSITY',
  PER_CAPITA = 'PER_CAPITA',
  ACCESS = 'ACCESS',
}
registerEnumType(ExposureMeasureEnum, { name: 'ExposureMeasure' });

export enum InstitutionScopeEnum {
  NARROW = 'NARROW',
  STANDARD = 'STANDARD',
  BROAD = 'BROAD',
}
registerEnumType(InstitutionScopeEnum, { name: 'InstitutionScope' });

export const ALL_CRIME_CATEGORIES: readonly CrimeCategory[] = CRIME_CATEGORIES;

@InputType()
export class MetricsInput {
  @Field(() => CrimeCategoryEnum, { defaultValue: CrimeCategoryEnum.SHOOTING })
  category!: CrimeCategoryEnum;

  @Field(() => ExposureMeasureEnum, { defaultValue: ExposureMeasureEnum.PER_CAPITA })
  exposure!: ExposureMeasureEnum;

  @Field(() => InstitutionScopeEnum, { defaultValue: InstitutionScopeEnum.STANDARD })
  scope!: InstitutionScopeEnum;

  @Field(() => String, { defaultValue: '2006-01' })
  from!: string;

  @Field(() => String, { defaultValue: '2100-01' })
  to!: string;

  @Field(() => [Int], { nullable: true })
  boroughCodes?: number[];
}

@ObjectType()
export class ExclusionNote {
  @Field(() => String) kind!: string;
  @Field(() => String) explanation!: string;
}

@ObjectType({ description: 'One neighborhood, joined across crime, institutions and demographics.' })
export class NeighborhoodMetric {
  @Field(() => String) nta2020!: string;
  @Field(() => String) name!: string;
  @Field(() => String) boroughName!: string;
  @Field(() => Int) boroughCode!: number;
  @Field(() => Float) landAreaSqKm!: number;
  @Field(() => [Float]) centroid!: number[];

  @Field(() => Int, { nullable: true }) population?: number | null;
  @Field(() => Int) rawCount!: number;

  @Field(() => Float, { nullable: true, description: 'Unsmoothed. Shown for honesty, not for color.' })
  ratePer100k?: number | null;

  @Field(() => Float, { nullable: true, description: 'Empirical-Bayes shrunk. Drives the color scale.' })
  smoothedRatePer100k?: number | null;

  @Field(() => [Float], { nullable: true }) confidenceInterval?: number[] | null;

  @Field(() => Int) institutionCount!: number;
  @Field(() => Float) institutionsPerSqKm!: number;
  @Field(() => Float, { nullable: true }) institutionsPer10k?: number | null;
  @Field(() => Float, { nullable: true }) exposureValue?: number | null;

  @Field(() => Float, {
    nullable: true,
    description:
      'Observed minus predicted rate after adjusting for income, poverty, density, age and tenure. ' +
      'Positive means more incidents than socioeconomics alone would predict.',
  })
  residual?: number | null;

  @Field(() => Float, { nullable: true }) medianHouseholdIncome?: number | null;
  @Field(() => Float, { nullable: true }) povertyRate?: number | null;
  @Field(() => Float, { nullable: true }) shareBachelorsOrHigher?: number | null;

  @Field(() => Int, { description: 'Licensed food stores of any size.' })
  foodStoreCount!: number;

  @Field(() => Int, {
    description:
      'Licensed food stores of 10,000 sq ft or more — the conventional supermarket threshold. ' +
      'Floor area is self-reported at licensing and never audited.',
  })
  supermarketCount!: number;

  @Field(() => Float, { nullable: true }) supermarketsPer10k?: number | null;

  @Field(() => Int, { description: 'Food stores carrying a current State inspection grade.' })
  gradedStoreCount!: number;

  @Field(() => Int, { description: 'Of those, how many hold the top grade.' })
  gradeAStoreCount!: number;

  @Field(() => Float, {
    nullable: true,
    description:
      'Share of graded food stores holding the top State inspection grade. A sanitation ' +
      'result — whether a store is clean and storing food safely — not a measure of what it ' +
      'sells or charges. Null where no store here has a current inspection.',
  })
  storeGradeShare?: number | null;

  @Field(() => Int, { description: 'FacDB hospitals, clinics and diagnostic & treatment centers.' })
  healthcareSiteCount!: number;

  @Field(() => Float, { nullable: true }) healthcareSitesPer10k?: number | null;

  @Field(() => Int, { description: 'Elementary/middle schools with published 2024 proficiency.' })
  schoolCount!: number;

  @Field(() => Int, { description: 'Students those schools tested — the weight behind proficiency.' })
  schoolStudents!: number;

  @Field(() => Float, {
    nullable: true,
    description:
      'Student-weighted share of students at NY State Level 3-4, ELA and Math pooled. Describes ' +
      'where a neighborhood\'s schools sit, not where its children go.',
  })
  schoolProficiency?: number | null;

  @Field(() => Boolean) isEnforcementDriven!: boolean;

  @Field(() => Boolean, {
    description:
      'True where destinations far outnumber residents, so the per-resident rate is ' +
      'inflated by a daytime population no published figure covers. Inferred, not measured.',
  })
  daytimePopulationSuspected!: boolean;
  @Field(() => ExclusionNote, { nullable: true }) excluded?: ExclusionNote | null;
}

export enum OutcomeModeEnum {
  RATE_PER_100K = 'RATE_PER_100K',
  COUNT_PER_SQKM = 'COUNT_PER_SQKM',
}
registerEnumType(OutcomeModeEnum, {
  name: 'OutcomeMode',
  description:
    'RATE_PER_100K needs ACS population. COUNT_PER_SQKM is the fallback when no Census ' +
    'key is configured — a real measure, but not the same quantity.',
});

@ObjectType()
export class MetricsPayload {
  @Field(() => OutcomeModeEnum) outcomeMode!: OutcomeModeEnum;
  @Field(() => [NeighborhoodMetric]) rows!: NeighborhoodMetric[];
  @Field(() => [Float]) scaleBreaks!: number[];
  @Field(() => [Float], { nullable: true }) residualExtent?: number[] | null;
  @Field(() => [String], { description: 'Never empty when qualification is needed.' })
  caveats!: string[];
  @Field(() => Boolean) demographicsAvailable!: boolean;
}

@ObjectType()
export class QuintileBucket {
  @Field(() => Int) quintile!: number;
  @Field(() => [Float]) exposureRange!: number[];
  @Field(() => Float) meanOutcomeRate!: number;
  @Field(() => [Float]) confidenceInterval!: number[];
  @Field(() => Int) neighborhoodCount!: number;

  @Field(() => Float, {
    description:
      'The denominator for this bucket. Resident population in RATE_PER_100K mode; ' +
      'land area in COUNT_PER_SQKM mode, which is fractional — hence Float, not Int.',
  })
  totalPopulation!: number;

  @Field(() => Int) totalCount!: number;
}

@ObjectType()
export class QuintilePayload {
  @Field(() => OutcomeModeEnum) outcomeMode!: OutcomeModeEnum;
  @Field(() => [QuintileBucket]) buckets!: QuintileBucket[];
  @Field(() => [String]) caveats!: string[];
  @Field(() => Boolean) demographicsAvailable!: boolean;
}

@ObjectType()
export class CorrelationPayload {
  @Field(() => Float) raw!: number;
  @Field(() => Float, { nullable: true }) adjusted?: number | null;
  @Field(() => [String]) confounders!: string[];
  @Field(() => Int) n!: number;
  @Field(() => Float, { nullable: true }) modelRSquared?: number | null;
  @Field(() => String, { description: 'Required. Association, never causation.' })
  interpretation!: string;
}

@ObjectType()
export class InstitutionPoint {
  @Field(() => String) id!: string;
  @Field(() => String) name!: string;
  @Field(() => String) source!: string;
  @Field(() => Float) lon!: number;
  @Field(() => Float) lat!: number;
  @Field(() => String, { nullable: true }) nta2020?: string | null;
  @Field(() => String) scope!: string;
  @Field(() => String, { nullable: true }) discipline?: string | null;
  @Field(() => String, { nullable: true }) facilitySubgroup?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'FacDB factype. Preferred over facilitySubgroup for display: 83% of cultural facilities ' +
      'share the subgroup OTHER CULTURAL INSTITUTIONS.',
  })
  facilityType?: string | null;
}

@ObjectType()
export class QualityRejection {
  @Field(() => String) dataset!: string;
  @Field(() => String) reason!: string;
  @Field(() => Int) count!: number;
}

@ObjectType()
export class QualityReportPayload {
  @Field(() => String) generatedAt!: string;
  @Field(() => Int) totalRowsProcessed!: number;
  @Field(() => [QualityRejection]) rejections!: QualityRejection[];
  @Field(() => [String]) unmappedOffenses!: string[];
  @Field(() => Int) recoveredViaFallback!: number;
  @Field(() => [String]) notes!: string[];
}

export enum GapUnitEnum {
  USD = 'USD',
  PER_10K = 'PER_10K',
  SHARE = 'SHARE',
}
registerEnumType(GapUnitEnum, {
  name: 'GapUnit',
  description: 'How a gap measure should be formatted: dollars, a count per 10,000, or a share.',
});

@ObjectType({ description: 'One socioeconomic measure, contrasted across the two groups.' })
export class AccessGapMeasure {
  @Field(() => String) key!: string;
  @Field(() => String) label!: string;
  @Field(() => GapUnitEnum) unit!: GapUnitEnum;

  @Field(() => Float, { nullable: true, description: 'Pooled value in the least-served fifth.' })
  lowest?: number | null;

  @Field(() => Float, { nullable: true, description: 'Pooled value in the best-served fifth.' })
  highest?: number | null;

  @Field(() => Float, {
    nullable: true,
    description: 'highest / lowest. Null when either side is missing or the floor is zero.',
  })
  ratio?: number | null;

  @Field(() => Boolean, { description: 'True when a larger number is better for a resident.' })
  higherIsBetter!: boolean;

  @Field(() => String, { description: 'How this number was pooled, and what it does not say.' })
  note!: string;
}

@ObjectType()
export class AccessGapGroup {
  @Field(() => Int) neighborhoodCount!: number;
  @Field(() => Int) population!: number;
  @Field(() => Float, { nullable: true }) institutionsPer10k?: number | null;
  @Field(() => [String], { description: 'A few neighborhoods from the group, largest first.' })
  examples!: string[];
}

@ObjectType({
  description:
    'The fifth of neighborhoods with the least cultural access set against the fifth with the ' +
    'most, on income, groceries, schools and healthcare. Figures are pooled across each group, ' +
    'not averaged across its neighborhoods.',
})
export class AccessGapsPayload {
  @Field(() => [AccessGapMeasure]) measures!: AccessGapMeasure[];
  @Field(() => AccessGapGroup) least!: AccessGapGroup;
  @Field(() => AccessGapGroup) most!: AccessGapGroup;
  @Field(() => String, { description: 'What the neighborhoods were ranked on.' })
  exposureLabel!: string;
  @Field(() => Boolean) amenitiesAvailable!: boolean;
  @Field(() => Boolean) demographicsAvailable!: boolean;
  @Field(() => [String]) caveats!: string[];
}
