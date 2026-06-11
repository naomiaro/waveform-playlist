/******/ var __webpack_modules__ = ({

/***/ "./node_modules/@shren/typed-event-emitter/dist/index.js":
/*!***************************************************************!*\
  !*** ./node_modules/@shren/typed-event-emitter/dist/index.js ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TypedEventEmitter = exports.$AnyEventType = void 0;
exports.$AnyEventType = Symbol("__TypedEventListener_AnyEventType");
class TypedEventEmitter {
    constructor() {
        this._listeners = { [exports.$AnyEventType]: [] };
    }
    get listeners() {
        return this._listeners;
    }
    getListeners(eventName) {
        if (!(eventName in this._listeners))
            this._listeners[eventName] = [];
        return this._listeners[eventName];
    }
    on(eventName, listener) {
        if (this.getListeners(eventName).indexOf(listener) === -1)
            this.getListeners(eventName).push(listener);
    }
    once(eventName, listener) {
        const listenerWithOff = (arg, emitter) => {
            const returnValue = listener(arg, emitter);
            this.off(eventName, listenerWithOff);
            return returnValue;
        };
        this.on(eventName, listenerWithOff);
    }
    onAny(listener) {
        this._listeners[exports.$AnyEventType].push(listener);
    }
    off(eventName, listener) {
        const i = this.getListeners(eventName).indexOf(listener);
        if (i !== -1)
            this.getListeners(eventName).splice(i, 1);
    }
    offAny(listener) {
        const i = this._listeners[exports.$AnyEventType].indexOf(listener);
        if (i !== -1)
            this._listeners[exports.$AnyEventType].splice(i, 1);
    }
    async emit(eventName, eventData, options) {
        var _a;
        let listeners = this.getListeners(eventName);
        let anyListeners = (options === null || options === void 0 ? void 0 : options.excludeAny) ? [] : this._listeners[exports.$AnyEventType];
        if (!listeners.length && !anyListeners.length)
            return [];
        if ((_a = options === null || options === void 0 ? void 0 : options.exclude) === null || _a === void 0 ? void 0 : _a.length) {
            const { exclude } = options;
            listeners = listeners.filter(l => exclude.indexOf(l) === -1);
            anyListeners = anyListeners.filter(l => exclude.indexOf(l) === -1);
        }
        return Promise.all([...listeners.map(f => f(eventData, this)), ...anyListeners.map(f => f(eventName, eventData, this))]);
    }
    async emitSerial(eventName, eventData, options) {
        var _a;
        let listeners = this.getListeners(eventName);
        let anyListeners = (options === null || options === void 0 ? void 0 : options.excludeAny) ? [] : this._listeners[exports.$AnyEventType];
        if (!listeners.length && !anyListeners.length)
            return [];
        if ((_a = options === null || options === void 0 ? void 0 : options.exclude) === null || _a === void 0 ? void 0 : _a.length) {
            const { exclude } = options;
            listeners = listeners.filter(l => exclude.indexOf(l) === -1);
            anyListeners = anyListeners.filter(l => exclude.indexOf(l) === -1);
        }
        const returnValues = [];
        for (let i = 0; i < listeners.length; i++) {
            const listener = listeners[i];
            returnValues[i] = await listener(eventData, this);
        }
        for (let i = 0; i < anyListeners.length; i++) {
            const listener = anyListeners[i];
            returnValues[listeners.length + i] = await listener(eventName, eventData, this);
        }
        return returnValues;
    }
    emitSync(eventName, eventData, options) {
        var _a;
        let listeners = this.getListeners(eventName);
        let anyListeners = (options === null || options === void 0 ? void 0 : options.excludeAny) ? [] : this._listeners[exports.$AnyEventType];
        if (!listeners.length && !anyListeners.length)
            return [];
        if ((_a = options === null || options === void 0 ? void 0 : options.exclude) === null || _a === void 0 ? void 0 : _a.length) {
            const { exclude } = options;
            listeners = listeners.filter(l => exclude.indexOf(l) === -1);
            anyListeners = anyListeners.filter(l => exclude.indexOf(l) === -1);
        }
        return [...listeners.map(f => f(eventData, this)), ...anyListeners.map(f => f(eventName, eventData, this))];
    }
    offAll(eventName) {
        if (eventName) {
            this._listeners[eventName] = [];
        }
        else {
            this._listeners = { [exports.$AnyEventType]: [] };
        }
    }
    listenerCount(eventName) {
        const anyListenerCount = this._listeners[exports.$AnyEventType].length;
        if (!(eventName in this._listeners))
            return anyListenerCount;
        return this._listeners[eventName].length + anyListenerCount;
    }
}
exports.TypedEventEmitter = TypedEventEmitter;
exports["default"] = TypedEventEmitter;
//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./src/FaustUI.ts":
/*!************************!*\
  !*** ./src/FaustUI.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ FaustUI)
/* harmony export */ });
/* harmony import */ var _layout_Layout__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./layout/Layout */ "./src/layout/Layout.ts");
/* harmony import */ var _components_Group__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./components/Group */ "./src/components/Group.ts");
/* harmony import */ var _index_scss__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./index.scss */ "./src/index.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));



class FaustUI {
  /**
   * Calculate incoming UI's layout, bind window events
   */
  constructor(options) {
    this.componentMap = {};
    /**
     * Can be overriden, called by components when its value is changed by user.
     */
    this.paramChangeByUI = (path, value) => {
      if (!this.hostWindow) return;
      this.hostWindow.postMessage({ path, value, type: "param" }, "*");
    };
    const { root, ui: uiIn, listenWindowResize, listenWindowMessage } = options;
    this.DOMroot = root;
    this.ui = uiIn || [];
    if (typeof listenWindowResize === "undefined" || listenWindowResize === true) {
      window.addEventListener("resize", () => {
        this.resize();
      });
    }
    if (typeof listenWindowMessage === "undefined" || listenWindowMessage === true) {
      window.addEventListener("message", (e) => {
        const { data, source } = e;
        if (!data) return;
        const { type } = data;
        if (!type) return;
        this.hostWindow = source;
        if (type === "ui") {
          this.ui = data.ui;
        } else if (type === "param") {
          const { path, value } = data;
          this.paramChangeByDSP(path, value);
        }
      });
    }
  }
  /**
   * Render the UI to DOM root
   */
  mount() {
    this.componentMap = {};
    this.DOMroot.innerHTML = "";
    const props = {
      label: "",
      type: "vgroup",
      items: this.ui,
      style: {
        grid: this.grid,
        width: this.layout.width,
        height: this.layout.height,
        left: this.layout.offsetLeft,
        top: this.layout.offsetTop
      },
      isRoot: true,
      emitter: this
    };
    this.faustUIRoot = new _components_Group__WEBPACK_IMPORTED_MODULE_1__["default"](props);
    this.faustUIRoot.componentWillMount();
    this.faustUIRoot.mount();
    this.DOMroot.appendChild(this.faustUIRoot.container);
    this.faustUIRoot.componentDidMount();
  }
  /**
   * This method should be called by components to register itself to map.
   */
  register(path, item) {
    if (this.componentMap[path]) this.componentMap[path].push(item);
    else this.componentMap[path] = [item];
  }
  /**
   * Notify the component to change its value.
   */
  paramChangeByDSP(path, value) {
    if (this.componentMap[path]) this.componentMap[path].forEach((item) => item.setState({ value }));
  }
  /**
   * Calculate UI layout in grid then calculate grid size.
   */
  calc() {
    const { items, layout } = _layout_Layout__WEBPACK_IMPORTED_MODULE_0__["default"].calc(this.ui);
    this._ui = items;
    this._layout = layout;
    this.calcGrid();
  }
  /**
   * Calculate grid size by DOM root size and layout size in grids.
   */
  calcGrid() {
    const { width, height } = this.DOMroot.getBoundingClientRect();
    const grid = Math.max(40, Math.min(width / this._layout.width, height / this._layout.height));
    this.grid = grid;
    return grid;
  }
  /**
   * Force recalculate grid size and resize UI
   */
  resize() {
    if (!this.faustUIRoot) return;
    this.calcGrid();
    this.faustUIRoot.setState({ style: { grid: this.grid } });
  }
  /** Filter out items with `hidden` metadata and `soundfile` items */
  filter(ui) {
    const callback = (items, item) => {
      var _a;
      if (item.type === "soundfile") return items;
      if (item.type === "hgroup" || item.type === "vgroup" || item.type === "tgroup") {
        items.push(__spreadProps(__spreadValues({}, item), { items: item.items.reduce(callback, []) }));
        return items;
      }
      if ((_a = item.meta) == null ? void 0 : _a.find((m) => m.hidden && m.hidden === "1")) return items;
      items.push(item);
      return items;
    };
    return ui.reduce(callback, []);
  }
  get ui() {
    return this._ui;
  }
  set ui(uiIn) {
    this._ui = this.filter(uiIn);
    this.calc();
    this.mount();
  }
  get layout() {
    return this._layout;
  }
  get minWidth() {
    return this._layout.width * 40 + 1;
  }
  get minHeight() {
    return this._layout.height * 40 + 1;
  }
}


/***/ }),

/***/ "./src/components/AbstractComponent.ts":
/*!*********************************************!*\
  !*** ./src/components/AbstractComponent.ts ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AbstractComponent)
/* harmony export */ });
/* harmony import */ var _shren_typed_event_emitter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @shren/typed-event-emitter */ "./node_modules/@shren/typed-event-emitter/dist/index.js");
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};

class AbstractComponent extends _shren_typed_event_emitter__WEBPACK_IMPORTED_MODULE_0__["default"] {
  /**
   * Initiate default state with incoming state.
   */
  constructor(props) {
    super();
    /**
     * Frame count in order to reduce frame rate
     */
    this.$frame = 0;
    /**
     * Frame reducing factor, 1 = render at every browser rendering tick, 2 will skip one every two ticks.
     */
    this.frameReduce = 1;
    /**
     * `requestAnimationFrame` callback
     */
    this.raf = () => {
      this.$frame++;
      if (this.$frame % this.frameReduce !== 0) {
        this.$raf = window.requestAnimationFrame(this.raf);
        return;
      }
      this.$raf = void 0;
      this.tasks.forEach((f) => f());
      this.tasks = [];
    };
    /**
     * tasks to execute in next redering tick
     */
    this.tasks = [];
    this.state = __spreadValues(__spreadValues({}, this.defaultProps), props);
  }
  get defaultProps() {
    return this.constructor.defaultProps;
  }
  /**
   * set internal state and fire events for UI parts subscribed
   */
  setState(newState) {
    let shouldUpdate = false;
    for (const stateKey in newState) {
      const stateValue = newState[stateKey];
      if (stateKey in this.state && this.state[stateKey] !== stateValue) {
        this.state[stateKey] = stateValue;
        shouldUpdate = true;
      } else return;
      if (shouldUpdate) this.emit(stateKey, this.state[stateKey]);
    }
  }
  /**
   * Use this method to request a new rendering
   * schedule what you need to do in next render tick in `raf` callback
   */
  schedule(func) {
    if (this.tasks.indexOf(func) === -1) this.tasks.push(func);
    if (this.$raf) return;
    this.$raf = window.requestAnimationFrame(this.raf);
  }
}
/**
 * The default state of the component.
 */
AbstractComponent.defaultProps = {};


/***/ }),

/***/ "./src/components/AbstractItem.ts":
/*!****************************************!*\
  !*** ./src/components/AbstractItem.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AbstractItem)
/* harmony export */ });
/* harmony import */ var _AbstractComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractComponent */ "./src/components/AbstractComponent.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./src/components/utils.ts");
/* harmony import */ var _Base_scss__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Base.scss */ "./src/components/Base.scss");
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};



