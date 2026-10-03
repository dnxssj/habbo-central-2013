const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

const state={me:null};

async function api(url,opt={}){
  const r=await fetch(url,{
    headers:{
      'Content-Type':'application/json',
      ...(opt.headers||{})
    },
    ...opt
  });

  const d=await r.json().catch(()=>({}));

  if(!r.ok){
    throw new Error(
      d.detail
        ? `${d.error||'Error'}: ${d.detail}`
        : (d.error||'Error')
    );
  }

  return d;
}

function modal(title,body){
  $('#modal').innerHTML=`
    <div class="modalbox">
      <div class="modalhead">
        <span>${title}</span>
        <button class="mini" onclick="closeModal()">✕</button>
      </div>
      <div class="modalbody">${body}</div>
    </div>
  `;

  $('#modal').classList.remove('hidden');
}

function closeModal(){
  $('#modal').classList.add('hidden');
}

window.closeModal=closeModal;

function esc(s=''){
  return String(s).replace(
    /[&<>'"]/g,
    c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      "'":'&#39;',
      '"':'&quot;'
    }[c])
  );
}

async function refreshMe(){
  state.me=(await api('/api/me')).user;
  renderAccount();
}

function renderAccount(){
  const a=$('#account');

  a.innerHTML=state.me
    ? `
      <div class="account">
        <span class="userpill" onclick="profile('${esc(state.me.username)}')">
          ${esc(state.me.username)}
        </span>
        <button onclick="logout()">Salir</button>
      </div>
    `
    : `
      <div class="account">
        <button onclick="login()">Entrar</button>
        <button onclick="register()">Registrarse</button>
      </div>
    `;
}

window.login=()=>{
  modal(
    'Entrar',
    `
    <form id="loginForm">
      <div class="field">
        <label>Usuario o email</label>
        <input class="input" name="login" required>
      </div>

      <div class="field" style="margin-top:10px">
        <label>Contraseña</label>
        <input class="input" type="password" name="password" required>
      </div>

      <div class="actionsbar">
        <button class="btn" type="submit">Entrar</button>
      </div>
    </form>
    `
  );

  const form=$('#loginForm');

  if(form){
    form.addEventListener('submit',async e=>{
      e.preventDefault();

      try{
        const f=new FormData(e.target);

        await api('/api/auth/login',{
          method:'POST',
          body:JSON.stringify(Object.fromEntries(f))
        });

        closeModal();
        await refreshMe();
        location.hash='home';

      }catch(x){
        alert(x.message);
      }
    });
  }
};

window.register=()=>{
  modal(
    'Crear cuenta',
    `
    <form id="regForm">
      <div class="formgrid">

        <div class="field">
          <label>Usuario</label>
          <input class="input" name="username" minlength="3" maxlength="20" required>
        </div>

        <div class="field">
          <label>Email</label>
          <input class="input" name="email" type="email" required>
        </div>

        <div class="field full">
          <label>Contraseña</label>
          <input class="input" name="password" type="password" minlength="8" required>
        </div>

      </div>

      <div class="actionsbar">
        <button class="btn" type="submit">Crear cuenta</button>
      </div>
    </form>
    `
  );

  const form=$('#regForm');

  if(form){
    form.addEventListener('submit',async e=>{
      e.preventDefault();

      try{
        const f=new FormData(e.target);

        await api('/api/auth/register',{
          method:'POST',
          body:JSON.stringify(Object.fromEntries(f))
        });

        closeModal();
        await refreshMe();
        profile(state.me.username);

      }catch(x){
        alert(x.message);
      }
    });
  }
};

window.logout=async()=>{
  await api('/api/auth/logout',{
    method:'POST'
  });

  await refreshMe();
  home();
};

function home(){
  location.hash='home';
  renderHome();
}

async function renderHome(){
  const [h,n]=await Promise.all([
    api('/api/hotels'),
    api('/api/news')
  ]);

  $('#app').innerHTML=`
    <section class="hero">

      <div class="hero-main">
        <h1>La central de tu comunidad Habbo</h1>
        <p>
          Hoteles, noticias, herramientas, rankings y perfiles.
          Con el sabor de los grandes fansites de 2012–2013.
        </p>

        <button class="btn" onclick="hotels()">
          Ver hoteles
        </button>

        <div class="habbo">🕺</div>
      </div>

      <div class="panel">
        <div class="ph">Hotel más votado</div>
        ${hotelCard(h.hotels[0])}
      </div>

    </section>

    <div class="grid">

      <section class="panel">
        <h2>Últimas noticias</h2>
        ${n.news.slice(0,4).map(newsCard).join('')}
      </section>

      <section class="panel">
        <h2>Hoteles destacados</h2>
        ${h.hotels.slice(0,4).map(hotelRow).join('')}
      </section>

    </div>
  `;
}

