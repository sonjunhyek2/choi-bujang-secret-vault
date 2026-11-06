import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const safe=resolve(root,'recovery/safe-policy');
const trial=resolve(root,'artifacts/policy-recovery-test');
const trustedManifest='4d4af61a1dc12a78b4a6d10e2b28d9ea69185f2e59bedb55f49363b138e44214';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifestBytes=await readFile(resolve(safe,'manifest.json'));
if(hash(manifestBytes)!==trustedManifest)throw Error('BACKUP_MANIFEST_INTEGRITY_FAILED');
const manifest=JSON.parse(manifestBytes);
const baseline=new Map();
for(const [file,expected]of Object.entries(manifest.files)){
  const bytes=await readFile(resolve(safe,file));
  if(hash(bytes)!==expected)throw Error('BACKUP_INTEGRITY_FAILED');
  baseline.set(file,bytes);
}
const command=process.argv[2];
if(command==='init-demo'){
  await mkdir(resolve(root,'artifacts'),{recursive:true});
  await mkdir(trial); // Refuse to overwrite an existing experiment.
  for(const [file,bytes]of baseline){await mkdir(dirname(resolve(trial,file)),{recursive:true});await writeFile(resolve(trial,file),bytes);}
  const file='src/decider.mjs';
  const before=baseline.get(file).toString('utf8');
  const after=before.replace('deviceRegistered!==true','deviceRegistered===true');
  if(after===before)throw Error('DEMO_MUTATION_NOT_APPLIED');
  await writeFile(resolve(trial,file),after);
  console.log('시험용 사본에 기기 조건 한 줄만 변경했습니다. 실제 정책은 보존했습니다.');
}else if(command==='preview'||command==='restore'){
  const changes=[];
  for(const [file,bytes]of baseline){
    const current=await readFile(resolve(trial,file)); // Missing trial files abort.
    if(hash(current)!==hash(bytes)){
      const oldLines=current.toString('utf8').split(/\r?\n/u),newLines=bytes.toString('utf8').split(/\r?\n/u);
      const lines=[];
      for(let i=0;i<Math.max(oldLines.length,newLines.length);i++)if(oldLines[i]!==newLines[i])lines.push({line:i+1,current:oldLines[i],restored:newLines[i]});
      changes.push({file,currentHash:hash(current),restoredHash:hash(bytes),lines});
    }
  }
  console.log(JSON.stringify({sourceCommit:manifest.sourceCommit,target:'artifacts/policy-recovery-test',changes},null,2));
  if(command==='restore'){
    if(!process.argv.includes('--apply'))throw Error('REVIEW_PREVIEW_THEN_PASS_APPLY');
    for(const {file}of changes)await writeFile(resolve(trial,file),baseline.get(file));
    await appendFile(resolve(root,'artifacts/policy-recovery-audit.jsonl'),JSON.stringify({at:new Date().toISOString(),sourceCommit:manifest.sourceCommit,files:changes.map(c=>c.file)})+'\n');
    console.log('시험 정책의 변경 항목만 복원했습니다. 감사 이력을 추가 보존했습니다.');
  }
}else throw Error('Use init-demo, preview or restore --apply');
