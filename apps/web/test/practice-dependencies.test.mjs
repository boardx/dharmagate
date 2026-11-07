import test from'node:test';import assert from'node:assert/strict';import{ownedModuleImports}from'../../../tools/cloud-practice/dependencies.mjs';
test('HTTP closure follows actual import declarations, not import words in controls or prose',()=>{const source=`import {a} from './a.mjs';
import{b}from'./b.mjs';
import './setup.mjs';
function update(){ $('confirm-import').disabled=!$('import-history').checked; }
const text='import a backup, not a module';
/*
import './comment.mjs';
*/
// import './also-comment.mjs';`;assert.deepEqual(ownedModuleImports(source),['./a.mjs','./b.mjs','./setup.mjs'])});
