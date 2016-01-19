module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ((function(modules) {
	// Check all modules for deduplicated modules
	for(var i in modules) {
		if(Object.prototype.hasOwnProperty.call(modules, i)) {
			switch(typeof modules[i]) {
			case "function": break;
			case "object":
				// Module can be created from a template
				modules[i] = (function(_m) {
					var args = _m.slice(1), fn = modules[_m[0]];
					return function (a,b,c) {
						fn.apply(this, [a,b,c].concat(args));
					};
				}(modules[i]));
				break;
			default:
				// Module is a copy of another module
				modules[i] = modules[modules[i]];
				break;
			}
		}
	}
	return modules;
}([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.init = init;

	var _lodash = __webpack_require__(18);

	var _lodash2 = _interopRequireDefault(_lodash);

	var _createElement = __webpack_require__(76);

	var _createElement2 = _interopRequireDefault(_createElement);

	var _domDelegator = __webpack_require__(47);

	var _domDelegator2 = _interopRequireDefault(_domDelegator);

	var _eventEmitter = __webpack_require__(16);

	var _eventEmitter2 = _interopRequireDefault(_eventEmitter);

	var _Playlist = __webpack_require__(24);

	var _Playlist2 = _interopRequireDefault(_Playlist);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	__webpack_require__.p = "js/";

	function init() {
	    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
	    var ee = arguments.length <= 1 || arguments[1] === undefined ? (0, _eventEmitter2.default)() : arguments[1];
	    var delegator = arguments.length <= 2 || arguments[2] === undefined ? (0, _domDelegator2.default)() : arguments[2];

	    if (options.container === undefined) {
	        throw new Error("DOM element container must be given.");
	    }

	    var audioContext = new (window.AudioContext || window.webkitAudioContext)();

	    var defaults = {
	        ac: audioContext,
	        sampleRate: audioContext.sampleRate,
	        samplesPerPixel: 4096, //samples per pixel to draw, must be an entry in zoomLevels.
	        timeFormat: 'hh:mm:ss.uu',
	        mono: true, //whether to draw multiple channels or combine them.
	        fadeType: 'logarithmic',
	        timescale: false, //whether or not to include the time measure.
	        controls: {
	            show: false, //whether or not to include the track controls
	            width: 150 },
	        //width of controls in pixels
	        colors: {
	            waveOutlineColor: 'white',
	            timeColor: 'grey',
	            fadeColor: 'black'
	        },
	        waveHeight: 128, //height of each canvas element a waveform is on.
	        state: 'cursor',
	        zoomLevels: [512, 1024, 2048, 4096] //zoom levels in samples per pixel
	    };

	    var config = (0, _lodash2.default)(defaults, options);
	    var zoomIndex = config.zoomLevels.indexOf(config.samplesPerPixel);

	    if (zoomIndex === -1) {
	        throw new Error("initial samplesPerPixel must be included in array zoomLevels");
	    }

	    var playlist = new _Playlist2.default();
	    playlist.setSampleRate(config.sampleRate);
	    playlist.setSamplesPerPixel(config.samplesPerPixel);
	    playlist.setAudioContext(config.ac);
	    playlist.setEventEmitter(ee);
	    playlist.setUpEventEmitter();
	    playlist.setTimeSelection(0, 0);
	    playlist.setState(config.state);
	    playlist.setControlOptions(config.controls);
	    playlist.setWaveHeight(config.waveHeight);
	    playlist.setColors(config.colors);
	    playlist.setZoomLevels(config.zoomLevels);
	    playlist.setZoomIndex(zoomIndex);
	    playlist.setMono(config.mono);

	    //take care of initial virtual dom rendering.
	    var tree = playlist.render();
	    var rootNode = (0, _createElement2.default)(tree);

	    config.container.appendChild(rootNode);
	    playlist.tree = tree;
	    playlist.rootNode = rootNode;

	    //have to add extra events that aren't followed by default.
	    delegator.listenTo("scroll");

	    return playlist;
	}

/***/ },
/* 1 */
/***/ function(module, exports) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.samplesToSeconds = samplesToSeconds;
	exports.secondsToSamples = secondsToSamples;
	exports.samplesToPixels = samplesToPixels;
	exports.pixelsToSamples = pixelsToSamples;
	exports.pixelsToSeconds = pixelsToSeconds;
	exports.secondsToPixels = secondsToPixels;
	function samplesToSeconds(samples, sampleRate) {
	    return samples / sampleRate;
	}

	function secondsToSamples(seconds, sampleRate) {
	    return Math.ceil(seconds * sampleRate);
	}

	function samplesToPixels(samples, resolution) {
	    return ~ ~(samples / resolution);
	}

	function pixelsToSamples(pixels, resolution) {
	    return ~ ~(pixels * resolution);
	}

	function pixelsToSeconds(pixels, resolution, sampleRate) {
	    return pixels * resolution / sampleRate;
	}

	function secondsToPixels(seconds, resolution, sampleRate) {
	    return Math.ceil(seconds * sampleRate / resolution);
	}

/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = isWidget

	function isWidget(w) {
	    return w && w.type === "Widget"
	}


/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	var version = __webpack_require__(4)

	module.exports = isVirtualNode

	function isVirtualNode(x) {
	    return x && x.type === "VirtualNode" && x.version === version
	}


/***/ },
/* 4 */
/***/ function(module, exports) {

	module.exports = "2"


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var OneVersionConstraint = __webpack_require__(65);

	var MY_VERSION = '7';
	OneVersionConstraint('ev-store', MY_VERSION);

	var hashKey = '__EV_STORE_KEY@' + MY_VERSION;

	module.exports = EvStore;

	function EvStore(elem) {
	    var hash = elem[hashKey];

	    if (!hash) {
	        hash = elem[hashKey] = {};
	    }

	    return hash;
	}


/***/ },
/* 6 */
/***/ function(module, exports) {

	module.exports = isThunk

	function isThunk(t) {
	    return t && t.type === "Thunk"
	}


/***/ },
/* 7 */
/***/ function(module, exports) {

	module.exports = isHook

	function isHook(hook) {
	    return hook &&
	      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
	       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
	}


/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	var version = __webpack_require__(4)

	module.exports = isVirtualText

	function isVirtualText(x) {
	    return x && x.type === "VirtualText" && x.version === version
	}


/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.FADEOUT = exports.FADEIN = exports.LOGARITHMIC = exports.EXPONENTIAL = exports.LINEAR = exports.SCURVE = undefined;
	exports.createFadeIn = createFadeIn;
	exports.createFadeOut = createFadeOut;

	var _curves = __webpack_require__(14);

	var SCURVE = exports.SCURVE = "sCurve";
	var LINEAR = exports.LINEAR = "linear";
	var EXPONENTIAL = exports.EXPONENTIAL = "exponential";
	var LOGARITHMIC = exports.LOGARITHMIC = "logarithmic";

	var FADEIN = exports.FADEIN = "FadeIn";
	var FADEOUT = exports.FADEOUT = "FadeOut";

	function sCurveFadeIn(start, duration) {
	    var curve = (0, _curves.sCurve)(10000, 1);
	    this.setValueCurveAtTime(curve, start, duration);
	}

	function sCurveFadeOut(start, duration) {
	    var curve = (0, _curves.sCurve)(10000, -1);
	    this.setValueCurveAtTime(curve, start, duration);
	}

	function linearFadeIn(start, duration) {
	    this.linearRampToValueAtTime(0, start);
	    this.linearRampToValueAtTime(1, start + duration);
	}

	function linearFadeOut(start, duration) {
	    this.linearRampToValueAtTime(1, start);
	    this.linearRampToValueAtTime(0, start + duration);
	}

	function exponentialFadeIn(start, duration) {
	    this.exponentialRampToValueAtTime(0.01, start);
	    this.exponentialRampToValueAtTime(1, start + duration);
	}

	function exponentialFadeOut(start, duration) {
	    this.exponentialRampToValueAtTime(1, start);
	    this.exponentialRampToValueAtTime(0.01, start + duration);
	}

	function logarithmicFadeIn(start, duration) {
	    var curve = (0, _curves.logarithmic)(10000, 10, 1);
	    this.setValueCurveAtTime(curve, start, duration);
	}

	function logarithmicFadeOut(start, duration) {
	    var curve = (0, _curves.logarithmic)(10000, 10, -1);
	    this.setValueCurveAtTime(curve, start, duration);
	}

	function createFadeIn(gain, shape, start, duration) {
	    switch (shape) {
	        case SCURVE:
	            sCurveFadeIn.call(gain, start, duration);
	            break;
	        case LINEAR:
	            linearFadeIn.call(gain, start, duration);
	            break;
	        case EXPONENTIAL:
	            exponentialFadeIn.call(gain, start, duration);
	            break;
	        case LOGARITHMIC:
	            logarithmicFadeIn.call(gain, start, duration);
	            break;
	        default:
	            throw new Error("Unsupported Fade type");
	    }
	}

	function createFadeOut(gain, shape, start, duration) {
	    switch (shape) {
	        case SCURVE:
	            sCurveFadeOut.call(gain, start, duration);
	            break;
	        case LINEAR:
	            linearFadeOut.call(gain, start, duration);
	            break;
	        case EXPONENTIAL:
	            exponentialFadeOut.call(gain, start, duration);
	            break;
	        case LOGARITHMIC:
	            logarithmicFadeOut.call(gain, start, duration);
	            break;
	        default:
	            throw new Error("Unsupported Fade type");
	    }
	}

/***/ },
/* 10 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */

	/** Used as the `TypeError` message for "Functions" methods. */
	var FUNC_ERROR_TEXT = 'Expected a function';

	/** Used as references for various `Number` constants. */
	var INFINITY = 1 / 0,
	    MAX_INTEGER = 1.7976931348623157e+308,
	    NAN = 0 / 0;

	/** `Object#toString` result references. */
	var funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]';

	/** Used to match leading and trailing whitespace. */
	var reTrim = /^\s+|\s+$/g;

	/** Used to detect bad signed hexadecimal string values. */
	var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

	/** Used to detect binary string values. */
	var reIsBinary = /^0b[01]+$/i;

	/** Used to detect octal string values. */
	var reIsOctal = /^0o[0-7]+$/i;

	/** Built-in method references without a dependency on `global`. */
	var freeParseInt = parseInt;

	/**
	 * A faster alternative to `Function#apply`, this function invokes `func`
	 * with the `this` binding of `thisArg` and the arguments of `args`.
	 *
	 * @private
	 * @param {Function} func The function to invoke.
	 * @param {*} thisArg The `this` binding of `func`.
	 * @param {...*} [args] The arguments to invoke `func` with.
	 * @returns {*} Returns the result of `func`.
	 */
	function apply(func, thisArg, args) {
	  var length = args ? args.length : 0;
	  switch (length) {
	    case 0: return func.call(thisArg);
	    case 1: return func.call(thisArg, args[0]);
	    case 2: return func.call(thisArg, args[0], args[1]);
	    case 3: return func.call(thisArg, args[0], args[1], args[2]);
	  }
	  return func.apply(thisArg, args);
	}

	/** Used for built-in method references. */
	var objectProto = global.Object.prototype;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;

	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeMax = Math.max;

	/**
	 * Creates a function that invokes `func` with the `this` binding of the
	 * created function and arguments from `start` and beyond provided as an array.
	 *
	 * **Note:** This method is based on the [rest parameter](https://mdn.io/rest_parameters).
	 *
	 * @static
	 * @memberOf _
	 * @category Function
	 * @param {Function} func The function to apply a rest parameter to.
	 * @param {number} [start=func.length-1] The start position of the rest parameter.
	 * @returns {Function} Returns the new function.
	 * @example
	 *
	 * var say = _.rest(function(what, names) {
	 *   return what + ' ' + _.initial(names).join(', ') +
	 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
	 * });
	 *
	 * say('hello', 'fred', 'barney', 'pebbles');
	 * // => 'hello fred, barney, & pebbles'
	 */
	function rest(func, start) {
	  if (typeof func != 'function') {
	    throw new TypeError(FUNC_ERROR_TEXT);
	  }
	  start = nativeMax(start === undefined ? (func.length - 1) : toInteger(start), 0);
	  return function() {
	    var args = arguments,
	        index = -1,
	        length = nativeMax(args.length - start, 0),
	        array = Array(length);

	    while (++index < length) {
	      array[index] = args[start + index];
	    }
	    switch (start) {
	      case 0: return func.call(this, array);
	      case 1: return func.call(this, args[0], array);
	      case 2: return func.call(this, args[0], args[1], array);
	    }
	    var otherArgs = Array(start + 1);
	    index = -1;
	    while (++index < start) {
	      otherArgs[index] = args[index];
	    }
	    otherArgs[start] = array;
	    return apply(func, this, otherArgs);
	  };
	}

	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in Safari 8 which returns 'object' for typed array constructors, and
	  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
	  var tag = isObject(value) ? objectToString.call(value) : '';
	  return tag == funcTag || tag == genTag;
	}

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	/**
	 * Converts `value` to an integer.
	 *
	 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to convert.
	 * @returns {number} Returns the converted integer.
	 * @example
	 *
	 * _.toInteger(3);
	 * // => 3
	 *
	 * _.toInteger(Number.MIN_VALUE);
	 * // => 0
	 *
	 * _.toInteger(Infinity);
	 * // => 1.7976931348623157e+308
	 *
	 * _.toInteger('3');
	 * // => 3
	 */
	function toInteger(value) {
	  if (!value) {
	    return value === 0 ? value : 0;
	  }
	  value = toNumber(value);
	  if (value === INFINITY || value === -INFINITY) {
	    var sign = (value < 0 ? -1 : 1);
	    return sign * MAX_INTEGER;
	  }
	  var remainder = value % 1;
	  return value === value ? (remainder ? value - remainder : value) : 0;
	}

	/**
	 * Converts `value` to a number.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to process.
	 * @returns {number} Returns the number.
	 * @example
	 *
	 * _.toNumber(3);
	 * // => 3
	 *
	 * _.toNumber(Number.MIN_VALUE);
	 * // => 5e-324
	 *
	 * _.toNumber(Infinity);
	 * // => Infinity
	 *
	 * _.toNumber('3');
	 * // => 3
	 */
	function toNumber(value) {
	  if (isObject(value)) {
	    var other = isFunction(value.valueOf) ? value.valueOf() : value;
	    value = isObject(other) ? (other + '') : other;
	  }
	  if (typeof value != 'string') {
	    return value === 0 ? value : +value;
	  }
	  value = value.replace(reTrim, '');
	  var isBinary = reIsBinary.test(value);
	  return (isBinary || reIsOctal.test(value))
	    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
	    : (reIsBadHex.test(value) ? NAN : +value);
	}

	module.exports = rest;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	var h = __webpack_require__(85)

	module.exports = h