function hotelRow(h){
  return `
    <div class="hotel">
      <div class="ico">🏨</div>

      <div class="grow">
        <h3>${esc(h.name)}</h3>

        <div class="meta">
          ${h.language} ·
          <span class="${h.status==='online'?'online':'offline'}">
            ● ${h.status}
          </span>
          · ${h.users_online} usuarios
        </div>
      </div>

      <button
        class="btn blue mini"
        onclick="hotel('${esc(h.slug)}')"
      >
        Ver
      </button>
    </div>
  `;
}

function hotelCard(h){
  return h
    ? `
      <div class="pad">
        <h3 style="margin-top:0;color:#17618c">
          ${esc(h.name)}
        </h3>

        <p>${esc(h.description)}</p>

        <div class="meta">
          ★ ${h.votes} votos · ${h.users_online} online
        </div>

        <div class="actionsbar">
          <button
            class="btn blue"
            onclick="hotel('${esc(h.slug)}')"
          >
            Ficha
          </button>
        </div>
      </div>
    `
    : '<div class="pad">Sin hoteles.</div>';
}

function newsCard(n){
  return `
    <div
      class="newsrow"
      onclick="article('${esc(n.slug)}')"
    >
      <h3>${esc(n.title)}</h3>
      <p>${esc(n.excerpt)}</p>
    </div>
  `;
}

async function hotels(){
  location.hash='hotels';

  const h=await api('/api/hotels');

  $('#app').innerHTML=`
    <section class="panel">

      <h2>Directorio de hoteles</h2>

      <div class="pad">

        <div class="filters">

          <input
            id="hs"
            class="input"
            placeholder="Buscar hotel..."
          >

          <select id="hl">
            <option value="">Todos los idiomas</option>
            <option>ES</option>
            <option>EN</option>
            <option>DE</option>
            <option>BR</option>
          </select>

          <select id="hst">
            <option value="">Todos</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>

          <button
            class="btn blue"
            onclick="searchHotels()"
          >
            Buscar
          </button>

          <button
            class="btn"
            onclick="addHotel()"
          >
            Añadir hotel
          </button>

        </div>

      </div>

      <div id="hotelList">
        ${h.hotels.map(hotelRow).join('')}
      </div>

    </section>
  `;
}

window.searchHotels=async()=>{
  const q=new URLSearchParams({
    search:$('#hs').value,
    language:$('#hl').value,
    status:$('#hst').value
  });

  const h=await api('/api/hotels?'+q);

  $('#hotelList').innerHTML=
    h.hotels.map(hotelRow).join('')||
    '<div class="pad">No hay resultados.</div>';
};

window.addHotel=()=>{
  if(!state.me) return login();

  modal(
    'Añadir hotel',
    `
    <form id="hotelForm">

      <div class="field">
        <label>Nombre</label>
        <input class="input" name="name" required>
      </div>

      <div class="field">
        <label>URL</label>
        <input class="input" name="url" type="url" required>
      </div>

      <div class="formgrid" style="margin-top:10px">

        <div class="field">
          <label>Idioma</label>
          <select name="language">
            <option>ES</option>
            <option>EN</option>
            <option>DE</option>
            <option>BR</option>
          </select>
        </div>

        <div class="field">
          <label>Descripción</label>
          <input class="input" name="description">
        </div>

      </div>

      <div class="actionsbar">
        <button class="btn" type="submit">
          Enviar hotel
        </button>
      </div>

    </form>
    `
  );

  const form=$('#hotelForm');

  if(form){
    form.addEventListener('submit',async e=>{
      e.preventDefault();

      try{
        const f=new FormData(e.target);

        await api('/api/hotels',{
          method:'POST',
          body:JSON.stringify(Object.fromEntries(f))
        });

        closeModal();
        hotels();

      }catch(x){
        alert(x.message);
      }
    });
  }
};

