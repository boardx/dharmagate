import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {expandPageAnnotations, annotationLinksClient} from '../src/canon-annotation-links.mjs';
// Deterministic parser double. Native browser DOMParser is separately smoke-tested.
class Parser {
  static inputs = [];
  parseFromString(xml, type) {
    assert.equal(type, 'application/xml'); Parser.inputs.push(xml);
    if (xml.includes('MALFORMED')) return {getElementsByTagName: () => [{}]};
    const ids = [...xml.matchAll(/<anchor\s+xml:id="([^"]+)"\s*\/>/g)].map(m => m[1]);
    return {getElementsByTagName: () => [], getElementsByTagNameNS: (namespace, tag) => {
      assert.equal(namespace, 'http://www.tei-c.org/ns/1.0'); assert.equal(tag, 'anchor');
      return ids.map(id => ({getAttributeNS: (ns, name) => {assert.equal(ns, 'http://www.w3.org/XML/1998/namespace'); assert.equal(name, 'id'); return id;}}));
    }};
  }
}
const resolve = (all, page) => expandPageAnnotations(all, page, {DOMParser: Parser});
test('J01nA042 0800c24 inline note includes its original linked app and added note', () => {
  const original = {kind:'note', attributes:{place:'inline'}, locator:'0800c24', juan:'1', text:'政和元年辛卯持缽，至紹興七年丁巳，計二十七年', xml:'<note xmlns="http://www.tei-c.org/ns/1.0" place="inline">政和元年辛卯持缽，至紹興七年丁<anchor xml:id="nkr_note_add_0800c2401"/><anchor xml:id="beg0800c2401"/>巳<anchor xml:id="end0800c2401"/>，計二十七年</note>'};
  const app = {kind:'stand-off-app', attributes:{from:'#beg0800c2401',to:'#end0800c2401'}, text:'巳已', xml:'<app xmlns="http://www.tei-c.org/ns/1.0"><lem>巳</lem><rdg>已</rdg></app>'};
  const note = {kind:'stand-off-note', attributes:{target:'#nkr_note_add_0800c2401',type:'add'}, text:'巳【CB】，已【嘉興】', xml:'<note xmlns="http://www.tei-c.org/ns/1.0">巳【CB】，已【嘉興】</note>'};
  const all = [original, app, note], before = JSON.stringify(all), result = resolve(all, [original]);
  assert.deepEqual(result, all); assert.strictEqual(result[0], original); assert.strictEqual(result[1], app); assert.strictEqual(result[2], note); assert.equal(JSON.stringify(all), before);
});
test('recursive links and cycles reach a fixed point without duplicate notes', () => {
  const a={kind:'note',xml:'<anchor xml:id="b"/>'},b={kind:'app',attributes:{target:'#b #c'},xml:'<anchor xml:id="c"/>'},c={kind:'note',attributes:{from:'#c',to:'#b'},xml:'<anchor xml:id="b"/>'};
  assert.deepEqual(resolve([a,b,c],[a,a]),[a,b,c]);
});
test('new notes retain source order rather than discovery order', () => {
  const first={kind:'note',attributes:{target:'#first'},text:'first'},last={kind:'note',attributes:{target:'#last'},text:'last'},seed={kind:'note',xml:'<anchor xml:id="last"/><anchor xml:id="first"/>'};
  assert.deepEqual(resolve([first,seed,last],[seed]),[first,seed,last]);
});
test('malformed XML and external declarations do not parse or add anything', () => {
  const blocked={kind:'note',xml:'<!DOCTYPE x SYSTEM "https://example.invalid/private"><anchor xml:id="a"/>'},malformed={kind:'note',xml:'MALFORMED'},target={kind:'note',attributes:{target:'#a'}};
  Parser.inputs=[]; assert.deepEqual(resolve([blocked,malformed,target],[blocked,malformed]),[blocked,malformed]); assert.equal(Parser.inputs.length,1);
});
test('external URLs are not interpreted as links and missing XML is retained', () => {
  const seed={kind:'note',xml:'<anchor xml:id="a"/>'},external={kind:'note',attributes:{target:'https://example.invalid/#a'}},plain={kind:'note',text:'unchanged'};
  assert.deepEqual(resolve([seed,external,plain],[seed,plain]),[seed,plain]);
});
test('structurally duplicated seeds resolve to original source objects', () => {
  const original={kind:'note',text:'same',attributes:{target:'#unused'}};
  const result=resolve([original],[structuredClone(original),structuredClone(original)]);
  assert.equal(result.length,1);assert.strictEqual(result[0],original);
});
test('browser wrapper is self-contained and leaves the verified model untouched', () => {
  const context={DOMParser:Parser};runInNewContext(annotationLinksClient,context);assert.equal(typeof context.DharmaGateExpandAnnotations,'function');
  const note={kind:'note',text:'original'};assert.strictEqual(context.DharmaGateExpandAnnotations([note],[note])[0],note);
});
test('unavailable parser preserves existing page annotations', () => {
  const note={text:'original'};assert.deepEqual(expandPageAnnotations([note],[note],{DOMParser:undefined}),[note]);
});
test('prebundled browser string equals the source resolver and avoids minifier helper capture', async () => {
  const generated=await import('../src/canon-annotation-browser.mjs');
  assert.equal(generated.annotationLinksClient,annotationLinksClient);
  const context={DOMParser:Parser};runInNewContext(generated.annotationLinksClient,context);
  const seed={kind:'note',xml:'<anchor xml:id="nested"/>'},linked={kind:'note',text:'linked',attributes:{target:'#nested'}};
  assert.equal(context.DharmaGateExpandAnnotations([seed,linked],[seed]).length,2);
});