/***/ },
/* 12 */
/***/ function(module, exports) {

	var nativeIsArray = Array.isArray
	var toString = Object.prototype.toString

	module.exports = nativeIsArray || isArray

	function isArray(obj) {
	    return toString.call(obj) === "[object Array]"
	}


/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.STATE_FINISHED = exports.STATE_DECODING = exports.STATE_LOADING = exports.STATE_UNINITIALIZED = undefined;

	var _eventEmitter = __webpack_require__(16);

	var _eventEmitter2 = _interopRequireDefault(_eventEmitter);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var STATE_UNINITIALIZED = exports.STATE_UNINITIALIZED = 0;
	var STATE_LOADING = exports.STATE_LOADING = 1;
	var STATE_DECODING = exports.STATE_DECODING = 2;
	var STATE_FINISHED = exports.STATE_FINISHED = 3;

	var _class = function () {
	    function _class(src, audioContext) {
	        _classCallCheck(this, _class);

	        this.src = src;
	        this.ac = audioContext;
	        this.audioRequestState = STATE_UNINITIALIZED;
	        this.ee = (0, _eventEmitter2.default)();
	    }

	    _createClass(_class, [{
	        key: 'fileProgress',
	        value: function fileProgress(e) {
	            var percentComplete = 0;

	            if (this.audioRequestState === STATE_UNINITIALIZED) {
	                this.audioRequestState = STATE_LOADING;
	                this.ee.emit('audiorequeststatechange', this);
	            }

	            if (e.lengthComputable) {
	                percentComplete = e.loaded / e.total * 100;
	            }

	            this.ee.emit('progress', percentComplete);
	        }
	    }, {
	        key: 'fileLoad',
	        value: function fileLoad(e) {
	            var _this = this;

	            var audioData = e.target.response || e.target.result;

	            this.audioRequestState = STATE_DECODING;
	            this.ee.emit('audiorequeststatechange', this);

	            return new Promise(function (resolve, reject) {
	                _this.ac.decodeAudioData(audioData, function (audioBuffer) {
	                    _this.audioBuffer = audioBuffer;

	                    _this.audioRequestState = STATE_FINISHED;
	                    _this.ee.emit('audiorequeststatechange', _this);

	                    resolve(audioBuffer);
	                }, function (err) {
	                    reject(Error('Unable to decode Audio Data for ' + _this.src));
	                });
	            });
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 14 */
/***/ function(module, exports) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.linear = linear;
	exports.exponential = exponential;
	exports.sCurve = sCurve;
	exports.logarithmic = logarithmic;
	function linear(length, rotation) {
	    var curve = new Float32Array(length),
	        i,
	        x,
	        scale = length - 1;

	    for (i = 0; i < length; i++) {
	        x = i / scale;

	        if (rotation > 0) {
	            curve[i] = x;
	        } else {
	            curve[i] = 1 - x;
	        }
	    }

	    return curve;
	}

	function exponential(length, rotation) {
	    var curve = new Float32Array(length),
	        i,
	        x,
	        scale = length - 1,
	        index;

	    for (i = 0; i < length; i++) {
	        x = i / scale;
	        index = rotation > 0 ? i : length - 1 - i;

	        curve[index] = Math.exp(2 * x - 1) / Math.exp(1);
	    }

	    return curve;
	}

	//creating a curve to simulate an S-curve with setValueCurveAtTime.
	function sCurve(length, rotation) {
	    var curve = new Float32Array(length),
	        i,
	        phase = rotation > 0 ? Math.PI / 2 : -(Math.PI / 2);

	    for (i = 0; i < length; ++i) {
	        curve[i] = Math.sin(Math.PI * i / length - phase) / 2 + 0.5;
	    }
	    return curve;
	}

	//creating a curve to simulate a logarithmic curve with setValueCurveAtTime.
	function logarithmic(length, base, rotation) {
	    var curve = new Float32Array(length),
	        index,
	        x = 0,
	        i;

	    for (i = 0; i < length; i++) {
	        //index for the curve array.
	        index = rotation > 0 ? i : length - 1 - i;

	        x = i / length;
	        curve[index] = Math.log(1 + base * x) / Math.log(1 + base);
	    }

	    return curve;
	}

/***/ },
/* 15 */
[96, 94],
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var d        = __webpack_require__(44)
	  , callable = __webpack_require__(59)

	  , apply = Function.prototype.apply, call = Function.prototype.call
	  , create = Object.create, defineProperty = Object.defineProperty
	  , defineProperties = Object.defineProperties
	  , hasOwnProperty = Object.prototype.hasOwnProperty
	  , descriptor = { configurable: true, enumerable: false, writable: true }

	  , on, once, off, emit, methods, descriptors, base;

	on = function (type, listener) {
		var data;

		callable(listener);

		if (!hasOwnProperty.call(this, '__ee__')) {
			data = descriptor.value = create(null);
			defineProperty(this, '__ee__', descriptor);
			descriptor.value = null;
		} else {
			data = this.__ee__;
		}
		if (!data[type]) data[type] = listener;
		else if (typeof data[type] === 'object') data[type].push(listener);
		else data[type] = [data[type], listener];

		return this;
	};

	once = function (type, listener) {
		var once, self;

		callable(listener);
		self = this;
		on.call(this, type, once = function () {
			off.call(self, type, once);
			apply.call(listener, this, arguments);
		});

		once.__eeOnceListener__ = listener;
		return this;
	};

	off = function (type, listener) {
		var data, listeners, candidate, i;

		callable(listener);

		if (!hasOwnProperty.call(this, '__ee__')) return this;
		data = this.__ee__;
		if (!data[type]) return this;
		listeners = data[type];

		if (typeof listeners === 'object') {
			for (i = 0; (candidate = listeners[i]); ++i) {
				if ((candidate === listener) ||
						(candidate.__eeOnceListener__ === listener)) {
					if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
					else listeners.splice(i, 1);
				}
			}
		} else {
			if ((listeners === listener) ||
					(listeners.__eeOnceListener__ === listener)) {
				delete data[type];
			}
		}

		return this;
	};

	emit = function (type) {
		var i, l, listener, listeners, args;

		if (!hasOwnProperty.call(this, '__ee__')) return;
		listeners = this.__ee__[type];
		if (!listeners) return;

		if (typeof listeners === 'object') {
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) args[i - 1] = arguments[i];

			listeners = listeners.slice();
			for (i = 0; (listener = listeners[i]); ++i) {
				apply.call(listener, this, args);
			}
		} else {
			switch (arguments.length) {
			case 1:
				call.call(listeners, this);
				break;
			case 2:
				call.call(listeners, this, arguments[1]);
				break;
			case 3:
				call.call(listeners, this, arguments[1], arguments[2]);
				break;
			default:
				l = arguments.length;
				args = new Array(l - 1);
				for (i = 1; i < l; ++i) {
					args[i - 1] = arguments[i];
				}
				apply.call(listeners, this, args);
			}
		}
	};

	methods = {
		on: on,
		once: once,
		off: off,
		emit: emit
	};

	descriptors = {
		on: d(on),
		once: d(once),
		off: d(off),
		emit: d(emit)
	};

	base = defineProperties({}, descriptors);

	module.exports = exports = function (o) {
		return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
	};
	exports.methods = methods;


/***/ },
/* 17 */
/***/ function(module, exports) {

	"use strict";

	module.exports = function isObject(x) {
		return typeof x === "object" && x !== null;
	};


/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */
	var keys = __webpack_require__(68),
	    rest = __webpack_require__(10);

	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/** `Object#toString` result references. */
	var funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]';

	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;

	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return value > -1 && value % 1 == 0 && value < length;
	}

	/** Used for built-in method references. */
	var objectProto = global.Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;

	/**
	 * Assigns `value` to `key` of `object` if the existing value is not equivalent
	 * using [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
	 * for equality comparisons.
	 *
	 * @private
	 * @param {Object} object The object to modify.
	 * @param {string} key The key of the property to assign.
	 * @param {*} value The value to assign.
	 */
	function assignValue(object, key, value) {
	  var objValue = object[key];
	  if ((!eq(objValue, value) ||
	        (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) ||
	      (value === undefined && !(key in object))) {
	    object[key] = value;
	  }
	}

	/**
	 * The base implementation of `_.property` without support for deep paths.
	 *
	 * @private
	 * @param {string} key The key of the property to get.
	 * @returns {Function} Returns the new function.
	 */
	function baseProperty(key) {
	  return function(object) {
	    return object == null ? undefined : object[key];
	  };
	}

	/**
	 * Copies properties of `source` to `object`.
	 *
	 * @private
	 * @param {Object} source The object to copy properties from.
	 * @param {Array} props The property names to copy.
	 * @param {Object} [object={}] The object to copy properties to.
	 * @returns {Object} Returns `object`.
	 */
	function copyObject(source, props, object) {
	  return copyObjectWith(source, props, object);
	}

	/**
	 * This function is like `copyObject` except that it accepts a function to
	 * customize copied values.
	 *
	 * @private
	 * @param {Object} source The object to copy properties from.
	 * @param {Array} props The property names to copy.
	 * @param {Object} [object={}] The object to copy properties to.
	 * @param {Function} [customizer] The function to customize copied values.
	 * @returns {Object} Returns `object`.
	 */
	function copyObjectWith(source, props, object, customizer) {
	  object || (object = {});

	  var index = -1,
	      length = props.length;

	  while (++index < length) {
	    var key = props[index],
	        newValue = customizer ? customizer(object[key], source[key], key, object, source) : source[key];

	    assignValue(object, key, newValue);
	  }
	  return object;
	}

	/**
	 * Creates a function like `_.assign`.
	 *
	 * @private
	 * @param {Function} assigner The function to assign values.
	 * @returns {Function} Returns the new assigner function.
	 */
	function createAssigner(assigner) {
	  return rest(function(object, sources) {
	    var index = -1,
	        length = sources.length,
	        customizer = length > 1 ? sources[length - 1] : undefined,
	        guard = length > 2 ? sources[2] : undefined;

	    customizer = typeof customizer == 'function' ? (length--, customizer) : undefined;
	    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
	      customizer = length < 3 ? undefined : customizer;
	      length = 1;
	    }
	    object = Object(object);
	    while (++index < length) {
	      var source = sources[index];
	      if (source) {
	        assigner(object, source, customizer);
	      }
	    }
	    return object;
	  });
	}

	/**
	 * Gets the "length" property value of `object`.
	 *
	 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
	 * that affects Safari on at least iOS 8.1-8.3 ARM64.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {*} Returns the "length" value.
	 */
	var getLength = baseProperty('length');

	/**
	 * Checks if the provided arguments are from an iteratee call.
	 *
	 * @private
	 * @param {*} value The potential iteratee value argument.
	 * @param {*} index The potential iteratee index or key argument.
	 * @param {*} object The potential iteratee object argument.
	 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
	 */
	function isIterateeCall(value, index, object) {
	  if (!isObject(object)) {
	    return false;
	  }
	  var type = typeof index;
	  if (type == 'number'
	      ? (isArrayLike(object) && isIndex(index, object.length))
	      : (type == 'string' && index in object)) {
	    return eq(object[index], value);
	  }
	  return false;
	}

	/**
	 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
	 * comparison between two values to determine if they are equivalent.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 * @example
	 *
	 * var object = { 'user': 'fred' };
	 * var other = { 'user': 'fred' };
	 *
	 * _.eq(object, object);
	 * // => true
	 *
	 * _.eq(object, other);
	 * // => false
	 *
	 * _.eq('a', 'a');
	 * // => true
	 *
	 * _.eq('a', Object('a'));
	 * // => false
	 *
	 * _.eq(NaN, NaN);
	 * // => true
	 */
	function eq(value, other) {
	  return value === other || (value !== value && other !== other);
	}

	/**
	 * Checks if `value` is array-like. A value is considered array-like if it's
	 * not a function and has a `value.length` that's an integer greater than or
	 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	 *
	 * @static
	 * @memberOf _
	 * @type Function
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 * @example
	 *
	 * _.isArrayLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLike(document.body.children);
	 * // => true
	 *
	 * _.isArrayLike('abc');
	 * // => true
	 *
	 * _.isArrayLike(_.noop);
	 * // => false
	 */
	function isArrayLike(value) {
	  return value != null &&
	    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
	}

	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in Safari 8 which returns 'object' for typed array constructors, and
	  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
	  var tag = isObject(value) ? objectToString.call(value) : '';
	  return tag == funcTag || tag == genTag;
	}

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 * @example
	 *
	 * _.isLength(3);
	 * // => true
	 *
	 * _.isLength(Number.MIN_VALUE);
	 * // => false
	 *
	 * _.isLength(Infinity);
	 * // => false
	 *
	 * _.isLength('3');
	 * // => false
	 */
	function isLength(value) {
	  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	/**
	 * Assigns own enumerable properties of source objects to the destination
	 * object. Source objects are applied from left to right. Subsequent sources
	 * overwrite property assignments of previous sources.
	 *
	 * **Note:** This method mutates `object` and is loosely based on
	 * [`Object.assign`](https://mdn.io/Object/assign).
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The destination object.
	 * @param {...Object} [sources] The source objects.
	 * @returns {Object} Returns `object`.
	 * @example
	 *
	 * function Foo() {
	 *   this.c = 3;
	 * }
	 *
	 * function Bar() {
	 *   this.e = 5;
	 * }
	 *
	 * Foo.prototype.d = 4;
	 * Bar.prototype.f = 6;
	 *
	 * _.assign({ 'a': 1 }, new Foo, new Bar);
	 * // => { 'a': 1, 'c': 3, 'e': 5 }
	 */
	var assign = createAssigner(function(object, source) {
	  copyObject(source, keys(source), object);
	});

	module.exports = assign;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 19 */
[96, 95],
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(17)
	var isHook = __webpack_require__(7)

	module.exports = applyProperties

	function applyProperties(node, props, previous) {
	    for (var propName in props) {
	        var propValue = props[propName]

	        if (propValue === undefined) {
	            removeProperty(node, propName, propValue, previous);
	        } else if (isHook(propValue)) {
	            removeProperty(node, propName, propValue, previous)
	            if (propValue.hook) {
	                propValue.hook(node,
	                    propName,
	                    previous ? previous[propName] : undefined)
	            }
	        } else {
	            if (isObject(propValue)) {
	                patchObject(node, props, previous, propName, propValue);
	            } else {
	                node[propName] = propValue
	            }
	        }
	    }
	}

	function removeProperty(node, propName, propValue, previous) {
	    if (previous) {
	        var previousValue = previous[propName]

	        if (!isHook(previousValue)) {
	            if (propName === "attributes") {
	                for (var attrName in previousValue) {
	                    node.removeAttribute(attrName)
	                }
	            } else if (propName === "style") {
	                for (var i in previousValue) {
	                    node.style[i] = ""
	                }
	            } else if (typeof previousValue === "string") {
	                node[propName] = ""
	            } else {
	                node[propName] = null
	            }
	        } else if (previousValue.unhook) {
	            previousValue.unhook(node, propName, propValue)
	        }
	    }
	}

	function patchObject(node, props, previous, propName, propValue) {
	    var previousValue = previous ? previous[propName] : undefined

	    // Set attributes
	    if (propName === "attributes") {
	        for (var attrName in propValue) {
	            var attrValue = propValue[attrName]

	            if (attrValue === undefined) {
	                node.removeAttribute(attrName)
	            } else {
	                node.setAttribute(attrName, attrValue)
	            }
	        }

	        return
	    }

	    if(previousValue && isObject(previousValue) &&
	        getPrototype(previousValue) !== getPrototype(propValue)) {
	        node[propName] = propValue
	        return
	    }

	    if (!isObject(node[propName])) {
	        node[propName] = {}
	    }

	    var replacer = propName === "style" ? "" : undefined

	    for (var k in propValue) {
	        var value = propValue[k]
	        node[propName][k] = (value === undefined) ? replacer : value
	    }
	}

	function getPrototype(value) {
	    if (Object.getPrototypeOf) {
	        return Object.getPrototypeOf(value)
	    } else if (value.__proto__) {
	        return value.__proto__
	    } else if (value.constructor) {
	        return value.constructor.prototype
	    }
	}


/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	var document = __webpack_require__(19)

	var applyProperties = __webpack_require__(20)

	var isVNode = __webpack_require__(3)
	var isVText = __webpack_require__(8)
	var isWidget = __webpack_require__(2)
	var handleThunk = __webpack_require__(22)

	module.exports = createElement

	function createElement(vnode, opts) {
	    var doc = opts ? opts.document || document : document
	    var warn = opts ? opts.warn : null

	    vnode = handleThunk(vnode).a

	    if (isWidget(vnode)) {
	        return vnode.init()
	    } else if (isVText(vnode)) {
	        return doc.createTextNode(vnode.text)
	    } else if (!isVNode(vnode)) {
	        if (warn) {
	            warn("Item is not a valid virtual dom node", vnode)
	        }
	        return null
	    }

	    var node = (vnode.namespace === null) ?
	        doc.createElement(vnode.tagName) :
	        doc.createElementNS(vnode.namespace, vnode.tagName)

	    var props = vnode.properties
	    applyProperties(node, props)

	    var children = vnode.children

	    for (var i = 0; i < children.length; i++) {
	        var childNode = createElement(children[i], opts)
	        if (childNode) {
	            node.appendChild(childNode)
	        }
	    }

	    return node
	}


/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	var isVNode = __webpack_require__(3)
	var isVText = __webpack_require__(8)
	var isWidget = __webpack_require__(2)
	var isThunk = __webpack_require__(6)

	module.exports = handleThunk

	function handleThunk(a, b) {
	    var renderedA = a
	    var renderedB = b

	    if (isThunk(b)) {
	        renderedB = renderThunk(b, a)
	    }

	    if (isThunk(a)) {
	        renderedA = renderThunk(a, null)
	    }

	    return {
	        a: renderedA,
	        b: renderedB
	    }
	}

	function renderThunk(thunk, previous) {
	    var renderedThunk = thunk.vnode

	    if (!renderedThunk) {
	        renderedThunk = thunk.vnode = thunk.render(previous)
	    }

	    if (!(isVNode(renderedThunk) ||
	            isVText(renderedThunk) ||
	            isWidget(renderedThunk))) {
	        throw new Error("thunk did not return a valid node");
	    }

	    return renderedThunk
	}


/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	var version = __webpack_require__(4)

	VirtualPatch.NONE = 0
	VirtualPatch.VTEXT = 1
	VirtualPatch.VNODE = 2
	VirtualPatch.WIDGET = 3
	VirtualPatch.PROPS = 4
	VirtualPatch.ORDER = 5
	VirtualPatch.INSERT = 6
	VirtualPatch.REMOVE = 7
	VirtualPatch.THUNK = 8

	module.exports = VirtualPatch

	function VirtualPatch(type, vNode, patch) {
	    this.type = Number(type)
	    this.vNode = vNode
	    this.patch = patch
	}

	VirtualPatch.prototype.version = version
	VirtualPatch.prototype.type = "VirtualPatch"


/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _lodash = __webpack_require__(70);

	var _lodash2 = _interopRequireDefault(_lodash);

	var _h = __webpack_require__(11);

	var _h2 = _interopRequireDefault(_h);

	var _diff = __webpack_require__(77);

	var _diff2 = _interopRequireDefault(_diff);

	var _patch = __webpack_require__(78);

	var _patch2 = _interopRequireDefault(_patch);

	var _conversions = __webpack_require__(1);

	var _LoaderFactory = __webpack_require__(33);

	var _LoaderFactory2 = _interopRequireDefault(_LoaderFactory);

	var _ScrollHook = __webpack_require__(30);

	var _ScrollHook2 = _interopRequireDefault(_ScrollHook);

	var _TimeScale = __webpack_require__(26);

	var _TimeScale2 = _interopRequireDefault(_TimeScale);

	var _Track = __webpack_require__(27);

	var _Track2 = _interopRequireDefault(_Track);

	var _Playout = __webpack_require__(25);

	var _Playout2 = _interopRequireDefault(_Playout);

	var _recorderWorker = __webpack_require__(93);

	var _recorderWorker2 = _interopRequireDefault(_recorderWorker);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var _class = function () {
	    function _class() {
	        _classCallCheck(this, _class);

	        this.tracks = [];
	        this.soloedTracks = [];
	        this.mutedTracks = [];
	        this.playoutPromises = [];

	        this.cursor = 0;
	        this.playbackSeconds = 0;
	        this.duration = 0;
	        this.scrollLeft = 0;

	        this.fadeType = "logarithmic";
	    }

	    _createClass(_class, [{
	        key: 'initRecorder',
	        value: function initRecorder(stream) {
	            var _this = this;

	            if (stream === undefined || stream instanceof LocalMediaStream !== true) {
	                throw new Error("Must provide a LocalMediaStream to record from");
	            }

	            this.mediaRecorder = new MediaRecorder(stream);

	            this.mediaRecorder.onstart = function (e) {
	                var track = new _Track2.default();
	                track.setName("Recording");
	                track.setEnabledStates();
	                track.setEventEmitter(_this.ee);

	                _this.recordingTrack = track;
	                _this.tracks.push(track);

	                _this.chunks = [];
	            };

	            this.mediaRecorder.ondataavailable = function (e) {
	                _this.chunks.push(e.data);

	                var recording = new Blob(_this.chunks, { 'type': 'audio/ogg; codecs=opus' });
	                var loader = _LoaderFactory2.default.createLoader(recording, _this.ac);
	                loader.load().then(function (audioBuffer) {
	                    //ask web worker for peaks.
	                    _this.recorderWorker.postMessage({
	                        samples: audioBuffer.getChannelData(0),
	                        samplesPerPixel: _this.samplesPerPixel
	                    });
	                    _this.recordingTrack.setCues(0, audioBuffer.duration);
	                    _this.recordingTrack.setBuffer(audioBuffer);
	                    _this.recordingTrack.setPlayout(new _Playout2.default(_this.ac, audioBuffer));
	                    _this.adjustDuration();
	                });
	            };

	            //use a worker for calculating recording peaks.
	            this.recorderWorker = new _recorderWorker2.default();
	            this.recorderWorker.onmessage = function (e) {
	                _this.recordingTrack.setPeaks(e.data);
	                _this.draw(_this.render());
	            };
	        }
	    }, {
	        key: 'setMono',
	        value: function setMono(mono) {
	            this.mono = mono;
	        }
	    }, {
	        key: 'setSampleRate',
	        value: function setSampleRate(sampleRate) {
	            this.sampleRate = sampleRate;
	        }
	    }, {
	        key: 'setSamplesPerPixel',
	        value: function setSamplesPerPixel(samplesPerPixel) {
	            this.samplesPerPixel = samplesPerPixel;
	        }
	    }, {
	        key: 'setAudioContext',
	        value: function setAudioContext(ac) {
	            this.ac = ac;
	        }
	    }, {
	        key: 'setControlOptions',
	        value: function setControlOptions(controlOptions) {
	            this.controls = controlOptions;
	        }
	    }, {
	        key: 'setWaveHeight',
	        value: function setWaveHeight(height) {
	            this.waveHeight = height;
	        }
	    }, {
	        key: 'setColors',
	        value: function setColors(colors) {
	            this.colors = colors;
	        }
	    }, {
	        key: 'setEventEmitter',
	        value: function setEventEmitter(ee) {
	            this.ee = ee;
	        }
	    }, {
	        key: 'getEventEmitter',
	        value: function getEventEmitter() {
	            return this.ee;
	        }
	    }, {
	        key: 'setUpEventEmitter',
	        value: function setUpEventEmitter() {
	            var _this2 = this;

	            var ee = this.ee;

	            ee.on('select', function (start, end, track) {

	                if (_this2.isPlaying()) {
	                    _this2.lastSeeked = start;
	                    _this2.pausedAt = undefined;
	                    _this2.restartPlayFrom(start);
	                } else {
	                    //reset if it was paused.
	                    _this2.playbackSeconds = 0;
	                    _this2.setTimeSelection(start, end);
	                    _this2.setActiveTrack(track);
	                    _this2.draw(_this2.render());
	                }
	            });

	            ee.on('statechange', function (state) {
	                _this2.setState(state);
	                _this2.draw(_this2.render());
	            });

	            ee.on('shift', function (deltaTime, track) {
	                track.setStartTime(track.getStartTime() + deltaTime);
	                _this2.adjustDuration();
	                _this2.draw(_this2.render());
	            });

	            ee.on('record', function () {
	                _this2.record();
	            });

	            ee.on('play', function () {
	                _this2.play();
	            });

	            ee.on('pause', function () {
	                _this2.pause();
	            });

	            ee.on('stop', function () {
	                _this2.stop();
	            });

	            ee.on('rewind', function () {
	                _this2.rewind();
	            });

	            ee.on('fastforward', function () {
	                _this2.fastForward();
	            });

	            ee.on('solo', function (track) {
	                _this2.soloTrack(track);
	                _this2.adjustTrackPlayout();
	                _this2.draw(_this2.render());
	            });

	            ee.on('mute', function (track) {
	                _this2.muteTrack(track);
	                _this2.adjustTrackPlayout();
	                _this2.draw(_this2.render());
	            });

	            ee.on('volumechange', function (volume, track) {
	                track.setGainLevel(volume / 100);
	            });

	            ee.on('fadein', function (duration, track) {
	                track.setFadeIn(duration, _this2.fadeType);
	                _this2.draw(_this2.render());
	            });

	            ee.on('fadeout', function (duration, track) {
	                track.setFadeOut(duration, _this2.fadeType);
	                _this2.draw(_this2.render());
	            });

	            ee.on('fadetype', function (type) {
	                _this2.fadeType = type;
	            });

	            ee.on('newtrack', function (file) {
	                _this2.load([{
	                    src: file,
	                    name: file.name
	                }]);
	            });

	            ee.on('trim', function () {
	                var track = _this2.getActiveTrack();
	                var timeSelection = _this2.getTimeSelection();

	                track.trim(timeSelection.start, timeSelection.end);
	                track.calculatePeaks(_this2.samplesPerPixel, _this2.sampleRate);

	                _this2.setTimeSelection(0, 0);
	                _this2.draw(_this2.render());
	            });

	            ee.on('zoomin', function () {
	                var zoomIndex = Math.max(0, _this2.zoomIndex - 1);
	                var zoom = _this2.zoomLevels[zoomIndex];

	                if (zoom !== _this2.samplesPerPixel) {
	                    _this2.setZoom(zoom);
	                    _this2.draw(_this2.render());
	                }
	            });

	            ee.on('zoomout', function () {
	                var zoomIndex = Math.min(_this2.zoomLevels.length - 1, _this2.zoomIndex + 1);
	                var zoom = _this2.zoomLevels[zoomIndex];

	                if (zoom !== _this2.samplesPerPixel) {
	                    _this2.setZoom(zoom);
	                    _this2.draw(_this2.render());
	                }
	            });

	            ee.on('scroll', function () {
	                _this2.draw(_this2.render());
	            });
	        }
	    }, {
	        key: 'load',
	        value: function load(trackList) {
	            var _this3 = this;

	            var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

	            var loadPromises = trackList.map(function (trackInfo) {
	                var loader = _LoaderFactory2.default.createLoader(trackInfo.src, _this3.ac);
	                return loader.load();
	            });

	            return Promise.all(loadPromises).then(function (audioBuffers) {
	                var tracks = audioBuffers.map(function (audioBuffer, index) {
	                    var info = trackList[index];
	                    var name = info.name || "Untitled";
	                    var start = info.start || 0;
	                    var states = info.states || {};
	                    var fadeIn = info.fadeIn;
	                    var fadeOut = info.fadeOut;
	                    var cueIn = info.cuein || 0;
	                    var cueOut = info.cueout || audioBuffer.duration;
	                    var selection = info.selected;
	                    var peaks = info.peaks || { type: "WebAudio", mono: _this3.mono };

	                    //webaudio specific playout for now.
	                    var playout = new _Playout2.default(_this3.ac, audioBuffer);

	                    var track = new _Track2.default();
	                    track.src = info.src;
	                    track.setBuffer(audioBuffer);
	                    track.setName(name);
	                    track.setEventEmitter(_this3.ee);
	                    track.setEnabledStates(states);
	                    track.setCues(cueIn, cueOut);

	                    if (fadeIn !== undefined) {
	                        track.setFadeIn(fadeIn.duration, fadeIn.shape);
	                    }

	                    if (fadeOut !== undefined) {
	                        track.setFadeOut(fadeOut.duration, fadeOut.shape);
	                    }

	                    if (selection !== undefined) {
	                        _this3.setActiveTrack(track);
	                        _this3.setTimeSelection(selection.start, selection.end);
	                    }

	                    if (peaks !== undefined) {
	                        track.setPeakData(peaks);
	                    }

	                    track.setState(_this3.getState());
	                    track.setStartTime(start);
	                    track.setPlayout(playout);

	                    //extract peaks with AudioContext for now.
	                    track.calculatePeaks(_this3.samplesPerPixel, _this3.sampleRate);

	                    return track;
	                });

	                _this3.tracks = _this3.tracks.concat(tracks);
	                _this3.adjustDuration();
	                _this3.draw(_this3.render());
	            });
	        }

	        /*
	            track instance of Track.
	        */

	    }, {
	        key: 'setActiveTrack',
	        value: function setActiveTrack(track) {
	            this.activeTrack = track;
	        }
	    }, {
	        key: 'getActiveTrack',
	        value: function getActiveTrack() {
	            return this.activeTrack;
	        }

	        /*
	            start, end in seconds.
	        */

	    }, {
	        key: 'setTimeSelection',
	        value: function setTimeSelection(start, end) {
	            this.timeSelection = {
	                start: start,
	                end: end
	            };

	            this.cursor = start;
	        }
	    }, {
	        key: 'getTimeSelection',
	        value: function getTimeSelection() {
	            return this.timeSelection;
	        }
	    }, {
	        key: 'setState',
	        value: function setState(state) {
	            this.state = state;

	            this.tracks.forEach(function (track) {
	                track.setState(state);
	            });
	        }
	    }, {
	        key: 'getState',
	        value: function getState() {
	            return this.state;
	        }
	    }, {
	        key: 'setZoomIndex',
	        value: function setZoomIndex(index) {
	            this.zoomIndex = index;
	        }
	    }, {
	        key: 'setZoomLevels',
	        value: function setZoomLevels(levels) {
	            this.zoomLevels = levels;
	        }
	    }, {
	        key: 'setZoom',
	        value: function setZoom(zoom) {
	            var _this4 = this;

	            this.samplesPerPixel = zoom;
	            this.zoomIndex = this.zoomLevels.indexOf(zoom);
	            this.tracks.forEach(function (track) {
	                track.calculatePeaks(zoom, _this4.sampleRate);
	            });
	        }
	    }, {
	        key: 'muteTrack',
	        value: function muteTrack(track) {
	            var mutedList = this.mutedTracks;
	            var index = mutedList.indexOf(track);

	            if (index > -1) {
	                mutedList.splice(index, 1);
	            } else {
	                mutedList.push(track);
	            }
	        }
	    }, {
	        key: 'soloTrack',
	        value: function soloTrack(track) {
	            var soloedList = this.soloedTracks;
	            var index = soloedList.indexOf(track);

	            if (index > -1) {
	                soloedList.splice(index, 1);
	            } else {
	                soloedList.push(track);
	            }
	        }
	    }, {
	        key: 'adjustTrackPlayout',
	        value: function adjustTrackPlayout() {
	            var _this5 = this;

	            var masterGain;

	            this.tracks.forEach(function (track) {
	                masterGain = _this5.shouldTrackPlay(track) ? 1 : 0;
	                track.setMasterGainLevel(masterGain);
	            });
	        }
	    }, {
	        key: 'adjustDuration',
	        value: function adjustDuration() {
	            this.duration = this.tracks.reduce(function (duration, track) {
	                return Math.max(duration, track.getEndTime());
	            }, 0);
	        }
	    }, {
	        key: 'shouldTrackPlay',
	        value: function shouldTrackPlay(track) {
	            var shouldPlay;
	            //if there are solo tracks, only they should play.
	            if (this.soloedTracks.length > 0) {
	                shouldPlay = false;
	                if (this.soloedTracks.indexOf(track) > -1) {
	                    shouldPlay = true;
	                }
	            }
	            //play all tracks except any muted tracks.
	            else {
	                    shouldPlay = true;
	                    if (this.mutedTracks.indexOf(track) > -1) {
	                        shouldPlay = false;
	                    }
	                }

	            return shouldPlay;
	        }
	    }, {
	        key: 'isPlaying',
	        value: function isPlaying() {
	            return this.tracks.reduce(function (isPlaying, track) {
	                return isPlaying || track.isPlaying();
	            }, false);
	        }

	        /*
	        *   returns the current point of time in the playlist in seconds.
	        */

	    }, {
	        key: 'getCurrentTime',
	        value: function getCurrentTime() {
	            var cursorPos = this.lastSeeked || this.pausedAt || this.cursor;

	            return cursorPos + this.getElapsedTime();
	        }
	    }, {
	        key: 'getElapsedTime',
	        value: function getElapsedTime() {
	            return this.ac.currentTime - this.lastPlay;
	        }
	    }, {
	        key: 'restartPlayFrom',
	        value: function restartPlayFrom(cursorPos) {
	            this.stopAnimation();

	            this.tracks.forEach(function (editor) {
	                editor.scheduleStop();
	            });

	            return Promise.all(this.playoutPromises).then(this.play.bind(this, cursorPos));
	        }
	    }, {
	        key: 'play',
	        value: function play(startTime) {
	            var _this6 = this;

	            var currentTime = this.ac.currentTime,
	                endTime,
	                selected = this.getTimeSelection(),
	                playoutPromises = [];

	            startTime = startTime || this.pausedAt || this.cursor;

	            if (selected.end !== selected.start && selected.end > startTime) {
	                endTime = selected.end;
	            }

	            this.tracks.forEach(function (track) {
	                track.setState('cursor');
	                playoutPromises.push(track.schedulePlay(currentTime, startTime, endTime, {
	                    masterGain: _this6.shouldTrackPlay(track) ? 1 : 0
	                }));
	            });

	            this.lastPlay = currentTime;
	            //use these to track when the playlist has fully stopped.
	            this.playoutPromises = playoutPromises;
	            this.startAnimation(startTime);

	            return Promise.all(this.playoutPromises);
	        }
	    }, {
	        key: 'pause',
	        value: function pause() {
	            if (!this.isPlaying()) {
	                return;
	            }

	            this.pausedAt = this.getCurrentTime();
	            return this.playbackReset();
	        }
	    }, {
	        key: 'stop',
	        value: function stop() {
	            this.mediaRecorder && this.mediaRecorder.state === "recording" && this.mediaRecorder.stop();

	            this.pausedAt = undefined;
	            this.playbackSeconds = 0;
	            return this.playbackReset();
	        }
	    }, {
	        key: 'playbackReset',
	        value: function playbackReset() {
	            var _this7 = this;

	            this.lastSeeked = undefined;
	            this.stopAnimation();

	            this.tracks.forEach(function (track) {
	                track.scheduleStop();
	                track.setState(_this7.getState());
	            });

	            this.draw(this.render());

	            return Promise.all(this.playoutPromises);
	        }
	    }, {
	        key: 'rewind',
	        value: function rewind() {
	            var _this8 = this;

	            return this.stop().then(function () {
	                _this8.scrollLeft = 0;
	                _this8.ee.emit('select', 0, 0);
	            });
	        }
	    }, {
	        key: 'fastForward',
	        value: function fastForward() {
	            var _this9 = this;

	            return this.stop().then(function () {
	                if (_this9.viewDuration < _this9.duration) {
	                    _this9.scrollLeft = _this9.duration - _this9.viewDuration;
	                } else {
	                    _this9.scrollLeft = 0;
	                }

	                _this9.ee.emit('select', _this9.duration, _this9.duration);
	            });
	        }
	    }, {
	        key: 'record',
	        value: function record() {
	            var _this10 = this;

	            var playoutPromises = [];
	            this.mediaRecorder.start(300);

	            this.tracks.forEach(function (track) {
	                track.setState('none');
	                playoutPromises.push(track.schedulePlay(_this10.ac.currentTime, 0, undefined, {
	                    masterGain: _this10.shouldTrackPlay(track) ? 1 : 0
	                }));
	            });

	            this.playoutPromises = playoutPromises;
	        }
	    }, {
	        key: 'startAnimation',
	        value: function startAnimation(startTime) {
	            this.lastDraw = this.ac.currentTime;
	            this.animationRequest = window.requestAnimationFrame(this.updateEditor.bind(this, startTime));
	        }
	    }, {
	        key: 'stopAnimation',
	        value: function stopAnimation() {
	            window.cancelAnimationFrame(this.animationRequest);
	            this.lastDraw = undefined;
	        }

	        /*
	        * Animation function for the playlist.
	        */

	    }, {
	        key: 'updateEditor',
	        value: function updateEditor(cursorPos) {
	            var currentTime = this.ac.currentTime;
	            var playbackSeconds = 0;
	            var elapsed = undefined;

	            cursorPos = cursorPos || this.cursor;
	            elapsed = currentTime - this.lastDraw;

	            if (this.isPlaying()) {
	                playbackSeconds = cursorPos + elapsed;
	                this.ee.emit('timeupdate', playbackSeconds);
	                this.animationRequest = window.requestAnimationFrame(this.updateEditor.bind(this, playbackSeconds));
	            } else {
	                this.stopAnimation();
	                this.pausedAt = undefined;
	                this.lastSeeked = undefined;
	                this.setState(this.getState());
	            }

	            this.playbackSeconds = playbackSeconds;

	            this.draw(this.render());
	            this.lastDraw = currentTime;
	        }
	    }, {
	        key: 'draw',
	        value: function draw(newTree) {
	            var _this11 = this;

	            window.requestAnimationFrame(function () {
	                var patches = (0, _diff2.default)(_this11.tree, newTree);
	                _this11.rootNode = (0, _patch2.default)(_this11.rootNode, patches);
	                _this11.tree = newTree;

	                //use for fast forwarding.
	                _this11.viewDuration = (0, _conversions.pixelsToSeconds)(_this11.rootNode.clientWidth - _this11.controls.width, _this11.samplesPerPixel, _this11.sampleRate);
	            });
	        }
	    }, {
	        key: 'getTrackRenderData',
	        value: function getTrackRenderData() {
	            var data = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

	            var defaults = {
	                "height": this.waveHeight,
	                "resolution": this.samplesPerPixel,
	                "sampleRate": this.sampleRate,
	                "controls": this.controls,
	                "isActive": false,
	                "timeSelection": this.getTimeSelection(),
	                "playlistLength": this.duration,
	                "playbackSeconds": this.playbackSeconds,
	                "colors": this.colors
	            };

	            return (0, _lodash2.default)(data, defaults);
	        }
	    }, {
	        key: 'render',
	        value: function render() {
	            var _this12 = this;

	            var controlWidth = this.controls.show ? this.controls.width : 0;
	            var timeScale = new _TimeScale2.default(this.duration, this.scrollLeft, this.samplesPerPixel, this.sampleRate, controlWidth);

	            var activeTrack = this.getActiveTrack();
	            var trackElements = this.tracks.map(function (track) {
	                return track.render(_this12.getTrackRenderData({
	                    "isActive": activeTrack === track ? true : false,
	                    "masterGain": _this12.shouldTrackPlay(track) ? 1 : 0,
	                    "soloed": _this12.soloedTracks.indexOf(track) > -1,
	                    "muted": _this12.mutedTracks.indexOf(track) > -1
	                }));
	            });

	            return (0, _h2.default)("div.playlist", {
	                "attributes": {
	                    "style": "overflow: hidden; position: relative;"
	                } }, [timeScale.render(), (0, _h2.default)("div.playlist-tracks", {
	                "attributes": {
	                    "style": "overflow: auto;"
	                },
	                "ev-scroll": function evScroll(e) {
	                    _this12.scrollLeft = (0, _conversions.pixelsToSeconds)(e.target.scrollLeft, _this12.samplesPerPixel, _this12.sampleRate);
	                    _this12.ee.emit("scroll", _this12.scrollLeft);
	                },
	                "hook": new _ScrollHook2.default(this, this.samplesPerPixel, this.sampleRate)
	            }, trackElements)]);
	        }
	    }, {
	        key: 'getInfo',
	        value: function getInfo() {
	            var info = [];

	            this.tracks.forEach(function (track) {
	                info.push(track.getTrackDetails());
	            });

	            return info;
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _fades = __webpack_require__(9);

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var FADEIN = "FadeIn";
	var FADEOUT = "FadeOut";

	var _class = function () {
	    function _class(ac, buffer) {
	        _classCallCheck(this, _class);

	        this.ac = ac;
	        this.gain = 1;
	        this.buffer = buffer;
	        this.destination = this.ac.destination;
	    }

	    _createClass(_class, [{
	        key: 'applyFade',
	        value: function applyFade(type, start, duration) {
	            var shape = arguments.length <= 3 || arguments[3] === undefined ? "logarithmic" : arguments[3];

	            if (type === FADEIN) {
	                (0, _fades.createFadeIn)(this.fadeGain.gain, shape, start, duration);
	            } else if (type === FADEOUT) {
	                (0, _fades.createFadeOut)(this.fadeGain.gain, shape, start, duration);
	            } else {
	                throw new Error("Unsupported fade type");
	            }
	        }
	    }, {
	        key: 'applyFadeIn',
	        value: function applyFadeIn(start, duration) {
	            var shape = arguments.length <= 2 || arguments[2] === undefined ? "logarithmic" : arguments[2];

	            this.applyFade(FADEIN, start, duration, shape);
	        }
	    }, {
	        key: 'applyFadeOut',
	        value: function applyFadeOut(start, duration) {
	            var shape = arguments.length <= 2 || arguments[2] === undefined ? "logarithmic" : arguments[2];

	            this.applyFade(FADEOUT, start, duration, shape);
	        }
	    }, {
	        key: 'isPlaying',
	        value: function isPlaying() {
	            return this.source !== undefined;
	        }
	    }, {
	        key: 'getDuration',
	        value: function getDuration() {
	            return this.buffer.duration;
	        }
	    }, {
	        key: 'setUpSource',
	        value: function setUpSource() {
	            var _this = this;

	            var sourcePromise;

	            this.source = this.ac.createBufferSource();
	            this.source.buffer = this.buffer;

	            sourcePromise = new Promise(function (resolve, reject) {
	                //keep track of the buffer state.
	                _this.source.onended = function (e) {
	                    _this.source.disconnect();
	                    _this.fadeGain.disconnect();
	                    _this.outputGain.disconnect();
	                    _this.masterGain.disconnect();

	                    _this.source = undefined;
	                    _this.fadeGain = undefined;
	                    _this.outputGain = undefined;
	                    _this.masterGain = undefined;

	                    resolve();
	                };
	            });

	            this.fadeGain = this.ac.createGain();
	            //used for track volume slider
	            this.outputGain = this.ac.createGain();
	            //used for solo/mute
	            this.masterGain = this.ac.createGain();

	            this.source.connect(this.fadeGain);
	            this.fadeGain.connect(this.outputGain);
	            this.outputGain.connect(this.masterGain);
	            this.masterGain.connect(this.destination);

	            return sourcePromise;
	        }
	    }, {
	        key: 'setGainLevel',
	        value: function setGainLevel(level) {
	            this.outputGain && (this.outputGain.gain.value = level);
	        }
	    }, {
	        key: 'setMasterGainLevel',
	        value: function setMasterGainLevel(level) {
	            this.masterGain && (this.masterGain.gain.value = level);
	        }

	        /*
	            source.start is picky when passing the end time. 
	            If rounding error causes a number to make the source think 
	            it is playing slightly more samples than it has it won't play at all.
	            Unfortunately it doesn't seem to work if you just give it a start time.
	        */

	    }, {
	        key: 'play',
	        value: function play(when, start, duration) {
	            this.source.start(when, start, duration);
	        }
	    }, {
	        key: 'stop',
	        value: function stop() {
	            var when = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

	            this.source && this.source.stop(when);
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _conversions = __webpack_require__(1);

	var _h = __webpack_require__(11);

	var _h2 = _interopRequireDefault(_h);

	var _TimeScaleHook = __webpack_require__(31);

	var _TimeScaleHook2 = _interopRequireDefault(_TimeScaleHook);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var _class = function () {
	    function _class(duration, offset, samplesPerPixel, sampleRate) {
	        var marginLeft = arguments.length <= 4 || arguments[4] === undefined ? 0 : arguments[4];

	        _classCallCheck(this, _class);

	        this.duration = duration;
	        this.offset = offset;
	        this.samplesPerPixel = samplesPerPixel;
	        this.sampleRate = sampleRate;
	        this.marginLeft = marginLeft;

	        this.timeinfo = {
	            20000: {
	                marker: 30000,
	                bigStep: 10000,
	                smallStep: 5000,
	                secondStep: 5
	            },
	            12000: {
	                marker: 15000,
	                bigStep: 5000,
	                smallStep: 1000,
	                secondStep: 1
	            },
	            10000: {
	                marker: 10000,
	                bigStep: 5000,
	                smallStep: 1000,
	                secondStep: 1
	            },
	            5000: {
	                marker: 5000,
	                bigStep: 1000,
	                smallStep: 500,
	                secondStep: 1 / 2
	            },
	            2500: {
	                marker: 2000,
	                bigStep: 1000,
	                smallStep: 500,
	                secondStep: 1 / 2
	            },
	            1500: {
	                marker: 2000,
	                bigStep: 1000,
	                smallStep: 200,
	                secondStep: 1 / 5
	            },
	            700: {
	                marker: 1000,
	                bigStep: 500,
	                smallStep: 100,
	                secondStep: 1 / 10
	            }
	        };
	    }

	    _createClass(_class, [{
	        key: 'getScaleInfo',
	        value: function getScaleInfo(resolution) {
	            var keys, i, end;

	            keys = Object.keys(this.timeinfo).map(function (item) {
	                return parseInt(item, 10);
	            });

	            //make sure keys are numerically sorted.
	            keys = keys.sort(function (a, b) {
	                return a - b;
	            });

	            for (i = 0, end = keys.length; i < end; i++) {
	                if (resolution <= keys[i]) {
	                    return this.timeinfo[keys[i]];
	                }
	            }
	        }

	        /*
	            Return time in format mm:ss
	        */

	    }, {
	        key: 'formatTime',
	        value: function formatTime(milliseconds) {
	            var out, m, s, seconds;

	            seconds = milliseconds / 1000;

	            s = seconds % 60;
	            m = (seconds - s) / 60;

	            if (s < 10) {
	                s = "0" + s;
	            }

	            out = m + ":" + s;

	            return out;
	        }
	    }, {
	        key: 'render',
	        value: function render() {
	            var widthX = (0, _conversions.secondsToPixels)(this.duration, this.samplesPerPixel, this.sampleRate);
	            var pixPerSec = this.sampleRate / this.samplesPerPixel;
	            var pixOffset = (0, _conversions.secondsToPixels)(this.offset, this.samplesPerPixel, this.sampleRate);
	            var scaleInfo = this.getScaleInfo(this.samplesPerPixel);
	            var canvasInfo = {};
	            var timeMarkers = [];
	            var i = undefined;
	            var end = widthX + pixOffset;
	            var pixIndex = undefined;
	            var pix = undefined;
	            var counter = 0;

	            for (i = 0; i < end; i = i + pixPerSec * scaleInfo.secondStep) {

	                pixIndex = ~ ~i;
	                pix = pixIndex - pixOffset;

	                if (pixIndex >= pixOffset) {
	                    //put a timestamp every 30 seconds.
	                    if (scaleInfo.marker && counter % scaleInfo.marker === 0) {
	                        timeMarkers.push((0, _h2.default)("div.time", { attributes: {
	                                "style": 'position: absolute; left: ' + pix + 'px;'
	                            } }, [this.formatTime(counter)]));

	                        canvasInfo[pix] = 10;
	                    } else if (scaleInfo.bigStep && counter % scaleInfo.bigStep === 0) {
	                        canvasInfo[pix] = 5;
	                    } else if (scaleInfo.smallStep && counter % scaleInfo.smallStep === 0) {
	                        canvasInfo[pix] = 2;
	                    }
	                }

	                counter += 1000 * scaleInfo.secondStep;
	            }

	            return (0, _h2.default)("div.playlist-time-scale", {
	                "attributes": {
	                    "style": 'position: relative; left: 0; right: 0; margin-left: ' + this.marginLeft + 'px;'
	                } }, [timeMarkers, (0, _h2.default)("canvas", {
	                attributes: {
	                    "width": widthX,
	                    "height": 30,
	                    "style": "position: absolute; left: 0; right: 0; top: 0; bottom: 0;"
	                },
	                "hook": new _TimeScaleHook2.default(canvasInfo, this.offset, this.samplesPerPixel, this.duration)
	            })]);
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _lodash = __webpack_require__(18);

	var _lodash2 = _interopRequireDefault(_lodash);

	var _lodash3 = __webpack_require__(71);

	var _lodash4 = _interopRequireDefault(_lodash3);

	var _uuid = __webpack_require__(75);

	var _uuid2 = _interopRequireDefault(_uuid);

	var _h = __webpack_require__(11);

	var _h2 = _interopRequireDefault(_h);

	var _conversions = __webpack_require__(1);

	var _peaks = __webpack_require__(41);

	var _peaks2 = _interopRequireDefault(_peaks);

	var _states = __webpack_require__(35);

	var _states2 = _interopRequireDefault(_states);

	var _CanvasHook = __webpack_require__(28);

	var _CanvasHook2 = _interopRequireDefault(_CanvasHook);

	var _FadeCanvasHook = __webpack_require__(29);

	var _FadeCanvasHook2 = _interopRequireDefault(_FadeCanvasHook);

	var _fades = __webpack_require__(9);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var MAX_CANVAS_WIDTH = 1000;

	var _class = function () {
	    function _class() {
	        _classCallCheck(this, _class);

	        this.name = "Untitled";
	        this.gain = 1;
	        this.fades = {};
	        this.peakData = {
	            type: "WebAudio",
	            mono: false
	        };

	        this.cueIn = 0;
	        this.cueOut = 0;
	        this.duration = 0;
	        this.startTime = 0;
	        this.endTime = 0;
	    }

	    _createClass(_class, [{
	        key: 'setEventEmitter',
	        value: function setEventEmitter(ee) {
	            this.ee = ee;
	        }
	    }, {
	        key: 'setName',
	        value: function setName(name) {
	            this.name = name;
	        }
	    }, {
	        key: 'setCues',
	        value: function setCues(cueIn, cueOut) {
	            if (cueOut < cueIn) {
	                throw new Error("cue out cannot be less than cue in");
	            }

	            this.cueIn = cueIn;
	            this.cueOut = cueOut;
	            this.duration = this.cueOut - this.cueIn;
	            this.endTime = this.startTime + this.duration;
	        }

	        /*
	        *   start, end in seconds relative to the entire playlist.
	        */

	    }, {
	        key: 'trim',
	        value: function trim(start, end) {
	            var trackStart = this.getStartTime();
	            var trackEnd = this.getEndTime();
	            var offset = this.cueIn - trackStart;

	            if (trackStart <= start && trackEnd >= start || trackStart <= end && trackEnd >= end) {

	                var cueIn = start < trackStart ? trackStart : start;
	                var cueOut = end > trackEnd ? trackEnd : end;

	                this.setCues(cueIn + offset, cueOut + offset);
	                if (start > trackStart) {
	                    this.setStartTime(start);
	                }
	            }
	        }
	    }, {
	        key: 'setStartTime',
	        value: function setStartTime(start) {
	            this.startTime = start;
	            this.endTime = start + this.duration;
	        }
	    }, {
	        key: 'setPlayout',
	        value: function setPlayout(playout) {
	            this.playout = playout;
	        }
	    }, {
	        key: 'setEnabledStates',
	        value: function setEnabledStates() {
	            var enabledStates = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

	            var defaultStatesEnabled = {
	                'cursor': true,
	                'fadein': true,
	                'fadeout': true,
	                'select': true,
	                'shift': true
	            };

	            this.enabledStates = (0, _lodash2.default)(defaultStatesEnabled, enabledStates);
	        }
	    }, {
	        key: 'setFadeIn',
	        value: function setFadeIn(duration) {
	            var shape = arguments.length <= 1 || arguments[1] === undefined ? "logarithmic" : arguments[1];

	            if (duration > this.duration) {
	                throw new Error("Invalid Fade In");
	            }

	            var fade = {
	                "shape": shape,
	                "start": 0,
	                "end": duration
	            };

	            if (this.fadeIn) {
	                this.removeFade(this.fadeIn);
	                this.fadeIn = undefined;
	            }

	            this.fadeIn = this.saveFade(_fades.FADEIN, fade.shape, fade.start, fade.end);
	        }
	    }, {
	        key: 'setFadeOut',
	        value: function setFadeOut(duration) {
	            var shape = arguments.length <= 1 || arguments[1] === undefined ? "logarithmic" : arguments[1];

	            if (duration > this.duration) {
	                throw new Error("Invalid Fade Out");
	            }

	            var fade = {
	                "shape": shape,
	                "start": this.duration - duration,
	                "end": this.duration
	            };

	            if (this.fadeOut) {
	                this.removeFade(this.fadeOut);
	                this.fadeOut = undefined;
	            }

	            this.fadeOut = this.saveFade(_fades.FADEOUT, fade.shape, fade.start, fade.end);
	        }
	    }, {
	        key: 'saveFade',
	        value: function saveFade(type, shape, start, end) {
	            var id = _uuid2.default.v4();

	            this.fades[id] = {
	                type: type,
	                shape: shape,
	                start: start,
	                end: end
	            };

	            return id;
	        }
	    }, {
	        key: 'removeFade',
	        value: function removeFade(id) {
	            delete this.fades[id];
	        }
	    }, {
	        key: 'setBuffer',
	        value: function setBuffer(buffer) {
	            this.buffer = buffer;
	        }
	    }, {
	        key: 'setPeakData',
	        value: function setPeakData(data) {
	            this.peakData = data;
	        }
	    }, {
	        key: 'calculatePeaks',
	        value: function calculatePeaks(samplesPerPixel, sampleRate) {
	            var cueIn = (0, _conversions.secondsToSamples)(this.cueIn, sampleRate);
	            var cueOut = (0, _conversions.secondsToSamples)(this.cueOut, sampleRate);

	            this.setPeaks((0, _peaks2.default)(this.buffer, samplesPerPixel, this.peakData.mono, cueIn, cueOut));
	        }
	    }, {
	        key: 'setPeaks',
	        value: function setPeaks(peaks) {
	            this.peaks = peaks;
	        }
	    }, {
	        key: 'setState',
	        value: function setState(state) {
	            this.state = state;
	        }
	    }, {
	        key: 'getStartTime',
	        value: function getStartTime() {
	            return this.startTime;
	        }
	    }, {
	        key: 'getEndTime',
	        value: function getEndTime() {
	            return this.endTime;
	        }
	    }, {
	        key: 'getDuration',
	        value: function getDuration() {
	            return this.duration;
	        }
	    }, {
	        key: 'isPlaying',
	        value: function isPlaying() {
	            return this.playout.isPlaying();
	        }
	    }, {
	        key: 'setGainLevel',
	        value: function setGainLevel(level) {
	            this.gain = level;
	            this.playout.setGainLevel(level);
	        }
	    }, {
	        key: 'setMasterGainLevel',
	        value: function setMasterGainLevel(level) {
	            this.playout.setMasterGainLevel(level);
	        }

	        /*
	            startTime, endTime in seconds (float).
	            segment is for a highlighted section in the UI.
	             returns a Promise that will resolve when the AudioBufferSource
	            is either stopped or plays out naturally.
	        */

	    }, {
	        key: 'schedulePlay',
	        value: function schedulePlay(now, startTime, endTime, options) {
	            var _this = this;

	            var start,
	                duration,
	                relPos,
	                when = now,
	                segment = endTime ? endTime - startTime : undefined,
	                sourcePromise;

	            //1) track has no content to play.
	            //2) track does not play in this selection.
	            if (this.endTime <= startTime || segment && startTime + segment < this.startTime) {
	                //return a resolved promise since this track is technically "stopped".
	                return Promise.resolve();
	            }

	            //track should have something to play if it gets here.

	            //the track starts in the future or on the cursor position
	            if (this.startTime >= startTime) {
	                start = 0;
	                when = when + this.startTime - startTime; //schedule additional delay for this audio node.

	                if (endTime) {
	                    segment = segment - (this.startTime - startTime);
	                    duration = Math.min(segment, this.duration);
	                } else {
	                    duration = this.duration;
	                }
	            } else {
	                start = startTime - this.startTime;

	                if (endTime) {
	                    duration = Math.min(segment, this.duration - start);
	                } else {
	                    duration = this.duration - start;
	                }
	            }

	            start = start + this.cueIn;
	            relPos = startTime - this.startTime;

	            sourcePromise = this.playout.setUpSource();

	            //param relPos: cursor position in seconds relative to this track.
	            //can be negative if the cursor is placed before the start of this track etc.
	            (0, _lodash4.default)(this.fades, function (fade) {
	                var startTime = undefined;
	                var duration = undefined;

	                //only apply fade if it's ahead of the cursor.
	                if (relPos < fade.end) {
	                    if (relPos <= fade.start) {
	                        startTime = now + (fade.start - relPos);
	                        duration = fade.end - fade.start;
	                    } else if (relPos > fade.start && relPos < fade.end) {
	                        startTime = now - (relPos - fade.start);
	                        duration = fade.end - fade.start;
	                    }

	                    switch (fade.type) {
	                        case _fades.FADEIN:
	                            _this.playout.applyFadeIn(startTime, duration, fade.shape);
	                            break;
	                        case _fades.FADEOUT:
	                            _this.playout.applyFadeOut(startTime, duration, fade.shape);
	                            break;
	                        default:
	                            throw new Error("Invalid fade type saved on track.");
	                    }
	                }
	            });

	            this.playout.setGainLevel(this.gain);
	            this.playout.setMasterGainLevel(options.masterGain);
	            this.playout.play(when, start, duration);

	            return sourcePromise;
	        }
	    }, {
	        key: 'scheduleStop',
	        value: function scheduleStop() {
	            var when = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

	            this.playout.stop(when);
	        }
	    }, {
	        key: 'renderTimeSelection',
	        value: function renderTimeSelection(data) {
	            var startX = (0, _conversions.secondsToPixels)(data.timeSelection.start, data.resolution, data.sampleRate);
	            var endX = (0, _conversions.secondsToPixels)(data.timeSelection.end, data.resolution, data.sampleRate);
	            var width = endX - startX + 1;
	            var className = width > 1 ? "segment" : "point";

	            return (0, _h2.default)('div.selection.' + className, {
	                attributes: {
	                    "style": 'position: absolute; width: ' + width + 'px; bottom: 0; top: 0; left: ' + startX + 'px; z-index: 4;'
	                }
	            });
	        }
	    }, {
	        key: 'renderOverlay',
	        value: function renderOverlay(data) {
	            var _this2 = this;

	            var channelPixels = (0, _conversions.secondsToPixels)(data.playlistLength, data.resolution, data.sampleRate);

	            var config = {
	                attributes: {
	                    "style": 'position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: ' + channelPixels + 'px; z-index: 9;'
	                }
	            };

	            var stateClass = "";

	            if (this.state && this.enabledStates[this.state]) {
	                (function () {
	                    var state = new _states2.default[_this2.state](_this2, data.resolution, data.sampleRate);
	                    var stateEvents = state.getEvents();

	                    Object.keys(stateEvents).map(function (event) {
	                        config['ev-' + event] = stateEvents[event].bind(state);
	                    });

	                    stateClass = state.getClasses();
	                })();
	            }
	            //use this overlay for track event cursor position calculations.
	            return (0, _h2.default)('div.playlist-overlay' + stateClass, config);
	        }
	    }, {
	        key: 'renderControls',
	        value: function renderControls(data) {
	            var _this3 = this;

	            var muteClass = data.muted ? ".active" : "";
	            var soloClass = data.soloed ? ".active" : "";
	            var numChan = this.peaks.data.length;

	            return (0, _h2.default)("div.controls", {
	                attributes: {
	                    "style": 'height: ' + numChan * data.height + 'px; width: ' + data.controls.width + 'px; position: absolute; left: 0; z-index: 10;'
	                } }, [(0, _h2.default)("header", [this.name]), (0, _h2.default)("div.btn-group", [(0, _h2.default)('span.btn.btn-default.btn-xs.btn-mute' + muteClass, { "ev-click": function evClick() {
	                    _this3.ee.emit("mute", _this3);
	                } }, ["Mute"]), (0, _h2.default)('span.btn.btn-default.btn-xs.btn-solo' + soloClass, { "ev-click": function evClick() {
	                    _this3.ee.emit("solo", _this3);
	                } }, ["Solo"])]), (0, _h2.default)("label", [(0, _h2.default)("input.volume-slider", {
	                attributes: {
	                    "type": "range",
	                    "min": 0,
	                    "max": 100,
	                    "value": 100
	                },
	                "ev-input": function evInput(e) {
	                    _this3.ee.emit("volumechange", e.target.value, _this3);
	                }
	            })])]);
	        }
	    }, {
	        key: 'render',
	        value: function render(data) {
	            var _this4 = this;

	            var width = this.peaks.length;
	            var playbackX = (0, _conversions.secondsToPixels)(data.playbackSeconds, data.resolution, data.sampleRate);
	            var startX = (0, _conversions.secondsToPixels)(this.startTime, data.resolution, data.sampleRate);
	            var endX = (0, _conversions.secondsToPixels)(this.endTime, data.resolution, data.sampleRate);
	            var progressWidth = 0;
	            var numChan = this.peaks.data.length;

	            if (playbackX > 0 && playbackX > startX) {
	                if (playbackX < endX) {
	                    progressWidth = playbackX - startX;
	                } else {
	                    progressWidth = width;
	                }
	            }

	            var waveformChildren = [(0, _h2.default)("div.cursor", { attributes: {
	                    "style": 'position: absolute; width: 1px; margin: 0; padding: 0; top: 0; left: ' + playbackX + 'px; bottom: 0; z-index: 5;'
	                } })];

	            var channels = Object.keys(this.peaks.data).map(function (channelNum) {

	                var channelChildren = [(0, _h2.default)("div.channel-progress", { attributes: {
	                        "style": 'position: absolute; width: ' + progressWidth + 'px; height: ' + data.height + 'px; z-index: 2;'
	                    } })];
	                var offset = 0;
	                var totalWidth = width;
	                var peaks = _this4.peaks.data[channelNum];

	                while (totalWidth > 0) {
	                    var currentWidth = Math.min(totalWidth, MAX_CANVAS_WIDTH);

	                    channelChildren.push((0, _h2.default)("canvas", {
	                        attributes: {
	                            "width": currentWidth,
	                            "height": data.height,
	                            "style": "float: left; position: relative; margin: 0; padding: 0; z-index: 3;"
	                        },
	                        "hook": new _CanvasHook2.default(peaks, offset, _this4.peaks.bits, data.colors.waveOutlineColor)
	                    }));

	                    totalWidth -= currentWidth;
	                    offset += MAX_CANVAS_WIDTH;
	                }

	                //if there are fades, display them.
	                if (_this4.fadeIn) {
	                    var fadeIn = _this4.fades[_this4.fadeIn];
	                    var _width = (0, _conversions.secondsToPixels)(fadeIn.end - fadeIn.start, data.resolution, data.sampleRate);

	                    channelChildren.push((0, _h2.default)("div.wp-fade.wp-fadein", {
	                        attributes: {
	                            "style": 'position: absolute; height: ' + data.height + 'px; width: ' + _width + 'px; top: 0; left: 0; z-index: 4;'
	                        } }, [(0, _h2.default)("canvas", {
	                        attributes: {
	                            "width": _width,
	                            "height": data.height
	                        },
	                        "hook": new _FadeCanvasHook2.default(fadeIn.type, fadeIn.shape, fadeIn.end - fadeIn.start, data.resolution)
	                    })]));
	                }

	                if (_this4.fadeOut) {
	                    var fadeOut = _this4.fades[_this4.fadeOut];
	                    var _width2 = (0, _conversions.secondsToPixels)(fadeOut.end - fadeOut.start, data.resolution, data.sampleRate);

	                    channelChildren.push((0, _h2.default)("div.wp-fade.wp-fadeout", {
	                        attributes: {
	                            "style": 'position: absolute; height: ' + data.height + 'px; width: ' + _width2 + 'px; top: 0; right: 0; z-index: 4;'
	                        } }, [(0, _h2.default)("canvas", {
	                        attributes: {
	                            "width": _width2,
	                            "height": data.height
	                        },
	                        "hook": new _FadeCanvasHook2.default(fadeOut.type, fadeOut.shape, fadeOut.end - fadeOut.start, data.resolution)
	                    })]));
	                }

	                return (0, _h2.default)('div.channel.channel-' + channelNum, { attributes: {
	                        "style": 'height: ' + data.height + 'px; width: ' + width + 'px; top: ' + channelNum * data.height + 'px; left: ' + startX + 'px; position: absolute; margin: 0; padding: 0; z-index: 1;'
	                    } }, channelChildren);
	            });

	            var audibleClass = data.masterGain ? "" : ".silent";

	            waveformChildren.push(channels);
	            waveformChildren.push(this.renderOverlay(data));

	            //draw cursor selection on active track.
	            if (data.isActive === true) {
	                waveformChildren.push(this.renderTimeSelection(data));
	            }

	            var waveform = (0, _h2.default)("div.waveform", {
	                attributes: {
	                    "style": 'height: ' + numChan * data.height + 'px; position: relative;'
	                } }, waveformChildren);

	            var channelChildren = [];
	            var channelMargin = 0;

	            if (data.controls.show) {
	                channelChildren.push(this.renderControls(data));
	                channelMargin = data.controls.width;
	            }

	            channelChildren.push(waveform);

	            return (0, _h2.default)('div.channel-wrapper' + audibleClass, {
	                attributes: {
	                    "style": 'margin-left: ' + channelMargin + 'px; height: ' + data.height * numChan + 'px;'
	                } }, channelChildren);
	        }
	    }, {
	        key: 'getTrackDetails',
	        value: function getTrackDetails() {
	            var info = {
	                src: this.src,
	                start: this.startTime,
	                name: this.name,
	                cuein: this.cueIn,
	                cueout: this.cueOut
	            };

	            if (this.fadeIn) {
	                var fadeIn = this.fades[this.fadeIn];

	                info["fadeIn"] = {
	                    shape: fadeIn.shape,
	                    duration: fadeIn.end - fadeIn.start
	                };
	            }

	            if (this.fadeOut) {
	                var fadeOut = this.fades[this.fadeOut];

	                info["fadeOut"] = {
	                    shape: fadeOut.shape,
	                    duration: fadeOut.end - fadeOut.start
	                };
	            }

	            return info;
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 28 */
/***/ function(module, exports) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	function drawFrame(cc, h2, x, minPeak, maxPeak) {
	    var min = Math.abs(minPeak * h2);
	    var max = Math.abs(maxPeak * h2);

	    //draw maxs
	    cc.fillRect(x, 0, 1, h2 - max);
	    //draw mins
	    cc.fillRect(x, h2 + min, 1, h2 - min);
	}

	/*
	* virtual-dom hook for drawing to the canvas element.
	*/

	var _class = function () {
	    function _class(peaks, offset, bits, color) {
	        _classCallCheck(this, _class);

	        this.peaks = peaks;
	        this.offset = offset; //http://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
	        this.color = color;
	        this.bits = bits;
	    }

	    _createClass(_class, [{
	        key: 'hook',
	        value: function hook(canvas, prop, prev) {
	            //canvas is up to date
	            if (prev !== undefined && prev.peaks.length === this.peaks.length) {
	                return;
	            }

	            var i = undefined;
	            var len = canvas.width;
	            var cc = canvas.getContext('2d');
	            var h2 = canvas.height / 2;
	            var maxValue = Math.pow(2, this.bits - 1);

	            var minPeak = undefined;
	            var maxPeak = undefined;

	            cc.fillStyle = this.color;

	            for (i = 0; i < len; i++) {
	                minPeak = this.peaks[(i + this.offset) * 2] / maxValue;
	                maxPeak = this.peaks[(i + this.offset) * 2 + 1] / maxValue;
	                drawFrame(cc, h2, i, minPeak, maxPeak);
	            }
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _fades = __webpack_require__(9);

	var _curves = __webpack_require__(14);

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	function createCurve(shape, type, width) {
	    var reflection = type === _fades.FADEIN ? 1 : -1;
	    var curve = undefined;

	    switch (shape) {
	        case _fades.SCURVE:
	            curve = (0, _curves.sCurve)(width, reflection);
	            break;
	        case _fades.LINEAR:
	            curve = (0, _curves.linear)(width, reflection);
	            break;
	        case _fades.EXPONENTIAL:
	            curve = (0, _curves.exponential)(width, reflection);
	            break;
	        case _fades.LOGARITHMIC:
	            curve = (0, _curves.logarithmic)(width, 10, reflection);
	            break;
	        default:
	            throw new Error("Unsupported Fade type");
	    }

	    return curve;
	}

	function drawFadeCurve(ctx, shape, type, width, height) {
	    var curve = undefined;
	    var i = undefined;
	    var len = undefined;
	    var y = undefined;

	    ctx.strokeStyle = "black";
	    curve = createCurve(shape, type, width);

	    y = height - curve[0] * height;
	    ctx.beginPath();
	    ctx.moveTo(0, y);

	    for (i = 1, len = curve.length; i < len; i++) {
	        y = height - curve[i] * height;
	        ctx.lineTo(i, y);
	    }
	    ctx.stroke();
	}

	/*
	* virtual-dom hook for drawing the fade curve to the canvas element.
	*/

	var _class = function () {
	    function _class(type, shape, duration, samplesPerPixel) {
	        _classCallCheck(this, _class);

	        this.type = type;
	        this.shape = shape;
	        this.duration = duration;
	        this.samplesPerPixel = samplesPerPixel;
	    }

	    _createClass(_class, [{
	        key: 'hook',
	        value: function hook(canvas, prop, prev) {
	            //node is up to date.
	            if (prev !== undefined && prev.shape === this.shape && prev.type === this.type && prev.duration === this.duration && prev.samplesPerPixel === this.samplesPerPixel) {
	                return;
	            }

	            var cc = canvas.getContext('2d');
	            drawFadeCurve(cc, this.shape, this.type, canvas.width, canvas.height);
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _conversions = __webpack_require__(1);

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	/*
	* virtual-dom hook for scrolling the track container.
	*/

	var _class = function () {
	    function _class(track, resolution, sampleRate) {
	        _classCallCheck(this, _class);

	        this.track = track;
	        this.resolution = resolution;
	        this.sampleRate = sampleRate;
	    }

	    _createClass(_class, [{
	        key: 'hook',
	        value: function hook(trackArea, propertyName, previousValue) {
	            trackArea.scrollLeft = (0, _conversions.secondsToPixels)(this.track.scrollLeft, this.resolution, this.sampleRate);
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 31 */
/***/ function(module, exports) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	/*
	* virtual-dom hook for rendering the time scale canvas.
	*/

	var _class = function () {
	    function _class(tickInfo, offset, samplesPerPixel, duration) {
	        _classCallCheck(this, _class);

	        this.tickInfo = tickInfo;
	        this.offset = offset;
	        this.samplesPerPixel = samplesPerPixel;
	        this.duration = duration;
	    }

	    _createClass(_class, [{
	        key: 'hook',
	        value: function hook(canvas, prop, prev) {
	            var _this = this;

	            //canvas is up to date
	            if (prev !== undefined && prev.offset === this.offset && prev.duration === this.duration && prev.samplesPerPixel === this.samplesPerPixel) {
	                return;
	            }

	            var width = canvas.width;
	            var height = canvas.height;
	            var cc = canvas.getContext('2d');

	            cc.clearRect(0, 0, width, height);

	            Object.keys(this.tickInfo).forEach(function (x) {
	                var scaleHeight = _this.tickInfo[x];
	                var scaleY = height - scaleHeight;
	                cc.fillRect(x, scaleY, 1, scaleHeight);
	            });
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _Loader2 = __webpack_require__(13);

	var _Loader3 = _interopRequireDefault(_Loader2);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

	function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

	var _class = function (_Loader) {
	    _inherits(_class, _Loader);

	    function _class() {
	        _classCallCheck(this, _class);

	        return _possibleConstructorReturn(this, Object.getPrototypeOf(_class).apply(this, arguments));
	    }

	    _createClass(_class, [{
	        key: 'load',

	        /*
	        * Loads an audio file via a FileReader
	        */
	        value: function load() {
	            var _this2 = this;

	            return new Promise(function (resolve, reject) {
	                if (_this2.src.type.match(/audio.*/)) {
	                    var fr = new FileReader();

	                    fr.readAsArrayBuffer(_this2.src);

	                    fr.addEventListener('progress', function (e) {
	                        _get(Object.getPrototypeOf(_class.prototype), 'fileProgress', _this2).call(_this2, e);
	                    });

	                    fr.addEventListener('load', function (e) {
	                        var decoderPromise = _get(Object.getPrototypeOf(_class.prototype), 'fileLoad', _this2).call(_this2, e);

	                        decoderPromise.then(function (audioBuffer) {
	                            resolve(audioBuffer);
	                        });
	                    });

	                    fr.addEventListener('error', function () {
	                        reject(Error("Error reading Blob"));
	                    });
	                } else {
	                    reject(Error('Unsupported file type ' + _this2.src.type));
	                }
	            });
	        }
	    }]);

	    return _class;
	}(_Loader3.default);

	exports.default = _class;

/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _BlobLoader = __webpack_require__(32);

	var _BlobLoader2 = _interopRequireDefault(_BlobLoader);

	var _XHRLoader = __webpack_require__(34);

	var _XHRLoader2 = _interopRequireDefault(_XHRLoader);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var _class = function () {
	    function _class() {
	        _classCallCheck(this, _class);
	    }

	    _createClass(_class, null, [{
	        key: 'createLoader',
	        value: function createLoader(src, audioContext) {
	            if (src instanceof Blob) {
	                return new _BlobLoader2.default(src, audioContext);
	            } else if (typeof src === "string") {
	                return new _XHRLoader2.default(src, audioContext);
	            } else {
	                throw new Error("Unsupported src type");
	            }
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _Loader2 = __webpack_require__(13);

	var _Loader3 = _interopRequireDefault(_Loader2);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

	function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

	var _class = function (_Loader) {
	    _inherits(_class, _Loader);

	    function _class() {
	        _classCallCheck(this, _class);

	        return _possibleConstructorReturn(this, Object.getPrototypeOf(_class).apply(this, arguments));
	    }

	    _createClass(_class, [{
	        key: 'load',

	        /**
	         * Loads an audio file via XHR.
	         */
	        value: function load() {
	            var _this2 = this;

	            return new Promise(function (resolve, reject) {
	                var xhr = new XMLHttpRequest();

	                xhr.open('GET', _this2.src, true);
	                xhr.responseType = 'arraybuffer';
	                xhr.send();

	                xhr.addEventListener('progress', function (e) {
	                    _get(Object.getPrototypeOf(_class.prototype), 'fileProgress', _this2).call(_this2, e);
	                });

	                xhr.addEventListener('load', function (e) {
	                    var decoderPromise = _get(Object.getPrototypeOf(_class.prototype), 'fileLoad', _this2).call(_this2, e);

	                    decoderPromise.then(function (audioBuffer) {
	                        resolve(audioBuffer);
	                    });
	                });

	                xhr.addEventListener('error', function () {
	                    reject(Error('Track ' + _this2.src + ' failed to load'));
	                });
	            });
	        }
	    }]);

	    return _class;
	}(_Loader3.default);

	exports.default = _class;

/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _CursorState = __webpack_require__(36);

	var _CursorState2 = _interopRequireDefault(_CursorState);

	var _SelectState = __webpack_require__(39);

	var _SelectState2 = _interopRequireDefault(_SelectState);

	var _ShiftState = __webpack_require__(40);

	var _ShiftState2 = _interopRequireDefault(_ShiftState);

	var _FadeInState = __webpack_require__(37);

	var _FadeInState2 = _interopRequireDefault(_FadeInState);

	var _FadeOutState = __webpack_require__(38);

	var _FadeOutState2 = _interopRequireDefault(_FadeOutState);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	exports.default = {
	    'cursor': _CursorState2.default,
	    'select': _SelectState2.default,
	    'shift': _ShiftState2.default,
	    'fadein': _FadeInState2.default,
	    'fadeout': _FadeOutState2.default
	};

/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _conversions = __webpack_require__(1);

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var _class = function () {
	    function _class(track, samplesPerPixel, sampleRate) {
	        _classCallCheck(this, _class);

	        this.track = track;
	        this.samplesPerPixel = samplesPerPixel;
	        this.sampleRate = sampleRate;
	    }

	    _createClass(_class, [{
	        key: 'click',
	        value: function click(e) {
	            e.preventDefault();

	            var startX = e.offsetX;
	            var startTime = (0, _conversions.pixelsToSeconds)(startX, this.samplesPerPixel, this.sampleRate);

	            this.track.ee.emit('select', startTime, startTime, this.track);
	        }
	    }, {
	        key: 'getClasses',
	        value: function getClasses() {
	            return ".state-cursor";
	        }
	    }, {
	        key: 'getEvents',
	        value: function getEvents() {
	            return {
	                "click": this.click
	            };
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _conversions = __webpack_require__(1);

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var _class = function () {
	    function _class(track, samplesPerPixel, sampleRate) {
	        _classCallCheck(this, _class);

	        this.track = track;
	        this.samplesPerPixel = samplesPerPixel;
	        this.sampleRate = sampleRate;
	    }

	    _createClass(_class, [{
	        key: 'click',
	        value: function click(e) {
	            var startX = e.offsetX;
	            var time = (0, _conversions.pixelsToSeconds)(startX, this.samplesPerPixel, this.sampleRate);

	            if (time > this.track.getStartTime() && time < this.track.getEndTime()) {
	                this.track.ee.emit('fadein', time - this.track.getStartTime(), this.track);
	            }
	        }
	    }, {
	        key: 'getClasses',
	        value: function getClasses() {
	            return ".state-fadein";
	        }
	    }, {
	        key: 'getEvents',
	        value: function getEvents() {
	            return {
	                "click": this.click
	            };
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _conversions = __webpack_require__(1);

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var _class = function () {
	    function _class(track, samplesPerPixel, sampleRate) {
	        _classCallCheck(this, _class);

	        this.track = track;
	        this.samplesPerPixel = samplesPerPixel;
	        this.sampleRate = sampleRate;
	    }

	    _createClass(_class, [{
	        key: 'click',
	        value: function click(e) {
	            var startX = e.offsetX;
	            var time = (0, _conversions.pixelsToSeconds)(startX, this.samplesPerPixel, this.sampleRate);

	            if (time > this.track.getStartTime() && time < this.track.getEndTime()) {
	                this.track.ee.emit('fadeout', this.track.getEndTime() - time, this.track);
	            }
	        }
	    }, {
	        key: 'getClasses',
	        value: function getClasses() {
	            return ".state-fadeout";
	        }
	    }, {
	        key: 'getEvents',
	        value: function getEvents() {
	            return {
	                "click": this.click
	            };
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _conversions = __webpack_require__(1);

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var _class = function () {
	    function _class(track, samplesPerPixel, sampleRate) {
	        _classCallCheck(this, _class);

	        this.track = track;
	        this.samplesPerPixel = samplesPerPixel;
	        this.sampleRate = sampleRate;
	    }

	    _createClass(_class, [{
	        key: 'mousedown',
	        value: function mousedown(e) {
	            var _this = this;

	            e.preventDefault();

	            var el = e.target;
	            var startX = e.offsetX;
	            var startTime = (0, _conversions.pixelsToSeconds)(startX, this.samplesPerPixel, this.sampleRate);

	            this.track.ee.emit('select', startTime, startTime, this.track);

	            var emitSelection = function emitSelection(x) {
	                var minX = Math.min(x, startX);
	                var maxX = Math.max(x, startX);
	                var startTime = (0, _conversions.pixelsToSeconds)(minX, _this.samplesPerPixel, _this.sampleRate);
	                var endTime = (0, _conversions.pixelsToSeconds)(maxX, _this.samplesPerPixel, _this.sampleRate);

	                _this.track.ee.emit('select', startTime, endTime, _this.track);
	            };

	            var complete = function complete(ev) {
	                ev.preventDefault();

	                emitSelection(ev.offsetX);

	                el.onmousemove = el.onmouseup = el.onmouseleave = null;
	            };

	            //dynamically put an event on the element.
	            el.onmousemove = function (ev) {
	                ev.preventDefault();

	                emitSelection(ev.offsetX);
	            };

	            el.onmouseup = el.onmouseleave = complete;
	        }
	    }, {
	        key: 'getClasses',
	        value: function getClasses() {
	            return ".state-select";
	        }
	    }, {
	        key: 'getEvents',
	        value: function getEvents() {
	            return {
	                "mousedown": this.mousedown
	            };
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	var _conversions = __webpack_require__(1);

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var _class = function () {
	    function _class(track, samplesPerPixel, sampleRate) {
	        _classCallCheck(this, _class);

	        this.track = track;
	        this.samplesPerPixel = samplesPerPixel;
	        this.sampleRate = sampleRate;
	    }

	    _createClass(_class, [{
	        key: 'mousedown',
	        value: function mousedown(e) {
	            var _this = this;

	            e.preventDefault();

	            var el = e.target;
	            var prevX = e.offsetX;

	            var emitShift = function emitShift(x) {
	                var deltaX = x - prevX;
	                var deltaTime = (0, _conversions.pixelsToSeconds)(deltaX, _this.samplesPerPixel, _this.sampleRate);
	                prevX = x;
	                _this.track.ee.emit('shift', deltaTime, _this.track);
	            };

	            //dynamically put an event on the element.
	            el.onmousemove = function (e) {
	                e.preventDefault();
	                emitShift(e.offsetX);
	            };

	            var complete = function complete(e) {
	                e.preventDefault();
	                emitShift(e.offsetX);
	                el.onmousemove = el.onmouseup = el.onmouseleave = null;
	            };

	            el.onmouseup = el.onmouseleave = complete;
	        }
	    }, {
	        key: 'getClasses',
	        value: function getClasses() {
	            return ".state-shift";
	        }
	    }, {
	        key: 'getEvents',
	        value: function getEvents() {
	            return {
	                "mousedown": this.mousedown
	            };
	        }
	    }]);

	    return _class;
	}();

	exports.default = _class;

/***/ },
/* 41 */
/***/ function(module, exports) {

	'use strict';

	//http://jsperf.com/typed-array-min-max/2
	//plain for loop for finding min/max is way faster than anything else.
	/**
	* @param {TypedArray} array - Subarray of audio to calculate peaks from.
	*/

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});

	exports.default = function (source) {
	    var samplesPerPixel = arguments.length <= 1 || arguments[1] === undefined ? 10000 : arguments[1];
	    var isMono = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];
	    var cueIn = arguments.length <= 3 || arguments[3] === undefined ? undefined : arguments[3];
	    var cueOut = arguments.length <= 4 || arguments[4] === undefined ? undefined : arguments[4];
	    var bits = arguments.length <= 5 || arguments[5] === undefined ? 8 : arguments[5];

	    if ([8, 16, 32].indexOf(bits) < 0) {
	        throw new Error("Invalid number of bits specified for peaks.");
	    }

	    var numChan = source.numberOfChannels;
	    var peaks = [];
	    var c = undefined;
	    var numPeaks = undefined;

	    if (source.constructor.name === 'AudioBuffer') {
	        for (c = 0; c < numChan; c++) {
	            var channel = source.getChannelData(c);
	            cueIn = cueIn || 0;
	            cueOut = cueOut || channel.length;
	            var slice = channel.subarray(cueIn, cueOut);
	            peaks.push(extractPeaks(slice, samplesPerPixel, bits));
	        }
	    } else {
	        cueIn = cueIn || 0;
	        cueOut = cueOut || source.length;
	        peaks.push(extractPeaks(source.subarray(cueIn, cueOut), samplesPerPixel, bits));
	    }

	    if (isMono && peaks.length > 1) {
	        peaks = makeMono(peaks, bits);
	    }

	    numPeaks = peaks[0].length / 2;

	    return {
	        length: numPeaks,
	        data: peaks,
	        bits: bits
	    };
	};

	function findMinMax(array) {
	    var min = Infinity;
	    var max = -Infinity;
	    var i = 0;
	    var len = array.length;
	    var curr = undefined;

	    for (; i < len; i++) {
	        curr = array[i];
	        if (min > curr) {
	            min = curr;
	        }
	        if (max < curr) {
	            max = curr;
	        }
	    }

	    return {
	        min: min,
	        max: max
	    };
	}

	/**
	* @param {Number} n - peak to convert from float to Int8, Int16 etc.
	* @param {Number} bits - convert to #bits two's complement signed integer
	*/
	function convert(n, bits) {
	    var max = Math.pow(2, bits - 1);
	    var v = n < 0 ? n * max : n * max - 1;
	    return Math.max(-max, Math.min(max - 1, v));
	}

	/**
	* @param {TypedArray} channel - Audio track frames to calculate peaks from.
	* @param {Number} samplesPerPixel - Audio frames per peak
	*/
	function extractPeaks(channel, samplesPerPixel, bits) {
	    var i = undefined;
	    var chanLength = channel.length;
	    var numPeaks = Math.ceil(chanLength / samplesPerPixel);
	    var start = undefined;
	    var end = undefined;
	    var segment = undefined;
	    var max = undefined;
	    var min = undefined;
	    var extrema = undefined;

	    //create interleaved array of min,max
	    var peaks = new (eval("Int" + bits + "Array"))(numPeaks * 2);

	    for (i = 0; i < numPeaks; i++) {

	        start = i * samplesPerPixel;
	        end = (i + 1) * samplesPerPixel > chanLength ? chanLength : (i + 1) * samplesPerPixel;

	        segment = channel.subarray(start, end);
	        extrema = findMinMax(segment);
	        min = convert(extrema.min, bits);
	        max = convert(extrema.max, bits);

	        peaks[i * 2] = min;
	        peaks[i * 2 + 1] = max;
	    }

	    return peaks;
	}

	function makeMono(channelPeaks) {
	    var bits = arguments.length <= 1 || arguments[1] === undefined ? 8 : arguments[1];

	    var numChan = channelPeaks.length;
	    var weight = 1 / numChan;
	    var numPeaks = channelPeaks[0].length / 2;
	    var c = 0;
	    var i = 0;
	    var min = undefined;
	    var max = undefined;
	    var peaks = new (eval("Int" + bits + "Array"))(numPeaks * 2);

	    for (i = 0; i < numPeaks; i++) {
	        min = 0;
	        max = 0;

	        for (c = 0; c < numChan; c++) {
	            min += weight * channelPeaks[c][i * 2];
	            max += weight * channelPeaks[c][i * 2 + 1];
	        }

	        peaks[i * 2] = min;
	        peaks[i * 2 + 1] = max;
	    }

	    //return in array so channel number counts still work.
	    return [peaks];
	}

	/**
	* @param {AudioBuffer,TypedArray} source - Source of audio samples for peak calculations.
	* @param {Number} samplesPerPixel - Number of audio samples per peak.
	* @param {Number} cueIn - index in channel to start peak calculations from.
	* @param {Number} cueOut - index in channel to end peak calculations from (non-inclusive).
	*/

/***/ },
/* 42 */
/***/ function(module, exports) {

	/*!
	 * Cross-Browser Split 1.1.1
	 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
	 * Available under the MIT License
	 * ECMAScript compliant, uniform cross-browser split method
	 */

	/**
	 * Splits a string into an array of strings using a regex or string separator. Matches of the
	 * separator are not included in the result array. However, if `separator` is a regex that contains
	 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
	 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
	 * cross-browser.
	 * @param {String} str String to split.
	 * @param {RegExp|String} separator Regex or string to use for separating the string.
	 * @param {Number} [limit] Maximum number of items to include in the result array.
	 * @returns {Array} Array of substrings.
	 * @example
	 *
	 * // Basic use
	 * split('a b c d', ' ');
	 * // -> ['a', 'b', 'c', 'd']
	 *
	 * // With limit
	 * split('a b c d', ' ', 2);
	 * // -> ['a', 'b']
	 *
	 * // Backreferences in result array
	 * split('..word1 word2..', /([a-z]+)(\d+)/i);
	 * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
	 */
	module.exports = (function split(undef) {

	  var nativeSplit = String.prototype.split,
	    compliantExecNpcg = /()??/.exec("")[1] === undef,
	    // NPCG: nonparticipating capturing group
	    self;

	  self = function(str, separator, limit) {
	    // If `separator` is not a regex, use `nativeSplit`
	    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
	      return nativeSplit.call(str, separator, limit);
	    }
	    var output = [],
	      flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
	      (separator.sticky ? "y" : ""),
	      // Firefox 3+
	      lastLastIndex = 0,
	      // Make `global` and avoid `lastIndex` issues by working with a copy
	      separator = new RegExp(separator.source, flags + "g"),
	      separator2, match, lastIndex, lastLength;
	    str += ""; // Type-convert
	    if (!compliantExecNpcg) {
	      // Doesn't need flags gy, but they don't hurt
	      separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
	    }
	    /* Values for `limit`, per the spec:
	     * If undefined: 4294967295 // Math.pow(2, 32) - 1
	     * If 0, Infinity, or NaN: 0
	     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
	     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
	     * If other: Type-convert, then use the above rules
	     */
	    limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
	    limit >>> 0; // ToUint32(limit)
	    while (match = separator.exec(str)) {
	      // `separator.lastIndex` is not reliable cross-browser
	      lastIndex = match.index + match[0].length;
	      if (lastIndex > lastLastIndex) {
	        output.push(str.slice(lastLastIndex, match.index));
	        // Fix browsers whose `exec` methods don't consistently return `undefined` for
	        // nonparticipating capturing groups
	        if (!compliantExecNpcg && match.length > 1) {
	          match[0].replace(separator2, function() {
	            for (var i = 1; i < arguments.length - 2; i++) {
	              if (arguments[i] === undef) {
	                match[i] = undef;
	              }
	            }
	          });
	        }
	        if (match.length > 1 && match.index < str.length) {
	          Array.prototype.push.apply(output, match.slice(1));
	        }
	        lastLength = match[0].length;
	        lastLastIndex = lastIndex;
	        if (output.length >= limit) {
	          break;
	        }
	      }
	      if (separator.lastIndex === match.index) {
	        separator.lastIndex++; // Avoid an infinite loop
	      }
	    }
	    if (lastLastIndex === str.length) {
	      if (lastLength || !separator.test("")) {
	        output.push("");
	      }
	    } else {
	      output.push(str.slice(lastLastIndex));
	    }
	    return output.length > limit ? output.slice(0, limit) : output;
	  };

	  return self;
	})();


/***/ },
/* 43 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * cuid.js
	 * Collision-resistant UID generator for browsers and node.
	 * Sequential for fast db lookups and recency sorting.
	 * Safe for element IDs and server-side lookups.
	 *
	 * Extracted from CLCTR
	 *
	 * Copyright (c) Eric Elliott 2012
	 * MIT License
	 */

	/*global window, navigator, document, require, process, module */
	(function (app) {
	  'use strict';
	  var namespace = 'cuid',
	    c = 0,
	    blockSize = 4,
	    base = 36,
	    discreteValues = Math.pow(base, blockSize),

	    pad = function pad(num, size) {
	      var s = "000000000" + num;
	      return s.substr(s.length-size);
	    },

	    randomBlock = function randomBlock() {
	      return pad((Math.random() *
	            discreteValues << 0)
	            .toString(base), blockSize);
	    },

	    safeCounter = function () {
	      c = (c < discreteValues) ? c : 0;
	      c++; // this is not subliminal
	      return c - 1;
	    },

	    api = function cuid() {
	      // Starting with a lowercase letter makes
	      // it HTML element ID friendly.
	      var letter = 'c', // hard-coded allows for sequential access

	        // timestamp
	        // warning: this exposes the exact date and time
	        // that the uid was created.
	        timestamp = (new Date().getTime()).toString(base),

	        // Prevent same-machine collisions.
	        counter,

	        // A few chars to generate distinct ids for different
	        // clients (so different computers are far less
	        // likely to generate the same id)
	        fingerprint = api.fingerprint(),

	        // Grab some more chars from Math.random()
	        random = randomBlock() + randomBlock();

	        counter = pad(safeCounter().toString(base), blockSize);

	      return  (letter + timestamp + counter + fingerprint + random);
	    };

	  api.slug = function slug() {
	    var date = new Date().getTime().toString(36),
	      counter,
	      print = api.fingerprint().slice(0,1) +
	        api.fingerprint().slice(-1),
	      random = randomBlock().slice(-2);

	      counter = safeCounter().toString(36).slice(-4);

	    return date.slice(-2) +
	      counter + print + random;
	  };

	  api.globalCount = function globalCount() {
	    // We want to cache the results of this
	    var cache = (function calc() {
	        var i,
	          count = 0;

	        for (i in window) {
	          count++;
	        }

	        return count;
	      }());

	    api.globalCount = function () { return cache; };
	    return cache;
	  };

	  api.fingerprint = function browserPrint() {
	    return pad((navigator.mimeTypes.length +
	      navigator.userAgent.length).toString(36) +
	      api.globalCount().toString(36), 4);
	  };

	  // don't change anything from here down.
	  if (app.register) {
	    app.register(namespace, api);
	  } else if (true) {
	    module.exports = api;
	  } else {
	    app[namespace] = api;
	  }

	}(this.applitude || this));


/***/ },
/* 44 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var assign        = __webpack_require__(51)
	  , normalizeOpts = __webpack_require__(58)
	  , isCallable    = __webpack_require__(54)
	  , contains      = __webpack_require__(61)

	  , d;

	d = module.exports = function (dscr, value/*, options*/) {
		var c, e, w, options, desc;
		if ((arguments.length < 2) || (typeof dscr !== 'string')) {
			options = value;
			value = dscr;
			dscr = null;
		} else {
			options = arguments[2];
		}
		if (dscr == null) {
			c = w = true;
			e = false;
		} else {
			c = contains.call(dscr, 'c');
			e = contains.call(dscr, 'e');
			w = contains.call(dscr, 'w');
		}

		desc = { value: value, configurable: c, enumerable: e, writable: w };
		return !options ? desc : assign(normalizeOpts(options), desc);
	};

	d.gs = function (dscr, get, set/*, options*/) {
		var c, e, options, desc;
		if (typeof dscr !== 'string') {
			options = set;
			set = get;
			get = dscr;
			dscr = null;
		} else {
			options = arguments[3];
		}
		if (get == null) {
			get = undefined;
		} else if (!isCallable(get)) {
			options = get;
			get = set = undefined;
		} else if (set == null) {
			set = undefined;
		} else if (!isCallable(set)) {
			options = set;
			set = undefined;
		}
		if (dscr == null) {
			c = true;
			e = false;
		} else {
			c = contains.call(dscr, 'c');
			e = contains.call(dscr, 'e');
		}

		desc = { get: get, set: set, configurable: c, enumerable: e };
		return !options ? desc : assign(normalizeOpts(options), desc);
	};


/***/ },
/* 45 */
/***/ function(module, exports, __webpack_require__) {

	var EvStore = __webpack_require__(5)

	module.exports = addEvent

	function addEvent(target, type, handler) {
	    var events = EvStore(target)
	    var event = events[type]

	    if (!event) {
	        events[type] = handler
	    } else if (Array.isArray(event)) {
	        if (event.indexOf(handler) === -1) {
	            event.push(handler)
	        }
	    } else if (event !== handler) {
	        events[type] = [event, handler]
	    }
	}


/***/ },
/* 46 */
/***/ function(module, exports, __webpack_require__) {

	var globalDocument = __webpack_require__(15)
	var EvStore = __webpack_require__(5)
	var createStore = __webpack_require__(91)

	var addEvent = __webpack_require__(45)
	var removeEvent = __webpack_require__(50)
	var ProxyEvent = __webpack_require__(49)

	var HANDLER_STORE = createStore()

	module.exports = DOMDelegator

	function DOMDelegator(document) {
	    if (!(this instanceof DOMDelegator)) {
	        return new DOMDelegator(document);
	    }

	    document = document || globalDocument

	    this.target = document.documentElement
	    this.events = {}
	    this.rawEventListeners = {}
	    this.globalListeners = {}
	}

	DOMDelegator.prototype.addEventListener = addEvent
	DOMDelegator.prototype.removeEventListener = removeEvent

	DOMDelegator.allocateHandle =
	    function allocateHandle(func) {
	        var handle = new Handle()

	        HANDLER_STORE(handle).func = func;

	        return handle
	    }

	DOMDelegator.transformHandle =
	    function transformHandle(handle, broadcast) {
	        var func = HANDLER_STORE(handle).func

	        return this.allocateHandle(function (ev) {
	            broadcast(ev, func);
	        })
	    }

	DOMDelegator.prototype.addGlobalEventListener =
	    function addGlobalEventListener(eventName, fn) {
	        var listeners = this.globalListeners[eventName] || [];
	        if (listeners.indexOf(fn) === -1) {
	            listeners.push(fn)
	        }

	        this.globalListeners[eventName] = listeners;
	    }

	DOMDelegator.prototype.removeGlobalEventListener =
	    function removeGlobalEventListener(eventName, fn) {
	        var listeners = this.globalListeners[eventName] || [];

	        var index = listeners.indexOf(fn)
	        if (index !== -1) {
	            listeners.splice(index, 1)
	        }
	    }

	DOMDelegator.prototype.listenTo = function listenTo(eventName) {
	    if (!(eventName in this.events)) {
	        this.events[eventName] = 0;
	    }

	    this.events[eventName]++;

	    if (this.events[eventName] !== 1) {
	        return
	    }

	    var listener = this.rawEventListeners[eventName]
	    if (!listener) {
	        listener = this.rawEventListeners[eventName] =
	            createHandler(eventName, this)
	    }

	    this.target.addEventListener(eventName, listener, true)
	}

	DOMDelegator.prototype.unlistenTo = function unlistenTo(eventName) {
	    if (!(eventName in this.events)) {
	        this.events[eventName] = 0;
	    }

	    if (this.events[eventName] === 0) {
	        throw new Error("already unlistened to event.");
	    }

	    this.events[eventName]--;

	    if (this.events[eventName] !== 0) {
	        return
	    }

	    var listener = this.rawEventListeners[eventName]

	    if (!listener) {
	        throw new Error("dom-delegator#unlistenTo: cannot " +
	            "unlisten to " + eventName)
	    }

	    this.target.removeEventListener(eventName, listener, true)
	}

	function createHandler(eventName, delegator) {
	    var globalListeners = delegator.globalListeners;
	    var delegatorTarget = delegator.target;

	    return handler

	    function handler(ev) {
	        var globalHandlers = globalListeners[eventName] || []

	        if (globalHandlers.length > 0) {
	            var globalEvent = new ProxyEvent(ev);
	            globalEvent.currentTarget = delegatorTarget;
	            callListeners(globalHandlers, globalEvent)
	        }

	        findAndInvokeListeners(ev.target, ev, eventName)
	    }
	}

	function findAndInvokeListeners(elem, ev, eventName) {
	    var listener = getListener(elem, eventName)

	    if (listener && listener.handlers.length > 0) {
	        var listenerEvent = new ProxyEvent(ev);
	        listenerEvent.currentTarget = listener.currentTarget
	        callListeners(listener.handlers, listenerEvent)

	        if (listenerEvent._bubbles) {
	            var nextTarget = listener.currentTarget.parentNode
	            findAndInvokeListeners(nextTarget, ev, eventName)
	        }
	    }
	}

	function getListener(target, type) {
	    // terminate recursion if parent is `null`
	    if (target === null || typeof target === "undefined") {
	        return null
	    }

	    var events = EvStore(target)
	    // fetch list of handler fns for this event
	    var handler = events[type]
	    var allHandler = events.event

	    if (!handler && !allHandler) {
	        return getListener(target.parentNode, type)
	    }

	    var handlers = [].concat(handler || [], allHandler || [])
	    return new Listener(target, handlers)
	}

	function callListeners(handlers, ev) {
	    handlers.forEach(function (handler) {
	        if (typeof handler === "function") {
	            handler(ev)
	        } else if (typeof handler.handleEvent === "function") {
	            handler.handleEvent(ev)
	        } else if (handler.type === "dom-delegator-handle") {
	            HANDLER_STORE(handler).func(ev)
	        } else {
	            throw new Error("dom-delegator: unknown handler " +
	                "found: " + JSON.stringify(handlers));
	        }
	    })
	}

	function Listener(target, handlers) {
	    this.currentTarget = target
	    this.handlers = handlers
	}

	function Handle() {
	    this.type = "dom-delegator-handle"
	}


/***/ },
/* 47 */
/***/ function(module, exports, __webpack_require__) {

	var Individual = __webpack_require__(48)
	var cuid = __webpack_require__(43)
	var globalDocument = __webpack_require__(15)

	var DOMDelegator = __webpack_require__(46)

	var versionKey = "13"
	var cacheKey = "__DOM_DELEGATOR_CACHE@" + versionKey
	var cacheTokenKey = "__DOM_DELEGATOR_CACHE_TOKEN@" + versionKey
	var delegatorCache = Individual(cacheKey, {
	    delegators: {}
	})
	var commonEvents = [
	    "blur", "change", "click",  "contextmenu", "dblclick",
	    "error","focus", "focusin", "focusout", "input", "keydown",
	    "keypress", "keyup", "load", "mousedown", "mouseup",
	    "resize", "select", "submit", "touchcancel",
	    "touchend", "touchstart", "unload"
	]

	/*  Delegator is a thin wrapper around a singleton `DOMDelegator`
	        instance.

	    Only one DOMDelegator should exist because we do not want
	        duplicate event listeners bound to the DOM.

	    `Delegator` will also `listenTo()` all events unless
	        every caller opts out of it
	*/
	module.exports = Delegator

	function Delegator(opts) {
	    opts = opts || {}
	    var document = opts.document || globalDocument

	    var cacheKey = document[cacheTokenKey]

	    if (!cacheKey) {
	        cacheKey =
	            document[cacheTokenKey] = cuid()
	    }

	    var delegator = delegatorCache.delegators[cacheKey]

	    if (!delegator) {
	        delegator = delegatorCache.delegators[cacheKey] =
	            new DOMDelegator(document)
	    }

	    if (opts.defaultEvents !== false) {
	        for (var i = 0; i < commonEvents.length; i++) {
	            delegator.listenTo(commonEvents[i])
	        }
	    }

	    return delegator
	}

	Delegator.allocateHandle = DOMDelegator.allocateHandle;
	Delegator.transformHandle = DOMDelegator.transformHandle;


/***/ },
/* 48 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {var root = typeof window !== 'undefined' ?
	    window : typeof global !== 'undefined' ?
	    global : {};

	module.exports = Individual

	function Individual(key, value) {
	    if (root[key]) {
	        return root[key]
	    }

	    Object.defineProperty(root, key, {
	        value: value
	        , configurable: true
	    })

	    return value
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 49 */
/***/ function(module, exports, __webpack_require__) {

	var inherits = __webpack_require__(66)

	var ALL_PROPS = [
	    "altKey", "bubbles", "cancelable", "ctrlKey",
	    "eventPhase", "metaKey", "relatedTarget", "shiftKey",
	    "target", "timeStamp", "type", "view", "which"
	]
	var KEY_PROPS = ["char", "charCode", "key", "keyCode"]
	var MOUSE_PROPS = [
	    "button", "buttons", "clientX", "clientY", "layerX",
	    "layerY", "offsetX", "offsetY", "pageX", "pageY",
	    "screenX", "screenY", "toElement"
	]

	var rkeyEvent = /^key|input/
	var rmouseEvent = /^(?:mouse|pointer|contextmenu)|click/

	module.exports = ProxyEvent

	function ProxyEvent(ev) {
	    if (!(this instanceof ProxyEvent)) {
	        return new ProxyEvent(ev)
	    }

	    if (rkeyEvent.test(ev.type)) {
	        return new KeyEvent(ev)
	    } else if (rmouseEvent.test(ev.type)) {
	        return new MouseEvent(ev)
	    }

	    for (var i = 0; i < ALL_PROPS.length; i++) {
	        var propKey = ALL_PROPS[i]
	        this[propKey] = ev[propKey]
	    }

	    this._rawEvent = ev
	    this._bubbles = false;
	}

	ProxyEvent.prototype.preventDefault = function () {
	    this._rawEvent.preventDefault()
	}

	ProxyEvent.prototype.startPropagation = function () {
	    this._bubbles = true;
	}

	function MouseEvent(ev) {
	    for (var i = 0; i < ALL_PROPS.length; i++) {
	        var propKey = ALL_PROPS[i]
	        this[propKey] = ev[propKey]
	    }

	    for (var j = 0; j < MOUSE_PROPS.length; j++) {
	        var mousePropKey = MOUSE_PROPS[j]
	        this[mousePropKey] = ev[mousePropKey]
	    }

	    this._rawEvent = ev
	}

	inherits(MouseEvent, ProxyEvent)

	function KeyEvent(ev) {
	    for (var i = 0; i < ALL_PROPS.length; i++) {
	        var propKey = ALL_PROPS[i]
	        this[propKey] = ev[propKey]
	    }

	    for (var j = 0; j < KEY_PROPS.length; j++) {
	        var keyPropKey = KEY_PROPS[j]
	        this[keyPropKey] = ev[keyPropKey]
	    }

	    this._rawEvent = ev
	}

	inherits(KeyEvent, ProxyEvent)


/***/ },
/* 50 */
/***/ function(module, exports, __webpack_require__) {

	var EvStore = __webpack_require__(5)

	module.exports = removeEvent

	function removeEvent(target, type, handler) {
	    var events = EvStore(target)
	    var event = events[type]

	    if (!event) {
	        return
	    } else if (Array.isArray(event)) {
	        var index = event.indexOf(handler)
	        if (index !== -1) {
	            event.splice(index, 1)
	        }
	    } else if (event === handler) {
	        events[type] = null
	    }
	}


/***/ },
/* 51 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	module.exports = __webpack_require__(52)()
		? Object.assign
		: __webpack_require__(53);


/***/ },
/* 52 */
/***/ function(module, exports) {

	'use strict';

	module.exports = function () {
		var assign = Object.assign, obj;
		if (typeof assign !== 'function') return false;
		obj = { foo: 'raz' };
		assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
		return (obj.foo + obj.bar + obj.trzy) === 'razdwatrzy';
	};


/***/ },
/* 53 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var keys  = __webpack_require__(55)
	  , value = __webpack_require__(60)

	  , max = Math.max;

	module.exports = function (dest, src/*, …srcn*/) {
		var error, i, l = max(arguments.length, 2), assign;
		dest = Object(value(dest));
		assign = function (key) {
			try { dest[key] = src[key]; } catch (e) {
				if (!error) error = e;
			}
		};
		for (i = 1; i < l; ++i) {
			src = arguments[i];
			keys(src).forEach(assign);
		}
		if (error !== undefined) throw error;
		return dest;
	};


/***/ },
/* 54 */
/***/ function(module, exports) {

	// Deprecated

	'use strict';

	module.exports = function (obj) { return typeof obj === 'function'; };


/***/ },
/* 55 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	module.exports = __webpack_require__(56)()
		? Object.keys
		: __webpack_require__(57);


/***/ },
/* 56 */
/***/ function(module, exports) {

	'use strict';

	module.exports = function () {
		try {
			Object.keys('primitive');
			return true;
		} catch (e) { return false; }
	};


/***/ },
/* 57 */
/***/ function(module, exports) {

	'use strict';

	var keys = Object.keys;

	module.exports = function (object) {
		return keys(object == null ? object : Object(object));
	};


/***/ },
/* 58 */
/***/ function(module, exports) {

	'use strict';

	var forEach = Array.prototype.forEach, create = Object.create;

	var process = function (src, obj) {
		var key;
		for (key in src) obj[key] = src[key];
	};

	module.exports = function (options/*, …options*/) {
		var result = create(null);
		forEach.call(arguments, function (options) {
			if (options == null) return;
			process(Object(options), result);
		});
		return result;
	};


/***/ },
/* 59 */
/***/ function(module, exports) {

	'use strict';

	module.exports = function (fn) {
		if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
		return fn;
	};


/***/ },
/* 60 */
/***/ function(module, exports) {

	'use strict';

	module.exports = function (value) {
		if (value == null) throw new TypeError("Cannot use null or undefined");
		return value;
	};


/***/ },
/* 61 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	module.exports = __webpack_require__(62)()
		? String.prototype.contains
		: __webpack_require__(63);


/***/ },
/* 62 */
/***/ function(module, exports) {

	'use strict';

	var str = 'razdwatrzy';

	module.exports = function () {
		if (typeof str.contains !== 'function') return false;
		return ((str.contains('dwa') === true) && (str.contains('foo') === false));
	};


/***/ },
/* 63 */
/***/ function(module, exports) {

	'use strict';

	var indexOf = String.prototype.indexOf;

	module.exports = function (searchString/*, position*/) {
		return indexOf.call(this, searchString, arguments[1]) > -1;
	};


/***/ },
/* 64 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {'use strict';

	/*global window, global*/

	var root = typeof window !== 'undefined' ?
	    window : typeof global !== 'undefined' ?
	    global : {};

	module.exports = Individual;

	function Individual(key, value) {
	    if (key in root) {
	        return root[key];
	    }

	    root[key] = value;

	    return value;
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 65 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var Individual = __webpack_require__(64);

	module.exports = OneVersion;

	function OneVersion(moduleName, version, defaultValue) {
	    var key = '__INDIVIDUAL_ONE_VERSION_' + moduleName;
	    var enforceKey = key + '_ENFORCE_SINGLETON';

	    var versionValue = Individual(enforceKey, version);

	    if (versionValue !== version) {
	        throw new Error('Can only have one copy of ' +
	            moduleName + '.\n' +
	            'You already have version ' + versionValue +
	            ' installed.\n' +
	            'This means you cannot install version ' + version);
	    }

	    return Individual(key, defaultValue);
	}


/***/ },
/* 66 */
/***/ function(module, exports) {

	if (typeof Object.create === 'function') {
	  // implementation from standard node.js 'util' module
	  module.exports = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor
	    ctor.prototype = Object.create(superCtor.prototype, {
	      constructor: {
	        value: ctor,
	        enumerable: false,
	        writable: true,
	        configurable: true
	      }
	    });
	  };
	} else {
	  // old school shim for old browsers
	  module.exports = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor
	    var TempCtor = function () {}
	    TempCtor.prototype = superCtor.prototype
	    ctor.prototype = new TempCtor()
	    ctor.prototype.constructor = ctor
	  }
	}


/***/ },
/* 67 */
/***/ function(module, exports) {

	/**
	 * lodash 3.0.3 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */

	/**
	 * The base implementation of `baseForIn` and `baseForOwn` which iterates
	 * over `object` properties returned by `keysFunc` invoking `iteratee` for
	 * each property. Iteratee functions may exit iteration early by explicitly
	 * returning `false`.
	 *
	 * @private
	 * @param {Object} object The object to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @param {Function} keysFunc The function to get the keys of `object`.
	 * @returns {Object} Returns `object`.
	 */
	var baseFor = createBaseFor();

	/**
	 * Creates a base function for methods like `_.forIn`.
	 *
	 * @private
	 * @param {boolean} [fromRight] Specify iterating from right to left.
	 * @returns {Function} Returns the new base function.
	 */
	function createBaseFor(fromRight) {
	  return function(object, iteratee, keysFunc) {
	    var index = -1,
	        iterable = Object(object),
	        props = keysFunc(object),
	        length = props.length;

	    while (length--) {
	      var key = props[fromRight ? length : ++index];
	      if (iteratee(iterable[key], key, iterable) === false) {
	        break;
	      }
	    }
	    return object;
	  };
	}

	module.exports = baseFor;


/***/ },
/* 68 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */

	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]',
	    funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]',
	    stringTag = '[object String]';

	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;

	/**
	 * The base implementation of `_.times` without support for iteratee shorthands
	 * or max array length checks.
	 *
	 * @private
	 * @param {number} n The number of times to invoke `iteratee`.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array} Returns the array of results.
	 */
	function baseTimes(n, iteratee) {
	  var index = -1,
	      result = Array(n);

	  while (++index < n) {
	    result[index] = iteratee(index);
	  }
	  return result;
	}

	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return value > -1 && value % 1 == 0 && value < length;
	}

	/** Used for built-in method references. */
	var objectProto = global.Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;

	/** Built-in value references. */
	var getPrototypeOf = Object.getPrototypeOf,
	    propertyIsEnumerable = objectProto.propertyIsEnumerable;

	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeKeys = Object.keys;

	/**
	 * The base implementation of `_.has` without support for deep paths.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {Array|string} key The key to check.
	 * @returns {boolean} Returns `true` if `key` exists, else `false`.
	 */
	function baseHas(object, key) {
	  // Avoid a bug in IE 10-11 where objects with a [[Prototype]] of `null`,
	  // that are composed entirely of index properties, return `false` for
	  // `hasOwnProperty` checks of them.
	  return hasOwnProperty.call(object, key) ||
	    (typeof object == 'object' && key in object && getPrototypeOf(object) === null);
	}

	/**
	 * The base implementation of `_.keys` which doesn't skip the constructor
	 * property of prototypes or treat sparse arrays as dense.
	 *
	 * @private
	 * @type Function
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 */
	function baseKeys(object) {
	  return nativeKeys(Object(object));
	}

	/**
	 * The base implementation of `_.property` without support for deep paths.
	 *
	 * @private
	 * @param {string} key The key of the property to get.
	 * @returns {Function} Returns the new function.
	 */
	function baseProperty(key) {
	  return function(object) {
	    return object == null ? undefined : object[key];
	  };
	}

	/**
	 * Gets the "length" property value of `object`.
	 *
	 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
	 * that affects Safari on at least iOS 8.1-8.3 ARM64.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {*} Returns the "length" value.
	 */
	var getLength = baseProperty('length');

	/**
	 * Creates an array of index keys for `object` values of arrays,
	 * `arguments` objects, and strings, otherwise `null` is returned.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array|null} Returns index keys, else `null`.
	 */
	function indexKeys(object) {
	  var length = object ? object.length : undefined;
	  return (isLength(length) && (isArray(object) || isString(object) || isArguments(object)))
	    ? baseTimes(length, String)
	    : null;
	}

	/**
	 * Checks if `value` is likely a prototype object.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
	 */
	function isPrototype(value) {
	  var Ctor = value && value.constructor,
	      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

	  return value === proto;
	}

	/**
	 * Checks if `value` is likely an `arguments` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isArguments(function() { return arguments; }());
	 * // => true
	 *
	 * _.isArguments([1, 2, 3]);
	 * // => false
	 */
	function isArguments(value) {
	  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
	  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
	    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
	}

	/**
	 * Checks if `value` is classified as an `Array` object.
	 *
	 * @static
	 * @memberOf _
	 * @type Function
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isArray([1, 2, 3]);
	 * // => true
	 *
	 * _.isArray(document.body.children);
	 * // => false
	 *
	 * _.isArray('abc');
	 * // => false
	 *
	 * _.isArray(_.noop);
	 * // => false
	 */
	var isArray = Array.isArray;

	/**
	 * Checks if `value` is array-like. A value is considered array-like if it's
	 * not a function and has a `value.length` that's an integer greater than or
	 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	 *
	 * @static
	 * @memberOf _
	 * @type Function
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 * @example
	 *
	 * _.isArrayLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLike(document.body.children);
	 * // => true
	 *
	 * _.isArrayLike('abc');
	 * // => true
	 *
	 * _.isArrayLike(_.noop);
	 * // => false
	 */
	function isArrayLike(value) {
	  return value != null &&
	    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
	}

	/**
	 * This method is like `_.isArrayLike` except that it also checks if `value`
	 * is an object.
	 *
	 * @static
	 * @memberOf _
	 * @type Function
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
	 * @example
	 *
	 * _.isArrayLikeObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLikeObject(document.body.children);
	 * // => true
	 *
	 * _.isArrayLikeObject('abc');
	 * // => false
	 *
	 * _.isArrayLikeObject(_.noop);
	 * // => false
	 */
	function isArrayLikeObject(value) {
	  return isObjectLike(value) && isArrayLike(value);
	}

	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in Safari 8 which returns 'object' for typed array constructors, and
	  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
	  var tag = isObject(value) ? objectToString.call(value) : '';
	  return tag == funcTag || tag == genTag;
	}

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 * @example
	 *
	 * _.isLength(3);
	 * // => true
	 *
	 * _.isLength(Number.MIN_VALUE);
	 * // => false
	 *
	 * _.isLength(Infinity);
	 * // => false
	 *
	 * _.isLength('3');
	 * // => false
	 */
	function isLength(value) {
	  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	/**
	 * Checks if `value` is object-like. A value is object-like if it's not `null`
	 * and has a `typeof` result of "object".
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 * @example
	 *
	 * _.isObjectLike({});
	 * // => true
	 *
	 * _.isObjectLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isObjectLike(_.noop);
	 * // => false
	 *
	 * _.isObjectLike(null);
	 * // => false
	 */
	function isObjectLike(value) {
	  return !!value && typeof value == 'object';
	}

	/**
	 * Checks if `value` is classified as a `String` primitive or object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isString('abc');
	 * // => true
	 *
	 * _.isString(1);
	 * // => false
	 */
	function isString(value) {
	  return typeof value == 'string' ||
	    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
	}

	/**
	 * Creates an array of the own enumerable property names of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects. See the
	 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
	 * for more details.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.keys(new Foo);
	 * // => ['a', 'b'] (iteration order is not guaranteed)
	 *
	 * _.keys('hi');
	 * // => ['0', '1']
	 */
	function keys(object) {
	  var isProto = isPrototype(object);
	  if (!(isProto || isArrayLike(object))) {
	    return baseKeys(object);
	  }
	  var indexes = indexKeys(object),
	      skipIndexes = !!indexes,
	      result = indexes || [],
	      length = result.length;

	  for (var key in object) {
	    if (baseHas(object, key) &&
	        !(skipIndexes && (key == 'length' || isIndex(key, length))) &&
	        !(isProto && key == 'constructor')) {
	      result.push(key);
	    }
	  }
	  return result;
	}

	module.exports = keys;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 69 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */
	var keysIn = __webpack_require__(73),
	    rest = __webpack_require__(10);

	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/** `Object#toString` result references. */
	var funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]';

	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;

	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return value > -1 && value % 1 == 0 && value < length;
	}

	/** Used for built-in method references. */
	var objectProto = global.Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;

	/**
	 * Assigns `value` to `key` of `object` if the existing value is not equivalent
	 * using [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
	 * for equality comparisons.
	 *
	 * @private
	 * @param {Object} object The object to modify.
	 * @param {string} key The key of the property to assign.
	 * @param {*} value The value to assign.
	 */
	function assignValue(object, key, value) {
	  var objValue = object[key];
	  if ((!eq(objValue, value) ||
	        (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) ||
	      (value === undefined && !(key in object))) {
	    object[key] = value;
	  }
	}

	/**
	 * The base implementation of `_.property` without support for deep paths.
	 *
	 * @private
	 * @param {string} key The key of the property to get.
	 * @returns {Function} Returns the new function.
	 */
	function baseProperty(key) {
	  return function(object) {
	    return object == null ? undefined : object[key];
	  };
	}

	/**
	 * This function is like `copyObject` except that it accepts a function to
	 * customize copied values.
	 *
	 * @private
	 * @param {Object} source The object to copy properties from.
	 * @param {Array} props The property names to copy.
	 * @param {Object} [object={}] The object to copy properties to.
	 * @param {Function} [customizer] The function to customize copied values.
	 * @returns {Object} Returns `object`.
	 */
	function copyObjectWith(source, props, object, customizer) {
	  object || (object = {});

	  var index = -1,
	      length = props.length;

	  while (++index < length) {
	    var key = props[index],
	        newValue = customizer ? customizer(object[key], source[key], key, object, source) : source[key];

	    assignValue(object, key, newValue);
	  }
	  return object;
	}

	/**
	 * Creates a function like `_.assign`.
	 *
	 * @private
	 * @param {Function} assigner The function to assign values.
	 * @returns {Function} Returns the new assigner function.
	 */
	function createAssigner(assigner) {
	  return rest(function(object, sources) {
	    var index = -1,
	        length = sources.length,
	        customizer = length > 1 ? sources[length - 1] : undefined,
	        guard = length > 2 ? sources[2] : undefined;

	    customizer = typeof customizer == 'function' ? (length--, customizer) : undefined;
	    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
	      customizer = length < 3 ? undefined : customizer;
	      length = 1;
	    }
	    object = Object(object);
	    while (++index < length) {
	      var source = sources[index];
	      if (source) {
	        assigner(object, source, customizer);
	      }
	    }
	    return object;
	  });
	}

	/**
	 * Gets the "length" property value of `object`.
	 *
	 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
	 * that affects Safari on at least iOS 8.1-8.3 ARM64.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {*} Returns the "length" value.
	 */
	var getLength = baseProperty('length');

	/**
	 * Checks if the provided arguments are from an iteratee call.
	 *
	 * @private
	 * @param {*} value The potential iteratee value argument.
	 * @param {*} index The potential iteratee index or key argument.
	 * @param {*} object The potential iteratee object argument.
	 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
	 */
	function isIterateeCall(value, index, object) {
	  if (!isObject(object)) {
	    return false;
	  }
	  var type = typeof index;
	  if (type == 'number'
	      ? (isArrayLike(object) && isIndex(index, object.length))
	      : (type == 'string' && index in object)) {
	    return eq(object[index], value);
	  }
	  return false;
	}

	/**
	 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
	 * comparison between two values to determine if they are equivalent.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 * @example
	 *
	 * var object = { 'user': 'fred' };
	 * var other = { 'user': 'fred' };
	 *
	 * _.eq(object, object);
	 * // => true
	 *
	 * _.eq(object, other);
	 * // => false
	 *
	 * _.eq('a', 'a');
	 * // => true
	 *
	 * _.eq('a', Object('a'));
	 * // => false
	 *
	 * _.eq(NaN, NaN);
	 * // => true
	 */
	function eq(value, other) {
	  return value === other || (value !== value && other !== other);
	}

	/**
	 * Checks if `value` is array-like. A value is considered array-like if it's
	 * not a function and has a `value.length` that's an integer greater than or
	 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	 *
	 * @static
	 * @memberOf _
	 * @type Function
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 * @example
	 *
	 * _.isArrayLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLike(document.body.children);
	 * // => true
	 *
	 * _.isArrayLike('abc');
	 * // => true
	 *
	 * _.isArrayLike(_.noop);
	 * // => false
	 */
	function isArrayLike(value) {
	  return value != null &&
	    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
	}

	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in Safari 8 which returns 'object' for typed array constructors, and
	  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
	  var tag = isObject(value) ? objectToString.call(value) : '';
	  return tag == funcTag || tag == genTag;
	}

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 * @example
	 *
	 * _.isLength(3);
	 * // => true
	 *
	 * _.isLength(Number.MIN_VALUE);
	 * // => false
	 *
	 * _.isLength(Infinity);
	 * // => false
	 *
	 * _.isLength('3');
	 * // => false
	 */
	function isLength(value) {
	  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	/**
	 * This method is like `_.assignIn` except that it accepts `customizer` which
	 * is invoked to produce the assigned values. If `customizer` returns `undefined`
	 * assignment is handled by the method instead. The `customizer` is invoked
	 * with five arguments: (objValue, srcValue, key, object, source).
	 *
	 * **Note:** This method mutates `object`.
	 *
	 * @static
	 * @memberOf _
	 * @alias extendWith
	 * @category Object
	 * @param {Object} object The destination object.
	 * @param {...Object} sources The source objects.
	 * @param {Function} [customizer] The function to customize assigned values.
	 * @returns {Object} Returns `object`.
	 * @example
	 *
	 * function customizer(objValue, srcValue) {
	 *   return _.isUndefined(objValue) ? srcValue : objValue;
	 * }
	 *
	 * var defaults = _.partialRight(_.assignInWith, customizer);
	 *
	 * defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
	 * // => { 'a': 1, 'b': 2 }
	 */
	var assignInWith = createAssigner(function(object, source, customizer) {
	  copyObjectWith(source, keysIn(source), object, customizer);
	});

	module.exports = assignInWith;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 70 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */
	var assignInWith = __webpack_require__(69),
	    rest = __webpack_require__(10);

	/**
	 * A faster alternative to `Function#apply`, this function invokes `func`
	 * with the `this` binding of `thisArg` and the arguments of `args`.
	 *
	 * @private
	 * @param {Function} func The function to invoke.
	 * @param {*} thisArg The `this` binding of `func`.
	 * @param {...*} [args] The arguments to invoke `func` with.
	 * @returns {*} Returns the result of `func`.
	 */
	function apply(func, thisArg, args) {
	  var length = args ? args.length : 0;
	  switch (length) {
	    case 0: return func.call(thisArg);
	    case 1: return func.call(thisArg, args[0]);
	    case 2: return func.call(thisArg, args[0], args[1]);
	    case 3: return func.call(thisArg, args[0], args[1], args[2]);
	  }
	  return func.apply(thisArg, args);
	}

	/** Used for built-in method references. */
	var objectProto = global.Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used by `_.defaults` to customize its `_.assignIn` use.
	 *
	 * @private
	 * @param {*} objValue The destination value.
	 * @param {*} srcValue The source value.
	 * @param {string} key The key of the property to assign.
	 * @param {Object} object The parent object of `objValue`.
	 * @returns {*} Returns the value to assign.
	 */
	function assignInDefaults(objValue, srcValue, key, object) {
	  if (objValue === undefined ||
	      (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) {
	    return srcValue;
	  }
	  return objValue;
	}

	/**
	 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
	 * comparison between two values to determine if they are equivalent.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 * @example
	 *
	 * var object = { 'user': 'fred' };
	 * var other = { 'user': 'fred' };
	 *
	 * _.eq(object, object);
	 * // => true
	 *
	 * _.eq(object, other);
	 * // => false
	 *
	 * _.eq('a', 'a');
	 * // => true
	 *
	 * _.eq('a', Object('a'));
	 * // => false
	 *
	 * _.eq(NaN, NaN);
	 * // => true
	 */
	function eq(value, other) {
	  return value === other || (value !== value && other !== other);
	}

	/**
	 * Assigns own and inherited enumerable properties of source objects to the
	 * destination object for all destination properties that resolve to `undefined`.
	 * Source objects are applied from left to right. Once a property is set,
	 * additional values of the same property are ignored.
	 *
	 * **Note:** This method mutates `object`.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The destination object.
	 * @param {...Object} [sources] The source objects.
	 * @returns {Object} Returns `object`.
	 * @example
	 *
	 * _.defaults({ 'user': 'barney' }, { 'age': 36 }, { 'user': 'fred' });
	 * // => { 'user': 'barney', 'age': 36 }
	 */
	var defaults = rest(function(args) {
	  args.push(undefined, assignInDefaults);
	  return apply(assignInWith, undefined, args);
	});

	module.exports = defaults;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 71 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */
	var baseFor = __webpack_require__(67),
	    keys = __webpack_require__(72);

	/**
	 * The base implementation of `_.forOwn` without support for iteratee shorthands.
	 *
	 * @private
	 * @param {Object} object The object to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Object} Returns `object`.
	 */
	function baseForOwn(object, iteratee) {
	  return object && baseFor(object, iteratee, keys);
	}

	/**
	 * Converts `value` to a function if it's not one.
	 *
	 * @private
	 * @param {*} value The value to process.
	 * @returns {Function} Returns the function.
	 */
	function toFunction(value) {
	  return typeof value == 'function' ? value : identity;
	}

	/**
	 * Iterates over own enumerable properties of an object invoking `iteratee`
	 * for each property. The iteratee is invoked with three arguments:
	 * (value, key, object). Iteratee functions may exit iteration early by
	 * explicitly returning `false`.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to iterate over.
	 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	 * @returns {Object} Returns `object`.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.forOwn(new Foo, function(value, key) {
	 *   console.log(key);
	 * });
	 * // => logs 'a' then 'b' (iteration order is not guaranteed)
	 */
	function forOwn(object, iteratee) {
	  return object && baseForOwn(object, toFunction(iteratee));
	}

	/**
	 * This method returns the first argument provided to it.
	 *
	 * @static
	 * @memberOf _
	 * @category Util
	 * @param {*} value Any value.
	 * @returns {*} Returns `value`.
	 * @example
	 *
	 * var object = { 'user': 'fred' };
	 *
	 * _.identity(object) === object;
	 * // => true
	 */
	function identity(value) {
	  return value;
	}

	module.exports = forOwn;


/***/ },
/* 72 */
68,
/* 73 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 * Available under MIT license <https://lodash.com/license>
	 */

	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;

	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]',
	    funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]',
	    stringTag = '[object String]';

	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;

	/**
	 * The base implementation of `_.times` without support for iteratee shorthands
	 * or max array length checks.
	 *
	 * @private
	 * @param {number} n The number of times to invoke `iteratee`.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array} Returns the array of results.
	 */
	function baseTimes(n, iteratee) {
	  var index = -1,
	      result = Array(n);

	  while (++index < n) {
	    result[index] = iteratee(index);
	  }
	  return result;
	}

	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return value > -1 && value % 1 == 0 && value < length;
	}

	/**
	 * Converts `iterator` to an array.
	 *
	 * @private
	 * @param {Object} iterator The iterator to convert.
	 * @returns {Array} Returns the converted array.
	 */
	function iteratorToArray(iterator) {
	  var data,
	      result = [];

	  while (!(data = iterator.next()).done) {
	    result.push(data.value);
	  }
	  return result;
	}

	/** Used for built-in method references. */
	var objectProto = global.Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;

	/** Built-in value references. */
	var Reflect = global.Reflect,
	    enumerate = Reflect ? Reflect.enumerate : undefined,
	    propertyIsEnumerable = objectProto.propertyIsEnumerable;

	/**
	 * The base implementation of `_.keysIn` which doesn't skip the constructor
	 * property of prototypes or treat sparse arrays as dense.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 */
	function baseKeysIn(object) {
	  object = object == null ? object : Object(object);

	  var result = [];
	  for (var key in object) {
	    result.push(key);
	  }
	  return result;
	}

	// Fallback for IE < 9 with es6-shim.
	if (enumerate && !propertyIsEnumerable.call({ 'valueOf': 1 }, 'valueOf')) {
	  baseKeysIn = function(object) {
	    return iteratorToArray(enumerate(object));
	  };
	}

	/**
	 * The base implementation of `_.property` without support for deep paths.
	 *
	 * @private
	 * @param {string} key The key of the property to get.
	 * @returns {Function} Returns the new function.
	 */
	function baseProperty(key) {
	  return function(object) {
	    return object == null ? undefined : object[key];
	  };
	}

	/**
	 * Gets the "length" property value of `object`.
	 *
	 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
	 * that affects Safari on at least iOS 8.1-8.3 ARM64.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {*} Returns the "length" value.
	 */
	var getLength = baseProperty('length');

	/**
	 * Creates an array of index keys for `object` values of arrays,
	 * `arguments` objects, and strings, otherwise `null` is returned.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array|null} Returns index keys, else `null`.
	 */
	function indexKeys(object) {
	  var length = object ? object.length : undefined;
	  return (isLength(length) && (isArray(object) || isString(object) || isArguments(object)))
	    ? baseTimes(length, String)
	    : null;
	}

	/**
	 * Checks if `value` is likely a prototype object.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
	 */
	function isPrototype(value) {
	  var Ctor = value && value.constructor,
	      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

	  return value === proto;
	}

	/**
	 * Checks if `value` is likely an `arguments` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isArguments(function() { return arguments; }());
	 * // => true
	 *
	 * _.isArguments([1, 2, 3]);
	 * // => false
	 */
	function isArguments(value) {
	  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
	  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
	    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
	}

	/**
	 * Checks if `value` is classified as an `Array` object.
	 *
	 * @static
	 * @memberOf _
	 * @type Function
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isArray([1, 2, 3]);
	 * // => true
	 *
	 * _.isArray(document.body.children);
	 * // => false
	 *
	 * _.isArray('abc');
	 * // => false
	 *
	 * _.isArray(_.noop);
	 * // => false
	 */
	var isArray = Array.isArray;

	/**
	 * Checks if `value` is array-like. A value is considered array-like if it's
	 * not a function and has a `value.length` that's an integer greater than or
	 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	 *
	 * @static
	 * @memberOf _
	 * @type Function
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 * @example
	 *
	 * _.isArrayLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLike(document.body.children);
	 * // => true
	 *
	 * _.isArrayLike('abc');
	 * // => true
	 *
	 * _.isArrayLike(_.noop);
	 * // => false
	 */
	function isArrayLike(value) {
	  return value != null &&
	    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
	}

	/**
	 * This method is like `_.isArrayLike` except that it also checks if `value`
	 * is an object.
	 *
	 * @static
	 * @memberOf _
	 * @type Function
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
	 * @example
	 *
	 * _.isArrayLikeObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLikeObject(document.body.children);
	 * // => true
	 *
	 * _.isArrayLikeObject('abc');
	 * // => false
	 *
	 * _.isArrayLikeObject(_.noop);
	 * // => false
	 */
	function isArrayLikeObject(value) {
	  return isObjectLike(value) && isArrayLike(value);
	}

	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in Safari 8 which returns 'object' for typed array constructors, and
	  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
	  var tag = isObject(value) ? objectToString.call(value) : '';
	  return tag == funcTag || tag == genTag;
	}

	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 * @example
	 *
	 * _.isLength(3);
	 * // => true
	 *
	 * _.isLength(Number.MIN_VALUE);
	 * // => false
	 *
	 * _.isLength(Infinity);
	 * // => false
	 *
	 * _.isLength('3');
	 * // => false
	 */
	function isLength(value) {
	  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}

	/**
	 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
	 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  // Avoid a V8 JIT bug in Chrome 19-20.
	  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}

	/**
	 * Checks if `value` is object-like. A value is object-like if it's not `null`
	 * and has a `typeof` result of "object".
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 * @example
	 *
	 * _.isObjectLike({});
	 * // => true
	 *
	 * _.isObjectLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isObjectLike(_.noop);
	 * // => false
	 *
	 * _.isObjectLike(null);
	 * // => false
	 */
	function isObjectLike(value) {
	  return !!value && typeof value == 'object';
	}

	/**
	 * Checks if `value` is classified as a `String` primitive or object.
	 *
	 * @static
	 * @memberOf _
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
	 * @example
	 *
	 * _.isString('abc');
	 * // => true
	 *
	 * _.isString(1);
	 * // => false
	 */
	function isString(value) {
	  return typeof value == 'string' ||
	    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
	}

	/**
	 * Creates an array of the own and inherited enumerable property names of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects.
	 *
	 * @static
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.keysIn(new Foo);
	 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
	 */
	function keysIn(object) {
	  var index = -1,
	      isProto = isPrototype(object),
	      props = baseKeysIn(object),
	      propsLength = props.length,
	      indexes = indexKeys(object),
	      skipIndexes = !!indexes,
	      result = indexes || [],
	      length = result.length;

	  while (++index < propsLength) {
	    var key = props[index];
	    if (!(skipIndexes && (key == 'length' || isIndex(key, length))) &&
	        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
	      result.push(key);
	    }
	  }
	  return result;
	}

	module.exports = keysIn;

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 74 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {
	var rng;

	if (global.crypto && crypto.getRandomValues) {
	  // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
	  // Moderately fast, high quality
	  var _rnds8 = new Uint8Array(16);
	  rng = function whatwgRNG() {
	    crypto.getRandomValues(_rnds8);
	    return _rnds8;
	  };
	}

	if (!rng) {
	  // Math.random()-based (RNG)
	  //
	  // If all else fails, use Math.random().  It's fast, but is of unspecified
	  // quality.
	  var  _rnds = new Array(16);
	  rng = function() {
	    for (var i = 0, r; i < 16; i++) {
	      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
	      _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
	    }

	    return _rnds;
	  };
	}

	module.exports = rng;


	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 75 */
/***/ function(module, exports, __webpack_require__) {

	//     uuid.js
	//
	//     Copyright (c) 2010-2012 Robert Kieffer
	//     MIT License - http://opensource.org/licenses/mit-license.php

	// Unique ID creation requires a high quality random # generator.  We feature
	// detect to determine the best RNG source, normalizing to a function that
	// returns 128-bits of randomness, since that's what's usually required
	var _rng = __webpack_require__(74);

	// Maps for number <-> hex string conversion
	var _byteToHex = [];
	var _hexToByte = {};
	for (var i = 0; i < 256; i++) {
	  _byteToHex[i] = (i + 0x100).toString(16).substr(1);
	  _hexToByte[_byteToHex[i]] = i;
	}

	// **`parse()` - Parse a UUID into it's component bytes**
	function parse(s, buf, offset) {
	  var i = (buf && offset) || 0, ii = 0;

	  buf = buf || [];
	  s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
	    if (ii < 16) { // Don't overflow!
	      buf[i + ii++] = _hexToByte[oct];
	    }
	  });

	  // Zero out remaining bytes if string was short
	  while (ii < 16) {
	    buf[i + ii++] = 0;
	  }

	  return buf;
	}

	// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
	function unparse(buf, offset) {
	  var i = offset || 0, bth = _byteToHex;
	  return  bth[buf[i++]] + bth[buf[i++]] +
	          bth[buf[i++]] + bth[buf[i++]] + '-' +
	          bth[buf[i++]] + bth[buf[i++]] + '-' +
	          bth[buf[i++]] + bth[buf[i++]] + '-' +
	          bth[buf[i++]] + bth[buf[i++]] + '-' +
	          bth[buf[i++]] + bth[buf[i++]] +
	          bth[buf[i++]] + bth[buf[i++]] +
	          bth[buf[i++]] + bth[buf[i++]];
	}

	// **`v1()` - Generate time-based UUID**
	//
	// Inspired by https://github.com/LiosK/UUID.js
	// and http://docs.python.org/library/uuid.html

	// random #'s we need to init node and clockseq
	var _seedBytes = _rng();

	// Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
	var _nodeId = [
	  _seedBytes[0] | 0x01,
	  _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
	];

	// Per 4.2.2, randomize (14 bit) clockseq
	var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

	// Previous uuid creation time
	var _lastMSecs = 0, _lastNSecs = 0;

	// See https://github.com/broofa/node-uuid for API details
	function v1(options, buf, offset) {
	  var i = buf && offset || 0;
	  var b = buf || [];

	  options = options || {};

	  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

	  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
	  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
	  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
	  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
	  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

	  // Per 4.2.1.2, use count of uuid's generated during the current clock
	  // cycle to simulate higher resolution clock
	  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

	  // Time since last uuid creation (in msecs)
	  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

	  // Per 4.2.1.2, Bump clockseq on clock regression
	  if (dt < 0 && options.clockseq === undefined) {
	    clockseq = clockseq + 1 & 0x3fff;
	  }

	  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
	  // time interval
	  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
	    nsecs = 0;
	  }

	  // Per 4.2.1.2 Throw error if too many uuids are requested
	  if (nsecs >= 10000) {
	    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
	  }

	  _lastMSecs = msecs;
	  _lastNSecs = nsecs;
	  _clockseq = clockseq;

	  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
	  msecs += 12219292800000;

	  // `time_low`
	  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
	  b[i++] = tl >>> 24 & 0xff;
	  b[i++] = tl >>> 16 & 0xff;
	  b[i++] = tl >>> 8 & 0xff;
	  b[i++] = tl & 0xff;

	  // `time_mid`
	  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
	  b[i++] = tmh >>> 8 & 0xff;
	  b[i++] = tmh & 0xff;

	  // `time_high_and_version`
	  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
	  b[i++] = tmh >>> 16 & 0xff;

	  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
	  b[i++] = clockseq >>> 8 | 0x80;

	  // `clock_seq_low`
	  b[i++] = clockseq & 0xff;

	  // `node`
	  var node = options.node || _nodeId;
	  for (var n = 0; n < 6; n++) {
	    b[i + n] = node[n];
	  }

	  return buf ? buf : unparse(b);
	}

	// **`v4()` - Generate random UUID**

	// See https://github.com/broofa/node-uuid for API details
	function v4(options, buf, offset) {
	  // Deprecated - 'format' argument, as supported in v1.2
	  var i = buf && offset || 0;

	  if (typeof(options) == 'string') {
	    buf = options == 'binary' ? new Array(16) : null;
	    options = null;
	  }
	  options = options || {};

	  var rnds = options.random || (options.rng || _rng)();

	  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
	  rnds[6] = (rnds[6] & 0x0f) | 0x40;
	  rnds[8] = (rnds[8] & 0x3f) | 0x80;

	  // Copy bytes to buffer, if provided
	  if (buf) {
	    for (var ii = 0; ii < 16; ii++) {
	      buf[i + ii] = rnds[ii];
	    }
	  }

	  return buf || unparse(rnds);
	}

	// Export public API
	var uuid = v4;
	uuid.v1 = v1;
	uuid.v4 = v4;
	uuid.parse = parse;
	uuid.unparse = unparse;

	module.exports = uuid;


/***/ },
/* 76 */
/***/ function(module, exports, __webpack_require__) {

	var createElement = __webpack_require__(21)

	module.exports = createElement


/***/ },
/* 77 */
/***/ function(module, exports, __webpack_require__) {

	var diff = __webpack_require__(90)

	module.exports = diff


/***/ },
/* 78 */
/***/ function(module, exports, __webpack_require__) {

	var patch = __webpack_require__(81)

	module.exports = patch


/***/ },
/* 79 */
/***/ function(module, exports) {

	// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
	// We don't want to read all of the DOM nodes in the tree so we use
	// the in-order tree indexing to eliminate recursion down certain branches.
	// We only recurse into a DOM node if we know that it contains a child of
	// interest.

	var noChild = {}

	module.exports = domIndex

	function domIndex(rootNode, tree, indices, nodes) {
	    if (!indices || indices.length === 0) {
	        return {}
	    } else {
	        indices.sort(ascending)
	        return recurse(rootNode, tree, indices, nodes, 0)
	    }
	}

	function recurse(rootNode, tree, indices, nodes, rootIndex) {
	    nodes = nodes || {}


	    if (rootNode) {
	        if (indexInRange(indices, rootIndex, rootIndex)) {
	            nodes[rootIndex] = rootNode
	        }

	        var vChildren = tree.children

	        if (vChildren) {

	            var childNodes = rootNode.childNodes

	            for (var i = 0; i < tree.children.length; i++) {
	                rootIndex += 1

	                var vChild = vChildren[i] || noChild
	                var nextIndex = rootIndex + (vChild.count || 0)

	                // skip recursion down the tree if there are no nodes down here
	                if (indexInRange(indices, rootIndex, nextIndex)) {
	                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
	                }

	                rootIndex = nextIndex
	            }
	        }
	    }

	    return nodes
	}

	// Binary search for an index in the interval [left, right]
	function indexInRange(indices, left, right) {
	    if (indices.length === 0) {
	        return false
	    }

	    var minIndex = 0
	    var maxIndex = indices.length - 1
	    var currentIndex
	    var currentItem

	    while (minIndex <= maxIndex) {
	        currentIndex = ((maxIndex + minIndex) / 2) >> 0
	        currentItem = indices[currentIndex]

	        if (minIndex === maxIndex) {
	            return currentItem >= left && currentItem <= right
	        } else if (currentItem < left) {
	            minIndex = currentIndex + 1
	        } else  if (currentItem > right) {
	            maxIndex = currentIndex - 1
	        } else {
	            return true
	        }
	    }

	    return false;
	}

	function ascending(a, b) {
	    return a > b ? 1 : -1
	}


/***/ },
/* 80 */
/***/ function(module, exports, __webpack_require__) {

	var applyProperties = __webpack_require__(20)

	var isWidget = __webpack_require__(2)
	var VPatch = __webpack_require__(23)

	var updateWidget = __webpack_require__(82)

	module.exports = applyPatch

	function applyPatch(vpatch, domNode, renderOptions) {
	    var type = vpatch.type
	    var vNode = vpatch.vNode
	    var patch = vpatch.patch

	    switch (type) {
	        case VPatch.REMOVE:
	            return removeNode(domNode, vNode)
	        case VPatch.INSERT:
	            return insertNode(domNode, patch, renderOptions)
	        case VPatch.VTEXT:
	            return stringPatch(domNode, vNode, patch, renderOptions)
	        case VPatch.WIDGET:
	            return widgetPatch(domNode, vNode, patch, renderOptions)
	        case VPatch.VNODE:
	            return vNodePatch(domNode, vNode, patch, renderOptions)
	        case VPatch.ORDER:
	            reorderChildren(domNode, patch)
	            return domNode
	        case VPatch.PROPS:
	            applyProperties(domNode, patch, vNode.properties)
	            return domNode
	        case VPatch.THUNK:
	            return replaceRoot(domNode,
	                renderOptions.patch(domNode, patch, renderOptions))
	        default:
	            return domNode
	    }
	}

	function removeNode(domNode, vNode) {
	    var parentNode = domNode.parentNode

	    if (parentNode) {
	        parentNode.removeChild(domNode)
	    }

	    destroyWidget(domNode, vNode);

	    return null
	}

	function insertNode(parentNode, vNode, renderOptions) {
	    var newNode = renderOptions.render(vNode, renderOptions)

	    if (parentNode) {
	        parentNode.appendChild(newNode)
	    }

	    return parentNode
	}

	function stringPatch(domNode, leftVNode, vText, renderOptions) {
	    var newNode

	    if (domNode.nodeType === 3) {
	        domNode.replaceData(0, domNode.length, vText.text)
	        newNode = domNode
	    } else {
	        var parentNode = domNode.parentNode
	        newNode = renderOptions.render(vText, renderOptions)

	        if (parentNode && newNode !== domNode) {
	            parentNode.replaceChild(newNode, domNode)
	        }
	    }

	    return newNode
	}

	function widgetPatch(domNode, leftVNode, widget, renderOptions) {
	    var updating = updateWidget(leftVNode, widget)
	    var newNode

	    if (updating) {
	        newNode = widget.update(leftVNode, domNode) || domNode
	    } else {
	        newNode = renderOptions.render(widget, renderOptions)
	    }

	    var parentNode = domNode.parentNode

	    if (parentNode && newNode !== domNode) {
	        parentNode.replaceChild(newNode, domNode)
	    }

	    if (!updating) {
	        destroyWidget(domNode, leftVNode)
	    }

	    return newNode
	}

	function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
	    var parentNode = domNode.parentNode
	    var newNode = renderOptions.render(vNode, renderOptions)

	    if (parentNode && newNode !== domNode) {
	        parentNode.replaceChild(newNode, domNode)
	    }

	    return newNode
	}

	function destroyWidget(domNode, w) {
	    if (typeof w.destroy === "function" && isWidget(w)) {
	        w.destroy(domNode)
	    }
	}

	function reorderChildren(domNode, moves) {
	    var childNodes = domNode.childNodes
	    var keyMap = {}
	    var node
	    var remove
	    var insert

	    for (var i = 0; i < moves.removes.length; i++) {
	        remove = moves.removes[i]
	        node = childNodes[remove.from]
	        if (remove.key) {
	            keyMap[remove.key] = node
	        }
	        domNode.removeChild(node)
	    }

	    var length = childNodes.length
	    for (var j = 0; j < moves.inserts.length; j++) {
	        insert = moves.inserts[j]
	        node = keyMap[insert.key]
	        // this is the weirdest bug i've ever seen in webkit
	        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
	    }
	}

	function replaceRoot(oldRoot, newRoot) {
	    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
	        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
	    }

	    return newRoot;
	}


/***/ },
/* 81 */
/***/ function(module, exports, __webpack_require__) {

	var document = __webpack_require__(19)
	var isArray = __webpack_require__(12)

	var render = __webpack_require__(21)
	var domIndex = __webpack_require__(79)
	var patchOp = __webpack_require__(80)
	module.exports = patch

	function patch(rootNode, patches, renderOptions) {
	    renderOptions = renderOptions || {}
	    renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
	        ? renderOptions.patch
	        : patchRecursive
	    renderOptions.render = renderOptions.render || render

	    return renderOptions.patch(rootNode, patches, renderOptions)
	}

	function patchRecursive(rootNode, patches, renderOptions) {
	    var indices = patchIndices(patches)

	    if (indices.length === 0) {
	        return rootNode
	    }

	    var index = domIndex(rootNode, patches.a, indices)
	    var ownerDocument = rootNode.ownerDocument

	    if (!renderOptions.document && ownerDocument !== document) {
	        renderOptions.document = ownerDocument
	    }

	    for (var i = 0; i < indices.length; i++) {
	        var nodeIndex = indices[i]
	        rootNode = applyPatch(rootNode,
	            index[nodeIndex],
	            patches[nodeIndex],
	            renderOptions)
	    }

	    return rootNode
	}

	function applyPatch(rootNode, domNode, patchList, renderOptions) {
	    if (!domNode) {
	        return rootNode
	    }

	    var newNode

	    if (isArray(patchList)) {
	        for (var i = 0; i < patchList.length; i++) {
	            newNode = patchOp(patchList[i], domNode, renderOptions)

	            if (domNode === rootNode) {
	                rootNode = newNode
	            }
	        }
	    } else {
	        newNode = patchOp(patchList, domNode, renderOptions)

	        if (domNode === rootNode) {
	            rootNode = newNode
	        }
	    }

	    return rootNode
	}

	function patchIndices(patches) {
	    var indices = []

	    for (var key in patches) {
	        if (key !== "a") {
	            indices.push(Number(key))
	        }
	    }

	    return indices
	}


/***/ },
/* 82 */
/***/ function(module, exports, __webpack_require__) {

	var isWidget = __webpack_require__(2)

	module.exports = updateWidget

	function updateWidget(a, b) {
	    if (isWidget(a) && isWidget(b)) {
	        if ("name" in a && "name" in b) {
	            return a.id === b.id
	        } else {
	            return a.init === b.init
	        }
	    }

	    return false
	}


/***/ },
/* 83 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var EvStore = __webpack_require__(5);

	module.exports = EvHook;

	function EvHook(value) {
	    if (!(this instanceof EvHook)) {
	        return new EvHook(value);
	    }

	    this.value = value;
	}

	EvHook.prototype.hook = function (node, propertyName) {
	    var es = EvStore(node);
	    var propName = propertyName.substr(3);

	    es[propName] = this.value;
	};

	EvHook.prototype.unhook = function(node, propertyName) {
	    var es = EvStore(node);
	    var propName = propertyName.substr(3);

	    es[propName] = undefined;
	};


/***/ },
/* 84 */
/***/ function(module, exports) {

	'use strict';

	module.exports = SoftSetHook;

	function SoftSetHook(value) {
	    if (!(this instanceof SoftSetHook)) {
	        return new SoftSetHook(value);
	    }

	    this.value = value;
	}

	SoftSetHook.prototype.hook = function (node, propertyName) {
	    if (node[propertyName] !== this.value) {
	        node[propertyName] = this.value;
	    }
	};


/***/ },
/* 85 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var isArray = __webpack_require__(12);

	var VNode = __webpack_require__(87);
	var VText = __webpack_require__(88);
	var isVNode = __webpack_require__(3);
	var isVText = __webpack_require__(8);
	var isWidget = __webpack_require__(2);
	var isHook = __webpack_require__(7);
	var isVThunk = __webpack_require__(6);

	var parseTag = __webpack_require__(86);
	var softSetHook = __webpack_require__(84);
	var evHook = __webpack_require__(83);

	module.exports = h;

	function h(tagName, properties, children) {
	    var childNodes = [];
	    var tag, props, key, namespace;

	    if (!children && isChildren(properties)) {
	        children = properties;
	        props = {};
	    }

	    props = props || properties || {};
	    tag = parseTag(tagName, props);

	    // support keys
	    if (props.hasOwnProperty('key')) {
	        key = props.key;
	        props.key = undefined;
	    }

	    // support namespace
	    if (props.hasOwnProperty('namespace')) {
	        namespace = props.namespace;
	        props.namespace = undefined;
	    }

	    // fix cursor bug
	    if (tag === 'INPUT' &&
	        !namespace &&
	        props.hasOwnProperty('value') &&
	        props.value !== undefined &&
	        !isHook(props.value)
	    ) {
	        props.value = softSetHook(props.value);
	    }

	    transformProperties(props);

	    if (children !== undefined && children !== null) {
	        addChild(children, childNodes, tag, props);
	    }


	    return new VNode(tag, props, childNodes, key, namespace);
	}

	function addChild(c, childNodes, tag, props) {
	    if (typeof c === 'string') {
	        childNodes.push(new VText(c));
	    } else if (typeof c === 'number') {
	        childNodes.push(new VText(String(c)));
	    } else if (isChild(c)) {
	        childNodes.push(c);
	    } else if (isArray(c)) {
	        for (var i = 0; i < c.length; i++) {
	            addChild(c[i], childNodes, tag, props);
	        }
	    } else if (c === null || c === undefined) {
	        return;
	    } else {
	        throw UnexpectedVirtualElement({
	            foreignObject: c,
	            parentVnode: {
	                tagName: tag,
	                properties: props
	            }
	        });
	    }
	}

	function transformProperties(props) {
	    for (var propName in props) {
	        if (props.hasOwnProperty(propName)) {
	            var value = props[propName];

	            if (isHook(value)) {
	                continue;
	            }

	            if (propName.substr(0, 3) === 'ev-') {
	                // add ev-foo support
	                props[propName] = evHook(value);
	            }
	        }
	    }
	}

	function isChild(x) {
	    return isVNode(x) || isVText(x) || isWidget(x) || isVThunk(x);
	}

	function isChildren(x) {
	    return typeof x === 'string' || isArray(x) || isChild(x);
	}

	function UnexpectedVirtualElement(data) {
	    var err = new Error();

	    err.type = 'virtual-hyperscript.unexpected.virtual-element';
	    err.message = 'Unexpected virtual child passed to h().\n' +
	        'Expected a VNode / Vthunk / VWidget / string but:\n' +
	        'got:\n' +
	        errorString(data.foreignObject) +
	        '.\n' +
	        'The parent vnode is:\n' +
	        errorString(data.parentVnode)
	        '\n' +
	        'Suggested fix: change your `h(..., [ ... ])` callsite.';
	    err.foreignObject = data.foreignObject;
	    err.parentVnode = data.parentVnode;

	    return err;
	}

	function errorString(obj) {
	    try {
	        return JSON.stringify(obj, null, '    ');
	    } catch (e) {
	        return String(obj);
	    }
	}


/***/ },
/* 86 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var split = __webpack_require__(42);

	var classIdSplit = /([\.#]?[a-zA-Z0-9\u007F-\uFFFF_:-]+)/;
	var notClassId = /^\.|#/;

	module.exports = parseTag;

	function parseTag(tag, props) {
	    if (!tag) {
	        return 'DIV';
	    }

	    var noId = !(props.hasOwnProperty('id'));

	    var tagParts = split(tag, classIdSplit);
	    var tagName = null;

	    if (notClassId.test(tagParts[1])) {
	        tagName = 'DIV';
	    }

	    var classes, part, type, i;

	    for (i = 0; i < tagParts.length; i++) {
	        part = tagParts[i];

	        if (!part) {
	            continue;
	        }

	        type = part.charAt(0);

	        if (!tagName) {
	            tagName = part;
	        } else if (type === '.') {
	            classes = classes || [];
	            classes.push(part.substring(1, part.length));
	        } else if (type === '#' && noId) {
	            props.id = part.substring(1, part.length);
	        }
	    }

	    if (classes) {
	        if (props.className) {
	            classes.push(props.className);
	        }

	        props.className = classes.join(' ');
	    }

	    return props.namespace ? tagName : tagName.toUpperCase();
	}


/***/ },
/* 87 */
/***/ function(module, exports, __webpack_require__) {

	var version = __webpack_require__(4)
	var isVNode = __webpack_require__(3)
	var isWidget = __webpack_require__(2)
	var isThunk = __webpack_require__(6)
	var isVHook = __webpack_require__(7)

	module.exports = VirtualNode

	var noProperties = {}
	var noChildren = []

	function VirtualNode(tagName, properties, children, key, namespace) {
	    this.tagName = tagName
	    this.properties = properties || noProperties
	    this.children = children || noChildren
	    this.key = key != null ? String(key) : undefined
	    this.namespace = (typeof namespace === "string") ? namespace : null

	    var count = (children && children.length) || 0
	    var descendants = 0
	    var hasWidgets = false
	    var hasThunks = false
	    var descendantHooks = false
	    var hooks

	    for (var propName in properties) {
	        if (properties.hasOwnProperty(propName)) {
	            var property = properties[propName]
	            if (isVHook(property) && property.unhook) {
	                if (!hooks) {
	                    hooks = {}
	                }

	                hooks[propName] = property
	            }
	        }
	    }

	    for (var i = 0; i < count; i++) {
	        var child = children[i]
	        if (isVNode(child)) {
	            descendants += child.count || 0

	            if (!hasWidgets && child.hasWidgets) {
	                hasWidgets = true
	            }

	            if (!hasThunks && child.hasThunks) {
	                hasThunks = true
	            }

	            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
	                descendantHooks = true
	            }
	        } else if (!hasWidgets && isWidget(child)) {
	            if (typeof child.destroy === "function") {
	                hasWidgets = true
	            }
	        } else if (!hasThunks && isThunk(child)) {
	            hasThunks = true;
	        }
	    }

	    this.count = count + descendants
	    this.hasWidgets = hasWidgets
	    this.hasThunks = hasThunks
	    this.hooks = hooks
	    this.descendantHooks = descendantHooks
	}

	VirtualNode.prototype.version = version
	VirtualNode.prototype.type = "VirtualNode"


/***/ },
/* 88 */
/***/ function(module, exports, __webpack_require__) {

	var version = __webpack_require__(4)

	module.exports = VirtualText

	function VirtualText(text) {
	    this.text = String(text)
	}

	VirtualText.prototype.version = version
	VirtualText.prototype.type = "VirtualText"


/***/ },
/* 89 */
/***/ function(module, exports, __webpack_require__) {

	var isObject = __webpack_require__(17)
	var isHook = __webpack_require__(7)

	module.exports = diffProps

	function diffProps(a, b) {
	    var diff

	    for (var aKey in a) {
	        if (!(aKey in b)) {
	            diff = diff || {}
	            diff[aKey] = undefined
	        }

	        var aValue = a[aKey]
	        var bValue = b[aKey]

	        if (aValue === bValue) {
	            continue
	        } else if (isObject(aValue) && isObject(bValue)) {
	            if (getPrototype(bValue) !== getPrototype(aValue)) {
	                diff = diff || {}
	                diff[aKey] = bValue
	            } else if (isHook(bValue)) {
	                 diff = diff || {}
	                 diff[aKey] = bValue
	            } else {
	                var objectDiff = diffProps(aValue, bValue)
	                if (objectDiff) {
	                    diff = diff || {}
	                    diff[aKey] = objectDiff
	                }
	            }
	        } else {
	            diff = diff || {}
	            diff[aKey] = bValue
	        }
	    }

	    for (var bKey in b) {
	        if (!(bKey in a)) {
	            diff = diff || {}
	            diff[bKey] = b[bKey]
	        }
	    }

	    return diff
	}

	function getPrototype(value) {
	  if (Object.getPrototypeOf) {
	    return Object.getPrototypeOf(value)
	  } else if (value.__proto__) {
	    return value.__proto__
	  } else if (value.constructor) {
	    return value.constructor.prototype
	  }
	}


/***/ },
/* 90 */
/***/ function(module, exports, __webpack_require__) {

	var isArray = __webpack_require__(12)

	var VPatch = __webpack_require__(23)
	var isVNode = __webpack_require__(3)
	var isVText = __webpack_require__(8)
	var isWidget = __webpack_require__(2)
	var isThunk = __webpack_require__(6)
	var handleThunk = __webpack_require__(22)

	var diffProps = __webpack_require__(89)

	module.exports = diff

	function diff(a, b) {
	    var patch = { a: a }
	    walk(a, b, patch, 0)
	    return patch
	}

	function walk(a, b, patch, index) {
	    if (a === b) {
	        return
	    }

	    var apply = patch[index]
	    var applyClear = false

	    if (isThunk(a) || isThunk(b)) {
	        thunks(a, b, patch, index)
	    } else if (b == null) {

	        // If a is a widget we will add a remove patch for it
	        // Otherwise any child widgets/hooks must be destroyed.
	        // This prevents adding two remove patches for a widget.
	        if (!isWidget(a)) {
	            clearState(a, patch, index)
	            apply = patch[index]
	        }

	        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
	    } else if (isVNode(b)) {
	        if (isVNode(a)) {
	            if (a.tagName === b.tagName &&
	                a.namespace === b.namespace &&
	                a.key === b.key) {
	                var propsPatch = diffProps(a.properties, b.properties)
	                if (propsPatch) {
	                    apply = appendPatch(apply,
	                        new VPatch(VPatch.PROPS, a, propsPatch))
	                }
	                apply = diffChildren(a, b, patch, apply, index)
	            } else {
	                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
	                applyClear = true
	            }
	        } else {
	            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
	            applyClear = true
	        }
	    } else if (isVText(b)) {
	        if (!isVText(a)) {
	            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
	            applyClear = true
	        } else if (a.text !== b.text) {
	            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
	        }
	    } else if (isWidget(b)) {
	        if (!isWidget(a)) {
	            applyClear = true
	        }

	        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
	    }

	    if (apply) {
	        patch[index] = apply
	    }

	    if (applyClear) {
	        clearState(a, patch, index)
	    }
	}

	function diffChildren(a, b, patch, apply, index) {
	    var aChildren = a.children
	    var orderedSet = reorder(aChildren, b.children)
	    var bChildren = orderedSet.children

	    var aLen = aChildren.length
	    var bLen = bChildren.length
	    var len = aLen > bLen ? aLen : bLen

	    for (var i = 0; i < len; i++) {
	        var leftNode = aChildren[i]
	        var rightNode = bChildren[i]
	        index += 1

	        if (!leftNode) {
	            if (rightNode) {
	                // Excess nodes in b need to be added
	                apply = appendPatch(apply,
	                    new VPatch(VPatch.INSERT, null, rightNode))
	            }
	        } else {
	            walk(leftNode, rightNode, patch, index)
	        }

	        if (isVNode(leftNode) && leftNode.count) {
	            index += leftNode.count
	        }
	    }

	    if (orderedSet.moves) {
	        // Reorder nodes last
	        apply = appendPatch(apply, new VPatch(
	            VPatch.ORDER,
	            a,
	            orderedSet.moves
	        ))
	    }

	    return apply
	}

	function clearState(vNode, patch, index) {
	    // TODO: Make this a single walk, not two
	    unhook(vNode, patch, index)
	    destroyWidgets(vNode, patch, index)
	}

	// Patch records for all destroyed widgets must be added because we need
	// a DOM node reference for the destroy function
	function destroyWidgets(vNode, patch, index) {
	    if (isWidget(vNode)) {
	        if (typeof vNode.destroy === "function") {
	            patch[index] = appendPatch(
	                patch[index],
	                new VPatch(VPatch.REMOVE, vNode, null)
	            )
	        }
	    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
	        var children = vNode.children
	        var len = children.length
	        for (var i = 0; i < len; i++) {
	            var child = children[i]
	            index += 1

	            destroyWidgets(child, patch, index)

	            if (isVNode(child) && child.count) {
	                index += child.count
	            }
	        }
	    } else if (isThunk(vNode)) {
	        thunks(vNode, null, patch, index)
	    }
	}

	// Create a sub-patch for thunks
	function thunks(a, b, patch, index) {
	    var nodes = handleThunk(a, b)
	    var thunkPatch = diff(nodes.a, nodes.b)
	    if (hasPatches(thunkPatch)) {
	        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
	    }
	}

	function hasPatches(patch) {
	    for (var index in patch) {
	        if (index !== "a") {
	            return true
	        }
	    }

	    return false
	}

	// Execute hooks when two nodes are identical
	function unhook(vNode, patch, index) {
	    if (isVNode(vNode)) {
	        if (vNode.hooks) {
	            patch[index] = appendPatch(
	                patch[index],
	                new VPatch(
	                    VPatch.PROPS,
	                    vNode,
	                    undefinedKeys(vNode.hooks)
	                )
	            )
	        }

	        if (vNode.descendantHooks || vNode.hasThunks) {
	            var children = vNode.children
	            var len = children.length
	            for (var i = 0; i < len; i++) {
	                var child = children[i]
	                index += 1

	                unhook(child, patch, index)

	                if (isVNode(child) && child.count) {
	                    index += child.count
	                }
	            }
	        }
	    } else if (isThunk(vNode)) {
	        thunks(vNode, null, patch, index)
	    }
	}

	function undefinedKeys(obj) {
	    var result = {}

	    for (var key in obj) {
	        result[key] = undefined
	    }

	    return result
	}

	// List diff, naive left to right reordering
	function reorder(aChildren, bChildren) {
	    // O(M) time, O(M) memory
	    var bChildIndex = keyIndex(bChildren)
	    var bKeys = bChildIndex.keys
	    var bFree = bChildIndex.free

	    if (bFree.length === bChildren.length) {
	        return {
	            children: bChildren,
	            moves: null
	        }
	    }

	    // O(N) time, O(N) memory
	    var aChildIndex = keyIndex(aChildren)
	    var aKeys = aChildIndex.keys
	    var aFree = aChildIndex.free

	    if (aFree.length === aChildren.length) {
	        return {
	            children: bChildren,
	            moves: null
	        }
	    }

	    // O(MAX(N, M)) memory
	    var newChildren = []

	    var freeIndex = 0
	    var freeCount = bFree.length
	    var deletedItems = 0

	    // Iterate through a and match a node in b
	    // O(N) time,
	    for (var i = 0 ; i < aChildren.length; i++) {
	        var aItem = aChildren[i]
	        var itemIndex

	        if (aItem.key) {
	            if (bKeys.hasOwnProperty(aItem.key)) {
	                // Match up the old keys
	                itemIndex = bKeys[aItem.key]
	                newChildren.push(bChildren[itemIndex])

	            } else {
	                // Remove old keyed items
	                itemIndex = i - deletedItems++
	                newChildren.push(null)
	            }
	        } else {
	            // Match the item in a with the next free item in b
	            if (freeIndex < freeCount) {
	                itemIndex = bFree[freeIndex++]
	                newChildren.push(bChildren[itemIndex])
	            } else {
	                // There are no free items in b to match with
	                // the free items in a, so the extra free nodes
	                // are deleted.
	                itemIndex = i - deletedItems++
	                newChildren.push(null)
	            }
	        }
	    }

	    var lastFreeIndex = freeIndex >= bFree.length ?
	        bChildren.length :
	        bFree[freeIndex]

	    // Iterate through b and append any new keys
	    // O(M) time
	    for (var j = 0; j < bChildren.length; j++) {
	        var newItem = bChildren[j]

	        if (newItem.key) {
	            if (!aKeys.hasOwnProperty(newItem.key)) {
	                // Add any new keyed items
	                // We are adding new items to the end and then sorting them
	                // in place. In future we should insert new items in place.
	                newChildren.push(newItem)
	            }
	        } else if (j >= lastFreeIndex) {
	            // Add any leftover non-keyed items
	            newChildren.push(newItem)
	        }
	    }

	    var simulate = newChildren.slice()
	    var simulateIndex = 0
	    var removes = []
	    var inserts = []
	    var simulateItem

	    for (var k = 0; k < bChildren.length;) {
	        var wantedItem = bChildren[k]
	        simulateItem = simulate[simulateIndex]

	        // remove items
	        while (simulateItem === null && simulate.length) {
	            removes.push(remove(simulate, simulateIndex, null))
	            simulateItem = simulate[simulateIndex]
	        }

	        if (!simulateItem || simulateItem.key !== wantedItem.key) {
	            // if we need a key in this position...
	            if (wantedItem.key) {
	                if (simulateItem && simulateItem.key) {
	                    // if an insert doesn't put this key in place, it needs to move
	                    if (bKeys[simulateItem.key] !== k + 1) {
	                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
	                        simulateItem = simulate[simulateIndex]
	                        // if the remove didn't put the wanted item in place, we need to insert it
	                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
	                            inserts.push({key: wantedItem.key, to: k})
	                        }
	                        // items are matching, so skip ahead
	                        else {
	                            simulateIndex++
	                        }
	                    }
	                    else {
	                        inserts.push({key: wantedItem.key, to: k})
	                    }
	                }
	                else {
	                    inserts.push({key: wantedItem.key, to: k})
	                }
	                k++
	            }
	            // a key in simulate has no matching wanted key, remove it
	            else if (simulateItem && simulateItem.key) {
	                removes.push(remove(simulate, simulateIndex, simulateItem.key))
	            }
	        }
	        else {
	            simulateIndex++
	            k++
	        }
	    }

	    // remove all the remaining nodes from simulate
	    while(simulateIndex < simulate.length) {
	        simulateItem = simulate[simulateIndex]
	        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
	    }

	    // If the only moves we have are deletes then we can just
	    // let the delete patch remove these items.
	    if (removes.length === deletedItems && !inserts.length) {
	        return {
	            children: newChildren,
	            moves: null
	        }
	    }

	    return {
	        children: newChildren,
	        moves: {
	            removes: removes,
	            inserts: inserts
	        }
	    }
	}

	function remove(arr, index, key) {
	    arr.splice(index, 1)

	    return {
	        from: index,
	        key: key
	    }
	}

	function keyIndex(children) {
	    var keys = {}
	    var free = []
	    var length = children.length

	    for (var i = 0; i < length; i++) {
	        var child = children[i]

	        if (child.key) {
	            keys[child.key] = i
	        } else {
	            free.push(i)
	        }
	    }

	    return {
	        keys: keys,     // A hash of key name to index
	        free: free      // An array of unkeyed item indices
	    }
	}

	function appendPatch(apply, patch) {
	    if (apply) {
	        if (isArray(apply)) {
	            apply.push(patch)
	        } else {
	            apply = [apply, patch]
	        }

	        return apply
	    } else {
	        return patch
	    }
	}


/***/ },
/* 91 */
/***/ function(module, exports, __webpack_require__) {

	var hiddenStore = __webpack_require__(92);

	module.exports = createStore;

	function createStore() {
	    var key = {};

	    return function (obj) {
	        if ((typeof obj !== 'object' || obj === null) &&
	            typeof obj !== 'function'
	        ) {
	            throw new Error('Weakmap-shim: Key must be object')
	        }

	        var store = obj.valueOf(key);
	        return store && store.identity === key ?
	            store : hiddenStore(obj, key);
	    };
	}


/***/ },
/* 92 */
/***/ function(module, exports) {

	module.exports = hiddenStore;

	function hiddenStore(obj, key) {
	    var store = { identity: key };
	    var valueOf = obj.valueOf;

	    Object.defineProperty(obj, "valueOf", {
	        value: function (value) {
	            return value !== key ?
	                valueOf.apply(this, arguments) : store;
	        },
	        writable: true
	    });

	    return store;
	}


/***/ },
/* 93 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = function() {
		return new Worker(__webpack_require__.p + "f18e16e227ac3f205d8e.worker.js");
	};

/***/ },
/* 94 */
/***/ function(module, exports) {

	/* (ignored) */

/***/ },
/* 95 */
94,
/* 96 */
/***/ function(module, exports, __webpack_require__, __webpack_module_template_argument_0__) {

	/* WEBPACK VAR INJECTION */(function(global) {var topLevel = typeof global !== 'undefined' ? global :
	    typeof window !== 'undefined' ? window : {}
	var minDoc = __webpack_require__(__webpack_module_template_argument_0__);

	if (typeof document !== 'undefined') {
	    module.exports = document;
	} else {
	    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

	    if (!doccy) {
	        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
	    }

	    module.exports = doccy;
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }
/******/ ])));