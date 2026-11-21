'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const c=require('../lib/bling-core');
test('normalização remove dados pessoais e mantém SKU, quantidade',()=>{
 const o=c.normalizeOrder({id:321,numero:1,contato:{nome:'NOME SECRETO',numeroDocumento:'000'},itens:[{codigo:'SKU123',descricao:'kit',quantidade:4,valor:39.9}]});
 assert.equal(o.id,321);assert.equal(o.itens[0].quantidade,4);assert.equal(o.itens[0].codigo,'SKU123');
 assert.ok(!JSON.stringify(o).includes('NOME SECRETO'));assert.ok(!JSON.stringify(o).includes('000'));
});
test('igualdade constante de state oauth',()=>{assert.equal(c.safeEqual('abc','abc'),true);assert.equal(c.safeEqual('abc','ab'),false);assert.equal(c.safeEqual('',''),false);});
test('criptografia e descriptografia de tokens',()=>{
 process.env.BLING_TOKEN_ENCRYPTION_KEY=require('node:crypto').randomBytes(32).toString('base64');
 const a={access_token:"secret",refresh_token:"other",expiresAt:1234};
 const sealed=c.seal(a);assert.ok(!sealed.includes("secret"));
 assert.deepEqual(c.unseal(sealed),a);
 assert.throws(()=>c.unseal(sealed.slice(0,-6)+"abcdef"));
});