window.hotel=async slug=>{
  const {hotel:h}=await api('/api/hotels/'+slug);

  $('#app').innerHTML=`
    <section class="panel">

      <h2>${esc(h.name)}</h2>

      <div class="pad">

        <div class="profile">

          <div>
            <div class="avatar">🏨</div>
          </div>

          <div>

            <h1 style="margin-top:0;color:#17618c">
              ${esc(h.name)}
            </h1>

            <p>${esc(h.description)}</p>

            <p>
              <b>Estado:</b>
              <span class="${h.status==='online'?'online':'offline'}">
                ${h.status}
              </span>
              <br>

              <b>Usuarios:</b> ${h.users_online}
              <br>

              <b>Idioma:</b> ${h.language}
              <br>

              <b>Votos:</b> ${h.votes}
            </p>

            <div class="actionsbar">

              <button
                class="btn"
                onclick="vote(${h.id})"
              >
                ★ Votar
              </button>

              <a
                class="btn blue"
                href="${esc(h.url)}"
                target="_blank"
                rel="noopener"
              >
                Entrar al hotel
              </a>

            </div>

          </div>

        </div>

      </div>

    </section>
  `;
};

window.vote=async id=>{
  if(!state.me) return login();

  try{
    await api('/api/hotels/'+id+'/vote',{
      method:'POST'
    });

    alert('Voto registrado.');

  }catch(x){
    alert(x.message);
  }
};

async function ranking(){
  location.hash='ranking';

  const {hotels}=await api('/api/hotels');

  $('#app').innerHTML=`
    <section class="panel">

      <h2>Ranking de hoteles</h2>

      ${hotels.map((h,i)=>`
        <div class="rank">

          <div class="rankno">
            ${i+1}
          </div>

          <div>
            <b>${esc(h.name)}</b>

            <div class="meta">
              ${h.users_online} online · ${h.language}
            </div>
          </div>

          <strong>
            ★ ${h.votes}
          </strong>

        </div>
      `).join('')}

    </section>
  `;
}

async function news(){
  location.hash='news';

  const {news:n}=await api('/api/news');

  $('#app').innerHTML=`
    <section class="panel">
      <h2>Noticias</h2>
      ${n.map(newsCard).join('')}
    </section>
  `;
}

async function article(slug){
  const {article:n}=await api('/api/news/'+slug);

  $('#app').innerHTML=`
    <section class="panel">

      <h2>${esc(n.title)}</h2>

      <div class="pad">

        <div class="meta">
          Por ${esc(n.author||'Habbo Central')}
          ·
          ${new Date(n.published_at).toLocaleDateString('es-ES')}
        </div>

        <h3>${esc(n.excerpt)}</h3>

        <p style="line-height:1.7">
          ${esc(n.content)}
        </p>

      </div>

    </section>
  `;
}

function tools(){
  location.hash='tools';

  $('#app').innerHTML=`
    <section class="panel">

      <h2>Herramientas Habbo</h2>

      <div class="pad tools">

        <div class="tool" onclick="avatarTool()">
          <b>Avatar Imager</b>
          <span>
            Renderiza un Habbo a partir de su figure string.
          </span>
        </div>

        <div class="tool" onclick="badgeTool()">
          <b>Badge Viewer</b>
          <span>
            Visualiza una badge concreta por código.
          </span>
        </div>

        <div class="tool" onclick="badgeExplorer()">
          <b>Badge Explorer</b>
          <span>
            Explora, busca y filtra el catálogo de badges de Habbo.
          </span>
        </div>

        <div class="tool" onclick="furniTool()">
          <b>Furni Explorer</b>
          <span>
            Buscador preparado para conectar furnidata.
          </span>
        </div>

      </div>

    </section>
  `;
}

window.avatarTool=()=>{
  modal(
    'Avatar Imager',
    `
    <p>Introduce una figure string.</p>

    <input
      id="figure"
      class="input"
      value="hd-180-1.ch-210-66.lg-270-82.sh-290-81.hr-100-61"
    >

    <div class="actionsbar">
      <button
        class="btn blue"
        onclick="renderAvatar()"
      >
        Generar
      </button>
    </div>

    <div
      id="avatarOut"
      style="margin-top:15px;text-align:center"
    ></div>
    `
  );
};

window.renderAvatar=()=>{
  $('#avatarOut').innerHTML=
    '<div style="font-size:90px">🧍</div>'+
    '<div class="meta">Figure: '+
    esc($('#figure').value)+
    '</div>';
};

