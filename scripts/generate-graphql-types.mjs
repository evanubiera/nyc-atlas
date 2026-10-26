#!/usr/bin/env node
/**
 * Emits TypeScript types from the GraphQL schema (specs/001 NFR-7, 008 §4.4).
 *
 * The client previously hand-wrote every payload interface, which meant the
 * contract existed twice and nothing stopped the copies diverging — a field
 * renamed server-side stayed compiling client-side and failed at runtime.
 *
 * This uses the `graphql` package the BFF already depends on rather than a
 * codegen toolchain: the schema is the single source, the output is
 * deterministic, and CI regenerates and diffs it so a stale file fails the
 * build instead of rotting.
 *
 * Usage: node scripts/generate-graphql-types.mjs [--check]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSchema,
  isEnumType,
  isInputObjectType,
  isObjectType,
  isScalarType,
} from 'graphql';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(ROOT, 'packages/bff/schema.gql');
const OUT_PATH = path.join(ROOT, 'packages/web/src/store/schema.generated.ts');

/** GraphQL's built-in scalars, plus the ones this schema declares. */
const SCALARS = {
  String: 'string',
  Int: 'number',
  Float: 'number',
  Boolean: 'boolean',
  ID: 'string',
  JSON: 'string',
};

/**
 * Renders a type reference. GraphQL is nullable by default and TypeScript is
 * not, so every type that is not wrapped in `!` becomes `| null`.
 */
function renderType(type) {
  if (type.kind === 'NonNullType') return renderInner(type.type);
  return `${renderInner(type)} | null`;
}

function renderInner(type) {
  if (type.kind === 'NonNullType') return renderInner(type.type);
  if (type.kind === 'ListType') return `${renderType(type.type)}[]`;
  const name = type.name.value;
  return SCALARS[name] ?? name;
}

function fieldsOf(node) {
  return (node.fields ?? []).map((field) => {
    const rendered = renderType(field.type);
    const optional = field.type.kind !== 'NonNullType' && node.kind === 'InputObjectTypeDefinition';
    return `  ${field.name.value}${optional ? '?' : ''}: ${rendered};`;
  });
}

function generate() {
  const sdl = readFileSync(SCHEMA_PATH, 'utf8');
  const schema = buildSchema(sdl);
  const typeMap = schema.getTypeMap();

  const blocks = [];

  for (const name of Object.keys(typeMap).sort()) {
    if (name.startsWith('__')) continue;
    const type = typeMap[name];
    const node = type.astNode;
    if (!node) continue;

    if (isEnumType(type)) {
      const values = type.getValues().map((v) => `'${v.name}'`).join(' | ');
      blocks.push(`export type ${name} = ${values};`);
      continue;
    }

    if (isObjectType(type) || isInputObjectType(type)) {
      if (name === 'Query' || name === 'Mutation' || name === 'Subscription') continue;
      const lines = fieldsOf(node);
      blocks.push(`export interface ${name} {\n${lines.join('\n')}\n}`);
      continue;
    }

    if (isScalarType(type) && SCALARS[name] === undefined) {
      blocks.push(`export type ${name} = unknown;`);
    }
  }

  return (
    '// Generated from packages/bff/schema.gql by scripts/generate-graphql-types.mjs.\n' +
    '// Do not edit by hand — run `npm run generate:types`.\n\n' +
    blocks.join('\n\n') +
    '\n'
  );
}

const output = generate();
const check = process.argv.includes('--check');

if (check) {
  let current = '';
  try {
    current = readFileSync(OUT_PATH, 'utf8');
  } catch {
    console.error('No generated types found — run `npm run generate:types`.');
    process.exit(1);
  }
  if (current !== output) {
    console.error(
      'Generated GraphQL types are stale. The schema changed without regenerating.\n' +
        'Run `npm run generate:types` and commit the result.',
    );
    process.exit(1);
  }
  console.log('Generated GraphQL types are up to date.');
} else {
  writeFileSync(OUT_PATH, output, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUT_PATH)}`);
}
