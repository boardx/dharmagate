import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { removeEmbeddedAuthFallback } from '../ops/remove-embedded-auth-fallback.mjs';

const fixture = `var production = {"AUTH_SECRET":"SYNTHETIC_NOT_A_REAL_CREDENTIAL","AUTH_URL":"https://example.invalid"};
var development = {"AUTH_SECRET":"SYNTHETIC_NOT_A_REAL_CREDENTIAL","AUTH_URL":"http://localhost"};
function unchangedSessionLookup() { return 'fixture-session-logic'; }`;

test('removes both embedded fallbacks without altering other config or session code', () => {
  const transformed = removeEmbeddedAuthFallback(fixture);
  assert.deepEqual(transformed.changedEnvironments,['production','development']);
  assert.equal(transformed.source.includes('SYNTHETIC_NOT_A_REAL_CREDENTIAL'),false);
  assert.equal(transformed.source.includes('function unchangedSessionLookup()'),true);
  const context={};vm.runInNewContext(transformed.source,context);
  assert.equal(context.production.AUTH_URL,'https://example.invalid');
  assert.equal(Object.hasOwn(context.production,'AUTH_SECRET'),false);
  assert.equal(Object.hasOwn(context.development,'AUTH_SECRET'),false);
  assert.equal(context.unchangedSessionLookup(),'fixture-session-logic');
});
test('fails closed on unexpected config, duplicates or leftover literals', () => {
  assert.throws(()=>removeEmbeddedAuthFallback('no expected config'));
  assert.throws(()=>removeEmbeddedAuthFallback(fixture+'\nvar production = {};'));
  assert.throws(()=>removeEmbeddedAuthFallback(fixture+'\nconst leftover="SYNTHETIC_NOT_A_REAL_CREDENTIAL";'));
});
test('binding-first population keeps explicit binding and does not resurrect removed fallback', () => {
  const {source}=removeEmbeddedAuthFallback(fixture);
  const context={};vm.runInNewContext(source,context);
  function populate(binding,config){const processEnv={};for(const[key,value]of Object.entries(binding))if(typeof value==='string')processEnv[key]=value;for(const key in config)processEnv[key]??=config[key];return processEnv;}
  assert.equal(populate({},context.production).AUTH_SECRET,undefined);
  assert.equal(populate({AUTH_SECRET:'SYNTHETIC_RUNTIME_BINDING'},context.production).AUTH_SECRET,'SYNTHETIC_RUNTIME_BINDING');
});
