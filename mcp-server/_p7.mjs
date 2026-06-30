import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const t = new StdioClientTransport({ command: "npx", args: ["-y","tsx","src/index.ts"], cwd: process.cwd() });
const c = new Client({ name: "p7", version: "0.0.1" }); await c.connect(t);
const call = async (n,a={}) => { const r = await c.callTool({name:n,arguments:a}); return JSON.parse(r.content.map(x=>x.text).join("")); };
let p=null; for (let i=0;i<20;i++){ p=await call("get_project"); if(p.tracks){console.log("connected, tracks:",p.tracks.length);break;} await new Promise(r=>setTimeout(r,1000)); }
if(!p.tracks){console.log("NO BROWSER CONNECTED");process.exit(1);}
const trackId=p.tracks[0].id;
const fx=await call("add_effect",{trackId, type:"delay"});
await call("set_effect_param",{trackId, effectId:fx.effectId, param:"feedback", value:0.7});
await call("set_effect_enabled",{trackId, effectId:fx.effectId, enabled:false});
const proj=await call("get_project");
const e=proj.tracks.find(x=>x.id===trackId).effects.find(x=>x.id===fx.effectId);
console.log("RESULT:", JSON.stringify({type:e.type, enabled:e.enabled, fb:e.params.feedback}));
const after=await call("remove_effect",{trackId, effectId:fx.effectId});
const proj2=await call("get_project");
console.log("RESULT after remove:", proj2.tracks.find(x=>x.id===trackId).effects.length, "effects");
process.exit(0);
