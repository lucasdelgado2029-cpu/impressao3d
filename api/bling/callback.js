'use strict';
const c=require('../../lib/bling-core');
module.exports=async function handler(req,res){
  if(!c.requireMethod(req,res,'GET'))return;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Set-Cookie',c.clearStateCookie());
  const state=String(req.query.state||'');
  const code=String(req.query.code||'');
  const saved=c.parseCookies(req)[c.SESSION_COOKIE];
  if(!c.safeEqual(state,saved)||!code){res.status(400).send('Autorização cancelada ou estado OAuth inválido. Reinicie no painel.');return;}
  try{
    c.assertSetup();
    await c.exchangeToken({grant_type:'authorization_code',code});
    res.writeHead(302,{Location:`${c.getOrigin()}/?conectado=1`}).end();
  }catch(e){console.error('Bling OAuth callback:',e.message);res.status(502).send('Não foi possível concluir a autorização Bling. Revise as configurações e tente novamente.');}
};
