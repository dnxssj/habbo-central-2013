import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import slugify from 'slugify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname,'data','central.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, motto TEXT DEFAULT '¡Bienvenido a Habbo Central!', avatar TEXT DEFAULT 'hd-180-1.ch-210-66.lg-270-82.sh-290-81.hr-100-61', created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_login TEXT);
CREATE TABLE IF NOT EXISTS roles(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, label TEXT NOT NULL, color TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS user_roles(user_id INTEGER NOT NULL, role_id INTEGER NOT NULL, PRIMARY KEY(user_id,role_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS badges(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '', image_url TEXT);
CREATE TABLE IF NOT EXISTS user_badges(user_id INTEGER NOT NULL, badge_id INTEGER NOT NULL, selected INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,badge_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(badge_id) REFERENCES badges(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS hotels(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, url TEXT NOT NULL, language TEXT DEFAULT 'ES', status TEXT DEFAULT 'offline', users_online INTEGER DEFAULT 0, description TEXT DEFAULT '', owner_id INTEGER, votes INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS hotel_votes(user_id INTEGER NOT NULL, hotel_id INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,hotel_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(hotel_id) REFERENCES hotels(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS news(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, excerpt TEXT NOT NULL, content TEXT NOT NULL, author_id INTEGER, status TEXT DEFAULT 'draft', published_at TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS ads(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, image_url TEXT, target_url TEXT NOT NULL, placement TEXT DEFAULT 'sidebar', active INTEGER DEFAULT 1, start_at TEXT, end_at TEXT);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, target TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL);
`);

const roles=[
  ['user','Usuario','#777',0],
  ['trial','Trial','#8b5cf6',10],
  ['helper','Helper','#22c55e',20],
  ['journalist','Reportero','#f59e0b',30],
  ['moderator','Moderador','#ef4444',40],
  ['advertising','Publicidad','#ec4899',50],
  ['administrator','Administrador','#2563eb',90],
  ['owner','Owner','#facc15',100]
];

const roleStmt=db.prepare('INSERT OR IGNORE INTO roles(name,label,color,level) VALUES(?,?,?,?)');
for(const r of roles) roleStmt.run(...r);

const badgeStmt=db.prepare('INSERT OR IGNORE INTO badges(code,name,description,image_url) VALUES(?,?,?,?)');

[
  ['HC01','Miembro de Habbo Central','Miembro registrado de la comunidad','https://images.habbo.com/c_images/album1584/HC01.gif'],
  ['HC02','Veterano','Miembro veterano de la comunidad','https://images.habbo.com/c_images/album1584/ACH_TradingPass1.gif'],
  ['HCDEV','Developer','Contribuidor técnico','https://images.habbo.com/c_images/album1584/ACH_Scripting1.gif']
].forEach(x=>badgeStmt.run(...x));

const adminExists=db.prepare('SELECT id FROM users WHERE username=?').get('Admin');

if(!adminExists){
  const hash=bcrypt.hashSync('Admin123!',12);
  const info=db.prepare('INSERT INTO users(username,email,password_hash,motto) VALUES(?,?,?,?)').run(
    'Admin',
    'admin@localhost',
    hash,
    'Administración de Habbo Central'
  );
  const owner=db.prepare('SELECT id FROM roles WHERE name=?').get('owner');
  db.prepare('INSERT INTO user_roles VALUES(?,?)').run(info.lastInsertRowid,owner.id);
}

const seedHotels=db.prepare('SELECT COUNT(*) c FROM hotels').get().c;

if(!seedHotels){
  const ins=db.prepare('INSERT INTO hotels(name,slug,url,language,status,users_online,description,votes) VALUES(?,?,?,?,?,?,?,?)');

  [
    ['Habbo.es','habbo-es','https://www.habbo.es','ES','online',1248,'El hotel oficial en español.',391],
    ['Habbo.com','habbo-com','https://www.habbo.com','EN','online',2841,'El hotel internacional.',521],
    ['Pixel Hotel','pixel-hotel','https://example.com','ES','offline',0,'Hotel retro de la comunidad.',87]
  ].forEach(x=>ins.run(...x));
}

const seedNews=db.prepare('SELECT COUNT(*) c FROM news').get().c;

if(!seedNews){
  const a=db.prepare('SELECT id FROM users WHERE username=?').get('Admin').id;

  const ins=db.prepare(
    'INSERT INTO news(title,slug,excerpt,content,author_id,status,published_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)'
  );

  [
    [
      'Bienvenido a Habbo Central',
      'bienvenido-a-habbo-central',
      'La nueva central de la comunidad ya está abierta.',
      'Noticias, hoteles, herramientas, perfiles y comunidad en un solo sitio.',
      a,
      'published'
    ],
    [
      'Vuelve la época dorada de los fansites',
      'fansites-2012',
      'Recuperamos la estética y el espíritu de los grandes fansites.',
      'Estamos reconstruyendo una central inspirada en 2012–2013 con herramientas actuales.',
      a,
      'published'
    ]
  ].forEach(x=>ins.run(...x));
}

const app=express();

app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true}));

app.use(session({
  secret:process.env.SESSION_SECRET||'change-me-in-production',
  resave:false,
  saveUninitialized:false,
  cookie:{
    httpOnly:true,
    sameSite:'lax',
    secure:false,
    maxAge:7*86400000
  }
}));

app.use(express.static(path.join(__dirname,'public')));

const q={
  userById:db.prepare('SELECT id,username,email,motto,avatar,created_at,last_login FROM users WHERE id=?'),
  roles:db.prepare('SELECT r.* FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=? ORDER BY r.level DESC'),
  badges:db.prepare('SELECT b.*,ub.selected FROM badges b JOIN user_badges ub ON ub.badge_id=b.id WHERE ub.user_id=? ORDER BY ub.selected DESC,b.id'),
  permission:db.prepare('SELECT MAX(r.level) level FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=?')
};

const BADGE_API='https://www.habboassets.com/api/v1/badges';

const BADGE_HOTELS={
  int:{label:'INT',api:'com',domain:'com'},
  de:{label:'DE',api:'de',domain:'de'},
  com:{label:'COM',api:'com',domain:'com'},
  br:{label:'COM.BR',api:'com.br',domain:'com.br'},
  es:{label:'ES',api:'es',domain:'es'},
  fr:{label:'FR',api:'fr',domain:'fr'},
  tr:{label:'COM.TR',api:'com.tr',domain:'com.tr'},
  nl:{label:'NL',api:'nl',domain:'nl'},
  it:{label:'IT',api:'it',domain:'it'},
  fi:{label:'FI',api:'fi',domain:'fi'}
};

const badgeCache=new Map();

function badgeImage(code,hotel='com'){
  const h=BADGE_HOTELS[hotel]||BADGE_HOTELS.com;
  return `https://www.habbo.${h.domain}/habbo-imaging/badge/${encodeURIComponent(code)}.gif`;
}

async function fetchBadges({term='',hotel='all',limit=48,offset=0,order='desc'}={}){
  const key=JSON.stringify({term,hotel,limit,offset,order});

  const cached=badgeCache.get(key);
  if(cached && cached.expires>Date.now()) return cached.data;

  const params=new URLSearchParams({
    limit:String(Math.min(Math.max(Number(limit)||48,1),2000)),
    offset:String(Math.max(Number(offset)||0,0)),
    order:order==='asc'?'asc':'desc'
  });

  if(term) params.set('term',term.trim());

  if(hotel && hotel!=='all'){
    params.set('hotel',BADGE_HOTELS[hotel]?.api||hotel);
  }

  const hosts=[
    'https://www.habboassets.com/api/v1/badges',
    'https://habboassets.com/api/v1/badges'
  ];

  let lastError=null;

  for(const base of hosts){
    const url=`${base}?${params}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);

    try{
      const r=await fetch(url,{
        headers:{
          accept:'application/json, text/plain, */*',
          'accept-language':'es-ES,es;q=0.9,en;q=0.8',
          'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36',
          'cache-control':'no-cache',
          referer:'https://www.habboassets.com/badges'
        },
        signal:controller.signal
      });

      const body=await r.text();

      if(r.ok){
        let raw;

        try{
          raw=JSON.parse(body);
        }catch{
          throw new Error('La API de badges devolvió una respuesta no válida');
        }

        const list=Array.isArray(raw)
          ? raw
          : Array.isArray(raw.data)
            ? raw.data
            : Array.isArray(raw.badges)
              ? raw.badges
              : Array.isArray(raw.results)
                ? raw.results
                : [];

        const total=Number(
          raw.total??
          raw.count??
          raw.pagination?.total??
          list.length
        );

        const badges=list
          .map(b=>({
            code:b.code||b.badgeCode||'',
            name:b.name||b.title||b.code||'',
            description:b.description||'',
            image:b.image||badgeImage(b.code||b.badgeCode||'',hotel)
          }))
          .filter(b=>b.code);

        const data={
          badges,
          total:total||badges.length,
          offset:Number(offset)||0,
          limit:Number(limit)||48,
          hotel,
          term
        };

        badgeCache.set(key,{
          expires:Date.now()+120000,
          data
        });

        return data;
      }

      lastError=new Error(
        `Badge API HTTP ${r.status}${body?` — ${body.slice(0,180)}`:''}`
      );

    }catch(e){
      lastError=e;
    }finally{
      clearTimeout(timer);
    }
  }

  throw lastError||new Error('No se pudo conectar con HabboAssets');
}

function current(req){
  return req.session.userId
    ? q.userById.get(req.session.userId)
    : null;
}

function requireAuth(req,res,next){
  if(!req.session.userId){
    return res.status(401).json({error:'AUTH_REQUIRED'});
  }
  next();
}

function requireLevel(level){
  return (req,res,next)=>{
    const p=q.permission.get(req.session.userId||0)?.level||0;

    if(p<level){
      return res.status(403).json({error:'FORBIDDEN'});
    }

    next();
  };
}

function log(req,action,target=''){
  if(req.session.userId){
    db.prepare(
      'INSERT INTO audit_log(user_id,action,target) VALUES(?,?,?)'
    ).run(req.session.userId,action,target);
  }
}

function publicUser(id){
  const u=q.userById.get(id);

  if(!u) return null;

  return {
    ...u,
    roles:q.roles.all(id),
    badges:q.badges.all(id)
  };
}

app.get('/api/me',(req,res)=>{
  const u=current(req);
  res.json({user:u?publicUser(u.id):null});
});

app.post('/api/auth/register',(req,res)=>{
  const {username,email,password}=req.body;

  if(
    !/^[a-zA-Z0-9_]{3,20}$/.test(username||'')||
    !/^\S+@\S+\.\S+$/.test(email||'')||
    String(password||'').length<8
  ){
    return res.status(400).json({error:'Datos de registro no válidos'});
  }

  try{
    const hash=bcrypt.hashSync(password,12);

    const info=db.prepare(
      'INSERT INTO users(username,email,password_hash) VALUES(?,?,?)'
    ).run(username,email.toLowerCase(),hash);

    const role=db.prepare(
      'SELECT id FROM roles WHERE name=?'
    ).get('user');

    db.prepare(
      'INSERT INTO user_roles VALUES(?,?)'
    ).run(info.lastInsertRowid,role.id);

    const badge=db.prepare(
      'SELECT id FROM badges WHERE code=?'
    ).get('HC01');

    db.prepare(
      'INSERT INTO user_badges(user_id,badge_id,selected) VALUES(?,?,1)'
    ).run(info.lastInsertRowid,badge.id);

    req.session.userId=Number(info.lastInsertRowid);

    log(req,'register',username);

    res.json({
      user:publicUser(req.session.userId)
    });

  }catch(e){
    res.status(409).json({
      error:e.message.includes('users.username')
        ? 'El nombre ya existe'
        : 'El email ya está registrado'
    });
  }
});

app.post('/api/auth/login',(req,res)=>{
  const {login,password}=req.body;

  const u=db.prepare(
    'SELECT * FROM users WHERE username=? OR email=?'
  ).get(login,login?.toLowerCase());

  if(!u||!bcrypt.compareSync(password||'',u.password_hash)){
    return res.status(401).json({
      error:'Usuario o contraseña incorrectos'
    });
  }

  req.session.userId=u.id;

  db.prepare(
    'UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?'
  ).run(u.id);

  log(req,'login',u.username);

  res.json({
    user:publicUser(u.id)
  });
});

app.post('/api/auth/logout',(req,res)=>
  req.session.destroy(()=>res.json({ok:true}))
);

app.get('/api/users/:username',(req,res)=>{
  const u=db.prepare(
    'SELECT id FROM users WHERE username=?'
  ).get(req.params.username);

  if(!u){
    return res.status(404).json({error:'No encontrado'});
  }

  res.json({
    user:publicUser(u.id)
  });
});

app.patch('/api/me',requireAuth,(req,res)=>{
  const {motto,avatar}=req.body;

  db.prepare(
    'UPDATE users SET motto=COALESCE(?,motto),avatar=COALESCE(?,avatar) WHERE id=?'
  ).run(motto,avatar,req.session.userId);

  res.json({
    user:publicUser(req.session.userId)
  });
});

app.get('/api/me/badges',requireAuth,(req,res)=>
  res.json({badges:q.badges.all(req.session.userId)})
);

app.post('/api/me/badges/select',requireAuth,(req,res)=>{
  const {badgeId}=req.body;

  db.prepare(
    'UPDATE user_badges SET selected=0 WHERE user_id=?'
  ).run(req.session.userId);

  db.prepare(
    'UPDATE user_badges SET selected=1 WHERE user_id=? AND badge_id=?'
  ).run(req.session.userId,badgeId);

  res.json({
    badges:q.badges.all(req.session.userId)
  });
});

app.post('/api/me/badges/import',requireAuth,async(req,res)=>{
  const {habbo,hotel='es'}=req.body;

  if(!habbo){
    return res.status(400).json({
      error:'Introduce un nombre Habbo'
    });
  }

  try{
    const r=await fetch(
      `https://www.habbo.${hotel}/api/public/users?name=${encodeURIComponent(habbo)}`
    );

    if(!r.ok){
      return res.status(404).json({
        error:'Habbo no encontrado'
      });
    }

    const data=await r.json();

    const uniqueId=data.uniqueId||data.unique_id;

    if(!uniqueId){
      return res.status(404).json({
        error:'No se encontró el identificador'
      });
    }

    const p=await fetch(
      `https://www.habbo.${hotel}/api/public/users/${encodeURIComponent(uniqueId)}/badges`
    );

    if(!p.ok){
      return res.status(502).json({
        error:'La API de Habbo no devolvió las badges'
      });
    }

    const badges=await p.json();

    for(
      const b of (Array.isArray(badges)?badges:[]).slice(0,100)
    ){
      const code=b.code||b.badgeCode;

      if(!code) continue;

      badgeStmt.run(
        code,
        code,
        'Importada desde Habbo',
        `https://images.habbo.com/c_images/album1584/${code}.gif`
      );

      const row=db.prepare(
        'SELECT id FROM badges WHERE code=?'
      ).get(code);

      db.prepare(
        'INSERT OR IGNORE INTO user_badges(user_id,badge_id,selected) VALUES(?,?,0)'
      ).run(req.session.userId,row.id);
    }

    log(req,'import_badges',habbo);

    res.json({
      badges:q.badges.all(req.session.userId),
      count:Array.isArray(badges)?badges.length:0
    });

  }catch(e){
    res.status(502).json({
      error:'No se pudo conectar con la API de Habbo'
    });
  }
});

app.get('/api/badges',async(req,res)=>{
  try{
    const data=await fetchBadges({
      term:String(req.query.term||''),
      hotel:String(req.query.hotel||'all'),
      limit:req.query.limit,
      offset:req.query.offset,
      order:req.query.order
    });

    res.json(data);

  }catch(e){
    res.status(502).json({
      error:'No se pudo cargar el catálogo de badges',
      detail:e.message
    });
  }
});

app.get('/api/badges/:code',async(req,res)=>{
  try{
    const data=await fetchBadges({
      term:req.params.code,
      hotel:String(req.query.hotel||'all'),
      limit:20,
      offset:0,
      order:'desc'
    });

    const badge=data.badges.find(
      b=>b.code.toLowerCase()===req.params.code.toLowerCase()
    )||data.badges[0];

    if(!badge){
      return res.status(404).json({
        error:'Badge no encontrada'
      });
    }

    res.json({badge});

  }catch(e){
    res.status(502).json({
      error:'No se pudo consultar la badge',
      detail:e.message
    });
  }
});

app.get('/api/hotels',(req,res)=>{
  let sql='SELECT * FROM hotels WHERE 1=1';
  let p=[];

  if(req.query.search){
    sql+=' AND (name LIKE ? OR description LIKE ?)';
    p.push(`%${req.query.search}%`,`%${req.query.search}%`);
  }

  if(req.query.language){
    sql+=' AND language=?';
    p.push(req.query.language);
  }

  if(req.query.status){
    sql+=' AND status=?';
    p.push(req.query.status);
  }

  sql+=' ORDER BY votes DESC, users_online DESC';

  res.json({
    hotels:db.prepare(sql).all(...p)
  });
});

app.post('/api/hotels',requireAuth,(req,res)=>{
  const {
    name,
    url,
    language='ES',
    description=''
  }=req.body;

  if(!name||!url){
    return res.status(400).json({
      error:'Nombre y URL son obligatorios'
    });
  }

  const slug=slugify(name,{
    lower:true,
    strict:true
  });

  try{
    const info=db.prepare(
      'INSERT INTO hotels(name,slug,url,language,description,owner_id) VALUES(?,?,?,?,?,?)'
    ).run(
      name,
      slug,
      url,
      language,
      description,
      req.session.userId
    );

    log(req,'hotel_create',name);

    res.status(201).json({
      hotel:db.prepare(
        'SELECT * FROM hotels WHERE id=?'
      ).get(info.lastInsertRowid)
    });

  }catch(e){
    res.status(409).json({
      error:'Ese hotel ya existe'
    });
  }
});

app.post('/api/hotels/:id/vote',requireAuth,(req,res)=>{
  try{
    db.prepare(
      'INSERT INTO hotel_votes(user_id,hotel_id) VALUES(?,?)'
    ).run(req.session.userId,req.params.id);

    db.prepare(
      'UPDATE hotels SET votes=votes+1 WHERE id=?'
    ).run(req.params.id);

    log(req,'hotel_vote',req.params.id);

    res.json({ok:true});

  }catch(e){
    res.status(409).json({
      error:'Ya has votado este hotel'
    });
  }
});

app.get('/api/hotels/:slug',(req,res)=>{
  const h=db.prepare(
    'SELECT * FROM hotels WHERE slug=?'
  ).get(req.params.slug);

  if(!h){
    return res.status(404).json({
      error:'No encontrado'
    });
  }

  res.json({hotel:h});
});

app.get('/api/news',(req,res)=>
  res.json({
    news:db.prepare(`
      SELECT n.id,n.title,n.slug,n.excerpt,n.content,n.published_at,u.username author
      FROM news n
      LEFT JOIN users u ON u.id=n.author_id
      WHERE n.status='published'
      ORDER BY n.published_at DESC
    `).all()
  })
);

app.get('/api/news/:slug',(req,res)=>{
  const n=db.prepare(`
    SELECT n.*,u.username author
    FROM news n
    LEFT JOIN users u ON u.id=n.author_id
    WHERE n.slug=? AND n.status='published'
  `).get(req.params.slug);

  if(!n){
    return res.status(404).json({
      error:'No encontrado'
    });
  }

  res.json({article:n});
});

app.post('/api/news',requireAuth,requireLevel(30),(req,res)=>{
  const {
    title,
    excerpt,
    content,
    status='draft'
  }=req.body;

  if(!title||!excerpt||!content){
    return res.status(400).json({
      error:'Faltan campos'
    });
  }

  const slug=slugify(title,{
    lower:true,
    strict:true
  })+'-'+Date.now();

  const info=db.prepare(
    'INSERT INTO news(title,slug,excerpt,content,author_id,status,published_at) VALUES(?,?,?,?,?,?,CASE WHEN ?="published" THEN CURRENT_TIMESTAMP ELSE NULL END)'
  ).run(
    title,
    slug,
    excerpt,
    content,
    req.session.userId,
    status,
    status
  );

  log(req,'news_create',title);

  res.status(201).json({
    article:db.prepare(
      'SELECT * FROM news WHERE id=?'
    ).get(info.lastInsertRowid)
  });
});

app.patch('/api/news/:id',requireAuth,requireLevel(30),(req,res)=>{
  const n=db.prepare(
    'SELECT * FROM news WHERE id=?'
  ).get(req.params.id);

  if(!n){
    return res.status(404).json({
      error:'No encontrado'
    });
  }

  const {
    title,
    excerpt,
    content,
    status
  }=req.body;

  db.prepare(`
    UPDATE news
    SET
      title=COALESCE(?,title),
      excerpt=COALESCE(?,excerpt),
      content=COALESCE(?,content),
      status=COALESCE(?,status),
      published_at=CASE
        WHEN ?="published" AND published_at IS NULL
        THEN CURRENT_TIMESTAMP
        ELSE published_at
      END,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    title,
    excerpt,
    content,
    status,
    status,
    req.params.id
  );

  log(req,'news_edit',req.params.id);

  res.json({
    article:db.prepare(
      'SELECT * FROM news WHERE id=?'
    ).get(req.params.id)
  });
});

app.delete('/api/news/:id',requireAuth,requireLevel(40),(req,res)=>{
  db.prepare(
    'DELETE FROM news WHERE id=?'
  ).run(req.params.id);

  log(req,'news_delete',req.params.id);

  res.json({ok:true});
});

app.get('/api/admin/stats',requireAuth,requireLevel(90),(req,res)=>
  res.json({
    users:db.prepare('SELECT COUNT(*) c FROM users').get().c,
    hotels:db.prepare('SELECT COUNT(*) c FROM hotels').get().c,
    news:db.prepare('SELECT COUNT(*) c FROM news').get().c,
    ads:db.prepare('SELECT COUNT(*) c FROM ads').get().c,
    audit:db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 50').all()
  })
);

app.get('/api/admin/users',requireAuth,requireLevel(90),(req,res)=>
  res.json({
    users:db.prepare(
      'SELECT id,username,email,motto,created_at,last_login FROM users ORDER BY id DESC'
    ).all()
  })
);

app.post('/api/admin/users/:id/roles',requireAuth,requireLevel(90),(req,res)=>{
  const {role}=req.body;

  const r=db.prepare(
    'SELECT id FROM roles WHERE name=?'
  ).get(role);

  if(!r){
    return res.status(404).json({
      error:'Rol no existe'
    });
  }

  db.prepare(
    'INSERT OR IGNORE INTO user_roles VALUES(?,?)'
  ).run(req.params.id,r.id);

  log(req,'role_grant',`${req.params.id}:${role}`);

  res.json({
    user:publicUser(req.params.id)
  });
});

app.delete('/api/admin/users/:id/roles/:role',requireAuth,requireLevel(90),(req,res)=>{
  const r=db.prepare(
    'SELECT id FROM roles WHERE name=?'
  ).get(req.params.role);

  if(r){
    db.prepare(
      'DELETE FROM user_roles WHERE user_id=? AND role_id=?'
    ).run(req.params.id,r.id);
  }

  log(req,'role_revoke',`${req.params.id}:${req.params.role}`);

  res.json({
    user:publicUser(req.params.id)
  });
});

app.get('/api/roles',requireAuth,requireLevel(90),(req,res)=>
  res.json({
    roles:db.prepare(
      'SELECT * FROM roles ORDER BY level'
    ).all()
  })
);

app.get('/api/admin/ads',requireAuth,requireLevel(50),(req,res)=>
  res.json({
    ads:db.prepare(
      'SELECT * FROM ads ORDER BY id DESC'
    ).all()
  })
);

app.post('/api/admin/ads',requireAuth,requireLevel(50),(req,res)=>{
  const {
    title,
    image_url,
    target_url,
    placement='sidebar',
    active=1
  }=req.body;

  if(!title||!target_url){
    return res.status(400).json({
      error:'Título y URL son obligatorios'
    });
  }

  const info=db.prepare(
    'INSERT INTO ads(title,image_url,target_url,placement,active) VALUES(?,?,?,?,?)'
  ).run(
    title,
    image_url||'',
    target_url,
    placement,
    active?1:0
  );

  log(req,'ad_create',title);

  res.status(201).json({
    ad:db.prepare(
      'SELECT * FROM ads WHERE id=?'
    ).get(info.lastInsertRowid)
  });
});

app.patch('/api/admin/ads/:id',requireAuth,requireLevel(50),(req,res)=>{
  const {
    active,
    title,
    image_url,
    target_url
  }=req.body;

  db.prepare(
    'UPDATE ads SET active=COALESCE(?,active),title=COALESCE(?,title),image_url=COALESCE(?,image_url),target_url=COALESCE(?,target_url) WHERE id=?'
  ).run(
    active==null?null:active?1:0,
    title,
    image_url,
    target_url,
    req.params.id
  );

  log(req,'ad_edit',req.params.id);

  res.json({
    ad:db.prepare(
      'SELECT * FROM ads WHERE id=?'
    ).get(req.params.id)
  });
});

app.delete('/api/admin/ads/:id',requireAuth,requireLevel(50),(req,res)=>{
  db.prepare(
    'DELETE FROM ads WHERE id=?'
  ).run(req.params.id);

  log(req,'ad_delete',req.params.id);

  res.json({ok:true});
});

app.get(/.*/,(req,res)=>
  res.sendFile(path.join(__dirname,'public','index.html'))
);

app.listen(
  process.env.PORT||3000,
  ()=>console.log(
    `Habbo Central running on http://localhost:${process.env.PORT||3000}`
  )
);