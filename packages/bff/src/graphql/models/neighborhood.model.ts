import { Field, Float, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum ExclusionKind {
  NON_RESIDENTIAL = 'NON_RESIDENTIAL',
  LOW_POPULATION = 'LOW_POPULATION',
  NO_DEMOGRAPHICS = 'NO_DEMOGRAPHICS',
}
registerEnumType(ExclusionKind, {
  name: 'ExclusionKind',
  description: 'Why a neighborhood is omitted from rate displays, while still being rendered.',
});

@ObjectType({ description: 'Why a neighborhood carries no rate. Rendered, never silently dropped.' })
export class Exclusion {
  @Field(() => ExclusionKind)
  kind!: ExclusionKind;

  @Field(() => String, { nullable: true, description: 'ntatype for NON_RESIDENTIAL exclusions.' })
  ntatype?: string | null;

  @Field(() => Int, { nullable: true, description: 'Population for LOW_POPULATION exclusions.' })
  population?: number | null;

  @Field(() => String)
  explanation!: string;
}

@ObjectType({ description: 'ACS demographics aggregated from census tracts to the 2020 NTA.' })
export class Demographics {
  @Field(() => Int)
  population!: number;

  @Field(() => Float)
  populationDensityPerSqKm!: number;

  @Field(() => Float, { nullable: true })
  povertyRate?: number | null;

  @Field(() => Float, { nullable: true })
  medianHouseholdIncome?: number | null;

  @Field(() => Boolean, {
    description:
      'Always true. Medians cannot be summed across tracts, so this is a population-weighted mean of tract medians.',
  })
  medianIncomeIsApproximated!: boolean;

  @Field(() => Float, { nullable: true })
  shareAged15to24?: number | null;

  @Field(() => Float, { nullable: true })
  ownerOccupancyRate?: number | null;

  @Field(() => String)
  acsVintage!: string;

  @Field(() => Int)
  contributingTracts!: number;
}

@ObjectType({ description: 'A 2020 Neighborhood Tabulation Area — the analytical unit.' })
export class Neighborhood {
  @Field(() => String, { description: '2020 NTA code, e.g. BX0101.' })
  nta2020!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  boroughName!: string;

  @Field(() => Int)
  boroughCode!: number;

  @Field(() => String)
  cdta2020!: string;

  @Field(() => Float)
  landAreaSqKm!: number;

  @Field(() => [Float], { description: '[lon, lat]' })
  centroid!: number[];

  @Field(() => Boolean, { description: "True when ntatype = '0'. 197 of 262 NTAs." })
  isResidential!: boolean;

  @Field(() => Demographics, { nullable: true })
  demographics?: Demographics | null;

  @Field(() => Exclusion, { nullable: true })
  exclusion?: Exclusion | null;
}
