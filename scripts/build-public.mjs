import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'public', 'data.json');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
if (!Number.isInteger(config.step)||config.step<5||config.step>12) throw new Error('서버 자료실의 단계 설정을 확인하세요.');
await mkdir(resolve(root, 'public'), { recursive: true });
await rm(output, { force: true });
console.log('공개 data.json을 생성하지 않습니다. 자료는 서버 API에서 읽습니다.');
await build({entryPoints:[resolve(root,'src/browser.mjs')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:resolve(root,'public/app.js'),minify:true});
if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(root, 'public', 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