window.badgeTool=()=>{
  modal(
    'Badge Viewer',
    `
    <p>
      Introduce el código exacto de una badge.
      Esta herramienta sigue siendo independiente del explorador.
    </p>

    <div style="display:flex;gap:8px">

      <input
        id="badgeCode"
        class="input"
        value="ADM"
      >

      <button
        class="btn blue"
        onclick="viewBadge()"
      >
        Ver
      </button>

    </div>

    <div
      id="badgeOut"
      style="text-align:center;margin-top:15px"
    ></div>
    `
  );
};

window.viewBadge=async()=>{
  const code=$('#badgeCode').value.trim();

  if(!code) return;

  $('#badgeOut').innerHTML=
    '<div class=meta>Cargando...</div>';

  try{
    const {badge}=await api(
      '/api/badges/'+encodeURIComponent(code)
    );

    $('#badgeOut').innerHTML=`
      <div class="badge-preview">

        <img
          class="badge"
          style="width:64px;height:64px"
          src="${esc(badge.image)}"
          alt="${esc(badge.code)}"
        >

        <b>${esc(badge.code)}</b>

        <span>
          ${esc(badge.name||'')}
        </span>

        <small>
          ${esc(badge.description||'Sin descripción')}
        </small>

      </div>
    `;

  }catch(x){
    $('#badgeOut').innerHTML=
      '<div class="meta error">'+
      esc(x.message)+
      '</div>';
  }
};

let badgeExplorerState={
  hotel:'all',
  term:'',
  page:1,
  limit:48,
  order:'desc'
};

function badgeHotels(){
  return [
    ['all','Todos'],
    ['int','INT'],
    ['de','DE'],
    ['com','COM'],
    ['br','COM.BR'],
    ['es','ES'],
    ['fr','FR'],
    ['tr','COM.TR'],
    ['nl','NL'],
    ['it','IT'],
    ['fi','FI']
  ];
}

async function badgeExplorer(){
  location.hash='badges';

  badgeExplorerState={
    ...badgeExplorerState,
    page:1
  };

  $('#app').innerHTML=`
    <section class="panel badge-explorer">

      <h2>Badge Explorer</h2>

      <div class="badge-toolbar pad">

        <div class="hotel-tabs">

          ${badgeHotels().map(([v,l])=>`
            <button
              class="hotel-tab ${v===badgeExplorerState.hotel?'active':''}"
              onclick="setBadgeHotel('${v}')"
            >
              ${l}
            </button>
          `).join('')}

        </div>

        <div class="badge-search">

          <input
            id="badgeSearch"
            class="input"
            placeholder="Badge o descripción..."
            value="${esc(badgeExplorerState.term)}"
          >

          <button
            class="btn blue"
            onclick="searchBadges()"
          >
            Buscar
          </button>

          <button
            class="btn"
            onclick="resetBadges()"
          >
            Limpiar
          </button>

        </div>

        <div class="badge-options">

          <label>
            <input
              type="checkbox"
              id="countryBadges"
            >
            Solo badges de país
          </label>

          <select
            id="badgeOrder"
            onchange="changeBadgeOrder()"
          >
            <option value="desc">Más recientes</option>
            <option value="asc">Más antiguas</option>
          </select>

        </div>

      </div>

      <div
        id="badgeGrid"
        class="badge-grid pad"
      ></div>

      <div
        id="badgePager"
        class="badge-pager pad"
      ></div>

    </section>
  `;

  const search=$('#badgeSearch');

  if(search){
    search.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        searchBadges();
      }
    });
  }

  await loadBadgeExplorer();
}

window.setBadgeHotel=async hotel=>{
  badgeExplorerState.hotel=hotel;
  badgeExplorerState.page=1;

  await badgeExplorer();
};

window.searchBadges=async()=>{
  badgeExplorerState.term=$('#badgeSearch').value.trim();
  badgeExplorerState.page=1;

  await loadBadgeExplorer();
};

window.resetBadges=async()=>{
  badgeExplorerState={
    hotel:'all',
    term:'',
    page:1,
    limit:48,
    order:'desc'
  };

  await badgeExplorer();
};

window.changeBadgeOrder=async()=>{
  badgeExplorerState.order=$('#badgeOrder').value;
  badgeExplorerState.page=1;

  await loadBadgeExplorer();
};

