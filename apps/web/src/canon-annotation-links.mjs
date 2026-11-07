/**
 * Complete a page's original annotations through anchors nested in annotations.
 * This does not alter the verified TEI reading model, source text or note objects.
 * Added notes retain allNotes source order. No XML is executed or fetched.
 */
export function expandPageAnnotations(allNotes, pageAnnotations, {DOMParser: Parser = globalThis.DOMParser} = {}) {
  if (!Array.isArray(pageAnnotations)) return [];
  if (!Array.isArray(allNotes) || typeof Parser !== 'function') return [...pageAnnotations];
  const xmlNamespace = 'http://www.w3.org/XML/1998/namespace';
  const teiNamespace = 'http://www.tei-c.org/ns/1.0';
  const keyOf = note => JSON.stringify([
    note?.kind ?? '', note?.xml ?? '', note?.text ?? '', note?.locator ?? null,
    note?.juan ?? null, Object.entries(note?.attributes ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  ]);
  const byAnchor = new Map(), canonical = new Map();
  for (const note of allNotes) {
    if (!note || typeof note !== 'object') continue;
    const key = keyOf(note);
    if (!canonical.has(key)) canonical.set(key, note);
    for (const field of ['target', 'from', 'to']) {
      const reference = note.attributes?.[field];
      if (typeof reference !== 'string') continue;
      for (const token of reference.split(/\s+/)) {
        // Only an in-document XML fragment can link an annotation.
        if (!/^#[^\s#]+$/.test(token)) continue;
        const id = token.slice(1);
        if (!byAnchor.has(id)) byAnchor.set(id, []);
        byAnchor.get(id).push(note);
      }
    }
  }
  const selected = new Map(), queue = [];
  const include = note => {
    if (!note || typeof note !== 'object') return;
    const key = keyOf(note);
    if (selected.has(key)) return;
    const original = canonical.get(key) ?? note;
    selected.set(key, original); queue.push(original);
  };
  for (const note of pageAnnotations) include(note);
  for (let index = 0; index < queue.length; index++) {
    const xml = queue[index].xml;
    // DOMParser has no network route here; reject external declarations as well.
    if (typeof xml !== 'string' || !xml || xml.length > 32_000_000 || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) continue;
    let document;
    try { document = new Parser().parseFromString('<audit>' + xml + '</audit>', 'application/xml'); }
    catch { continue; }
    if (!document || document.getElementsByTagName('parsererror').length) continue;
    for (const anchor of Array.from(document.getElementsByTagNameNS(teiNamespace, 'anchor'))) {
      const id = anchor.getAttributeNS(xmlNamespace, 'id');
      if (!id) continue;
      for (const note of byAnchor.get(id) ?? []) include(note);
    }
  }
  const result = [], emitted = new Set();
  for (const note of allNotes) {
    if (!note || typeof note !== 'object') continue;
    const key = keyOf(note);
    if (selected.has(key) && !emitted.has(key)) { result.push(selected.get(key)); emitted.add(key); }
  }
  // Keep caller-supplied annotations absent from allNotes rather than drop them.
  for (const [key, note] of selected) if (!emitted.has(key)) result.push(note);
  return result;
}
export const annotationLinksClient = 'globalThis.DharmaGateExpandAnnotations = ' + expandPageAnnotations.toString() + ';';
