'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const c=require('../lib/bling-core');
const handler=require('../api/bling/callback');
test('Callback OAuth retorna para a página inicial existente', async()=>{
 const saved={safeEqual:c.safeEqual,parseCookies:c.parseCookies,assertSetup:c.assertSetup,exchangeToken:c.exchangeToken,getOrigin:c.getOrigin};
 c.safeEqual=()=>true;c.parseCookies=()=>({bling_oauth_state:'state'});c.assertSetup=()=>{};c.exchangeToken=async()=>({});c.getOrigin=()=> 'https://teste.vercel.app';
 let location='';const res={headers:{},setHeader(k,v){this.headers[k]=v;return this},writeHead(s,h){assert.equal(s,302);location=h.Location;return this},end(){return this},status(n){this.statusCode=n;return this},send(){return this}};
 try{await handler({method:'GET',query:{state:'state',code:'demo'}},res);assert.equal(location,'https://teste.vercel.app/?conectado=1')}
 finally{Object.assign(c,saved)}
});
