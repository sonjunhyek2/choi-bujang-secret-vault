import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectAssaultReport} from '../src/assault-report.mjs';
import config from '../aleph.config.json' with {type:'json'};
function fixture({leak=false,changeCommit=false}={}){
 let metadataCalls=0;
 return async input=>{
   const url=new URL(input);const headers={'X-Request-ID':'fixture-request'};
   if(url.pathname==='/aleph.json'){metadataCalls++;return Response.json({commit:changeCommit&&metadataCalls>1?'b'.repeat(40):'a'.repeat(40),step:12,repoUrl:config.repoUrl},{headers});}
   if(url.pathname==='/data.json')return new Response('',{status:404,headers});
   if(url.pathname==='/'||url.pathname==='/app.js')return new Response('public shell',{headers});
   if(url.pathname==='/api/auth/session')return Response.json({authenticated:false},{headers});
   if(url.pathname==='/api/notes'&&leak)return Response.json([],{headers});
   return Response.json({error:'denied'},{status:401,headers});
 };
}
test('report records actual results and preserves unexecuted checks without invented timestamps or IDs',async()=>{
 const report=await collectAssaultReport(config,{fetchImpl:fixture()});
 assert.equal(report.checks.length,41);assert.equal(report.summary.executed,6);assert.equal(report.summary.passed,6);assert.equal(report.summary.notRun,35);
 assert.equal(report.normalChecks.length,2);assert.equal(report.deployment.commit,'a'.repeat(40));
 for(const row of report.checks.filter(c=>c.status==='not_run')){assert.equal(row.checkedAt,null);assert.equal(row.requestId,null);assert.equal(row.httpStatus,null);}
 assert.equal(report.checks.find(c=>c.id==='T06').httpStatus,401);
 const leaked=await collectAssaultReport(config,{fetchImpl:fixture({leak:true})});assert.equal(leaked.checks.find(c=>c.id==='T06').status,'observed_fail');
 assert.equal((await collectAssaultReport(config,{fetchImpl:fixture({changeCommit:true})})).deployment,null);
});
