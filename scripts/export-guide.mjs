import fs from 'node:fs';
import {guideTopics} from '../apps/client/src/lib/guide.ts';
import {displayVersion} from '../packages/utils/src/versions.ts';
const {version}=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const label=displayVersion(version);
for(const locale of ['ru','en'])fs.writeFileSync(`docs/USER_GUIDE.${locale}.md`,(locale==='ru'?`# Руководство Bordena ${label}\n\n`:`# Bordena ${label} user guide\n\n`)+guideTopics.map(topic=>`## ${topic[locale].title}\n\n${topic[locale].body}\n`).join('\n'));
