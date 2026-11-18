// Run with Node 22+ and a local Chrome or Chromium installation.
// CHROME_PATH overrides browser discovery. This launches an isolated temporary profile.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const output = path.dirname(fileURLToPath(import.meta.url)),
  root = path.dirname(output);
const executable = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  process.env.LOCALAPPDATA &&
    path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
].find((v) => v && fs.existsSync(v));
if (!executable)
  throw Error("Set CHROME_PATH to your Chrome or Chromium executable.");
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), "wildlight-verification-"),
);
const chrome = spawn(
  executable,
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--remote-debugging-port=0",
    "--user-data-dir=" + profile,
    "about:blank",
  ],
  { stdio: "ignore" },
);
const stopped = new Promise((resolve) => chrome.once("exit", resolve));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let ws,
  sequence = 0;
const requests = new Map(),
  errors = [];
async function call(method, params = {}) {
  let id = ++sequence;
  const promise = new Promise((resolve) => requests.set(id, resolve));
  ws.send(JSON.stringify({ id, method, params }));
  const response = await promise;
  if (response.error) throw Error(JSON.stringify(response.error));
  return response.result;
}
async function ev(expression) {
  const r = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails)
    throw Error(
      r.exceptionDetails.exception?.description || r.exceptionDetails.text,
    );
  return r.result.value;
}
async function waitFor(expression, description, timeout = 5500) {
  const until = Date.now() + timeout;
  do {
    if (await ev(expression)) return;
    await delay(36);
  } while (Date.now() < until);
  throw Error(description);
}
const testKeys = {
  Enter: 13,
  Escape: 27,
  Tab: 9,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  1: 49,
  e: 69,
};
function sendKey(key, type) {
  const windowsVirtualKeyCode = testKeys[key];
  return call("Input.dispatchKeyEvent", { type, key, windowsVirtualKeyCode });
}
async function press(key) {
  await sendKey(key, "keyDown");
  await sendKey(key, "keyUp");
}
async function mousePress(x, y) {
  await call("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await call("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
}
async function atElement(selector) {
  return ev(
    `(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
}
async function clickElement(selector) {
  const { x, y } = await atElement(selector);
  await mousePress(x, y);
}
async function tapAt(x, y) {
  await call("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function clickField(key) {
  const { x, y } = await ev(`(() => {
    const spot=landmarks().find(s=>s.key===${JSON.stringify(key)});
    const rect=$("world").getBoundingClientRect();
    return {x:rect.x+spot.x*rect.width/384,y:rect.y+spot.y*rect.height/224};
  })()`);
  await mousePress(x, y);
}
const fullBattleScreen = `(() => {
  const stage=$("arena").getBoundingClientRect(), frame=$("window").getBoundingClientRect();
  return frame.x===0&&frame.y===0&&frame.width===innerWidth&&frame.height===innerHeight&&
    stage.width===innerWidth&&stage.height>innerHeight*0.46&&
    $("battleControls").getBoundingClientRect().bottom<=innerHeight;
})()`;
async function shot(name) {
  const r = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    path.join(output, name + ".png"),
    Buffer.from(r.data, "base64"),
  );
}
async function startBrowser() {
  const portFile = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 200 && !fs.existsSync(portFile); i++) await delay(100);
  if (!fs.existsSync(portFile))
    throw Error("Chrome did not publish its debugging port.");
  const port = fs.readFileSync(portFile, "utf8").split("\n")[0];
  const tabs = await (
    await fetch("http://127.0.0.1:" + port + "/json/list")
  ).json();
  const page = tabs.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (e) => {
    let v = JSON.parse(e.data);
    if (v.id) {
      requests.get(v.id)?.(v);
      requests.delete(v.id);
    } else if (v.method === "Runtime.exceptionThrown")
      errors.push(
        v.params.exceptionDetails.exception?.description ||
          v.params.exceptionDetails.text,
      );
  };
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1360,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call("Page.bringToFront");
  await call("Emulation.setFocusEmulationEnabled", { enabled: true });
  await call("Page.navigate", {
    url: pathToFileURL(path.join(root, "index.html")).href,
  });
  for (let i = 0; i < 100; i++) {
    if (
      await ev(
        "document.readyState==='complete' && !!document.querySelector('.partner')",
      )
    )
      break;
    await delay(50);
  }
  const siteOk = await ev(`(async()=>{
    for(const family of document.querySelectorAll(".picker button")){
      family.click();
      const card=document.getElementById(family.getAttribute("aria-controls"));
      if(!card.getClientRects().length || family.getAttribute("aria-pressed")!=="true")return false;
      for(const button of card.querySelectorAll(".stages button")){
        button.click();
        const sprite=card.querySelector(".sprite");
        await sprite.decode();
        if(card.querySelector("h3").textContent!==button.dataset.name ||
           sprite.naturalWidth!==88 || button.getAttribute("aria-pressed")!=="true")return false;
      }
    }
    document.querySelector('.tabstrip a[href="#journey"]').click();
    for(const badge of document.querySelectorAll(".case a")){
      badge.click();
      const leader=document.querySelector(badge.hash);
      await leader.querySelector("img").decode();
      if(!leader.getClientRects().length||!location.href.endsWith(badge.hash))return false;
    }
    document.querySelector('.tabstrip a[href="#guide"]').click();
    const details=document.querySelector(".manual details:last-child");
    details.querySelector("summary").click();
    if(!details.open||!details.getClientRects().length)return false;
    const sections=["world","partners","design","battles","journey","guide","play-here"];
    if(sections.some((id,i)=>{const panel=document.getElementById(id);return !panel.getClientRects().length || (i&&panel.getBoundingClientRect().top<=document.getElementById(sections[i-1]).getBoundingClientRect().top)}))return false;
    const backup=document.querySelector(".manual a[download]");
    return document.querySelectorAll(".partner").length===3 &&
      backup.href===document.querySelector(".hero-actions .play").href;
  })()`);
  if (!siteOk) throw Error("Landing page field guide or download link failed");
  console.log(
    "PASS journal navigation, nine starter forms, eight League leaders and offline download",
  );
  await ev("document.querySelector('#start-console').click()");
  let frameReady = false;
  for (let i = 0; i < 100 && !frameReady; i++) {
    const tree = await call("Page.getFrameTree");
    const frame = tree.frameTree.childFrames?.find((child) =>
      child.frame.url.endsWith("/play/index.html"),
    );
    if (frame) {
      const { executionContextId } = await call("Page.createIsolatedWorld", {
        frameId: frame.frame.id,
        worldName: "verify-cabinet",
      });
      const view = await call("Runtime.evaluate", {
        contextId: executionContextId,
        expression:
          "document.readyState==='complete' && !!document.querySelector('#titleArt')",
        returnByValue: true,
      });
      frameReady = !!view.result.value;
    }
    if (!frameReady) await delay(50);
  }
  if (!frameReady) throw Error("Inline game did not reach its title screen");
  if (await ev("location.protocol.startsWith('http')")) {
    const returned = await ev(`(() => {
      const game = document.querySelector(".cabinet iframe");
      game.contentWindow.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", shiftKey: true, bubbles: true }));
      return document.activeElement.id === "guide" && location.hash === "#guide" && game.isConnected;
    })()`);
    if (!returned)
      throw Error(
        "Keyboard shortcut could not return from the game to its controls",
      );
  }
  await ev("document.querySelector('.hero-actions .play').click()");
  for (let i = 0; i < 100; i++) {
    if (
      await ev(
        "document.readyState==='complete'&&typeof validateCatalogue==='function'",
      )
    )
      break;
    await delay(50);
  }
  if (!(await ev("validateCatalogue()")))
    throw Error("Catalogue validation failed");
}

async function checkEmbeddedArt() {
  await waitFor(
    "atlasReady && titleButtons.length && validateArtwork()",
    "Complete embedded atlas must load before the title screen",
    12000,
  );
  if (await ev("Boolean(detailImage)"))
    throw Error(
      "Standard displays should wait to decode higher-detail artwork",
    );
  const result = await ev(`(() => {
    const fingerprint = (image) => {
      const { width, height } = image;
      const rgba = image.getContext("2d").getImageData(0, 0, width, height).data;
      let hash = 2166136261, alpha = 0;
      for (let i = 0; i < rgba.length; i++) {
        hash = Math.imul(hash ^ rgba[i], 16777619);
        if (i % 4 === 3 && rgba[i]) alpha++;
      }
      if (alpha < 1) throw Error("Blank artwork");
      return hash;
    };
    const poses = new Set();
    for (const { id, name } of species) {
      for (const back of [false, true]) {
        const key = (back ? "rear/" : "species/") + name;
        const image = sprite(id, back);
        if (image !== artFrame(key)) throw Error(key + " did not use its atlas cell");
        poses.add(fingerprint(image));
      }
    }
    const backgrounds = new Set();
    let portraits = 0, people = 0;
    for (const name of Object.keys(atlasFrames)) {
      if (/^(species|rear)\\//.test(name)) continue;
      const hash = fingerprint(artFrame(name));
      if (/^(arena|gym|shrine)\\//.test(name) || ["championship", "regulator"].includes(name))
        backgrounds.add(hash);
      if (name.startsWith("portrait/")) portraits++;
      if (name.startsWith("person/")) people++;
    }
    return [poses.size, backgrounds.size, portraits, people];
  })()`);
  if (result.join(",") !== "600,30,26,26")
    throw Error(
      "Incomplete or duplicate creature and arena artwork: " + result,
    );
  console.log(
    "PASS all 600 distinct sprite views and 30 distinct arena backdrops",
  );
}

async function solveRoomPlans() {
  let paths = await ev(
    `window.solutions=Array.from({length:8},(_,j)=>{let queue=[[newRoom(j),'']],seen=new Set;for(let i=0;i<queue.length&&i<200000;i++){let [p,seq]=queue[i];if(p.done)return seq;for(let d=0;d<5;d++){let q=structuredClone(p);roomStep(q,d);let key=[q.n,q.phase,q.v,q.boxes,q.done].join('/');if(!seen.has(key)){seen.add(key);queue.push([q,seq+d])}}}return null})`,
  );
  if (paths.length !== 8 || paths.some((s) => !s))
    throw Error("Unsolvable gym");
  console.log("PASS every gym puzzle has a reachable exit from reset");
}

async function campaign() {
  const assert = (v, s) => {
      if (!v) throw Error(s);
    },
    run = ev,
    snap = async (n) => {
      await new Promise((r) => setTimeout(r, 100));
      await shot(n);
    };
  await press("Enter");
  await waitFor(
    "!titleActive && !ui && objective()[2] === 'oriel'",
    "Fresh expedition begins on the field by Oriel",
  );
  await ev("document.fonts.ready.then(()=>true)");
  await snap("01-exploration");
  await sendKey("ArrowRight", "keyDown");
  try {
    await waitFor(
      "target()?.key === 'oriel'",
      "Walk into Oriel’s interaction range",
    );
  } finally {
    await sendKey("ArrowRight", "keyUp");
  }
  await press("Enter");
  await waitFor(
    "ui==='Choose your field partner'",
    "Meet Oriel through the field prompt",
  );
  await snap("02-starter-selection");
  await clickElement('[data-starter="6"]');
  assert(
    await ev(
      '$("chooseStarter").textContent==="Choose Puddlepip"&&G.party.length===0',
    ),
    "Starter preview commits only after confirmation",
  );
  await clickElement('[data-starter="0"]');
  await press("Enter");
  assert(await ev("G.party[0].id===0"), "Starter confirmation");
  await press("Escape");
  await waitFor(
    "!ui && objective()[2] === 'lesson'",
    "The meadow encounter is marked",
  );
  await clickField("lesson");
  await waitFor(
    "B?.guided===true && !turnLock",
    "Walk to the marked Gravlet and start a guided battle",
  );
  assert(await ev(fullBattleScreen), "Desktop encounter fills the screen");
  await waitFor(
    `atlasReady && $("commandDeckArt").getContext("2d")
    .getImageData(40,2,1,1).data[3] > 0`,
    "Embedded art and battle instrument are painted",
  );
  assert(
    await ev(`[...$("battleControls").querySelectorAll(".command-glyph")].every((glyph) =>
      glyph.getContext("2d").getImageData(0,0,16,16).data.some((alpha,i)=>i%4===3&&alpha))`),
    "Move and utility glyphs render in the game",
  );
  await press("ArrowRight");
  assert(
    await ev(
      "Number(document.activeElement.dataset.move) === active().moves[1]",
    ),
    "Directional navigation selects the next engraved move",
  );
  await press("ArrowLeft");

  await snap("03-wild-battle");
  await clickElement('.battle-tools [onclick="battleBag()"]');
  assert(
    await ev(
      'battlePanelOpen() && $("arena").isConnected && $("battleControls").inert',
    ),
    "Opening supplies retains the live arena",
  );
  await press("Escape");
  assert(
    await ev('!battlePanelOpen() && !$( "battleControls").inert'),
    "Escape returns to battle commands",
  );
  await ev(
    "const originalRandom=rng(913874);Math.random=()=>.27;const firstIntent=B.intent",
  );
  await press("1");
  await waitFor(
    "B.turn===1 && turnLock && B.intent===firstIntent && /damage/.test($( 'battleMessage').textContent)",
    "First attack has a readable action beat and a committed foe response",
  );
  await waitFor("B.turn===1 && !turnLock", "Starter attack resolves");
  if (await ev('catchOdds("Lumen Capsule") < 1')) {
    await press("1");
    await waitFor("B?.turn===2 && !turnLock", "Second starter attack resolves");
  }
  assert(
    await ev(
      'catchOdds("Lumen Capsule")===1 && $("quickCapsule").textContent.includes("100%")',
    ),
    "Weakened Gravlet shows a guaranteed catch",
  );
  await clickElement("#quickCapsule");
  await waitFor(
    'anim?.type==="capture" && turnLock',
    "Lumen Capsule starts its animation",
  );
  await snap("04-capsule");
  await waitFor("ui==='Capture recorded'", "Tutorial capture");
  assert(
    await ev(
      'G.party.length===2 && G.caught.includes(trainingSpot.id) && $("captureField").clientWidth===innerWidth',
    ),
    "The catch reveal fills the display",
  );
  await shot("capture-recorded");
  await press("Enter");
  await waitFor(
    "!ui && objective()[2] === 'exit'",
    "Capture points the player to Briarbrook",
  );
  await press("Tab");
  await snap("05-party");
  await run("openAtlas()");
  await snap("06-atlas");
  await run("closeUI();Math.random=originalRandom;G.options.fast=true");
  await clickField("exit");
  await waitFor(
    "G.trail===1",
    "The east sign leads directly to Thistlebend Walk",
  );
  await clickField("field-station");
  await waitFor(
    "ui==='The Sleeping Bough'",
    "The trail fork opens its field notebook",
  );
  await shot("field-notebook");
  await clickElement(".field-note + .actions .primary");
  await clickField("field-chime-0");
  await waitFor(
    "fieldRun?.step===1",
    "Resolve the Root chime by walking to it",
  );
  await clickField("field-chime-1");
  await waitFor(
    "fieldRun?.step===0",
    "An out of order note resets the sequence",
  );
  for (const [i, step] of [
    [0, 1],
    [2, 2],
    [1, 3],
  ]) {
    await clickField("field-chime-" + i);
    await waitFor("fieldRun?.step===" + step, "Reach field chime " + i, 12000);
  }
  assert(
    await run(
      `ui==='Field notes recorded' && G.fieldNotes.includes(1) &&
       G.bag['Dusk Capsule']>=2 && landmarks().some(s=>s.key==='field-sighting' && species[s.id].name==='Spinchime') &&
       validateSave(JSON.parse(localStorage.getItem(KEY))).fieldNotes.includes(1)`,
    ),
    "The chime puzzle saves supplies and reveals an overworld creature",
  );
  await run("closeUI()");
  await snap("field-chimes");
  console.log(
    "PASS fresh tutorial, guided capture, walking exit and field notebook with real input",
  );
  await run(
    `window.autofight=()=>{let t=0;while(B&&t++<400){if(B.forced){chooseSwitch(G.party.findIndex(m=>m.hp>0));continue}let p=active(),f=enemy(),dmg=p.moves.map(id=>moves[id]).filter(v=>v.power&&v.cost<=p.en).sort((a,b)=>b.power*mul(b,p,f)-a.power*mul(a,p,f));let swaps=G.party.map((m,i)=>[m,i]).filter(([m,i])=>m.hp&&i!==B.ai).sort(([a],[b])=>match(species[b.id].el[0],f.id)-match(species[a.id].el[0],f.id));if(p.hp<maxhp(p)*.38&&G.bag['Field Tonic']>0)battleAction('item','Field Tonic');else if(swaps.length&&B.turn%5===0&&match(species[p.id].el[0],f.id)<1&&match(species[swaps[0][0].id].el[0],f.id)>1)battleAction('switch',swaps[0][1]);else if(dmg.length)battleAction('move',dmg[0].id);else battleAction('rest')}return [t,ui,G.party.map(m=>[m.lv,m.hp])]}`,
  );
  async function capture(id) {
    await run(
      `closeUI();wild(${id});Math.random=()=>0.01;battleAction('item','Lumen Capsule')`,
    );
    await new Promise((r) => setTimeout(r, 130));
    await run("nameCapture();Math.random=originalRandom");
  }
  for (let z = 1; z <= 8; z++) {
    if (z > 1) await run("closeUI();planTravel(" + z + ");");
    assert(await run("G.trail===" + z), "walking route");
    await run(
      "for(let step=0;step<175;step++){let next=G.x+2;walk(1,Math.sign(trailY(G.trail,next)-G.y))}interact();",
    );
    assert(await run("G.z===" + z), "route destination");
    await run("lodge();closeUI();");
    if (z <= 4) {
      let id = await run("pool(" + z + ").find(id=>!G.caught.includes(id))");
      await capture(id);
    }
    await run("hall();startPuzzle();");
    if (z === 1) {
      const startTile = await ev("puzzle.n");
      const actions = await ev(
        "solutions[0].slice(0, solutions[0].indexOf('4')+1)",
      );
      for (const d of actions)
        await press(
          ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "e"][Number(d)],
        );
      assert(
        await ev('$( "roomTrack").textContent.startsWith("1 of 3")'),
        "First gym teaches how to align a valve",
      );
      await clickElement('.room-toolbar [onclick="startPuzzle()"]');
      assert(
        await ev("puzzle.n===" + startTile + "&&puzzle.v.every(v=>v===0)"),
        "Reset restores the first puzzle",
      );
    } else await run("roomInput(1);startPuzzle();");
    await snap("gym-" + z);
    await run(
      "for(let d of solutions[puzzle.j])roomInput(+d);solve();gymTrainer();",
    );
    assert(
      await run(`B.backdrop === "gym/${z - 1}"`),
      "gym trainer arena " + z,
    );
    let r = await run("autofight()");
    assert(await run("G.train.includes(" + z + ")"), "trainer loss " + z);
    await run(
      "closeUI();for(let [i,m] of G.party.entries()){if(eligible(m)){evolution(i);evolveNow()}};lodge();closeUI();leader()",
    );
    assert(await run(`B.backdrop === "gym/${z - 1}"`), "gym leader arena " + z);
    r = await run("autofight()");
    console.log("PASS badge", z);
    assert(await run("G.badges===" + z), "leader loss " + z);
    if (z === 2) {
      let i = await run("G.party.findIndex(m=>eligible(m))");
      if (i >= 0) {
        await run("evolution(" + i + ")");
        await snap("07-evolution");
        await run("evolveNow()");
      }
    }
  }
  await run("closeUI();go(9);lodge();closeUI();finale()");
  assert(await run('B.backdrop === "regulator"'), "story final arena");
  await run("autofight()");
  assert(await run("G.story===1"), "finale loss");
  await run("observatory()");
  await snap("championship");
  for (let j = 0; j < 5; j++) {
    await run("lodge();closeUI();cupFight()");
    assert(await run('B.backdrop === "championship"'), "championship arena");
    await run("autofight()");
    console.log("PASS championship round", j + 1);
    assert(await run("G.cup===" + (j + 1)), "cup loss");
  }
  await snap("ending");
  assert(
    await run("validateSave(JSON.parse(localStorage.getItem(KEY))).cup===5"),
    "save validation",
  );
}

async function collectAndRecover() {
  const check = (x, s) => {
    if (!x) throw Error(s);
    console.log("PASS", s);
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  check(await ev("G.cup===5"), "fresh campaign ended with championship");
  let champSave = await ev("JSON.stringify(G)");
  await ev(
    "beginGame();closeUI();G.options.fast=true;go(0);lodge();closeUI();wild(pool(0)[0]);window.prng=Math.random;Math.random=()=>.995;battleAction('item','Lumen Capsule')",
  );
  await wait(250);
  check(
    await ev("B&&B.log.some(s=>s.includes('escapes'))"),
    "capture failure and enemy response",
  );
  check(
    await ev(
      "(()=>{let i=G.party.findIndex((m,i)=>i!==B.ai&&m.hp);battleAction('switch',i);return B.ai===i})()",
    ),
    "legal switching consumes a turn",
  );
  check(
    await ev(
      "(()=>{Math.random=()=>.01;useMove(active(),enemy(),5);let a=mod(enemy()).turns;endEffects(enemy());return mod(enemy()).turns===a-1&&mod(enemy()).status==='Scorch'})()",
    ),
    "status duration and damage",
  );
  check(
    await ev(`(() => {
    const p=active(), f=enemy(), guard=species[p.id].el[0]*9+4, attack=moves[f.moves[0]];
    p.en=12;p.moves=[guard];mod(p).status="";
    const damage=estimateDamage(attack,f,p);
    useMove(p,f,guard);
    if(!mod(p).brace || estimateDamage(attack,f,p)>=damage*0.75) return false;
    endEffects(p);
    return !mod(p).brace && mod(p).guard===1;
  })()`),
    "guard softens a forecast hit and the brace expires",
  );
  await ev("Math.random=prng;G.party.forEach(m=>m.hp=0);resolveTurn()");
  check(
    await ev("!B&&G.z===G.last&&G.party.every(m=>m.hp===maxhp(m))&&G.cup===5"),
    "full-party defeat preserves the campaign",
  );
  check(
    await ev(
      "(()=>{let m=G.party[1];deposit(1);let i=G.box.indexOf(m);withdraw(i);return G.party.includes(m)&&!G.box.includes(m)})()",
    ),
    "storage deposit and withdrawal",
  );
  check(
    await ev(
      "(()=>{let s=JSON.stringify(G);for(let i=0;i<100;i++)G=validateSave(JSON.parse(s));try{let g=JSON.parse(s);g.party[0].id=301;validateSave(g);return false}catch{return true}})()",
    ),
    "100 save reloads and invalid species rejection",
  );
  await ev("closeUI();save();");
  await call("Page.reload");
  await waitFor(
    'typeof atlasReady !== "undefined" && atlasReady && titleButtons.length',
    "Artwork restored after reload",
    12000,
  );
  check(
    await ev("G.cup===5&&G.party.length===6"),
    "browser reload restores champion and six companions",
  );
  check(
    await ev(
      "(()=>{beginGame();for(let i=0;i<180;i++){openMap();openAtlas();pageList(1,false);partyUI();bagUI();closeUI();walk(i%2?1:-1,0)}return !ui})()",
    ),
    "180 mixed menu and exploration cycles",
  );
  await call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await wait(300);
  let [x, y] = await ev(
    "(()=>{let b=document.querySelector('#pad button:last-child').getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()",
  );
  let before = await ev("G.x");
  await call("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await wait(180);
  await call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  check((await ev("G.x")) > before, "touch movement on compact viewport");
  await shot("touch-expedition");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1360,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call("Emulation.setTouchEmulationEnabled", { enabled: false });
  await ev(
    "window.capt=async id=>{if(!B)wild(id);const family=species[id].f,stage=family>=130?'shrine/'+(family-130):'arena/'+G.z;if(B?.backdrop!==stage||enemy().id!==id)throw Error('Wrong arena or companion for '+id);Math.random=()=>0;battleAction('item','Lumen Capsule');for(let n=0;n<30&&B;n++)await new Promise(r=>setTimeout(r,20));if(B||ui!=='Capture recorded'||captureStage!==stage)throw Error('Capture failed or lost its arena '+id);nameCapture()};window.naturalRand=Math.random;window.collectionAudit=[];",
  );
  for (let z = 0; z < 10; z++) {
    let out = await ev(
      `(async()=>{go(${z});lodge();closeUI();for(let id of pool(${z})){lodge();closeUI();await capt(id);let m=G.box.at(-1);if(!m||m.id!==id)m=G.party.findLast(m=>m.id===id);if(G.box.includes(m))withdraw(G.box.indexOf(m),1);let i=G.party.indexOf(m);lodge();for(let stage=0;stage<2&&species[m.id].evo;stage++){if(species[m.id].evo.method==='bond'&&!eligible(m)){for(let n=0;n<7&&!eligible(m);n++){closeUI();await capt(pool(G.z)[0])}}if(!eligible(m))throw Error('Evolution unavailable '+m.id);evolution(i);evolveNow()}collectionAudit.push(id)}return [G.caught.length,G.box.length]})()`,
    );
    console.log("Habitat", z, out);
  }
  for (let j of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const id = await ev(`(() => {
      const f=families[${130 + j}];
      go(f.zone);lodge();traverse();useTraversal();enterSanctuary();
      if(!G.sanctuary||!canWalk(G.x,G.y)) throw Error("Sanctuary entrance "+f.zone);
      const altar=landmarks().find(s=>s.key==="altar");
      walkTo(altar.x,altar.y,altar);
      for(let n=0;plannedWalk.length&&n<300;n++) followWalk();
      if(!ui.includes("shrine"))throw Error("Altar unreachable "+f.zone);
      ritual(${j});for(const i of shrineNotes[${j}][3])rite(${j},i);
      if(!G.quests.includes(${j}))throw Error("Unsolved shrine "+f.zone);
      closeUI();
      return f.first;
    })()`);
    if (j === 3) {
      await shot("sanctuary");
      await clickField("guardian");
      await waitFor(
        "B?.backdrop==='shrine/3'",
        "Approach the visible Vernalith",
        12000,
      );
    } else
      await ev(`(() => {
      const spot=landmarks().find(s=>s.key==="guardian");
      if(!spot)throw Error("Guardian missing "+G.z);
      walkTo(spot.x,spot.y,spot);
      for(let n=0;plannedWalk.length&&n<300;n++) followWalk();
      if(!B)throw Error("Guardian unreachable "+G.z);
    })()`);
    check(
      await ev(
        `(async()=>{await capt(${id});return G.caught.includes(${id})})()`,
      ),
      "legendary shrine " + (j + 1),
    );
  }
  check(
    await ev("G.caught.length===300&&validateSave(G).caught.length===300"),
    "all 300 species obtained in one champion save",
  );
  await ev("openAtlas()");
  await shot("complete-atlas");
  await ev("atlasDetail(1)");
  await shot("atlas-evolution-family");
  await ev(
    "G=validateSave(JSON.parse(" +
      JSON.stringify(champSave) +
      "));save();closeUI()",
  );
  console.log("COMPLETE");
}

function checkEvolutionOutlines() {
  function mask(id) {
    const image = sprite(id);
    const pixels = image
      .getContext("2d")
      .getImageData(0, 0, image.width, image.height).data;
    const mask = Uint8Array.from(
      { length: image.width * image.height },
      (_, i) => (pixels[i * 4 + 3] > 0 ? 1 : 0),
    );
    let left = image.width,
      right = 0,
      top = image.height,
      bottom = 0;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const x = i % image.width,
        y = Math.floor(i / image.width);
      left = Math.min(x, left);
      right = Math.max(x, right);
      top = Math.min(y, top);
      bottom = Math.max(y, bottom);
    }
    // Equalise the bounding boxes so enlarging or moving the same artwork fails this check.
    const normalized = Uint8Array.from({ length: 48 * 48 }, (_, i) => {
      const x = left + Math.floor((((i % 48) + 0.5) * (right - left + 1)) / 48);
      const y =
        top +
        Math.floor(((Math.floor(i / 48) + 0.5) * (bottom - top + 1)) / 48);
      return mask[y * image.width + x];
    });
    return { native: mask, normalized };
  }
  function overlap(first, second) {
    let intersection = 0,
      union = 0;
    for (let i = 0; i < first.length; i++) {
      intersection += first[i] & second[i];
      union += first[i] | second[i];
    }
    return intersection / union;
  }
  let masks = species.map((d) => mask(d.id)),
    transitions = 0;
  for (const d of species) {
    if (!d.evo) continue;
    const a = masks[d.id],
      b = masks[d.evo.to];
    if (
      overlap(a.native, b.native) > 0.84 ||
      overlap(a.normalized, b.normalized) > 0.84
    )
      throw Error(
        "Evolution outlines too similar for " +
          d.name +
          " and " +
          species[d.evo.to].name,
      );
    transitions++;
  }
  return transitions === 160;
}

async function additionalChecks() {
  const check = (v, s) => {
    if (!v) throw Error(s);
    console.log("PASS", s);
  };
  await ev(
    "beginGame();closeUI();window.spare=JSON.stringify(G);window.rand=Math.random;Math.random=rng(3448);",
  );
  check(
    await ev(`(() => {
      const snapshot=JSON.stringify(G), random=Math.random;
      const render=battleUI, dialogue=talk, showHall=hall, hud=refresh;
      battleUI=talk=hall=refresh=()=>{};
      function play() {
        for(let step=0;B&&step<80;step++){
          if(B.forced){chooseSwitch(G.party.findIndex(m=>m.hp>0));continue}
          const p=active(),f=enemy(),incoming=moves[B.intent?.id];
          const best=p.moves.map(id=>moves[id]).filter(v=>v.power&&p.en>=v.cost)
            .map(v=>[estimateDamage(v,p,f)*moveAccuracy(v,p)/100,v.id])
            .sort((a,b)=>b[0]-a[0])[0];
          const next=G.party.findIndex(m=>m!==p&&m.hp>maxhp(m)*.4&&incoming?.power&&match(incoming.e,m.id)<1);
          if(p.hp<=maxhp(p)*.36&&G.bag["Field Tonic"])battleAction("item","Field Tonic");
          else if(next>=0&&B.turn%2===1&&match(incoming.e,p.id)>=1&&p.hp<maxhp(p)*.85&&f.hp>best?.[0])
            battleAction("switch",next);
          else if(best)battleAction("move",best[1]);
          else battleAction("rest");
        }
        if(B)throw Error("Opening battle stalled");
      }
      try {
        return [0,3,6].every(starter=>{
          let victories=0;
          for(let seed=1;seed<=12;seed++){
            G=fresh();G.options.fast=true;G.starter=starter;
            G.z=G.last=1;G.visited=[0,1];G.sigils=[0];
            grant(mon(starter));expGain(17);grant(mon(trainingSpot.id,3));
            Math.random=rng(seed*775023);
            gymTrainer();play();
            if(!G.train.includes(1))continue;
            leader();play();
            victories+=G.badges;
          }
          return victories>=10;
        });
      } finally {
        B=null;G=validateSave(JSON.parse(snapshot));Math.random=random;
        battleUI=render;talk=dialogue;hall=showHall;refresh=hud;closeUI();save();
      }
    })()`),
    "all three starters can earn the first badge with the guided catch and starting supplies",
  );
  check(
    await ev(
      `(()=>{let sig=new Set;for(let d of species){for(let back of [false,true])for(let p=0;p<3;p++){let img=sprite(d.id,back,p),data=img.getContext('2d').getImageData(0,0,img.width,img.height).data;let count=0,h=2166136261;for(let i=3;i<data.length;i+=4){let v=data[i]>0?1:0;count+=v;h=Math.imul(h^v,16777619)}if(count<125)return false;if(!back&&!p)sig.add(h)}}return sig.size===300})()`,
    ),
    "1,800 sprite poses present and 300 distinct neutral silhouettes",
  );
  check(
    await ev("(" + checkEvolutionOutlines.toString() + ")()"),
    "all 160 evolutions change outline at native size and after size normalization",
  );
  check(
    await ev(
      `(()=>{atlasDetail(0);const row=document.querySelector(".family-strip"),last=row.querySelectorAll("button")[2];if(row.children.length!==3)return false;last.click();const current=document.querySelector('.family-strip [aria-current="true"]');return current?.innerText==="Verdantler"&&current.querySelector("canvas").dataset.hidden===String(Number(!G.seen.includes(2)))})()`,
    ),
    "Field Atlas family navigation and discovery silhouettes",
  );
  check(
    await ev(`(()=>{
    const snapshot=JSON.stringify(G);
    try{
      const m=mon(0,50);m.nick="Willow";G.party=[m];const moves=m.moves.join(",");
      G.options.fast=false;G.options.reduced=true;
      evolution(0);const canvas=$("evoart"),c=canvas.getContext("2d");
      function occupiedHalf(x){const p=c.getImageData(x,10,64,68).data;let ink=0;for(let i=0;i<p.length;i+=4)if(p[i]>100&&p[i+1]>70&&p[i+2]<150)ink++;return ink>70}
      if(!occupiedHalf(37)||!occupiedHalf(175))return false;
      [...$("content").querySelectorAll("button")].find(b=>b.textContent==="Postpone").click();
      if(m.id!==0)return false;
      G.options.reduced=false;evolution(0);$("content").querySelector(".primary").click();
      if(!evoState.revealed||m.id!==1||m.nick!=="Willow"||m.moves.join(",")!==moves)return false;
      drawEvolution(evoState.t+400);$("content").querySelector(".primary").click();
      if($("evoart"))return false;
      G.options.reduced=true;evolution(0);$("content").querySelector(".primary").click();
      return m.id===2&&!$("evoart")&&m.nick==="Willow"&&m.moves.join(",")===moves;
    }finally{G=validateSave(JSON.parse(snapshot));closeUI();save();refresh()}
  })()`),
    "evolution comparison, postponing, reveal skip, reduced motion and retained companion progression",
  );
  await ev("closeUI()");
  const survey = await ev(`(() => {
    go(1);closeUI();surveyUI();
    const sign=document.querySelector('button[onclick^="trackSpecies"]');
    sign.click();
    return G.tracked;
  })()`);
  check(
    await ev(
      `G.tracked===${survey} && !B && objective()[2]==="tracked" && validateSave(JSON.parse(localStorage.getItem(KEY))).tracked===G.tracked`,
    ),
    "habitat survey places a visible, saved trail in the world",
  );
  await clickField("tracked");
  await waitFor(
    `B && enemy().id===${survey}`,
    "Follow the trail to its wild companion",
    12000,
  );
  await ev("battleAction('flee');clearTracking();");
  check(
    await ev("!B&&G.tracked===null"),
    "walking to a field sign starts the corresponding encounter",
  );
  check(
    await ev(`(() => {
      const snapshot=JSON.stringify(G);
      try {
        for(let i=1;i<=9;i++){
          G.z=i-1;beginRoute(i);closeUI();
          const chimes=fieldStations[i];
          for(const j of chimes.order){
            const spot=landmarks().find(s=>s.chime===j);
            walkTo(spot.x,spot.y,spot);
            if(!arrival && dist(spot)>13)return false;
            for(let n=0;plannedWalk.length&&n<300;n++)followWalk();
            if(plannedWalk.length)return false;
            if(ui==="Field notes recorded")closeUI();
          }
          if(!G.fieldNotes.includes(i))return false;
          const before=G.bag['Dusk Capsule'];
          for(const j of chimes.order)touchChime(i,j);
          if(G.bag['Dusk Capsule']!==before || ui)return false;
          const sighting=landmarks().find(s=>s.key==="field-sighting");
          if(!sighting || !canWalk(sighting.x,sighting.y))return false;
        }
        const old=JSON.parse(snapshot);
        delete old.fieldNotes;
        delete old.options.text;
        delete old.bag["Calibration Lens"];
        if(validateSave(old).fieldNotes.length!==0 || old.bag['Calibration Lens']!==0)return false;
        if(G.bag['Calibration Lens']!==1 || G.fieldNotes.length!==9)return false;
        const copy=validateSave(JSON.parse(JSON.stringify(G)));
        if(copy.fieldNotes.length!==9)return false;
        copy.fieldNotes.push(2);
        try{validateSave(copy);return false}catch{}
        equip(0,"Calibration Lens");
        return moveAccuracy(moves[3],G.party[0])===98&&moveAccuracy(moves[1],G.party[0])===100
          && moveAccuracy(moves[5],G.party[0])===90;
      } finally {G=validateSave(JSON.parse(snapshot));closeUI();save();refresh()}
    })()`),
    "all nine field loops, renewable sightings, one-time rewards, held Lens and legacy saves",
  );
  check(
    await ev(`(() => {
      const snapshot=JSON.stringify(G), random=Math.random;
      try {
        G.party=[mon(0,10),mon(3,10)];G.options.fast=true;
        G.party[1].en=1;
        const opponent=mon(3,9);opponent.moves=[0];
        startBattle([opponent],"rival","Relay test",()=>{});
        const foe=enemy(), partner=G.party[1], intent=B.intent;
        if(intent.id!==0||!$("battleHint").textContent.includes("relay"))return false;
        switchUI();
        if(!$("battlePanel").textContent.includes("Relay on hit")||B.intent!==intent)return false;
        Math.random=()=>0.5;
        chooseSwitch(1);
        if(active()!==partner||!mod(partner).relay||B.relayTarget!==null||
          partner.en!==5+Number(species[partner.id].trait===5))return false;
        const hit=moves[partner.moves[0]], boosted=estimateDamage(hit,partner,foe);
        mod(partner).relay=false;
        if(Math.abs(boosted/estimateDamage(hit,partner,foe)-1.25)>0.001)return false;
        mod(partner).relay=true;
        battleAction("move",partner.moves[0]);
        return B && !mod(partner).relay && B.log.some(line=>line.includes("Relay released"));
      } finally {B=null;G=validateSave(JSON.parse(snapshot));Math.random=random;closeUI();save();refresh()}
    })()`),
    "resisted switch charges one relay, preserves the opponent commitment and boosts exactly one hit",
  );
  check(
    await ev(
      `(()=>{for(let i=0;i<10;i++){
        go(i);sideTrail();traverse();if(!$('passage'))return false;
        useTraversal();enterSanctuary();
        if(!G.sanctuary || !canWalk(G.x,G.y)) return false;
        const saved=validateSave(JSON.parse(localStorage.getItem(KEY)));
        if(!saved.sanctuary||saved.z!==i)return false;
        pauseUI();
        if(document.querySelector(".journal-art h3")?.textContent!==locationName())return false;
        closeUI();
        for (const key of ["altar", "retreat"]){
          const spot=landmarks().find(s=>s.key===key);
          walkTo(spot.x,spot.y);
          for(let n=0;plannedWalk.length&&n<300;n++) followWalk();
          if(dist(spot)>5)return false;
        }
        shrine();leaveSanctuary();
        if(G.sanctuary||!canWalk(G.x,G.y))return false;
      }return true})()`,
    ),
    "all ten equipment passages, walkable altars, saved entrances and safe exits",
  );
  await ev("closeUI();go(1);hall();meetLeader(true)");
  await new Promise((r) => setTimeout(r, 180));
  await shot("leader-portrait");
  await ev(
    "closeUI();go(2);beginRoute(3);closeUI();drawWorld(performance.now())",
  );
  await shot("walking-route");
  check(
    await ev(
      `(()=>{G.trail=0;go(0);loot();let before=G.bag['Amber Pin'];equip(0,'Amber Pin');let equipped=G.party[0].held;equip(0,'');return equipped==='Amber Pin'&&G.bag['Amber Pin']===before})()`,
    ),
    "held equipment round-trip",
  );
  check(
    await ev(
      `(()=>{let m=G.party[0],id=known(m).find(v=>!m.moves.includes(v));tutor(0);learnMove(0,id,0);return m.moves.includes(id)&&m.moves.length===4})()`,
    ),
    "move tutor replaces an equipped move",
  );
  check(
    await ev(
      `(()=>{let g=structuredClone(G);g.bag['Growth Stone']=-1;try{validateSave(g);return false}catch{};let original=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('blocked')};let failed=!save(true);Storage.prototype.setItem=original;let recovered=save(true);return failed&&recovered})()`,
    ),
    "storage failure and recovery",
  );
  check(
    await ev(
      `(()=>{let before=JSON.stringify(G);eraseSave();if(ui!=='Delete expedition?')return false;back();return before===JSON.stringify(G)})()`,
    ),
    "deletion confirmation preserves progress when cancelled",
  );
  check(
    await ev(
      `(async()=>{let ip=$('importer');function choose(text){let dt=new DataTransfer;dt.items.add(new File([text],'expedition.json',{type:'application/json'}));ip.files=dt.files;return ip.onchange({target:ip})}let text=JSON.stringify(G);await choose('{broken');if(JSON.stringify(G)!==text)return false;await choose(text);if(ui!=='Restore expedition?')return false;confirmChoice();return G.cup===5&&G.badges===8})()`,
    ),
    "corrupt import, validated backup and in-game overwrite confirmation",
  );
  await ev(
    "closeUI();G=fresh();titleActive=true;$('stage').classList.add('titleMode');$('titleArt').hidden=false;titleIndex=0;titleScene(0)",
  );
  await shot("01-title-screen");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await new Promise((r) => setTimeout(r, 250));
  let tap = await ev(
    "(()=>{let [x,y,w,h]=titleButtons[0],b=$('titleArt').getBoundingClientRect();return {x:(x+w/2)*b.width/$('titleArt').width,y:(y+h/2)*b.height/$('titleArt').height}})()",
  );
  await call("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [tap],
  });
  await call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  check(
    await ev("!titleActive&&!ui&&objective()[2]==='oriel'"),
    "touch title selection starts in the village",
  );
  const oriel = await ev(`(() => {
    const s = landmarks().find(p=>p.key==="oriel"), r=$("world").getBoundingClientRect();
    return [r.x+s.x*r.width/384, r.y+(s.y-7)*r.height/224];
  })()`);
  await tapAt(...oriel);
  await waitFor(
    "ui==='Choose your field partner'",
    "Touching Oriel walks up and opens the partner choice",
  );
  const newPartner = await atElement('[data-starter="3"]');
  await tapAt(newPartner.x, newPartner.y);
  const chooseButton = await atElement("#chooseStarter");
  await tapAt(chooseButton.x, chooseButton.y);
  await waitFor("G.party[0]?.id===3", "Confirmed Cindillo using touch");
  await ev("closeUI();beginLesson()");
  check(
    await ev(fullBattleScreen),
    "touch battle uses portrait display and shows all commands",
  );
  await shot("touch-battle");
  const pack = await atElement('.battle-tools [onclick="battleBag()"]');
  await tapAt(pack.x, pack.y);
  check(
    await ev('battlePanelOpen() && $("arena").isConnected'),
    "touch supplies overlay the active arena",
  );
  await ev("finish('flee')");

  await call("Emulation.setDeviceMetricsOverride", {
    width: 1360,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call("Emulation.setTouchEmulationEnabled", { enabled: false });
  await ev("pauseUI()");
  await shot("pause-menu");
  await ev("closeUI();drawWorld(0)");
  await ev(
    "Math.random=rand;G=validateSave(JSON.parse(spare));save();showTitle()",
  );
}

async function checkDisplayResolution() {
  const snapshot = await ev("JSON.stringify(G)");
  const viewport = (width, height, deviceScaleFactor, mobile = false) =>
    call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor,
      mobile,
    });
  const clickTitle = async (index) => {
    const p = await ev(`(() => {
      const cv = $("titleArt"), rect = cv.getBoundingClientRect(), logical = sceneSizes.get(cv);
      const [x, y, w, h] = titleButtons[${index}];
      return {x: rect.left + (x + w / 2) * rect.width / logical.width,
              y: rect.top + (y + h / 2) * rect.height / logical.height};
    })()`);
    await mousePress(p.x, p.y);
  };
  await viewport(3840, 2160, 1);
  await ev("G=fresh();showTitle()");
  await waitFor(
    "detailReady && sceneSizes.get($('titleArt')).density === 4",
    "4K title loads its detailed artwork",
    12000,
  );
  const complete = await ev(`(() => {
    const frames = Object.keys(atlasFrames);
    if (frames.length !== Object.keys(detailAtlasFrames).length) return false;
    if (frames.some(name => !detailAtlasFrames[name])) return false;
    for (const name of ["arena/0", "gym/6", "species/Gravlet", "rear/Spriglet"]) {
      const base = artFrame(name), detail = artFrame(name, true);
      if (detail.width !== 2 * base.width || detail.height !== 2 * base.height) return false;
      const { data } = detail.getContext("2d").getImageData(0, 0, detail.width, detail.height);
      let count = 0;
      for (let y = 0; y < detail.height; y += 2) {
        for (let x = 0; x + 1 < detail.width; x += 2) {
          const i = (y * detail.width + x) * 4;
          if (data[i+3] && data[i+7] && Math.abs(data[i] - data[i+4]) >= 4) count++;
        }
      }
      if (count < 100) return false;
    }
    return true;
  })()`);
  if (!complete)
    throw Error("Detailed art must add real samples for the original content");

  await clickTitle(1);
  await waitFor("ui === 'Settings'", "4K title hitboxes reach Settings");
  const graphics = '[data-setting="graphics"]';
  await clickElement(graphics);
  if (!(await ev("G.options.graphics==='high'")))
    throw Error("Manual detail choice failed");
  await viewport(390, 844, 3, true);
  if (!(await ev("displayDensity(innerWidth) === 2")))
    throw Error("High detail did not work on a smaller display");
  await viewport(3840, 2160, 1);
  await clickElement(graphics);
  if (
    !(await ev(
      "G.options.graphics==='classic' && displayDensity(innerWidth)===1",
    ))
  )
    throw Error("Classic mode did not select the native grid");
  await clickElement(graphics);
  if (!(await ev("G.options.graphics==='auto'")))
    throw Error("Auto detail choice failed");
  await press("Escape");
  await waitFor("titleActive && !ui", "Title can close Settings");
  await clickTitle(0);
  await waitFor(
    "!titleActive && world.width===768",
    "Large display follows the high-detail world grid",
  );
  await clickField("oriel");
  await waitFor(
    "ui==='Choose your field partner'",
    "4K field pointer reaches the tutorial",
  );
  await clickElement("#chooseStarter");
  await press("Escape");
  await waitFor(
    "!ui && objective()[2]==='lesson'",
    "Large-screen partner selection",
  );
  await clickField("lesson");
  await waitFor(
    "B?.guided && $('arena').width>=1500",
    "4K encounter uses the larger backing canvas",
  );
  if (
    !(await ev(
      `(${fullBattleScreen}) && document.querySelector(".battle-deck").clientWidth > 1800`,
    ))
  )
    throw Error("4K encounter and command deck must fit the viewport");
  await shot("4k-battle");
  await clickElement('.battle-tools [onclick="battleBag()"]');
  if (!(await ev("battlePanelOpen()")))
    throw Error("4K pointer did not open battle supplies");
  await press("Escape");
  for (const [width, height, ratio, density, mobile] of [
    [1920, 1080, 1, 2, false],
    [1280, 800, 2, 3, false],
    [3440, 1440, 1, 4, false],
    [390, 844, 3, 1, true],
    [1360, 900, 1, 1, false],
  ]) {
    await viewport(width, height, ratio, mobile);
    await waitFor(
      `sceneSizes.get($("arena"))?.density===${density} && (${fullBattleScreen})`,
      `Full-screen arena at ${width} × ${height} and ${ratio}× pixel ratio`,
    );
  }
  await ev(
    `G.options.fast=true; Math.random=()=>0; battleAction("item","Lumen Capsule")`,
  );
  await viewport(3840, 2160, 1);
  await waitFor(
    "ui==='Capture recorded' && sceneSizes.get($('captureField'))?.density===4",
    "Capture scene inherits high display detail",
  );
  await ev("nameCapture();go(1);closeUI();startPuzzle()");
  const puzzleCell = await ev(`(() => {
    const cv = $("roomArt"), size = sceneSizes.get(cv), box = cv.getBoundingClientRect();
    const next = puzzle.n + 1;
    return {
      next, density: size.density,
      x: box.left + (24 + (next % 11) * 24) * box.width / size.width,
      y: box.top + (15 + Math.floor(next / 11) * 24) * box.height / size.height,
    };
  })()`);
  await mousePress(puzzleCell.x, puzzleCell.y);
  if (
    puzzleCell.density !== 2 ||
    !(await ev(`puzzle.n === ${puzzleCell.next}`))
  )
    throw Error("High-detail gym room pointer did not follow the logical grid");
  const defaults = await ev(`(() => {
    const old = JSON.parse(${JSON.stringify(snapshot)});
    delete old.options.graphics;
    if (validateSave(old).options.graphics !== "auto") return false;
    old.options.graphics = "high";
    return validateSave(old).options.graphics === "high";
  })()`);
  if (!defaults)
    throw Error(
      "Graphics preference did not round-trip with new and legacy saves",
    );
  await viewport(1360, 900, 1);
  await ev(
    "G=validateSave(JSON.parse(" +
      JSON.stringify(snapshot) +
      "));Math.random=rng(487);showTitle()",
  );
  console.log(
    "PASS adaptive display at standard HD, 4K, ultrawide, Retina and touch sizes, with matching input",
  );
}

async function contactSheets() {
  for (const back of [false, true]) {
    for (let i = 0; i < 3; i++) {
      const b = await ev(
        `(()=>{let cv=canvas(1000,950),c=cv.getContext('2d');for(let n=0;n<100;n++){let id=${i}*100+n,x=n%10*100,y=Math.floor(n/10)*95;rect(c,x,y,100,95,n%2?'#edf0df':'#f5f2e4');c.drawImage(sprite(id,${back}),x+6,y);c.fillStyle='#304a3b';c.font='8px monospace';c.textAlign='center';c.fillText((id+1)+' '+species[id].name,x+50,y+86)}return cv.toDataURL().split(',')[1]})()`,
      );
      fs.writeFileSync(
        path.join(output, (back ? "rear-" : "species-") + (i + 1) + ".png"),
        Buffer.from(b, "base64"),
      );
    }
  }
  const examples = [
    "Spriglet",
    "Cindillo",
    "Puddlepip",
    "Fuzzlet",
    "Wickit",
    "Dewbit",
    "Ticlet",
    "Plankit",
  ];
  const sheet = await ev(`(()=>{
    const names=${JSON.stringify(examples)}, cv=canvas(1132,804), c=cv.getContext('2d');
    c.imageSmoothingEnabled=false;
    rect(c,0,0,1132,804,"#e9e6d6");
    rect(c,0,0,1132,48,"#28443d");
    c.fillStyle="#f5ebce";c.font="bold 19px monospace";c.fillText("Wildlight  /  Evolution field studies",20,30);
    names.forEach((name,i)=>{
      const f=families.find(a=>a.names[0]===name),x=(i%2)*563+5,y=53+Math.floor(i/2)*187;
      rect(c,x,y,558,182,i%4===0||i%4===3?"#f4f0df":"#eef0e0");
      for(let j=0;j<f.names.length;j++){
        let cx=x+92+186*j+(3-f.names.length)*93,id=f.first+j;
        c.drawImage(sprite(id),cx-88,y,176,156);
        c.fillStyle="#334b3d";c.font="bold 12px monospace";c.textAlign="center";
        c.fillText(species[id].name,cx,y+168);
        if(j<f.names.length-1){c.fillStyle="#86987c";c.fillText("›",cx+93,y+90)}
      }
    });return cv.toDataURL().split(',')[1]})()`);
  fs.writeFileSync(
    path.join(output, "evolution-families.png"),
    Buffer.from(sheet, "base64"),
  );
  const scenery = await ev(`(() => {
    const scenes = [
      ...zones.map((name, i) => [name, "arena/" + i]),
      ...gyms.map((name, i) => [name + " · " + towns[i + 1], "gym/" + i]),
      ...shrineNotes.map(([name], i) => [name, "shrine/" + i]),
      ["Stilllight regulator", "regulator"], ["Asterra Championship", "championship"],
    ];
    const cv = canvas(1035, 622), c = cv.getContext("2d");
    rect(c, 0, 0, cv.width, cv.height, "#142c35");
    scenes.forEach(([name, key], i) => {
      const x = 5 + (i % 5) * 207, y = 5 + Math.floor(i / 5) * 103;
      c.save();
      c.translate(x, y);
      fillArtwork(c, artFrame(key), 200, 82, 0.5, 0.46);
      c.restore();
      c.fillStyle = "#f3dfae"; c.font = "10px monospace"; c.fillText(name, x + 4, y + 97);
    });
    return cv.toDataURL().split(",")[1];
  })()`);
  fs.writeFileSync(
    path.join(output, "arenas.png"),
    Buffer.from(scenery, "base64"),
  );
  let fields = await ev(
    `(()=>{let names=Object.keys(cast),cv=canvas(6*114,Math.ceil(names.length/6)*112),c=cv.getContext('2d');names.forEach((k,i)=>{let x=i%6*114,y=(i/6|0)*112;rect(c,x,y,114,112,'#dce3cc');c.drawImage(portraitArt(k),x+4,y+3);person(c,x+98,y+85,k);c.fillStyle='#354f3f';c.font='bold 10px monospace';c.fillText(cast[k][0],x+6,y+103)});return cv.toDataURL().split(',')[1]})()`,
  );
  fs.writeFileSync(
    root + "/verification/characters.png",
    Buffer.from(fields, "base64"),
  );
}

try {
  await startBrowser();
  await checkEmbeddedArt();
  await solveRoomPlans();
  await campaign();
  const fight = await ev("autofight.toString()");
  await collectAndRecover();
  await ev("window.autofight=" + fight);
  await ev("beginGame();closeUI();G.options.fast=true;Math.random=rng(487)");
  for (let z = 1; z <= 8; z++) {
    await ev("go(" + z + ");lodge();closeUI();leader(true);autofight()");
    if (!(await ev("G.rematch.includes(" + (z - 1) + ")")))
      throw Error("Rematch failed " + z);
  }
  console.log("PASS all eight leader rematches");
  await ev("go(0);rivalFight();autofight()");
  if (await ev("G.rival!==G.badges")) throw Error("Rival battle failed");
  await additionalChecks();
  await checkDisplayResolution();
  await contactSheets();
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS complete campaign, collection, input and artwork verification",
  );
} finally {
  ws?.close();
  chrome.kill();
  await Promise.race([stopped, delay(3000)]);
  fs.rmSync(profile, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 120,
  });
}
