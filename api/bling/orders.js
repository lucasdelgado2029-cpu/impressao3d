'use strict';
const c=require('../../lib/bling-core');
const ISO=/^\d{4}-\d{2}-\d{2}$/;
module.exports=async function handler(req,res){
  if(!c.requireMethod(req,res,'GET'))return;
  if(!c.authorizeAdmin(req,res))return;
  const start=req.query.from||new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const end=req.query.to||new Date().toISOString().slice(0,10);
  const page=Number(req.query.page||1);
  if(!ISO.test(start)||!ISO.test(end)||start>end||
    !Number.isInteger(page)||page<1||page>50||
    (Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000>366){
    c.json(res,400,{error:'Informe datas válidas (intervalo máximo de 366 dias) e página de 1 a 50'});return;
  }
  try {
    const params={pagina:page,limite:100,dataInicial:start,dataFinal:end};
    if(process.env.BLING_SHOPEE_ID_LOJA)params.idLoja=process.env.BLING_SHOPEE_ID_LOJA;
    const raw=await c.blingGet('/pedidos/vendas',params);
    c.json(res,200,{data:(Array.isArray(raw.data)?raw.data:[]).map(c.normalizeOrder),pagina:page,
      observacao:'Somente leitura. Para itens e quantidades, consulte cada pedido por ID.'});
  }catch(e){c.reportError(res,e)}
};
