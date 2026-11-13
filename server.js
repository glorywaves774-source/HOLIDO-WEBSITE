require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const db = require('./src/db');
const fmt = require('./src/format');
let sharp = null; try { sharp = require('sharp'); } catch (e) { console.warn('sharp is not installed: uploaded images will be stored as supplied (no resizing or content check).'); }
const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';
const backupRoot = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(__dirname, 'backups');
for (const d of ['uploads','private-documents','data']) fs.mkdirSync(path.join(__dirname, d), { recursive: true });
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters in production.');
}
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', isProd ? 1 : false);
Object.assign(app.locals, { rich: fmt.rich, cardText: fmt.cardText, fullText: fmt.fullText, imgAttrs: fmt.imgAttrs, imgPos: fmt.imgPos, fmtDate: fmt.fmtDate, excerpt: fmt.excerpt, para: fmt.para, tags: fmt.tags, initials: fmt.initials });
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https://www.holido.org', 'https://holido.org'], scriptSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'"], objectSrc: ["'none'"], upgradeInsecureRequests: isProd ? [] : null
  }}, referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(express.urlencoded({ extended: false, limit: '30kb' }));
app.use(express.json({ limit: '30kb' }));
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: path.join(__dirname, 'data') }),
  name: 'holido.sid', secret: process.env.SESSION_SECRET || 'development-only-change-this-secret-before-deployment',
  resave: false, saveUninitialized: false, rolling: true,
  cookie: { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 4 }
}));
app.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: isProd ? '7d' : 0, dotfiles: 'deny' }));
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(32).toString('hex');
  res.locals.csrf = req.session.csrf;
  res.locals.isAdmin = !!req.session.admin;
  res.locals.currentPath = req.path;
  // Defaults so shared templates never hit a ReferenceError (error pages, admin pages, contact page).
  res.locals.pageKey = ''; res.locals.title = ''; res.locals.error = null; res.locals.sent = false;
  res.locals.subscribe = ['success','invalid','error'].includes(req.query.subscribe) ? req.query.subscribe : '';
  const socialUrl=(v,host)=>{try{const u=new URL(String(v||'').trim());return u.protocol==='https:'&&host.test(u.hostname)?u.href:''}catch(e){return ''}};
  res.locals.social = { facebook: socialUrl(process.env.FACEBOOK_URL,/(^|\.)facebook\.com$|^fb\.com$/i), linkedin: socialUrl(process.env.LINKEDIN_URL,/(^|\.)linkedin\.com$/i) };
  res.locals.site = { name: 'Holistic Development Organisation', short: 'HOLIDO', address: 'NK143 C, Tamale, Ghana', emails: ['holidoghana@gmail.com', 'georgedam@holido.org'], website: 'www.holido.org' };
  next();
});
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: 'Too many messages have been submitted. Please try again later.' });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
function validCsrf(req) {
  const token = req.body && req.body._csrf;
  return !!(token && req.session.csrf && Buffer.byteLength(String(token)) === Buffer.byteLength(String(req.session.csrf)) && crypto.timingSafeEqual(Buffer.from(String(token)), Buffer.from(String(req.session.csrf))));
}
function csrf(req, res, next) {
  if (!validCsrf(req)) return res.status(403).render('error', { title: 'Request could not be verified', message: 'Please refresh the page and try again.' });
  next();
}
function csrfMultipart(req,res,next) {
  if (!validCsrf(req)) { if(req.file) fs.rm(req.file.path,{force:true},()=>{}); return res.status(403).render('error',{title:'Request could not be verified',message:'Please refresh the page and try again.'}); }
  next();
}
function requireAdmin(req, res, next) { if (!req.session.admin) return res.redirect('/admin/login'); next(); }
function rows(type, limit=100) { return db.prepare('SELECT * FROM content WHERE type=? AND published=1 ORDER BY sort_order ASC, created_at DESC LIMIT ?').all(type, limit); }
function page(req, res, title, data={}) { res.render('page', { title, ...data }); }
app.get('/', (req,res) => page(req,res,'Home', { pageKey:'home', programs:rows('program'), projects:rows('project',4), stories:rows('story',3), people:rows('person',7), partners:rows('partner',6) }));
app.get('/about', (req,res) => page(req,res,'About HOLIDO',{pageKey:'about'}));
app.get('/programmes', (req,res) => page(req,res,'Our Programmes',{pageKey:'programmes',programs:rows('program'),gallery:rows('gallery',12)}));
app.get('/projects/:slug', (req,res) => { const item=db.prepare("SELECT * FROM content WHERE type='project' AND slug=? AND published=1").get(req.params.slug); if(!item)return res.status(404).render('error',{title:'Not found',message:'This project could not be found.'}); page(req,res,item.title,{pageKey:'detail',item,back:'/projects',backLabel:'All projects'}); });
app.get('/news/:slug', (req,res) => { const item=db.prepare("SELECT * FROM content WHERE type='news' AND slug=? AND published=1").get(req.params.slug); if(!item)return res.status(404).render('error',{title:'Not found',message:'This news item could not be found.'}); page(req,res,item.title,{pageKey:'detail',item,back:'/news',backLabel:'All news'}); });
app.get('/programmes/:slug', (req,res) => { const item=db.prepare("SELECT * FROM content WHERE type='program' AND slug=? AND published=1").get(req.params.slug); if(!item)return res.status(404).render('error',{title:'Not found',message:'This programme could not be found.'}); page(req,res,item.title,{pageKey:'detail',item,back:'/programmes',backLabel:'All programmes'}); });
app.get('/news', (req,res) => page(req,res,'News & Updates',{pageKey:'news',news:rows('news')}));
app.get('/projects', (req,res) => page(req,res,'Projects',{pageKey:'projects',projects:rows('project')}));
app.get('/impact', (req,res) => page(req,res,'Our Impact',{pageKey:'impact',stories:rows('story')}));
app.get('/impact/:slug', (req,res) => { const item=db.prepare("SELECT * FROM content WHERE type='story' AND slug=? AND published=1").get(req.params.slug); if(!item)return res.status(404).render('error',{title:'Not found',message:'This story could not be found.'}); page(req,res,item.title,{pageKey:'detail',item,back:'/impact',backLabel:'All impact stories'}); });
app.get('/our-people', (req,res) => page(req,res,'Our People',{pageKey:'people',people:rows('person')}));
app.get('/get-involved', (req,res) => page(req,res,'Get Involved',{pageKey:'involved'}));
app.get('/partners', (req,res) => page(req,res,'Partners & Collaborators',{pageKey:'partners',partners:rows('partner')}));
app.get('/gallery', (req,res) => page(req,res,'Photo Gallery',{pageKey:'gallery',gallery:rows('gallery')}));
app.get('/resources', (req,res) => page(req,res,'Resources & Publications',{pageKey:'resources',documents:db.prepare('SELECT id,title,description,category,original_name,created_at FROM documents WHERE published=1 ORDER BY created_at DESC').all(),resources:rows('resource')}));
app.get('/donate', (req,res) => page(req,res,'Support HOLIDO',{pageKey:'donate'}));
app.post('/subscribe', contactLimiter, csrf, (req,res) => {
 const email=String(req.body.email||'').trim().toLowerCase();
 if(req.body.website_check || !/^\S+@\S+\.\S+$/.test(email) || email.length>180) return res.redirect('/?subscribe=invalid#newsletter');
 try { db.prepare("INSERT INTO subscribers(email) VALUES(?) ON CONFLICT(email) DO UPDATE SET status='active'").run(email); } catch(e) { return res.redirect('/?subscribe=error#newsletter'); }
 res.redirect('/?subscribe=success#newsletter');
});
app.get('/contact', (req,res) => page(req,res,'Contact Us',{pageKey:'contact',sent:req.query.sent==='1'}));
app.get('/documents/:id/download', (req,res) => {
 const doc=db.prepare('SELECT * FROM documents WHERE id=?').get(Number(req.params.id));
 if(!doc || (!doc.published && !req.session.admin)) return res.sendStatus(404);
 const file=path.join(__dirname,'private-documents',path.basename(doc.file_name));
 if(!fs.existsSync(file)) return res.sendStatus(404);
 res.download(file,doc.original_name);
});
app.post('/contact', contactLimiter, csrf, (req,res) => {
 const {first_name,last_name,email,subject,message,website_check}=req.body;
 if (website_check) return res.redirect('/contact?sent=1'); // honeypot
 const clean = v => String(v||'').trim();
 if (!clean(first_name)||!clean(last_name)||!/^\S+@\S+\.\S+$/.test(clean(email))||!clean(subject)||clean(message).length<10||clean(message).length>5000) return page(req,res,'Contact Us',{pageKey:'contact',error:'Please complete all fields and enter a valid email address. Your message should be at least 10 characters.'});
 db.prepare('INSERT INTO messages(first_name,last_name,email,subject,message) VALUES(?,?,?,?,?)').run(clean(first_name).slice(0,80),clean(last_name).slice(0,80),clean(email).slice(0,180),clean(subject).slice(0,160),clean(message).slice(0,5000));
 res.redirect('/contact?sent=1');
});
app.get('/privacy', (req,res) => page(req,res,'Privacy Notice',{pageKey:'privacy'}));
app.get('/admin/login', (req,res) => { if(req.session.admin)return res.redirect('/admin'); res.render('admin/login',{title:'Administrator sign in',error:null}); });
app.post('/admin/login', loginLimiter, csrf, (req,res) => {
 const email=String(req.body.email||'').trim().toLowerCase(); const password=String(req.body.password||'');
 const admin=db.prepare('SELECT * FROM admins WHERE email=?').get(email);
 if(!admin || !bcrypt.compareSync(password,admin.password_hash)) return res.status(401).render('admin/login',{title:'Administrator sign in',error:'The email or password is incorrect.'});
 req.session.regenerate(err=>{ if(err)return res.status(500).send('Unable to start a secure session.'); req.session.admin={id:admin.id,email:admin.email}; req.session.csrf=crypto.randomBytes(32).toString('hex'); res.redirect('/admin'); });
});
app.post('/admin/logout', requireAdmin, csrf, (req,res)=>req.session.destroy(()=>res.redirect('/')));
const countType=t=>db.prepare('SELECT COUNT(*) n FROM content WHERE type=?').get(t).n;
app.get('/admin', requireAdmin, (req,res)=>res.render('admin/dashboard',{title:'Content dashboard',counts:{programs:countType('program'),projects:countType('project'),stories:countType('story'),people:countType('person'),partners:countType('partner'),gallery:countType('gallery'),resources:countType('resource'),documents:db.prepare('SELECT COUNT(*) n FROM documents').get().n,subscribers:db.prepare("SELECT COUNT(*) n FROM subscribers WHERE status='active'").get().n,messages:db.prepare("SELECT COUNT(*) n FROM messages WHERE status='new'").get().n},messages:db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 8').all()}));
const types=['program','project','story','person','news','partner','gallery','resource'];
const typeLabels={program:'Programmes',project:'Projects',story:'Impact stories',person:'People',news:'News & updates',partner:'Partners',gallery:'Gallery',resource:'Resources'};
const upload=multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,path.join(__dirname,'uploads')),filename:(req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();cb(null,crypto.randomBytes(16).toString('hex')+ext);}}),limits:{fileSize:12*1024*1024,files:1,fieldSize:2*1024*1024,fields:40},fileFilter:(req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();const allowed={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'};const ok=!!allowed[ext]&&allowed[ext]===file.mimetype;cb(ok?null:new Error('Upload a valid JPG, PNG, WEBP or GIF image.'),ok);}});
app.get('/admin/content/:type',requireAdmin,(req,res)=>{const type=req.params.type;if(!types.includes(type))return res.sendStatus(404);res.render('admin/list',{title:typeLabels[type],type,label:typeLabels[type],items:db.prepare('SELECT * FROM content WHERE type=? ORDER BY sort_order,created_at DESC').all(type)});});
app.get('/admin/content/:type/new',requireAdmin,(req,res)=>{const type=req.params.type;if(!types.includes(type))return res.sendStatus(404);res.render('admin/edit',{title:'Add '+typeLabels[type],type,label:typeLabels[type],item:null});});
app.get('/admin/content/:type/:id/edit',requireAdmin,(req,res)=>{const type=req.params.type;if(!types.includes(type))return res.sendStatus(404);const item=db.prepare('SELECT * FROM content WHERE type=? AND id=?').get(type,Number(req.params.id));if(!item)return res.sendStatus(404);res.render('admin/edit',{title:'Edit '+item.title,type,label:typeLabels[type],item});});
app.post('/admin/content/:type',requireAdmin,upload.single('image_file'),csrfMultipart,(req,res,next)=>saveContent(req,res,null).catch(next));
app.post('/admin/content/:type/:id',requireAdmin,upload.single('image_file'),csrfMultipart,(req,res,next)=>saveContent(req,res,Number(req.params.id)).catch(next));
// Resize very large photos (phones often produce 5-12 MB files), apply EXIF rotation, and confirm the file really is an image.
async function optimiseUpload(file){
 if(!sharp||!file)return;
 const ext=path.extname(file.filename).toLowerCase();
 if(ext==='.gif')return;
 try{
  const meta=await sharp(file.path,{failOn:'none'}).metadata();
  const big=(meta.width||0)>2200||(meta.height||0)>2200;
  let pipe=sharp(file.path,{failOn:'none'}).rotate().resize({width:2200,height:2200,fit:'inside',withoutEnlargement:true});
  pipe=ext==='.png'?pipe.png({compressionLevel:9}):ext==='.webp'?pipe.webp({quality:84}):pipe.jpeg({quality:84,mozjpeg:true});
  const buf=await pipe.toBuffer();
  if(big||(meta.orientation||1)>1||buf.length<file.size)fs.writeFileSync(file.path,buf);
 }catch(e){ throw new Error('Upload a valid JPG, PNG, WEBP or GIF image.'); }
}
// Remove an uploaded file once no record uses it any more.
function dropUploadIfUnused(url){
 if(!url||!/^\/uploads\/[\w.-]+$/.test(url))return;
 if(db.prepare('SELECT COUNT(*) n FROM content WHERE image=?').get(url).n)return;
 fs.rm(path.join(__dirname,'uploads',path.basename(url)),{force:true},()=>{});
}
async function saveContent(req,res,id){
 const discard=()=>{ if(req.file)fs.rm(req.file.path,{force:true},()=>{}); };
 const type=req.params.type;if(!types.includes(type)){discard();return res.sendStatus(404);}
 const v=k=>String(req.body[k]||'').trim();const title=v('title');
 if(!title){discard();return res.status(400).render('error',{title:'Title required',message:'Please go back and enter a title.'});}
 let slug=(v('slug')||title).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
 if(!slug)slug='item-'+Date.now().toString(36);
 const old=id?db.prepare('SELECT * FROM content WHERE id=? AND type=?').get(id,type):null;
 if(id&&!old){discard();return res.sendStatus(404);}
 try{ await optimiseUpload(req.file); }catch(e){ discard(); throw e; }
 let image=old?old.image:'';
 if(req.file)image='/uploads/'+req.file.filename;
 else if(v('remove_image')==='1')image='';
 else if(v('image'))image=v('image');
 if(image&&!/^(\/uploads\/[\w.-]+|https?:\/\/\S+)$/.test(image))image=old?old.image:'';
 const data={type,title:title.slice(0,180),slug,summary:v('summary').slice(0,2000),body:String(req.body.body||'').replace(/\r\n?/g,'\n').trim().slice(0,100000),image,image_pos:fmt.normPos(v('image_pos')),image_alt:v('image_alt').slice(0,300),category:v('category').slice(0,150),author:v('author').slice(0,200),role:v('role').slice(0,200),location:v('location').slice(0,200),qualifications:v('qualifications').slice(0,400),traits:v('traits').slice(0,600),expertise:v('expertise').slice(0,3000),quote:v('quote').slice(0,1500),published:req.body.published==='1'?1:0,sort_order:Number(v('sort_order'))||0};
 try {
  if(id){db.prepare(`UPDATE content SET title=@title,slug=@slug,summary=@summary,body=@body,image=@image,image_pos=@image_pos,image_alt=@image_alt,category=@category,author=@author,role=@role,location=@location,qualifications=@qualifications,traits=@traits,expertise=@expertise,quote=@quote,published=@published,sort_order=@sort_order,updated_at=CURRENT_TIMESTAMP WHERE id=@id AND type=@type`).run({...data,id});}
  else{db.prepare(`INSERT INTO content(type,title,slug,summary,body,image,image_pos,image_alt,category,author,role,location,qualifications,traits,expertise,quote,published,sort_order) VALUES(@type,@title,@slug,@summary,@body,@image,@image_pos,@image_alt,@category,@author,@role,@location,@qualifications,@traits,@expertise,@quote,@published,@sort_order)`).run(data);}
 }catch(e){ discard(); return res.status(400).render('error',{title:'Could not save content',message:'This item may already use that URL slug. Please choose a different slug.'}); }
 if(old&&old.image!==image)dropUploadIfUnused(old.image);
 res.redirect('/admin/content/'+type);
}
app.post('/admin/content/:type/:id/delete',requireAdmin,csrf,(req,res)=>{if(!types.includes(req.params.type))return res.sendStatus(404);const gone=db.prepare('SELECT image FROM content WHERE type=? AND id=?').get(req.params.type,Number(req.params.id));db.prepare('DELETE FROM content WHERE type=? AND id=?').run(req.params.type,Number(req.params.id));if(gone)dropUploadIfUnused(gone.image);res.redirect('/admin/content/'+req.params.type);});
app.get('/admin/messages',requireAdmin,(req,res)=>res.render('admin/messages',{title:'Enquiries',items:db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all()}));
app.post('/admin/messages/:id/status',requireAdmin,csrf,(req,res)=>{db.prepare('UPDATE messages SET status=? WHERE id=?').run(req.body.status==='read'?'read':'new',Number(req.params.id));res.redirect('/admin/messages');});
// Private document library: files are never exposed through the public uploads directory.
const privateDocs=path.join(__dirname,'private-documents'); fs.mkdirSync(privateDocs,{recursive:true});
const docUpload=multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,privateDocs),filename:(req,file,cb)=>cb(null,crypto.randomBytes(18).toString('hex')+path.extname(file.originalname).toLowerCase())}),limits:{fileSize:15*1024*1024,files:1},fileFilter:(req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();const allowed={'.pdf':['application/pdf'],'.doc':['application/msword','application/octet-stream'],'.docx':['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip','application/octet-stream'],'.xls':['application/vnd.ms-excel','application/octet-stream'],'.xlsx':['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','application/octet-stream'],'.ppt':['application/vnd.ms-powerpoint','application/octet-stream'],'.pptx':['application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip','application/octet-stream'],'.csv':['text/csv','application/vnd.ms-excel','text/plain']};const ok=!!allowed[ext]&&allowed[ext].includes(file.mimetype);cb(ok?null:new Error('Upload a supported PDF, Word, Excel, PowerPoint or CSV document.'),ok);}});
app.get('/admin/documents',requireAdmin,(req,res)=>res.render('admin/documents',{title:'Documents & publications',items:db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all()}));
app.post('/admin/documents',requireAdmin,docUpload.single('document_file'),csrfMultipart,(req,res)=>{const title=String(req.body.title||'').trim();if(!title||!req.file)return res.status(400).render('error',{title:'Document not saved',message:'A title and a supported document file are required.'});db.prepare('INSERT INTO documents(title,description,category,file_name,original_name,mime_type,size,published) VALUES(?,?,?,?,?,?,?,?)').run(title.slice(0,180),String(req.body.description||'').slice(0,1000),String(req.body.category||'resource').slice(0,60),req.file.filename,req.file.originalname.slice(0,240),req.file.mimetype,req.file.size,req.body.published==='1'?1:0);res.redirect('/admin/documents');});
app.post('/admin/documents/:id/delete',requireAdmin,csrf,(req,res)=>{const d=db.prepare('SELECT * FROM documents WHERE id=?').get(Number(req.params.id));if(d){db.prepare('DELETE FROM documents WHERE id=?').run(d.id);fs.rm(path.join(privateDocs,path.basename(d.file_name)),{force:true},()=>{});}res.redirect('/admin/documents');});
app.get('/admin/subscribers.csv',requireAdmin,(req,res)=>{const list=db.prepare("SELECT email,created_at,status FROM subscribers ORDER BY created_at DESC").all();res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=holido-subscribers.csv');res.send('email,created_at,status\n'+list.map(x=>[x.email,x.created_at,x.status].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n'));});
async function createBackup(){
 const dir=backupRoot;fs.mkdirSync(dir,{recursive:true});
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const work=path.join(dir,'holido-'+stamp);fs.mkdirSync(work,{recursive:true});
 await db.backup(path.join(work,'holido.sqlite'));
 if(fs.existsSync(path.join(__dirname,'uploads')))fs.cpSync(path.join(__dirname,'uploads'),path.join(work,'uploads'),{recursive:true});
 if(fs.existsSync(privateDocs))fs.cpSync(privateDocs,path.join(work,'private-documents'),{recursive:true});
 const checksums={};
 const walk=(folder,relative='')=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const abs=path.join(folder,entry.name);const rel=path.posix.join(relative,entry.name);if(entry.isDirectory())walk(abs,rel);else checksums[rel]=crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');}};
 walk(work);
 fs.writeFileSync(path.join(work,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),database:'holido.sqlite',includes:['database','uploads','private-documents'],sha256:checksums},null,2));
 const archive=work+'.tar.gz';
 try { await execFileAsync('tar',['-czf',archive,'-C',dir,path.basename(work)]); }
 finally { fs.rmSync(work,{recursive:true,force:true}); }
 const archives=fs.readdirSync(dir).filter(f=>f.endsWith('.tar.gz')).sort().reverse();
 archives.slice(14).forEach(f=>fs.rmSync(path.join(dir,f),{force:true}));
 return archive;
}
app.get('/admin/backups',requireAdmin,(req,res)=>{const dir=backupRoot;fs.mkdirSync(dir,{recursive:true});const items=fs.readdirSync(dir).filter(f=>f.endsWith('.tar.gz')).sort().reverse().map(name=>({name,size:fs.statSync(path.join(dir,name)).size}));res.render('admin/backups',{title:'Backups & recovery',items});});
app.post('/admin/backups',requireAdmin,csrf,async(req,res)=>{try{await createBackup();res.redirect('/admin/backups?created=1');}catch(e){console.error('Backup failed:',e.message);res.status(500).render('error',{title:'Backup failed',message:'The backup could not be created. Check server storage and permissions.'});}});
app.get('/admin/backups/:name',requireAdmin,(req,res)=>{const name=path.basename(req.params.name);if(!/^holido-[\w-]+\.tar\.gz$/.test(name))return res.sendStatus(400);const file=path.join(backupRoot,name);if(!fs.existsSync(file))return res.sendStatus(404);res.download(file);});
app.get('/robots.txt',(req,res)=>res.type('text').send('User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: '+(process.env.SITE_URL||'https://www.holido.org')+'/sitemap.xml\n'));
app.get('/sitemap.xml',(req,res)=>{const base=process.env.SITE_URL||'https://www.holido.org';const urls=['/','/about','/programmes','/projects','/news','/impact','/our-people','/get-involved','/partners','/gallery','/resources','/donate','/contact','/privacy'];for(const [type,prefix] of [['program','/programmes/'],['project','/projects/'],['news','/news/'],['story','/impact/']]) rows(type,500).forEach(x=>urls.push(prefix+x.slug));res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>`<url><loc>${base}${u}</loc></url>`).join('')+'</urlset>');});
app.use((err,req,res,next)=>{console.error(err.message);if(/^Upload a (valid|supported)/.test(err.message))return res.status(400).render('error',{title:'Upload not accepted',message:err.message});if(err instanceof multer.MulterError)return res.status(400).render('error',{title:'Image upload error',message:err.code==='LIMIT_FILE_SIZE'?'Image must be 12 MB or smaller.':'Please upload one image at a time.'});res.status(500).render('error',{title:'Something went wrong',message:isProd?'Please try again shortly.':'The request could not be completed.'});});
app.use((req,res)=>res.status(404).render('error',{title:'Page not found',message:'The page you are looking for may have moved or no longer exists.'}));
app.listen(PORT,()=>console.log(`HOLIDO website running on http://localhost:${PORT}`));
if (process.env.BACKUP_DISABLE !== '1') {
  const autoBackup = async () => { try { fs.mkdirSync(backupRoot,{recursive:true}); const latest=fs.readdirSync(backupRoot).filter(f=>f.endsWith('.tar.gz')).map(f=>fs.statSync(path.join(backupRoot,f)).mtimeMs).sort((a,b)=>b-a)[0]||0; if(Date.now()-latest>20*60*60*1000){const file=await createBackup();console.log('Automatic HOLIDO backup created:',path.basename(file));} } catch(e){console.error('Automatic backup failed:',e.message);} };
  setTimeout(autoBackup,60*1000).unref();
  setInterval(autoBackup,24*60*60*1000).unref();
}
