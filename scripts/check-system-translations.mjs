import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url)),requireClient=createRequire(path.join(root,'apps/client/package.json'));
const ts=await import(pathToFileURL(requireClient.resolve('typescript')).href),{createServer}=await import(pathToFileURL(requireClient.resolve('vite')).href);
const server=await createServer({root:path.join(root,'apps/client'),configFile:path.join(root,'apps/client/vite.config.ts'),server:{middlewareMode:true},appType:'custom'});
const keys=new Map();
async function visit(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await visit(file);else if(/\.tsx?$/.test(entry.name)&&!entry.name.includes('.test.')){
  const source=ts.createSourceFile(file,await fs.readFile(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const walk=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='t'&&node.arguments[0]&&ts.isStringLiteralLike(node.arguments[0]))keys.set(node.arguments[0].text,path.relative(root,file));ts.forEachChild(node,walk)};walk(source);
}}}
try{
  const {dictionary}=await server.ssrLoadModule('/@fs/'+path.join(root,'packages/i18n/src/messages.ts').replaceAll('\\','/'));
  for(const directory of ['apps/client/src','packages/core/src','packages/editor/src','packages/ui-kit/src','packages/utils/src'])await visit(path.join(root,directory));
  const missing=[...keys].filter(([key])=>!dictionary[key]?.ru||!dictionary[key]?.en).map(([key,file])=>({key,file}));
  await fs.writeFile(path.join(root,'docs/evidence/aw006-i18n-catalog.json'),JSON.stringify({status:missing.length?'FAIL':'PASS',literalKeys:keys.size,missing},null,2)+'\n');
  console.log({literalKeys:keys.size,missing});if(missing.length)process.exitCode=1;
}finally{await server.close()}