const _AbstractItem = class _AbstractItem extends _AbstractComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  /**
   * Initiate default state with incoming state.
   */
  constructor(props) {
    super(props);
    this.frameReduce = 3;
    /**
     * Default DOM event listeners, unify mousedown and touchstart events
     * For mouse or touch events, please use `handlePointerDown` `handlePointerUp` `handlePointerDrag` callbacks
     */
    this.handleKeyDown = (e) => {
    };
    this.handleKeyUp = (e) => {
    };
    this.handleTouchStart = (e) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      let prevX = e.touches[0].clientX;
      let prevY = e.touches[0].clientY;
      const fromX = prevX - rect.left;
      const fromY = prevY - rect.top;
      const prevValue = this.state.value;
      this.handleMouseOrTouchDown({ pointerId: -1, x: fromX, y: fromY, originalEvent: e });
      const handleTouchMove = (e2) => {
        e2.preventDefault();
        const clientX = e2.changedTouches[0].clientX;
        const clientY = e2.changedTouches[0].clientY;
        const movementX = clientX - prevX;
        const movementY = clientY - prevY;
        prevX = clientX;
        prevY = clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        this.handleMouseOrTouchMove({ pointerId: -1, prevValue, x, y, fromX, fromY, movementX, movementY, originalEvent: e2 });
      };
      const handleTouchEnd = (e2) => {
        e2.preventDefault();
        const x = e2.changedTouches[0].clientX - rect.left;
        const y = e2.changedTouches[0].clientY - rect.top;
        this.handleMouseOrTouchUp({ pointerId: -1, x, y, originalEvent: e2 });
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd, { passive: false });
    };
    this.handleWheel = (e) => {
    };
    this.handleClick = (e) => {
    };
    /**
     * Handle double-click events to reset the value to its initial state.
     */
    this.handleDoubleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setToInitialValue();
    };
    this.handleMouseDown = (e) => {
      e.preventDefault();
      e.currentTarget.focus();
      const rect = e.currentTarget.getBoundingClientRect();
      const fromX = e.clientX - rect.left;
      const fromY = e.clientY - rect.top;
      const prevValue = this.state.value;
      this.handleMouseOrTouchDown({ pointerId: -1, x: fromX, y: fromY, originalEvent: e });
      const handleMouseMove = (e2) => {
        e2.preventDefault();
        const x = e2.clientX - rect.left;
        const y = e2.clientY - rect.top;
        this.handleMouseOrTouchMove({ pointerId: -1, prevValue, x, y, fromX, fromY, movementX: e2.movementX, movementY: e2.movementY, originalEvent: e2 });
      };
      const handleMouseUp = (e2) => {
        e2.preventDefault();
        const x = e2.clientX - rect.left;
        const y = e2.clientY - rect.top;
        this.handleMouseOrTouchUp({ pointerId: -1, x, y, originalEvent: e2 });
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };
    this.handleMouseOver = (e) => {
    };
    this.handleMouseOut = (e) => {
    };
    this.handleContextMenu = (e) => {
    };
    this.handlePointerDown = (e) => {
      e.preventDefault();
      e.currentTarget.focus();
      const { pointerId } = e;
      const rect = e.currentTarget.getBoundingClientRect();
      const fromX = e.clientX - rect.left;
      const fromY = e.clientY - rect.top;
      const prevValue = this.state.value;
      this.handleMouseOrTouchDown({ pointerId, x: fromX, y: fromY, originalEvent: e });
      const handlePointerMove = (e2) => {
        if (e2.pointerId !== pointerId) return;
        e2.preventDefault();
        const x = e2.clientX - rect.left;
        const y = e2.clientY - rect.top;
        this.handleMouseOrTouchMove({ pointerId, prevValue, x, y, fromX, fromY, movementX: e2.movementX, movementY: e2.movementY, originalEvent: e2 });
      };
      const handlePointerUp = (e2) => {
        if (e2.pointerId !== pointerId) return;
        e2.preventDefault();
        const x = e2.clientX - rect.left;
        const y = e2.clientY - rect.top;
        this.handleMouseOrTouchUp({ pointerId, x, y, originalEvent: e2 });
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    };
    this.handleMouseOrTouchDown = (e) => {
    };
    this.handleMouseOrTouchMove = (e) => {
    };
    this.handleMouseOrTouchUp = (e) => {
    };
    this.handleFocusIn = (e) => this.setState({ focus: true });
    this.handleFocusOut = (e) => this.setState({ focus: false });
    this.state.style = __spreadValues(__spreadValues({}, this.defaultProps.style), props.style);
    if (this.state.emitter) this.state.emitter.register(this.state.address, this);
  }
  /**
   * Get a nearest valid number
   */
  toValidNumber(value) {
    const { min, max, step } = this.state;
    if (typeof min !== "number" || typeof max !== "number") return value;
    const v = Math.min(max, Math.max(min, value));
    if (!step) return v;
    return min + Math.floor((v - min) / step) * step;
  }
  /**
   * Use this method if you want the emitter to send value to DSP
   */
  setValue(valueIn) {
    const value = this.toValidNumber(valueIn);
    const changed = this.setState({ value });
    if (changed) this.change(value);
    return changed;
  }
  setToInitialValue() {
    this.setValue(this.state.init);
  }
  /**
   * Send value to DSP
   */
  change(valueIn) {
    if (this.state.emitter) this.state.emitter.paramChangeByUI(this.state.address, typeof valueIn === "number" ? valueIn : this.state.value);
  }
  /**
   * set internal state and fire events for UI parts subscribed
   * This will not send anything to DSP
   * @returns is state updated
   */
  setState(newState) {
    let shouldUpdate = false;
    for (const key in newState) {
      const stateKey = key;
      const stateValue = newState[stateKey];
      if (stateKey === "style") {
        for (const styleKey in newState.style) {
          if (styleKey in this.state.style) {
            this.state.style[styleKey] = newState.style[styleKey];
            shouldUpdate = true;
          }
        }
      } else if (stateKey in this.state && this.state[stateKey] !== stateValue) {
        this.state[stateKey] = stateValue;
        shouldUpdate = true;
      } else return false;
      if (shouldUpdate) this.emit(stateKey, this.state[stateKey]);
    }
    return shouldUpdate;
  }
  /**
   * Create container with class name
   * override it with `super.componentWillMount();`
   */
  componentWillMount() {
    this.container = document.createElement("div");
    this.container.className = ["faust-ui-component", "faust-ui-component-" + this.className].join(" ");
    this.container.tabIndex = 1;
    this.container.id = this.state.address;
    if (this.state.tooltip) this.container.title = this.state.tooltip;
    this.label = document.createElement("div");
    this.label.className = "faust-ui-component-label";
    this.labelCanvas = document.createElement("canvas");
    this.labelCtx = this.labelCanvas.getContext("2d");
    return this;
  }
  /**
   * Here append all child DOM to container
   */
  mount() {
    this.label.appendChild(this.labelCanvas);
    return this;
  }
  paintLabel(align) {
    const label = this.state.label;
    const color = this.state.style.labelcolor;
    const ctx = this.labelCtx;
    const canvas = this.labelCanvas;
    const ratio = window.devicePixelRatio || 1;
    let { width, height } = this.label.getBoundingClientRect();
    if (!width || !height) return this;
    width = Math.floor(width);
    height = Math.floor(height);
    const scaledWidth = Math.floor(width * ratio);
    const scaledHeight = Math.floor(height * ratio);
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = align || "center";
    ctx.font = `bold ${height * 0.9}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`;
    ctx.fillText(label, align === "left" ? 0 : align === "right" ? width : width / 2, height / 2, width);
    return this;
  }
  /**
   * will call this method when mounted
   */
  componentDidMount() {
    const handleResize = () => {
      const { grid, left, top, width, height } = this.state.style;
      this.container.style.width = `${width * grid}px`;
      this.container.style.height = `${height * grid}px`;
      this.container.style.left = `${left * grid}px`;
      this.container.style.top = `${top * grid}px`;
      this.label.style.height = `${grid * 0.25}px`;
      this.paintLabel();
    };
    this.on("style", () => this.schedule(handleResize));
    handleResize();
    return this;
  }
  /**
   * Count steps in range min-max with step
   */
  get stepsCount() {
    const { type, max, min, step, enums } = this.state;
    const maxSteps = type === "enum" ? enums.length : type === "int" ? max - min : (max - min) / step;
    if (step) {
      if (type === "enum") return enums.length;
      if (type === "int") return Math.min(Math.floor((max - min) / (Math.round(step) || 1)), maxSteps);
      return Math.floor((max - min) / step);
    }
    return maxSteps;
  }
  /**
   * Normalized value between 0 - 1.
   */
  get distance() {
    const { type, max, min, value, enums, scale } = this.state;
    return _AbstractItem.getDistance({ type, max, min, value, enums, scale });
  }
  static getDistance(state) {
    const { type, max, min, value, enums, scale } = state;
    if (type === "enum") return value / (enums.length - 1);
    const v = scale === "exp" ? (0,_utils__WEBPACK_IMPORTED_MODULE_1__.normLog)(value, min, max) : scale === "log" ? (0,_utils__WEBPACK_IMPORTED_MODULE_1__.normExp)(value, min, max) : value;
    return (0,_utils__WEBPACK_IMPORTED_MODULE_1__.normalize)(v, min, max);
  }
  /**
   * Mousemove pixels for each step
   */
  get stepRange() {
    const full = 100;
    const stepsCount = this.stepsCount;
    return full / stepsCount;
  }
};
/**
 * The default state of the component.
 */
_AbstractItem.defaultProps = {
  value: 0,
  active: true,
  focus: false,
  label: "",
  address: "",
  min: 0,
  max: 1,
  init: 0,
  enums: {},
  type: "float",
  unit: "",
  scale: "linear",
  step: 0.01,
  style: { width: 45, height: 15, left: 0, top: 0, labelcolor: "rgba(226, 222, 255, 0.5)" }
};
let AbstractItem = _AbstractItem;



/***/ }),

/***/ "./src/components/Button.ts":
/*!**********************************!*\
  !*** ./src/components/Button.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Button)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _Button_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Button.scss */ "./src/components/Button.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));


class Button extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "button";
    this.setStyle = () => {
      const { value, style } = this.state;
      const { height, grid, fontsize, fontname, fontface, textcolor, textoncolor, bgoncolor, bgcolor, bordercolor, borderoncolor } = style;
      this.btn.style.backgroundColor = value ? bgoncolor : bgcolor;
      this.btn.style.borderColor = value ? borderoncolor : bordercolor;
      this.btn.style.color = value ? textoncolor : textcolor;
      this.btn.style.fontSize = `${fontsize || height * grid / 4}px`;
      this.btn.style.fontFamily = `${fontname}, sans-serif`;
      this.btn.style.fontStyle = fontface;
    };
    this.handleContextMenu = (e) => {
      e.preventDefault();
    };
    this.handleMouseOrTouchDown = () => {
      this.setValue(1);
    };
    this.handleMouseOrTouchUp = () => {
      this.setValue(0);
    };
  }
  static get defaultProps() {
    const inherited = super.defaultProps;
    return __spreadProps(__spreadValues({}, inherited), {
      style: __spreadProps(__spreadValues({}, inherited.style), {
        fontname: "Arial",
        fontsize: void 0,
        fontface: "normal",
        bgcolor: "rgba(40, 40, 40, 1)",
        bgoncolor: "rgba(18, 18, 18, 1)",
        bordercolor: "rgba(80, 80, 80, 1)",
        borderoncolor: "rgba(255, 165, 0, 1)",
        textcolor: "rgba(226, 222, 255, 0.5)",
        textoncolor: "rgba(255, 165, 0, 1)"
      })
    });
  }
  componentWillMount() {
    super.componentWillMount();
    this.btn = document.createElement("div");
    this.span = document.createElement("span");
    this.span.innerText = this.state.label;
    this.setStyle();
    return this;
  }
  mount() {
    this.btn.appendChild(this.span);
    this.container.appendChild(this.btn);
    return super.mount();
  }
  componentDidMount() {
    super.componentDidMount();
    this.btn.addEventListener("pointerdown", this.handlePointerDown);
    this.btn.addEventListener("contextmenu", this.handleContextMenu);
    this.on("style", () => this.schedule(this.setStyle));
    const labelChange = () => this.span.innerText = this.state.label;
    this.on("label", () => this.schedule(labelChange));
    this.on("value", () => this.schedule(this.setStyle));
    return this;
  }
}


/***/ }),

/***/ "./src/components/Checkbox.ts":
/*!************************************!*\
  !*** ./src/components/Checkbox.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Checkbox)
/* harmony export */ });
/* harmony import */ var _Button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Button */ "./src/components/Button.ts");
/* harmony import */ var _Checkbox_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Checkbox.scss */ "./src/components/Checkbox.scss");


class Checkbox extends _Button__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "checkbox";
    this.handleMouseOrTouchDown = () => {
      this.setValue(1 - this.state.value);
    };
    this.handleMouseOrTouchUp = () => {
    };
  }
}


/***/ }),

/***/ "./src/components/Group.ts":
/*!*********************************!*\
  !*** ./src/components/Group.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Group)
/* harmony export */ });
/* harmony import */ var _AbstractComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractComponent */ "./src/components/AbstractComponent.ts");
/* harmony import */ var _HSlider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./HSlider */ "./src/components/HSlider.ts");
/* harmony import */ var _VSlider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./VSlider */ "./src/components/VSlider.ts");
/* harmony import */ var _Nentry__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./Nentry */ "./src/components/Nentry.ts");
/* harmony import */ var _Soundfile__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./Soundfile */ "./src/components/Soundfile.ts");
/* harmony import */ var _Button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./Button */ "./src/components/Button.ts");
/* harmony import */ var _Checkbox__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./Checkbox */ "./src/components/Checkbox.ts");
/* harmony import */ var _Knob__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./Knob */ "./src/components/Knob.ts");
/* harmony import */ var _Menu__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./Menu */ "./src/components/Menu.ts");
/* harmony import */ var _Radio__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./Radio */ "./src/components/Radio.ts");
/* harmony import */ var _Led__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./Led */ "./src/components/Led.ts");
/* harmony import */ var _Numerical__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./Numerical */ "./src/components/Numerical.ts");
/* harmony import */ var _HBargraph__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./HBargraph */ "./src/components/HBargraph.ts");
/* harmony import */ var _VBargraph__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./VBargraph */ "./src/components/VBargraph.ts");
/* harmony import */ var _layout_Layout__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../layout/Layout */ "./src/layout/Layout.ts");
/* harmony import */ var _Group_scss__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./Group.scss */ "./src/components/Group.scss");
















