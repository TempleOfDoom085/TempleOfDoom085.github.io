const STYLE = `
#dialogue {
  display: none;
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  width: min(600px, 90vw);
  background: rgba(0,0,0,0.88);
  border: 1px solid rgba(0,204,255,0.4);
  border-radius: 2px;
  padding: 1rem 1.2rem;
  font-family: 'Share Tech Mono', monospace;
  color: #e0e0e0;
  font-size: 0.8rem;
  line-height: 1.6;
  z-index: 500;
  user-select: none;
}
#dialogue-name {
  color: #00ccff;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
  border-bottom: 1px solid rgba(0,204,255,0.2);
  padding-bottom: 0.3rem;
}
#dialogue-text {
  min-height: 2.6em;
}
#dialogue-prompt {
  margin-top: 0.5rem;
  color: rgba(0,204,255,0.5);
  font-size: 0.7rem;
  text-align: right;
  letter-spacing: 0.08em;
}
`;

export class DialogueSystem {
  constructor() {
    this._inject();
    this._el     = document.getElementById('dialogue');
    this._nameEl = document.getElementById('dialogue-name');
    this._textEl = document.getElementById('dialogue-text');
    this._promptEl = document.getElementById('dialogue-prompt');
    this._typing = null;
    this._advance = null;
    this._bound  = this._onKey.bind(this);
  }

  _inject() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'dialogue';
    el.innerHTML = `
      <div id="dialogue-name"></div>
      <div id="dialogue-text"></div>
      <div id="dialogue-prompt">[E] Continue</div>
    `;
    document.body.appendChild(el);

    el.addEventListener('click', () => { if (this._advance) this._advance(); });
  }

  showDialogue(npcName, lines, onDone) {
    this._el.style.display = 'block';
    this._nameEl.textContent = npcName;
    this._lines   = lines;
    this._lineIdx = 0;
    this._onDone  = onDone || (() => {});

    window.addEventListener('keydown', this._bound);
    this._showLine(this._lineIdx);
  }

  hideDialogue() {
    this._el.style.display = 'none';
    window.removeEventListener('keydown', this._bound);
    if (this._typing) { clearTimeout(this._typing); this._typing = null; }
    this._advance = null;
  }

  _showLine(idx) {
    const line = this._lines[idx];
    const isLast = idx === this._lines.length - 1;
    this._textEl.textContent = '';
    this._promptEl.textContent = isLast ? '[E] Close' : '[E] Continue';

    let charIdx = 0;
    let done = false;

    const typeNext = () => {
      if (charIdx < line.length) {
        this._textEl.textContent += line[charIdx++];
        this._typing = setTimeout(typeNext, 30);
      } else {
        done = true;
        this._typing = null;
        this._advance = () => this._next(isLast);
      }
    };

    // If player presses E before typing finishes, complete the line instantly
    this._advance = () => {
      if (!done) {
        if (this._typing) { clearTimeout(this._typing); this._typing = null; }
        this._textEl.textContent = line;
        done = true;
        this._advance = () => this._next(isLast);
      }
    };

    typeNext();
  }

  _next(isLast) {
    if (isLast) {
      this.hideDialogue();
      this._onDone();
    } else {
      this._lineIdx++;
      this._showLine(this._lineIdx);
    }
  }

  _onKey(e) {
    if (e.key === 'e' || e.key === 'E') {
      e.stopImmediatePropagation();
      if (this._advance) this._advance();
    }
  }
}
