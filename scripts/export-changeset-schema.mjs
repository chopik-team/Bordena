import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const requireClient=createRequire(path.join(root,'apps/client/package.json'));
const {createServer}=await import(pathToFileURL(requireClient.resolve('vite')).href);
const server=await createServer({root:path.join(root,'apps/client'),configFile:path.join(root,'apps/client/vite.config.ts'),server:{middlewareMode:true},appType:'custom'});
try {
  const {changesetJsonSchema,ChangesetSchema}=await server.ssrLoadModule('/src/lib/exchange/changeset-schema.ts');
  const schema=changesetJsonSchema();schema.title='Bordena Changeset v1';
  const directory=path.join(root,'docs/schemas');await fs.mkdir(directory,{recursive:true});
  await fs.writeFile(path.join(directory,'bordena-changeset-v1.schema.json'),JSON.stringify(schema,null,2)+'\n');
  const guide=await fs.readFile(path.join(root,'docs/BORDENA_AI_EXCHANGE_GUIDE.md'),'utf8');
  const examples=[...guide.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)].map(match=>JSON.parse(match[1])).filter(example=>example.operations.length);
  if(examples.length!==7)throw new Error('Expected seven complete guide workflows');
  const {planChangeset}=await server.ssrLoadModule('/src/lib/exchange/changeset.ts');
  const empty={format:'bordena',schemaVersion:5,scope:'workspace',exportedAt:new Date().toISOString(),boards:[],attachmentsManifest:[],organization:{workspaces:[{id:'default',title:'Личное пространство'}]}};
  let planned=empty,index=0;
  for(const example of examples)planned=planChangeset(planned,ChangesetSchema.parse(example),1700000000000+index++);
  const parent=planned.boards.find(b=>b.dashboard.id==='example-main').cards[0];if(parent.boardLink?.boardId!=='example-production'||parent.progress!==37)throw new Error('Guide workflow result changed');
  const calendarGuide=await fs.readFile(path.join(root,'docs/AW006_CALENDAR_GUIDE.md'),'utf8');
  const calendarExamples=[...calendarGuide.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)].map(m=>JSON.parse(m[1]));
  for(const example of calendarExamples){const result=planChangeset(empty,ChangesetSchema.parse(example),1700000000100);if(result.calendar?.events.length!==1||result.schemaVersion!==6)throw new Error('Calendar guide workflow failed')}
  const {documentJsonSchema}=await server.ssrLoadModule('/src/lib/exchange/format.ts');
  await fs.writeFile(path.join(directory,'bordena-document-v6.schema.json'),JSON.stringify(documentJsonSchema(),null,2)+'\n');
  await fs.writeFile(path.join(root,'docs/evidence/aw006-schema-examples.json'),JSON.stringify({status:'PASS',examples:examples.length,calendarExamples:calendarExamples.length,checks:['runtime schema','complete semantic plan','stable IDs, same-batch revision0, link and manual progress','calendar profile and recurrence']},null,2)+'\n');
  console.log('Generated Bordena Changeset JSON Schema from its runtime validator.');
} finally {await server.close()}
