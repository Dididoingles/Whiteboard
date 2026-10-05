/* ==========================================================================
   ESTADO GLOBAL
   ========================================================================== */
   let canvas = null;
   let history = [];
   let historyIndex = -1;
   const MAX_HISTORY_STEPS = 50;
   const STORAGE_KEY = 'didis_whiteboard_v1';
   const THEME_KEY = 'didis_theme';
   const GRID_KEY = 'didis_grid';
   const DESKTOP_NOTICE_KEY = 'didis_desktop_notice_shown_date';
   
   let currentToolMode = 'text';
   let lastActiveTextObj = null;
   let isPickingColor = false;
   let savedTextSelection = null;
   let isRestoringState = false;
   let autoSaveTimer = null;
   
   let currentTheme = 'light';       /* 'light' | 'dark' */
   let isGridOn = false;
   
   /* ==========================================================================
      BOOT
      ========================================================================== */
   window.addEventListener('load', () => {
     /* Ordem importa: tema e grade precisam estar definidos ANTES do canvas,
        para o fundo do canvas ser criado já com a configuração certa. */
     loadThemePreference();
     loadGridPreference();
   
     initCanvas();
     applyCanvasBackground();     /* aplica cor/grade conforme tema + toggle */
   
     setupResizeListener();
     setupKeyboardShortcuts();
     populateIconPicker();
     setupFormatColorInput();
     setupWheelBrushSize();
     setupGlobalTooltips();
     setupSelectionCaptureOnButtons();
     setupHighlightPaletteOutsideClick();
     createKeyboard();
     drawHangman(0);
     updateBrushFill(3);
     setToolMode('text');
     updateCounter();
     updateThemeButtonUI();
     updateGridButtonUI();
     setupDesktopNoticeModal();
   
     const loaded = tryLoadFromStorage();
     if (!loaded) {
       pushHistoryState();
     }
   });
   
   /* ==========================================================================
      TEMA (claro / escuro)
      ==========================================================================
      A1+: fundo do canvas e cor padrão do pincel/texto mudam com o tema.
      Objetos existentes mantêm a cor.
   */
   function loadThemePreference() {
     const saved = localStorage.getItem(THEME_KEY);
     if (saved === 'dark') {
       currentTheme = 'dark';
       document.body.classList.add('dark-theme');
     } else {
       currentTheme = 'light';
     }
   }
   
   function toggleTheme() {
     if (currentTheme === 'light') {
       currentTheme = 'dark';
       document.body.classList.add('dark-theme');
     } else {
       currentTheme = 'light';
       document.body.classList.remove('dark-theme');
     }
   
     localStorage.setItem(THEME_KEY, currentTheme);
     applyCanvasBackground();
     updateThemeButtonUI();
   
     /* A1+: ajusta a cor padrão do pincel/texto novos */
     const defaultColor = currentTheme === 'dark' ? '#ffffff' : '#000000';
     canvas.freeDrawingBrush.color = defaultColor;
     const fmtColorInput = document.getElementById('fmtColorInput');
     if (fmtColorInput) fmtColorInput.value = defaultColor;
     const fmtColorDot = document.getElementById('fmtColorDot');
     if (fmtColorDot) fmtColorDot.style.background = defaultColor;
   
     showLongOperationToast(currentTheme === 'dark' ? "Tema escuro ativado" : "Tema claro ativado");
   }
   
   function updateThemeButtonUI() {
     const btn = document.getElementById('themeToggleBtn');
     if (!btn) return;
     const icon = btn.querySelector('i');
     if (currentTheme === 'dark') {
       btn.classList.add('toggle-on');
       if (icon) icon.className = 'fa-solid fa-sun';
     } else {
       btn.classList.remove('toggle-on');
       if (icon) icon.className = 'fa-solid fa-moon';
     }
   }
   
   /* ==========================================================================
      GRADE DE FUNDO
      ==========================================================================
      - Desenha com fabric.Pattern um pequeno canvas 40x40 com linhas.
      - Cores mudam conforme o tema.
      - Quando desligada, aplica cor sólida.
   */
   function loadGridPreference() {
     isGridOn = localStorage.getItem(GRID_KEY) === 'on';
   }
   
   function toggleGrid() {
     isGridOn = !isGridOn;
     localStorage.setItem(GRID_KEY, isGridOn ? 'on' : 'off');
     applyCanvasBackground();
     updateGridButtonUI();
     showLongOperationToast(isGridOn ? "Grade ativada" : "Grade desativada");
   }
   
   function updateGridButtonUI() {
     const btn = document.getElementById('gridToggleBtn');
     if (!btn) return;
     if (isGridOn) btn.classList.add('toggle-on');
     else btn.classList.remove('toggle-on');
   }
   
   /* Aplica a cor de fundo ou a grade, conforme tema e toggle */
   function applyCanvasBackground() {
     if (!canvas) return;
   
     if (isGridOn) {
       const pattern = createGridPattern();
       canvas.setBackgroundColor(pattern, () => canvas.renderAll());
     } else {
       const solid = currentTheme === 'dark' ? '#0a1929' : '#ffffff';
       canvas.setBackgroundColor(solid, () => canvas.renderAll());
     }
   }
   
   /* Cria um fabric.Pattern 40x40 com linhas de grade */
   function createGridPattern() {
     const size = 40;
     const offCanvas = document.createElement('canvas');
     offCanvas.width = size;
     offCanvas.height = size;
     const ctx = offCanvas.getContext('2d');
   
     /* Fundo base (mesmo da cor sólida) */
     const bg = currentTheme === 'dark' ? '#0a1929' : '#ffffff';
     ctx.fillStyle = bg;
     ctx.fillRect(0, 0, size, size);
   
     /* Linhas */
     ctx.strokeStyle = currentTheme === 'dark' ? '#15304d' : '#e8e8e8';
     ctx.lineWidth = 1;
     ctx.beginPath();
     ctx.moveTo(0, 0); ctx.lineTo(size, 0);   /* linha superior */
     ctx.moveTo(0, 0); ctx.lineTo(0, size);   /* linha esquerda */
     ctx.stroke();
   
     return new fabric.Pattern({
       source: offCanvas,
       repeat: 'repeat'
     });
   }
   
   /* ==========================================================================
      MODO APRESENTAÇÃO
      ==========================================================================
      - Esconde header, sidebar, barra de formatação, botão flutuante.
      - Sai com Esc (M1: Esc sempre sai, mesmo editando texto).
   */
   function enterPresentationMode() {
     document.body.classList.add('presentation-mode');
     /* Fecha gaveta e barra se estiverem abertas */
     document.getElementById('sidebar').classList.remove('active');
     document.getElementById('drawerOverlay').classList.remove('active');
     hideTextFormatBar();
     hideHighlightPalette();
     /* Sai de qualquer edição ativa */
     if (canvas.getActiveObject()) {
       canvas.discardActiveObject();
       canvas.renderAll();
     }
     showLongOperationToast("Modo apresentação — pressione Esc para sair");
   }
   
   function exitPresentationMode() {
     document.body.classList.remove('presentation-mode');
   }
   
   /* ==========================================================================
      CANVAS
      ========================================================================== */
   function initCanvas() {
     const container = document.getElementById('canvas-container');
     canvas = new fabric.Canvas('whiteboard', {
       width: container.clientWidth - 20,
       height: container.clientHeight - 20,
       backgroundColor: currentTheme === 'dark' ? '#0a1929' : '#ffffff',
       isDrawingMode: false,
       preserveObjectStacking: true
     });
   
     const defaultColor = currentTheme === 'dark' ? '#ffffff' : '#000000';
     canvas.freeDrawingBrush.color = defaultColor;
     canvas.freeDrawingBrush.width = 3;
   
     canvas.on('mouse:dblclick', (opt) => {
       if (opt.target) return;
       if (currentToolMode !== 'text') return;
       const pointer = canvas.getPointer(opt.e);
       createTextAt(pointer.x, pointer.y);
     });
   
     canvas.on('text:editing:exited', (opt) => {
       const obj = opt.target;
       if (obj && obj.text.trim() === "") {
         canvas.remove(obj);
         canvas.renderAll();
         updateCounter();
       }
     });
   
     canvas.on('text:editing:entered', (opt) => {
       updateTextFormatBar(opt.target);
     });
   
     canvas.on('selection:created', (opt) => {
       const obj = opt.selected[0];
       if (obj && (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')) {
         lastActiveTextObj = obj;
       }
       updateTextFormatBar(obj);
     });
     canvas.on('selection:updated', (opt) => {
       const obj = opt.selected[0];
       if (obj && (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')) {
         lastActiveTextObj = obj;
       }
       updateTextFormatBar(obj);
     });
     canvas.on('selection:cleared', () => {
       if (isPickingColor) return;
       lastActiveTextObj = null;
       hideTextFormatBar();
     });
   
     canvas.on('text:changed', () => {
       updateCounter();
       scheduleAutoSave();
     });
   
     canvas.on('object:added', onCanvasChanged);
     canvas.on('object:modified', onCanvasChanged);
     canvas.on('object:removed', onCanvasChanged);
   }
   
   function onCanvasChanged() {
     if (isRestoringState) return;
     pushHistoryState();
     updateCounter();
     scheduleAutoSave();
   }
   
   function createTextAt(x, y) {
     const brushColor = canvas.freeDrawingBrush.color || '#000000';
   
     const textbox = new fabric.Textbox("", {
       left: x,
       top: y,
       width: 200,
       fontSize: 24,
       fontFamily: 'Poppins, sans-serif',
       fill: brushColor,
       splitByGrapheme: false,
       lockUniScaling: true
     });
   
     textbox.on('editing:entered', () => {
       textbox.set({ hasControls: false, hasBorders: false });
       canvas.requestRenderAll();
       updateTextFormatBar(textbox);
     });
     textbox.on('editing:exited', () => {
       textbox.set({ hasControls: true, hasBorders: true });
       canvas.requestRenderAll();
     });
   
     canvas.add(textbox);
     canvas.setActiveObject(textbox);
     canvas.isDrawingMode = false;
     updateDrawingBtnUI();
     textbox.enterEditing();
   }
   
   function setupResizeListener() {
     window.addEventListener('resize', () => {
       const container = document.getElementById('canvas-container');
       if (canvas && container) {
         canvas.setWidth(container.clientWidth - 20);
         canvas.setHeight(container.clientHeight - 20);
         canvas.renderAll();
       }
     });
   }
   
   /* ==========================================================================
      HISTÓRICO / UNDO / REDO
      ========================================================================== */
   function pushHistoryState() {
     if (!canvas || !canvas.toJSON || isRestoringState) return;
   
     const state = JSON.stringify(canvas);
   
     if (historyIndex < history.length - 1) {
       history = history.slice(0, historyIndex + 1);
     }
   
     if (history.length > 0 && history[history.length - 1] === state) return;
   
     history.push(state);
     if (history.length > MAX_HISTORY_STEPS) history.shift();
     historyIndex = history.length - 1;
     updateUndoRedoButtons();
   }
   
   function undo() {
     if (historyIndex <= 0) return;
     historyIndex--;
     restoreStateFromHistory();
   }
   
   function redo() {
     if (historyIndex >= history.length - 1) return;
     historyIndex++;
     restoreStateFromHistory();
   }
   
   function restoreStateFromHistory() {
     const state = history[historyIndex];
     isRestoringState = true;
     canvas.loadFromJSON(state, () => {
       canvas.renderAll();
       /* Reaplica o fundo (grade ou cor) porque loadFromJSON limpa o background */
       applyCanvasBackground();
       isRestoringState = false;
       updateUndoRedoButtons();
       updateCounter();
       scheduleAutoSave();
     });
   }
   
   function updateUndoRedoButtons() {
     const redoBtn = document.getElementById('redoBtn');
     if (!redoBtn) return;
     if (historyIndex >= history.length - 1) {
       redoBtn.classList.add('disabled');
     } else {
       redoBtn.classList.remove('disabled');
     }
   }
   
   /* ==========================================================================
      FERRAMENTAS (texto / desenho)
      ========================================================================== */
   function setToolMode(mode) {
     currentToolMode = mode;
     const drawBtn = document.getElementById('toolDrawBtn');
     const textBtn = document.getElementById('toolTextBtn');
     const container = document.getElementById('canvas-container');
   
     if (mode === 'draw') {
       drawBtn.classList.add('active');
       textBtn.classList.remove('active');
       canvas.isDrawingMode = true;
       container.classList.remove('text-mode');
       hideTextFormatBar();
       hideHighlightPalette();
     } else {
       drawBtn.classList.remove('active');
       textBtn.classList.add('active');
       canvas.isDrawingMode = false;
       canvas.discardActiveObject();
       canvas.renderAll();
       container.classList.add('text-mode');
       hideTextFormatBar();
       hideHighlightPalette();
     }
   }
   
   function updateDrawingBtnUI() {
     const drawBtn = document.getElementById('toolDrawBtn');
     const textBtn = document.getElementById('toolTextBtn');
     const container = document.getElementById('canvas-container');
     if (!drawBtn || !textBtn) return;
   
     if (canvas.isDrawingMode) {
       drawBtn.classList.add('active');
       textBtn.classList.remove('active');
       container.classList.remove('text-mode');
     } else {
       drawBtn.classList.remove('active');
       textBtn.classList.add('active');
       container.classList.add('text-mode');
     }
   }
   
   /* ==========================================================================
      COR / ESPESSURA
      ========================================================================== */
   function updateBrushColor(colorHex) {
     canvas.freeDrawingBrush.color = colorHex;
     const validHex = colorHex.startsWith('#') ? colorHex : '#000000';
     const modalPicker = document.getElementById('modal-custom-picker');
     if (modalPicker) modalPicker.value = validHex;
   }
   
   function updateBrushSize(size) {
     const px = parseInt(size, 10) || 3;
     canvas.freeDrawingBrush.width = px;
     updateBrushFill(px);
   }
   
   function updateBrushFill(px) {
     const slider = document.getElementById('brush-size');
     if (!slider) return;
     const min = parseFloat(slider.min) || 1;
     const max = parseFloat(slider.max) || 40;
     const clamped = Math.min(Math.max(px, min), max);
     const percent = ((clamped - min) / (max - min)) * 100;
     slider.style.setProperty('--fill-percent', percent + '%');
   }
   
   function openColorPaletteModal() {
     const current = (canvas.freeDrawingBrush.color || '#000000').toLowerCase();
     document.querySelectorAll('.color-swatch[data-color]').forEach(sw => {
       sw.classList.toggle('selected', sw.dataset.color.toLowerCase() === current);
     });
     openModal('colorPaletteModal');
   }
   
   function selectColorFromModal(hex, el) {
     updateBrushColor(hex);
     document.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('selected'));
     if (el) el.classList.add('selected');
     closeModal('colorPaletteModal');
   }
   
   function setupWheelBrushSize() {
     if (!canvas) return;
     canvas.on('mouse:wheel', (opt) => {
       if (!canvas.isDrawingMode) return;
       const e = opt.e;
       e.preventDefault();
       e.stopPropagation();
       const step = e.deltaY < 0 ? 1 : -1;
       const current = canvas.freeDrawingBrush.width || 3;
       const next = Math.min(Math.max(current + step, 1), 40);
       if (next === current) return;
       canvas.freeDrawingBrush.width = next;
       const slider = document.getElementById('brush-size');
       if (slider) { slider.value = next; updateBrushFill(next); }
     });
   }
   
   /* ==========================================================================
      TOOLTIP GLOBAL
      ========================================================================== */
   function setupGlobalTooltips() {
     const tooltip = document.getElementById('global-tooltip');
     if (!tooltip) return;
   
     document.querySelectorAll('[data-tooltip]').forEach(el => {
       el.addEventListener('mouseenter', () => {
         tooltip.textContent = el.dataset.tooltip;
         tooltip.classList.add('visible');
         positionTooltip(el, tooltip);
       });
       el.addEventListener('mouseleave', () => {
         tooltip.classList.remove('visible');
       });
     });
   }
   
   function positionTooltip(el, tooltip) {
     const rect = el.getBoundingClientRect();
     const isHeaderBtn = el.classList.contains('header-icon-btn');
   
     const tRect = tooltip.getBoundingClientRect();
   
     let top, left;
   
     if (isHeaderBtn) {
       top = rect.bottom + 8;
       left = rect.left + rect.width / 2 - tRect.width / 2;
     } else {
       top = rect.top + rect.height / 2 - tRect.height / 2;
       left = rect.right + 10;
     }
   
     const padding = 8;
     if (left + tRect.width > window.innerWidth - padding) {
       left = window.innerWidth - tRect.width - padding;
     }
     if (left < padding) left = padding;
     if (top < padding) top = padding;
     if (top + tRect.height > window.innerHeight - padding) {
       top = window.innerHeight - tRect.height - padding;
     }
   
     tooltip.style.top = top + 'px';
     tooltip.style.left = left + 'px';
   }
   
   /* ==========================================================================
      FORMATAÇÃO DE TEXTO (parcial e global)
      ========================================================================== */
   function setupFormatColorInput() {
     const input = document.getElementById('fmtColorInput');
     if (!input) return;
   
     input.addEventListener('mousedown', () => {
       isPickingColor = true;
       const active = canvas.getActiveObject();
       if (active && (active.type === 'textbox' || active.type === 'i-text' || active.type === 'text')) {
         lastActiveTextObj = active;
       }
     });
   
     input.addEventListener('input', (e) => {
       applyTextColor(e.target.value);
       isPickingColor = false;
     });
     input.addEventListener('change', (e) => {
       applyTextColor(e.target.value);
       isPickingColor = false;
     });
     input.addEventListener('click', () => setTimeout(() => { isPickingColor = false; }, 400));
   }
   
   function getActiveTextObject() {
     const active = canvas.getActiveObject();
     if (active && (active.type === 'textbox' || active.type === 'i-text' || active.type === 'text')) return active;
     if (lastActiveTextObj && canvas.getObjects().includes(lastActiveTextObj)) return lastActiveTextObj;
     return null;
   }
   
   function getPartialSelection(textObj) {
     if (!textObj || !textObj.isEditing) return null;
     const s = textObj.selectionStart;
     const e = textObj.selectionEnd;
     if (typeof s !== 'number' || typeof e !== 'number') return null;
     if (e <= s) return null;
     return { start: s, end: e };
   }
   
   function applyStyleToRange(textObj, start, end, styleName, value) {
     if (!textObj.styles) textObj.styles = {};
   
     for (let i = start; i < end; i++) {
       const loc = textObj.get2DCursorLocation(i, false);
       const li = loc.lineIndex;
       const ci = loc.charIndex;
   
       if (!textObj.styles[li]) textObj.styles[li] = {};
       if (!textObj.styles[li][ci]) textObj.styles[li][ci] = {};
   
       if (value === null || value === undefined) {
         delete textObj.styles[li][ci][styleName];
         if (Object.keys(textObj.styles[li][ci]).length === 0) {
           delete textObj.styles[li][ci];
         }
         if (Object.keys(textObj.styles[li]).length === 0) {
           delete textObj.styles[li];
         }
       } else {
         textObj.styles[li][ci][styleName] = value;
       }
     }
   }
   
   function applyTextColor(hex) {
     const textObj = getActiveTextObject();
     if (!textObj) return;
   
     const sel = getPartialSelection(textObj);
     if (sel) {
       applyStyleToRange(textObj, sel.start, sel.end, 'fill', hex);
       textObj.dirty = true;
       canvas.requestRenderAll();
       pushHistoryState();
     } else {
       textObj.set('fill', hex);
       textObj.dirty = true;
       canvas.setActiveObject(textObj);
       canvas.requestRenderAll();
       textObj.setCoords();
       pushHistoryState();
     }
   
     document.getElementById('fmtColorDot').style.background = hex;
     document.getElementById('fmtColorInput').value = normalizeHex(hex);
     updateTextFormatBar(textObj);
   }
   
   function toggleTextStyle(style) {
     const textObj = getActiveTextObject();
     if (!textObj) return;
   
     const styleMap = {
       'bold': { key: 'fontWeight', on: 'bold', off: 'normal' },
       'italic': { key: 'fontStyle', on: 'italic', off: 'normal' },
       'underline': { key: 'underline', on: true, off: false },
       'strikethrough': { key: 'linethrough', on: true, off: false }
     };
   
     const map = styleMap[style];
     if (!map) return;
   
     const sel = getPartialSelection(textObj);
   
     if (sel) {
       const loc = textObj.get2DCursorLocation(sel.start, false);
       const current = textObj.styles?.[loc.lineIndex]?.[loc.charIndex]?.[map.key]
         ?? textObj[map.key];
       const isOn = (current === map.on) || (current === true);
       const newValue = isOn ? map.off : map.on;
   
       if (typeof map.on === 'boolean' && newValue === false) {
         applyStyleToRange(textObj, sel.start, sel.end, map.key, null);
       } else {
         applyStyleToRange(textObj, sel.start, sel.end, map.key, newValue);
       }
     } else {
       if (map.key === 'fontWeight') {
         textObj.set('fontWeight', textObj.fontWeight === 'bold' ? 'normal' : 'bold');
       } else if (map.key === 'fontStyle') {
         textObj.set('fontStyle', textObj.fontStyle === 'italic' ? 'normal' : 'italic');
       } else if (map.key === 'underline') {
         textObj.set('underline', !textObj.underline);
       } else if (map.key === 'linethrough') {
         textObj.set('linethrough', !textObj.linethrough);
       }
     }
   
     textObj.dirty = true;
     textObj.setCoords();
     canvas.requestRenderAll();
     pushHistoryState();
     updateTextFormatBar(textObj);
   }
   
   function changeFontSize(delta) {
     const textObj = getActiveTextObject();
     if (!textObj) return;
   
     const sel = getPartialSelection(textObj);
   
     if (sel) {
       const loc = textObj.get2DCursorLocation(sel.start, false);
       const current = textObj.styles?.[loc.lineIndex]?.[loc.charIndex]?.fontSize
         ?? textObj.fontSize
         ?? 24;
       const next = Math.min(Math.max(current + delta, 10), 96);
       applyStyleToRange(textObj, sel.start, sel.end, 'fontSize', next);
     } else {
       const current = textObj.fontSize || 24;
       const next = Math.min(Math.max(current + delta, 10), 96);
       textObj.set('fontSize', next);
     }
   
     textObj.dirty = true;
     textObj.setCoords();
     canvas.requestRenderAll();
     pushHistoryState();
     updateTextFormatBar(textObj);
   }
   
   /* ==========================================================================
      MARCA-TEXTO
      ========================================================================== */
   function toggleHighlightPalette(e) {
     if (e) e.stopPropagation();
     const palette = document.getElementById('highlight-palette');
     if (!palette) return;
     palette.classList.toggle('visible');
   }
   
   function hideHighlightPalette() {
     const palette = document.getElementById('highlight-palette');
     if (palette) palette.classList.remove('visible');
   }
   
   function setupHighlightPaletteOutsideClick() {
     document.addEventListener('click', (e) => {
       const wrapper = document.querySelector('.highlight-wrapper');
       if (!wrapper) return;
       if (!wrapper.contains(e.target)) hideHighlightPalette();
     });
   }
   
   function applyHighlight(colorHex) {
     const textObj = getActiveTextObject();
     if (!textObj) { hideHighlightPalette(); return; }
   
     const sel = getPartialSelection(textObj);
     const value = colorHex === null ? null : colorHex;
   
     if (sel) {
       applyStyleToRange(textObj, sel.start, sel.end, 'textBackgroundColor', value);
     } else {
       textObj.set('textBackgroundColor', value === null ? '' : value);
     }
   
     textObj.dirty = true;
     textObj.setCoords();
     canvas.requestRenderAll();
     pushHistoryState();
     updateTextFormatBar(textObj);
     hideHighlightPalette();
   }
   
   /* ==========================================================================
      BARRA DE FORMATAÇÃO
      ========================================================================== */
   function updateTextFormatBar(textObj) {
     const bar = document.getElementById('text-format-bar');
     if (!textObj || (textObj.type !== 'textbox' && textObj.type !== 'i-text' && textObj.type !== 'text')) {
       hideTextFormatBar();
       return;
     }
     bar.classList.add('visible');
   
     let ref = {
       fontWeight: textObj.fontWeight,
       fontStyle: textObj.fontStyle,
       underline: textObj.underline,
       linethrough: textObj.linethrough,
       fill: textObj.fill,
       textBackgroundColor: textObj.textBackgroundColor
     };
   
     const sel = getPartialSelection(textObj);
     if (sel) {
       const loc = textObj.get2DCursorLocation(sel.start, false);
       const s = textObj.styles?.[loc.lineIndex]?.[loc.charIndex];
       if (s) {
         ref.fontWeight = s.fontWeight ?? ref.fontWeight;
         ref.fontStyle = s.fontStyle ?? ref.fontStyle;
         ref.underline = s.underline ?? ref.underline;
         ref.linethrough = s.linethrough ?? ref.linethrough;
         ref.fill = s.fill ?? ref.fill;
         ref.textBackgroundColor = s.textBackgroundColor ?? ref.textBackgroundColor;
       }
     }
   
     document.getElementById('fmtBold').classList.toggle('active', ref.fontWeight === 'bold');
     document.getElementById('fmtItalic').classList.toggle('active', ref.fontStyle === 'italic');
     document.getElementById('fmtUnderline').classList.toggle('active', !!ref.underline);
     document.getElementById('fmtStrike').classList.toggle('active', !!ref.linethrough);
   
     const color = ref.fill || '#000000';
     document.getElementById('fmtColorDot').style.background = color;
     document.getElementById('fmtColorInput').value = normalizeHex(color);
   }
   
   function hideTextFormatBar() {
     document.getElementById('text-format-bar').classList.remove('visible');
     hideHighlightPalette();
   }
   
   function normalizeHex(color) {
     if (!color) return '#000000';
     if (color.startsWith('#')) {
       return color.length === 4
         ? '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
         : color;
     }
     const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
     if (m) {
       const toHex = n => parseInt(n, 10).toString(16).padStart(2, '0');
       return '#' + toHex(m[1]) + toHex(m[2]) + toHex(m[3]);
     }
     return '#000000';
   }
   
   /* ==========================================================================
      CAPTURA DE SELEÇÃO
      ========================================================================== */
   function setupSelectionCaptureOnButtons() {
     const buttons = document.querySelectorAll(
       '#fmtSearch, #fmtImages, #fmtTranslate, #fmtCambridge, ' +
       '.side-item[data-tooltip="Google Imagens"], ' +
       '.side-item[data-tooltip="Google Translate"], ' +
       '.side-item[data-tooltip="Cambridge Dictionary"]'
     );
   
     buttons.forEach(btn => {
       btn.addEventListener('mousedown', (e) => {
         e.preventDefault();
         const obj = getActiveTextObject();
         if (obj && obj.isEditing &&
             typeof obj.selectionStart === 'number' &&
             typeof obj.selectionEnd === 'number' &&
             obj.selectionEnd > obj.selectionStart) {
           savedTextSelection = obj.text.substring(obj.selectionStart, obj.selectionEnd);
         } else {
           savedTextSelection = null;
         }
       });
     });
   }
   
   function getQueryFromSelection(fallbackToWholeText = true) {
     const textObj = getActiveTextObject();
     let query = "";
   
     if (savedTextSelection && savedTextSelection.trim()) {
       query = savedTextSelection;
     } else if (fallbackToWholeText && textObj && textObj.text) {
       query = textObj.text;
     }
     savedTextSelection = null;
   
     query = query.trim();
     if (!query) {
       showLongOperationToast("Selecione um texto primeiro!");
       return null;
     }
     return query;
   }
   
   /* ==========================================================================
      LINKS
      ========================================================================== */
   function searchOnGoogle() {
     const query = getQueryFromSelection();
     if (!query) return;
     const url = "https://www.google.com/search?q=" + encodeURIComponent(query + ' tradução');
     window.open(url, "_blank", "noopener,noreferrer");
   }
   
   function openGoogleImages() {
     const query = getQueryFromSelection();
     if (!query) return;
     const url = "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(query);
     window.open(url, "_blank", "noopener,noreferrer");
   }
   
   function openGoogleTranslate() {
     const query = getQueryFromSelection();
     if (!query) return;
     const url = "https://translate.google.com/?sl=auto&tl=pt&text="
               + encodeURIComponent(query)
               + "&op=translate";
     window.open(url, "_blank", "noopener,noreferrer");
   }
   
   function openCambridge() {
     const query = getQueryFromSelection();
     if (!query) return;
     const url = "https://dictionary.cambridge.org/dictionary/english/" + encodeURIComponent(query);
     window.open(url, "_blank", "noopener,noreferrer");
   }
   
   function openMySite() {
     window.open("https://dididoingles.github.io/saibamais/", "_blank", "noopener,noreferrer");
   }
   
   function openLibrary() {
     window.open("https://dididoingles.github.io/library/", "_blank", "noopener,noreferrer");
   }
   
   /* ==========================================================================
      ÍCONES
      ========================================================================== */
   const AVAILABLE_ICONS = [
     'fa-star', 'fa-heart', 'fa-thumbs-up', 'fa-check', 'fa-xmark',
     'fa-question', 'fa-lightbulb', 'fa-graduation-cap', 'fa-book', 'fa-pencil',
     'fa-clock', 'fa-calendar', 'fa-location-dot', 'fa-comment', 'fa-envelope',
     'fa-arrow-right', 'fa-arrow-left', 'fa-arrow-up', 'fa-arrow-down', 'fa-music',
     'fa-camera', 'fa-globe', 'fa-bolt', 'fa-fire', 'fa-trophy'
   ];
   
   function populateIconPicker() {
     const grid = document.getElementById('icon-picker-grid');
     grid.innerHTML = '';
     AVAILABLE_ICONS.forEach(iconClass => {
       const div = document.createElement('div');
       div.className = 'icon-option';
       div.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
       div.onclick = () => selectIcon(iconClass);
       grid.appendChild(div);
     });
   }
   
   function openIconModal() { openModal('iconModal'); }
   
   function selectIcon(iconClass) {
     closeModal('iconModal');
     const tempI = document.createElement('i');
     tempI.className = `fa-solid ${iconClass}`;
     document.body.appendChild(tempI);
     const charCode = window.getComputedStyle(tempI, ':before').getPropertyValue('content').replace(/"/g, '');
     document.body.removeChild(tempI);
   
     const iconText = new fabric.Text(charCode, {
       fontFamily: '"Font Awesome 6 Free"',
       fontWeight: '900',
       fontSize: 40,
       left: 100,
       top: 100,
       fill: canvas.freeDrawingBrush.color || '#333333'
     });
   
     canvas.add(iconText);
     canvas.isDrawingMode = false;
     updateDrawingBtnUI();
   }
   
   /* ==========================================================================
      POST-ITS
      ========================================================================== */
   function openPostItModal() { openModal('postItModal'); }
   
   function addPostIt(color) {
     closeModal('postItModal');
     const rect = new fabric.Rect({
       left: 150,
       top: 150,
       width: 150,
       height: 150,
       fill: color,
       rx: 6,
       ry: 6,
       shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.18)', blur: 12, offsetX: 2, offsetY: 4 }),
       cornerColor: '#c00000',
       cornerSize: 8,
       transparentCorners: false
     });
   
     canvas.add(rect);
     canvas.setActiveObject(rect);
     canvas.renderAll();
     pushHistoryState();
   }
   
   /* ==========================================================================
      DOWNLOAD
      ========================================================================== */
   function downloadCanvas() {
     showLongOperationToast("Gerando imagem...");
     const today = new Date().toISOString().slice(0, 10);
     setTimeout(() => {
       const link = document.createElement('a');
       link.download = `aula-whiteboard-${today}.png`;
       link.href = canvas.toDataURL({ format: 'png', quality: 1.0 });
       link.click();
     }, 800);
   }
   
   /* ==========================================================================
      CONTADOR
      ========================================================================== */
   function updateCounter() {
     if (!canvas) return;
     const counterEl = document.getElementById('word-counter');
     if (!counterEl) return;
   
     let fullText = '';
     canvas.getObjects().forEach(obj => {
       if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
         const t = (obj.text || '').trim();
         if (t) fullText += (fullText ? ' ' : '') + t;
       }
     });
   
     const chars = fullText.length;
     const words = fullText.length === 0
       ? 0
       : fullText.split(/\s+/).filter(Boolean).length;
   
     counterEl.textContent = `${words} palavra${words === 1 ? '' : 's'} · ${chars} caractere${chars === 1 ? '' : 's'}`;
   }
   
   /* ==========================================================================
      PERSISTÊNCIA
      ========================================================================== */
   function scheduleAutoSave() {
     if (isRestoringState) return;
     if (autoSaveTimer) clearTimeout(autoSaveTimer);
     autoSaveTimer = setTimeout(() => {
       saveToStorage();
     }, 2000);
   }
   
   function saveToStorage() {
     if (!canvas) return;
     try {
       const json = JSON.stringify(canvas);
       localStorage.setItem(STORAGE_KEY, json);
       updateSaveIndicator();
     } catch (e) {
       if (e.name === 'QuotaExceededError' || e.code === 22) {
         showLongOperationToast("Espaço de armazenamento cheio. Baixe o quadro para não perder.");
       } else {
         console.error("Erro ao salvar:", e);
       }
     }
   }
   
   function manualSave() {
     saveToStorage();
     showLongOperationToast("Quadro salvo!");
   }
   
   function updateSaveIndicator() {
     const el = document.getElementById('save-indicator');
     if (!el) return;
     const now = new Date();
     const hh = String(now.getHours()).padStart(2, '0');
     const mm = String(now.getMinutes()).padStart(2, '0');
     el.textContent = `Salvo às ${hh}:${mm}`;
   }
   
   function tryLoadFromStorage() {
     const saved = localStorage.getItem(STORAGE_KEY);
     if (!saved) return false;
   
     try {
       isRestoringState = true;
       canvas.loadFromJSON(saved, () => {
         canvas.renderAll();
         /* Reaplica o fundo (grade/cor) — loadFromJSON limpa o background */
         applyCanvasBackground();
         isRestoringState = false;
         history = [JSON.stringify(canvas)];
         historyIndex = 0;
         updateUndoRedoButtons();
         updateCounter();
         updateSaveIndicator();
       });
       return true;
     } catch (e) {
       console.error("Erro ao carregar do storage:", e);
       isRestoringState = false;
       return false;
     }
   }
   
   /* ==========================================================================
      AÇÕES DO QUADRO
      ========================================================================== */
   function promptClearBoard() {
     openConfirmModal(
       "Limpar quadro",
       "Tem certeza de que deseja apagar todo o conteúdo do quadro?",
       () => {
         canvas.clear();
         applyCanvasBackground();
         canvas.renderAll();
         history = [];
         historyIndex = -1;
         pushHistoryState();
         hideTextFormatBar();
         lastActiveTextObj = null;
         updateCounter();
         scheduleAutoSave();
       }
     );
   }
   
   function promptDeleteSelected() {
     const activeObjects = canvas.getActiveObjects();
     if (!activeObjects.length) return;
   
     openConfirmModal(
       "Excluir elementos",
       `Deseja remover os ${activeObjects.length} item(ns) selecionados?`,
       () => {
         activeObjects.forEach(obj => canvas.remove(obj));
         canvas.discardActiveObject().renderAll();
         hideTextFormatBar();
         lastActiveTextObj = null;
         updateCounter();
       }
     );
   }
   
   /* ==========================================================================
      MODAIS / TOAST
      ========================================================================== */
   function openModal(id) { document.getElementById(id).classList.add('active'); }
   function closeModal(id) { document.getElementById(id).classList.remove('active'); }
   
   let currentConfirmAction = null;
   
   function openConfirmModal(title, message, onConfirm) {
     document.getElementById('confirmModalTitle').innerText = title;
     document.getElementById('confirmModalMessage').innerText = message;
     currentConfirmAction = onConfirm;
     document.getElementById('confirmModalActionBtn').onclick = executeAndCloseConfirm;
     openModal('confirmModal');
   }
   
   function executeAndCloseConfirm() {
     if (typeof currentConfirmAction === 'function') currentConfirmAction();
     closeConfirmModal();
   }
   
   function closeConfirmModal() {
     currentConfirmAction = null;
     closeModal('confirmModal');
   }
   
   function showLongOperationToast(message) {
     const toast = document.getElementById('toast');
     toast.textContent = message;
     toast.classList.add('show');
     setTimeout(() => { toast.classList.remove('show'); }, 2500);
   }
   
   /* ==========================================================================
      GAVETA
      ========================================================================== */
   document.addEventListener('DOMContentLoaded', () => {
     const openDrawerBtn = document.getElementById('openDrawerBtn');
     const closeDrawerBtn = document.getElementById('closeDrawerBtn');
     const drawerOverlay = document.getElementById('drawerOverlay');
     const sidebar = document.getElementById('sidebar');
   
     function openDrawer() {
       drawerOverlay.classList.add('active');
       sidebar.classList.add('active');
     }
     function closeDrawer() {
       drawerOverlay.classList.remove('active');
       sidebar.classList.remove('active');
     }
   
     openDrawerBtn.addEventListener('click', openDrawer);
     closeDrawerBtn.addEventListener('click', closeDrawer);
     drawerOverlay.addEventListener('click', closeDrawer);
   });
   
   /* ==========================================================================
      TABS / SLIDE
      ========================================================================== */
   function switchTab(name, el) {
     document.querySelectorAll('.mode-tab').forEach(t => {
       t.classList.remove('active');
       t.setAttribute('aria-selected', 'false');
     });
     el.classList.add('active');
     el.setAttribute('aria-selected', 'true');
   
     const wrapper = document.getElementById('screens-wrapper');
     const drawerBtn = document.getElementById('openDrawerBtn');
     const sidebar = document.getElementById('sidebar');
     const overlay = document.getElementById('drawerOverlay');
   
     if (name === 'Modo-game') {
       wrapper.classList.add('show-game');
       drawerBtn.classList.add('hidden-in-game');
       sidebar.classList.remove('active');
       overlay.classList.remove('active');
       hideTextFormatBar();
     } else {
       wrapper.classList.remove('show-game');
       drawerBtn.classList.remove('hidden-in-game');
     }
   }
   
   /* ==========================================================================
      ATALHOS
      ========================================================================== */
   function setupKeyboardShortcuts() {
     window.addEventListener('keydown', (e) => {
       /* Esc sempre sai do modo apresentação (M1) */
       if (e.key === 'Escape') {
         if (document.body.classList.contains('presentation-mode')) {
           e.preventDefault();
           exitPresentationMode();
           return;
         }
       }
   
       const activeModal = document.querySelector('.modal-overlay.active');
       const activeObj = canvas ? canvas.getActiveObject() : null;
       const isEditingText = activeObj && activeObj.isEditing;
   
       const el = document.activeElement;
       const tag = el ? el.tagName : "";
       const inputType = el ? (el.type || "").toLowerCase() : "";
       const isTypingField =
         tag === "TEXTAREA" ||
         (tag === "INPUT" && ["text", "password", "email", "number", "search", "tel", "url"].includes(inputType));
   
       if (isTypingField || isEditingText) return;
   
       if (e.key === 'Enter' && activeModal) {
         e.preventDefault();
         const primaryBtn = activeModal.querySelector('.btn-modal-primary');
         if (primaryBtn) primaryBtn.click();
         return;
       }
   
       if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
         e.preventDefault();
         redo();
         return;
       }
       if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
         e.preventDefault();
         undo();
         return;
       }
       if (e.ctrlKey && e.key.toLowerCase() === 's') {
         e.preventDefault();
         manualSave();
         return;
       }
       if (e.ctrlKey && e.key.toLowerCase() === 't') { e.preventDefault(); setToolMode('text'); }
       if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); setToolMode('draw'); }
       if (e.key === "Delete") { promptDeleteSelected(); }
     });
   }
   
   /* ==========================================================================
      FORCA
      ========================================================================== */
   let secretWord = "", guessedLetters = [], errors = 0, usedWords = [];
   
   function createKeyboard() {
     const kb = document.getElementById('game-keyboard');
     kb.innerHTML = '';
     "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').forEach(l => {
       const btn = document.createElement('button');
       btn.className = 'key-btn';
       btn.innerText = l;
       btn.onclick = () => makeGuess(l, btn);
       kb.appendChild(btn);
     });
   }
   
   function startHangman() {
     const allTexts = canvas.getObjects().filter(obj =>
       (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') &&
       obj.text.trim().length > 0
     );
   
     if (allTexts.length === 0) {
       openConfirmModal("Modo game", "Board vazio: escreva algumas palavras no quadro primeiro para jogar!", () => {});
       return;
     }
   
     let wordsArray = [];
     allTexts.forEach(obj => {
       const wordsInObject = obj.text.trim().toUpperCase().split(/\s+/);
       wordsInObject.forEach(word => {
         const cleanWord = word.replace(/[^A-ZÀ-Ú]/g, "");
         if (cleanWord.length > 1) wordsArray.push(cleanWord);
       });
     });
   
     wordsArray = [...new Set(wordsArray)];
     if (wordsArray.length === 0) {
       openConfirmModal("Modo game", "Não foram encontradas palavras válidas no quadro.", () => {});
       return;
     }
   
     if (usedWords.length >= wordsArray.length) usedWords = [];
   
     const availableWords = wordsArray.filter(w => !usedWords.includes(w));
     secretWord = availableWords[Math.floor(Math.random() * availableWords.length)];
     usedWords.push(secretWord);
   
     guessedLetters = [];
     errors = 0;
     document.getElementById('game-message').innerHTML = "";
     document.getElementById('game-message').style.color = "";
     createKeyboard();
     drawHangman(0);
     updateHangmanDisplay();
   }
   
   function makeGuess(letter, btn) {
     if (!secretWord || guessedLetters.includes(letter) || errors >= 6) return;
     guessedLetters.push(letter);
     btn.style.visibility = 'hidden';
     if (!secretWord.includes(letter)) errors++;
     drawHangman(errors);
     updateHangmanDisplay();
     checkGameOver();
   }
   
   function updateHangmanDisplay() {
     document.getElementById('hangman-word-display').innerText =
       secretWord.split('').map(l => guessedLetters.includes(l) ? l : '_').join(' ');
   }
   
   function checkGameOver() {
     const msg = document.getElementById('game-message');
     const isWin = secretWord && !document.getElementById('hangman-word-display').innerText.includes('_');
     if (errors >= 6) {
       msg.innerHTML = `A palavra era: <strong>${secretWord}</strong>`;
       msg.style.color = "#c00000";
     } else if (isWin) {
       msg.innerText = "Parabéns!";
       msg.style.color = "green";
     }
   }
   
   function drawHangman(step) {
     const c = document.getElementById('hangman-canvas').getContext('2d');
     c.clearRect(0, 0, 200, 250);
     c.lineWidth = 3;
     c.strokeStyle = '#333';
     c.beginPath();
     c.moveTo(20, 200); c.lineTo(160, 200);
     c.moveTo(40, 200); c.lineTo(40, 10); c.lineTo(110, 10); c.lineTo(110, 30);
     c.stroke();
     if (step > 0) { c.beginPath(); c.arc(110, 50, 20, 0, Math.PI * 2); c.stroke(); }
     if (step > 1) { c.beginPath(); c.moveTo(110, 70); c.lineTo(110, 140); c.stroke(); }
     if (step > 2) { c.beginPath(); c.moveTo(110, 85); c.lineTo(80, 110); c.stroke(); }
     if (step > 3) { c.beginPath(); c.moveTo(110, 85); c.lineTo(140, 110); c.stroke(); }
     if (step > 4) { c.beginPath(); c.moveTo(110, 140); c.lineTo(80, 180); c.stroke(); }
     if (step > 5) { c.beginPath(); c.moveTo(110, 140); c.lineTo(140, 180); c.stroke(); }
   }
   
   /* ==========================================================================
      COLAR IMAGEM
      ========================================================================== */
   document.addEventListener('paste', function (e) {
     const items = e.clipboardData && e.clipboardData.items;
     if (!items) return;
   
     for (let i = 0; i < items.length; i++) {
       const item = items[i];
       if (item.type.indexOf('image') !== -1) {
         const blob = item.getAsFile();
         const reader = new FileReader();
   
         reader.onload = function (event) {
           const imgObj = new Image();
           imgObj.src = event.target.result;
   
           imgObj.onload = function () {
             const fabricImg = new fabric.Image(imgObj, {
               left: canvas.width ? canvas.width / 4 : 150,
               top: canvas.height ? canvas.height / 4 : 150,
               selectable: true,
               hasControls: true,
               cornerColor: '#c00000',
               cornerSize: 8,
               transparentCorners: false
             });
   
             if (fabricImg.width > 400) fabricImg.scaleToWidth(400);
   
             canvas.add(fabricImg);
             canvas.setActiveObject(fabricImg);
             canvas.renderAll();
             showLongOperationToast("Imagem colada!");
           };
         };
   
         reader.readAsDataURL(blob);
         e.preventDefault();
         break;
       }
     }
   });
   
   /* ==========================================================================
      MODAL "FUNCIONA MELHOR NO PC" (mobile)
      - Aparece em telas < 768px, toda vez que a página carrega, ATÉ o usuário
        clicar em "Continuar no celular mesmo assim" — aí marca a data de hoje
        e não aparece mais pelo resto do dia.
      - O botão de copiar link NÃO marca como visto; só copia.
      ========================================================================== */
   function setupDesktopNoticeModal() {
     /* Só em mobile */
     const isMobile = window.matchMedia('(max-width: 768px)').matches;
     if (!isMobile) return;
   
     /* Já foi marcado como visto hoje? */
     const today = new Date().toISOString().slice(0, 10); /* YYYY-MM-DD */
     const lastShown = localStorage.getItem(DESKTOP_NOTICE_KEY);
     if (lastShown === today) return;
   
     const modal = document.getElementById('desktop-modal');
     if (!modal) return;
   
     /* Abre */
     modal.classList.add('active');
   
     /* Botão copiar link */
     const copyBtn = document.getElementById('btn-copy-link');
     const linkText = document.getElementById('desktop-link-text');
     if (copyBtn && linkText) {
       copyBtn.addEventListener('click', async () => {
         const url = 'dididoingles.github.io/whiteboard';
         try {
           if (navigator.clipboard && navigator.clipboard.writeText) {
             await navigator.clipboard.writeText(url);
           } else {
             /* Fallback pra navegadores antigos */
             const tmp = document.createElement('textarea');
             tmp.value = url;
             tmp.style.position = 'fixed';
             tmp.style.opacity = '0';
             document.body.appendChild(tmp);
             tmp.select();
             document.execCommand('copy');
             document.body.removeChild(tmp);
           }
           /* Feedback visual no botão */
           copyBtn.classList.add('copied');
           const icon = copyBtn.querySelector('i');
           if (icon) icon.className = 'fa-solid fa-check';
           setTimeout(() => {
             copyBtn.classList.remove('copied');
             if (icon) icon.className = 'fa-solid fa-copy';
           }, 1500);
         } catch (err) {
           showLongOperationToast("Copie manualmente: " + url);
         }
       });
     }
   
     /* Botão continuar — é AQUI que marca como visto hoje */
     const continueBtn = document.getElementById('btn-desktop-continue');
     if (continueBtn) {
       continueBtn.addEventListener('click', () => {
         localStorage.setItem(DESKTOP_NOTICE_KEY, today);
         modal.classList.remove('active');
       });
     }
   }
   
   /* ==========================================================================
      TOQUE SIMPLES EM ÁREA VAZIA — MOBILE
      Cria texto quando o usuário toca em área vazia no modo Texto.
      Não conflita com modo caneta (isDrawingMode) porque só age em modo texto.
      Não conflita com botões da UI porque só age no <canvas id="whiteboard">.
      ========================================================================== */
   (function setupMobileTapToCreateText() {
     /* Só roda em telas touch */
     const isTouchDevice = ('ontouchstart' in window) ||
                           (navigator.maxTouchPoints > 0);
     if (!isTouchDevice) return;
   
     let touchStartX = 0;
     let touchStartY = 0;
     let touchStartTime = 0;
     let touchStartTarget = null;
   
     document.addEventListener('touchstart', (e) => {
       const touch = e.touches[0];
       if (!touch) return;
       touchStartX = touch.clientX;
       touchStartY = touch.clientY;
       touchStartTime = Date.now();
       touchStartTarget = e.target;
     }, { passive: true });
   
     document.addEventListener('touchend', (e) => {
       if (!canvas) return;
   
       /* Só age se o toque começou e terminou no canvas */
       if (!touchStartTarget || touchStartTarget.id !== 'whiteboard') return;
   
       /* Só no modo texto */
       if (currentToolMode !== 'text') return;
   
       /* Só se não estiver no modo desenho */
       if (canvas.isDrawingMode) return;
   
       /* Ignora se o canvas tem objeto selecionado/em edição */
       const active = canvas.getActiveObject();
       if (active) {
         if (active.isEditing) return;
         canvas.discardActiveObject();
         canvas.renderAll();
       }
   
       /* Ignora se foi um gesto (moveu muito) */
       const touch = e.changedTouches[0];
       if (!touch) return;
       const dx = Math.abs(touch.clientX - touchStartX);
       const dy = Math.abs(touch.clientY - touchStartY);
       if (dx > 10 || dy > 10) return;
   
       /* Ignora se foi um toque longo (> 500ms) — provavelmente gesto */
       const elapsed = Date.now() - touchStartTime;
       if (elapsed > 500) return;
   
       /* Ignora se o toque caiu em cima de um objeto do Fabric */
       const pointer = canvas.getPointer(touch);
       const target = canvas.findTarget({ clientX: touch.clientX, clientY: touch.clientY });
       if (target) return;
   
       /* Cria o texto na posição do toque */
       e.preventDefault();
       createTextAt(pointer.x, pointer.y);
     }, { passive: false });
   })();
