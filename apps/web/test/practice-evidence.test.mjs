import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderEvidence} from '../src/practice/evidence.mjs';
const research=JSON.parse(readFileSync(new URL('../data/practice-research.json',import.meta.url),'utf8'));
test('all ten reviewed entries state type, scope and a concrete limitation',()=>{
 assert.equal(research.items.length,10);
 for(const item of research.items){for(const key of ['kind','participants','observation','limitation'])assert.ok(item[key]?.trim(),`${item.title}: ${key}`);assert.notEqual(item.limitation,'未标明')}
 assert.match(research.items[0].kind,/传统说明/);assert.match(research.items[9].kind,/安全聆听指导/);
 for(const index of [4,5,6])assert.match(research.items[index].kind,/系统综述/);
 assert.match(research.items[5].limitation,/不能简单相加/);
 assert.match(research.items[4].participants,/非新增独立参与者/);
 const html=renderEvidence(research);assert.equal((html.match(/class="evidence-study"/g)||[]).length,10);
 assert.equal((html.match(/rel="noopener noreferrer"/g)||[]).length,10);
});
test('escape every supplied text field, summary and URL attribute',()=>{
 const payload='<img src=x onerror="alert(1)">&\'';
 const html=renderEvidence({summary:payload,items:[{title:payload,kind:payload,participants:payload,observation:payload,limitation:payload,note:payload,url:'https://example.org/?q="<tag>&x=1'}]});
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<tag>'));assert.match(html,/&lt;img/);assert.match(html,/&amp;/);assert.match(html,/&#39;/);
 assert.match(html,/&amp;x=1/);
});
test('unsafe source URLs never become clickable links or hide the limitation',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,x','http://example.org','//example.org','https://user:pass@example.org','https://example.org/\npath','not a url',null]){
  const html=renderEvidence({items:[{title:'研究',limitation:'必须保留的局限',url}]});
  assert.ok(!html.includes('href='),String(url));assert.match(html,/必须保留的局限/);assert.match(html,/链接不可用/);
 }
});
test('missing metadata remains explicitly unspecified; malformed entries do not invent findings',()=>{
 for(const research of [undefined,null,{}, {items:'wrong'}, {items:[null,{},'wrong']}])assert.doesNotThrow(()=>renderEvidence(research));
 const html=renderEvidence({items:[{}]});assert.equal((html.match(/<dd>未标明<\/dd>/g)||[]).length,4);assert.match(html,/<p>未标明<\/p>/);
 assert.ok(!html.includes('疗效评级'));
});
