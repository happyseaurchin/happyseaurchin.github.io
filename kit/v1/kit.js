/* kit.js — the one script these pages share: it reads the beach and draws what it finds.
 *
 * Every word a reader sees is read from the beach as the page loads; the HTML holds only labels.
 * One call draws a family by its form — Kit.draw(mount, 'experiences') — so a new page is one
 * line, and only a new FORM needs new code here. config.js says whose pages these are and which
 * beach they read. Where every part of this file came from is in the README: David's own code
 * only (community-recovery's kit.js; happyseaurchin.com's walk, ring and theme.js), nothing from
 * anyone else's repository.
 */
(function(){
  'use strict';

  var CFG = window.PAGES || {};
  var HANDLE = String(CFG.handle || '');
  var BEACH = String(CFG.beach || 'https://beach.happyseaurchin.com').replace(/\/+$/, '');
  var SITE = String(CFG.site || 'https://happyseaurchin.com').replace(/\/+$/, '');
  var WIRE = BEACH + '/.well-known/pscale-beach';
  var EVERY = 30000;                     /* read again every thirty seconds while the page is seen */

  function sget(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function sset(k, v){ try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch(e){} }

  /* ── the beach ───────────────────────────────────────────────────────────────────────────── */

  /* every answer carries the shared clock: 'ISO | ten-digit sundial address | voicing' */
  var clock = null;
  function noteClock(r){
    var p = String(r.headers.get('X-Pscale-Now') || '').split('|').map(function(s){ return s.trim(); });
    if (p.length === 3 && /^\d{10}$/.test(p[1])) clock = { iso: p[0], address: p[1], voicing: p[2] };
  }
  /* A read the beach cannot answer THROWS; a block that is not there answers NULL. The two are
   * never confused, so a page says "couldn't be read" apart from "nothing here yet". The time in
   * the query keeps a browser from answering out of its own cache. */
  function get(q){
    return fetch(WIRE + '?' + (q ? q + '&' : '') + '_t=' + Date.now(), { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function(r){
        noteClock(r);
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('the beach answered ' + r.status);
        return r.json();
      });
  }
  function read(block){ return get('block=' + encodeURIComponent(block)); }
  function index(){ return get(''); }
  /* one node's own words, at an address the beach walks itself (a clock's ten digits) */
  function point(block, address, pscale){
    return get('block=' + encodeURIComponent(block) + '&spindle=' + encodeURIComponent(address) + '&pscale=' + pscale)
      .then(function(d){ return d && typeof d.content === 'string' ? d.content.trim() : ''; });
  }
  function present(idx){ var has = {}; names(idx).forEach(function(n){ has[n] = 1; }); return has; }
  function names(idx){
    var b = idx && idx.blocks;
    if (Array.isArray(b)) return b.map(function(n){ return typeof n === 'string' ? n : (n && n.name) || ''; }).filter(Boolean);
    return b && typeof b === 'object' ? Object.keys(b) : [];
  }

  function send(body){
    return fetch(WIRE + '?block=' + encodeURIComponent(body.block), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        return { ok: r.ok && j.ok !== false && !j.error, status: r.status, data: j || {} };
      });
    }, function(){ return { ok: false, status: 0, data: {} }; });
  }
  /* the beach reads a block, changes it and writes it back, so two writes to one block sent at
   * once can lose one of them: writes to the same block go one after another */
  var queue = {};
  function post(body){
    var k = body.block, run = function(){ return send(body); };
    return (queue[k] = (queue[k] || Promise.resolve()).then(run, run));
  }

  /* ── reading a block ─────────────────────────────────────────────────────────────────────── */

  /* a node's own words: a string, or the string at the end of its underscores */
  function voice(node){
    var n = node;
    while (n && typeof n === 'object'){ if (!('_' in n)) return null; n = n._; }
    return typeof n === 'string' ? n : null;
  }
  function text(node){ return (voice(node) || '').trim(); }
  /* the floor is how deep the root's underscores go: a sundial's are ten deep */
  function floorOf(block){
    var n = 0, node = block;
    while (node && typeof node === 'object' && ('_' in node)){ node = node._; n += 1; }
    return n;
  }
  function digits(node){
    return node && typeof node === 'object' ? Object.keys(node).filter(function(k){ return /^[1-9]$/.test(k); }).sort() : [];
  }
  /* walk an address, a digit at a time, a 0 being the underscore (trailing zeros are the floor's) */
  function at(block, address){
    var n = block, s = String(address || '').replace(/0+$/, '');
    for (var i = 0; i < s.length; i++){
      if (!n || typeof n !== 'object') return undefined;
      n = s.charAt(i) === '0' ? n._ : n[s.charAt(i)];
    }
    return n;
  }
  function textAt(block, address){
    var n = at(block, address);
    if (n == null) return '';
    return typeof n === 'string' ? n.trim() : text(n);
  }
  function dotted(a){ a = String(a || ''); return a.length > 1 ? a.charAt(0) + '.' + a.slice(1) : a; }
  /* a list where rank is depth: the first at the first rung, the next one rung further down */
  function ranked(node){
    var out = [];
    for (var i = 0; i < 60 && node && typeof node === 'object'; i++){
      node = node['1'];
      var t = text(node);
      if (t) out.push(t);
    }
    return out;
  }
  /* an accumulator, oldest first: what came before stands under '_' once it has grown past nine;
   * an entry is a node whose '_' is its words and whose 3 is when it arrived */
  function entries(node, out){
    out = out || [];
    if (!node || typeof node !== 'object') return out;
    if (node._ && typeof node._ === 'object') entries(node._, out);
    digits(node).forEach(function(k){
      var e = node[k];
      if (e && typeof e === 'object' && typeof e._ === 'string' && typeof e['3'] === 'string') out.push(e);
      else if (e && typeof e === 'object') entries(e, out);
    });
    return out;
  }

  /* ── the row grammar (tree 9.3): a node opens with its title in capitals, then ' — ', then the
   * line written to the person who arrives; a bracket holding a reference is for minds, and goes ── */
  function titled(s){
    var t = String(s || '').trim();
    var own = t.match(/^[a-z][\w-]*:[\w:-]+\s+—\s+/);
    if (own) t = t.slice(own[0].length);
    var m = t.match(/^([^a-z—]{2,80}?)\s+—\s+([\s\S]*)$/) || t.match(/^([A-Z][A-Z0-9 ,'’&()-]{2,60})\.\s+([\s\S]*)$/);
    if (!m || /[a-z]/.test(m[1]) || !/[A-Z]{2}/.test(m[1])) return null;
    var title = m[1].trim();
    return { title: title.charAt(0) + title.slice(1).toLowerCase(), line: m[2].trim() };
  }
  function plain(line, fam){
    var f = String(fam || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var s = String(line || '')
      .replace(/\s*\[[^\[\]]*\]/g, '')
      .replace(/\s*\(([^()]*)\)/g, function(m, inner){
        return /^\s*(see\s+)?[1-9](\.[1-9]+)?(\s*(,|;|–|-|and|to)\s*[1-9](\.[1-9]+)?)*\s*$/.test(inner)
          || /(^|[\s,;])[1-9]\.[1-9]+\b/.test(inner) || /\b[a-z][\w-]*:[a-z<][\w<>-]*/.test(inner) ? '' : m;
      });
    if (f) s = s.replace(new RegExp('\\b' + f + ':<your-handle>', 'g'), 'your own notebook')
      .replace(new RegExp('\\bspine:' + f + '\\b', 'g'), 'the plan')
      .replace(new RegExp('\\bfunction:' + f + '\\b', 'g'), 'the law')
      .replace(new RegExp('\\bpool:' + f + '\\b', 'g'), 'the room');
    return s.replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  }
  /* a title in capitals, else what stands before ' — ', else a 'Label. Body' line (task:weft 32.4) */
  function rowOf(line, fam){
    line = String(line || '').replace(/^[a-z][\w-]*:[\w:-]+\s+\u2014\s+/, '');   /* a root naming its own block first */
    var tt = titled(line);
    if (tt) return { title: tt.title, line: plain(tt.line, fam) };
    var s = plain(line, fam), i = s.indexOf(' — ');
    if (i > 0 && i <= 60) return { title: s.slice(0, i), line: s.slice(i + 3) };
    i = s.indexOf('. ');
    if (i > 0 && i <= 60 && s.indexOf(' — ') < 0) return { title: s.slice(0, i), line: s.slice(i + 2) };
    return { title: '', line: s };
  }
  /* a reading that opens with a word in capitals (DONE, DOING, BLOCKED; GREEN, AMBER, RED; OFFER,
   * WELCOME) is counted at its node */
  var MARK = /^([A-Z]{3,})(?=[\s,.:;—-]|$)/;
  function tally(lines){
    var n = {}, order = [];
    lines.forEach(function(s){
      var m = MARK.exec(s || '');
      if (!m) return;
      if (!n[m[1]]){ n[m[1]] = 0; order.push(m[1]); }
      n[m[1]] += 1;
    });
    return order.map(function(k){ return n[k] + ' ' + k.toLowerCase(); }).join(' · ');
  }
  function short(s, n){ s = s || ''; return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s; }

  /* ── drawing ─────────────────────────────────────────────────────────────────────────────── */

  function el(tag, cls, txt){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function link(href, txt, cls){ var e = el('a', cls, txt); e.href = href; return e; }
  function ago(iso){
    var t = Date.parse(iso);
    if (!isFinite(t)) return '';
    var now = clock ? Date.parse(clock.iso) : Date.now(), s = Math.max(0, (now - t) / 1000);
    if (s < 90) return 'just now';
    if (s < 5400) return Math.round(s / 60) + ' minutes ago';
    if (s < 129600) return Math.round(s / 3600) + ' hours ago';
    if (s < 86400 * 45) return Math.round(s / 86400) + ' days ago';
    return day(iso);
  }
  function day(iso){
    var t = Date.parse(iso);
    return isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  }
  function zeros(p){ return '0000000000'.slice(0, p); }

  /* light or dark: the device's own choice, unless this device chose otherwise on these pages */
  (function(){
    var saved = sget('kit:theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    document.addEventListener('click', function(e){
      var b = e.target && e.target.closest ? e.target.closest('.reg') : null;
      if (!b) return;
      var cur = document.documentElement.getAttribute('data-theme')
        || (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      var next = cur === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      sset('kit:theme', next);
    });
  })();
  /* the footer names the beach the words come from */
  function footer(){
    var f = document.querySelector('footer .beach');
    if (f && !f.firstChild){ var h = BEACH.replace(/^https?:\/\//, ''); f.appendChild(link(BEACH, h)); }
  }

  /* A PAGE: a status line beneath what it draws, read again every thirty seconds while the page
   * is seen, drawn again only when what the beach holds has changed and nobody is writing here.
   * When the beach cannot be reached, one plain line — never a blank page. */
  function page(mount, load, draw){
    footer();
    var body = el('div', 'body'), status = el('p', 'live', 'Reading from the beach…');
    mount.textContent = '';
    mount.appendChild(body);
    mount.appendChild(status);
    var last = null, drawn = false;
    function writing(){
      var boxes = body.querySelectorAll('textarea, input');
      for (var i = 0; i < boxes.length; i++) if (boxes[i] === document.activeElement || (boxes[i].tagName === 'TEXTAREA' && boxes[i].value.trim())) return true;
      return false;
    }
    function run(){
      return load().then(function(d){
        var sig = JSON.stringify(d);
        if (sig === last || (drawn && writing())) return;
        last = sig;
        var open = [];
        Array.prototype.forEach.call(body.querySelectorAll('details[open][data-key]'), function(x){ open.push(x.getAttribute('data-key')); });
        body.textContent = '';
        draw(body, d, again);
        Array.prototype.forEach.call(body.querySelectorAll('details[data-key]'), function(x){ if (open.indexOf(x.getAttribute('data-key')) >= 0) x.open = true; });
        drawn = true;
      });
    }
    function again(){
      return run().then(function(){
        status.className = 'live';
        status.textContent = 'live from the beach · read at ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      }, function(){
        status.className = 'live off';
        status.textContent = drawn ? 'The beach didn’t answer just now; this is what it said last.'
          : 'This page reads every word from the beach, and the beach can’t be reached just now. Please try again in a minute.';
      });
    }
    again();
    setInterval(function(){ if (!document.hidden) again(); }, EVERY);
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) again(); });
    return again;
  }

  /* ── who is writing: a name, and its key kept on this device (ring.html) ─────────────────── */

  var WHO = 'venture:who';
  function whoHere(){ return sget(WHO) || ''; }
  function keyFor(fam, name){ return sget('mirror-latch:' + fam + ':' + name) || sget('passport-latch:' + name) || ''; }
  function remember(fam, name, secret){ sset('mirror-latch:' + fam + ':' + name, secret); sset(WHO, name); }
  function refused(w, code){ return !!w && !w.ok && !!w.data && (w.data.code === code || w.data.error === code); }
  function refusal(w){
    if (refused(w, 'handle_bound')) return 'That name has a passport here with its own key: use that key, or choose another name.';
    if (refused(w, 'lock_required') || w.status === 403) return 'That name’s notebook is kept under another key. If it is yours, check the key.';
    return (w.data && (w.data.error || w.data.message)) || ('the beach answered ' + w.status);
  }
  /* three plain words offered as a key a person can keep (community-recovery's list); never a
   * passport — the pages write only the reader's own notebook (task:weft 32.41) */
  function threeWords(){
    var W = window.CR_WORDS, c = window.crypto;
    if (!W || !W.length || !c || !c.getRandomValues) return '';
    var buf = new Uint32Array(3), out = [];
    c.getRandomValues(buf);
    for (var i = 0; i < 3; i++) out.push(W[buf[i] % W.length]);
    return out.join(' ');
  }
  var KEPT = '\n\n(It is kept on this device. A phone may capitalise the first letter.)';
  function askKey(text, offer){ var v = window.prompt(text + KEPT, offer || ''); return v && v.trim() ? v.trim() : ''; }
  /* a write under a name's key: the one this device keeps, else asked for; asked once more when
   * the beach refuses it; kept once a write lands */
  function keyed(fam, name, block, founds, write){
    var secret = keyFor(fam, name);
    if (!secret) secret = askKey(founds
      ? founds + ', locked with a key of your own. Keep these three words as your key, or type the key your passport uses:'
      : block + ' is locked. Type its key:', founds ? threeWords() : '');
    if (!secret) return Promise.resolve(null);
    return write(secret).then(function(w){
      if (!refused(w, 'lock_required') && !refused(w, 'handle_bound')) return w;
      secret = askKey(refused(w, 'handle_bound')
        ? 'The beach ties ' + block + ' to ' + name + '’s passport. Type that key:'
        : 'That key was refused for ' + block + '. Type its key:', '');
      return secret ? write(secret) : null;
    }).then(function(w){ if (w && w.ok) remember(fam, name, secret); return w; });
  }
  /* A considered reading lands in the reader's own notebook — the mirror <family>:<name> — at the
   * point's own address; the first one founds the notebook under the reader's key. */
  function writeReading(fam, name, address, line){
    var block = fam + ':' + name;
    return read(block).then(function(stands){
      return keyed(fam, name, block, stands ? '' : 'Your first reading starts your own notebook for ' + fam, function(secret){
        var found = stands ? Promise.resolve({ ok: true }) : post({ block: block, new_lock: secret, content: {
          _: 'MIRROR — ' + name + '’s readings of ' + fam + ' (spine:' + fam + '), at the family’s own addresses. Only ' + name + ' writes here. First reading written from ' + location.host + '.'
        } });
        return found.then(function(w){
          if (!w.ok) return w;
          stands = true;
          return post({ block: block, spindle: address, content: line, secret: secret });
        });
      });
    });
  }
  /* a quick open note in the family's room, signed as a visitor so nobody can sign as a handle */
  function writeNote(fam, who, address, note){
    return post({ block: 'pool:' + fam, append: true, content: { _: note, 1: who, 2: dotted(address), 3: new Date().toISOString() } });
  }

  /* EVERY POINT ANSWERABLE, TWO WAYS (cook:happyseaurchin 2.4). The form is built when it is opened. */
  function answer(fam, address, room, done){
    var d = el('details', 'answer');
    d.setAttribute('data-key', 'answer:' + address);
    d.appendChild(el('summary', null, 'respond'));
    d.addEventListener('toggle', function build(){
      if (!d.open || d.querySelector('textarea')) return;
      var wrap = el('div', 'boxwrap'), box = el('textarea');
      box.rows = 3; box.maxLength = 4000;
      wrap.appendChild(box);
      var who = el('input', 'who'); who.maxLength = 32; who.placeholder = 'your name'; who.value = whoHere();
      var acts = el('div', 'acts'), keep = el('button', null, 'keep as my reading'), note = el('button', 'quiet', 'leave as a note');
      keep.type = note.type = 'button';
      var said = el('p', 'said');
      /* a reading needs a point to stand at: at the family as a whole there is only the room */
      if (address) acts.appendChild(keep);
      if (room) acts.appendChild(note);
      d.appendChild(wrap); d.appendChild(who); d.appendChild(acts); d.appendChild(said);
      if (window.dictate) window.dictate(box);
      keep.addEventListener('click', function(){
        var t = box.value.trim(), n = who.value.trim();
        if (!t){ said.textContent = 'Write or say something first.'; return; }
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(n)){ said.textContent = 'A name of up to 32 letters, digits, - or _ signs your reading.'; who.focus(); return; }
        keep.disabled = true; said.textContent = 'putting it beside this point…';
        writeReading(fam, n, address, t).then(function(w){
          keep.disabled = false;
          if (!w){ said.textContent = 'Nothing written: your words wait in the box.'; return; }
          if (!w.ok){ said.textContent = refusal(w); return; }
          box.value = ''; said.textContent = 'It stands beside this point in your name. Writing again here replaces it.';
          done();
        });
      });
      note.addEventListener('click', function(){
        var t = box.value.trim(), n = who.value.replace(/\s+/g, ' ').trim().slice(0, 40);
        if (!t){ said.textContent = 'Write or say something first.'; return; }
        note.disabled = true; said.textContent = 'leaving it in the room…';
        writeNote(fam, n ? n + ', a visitor' : 'a visitor', address, t).then(function(w){
          note.disabled = false;
          if (!w.ok){ said.textContent = refusal(w); return; }
          box.value = ''; said.textContent = 'Your note is in the room, for everyone who reads this.';
          done();
        });
      });
    });
    return d;
  }
  /* read aloud (community-recovery's listenButton) */
  function listen(getText){
    if (!('speechSynthesis' in window)) return null;
    var b = el('button', 'quiet listen', 'listen'); b.type = 'button';
    b.addEventListener('click', function(){
      if (speechSynthesis.speaking){ speechSynthesis.cancel(); return; }
      var u = new SpeechSynthesisUtterance(getText()); u.lang = document.documentElement.lang || 'en-GB'; u.rate = 0.95;
      speechSynthesis.speak(u);
    });
    return b;
  }

  /* ── a family, drawn by its form ─────────────────────────────────────────────────────────── */

  /* the form is the law's: a sundial spine is a clock; else the law's 1 names a mode or a form */
  function formOf(spine, law){
    if (floorOf(spine) === 10) return 'clock';
    if (!law) return '';
    var one = text(at(law, '1'));
    var m = /^\s*mode:\s*([a-z][\w-]*)/i.exec(one) || /^\s*form:\s*function:([a-z][\w-]*)/i.exec(one) || /^\s*function:([a-z][\w-]*)\s*$/i.exec(one);
    return m ? m[1].toLowerCase() : 'its own';
  }

  function drawFamily(mount, fam, opt){
    opt = opt || {};
    var kept = {};                     /* each reader's notebook as last read, by when it last changed */
    /* the index says what stands, so only what stands is read */
    function load(){
      return index().then(function(idx){
        var has = present(idx), maybe = function(n){ return has[n] ? read(n) : Promise.resolve(null); };
        return Promise.all([maybe('spine:' + fam), maybe('function:' + fam), maybe(fam), maybe('pool:' + fam), idx]);
      }).then(function(r){
        var idx = r[4], touched = (idx && idx.touched) || {}, pre = fam + ':';
        var who = names(idx).filter(function(n){ return n.indexOf(pre) === 0 && n.length > pre.length && n.slice(pre.length).indexOf(':') < 0; });
        return Promise.all(who.map(function(n){
          var t = touched[n] || '', k = kept[n];
          if (k && t && k.t === t) return [n, k.b];
          return read(n).then(function(b){ kept[n] = { t: t, b: b }; return [n, b]; }, function(){ return [n, k ? k.b : null, true]; });
        })).then(function(ms){ return { spine: r[0], law: r[1], fold: r[2], pool: r[3], mirrors: ms, now: clock && clock.address, voicing: clock && clock.voicing }; });
      });
    }
    return page(mount, load, function(body, d, again){
      document.title = fam + ' · ' + HANDLE;
      if (!d.spine){ body.appendChild(el('p', 'none', 'Nothing called ' + fam + ' stands on the beach yet.')); return; }
      var form = formOf(d.spine, d.law), notes = d.pool ? entries(d.pool).filter(function(e){ return e._.trim(); }) : [];
      function readersAt(address){
        var out = [];
        if (!address) return out;
        d.mirrors.forEach(function(m){
          var line = m[1] ? textAt(m[1], address) : '';
          if (line && !/^MIRROR\b/.test(line)) out.push({ who: m[0].slice(fam.length + 1), line: plain(line, fam) });
        });
        return out;
      }
      function notesAt(address){ return notes.filter(function(e){ return String(e['2'] || '').replace(/\./g, '') === address; }); }
      function voices(box, list, cls){
        if (!list.length) return;
        var ul = el('ul', cls || 'readers');
        list.forEach(function(x){ var li = el('li'); li.appendChild(el('b', null, x.who)); li.appendChild(document.createTextNode(' ' + x.line)); ul.appendChild(li); });
        box.appendChild(ul);
      }
      function noteList(box, list){
        voices(box, list.map(function(e){ return { who: (typeof e['1'] === 'string' && e['1'].length <= 60 ? e['1'] : 'someone') + ' · ' + ago(e['3']), line: e._.trim() }; }), 'notes');
      }
      /* one point: its row, the kept minute, the readings and their count, the notes, and the answer */
      function pointEl(node, address, cls){
        var p = el('div', 'point' + (cls ? ' ' + cls : ''));
        var r = rowOf(text(node), fam), row = el('p', 'row');
        if (!opt.diary) row.appendChild(el('span', 'addr', dotted(address)));
        if (r.title) row.appendChild(el('b', 'title', r.title));
        if (r.line) row.appendChild(document.createTextNode((r.title ? ' — ' : '') + r.line));
        p.appendChild(row);
        var minute = d.fold ? textAt(d.fold, address) : '';
        if (minute) p.appendChild(el('p', 'minute', plain(minute, fam)));
        var said = readersAt(address), t = tally(said.map(function(x){ return x.line; }));
        if (t) p.appendChild(el('p', 'tally', t));
        voices(p, said);
        noteList(p, notesAt(address));
        p.appendChild(answer(fam, address, !!d.pool, again));
        return p;
      }
      /* a run down digit 1, through steps whose other branches hold nothing beneath them, is a
       * sequence: one ladder, those other branches each step's side-rooms (tree 9.3) */
      function runOf(node, address, any){
        var steps = [], n = node, a = address;
        while (n && typeof n === 'object' && n['1'] != null){
          var others = digits(n).filter(function(k){ return k !== '1'; });
          if (!any && steps.length && others.some(function(k){ return digits(n[k]).length; })) return [];
          n = n['1']; a = a + '1'; steps.push([n, a]);
        }
        return any || steps.length >= 2 ? steps : [];
      }
      function sideRooms(box, node, address, depth){
        var ks = digits(node).filter(function(k){ return k !== '1'; });
        if (!ks.length) return;
        var det = el('details', 'rooms'); det.setAttribute('data-key', 'rooms:' + address);
        det.appendChild(el('summary', null, ks.length === 1 ? 'one side-room' : ks.length + ' side-rooms'));
        ks.forEach(function(k){ det.appendChild(branch(node[k], address + k, depth + 1)); });
        box.appendChild(det);
      }
      function ladder(steps, depth){
        var ol = el('ol', 'ladder');
        steps.forEach(function(s){
          var li = el('li', 'step');
          li.appendChild(pointEl(s[0], s[1]));
          sideRooms(li, s[0], s[1], depth);
          ol.appendChild(li);
        });
        return ol;
      }
      /* a branch: its point, then what is beneath it — a ladder where it runs down its 1, else its
       * parts, folded away below the second level */
      function branch(node, address, depth){
        var box = el('div', 'branch depth' + Math.min(depth, 3));
        box.appendChild(pointEl(node, address, /^PROVENANCE\b/i.test(text(node)) ? 'quiet' : ''));
        var kids = digits(node);
        if (!kids.length) return box;
        var steps = runOf(node, address, false);
        var inner = el('div', 'kids');
        if (steps.length){ inner.appendChild(ladder(steps, depth)); sideRooms(inner, node, address, depth); }
        else kids.forEach(function(k){ inner.appendChild(branch(node[k], address + k, depth + 1)); });
        if (depth >= 2){
          var det = el('details', 'more'); det.setAttribute('data-key', 'more:' + address);
          det.appendChild(el('summary', null, kids.length === 1 ? 'one beneath' : kids.length + ' beneath'));
          det.appendChild(inner); box.appendChild(det);
        } else box.appendChild(inner);
        return box;
      }

      var head = el('header', 'fam-head'), root = rowOf(text(d.spine), fam);
      head.appendChild(el('p', 'eyebrow', opt.diary ? 'diary' : form === 'clock' ? 'on the clock' : form ? 'form · ' + form : 'no form yet'));
      head.appendChild(el('h1', null, root.title || fam));
      if (root.line){
        /* a long opening line keeps its first few sentences in view, the rest a tap away */
        if (root.line.length > 480){
          head.appendChild(el('p', 'lede', short(root.line, 420)));
          var whole = el('details', 'more'); whole.setAttribute('data-key', 'lede');
          whole.appendChild(el('summary', null, 'the whole line')); whole.appendChild(el('p', 'law', root.line));
          head.appendChild(whole);
        } else head.appendChild(el('p', 'lede', root.line));
      }
      var lawLine = d.law ? plain(text(d.law), fam) : '';
      if (lawLine) head.appendChild(el('p', 'law', short(lawLine, 320)));
      body.appendChild(head);

      if (form === 'meeting'){
        /* a meeting is drawn as one ring on the site, never redrawn here */
        var ring = el('p', 'door big');
        ring.appendChild(link(SITE + '/ring/' + encodeURIComponent(fam), 'open this meeting’s ring ↗'));
        body.appendChild(ring);
        return;
      }
      if (form === 'path'){
        var path = el('p', 'door');
        path.appendChild(link(SITE + '/path/' + encodeURIComponent(fam.replace(/-path$/, '')), 'this path, part by part, on the site ↗'));
        body.appendChild(path);
      }

      if (form === 'clock'){
        /* A CLOCK is drawn as the ladder at now: each rung from the year down to this beat, the
         * plan's line there and every reader's. Adding a reading founds a clock notebook, which
         * the walk on the site does; this page links there. */
        var sec = el('section', 'clock');
        if (!d.now){ sec.appendChild(el('p', 'none', 'The clock couldn’t be read just now.')); body.appendChild(sec); return; }
        var v = /^(\w+) (\d+) (\w+) (\d{4}), (.+?) \(beat (\d+)\)$/.exec(d.voicing || '');
        var label = v ? [ 'beat ' + v[6], v[5], v[1] + ' ' + v[2] + ' ' + v[3], 'this week', v[3], 'this season', v[4] ]
          : [ 'this beat', 'this part of the day', 'today', 'this week', 'this month', 'this season', 'this year' ];
        var ol = el('ol', 'ladder clock-ladder');
        for (var p = 6; p >= 0; p--){
          var address = d.now.slice(0, 10 - p) + zeros(p);
          var line = textAt(d.spine, address), said = readersAt(address);
          var li = el('li', 'step' + (line || said.length ? '' : ' empty'));
          li.appendChild(el('p', 'rung', label[p]));
          if (line){ var rr = rowOf(line, fam); var lp = el('p', 'row'); if (rr.title) lp.appendChild(el('b', 'title', rr.title)); lp.appendChild(document.createTextNode((rr.title ? ' — ' : '') + rr.line)); li.appendChild(lp); }
          var t = tally(said.map(function(x){ return x.line; }));
          if (t) li.appendChild(el('p', 'tally', t));
          voices(li, said);
          noteList(li, notesAt(address));
          ol.appendChild(li);
        }
        sec.appendChild(ol);
        var walk = el('p', 'door');
        walk.appendChild(link(SITE + '/walk/' + encodeURIComponent(fam) + '/' + encodeURIComponent(whoHere() || HANDLE), 'the whole calendar, and your own reading, on the walk ↗'));
        sec.appendChild(walk);
        body.appendChild(sec);
      } else if (opt.diary){
        /* A DIARY: one post per position, newest first, its parts beneath, readings beside it */
        var posts = el('section', 'diary');
        var ks = digits(d.spine).slice().reverse();
        if (!ks.length) posts.appendChild(el('p', 'none', 'No posts yet.'));
        ks.forEach(function(k){
          var node = d.spine[k], post = el('article', 'post');
          var stamp = node && typeof node === 'object' && typeof node['3'] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(node['3']) ? node['3'] : '';
          if (stamp) post.appendChild(el('p', 'stamp', day(stamp)));
          post.appendChild(pointEl(node, k));
          var parts = digits(node).filter(function(j){ return !(j === '3' && stamp); });
          if (parts.length){ var pl = el('div', 'parts'); parts.forEach(function(j){ pl.appendChild(branch(node[j], k + j, 2)); }); post.appendChild(pl); }
          var lb = listen(function(){ return Array.prototype.map.call(post.querySelectorAll('.row'), function(x){ return x.textContent; }).join('. '); });
          if (lb) post.appendChild(lb);
          posts.appendChild(post);
        });
        body.appendChild(posts);
      } else {
        var pts = el('section', 'points' + (form === 'document' ? ' document' : ''));
        if (form === 'document'){
          /* A DOCUMENT is one voice read down its 1, the side-rooms opened where detail is wanted */
          pts.appendChild(ladder(runOf(d.spine, '', true), 0));
          digits(d.spine).filter(function(k){ return k !== '1'; }).forEach(function(k){ pts.appendChild(branch(d.spine[k], k, 1)); });
        } else digits(d.spine).forEach(function(k){ pts.appendChild(branch(d.spine[k], k, 1)); });
        body.appendChild(pts);
      }

      var unread = d.mirrors.filter(function(m){ return m[2]; }).length;
      if (unread) body.appendChild(el('p', 'none', unread === 1 ? 'One reader’s notebook couldn’t be read just now.' : unread + ' readers’ notebooks couldn’t be read just now.'));

      /* the room: notes not left at any one point, newest last */
      var room = el('section', 'room');
      room.appendChild(el('h2', null, 'the room'));
      if (!d.pool) room.appendChild(el('p', 'none', 'This family has no room yet, so notes are left as readings.'));
      else {
        var loose = notes.filter(function(e){ return !String(e['2'] || '').replace(/\./g, ''); });
        if (!loose.length) room.appendChild(el('p', 'none', 'No notes yet.'));
        noteList(room, loose.slice(-12));
        if (loose.length > 12){ var older = el('p', 'door'); older.appendChild(link('https://mirror.onen.ai/?pool=' + encodeURIComponent(fam), 'the older notes, in the mirror ↗')); room.appendChild(older); }
        room.appendChild(answer(fam, '', true, again));
      }
      body.appendChild(room);
    });
  }

  /* ── the go menu, as a page: the places a hand keeps at lists:<handle> 2, rank as depth, each
   * linked by the shapes of happyseaurchin.com's own paths (theme.js siteDoors) ── */
  var WORK = [
    ['now', 'now', 'handle'], ['here', 'here', 'handle'], ['page', 'page', 'handle'], ['passport', 'passport', 'handle'],
    ['hands', 'hands', 'handle'], ['models', 'models', 'handle'], ['notifications', 'push', 'handle'],
    ['projects', 'walk', 'family'], ['meetings', 'ring', 'carry'], ['availability', 'availability', 'carry'],
    ['one at a time', 'next', 'handle'], ['the morning', 'morning', 'handle'], ['the ledger', 'ledger', 'handle']
  ];
  var GLANCE = [
    ['recency', 'recency', 'family'], ['relational field', 'field', 'handle'], ['globe', 'globe', 'optional'],
    ['social brain', 'social-brain', 'optional'], ['across', 'across', 'handle'], ['earth', 'earth', 'optional']
  ];
  var WITH = [['connect', 'connect', 'optional'], ['mirror.onen.ai', 'https://mirror.onen.ai/', 'external']];
  var ALIAS = { shell: 'passport', self: 'passport' };
  function hrefFor(pg, shape, handle){
    var h = handle ? encodeURIComponent(handle) : '';
    if (shape === 'external') return pg;
    if (shape === 'bare') return '/' + pg;
    if (shape === 'carry') return handle ? '/' + pg + '?h=' + h : '/' + pg;
    if (shape === 'optional') return handle ? '/' + pg + '/' + h : '/' + pg;
    if (shape === 'handle') return handle ? '/' + pg + '/' + h : null;
    var f = pg === 'recency' ? 'now' : '';
    if (!f) return handle ? '/' + pg + '?h=' + h : null;
    return '/' + pg + '/' + encodeURIComponent(f) + (h ? '/' + h : '');
  }
  function doorsOf(lists, handle){
    var all = WORK.concat(GLANCE, WITH), out = [];
    ranked(lists && lists['2']).forEach(function(name){
      var pg = ALIAS[name] || name;
      for (var i = 0; i < all.length; i++) if (all[i][1] === pg){
        var h = hrefFor(all[i][1], all[i][2], handle);
        if (h) out.push({ label: all[i][0], href: /^https?:/.test(h) ? h : SITE + h });
        return;
      }
    });
    return out;
  }
  function doorList(box, doors){
    var ul = el('ul', 'doors');
    doors.forEach(function(x){ var li = el('li'); li.appendChild(link(x.href, x.label)); ul.appendChild(li); });
    box.appendChild(ul);
  }

  /* ── the pages ───────────────────────────────────────────────────────────────────────────── */

  /* HOME: who this is, from the passport; today's line on the clock and the rungs above it; the
   * places this hand keeps, as doors */
  function home(mount){
    return page(mount, function(){
      return Promise.all([read('passport:' + HANDLE), read('lists:' + HANDLE)]).then(function(r){
        var A = clock && clock.address, rungs = [2, 3, 4, 5, 6];
        return Promise.all(rungs.map(function(p){
          return A ? point('now:' + HANDLE, A.slice(0, 10 - p) + zeros(p), p).catch(function(){ return null; }) : null;
        })).then(function(lines){ return { passport: r[0], lists: r[1], now: lines, voicing: clock && clock.voicing }; });
      });
    }, function(body, d){
      document.title = HANDLE;
      var head = el('header', 'home-head');
      head.appendChild(el('h1', null, HANDLE));
      if (!d.passport) head.appendChild(el('p', 'none', 'No passport stands for ' + HANDLE + ' yet.'));
      else text(d.passport).split(/\n{2,}/).forEach(function(par){ if (par.trim()) head.appendChild(el('p', 'lede', plain(par, ''))); });
      body.appendChild(head);
      if (d.passport){
        var card = el('section', 'passport');
        [['offers', '1'], ['needs', '2'], ['reach', '3']].forEach(function(x){
          var t = textAt(d.passport, x[1]);
          if (!t) return;
          card.appendChild(el('h2', null, x[0]));
          card.appendChild(el('p', null, plain(t, '')));
        });
        if (card.firstChild) body.appendChild(card);
      }
      var now = el('section', 'now');
      var v = /^(\w+) (\d+) (\w+) (\d{4}), (.+?) \(beat (\d+)\)$/.exec(d.voicing || '');
      var label = ['today', 'this week', 'this month', 'this season', 'this year'];
      if (v) label[0] = v[1] + ' ' + v[2] + ' ' + v[3];
      now.appendChild(el('h2', null, 'now'));
      if (d.now[0] === null) now.appendChild(el('p', 'none', 'Today’s line couldn’t be read just now.'));
      else if (d.now[0]) now.appendChild(el('p', 'today', d.now[0]));
      else now.appendChild(el('p', 'none', 'Nothing said for today yet.'));
      now.lastChild.insertBefore(el('span', 'rung', label[0] + ' '), now.lastChild.firstChild);
      for (var i = 1; i < d.now.length; i++) if (d.now[i]){ var p = el('p', 'above'); p.appendChild(el('span', 'rung', label[i] + ' ')); p.appendChild(document.createTextNode(d.now[i])); now.appendChild(p); }
      var nd = el('p', 'door'); nd.appendChild(link(SITE + '/now/' + encodeURIComponent(HANDLE), 'the whole now, on the site ↗')); now.appendChild(nd);
      body.appendChild(now);
      var places = el('section', 'places');
      places.appendChild(el('h2', null, 'places'));
      var doors = doorsOf(d.lists, HANDLE);
      if (!d.lists) places.appendChild(el('p', 'none', 'No places kept yet.'));
      else doorList(places, doors);
      body.appendChild(places);
      var here = el('section', 'here');
      doorList(here, [{ label: 'map', href: 'map.html' }, { label: 'projects', href: 'projects.html' }, { label: 'diary', href: 'diary.html' }]);
      body.appendChild(here);
    });
  }

  /* MAP — DERIVED ON READ, NEVER MAINTAINED: this hand at the top, branches down, the groups
   * computed from every block named *:<handle> in the beach's index, the lists the hand keeps,
   * and the rooms its shell names (shell:<handle> 6.4). No block is kept for it. */
  function map(mount){
    var tail = ':' + HANDLE;
    return page(mount, function(){
      return Promise.all([index(), read('lists:' + HANDLE), get('block=' + encodeURIComponent('shell:' + HANDLE) + '&spindle=64').catch(function(){ return null; }), read('passport:' + HANDLE).catch(function(){ return null; })])
        .then(function(r){
          var idx = r[0] || {}, all = names(idx), born = idx.born || {}, touched = idx.touched || {};
          var stamp = function(n){ return { name: n, born: born[n] || '', touched: touched[n] || '' }; };
          var mine = all.filter(function(n){ return n.length > tail.length && n.slice(-tail.length) === tail; }).map(function(n){
            var s = stamp(n), fam = n.slice(0, -tail.length);
            s.fam = fam; s.spine = fam.indexOf(':') < 0 && all.indexOf('spine:' + fam) >= 0;
            return s;
          });
          /* the rooms the shell names, each line opening with its pool's name */
          var rooms = digits(r[2]).map(function(k){ var m = /^pool:([\w-]+)/.exec(text(r[2][k])); return m && all.indexOf('pool:' + m[1]) >= 0 ? stamp('pool:' + m[1]) : null; }).filter(Boolean);
          return { mine: mine, rooms: rooms, lists: r[1], who: r[3] ? short(plain(text(r[3]), ''), 160) : '' };
        });
    }, function(body, d){
      document.title = 'map · ' + HANDLE;
      var CORE = ['passport', 'shell', 'history', 'stash', 'vault'], TIME = ['now', 'ahead', 'availability', 'review', 'daily'];
      var used = {}, groups = [];
      function take(label, pick, href){
        var list = d.mine.filter(function(m){ return !used[m.name] && pick(m); });
        list.forEach(function(m){ used[m.name] = 1; m.href = href ? href(m) : ''; });
        return list;
      }
      function group(label, items){ if (items.length) groups.push({ label: label, items: items }); }
      var room = function(n){ return 'https://mirror.onen.ai/?pool=' + encodeURIComponent(n.replace(/^pool:/, '')); };
      group('core', take('core', function(m){ return CORE.indexOf(m.fam) >= 0; }));
      group('day and time', take('day', function(m){ return TIME.indexOf(m.fam) >= 0; }, function(m){ return m.fam === 'now' ? SITE + '/now/' + encodeURIComponent(HANDLE) : ''; }));
      group('projects', ranked(d.lists && d.lists['1']).map(function(p){ return { name: p, href: 'f.html?family=' + encodeURIComponent(p) }; }));
      group('places', doorsOf(d.lists, HANDLE).map(function(x){ return { name: x.label, href: x.href }; }));
      group('mirrors', take('mirrors', function(m){ return m.spine; }, function(m){ return 'f.html?family=' + encodeURIComponent(m.fam); }));
      var own = take('rooms', function(m){ return m.name === 'pool:' + HANDLE || m.name === 'liquid:pool:' + HANDLE; }, function(m){ return /^pool:/.test(m.name) ? room(m.name) : ''; });
      d.rooms.forEach(function(s){ if (s.name !== 'pool:' + HANDLE){ s.href = room(s.name); own.push(s); } });
      group('rooms', own);
      group('recipes', take('recipes', function(m){ return m.fam === 'cook'; }));
      group('everything else', take('else', function(){ return true; }));

      body.appendChild(el('h1', null, 'map'));
      var tree = el('div', 'tree'), top = el('div', 'tree-top');
      top.appendChild(el('b', null, HANDLE));
      if (d.who) top.appendChild(el('span', null, d.who));
      tree.appendChild(top);
      var ul = el('ul', 'limbs');
      groups.forEach(function(g){
        var li = el('li', 'limb'), det = el('details');
        det.setAttribute('data-key', 'group:' + g.label);
        if (g.label === 'projects' || g.label === 'places') det.open = true;
        var sum = el('summary');
        sum.appendChild(el('b', null, g.label));
        sum.appendChild(el('span', 'count', ' ' + g.items.length));
        det.appendChild(sum);
        var items = el('ul', 'items');
        g.items.forEach(function(x){
          var it = el('li');
          it.appendChild(x.href ? link(x.href, x.name) : el('span', 'name', x.name));
          if ('born' in x){
            var st = [x.born ? 'born ' + day(x.born) : '', x.touched ? 'touched ' + ago(x.touched) : ''].filter(Boolean).join(' · ');
            it.appendChild(el('span', 'stamp', st || 'no date kept'));
          }
          items.appendChild(it);
        });
        det.appendChild(items); li.appendChild(det); ul.appendChild(li);
      });
      tree.appendChild(ul);
      body.appendChild(tree);
    });
  }

  /* PROJECTS: lists:<handle> 1 in order, each with its form, its counted readings where it keeps
   * them, and its two ways in — its page here, and the walk on the site */
  function projects(mount){
    return page(mount, function(){
      return Promise.all([read('lists:' + HANDLE), index()]).then(function(q){
        var lists = q[0], has = present(q[1]), fams = ranked(lists && lists['1']), nil = function(){ return undefined; };
        var maybe = function(n){ return has[n] ? read(n).catch(nil) : Promise.resolve(null); };
        return Promise.all(fams.map(function(f){
          return Promise.all([maybe('function:' + f), maybe('spine:' + f), maybe(f)]).then(function(r){
            return { fam: f, unread: r[1] === undefined, stands: !!r[1], form: r[1] ? formOf(r[1], r[0]) : '',
                     law: r[0] ? short(plain(text(r[0]), f), 240) : '', counts: r[2] ? tally(foldLines(r[2])) : '' };
          });
        })).then(function(ps){ return { listed: !!lists, projects: ps }; });
      });
    }, function(body, d){
      document.title = 'projects · ' + HANDLE;
      body.appendChild(el('h1', null, 'projects'));
      if (!d.listed || !d.projects.length){ body.appendChild(el('p', 'none', 'No projects listed yet.')); return; }
      var ol = el('ol', 'projects');
      d.projects.forEach(function(p){
        var li = el('li', 'project');
        li.appendChild(el('h2', null, p.fam));
        li.appendChild(el('p', 'eyebrow', p.unread ? 'couldn’t be read just now' : !p.stands ? 'no plan stands yet'
          : p.form === 'clock' ? 'on the clock' : p.form ? 'form · ' + p.form : 'no form yet'));
        if (p.law) li.appendChild(el('p', 'law', p.law));
        if (p.counts) li.appendChild(el('p', 'tally', p.counts));
        var ways = el('p', 'ways');
        ways.appendChild(link('f.html?family=' + encodeURIComponent(p.fam), 'open here'));
        ways.appendChild(document.createTextNode(' · '));
        ways.appendChild(link(SITE + '/walk/' + encodeURIComponent(p.fam) + '/' + encodeURIComponent(HANDLE), 'on the walk ↗'));
        li.appendChild(ways);
        ol.appendChild(li);
      });
      body.appendChild(ol);
    });
  }
  /* every line a family's kept minutes hold below their root, to count the capital words that open them */
  function foldLines(block){
    var out = [];
    (function walk(n, top){
      if (typeof n === 'string'){ out.push(n.trim()); return; }
      if (!n || typeof n !== 'object') return;
      if (!top && typeof n._ === 'string') out.push(n._.trim());
      digits(n).forEach(function(k){ walk(n[k], false); });
    })(block, true);
    return out;
  }

  /* F: f.html?family=<name> draws any family by its form; with none named, the projects to choose */
  function draw(mount, fam){
    fam = String(fam || '').replace(/[^a-z0-9-]/gi, '');
    if (fam) return drawFamily(mount, fam);
    return page(mount, function(){ return read('lists:' + HANDLE); }, function(body, lists){
      document.title = 'families · ' + HANDLE;
      body.appendChild(el('h1', null, 'choose a family'));
      var fams = ranked(lists && lists['1']);
      if (!fams.length) body.appendChild(el('p', 'none', 'No families listed yet.'));
      doorList(body, fams.map(function(f){ return { label: f, href: 'f.html?family=' + encodeURIComponent(f) }; }));
    });
  }
  function query(name){ try { return new URLSearchParams(location.search).get(name) || ''; } catch(e){ return ''; } }

  window.Kit = {
    beach: BEACH, site: SITE, handle: HANDLE,
    read: read, index: index, point: point, clock: function(){ return clock; },
    text: text, digits: digits, at: at, textAt: textAt, floorOf: floorOf,
    draw: draw, doors: function(mount, handle){
      return page(mount, function(){ return read('lists:' + (handle || HANDLE)); }, function(body, lists){ doorList(body, doorsOf(lists, handle || HANDLE)); });
    },
    home: home, map: map, projects: projects, diary: function(mount){ return drawFamily(mount, HANDLE, { diary: true }); },
    query: query,
    /* for the checks only */
    _t: { rowOf: rowOf, titled: titled, plain: plain, tally: tally, formOf: formOf, ranked: ranked, entries: entries, doorsOf: doorsOf }
  };
})();

/* ── DICTATION, copied whole from happyseaurchin-home's theme.js (window.dictate, David's ruling of
 * 2026-09-07, with the sentence shaping of 2026-10-12, happyseaurchin-home #427). It wires itself on
 * any <textarea data-dictate>; the kit calls window.dictate(box) on each answer box it builds. ── */
/* ─────────────────────────────────────────────────────────────────────────────
 * dictate — every write box takes the voice as well as the keys.
 *
 * David's ruling (2026-09-07): add dictation. Browser-native — the Web Speech
 * API, SpeechRecognition or its webkit twin — so there is nothing to load and
 * nothing to pay. Chrome finds the words on the device or streams the audio to
 * Google, by its own choice; Safari finds most of them on the device; Firefox
 * has no API at all, so shows no glyph. The tooltip says which, because a
 * person should know where their voice goes before they press.
 *
 *     window.dictate(textarea)   → the glyph, or null where there is no API
 *
 * A static box opts in with an attribute — <textarea data-dictate> — and is
 * wired on DOMContentLoaded; a box a page builds in script calls dictate(el)
 * right where it calls keepDraft. One glyph, laid over the box's own top-right
 * corner and never in its flow, so no page's layout moves (the box's right
 * padding is widened just enough that no word runs under it; the bottom-right
 * is left to the resize grip). Tap to listen, tap to stop; it also stops when
 * the box loses focus or the engine gives up for good.
 *
 * The words: what the engine has LOCKED is appended after whatever the box
 * held, a space between, each phrase that came bare made a sentence (below);
 * the one phrase it is still revising rides at the end with an ellipsis after
 * it, and is replaced as it firms. Every change is an
 * input event on the box, so keepDraft keeps it and the page's own handlers
 * see it. Never a submit: Enter belongs to the page (recency and now say on
 * Enter — the marker is taken off the instant Enter is pressed, so what the
 * page reads is clean, and typing into the box mid-dictation simply re-bases
 * the session on what the box then holds).
 *
 * Ported from the mirror's use-speech-recognition (xstream-bsp), core only —
 * the interim is the LAST non-final entry, never their concatenation, and a
 * run of cumulative revisions collapses to the phrase it settled on: both are
 * phone faults, invisible on a desktop, paid for there (2026-08-09). Silence
 * ends a continuous session (sooner on a phone); it is restarted so dictation
 * survives the gap, with the locked phrases carried across the fold. A page
 * that rebuilds its box mid-dictation (recency on its tick, a view's live
 * section) hands the session to the successor the moment it wires it.
 * ───────────────────────────────────────────────────────────────────────────── */
(function(){
  'use strict';
  var MARK = '…';                      /* after the phrase still being revised */
  var SIZE = 22, INSET = 5;                 /* the glyph, and its distance from the corner */
  var TITLE = 'dictate — Chrome transcribes on this device or sends audio to Google; Safari transcribes mostly on device';
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4z"/>' +
    '<path d="M18 10a1 1 0 0 1 1 1 7 7 0 0 1-6 6.93V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0 1 1 0 0 1 1-1z"/></svg>';
  var TERMINAL = { 'not-allowed':1, 'service-not-allowed':1, 'audio-capture':1, 'network':1, 'language-not-supported':1 };

  function ctor(){ return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

  /* compare on words alone — a revision may add capitals or punctuation the
   * draft did not have. Built, not written as a literal: a \p escape in the
   * source would be a parse error for an old browser, and this file paints the
   * register before anything else. */
  var STRIP;
  try { STRIP = new RegExp("[^\\p{L}\\p{N}\\s']", 'gu'); } catch(e){ STRIP = /[^\w\s']/g; }
  function wordsOf(s){ return s.toLowerCase().replace(STRIP, '').trim().replace(/\s+/g, ' '); }

  /* the phrases the engine has LOCKED, and the one hypothesis it is still
   * revising — the LAST non-final entry, never all of them glued together */
  function readResults(results){
    var finals = [], interim = '';
    for (var i = 0; i < results.length; i++){
      var r = results[i], t = r[0] ? (r[0].transcript || '') : '';
      if (r.isFinal) finals.push(t); else interim = t;
    }
    return { finals: finals, interim: interim };
  }

  /* an entry that merely EXTENDS the one before it is that entry rewritten,
   * not a new phrase; keep the last of each run */
  function collapse(parts){
    var runs = [];
    for (var i = 0; i < parts.length; i++){
      var t = (parts[i] || '').trim();
      if (!t) continue;
      if (runs.length){
        var a = wordsOf(t), b = wordsOf(runs[runs.length - 1]);
        if (a === b || a.indexOf(b + ' ') === 0){ runs[runs.length - 1] = t; continue; }
      }
      runs.push(t);
    }
    return runs;
  }

  /* A SENTENCE PER LOCKED PHRASE (David, 2026-10-12: 'it used to create
   * sentences … now it is just one long blurb'). Punctuation was always the
   * engine's, and an engine recognising on the device hands back bare words —
   * Chrome now picks the device for itself. So a phrase that arrives BARE (no
   * punctuation at all) gets a capital where a sentence starts and a full stop
   * where it ended, each locked phrase having ended at a pause; in English a
   * lone 'i' stands up. A phrase the engine punctuated is left as it came. The
   * phrase still being revised gets its capital only; its stop waits for the
   * lock. The mirror's use-speech-recognition shapes the same (shapeSpoken). */
  var PUNCTUATED = /[.,!?;:…]/;
  function sentence(before, t, open, lang){
    if (PUNCTUATED.test(t)) return t;
    if (/^en\b/i.test(lang || '')) t = t.replace(/\bi\b/g, 'I');
    if (!before || /[.!?…]["'”’)\]]*\s*$/.test(before) || /\n\s*$/.test(before)) t = t.charAt(0).toUpperCase() + t.slice(1);
    return open ? t : t + '.';
  }

  /* the spoken words after what the box already held: a space between, unless
   * the box ended on a line break the writer put there; the last phrase stays
   * open while the engine is still revising it */
  function glue(base, runs, open, lang){
    var out = base;
    for (var i = 0; i < runs.length; i++){
      var s = sentence(out, runs[i], open && i === runs.length - 1, lang);
      out = !out ? s : /\s$/.test(out) ? out + s : out + ' ' + s;
    }
    return out;
  }

  function inputEvent(){
    try { return new Event('input', { bubbles: true }); }
    catch(e){ var ev = document.createEvent('Event'); ev.initEvent('input', true, false); return ev; }
  }

  var active = null;   /* one microphone; one session at a time */

  window.dictate = function(box){
    if (!box || !('value' in box) || !box.parentNode) return null;
    if (!ctor()) return null;
    if (box._dictate) return box._dictate.button;

    var parent = box.parentNode;
    /* a span with the button role, not a <button>: every page dresses ITS
     * buttons for their row (.say button, .mirrorbox button …), and a glyph in
     * the corner of the box is not one of them */
    var btn = document.createElement('span');
    btn.className = 'dictate';
    btn.title = TITLE;
    btn.tabIndex = 0;
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'dictate');
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = ICON;
    parent.insertBefore(btn, box.nextSibling);

    var rec = null, want = false, base = '', prior = [], finals = [];
    var written = null;       /* the last text this session put in the box */
    var writing = false;      /* while it is being put there */
    var startedAt = 0, heard = false, pending = null, anchored = false, seen = false;
    var api = { box: box, button: btn };

    /* ── the glyph over the corner ──────────────────────────────────────── */
    function place(){
      /* a box wired before it is attached (a part built and then appended) is
       * placed when it lands; one the page has since discarded lets go */
      if (!box.isConnected){ if (seen) window.removeEventListener('resize', place); return; }
      seen = true;
      var w = box.offsetWidth, h = box.offsetHeight;
      if (!w && !h){ btn.hidden = true; return; }
      btn.hidden = false;
      if (!anchored){
        anchored = true;
        var cs = getComputedStyle(parent);
        if (cs.position === 'static') parent.style.position = 'relative';
        var pr = parseFloat(getComputedStyle(box).paddingRight) || 0;
        if (pr < SIZE + INSET * 2) box.style.paddingRight = (SIZE + INSET * 2) + 'px';
      }
      btn.style.top = (box.offsetTop + INSET) + 'px';
      btn.style.left = (box.offsetLeft + w - SIZE - INSET) + 'px';
    }
    if (window.ResizeObserver){ var ro = new ResizeObserver(place); ro.observe(box); ro.observe(parent); }
    window.addEventListener('resize', place);
    box.addEventListener('focus', place);
    place();

    /* ── the words into the box ─────────────────────────────────────────── */
    function write(text){
      writing = true;
      box.value = text; written = text;
      try { box.scrollTop = box.scrollHeight; } catch(e){}
      box.dispatchEvent(inputEvent());
      writing = false;
    }
    function touched(){ return written !== null && box.value !== written; }
    /* the marker comes off where it was put; the phrase under it stays as last
     * heard, and anything typed after it stays too */
    function settle(){
      if (written === null || written.slice(-MARK.length) !== MARK) return;
      var stem = written.slice(0, -MARK.length), v = box.value;
      if (v.indexOf(stem + MARK) !== 0) return;      /* the box no longer holds it where it was put */
      write(stem + v.slice(stem.length + MARK.length));
    }
    function show(on){ btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    /* while listening, notice a box the page has discarded even if no blur and
     * no result ever says so — the session must not outlive its box */
    var watch = null;
    function watching(on){
      clearInterval(watch);
      watch = on ? setInterval(function(){ if (!box.isConnected) orphan(); }, 500) : null;
    }

    function begin(){
      var R = ctor(); if (!R) return;
      if (active && active !== api) active.stop();
      active = api;
      var r = new R();
      r.lang = document.documentElement.lang || navigator.language || 'en-US';
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      /* the engine's own punctuation where the browser offers it (Chrome's
       * unspokenPunctuation, 2026); elsewhere the sentences above stand in */
      if ('unspokenPunctuation' in r) r.unspokenPunctuation = true;
      base = box.value.replace(/[ \t]+$/, '');
      prior = []; finals = []; written = null; heard = false;
      r.onresult = function(e){
        if (rec !== r) return;                       /* a superseded session's late words */
        if (!box.isConnected){ orphan(); return; }
        if (touched()){ if (!pending) rebase(); return; }
        heard = true;
        var got = readResults(e.results);
        finals = got.finals;
        var runs = collapse(prior.concat(finals, [got.interim]));
        var open = !!got.interim.trim();
        write(glue(base, runs, open, r.lang) + (open ? MARK : ''));
      };
      r.onerror = function(e){
        if (rec === r && TERMINAL[e.error]){
          want = false;
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
            btn.title = 'the microphone was refused — allow it for this site to dictate';
        }
      };
      r.onend = function(){
        if (rec !== r) return;
        /* silence ended the session and the writer did not: carry the locked
         * phrases across the fold and go again — unless it died at once, which
         * is a fault, not a pause, and would loop */
        if (want && box.isConnected && (heard || Date.now() - startedAt > 1000)){
          prior = collapse(prior.concat(finals)); finals = []; heard = false; startedAt = Date.now();
          try { r.start(); return; } catch(e){}
        }
        rec = null; want = false; show(false); watching(false); settle();
        if (active === api) active = null;
      };
      rec = r; want = true; startedAt = Date.now();
      try { r.start(); show(true); watching(true); }
      catch(e){ rec = null; want = false; show(false); watching(false); if (active === api) active = null; }
    }
    /* the box changed under the session — typed into, or filled or cleared by
     * the page — so what it holds now is the base, and a fresh recogniser
     * carries on from there (a used one re-reports its whole span) */
    function rebase(){
      var r = rec; rec = null;
      if (r){ try { r.abort(); } catch(e){} }
      settle();
      begin();
    }
    function stop(){
      want = false; show(false);
      clearTimeout(pending); pending = null;
      settle();                                     /* a click that follows reads clean text */
      if (rec){ try { rec.stop(); } catch(e){} }    /* onend closes the session; late finals still firm the phrase */
      else if (active === api) active = null;
    }
    /* let go without settling — the successor box has the words already */
    function drop(){
      want = false; show(false); watching(false);
      var r = rec; rec = null;
      if (r){ try { r.abort(); } catch(e){} }
      if (active === api) active = null;
    }
    /* the page rebuilt its box; give the successor a moment to take the session over */
    var orphanTimer = null;
    function orphan(){
      if (orphanTimer) return;
      orphanTimer = setTimeout(function(){ orphanTimer = null; if (!box.isConnected) drop(); }, 1500);
    }
    api.stop = stop; api.drop = drop; api.begin = begin;
    api.listening = function(){ return want; };

    /* a fresh box standing where a live session's box stood is the same box rebuilt */
    if (active && active.listening() && !active.box.isConnected && sameBox(active.box, box)){
      active.drop();
      if (box.value.slice(-MARK.length) === MARK) box.value = box.value.slice(0, -MARK.length);
      begin();
    }

    btn.addEventListener('mousedown', function(e){ e.preventDefault(); });   /* the box keeps its focus */
    btn.addEventListener('click', function(){
      if (want){ stop(); return; }
      begin();
      if (want){ try { box.focus({ preventScroll: true }); } catch(e){ box.focus(); } }
    });
    btn.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); btn.click(); }
    });
    box.addEventListener('blur', function(){
      if (!want) return;
      settle();                                     /* whatever comes next reads clean text */
      /* Chrome also fires blur for a box being REMOVED, before the removal
       * lands — so decide a tick later: gone is the page rebuilding its box
       * (hold the session for the successor); still here is the writer
       * looking away */
      setTimeout(function(){ if (!want) return; if (box.isConnected) stop(); else orphan(); }, 0);
    });
    box.addEventListener('input', function(){
      if (want && !writing){ clearTimeout(pending); pending = setTimeout(function(){ pending = null; if (want) rebase(); }, 400); }
    });
    box.addEventListener('keydown', function(e){ if (e.key === 'Enter' && want) settle(); }, true);

    box._dictate = api;
    return btn;
  };

  function sameBox(a, b){
    if (a.id) return a.id === b.id;
    return a.placeholder === b.placeholder && a.className === b.className;
  }

  function wireAll(){
    var all = document.querySelectorAll('textarea[data-dictate]');
    for (var i = 0; i < all.length; i++) window.dictate(all[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireAll); else wireAll();
})();
