const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-nav');

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  navigation?.classList.toggle('open', !isOpen);
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('open');
  });
});

const runButton = document.querySelector('[data-run]');
const runLabel = document.querySelector('[data-run-label]');
const runStatus = document.querySelector('[data-status]');
const scanResult = document.querySelector('[data-scan]');
let running = false;

function completeRun() {
  runButton?.classList.remove('is-running');
  runStatus?.classList.add('success');
  if (runLabel) runLabel.textContent = 'Run again';
  if (runStatus) runStatus.lastElementChild.textContent = 'Scan completed successfully';
  scanResult?.classList.add('visible');
  running = false;
}

runButton?.addEventListener('click', () => {
  if (running) return;
  running = true;
  runButton.classList.add('is-running');
  runStatus?.classList.remove('success');
  scanResult?.classList.remove('visible');
  if (runLabel) runLabel.textContent = 'Running';
  if (runStatus) runStatus.lastElementChild.textContent = 'Opening browser…';
  window.setTimeout(completeRun, 1100);
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
window.setTimeout(() => scanResult?.classList.add('visible'), 700);
