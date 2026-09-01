(()=>{'use strict';
const STARTERS=[
  "What happens when something doesn't go the way it should?",
  'Who receives this after you?',
  'What would happen if this stopped?',
  'Why is it done this way?',
  'What does the person on the other end see?'
];

function ensureStarters(){
  const composer=document.querySelector('.composer-in');
  const input=document.getElementById('question');
  if(!composer||!input)return;
  let row=composer.querySelector('.question-starters');
  if(!row){
    row=document.createElement('div');
    row.className='question-starters';
    const label=document.createElement('span');
    label.textContent='Ways to begin';
    row.appendChild(label);
    STARTERS.forEach((text)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='starter';
      button.textContent=text;
      button.addEventListener('click',()=>{
        input.value=text;
        input.focus();
      });
      row.appendChild(button);
    });
    composer.appendChild(row);
  }
}

function placeInterviewExit(){
  const composer=document.querySelector('.composer-in');
  const exit=document.querySelector('.appointment-exit');
  if(!composer||!exit)return;
  if(exit.parentElement!==composer)composer.appendChild(exit);
}

function apply(){
  if(!document.querySelector('.composer-in'))return;
  ensureStarters();
  placeInterviewExit();
}

const observer=new MutationObserver(apply);
observer.observe(document.getElementById('app'),{childList:true,subtree:true});
apply();
})();
