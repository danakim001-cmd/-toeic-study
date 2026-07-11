let currentPdfIndex = Number(localStorage.getItem('toeicStudyPdfIndex') || 0);
const openChaptersKey = 'toeicStudyOpenChapters';
let openChapters = JSON.parse(localStorage.getItem(openChaptersKey) || '{}');
const pageEditsKey = 'toeicStudyPageEdits';
let pageEdits = JSON.parse(localStorage.getItem(pageEditsKey) || '{}');
let editingChapterId = null;

const materialPanel = document.getElementById('materialPanel');
const pdfBadge = document.getElementById('pdfBadge');
const pdfTitle = document.getElementById('pdfTitle');
const pdfDesc = document.getElementById('pdfDesc');
const chapterStack = document.getElementById('chapterStack');

function save(){
  localStorage.setItem('toeicStudyPdfIndex', currentPdfIndex);
  localStorage.setItem(openChaptersKey, JSON.stringify(openChapters));
  localStorage.setItem(pageEditsKey, JSON.stringify(pageEdits));
}
function currentPdf(){ return TOEIC_STUDY_DATA[currentPdfIndex] || TOEIC_STUDY_DATA[0]; }
function togglePanel(){
  const btn = document.getElementById('materialToggle');
  const panel = document.getElementById('materialPanel');
  const closed = panel.classList.toggle('closed');
  btn.classList.toggle('open', !closed);
  btn.setAttribute('aria-expanded', String(!closed));
}
document.getElementById('materialToggle').addEventListener('click', togglePanel);

