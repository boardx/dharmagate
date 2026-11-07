import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createPracticeApplication} from '../../apps/web/src/practice/application.mjs';
import {createPracticePortalWorker} from '../../apps/web/src/practice-portal.mjs';
const hosts=new Set(['127.0.0.1','::1','localhost','0.0.0.0']);
export async function startPreview({host='127.0.0.1',port=8787}={}){
 if(!hosts.has(host))throw Error('HOST must be a loopback host or explicit 0.0.0.0');
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('PORT must be an integer from 0 to 65535');
 const research=JSON.parse(await readFile(new URL('../../apps/web/data/practice-research.json',import.meta.url),'utf8'));
 const app=createPracticePortalWorker({fetch:async request=>new URL(request.url).pathname==='/'?new Response(null,{status:307,headers:{location:'/practice/timer','cache-control':'no-store'}}):new Response('此预览仅提供静坐与声音应用，不提供全站、账户或后台。',{status:404,headers:{'content-type':'text/plain;charset=utf-8','cache-control':'no-store'}})},{practice:createPracticeApplication({research})});
 const server=createServer(async(req,res)=>{
  try{
   // Use a fixed local origin; incoming Host and absolute targets cannot select a remote origin.
   if(!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);res.end();return}
   const method=req.method||'GET';
   if(!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(method)){res.writeHead(405,{allow:'GET, HEAD'});res.end();return}
   req.resume();
   const request=new Request(new URL(req.url,'http://127.0.0.1'),{method,headers:req.headers});
   const response=await app.fetch(request,{},{});
   res.writeHead(response.status,Object.fromEntries(response.headers));
   if(method==='HEAD'){res.end();return}
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch{if(!res.headersSent)res.writeHead(500,{'content-type':'text/plain;charset=utf-8','cache-control':'no-store'});res.end('本地预览请求失败。')}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve()})});
 const address=server.address(),urlHost=host==='::1'?'[::1]':host==='0.0.0.0'?'127.0.0.1':host;
 return {server,url:'http://'+urlHost+':'+address.port,host,port:address.port,async close(){await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections()})}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const preview=await startPreview({host:process.env.HOST||'127.0.0.1',port:process.env.PORT===undefined?8787:Number(process.env.PORT)});
 console.log(JSON.stringify({preview:preview.url+'/practice/timer',host:preview.host,scope:'practice-only',noProductionServices:true}));
 let closing=false;for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{if(closing)return;closing=true;preview.close().then(()=>{process.exitCode=0}).catch(error=>{console.error(error.message);process.exitCode=1})});
}
