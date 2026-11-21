'use strict';
// Integração de leitura com o Bling API v3. Executar SOMENTE no servidor.
const crypto = require('node:crypto');
const API = 'https://api.bling.com.br/Api/v3';
const AUTHORIZE = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const KEY = 'impressao3d:bling:oauth:v1';
const LOCK_KEY = 'impressao3d:bling:refresh:lock:v1';
const SESSION_COOKIE = 'bling_oauth_state';

function assertSetup() {
  const required = ['BLING_CLIENT_ID', 'BLING_CLIENT_SECRET', 'APP_ADMIN_TOKEN', 'APP_PUBLIC_URL',
    'BLING_TOKEN_ENCRYPTION_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  const missing = required.filter(x => !process.env[x]);
  if (missing.length) throw new Error(`Configuração incompleta: ${missing.join(', ')}`);
  const base = new URL(process.env.APP_PUBLIC_URL);
  if (base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash || !/^[-\w.]+$/.test(base.hostname))
    throw new Error('APP_PUBLIC_URL deve ser a origem HTTPS, sem caminhos nem parâmetros');
  const key = Buffer.from(process.env.BLING_TOKEN_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) throw new Error('BLING_TOKEN_ENCRYPTION_KEY precisa ter 32 bytes em base64');
}
function noCache(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}
function json(res, status, body) {
  noCache(res); res.status(status).json(body);
}
function authorizeAdmin(req, res) {
  const raw = String(req.headers.authorization || '');
  const match = raw.match(/^Bearer (.+)$/i);
  const expected = process.env.APP_ADMIN_TOKEN || '';
  const actual = match ? match[1] : '';
  const a = Buffer.from(actual), b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a,b)) {
    json(res, 401, {error: 'Acesso negado. Informe a chave administrativa.'});
    return false;
  }
  return true;
}
function requireMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader('Allow', method);
  json(res, 405, {error: 'Método não permitido'});
  return false;
}
function getOrigin() { return new URL(process.env.APP_PUBLIC_URL).origin; }
function getCallback() { return `${getOrigin()}/api/bling/callback`; }
function cookieState(state) {
  return `${SESSION_COOKIE}=${encodeURIComponent(state)}; HttpOnly; Secure; SameSite=Lax; Path=/api/bling/callback; Max-Age=300`;
}
function clearStateCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api/bling/callback; Max-Age=0`;
}
function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').filter(Boolean).map(v => {
    const i = v.indexOf('=');
    if (i < 0) return [v.trim(), ''];
    return [v.slice(0, i).trim(), decodeURIComponent(v.slice(i+1).trim())];
  }));
}
function safeEqual(x,y) {
  const a=Buffer.from(String(x||'')), b=Buffer.from(String(y||''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a,b);
}
function seal(data) {
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(process.env.BLING_TOKEN_ENCRYPTION_KEY,'base64'),iv);
  const ct=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),ct]).toString('base64');
}
function unseal(str) {
  const buf=Buffer.from(str,'base64');
  if(buf.length<29)throw new Error('Dados OAuth inválidos');
  const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(process.env.BLING_TOKEN_ENCRYPTION_KEY,'base64'),buf.subarray(0,12));
  decipher.setAuthTag(buf.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)),decipher.final()]).toString('utf8'));
}
async function redis(...cmd) {
  const response=await fetch(`${process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/,'')}`, {
    method:'POST', headers:{Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify(cmd), signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Falha no armazenamento seguro (${response.status})`);
  const body=await response.json();
  if (body.error) throw new Error(`Falha no armazenamento seguro: ${body.error}`);
  return body.result;
}
async function loadTokens() {
  const stored=await redis('GET',KEY); return stored ? unseal(stored) : null;
}
async function saveTokens(body) {
  if (!body.access_token || !body.refresh_token) throw new Error('Bling não retornou tokens OAuth completos');
  const obj={access_token:body.access_token,refresh_token:body.refresh_token,
    expiresAt:Date.now()+(Number(body.expires_in)||21600)*1000};
  await redis('SET',KEY,seal(obj)); return obj;
}
async function exchangeToken(grant) {
  const basic=Buffer.from(`${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`).toString('base64');
  const response=await fetch(`${API}/oauth/token`,{
    method:'POST',headers:{Authorization:`Basic ${basic}`,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json','enable-jwt':'1'},
    body:new URLSearchParams(grant),signal:AbortSignal.timeout(12000)
  });
  const body=await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(`Bling recusou a autorização OAuth (${response.status}); revise as credenciais/permissões`);
  return saveTokens(body);
}
async function getAccessToken() {
  assertSetup();
  let tokens=await loadTokens();
  if (!tokens) throw new Error('Bling ainda não autorizado. Abra a página principal do Controle de Produção 3D e conecte sua conta.');
  if (tokens.expiresAt-Date.now()>120000) return tokens.access_token;
  // Exclusão mútua por Redis: previne uso simultâneo de refresh tokens rotativos.
  const nonce=crypto.randomUUID();
  const lock=await redis('SET',LOCK_KEY,nonce,'NX','EX',15);
  if(lock==='OK') {
    try {
      tokens=await loadTokens();
      if (tokens.expiresAt-Date.now()>120000) return tokens.access_token;
      tokens=await exchangeToken({grant_type:'refresh_token',refresh_token:tokens.refresh_token});
      return tokens.access_token;
    } finally {
      await redis('EVAL',"if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",1,LOCK_KEY,nonce).catch(()=>{});
    }
  }
  // Outra função está atualizando o token; espere sua gravação.
  for(let n=0;n<16;n++) {
    await new Promise(r=>setTimeout(r,400));
    tokens=await loadTokens();
    if(tokens && tokens.expiresAt-Date.now()>120000)return tokens.access_token;
  }
  throw new Error('Atualização OAuth ocupada; tente novamente');
}
async function blingGet(path, params={}) {
  // Somente GET e somente caminhos da lista permitida.
  if(!(/^\/pedidos\/vendas$/.test(path) || /^\/pedidos\/vendas\/\d+$/.test(path)))
    throw new Error('Endpoint não permitido nesta integração de leitura');
  const url=new URL(API+path);
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined && v!==null && v!=='') url.searchParams.set(k,String(v));});
  const token=await getAccessToken();
  const response=await fetch(url,{method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json','enable-jwt':'1'},signal:AbortSignal.timeout(12000)});
  if(!response.ok) {
    if(response.status===429)throw new Error('Bling atingiu temporariamente o limite de consultas (429); tente mais tarde');
    throw new Error(`Falha ao consultar pedidos no Bling (${response.status})`);
  }
  return response.json();
}
function normalizeOrder(order) {
  return {
    id:order.id,numero:order.numero,numeroLoja:order.numeroLoja||null,
    data:order.data||null,dataPrevista:order.dataPrevista||null,
    total:order.total??null, situacao:order.situacao?.id??null,
    idLoja:order.loja?.id??null,
    itens:(Array.isArray(order.itens)?order.itens:[]).map(item=>({
      id:item.id??null,codigo:String(item.codigo||''),descricao:String(item.descricao||''),
      quantidade:Number(item.quantidade)||0,valor:Number(item.valor)||0,
      unidade:item.unidade||''
    }))
  };
}
function reportError(res, error) {
  // Não vazar dados OAuth, URLs ou stacks de erro ao navegador.
  console.error('Bling integration:',error.message);
  json(res,500,{error:/(Configuração incompleta|APP_PUBLIC_URL|BLING_TOKEN_ENCRYPTION_KEY)/.test(error.message)
    ?'Integração ainda não configurada na Vercel'
    :/Bling ainda não autorizado/.test(error.message)?'Conta Bling ainda não autorizada':
    /limite de consultas/.test(error.message)?'Limite de consultas do Bling; tente mais tarde':
    'Não foi possível consultar o Bling agora'});
}
module.exports={assertSetup,authorizeAdmin,requireMethod,json,getOrigin,getCallback,cookieState,clearStateCookie,
  SESSION_COOKIE,parseCookies,safeEqual,seal,unseal,redis,loadTokens,saveTokens,exchangeToken,blingGet,normalizeOrder,
  reportError,AUTHORIZE};
