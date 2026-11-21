/* Conversão de itens de pedidos Bling em registros locais do Controle de Produção 3D.
   Este módulo não acessa API, não guarda credenciais e não altera estoque/nota. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.ProductionMap=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function multiplier(value){
    const m=String(value||'').match(/(?:^|[^\d])(\d+)\s*(?:peças?|unidades?|un\b)/i);
    return m ? Math.max(1,Number(m[1])) : 1;
  }
  function toProductionRows(order){
    if(!order || !/^\d+$/.test(String(order.id||'')) || !Array.isArray(order.itens))return [];
    return order.itens.flatMap((it,index)=>{
      const qty=Number(it.quantidade);
      if(!Number.isInteger(qty)||qty<1||qty>100000)return [];
      const name=String(it.descricao||'').trim().slice(0,500);
      if(!name)return [];
      const sku=String(it.codigo||'').trim().slice(0,140);
      const variation=String(it.variacao||'').trim().slice(0,220);
      const itemId=/^\d+$/.test(String(it.id||''))?String(it.id):String(index);
      return [{
        id:`bling:${order.id}:${itemId}`,
        name,variation,sku,qty,
        pack:multiplier(`${variation} ${name}`),printed:0,
        date:/^\d{4}-\d{2}-\d{2}/.test(String(order.data||''))?String(order.data).slice(0,10):new Date().toISOString().slice(0,10),
        origin:'Bling/Shopee',blingOrderId:String(order.id),blingStatus:String(order.situacao??''),
        blingNumero:String(order.numeroLoja||order.numero||'')
      }];
    });
  }
  function mergeRows(existing,incoming){
    const result=Array.isArray(existing)?existing.slice():[];
    const ids=new Set(result.map(r=>String(r.id)));
    let added=0,duplicates=0,invalid=0;
    for(const row of incoming){
      if(!row||!String(row.id||'').startsWith('bling:')||!Number.isInteger(row.qty)||row.qty<1){invalid++;continue;}
      if(ids.has(String(row.id))){duplicates++;continue;}
      result.push({...row});ids.add(String(row.id));added++;
    }
    return {records:result,added,duplicates,invalid};
  }
  return {multiplier,toProductionRows,mergeRows};
});
