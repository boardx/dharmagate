"""Private build-time candidate. No network or translation. Never a flattened reading model.
Provenance paths identify parsed XML nodes/text slots, NOT raw byte offsets. XML entity
spelling and line-ending normalization are covered by the separately retained raw hash.
"""
import hashlib,re,xml.etree.ElementTree as ET
TEI='http://www.tei-c.org/ns/1.0';CB='http://www.cbeta.org/ns/1.0';XML='http://www.w3.org/XML/1998/namespace'
TAGS={TEI:set('text front body back p l lg head title byline milestone lb pb anchor g note app lem rdg choice corr sic reg orig abbr expan space caesura figure graphic item list term foreign unclear gap ref ptr hi seg'.split()),CB:set('tt t yin zi sg mulu jhead juan div docNumber'.split())}
ROLES={'tt':'parallel-group','t':'parallel-layer','note':'annotation','app':'apparatus','lem':'lemma-variant','rdg':'reading-variant','choice':'editorial-alternatives','g':'glyph-reference','lb':'line-boundary','pb':'page-boundary','milestone':'milestone','yin':'phonetic-component','zi':'glyph-component','sg':'parenthetic-component','anchor':'anchor','figure':'figure-not-reproduced','graphic':'graphic-reference-not-fetched'}
class Rejected(ValueError):pass
def digest(b):return hashlib.sha256(b).hexdigest()
def split(tag):
 if not isinstance(tag,str)or not tag.startswith('{'):raise Rejected('UNQUALIFIED_ELEMENT')
 return tag[1:].split('}',1)
def parse(raw):
 if len(raw)>32_000_000 or re.search(br'<!DOCTYPE|<!ENTITY',raw,re.I):raise Rejected('XML_DECLARATION_OR_SIZE')
 return ET.fromstring(raw)
def convert(raw,expected_sha256):
 if digest(raw)!=expected_sha256:raise Rejected('INPUT_HASH_MISMATCH')
 root=parse(raw);header=root.find('{'+TEI+'}teiHeader');text=root.find('{'+TEI+'}text')
 if root.tag!='{'+TEI+'}TEI'or header is None or text is None:raise Rejected('TEI_HEADER_TEXT_REQUIRED')
 unit=root.attrib.get('{'+XML+'}id');canon=re.match(r'^[A-Z]+',unit or '')
 if not canon:raise Rejected('UNIT_REQUIRED')
 canon=canon.group();glyphs={};atoms=[];events=[];paths=set();preceding_lb=None;juan='0';node_count=0
 for char in header.findall('.//{'+TEI+'}char'):
  cid=char.attrib.get('{'+XML+'}id')
  if cid:
   if cid in glyphs:raise Rejected('DUPLICATE_GLYPH_ID')
   glyphs[cid]={'xml':ET.tostring(char,encoding='unicode'),'mappings':[{'type':m.attrib.get('type'),'value':''.join(m.itertext())}for m in char.findall('{'+TEI+'}mapping')]}
 def atom(value,path):
  if value is None:return None
  a={'path':path,'value':value,'sha256':digest(value.encode()),'charStart':0,'charEnd':len(value),'precedingSourceLb':preceding_lb,'sourceJuan':juan};atoms.append(a);return a
 def walk(el,path,depth=0,parent_tag=None):
  nonlocal preceding_lb,juan,node_count
  if depth>100:raise Rejected('DEPTH_LIMIT')
  ns,name=split(el.tag)
  if ns not in TAGS or name not in TAGS[ns]:raise Rejected('UNSUPPORTED_ELEMENT:'+el.tag)
  if path in paths:raise Rejected('DUPLICATE_PATH')
  paths.add(path);node_count+=1
  if ns==CB and name=='tt':
   children=list(el)
   layers=[c for c in children if c.tag=='{'+CB+'}t']
   boundaries=[c for c in children if c.tag=='{'+TEI+'}lb']
   if not 2<=len(layers)<=8 or len(children)>16 or len(layers)+len(boundaries)!=len(children):raise Rejected('UNSUPPORTED_PARALLEL_LAYERS:'+path)
   if any(len(c)or c.text and c.text.strip()for c in boundaries):raise Rejected('NONEMPTY_PARALLEL_BOUNDARY:'+path)
   if el.text and el.text.strip()or any(c.tail and c.tail.strip()for c in children):raise Rejected('UNASSIGNED_PARALLEL_TEXT:'+path)
  if ns==CB and name=='t'and parent_tag!='{'+CB+'}tt':raise Rejected('LAYER_WITHOUT_GROUP')
  if name=='app':
   if any(split(c.tag)[1]not in ['lem','rdg']for c in el)or sum(split(c.tag)[1]=='lem'for c in el)!=1:raise Rejected('UNSUPPORTED_APPARATUS:'+path)
  if name=='choice':
   if len(el)<2 or any(split(c.tag)[1]not in ['corr','sic','reg','orig','abbr','expan']for c in el):raise Rejected('UNSUPPORTED_CHOICE:'+path)
  if name=='lb':
   event={'path':path,'kind':'lb','attributes':dict(el.attrib)};events.append(event)
   if el.attrib.get('ed',canon)==canon:preceding_lb=path
  if name=='milestone'and el.attrib.get('unit')=='juan':juan=el.attrib.get('n','unknown');events.append({'path':path,'kind':'juan','attributes':dict(el.attrib)})
  out={'path':path,'qname':el.tag,'attributes':dict(el.attrib),'role':ROLES.get(name,'source-structure'),'text':atom(el.text,path+'/#text'),'children':[]}
  if name=='tt':out['alignment']='source-order-only-no-word-equivalence-inferred'
  if name=='t':out['language']=el.attrib.get('{'+XML+'}lang');out['languageVerified']=False
  if name=='g':
   ref=el.attrib.get('ref','');out['glyphRef']=ref;out['headerDefinitionPresent']=ref.lstrip('#')in glyphs;out['unicodeRenderingVerified']=False
  for i,child in enumerate(el):
   node=walk(child,path+'/'+str(i),depth+1,el.tag);node['tail']=atom(child.tail,node['path']+'/#tail');out['children'].append(node)
  return out
 model={'schema':'dharmagate-structured-tei-candidate-v2','sourceSha256':expected_sha256,'unit':unit,'text':walk(text,'/text'),'glyphDefinitions':glyphs,'sourceHeaderXml':ET.tostring(header,encoding='unicode'),'sourceAtoms':atoms,'sourceEvents':events,'nodeCount':node_count,'flattenedBody':False,'productionReady':False,'humanProofread':False}
 return model

