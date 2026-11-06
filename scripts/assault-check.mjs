import {mkdir,writeFile} from 'node:fs/promises';
import config from '../aleph.config.json' with {type:'json'};
import {collectAssaultReport} from '../src/assault-report.mjs';
const report=await collectAssaultReport(config);
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/assault-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({deployment:report.deployment,summary:report.summary,normalChecks:report.normalChecks.map(c=>({id:c.id,status:c.status,httpStatus:c.httpStatus}))},null,2));
if([...report.checks,...report.normalChecks].some(c=>['observed_fail','observed_error'].includes(c.status)))process.exitCode=1;
