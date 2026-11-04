import fs from 'node:fs';
import { parse } from 'acorn';
const html = fs.readFileSync(new URL('../../originals/volleyball.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ast = parse(source, {ecmaVersion:2022, ranges:true, locations:true});
for (const n of ast.body) {
  console.log(n.loc.start.line+1079, n.type, source.slice(n.start, n.end).split('\n')[0].slice(0,150));
}
