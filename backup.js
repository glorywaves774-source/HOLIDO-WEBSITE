require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const db = require('./src/db');
async function main(){
 const dir=process.env.BACKUP_DIR?path.resolve(process.env.BACKUP_DIR):path.join(__dirname,'backups');fs.mkdirSync(dir,{recursive:true});
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');const name='holido-'+stamp;const work=path.join(dir,name);fs.mkdirSync(work,{recursive:true});
 try { await db.backup(path.join(work,'holido.sqlite')); for(const folder of ['uploads','private-documents']){const from=path.join(__dirname,folder);if(fs.existsSync(from))fs.cpSync(from,path.join(work,folder),{recursive:true});}
 fs.writeFileSync(path.join(work,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),database:'holido.sqlite',includes:['database','uploads','private-documents']},null,2));
 const archive=path.join(dir,name+'.tar.gz');await execFileAsync('tar',['-czf',archive,'-C',dir,name]);console.log('Backup created:',archive);
 } finally {fs.rmSync(work,{recursive:true,force:true});}
}
main().catch(e=>{console.error('Backup failed:',e.message);process.exitCode=1;});
