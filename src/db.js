const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'holido.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS content (
 id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL,
 summary TEXT DEFAULT '', body TEXT DEFAULT '', image TEXT DEFAULT '', category TEXT DEFAULT '',
 author TEXT DEFAULT '', role TEXT DEFAULT '', location TEXT DEFAULT '', published INTEGER DEFAULT 1,
 sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(type, slug)
);
CREATE TABLE IF NOT EXISTS messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
 email TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT DEFAULT 'new',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS donations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT DEFAULT '', email TEXT DEFAULT '', amount REAL, currency TEXT DEFAULT 'GHS', method TEXT DEFAULT 'manual', reference TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '', category TEXT DEFAULT 'resource', file_name TEXT NOT NULL, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, published INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_content_type_published ON content(type,published,sort_order);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status,created_at);
`);
const count = db.prepare('SELECT COUNT(*) AS n FROM content').get().n;
if (!count) {
 const insert = db.prepare(`INSERT INTO content(type,title,slug,summary,body,image,category,author,role,location,sort_order) VALUES(@type,@title,@slug,@summary,@body,@image,@category,@author,@role,@location,@sort_order)`);
 const seeds = [
  {type:'program',title:'Agriculture & Food Security',slug:'agriculture-food-security',summary:'Strengthening sustainable food security, livelihoods and climate resilience.',body:'HOLIDO supports farmer group mobilisation, cooperative farming, climate-resilient farming practices and disaster risk reduction. Programmes are designed with communities to strengthen local ownership and sustainable livelihoods.',image:'',category:'Thematic area',sort_order:1},
  {type:'program',title:'Education',slug:'education',summary:'Promoting access to quality education in rural communities.',body:'HOLIDO promotes adult literacy, early childhood development and teacher capacity building using learner-centred and gender-sensitive methodologies.',image:'',category:'Thematic area',sort_order:2},
  {type:'program',title:'Health',slug:'health',summary:'Improving access to quality healthcare for mothers, children and families.',body:'HOLIDO works to increase access to quality healthcare and community health awareness, while addressing social and cultural barriers affecting women and girls.',image:'',category:'Thematic area',sort_order:3},
  {type:'project',title:'Food Security & Climate Resilience',slug:'food-security-climate-resilience',summary:'Community-focused action to strengthen sustainable food security and climate resilience.',body:'An active programme area reported by HOLIDO. Further project details and updates can be added by the organisation.',image:'',category:'Agriculture & Food Security',sort_order:1},
  {type:'project',title:'Adult Literacy',slug:'adult-literacy',summary:'Supporting access to literacy and learning opportunities.',body:'An active programme area reported by HOLIDO. Further project details and updates can be added by the organisation.',image:'',category:'Education',sort_order:2},
  {type:'project',title:'Savings with Education',slug:'savings-with-education',summary:'Supporting women’s groups through savings and education activities.',body:'An active programme area reported by HOLIDO. Further project details and updates can be added by the organisation.',image:'',category:'Education & livelihoods',sort_order:3},
  {type:'project',title:'Early Childhood Development',slug:'early-childhood-development',summary:'Supporting early childhood development and learner-centred education.',body:'An active programme area reported by HOLIDO. Further project details and updates can be added by the organisation.',image:'',category:'Education',sort_order:4},
  {type:'project',title:'Women & Youth Artisan Livelihoods',slug:'women-youth-artisan-livelihoods',summary:'Livelihood restoration and skills support for women and youth artisans in North-East Ghana.',body:'HOLIDO reports that, in partnership with UNDP under the UN Peacebuilding Fund, it supported 15 women and youth artisans in 9 rural communities across 3 districts of the North-East Region with equipment, refresher training and mentorship. The work included business and financial management skills and support for livelihoods and participation in conflict prevention.',image:'https://holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.01.07%20AM.jpeg',category:'Livelihoods · UNDP / UN Peacebuilding Fund',sort_order:5},
  {type:'story',title:'Livelihood & Hope Restored',slug:'livelihood-hope-restored',summary:'A woman re-established her petty trading shop after losing her livelihood to conflict.',body:'“I have been able to re-establish my petty trading shop after losing everything to conflict. I can now feed my household and pay my children’s school fees.”',image:'https://www.holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.01.07%20AM%20%281%29.jpeg',author:'Abdul-Rahman Alima',location:'Gbingbani',category:'Livelihoods',sort_order:1},
  {type:'story',title:'Value Addition in Nakpanduri',slug:'value-addition-nakpanduri',summary:'Groundnut processing has helped a local entrepreneur grow her business.',body:'“I now process at least 10 bowls of groundnut a week and sell as far as Kumasi. I have branded my products and opened a savings account.”',image:'https://www.holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.01.09%20AM.jpeg',author:'Kombat Clementina',location:'Nakpanduri',category:'Livelihoods',sort_order:2},
  {type:'story',title:'Disability is not Inability',slug:'disability-is-not-inability',summary:'A shoemaker expanded production and now trains apprentices.',body:'“I expanded production from 3 to 10 pairs of sandals a week and now train two apprentices who are also physically challenged.”',image:'https://www.holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.01.10%20AM.jpeg',author:'Monika John Kofi',location:'Bunkpurugu',category:'Inclusive livelihoods',sort_order:3},
  {type:'story',title:'New Equipment, New Skills',slug:'new-equipment-new-skills',summary:'New equipment and training strengthened a tailoring business.',body:'“With a modern knitting machine and training, my product quality improved, I won a school uniform contract and cleared my outstanding bills.”',image:'https://www.holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.00.44%20AM.jpeg',author:'Seidu Nyanda',location:'Jimbale',category:'Skills & livelihoods',sort_order:4},
  {type:'person',title:'Mr. George Dam Laar',slug:'george-dam-laar',summary:'Chairman & Founder',body:'Masters in Leadership & Development',role:'Chairman & Founder',sort_order:1},
  {type:'person',title:'Mr. Peter Chamik Jayom',slug:'peter-chamik-jayom',summary:'Member',body:'MSc, Development Management',role:'Member',sort_order:2},
  {type:'person',title:'Mr. Nunifu Buutmang',slug:'nunifu-buutmang',summary:'Secretary',body:'MSc, Agricultural Economics',role:'Secretary',sort_order:3},
  {type:'person',title:'Mr. Joila Simon Kojo',slug:'joila-simon-kojo',summary:'Treasurer',body:'Certificate in Engineering & Solar',role:'Treasurer',sort_order:4},
  {type:'person',title:'Mrs. Balonin Vida',slug:'balonin-vida',summary:'Financial Secretary',body:'Certificate in Midwifery',role:'Financial Secretary',sort_order:5},
  {type:'person',title:'Mrs. Wallai Dorcas',slug:'wallai-dorcas',summary:'Member',body:'Middle School Leaving Certificate',role:'Member',sort_order:6},
  {type:'person',title:'Mr. Isaac Suuk Laar',slug:'isaac-suuk-laar',summary:'Member',body:'BA, Integrated Development',role:'Member',sort_order:7}
 ];
 const tx = db.transaction(rows => rows.forEach(row => insert.run({...row, summary:row.summary||'', body:row.body||'', image:row.image||'', category:row.category||'', author:row.author||'', role:row.role||'', location:row.location||'', sort_order:row.sort_order||0})));
 tx(seeds);
}

// Ensure the documented UNDP / UN Peacebuilding Fund artisan-livelihoods project is present even when upgrading an existing database.
const artisanProject = db.prepare(`INSERT OR IGNORE INTO content(type,title,slug,summary,body,image,category,published,sort_order) VALUES('project',?,?,?,?,?,?,1,5)`);
artisanProject.run('Women & Youth Artisan Livelihoods','women-youth-artisan-livelihoods','Livelihood restoration and skills support for women and youth artisans in North-East Ghana.','HOLIDO reports that, in partnership with UNDP under the UN Peacebuilding Fund, it supported 15 women and youth artisans in 9 rural communities across 3 districts of the North-East Region with equipment, refresher training and mentorship. The work included business and financial management skills and support for livelihoods and participation in conflict prevention.','https://holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.01.07%20AM.jpeg','Livelihoods · UNDP / UN Peacebuilding Fund');

// Source-site photographs: documented impact stories and community activities.
// These images remain hosted by HOLIDO's source website until local media is supplied.
const sourcePhotos = [
 {type:'gallery',title:'Community equipment handover',slug:'community-equipment-handover',summary:'HOLIDO community beneficiaries pictured during an equipment and support handover activity.',image:'https://holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.01.07%20AM.jpeg',category:'Community activity',sort_order:1},
 {type:'gallery',title:'Livelihood restored through petty trading',slug:'livelihood-restored-petty-trading',summary:'Abdul-Rahman Alima at her revamped provision shop in Gbingbani.',image:'https://holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.01.07%20AM%20%281%29.jpeg',category:'Impact story',sort_order:2},
 {type:'gallery',title:'Groundnut processing and value addition',slug:'groundnut-processing-value-addition',summary:'A woman entrepreneur processing and packaging groundnuts in Nakpanduri.',image:'https://holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.01.09%20AM.jpeg',category:'Impact story',sort_order:3},
 {type:'gallery',title:'Inclusive shoemaking enterprise',slug:'inclusive-shoemaking-enterprise',summary:'A shoemaker in Bunkpurugu expanding production and supporting apprentices.',image:'https://holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.01.10%20AM.jpeg',category:'Impact story',sort_order:4},
 {type:'gallery',title:'Tailoring enterprise and new equipment',slug:'tailoring-enterprise-new-equipment',summary:'Seidu Nyanda in his dress-making shop in Jimbale.',image:'https://holido.org/images/WhatsApp%20Image%202026-06-15%20at%2010.00.44%20AM.jpeg',category:'Impact story',sort_order:5},
 {type:'gallery',title:'Women learning and working with knitting equipment',slug:'women-knitting-equipment',summary:'Women operating a knitting machine in a tailoring shop.',image:'https://holido.org/images/WhatsApp%20Image%202026-06-15%20at%209.59.10%20AM.jpeg',category:'Skills and livelihoods',sort_order:6}
];
const addPhoto = db.prepare(`INSERT OR IGNORE INTO content(type,title,slug,summary,image,category,published,sort_order) VALUES(@type,@title,@slug,@summary,@image,@category,1,@sort_order)`);
sourcePhotos.forEach(photo => addPhoto.run(photo));

// Content published on HOLIDO's own website (holido.org): partners & collaborators and the UNDP / UN Peacebuilding Fund success story.
// Names only: no partner logos are used. Roles are not described beyond what HOLIDO publishes.
const addPartner = db.prepare(`INSERT OR IGNORE INTO content(type,title,slug,summary,category,published,sort_order) VALUES('partner',@title,@slug,@summary,@category,1,@sort_order)`);
[
 {title:'Ministry of Food & Agriculture (MOFA)',slug:'mofa',summary:'Listed by HOLIDO as a partner and collaborator.',category:'Government partner',sort_order:1},
 {title:'Ghana Education Service (GES)',slug:'ghana-education-service',summary:'Listed by HOLIDO as a partner and collaborator.',category:'Government partner',sort_order:2},
 {title:'Ghana Health Service (GHS)',slug:'ghana-health-service',summary:'Listed by HOLIDO as a partner and collaborator.',category:'Government partner',sort_order:3},
 {title:'Department of Social Welfare (DSW)',slug:'department-of-social-welfare',summary:'Listed by HOLIDO as a partner and collaborator. HOLIDO is also registered with the Department (Reg. No. DSW/8097).',category:'Government partner',sort_order:4},
 {title:'District Assemblies (MMDAs)',slug:'district-assemblies-mmdas',summary:'Listed by HOLIDO as a partner and collaborator.',category:'Local government',sort_order:5},
 {title:'UNDP & UN Peacebuilding Fund',slug:'undp-un-peacebuilding-fund',summary:'HOLIDO delivered a project with UNDP under the UN Peacebuilding Fund, supporting women and youth artisans in North-East Ghana.',category:'Development partner',sort_order:6}
].forEach(x=>addPartner.run(x));
db.prepare(`INSERT OR IGNORE INTO content(type,title,slug,summary,body,image,category,author,location,published,sort_order) VALUES('story',?,?,?,?,?,?,?,?,1,5)`).run(
 'Building Stronger Communities','building-stronger-communities',
 'HOLIDO and UNDP supported 15 women and youth artisans in 9 rural communities across 3 districts of the North-East Region.',
 'HOLIDO, in partnership with UNDP under the UN Peacebuilding Fund, supported 15 women and youth artisans in 9 rural communities across 3 districts of the North-East Region with equipment, refresher trainings and mentorship.\n\nThe trainings equipped beneficiaries with business and financial management skills that help them generate income, improve their wellbeing, and actively participate in conflict prevention efforts, building stronger, more resilient communities.\n\n\u201cWith the machines I received from HOLIDO, I now own a shop and have 2 apprentices. I can now speak and contribute in public.\u201d',
 'https://holido.org/images/WhatsApp%20Image%202026-06-15%20at%209.59.10%20AM.jpeg','Success story','Madam Annatu','Wenchiki');

// Ensure the cross-border FGM project is present on both fresh installs and existing databases.
// No dates, funders, partners, activities, outcomes or imagery are asserted without verified source details.
db.prepare(`INSERT OR IGNORE INTO content(type,title,slug,summary,body,image,category,published,sort_order)
 VALUES('project', @title, @slug, @summary, @body, '', @category, 1, @sort_order)`).run({
 title: 'Ending Female Genital Mutilation in the Cross-Border Region of Ghana and Burkina Faso',
 slug: 'ending-female-genital-mutilation-ghana-burkina-faso',
 summary: 'A cross-border project focused on ending female genital mutilation in communities along the Ghana–Burkina Faso border.',
 body: 'This project forms part of HOLIDO’s programme work. Further verified information about its implementation, locations, partners, dates, activities, results and photographs can be added through the website administration area.',
 category: 'Health',
 sort_order: 6
});

// Keep programme cards focused on the three verified thematic areas; source photos are shown in the activity gallery with accurate captions.
const clearProgramImages = db.prepare("UPDATE content SET image='' WHERE type='program' AND slug IN ('agriculture-food-security','education','health')");
clearProgramImages.run();

const bcrypt = require('bcryptjs');
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(adminEmail);
  if (existing) {
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, existing.id);
  } else {
    db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(adminEmail, hash);
  }
}

module.exports = db;