class Group extends _AbstractComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    /**
     * Handle double-click events to reset all children's value to its initial state.
     */
    this.handleDoubleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setToInitialValue();
    };
    this.updateUI = () => {
      this.children = [];
      const { style, type, items, emitter, isRoot } = this.state;
      const { grid, left, top, width, height } = style;
      if (!this.state.isRoot) this.label.style.height = `${grid * 0.3}px`;
      this.container.style.left = `${left * grid}px`;
      this.container.style.top = `${top * grid}px`;
      this.container.style.width = `${width * grid}px`;
      this.container.style.height = `${height * grid}px`;
      this.container.className = ["faust-ui-group", `faust-ui-${type}`, `${isRoot ? "faust-ui-root" : ""}`].join(" ");
      items.forEach((item) => {
        if (item.type.endsWith("group")) {
          const component = Group.getComponent(item, emitter, grid);
          if (component) this.children.push(component);
        } else {
          const ioItem = item;
          const itemComponent = Group.getComponent(ioItem, this.state.emitter, grid);
          if (itemComponent) this.children.push(itemComponent);
        }
      });
      if (type === "tgroup") {
        this.tabs.innerHTML = "";
        this.tabs.style.height = `${grid}px`;
        this.tabs.style.top = `${0.25 * grid}px`;
        this.state.items.forEach((item, i) => {
          const label = item.label;
          const tab = document.createElement("span");
          tab.innerText = label;
          tab.className = "faust-ui-tgroup-tab";
          tab.style.fontSize = `${0.25 * grid}px`;
          tab.style.width = `${2 * grid - 20}px`;
          tab.style.height = `${grid - 20}px`;
          tab.style.lineHeight = `${grid - 20}px`;
          tab.addEventListener("click", () => {
            const groups = [];
            for (let j = 0; j < this.container.children.length; j++) {
              const element = this.container.children[j];
              if (j > 1) groups.push(element);
            }
            for (let j = 0; j < groups.length; j++) {
              const element = groups[j];
              element.style.visibility = i === j ? "visible" : "hidden";
            }
            for (let j = 0; j < this.tabs.children.length; j++) {
              const e = this.tabs.children[j];
              if (i !== j) {
                if (e.classList.contains("active")) e.classList.remove("active");
              } else e.classList.add("active");
            }
          });
          this.tabs.appendChild(tab);
        });
      }
    };
  }
  static parseMeta(metaIn) {
    const metaObject = {};
    if (!metaIn) return { metaObject };
    metaIn.forEach((m) => Object.assign(metaObject, m));
    if (metaObject.style) {
      const enumsRegex = /\{\s*(?:['_\-](.+?)['_\-]\s*:\s*([-+]?[0-9]*\.?[0-9]+)\s*;\s*)+(?:['_\-](.+?)['_\-]\s*:\s*([-+]?[0-9]*\.?[0-9]+))\s*\}/;
      const matched = metaObject.style.match(enumsRegex);
      if (matched) {
        const itemsRegex = /['_\-](.+?)['_\-]\s*:\s*([-+]?[0-9]*\.?[0-9]+)\s*/g;
        const enums = {};
        let item;
        while (item = itemsRegex.exec(matched[0])) {
          enums[item[1]] = +item[2];
        }
        return { metaObject, enums };
      }
    }
    return { metaObject };
  }
  static getComponent(item, emitter, grid) {
    const type = _layout_Layout__WEBPACK_IMPORTED_MODULE_14__["default"].predictType(item);
    if (type.endsWith("group")) {
      const { label: label2, items, type: type2, layout: layout2 } = item;
      const props2 = {
        label: label2,
        type: type2,
        items,
        style: {
          grid,
          width: layout2.width,
          height: layout2.height,
          left: layout2.offsetLeft,
          top: layout2.offsetTop,
          labelcolor: "rgba(255, 255, 255, 0.7)"
        },
        emitter
      };
      return new Group(props2);
    }
    const ioItem = item;
    const { metaObject, enums } = this.parseMeta(ioItem.meta);
    const { tooltip, unit, scale } = metaObject;
    const { label, min, max, address, layout } = ioItem;
    const props = {
      label,
      address,
      tooltip,
      unit,
      scale: scale || "linear",
      emitter,
      enums,
      style: {
        grid,
        width: layout.width,
        height: layout.height,
        left: layout.offsetLeft,
        top: layout.offsetTop
      },
      type: "float",
      min: isFinite(min) ? min : 0,
      max: isFinite(max) ? max : 1,
      step: "step" in item ? +item.step : 1,
      value: "init" in item ? +item.init || 0 : 0,
      init: "init" in item ? +item.init || 0 : 0
    };
    if (type === "button") return new _Button__WEBPACK_IMPORTED_MODULE_5__["default"](props);
    if (type === "checkbox") return new _Checkbox__WEBPACK_IMPORTED_MODULE_6__["default"](props);
    if (type === "nentry") return new _Nentry__WEBPACK_IMPORTED_MODULE_3__["default"](props);
    if (type === "soundfile") return new _Soundfile__WEBPACK_IMPORTED_MODULE_4__["default"](props);
    if (type === "knob") return new _Knob__WEBPACK_IMPORTED_MODULE_7__["default"](props);
    if (type === "menu") return new _Menu__WEBPACK_IMPORTED_MODULE_8__["default"](props);
    if (type === "radio") return new _Radio__WEBPACK_IMPORTED_MODULE_9__["default"](props);
    if (type === "hslider") return new _HSlider__WEBPACK_IMPORTED_MODULE_1__["default"](props);
    if (type === "vslider") return new _VSlider__WEBPACK_IMPORTED_MODULE_2__["default"](props);
    if (type === "hbargraph") return new _HBargraph__WEBPACK_IMPORTED_MODULE_12__["default"](props);
    if (type === "vbargraph") return new _VBargraph__WEBPACK_IMPORTED_MODULE_13__["default"](props);
    if (type === "numerical") return new _Numerical__WEBPACK_IMPORTED_MODULE_11__["default"](props);
    if (type === "led") return new _Led__WEBPACK_IMPORTED_MODULE_10__["default"](props);
    return null;
  }
  setToInitialValue() {
    this.children.forEach((item) => item.setToInitialValue());
  }
  setState(newState) {
    let shouldUpdate = false;
    for (const key in newState) {
      const stateKey = key;
      const stateValue = newState[stateKey];
      if (stateKey === "style") {
        for (const key2 in newState.style) {
          const styleKey = key2;
          if (styleKey in this.state.style) {
            this.state.style[styleKey] = newState.style[styleKey];
            shouldUpdate = true;
          }
        }
      } else if (stateKey in this.state && this.state[stateKey] !== stateValue) {
        this.state[stateKey] = stateValue;
        shouldUpdate = true;
      } else return;
      if (shouldUpdate) this.emit(stateKey, this.state[stateKey]);
    }
  }
  componentWillMount() {
    this.container = document.createElement("div");
    this.tabs = document.createElement("div");
    this.tabs.className = "faust-ui-tgroup-tabs";
    if (!this.state.isRoot) {
      this.label = document.createElement("div");
      this.label.className = "faust-ui-group-label";
      this.labelCanvas = document.createElement("canvas");
      this.labelCtx = this.labelCanvas.getContext("2d");
    }
    this.updateUI();
    this.children.forEach((item) => item.componentWillMount());
    return this;
  }
  paintLabel() {
    if (this.state.isRoot) return this;
    const label = this.state.label;
    const color = this.state.style.labelcolor;
    const ctx = this.labelCtx;
    const canvas = this.labelCanvas;
    const ratio = window.devicePixelRatio || 1;
    let { width, height } = this.label.getBoundingClientRect();
    if (!width || !height) return this;
    width = Math.floor(width);
    height = Math.floor(height);
    const scaledWidth = Math.floor(width * ratio);
    const scaledHeight = Math.floor(height * ratio);
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = `bold ${height * 0.9}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`;
    ctx.fillText(label, 0, height / 2, width);
    return this;
  }
  mount() {
    if (!this.state.isRoot) {
      this.label.appendChild(this.labelCanvas);
      this.container.appendChild(this.label);
    }
    if (this.tabs.children.length) this.container.appendChild(this.tabs);
    this.children.forEach((item) => {
      item.mount();
      this.container.appendChild(item.container);
    });
    return this;
  }
  componentDidMount() {
    var _a, _b;
    const handleResize = () => {
      const { grid, left, top, width, height } = this.state.style;
      if (!this.state.isRoot) this.label.style.height = `${grid * 0.3}px`;
      this.container.style.width = `${width * grid}px`;
      this.container.style.height = `${height * grid}px`;
      this.container.style.left = `${left * grid}px`;
      this.container.style.top = `${top * grid}px`;
      if (this.state.type === "tgroup") {
        this.tabs.style.height = `${grid}px`;
        this.tabs.style.top = `${0.25 * grid}px`;
        for (let i = 0; i < this.tabs.children.length; i++) {
          const tab = this.tabs.children[i];
          tab.style.fontSize = `${0.25 * grid}px`;
          tab.style.width = `${2 * grid - 20}px`;
          tab.style.height = `${grid - 20}px`;
          tab.style.lineHeight = `${grid - 20}px`;
        }
      }
      this.paintLabel();
      this.children.forEach((item) => item.setState({ style: { grid } }));
    };
    this.on("style", () => this.schedule(handleResize));
    const itemsChange = () => {
      this.updateUI();
      this.children.forEach((item) => item.componentWillMount());
    };
    this.on("items", () => this.schedule(itemsChange));
    const labelChange = () => {
      this.paintLabel();
      this.label.title = this.state.label;
    };
    this.on("label", () => this.schedule(labelChange));
    this.paintLabel();
    (_a = this.labelCanvas) == null ? void 0 : _a.addEventListener("dblclick", this.handleDoubleClick);
    if ((_b = this.tabs) == null ? void 0 : _b.children.length) this.tabs.children[0].click();
    this.children.forEach((item) => item.componentDidMount());
    return this;
  }
}


/***/ }),

/***/ "./src/components/HBargraph.ts":
/*!*************************************!*\
  !*** ./src/components/HBargraph.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ HBargraph)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _VBargraph__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./VBargraph */ "./src/components/VBargraph.ts");
/* harmony import */ var _HBargraph_scss__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./HBargraph.scss */ "./src/components/HBargraph.scss");



class HBargraph extends _VBargraph__WEBPACK_IMPORTED_MODULE_1__["default"] {
  constructor() {
    super(...arguments);
    this.className = "hbargraph";
    this.setStyle = () => {
      const { height, grid, fontsize, textcolor, bgcolor, bordercolor } = this.state.style;
      this.input.style.fontSize = `${fontsize || height * grid * 0.2}px`;
      this.input.style.color = textcolor;
      this.container.style.backgroundColor = bgcolor;
      this.container.style.borderColor = bordercolor;
    };
    this.paint = () => {
      const { barwidth, barbgcolor, coldcolor, warmcolor, hotcolor, overloadcolor } = this.state.style;
      const { type, max, min, enums, scale, value } = this.state;
      const ctx = this.ctx;
      const canvas = this.canvas;
      const ratio = window.devicePixelRatio || 1;
      let { width, height } = this.canvasDiv.getBoundingClientRect();
      width = Math.floor(width);
      height = Math.floor(height);
      const scaledWidth = Math.floor(width * ratio);
      const scaledHeight = Math.floor(height * ratio);
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.scale(ratio, ratio);
      const drawWidth = width * 0.9;
      const drawHeight = barwidth || Math.min(height / 3, drawWidth * 0.05);
      const left = width * 0.05;
      const top = (height - drawHeight) * 0.5;
      this.paintValue = value;
      const paintValue = this.paintValue;
      if (paintValue > this.maxValue) {
        this.maxValue = paintValue;
        if (this.maxTimer) window.clearTimeout(this.maxTimer);
        this.maxTimer = window.setTimeout(() => {
          this.maxValue = this.paintValue;
          this.maxTimer = void 0;
          this.schedule(this.paint);
        }, 1e3);
      }
      if (paintValue < this.maxValue && typeof this.maxTimer === "undefined") {
        this.maxTimer = window.setTimeout(() => {
          this.maxValue = this.paintValue;
          this.maxTimer = void 0;
          this.schedule(this.paint);
        }, 1e3);
      }
      const maxValue = this.maxValue;
      const coldStop = (-18 - min) / (max - min);
      const warmStop = (-6 - min) / (max - min);
      const hotStop = (-3 - min) / (max - min);
      const overloadStop = Math.max(0, -min / (max - min));
      const gradient = ctx.createLinearGradient(left, 0, drawWidth, 0);
      if (coldStop <= 1 && coldStop >= 0) gradient.addColorStop(coldStop, coldcolor);
      else if (coldStop > 1) gradient.addColorStop(1, coldcolor);
      if (warmStop <= 1 && warmStop >= 0) gradient.addColorStop(warmStop, warmcolor);
      if (hotStop <= 1 && hotStop >= 0) gradient.addColorStop(hotStop, hotcolor);
      if (overloadStop <= 1 && overloadStop >= 0) gradient.addColorStop(overloadStop, overloadcolor);
      else if (overloadStop < 0) gradient.addColorStop(0, coldcolor);
      ctx.fillStyle = barbgcolor;
      if (paintValue < 0) ctx.fillRect(left, top, drawWidth * overloadStop, drawHeight);
      if (paintValue < max) ctx.fillRect(left + drawWidth * overloadStop + 1, top, drawWidth * (1 - overloadStop) - 1, drawHeight);
      ctx.fillStyle = gradient;
      if (paintValue > min) {
        const distance = Math.max(0, _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"].getDistance({ type, max, min, enums, scale, value: Math.min(0, paintValue) }));
        ctx.fillRect(left, top, distance * drawWidth, drawHeight);
      }
      if (paintValue > 0) {
        const distance = Math.max(0, _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"].getDistance({ type, max, min, enums, scale, value: Math.min(max, paintValue) }) - overloadStop);
        ctx.fillRect(left + overloadStop * drawWidth + 1, top, distance * drawWidth - 1, drawHeight);
      }
      if (maxValue > paintValue) {
        if (maxValue <= 0) {
          const distance = Math.max(0, _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"].getDistance({ type, max, min, enums, scale, value: Math.min(0, maxValue) }));
          ctx.fillRect(left + distance * drawWidth - 1, top, 1, drawHeight);
        }
        if (maxValue > 0) {
          const distance = Math.max(0, _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"].getDistance({ type, max, min, enums, scale, value: Math.min(max, maxValue) }) - overloadStop);
          ctx.fillRect(left + Math.min(drawWidth - 1, (overloadStop + distance) * drawWidth), top, 1, drawHeight);
        }
      }
    };
  }
  paintLabel() {
    return super.paintLabel("left");
  }
}


/***/ }),

/***/ "./src/components/HSlider.ts":
/*!***********************************!*\
  !*** ./src/components/HSlider.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ HSlider)
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils */ "./src/components/utils.ts");
/* harmony import */ var _VSlider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./VSlider */ "./src/components/VSlider.ts");
/* harmony import */ var _HSlider_scss__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./HSlider.scss */ "./src/components/HSlider.scss");



