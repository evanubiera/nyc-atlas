import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Where a single upstream dataset came from and when.' })
export class DatasetProvenance {
  @Field(() => String, { description: 'Socrata dataset id, e.g. 5ucz-vwe8.' })
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  purpose!: string;

  @Field(() => String, { nullable: true })
  rowsUpdatedAt?: string | null;

  @Field(() => Int, { nullable: true })
  rowCount?: number | null;

  @Field(() => String, { nullable: true })
  notes?: string | null;
}

@ObjectType({ description: 'Full data lineage for a response.' })
export class Provenance {
  @Field(() => [DatasetProvenance])
  datasets!: DatasetProvenance[];

  @Field(() => String)
  ingestVersion!: string;

  @Field(() => [String])
  warnings!: string[];

  @Field(() => String, {
    description:
      'Required attribution. This application shows statistical associations and does not establish causation.',
  })
  attribution!: string;
}

@ObjectType({ description: 'Runtime capability report — what is available with current credentials.' })
export class Capabilities {
  @Field(() => Boolean)
  geographyLoaded!: boolean;

  @Field(() => Int)
  neighborhoodCount!: number;

  @Field(() => Int)
  residentialNeighborhoodCount!: number;

  @Field(() => Boolean, {
    description: 'False when CENSUS_API_KEY is unset; demographic features degrade to cache.',
  })
  censusApiAvailable!: boolean;

  @Field(() => Boolean, { description: 'True when SOCRATA_APP_TOKEN raises rate limits.' })
  socrataTokenConfigured!: boolean;

  @Field(() => [String])
  degradedFeatures!: string[];
}
