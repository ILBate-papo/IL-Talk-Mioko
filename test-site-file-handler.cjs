const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const src = fs.readFileSync(__dirname + '/app.js', 'utf8');
const start = src.indexOf('  ["#photoIn", "#fileIn"].forEach(id => {\n    $(id).onchange');
const end = src.indexOf('\n  const SR =', start);
assert(start > 0 && end > start);
async function check(nativeWindow, outcome = 'success') {
  const elements = new Map(), messages = [], spoken = [];
  let opened = 0, stopped = 0, resumed = 0;
  const $ = id => { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); };
  const context = vm.createContext({
    window: nativeWindow, $, replyQueue: Promise.resolve(), conversationGeneration: 1,
    attachmentPicking: false, replyPending: false, speechPending: false, currentAudio: null, nativeUtterance: null,
    config: () => ({SUPABASE_PROJECT_REF: 'lxjbpklzrhylmlyepdkc'}), headers: async () => ({}),
    resumeListening: () => resumed++, stopListening: () => stopped++, stopSpeech() {}, callStatus() {},
    say: (...args) => spoken.push(args),
    add: (role, text) => { messages.push({role, text}); return {remove() {}, querySelector: () => ({textContent: ''})}; },
    documents: {analyzeFile: async file => {
      opened++; assert.equal(file.name, 'teste.pdf');
      if (outcome === 'cancel') return null;
      if (outcome === 'error') throw Error('Falha de teste');
      if (outcome === 'stale') context.conversationGeneration++;
      return {answer: 'Explicação do laudo.', description: 'Arquivo: teste.pdf'};
    }}
  });
  vm.runInContext(src.slice(start, end).replace('await import("./site-documents.js?v=20261016-3")', 'globalThis.documents'), context);
  const target = {files: [{name: 'teste.pdf'}], value: 'selected'};
  $('#fileIn').onchange({target}); await context.replyQueue;
  assert.equal(opened, 1); assert.equal(stopped, 2); assert.equal(resumed, 1);
  assert.equal(target.value, ''); assert.equal(context.replyPending, false);
  assert(!messages.some(x => /upload ainda não conectado/.test(x.text)));
  if (outcome === 'success') {
    assert(messages.some(x => x.text === 'Explicação do laudo.'));
    assert.equal(spoken[0][1][0].locale, 'pt-BR');
  } else {
    assert.equal(spoken.length, 0);
    assert(!messages.some(x => x.text === 'Explicação do laudo.'));
    if (outcome === 'error') assert(messages.some(x => /Não consegui ler o arquivo: Falha de teste/.test(x.text)));
  }
}
(async () => {
  for (const bridge of [{}, {MiokoNativeMicrophone: {}}, {__miokoNativeInstalled: true}]) {
    for (const outcome of ['success', 'cancel', 'error', 'stale']) await check(bridge, outcome);
  }
  console.log('Passed: browser and both Android markers send documents, speak results, handle cancellation/errors, discard stale replies, and resume listening.');
})().catch(e => {console.error(e); process.exit(1);});