class HSlider extends _VSlider__WEBPACK_IMPORTED_MODULE_1__["default"] {
  constructor() {
    super(...arguments);
    this.className = "hslider";
    this.setStyle = () => {
      const { height, grid, fontsize, textcolor, bgcolor, bordercolor } = this.state.style;
      this.input.style.fontSize = `${fontsize || height * grid * 0.2}px`;
      this.input.style.color = textcolor;
      this.container.style.backgroundColor = bgcolor;
      this.container.style.borderColor = bordercolor;
    };
    this.paint = () => {
      const { sliderwidth, sliderbgcolor, sliderbgoncolor, slidercolor } = this.state.style;
      const ctx = this.ctx;
      const canvas = this.canvas;
      const distance = this.distance;
      const ratio = window.devicePixelRatio || 1;
      let { width, height } = this.canvasDiv.getBoundingClientRect();
      width = Math.floor(width);
      height = Math.floor(height);
      const scaledWidth = Math.floor(width * ratio);
      const scaledHeight = Math.floor(height * ratio);
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.scale(ratio, ratio);
      const drawWidth = width * 0.9;
      const drawHeight = sliderwidth || Math.min(height / 3, drawWidth * 0.05);
      const left = width * 0.05;
      const top = (height - drawHeight) * 0.5;
      const borderRadius = drawHeight * 0.25;
      this.interactionRect = [left, 0, drawWidth, height];
      const grd = ctx.createLinearGradient(left, 0, left + drawWidth, 0);
      grd.addColorStop(Math.max(0, Math.min(1, distance)), sliderbgoncolor);
      grd.addColorStop(Math.max(0, Math.min(1, distance)), sliderbgcolor);
      ctx.fillStyle = grd;
      (0,_utils__WEBPACK_IMPORTED_MODULE_0__.fillRoundedRect)(ctx, left, top, drawWidth, drawHeight, borderRadius);
      ctx.fillStyle = slidercolor;
      (0,_utils__WEBPACK_IMPORTED_MODULE_0__.fillRoundedRect)(ctx, left + drawWidth * distance - drawHeight, top - drawHeight, drawHeight * 2, drawHeight * 3, borderRadius);
    };
  }
  paintLabel() {
    return super.paintLabel("left");
  }
}


/***/ }),

/***/ "./src/components/Knob.ts":
/*!********************************!*\
  !*** ./src/components/Knob.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Knob)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./src/components/utils.ts");
/* harmony import */ var _Knob_scss__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Knob.scss */ "./src/components/Knob.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));



class Knob extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "knob";
    this.handleChange = (e) => {
      const value = parseFloat(e.currentTarget.value);
      if (isFinite(value)) {
        const changed = this.setValue(+value);
        if (changed) return;
      }
      this.input.value = this.inputNumber.value + (this.state.unit || "");
    };
    this.setStyle = () => {
      const { fontsize, height, grid, textcolor, bgcolor, bordercolor } = this.state.style;
      this.input.style.fontSize = `${fontsize || height * grid * 0.1}px`;
      this.input.style.color = textcolor;
      this.container.style.backgroundColor = bgcolor;
      this.container.style.borderColor = bordercolor;
    };
    this.paint = () => {
      const { knobwidth, knobcolor, knoboncolor, needlecolor } = this.state.style;
      const ctx = this.ctx;
      const canvas = this.canvas;
      const distance = this.distance;
      const ratio = window.devicePixelRatio || 1;
      let { width, height } = this.canvas.getBoundingClientRect();
      width = Math.floor(width);
      height = Math.floor(height);
      const scaledWidth = Math.floor(width * ratio);
      const scaledHeight = Math.floor(height * ratio);
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.scale(ratio, ratio);
      const start = 5 / 8 * Math.PI;
      const end = 19 / 8 * Math.PI;
      const valPos = start + (0,_utils__WEBPACK_IMPORTED_MODULE_1__.toRad)(distance * 315);
      const dialHeight = Math.min(width, height) * 0.75;
      const dialRadius = dialHeight * 0.5;
      const dialCenterX = width * 0.5;
      const dialCenterY = height * 0.5;
      const valuePosX = dialCenterX + dialHeight * 0.5 * Math.cos(valPos);
      const valuePosY = dialCenterY + dialHeight * 0.5 * Math.sin(valPos);
      const lineWidth = knobwidth || dialRadius * 0.2;
      ctx.strokeStyle = knobcolor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(dialCenterX, dialCenterY, dialRadius, valPos, end);
      ctx.stroke();
      if (distance) {
        ctx.strokeStyle = knoboncolor;
        ctx.beginPath();
        ctx.arc(dialCenterX, dialCenterY, dialRadius, start, valPos);
        ctx.stroke();
      }
      ctx.strokeStyle = needlecolor;
      ctx.beginPath();
      ctx.moveTo(dialCenterX, dialCenterY);
      ctx.lineTo(valuePosX, valuePosY);
      ctx.stroke();
    };
    this.handleMouseOrTouchMove = (e) => {
      const newValue = this.getValueFromDelta(e);
      if (newValue !== this.state.value) this.setValue(newValue);
    };
  }
  static get defaultProps() {
    const inherited = super.defaultProps;
    return __spreadProps(__spreadValues({}, inherited), {
      style: __spreadProps(__spreadValues({}, inherited.style), {
        fontname: "Arial",
        fontsize: void 0,
        fontface: "regular",
        bgcolor: "rgba(18, 18, 18, 0)",
        bordercolor: "rgba(80, 80, 80, 0)",
        labelcolor: "rgba(226, 222, 255, 0.5)",
        textcolor: "rgba(18, 18, 18, 1)",
        knobwidth: void 0,
        knobcolor: "rgba(18, 18, 18, 1)",
        knoboncolor: "rgba(255, 165, 0, 1)",
        needlecolor: "rgba(200, 200, 200, 0.75)"
      })
    });
  }
  componentWillMount() {
    super.componentWillMount();
    this.canvas = document.createElement("canvas");
    this.canvas.width = 10;
    this.canvas.height = 10;
    this.ctx = this.canvas.getContext("2d");
    this.inputNumber = document.createElement("input");
    this.inputNumber.type = "number";
    this.inputNumber.value = (+this.state.value.toFixed(3)).toString();
    this.inputNumber.max = this.state.max.toString();
    this.inputNumber.min = this.state.min.toString();
    this.inputNumber.step = this.state.step.toString();
    this.input = document.createElement("input");
    this.input.value = this.inputNumber.value + (this.state.unit || "");
    this.input.spellcheck = false;
    this.setStyle();
    return this;
  }
  componentDidMount() {
    super.componentDidMount();
    this.input.addEventListener("change", this.handleChange);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("dblclick", this.handleDoubleClick);
    this.on("style", () => {
      this.schedule(this.setStyle);
      this.schedule(this.paint);
    });
    this.on("label", () => this.schedule(this.paintLabel));
    const valueChange = () => {
      this.inputNumber.value = (+this.state.value.toFixed(3)).toString();
      this.input.value = this.inputNumber.value + (this.state.unit || "");
    };
    this.on("value", () => {
      this.schedule(valueChange);
      this.schedule(this.paint);
    });
    const maxChange = () => this.inputNumber.max = this.state.max.toString();
    this.on("max", () => {
      this.schedule(maxChange);
      this.schedule(this.paint);
    });
    const minChange = () => this.inputNumber.min = this.state.min.toString();
    this.on("min", () => {
      this.schedule(minChange);
      this.schedule(this.paint);
    });
    const stepChange = () => this.inputNumber.step = this.state.step.toString();
    this.on("step", () => {
      this.schedule(stepChange);
      this.schedule(this.paint);
    });
    this.schedule(this.paint);
    return this;
  }
  mount() {
    this.container.appendChild(this.label);
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.input);
    return super.mount();
  }
  getValueFromDelta(e) {
    const { type, min, max, enums, scale } = this.state;
    const step = type === "enum" ? 1 : this.state.step || 1;
    const stepRange = this.stepRange;
    const stepsCount = this.stepsCount;
    const range = 100;
    const prevDistance = _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"].getDistance({ value: e.prevValue, type, min, max, enums, scale }) * range;
    const distance = prevDistance + e.fromY - e.y;
    const denormalized = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.denormalize)(distance / range, min, max);
    const v = scale === "exp" ? (0,_utils__WEBPACK_IMPORTED_MODULE_1__.normExp)(denormalized, min, max) : scale === "log" ? (0,_utils__WEBPACK_IMPORTED_MODULE_1__.normLog)(denormalized, min, max) : denormalized;
    let steps = Math.round((0,_utils__WEBPACK_IMPORTED_MODULE_1__.normalize)(v, min, max) * range / stepRange);
    steps = Math.min(stepsCount, Math.max(0, steps));
    if (type === "enum") return steps;
    if (type === "int") return Math.round(steps * step + min);
    return steps * step + min;
  }
}


/***/ }),

/***/ "./src/components/Led.ts":
/*!*******************************!*\
  !*** ./src/components/Led.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Led)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _Led_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Led.scss */ "./src/components/Led.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));


