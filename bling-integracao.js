/* Integração front-end: nenhum token OAuth, Client Secret ou credencial do Bling aqui.
   Chave APP_ADMIN_TOKEN digitada pelo usuário permanece somente em memória da aba. */
(()=>{
 'use strict';
 const el=id=>document.getElementById(id);
 const day=86400000;
 const date=(ts)=>{const d=new Date(ts);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
 el('blingTo').value=date(Date.now());
 el('blingFrom').value=date(Date.now()-30*day);
 let orders=[];
 let busy=false;
 let timer=null;
 let storeFilterActive=false;
 const MESSAGE=el('blingMessage');
 function say(message,error=false){MESSAGE.textContent=message;MESSAGE.style.color=error?'#9c5149':'#687b69'}
 function fmtMoney(n){return typeof n==='number'?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—'}
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function api(path,opts={}){
  const key=el('blingKey').value.trim();
  if(!key)throw new Error('Informe a chave administrativa criada nas variáveis da Vercel.');
  const response=await fetch(path,{...opts,cache:'no-store',credentials:'same-origin',headers:{...opts.headers,Authorization:`Bearer ${key}`}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`Erro HTTP ${response.status}`);
  return data;
 }
 function checkedIds(){return [...document.querySelectorAll('#blingOrders input[type="checkbox"]:checked')].map(e=>e.value)}
 function render(){
  const tbody=el('blingOrders');tbody.replaceChildren();
  el('blingAll').checked=false;
  if(!orders.length){const r=document.createElement('tr');const c=document.createElement('td');c.colSpan=7;c.className='empty';c.textContent='Nenhum pedido para o período ou página selecionada.';r.appendChild(c);tbody.appendChild(r);el('blingImportBtn').disabled=true;return;}
  for(const order of orders){
   const row=document.createElement('tr');
   const choose=document.createElement('td');const check=document.createElement('input');check.type='checkbox';check.value=String(order.id);check.setAttribute('aria-label',`Selecionar pedido ${order.numero||order.id}`);choose.appendChild(check);row.appendChild(choose);
   for(const value of [order.numero||order.id,order.numeroLoja||'—',order.data||'—',fmtMoney(order.total),order.situacao??'—',order.idLoja??'—']){
    const cell=document.createElement('td');cell.textContent=String(value);row.appendChild(cell);
   }
   tbody.appendChild(row);
  }
  el('blingImportBtn').disabled=false;
 }
 function params(){
  const from=el('blingFrom').value,to=el('blingTo').value,page=el('blingPage').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw new Error('Informe um intervalo de datas válido.');
  return new URLSearchParams({from,to,page}).toString();
 }
 async function loadOrders(silent=false){
  if(busy)return;
  busy=true;
  if(!silent)say('Consultando pedidos no Bling…');
  try{
   const response=await api('/api/bling/orders?'+params());
   orders=response.data||[];render();
   if(!silent)say(`${orders.length} pedido(s) nesta página. Confira a situação no Bling antes de importar para produção.`);
  }catch(err){if(!silent)say(err.message,true);throw err}
  finally{busy=false}
 }
 async function importOrders(selected,{silent=false}={}){
  const toImport=orders.filter(o=>selected.includes(String(o.id)));
  if(!toImport.length){if(!silent)say('Marque ao menos um pedido na tabela.',true);return}
  let added=0,duplicates=0,invalid=0,failures=0;
  for(let i=0;i<toImport.length;i++){
    const order=toImport[i];
    try{
      const d=await api('/api/bling/order?id='+encodeURIComponent(order.id));
      // Server validates data origin. Read-only conversion leaves printed quantities untouched.
      const result=window.importBlingProductionRows([d.data]);
      added+=result.added;duplicates+=result.duplicates;invalid+=result.invalid;
    }catch(e){failures++;console.warn('Falha ao consultar item do pedido',order.id,e.message)}
    if(i<toImport.length-1)await pause(500); // Bling: limite 3 req/s
  }
  say(`${added} item(ns) incluído(s) na produção, ${duplicates} já existente(s) (não duplicados), ${invalid} inválido(s), ${failures} pedido(s) não consultado(s).${failures?' Revise as falhas antes de prosseguir.':''}`,failures>0);
 }
 el('blingLoadBtn').addEventListener('click',()=>loadOrders().catch(()=>{}));
 el('blingAll').addEventListener('change',e=>{document.querySelectorAll('#blingOrders input[type="checkbox"]').forEach(input=>input.checked=e.target.checked)});
 el('blingStatusBtn').addEventListener('click',async()=>{
  say('Verificando conexão…');
  try{
    const result=await api('/api/bling/status');
    storeFilterActive=!!result.lojaFiltrada;
    say(result.autorizado?'Conta Bling autorizada. '+(storeFilterActive?'Filtro de loja ativado.':'Atenção: filtro de loja não configurado; não ative importação automática até configurar BLING_SHOPEE_ID_LOJA.'):'Aplicativo ainda não autorizado; clique em Autorizar Bling.');
  }catch(e){say(e.message,true)}
 });
 el('blingConnectBtn').addEventListener('click',async()=>{
  say('Iniciando autorização…');
  try{const data=await api('/api/bling/start',{method:'POST'});location.assign(data.authorizeUrl)}catch(e){say(e.message,true)}
 });
 el('blingImportBtn').addEventListener('click',async()=>{
  if(busy)return;
  const ids=checkedIds();if(!ids.length){say('Selecione um ou mais pedidos.',true);return;}
  if(!confirm(`Importar ${ids.length} pedido(s) selecionado(s) para produção? Confirme que estão pagos/prontos para envio na Shopee/Bling. Isso não altera os pedidos no Bling.`))return;
  busy=true;el('blingImportBtn').disabled=true;say('Buscando detalhes e adicionando à produção…');
  try{await importOrders(ids)}finally{busy=false;el('blingImportBtn').disabled=false}
 });
 const SETTING='prod3d_bling_auto_v1';
 let options={enabled:false,ids:[]};
 try{const saved=JSON.parse(localStorage.getItem(SETTING)||'null');if(saved&&Array.isArray(saved.ids)){options={enabled:!!saved.enabled,ids:saved.ids.filter(v=>/^\d+$/.test(String(v))).map(String)}}}catch(e){}
 el('blingAllowed').value=options.ids.join(', ');el('blingAuto').checked=options.enabled;
 function parseAllowed(){
  const txt=el('blingAllowed').value.trim();if(!txt)return [];
  const parts=txt.split(',').map(x=>x.trim());
  if(parts.length>30||parts.some(x=>!/^\d+$/.test(x)))throw new Error('Informe IDs numéricos das situações, separados por vírgulas.');
  return [...new Set(parts)];
 }
 function persistOptions(){
  try{
   const ids=parseAllowed();
   if(el('blingAuto').checked&&!ids.length)throw new Error('Informe ao menos um ID de situação aprovado antes de ativar a importação automática.');
   if(el('blingAuto').checked&&!storeFilterActive)throw new Error('Primeiro configure BLING_SHOPEE_ID_LOJA na Vercel e clique em Verificar conexão, para não importar pedidos de outras lojas.');
   if(el('blingAuto').checked&&!confirm('Confirmo que conferi estes IDs no Bling e que são apenas situações PAGAS/prontas para produção. A importação ocorrerá enquanto a aba estiver aberta.')){el('blingAuto').checked=false;return;}
   options={enabled:el('blingAuto').checked,ids};localStorage.setItem(SETTING,JSON.stringify(options));
   say(options.enabled?'Atualização automática configurada. Digite a chave e clique em Consultar pedidos para iniciar esta sessão.':'Atualização automática desativada.');
  }catch(e){el('blingAuto').checked=false;options.enabled=false;say(e.message,true)}
 }
 el('blingAllowed').addEventListener('change',()=>{
  try{options.ids=parseAllowed();options.enabled=false;el('blingAuto').checked=false;localStorage.setItem(SETTING,JSON.stringify(options));say('Lista de situações alterada. Ative novamente a atualização automática se desejar.')}catch(e){say(e.message,true)}
 });
 el('blingAuto').addEventListener('change',persistOptions);
 async function automaticTick(){
  if(!options.enabled || busy || !el('blingKey').value.trim() || !storeFilterActive)return;
  try{
   // Consulta página 1 no período selecionado. Não atualiza enquanto o site estiver fechado.
   await loadOrders(true);
   const ids=orders.filter(p=>options.ids.includes(String(p.situacao))&&!window.hasBlingOrder(p.id)).map(p=>String(p.id));
   if(ids.length){say(`Verificando ${ids.length} pedido(s) com situações aprovadas…`);await importOrders(ids,{silent:true})}
  }catch(e){say('Atualização automática: '+e.message,true)}
 }
 timer=setInterval(automaticTick,5*60*1000);
 // Ao liberar a página, o usuário faz uma consulta voluntária; atualizações seguintes são automáticas.
 if(new URLSearchParams(location.search).has('conectado')){
  history.replaceState(null,'',location.pathname+location.hash);
  say('Bling autorizado. Digite novamente sua chave administrativa e consulte os pedidos.');
 }
})();
