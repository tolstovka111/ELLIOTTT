/* ============================================================
   Логика демо на странице «Анимации»
   ============================================================ */

(() => {
  /* ---------- 01. Окно день/ночь ---------- */
  const winCard = document.getElementById('winCard');
  const winToggle = document.getElementById('windowToggle');
  const winLabel = document.getElementById('winModeLabel');

  if (winToggle) {
    winToggle.addEventListener('click', () => {
      const night = winCard.classList.toggle('night');
      winLabel.textContent = night ? 'Dark mode' : 'Light mode';
    });
  }

  /* ---------- 02. Лампа ---------- */
  const lampRoom = document.getElementById('lampRoom');
  const lampCord = document.getElementById('lampCord');

  if (lampCord) {
    lampCord.addEventListener('click', () => {
      lampCord.classList.add('pull');
      setTimeout(() => {
        lampCord.classList.remove('pull');
        lampRoom.classList.toggle('on');
      }, 140);
    });
  }

  /* ---------- 03. Погода ---------- */
  const skybox = document.getElementById('skybox');
  const range = document.getElementById('weatherRange');
  const lightning = document.getElementById('lightning');
  let lightningTimer = null;

  function scheduleLightning() {
    lightningTimer = setTimeout(() => {
      lightning.classList.remove('flash');
      // перезапуск CSS-анимации
      void lightning.offsetWidth;
      lightning.classList.add('flash');
      scheduleLightning();
    }, 1200 + Math.random() * 2600);
  }

  function updateWeather(value) {
    const t = value / 100;
    skybox.style.setProperty('--w', t);
    if (value >= 92) {
      if (!lightningTimer) scheduleLightning();
    } else if (lightningTimer) {
      clearTimeout(lightningTimer);
      lightningTimer = null;
      lightning.classList.remove('flash');
    }
  }

  if (range) {
    range.addEventListener('input', () => updateWeather(+range.value));
    updateWeather(+range.value);
  }

  /* ---------- 04. Кнопка с грузовиком ---------- */
  const truckBtn = document.getElementById('truckButton');

  if (truckBtn) {
    truckBtn.addEventListener('click', () => {
      if (truckBtn.classList.contains('busy')) return;
      if (truckBtn.classList.contains('done')) {
        truckBtn.classList.remove('done');
        return;
      }
      truckBtn.classList.add('busy');
      setTimeout(() => {
        truckBtn.classList.remove('busy');
        truckBtn.classList.add('done');
      }, 2700);
    });
  }
})();