class Led extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "led";
    this.setStyle = () => {
      const { bgcolor, bordercolor } = this.state.style;
      this.container.style.backgroundColor = bgcolor;
      this.container.style.borderColor = bordercolor;
    };
    this.paint = () => {
      const { shape, ledbgcolor, coldcolor, warmcolor, hotcolor, overloadcolor } = this.state.style;
      const { min, max } = this.state;
      const { canvas, ctx, tempCanvas, tempCtx, distance } = this;
      const ratio = window.devicePixelRatio || 1;
      let { width, height } = canvas.getBoundingClientRect();
      width = Math.floor(width);
      height = Math.floor(height);
      const scaledWidth = Math.floor(width * ratio);
      const scaledHeight = Math.floor(height * ratio);
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.scale(ratio, ratio);
      const drawHeight = Math.min(height, width) * 0.75;
      const drawWidth = drawHeight;
      const left = (width - drawWidth) * 0.5;
      const top = (height - drawHeight) * 0.5;
      const coldStop = (-18 - min) / (max - min);
      const warmStop = (-6 - min) / (max - min);
      const hotStop = (-3 - min) / (max - min);
      const overloadStop = -min / (max - min);
      const gradient = tempCtx.createLinearGradient(0, 0, tempCanvas.width, 0);
      if (coldStop <= 1 && coldStop >= 0) gradient.addColorStop(coldStop, coldcolor);
      else if (coldStop > 1) gradient.addColorStop(1, coldcolor);
      if (warmStop <= 1 && warmStop >= 0) gradient.addColorStop(warmStop, warmcolor);
      if (hotStop <= 1 && hotStop >= 0) gradient.addColorStop(hotStop, hotcolor);
      if (overloadStop <= 1 && overloadStop >= 0) gradient.addColorStop(overloadStop, overloadcolor);
      else if (overloadStop < 0) gradient.addColorStop(0, coldcolor);
      tempCtx.fillStyle = gradient;
      tempCtx.fillRect(0, 0, tempCanvas.width, 10);
      const d = tempCtx.getImageData(Math.min(tempCanvas.width - 1, distance * tempCanvas.width), 0, 1, 1).data;
      if (distance) ctx.fillStyle = `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
      else ctx.fillStyle = ledbgcolor;
      if (shape === "circle") ctx.arc(width / 2, height / 2, width / 2 - left, 0, 2 * Math.PI);
      else ctx.rect(left, top, drawWidth, drawHeight);
      ctx.fill();
    };
  }
  static get defaultProps() {
    const inherited = super.defaultProps;
    return __spreadProps(__spreadValues({}, inherited), {
      style: __spreadProps(__spreadValues({}, inherited.style), {
        fontname: "Arial",
        fontsize: void 0,
        fontface: "regular",
        bgcolor: "rgba(18, 18, 18, 0)",
        bordercolor: "rgba(80, 80, 80, 0)",
        labelcolor: "rgba(226, 222, 255, 0.5)",
        textcolor: "rgba(18, 18, 18, 1)",
        shape: "circle",
        ledbgcolor: "rgba(18, 18, 18, 1)",
        coldcolor: "rgba(12, 248, 100, 1)",
        warmcolor: "rgba(195, 248, 100, 1)",
        hotcolor: "rgba(255, 193, 10, 1)",
        overloadcolor: "rgba(255, 10, 10, 1)"
      })
    });
  }
  componentWillMount() {
    super.componentWillMount();
    this.canvasDiv = document.createElement("div");
    this.canvasDiv.className = `faust-ui-component-${this.className}-canvasdiv`;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 10;
    this.canvas.height = 10;
    this.ctx = this.canvas.getContext("2d");
    this.tempCanvas = document.createElement("canvas");
    this.tempCtx = this.tempCanvas.getContext("2d");
    this.tempCanvas.width = 128;
    this.tempCanvas.height = 1;
    this.setStyle();
    return this;
  }
  componentDidMount() {
    super.componentDidMount();
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.on("style", () => this.schedule(this.setStyle));
    this.on("label", () => this.schedule(this.paintLabel));
    this.on("value", () => this.schedule(this.paint));
    this.on("max", () => this.schedule(this.paint));
    this.on("min", () => this.schedule(this.paint));
    this.on("step", () => this.schedule(this.paint));
    this.schedule(this.paint);
    return this;
  }
  mount() {
    this.canvasDiv.appendChild(this.canvas);
    this.container.appendChild(this.label);
    this.container.appendChild(this.canvasDiv);
    return super.mount();
  }
}


/***/ }),

/***/ "./src/components/Menu.ts":
/*!********************************!*\
  !*** ./src/components/Menu.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Menu)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _Menu_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Menu.scss */ "./src/components/Menu.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));


class Menu extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "menu";
    this.handleChange = (e) => {
      this.setValue(+e.currentTarget.value);
    };
    this.setStyle = () => {
      const { height, grid, fontsize, textcolor, bgcolor, bordercolor } = this.state.style;
      this.select.style.backgroundColor = bgcolor;
      this.select.style.borderColor = bordercolor;
      this.select.style.color = textcolor;
      this.select.style.fontSize = `${fontsize || height * grid / 4}px`;
    };
  }
  static get defaultProps() {
    const inherited = super.defaultProps;
    return __spreadProps(__spreadValues({}, inherited), {
      style: __spreadProps(__spreadValues({}, inherited.style), {
        fontname: "Arial",
        fontsize: void 0,
        fontface: "regular",
        bgcolor: "rgba(255, 255, 255, 0.25)",
        bordercolor: "rgba(80, 80, 80, 0)",
        labelcolor: "rgba(226, 222, 255, 0.5)",
        textcolor: "rgba(18, 18, 18, 1)"
      })
    });
  }
  componentWillMount() {
    super.componentWillMount();
    this.select = document.createElement("select");
    this.getOptions();
    this.setStyle();
    return this;
  }
  getOptions() {
    const { enums } = this.state;
    this.select.innerHTML = "";
    if (enums) {
      let i = 0;
      for (const key in enums) {
        const option = document.createElement("option");
        option.value = enums[key].toString();
        option.text = key;
        if (i === 0) option.selected = true;
        this.select.appendChild(option);
        i++;
      }
    }
  }
  componentDidMount() {
    super.componentDidMount();
    this.select.addEventListener("change", this.handleChange);
    this.on("style", () => this.schedule(this.setStyle));
    this.on("label", () => this.schedule(this.paintLabel));
    this.on("enums", () => this.schedule(this.getOptions));
    const valueChange = () => {
      for (let i = this.select.children.length - 1; i >= 0; i--) {
        const option = this.select.children[i];
        if (+option.value === this.state.value) this.select.selectedIndex = i;
      }
    };
    this.on("value", () => this.schedule(valueChange));
    valueChange();
    return this;
  }
  mount() {
    this.container.appendChild(this.label);
    this.container.appendChild(this.select);
    return super.mount();
  }
}


/***/ }),

/***/ "./src/components/Nentry.ts":
/*!**********************************!*\
  !*** ./src/components/Nentry.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Nentry)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _Nentry_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Nentry.scss */ "./src/components/Nentry.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));


class Nentry extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "nentry";
    this.handleChange = (e) => {
      this.setValue(+e.currentTarget.value);
    };
    this.setStyle = () => {
      const { height, grid, fontsize, textcolor, bgcolor, bordercolor } = this.state.style;
      this.input.style.backgroundColor = bgcolor;
      this.input.style.borderColor = bordercolor;
      this.input.style.color = textcolor;
      this.input.style.fontSize = `${fontsize || height * grid / 4}px`;
    };
  }
  static get defaultProps() {
    const inherited = super.defaultProps;
    return __spreadProps(__spreadValues({}, inherited), {
      style: __spreadProps(__spreadValues({}, inherited.style), {
        fontname: "Arial",
        fontsize: void 0,
        fontface: "regular",
        bgcolor: "rgba(255, 255, 255, 0.25)",
        bordercolor: "rgba(80, 80, 80, 0)",
        labelcolor: "rgba(226, 222, 255, 0.5)",
        textcolor: "rgba(18, 18, 18, 1)"
      })
    });
  }
  componentWillMount() {
    super.componentWillMount();
    this.input = document.createElement("input");
    this.input.type = "number";
    this.input.value = (+this.state.value.toFixed(3)).toString();
    this.input.max = this.state.max.toString();
    this.input.min = this.state.min.toString();
    this.input.step = this.state.step.toString();
    this.setStyle();
    return this;
  }
  componentDidMount() {
    super.componentDidMount();
    this.input.addEventListener("change", this.handleChange);
    this.on("style", () => this.schedule(this.setStyle));
    this.on("label", () => this.schedule(this.paintLabel));
    const valueChange = () => this.input.value = (+this.state.value.toFixed(3)).toString();
    this.on("value", () => this.schedule(valueChange));
    const maxChange = () => this.input.max = this.state.max.toString();
    this.on("max", () => this.schedule(maxChange));
    const minChange = () => this.input.min = this.state.min.toString();
    this.on("min", () => this.schedule(minChange));
    const stepChange = () => this.input.step = this.state.step.toString();
    this.on("step", () => this.schedule(stepChange));
    return this;
  }
  mount() {
    this.container.appendChild(this.label);
    this.container.appendChild(this.input);
    return super.mount();
  }
}


/***/ }),

/***/ "./src/components/Numerical.ts":
/*!*************************************!*\
  !*** ./src/components/Numerical.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Numerical)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _Numerical_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Numerical.scss */ "./src/components/Numerical.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));


class Numerical extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "numerical";
    this.setStyle = () => {
      const { height, grid, fontsize, textcolor, bgcolor, bordercolor } = this.state.style;
      this.input.style.backgroundColor = bgcolor;
      this.input.style.borderColor = bordercolor;
      this.input.style.color = textcolor;
      this.input.style.fontSize = `${fontsize || height * grid / 4}px`;
    };
  }
  static get defaultProps() {
    const inherited = super.defaultProps;
    return __spreadProps(__spreadValues({}, inherited), {
      style: __spreadProps(__spreadValues({}, inherited.style), {
        fontname: "Arial",
        fontsize: void 0,
        fontface: "regular",
        bgcolor: "rgba(255, 255, 255, 0.25)",
        bordercolor: "rgba(80, 80, 80, 0)",
        labelcolor: "rgba(226, 222, 255, 0.5)",
        textcolor: "rgba(18, 18, 18, 1)"
      })
    });
  }
  componentWillMount() {
    super.componentWillMount();
    this.input = document.createElement("input");
    this.input.disabled = true;
    this.input.value = (+this.state.value.toFixed(3)).toString() + (this.state.unit || "");
    this.setStyle();
    return this;
  }
  componentDidMount() {
    super.componentDidMount();
    this.on("style", () => this.schedule(this.setStyle));
    this.on("label", () => this.schedule(this.paintLabel));
    const valueChange = () => this.input.value = (+this.state.value.toFixed(3)).toString() + (this.state.unit || "");
    this.on("value", () => this.schedule(valueChange));
    return this;
  }
  mount() {
    this.container.appendChild(this.label);
    this.container.appendChild(this.input);
    return super.mount();
  }
}


/***/ }),

/***/ "./src/components/Radio.ts":
/*!*********************************!*\
  !*** ./src/components/Radio.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Radio)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _Radio_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Radio.scss */ "./src/components/Radio.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));


class Radio extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "radio";
    this.getOptions = () => {
      const { enums, address } = this.state;
      this.group.innerHTML = "";
      if (enums) {
        let i = 0;
        for (const key in enums) {
          const input = document.createElement("input");
          const div = document.createElement("div");
          input.value = enums[key].toString();
          input.name = address;
          input.type = "radio";
          if (i === 0) input.checked = true;
          input.addEventListener("change", () => {
            if (input.checked) this.setValue(enums[key]);
          });
          div.appendChild(input);
          div.append(key);
          this.group.appendChild(div);
          i++;
        }
      }
    };
    this.setStyle = () => {
      const { height, width, grid, fontsize, textcolor, bgcolor, bordercolor } = this.state.style;
      const fontSize = Math.min(height * grid * 0.1, width * grid * 0.1);
      this.group.style.backgroundColor = bgcolor;
      this.group.style.borderColor = bordercolor;
      this.group.style.color = textcolor;
      this.group.style.fontSize = `${fontsize || fontSize}px`;
    };
  }
  static get defaultProps() {
    const inherited = super.defaultProps;
    return __spreadProps(__spreadValues({}, inherited), {
      style: __spreadProps(__spreadValues({}, inherited.style), {
        fontname: "Arial",
        fontsize: void 0,
        fontface: "regular",
        bgcolor: "rgba(255, 255, 255, 0.25)",
        bordercolor: "rgba(80, 80, 80, 0)",
        labelcolor: "rgba(226, 222, 255, 0.5)",
        textcolor: "rgba(18, 18, 18, 1)"
      })
    });
  }
  componentWillMount() {
    super.componentWillMount();
    this.group = document.createElement("div");
    this.group.className = "faust-ui-component-radio-group";
    this.getOptions();
    this.setStyle();
    return this;
  }
  componentDidMount() {
    super.componentDidMount();
    this.on("style", () => this.schedule(this.setStyle));
    this.on("label", () => this.schedule(this.paintLabel));
    this.on("enums", () => this.schedule(this.getOptions));
    const valueChange = () => {
      for (let i = this.group.children.length - 1; i >= 0; i--) {
        const input = this.group.children[i].querySelector("input");
        if (+input.value === this.state.value) input.checked = true;
      }
    };
    this.on("value", () => this.schedule(valueChange));
    valueChange();
    return this;
  }
  mount() {
    this.container.appendChild(this.label);
    this.container.appendChild(this.group);
    return super.mount();
  }
}


/***/ }),

/***/ "./src/components/Soundfile.ts":
/*!*************************************!*\
  !*** ./src/components/Soundfile.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Soundfile)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _Soundfile_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Soundfile.scss */ "./src/components/Soundfile.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));


class Soundfile extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "soundfile";
    this.setStyle = () => {
      const { value, style } = this.state;
      const { height, grid, fontsize, fontname, fontface, textcolor, textoncolor, bgoncolor, bgcolor, bordercolor, borderoncolor } = style;
      this.btn.style.backgroundColor = value ? bgoncolor : bgcolor;
      this.btn.style.borderColor = value ? borderoncolor : bordercolor;
      this.btn.style.color = value ? textoncolor : textcolor;
      this.btn.style.fontSize = `${fontsize || height * grid / 4}px`;
      this.btn.style.fontFamily = `${fontname}, sans-serif`;
      this.btn.style.fontStyle = fontface;
    };
    this.handleMouseOrTouchDown = () => {
    };
    this.handleMouseOrTouchUp = () => {
    };
  }
  static get defaultProps() {
    const inherited = super.defaultProps;
    return __spreadProps(__spreadValues({}, inherited), {
      style: __spreadProps(__spreadValues({}, inherited.style), {
        fontname: "Arial",
        fontsize: void 0,
        fontface: "normal",
        bgcolor: "rgba(40, 40, 40, 1)",
        bgoncolor: "rgba(18, 18, 18, 1)",
        bordercolor: "rgba(80, 80, 80, 1)",
        borderoncolor: "rgba(255, 165, 0, 1)",
        textcolor: "rgba(226, 222, 255, 0.5)",
        textoncolor: "rgba(255, 165, 0, 1)"
      })
    });
  }
  componentWillMount() {
    super.componentWillMount();
    this.btn = document.createElement("div");
    this.span = document.createElement("span");
    this.span.innerText = this.state.label;
    this.setStyle();
    return this;
  }
  mount() {
    this.btn.appendChild(this.span);
    this.container.appendChild(this.btn);
    return super.mount();
  }
  componentDidMount() {
    super.componentDidMount();
    this.btn.addEventListener("pointerdown", this.handlePointerDown);
    this.on("style", () => this.schedule(this.setStyle));
    const labelChange = () => this.span.innerText = this.state.label;
    this.on("label", () => this.schedule(labelChange));
    this.on("value", () => this.schedule(this.setStyle));
    return this;
  }
}


/***/ }),

/***/ "./src/components/VBargraph.ts":
/*!*************************************!*\
  !*** ./src/components/VBargraph.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VBargraph)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _VBargraph_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./VBargraph.scss */ "./src/components/VBargraph.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));


class VBargraph extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "vbargraph";
    this.setStyle = () => {
      const { height, width, grid, fontsize, textcolor, bgcolor, bordercolor } = this.state.style;
      const fontSize = Math.min(height * grid * 0.05, width * grid * 0.2);
      this.input.style.fontSize = `${fontsize || fontSize}px`;
      this.input.style.color = textcolor;
      this.container.style.backgroundColor = bgcolor;
      this.container.style.borderColor = bordercolor;
    };
    this.paintValue = 0;
    this.maxValue = -Infinity;
    this.paint = () => {
      const { barwidth, barbgcolor, coldcolor, warmcolor, hotcolor, overloadcolor } = this.state.style;
      const { type, max, min, enums, scale, value } = this.state;
      const ctx = this.ctx;
      const canvas = this.canvas;
      const ratio = window.devicePixelRatio || 1;
      let { width, height } = this.canvasDiv.getBoundingClientRect();
      width = Math.floor(width);
      height = Math.floor(height);
      const scaledWidth = Math.floor(width * ratio);
      const scaledHeight = Math.floor(height * ratio);
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.scale(ratio, ratio);
      const drawHeight = height * 0.9;
      const drawWidth = barwidth || Math.min(width / 3, drawHeight * 0.05);
      const left = (width - drawWidth) * 0.5;
      const top = height * 0.05;
      this.paintValue = value;
      const paintValue = this.paintValue;
      if (paintValue > this.maxValue) {
        this.maxValue = paintValue;
        if (this.maxTimer) window.clearTimeout(this.maxTimer);
        this.maxTimer = window.setTimeout(() => {
          this.maxValue = this.paintValue;
          this.maxTimer = void 0;
          this.schedule(this.paint);
        }, 1e3);
      }
      if (paintValue < this.maxValue && typeof this.maxTimer === "undefined") {
        this.maxTimer = window.setTimeout(() => {
          this.maxValue = this.paintValue;
          this.maxTimer = void 0;
          this.schedule(this.paint);
        }, 1e3);
      }
      const maxValue = this.maxValue;
      const coldStop = (-18 - min) / (max - min);
      const warmStop = (-6 - min) / (max - min);
      const hotStop = (-3 - min) / (max - min);
      const overloadStop = Math.max(0, -min / (max - min));
      const gradient = ctx.createLinearGradient(0, drawHeight, 0, top);
      if (coldStop <= 1 && coldStop >= 0) gradient.addColorStop(coldStop, coldcolor);
      else if (coldStop > 1) gradient.addColorStop(1, coldcolor);
      if (warmStop <= 1 && warmStop >= 0) gradient.addColorStop(warmStop, warmcolor);
      if (hotStop <= 1 && hotStop >= 0) gradient.addColorStop(hotStop, hotcolor);
      if (overloadStop <= 1 && overloadStop >= 0) gradient.addColorStop(overloadStop, overloadcolor);
      else if (overloadStop < 0) gradient.addColorStop(0, coldcolor);
      ctx.fillStyle = barbgcolor;
      if (paintValue < 0) ctx.fillRect(left, top + (1 - overloadStop) * drawHeight, drawWidth, drawHeight * overloadStop);
      if (paintValue < max) ctx.fillRect(left, top, drawWidth, (1 - overloadStop) * drawHeight - 1);
      ctx.fillStyle = gradient;
      if (paintValue > min) {
        const distance = Math.max(0, _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"].getDistance({ type, max, min, enums, scale, value: Math.min(0, paintValue) }));
        ctx.fillRect(left, top + (1 - distance) * drawHeight, drawWidth, drawHeight * distance);
      }
      if (paintValue > 0) {
        const distance = Math.max(0, _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"].getDistance({ type, max, min, enums, scale, value: Math.min(max, paintValue) }) - overloadStop);
        ctx.fillRect(left, top + (1 - overloadStop - distance) * drawHeight, drawWidth, drawHeight * distance - 1);
      }
      if (maxValue > paintValue) {
        if (maxValue <= 0) {
          const distance = Math.max(0, _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"].getDistance({ type, max, min, enums, scale, value: Math.min(0, maxValue) }));
          ctx.fillRect(left, top + (1 - distance) * drawHeight, drawWidth, 1);
        }
        if (maxValue > 0) {
          const distance = Math.max(0, _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"].getDistance({ type, max, min, enums, scale, value: Math.min(max, maxValue) }) - overloadStop);
          ctx.fillRect(left, Math.max(top, top + (1 - overloadStop - distance) * drawHeight - 1), drawWidth, 1);
        }
      }
    };
  }
  static get defaultProps() {
    const inherited = super.defaultProps;
    return __spreadProps(__spreadValues({}, inherited), {
      style: __spreadProps(__spreadValues({}, inherited.style), {
        fontname: "Arial",
        fontsize: void 0,
        fontface: "regular",
        bgcolor: "rgba(18, 18, 18, 0)",
        bordercolor: "rgba(80, 80, 80, 0)",
        labelcolor: "rgba(226, 222, 255, 0.5)",
        textcolor: "rgba(18, 18, 18, 1)",
        barwidth: void 0,
        barbgcolor: "rgba(18, 18, 18, 1)",
        coldcolor: "rgba(12, 248, 100, 1)",
        warmcolor: "rgba(195, 248, 100, 1)",
        hotcolor: "rgba(255, 193, 10, 1)",
        overloadcolor: "rgba(255, 10, 10, 1)"
      })
    });
  }
  componentWillMount() {
    super.componentWillMount();
    this.flexDiv = document.createElement("div");
    this.flexDiv.className = `faust-ui-component-${this.className}-flexdiv`;
    this.canvasDiv = document.createElement("div");
    this.canvasDiv.className = `faust-ui-component-${this.className}-canvasdiv`;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 10;
    this.canvas.height = 10;
    this.ctx = this.canvas.getContext("2d");
    this.input = document.createElement("input");
    this.input.disabled = true;
    this.input.value = (+this.state.value.toFixed(3)).toString() + (this.state.unit || "");
    this.setStyle();
    return this;
  }
  componentDidMount() {
    super.componentDidMount();
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.on("style", () => {
      this.schedule(this.setStyle);
      this.schedule(this.paint);
    });
    this.on("label", () => this.schedule(this.paintLabel));
    const valueChange = () => this.input.value = (+this.state.value.toFixed(3)).toString() + (this.state.unit || "");
    this.on("value", () => {
      this.schedule(valueChange);
      this.schedule(this.paint);
    });
    this.on("max", () => this.schedule(this.paint));
    this.on("min", () => this.schedule(this.paint));
    this.on("step", () => this.schedule(this.paint));
    this.schedule(this.paint);
    return this;
  }
  mount() {
    this.canvasDiv.appendChild(this.canvas);
    this.flexDiv.appendChild(this.canvasDiv);
    this.flexDiv.appendChild(this.input);
    this.container.appendChild(this.label);
    this.container.appendChild(this.flexDiv);
    return super.mount();
  }
}


/***/ }),

/***/ "./src/components/VSlider.ts":
/*!***********************************!*\
  !*** ./src/components/VSlider.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VSlider)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/components/AbstractItem.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./src/components/utils.ts");
/* harmony import */ var _VSlider_scss__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./VSlider.scss */ "./src/components/VSlider.scss");
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));



class VSlider extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.className = "vslider";
    this.interactionRect = [0, 0, 0, 0];
    this.handleChange = (e) => {
      const value = parseFloat(e.currentTarget.value);
      if (isFinite(value)) {
        const changed = this.setValue(+value);
        if (changed) return;
      }
      this.input.value = this.inputNumber.value + (this.state.unit || "");
    };
    this.setStyle = () => {
      const { height, width, grid, fontsize, textcolor, bgcolor, bordercolor } = this.state.style;
      const fontSize = Math.min(height * grid * 0.05, width * grid * 0.2);
      this.input.style.fontSize = `${fontsize || fontSize}px`;
      this.input.style.color = textcolor;
      this.container.style.backgroundColor = bgcolor;
      this.container.style.borderColor = bordercolor;
    };
    this.paint = () => {
      const { sliderwidth, sliderbgcolor, sliderbgoncolor, slidercolor } = this.state.style;
      const ctx = this.ctx;
      const canvas = this.canvas;
      const distance = this.distance;
      const ratio = window.devicePixelRatio || 1;
      let { width, height } = this.canvasDiv.getBoundingClientRect();
      width = Math.floor(width);
      height = Math.floor(height);
      const scaledWidth = Math.floor(width * ratio);
      const scaledHeight = Math.floor(height * ratio);
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.scale(ratio, ratio);
      const drawHeight = height * 0.9;
      const drawWidth = sliderwidth || Math.min(width / 3, drawHeight * 0.05);
      const left = (width - drawWidth) * 0.5;
      const top = height * 0.05;
      const borderRadius = drawWidth * 0.25;
      this.interactionRect = [0, top, width, drawHeight];
      const grd = ctx.createLinearGradient(0, top, 0, top + drawHeight);
      grd.addColorStop(Math.max(0, Math.min(1, 1 - distance)), sliderbgcolor);
      grd.addColorStop(Math.max(0, Math.min(1, 1 - distance)), sliderbgoncolor);
      ctx.fillStyle = grd;
      (0,_utils__WEBPACK_IMPORTED_MODULE_1__.fillRoundedRect)(ctx, left, top, drawWidth, drawHeight, borderRadius);
      ctx.fillStyle = slidercolor;
      (0,_utils__WEBPACK_IMPORTED_MODULE_1__.fillRoundedRect)(ctx, left - drawWidth, top + drawHeight * (1 - distance) - drawWidth, drawWidth * 3, drawWidth * 2, borderRadius);
    };
    this.handleMouseOrTouchDown = (e) => {
      const { value } = this.state;
      if (e.x < this.interactionRect[0] || e.x > this.interactionRect[0] + this.interactionRect[2] || e.y < this.interactionRect[1] || e.y > this.interactionRect[1] + this.interactionRect[3]) return;
      const newValue = this.getValueFromPos(e);
      if (newValue !== value) this.setValue(this.getValueFromPos(e));
    };
    this.handleMouseOrTouchMove = (e) => {
      const newValue = this.getValueFromPos(e);
      if (newValue !== this.state.value) this.setValue(newValue);
    };
  }
  static get defaultProps() {
    const inherited = super.defaultProps;
    return __spreadProps(__spreadValues({}, inherited), {
      style: __spreadProps(__spreadValues({}, inherited.style), {
        fontname: "Arial",
        fontsize: void 0,
        fontface: "regular",
        bgcolor: "rgba(18, 18, 18, 0)",
        bordercolor: "rgba(80, 80, 80, 0)",
        labelcolor: "rgba(226, 222, 255, 0.5)",
        textcolor: "rgba(18, 18, 18, 1)",
        sliderwidth: void 0,
        sliderbgcolor: "rgba(18, 18, 18, 1)",
        sliderbgoncolor: "rgba(255, 165, 0, 1)",
        slidercolor: "rgba(200, 200, 200, 0.75)"
      })
    });
  }
  componentWillMount() {
    super.componentWillMount();
    this.flexDiv = document.createElement("div");
    this.flexDiv.className = `faust-ui-component-${this.className}-flexdiv`;
    this.canvasDiv = document.createElement("div");
    this.canvasDiv.className = `faust-ui-component-${this.className}-canvasdiv`;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 10;
    this.canvas.height = 10;
    this.ctx = this.canvas.getContext("2d");
    this.inputNumber = document.createElement("input");
    this.inputNumber.type = "number";
    this.inputNumber.value = (+this.state.value.toFixed(3)).toString();
    this.inputNumber.max = this.state.max.toString();
    this.inputNumber.min = this.state.min.toString();
    this.inputNumber.step = this.state.step.toString();
    this.input = document.createElement("input");
    this.input.value = this.inputNumber.value + (this.state.unit || "");
    this.input.spellcheck = false;
    this.setStyle();
    return this;
  }
  componentDidMount() {
    super.componentDidMount();
    this.input.addEventListener("change", this.handleChange);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("dblclick", this.handleDoubleClick);
    this.on("style", () => {
      this.schedule(this.setStyle);
      this.schedule(this.paint);
    });
    this.on("label", () => this.schedule(this.paintLabel));
    const valueChange = () => {
      this.inputNumber.value = (+this.state.value.toFixed(3)).toString();
      this.input.value = this.inputNumber.value + (this.state.unit || "");
    };
    this.on("value", () => {
      this.schedule(valueChange);
      this.schedule(this.paint);
    });
    const maxChange = () => this.inputNumber.max = this.state.max.toString();
    this.on("max", () => {
      this.schedule(maxChange);
      this.schedule(this.paint);
    });
    const minChange = () => this.inputNumber.min = this.state.min.toString();
    this.on("min", () => {
      this.schedule(minChange);
      this.schedule(this.paint);
    });
    const stepChange = () => this.inputNumber.step = this.state.step.toString();
    this.on("step", () => {
      this.schedule(stepChange);
      this.schedule(this.paint);
    });
    this.schedule(this.paint);
    return this;
  }
  mount() {
    this.canvasDiv.appendChild(this.canvas);
    this.flexDiv.appendChild(this.canvasDiv);
    this.flexDiv.appendChild(this.input);
    this.container.appendChild(this.label);
    this.container.appendChild(this.flexDiv);
    return super.mount();
  }
  get stepsCount() {
    const { type, max, min, step, enums } = this.state;
    const maxSteps = type === "enum" ? enums.length : type === "int" ? max - min : (max - min) / step;
    if (step) {
      if (type === "enum") return enums.length;
      if (type === "int") return Math.min(Math.floor((max - min) / (Math.round(step) || 0)), maxSteps);
      return Math.floor((max - min) / step);
    }
    return maxSteps;
  }
  get stepRange() {
    const full = this.interactionRect[this.className === "vslider" ? 3 : 2];
    const stepsCount = this.stepsCount;
    return full / stepsCount;
  }
  getValueFromPos(e) {
    const { type, min, max, scale } = this.state;
    const step = type === "enum" ? 1 : this.state.step || 1;
    const stepRange = this.stepRange;
    const stepsCount = this.stepsCount;
    const distance = this.className === "vslider" ? this.interactionRect[3] - (e.y - this.interactionRect[1]) : e.x - this.interactionRect[0];
    const range = this.className === "vslider" ? this.interactionRect[3] : this.interactionRect[2];
    const denormalized = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.denormalize)(distance / range, min, max);
    const v = scale === "exp" ? (0,_utils__WEBPACK_IMPORTED_MODULE_1__.normExp)(denormalized, min, max) : scale === "log" ? (0,_utils__WEBPACK_IMPORTED_MODULE_1__.normLog)(denormalized, min, max) : denormalized;
    let steps = Math.round((0,_utils__WEBPACK_IMPORTED_MODULE_1__.normalize)(v, min, max) * range / stepRange);
    steps = Math.min(stepsCount, Math.max(0, steps));
    if (type === "enum") return steps;
    if (type === "int") return Math.round(steps * step + min);
    return steps * step + min;
  }
}


/***/ }),

/***/ "./src/components/utils.ts":
/*!*********************************!*\
  !*** ./src/components/utils.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   atodb: () => (/* binding */ atodb),
/* harmony export */   dbtoa: () => (/* binding */ dbtoa),
/* harmony export */   denormalize: () => (/* binding */ denormalize),
/* harmony export */   fillRoundedRect: () => (/* binding */ fillRoundedRect),
/* harmony export */   iNormExp: () => (/* binding */ iNormExp),
/* harmony export */   iNormLog: () => (/* binding */ iNormLog),
/* harmony export */   normExp: () => (/* binding */ normExp),
/* harmony export */   normLog: () => (/* binding */ normLog),
/* harmony export */   normalize: () => (/* binding */ normalize),
/* harmony export */   roundedRect: () => (/* binding */ roundedRect),
/* harmony export */   toMIDI: () => (/* binding */ toMIDI),
/* harmony export */   toRad: () => (/* binding */ toRad)
/* harmony export */ });
const toMIDI = (f) => ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][(f % 12 + 12) % 12] + Math.round(f / 12 - 2);
const toRad = (degrees) => degrees * Math.PI / 180;
const atodb = (a) => 20 * Math.log10(a);
const dbtoa = (db) => 10 ** (db / 20);
const denormalize = (x, min, max) => min + (max - min) * x;
const normalize = (x, min, max) => (x - min) / (max - min) || 0;
const normLog = (x, min, max) => {
  const normalized = normalize(x, min, max);
  const logMin = Math.log(Math.max(Number.EPSILON, min));
  const logMax = Math.log(Math.max(Number.EPSILON, max));
  const vLog = denormalize(normalized, logMin, logMax);
  const v = Math.exp(vLog);
  return Math.max(min, Math.min(max, v));
};
const iNormLog = (vIn, min, max) => {
  const v = Math.max(min, Math.min(max, vIn));
  const vLog = Math.log(Math.max(Number.EPSILON, v));
  const logMin = Math.log(Math.max(Number.EPSILON, min));
  const logMax = Math.log(Math.max(Number.EPSILON, max));
  const normalized = normalize(vLog, logMin, logMax);
  return denormalize(normalized, min, max);
};
const normExp = iNormLog;
const iNormExp = normLog;
const roundedRect = (ctx, x, y, width, height, radius) => {
  const radii = [0, 0, 0, 0];
  if (typeof radius === "number") radii.fill(radius);
  else radius.forEach((v, i) => radii[i] = v);
  ctx.beginPath();
  ctx.moveTo(x + radii[0], y);
  ctx.lineTo(x + width - radii[1], y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radii[1]);
  ctx.lineTo(x + width, y + height - radii[2]);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radii[2], y + height);
  ctx.lineTo(x + radii[3], y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radii[3]);
  ctx.lineTo(x, y + radii[0]);
  ctx.quadraticCurveTo(x, y, x + radii[0], y);
  ctx.closePath();
  ctx.stroke();
};
const fillRoundedRect = (ctx, x, y, width, height, radius) => {
  const radii = [0, 0, 0, 0];
  if (typeof radius === "number") radii.fill(radius);
  else radius.forEach((v, i) => radii[i] = v);
  ctx.beginPath();
  ctx.moveTo(x + radii[0], y);
  ctx.lineTo(x + width - radii[1], y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radii[1]);
  ctx.lineTo(x + width, y + height - radii[2]);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radii[2], y + height);
  ctx.lineTo(x + radii[3], y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radii[3]);
  ctx.lineTo(x, y + radii[0]);
  ctx.quadraticCurveTo(x, y, x + radii[0], y);
  ctx.closePath();
  ctx.fill();
};


/***/ }),

/***/ "./src/instantiate.ts":
/*!****************************!*\
  !*** ./src/instantiate.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _FaustUI__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./FaustUI */ "./src/FaustUI.ts");

const instantiate = () => {
  const faustUI = new _FaustUI__WEBPACK_IMPORTED_MODULE_0__["default"]({
    root: document.getElementById("root"),
    listenWindowResize: true,
    listenWindowMessage: true
  });
  let host;
  window.addEventListener("message", (e) => {
    const { data, source } = e;
    if (!data) return;
    const { type } = data;
    if (!type) return;
    host = source;
  });
  window.addEventListener("keydown", (e) => {
    if (host) host.postMessage({ type: "keydown", key: e.key }, "*");
  });
  window.addEventListener("keyup", (e) => {
    if (host) host.postMessage({ type: "keyup", key: e.key }, "*");
  });
  window.faustUI = faustUI;
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (instantiate);


/***/ }),

/***/ "./src/layout/AbstractGroup.ts":
/*!*************************************!*\
  !*** ./src/layout/AbstractGroup.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AbstractGroup)
/* harmony export */ });
const _AbstractGroup = class _AbstractGroup {
  constructor(group, isRoot) {
    this.isRoot = !!isRoot;
    Object.assign(this, group);
    const { hasHSizingDesc, hasVSizingDesc } = this;
    const sizing = hasHSizingDesc && hasVSizingDesc ? "both" : hasHSizingDesc ? "horizontal" : hasVSizingDesc ? "vertical" : "none";
    this.layout = {
      type: group.type,
      width: _AbstractGroup.padding * 2,
      height: _AbstractGroup.padding * 2 + (this.isRoot ? 0 : _AbstractGroup.labelHeight),
      sizing
    };
  }
  /**
   * find recursively if the group has horizontal-sizable item
   */
  get hasHSizingDesc() {
    return !!this.items.find((item) => {
      if (item instanceof _AbstractGroup) return item.hasHSizingDesc;
      return item.layout.sizing === "horizontal" || item.layout.sizing === "both";
    });
  }
  /**
   * find recursively if the group has vertical-sizable item
   */
  get hasVSizingDesc() {
    return !!this.items.find((item) => {
      if (item instanceof _AbstractGroup) return item.hasVSizingDesc;
      return item.layout.sizing === "vertical" || item.layout.sizing === "both";
    });
  }
  adjust() {
    return this;
  }
  expand(dX, dY) {
    return this;
  }
  offset() {
    return this;
  }
};
_AbstractGroup.padding = 0.2;
_AbstractGroup.labelHeight = 0.25;
_AbstractGroup.spaceBetween = 0.1;
let AbstractGroup = _AbstractGroup;



/***/ }),

/***/ "./src/layout/AbstractInputItem.ts":
/*!*****************************************!*\
  !*** ./src/layout/AbstractInputItem.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AbstractInputItem)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/layout/AbstractItem.ts");

class AbstractInputItem extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor(item) {
    super(item);
    this.init = +item.init || 0;
    this.step = +item.step || 1;
  }
}


/***/ }),

/***/ "./src/layout/AbstractItem.ts":
/*!************************************!*\
  !*** ./src/layout/AbstractItem.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AbstractItem)
/* harmony export */ });
class AbstractItem {
  constructor(item) {
    Object.assign(this, item);
    this.min = isFinite(+this.min) ? +this.min : 0;
    this.max = isFinite(+this.max) ? +this.max : 1;
  }
  adjust() {
    return this;
  }
  expand(dX, dY) {
    return this;
  }
  offset() {
    return this;
  }
}


/***/ }),

/***/ "./src/layout/AbstractOutputItem.ts":
/*!******************************************!*\
  !*** ./src/layout/AbstractOutputItem.ts ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AbstractOutputItem)
/* harmony export */ });
/* harmony import */ var _AbstractItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractItem */ "./src/layout/AbstractItem.ts");

class AbstractOutputItem extends _AbstractItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
}


/***/ }),

/***/ "./src/layout/Button.ts":
/*!******************************!*\
  !*** ./src/layout/Button.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Button)
/* harmony export */ });
/* harmony import */ var _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractInputItem */ "./src/layout/AbstractInputItem.ts");

class Button extends _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "button",
      width: 2,
      height: 1,
      sizing: "horizontal"
    };
  }
}


/***/ }),

/***/ "./src/layout/Checkbox.ts":
/*!********************************!*\
  !*** ./src/layout/Checkbox.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Checkbox)
/* harmony export */ });
/* harmony import */ var _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractInputItem */ "./src/layout/AbstractInputItem.ts");

class Checkbox extends _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "checkbox",
      width: 2,
      height: 1,
      sizing: "horizontal"
    };
  }
}


/***/ }),

/***/ "./src/layout/HBargraph.ts":
/*!*********************************!*\
  !*** ./src/layout/HBargraph.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ HBargraph)
/* harmony export */ });
/* harmony import */ var _AbstractOutputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractOutputItem */ "./src/layout/AbstractOutputItem.ts");

class HBargraph extends _AbstractOutputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "hbargraph",
      width: 5,
      height: 1,
      sizing: "horizontal"
    };
  }
}


/***/ }),

/***/ "./src/layout/HGroup.ts":
/*!******************************!*\
  !*** ./src/layout/HGroup.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ HGroup)
/* harmony export */ });
/* harmony import */ var _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractGroup */ "./src/layout/AbstractGroup.ts");

class HGroup extends _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"] {
  adjust() {
    this.items.forEach((item) => {
      item.adjust();
      this.layout.width += item.layout.width;
      this.layout.height = Math.max(this.layout.height, item.layout.height + 2 * _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].padding + (this.isRoot ? 0 : _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].labelHeight));
    });
    this.layout.width += _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].spaceBetween * (this.items.length - 1);
    if (this.layout.width < 1) this.layout.width += 1;
    return this;
  }
  expand(dX) {
    let hExpandItems = 0;
    this.items.forEach((item) => {
      if (item.layout.sizing === "both" || item.layout.sizing === "horizontal") hExpandItems++;
    });
    this.items.forEach((item) => {
      let dX$ = 0;
      let dY$ = 0;
      if (item.layout.sizing === "both" || item.layout.sizing === "horizontal") {
        dX$ = hExpandItems ? dX / hExpandItems : 0;
        item.layout.width += dX$;
      }
      if (item.layout.sizing === "both" || item.layout.sizing === "vertical") {
        dY$ = this.layout.height - 2 * _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].padding - (this.isRoot ? 0 : _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].labelHeight) - item.layout.height;
        item.layout.height += dY$;
      }
      item.expand(dX$, dY$);
    });
    return this;
  }
  offset() {
    const { labelHeight, padding, spaceBetween } = _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"];
    let $left = padding;
    const $top = padding + (this.isRoot ? 0 : labelHeight);
    const { height } = this.layout;
    this.items.forEach((item) => {
      item.layout.offsetLeft = $left;
      item.layout.offsetTop = $top;
      item.layout.offsetTop += (height - (this.isRoot ? 0 : labelHeight) - item.layout.height) / 2 - padding;
      item.layout.left = (this.layout.left || 0) + item.layout.offsetLeft;
      item.layout.top = (this.layout.top || 0) + item.layout.offsetTop;
      item.offset();
      $left += item.layout.width + spaceBetween;
    });
    return this;
  }
}


/***/ }),

/***/ "./src/layout/HSlider.ts":
/*!*******************************!*\
  !*** ./src/layout/HSlider.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ HSlider)
/* harmony export */ });
/* harmony import */ var _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractInputItem */ "./src/layout/AbstractInputItem.ts");

class HSlider extends _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "hslider",
      width: 5,
      height: 1,
      sizing: "horizontal"
    };
  }
}


/***/ }),

/***/ "./src/layout/Knob.ts":
/*!****************************!*\
  !*** ./src/layout/Knob.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Knob)
/* harmony export */ });
/* harmony import */ var _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractInputItem */ "./src/layout/AbstractInputItem.ts");

class Knob extends _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "knob",
      width: 1,
      height: 1.75,
      sizing: "none"
    };
  }
}


/***/ }),

/***/ "./src/layout/Layout.ts":
/*!******************************!*\
  !*** ./src/layout/Layout.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Layout)
/* harmony export */ });
/* harmony import */ var _HSlider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./HSlider */ "./src/layout/HSlider.ts");
/* harmony import */ var _VSlider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./VSlider */ "./src/layout/VSlider.ts");
/* harmony import */ var _Nentry__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Nentry */ "./src/layout/Nentry.ts");
/* harmony import */ var _Soundfile__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./Soundfile */ "./src/layout/Soundfile.ts");
/* harmony import */ var _Button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./Button */ "./src/layout/Button.ts");
/* harmony import */ var _Checkbox__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./Checkbox */ "./src/layout/Checkbox.ts");
/* harmony import */ var _Knob__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./Knob */ "./src/layout/Knob.ts");
/* harmony import */ var _Menu__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./Menu */ "./src/layout/Menu.ts");
/* harmony import */ var _Radio__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./Radio */ "./src/layout/Radio.ts");
/* harmony import */ var _Led__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./Led */ "./src/layout/Led.ts");
/* harmony import */ var _Numerical__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./Numerical */ "./src/layout/Numerical.ts");
/* harmony import */ var _HBargraph__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./HBargraph */ "./src/layout/HBargraph.ts");
/* harmony import */ var _VBargraph__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./VBargraph */ "./src/layout/VBargraph.ts");
/* harmony import */ var _HGroup__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./HGroup */ "./src/layout/HGroup.ts");
/* harmony import */ var _VGroup__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./VGroup */ "./src/layout/VGroup.ts");
/* harmony import */ var _TGroup__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./TGroup */ "./src/layout/TGroup.ts");
















class Layout {
  /**
   * Get the rendering type of an item by parsing its metadata
   */
  static predictType(item) {
    var _a, _b, _c, _d, _e;
    if (item.type === "hbargraph" || item.type === "vbargraph") {
      if ((_a = item.meta) == null ? void 0 : _a.find((meta) => {
        var _a2;
        return (_a2 = meta.style) == null ? void 0 : _a2.startsWith("led");
      })) return "led";
      if ((_b = item.meta) == null ? void 0 : _b.find((meta) => {
        var _a2;
        return (_a2 = meta.style) == null ? void 0 : _a2.startsWith("numerical");
      })) return "numerical";
      return item.type;
    }
    if (item.type === "hslider" || item.type === "nentry" || item.type === "vslider") {
      if ((_c = item.meta) == null ? void 0 : _c.find((meta) => {
        var _a2;
        return (_a2 = meta.style) == null ? void 0 : _a2.startsWith("knob");
      })) return "knob";
      if ((_d = item.meta) == null ? void 0 : _d.find((meta) => {
        var _a2;
        return (_a2 = meta.style) == null ? void 0 : _a2.startsWith("menu");
      })) return "menu";
      if ((_e = item.meta) == null ? void 0 : _e.find((meta) => {
        var _a2;
        return (_a2 = meta.style) == null ? void 0 : _a2.startsWith("radio");
      })) return "radio";
    }
    return item.type;
  }
  /**
   * Get the Layout class constructor of an item
   */
  static getItem(item) {
    const Ctor = {
      hslider: _HSlider__WEBPACK_IMPORTED_MODULE_0__["default"],
      vslider: _VSlider__WEBPACK_IMPORTED_MODULE_1__["default"],
      nentry: _Nentry__WEBPACK_IMPORTED_MODULE_2__["default"],
      soundfile: _Soundfile__WEBPACK_IMPORTED_MODULE_3__["default"],
      button: _Button__WEBPACK_IMPORTED_MODULE_4__["default"],
      checkbox: _Checkbox__WEBPACK_IMPORTED_MODULE_5__["default"],
      knob: _Knob__WEBPACK_IMPORTED_MODULE_6__["default"],
      menu: _Menu__WEBPACK_IMPORTED_MODULE_7__["default"],
      radio: _Radio__WEBPACK_IMPORTED_MODULE_8__["default"],
      led: _Led__WEBPACK_IMPORTED_MODULE_9__["default"],
      numerical: _Numerical__WEBPACK_IMPORTED_MODULE_10__["default"],
      hbargraph: _HBargraph__WEBPACK_IMPORTED_MODULE_11__["default"],
      vbargraph: _VBargraph__WEBPACK_IMPORTED_MODULE_12__["default"],
      hgroup: _HGroup__WEBPACK_IMPORTED_MODULE_13__["default"],
      vgroup: _VGroup__WEBPACK_IMPORTED_MODULE_14__["default"],
      tgroup: _TGroup__WEBPACK_IMPORTED_MODULE_15__["default"]
    };
    const layoutType = this.predictType(item);
    return new Ctor[layoutType](item);
  }
  static getItems(items) {
    return items.map((item) => {
      if ("items" in item) item.items = this.getItems(item.items);
      return this.getItem(item);
    });
  }
  static calc(ui) {
    const rootGroup = new _VGroup__WEBPACK_IMPORTED_MODULE_14__["default"]({ items: this.getItems(ui), type: "vgroup", label: "" }, true);
    rootGroup.adjust();
    rootGroup.expand(0, 0);
    rootGroup.offset();
    return rootGroup;
  }
}


/***/ }),

/***/ "./src/layout/Led.ts":
/*!***************************!*\
  !*** ./src/layout/Led.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Led)
/* harmony export */ });
/* harmony import */ var _AbstractOutputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractOutputItem */ "./src/layout/AbstractOutputItem.ts");

class Led extends _AbstractOutputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "led",
      width: 1,
      height: 1,
      sizing: "none"
    };
  }
}


/***/ }),

/***/ "./src/layout/Menu.ts":
/*!****************************!*\
  !*** ./src/layout/Menu.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Menu)
/* harmony export */ });
/* harmony import */ var _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractInputItem */ "./src/layout/AbstractInputItem.ts");

class Menu extends _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "menu",
      width: 2,
      height: 1,
      sizing: "horizontal"
    };
  }
}


/***/ }),

/***/ "./src/layout/Nentry.ts":
/*!******************************!*\
  !*** ./src/layout/Nentry.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Nentry)
/* harmony export */ });
/* harmony import */ var _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractInputItem */ "./src/layout/AbstractInputItem.ts");

class Nentry extends _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "nentry",
      width: 1,
      height: 1,
      sizing: "none"
    };
  }
}


/***/ }),

/***/ "./src/layout/Numerical.ts":
/*!*********************************!*\
  !*** ./src/layout/Numerical.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Numerical)
/* harmony export */ });
/* harmony import */ var _AbstractOutputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractOutputItem */ "./src/layout/AbstractOutputItem.ts");

class Numerical extends _AbstractOutputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "numerical",
      width: 1,
      height: 1,
      sizing: "none"
    };
  }
}


/***/ }),

/***/ "./src/layout/Radio.ts":
/*!*****************************!*\
  !*** ./src/layout/Radio.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Radio)
/* harmony export */ });
/* harmony import */ var _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractInputItem */ "./src/layout/AbstractInputItem.ts");

class Radio extends _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "radio",
      width: 2,
      height: 2,
      // TODO: vradio and hradio
      sizing: "both"
    };
  }
}


/***/ }),

/***/ "./src/layout/Soundfile.ts":
/*!*********************************!*\
  !*** ./src/layout/Soundfile.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Soundfile)
/* harmony export */ });
/* harmony import */ var _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractInputItem */ "./src/layout/AbstractInputItem.ts");

class Soundfile extends _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "soundfile",
      width: 2,
      height: 1,
      sizing: "horizontal"
    };
  }
}


/***/ }),

/***/ "./src/layout/TGroup.ts":
/*!******************************!*\
  !*** ./src/layout/TGroup.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ TGroup)
/* harmony export */ });
/* harmony import */ var _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractGroup */ "./src/layout/AbstractGroup.ts");

const _TGroup = class _TGroup extends _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"] {
  adjust() {
    this.items.forEach((item) => {
      item.adjust();
      this.layout.width = Math.max(this.layout.width, item.layout.width + 2 * _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].padding);
      this.layout.height = Math.max(this.layout.height, item.layout.height + 2 * _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].padding + _TGroup.labelHeight);
    });
    const tabsCount = this.items.length;
    this.layout.width = Math.max(this.layout.width, tabsCount * _TGroup.tabLayout.width);
    this.layout.height += _TGroup.tabLayout.height;
    if (this.layout.width < 1) this.layout.width += 1;
    return this;
  }
  expand() {
    const tabsCount = this.items.length;
    this.items.forEach((item) => {
      let dY$ = 0;
      let dX$ = 0;
      if (item.layout.sizing === "both" || item.layout.sizing === "horizontal") dX$ = this.layout.width - 2 * _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].padding - item.layout.width;
      if (item.layout.sizing === "both" || item.layout.sizing === "vertical") dY$ = this.layout.height - 2 * _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].padding - (this.isRoot ? 0 : _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].labelHeight) - (tabsCount ? _TGroup.tabLayout.height : 0) - item.layout.height;
      item.expand(dX$, dY$);
    });
    return this;
  }
  offset() {
    const { labelHeight, padding } = _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"];
    const $left = padding;
    const $top = padding + (this.isRoot ? 0 : labelHeight) + _TGroup.tabLayout.height;
    this.items.forEach((item) => {
      item.layout.offsetLeft = $left;
      item.layout.offsetTop = $top;
      item.layout.left = (this.layout.left || 0) + item.layout.offsetLeft;
      item.layout.top = (this.layout.top || 0) + item.layout.offsetTop;
      item.offset();
    });
    return this;
  }
};
_TGroup.tabLayout = {
  width: 2,
  height: 1
};
let TGroup = _TGroup;



/***/ }),

/***/ "./src/layout/VBargraph.ts":
/*!*********************************!*\
  !*** ./src/layout/VBargraph.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VBargraph)
/* harmony export */ });
/* harmony import */ var _AbstractOutputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractOutputItem */ "./src/layout/AbstractOutputItem.ts");

class VBargraph extends _AbstractOutputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "vbargraph",
      width: 1,
      height: 5,
      sizing: "vertical"
    };
  }
}


/***/ }),

/***/ "./src/layout/VGroup.ts":
/*!******************************!*\
  !*** ./src/layout/VGroup.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VGroup)
/* harmony export */ });
/* harmony import */ var _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractGroup */ "./src/layout/AbstractGroup.ts");

class VGroup extends _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"] {
  adjust() {
    this.items.forEach((item) => {
      item.adjust();
      this.layout.width = Math.max(this.layout.width, item.layout.width + 2 * _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].padding);
      this.layout.height += item.layout.height;
    });
    this.layout.height += _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].spaceBetween * (this.items.length - 1);
    if (this.layout.width < 1) this.layout.width += 1;
    return this;
  }
  expand(dX, dY) {
    let vExpandItems = 0;
    this.items.forEach((item) => {
      if (item.layout.sizing === "both" || item.layout.sizing === "vertical") vExpandItems++;
    });
    this.items.forEach((item) => {
      let dX$ = 0;
      let dY$ = 0;
      if (item.layout.sizing === "both" || item.layout.sizing === "horizontal") {
        dX$ = this.layout.width - 2 * _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"].padding - item.layout.width;
        item.layout.width += dX$;
      }
      if (item.layout.sizing === "both" || item.layout.sizing === "vertical") {
        dY$ = vExpandItems ? dY / vExpandItems : 0;
        item.layout.height += dY$;
      }
      item.expand(dX$, dY$);
    });
    return this;
  }
  offset() {
    const { labelHeight, padding, spaceBetween } = _AbstractGroup__WEBPACK_IMPORTED_MODULE_0__["default"];
    const $left = padding;
    let $top = padding + (this.isRoot ? 0 : labelHeight);
    const { width } = this.layout;
    this.items.forEach((item) => {
      item.layout.offsetLeft = $left;
      item.layout.offsetTop = $top;
      item.layout.offsetLeft += (width - item.layout.width) / 2 - padding;
      item.layout.left = (this.layout.left || 0) + item.layout.offsetLeft;
      item.layout.top = (this.layout.top || 0) + item.layout.offsetTop;
      item.offset();
      $top += item.layout.height + spaceBetween;
    });
    return this;
  }
}


/***/ }),

/***/ "./src/layout/VSlider.ts":
/*!*******************************!*\
  !*** ./src/layout/VSlider.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VSlider)
/* harmony export */ });
/* harmony import */ var _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./AbstractInputItem */ "./src/layout/AbstractInputItem.ts");

class VSlider extends _AbstractInputItem__WEBPACK_IMPORTED_MODULE_0__["default"] {
  constructor() {
    super(...arguments);
    this.layout = {
      type: "vslider",
      width: 1,
      height: 5,
      sizing: "vertical"
    };
  }
}


/***/ }),

/***/ "./src/components/Base.scss":
/*!**********************************!*\
  !*** ./src/components/Base.scss ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/Button.scss":
/*!************************************!*\
  !*** ./src/components/Button.scss ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/Checkbox.scss":
/*!**************************************!*\
  !*** ./src/components/Checkbox.scss ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/Group.scss":
/*!***********************************!*\
  !*** ./src/components/Group.scss ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/HBargraph.scss":
/*!***************************************!*\
  !*** ./src/components/HBargraph.scss ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/HSlider.scss":
/*!*************************************!*\
  !*** ./src/components/HSlider.scss ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/Knob.scss":
/*!**********************************!*\
  !*** ./src/components/Knob.scss ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/Led.scss":
/*!*********************************!*\
  !*** ./src/components/Led.scss ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/Menu.scss":
/*!**********************************!*\
  !*** ./src/components/Menu.scss ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/Nentry.scss":
/*!************************************!*\
  !*** ./src/components/Nentry.scss ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/Numerical.scss":
/*!***************************************!*\
  !*** ./src/components/Numerical.scss ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/Radio.scss":
/*!***********************************!*\
  !*** ./src/components/Radio.scss ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/Soundfile.scss":
/*!***************************************!*\
  !*** ./src/components/Soundfile.scss ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/VBargraph.scss":
/*!***************************************!*\
  !*** ./src/components/VBargraph.scss ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/components/VSlider.scss":
/*!*************************************!*\
  !*** ./src/components/VSlider.scss ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "./src/index.scss":
/*!************************!*\
  !*** ./src/index.scss ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __webpack_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		// no module.id needed
/******/ 		// no module.loaded needed
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/******/ /* webpack/runtime/make namespace object */
/******/ (() => {
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ })();
/******/ 
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FaustUI: () => (/* reexport safe */ _FaustUI__WEBPACK_IMPORTED_MODULE_0__["default"]),
/* harmony export */   instantiate: () => (/* reexport safe */ _instantiate__WEBPACK_IMPORTED_MODULE_1__["default"])
/* harmony export */ });
/* harmony import */ var _FaustUI__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./FaustUI */ "./src/FaustUI.ts");
/* harmony import */ var _instantiate__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./instantiate */ "./src/instantiate.ts");



})();

var __webpack_exports__FaustUI = __webpack_exports__.FaustUI;
var __webpack_exports__instantiate = __webpack_exports__.instantiate;
export { __webpack_exports__FaustUI as FaustUI, __webpack_exports__instantiate as instantiate };

//# sourceMappingURL=index.js.map