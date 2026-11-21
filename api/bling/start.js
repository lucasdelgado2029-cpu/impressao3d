'use strict';
const crypto=require('node:crypto');
const c=require('../../lib/bling-core');
module.exports=async function handler(req,res){
  if(!c.requireMethod(req,res,'POST'))return;
  if(!c.authorizeAdmin(req,res))return;
  try {
    c.assertSetup();
    const state=crypto.randomBytes(32).toString('hex');
    const url=new URL(c.AUTHORIZE);
    url.search=new URLSearchParams({response_type:'code',client_id:process.env.BLING_CLIENT_ID,state}).toString();
    res.setHeader('Set-Cookie',c.cookieState(state));
    c.json(res,200,{authorizeUrl:url.href});
  }catch(e){c.reportError(res,e)}
};