async function loadBadgeExplorer(){
  const offset=
    (badgeExplorerState.page-1)*
    badgeExplorerState.limit;

  $('#badgeGrid').innerHTML=
    '<div class="badge-loading">Cargando badges...</div>';

  try{
    const q=new URLSearchParams({
      hotel:badgeExplorerState.hotel,
      term:badgeExplorerState.term,
      limit:badgeExplorerState.limit,
      offset,
      order:badgeExplorerState.order
    });

    const d=await api('/api/badges?'+q);

    let list=d.badges||[];

    if($('#countryBadges')?.checked){
      const prefixes=[
        'DE',
        'ES',
        'FI',
        'FR',
        'IT',
        'NL',
        'TR',
        'BR',
        'US'
      ];

      list=list.filter(
        b=>prefixes.some(
          p=>b.code.toUpperCase().startsWith(p)
        )
      );
    }

    $('#badgeGrid').innerHTML=
      list.map(b=>`
        <button
          class="badge-card"
          onclick="badgeDetails(
            '${encodeURIComponent(b.code)}',
            '${esc(b.name||'')}',
            '${esc(b.description||'')}',
            '${esc(b.image||'')}'
          )"
        >

          <span class="badge-image-wrap">

            <img
              src="${esc(b.image)}"
              alt="${esc(b.code)}"
              loading="lazy"
              onerror="this.parentElement.classList.add('broken')"
            >

          </span>

          <b>${esc(b.code)}</b>

          <small>
            ${esc(b.name||b.description||'')}
          </small>

        </button>
      `).join('')||
      '<div class="notice">No se encontraron badges con estos criterios.</div>';

    renderBadgePager(
      d.total||list.length
    );

  }catch(x){

    $('#badgeGrid').innerHTML=
      '<div class="notice error">'+
      'No se pudo cargar el catálogo de badges.'+
      '<br><small>'+
      esc(x.message)+
      '</small></div>';

    $('#badgePager').innerHTML='';
  }
}

function renderBadgePager(total){
  const pages=Math.max(
    1,
    Math.ceil(
      total/badgeExplorerState.limit
    )
  );

  $('#badgePager').innerHTML=`
    <div class="badge-pager-inner">

      <span>
        ${Number(total).toLocaleString('es-ES')}
        badges · página
        ${badgeExplorerState.page}
        de ${pages}
      </span>

      <div>

        <button
          class="mini"
          ${badgeExplorerState.page<=1?'disabled':''}
          onclick="badgePage(-1)"
        >
          «
        </button>

        <button
          class="mini"
          ${badgeExplorerState.page>=pages?'disabled':''}
          onclick="badgePage(1)"
        >
          »
        </button>

      </div>

    </div>
  `;
}

window.badgePage=async delta=>{
  badgeExplorerState.page=Math.max(
    1,
    badgeExplorerState.page+delta
  );

  await loadBadgeExplorer();

  document
    .querySelector('.badge-explorer')
    ?.scrollIntoView({
      behavior:'smooth',
      block:'start'
    });
};

window.badgeDetails=(
  code,
  name,
  description,
  image
)=>{
  modal(
    'Badge '+decodeURIComponent(code),
    `
    <div class="badge-detail">

      <img
        class="badge-detail-image"
        src="${image}"
        alt="${decodeURIComponent(code)}"
      >

      <div>

        <h3>
          ${name||decodeURIComponent(code)}
        </h3>

        <div class="meta">
          Código ${decodeURIComponent(code)}
        </div>

        <p>
          ${description||'Sin descripción disponible.'}
        </p>

        <div class="actionsbar">

          <button
            class="btn blue"
            onclick="badgeToolWithCode('${decodeURIComponent(code).replace(/'/g,"\\'")}')"
          >
            Abrir en Badge Viewer
          </button>

        </div>

      </div>

    </div>
    `
  );
};

window.badgeToolWithCode=code=>{
  closeModal();
  badgeTool();

  setTimeout(()=>{
    $('#badgeCode').value=code;
    viewBadge();
  },0);
};

window.furniTool=()=>{
  modal(
    'Furni Explorer',
    `
    <div class="notice">
      La interfaz está preparada para conectarse a furnidata.
      Puedes introducir un nombre o classname.
    </div>

    <input
      class="input"
      placeholder="Ej. throne"
    >

    <div class="actionsbar">

      <button
        class="btn blue"
        onclick="alert('Conecta furnidata en /api cuando quieras habilitar el catálogo completo.')"
      >
        Buscar
      </button>

    </div>
    `
  );
};

