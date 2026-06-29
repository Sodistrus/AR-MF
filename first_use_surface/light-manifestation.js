function createParticleField(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.4 + 0.5,
    vx: (Math.random() - 0.5) * 0.00045,
    vy: (Math.random() - 0.5) * 0.00045,
  }));
}

function moodPalette(mood) {
  switch (mood) {
    case 'warm':
      return { glow: '255, 210, 138', core: '255, 244, 220' };
    case 'answer':
      return { glow: '146, 222, 255', core: '236, 248, 255' };
    case 'ambiguity':
      return { glow: '184, 165, 255', core: '241, 237, 255' };
    case 'greeting':
    default:
      return { glow: '127, 228, 255', core: '235, 249, 255' };
  }
}

function clampAlpha(alpha) {
  return Math.max(0, Math.min(1, alpha));
}

function wrapLines(context, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text];

  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${currentLine} ${words[i]}`;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }

  lines.push(currentLine);
  return lines.slice(0, 3);
}

function sampleGlyphPoints(offscreenContext, width, height, step) {
  const imageData = offscreenContext.getImageData(0, 0, width, height).data;
  const points = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const pixelIndex = (y * width + x) * 4 + 3;
      if (imageData[pixelIndex] > 100) {
        points.push({
          x: x / width,
          y: y / height,
        });
      }
    }
  }

  return points;
}

export function createLightManifestation(canvas, reducedMotion) {
  const context = canvas.getContext('2d');
  const particles = createParticleField(320);
  const manifestation = {
    text: '',
    mood: 'greeting',
    startedAt: performance.now(),
    glyphPoints: [],
  };

  const options = {
    reducedMotion,
  };

  const touchField = {
    x: 0.5,
    y: 0.5,
    intensity: 0,
  };

  function respondToTouch(clientX, clientY, pulse = 0.35) {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    touchField.x = Math.max(0, Math.min(1, clientX / width));
    touchField.y = Math.max(0, Math.min(1, clientY / height));
    touchField.intensity = Math.max(touchField.intensity, pulse);
  }

  function bindTouchInteraction() {
    const passive = { passive: true };
    canvas.addEventListener('pointerdown', (event) => respondToTouch(event.clientX, event.clientY, 0.65), passive);
    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || event.buttons > 0) {
        respondToTouch(event.clientX, event.clientY, 0.42);
      }
    }, passive);
    canvas.addEventListener('touchstart', (event) => {
      for (const touch of event.touches) respondToTouch(touch.clientX, touch.clientY, 0.7);
    }, passive);
    canvas.addEventListener('touchmove', (event) => {
      for (const touch of event.touches) respondToTouch(touch.clientX, touch.clientY, 0.48);
    }, passive);
  }

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function updateGlyphMap(text) {
    if (!text) {
      manifestation.glyphPoints = [];
      return;
    }

    const width = Math.max(420, Math.floor(window.innerWidth * 0.7));
    const height = 160;
    const offscreen = updateGlyphMap.canvas || (updateGlyphMap.canvas = document.createElement('canvas'));
    const offscreenContext = updateGlyphMap.ctx || (updateGlyphMap.ctx = offscreen.getContext('2d', { willReadFrequently: true }));
    offscreen.width = width;
    offscreen.height = height;

    offscreenContext.clearRect(0, 0, width, height);
    offscreenContext.textAlign = 'center';
    offscreenContext.textBaseline = 'middle';
    offscreenContext.fillStyle = '#ffffff';
    offscreenContext.font = `700 ${Math.max(24, Math.min(54, width * 0.075))}px Inter, Sarabun, sans-serif`;
    const wrapped = wrapLines(offscreenContext, text, width * 0.8);
    const lineHeight = Math.max(34, Math.min(58, width * 0.085));
    const top = (height * 0.52) - ((wrapped.length - 1) * lineHeight) / 2;
    wrapped.forEach((line, index) => {
      offscreenContext.fillText(line, width * 0.5, top + lineHeight * index);
    });

    manifestation.glyphPoints = sampleGlyphPoints(
      offscreenContext,
      width,
      height,
      options.reducedMotion ? 8 : 5,
    );
  }

  function manifestText(text, mood) {
    manifestation.text = text;
    manifestation.mood = mood;
    manifestation.startedAt = performance.now();
    updateGlyphMap(text);
  }

  function setReducedMotion(value) {
    options.reducedMotion = value;
    if (manifestation.text) updateGlyphMap(manifestation.text);
  }

  function render(ts) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(5, 8, 14, 0.25)';
    context.fillRect(0, 0, width, height);

    const wave = options.reducedMotion ? 0 : Math.sin(ts * 0.00035) * 0.25;
    particles.forEach((particle, index) => {
      if (!options.reducedMotion) {
        const dxTouch = touchField.x - particle.x;
        const dyTouch = touchField.y - particle.y;
        const touchForce = touchField.intensity * 0.00095 / (1 + (dxTouch * dxTouch + dyTouch * dyTouch) * 38);
        particle.x += particle.vx + wave * 0.00012 + dxTouch * touchForce;
        particle.y += particle.vy + dyTouch * touchForce;
        if (particle.x < 0 || particle.x > 1) particle.vx *= -1;
        if (particle.y < 0 || particle.y > 1) particle.vy *= -1;
      }

      const x = particle.x * width;
      const y = particle.y * height;
      const alpha = options.reducedMotion
        ? 0.18
        : 0.24 + Math.sin(ts * 0.001 + index * 0.16) * 0.08 + touchField.intensity * 0.08;

      context.fillStyle = `rgba(127,228,255,${clampAlpha(alpha)})`;
      context.beginPath();
      context.arc(x, y, particle.r, 0, Math.PI * 2);
      context.fill();
    });

    touchField.intensity = Math.max(0, touchField.intensity * 0.965 - 0.0022);

    if (manifestation.text) {
      const elapsed = Math.max(0, ts - manifestation.startedAt);
      const alpha = options.reducedMotion ? 1 : clampAlpha(elapsed / 520);
      const palette = moodPalette(manifestation.mood);
      const centerY = height * 0.43;
      if (manifestation.glyphPoints.length > 0) {
        const glyphWidth = Math.max(420, Math.floor(width * 0.7));
        const glyphHeight = 160;
        const originX = (width - glyphWidth) * 0.5;
        const originY = centerY - glyphHeight * 0.5;

        context.fillStyle = `rgba(${palette.glow},${clampAlpha(alpha * 0.9)})`;
        manifestation.glyphPoints.forEach((point, index) => {
          const shimmer = options.reducedMotion ? 0 : Math.sin(ts * 0.007 + index * 0.11) * 0.7;
          const radius = options.reducedMotion ? 1.3 : 1 + Math.max(0, shimmer);
          context.beginPath();
          context.arc(originX + point.x * glyphWidth, originY + point.y * glyphHeight, radius, 0, Math.PI * 2);
          context.fill();
        });
    }
    }

    requestAnimationFrame(render);
  }

  bindTouchInteraction();

  return {
    manifestText,
    resize,
    render,
    setReducedMotion,
    respondToTouch,
  };
}
