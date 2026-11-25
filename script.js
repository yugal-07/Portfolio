document.querySelectorAll('.detail-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const detail = button.nextElementSibling;
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isOpen));
    button.querySelector('span').textContent = isOpen ? '＋' : '−';
    detail.hidden = isOpen;
  });
});

const progress = document.querySelector('.reading-progress');
const progressPath = progress.querySelector('path');
const progressDot = progress.querySelector('circle');
const scroller = document.querySelector('main');
const desktopLayout = window.matchMedia('(min-width: 768px)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let progressSegments = [];
let progressLength = 0;
let progressPosition = 0;
let progressTarget = 0;
let progressFrame = 0;

const lengthAtX = (x) => {
  let length = 0;
  for (const segment of progressSegments) {
    if (segment.from.x === segment.to.x) {
      if (x < segment.from.x) return length;
      length += segment.length;
    } else {
      if (x < segment.to.x) return length + Math.max(0, x - segment.from.x);
      length += segment.length;
    }
  }
  return length;
};

const renderProgress = () => {
  progressPath.style.strokeDashoffset = `${progressLength - progressPosition}`;
  const point = progressPath.getPointAtLength(progressPosition);
  progressDot.setAttribute('cx', point.x);
  progressDot.setAttribute('cy', point.y);
  progressDot.style.opacity = progressPosition > 0 ? '1' : '0';
};

const animateProgress = () => {
  const distance = progressTarget - progressPosition;
  if (reduceMotion || Math.abs(distance) < 0.25) {
    progressPosition = progressTarget;
    renderProgress();
    progressFrame = 0;
    return;
  }
  progressPosition += distance * 0.16;
  renderProgress();
  progressFrame = requestAnimationFrame(animateProgress);
};

const updateProgress = () => {
  if (!desktopLayout.matches || !progressSegments.length) return;
  const position = scroller.scrollLeft;
  progress.style.transform = `translate3d(${-position}px,0,0)`;
  progressTarget = lengthAtX(position + scroller.clientWidth * 0.55);
  if (!progressFrame) progressFrame = requestAnimationFrame(animateProgress);
};

const buildProgressRoute = () => {
  if (!desktopLayout.matches) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const scrollLeft = scroller.scrollLeft;
  const defaultLane = scroller.clientHeight - 72;
  const findClearY = (section, startX, endX, preferredY, maxY = scroller.clientHeight - 8) => {
    const blocked = [];
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        const left = rect.left - scrollerRect.left + scrollLeft;
        const right = rect.right - scrollerRect.left + scrollLeft;
        if (right >= startX && left <= endX) blocked.push([rect.top - scrollerRect.top - 10, rect.bottom - scrollerRect.top + 10]);
      }
    }
    const minY = 80;
    const preferred = Math.min(maxY, Math.max(minY, preferredY));
    const candidates = [preferred, minY, maxY, ...blocked.flatMap(([top, bottom]) => [top - 1, bottom + 1])]
      .filter((y) => y >= minY && y <= maxY && blocked.every(([top, bottom]) => y < top || y > bottom));
    if (!candidates.length) return preferred;
    return candidates.reduce((closest, y) => Math.abs(y - preferred) < Math.abs(closest - preferred) ? y : closest, candidates[0]);
  };
  const routeSections = [...document.querySelectorAll('main > section[id]')];
  const stops = routeSections.map((section) => {
    const title = section.querySelector('h1, h2');
    const titleRect = title.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const sectionX = sectionRect.left - scrollerRect.left + scrollLeft;
    const startX = titleRect.left - scrollerRect.left + scrollLeft;
    let endX = Math.min(sectionX + scroller.clientWidth - 96, Math.max(titleRect.right - scrollerRect.left + scrollLeft + 24, sectionX + scroller.clientWidth * 0.58));
    let headingEndX = endX;
    let lane = defaultLane;
    let maxRouteY = scroller.clientHeight - 8;
    let bridgeY = null;
    let visualBottomY = null;

    if (section.matches('.work')) {
      const projects = [...section.querySelectorAll('.project')].map((project) => project.getBoundingClientRect());
      const gaps = projects.slice(1).map((project, index) => (projects[index].right + project.left) / 2 - scrollerRect.left + scrollLeft);
      if (gaps.length) endX = gaps.reduce((closest, gap) => Math.abs(gap - endX) < Math.abs(closest - endX) ? gap : closest);
      const asideRect = section.querySelector('.section-aside').getBoundingClientRect();
      headingEndX = (title.parentElement.getBoundingClientRect().right + asideRect.left) / 2 - scrollerRect.left + scrollLeft;
      const projectTop = Math.min(...projects.map((project) => project.top - scrollerRect.top));
      const projectBottom = Math.max(...projects.map((project) => project.bottom - scrollerRect.top));
      const headingBottom = Math.max(...[...section.querySelectorAll('.section-heading > *')].map((element) => element.getBoundingClientRect().bottom - scrollerRect.top));
      bridgeY = (headingBottom + projectTop) / 2;
      maxRouteY = projectTop - 8;
      if (lane > projectTop - 8 && lane < projectBottom + 8) lane = bridgeY;
    }

    if (section.matches('.skills')) {
      const listRect = section.querySelector('.skill-list').getBoundingClientRect();
      endX = (title.parentElement.getBoundingClientRect().right + listRect.left) / 2 - scrollerRect.left + scrollLeft;
      const rows = [...section.querySelectorAll('.skill-list > div')].map((row) => row.getBoundingClientRect());
      const rowsTop = Math.min(...rows.map((row) => row.top - scrollerRect.top));
      const rowsBottom = Math.max(...rows.map((row) => row.bottom - scrollerRect.top));
      if (lane > rowsTop - 8 && lane < rowsBottom + 8) {
        const belowRows = rowsBottom + 16;
        lane = belowRows < scroller.clientHeight - 8 ? belowRows : rowsTop - 16;
      }
    }

    if (section.matches('.about')) {
      const copyRect = section.querySelector('.about-copy').getBoundingClientRect();
      endX = (titleRect.right + copyRect.left) / 2 - scrollerRect.left + scrollLeft;
    }

    if (section.matches('.hero')) {
      const visualRect = section.querySelector('.hero-visual').getBoundingClientRect();
      if (visualRect.width) {
        endX = (titleRect.right + visualRect.left) / 2 - scrollerRect.left + scrollLeft;
        headingEndX = endX;
        visualBottomY = visualRect.bottom - scrollerRect.top + 12;
      }
    }

    const belowTitle = titleRect.bottom - scrollerRect.top + 12;
    const preferredY = visualBottomY === null
      ? (belowTitle < maxRouteY ? belowTitle : titleRect.top - scrollerRect.top - 12)
      : Math.min(maxRouteY, Math.max(belowTitle, visualBottomY));
    const y = findClearY(section, startX, headingEndX, preferredY, maxRouteY);
    return {
      startX,
      endX,
      y,
      lane,
      exitPoints: bridgeY === null
        ? [{x: endX, y}]
        : [{x: headingEndX, y}, {x: headingEndX, y: bridgeY}, {x: endX, y: bridgeY}],
    };
  });
  const points = [];
  stops.forEach((stop, index) => {
    if (index === 0) points.push({x: stop.startX, y: stop.y});
    else points.push({x: stop.startX - 64, y: stops[index - 1].lane}, {x: stop.startX - 64, y: stop.y});
    points.push(...stop.exitPoints);
    if (index < stops.length - 1) points.push({x: stop.endX, y: stop.lane});
  });
  console.assert(points.every((point, index) => !index || point.x >= points[index - 1].x), 'Progress route must move left to right');

  progressLength = 0;
  progressSegments = points.slice(1).map((to, index) => {
    const from = points[index];
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    progressLength += length;
    return {from, to, length};
  });
  progress.setAttribute('width', scroller.scrollWidth);
  progress.setAttribute('height', scroller.clientHeight);
  progress.style.width = `${scroller.scrollWidth}px`;
  progress.style.height = `${scroller.clientHeight}px`;
  progressPath.setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '));
  progressPath.style.strokeDasharray = `${progressLength}`;
  progressTarget = lengthAtX(scrollLeft + scroller.clientWidth * 0.55);
  if (progressPosition) progressPosition = progressTarget;
  renderProgress();
  updateProgress();
};

