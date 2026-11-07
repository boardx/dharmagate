import unittest,hashlib,copy
from structured_reader import convert,verify,Rejected
# Entirely synthetic, no publisher passages.
RAW='''<TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:cb="http://www.cbeta.org/ns/1.0" xml:id="T99nSYNTH"><teiHeader><encodingDesc><charDecl><char xml:id="SYNTH"><mapping type="unicode">U+7532</mapping></char></charDecl></encodingDesc></teiHeader><text><body><milestone unit="juan" n="1"/><p><lb ed="T" n="0001a01"/>合成正文<cb:tt><cb:t xml:lang="sa-Sidd"><g ref="#SYNTH"/><cb:yin>合成音</cb:yin><cb:zi>合成字</cb:zi></cb:t><cb:t xml:lang="zh-Hant">合成漢文<note xml:id="n1">合成夾注</note></cb:t><cb:t xml:lang="zh-x-yy">合成音寫<lb ed="T" n="0001a02"/></cb:t></cb:tt>原尾文<anchor xml:id="a1"/><g ref="#UNKNOWN"/></p></body><back><app from="#a1"><lem>合成甲</lem><rdg>合成乙</rdg></app><choice><sic>合成丙</sic><corr>合成丁</corr></choice><note target="#a1">合成校注</note></back></text></TEI>'''.encode()
def build(raw=RAW):return convert(raw,hashlib.sha256(raw).hexdigest())
def nodes(model):
 def w(n):
  yield n
  for c in n['children']:yield from w(c)
 return list(w(model['text']))
class Tests(unittest.TestCase):
 def test_exact_tree_text_tail_attrs_proof(self):
  m=build();p=verify(RAW,m);self.assertTrue(p['exactParsedTextAndTailEquality']);self.assertFalse(p['rawByteOffsetsClaimed']);self.assertEqual(m['flattenedBody'],False)
 def test_language_layers_not_flattened_or_selected(self):
  m=build();tt=next(x for x in nodes(m)if x['role']=='parallel-group');self.assertEqual([x['language']for x in tt['children']],['sa-Sidd','zh-Hant','zh-x-yy']);self.assertEqual(tt['alignment'],'source-order-only-no-word-equivalence-inferred')
 def test_note_app_choice_all_alternatives_remain(self):
  ns=nodes(build());self.assertEqual(sum(x['role']=='apparatus'for x in ns),1);self.assertEqual(sum(x['role']=='editorial-alternatives'for x in ns),1);self.assertEqual([x['text']['value']for x in ns if x['role']in ['lemma-variant','reading-variant']],['合成甲','合成乙'])
 def test_known_unknown_glyphs_original_refs_and_definitions_retained(self):
  m=build();gs=[x for x in nodes(m)if x['role']=='glyph-reference'];self.assertEqual([(x['glyphRef'],x['headerDefinitionPresent'])for x in gs],[('#SYNTH',True),('#UNKNOWN',False)]);self.assertIn('SYNTH',m['glyphDefinitions'])
 def test_locator_path_and_juan_traced(self):
  m=build();a=next(x for x in m['sourceAtoms']if x['value']=='合成正文');self.assertEqual(a['sourceJuan'],'1');self.assertIn(a['precedingSourceLb'],[x['path']for x in m['sourceEvents']]);self.assertEqual(a['charStart'],0)
 def test_same_length_text_tamper_rejected(self):
  m=build();n=next(x for x in m['sourceAtoms']if x['value']=='合成正文');n['value']='篡改正文'
  with self.assertRaisesRegex(Rejected,'PROOF_TEXT'):verify(RAW,m)
 def test_reordering_layer_rejected(self):
  m=build();n=next(x for x in nodes(m)if x['role']=='parallel-group');n['children'].reverse()
  with self.assertRaises(Rejected):verify(RAW,m)
 def test_removed_node_or_text_slot_rejected(self):
  for target in ['node','slot']:
   m=build()
   if target=='node':m['text']['children'].pop()
   else:m['sourceAtoms'].pop()
   with self.assertRaises(Rejected):verify(RAW,m)
 def test_attributes_and_language_tamper_rejected(self):
  m=build();next(x for x in nodes(m)if x['role']=='parallel-layer')['language']='invented'
  with self.assertRaisesRegex(Rejected,'PROOF_LANGUAGE'):verify(RAW,m)
 def test_unknown_structure_and_mixed_parallel_text_reject(self):
  for raw in [RAW.replace(b'<cb:tt>',b'<cb:tt>unassigned'),RAW.replace(b'<cb:yin>',b'<cb:UNKNOWN>').replace(b'</cb:yin>',b'</cb:UNKNOWN>')]:
   with self.assertRaises(Rejected):build(raw)
 def test_explicit_between_layer_lb_preserved_not_assigned_as_translation(self):
  raw=RAW.replace(b'</cb:t><cb:t xml:lang="zh-Hant">',b'</cb:t><lb ed="T" n="0001a09"/><cb:t xml:lang="zh-Hant">');m=build(raw);verify(raw,m);tt=next(x for x in nodes(m)if x['role']=='parallel-group');self.assertEqual([x['role']for x in tt['children']],['parallel-layer','line-boundary','parallel-layer','parallel-layer'])
 def test_nonempty_between_layer_lb_rejects(self):
  raw=RAW.replace(b'</cb:t><cb:t xml:lang="zh-Hant">',b'</cb:t><lb>unassigned</lb><cb:t xml:lang="zh-Hant">')
  with self.assertRaisesRegex(Rejected,'NONEMPTY'):build(raw)
 def test_tampered_glyph_mapping_or_presence_rejected(self):
  for field in ['mapping','presence']:
   m=build()
   if field=='mapping':m['glyphDefinitions']['SYNTH']['mappings'][0]['value']='U+4E59'
   else:next(x for x in nodes(m)if x['role']=='glyph-reference')['headerDefinitionPresent']=False
   with self.assertRaises(Rejected):verify(RAW,m)
 def test_envelope_flags_and_schema_fail_closed(self):
  for field,value in [('schema','unknown'),('flattenedBody',True),('productionReady',True),('humanProofread',True),('productionReady',0),('humanProofread',None)]:
   m=build();m[field]=value
   with self.assertRaisesRegex(Rejected,'PROOF_ENVELOPE'):verify(RAW,m)
  m=build();del m['schema']
  with self.assertRaisesRegex(Rejected,'PROOF_ENVELOPE'):verify(RAW,m)
 def test_hash_dtd_entity_and_unscoped_layer_reject(self):
  with self.assertRaisesRegex(Rejected,'HASH'):convert(RAW,'0'*64)
  for raw in [b'<!DOCTYPE x>'+RAW,RAW.replace(b'<cb:tt>',b'<cb:tt><cb:t>bad</cb:t>')]:
   if b'DOCTYPE'in raw:
    with self.assertRaises(Rejected):build(raw)
  with self.assertRaises(Rejected):build(RAW.replace(b'<p>',b'<p><cb:t>bad</cb:t>',1))
if __name__=='__main__':unittest.main()