window.profile=async username=>{
  const {user:u}=await api(
    '/api/users/'+encodeURIComponent(username)
  );

  $('#app').innerHTML=`
    <section class="panel">

      <h2>
        Perfil de ${esc(u.username)}
      </h2>

      <div class="pad profile">

        <div>

          <div class="avatar">
            🧑
          </div>

          <div style="margin-top:8px">

            ${u.roles.map(r=>`
              <span
                class="role"
                style="background:${r.color}"
              >
                ${esc(r.label)}
              </span>
            `).join('')}

          </div>

        </div>

        <div>

          <h2
            style="
              background:none;
              color:#17618c;
              border:0;
              padding:0;
              text-shadow:none
            "
          >
            ${esc(u.username)}
          </h2>

          <p>
            ${esc(u.motto)}
          </p>

          <div class="meta">
            Miembro desde
            ${new Date(u.created_at).toLocaleDateString('es-ES')}
          </div>

          <h3 style="color:#17618c">
            Badges
          </h3>

          <div class="badges">

            ${
              u.badges.length
                ? u.badges.map(b=>`
                    <img
                      class="badge"
                      title="${esc(b.name)}"
                      src="${esc(b.image_url)}"
                      onerror="this.src='/badge.png'"
                    >
                  `).join('')
                : 'Sin badges'
            }

          </div>

          ${
            state.me?.id===u.id
              ? `
                <div class="actionsbar">

                  <button
                    class="btn blue"
                    onclick="editProfile()"
                  >
                    Editar perfil
                  </button>

                  <button
                    class="btn"
                    onclick="importBadges()"
                  >
                    Importar badges de Habbo
                  </button>

                </div>
              `
              : ''
          }

        </div>

      </div>

    </section>
  `;
};

window.editProfile=()=>{
  modal(
    'Editar perfil',
    `
    <form id="profileForm">

      <div class="field">
        <label>Frase</label>

        <input
          class="input"
          name="motto"
          value="${esc(state.me.motto)}"
        >
      </div>

      <div
        class="field"
        style="margin-top:10px"
      >
        <label>Figure string</label>

        <input
          class="input"
          name="avatar"
          value="${esc(state.me.avatar)}"
        >
      </div>

      <div class="actionsbar">

        <button
          class="btn"
          type="submit"
        >
          Guardar
        </button>

      </div>

    </form>
    `
  );

  const form=$('#profileForm');

  if(form){
    form.addEventListener('submit',async e=>{
      e.preventDefault();

      try{
        const f=new FormData(e.target);

        await api('/api/me',{
          method:'PATCH',
          body:JSON.stringify(
            Object.fromEntries(f)
          )
        });

        closeModal();
        await refreshMe();
        profile(state.me.username);

      }catch(x){
        alert(x.message);
      }
    });
  }
};

window.importBadges=()=>{
  modal(
    'Importar badges de Habbo',
    `
    <p>
      Consulta las badges públicas de tu Habbo
      y las añade a tu perfil.
    </p>

    <form id="imp">

      <div class="formgrid">

        <input
          class="input"
          name="habbo"
          placeholder="Nombre Habbo"
          required
        >

        <select name="hotel">
          <option value="es">habbo.es</option>
          <option value="com">habbo.com</option>
          <option value="de">habbo.de</option>
          <option value="com.br">habbo.com.br</option>
        </select>

      </div>

      <div class="actionsbar">

        <button
          class="btn"
          type="submit"
        >
          Importar
        </button>

      </div>

    </form>
    `
  );

  const form=$('#imp');

  if(form){
    form.addEventListener('submit',async e=>{
      e.preventDefault();

      try{
        const f=new FormData(e.target);

        const r=await api(
          '/api/me/badges/import',
          {
            method:'POST',
            body:JSON.stringify(
              Object.fromEntries(f)
            )
          }
        );

        alert(
          `${r.count} badges procesadas.`
        );

        closeModal();
        profile(state.me.username);

      }catch(x){
        alert(x.message);
      }
    });
  }
};