scroller.addEventListener('scroll', updateProgress, { passive: true });
desktopLayout.addEventListener('change', buildProgressRoute);
let progressResizeFrame = 0;
window.addEventListener('resize', () => {
  if (progressResizeFrame) return;
  progressResizeFrame = requestAnimationFrame(() => {
    buildProgressRoute();
    progressResizeFrame = 0;
  });
});
buildProgressRoute();
document.fonts.ready.then(buildProgressRoute);

const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('.topbar nav a[href^="#"]')];
const updateActiveSection = () => {
  const sectionPosition = desktopLayout.matches ? innerWidth / 2 : innerHeight / 2;
  const active = sections.reduce((current, section) => {
    const rect = section.getBoundingClientRect();
    const position = desktopLayout.matches ? rect.left : rect.top;
    if (position <= sectionPosition) return section;
    return current;
  }, sections[0]);
  navLinks.forEach((link) => {
    if (link.hash === `#${active.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
};
window.addEventListener('scroll', updateActiveSection, { passive: true });
scroller.addEventListener('scroll', updateActiveSection, { passive: true });
desktopLayout.addEventListener('change', updateActiveSection);
updateActiveSection();

let horizontalScrollTarget = scroller.scrollLeft;
let horizontalScrollFrame = 0;
let horizontalScrollTime = 0;

const stopHorizontalScroll = () => {
  if (horizontalScrollFrame) cancelAnimationFrame(horizontalScrollFrame);
  horizontalScrollFrame = 0;
  horizontalScrollTime = 0;
  horizontalScrollTarget = scroller.scrollLeft;
};

const animateHorizontalScroll = (time) => {
  horizontalScrollTarget = Math.max(0, Math.min(scroller.scrollWidth - scroller.clientWidth, horizontalScrollTarget));
  const distance = horizontalScrollTarget - scroller.scrollLeft;
  const elapsed = horizontalScrollTime ? Math.min(time - horizontalScrollTime, 32) : 16;
  const easing = 1 - Math.exp(-elapsed / 110);
  if (Math.abs(distance) < 0.5 || Math.abs(distance * easing) < 0.5) {
    scroller.scrollTo({left: horizontalScrollTarget, behavior: 'instant'});
    horizontalScrollFrame = 0;
    horizontalScrollTime = 0;
    return;
  }

  horizontalScrollTime = time;
  scroller.scrollTo({left: scroller.scrollLeft + distance * easing, behavior: 'instant'});
  horizontalScrollFrame = requestAnimationFrame(animateHorizontalScroll);
};

const scrollHorizontallyBy = (distance) => {
  if (!horizontalScrollFrame) horizontalScrollTarget = scroller.scrollLeft;
  const maxScroll = scroller.scrollWidth - scroller.clientWidth;
  horizontalScrollTarget = Math.max(0, Math.min(maxScroll, horizontalScrollTarget + distance));

  if (reduceMotion) {
    scroller.scrollTo({left: horizontalScrollTarget, behavior: 'instant'});
    return;
  }
  if (!horizontalScrollFrame && Math.abs(horizontalScrollTarget - scroller.scrollLeft) >= 0.5) {
    horizontalScrollFrame = requestAnimationFrame(animateHorizontalScroll);
  }
};

scroller.addEventListener('scroll', () => {
  if (!horizontalScrollFrame) horizontalScrollTarget = scroller.scrollLeft;
}, {passive: true});
window.addEventListener('pointerdown', stopHorizontalScroll, {passive: true});
window.addEventListener('hashchange', stopHorizontalScroll);
desktopLayout.addEventListener('change', stopHorizontalScroll);

window.addEventListener('wheel', (event) => {
  if (!desktopLayout.matches || event.ctrlKey) return;
  event.preventDefault();
  const scrollDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? innerWidth : 1;
  scrollHorizontallyBy(scrollDelta * unit);
}, { passive: false });

window.addEventListener('keydown', (event) => {
  if (!desktopLayout.matches || event.target.matches('input, textarea, [contenteditable]') || event.altKey || event.ctrlKey || event.metaKey || !['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp'].includes(event.key)) return;
  event.preventDefault();
  scrollHorizontallyBy(['ArrowLeft', 'PageUp'].includes(event.key) ? -innerWidth : innerWidth);
});

const portraitCanvas = document.querySelector('.ascii-portrait');
const portraitContext = portraitCanvas.getContext('2d');
const portraitImage = new Image();
const portraitRamp = ' .:-=+*#%@';
const portraitColumns = 192;
const portraitLineRatio = 1.9;
const portraitRadius = 19;
let portraitGrid;
let portraitRows = 0;
let portraitCellWidth = 0;
let portraitCellHeight = 0;
let portraitWidth = 0;
let portraitHeight = 0;
let portraitDpr = 1;
let portraitPointerX = -999;
let portraitPointerY = -999;
let portraitPointerActive = false;
let portraitFrame = 0;
let portraitLastDraw = 0;

const portraitHash = (x, y, time) => {
  let hash = (x * 374761393 + y * 668265263 + time * 2147483647) | 0;
  hash = (hash ^ (hash >>> 13)) * 1274126177;
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
};

const drawPortrait = (now) => {
  if (!portraitGrid) return;
  const tick = Math.floor(now / 300);
  const time = now / 3000;
  const rampEnd = portraitRamp.length - 1;
  let cursorX = -999;
  let cursorY = -999;
  if (portraitPointerActive) {
    cursorX = portraitPointerX / portraitCellWidth;
    cursorY = portraitPointerY / portraitCellHeight;
  } else if (!reduceMotion) {
    cursorX = portraitColumns * (0.64 + 0.13 * Math.sin(now / 5000));
    cursorY = portraitRows * (0.52 + 0.16 * Math.sin(now / 6200 + 1.2));
  }
  const animationStrength = portraitPointerActive ? 1 : 0.22;
  portraitContext.setTransform(portraitDpr, 0, 0, portraitDpr, 0, 0);
  portraitContext.clearRect(0, 0, portraitWidth, portraitHeight);
  portraitContext.fillStyle = '#d8d3cf';
  portraitContext.font = `500 ${(portraitCellWidth / 0.6).toFixed(2)}px 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace`;
  portraitContext.textBaseline = 'top';

  for (let y = 0; y < portraitRows; y += 1) {
    const dy = y - cursorY;
    const nearCursor = Math.abs(dy) < portraitRadius;
    for (let x = 0; x < portraitColumns; x += 1) {
      let influence = 0;
      if (nearCursor) {
        const dx = x - cursorX;
        const distance = Math.sqrt(dx * dx + (dy * portraitLineRatio * 0.5) ** 2);
        influence = distance < portraitRadius ? 1 - distance / portraitRadius : 0;
      }
      const strength = influence * influence * animationStrength;
      const sampleX = strength > 0.001
        ? Math.min(portraitColumns - 1, Math.max(0, x + Math.round(strength * 5 * Math.sin(y * 0.9 + time * 3))))
        : x;
      let brightness = portraitGrid[y * portraitColumns + sampleX];
      if (brightness < 0) {
        if (strength > 0.08 && portraitHash(x, y, tick) < strength * 0.08) brightness = 0.25 + portraitHash(y, x, tick) * 0.5;
        else continue;
      } else {
        brightness += (portraitHash(x, y, tick) - 0.5) * (0.015 + 0.55 * strength);
        brightness += strength * 0.22 * Math.sin(time * 4 + x * 0.3);
      }
      brightness = Math.min(1, Math.max(0, brightness));
      const characterIndex = Math.round(brightness * rampEnd);
      if (characterIndex < 1) continue;
      portraitContext.globalAlpha = 0.35 + 0.65 * brightness;
      portraitContext.fillText(portraitRamp.charAt(characterIndex), x * portraitCellWidth, y * portraitCellHeight);
    }
  }
  portraitContext.globalAlpha = 1;
};

const layoutPortrait = () => {
  if (!portraitGrid) return;
  portraitWidth = portraitCanvas.parentElement.clientWidth;
  if (!portraitWidth) return;
  portraitDpr = Math.min(window.devicePixelRatio || 1, 2);
  portraitCellWidth = portraitWidth / portraitColumns;
  portraitCellHeight = portraitCellWidth * portraitLineRatio;
  portraitHeight = portraitCellHeight * portraitRows;
  portraitCanvas.width = Math.round(portraitWidth * portraitDpr);
  portraitCanvas.height = Math.round(portraitHeight * portraitDpr);
  portraitCanvas.style.height = `${portraitHeight}px`;
  drawPortrait(performance.now());
};

const buildPortrait = () => {
  portraitRows = Math.max(1, Math.round(portraitColumns * (portraitImage.height / portraitImage.width) / portraitLineRatio));
  const sample = document.createElement('canvas');
  sample.width = portraitColumns;
  sample.height = portraitRows;
  const sampleContext = sample.getContext('2d', {willReadFrequently: true});
  sampleContext.imageSmoothingQuality = 'high';
  sampleContext.translate(portraitColumns, 0);
  sampleContext.scale(-1, 1);
  sampleContext.drawImage(portraitImage, 0, 0, portraitColumns, portraitRows);
  const pixels = sampleContext.getImageData(0, 0, portraitColumns, portraitRows).data;
  portraitGrid = new Float32Array(portraitColumns * portraitRows);
  const orderedCells = [];
  for (let index = 0; index < portraitGrid.length; index += 1) {
    const pixel = index * 4;
    const alpha = pixels[pixel + 3] / 255;
    const luminance = (0.2126 * pixels[pixel] + 0.7152 * pixels[pixel + 1] + 0.0722 * pixels[pixel + 2]) / 255;
    portraitGrid[index] = alpha < 0.45 ? -1 : luminance;
    if (portraitGrid[index] >= 0) orderedCells.push(index);
  }
  orderedCells.sort((a, b) => portraitGrid[a] - portraitGrid[b]);
  orderedCells.forEach((cell, rank) => {
    const rankedTone = orderedCells.length > 1 ? rank / (orderedCells.length - 1) : 1;
    const tone = Math.min(1, Math.max(0, 0.5 * rankedTone + 0.5 * portraitGrid[cell]));
    portraitGrid[cell] = 0.12 + 0.88 * Math.pow(tone, 1 / 0.75);
  });
  layoutPortrait();
};

const animatePortrait = (now) => {
  if (now - portraitLastDraw >= 1000 / 24) {
    drawPortrait(now);
    portraitLastDraw = now;
  }
  portraitFrame = requestAnimationFrame(animatePortrait);
};
const startPortrait = () => {
  if (!reduceMotion && !portraitFrame) portraitFrame = requestAnimationFrame(animatePortrait);
};
const movePortrait = (event) => {
  const rect = portraitCanvas.getBoundingClientRect();
  portraitPointerX = (event.clientX - rect.left) * (portraitWidth / rect.width);
  portraitPointerY = (event.clientY - rect.top) * (portraitHeight / rect.height);
  portraitPointerActive = true;
  if (reduceMotion) drawPortrait(performance.now());
  else startPortrait();
};
const releasePortrait = () => {
  portraitPointerX = -999;
  portraitPointerY = -999;
  portraitPointerActive = false;
  if (reduceMotion) drawPortrait(performance.now());
};
portraitCanvas.addEventListener('pointermove', movePortrait);
portraitCanvas.addEventListener('pointerdown', movePortrait);
portraitCanvas.addEventListener('pointerleave', releasePortrait);
portraitCanvas.addEventListener('pointercancel', releasePortrait);
portraitCanvas.addEventListener('pointerup', (event) => {
  if (event.pointerType !== 'mouse') releasePortrait();
});
new ResizeObserver(layoutPortrait).observe(portraitCanvas.parentElement);
portraitImage.addEventListener('load', buildPortrait);
portraitImage.src = 'assets/ascii-portrait.png';
document.fonts.ready.then(layoutPortrait);
if ('IntersectionObserver' in window) {
  const portraitObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) startPortrait();
    else {
      cancelAnimationFrame(portraitFrame);
      portraitFrame = 0;
      portraitLastDraw = 0;
    }
  }, {root: desktopLayout.matches ? scroller : null, threshold: 0.05});
  portraitObserver.observe(portraitCanvas);
} else startPortrait();

const terminal = document.querySelector('.terminal');
const terminalTime = terminal.querySelector('.terminal-time');
const terminalUptime = terminal.querySelector('.terminal-uptime');
const terminalOutput = terminal.querySelector('.terminal-output');
const terminalForm = terminal.querySelector('.terminal-form');
const terminalInput = terminal.querySelector('input');
const terminalBar = terminal.querySelector('.terminal-bar');
const terminalClose = terminal.querySelector('.terminal-close');
const terminalLaunch = document.querySelector('.terminal-launch');
const birthDate = new Date(2007, 6, 26);
const ageInYears = (now) => {
  let years = now.getFullYear() - birthDate.getFullYear();
  let lastBirthday = new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (now < lastBirthday) {
    years -= 1;
    lastBirthday = new Date(now.getFullYear() - 1, birthDate.getMonth(), birthDate.getDate());
  }
  const nextBirthday = new Date(lastBirthday.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
  return years + (now - lastBirthday) / (nextBirthday - lastBirthday);
};
console.assert(ageInYears(new Date(2008, 6, 26)) === 1, 'Age must increment on the birthday');
const updateTerminalStats = () => {
  const now = new Date();
  terminalTime.textContent = now.toLocaleTimeString([], {hour12: false});
  terminalUptime.textContent = `${ageInYears(now).toFixed(8)} years`;
};
updateTerminalStats();
setInterval(updateTerminalStats, 1000);

const terminalCommands = {
  help: 'help · about · projects · skills · contact · go <section> · clear',
  about: 'Second-year BTech CSE student building thoughtful software and interactive systems.',
  projects: 'NEBULITH · VisionVault · AscentOptima · WordFetch',
  skills: 'React · TypeScript · Three.js · Linux · Python · FastAPI · Java · C++',
  contact: 'patilyugal2007@gmail.com · github.com/yugal-07',
};
terminalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const command = terminalInput.value.trim();
  terminalInput.value = '';
  if (!command) return;
  if (command.toLowerCase() === 'clear') {
    terminalOutput.replaceChildren();
    return;
  }
  const entry = document.createElement('p');
  entry.textContent = `» ${command}`;
  terminalOutput.append(entry);
  const [action, destination] = command.toLowerCase().split(/\s+/, 2);
  let response = terminalCommands[action];
  if (action === 'go') {
    const target = document.getElementById(destination === 'works' ? 'work' : destination);
    response = target ? `Opening ${destination}…` : 'Unknown section. Try: home, works, skills, about, contact.';
    target?.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth'});
  }
  const result = document.createElement('p');
  result.textContent = response ?? `Command not found: ${action}. Type “help”.`;
  terminalOutput.append(result);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
});

terminalClose.addEventListener('click', () => {
  terminal.hidden = true;
  terminalLaunch.setAttribute('aria-expanded', 'false');
  buildProgressRoute();
});

terminalLaunch.addEventListener('click', () => {
  terminal.hidden = false;
  terminalLaunch.setAttribute('aria-expanded', 'true');
  stopHorizontalScroll();
  document.getElementById('home').scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth'});
  terminalInput.focus({preventScroll: true});
});

let terminalPosition = {x: 0, y: 0};
let terminalDrag = null;
terminalBar.addEventListener('pointerdown', (event) => {
  if (!desktopLayout.matches || event.button !== 0 || event.target.closest('button')) return;
  terminalDrag = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    position: terminalPosition,
    rect: terminal.getBoundingClientRect(),
  };
  terminalBar.setPointerCapture(event.pointerId);
  terminal.classList.add('is-dragging');
});
terminalBar.addEventListener('pointermove', (event) => {
  if (!terminalDrag) return;
  const left = Math.min(innerWidth - terminalDrag.rect.width - 8, Math.max(8, terminalDrag.rect.left + event.clientX - terminalDrag.pointerX));
  const top = Math.min(innerHeight - terminalDrag.rect.height - 8, Math.max(8, terminalDrag.rect.top + event.clientY - terminalDrag.pointerY));
  terminalPosition = {
    x: terminalDrag.position.x + left - terminalDrag.rect.left,
    y: terminalDrag.position.y + top - terminalDrag.rect.top,
  };
  terminal.style.translate = `${terminalPosition.x}px ${terminalPosition.y}px`;
});
const stopTerminalDrag = (event) => {
  if (!terminalDrag) return;
  terminalDrag = null;
  terminal.classList.remove('is-dragging');
  if (terminalBar.hasPointerCapture(event.pointerId)) terminalBar.releasePointerCapture(event.pointerId);
};
terminalBar.addEventListener('pointerup', stopTerminalDrag);
terminalBar.addEventListener('pointercancel', stopTerminalDrag);

if (!reduceMotion && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('reveal-ready');
  const titleRevealTargets = [
    ...document.querySelectorAll('.section-heading'),
    document.querySelector('.about h2'),
    document.querySelector('.contact h2'),
  ].filter(Boolean);
  titleRevealTargets.forEach((target) => {
    const title = target.matches('h2') ? target : target.querySelector('h2');
    const label = title.innerText.replace(/\s+/g, ' ').trim();
    const textNodes = [];
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const letters = [];
    textNodes.forEach((node) => {
      const fragment = document.createDocumentFragment();
      let word;
      [...node.textContent].forEach((character) => {
        if (/\s/.test(character)) {
          word = null;
          fragment.append(character);
          return;
        }
        if (!word) {
          word = document.createElement('span');
          word.className = 'title-word';
          fragment.append(word);
        }
        const letter = document.createElement('span');
        letter.className = 'title-letter';
        letter.dataset.letter = character;
        letter.textContent = character;
        letter.setAttribute('aria-hidden', 'true');
        letters.push(letter);
        word.append(letter);
      });
      node.replaceWith(fragment);
    });
    letters.forEach((letter, index) => {
      letter.style.setProperty('--outline-delay', `${index * 10}ms`);
      letter.style.setProperty('--fill-delay', `${380 + letters.length * 10 + index * 28}ms`);
    });
    title.setAttribute('aria-label', label);
    target.classList.add('title-reveal');
    console.assert(title.innerText.replace(/\s+/g, ' ').trim() === label, 'Title reveal must preserve its heading text');
  });
  const titlePlaybackRateFor = (speed) => Math.min(3, Math.max(0.6, 0.6 + speed * 1.2));
  console.assert(titlePlaybackRateFor(0) === 0.6 && titlePlaybackRateFor(10) === 3, 'Title playback rate must stay usable');
  let titleScrollPosition = desktopLayout.matches ? scroller.scrollLeft : scrollY;
  let titleScrollTime = performance.now();
  let titlePlaybackRate = 1;
  const applyTitlePlaybackRate = (target) => {
    target.getAnimations({subtree: true}).forEach((animation) => animation.updatePlaybackRate(titlePlaybackRate));
  };
  const updateTitlePlaybackRate = () => {
    const now = performance.now();
    const position = desktopLayout.matches ? scroller.scrollLeft : scrollY;
    const elapsed = Math.min(32, Math.max(8, now - titleScrollTime));
    titlePlaybackRate = titlePlaybackRateFor(Math.abs(position - titleScrollPosition) / elapsed);
    titleScrollPosition = position;
    titleScrollTime = now;
    document.querySelectorAll('.title-reveal.is-visible').forEach(applyTitlePlaybackRate);
  };
  window.addEventListener('scroll', updateTitlePlaybackRate, {passive: true});
  scroller.addEventListener('scroll', updateTitlePlaybackRate, {passive: true});
  const revealRoot = desktopLayout.matches ? scroller : null;
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, {root: revealRoot, threshold: 0.12});
  const titleRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      applyTitlePlaybackRate(entry.target);
      titleRevealObserver.unobserve(entry.target);
    });
  }, {root: revealRoot, rootMargin: desktopLayout.matches ? '0px -60% 0px 0px' : '0px 0px -25% 0px', threshold: 0});
  titleRevealTargets.forEach((target) => titleRevealObserver.observe(target));
  [...document.querySelectorAll('.hero h1, .hero-bottom, .hero-visual, .section-heading, .project, .skill-list > div, .about h2, .about-copy > *, .contact > *')].filter((element) => !element.classList.contains('title-reveal')).forEach((element, index) => {
    element.style.setProperty('--reveal-delay', `${Math.min(index % 5, 4) * 80}ms`);
    revealObserver.observe(element);
  });
}

const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  menuToggle.innerHTML = isOpen ? 'Menu <span aria-hidden="true">＋</span>' : 'Close <span aria-hidden="true">×</span>';
  mobileNav.hidden = isOpen;
});
mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  mobileNav.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.innerHTML = 'Menu <span aria-hidden="true">＋</span>';
}));
