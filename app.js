'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatTime = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(3).padStart(6, '0')}`;
let cases = [], current = 0, toastTimer, loadSequence = 0, rate = 1;
const video = $('video');
function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('on'), 3000);
}
function caseURL(id) {
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('case', id);
  url.hash = 'compare';
  return url;
}
function renderNav() {
  $('case-nav').innerHTML = cases.map((item, i) => `<button type="button" class="case-tab${i === current ? ' active' : ''}" data-case="${i}" aria-pressed="${i === current}" aria-label="案例 ${i+1}：${esc(item.sample)}，shot ${item.shot}，${esc(item.title)}"><img src="${esc(item.poster)}" alt="" width="32" height="48"><span class="case-tab-text"><small>${String(i+1).padStart(2,'0')} / ${esc(item.code)}</small><b>${esc(item.sample)} · shot ${item.shot}</b><span class="case-tab-title">${esc(item.title)}</span></span></button>`).join('');
}
async function loadCase(index, autoplay = false, updateURL = true) {
  if (!cases[index]) return;
  current = index;
  const item = cases[index], sequence = ++loadSequence;
  video.pause();
  $('playback-error').hidden = true;
  renderNav();
  $('case-content').hidden = false;
  $('case-number').textContent = `CASE ${String(index+1).padStart(2,'0')} / 06 · ${item.code}`;
  $('case-title').textContent = item.title;
  $('case-meta').textContent = `${item.sample} · shot ${item.shot}　/　原片 ${formatTime(item.start)} – ${formatTime(item.end)}`;
  $('case-motion').textContent = item.motion;
  $('case-observation').textContent = item.observation;
  $('duration').textContent = `${item.duration.toFixed(2)} s`;
  $('case-position').textContent = `${index+1} / ${cases.length}`;
  $('prev').disabled = index === 0;
  $('next').disabled = index === cases.length-1;
  $('answers').innerHTML = item.answers.map((answer, i) => {
    const featured = answer.id === 'gemini_camdistill';
    return `<article class="answer-card${featured ? ' featured' : ''}" data-arm="${esc(answer.id)}"><div class="arm-header"><h3>${esc(answer.name)}</h3>${featured ? '<span class="verified">✓ 运镜正确</span>' : `<span class="arm-number">0${i+1}</span>`}</div><p class="arm-summary">${esc(answer.summary)}</p><p class="camera-text" lang="en">${esc(answer.camera)}</p>${answer.full ? `<details><summary>查看完整 caption 原文</summary><pre lang="en">${esc(answer.full)}</pre></details>` : ''}</article>`;
  }).join('');
  document.title = `${item.sample} · shot ${item.shot}｜镜头运动六案例对比`;
  video.poster = item.poster;
  video.src = item.video;
  video.loop = $('loop').checked;
  video.load();
  video.playbackRate = rate;
  if (updateURL) history.replaceState(null, '', caseURL(item.id));
  if (autoplay) {
    try { await video.play(); }
    catch (error) { if (sequence === loadSequence && error.name !== 'AbortError') notify('点击播放器中的播放按钮即可观看'); }
  }
}
$('case-nav').addEventListener('click', event => {
  const button = event.target.closest('[data-case]');
  if (button) loadCase(Number(button.dataset.case), true);
});
$('prev').addEventListener('click', () => loadCase(current-1, true));
$('next').addEventListener('click', () => loadCase(current+1, true));
$('loop').addEventListener('change', () => {video.loop = $('loop').checked;});
$('restart').addEventListener('click', () => {video.currentTime = 0; video.play().catch(() => notify('请点击播放按钮'));});
document.querySelectorAll('[data-rate]').forEach(button => button.addEventListener('click', () => {
  rate = Number(button.dataset.rate);
  video.playbackRate = rate;
  document.querySelectorAll('[data-rate]').forEach(b => {
    const active = Number(b.dataset.rate) === rate;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}));
video.addEventListener('loadedmetadata', () => {video.playbackRate = rate;});
video.addEventListener('error', () => {
  $('playback-error').textContent = '视频暂时无法播放，请刷新页面后重试。';
  $('playback-error').hidden = false;
});
$('share').addEventListener('click', async () => {
  const url = caseURL(cases[current].id).href;
  try {
    if (navigator.clipboard) await navigator.clipboard.writeText(url);
    else {
      const input = document.createElement('textarea'); input.value = url; document.body.append(input); input.select();
      const copied = document.execCommand('copy'); input.remove(); if (!copied) throw new Error('clipboard');
    }
    notify('已复制此案例的链接');
  } catch (error) { notify('当前地址栏就是此案例的分享链接'); }
});
$('show-plot').addEventListener('click', () => {
  const item = cases[current];
  $('plot-title').textContent = `${item.sample} · shot ${item.shot} / ViPE 轨迹图`;
  $('plot-image').src = item.plot;
  $('plot-image').alt = `${item.sample} shot ${item.shot} 的 ViPE 相机轨迹图`;
  $('plot-dialog').showModal();
});
$('close-dialog').addEventListener('click', () => $('plot-dialog').close());
$('plot-dialog').addEventListener('click', event => {if (event.target === $('plot-dialog')) $('plot-dialog').close();});
$('reload').addEventListener('click', () => location.reload());
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || $('plot-dialog').open || ['INPUT','TEXTAREA','SELECT','VIDEO','BUTTON','SUMMARY'].includes(document.activeElement?.tagName)) return;
  if (event.key === 'ArrowLeft' && current > 0) {event.preventDefault(); loadCase(current-1, true);}
  if (event.key === 'ArrowRight' && current < cases.length-1) {event.preventDefault(); loadCase(current+1, true);}
});
(async function init() {
  try {
    const response = await fetch('cases.json');
    if (!response.ok) throw new Error('case data');
    const data = await response.json();
    if (data.cases.length !== 6) throw new Error('case count');
    cases = data.cases;
    const requested = new URLSearchParams(location.search).get('case');
    const index = cases.findIndex(item => item.id === requested || item.code === requested);
    await loadCase(Math.max(index, 0));
  } catch (error) {
    $('case-nav').innerHTML = '';
    $('case-content').hidden = true;
    $('load-error').hidden = false;
  }
})();
