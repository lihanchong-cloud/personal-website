class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.textParticles = [];
    this.bgParticles = [];
    this.mouse = { x: -9999, y: -9999, radius: 130 };
    this.raf = null;

    this._onResize = this._debounce(() => this._resize(), 180);
    this._onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    this._onMouseLeave = () => { this.mouse.x = -9999; this.mouse.y = -9999; };
    this._onTouchMove = (e) => {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.touches[0].clientX - r.left;
      this.mouse.y = e.touches[0].clientY - r.top;
    };

    window.addEventListener('resize', this._onResize);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mouseleave', this._onMouseLeave);
    this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this._onMouseLeave);
  }

  _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // Sample pixel positions from canvas-rendered text
  _sampleText(text) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');

    // Scale font to fill ~84% of canvas width
    let fs = 160;
    ctx.font = `900 ${fs}px "Bebas Neue", "Arial Black", Impact, sans-serif`;
    const ratio = (w * 0.72) / ctx.measureText(text).width;
    fs = Math.min(Math.floor(fs * ratio), Math.floor(h * 0.58));

    ctx.font = `900 ${fs}px "Bebas Neue", "Arial Black", Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(text, w / 2, h / 2);

    const imgData = ctx.getImageData(0, 0, w, h).data;
    const gap = Math.max(4, Math.round(w / 280));
    const pts = [];

    for (let y = 0; y < h; y += gap) {
      for (let x = 0; x < w; x += gap) {
        if (imgData[(y * w + x) * 4 + 3] > 110) {
          pts.push({ x, y });
        }
      }
    }
    return pts;
  }

  _makeParticle(x, y, tx, ty) {
    const palette = [
      '#ffffff', '#ffffff', '#ffffff', '#ffffff',
      '#f0f2ff', '#e8ecff', '#dde3ff',
      '#c8d0ff', '#b0bcf0'
    ];
    return {
      x, y, tx, ty,
      vx: 0, vy: 0,
      size: Math.random() * 1.7 + 0.5,
      color: palette[Math.floor(Math.random() * palette.length)],
      ease: 0.052 + Math.random() * 0.034,
      friction: 0.875
    };
  }

  _buildBgParticles() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.bgParticles = Array.from({ length: 90 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      size: Math.random() * 1.3 + 0.3,
      baseOpacity: Math.random() * 0.3 + 0.05,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.018 + 0.006,
      color: Math.random() > 0.55 ? '#4a6cf7' : '#ffffff'
    }));
  }

  _setup() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    const pts = this._sampleText('ROCHELLE');

    if (this.textParticles.length === 0) {
      // Spawn at target so name is visible immediately on load
      this.textParticles = pts.map(p =>
        this._makeParticle(p.x, p.y, p.x, p.y)
      );
    } else {
      // Resize — keep existing particles, update targets
      const n = Math.min(this.textParticles.length, pts.length);
      for (let i = 0; i < n; i++) {
        this.textParticles[i].tx = pts[i].x;
        this.textParticles[i].ty = pts[i].y;
      }
      // Add any extra needed
      for (let i = n; i < pts.length; i++) {
        this.textParticles.push(this._makeParticle(
          Math.random() * this.canvas.width,
          Math.random() * this.canvas.height,
          pts[i].x, pts[i].y
        ));
      }
      // Trim extras
      if (this.textParticles.length > pts.length) {
        this.textParticles.length = pts.length;
      }
    }

    this._buildBgParticles();
  }

  _resize() {
    this._setup();
  }

  _updateBg() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.bgParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.phase += p.speed;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
    });
  }

  _updateText() {
    const { x: mx, y: my, radius: mr } = this.mouse;

    this.textParticles.forEach(p => {
      const dx = mx - p.x;
      const dy = my - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < mr && dist > 0) {
        const t = (mr - dist) / mr;
        const force = t * t * 14;
        const angle = Math.atan2(dy, dx);
        p.vx -= Math.cos(angle) * force;
        p.vy -= Math.sin(angle) * force;
      }

      // Spring toward target
      p.vx += (p.tx - p.x) * p.ease;
      p.vy += (p.ty - p.y) * p.ease;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
    });
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background drifting particles
    this.bgParticles.forEach(p => {
      const opacity = p.baseOpacity * (0.55 + 0.45 * Math.sin(p.phase));
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Text particles — add subtle glow when moving fast
    this.textParticles.forEach(p => {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 4) {
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#c8d0ff';
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      if (speed > 4) ctx.shadowBlur = 0;
    });
  }

  _loop(ts) {
    this._updateBg();
    this._updateText();
    this._draw();
    this.raf = requestAnimationFrame(t => this._loop(t));
  }

  start() {
    // Wait for fonts so Bebas Neue is used when sampling pixels
    document.fonts.ready.then(() => {
      this._setup();
      this.raf = requestAnimationFrame(t => this._loop(t));
    });
  }
}
