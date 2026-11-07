import hashlib,importlib.util,pathlib,unittest
spec=importlib.util.spec_from_file_location('tei',pathlib.Path(__file__).with_name('tei-reader.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def raw(body,chars='',back=''):
 return ('<TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:cb="http://www.cbeta.org/ns/1.0" xml:id="T01n0001"><teiHeader><fileDesc><titleStmt><title level="m">合成測試</title><author>合成作者</author></titleStmt><extent>2卷</extent><publicationStmt><availability><p>Available for non-commercial use when distributed with this header intact.</p></availability><date>2026-01-01</date></publicationStmt></fileDesc><encodingDesc>'+chars+'</encodingDesc></teiHeader><text><body>'+body+'</body><back>'+back+'</back></text></TEI>').encode()
def convert(b):return m.convert(b,'T/T01/T01n0001.xml',hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),'0'*40)
class Tests(unittest.TestCase):
 def test_provenance_and_whole_header_preserved(self):
  b=raw('<milestone unit="juan" n="1"/><lb ed="T" n="0001a01"/><p>合成原文</p>');d=convert(b);self.assertEqual(d['title'],'合成測試');self.assertEqual(d['lines'][0]['text'],'合成原文');self.assertIn('Available for non-commercial',d['sourceHeaderXml']);self.assertEqual(d['rawSha256'],hashlib.sha256(b).hexdigest());self.assertFalse(d['aiTranslated'])
 def test_versions_juan_lines_toc_and_foreign_not_dropped(self):
  d=convert(raw('<milestone unit="juan" n="1"/><lb ed="T" n="0001a01"/><cb:mulu level="1">目錄標題</cb:mulu><p>甲<foreign>synthetic root</foreign></p><milestone unit="juan" n="2"/><lb ed="T" n="0002a01"/><p>乙</p>'));self.assertEqual([r['juan']for r in d['lines']],['1','2']);self.assertNotIn('目錄標題',d['lines'][0]['text']);self.assertIn('synthetic root',d['lines'][0]['text']);self.assertEqual(d['toc'][0]['title'],'目錄標題')
 def test_original_unicode_glyph_not_normalized_by_guess(self):
  chars='<charDecl><char xml:id="CB1"><mapping type="unicode">U+249B2</mapping></char></charDecl>';d=convert(raw('<lb ed="T" n="0001a01"/><p><g ref="#CB1"/><g ref="#unknown"/></p>',chars));self.assertTrue(d['lines'][0]['text'].startswith(chr(0x249B2)));self.assertIn('缺字 unknown',d['lines'][0]['text']);self.assertIn('unresolved-glyph:unknown',d['qualityWarnings'])
 def test_notes_variants_not_spliced_into_main_text(self):
  d=convert(raw('<lb ed="T" n="0001a01"/><p>正文<anchor xml:id="a1"/><note>原注</note></p>',back='<note target="#a1">異文</note>'));self.assertEqual(d['lines'][0]['text'],'正文');self.assertEqual(d['lines'][0]['anchorIds'],['a1']);self.assertEqual({n['text']for n in d['notes']},{'原注','異文'})
 def test_unhandled_interlinear_is_explicit_not_fake_complete(self):
  d=convert(raw('<lb ed="T" n="0001a01"/><tt><t>甲</t><t>乙</t></tt>'));self.assertIn('inline-tt-requires-review',d['qualityWarnings']);self.assertEqual(d['notes'][0]['kind'],'tt')
 def test_hash_or_external_entity_fail_closed(self):
  with self.assertRaisesRegex(ValueError,'GIT_BLOB'):m.convert(raw('<p>甲</p>'),'T/T01/T01n0001.xml','f'*40,'0'*40)
  b=b'<!DOCTYPE TEI [<!ENTITY x SYSTEM "file:///synthetic-denied">]>'+raw('<p>&x;</p>')
  with self.assertRaisesRegex(ValueError,'DTD_OR_ENTITY'):convert(b)
if __name__=='__main__':unittest.main()
