const frame = document.getElementById('contentFrame');
const studyTab = document.getElementById('studyTab');
const grammarTab = document.getElementById('grammarTab');
const wordTab = document.getElementById('wordTab');

const pages = {
  study: 'toeic-study.html',
  grammar: 'toeic-grammar-enhanced.html',
  word: 'toeic-word-edit.html'
};

function openPage(type){
  studyTab.classList.toggle('active', type === 'study');
  grammarTab.classList.toggle('active', type === 'grammar');
  wordTab.classList.toggle('active', type === 'word');
  frame.src = pages[type] || pages.study;
  localStorage.setItem('toeicShellTab', type);
}

studyTab.addEventListener('click', () => openPage('study'));
grammarTab.addEventListener('click', () => openPage('grammar'));
wordTab.addEventListener('click', () => openPage('word'));

const savedTab = localStorage.getItem('toeicShellTab');
openPage(['study','grammar','word'].includes(savedTab) ? savedTab : 'study');