function escapeHtml(str){
  return String(str || '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
}

function chapterKey(pdfId, no){ return `${pdfId}_${no}`; }
function editableChapter(ch){
  const pdf = currentPdf();
  const key = chapterKey(pdf.pdfId, ch.no);
  const edit = pageEdits[key] || {};
  const examples = Array.isArray(edit.examples) && edit.examples.length ? edit.examples : ch.examples;
  const mistakes = Array.isArray(edit.mistakes) && edit.mistakes.length ? edit.mistakes : ch.mistakes;
  return {
    ...ch,
    core: (edit.core && edit.core.trim()) ? edit.core : ch.core,
    examples,
    mistakes,
    tip: (edit.tip && edit.tip.trim()) ? edit.tip : ch.tip
  };
}
function editChapter(id){
  editingChapterId = id;
  openChapters[id] = true;
  save();
  renderChapters();
  setTimeout(()=>document.getElementById(`chapter_${id}`)?.scrollIntoView({behavior:'smooth', block:'center'}), 50);
}
function cancelEdit(){
  editingChapterId = null;
  renderChapters();
}
function addEditItem(id, kind){
  const box = document.getElementById(`edit_${kind}_${id}`);
  if(!box) return;
  const div = document.createElement('div');
  div.className = 'edit-list-item';
  div.innerHTML = `<textarea class="edit-field" data-kind="${kind}" placeholder="내용 입력"></textarea><button class="mini-delete-btn" type="button" onclick="this.parentElement.remove()">삭제</button>`;
  box.appendChild(div);
}
async function saveEditToSupabase(pageId, editData){
  try {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if(userError) throw userError;
    if(!user) return;

    const { error } = await supabaseClient
      .from('study_pages')
      .upsert({
        user_id: user.id,
        page_id: pageId,
        core: editData.core,
        examples: editData.examples,
        mistakes: editData.mistakes,
        tip: editData.tip
      }, { onConflict: 'user_id,page_id' });

    if(error) console.error(error);
  } catch(error) {
    console.error(error);
  }
}
function saveEdit(id){
  const card = document.getElementById(`chapter_${id}`);
  if(!card) return;
  const core = card.querySelector('[data-field="core"]')?.value.trim() || '';
  const tip = card.querySelector('[data-field="tip"]')?.value.trim() || '';
  const examples = [...card.querySelectorAll('[data-kind="examples"]')].map(x=>x.value.trim()).filter(Boolean);
  const mistakes = [...card.querySelectorAll('[data-kind="mistakes"]')].map(x=>x.value.trim()).filter(Boolean);
  pageEdits[id] = {core, examples, mistakes, tip};
  editingChapterId = null;
  save();
  saveEditToSupabase(id, pageEdits[id]);
  renderChapters();
}
async function resetEdit(id){
  if(!confirm('이 페이지에서 직접 수정한 내용을 원래대로 돌릴까?')) return;
  delete pageEdits[id];
  editingChapterId = null;
  save();
  renderChapters();

  try {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if(userError) throw userError;
    if(!user) return;

    const { error } = await supabaseClient
      .from('study_pages')
      .delete()
      .eq('user_id', user.id)
      .eq('page_id', id);

    if(error) console.error(error);
  } catch(error) {
    console.error(error);
  }
}

function openPdf(index){
  currentPdfIndex = index;
  save();
  render();
  window.scrollTo({top:0, behavior:'smooth'});
}

function renderMaterials(){
  materialPanel.innerHTML = `<div class="pdf-list">${TOEIC_STUDY_DATA.map((pdf, i) => `
    <button class="pdf-btn ${i === currentPdfIndex ? 'active' : ''}" type="button" onclick="openPdf(${i})">
      <span class="pdf-left"><span class="pdf-arrow">⌄</span><span class="pdf-name">${escapeHtml(pdf.label)} · ${escapeHtml(shortTitle(pdf.title))}</span></span>
      <span class="pdf-count">${pdf.chapters.length}개</span>
    </button>
  `).join('')}</div>`;
}

function shortTitle(title){
  return String(title || '').replace('토익 Part5 ', '').replace('TOEIC Part 5 — ', '');
}

function chapterId(pdfId, chapterNo){ return `${pdfId}_${chapterNo}`; }
function toggleChapter(id){
  openChapters[id] = !openChapters[id];
  save();
  renderChapters();
}
function toggleDrawing(id){
  const box = document.getElementById(`drawing_${id}`);
  const btn = document.getElementById(`drawBtn_${id}`);
  const hidden = box.classList.toggle('hidden');
  btn.textContent = hidden ? '그림 보기' : '그림 접기';
}

function render(){
  const pdf = currentPdf();
  pdfBadge.textContent = pdf.label;
  pdfTitle.textContent = pdf.title;
  pdfDesc.textContent = 'PDF 안의 내용을 챕터별로 이어서 공부하는 화면';
  renderMaterials();
  renderChapters();
}

function renderChapters(){
  const pdf = currentPdf();
  chapterStack.innerHTML = pdf.chapters.map((raw, index) => {
    const id = chapterId(pdf.pdfId, raw.no);
    const ch = editableChapter(raw);
    const isOpen = openChapters[id] ?? index === 0;
    const isEditing = editingChapterId === id;
    return `
      <article id="chapter_${id}" class="chapter-card ${isEditing ? 'editing-card' : ''}">
        <button class="chapter-head ${isOpen ? 'active' : ''}" type="button" onclick="toggleChapter('${id}')">
          <span>
            <span class="badge">CHAPTER ${escapeHtml(ch.no)}</span>
            <div class="chapter-name">${escapeHtml(ch.title)}</div>
            <div class="chapter-summary">${escapeHtml(ch.desc)}</div>
            ${isEditing ? '<span class="edit-mode-label">수정 모드</span>' : ''}
          </span>
          <span class="chapter-arrow">⌄</span>
        </button>
        <div class="chapter-body ${isOpen ? '' : 'closed'}">
          <div class="study-section">
            <h3>핵심 규칙</h3>
            ${isEditing ? `<textarea class="edit-field" data-field="core">${escapeHtml(ch.core)}</textarea>` : `<p>${escapeHtml(ch.core)}</p>`}
          </div>

          <button id="drawBtn_${id}" class="draw-btn" type="button" onclick="toggleDrawing('${id}')">그림 보기</button>
          <div id="drawing_${id}" class="drawing-box hidden">${drawing(raw.drawing, ch.tip)}</div>

          <div class="study-section">
            <h3>예문</h3>
            ${isEditing ? editListHtml(id, 'examples', ch.examples || [], '예문 추가') : (ch.examples || []).map(ex => `<div class="example">${escapeHtml(ex)}</div>`).join('')}
          </div>

          <div class="study-section warning">
            <h3>실수 방지</h3>
            ${isEditing ? editListHtml(id, 'mistakes', ch.mistakes || [], '실수 방지 추가') : `<ul>${(ch.mistakes || []).map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`}
          </div>

          <div class="study-section tip">
            <h3>암기 팁</h3>
            ${isEditing ? `<textarea class="edit-field" data-field="tip">${escapeHtml(ch.tip)}</textarea>` : `<p>${escapeHtml(ch.tip)}</p>`}
          </div>

          ${isEditing ? `
            <div class="edit-actions">
              <button class="primary" type="button" onclick="saveEdit('${id}')">저장</button>
              <button type="button" onclick="cancelEdit()">취소</button>
              <button class="mini-delete-btn" type="button" onclick="resetEdit('${id}')">원래대로</button>
            </div>
          ` : `
            <span class="quiz-note">미니퀴즈는 다음 단계에서 연결</span>
            <div class="edit-footer"><button class="page-edit-btn" type="button" onclick="editChapter('${id}')"><span class="plus-circle">+</span> 페이지 수정</button></div>
          `}
        </div>
      </article>
    `;
  }).join('');
}

function editListHtml(id, kind, items, label){
  const rows = (items && items.length ? items : ['']).map(item => `
    <div class="edit-list-item">
      <textarea class="edit-field" data-kind="${kind}" placeholder="내용 입력">${escapeHtml(item)}</textarea>
      <button class="mini-delete-btn" type="button" onclick="this.parentElement.remove()">삭제</button>
    </div>
  `).join('');
  return `<div id="edit_${kind}_${id}" class="edit-list">${rows}</div><div class="edit-add-row"><button class="mini-edit-btn" type="button" onclick="addEditItem('${id}','${kind}')">+ ${label}</button></div>`;
}

function drawing(type, caption){
  const captions = {
    pos:'품사는 빈칸의 자리를 보고 고른다', verbKind:'동사 종류마다 뒤에 오는 말이 다르다', clue:'신호를 찾고 바로 답 말고 뒤를 확인한다', order:'관사와 소유격 뒤에는 순서가 있다', pronoun:'뒤에 명사가 있으면 소유격을 먼저 본다', noun:'명사 자리여도 뒤 명사 확인이 먼저다', compound:'명사와 명사가 붙으면 한 덩어리가 될 수 있다', gerund1:'행동이 주어가 되면 동명사를 본다', adj:'빈칸 뒤 명사가 있으면 형용사 후보', participle1:'명사가 하면 ing, 당하면 PP', hasbeen:'목적어가 있으면 ing, 없으면 PP 후보', map1:'1탄은 자리 보는 법이 핵심', be:'주어가 당한 상태면 PP', emotion:'사람은 감정을 느끼고, 사물은 감정을 준다', post:'명사 뒤에서 덧붙여 설명하면 후치수식', comma:'콤마가 보이면 주어 기준으로 판단한다', adverb:'형용사 앞 빈칸은 부사 후보', subject:'주어와 동사 사이 빈칸은 부사', complete:'문장이 끝났는데 남으면 부사', set:'정해진 세트 사이에는 부사가 들어간다', gerund:'동명사는 동사 느낌이 남아 부사가 꾸민다', when:'when, than, how 안에서도 부사 자리가 나온다', verb:'진짜 주어를 찾아 수일치를 본다', map:'2탄은 부사와 ing/PP 판단이 핵심'
  };
  const scene = sceneByType(type);
  return `<div class="crayon-art">${scene}<p class="crayon-caption">${escapeHtml(captions[type] || caption || '그림으로 구조를 기억하기')}</p></div>`;
}

function svgWrap(inner){
  return `<svg viewBox="0 0 760 390" role="img" aria-label="색연필 학습 그림" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7"/></filter>
  </defs>
  <rect x="14" y="14" width="732" height="362" rx="34" fill="#fff8e8" stroke="#ead9b8" stroke-width="3"/>
  <path class="crayon-line" d="M62 70 C100 28, 157 40, 170 76 C203 72, 218 99, 201 124 C154 127, 110 126, 66 125 C38 106, 42 83, 62 70Z" fill="#d9ecff" stroke="#7ab6e8" stroke-width="6" opacity=".95"/>
  <path class="crayon-line" d="M578 72 C610 37, 668 46, 678 86 C710 90, 719 117, 695 137 C648 141, 603 137, 565 135 C546 112, 552 88, 578 72Z" fill="#d9ecff" stroke="#7ab6e8" stroke-width="6" opacity=".95"/>
  <circle cx="655" cy="250" r="36" fill="#ffe370" stroke="#f3b321" stroke-width="6" filter="url(#rough)"/>
  <path class="crayon-line" d="M652 198 L654 174 M704 218 L725 202 M708 268 L732 276 M617 207 L602 188 M612 289 L596 310" stroke="#f3b321" stroke-width="5" fill="none"/>
  <path class="crayon-line" d="M85 330 C105 302, 135 302, 151 330 C166 302, 196 303, 211 330" fill="none" stroke="#82c98e" stroke-width="6"/>
  ${inner}
  </svg>`;
}

function person(x,y,color){
  return `<g filter="url(#rough)"><circle cx="${x}" cy="${y}" r="34" fill="#ffd7b5" stroke="#3d332b" stroke-width="5"/><path d="M${x-13} ${y+4} Q${x} ${y+16} ${x+15} ${y+4}" fill="none" stroke="#3d332b" stroke-width="4" stroke-linecap="round"/><circle cx="${x-12}" cy="${y-4}" r="4" fill="#3d332b"/><circle cx="${x+13}" cy="${y-4}" r="4" fill="#3d332b"/><path d="M${x-34} ${y-20} Q${x} ${y-58} ${x+34} ${y-19}" fill="none" stroke="#3d332b" stroke-width="8" stroke-linecap="round"/><path d="M${x-46} ${y+88} Q${x} ${y+38} ${x+46} ${y+88} Z" fill="${color}" stroke="#3d332b" stroke-width="5"/></g>`;
}
function box(x,y,w,h,text,fill){
  return `<g filter="url(#rough)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${fill}" stroke="#3d332b" stroke-width="5"/><text x="${x+w/2}" y="${y+h/2+8}" font-size="28" text-anchor="middle" font-family="Pretendard, Arial" font-weight="900" fill="#2d2a26">${escapeHtml(text)}</text></g>`;
}
function arrow(x1,y1,x2,y2,color='#f28b30'){
  return `<path class="crayon-line" d="M${x1} ${y1} C${(x1+x2)/2} ${y1-20}, ${(x1+x2)/2} ${y2+20}, ${x2} ${y2}" stroke="${color}" stroke-width="7" fill="none" marker-end="url(#m)"/>`;
}
function simpleArrowDef(){
  return `<defs><marker id="m" markerWidth="12" markerHeight="12" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#f28b30"/></marker></defs>`;
}

function sceneByType(type){
  const flow = (a,b,c) => svgWrap(`${simpleArrowDef()}${box(110,165,150,70,a,'#dff0ff')}${arrow(275,200,360,200)}${box(305,165,150,70,b,'#fff0b8')}${arrow(470,200,555,200)}${box(500,165,150,70,c,'#ffe1ed')}`);
  const actor = () => svgWrap(`${person(210,170,'#bfe7ff')}${box(350,145,170,72,'행동 ing','#e8ffd9')}${arrow(300,180,350,180)}${box(530,210,120,66,'목적어','#fff0b8')}`);
  const passive = () => svgWrap(`${box(245,92,180,66,'무언가에 의해','#fff0b8')}${arrow(335,165,335,220)}${person(335,245,'#ffd6e7')}${box(465,220,135,66,'PP','#dff0ff')}`);
  const emotion = () => svgWrap(`${person(210,185,'#cfe6ff')}${box(95,270,230,58,'감정을 느끼는 사람','#dff0ff')}${box(430,135,165,70,'즐거운 결과','#fff0b8')}${arrow(510,210,305,180)}${box(405,270,210,58,'감정을 주는 사물','#ffe1ed')}`);
  const adverb = () => svgWrap(`${box(170,135,140,66,'very','#fff0b8')}${arrow(320,170,425,170)}${box(410,135,170,66,'beautiful','#ffe1ed')}${box(270,240,210,62,'형용사를 꾸밈','#dff0ff')}`);
  const subject = () => svgWrap(`${box(115,165,150,70,'주어','#dff0ff')}${box(305,165,150,70,'부사','#fff0b8')}${box(495,165,150,70,'동사','#ffe1ed')}${arrow(265,200,305,200)}${arrow(455,200,495,200)}`);
  const set = () => svgWrap(`${box(100,160,165,70,'should','#dff0ff')}${box(305,160,150,70,'fully','#fff0b8')}${box(495,160,165,70,'explain','#e8ffd9')}${arrow(265,195,305,195)}${arrow(455,195,495,195)}`);
  const noun = () => svgWrap(`${person(180,160,'#d9f7c7')}${box(330,128,170,70,'명사 자리','#fff0b8')}${box(520,225,120,65,'명사','#dff0ff')}${arrow(285,170,330,160)}`);
  const compound = () => svgWrap(`${box(130,155,160,70,'data','#dff0ff')}${box(300,155,180,70,'security','#fff0b8')}${box(490,155,140,70,'policy','#ffe1ed')}${box(245,260,275,62,'한 덩어리 명사','#e8ffd9')}`);
  const comma = () => svgWrap(`${box(100,150,145,70,'분사구문','#dff0ff')}${box(300,150,70,70,',','#fff0b8')}${box(430,150,170,70,'주어 확인','#ffe1ed')}${arrow(245,185,300,185)}${arrow(370,185,430,185)}`);
  const when = () => svgWrap(`${box(120,145,140,70,'when','#dff0ff')}${box(300,145,150,70,'부사','#fff0b8')}${box(490,145,140,70,'PP','#ffe1ed')}${arrow(260,180,300,180)}${arrow(450,180,490,180)}`);
  const verb = () => svgWrap(`${person(180,170,'#cfe6ff')}${box(315,130,170,66,'진짜 주어','#fff0b8')}${box(515,190,120,66,'동사','#e8ffd9')}${arrow(285,168,315,162)}${arrow(485,176,515,210)}`);
  switch(type){
    case 'verbKind': return flow('be동사','형용사','상태');
    case 'clue': return flow('신호','뒤 확인','정답');
    case 'order': return flow('관사','부사/형용사','명사');
    case 'pronoun': return flow('명사 앞','소유격','his');
    case 'noun': return noun();
    case 'compound': return compound();
    case 'gerund1': return flow('행동','-ing','주어');
    case 'adj': return flow('빈칸','뒤 명사','형용사');
    case 'participle1': return flow('명사','한다/당한다','ing/PP');
    case 'hasbeen': return flow('has been','목적어 확인','ing/PP');
    case 'be': return passive();
    case 'emotion': return emotion();
    case 'post': return actor();
    case 'comma': return comma();
    case 'adverb': return adverb();
    case 'subject': return subject();
    case 'complete': return flow('완전한 문장','남은 빈칸','부사');
    case 'set': return set();
    case 'gerund': return flow('regularly','updating','동작 꾸밈');
    case 'when': return when();
    case 'verb': return verb();
    case 'map': return flow('부사','동사','ing/PP');
    case 'map1': return flow('자리','구조','뜻');
    default: return flow('자리','구조','정답');
  }
}

render();
