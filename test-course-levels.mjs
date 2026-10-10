import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const start=source.indexOf('  const legacyAdvancedLanguage');
const end=source.indexOf('  let voice =',start);
const levels={}, storage={};
const locales={Português:'pt-BR',Japonês:'ja-JP',Inglês:'en-US',Espanhol:'es-ES',Francês:'fr-FR',Coreano:'ko-KR',Italiano:'it-IT'};
const c=vm.createContext({lang:'Japonês',locales,locale:()=>locales[c.lang],window:{MiokoAuth:{userId:()=> 'learner'}},localStorage:{getItem:key=>storage[key]||null}});
vm.runInContext(source.slice(start,end),c);
for(const language of Object.keys(locales)){
 c.lang=language;
 for(const level of ['beginner','intermediate','advanced']){
  levels[language]=level;storage['ilMiokoCourseLevels:learner']=JSON.stringify(levels);
  vm.runInContext('lessonLevel=readCourseLevel()',c);
  assert.equal(vm.runInContext('inputLocale()',c),language!=='Português'&&level==='beginner'?'pt-BR':locales[language]);
  assert.equal(vm.runInContext('spokenLocale()',c),language!=='Português'&&level==='beginner'?'pt-BR':locales[language]);
  if(level==='beginner'&&language!=='Português') assert.match(vm.runInContext('greetingForLesson()',c),/Vou conversar em português/);
 }
}
c.lang='Japonês';levels.Japonês='beginner';levels.Inglês='advanced';storage['ilMiokoCourseLevels:learner']=JSON.stringify(levels);
assert.equal(vm.runInContext('readCourseLevel()',c),'beginner');c.lang='Inglês';assert.equal(vm.runInContext('readCourseLevel()',c),'advanced');
c.window.MiokoAuth.userId=()=> 'different-learner';assert.equal(vm.runInContext('readCourseLevel()',c),'beginner','another account does not inherit the first learner level');
console.log('Passed: seven course levels, correct input/output language, beginner greeting and separate saved levels by course/account.');
