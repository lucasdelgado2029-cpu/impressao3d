'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const c=require('../lib/bling-core');

test('OAuth usa JWT; armazenamento é criptografado; apenas GET de pedidos é permitido',async()=>{
 const old={...process.env};
 const oldFetch=global.fetch;
 const saved=new Map();
 const calls=[];
 Object.assign(process.env,{
  BLING_CLIENT_ID:'demo-id',BLING_CLIENT_SECRET:'demo-secret',APP_ADMIN_TOKEN:'a'.repeat(64),
  APP_PUBLIC_URL:'https://impressao3d-rho.vercel.app',
  BLING_TOKEN_ENCRYPTION_KEY:crypto.randomBytes(32).toString('base64'),
  UPSTASH_REDIS_REST_URL:'https://redis.test',UPSTASH_REDIS_REST_TOKEN:'demo-redis-token'
 });
 try{
  global.fetch=async (url,opts)=>{
   calls.push({url:String(url),method:opts.method,headers:opts.headers});
   if(String(url).endsWith('/oauth/token'))return {ok:true,status:200,json:async()=>({access_token:'example-long-jwt',refresh_token:'example-refresh',expires_in:3600})};
   if(String(url).includes('redis.test')){
    const cmd=JSON.parse(opts.body),op=cmd[0];
    if(op==='SET'){saved.set(cmd[1],cmd[2]);return {ok:true,json:async()=>({result:'OK'})};}
    if(op==='GET')return {ok:true,json:async()=>({result:saved.get(cmd[1])||null})};
    return {ok:true,json:async()=>({result:null})};
   }
   if(String(url).includes('pedidos/vendas'))return {ok:true,status:200,json:async()=>({data:[{id:123}]})};
   throw Error('unexpected URL '+url);
  };
  await c.exchangeToken({grant_type:'authorization_code',code:'demo-code'});
  const oauthCall=calls.find(x=>x.url.endsWith('/oauth/token'));
  assert.equal(oauthCall.headers['enable-jwt'],'1');
  const blob=[...saved.values()][0];
  assert.ok(!blob.includes('example-long-jwt'));
  assert.ok(!blob.includes('example-refresh'));
  const r=await c.blingGet('/pedidos/vendas',{pagina:1});
  assert.equal(r.data[0].id,123);
  const getCall=calls.find(x=>x.url.includes('/pedidos/vendas'));
  assert.equal(getCall.method,'GET');
  assert.equal(getCall.headers['enable-jwt'],'1');
  assert.equal(getCall.headers.Authorization,'Bearer example-long-jwt');
  await assert.rejects(()=>c.blingGet('/estoques'),/não permitido/);
  await assert.rejects(()=>c.blingGet('/pedidos/vendas/123/cancelar'),/não permitido/);
 }finally{
  global.fetch=oldFetch;
  for(const k of Object.keys(process.env)) if(!(k in old))delete process.env[k];
  Object.assign(process.env,old);
 }
});
