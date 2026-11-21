'use strict';
const c=require('../../lib/bling-core');
module.exports=async function handler(req,res){
  if(!c.requireMethod(req,res,'GET'))return;
  if(!c.authorizeAdmin(req,res))return;
  const id=String(req.query.id||'');
  if(!/^\d{1,20}$/.test(id)){c.json(res,400,{error:'ID do pedido inválido'});return;}
  try{
    const raw=await c.blingGet(`/pedidos/vendas/${id}`);
    if(!raw.data)throw new Error('Resposta sem dados do pedido');
    if(process.env.BLING_SHOPEE_ID_LOJA && String(raw.data.loja?.id)!==String(process.env.BLING_SHOPEE_ID_LOJA)){
      c.json(res,404,{error:'Pedido não pertence à loja Shopee configurada'});return;
    }
    c.json(res,200,{data:c.normalizeOrder(raw.data)});
  }catch(e){c.reportError(res,e)}
};
