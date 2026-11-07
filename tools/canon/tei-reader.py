"""Offline CBETA TEI reading-view conversion. No network, AI, translation or implicit discovery.
Original XML/header always retained separately. Unresolved glyphs/structures remain explicit.
"""
import hashlib,json,re,xml.etree.ElementTree as ET
NS={'t':'http://www.tei-c.org/ns/1.0'}
XMLID='{http://www.w3.org/XML/1998/namespace}id'
def local(tag):return tag.split('}')[-1]
def text(node):return ''.join(node.itertext()).strip() if node is not None else ''

def convert(raw,source_path,git_blob,commit):
    if b'<!DOCTYPE' in raw or b'<!ENTITY' in raw:raise ValueError('DTD_OR_ENTITY_DENIED')
    actual=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    if actual!=git_blob:raise ValueError('GIT_BLOB_MISMATCH')
    root=ET.fromstring(raw);header=root.find('t:teiHeader',NS);body=root.find('t:text/t:body',NS)
    if header is None or body is None:raise ValueError('TEI_HEADER_AND_BODY_REQUIRED')
    unit=root.attrib[XMLID];canon=source_path.split('/')[0];title=text(header.find("t:fileDesc/t:titleStmt/t:title[@level='m']",NS));authors=[text(x)for x in header.findall('t:fileDesc/t:titleStmt/t:author',NS)]
    if not title:raise ValueError('PUBLISHER_TITLE_REQUIRED')
    original_header=raw.decode('utf-8').split('<teiHeader>',1)[1].split('</teiHeader>',1)[0]
    glyphs={};glyph_descriptions={}
    for char in header.findall('.//t:char',NS):
        cid=char.attrib.get(XMLID)
        if not cid:continue
        mapping=char.find("t:mapping[@type='unicode']",NS)
        if mapping is not None and re.fullmatch(r'(?:U\+[0-9A-Fa-f]+\s*)+',text(mapping)):
            glyphs[cid]=''.join(chr(int(x,16))for x in re.findall(r'U\+([0-9A-Fa-f]+)',text(mapping)))
        for prop in char.findall('t:charProp',NS):
            if text(prop.find('t:localName',NS))=='composition':glyph_descriptions[cid]=text(prop.find('t:value',NS))
    lines=[];toc=[];notes=[];warnings=set();current=[];anchors=[];juan='0';locator='front';serial=0;locseen={}
    def emit(value):
        if not value:return
        if value.isspace():return
        # XML pretty-print newlines are not manuscript line breaks; lb/l/cell drive layout.
        current.append(value.replace('\r','').replace('\n','').replace('\t',''))
    def flush():
        nonlocal current,anchors,serial
        value=''.join(current)
        if value.strip() or anchors:
            serial+=1;key=unit+':'+locator;locseen[key]=locseen.get(key,0)+1
            if locseen[key]>1:key+='.'+str(locseen[key])
            lines.append(dict(id=key,locator=locator,juan=juan,text=value,anchorIds=anchors))
        current=[];anchors=[]
    def walk(node):
        nonlocal juan,locator
        tag=local(node.tag)
        if tag=='mulu':
            toc.append(dict(title=text(node),level=node.attrib.get('level'),juan=juan,locator=locator));return
        if tag in ['note','app','tt']:
            notes.append(dict(kind=tag,attributes=dict(node.attrib),xml=ET.tostring(node,encoding='unicode'),text=text(node),locator=locator,juan=juan))
            if tag!='note':warnings.add('inline-'+tag+'-requires-review');emit('〔原文'+tag+'結構見校注〕')
            return
        if tag=='lb':
            if node.attrib.get('ed',canon)==canon:
                flush();locator=node.attrib.get('n',locator)
            return
        if tag=='pb':return
        if tag=='milestone':
            if node.attrib.get('unit')=='juan':flush();juan=node.attrib.get('n','unknown');locator='juan-'+juan
            return
        if tag=='anchor':
            aid=node.attrib.get(XMLID)
            if aid:anchors.append(aid)
            return
        if tag=='g':
            cid=node.attrib.get('ref','').lstrip('#')
            if node.text:emit(node.text)
            elif cid in glyphs:emit(glyphs[cid])
            else:emit('〔缺字 '+cid+' '+glyph_descriptions.get(cid,'')+'〕');warnings.add('unresolved-glyph:'+cid)
            return
        if tag in ['graphic','figure']:
            notes.append(dict(kind=tag,attributes=dict(node.attrib),xml=ET.tostring(node,encoding='unicode'),text=text(node),locator=locator,juan=juan));emit('〔原版圖像見來源；未在此複製〕');warnings.add('figure-not-reproduced');return
        if tag=='choice':
            chosen=node.find('t:corr',NS)
            if chosen is None:chosen=node.find('t:reg',NS)
            if chosen is None:warnings.add('unresolved-choice');emit('〔原文異讀待核〕')
            else:walk(chosen)
            notes.append(dict(kind='choice',xml=ET.tostring(node,encoding='unicode'),locator=locator,juan=juan));return
        if tag in ['space','caesura']:
            quantity=node.attrib.get('quantity','1');current.append('　'*min(8,int(quantity)if quantity.isdigit()else 1));return
        if tag=='gap':emit('〔原文缺損〕');warnings.add('source-gap');return
        if tag in ['ref','ptr'] and (node.attrib.get('target')or node.attrib.get('cRef')):
            notes.append(dict(kind='reference',attributes=dict(node.attrib),text=text(node),locator=locator,juan=juan))
        emit(node.text)
        for child in node:
            walk(child);emit(child.tail)
        if tag=='cell':current.append('　')
        if tag in ['l','row']:current.append('\n')
    walk(body);flush()
    back=root.find('t:text/t:back',NS)
    if back is not None:
        for node in back.iter():
            tag=local(node.tag)
            if tag in ['note','app','tt']:
                notes.append(dict(kind='stand-off-'+tag,attributes=dict(node.attrib),xml=ET.tostring(node,encoding='unicode'),text=text(node)))
    if not lines:raise ValueError('EMPTY_READING_VIEW')
    match=re.search(r'n(.+)$',unit);work_id=canon+match.group(1)if match else unit
    return dict(schemaVersion=1,id=unit,workId=work_id,title=title,authors=authors,extent=text(header.find('t:fileDesc/t:extent',NS)),sourcePath=source_path,commit=commit,gitBlob=git_blob,rawSha256=hashlib.sha256(raw).hexdigest(),sourceHeaderXml='<teiHeader>'+original_header+'</teiHeader>',sourceDate=text(header.find('t:fileDesc/t:publicationStmt/t:date',NS)),availability=text(header.find('t:fileDesc/t:publicationStmt/t:availability',NS)),lines=lines,toc=toc,notes=notes,qualityWarnings=sorted(warnings),aiTranslated=False,view='CBETA正文閱讀層；原始XML與完整header另存；校注／異文單列，不拼接為正文',humanAccepted=False)

if __name__=='__main__':
    import argparse,pathlib
    a=argparse.ArgumentParser();a.add_argument('source');a.add_argument('source_path');a.add_argument('git_blob');a.add_argument('commit');a.add_argument('output');x=a.parse_args();raw=pathlib.Path(x.source).read_bytes();d=convert(raw,x.source_path,x.git_blob,x.commit);pathlib.Path(x.output).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:d[k]for k in ['id','title','extent','rawSha256','qualityWarnings']},ensure_ascii=False));print('lines',len(d['lines']),'notes',len(d['notes']))
