// Tiny JSON Schema (draft 2020-12 subset) validator, so the skill needs no extra dependency.
// Supported: type, enum, const, required, properties, additionalProperties, items, prefixItems,
// minItems, maxItems, minimum, maximum, exclusiveMinimum, minLength, maxLength, pattern,
// $ref (local "#/$defs/..."), anyOf, oneOf, allOf. Unknown keywords are ignored.
// The schema files themselves are standard, so any full validator (ajv, jsonschema...) also works.
import path from 'node:path';
import { ROOT, readJSON } from './util.mjs';

export function loadSchema(name) {
  return readJSON(path.join(ROOT, 'schemas', `${name}.schema.json`));
}

export function validate(data, schema) {
  const errors = [];
  check(data, schema, schema, '$', errors);
  return { valid: errors.length === 0, errors };
}

export function assertValid(data, name) {
  const { valid, errors } = validate(data, loadSchema(name));
  if (!valid) {
    const list = errors.slice(0, 15).map((e) => `  - ${e}`).join('\n');
    throw new Error(`${name} is invalid (${errors.length} problem${errors.length > 1 ? 's' : ''}):\n${list}`);
  }
  return data;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function resolve(ref, root) {
  if (!ref.startsWith('#/')) throw new Error(`Only local $ref supported: ${ref}`);
  return ref.slice(2).split('/').reduce((o, k) => o[k.replace(/~1/g, '/').replace(/~0/g, '~')], root);
}

function check(v, s, root, at, errs) {
  if (s === true || s === undefined) return;
  if (s === false) { errs.push(`${at}: not allowed`); return; }
  if (s.$ref) { check(v, resolve(s.$ref, root), root, at, errs); }
  if (s.allOf) for (const sub of s.allOf) check(v, sub, root, at, errs);
  if (s.anyOf) {
    const ok = s.anyOf.some((sub) => { const e = []; check(v, sub, root, at, e); return e.length === 0; });
    if (!ok) errs.push(`${at}: does not match any allowed shape`);
  }
  if (s.oneOf) {
    const n = s.oneOf.filter((sub) => { const e = []; check(v, sub, root, at, e); return e.length === 0; }).length;
    if (n !== 1) errs.push(`${at}: must match exactly one allowed shape (matched ${n})`);
  }
  if (s.type) {
    const t = typeOf(v), allowed = [].concat(s.type);
    const ok = allowed.includes(t) || (t === 'integer' && allowed.includes('number'));
    if (!ok) { errs.push(`${at}: expected ${allowed.join('|')}, got ${t}`); return; }
  }
  if (s.const !== undefined && JSON.stringify(v) !== JSON.stringify(s.const)) errs.push(`${at}: must be ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) errs.push(`${at}: must be one of ${s.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) errs.push(`${at}: must be >= ${s.minimum}`);
    if (s.maximum !== undefined && v > s.maximum) errs.push(`${at}: must be <= ${s.maximum}`);
    if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) errs.push(`${at}: must be > ${s.exclusiveMinimum}`);
  }
  if (typeof v === 'string') {
    if (s.minLength !== undefined && [...v].length < s.minLength) errs.push(`${at}: shorter than ${s.minLength}`);
    if (s.maxLength !== undefined && [...v].length > s.maxLength) errs.push(`${at}: longer than ${s.maxLength}`);
    if (s.pattern && !new RegExp(s.pattern, 'u').test(v)) errs.push(`${at}: does not match ${s.pattern}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) errs.push(`${at}: needs at least ${s.minItems} items`);
    if (s.maxItems !== undefined && v.length > s.maxItems) errs.push(`${at}: at most ${s.maxItems} items`);
    const pre = s.prefixItems || [];
    v.forEach((item, i) => {
      if (i < pre.length) check(item, pre[i], root, `${at}[${i}]`, errs);
      else if (s.items !== undefined) check(item, s.items, root, `${at}[${i}]`, errs);
    });
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of s.required || []) if (!(k in v)) errs.push(`${at}: missing "${k}"`);
    const props = s.properties || {};
    for (const [k, val] of Object.entries(v)) {
      if (props[k] !== undefined) check(val, props[k], root, `${at}.${k}`, errs);
      else if (s.additionalProperties === false) errs.push(`${at}: unknown property "${k}"`);
      else if (s.additionalProperties && typeof s.additionalProperties === 'object') check(val, s.additionalProperties, root, `${at}.${k}`, errs);
    }
  }
}
