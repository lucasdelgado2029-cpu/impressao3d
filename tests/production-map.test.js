'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const p=require('../production-map');
test('identifica kits de 4 e 12 peças sem confundir medidas',()=>{
 assert.equal(p.multiplier('Kit para 4 peças'),4);
 assert.equal(p.multiplier('12 Unidades'),12);
 assert.equal(p.multiplier('Cavalinho 18cm x 21,5cm'),1);
 assert.equal(p.multiplier('1 Unidade'),1);
});
test('cria registro estável por pedido e item, sem comprador',()=>{
 const o={id:1234,numero:9,numeroLoja:'SHOPEE1',data:'2026-11-18',situacao:{id:13},
 itens:[{id:87,codigo:'SK-12',descricao:'Kit Cavalinhos 12 peças',quantidade:2,valor:10}],contato:{nome:'DADO PRIVADO',numeroDocumento:'123456789'}};
 const result=p.toProductionRows(o);
 assert.equal(result.length,1);
 assert.deepEqual(result[0],{id:'bling:1234:87',name:'Kit Cavalinhos 12 peças',variation:'',sku:'SK-12',qty:2,pack:12,printed:0,date:'2026-11-18',origin:'Bling/Shopee',blingOrderId:'1234',blingStatus:'[object Object]',blingNumero:'SHOPEE1'});
 assert.ok(!JSON.stringify(result).includes('DADO PRIVADO'));
});
test('não duplica ao sincronizar; mantém contagem de impressos',()=>{
 const r={id:'bling:1234:87',qty:2,printed:8,pack:12};
 const x=p.mergeRows([r],[{...r,printed:0},{id:'bling:1234:88',name:'Ganso',qty:3,pack:1,printed:0}]);
 assert.equal(x.added,1);assert.equal(x.duplicates,1);
 assert.equal(x.records[0].printed,8);assert.equal(x.records.length,2);
});
test('não importa quantidades fracionárias nem itens sem descrição',()=>{
 assert.deepEqual(p.toProductionRows({id:99,itens:[{codigo:'A',descricao:'Cavalo',quantidade:.5}]}),[]);
 assert.deepEqual(p.toProductionRows({id:99,itens:[{quantidade:1}]}),[]);
});