async function admin(){
  if(!state.me) return login();

  const s=await api('/api/admin/stats');

  $('#app').innerHTML=`
    <div class="grid">

      <section class="panel">

        <h2>Administración</h2>

        <div class="pad">

          <div class="notice">
            Roles:
            Trial → Helper → Reportero →
            Moderador → Publicidad →
            Administrador → Owner.
          </div>

          <p>
            Usuarios: <b>${s.users}</b> ·
            Hoteles: <b>${s.hotels}</b> ·
            Noticias: <b>${s.news}</b> ·
            Anuncios: <b>${s.ads}</b>
          </p>

          <div class="actionsbar">

            <button
              class="btn blue"
              onclick="manageUsers()"
            >
              Usuarios y roles
            </button>

            <button
              class="btn"
              onclick="manageAds()"
            >
              Publicidad
            </button>

          </div>

        </div>

      </section>

      <section class="panel">

        <h2>Auditoría</h2>

        ${s.audit.slice(0,12).map(x=>`
          <div class="newsrow">

            <b>${esc(x.action)}</b>

            <div class="meta">
              ${esc(x.target||'')}
              ·
              ${new Date(x.created_at).toLocaleString('es-ES')}
            </div>

          </div>
        `).join('')}

      </section>

    </div>
  `;
}

window.manageUsers=async()=>{
  const {users}=await api('/api/admin/users');
  const {roles:r}=await api('/api/roles');

  modal(
    'Usuarios y roles',
    `
    <div>

      ${users.map(u=>`
        <div class="newsrow">

          <b>${esc(u.username)}</b>

          <div class="meta">
            ${esc(u.email)}
          </div>

          <div style="margin-top:7px">

            ${r.map(x=>`
              <button
                class="mini"
                onclick="grantRole(${u.id},'${x.name}')"
              >
                + ${esc(x.label)}
              </button>
            `).join(' ')}

          </div>

        </div>
      `).join('')}

    </div>
    `
  );
};

window.grantRole=async(id,role)=>{
  try{
    await api(
      '/api/admin/users/'+id+'/roles',
      {
        method:'POST',
        body:JSON.stringify({role})
      }
    );

    alert('Rol asignado.');

  }catch(x){
    alert(x.message);
  }
};

window.manageAds=async()=>{
  const {ads}=await api('/api/admin/ads');

  modal(
    'Publicidad',
    `
    <form id="adForm">

      <div class="formgrid">

        <input
          class="input"
          name="title"
          placeholder="Título"
          required
        >

        <input
          class="input"
          name="target_url"
          placeholder="URL destino"
          required
        >

        <input
          class="input"
          name="image_url"
          placeholder="URL imagen"
        >

        <select name="placement">
          <option>sidebar</option>
          <option>banner</option>
        </select>

      </div>

      <div class="actionsbar">

        <button
          class="btn"
          type="submit"
        >
          Crear anuncio
        </button>

      </div>

    </form>

    <hr>

    ${ads.map(a=>`
      <div class="newsrow">

        <b>${esc(a.title)}</b>

        <div class="meta">
          ${a.active?'Activo':'Inactivo'}
          ·
          ${esc(a.target_url)}
        </div>

        <button
          class="mini"
          onclick="toggleAd(${a.id},${a.active?0:1})"
        >
          ${a.active?'Desactivar':'Activar'}
        </button>

      </div>
    `).join('')}
    `
  );

  const form=$('#adForm');

  if(form){
    form.addEventListener('submit',async e=>{
      e.preventDefault();

      const f=new FormData(e.target);

      try{
        await api('/api/admin/ads',{
          method:'POST',
          body:JSON.stringify(
            Object.fromEntries(f)
          )
        });

        closeModal();
        manageAds();

      }catch(x){
        alert(x.message);
      }
    });
  }
};

window.toggleAd=async(id,active)=>{
  await api(
    '/api/admin/ads/'+id,
    {
      method:'PATCH',
      body:JSON.stringify({active})
    }
  );

  manageAds();
};

$$('.top nav button').forEach(b=>{
  b.onclick=()=>{
    ({
      home,
      hotels,
      ranking,
      news,
      tools
    }[b.dataset.page]||home)();
  };
});

async function boot(){
  await refreshMe();

  $('#year').textContent=
    new Date().getFullYear();

  const p=location.hash.slice(1);

  if(p==='hotels'){
    hotels();
  }else if(p==='ranking'){
    ranking();
  }else if(p==='news'){
    news();
  }else if(p==='tools'){
    tools();
  }else if(p==='badges'){
    badgeExplorer();
  }else if(p==='admin'){
    admin();
  }else{
    home();
  }
}

boot();