def verify(raw,model):
 """Independent walk compares every qname/attribute/text/tail/path, not string lengths.
 Does not reuse convert()/walk(). Missing/reordered/altered model nodes must reject.
 """
 if not isinstance(model,dict)or model.get('schema')!='dharmagate-structured-tei-candidate-v2'or any(model.get(k)is not False for k in ['flattenedBody','productionReady','humanProofread']):raise Rejected('PROOF_ENVELOPE')
 if digest(raw)!=model.get('sourceSha256'):raise Rejected('PROOF_INPUT_HASH')
 root=parse(raw)
 if model.get('unit')!=root.attrib.get('{'+XML+'}id'):raise Rejected('PROOF_UNIT')
 original=root.find('{'+TEI+'}text');header=root.find('{'+TEI+'}teiHeader');expected_atoms={};expected_events=[];lb=None;juan='0';canon=re.match(r'^[A-Z]+',model['unit']).group();nodes=0
 def compare(el,node,path):
  nonlocal nodes,lb,juan
  nodes+=1
  if node.get('path')!=path or node.get('qname')!=el.tag or node.get('attributes')!=dict(el.attrib):raise Rejected('PROOF_NODE:'+path)
  name=split(el.tag)[1]
  if node.get('role')!=ROLES.get(name,'source-structure'):raise Rejected('PROOF_ROLE:'+path)
  if name=='tt'and node.get('alignment')!='source-order-only-no-word-equivalence-inferred':raise Rejected('PROOF_ALIGNMENT:'+path)
  if name=='t'and(node.get('language')!=el.attrib.get('{'+XML+'}lang')or node.get('languageVerified')is not False):raise Rejected('PROOF_LANGUAGE:'+path)
  if name=='g'and(node.get('glyphRef')!=el.attrib.get('ref','')or node.get('unicodeRenderingVerified')is not False):raise Rejected('PROOF_GLYPH_ROLE:'+path)
  if name=='lb':
   expected_events.append({'path':path,'kind':'lb','attributes':dict(el.attrib)})
   if el.attrib.get('ed',canon)==canon:lb=path
  if name=='milestone'and el.attrib.get('unit')=='juan':juan=el.attrib.get('n','unknown');expected_events.append({'path':path,'kind':'juan','attributes':dict(el.attrib)})
  def check(value,stored,slot):
   if value is None:
    if stored is not None:raise Rejected('PROOF_EXTRA_TEXT:'+slot)
    return
   expected={'path':slot,'value':value,'sha256':digest(value.encode()),'charStart':0,'charEnd':len(value),'precedingSourceLb':lb,'sourceJuan':juan}
   if stored!=expected:raise Rejected('PROOF_TEXT:'+slot)
   expected_atoms[slot]=expected
  check(el.text,node.get('text'),path+'/#text')
  if len(el)!=len(node.get('children',[])):raise Rejected('PROOF_CHILD_COUNT:'+path)
  for i,(child,other)in enumerate(zip(el,node['children'])):
   childpath=path+'/'+str(i);compare(child,other,childpath);check(child.tail,other.get('tail'),childpath+'/#tail')
 compare(original,model['text'],'/text')
 if nodes!=model.get('nodeCount')or model.get('sourceAtoms')!=list(expected_atoms.values())or model.get('sourceEvents')!=expected_events:raise Rejected('PROOF_LEDGER')
 if model.get('sourceHeaderXml')!=ET.tostring(header,encoding='unicode'):raise Rejected('PROOF_HEADER')
 definitions={x.attrib.get('{'+XML+'}id'):ET.tostring(x,encoding='unicode')for x in header.findall('.//{'+TEI+'}char')if x.attrib.get('{'+XML+'}id')}
 if set(definitions)!=set(model['glyphDefinitions'])or any(model['glyphDefinitions'][k]['xml']!=v for k,v in definitions.items()):raise Rejected('PROOF_GLYPHS')
 for char in header.findall('.//{'+TEI+'}char'):
  cid=char.attrib.get('{'+XML+'}id')
  if cid and model['glyphDefinitions'][cid]['mappings']!=[{'type':m.attrib.get('type'),'value':''.join(m.itertext())}for m in char.findall('{'+TEI+'}mapping')]:raise Rejected('PROOF_GLYPH_MAPPINGS')
 for node in _all_model_nodes(model['text']):
  if node.get('role')=='glyph-reference'and node.get('headerDefinitionPresent')!=(node['glyphRef'].lstrip('#')in definitions):raise Rejected('PROOF_GLYPH_PRESENCE')
 return {'inputSha256':digest(raw),'xmlNodesVerified':nodes,'textSlotsVerified':len(expected_atoms),'sourceBoundaryEventsVerified':len(expected_events),'exactParsedTextAndTailEquality':True,'rawByteOffsetsClaimed':False,'flattenedBody':False}

def _all_model_nodes(node):
 yield node
 for child in node['children']:yield from _all_model_nodes(child)
