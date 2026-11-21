'use strict';
const c=require('../../lib/bling-core');
module.exports=async function handler(req,res){
  if(!c.requireMethod(req,res,'GET'))return;
  if(!c.authorizeAdmin(req,res))return;
  try{
    c.assertSetup();
    const tokens=await c.loadTokens();
    c.json(res,200,{configurado:true,autorizado:!!tokens,consultasSomenteLeitura:true,lojaFiltrada:!!process.env.BLING_SHOPEE_ID_LOJA});
  }catch(e){c.reportError(res,e)}
};
