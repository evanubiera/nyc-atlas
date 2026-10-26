import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { CrimeCategoryEnum } from './metrics.model.js';

@InputType({ description: 'A viewport. Both bounds are required — see specs/008 §3.5.' })
export class IncidentsInput {
  @Field(() => Float) west!: number;
  @Field(() => Float) south!: number;
  @Field(() => Float) east!: number;
  @Field(() => Float) north!: number;

  @Field(() => CrimeCategoryEnum) category!: CrimeCategoryEnum;

  @Field(() => String, { description: 'Inclusive ISO day.' }) from!: string;
  @Field(() => String, { description: 'Inclusive ISO day.' }) to!: string;

  @Field(() => Int, { nullable: true, description: 'Capped server-side regardless.' })
  limit?: number;
}

@ObjectType({ description: 'One incident, positioned.' })
export class IncidentPointModel {
  @Field(() => Float) lon!: number;
  @Field(() => Float) lat!: number;
  @Field(() => String) occurredOn!: string;
}

@ObjectType({ description: 'Points inside the requested viewport.' })
export class IncidentsPayload {
  @Field(() => [IncidentPointModel])
  points!: IncidentPointModel[];

  @Field(() => Boolean, {
    description:
      'True when the row cap was reached, so these points are a sample of the viewport ' +
      'rather than all of it. The client must say so rather than drawing it as complete.',
  })
  capped!: boolean;

  @Field(() => Boolean, {
    description:
      'False when the requested box is too large to serve points for; the choropleth ' +
      'carries the answer at that zoom.',
  })
  serviceable!: boolean;
}

@ObjectType({
  description:
    'Boundary sensitivity. The same association re-run over community districts, so a ' +
    'result that depends on how the neighborhoods were drawn is visible rather than implied.',
})
export class MaupPayload {
  @Field(() => Float, { nullable: true }) fineCorrelation!: number | null;
  @Field(() => Float, { nullable: true }) coarseCorrelation!: number | null;
  @Field(() => Int) fineCount!: number;
  @Field(() => Int) coarseCount!: number;

  @Field(() => Float, { nullable: true, description: 'Absolute change in r between geographies.' })
  shift!: number | null;

  @Field(() => Boolean) agrees!: boolean;

  @Field(() => String, { description: 'Non-nullable by design, as every interpretation here is.' })
  interpretation!: string;
}
