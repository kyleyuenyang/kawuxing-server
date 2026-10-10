import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {tileArtwork} from './src/tile-art-hd.js';
await mkdir('dist/assets',{recursive:true});
await mkdir('dist/assets/voice',{recursive:true});
// Resolve through Node so the native bundler need not scan protected Windows ancestors.
await build({absWorkingDir:process.cwd(),entryPoints:[resolve('src/app.js')],tsconfigRaw:{},bundle:true,format:'iife',outfile:resolve('dist/app.js'),minify:true,plugins:[{name:'node-files',setup(b){
 b.onResolve({filter:/.*/},args=>({path:createRequire(args.importer||resolve('build.mjs')).resolve(args.path),namespace:'node-files'}));
 b.onLoad({filter:/.*/,namespace:'node-files'},async args=>({contents:await readFile(args.path,'utf8'),loader:args.path.endsWith('.json')?'json':'js'}));
}}]});
for(const f of ['index.html','style.css','game.css','visual-refresh.css'])await copyFile('src/'+f,'dist/'+f);
await writeFile('dist/game.css',(await readFile('src/game.css','utf8'))+'\n'+(await readFile('src/table-experience.css','utf8')));
await copyFile('node_modules/@kobalab/majiang-core/LICENSE','dist/MAJIANG-LICENSE.txt');
for(const t of [...['p','s'].flatMap(s=>Array.from({length:9},(_,i)=>s+(i+1))),'z5','z6','z7'])await writeFile(`dist/assets/${t}.svg`,tileArtwork(t));
for(const f of await readdir('src/assets/voice'))await copyFile(`src/assets/voice/${f}`,`dist/assets/voice/${f}`);
for(let i=0;i<4;i++){
 const bg=['#ddb678','#86b9ba','#c8a5b9','#b2b7d8'][i],shirt=['#315b5e','#394667','#8b535b','#68754a'][i];
 await writeFile(`dist/assets/avatar-${i}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${bg}"/><path d="M12 120q3-42 48-42t48 42" fill="${shirt}"/><path d="M48 70h24v19q-12 15-24 0" fill="#dfaa85"/><ellipse cx="60" cy="49" rx="29" ry="34" fill="#f5cca7"/><path d="M30 53Q16 5 62 9q39 0 29 46l-10-17Q54 48 41 27L32 56" fill="${i===2?'#664234':'#333233'}"/><path d="M43 52h9m16 0h9" stroke="#4a3831" stroke-width="3" stroke-linecap="round"/><circle cx="48" cy="58" r="2" fill="#3c3737"/><circle cx="72" cy="58" r="2" fill="#3c3737"/><path d="M52 73q8 6 16 0" stroke="#a16c55" stroke-width="2" fill="none"/>${i===0?'<g fill="none" stroke="#394e4d" stroke-width="2"><rect x="36" y="51" width="22" height="16" rx="6"/><rect x="63" y="51" width="22" height="16" rx="6"/><path d="M58 56h5"/></g>':''}<path d="M47 87l13 11 13-11" stroke="#ffffff60" stroke-width="2" fill="none"/></svg>`);
}
console.log('Built dist');
await build({absWorkingDir:process.cwd(),entryPoints:[resolve('src/online.js')],bundle:true,format:'iife',outfile:resolve('dist/online.js'),minify:true,tsconfigRaw:{},plugins:[{name:'online-node-files',setup(b){b.onResolve({filter:/.*/},args=>({path:createRequire(args.importer||resolve('build.mjs')).resolve(args.path),namespace:'online-files'}));b.onLoad({filter:/.*/,namespace:'online-files'},async args=>({contents:await readFile(args.path,'utf8'),loader:args.path.endsWith('.json')?'json':'js'}));}}]});
await copyFile('src/online.html','dist/online.html');
