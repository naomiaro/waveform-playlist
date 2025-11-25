import $t, { useLayoutEffect as qh, useEffect as Ht, useMemo as Rn, useRef as xt, useCallback as rt, createContext as Se, useContext as we, Fragment as Fp, useState as ft } from "react";
import Pp from "react-dom";
import q, { withTheme as zh, ThemeContext as Np, ThemeProvider as Gh } from "styled-components";
function Zh(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var br = { exports: {} }, bi = {};
var Bl;
function Vp() {
  if (Bl) return bi;
  Bl = 1;
  var e = $t, t = Symbol.for("react.element"), n = Symbol.for("react.fragment"), s = Object.prototype.hasOwnProperty, i = e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, r = { key: !0, ref: !0, __self: !0, __source: !0 };
  function o(a, c, l) {
    var u, h = {}, d = null, p = null;
    l !== void 0 && (d = "" + l), c.key !== void 0 && (d = "" + c.key), c.ref !== void 0 && (p = c.ref);
    for (u in c) s.call(c, u) && !r.hasOwnProperty(u) && (h[u] = c[u]);
    if (a && a.defaultProps) for (u in c = a.defaultProps, c) h[u] === void 0 && (h[u] = c[u]);
    return { $$typeof: t, type: a, key: d, ref: p, props: h, _owner: i.current };
  }
  return bi.Fragment = n, bi.jsx = o, bi.jsxs = o, bi;
}
var xi = {};
var $l;
function Wp() {
  return $l || ($l = 1, process.env.NODE_ENV !== "production" && (function() {
    var e = $t, t = Symbol.for("react.element"), n = Symbol.for("react.portal"), s = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), r = Symbol.for("react.profiler"), o = Symbol.for("react.provider"), a = Symbol.for("react.context"), c = Symbol.for("react.forward_ref"), l = Symbol.for("react.suspense"), u = Symbol.for("react.suspense_list"), h = Symbol.for("react.memo"), d = Symbol.for("react.lazy"), p = Symbol.for("react.offscreen"), f = Symbol.iterator, _ = "@@iterator";
    function m(T) {
      if (T === null || typeof T != "object")
        return null;
      var j = f && T[f] || T[_];
      return typeof j == "function" ? j : null;
    }
    var g = e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    function b(T) {
      {
        for (var j = arguments.length, K = new Array(j > 1 ? j - 1 : 0), pt = 1; pt < j; pt++)
          K[pt - 1] = arguments[pt];
        v("error", T, K);
      }
    }
    function v(T, j, K) {
      {
        var pt = g.ReactDebugCurrentFrame, vt = pt.getStackAddendum();
        vt !== "" && (j += "%s", K = K.concat([vt]));
        var Ot = K.map(function(Dt) {
          return String(Dt);
        });
        Ot.unshift("Warning: " + j), Function.prototype.apply.call(console[T], console, Ot);
      }
    }
    var x = !1, y = !1, w = !1, S = !1, C = !1, D;
    D = Symbol.for("react.module.reference");
    function R(T) {
      return !!(typeof T == "string" || typeof T == "function" || T === s || T === r || C || T === i || T === l || T === u || S || T === p || x || y || w || typeof T == "object" && T !== null && (T.$$typeof === d || T.$$typeof === h || T.$$typeof === o || T.$$typeof === a || T.$$typeof === c || // This needs to include all possible module reference object
      // types supported by any Flight configuration anywhere since
      // we don't know which Flight build this will end up being used
      // with.
      T.$$typeof === D || T.getModuleId !== void 0));
    }
    function A(T, j, K) {
      var pt = T.displayName;
      if (pt)
        return pt;
      var vt = j.displayName || j.name || "";
      return vt !== "" ? K + "(" + vt + ")" : K;
    }
    function I(T) {
      return T.displayName || "Context";
    }
    function F(T) {
      if (T == null)
        return null;
      if (typeof T.tag == "number" && b("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), typeof T == "function")
        return T.displayName || T.name || null;
      if (typeof T == "string")
        return T;
      switch (T) {
        case s:
          return "Fragment";
        case n:
          return "Portal";
        case r:
          return "Profiler";
        case i:
          return "StrictMode";
        case l:
          return "Suspense";
        case u:
          return "SuspenseList";
      }
      if (typeof T == "object")
        switch (T.$$typeof) {
          case a:
            var j = T;
            return I(j) + ".Consumer";
          case o:
            var K = T;
            return I(K._context) + ".Provider";
          case c:
            return A(T, T.render, "ForwardRef");
          case h:
            var pt = T.displayName || null;
            return pt !== null ? pt : F(T.type) || "Memo";
          case d: {
            var vt = T, Ot = vt._payload, Dt = vt._init;
            try {
              return F(Dt(Ot));
            } catch {
              return null;
            }
          }
        }
      return null;
    }
    var N = Object.assign, V = 0, W, L, J, z, E, O, Z;
    function H() {
    }
    H.__reactDisabledLog = !0;
    function G() {
      {
        if (V === 0) {
          W = console.log, L = console.info, J = console.warn, z = console.error, E = console.group, O = console.groupCollapsed, Z = console.groupEnd;
          var T = {
            configurable: !0,
            enumerable: !0,
            value: H,
            writable: !0
          };
          Object.defineProperties(console, {
            info: T,
            log: T,
            warn: T,
            error: T,
            group: T,
            groupCollapsed: T,
            groupEnd: T
          });
        }
        V++;
      }
    }
    function X() {
      {
        if (V--, V === 0) {
          var T = {
            configurable: !0,
            enumerable: !0,
            writable: !0
          };
          Object.defineProperties(console, {
            log: N({}, T, {
              value: W
            }),
            info: N({}, T, {
              value: L
            }),
            warn: N({}, T, {
              value: J
            }),
            error: N({}, T, {
              value: z
            }),
            group: N({}, T, {
              value: E
            }),
            groupCollapsed: N({}, T, {
              value: O
            }),
            groupEnd: N({}, T, {
              value: Z
            })
          });
        }
        V < 0 && b("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
      }
    }
    var Q = g.ReactCurrentDispatcher, it;
    function M(T, j, K) {
      {
        if (it === void 0)
          try {
            throw Error();
          } catch (vt) {
            var pt = vt.stack.trim().match(/\n( *(at )?)/);
            it = pt && pt[1] || "";
          }
        return `
` + it + T;
      }
    }
    var ht = !1, tt;
    {
      var Tt = typeof WeakMap == "function" ? WeakMap : Map;
      tt = new Tt();
    }
    function U(T, j) {
      if (!T || ht)
        return "";
      {
        var K = tt.get(T);
        if (K !== void 0)
          return K;
      }
      var pt;
      ht = !0;
      var vt = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      var Ot;
      Ot = Q.current, Q.current = null, G();
      try {
        if (j) {
          var Dt = function() {
            throw Error();
          };
          if (Object.defineProperty(Dt.prototype, "props", {
            set: function() {
              throw Error();
            }
          }), typeof Reflect == "object" && Reflect.construct) {
            try {
              Reflect.construct(Dt, []);
            } catch (Ne) {
              pt = Ne;
            }
            Reflect.construct(T, [], Dt);
          } else {
            try {
              Dt.call();
            } catch (Ne) {
              pt = Ne;
            }
            T.call(Dt.prototype);
          }
        } else {
          try {
            throw Error();
          } catch (Ne) {
            pt = Ne;
          }
          T();
        }
      } catch (Ne) {
        if (Ne && pt && typeof Ne.stack == "string") {
          for (var kt = Ne.stack.split(`
`), Ie = pt.stack.split(`
`), ee = kt.length - 1, ie = Ie.length - 1; ee >= 1 && ie >= 0 && kt[ee] !== Ie[ie]; )
            ie--;
          for (; ee >= 1 && ie >= 0; ee--, ie--)
            if (kt[ee] !== Ie[ie]) {
              if (ee !== 1 || ie !== 1)
                do
                  if (ee--, ie--, ie < 0 || kt[ee] !== Ie[ie]) {
                    var He = `
` + kt[ee].replace(" at new ", " at ");
                    return T.displayName && He.includes("<anonymous>") && (He = He.replace("<anonymous>", T.displayName)), typeof T == "function" && tt.set(T, He), He;
                  }
                while (ee >= 1 && ie >= 0);
              break;
            }
        }
      } finally {
        ht = !1, Q.current = Ot, X(), Error.prepareStackTrace = vt;
      }
      var Es = T ? T.displayName || T.name : "", cs = Es ? M(Es) : "";
      return typeof T == "function" && tt.set(T, cs), cs;
    }
    function Jt(T, j, K) {
      return U(T, !1);
    }
    function fe(T) {
      var j = T.prototype;
      return !!(j && j.isReactComponent);
    }
    function Y(T, j, K) {
      if (T == null)
        return "";
      if (typeof T == "function")
        return U(T, fe(T));
      if (typeof T == "string")
        return M(T);
      switch (T) {
        case l:
          return M("Suspense");
        case u:
          return M("SuspenseList");
      }
      if (typeof T == "object")
        switch (T.$$typeof) {
          case c:
            return Jt(T.render);
          case h:
            return Y(T.type, j, K);
          case d: {
            var pt = T, vt = pt._payload, Ot = pt._init;
            try {
              return Y(Ot(vt), j, K);
            } catch {
            }
          }
        }
      return "";
    }
    var ot = Object.prototype.hasOwnProperty, Vt = {}, Et = g.ReactDebugCurrentFrame;
    function wt(T) {
      if (T) {
        var j = T._owner, K = Y(T.type, T._source, j ? j.type : null);
        Et.setExtraStackFrame(K);
      } else
        Et.setExtraStackFrame(null);
    }
    function et(T, j, K, pt, vt) {
      {
        var Ot = Function.call.bind(ot);
        for (var Dt in T)
          if (Ot(T, Dt)) {
            var kt = void 0;
            try {
              if (typeof T[Dt] != "function") {
                var Ie = Error((pt || "React class") + ": " + K + " type `" + Dt + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof T[Dt] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                throw Ie.name = "Invariant Violation", Ie;
              }
              kt = T[Dt](j, Dt, pt, K, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
            } catch (ee) {
              kt = ee;
            }
            kt && !(kt instanceof Error) && (wt(vt), b("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", pt || "React class", K, Dt, typeof kt), wt(null)), kt instanceof Error && !(kt.message in Vt) && (Vt[kt.message] = !0, wt(vt), b("Failed %s type: %s", K, kt.message), wt(null));
          }
      }
    }
    var mt = Array.isArray;
    function At(T) {
      return mt(T);
    }
    function Lt(T) {
      {
        var j = typeof Symbol == "function" && Symbol.toStringTag, K = j && T[Symbol.toStringTag] || T.constructor.name || "Object";
        return K;
      }
    }
    function Gt(T) {
      try {
        return be(T), !1;
      } catch {
        return !0;
      }
    }
    function be(T) {
      return "" + T;
    }
    function Wt(T) {
      if (Gt(T))
        return b("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", Lt(T)), be(T);
    }
    var Xe = g.ReactCurrentOwner, xe = {
      key: !0,
      ref: !0,
      __self: !0,
      __source: !0
    }, Ae, te;
    function fn(T) {
      if (ot.call(T, "ref")) {
        var j = Object.getOwnPropertyDescriptor(T, "ref").get;
        if (j && j.isReactWarning)
          return !1;
      }
      return T.ref !== void 0;
    }
    function as(T) {
      if (ot.call(T, "key")) {
        var j = Object.getOwnPropertyDescriptor(T, "key").get;
        if (j && j.isReactWarning)
          return !1;
      }
      return T.key !== void 0;
    }
    function mi(T, j) {
      typeof T.ref == "string" && Xe.current;
    }
    function Qo(T, j) {
      {
        var K = function() {
          Ae || (Ae = !0, b("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", j));
        };
        K.isReactWarning = !0, Object.defineProperty(T, "key", {
          get: K,
          configurable: !0
        });
      }
    }
    function Jo(T, j) {
      {
        var K = function() {
          te || (te = !0, b("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", j));
        };
        K.isReactWarning = !0, Object.defineProperty(T, "ref", {
          get: K,
          configurable: !0
        });
      }
    }
    var ta = function(T, j, K, pt, vt, Ot, Dt) {
      var kt = {
        // This tag allows us to uniquely identify this as a React Element
        $$typeof: t,
        // Built-in properties that belong on the element
        type: T,
        key: j,
        ref: K,
        props: Dt,
        // Record the component responsible for creating this element.
        _owner: Ot
      };
      return kt._store = {}, Object.defineProperty(kt._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: !1
      }), Object.defineProperty(kt, "_self", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: pt
      }), Object.defineProperty(kt, "_source", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: vt
      }), Object.freeze && (Object.freeze(kt.props), Object.freeze(kt)), kt;
    };
    function ea(T, j, K, pt, vt) {
      {
        var Ot, Dt = {}, kt = null, Ie = null;
        K !== void 0 && (Wt(K), kt = "" + K), as(j) && (Wt(j.key), kt = "" + j.key), fn(j) && (Ie = j.ref, mi(j, vt));
        for (Ot in j)
          ot.call(j, Ot) && !xe.hasOwnProperty(Ot) && (Dt[Ot] = j[Ot]);
        if (T && T.defaultProps) {
          var ee = T.defaultProps;
          for (Ot in ee)
            Dt[Ot] === void 0 && (Dt[Ot] = ee[Ot]);
        }
        if (kt || Ie) {
          var ie = typeof T == "function" ? T.displayName || T.name || "Unknown" : T;
          kt && Qo(Dt, ie), Ie && Jo(Dt, ie);
        }
        return ta(T, kt, Ie, vt, pt, Xe.current, Dt);
      }
    }
    var gi = g.ReactCurrentOwner, mr = g.ReactDebugCurrentFrame;
    function Ln(T) {
      if (T) {
        var j = T._owner, K = Y(T.type, T._source, j ? j.type : null);
        mr.setExtraStackFrame(K);
      } else
        mr.setExtraStackFrame(null);
    }
    var _i;
    _i = !1;
    function Is(T) {
      return typeof T == "object" && T !== null && T.$$typeof === t;
    }
    function gr() {
      {
        if (gi.current) {
          var T = F(gi.current.type);
          if (T)
            return `

Check the render method of \`` + T + "`.";
        }
        return "";
      }
    }
    function _r(T) {
      return "";
    }
    var yi = {};
    function yr(T) {
      {
        var j = gr();
        if (!j) {
          var K = typeof T == "string" ? T : T.displayName || T.name;
          K && (j = `

Check the top-level render call using <` + K + ">.");
        }
        return j;
      }
    }
    function vi(T, j) {
      {
        if (!T._store || T._store.validated || T.key != null)
          return;
        T._store.validated = !0;
        var K = yr(j);
        if (yi[K])
          return;
        yi[K] = !0;
        var pt = "";
        T && T._owner && T._owner !== gi.current && (pt = " It was passed a child from " + F(T._owner.type) + "."), Ln(T), b('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', K, pt), Ln(null);
      }
    }
    function vr(T, j) {
      {
        if (typeof T != "object")
          return;
        if (At(T))
          for (var K = 0; K < T.length; K++) {
            var pt = T[K];
            Is(pt) && vi(pt, j);
          }
        else if (Is(T))
          T._store && (T._store.validated = !0);
        else if (T) {
          var vt = m(T);
          if (typeof vt == "function" && vt !== T.entries)
            for (var Ot = vt.call(T), Dt; !(Dt = Ot.next()).done; )
              Is(Dt.value) && vi(Dt.value, j);
        }
      }
    }
    function na(T) {
      {
        var j = T.type;
        if (j == null || typeof j == "string")
          return;
        var K;
        if (typeof j == "function")
          K = j.propTypes;
        else if (typeof j == "object" && (j.$$typeof === c || // Note: Memo only checks outer props here.
        // Inner props are checked in the reconciler.
        j.$$typeof === h))
          K = j.propTypes;
        else
          return;
        if (K) {
          var pt = F(j);
          et(K, T.props, "prop", pt, T);
        } else if (j.PropTypes !== void 0 && !_i) {
          _i = !0;
          var vt = F(j);
          b("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", vt || "Unknown");
        }
        typeof j.getDefaultProps == "function" && !j.getDefaultProps.isReactClassApproved && b("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
      }
    }
    function lt(T) {
      {
        for (var j = Object.keys(T.props), K = 0; K < j.length; K++) {
          var pt = j[K];
          if (pt !== "children" && pt !== "key") {
            Ln(T), b("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", pt), Ln(null);
            break;
          }
        }
        T.ref !== null && (Ln(T), b("Invalid attribute `ref` supplied to `React.Fragment`."), Ln(null));
      }
    }
    var _t = {};
    function yt(T, j, K, pt, vt, Ot) {
      {
        var Dt = R(T);
        if (!Dt) {
          var kt = "";
          (T === void 0 || typeof T == "object" && T !== null && Object.keys(T).length === 0) && (kt += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.");
          var Ie = _r();
          Ie ? kt += Ie : kt += gr();
          var ee;
          T === null ? ee = "null" : At(T) ? ee = "array" : T !== void 0 && T.$$typeof === t ? (ee = "<" + (F(T.type) || "Unknown") + " />", kt = " Did you accidentally export a JSX literal instead of a component?") : ee = typeof T, b("React.jsx: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", ee, kt);
        }
        var ie = ea(T, j, K, vt, Ot);
        if (ie == null)
          return ie;
        if (Dt) {
          var He = j.children;
          if (He !== void 0)
            if (pt)
              if (At(He)) {
                for (var Es = 0; Es < He.length; Es++)
                  vr(He[Es], T);
                Object.freeze && Object.freeze(He);
              } else
                b("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
            else
              vr(He, T);
        }
        if (ot.call(j, "key")) {
          var cs = F(T), Ne = Object.keys(j).filter(function(Mp) {
            return Mp !== "key";
          }), sa = Ne.length > 0 ? "{key: someKey, " + Ne.join(": ..., ") + ": ...}" : "{key: someKey}";
          if (!_t[cs + sa]) {
            var Op = Ne.length > 0 ? "{" + Ne.join(": ..., ") + ": ...}" : "{}";
            b(`A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`, sa, cs, Op, cs), _t[cs + sa] = !0;
          }
        }
        return T === s ? lt(ie) : na(ie), ie;
      }
    }
    function Mt(T, j, K) {
      return yt(T, j, K, !0);
    }
    function ut(T, j, K) {
      return yt(T, j, K, !1);
    }
    var ke = ut, Ue = Mt;
    xi.Fragment = s, xi.jsx = ke, xi.jsxs = Ue;
  })()), xi;
}
var ql;
function jp() {
  return ql || (ql = 1, process.env.NODE_ENV === "production" ? br.exports = Vp() : br.exports = Wp()), br.exports;
}
var k = jp(), Ds = {}, zl;
function Lp() {
  if (zl) return Ds;
  zl = 1;
  var e = Pp;
  if (process.env.NODE_ENV === "production")
    Ds.createRoot = e.createRoot, Ds.hydrateRoot = e.hydrateRoot;
  else {
    var t = e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    Ds.createRoot = function(n, s) {
      t.usingClientEntryPoint = !0;
      try {
        return e.createRoot(n, s);
      } finally {
        t.usingClientEntryPoint = !1;
      }
    }, Ds.hydrateRoot = function(n, s, i) {
      t.usingClientEntryPoint = !0;
      try {
        return e.hydrateRoot(n, s, i);
      } finally {
        t.usingClientEntryPoint = !1;
      }
    };
  }
  return Ds;
}
var Bp = Lp();
const _c = "15.1.22", Gl = (e, t, n) => ({ endTime: t, insertTime: n, type: "exponentialRampToValue", value: e }), Zl = (e, t, n) => ({ endTime: t, insertTime: n, type: "linearRampToValue", value: e }), Ia = (e, t) => ({ startTime: t, type: "setValue", value: e }), Yh = (e, t, n) => ({ duration: n, startTime: t, type: "setValueCurve", values: e }), Xh = (e, t, { startTime: n, target: s, timeConstant: i }) => s + (t - s) * Math.exp((n - e) / i), Fs = (e) => e.type === "exponentialRampToValue", Vr = (e) => e.type === "linearRampToValue", qn = (e) => Fs(e) || Vr(e), yc = (e) => e.type === "setValue", An = (e) => e.type === "setValueCurve", Wr = (e, t, n, s) => {
  const i = e[t];
  return i === void 0 ? s : qn(i) || yc(i) ? i.value : An(i) ? i.values[i.values.length - 1] : Xh(n, Wr(e, t - 1, i.startTime, s), i);
}, Yl = (e, t, n, s, i) => n === void 0 ? [s.insertTime, i] : qn(n) ? [n.endTime, n.value] : yc(n) ? [n.startTime, n.value] : An(n) ? [
  n.startTime + n.duration,
  n.values[n.values.length - 1]
] : [
  n.startTime,
  Wr(e, t - 1, n.startTime, i)
], Ea = (e) => e.type === "cancelAndHold", Da = (e) => e.type === "cancelScheduledValues", Bn = (e) => Ea(e) || Da(e) ? e.cancelTime : Fs(e) || Vr(e) ? e.endTime : e.startTime, Xl = (e, t, n, { endTime: s, value: i }) => n === i ? i : 0 < n && 0 < i || n < 0 && i < 0 ? n * (i / n) ** ((e - t) / (s - t)) : 0, Ul = (e, t, n, { endTime: s, value: i }) => n + (e - t) / (s - t) * (i - n), $p = (e, t) => {
  const n = Math.floor(t), s = Math.ceil(t);
  return n === s ? e[n] : (1 - (t - n)) * e[n] + (1 - (s - t)) * e[s];
}, qp = (e, { duration: t, startTime: n, values: s }) => {
  const i = (e - n) / t * (s.length - 1);
  return $p(s, i);
}, xr = (e) => e.type === "setTarget";
class zp {
  constructor(t) {
    this._automationEvents = [], this._currenTime = 0, this._defaultValue = t;
  }
  [Symbol.iterator]() {
    return this._automationEvents[Symbol.iterator]();
  }
  add(t) {
    const n = Bn(t);
    if (Ea(t) || Da(t)) {
      const s = this._automationEvents.findIndex((r) => Da(t) && An(r) ? r.startTime + r.duration >= n : Bn(r) >= n), i = this._automationEvents[s];
      if (s !== -1 && (this._automationEvents = this._automationEvents.slice(0, s)), Ea(t)) {
        const r = this._automationEvents[this._automationEvents.length - 1];
        if (i !== void 0 && qn(i)) {
          if (r !== void 0 && xr(r))
            throw new Error("The internal list is malformed.");
          const o = r === void 0 ? i.insertTime : An(r) ? r.startTime + r.duration : Bn(r), a = r === void 0 ? this._defaultValue : An(r) ? r.values[r.values.length - 1] : r.value, c = Fs(i) ? Xl(n, o, a, i) : Ul(n, o, a, i), l = Fs(i) ? Gl(c, n, this._currenTime) : Zl(c, n, this._currenTime);
          this._automationEvents.push(l);
        }
        if (r !== void 0 && xr(r) && this._automationEvents.push(Ia(this.getValue(n), n)), r !== void 0 && An(r) && r.startTime + r.duration > n) {
          const o = n - r.startTime, a = (r.values.length - 1) / r.duration, c = Math.max(2, 1 + Math.ceil(o * a)), l = o / (c - 1) * a, u = r.values.slice(0, c);
          if (l < 1)
            for (let h = 1; h < c; h += 1) {
              const d = l * h % 1;
              u[h] = r.values[h - 1] * (1 - d) + r.values[h] * d;
            }
          this._automationEvents[this._automationEvents.length - 1] = Yh(u, r.startTime, o);
        }
      }
    } else {
      const s = this._automationEvents.findIndex((o) => Bn(o) > n), i = s === -1 ? this._automationEvents[this._automationEvents.length - 1] : this._automationEvents[s - 1];
      if (i !== void 0 && An(i) && Bn(i) + i.duration > n)
        return !1;
      const r = Fs(t) ? Gl(t.value, t.endTime, this._currenTime) : Vr(t) ? Zl(t.value, n, this._currenTime) : t;
      if (s === -1)
        this._automationEvents.push(r);
      else {
        if (An(t) && n + t.duration > Bn(this._automationEvents[s]))
          return !1;
        this._automationEvents.splice(s, 0, r);
      }
    }
    return !0;
  }
  flush(t) {
    const n = this._automationEvents.findIndex((s) => Bn(s) > t);
    if (n > 1) {
      const s = this._automationEvents.slice(n - 1), i = s[0];
      xr(i) && s.unshift(Ia(Wr(this._automationEvents, n - 2, i.startTime, this._defaultValue), i.startTime)), this._automationEvents = s;
    }
  }
  getValue(t) {
    if (this._automationEvents.length === 0)
      return this._defaultValue;
    const n = this._automationEvents.findIndex((o) => Bn(o) > t), s = this._automationEvents[n], i = (n === -1 ? this._automationEvents.length : n) - 1, r = this._automationEvents[i];
    if (r !== void 0 && xr(r) && (s === void 0 || !qn(s) || s.insertTime > t))
      return Xh(t, Wr(this._automationEvents, i - 1, r.startTime, this._defaultValue), r);
    if (r !== void 0 && yc(r) && (s === void 0 || !qn(s)))
      return r.value;
    if (r !== void 0 && An(r) && (s === void 0 || !qn(s) || r.startTime + r.duration > t))
      return t < r.startTime + r.duration ? qp(t, r) : r.values[r.values.length - 1];
    if (r !== void 0 && qn(r) && (s === void 0 || !qn(s)))
      return r.value;
    if (s !== void 0 && Fs(s)) {
      const [o, a] = Yl(this._automationEvents, i, r, s, this._defaultValue);
      return Xl(t, o, a, s);
    }
    if (s !== void 0 && Vr(s)) {
      const [o, a] = Yl(this._automationEvents, i, r, s, this._defaultValue);
      return Ul(t, o, a, s);
    }
    return this._defaultValue;
  }
}
const Gp = (e) => ({ cancelTime: e, type: "cancelAndHold" }), Zp = (e) => ({ cancelTime: e, type: "cancelScheduledValues" }), Yp = (e, t) => ({ endTime: t, type: "exponentialRampToValue", value: e }), Xp = (e, t) => ({ endTime: t, type: "linearRampToValue", value: e }), Up = (e, t, n) => ({ startTime: t, target: e, timeConstant: n, type: "setTarget" }), Hp = () => new DOMException("", "AbortError"), Kp = (e) => (t, n, [s, i, r], o) => {
  e(t[i], [n, s, r], (a) => a[0] === n && a[1] === s, o);
}, Qp = (e) => (t, n, s) => {
  const i = [];
  for (let r = 0; r < s.numberOfInputs; r += 1)
    i.push(/* @__PURE__ */ new Set());
  e.set(t, {
    activeInputs: i,
    outputs: /* @__PURE__ */ new Set(),
    passiveInputs: /* @__PURE__ */ new WeakMap(),
    renderer: n
  });
}, Jp = (e) => (t, n) => {
  e.set(t, { activeInputs: /* @__PURE__ */ new Set(), passiveInputs: /* @__PURE__ */ new WeakMap(), renderer: n });
}, js = /* @__PURE__ */ new WeakSet(), Uh = /* @__PURE__ */ new WeakMap(), vc = /* @__PURE__ */ new WeakMap(), Hh = /* @__PURE__ */ new WeakMap(), bc = /* @__PURE__ */ new WeakMap(), io = /* @__PURE__ */ new WeakMap(), Kh = /* @__PURE__ */ new WeakMap(), Ra = /* @__PURE__ */ new WeakMap(), Oa = /* @__PURE__ */ new WeakMap(), Ma = /* @__PURE__ */ new WeakMap(), Qh = {
  construct() {
    return Qh;
  }
}, tm = (e) => {
  try {
    const t = new Proxy(e, Qh);
    new t();
  } catch {
    return !1;
  }
  return !0;
}, Hl = /^import(?:(?:[\s]+[\w]+|(?:[\s]+[\w]+[\s]*,)?[\s]*\{[\s]*[\w]+(?:[\s]+as[\s]+[\w]+)?(?:[\s]*,[\s]*[\w]+(?:[\s]+as[\s]+[\w]+)?)*[\s]*}|(?:[\s]+[\w]+[\s]*,)?[\s]*\*[\s]+as[\s]+[\w]+)[\s]+from)?(?:[\s]*)("([^"\\]|\\.)+"|'([^'\\]|\\.)+')(?:[\s]*);?/, Kl = (e, t) => {
  const n = [];
  let s = e.replace(/^[\s]+/, ""), i = s.match(Hl);
  for (; i !== null; ) {
    const r = i[1].slice(1, -1), o = i[0].replace(/([\s]+)?;?$/, "").replace(r, new URL(r, t).toString());
    n.push(o), s = s.slice(i[0].length).replace(/^[\s]+/, ""), i = s.match(Hl);
  }
  return [n.join(";"), s];
}, Ql = (e) => {
  if (e !== void 0 && !Array.isArray(e))
    throw new TypeError("The parameterDescriptors property of given value for processorCtor is not an array.");
}, Jl = (e) => {
  if (!tm(e))
    throw new TypeError("The given value for processorCtor should be a constructor.");
  if (e.prototype === null || typeof e.prototype != "object")
    throw new TypeError("The given value for processorCtor should have a prototype.");
}, em = (e, t, n, s, i, r, o, a, c, l, u, h, d) => {
  let p = 0;
  return (f, _, m = { credentials: "omit" }) => {
    const g = u.get(f);
    if (g !== void 0 && g.has(_))
      return Promise.resolve();
    const b = l.get(f);
    if (b !== void 0) {
      const y = b.get(_);
      if (y !== void 0)
        return y;
    }
    const v = r(f), x = v.audioWorklet === void 0 ? i(_).then(([y, w]) => {
      const [S, C] = Kl(y, w), D = `${S};((a,b)=>{(a[b]=a[b]||[]).push((AudioWorkletProcessor,global,registerProcessor,sampleRate,self,window)=>{${C}
})})(window,'_AWGS')`;
      return n(D);
    }).then(() => {
      const y = d._AWGS.pop();
      if (y === void 0)
        throw new SyntaxError();
      s(v.currentTime, v.sampleRate, () => y(class {
      }, void 0, (w, S) => {
        if (w.trim() === "")
          throw t();
        const C = Oa.get(v);
        if (C !== void 0) {
          if (C.has(w))
            throw t();
          Jl(S), Ql(S.parameterDescriptors), C.set(w, S);
        } else
          Jl(S), Ql(S.parameterDescriptors), Oa.set(v, /* @__PURE__ */ new Map([[w, S]]));
      }, v.sampleRate, void 0, void 0));
    }) : Promise.all([
      i(_),
      Promise.resolve(e(h, h))
    ]).then(([[y, w], S]) => {
      const C = p + 1;
      p = C;
      const [D, R] = Kl(y, w), N = `${D};((AudioWorkletProcessor,registerProcessor)=>{${R}
})(${S ? "AudioWorkletProcessor" : "class extends AudioWorkletProcessor {__b=new WeakSet();constructor(){super();(p=>p.postMessage=(q=>(m,t)=>q.call(p,m,t?t.filter(u=>!this.__b.has(u)):t))(p.postMessage))(this.port)}}"},(n,p)=>registerProcessor(n,class extends p{${S ? "" : "__c = (a) => a.forEach(e=>this.__b.add(e.buffer));"}process(i,o,p){${S ? "" : "i.forEach(this.__c);o.forEach(this.__c);this.__c(Object.values(p));"}return super.process(i.map(j=>j.some(k=>k.length===0)?[]:j),o,p)}}));registerProcessor('__sac${C}',class extends AudioWorkletProcessor{process(){return !1}})`, V = new Blob([N], { type: "application/javascript; charset=utf-8" }), W = URL.createObjectURL(V);
      return v.audioWorklet.addModule(W, m).then(() => {
        if (a(v))
          return v;
        const L = o(v);
        return L.audioWorklet.addModule(W, m).then(() => L);
      }).then((L) => {
        if (c === null)
          throw new SyntaxError();
        try {
          new c(L, `__sac${C}`);
        } catch {
          throw new SyntaxError();
        }
      }).finally(() => URL.revokeObjectURL(W));
    });
    return b === void 0 ? l.set(f, /* @__PURE__ */ new Map([[_, x]])) : b.set(_, x), x.then(() => {
      const y = u.get(f);
      y === void 0 ? u.set(f, /* @__PURE__ */ new Set([_])) : y.add(_);
    }).finally(() => {
      const y = l.get(f);
      y !== void 0 && y.delete(_);
    }), x;
  };
}, rn = (e, t) => {
  const n = e.get(t);
  if (n === void 0)
    throw new Error("A value with the given key could not be found.");
  return n;
}, ro = (e, t) => {
  const n = Array.from(e).filter(t);
  if (n.length > 1)
    throw Error("More than one element was found.");
  if (n.length === 0)
    throw Error("No element was found.");
  const [s] = n;
  return e.delete(s), s;
}, Jh = (e, t, n, s) => {
  const i = rn(e, t), r = ro(i, (o) => o[0] === n && o[1] === s);
  return i.size === 0 && e.delete(t), r;
}, Bi = (e) => rn(Kh, e), Ls = (e) => {
  if (js.has(e))
    throw new Error("The AudioNode is already stored.");
  js.add(e), Bi(e).forEach((t) => t(!0));
}, td = (e) => "port" in e, $i = (e) => {
  if (!js.has(e))
    throw new Error("The AudioNode is not stored.");
  js.delete(e), Bi(e).forEach((t) => t(!1));
}, Fa = (e, t) => {
  !td(e) && t.every((n) => n.size === 0) && $i(e);
}, nm = (e, t, n, s, i, r, o, a, c, l, u, h, d) => {
  const p = /* @__PURE__ */ new WeakMap();
  return (f, _, m, g, b) => {
    const { activeInputs: v, passiveInputs: x } = r(_), { outputs: y } = r(f), w = a(f), S = (C) => {
      const D = c(_), R = c(f);
      if (C) {
        const A = Jh(x, f, m, g);
        e(v, f, A, !1), !b && !h(f) && n(R, D, m, g), d(_) && Ls(_);
      } else {
        const A = s(v, f, m, g);
        t(x, g, A, !1), !b && !h(f) && i(R, D, m, g);
        const I = o(_);
        if (I === 0)
          u(_) && Fa(_, v);
        else {
          const F = p.get(_);
          F !== void 0 && clearTimeout(F), p.set(_, setTimeout(() => {
            u(_) && Fa(_, v);
          }, I * 1e3));
        }
      }
    };
    return l(y, [_, m, g], (C) => C[0] === _ && C[1] === m && C[2] === g, !0) ? (w.add(S), u(f) ? e(v, f, [m, g, S], !0) : t(x, g, [f, m, S], !0), !0) : !1;
  };
}, sm = (e) => (t, n, [s, i, r], o) => {
  const a = t.get(s);
  a === void 0 ? t.set(s, /* @__PURE__ */ new Set([[i, n, r]])) : e(a, [i, n, r], (c) => c[0] === i && c[1] === n, o);
}, im = (e) => (t, n) => {
  const s = e(t, {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "discrete",
    gain: 0
  });
  n.connect(s).connect(t.destination);
  const i = () => {
    n.removeEventListener("ended", i), n.disconnect(s), s.disconnect();
  };
  n.addEventListener("ended", i);
}, rm = (e) => (t, n) => {
  e(t).add(n);
}, om = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  fftSize: 2048,
  maxDecibels: -30,
  minDecibels: -100,
  smoothingTimeConstant: 0.8
}, am = (e, t, n, s, i, r) => class extends e {
  constructor(a, c) {
    const l = i(a), u = { ...om, ...c }, h = s(l, u), d = r(l) ? t() : null;
    super(a, !1, h, d), this._nativeAnalyserNode = h;
  }
  get fftSize() {
    return this._nativeAnalyserNode.fftSize;
  }
  set fftSize(a) {
    this._nativeAnalyserNode.fftSize = a;
  }
  get frequencyBinCount() {
    return this._nativeAnalyserNode.frequencyBinCount;
  }
  get maxDecibels() {
    return this._nativeAnalyserNode.maxDecibels;
  }
  set maxDecibels(a) {
    const c = this._nativeAnalyserNode.maxDecibels;
    if (this._nativeAnalyserNode.maxDecibels = a, !(a > this._nativeAnalyserNode.minDecibels))
      throw this._nativeAnalyserNode.maxDecibels = c, n();
  }
  get minDecibels() {
    return this._nativeAnalyserNode.minDecibels;
  }
  set minDecibels(a) {
    const c = this._nativeAnalyserNode.minDecibels;
    if (this._nativeAnalyserNode.minDecibels = a, !(this._nativeAnalyserNode.maxDecibels > a))
      throw this._nativeAnalyserNode.minDecibels = c, n();
  }
  get smoothingTimeConstant() {
    return this._nativeAnalyserNode.smoothingTimeConstant;
  }
  set smoothingTimeConstant(a) {
    this._nativeAnalyserNode.smoothingTimeConstant = a;
  }
  getByteFrequencyData(a) {
    this._nativeAnalyserNode.getByteFrequencyData(a);
  }
  getByteTimeDomainData(a) {
    this._nativeAnalyserNode.getByteTimeDomainData(a);
  }
  getFloatFrequencyData(a) {
    this._nativeAnalyserNode.getFloatFrequencyData(a);
  }
  getFloatTimeDomainData(a) {
    this._nativeAnalyserNode.getFloatTimeDomainData(a);
  }
}, Te = (e, t) => e.context === t, cm = (e, t, n) => () => {
  const s = /* @__PURE__ */ new WeakMap(), i = async (r, o) => {
    let a = t(r);
    if (!Te(a, o)) {
      const l = {
        channelCount: a.channelCount,
        channelCountMode: a.channelCountMode,
        channelInterpretation: a.channelInterpretation,
        fftSize: a.fftSize,
        maxDecibels: a.maxDecibels,
        minDecibels: a.minDecibels,
        smoothingTimeConstant: a.smoothingTimeConstant
      };
      a = e(o, l);
    }
    return s.set(o, a), await n(r, o, a), a;
  };
  return {
    render(r, o) {
      const a = s.get(o);
      return a !== void 0 ? Promise.resolve(a) : i(r, o);
    }
  };
}, jr = (e) => {
  try {
    e.copyToChannel(new Float32Array(1), 0, -1);
  } catch {
    return !1;
  }
  return !0;
}, bn = () => new DOMException("", "IndexSizeError"), xc = (e) => {
  e.getChannelData = /* @__PURE__ */ ((t) => (n) => {
    try {
      return t.call(e, n);
    } catch (s) {
      throw s.code === 12 ? bn() : s;
    }
  })(e.getChannelData);
}, lm = {
  numberOfChannels: 1
}, um = (e, t, n, s, i, r, o, a) => {
  let c = null;
  return class ed {
    constructor(u) {
      if (i === null)
        throw new Error("Missing the native OfflineAudioContext constructor.");
      const { length: h, numberOfChannels: d, sampleRate: p } = { ...lm, ...u };
      c === null && (c = new i(1, 1, 44100));
      const f = s !== null && t(r, r) ? new s({ length: h, numberOfChannels: d, sampleRate: p }) : c.createBuffer(d, h, p);
      if (f.numberOfChannels === 0)
        throw n();
      return typeof f.copyFromChannel != "function" ? (o(f), xc(f)) : t(jr, () => jr(f)) || a(f), e.add(f), f;
    }
    static [Symbol.hasInstance](u) {
      return u !== null && typeof u == "object" && Object.getPrototypeOf(u) === ed.prototype || e.has(u);
    }
  };
}, Ve = -34028234663852886e22, Ee = -Ve, En = (e) => js.has(e), hm = {
  buffer: null,
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  // Bug #149: Safari does not yet support the detune AudioParam.
  loop: !1,
  loopEnd: 0,
  loopStart: 0,
  playbackRate: 1
}, dm = (e, t, n, s, i, r, o, a) => class extends e {
  constructor(l, u) {
    const h = r(l), d = { ...hm, ...u }, p = i(h, d), f = o(h), _ = f ? t() : null;
    super(l, !1, p, _), this._audioBufferSourceNodeRenderer = _, this._isBufferNullified = !1, this._isBufferSet = d.buffer !== null, this._nativeAudioBufferSourceNode = p, this._onended = null, this._playbackRate = n(this, f, p.playbackRate, Ee, Ve);
  }
  get buffer() {
    return this._isBufferNullified ? null : this._nativeAudioBufferSourceNode.buffer;
  }
  set buffer(l) {
    if (this._nativeAudioBufferSourceNode.buffer = l, l !== null) {
      if (this._isBufferSet)
        throw s();
      this._isBufferSet = !0;
    }
  }
  get loop() {
    return this._nativeAudioBufferSourceNode.loop;
  }
  set loop(l) {
    this._nativeAudioBufferSourceNode.loop = l;
  }
  get loopEnd() {
    return this._nativeAudioBufferSourceNode.loopEnd;
  }
  set loopEnd(l) {
    this._nativeAudioBufferSourceNode.loopEnd = l;
  }
  get loopStart() {
    return this._nativeAudioBufferSourceNode.loopStart;
  }
  set loopStart(l) {
    this._nativeAudioBufferSourceNode.loopStart = l;
  }
  get onended() {
    return this._onended;
  }
  set onended(l) {
    const u = typeof l == "function" ? a(this, l) : null;
    this._nativeAudioBufferSourceNode.onended = u;
    const h = this._nativeAudioBufferSourceNode.onended;
    this._onended = h !== null && h === u ? l : h;
  }
  get playbackRate() {
    return this._playbackRate;
  }
  start(l = 0, u = 0, h) {
    if (this._nativeAudioBufferSourceNode.start(l, u, h), this._audioBufferSourceNodeRenderer !== null && (this._audioBufferSourceNodeRenderer.start = h === void 0 ? [l, u] : [l, u, h]), this.context.state !== "closed") {
      Ls(this);
      const d = () => {
        this._nativeAudioBufferSourceNode.removeEventListener("ended", d), En(this) && $i(this);
      };
      this._nativeAudioBufferSourceNode.addEventListener("ended", d);
    }
  }
  stop(l = 0) {
    this._nativeAudioBufferSourceNode.stop(l), this._audioBufferSourceNodeRenderer !== null && (this._audioBufferSourceNodeRenderer.stop = l);
  }
}, fm = (e, t, n, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap();
  let o = null, a = null;
  const c = async (l, u) => {
    let h = n(l);
    const d = Te(h, u);
    if (!d) {
      const p = {
        buffer: h.buffer,
        channelCount: h.channelCount,
        channelCountMode: h.channelCountMode,
        channelInterpretation: h.channelInterpretation,
        // Bug #149: Safari does not yet support the detune AudioParam.
        loop: h.loop,
        loopEnd: h.loopEnd,
        loopStart: h.loopStart,
        playbackRate: h.playbackRate.value
      };
      h = t(u, p), o !== null && h.start(...o), a !== null && h.stop(a);
    }
    return r.set(u, h), d ? await e(u, l.playbackRate, h.playbackRate) : await s(u, l.playbackRate, h.playbackRate), await i(l, u, h), h;
  };
  return {
    set start(l) {
      o = l;
    },
    set stop(l) {
      a = l;
    },
    render(l, u) {
      const h = r.get(u);
      return h !== void 0 ? Promise.resolve(h) : c(l, u);
    }
  };
}, pm = (e) => "playbackRate" in e, mm = (e) => "frequency" in e && "gain" in e, gm = (e) => "offset" in e, _m = (e) => !("frequency" in e) && "gain" in e, ym = (e) => "detune" in e && "frequency" in e && !("gain" in e), vm = (e) => "pan" in e, Re = (e) => rn(Uh, e), qi = (e) => rn(Hh, e), Pa = (e, t) => {
  const { activeInputs: n } = Re(e);
  n.forEach((i) => i.forEach(([r]) => {
    t.includes(e) || Pa(r, [...t, e]);
  }));
  const s = pm(e) ? [
    // Bug #149: Safari does not yet support the detune AudioParam.
    e.playbackRate
  ] : td(e) ? Array.from(e.parameters.values()) : mm(e) ? [e.Q, e.detune, e.frequency, e.gain] : gm(e) ? [e.offset] : _m(e) ? [e.gain] : ym(e) ? [e.detune, e.frequency] : vm(e) ? [e.pan] : [];
  for (const i of s) {
    const r = qi(i);
    r !== void 0 && r.activeInputs.forEach(([o]) => Pa(o, t));
  }
  En(e) && $i(e);
}, nd = (e) => {
  Pa(e.destination, []);
}, bm = (e) => e === void 0 || typeof e == "number" || typeof e == "string" && (e === "balanced" || e === "interactive" || e === "playback"), xm = (e, t, n, s, i, r, o, a, c) => class extends e {
  constructor(u = {}) {
    if (c === null)
      throw new Error("Missing the native AudioContext constructor.");
    let h;
    try {
      h = new c(u);
    } catch (f) {
      throw f.code === 12 && f.message === "sampleRate is not in range" ? n() : f;
    }
    if (h === null)
      throw s();
    if (!bm(u.latencyHint))
      throw new TypeError(`The provided value '${u.latencyHint}' is not a valid enum value of type AudioContextLatencyCategory.`);
    if (u.sampleRate !== void 0 && h.sampleRate !== u.sampleRate)
      throw n();
    super(h, 2);
    const { latencyHint: d } = u, { sampleRate: p } = h;
    if (this._baseLatency = typeof h.baseLatency == "number" ? h.baseLatency : d === "balanced" ? 512 / p : d === "interactive" || d === void 0 ? 256 / p : d === "playback" ? 1024 / p : (
      /*
       * @todo The min (256) and max (16384) values are taken from the allowed bufferSize values of a
       * ScriptProcessorNode.
       */
      Math.max(2, Math.min(128, Math.round(d * p / 128))) * 128 / p
    ), this._nativeAudioContext = h, c.name === "webkitAudioContext" ? (this._nativeGainNode = h.createGain(), this._nativeOscillatorNode = h.createOscillator(), this._nativeGainNode.gain.value = 1e-37, this._nativeOscillatorNode.connect(this._nativeGainNode).connect(h.destination), this._nativeOscillatorNode.start()) : (this._nativeGainNode = null, this._nativeOscillatorNode = null), this._state = null, h.state === "running") {
      this._state = "suspended";
      const f = () => {
        this._state === "suspended" && (this._state = null), h.removeEventListener("statechange", f);
      };
      h.addEventListener("statechange", f);
    }
  }
  get baseLatency() {
    return this._baseLatency;
  }
  get state() {
    return this._state !== null ? this._state : this._nativeAudioContext.state;
  }
  close() {
    return this.state === "closed" ? this._nativeAudioContext.close().then(() => {
      throw t();
    }) : (this._state === "suspended" && (this._state = null), this._nativeAudioContext.close().then(() => {
      this._nativeGainNode !== null && this._nativeOscillatorNode !== null && (this._nativeOscillatorNode.stop(), this._nativeGainNode.disconnect(), this._nativeOscillatorNode.disconnect()), nd(this);
    }));
  }
  createMediaElementSource(u) {
    return new i(this, { mediaElement: u });
  }
  createMediaStreamDestination() {
    return new r(this);
  }
  createMediaStreamSource(u) {
    return new o(this, { mediaStream: u });
  }
  createMediaStreamTrackSource(u) {
    return new a(this, { mediaStreamTrack: u });
  }
  resume() {
    return this._state === "suspended" ? new Promise((u, h) => {
      const d = () => {
        this._nativeAudioContext.removeEventListener("statechange", d), this._nativeAudioContext.state === "running" ? u() : this.resume().then(u, h);
      };
      this._nativeAudioContext.addEventListener("statechange", d);
    }) : this._nativeAudioContext.resume().catch((u) => {
      throw u === void 0 || u.code === 15 ? t() : u;
    });
  }
  suspend() {
    return this._nativeAudioContext.suspend().catch((u) => {
      throw u === void 0 ? t() : u;
    });
  }
}, wm = (e, t, n, s, i, r, o, a) => class extends e {
  constructor(l, u) {
    const h = r(l), d = o(h), p = i(h, u, d), f = d ? t(a) : null;
    super(l, !1, p, f), this._isNodeOfNativeOfflineAudioContext = d, this._nativeAudioDestinationNode = p;
  }
  get channelCount() {
    return this._nativeAudioDestinationNode.channelCount;
  }
  set channelCount(l) {
    if (this._isNodeOfNativeOfflineAudioContext)
      throw s();
    if (l > this._nativeAudioDestinationNode.maxChannelCount)
      throw n();
    this._nativeAudioDestinationNode.channelCount = l;
  }
  get channelCountMode() {
    return this._nativeAudioDestinationNode.channelCountMode;
  }
  set channelCountMode(l) {
    if (this._isNodeOfNativeOfflineAudioContext)
      throw s();
    this._nativeAudioDestinationNode.channelCountMode = l;
  }
  get maxChannelCount() {
    return this._nativeAudioDestinationNode.maxChannelCount;
  }
}, Cm = (e) => {
  const t = /* @__PURE__ */ new WeakMap(), n = async (s, i) => {
    const r = i.destination;
    return t.set(i, r), await e(s, i, r), r;
  };
  return {
    render(s, i) {
      const r = t.get(i);
      return r !== void 0 ? Promise.resolve(r) : n(s, i);
    }
  };
}, Sm = (e, t, n, s, i, r, o, a) => (c, l) => {
  const u = l.listener, h = () => {
    const y = new Float32Array(1), w = t(l, {
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      numberOfInputs: 9
    }), S = o(l);
    let C = !1, D = [0, 0, -1, 0, 1, 0], R = [0, 0, 0];
    const A = () => {
      if (C)
        return;
      C = !0;
      const V = s(l, 256, 9, 0);
      V.onaudioprocess = ({ inputBuffer: W }) => {
        const L = [
          r(W, y, 0),
          r(W, y, 1),
          r(W, y, 2),
          r(W, y, 3),
          r(W, y, 4),
          r(W, y, 5)
        ];
        L.some((z, E) => z !== D[E]) && (u.setOrientation(...L), D = L);
        const J = [
          r(W, y, 6),
          r(W, y, 7),
          r(W, y, 8)
        ];
        J.some((z, E) => z !== R[E]) && (u.setPosition(...J), R = J);
      }, w.connect(V);
    }, I = (V) => (W) => {
      W !== D[V] && (D[V] = W, u.setOrientation(...D));
    }, F = (V) => (W) => {
      W !== R[V] && (R[V] = W, u.setPosition(...R));
    }, N = (V, W, L) => {
      const J = n(l, {
        channelCount: 1,
        channelCountMode: "explicit",
        channelInterpretation: "discrete",
        offset: W
      });
      J.connect(w, 0, V), J.start(), Object.defineProperty(J.offset, "defaultValue", {
        get() {
          return W;
        }
      });
      const z = e({ context: c }, S, J.offset, Ee, Ve);
      return a(z, "value", (E) => () => E.call(z), (E) => (O) => {
        try {
          E.call(z, O);
        } catch (Z) {
          if (Z.code !== 9)
            throw Z;
        }
        A(), S && L(O);
      }), z.cancelAndHoldAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...O) => {
        const Z = E.apply(z, O);
        return A(), Z;
      })(z.cancelAndHoldAtTime), z.cancelScheduledValues = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...O) => {
        const Z = E.apply(z, O);
        return A(), Z;
      })(z.cancelScheduledValues), z.exponentialRampToValueAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...O) => {
        const Z = E.apply(z, O);
        return A(), Z;
      })(z.exponentialRampToValueAtTime), z.linearRampToValueAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...O) => {
        const Z = E.apply(z, O);
        return A(), Z;
      })(z.linearRampToValueAtTime), z.setTargetAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...O) => {
        const Z = E.apply(z, O);
        return A(), Z;
      })(z.setTargetAtTime), z.setValueAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...O) => {
        const Z = E.apply(z, O);
        return A(), Z;
      })(z.setValueAtTime), z.setValueCurveAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...O) => {
        const Z = E.apply(z, O);
        return A(), Z;
      })(z.setValueCurveAtTime), z;
    };
    return {
      forwardX: N(0, 0, I(0)),
      forwardY: N(1, 0, I(1)),
      forwardZ: N(2, -1, I(2)),
      positionX: N(6, 0, F(0)),
      positionY: N(7, 0, F(1)),
      positionZ: N(8, 0, F(2)),
      upX: N(3, 0, I(3)),
      upY: N(4, 1, I(4)),
      upZ: N(5, 0, I(5))
    };
  }, { forwardX: d, forwardY: p, forwardZ: f, positionX: _, positionY: m, positionZ: g, upX: b, upY: v, upZ: x } = u.forwardX === void 0 ? h() : u;
  return {
    get forwardX() {
      return d;
    },
    get forwardY() {
      return p;
    },
    get forwardZ() {
      return f;
    },
    get positionX() {
      return _;
    },
    get positionY() {
      return m;
    },
    get positionZ() {
      return g;
    },
    get upX() {
      return b;
    },
    get upY() {
      return v;
    },
    get upZ() {
      return x;
    }
  };
}, Lr = (e) => "context" in e, zi = (e) => Lr(e[0]), vs = (e, t, n, s) => {
  for (const i of e)
    if (n(i)) {
      if (s)
        return !1;
      throw Error("The set contains at least one similar element.");
    }
  return e.add(t), !0;
}, tu = (e, t, [n, s], i) => {
  vs(e, [t, n, s], (r) => r[0] === t && r[1] === n, i);
}, eu = (e, [t, n, s], i) => {
  const r = e.get(t);
  r === void 0 ? e.set(t, /* @__PURE__ */ new Set([[n, s]])) : vs(r, [n, s], (o) => o[0] === n, i);
}, Us = (e) => "inputs" in e, Br = (e, t, n, s) => {
  if (Us(t)) {
    const i = t.inputs[s];
    return e.connect(i, n, 0), [i, n, 0];
  }
  return e.connect(t, n, s), [t, n, s];
}, sd = (e, t, n) => {
  for (const s of e)
    if (s[0] === t && s[1] === n)
      return e.delete(s), s;
  return null;
}, Tm = (e, t, n) => ro(e, (s) => s[0] === t && s[1] === n), id = (e, t) => {
  if (!Bi(e).delete(t))
    throw new Error("Missing the expected event listener.");
}, rd = (e, t, n) => {
  const s = rn(e, t), i = ro(s, (r) => r[0] === n);
  return s.size === 0 && e.delete(t), i;
}, $r = (e, t, n, s) => {
  Us(t) ? e.disconnect(t.inputs[s], n, 0) : e.disconnect(t, n, s);
}, zt = (e) => rn(vc, e), Ri = (e) => rn(bc, e), ms = (e) => Ra.has(e), Rr = (e) => !js.has(e), nu = (e, t) => new Promise((n) => {
  if (t !== null)
    n(!0);
  else {
    const s = e.createScriptProcessor(256, 1, 1), i = e.createGain(), r = e.createBuffer(1, 2, 44100), o = r.getChannelData(0);
    o[0] = 1, o[1] = 1;
    const a = e.createBufferSource();
    a.buffer = r, a.loop = !0, a.connect(s).connect(e.destination), a.connect(i), a.disconnect(i), s.onaudioprocess = (c) => {
      const l = c.inputBuffer.getChannelData(0);
      Array.prototype.some.call(l, (u) => u === 1) ? n(!0) : n(!1), a.stop(), s.onaudioprocess = null, a.disconnect(s), s.disconnect(e.destination);
    }, a.start();
  }
}), ia = (e, t) => {
  const n = /* @__PURE__ */ new Map();
  for (const s of e)
    for (const i of s) {
      const r = n.get(i);
      n.set(i, r === void 0 ? 1 : r + 1);
    }
  n.forEach((s, i) => t(i, s));
}, qr = (e) => "context" in e, Am = (e) => {
  const t = /* @__PURE__ */ new Map();
  e.connect = /* @__PURE__ */ ((n) => (s, i = 0, r = 0) => {
    const o = qr(s) ? n(s, i, r) : n(s, i), a = t.get(s);
    return a === void 0 ? t.set(s, [{ input: r, output: i }]) : a.every((c) => c.input !== r || c.output !== i) && a.push({ input: r, output: i }), o;
  })(e.connect.bind(e)), e.disconnect = /* @__PURE__ */ ((n) => (s, i, r) => {
    if (n.apply(e), s === void 0)
      t.clear();
    else if (typeof s == "number")
      for (const [o, a] of t) {
        const c = a.filter((l) => l.output !== s);
        c.length === 0 ? t.delete(o) : t.set(o, c);
      }
    else if (t.has(s))
      if (i === void 0)
        t.delete(s);
      else {
        const o = t.get(s);
        if (o !== void 0) {
          const a = o.filter((c) => c.output !== i && (c.input !== r || r === void 0));
          a.length === 0 ? t.delete(s) : t.set(s, a);
        }
      }
    for (const [o, a] of t)
      a.forEach((c) => {
        qr(o) ? e.connect(o, c.output, c.input) : e.connect(o, c.output);
      });
  })(e.disconnect);
}, km = (e, t, n, s) => {
  const { activeInputs: i, passiveInputs: r } = qi(t), { outputs: o } = Re(e), a = Bi(e), c = (l) => {
    const u = zt(e), h = Ri(t);
    if (l) {
      const d = rd(r, e, n);
      tu(i, e, d, !1), !s && !ms(e) && u.connect(h, n);
    } else {
      const d = Tm(i, e, n);
      eu(r, d, !1), !s && !ms(e) && u.disconnect(h, n);
    }
  };
  return vs(o, [t, n], (l) => l[0] === t && l[1] === n, !0) ? (a.add(c), En(e) ? tu(i, e, [n, c], !0) : eu(r, [e, n, c], !0), !0) : !1;
}, Im = (e, t, n, s) => {
  const { activeInputs: i, passiveInputs: r } = Re(t), o = sd(i[s], e, n);
  return o === null ? [Jh(r, e, n, s)[2], !1] : [o[2], !0];
}, Em = (e, t, n) => {
  const { activeInputs: s, passiveInputs: i } = qi(t), r = sd(s, e, n);
  return r === null ? [rd(i, e, n)[1], !1] : [r[2], !0];
}, wc = (e, t, n, s, i) => {
  const [r, o] = Im(e, n, s, i);
  if (r !== null && (id(e, r), o && !t && !ms(e) && $r(zt(e), zt(n), s, i)), En(n)) {
    const { activeInputs: a } = Re(n);
    Fa(n, a);
  }
}, Cc = (e, t, n, s) => {
  const [i, r] = Em(e, n, s);
  i !== null && (id(e, i), r && !t && !ms(e) && zt(e).disconnect(Ri(n), s));
}, Dm = (e, t) => {
  const n = Re(e), s = [];
  for (const i of n.outputs)
    zi(i) ? wc(e, t, ...i) : Cc(e, t, ...i), s.push(i[0]);
  return n.outputs.clear(), s;
}, Rm = (e, t, n) => {
  const s = Re(e), i = [];
  for (const r of s.outputs)
    r[1] === n && (zi(r) ? wc(e, t, ...r) : Cc(e, t, ...r), i.push(r[0]), s.outputs.delete(r));
  return i;
}, Om = (e, t, n, s, i) => {
  const r = Re(e);
  return Array.from(r.outputs).filter((o) => o[0] === n && (s === void 0 || o[1] === s) && (i === void 0 || o[2] === i)).map((o) => (zi(o) ? wc(e, t, ...o) : Cc(e, t, ...o), r.outputs.delete(o), o[0]));
}, Mm = (e, t, n, s, i, r, o, a, c, l, u, h, d, p, f, _) => class extends l {
  constructor(g, b, v, x) {
    super(v), this._context = g, this._nativeAudioNode = v;
    const y = u(g);
    h(y) && n(nu, () => nu(y, _)) !== !0 && Am(v), vc.set(this, v), Kh.set(this, /* @__PURE__ */ new Set()), g.state !== "closed" && b && Ls(this), e(this, x, v);
  }
  get channelCount() {
    return this._nativeAudioNode.channelCount;
  }
  set channelCount(g) {
    this._nativeAudioNode.channelCount = g;
  }
  get channelCountMode() {
    return this._nativeAudioNode.channelCountMode;
  }
  set channelCountMode(g) {
    this._nativeAudioNode.channelCountMode = g;
  }
  get channelInterpretation() {
    return this._nativeAudioNode.channelInterpretation;
  }
  set channelInterpretation(g) {
    this._nativeAudioNode.channelInterpretation = g;
  }
  get context() {
    return this._context;
  }
  get numberOfInputs() {
    return this._nativeAudioNode.numberOfInputs;
  }
  get numberOfOutputs() {
    return this._nativeAudioNode.numberOfOutputs;
  }
  // tslint:disable-next-line:invalid-void
  connect(g, b = 0, v = 0) {
    if (b < 0 || b >= this._nativeAudioNode.numberOfOutputs)
      throw i();
    const x = u(this._context), y = f(x);
    if (d(g) || p(g))
      throw r();
    if (Lr(g)) {
      const C = zt(g);
      try {
        const R = Br(this._nativeAudioNode, C, b, v), A = Rr(this);
        (y || A) && this._nativeAudioNode.disconnect(...R), this.context.state !== "closed" && !A && Rr(g) && Ls(g);
      } catch (R) {
        throw R.code === 12 ? r() : R;
      }
      if (t(this, g, b, v, y)) {
        const R = c([this], g);
        ia(R, s(y));
      }
      return g;
    }
    const w = Ri(g);
    if (w.name === "playbackRate" && w.maxValue === 1024)
      throw o();
    try {
      this._nativeAudioNode.connect(w, b), (y || Rr(this)) && this._nativeAudioNode.disconnect(w, b);
    } catch (C) {
      throw C.code === 12 ? r() : C;
    }
    if (km(this, g, b, y)) {
      const C = c([this], g);
      ia(C, s(y));
    }
  }
  disconnect(g, b, v) {
    let x;
    const y = u(this._context), w = f(y);
    if (g === void 0)
      x = Dm(this, w);
    else if (typeof g == "number") {
      if (g < 0 || g >= this.numberOfOutputs)
        throw i();
      x = Rm(this, w, g);
    } else {
      if (b !== void 0 && (b < 0 || b >= this.numberOfOutputs) || Lr(g) && v !== void 0 && (v < 0 || v >= g.numberOfInputs))
        throw i();
      if (x = Om(this, w, g, b, v), x.length === 0)
        throw r();
    }
    for (const S of x) {
      const C = c([this], S);
      ia(C, a);
    }
  }
}, Fm = (e, t, n, s, i, r, o, a, c, l, u, h, d) => (p, f, _, m = null, g = null) => {
  const b = _.value, v = new zp(b), x = f ? s(v) : null, y = {
    get defaultValue() {
      return b;
    },
    get maxValue() {
      return m === null ? _.maxValue : m;
    },
    get minValue() {
      return g === null ? _.minValue : g;
    },
    get value() {
      return _.value;
    },
    set value(w) {
      _.value = w, y.setValueAtTime(w, p.context.currentTime);
    },
    cancelAndHoldAtTime(w) {
      if (typeof _.cancelAndHoldAtTime == "function")
        x === null && v.flush(p.context.currentTime), v.add(i(w)), _.cancelAndHoldAtTime(w);
      else {
        const S = Array.from(v).pop();
        x === null && v.flush(p.context.currentTime), v.add(i(w));
        const C = Array.from(v).pop();
        _.cancelScheduledValues(w), S !== C && C !== void 0 && (C.type === "exponentialRampToValue" ? _.exponentialRampToValueAtTime(C.value, C.endTime) : C.type === "linearRampToValue" ? _.linearRampToValueAtTime(C.value, C.endTime) : C.type === "setValue" ? _.setValueAtTime(C.value, C.startTime) : C.type === "setValueCurve" && _.setValueCurveAtTime(C.values, C.startTime, C.duration));
      }
      return y;
    },
    cancelScheduledValues(w) {
      return x === null && v.flush(p.context.currentTime), v.add(r(w)), _.cancelScheduledValues(w), y;
    },
    exponentialRampToValueAtTime(w, S) {
      if (w === 0)
        throw new RangeError();
      if (!Number.isFinite(S) || S < 0)
        throw new RangeError();
      const C = p.context.currentTime;
      return x === null && v.flush(C), Array.from(v).length === 0 && (v.add(l(b, C)), _.setValueAtTime(b, C)), v.add(o(w, S)), _.exponentialRampToValueAtTime(w, S), y;
    },
    linearRampToValueAtTime(w, S) {
      const C = p.context.currentTime;
      return x === null && v.flush(C), Array.from(v).length === 0 && (v.add(l(b, C)), _.setValueAtTime(b, C)), v.add(a(w, S)), _.linearRampToValueAtTime(w, S), y;
    },
    setTargetAtTime(w, S, C) {
      return x === null && v.flush(p.context.currentTime), v.add(c(w, S, C)), _.setTargetAtTime(w, S, C), y;
    },
    setValueAtTime(w, S) {
      return x === null && v.flush(p.context.currentTime), v.add(l(w, S)), _.setValueAtTime(w, S), y;
    },
    setValueCurveAtTime(w, S, C) {
      const D = w instanceof Float32Array ? w : new Float32Array(w);
      if (h !== null && h.name === "webkitAudioContext") {
        const R = S + C, A = p.context.sampleRate, I = Math.ceil(S * A), F = Math.floor(R * A), N = F - I, V = new Float32Array(N);
        for (let L = 0; L < N; L += 1) {
          const J = (D.length - 1) / C * ((I + L) / A - S), z = Math.floor(J), E = Math.ceil(J);
          V[L] = z === E ? D[z] : (1 - (J - z)) * D[z] + (1 - (E - J)) * D[E];
        }
        x === null && v.flush(p.context.currentTime), v.add(u(V, S, C)), _.setValueCurveAtTime(V, S, C);
        const W = F / A;
        W < R && d(y, V[V.length - 1], W), d(y, D[D.length - 1], R);
      } else
        x === null && v.flush(p.context.currentTime), v.add(u(D, S, C)), _.setValueCurveAtTime(D, S, C);
      return y;
    }
  };
  return n.set(y, _), t.set(y, p), e(y, x), y;
}, Pm = (e) => ({
  replay(t) {
    for (const n of e)
      if (n.type === "exponentialRampToValue") {
        const { endTime: s, value: i } = n;
        t.exponentialRampToValueAtTime(i, s);
      } else if (n.type === "linearRampToValue") {
        const { endTime: s, value: i } = n;
        t.linearRampToValueAtTime(i, s);
      } else if (n.type === "setTarget") {
        const { startTime: s, target: i, timeConstant: r } = n;
        t.setTargetAtTime(i, s, r);
      } else if (n.type === "setValue") {
        const { startTime: s, value: i } = n;
        t.setValueAtTime(i, s);
      } else if (n.type === "setValueCurve") {
        const { duration: s, startTime: i, values: r } = n;
        t.setValueCurveAtTime(r, i, s);
      } else
        throw new Error("Can't apply an unknown automation.");
  }
});
class od {
  constructor(t) {
    this._map = new Map(t);
  }
  get size() {
    return this._map.size;
  }
  entries() {
    return this._map.entries();
  }
  forEach(t, n = null) {
    return this._map.forEach((s, i) => t.call(n, s, i, this));
  }
  get(t) {
    return this._map.get(t);
  }
  has(t) {
    return this._map.has(t);
  }
  keys() {
    return this._map.keys();
  }
  values() {
    return this._map.values();
  }
}
const Nm = {
  channelCount: 2,
  // Bug #61: The channelCountMode should be 'max' according to the spec but is set to 'explicit' to achieve consistent behavior.
  channelCountMode: "explicit",
  channelInterpretation: "speakers",
  numberOfInputs: 1,
  numberOfOutputs: 1,
  parameterData: {},
  processorOptions: {}
}, Vm = (e, t, n, s, i, r, o, a, c, l, u, h, d, p) => class extends t {
  constructor(_, m, g) {
    var b;
    const v = a(_), x = c(v), y = u({ ...Nm, ...g });
    d(y);
    const w = Oa.get(v), S = w?.get(m), C = x || v.state !== "closed" ? v : (b = o(v)) !== null && b !== void 0 ? b : v, D = i(C, x ? null : _.baseLatency, l, m, S, y), R = x ? s(m, y, S) : null;
    super(_, !0, D, R);
    const A = [];
    D.parameters.forEach((F, N) => {
      const V = n(this, x, F);
      A.push([N, V]);
    }), this._nativeAudioWorkletNode = D, this._onprocessorerror = null, this._parameters = new od(A), x && e(v, this);
    const { activeInputs: I } = r(this);
    h(D, I);
  }
  get onprocessorerror() {
    return this._onprocessorerror;
  }
  set onprocessorerror(_) {
    const m = typeof _ == "function" ? p(this, _) : null;
    this._nativeAudioWorkletNode.onprocessorerror = m;
    const g = this._nativeAudioWorkletNode.onprocessorerror;
    this._onprocessorerror = g !== null && g === m ? _ : g;
  }
  get parameters() {
    return this._parameters === null ? this._nativeAudioWorkletNode.parameters : this._parameters;
  }
  get port() {
    return this._nativeAudioWorkletNode.port;
  }
};
function zr(e, t, n, s, i) {
  if (typeof e.copyFromChannel == "function")
    t[n].byteLength === 0 && (t[n] = new Float32Array(128)), e.copyFromChannel(t[n], s, i);
  else {
    const r = e.getChannelData(s);
    if (t[n].byteLength === 0)
      t[n] = r.slice(i, i + 128);
    else {
      const o = new Float32Array(r.buffer, i * Float32Array.BYTES_PER_ELEMENT, 128);
      t[n].set(o);
    }
  }
}
const ad = (e, t, n, s, i) => {
  typeof e.copyToChannel == "function" ? t[n].byteLength !== 0 && e.copyToChannel(t[n], s, i) : t[n].byteLength !== 0 && e.getChannelData(s).set(t[n], i);
}, Gr = (e, t) => {
  const n = [];
  for (let s = 0; s < e; s += 1) {
    const i = [], r = typeof t == "number" ? t : t[s];
    for (let o = 0; o < r; o += 1)
      i.push(new Float32Array(128));
    n.push(i);
  }
  return n;
}, Wm = (e, t) => {
  const n = rn(Ma, e), s = zt(t);
  return rn(n, s);
}, jm = async (e, t, n, s, i, r, o) => {
  const a = t === null ? Math.ceil(e.context.length / 128) * 128 : t.length, c = s.channelCount * s.numberOfInputs, l = i.reduce((m, g) => m + g, 0), u = l === 0 ? null : n.createBuffer(l, a, n.sampleRate);
  if (r === void 0)
    throw new Error("Missing the processor constructor.");
  const h = Re(e), d = await Wm(n, e), p = Gr(s.numberOfInputs, s.channelCount), f = Gr(s.numberOfOutputs, i), _ = Array.from(e.parameters.keys()).reduce((m, g) => ({ ...m, [g]: new Float32Array(128) }), {});
  for (let m = 0; m < a; m += 128) {
    if (s.numberOfInputs > 0 && t !== null)
      for (let g = 0; g < s.numberOfInputs; g += 1)
        for (let b = 0; b < s.channelCount; b += 1)
          zr(t, p[g], b, b, m);
    r.parameterDescriptors !== void 0 && t !== null && r.parameterDescriptors.forEach(({ name: g }, b) => {
      zr(t, _, g, c + b, m);
    });
    for (let g = 0; g < s.numberOfInputs; g += 1)
      for (let b = 0; b < i[g]; b += 1)
        f[g][b].byteLength === 0 && (f[g][b] = new Float32Array(128));
    try {
      const g = p.map((v, x) => h.activeInputs[x].size === 0 ? [] : v), b = o(m / n.sampleRate, n.sampleRate, () => d.process(g, f, _));
      if (u !== null)
        for (let v = 0, x = 0; v < s.numberOfOutputs; v += 1) {
          for (let y = 0; y < i[v]; y += 1)
            ad(u, f[v], y, x + y, m);
          x += i[v];
        }
      if (!b)
        break;
    } catch (g) {
      e.dispatchEvent(new ErrorEvent("processorerror", {
        colno: g.colno,
        filename: g.filename,
        lineno: g.lineno,
        message: g.message
      }));
      break;
    }
  }
  return u;
}, Lm = (e, t, n, s, i, r, o, a, c, l, u, h, d, p, f, _) => (m, g, b) => {
  const v = /* @__PURE__ */ new WeakMap();
  let x = null;
  const y = async (w, S) => {
    let C = u(w), D = null;
    const R = Te(C, S), A = Array.isArray(g.outputChannelCount) ? g.outputChannelCount : Array.from(g.outputChannelCount);
    if (h === null) {
      const I = A.reduce((W, L) => W + L, 0), F = i(S, {
        channelCount: Math.max(1, I),
        channelCountMode: "explicit",
        channelInterpretation: "discrete",
        numberOfOutputs: Math.max(1, I)
      }), N = [];
      for (let W = 0; W < w.numberOfOutputs; W += 1)
        N.push(s(S, {
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "speakers",
          numberOfInputs: A[W]
        }));
      const V = o(S, {
        channelCount: g.channelCount,
        channelCountMode: g.channelCountMode,
        channelInterpretation: g.channelInterpretation,
        gain: 1
      });
      V.connect = t.bind(null, N), V.disconnect = c.bind(null, N), D = [F, N, V];
    } else R || (C = new h(S, m));
    if (v.set(S, D === null ? C : D[2]), D !== null) {
      if (x === null) {
        if (b === void 0)
          throw new Error("Missing the processor constructor.");
        if (d === null)
          throw new Error("Missing the native OfflineAudioContext constructor.");
        const L = w.channelCount * w.numberOfInputs, J = b.parameterDescriptors === void 0 ? 0 : b.parameterDescriptors.length, z = L + J;
        x = jm(w, z === 0 ? null : await (async () => {
          const O = new d(
            z,
            // Ceil the length to the next full render quantum.
            // Bug #17: Safari does not yet expose the length.
            Math.ceil(w.context.length / 128) * 128,
            S.sampleRate
          ), Z = [], H = [];
          for (let Q = 0; Q < g.numberOfInputs; Q += 1)
            Z.push(o(O, {
              channelCount: g.channelCount,
              channelCountMode: g.channelCountMode,
              channelInterpretation: g.channelInterpretation,
              gain: 1
            })), H.push(i(O, {
              channelCount: g.channelCount,
              channelCountMode: "explicit",
              channelInterpretation: "discrete",
              numberOfOutputs: g.channelCount
            }));
          const G = await Promise.all(Array.from(w.parameters.values()).map(async (Q) => {
            const it = r(O, {
              channelCount: 1,
              channelCountMode: "explicit",
              channelInterpretation: "discrete",
              offset: Q.value
            });
            return await p(O, Q, it.offset), it;
          })), X = s(O, {
            channelCount: 1,
            channelCountMode: "explicit",
            channelInterpretation: "speakers",
            numberOfInputs: Math.max(1, L + J)
          });
          for (let Q = 0; Q < g.numberOfInputs; Q += 1) {
            Z[Q].connect(H[Q]);
            for (let it = 0; it < g.channelCount; it += 1)
              H[Q].connect(X, it, Q * g.channelCount + it);
          }
          for (const [Q, it] of G.entries())
            it.connect(X, 0, L + Q), it.start(0);
          return X.connect(O.destination), await Promise.all(Z.map((Q) => f(w, O, Q))), _(O);
        })(), S, g, A, b, l);
      }
      const I = await x, F = n(S, {
        buffer: null,
        channelCount: 2,
        channelCountMode: "max",
        channelInterpretation: "speakers",
        loop: !1,
        loopEnd: 0,
        loopStart: 0,
        playbackRate: 1
      }), [N, V, W] = D;
      I !== null && (F.buffer = I, F.start(0)), F.connect(N);
      for (let L = 0, J = 0; L < w.numberOfOutputs; L += 1) {
        const z = V[L];
        for (let E = 0; E < A[L]; E += 1)
          N.connect(z, J + E, E);
        J += A[L];
      }
      return W;
    }
    if (R)
      for (const [I, F] of w.parameters.entries())
        await e(
          S,
          F,
          // @todo The definition that TypeScript uses of the AudioParamMap is lacking many methods.
          C.parameters.get(I)
        );
    else
      for (const [I, F] of w.parameters.entries())
        await p(
          S,
          F,
          // @todo The definition that TypeScript uses of the AudioParamMap is lacking many methods.
          C.parameters.get(I)
        );
    return await f(w, S, C), C;
  };
  return {
    render(w, S) {
      a(S, w);
      const C = v.get(S);
      return C !== void 0 ? Promise.resolve(C) : y(w, S);
    }
  };
}, Bm = (e, t, n, s, i, r, o, a, c, l, u, h, d, p, f, _, m, g, b, v) => class extends f {
  constructor(y, w) {
    super(y, w), this._nativeContext = y, this._audioWorklet = e === void 0 ? void 0 : {
      addModule: (S, C) => e(this, S, C)
    };
  }
  get audioWorklet() {
    return this._audioWorklet;
  }
  createAnalyser() {
    return new t(this);
  }
  createBiquadFilter() {
    return new i(this);
  }
  createBuffer(y, w, S) {
    return new n({ length: w, numberOfChannels: y, sampleRate: S });
  }
  createBufferSource() {
    return new s(this);
  }
  createChannelMerger(y = 6) {
    return new r(this, { numberOfInputs: y });
  }
  createChannelSplitter(y = 6) {
    return new o(this, { numberOfOutputs: y });
  }
  createConstantSource() {
    return new a(this);
  }
  createConvolver() {
    return new c(this);
  }
  createDelay(y = 1) {
    return new u(this, { maxDelayTime: y });
  }
  createDynamicsCompressor() {
    return new h(this);
  }
  createGain() {
    return new d(this);
  }
  createIIRFilter(y, w) {
    return new p(this, { feedback: w, feedforward: y });
  }
  createOscillator() {
    return new _(this);
  }
  createPanner() {
    return new m(this);
  }
  createPeriodicWave(y, w, S = { disableNormalization: !1 }) {
    return new g(this, { ...S, imag: w, real: y });
  }
  createStereoPanner() {
    return new b(this);
  }
  createWaveShaper() {
    return new v(this);
  }
  decodeAudioData(y, w, S) {
    return l(this._nativeContext, y).then((C) => (typeof w == "function" && w(C), C), (C) => {
      throw typeof S == "function" && S(C), C;
    });
  }
}, $m = {
  Q: 1,
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  detune: 0,
  frequency: 350,
  gain: 0,
  type: "lowpass"
}, qm = (e, t, n, s, i, r, o, a) => class extends e {
  constructor(l, u) {
    const h = r(l), d = { ...$m, ...u }, p = i(h, d), f = o(h), _ = f ? n() : null;
    super(l, !1, p, _), this._Q = t(this, f, p.Q, Ee, Ve), this._detune = t(this, f, p.detune, 1200 * Math.log2(Ee), -1200 * Math.log2(Ee)), this._frequency = t(this, f, p.frequency, l.sampleRate / 2, 0), this._gain = t(this, f, p.gain, 40 * Math.log10(Ee), Ve), this._nativeBiquadFilterNode = p, a(this, 1);
  }
  get detune() {
    return this._detune;
  }
  get frequency() {
    return this._frequency;
  }
  get gain() {
    return this._gain;
  }
  get Q() {
    return this._Q;
  }
  get type() {
    return this._nativeBiquadFilterNode.type;
  }
  set type(l) {
    this._nativeBiquadFilterNode.type = l;
  }
  getFrequencyResponse(l, u, h) {
    try {
      this._nativeBiquadFilterNode.getFrequencyResponse(l, u, h);
    } catch (d) {
      throw d.code === 11 ? s() : d;
    }
    if (l.length !== u.length || u.length !== h.length)
      throw s();
  }
}, zm = (e, t, n, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap(), o = async (a, c) => {
    let l = n(a);
    const u = Te(l, c);
    if (!u) {
      const h = {
        Q: l.Q.value,
        channelCount: l.channelCount,
        channelCountMode: l.channelCountMode,
        channelInterpretation: l.channelInterpretation,
        detune: l.detune.value,
        frequency: l.frequency.value,
        gain: l.gain.value,
        type: l.type
      };
      l = t(c, h);
    }
    return r.set(c, l), u ? (await e(c, a.Q, l.Q), await e(c, a.detune, l.detune), await e(c, a.frequency, l.frequency), await e(c, a.gain, l.gain)) : (await s(c, a.Q, l.Q), await s(c, a.detune, l.detune), await s(c, a.frequency, l.frequency), await s(c, a.gain, l.gain)), await i(a, c, l), l;
  };
  return {
    render(a, c) {
      const l = r.get(c);
      return l !== void 0 ? Promise.resolve(l) : o(a, c);
    }
  };
}, Gm = (e, t) => (n, s) => {
  const i = t.get(n);
  if (i !== void 0)
    return i;
  const r = e.get(n);
  if (r !== void 0)
    return r;
  try {
    const o = s();
    return o instanceof Promise ? (e.set(n, o), o.catch(() => !1).then((a) => (e.delete(n), t.set(n, a), a))) : (t.set(n, o), o);
  } catch {
    return t.set(n, !1), !1;
  }
}, Zm = {
  channelCount: 1,
  channelCountMode: "explicit",
  channelInterpretation: "speakers",
  numberOfInputs: 6
}, Ym = (e, t, n, s, i) => class extends e {
  constructor(o, a) {
    const c = s(o), l = { ...Zm, ...a }, u = n(c, l), h = i(c) ? t() : null;
    super(o, !1, u, h);
  }
}, Xm = (e, t, n) => () => {
  const s = /* @__PURE__ */ new WeakMap(), i = async (r, o) => {
    let a = t(r);
    if (!Te(a, o)) {
      const l = {
        channelCount: a.channelCount,
        channelCountMode: a.channelCountMode,
        channelInterpretation: a.channelInterpretation,
        numberOfInputs: a.numberOfInputs
      };
      a = e(o, l);
    }
    return s.set(o, a), await n(r, o, a), a;
  };
  return {
    render(r, o) {
      const a = s.get(o);
      return a !== void 0 ? Promise.resolve(a) : i(r, o);
    }
  };
}, Um = {
  channelCount: 6,
  channelCountMode: "explicit",
  channelInterpretation: "discrete",
  numberOfOutputs: 6
}, Hm = (e, t, n, s, i, r) => class extends e {
  constructor(a, c) {
    const l = s(a), u = r({ ...Um, ...c }), h = n(l, u), d = i(l) ? t() : null;
    super(a, !1, h, d);
  }
}, Km = (e, t, n) => () => {
  const s = /* @__PURE__ */ new WeakMap(), i = async (r, o) => {
    let a = t(r);
    if (!Te(a, o)) {
      const l = {
        channelCount: a.channelCount,
        channelCountMode: a.channelCountMode,
        channelInterpretation: a.channelInterpretation,
        numberOfOutputs: a.numberOfOutputs
      };
      a = e(o, l);
    }
    return s.set(o, a), await n(r, o, a), a;
  };
  return {
    render(r, o) {
      const a = s.get(o);
      return a !== void 0 ? Promise.resolve(a) : i(r, o);
    }
  };
}, Qm = (e) => (t, n, s) => e(n, t, s), Jm = (e) => (t, n, s = 0, i = 0) => {
  const r = t[s];
  if (r === void 0)
    throw e();
  return qr(n) ? r.connect(n, 0, i) : r.connect(n, 0);
}, tg = (e) => (t, n) => {
  const s = e(t, {
    buffer: null,
    channelCount: 2,
    channelCountMode: "max",
    channelInterpretation: "speakers",
    loop: !1,
    loopEnd: 0,
    loopStart: 0,
    playbackRate: 1
  }), i = t.createBuffer(1, 2, 44100);
  return s.buffer = i, s.loop = !0, s.connect(n), s.start(), () => {
    s.stop(), s.disconnect(n);
  };
}, eg = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  offset: 1
}, ng = (e, t, n, s, i, r, o) => class extends e {
  constructor(c, l) {
    const u = i(c), h = { ...eg, ...l }, d = s(u, h), p = r(u), f = p ? n() : null;
    super(c, !1, d, f), this._constantSourceNodeRenderer = f, this._nativeConstantSourceNode = d, this._offset = t(this, p, d.offset, Ee, Ve), this._onended = null;
  }
  get offset() {
    return this._offset;
  }
  get onended() {
    return this._onended;
  }
  set onended(c) {
    const l = typeof c == "function" ? o(this, c) : null;
    this._nativeConstantSourceNode.onended = l;
    const u = this._nativeConstantSourceNode.onended;
    this._onended = u !== null && u === l ? c : u;
  }
  start(c = 0) {
    if (this._nativeConstantSourceNode.start(c), this._constantSourceNodeRenderer !== null && (this._constantSourceNodeRenderer.start = c), this.context.state !== "closed") {
      Ls(this);
      const l = () => {
        this._nativeConstantSourceNode.removeEventListener("ended", l), En(this) && $i(this);
      };
      this._nativeConstantSourceNode.addEventListener("ended", l);
    }
  }
  stop(c = 0) {
    this._nativeConstantSourceNode.stop(c), this._constantSourceNodeRenderer !== null && (this._constantSourceNodeRenderer.stop = c);
  }
}, sg = (e, t, n, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap();
  let o = null, a = null;
  const c = async (l, u) => {
    let h = n(l);
    const d = Te(h, u);
    if (!d) {
      const p = {
        channelCount: h.channelCount,
        channelCountMode: h.channelCountMode,
        channelInterpretation: h.channelInterpretation,
        offset: h.offset.value
      };
      h = t(u, p), o !== null && h.start(o), a !== null && h.stop(a);
    }
    return r.set(u, h), d ? await e(u, l.offset, h.offset) : await s(u, l.offset, h.offset), await i(l, u, h), h;
  };
  return {
    set start(l) {
      o = l;
    },
    set stop(l) {
      a = l;
    },
    render(l, u) {
      const h = r.get(u);
      return h !== void 0 ? Promise.resolve(h) : c(l, u);
    }
  };
}, ig = (e) => (t) => (e[0] = t, e[0]), rg = {
  buffer: null,
  channelCount: 2,
  channelCountMode: "clamped-max",
  channelInterpretation: "speakers",
  disableNormalization: !1
}, og = (e, t, n, s, i, r) => class extends e {
  constructor(a, c) {
    const l = s(a), u = { ...rg, ...c }, h = n(l, u), p = i(l) ? t() : null;
    super(a, !1, h, p), this._isBufferNullified = !1, this._nativeConvolverNode = h, u.buffer !== null && r(this, u.buffer.duration);
  }
  get buffer() {
    return this._isBufferNullified ? null : this._nativeConvolverNode.buffer;
  }
  set buffer(a) {
    if (this._nativeConvolverNode.buffer = a, a === null && this._nativeConvolverNode.buffer !== null) {
      const c = this._nativeConvolverNode.context;
      this._nativeConvolverNode.buffer = c.createBuffer(1, 1, c.sampleRate), this._isBufferNullified = !0, r(this, 0);
    } else
      this._isBufferNullified = !1, r(this, this._nativeConvolverNode.buffer === null ? 0 : this._nativeConvolverNode.buffer.duration);
  }
  get normalize() {
    return this._nativeConvolverNode.normalize;
  }
  set normalize(a) {
    this._nativeConvolverNode.normalize = a;
  }
}, ag = (e, t, n) => () => {
  const s = /* @__PURE__ */ new WeakMap(), i = async (r, o) => {
    let a = t(r);
    if (!Te(a, o)) {
      const l = {
        buffer: a.buffer,
        channelCount: a.channelCount,
        channelCountMode: a.channelCountMode,
        channelInterpretation: a.channelInterpretation,
        disableNormalization: !a.normalize
      };
      a = e(o, l);
    }
    return s.set(o, a), Us(a) ? await n(r, o, a.inputs[0]) : await n(r, o, a), a;
  };
  return {
    render(r, o) {
      const a = s.get(o);
      return a !== void 0 ? Promise.resolve(a) : i(r, o);
    }
  };
}, cg = (e, t) => (n, s, i) => {
  if (t === null)
    throw new Error("Missing the native OfflineAudioContext constructor.");
  try {
    return new t(n, s, i);
  } catch (r) {
    throw r.name === "SyntaxError" ? e() : r;
  }
}, lg = () => new DOMException("", "DataCloneError"), su = (e) => {
  const { port1: t, port2: n } = new MessageChannel();
  return new Promise((s) => {
    const i = () => {
      n.onmessage = null, t.close(), n.close(), s();
    };
    n.onmessage = () => i();
    try {
      t.postMessage(e, [e]);
    } catch {
    } finally {
      i();
    }
  });
}, ug = (e, t, n, s, i, r, o, a, c, l, u) => (h, d) => {
  const p = o(h) ? h : r(h);
  if (i.has(d)) {
    const f = n();
    return Promise.reject(f);
  }
  try {
    i.add(d);
  } catch {
  }
  return t(c, () => c(p)) ? p.decodeAudioData(d).then((f) => (su(d).catch(() => {
  }), t(a, () => a(f)) || u(f), e.add(f), f)) : new Promise((f, _) => {
    const m = async () => {
      try {
        await su(d);
      } catch {
      }
    }, g = (b) => {
      _(b), m();
    };
    try {
      p.decodeAudioData(d, (b) => {
        typeof b.copyFromChannel != "function" && (l(b), xc(b)), e.add(b), m().then(() => f(b));
      }, (b) => {
        g(b === null ? s() : b);
      });
    } catch (b) {
      g(b);
    }
  });
}, hg = (e, t, n, s, i, r, o, a) => (c, l) => {
  const u = t.get(c);
  if (u === void 0)
    throw new Error("Missing the expected cycle count.");
  const h = r(c.context), d = a(h);
  if (u === l) {
    if (t.delete(c), !d && o(c)) {
      const p = s(c), { outputs: f } = n(c);
      for (const _ of f)
        if (zi(_)) {
          const m = s(_[0]);
          e(p, m, _[1], _[2]);
        } else {
          const m = i(_[0]);
          p.connect(m, _[1]);
        }
    }
  } else
    t.set(c, u - l);
}, dg = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  delayTime: 0,
  maxDelayTime: 1
}, fg = (e, t, n, s, i, r, o) => class extends e {
  constructor(c, l) {
    const u = i(c), h = { ...dg, ...l }, d = s(u, h), p = r(u), f = p ? n(h.maxDelayTime) : null;
    super(c, !1, d, f), this._delayTime = t(this, p, d.delayTime), o(this, h.maxDelayTime);
  }
  get delayTime() {
    return this._delayTime;
  }
}, pg = (e, t, n, s, i) => (r) => {
  const o = /* @__PURE__ */ new WeakMap(), a = async (c, l) => {
    let u = n(c);
    const h = Te(u, l);
    if (!h) {
      const d = {
        channelCount: u.channelCount,
        channelCountMode: u.channelCountMode,
        channelInterpretation: u.channelInterpretation,
        delayTime: u.delayTime.value,
        maxDelayTime: r
      };
      u = t(l, d);
    }
    return o.set(l, u), h ? await e(l, c.delayTime, u.delayTime) : await s(l, c.delayTime, u.delayTime), await i(c, l, u), u;
  };
  return {
    render(c, l) {
      const u = o.get(l);
      return u !== void 0 ? Promise.resolve(u) : a(c, l);
    }
  };
}, mg = (e) => (t, n, s, i) => e(t[i], (r) => r[0] === n && r[1] === s), gg = (e) => (t, n) => {
  e(t).delete(n);
}, _g = (e) => "delayTime" in e, yg = (e, t, n) => function s(i, r) {
  const o = Lr(r) ? r : n(e, r);
  if (_g(o))
    return [];
  if (i[0] === o)
    return [i];
  if (i.includes(o))
    return [];
  const { outputs: a } = t(o);
  return Array.from(a).map((c) => s([...i, o], c[0])).reduce((c, l) => c.concat(l), []);
}, wr = (e, t, n) => {
  const s = t[n];
  if (s === void 0)
    throw e();
  return s;
}, vg = (e) => (t, n = void 0, s = void 0, i = 0) => n === void 0 ? t.forEach((r) => r.disconnect()) : typeof n == "number" ? wr(e, t, n).disconnect() : qr(n) ? s === void 0 ? t.forEach((r) => r.disconnect(n)) : i === void 0 ? wr(e, t, s).disconnect(n, 0) : wr(e, t, s).disconnect(n, 0, i) : s === void 0 ? t.forEach((r) => r.disconnect(n)) : wr(e, t, s).disconnect(n, 0), bg = {
  attack: 3e-3,
  channelCount: 2,
  channelCountMode: "clamped-max",
  channelInterpretation: "speakers",
  knee: 30,
  ratio: 12,
  release: 0.25,
  threshold: -24
}, xg = (e, t, n, s, i, r, o, a) => class extends e {
  constructor(l, u) {
    const h = r(l), d = { ...bg, ...u }, p = s(h, d), f = o(h), _ = f ? n() : null;
    super(l, !1, p, _), this._attack = t(this, f, p.attack), this._knee = t(this, f, p.knee), this._nativeDynamicsCompressorNode = p, this._ratio = t(this, f, p.ratio), this._release = t(this, f, p.release), this._threshold = t(this, f, p.threshold), a(this, 6e-3);
  }
  get attack() {
    return this._attack;
  }
  // Bug #108: Safari allows a channelCount of three and above which is why the getter and setter needs to be overwritten here.
  get channelCount() {
    return this._nativeDynamicsCompressorNode.channelCount;
  }
  set channelCount(l) {
    const u = this._nativeDynamicsCompressorNode.channelCount;
    if (this._nativeDynamicsCompressorNode.channelCount = l, l > 2)
      throw this._nativeDynamicsCompressorNode.channelCount = u, i();
  }
  /*
   * Bug #109: Only Chrome and Firefox disallow a channelCountMode of 'max' yet which is why the getter and setter needs to be
   * overwritten here.
   */
  get channelCountMode() {
    return this._nativeDynamicsCompressorNode.channelCountMode;
  }
  set channelCountMode(l) {
    const u = this._nativeDynamicsCompressorNode.channelCountMode;
    if (this._nativeDynamicsCompressorNode.channelCountMode = l, l === "max")
      throw this._nativeDynamicsCompressorNode.channelCountMode = u, i();
  }
  get knee() {
    return this._knee;
  }
  get ratio() {
    return this._ratio;
  }
  get reduction() {
    return typeof this._nativeDynamicsCompressorNode.reduction.value == "number" ? this._nativeDynamicsCompressorNode.reduction.value : this._nativeDynamicsCompressorNode.reduction;
  }
  get release() {
    return this._release;
  }
  get threshold() {
    return this._threshold;
  }
}, wg = (e, t, n, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap(), o = async (a, c) => {
    let l = n(a);
    const u = Te(l, c);
    if (!u) {
      const h = {
        attack: l.attack.value,
        channelCount: l.channelCount,
        channelCountMode: l.channelCountMode,
        channelInterpretation: l.channelInterpretation,
        knee: l.knee.value,
        ratio: l.ratio.value,
        release: l.release.value,
        threshold: l.threshold.value
      };
      l = t(c, h);
    }
    return r.set(c, l), u ? (await e(c, a.attack, l.attack), await e(c, a.knee, l.knee), await e(c, a.ratio, l.ratio), await e(c, a.release, l.release), await e(c, a.threshold, l.threshold)) : (await s(c, a.attack, l.attack), await s(c, a.knee, l.knee), await s(c, a.ratio, l.ratio), await s(c, a.release, l.release), await s(c, a.threshold, l.threshold)), await i(a, c, l), l;
  };
  return {
    render(a, c) {
      const l = r.get(c);
      return l !== void 0 ? Promise.resolve(l) : o(a, c);
    }
  };
}, Cg = () => new DOMException("", "EncodingError"), Sg = (e) => (t) => new Promise((n, s) => {
  if (e === null) {
    s(new SyntaxError());
    return;
  }
  const i = e.document.head;
  if (i === null)
    s(new SyntaxError());
  else {
    const r = e.document.createElement("script"), o = new Blob([t], { type: "application/javascript" }), a = URL.createObjectURL(o), c = e.onerror, l = () => {
      e.onerror = c, URL.revokeObjectURL(a);
    };
    e.onerror = (u, h, d, p, f) => {
      if (h === a || h === e.location.href && d === 1 && p === 1)
        return l(), s(f), !1;
      if (c !== null)
        return c(u, h, d, p, f);
    }, r.onerror = () => {
      l(), s(new SyntaxError());
    }, r.onload = () => {
      l(), n();
    }, r.src = a, r.type = "module", i.appendChild(r);
  }
}), Tg = (e) => class {
  constructor(n) {
    this._nativeEventTarget = n, this._listeners = /* @__PURE__ */ new WeakMap();
  }
  addEventListener(n, s, i) {
    if (s !== null) {
      let r = this._listeners.get(s);
      r === void 0 && (r = e(this, s), typeof s == "function" && this._listeners.set(s, r)), this._nativeEventTarget.addEventListener(n, r, i);
    }
  }
  dispatchEvent(n) {
    return this._nativeEventTarget.dispatchEvent(n);
  }
  removeEventListener(n, s, i) {
    const r = s === null ? void 0 : this._listeners.get(s);
    this._nativeEventTarget.removeEventListener(n, r === void 0 ? null : r, i);
  }
}, Ag = (e) => (t, n, s) => {
  Object.defineProperties(e, {
    currentFrame: {
      configurable: !0,
      get() {
        return Math.round(t * n);
      }
    },
    currentTime: {
      configurable: !0,
      get() {
        return t;
      }
    }
  });
  try {
    return s();
  } finally {
    e !== null && (delete e.currentFrame, delete e.currentTime);
  }
}, kg = (e) => async (t) => {
  try {
    const n = await fetch(t);
    if (n.ok)
      return [await n.text(), n.url];
  } catch {
  }
  throw e();
}, Ig = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  gain: 1
}, Eg = (e, t, n, s, i, r) => class extends e {
  constructor(a, c) {
    const l = i(a), u = { ...Ig, ...c }, h = s(l, u), d = r(l), p = d ? n() : null;
    super(a, !1, h, p), this._gain = t(this, d, h.gain, Ee, Ve);
  }
  get gain() {
    return this._gain;
  }
}, Dg = (e, t, n, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap(), o = async (a, c) => {
    let l = n(a);
    const u = Te(l, c);
    if (!u) {
      const h = {
        channelCount: l.channelCount,
        channelCountMode: l.channelCountMode,
        channelInterpretation: l.channelInterpretation,
        gain: l.gain.value
      };
      l = t(c, h);
    }
    return r.set(c, l), u ? await e(c, a.gain, l.gain) : await s(c, a.gain, l.gain), await i(a, c, l), l;
  };
  return {
    render(a, c) {
      const l = r.get(c);
      return l !== void 0 ? Promise.resolve(l) : o(a, c);
    }
  };
}, Rg = (e, t) => (n) => t(e, n), Og = (e) => (t) => {
  const n = e(t);
  if (n.renderer === null)
    throw new Error("Missing the renderer of the given AudioNode in the audio graph.");
  return n.renderer;
}, Mg = (e) => (t) => {
  var n;
  return (n = e.get(t)) !== null && n !== void 0 ? n : 0;
}, Fg = (e) => (t) => {
  const n = e(t);
  if (n.renderer === null)
    throw new Error("Missing the renderer of the given AudioParam in the audio graph.");
  return n.renderer;
}, Pg = (e) => (t) => e.get(t), ue = () => new DOMException("", "InvalidStateError"), Ng = (e) => (t) => {
  const n = e.get(t);
  if (n === void 0)
    throw ue();
  return n;
}, Vg = (e, t) => (n) => {
  let s = e.get(n);
  if (s !== void 0)
    return s;
  if (t === null)
    throw new Error("Missing the native OfflineAudioContext constructor.");
  return s = new t(1, 1, 44100), e.set(n, s), s;
}, Wg = (e) => (t) => {
  const n = e.get(t);
  if (n === void 0)
    throw new Error("The context has no set of AudioWorkletNodes.");
  return n;
}, oo = () => new DOMException("", "InvalidAccessError"), jg = (e) => {
  e.getFrequencyResponse = /* @__PURE__ */ ((t) => (n, s, i) => {
    if (n.length !== s.length || s.length !== i.length)
      throw oo();
    return t.call(e, n, s, i);
  })(e.getFrequencyResponse);
}, Lg = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers"
}, Bg = (e, t, n, s, i, r) => class extends e {
  constructor(a, c) {
    const l = s(a), u = i(l), h = { ...Lg, ...c }, d = t(l, u ? null : a.baseLatency, h), p = u ? n(h.feedback, h.feedforward) : null;
    super(a, !1, d, p), jg(d), this._nativeIIRFilterNode = d, r(this, 1);
  }
  getFrequencyResponse(a, c, l) {
    return this._nativeIIRFilterNode.getFrequencyResponse(a, c, l);
  }
}, cd = (e, t, n, s, i, r, o, a, c, l, u) => {
  const h = l.length;
  let d = a;
  for (let p = 0; p < h; p += 1) {
    let f = n[0] * l[p];
    for (let _ = 1; _ < i; _ += 1) {
      const m = d - _ & c - 1;
      f += n[_] * r[m], f -= e[_] * o[m];
    }
    for (let _ = i; _ < s; _ += 1)
      f += n[_] * r[d - _ & c - 1];
    for (let _ = i; _ < t; _ += 1)
      f -= e[_] * o[d - _ & c - 1];
    r[d] = l[p], o[d] = f, d = d + 1 & c - 1, u[p] = f;
  }
  return d;
}, $g = (e, t, n, s) => {
  const i = n instanceof Float64Array ? n : new Float64Array(n), r = s instanceof Float64Array ? s : new Float64Array(s), o = i.length, a = r.length, c = Math.min(o, a);
  if (i[0] !== 1) {
    for (let f = 0; f < o; f += 1)
      r[f] /= i[0];
    for (let f = 1; f < a; f += 1)
      i[f] /= i[0];
  }
  const l = 32, u = new Float32Array(l), h = new Float32Array(l), d = t.createBuffer(e.numberOfChannels, e.length, e.sampleRate), p = e.numberOfChannels;
  for (let f = 0; f < p; f += 1) {
    const _ = e.getChannelData(f), m = d.getChannelData(f);
    u.fill(0), h.fill(0), cd(i, o, r, a, c, u, h, 0, l, _, m);
  }
  return d;
}, qg = (e, t, n, s, i) => (r, o) => {
  const a = /* @__PURE__ */ new WeakMap();
  let c = null;
  const l = async (u, h) => {
    let d = null, p = t(u);
    const f = Te(p, h);
    if (h.createIIRFilter === void 0 ? d = e(h, {
      buffer: null,
      channelCount: 2,
      channelCountMode: "max",
      channelInterpretation: "speakers",
      loop: !1,
      loopEnd: 0,
      loopStart: 0,
      playbackRate: 1
    }) : f || (p = h.createIIRFilter(o, r)), a.set(h, d === null ? p : d), d !== null) {
      if (c === null) {
        if (n === null)
          throw new Error("Missing the native OfflineAudioContext constructor.");
        const m = new n(
          // Bug #47: The AudioDestinationNode in Safari gets not initialized correctly.
          u.context.destination.channelCount,
          // Bug #17: Safari does not yet expose the length.
          u.context.length,
          h.sampleRate
        );
        c = (async () => {
          await s(u, m, m.destination);
          const g = await i(m);
          return $g(g, h, r, o);
        })();
      }
      const _ = await c;
      return d.buffer = _, d.start(0), d;
    }
    return await s(u, h, p), p;
  };
  return {
    render(u, h) {
      const d = a.get(h);
      return d !== void 0 ? Promise.resolve(d) : l(u, h);
    }
  };
}, zg = (e, t, n, s, i, r) => (o) => (a, c) => {
  const l = e.get(a);
  if (l === void 0) {
    if (!o && r(a)) {
      const u = s(a), { outputs: h } = n(a);
      for (const d of h)
        if (zi(d)) {
          const p = s(d[0]);
          t(u, p, d[1], d[2]);
        } else {
          const p = i(d[0]);
          u.disconnect(p, d[1]);
        }
    }
    e.set(a, c);
  } else
    e.set(a, l + c);
}, Gg = (e, t) => (n) => {
  const s = e.get(n);
  return t(s) || t(n);
}, Zg = (e, t) => (n) => e.has(n) || t(n), Yg = (e, t) => (n) => e.has(n) || t(n), Xg = (e, t) => (n) => {
  const s = e.get(n);
  return t(s) || t(n);
}, Ug = (e) => (t) => e !== null && t instanceof e, Hg = (e) => (t) => e !== null && typeof e.AudioNode == "function" && t instanceof e.AudioNode, Kg = (e) => (t) => e !== null && typeof e.AudioParam == "function" && t instanceof e.AudioParam, Qg = (e, t) => (n) => e(n) || t(n), Jg = (e) => (t) => e !== null && t instanceof e, t_ = (e) => e !== null && e.isSecureContext, e_ = async (e, t, n, s, i, r, o, a, c, l, u, h, d, p, f, _) => e(t, t) && e(n, n) && e(i, i) && e(r, r) && e(a, a) && e(c, c) && e(l, l) && e(u, u) && e(h, h) && e(d, d) && e(p, p) ? (await Promise.all([
  e(s, s),
  e(o, o),
  e(f, f),
  e(_, _)
])).every((g) => g) : !1, n_ = (e, t, n, s) => class extends e {
  constructor(r, o) {
    const a = n(r), c = t(a, o);
    if (s(a))
      throw TypeError();
    super(r, !0, c, null), this._nativeMediaElementAudioSourceNode = c;
  }
  get mediaElement() {
    return this._nativeMediaElementAudioSourceNode.mediaElement;
  }
}, s_ = {
  channelCount: 2,
  channelCountMode: "explicit",
  channelInterpretation: "speakers"
}, i_ = (e, t, n, s) => class extends e {
  constructor(r, o) {
    const a = n(r);
    if (s(a))
      throw new TypeError();
    const c = { ...s_, ...o }, l = t(a, c);
    super(r, !1, l, null), this._nativeMediaStreamAudioDestinationNode = l;
  }
  get stream() {
    return this._nativeMediaStreamAudioDestinationNode.stream;
  }
}, r_ = (e, t, n, s) => class extends e {
  constructor(r, o) {
    const a = n(r), c = t(a, o);
    if (s(a))
      throw new TypeError();
    super(r, !0, c, null), this._nativeMediaStreamAudioSourceNode = c;
  }
  get mediaStream() {
    return this._nativeMediaStreamAudioSourceNode.mediaStream;
  }
}, o_ = (e, t, n) => class extends e {
  constructor(i, r) {
    const o = n(i), a = t(o, r);
    super(i, !0, a, null);
  }
}, a_ = (e, t, n, s, i, r) => class extends n {
  constructor(a, c) {
    super(a), this._nativeContext = a, io.set(this, a), s(a) && i.set(a, /* @__PURE__ */ new Set()), this._destination = new e(this, c), this._listener = t(this, a), this._onstatechange = null;
  }
  get currentTime() {
    return this._nativeContext.currentTime;
  }
  get destination() {
    return this._destination;
  }
  get listener() {
    return this._listener;
  }
  get onstatechange() {
    return this._onstatechange;
  }
  set onstatechange(a) {
    const c = typeof a == "function" ? r(this, a) : null;
    this._nativeContext.onstatechange = c;
    const l = this._nativeContext.onstatechange;
    this._onstatechange = l !== null && l === c ? a : l;
  }
  get sampleRate() {
    return this._nativeContext.sampleRate;
  }
  get state() {
    return this._nativeContext.state;
  }
}, Oi = (e) => {
  const t = new Uint32Array([1179011410, 40, 1163280727, 544501094, 16, 131073, 44100, 176400, 1048580, 1635017060, 4, 0]);
  try {
    const n = e.decodeAudioData(t.buffer, () => {
    });
    return n === void 0 ? !1 : (n.catch(() => {
    }), !0);
  } catch {
  }
  return !1;
}, c_ = (e, t) => (n, s, i) => {
  const r = /* @__PURE__ */ new Set();
  return n.connect = /* @__PURE__ */ ((o) => (a, c = 0, l = 0) => {
    const u = r.size === 0;
    if (t(a))
      return o.call(n, a, c, l), e(r, [a, c, l], (h) => h[0] === a && h[1] === c && h[2] === l, !0), u && s(), a;
    o.call(n, a, c), e(r, [a, c], (h) => h[0] === a && h[1] === c, !0), u && s();
  })(n.connect), n.disconnect = /* @__PURE__ */ ((o) => (a, c, l) => {
    const u = r.size > 0;
    if (a === void 0)
      o.apply(n), r.clear();
    else if (typeof a == "number") {
      o.call(n, a);
      for (const d of r)
        d[1] === a && r.delete(d);
    } else {
      t(a) ? o.call(n, a, c, l) : o.call(n, a, c);
      for (const d of r)
        d[0] === a && (c === void 0 || d[1] === c) && (l === void 0 || d[2] === l) && r.delete(d);
    }
    const h = r.size === 0;
    u && h && i();
  })(n.disconnect), n;
}, Zt = (e, t, n) => {
  const s = t[n];
  s !== void 0 && s !== e[n] && (e[n] = s);
}, ae = (e, t) => {
  Zt(e, t, "channelCount"), Zt(e, t, "channelCountMode"), Zt(e, t, "channelInterpretation");
}, iu = (e) => typeof e.getFloatTimeDomainData == "function", l_ = (e) => {
  e.getFloatTimeDomainData = (t) => {
    const n = new Uint8Array(t.length);
    e.getByteTimeDomainData(n);
    const s = Math.max(n.length, e.fftSize);
    for (let i = 0; i < s; i += 1)
      t[i] = (n[i] - 128) * 78125e-7;
    return t;
  };
}, u_ = (e, t) => (n, s) => {
  const i = n.createAnalyser();
  if (ae(i, s), !(s.maxDecibels > s.minDecibels))
    throw t();
  return Zt(i, s, "fftSize"), Zt(i, s, "maxDecibels"), Zt(i, s, "minDecibels"), Zt(i, s, "smoothingTimeConstant"), e(iu, () => iu(i)) || l_(i), i;
}, h_ = (e) => e === null ? null : e.hasOwnProperty("AudioBuffer") ? e.AudioBuffer : null, Kt = (e, t, n) => {
  const s = t[n];
  s !== void 0 && s !== e[n].value && (e[n].value = s);
}, d_ = (e) => {
  e.start = /* @__PURE__ */ ((t) => {
    let n = !1;
    return (s = 0, i = 0, r) => {
      if (n)
        throw ue();
      t.call(e, s, i, r), n = !0;
    };
  })(e.start);
}, Sc = (e) => {
  e.start = /* @__PURE__ */ ((t) => (n = 0, s = 0, i) => {
    if (typeof i == "number" && i < 0 || s < 0 || n < 0)
      throw new RangeError("The parameters can't be negative.");
    t.call(e, n, s, i);
  })(e.start);
}, Tc = (e) => {
  e.stop = /* @__PURE__ */ ((t) => (n = 0) => {
    if (n < 0)
      throw new RangeError("The parameter can't be negative.");
    t.call(e, n);
  })(e.stop);
}, f_ = (e, t, n, s, i, r, o, a, c, l, u) => (h, d) => {
  const p = h.createBufferSource();
  return ae(p, d), Kt(p, d, "playbackRate"), Zt(p, d, "buffer"), Zt(p, d, "loop"), Zt(p, d, "loopEnd"), Zt(p, d, "loopStart"), t(n, () => n(h)) || d_(p), t(s, () => s(h)) || c(p), t(i, () => i(h)) || l(p, h), t(r, () => r(h)) || Sc(p), t(o, () => o(h)) || u(p, h), t(a, () => a(h)) || Tc(p), e(h, p), p;
}, p_ = (e) => e === null ? null : e.hasOwnProperty("AudioContext") ? e.AudioContext : e.hasOwnProperty("webkitAudioContext") ? e.webkitAudioContext : null, m_ = (e, t) => (n, s, i) => {
  const r = n.destination;
  if (r.channelCount !== s)
    try {
      r.channelCount = s;
    } catch {
    }
  i && r.channelCountMode !== "explicit" && (r.channelCountMode = "explicit"), r.maxChannelCount === 0 && Object.defineProperty(r, "maxChannelCount", {
    value: s
  });
  const o = e(n, {
    channelCount: s,
    channelCountMode: r.channelCountMode,
    channelInterpretation: r.channelInterpretation,
    gain: 1
  });
  return t(o, "channelCount", (a) => () => a.call(o), (a) => (c) => {
    a.call(o, c);
    try {
      r.channelCount = c;
    } catch (l) {
      if (c > r.maxChannelCount)
        throw l;
    }
  }), t(o, "channelCountMode", (a) => () => a.call(o), (a) => (c) => {
    a.call(o, c), r.channelCountMode = c;
  }), t(o, "channelInterpretation", (a) => () => a.call(o), (a) => (c) => {
    a.call(o, c), r.channelInterpretation = c;
  }), Object.defineProperty(o, "maxChannelCount", {
    get: () => r.maxChannelCount
  }), o.connect(r), o;
}, g_ = (e) => e === null ? null : e.hasOwnProperty("AudioWorkletNode") ? e.AudioWorkletNode : null, __ = (e) => {
  const { port1: t } = new MessageChannel();
  try {
    t.postMessage(e);
  } finally {
    t.close();
  }
}, y_ = (e, t, n, s, i) => (r, o, a, c, l, u) => {
  if (a !== null)
    try {
      const h = new a(r, c, u), d = /* @__PURE__ */ new Map();
      let p = null;
      if (Object.defineProperties(h, {
        /*
         * Bug #61: Overwriting the property accessors for channelCount and channelCountMode is necessary as long as some
         * browsers have no native implementation to achieve a consistent behavior.
         */
        channelCount: {
          get: () => u.channelCount,
          set: () => {
            throw e();
          }
        },
        channelCountMode: {
          get: () => "explicit",
          set: () => {
            throw e();
          }
        },
        // Bug #156: Chrome and Edge do not yet fire an ErrorEvent.
        onprocessorerror: {
          get: () => p,
          set: (f) => {
            typeof p == "function" && h.removeEventListener("processorerror", p), p = typeof f == "function" ? f : null, typeof p == "function" && h.addEventListener("processorerror", p);
          }
        }
      }), h.addEventListener = /* @__PURE__ */ ((f) => (..._) => {
        if (_[0] === "processorerror") {
          const m = typeof _[1] == "function" ? _[1] : typeof _[1] == "object" && _[1] !== null && typeof _[1].handleEvent == "function" ? _[1].handleEvent : null;
          if (m !== null) {
            const g = d.get(_[1]);
            g !== void 0 ? _[1] = g : (_[1] = (b) => {
              b.type === "error" ? (Object.defineProperties(b, {
                type: { value: "processorerror" }
              }), m(b)) : m(new ErrorEvent(_[0], { ...b }));
            }, d.set(m, _[1]));
          }
        }
        return f.call(h, "error", _[1], _[2]), f.call(h, ..._);
      })(h.addEventListener), h.removeEventListener = /* @__PURE__ */ ((f) => (..._) => {
        if (_[0] === "processorerror") {
          const m = d.get(_[1]);
          m !== void 0 && (d.delete(_[1]), _[1] = m);
        }
        return f.call(h, "error", _[1], _[2]), f.call(h, _[0], _[1], _[2]);
      })(h.removeEventListener), u.numberOfOutputs !== 0) {
        const f = n(r, {
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "discrete",
          gain: 0
        });
        return h.connect(f).connect(r.destination), i(h, () => f.disconnect(), () => f.connect(r.destination));
      }
      return h;
    } catch (h) {
      throw h.code === 11 ? s() : h;
    }
  if (l === void 0)
    throw s();
  return __(u), t(r, o, l, u);
}, ld = (e, t) => e === null ? 512 : Math.max(512, Math.min(16384, Math.pow(2, Math.round(Math.log2(e * t))))), v_ = (e) => new Promise((t, n) => {
  const { port1: s, port2: i } = new MessageChannel();
  s.onmessage = ({ data: r }) => {
    s.close(), i.close(), t(r);
  }, s.onmessageerror = ({ data: r }) => {
    s.close(), i.close(), n(r);
  }, i.postMessage(e);
}), b_ = async (e, t) => {
  const n = await v_(t);
  return new e(n);
}, x_ = (e, t, n, s) => {
  let i = Ma.get(e);
  i === void 0 && (i = /* @__PURE__ */ new WeakMap(), Ma.set(e, i));
  const r = b_(n, s);
  return i.set(t, r), r;
}, w_ = (e, t, n, s, i, r, o, a, c, l, u, h, d) => (p, f, _, m) => {
  if (m.numberOfInputs === 0 && m.numberOfOutputs === 0)
    throw c();
  const g = Array.isArray(m.outputChannelCount) ? m.outputChannelCount : Array.from(m.outputChannelCount);
  if (g.some((Y) => Y < 1))
    throw c();
  if (g.length !== m.numberOfOutputs)
    throw t();
  if (m.channelCountMode !== "explicit")
    throw c();
  const b = m.channelCount * m.numberOfInputs, v = g.reduce((Y, ot) => Y + ot, 0), x = _.parameterDescriptors === void 0 ? 0 : _.parameterDescriptors.length;
  if (b + x > 6 || v > 6)
    throw c();
  const y = new MessageChannel(), w = [], S = [];
  for (let Y = 0; Y < m.numberOfInputs; Y += 1)
    w.push(o(p, {
      channelCount: m.channelCount,
      channelCountMode: m.channelCountMode,
      channelInterpretation: m.channelInterpretation,
      gain: 1
    })), S.push(i(p, {
      channelCount: m.channelCount,
      channelCountMode: "explicit",
      channelInterpretation: "discrete",
      numberOfOutputs: m.channelCount
    }));
  const C = [];
  if (_.parameterDescriptors !== void 0)
    for (const { defaultValue: Y, maxValue: ot, minValue: Vt, name: Et } of _.parameterDescriptors) {
      const wt = r(p, {
        channelCount: 1,
        channelCountMode: "explicit",
        channelInterpretation: "discrete",
        offset: m.parameterData[Et] !== void 0 ? m.parameterData[Et] : Y === void 0 ? 0 : Y
      });
      Object.defineProperties(wt.offset, {
        defaultValue: {
          get: () => Y === void 0 ? 0 : Y
        },
        maxValue: {
          get: () => ot === void 0 ? Ee : ot
        },
        minValue: {
          get: () => Vt === void 0 ? Ve : Vt
        }
      }), C.push(wt);
    }
  const D = s(p, {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "speakers",
    numberOfInputs: Math.max(1, b + x)
  }), R = ld(f, p.sampleRate), A = a(
    p,
    R,
    b + x,
    // Bug #87: Only Firefox will fire an AudioProcessingEvent if there is no connected output.
    Math.max(1, v)
  ), I = i(p, {
    channelCount: Math.max(1, v),
    channelCountMode: "explicit",
    channelInterpretation: "discrete",
    numberOfOutputs: Math.max(1, v)
  }), F = [];
  for (let Y = 0; Y < m.numberOfOutputs; Y += 1)
    F.push(s(p, {
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      numberOfInputs: g[Y]
    }));
  for (let Y = 0; Y < m.numberOfInputs; Y += 1) {
    w[Y].connect(S[Y]);
    for (let ot = 0; ot < m.channelCount; ot += 1)
      S[Y].connect(D, ot, Y * m.channelCount + ot);
  }
  const N = new od(_.parameterDescriptors === void 0 ? [] : _.parameterDescriptors.map(({ name: Y }, ot) => {
    const Vt = C[ot];
    return Vt.connect(D, 0, b + ot), Vt.start(0), [Y, Vt.offset];
  }));
  D.connect(A);
  let V = m.channelInterpretation, W = null;
  const L = m.numberOfOutputs === 0 ? [A] : F, J = {
    get bufferSize() {
      return R;
    },
    get channelCount() {
      return m.channelCount;
    },
    set channelCount(Y) {
      throw n();
    },
    get channelCountMode() {
      return m.channelCountMode;
    },
    set channelCountMode(Y) {
      throw n();
    },
    get channelInterpretation() {
      return V;
    },
    set channelInterpretation(Y) {
      for (const ot of w)
        ot.channelInterpretation = Y;
      V = Y;
    },
    get context() {
      return A.context;
    },
    get inputs() {
      return w;
    },
    get numberOfInputs() {
      return m.numberOfInputs;
    },
    get numberOfOutputs() {
      return m.numberOfOutputs;
    },
    get onprocessorerror() {
      return W;
    },
    set onprocessorerror(Y) {
      typeof W == "function" && J.removeEventListener("processorerror", W), W = typeof Y == "function" ? Y : null, typeof W == "function" && J.addEventListener("processorerror", W);
    },
    get parameters() {
      return N;
    },
    get port() {
      return y.port2;
    },
    addEventListener(...Y) {
      return A.addEventListener(Y[0], Y[1], Y[2]);
    },
    connect: e.bind(null, L),
    disconnect: l.bind(null, L),
    dispatchEvent(...Y) {
      return A.dispatchEvent(Y[0]);
    },
    removeEventListener(...Y) {
      return A.removeEventListener(Y[0], Y[1], Y[2]);
    }
  }, z = /* @__PURE__ */ new Map();
  y.port1.addEventListener = /* @__PURE__ */ ((Y) => (...ot) => {
    if (ot[0] === "message") {
      const Vt = typeof ot[1] == "function" ? ot[1] : typeof ot[1] == "object" && ot[1] !== null && typeof ot[1].handleEvent == "function" ? ot[1].handleEvent : null;
      if (Vt !== null) {
        const Et = z.get(ot[1]);
        Et !== void 0 ? ot[1] = Et : (ot[1] = (wt) => {
          u(p.currentTime, p.sampleRate, () => Vt(wt));
        }, z.set(Vt, ot[1]));
      }
    }
    return Y.call(y.port1, ot[0], ot[1], ot[2]);
  })(y.port1.addEventListener), y.port1.removeEventListener = /* @__PURE__ */ ((Y) => (...ot) => {
    if (ot[0] === "message") {
      const Vt = z.get(ot[1]);
      Vt !== void 0 && (z.delete(ot[1]), ot[1] = Vt);
    }
    return Y.call(y.port1, ot[0], ot[1], ot[2]);
  })(y.port1.removeEventListener);
  let E = null;
  Object.defineProperty(y.port1, "onmessage", {
    get: () => E,
    set: (Y) => {
      typeof E == "function" && y.port1.removeEventListener("message", E), E = typeof Y == "function" ? Y : null, typeof E == "function" && (y.port1.addEventListener("message", E), y.port1.start());
    }
  }), _.prototype.port = y.port1;
  let O = null;
  x_(p, J, _, m).then((Y) => O = Y);
  const H = Gr(m.numberOfInputs, m.channelCount), G = Gr(m.numberOfOutputs, g), X = _.parameterDescriptors === void 0 ? [] : _.parameterDescriptors.reduce((Y, { name: ot }) => ({ ...Y, [ot]: new Float32Array(128) }), {});
  let Q = !0;
  const it = () => {
    m.numberOfOutputs > 0 && A.disconnect(I);
    for (let Y = 0, ot = 0; Y < m.numberOfOutputs; Y += 1) {
      const Vt = F[Y];
      for (let Et = 0; Et < g[Y]; Et += 1)
        I.disconnect(Vt, ot + Et, Et);
      ot += g[Y];
    }
  }, M = /* @__PURE__ */ new Map();
  A.onaudioprocess = ({ inputBuffer: Y, outputBuffer: ot }) => {
    if (O !== null) {
      const Vt = h(J);
      for (let Et = 0; Et < R; Et += 128) {
        for (let wt = 0; wt < m.numberOfInputs; wt += 1)
          for (let et = 0; et < m.channelCount; et += 1)
            zr(Y, H[wt], et, et, Et);
        _.parameterDescriptors !== void 0 && _.parameterDescriptors.forEach(({ name: wt }, et) => {
          zr(Y, X, wt, b + et, Et);
        });
        for (let wt = 0; wt < m.numberOfInputs; wt += 1)
          for (let et = 0; et < g[wt]; et += 1)
            G[wt][et].byteLength === 0 && (G[wt][et] = new Float32Array(128));
        try {
          const wt = H.map((mt, At) => {
            if (Vt[At].size > 0)
              return M.set(At, R / 128), mt;
            const Gt = M.get(At);
            return Gt === void 0 ? [] : (mt.every((be) => be.every((Wt) => Wt === 0)) && (Gt === 1 ? M.delete(At) : M.set(At, Gt - 1)), mt);
          });
          Q = u(p.currentTime + Et / p.sampleRate, p.sampleRate, () => O.process(wt, G, X));
          for (let mt = 0, At = 0; mt < m.numberOfOutputs; mt += 1) {
            for (let Lt = 0; Lt < g[mt]; Lt += 1)
              ad(ot, G[mt], Lt, At + Lt, Et);
            At += g[mt];
          }
        } catch (wt) {
          Q = !1, J.dispatchEvent(new ErrorEvent("processorerror", {
            colno: wt.colno,
            filename: wt.filename,
            lineno: wt.lineno,
            message: wt.message
          }));
        }
        if (!Q) {
          for (let wt = 0; wt < m.numberOfInputs; wt += 1) {
            w[wt].disconnect(S[wt]);
            for (let et = 0; et < m.channelCount; et += 1)
              S[Et].disconnect(D, et, wt * m.channelCount + et);
          }
          if (_.parameterDescriptors !== void 0) {
            const wt = _.parameterDescriptors.length;
            for (let et = 0; et < wt; et += 1) {
              const mt = C[et];
              mt.disconnect(D, 0, b + et), mt.stop();
            }
          }
          D.disconnect(A), A.onaudioprocess = null, ht ? it() : U();
          break;
        }
      }
    }
  };
  let ht = !1;
  const tt = o(p, {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "discrete",
    gain: 0
  }), Tt = () => A.connect(tt).connect(p.destination), U = () => {
    A.disconnect(tt), tt.disconnect();
  }, Jt = () => {
    if (Q) {
      U(), m.numberOfOutputs > 0 && A.connect(I);
      for (let Y = 0, ot = 0; Y < m.numberOfOutputs; Y += 1) {
        const Vt = F[Y];
        for (let Et = 0; Et < g[Y]; Et += 1)
          I.connect(Vt, ot + Et, Et);
        ot += g[Y];
      }
    }
    ht = !0;
  }, fe = () => {
    Q && (Tt(), it()), ht = !1;
  };
  return Tt(), d(J, Jt, fe);
}, ud = (e, t) => {
  const n = e.createBiquadFilter();
  return ae(n, t), Kt(n, t, "Q"), Kt(n, t, "detune"), Kt(n, t, "frequency"), Kt(n, t, "gain"), Zt(n, t, "type"), n;
}, C_ = (e, t) => (n, s) => {
  const i = n.createChannelMerger(s.numberOfInputs);
  return e !== null && e.name === "webkitAudioContext" && t(n, i), ae(i, s), i;
}, S_ = (e) => {
  const t = e.numberOfOutputs;
  Object.defineProperty(e, "channelCount", {
    get: () => t,
    set: (n) => {
      if (n !== t)
        throw ue();
    }
  }), Object.defineProperty(e, "channelCountMode", {
    get: () => "explicit",
    set: (n) => {
      if (n !== "explicit")
        throw ue();
    }
  }), Object.defineProperty(e, "channelInterpretation", {
    get: () => "discrete",
    set: (n) => {
      if (n !== "discrete")
        throw ue();
    }
  });
}, Gi = (e, t) => {
  const n = e.createChannelSplitter(t.numberOfOutputs);
  return ae(n, t), S_(n), n;
}, T_ = (e, t, n, s, i) => (r, o) => {
  if (r.createConstantSource === void 0)
    return n(r, o);
  const a = r.createConstantSource();
  return ae(a, o), Kt(a, o, "offset"), t(s, () => s(r)) || Sc(a), t(i, () => i(r)) || Tc(a), e(r, a), a;
}, Hs = (e, t) => (e.connect = t.connect.bind(t), e.disconnect = t.disconnect.bind(t), e), A_ = (e, t, n, s) => (i, { offset: r, ...o }) => {
  const a = i.createBuffer(1, 2, 44100), c = t(i, {
    buffer: null,
    channelCount: 2,
    channelCountMode: "max",
    channelInterpretation: "speakers",
    loop: !1,
    loopEnd: 0,
    loopStart: 0,
    playbackRate: 1
  }), l = n(i, { ...o, gain: r }), u = a.getChannelData(0);
  u[0] = 1, u[1] = 1, c.buffer = a, c.loop = !0;
  const h = {
    get bufferSize() {
    },
    get channelCount() {
      return l.channelCount;
    },
    set channelCount(f) {
      l.channelCount = f;
    },
    get channelCountMode() {
      return l.channelCountMode;
    },
    set channelCountMode(f) {
      l.channelCountMode = f;
    },
    get channelInterpretation() {
      return l.channelInterpretation;
    },
    set channelInterpretation(f) {
      l.channelInterpretation = f;
    },
    get context() {
      return l.context;
    },
    get inputs() {
      return [];
    },
    get numberOfInputs() {
      return c.numberOfInputs;
    },
    get numberOfOutputs() {
      return l.numberOfOutputs;
    },
    get offset() {
      return l.gain;
    },
    get onended() {
      return c.onended;
    },
    set onended(f) {
      c.onended = f;
    },
    addEventListener(...f) {
      return c.addEventListener(f[0], f[1], f[2]);
    },
    dispatchEvent(...f) {
      return c.dispatchEvent(f[0]);
    },
    removeEventListener(...f) {
      return c.removeEventListener(f[0], f[1], f[2]);
    },
    start(f = 0) {
      c.start.call(c, f);
    },
    stop(f = 0) {
      c.stop.call(c, f);
    }
  }, d = () => c.connect(l), p = () => c.disconnect(l);
  return e(i, c), s(Hs(h, l), d, p);
}, k_ = (e, t) => (n, s) => {
  const i = n.createConvolver();
  if (ae(i, s), s.disableNormalization === i.normalize && (i.normalize = !s.disableNormalization), Zt(i, s, "buffer"), s.channelCount > 2 || (t(i, "channelCount", (r) => () => r.call(i), (r) => (o) => {
    if (o > 2)
      throw e();
    return r.call(i, o);
  }), s.channelCountMode === "max"))
    throw e();
  return t(i, "channelCountMode", (r) => () => r.call(i), (r) => (o) => {
    if (o === "max")
      throw e();
    return r.call(i, o);
  }), i;
}, hd = (e, t) => {
  const n = e.createDelay(t.maxDelayTime);
  return ae(n, t), Kt(n, t, "delayTime"), n;
}, I_ = (e) => (t, n) => {
  const s = t.createDynamicsCompressor();
  if (ae(s, n), n.channelCount > 2 || n.channelCountMode === "max")
    throw e();
  return Kt(s, n, "attack"), Kt(s, n, "knee"), Kt(s, n, "ratio"), Kt(s, n, "release"), Kt(s, n, "threshold"), s;
}, je = (e, t) => {
  const n = e.createGain();
  return ae(n, t), Kt(n, t, "gain"), n;
}, E_ = (e) => (t, n, s) => {
  if (t.createIIRFilter === void 0)
    return e(t, n, s);
  const i = t.createIIRFilter(s.feedforward, s.feedback);
  return ae(i, s), i;
};
function D_(e, t) {
  const n = t[0] * t[0] + t[1] * t[1];
  return [(e[0] * t[0] + e[1] * t[1]) / n, (e[1] * t[0] - e[0] * t[1]) / n];
}
function R_(e, t) {
  return [e[0] * t[0] - e[1] * t[1], e[0] * t[1] + e[1] * t[0]];
}
function ru(e, t) {
  let n = [0, 0];
  for (let s = e.length - 1; s >= 0; s -= 1)
    n = R_(n, t), n[0] += e[s];
  return n;
}
const O_ = (e, t, n, s) => (i, r, { channelCount: o, channelCountMode: a, channelInterpretation: c, feedback: l, feedforward: u }) => {
  const h = ld(r, i.sampleRate), d = l instanceof Float64Array ? l : new Float64Array(l), p = u instanceof Float64Array ? u : new Float64Array(u), f = d.length, _ = p.length, m = Math.min(f, _);
  if (f === 0 || f > 20)
    throw s();
  if (d[0] === 0)
    throw t();
  if (_ === 0 || _ > 20)
    throw s();
  if (p[0] === 0)
    throw t();
  if (d[0] !== 1) {
    for (let C = 0; C < _; C += 1)
      p[C] /= d[0];
    for (let C = 1; C < f; C += 1)
      d[C] /= d[0];
  }
  const g = n(i, h, o, o);
  g.channelCount = o, g.channelCountMode = a, g.channelInterpretation = c;
  const b = 32, v = [], x = [], y = [];
  for (let C = 0; C < o; C += 1) {
    v.push(0);
    const D = new Float32Array(b), R = new Float32Array(b);
    D.fill(0), R.fill(0), x.push(D), y.push(R);
  }
  g.onaudioprocess = (C) => {
    const D = C.inputBuffer, R = C.outputBuffer, A = D.numberOfChannels;
    for (let I = 0; I < A; I += 1) {
      const F = D.getChannelData(I), N = R.getChannelData(I);
      v[I] = cd(d, f, p, _, m, x[I], y[I], v[I], b, F, N);
    }
  };
  const w = i.sampleRate / 2;
  return Hs({
    get bufferSize() {
      return h;
    },
    get channelCount() {
      return g.channelCount;
    },
    set channelCount(C) {
      g.channelCount = C;
    },
    get channelCountMode() {
      return g.channelCountMode;
    },
    set channelCountMode(C) {
      g.channelCountMode = C;
    },
    get channelInterpretation() {
      return g.channelInterpretation;
    },
    set channelInterpretation(C) {
      g.channelInterpretation = C;
    },
    get context() {
      return g.context;
    },
    get inputs() {
      return [g];
    },
    get numberOfInputs() {
      return g.numberOfInputs;
    },
    get numberOfOutputs() {
      return g.numberOfOutputs;
    },
    addEventListener(...C) {
      return g.addEventListener(C[0], C[1], C[2]);
    },
    dispatchEvent(...C) {
      return g.dispatchEvent(C[0]);
    },
    getFrequencyResponse(C, D, R) {
      if (C.length !== D.length || D.length !== R.length)
        throw e();
      const A = C.length;
      for (let I = 0; I < A; I += 1) {
        const F = -Math.PI * (C[I] / w), N = [Math.cos(F), Math.sin(F)], V = ru(p, N), W = ru(d, N), L = D_(V, W);
        D[I] = Math.sqrt(L[0] * L[0] + L[1] * L[1]), R[I] = Math.atan2(L[1], L[0]);
      }
    },
    removeEventListener(...C) {
      return g.removeEventListener(C[0], C[1], C[2]);
    }
  }, g);
}, M_ = (e, t) => e.createMediaElementSource(t.mediaElement), F_ = (e, t) => {
  const n = e.createMediaStreamDestination();
  return ae(n, t), n.numberOfOutputs === 1 && Object.defineProperty(n, "numberOfOutputs", { get: () => 0 }), n;
}, P_ = (e, { mediaStream: t }) => {
  const n = t.getAudioTracks();
  n.sort((r, o) => r.id < o.id ? -1 : r.id > o.id ? 1 : 0);
  const s = n.slice(0, 1), i = e.createMediaStreamSource(new MediaStream(s));
  return Object.defineProperty(i, "mediaStream", { value: t }), i;
}, N_ = (e, t) => (n, { mediaStreamTrack: s }) => {
  if (typeof n.createMediaStreamTrackSource == "function")
    return n.createMediaStreamTrackSource(s);
  const i = new MediaStream([s]), r = n.createMediaStreamSource(i);
  if (s.kind !== "audio")
    throw e();
  if (t(n))
    throw new TypeError();
  return r;
}, V_ = (e) => e === null ? null : e.hasOwnProperty("OfflineAudioContext") ? e.OfflineAudioContext : e.hasOwnProperty("webkitOfflineAudioContext") ? e.webkitOfflineAudioContext : null, W_ = (e, t, n, s, i, r) => (o, a) => {
  const c = o.createOscillator();
  return ae(c, a), Kt(c, a, "detune"), Kt(c, a, "frequency"), a.periodicWave !== void 0 ? c.setPeriodicWave(a.periodicWave) : Zt(c, a, "type"), t(n, () => n(o)) || Sc(c), t(s, () => s(o)) || r(c, o), t(i, () => i(o)) || Tc(c), e(o, c), c;
}, j_ = (e) => (t, n) => {
  const s = t.createPanner();
  return s.orientationX === void 0 ? e(t, n) : (ae(s, n), Kt(s, n, "orientationX"), Kt(s, n, "orientationY"), Kt(s, n, "orientationZ"), Kt(s, n, "positionX"), Kt(s, n, "positionY"), Kt(s, n, "positionZ"), Zt(s, n, "coneInnerAngle"), Zt(s, n, "coneOuterAngle"), Zt(s, n, "coneOuterGain"), Zt(s, n, "distanceModel"), Zt(s, n, "maxDistance"), Zt(s, n, "panningModel"), Zt(s, n, "refDistance"), Zt(s, n, "rolloffFactor"), s);
}, L_ = (e, t, n, s, i, r, o, a, c, l) => (u, { coneInnerAngle: h, coneOuterAngle: d, coneOuterGain: p, distanceModel: f, maxDistance: _, orientationX: m, orientationY: g, orientationZ: b, panningModel: v, positionX: x, positionY: y, positionZ: w, refDistance: S, rolloffFactor: C, ...D }) => {
  const R = u.createPanner();
  if (D.channelCount > 2 || D.channelCountMode === "max")
    throw o();
  ae(R, D);
  const A = {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "discrete"
  }, I = n(u, {
    ...A,
    channelInterpretation: "speakers",
    numberOfInputs: 6
  }), F = s(u, { ...D, gain: 1 }), N = s(u, { ...A, gain: 1 }), V = s(u, { ...A, gain: 0 }), W = s(u, { ...A, gain: 0 }), L = s(u, { ...A, gain: 0 }), J = s(u, { ...A, gain: 0 }), z = s(u, { ...A, gain: 0 }), E = i(u, 256, 6, 1), O = r(u, {
    ...A,
    curve: new Float32Array([1, 1]),
    oversample: "none"
  });
  let Z = [m, g, b], H = [x, y, w];
  const G = new Float32Array(1);
  E.onaudioprocess = ({ inputBuffer: M }) => {
    const ht = [
      c(M, G, 0),
      c(M, G, 1),
      c(M, G, 2)
    ];
    ht.some((Tt, U) => Tt !== Z[U]) && (R.setOrientation(...ht), Z = ht);
    const tt = [
      c(M, G, 3),
      c(M, G, 4),
      c(M, G, 5)
    ];
    tt.some((Tt, U) => Tt !== H[U]) && (R.setPosition(...tt), H = tt);
  }, Object.defineProperty(V.gain, "defaultValue", { get: () => 0 }), Object.defineProperty(W.gain, "defaultValue", { get: () => 0 }), Object.defineProperty(L.gain, "defaultValue", { get: () => 0 }), Object.defineProperty(J.gain, "defaultValue", { get: () => 0 }), Object.defineProperty(z.gain, "defaultValue", { get: () => 0 });
  const X = {
    get bufferSize() {
    },
    get channelCount() {
      return R.channelCount;
    },
    set channelCount(M) {
      if (M > 2)
        throw o();
      F.channelCount = M, R.channelCount = M;
    },
    get channelCountMode() {
      return R.channelCountMode;
    },
    set channelCountMode(M) {
      if (M === "max")
        throw o();
      F.channelCountMode = M, R.channelCountMode = M;
    },
    get channelInterpretation() {
      return R.channelInterpretation;
    },
    set channelInterpretation(M) {
      F.channelInterpretation = M, R.channelInterpretation = M;
    },
    get coneInnerAngle() {
      return R.coneInnerAngle;
    },
    set coneInnerAngle(M) {
      R.coneInnerAngle = M;
    },
    get coneOuterAngle() {
      return R.coneOuterAngle;
    },
    set coneOuterAngle(M) {
      R.coneOuterAngle = M;
    },
    get coneOuterGain() {
      return R.coneOuterGain;
    },
    set coneOuterGain(M) {
      if (M < 0 || M > 1)
        throw t();
      R.coneOuterGain = M;
    },
    get context() {
      return R.context;
    },
    get distanceModel() {
      return R.distanceModel;
    },
    set distanceModel(M) {
      R.distanceModel = M;
    },
    get inputs() {
      return [F];
    },
    get maxDistance() {
      return R.maxDistance;
    },
    set maxDistance(M) {
      if (M < 0)
        throw new RangeError();
      R.maxDistance = M;
    },
    get numberOfInputs() {
      return R.numberOfInputs;
    },
    get numberOfOutputs() {
      return R.numberOfOutputs;
    },
    get orientationX() {
      return N.gain;
    },
    get orientationY() {
      return V.gain;
    },
    get orientationZ() {
      return W.gain;
    },
    get panningModel() {
      return R.panningModel;
    },
    set panningModel(M) {
      R.panningModel = M;
    },
    get positionX() {
      return L.gain;
    },
    get positionY() {
      return J.gain;
    },
    get positionZ() {
      return z.gain;
    },
    get refDistance() {
      return R.refDistance;
    },
    set refDistance(M) {
      if (M < 0)
        throw new RangeError();
      R.refDistance = M;
    },
    get rolloffFactor() {
      return R.rolloffFactor;
    },
    set rolloffFactor(M) {
      if (M < 0)
        throw new RangeError();
      R.rolloffFactor = M;
    },
    addEventListener(...M) {
      return F.addEventListener(M[0], M[1], M[2]);
    },
    dispatchEvent(...M) {
      return F.dispatchEvent(M[0]);
    },
    removeEventListener(...M) {
      return F.removeEventListener(M[0], M[1], M[2]);
    }
  };
  h !== X.coneInnerAngle && (X.coneInnerAngle = h), d !== X.coneOuterAngle && (X.coneOuterAngle = d), p !== X.coneOuterGain && (X.coneOuterGain = p), f !== X.distanceModel && (X.distanceModel = f), _ !== X.maxDistance && (X.maxDistance = _), m !== X.orientationX.value && (X.orientationX.value = m), g !== X.orientationY.value && (X.orientationY.value = g), b !== X.orientationZ.value && (X.orientationZ.value = b), v !== X.panningModel && (X.panningModel = v), x !== X.positionX.value && (X.positionX.value = x), y !== X.positionY.value && (X.positionY.value = y), w !== X.positionZ.value && (X.positionZ.value = w), S !== X.refDistance && (X.refDistance = S), C !== X.rolloffFactor && (X.rolloffFactor = C), (Z[0] !== 1 || Z[1] !== 0 || Z[2] !== 0) && R.setOrientation(...Z), (H[0] !== 0 || H[1] !== 0 || H[2] !== 0) && R.setPosition(...H);
  const Q = () => {
    F.connect(R), e(F, O, 0, 0), O.connect(N).connect(I, 0, 0), O.connect(V).connect(I, 0, 1), O.connect(W).connect(I, 0, 2), O.connect(L).connect(I, 0, 3), O.connect(J).connect(I, 0, 4), O.connect(z).connect(I, 0, 5), I.connect(E).connect(u.destination);
  }, it = () => {
    F.disconnect(R), a(F, O, 0, 0), O.disconnect(N), N.disconnect(I), O.disconnect(V), V.disconnect(I), O.disconnect(W), W.disconnect(I), O.disconnect(L), L.disconnect(I), O.disconnect(J), J.disconnect(I), O.disconnect(z), z.disconnect(I), I.disconnect(E), E.disconnect(u.destination);
  };
  return l(Hs(X, R), Q, it);
}, B_ = (e) => (t, { disableNormalization: n, imag: s, real: i }) => {
  const r = s instanceof Float32Array ? s : new Float32Array(s), o = i instanceof Float32Array ? i : new Float32Array(i), a = t.createPeriodicWave(o, r, { disableNormalization: n });
  if (Array.from(s).length < 2)
    throw e();
  return a;
}, Zi = (e, t, n, s) => e.createScriptProcessor(t, n, s), $_ = (e, t) => (n, s) => {
  const i = s.channelCountMode;
  if (i === "clamped-max")
    throw t();
  if (n.createStereoPanner === void 0)
    return e(n, s);
  const r = n.createStereoPanner();
  return ae(r, s), Kt(r, s, "pan"), Object.defineProperty(r, "channelCountMode", {
    get: () => i,
    set: (o) => {
      if (o !== i)
        throw t();
    }
  }), r;
}, q_ = (e, t, n, s, i, r) => {
  const a = new Float32Array([1, 1]), c = Math.PI / 2, l = { channelCount: 1, channelCountMode: "explicit", channelInterpretation: "discrete" }, u = { ...l, oversample: "none" }, h = (f, _, m, g) => {
    const b = new Float32Array(16385), v = new Float32Array(16385);
    for (let D = 0; D < 16385; D += 1) {
      const R = D / 16384 * c;
      b[D] = Math.cos(R), v[D] = Math.sin(R);
    }
    const x = n(f, { ...l, gain: 0 }), y = s(f, { ...u, curve: b }), w = s(f, { ...u, curve: a }), S = n(f, { ...l, gain: 0 }), C = s(f, { ...u, curve: v });
    return {
      connectGraph() {
        _.connect(x), _.connect(w.inputs === void 0 ? w : w.inputs[0]), _.connect(S), w.connect(m), m.connect(y.inputs === void 0 ? y : y.inputs[0]), m.connect(C.inputs === void 0 ? C : C.inputs[0]), y.connect(x.gain), C.connect(S.gain), x.connect(g, 0, 0), S.connect(g, 0, 1);
      },
      disconnectGraph() {
        _.disconnect(x), _.disconnect(w.inputs === void 0 ? w : w.inputs[0]), _.disconnect(S), w.disconnect(m), m.disconnect(y.inputs === void 0 ? y : y.inputs[0]), m.disconnect(C.inputs === void 0 ? C : C.inputs[0]), y.disconnect(x.gain), C.disconnect(S.gain), x.disconnect(g, 0, 0), S.disconnect(g, 0, 1);
      }
    };
  }, d = (f, _, m, g) => {
    const b = new Float32Array(16385), v = new Float32Array(16385), x = new Float32Array(16385), y = new Float32Array(16385), w = Math.floor(16385 / 2);
    for (let L = 0; L < 16385; L += 1)
      if (L > w) {
        const J = (L - w) / (16384 - w) * c;
        b[L] = Math.cos(J), v[L] = Math.sin(J), x[L] = 0, y[L] = 1;
      } else {
        const J = L / (16384 - w) * c;
        b[L] = 1, v[L] = 0, x[L] = Math.cos(J), y[L] = Math.sin(J);
      }
    const S = t(f, {
      channelCount: 2,
      channelCountMode: "explicit",
      channelInterpretation: "discrete",
      numberOfOutputs: 2
    }), C = n(f, { ...l, gain: 0 }), D = s(f, {
      ...u,
      curve: b
    }), R = n(f, { ...l, gain: 0 }), A = s(f, {
      ...u,
      curve: v
    }), I = s(f, { ...u, curve: a }), F = n(f, { ...l, gain: 0 }), N = s(f, {
      ...u,
      curve: x
    }), V = n(f, { ...l, gain: 0 }), W = s(f, {
      ...u,
      curve: y
    });
    return {
      connectGraph() {
        _.connect(S), _.connect(I.inputs === void 0 ? I : I.inputs[0]), S.connect(C, 0), S.connect(R, 0), S.connect(F, 1), S.connect(V, 1), I.connect(m), m.connect(D.inputs === void 0 ? D : D.inputs[0]), m.connect(A.inputs === void 0 ? A : A.inputs[0]), m.connect(N.inputs === void 0 ? N : N.inputs[0]), m.connect(W.inputs === void 0 ? W : W.inputs[0]), D.connect(C.gain), A.connect(R.gain), N.connect(F.gain), W.connect(V.gain), C.connect(g, 0, 0), F.connect(g, 0, 0), R.connect(g, 0, 1), V.connect(g, 0, 1);
      },
      disconnectGraph() {
        _.disconnect(S), _.disconnect(I.inputs === void 0 ? I : I.inputs[0]), S.disconnect(C, 0), S.disconnect(R, 0), S.disconnect(F, 1), S.disconnect(V, 1), I.disconnect(m), m.disconnect(D.inputs === void 0 ? D : D.inputs[0]), m.disconnect(A.inputs === void 0 ? A : A.inputs[0]), m.disconnect(N.inputs === void 0 ? N : N.inputs[0]), m.disconnect(W.inputs === void 0 ? W : W.inputs[0]), D.disconnect(C.gain), A.disconnect(R.gain), N.disconnect(F.gain), W.disconnect(V.gain), C.disconnect(g, 0, 0), F.disconnect(g, 0, 0), R.disconnect(g, 0, 1), V.disconnect(g, 0, 1);
      }
    };
  }, p = (f, _, m, g, b) => {
    if (_ === 1)
      return h(f, m, g, b);
    if (_ === 2)
      return d(f, m, g, b);
    throw i();
  };
  return (f, { channelCount: _, channelCountMode: m, pan: g, ...b }) => {
    if (m === "max")
      throw i();
    const v = e(f, {
      ...b,
      channelCount: 1,
      channelCountMode: m,
      numberOfInputs: 2
    }), x = n(f, { ...b, channelCount: _, channelCountMode: m, gain: 1 }), y = n(f, {
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "discrete",
      gain: g
    });
    let { connectGraph: w, disconnectGraph: S } = p(f, _, x, y, v);
    Object.defineProperty(y.gain, "defaultValue", { get: () => 0 }), Object.defineProperty(y.gain, "maxValue", { get: () => 1 }), Object.defineProperty(y.gain, "minValue", { get: () => -1 });
    const C = {
      get bufferSize() {
      },
      get channelCount() {
        return x.channelCount;
      },
      set channelCount(I) {
        x.channelCount !== I && (D && S(), { connectGraph: w, disconnectGraph: S } = p(f, I, x, y, v), D && w()), x.channelCount = I;
      },
      get channelCountMode() {
        return x.channelCountMode;
      },
      set channelCountMode(I) {
        if (I === "clamped-max" || I === "max")
          throw i();
        x.channelCountMode = I;
      },
      get channelInterpretation() {
        return x.channelInterpretation;
      },
      set channelInterpretation(I) {
        x.channelInterpretation = I;
      },
      get context() {
        return x.context;
      },
      get inputs() {
        return [x];
      },
      get numberOfInputs() {
        return x.numberOfInputs;
      },
      get numberOfOutputs() {
        return x.numberOfOutputs;
      },
      get pan() {
        return y.gain;
      },
      addEventListener(...I) {
        return x.addEventListener(I[0], I[1], I[2]);
      },
      dispatchEvent(...I) {
        return x.dispatchEvent(I[0]);
      },
      removeEventListener(...I) {
        return x.removeEventListener(I[0], I[1], I[2]);
      }
    };
    let D = !1;
    const R = () => {
      w(), D = !0;
    }, A = () => {
      S(), D = !1;
    };
    return r(Hs(C, v), R, A);
  };
}, z_ = (e, t, n, s, i, r, o) => (a, c) => {
  const l = a.createWaveShaper();
  if (r !== null && r.name === "webkitAudioContext" && a.createGain().gain.automationRate === void 0)
    return n(a, c);
  ae(l, c);
  const u = c.curve === null || c.curve instanceof Float32Array ? c.curve : new Float32Array(c.curve);
  if (u !== null && u.length < 2)
    throw t();
  Zt(l, { curve: u }, "curve"), Zt(l, c, "oversample");
  let h = null, d = !1;
  return o(l, "curve", (_) => () => _.call(l), (_) => (m) => (_.call(l, m), d && (s(m) && h === null ? h = e(a, l) : !s(m) && h !== null && (h(), h = null)), m)), i(l, () => {
    d = !0, s(l.curve) && (h = e(a, l));
  }, () => {
    d = !1, h !== null && (h(), h = null);
  });
}, G_ = (e, t, n, s, i) => (r, { curve: o, oversample: a, ...c }) => {
  const l = r.createWaveShaper(), u = r.createWaveShaper();
  ae(l, c), ae(u, c);
  const h = n(r, { ...c, gain: 1 }), d = n(r, { ...c, gain: -1 }), p = n(r, { ...c, gain: 1 }), f = n(r, { ...c, gain: -1 });
  let _ = null, m = !1, g = null;
  const b = {
    get bufferSize() {
    },
    get channelCount() {
      return l.channelCount;
    },
    set channelCount(y) {
      h.channelCount = y, d.channelCount = y, l.channelCount = y, p.channelCount = y, u.channelCount = y, f.channelCount = y;
    },
    get channelCountMode() {
      return l.channelCountMode;
    },
    set channelCountMode(y) {
      h.channelCountMode = y, d.channelCountMode = y, l.channelCountMode = y, p.channelCountMode = y, u.channelCountMode = y, f.channelCountMode = y;
    },
    get channelInterpretation() {
      return l.channelInterpretation;
    },
    set channelInterpretation(y) {
      h.channelInterpretation = y, d.channelInterpretation = y, l.channelInterpretation = y, p.channelInterpretation = y, u.channelInterpretation = y, f.channelInterpretation = y;
    },
    get context() {
      return l.context;
    },
    get curve() {
      return g;
    },
    set curve(y) {
      if (y !== null && y.length < 2)
        throw t();
      if (y === null)
        l.curve = y, u.curve = y;
      else {
        const w = y.length, S = new Float32Array(w + 2 - w % 2), C = new Float32Array(w + 2 - w % 2);
        S[0] = y[0], C[0] = -y[w - 1];
        const D = Math.ceil((w + 1) / 2), R = (w + 1) / 2 - 1;
        for (let A = 1; A < D; A += 1) {
          const I = A / D * R, F = Math.floor(I), N = Math.ceil(I);
          S[A] = F === N ? y[F] : (1 - (I - F)) * y[F] + (1 - (N - I)) * y[N], C[A] = F === N ? -y[w - 1 - F] : -((1 - (I - F)) * y[w - 1 - F]) - (1 - (N - I)) * y[w - 1 - N];
        }
        S[D] = w % 2 === 1 ? y[D - 1] : (y[D - 2] + y[D - 1]) / 2, l.curve = S, u.curve = C;
      }
      g = y, m && (s(g) && _ === null ? _ = e(r, h) : _ !== null && (_(), _ = null));
    },
    get inputs() {
      return [h];
    },
    get numberOfInputs() {
      return l.numberOfInputs;
    },
    get numberOfOutputs() {
      return l.numberOfOutputs;
    },
    get oversample() {
      return l.oversample;
    },
    set oversample(y) {
      l.oversample = y, u.oversample = y;
    },
    addEventListener(...y) {
      return h.addEventListener(y[0], y[1], y[2]);
    },
    dispatchEvent(...y) {
      return h.dispatchEvent(y[0]);
    },
    removeEventListener(...y) {
      return h.removeEventListener(y[0], y[1], y[2]);
    }
  };
  o !== null && (b.curve = o instanceof Float32Array ? o : new Float32Array(o)), a !== b.oversample && (b.oversample = a);
  const v = () => {
    h.connect(l).connect(p), h.connect(d).connect(u).connect(f).connect(p), m = !0, s(g) && (_ = e(r, h));
  }, x = () => {
    h.disconnect(l), l.disconnect(p), h.disconnect(d), d.disconnect(u), u.disconnect(f), f.disconnect(p), m = !1, _ !== null && (_(), _ = null);
  };
  return i(Hs(b, p), v, x);
}, Pe = () => new DOMException("", "NotSupportedError"), Z_ = {
  numberOfChannels: 1
}, Y_ = (e, t, n, s, i) => class extends e {
  constructor(o, a, c) {
    let l;
    if (typeof o == "number" && a !== void 0 && c !== void 0)
      l = { length: a, numberOfChannels: o, sampleRate: c };
    else if (typeof o == "object")
      l = o;
    else
      throw new Error("The given parameters are not valid.");
    const { length: u, numberOfChannels: h, sampleRate: d } = { ...Z_, ...l }, p = s(h, u, d);
    t(Oi, () => Oi(p)) || p.addEventListener("statechange", /* @__PURE__ */ (() => {
      let f = 0;
      const _ = (m) => {
        this._state === "running" && (f > 0 ? (p.removeEventListener("statechange", _), m.stopImmediatePropagation(), this._waitForThePromiseToSettle(m)) : f += 1);
      };
      return _;
    })()), super(p, h), this._length = u, this._nativeOfflineAudioContext = p, this._state = null;
  }
  get length() {
    return this._nativeOfflineAudioContext.length === void 0 ? this._length : this._nativeOfflineAudioContext.length;
  }
  get state() {
    return this._state === null ? this._nativeOfflineAudioContext.state : this._state;
  }
  startRendering() {
    return this._state === "running" ? Promise.reject(n()) : (this._state = "running", i(this.destination, this._nativeOfflineAudioContext).finally(() => {
      this._state = null, nd(this);
    }));
  }
  _waitForThePromiseToSettle(o) {
    this._state === null ? this._nativeOfflineAudioContext.dispatchEvent(o) : setTimeout(() => this._waitForThePromiseToSettle(o));
  }
}, X_ = {
  channelCount: 2,
  channelCountMode: "max",
  // This attribute has no effect for nodes with no inputs.
  channelInterpretation: "speakers",
  // This attribute has no effect for nodes with no inputs.
  detune: 0,
  frequency: 440,
  periodicWave: void 0,
  type: "sine"
}, U_ = (e, t, n, s, i, r, o) => class extends e {
  constructor(c, l) {
    const u = i(c), h = { ...X_, ...l }, d = n(u, h), p = r(u), f = p ? s() : null, _ = c.sampleRate / 2;
    super(c, !1, d, f), this._detune = t(this, p, d.detune, 153600, -153600), this._frequency = t(this, p, d.frequency, _, -_), this._nativeOscillatorNode = d, this._onended = null, this._oscillatorNodeRenderer = f, this._oscillatorNodeRenderer !== null && h.periodicWave !== void 0 && (this._oscillatorNodeRenderer.periodicWave = h.periodicWave);
  }
  get detune() {
    return this._detune;
  }
  get frequency() {
    return this._frequency;
  }
  get onended() {
    return this._onended;
  }
  set onended(c) {
    const l = typeof c == "function" ? o(this, c) : null;
    this._nativeOscillatorNode.onended = l;
    const u = this._nativeOscillatorNode.onended;
    this._onended = u !== null && u === l ? c : u;
  }
  get type() {
    return this._nativeOscillatorNode.type;
  }
  set type(c) {
    this._nativeOscillatorNode.type = c, this._oscillatorNodeRenderer !== null && (this._oscillatorNodeRenderer.periodicWave = null);
  }
  setPeriodicWave(c) {
    this._nativeOscillatorNode.setPeriodicWave(c), this._oscillatorNodeRenderer !== null && (this._oscillatorNodeRenderer.periodicWave = c);
  }
  start(c = 0) {
    if (this._nativeOscillatorNode.start(c), this._oscillatorNodeRenderer !== null && (this._oscillatorNodeRenderer.start = c), this.context.state !== "closed") {
      Ls(this);
      const l = () => {
        this._nativeOscillatorNode.removeEventListener("ended", l), En(this) && $i(this);
      };
      this._nativeOscillatorNode.addEventListener("ended", l);
    }
  }
  stop(c = 0) {
    this._nativeOscillatorNode.stop(c), this._oscillatorNodeRenderer !== null && (this._oscillatorNodeRenderer.stop = c);
  }
}, H_ = (e, t, n, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap();
  let o = null, a = null, c = null;
  const l = async (u, h) => {
    let d = n(u);
    const p = Te(d, h);
    if (!p) {
      const f = {
        channelCount: d.channelCount,
        channelCountMode: d.channelCountMode,
        channelInterpretation: d.channelInterpretation,
        detune: d.detune.value,
        frequency: d.frequency.value,
        periodicWave: o === null ? void 0 : o,
        type: d.type
      };
      d = t(h, f), a !== null && d.start(a), c !== null && d.stop(c);
    }
    return r.set(h, d), p ? (await e(h, u.detune, d.detune), await e(h, u.frequency, d.frequency)) : (await s(h, u.detune, d.detune), await s(h, u.frequency, d.frequency)), await i(u, h, d), d;
  };
  return {
    set periodicWave(u) {
      o = u;
    },
    set start(u) {
      a = u;
    },
    set stop(u) {
      c = u;
    },
    render(u, h) {
      const d = r.get(h);
      return d !== void 0 ? Promise.resolve(d) : l(u, h);
    }
  };
}, K_ = {
  channelCount: 2,
  channelCountMode: "clamped-max",
  channelInterpretation: "speakers",
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
  distanceModel: "inverse",
  maxDistance: 1e4,
  orientationX: 1,
  orientationY: 0,
  orientationZ: 0,
  panningModel: "equalpower",
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  refDistance: 1,
  rolloffFactor: 1
}, Q_ = (e, t, n, s, i, r, o) => class extends e {
  constructor(c, l) {
    const u = i(c), h = { ...K_, ...l }, d = n(u, h), p = r(u), f = p ? s() : null;
    super(c, !1, d, f), this._nativePannerNode = d, this._orientationX = t(this, p, d.orientationX, Ee, Ve), this._orientationY = t(this, p, d.orientationY, Ee, Ve), this._orientationZ = t(this, p, d.orientationZ, Ee, Ve), this._positionX = t(this, p, d.positionX, Ee, Ve), this._positionY = t(this, p, d.positionY, Ee, Ve), this._positionZ = t(this, p, d.positionZ, Ee, Ve), o(this, 1);
  }
  get coneInnerAngle() {
    return this._nativePannerNode.coneInnerAngle;
  }
  set coneInnerAngle(c) {
    this._nativePannerNode.coneInnerAngle = c;
  }
  get coneOuterAngle() {
    return this._nativePannerNode.coneOuterAngle;
  }
  set coneOuterAngle(c) {
    this._nativePannerNode.coneOuterAngle = c;
  }
  get coneOuterGain() {
    return this._nativePannerNode.coneOuterGain;
  }
  set coneOuterGain(c) {
    this._nativePannerNode.coneOuterGain = c;
  }
  get distanceModel() {
    return this._nativePannerNode.distanceModel;
  }
  set distanceModel(c) {
    this._nativePannerNode.distanceModel = c;
  }
  get maxDistance() {
    return this._nativePannerNode.maxDistance;
  }
  set maxDistance(c) {
    this._nativePannerNode.maxDistance = c;
  }
  get orientationX() {
    return this._orientationX;
  }
  get orientationY() {
    return this._orientationY;
  }
  get orientationZ() {
    return this._orientationZ;
  }
  get panningModel() {
    return this._nativePannerNode.panningModel;
  }
  set panningModel(c) {
    this._nativePannerNode.panningModel = c;
  }
  get positionX() {
    return this._positionX;
  }
  get positionY() {
    return this._positionY;
  }
  get positionZ() {
    return this._positionZ;
  }
  get refDistance() {
    return this._nativePannerNode.refDistance;
  }
  set refDistance(c) {
    this._nativePannerNode.refDistance = c;
  }
  get rolloffFactor() {
    return this._nativePannerNode.rolloffFactor;
  }
  set rolloffFactor(c) {
    this._nativePannerNode.rolloffFactor = c;
  }
}, J_ = (e, t, n, s, i, r, o, a, c, l) => () => {
  const u = /* @__PURE__ */ new WeakMap();
  let h = null;
  const d = async (p, f) => {
    let _ = null, m = r(p);
    const g = {
      channelCount: m.channelCount,
      channelCountMode: m.channelCountMode,
      channelInterpretation: m.channelInterpretation
    }, b = {
      ...g,
      coneInnerAngle: m.coneInnerAngle,
      coneOuterAngle: m.coneOuterAngle,
      coneOuterGain: m.coneOuterGain,
      distanceModel: m.distanceModel,
      maxDistance: m.maxDistance,
      panningModel: m.panningModel,
      refDistance: m.refDistance,
      rolloffFactor: m.rolloffFactor
    }, v = Te(m, f);
    if ("bufferSize" in m)
      _ = s(f, { ...g, gain: 1 });
    else if (!v) {
      const x = {
        ...b,
        orientationX: m.orientationX.value,
        orientationY: m.orientationY.value,
        orientationZ: m.orientationZ.value,
        positionX: m.positionX.value,
        positionY: m.positionY.value,
        positionZ: m.positionZ.value
      };
      m = i(f, x);
    }
    if (u.set(f, _ === null ? m : _), _ !== null) {
      if (h === null) {
        if (o === null)
          throw new Error("Missing the native OfflineAudioContext constructor.");
        const A = new o(
          6,
          // Bug #17: Safari does not yet expose the length.
          p.context.length,
          f.sampleRate
        ), I = t(A, {
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "speakers",
          numberOfInputs: 6
        });
        I.connect(A.destination), h = (async () => {
          const F = await Promise.all([
            p.orientationX,
            p.orientationY,
            p.orientationZ,
            p.positionX,
            p.positionY,
            p.positionZ
          ].map(async (N, V) => {
            const W = n(A, {
              channelCount: 1,
              channelCountMode: "explicit",
              channelInterpretation: "discrete",
              offset: V === 0 ? 1 : 0
            });
            return await a(A, N, W.offset), W;
          }));
          for (let N = 0; N < 6; N += 1)
            F[N].connect(I, 0, N), F[N].start(0);
          return l(A);
        })();
      }
      const x = await h, y = s(f, { ...g, gain: 1 });
      await c(p, f, y);
      const w = [];
      for (let A = 0; A < x.numberOfChannels; A += 1)
        w.push(x.getChannelData(A));
      let S = [w[0][0], w[1][0], w[2][0]], C = [w[3][0], w[4][0], w[5][0]], D = s(f, { ...g, gain: 1 }), R = i(f, {
        ...b,
        orientationX: S[0],
        orientationY: S[1],
        orientationZ: S[2],
        positionX: C[0],
        positionY: C[1],
        positionZ: C[2]
      });
      y.connect(D).connect(R.inputs[0]), R.connect(_);
      for (let A = 128; A < x.length; A += 128) {
        const I = [w[0][A], w[1][A], w[2][A]], F = [w[3][A], w[4][A], w[5][A]];
        if (I.some((N, V) => N !== S[V]) || F.some((N, V) => N !== C[V])) {
          S = I, C = F;
          const N = A / f.sampleRate;
          D.gain.setValueAtTime(0, N), D = s(f, { ...g, gain: 0 }), R = i(f, {
            ...b,
            orientationX: S[0],
            orientationY: S[1],
            orientationZ: S[2],
            positionX: C[0],
            positionY: C[1],
            positionZ: C[2]
          }), D.gain.setValueAtTime(1, N), y.connect(D).connect(R.inputs[0]), R.connect(_);
        }
      }
      return _;
    }
    return v ? (await e(f, p.orientationX, m.orientationX), await e(f, p.orientationY, m.orientationY), await e(f, p.orientationZ, m.orientationZ), await e(f, p.positionX, m.positionX), await e(f, p.positionY, m.positionY), await e(f, p.positionZ, m.positionZ)) : (await a(f, p.orientationX, m.orientationX), await a(f, p.orientationY, m.orientationY), await a(f, p.orientationZ, m.orientationZ), await a(f, p.positionX, m.positionX), await a(f, p.positionY, m.positionY), await a(f, p.positionZ, m.positionZ)), Us(m) ? await c(p, f, m.inputs[0]) : await c(p, f, m), m;
  };
  return {
    render(p, f) {
      const _ = u.get(f);
      return _ !== void 0 ? Promise.resolve(_) : d(p, f);
    }
  };
}, ty = {
  disableNormalization: !1
}, ey = (e, t, n, s) => class dd {
  constructor(r, o) {
    const a = t(r), c = s({ ...ty, ...o }), l = e(a, c);
    return n.add(l), l;
  }
  static [Symbol.hasInstance](r) {
    return r !== null && typeof r == "object" && Object.getPrototypeOf(r) === dd.prototype || n.has(r);
  }
}, ny = (e, t) => (n, s, i) => (e(s).replay(i), t(s, n, i)), sy = (e, t, n) => async (s, i, r) => {
  const o = e(s);
  await Promise.all(o.activeInputs.map((a, c) => Array.from(a).map(async ([l, u]) => {
    const d = await t(l).render(l, i), p = s.context.destination;
    !n(l) && (s !== p || !n(s)) && d.connect(r, u, c);
  })).reduce((a, c) => [...a, ...c], []));
}, iy = (e, t, n) => async (s, i, r) => {
  const o = t(s);
  await Promise.all(Array.from(o.activeInputs).map(async ([a, c]) => {
    const u = await e(a).render(a, i);
    n(a) || u.connect(r, c);
  }));
}, ry = (e, t, n, s) => (i) => e(Oi, () => Oi(i)) ? Promise.resolve(e(s, s)).then((r) => {
  if (!r) {
    const o = n(i, 512, 0, 1);
    i.oncomplete = () => {
      o.onaudioprocess = null, o.disconnect();
    }, o.onaudioprocess = () => i.currentTime, o.connect(i.destination);
  }
  return i.startRendering();
}) : new Promise((r) => {
  const o = t(i, {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "discrete",
    gain: 0
  });
  i.oncomplete = (a) => {
    o.disconnect(), r(a.renderedBuffer);
  }, o.connect(i.destination), i.startRendering();
}), oy = (e) => (t, n) => {
  e.set(t, n);
}, ay = (e) => (t, n) => e.set(t, n), cy = (e, t, n, s, i, r, o, a) => (c, l) => n(c).render(c, l).then(() => Promise.all(Array.from(s(l)).map((u) => n(u).render(u, l)))).then(() => i(l)).then((u) => (typeof u.copyFromChannel != "function" ? (o(u), xc(u)) : t(r, () => r(u)) || a(u), e.add(u), u)), ly = {
  channelCount: 2,
  /*
   * Bug #105: The channelCountMode should be 'clamped-max' according to the spec but is set to 'explicit' to achieve consistent
   * behavior.
   */
  channelCountMode: "explicit",
  channelInterpretation: "speakers",
  pan: 0
}, uy = (e, t, n, s, i, r) => class extends e {
  constructor(a, c) {
    const l = i(a), u = { ...ly, ...c }, h = n(l, u), d = r(l), p = d ? s() : null;
    super(a, !1, h, p), this._pan = t(this, d, h.pan);
  }
  get pan() {
    return this._pan;
  }
}, hy = (e, t, n, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap(), o = async (a, c) => {
    let l = n(a);
    const u = Te(l, c);
    if (!u) {
      const h = {
        channelCount: l.channelCount,
        channelCountMode: l.channelCountMode,
        channelInterpretation: l.channelInterpretation,
        pan: l.pan.value
      };
      l = t(c, h);
    }
    return r.set(c, l), u ? await e(c, a.pan, l.pan) : await s(c, a.pan, l.pan), Us(l) ? await i(a, c, l.inputs[0]) : await i(a, c, l), l;
  };
  return {
    render(a, c) {
      const l = r.get(c);
      return l !== void 0 ? Promise.resolve(l) : o(a, c);
    }
  };
}, dy = (e) => () => {
  if (e === null)
    return !1;
  try {
    new e({ length: 1, sampleRate: 44100 });
  } catch {
    return !1;
  }
  return !0;
}, fy = (e) => () => {
  if (e === null)
    return !1;
  const n = new e(1, 1, 44100).createBuffer(1, 1, 44100);
  if (n.copyToChannel === void 0)
    return !0;
  const s = new Float32Array(2);
  try {
    n.copyFromChannel(s, 0, 0);
  } catch {
    return !1;
  }
  return !0;
}, py = (e) => () => {
  if (e === null)
    return !1;
  if (e.prototype !== void 0 && e.prototype.close !== void 0)
    return !0;
  const t = new e(), n = t.close !== void 0;
  try {
    t.close();
  } catch {
  }
  return n;
}, my = (e) => () => {
  if (e === null)
    return Promise.resolve(!1);
  const t = new e(1, 1, 44100);
  return new Promise((n) => {
    let s = !0;
    const i = (o) => {
      s && (s = !1, t.startRendering(), n(o instanceof TypeError));
    };
    let r;
    try {
      r = t.decodeAudioData(null, () => {
      }, i);
    } catch (o) {
      i(o);
    }
    r !== void 0 && r.catch(i);
  });
}, gy = (e) => () => {
  if (e === null)
    return !1;
  let t;
  try {
    t = new e({ latencyHint: "balanced" });
  } catch {
    return !1;
  }
  return t.close(), !0;
}, _y = (e) => () => {
  if (e === null)
    return !1;
  const n = new e(1, 1, 44100).createGain(), s = n.connect(n) === n;
  return n.disconnect(n), s;
}, yy = (e, t) => async () => {
  if (e === null)
    return !0;
  if (t === null)
    return !1;
  const n = new Blob([
    'let c,p;class A extends AudioWorkletProcessor{constructor(){super();this.port.onmessage=(e)=>{p=e.data;p.onmessage=()=>{p.postMessage(c);p.close()};this.port.postMessage(0)}}process(){c=1}}registerProcessor("a",A)'
  ], {
    type: "application/javascript; charset=utf-8"
  }), s = new MessageChannel(), i = new t(1, 128, 44100), r = URL.createObjectURL(n);
  let o = !1;
  try {
    await i.audioWorklet.addModule(r);
    const a = new e(i, "a", { numberOfOutputs: 0 }), c = i.createOscillator();
    await new Promise((l) => {
      a.port.onmessage = () => l(), a.port.postMessage(s.port2, [s.port2]);
    }), a.port.onmessage = () => o = !0, c.connect(a), c.start(0), await i.startRendering(), o = await new Promise((l) => {
      s.port1.onmessage = ({ data: u }) => l(u === 1), s.port1.postMessage(0);
    });
  } catch {
  } finally {
    s.port1.close(), URL.revokeObjectURL(r);
  }
  return o;
}, vy = (e, t) => async () => {
  if (e === null)
    return !0;
  if (t === null)
    return !1;
  const n = new Blob(['class A extends AudioWorkletProcessor{process(i){this.port.postMessage(i,[i[0][0].buffer])}}registerProcessor("a",A)'], {
    type: "application/javascript; charset=utf-8"
  }), s = new t(1, 128, 44100), i = URL.createObjectURL(n);
  let r = !1, o = !1;
  try {
    await s.audioWorklet.addModule(i);
    const a = new e(s, "a", { numberOfOutputs: 0 }), c = s.createOscillator();
    a.port.onmessage = () => r = !0, a.onprocessorerror = () => o = !0, c.connect(a), c.start(0), await s.startRendering(), await new Promise((l) => setTimeout(l));
  } catch {
  } finally {
    URL.revokeObjectURL(i);
  }
  return r && !o;
}, by = (e) => () => {
  if (e === null)
    return !1;
  const n = new e(1, 1, 44100).createChannelMerger();
  if (n.channelCountMode === "max")
    return !0;
  try {
    n.channelCount = 2;
  } catch {
    return !0;
  }
  return !1;
}, xy = (e) => () => {
  if (e === null)
    return !1;
  const t = new e(1, 1, 44100);
  return t.createConstantSource === void 0 ? !0 : t.createConstantSource().offset.maxValue !== Number.POSITIVE_INFINITY;
}, wy = (e) => () => {
  if (e === null)
    return !1;
  const t = new e(1, 1, 44100), n = t.createConvolver();
  n.buffer = t.createBuffer(1, 1, t.sampleRate);
  try {
    n.buffer = t.createBuffer(1, 1, t.sampleRate);
  } catch {
    return !1;
  }
  return !0;
}, Cy = (e) => () => {
  if (e === null)
    return !1;
  const n = new e(1, 1, 44100).createConvolver();
  try {
    n.channelCount = 1;
  } catch {
    return !1;
  }
  return !0;
}, Sy = (e) => () => e !== null && e.hasOwnProperty("isSecureContext"), Ty = (e) => () => {
  if (e === null)
    return !1;
  const t = new e();
  try {
    return t.createMediaStreamSource(new MediaStream()), !1;
  } catch {
    return !0;
  } finally {
    t.close();
  }
}, Ay = (e, t) => () => {
  if (t === null)
    return Promise.resolve(!1);
  const n = new t(1, 1, 44100), s = e(n, {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "discrete",
    gain: 0
  });
  return new Promise((i) => {
    n.oncomplete = () => {
      s.disconnect(), i(n.currentTime !== 0);
    }, n.startRendering();
  });
}, ky = (e) => () => {
  if (e === null)
    return Promise.resolve(!1);
  const t = new e(1, 1, 44100);
  if (t.createStereoPanner === void 0 || t.createConstantSource === void 0)
    return Promise.resolve(!0);
  const n = t.createConstantSource(), s = t.createStereoPanner();
  return n.channelCount = 1, n.offset.value = 1, s.channelCount = 1, n.start(), n.connect(s).connect(t.destination), t.startRendering().then((i) => i.getChannelData(0)[0] !== 1);
}, Iy = () => new DOMException("", "UnknownError"), Ey = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  curve: null,
  oversample: "none"
}, Dy = (e, t, n, s, i, r, o) => class extends e {
  constructor(c, l) {
    const u = i(c), h = { ...Ey, ...l }, d = n(u, h), f = r(u) ? s() : null;
    super(c, !0, d, f), this._isCurveNullified = !1, this._nativeWaveShaperNode = d, o(this, 1);
  }
  get curve() {
    return this._isCurveNullified ? null : this._nativeWaveShaperNode.curve;
  }
  set curve(c) {
    if (c === null)
      this._isCurveNullified = !0, this._nativeWaveShaperNode.curve = new Float32Array([0, 0]);
    else {
      if (c.length < 2)
        throw t();
      this._isCurveNullified = !1, this._nativeWaveShaperNode.curve = c;
    }
  }
  get oversample() {
    return this._nativeWaveShaperNode.oversample;
  }
  set oversample(c) {
    this._nativeWaveShaperNode.oversample = c;
  }
}, Ry = (e, t, n) => () => {
  const s = /* @__PURE__ */ new WeakMap(), i = async (r, o) => {
    let a = t(r);
    if (!Te(a, o)) {
      const l = {
        channelCount: a.channelCount,
        channelCountMode: a.channelCountMode,
        channelInterpretation: a.channelInterpretation,
        curve: a.curve,
        oversample: a.oversample
      };
      a = e(o, l);
    }
    return s.set(o, a), Us(a) ? await n(r, o, a.inputs[0]) : await n(r, o, a), a;
  };
  return {
    render(r, o) {
      const a = s.get(o);
      return a !== void 0 ? Promise.resolve(a) : i(r, o);
    }
  };
}, Oy = () => typeof window > "u" ? null : window, My = (e, t) => (n) => {
  n.copyFromChannel = (s, i, r = 0) => {
    const o = e(r), a = e(i);
    if (a >= n.numberOfChannels)
      throw t();
    const c = n.length, l = n.getChannelData(a), u = s.length;
    for (let h = o < 0 ? -o : 0; h + o < c && h < u; h += 1)
      s[h] = l[h + o];
  }, n.copyToChannel = (s, i, r = 0) => {
    const o = e(r), a = e(i);
    if (a >= n.numberOfChannels)
      throw t();
    const c = n.length, l = n.getChannelData(a), u = s.length;
    for (let h = o < 0 ? -o : 0; h + o < c && h < u; h += 1)
      l[h + o] = s[h];
  };
}, Fy = (e) => (t) => {
  t.copyFromChannel = /* @__PURE__ */ ((n) => (s, i, r = 0) => {
    const o = e(r), a = e(i);
    if (o < t.length)
      return n.call(t, s, a, o);
  })(t.copyFromChannel), t.copyToChannel = /* @__PURE__ */ ((n) => (s, i, r = 0) => {
    const o = e(r), a = e(i);
    if (o < t.length)
      return n.call(t, s, a, o);
  })(t.copyToChannel);
}, Py = (e) => (t, n) => {
  const s = n.createBuffer(1, 1, 44100);
  t.buffer === null && (t.buffer = s), e(t, "buffer", (i) => () => {
    const r = i.call(t);
    return r === s ? null : r;
  }, (i) => (r) => i.call(t, r === null ? s : r));
}, Ny = (e, t) => (n, s) => {
  s.channelCount = 1, s.channelCountMode = "explicit", Object.defineProperty(s, "channelCount", {
    get: () => 1,
    set: () => {
      throw e();
    }
  }), Object.defineProperty(s, "channelCountMode", {
    get: () => "explicit",
    set: () => {
      throw e();
    }
  });
  const i = n.createBufferSource();
  t(s, () => {
    const a = s.numberOfInputs;
    for (let c = 0; c < a; c += 1)
      i.connect(s, 0, c);
  }, () => i.disconnect(s));
}, fd = (e, t, n) => e.copyFromChannel === void 0 ? e.getChannelData(n)[0] : (e.copyFromChannel(t, n), t[0]), pd = (e) => {
  if (e === null)
    return !1;
  const t = e.length;
  return t % 2 !== 0 ? e[Math.floor(t / 2)] !== 0 : e[t / 2 - 1] + e[t / 2] !== 0;
}, Yi = (e, t, n, s) => {
  let i = e;
  for (; !i.hasOwnProperty(t); )
    i = Object.getPrototypeOf(i);
  const { get: r, set: o } = Object.getOwnPropertyDescriptor(i, t);
  Object.defineProperty(e, t, { get: n(r), set: s(o) });
}, Vy = (e) => ({
  ...e,
  outputChannelCount: e.outputChannelCount !== void 0 ? e.outputChannelCount : e.numberOfInputs === 1 && e.numberOfOutputs === 1 ? (
    /*
     * Bug #61: This should be the computedNumberOfChannels, but unfortunately that is almost impossible to fake. That's why
     * the channelCountMode is required to be 'explicit' as long as there is not a native implementation in every browser. That
     * makes sure the computedNumberOfChannels is equivilant to the channelCount which makes it much easier to compute.
     */
    [e.channelCount]
  ) : Array.from({ length: e.numberOfOutputs }, () => 1)
}), Wy = (e) => ({ ...e, channelCount: e.numberOfOutputs }), jy = (e) => {
  const { imag: t, real: n } = e;
  return t === void 0 ? n === void 0 ? { ...e, imag: [0, 0], real: [0, 0] } : { ...e, imag: Array.from(n, () => 0), real: n } : n === void 0 ? { ...e, imag: t, real: Array.from(t, () => 0) } : { ...e, imag: t, real: n };
}, md = (e, t, n) => {
  try {
    e.setValueAtTime(t, n);
  } catch (s) {
    if (s.code !== 9)
      throw s;
    md(e, t, n + 1e-7);
  }
}, Ly = (e) => {
  const t = e.createBufferSource();
  t.start();
  try {
    t.start();
  } catch {
    return !0;
  }
  return !1;
}, By = (e) => {
  const t = e.createBufferSource(), n = e.createBuffer(1, 1, 44100);
  t.buffer = n;
  try {
    t.start(0, 1);
  } catch {
    return !1;
  }
  return !0;
}, $y = (e) => {
  const t = e.createBufferSource();
  t.start();
  try {
    t.stop();
  } catch {
    return !1;
  }
  return !0;
}, Ac = (e) => {
  const t = e.createOscillator();
  try {
    t.start(-1);
  } catch (n) {
    return n instanceof RangeError;
  }
  return !1;
}, gd = (e) => {
  const t = e.createBuffer(1, 1, 44100), n = e.createBufferSource();
  n.buffer = t, n.start(), n.stop();
  try {
    return n.stop(), !0;
  } catch {
    return !1;
  }
}, kc = (e) => {
  const t = e.createOscillator();
  try {
    t.stop(-1);
  } catch (n) {
    return n instanceof RangeError;
  }
  return !1;
}, qy = (e) => {
  const { port1: t, port2: n } = new MessageChannel();
  try {
    t.postMessage(e);
  } finally {
    t.close(), n.close();
  }
}, zy = () => {
  try {
    new DOMException();
  } catch {
    return !1;
  }
  return !0;
}, Gy = () => new Promise((e) => {
  const t = new ArrayBuffer(0), { port1: n, port2: s } = new MessageChannel();
  n.onmessage = ({ data: i }) => e(i !== null), s.postMessage(t, [t]);
}), Zy = (e) => {
  e.start = /* @__PURE__ */ ((t) => (n = 0, s = 0, i) => {
    const r = e.buffer, o = r === null ? s : Math.min(r.duration, s);
    r !== null && o > r.duration - 0.5 / e.context.sampleRate ? t.call(e, n, 0, 0) : t.call(e, n, o, i);
  })(e.start);
}, _d = (e, t) => {
  const n = t.createGain();
  e.connect(n);
  const s = /* @__PURE__ */ ((i) => () => {
    i.call(e, n), e.removeEventListener("ended", s);
  })(e.disconnect);
  e.addEventListener("ended", s), Hs(e, n), e.stop = /* @__PURE__ */ ((i) => {
    let r = !1;
    return (o = 0) => {
      if (r)
        try {
          i.call(e, o);
        } catch {
          n.gain.setValueAtTime(0, o);
        }
      else
        i.call(e, o), r = !0;
    };
  })(e.stop);
}, Ks = (e, t) => (n) => {
  const s = { value: e };
  return Object.defineProperties(n, {
    currentTarget: s,
    target: s
  }), typeof t == "function" ? t.call(e, n) : t.handleEvent.call(e, n);
}, Yy = Kp(vs), Xy = sm(vs), Uy = mg(ro), yd = /* @__PURE__ */ new WeakMap(), Hy = Mg(yd), en = Gm(/* @__PURE__ */ new Map(), /* @__PURE__ */ new WeakMap()), on = Oy(), vd = u_(en, bn), Ic = Og(Re), ve = sy(Re, Ic, ms), Ky = cm(vd, zt, ve), Bt = Ng(io), le = V_(on), Nt = Jg(le), bd = /* @__PURE__ */ new WeakMap(), xd = Tg(Ks), Yn = p_(on), Ec = Ug(Yn), Dc = Hg(on), wd = Kg(on), Bs = g_(on), se = Mm(Qp(Uh), nm(Yy, Xy, Br, Uy, $r, Re, Hy, Bi, zt, vs, En, ms, Rr), en, zg(Ra, $r, Re, zt, Ri, En), bn, oo, Pe, hg(Br, Ra, Re, zt, Ri, Bt, En, Nt), yg(bd, Re, rn), xd, Bt, Ec, Dc, wd, Nt, Bs), Qy = am(se, Ky, bn, vd, Bt, Nt), Rc = /* @__PURE__ */ new WeakSet(), ou = h_(on), Cd = ig(new Uint32Array(1)), Oc = My(Cd, bn), Mc = Fy(Cd), Sd = um(Rc, en, Pe, ou, le, dy(ou), Oc, Mc), ao = im(je), Td = iy(Ic, qi, ms), xn = Qm(Td), Qs = f_(ao, en, Ly, By, $y, Ac, gd, kc, Zy, Py(Yi), _d), wn = ny(Fg(qi), Td), Jy = fm(xn, Qs, zt, wn, ve), cn = Fm(Jp(Hh), bd, bc, Pm, Gp, Zp, Yp, Xp, Up, Ia, Yh, Yn, md), tv = dm(se, Jy, cn, ue, Qs, Bt, Nt, Ks), ev = wm(se, Cm, bn, ue, m_(je, Yi), Bt, Nt, ve), nv = zm(xn, ud, zt, wn, ve), bs = ay(yd), sv = qm(se, cn, nv, oo, ud, Bt, Nt, bs), ns = c_(vs, Dc), iv = Ny(ue, ns), ss = C_(Yn, iv), rv = Xm(ss, zt, ve), ov = Ym(se, rv, ss, Bt, Nt), av = Km(Gi, zt, ve), cv = Hm(se, av, Gi, Bt, Nt, Wy), lv = A_(ao, Qs, je, ns), Js = T_(ao, en, lv, Ac, kc), uv = sg(xn, Js, zt, wn, ve), hv = ng(se, cn, uv, Js, Bt, Nt, Ks), Ad = k_(Pe, Yi), dv = ag(Ad, zt, ve), fv = og(se, dv, Ad, Bt, Nt, bs), pv = pg(xn, hd, zt, wn, ve), mv = fg(se, cn, pv, hd, Bt, Nt, bs), kd = I_(Pe), gv = wg(xn, kd, zt, wn, ve), _v = xg(se, cn, gv, kd, Pe, Bt, Nt, bs), yv = Dg(xn, je, zt, wn, ve), vv = Eg(se, cn, yv, je, Bt, Nt), bv = O_(oo, ue, Zi, Pe), co = ry(en, je, Zi, Ay(je, le)), xv = qg(Qs, zt, le, ve, co), wv = E_(bv), Cv = Bg(se, wv, xv, Bt, Nt, bs), Sv = Sm(cn, ss, Js, Zi, Pe, fd, Nt, Yi), Id = /* @__PURE__ */ new WeakMap(), Tv = a_(ev, Sv, xd, Nt, Id, Ks), Ed = W_(ao, en, Ac, gd, kc, _d), Av = H_(xn, Ed, zt, wn, ve), kv = U_(se, cn, Ed, Av, Bt, Nt, Ks), Dd = tg(Qs), Iv = G_(Dd, ue, je, pd, ns), lo = z_(Dd, ue, Iv, pd, ns, Yn, Yi), Ev = L_(Br, ue, ss, je, Zi, lo, Pe, $r, fd, ns), Rd = j_(Ev), Dv = J_(xn, ss, Js, je, Rd, zt, le, wn, ve, co), Rv = Q_(se, cn, Rd, Dv, Bt, Nt, bs), Ov = B_(bn), Mv = ey(Ov, Bt, /* @__PURE__ */ new WeakSet(), jy), Fv = q_(ss, Gi, je, lo, Pe, ns), Od = $_(Fv, Pe), Pv = hy(xn, Od, zt, wn, ve), Nv = uy(se, cn, Od, Pv, Bt, Nt), Vv = Ry(lo, zt, ve), Wv = Dy(se, ue, lo, Vv, Bt, Nt, bs), Md = t_(on), Fc = Ag(on), Fd = /* @__PURE__ */ new WeakMap(), jv = Vg(Fd, le), Lv = Md ? em(
  en,
  Pe,
  Sg(on),
  Fc,
  kg(Hp),
  Bt,
  jv,
  Nt,
  Bs,
  /* @__PURE__ */ new WeakMap(),
  /* @__PURE__ */ new WeakMap(),
  vy(Bs, le),
  // @todo window is guaranteed to be defined because isSecureContext checks that as well.
  on
) : void 0, Bv = Qg(Ec, Nt), $v = ug(Rc, en, lg, Cg, /* @__PURE__ */ new WeakSet(), Bt, Bv, jr, Oi, Oc, Mc), Pd = Bm(Lv, Qy, Sd, tv, sv, ov, cv, hv, fv, $v, mv, _v, vv, Cv, Tv, kv, Rv, Mv, Nv, Wv), qv = n_(se, M_, Bt, Nt), zv = i_(se, F_, Bt, Nt), Gv = r_(se, P_, Bt, Nt), Zv = N_(ue, Nt), Yv = o_(se, Zv, Bt), Xv = xm(Pd, ue, Pe, Iy, qv, zv, Gv, Yv, Yn), Pc = Wg(Id), Uv = rm(Pc), Nd = Jm(bn), Hv = gg(Pc), Vd = vg(bn), Wd = /* @__PURE__ */ new WeakMap(), Kv = Rg(Wd, rn), Qv = w_(Nd, bn, ue, ss, Gi, Js, je, Zi, Pe, Vd, Fc, Kv, ns), Jv = y_(ue, Qv, je, Pe, ns), t0 = Lm(xn, Nd, Qs, ss, Gi, Js, je, Hv, Vd, Fc, zt, Bs, le, wn, ve, co), e0 = Pg(Fd), n0 = oy(Wd), au = Md ? Vm(Uv, se, cn, t0, Jv, Re, e0, Bt, Nt, Bs, Vy, n0, qy, Ks) : void 0, s0 = cg(Pe, le), i0 = cy(Rc, en, Ic, Pc, co, jr, Oc, Mc), r0 = Y_(Pd, en, ue, s0, i0), o0 = Gg(io, Ec), a0 = Zg(vc, Dc), c0 = Yg(bc, wd), l0 = Xg(io, Nt), u0 = () => e_(en, fy(le), py(Yn), my(le), gy(Yn), _y(le), yy(Bs, le), by(le), xy(le), wy(le), Cy(le), zy, Sy(on), Ty(Yn), ky(le), Gy);
function We(e) {
  return e === void 0;
}
function bt(e) {
  return e !== void 0;
}
function jd(e) {
  return typeof e == "function";
}
function ze(e) {
  return typeof e == "number";
}
function Dn(e) {
  return Object.prototype.toString.call(e) === "[object Object]" && e.constructor === Object;
}
function Nc(e) {
  return typeof e == "boolean";
}
function _e(e) {
  return Array.isArray(e);
}
function an(e) {
  return typeof e == "string";
}
function Ti(e) {
  return an(e) && /^([a-g]{1}(?:b|#|x|bb)?)(-?[0-9]+)/i.test(e);
}
function st(e, t) {
  if (!e)
    throw new Error(t);
}
function oe(e, t, n = 1 / 0) {
  if (!(t <= e && e <= n))
    throw new RangeError(`Value must be within [${t}, ${n}], got: ${e}`);
}
function Vc(e) {
  !e.isOffline && e.state !== "running" && ti('The AudioContext is "suspended". Invoke Tone.start() from a user action to start the audio.');
}
let Ld = !1, cu = !1;
function Na(e) {
  Ld = e;
}
function Bd(e) {
  We(e) && Ld && !cu && (cu = !0, ti("Events scheduled inside of scheduled callbacks should use the passed in scheduling time. See https://github.com/Tonejs/Tone.js/wiki/Accurate-Timing"));
}
let Wc = console;
function h0(e) {
  Wc = e;
}
function $d(...e) {
  Wc.log(...e);
}
function ti(...e) {
  Wc.warn(...e);
}
const d0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  assert: st,
  assertContextRunning: Vc,
  assertRange: oe,
  assertUsedScheduleTime: Bd,
  enterScheduledCallback: Na,
  log: $d,
  setLogger: h0,
  warn: ti
}, Symbol.toStringTag, { value: "Module" }));
function f0(e) {
  return new Xv(e);
}
function p0(e, t, n) {
  return new r0(e, t, n);
}
const De = typeof self == "object" ? self : null, m0 = De && (De.hasOwnProperty("AudioContext") || De.hasOwnProperty("webkitAudioContext"));
function g0(e, t, n) {
  return st(bt(au), "AudioWorkletNode only works in a secure context (https or localhost)"), new (e instanceof De?.BaseAudioContext ? De?.AudioWorkletNode : au)(e, t, n);
}
function ln(e, t, n, s) {
  var i = arguments.length, r = i < 3 ? t : s === null ? s = Object.getOwnPropertyDescriptor(t, n) : s, o;
  if (typeof Reflect == "object" && typeof Reflect.decorate == "function") r = Reflect.decorate(e, t, n, s);
  else for (var a = e.length - 1; a >= 0; a--) (o = e[a]) && (r = (i < 3 ? o(r) : i > 3 ? o(t, n, r) : o(t, n)) || r);
  return i > 3 && r && Object.defineProperty(t, n, r), r;
}
function jt(e, t, n, s) {
  function i(r) {
    return r instanceof n ? r : new n(function(o) {
      o(r);
    });
  }
  return new (n || (n = Promise))(function(r, o) {
    function a(u) {
      try {
        l(s.next(u));
      } catch (h) {
        o(h);
      }
    }
    function c(u) {
      try {
        l(s.throw(u));
      } catch (h) {
        o(h);
      }
    }
    function l(u) {
      u.done ? r(u.value) : i(u.value).then(a, c);
    }
    l((s = s.apply(e, t || [])).next());
  });
}
class _0 {
  constructor(t, n, s, i) {
    this._callback = t, this._type = n, this._minimumUpdateInterval = Math.max(128 / (i || 44100), 1e-3), this.updateInterval = s, this._createClock();
  }
  /**
   * Generate a web worker
   */
  _createWorker() {
    const t = new Blob([
      /* javascript */
      `
			// the initial timeout time
			let timeoutTime =  ${(this._updateInterval * 1e3).toFixed(1)};
			// onmessage callback
			self.onmessage = function(msg){
				timeoutTime = parseInt(msg.data);
			};
			// the tick function which posts a message
			// and schedules a new tick
			function tick(){
				setTimeout(tick, timeoutTime);
				self.postMessage('tick');
			}
			// call tick initially
			tick();
			`
    ], { type: "text/javascript" }), n = URL.createObjectURL(t), s = new Worker(n);
    s.onmessage = this._callback.bind(this), this._worker = s;
  }
  /**
   * Create a timeout loop
   */
  _createTimeout() {
    this._timeout = setTimeout(() => {
      this._createTimeout(), this._callback();
    }, this._updateInterval * 1e3);
  }
  /**
   * Create the clock source.
   */
  _createClock() {
    if (this._type === "worker")
      try {
        this._createWorker();
      } catch {
        this._type = "timeout", this._createClock();
      }
    else this._type === "timeout" && this._createTimeout();
  }
  /**
   * Clean up the current clock source
   */
  _disposeClock() {
    this._timeout && clearTimeout(this._timeout), this._worker && (this._worker.terminate(), this._worker.onmessage = null);
  }
  /**
   * The rate in seconds the ticker will update
   */
  get updateInterval() {
    return this._updateInterval;
  }
  set updateInterval(t) {
    var n;
    this._updateInterval = Math.max(t, this._minimumUpdateInterval), this._type === "worker" && ((n = this._worker) === null || n === void 0 || n.postMessage(this._updateInterval * 1e3));
  }
  /**
   * The type of the ticker, either a worker or a timeout
   */
  get type() {
    return this._type;
  }
  set type(t) {
    this._disposeClock(), this._type = t, this._createClock();
  }
  /**
   * Clean up
   */
  dispose() {
    this._disposeClock();
  }
}
function gs(e) {
  return c0(e);
}
function Xn(e) {
  return a0(e);
}
function Or(e) {
  return l0(e);
}
function Ms(e) {
  return o0(e);
}
function y0(e) {
  return e instanceof Sd;
}
function v0(e, t) {
  return e === "value" || gs(t) || Xn(t) || y0(t);
}
function Qe(e, ...t) {
  if (!t.length)
    return e;
  const n = t.shift();
  if (Dn(e) && Dn(n))
    for (const s in n)
      v0(s, n[s]) ? e[s] = n[s] : Dn(n[s]) ? (e[s] || Object.assign(e, { [s]: {} }), Qe(e[s], n[s])) : Object.assign(e, { [s]: n[s] });
  return Qe(e, ...t);
}
function b0(e, t) {
  return e.length === t.length && e.every((n, s) => t[s] === n);
}
function P(e, t, n = [], s) {
  const i = {}, r = Array.from(t);
  if (Dn(r[0]) && s && !Reflect.has(r[0], s) && (Object.keys(r[0]).some((a) => Reflect.has(e, a)) || (Qe(i, { [s]: r[0] }), n.splice(n.indexOf(s), 1), r.shift())), r.length === 1 && Dn(r[0]))
    Qe(i, r[0]);
  else
    for (let o = 0; o < n.length; o++)
      bt(r[o]) && (i[n[o]] = r[o]);
  return Qe(e, i);
}
function x0(e) {
  return e.constructor.getDefaults();
}
function Je(e, t) {
  return We(e) ? t : e;
}
function me(e, t) {
  return t.forEach((n) => {
    Reflect.has(e, n) && delete e[n];
  }), e;
}
let Nn = class {
  constructor() {
    this.debug = !1, this._wasDisposed = !1;
  }
  /**
   * Returns all of the default options belonging to the class.
   */
  static getDefaults() {
    return {};
  }
  /**
   * Prints the outputs to the console log for debugging purposes.
   * Prints the contents only if either the object has a property
   * called `debug` set to true, or a variable called TONE_DEBUG_CLASS
   * is set to the name of the class.
   * @example
   * const osc = new Tone.Oscillator();
   * // prints all logs originating from this oscillator
   * osc.debug = true;
   * // calls to start/stop will print in the console
   * osc.start();
   */
  log(...t) {
    (this.debug || De && this.toString() === De.TONE_DEBUG_CLASS) && $d(this, ...t);
  }
  /**
   * disconnect and dispose.
   */
  dispose() {
    return this._wasDisposed = !0, this;
  }
  /**
   * Indicates if the instance was disposed. 'Disposing' an
   * instance means that all of the Web Audio nodes that were
   * created for the instance are disconnected and freed for garbage collection.
   */
  get disposed() {
    return this._wasDisposed;
  }
  /**
   * Convert the class to a string
   * @example
   * const osc = new Tone.Oscillator();
   * console.log(osc.toString());
   */
  toString() {
    return this.name;
  }
};
Nn.version = _c;
const jc = 1e-6;
function $s(e, t) {
  return e > t + jc;
}
function Va(e, t) {
  return $s(e, t) || sn(e, t);
}
function Zr(e, t) {
  return e + jc < t;
}
function sn(e, t) {
  return Math.abs(e - t) < jc;
}
function xs(e, t, n) {
  return Math.max(Math.min(e, n), t);
}
class $e extends Nn {
  constructor() {
    super(), this.name = "Timeline", this._timeline = [];
    const t = P($e.getDefaults(), arguments, ["memory"]);
    this.memory = t.memory, this.increasing = t.increasing;
  }
  static getDefaults() {
    return {
      memory: 1 / 0,
      increasing: !1
    };
  }
  /**
   * The number of items in the timeline.
   */
  get length() {
    return this._timeline.length;
  }
  /**
   * Insert an event object onto the timeline. Events must have a "time" attribute.
   * @param event  The event object to insert into the timeline.
   */
  add(t) {
    if (st(Reflect.has(t, "time"), "Timeline: events must have a time attribute"), t.time = t.time.valueOf(), this.increasing && this.length) {
      const n = this._timeline[this.length - 1];
      st(Va(t.time, n.time), "The time must be greater than or equal to the last scheduled time"), this._timeline.push(t);
    } else {
      const n = this._search(t.time);
      this._timeline.splice(n + 1, 0, t);
    }
    if (this.length > this.memory) {
      const n = this.length - this.memory;
      this._timeline.splice(0, n);
    }
    return this;
  }
  /**
   * Remove an event from the timeline.
   * @param  {Object}  event  The event object to remove from the list.
   * @returns {Timeline} this
   */
  remove(t) {
    const n = this._timeline.indexOf(t);
    return n !== -1 && this._timeline.splice(n, 1), this;
  }
  /**
   * Get the nearest event whose time is less than or equal to the given time.
   * @param  time  The time to query.
   */
  get(t, n = "time") {
    const s = this._search(t, n);
    return s !== -1 ? this._timeline[s] : null;
  }
  /**
   * Return the first event in the timeline without removing it
   * @returns {Object} The first event object
   * @deprecated
   */
  peek() {
    return this._timeline[0];
  }
  /**
   * Return the first event in the timeline and remove it
   * @deprecated
   */
  shift() {
    return this._timeline.shift();
  }
  /**
   * Get the event which is scheduled after the given time.
   * @param  time  The time to query.
   */
  getAfter(t, n = "time") {
    const s = this._search(t, n);
    return s + 1 < this._timeline.length ? this._timeline[s + 1] : null;
  }
  /**
   * Get the event before the event at the given time.
   * @param  time  The time to query.
   */
  getBefore(t) {
    const n = this._timeline.length;
    if (n > 0 && this._timeline[n - 1].time < t)
      return this._timeline[n - 1];
    const s = this._search(t);
    return s - 1 >= 0 ? this._timeline[s - 1] : null;
  }
  /**
   * Cancel events at and after the given time
   * @param  after  The time to query.
   */
  cancel(t) {
    if (this._timeline.length > 1) {
      let n = this._search(t);
      if (n >= 0)
        if (sn(this._timeline[n].time, t)) {
          for (let s = n; s >= 0 && sn(this._timeline[s].time, t); s--)
            n = s;
          this._timeline = this._timeline.slice(0, n);
        } else
          this._timeline = this._timeline.slice(0, n + 1);
      else
        this._timeline = [];
    } else this._timeline.length === 1 && Va(this._timeline[0].time, t) && (this._timeline = []);
    return this;
  }
  /**
   * Cancel events before or equal to the given time.
   * @param  time  The time to cancel before.
   */
  cancelBefore(t) {
    const n = this._search(t);
    return n >= 0 && (this._timeline = this._timeline.slice(n + 1)), this;
  }
  /**
   * Returns the previous event if there is one. null otherwise
   * @param  event The event to find the previous one of
   * @return The event right before the given event
   */
  previousEvent(t) {
    const n = this._timeline.indexOf(t);
    return n > 0 ? this._timeline[n - 1] : null;
  }
  /**
   * Does a binary search on the timeline array and returns the
   * nearest event index whose time is after or equal to the given time.
   * If a time is searched before the first index in the timeline, -1 is returned.
   * If the time is after the end, the index of the last item is returned.
   */
  _search(t, n = "time") {
    if (this._timeline.length === 0)
      return -1;
    let s = 0;
    const i = this._timeline.length;
    let r = i;
    if (i > 0 && this._timeline[i - 1][n] <= t)
      return i - 1;
    for (; s < r; ) {
      let o = Math.floor(s + (r - s) / 2);
      const a = this._timeline[o], c = this._timeline[o + 1];
      if (sn(a[n], t)) {
        for (let l = o; l < this._timeline.length; l++) {
          const u = this._timeline[l];
          if (sn(u[n], t))
            o = l;
          else
            break;
        }
        return o;
      } else {
        if (Zr(a[n], t) && $s(c[n], t))
          return o;
        $s(a[n], t) ? r = o : s = o + 1;
      }
    }
    return -1;
  }
  /**
   * Internal iterator. Applies extra safety checks for
   * removing items from the array.
   */
  _iterate(t, n = 0, s = this._timeline.length - 1) {
    this._timeline.slice(n, s + 1).forEach(t);
  }
  /**
   * Iterate over everything in the array
   * @param  callback The callback to invoke with every item
   */
  forEach(t) {
    return this._iterate(t), this;
  }
  /**
   * Iterate over everything in the array at or before the given time.
   * @param  time The time to check if items are before
   * @param  callback The callback to invoke with every item
   */
  forEachBefore(t, n) {
    const s = this._search(t);
    return s !== -1 && this._iterate(n, 0, s), this;
  }
  /**
   * Iterate over everything in the array after the given time.
   * @param  time The time to check if items are before
   * @param  callback The callback to invoke with every item
   */
  forEachAfter(t, n) {
    const s = this._search(t);
    return this._iterate(n, s + 1), this;
  }
  /**
   * Iterate over everything in the array between the startTime and endTime.
   * The timerange is inclusive of the startTime, but exclusive of the endTime.
   * range = [startTime, endTime).
   * @param  startTime The time to check if items are before
   * @param  endTime The end of the test interval.
   * @param  callback The callback to invoke with every item
   */
  forEachBetween(t, n, s) {
    let i = this._search(t), r = this._search(n);
    return i !== -1 && r !== -1 ? (this._timeline[i].time !== t && (i += 1), this._timeline[r].time === n && (r -= 1), this._iterate(s, i, r)) : i === -1 && this._iterate(s, 0, r), this;
  }
  /**
   * Iterate over everything in the array at or after the given time. Similar to
   * forEachAfter, but includes the item(s) at the given time.
   * @param  time The time to check if items are before
   * @param  callback The callback to invoke with every item
   */
  forEachFrom(t, n) {
    let s = this._search(t);
    for (; s >= 0 && this._timeline[s].time >= t; )
      s--;
    return this._iterate(n, s + 1), this;
  }
  /**
   * Iterate over everything in the array at the given time
   * @param  time The time to check if items are before
   * @param  callback The callback to invoke with every item
   */
  forEachAtTime(t, n) {
    const s = this._search(t);
    if (s !== -1 && sn(this._timeline[s].time, t)) {
      let i = s;
      for (let r = s; r >= 0 && sn(this._timeline[r].time, t); r--)
        i = r;
      this._iterate((r) => {
        n(r);
      }, i, s);
    }
    return this;
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._timeline = [], this;
  }
}
const qd = [];
function uo(e) {
  qd.push(e);
}
function w0(e) {
  qd.forEach((t) => t(e));
}
const zd = [];
function ho(e) {
  zd.push(e);
}
function C0(e) {
  zd.forEach((t) => t(e));
}
class ei extends Nn {
  constructor() {
    super(...arguments), this.name = "Emitter";
  }
  /**
   * Bind a callback to a specific event.
   * @param  event     The name of the event to listen for.
   * @param  callback  The callback to invoke when the event is emitted
   */
  on(t, n) {
    return t.split(/\W+/).forEach((i) => {
      We(this._events) && (this._events = {}), this._events.hasOwnProperty(i) || (this._events[i] = []), this._events[i].push(n);
    }), this;
  }
  /**
   * Bind a callback which is only invoked once
   * @param  event     The name of the event to listen for.
   * @param  callback  The callback to invoke when the event is emitted
   */
  once(t, n) {
    const s = (...i) => {
      n(...i), this.off(t, s);
    };
    return this.on(t, s), this;
  }
  /**
   * Remove the event listener.
   * @param  event     The event to stop listening to.
   * @param  callback  The callback which was bound to the event with Emitter.on.
   *                   If no callback is given, all callbacks events are removed.
   */
  off(t, n) {
    return t.split(/\W+/).forEach((i) => {
      if (We(this._events) && (this._events = {}), this._events.hasOwnProperty(i))
        if (We(n))
          this._events[i] = [];
        else {
          const r = this._events[i];
          for (let o = r.length - 1; o >= 0; o--)
            r[o] === n && r.splice(o, 1);
        }
    }), this;
  }
  /**
   * Invoke all of the callbacks bound to the event
   * with any arguments passed in.
   * @param  event  The name of the event.
   * @param args The arguments to pass to the functions listening.
   */
  emit(t, ...n) {
    if (this._events && this._events.hasOwnProperty(t)) {
      const s = this._events[t].slice(0);
      for (let i = 0, r = s.length; i < r; i++)
        s[i].apply(this, n);
    }
    return this;
  }
  /**
   * Add Emitter functions (on/off/emit) to the object
   */
  static mixin(t) {
    ["on", "once", "off", "emit"].forEach((n) => {
      const s = Object.getOwnPropertyDescriptor(ei.prototype, n);
      Object.defineProperty(t.prototype, n, s);
    });
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this._events = void 0, this;
  }
}
class Lc extends ei {
  constructor() {
    super(...arguments), this.isOffline = !1;
  }
  /*
   * This is a placeholder so that JSON.stringify does not throw an error
   * This matches what JSON.stringify(audioContext) returns on a native
   * audioContext instance.
   */
  toJSON() {
    return {};
  }
}
class ni extends Lc {
  constructor() {
    var t, n;
    super(), this.name = "Context", this._constants = /* @__PURE__ */ new Map(), this._timeouts = new $e(), this._timeoutIds = 0, this._initialized = !1, this._closeStarted = !1, this.isOffline = !1, this._workletPromise = null;
    const s = P(ni.getDefaults(), arguments, [
      "context"
    ]);
    s.context ? (this._context = s.context, this._latencyHint = ((t = arguments[0]) === null || t === void 0 ? void 0 : t.latencyHint) || "") : (this._context = f0({
      latencyHint: s.latencyHint
    }), this._latencyHint = s.latencyHint), this._ticker = new _0(this.emit.bind(this, "tick"), s.clockSource, s.updateInterval, this._context.sampleRate), this.on("tick", this._timeoutLoop.bind(this)), this._context.onstatechange = () => {
      this.emit("statechange", this.state);
    }, this[!((n = arguments[0]) === null || n === void 0) && n.hasOwnProperty("updateInterval") ? "_lookAhead" : "lookAhead"] = s.lookAhead;
  }
  static getDefaults() {
    return {
      clockSource: "worker",
      latencyHint: "interactive",
      lookAhead: 0.1,
      updateInterval: 0.05
    };
  }
  /**
   * Finish setting up the context. **You usually do not need to do this manually.**
   */
  initialize() {
    return this._initialized || (w0(this), this._initialized = !0), this;
  }
  //---------------------------
  // BASE AUDIO CONTEXT METHODS
  //---------------------------
  createAnalyser() {
    return this._context.createAnalyser();
  }
  createOscillator() {
    return this._context.createOscillator();
  }
  createBufferSource() {
    return this._context.createBufferSource();
  }
  createBiquadFilter() {
    return this._context.createBiquadFilter();
  }
  createBuffer(t, n, s) {
    return this._context.createBuffer(t, n, s);
  }
  createChannelMerger(t) {
    return this._context.createChannelMerger(t);
  }
  createChannelSplitter(t) {
    return this._context.createChannelSplitter(t);
  }
  createConstantSource() {
    return this._context.createConstantSource();
  }
  createConvolver() {
    return this._context.createConvolver();
  }
  createDelay(t) {
    return this._context.createDelay(t);
  }
  createDynamicsCompressor() {
    return this._context.createDynamicsCompressor();
  }
  createGain() {
    return this._context.createGain();
  }
  createIIRFilter(t, n) {
    return this._context.createIIRFilter(t, n);
  }
  createPanner() {
    return this._context.createPanner();
  }
  createPeriodicWave(t, n, s) {
    return this._context.createPeriodicWave(t, n, s);
  }
  createStereoPanner() {
    return this._context.createStereoPanner();
  }
  createWaveShaper() {
    return this._context.createWaveShaper();
  }
  createMediaStreamSource(t) {
    return st(Ms(this._context), "Not available if OfflineAudioContext"), this._context.createMediaStreamSource(t);
  }
  createMediaElementSource(t) {
    return st(Ms(this._context), "Not available if OfflineAudioContext"), this._context.createMediaElementSource(t);
  }
  createMediaStreamDestination() {
    return st(Ms(this._context), "Not available if OfflineAudioContext"), this._context.createMediaStreamDestination();
  }
  decodeAudioData(t) {
    return this._context.decodeAudioData(t);
  }
  /**
   * The current time in seconds of the AudioContext.
   */
  get currentTime() {
    return this._context.currentTime;
  }
  /**
   * The current time in seconds of the AudioContext.
   */
  get state() {
    return this._context.state;
  }
  /**
   * The current time in seconds of the AudioContext.
   */
  get sampleRate() {
    return this._context.sampleRate;
  }
  /**
   * The listener
   */
  get listener() {
    return this.initialize(), this._listener;
  }
  set listener(t) {
    st(!this._initialized, "The listener cannot be set after initialization."), this._listener = t;
  }
  /**
   * There is only one Transport per Context. It is created on initialization.
   */
  get transport() {
    return this.initialize(), this._transport;
  }
  set transport(t) {
    st(!this._initialized, "The transport cannot be set after initialization."), this._transport = t;
  }
  /**
   * This is the Draw object for the context which is useful for synchronizing the draw frame with the Tone.js clock.
   */
  get draw() {
    return this.initialize(), this._draw;
  }
  set draw(t) {
    st(!this._initialized, "Draw cannot be set after initialization."), this._draw = t;
  }
  /**
   * A reference to the Context's destination node.
   */
  get destination() {
    return this.initialize(), this._destination;
  }
  set destination(t) {
    st(!this._initialized, "The destination cannot be set after initialization."), this._destination = t;
  }
  /**
   * Create an audio worklet node from a name and options. The module
   * must first be loaded using {@link addAudioWorkletModule}.
   */
  createAudioWorkletNode(t, n) {
    return g0(this.rawContext, t, n);
  }
  /**
   * Add an AudioWorkletProcessor module
   * @param url The url of the module
   */
  addAudioWorkletModule(t) {
    return jt(this, void 0, void 0, function* () {
      st(bt(this.rawContext.audioWorklet), "AudioWorkletNode is only available in a secure context (https or localhost)"), this._workletPromise || (this._workletPromise = this.rawContext.audioWorklet.addModule(t)), yield this._workletPromise;
    });
  }
  /**
   * Returns a promise which resolves when all of the worklets have been loaded on this context
   */
  workletsAreReady() {
    return jt(this, void 0, void 0, function* () {
      (yield this._workletPromise) ? this._workletPromise : Promise.resolve();
    });
  }
  //---------------------------
  // TICKER
  //---------------------------
  /**
   * How often the interval callback is invoked.
   * This number corresponds to how responsive the scheduling
   * can be. Setting to 0 will result in the lowest practial interval
   * based on context properties. context.updateInterval + context.lookAhead
   * gives you the total latency between scheduling an event and hearing it.
   */
  get updateInterval() {
    return this._ticker.updateInterval;
  }
  set updateInterval(t) {
    this._ticker.updateInterval = t;
  }
  /**
   * What the source of the clock is, either "worker" (default),
   * "timeout", or "offline" (none).
   */
  get clockSource() {
    return this._ticker.type;
  }
  set clockSource(t) {
    this._ticker.type = t;
  }
  /**
   * The amount of time into the future events are scheduled. Giving Web Audio
   * a short amount of time into the future to schedule events can reduce clicks and
   * improve performance. This value can be set to 0 to get the lowest latency.
   * Adjusting this value also affects the {@link updateInterval}.
   */
  get lookAhead() {
    return this._lookAhead;
  }
  set lookAhead(t) {
    this._lookAhead = t, this.updateInterval = t ? t / 2 : 0.01;
  }
  /**
   * The type of playback, which affects tradeoffs between audio
   * output latency and responsiveness.
   * In addition to setting the value in seconds, the latencyHint also
   * accepts the strings "interactive" (prioritizes low latency),
   * "playback" (prioritizes sustained playback), "balanced" (balances
   * latency and performance).
   * @example
   * // prioritize sustained playback
   * const context = new Tone.Context({ latencyHint: "playback" });
   * // set this context as the global Context
   * Tone.setContext(context);
   * // the global context is gettable with Tone.getContext()
   * console.log(Tone.getContext().latencyHint);
   */
  get latencyHint() {
    return this._latencyHint;
  }
  /**
   * The unwrapped AudioContext or OfflineAudioContext
   */
  get rawContext() {
    return this._context;
  }
  /**
   * The current audio context time plus a short {@link lookAhead}.
   * @example
   * setInterval(() => {
   * 	console.log("now", Tone.now());
   * }, 100);
   */
  now() {
    return this._context.currentTime + this._lookAhead;
  }
  /**
   * The current audio context time without the {@link lookAhead}.
   * In most cases it is better to use {@link now} instead of {@link immediate} since
   * with {@link now} the {@link lookAhead} is applied equally to _all_ components including internal components,
   * to making sure that everything is scheduled in sync. Mixing {@link now} and {@link immediate}
   * can cause some timing issues. If no lookAhead is desired, you can set the {@link lookAhead} to `0`.
   */
  immediate() {
    return this._context.currentTime;
  }
  /**
   * Starts the audio context from a suspended state. This is required
   * to initially start the AudioContext.
   * @see {@link start}
   */
  resume() {
    return Ms(this._context) ? this._context.resume() : Promise.resolve();
  }
  /**
   * Close the context. Once closed, the context can no longer be used and
   * any AudioNodes created from the context will be silent.
   */
  close() {
    return jt(this, void 0, void 0, function* () {
      Ms(this._context) && this.state !== "closed" && !this._closeStarted && (this._closeStarted = !0, yield this._context.close()), this._initialized && C0(this);
    });
  }
  /**
   * **Internal** Generate a looped buffer at some constant value.
   */
  getConstant(t) {
    if (this._constants.has(t))
      return this._constants.get(t);
    {
      const n = this._context.createBuffer(1, 128, this._context.sampleRate), s = n.getChannelData(0);
      for (let r = 0; r < s.length; r++)
        s[r] = t;
      const i = this._context.createBufferSource();
      return i.channelCount = 1, i.channelCountMode = "explicit", i.buffer = n, i.loop = !0, i.start(0), this._constants.set(t, i), i;
    }
  }
  /**
   * Clean up. Also closes the audio context.
   */
  dispose() {
    return super.dispose(), this._ticker.dispose(), this._timeouts.dispose(), Object.keys(this._constants).map((t) => this._constants[t].disconnect()), this.close(), this;
  }
  //---------------------------
  // TIMEOUTS
  //---------------------------
  /**
   * The private loop which keeps track of the context scheduled timeouts
   * Is invoked from the clock source
   */
  _timeoutLoop() {
    const t = this.now();
    this._timeouts.forEachBefore(t, (n) => {
      n.callback(), this._timeouts.remove(n);
    });
  }
  /**
   * A setTimeout which is guaranteed by the clock source.
   * Also runs in the offline context.
   * @param  fn       The callback to invoke
   * @param  timeout  The timeout in seconds
   * @returns ID to use when invoking Context.clearTimeout
   */
  setTimeout(t, n) {
    this._timeoutIds++;
    const s = this.now();
    return this._timeouts.add({
      callback: t,
      id: this._timeoutIds,
      time: s + n
    }), this._timeoutIds;
  }
  /**
   * Clears a previously scheduled timeout with Tone.context.setTimeout
   * @param  id  The ID returned from setTimeout
   */
  clearTimeout(t) {
    return this._timeouts.forEach((n) => {
      n.id === t && this._timeouts.remove(n);
    }), this;
  }
  /**
   * Clear the function scheduled by {@link setInterval}
   */
  clearInterval(t) {
    return this.clearTimeout(t);
  }
  /**
   * Adds a repeating event to the context's callback clock
   */
  setInterval(t, n) {
    const s = ++this._timeoutIds, i = () => {
      const r = this.now();
      this._timeouts.add({
        callback: () => {
          t(), i();
        },
        id: s,
        time: r + n
      });
    };
    return i(), s;
  }
}
class S0 extends Lc {
  constructor() {
    super(...arguments), this.lookAhead = 0, this.latencyHint = 0, this.isOffline = !1;
  }
  //---------------------------
  // BASE AUDIO CONTEXT METHODS
  //---------------------------
  createAnalyser() {
    return {};
  }
  createOscillator() {
    return {};
  }
  createBufferSource() {
    return {};
  }
  createBiquadFilter() {
    return {};
  }
  createBuffer(t, n, s) {
    return {};
  }
  createChannelMerger(t) {
    return {};
  }
  createChannelSplitter(t) {
    return {};
  }
  createConstantSource() {
    return {};
  }
  createConvolver() {
    return {};
  }
  createDelay(t) {
    return {};
  }
  createDynamicsCompressor() {
    return {};
  }
  createGain() {
    return {};
  }
  createIIRFilter(t, n) {
    return {};
  }
  createPanner() {
    return {};
  }
  createPeriodicWave(t, n, s) {
    return {};
  }
  createStereoPanner() {
    return {};
  }
  createWaveShaper() {
    return {};
  }
  createMediaStreamSource(t) {
    return {};
  }
  createMediaElementSource(t) {
    return {};
  }
  createMediaStreamDestination() {
    return {};
  }
  decodeAudioData(t) {
    return Promise.resolve({});
  }
  //---------------------------
  // TONE AUDIO CONTEXT METHODS
  //---------------------------
  createAudioWorkletNode(t, n) {
    return {};
  }
  get rawContext() {
    return {};
  }
  addAudioWorkletModule(t) {
    return jt(this, void 0, void 0, function* () {
      return Promise.resolve();
    });
  }
  resume() {
    return Promise.resolve();
  }
  setTimeout(t, n) {
    return 0;
  }
  clearTimeout(t) {
    return this;
  }
  setInterval(t, n) {
    return 0;
  }
  clearInterval(t) {
    return this;
  }
  getConstant(t) {
    return {};
  }
  get currentTime() {
    return 0;
  }
  get state() {
    return {};
  }
  get sampleRate() {
    return 0;
  }
  get listener() {
    return {};
  }
  get transport() {
    return {};
  }
  get draw() {
    return {};
  }
  set draw(t) {
  }
  get destination() {
    return {};
  }
  set destination(t) {
  }
  now() {
    return 0;
  }
  immediate() {
    return 0;
  }
}
function ct(e, t) {
  _e(t) ? t.forEach((n) => ct(e, n)) : Object.defineProperty(e, t, {
    enumerable: !0,
    writable: !1
  });
}
function Xi(e, t) {
  _e(t) ? t.forEach((n) => Xi(e, n)) : Object.defineProperty(e, t, {
    writable: !0
  });
}
const St = () => {
};
class Rt extends Nn {
  constructor() {
    super(), this.name = "ToneAudioBuffer", this.onload = St;
    const t = P(Rt.getDefaults(), arguments, ["url", "onload", "onerror"]);
    this.reverse = t.reverse, this.onload = t.onload, an(t.url) ? this.load(t.url).catch(t.onerror) : t.url && this.set(t.url);
  }
  static getDefaults() {
    return {
      onerror: St,
      onload: St,
      reverse: !1
    };
  }
  /**
   * The sample rate of the AudioBuffer
   */
  get sampleRate() {
    return this._buffer ? this._buffer.sampleRate : It().sampleRate;
  }
  /**
   * Pass in an AudioBuffer or ToneAudioBuffer to set the value of this buffer.
   */
  set(t) {
    return t instanceof Rt ? t.loaded ? this._buffer = t.get() : t.onload = () => {
      this.set(t), this.onload(this);
    } : this._buffer = t, this._reversed && this._reverse(), this;
  }
  /**
   * The audio buffer stored in the object.
   */
  get() {
    return this._buffer;
  }
  /**
   * Makes an fetch request for the selected url then decodes the file as an audio buffer.
   * Invokes the callback once the audio buffer loads.
   * @param url The url of the buffer to load. filetype support depends on the browser.
   * @returns A Promise which resolves with this ToneAudioBuffer
   */
  load(t) {
    return jt(this, void 0, void 0, function* () {
      const n = Rt.load(t).then((s) => {
        this.set(s), this.onload(this);
      });
      Rt.downloads.push(n);
      try {
        yield n;
      } finally {
        const s = Rt.downloads.indexOf(n);
        Rt.downloads.splice(s, 1);
      }
      return this;
    });
  }
  /**
   * clean up
   */
  dispose() {
    return super.dispose(), this._buffer = void 0, this;
  }
  /**
   * Set the audio buffer from the array.
   * To create a multichannel AudioBuffer, pass in a multidimensional array.
   * @param array The array to fill the audio buffer
   */
  fromArray(t) {
    const n = _e(t) && t[0].length > 0, s = n ? t.length : 1, i = n ? t[0].length : t.length, r = It(), o = r.createBuffer(s, i, r.sampleRate), a = !n && s === 1 ? [t] : t;
    for (let c = 0; c < s; c++)
      o.copyToChannel(a[c], c);
    return this._buffer = o, this;
  }
  /**
   * Sums multiple channels into 1 channel
   * @param chanNum Optionally only copy a single channel from the array.
   */
  toMono(t) {
    if (ze(t))
      this.fromArray(this.toArray(t));
    else {
      let n = new Float32Array(this.length);
      const s = this.numberOfChannels;
      for (let i = 0; i < s; i++) {
        const r = this.toArray(i);
        for (let o = 0; o < r.length; o++)
          n[o] += r[o];
      }
      n = n.map((i) => i / s), this.fromArray(n);
    }
    return this;
  }
  /**
   * Get the buffer as an array. Single channel buffers will return a 1-dimensional
   * Float32Array, and multichannel buffers will return multidimensional arrays.
   * @param channel Optionally only copy a single channel from the array.
   */
  toArray(t) {
    if (ze(t))
      return this.getChannelData(t);
    if (this.numberOfChannels === 1)
      return this.toArray(0);
    {
      const n = [];
      for (let s = 0; s < this.numberOfChannels; s++)
        n[s] = this.getChannelData(s);
      return n;
    }
  }
  /**
   * Returns the Float32Array representing the PCM audio data for the specific channel.
   * @param  channel  The channel number to return
   * @return The audio as a TypedArray
   */
  getChannelData(t) {
    return this._buffer ? this._buffer.getChannelData(t) : new Float32Array(0);
  }
  /**
   * Cut a subsection of the array and return a buffer of the
   * subsection. Does not modify the original buffer
   * @param start The time to start the slice
   * @param end The end time to slice. If none is given will default to the end of the buffer
   */
  slice(t, n = this.duration) {
    st(this.loaded, "Buffer is not loaded");
    const s = Math.floor(t * this.sampleRate), i = Math.floor(n * this.sampleRate);
    st(s < i, "The start time must be less than the end time");
    const r = i - s, o = It().createBuffer(this.numberOfChannels, r, this.sampleRate);
    for (let a = 0; a < this.numberOfChannels; a++)
      o.copyToChannel(this.getChannelData(a).subarray(s, i), a);
    return new Rt(o);
  }
  /**
   * Reverse the buffer.
   */
  _reverse() {
    if (this.loaded)
      for (let t = 0; t < this.numberOfChannels; t++)
        this.getChannelData(t).reverse();
    return this;
  }
  /**
   * If the buffer is loaded or not
   */
  get loaded() {
    return this.length > 0;
  }
  /**
   * The duration of the buffer in seconds.
   */
  get duration() {
    return this._buffer ? this._buffer.duration : 0;
  }
  /**
   * The length of the buffer in samples
   */
  get length() {
    return this._buffer ? this._buffer.length : 0;
  }
  /**
   * The number of discrete audio channels. Returns 0 if no buffer is loaded.
   */
  get numberOfChannels() {
    return this._buffer ? this._buffer.numberOfChannels : 0;
  }
  /**
   * Reverse the buffer.
   */
  get reverse() {
    return this._reversed;
  }
  set reverse(t) {
    this._reversed !== t && (this._reversed = t, this._reverse());
  }
  /**
   * Create a ToneAudioBuffer from the array. To create a multichannel AudioBuffer,
   * pass in a multidimensional array.
   * @param array The array to fill the audio buffer
   * @return A ToneAudioBuffer created from the array
   */
  static fromArray(t) {
    return new Rt().fromArray(t);
  }
  /**
   * Creates a ToneAudioBuffer from a URL, returns a promise which resolves to a ToneAudioBuffer
   * @param  url The url to load.
   * @return A promise which resolves to a ToneAudioBuffer
   */
  static fromUrl(t) {
    return jt(this, void 0, void 0, function* () {
      return yield new Rt().load(t);
    });
  }
  /**
   * Loads a url using fetch and returns the AudioBuffer.
   */
  static load(t) {
    return jt(this, void 0, void 0, function* () {
      const n = Rt.baseUrl === "" || Rt.baseUrl.endsWith("/") ? Rt.baseUrl : Rt.baseUrl + "/", s = yield fetch(n + t);
      if (!s.ok)
        throw new Error(`could not load url: ${t}`);
      const i = yield s.arrayBuffer();
      return yield It().decodeAudioData(i);
    });
  }
  /**
   * Checks a url's extension to see if the current browser can play that file type.
   * @param url The url/extension to test
   * @return If the file extension can be played
   * @static
   * @example
   * Tone.ToneAudioBuffer.supportsType("wav"); // returns true
   * Tone.ToneAudioBuffer.supportsType("path/to/file.wav"); // returns true
   */
  static supportsType(t) {
    const n = t.split("."), s = n[n.length - 1];
    return document.createElement("audio").canPlayType("audio/" + s) !== "";
  }
  /**
   * Returns a Promise which resolves when all of the buffers have loaded
   */
  static loaded() {
    return jt(this, void 0, void 0, function* () {
      for (yield Promise.resolve(); Rt.downloads.length; )
        yield Rt.downloads[0];
    });
  }
}
Rt.baseUrl = "";
Rt.downloads = [];
class si extends ni {
  constructor() {
    super({
      clockSource: "offline",
      context: Or(arguments[0]) ? arguments[0] : p0(arguments[0], arguments[1] * arguments[2], arguments[2]),
      lookAhead: 0,
      updateInterval: Or(arguments[0]) ? 128 / arguments[0].sampleRate : 128 / arguments[2]
    }), this.name = "OfflineContext", this._currentTime = 0, this.isOffline = !0, this._duration = Or(arguments[0]) ? arguments[0].length / arguments[0].sampleRate : arguments[1];
  }
  /**
   * Override the now method to point to the internal clock time
   */
  now() {
    return this._currentTime;
  }
  /**
   * Same as this.now()
   */
  get currentTime() {
    return this._currentTime;
  }
  /**
   * Render just the clock portion of the audio context.
   */
  _renderClock(t) {
    return jt(this, void 0, void 0, function* () {
      let n = 0;
      for (; this._duration - this._currentTime >= 0; ) {
        this.emit("tick"), this._currentTime += 128 / this.sampleRate, n++;
        const s = Math.floor(this.sampleRate / 128);
        t && n % s === 0 && (yield new Promise((i) => setTimeout(i, 1)));
      }
    });
  }
  /**
   * Render the output of the OfflineContext
   * @param asynchronous If the clock should be rendered asynchronously, which will not block the main thread, but be slightly slower.
   */
  render() {
    return jt(this, arguments, void 0, function* (t = !0) {
      yield this.workletsAreReady(), yield this._renderClock(t);
      const n = yield this._context.startRendering();
      return new Rt(n);
    });
  }
  /**
   * Close the context
   */
  close() {
    return Promise.resolve();
  }
}
const Gd = new S0();
let hs = Gd;
function It() {
  return hs === Gd && m0 && Mi(new ni()), hs;
}
function Mi(e, t = !1) {
  t && hs.dispose(), Ms(e) ? hs = new ni(e) : Or(e) ? hs = new si(e) : hs = e;
}
function Bc() {
  return hs.resume();
}
if (De && !De.TONE_SILENCE_LOGGING) {
  const t = ` * Tone.js v${_c} * `;
  console.log(`%c${t}`, "background: #000; color: #fff");
}
function qs(e) {
  return Math.pow(10, e / 20);
}
function Ui(e) {
  return 20 * (Math.log(e) / Math.LN10);
}
function zs(e) {
  return Math.pow(2, e / 12);
}
let fo = 440;
function T0() {
  return fo;
}
function A0(e) {
  fo = e;
}
function Zn(e) {
  return Math.round(Zd(e));
}
function Zd(e) {
  return 69 + 12 * Math.log2(e / fo);
}
function $c(e) {
  return fo * Math.pow(2, (e - 69) / 12);
}
class qc extends Nn {
  /**
   * @param context The context associated with the time value. Used to compute
   * Transport and context-relative timing.
   * @param  value  The time value as a number, string or object
   * @param  units  Unit values
   */
  constructor(t, n, s) {
    super(), this.defaultUnits = "s", this._val = n, this._units = s, this.context = t, this._expressions = this._getExpressions();
  }
  /**
   * All of the time encoding expressions
   */
  _getExpressions() {
    return {
      hz: {
        method: (t) => this._frequencyToUnits(parseFloat(t)),
        regexp: /^(\d+(?:\.\d+)?)hz$/i
      },
      i: {
        method: (t) => this._ticksToUnits(parseInt(t, 10)),
        regexp: /^(\d+)i$/i
      },
      m: {
        method: (t) => this._beatsToUnits(parseInt(t, 10) * this._getTimeSignature()),
        regexp: /^(\d+)m$/i
      },
      n: {
        method: (t, n) => {
          const s = parseInt(t, 10), i = n === "." ? 1.5 : 1;
          return s === 1 ? this._beatsToUnits(this._getTimeSignature()) * i : this._beatsToUnits(4 / s) * i;
        },
        regexp: /^(\d+)n(\.?)$/i
      },
      number: {
        method: (t) => this._expressions[this.defaultUnits].method.call(this, t),
        regexp: /^(\d+(?:\.\d+)?)$/
      },
      s: {
        method: (t) => this._secondsToUnits(parseFloat(t)),
        regexp: /^(\d+(?:\.\d+)?)s$/
      },
      samples: {
        method: (t) => parseInt(t, 10) / this.context.sampleRate,
        regexp: /^(\d+)samples$/
      },
      t: {
        method: (t) => {
          const n = parseInt(t, 10);
          return this._beatsToUnits(8 / (Math.floor(n) * 3));
        },
        regexp: /^(\d+)t$/i
      },
      tr: {
        method: (t, n, s) => {
          let i = 0;
          return t && t !== "0" && (i += this._beatsToUnits(this._getTimeSignature() * parseFloat(t))), n && n !== "0" && (i += this._beatsToUnits(parseFloat(n))), s && s !== "0" && (i += this._beatsToUnits(parseFloat(s) / 4)), i;
        },
        regexp: /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):?(\d+(?:\.\d+)?)?$/
      }
    };
  }
  //-------------------------------------
  // 	VALUE OF
  //-------------------------------------
  /**
   * Evaluate the time value. Returns the time in seconds.
   */
  valueOf() {
    if (this._val instanceof qc && this.fromType(this._val), We(this._val))
      return this._noArg();
    if (an(this._val) && We(this._units)) {
      for (const t in this._expressions)
        if (this._expressions[t].regexp.test(this._val.trim())) {
          this._units = t;
          break;
        }
    } else if (Dn(this._val)) {
      let t = 0;
      for (const n in this._val)
        if (bt(this._val[n])) {
          const s = this._val[n], i = (
            // @ts-ignore
            new this.constructor(this.context, n).valueOf() * s
          );
          t += i;
        }
      return t;
    }
    if (bt(this._units)) {
      const t = this._expressions[this._units], n = this._val.toString().trim().match(t.regexp);
      return n ? t.method.apply(this, n.slice(1)) : t.method.call(this, this._val);
    } else return an(this._val) ? parseFloat(this._val) : this._val;
  }
  //-------------------------------------
  // 	UNIT CONVERSIONS
  //-------------------------------------
  /**
   * Returns the value of a frequency in the current units
   */
  _frequencyToUnits(t) {
    return 1 / t;
  }
  /**
   * Return the value of the beats in the current units
   */
  _beatsToUnits(t) {
    return 60 / this._getBpm() * t;
  }
  /**
   * Returns the value of a second in the current units
   */
  _secondsToUnits(t) {
    return t;
  }
  /**
   * Returns the value of a tick in the current time units
   */
  _ticksToUnits(t) {
    return t * this._beatsToUnits(1) / this._getPPQ();
  }
  /**
   * With no arguments, return 'now'
   */
  _noArg() {
    return this._now();
  }
  //-------------------------------------
  // 	TEMPO CONVERSIONS
  //-------------------------------------
  /**
   * Return the bpm
   */
  _getBpm() {
    return this.context.transport.bpm.value;
  }
  /**
   * Return the timeSignature
   */
  _getTimeSignature() {
    return this.context.transport.timeSignature;
  }
  /**
   * Return the PPQ or 192 if Transport is not available
   */
  _getPPQ() {
    return this.context.transport.PPQ;
  }
  //-------------------------------------
  // 	CONVERSION INTERFACE
  //-------------------------------------
  /**
   * Coerce a time type into this units type.
   * @param type Any time type units
   */
  fromType(t) {
    switch (this._units = void 0, this.defaultUnits) {
      case "s":
        this._val = t.toSeconds();
        break;
      case "i":
        this._val = t.toTicks();
        break;
      case "hz":
        this._val = t.toFrequency();
        break;
      case "midi":
        this._val = t.toMidi();
        break;
    }
    return this;
  }
  /**
   * Return the value in hertz
   */
  toFrequency() {
    return 1 / this.toSeconds();
  }
  /**
   * Return the time in samples
   */
  toSamples() {
    return this.toSeconds() * this.context.sampleRate;
  }
  /**
   * Return the time in milliseconds.
   */
  toMilliseconds() {
    return this.toSeconds() * 1e3;
  }
}
class Le extends qc {
  constructor() {
    super(...arguments), this.name = "TimeClass";
  }
  _getExpressions() {
    return Object.assign(super._getExpressions(), {
      now: {
        method: (t) => this._now() + new this.constructor(this.context, t).valueOf(),
        regexp: /^\+(.+)/
      },
      quantize: {
        method: (t) => {
          const n = new Le(this.context, t).valueOf();
          return this._secondsToUnits(this.context.transport.nextSubdivision(n));
        },
        regexp: /^@(.+)/
      }
    });
  }
  /**
   * Quantize the time by the given subdivision. Optionally add a
   * percentage which will move the time value towards the ideal
   * quantized value by that percentage.
   * @param  subdiv    The subdivision to quantize to
   * @param  percent  Move the time value towards the quantized value by a percentage.
   * @example
   * Tone.Time(21).quantize(2); // returns 22
   * Tone.Time(0.6).quantize("4n", 0.5); // returns 0.55
   */
  quantize(t, n = 1) {
    const s = new this.constructor(this.context, t).valueOf(), i = this.valueOf(), a = Math.round(i / s) * s - i;
    return i + a * n;
  }
  //-------------------------------------
  // CONVERSIONS
  //-------------------------------------
  /**
   * Convert a Time to Notation. The notation values are will be the
   * closest representation between 1m to 128th note.
   * @return {Notation}
   * @example
   * // if the Transport is at 120bpm:
   * Tone.Time(2).toNotation(); // returns "1m"
   */
  toNotation() {
    const t = this.toSeconds(), n = ["1m"];
    for (let r = 1; r < 9; r++) {
      const o = Math.pow(2, r);
      n.push(o + "n."), n.push(o + "n"), n.push(o + "t");
    }
    n.push("0");
    let s = n[0], i = new Le(this.context, n[0]).toSeconds();
    return n.forEach((r) => {
      const o = new Le(this.context, r).toSeconds();
      Math.abs(o - t) < Math.abs(i - t) && (s = r, i = o);
    }), s;
  }
  /**
   * Return the time encoded as Bars:Beats:Sixteenths.
   */
  toBarsBeatsSixteenths() {
    const t = this._beatsToUnits(1);
    let n = this.valueOf() / t;
    n = parseFloat(n.toFixed(4));
    const s = Math.floor(n / this._getTimeSignature());
    let i = n % 1 * 4;
    n = Math.floor(n) % this._getTimeSignature();
    const r = i.toString();
    return r.length > 3 && (i = parseFloat(parseFloat(r).toFixed(3))), [s, n, i].join(":");
  }
  /**
   * Return the time in ticks.
   */
  toTicks() {
    const t = this._beatsToUnits(1);
    return this.valueOf() / t * this._getPPQ();
  }
  /**
   * Return the time in seconds.
   */
  toSeconds() {
    return this.valueOf();
  }
  /**
   * Return the value as a midi note.
   */
  toMidi() {
    return Zn(this.toFrequency());
  }
  _now() {
    return this.context.now();
  }
}
function k0(e, t) {
  return new Le(It(), e, t);
}
class Oe extends Le {
  constructor() {
    super(...arguments), this.name = "Frequency", this.defaultUnits = "hz";
  }
  /**
   * The [concert tuning pitch](https://en.wikipedia.org/wiki/Concert_pitch) which is used
   * to generate all the other pitch values from notes. A4's values in Hertz.
   */
  static get A4() {
    return T0();
  }
  static set A4(t) {
    A0(t);
  }
  //-------------------------------------
  // 	AUGMENT BASE EXPRESSIONS
  //-------------------------------------
  _getExpressions() {
    return Object.assign({}, super._getExpressions(), {
      midi: {
        regexp: /^(\d+(?:\.\d+)?midi)/,
        method(t) {
          return this.defaultUnits === "midi" ? t : Oe.mtof(t);
        }
      },
      note: {
        regexp: /^([a-g]{1}(?:b|#|##|x|bb|###|#x|x#|bbb)?)(-?[0-9]+)/i,
        method(t, n) {
          const i = I0[t.toLowerCase()] + (parseInt(n, 10) + 1) * 12;
          return this.defaultUnits === "midi" ? i : Oe.mtof(i);
        }
      },
      tr: {
        regexp: /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):?(\d+(?:\.\d+)?)?/,
        method(t, n, s) {
          let i = 1;
          return t && t !== "0" && (i *= this._beatsToUnits(this._getTimeSignature() * parseFloat(t))), n && n !== "0" && (i *= this._beatsToUnits(parseFloat(n))), s && s !== "0" && (i *= this._beatsToUnits(parseFloat(s) / 4)), i;
        }
      }
    });
  }
  //-------------------------------------
  // 	EXPRESSIONS
  //-------------------------------------
  /**
   * Transposes the frequency by the given number of semitones.
   * @return  A new transposed frequency
   * @example
   * Tone.Frequency("A4").transpose(3); // "C5"
   */
  transpose(t) {
    return new Oe(this.context, this.valueOf() * zs(t));
  }
  /**
   * Takes an array of semitone intervals and returns
   * an array of frequencies transposed by those intervals.
   * @return  Returns an array of Frequencies
   * @example
   * Tone.Frequency("A4").harmonize([0, 3, 7]); // ["A4", "C5", "E5"]
   */
  harmonize(t) {
    return t.map((n) => this.transpose(n));
  }
  //-------------------------------------
  // 	UNIT CONVERSIONS
  //-------------------------------------
  /**
   * Return the value of the frequency as a MIDI note
   * @example
   * Tone.Frequency("C4").toMidi(); // 60
   */
  toMidi() {
    return Zn(this.valueOf());
  }
  /**
   * Return the value of the frequency in Scientific Pitch Notation
   * @example
   * Tone.Frequency(69, "midi").toNote(); // "A4"
   */
  toNote() {
    const t = this.toFrequency(), n = Math.log2(t / Oe.A4);
    let s = Math.round(12 * n) + 57;
    const i = Math.floor(s / 12);
    return i < 0 && (s += -12 * i), E0[s % 12] + i.toString();
  }
  /**
   * Return the duration of one cycle in seconds.
   */
  toSeconds() {
    return 1 / super.toSeconds();
  }
  /**
   * Return the duration of one cycle in ticks
   */
  toTicks() {
    const t = this._beatsToUnits(1), n = this.valueOf() / t;
    return Math.floor(n * this._getPPQ());
  }
  //-------------------------------------
  // 	UNIT CONVERSIONS HELPERS
  //-------------------------------------
  /**
   * With no arguments, return 0
   */
  _noArg() {
    return 0;
  }
  /**
   * Returns the value of a frequency in the current units
   */
  _frequencyToUnits(t) {
    return t;
  }
  /**
   * Returns the value of a tick in the current time units
   */
  _ticksToUnits(t) {
    return 1 / (t * 60 / (this._getBpm() * this._getPPQ()));
  }
  /**
   * Return the value of the beats in the current units
   */
  _beatsToUnits(t) {
    return 1 / super._beatsToUnits(t);
  }
  /**
   * Returns the value of a second in the current units
   */
  _secondsToUnits(t) {
    return 1 / t;
  }
  /**
   * Convert a MIDI note to frequency value.
   * @param  midi The midi number to convert.
   * @return The corresponding frequency value
   */
  static mtof(t) {
    return $c(t);
  }
  /**
   * Convert a frequency value to a MIDI note.
   * @param frequency The value to frequency value to convert.
   */
  static ftom(t) {
    return Zn(t);
  }
}
const I0 = {
  cbbb: -3,
  cbb: -2,
  cb: -1,
  c: 0,
  "c#": 1,
  cx: 2,
  "c##": 2,
  "c###": 3,
  "cx#": 3,
  "c#x": 3,
  dbbb: -1,
  dbb: 0,
  db: 1,
  d: 2,
  "d#": 3,
  dx: 4,
  "d##": 4,
  "d###": 5,
  "dx#": 5,
  "d#x": 5,
  ebbb: 1,
  ebb: 2,
  eb: 3,
  e: 4,
  "e#": 5,
  ex: 6,
  "e##": 6,
  "e###": 7,
  "ex#": 7,
  "e#x": 7,
  fbbb: 2,
  fbb: 3,
  fb: 4,
  f: 5,
  "f#": 6,
  fx: 7,
  "f##": 7,
  "f###": 8,
  "fx#": 8,
  "f#x": 8,
  gbbb: 4,
  gbb: 5,
  gb: 6,
  g: 7,
  "g#": 8,
  gx: 9,
  "g##": 9,
  "g###": 10,
  "gx#": 10,
  "g#x": 10,
  abbb: 6,
  abb: 7,
  ab: 8,
  a: 9,
  "a#": 10,
  ax: 11,
  "a##": 11,
  "a###": 12,
  "ax#": 12,
  "a#x": 12,
  bbbb: 8,
  bbb: 9,
  bb: 10,
  b: 11,
  "b#": 12,
  bx: 13,
  "b##": 13,
  "b###": 14,
  "bx#": 14,
  "b#x": 14
}, E0 = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B"
];
function D0(e, t) {
  return new Oe(It(), e, t);
}
class re extends Le {
  constructor() {
    super(...arguments), this.name = "TransportTime";
  }
  /**
   * Return the current time in whichever context is relevant
   */
  _now() {
    return this.context.transport.seconds;
  }
}
function R0(e, t) {
  return new re(It(), e, t);
}
class he extends Nn {
  constructor() {
    super();
    const t = P(he.getDefaults(), arguments, ["context"]);
    this.defaultContext ? this.context = this.defaultContext : this.context = t.context;
  }
  static getDefaults() {
    return {
      context: It()
    };
  }
  /**
   * Return the current time of the Context clock plus the lookAhead.
   * @example
   * setInterval(() => {
   * 	console.log(Tone.now());
   * }, 100);
   */
  now() {
    return this.context.currentTime + this.context.lookAhead;
  }
  /**
   * Return the current time of the Context clock without any lookAhead.
   * @example
   * setInterval(() => {
   * 	console.log(Tone.immediate());
   * }, 100);
   */
  immediate() {
    return this.context.currentTime;
  }
  /**
   * The duration in seconds of one sample.
   */
  get sampleTime() {
    return 1 / this.context.sampleRate;
  }
  /**
   * The number of seconds of 1 processing block (128 samples)
   * @example
   * console.log(Tone.Destination.blockTime);
   */
  get blockTime() {
    return 128 / this.context.sampleRate;
  }
  /**
   * Convert the incoming time to seconds.
   * This is calculated against the current {@link TransportClass} bpm
   * @example
   * const gain = new Tone.Gain();
   * setInterval(() => console.log(gain.toSeconds("4n")), 100);
   * // ramp the tempo to 60 bpm over 30 seconds
   * Tone.getTransport().bpm.rampTo(60, 30);
   */
  toSeconds(t) {
    return Bd(t), new Le(this.context, t).toSeconds();
  }
  /**
   * Convert the input to a frequency number
   * @example
   * const gain = new Tone.Gain();
   * console.log(gain.toFrequency("4n"));
   */
  toFrequency(t) {
    return new Oe(this.context, t).toFrequency();
  }
  /**
   * Convert the input time into ticks
   * @example
   * const gain = new Tone.Gain();
   * console.log(gain.toTicks("4n"));
   */
  toTicks(t) {
    return new re(this.context, t).toTicks();
  }
  //-------------------------------------
  // 	GET/SET
  //-------------------------------------
  /**
   * Get a subset of the properties which are in the partial props
   */
  _getPartialProperties(t) {
    const n = this.get();
    return Object.keys(n).forEach((s) => {
      We(t[s]) && delete n[s];
    }), n;
  }
  /**
   * Get the object's attributes.
   * @example
   * const osc = new Tone.Oscillator();
   * console.log(osc.get());
   */
  get() {
    const t = x0(this);
    return Object.keys(t).forEach((n) => {
      if (Reflect.has(this, n)) {
        const s = this[n];
        bt(s) && bt(s.value) && bt(s.setValueAtTime) ? t[n] = s.value : s instanceof he ? t[n] = s._getPartialProperties(t[n]) : _e(s) || ze(s) || an(s) || Nc(s) ? t[n] = s : delete t[n];
      }
    }), t;
  }
  /**
   * Set multiple properties at once with an object.
   * @example
   * const filter = new Tone.Filter().toDestination();
   * // set values using an object
   * filter.set({
   * 	frequency: "C6",
   * 	type: "highpass"
   * });
   * const player = new Tone.Player("https://tonejs.github.io/audio/berklee/Analogsynth_octaves_highmid.mp3").connect(filter);
   * player.autostart = true;
   */
  set(t) {
    return Object.keys(t).forEach((n) => {
      Reflect.has(this, n) && bt(this[n]) && (this[n] && bt(this[n].value) && bt(this[n].setValueAtTime) ? this[n].value !== t[n] && (this[n].value = t[n]) : this[n] instanceof he ? this[n].set(t[n]) : this[n] = t[n]);
    }), this;
  }
}
class ii extends $e {
  constructor(t = "stopped") {
    super(), this.name = "StateTimeline", this._initial = t, this.setStateAtTime(this._initial, 0);
  }
  /**
   * Returns the scheduled state scheduled before or at
   * the given time.
   * @param  time  The time to query.
   * @return  The name of the state input in setStateAtTime.
   */
  getValueAtTime(t) {
    const n = this.get(t);
    return n !== null ? n.state : this._initial;
  }
  /**
   * Add a state to the timeline.
   * @param  state The name of the state to set.
   * @param  time  The time to query.
   * @param options Any additional options that are needed in the timeline.
   */
  setStateAtTime(t, n, s) {
    return oe(n, 0), this.add(Object.assign({}, s, {
      state: t,
      time: n
    })), this;
  }
  /**
   * Return the event before the time with the given state
   * @param  state The state to look for
   * @param  time  When to check before
   * @return  The event with the given state before the time
   */
  getLastState(t, n) {
    const s = this._search(n);
    for (let i = s; i >= 0; i--) {
      const r = this._timeline[i];
      if (r.state === t)
        return r;
    }
  }
  /**
   * Return the event after the time with the given state
   * @param  state The state to look for
   * @param  time  When to check from
   * @return  The event with the given state after the time
   */
  getNextState(t, n) {
    const s = this._search(n);
    if (s !== -1)
      for (let i = s; i < this._timeline.length; i++) {
        const r = this._timeline[i];
        if (r.state === t)
          return r;
      }
  }
}
class gt extends he {
  constructor() {
    const t = P(gt.getDefaults(), arguments, [
      "param",
      "units",
      "convert"
    ]);
    for (super(t), this.name = "Param", this.overridden = !1, this._minOutput = 1e-7, st(bt(t.param) && (gs(t.param) || t.param instanceof gt), "param must be an AudioParam"); !gs(t.param); )
      t.param = t.param._param;
    this._swappable = bt(t.swappable) ? t.swappable : !1, this._swappable ? (this.input = this.context.createGain(), this._param = t.param, this.input.connect(this._param)) : this._param = this.input = t.param, this._events = new $e(1e3), this._initialValue = this._param.defaultValue, this.units = t.units, this.convert = t.convert, this._minValue = t.minValue, this._maxValue = t.maxValue, bt(t.value) && t.value !== this._toType(this._initialValue) && this.setValueAtTime(t.value, 0);
  }
  static getDefaults() {
    return Object.assign(he.getDefaults(), {
      convert: !0,
      units: "number"
    });
  }
  get value() {
    const t = this.now();
    return this.getValueAtTime(t);
  }
  set value(t) {
    this.cancelScheduledValues(this.now()), this.setValueAtTime(t, this.now());
  }
  get minValue() {
    return bt(this._minValue) ? this._minValue : this.units === "time" || this.units === "frequency" || this.units === "normalRange" || this.units === "positive" || this.units === "transportTime" || this.units === "ticks" || this.units === "bpm" || this.units === "hertz" || this.units === "samples" ? 0 : this.units === "audioRange" ? -1 : this.units === "decibels" ? -1 / 0 : this._param.minValue;
  }
  get maxValue() {
    return bt(this._maxValue) ? this._maxValue : this.units === "normalRange" || this.units === "audioRange" ? 1 : this._param.maxValue;
  }
  /**
   * Type guard based on the unit name
   */
  _is(t, n) {
    return this.units === n;
  }
  /**
   * Make sure the value is always in the defined range
   */
  _assertRange(t) {
    return bt(this.maxValue) && bt(this.minValue) && oe(t, this._fromType(this.minValue), this._fromType(this.maxValue)), t;
  }
  /**
   * Convert the given value from the type specified by Param.units
   * into the destination value (such as Gain or Frequency).
   */
  _fromType(t) {
    return this.convert && !this.overridden ? this._is(t, "time") ? this.toSeconds(t) : this._is(t, "decibels") ? qs(t) : this._is(t, "frequency") ? this.toFrequency(t) : t : this.overridden ? 0 : t;
  }
  /**
   * Convert the parameters value into the units specified by Param.units.
   */
  _toType(t) {
    return this.convert && this.units === "decibels" ? Ui(t) : t;
  }
  //-------------------------------------
  // ABSTRACT PARAM INTERFACE
  // all docs are generated from ParamInterface.ts
  //-------------------------------------
  setValueAtTime(t, n) {
    const s = this.toSeconds(n), i = this._fromType(t);
    return st(isFinite(i) && isFinite(s), `Invalid argument(s) to setValueAtTime: ${JSON.stringify(t)}, ${JSON.stringify(n)}`), this._assertRange(i), this.log(this.units, "setValueAtTime", t, s), this._events.add({
      time: s,
      type: "setValueAtTime",
      value: i
    }), this._param.setValueAtTime(i, s), this;
  }
  getValueAtTime(t) {
    const n = Math.max(this.toSeconds(t), 0), s = this._events.getAfter(n), i = this._events.get(n);
    let r = this._initialValue;
    if (i === null)
      r = this._initialValue;
    else if (i.type === "setTargetAtTime" && (s === null || s.type === "setValueAtTime")) {
      const o = this._events.getBefore(i.time);
      let a;
      o === null ? a = this._initialValue : a = o.value, i.type === "setTargetAtTime" && (r = this._exponentialApproach(i.time, a, i.value, i.constant, n));
    } else if (s === null)
      r = i.value;
    else if (s.type === "linearRampToValueAtTime" || s.type === "exponentialRampToValueAtTime") {
      let o = i.value;
      if (i.type === "setTargetAtTime") {
        const a = this._events.getBefore(i.time);
        a === null ? o = this._initialValue : o = a.value;
      }
      s.type === "linearRampToValueAtTime" ? r = this._linearInterpolate(i.time, o, s.time, s.value, n) : r = this._exponentialInterpolate(i.time, o, s.time, s.value, n);
    } else
      r = i.value;
    return this._toType(r);
  }
  setRampPoint(t) {
    t = this.toSeconds(t);
    let n = this.getValueAtTime(t);
    return this.cancelAndHoldAtTime(t), this._fromType(n) === 0 && (n = this._toType(this._minOutput)), this.setValueAtTime(n, t), this;
  }
  linearRampToValueAtTime(t, n) {
    const s = this._fromType(t), i = this.toSeconds(n);
    return st(isFinite(s) && isFinite(i), `Invalid argument(s) to linearRampToValueAtTime: ${JSON.stringify(t)}, ${JSON.stringify(n)}`), this._assertRange(s), this._events.add({
      time: i,
      type: "linearRampToValueAtTime",
      value: s
    }), this.log(this.units, "linearRampToValueAtTime", t, i), this._param.linearRampToValueAtTime(s, i), this;
  }
  exponentialRampToValueAtTime(t, n) {
    let s = this._fromType(t);
    s = sn(s, 0) ? this._minOutput : s, this._assertRange(s);
    const i = this.toSeconds(n);
    return st(isFinite(s) && isFinite(i), `Invalid argument(s) to exponentialRampToValueAtTime: ${JSON.stringify(t)}, ${JSON.stringify(n)}`), this._events.add({
      time: i,
      type: "exponentialRampToValueAtTime",
      value: s
    }), this.log(this.units, "exponentialRampToValueAtTime", t, i), this._param.exponentialRampToValueAtTime(s, i), this;
  }
  exponentialRampTo(t, n, s) {
    return s = this.toSeconds(s), this.setRampPoint(s), this.exponentialRampToValueAtTime(t, s + this.toSeconds(n)), this;
  }
  linearRampTo(t, n, s) {
    return s = this.toSeconds(s), this.setRampPoint(s), this.linearRampToValueAtTime(t, s + this.toSeconds(n)), this;
  }
  targetRampTo(t, n, s) {
    return s = this.toSeconds(s), this.setRampPoint(s), this.exponentialApproachValueAtTime(t, s, n), this;
  }
  exponentialApproachValueAtTime(t, n, s) {
    n = this.toSeconds(n), s = this.toSeconds(s);
    const i = Math.log(s + 1) / Math.log(200);
    return this.setTargetAtTime(t, n, i), this.cancelAndHoldAtTime(n + s * 0.9), this.linearRampToValueAtTime(t, n + s), this;
  }
  setTargetAtTime(t, n, s) {
    const i = this._fromType(t);
    st(isFinite(s) && s > 0, "timeConstant must be a number greater than 0");
    const r = this.toSeconds(n);
    return this._assertRange(i), st(isFinite(i) && isFinite(r), `Invalid argument(s) to setTargetAtTime: ${JSON.stringify(t)}, ${JSON.stringify(n)}`), this._events.add({
      constant: s,
      time: r,
      type: "setTargetAtTime",
      value: i
    }), this.log(this.units, "setTargetAtTime", t, r, s), this._param.setTargetAtTime(i, r, s), this;
  }
  setValueCurveAtTime(t, n, s, i = 1) {
    s = this.toSeconds(s), n = this.toSeconds(n);
    const r = this._fromType(t[0]) * i;
    this.setValueAtTime(this._toType(r), n);
    const o = s / (t.length - 1);
    for (let a = 1; a < t.length; a++) {
      const c = this._fromType(t[a]) * i;
      this.linearRampToValueAtTime(this._toType(c), n + a * o);
    }
    return this;
  }
  cancelScheduledValues(t) {
    const n = this.toSeconds(t);
    return st(isFinite(n), `Invalid argument to cancelScheduledValues: ${JSON.stringify(t)}`), this._events.cancel(n), this._param.cancelScheduledValues(n), this.log(this.units, "cancelScheduledValues", n), this;
  }
  cancelAndHoldAtTime(t) {
    const n = this.toSeconds(t), s = this._fromType(this.getValueAtTime(n));
    st(isFinite(n), `Invalid argument to cancelAndHoldAtTime: ${JSON.stringify(t)}`), this.log(this.units, "cancelAndHoldAtTime", n, "value=" + s);
    const i = this._events.get(n), r = this._events.getAfter(n);
    return i && sn(i.time, n) ? r ? (this._param.cancelScheduledValues(r.time), this._events.cancel(r.time)) : (this._param.cancelAndHoldAtTime(n), this._events.cancel(n + this.sampleTime)) : r && (this._param.cancelScheduledValues(r.time), this._events.cancel(r.time), r.type === "linearRampToValueAtTime" ? this.linearRampToValueAtTime(this._toType(s), n) : r.type === "exponentialRampToValueAtTime" && this.exponentialRampToValueAtTime(this._toType(s), n)), this._events.add({
      time: n,
      type: "setValueAtTime",
      value: s
    }), this._param.setValueAtTime(s, n), this;
  }
  rampTo(t, n = 0.1, s) {
    return this.units === "frequency" || this.units === "bpm" || this.units === "decibels" ? this.exponentialRampTo(t, n, s) : this.linearRampTo(t, n, s), this;
  }
  /**
   * Apply all of the previously scheduled events to the passed in Param or AudioParam.
   * The applied values will start at the context's current time and schedule
   * all of the events which are scheduled on this Param onto the passed in param.
   */
  apply(t) {
    const n = this.context.currentTime;
    t.setValueAtTime(this.getValueAtTime(n), n);
    const s = this._events.get(n);
    if (s && s.type === "setTargetAtTime") {
      const i = this._events.getAfter(s.time), r = i ? i.time : n + 2, o = (r - n) / 10;
      for (let a = n; a < r; a += o)
        t.linearRampToValueAtTime(this.getValueAtTime(a), a);
    }
    return this._events.forEachAfter(this.context.currentTime, (i) => {
      i.type === "cancelScheduledValues" ? t.cancelScheduledValues(i.time) : i.type === "setTargetAtTime" ? t.setTargetAtTime(i.value, i.time, i.constant) : t[i.type](i.value, i.time);
    }), this;
  }
  /**
   * Replace the Param's internal AudioParam. Will apply scheduled curves
   * onto the parameter and replace the connections.
   */
  setParam(t) {
    st(this._swappable, "The Param must be assigned as 'swappable' in the constructor");
    const n = this.input;
    return n.disconnect(this._param), this.apply(t), this._param = t, n.connect(this._param), this;
  }
  dispose() {
    return super.dispose(), this._events.dispose(), this;
  }
  get defaultValue() {
    return this._toType(this._param.defaultValue);
  }
  //-------------------------------------
  // 	AUTOMATION CURVE CALCULATIONS
  // 	MIT License, copyright (c) 2014 Jordan Santell
  //-------------------------------------
  // Calculates the the value along the curve produced by setTargetAtTime
  _exponentialApproach(t, n, s, i, r) {
    return s + (n - s) * Math.exp(-(r - t) / i);
  }
  // Calculates the the value along the curve produced by linearRampToValueAtTime
  _linearInterpolate(t, n, s, i, r) {
    return n + (i - n) * ((r - t) / (s - t));
  }
  // Calculates the the value along the curve produced by exponentialRampToValueAtTime
  _exponentialInterpolate(t, n, s, i, r) {
    return n * Math.pow(i / n, (r - t) / (s - t));
  }
}
class B extends he {
  constructor() {
    super(...arguments), this._internalChannels = [];
  }
  /**
   * The number of inputs feeding into the AudioNode.
   * For source nodes, this will be 0.
   * @example
   * const node = new Tone.Gain();
   * console.log(node.numberOfInputs);
   */
  get numberOfInputs() {
    return bt(this.input) ? gs(this.input) || this.input instanceof gt ? 1 : this.input.numberOfInputs : 0;
  }
  /**
   * The number of outputs of the AudioNode.
   * @example
   * const node = new Tone.Gain();
   * console.log(node.numberOfOutputs);
   */
  get numberOfOutputs() {
    return bt(this.output) ? this.output.numberOfOutputs : 0;
  }
  //-------------------------------------
  // AUDIO PROPERTIES
  //-------------------------------------
  /**
   * Used to decide which nodes to get/set properties on
   */
  _isAudioNode(t) {
    return bt(t) && (t instanceof B || Xn(t));
  }
  /**
   * Get all of the audio nodes (either internal or input/output) which together
   * make up how the class node responds to channel input/output
   */
  _getInternalNodes() {
    const t = this._internalChannels.slice(0);
    return this._isAudioNode(this.input) && t.push(this.input), this._isAudioNode(this.output) && this.input !== this.output && t.push(this.output), t;
  }
  /**
   * Set the audio options for this node such as channelInterpretation
   * channelCount, etc.
   * @param options
   */
  _setChannelProperties(t) {
    this._getInternalNodes().forEach((s) => {
      s.channelCount = t.channelCount, s.channelCountMode = t.channelCountMode, s.channelInterpretation = t.channelInterpretation;
    });
  }
  /**
   * Get the current audio options for this node such as channelInterpretation
   * channelCount, etc.
   */
  _getChannelProperties() {
    const t = this._getInternalNodes();
    st(t.length > 0, "ToneAudioNode does not have any internal nodes");
    const n = t[0];
    return {
      channelCount: n.channelCount,
      channelCountMode: n.channelCountMode,
      channelInterpretation: n.channelInterpretation
    };
  }
  /**
   * channelCount is the number of channels used when up-mixing and down-mixing
   * connections to any inputs to the node. The default value is 2 except for
   * specific nodes where its value is specially determined.
   */
  get channelCount() {
    return this._getChannelProperties().channelCount;
  }
  set channelCount(t) {
    const n = this._getChannelProperties();
    this._setChannelProperties(Object.assign(n, { channelCount: t }));
  }
  /**
   * channelCountMode determines how channels will be counted when up-mixing and
   * down-mixing connections to any inputs to the node.
   * The default value is "max". This attribute has no effect for nodes with no inputs.
   * * "max" - computedNumberOfChannels is the maximum of the number of channels of all connections to an input. In this mode channelCount is ignored.
   * * "clamped-max" - computedNumberOfChannels is determined as for "max" and then clamped to a maximum value of the given channelCount.
   * * "explicit" - computedNumberOfChannels is the exact value as specified by the channelCount.
   */
  get channelCountMode() {
    return this._getChannelProperties().channelCountMode;
  }
  set channelCountMode(t) {
    const n = this._getChannelProperties();
    this._setChannelProperties(Object.assign(n, { channelCountMode: t }));
  }
  /**
   * channelInterpretation determines how individual channels will be treated
   * when up-mixing and down-mixing connections to any inputs to the node.
   * The default value is "speakers".
   */
  get channelInterpretation() {
    return this._getChannelProperties().channelInterpretation;
  }
  set channelInterpretation(t) {
    const n = this._getChannelProperties();
    this._setChannelProperties(Object.assign(n, { channelInterpretation: t }));
  }
  //-------------------------------------
  // CONNECTIONS
  //-------------------------------------
  /**
   * connect the output of a ToneAudioNode to an AudioParam, AudioNode, or ToneAudioNode
   * @param destination The output to connect to
   * @param outputNum The output to connect from
   * @param inputNum The input to connect to
   */
  connect(t, n = 0, s = 0) {
    return Fe(this, t, n, s), this;
  }
  /**
   * Connect the output to the context's destination node.
   * @example
   * const osc = new Tone.Oscillator("C2").start();
   * osc.toDestination();
   */
  toDestination() {
    return this.connect(this.context.destination), this;
  }
  /**
   * Connect the output to the context's destination node.
   * @see {@link toDestination}
   * @deprecated
   */
  toMaster() {
    return ti("toMaster() has been renamed toDestination()"), this.toDestination();
  }
  /**
   * disconnect the output
   */
  disconnect(t, n = 0, s = 0) {
    return zc(this, t, n, s), this;
  }
  /**
   * Connect the output of this node to the rest of the nodes in series.
   * @example
   * const player = new Tone.Player("https://tonejs.github.io/audio/drum-samples/handdrum-loop.mp3");
   * player.autostart = true;
   * const filter = new Tone.AutoFilter(4).start();
   * const distortion = new Tone.Distortion(0.5);
   * // connect the player to the filter, distortion and then to the master output
   * player.chain(filter, distortion, Tone.Destination);
   */
  chain(...t) {
    return Ge(this, ...t), this;
  }
  /**
   * connect the output of this node to the rest of the nodes in parallel.
   * @example
   * const player = new Tone.Player("https://tonejs.github.io/audio/drum-samples/conga-rhythm.mp3");
   * player.autostart = true;
   * const pitchShift = new Tone.PitchShift(4).toDestination();
   * const filter = new Tone.Filter("G5").toDestination();
   * // connect a node to the pitch shift and filter in parallel
   * player.fan(pitchShift, filter);
   */
  fan(...t) {
    return t.forEach((n) => this.connect(n)), this;
  }
  /**
   * Dispose and disconnect
   */
  dispose() {
    return super.dispose(), bt(this.input) && (this.input instanceof B ? this.input.dispose() : Xn(this.input) && this.input.disconnect()), bt(this.output) && (this.output instanceof B ? this.output.dispose() : Xn(this.output) && this.output.disconnect()), this._internalChannels = [], this;
  }
}
function Ge(...e) {
  const t = e.shift();
  e.reduce((n, s) => (n instanceof B ? n.connect(s) : Xn(n) && Fe(n, s), s), t);
}
function Fe(e, t, n = 0, s = 0) {
  for (st(bt(e), "Cannot connect from undefined node"), st(bt(t), "Cannot connect to undefined node"), (t instanceof B || Xn(t)) && st(t.numberOfInputs > 0, "Cannot connect to node with no inputs"), st(e.numberOfOutputs > 0, "Cannot connect from node with no outputs"); t instanceof B || t instanceof gt; )
    bt(t.input) && (t = t.input);
  for (; e instanceof B; )
    bt(e.output) && (e = e.output);
  gs(t) ? e.connect(t, n) : e.connect(t, n, s);
}
function zc(e, t, n = 0, s = 0) {
  if (bt(t))
    for (; t instanceof B; )
      t = t.input;
  for (; !Xn(e); )
    bt(e.output) && (e = e.output);
  gs(t) ? e.disconnect(t, n) : Xn(t) ? e.disconnect(t, n, s) : e.disconnect();
}
function O0(...e) {
  const t = e.pop();
  bt(t) && e.forEach((n) => Fe(n, t));
}
class nt extends B {
  constructor() {
    const t = P(nt.getDefaults(), arguments, [
      "gain",
      "units"
    ]);
    super(t), this.name = "Gain", this._gainNode = this.context.createGain(), this.input = this._gainNode, this.output = this._gainNode, this.gain = new gt({
      context: this.context,
      convert: t.convert,
      param: this._gainNode.gain,
      units: t.units,
      value: t.gain,
      minValue: t.minValue,
      maxValue: t.maxValue
    }), ct(this, "gain");
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      convert: !0,
      gain: 1,
      units: "gain"
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._gainNode.disconnect(), this.gain.dispose(), this;
  }
}
class Gs extends B {
  constructor(t) {
    super(t), this.onended = St, this._startTime = -1, this._stopTime = -1, this._timeout = -1, this.output = new nt({
      context: this.context,
      gain: 0
    }), this._gainNode = this.output, this.getStateAtTime = function(n) {
      const s = this.toSeconds(n);
      return this._startTime !== -1 && s >= this._startTime && (this._stopTime === -1 || s <= this._stopTime) ? "started" : "stopped";
    }, this._fadeIn = t.fadeIn, this._fadeOut = t.fadeOut, this._curve = t.curve, this.onended = t.onended;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      curve: "linear",
      fadeIn: 0,
      fadeOut: 0,
      onended: St
    });
  }
  /**
   * Start the source at the given time
   * @param  time When to start the source
   */
  _startGain(t, n = 1) {
    st(this._startTime === -1, "Source cannot be started more than once");
    const s = this.toSeconds(this._fadeIn);
    return this._startTime = t + s, this._startTime = Math.max(this._startTime, this.context.currentTime), s > 0 ? (this._gainNode.gain.setValueAtTime(0, t), this._curve === "linear" ? this._gainNode.gain.linearRampToValueAtTime(n, t + s) : this._gainNode.gain.exponentialApproachValueAtTime(n, t, s)) : this._gainNode.gain.setValueAtTime(n, t), this;
  }
  /**
   * Stop the source node at the given time.
   * @param time When to stop the source
   */
  stop(t) {
    return this.log("stop", t), this._stopGain(this.toSeconds(t)), this;
  }
  /**
   * Stop the source at the given time
   * @param  time When to stop the source
   */
  _stopGain(t) {
    st(this._startTime !== -1, "'start' must be called before 'stop'"), this.cancelStop();
    const n = this.toSeconds(this._fadeOut);
    return this._stopTime = this.toSeconds(t) + n, this._stopTime = Math.max(this._stopTime, this.now()), n > 0 ? this._curve === "linear" ? this._gainNode.gain.linearRampTo(0, n, t) : this._gainNode.gain.targetRampTo(0, n, t) : (this._gainNode.gain.cancelAndHoldAtTime(t), this._gainNode.gain.setValueAtTime(0, t)), this.context.clearTimeout(this._timeout), this._timeout = this.context.setTimeout(() => {
      const s = this._curve === "exponential" ? n * 2 : 0;
      this._stopSource(this.now() + s), this._onended();
    }, this._stopTime - this.context.currentTime), this;
  }
  /**
   * Invoke the onended callback
   */
  _onended() {
    if (this.onended !== St && (this.onended(this), this.onended = St, !this.context.isOffline)) {
      const t = () => this.dispose();
      typeof requestIdleCallback < "u" ? requestIdleCallback(t) : setTimeout(t, 10);
    }
  }
  /**
   * Get the playback state at the current time
   */
  get state() {
    return this.getStateAtTime(this.now());
  }
  /**
   * Cancel a scheduled stop event
   */
  cancelStop() {
    return this.log("cancelStop"), st(this._startTime !== -1, "Source is not started"), this._gainNode.gain.cancelScheduledValues(this._startTime + this.sampleTime), this.context.clearTimeout(this._timeout), this._stopTime = -1, this;
  }
  dispose() {
    return super.dispose(), this._gainNode.dispose(), this.onended = St, this;
  }
}
class po extends Gs {
  constructor() {
    const t = P(po.getDefaults(), arguments, ["offset"]);
    super(t), this.name = "ToneConstantSource", this._source = this.context.createConstantSource(), Fe(this._source, this._gainNode), this.offset = new gt({
      context: this.context,
      convert: t.convert,
      param: this._source.offset,
      units: t.units,
      value: t.offset,
      minValue: t.minValue,
      maxValue: t.maxValue
    });
  }
  static getDefaults() {
    return Object.assign(Gs.getDefaults(), {
      convert: !0,
      offset: 1,
      units: "number"
    });
  }
  /**
   * Start the source node at the given time
   * @param  time When to start the source
   */
  start(t) {
    const n = this.toSeconds(t);
    return this.log("start", n), this._startGain(n), this._source.start(n), this;
  }
  _stopSource(t) {
    this._source.stop(t);
  }
  dispose() {
    return super.dispose(), this.state === "started" && this.stop(), this._source.disconnect(), this.offset.dispose(), this;
  }
}
class dt extends B {
  constructor() {
    const t = P(dt.getDefaults(), arguments, [
      "value",
      "units"
    ]);
    super(t), this.name = "Signal", this.override = !0, this.output = this._constantSource = new po({
      context: this.context,
      convert: t.convert,
      offset: t.value,
      units: t.units,
      minValue: t.minValue,
      maxValue: t.maxValue
    }), this._constantSource.start(0), this.input = this._param = this._constantSource.offset;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      convert: !0,
      units: "number",
      value: 0
    });
  }
  connect(t, n = 0, s = 0) {
    return Hi(this, t, n, s), this;
  }
  dispose() {
    return super.dispose(), this._param.dispose(), this._constantSource.dispose(), this;
  }
  //-------------------------------------
  // ABSTRACT PARAM INTERFACE
  // just a proxy for the ConstantSourceNode's offset AudioParam
  // all docs are generated from AbstractParam.ts
  //-------------------------------------
  setValueAtTime(t, n) {
    return this._param.setValueAtTime(t, n), this;
  }
  getValueAtTime(t) {
    return this._param.getValueAtTime(t);
  }
  setRampPoint(t) {
    return this._param.setRampPoint(t), this;
  }
  linearRampToValueAtTime(t, n) {
    return this._param.linearRampToValueAtTime(t, n), this;
  }
  exponentialRampToValueAtTime(t, n) {
    return this._param.exponentialRampToValueAtTime(t, n), this;
  }
  exponentialRampTo(t, n, s) {
    return this._param.exponentialRampTo(t, n, s), this;
  }
  linearRampTo(t, n, s) {
    return this._param.linearRampTo(t, n, s), this;
  }
  targetRampTo(t, n, s) {
    return this._param.targetRampTo(t, n, s), this;
  }
  exponentialApproachValueAtTime(t, n, s) {
    return this._param.exponentialApproachValueAtTime(t, n, s), this;
  }
  setTargetAtTime(t, n, s) {
    return this._param.setTargetAtTime(t, n, s), this;
  }
  setValueCurveAtTime(t, n, s, i) {
    return this._param.setValueCurveAtTime(t, n, s, i), this;
  }
  cancelScheduledValues(t) {
    return this._param.cancelScheduledValues(t), this;
  }
  cancelAndHoldAtTime(t) {
    return this._param.cancelAndHoldAtTime(t), this;
  }
  rampTo(t, n, s) {
    return this._param.rampTo(t, n, s), this;
  }
  get value() {
    return this._param.value;
  }
  set value(t) {
    this._param.value = t;
  }
  get convert() {
    return this._param.convert;
  }
  set convert(t) {
    this._param.convert = t;
  }
  get units() {
    return this._param.units;
  }
  get overridden() {
    return this._param.overridden;
  }
  set overridden(t) {
    this._param.overridden = t;
  }
  get maxValue() {
    return this._param.maxValue;
  }
  get minValue() {
    return this._param.minValue;
  }
  /**
   * @see {@link Param.apply}.
   */
  apply(t) {
    return this._param.apply(t), this;
  }
}
function Hi(e, t, n, s) {
  (t instanceof gt || gs(t) || t instanceof dt && t.override) && (t.cancelScheduledValues(0), t.setValueAtTime(0, 0), t instanceof dt && (t.overridden = !0)), Fe(e, t, n, s);
}
class Gc extends gt {
  constructor() {
    const t = P(Gc.getDefaults(), arguments, ["value"]);
    super(t), this.name = "TickParam", this._events = new $e(1 / 0), this._multiplier = 1, this._multiplier = t.multiplier, this._events.cancel(0), this._events.add({
      ticks: 0,
      time: 0,
      type: "setValueAtTime",
      value: this._fromType(t.value)
    }), this.setValueAtTime(t.value, 0);
  }
  static getDefaults() {
    return Object.assign(gt.getDefaults(), {
      multiplier: 1,
      units: "hertz",
      value: 1
    });
  }
  setTargetAtTime(t, n, s) {
    n = this.toSeconds(n), this.setRampPoint(n);
    const i = this._fromType(t), r = this._events.get(n), o = Math.round(Math.max(1 / s, 1));
    for (let a = 0; a <= o; a++) {
      const c = s * a + n, l = this._exponentialApproach(r.time, r.value, i, s, c);
      this.linearRampToValueAtTime(this._toType(l), c);
    }
    return this;
  }
  setValueAtTime(t, n) {
    const s = this.toSeconds(n);
    super.setValueAtTime(t, n);
    const i = this._events.get(s), r = this._events.previousEvent(i), o = this._getTicksUntilEvent(r, s);
    return i.ticks = Math.max(o, 0), this;
  }
  linearRampToValueAtTime(t, n) {
    const s = this.toSeconds(n);
    super.linearRampToValueAtTime(t, n);
    const i = this._events.get(s), r = this._events.previousEvent(i), o = this._getTicksUntilEvent(r, s);
    return i.ticks = Math.max(o, 0), this;
  }
  exponentialRampToValueAtTime(t, n) {
    n = this.toSeconds(n);
    const s = this._fromType(t), i = this._events.get(n), r = Math.round(Math.max((n - i.time) * 10, 1)), o = (n - i.time) / r;
    for (let a = 0; a <= r; a++) {
      const c = o * a + i.time, l = this._exponentialInterpolate(i.time, i.value, n, s, c);
      this.linearRampToValueAtTime(this._toType(l), c);
    }
    return this;
  }
  /**
   * Returns the tick value at the time. Takes into account
   * any automation curves scheduled on the signal.
   * @param  event The time to get the tick count at
   * @return The number of ticks which have elapsed at the time given any automations.
   */
  _getTicksUntilEvent(t, n) {
    if (t === null)
      t = {
        ticks: 0,
        time: 0,
        type: "setValueAtTime",
        value: 0
      };
    else if (We(t.ticks)) {
      const o = this._events.previousEvent(t);
      t.ticks = this._getTicksUntilEvent(o, t.time);
    }
    const s = this._fromType(this.getValueAtTime(t.time));
    let i = this._fromType(this.getValueAtTime(n));
    const r = this._events.get(n);
    return r && r.time === n && r.type === "setValueAtTime" && (i = this._fromType(this.getValueAtTime(n - this.sampleTime))), 0.5 * (n - t.time) * (s + i) + t.ticks;
  }
  /**
   * Returns the tick value at the time. Takes into account
   * any automation curves scheduled on the signal.
   * @param  time The time to get the tick count at
   * @return The number of ticks which have elapsed at the time given any automations.
   */
  getTicksAtTime(t) {
    const n = this.toSeconds(t), s = this._events.get(n);
    return Math.max(this._getTicksUntilEvent(s, n), 0);
  }
  /**
   * Return the elapsed time of the number of ticks from the given time
   * @param ticks The number of ticks to calculate
   * @param  time The time to get the next tick from
   * @return The duration of the number of ticks from the given time in seconds
   */
  getDurationOfTicks(t, n) {
    const s = this.toSeconds(n), i = this.getTicksAtTime(n);
    return this.getTimeOfTick(i + t) - s;
  }
  /**
   * Given a tick, returns the time that tick occurs at.
   * @return The time that the tick occurs.
   */
  getTimeOfTick(t) {
    const n = this._events.get(t, "ticks"), s = this._events.getAfter(t, "ticks");
    if (n && n.ticks === t)
      return n.time;
    if (n && s && s.type === "linearRampToValueAtTime" && n.value !== s.value) {
      const i = this._fromType(this.getValueAtTime(n.time)), o = (this._fromType(this.getValueAtTime(s.time)) - i) / (s.time - n.time), a = Math.sqrt(Math.pow(i, 2) - 2 * o * (n.ticks - t)), c = (-i + a) / o, l = (-i - a) / o;
      return (c > 0 ? c : l) + n.time;
    } else return n ? n.value === 0 ? 1 / 0 : n.time + (t - n.ticks) / n.value : t / this._initialValue;
  }
  /**
   * Convert some number of ticks their the duration in seconds accounting
   * for any automation curves starting at the given time.
   * @param  ticks The number of ticks to convert to seconds.
   * @param  when  When along the automation timeline to convert the ticks.
   * @return The duration in seconds of the ticks.
   */
  ticksToTime(t, n) {
    return this.getDurationOfTicks(t, n);
  }
  /**
   * The inverse of {@link ticksToTime}. Convert a duration in
   * seconds to the corresponding number of ticks accounting for any
   * automation curves starting at the given time.
   * @param  duration The time interval to convert to ticks.
   * @param  when When along the automation timeline to convert the ticks.
   * @return The duration in ticks.
   */
  timeToTicks(t, n) {
    const s = this.toSeconds(n), i = this.toSeconds(t), r = this.getTicksAtTime(s);
    return this.getTicksAtTime(s + i) - r;
  }
  /**
   * Convert from the type when the unit value is BPM
   */
  _fromType(t) {
    return this.units === "bpm" && this.multiplier ? 1 / (60 / t / this.multiplier) : super._fromType(t);
  }
  /**
   * Special case of type conversion where the units === "bpm"
   */
  _toType(t) {
    return this.units === "bpm" && this.multiplier ? t / this.multiplier * 60 : super._toType(t);
  }
  /**
   * A multiplier on the bpm value. Useful for setting a PPQ relative to the base frequency value.
   */
  get multiplier() {
    return this._multiplier;
  }
  set multiplier(t) {
    const n = this.value;
    this._multiplier = t, this.cancelScheduledValues(0), this.setValueAtTime(n, 0);
  }
}
class Zc extends dt {
  constructor() {
    const t = P(Zc.getDefaults(), arguments, ["value"]);
    super(t), this.name = "TickSignal", this.input = this._param = new Gc({
      context: this.context,
      convert: t.convert,
      multiplier: t.multiplier,
      param: this._constantSource.offset,
      units: t.units,
      value: t.value
    });
  }
  static getDefaults() {
    return Object.assign(dt.getDefaults(), {
      multiplier: 1,
      units: "hertz",
      value: 1
    });
  }
  ticksToTime(t, n) {
    return this._param.ticksToTime(t, n);
  }
  timeToTicks(t, n) {
    return this._param.timeToTicks(t, n);
  }
  getTimeOfTick(t) {
    return this._param.getTimeOfTick(t);
  }
  getDurationOfTicks(t, n) {
    return this._param.getDurationOfTicks(t, n);
  }
  getTicksAtTime(t) {
    return this._param.getTicksAtTime(t);
  }
  /**
   * A multiplier on the bpm value. Useful for setting a PPQ relative to the base frequency value.
   */
  get multiplier() {
    return this._param.multiplier;
  }
  set multiplier(t) {
    this._param.multiplier = t;
  }
  dispose() {
    return super.dispose(), this._param.dispose(), this;
  }
}
class Yc extends he {
  constructor() {
    const t = P(Yc.getDefaults(), arguments, ["frequency"]);
    super(t), this.name = "TickSource", this._state = new ii(), this._tickOffset = new $e(), this._ticksAtTime = new $e(), this._secondsAtTime = new $e(), this.frequency = new Zc({
      context: this.context,
      units: t.units,
      value: t.frequency
    }), ct(this, "frequency"), this._state.setStateAtTime("stopped", 0), this.setTicksAtTime(0, 0);
  }
  static getDefaults() {
    return Object.assign({
      frequency: 1,
      units: "hertz"
    }, he.getDefaults());
  }
  /**
   * Returns the playback state of the source, either "started", "stopped" or "paused".
   */
  get state() {
    return this.getStateAtTime(this.now());
  }
  /**
   * Start the clock at the given time. Optionally pass in an offset
   * of where to start the tick counter from.
   * @param  time    The time the clock should start
   * @param offset The number of ticks to start the source at
   */
  start(t, n) {
    const s = this.toSeconds(t);
    return this._state.getValueAtTime(s) !== "started" && (this._state.setStateAtTime("started", s), bt(n) && this.setTicksAtTime(n, s), this._ticksAtTime.cancel(s), this._secondsAtTime.cancel(s)), this;
  }
  /**
   * Stop the clock. Stopping the clock resets the tick counter to 0.
   * @param time The time when the clock should stop.
   */
  stop(t) {
    const n = this.toSeconds(t);
    if (this._state.getValueAtTime(n) === "stopped") {
      const s = this._state.get(n);
      s && s.time > 0 && (this._tickOffset.cancel(s.time), this._state.cancel(s.time));
    }
    return this._state.cancel(n), this._state.setStateAtTime("stopped", n), this.setTicksAtTime(0, n), this._ticksAtTime.cancel(n), this._secondsAtTime.cancel(n), this;
  }
  /**
   * Pause the clock. Pausing does not reset the tick counter.
   * @param time The time when the clock should stop.
   */
  pause(t) {
    const n = this.toSeconds(t);
    return this._state.getValueAtTime(n) === "started" && (this._state.setStateAtTime("paused", n), this._ticksAtTime.cancel(n), this._secondsAtTime.cancel(n)), this;
  }
  /**
   * Cancel start/stop/pause and setTickAtTime events scheduled after the given time.
   * @param time When to clear the events after
   */
  cancel(t) {
    return t = this.toSeconds(t), this._state.cancel(t), this._tickOffset.cancel(t), this._ticksAtTime.cancel(t), this._secondsAtTime.cancel(t), this;
  }
  /**
   * Get the elapsed ticks at the given time
   * @param  time  When to get the tick value
   * @return The number of ticks
   */
  getTicksAtTime(t) {
    const n = this.toSeconds(t), s = this._state.getLastState("stopped", n), i = this._ticksAtTime.get(n), r = {
      state: "paused",
      time: n
    };
    this._state.add(r);
    let o = i || s, a = i ? i.ticks : 0, c = null;
    return this._state.forEachBetween(o.time, n + this.sampleTime, (l) => {
      let u = o.time;
      const h = this._tickOffset.get(l.time);
      h && h.time >= o.time && (a = h.ticks, u = h.time), o.state === "started" && l.state !== "started" && (a += this.frequency.getTicksAtTime(l.time) - this.frequency.getTicksAtTime(u), l.time !== r.time && (c = {
        state: l.state,
        time: l.time,
        ticks: a
      })), o = l;
    }), this._state.remove(r), c && this._ticksAtTime.add(c), a;
  }
  /**
   * The number of times the callback was invoked. Starts counting at 0
   * and increments after the callback was invoked. Returns -1 when stopped.
   */
  get ticks() {
    return this.getTicksAtTime(this.now());
  }
  set ticks(t) {
    this.setTicksAtTime(t, this.now());
  }
  /**
   * The time since ticks=0 that the TickSource has been running. Accounts
   * for tempo curves
   */
  get seconds() {
    return this.getSecondsAtTime(this.now());
  }
  set seconds(t) {
    const n = this.now(), s = this.frequency.timeToTicks(t, n);
    this.setTicksAtTime(s, n);
  }
  /**
   * Return the elapsed seconds at the given time.
   * @param  time  When to get the elapsed seconds
   * @return  The number of elapsed seconds
   */
  getSecondsAtTime(t) {
    t = this.toSeconds(t);
    const n = this._state.getLastState("stopped", t), s = { state: "paused", time: t };
    this._state.add(s);
    const i = this._secondsAtTime.get(t);
    let r = i || n, o = i ? i.seconds : 0, a = null;
    return this._state.forEachBetween(r.time, t + this.sampleTime, (c) => {
      let l = r.time;
      const u = this._tickOffset.get(c.time);
      u && u.time >= r.time && (o = u.seconds, l = u.time), r.state === "started" && c.state !== "started" && (o += c.time - l, c.time !== s.time && (a = {
        state: c.state,
        time: c.time,
        seconds: o
      })), r = c;
    }), this._state.remove(s), a && this._secondsAtTime.add(a), o;
  }
  /**
   * Set the clock's ticks at the given time.
   * @param  ticks The tick value to set
   * @param  time  When to set the tick value
   */
  setTicksAtTime(t, n) {
    return n = this.toSeconds(n), this._tickOffset.cancel(n), this._tickOffset.add({
      seconds: this.frequency.getDurationOfTicks(t, n),
      ticks: t,
      time: n
    }), this._ticksAtTime.cancel(n), this._secondsAtTime.cancel(n), this;
  }
  /**
   * Returns the scheduled state at the given time.
   * @param  time  The time to query.
   */
  getStateAtTime(t) {
    return t = this.toSeconds(t), this._state.getValueAtTime(t);
  }
  /**
   * Get the time of the given tick. The second argument
   * is when to test before. Since ticks can be set (with setTicksAtTime)
   * there may be multiple times for a given tick value.
   * @param  tick The tick number.
   * @param  before When to measure the tick value from.
   * @return The time of the tick
   */
  getTimeOfTick(t, n = this.now()) {
    const s = this._tickOffset.get(n), i = this._state.get(n), r = Math.max(s.time, i.time), o = this.frequency.getTicksAtTime(r) + t - s.ticks;
    return this.frequency.getTimeOfTick(o);
  }
  /**
   * Invoke the callback event at all scheduled ticks between the
   * start time and the end time
   * @param  startTime  The beginning of the search range
   * @param  endTime    The end of the search range
   * @param  callback   The callback to invoke with each tick
   */
  forEachTickBetween(t, n, s) {
    let i = this._state.get(t);
    this._state.forEachBetween(t, n, (o) => {
      i && i.state === "started" && o.state !== "started" && this.forEachTickBetween(Math.max(i.time, t), o.time - this.sampleTime, s), i = o;
    });
    let r = null;
    if (i && i.state === "started") {
      const o = Math.max(i.time, t), a = this.frequency.getTicksAtTime(o), c = this.frequency.getTicksAtTime(i.time), l = a - c;
      let u = Math.ceil(l) - l;
      u = sn(u, 1) ? 0 : u;
      let h = this.frequency.getTimeOfTick(a + u);
      for (; h < n; ) {
        try {
          s(h, Math.round(this.getTicksAtTime(h)));
        } catch (d) {
          r = d;
          break;
        }
        h += this.frequency.getDurationOfTicks(1, h);
      }
    }
    if (r)
      throw r;
    return this;
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this._state.dispose(), this._tickOffset.dispose(), this._ticksAtTime.dispose(), this._secondsAtTime.dispose(), this.frequency.dispose(), this;
  }
}
class ri extends he {
  constructor() {
    const t = P(ri.getDefaults(), arguments, [
      "callback",
      "frequency"
    ]);
    super(t), this.name = "Clock", this.callback = St, this._lastUpdate = 0, this._state = new ii("stopped"), this._boundLoop = this._loop.bind(this), this.callback = t.callback, this._tickSource = new Yc({
      context: this.context,
      frequency: t.frequency,
      units: t.units
    }), this._lastUpdate = 0, this.frequency = this._tickSource.frequency, ct(this, "frequency"), this._state.setStateAtTime("stopped", 0), this.context.on("tick", this._boundLoop);
  }
  static getDefaults() {
    return Object.assign(he.getDefaults(), {
      callback: St,
      frequency: 1,
      units: "hertz"
    });
  }
  /**
   * Returns the playback state of the source, either "started", "stopped" or "paused".
   */
  get state() {
    return this._state.getValueAtTime(this.now());
  }
  /**
   * Start the clock at the given time. Optionally pass in an offset
   * of where to start the tick counter from.
   * @param  time    The time the clock should start
   * @param offset  Where the tick counter starts counting from.
   */
  start(t, n) {
    Vc(this.context);
    const s = this.toSeconds(t);
    return this.log("start", s), this._state.getValueAtTime(s) !== "started" && (this._state.setStateAtTime("started", s), this._tickSource.start(s, n), s < this._lastUpdate && this.emit("start", s, n)), this;
  }
  /**
   * Stop the clock. Stopping the clock resets the tick counter to 0.
   * @param time The time when the clock should stop.
   * @example
   * const clock = new Tone.Clock(time => {
   * 	console.log(time);
   * }, 1);
   * clock.start();
   * // stop the clock after 10 seconds
   * clock.stop("+10");
   */
  stop(t) {
    const n = this.toSeconds(t);
    return this.log("stop", n), this._state.cancel(n), this._state.setStateAtTime("stopped", n), this._tickSource.stop(n), n < this._lastUpdate && this.emit("stop", n), this;
  }
  /**
   * Pause the clock. Pausing does not reset the tick counter.
   * @param time The time when the clock should stop.
   */
  pause(t) {
    const n = this.toSeconds(t);
    return this._state.getValueAtTime(n) === "started" && (this._state.setStateAtTime("paused", n), this._tickSource.pause(n), n < this._lastUpdate && this.emit("pause", n)), this;
  }
  /**
   * The number of times the callback was invoked. Starts counting at 0
   * and increments after the callback was invoked.
   */
  get ticks() {
    return Math.ceil(this.getTicksAtTime(this.now()));
  }
  set ticks(t) {
    this._tickSource.ticks = t;
  }
  /**
   * The time since ticks=0 that the Clock has been running. Accounts for tempo curves
   */
  get seconds() {
    return this._tickSource.seconds;
  }
  set seconds(t) {
    this._tickSource.seconds = t;
  }
  /**
   * Return the elapsed seconds at the given time.
   * @param  time  When to get the elapsed seconds
   * @return  The number of elapsed seconds
   */
  getSecondsAtTime(t) {
    return this._tickSource.getSecondsAtTime(t);
  }
  /**
   * Set the clock's ticks at the given time.
   * @param  ticks The tick value to set
   * @param  time  When to set the tick value
   */
  setTicksAtTime(t, n) {
    return this._tickSource.setTicksAtTime(t, n), this;
  }
  /**
   * Get the time of the given tick. The second argument
   * is when to test before. Since ticks can be set (with setTicksAtTime)
   * there may be multiple times for a given tick value.
   * @param  tick The tick number.
   * @param  before When to measure the tick value from.
   * @return The time of the tick
   */
  getTimeOfTick(t, n = this.now()) {
    return this._tickSource.getTimeOfTick(t, n);
  }
  /**
   * Get the clock's ticks at the given time.
   * @param  time  When to get the tick value
   * @return The tick value at the given time.
   */
  getTicksAtTime(t) {
    return this._tickSource.getTicksAtTime(t);
  }
  /**
   * Get the time of the next tick
   * @param  offset The tick number.
   */
  nextTickTime(t, n) {
    const s = this.toSeconds(n), i = this.getTicksAtTime(s);
    return this._tickSource.getTimeOfTick(i + t, s);
  }
  /**
   * The scheduling loop.
   */
  _loop() {
    const t = this._lastUpdate, n = this.now();
    this._lastUpdate = n, this.log("loop", t, n), t !== n && (this._state.forEachBetween(t, n, (s) => {
      switch (s.state) {
        case "started":
          const i = this._tickSource.getTicksAtTime(s.time);
          this.emit("start", s.time, i);
          break;
        case "stopped":
          s.time !== 0 && this.emit("stop", s.time);
          break;
        case "paused":
          this.emit("pause", s.time);
          break;
      }
    }), this._tickSource.forEachTickBetween(t, n, (s, i) => {
      this.callback(s, i);
    }));
  }
  /**
   * Returns the scheduled state at the given time.
   * @param  time  The time to query.
   * @return  The name of the state input in setStateAtTime.
   * @example
   * const clock = new Tone.Clock();
   * clock.start("+0.1");
   * clock.getStateAtTime("+0.1"); // returns "started"
   */
  getStateAtTime(t) {
    const n = this.toSeconds(t);
    return this._state.getValueAtTime(n);
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this.context.off("tick", this._boundLoop), this._tickSource.dispose(), this._state.dispose(), this;
  }
}
ei.mixin(ri);
class qe extends B {
  constructor() {
    const t = P(qe.getDefaults(), arguments, [
      "delayTime",
      "maxDelay"
    ]);
    super(t), this.name = "Delay";
    const n = this.toSeconds(t.maxDelay);
    this._maxDelay = Math.max(n, this.toSeconds(t.delayTime)), this._delayNode = this.input = this.output = this.context.createDelay(n), this.delayTime = new gt({
      context: this.context,
      param: this._delayNode.delayTime,
      units: "time",
      value: t.delayTime,
      minValue: 0,
      maxValue: this.maxDelay
    }), ct(this, "delayTime");
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      delayTime: 0,
      maxDelay: 1
    });
  }
  /**
   * The maximum delay time. This cannot be changed after
   * the value is passed into the constructor.
   */
  get maxDelay() {
    return this._maxDelay;
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._delayNode.disconnect(), this.delayTime.dispose(), this;
  }
}
class un extends B {
  constructor() {
    const t = P(un.getDefaults(), arguments, [
      "volume"
    ]);
    super(t), this.name = "Volume", this.input = this.output = new nt({
      context: this.context,
      gain: t.volume,
      units: "decibels"
    }), this.volume = this.output.gain, ct(this, "volume"), this._unmutedVolume = t.volume, this.mute = t.mute;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      mute: !1,
      volume: 0
    });
  }
  /**
   * Mute the output.
   * @example
   * const vol = new Tone.Volume(-12).toDestination();
   * const osc = new Tone.Oscillator().connect(vol).start();
   * // mute the output
   * vol.mute = true;
   */
  get mute() {
    return this.volume.value === -1 / 0;
  }
  set mute(t) {
    !this.mute && t ? (this._unmutedVolume = this.volume.value, this.volume.value = -1 / 0) : this.mute && !t && (this.volume.value = this._unmutedVolume);
  }
  /**
   * clean up
   */
  dispose() {
    return super.dispose(), this.input.dispose(), this.volume.dispose(), this;
  }
}
class Xc extends B {
  constructor() {
    const t = P(Xc.getDefaults(), arguments);
    super(t), this.name = "Destination", this.input = new un({ context: this.context }), this.output = new nt({ context: this.context }), this.volume = this.input.volume, Ge(this.input, this.output, this.context.rawContext.destination), this.mute = t.mute, this._internalChannels = [
      this.input,
      this.context.rawContext.destination,
      this.output
    ];
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      mute: !1,
      volume: 0
    });
  }
  /**
   * Mute the output.
   * @example
   * const oscillator = new Tone.Oscillator().start().toDestination();
   * setTimeout(() => {
   * 	// mute the output
   * 	Tone.Destination.mute = true;
   * }, 1000);
   */
  get mute() {
    return this.input.mute;
  }
  set mute(t) {
    this.input.mute = t;
  }
  /**
   * Add a master effects chain. NOTE: this will disconnect any nodes which were previously
   * chained in the master effects chain.
   * @param args All arguments will be connected in a row and the Master will be routed through it.
   * @example
   * // route all audio through a filter and compressor
   * const lowpass = new Tone.Filter(800, "lowpass");
   * const compressor = new Tone.Compressor(-18);
   * Tone.Destination.chain(lowpass, compressor);
   */
  chain(...t) {
    return this.input.disconnect(), t.unshift(this.input), t.push(this.output), Ge(...t), this;
  }
  /**
   * The maximum number of channels the system can output
   * @example
   * console.log(Tone.Destination.maxChannelCount);
   */
  get maxChannelCount() {
    return this.context.rawContext.destination.maxChannelCount;
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this.volume.dispose(), this;
  }
}
uo((e) => {
  e.destination = new Xc({ context: e });
});
ho((e) => {
  e.destination.dispose();
});
class M0 extends B {
  constructor() {
    super(...arguments), this.name = "Listener", this.positionX = new gt({
      context: this.context,
      param: this.context.rawContext.listener.positionX
    }), this.positionY = new gt({
      context: this.context,
      param: this.context.rawContext.listener.positionY
    }), this.positionZ = new gt({
      context: this.context,
      param: this.context.rawContext.listener.positionZ
    }), this.forwardX = new gt({
      context: this.context,
      param: this.context.rawContext.listener.forwardX
    }), this.forwardY = new gt({
      context: this.context,
      param: this.context.rawContext.listener.forwardY
    }), this.forwardZ = new gt({
      context: this.context,
      param: this.context.rawContext.listener.forwardZ
    }), this.upX = new gt({
      context: this.context,
      param: this.context.rawContext.listener.upX
    }), this.upY = new gt({
      context: this.context,
      param: this.context.rawContext.listener.upY
    }), this.upZ = new gt({
      context: this.context,
      param: this.context.rawContext.listener.upZ
    });
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      forwardX: 0,
      forwardY: 0,
      forwardZ: -1,
      upX: 0,
      upY: 1,
      upZ: 0
    });
  }
  dispose() {
    return super.dispose(), this.positionX.dispose(), this.positionY.dispose(), this.positionZ.dispose(), this.forwardX.dispose(), this.forwardY.dispose(), this.forwardZ.dispose(), this.upX.dispose(), this.upY.dispose(), this.upZ.dispose(), this;
  }
}
uo((e) => {
  e.listener = new M0({ context: e });
});
ho((e) => {
  e.listener.dispose();
});
function F0(e, t) {
  return jt(this, arguments, void 0, function* (n, s, i = 2, r = It().sampleRate) {
    const o = It(), a = new si(i, s, r);
    Mi(a), yield n(a);
    const c = a.render();
    Mi(o);
    const l = yield c;
    return new Rt(l);
  });
}
class oi extends Nn {
  constructor() {
    super(), this.name = "ToneAudioBuffers", this._buffers = /* @__PURE__ */ new Map(), this._loadingCount = 0;
    const t = P(oi.getDefaults(), arguments, ["urls", "onload", "baseUrl"], "urls");
    this.baseUrl = t.baseUrl, Object.keys(t.urls).forEach((n) => {
      this._loadingCount++;
      const s = t.urls[n];
      this.add(n, s, this._bufferLoaded.bind(this, t.onload), t.onerror);
    });
  }
  static getDefaults() {
    return {
      baseUrl: "",
      onerror: St,
      onload: St,
      urls: {}
    };
  }
  /**
   * True if the buffers object has a buffer by that name.
   * @param  name  The key or index of the buffer.
   */
  has(t) {
    return this._buffers.has(t.toString());
  }
  /**
   * Get a buffer by name. If an array was loaded,
   * then use the array index.
   * @param  name  The key or index of the buffer.
   */
  get(t) {
    return st(this.has(t), `ToneAudioBuffers has no buffer named: ${t}`), this._buffers.get(t.toString());
  }
  /**
   * A buffer was loaded. decrement the counter.
   */
  _bufferLoaded(t) {
    this._loadingCount--, this._loadingCount === 0 && t && t();
  }
  /**
   * If the buffers are loaded or not
   */
  get loaded() {
    return Array.from(this._buffers).every(([t, n]) => n.loaded);
  }
  /**
   * Add a buffer by name and url to the Buffers
   * @param  name      A unique name to give the buffer
   * @param  url  Either the url of the bufer, or a buffer which will be added with the given name.
   * @param  callback  The callback to invoke when the url is loaded.
   * @param  onerror  Invoked if the buffer can't be loaded
   */
  add(t, n, s = St, i = St) {
    return an(n) ? (this.baseUrl && n.trim().substring(0, 11).toLowerCase() === "data:audio/" && (this.baseUrl = ""), this._buffers.set(t.toString(), new Rt(this.baseUrl + n, s, i))) : this._buffers.set(t.toString(), new Rt(n, s, i)), this;
  }
  dispose() {
    return super.dispose(), this._buffers.forEach((t) => t.dispose()), this._buffers.clear(), this;
  }
}
class Zs extends Oe {
  constructor() {
    super(...arguments), this.name = "MidiClass", this.defaultUnits = "midi";
  }
  /**
   * Returns the value of a frequency in the current units
   */
  _frequencyToUnits(t) {
    return Zn(super._frequencyToUnits(t));
  }
  /**
   * Returns the value of a tick in the current time units
   */
  _ticksToUnits(t) {
    return Zn(super._ticksToUnits(t));
  }
  /**
   * Return the value of the beats in the current units
   */
  _beatsToUnits(t) {
    return Zn(super._beatsToUnits(t));
  }
  /**
   * Returns the value of a second in the current units
   */
  _secondsToUnits(t) {
    return Zn(super._secondsToUnits(t));
  }
  /**
   * Return the value of the frequency as a MIDI note
   * @example
   * Tone.Midi(60).toMidi(); // 60
   */
  toMidi() {
    return this.valueOf();
  }
  /**
   * Return the value of the frequency as a MIDI note
   * @example
   * Tone.Midi(60).toFrequency(); // 261.6255653005986
   */
  toFrequency() {
    return $c(this.toMidi());
  }
  /**
   * Transposes the frequency by the given number of semitones.
   * @return A new transposed MidiClass
   * @example
   * Tone.Midi("A4").transpose(3); // "C5"
   */
  transpose(t) {
    return new Zs(this.context, this.toMidi() + t);
  }
}
function P0(e, t) {
  return new Zs(It(), e, t);
}
class Yt extends re {
  constructor() {
    super(...arguments), this.name = "Ticks", this.defaultUnits = "i";
  }
  /**
   * Get the current time in the given units
   */
  _now() {
    return this.context.transport.ticks;
  }
  /**
   * Return the value of the beats in the current units
   */
  _beatsToUnits(t) {
    return this._getPPQ() * t;
  }
  /**
   * Returns the value of a second in the current units
   */
  _secondsToUnits(t) {
    return Math.floor(t / (60 / this._getBpm()) * this._getPPQ());
  }
  /**
   * Returns the value of a tick in the current time units
   */
  _ticksToUnits(t) {
    return t;
  }
  /**
   * Return the time in ticks
   */
  toTicks() {
    return this.valueOf();
  }
  /**
   * Return the time in seconds
   */
  toSeconds() {
    return this.valueOf() / this._getPPQ() * (60 / this._getBpm());
  }
}
function N0(e, t) {
  return new Yt(It(), e, t);
}
class V0 extends he {
  constructor() {
    super(...arguments), this.name = "Draw", this.expiration = 0.25, this.anticipation = 8e-3, this._events = new $e(), this._boundDrawLoop = this._drawLoop.bind(this), this._animationFrame = -1;
  }
  /**
   * Schedule a function at the given time to be invoked
   * on the nearest animation frame.
   * @param  callback  Callback is invoked at the given time.
   * @param  time      The time relative to the AudioContext time to invoke the callback.
   * @example
   * Tone.Transport.scheduleRepeat(time => {
   * 	Tone.Draw.schedule(() => console.log(time), time);
   * }, 1);
   * Tone.Transport.start();
   */
  schedule(t, n) {
    return this._events.add({
      callback: t,
      time: this.toSeconds(n)
    }), this._events.length === 1 && (this._animationFrame = requestAnimationFrame(this._boundDrawLoop)), this;
  }
  /**
   * Cancel events scheduled after the given time
   * @param  after  Time after which scheduled events will be removed from the scheduling timeline.
   */
  cancel(t) {
    return this._events.cancel(this.toSeconds(t)), this;
  }
  /**
   * The draw loop
   */
  _drawLoop() {
    const t = this.context.currentTime;
    this._events.forEachBefore(t + this.anticipation, (n) => {
      t - n.time <= this.expiration && n.callback(), this._events.remove(n);
    }), this._events.length > 0 && (this._animationFrame = requestAnimationFrame(this._boundDrawLoop));
  }
  dispose() {
    return super.dispose(), this._events.dispose(), cancelAnimationFrame(this._animationFrame), this;
  }
}
uo((e) => {
  e.draw = new V0({ context: e });
});
ho((e) => {
  e.draw.dispose();
});
class Yd extends Nn {
  constructor() {
    super(...arguments), this.name = "IntervalTimeline", this._root = null, this._length = 0;
  }
  /**
   * The event to add to the timeline. All events must
   * have a time and duration value
   * @param  event  The event to add to the timeline
   */
  add(t) {
    st(bt(t.time), "Events must have a time property"), st(bt(t.duration), "Events must have a duration parameter"), t.time = t.time.valueOf();
    let n = new W0(t.time, t.time + t.duration, t);
    for (this._root === null ? this._root = n : this._root.insert(n), this._length++; n !== null; )
      n.updateHeight(), n.updateMax(), this._rebalance(n), n = n.parent;
    return this;
  }
  /**
   * Remove an event from the timeline.
   * @param  event  The event to remove from the timeline
   */
  remove(t) {
    if (this._root !== null) {
      const n = [];
      this._root.search(t.time, n);
      for (const s of n)
        if (s.event === t) {
          this._removeNode(s), this._length--;
          break;
        }
    }
    return this;
  }
  /**
   * The number of items in the timeline.
   * @readOnly
   */
  get length() {
    return this._length;
  }
  /**
   * Remove events whose time time is after the given time
   * @param  after  The time to query.
   */
  cancel(t) {
    return this.forEachFrom(t, (n) => this.remove(n)), this;
  }
  /**
   * Set the root node as the given node
   */
  _setRoot(t) {
    this._root = t, this._root !== null && (this._root.parent = null);
  }
  /**
   * Replace the references to the node in the node's parent
   * with the replacement node.
   */
  _replaceNodeInParent(t, n) {
    t.parent !== null ? (t.isLeftChild() ? t.parent.left = n : t.parent.right = n, this._rebalance(t.parent)) : this._setRoot(n);
  }
  /**
   * Remove the node from the tree and replace it with
   * a successor which follows the schema.
   */
  _removeNode(t) {
    if (t.left === null && t.right === null)
      this._replaceNodeInParent(t, null);
    else if (t.right === null)
      this._replaceNodeInParent(t, t.left);
    else if (t.left === null)
      this._replaceNodeInParent(t, t.right);
    else {
      const n = t.getBalance();
      let s, i = null;
      if (n > 0)
        if (t.left.right === null)
          s = t.left, s.right = t.right, i = s;
        else {
          for (s = t.left.right; s.right !== null; )
            s = s.right;
          s.parent && (s.parent.right = s.left, i = s.parent, s.left = t.left, s.right = t.right);
        }
      else if (t.right.left === null)
        s = t.right, s.left = t.left, i = s;
      else {
        for (s = t.right.left; s.left !== null; )
          s = s.left;
        s.parent && (s.parent.left = s.right, i = s.parent, s.left = t.left, s.right = t.right);
      }
      t.parent !== null ? t.isLeftChild() ? t.parent.left = s : t.parent.right = s : this._setRoot(s), i && this._rebalance(i);
    }
    t.dispose();
  }
  /**
   * Rotate the tree to the left
   */
  _rotateLeft(t) {
    const n = t.parent, s = t.isLeftChild(), i = t.right;
    i && (t.right = i.left, i.left = t), n !== null ? s ? n.left = i : n.right = i : this._setRoot(i);
  }
  /**
   * Rotate the tree to the right
   */
  _rotateRight(t) {
    const n = t.parent, s = t.isLeftChild(), i = t.left;
    i && (t.left = i.right, i.right = t), n !== null ? s ? n.left = i : n.right = i : this._setRoot(i);
  }
  /**
   * Balance the BST
   */
  _rebalance(t) {
    const n = t.getBalance();
    n > 1 && t.left ? t.left.getBalance() < 0 ? this._rotateLeft(t.left) : this._rotateRight(t) : n < -1 && t.right && (t.right.getBalance() > 0 ? this._rotateRight(t.right) : this._rotateLeft(t));
  }
  /**
   * Get an event whose time and duration span the give time. Will
   * return the match whose "time" value is closest to the given time.
   * @return  The event which spans the desired time
   */
  get(t) {
    if (this._root !== null) {
      const n = [];
      if (this._root.search(t, n), n.length > 0) {
        let s = n[0];
        for (let i = 1; i < n.length; i++)
          n[i].low > s.low && (s = n[i]);
        return s.event;
      }
    }
    return null;
  }
  /**
   * Iterate over everything in the timeline.
   * @param  callback The callback to invoke with every item
   */
  forEach(t) {
    if (this._root !== null) {
      const n = [];
      this._root.traverse((s) => n.push(s)), n.forEach((s) => {
        s.event && t(s.event);
      });
    }
    return this;
  }
  /**
   * Iterate over everything in the array in which the given time
   * overlaps with the time and duration time of the event.
   * @param  time The time to check if items are overlapping
   * @param  callback The callback to invoke with every item
   */
  forEachAtTime(t, n) {
    if (this._root !== null) {
      const s = [];
      this._root.search(t, s), s.forEach((i) => {
        i.event && n(i.event);
      });
    }
    return this;
  }
  /**
   * Iterate over everything in the array in which the time is greater
   * than or equal to the given time.
   * @param  time The time to check if items are before
   * @param  callback The callback to invoke with every item
   */
  forEachFrom(t, n) {
    if (this._root !== null) {
      const s = [];
      this._root.searchAfter(t, s), s.forEach((i) => {
        i.event && n(i.event);
      });
    }
    return this;
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this._root !== null && this._root.traverse((t) => t.dispose()), this._root = null, this;
  }
}
class W0 {
  constructor(t, n, s) {
    this._left = null, this._right = null, this.parent = null, this.height = 0, this.event = s, this.low = t, this.high = n, this.max = this.high;
  }
  /**
   * Insert a node into the correct spot in the tree
   */
  insert(t) {
    t.low <= this.low ? this.left === null ? this.left = t : this.left.insert(t) : this.right === null ? this.right = t : this.right.insert(t);
  }
  /**
   * Search the tree for nodes which overlap
   * with the given point
   * @param  point  The point to query
   * @param  results  The array to put the results
   */
  search(t, n) {
    t > this.max || (this.left !== null && this.left.search(t, n), this.low <= t && this.high > t && n.push(this), !(this.low > t) && this.right !== null && this.right.search(t, n));
  }
  /**
   * Search the tree for nodes which are less
   * than the given point
   * @param  point  The point to query
   * @param  results  The array to put the results
   */
  searchAfter(t, n) {
    this.low >= t && (n.push(this), this.left !== null && this.left.searchAfter(t, n)), this.right !== null && this.right.searchAfter(t, n);
  }
  /**
   * Invoke the callback on this element and both it's branches
   * @param  {Function}  callback
   */
  traverse(t) {
    t(this), this.left !== null && this.left.traverse(t), this.right !== null && this.right.traverse(t);
  }
  /**
   * Update the height of the node
   */
  updateHeight() {
    this.left !== null && this.right !== null ? this.height = Math.max(this.left.height, this.right.height) + 1 : this.right !== null ? this.height = this.right.height + 1 : this.left !== null ? this.height = this.left.height + 1 : this.height = 0;
  }
  /**
   * Update the height of the node
   */
  updateMax() {
    this.max = this.high, this.left !== null && (this.max = Math.max(this.max, this.left.max)), this.right !== null && (this.max = Math.max(this.max, this.right.max));
  }
  /**
   * The balance is how the leafs are distributed on the node
   * @return  Negative numbers are balanced to the right
   */
  getBalance() {
    let t = 0;
    return this.left !== null && this.right !== null ? t = this.left.height - this.right.height : this.left !== null ? t = this.left.height + 1 : this.right !== null && (t = -(this.right.height + 1)), t;
  }
  /**
   * @returns true if this node is the left child of its parent
   */
  isLeftChild() {
    return this.parent !== null && this.parent.left === this;
  }
  /**
   * get/set the left node
   */
  get left() {
    return this._left;
  }
  set left(t) {
    this._left = t, t !== null && (t.parent = this), this.updateHeight(), this.updateMax();
  }
  /**
   * get/set the right node
   */
  get right() {
    return this._right;
  }
  set right(t) {
    this._right = t, t !== null && (t.parent = this), this.updateHeight(), this.updateMax();
  }
  /**
   * null out references.
   */
  dispose() {
    this.parent = null, this._left = null, this._right = null, this.event = null;
  }
}
const j0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null
}, Symbol.toStringTag, { value: "Module" }));
class L0 extends Nn {
  /**
   * @param initialValue The value to return if there is no scheduled values
   */
  constructor(t) {
    super(), this.name = "TimelineValue", this._timeline = new $e({
      memory: 10
    }), this._initialValue = t;
  }
  /**
   * Set the value at the given time
   */
  set(t, n) {
    return this._timeline.add({
      value: t,
      time: n
    }), this;
  }
  /**
   * Get the value at the given time
   */
  get(t) {
    const n = this._timeline.get(t);
    return n ? n.value : this._initialValue;
  }
}
class Ze extends B {
  constructor() {
    super(P(Ze.getDefaults(), arguments, [
      "context"
    ]));
  }
  connect(t, n = 0, s = 0) {
    return Hi(this, t, n, s), this;
  }
}
class hn extends Ze {
  constructor() {
    const t = P(hn.getDefaults(), arguments, ["mapping", "length"]);
    super(t), this.name = "WaveShaper", this._shaper = this.context.createWaveShaper(), this.input = this._shaper, this.output = this._shaper, _e(t.mapping) || t.mapping instanceof Float32Array ? this.curve = Float32Array.from(t.mapping) : jd(t.mapping) && this.setMap(t.mapping, t.length);
  }
  static getDefaults() {
    return Object.assign(dt.getDefaults(), {
      length: 1024
    });
  }
  /**
   * Uses a mapping function to set the value of the curve.
   * @param mapping The function used to define the values.
   *                The mapping function take two arguments:
   *                the first is the value at the current position
   *                which goes from -1 to 1 over the number of elements
   *                in the curve array. The second argument is the array position.
   * @example
   * const shaper = new Tone.WaveShaper();
   * // map the input signal from [-1, 1] to [0, 10]
   * shaper.setMap((val, index) => (val + 1) * 5);
   */
  setMap(t, n = 1024) {
    const s = new Float32Array(n);
    for (let i = 0, r = n; i < r; i++) {
      const o = i / (r - 1) * 2 - 1;
      s[i] = t(o, i);
    }
    return this.curve = s, this;
  }
  /**
   * The array to set as the waveshaper curve. For linear curves
   * array length does not make much difference, but for complex curves
   * longer arrays will provide smoother interpolation.
   */
  get curve() {
    return this._shaper.curve;
  }
  set curve(t) {
    this._shaper.curve = t;
  }
  /**
   * Specifies what type of oversampling (if any) should be used when
   * applying the shaping curve. Can either be "none", "2x" or "4x".
   */
  get oversample() {
    return this._shaper.oversample;
  }
  set oversample(t) {
    const n = ["none", "2x", "4x"].some((s) => s.includes(t));
    st(n, "oversampling must be either 'none', '2x', or '4x'"), this._shaper.oversample = t;
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._shaper.disconnect(), this;
  }
}
class ai extends Ze {
  constructor() {
    const t = P(ai.getDefaults(), arguments, [
      "value"
    ]);
    super(t), this.name = "Pow", this._exponentScaler = this.input = this.output = new hn({
      context: this.context,
      mapping: this._expFunc(t.value),
      length: 8192
    }), this._exponent = t.value;
  }
  static getDefaults() {
    return Object.assign(Ze.getDefaults(), {
      value: 1
    });
  }
  /**
   * the function which maps the waveshaper
   * @param exponent exponent value
   */
  _expFunc(t) {
    return (n) => Math.pow(Math.abs(n), t);
  }
  /**
   * The value of the exponent.
   */
  get value() {
    return this._exponent;
  }
  set value(t) {
    this._exponent = t, this._exponentScaler.setMap(this._expFunc(this._exponent));
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._exponentScaler.dispose(), this;
  }
}
class Un {
  /**
   * @param transport The transport object which the event belongs to
   */
  constructor(t, n) {
    this.id = Un._eventId++, this._remainderTime = 0;
    const s = Object.assign(Un.getDefaults(), n);
    this.transport = t, this.callback = s.callback, this._once = s.once, this.time = Math.floor(s.time), this._remainderTime = s.time - this.time;
  }
  static getDefaults() {
    return {
      callback: St,
      once: !1,
      time: 0
    };
  }
  /**
   * Get the time and remainder time.
   */
  get floatTime() {
    return this.time + this._remainderTime;
  }
  /**
   * Invoke the event callback.
   * @param  time  The AudioContext time in seconds of the event
   */
  invoke(t) {
    if (this.callback) {
      const n = this.transport.bpm.getDurationOfTicks(1, t);
      this.callback(t + this._remainderTime * n), this._once && this.transport.clear(this.id);
    }
  }
  /**
   * Clean up
   */
  dispose() {
    return this.callback = void 0, this;
  }
}
Un._eventId = 0;
class Uc extends Un {
  /**
   * @param transport The transport object which the event belongs to
   */
  constructor(t, n) {
    super(t, n), this._currentId = -1, this._nextId = -1, this._nextTick = this.time, this._boundRestart = this._restart.bind(this);
    const s = Object.assign(Uc.getDefaults(), n);
    this.duration = s.duration, this._interval = s.interval, this._nextTick = s.time, this.transport.on("start", this._boundRestart), this.transport.on("loopStart", this._boundRestart), this.transport.on("ticks", this._boundRestart), this.context = this.transport.context, this._restart();
  }
  static getDefaults() {
    return Object.assign({}, Un.getDefaults(), {
      duration: 1 / 0,
      interval: 1,
      once: !1
    });
  }
  /**
   * Invoke the callback. Returns the tick time which
   * the next event should be scheduled at.
   * @param  time  The AudioContext time in seconds of the event
   */
  invoke(t) {
    this._createEvents(t), super.invoke(t);
  }
  /**
   * Create an event on the transport on the nextTick
   */
  _createEvent() {
    return Zr(this._nextTick, this.floatTime + this.duration) ? this.transport.scheduleOnce(this.invoke.bind(this), new Yt(this.context, this._nextTick).toSeconds()) : -1;
  }
  /**
   * Push more events onto the timeline to keep up with the position of the timeline
   */
  _createEvents(t) {
    Zr(this._nextTick + this._interval, this.floatTime + this.duration) && (this._nextTick += this._interval, this._currentId = this._nextId, this._nextId = this.transport.scheduleOnce(this.invoke.bind(this), new Yt(this.context, this._nextTick).toSeconds()));
  }
  /**
   * Re-compute the events when the transport time has changed from a start/ticks/loopStart event
   */
  _restart(t) {
    this.transport.clear(this._currentId), this.transport.clear(this._nextId), this._nextTick = this.floatTime;
    const n = this.transport.getTicksAtTime(t);
    $s(n, this.time) && (this._nextTick = this.floatTime + Math.ceil((n - this.floatTime) / this._interval) * this._interval), this._currentId = this._createEvent(), this._nextTick += this._interval, this._nextId = this._createEvent();
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this.transport.clear(this._currentId), this.transport.clear(this._nextId), this.transport.off("start", this._boundRestart), this.transport.off("loopStart", this._boundRestart), this.transport.off("ticks", this._boundRestart), this;
  }
}
class mo extends he {
  constructor() {
    const t = P(mo.getDefaults(), arguments);
    super(t), this.name = "Transport", this._loop = new L0(!1), this._loopStart = 0, this._loopEnd = 0, this._scheduledEvents = {}, this._timeline = new $e(), this._repeatedEvents = new Yd(), this._syncedSignals = [], this._swingAmount = 0, this._ppq = t.ppq, this._clock = new ri({
      callback: this._processTick.bind(this),
      context: this.context,
      frequency: 0,
      units: "bpm"
    }), this._bindClockEvents(), this.bpm = this._clock.frequency, this._clock.frequency.multiplier = t.ppq, this.bpm.setValueAtTime(t.bpm, 0), ct(this, "bpm"), this._timeSignature = t.timeSignature, this._swingTicks = t.ppq / 2;
  }
  static getDefaults() {
    return Object.assign(he.getDefaults(), {
      bpm: 120,
      loopEnd: "4m",
      loopStart: 0,
      ppq: 192,
      swing: 0,
      swingSubdivision: "8n",
      timeSignature: 4
    });
  }
  //-------------------------------------
  // 	TICKS
  //-------------------------------------
  /**
   * called on every tick
   * @param  tickTime clock relative tick time
   */
  _processTick(t, n) {
    if (this._loop.get(t) && n >= this._loopEnd && (this.emit("loopEnd", t), this._clock.setTicksAtTime(this._loopStart, t), n = this._loopStart, this.emit("loopStart", t, this._clock.getSecondsAtTime(t)), this.emit("loop", t)), this._swingAmount > 0 && n % this._ppq !== 0 && // not on a downbeat
    n % (this._swingTicks * 2) !== 0) {
      const s = n % (this._swingTicks * 2) / (this._swingTicks * 2), i = Math.sin(s * Math.PI) * this._swingAmount;
      t += new Yt(this.context, this._swingTicks * 2 / 3).toSeconds() * i;
    }
    Na(!0), this._timeline.forEachAtTime(n, (s) => s.invoke(t)), Na(!1);
  }
  //-------------------------------------
  // 	SCHEDULABLE EVENTS
  //-------------------------------------
  /**
   * Schedule an event along the timeline.
   * @param callback The callback to be invoked at the time.
   * @param time The time to invoke the callback at.
   * @return The id of the event which can be used for canceling the event.
   * @example
   * // schedule an event on the 16th measure
   * Tone.getTransport().schedule((time) => {
   * 	// invoked on measure 16
   * 	console.log("measure 16!");
   * }, "16:0:0");
   */
  schedule(t, n) {
    const s = new Un(this, {
      callback: t,
      time: new re(this.context, n).toTicks()
    });
    return this._addEvent(s, this._timeline);
  }
  /**
   * Schedule a repeated event along the timeline. The event will fire
   * at the `interval` starting at the `startTime` and for the specified
   * `duration`.
   * @param  callback   The callback to invoke.
   * @param  interval   The duration between successive callbacks. Must be a positive number.
   * @param  startTime  When along the timeline the events should start being invoked.
   * @param  duration How long the event should repeat.
   * @return  The ID of the scheduled event. Use this to cancel the event.
   * @example
   * const osc = new Tone.Oscillator().toDestination().start();
   * // a callback invoked every eighth note after the first measure
   * Tone.getTransport().scheduleRepeat((time) => {
   * 	osc.start(time).stop(time + 0.1);
   * }, "8n", "1m");
   */
  scheduleRepeat(t, n, s, i = 1 / 0) {
    const r = new Uc(this, {
      callback: t,
      duration: new Le(this.context, i).toTicks(),
      interval: new Le(this.context, n).toTicks(),
      time: new re(this.context, s).toTicks()
    });
    return this._addEvent(r, this._repeatedEvents);
  }
  /**
   * Schedule an event that will be removed after it is invoked.
   * @param callback The callback to invoke once.
   * @param time The time the callback should be invoked.
   * @returns The ID of the scheduled event.
   */
  scheduleOnce(t, n) {
    const s = new Un(this, {
      callback: t,
      once: !0,
      time: new re(this.context, n).toTicks()
    });
    return this._addEvent(s, this._timeline);
  }
  /**
   * Clear the passed in event id from the timeline
   * @param eventId The id of the event.
   */
  clear(t) {
    if (this._scheduledEvents.hasOwnProperty(t)) {
      const n = this._scheduledEvents[t.toString()];
      n.timeline.remove(n.event), n.event.dispose(), delete this._scheduledEvents[t.toString()];
    }
    return this;
  }
  /**
   * Add an event to the correct timeline. Keep track of the
   * timeline it was added to.
   * @returns the event id which was just added
   */
  _addEvent(t, n) {
    return this._scheduledEvents[t.id.toString()] = {
      event: t,
      timeline: n
    }, n.add(t), t.id;
  }
  /**
   * Remove scheduled events from the timeline after
   * the given time. Repeated events will be removed
   * if their startTime is after the given time
   * @param after Clear all events after this time.
   */
  cancel(t = 0) {
    const n = this.toTicks(t);
    return this._timeline.forEachFrom(n, (s) => this.clear(s.id)), this._repeatedEvents.forEachFrom(n, (s) => this.clear(s.id)), this;
  }
  //-------------------------------------
  // 	START/STOP/PAUSE
  //-------------------------------------
  /**
   * Bind start/stop/pause events from the clock and emit them.
   */
  _bindClockEvents() {
    this._clock.on("start", (t, n) => {
      n = new Yt(this.context, n).toSeconds(), this.emit("start", t, n);
    }), this._clock.on("stop", (t) => {
      this.emit("stop", t);
    }), this._clock.on("pause", (t) => {
      this.emit("pause", t);
    });
  }
  /**
   * Returns the playback state of the source, either "started", "stopped", or "paused"
   */
  get state() {
    return this._clock.getStateAtTime(this.now());
  }
  /**
   * Start the transport and all sources synced to the transport.
   * @param  time The time when the transport should start.
   * @param  offset The timeline offset to start the transport.
   * @example
   * // start the transport in one second starting at beginning of the 5th measure.
   * Tone.getTransport().start("+1", "4:0:0");
   */
  start(t, n) {
    this.context.resume();
    let s;
    return bt(n) && (s = this.toTicks(n)), this._clock.start(t, s), this;
  }
  /**
   * Stop the transport and all sources synced to the transport.
   * @param time The time when the transport should stop.
   * @example
   * Tone.getTransport().stop();
   */
  stop(t) {
    return this._clock.stop(t), this;
  }
  /**
   * Pause the transport and all sources synced to the transport.
   */
  pause(t) {
    return this._clock.pause(t), this;
  }
  /**
   * Toggle the current state of the transport. If it is
   * started, it will stop it, otherwise it will start the Transport.
   * @param  time The time of the event
   */
  toggle(t) {
    return t = this.toSeconds(t), this._clock.getStateAtTime(t) !== "started" ? this.start(t) : this.stop(t), this;
  }
  //-------------------------------------
  // 	SETTERS/GETTERS
  //-------------------------------------
  /**
   * The time signature as just the numerator over 4.
   * For example 4/4 would be just 4 and 6/8 would be 3.
   * @example
   * // common time
   * Tone.getTransport().timeSignature = 4;
   * // 7/8
   * Tone.getTransport().timeSignature = [7, 8];
   * // this will be reduced to a single number
   * Tone.getTransport().timeSignature; // returns 3.5
   */
  get timeSignature() {
    return this._timeSignature;
  }
  set timeSignature(t) {
    _e(t) && (t = t[0] / t[1] * 4), this._timeSignature = t;
  }
  /**
   * When the Transport.loop = true, this is the starting position of the loop.
   */
  get loopStart() {
    return new Le(this.context, this._loopStart, "i").toSeconds();
  }
  set loopStart(t) {
    this._loopStart = this.toTicks(t);
  }
  /**
   * When the Transport.loop = true, this is the ending position of the loop.
   */
  get loopEnd() {
    return new Le(this.context, this._loopEnd, "i").toSeconds();
  }
  set loopEnd(t) {
    this._loopEnd = this.toTicks(t);
  }
  /**
   * If the transport loops or not.
   */
  get loop() {
    return this._loop.get(this.now());
  }
  set loop(t) {
    this._loop.set(t, this.now());
  }
  /**
   * Set the loop start and stop at the same time.
   * @example
   * // loop over the first measure
   * Tone.getTransport().setLoopPoints(0, "1m");
   * Tone.getTransport().loop = true;
   */
  setLoopPoints(t, n) {
    return this.loopStart = t, this.loopEnd = n, this;
  }
  /**
   * The swing value. Between 0-1 where 1 equal to the note + half the subdivision.
   */
  get swing() {
    return this._swingAmount;
  }
  set swing(t) {
    this._swingAmount = t;
  }
  /**
   * Set the subdivision which the swing will be applied to.
   * The default value is an 8th note. Value must be less
   * than a quarter note.
   */
  get swingSubdivision() {
    return new Yt(this.context, this._swingTicks).toNotation();
  }
  set swingSubdivision(t) {
    this._swingTicks = this.toTicks(t);
  }
  /**
   * The Transport's position in Bars:Beats:Sixteenths.
   * Setting the value will jump to that position right away.
   */
  get position() {
    const t = this.now(), n = this._clock.getTicksAtTime(t);
    return new Yt(this.context, n).toBarsBeatsSixteenths();
  }
  set position(t) {
    const n = this.toTicks(t);
    this.ticks = n;
  }
  /**
   * The Transport's position in seconds.
   * Setting the value will jump to that position right away.
   */
  get seconds() {
    return this._clock.seconds;
  }
  set seconds(t) {
    const n = this.now(), s = this._clock.frequency.timeToTicks(t, n);
    this.ticks = s;
  }
  /**
   * The Transport's loop position as a normalized value. Always
   * returns 0 if the Transport.loop = false.
   */
  get progress() {
    if (this.loop) {
      const t = this.now();
      return (this._clock.getTicksAtTime(t) - this._loopStart) / (this._loopEnd - this._loopStart);
    } else
      return 0;
  }
  /**
   * The Transport's current tick position.
   */
  get ticks() {
    return this._clock.ticks;
  }
  set ticks(t) {
    if (this._clock.ticks !== t) {
      const n = this.now();
      if (this.state === "started") {
        const s = this._clock.getTicksAtTime(n), i = this._clock.frequency.getDurationOfTicks(Math.ceil(s) - s, n), r = n + i;
        this.emit("stop", r), this._clock.setTicksAtTime(t, r), this.emit("start", r, this._clock.getSecondsAtTime(r));
      } else
        this.emit("ticks", n), this._clock.setTicksAtTime(t, n);
    }
  }
  /**
   * Get the clock's ticks at the given time.
   * @param  time  When to get the tick value
   * @return The tick value at the given time.
   */
  getTicksAtTime(t) {
    return this._clock.getTicksAtTime(t);
  }
  /**
   * Return the elapsed seconds at the given time.
   * @param  time  When to get the elapsed seconds
   * @return  The number of elapsed seconds
   */
  getSecondsAtTime(t) {
    return this._clock.getSecondsAtTime(t);
  }
  /**
   * Pulses Per Quarter note. This is the smallest resolution
   * the Transport timing supports. This should be set once
   * on initialization and not set again. Changing this value
   * after other objects have been created can cause problems.
   */
  get PPQ() {
    return this._clock.frequency.multiplier;
  }
  set PPQ(t) {
    this._clock.frequency.multiplier = t;
  }
  //-------------------------------------
  // 	SYNCING
  //-------------------------------------
  /**
   * Returns the time aligned to the next subdivision
   * of the Transport. If the Transport is not started,
   * it will return 0.
   * Note: this will not work precisely during tempo ramps.
   * @param  subdivision  The subdivision to quantize to
   * @return  The context time of the next subdivision.
   * @example
   * // the transport must be started, otherwise returns 0
   * Tone.getTransport().start();
   * Tone.getTransport().nextSubdivision("4n");
   */
  nextSubdivision(t) {
    if (t = this.toTicks(t), this.state !== "started")
      return 0;
    {
      const n = this.now(), s = this.getTicksAtTime(n), i = t - s % t;
      return this._clock.nextTickTime(i, n);
    }
  }
  /**
   * Attaches the signal to the tempo control signal so that
   * any changes in the tempo will change the signal in the same
   * ratio.
   *
   * @param signal
   * @param ratio Optionally pass in the ratio between the two signals.
   * 			Otherwise it will be computed based on their current values.
   */
  syncSignal(t, n) {
    const s = this.now();
    let i = this.bpm, r = 1 / (60 / i.getValueAtTime(s) / this.PPQ), o = [];
    if (t.units === "time") {
      const c = 0.015625 / r, l = new nt(c), u = new ai(-1), h = new nt(c);
      i.chain(l, u, h), i = h, r = 1 / r, o = [l, u, h];
    }
    n || (t.getValueAtTime(s) !== 0 ? n = t.getValueAtTime(s) / r : n = 0);
    const a = new nt(n);
    return i.connect(a), a.connect(t._param), o.push(a), this._syncedSignals.push({
      initial: t.value,
      nodes: o,
      signal: t
    }), t.value = 0, this;
  }
  /**
   * Unsyncs a previously synced signal from the transport's control.
   * @see {@link syncSignal}.
   */
  unsyncSignal(t) {
    for (let n = this._syncedSignals.length - 1; n >= 0; n--) {
      const s = this._syncedSignals[n];
      s.signal === t && (s.nodes.forEach((i) => i.dispose()), s.signal.value = s.initial, this._syncedSignals.splice(n, 1));
    }
    return this;
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._clock.dispose(), Xi(this, "bpm"), this._timeline.dispose(), this._repeatedEvents.dispose(), this;
  }
}
ei.mixin(mo);
uo((e) => {
  e.transport = new mo({ context: e });
});
ho((e) => {
  e.transport.dispose();
});
class Qt extends B {
  constructor(t) {
    super(t), this.input = void 0, this._state = new ii("stopped"), this._synced = !1, this._scheduled = [], this._syncedStart = St, this._syncedStop = St, this._state.memory = 100, this._state.increasing = !0, this._volume = this.output = new un({
      context: this.context,
      mute: t.mute,
      volume: t.volume
    }), this.volume = this._volume.volume, ct(this, "volume"), this.onstop = t.onstop;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      mute: !1,
      onstop: St,
      volume: 0
    });
  }
  /**
   * Returns the playback state of the source, either "started" or "stopped".
   * @example
   * const player = new Tone.Player("https://tonejs.github.io/audio/berklee/ahntone_c3.mp3", () => {
   * 	player.start();
   * 	console.log(player.state);
   * }).toDestination();
   */
  get state() {
    return this._synced ? this.context.transport.state === "started" ? this._state.getValueAtTime(this.context.transport.seconds) : "stopped" : this._state.getValueAtTime(this.now());
  }
  /**
   * Mute the output.
   * @example
   * const osc = new Tone.Oscillator().toDestination().start();
   * // mute the output
   * osc.mute = true;
   */
  get mute() {
    return this._volume.mute;
  }
  set mute(t) {
    this._volume.mute = t;
  }
  /**
   * Ensure that the scheduled time is not before the current time.
   * Should only be used when scheduled unsynced.
   */
  _clampToCurrentTime(t) {
    return this._synced ? t : Math.max(t, this.context.currentTime);
  }
  /**
   * Start the source at the specified time. If no time is given,
   * start the source now.
   * @param  time When the source should be started.
   * @example
   * const source = new Tone.Oscillator().toDestination();
   * source.start("+0.5"); // starts the source 0.5 seconds from now
   */
  start(t, n, s) {
    let i = We(t) && this._synced ? this.context.transport.seconds : this.toSeconds(t);
    if (i = this._clampToCurrentTime(i), !this._synced && this._state.getValueAtTime(i) === "started")
      st($s(i, this._state.get(i).time), "Start time must be strictly greater than previous start time"), this._state.cancel(i), this._state.setStateAtTime("started", i), this.log("restart", i), this.restart(i, n, s);
    else if (this.log("start", i), this._state.setStateAtTime("started", i), this._synced) {
      const r = this._state.get(i);
      r && (r.offset = this.toSeconds(Je(n, 0)), r.duration = s ? this.toSeconds(s) : void 0);
      const o = this.context.transport.schedule((a) => {
        this._start(a, n, s);
      }, i);
      this._scheduled.push(o), this.context.transport.state === "started" && this.context.transport.getSecondsAtTime(this.immediate()) > i && this._syncedStart(this.now(), this.context.transport.seconds);
    } else
      Vc(this.context), this._start(i, n, s);
    return this;
  }
  /**
   * Stop the source at the specified time. If no time is given,
   * stop the source now.
   * @param  time When the source should be stopped.
   * @example
   * const source = new Tone.Oscillator().toDestination();
   * source.start();
   * source.stop("+0.5"); // stops the source 0.5 seconds from now
   */
  stop(t) {
    let n = We(t) && this._synced ? this.context.transport.seconds : this.toSeconds(t);
    if (n = this._clampToCurrentTime(n), this._state.getValueAtTime(n) === "started" || bt(this._state.getNextState("started", n))) {
      if (this.log("stop", n), !this._synced)
        this._stop(n);
      else {
        const s = this.context.transport.schedule(this._stop.bind(this), n);
        this._scheduled.push(s);
      }
      this._state.cancel(n), this._state.setStateAtTime("stopped", n);
    }
    return this;
  }
  /**
   * Restart the source.
   */
  restart(t, n, s) {
    return t = this.toSeconds(t), this._state.getValueAtTime(t) === "started" && (this._state.cancel(t), this._restart(t, n, s)), this;
  }
  /**
   * Sync the source to the Transport so that all subsequent
   * calls to `start` and `stop` are synced to the TransportTime
   * instead of the AudioContext time.
   *
   * @example
   * const osc = new Tone.Oscillator().toDestination();
   * // sync the source so that it plays between 0 and 0.3 on the Transport's timeline
   * osc.sync().start(0).stop(0.3);
   * // start the transport.
   * Tone.Transport.start();
   * // set it to loop once a second
   * Tone.Transport.loop = true;
   * Tone.Transport.loopEnd = 1;
   */
  sync() {
    return this._synced || (this._synced = !0, this._syncedStart = (t, n) => {
      if ($s(n, 0)) {
        const s = this._state.get(n);
        if (s && s.state === "started" && s.time !== n) {
          const i = n - this.toSeconds(s.time);
          let r;
          s.duration && (r = this.toSeconds(s.duration) - i), this._start(t, this.toSeconds(s.offset) + i, r);
        }
      }
    }, this._syncedStop = (t) => {
      const n = this.context.transport.getSecondsAtTime(Math.max(t - this.sampleTime, 0));
      this._state.getValueAtTime(n) === "started" && this._stop(t);
    }, this.context.transport.on("start", this._syncedStart), this.context.transport.on("loopStart", this._syncedStart), this.context.transport.on("stop", this._syncedStop), this.context.transport.on("pause", this._syncedStop), this.context.transport.on("loopEnd", this._syncedStop)), this;
  }
  /**
   * Unsync the source to the Transport.
   * @see {@link sync}
   */
  unsync() {
    return this._synced && (this.context.transport.off("stop", this._syncedStop), this.context.transport.off("pause", this._syncedStop), this.context.transport.off("loopEnd", this._syncedStop), this.context.transport.off("start", this._syncedStart), this.context.transport.off("loopStart", this._syncedStart)), this._synced = !1, this._scheduled.forEach((t) => this.context.transport.clear(t)), this._scheduled = [], this._state.cancel(0), this._stop(0), this;
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this.onstop = St, this.unsync(), this._volume.dispose(), this._state.dispose(), this;
  }
}
class is extends Gs {
  constructor() {
    const t = P(is.getDefaults(), arguments, ["url", "onload"]);
    super(t), this.name = "ToneBufferSource", this._source = this.context.createBufferSource(), this._internalChannels = [this._source], this._sourceStarted = !1, this._sourceStopped = !1, Fe(this._source, this._gainNode), this._source.onended = () => this._stopSource(), this.playbackRate = new gt({
      context: this.context,
      param: this._source.playbackRate,
      units: "positive",
      value: t.playbackRate
    }), this.loop = t.loop, this.loopStart = t.loopStart, this.loopEnd = t.loopEnd, this._buffer = new Rt(t.url, t.onload, t.onerror), this._internalChannels.push(this._source);
  }
  static getDefaults() {
    return Object.assign(Gs.getDefaults(), {
      url: new Rt(),
      loop: !1,
      loopEnd: 0,
      loopStart: 0,
      onload: St,
      onerror: St,
      playbackRate: 1
    });
  }
  /**
   * The fadeIn time of the amplitude envelope.
   */
  get fadeIn() {
    return this._fadeIn;
  }
  set fadeIn(t) {
    this._fadeIn = t;
  }
  /**
   * The fadeOut time of the amplitude envelope.
   */
  get fadeOut() {
    return this._fadeOut;
  }
  set fadeOut(t) {
    this._fadeOut = t;
  }
  /**
   * The curve applied to the fades, either "linear" or "exponential"
   */
  get curve() {
    return this._curve;
  }
  set curve(t) {
    this._curve = t;
  }
  /**
   * Start the buffer
   * @param  time When the player should start.
   * @param  offset The offset from the beginning of the sample to start at.
   * @param  duration How long the sample should play. If no duration is given, it will default to the full length of the sample (minus any offset)
   * @param  gain  The gain to play the buffer back at.
   */
  start(t, n, s, i = 1) {
    st(this.buffer.loaded, "buffer is either not set or not loaded");
    const r = this.toSeconds(t);
    this._startGain(r, i), this.loop ? n = Je(n, this.loopStart) : n = Je(n, 0);
    let o = Math.max(this.toSeconds(n), 0);
    if (this.loop) {
      const a = this.toSeconds(this.loopEnd) || this.buffer.duration, c = this.toSeconds(this.loopStart), l = a - c;
      Va(o, a) && (o = (o - c) % l + c), sn(o, this.buffer.duration) && (o = 0);
    }
    if (this._source.buffer = this.buffer.get(), this._source.loopEnd = this.toSeconds(this.loopEnd) || this.buffer.duration, Zr(o, this.buffer.duration) && (this._sourceStarted = !0, this._source.start(r, o)), bt(s)) {
      let a = this.toSeconds(s);
      a = Math.max(a, 0), this.stop(r + a);
    }
    return this;
  }
  _stopSource(t) {
    !this._sourceStopped && this._sourceStarted && (this._sourceStopped = !0, this._source.stop(this.toSeconds(t)), this._onended());
  }
  /**
   * If loop is true, the loop will start at this position.
   */
  get loopStart() {
    return this._source.loopStart;
  }
  set loopStart(t) {
    this._source.loopStart = this.toSeconds(t);
  }
  /**
   * If loop is true, the loop will end at this position.
   */
  get loopEnd() {
    return this._source.loopEnd;
  }
  set loopEnd(t) {
    this._source.loopEnd = this.toSeconds(t);
  }
  /**
   * The audio buffer belonging to the player.
   */
  get buffer() {
    return this._buffer;
  }
  set buffer(t) {
    this._buffer.set(t);
  }
  /**
   * If the buffer should loop once it's over.
   */
  get loop() {
    return this._source.loop;
  }
  set loop(t) {
    this._source.loop = t, this._sourceStarted && this.cancelStop();
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._source.onended = null, this._source.disconnect(), this._buffer.dispose(), this.playbackRate.dispose(), this;
  }
}
class Hn extends Qt {
  constructor() {
    const t = P(Hn.getDefaults(), arguments, [
      "type"
    ]);
    super(t), this.name = "Noise", this._source = null, this._playbackRate = t.playbackRate, this.type = t.type, this._fadeIn = t.fadeIn, this._fadeOut = t.fadeOut;
  }
  static getDefaults() {
    return Object.assign(Qt.getDefaults(), {
      fadeIn: 0,
      fadeOut: 0,
      playbackRate: 1,
      type: "white"
    });
  }
  /**
   * The type of the noise. Can be "white", "brown", or "pink".
   * @example
   * const noise = new Tone.Noise().toDestination().start();
   * noise.type = "brown";
   */
  get type() {
    return this._type;
  }
  set type(t) {
    if (st(t in lu, "Noise: invalid type: " + t), this._type !== t && (this._type = t, this.state === "started")) {
      const n = this.now();
      this._stop(n), this._start(n);
    }
  }
  /**
   * The playback rate of the noise. Affects
   * the "frequency" of the noise.
   */
  get playbackRate() {
    return this._playbackRate;
  }
  set playbackRate(t) {
    this._playbackRate = t, this._source && (this._source.playbackRate.value = t);
  }
  /**
   * internal start method
   */
  _start(t) {
    const n = lu[this._type];
    this._source = new is({
      url: n,
      context: this.context,
      fadeIn: this._fadeIn,
      fadeOut: this._fadeOut,
      loop: !0,
      onended: () => this.onstop(this),
      playbackRate: this._playbackRate
    }).connect(this.output), this._source.start(this.toSeconds(t), Math.random() * (n.duration - 1e-3));
  }
  /**
   * internal stop method
   */
  _stop(t) {
    this._source && (this._source.stop(this.toSeconds(t)), this._source = null);
  }
  /**
   * The fadeIn time of the amplitude envelope.
   */
  get fadeIn() {
    return this._fadeIn;
  }
  set fadeIn(t) {
    this._fadeIn = t, this._source && (this._source.fadeIn = this._fadeIn);
  }
  /**
   * The fadeOut time of the amplitude envelope.
   */
  get fadeOut() {
    return this._fadeOut;
  }
  set fadeOut(t) {
    this._fadeOut = t, this._source && (this._source.fadeOut = this._fadeOut);
  }
  _restart(t) {
    this._stop(t), this._start(t);
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._source && this._source.disconnect(), this;
  }
}
const Rs = 44100 * 5, ra = 2, Tn = {
  brown: null,
  pink: null,
  white: null
}, lu = {
  get brown() {
    if (!Tn.brown) {
      const e = [];
      for (let t = 0; t < ra; t++) {
        const n = new Float32Array(Rs);
        e[t] = n;
        let s = 0;
        for (let i = 0; i < Rs; i++) {
          const r = Math.random() * 2 - 1;
          n[i] = (s + 0.02 * r) / 1.02, s = n[i], n[i] *= 3.5;
        }
      }
      Tn.brown = new Rt().fromArray(e);
    }
    return Tn.brown;
  },
  get pink() {
    if (!Tn.pink) {
      const e = [];
      for (let t = 0; t < ra; t++) {
        const n = new Float32Array(Rs);
        e[t] = n;
        let s, i, r, o, a, c, l;
        s = i = r = o = a = c = l = 0;
        for (let u = 0; u < Rs; u++) {
          const h = Math.random() * 2 - 1;
          s = 0.99886 * s + h * 0.0555179, i = 0.99332 * i + h * 0.0750759, r = 0.969 * r + h * 0.153852, o = 0.8665 * o + h * 0.3104856, a = 0.55 * a + h * 0.5329522, c = -0.7616 * c - h * 0.016898, n[u] = s + i + r + o + a + c + l + h * 0.5362, n[u] *= 0.11, l = h * 0.115926;
        }
      }
      Tn.pink = new Rt().fromArray(e);
    }
    return Tn.pink;
  },
  get white() {
    if (!Tn.white) {
      const e = [];
      for (let t = 0; t < ra; t++) {
        const n = new Float32Array(Rs);
        e[t] = n;
        for (let s = 0; s < Rs; s++)
          n[s] = Math.random() * 2 - 1;
      }
      Tn.white = new Rt().fromArray(e);
    }
    return Tn.white;
  }
};
class Ii extends B {
  constructor() {
    const t = P(Ii.getDefaults(), arguments, ["volume"]);
    super(t), this.name = "UserMedia", this._volume = this.output = new un({
      context: this.context,
      volume: t.volume
    }), this.volume = this._volume.volume, ct(this, "volume"), this.mute = t.mute;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      mute: !1,
      volume: 0
    });
  }
  /**
   * Open the media stream. If a string is passed in, it is assumed
   * to be the label or id of the stream, if a number is passed in,
   * it is the input number of the stream.
   * @param  labelOrId The label or id of the audio input media device.
   *                   With no argument, the default stream is opened.
   * @return The promise is resolved when the stream is open.
   */
  open(t) {
    return jt(this, void 0, void 0, function* () {
      st(Ii.supported, "UserMedia is not supported"), this.state === "started" && this.close();
      const n = yield Ii.enumerateDevices();
      ze(t) ? this._device = n[t] : (this._device = n.find((r) => r.label === t || r.deviceId === t), !this._device && n.length > 0 && (this._device = n[0]), st(bt(this._device), `No matching device ${t}`));
      const s = {
        audio: {
          echoCancellation: !1,
          sampleRate: this.context.sampleRate,
          noiseSuppression: !1,
          mozNoiseSuppression: !1
        }
      };
      this._device && (s.audio.deviceId = this._device.deviceId);
      const i = yield navigator.mediaDevices.getUserMedia(s);
      if (!this._stream) {
        this._stream = i;
        const r = this.context.createMediaStreamSource(i);
        Fe(r, this.output), this._mediaStream = r;
      }
      return this;
    });
  }
  /**
   * Close the media stream
   */
  close() {
    return this._stream && this._mediaStream && (this._stream.getAudioTracks().forEach((t) => {
      t.stop();
    }), this._stream = void 0, this._mediaStream.disconnect(), this._mediaStream = void 0), this._device = void 0, this;
  }
  /**
   * Returns a promise which resolves with the list of audio input devices available.
   * @return The promise that is resolved with the devices
   * @example
   * Tone.UserMedia.enumerateDevices().then((devices) => {
   * 	// print the device labels
   * 	console.log(devices.map(device => device.label));
   * });
   */
  static enumerateDevices() {
    return jt(this, void 0, void 0, function* () {
      return (yield navigator.mediaDevices.enumerateDevices()).filter((n) => n.kind === "audioinput");
    });
  }
  /**
   * Returns the playback state of the source, "started" when the microphone is open
   * and "stopped" when the mic is closed.
   */
  get state() {
    return this._stream && this._stream.active ? "started" : "stopped";
  }
  /**
   * Returns an identifier for the represented device that is
   * persisted across sessions. It is un-guessable by other applications and
   * unique to the origin of the calling application. It is reset when the
   * user clears cookies (for Private Browsing, a different identifier is
   * used that is not persisted across sessions). Returns undefined when the
   * device is not open.
   */
  get deviceId() {
    if (this._device)
      return this._device.deviceId;
  }
  /**
   * Returns a group identifier. Two devices have the
   * same group identifier if they belong to the same physical device.
   * Returns null  when the device is not open.
   */
  get groupId() {
    if (this._device)
      return this._device.groupId;
  }
  /**
   * Returns a label describing this device (for example "Built-in Microphone").
   * Returns undefined when the device is not open or label is not available
   * because of permissions.
   */
  get label() {
    if (this._device)
      return this._device.label;
  }
  /**
   * Mute the output.
   * @example
   * const mic = new Tone.UserMedia();
   * mic.open().then(() => {
   * 	// promise resolves when input is available
   * });
   * // mute the output
   * mic.mute = true;
   */
  get mute() {
    return this._volume.mute;
  }
  set mute(t) {
    this._volume.mute = t;
  }
  dispose() {
    return super.dispose(), this.close(), this._volume.dispose(), this.volume.dispose(), this;
  }
  /**
   * If getUserMedia is supported by the browser.
   */
  static get supported() {
    return bt(navigator.mediaDevices) && bt(navigator.mediaDevices.getUserMedia);
  }
}
function ws(e, t) {
  return jt(this, void 0, void 0, function* () {
    const n = t / e.context.sampleRate, s = new si(1, n, e.context.sampleRate);
    return new e.constructor(Object.assign(e.get(), {
      // should do 2 iterations
      frequency: 2 / n,
      // zero out the detune
      detune: 0,
      context: s
    })).toDestination().start(0), (yield s.render()).getChannelData(0);
  });
}
class Ki extends Gs {
  constructor() {
    const t = P(Ki.getDefaults(), arguments, ["frequency", "type"]);
    super(t), this.name = "ToneOscillatorNode", this._oscillator = this.context.createOscillator(), this._internalChannels = [this._oscillator], Fe(this._oscillator, this._gainNode), this.type = t.type, this.frequency = new gt({
      context: this.context,
      param: this._oscillator.frequency,
      units: "frequency",
      value: t.frequency
    }), this.detune = new gt({
      context: this.context,
      param: this._oscillator.detune,
      units: "cents",
      value: t.detune
    }), ct(this, ["frequency", "detune"]);
  }
  static getDefaults() {
    return Object.assign(Gs.getDefaults(), {
      detune: 0,
      frequency: 440,
      type: "sine"
    });
  }
  /**
   * Start the oscillator node at the given time
   * @param  time When to start the oscillator
   */
  start(t) {
    const n = this.toSeconds(t);
    return this.log("start", n), this._startGain(n), this._oscillator.start(n), this;
  }
  _stopSource(t) {
    this._oscillator.stop(t);
  }
  /**
   * Sets an arbitrary custom periodic waveform given a PeriodicWave.
   * @param  periodicWave PeriodicWave should be created with context.createPeriodicWave
   */
  setPeriodicWave(t) {
    return this._oscillator.setPeriodicWave(t), this;
  }
  /**
   * The oscillator type. Either 'sine', 'sawtooth', 'square', or 'triangle'
   */
  get type() {
    return this._oscillator.type;
  }
  set type(t) {
    this._oscillator.type = t;
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this.state === "started" && this.stop(), this._oscillator.disconnect(), this.frequency.dispose(), this.detune.dispose(), this;
  }
}
class Xt extends Qt {
  constructor() {
    const t = P(Xt.getDefaults(), arguments, ["frequency", "type"]);
    super(t), this.name = "Oscillator", this._oscillator = null, this.frequency = new dt({
      context: this.context,
      units: "frequency",
      value: t.frequency
    }), ct(this, "frequency"), this.detune = new dt({
      context: this.context,
      units: "cents",
      value: t.detune
    }), ct(this, "detune"), this._partials = t.partials, this._partialCount = t.partialCount, this._type = t.type, t.partialCount && t.type !== "custom" && (this._type = this.baseType + t.partialCount.toString()), this.phase = t.phase;
  }
  static getDefaults() {
    return Object.assign(Qt.getDefaults(), {
      detune: 0,
      frequency: 440,
      partialCount: 0,
      partials: [],
      phase: 0,
      type: "sine"
    });
  }
  /**
   * start the oscillator
   */
  _start(t) {
    const n = this.toSeconds(t), s = new Ki({
      context: this.context,
      onended: () => this.onstop(this)
    });
    this._oscillator = s, this._wave ? this._oscillator.setPeriodicWave(this._wave) : this._oscillator.type = this._type, this._oscillator.connect(this.output), this.frequency.connect(this._oscillator.frequency), this.detune.connect(this._oscillator.detune), this._oscillator.start(n);
  }
  /**
   * stop the oscillator
   */
  _stop(t) {
    const n = this.toSeconds(t);
    this._oscillator && this._oscillator.stop(n);
  }
  /**
   * Restart the oscillator. Does not stop the oscillator, but instead
   * just cancels any scheduled 'stop' from being invoked.
   */
  _restart(t) {
    const n = this.toSeconds(t);
    return this.log("restart", n), this._oscillator && this._oscillator.cancelStop(), this._state.cancel(n), this;
  }
  /**
   * Sync the signal to the Transport's bpm. Any changes to the transports bpm,
   * will also affect the oscillators frequency.
   * @example
   * const osc = new Tone.Oscillator().toDestination().start();
   * osc.frequency.value = 440;
   * // the ratio between the bpm and the frequency will be maintained
   * osc.syncFrequency();
   * // double the tempo
   * Tone.Transport.bpm.value *= 2;
   * // the frequency of the oscillator is doubled to 880
   */
  syncFrequency() {
    return this.context.transport.syncSignal(this.frequency), this;
  }
  /**
   * Unsync the oscillator's frequency from the Transport.
   * @see {@link syncFrequency}
   */
  unsyncFrequency() {
    return this.context.transport.unsyncSignal(this.frequency), this;
  }
  /**
   * Get a cached periodic wave. Avoids having to recompute
   * the oscillator values when they have already been computed
   * with the same values.
   */
  _getCachedPeriodicWave() {
    if (this._type === "custom")
      return Xt._periodicWaveCache.find((n) => n.phase === this._phase && b0(n.partials, this._partials));
    {
      const t = Xt._periodicWaveCache.find((n) => n.type === this._type && n.phase === this._phase);
      return this._partialCount = t ? t.partialCount : this._partialCount, t;
    }
  }
  get type() {
    return this._type;
  }
  set type(t) {
    this._type = t;
    const n = ["sine", "square", "sawtooth", "triangle"].indexOf(t) !== -1;
    if (this._phase === 0 && n)
      this._wave = void 0, this._partialCount = 0, this._oscillator !== null && (this._oscillator.type = t);
    else {
      const s = this._getCachedPeriodicWave();
      if (bt(s)) {
        const { partials: i, wave: r } = s;
        this._wave = r, this._partials = i, this._oscillator !== null && this._oscillator.setPeriodicWave(this._wave);
      } else {
        const [i, r] = this._getRealImaginary(t, this._phase), o = this.context.createPeriodicWave(i, r);
        this._wave = o, this._oscillator !== null && this._oscillator.setPeriodicWave(this._wave), Xt._periodicWaveCache.push({
          imag: r,
          partialCount: this._partialCount,
          partials: this._partials,
          phase: this._phase,
          real: i,
          type: this._type,
          wave: this._wave
        }), Xt._periodicWaveCache.length > 100 && Xt._periodicWaveCache.shift();
      }
    }
  }
  get baseType() {
    return this._type.replace(this.partialCount.toString(), "");
  }
  set baseType(t) {
    this.partialCount && this._type !== "custom" && t !== "custom" ? this.type = t + this.partialCount : this.type = t;
  }
  get partialCount() {
    return this._partialCount;
  }
  set partialCount(t) {
    oe(t, 0);
    let n = this._type;
    const s = /^(sine|triangle|square|sawtooth)(\d+)$/.exec(this._type);
    if (s && (n = s[1]), this._type !== "custom")
      t === 0 ? this.type = n : this.type = n + t.toString();
    else {
      const i = new Float32Array(t);
      this._partials.forEach((r, o) => i[o] = r), this._partials = Array.from(i), this.type = this._type;
    }
  }
  /**
   * Returns the real and imaginary components based
   * on the oscillator type.
   * @returns [real: Float32Array, imaginary: Float32Array]
   */
  _getRealImaginary(t, n) {
    let i = 2048;
    const r = new Float32Array(i), o = new Float32Array(i);
    let a = 1;
    if (t === "custom") {
      if (a = this._partials.length + 1, this._partialCount = this._partials.length, i = a, this._partials.length === 0)
        return [r, o];
    } else {
      const c = /^(sine|triangle|square|sawtooth)(\d+)$/.exec(t);
      c ? (a = parseInt(c[2], 10) + 1, this._partialCount = parseInt(c[2], 10), t = c[1], a = Math.max(a, 2), i = a) : this._partialCount = 0, this._partials = [];
    }
    for (let c = 1; c < i; ++c) {
      const l = 2 / (c * Math.PI);
      let u;
      switch (t) {
        case "sine":
          u = c <= a ? 1 : 0, this._partials[c - 1] = u;
          break;
        case "square":
          u = c & 1 ? 2 * l : 0, this._partials[c - 1] = u;
          break;
        case "sawtooth":
          u = l * (c & 1 ? 1 : -1), this._partials[c - 1] = u;
          break;
        case "triangle":
          c & 1 ? u = 2 * (l * l) * (c - 1 >> 1 & 1 ? -1 : 1) : u = 0, this._partials[c - 1] = u;
          break;
        case "custom":
          u = this._partials[c - 1];
          break;
        default:
          throw new TypeError("Oscillator: invalid type: " + t);
      }
      u !== 0 ? (r[c] = -u * Math.sin(n * c), o[c] = u * Math.cos(n * c)) : (r[c] = 0, o[c] = 0);
    }
    return [r, o];
  }
  /**
   * Compute the inverse FFT for a given phase.
   */
  _inverseFFT(t, n, s) {
    let i = 0;
    const r = t.length;
    for (let o = 0; o < r; o++)
      i += t[o] * Math.cos(o * s) + n[o] * Math.sin(o * s);
    return i;
  }
  /**
   * Returns the initial value of the oscillator when stopped.
   * E.g. a "sine" oscillator with phase = 90 would return an initial value of -1.
   */
  getInitialValue() {
    const [t, n] = this._getRealImaginary(this._type, 0);
    let s = 0;
    const i = Math.PI * 2, r = 32;
    for (let o = 0; o < r; o++)
      s = Math.max(this._inverseFFT(t, n, o / r * i), s);
    return xs(-this._inverseFFT(t, n, this._phase) / s, -1, 1);
  }
  get partials() {
    return this._partials.slice(0, this.partialCount);
  }
  set partials(t) {
    this._partials = t, this._partialCount = this._partials.length, t.length && (this.type = "custom");
  }
  get phase() {
    return this._phase * (180 / Math.PI);
  }
  set phase(t) {
    this._phase = t * Math.PI / 180, this.type = this._type;
  }
  asArray() {
    return jt(this, arguments, void 0, function* (t = 1024) {
      return ws(this, t);
    });
  }
  dispose() {
    return super.dispose(), this._oscillator !== null && this._oscillator.dispose(), this._wave = void 0, this.frequency.dispose(), this.detune.dispose(), this;
  }
}
Xt._periodicWaveCache = [];
class go extends Ze {
  constructor() {
    super(...arguments), this.name = "AudioToGain", this._norm = new hn({
      context: this.context,
      mapping: (t) => (t + 1) / 2
    }), this.input = this._norm, this.output = this._norm;
  }
  /**
   * clean up
   */
  dispose() {
    return super.dispose(), this._norm.dispose(), this;
  }
}
class Ut extends dt {
  constructor() {
    const t = P(Ut.getDefaults(), arguments, ["value"]);
    super(t), this.name = "Multiply", this.override = !1, this._mult = this.input = this.output = new nt({
      context: this.context,
      minValue: t.minValue,
      maxValue: t.maxValue
    }), this.factor = this._param = this._mult.gain, this.factor.setValueAtTime(t.value, 0);
  }
  static getDefaults() {
    return Object.assign(dt.getDefaults(), {
      value: 0
    });
  }
  dispose() {
    return super.dispose(), this._mult.dispose(), this;
  }
}
class Qi extends Qt {
  constructor() {
    const t = P(Qi.getDefaults(), arguments, ["frequency", "type", "modulationType"]);
    super(t), this.name = "AMOscillator", this._modulationScale = new go({ context: this.context }), this._modulationNode = new nt({
      context: this.context
    }), this._carrier = new Xt({
      context: this.context,
      detune: t.detune,
      frequency: t.frequency,
      onstop: () => this.onstop(this),
      phase: t.phase,
      type: t.type
    }), this.frequency = this._carrier.frequency, this.detune = this._carrier.detune, this._modulator = new Xt({
      context: this.context,
      phase: t.phase,
      type: t.modulationType
    }), this.harmonicity = new Ut({
      context: this.context,
      units: "positive",
      value: t.harmonicity
    }), this.frequency.chain(this.harmonicity, this._modulator.frequency), this._modulator.chain(this._modulationScale, this._modulationNode.gain), this._carrier.chain(this._modulationNode, this.output), ct(this, ["frequency", "detune", "harmonicity"]);
  }
  static getDefaults() {
    return Object.assign(Xt.getDefaults(), {
      harmonicity: 1,
      modulationType: "square"
    });
  }
  /**
   * start the oscillator
   */
  _start(t) {
    this._modulator.start(t), this._carrier.start(t);
  }
  /**
   * stop the oscillator
   */
  _stop(t) {
    this._modulator.stop(t), this._carrier.stop(t);
  }
  _restart(t) {
    this._modulator.restart(t), this._carrier.restart(t);
  }
  /**
   * The type of the carrier oscillator
   */
  get type() {
    return this._carrier.type;
  }
  set type(t) {
    this._carrier.type = t;
  }
  get baseType() {
    return this._carrier.baseType;
  }
  set baseType(t) {
    this._carrier.baseType = t;
  }
  get partialCount() {
    return this._carrier.partialCount;
  }
  set partialCount(t) {
    this._carrier.partialCount = t;
  }
  /**
   * The type of the modulator oscillator
   */
  get modulationType() {
    return this._modulator.type;
  }
  set modulationType(t) {
    this._modulator.type = t;
  }
  get phase() {
    return this._carrier.phase;
  }
  set phase(t) {
    this._carrier.phase = t, this._modulator.phase = t;
  }
  get partials() {
    return this._carrier.partials;
  }
  set partials(t) {
    this._carrier.partials = t;
  }
  asArray() {
    return jt(this, arguments, void 0, function* (t = 1024) {
      return ws(this, t);
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this.frequency.dispose(), this.detune.dispose(), this.harmonicity.dispose(), this._carrier.dispose(), this._modulator.dispose(), this._modulationNode.dispose(), this._modulationScale.dispose(), this;
  }
}
class ci extends Qt {
  constructor() {
    const t = P(ci.getDefaults(), arguments, ["frequency", "type", "modulationType"]);
    super(t), this.name = "FMOscillator", this._modulationNode = new nt({
      context: this.context,
      gain: 0
    }), this._carrier = new Xt({
      context: this.context,
      detune: t.detune,
      frequency: 0,
      onstop: () => this.onstop(this),
      phase: t.phase,
      type: t.type
    }), this.detune = this._carrier.detune, this.frequency = new dt({
      context: this.context,
      units: "frequency",
      value: t.frequency
    }), this._modulator = new Xt({
      context: this.context,
      phase: t.phase,
      type: t.modulationType
    }), this.harmonicity = new Ut({
      context: this.context,
      units: "positive",
      value: t.harmonicity
    }), this.modulationIndex = new Ut({
      context: this.context,
      units: "positive",
      value: t.modulationIndex
    }), this.frequency.connect(this._carrier.frequency), this.frequency.chain(this.harmonicity, this._modulator.frequency), this.frequency.chain(this.modulationIndex, this._modulationNode), this._modulator.connect(this._modulationNode.gain), this._modulationNode.connect(this._carrier.frequency), this._carrier.connect(this.output), this.detune.connect(this._modulator.detune), ct(this, [
      "modulationIndex",
      "frequency",
      "detune",
      "harmonicity"
    ]);
  }
  static getDefaults() {
    return Object.assign(Xt.getDefaults(), {
      harmonicity: 1,
      modulationIndex: 2,
      modulationType: "square"
    });
  }
  /**
   * start the oscillator
   */
  _start(t) {
    this._modulator.start(t), this._carrier.start(t);
  }
  /**
   * stop the oscillator
   */
  _stop(t) {
    this._modulator.stop(t), this._carrier.stop(t);
  }
  _restart(t) {
    return this._modulator.restart(t), this._carrier.restart(t), this;
  }
  get type() {
    return this._carrier.type;
  }
  set type(t) {
    this._carrier.type = t;
  }
  get baseType() {
    return this._carrier.baseType;
  }
  set baseType(t) {
    this._carrier.baseType = t;
  }
  get partialCount() {
    return this._carrier.partialCount;
  }
  set partialCount(t) {
    this._carrier.partialCount = t;
  }
  /**
   * The type of the modulator oscillator
   */
  get modulationType() {
    return this._modulator.type;
  }
  set modulationType(t) {
    this._modulator.type = t;
  }
  get phase() {
    return this._carrier.phase;
  }
  set phase(t) {
    this._carrier.phase = t, this._modulator.phase = t;
  }
  get partials() {
    return this._carrier.partials;
  }
  set partials(t) {
    this._carrier.partials = t;
  }
  asArray() {
    return jt(this, arguments, void 0, function* (t = 1024) {
      return ws(this, t);
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this.frequency.dispose(), this.harmonicity.dispose(), this._carrier.dispose(), this._modulator.dispose(), this._modulationNode.dispose(), this.modulationIndex.dispose(), this;
  }
}
class li extends Qt {
  constructor() {
    const t = P(li.getDefaults(), arguments, ["frequency", "width"]);
    super(t), this.name = "PulseOscillator", this._widthGate = new nt({
      context: this.context,
      gain: 0
    }), this._thresh = new hn({
      context: this.context,
      mapping: (n) => n <= 0 ? -1 : 1
    }), this.width = new dt({
      context: this.context,
      units: "audioRange",
      value: t.width
    }), this._triangle = new Xt({
      context: this.context,
      detune: t.detune,
      frequency: t.frequency,
      onstop: () => this.onstop(this),
      phase: t.phase,
      type: "triangle"
    }), this.frequency = this._triangle.frequency, this.detune = this._triangle.detune, this._triangle.chain(this._thresh, this.output), this.width.chain(this._widthGate, this._thresh), ct(this, ["width", "frequency", "detune"]);
  }
  static getDefaults() {
    return Object.assign(Qt.getDefaults(), {
      detune: 0,
      frequency: 440,
      phase: 0,
      type: "pulse",
      width: 0.2
    });
  }
  /**
   * start the oscillator
   */
  _start(t) {
    t = this.toSeconds(t), this._triangle.start(t), this._widthGate.gain.setValueAtTime(1, t);
  }
  /**
   * stop the oscillator
   */
  _stop(t) {
    t = this.toSeconds(t), this._triangle.stop(t), this._widthGate.gain.cancelScheduledValues(t), this._widthGate.gain.setValueAtTime(0, t);
  }
  _restart(t) {
    this._triangle.restart(t), this._widthGate.gain.cancelScheduledValues(t), this._widthGate.gain.setValueAtTime(1, t);
  }
  /**
   * The phase of the oscillator in degrees.
   */
  get phase() {
    return this._triangle.phase;
  }
  set phase(t) {
    this._triangle.phase = t;
  }
  /**
   * The type of the oscillator. Always returns "pulse".
   */
  get type() {
    return "pulse";
  }
  /**
   * The baseType of the oscillator. Always returns "pulse".
   */
  get baseType() {
    return "pulse";
  }
  /**
   * The partials of the waveform. Cannot set partials for this waveform type
   */
  get partials() {
    return [];
  }
  /**
   * No partials for this waveform type.
   */
  get partialCount() {
    return 0;
  }
  /**
   * *Internal use* The carrier oscillator type is fed through the
   * waveshaper node to create the pulse. Using different carrier oscillators
   * changes oscillator's behavior.
   */
  set carrierType(t) {
    this._triangle.type = t;
  }
  asArray() {
    return jt(this, arguments, void 0, function* (t = 1024) {
      return ws(this, t);
    });
  }
  /**
   * Clean up method.
   */
  dispose() {
    return super.dispose(), this._triangle.dispose(), this.width.dispose(), this._widthGate.dispose(), this._thresh.dispose(), this;
  }
}
class Ji extends Qt {
  constructor() {
    const t = P(Ji.getDefaults(), arguments, ["frequency", "type", "spread"]);
    super(t), this.name = "FatOscillator", this._oscillators = [], this.frequency = new dt({
      context: this.context,
      units: "frequency",
      value: t.frequency
    }), this.detune = new dt({
      context: this.context,
      units: "cents",
      value: t.detune
    }), this._spread = t.spread, this._type = t.type, this._phase = t.phase, this._partials = t.partials, this._partialCount = t.partialCount, this.count = t.count, ct(this, ["frequency", "detune"]);
  }
  static getDefaults() {
    return Object.assign(Xt.getDefaults(), {
      count: 3,
      spread: 20,
      type: "sawtooth"
    });
  }
  /**
   * start the oscillator
   */
  _start(t) {
    t = this.toSeconds(t), this._forEach((n) => n.start(t));
  }
  /**
   * stop the oscillator
   */
  _stop(t) {
    t = this.toSeconds(t), this._forEach((n) => n.stop(t));
  }
  _restart(t) {
    this._forEach((n) => n.restart(t));
  }
  /**
   * Iterate over all of the oscillators
   */
  _forEach(t) {
    for (let n = 0; n < this._oscillators.length; n++)
      t(this._oscillators[n], n);
  }
  /**
   * The type of the oscillator
   */
  get type() {
    return this._type;
  }
  set type(t) {
    this._type = t, this._forEach((n) => n.type = t);
  }
  /**
   * The detune spread between the oscillators. If "count" is
   * set to 3 oscillators and the "spread" is set to 40,
   * the three oscillators would be detuned like this: [-20, 0, 20]
   * for a total detune spread of 40 cents.
   * @example
   * const fatOsc = new Tone.FatOscillator().toDestination().start();
   * fatOsc.spread = 70;
   */
  get spread() {
    return this._spread;
  }
  set spread(t) {
    if (this._spread = t, this._oscillators.length > 1) {
      const n = -t / 2, s = t / (this._oscillators.length - 1);
      this._forEach((i, r) => i.detune.value = n + s * r);
    }
  }
  /**
   * The number of detuned oscillators. Must be an integer greater than 1.
   * @example
   * const fatOsc = new Tone.FatOscillator("C#3", "sawtooth").toDestination().start();
   * // use 4 sawtooth oscillators
   * fatOsc.count = 4;
   */
  get count() {
    return this._oscillators.length;
  }
  set count(t) {
    if (oe(t, 1), this._oscillators.length !== t) {
      this._forEach((n) => n.dispose()), this._oscillators = [];
      for (let n = 0; n < t; n++) {
        const s = new Xt({
          context: this.context,
          volume: -6 - t * 1.1,
          type: this._type,
          phase: this._phase + n / t * 360,
          partialCount: this._partialCount,
          onstop: n === 0 ? () => this.onstop(this) : St
        });
        this.type === "custom" && (s.partials = this._partials), this.frequency.connect(s.frequency), this.detune.connect(s.detune), s.detune.overridden = !1, s.connect(this.output), this._oscillators[n] = s;
      }
      this.spread = this._spread, this.state === "started" && this._forEach((n) => n.start());
    }
  }
  get phase() {
    return this._phase;
  }
  set phase(t) {
    this._phase = t, this._forEach((n, s) => n.phase = this._phase + s / this.count * 360);
  }
  get baseType() {
    return this._oscillators[0].baseType;
  }
  set baseType(t) {
    this._forEach((n) => n.baseType = t), this._type = this._oscillators[0].type;
  }
  get partials() {
    return this._oscillators[0].partials;
  }
  set partials(t) {
    this._partials = t, this._partialCount = this._partials.length, t.length && (this._type = "custom", this._forEach((n) => n.partials = t));
  }
  get partialCount() {
    return this._oscillators[0].partialCount;
  }
  set partialCount(t) {
    this._partialCount = t, this._forEach((n) => n.partialCount = t), this._type = this._oscillators[0].type;
  }
  asArray() {
    return jt(this, arguments, void 0, function* (t = 1024) {
      return ws(this, t);
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this.frequency.dispose(), this.detune.dispose(), this._forEach((t) => t.dispose()), this;
  }
}
class tr extends Qt {
  constructor() {
    const t = P(tr.getDefaults(), arguments, ["frequency", "modulationFrequency"]);
    super(t), this.name = "PWMOscillator", this.sourceType = "pwm", this._scale = new Ut({
      context: this.context,
      value: 2
    }), this._pulse = new li({
      context: this.context,
      frequency: t.modulationFrequency
    }), this._pulse.carrierType = "sine", this.modulationFrequency = this._pulse.frequency, this._modulator = new Xt({
      context: this.context,
      detune: t.detune,
      frequency: t.frequency,
      onstop: () => this.onstop(this),
      phase: t.phase
    }), this.frequency = this._modulator.frequency, this.detune = this._modulator.detune, this._modulator.chain(this._scale, this._pulse.width), this._pulse.connect(this.output), ct(this, ["modulationFrequency", "frequency", "detune"]);
  }
  static getDefaults() {
    return Object.assign(Qt.getDefaults(), {
      detune: 0,
      frequency: 440,
      modulationFrequency: 0.4,
      phase: 0,
      type: "pwm"
    });
  }
  /**
   * start the oscillator
   */
  _start(t) {
    t = this.toSeconds(t), this._modulator.start(t), this._pulse.start(t);
  }
  /**
   * stop the oscillator
   */
  _stop(t) {
    t = this.toSeconds(t), this._modulator.stop(t), this._pulse.stop(t);
  }
  /**
   * restart the oscillator
   */
  _restart(t) {
    this._modulator.restart(t), this._pulse.restart(t);
  }
  /**
   * The type of the oscillator. Always returns "pwm".
   */
  get type() {
    return "pwm";
  }
  /**
   * The baseType of the oscillator. Always returns "pwm".
   */
  get baseType() {
    return "pwm";
  }
  /**
   * The partials of the waveform. Cannot set partials for this waveform type
   */
  get partials() {
    return [];
  }
  /**
   * No partials for this waveform type.
   */
  get partialCount() {
    return 0;
  }
  /**
   * The phase of the oscillator in degrees.
   */
  get phase() {
    return this._modulator.phase;
  }
  set phase(t) {
    this._modulator.phase = t;
  }
  asArray() {
    return jt(this, arguments, void 0, function* (t = 1024) {
      return ws(this, t);
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._pulse.dispose(), this._scale.dispose(), this._modulator.dispose(), this;
  }
}
const uu = {
  am: Qi,
  fat: Ji,
  fm: ci,
  oscillator: Xt,
  pulse: li,
  pwm: tr
};
class On extends Qt {
  constructor() {
    const t = P(On.getDefaults(), arguments, ["frequency", "type"]);
    super(t), this.name = "OmniOscillator", this.frequency = new dt({
      context: this.context,
      units: "frequency",
      value: t.frequency
    }), this.detune = new dt({
      context: this.context,
      units: "cents",
      value: t.detune
    }), ct(this, ["frequency", "detune"]), this.set(t);
  }
  static getDefaults() {
    return Object.assign(Xt.getDefaults(), ci.getDefaults(), Qi.getDefaults(), Ji.getDefaults(), li.getDefaults(), tr.getDefaults());
  }
  /**
   * start the oscillator
   */
  _start(t) {
    this._oscillator.start(t);
  }
  /**
   * start the oscillator
   */
  _stop(t) {
    this._oscillator.stop(t);
  }
  _restart(t) {
    return this._oscillator.restart(t), this;
  }
  /**
   * The type of the oscillator. Can be any of the basic types: sine, square, triangle, sawtooth. Or
   * prefix the basic types with "fm", "am", or "fat" to use the FMOscillator, AMOscillator or FatOscillator
   * types. The oscillator could also be set to "pwm" or "pulse". All of the parameters of the
   * oscillator's class are accessible when the oscillator is set to that type, but throws an error
   * when it's not.
   * @example
   * const omniOsc = new Tone.OmniOscillator().toDestination().start();
   * omniOsc.type = "pwm";
   * // modulationFrequency is parameter which is available
   * // only when the type is "pwm".
   * omniOsc.modulationFrequency.value = 0.5;
   */
  get type() {
    let t = "";
    return ["am", "fm", "fat"].some((n) => this._sourceType === n) && (t = this._sourceType), t + this._oscillator.type;
  }
  set type(t) {
    t.substr(0, 2) === "fm" ? (this._createNewOscillator("fm"), this._oscillator = this._oscillator, this._oscillator.type = t.substr(2)) : t.substr(0, 2) === "am" ? (this._createNewOscillator("am"), this._oscillator = this._oscillator, this._oscillator.type = t.substr(2)) : t.substr(0, 3) === "fat" ? (this._createNewOscillator("fat"), this._oscillator = this._oscillator, this._oscillator.type = t.substr(3)) : t === "pwm" ? (this._createNewOscillator("pwm"), this._oscillator = this._oscillator) : t === "pulse" ? this._createNewOscillator("pulse") : (this._createNewOscillator("oscillator"), this._oscillator = this._oscillator, this._oscillator.type = t);
  }
  /**
   * The value is an empty array when the type is not "custom".
   * This is not available on "pwm" and "pulse" oscillator types.
   * @see {@link Oscillator.partials}
   */
  get partials() {
    return this._oscillator.partials;
  }
  set partials(t) {
    !this._getOscType(this._oscillator, "pulse") && !this._getOscType(this._oscillator, "pwm") && (this._oscillator.partials = t);
  }
  get partialCount() {
    return this._oscillator.partialCount;
  }
  set partialCount(t) {
    !this._getOscType(this._oscillator, "pulse") && !this._getOscType(this._oscillator, "pwm") && (this._oscillator.partialCount = t);
  }
  set(t) {
    return Reflect.has(t, "type") && t.type && (this.type = t.type), super.set(t), this;
  }
  /**
   * connect the oscillator to the frequency and detune signals
   */
  _createNewOscillator(t) {
    if (t !== this._sourceType) {
      this._sourceType = t;
      const n = uu[t], s = this.now();
      if (this._oscillator) {
        const i = this._oscillator;
        i.stop(s), this.context.setTimeout(() => i.dispose(), this.blockTime);
      }
      this._oscillator = new n({
        context: this.context
      }), this.frequency.connect(this._oscillator.frequency), this.detune.connect(this._oscillator.detune), this._oscillator.connect(this.output), this._oscillator.onstop = () => this.onstop(this), this.state === "started" && this._oscillator.start(s);
    }
  }
  get phase() {
    return this._oscillator.phase;
  }
  set phase(t) {
    this._oscillator.phase = t;
  }
  /**
   * The source type of the oscillator.
   * @example
   * const omniOsc = new Tone.OmniOscillator(440, "fmsquare");
   * console.log(omniOsc.sourceType); // 'fm'
   */
  get sourceType() {
    return this._sourceType;
  }
  set sourceType(t) {
    let n = "sine";
    this._oscillator.type !== "pwm" && this._oscillator.type !== "pulse" && (n = this._oscillator.type), t === "fm" ? this.type = "fm" + n : t === "am" ? this.type = "am" + n : t === "fat" ? this.type = "fat" + n : t === "oscillator" ? this.type = n : t === "pulse" ? this.type = "pulse" : t === "pwm" && (this.type = "pwm");
  }
  _getOscType(t, n) {
    return t instanceof uu[n];
  }
  /**
   * The base type of the oscillator.
   * @see {@link Oscillator.baseType}
   * @example
   * const omniOsc = new Tone.OmniOscillator(440, "fmsquare4");
   * console.log(omniOsc.sourceType, omniOsc.baseType, omniOsc.partialCount);
   */
  get baseType() {
    return this._oscillator.baseType;
  }
  set baseType(t) {
    !this._getOscType(this._oscillator, "pulse") && !this._getOscType(this._oscillator, "pwm") && t !== "pulse" && t !== "pwm" && (this._oscillator.baseType = t);
  }
  /**
   * The width of the oscillator when sourceType === "pulse".
   * @see {@link PWMOscillator}
   */
  get width() {
    if (this._getOscType(this._oscillator, "pulse"))
      return this._oscillator.width;
  }
  /**
   * The number of detuned oscillators when sourceType === "fat".
   * @see {@link FatOscillator.count}
   */
  get count() {
    if (this._getOscType(this._oscillator, "fat"))
      return this._oscillator.count;
  }
  set count(t) {
    this._getOscType(this._oscillator, "fat") && ze(t) && (this._oscillator.count = t);
  }
  /**
   * The detune spread between the oscillators when sourceType === "fat".
   * @see {@link FatOscillator.count}
   */
  get spread() {
    if (this._getOscType(this._oscillator, "fat"))
      return this._oscillator.spread;
  }
  set spread(t) {
    this._getOscType(this._oscillator, "fat") && ze(t) && (this._oscillator.spread = t);
  }
  /**
   * The type of the modulator oscillator. Only if the oscillator is set to "am" or "fm" types.
   * @see {@link AMOscillator} or {@link FMOscillator}
   */
  get modulationType() {
    if (this._getOscType(this._oscillator, "fm") || this._getOscType(this._oscillator, "am"))
      return this._oscillator.modulationType;
  }
  set modulationType(t) {
    (this._getOscType(this._oscillator, "fm") || this._getOscType(this._oscillator, "am")) && an(t) && (this._oscillator.modulationType = t);
  }
  /**
   * The modulation index when the sourceType === "fm"
   * @see {@link FMOscillator}.
   */
  get modulationIndex() {
    if (this._getOscType(this._oscillator, "fm"))
      return this._oscillator.modulationIndex;
  }
  /**
   * Harmonicity is the frequency ratio between the carrier and the modulator oscillators.
   * @see {@link AMOscillator} or {@link FMOscillator}
   */
  get harmonicity() {
    if (this._getOscType(this._oscillator, "fm") || this._getOscType(this._oscillator, "am"))
      return this._oscillator.harmonicity;
  }
  /**
   * The modulationFrequency Signal of the oscillator when sourceType === "pwm"
   * see {@link PWMOscillator}
   * @min 0.1
   * @max 5
   */
  get modulationFrequency() {
    if (this._getOscType(this._oscillator, "pwm"))
      return this._oscillator.modulationFrequency;
  }
  asArray() {
    return jt(this, arguments, void 0, function* (t = 1024) {
      return ws(this, t);
    });
  }
  dispose() {
    return super.dispose(), this.detune.dispose(), this.frequency.dispose(), this._oscillator.dispose(), this;
  }
}
class Cs extends dt {
  constructor() {
    super(P(Cs.getDefaults(), arguments, ["value"])), this.override = !1, this.name = "Add", this._sum = new nt({ context: this.context }), this.input = this._sum, this.output = this._sum, this.addend = this._param, Ge(this._constantSource, this._sum);
  }
  static getDefaults() {
    return Object.assign(dt.getDefaults(), {
      value: 0
    });
  }
  dispose() {
    return super.dispose(), this._sum.dispose(), this;
  }
}
class Mn extends Ze {
  constructor() {
    const t = P(Mn.getDefaults(), arguments, [
      "min",
      "max"
    ]);
    super(t), this.name = "Scale", this._mult = this.input = new Ut({
      context: this.context,
      value: t.max - t.min
    }), this._add = this.output = new Cs({
      context: this.context,
      value: t.min
    }), this._min = t.min, this._max = t.max, this.input.connect(this.output);
  }
  static getDefaults() {
    return Object.assign(Ze.getDefaults(), {
      max: 1,
      min: 0
    });
  }
  /**
   * The minimum output value. This number is output when the value input value is 0.
   */
  get min() {
    return this._min;
  }
  set min(t) {
    this._min = t, this._setRange();
  }
  /**
   * The maximum output value. This number is output when the value input value is 1.
   */
  get max() {
    return this._max;
  }
  set max(t) {
    this._max = t, this._setRange();
  }
  /**
   * set the values
   */
  _setRange() {
    this._add.value = this._min, this._mult.value = this._max - this._min;
  }
  dispose() {
    return super.dispose(), this._add.dispose(), this._mult.dispose(), this;
  }
}
class _o extends Ze {
  constructor() {
    super(P(_o.getDefaults(), arguments)), this.name = "Zero", this._gain = new nt({ context: this.context }), this.output = this._gain, this.input = void 0, Fe(this.context.getConstant(0), this._gain);
  }
  /**
   * clean up
   */
  dispose() {
    return super.dispose(), zc(this.context.getConstant(0), this._gain), this;
  }
}
class Me extends B {
  constructor() {
    const t = P(Me.getDefaults(), arguments, [
      "frequency",
      "min",
      "max"
    ]);
    super(t), this.name = "LFO", this._stoppedValue = 0, this._units = "number", this.convert = !0, this._fromType = gt.prototype._fromType, this._toType = gt.prototype._toType, this._is = gt.prototype._is, this._clampValue = gt.prototype._clampValue, this._oscillator = new Xt(t), this.frequency = this._oscillator.frequency, this._amplitudeGain = new nt({
      context: this.context,
      gain: t.amplitude,
      units: "normalRange"
    }), this.amplitude = this._amplitudeGain.gain, this._stoppedSignal = new dt({
      context: this.context,
      units: "audioRange",
      value: 0
    }), this._zeros = new _o({ context: this.context }), this._a2g = new go({ context: this.context }), this._scaler = this.output = new Mn({
      context: this.context,
      max: t.max,
      min: t.min
    }), this.units = t.units, this.min = t.min, this.max = t.max, this._oscillator.chain(this._amplitudeGain, this._a2g, this._scaler), this._zeros.connect(this._a2g), this._stoppedSignal.connect(this._a2g), ct(this, ["amplitude", "frequency"]), this.phase = t.phase;
  }
  static getDefaults() {
    return Object.assign(Xt.getDefaults(), {
      amplitude: 1,
      frequency: "4n",
      max: 1,
      min: 0,
      type: "sine",
      units: "number"
    });
  }
  /**
   * Start the LFO.
   * @param time The time the LFO will start
   */
  start(t) {
    return t = this.toSeconds(t), this._stoppedSignal.setValueAtTime(0, t), this._oscillator.start(t), this;
  }
  /**
   * Stop the LFO.
   * @param  time The time the LFO will stop
   */
  stop(t) {
    return t = this.toSeconds(t), this._stoppedSignal.setValueAtTime(this._stoppedValue, t), this._oscillator.stop(t), this;
  }
  /**
   * Sync the start/stop/pause to the transport
   * and the frequency to the bpm of the transport
   * @example
   * const lfo = new Tone.LFO("8n");
   * lfo.sync().start(0);
   * // the rate of the LFO will always be an eighth note, even as the tempo changes
   */
  sync() {
    return this._oscillator.sync(), this._oscillator.syncFrequency(), this;
  }
  /**
   * unsync the LFO from transport control
   */
  unsync() {
    return this._oscillator.unsync(), this._oscillator.unsyncFrequency(), this;
  }
  /**
   * After the oscillator waveform is updated, reset the `_stoppedSignal` value to match the updated waveform
   */
  _setStoppedValue() {
    this._stoppedValue = this._oscillator.getInitialValue(), this._stoppedSignal.value = this._stoppedValue;
  }
  /**
   * The minimum output of the LFO.
   */
  get min() {
    return this._toType(this._scaler.min);
  }
  set min(t) {
    t = this._fromType(t), this._scaler.min = t;
  }
  /**
   * The maximum output of the LFO.
   */
  get max() {
    return this._toType(this._scaler.max);
  }
  set max(t) {
    t = this._fromType(t), this._scaler.max = t;
  }
  /**
   * The type of the oscillator.
   * @see {@link Oscillator.type}
   */
  get type() {
    return this._oscillator.type;
  }
  set type(t) {
    this._oscillator.type = t, this._setStoppedValue();
  }
  /**
   * The oscillator's partials array.
   * @see {@link Oscillator.partials}
   */
  get partials() {
    return this._oscillator.partials;
  }
  set partials(t) {
    this._oscillator.partials = t, this._setStoppedValue();
  }
  /**
   * The phase of the LFO.
   */
  get phase() {
    return this._oscillator.phase;
  }
  set phase(t) {
    this._oscillator.phase = t, this._setStoppedValue();
  }
  /**
   * The output units of the LFO.
   */
  get units() {
    return this._units;
  }
  set units(t) {
    const n = this.min, s = this.max;
    this._units = t, this.min = n, this.max = s;
  }
  /**
   * Returns the playback state of the source, either "started" or "stopped".
   */
  get state() {
    return this._oscillator.state;
  }
  /**
   * @param node the destination to connect to
   * @param outputNum the optional output number
   * @param inputNum the input number
   */
  connect(t, n, s) {
    return (t instanceof gt || t instanceof dt) && (this.convert = t.convert, this.units = t.units), Hi(this, t, n, s), this;
  }
  dispose() {
    return super.dispose(), this._oscillator.dispose(), this._stoppedSignal.dispose(), this._zeros.dispose(), this._scaler.dispose(), this._a2g.dispose(), this._amplitudeGain.dispose(), this.amplitude.dispose(), this;
  }
}
function Xd(e, t = 1 / 0) {
  const n = /* @__PURE__ */ new WeakMap();
  return function(s, i) {
    Reflect.defineProperty(s, i, {
      configurable: !0,
      enumerable: !0,
      get: function() {
        return n.get(this);
      },
      set: function(r) {
        oe(r, e, t), n.set(this, r);
      }
    });
  };
}
function Vn(e, t = 1 / 0) {
  const n = /* @__PURE__ */ new WeakMap();
  return function(s, i) {
    Reflect.defineProperty(s, i, {
      configurable: !0,
      enumerable: !0,
      get: function() {
        return n.get(this);
      },
      set: function(r) {
        oe(this.toSeconds(r), e, t), n.set(this, r);
      }
    });
  };
}
class Ss extends Qt {
  constructor() {
    const t = P(Ss.getDefaults(), arguments, [
      "url",
      "onload"
    ]);
    super(t), this.name = "Player", this._activeSources = /* @__PURE__ */ new Set(), this._buffer = new Rt({
      onload: this._onload.bind(this, t.onload),
      onerror: t.onerror,
      reverse: t.reverse,
      url: t.url
    }), this.autostart = t.autostart, this._loop = t.loop, this._loopStart = t.loopStart, this._loopEnd = t.loopEnd, this._playbackRate = t.playbackRate, this.fadeIn = t.fadeIn, this.fadeOut = t.fadeOut;
  }
  static getDefaults() {
    return Object.assign(Qt.getDefaults(), {
      autostart: !1,
      fadeIn: 0,
      fadeOut: 0,
      loop: !1,
      loopEnd: 0,
      loopStart: 0,
      onload: St,
      onerror: St,
      playbackRate: 1,
      reverse: !1
    });
  }
  /**
   * Load the audio file as an audio buffer.
   * Decodes the audio asynchronously and invokes
   * the callback once the audio buffer loads.
   * Note: this does not need to be called if a url
   * was passed in to the constructor. Only use this
   * if you want to manually load a new url.
   * @param url The url of the buffer to load. Filetype support depends on the browser.
   */
  load(t) {
    return jt(this, void 0, void 0, function* () {
      return yield this._buffer.load(t), this._onload(), this;
    });
  }
  /**
   * Internal callback when the buffer is loaded.
   */
  _onload(t = St) {
    t(), this.autostart && this.start();
  }
  /**
   * Internal callback when the buffer is done playing.
   */
  _onSourceEnd(t) {
    this.onstop(this), this._activeSources.delete(t), this._activeSources.size === 0 && !this._synced && this._state.getValueAtTime(this.now()) === "started" && (this._state.cancel(this.now()), this._state.setStateAtTime("stopped", this.now()));
  }
  /**
   * Play the buffer at the given startTime. Optionally add an offset
   * and/or duration which will play the buffer from a position
   * within the buffer for the given duration.
   *
   * @param  time When the player should start.
   * @param  offset The offset from the beginning of the sample to start at.
   * @param  duration How long the sample should play. If no duration is given, it will default to the full length of the sample (minus any offset)
   */
  start(t, n, s) {
    return super.start(t, n, s), this;
  }
  /**
   * Internal start method
   */
  _start(t, n, s) {
    this._loop ? n = Je(n, this._loopStart) : n = Je(n, 0);
    const i = this.toSeconds(n), r = s;
    s = Je(s, Math.max(this._buffer.duration - i, 0));
    let o = this.toSeconds(s);
    o = o / this._playbackRate, t = this.toSeconds(t);
    const a = new is({
      url: this._buffer,
      context: this.context,
      fadeIn: this.fadeIn,
      fadeOut: this.fadeOut,
      loop: this._loop,
      loopEnd: this._loopEnd,
      loopStart: this._loopStart,
      onended: this._onSourceEnd.bind(this),
      playbackRate: this._playbackRate
    }).connect(this.output);
    !this._loop && !this._synced && (this._state.cancel(t + o), this._state.setStateAtTime("stopped", t + o, {
      implicitEnd: !0
    })), this._activeSources.add(a), this._loop && We(r) ? a.start(t, i) : a.start(t, i, o - this.toSeconds(this.fadeOut));
  }
  /**
   * Stop playback.
   */
  _stop(t) {
    const n = this.toSeconds(t);
    this._activeSources.forEach((s) => s.stop(n));
  }
  /**
   * Stop and then restart the player from the beginning (or offset)
   * @param  time When the player should start.
   * @param  offset The offset from the beginning of the sample to start at.
   * @param  duration How long the sample should play. If no duration is given,
   * 					it will default to the full length of the sample (minus any offset)
   */
  restart(t, n, s) {
    return super.restart(t, n, s), this;
  }
  _restart(t, n, s) {
    var i;
    (i = [...this._activeSources].pop()) === null || i === void 0 || i.stop(t), this._start(t, n, s);
  }
  /**
   * Seek to a specific time in the player's buffer. If the
   * source is no longer playing at that time, it will stop.
   * @param offset The time to seek to.
   * @param when The time for the seek event to occur.
   * @example
   * const player = new Tone.Player("https://tonejs.github.io/audio/berklee/gurgling_theremin_1.mp3", () => {
   * 	player.start();
   * 	// seek to the offset in 1 second from now
   * 	player.seek(0.4, "+1");
   * }).toDestination();
   */
  seek(t, n) {
    const s = this.toSeconds(n);
    if (this._state.getValueAtTime(s) === "started") {
      const i = this.toSeconds(t);
      this._stop(s), this._start(s, i);
    }
    return this;
  }
  /**
   * Set the loop start and end. Will only loop if loop is set to true.
   * @param loopStart The loop start time
   * @param loopEnd The loop end time
   * @example
   * const player = new Tone.Player("https://tonejs.github.io/audio/berklee/malevoices_aa2_F3.mp3").toDestination();
   * // loop between the given points
   * player.setLoopPoints(0.2, 0.3);
   * player.loop = true;
   * player.autostart = true;
   */
  setLoopPoints(t, n) {
    return this.loopStart = t, this.loopEnd = n, this;
  }
  /**
   * If loop is true, the loop will start at this position.
   */
  get loopStart() {
    return this._loopStart;
  }
  set loopStart(t) {
    this._loopStart = t, this.buffer.loaded && oe(this.toSeconds(t), 0, this.buffer.duration), this._activeSources.forEach((n) => {
      n.loopStart = t;
    });
  }
  /**
   * If loop is true, the loop will end at this position.
   */
  get loopEnd() {
    return this._loopEnd;
  }
  set loopEnd(t) {
    this._loopEnd = t, this.buffer.loaded && oe(this.toSeconds(t), 0, this.buffer.duration), this._activeSources.forEach((n) => {
      n.loopEnd = t;
    });
  }
  /**
   * The audio buffer belonging to the player.
   */
  get buffer() {
    return this._buffer;
  }
  set buffer(t) {
    this._buffer.set(t);
  }
  /**
   * If the buffer should loop once it's over.
   * @example
   * const player = new Tone.Player("https://tonejs.github.io/audio/drum-samples/breakbeat.mp3").toDestination();
   * player.loop = true;
   * player.autostart = true;
   */
  get loop() {
    return this._loop;
  }
  set loop(t) {
    if (this._loop !== t && (this._loop = t, this._activeSources.forEach((n) => {
      n.loop = t;
    }), t)) {
      const n = this._state.getNextState("stopped", this.now());
      n && this._state.cancel(n.time);
    }
  }
  /**
   * Normal speed is 1. The pitch will change with the playback rate.
   * @example
   * const player = new Tone.Player("https://tonejs.github.io/audio/berklee/femalevoices_aa2_A5.mp3").toDestination();
   * // play at 1/4 speed
   * player.playbackRate = 0.25;
   * // play as soon as the buffer is loaded
   * player.autostart = true;
   */
  get playbackRate() {
    return this._playbackRate;
  }
  set playbackRate(t) {
    this._playbackRate = t;
    const n = this.now(), s = this._state.getNextState("stopped", n);
    s && s.implicitEnd && (this._state.cancel(s.time), this._activeSources.forEach((i) => i.cancelStop())), this._activeSources.forEach((i) => {
      i.playbackRate.setValueAtTime(t, n);
    });
  }
  /**
   * If the buffer should be reversed. Note that this sets the underlying {@link ToneAudioBuffer.reverse}, so
   * if multiple players are pointing at the same ToneAudioBuffer, they will all be reversed.
   * @example
   * const player = new Tone.Player("https://tonejs.github.io/audio/berklee/chime_1.mp3").toDestination();
   * player.autostart = true;
   * player.reverse = true;
   */
  get reverse() {
    return this._buffer.reverse;
  }
  set reverse(t) {
    this._buffer.reverse = t;
  }
  /**
   * If the buffer is loaded
   */
  get loaded() {
    return this._buffer.loaded;
  }
  dispose() {
    return super.dispose(), this._activeSources.forEach((t) => t.dispose()), this._activeSources.clear(), this._buffer.dispose(), this;
  }
}
ln([
  Vn(0)
], Ss.prototype, "fadeIn", void 0);
ln([
  Vn(0)
], Ss.prototype, "fadeOut", void 0);
class Hc extends B {
  constructor() {
    const t = P(Hc.getDefaults(), arguments, ["urls", "onload"], "urls");
    super(t), this.name = "Players", this.input = void 0, this._players = /* @__PURE__ */ new Map(), this._volume = this.output = new un({
      context: this.context,
      volume: t.volume
    }), this.volume = this._volume.volume, ct(this, "volume"), this._buffers = new oi({
      urls: t.urls,
      onload: t.onload,
      baseUrl: t.baseUrl,
      onerror: t.onerror
    }), this.mute = t.mute, this._fadeIn = t.fadeIn, this._fadeOut = t.fadeOut;
  }
  static getDefaults() {
    return Object.assign(Qt.getDefaults(), {
      baseUrl: "",
      fadeIn: 0,
      fadeOut: 0,
      mute: !1,
      onload: St,
      onerror: St,
      urls: {},
      volume: 0
    });
  }
  /**
   * Mute the output.
   */
  get mute() {
    return this._volume.mute;
  }
  set mute(t) {
    this._volume.mute = t;
  }
  /**
   * The fadeIn time of the envelope applied to the source.
   */
  get fadeIn() {
    return this._fadeIn;
  }
  set fadeIn(t) {
    this._fadeIn = t, this._players.forEach((n) => {
      n.fadeIn = t;
    });
  }
  /**
   * The fadeOut time of the each of the sources.
   */
  get fadeOut() {
    return this._fadeOut;
  }
  set fadeOut(t) {
    this._fadeOut = t, this._players.forEach((n) => {
      n.fadeOut = t;
    });
  }
  /**
   * The state of the players object. Returns "started" if any of the players are playing.
   */
  get state() {
    return Array.from(this._players).some(([n, s]) => s.state === "started") ? "started" : "stopped";
  }
  /**
   * True if the buffers object has a buffer by that name.
   * @param name  The key or index of the buffer.
   */
  has(t) {
    return this._buffers.has(t);
  }
  /**
   * Get a player by name.
   * @param  name  The players name as defined in the constructor object or `add` method.
   */
  player(t) {
    if (st(this.has(t), `No Player with the name ${t} exists on this object`), !this._players.has(t)) {
      const n = new Ss({
        context: this.context,
        fadeIn: this._fadeIn,
        fadeOut: this._fadeOut,
        url: this._buffers.get(t)
      }).connect(this.output);
      this._players.set(t, n);
    }
    return this._players.get(t);
  }
  /**
   * If all the buffers are loaded or not
   */
  get loaded() {
    return this._buffers.loaded;
  }
  /**
   * Add a player by name and url to the Players
   * @param  name A unique name to give the player
   * @param  url  Either the url of the bufer or a buffer which will be added with the given name.
   * @param callback  The callback to invoke when the url is loaded.
   * @example
   * const players = new Tone.Players();
   * players.add("gong", "https://tonejs.github.io/audio/berklee/gong_1.mp3", () => {
   * 	console.log("gong loaded");
   * 	players.player("gong").start();
   * });
   */
  add(t, n, s) {
    return st(!this._buffers.has(t), "A buffer with that name already exists on this object"), this._buffers.add(t, n, s), this;
  }
  /**
   * Stop all of the players at the given time
   * @param time The time to stop all of the players.
   */
  stopAll(t) {
    return this._players.forEach((n) => n.stop(t)), this;
  }
  dispose() {
    return super.dispose(), this._volume.dispose(), this.volume.dispose(), this._players.forEach((t) => t.dispose()), this._buffers.dispose(), this;
  }
}
class Kc extends Qt {
  constructor() {
    const t = P(Kc.getDefaults(), arguments, ["url", "onload"]);
    super(t), this.name = "GrainPlayer", this._loopStart = 0, this._loopEnd = 0, this._activeSources = [], this.buffer = new Rt({
      onload: t.onload,
      onerror: t.onerror,
      reverse: t.reverse,
      url: t.url
    }), this._clock = new ri({
      context: this.context,
      callback: this._tick.bind(this),
      frequency: 1 / t.grainSize
    }), this._playbackRate = t.playbackRate, this._grainSize = t.grainSize, this._overlap = t.overlap, this.detune = t.detune, this.overlap = t.overlap, this.loop = t.loop, this.playbackRate = t.playbackRate, this.grainSize = t.grainSize, this.loopStart = t.loopStart, this.loopEnd = t.loopEnd, this.reverse = t.reverse, this._clock.on("stop", this._onstop.bind(this));
  }
  static getDefaults() {
    return Object.assign(Qt.getDefaults(), {
      onload: St,
      onerror: St,
      overlap: 0.1,
      grainSize: 0.2,
      playbackRate: 1,
      detune: 0,
      loop: !1,
      loopStart: 0,
      loopEnd: 0,
      reverse: !1
    });
  }
  /**
   * Internal start method
   */
  _start(t, n, s) {
    n = Je(n, 0), n = this.toSeconds(n), t = this.toSeconds(t);
    const i = 1 / this._clock.frequency.getValueAtTime(t);
    this._clock.start(t, n / i), s && this.stop(t + this.toSeconds(s));
  }
  /**
   * Stop and then restart the player from the beginning (or offset)
   * @param  time When the player should start.
   * @param  offset The offset from the beginning of the sample to start at.
   * @param  duration How long the sample should play. If no duration is given,
   * 					it will default to the full length of the sample (minus any offset)
   */
  restart(t, n, s) {
    return super.restart(t, n, s), this;
  }
  _restart(t, n, s) {
    this._stop(t), this._start(t, n, s);
  }
  /**
   * Internal stop method
   */
  _stop(t) {
    this._clock.stop(t);
  }
  /**
   * Invoked when the clock is stopped
   */
  _onstop(t) {
    this._activeSources.forEach((n) => {
      n.fadeOut = 0, n.stop(t);
    }), this.onstop(this);
  }
  /**
   * Invoked on each clock tick. scheduled a new grain at this time.
   */
  _tick(t) {
    const n = this._clock.getTicksAtTime(t), s = n * this._grainSize;
    if (this.log("offset", s), !this.loop && s > this.buffer.duration) {
      this.stop(t);
      return;
    }
    const i = s < this._overlap ? 0 : this._overlap, r = new is({
      context: this.context,
      url: this.buffer,
      fadeIn: i,
      fadeOut: this._overlap,
      loop: this.loop,
      loopStart: this._loopStart,
      loopEnd: this._loopEnd,
      // compute the playbackRate based on the detune
      playbackRate: zs(this.detune / 100)
    }).connect(this.output);
    r.start(t, this._grainSize * n), r.stop(t + this._grainSize / this.playbackRate), this._activeSources.push(r), r.onended = () => {
      const o = this._activeSources.indexOf(r);
      o !== -1 && this._activeSources.splice(o, 1);
    };
  }
  /**
   * The playback rate of the sample
   */
  get playbackRate() {
    return this._playbackRate;
  }
  set playbackRate(t) {
    oe(t, 1e-3), this._playbackRate = t, this.grainSize = this._grainSize;
  }
  /**
   * The loop start time.
   */
  get loopStart() {
    return this._loopStart;
  }
  set loopStart(t) {
    this.buffer.loaded && oe(this.toSeconds(t), 0, this.buffer.duration), this._loopStart = this.toSeconds(t);
  }
  /**
   * The loop end time.
   */
  get loopEnd() {
    return this._loopEnd;
  }
  set loopEnd(t) {
    this.buffer.loaded && oe(this.toSeconds(t), 0, this.buffer.duration), this._loopEnd = this.toSeconds(t);
  }
  /**
   * The direction the buffer should play in
   */
  get reverse() {
    return this.buffer.reverse;
  }
  set reverse(t) {
    this.buffer.reverse = t;
  }
  /**
   * The size of each chunk of audio that the
   * buffer is chopped into and played back at.
   */
  get grainSize() {
    return this._grainSize;
  }
  set grainSize(t) {
    this._grainSize = this.toSeconds(t), this._clock.frequency.setValueAtTime(this._playbackRate / this._grainSize, this.now());
  }
  /**
   * The duration of the cross-fade between successive grains.
   */
  get overlap() {
    return this._overlap;
  }
  set overlap(t) {
    const n = this.toSeconds(t);
    oe(n, 0), this._overlap = n;
  }
  /**
   * If all the buffer is loaded
   */
  get loaded() {
    return this.buffer.loaded;
  }
  dispose() {
    return super.dispose(), this.buffer.dispose(), this._clock.dispose(), this._activeSources.forEach((t) => t.dispose()), this;
  }
}
class Ud extends Ze {
  constructor() {
    super(...arguments), this.name = "Abs", this._abs = new hn({
      context: this.context,
      mapping: (t) => Math.abs(t) < 1e-3 ? 0 : Math.abs(t)
    }), this.input = this._abs, this.output = this._abs;
  }
  /**
   * clean up
   */
  dispose() {
    return super.dispose(), this._abs.dispose(), this;
  }
}
class Hd extends Ze {
  constructor() {
    super(...arguments), this.name = "GainToAudio", this._norm = new hn({
      context: this.context,
      mapping: (t) => Math.abs(t) * 2 - 1
    }), this.input = this._norm, this.output = this._norm;
  }
  /**
   * clean up
   */
  dispose() {
    return super.dispose(), this._norm.dispose(), this;
  }
}
class Qc extends Ze {
  constructor() {
    super(...arguments), this.name = "Negate", this._multiply = new Ut({
      context: this.context,
      value: -1
    }), this.input = this._multiply, this.output = this._multiply;
  }
  /**
   * clean up
   * @returns {Negate} this
   */
  dispose() {
    return super.dispose(), this._multiply.dispose(), this;
  }
}
class Ts extends dt {
  constructor() {
    super(P(Ts.getDefaults(), arguments, ["value"])), this.override = !1, this.name = "Subtract", this._sum = new nt({ context: this.context }), this.input = this._sum, this.output = this._sum, this._neg = new Qc({ context: this.context }), this.subtrahend = this._param, Ge(this._constantSource, this._neg, this._sum);
  }
  static getDefaults() {
    return Object.assign(dt.getDefaults(), {
      value: 0
    });
  }
  dispose() {
    return super.dispose(), this._neg.dispose(), this._sum.dispose(), this;
  }
}
class yo extends Ze {
  constructor() {
    super(P(yo.getDefaults(), arguments)), this.name = "GreaterThanZero", this._thresh = this.output = new hn({
      context: this.context,
      length: 127,
      mapping: (t) => t <= 0 ? 0 : 1
    }), this._scale = this.input = new Ut({
      context: this.context,
      value: 1e4
    }), this._scale.connect(this._thresh);
  }
  dispose() {
    return super.dispose(), this._scale.dispose(), this._thresh.dispose(), this;
  }
}
class vo extends dt {
  constructor() {
    const t = P(vo.getDefaults(), arguments, ["value"]);
    super(t), this.name = "GreaterThan", this.override = !1, this._subtract = this.input = new Ts({
      context: this.context,
      value: t.value
    }), this._gtz = this.output = new yo({
      context: this.context
    }), this.comparator = this._param = this._subtract.subtrahend, ct(this, "comparator"), this._subtract.connect(this._gtz);
  }
  static getDefaults() {
    return Object.assign(dt.getDefaults(), {
      value: 0
    });
  }
  dispose() {
    return super.dispose(), this._gtz.dispose(), this._subtract.dispose(), this.comparator.dispose(), this;
  }
}
class bo extends Mn {
  constructor() {
    const t = P(bo.getDefaults(), arguments, ["min", "max", "exponent"]);
    super(t), this.name = "ScaleExp", this.input = this._exp = new ai({
      context: this.context,
      value: t.exponent
    }), this._exp.connect(this._mult);
  }
  static getDefaults() {
    return Object.assign(Mn.getDefaults(), {
      exponent: 1
    });
  }
  /**
   * Instead of interpolating linearly between the {@link min} and
   * {@link max} values, setting the exponent will interpolate between
   * the two values with an exponential curve.
   */
  get exponent() {
    return this._exp.value;
  }
  set exponent(t) {
    this._exp.value = t;
  }
  dispose() {
    return super.dispose(), this._exp.dispose(), this;
  }
}
class B0 extends dt {
  constructor() {
    const t = P(dt.getDefaults(), arguments, [
      "value",
      "units"
    ]);
    super(t), this.name = "SyncedSignal", this.override = !1, this._lastVal = t.value, this._synced = this.context.transport.scheduleRepeat(this._onTick.bind(this), "1i"), this._syncedCallback = this._anchorValue.bind(this), this.context.transport.on("start", this._syncedCallback), this.context.transport.on("pause", this._syncedCallback), this.context.transport.on("stop", this._syncedCallback), this._constantSource.disconnect(), this._constantSource.stop(0), this._constantSource = this.output = new po({
      context: this.context,
      offset: t.value,
      units: t.units
    }).start(0), this.setValueAtTime(t.value, 0);
  }
  /**
   * Callback which is invoked every tick.
   */
  _onTick(t) {
    const n = super.getValueAtTime(this.context.transport.seconds);
    this._lastVal !== n && (this._lastVal = n, this._constantSource.offset.setValueAtTime(n, t));
  }
  /**
   * Anchor the value at the start and stop of the Transport
   */
  _anchorValue(t) {
    const n = super.getValueAtTime(this.context.transport.seconds);
    this._lastVal = n, this._constantSource.offset.cancelAndHoldAtTime(t), this._constantSource.offset.setValueAtTime(n, t);
  }
  getValueAtTime(t) {
    const n = new re(this.context, t).toSeconds();
    return super.getValueAtTime(n);
  }
  setValueAtTime(t, n) {
    const s = new re(this.context, n).toSeconds();
    return super.setValueAtTime(t, s), this;
  }
  linearRampToValueAtTime(t, n) {
    const s = new re(this.context, n).toSeconds();
    return super.linearRampToValueAtTime(t, s), this;
  }
  exponentialRampToValueAtTime(t, n) {
    const s = new re(this.context, n).toSeconds();
    return super.exponentialRampToValueAtTime(t, s), this;
  }
  setTargetAtTime(t, n, s) {
    const i = new re(this.context, n).toSeconds();
    return super.setTargetAtTime(t, i, s), this;
  }
  cancelScheduledValues(t) {
    const n = new re(this.context, t).toSeconds();
    return super.cancelScheduledValues(n), this;
  }
  setValueCurveAtTime(t, n, s, i) {
    const r = new re(this.context, n).toSeconds();
    return s = this.toSeconds(s), super.setValueCurveAtTime(t, r, s, i), this;
  }
  cancelAndHoldAtTime(t) {
    const n = new re(this.context, t).toSeconds();
    return super.cancelAndHoldAtTime(n), this;
  }
  setRampPoint(t) {
    const n = new re(this.context, t).toSeconds();
    return super.setRampPoint(n), this;
  }
  exponentialRampTo(t, n, s) {
    const i = new re(this.context, s).toSeconds();
    return super.exponentialRampTo(t, n, i), this;
  }
  linearRampTo(t, n, s) {
    const i = new re(this.context, s).toSeconds();
    return super.linearRampTo(t, n, i), this;
  }
  targetRampTo(t, n, s) {
    const i = new re(this.context, s).toSeconds();
    return super.targetRampTo(t, n, i), this;
  }
  dispose() {
    return super.dispose(), this.context.transport.clear(this._synced), this.context.transport.off("start", this._syncedCallback), this.context.transport.off("pause", this._syncedCallback), this.context.transport.off("stop", this._syncedCallback), this._constantSource.dispose(), this;
  }
}
class ye extends B {
  constructor() {
    const t = P(ye.getDefaults(), arguments, ["attack", "decay", "sustain", "release"]);
    super(t), this.name = "Envelope", this._sig = new dt({
      context: this.context,
      value: 0
    }), this.output = this._sig, this.input = void 0, this.attack = t.attack, this.decay = t.decay, this.sustain = t.sustain, this.release = t.release, this.attackCurve = t.attackCurve, this.releaseCurve = t.releaseCurve, this.decayCurve = t.decayCurve;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      attack: 0.01,
      attackCurve: "linear",
      decay: 0.1,
      decayCurve: "exponential",
      release: 1,
      releaseCurve: "exponential",
      sustain: 0.5
    });
  }
  /**
   * Read the current value of the envelope. Useful for
   * synchronizing visual output to the envelope.
   */
  get value() {
    return this.getValueAtTime(this.now());
  }
  /**
   * Get the curve
   * @param  curve
   * @param  direction  In/Out
   * @return The curve name
   */
  _getCurve(t, n) {
    if (an(t))
      return t;
    {
      let s;
      for (s in Cr)
        if (Cr[s][n] === t)
          return s;
      return t;
    }
  }
  /**
   * Assign a the curve to the given name using the direction
   * @param  name
   * @param  direction In/Out
   * @param  curve
   */
  _setCurve(t, n, s) {
    if (an(s) && Reflect.has(Cr, s)) {
      const i = Cr[s];
      Dn(i) ? t !== "_decayCurve" && (this[t] = i[n]) : this[t] = i;
    } else if (_e(s) && t !== "_decayCurve")
      this[t] = s;
    else
      throw new Error("Envelope: invalid curve: " + s);
  }
  /**
   * The shape of the attack.
   * Can be any of these strings:
   * * "linear"
   * * "exponential"
   * * "sine"
   * * "cosine"
   * * "bounce"
   * * "ripple"
   * * "step"
   *
   * Can also be an array which describes the curve. Values
   * in the array are evenly subdivided and linearly
   * interpolated over the duration of the attack.
   * @example
   * return Tone.Offline(() => {
   * 	const env = new Tone.Envelope(0.4).toDestination();
   * 	env.attackCurve = "linear";
   * 	env.triggerAttack();
   * }, 1, 1);
   */
  get attackCurve() {
    return this._getCurve(this._attackCurve, "In");
  }
  set attackCurve(t) {
    this._setCurve("_attackCurve", "In", t);
  }
  /**
   * The shape of the release. See the attack curve types.
   * @example
   * return Tone.Offline(() => {
   * 	const env = new Tone.Envelope({
   * 		release: 0.8
   * 	}).toDestination();
   * 	env.triggerAttack();
   * 	// release curve could also be defined by an array
   * 	env.releaseCurve = [1, 0.3, 0.4, 0.2, 0.7, 0];
   * 	env.triggerRelease(0.2);
   * }, 1, 1);
   */
  get releaseCurve() {
    return this._getCurve(this._releaseCurve, "Out");
  }
  set releaseCurve(t) {
    this._setCurve("_releaseCurve", "Out", t);
  }
  /**
   * The shape of the decay either "linear" or "exponential"
   * @example
   * return Tone.Offline(() => {
   * 	const env = new Tone.Envelope({
   * 		sustain: 0.1,
   * 		decay: 0.5
   * 	}).toDestination();
   * 	env.decayCurve = "linear";
   * 	env.triggerAttack();
   * }, 1, 1);
   */
  get decayCurve() {
    return this._getCurve(this._decayCurve, "Out");
  }
  set decayCurve(t) {
    this._setCurve("_decayCurve", "Out", t);
  }
  /**
   * Trigger the attack/decay portion of the ADSR envelope.
   * @param  time When the attack should start.
   * @param velocity The velocity of the envelope scales the vales.
   *                             number between 0-1
   * @example
   * const env = new Tone.AmplitudeEnvelope().toDestination();
   * const osc = new Tone.Oscillator().connect(env).start();
   * // trigger the attack 0.5 seconds from now with a velocity of 0.2
   * env.triggerAttack("+0.5", 0.2);
   */
  triggerAttack(t, n = 1) {
    this.log("triggerAttack", t, n), t = this.toSeconds(t);
    let i = this.toSeconds(this.attack);
    const r = this.toSeconds(this.decay), o = this.getValueAtTime(t);
    if (o > 0) {
      const a = 1 / i;
      i = (1 - o) / a;
    }
    if (i < this.sampleTime)
      this._sig.cancelScheduledValues(t), this._sig.setValueAtTime(n, t);
    else if (this._attackCurve === "linear")
      this._sig.linearRampTo(n, i, t);
    else if (this._attackCurve === "exponential")
      this._sig.targetRampTo(n, i, t);
    else {
      this._sig.cancelAndHoldAtTime(t);
      let a = this._attackCurve;
      for (let c = 1; c < a.length; c++)
        if (a[c - 1] <= o && o <= a[c]) {
          a = this._attackCurve.slice(c), a[0] = o;
          break;
        }
      this._sig.setValueCurveAtTime(a, t, i, n);
    }
    if (r && this.sustain < 1) {
      const a = n * this.sustain, c = t + i;
      this.log("decay", c), this._decayCurve === "linear" ? this._sig.linearRampToValueAtTime(a, r + c) : this._sig.exponentialApproachValueAtTime(a, c, r);
    }
    return this;
  }
  /**
   * Triggers the release of the envelope.
   * @param  time When the release portion of the envelope should start.
   * @example
   * const env = new Tone.AmplitudeEnvelope().toDestination();
   * const osc = new Tone.Oscillator({
   * 	type: "sawtooth"
   * }).connect(env).start();
   * env.triggerAttack();
   * // trigger the release half a second after the attack
   * env.triggerRelease("+0.5");
   */
  triggerRelease(t) {
    this.log("triggerRelease", t), t = this.toSeconds(t);
    const n = this.getValueAtTime(t);
    if (n > 0) {
      const s = this.toSeconds(this.release);
      s < this.sampleTime ? this._sig.setValueAtTime(0, t) : this._releaseCurve === "linear" ? this._sig.linearRampTo(0, s, t) : this._releaseCurve === "exponential" ? this._sig.targetRampTo(0, s, t) : (st(_e(this._releaseCurve), "releaseCurve must be either 'linear', 'exponential' or an array"), this._sig.cancelAndHoldAtTime(t), this._sig.setValueCurveAtTime(this._releaseCurve, t, s, n));
    }
    return this;
  }
  /**
   * Get the scheduled value at the given time. This will
   * return the unconverted (raw) value.
   * @example
   * const env = new Tone.Envelope(0.5, 1, 0.4, 2);
   * env.triggerAttackRelease(2);
   * setInterval(() => console.log(env.getValueAtTime(Tone.now())), 100);
   */
  getValueAtTime(t) {
    return this._sig.getValueAtTime(t);
  }
  /**
   * triggerAttackRelease is shorthand for triggerAttack, then waiting
   * some duration, then triggerRelease.
   * @param duration The duration of the sustain.
   * @param time When the attack should be triggered.
   * @param velocity The velocity of the envelope.
   * @example
   * const env = new Tone.AmplitudeEnvelope().toDestination();
   * const osc = new Tone.Oscillator().connect(env).start();
   * // trigger the release 0.5 seconds after the attack
   * env.triggerAttackRelease(0.5);
   */
  triggerAttackRelease(t, n, s = 1) {
    return n = this.toSeconds(n), this.triggerAttack(n, s), this.triggerRelease(n + this.toSeconds(t)), this;
  }
  /**
   * Cancels all scheduled envelope changes after the given time.
   */
  cancel(t) {
    return this._sig.cancelScheduledValues(this.toSeconds(t)), this;
  }
  /**
   * Connect the envelope to a destination node.
   */
  connect(t, n = 0, s = 0) {
    return Hi(this, t, n, s), this;
  }
  /**
   * Render the envelope curve to an array of the given length.
   * Good for visualizing the envelope curve. Rescales the duration of the
   * envelope to fit the length.
   */
  asArray() {
    return jt(this, arguments, void 0, function* (t = 1024) {
      const n = t / this.context.sampleRate, s = new si(1, n, this.context.sampleRate), i = this.toSeconds(this.attack) + this.toSeconds(this.decay), r = i + this.toSeconds(this.release), o = r * 0.1, a = r + o, c = new this.constructor(Object.assign(this.get(), {
        attack: n * this.toSeconds(this.attack) / a,
        decay: n * this.toSeconds(this.decay) / a,
        release: n * this.toSeconds(this.release) / a,
        context: s
      }));
      return c._sig.toDestination(), c.triggerAttackRelease(n * (i + o) / a, 0), (yield s.render()).getChannelData(0);
    });
  }
  dispose() {
    return super.dispose(), this._sig.dispose(), this;
  }
}
ln([
  Vn(0)
], ye.prototype, "attack", void 0);
ln([
  Vn(0)
], ye.prototype, "decay", void 0);
ln([
  Xd(0, 1)
], ye.prototype, "sustain", void 0);
ln([
  Vn(0)
], ye.prototype, "release", void 0);
const Cr = (() => {
  let t, n;
  const s = [];
  for (t = 0; t < 128; t++)
    s[t] = Math.sin(t / 127 * (Math.PI / 2));
  const i = [], r = 6.4;
  for (t = 0; t < 127; t++) {
    n = t / 127;
    const d = Math.sin(n * (Math.PI * 2) * r - Math.PI / 2) + 1;
    i[t] = d / 10 + n * 0.83;
  }
  i[127] = 1;
  const o = [], a = 5;
  for (t = 0; t < 128; t++)
    o[t] = Math.ceil(t / 127 * a) / a;
  const c = [];
  for (t = 0; t < 128; t++)
    n = t / 127, c[t] = 0.5 * (1 - Math.cos(Math.PI * n));
  const l = [];
  for (t = 0; t < 128; t++) {
    n = t / 127;
    const d = Math.pow(n, 3) * 4 + 0.2, p = Math.cos(d * Math.PI * 2 * n);
    l[t] = Math.abs(p * (1 - n));
  }
  function u(d) {
    const p = new Array(d.length);
    for (let f = 0; f < d.length; f++)
      p[f] = 1 - d[f];
    return p;
  }
  function h(d) {
    return d.slice(0).reverse();
  }
  return {
    bounce: {
      In: u(l),
      Out: l
    },
    cosine: {
      In: s,
      Out: h(s)
    },
    exponential: "exponential",
    linear: "linear",
    ripple: {
      In: i,
      Out: u(i)
    },
    sine: {
      In: c,
      Out: u(c)
    },
    step: {
      In: o,
      Out: u(o)
    }
  };
})();
class tn extends B {
  constructor() {
    const t = P(tn.getDefaults(), arguments);
    super(t), this._scheduledEvents = [], this._synced = !1, this._original_triggerAttack = this.triggerAttack, this._original_triggerRelease = this.triggerRelease, this._syncedRelease = (n) => this._original_triggerRelease(n), this._volume = this.output = new un({
      context: this.context,
      volume: t.volume
    }), this.volume = this._volume.volume, ct(this, "volume");
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      volume: 0
    });
  }
  /**
   * Sync the instrument to the Transport. All subsequent calls of
   * {@link triggerAttack} and {@link triggerRelease} will be scheduled along the transport.
   * @example
   * const fmSynth = new Tone.FMSynth().toDestination();
   * fmSynth.volume.value = -6;
   * fmSynth.sync();
   * // schedule 3 notes when the transport first starts
   * fmSynth.triggerAttackRelease("C4", "8n", 0);
   * fmSynth.triggerAttackRelease("E4", "8n", "8n");
   * fmSynth.triggerAttackRelease("G4", "8n", "4n");
   * // start the transport to hear the notes
   * Tone.Transport.start();
   */
  sync() {
    return this._syncState() && (this._syncMethod("triggerAttack", 1), this._syncMethod("triggerRelease", 0), this.context.transport.on("stop", this._syncedRelease), this.context.transport.on("pause", this._syncedRelease), this.context.transport.on("loopEnd", this._syncedRelease)), this;
  }
  /**
   * set _sync
   */
  _syncState() {
    let t = !1;
    return this._synced || (this._synced = !0, t = !0), t;
  }
  /**
   * Wrap the given method so that it can be synchronized
   * @param method Which method to wrap and sync
   * @param  timePosition What position the time argument appears in
   */
  _syncMethod(t, n) {
    const s = this["_original_" + t] = this[t];
    this[t] = (...i) => {
      const r = i[n], o = this.context.transport.schedule((a) => {
        i[n] = a, s.apply(this, i);
      }, r);
      this._scheduledEvents.push(o);
    };
  }
  /**
   * Unsync the instrument from the Transport
   */
  unsync() {
    return this._scheduledEvents.forEach((t) => this.context.transport.clear(t)), this._scheduledEvents = [], this._synced && (this._synced = !1, this.triggerAttack = this._original_triggerAttack, this.triggerRelease = this._original_triggerRelease, this.context.transport.off("stop", this._syncedRelease), this.context.transport.off("pause", this._syncedRelease), this.context.transport.off("loopEnd", this._syncedRelease)), this;
  }
  /**
   * Trigger the attack and then the release after the duration.
   * @param  note     The note to trigger.
   * @param  duration How long the note should be held for before
   *                         triggering the release. This value must be greater than 0.
   * @param time  When the note should be triggered.
   * @param  velocity The velocity the note should be triggered at.
   * @example
   * const synth = new Tone.Synth().toDestination();
   * // trigger "C4" for the duration of an 8th note
   * synth.triggerAttackRelease("C4", "8n");
   */
  triggerAttackRelease(t, n, s, i) {
    const r = this.toSeconds(s), o = this.toSeconds(n);
    return this.triggerAttack(t, r, i), this.triggerRelease(r + o), this;
  }
  /**
   * clean up
   * @returns {Instrument} this
   */
  dispose() {
    return super.dispose(), this._volume.dispose(), this.unsync(), this._scheduledEvents = [], this;
  }
}
class ge extends tn {
  constructor() {
    const t = P(ge.getDefaults(), arguments);
    super(t), this.portamento = t.portamento, this.onsilence = t.onsilence;
  }
  static getDefaults() {
    return Object.assign(tn.getDefaults(), {
      detune: 0,
      onsilence: St,
      portamento: 0
    });
  }
  /**
   * Trigger the attack of the note optionally with a given velocity.
   * @param  note The note to trigger.
   * @param  time When the note should start.
   * @param  velocity The velocity determines how "loud" the note will be.
   * @example
   * const synth = new Tone.Synth().toDestination();
   * // trigger the note a half second from now at half velocity
   * synth.triggerAttack("C4", "+0.5", 0.5);
   */
  triggerAttack(t, n, s = 1) {
    this.log("triggerAttack", t, n, s);
    const i = this.toSeconds(n);
    return this._triggerEnvelopeAttack(i, s), this.setNote(t, i), this;
  }
  /**
   * Trigger the release portion of the envelope.
   * @param  time If no time is given, the release happens immediately.
   * @example
   * const synth = new Tone.Synth().toDestination();
   * synth.triggerAttack("C4");
   * // trigger the release a second from now
   * synth.triggerRelease("+1");
   */
  triggerRelease(t) {
    this.log("triggerRelease", t);
    const n = this.toSeconds(t);
    return this._triggerEnvelopeRelease(n), this;
  }
  /**
   * Set the note at the given time. If no time is given, the note
   * will set immediately.
   * @param note The note to change to.
   * @param  time The time when the note should be set.
   * @example
   * const synth = new Tone.Synth().toDestination();
   * synth.triggerAttack("C4");
   * // change to F#6 in one quarter note from now.
   * synth.setNote("F#6", "+4n");
   */
  setNote(t, n) {
    const s = this.toSeconds(n), i = t instanceof Oe ? t.toFrequency() : t;
    if (this.portamento > 0 && this.getLevelAtTime(s) > 0.05) {
      const r = this.toSeconds(this.portamento);
      this.frequency.exponentialRampTo(i, r, s);
    } else
      this.frequency.setValueAtTime(i, s);
    return this;
  }
}
ln([
  Vn(0)
], ge.prototype, "portamento", void 0);
class ui extends ye {
  constructor() {
    super(P(ui.getDefaults(), arguments, [
      "attack",
      "decay",
      "sustain",
      "release"
    ])), this.name = "AmplitudeEnvelope", this._gainNode = new nt({
      context: this.context,
      gain: 0
    }), this.output = this._gainNode, this.input = this._gainNode, this._sig.connect(this._gainNode.gain), this.output = this._gainNode, this.input = this._gainNode;
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this._gainNode.dispose(), this;
  }
}
class Kn extends ge {
  constructor() {
    const t = P(Kn.getDefaults(), arguments);
    super(t), this.name = "Synth", this.oscillator = new On(Object.assign({
      context: this.context,
      detune: t.detune,
      onstop: () => this.onsilence(this)
    }, t.oscillator)), this.frequency = this.oscillator.frequency, this.detune = this.oscillator.detune, this.envelope = new ui(Object.assign({
      context: this.context
    }, t.envelope)), this.oscillator.chain(this.envelope, this.output), ct(this, ["oscillator", "frequency", "detune", "envelope"]);
  }
  static getDefaults() {
    return Object.assign(ge.getDefaults(), {
      envelope: Object.assign(me(ye.getDefaults(), Object.keys(B.getDefaults())), {
        attack: 5e-3,
        decay: 0.1,
        release: 1,
        sustain: 0.3
      }),
      oscillator: Object.assign(me(On.getDefaults(), [
        ...Object.keys(Qt.getDefaults()),
        "frequency",
        "detune"
      ]), {
        type: "triangle"
      })
    });
  }
  /**
   * start the attack portion of the envelope
   * @param time the time the attack should start
   * @param velocity the velocity of the note (0-1)
   */
  _triggerEnvelopeAttack(t, n) {
    if (this.envelope.triggerAttack(t, n), this.oscillator.start(t), this.envelope.sustain === 0) {
      const s = this.toSeconds(this.envelope.attack), i = this.toSeconds(this.envelope.decay);
      this.oscillator.stop(t + s + i);
    }
  }
  /**
   * start the release portion of the envelope
   * @param time the time the release should start
   */
  _triggerEnvelopeRelease(t) {
    this.envelope.triggerRelease(t), this.oscillator.stop(t + this.toSeconds(this.envelope.release));
  }
  getLevelAtTime(t) {
    return t = this.toSeconds(t), this.envelope.getValueAtTime(t);
  }
  /**
   * clean up
   */
  dispose() {
    return super.dispose(), this.oscillator.dispose(), this.envelope.dispose(), this;
  }
}
class Fi extends ge {
  constructor() {
    const t = P(Fi.getDefaults(), arguments);
    super(t), this.name = "ModulationSynth", this._carrier = new Kn({
      context: this.context,
      oscillator: t.oscillator,
      envelope: t.envelope,
      onsilence: () => this.onsilence(this),
      volume: -10
    }), this._modulator = new Kn({
      context: this.context,
      oscillator: t.modulation,
      envelope: t.modulationEnvelope,
      volume: -10
    }), this.oscillator = this._carrier.oscillator, this.envelope = this._carrier.envelope, this.modulation = this._modulator.oscillator, this.modulationEnvelope = this._modulator.envelope, this.frequency = new dt({
      context: this.context,
      units: "frequency"
    }), this.detune = new dt({
      context: this.context,
      value: t.detune,
      units: "cents"
    }), this.harmonicity = new Ut({
      context: this.context,
      value: t.harmonicity,
      minValue: 0
    }), this._modulationNode = new nt({
      context: this.context,
      gain: 0
    }), ct(this, [
      "frequency",
      "harmonicity",
      "oscillator",
      "envelope",
      "modulation",
      "modulationEnvelope",
      "detune"
    ]);
  }
  static getDefaults() {
    return Object.assign(ge.getDefaults(), {
      harmonicity: 3,
      oscillator: Object.assign(me(On.getDefaults(), [
        ...Object.keys(Qt.getDefaults()),
        "frequency",
        "detune"
      ]), {
        type: "sine"
      }),
      envelope: Object.assign(me(ye.getDefaults(), Object.keys(B.getDefaults())), {
        attack: 0.01,
        decay: 0.01,
        sustain: 1,
        release: 0.5
      }),
      modulation: Object.assign(me(On.getDefaults(), [
        ...Object.keys(Qt.getDefaults()),
        "frequency",
        "detune"
      ]), {
        type: "square"
      }),
      modulationEnvelope: Object.assign(me(ye.getDefaults(), Object.keys(B.getDefaults())), {
        attack: 0.5,
        decay: 0,
        sustain: 1,
        release: 0.5
      })
    });
  }
  /**
   * Trigger the attack portion of the note
   */
  _triggerEnvelopeAttack(t, n) {
    this._carrier._triggerEnvelopeAttack(t, n), this._modulator._triggerEnvelopeAttack(t, n);
  }
  /**
   * Trigger the release portion of the note
   */
  _triggerEnvelopeRelease(t) {
    return this._carrier._triggerEnvelopeRelease(t), this._modulator._triggerEnvelopeRelease(t), this;
  }
  getLevelAtTime(t) {
    return t = this.toSeconds(t), this.envelope.getValueAtTime(t);
  }
  dispose() {
    return super.dispose(), this._carrier.dispose(), this._modulator.dispose(), this.frequency.dispose(), this.detune.dispose(), this.harmonicity.dispose(), this._modulationNode.dispose(), this;
  }
}
class Jc extends Fi {
  constructor() {
    super(P(Jc.getDefaults(), arguments)), this.name = "AMSynth", this._modulationScale = new go({
      context: this.context
    }), this.frequency.connect(this._carrier.frequency), this.frequency.chain(this.harmonicity, this._modulator.frequency), this.detune.fan(this._carrier.detune, this._modulator.detune), this._modulator.chain(this._modulationScale, this._modulationNode.gain), this._carrier.chain(this._modulationNode, this.output);
  }
  dispose() {
    return super.dispose(), this._modulationScale.dispose(), this;
  }
}
class Pi extends B {
  constructor() {
    const t = P(Pi.getDefaults(), arguments, ["frequency", "type"]);
    super(t), this.name = "BiquadFilter", this._filter = this.context.createBiquadFilter(), this.input = this.output = this._filter, this.Q = new gt({
      context: this.context,
      units: "number",
      value: t.Q,
      param: this._filter.Q
    }), this.frequency = new gt({
      context: this.context,
      units: "frequency",
      value: t.frequency,
      param: this._filter.frequency
    }), this.detune = new gt({
      context: this.context,
      units: "cents",
      value: t.detune,
      param: this._filter.detune
    }), this.gain = new gt({
      context: this.context,
      units: "decibels",
      convert: !1,
      value: t.gain,
      param: this._filter.gain
    }), this.type = t.type;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      Q: 1,
      type: "lowpass",
      frequency: 350,
      detune: 0,
      gain: 0
    });
  }
  /**
   * The type of this BiquadFilterNode. For a complete list of types and their attributes, see the
   * [Web Audio API](https://webaudio.github.io/web-audio-api/#dom-biquadfiltertype-lowpass)
   */
  get type() {
    return this._filter.type;
  }
  set type(t) {
    st([
      "lowpass",
      "highpass",
      "bandpass",
      "lowshelf",
      "highshelf",
      "notch",
      "allpass",
      "peaking"
    ].indexOf(t) !== -1, `Invalid filter type: ${t}`), this._filter.type = t;
  }
  /**
   * Get the frequency response curve. This curve represents how the filter
   * responses to frequencies between 20hz-20khz.
   * @param  len The number of values to return
   * @return The frequency response curve between 20-20kHz
   */
  getFrequencyResponse(t = 128) {
    const n = new Float32Array(t);
    for (let o = 0; o < t; o++) {
      const c = Math.pow(o / t, 2) * 19980 + 20;
      n[o] = c;
    }
    const s = new Float32Array(t), i = new Float32Array(t), r = this.context.createBiquadFilter();
    return r.type = this.type, r.Q.value = this.Q.value, r.frequency.value = this.frequency.value, r.gain.value = this.gain.value, r.getFrequencyResponse(n, s, i), s;
  }
  dispose() {
    return super.dispose(), this._filter.disconnect(), this.Q.dispose(), this.frequency.dispose(), this.gain.dispose(), this.detune.dispose(), this;
  }
}
class Be extends B {
  constructor() {
    const t = P(Be.getDefaults(), arguments, [
      "frequency",
      "type",
      "rolloff"
    ]);
    super(t), this.name = "Filter", this.input = new nt({ context: this.context }), this.output = new nt({ context: this.context }), this._filters = [], this._filters = [], this.Q = new dt({
      context: this.context,
      units: "positive",
      value: t.Q
    }), this.frequency = new dt({
      context: this.context,
      units: "frequency",
      value: t.frequency
    }), this.detune = new dt({
      context: this.context,
      units: "cents",
      value: t.detune
    }), this.gain = new dt({
      context: this.context,
      units: "decibels",
      convert: !1,
      value: t.gain
    }), this._type = t.type, this.rolloff = t.rolloff, ct(this, ["detune", "frequency", "gain", "Q"]);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      Q: 1,
      detune: 0,
      frequency: 350,
      gain: 0,
      rolloff: -12,
      type: "lowpass"
    });
  }
  /**
   * The type of the filter. Types: "lowpass", "highpass",
   * "bandpass", "lowshelf", "highshelf", "notch", "allpass", or "peaking".
   */
  get type() {
    return this._type;
  }
  set type(t) {
    st([
      "lowpass",
      "highpass",
      "bandpass",
      "lowshelf",
      "highshelf",
      "notch",
      "allpass",
      "peaking"
    ].indexOf(t) !== -1, `Invalid filter type: ${t}`), this._type = t, this._filters.forEach((s) => s.type = t);
  }
  /**
   * The rolloff of the filter which is the drop in db
   * per octave. Implemented internally by cascading filters.
   * Only accepts the values -12, -24, -48 and -96.
   */
  get rolloff() {
    return this._rolloff;
  }
  set rolloff(t) {
    const n = ze(t) ? t : parseInt(t, 10), s = [-12, -24, -48, -96];
    let i = s.indexOf(n);
    st(i !== -1, `rolloff can only be ${s.join(", ")}`), i += 1, this._rolloff = n, this.input.disconnect(), this._filters.forEach((r) => r.disconnect()), this._filters = new Array(i);
    for (let r = 0; r < i; r++) {
      const o = new Pi({
        context: this.context
      });
      o.type = this._type, this.frequency.connect(o.frequency), this.detune.connect(o.detune), this.Q.connect(o.Q), this.gain.connect(o.gain), this._filters[r] = o;
    }
    this._internalChannels = this._filters, Ge(this.input, ...this._internalChannels, this.output);
  }
  /**
   * Get the frequency response curve. This curve represents how the filter
   * responses to frequencies between 20hz-20khz.
   * @param  len The number of values to return
   * @return The frequency response curve between 20-20kHz
   */
  getFrequencyResponse(t = 128) {
    const n = new Pi({
      context: this.context,
      frequency: this.frequency.value,
      gain: this.gain.value,
      Q: this.Q.value,
      type: this._type,
      detune: this.detune.value
    }), s = new Float32Array(t).map(() => 1);
    return this._filters.forEach(() => {
      n.getFrequencyResponse(t).forEach((r, o) => s[o] *= r);
    }), n.dispose(), s;
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._filters.forEach((t) => {
      t.dispose();
    }), Xi(this, ["detune", "frequency", "gain", "Q"]), this.frequency.dispose(), this.Q.dispose(), this.detune.dispose(), this.gain.dispose(), this;
  }
}
class Ni extends ye {
  constructor() {
    const t = P(Ni.getDefaults(), arguments, ["attack", "decay", "sustain", "release"]);
    super(t), this.name = "FrequencyEnvelope", this._octaves = t.octaves, this._baseFrequency = this.toFrequency(t.baseFrequency), this._exponent = this.input = new ai({
      context: this.context,
      value: t.exponent
    }), this._scale = this.output = new Mn({
      context: this.context,
      min: this._baseFrequency,
      max: this._baseFrequency * Math.pow(2, this._octaves)
    }), this._sig.chain(this._exponent, this._scale);
  }
  static getDefaults() {
    return Object.assign(ye.getDefaults(), {
      baseFrequency: 200,
      exponent: 1,
      octaves: 4
    });
  }
  /**
   * The envelope's minimum output value. This is the value which it
   * starts at.
   */
  get baseFrequency() {
    return this._baseFrequency;
  }
  set baseFrequency(t) {
    const n = this.toFrequency(t);
    oe(n, 0), this._baseFrequency = n, this._scale.min = this._baseFrequency, this.octaves = this._octaves;
  }
  /**
   * The number of octaves above the baseFrequency that the
   * envelope will scale to.
   */
  get octaves() {
    return this._octaves;
  }
  set octaves(t) {
    this._octaves = t, this._scale.max = this._baseFrequency * Math.pow(2, t);
  }
  /**
   * The envelope's exponent value.
   */
  get exponent() {
    return this._exponent.value;
  }
  set exponent(t) {
    this._exponent.value = t;
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this._exponent.dispose(), this._scale.dispose(), this;
  }
}
class ds extends ge {
  constructor() {
    const t = P(ds.getDefaults(), arguments);
    super(t), this.name = "MonoSynth", this.oscillator = new On(Object.assign(t.oscillator, {
      context: this.context,
      detune: t.detune,
      onstop: () => this.onsilence(this)
    })), this.frequency = this.oscillator.frequency, this.detune = this.oscillator.detune, this.filter = new Be(Object.assign(t.filter, { context: this.context })), this.filterEnvelope = new Ni(Object.assign(t.filterEnvelope, { context: this.context })), this.envelope = new ui(Object.assign(t.envelope, { context: this.context })), this.oscillator.chain(this.filter, this.envelope, this.output), this.filterEnvelope.connect(this.filter.frequency), ct(this, [
      "oscillator",
      "frequency",
      "detune",
      "filter",
      "filterEnvelope",
      "envelope"
    ]);
  }
  static getDefaults() {
    return Object.assign(ge.getDefaults(), {
      envelope: Object.assign(me(ye.getDefaults(), Object.keys(B.getDefaults())), {
        attack: 5e-3,
        decay: 0.1,
        release: 1,
        sustain: 0.9
      }),
      filter: Object.assign(me(Be.getDefaults(), Object.keys(B.getDefaults())), {
        Q: 1,
        rolloff: -12,
        type: "lowpass"
      }),
      filterEnvelope: Object.assign(me(Ni.getDefaults(), Object.keys(B.getDefaults())), {
        attack: 0.6,
        baseFrequency: 200,
        decay: 0.2,
        exponent: 2,
        octaves: 3,
        release: 2,
        sustain: 0.5
      }),
      oscillator: Object.assign(me(On.getDefaults(), Object.keys(Qt.getDefaults())), {
        type: "sawtooth"
      })
    });
  }
  /**
   * start the attack portion of the envelope
   * @param time the time the attack should start
   * @param velocity the velocity of the note (0-1)
   */
  _triggerEnvelopeAttack(t, n = 1) {
    if (this.envelope.triggerAttack(t, n), this.filterEnvelope.triggerAttack(t), this.oscillator.start(t), this.envelope.sustain === 0) {
      const s = this.toSeconds(this.envelope.attack), i = this.toSeconds(this.envelope.decay);
      this.oscillator.stop(t + s + i);
    }
  }
  /**
   * start the release portion of the envelope
   * @param time the time the release should start
   */
  _triggerEnvelopeRelease(t) {
    this.envelope.triggerRelease(t), this.filterEnvelope.triggerRelease(t), this.oscillator.stop(t + this.toSeconds(this.envelope.release));
  }
  getLevelAtTime(t) {
    return t = this.toSeconds(t), this.envelope.getValueAtTime(t);
  }
  dispose() {
    return super.dispose(), this.oscillator.dispose(), this.envelope.dispose(), this.filterEnvelope.dispose(), this.filter.dispose(), this;
  }
}
class tl extends ge {
  constructor() {
    const t = P(tl.getDefaults(), arguments);
    super(t), this.name = "DuoSynth", this.voice0 = new ds(Object.assign(t.voice0, {
      context: this.context,
      onsilence: () => this.onsilence(this)
    })), this.voice1 = new ds(Object.assign(t.voice1, {
      context: this.context
    })), this.harmonicity = new Ut({
      context: this.context,
      units: "positive",
      value: t.harmonicity
    }), this._vibrato = new Me({
      frequency: t.vibratoRate,
      context: this.context,
      min: -50,
      max: 50
    }), this._vibrato.start(), this.vibratoRate = this._vibrato.frequency, this._vibratoGain = new nt({
      context: this.context,
      units: "normalRange",
      gain: t.vibratoAmount
    }), this.vibratoAmount = this._vibratoGain.gain, this.frequency = new dt({
      context: this.context,
      units: "frequency",
      value: 440
    }), this.detune = new dt({
      context: this.context,
      units: "cents",
      value: t.detune
    }), this.frequency.connect(this.voice0.frequency), this.frequency.chain(this.harmonicity, this.voice1.frequency), this._vibrato.connect(this._vibratoGain), this._vibratoGain.fan(this.voice0.detune, this.voice1.detune), this.detune.fan(this.voice0.detune, this.voice1.detune), this.voice0.connect(this.output), this.voice1.connect(this.output), ct(this, [
      "voice0",
      "voice1",
      "frequency",
      "vibratoAmount",
      "vibratoRate"
    ]);
  }
  getLevelAtTime(t) {
    return t = this.toSeconds(t), this.voice0.envelope.getValueAtTime(t) + this.voice1.envelope.getValueAtTime(t);
  }
  static getDefaults() {
    return Qe(ge.getDefaults(), {
      vibratoAmount: 0.5,
      vibratoRate: 5,
      harmonicity: 1.5,
      voice0: Qe(me(ds.getDefaults(), Object.keys(ge.getDefaults())), {
        filterEnvelope: {
          attack: 0.01,
          decay: 0,
          sustain: 1,
          release: 0.5
        },
        envelope: {
          attack: 0.01,
          decay: 0,
          sustain: 1,
          release: 0.5
        }
      }),
      voice1: Qe(me(ds.getDefaults(), Object.keys(ge.getDefaults())), {
        filterEnvelope: {
          attack: 0.01,
          decay: 0,
          sustain: 1,
          release: 0.5
        },
        envelope: {
          attack: 0.01,
          decay: 0,
          sustain: 1,
          release: 0.5
        }
      })
    });
  }
  /**
   * Trigger the attack portion of the note
   */
  _triggerEnvelopeAttack(t, n) {
    this.voice0._triggerEnvelopeAttack(t, n), this.voice1._triggerEnvelopeAttack(t, n);
  }
  /**
   * Trigger the release portion of the note
   */
  _triggerEnvelopeRelease(t) {
    return this.voice0._triggerEnvelopeRelease(t), this.voice1._triggerEnvelopeRelease(t), this;
  }
  dispose() {
    return super.dispose(), this.voice0.dispose(), this.voice1.dispose(), this.frequency.dispose(), this.detune.dispose(), this._vibrato.dispose(), this.vibratoRate.dispose(), this._vibratoGain.dispose(), this.harmonicity.dispose(), this;
  }
}
class el extends Fi {
  constructor() {
    const t = P(el.getDefaults(), arguments);
    super(t), this.name = "FMSynth", this.modulationIndex = new Ut({
      context: this.context,
      value: t.modulationIndex
    }), this.frequency.connect(this._carrier.frequency), this.frequency.chain(this.harmonicity, this._modulator.frequency), this.frequency.chain(this.modulationIndex, this._modulationNode), this.detune.fan(this._carrier.detune, this._modulator.detune), this._modulator.connect(this._modulationNode.gain), this._modulationNode.connect(this._carrier.frequency), this._carrier.connect(this.output);
  }
  static getDefaults() {
    return Object.assign(Fi.getDefaults(), {
      modulationIndex: 10
    });
  }
  dispose() {
    return super.dispose(), this.modulationIndex.dispose(), this;
  }
}
const hu = [1, 1.483, 1.932, 2.546, 2.63, 3.897];
class nl extends ge {
  constructor() {
    const t = P(nl.getDefaults(), arguments);
    super(t), this.name = "MetalSynth", this._oscillators = [], this._freqMultipliers = [], this.detune = new dt({
      context: this.context,
      units: "cents",
      value: t.detune
    }), this.frequency = new dt({
      context: this.context,
      units: "frequency"
    }), this._amplitude = new nt({
      context: this.context,
      gain: 0
    }).connect(this.output), this._highpass = new Be({
      // Q: -3.0102999566398125,
      Q: 0,
      context: this.context,
      type: "highpass"
    }).connect(this._amplitude);
    for (let n = 0; n < hu.length; n++) {
      const s = new ci({
        context: this.context,
        harmonicity: t.harmonicity,
        modulationIndex: t.modulationIndex,
        modulationType: "square",
        onstop: n === 0 ? () => this.onsilence(this) : St,
        type: "square"
      });
      s.connect(this._highpass), this._oscillators[n] = s;
      const i = new Ut({
        context: this.context,
        value: hu[n]
      });
      this._freqMultipliers[n] = i, this.frequency.chain(i, s.frequency), this.detune.connect(s.detune);
    }
    this._filterFreqScaler = new Mn({
      context: this.context,
      max: 7e3,
      min: this.toFrequency(t.resonance)
    }), this.envelope = new ye({
      attack: t.envelope.attack,
      attackCurve: "linear",
      context: this.context,
      decay: t.envelope.decay,
      release: t.envelope.release,
      sustain: 0
    }), this.envelope.chain(this._filterFreqScaler, this._highpass.frequency), this.envelope.connect(this._amplitude.gain), this._octaves = t.octaves, this.octaves = t.octaves;
  }
  static getDefaults() {
    return Qe(ge.getDefaults(), {
      envelope: Object.assign(me(ye.getDefaults(), Object.keys(B.getDefaults())), {
        attack: 1e-3,
        decay: 1.4,
        release: 0.2
      }),
      harmonicity: 5.1,
      modulationIndex: 32,
      octaves: 1.5,
      resonance: 4e3
    });
  }
  /**
   * Trigger the attack.
   * @param time When the attack should be triggered.
   * @param velocity The velocity that the envelope should be triggered at.
   */
  _triggerEnvelopeAttack(t, n = 1) {
    return this.envelope.triggerAttack(t, n), this._oscillators.forEach((s) => s.start(t)), this.envelope.sustain === 0 && this._oscillators.forEach((s) => {
      s.stop(t + this.toSeconds(this.envelope.attack) + this.toSeconds(this.envelope.decay));
    }), this;
  }
  /**
   * Trigger the release of the envelope.
   * @param time When the release should be triggered.
   */
  _triggerEnvelopeRelease(t) {
    return this.envelope.triggerRelease(t), this._oscillators.forEach((n) => n.stop(t + this.toSeconds(this.envelope.release))), this;
  }
  getLevelAtTime(t) {
    return t = this.toSeconds(t), this.envelope.getValueAtTime(t);
  }
  /**
   * The modulationIndex of the oscillators which make up the source.
   * see {@link FMOscillator.modulationIndex}
   * @min 1
   * @max 100
   */
  get modulationIndex() {
    return this._oscillators[0].modulationIndex.value;
  }
  set modulationIndex(t) {
    this._oscillators.forEach((n) => n.modulationIndex.value = t);
  }
  /**
   * The harmonicity of the oscillators which make up the source.
   * see Tone.FMOscillator.harmonicity
   * @min 0.1
   * @max 10
   */
  get harmonicity() {
    return this._oscillators[0].harmonicity.value;
  }
  set harmonicity(t) {
    this._oscillators.forEach((n) => n.harmonicity.value = t);
  }
  /**
   * The lower level of the highpass filter which is attached to the envelope.
   * This value should be between [0, 7000]
   * @min 0
   * @max 7000
   */
  get resonance() {
    return this._filterFreqScaler.min;
  }
  set resonance(t) {
    this._filterFreqScaler.min = this.toFrequency(t), this.octaves = this._octaves;
  }
  /**
   * The number of octaves above the "resonance" frequency
   * that the filter ramps during the attack/decay envelope
   * @min 0
   * @max 8
   */
  get octaves() {
    return this._octaves;
  }
  set octaves(t) {
    this._octaves = t, this._filterFreqScaler.max = this._filterFreqScaler.min * Math.pow(2, t);
  }
  dispose() {
    return super.dispose(), this._oscillators.forEach((t) => t.dispose()), this._freqMultipliers.forEach((t) => t.dispose()), this.frequency.dispose(), this.detune.dispose(), this._filterFreqScaler.dispose(), this._amplitude.dispose(), this.envelope.dispose(), this._highpass.dispose(), this;
  }
}
class er extends Kn {
  constructor() {
    const t = P(er.getDefaults(), arguments);
    super(t), this.name = "MembraneSynth", this.portamento = 0, this.pitchDecay = t.pitchDecay, this.octaves = t.octaves, ct(this, ["oscillator", "envelope"]);
  }
  static getDefaults() {
    return Qe(ge.getDefaults(), Kn.getDefaults(), {
      envelope: {
        attack: 1e-3,
        attackCurve: "exponential",
        decay: 0.4,
        release: 1.4,
        sustain: 0.01
      },
      octaves: 10,
      oscillator: {
        type: "sine"
      },
      pitchDecay: 0.05
    });
  }
  setNote(t, n) {
    const s = this.toSeconds(n), i = this.toFrequency(t instanceof Oe ? t.toFrequency() : t), r = i * this.octaves;
    return this.oscillator.frequency.setValueAtTime(r, s), this.oscillator.frequency.exponentialRampToValueAtTime(i, s + this.toSeconds(this.pitchDecay)), this;
  }
  dispose() {
    return super.dispose(), this;
  }
}
ln([
  Xd(0)
], er.prototype, "octaves", void 0);
ln([
  Vn(0)
], er.prototype, "pitchDecay", void 0);
class sl extends tn {
  constructor() {
    const t = P(sl.getDefaults(), arguments);
    super(t), this.name = "NoiseSynth", this.noise = new Hn(Object.assign({
      context: this.context
    }, t.noise)), this.envelope = new ui(Object.assign({
      context: this.context
    }, t.envelope)), this.noise.chain(this.envelope, this.output);
  }
  static getDefaults() {
    return Object.assign(tn.getDefaults(), {
      envelope: Object.assign(me(ye.getDefaults(), Object.keys(B.getDefaults())), {
        decay: 0.1,
        sustain: 0
      }),
      noise: Object.assign(me(Hn.getDefaults(), Object.keys(Qt.getDefaults())), {
        type: "white"
      })
    });
  }
  /**
   * Start the attack portion of the envelopes. Unlike other
   * instruments, Tone.NoiseSynth doesn't have a note.
   * @example
   * const noiseSynth = new Tone.NoiseSynth().toDestination();
   * noiseSynth.triggerAttack();
   */
  triggerAttack(t, n = 1) {
    return t = this.toSeconds(t), this.envelope.triggerAttack(t, n), this.noise.start(t), this.envelope.sustain === 0 && this.noise.stop(t + this.toSeconds(this.envelope.attack) + this.toSeconds(this.envelope.decay)), this;
  }
  /**
   * Start the release portion of the envelopes.
   */
  triggerRelease(t) {
    return t = this.toSeconds(t), this.envelope.triggerRelease(t), this.noise.stop(t + this.toSeconds(this.envelope.release)), this;
  }
  sync() {
    return this._syncState() && (this._syncMethod("triggerAttack", 0), this._syncMethod("triggerRelease", 0)), this;
  }
  /**
   * Trigger the attack and then the release after the duration.
   * @param duration The amount of time to hold the note for
   * @param time The time the note should start
   * @param velocity The volume of the note (0-1)
   * @example
   * const noiseSynth = new Tone.NoiseSynth().toDestination();
   * // hold the note for 0.5 seconds
   * noiseSynth.triggerAttackRelease(0.5);
   */
  triggerAttackRelease(t, n, s = 1) {
    return n = this.toSeconds(n), t = this.toSeconds(t), this.triggerAttack(n, s), this.triggerRelease(n + t), this;
  }
  dispose() {
    return super.dispose(), this.noise.dispose(), this.envelope.dispose(), this;
  }
}
const il = /* @__PURE__ */ new Set();
function rl(e) {
  il.add(e);
}
function Kd(e, t) {
  const n = (
    /* javascript */
    `registerProcessor("${e}", ${t})`
  );
  il.add(n);
}
function $0() {
  return Array.from(il).join(`
`);
}
class Wa extends B {
  constructor(t) {
    super(t), this.name = "ToneAudioWorklet", this.workletOptions = {}, this.onprocessorerror = St;
    const n = URL.createObjectURL(new Blob([$0()], { type: "text/javascript" })), s = this._audioWorkletName();
    this._dummyGain = this.context.createGain(), this._dummyParam = this._dummyGain.gain, this.context.addAudioWorkletModule(n).then(() => {
      this.disposed || (this._worklet = this.context.createAudioWorkletNode(s, this.workletOptions), this._worklet.onprocessorerror = this.onprocessorerror.bind(this), this.onReady(this._worklet));
    });
  }
  dispose() {
    return super.dispose(), this._dummyGain.disconnect(), this._worklet && (this._worklet.port.postMessage("dispose"), this._worklet.disconnect()), this;
  }
}
const q0 = (
  /* javascript */
  `
	/**
	 * The base AudioWorkletProcessor for use in Tone.js. Works with the {@link ToneAudioWorklet}. 
	 */
	class ToneAudioWorkletProcessor extends AudioWorkletProcessor {

		constructor(options) {
			
			super(options);
			/**
			 * If the processor was disposed or not. Keep alive until it's disposed.
			 */
			this.disposed = false;
		   	/** 
			 * The number of samples in the processing block
			 */
			this.blockSize = 128;
			/**
			 * the sample rate
			 */
			this.sampleRate = sampleRate;

			this.port.onmessage = (event) => {
				// when it receives a dispose 
				if (event.data === "dispose") {
					this.disposed = true;
				}
			};
		}
	}
`
);
rl(q0);
const z0 = (
  /* javascript */
  `
	/**
	 * Abstract class for a single input/output processor. 
	 * has a 'generate' function which processes one sample at a time
	 */
	class SingleIOProcessor extends ToneAudioWorkletProcessor {

		constructor(options) {
			super(Object.assign(options, {
				numberOfInputs: 1,
				numberOfOutputs: 1
			}));
			/**
			 * Holds the name of the parameter and a single value of that
			 * parameter at the current sample
			 * @type { [name: string]: number }
			 */
			this.params = {}
		}

		/**
		 * Generate an output sample from the input sample and parameters
		 * @abstract
		 * @param input number
		 * @param channel number
		 * @param parameters { [name: string]: number }
		 * @returns number
		 */
		generate(){}

		/**
		 * Update the private params object with the 
		 * values of the parameters at the given index
		 * @param parameters { [name: string]: Float32Array },
		 * @param index number
		 */
		updateParams(parameters, index) {
			for (const paramName in parameters) {
				const param = parameters[paramName];
				if (param.length > 1) {
					this.params[paramName] = parameters[paramName][index];
				} else {
					this.params[paramName] = parameters[paramName][0];
				}
			}
		}

		/**
		 * Process a single frame of the audio
		 * @param inputs Float32Array[][]
		 * @param outputs Float32Array[][]
		 */
		process(inputs, outputs, parameters) {
			const input = inputs[0];
			const output = outputs[0];
			// get the parameter values
			const channelCount = Math.max(input && input.length || 0, output.length);
			for (let sample = 0; sample < this.blockSize; sample++) {
				this.updateParams(parameters, sample);
				for (let channel = 0; channel < channelCount; channel++) {
					const inputSample = input && input.length ? input[channel][sample] : 0;
					output[channel][sample] = this.generate(inputSample, channel, this.params);
				}
			}
			return !this.disposed;
		}
	};
`
);
rl(z0);
const G0 = (
  /* javascript */
  `
	/**
	 * A multichannel buffer for use within an AudioWorkletProcessor as a delay line
	 */
	class DelayLine {
		
		constructor(size, channels) {
			this.buffer = [];
			this.writeHead = []
			this.size = size;

			// create the empty channels
			for (let i = 0; i < channels; i++) {
				this.buffer[i] = new Float32Array(this.size);
				this.writeHead[i] = 0;
			}
		}

		/**
		 * Push a value onto the end
		 * @param channel number
		 * @param value number
		 */
		push(channel, value) {
			this.writeHead[channel] += 1;
			if (this.writeHead[channel] > this.size) {
				this.writeHead[channel] = 0;
			}
			this.buffer[channel][this.writeHead[channel]] = value;
		}

		/**
		 * Get the recorded value of the channel given the delay
		 * @param channel number
		 * @param delay number delay samples
		 */
		get(channel, delay) {
			let readHead = this.writeHead[channel] - Math.floor(delay);
			if (readHead < 0) {
				readHead += this.size;
			}
			return this.buffer[channel][readHead];
		}
	}
`
);
rl(G0);
const Qd = "feedback-comb-filter", Z0 = (
  /* javascript */
  `
	class FeedbackCombFilterWorklet extends SingleIOProcessor {

		constructor(options) {
			super(options);
			this.delayLine = new DelayLine(this.sampleRate, options.channelCount || 2);
		}

		static get parameterDescriptors() {
			return [{
				name: "delayTime",
				defaultValue: 0.1,
				minValue: 0,
				maxValue: 1,
				automationRate: "k-rate"
			}, {
				name: "feedback",
				defaultValue: 0.5,
				minValue: 0,
				maxValue: 0.9999,
				automationRate: "k-rate"
			}];
		}

		generate(input, channel, parameters) {
			const delayedSample = this.delayLine.get(channel, parameters.delayTime * this.sampleRate);
			this.delayLine.push(channel, input + delayedSample * parameters.feedback);
			return delayedSample;
		}
	}
`
);
Kd(Qd, Z0);
class nr extends Wa {
  constructor() {
    const t = P(nr.getDefaults(), arguments, ["delayTime", "resonance"]);
    super(t), this.name = "FeedbackCombFilter", this.input = new nt({ context: this.context }), this.output = new nt({ context: this.context }), this.delayTime = new gt({
      context: this.context,
      value: t.delayTime,
      units: "time",
      minValue: 0,
      maxValue: 1,
      param: this._dummyParam,
      swappable: !0
    }), this.resonance = new gt({
      context: this.context,
      value: t.resonance,
      units: "normalRange",
      param: this._dummyParam,
      swappable: !0
    }), ct(this, ["resonance", "delayTime"]);
  }
  _audioWorkletName() {
    return Qd;
  }
  /**
   * The default parameters
   */
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      delayTime: 0.1,
      resonance: 0.5
    });
  }
  onReady(t) {
    Ge(this.input, t, this.output);
    const n = t.parameters.get("delayTime");
    this.delayTime.setParam(n);
    const s = t.parameters.get("feedback");
    this.resonance.setParam(s);
  }
  dispose() {
    return super.dispose(), this.input.dispose(), this.output.dispose(), this.delayTime.dispose(), this.resonance.dispose(), this;
  }
}
class sr extends B {
  constructor() {
    const t = P(sr.getDefaults(), arguments, ["frequency", "type"]);
    super(t), this.name = "OnePoleFilter", this._frequency = t.frequency, this._type = t.type, this.input = new nt({ context: this.context }), this.output = new nt({ context: this.context }), this._createFilter();
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      frequency: 880,
      type: "lowpass"
    });
  }
  /**
   * Create a filter and dispose the old one
   */
  _createFilter() {
    const t = this._filter, n = this.toFrequency(this._frequency), s = 1 / (2 * Math.PI * n);
    if (this._type === "lowpass") {
      const i = 1 / (s * this.context.sampleRate), r = i - 1;
      this._filter = this.context.createIIRFilter([i, 0], [1, r]);
    } else {
      const i = 1 / (s * this.context.sampleRate) - 1;
      this._filter = this.context.createIIRFilter([1, -1], [1, i]);
    }
    this.input.chain(this._filter, this.output), t && this.context.setTimeout(() => {
      this.disposed || (this.input.disconnect(t), t.disconnect());
    }, this.blockTime);
  }
  /**
   * The frequency value.
   */
  get frequency() {
    return this._frequency;
  }
  set frequency(t) {
    this._frequency = t, this._createFilter();
  }
  /**
   * The OnePole Filter type, either "highpass" or "lowpass"
   */
  get type() {
    return this._type;
  }
  set type(t) {
    this._type = t, this._createFilter();
  }
  /**
   * Get the frequency response curve. This curve represents how the filter
   * responses to frequencies between 20hz-20khz.
   * @param  len The number of values to return
   * @return The frequency response curve between 20-20kHz
   */
  getFrequencyResponse(t = 128) {
    const n = new Float32Array(t);
    for (let r = 0; r < t; r++) {
      const a = Math.pow(r / t, 2) * 19980 + 20;
      n[r] = a;
    }
    const s = new Float32Array(t), i = new Float32Array(t);
    return this._filter.getFrequencyResponse(n, s, i), s;
  }
  dispose() {
    return super.dispose(), this.input.dispose(), this.output.dispose(), this._filter.disconnect(), this;
  }
}
class ir extends B {
  constructor() {
    const t = P(ir.getDefaults(), arguments, ["delayTime", "resonance", "dampening"]);
    super(t), this.name = "LowpassCombFilter", this._combFilter = this.output = new nr({
      context: this.context,
      delayTime: t.delayTime,
      resonance: t.resonance
    }), this.delayTime = this._combFilter.delayTime, this.resonance = this._combFilter.resonance, this._lowpass = this.input = new sr({
      context: this.context,
      frequency: t.dampening,
      type: "lowpass"
    }), this._lowpass.connect(this._combFilter);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      dampening: 3e3,
      delayTime: 0.1,
      resonance: 0.5
    });
  }
  /**
   * The dampening control of the feedback
   */
  get dampening() {
    return this._lowpass.frequency;
  }
  set dampening(t) {
    this._lowpass.frequency = t;
  }
  dispose() {
    return super.dispose(), this._combFilter.dispose(), this._lowpass.dispose(), this;
  }
}
class ol extends tn {
  constructor() {
    const t = P(ol.getDefaults(), arguments);
    super(t), this.name = "PluckSynth", this._noise = new Hn({
      context: this.context,
      type: "pink"
    }), this.attackNoise = t.attackNoise, this._lfcf = new ir({
      context: this.context,
      dampening: t.dampening,
      resonance: t.resonance
    }), this.resonance = t.resonance, this.release = t.release, this._noise.connect(this._lfcf), this._lfcf.connect(this.output);
  }
  static getDefaults() {
    return Qe(tn.getDefaults(), {
      attackNoise: 1,
      dampening: 4e3,
      resonance: 0.7,
      release: 1
    });
  }
  /**
   * The dampening control. i.e. the lowpass filter frequency of the comb filter
   * @min 0
   * @max 7000
   */
  get dampening() {
    return this._lfcf.dampening;
  }
  set dampening(t) {
    this._lfcf.dampening = t;
  }
  triggerAttack(t, n) {
    const s = this.toFrequency(t);
    n = this.toSeconds(n);
    const i = 1 / s;
    return this._lfcf.delayTime.setValueAtTime(i, n), this._noise.start(n), this._noise.stop(n + i * this.attackNoise), this._lfcf.resonance.cancelScheduledValues(n), this._lfcf.resonance.setValueAtTime(this.resonance, n), this;
  }
  /**
   * Ramp down the {@link resonance} to 0 over the duration of the release time.
   */
  triggerRelease(t) {
    return this._lfcf.resonance.linearRampTo(0, this.release, t), this;
  }
  dispose() {
    return super.dispose(), this._noise.dispose(), this._lfcf.dispose(), this;
  }
}
class al extends tn {
  constructor() {
    const t = P(al.getDefaults(), arguments, ["voice", "options"]);
    super(t), this.name = "PolySynth", this._availableVoices = [], this._activeVoices = [], this._voices = [], this._gcTimeout = -1, this._averageActiveVoices = 0, this._syncedRelease = (i) => this.releaseAll(i), st(!ze(t.voice), "DEPRECATED: The polyphony count is no longer the first argument.");
    const n = t.voice.getDefaults();
    this.options = Object.assign(n, t.options), this.voice = t.voice, this.maxPolyphony = t.maxPolyphony, this._dummyVoice = this._getNextAvailableVoice();
    const s = this._voices.indexOf(this._dummyVoice);
    this._voices.splice(s, 1), this._gcTimeout = this.context.setInterval(this._collectGarbage.bind(this), 1);
  }
  static getDefaults() {
    return Object.assign(tn.getDefaults(), {
      maxPolyphony: 32,
      options: {},
      voice: Kn
    });
  }
  /**
   * The number of active voices.
   */
  get activeVoices() {
    return this._activeVoices.length;
  }
  /**
   * Invoked when the source is done making sound, so that it can be
   * readded to the pool of available voices
   */
  _makeVoiceAvailable(t) {
    this._availableVoices.push(t);
    const n = this._activeVoices.findIndex((s) => s.voice === t);
    this._activeVoices.splice(n, 1);
  }
  /**
   * Get an available voice from the pool of available voices.
   * If one is not available and the maxPolyphony limit is reached,
   * steal a voice, otherwise return null.
   */
  _getNextAvailableVoice() {
    if (this._availableVoices.length)
      return this._availableVoices.shift();
    if (this._voices.length < this.maxPolyphony) {
      const t = new this.voice(Object.assign(this.options, {
        context: this.context,
        onsilence: this._makeVoiceAvailable.bind(this)
      }));
      return st(t instanceof ge, "Voice must extend Monophonic class"), t.connect(this.output), this._voices.push(t), t;
    } else
      ti("Max polyphony exceeded. Note dropped.");
  }
  /**
   * Occasionally check if there are any allocated voices which can be cleaned up.
   */
  _collectGarbage() {
    if (this._averageActiveVoices = Math.max(this._averageActiveVoices * 0.95, this.activeVoices), this._availableVoices.length && this._voices.length > Math.ceil(this._averageActiveVoices + 1)) {
      const t = this._availableVoices.shift(), n = this._voices.indexOf(t);
      this._voices.splice(n, 1), this.context.isOffline || t.dispose();
    }
  }
  /**
   * Internal method which triggers the attack
   */
  _triggerAttack(t, n, s) {
    t.forEach((i) => {
      const r = new Zs(this.context, i).toMidi(), o = this._getNextAvailableVoice();
      o && (o.triggerAttack(i, n, s), this._activeVoices.push({
        midi: r,
        voice: o,
        released: !1
      }), this.log("triggerAttack", i, n));
    });
  }
  /**
   * Internal method which triggers the release
   */
  _triggerRelease(t, n) {
    t.forEach((s) => {
      const i = new Zs(this.context, s).toMidi(), r = this._activeVoices.find(({ midi: o, released: a }) => o === i && !a);
      r && (r.voice.triggerRelease(n), r.released = !0, this.log("triggerRelease", s, n));
    });
  }
  /**
   * Schedule the attack/release events. If the time is in the future, then it should set a timeout
   * to wait for just-in-time scheduling
   */
  _scheduleEvent(t, n, s, i) {
    st(!this.disposed, "Synth was already disposed"), s <= this.now() ? t === "attack" ? this._triggerAttack(n, s, i) : this._triggerRelease(n, s) : this.context.setTimeout(() => {
      this.disposed || this._scheduleEvent(t, n, s, i);
    }, s - this.now());
  }
  /**
   * Trigger the attack portion of the note
   * @param  notes The notes to play. Accepts a single Frequency or an array of frequencies.
   * @param  time  The start time of the note.
   * @param velocity The velocity of the note.
   * @example
   * const synth = new Tone.PolySynth(Tone.FMSynth).toDestination();
   * // trigger a chord immediately with a velocity of 0.2
   * synth.triggerAttack(["Ab3", "C4", "F5"], Tone.now(), 0.2);
   */
  triggerAttack(t, n, s) {
    Array.isArray(t) || (t = [t]);
    const i = this.toSeconds(n);
    return this._scheduleEvent("attack", t, i, s), this;
  }
  /**
   * Trigger the release of the note. Unlike monophonic instruments,
   * a note (or array of notes) needs to be passed in as the first argument.
   * @param  notes The notes to play. Accepts a single Frequency or an array of frequencies.
   * @param  time  When the release will be triggered.
   * @example
   * const poly = new Tone.PolySynth(Tone.AMSynth).toDestination();
   * poly.triggerAttack(["Ab3", "C4", "F5"]);
   * // trigger the release of the given notes.
   * poly.triggerRelease(["Ab3", "C4"], "+1");
   * poly.triggerRelease("F5", "+3");
   */
  triggerRelease(t, n) {
    Array.isArray(t) || (t = [t]);
    const s = this.toSeconds(n);
    return this._scheduleEvent("release", t, s), this;
  }
  /**
   * Trigger the attack and release after the specified duration
   * @param  notes The notes to play. Accepts a single  Frequency or an array of frequencies.
   * @param  duration the duration of the note
   * @param  time  if no time is given, defaults to now
   * @param  velocity the velocity of the attack (0-1)
   * @example
   * const poly = new Tone.PolySynth(Tone.AMSynth).toDestination();
   * // can pass in an array of durations as well
   * poly.triggerAttackRelease(["Eb3", "G4", "Bb4", "D5"], [4, 3, 2, 1]);
   */
  triggerAttackRelease(t, n, s, i) {
    const r = this.toSeconds(s);
    if (this.triggerAttack(t, r, i), _e(n)) {
      st(_e(t), "If the duration is an array, the notes must also be an array"), t = t;
      for (let o = 0; o < t.length; o++) {
        const a = n[Math.min(o, n.length - 1)], c = this.toSeconds(a);
        st(c > 0, "The duration must be greater than 0"), this.triggerRelease(t[o], r + c);
      }
    } else {
      const o = this.toSeconds(n);
      st(o > 0, "The duration must be greater than 0"), this.triggerRelease(t, r + o);
    }
    return this;
  }
  sync() {
    return this._syncState() && (this._syncMethod("triggerAttack", 1), this._syncMethod("triggerRelease", 1), this.context.transport.on("stop", this._syncedRelease), this.context.transport.on("pause", this._syncedRelease), this.context.transport.on("loopEnd", this._syncedRelease)), this;
  }
  /**
   * Set a member/attribute of the voices
   * @example
   * const poly = new Tone.PolySynth().toDestination();
   * // set all of the voices using an options object for the synth type
   * poly.set({
   * 	envelope: {
   * 		attack: 0.25
   * 	}
   * });
   * poly.triggerAttackRelease("Bb3", 0.2);
   */
  set(t) {
    const n = me(t, [
      "onsilence",
      "context"
    ]);
    return this.options = Qe(this.options, n), this._voices.forEach((s) => s.set(n)), this._dummyVoice.set(n), this;
  }
  get() {
    return this._dummyVoice.get();
  }
  /**
   * Trigger the release portion of all the currently active voices immediately.
   * Useful for silencing the synth.
   */
  releaseAll(t) {
    const n = this.toSeconds(t);
    return this._activeVoices.forEach(({ voice: s }) => {
      s.triggerRelease(n);
    }), this;
  }
  dispose() {
    return super.dispose(), this._dummyVoice.dispose(), this._voices.forEach((t) => t.dispose()), this._activeVoices = [], this._availableVoices = [], this.context.clearInterval(this._gcTimeout), this;
  }
}
class rr extends tn {
  constructor() {
    const t = P(rr.getDefaults(), arguments, ["urls", "onload", "baseUrl"], "urls");
    super(t), this.name = "Sampler", this._activeSources = /* @__PURE__ */ new Map();
    const n = {};
    Object.keys(t.urls).forEach((s) => {
      const i = parseInt(s, 10);
      if (st(Ti(s) || ze(i) && isFinite(i), `url key is neither a note or midi pitch: ${s}`), Ti(s)) {
        const r = new Oe(this.context, s).toMidi();
        n[r] = t.urls[s];
      } else ze(i) && isFinite(i) && (n[i] = t.urls[i]);
    }), this._buffers = new oi({
      urls: n,
      onload: t.onload,
      baseUrl: t.baseUrl,
      onerror: t.onerror
    }), this.attack = t.attack, this.release = t.release, this.curve = t.curve, this._buffers.loaded && Promise.resolve().then(t.onload);
  }
  static getDefaults() {
    return Object.assign(tn.getDefaults(), {
      attack: 0,
      baseUrl: "",
      curve: "exponential",
      onload: St,
      onerror: St,
      release: 0.1,
      urls: {}
    });
  }
  /**
   * Returns the difference in steps between the given midi note at the closets sample.
   */
  _findClosest(t) {
    let s = 0;
    for (; s < 96; ) {
      if (this._buffers.has(t + s))
        return -s;
      if (this._buffers.has(t - s))
        return s;
      s++;
    }
    throw new Error(`No available buffers for note: ${t}`);
  }
  /**
   * @param  notes	The note to play, or an array of notes.
   * @param  time     When to play the note
   * @param  velocity The velocity to play the sample back.
   */
  triggerAttack(t, n, s = 1) {
    return this.log("triggerAttack", t, n, s), Array.isArray(t) || (t = [t]), t.forEach((i) => {
      const r = Zd(new Oe(this.context, i).toFrequency()), o = Math.round(r), a = r - o, c = this._findClosest(o), l = o - c, u = this._buffers.get(l), h = zs(c + a), d = new is({
        url: u,
        context: this.context,
        curve: this.curve,
        fadeIn: this.attack,
        fadeOut: this.release,
        playbackRate: h
      }).connect(this.output);
      d.start(n, 0, u.duration / h, s), _e(this._activeSources.get(o)) || this._activeSources.set(o, []), this._activeSources.get(o).push(d), d.onended = () => {
        if (this._activeSources && this._activeSources.has(o)) {
          const p = this._activeSources.get(o), f = p.indexOf(d);
          f !== -1 && p.splice(f, 1);
        }
      };
    }), this;
  }
  /**
   * @param  notes	The note to release, or an array of notes.
   * @param  time     	When to release the note.
   */
  triggerRelease(t, n) {
    return this.log("triggerRelease", t, n), Array.isArray(t) || (t = [t]), t.forEach((s) => {
      const i = new Oe(this.context, s).toMidi();
      if (this._activeSources.has(i) && this._activeSources.get(i).length) {
        const r = this._activeSources.get(i);
        n = this.toSeconds(n), r.forEach((o) => {
          o.stop(n);
        }), this._activeSources.set(i, []);
      }
    }), this;
  }
  /**
   * Release all currently active notes.
   * @param  time     	When to release the notes.
   */
  releaseAll(t) {
    const n = this.toSeconds(t);
    return this._activeSources.forEach((s) => {
      for (; s.length; )
        s.shift().stop(n);
    }), this;
  }
  sync() {
    return this._syncState() && (this._syncMethod("triggerAttack", 1), this._syncMethod("triggerRelease", 1)), this;
  }
  /**
   * Invoke the attack phase, then after the duration, invoke the release.
   * @param  notes	The note to play and release, or an array of notes.
   * @param  duration The time the note should be held
   * @param  time     When to start the attack
   * @param  velocity The velocity of the attack
   */
  triggerAttackRelease(t, n, s, i = 1) {
    const r = this.toSeconds(s);
    return this.triggerAttack(t, r, i), _e(n) ? (st(_e(t), "notes must be an array when duration is array"), t.forEach((o, a) => {
      const c = n[Math.min(a, n.length - 1)];
      this.triggerRelease(o, r + this.toSeconds(c));
    })) : this.triggerRelease(t, r + this.toSeconds(n)), this;
  }
  /**
   * Add a note to the sampler.
   * @param  note      The buffer's pitch.
   * @param  url  Either the url of the buffer, or a buffer which will be added with the given name.
   * @param  callback  The callback to invoke when the url is loaded.
   */
  add(t, n, s) {
    if (st(Ti(t) || isFinite(t), `note must be a pitch or midi: ${t}`), Ti(t)) {
      const i = new Oe(this.context, t).toMidi();
      this._buffers.add(i, n, s);
    } else
      this._buffers.add(t, n, s);
    return this;
  }
  /**
   * If the buffers are loaded or not
   */
  get loaded() {
    return this._buffers.loaded;
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this._buffers.dispose(), this._activeSources.forEach((t) => {
      t.forEach((n) => n.dispose());
    }), this._activeSources.clear(), this;
  }
}
ln([
  Vn(0)
], rr.prototype, "attack", void 0);
ln([
  Vn(0)
], rr.prototype, "release", void 0);
class mn extends he {
  constructor() {
    const t = P(mn.getDefaults(), arguments, ["callback", "value"]);
    super(t), this.name = "ToneEvent", this._state = new ii("stopped"), this._startOffset = 0, this._loop = t.loop, this.callback = t.callback, this.value = t.value, this._loopStart = this.toTicks(t.loopStart), this._loopEnd = this.toTicks(t.loopEnd), this._playbackRate = t.playbackRate, this._probability = t.probability, this._humanize = t.humanize, this.mute = t.mute, this._playbackRate = t.playbackRate, this._state.increasing = !0, this._rescheduleEvents();
  }
  static getDefaults() {
    return Object.assign(he.getDefaults(), {
      callback: St,
      humanize: !1,
      loop: !1,
      loopEnd: "1m",
      loopStart: 0,
      mute: !1,
      playbackRate: 1,
      probability: 1,
      value: null
    });
  }
  /**
   * Reschedule all of the events along the timeline
   * with the updated values.
   * @param after Only reschedules events after the given time.
   */
  _rescheduleEvents(t = -1) {
    this._state.forEachFrom(t, (n) => {
      let s;
      if (n.state === "started") {
        n.id !== -1 && this.context.transport.clear(n.id);
        const i = n.time + Math.round(this.startOffset / this._playbackRate);
        if (this._loop === !0 || ze(this._loop) && this._loop > 1) {
          s = 1 / 0, ze(this._loop) && (s = this._loop * this._getLoopDuration());
          const r = this._state.getAfter(i);
          r !== null && (s = Math.min(s, r.time - i)), s !== 1 / 0 && (s = new Yt(this.context, s));
          const o = new Yt(this.context, this._getLoopDuration());
          n.id = this.context.transport.scheduleRepeat(this._tick.bind(this), o, new Yt(this.context, i), s);
        } else
          n.id = this.context.transport.schedule(this._tick.bind(this), new Yt(this.context, i));
      }
    });
  }
  /**
   * Returns the playback state of the note, either "started" or "stopped".
   */
  get state() {
    return this._state.getValueAtTime(this.context.transport.ticks);
  }
  /**
   * The start from the scheduled start time.
   */
  get startOffset() {
    return this._startOffset;
  }
  set startOffset(t) {
    this._startOffset = t;
  }
  /**
   * The probability of the notes being triggered.
   */
  get probability() {
    return this._probability;
  }
  set probability(t) {
    this._probability = t;
  }
  /**
   * If set to true, will apply small random variation
   * to the callback time. If the value is given as a time, it will randomize
   * by that amount.
   * @example
   * const event = new Tone.ToneEvent();
   * event.humanize = true;
   */
  get humanize() {
    return this._humanize;
  }
  set humanize(t) {
    this._humanize = t;
  }
  /**
   * Start the note at the given time.
   * @param  time  When the event should start.
   */
  start(t) {
    const n = this.toTicks(t);
    return this._state.getValueAtTime(n) === "stopped" && (this._state.add({
      id: -1,
      state: "started",
      time: n
    }), this._rescheduleEvents(n)), this;
  }
  /**
   * Stop the Event at the given time.
   * @param  time  When the event should stop.
   */
  stop(t) {
    this.cancel(t);
    const n = this.toTicks(t);
    if (this._state.getValueAtTime(n) === "started") {
      this._state.setStateAtTime("stopped", n, { id: -1 });
      const s = this._state.getBefore(n);
      let i = n;
      s !== null && (i = s.time), this._rescheduleEvents(i);
    }
    return this;
  }
  /**
   * Cancel all scheduled events greater than or equal to the given time
   * @param  time  The time after which events will be cancel.
   */
  cancel(t) {
    t = Je(t, -1 / 0);
    const n = this.toTicks(t);
    return this._state.forEachFrom(n, (s) => {
      this.context.transport.clear(s.id);
    }), this._state.cancel(n), this;
  }
  /**
   * The callback function invoker. Also
   * checks if the Event is done playing
   * @param  time  The time of the event in seconds
   */
  _tick(t) {
    const n = this.context.transport.getTicksAtTime(t);
    if (!this.mute && this._state.getValueAtTime(n) === "started") {
      if (this.probability < 1 && Math.random() > this.probability)
        return;
      if (this.humanize) {
        let s = 0.02;
        Nc(this.humanize) || (s = this.toSeconds(this.humanize)), t += (Math.random() * 2 - 1) * s;
      }
      this.callback(t, this.value);
    }
  }
  /**
   * Get the duration of the loop.
   */
  _getLoopDuration() {
    return (this._loopEnd - this._loopStart) / this._playbackRate;
  }
  /**
   * If the note should loop or not
   * between ToneEvent.loopStart and
   * ToneEvent.loopEnd. If set to true,
   * the event will loop indefinitely,
   * if set to a number greater than 1
   * it will play a specific number of
   * times, if set to false, 0 or 1, the
   * part will only play once.
   */
  get loop() {
    return this._loop;
  }
  set loop(t) {
    this._loop = t, this._rescheduleEvents();
  }
  /**
   * The playback rate of the event. Defaults to 1.
   * @example
   * const note = new Tone.ToneEvent();
   * note.loop = true;
   * // repeat the note twice as fast
   * note.playbackRate = 2;
   */
  get playbackRate() {
    return this._playbackRate;
  }
  set playbackRate(t) {
    this._playbackRate = t, this._rescheduleEvents();
  }
  /**
   * The loopEnd point is the time the event will loop
   * if ToneEvent.loop is true.
   */
  get loopEnd() {
    return new Yt(this.context, this._loopEnd).toSeconds();
  }
  set loopEnd(t) {
    this._loopEnd = this.toTicks(t), this._loop && this._rescheduleEvents();
  }
  /**
   * The time when the loop should start.
   */
  get loopStart() {
    return new Yt(this.context, this._loopStart).toSeconds();
  }
  set loopStart(t) {
    this._loopStart = this.toTicks(t), this._loop && this._rescheduleEvents();
  }
  /**
   * The current progress of the loop interval.
   * Returns 0 if the event is not started yet or
   * it is not set to loop.
   */
  get progress() {
    if (this._loop) {
      const t = this.context.transport.ticks, n = this._state.get(t);
      if (n !== null && n.state === "started") {
        const s = this._getLoopDuration();
        return (t - n.time) % s / s;
      } else
        return 0;
    } else
      return 0;
  }
  dispose() {
    return super.dispose(), this.cancel(), this._state.dispose(), this;
  }
}
class Vi extends he {
  constructor() {
    const t = P(Vi.getDefaults(), arguments, [
      "callback",
      "interval"
    ]);
    super(t), this.name = "Loop", this._event = new mn({
      context: this.context,
      callback: this._tick.bind(this),
      loop: !0,
      loopEnd: t.interval,
      playbackRate: t.playbackRate,
      probability: t.probability,
      humanize: t.humanize
    }), this.callback = t.callback, this.iterations = t.iterations;
  }
  static getDefaults() {
    return Object.assign(he.getDefaults(), {
      interval: "4n",
      callback: St,
      playbackRate: 1,
      iterations: 1 / 0,
      probability: 1,
      mute: !1,
      humanize: !1
    });
  }
  /**
   * Start the loop at the specified time along the Transport's timeline.
   * @param  time  When to start the Loop.
   */
  start(t) {
    return this._event.start(t), this;
  }
  /**
   * Stop the loop at the given time.
   * @param  time  When to stop the Loop.
   */
  stop(t) {
    return this._event.stop(t), this;
  }
  /**
   * Cancel all scheduled events greater than or equal to the given time
   * @param  time  The time after which events will be cancel.
   */
  cancel(t) {
    return this._event.cancel(t), this;
  }
  /**
   * Internal function called when the notes should be called
   * @param time  The time the event occurs
   */
  _tick(t) {
    this.callback(t);
  }
  /**
   * The state of the Loop, either started or stopped.
   */
  get state() {
    return this._event.state;
  }
  /**
   * The progress of the loop as a value between 0-1. 0, when the loop is stopped or done iterating.
   */
  get progress() {
    return this._event.progress;
  }
  /**
   * The time between successive callbacks.
   * @example
   * const loop = new Tone.Loop();
   * loop.interval = "8n"; // loop every 8n
   */
  get interval() {
    return this._event.loopEnd;
  }
  set interval(t) {
    this._event.loopEnd = t;
  }
  /**
   * The playback rate of the loop. The normal playback rate is 1 (no change).
   * A `playbackRate` of 2 would be twice as fast.
   */
  get playbackRate() {
    return this._event.playbackRate;
  }
  set playbackRate(t) {
    this._event.playbackRate = t;
  }
  /**
   * Random variation +/-0.01s to the scheduled time.
   * Or give it a time value which it will randomize by.
   */
  get humanize() {
    return this._event.humanize;
  }
  set humanize(t) {
    this._event.humanize = t;
  }
  /**
   * The probably of the callback being invoked.
   */
  get probability() {
    return this._event.probability;
  }
  set probability(t) {
    this._event.probability = t;
  }
  /**
   * Muting the Loop means that no callbacks are invoked.
   */
  get mute() {
    return this._event.mute;
  }
  set mute(t) {
    this._event.mute = t;
  }
  /**
   * The number of iterations of the loop. The default value is `Infinity` (loop forever).
   */
  get iterations() {
    return this._event.loop === !0 ? 1 / 0 : this._event.loop;
  }
  set iterations(t) {
    t === 1 / 0 ? this._event.loop = !0 : this._event.loop = t;
  }
  dispose() {
    return super.dispose(), this._event.dispose(), this;
  }
}
class Wi extends mn {
  constructor() {
    const t = P(Wi.getDefaults(), arguments, [
      "callback",
      "events"
    ]);
    super(t), this.name = "Part", this._state = new ii("stopped"), this._events = /* @__PURE__ */ new Set(), this._state.increasing = !0, t.events.forEach((n) => {
      _e(n) ? this.add(n[0], n[1]) : this.add(n);
    });
  }
  static getDefaults() {
    return Object.assign(mn.getDefaults(), {
      events: []
    });
  }
  /**
   * Start the part at the given time.
   * @param  time    When to start the part.
   * @param  offset  The offset from the start of the part to begin playing at.
   */
  start(t, n) {
    const s = this.toTicks(t);
    if (this._state.getValueAtTime(s) !== "started") {
      n = Je(n, this._loop ? this._loopStart : 0), this._loop ? n = Je(n, this._loopStart) : n = Je(n, 0);
      const i = this.toTicks(n);
      this._state.add({
        id: -1,
        offset: i,
        state: "started",
        time: s
      }), this._forEach((r) => {
        this._startNote(r, s, i);
      });
    }
    return this;
  }
  /**
   * Start the event in the given event at the correct time given
   * the ticks and offset and looping.
   * @param  event
   * @param  ticks
   * @param  offset
   */
  _startNote(t, n, s) {
    n -= s, this._loop ? t.startOffset >= this._loopStart && t.startOffset < this._loopEnd ? (t.startOffset < s && (n += this._getLoopDuration()), t.start(new Yt(this.context, n))) : t.startOffset < this._loopStart && t.startOffset >= s && (t.loop = !1, t.start(new Yt(this.context, n))) : t.startOffset >= s && t.start(new Yt(this.context, n));
  }
  get startOffset() {
    return this._startOffset;
  }
  set startOffset(t) {
    this._startOffset = t, this._forEach((n) => {
      n.startOffset += this._startOffset;
    });
  }
  /**
   * Stop the part at the given time.
   * @param  time  When to stop the part.
   */
  stop(t) {
    const n = this.toTicks(t);
    return this._state.cancel(n), this._state.setStateAtTime("stopped", n), this._forEach((s) => {
      s.stop(t);
    }), this;
  }
  /**
   * Get/Set an Event's value at the given time.
   * If a value is passed in and no event exists at
   * the given time, one will be created with that value.
   * If two events are at the same time, the first one will
   * be returned.
   * @example
   * const part = new Tone.Part();
   * part.at("1m"); // returns the part at the first measure
   * part.at("2m", "C2"); // set the value at "2m" to C2.
   * // if an event didn't exist at that time, it will be created.
   * @param time The time of the event to get or set.
   * @param value If a value is passed in, the value of the event at the given time will be set to it.
   */
  at(t, n) {
    const s = new re(this.context, t).toTicks(), i = new Yt(this.context, 1).toSeconds(), r = this._events.values();
    let o = r.next();
    for (; !o.done; ) {
      const a = o.value;
      if (Math.abs(s - a.startOffset) < i)
        return bt(n) && (a.value = n), a;
      o = r.next();
    }
    return bt(n) ? (this.add(t, n), this.at(t)) : null;
  }
  add(t, n) {
    t instanceof Object && Reflect.has(t, "time") && (n = t, t = n.time);
    const s = this.toTicks(t);
    let i;
    return n instanceof mn ? (i = n, i.callback = this._tick.bind(this)) : i = new mn({
      callback: this._tick.bind(this),
      context: this.context,
      value: n
    }), i.startOffset = s, i.set({
      humanize: this.humanize,
      loop: this.loop,
      loopEnd: this.loopEnd,
      loopStart: this.loopStart,
      playbackRate: this.playbackRate,
      probability: this.probability
    }), this._events.add(i), this._restartEvent(i), this;
  }
  /**
   * Restart the given event
   */
  _restartEvent(t) {
    this._state.forEach((n) => {
      n.state === "started" ? this._startNote(t, n.time, n.offset) : t.stop(new Yt(this.context, n.time));
    });
  }
  remove(t, n) {
    return Dn(t) && t.hasOwnProperty("time") && (n = t, t = n.time), t = this.toTicks(t), this._events.forEach((s) => {
      s.startOffset === t && (We(n) || bt(n) && s.value === n) && (this._events.delete(s), s.dispose());
    }), this;
  }
  /**
   * Remove all of the notes from the group.
   */
  clear() {
    return this._forEach((t) => t.dispose()), this._events.clear(), this;
  }
  /**
   * Cancel scheduled state change events: i.e. "start" and "stop".
   * @param after The time after which to cancel the scheduled events.
   */
  cancel(t) {
    return this._forEach((n) => n.cancel(t)), this._state.cancel(this.toTicks(t)), this;
  }
  /**
   * Iterate over all of the events
   */
  _forEach(t) {
    return this._events && this._events.forEach((n) => {
      n instanceof Wi ? n._forEach(t) : t(n);
    }), this;
  }
  /**
   * Set the attribute of all of the events
   * @param  attr  the attribute to set
   * @param  value      The value to set it to
   */
  _setAll(t, n) {
    this._forEach((s) => {
      s[t] = n;
    });
  }
  /**
   * Internal tick method
   * @param  time  The time of the event in seconds
   */
  _tick(t, n) {
    this.mute || this.callback(t, n);
  }
  /**
   * Determine if the event should be currently looping
   * given the loop boundries of this Part.
   * @param  event  The event to test
   */
  _testLoopBoundries(t) {
    this._loop && (t.startOffset < this._loopStart || t.startOffset >= this._loopEnd) ? t.cancel(0) : t.state === "stopped" && this._restartEvent(t);
  }
  get probability() {
    return this._probability;
  }
  set probability(t) {
    this._probability = t, this._setAll("probability", t);
  }
  get humanize() {
    return this._humanize;
  }
  set humanize(t) {
    this._humanize = t, this._setAll("humanize", t);
  }
  /**
   * If the part should loop or not
   * between Part.loopStart and
   * Part.loopEnd. If set to true,
   * the part will loop indefinitely,
   * if set to a number greater than 1
   * it will play a specific number of
   * times, if set to false, 0 or 1, the
   * part will only play once.
   * @example
   * const part = new Tone.Part();
   * // loop the part 8 times
   * part.loop = 8;
   */
  get loop() {
    return this._loop;
  }
  set loop(t) {
    this._loop = t, this._forEach((n) => {
      n.loopStart = this.loopStart, n.loopEnd = this.loopEnd, n.loop = t, this._testLoopBoundries(n);
    });
  }
  /**
   * The loopEnd point determines when it will
   * loop if Part.loop is true.
   */
  get loopEnd() {
    return new Yt(this.context, this._loopEnd).toSeconds();
  }
  set loopEnd(t) {
    this._loopEnd = this.toTicks(t), this._loop && this._forEach((n) => {
      n.loopEnd = t, this._testLoopBoundries(n);
    });
  }
  /**
   * The loopStart point determines when it will
   * loop if Part.loop is true.
   */
  get loopStart() {
    return new Yt(this.context, this._loopStart).toSeconds();
  }
  set loopStart(t) {
    this._loopStart = this.toTicks(t), this._loop && this._forEach((n) => {
      n.loopStart = this.loopStart, this._testLoopBoundries(n);
    });
  }
  /**
   * The playback rate of the part
   */
  get playbackRate() {
    return this._playbackRate;
  }
  set playbackRate(t) {
    this._playbackRate = t, this._setAll("playbackRate", t);
  }
  /**
   * The number of scheduled notes in the part.
   */
  get length() {
    return this._events.size;
  }
  dispose() {
    return super.dispose(), this.clear(), this;
  }
}
function* Y0(e) {
  let t = 0;
  for (; t < e; )
    t = xs(t, 0, e - 1), yield t, t++;
}
function* X0(e) {
  let t = e - 1;
  for (; t >= 0; )
    t = xs(t, 0, e - 1), yield t, t--;
}
function* wi(e, t) {
  for (; ; )
    yield* t(e);
}
function* du(e, t) {
  let n = t ? 0 : e - 1;
  for (; ; )
    n = xs(n, 0, e - 1), yield n, t ? (n++, n >= e - 1 && (t = !1)) : (n--, n <= 0 && (t = !0));
}
function* U0(e) {
  let t = 0, n = 0;
  for (; t < e; )
    t = xs(t, 0, e - 1), yield t, n++, t += n % 2 ? 2 : -1;
}
function* H0(e) {
  let t = e - 1, n = 0;
  for (; t >= 0; )
    t = xs(t, 0, e - 1), yield t, n++, t += n % 2 ? -2 : 1;
}
function* K0(e) {
  for (; ; )
    yield Math.floor(Math.random() * e);
}
function* Q0(e) {
  const t = [];
  for (let n = 0; n < e; n++)
    t.push(n);
  for (; t.length > 0; ) {
    const n = t.splice(Math.floor(t.length * Math.random()), 1);
    yield xs(n[0], 0, e - 1);
  }
}
function* J0(e) {
  let t = Math.floor(Math.random() * e);
  for (; ; )
    t === 0 ? t++ : t === e - 1 || Math.random() < 0.5 ? t-- : t++, yield t;
}
function* fu(e, t = "up", n = 0) {
  switch (st(e >= 1, "The number of values must be at least one"), t) {
    case "up":
      yield* wi(e, Y0);
    case "down":
      yield* wi(e, X0);
    case "upDown":
      yield* du(e, !0);
    case "downUp":
      yield* du(e, !1);
    case "alternateUp":
      yield* wi(e, U0);
    case "alternateDown":
      yield* wi(e, H0);
    case "random":
      yield* K0(e);
    case "randomOnce":
      yield* wi(e, Q0);
    case "randomWalk":
      yield* J0(e);
  }
}
class cl extends Vi {
  constructor() {
    const t = P(cl.getDefaults(), arguments, [
      "callback",
      "values",
      "pattern"
    ]);
    super(t), this.name = "Pattern", this.callback = t.callback, this._values = t.values, this._pattern = fu(t.values.length, t.pattern), this._type = t.pattern;
  }
  static getDefaults() {
    return Object.assign(Vi.getDefaults(), {
      pattern: "up",
      values: [],
      callback: St
    });
  }
  /**
   * Internal function called when the notes should be called
   */
  _tick(t) {
    const n = this._pattern.next();
    this._index = n.value, this._value = this._values[n.value], this.callback(t, this._value);
  }
  /**
   * The array of events.
   */
  get values() {
    return this._values;
  }
  set values(t) {
    this._values = t, this.pattern = this._type;
  }
  /**
   * The current value of the pattern.
   */
  get value() {
    return this._value;
  }
  /**
   * The current index of the pattern.
   */
  get index() {
    return this._index;
  }
  /**
   * The pattern type.
   */
  get pattern() {
    return this._type;
  }
  set pattern(t) {
    this._type = t, this._pattern = fu(this._values.length, this._type);
  }
}
class ll extends mn {
  constructor() {
    const t = P(ll.getDefaults(), arguments, ["callback", "events", "subdivision"]);
    super(t), this.name = "Sequence", this._part = new Wi({
      callback: this._seqCallback.bind(this),
      context: this.context
    }), this._events = [], this._eventsArray = [], this._subdivision = this.toTicks(t.subdivision), this.events = t.events, this.loop = t.loop, this.loopStart = t.loopStart, this.loopEnd = t.loopEnd, this.playbackRate = t.playbackRate, this.probability = t.probability, this.humanize = t.humanize, this.mute = t.mute, this.playbackRate = t.playbackRate;
  }
  static getDefaults() {
    return Object.assign(me(mn.getDefaults(), ["value"]), {
      events: [],
      loop: !0,
      loopEnd: 0,
      loopStart: 0,
      subdivision: "8n"
    });
  }
  /**
   * The internal callback for when an event is invoked
   */
  _seqCallback(t, n) {
    n !== null && !this.mute && this.callback(t, n);
  }
  /**
   * The sequence
   */
  get events() {
    return this._events;
  }
  set events(t) {
    this.clear(), this._eventsArray = t, this._events = this._createSequence(this._eventsArray), this._eventsUpdated();
  }
  /**
   * Start the part at the given time.
   * @param  time    When to start the part.
   * @param  offset  The offset index to start at
   */
  start(t, n) {
    return this._part.start(t, n && this._indexTime(n)), this;
  }
  /**
   * Stop the part at the given time.
   * @param  time  When to stop the part.
   */
  stop(t) {
    return this._part.stop(t), this;
  }
  /**
   * The subdivision of the sequence. This can only be
   * set in the constructor. The subdivision is the
   * interval between successive steps.
   */
  get subdivision() {
    return new Yt(this.context, this._subdivision).toSeconds();
  }
  /**
   * Create a sequence proxy which can be monitored to create subsequences
   */
  _createSequence(t) {
    return new Proxy(t, {
      get: (n, s) => n[s],
      set: (n, s, i) => (an(s) && isFinite(parseInt(s, 10)) && _e(i) ? n[s] = this._createSequence(i) : n[s] = i, this._eventsUpdated(), !0)
    });
  }
  /**
   * When the sequence has changed, all of the events need to be recreated
   */
  _eventsUpdated() {
    this._part.clear(), this._rescheduleSequence(this._eventsArray, this._subdivision, this.startOffset), this.loopEnd = this.loopEnd;
  }
  /**
   * reschedule all of the events that need to be rescheduled
   */
  _rescheduleSequence(t, n, s) {
    t.forEach((i, r) => {
      const o = r * n + s;
      if (_e(i))
        this._rescheduleSequence(i, n / i.length, o);
      else {
        const a = new Yt(this.context, o, "i").toSeconds();
        this._part.add(a, i);
      }
    });
  }
  /**
   * Get the time of the index given the Sequence's subdivision
   * @param  index
   * @return The time of that index
   */
  _indexTime(t) {
    return new Yt(this.context, t * this._subdivision + this.startOffset).toSeconds();
  }
  /**
   * Clear all of the events
   */
  clear() {
    return this._part.clear(), this;
  }
  dispose() {
    return super.dispose(), this._part.dispose(), this;
  }
  //-------------------------------------
  // PROXY CALLS
  //-------------------------------------
  get loop() {
    return this._part.loop;
  }
  set loop(t) {
    this._part.loop = t;
  }
  /**
   * The index at which the sequence should start looping
   */
  get loopStart() {
    return this._loopStart;
  }
  set loopStart(t) {
    this._loopStart = t, this._part.loopStart = this._indexTime(t);
  }
  /**
   * The index at which the sequence should end looping
   */
  get loopEnd() {
    return this._loopEnd;
  }
  set loopEnd(t) {
    this._loopEnd = t, t === 0 ? this._part.loopEnd = this._indexTime(this._eventsArray.length) : this._part.loopEnd = this._indexTime(t);
  }
  get startOffset() {
    return this._part.startOffset;
  }
  set startOffset(t) {
    this._part.startOffset = t;
  }
  get playbackRate() {
    return this._part.playbackRate;
  }
  set playbackRate(t) {
    this._part.playbackRate = t;
  }
  get probability() {
    return this._part.probability;
  }
  set probability(t) {
    this._part.probability = t;
  }
  get progress() {
    return this._part.progress;
  }
  get humanize() {
    return this._part.humanize;
  }
  set humanize(t) {
    this._part.humanize = t;
  }
  /**
   * The number of scheduled events
   */
  get length() {
    return this._part.length;
  }
}
class hi extends B {
  constructor() {
    const t = P(hi.getDefaults(), arguments, ["fade"]);
    super(t), this.name = "CrossFade", this._panner = this.context.createStereoPanner(), this._split = this.context.createChannelSplitter(2), this._g2a = new Hd({ context: this.context }), this.a = new nt({
      context: this.context,
      gain: 0
    }), this.b = new nt({
      context: this.context,
      gain: 0
    }), this.output = new nt({ context: this.context }), this._internalChannels = [this.a, this.b], this.fade = new dt({
      context: this.context,
      units: "normalRange",
      value: t.fade
    }), ct(this, "fade"), this.context.getConstant(1).connect(this._panner), this._panner.connect(this._split), this._panner.channelCount = 1, this._panner.channelCountMode = "explicit", Fe(this._split, this.a.gain, 0), Fe(this._split, this.b.gain, 1), this.fade.chain(this._g2a, this._panner.pan), this.a.connect(this.output), this.b.connect(this.output);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      fade: 0.5
    });
  }
  dispose() {
    return super.dispose(), this.a.dispose(), this.b.dispose(), this.output.dispose(), this.fade.dispose(), this._g2a.dispose(), this._panner.disconnect(), this._split.disconnect(), this;
  }
}
class ce extends B {
  constructor(t) {
    super(t), this.name = "Effect", this._dryWet = new hi({ context: this.context }), this.wet = this._dryWet.fade, this.effectSend = new nt({ context: this.context }), this.effectReturn = new nt({ context: this.context }), this.input = new nt({ context: this.context }), this.output = this._dryWet, this.input.fan(this._dryWet.a, this.effectSend), this.effectReturn.connect(this._dryWet.b), this.wet.setValueAtTime(t.wet, 0), this._internalChannels = [this.effectReturn, this.effectSend], ct(this, "wet");
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      wet: 1
    });
  }
  /**
   * chains the effect in between the effectSend and effectReturn
   */
  connectEffect(t) {
    return this._internalChannels.push(t), this.effectSend.chain(t, this.effectReturn), this;
  }
  dispose() {
    return super.dispose(), this._dryWet.dispose(), this.effectSend.dispose(), this.effectReturn.dispose(), this.wet.dispose(), this;
  }
}
class Yr extends ce {
  constructor(t) {
    super(t), this.name = "LFOEffect", this._lfo = new Me({
      context: this.context,
      frequency: t.frequency,
      amplitude: t.depth
    }), this.depth = this._lfo.amplitude, this.frequency = this._lfo.frequency, this.type = t.type, ct(this, ["frequency", "depth"]);
  }
  static getDefaults() {
    return Object.assign(ce.getDefaults(), {
      frequency: 1,
      type: "sine",
      depth: 1
    });
  }
  /**
   * Start the effect.
   */
  start(t) {
    return this._lfo.start(t), this;
  }
  /**
   * Stop the lfo
   */
  stop(t) {
    return this._lfo.stop(t), this;
  }
  /**
   * Sync the filter to the transport.
   * @see {@link LFO.sync}
   */
  sync() {
    return this._lfo.sync(), this;
  }
  /**
   * Unsync the filter from the transport.
   */
  unsync() {
    return this._lfo.unsync(), this;
  }
  /**
   * The type of the LFO's oscillator.
   * @see {@link Oscillator.type}
   * @example
   * const autoFilter = new Tone.AutoFilter().start().toDestination();
   * const noise = new Tone.Noise().start().connect(autoFilter);
   * autoFilter.type = "square";
   */
  get type() {
    return this._lfo.type;
  }
  set type(t) {
    this._lfo.type = t;
  }
  dispose() {
    return super.dispose(), this._lfo.dispose(), this.frequency.dispose(), this.depth.dispose(), this;
  }
}
class xo extends Yr {
  constructor() {
    const t = P(xo.getDefaults(), arguments, ["frequency", "baseFrequency", "octaves"]);
    super(t), this.name = "AutoFilter", this.filter = new Be(Object.assign(t.filter, {
      context: this.context
    })), this.connectEffect(this.filter), this._lfo.connect(this.filter.frequency), this.octaves = t.octaves, this.baseFrequency = t.baseFrequency;
  }
  static getDefaults() {
    return Object.assign(Yr.getDefaults(), {
      baseFrequency: 200,
      octaves: 2.6,
      filter: {
        type: "lowpass",
        rolloff: -12,
        Q: 1
      }
    });
  }
  /**
   * The minimum value of the filter's cutoff frequency.
   */
  get baseFrequency() {
    return this._lfo.min;
  }
  set baseFrequency(t) {
    this._lfo.min = this.toFrequency(t), this.octaves = this._octaves;
  }
  /**
   * The maximum value of the filter's cutoff frequency.
   */
  get octaves() {
    return this._octaves;
  }
  set octaves(t) {
    this._octaves = t, this._lfo.max = this._lfo.min * Math.pow(2, t);
  }
  dispose() {
    return super.dispose(), this.filter.dispose(), this;
  }
}
class di extends B {
  constructor() {
    const t = P(di.getDefaults(), arguments, [
      "pan"
    ]);
    super(t), this.name = "Panner", this._panner = this.context.createStereoPanner(), this.input = this._panner, this.output = this._panner, this.pan = new gt({
      context: this.context,
      param: this._panner.pan,
      value: t.pan,
      minValue: -1,
      maxValue: 1
    }), this._panner.channelCount = t.channelCount, this._panner.channelCountMode = "explicit", ct(this, "pan");
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      pan: 0,
      channelCount: 1
    });
  }
  dispose() {
    return super.dispose(), this._panner.disconnect(), this.pan.dispose(), this;
  }
}
class wo extends Yr {
  constructor() {
    const t = P(wo.getDefaults(), arguments, ["frequency"]);
    super(t), this.name = "AutoPanner", this._panner = new di({
      context: this.context,
      channelCount: t.channelCount
    }), this.connectEffect(this._panner), this._lfo.connect(this._panner.pan), this._lfo.min = -1, this._lfo.max = 1;
  }
  static getDefaults() {
    return Object.assign(Yr.getDefaults(), {
      channelCount: 1
    });
  }
  dispose() {
    return super.dispose(), this._panner.dispose(), this;
  }
}
class or extends B {
  constructor() {
    const t = P(or.getDefaults(), arguments, ["smoothing"]);
    super(t), this.name = "Follower", this._abs = this.input = new Ud({ context: this.context }), this._lowpass = this.output = new sr({
      context: this.context,
      frequency: 1 / this.toSeconds(t.smoothing),
      type: "lowpass"
    }), this._abs.connect(this._lowpass), this._smoothing = t.smoothing;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      smoothing: 0.05
    });
  }
  /**
   * The amount of time it takes a value change to arrive at the updated value.
   */
  get smoothing() {
    return this._smoothing;
  }
  set smoothing(t) {
    this._smoothing = t, this._lowpass.frequency = 1 / this.toSeconds(this.smoothing);
  }
  dispose() {
    return super.dispose(), this._abs.dispose(), this._lowpass.dispose(), this;
  }
}
class ar extends ce {
  constructor() {
    const t = P(ar.getDefaults(), arguments, [
      "baseFrequency",
      "octaves",
      "sensitivity"
    ]);
    super(t), this.name = "AutoWah", this._follower = new or({
      context: this.context,
      smoothing: t.follower
    }), this._sweepRange = new bo({
      context: this.context,
      min: 0,
      max: 1,
      exponent: 0.5
    }), this._baseFrequency = this.toFrequency(t.baseFrequency), this._octaves = t.octaves, this._inputBoost = new nt({ context: this.context }), this._bandpass = new Be({
      context: this.context,
      rolloff: -48,
      frequency: 0,
      Q: t.Q
    }), this._peaking = new Be({
      context: this.context,
      type: "peaking"
    }), this._peaking.gain.value = t.gain, this.gain = this._peaking.gain, this.Q = this._bandpass.Q, this.effectSend.chain(this._inputBoost, this._follower, this._sweepRange), this._sweepRange.connect(this._bandpass.frequency), this._sweepRange.connect(this._peaking.frequency), this.effectSend.chain(this._bandpass, this._peaking, this.effectReturn), this._setSweepRange(), this.sensitivity = t.sensitivity, ct(this, ["gain", "Q"]);
  }
  static getDefaults() {
    return Object.assign(ce.getDefaults(), {
      baseFrequency: 100,
      octaves: 6,
      sensitivity: 0,
      Q: 2,
      gain: 2,
      follower: 0.2
    });
  }
  /**
   * The number of octaves that the filter will sweep above the baseFrequency.
   */
  get octaves() {
    return this._octaves;
  }
  set octaves(t) {
    this._octaves = t, this._setSweepRange();
  }
  /**
   * The follower's smoothing time
   */
  get follower() {
    return this._follower.smoothing;
  }
  set follower(t) {
    this._follower.smoothing = t;
  }
  /**
   * The base frequency from which the sweep will start from.
   */
  get baseFrequency() {
    return this._baseFrequency;
  }
  set baseFrequency(t) {
    this._baseFrequency = this.toFrequency(t), this._setSweepRange();
  }
  /**
   * The sensitivity to control how responsive to the input signal the filter is.
   */
  get sensitivity() {
    return Ui(1 / this._inputBoost.gain.value);
  }
  set sensitivity(t) {
    this._inputBoost.gain.value = 1 / qs(t);
  }
  /**
   * sets the sweep range of the scaler
   */
  _setSweepRange() {
    this._sweepRange.min = this._baseFrequency, this._sweepRange.max = Math.min(this._baseFrequency * Math.pow(2, this._octaves), this.context.sampleRate / 2);
  }
  dispose() {
    return super.dispose(), this._follower.dispose(), this._sweepRange.dispose(), this._bandpass.dispose(), this._peaking.dispose(), this._inputBoost.dispose(), this;
  }
}
const Jd = "bit-crusher", tb = (
  /* javascript */
  `
	class BitCrusherWorklet extends SingleIOProcessor {

		static get parameterDescriptors() {
			return [{
				name: "bits",
				defaultValue: 12,
				minValue: 1,
				maxValue: 16,
				automationRate: 'k-rate'
			}];
		}

		generate(input, _channel, parameters) {
			const step = Math.pow(0.5, parameters.bits - 1);
			const val = step * Math.floor(input / step + 0.5);
			return val;
		}
	}
`
);
Kd(Jd, tb);
class Co extends ce {
  constructor() {
    const t = P(Co.getDefaults(), arguments, ["bits"]);
    super(t), this.name = "BitCrusher", this._bitCrusherWorklet = new ul({
      context: this.context,
      bits: t.bits
    }), this.connectEffect(this._bitCrusherWorklet), this.bits = this._bitCrusherWorklet.bits;
  }
  static getDefaults() {
    return Object.assign(ce.getDefaults(), {
      bits: 4
    });
  }
  dispose() {
    return super.dispose(), this._bitCrusherWorklet.dispose(), this;
  }
}
class ul extends Wa {
  constructor() {
    const t = P(ul.getDefaults(), arguments);
    super(t), this.name = "BitCrusherWorklet", this.input = new nt({ context: this.context }), this.output = new nt({ context: this.context }), this.bits = new gt({
      context: this.context,
      value: t.bits,
      units: "positive",
      minValue: 1,
      maxValue: 16,
      param: this._dummyParam,
      swappable: !0
    });
  }
  static getDefaults() {
    return Object.assign(Wa.getDefaults(), {
      bits: 12
    });
  }
  _audioWorkletName() {
    return Jd;
  }
  onReady(t) {
    Ge(this.input, t, this.output);
    const n = t.parameters.get("bits");
    this.bits.setParam(n);
  }
  dispose() {
    return super.dispose(), this.input.dispose(), this.output.dispose(), this.bits.dispose(), this;
  }
}
class So extends ce {
  constructor() {
    const t = P(So.getDefaults(), arguments, ["order"]);
    super(t), this.name = "Chebyshev", this._shaper = new hn({
      context: this.context,
      length: 4096
    }), this._order = t.order, this.connectEffect(this._shaper), this.order = t.order, this.oversample = t.oversample;
  }
  static getDefaults() {
    return Object.assign(ce.getDefaults(), {
      order: 1,
      oversample: "none"
    });
  }
  /**
   * get the coefficient for that degree
   * @param  x the x value
   * @param  degree
   * @param  memo memoize the computed value. this speeds up computation greatly.
   */
  _getCoefficient(t, n, s) {
    return s.has(n) || (n === 0 ? s.set(n, 0) : n === 1 ? s.set(n, t) : s.set(n, 2 * t * this._getCoefficient(t, n - 1, s) - this._getCoefficient(t, n - 2, s))), s.get(n);
  }
  /**
   * The order of the Chebyshev polynomial which creates the equation which is applied to the incoming
   * signal through a Tone.WaveShaper. Must be an integer. The equations are in the form:
   * ```
   * order 2: 2x^2 + 1
   * order 3: 4x^3 + 3x
   * ```
   * @min 1
   * @max 100
   */
  get order() {
    return this._order;
  }
  set order(t) {
    st(Number.isInteger(t), "'order' must be an integer"), this._order = t, this._shaper.setMap((n) => this._getCoefficient(n, t, /* @__PURE__ */ new Map()));
  }
  /**
   * The oversampling of the effect. Can either be "none", "2x" or "4x".
   */
  get oversample() {
    return this._shaper.oversample;
  }
  set oversample(t) {
    this._shaper.oversample = t;
  }
  dispose() {
    return super.dispose(), this._shaper.dispose(), this;
  }
}
class As extends B {
  constructor() {
    const t = P(As.getDefaults(), arguments, [
      "channels"
    ]);
    super(t), this.name = "Split", this._splitter = this.input = this.output = this.context.createChannelSplitter(t.channels), this._internalChannels = [this._splitter];
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      channels: 2
    });
  }
  dispose() {
    return super.dispose(), this._splitter.disconnect(), this;
  }
}
class rs extends B {
  constructor() {
    const t = P(rs.getDefaults(), arguments, [
      "channels"
    ]);
    super(t), this.name = "Merge", this._merger = this.output = this.input = this.context.createChannelMerger(t.channels);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      channels: 2
    });
  }
  dispose() {
    return super.dispose(), this._merger.disconnect(), this;
  }
}
class vn extends B {
  constructor(t) {
    super(t), this.name = "StereoEffect", this.input = new nt({ context: this.context }), this.input.channelCount = 2, this.input.channelCountMode = "explicit", this._dryWet = this.output = new hi({
      context: this.context,
      fade: t.wet
    }), this.wet = this._dryWet.fade, this._split = new As({ context: this.context, channels: 2 }), this._merge = new rs({ context: this.context, channels: 2 }), this.input.connect(this._split), this.input.connect(this._dryWet.a), this._merge.connect(this._dryWet.b), ct(this, ["wet"]);
  }
  /**
   * Connect the left part of the effect
   */
  connectEffectLeft(...t) {
    this._split.connect(t[0], 0, 0), Ge(...t), Fe(t[t.length - 1], this._merge, 0, 0);
  }
  /**
   * Connect the right part of the effect
   */
  connectEffectRight(...t) {
    this._split.connect(t[0], 1, 0), Ge(...t), Fe(t[t.length - 1], this._merge, 0, 1);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      wet: 1
    });
  }
  dispose() {
    return super.dispose(), this._dryWet.dispose(), this._split.dispose(), this._merge.dispose(), this;
  }
}
class ja extends vn {
  constructor(t) {
    super(t), this.feedback = new dt({
      context: this.context,
      value: t.feedback,
      units: "normalRange"
    }), this._feedbackL = new nt({ context: this.context }), this._feedbackR = new nt({ context: this.context }), this._feedbackSplit = new As({ context: this.context, channels: 2 }), this._feedbackMerge = new rs({ context: this.context, channels: 2 }), this._merge.connect(this._feedbackSplit), this._feedbackMerge.connect(this._split), this._feedbackSplit.connect(this._feedbackL, 0, 0), this._feedbackL.connect(this._feedbackMerge, 0, 0), this._feedbackSplit.connect(this._feedbackR, 1, 0), this._feedbackR.connect(this._feedbackMerge, 0, 1), this.feedback.fan(this._feedbackL.gain, this._feedbackR.gain), ct(this, ["feedback"]);
  }
  static getDefaults() {
    return Object.assign(vn.getDefaults(), {
      feedback: 0.5
    });
  }
  dispose() {
    return super.dispose(), this.feedback.dispose(), this._feedbackL.dispose(), this._feedbackR.dispose(), this._feedbackSplit.dispose(), this._feedbackMerge.dispose(), this;
  }
}
class To extends ja {
  constructor() {
    const t = P(To.getDefaults(), arguments, [
      "frequency",
      "delayTime",
      "depth"
    ]);
    super(t), this.name = "Chorus", this._depth = t.depth, this._delayTime = t.delayTime / 1e3, this._lfoL = new Me({
      context: this.context,
      frequency: t.frequency,
      min: 0,
      max: 1
    }), this._lfoR = new Me({
      context: this.context,
      frequency: t.frequency,
      min: 0,
      max: 1,
      phase: 180
    }), this._delayNodeL = new qe({ context: this.context }), this._delayNodeR = new qe({ context: this.context }), this.frequency = this._lfoL.frequency, ct(this, ["frequency"]), this._lfoL.frequency.connect(this._lfoR.frequency), this.connectEffectLeft(this._delayNodeL), this.connectEffectRight(this._delayNodeR), this._lfoL.connect(this._delayNodeL.delayTime), this._lfoR.connect(this._delayNodeR.delayTime), this.depth = this._depth, this.type = t.type, this.spread = t.spread;
  }
  static getDefaults() {
    return Object.assign(ja.getDefaults(), {
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      type: "sine",
      spread: 180,
      feedback: 0,
      wet: 0.5
    });
  }
  /**
   * The depth of the effect. A depth of 1 makes the delayTime
   * modulate between 0 and 2*delayTime (centered around the delayTime).
   */
  get depth() {
    return this._depth;
  }
  set depth(t) {
    this._depth = t;
    const n = this._delayTime * t;
    this._lfoL.min = Math.max(this._delayTime - n, 0), this._lfoL.max = this._delayTime + n, this._lfoR.min = Math.max(this._delayTime - n, 0), this._lfoR.max = this._delayTime + n;
  }
  /**
   * The delayTime in milliseconds of the chorus. A larger delayTime
   * will give a more pronounced effect. Nominal range a delayTime
   * is between 2 and 20ms.
   */
  get delayTime() {
    return this._delayTime * 1e3;
  }
  set delayTime(t) {
    this._delayTime = t / 1e3, this.depth = this._depth;
  }
  /**
   * The oscillator type of the LFO.
   */
  get type() {
    return this._lfoL.type;
  }
  set type(t) {
    this._lfoL.type = t, this._lfoR.type = t;
  }
  /**
   * Amount of stereo spread. When set to 0, both LFO's will be panned centrally.
   * When set to 180, LFO's will be panned hard left and right respectively.
   */
  get spread() {
    return this._lfoR.phase - this._lfoL.phase;
  }
  set spread(t) {
    this._lfoL.phase = 90 - t / 2, this._lfoR.phase = t / 2 + 90;
  }
  /**
   * Start the effect.
   */
  start(t) {
    return this._lfoL.start(t), this._lfoR.start(t), this;
  }
  /**
   * Stop the lfo
   */
  stop(t) {
    return this._lfoL.stop(t), this._lfoR.stop(t), this;
  }
  /**
   * Sync the filter to the transport.
   * @see {@link LFO.sync}
   */
  sync() {
    return this._lfoL.sync(), this._lfoR.sync(), this;
  }
  /**
   * Unsync the filter from the transport.
   */
  unsync() {
    return this._lfoL.unsync(), this._lfoR.unsync(), this;
  }
  dispose() {
    return super.dispose(), this._lfoL.dispose(), this._lfoR.dispose(), this._delayNodeL.dispose(), this._delayNodeR.dispose(), this.frequency.dispose(), this;
  }
}
class Ao extends ce {
  constructor() {
    const t = P(Ao.getDefaults(), arguments, ["distortion"]);
    super(t), this.name = "Distortion", this._shaper = new hn({
      context: this.context,
      length: 4096
    }), this._distortion = t.distortion, this.connectEffect(this._shaper), this.distortion = t.distortion, this.oversample = t.oversample;
  }
  static getDefaults() {
    return Object.assign(ce.getDefaults(), {
      distortion: 0.4,
      oversample: "none"
    });
  }
  /**
   * The amount of distortion. Nominal range is between 0 and 1.
   */
  get distortion() {
    return this._distortion;
  }
  set distortion(t) {
    this._distortion = t;
    const n = t * 100, s = Math.PI / 180;
    this._shaper.setMap((i) => Math.abs(i) < 1e-3 ? 0 : (3 + n) * i * 20 * s / (Math.PI + n * Math.abs(i)));
  }
  /**
   * The oversampling of the effect. Can either be "none", "2x" or "4x".
   */
  get oversample() {
    return this._shaper.oversample;
  }
  set oversample(t) {
    this._shaper.oversample = t;
  }
  dispose() {
    return super.dispose(), this._shaper.dispose(), this;
  }
}
class Xr extends ce {
  constructor(t) {
    super(t), this.name = "FeedbackEffect", this._feedbackGain = new nt({
      context: this.context,
      gain: t.feedback,
      units: "normalRange"
    }), this.feedback = this._feedbackGain.gain, ct(this, "feedback"), this.effectReturn.chain(this._feedbackGain, this.effectSend);
  }
  static getDefaults() {
    return Object.assign(ce.getDefaults(), {
      feedback: 0.125
    });
  }
  dispose() {
    return super.dispose(), this._feedbackGain.dispose(), this.feedback.dispose(), this;
  }
}
class ko extends Xr {
  constructor() {
    const t = P(ko.getDefaults(), arguments, ["delayTime", "feedback"]);
    super(t), this.name = "FeedbackDelay", this._delayNode = new qe({
      context: this.context,
      delayTime: t.delayTime,
      maxDelay: t.maxDelay
    }), this.delayTime = this._delayNode.delayTime, this.connectEffect(this._delayNode), ct(this, "delayTime");
  }
  static getDefaults() {
    return Object.assign(Xr.getDefaults(), {
      delayTime: 0.25,
      maxDelay: 1
    });
  }
  dispose() {
    return super.dispose(), this._delayNode.dispose(), this.delayTime.dispose(), this;
  }
}
class eb extends B {
  constructor(t) {
    super(t), this.name = "PhaseShiftAllpass", this.input = new nt({ context: this.context }), this.output = new nt({ context: this.context }), this.offset90 = new nt({ context: this.context });
    const n = [
      0.6923878,
      0.9360654322959,
      0.988229522686,
      0.9987488452737
    ], s = [
      0.4021921162426,
      0.856171088242,
      0.9722909545651,
      0.9952884791278
    ];
    this._bank0 = this._createAllPassFilterBank(n), this._bank1 = this._createAllPassFilterBank(s), this._oneSampleDelay = this.context.createIIRFilter([0, 1], [1, 0]), Ge(this.input, ...this._bank0, this._oneSampleDelay, this.output), Ge(this.input, ...this._bank1, this.offset90);
  }
  /**
   * Create all of the IIR filters from an array of values using the coefficient calculation.
   */
  _createAllPassFilterBank(t) {
    return t.map((s) => {
      const i = [
        [s * s, 0, -1],
        [1, 0, -(s * s)]
      ];
      return this.context.createIIRFilter(i[0], i[1]);
    });
  }
  dispose() {
    return super.dispose(), this.input.dispose(), this.output.dispose(), this.offset90.dispose(), this._bank0.forEach((t) => t.disconnect()), this._bank1.forEach((t) => t.disconnect()), this._oneSampleDelay.disconnect(), this;
  }
}
class hl extends ce {
  constructor() {
    const t = P(hl.getDefaults(), arguments, ["frequency"]);
    super(t), this.name = "FrequencyShifter", this.frequency = new dt({
      context: this.context,
      units: "frequency",
      value: t.frequency,
      minValue: -this.context.sampleRate / 2,
      maxValue: this.context.sampleRate / 2
    }), this._sine = new Ki({
      context: this.context,
      type: "sine"
    }), this._cosine = new Xt({
      context: this.context,
      phase: -90,
      type: "sine"
    }), this._sineMultiply = new Ut({ context: this.context }), this._cosineMultiply = new Ut({ context: this.context }), this._negate = new Qc({ context: this.context }), this._add = new Cs({ context: this.context }), this._phaseShifter = new eb({ context: this.context }), this.effectSend.connect(this._phaseShifter), this.frequency.fan(this._sine.frequency, this._cosine.frequency), this._phaseShifter.offset90.connect(this._cosineMultiply), this._cosine.connect(this._cosineMultiply.factor), this._phaseShifter.connect(this._sineMultiply), this._sine.connect(this._sineMultiply.factor), this._sineMultiply.connect(this._negate), this._cosineMultiply.connect(this._add), this._negate.connect(this._add.addend), this._add.connect(this.effectReturn);
    const n = this.immediate();
    this._sine.start(n), this._cosine.start(n);
  }
  static getDefaults() {
    return Object.assign(ce.getDefaults(), {
      frequency: 0
    });
  }
  dispose() {
    return super.dispose(), this.frequency.dispose(), this._add.dispose(), this._cosine.dispose(), this._cosineMultiply.dispose(), this._negate.dispose(), this._phaseShifter.dispose(), this._sine.dispose(), this._sineMultiply.dispose(), this;
  }
}
const pu = [
  1557 / 44100,
  1617 / 44100,
  1491 / 44100,
  1422 / 44100,
  1277 / 44100,
  1356 / 44100,
  1188 / 44100,
  1116 / 44100
], mu = [225, 556, 441, 341];
class Io extends vn {
  constructor() {
    const t = P(Io.getDefaults(), arguments, ["roomSize", "dampening"]);
    super(t), this.name = "Freeverb", this._combFilters = [], this._allpassFiltersL = [], this._allpassFiltersR = [], this.roomSize = new dt({
      context: this.context,
      value: t.roomSize,
      units: "normalRange"
    }), this._allpassFiltersL = mu.map((n) => {
      const s = this.context.createBiquadFilter();
      return s.type = "allpass", s.frequency.value = n, s;
    }), this._allpassFiltersR = mu.map((n) => {
      const s = this.context.createBiquadFilter();
      return s.type = "allpass", s.frequency.value = n, s;
    }), this._combFilters = pu.map((n, s) => {
      const i = new ir({
        context: this.context,
        dampening: t.dampening,
        delayTime: n
      });
      return s < pu.length / 2 ? this.connectEffectLeft(i, ...this._allpassFiltersL) : this.connectEffectRight(i, ...this._allpassFiltersR), this.roomSize.connect(i.resonance), i;
    }), ct(this, ["roomSize"]);
  }
  static getDefaults() {
    return Object.assign(vn.getDefaults(), {
      roomSize: 0.7,
      dampening: 3e3
    });
  }
  /**
   * The amount of dampening of the reverberant signal.
   */
  get dampening() {
    return this._combFilters[0].dampening;
  }
  set dampening(t) {
    this._combFilters.forEach((n) => n.dampening = t);
  }
  dispose() {
    return super.dispose(), this._allpassFiltersL.forEach((t) => t.disconnect()), this._allpassFiltersR.forEach((t) => t.disconnect()), this._combFilters.forEach((t) => t.dispose()), this.roomSize.dispose(), this;
  }
}
const gu = [
  1687 / 25e3,
  1601 / 25e3,
  2053 / 25e3,
  2251 / 25e3
], nb = [0.773, 0.802, 0.753, 0.733], sb = [347, 113, 37];
class Eo extends vn {
  constructor() {
    const t = P(Eo.getDefaults(), arguments, ["roomSize"]);
    super(t), this.name = "JCReverb", this._allpassFilters = [], this._feedbackCombFilters = [], this.roomSize = new dt({
      context: this.context,
      value: t.roomSize,
      units: "normalRange"
    }), this._scaleRoomSize = new Mn({
      context: this.context,
      min: -0.733,
      max: 0.197
    }), this._allpassFilters = sb.map((n) => {
      const s = this.context.createBiquadFilter();
      return s.type = "allpass", s.frequency.value = n, s;
    }), this._feedbackCombFilters = gu.map((n, s) => {
      const i = new nr({
        context: this.context,
        delayTime: n
      });
      return this._scaleRoomSize.connect(i.resonance), i.resonance.value = nb[s], s < gu.length / 2 ? this.connectEffectLeft(...this._allpassFilters, i) : this.connectEffectRight(...this._allpassFilters, i), i;
    }), this.roomSize.connect(this._scaleRoomSize), ct(this, ["roomSize"]);
  }
  static getDefaults() {
    return Object.assign(vn.getDefaults(), {
      roomSize: 0.5
    });
  }
  dispose() {
    return super.dispose(), this._allpassFilters.forEach((t) => t.disconnect()), this._feedbackCombFilters.forEach((t) => t.dispose()), this.roomSize.dispose(), this._scaleRoomSize.dispose(), this;
  }
}
class _u extends ja {
  constructor(t) {
    super(t), this._feedbackL.disconnect(), this._feedbackL.connect(this._feedbackMerge, 0, 1), this._feedbackR.disconnect(), this._feedbackR.connect(this._feedbackMerge, 0, 0), ct(this, ["feedback"]);
  }
}
class Do extends _u {
  constructor() {
    const t = P(Do.getDefaults(), arguments, ["delayTime", "feedback"]);
    super(t), this.name = "PingPongDelay", this._leftDelay = new qe({
      context: this.context,
      maxDelay: t.maxDelay
    }), this._rightDelay = new qe({
      context: this.context,
      maxDelay: t.maxDelay
    }), this._rightPreDelay = new qe({
      context: this.context,
      maxDelay: t.maxDelay
    }), this.delayTime = new dt({
      context: this.context,
      units: "time",
      value: t.delayTime
    }), this.connectEffectLeft(this._leftDelay), this.connectEffectRight(this._rightPreDelay, this._rightDelay), this.delayTime.fan(this._leftDelay.delayTime, this._rightDelay.delayTime, this._rightPreDelay.delayTime), this._feedbackL.disconnect(), this._feedbackL.connect(this._rightDelay), ct(this, ["delayTime"]);
  }
  static getDefaults() {
    return Object.assign(_u.getDefaults(), {
      delayTime: 0.25,
      maxDelay: 1
    });
  }
  dispose() {
    return super.dispose(), this._leftDelay.dispose(), this._rightDelay.dispose(), this._rightPreDelay.dispose(), this.delayTime.dispose(), this;
  }
}
class dl extends Xr {
  constructor() {
    const t = P(dl.getDefaults(), arguments, ["pitch"]);
    super(t), this.name = "PitchShift", this._frequency = new dt({ context: this.context }), this._delayA = new qe({
      maxDelay: 1,
      context: this.context
    }), this._lfoA = new Me({
      context: this.context,
      min: 0,
      max: 0.1,
      type: "sawtooth"
    }).connect(this._delayA.delayTime), this._delayB = new qe({
      maxDelay: 1,
      context: this.context
    }), this._lfoB = new Me({
      context: this.context,
      min: 0,
      max: 0.1,
      type: "sawtooth",
      phase: 180
    }).connect(this._delayB.delayTime), this._crossFade = new hi({ context: this.context }), this._crossFadeLFO = new Me({
      context: this.context,
      min: 0,
      max: 1,
      type: "triangle",
      phase: 90
    }).connect(this._crossFade.fade), this._feedbackDelay = new qe({
      delayTime: t.delayTime,
      context: this.context
    }), this.delayTime = this._feedbackDelay.delayTime, ct(this, "delayTime"), this._pitch = t.pitch, this._windowSize = t.windowSize, this._delayA.connect(this._crossFade.a), this._delayB.connect(this._crossFade.b), this._frequency.fan(this._lfoA.frequency, this._lfoB.frequency, this._crossFadeLFO.frequency), this.effectSend.fan(this._delayA, this._delayB), this._crossFade.chain(this._feedbackDelay, this.effectReturn);
    const n = this.now();
    this._lfoA.start(n), this._lfoB.start(n), this._crossFadeLFO.start(n), this.windowSize = this._windowSize;
  }
  static getDefaults() {
    return Object.assign(Xr.getDefaults(), {
      pitch: 0,
      windowSize: 0.1,
      delayTime: 0,
      feedback: 0
    });
  }
  /**
   * Repitch the incoming signal by some interval (measured in semi-tones).
   * @example
   * const pitchShift = new Tone.PitchShift().toDestination();
   * const osc = new Tone.Oscillator().connect(pitchShift).start().toDestination();
   * pitchShift.pitch = -12; // down one octave
   * pitchShift.pitch = 7; // up a fifth
   */
  get pitch() {
    return this._pitch;
  }
  set pitch(t) {
    this._pitch = t;
    let n = 0;
    t < 0 ? (this._lfoA.min = 0, this._lfoA.max = this._windowSize, this._lfoB.min = 0, this._lfoB.max = this._windowSize, n = zs(t - 1) + 1) : (this._lfoA.min = this._windowSize, this._lfoA.max = 0, this._lfoB.min = this._windowSize, this._lfoB.max = 0, n = zs(t) - 1), this._frequency.value = n * (1.2 / this._windowSize);
  }
  /**
   * The window size corresponds roughly to the sample length in a looping sampler.
   * Smaller values are desirable for a less noticeable delay time of the pitch shifted
   * signal, but larger values will result in smoother pitch shifting for larger intervals.
   * A nominal range of 0.03 to 0.1 is recommended.
   */
  get windowSize() {
    return this._windowSize;
  }
  set windowSize(t) {
    this._windowSize = this.toSeconds(t), this.pitch = this._pitch;
  }
  dispose() {
    return super.dispose(), this._frequency.dispose(), this._delayA.dispose(), this._delayB.dispose(), this._lfoA.dispose(), this._lfoB.dispose(), this._crossFade.dispose(), this._crossFadeLFO.dispose(), this._feedbackDelay.dispose(), this;
  }
}
class Ro extends vn {
  constructor() {
    const t = P(Ro.getDefaults(), arguments, [
      "frequency",
      "octaves",
      "baseFrequency"
    ]);
    super(t), this.name = "Phaser", this._lfoL = new Me({
      context: this.context,
      frequency: t.frequency,
      min: 0,
      max: 1
    }), this._lfoR = new Me({
      context: this.context,
      frequency: t.frequency,
      min: 0,
      max: 1,
      phase: 180
    }), this._baseFrequency = this.toFrequency(t.baseFrequency), this._octaves = t.octaves, this.Q = new dt({
      context: this.context,
      value: t.Q,
      units: "positive"
    }), this._filtersL = this._makeFilters(t.stages, this._lfoL), this._filtersR = this._makeFilters(t.stages, this._lfoR), this.frequency = this._lfoL.frequency, this.frequency.value = t.frequency, this.connectEffectLeft(...this._filtersL), this.connectEffectRight(...this._filtersR), this._lfoL.frequency.connect(this._lfoR.frequency), this.baseFrequency = t.baseFrequency, this.octaves = t.octaves, this._lfoL.start(), this._lfoR.start(), ct(this, ["frequency", "Q"]);
  }
  static getDefaults() {
    return Object.assign(vn.getDefaults(), {
      frequency: 0.5,
      octaves: 3,
      stages: 10,
      Q: 10,
      baseFrequency: 350
    });
  }
  _makeFilters(t, n) {
    const s = [];
    for (let i = 0; i < t; i++) {
      const r = this.context.createBiquadFilter();
      r.type = "allpass", this.Q.connect(r.Q), n.connect(r.frequency), s.push(r);
    }
    return s;
  }
  /**
   * The number of octaves the phase goes above the baseFrequency
   */
  get octaves() {
    return this._octaves;
  }
  set octaves(t) {
    this._octaves = t;
    const n = this._baseFrequency * Math.pow(2, t);
    this._lfoL.max = n, this._lfoR.max = n;
  }
  /**
   * The the base frequency of the filters.
   */
  get baseFrequency() {
    return this._baseFrequency;
  }
  set baseFrequency(t) {
    this._baseFrequency = this.toFrequency(t), this._lfoL.min = this._baseFrequency, this._lfoR.min = this._baseFrequency, this.octaves = this._octaves;
  }
  dispose() {
    return super.dispose(), this.Q.dispose(), this._lfoL.dispose(), this._lfoR.dispose(), this._filtersL.forEach((t) => t.disconnect()), this._filtersR.forEach((t) => t.disconnect()), this.frequency.dispose(), this;
  }
}
class cr extends ce {
  constructor() {
    const t = P(cr.getDefaults(), arguments, [
      "decay"
    ]);
    super(t), this.name = "Reverb", this._convolver = this.context.createConvolver(), this.ready = Promise.resolve();
    const n = this.toSeconds(t.decay);
    oe(n, 1e-3), this._decay = n;
    const s = this.toSeconds(t.preDelay);
    oe(s, 0), this._preDelay = s, this.generate(), this.connectEffect(this._convolver);
  }
  static getDefaults() {
    return Object.assign(ce.getDefaults(), {
      decay: 1.5,
      preDelay: 0.01
    });
  }
  /**
   * The duration of the reverb.
   */
  get decay() {
    return this._decay;
  }
  set decay(t) {
    t = this.toSeconds(t), oe(t, 1e-3), this._decay = t, this.generate();
  }
  /**
   * The amount of time before the reverb is fully ramped in.
   */
  get preDelay() {
    return this._preDelay;
  }
  set preDelay(t) {
    t = this.toSeconds(t), oe(t, 0), this._preDelay = t, this.generate();
  }
  /**
   * Generate the Impulse Response. Returns a promise while the IR is being generated.
   * @return Promise which returns this object.
   */
  generate() {
    return jt(this, void 0, void 0, function* () {
      const t = this.ready, n = new si(2, this._decay + this._preDelay, this.context.sampleRate), s = new Hn({ context: n }), i = new Hn({ context: n }), r = new rs({ context: n });
      s.connect(r, 0, 0), i.connect(r, 0, 1);
      const o = new nt({ context: n }).toDestination();
      r.connect(o), s.start(0), i.start(0), o.gain.setValueAtTime(0, 0), o.gain.setValueAtTime(1, this._preDelay), o.gain.exponentialApproachValueAtTime(0, this._preDelay, this.decay);
      const a = n.render();
      return this.ready = a.then(St), yield t, this._convolver.buffer = (yield a).get(), this;
    });
  }
  dispose() {
    return super.dispose(), this._convolver.disconnect(), this;
  }
}
class lr extends B {
  constructor() {
    super(P(lr.getDefaults(), arguments)), this.name = "MidSideSplit", this._split = this.input = new As({
      channels: 2,
      context: this.context
    }), this._midAdd = new Cs({ context: this.context }), this.mid = new Ut({
      context: this.context,
      value: Math.SQRT1_2
    }), this._sideSubtract = new Ts({ context: this.context }), this.side = new Ut({
      context: this.context,
      value: Math.SQRT1_2
    }), this._split.connect(this._midAdd, 0), this._split.connect(this._midAdd.addend, 1), this._split.connect(this._sideSubtract, 0), this._split.connect(this._sideSubtract.subtrahend, 1), this._midAdd.connect(this.mid), this._sideSubtract.connect(this.side);
  }
  dispose() {
    return super.dispose(), this.mid.dispose(), this.side.dispose(), this._midAdd.dispose(), this._sideSubtract.dispose(), this._split.dispose(), this;
  }
}
class ur extends B {
  constructor() {
    super(P(ur.getDefaults(), arguments)), this.name = "MidSideMerge", this.mid = new nt({ context: this.context }), this.side = new nt({ context: this.context }), this._left = new Cs({ context: this.context }), this._leftMult = new Ut({
      context: this.context,
      value: Math.SQRT1_2
    }), this._right = new Ts({ context: this.context }), this._rightMult = new Ut({
      context: this.context,
      value: Math.SQRT1_2
    }), this._merge = this.output = new rs({ context: this.context }), this.mid.fan(this._left), this.side.connect(this._left.addend), this.mid.connect(this._right), this.side.connect(this._right.subtrahend), this._left.connect(this._leftMult), this._right.connect(this._rightMult), this._leftMult.connect(this._merge, 0, 0), this._rightMult.connect(this._merge, 0, 1);
  }
  dispose() {
    return super.dispose(), this.mid.dispose(), this.side.dispose(), this._leftMult.dispose(), this._rightMult.dispose(), this._left.dispose(), this._right.dispose(), this;
  }
}
class yu extends ce {
  constructor(t) {
    super(t), this.name = "MidSideEffect", this._midSideMerge = new ur({ context: this.context }), this._midSideSplit = new lr({ context: this.context }), this._midSend = this._midSideSplit.mid, this._sideSend = this._midSideSplit.side, this._midReturn = this._midSideMerge.mid, this._sideReturn = this._midSideMerge.side, this.effectSend.connect(this._midSideSplit), this._midSideMerge.connect(this.effectReturn);
  }
  /**
   * Connect the mid chain of the effect
   */
  connectEffectMid(...t) {
    this._midSend.chain(...t, this._midReturn);
  }
  /**
   * Connect the side chain of the effect
   */
  connectEffectSide(...t) {
    this._sideSend.chain(...t, this._sideReturn);
  }
  dispose() {
    return super.dispose(), this._midSideSplit.dispose(), this._midSideMerge.dispose(), this._midSend.dispose(), this._sideSend.dispose(), this._midReturn.dispose(), this._sideReturn.dispose(), this;
  }
}
class Oo extends yu {
  constructor() {
    const t = P(Oo.getDefaults(), arguments, ["width"]);
    super(t), this.name = "StereoWidener", this.width = new dt({
      context: this.context,
      value: t.width,
      units: "normalRange"
    }), ct(this, ["width"]), this._twoTimesWidthMid = new Ut({
      context: this.context,
      value: 2
    }), this._twoTimesWidthSide = new Ut({
      context: this.context,
      value: 2
    }), this._midMult = new Ut({ context: this.context }), this._twoTimesWidthMid.connect(this._midMult.factor), this.connectEffectMid(this._midMult), this._oneMinusWidth = new Ts({ context: this.context }), this._oneMinusWidth.connect(this._twoTimesWidthMid), Fe(this.context.getConstant(1), this._oneMinusWidth), this.width.connect(this._oneMinusWidth.subtrahend), this._sideMult = new Ut({ context: this.context }), this.width.connect(this._twoTimesWidthSide), this._twoTimesWidthSide.connect(this._sideMult.factor), this.connectEffectSide(this._sideMult);
  }
  static getDefaults() {
    return Object.assign(yu.getDefaults(), {
      width: 0.5
    });
  }
  dispose() {
    return super.dispose(), this.width.dispose(), this._midMult.dispose(), this._sideMult.dispose(), this._twoTimesWidthMid.dispose(), this._twoTimesWidthSide.dispose(), this._oneMinusWidth.dispose(), this;
  }
}
class Mo extends vn {
  constructor() {
    const t = P(Mo.getDefaults(), arguments, [
      "frequency",
      "depth"
    ]);
    super(t), this.name = "Tremolo", this._lfoL = new Me({
      context: this.context,
      type: t.type,
      min: 1,
      max: 0
    }), this._lfoR = new Me({
      context: this.context,
      type: t.type,
      min: 1,
      max: 0
    }), this._amplitudeL = new nt({ context: this.context }), this._amplitudeR = new nt({ context: this.context }), this.frequency = new dt({
      context: this.context,
      value: t.frequency,
      units: "frequency"
    }), this.depth = new dt({
      context: this.context,
      value: t.depth,
      units: "normalRange"
    }), ct(this, ["frequency", "depth"]), this.connectEffectLeft(this._amplitudeL), this.connectEffectRight(this._amplitudeR), this._lfoL.connect(this._amplitudeL.gain), this._lfoR.connect(this._amplitudeR.gain), this.frequency.fan(this._lfoL.frequency, this._lfoR.frequency), this.depth.fan(this._lfoR.amplitude, this._lfoL.amplitude), this.spread = t.spread;
  }
  static getDefaults() {
    return Object.assign(vn.getDefaults(), {
      frequency: 10,
      type: "sine",
      depth: 0.5,
      spread: 180
    });
  }
  /**
   * Start the tremolo.
   */
  start(t) {
    return this._lfoL.start(t), this._lfoR.start(t), this;
  }
  /**
   * Stop the tremolo.
   */
  stop(t) {
    return this._lfoL.stop(t), this._lfoR.stop(t), this;
  }
  /**
   * Sync the effect to the transport.
   */
  sync() {
    return this._lfoL.sync(), this._lfoR.sync(), this.context.transport.syncSignal(this.frequency), this;
  }
  /**
   * Unsync the filter from the transport
   */
  unsync() {
    return this._lfoL.unsync(), this._lfoR.unsync(), this.context.transport.unsyncSignal(this.frequency), this;
  }
  /**
   * The oscillator type.
   */
  get type() {
    return this._lfoL.type;
  }
  set type(t) {
    this._lfoL.type = t, this._lfoR.type = t;
  }
  /**
   * Amount of stereo spread. When set to 0, both LFO's will be panned centrally.
   * When set to 180, LFO's will be panned hard left and right respectively.
   */
  get spread() {
    return this._lfoR.phase - this._lfoL.phase;
  }
  set spread(t) {
    this._lfoL.phase = 90 - t / 2, this._lfoR.phase = t / 2 + 90;
  }
  dispose() {
    return super.dispose(), this._lfoL.dispose(), this._lfoR.dispose(), this._amplitudeL.dispose(), this._amplitudeR.dispose(), this.frequency.dispose(), this.depth.dispose(), this;
  }
}
class Fo extends ce {
  constructor() {
    const t = P(Fo.getDefaults(), arguments, [
      "frequency",
      "depth"
    ]);
    super(t), this.name = "Vibrato", this._delayNode = new qe({
      context: this.context,
      delayTime: 0,
      maxDelay: t.maxDelay
    }), this._lfo = new Me({
      context: this.context,
      type: t.type,
      min: 0,
      max: t.maxDelay,
      frequency: t.frequency,
      phase: -90
      // offse the phase so the resting position is in the center
    }).start().connect(this._delayNode.delayTime), this.frequency = this._lfo.frequency, this.depth = this._lfo.amplitude, this.depth.value = t.depth, ct(this, ["frequency", "depth"]), this.effectSend.chain(this._delayNode, this.effectReturn);
  }
  static getDefaults() {
    return Object.assign(ce.getDefaults(), {
      maxDelay: 5e-3,
      frequency: 5,
      depth: 0.1,
      type: "sine"
    });
  }
  /**
   * Type of oscillator attached to the Vibrato.
   */
  get type() {
    return this._lfo.type;
  }
  set type(t) {
    this._lfo.type = t;
  }
  dispose() {
    return super.dispose(), this._delayNode.dispose(), this._lfo.dispose(), this.frequency.dispose(), this.depth.dispose(), this;
  }
}
class os extends B {
  constructor() {
    const t = P(os.getDefaults(), arguments, ["type", "size"]);
    super(t), this.name = "Analyser", this._analysers = [], this._buffers = [], this.input = this.output = this._gain = new nt({ context: this.context }), this._split = new As({
      context: this.context,
      channels: t.channels
    }), this.input.connect(this._split), oe(t.channels, 1);
    for (let n = 0; n < t.channels; n++)
      this._analysers[n] = this.context.createAnalyser(), this._split.connect(this._analysers[n], n, 0);
    this.size = t.size, this.type = t.type, this.smoothing = t.smoothing;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      size: 1024,
      smoothing: 0.8,
      type: "fft",
      channels: 1
    });
  }
  /**
   * Run the analysis given the current settings. If {@link channels} = 1,
   * it will return a Float32Array. If {@link channels} > 1, it will
   * return an array of Float32Arrays where each index in the array
   * represents the analysis done on a channel.
   */
  getValue() {
    return this._analysers.forEach((t, n) => {
      const s = this._buffers[n];
      this._type === "fft" ? t.getFloatFrequencyData(s) : this._type === "waveform" && t.getFloatTimeDomainData(s);
    }), this.channels === 1 ? this._buffers[0] : this._buffers;
  }
  /**
   * The size of analysis. This must be a power of two in the range 16 to 16384.
   */
  get size() {
    return this._analysers[0].frequencyBinCount;
  }
  set size(t) {
    this._analysers.forEach((n, s) => {
      n.fftSize = t * 2, this._buffers[s] = new Float32Array(t);
    });
  }
  /**
   * The number of channels the analyser does the analysis on. Channel
   * separation is done using {@link Split}
   */
  get channels() {
    return this._analysers.length;
  }
  /**
   * The analysis function returned by analyser.getValue(), either "fft" or "waveform".
   */
  get type() {
    return this._type;
  }
  set type(t) {
    st(t === "waveform" || t === "fft", `Analyser: invalid type: ${t}`), this._type = t;
  }
  /**
   * 0 represents no time averaging with the last analysis frame.
   */
  get smoothing() {
    return this._analysers[0].smoothingTimeConstant;
  }
  set smoothing(t) {
    this._analysers.forEach((n) => n.smoothingTimeConstant = t);
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._analysers.forEach((t) => t.disconnect()), this._split.dispose(), this._gain.dispose(), this;
  }
}
class Qn extends B {
  constructor() {
    super(P(Qn.getDefaults(), arguments)), this.name = "MeterBase", this.input = this.output = this._analyser = new os({
      context: this.context,
      size: 256,
      type: "waveform"
    });
  }
  dispose() {
    return super.dispose(), this._analyser.dispose(), this;
  }
}
class fl extends Qn {
  constructor() {
    const t = P(fl.getDefaults(), arguments, [
      "smoothing"
    ]);
    super(t), this.name = "Meter", this.input = this.output = this._analyser = new os({
      context: this.context,
      size: 256,
      type: "waveform",
      channels: t.channelCount
    }), this.smoothing = t.smoothing, this.normalRange = t.normalRange, this._rms = new Array(t.channelCount), this._rms.fill(0);
  }
  static getDefaults() {
    return Object.assign(Qn.getDefaults(), {
      smoothing: 0.8,
      normalRange: !1,
      channelCount: 1
    });
  }
  /**
   * Use {@link getValue} instead. For the previous getValue behavior, use DCMeter.
   * @deprecated
   */
  getLevel() {
    return ti("'getLevel' has been changed to 'getValue'"), this.getValue();
  }
  /**
   * Get the current value of the incoming signal.
   * Output is in decibels when {@link normalRange} is `false`.
   * If {@link channels} = 1, then the output is a single number
   * representing the value of the input signal. When {@link channels} > 1,
   * then each channel is returned as a value in a number array.
   */
  getValue() {
    const t = this._analyser.getValue(), s = (this.channels === 1 ? [t] : t).map((i, r) => {
      const o = i.reduce((c, l) => c + l * l, 0), a = Math.sqrt(o / i.length);
      return this._rms[r] = Math.max(a, this._rms[r] * this.smoothing), this.normalRange ? this._rms[r] : Ui(this._rms[r]);
    });
    return this.channels === 1 ? s[0] : s;
  }
  /**
   * The number of channels of analysis.
   */
  get channels() {
    return this._analyser.channels;
  }
  dispose() {
    return super.dispose(), this._analyser.dispose(), this;
  }
}
class pl extends Qn {
  constructor() {
    const t = P(pl.getDefaults(), arguments, [
      "size"
    ]);
    super(t), this.name = "FFT", this.normalRange = t.normalRange, this._analyser.type = "fft", this.size = t.size;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      normalRange: !1,
      size: 1024,
      smoothing: 0.8
    });
  }
  /**
   * Gets the current frequency data from the connected audio source.
   * Returns the frequency data of length {@link size} as a Float32Array of decibel values.
   */
  getValue() {
    return this._analyser.getValue().map((n) => this.normalRange ? qs(n) : n);
  }
  /**
   * The size of analysis. This must be a power of two in the range 16 to 16384.
   * Determines the size of the array returned by {@link getValue} (i.e. the number of
   * frequency bins). Large FFT sizes may be costly to compute.
   */
  get size() {
    return this._analyser.size;
  }
  set size(t) {
    this._analyser.size = t;
  }
  /**
   * 0 represents no time averaging with the last analysis frame.
   */
  get smoothing() {
    return this._analyser.smoothing;
  }
  set smoothing(t) {
    this._analyser.smoothing = t;
  }
  /**
   * Returns the frequency value in hertz of each of the indices of the FFT's {@link getValue} response.
   * @example
   * const fft = new Tone.FFT(32);
   * console.log([0, 1, 2, 3, 4].map(index => fft.getFrequencyOfIndex(index)));
   */
  getFrequencyOfIndex(t) {
    return st(0 <= t && t < this.size, `index must be greater than or equal to 0 and less than ${this.size}`), t * this.context.sampleRate / (this.size * 2);
  }
}
class ml extends Qn {
  constructor() {
    super(P(ml.getDefaults(), arguments)), this.name = "DCMeter", this._analyser.type = "waveform", this._analyser.size = 256;
  }
  /**
   * Get the signal value of the incoming signal
   */
  getValue() {
    return this._analyser.getValue()[0];
  }
}
let ib = class tf extends Qn {
  constructor() {
    const t = P(tf.getDefaults(), arguments, ["size"]);
    super(t), this.name = "Waveform", this._analyser.type = "waveform", this.size = t.size;
  }
  static getDefaults() {
    return Object.assign(Qn.getDefaults(), {
      size: 1024
    });
  }
  /**
   * Return the waveform for the current time as a Float32Array where each value in the array
   * represents a sample in the waveform.
   */
  getValue() {
    return this._analyser.getValue();
  }
  /**
   * The size of analysis. This must be a power of two in the range 16 to 16384.
   * Determines the size of the array returned by {@link getValue}.
   */
  get size() {
    return this._analyser.size;
  }
  set size(t) {
    this._analyser.size = t;
  }
};
class ne extends B {
  constructor() {
    const t = P(ne.getDefaults(), arguments, [
      "solo"
    ]);
    super(t), this.name = "Solo", this.input = this.output = new nt({
      context: this.context
    }), ne._allSolos.has(this.context) || ne._allSolos.set(this.context, /* @__PURE__ */ new Set()), ne._allSolos.get(this.context).add(this), this.solo = t.solo;
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      solo: !1
    });
  }
  /**
   * Isolates this instance and mutes all other instances of Solo.
   * Only one instance can be soloed at a time. A soloed
   * instance will report `solo=false` when another instance is soloed.
   */
  get solo() {
    return this._isSoloed();
  }
  set solo(t) {
    t ? this._addSolo() : this._removeSolo(), ne._allSolos.get(this.context).forEach((n) => n._updateSolo());
  }
  /**
   * If the current instance is muted, i.e. another instance is soloed
   */
  get muted() {
    return this.input.gain.value === 0;
  }
  /**
   * Add this to the soloed array
   */
  _addSolo() {
    ne._soloed.has(this.context) || ne._soloed.set(this.context, /* @__PURE__ */ new Set()), ne._soloed.get(this.context).add(this);
  }
  /**
   * Remove this from the soloed array
   */
  _removeSolo() {
    ne._soloed.has(this.context) && ne._soloed.get(this.context).delete(this);
  }
  /**
   * Is this on the soloed array
   */
  _isSoloed() {
    return ne._soloed.has(this.context) && ne._soloed.get(this.context).has(this);
  }
  /**
   * Returns true if no one is soloed
   */
  _noSolos() {
    return !ne._soloed.has(this.context) || // or has a solo set but doesn't include any items
    ne._soloed.has(this.context) && ne._soloed.get(this.context).size === 0;
  }
  /**
   * Solo the current instance and unsolo all other instances.
   */
  _updateSolo() {
    this._isSoloed() ? this.input.gain.value = 1 : this._noSolos() ? this.input.gain.value = 1 : this.input.gain.value = 0;
  }
  dispose() {
    return super.dispose(), ne._allSolos.get(this.context).delete(this), this._removeSolo(), this;
  }
}
ne._allSolos = /* @__PURE__ */ new Map();
ne._soloed = /* @__PURE__ */ new Map();
class Po extends B {
  constructor() {
    const t = P(Po.getDefaults(), arguments, [
      "pan",
      "volume"
    ]);
    super(t), this.name = "PanVol", this._panner = this.input = new di({
      context: this.context,
      pan: t.pan,
      channelCount: t.channelCount
    }), this.pan = this._panner.pan, this._volume = this.output = new un({
      context: this.context,
      volume: t.volume
    }), this.volume = this._volume.volume, this._panner.connect(this._volume), this.mute = t.mute, ct(this, ["pan", "volume"]);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      mute: !1,
      pan: 0,
      volume: 0,
      channelCount: 1
    });
  }
  /**
   * Mute/unmute the volume
   */
  get mute() {
    return this._volume.mute;
  }
  set mute(t) {
    this._volume.mute = t;
  }
  dispose() {
    return super.dispose(), this._panner.dispose(), this.pan.dispose(), this._volume.dispose(), this.volume.dispose(), this;
  }
}
let ef = class Ai extends B {
  constructor() {
    const t = P(Ai.getDefaults(), arguments, [
      "volume",
      "pan"
    ]);
    super(t), this.name = "Channel", this._solo = this.input = new ne({
      solo: t.solo,
      context: this.context
    }), this._panVol = this.output = new Po({
      context: this.context,
      pan: t.pan,
      volume: t.volume,
      mute: t.mute,
      channelCount: t.channelCount
    }), this.pan = this._panVol.pan, this.volume = this._panVol.volume, this._solo.connect(this._panVol), ct(this, ["pan", "volume"]);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      pan: 0,
      volume: 0,
      mute: !1,
      solo: !1,
      channelCount: 1
    });
  }
  /**
   * Solo/unsolo the channel. Soloing is only relative to other {@link Channel}s and {@link Solo} instances
   */
  get solo() {
    return this._solo.solo;
  }
  set solo(t) {
    this._solo.solo = t;
  }
  /**
   * If the current instance is muted, i.e. another instance is soloed,
   * or the channel is muted
   */
  get muted() {
    return this._solo.muted || this.mute;
  }
  /**
   * Mute/unmute the volume
   */
  get mute() {
    return this._panVol.mute;
  }
  set mute(t) {
    this._panVol.mute = t;
  }
  /**
   * Get the gain node belonging to the bus name. Create it if
   * it doesn't exist
   * @param name The bus name
   */
  _getBus(t) {
    return Ai.buses.has(t) || Ai.buses.set(t, new nt({ context: this.context })), Ai.buses.get(t);
  }
  /**
   * Send audio to another channel using a string. `send` is a lot like
   * {@link connect}, except it uses a string instead of an object. This can
   * be useful in large applications to decouple sections since {@link send}
   * and {@link receive} can be invoked separately in order to connect an object
   * @param name The channel name to send the audio
   * @param volume The amount of the signal to send.
   * 	Defaults to 0db, i.e. send the entire signal
   * @returns Returns the gain node of this connection.
   */
  send(t, n = 0) {
    const s = this._getBus(t), i = new nt({
      context: this.context,
      units: "decibels",
      gain: n
    });
    return this.connect(i), i.connect(s), i;
  }
  /**
   * Receive audio from a channel which was connected with {@link send}.
   * @param name The channel name to receive audio from.
   */
  receive(t) {
    return this._getBus(t).connect(this), this;
  }
  dispose() {
    return super.dispose(), this._panVol.dispose(), this.pan.dispose(), this.volume.dispose(), this._solo.dispose(), this;
  }
};
ef.buses = /* @__PURE__ */ new Map();
class gl extends B {
  constructor() {
    super(P(gl.getDefaults(), arguments)), this.name = "Mono", this.input = new nt({ context: this.context }), this._merge = this.output = new rs({
      channels: 2,
      context: this.context
    }), this.input.connect(this._merge, 0, 0), this.input.connect(this._merge, 0, 1);
  }
  dispose() {
    return super.dispose(), this._merge.dispose(), this.input.dispose(), this;
  }
}
class hr extends B {
  constructor() {
    const t = P(hr.getDefaults(), arguments, ["lowFrequency", "highFrequency"]);
    super(t), this.name = "MultibandSplit", this.input = new nt({ context: this.context }), this.output = void 0, this.low = new Be({
      context: this.context,
      frequency: 0,
      type: "lowpass"
    }), this._lowMidFilter = new Be({
      context: this.context,
      frequency: 0,
      type: "highpass"
    }), this.mid = new Be({
      context: this.context,
      frequency: 0,
      type: "lowpass"
    }), this.high = new Be({
      context: this.context,
      frequency: 0,
      type: "highpass"
    }), this._internalChannels = [this.low, this.mid, this.high], this.lowFrequency = new dt({
      context: this.context,
      units: "frequency",
      value: t.lowFrequency
    }), this.highFrequency = new dt({
      context: this.context,
      units: "frequency",
      value: t.highFrequency
    }), this.Q = new dt({
      context: this.context,
      units: "positive",
      value: t.Q
    }), this.input.fan(this.low, this.high), this.input.chain(this._lowMidFilter, this.mid), this.lowFrequency.fan(this.low.frequency, this._lowMidFilter.frequency), this.highFrequency.fan(this.mid.frequency, this.high.frequency), this.Q.connect(this.low.Q), this.Q.connect(this._lowMidFilter.Q), this.Q.connect(this.mid.Q), this.Q.connect(this.high.Q), ct(this, ["high", "mid", "low", "highFrequency", "lowFrequency"]);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      Q: 1,
      highFrequency: 2500,
      lowFrequency: 400
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), Xi(this, ["high", "mid", "low", "highFrequency", "lowFrequency"]), this.low.dispose(), this._lowMidFilter.dispose(), this.mid.dispose(), this.high.dispose(), this.lowFrequency.dispose(), this.highFrequency.dispose(), this.Q.dispose(), this;
  }
}
class _l extends B {
  constructor() {
    const t = P(_l.getDefaults(), arguments, ["positionX", "positionY", "positionZ"]);
    super(t), this.name = "Panner3D", this._panner = this.input = this.output = this.context.createPanner(), this.panningModel = t.panningModel, this.maxDistance = t.maxDistance, this.distanceModel = t.distanceModel, this.coneOuterGain = t.coneOuterGain, this.coneOuterAngle = t.coneOuterAngle, this.coneInnerAngle = t.coneInnerAngle, this.refDistance = t.refDistance, this.rolloffFactor = t.rolloffFactor, this.positionX = new gt({
      context: this.context,
      param: this._panner.positionX,
      value: t.positionX
    }), this.positionY = new gt({
      context: this.context,
      param: this._panner.positionY,
      value: t.positionY
    }), this.positionZ = new gt({
      context: this.context,
      param: this._panner.positionZ,
      value: t.positionZ
    }), this.orientationX = new gt({
      context: this.context,
      param: this._panner.orientationX,
      value: t.orientationX
    }), this.orientationY = new gt({
      context: this.context,
      param: this._panner.orientationY,
      value: t.orientationY
    }), this.orientationZ = new gt({
      context: this.context,
      param: this._panner.orientationZ,
      value: t.orientationZ
    });
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      coneInnerAngle: 360,
      coneOuterAngle: 360,
      coneOuterGain: 0,
      distanceModel: "inverse",
      maxDistance: 1e4,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
      panningModel: "equalpower",
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      refDistance: 1,
      rolloffFactor: 1
    });
  }
  /**
   * Sets the position of the source in 3d space.
   */
  setPosition(t, n, s) {
    return this.positionX.value = t, this.positionY.value = n, this.positionZ.value = s, this;
  }
  /**
   * Sets the orientation of the source in 3d space.
   */
  setOrientation(t, n, s) {
    return this.orientationX.value = t, this.orientationY.value = n, this.orientationZ.value = s, this;
  }
  /**
   * The panning model. Either "equalpower" or "HRTF".
   */
  get panningModel() {
    return this._panner.panningModel;
  }
  set panningModel(t) {
    this._panner.panningModel = t;
  }
  /**
   * A reference distance for reducing volume as source move further from the listener
   */
  get refDistance() {
    return this._panner.refDistance;
  }
  set refDistance(t) {
    this._panner.refDistance = t;
  }
  /**
   * Describes how quickly the volume is reduced as source moves away from listener.
   */
  get rolloffFactor() {
    return this._panner.rolloffFactor;
  }
  set rolloffFactor(t) {
    this._panner.rolloffFactor = t;
  }
  /**
   * The distance model used by,  "linear", "inverse", or "exponential".
   */
  get distanceModel() {
    return this._panner.distanceModel;
  }
  set distanceModel(t) {
    this._panner.distanceModel = t;
  }
  /**
   * The angle, in degrees, inside of which there will be no volume reduction
   */
  get coneInnerAngle() {
    return this._panner.coneInnerAngle;
  }
  set coneInnerAngle(t) {
    this._panner.coneInnerAngle = t;
  }
  /**
   * The angle, in degrees, outside of which the volume will be reduced
   * to a constant value of coneOuterGain
   */
  get coneOuterAngle() {
    return this._panner.coneOuterAngle;
  }
  set coneOuterAngle(t) {
    this._panner.coneOuterAngle = t;
  }
  /**
   * The gain outside of the coneOuterAngle
   */
  get coneOuterGain() {
    return this._panner.coneOuterGain;
  }
  set coneOuterGain(t) {
    this._panner.coneOuterGain = t;
  }
  /**
   * The maximum distance between source and listener,
   * after which the volume will not be reduced any further.
   */
  get maxDistance() {
    return this._panner.maxDistance;
  }
  set maxDistance(t) {
    this._panner.maxDistance = t;
  }
  dispose() {
    return super.dispose(), this._panner.disconnect(), this.orientationX.dispose(), this.orientationY.dispose(), this.orientationZ.dispose(), this.positionX.dispose(), this.positionY.dispose(), this.positionZ.dispose(), this;
  }
}
class Ur extends B {
  constructor() {
    const t = P(Ur.getDefaults(), arguments);
    super(t), this.name = "Recorder", this.input = new nt({
      context: this.context
    }), st(Ur.supported, "Media Recorder API is not available"), this._stream = this.context.createMediaStreamDestination(), this.input.connect(this._stream), this._recorder = new MediaRecorder(this._stream.stream, {
      mimeType: t.mimeType
    });
  }
  static getDefaults() {
    return B.getDefaults();
  }
  /**
   * The mime type is the format that the audio is encoded in. For Chrome
   * that is typically webm encoded as "vorbis".
   */
  get mimeType() {
    return this._recorder.mimeType;
  }
  /**
   * Test if your platform supports the Media Recorder API. If it's not available,
   * try installing this (polyfill)[https://www.npmjs.com/package/audio-recorder-polyfill].
   */
  static get supported() {
    return De !== null && Reflect.has(De, "MediaRecorder");
  }
  /**
   * Get the playback state of the Recorder, either "started", "stopped" or "paused"
   */
  get state() {
    return this._recorder.state === "inactive" ? "stopped" : this._recorder.state === "paused" ? "paused" : "started";
  }
  /**
   * Start/Resume the Recorder. Returns a promise which resolves
   * when the recorder has started.
   */
  start() {
    return jt(this, void 0, void 0, function* () {
      st(this.state !== "started", "Recorder is already started");
      const t = new Promise((n) => {
        const s = () => {
          this._recorder.removeEventListener("start", s, !1), n();
        };
        this._recorder.addEventListener("start", s, !1);
      });
      return this.state === "stopped" ? this._recorder.start() : this._recorder.resume(), yield t;
    });
  }
  /**
   * Stop the recorder. Returns a promise with the recorded content until this point
   * encoded as {@link mimeType}
   */
  stop() {
    return jt(this, void 0, void 0, function* () {
      st(this.state !== "stopped", "Recorder is not started");
      const t = new Promise((n) => {
        const s = (i) => {
          this._recorder.removeEventListener("dataavailable", s, !1), n(i.data);
        };
        this._recorder.addEventListener("dataavailable", s, !1);
      });
      return this._recorder.stop(), yield t;
    });
  }
  /**
   * Pause the recorder
   */
  pause() {
    return st(this.state === "started", "Recorder must be started"), this._recorder.pause(), this;
  }
  dispose() {
    return super.dispose(), this.input.dispose(), this._stream.disconnect(), this;
  }
}
class yn extends B {
  constructor() {
    const t = P(yn.getDefaults(), arguments, ["threshold", "ratio"]);
    super(t), this.name = "Compressor", this._compressor = this.context.createDynamicsCompressor(), this.input = this._compressor, this.output = this._compressor, this.threshold = new gt({
      minValue: this._compressor.threshold.minValue,
      maxValue: this._compressor.threshold.maxValue,
      context: this.context,
      convert: !1,
      param: this._compressor.threshold,
      units: "decibels",
      value: t.threshold
    }), this.attack = new gt({
      minValue: this._compressor.attack.minValue,
      maxValue: this._compressor.attack.maxValue,
      context: this.context,
      param: this._compressor.attack,
      units: "time",
      value: t.attack
    }), this.release = new gt({
      minValue: this._compressor.release.minValue,
      maxValue: this._compressor.release.maxValue,
      context: this.context,
      param: this._compressor.release,
      units: "time",
      value: t.release
    }), this.knee = new gt({
      minValue: this._compressor.knee.minValue,
      maxValue: this._compressor.knee.maxValue,
      context: this.context,
      convert: !1,
      param: this._compressor.knee,
      units: "decibels",
      value: t.knee
    }), this.ratio = new gt({
      minValue: this._compressor.ratio.minValue,
      maxValue: this._compressor.ratio.maxValue,
      context: this.context,
      convert: !1,
      param: this._compressor.ratio,
      units: "positive",
      value: t.ratio
    }), ct(this, ["knee", "release", "attack", "ratio", "threshold"]);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      attack: 3e-3,
      knee: 30,
      ratio: 12,
      release: 0.25,
      threshold: -24
    });
  }
  /**
   * A read-only decibel value for metering purposes, representing the current amount of gain
   * reduction that the compressor is applying to the signal. If fed no signal the value will be 0 (no gain reduction).
   */
  get reduction() {
    return this._compressor.reduction;
  }
  dispose() {
    return super.dispose(), this._compressor.disconnect(), this.attack.dispose(), this.release.dispose(), this.threshold.dispose(), this.ratio.dispose(), this.knee.dispose(), this;
  }
}
class No extends B {
  constructor() {
    const t = P(No.getDefaults(), arguments, [
      "threshold",
      "smoothing"
    ]);
    super(t), this.name = "Gate", this._follower = new or({
      context: this.context,
      smoothing: t.smoothing
    }), this._gt = new vo({
      context: this.context,
      value: qs(t.threshold)
    }), this.input = new nt({ context: this.context }), this._gate = this.output = new nt({ context: this.context }), this.input.connect(this._gate), this.input.chain(this._follower, this._gt, this._gate.gain);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      smoothing: 0.1,
      threshold: -40
    });
  }
  /**
   * The threshold of the gate in decibels
   */
  get threshold() {
    return Ui(this._gt.value);
  }
  set threshold(t) {
    this._gt.value = qs(t);
  }
  /**
   * The attack/decay speed of the gate.
   * @see {@link Follower.smoothing}
   */
  get smoothing() {
    return this._follower.smoothing;
  }
  set smoothing(t) {
    this._follower.smoothing = t;
  }
  dispose() {
    return super.dispose(), this.input.dispose(), this._follower.dispose(), this._gt.dispose(), this._gate.dispose(), this;
  }
}
class Vo extends B {
  constructor() {
    const t = P(Vo.getDefaults(), arguments, [
      "threshold"
    ]);
    super(t), this.name = "Limiter", this._compressor = this.input = this.output = new yn({
      context: this.context,
      ratio: 20,
      attack: 3e-3,
      release: 0.01,
      threshold: t.threshold
    }), this.threshold = this._compressor.threshold, ct(this, "threshold");
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      threshold: -12
    });
  }
  /**
   * A read-only decibel value for metering purposes, representing the current amount of gain
   * reduction that the compressor is applying to the signal.
   */
  get reduction() {
    return this._compressor.reduction;
  }
  dispose() {
    return super.dispose(), this._compressor.dispose(), this.threshold.dispose(), this;
  }
}
class yl extends B {
  constructor() {
    const t = P(yl.getDefaults(), arguments);
    super(t), this.name = "MidSideCompressor", this._midSideSplit = this.input = new lr({
      context: this.context
    }), this._midSideMerge = this.output = new ur({
      context: this.context
    }), this.mid = new yn(Object.assign(t.mid, { context: this.context })), this.side = new yn(Object.assign(t.side, { context: this.context })), this._midSideSplit.mid.chain(this.mid, this._midSideMerge.mid), this._midSideSplit.side.chain(this.side, this._midSideMerge.side), ct(this, ["mid", "side"]);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      mid: {
        ratio: 3,
        threshold: -24,
        release: 0.03,
        attack: 0.02,
        knee: 16
      },
      side: {
        ratio: 6,
        threshold: -30,
        release: 0.25,
        attack: 0.03,
        knee: 10
      }
    });
  }
  dispose() {
    return super.dispose(), this.mid.dispose(), this.side.dispose(), this._midSideSplit.dispose(), this._midSideMerge.dispose(), this;
  }
}
class vl extends B {
  constructor() {
    const t = P(vl.getDefaults(), arguments);
    super(t), this.name = "MultibandCompressor", this._splitter = this.input = new hr({
      context: this.context,
      lowFrequency: t.lowFrequency,
      highFrequency: t.highFrequency
    }), this.lowFrequency = this._splitter.lowFrequency, this.highFrequency = this._splitter.highFrequency, this.output = new nt({ context: this.context }), this.low = new yn(Object.assign(t.low, { context: this.context })), this.mid = new yn(Object.assign(t.mid, { context: this.context })), this.high = new yn(Object.assign(t.high, { context: this.context })), this._splitter.low.chain(this.low, this.output), this._splitter.mid.chain(this.mid, this.output), this._splitter.high.chain(this.high, this.output), ct(this, ["high", "mid", "low", "highFrequency", "lowFrequency"]);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      lowFrequency: 250,
      highFrequency: 2e3,
      low: {
        ratio: 6,
        threshold: -30,
        release: 0.25,
        attack: 0.03,
        knee: 10
      },
      mid: {
        ratio: 3,
        threshold: -24,
        release: 0.03,
        attack: 0.02,
        knee: 16
      },
      high: {
        ratio: 3,
        threshold: -24,
        release: 0.03,
        attack: 0.02,
        knee: 16
      }
    });
  }
  dispose() {
    return super.dispose(), this._splitter.dispose(), this.low.dispose(), this.mid.dispose(), this.high.dispose(), this.output.dispose(), this;
  }
}
class Wo extends B {
  constructor() {
    const t = P(Wo.getDefaults(), arguments, [
      "low",
      "mid",
      "high"
    ]);
    super(t), this.name = "EQ3", this.output = new nt({ context: this.context }), this._internalChannels = [], this.input = this._multibandSplit = new hr({
      context: this.context,
      highFrequency: t.highFrequency,
      lowFrequency: t.lowFrequency
    }), this._lowGain = new nt({
      context: this.context,
      gain: t.low,
      units: "decibels"
    }), this._midGain = new nt({
      context: this.context,
      gain: t.mid,
      units: "decibels"
    }), this._highGain = new nt({
      context: this.context,
      gain: t.high,
      units: "decibels"
    }), this.low = this._lowGain.gain, this.mid = this._midGain.gain, this.high = this._highGain.gain, this.Q = this._multibandSplit.Q, this.lowFrequency = this._multibandSplit.lowFrequency, this.highFrequency = this._multibandSplit.highFrequency, this._multibandSplit.low.chain(this._lowGain, this.output), this._multibandSplit.mid.chain(this._midGain, this.output), this._multibandSplit.high.chain(this._highGain, this.output), ct(this, ["low", "mid", "high", "lowFrequency", "highFrequency"]), this._internalChannels = [this._multibandSplit];
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      high: 0,
      highFrequency: 2500,
      low: 0,
      lowFrequency: 400,
      mid: 0
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), Xi(this, ["low", "mid", "high", "lowFrequency", "highFrequency"]), this._multibandSplit.dispose(), this.lowFrequency.dispose(), this.highFrequency.dispose(), this._lowGain.dispose(), this._midGain.dispose(), this._highGain.dispose(), this.low.dispose(), this.mid.dispose(), this.high.dispose(), this.Q.dispose(), this;
  }
}
class bl extends B {
  constructor() {
    const t = P(bl.getDefaults(), arguments, ["url", "onload"]);
    super(t), this.name = "Convolver", this._convolver = this.context.createConvolver(), this._buffer = new Rt(t.url, (n) => {
      this.buffer = n, t.onload();
    }), this.input = new nt({ context: this.context }), this.output = new nt({ context: this.context }), this._buffer.loaded && (this.buffer = this._buffer), this.normalize = t.normalize, this.input.chain(this._convolver, this.output);
  }
  static getDefaults() {
    return Object.assign(B.getDefaults(), {
      normalize: !0,
      onload: St
    });
  }
  /**
   * Load an impulse response url as an audio buffer.
   * Decodes the audio asynchronously and invokes
   * the callback once the audio buffer loads.
   * @param url The url of the buffer to load. filetype support depends on the browser.
   */
  load(t) {
    return jt(this, void 0, void 0, function* () {
      this.buffer = yield this._buffer.load(t);
    });
  }
  /**
   * The convolver's buffer
   */
  get buffer() {
    return this._buffer.length ? this._buffer : null;
  }
  set buffer(t) {
    t && this._buffer.set(t), this._convolver.buffer && (this.input.disconnect(), this._convolver.disconnect(), this._convolver = this.context.createConvolver(), this.input.chain(this._convolver, this.output));
    const n = this._buffer.get();
    this._convolver.buffer = n || null;
  }
  /**
   * The normalize property of the ConvolverNode interface is a boolean that
   * controls whether the impulse response from the buffer will be scaled by
   * an equal-power normalization when the buffer attribute is set, or not.
   */
  get normalize() {
    return this._convolver.normalize;
  }
  set normalize(t) {
    this._convolver.normalize = t;
  }
  dispose() {
    return super.dispose(), this._buffer.dispose(), this._convolver.disconnect(), this;
  }
}
function fs() {
  return It().now();
}
function rb() {
  return It().immediate();
}
const ob = It().transport;
function us() {
  return It().transport;
}
const ab = It().destination, cb = It().destination;
function xl() {
  return It().destination;
}
const lb = It().listener;
function ub() {
  return It().listener;
}
const hb = It().draw;
function db() {
  return It().draw;
}
const fb = It();
function pb() {
  return Rt.loaded();
}
const mb = Rt, gb = oi, _b = is, nf = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AMOscillator: Qi,
  AMSynth: Jc,
  Abs: Ud,
  Add: Cs,
  AmplitudeEnvelope: ui,
  Analyser: os,
  AudioToGain: go,
  AutoFilter: xo,
  AutoPanner: wo,
  AutoWah: ar,
  BaseContext: Lc,
  BiquadFilter: Pi,
  BitCrusher: Co,
  Buffer: mb,
  BufferSource: _b,
  Buffers: gb,
  Channel: ef,
  Chebyshev: So,
  Chorus: To,
  Clock: ri,
  Compressor: yn,
  Context: ni,
  Convolver: bl,
  CrossFade: hi,
  DCMeter: ml,
  Delay: qe,
  Destination: ab,
  Distortion: Ao,
  Draw: hb,
  DuoSynth: tl,
  EQ3: Wo,
  Emitter: ei,
  Envelope: ye,
  FFT: pl,
  FMOscillator: ci,
  FMSynth: el,
  FatOscillator: Ji,
  FeedbackCombFilter: nr,
  FeedbackDelay: ko,
  Filter: Be,
  Follower: or,
  Freeverb: Io,
  Frequency: D0,
  FrequencyClass: Oe,
  FrequencyEnvelope: Ni,
  FrequencyShifter: hl,
  Gain: nt,
  GainToAudio: Hd,
  Gate: No,
  GrainPlayer: Kc,
  GreaterThan: vo,
  GreaterThanZero: yo,
  IntervalTimeline: Yd,
  JCReverb: Eo,
  LFO: Me,
  Limiter: Vo,
  Listener: lb,
  Loop: Vi,
  LowpassCombFilter: ir,
  Master: cb,
  MembraneSynth: er,
  Merge: rs,
  MetalSynth: nl,
  Meter: fl,
  MidSideCompressor: yl,
  MidSideMerge: ur,
  MidSideSplit: lr,
  Midi: P0,
  MidiClass: Zs,
  Mono: gl,
  MonoSynth: ds,
  MultibandCompressor: vl,
  MultibandSplit: hr,
  Multiply: Ut,
  Negate: Qc,
  Noise: Hn,
  NoiseSynth: sl,
  Offline: F0,
  OfflineContext: si,
  OmniOscillator: On,
  OnePoleFilter: sr,
  Oscillator: Xt,
  PWMOscillator: tr,
  PanVol: Po,
  Panner: di,
  Panner3D: _l,
  Param: gt,
  Part: Wi,
  Pattern: cl,
  Phaser: Ro,
  PingPongDelay: Do,
  PitchShift: dl,
  Player: Ss,
  Players: Hc,
  PluckSynth: ol,
  PolySynth: al,
  Pow: ai,
  PulseOscillator: li,
  Recorder: Ur,
  Reverb: cr,
  Sampler: rr,
  Scale: Mn,
  ScaleExp: bo,
  Sequence: ll,
  Signal: dt,
  Solo: ne,
  Split: As,
  StateTimeline: ii,
  StereoWidener: Oo,
  Subtract: Ts,
  SyncedSignal: B0,
  Synth: Kn,
  Ticks: N0,
  TicksClass: Yt,
  Time: k0,
  TimeClass: Le,
  Timeline: $e,
  ToneAudioBuffer: Rt,
  ToneAudioBuffers: oi,
  ToneAudioNode: B,
  ToneBufferSource: is,
  ToneEvent: mn,
  ToneOscillatorNode: Ki,
  Transport: ob,
  TransportTime: R0,
  TransportTimeClass: re,
  Tremolo: Mo,
  Unit: j0,
  UserMedia: Ii,
  Vibrato: Fo,
  Volume: un,
  WaveShaper: hn,
  Waveform: ib,
  Zero: _o,
  connect: Fe,
  connectSeries: Ge,
  connectSignal: Hi,
  context: fb,
  dbToGain: qs,
  debug: d0,
  defaultArg: Je,
  disconnect: zc,
  fanIn: O0,
  ftom: Zn,
  gainToDb: Ui,
  getContext: It,
  getDestination: xl,
  getDraw: db,
  getListener: ub,
  getTransport: us,
  immediate: rb,
  intervalToFrequencyRatio: zs,
  isArray: _e,
  isBoolean: Nc,
  isDefined: bt,
  isFunction: jd,
  isNote: Ti,
  isNumber: ze,
  isObject: Dn,
  isString: an,
  isUndef: We,
  loaded: pb,
  mtof: $c,
  now: fs,
  optionsFromArguments: P,
  setContext: Mi,
  start: Bc,
  supported: u0,
  version: _c
}, Symbol.toStringTag, { value: "Module" }));
var pe = {}, ls = {}, vu;
function yb() {
  if (vu) return ls;
  vu = 1, Object.defineProperty(ls, "__esModule", {
    value: !0
  }), ls.linear = e, ls.exponential = t, ls.sCurve = n, ls.logarithmic = s;
  function e(i, r) {
    var o = new Float32Array(i), a, c, l = i - 1;
    for (a = 0; a < i; a++)
      c = a / l, r > 0 ? o[a] = c : o[a] = 1 - c;
    return o;
  }
  function t(i, r) {
    var o = new Float32Array(i), a, c, l = i - 1, u;
    for (a = 0; a < i; a++)
      c = a / l, u = r > 0 ? a : i - 1 - a, o[u] = Math.exp(2 * c - 1) / Math.exp(1);
    return o;
  }
  function n(i, r) {
    var o = new Float32Array(i), a, c = r > 0 ? Math.PI / 2 : -(Math.PI / 2);
    for (a = 0; a < i; ++a)
      o[a] = Math.sin(Math.PI * a / i - c) / 2 + 0.5;
    return o;
  }
  function s(i, r, o) {
    var a = new Float32Array(i), c, l = 0, u;
    for (u = 0; u < i; u++)
      c = o > 0 ? u : i - 1 - u, l = u / i, a[c] = Math.log(1 + r * l) / Math.log(1 + r);
    return a;
  }
  return ls;
}
var bu;
function vb() {
  if (bu) return pe;
  bu = 1, Object.defineProperty(pe, "__esModule", {
    value: !0
  }), pe.FADEOUT = pe.FADEIN = pe.LOGARITHMIC = pe.EXPONENTIAL = pe.LINEAR = pe.SCURVE = void 0, pe.createFadeIn = p, pe.createFadeOut = f;
  var e = yb(), t = pe.SCURVE = "sCurve", n = pe.LINEAR = "linear", s = pe.EXPONENTIAL = "exponential", i = pe.LOGARITHMIC = "logarithmic";
  pe.FADEIN = "FadeIn", pe.FADEOUT = "FadeOut";
  function r(_, m) {
    var g = (0, e.sCurve)(1e4, 1);
    this.setValueCurveAtTime(g, _, m);
  }
  function o(_, m) {
    var g = (0, e.sCurve)(1e4, -1);
    this.setValueCurveAtTime(g, _, m);
  }
  function a(_, m) {
    this.linearRampToValueAtTime(0, _), this.linearRampToValueAtTime(1, _ + m);
  }
  function c(_, m) {
    this.linearRampToValueAtTime(1, _), this.linearRampToValueAtTime(0, _ + m);
  }
  function l(_, m) {
    this.exponentialRampToValueAtTime(0.01, _), this.exponentialRampToValueAtTime(1, _ + m);
  }
  function u(_, m) {
    this.exponentialRampToValueAtTime(1, _), this.exponentialRampToValueAtTime(0.01, _ + m);
  }
  function h(_, m) {
    var g = (0, e.logarithmic)(1e4, 10, 1);
    this.setValueCurveAtTime(g, _, m);
  }
  function d(_, m) {
    var g = (0, e.logarithmic)(1e4, 10, -1);
    this.setValueCurveAtTime(g, _, m);
  }
  function p(_, m, g, b) {
    switch (m) {
      case t:
        r.call(_, g, b);
        break;
      case n:
        a.call(_, g, b);
        break;
      case s:
        l.call(_, g, b);
        break;
      case i:
        h.call(_, g, b);
        break;
      default:
        throw new Error("Unsupported Fade type");
    }
  }
  function f(_, m, g, b) {
    switch (m) {
      case t:
        o.call(_, g, b);
        break;
      case n:
        c.call(_, g, b);
        break;
      case s:
        u.call(_, g, b);
        break;
      case i:
        d.call(_, g, b);
        break;
      default:
        throw new Error("Unsupported Fade type");
    }
  }
  return pe;
}
var xu = vb(), oa = null;
function Ys() {
  return oa || (oa = new AudioContext()), oa;
}
async function Mr() {
  const e = Ys();
  e.state !== "running" && await e.resume();
}
var bb = class {
  // Count of currently playing clips
  constructor(e) {
    this.activePlayers = 0, this.track = e.track, this.volumeNode = new un(this.gainToDb(e.track.gain)), this.panNode = new di(e.track.stereoPan), this.muteGain = new nt(e.track.muted ? 0 : 1);
    const t = e.destination || xl();
    if (e.effects) {
      const s = e.effects(this.muteGain, t, !1);
      s && (this.effectsCleanup = s);
    } else
      this.muteGain.connect(t);
    const n = e.clips || (e.buffer ? [{
      buffer: e.buffer,
      startTime: 0,
      // Legacy: single buffer starts at timeline position 0
      duration: e.buffer.duration,
      // Legacy: play full buffer duration
      offset: 0,
      fadeIn: e.track.fadeIn,
      fadeOut: e.track.fadeOut,
      gain: 1
    }] : []);
    this.clips = n.map((s) => {
      const i = new Ss({
        url: s.buffer,
        loop: !1,
        onstop: () => {
          this.activePlayers--, this.activePlayers === 0 && this.onStopCallback && this.onStopCallback();
        }
      }), r = new nt(s.gain);
      if (i.connect(r), r.chain(this.volumeNode, this.panNode, this.muteGain), s.fadeIn) {
        const o = r.gain._param;
        xu.createFadeIn(
          o,
          s.fadeIn.type,
          s.fadeIn.start,
          s.fadeIn.end - s.fadeIn.start
        );
      }
      if (s.fadeOut) {
        const o = r.gain._param;
        xu.createFadeOut(
          o,
          s.fadeOut.type,
          s.fadeOut.start,
          s.fadeOut.end - s.fadeOut.start
        );
      }
      return {
        player: i,
        clipInfo: s,
        fadeGain: r,
        pausedPosition: 0,
        playStartTime: 0
      };
    });
  }
  gainToDb(e) {
    return 20 * Math.log10(e);
  }
  setVolume(e) {
    this.track.gain = e, this.volumeNode.volume.value = this.gainToDb(e);
  }
  setPan(e) {
    this.track.stereoPan = e, this.panNode.pan.value = e;
  }
  setMute(e) {
    this.track.muted = e, this.muteGain.gain.value = e ? 0 : 1;
  }
  setSolo(e) {
    this.track.soloed = e;
  }
  play(e = fs(), t = 0, n) {
    this.isPlaying || (this.activePlayers = 0, this.clips.forEach((s) => {
      const { player: i, clipInfo: r } = s, o = t, a = r.startTime, c = r.startTime + r.duration;
      if ((isNaN(e) || isNaN(o) || isNaN(a) || isNaN(r.offset) || isNaN(r.duration)) && console.error("NaN detected in ToneTrack.play:", {
        when: e,
        offset: t,
        duration: n,
        playbackPosition: o,
        clipStart: a,
        clipEnd: c,
        clipInfo: r
      }), o < c)
        if (this.activePlayers++, s.playStartTime = fs(), o >= a) {
          const l = o - a + r.offset, u = r.duration - (o - a), h = n ? Math.min(n, u) : u;
          s.pausedPosition = l, i.start(e, l, h);
        } else {
          const l = a - o, u = n ? Math.min(n - l, r.duration) : r.duration;
          l < (n ?? 1 / 0) ? (s.pausedPosition = r.offset, i.start(e + l, r.offset, u)) : this.activePlayers--;
        }
    }));
  }
  pause() {
    this.isPlaying && (this.clips.forEach((e) => {
      if (e.player.state === "started") {
        const t = (fs() - e.playStartTime) * e.player.playbackRate;
        e.pausedPosition = e.pausedPosition + t, e.player.stop();
      }
    }), this.activePlayers = 0);
  }
  stop(e = fs()) {
    this.clips.forEach((t) => {
      t.player.stop(e), t.pausedPosition = 0;
    }), this.activePlayers = 0;
  }
  dispose() {
    this.effectsCleanup && this.effectsCleanup(), this.clips.forEach((e) => {
      e.player.dispose(), e.fadeGain.dispose();
    }), this.volumeNode.dispose(), this.panNode.dispose(), this.muteGain.dispose();
  }
  get id() {
    return this.track.id;
  }
  get duration() {
    if (this.clips.length === 0) return 0;
    const e = this.clips[this.clips.length - 1];
    return e.clipInfo.startTime + e.clipInfo.duration;
  }
  get buffer() {
    return this.clips[0]?.clipInfo.buffer;
  }
  get isPlaying() {
    return this.clips.some((e) => e.player.state === "started");
  }
  get muted() {
    return this.track.muted;
  }
  get startTime() {
    return this.track.startTime;
  }
  setOnStopCallback(e) {
    this.onStopCallback = e;
  }
}, sf = class {
  constructor(e = {}) {
    if (this.tracks = /* @__PURE__ */ new Map(), this.isInitialized = !1, this.soloedTracks = /* @__PURE__ */ new Set(), this.manualMuteState = /* @__PURE__ */ new Map(), this.activeTracks = /* @__PURE__ */ new Map(), this.playbackSessionId = 0, this.masterVolume = new un(this.gainToDb(e.masterGain ?? 1)), e.effects) {
      const t = e.effects(this.masterVolume, xl(), !1);
      t && (this.effectsCleanup = t);
    } else
      this.masterVolume.toDestination();
    e.tracks && e.tracks.forEach((t) => {
      this.tracks.set(t.id, t), this.manualMuteState.set(t.id, t.muted);
    });
  }
  gainToDb(e) {
    return 20 * Math.log10(e);
  }
  async init() {
    this.isInitialized || (await Bc(), this.isInitialized = !0);
  }
  addTrack(e) {
    const t = {
      ...e,
      destination: this.masterVolume
    }, n = new bb(t);
    return this.tracks.set(n.id, n), this.manualMuteState.set(n.id, e.track.muted ?? !1), n;
  }
  removeTrack(e) {
    const t = this.tracks.get(e);
    t && (t.dispose(), this.tracks.delete(e), this.manualMuteState.delete(e), this.soloedTracks.delete(e));
  }
  getTrack(e) {
    return this.tracks.get(e);
  }
  play(e = fs(), t, n) {
    if (!this.isInitialized) {
      console.warn("TonePlayout not initialized. Call init() first.");
      return;
    }
    const s = t ?? 0;
    this.playbackSessionId++;
    const i = this.playbackSessionId;
    this.activeTracks.clear(), this.tracks.forEach((r) => {
      const o = r.startTime;
      if (s >= o) {
        const a = s - o;
        n !== void 0 && (this.activeTracks.set(r.id, i), r.setOnStopCallback(() => {
          this.activeTracks.get(r.id) === i && (this.activeTracks.delete(r.id), this.activeTracks.size === 0 && this.onPlaybackCompleteCallback && this.onPlaybackCompleteCallback());
        })), r.play(e, a, n);
      } else {
        const a = o - s;
        n !== void 0 && (this.activeTracks.set(r.id, i), r.setOnStopCallback(() => {
          this.activeTracks.get(r.id) === i && (this.activeTracks.delete(r.id), this.activeTracks.size === 0 && this.onPlaybackCompleteCallback && this.onPlaybackCompleteCallback());
        })), r.play(e + a, 0, n);
      }
    }), t !== void 0 ? us().start(e, t) : us().start(e);
  }
  pause() {
    us().pause(), this.tracks.forEach((e) => {
      e.pause();
    });
  }
  stop() {
    us().stop(), this.tracks.forEach((e) => {
      e.stop();
    });
  }
  setMasterGain(e) {
    this.masterVolume.volume.value = this.gainToDb(e);
  }
  setSolo(e, t) {
    const n = this.tracks.get(e);
    n && (n.setSolo(t), t ? this.soloedTracks.add(e) : this.soloedTracks.delete(e), this.updateSoloMuting());
  }
  updateSoloMuting() {
    const e = this.soloedTracks.size > 0;
    this.tracks.forEach((t, n) => {
      if (e)
        if (!this.soloedTracks.has(n))
          t.setMute(!0);
        else {
          const s = this.manualMuteState.get(n) ?? !1;
          t.setMute(s);
        }
      else {
        const s = this.manualMuteState.get(n) ?? !1;
        t.setMute(s);
      }
    });
  }
  setMute(e, t) {
    const n = this.tracks.get(e);
    n && (this.manualMuteState.set(e, t), n.setMute(t));
  }
  getCurrentTime() {
    return us().seconds;
  }
  seekTo(e) {
    us().seconds = e;
  }
  dispose() {
    this.tracks.forEach((e) => {
      e.dispose();
    }), this.tracks.clear(), this.effectsCleanup && this.effectsCleanup(), this.masterVolume.dispose();
  }
  get context() {
    return It();
  }
  get sampleRate() {
    return It().sampleRate;
  }
  setOnPlaybackComplete(e) {
    this.onPlaybackCompleteCallback = e;
  }
}, Sr = /* @__PURE__ */ new Map(), wu = /* @__PURE__ */ new Map();
function rf(e) {
  if (Sr.has(e))
    return Sr.get(e);
  const n = Ys().createMediaStreamSource(e);
  Sr.set(e, n);
  const s = () => {
    n.disconnect(), Sr.delete(e), wu.delete(e), e.removeEventListener("ended", s), e.removeEventListener("inactive", s);
  };
  return wu.set(e, s), e.addEventListener("ended", s), e.addEventListener("inactive", s), n;
}
Mi(Ys());
var aa = { exports: {} }, Cu;
function xb() {
  return Cu || (Cu = 1, (function(e) {
    var t = Object.prototype.hasOwnProperty, n = "~";
    function s() {
    }
    Object.create && (s.prototype = /* @__PURE__ */ Object.create(null), new s().__proto__ || (n = !1));
    function i(c, l, u) {
      this.fn = c, this.context = l, this.once = u || !1;
    }
    function r(c, l, u, h, d) {
      if (typeof u != "function")
        throw new TypeError("The listener must be a function");
      var p = new i(u, h || c, d), f = n ? n + l : l;
      return c._events[f] ? c._events[f].fn ? c._events[f] = [c._events[f], p] : c._events[f].push(p) : (c._events[f] = p, c._eventsCount++), c;
    }
    function o(c, l) {
      --c._eventsCount === 0 ? c._events = new s() : delete c._events[l];
    }
    function a() {
      this._events = new s(), this._eventsCount = 0;
    }
    a.prototype.eventNames = function() {
      var l = [], u, h;
      if (this._eventsCount === 0) return l;
      for (h in u = this._events)
        t.call(u, h) && l.push(n ? h.slice(1) : h);
      return Object.getOwnPropertySymbols ? l.concat(Object.getOwnPropertySymbols(u)) : l;
    }, a.prototype.listeners = function(l) {
      var u = n ? n + l : l, h = this._events[u];
      if (!h) return [];
      if (h.fn) return [h.fn];
      for (var d = 0, p = h.length, f = new Array(p); d < p; d++)
        f[d] = h[d].fn;
      return f;
    }, a.prototype.listenerCount = function(l) {
      var u = n ? n + l : l, h = this._events[u];
      return h ? h.fn ? 1 : h.length : 0;
    }, a.prototype.emit = function(l, u, h, d, p, f) {
      var _ = n ? n + l : l;
      if (!this._events[_]) return !1;
      var m = this._events[_], g = arguments.length, b, v;
      if (m.fn) {
        switch (m.once && this.removeListener(l, m.fn, void 0, !0), g) {
          case 1:
            return m.fn.call(m.context), !0;
          case 2:
            return m.fn.call(m.context, u), !0;
          case 3:
            return m.fn.call(m.context, u, h), !0;
          case 4:
            return m.fn.call(m.context, u, h, d), !0;
          case 5:
            return m.fn.call(m.context, u, h, d, p), !0;
          case 6:
            return m.fn.call(m.context, u, h, d, p, f), !0;
        }
        for (v = 1, b = new Array(g - 1); v < g; v++)
          b[v - 1] = arguments[v];
        m.fn.apply(m.context, b);
      } else {
        var x = m.length, y;
        for (v = 0; v < x; v++)
          switch (m[v].once && this.removeListener(l, m[v].fn, void 0, !0), g) {
            case 1:
              m[v].fn.call(m[v].context);
              break;
            case 2:
              m[v].fn.call(m[v].context, u);
              break;
            case 3:
              m[v].fn.call(m[v].context, u, h);
              break;
            case 4:
              m[v].fn.call(m[v].context, u, h, d);
              break;
            default:
              if (!b) for (y = 1, b = new Array(g - 1); y < g; y++)
                b[y - 1] = arguments[y];
              m[v].fn.apply(m[v].context, b);
          }
      }
      return !0;
    }, a.prototype.on = function(l, u, h) {
      return r(this, l, u, h, !1);
    }, a.prototype.once = function(l, u, h) {
      return r(this, l, u, h, !0);
    }, a.prototype.removeListener = function(l, u, h, d) {
      var p = n ? n + l : l;
      if (!this._events[p]) return this;
      if (!u)
        return o(this, p), this;
      var f = this._events[p];
      if (f.fn)
        f.fn === u && (!d || f.once) && (!h || f.context === h) && o(this, p);
      else {
        for (var _ = 0, m = [], g = f.length; _ < g; _++)
          (f[_].fn !== u || d && !f[_].once || h && f[_].context !== h) && m.push(f[_]);
        m.length ? this._events[p] = m.length === 1 ? m[0] : m : o(this, p);
      }
      return this;
    }, a.prototype.removeAllListeners = function(l) {
      var u;
      return l ? (u = n ? n + l : l, this._events[u] && o(this, u)) : (this._events = new s(), this._eventsCount = 0), this;
    }, a.prototype.off = a.prototype.removeListener, a.prototype.addListener = a.prototype.on, a.prefixed = n, a.EventEmitter = a, e.exports = a;
  })(aa)), aa.exports;
}
var wb = xb();
const Cb = /* @__PURE__ */ Zh(wb);
var of = class extends Cb {
  constructor(e, t) {
    super(), this.src = e, this.ac = t, this.audioRequestState = "uninitialized";
  }
  setStateChange(e) {
    this.audioRequestState = e, this.emit("audiorequeststatechange", this.audioRequestState, this.src);
  }
  fileProgress(e) {
    let t = 0;
    this.audioRequestState === "uninitialized" && this.setStateChange(
      "loading"
      /* LOADING */
    ), e.lengthComputable && (t = e.loaded / e.total * 100), this.emit("loadprogress", t, this.src);
  }
  async fileLoad(e) {
    this.setStateChange(
      "decoding"
      /* DECODING */
    );
    try {
      const t = await this.ac.decodeAudioData(e);
      return this.audioBuffer = t, this.setStateChange(
        "finished"
        /* FINISHED */
      ), t;
    } catch (t) {
      this.setStateChange(
        "error"
        /* ERROR */
      );
      const n = t instanceof Error ? t : new Error("Failed to decode audio data");
      throw this.emit("error", n), n;
    }
  }
  getState() {
    return this.audioRequestState;
  }
  getAudioBuffer() {
    return this.audioBuffer;
  }
}, Sb = class extends of {
  constructor(e, t) {
    super(e, t), this.url = e;
  }
  async load() {
    return new Promise((e, t) => {
      const n = new XMLHttpRequest();
      n.open("GET", this.url, !0), n.responseType = "arraybuffer", n.addEventListener("progress", (s) => {
        this.fileProgress(s);
      }), n.addEventListener("load", async (s) => {
        const i = s.target;
        if (i.status >= 200 && i.status < 300)
          try {
            const r = await this.fileLoad(i.response);
            e(r);
          } catch (r) {
            t(r);
          }
        else {
          const r = new Error(`HTTP ${i.status}: ${i.statusText}`);
          this.emit("error", r), t(r);
        }
      }), n.addEventListener("error", () => {
        const s = new Error("Network error while loading audio file");
        this.emit("error", s), t(s);
      }), n.addEventListener("abort", () => {
        const s = new Error("Audio file loading was aborted");
        this.emit("error", s), t(s);
      }), n.send();
    });
  }
}, Tb = class extends of {
  constructor(e, t) {
    super(e, t), this.blob = e;
  }
  async load() {
    return new Promise((e, t) => {
      if (this.blob.type.match(/audio.*/) || // Added for problems with Firefox mime types + ogg
      this.blob.type.match(/video\/ogg/)) {
        const n = new FileReader();
        n.addEventListener("progress", (s) => {
          this.fileProgress(s);
        }), n.addEventListener("load", async () => {
          try {
            const s = await this.fileLoad(n.result);
            e(s);
          } catch (s) {
            t(s);
          }
        }), n.addEventListener("error", () => {
          const s = new Error("Failed to read audio file");
          this.emit("error", s), t(s);
        }), n.readAsArrayBuffer(this.blob);
      } else {
        const n = new Error(`Unsupported file type: ${this.blob.type}`);
        this.emit("error", n), t(n);
      }
    });
  }
}, Su = class {
  static createLoader(e, t) {
    if (typeof e == "string")
      return new Sb(e, t);
    if (e instanceof Blob)
      return new Tb(e, t);
    throw new Error("Invalid audio source. Must be a URL string or Blob.");
  }
};
const Ab = typeof window < "u" && typeof window.document < "u" && typeof window.document.createElement < "u";
function wl(e) {
  const t = Object.prototype.toString.call(e);
  return t === "[object Window]" || // In Electron context the Window object serializes to [object global]
  t === "[object global]";
}
function af(e) {
  return "nodeType" in e;
}
function fi(e) {
  var t, n;
  return e ? wl(e) ? e : af(e) && (t = (n = e.ownerDocument) == null ? void 0 : n.defaultView) != null ? t : window : window;
}
function kb(e) {
  const {
    Document: t
  } = fi(e);
  return e instanceof t;
}
function Ib(e) {
  return wl(e) ? !1 : e instanceof fi(e).HTMLElement;
}
function Eb(e) {
  return e instanceof fi(e).SVGElement;
}
function jo(e) {
  return e ? wl(e) ? e.document : af(e) ? kb(e) ? e : Ib(e) || Eb(e) ? e.ownerDocument : document : document : document;
}
const Lo = Ab ? qh : Ht;
function Db(e) {
  const t = xt(e);
  return Lo(() => {
    t.current = e;
  }), rt(function() {
    for (var n = arguments.length, s = new Array(n), i = 0; i < n; i++)
      s[i] = arguments[i];
    return t.current == null ? void 0 : t.current(...s);
  }, []);
}
function cf(e, t) {
  t === void 0 && (t = [e]);
  const n = xt(e);
  return Lo(() => {
    n.current !== e && (n.current = e);
  }, t), n;
}
function Hr(e) {
  const t = Db(e), n = xt(null), s = rt(
    (i) => {
      i !== n.current && t?.(i, n.current), n.current = i;
    },
    //eslint-disable-next-line
    []
  );
  return [n, s];
}
let ca = {};
function lf(e, t) {
  return Rn(() => {
    const n = ca[e] == null ? 0 : ca[e] + 1;
    return ca[e] = n, e + "-" + n;
  }, [e, t]);
}
function Rb(e) {
  return function(t) {
    for (var n = arguments.length, s = new Array(n > 1 ? n - 1 : 0), i = 1; i < n; i++)
      s[i - 1] = arguments[i];
    return s.reduce((r, o) => {
      const a = Object.entries(o);
      for (const [c, l] of a) {
        const u = r[c];
        u != null && (r[c] = u + e * l);
      }
      return r;
    }, {
      ...t
    });
  };
}
const Ob = /* @__PURE__ */ Rb(-1);
function Mb(e) {
  return "clientX" in e && "clientY" in e;
}
function Fb(e) {
  if (!e)
    return !1;
  const {
    TouchEvent: t
  } = fi(e.target);
  return t && e instanceof t;
}
function Tu(e) {
  if (Fb(e)) {
    if (e.touches && e.touches.length) {
      const {
        clientX: t,
        clientY: n
      } = e.touches[0];
      return {
        x: t,
        y: n
      };
    } else if (e.changedTouches && e.changedTouches.length) {
      const {
        clientX: t,
        clientY: n
      } = e.changedTouches[0];
      return {
        x: t,
        y: n
      };
    }
  }
  return Mb(e) ? {
    x: e.clientX,
    y: e.clientY
  } : null;
}
const La = /* @__PURE__ */ Object.freeze({
  Translate: {
    toString(e) {
      if (!e)
        return;
      const {
        x: t,
        y: n
      } = e;
      return "translate3d(" + (t ? Math.round(t) : 0) + "px, " + (n ? Math.round(n) : 0) + "px, 0)";
    }
  },
  Scale: {
    toString(e) {
      if (!e)
        return;
      const {
        scaleX: t,
        scaleY: n
      } = e;
      return "scaleX(" + t + ") scaleY(" + n + ")";
    }
  },
  Transform: {
    toString(e) {
      if (e)
        return [La.Translate.toString(e), La.Scale.toString(e)].join(" ");
    }
  },
  Transition: {
    toString(e) {
      let {
        property: t,
        duration: n,
        easing: s
      } = e;
      return t + " " + n + "ms " + s;
    }
  }
});
var Au;
(function(e) {
  e.DragStart = "dragStart", e.DragMove = "dragMove", e.DragEnd = "dragEnd", e.DragCancel = "dragCancel", e.DragOver = "dragOver", e.RegisterDroppable = "registerDroppable", e.SetDroppableDisabled = "setDroppableDisabled", e.UnregisterDroppable = "unregisterDroppable";
})(Au || (Au = {}));
function ku() {
}
function Pb(e, t) {
  return Rn(
    () => ({
      sensor: e,
      options: t ?? {}
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [e, t]
  );
}
function Nb() {
  for (var e = arguments.length, t = new Array(e), n = 0; n < e; n++)
    t[n] = arguments[n];
  return Rn(
    () => [...t].filter((s) => s != null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...t]
  );
}
const Ba = /* @__PURE__ */ Object.freeze({
  x: 0,
  y: 0
});
var Ps;
(function(e) {
  e[e.Forward = 1] = "Forward", e[e.Backward = -1] = "Backward";
})(Ps || (Ps = {}));
class la {
  constructor(t) {
    this.target = void 0, this.listeners = [], this.removeAll = () => {
      this.listeners.forEach((n) => {
        var s;
        return (s = this.target) == null ? void 0 : s.removeEventListener(...n);
      });
    }, this.target = t;
  }
  add(t, n, s) {
    var i;
    (i = this.target) == null || i.addEventListener(t, n, s), this.listeners.push([t, n, s]);
  }
}
function Vb(e) {
  const {
    EventTarget: t
  } = fi(e);
  return e instanceof t ? e : jo(e);
}
function ua(e, t) {
  const n = Math.abs(e.x), s = Math.abs(e.y);
  return typeof t == "number" ? Math.sqrt(n ** 2 + s ** 2) > t : "x" in t && "y" in t ? n > t.x && s > t.y : "x" in t ? n > t.x : "y" in t ? s > t.y : !1;
}
var kn;
(function(e) {
  e.Click = "click", e.DragStart = "dragstart", e.Keydown = "keydown", e.ContextMenu = "contextmenu", e.Resize = "resize", e.SelectionChange = "selectionchange", e.VisibilityChange = "visibilitychange";
})(kn || (kn = {}));
function Iu(e) {
  e.preventDefault();
}
function Wb(e) {
  e.stopPropagation();
}
var In;
(function(e) {
  e.Space = "Space", e.Down = "ArrowDown", e.Right = "ArrowRight", e.Left = "ArrowLeft", e.Up = "ArrowUp", e.Esc = "Escape", e.Enter = "Enter", e.Tab = "Tab";
})(In || (In = {}));
In.Space, In.Enter, In.Esc, In.Space, In.Enter, In.Tab;
function Eu(e) {
  return !!(e && "distance" in e);
}
function Du(e) {
  return !!(e && "delay" in e);
}
class Cl {
  constructor(t, n, s) {
    var i;
    s === void 0 && (s = Vb(t.event.target)), this.props = void 0, this.events = void 0, this.autoScrollEnabled = !0, this.document = void 0, this.activated = !1, this.initialCoordinates = void 0, this.timeoutId = null, this.listeners = void 0, this.documentListeners = void 0, this.windowListeners = void 0, this.props = t, this.events = n;
    const {
      event: r
    } = t, {
      target: o
    } = r;
    this.props = t, this.events = n, this.document = jo(o), this.documentListeners = new la(this.document), this.listeners = new la(s), this.windowListeners = new la(fi(o)), this.initialCoordinates = (i = Tu(r)) != null ? i : Ba, this.handleStart = this.handleStart.bind(this), this.handleMove = this.handleMove.bind(this), this.handleEnd = this.handleEnd.bind(this), this.handleCancel = this.handleCancel.bind(this), this.handleKeydown = this.handleKeydown.bind(this), this.removeTextSelection = this.removeTextSelection.bind(this), this.attach();
  }
  attach() {
    const {
      events: t,
      props: {
        options: {
          activationConstraint: n,
          bypassActivationConstraint: s
        }
      }
    } = this;
    if (this.listeners.add(t.move.name, this.handleMove, {
      passive: !1
    }), this.listeners.add(t.end.name, this.handleEnd), t.cancel && this.listeners.add(t.cancel.name, this.handleCancel), this.windowListeners.add(kn.Resize, this.handleCancel), this.windowListeners.add(kn.DragStart, Iu), this.windowListeners.add(kn.VisibilityChange, this.handleCancel), this.windowListeners.add(kn.ContextMenu, Iu), this.documentListeners.add(kn.Keydown, this.handleKeydown), n) {
      if (s != null && s({
        event: this.props.event,
        activeNode: this.props.activeNode,
        options: this.props.options
      }))
        return this.handleStart();
      if (Du(n)) {
        this.timeoutId = setTimeout(this.handleStart, n.delay), this.handlePending(n);
        return;
      }
      if (Eu(n)) {
        this.handlePending(n);
        return;
      }
    }
    this.handleStart();
  }
  detach() {
    this.listeners.removeAll(), this.windowListeners.removeAll(), setTimeout(this.documentListeners.removeAll, 50), this.timeoutId !== null && (clearTimeout(this.timeoutId), this.timeoutId = null);
  }
  handlePending(t, n) {
    const {
      active: s,
      onPending: i
    } = this.props;
    i(s, t, this.initialCoordinates, n);
  }
  handleStart() {
    const {
      initialCoordinates: t
    } = this, {
      onStart: n
    } = this.props;
    t && (this.activated = !0, this.documentListeners.add(kn.Click, Wb, {
      capture: !0
    }), this.removeTextSelection(), this.documentListeners.add(kn.SelectionChange, this.removeTextSelection), n(t));
  }
  handleMove(t) {
    var n;
    const {
      activated: s,
      initialCoordinates: i,
      props: r
    } = this, {
      onMove: o,
      options: {
        activationConstraint: a
      }
    } = r;
    if (!i)
      return;
    const c = (n = Tu(t)) != null ? n : Ba, l = Ob(i, c);
    if (!s && a) {
      if (Eu(a)) {
        if (a.tolerance != null && ua(l, a.tolerance))
          return this.handleCancel();
        if (ua(l, a.distance))
          return this.handleStart();
      }
      if (Du(a) && ua(l, a.tolerance))
        return this.handleCancel();
      this.handlePending(a, l);
      return;
    }
    t.cancelable && t.preventDefault(), o(c);
  }
  handleEnd() {
    const {
      onAbort: t,
      onEnd: n
    } = this.props;
    this.detach(), this.activated || t(this.props.active), n();
  }
  handleCancel() {
    const {
      onAbort: t,
      onCancel: n
    } = this.props;
    this.detach(), this.activated || t(this.props.active), n();
  }
  handleKeydown(t) {
    t.code === In.Esc && this.handleCancel();
  }
  removeTextSelection() {
    var t;
    (t = this.document.getSelection()) == null || t.removeAllRanges();
  }
}
const jb = {
  cancel: {
    name: "pointercancel"
  },
  move: {
    name: "pointermove"
  },
  end: {
    name: "pointerup"
  }
};
class uf extends Cl {
  constructor(t) {
    const {
      event: n
    } = t, s = jo(n.target);
    super(t, jb, s);
  }
}
uf.activators = [{
  eventName: "onPointerDown",
  handler: (e, t) => {
    let {
      nativeEvent: n
    } = e, {
      onActivation: s
    } = t;
    return !n.isPrimary || n.button !== 0 ? !1 : (s?.({
      event: n
    }), !0);
  }
}];
const Lb = {
  move: {
    name: "mousemove"
  },
  end: {
    name: "mouseup"
  }
};
var $a;
(function(e) {
  e[e.RightClick = 2] = "RightClick";
})($a || ($a = {}));
class Bb extends Cl {
  constructor(t) {
    super(t, Lb, jo(t.event.target));
  }
}
Bb.activators = [{
  eventName: "onMouseDown",
  handler: (e, t) => {
    let {
      nativeEvent: n
    } = e, {
      onActivation: s
    } = t;
    return n.button === $a.RightClick ? !1 : (s?.({
      event: n
    }), !0);
  }
}];
const ha = {
  cancel: {
    name: "touchcancel"
  },
  move: {
    name: "touchmove"
  },
  end: {
    name: "touchend"
  }
};
class $b extends Cl {
  constructor(t) {
    super(t, ha);
  }
  static setup() {
    return window.addEventListener(ha.move.name, t, {
      capture: !1,
      passive: !1
    }), function() {
      window.removeEventListener(ha.move.name, t);
    };
    function t() {
    }
  }
}
$b.activators = [{
  eventName: "onTouchStart",
  handler: (e, t) => {
    let {
      nativeEvent: n
    } = e, {
      onActivation: s
    } = t;
    const {
      touches: i
    } = n;
    return i.length > 1 ? !1 : (s?.({
      event: n
    }), !0);
  }
}];
var Ru;
(function(e) {
  e[e.Pointer = 0] = "Pointer", e[e.DraggableRect = 1] = "DraggableRect";
})(Ru || (Ru = {}));
var Ou;
(function(e) {
  e[e.TreeOrder = 0] = "TreeOrder", e[e.ReversedTreeOrder = 1] = "ReversedTreeOrder";
})(Ou || (Ou = {}));
Ps.Backward + "", Ps.Forward + "", Ps.Backward + "", Ps.Forward + "";
var qa;
(function(e) {
  e[e.Always = 0] = "Always", e[e.BeforeDragging = 1] = "BeforeDragging", e[e.WhileDragging = 2] = "WhileDragging";
})(qa || (qa = {}));
var za;
(function(e) {
  e.Optimized = "optimized";
})(za || (za = {}));
function qb(e, t) {
  return Rn(() => e.reduce((n, s) => {
    let {
      eventName: i,
      handler: r
    } = s;
    return n[i] = (o) => {
      r(o, t);
    }, n;
  }, {}), [e, t]);
}
qa.WhileDragging, za.Optimized;
const zb = {
  activatorEvent: null,
  activators: [],
  active: null,
  activeNodeRect: null,
  ariaDescribedById: {
    draggable: ""
  },
  dispatch: ku,
  draggableNodes: /* @__PURE__ */ new Map(),
  over: null,
  measureDroppableContainers: ku
}, Gb = /* @__PURE__ */ Se(zb), Zb = /* @__PURE__ */ Se({
  ...Ba,
  scaleX: 1,
  scaleY: 1
});
var Mu;
(function(e) {
  e[e.Uninitialized = 0] = "Uninitialized", e[e.Initializing = 1] = "Initializing", e[e.Initialized = 2] = "Initialized";
})(Mu || (Mu = {}));
const Yb = /* @__PURE__ */ Se(null), Fu = "button", Xb = "Draggable";
function da(e) {
  let {
    id: t,
    data: n,
    disabled: s = !1,
    attributes: i
  } = e;
  const r = lf(Xb), {
    activators: o,
    activatorEvent: a,
    active: c,
    activeNodeRect: l,
    ariaDescribedById: u,
    draggableNodes: h,
    over: d
  } = we(Gb), {
    role: p = Fu,
    roleDescription: f = "draggable",
    tabIndex: _ = 0
  } = i ?? {}, m = c?.id === t, g = we(m ? Zb : Yb), [b, v] = Hr(), [x, y] = Hr(), w = qb(o, t), S = cf(n);
  Lo(
    () => (h.set(t, {
      id: t,
      key: r,
      node: b,
      activatorNode: x,
      data: S
    }), () => {
      const D = h.get(t);
      D && D.key === r && h.delete(t);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h, t]
  );
  const C = Rn(() => ({
    role: p,
    tabIndex: _,
    "aria-disabled": s,
    "aria-pressed": m && p === Fu ? !0 : void 0,
    "aria-roledescription": f,
    "aria-describedby": u.draggable
  }), [s, p, _, m, f, u.draggable]);
  return {
    active: c,
    activatorEvent: a,
    activeNodeRect: l,
    attributes: C,
    isDragging: m,
    listeners: s ? void 0 : w,
    node: b,
    over: d,
    setNodeRef: v,
    setActivatorNodeRef: y,
    transform: g
  };
}
const Ub = {
  prefix: "fas",
  iconName: "trash-can",
  icon: [448, 512, [61460, "trash-alt"], "f2ed", "M135.2 17.7C140.6 6.8 151.7 0 163.8 0L284.2 0c12.1 0 23.2 6.8 28.6 17.7L320 32l96 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 7.2-14.3zM32 128l384 0 0 320c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-320zm96 64c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16z"]
}, Hb = Ub, Kb = {
  prefix: "fas",
  iconName: "volume-low",
  icon: [448, 512, [128264, "volume-down"], "f027", "M301.1 34.8C312.6 40 320 51.4 320 64l0 384c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352 64 352c-35.3 0-64-28.7-64-64l0-64c0-35.3 28.7-64 64-64l67.8 0L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3zM412.6 181.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5z"]
}, Qb = Kb, Jb = {
  prefix: "fas",
  iconName: "volume-high",
  icon: [640, 512, [128266, "volume-up"], "f028", "M533.6 32.5C598.5 85.2 640 165.8 640 256s-41.5 170.7-106.4 223.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C557.5 398.2 592 331.2 592 256s-34.5-142.2-88.7-186.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM473.1 107c43.2 35.2 70.9 88.9 70.9 149s-27.7 113.8-70.9 149c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C475.3 341.3 496 301.1 496 256s-20.7-85.3-53.2-111.8c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zm-60.5 74.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM301.1 34.8C312.6 40 320 51.4 320 64l0 384c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352 64 352c-35.3 0-64-28.7-64-64l0-64c0-35.3 28.7-64 64-64l67.8 0L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3z"]
}, tx = Jb;
function ex(e, t, n) {
  return (t = sx(t)) in e ? Object.defineProperty(e, t, {
    value: n,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = n, e;
}
function Pu(e, t) {
  var n = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var s = Object.getOwnPropertySymbols(e);
    t && (s = s.filter(function(i) {
      return Object.getOwnPropertyDescriptor(e, i).enumerable;
    })), n.push.apply(n, s);
  }
  return n;
}
function $(e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t] != null ? arguments[t] : {};
    t % 2 ? Pu(Object(n), !0).forEach(function(s) {
      ex(e, s, n[s]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Pu(Object(n)).forEach(function(s) {
      Object.defineProperty(e, s, Object.getOwnPropertyDescriptor(n, s));
    });
  }
  return e;
}
function nx(e, t) {
  if (typeof e != "object" || !e) return e;
  var n = e[Symbol.toPrimitive];
  if (n !== void 0) {
    var s = n.call(e, t);
    if (typeof s != "object") return s;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e);
}
function sx(e) {
  var t = nx(e, "string");
  return typeof t == "symbol" ? t : t + "";
}
const Nu = () => {
};
let Sl = {}, hf = {}, df = null, ff = {
  mark: Nu,
  measure: Nu
};
try {
  typeof window < "u" && (Sl = window), typeof document < "u" && (hf = document), typeof MutationObserver < "u" && (df = MutationObserver), typeof performance < "u" && (ff = performance);
} catch {
}
const {
  userAgent: Vu = ""
} = Sl.navigator || {}, Jn = Sl, qt = hf, Wu = df, Tr = ff;
Jn.document;
const Wn = !!qt.documentElement && !!qt.head && typeof qt.addEventListener == "function" && typeof qt.createElement == "function", pf = ~Vu.indexOf("MSIE") || ~Vu.indexOf("Trident/");
var ix = /fa(s|r|l|t|d|dr|dl|dt|b|k|kd|ss|sr|sl|st|sds|sdr|sdl|sdt)?[\-\ ]/, rx = /Font ?Awesome ?([56 ]*)(Solid|Regular|Light|Thin|Duotone|Brands|Free|Pro|Sharp Duotone|Sharp|Kit)?.*/i, mf = {
  classic: {
    fa: "solid",
    fas: "solid",
    "fa-solid": "solid",
    far: "regular",
    "fa-regular": "regular",
    fal: "light",
    "fa-light": "light",
    fat: "thin",
    "fa-thin": "thin",
    fab: "brands",
    "fa-brands": "brands"
  },
  duotone: {
    fa: "solid",
    fad: "solid",
    "fa-solid": "solid",
    "fa-duotone": "solid",
    fadr: "regular",
    "fa-regular": "regular",
    fadl: "light",
    "fa-light": "light",
    fadt: "thin",
    "fa-thin": "thin"
  },
  sharp: {
    fa: "solid",
    fass: "solid",
    "fa-solid": "solid",
    fasr: "regular",
    "fa-regular": "regular",
    fasl: "light",
    "fa-light": "light",
    fast: "thin",
    "fa-thin": "thin"
  },
  "sharp-duotone": {
    fa: "solid",
    fasds: "solid",
    "fa-solid": "solid",
    fasdr: "regular",
    "fa-regular": "regular",
    fasdl: "light",
    "fa-light": "light",
    fasdt: "thin",
    "fa-thin": "thin"
  }
}, ox = {
  GROUP: "duotone-group",
  PRIMARY: "primary",
  SECONDARY: "secondary"
}, gf = ["fa-classic", "fa-duotone", "fa-sharp", "fa-sharp-duotone"], Ce = "classic", Bo = "duotone", ax = "sharp", cx = "sharp-duotone", _f = [Ce, Bo, ax, cx], lx = {
  classic: {
    900: "fas",
    400: "far",
    normal: "far",
    300: "fal",
    100: "fat"
  },
  duotone: {
    900: "fad",
    400: "fadr",
    300: "fadl",
    100: "fadt"
  },
  sharp: {
    900: "fass",
    400: "fasr",
    300: "fasl",
    100: "fast"
  },
  "sharp-duotone": {
    900: "fasds",
    400: "fasdr",
    300: "fasdl",
    100: "fasdt"
  }
}, ux = {
  "Font Awesome 6 Free": {
    900: "fas",
    400: "far"
  },
  "Font Awesome 6 Pro": {
    900: "fas",
    400: "far",
    normal: "far",
    300: "fal",
    100: "fat"
  },
  "Font Awesome 6 Brands": {
    400: "fab",
    normal: "fab"
  },
  "Font Awesome 6 Duotone": {
    900: "fad",
    400: "fadr",
    normal: "fadr",
    300: "fadl",
    100: "fadt"
  },
  "Font Awesome 6 Sharp": {
    900: "fass",
    400: "fasr",
    normal: "fasr",
    300: "fasl",
    100: "fast"
  },
  "Font Awesome 6 Sharp Duotone": {
    900: "fasds",
    400: "fasdr",
    normal: "fasdr",
    300: "fasdl",
    100: "fasdt"
  }
}, hx = /* @__PURE__ */ new Map([["classic", {
  defaultShortPrefixId: "fas",
  defaultStyleId: "solid",
  styleIds: ["solid", "regular", "light", "thin", "brands"],
  futureStyleIds: [],
  defaultFontWeight: 900
}], ["sharp", {
  defaultShortPrefixId: "fass",
  defaultStyleId: "solid",
  styleIds: ["solid", "regular", "light", "thin"],
  futureStyleIds: [],
  defaultFontWeight: 900
}], ["duotone", {
  defaultShortPrefixId: "fad",
  defaultStyleId: "solid",
  styleIds: ["solid", "regular", "light", "thin"],
  futureStyleIds: [],
  defaultFontWeight: 900
}], ["sharp-duotone", {
  defaultShortPrefixId: "fasds",
  defaultStyleId: "solid",
  styleIds: ["solid", "regular", "light", "thin"],
  futureStyleIds: [],
  defaultFontWeight: 900
}]]), dx = {
  classic: {
    solid: "fas",
    regular: "far",
    light: "fal",
    thin: "fat",
    brands: "fab"
  },
  duotone: {
    solid: "fad",
    regular: "fadr",
    light: "fadl",
    thin: "fadt"
  },
  sharp: {
    solid: "fass",
    regular: "fasr",
    light: "fasl",
    thin: "fast"
  },
  "sharp-duotone": {
    solid: "fasds",
    regular: "fasdr",
    light: "fasdl",
    thin: "fasdt"
  }
}, fx = ["fak", "fa-kit", "fakd", "fa-kit-duotone"], ju = {
  kit: {
    fak: "kit",
    "fa-kit": "kit"
  },
  "kit-duotone": {
    fakd: "kit-duotone",
    "fa-kit-duotone": "kit-duotone"
  }
}, px = ["kit"], mx = {
  kit: {
    "fa-kit": "fak"
  }
}, gx = ["fak", "fakd"], _x = {
  kit: {
    fak: "fa-kit"
  }
}, Lu = {
  kit: {
    kit: "fak"
  },
  "kit-duotone": {
    "kit-duotone": "fakd"
  }
}, Ar = {
  GROUP: "duotone-group",
  SWAP_OPACITY: "swap-opacity",
  PRIMARY: "primary",
  SECONDARY: "secondary"
}, yx = ["fa-classic", "fa-duotone", "fa-sharp", "fa-sharp-duotone"], vx = ["fak", "fa-kit", "fakd", "fa-kit-duotone"], bx = {
  "Font Awesome Kit": {
    400: "fak",
    normal: "fak"
  },
  "Font Awesome Kit Duotone": {
    400: "fakd",
    normal: "fakd"
  }
}, xx = {
  classic: {
    "fa-brands": "fab",
    "fa-duotone": "fad",
    "fa-light": "fal",
    "fa-regular": "far",
    "fa-solid": "fas",
    "fa-thin": "fat"
  },
  duotone: {
    "fa-regular": "fadr",
    "fa-light": "fadl",
    "fa-thin": "fadt"
  },
  sharp: {
    "fa-solid": "fass",
    "fa-regular": "fasr",
    "fa-light": "fasl",
    "fa-thin": "fast"
  },
  "sharp-duotone": {
    "fa-solid": "fasds",
    "fa-regular": "fasdr",
    "fa-light": "fasdl",
    "fa-thin": "fasdt"
  }
}, wx = {
  classic: ["fas", "far", "fal", "fat", "fad"],
  duotone: ["fadr", "fadl", "fadt"],
  sharp: ["fass", "fasr", "fasl", "fast"],
  "sharp-duotone": ["fasds", "fasdr", "fasdl", "fasdt"]
}, Ga = {
  classic: {
    fab: "fa-brands",
    fad: "fa-duotone",
    fal: "fa-light",
    far: "fa-regular",
    fas: "fa-solid",
    fat: "fa-thin"
  },
  duotone: {
    fadr: "fa-regular",
    fadl: "fa-light",
    fadt: "fa-thin"
  },
  sharp: {
    fass: "fa-solid",
    fasr: "fa-regular",
    fasl: "fa-light",
    fast: "fa-thin"
  },
  "sharp-duotone": {
    fasds: "fa-solid",
    fasdr: "fa-regular",
    fasdl: "fa-light",
    fasdt: "fa-thin"
  }
}, Cx = ["fa-solid", "fa-regular", "fa-light", "fa-thin", "fa-duotone", "fa-brands"], Za = ["fa", "fas", "far", "fal", "fat", "fad", "fadr", "fadl", "fadt", "fab", "fass", "fasr", "fasl", "fast", "fasds", "fasdr", "fasdl", "fasdt", ...yx, ...Cx], Sx = ["solid", "regular", "light", "thin", "duotone", "brands"], yf = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], Tx = yf.concat([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]), Ax = [...Object.keys(wx), ...Sx, "2xs", "xs", "sm", "lg", "xl", "2xl", "beat", "border", "fade", "beat-fade", "bounce", "flip-both", "flip-horizontal", "flip-vertical", "flip", "fw", "inverse", "layers-counter", "layers-text", "layers", "li", "pull-left", "pull-right", "pulse", "rotate-180", "rotate-270", "rotate-90", "rotate-by", "shake", "spin-pulse", "spin-reverse", "spin", "stack-1x", "stack-2x", "stack", "ul", Ar.GROUP, Ar.SWAP_OPACITY, Ar.PRIMARY, Ar.SECONDARY].concat(yf.map((e) => "".concat(e, "x"))).concat(Tx.map((e) => "w-".concat(e))), kx = {
  "Font Awesome 5 Free": {
    900: "fas",
    400: "far"
  },
  "Font Awesome 5 Pro": {
    900: "fas",
    400: "far",
    normal: "far",
    300: "fal"
  },
  "Font Awesome 5 Brands": {
    400: "fab",
    normal: "fab"
  },
  "Font Awesome 5 Duotone": {
    900: "fad"
  }
};
const Fn = "___FONT_AWESOME___", Ya = 16, vf = "fa", bf = "svg-inline--fa", _s = "data-fa-i2svg", Xa = "data-fa-pseudo-element", Ix = "data-fa-pseudo-element-pending", Tl = "data-prefix", Al = "data-icon", Bu = "fontawesome-i2svg", Ex = "async", Dx = ["HTML", "HEAD", "STYLE", "SCRIPT"], xf = (() => {
  try {
    return process.env.NODE_ENV === "production";
  } catch {
    return !1;
  }
})();
function dr(e) {
  return new Proxy(e, {
    get(t, n) {
      return n in t ? t[n] : t[Ce];
    }
  });
}
const wf = $({}, mf);
wf[Ce] = $($($($({}, {
  "fa-duotone": "duotone"
}), mf[Ce]), ju.kit), ju["kit-duotone"]);
const Rx = dr(wf), Ua = $({}, dx);
Ua[Ce] = $($($($({}, {
  duotone: "fad"
}), Ua[Ce]), Lu.kit), Lu["kit-duotone"]);
const $u = dr(Ua), Ha = $({}, Ga);
Ha[Ce] = $($({}, Ha[Ce]), _x.kit);
const kl = dr(Ha), Ka = $({}, xx);
Ka[Ce] = $($({}, Ka[Ce]), mx.kit);
dr(Ka);
const Ox = ix, Cf = "fa-layers-text", Mx = rx, Fx = $({}, lx);
dr(Fx);
const Px = ["class", "data-prefix", "data-icon", "data-fa-transform", "data-fa-mask"], fa = ox, Nx = [...px, ...Ax], Ei = Jn.FontAwesomeConfig || {};
function Vx(e) {
  var t = qt.querySelector("script[" + e + "]");
  if (t)
    return t.getAttribute(e);
}
function Wx(e) {
  return e === "" ? !0 : e === "false" ? !1 : e === "true" ? !0 : e;
}
qt && typeof qt.querySelector == "function" && [["data-family-prefix", "familyPrefix"], ["data-css-prefix", "cssPrefix"], ["data-family-default", "familyDefault"], ["data-style-default", "styleDefault"], ["data-replacement-class", "replacementClass"], ["data-auto-replace-svg", "autoReplaceSvg"], ["data-auto-add-css", "autoAddCss"], ["data-auto-a11y", "autoA11y"], ["data-search-pseudo-elements", "searchPseudoElements"], ["data-observe-mutations", "observeMutations"], ["data-mutate-approach", "mutateApproach"], ["data-keep-original-source", "keepOriginalSource"], ["data-measure-performance", "measurePerformance"], ["data-show-missing-icons", "showMissingIcons"]].forEach((t) => {
  let [n, s] = t;
  const i = Wx(Vx(n));
  i != null && (Ei[s] = i);
});
const Sf = {
  styleDefault: "solid",
  familyDefault: Ce,
  cssPrefix: vf,
  replacementClass: bf,
  autoReplaceSvg: !0,
  autoAddCss: !0,
  autoA11y: !0,
  searchPseudoElements: !1,
  observeMutations: !0,
  mutateApproach: "async",
  keepOriginalSource: !0,
  measurePerformance: !1,
  showMissingIcons: !0
};
Ei.familyPrefix && (Ei.cssPrefix = Ei.familyPrefix);
const Xs = $($({}, Sf), Ei);
Xs.autoReplaceSvg || (Xs.observeMutations = !1);
const at = {};
Object.keys(Sf).forEach((e) => {
  Object.defineProperty(at, e, {
    enumerable: !0,
    set: function(t) {
      Xs[e] = t, Di.forEach((n) => n(at));
    },
    get: function() {
      return Xs[e];
    }
  });
});
Object.defineProperty(at, "familyPrefix", {
  enumerable: !0,
  set: function(e) {
    Xs.cssPrefix = e, Di.forEach((t) => t(at));
  },
  get: function() {
    return Xs.cssPrefix;
  }
});
Jn.FontAwesomeConfig = at;
const Di = [];
function jx(e) {
  return Di.push(e), () => {
    Di.splice(Di.indexOf(e), 1);
  };
}
const $n = Ya, gn = {
  size: 16,
  x: 0,
  y: 0,
  rotate: 0,
  flipX: !1,
  flipY: !1
};
function Lx(e) {
  if (!e || !Wn)
    return;
  const t = qt.createElement("style");
  t.setAttribute("type", "text/css"), t.innerHTML = e;
  const n = qt.head.childNodes;
  let s = null;
  for (let i = n.length - 1; i > -1; i--) {
    const r = n[i], o = (r.tagName || "").toUpperCase();
    ["STYLE", "LINK"].indexOf(o) > -1 && (s = r);
  }
  return qt.head.insertBefore(t, s), e;
}
const Bx = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function ji() {
  let e = 12, t = "";
  for (; e-- > 0; )
    t += Bx[Math.random() * 62 | 0];
  return t;
}
function pi(e) {
  const t = [];
  for (let n = (e || []).length >>> 0; n--; )
    t[n] = e[n];
  return t;
}
function Il(e) {
  return e.classList ? pi(e.classList) : (e.getAttribute("class") || "").split(" ").filter((t) => t);
}
function Tf(e) {
  return "".concat(e).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function $x(e) {
  return Object.keys(e || {}).reduce((t, n) => t + "".concat(n, '="').concat(Tf(e[n]), '" '), "").trim();
}
function $o(e) {
  return Object.keys(e || {}).reduce((t, n) => t + "".concat(n, ": ").concat(e[n].trim(), ";"), "");
}
function El(e) {
  return e.size !== gn.size || e.x !== gn.x || e.y !== gn.y || e.rotate !== gn.rotate || e.flipX || e.flipY;
}
function qx(e) {
  let {
    transform: t,
    containerWidth: n,
    iconWidth: s
  } = e;
  const i = {
    transform: "translate(".concat(n / 2, " 256)")
  }, r = "translate(".concat(t.x * 32, ", ").concat(t.y * 32, ") "), o = "scale(".concat(t.size / 16 * (t.flipX ? -1 : 1), ", ").concat(t.size / 16 * (t.flipY ? -1 : 1), ") "), a = "rotate(".concat(t.rotate, " 0 0)"), c = {
    transform: "".concat(r, " ").concat(o, " ").concat(a)
  }, l = {
    transform: "translate(".concat(s / 2 * -1, " -256)")
  };
  return {
    outer: i,
    inner: c,
    path: l
  };
}
function zx(e) {
  let {
    transform: t,
    width: n = Ya,
    height: s = Ya,
    startCentered: i = !1
  } = e, r = "";
  return i && pf ? r += "translate(".concat(t.x / $n - n / 2, "em, ").concat(t.y / $n - s / 2, "em) ") : i ? r += "translate(calc(-50% + ".concat(t.x / $n, "em), calc(-50% + ").concat(t.y / $n, "em)) ") : r += "translate(".concat(t.x / $n, "em, ").concat(t.y / $n, "em) "), r += "scale(".concat(t.size / $n * (t.flipX ? -1 : 1), ", ").concat(t.size / $n * (t.flipY ? -1 : 1), ") "), r += "rotate(".concat(t.rotate, "deg) "), r;
}
var Gx = `:root, :host {
  --fa-font-solid: normal 900 1em/1 "Font Awesome 6 Free";
  --fa-font-regular: normal 400 1em/1 "Font Awesome 6 Free";
  --fa-font-light: normal 300 1em/1 "Font Awesome 6 Pro";
  --fa-font-thin: normal 100 1em/1 "Font Awesome 6 Pro";
  --fa-font-duotone: normal 900 1em/1 "Font Awesome 6 Duotone";
  --fa-font-duotone-regular: normal 400 1em/1 "Font Awesome 6 Duotone";
  --fa-font-duotone-light: normal 300 1em/1 "Font Awesome 6 Duotone";
  --fa-font-duotone-thin: normal 100 1em/1 "Font Awesome 6 Duotone";
  --fa-font-brands: normal 400 1em/1 "Font Awesome 6 Brands";
  --fa-font-sharp-solid: normal 900 1em/1 "Font Awesome 6 Sharp";
  --fa-font-sharp-regular: normal 400 1em/1 "Font Awesome 6 Sharp";
  --fa-font-sharp-light: normal 300 1em/1 "Font Awesome 6 Sharp";
  --fa-font-sharp-thin: normal 100 1em/1 "Font Awesome 6 Sharp";
  --fa-font-sharp-duotone-solid: normal 900 1em/1 "Font Awesome 6 Sharp Duotone";
  --fa-font-sharp-duotone-regular: normal 400 1em/1 "Font Awesome 6 Sharp Duotone";
  --fa-font-sharp-duotone-light: normal 300 1em/1 "Font Awesome 6 Sharp Duotone";
  --fa-font-sharp-duotone-thin: normal 100 1em/1 "Font Awesome 6 Sharp Duotone";
}

svg:not(:root).svg-inline--fa, svg:not(:host).svg-inline--fa {
  overflow: visible;
  box-sizing: content-box;
}

.svg-inline--fa {
  display: var(--fa-display, inline-block);
  height: 1em;
  overflow: visible;
  vertical-align: -0.125em;
}
.svg-inline--fa.fa-2xs {
  vertical-align: 0.1em;
}
.svg-inline--fa.fa-xs {
  vertical-align: 0em;
}
.svg-inline--fa.fa-sm {
  vertical-align: -0.0714285705em;
}
.svg-inline--fa.fa-lg {
  vertical-align: -0.2em;
}
.svg-inline--fa.fa-xl {
  vertical-align: -0.25em;
}
.svg-inline--fa.fa-2xl {
  vertical-align: -0.3125em;
}
.svg-inline--fa.fa-pull-left {
  margin-right: var(--fa-pull-margin, 0.3em);
  width: auto;
}
.svg-inline--fa.fa-pull-right {
  margin-left: var(--fa-pull-margin, 0.3em);
  width: auto;
}
.svg-inline--fa.fa-li {
  width: var(--fa-li-width, 2em);
  top: 0.25em;
}
.svg-inline--fa.fa-fw {
  width: var(--fa-fw-width, 1.25em);
}

.fa-layers svg.svg-inline--fa {
  bottom: 0;
  left: 0;
  margin: auto;
  position: absolute;
  right: 0;
  top: 0;
}

.fa-layers-counter, .fa-layers-text {
  display: inline-block;
  position: absolute;
  text-align: center;
}

.fa-layers {
  display: inline-block;
  height: 1em;
  position: relative;
  text-align: center;
  vertical-align: -0.125em;
  width: 1em;
}
.fa-layers svg.svg-inline--fa {
  transform-origin: center center;
}

.fa-layers-text {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  transform-origin: center center;
}

.fa-layers-counter {
  background-color: var(--fa-counter-background-color, #ff253a);
  border-radius: var(--fa-counter-border-radius, 1em);
  box-sizing: border-box;
  color: var(--fa-inverse, #fff);
  line-height: var(--fa-counter-line-height, 1);
  max-width: var(--fa-counter-max-width, 5em);
  min-width: var(--fa-counter-min-width, 1.5em);
  overflow: hidden;
  padding: var(--fa-counter-padding, 0.25em 0.5em);
  right: var(--fa-right, 0);
  text-overflow: ellipsis;
  top: var(--fa-top, 0);
  transform: scale(var(--fa-counter-scale, 0.25));
  transform-origin: top right;
}

.fa-layers-bottom-right {
  bottom: var(--fa-bottom, 0);
  right: var(--fa-right, 0);
  top: auto;
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: bottom right;
}

.fa-layers-bottom-left {
  bottom: var(--fa-bottom, 0);
  left: var(--fa-left, 0);
  right: auto;
  top: auto;
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: bottom left;
}

.fa-layers-top-right {
  top: var(--fa-top, 0);
  right: var(--fa-right, 0);
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: top right;
}

.fa-layers-top-left {
  left: var(--fa-left, 0);
  right: auto;
  top: var(--fa-top, 0);
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: top left;
}

.fa-1x {
  font-size: 1em;
}

.fa-2x {
  font-size: 2em;
}

.fa-3x {
  font-size: 3em;
}

.fa-4x {
  font-size: 4em;
}

.fa-5x {
  font-size: 5em;
}

.fa-6x {
  font-size: 6em;
}

.fa-7x {
  font-size: 7em;
}

.fa-8x {
  font-size: 8em;
}

.fa-9x {
  font-size: 9em;
}

.fa-10x {
  font-size: 10em;
}

.fa-2xs {
  font-size: 0.625em;
  line-height: 0.1em;
  vertical-align: 0.225em;
}

.fa-xs {
  font-size: 0.75em;
  line-height: 0.0833333337em;
  vertical-align: 0.125em;
}

.fa-sm {
  font-size: 0.875em;
  line-height: 0.0714285718em;
  vertical-align: 0.0535714295em;
}

.fa-lg {
  font-size: 1.25em;
  line-height: 0.05em;
  vertical-align: -0.075em;
}

.fa-xl {
  font-size: 1.5em;
  line-height: 0.0416666682em;
  vertical-align: -0.125em;
}

.fa-2xl {
  font-size: 2em;
  line-height: 0.03125em;
  vertical-align: -0.1875em;
}

.fa-fw {
  text-align: center;
  width: 1.25em;
}

.fa-ul {
  list-style-type: none;
  margin-left: var(--fa-li-margin, 2.5em);
  padding-left: 0;
}
.fa-ul > li {
  position: relative;
}

.fa-li {
  left: calc(-1 * var(--fa-li-width, 2em));
  position: absolute;
  text-align: center;
  width: var(--fa-li-width, 2em);
  line-height: inherit;
}

.fa-border {
  border-color: var(--fa-border-color, #eee);
  border-radius: var(--fa-border-radius, 0.1em);
  border-style: var(--fa-border-style, solid);
  border-width: var(--fa-border-width, 0.08em);
  padding: var(--fa-border-padding, 0.2em 0.25em 0.15em);
}

.fa-pull-left {
  float: left;
  margin-right: var(--fa-pull-margin, 0.3em);
}

.fa-pull-right {
  float: right;
  margin-left: var(--fa-pull-margin, 0.3em);
}

.fa-beat {
  animation-name: fa-beat;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-bounce {
  animation-name: fa-bounce;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.28, 0.84, 0.42, 1));
}

.fa-fade {
  animation-name: fa-fade;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.4, 0, 0.6, 1));
}

.fa-beat-fade {
  animation-name: fa-beat-fade;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.4, 0, 0.6, 1));
}

.fa-flip {
  animation-name: fa-flip;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-shake {
  animation-name: fa-shake;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-spin {
  animation-name: fa-spin;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 2s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-spin-reverse {
  --fa-animation-direction: reverse;
}

.fa-pulse,
.fa-spin-pulse {
  animation-name: fa-spin;
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, steps(8));
}

@media (prefers-reduced-motion: reduce) {
  .fa-beat,
.fa-bounce,
.fa-fade,
.fa-beat-fade,
.fa-flip,
.fa-pulse,
.fa-shake,
.fa-spin,
.fa-spin-pulse {
    animation-delay: -1ms;
    animation-duration: 1ms;
    animation-iteration-count: 1;
    transition-delay: 0s;
    transition-duration: 0s;
  }
}
@keyframes fa-beat {
  0%, 90% {
    transform: scale(1);
  }
  45% {
    transform: scale(var(--fa-beat-scale, 1.25));
  }
}
@keyframes fa-bounce {
  0% {
    transform: scale(1, 1) translateY(0);
  }
  10% {
    transform: scale(var(--fa-bounce-start-scale-x, 1.1), var(--fa-bounce-start-scale-y, 0.9)) translateY(0);
  }
  30% {
    transform: scale(var(--fa-bounce-jump-scale-x, 0.9), var(--fa-bounce-jump-scale-y, 1.1)) translateY(var(--fa-bounce-height, -0.5em));
  }
  50% {
    transform: scale(var(--fa-bounce-land-scale-x, 1.05), var(--fa-bounce-land-scale-y, 0.95)) translateY(0);
  }
  57% {
    transform: scale(1, 1) translateY(var(--fa-bounce-rebound, -0.125em));
  }
  64% {
    transform: scale(1, 1) translateY(0);
  }
  100% {
    transform: scale(1, 1) translateY(0);
  }
}
@keyframes fa-fade {
  50% {
    opacity: var(--fa-fade-opacity, 0.4);
  }
}
@keyframes fa-beat-fade {
  0%, 100% {
    opacity: var(--fa-beat-fade-opacity, 0.4);
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(var(--fa-beat-fade-scale, 1.125));
  }
}
@keyframes fa-flip {
  50% {
    transform: rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), var(--fa-flip-angle, -180deg));
  }
}
@keyframes fa-shake {
  0% {
    transform: rotate(-15deg);
  }
  4% {
    transform: rotate(15deg);
  }
  8%, 24% {
    transform: rotate(-18deg);
  }
  12%, 28% {
    transform: rotate(18deg);
  }
  16% {
    transform: rotate(-22deg);
  }
  20% {
    transform: rotate(22deg);
  }
  32% {
    transform: rotate(-12deg);
  }
  36% {
    transform: rotate(12deg);
  }
  40%, 100% {
    transform: rotate(0deg);
  }
}
@keyframes fa-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.fa-rotate-90 {
  transform: rotate(90deg);
}

.fa-rotate-180 {
  transform: rotate(180deg);
}

.fa-rotate-270 {
  transform: rotate(270deg);
}

.fa-flip-horizontal {
  transform: scale(-1, 1);
}

.fa-flip-vertical {
  transform: scale(1, -1);
}

.fa-flip-both,
.fa-flip-horizontal.fa-flip-vertical {
  transform: scale(-1, -1);
}

.fa-rotate-by {
  transform: rotate(var(--fa-rotate-angle, 0));
}

.fa-stack {
  display: inline-block;
  vertical-align: middle;
  height: 2em;
  position: relative;
  width: 2.5em;
}

.fa-stack-1x,
.fa-stack-2x {
  bottom: 0;
  left: 0;
  margin: auto;
  position: absolute;
  right: 0;
  top: 0;
  z-index: var(--fa-stack-z-index, auto);
}

.svg-inline--fa.fa-stack-1x {
  height: 1em;
  width: 1.25em;
}
.svg-inline--fa.fa-stack-2x {
  height: 2em;
  width: 2.5em;
}

.fa-inverse {
  color: var(--fa-inverse, #fff);
}

.sr-only,
.fa-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only-focusable:not(:focus),
.fa-sr-only-focusable:not(:focus) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.svg-inline--fa .fa-primary {
  fill: var(--fa-primary-color, currentColor);
  opacity: var(--fa-primary-opacity, 1);
}

.svg-inline--fa .fa-secondary {
  fill: var(--fa-secondary-color, currentColor);
  opacity: var(--fa-secondary-opacity, 0.4);
}

.svg-inline--fa.fa-swap-opacity .fa-primary {
  opacity: var(--fa-secondary-opacity, 0.4);
}

.svg-inline--fa.fa-swap-opacity .fa-secondary {
  opacity: var(--fa-primary-opacity, 1);
}

.svg-inline--fa mask .fa-primary,
.svg-inline--fa mask .fa-secondary {
  fill: black;
}`;
function Af() {
  const e = vf, t = bf, n = at.cssPrefix, s = at.replacementClass;
  let i = Gx;
  if (n !== e || s !== t) {
    const r = new RegExp("\\.".concat(e, "\\-"), "g"), o = new RegExp("\\--".concat(e, "\\-"), "g"), a = new RegExp("\\.".concat(t), "g");
    i = i.replace(r, ".".concat(n, "-")).replace(o, "--".concat(n, "-")).replace(a, ".".concat(s));
  }
  return i;
}
let qu = !1;
function pa() {
  at.autoAddCss && !qu && (Lx(Af()), qu = !0);
}
var Zx = {
  mixout() {
    return {
      dom: {
        css: Af,
        insertCss: pa
      }
    };
  },
  hooks() {
    return {
      beforeDOMElementCreation() {
        pa();
      },
      beforeI2svg() {
        pa();
      }
    };
  }
};
const Pn = Jn || {};
Pn[Fn] || (Pn[Fn] = {});
Pn[Fn].styles || (Pn[Fn].styles = {});
Pn[Fn].hooks || (Pn[Fn].hooks = {});
Pn[Fn].shims || (Pn[Fn].shims = []);
var _n = Pn[Fn];
const kf = [], If = function() {
  qt.removeEventListener("DOMContentLoaded", If), Kr = 1, kf.map((e) => e());
};
let Kr = !1;
Wn && (Kr = (qt.documentElement.doScroll ? /^loaded|^c/ : /^loaded|^i|^c/).test(qt.readyState), Kr || qt.addEventListener("DOMContentLoaded", If));
function Yx(e) {
  Wn && (Kr ? setTimeout(e, 0) : kf.push(e));
}
function fr(e) {
  const {
    tag: t,
    attributes: n = {},
    children: s = []
  } = e;
  return typeof e == "string" ? Tf(e) : "<".concat(t, " ").concat($x(n), ">").concat(s.map(fr).join(""), "</").concat(t, ">");
}
function zu(e, t, n) {
  if (e && e[t] && e[t][n])
    return {
      prefix: t,
      iconName: n,
      icon: e[t][n]
    };
}
var ma = function(t, n, s, i) {
  var r = Object.keys(t), o = r.length, a = n, c, l, u;
  for (s === void 0 ? (c = 1, u = t[r[0]]) : (c = 0, u = s); c < o; c++)
    l = r[c], u = a(u, t[l], l, t);
  return u;
};
function Xx(e) {
  const t = [];
  let n = 0;
  const s = e.length;
  for (; n < s; ) {
    const i = e.charCodeAt(n++);
    if (i >= 55296 && i <= 56319 && n < s) {
      const r = e.charCodeAt(n++);
      (r & 64512) == 56320 ? t.push(((i & 1023) << 10) + (r & 1023) + 65536) : (t.push(i), n--);
    } else
      t.push(i);
  }
  return t;
}
function Qa(e) {
  const t = Xx(e);
  return t.length === 1 ? t[0].toString(16) : null;
}
function Ux(e, t) {
  const n = e.length;
  let s = e.charCodeAt(t), i;
  return s >= 55296 && s <= 56319 && n > t + 1 && (i = e.charCodeAt(t + 1), i >= 56320 && i <= 57343) ? (s - 55296) * 1024 + i - 56320 + 65536 : s;
}
function Gu(e) {
  return Object.keys(e).reduce((t, n) => {
    const s = e[n];
    return !!s.icon ? t[s.iconName] = s.icon : t[n] = s, t;
  }, {});
}
function Ja(e, t) {
  let n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
  const {
    skipHooks: s = !1
  } = n, i = Gu(t);
  typeof _n.hooks.addPack == "function" && !s ? _n.hooks.addPack(e, Gu(t)) : _n.styles[e] = $($({}, _n.styles[e] || {}), i), e === "fas" && Ja("fa", t);
}
const {
  styles: Li,
  shims: Hx
} = _n, Ef = Object.keys(kl), Kx = Ef.reduce((e, t) => (e[t] = Object.keys(kl[t]), e), {});
let Dl = null, Df = {}, Rf = {}, Of = {}, Mf = {}, Ff = {};
function Qx(e) {
  return ~Nx.indexOf(e);
}
function Jx(e, t) {
  const n = t.split("-"), s = n[0], i = n.slice(1).join("-");
  return s === e && i !== "" && !Qx(i) ? i : null;
}
const Pf = () => {
  const e = (s) => ma(Li, (i, r, o) => (i[o] = ma(r, s, {}), i), {});
  Df = e((s, i, r) => (i[3] && (s[i[3]] = r), i[2] && i[2].filter((a) => typeof a == "number").forEach((a) => {
    s[a.toString(16)] = r;
  }), s)), Rf = e((s, i, r) => (s[r] = r, i[2] && i[2].filter((a) => typeof a == "string").forEach((a) => {
    s[a] = r;
  }), s)), Ff = e((s, i, r) => {
    const o = i[2];
    return s[r] = r, o.forEach((a) => {
      s[a] = r;
    }), s;
  });
  const t = "far" in Li || at.autoFetchSvg, n = ma(Hx, (s, i) => {
    const r = i[0];
    let o = i[1];
    const a = i[2];
    return o === "far" && !t && (o = "fas"), typeof r == "string" && (s.names[r] = {
      prefix: o,
      iconName: a
    }), typeof r == "number" && (s.unicodes[r.toString(16)] = {
      prefix: o,
      iconName: a
    }), s;
  }, {
    names: {},
    unicodes: {}
  });
  Of = n.names, Mf = n.unicodes, Dl = qo(at.styleDefault, {
    family: at.familyDefault
  });
};
jx((e) => {
  Dl = qo(e.styleDefault, {
    family: at.familyDefault
  });
});
Pf();
function Rl(e, t) {
  return (Df[e] || {})[t];
}
function tw(e, t) {
  return (Rf[e] || {})[t];
}
function ps(e, t) {
  return (Ff[e] || {})[t];
}
function Nf(e) {
  return Of[e] || {
    prefix: null,
    iconName: null
  };
}
function ew(e) {
  const t = Mf[e], n = Rl("fas", e);
  return t || (n ? {
    prefix: "fas",
    iconName: n
  } : null) || {
    prefix: null,
    iconName: null
  };
}
function ts() {
  return Dl;
}
const Vf = () => ({
  prefix: null,
  iconName: null,
  rest: []
});
function nw(e) {
  let t = Ce;
  const n = Ef.reduce((s, i) => (s[i] = "".concat(at.cssPrefix, "-").concat(i), s), {});
  return _f.forEach((s) => {
    (e.includes(n[s]) || e.some((i) => Kx[s].includes(i))) && (t = s);
  }), t;
}
function qo(e) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  const {
    family: n = Ce
  } = t, s = Rx[n][e];
  if (n === Bo && !e)
    return "fad";
  const i = $u[n][e] || $u[n][s], r = e in _n.styles ? e : null;
  return i || r || null;
}
function sw(e) {
  let t = [], n = null;
  return e.forEach((s) => {
    const i = Jx(at.cssPrefix, s);
    i ? n = i : s && t.push(s);
  }), {
    iconName: n,
    rest: t
  };
}
function Zu(e) {
  return e.sort().filter((t, n, s) => s.indexOf(t) === n);
}
function zo(e) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  const {
    skipLookups: n = !1
  } = t;
  let s = null;
  const i = Za.concat(vx), r = Zu(e.filter((h) => i.includes(h))), o = Zu(e.filter((h) => !Za.includes(h))), a = r.filter((h) => (s = h, !gf.includes(h))), [c = null] = a, l = nw(r), u = $($({}, sw(o)), {}, {
    prefix: qo(c, {
      family: l
    })
  });
  return $($($({}, u), aw({
    values: e,
    family: l,
    styles: Li,
    config: at,
    canonical: u,
    givenPrefix: s
  })), iw(n, s, u));
}
function iw(e, t, n) {
  let {
    prefix: s,
    iconName: i
  } = n;
  if (e || !s || !i)
    return {
      prefix: s,
      iconName: i
    };
  const r = t === "fa" ? Nf(i) : {}, o = ps(s, i);
  return i = r.iconName || o || i, s = r.prefix || s, s === "far" && !Li.far && Li.fas && !at.autoFetchSvg && (s = "fas"), {
    prefix: s,
    iconName: i
  };
}
const rw = _f.filter((e) => e !== Ce || e !== Bo), ow = Object.keys(Ga).filter((e) => e !== Ce).map((e) => Object.keys(Ga[e])).flat();
function aw(e) {
  const {
    values: t,
    family: n,
    canonical: s,
    givenPrefix: i = "",
    styles: r = {},
    config: o = {}
  } = e, a = n === Bo, c = t.includes("fa-duotone") || t.includes("fad"), l = o.familyDefault === "duotone", u = s.prefix === "fad" || s.prefix === "fa-duotone";
  if (!a && (c || l || u) && (s.prefix = "fad"), (t.includes("fa-brands") || t.includes("fab")) && (s.prefix = "fab"), !s.prefix && rw.includes(n) && (Object.keys(r).find((d) => ow.includes(d)) || o.autoFetchSvg)) {
    const d = hx.get(n).defaultShortPrefixId;
    s.prefix = d, s.iconName = ps(s.prefix, s.iconName) || s.iconName;
  }
  return (s.prefix === "fa" || i === "fa") && (s.prefix = ts() || "fas"), s;
}
class cw {
  constructor() {
    this.definitions = {};
  }
  add() {
    for (var t = arguments.length, n = new Array(t), s = 0; s < t; s++)
      n[s] = arguments[s];
    const i = n.reduce(this._pullDefinitions, {});
    Object.keys(i).forEach((r) => {
      this.definitions[r] = $($({}, this.definitions[r] || {}), i[r]), Ja(r, i[r]);
      const o = kl[Ce][r];
      o && Ja(o, i[r]), Pf();
    });
  }
  reset() {
    this.definitions = {};
  }
  _pullDefinitions(t, n) {
    const s = n.prefix && n.iconName && n.icon ? {
      0: n
    } : n;
    return Object.keys(s).map((i) => {
      const {
        prefix: r,
        iconName: o,
        icon: a
      } = s[i], c = a[2];
      t[r] || (t[r] = {}), c.length > 0 && c.forEach((l) => {
        typeof l == "string" && (t[r][l] = a);
      }), t[r][o] = a;
    }), t;
  }
}
let Yu = [], Ns = {};
const Ws = {}, lw = Object.keys(Ws);
function uw(e, t) {
  let {
    mixoutsTo: n
  } = t;
  return Yu = e, Ns = {}, Object.keys(Ws).forEach((s) => {
    lw.indexOf(s) === -1 && delete Ws[s];
  }), Yu.forEach((s) => {
    const i = s.mixout ? s.mixout() : {};
    if (Object.keys(i).forEach((r) => {
      typeof i[r] == "function" && (n[r] = i[r]), typeof i[r] == "object" && Object.keys(i[r]).forEach((o) => {
        n[r] || (n[r] = {}), n[r][o] = i[r][o];
      });
    }), s.hooks) {
      const r = s.hooks();
      Object.keys(r).forEach((o) => {
        Ns[o] || (Ns[o] = []), Ns[o].push(r[o]);
      });
    }
    s.provides && s.provides(Ws);
  }), n;
}
function tc(e, t) {
  for (var n = arguments.length, s = new Array(n > 2 ? n - 2 : 0), i = 2; i < n; i++)
    s[i - 2] = arguments[i];
  return (Ns[e] || []).forEach((o) => {
    t = o.apply(null, [t, ...s]);
  }), t;
}
function ys(e) {
  for (var t = arguments.length, n = new Array(t > 1 ? t - 1 : 0), s = 1; s < t; s++)
    n[s - 1] = arguments[s];
  (Ns[e] || []).forEach((r) => {
    r.apply(null, n);
  });
}
function es() {
  const e = arguments[0], t = Array.prototype.slice.call(arguments, 1);
  return Ws[e] ? Ws[e].apply(null, t) : void 0;
}
function ec(e) {
  e.prefix === "fa" && (e.prefix = "fas");
  let {
    iconName: t
  } = e;
  const n = e.prefix || ts();
  if (t)
    return t = ps(n, t) || t, zu(Wf.definitions, n, t) || zu(_n.styles, n, t);
}
const Wf = new cw(), hw = () => {
  at.autoReplaceSvg = !1, at.observeMutations = !1, ys("noAuto");
}, dw = {
  i2svg: function() {
    let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    return Wn ? (ys("beforeI2svg", e), es("pseudoElements2svg", e), es("i2svg", e)) : Promise.reject(new Error("Operation requires a DOM of some kind."));
  },
  watch: function() {
    let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    const {
      autoReplaceSvgRoot: t
    } = e;
    at.autoReplaceSvg === !1 && (at.autoReplaceSvg = !0), at.observeMutations = !0, Yx(() => {
      pw({
        autoReplaceSvgRoot: t
      }), ys("watch", e);
    });
  }
}, fw = {
  icon: (e) => {
    if (e === null)
      return null;
    if (typeof e == "object" && e.prefix && e.iconName)
      return {
        prefix: e.prefix,
        iconName: ps(e.prefix, e.iconName) || e.iconName
      };
    if (Array.isArray(e) && e.length === 2) {
      const t = e[1].indexOf("fa-") === 0 ? e[1].slice(3) : e[1], n = qo(e[0]);
      return {
        prefix: n,
        iconName: ps(n, t) || t
      };
    }
    if (typeof e == "string" && (e.indexOf("".concat(at.cssPrefix, "-")) > -1 || e.match(Ox))) {
      const t = zo(e.split(" "), {
        skipLookups: !0
      });
      return {
        prefix: t.prefix || ts(),
        iconName: ps(t.prefix, t.iconName) || t.iconName
      };
    }
    if (typeof e == "string") {
      const t = ts();
      return {
        prefix: t,
        iconName: ps(t, e) || e
      };
    }
  }
}, Ye = {
  noAuto: hw,
  config: at,
  dom: dw,
  parse: fw,
  library: Wf,
  findIconDefinition: ec,
  toHtml: fr
}, pw = function() {
  let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
  const {
    autoReplaceSvgRoot: t = qt
  } = e;
  (Object.keys(_n.styles).length > 0 || at.autoFetchSvg) && Wn && at.autoReplaceSvg && Ye.dom.i2svg({
    node: t
  });
};
function Go(e, t) {
  return Object.defineProperty(e, "abstract", {
    get: t
  }), Object.defineProperty(e, "html", {
    get: function() {
      return e.abstract.map((n) => fr(n));
    }
  }), Object.defineProperty(e, "node", {
    get: function() {
      if (!Wn) return;
      const n = qt.createElement("div");
      return n.innerHTML = e.html, n.children;
    }
  }), e;
}
function mw(e) {
  let {
    children: t,
    main: n,
    mask: s,
    attributes: i,
    styles: r,
    transform: o
  } = e;
  if (El(o) && n.found && !s.found) {
    const {
      width: a,
      height: c
    } = n, l = {
      x: a / c / 2,
      y: 0.5
    };
    i.style = $o($($({}, r), {}, {
      "transform-origin": "".concat(l.x + o.x / 16, "em ").concat(l.y + o.y / 16, "em")
    }));
  }
  return [{
    tag: "svg",
    attributes: i,
    children: t
  }];
}
function gw(e) {
  let {
    prefix: t,
    iconName: n,
    children: s,
    attributes: i,
    symbol: r
  } = e;
  const o = r === !0 ? "".concat(t, "-").concat(at.cssPrefix, "-").concat(n) : r;
  return [{
    tag: "svg",
    attributes: {
      style: "display: none;"
    },
    children: [{
      tag: "symbol",
      attributes: $($({}, i), {}, {
        id: o
      }),
      children: s
    }]
  }];
}
function Ol(e) {
  const {
    icons: {
      main: t,
      mask: n
    },
    prefix: s,
    iconName: i,
    transform: r,
    symbol: o,
    title: a,
    maskId: c,
    titleId: l,
    extra: u,
    watchable: h = !1
  } = e, {
    width: d,
    height: p
  } = n.found ? n : t, f = gx.includes(s), _ = [at.replacementClass, i ? "".concat(at.cssPrefix, "-").concat(i) : ""].filter((y) => u.classes.indexOf(y) === -1).filter((y) => y !== "" || !!y).concat(u.classes).join(" ");
  let m = {
    children: [],
    attributes: $($({}, u.attributes), {}, {
      "data-prefix": s,
      "data-icon": i,
      class: _,
      role: u.attributes.role || "img",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 ".concat(d, " ").concat(p)
    })
  };
  const g = f && !~u.classes.indexOf("fa-fw") ? {
    width: "".concat(d / p * 16 * 0.0625, "em")
  } : {};
  h && (m.attributes[_s] = ""), a && (m.children.push({
    tag: "title",
    attributes: {
      id: m.attributes["aria-labelledby"] || "title-".concat(l || ji())
    },
    children: [a]
  }), delete m.attributes.title);
  const b = $($({}, m), {}, {
    prefix: s,
    iconName: i,
    main: t,
    mask: n,
    maskId: c,
    transform: r,
    symbol: o,
    styles: $($({}, g), u.styles)
  }), {
    children: v,
    attributes: x
  } = n.found && t.found ? es("generateAbstractMask", b) || {
    children: [],
    attributes: {}
  } : es("generateAbstractIcon", b) || {
    children: [],
    attributes: {}
  };
  return b.children = v, b.attributes = x, o ? gw(b) : mw(b);
}
function Xu(e) {
  const {
    content: t,
    width: n,
    height: s,
    transform: i,
    title: r,
    extra: o,
    watchable: a = !1
  } = e, c = $($($({}, o.attributes), r ? {
    title: r
  } : {}), {}, {
    class: o.classes.join(" ")
  });
  a && (c[_s] = "");
  const l = $({}, o.styles);
  El(i) && (l.transform = zx({
    transform: i,
    startCentered: !0,
    width: n,
    height: s
  }), l["-webkit-transform"] = l.transform);
  const u = $o(l);
  u.length > 0 && (c.style = u);
  const h = [];
  return h.push({
    tag: "span",
    attributes: c,
    children: [t]
  }), r && h.push({
    tag: "span",
    attributes: {
      class: "sr-only"
    },
    children: [r]
  }), h;
}
function _w(e) {
  const {
    content: t,
    title: n,
    extra: s
  } = e, i = $($($({}, s.attributes), n ? {
    title: n
  } : {}), {}, {
    class: s.classes.join(" ")
  }), r = $o(s.styles);
  r.length > 0 && (i.style = r);
  const o = [];
  return o.push({
    tag: "span",
    attributes: i,
    children: [t]
  }), n && o.push({
    tag: "span",
    attributes: {
      class: "sr-only"
    },
    children: [n]
  }), o;
}
const {
  styles: ga
} = _n;
function nc(e) {
  const t = e[0], n = e[1], [s] = e.slice(4);
  let i = null;
  return Array.isArray(s) ? i = {
    tag: "g",
    attributes: {
      class: "".concat(at.cssPrefix, "-").concat(fa.GROUP)
    },
    children: [{
      tag: "path",
      attributes: {
        class: "".concat(at.cssPrefix, "-").concat(fa.SECONDARY),
        fill: "currentColor",
        d: s[0]
      }
    }, {
      tag: "path",
      attributes: {
        class: "".concat(at.cssPrefix, "-").concat(fa.PRIMARY),
        fill: "currentColor",
        d: s[1]
      }
    }]
  } : i = {
    tag: "path",
    attributes: {
      fill: "currentColor",
      d: s
    }
  }, {
    found: !0,
    width: t,
    height: n,
    icon: i
  };
}
const yw = {
  found: !1,
  width: 512,
  height: 512
};
function vw(e, t) {
  !xf && !at.showMissingIcons && e && console.error('Icon with name "'.concat(e, '" and prefix "').concat(t, '" is missing.'));
}
function sc(e, t) {
  let n = t;
  return t === "fa" && at.styleDefault !== null && (t = ts()), new Promise((s, i) => {
    if (n === "fa") {
      const r = Nf(e) || {};
      e = r.iconName || e, t = r.prefix || t;
    }
    if (e && t && ga[t] && ga[t][e]) {
      const r = ga[t][e];
      return s(nc(r));
    }
    vw(e, t), s($($({}, yw), {}, {
      icon: at.showMissingIcons && e ? es("missingIconAbstract") || {} : {}
    }));
  });
}
const Uu = () => {
}, ic = at.measurePerformance && Tr && Tr.mark && Tr.measure ? Tr : {
  mark: Uu,
  measure: Uu
}, ki = 'FA "6.7.2"', bw = (e) => (ic.mark("".concat(ki, " ").concat(e, " begins")), () => jf(e)), jf = (e) => {
  ic.mark("".concat(ki, " ").concat(e, " ends")), ic.measure("".concat(ki, " ").concat(e), "".concat(ki, " ").concat(e, " begins"), "".concat(ki, " ").concat(e, " ends"));
};
var Ml = {
  begin: bw,
  end: jf
};
const Fr = () => {
};
function Hu(e) {
  return typeof (e.getAttribute ? e.getAttribute(_s) : null) == "string";
}
function xw(e) {
  const t = e.getAttribute ? e.getAttribute(Tl) : null, n = e.getAttribute ? e.getAttribute(Al) : null;
  return t && n;
}
function ww(e) {
  return e && e.classList && e.classList.contains && e.classList.contains(at.replacementClass);
}
function Cw() {
  return at.autoReplaceSvg === !0 ? Pr.replace : Pr[at.autoReplaceSvg] || Pr.replace;
}
function Sw(e) {
  return qt.createElementNS("http://www.w3.org/2000/svg", e);
}
function Tw(e) {
  return qt.createElement(e);
}
function Lf(e) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  const {
    ceFn: n = e.tag === "svg" ? Sw : Tw
  } = t;
  if (typeof e == "string")
    return qt.createTextNode(e);
  const s = n(e.tag);
  return Object.keys(e.attributes || []).forEach(function(r) {
    s.setAttribute(r, e.attributes[r]);
  }), (e.children || []).forEach(function(r) {
    s.appendChild(Lf(r, {
      ceFn: n
    }));
  }), s;
}
function Aw(e) {
  let t = " ".concat(e.outerHTML, " ");
  return t = "".concat(t, "Font Awesome fontawesome.com "), t;
}
const Pr = {
  replace: function(e) {
    const t = e[0];
    if (t.parentNode)
      if (e[1].forEach((n) => {
        t.parentNode.insertBefore(Lf(n), t);
      }), t.getAttribute(_s) === null && at.keepOriginalSource) {
        let n = qt.createComment(Aw(t));
        t.parentNode.replaceChild(n, t);
      } else
        t.remove();
  },
  nest: function(e) {
    const t = e[0], n = e[1];
    if (~Il(t).indexOf(at.replacementClass))
      return Pr.replace(e);
    const s = new RegExp("".concat(at.cssPrefix, "-.*"));
    if (delete n[0].attributes.id, n[0].attributes.class) {
      const r = n[0].attributes.class.split(" ").reduce((o, a) => (a === at.replacementClass || a.match(s) ? o.toSvg.push(a) : o.toNode.push(a), o), {
        toNode: [],
        toSvg: []
      });
      n[0].attributes.class = r.toSvg.join(" "), r.toNode.length === 0 ? t.removeAttribute("class") : t.setAttribute("class", r.toNode.join(" "));
    }
    const i = n.map((r) => fr(r)).join(`
`);
    t.setAttribute(_s, ""), t.innerHTML = i;
  }
};
function Ku(e) {
  e();
}
function Bf(e, t) {
  const n = typeof t == "function" ? t : Fr;
  if (e.length === 0)
    n();
  else {
    let s = Ku;
    at.mutateApproach === Ex && (s = Jn.requestAnimationFrame || Ku), s(() => {
      const i = Cw(), r = Ml.begin("mutate");
      e.map(i), r(), n();
    });
  }
}
let Fl = !1;
function $f() {
  Fl = !0;
}
function rc() {
  Fl = !1;
}
let Qr = null;
function Qu(e) {
  if (!Wu || !at.observeMutations)
    return;
  const {
    treeCallback: t = Fr,
    nodeCallback: n = Fr,
    pseudoElementsCallback: s = Fr,
    observeMutationsRoot: i = qt
  } = e;
  Qr = new Wu((r) => {
    if (Fl) return;
    const o = ts();
    pi(r).forEach((a) => {
      if (a.type === "childList" && a.addedNodes.length > 0 && !Hu(a.addedNodes[0]) && (at.searchPseudoElements && s(a.target), t(a.target)), a.type === "attributes" && a.target.parentNode && at.searchPseudoElements && s(a.target.parentNode), a.type === "attributes" && Hu(a.target) && ~Px.indexOf(a.attributeName))
        if (a.attributeName === "class" && xw(a.target)) {
          const {
            prefix: c,
            iconName: l
          } = zo(Il(a.target));
          a.target.setAttribute(Tl, c || o), l && a.target.setAttribute(Al, l);
        } else ww(a.target) && n(a.target);
    });
  }), Wn && Qr.observe(i, {
    childList: !0,
    attributes: !0,
    characterData: !0,
    subtree: !0
  });
}
function kw() {
  Qr && Qr.disconnect();
}
function Iw(e) {
  const t = e.getAttribute("style");
  let n = [];
  return t && (n = t.split(";").reduce((s, i) => {
    const r = i.split(":"), o = r[0], a = r.slice(1);
    return o && a.length > 0 && (s[o] = a.join(":").trim()), s;
  }, {})), n;
}
function Ew(e) {
  const t = e.getAttribute("data-prefix"), n = e.getAttribute("data-icon"), s = e.innerText !== void 0 ? e.innerText.trim() : "";
  let i = zo(Il(e));
  return i.prefix || (i.prefix = ts()), t && n && (i.prefix = t, i.iconName = n), i.iconName && i.prefix || (i.prefix && s.length > 0 && (i.iconName = tw(i.prefix, e.innerText) || Rl(i.prefix, Qa(e.innerText))), !i.iconName && at.autoFetchSvg && e.firstChild && e.firstChild.nodeType === Node.TEXT_NODE && (i.iconName = e.firstChild.data)), i;
}
function Dw(e) {
  const t = pi(e.attributes).reduce((i, r) => (i.name !== "class" && i.name !== "style" && (i[r.name] = r.value), i), {}), n = e.getAttribute("title"), s = e.getAttribute("data-fa-title-id");
  return at.autoA11y && (n ? t["aria-labelledby"] = "".concat(at.replacementClass, "-title-").concat(s || ji()) : (t["aria-hidden"] = "true", t.focusable = "false")), t;
}
function Rw() {
  return {
    iconName: null,
    title: null,
    titleId: null,
    prefix: null,
    transform: gn,
    symbol: !1,
    mask: {
      iconName: null,
      prefix: null,
      rest: []
    },
    maskId: null,
    extra: {
      classes: [],
      styles: {},
      attributes: {}
    }
  };
}
function Ju(e) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {
    styleParser: !0
  };
  const {
    iconName: n,
    prefix: s,
    rest: i
  } = Ew(e), r = Dw(e), o = tc("parseNodeAttributes", {}, e);
  let a = t.styleParser ? Iw(e) : [];
  return $({
    iconName: n,
    title: e.getAttribute("title"),
    titleId: e.getAttribute("data-fa-title-id"),
    prefix: s,
    transform: gn,
    mask: {
      iconName: null,
      prefix: null,
      rest: []
    },
    maskId: null,
    symbol: !1,
    extra: {
      classes: i,
      styles: a,
      attributes: r
    }
  }, o);
}
const {
  styles: Ow
} = _n;
function qf(e) {
  const t = at.autoReplaceSvg === "nest" ? Ju(e, {
    styleParser: !1
  }) : Ju(e);
  return ~t.extra.classes.indexOf(Cf) ? es("generateLayersText", e, t) : es("generateSvgReplacementMutation", e, t);
}
function Mw() {
  return [...fx, ...Za];
}
function th(e) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
  if (!Wn) return Promise.resolve();
  const n = qt.documentElement.classList, s = (u) => n.add("".concat(Bu, "-").concat(u)), i = (u) => n.remove("".concat(Bu, "-").concat(u)), r = at.autoFetchSvg ? Mw() : gf.concat(Object.keys(Ow));
  r.includes("fa") || r.push("fa");
  const o = [".".concat(Cf, ":not([").concat(_s, "])")].concat(r.map((u) => ".".concat(u, ":not([").concat(_s, "])"))).join(", ");
  if (o.length === 0)
    return Promise.resolve();
  let a = [];
  try {
    a = pi(e.querySelectorAll(o));
  } catch {
  }
  if (a.length > 0)
    s("pending"), i("complete");
  else
    return Promise.resolve();
  const c = Ml.begin("onTree"), l = a.reduce((u, h) => {
    try {
      const d = qf(h);
      d && u.push(d);
    } catch (d) {
      xf || d.name === "MissingIcon" && console.error(d);
    }
    return u;
  }, []);
  return new Promise((u, h) => {
    Promise.all(l).then((d) => {
      Bf(d, () => {
        s("active"), s("complete"), i("pending"), typeof t == "function" && t(), c(), u();
      });
    }).catch((d) => {
      c(), h(d);
    });
  });
}
function Fw(e) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
  qf(e).then((n) => {
    n && Bf([n], t);
  });
}
function Pw(e) {
  return function(t) {
    let n = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    const s = (t || {}).icon ? t : ec(t || {});
    let {
      mask: i
    } = n;
    return i && (i = (i || {}).icon ? i : ec(i || {})), e(s, $($({}, n), {}, {
      mask: i
    }));
  };
}
const Nw = function(e) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  const {
    transform: n = gn,
    symbol: s = !1,
    mask: i = null,
    maskId: r = null,
    title: o = null,
    titleId: a = null,
    classes: c = [],
    attributes: l = {},
    styles: u = {}
  } = t;
  if (!e) return;
  const {
    prefix: h,
    iconName: d,
    icon: p
  } = e;
  return Go($({
    type: "icon"
  }, e), () => (ys("beforeDOMElementCreation", {
    iconDefinition: e,
    params: t
  }), at.autoA11y && (o ? l["aria-labelledby"] = "".concat(at.replacementClass, "-title-").concat(a || ji()) : (l["aria-hidden"] = "true", l.focusable = "false")), Ol({
    icons: {
      main: nc(p),
      mask: i ? nc(i.icon) : {
        found: !1,
        width: null,
        height: null,
        icon: {}
      }
    },
    prefix: h,
    iconName: d,
    transform: $($({}, gn), n),
    symbol: s,
    title: o,
    maskId: r,
    titleId: a,
    extra: {
      attributes: l,
      styles: u,
      classes: c
    }
  })));
};
var Vw = {
  mixout() {
    return {
      icon: Pw(Nw)
    };
  },
  hooks() {
    return {
      mutationObserverCallbacks(e) {
        return e.treeCallback = th, e.nodeCallback = Fw, e;
      }
    };
  },
  provides(e) {
    e.i2svg = function(t) {
      const {
        node: n = qt,
        callback: s = () => {
        }
      } = t;
      return th(n, s);
    }, e.generateSvgReplacementMutation = function(t, n) {
      const {
        iconName: s,
        title: i,
        titleId: r,
        prefix: o,
        transform: a,
        symbol: c,
        mask: l,
        maskId: u,
        extra: h
      } = n;
      return new Promise((d, p) => {
        Promise.all([sc(s, o), l.iconName ? sc(l.iconName, l.prefix) : Promise.resolve({
          found: !1,
          width: 512,
          height: 512,
          icon: {}
        })]).then((f) => {
          let [_, m] = f;
          d([t, Ol({
            icons: {
              main: _,
              mask: m
            },
            prefix: o,
            iconName: s,
            transform: a,
            symbol: c,
            maskId: u,
            title: i,
            titleId: r,
            extra: h,
            watchable: !0
          })]);
        }).catch(p);
      });
    }, e.generateAbstractIcon = function(t) {
      let {
        children: n,
        attributes: s,
        main: i,
        transform: r,
        styles: o
      } = t;
      const a = $o(o);
      a.length > 0 && (s.style = a);
      let c;
      return El(r) && (c = es("generateAbstractTransformGrouping", {
        main: i,
        transform: r,
        containerWidth: i.width,
        iconWidth: i.width
      })), n.push(c || i.icon), {
        children: n,
        attributes: s
      };
    };
  }
}, Ww = {
  mixout() {
    return {
      layer(e) {
        let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        const {
          classes: n = []
        } = t;
        return Go({
          type: "layer"
        }, () => {
          ys("beforeDOMElementCreation", {
            assembler: e,
            params: t
          });
          let s = [];
          return e((i) => {
            Array.isArray(i) ? i.map((r) => {
              s = s.concat(r.abstract);
            }) : s = s.concat(i.abstract);
          }), [{
            tag: "span",
            attributes: {
              class: ["".concat(at.cssPrefix, "-layers"), ...n].join(" ")
            },
            children: s
          }];
        });
      }
    };
  }
}, jw = {
  mixout() {
    return {
      counter(e) {
        let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        const {
          title: n = null,
          classes: s = [],
          attributes: i = {},
          styles: r = {}
        } = t;
        return Go({
          type: "counter",
          content: e
        }, () => (ys("beforeDOMElementCreation", {
          content: e,
          params: t
        }), _w({
          content: e.toString(),
          title: n,
          extra: {
            attributes: i,
            styles: r,
            classes: ["".concat(at.cssPrefix, "-layers-counter"), ...s]
          }
        })));
      }
    };
  }
}, Lw = {
  mixout() {
    return {
      text(e) {
        let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        const {
          transform: n = gn,
          title: s = null,
          classes: i = [],
          attributes: r = {},
          styles: o = {}
        } = t;
        return Go({
          type: "text",
          content: e
        }, () => (ys("beforeDOMElementCreation", {
          content: e,
          params: t
        }), Xu({
          content: e,
          transform: $($({}, gn), n),
          title: s,
          extra: {
            attributes: r,
            styles: o,
            classes: ["".concat(at.cssPrefix, "-layers-text"), ...i]
          }
        })));
      }
    };
  },
  provides(e) {
    e.generateLayersText = function(t, n) {
      const {
        title: s,
        transform: i,
        extra: r
      } = n;
      let o = null, a = null;
      if (pf) {
        const c = parseInt(getComputedStyle(t).fontSize, 10), l = t.getBoundingClientRect();
        o = l.width / c, a = l.height / c;
      }
      return at.autoA11y && !s && (r.attributes["aria-hidden"] = "true"), Promise.resolve([t, Xu({
        content: t.innerHTML,
        width: o,
        height: a,
        transform: i,
        title: s,
        extra: r,
        watchable: !0
      })]);
    };
  }
};
const Bw = new RegExp('"', "ug"), eh = [1105920, 1112319], nh = $($($($({}, {
  FontAwesome: {
    normal: "fas",
    400: "fas"
  }
}), ux), kx), bx), oc = Object.keys(nh).reduce((e, t) => (e[t.toLowerCase()] = nh[t], e), {}), $w = Object.keys(oc).reduce((e, t) => {
  const n = oc[t];
  return e[t] = n[900] || [...Object.entries(n)][0][1], e;
}, {});
function qw(e) {
  const t = e.replace(Bw, ""), n = Ux(t, 0), s = n >= eh[0] && n <= eh[1], i = t.length === 2 ? t[0] === t[1] : !1;
  return {
    value: Qa(i ? t[0] : t),
    isSecondary: s || i
  };
}
function zw(e, t) {
  const n = e.replace(/^['"]|['"]$/g, "").toLowerCase(), s = parseInt(t), i = isNaN(s) ? "normal" : s;
  return (oc[n] || {})[i] || $w[n];
}
function sh(e, t) {
  const n = "".concat(Ix).concat(t.replace(":", "-"));
  return new Promise((s, i) => {
    if (e.getAttribute(n) !== null)
      return s();
    const o = pi(e.children).filter((d) => d.getAttribute(Xa) === t)[0], a = Jn.getComputedStyle(e, t), c = a.getPropertyValue("font-family"), l = c.match(Mx), u = a.getPropertyValue("font-weight"), h = a.getPropertyValue("content");
    if (o && !l)
      return e.removeChild(o), s();
    if (l && h !== "none" && h !== "") {
      const d = a.getPropertyValue("content");
      let p = zw(c, u);
      const {
        value: f,
        isSecondary: _
      } = qw(d), m = l[0].startsWith("FontAwesome");
      let g = Rl(p, f), b = g;
      if (m) {
        const v = ew(f);
        v.iconName && v.prefix && (g = v.iconName, p = v.prefix);
      }
      if (g && !_ && (!o || o.getAttribute(Tl) !== p || o.getAttribute(Al) !== b)) {
        e.setAttribute(n, b), o && e.removeChild(o);
        const v = Rw(), {
          extra: x
        } = v;
        x.attributes[Xa] = t, sc(g, p).then((y) => {
          const w = Ol($($({}, v), {}, {
            icons: {
              main: y,
              mask: Vf()
            },
            prefix: p,
            iconName: b,
            extra: x,
            watchable: !0
          })), S = qt.createElementNS("http://www.w3.org/2000/svg", "svg");
          t === "::before" ? e.insertBefore(S, e.firstChild) : e.appendChild(S), S.outerHTML = w.map((C) => fr(C)).join(`
`), e.removeAttribute(n), s();
        }).catch(i);
      } else
        s();
    } else
      s();
  });
}
function Gw(e) {
  return Promise.all([sh(e, "::before"), sh(e, "::after")]);
}
function Zw(e) {
  return e.parentNode !== document.head && !~Dx.indexOf(e.tagName.toUpperCase()) && !e.getAttribute(Xa) && (!e.parentNode || e.parentNode.tagName !== "svg");
}
function ih(e) {
  if (Wn)
    return new Promise((t, n) => {
      const s = pi(e.querySelectorAll("*")).filter(Zw).map(Gw), i = Ml.begin("searchPseudoElements");
      $f(), Promise.all(s).then(() => {
        i(), rc(), t();
      }).catch(() => {
        i(), rc(), n();
      });
    });
}
var Yw = {
  hooks() {
    return {
      mutationObserverCallbacks(e) {
        return e.pseudoElementsCallback = ih, e;
      }
    };
  },
  provides(e) {
    e.pseudoElements2svg = function(t) {
      const {
        node: n = qt
      } = t;
      at.searchPseudoElements && ih(n);
    };
  }
};
let rh = !1;
var Xw = {
  mixout() {
    return {
      dom: {
        unwatch() {
          $f(), rh = !0;
        }
      }
    };
  },
  hooks() {
    return {
      bootstrap() {
        Qu(tc("mutationObserverCallbacks", {}));
      },
      noAuto() {
        kw();
      },
      watch(e) {
        const {
          observeMutationsRoot: t
        } = e;
        rh ? rc() : Qu(tc("mutationObserverCallbacks", {
          observeMutationsRoot: t
        }));
      }
    };
  }
};
const oh = (e) => {
  let t = {
    size: 16,
    x: 0,
    y: 0,
    flipX: !1,
    flipY: !1,
    rotate: 0
  };
  return e.toLowerCase().split(" ").reduce((n, s) => {
    const i = s.toLowerCase().split("-"), r = i[0];
    let o = i.slice(1).join("-");
    if (r && o === "h")
      return n.flipX = !0, n;
    if (r && o === "v")
      return n.flipY = !0, n;
    if (o = parseFloat(o), isNaN(o))
      return n;
    switch (r) {
      case "grow":
        n.size = n.size + o;
        break;
      case "shrink":
        n.size = n.size - o;
        break;
      case "left":
        n.x = n.x - o;
        break;
      case "right":
        n.x = n.x + o;
        break;
      case "up":
        n.y = n.y - o;
        break;
      case "down":
        n.y = n.y + o;
        break;
      case "rotate":
        n.rotate = n.rotate + o;
        break;
    }
    return n;
  }, t);
};
var Uw = {
  mixout() {
    return {
      parse: {
        transform: (e) => oh(e)
      }
    };
  },
  hooks() {
    return {
      parseNodeAttributes(e, t) {
        const n = t.getAttribute("data-fa-transform");
        return n && (e.transform = oh(n)), e;
      }
    };
  },
  provides(e) {
    e.generateAbstractTransformGrouping = function(t) {
      let {
        main: n,
        transform: s,
        containerWidth: i,
        iconWidth: r
      } = t;
      const o = {
        transform: "translate(".concat(i / 2, " 256)")
      }, a = "translate(".concat(s.x * 32, ", ").concat(s.y * 32, ") "), c = "scale(".concat(s.size / 16 * (s.flipX ? -1 : 1), ", ").concat(s.size / 16 * (s.flipY ? -1 : 1), ") "), l = "rotate(".concat(s.rotate, " 0 0)"), u = {
        transform: "".concat(a, " ").concat(c, " ").concat(l)
      }, h = {
        transform: "translate(".concat(r / 2 * -1, " -256)")
      }, d = {
        outer: o,
        inner: u,
        path: h
      };
      return {
        tag: "g",
        attributes: $({}, d.outer),
        children: [{
          tag: "g",
          attributes: $({}, d.inner),
          children: [{
            tag: n.icon.tag,
            children: n.icon.children,
            attributes: $($({}, n.icon.attributes), d.path)
          }]
        }]
      };
    };
  }
};
const _a = {
  x: 0,
  y: 0,
  width: "100%",
  height: "100%"
};
function ah(e) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : !0;
  return e.attributes && (e.attributes.fill || t) && (e.attributes.fill = "black"), e;
}
function Hw(e) {
  return e.tag === "g" ? e.children : [e];
}
var Kw = {
  hooks() {
    return {
      parseNodeAttributes(e, t) {
        const n = t.getAttribute("data-fa-mask"), s = n ? zo(n.split(" ").map((i) => i.trim())) : Vf();
        return s.prefix || (s.prefix = ts()), e.mask = s, e.maskId = t.getAttribute("data-fa-mask-id"), e;
      }
    };
  },
  provides(e) {
    e.generateAbstractMask = function(t) {
      let {
        children: n,
        attributes: s,
        main: i,
        mask: r,
        maskId: o,
        transform: a
      } = t;
      const {
        width: c,
        icon: l
      } = i, {
        width: u,
        icon: h
      } = r, d = qx({
        transform: a,
        containerWidth: u,
        iconWidth: c
      }), p = {
        tag: "rect",
        attributes: $($({}, _a), {}, {
          fill: "white"
        })
      }, f = l.children ? {
        children: l.children.map(ah)
      } : {}, _ = {
        tag: "g",
        attributes: $({}, d.inner),
        children: [ah($({
          tag: l.tag,
          attributes: $($({}, l.attributes), d.path)
        }, f))]
      }, m = {
        tag: "g",
        attributes: $({}, d.outer),
        children: [_]
      }, g = "mask-".concat(o || ji()), b = "clip-".concat(o || ji()), v = {
        tag: "mask",
        attributes: $($({}, _a), {}, {
          id: g,
          maskUnits: "userSpaceOnUse",
          maskContentUnits: "userSpaceOnUse"
        }),
        children: [p, m]
      }, x = {
        tag: "defs",
        children: [{
          tag: "clipPath",
          attributes: {
            id: b
          },
          children: Hw(h)
        }, v]
      };
      return n.push(x, {
        tag: "rect",
        attributes: $({
          fill: "currentColor",
          "clip-path": "url(#".concat(b, ")"),
          mask: "url(#".concat(g, ")")
        }, _a)
      }), {
        children: n,
        attributes: s
      };
    };
  }
}, Qw = {
  provides(e) {
    let t = !1;
    Jn.matchMedia && (t = Jn.matchMedia("(prefers-reduced-motion: reduce)").matches), e.missingIconAbstract = function() {
      const n = [], s = {
        fill: "currentColor"
      }, i = {
        attributeType: "XML",
        repeatCount: "indefinite",
        dur: "2s"
      };
      n.push({
        tag: "path",
        attributes: $($({}, s), {}, {
          d: "M156.5,447.7l-12.6,29.5c-18.7-9.5-35.9-21.2-51.5-34.9l22.7-22.7C127.6,430.5,141.5,440,156.5,447.7z M40.6,272H8.5 c1.4,21.2,5.4,41.7,11.7,61.1L50,321.2C45.1,305.5,41.8,289,40.6,272z M40.6,240c1.4-18.8,5.2-37,11.1-54.1l-29.5-12.6 C14.7,194.3,10,216.7,8.5,240H40.6z M64.3,156.5c7.8-14.9,17.2-28.8,28.1-41.5L69.7,92.3c-13.7,15.6-25.5,32.8-34.9,51.5 L64.3,156.5z M397,419.6c-13.9,12-29.4,22.3-46.1,30.4l11.9,29.8c20.7-9.9,39.8-22.6,56.9-37.6L397,419.6z M115,92.4 c13.9-12,29.4-22.3,46.1-30.4l-11.9-29.8c-20.7,9.9-39.8,22.6-56.8,37.6L115,92.4z M447.7,355.5c-7.8,14.9-17.2,28.8-28.1,41.5 l22.7,22.7c13.7-15.6,25.5-32.9,34.9-51.5L447.7,355.5z M471.4,272c-1.4,18.8-5.2,37-11.1,54.1l29.5,12.6 c7.5-21.1,12.2-43.5,13.6-66.8H471.4z M321.2,462c-15.7,5-32.2,8.2-49.2,9.4v32.1c21.2-1.4,41.7-5.4,61.1-11.7L321.2,462z M240,471.4c-18.8-1.4-37-5.2-54.1-11.1l-12.6,29.5c21.1,7.5,43.5,12.2,66.8,13.6V471.4z M462,190.8c5,15.7,8.2,32.2,9.4,49.2h32.1 c-1.4-21.2-5.4-41.7-11.7-61.1L462,190.8z M92.4,397c-12-13.9-22.3-29.4-30.4-46.1l-29.8,11.9c9.9,20.7,22.6,39.8,37.6,56.9 L92.4,397z M272,40.6c18.8,1.4,36.9,5.2,54.1,11.1l12.6-29.5C317.7,14.7,295.3,10,272,8.5V40.6z M190.8,50 c15.7-5,32.2-8.2,49.2-9.4V8.5c-21.2,1.4-41.7,5.4-61.1,11.7L190.8,50z M442.3,92.3L419.6,115c12,13.9,22.3,29.4,30.5,46.1 l29.8-11.9C470,128.5,457.3,109.4,442.3,92.3z M397,92.4l22.7-22.7c-15.6-13.7-32.8-25.5-51.5-34.9l-12.6,29.5 C370.4,72.1,384.4,81.5,397,92.4z"
        })
      });
      const r = $($({}, i), {}, {
        attributeName: "opacity"
      }), o = {
        tag: "circle",
        attributes: $($({}, s), {}, {
          cx: "256",
          cy: "364",
          r: "28"
        }),
        children: []
      };
      return t || o.children.push({
        tag: "animate",
        attributes: $($({}, i), {}, {
          attributeName: "r",
          values: "28;14;28;28;14;28;"
        })
      }, {
        tag: "animate",
        attributes: $($({}, r), {}, {
          values: "1;0;1;1;0;1;"
        })
      }), n.push(o), n.push({
        tag: "path",
        attributes: $($({}, s), {}, {
          opacity: "1",
          d: "M263.7,312h-16c-6.6,0-12-5.4-12-12c0-71,77.4-63.9,77.4-107.8c0-20-17.8-40.2-57.4-40.2c-29.1,0-44.3,9.6-59.2,28.7 c-3.9,5-11.1,6-16.2,2.4l-13.1-9.2c-5.6-3.9-6.9-11.8-2.6-17.2c21.2-27.2,46.4-44.7,91.2-44.7c52.3,0,97.4,29.8,97.4,80.2 c0,67.6-77.4,63.5-77.4,107.8C275.7,306.6,270.3,312,263.7,312z"
        }),
        children: t ? [] : [{
          tag: "animate",
          attributes: $($({}, r), {}, {
            values: "1;0;0;0;0;1;"
          })
        }]
      }), t || n.push({
        tag: "path",
        attributes: $($({}, s), {}, {
          opacity: "0",
          d: "M232.5,134.5l7,168c0.3,6.4,5.6,11.5,12,11.5h9c6.4,0,11.7-5.1,12-11.5l7-168c0.3-6.8-5.2-12.5-12-12.5h-23 C237.7,122,232.2,127.7,232.5,134.5z"
        }),
        children: [{
          tag: "animate",
          attributes: $($({}, r), {}, {
            values: "0;0;1;1;0;0;"
          })
        }]
      }), {
        tag: "g",
        attributes: {
          class: "missing"
        },
        children: n
      };
    };
  }
}, Jw = {
  hooks() {
    return {
      parseNodeAttributes(e, t) {
        const n = t.getAttribute("data-fa-symbol"), s = n === null ? !1 : n === "" ? !0 : n;
        return e.symbol = s, e;
      }
    };
  }
}, t1 = [Zx, Vw, Ww, jw, Lw, Yw, Xw, Uw, Kw, Qw, Jw];
uw(t1, {
  mixoutsTo: Ye
});
Ye.noAuto;
Ye.config;
const e1 = Ye.library;
Ye.dom;
const ac = Ye.parse;
Ye.findIconDefinition;
Ye.toHtml;
const n1 = Ye.icon;
Ye.layer;
Ye.text;
Ye.counter;
var kr = { exports: {} }, Ir = { exports: {} }, Ft = {};
var ch;
function s1() {
  if (ch) return Ft;
  ch = 1;
  var e = typeof Symbol == "function" && Symbol.for, t = e ? Symbol.for("react.element") : 60103, n = e ? Symbol.for("react.portal") : 60106, s = e ? Symbol.for("react.fragment") : 60107, i = e ? Symbol.for("react.strict_mode") : 60108, r = e ? Symbol.for("react.profiler") : 60114, o = e ? Symbol.for("react.provider") : 60109, a = e ? Symbol.for("react.context") : 60110, c = e ? Symbol.for("react.async_mode") : 60111, l = e ? Symbol.for("react.concurrent_mode") : 60111, u = e ? Symbol.for("react.forward_ref") : 60112, h = e ? Symbol.for("react.suspense") : 60113, d = e ? Symbol.for("react.suspense_list") : 60120, p = e ? Symbol.for("react.memo") : 60115, f = e ? Symbol.for("react.lazy") : 60116, _ = e ? Symbol.for("react.block") : 60121, m = e ? Symbol.for("react.fundamental") : 60117, g = e ? Symbol.for("react.responder") : 60118, b = e ? Symbol.for("react.scope") : 60119;
  function v(y) {
    if (typeof y == "object" && y !== null) {
      var w = y.$$typeof;
      switch (w) {
        case t:
          switch (y = y.type, y) {
            case c:
            case l:
            case s:
            case r:
            case i:
            case h:
              return y;
            default:
              switch (y = y && y.$$typeof, y) {
                case a:
                case u:
                case f:
                case p:
                case o:
                  return y;
                default:
                  return w;
              }
          }
        case n:
          return w;
      }
    }
  }
  function x(y) {
    return v(y) === l;
  }
  return Ft.AsyncMode = c, Ft.ConcurrentMode = l, Ft.ContextConsumer = a, Ft.ContextProvider = o, Ft.Element = t, Ft.ForwardRef = u, Ft.Fragment = s, Ft.Lazy = f, Ft.Memo = p, Ft.Portal = n, Ft.Profiler = r, Ft.StrictMode = i, Ft.Suspense = h, Ft.isAsyncMode = function(y) {
    return x(y) || v(y) === c;
  }, Ft.isConcurrentMode = x, Ft.isContextConsumer = function(y) {
    return v(y) === a;
  }, Ft.isContextProvider = function(y) {
    return v(y) === o;
  }, Ft.isElement = function(y) {
    return typeof y == "object" && y !== null && y.$$typeof === t;
  }, Ft.isForwardRef = function(y) {
    return v(y) === u;
  }, Ft.isFragment = function(y) {
    return v(y) === s;
  }, Ft.isLazy = function(y) {
    return v(y) === f;
  }, Ft.isMemo = function(y) {
    return v(y) === p;
  }, Ft.isPortal = function(y) {
    return v(y) === n;
  }, Ft.isProfiler = function(y) {
    return v(y) === r;
  }, Ft.isStrictMode = function(y) {
    return v(y) === i;
  }, Ft.isSuspense = function(y) {
    return v(y) === h;
  }, Ft.isValidElementType = function(y) {
    return typeof y == "string" || typeof y == "function" || y === s || y === l || y === r || y === i || y === h || y === d || typeof y == "object" && y !== null && (y.$$typeof === f || y.$$typeof === p || y.$$typeof === o || y.$$typeof === a || y.$$typeof === u || y.$$typeof === m || y.$$typeof === g || y.$$typeof === b || y.$$typeof === _);
  }, Ft.typeOf = v, Ft;
}
var Pt = {};
var lh;
function i1() {
  return lh || (lh = 1, process.env.NODE_ENV !== "production" && (function() {
    var e = typeof Symbol == "function" && Symbol.for, t = e ? Symbol.for("react.element") : 60103, n = e ? Symbol.for("react.portal") : 60106, s = e ? Symbol.for("react.fragment") : 60107, i = e ? Symbol.for("react.strict_mode") : 60108, r = e ? Symbol.for("react.profiler") : 60114, o = e ? Symbol.for("react.provider") : 60109, a = e ? Symbol.for("react.context") : 60110, c = e ? Symbol.for("react.async_mode") : 60111, l = e ? Symbol.for("react.concurrent_mode") : 60111, u = e ? Symbol.for("react.forward_ref") : 60112, h = e ? Symbol.for("react.suspense") : 60113, d = e ? Symbol.for("react.suspense_list") : 60120, p = e ? Symbol.for("react.memo") : 60115, f = e ? Symbol.for("react.lazy") : 60116, _ = e ? Symbol.for("react.block") : 60121, m = e ? Symbol.for("react.fundamental") : 60117, g = e ? Symbol.for("react.responder") : 60118, b = e ? Symbol.for("react.scope") : 60119;
    function v(U) {
      return typeof U == "string" || typeof U == "function" || // Note: its typeof might be other than 'symbol' or 'number' if it's a polyfill.
      U === s || U === l || U === r || U === i || U === h || U === d || typeof U == "object" && U !== null && (U.$$typeof === f || U.$$typeof === p || U.$$typeof === o || U.$$typeof === a || U.$$typeof === u || U.$$typeof === m || U.$$typeof === g || U.$$typeof === b || U.$$typeof === _);
    }
    function x(U) {
      if (typeof U == "object" && U !== null) {
        var Jt = U.$$typeof;
        switch (Jt) {
          case t:
            var fe = U.type;
            switch (fe) {
              case c:
              case l:
              case s:
              case r:
              case i:
              case h:
                return fe;
              default:
                var Y = fe && fe.$$typeof;
                switch (Y) {
                  case a:
                  case u:
                  case f:
                  case p:
                  case o:
                    return Y;
                  default:
                    return Jt;
                }
            }
          case n:
            return Jt;
        }
      }
    }
    var y = c, w = l, S = a, C = o, D = t, R = u, A = s, I = f, F = p, N = n, V = r, W = i, L = h, J = !1;
    function z(U) {
      return J || (J = !0, console.warn("The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 17+. Update your code to use ReactIs.isConcurrentMode() instead. It has the exact same API.")), E(U) || x(U) === c;
    }
    function E(U) {
      return x(U) === l;
    }
    function O(U) {
      return x(U) === a;
    }
    function Z(U) {
      return x(U) === o;
    }
    function H(U) {
      return typeof U == "object" && U !== null && U.$$typeof === t;
    }
    function G(U) {
      return x(U) === u;
    }
    function X(U) {
      return x(U) === s;
    }
    function Q(U) {
      return x(U) === f;
    }
    function it(U) {
      return x(U) === p;
    }
    function M(U) {
      return x(U) === n;
    }
    function ht(U) {
      return x(U) === r;
    }
    function tt(U) {
      return x(U) === i;
    }
    function Tt(U) {
      return x(U) === h;
    }
    Pt.AsyncMode = y, Pt.ConcurrentMode = w, Pt.ContextConsumer = S, Pt.ContextProvider = C, Pt.Element = D, Pt.ForwardRef = R, Pt.Fragment = A, Pt.Lazy = I, Pt.Memo = F, Pt.Portal = N, Pt.Profiler = V, Pt.StrictMode = W, Pt.Suspense = L, Pt.isAsyncMode = z, Pt.isConcurrentMode = E, Pt.isContextConsumer = O, Pt.isContextProvider = Z, Pt.isElement = H, Pt.isForwardRef = G, Pt.isFragment = X, Pt.isLazy = Q, Pt.isMemo = it, Pt.isPortal = M, Pt.isProfiler = ht, Pt.isStrictMode = tt, Pt.isSuspense = Tt, Pt.isValidElementType = v, Pt.typeOf = x;
  })()), Pt;
}
var uh;
function zf() {
  return uh || (uh = 1, process.env.NODE_ENV === "production" ? Ir.exports = s1() : Ir.exports = i1()), Ir.exports;
}
var ya, hh;
function r1() {
  if (hh) return ya;
  hh = 1;
  var e = Object.getOwnPropertySymbols, t = Object.prototype.hasOwnProperty, n = Object.prototype.propertyIsEnumerable;
  function s(r) {
    if (r == null)
      throw new TypeError("Object.assign cannot be called with null or undefined");
    return Object(r);
  }
  function i() {
    try {
      if (!Object.assign)
        return !1;
      var r = new String("abc");
      if (r[5] = "de", Object.getOwnPropertyNames(r)[0] === "5")
        return !1;
      for (var o = {}, a = 0; a < 10; a++)
        o["_" + String.fromCharCode(a)] = a;
      var c = Object.getOwnPropertyNames(o).map(function(u) {
        return o[u];
      });
      if (c.join("") !== "0123456789")
        return !1;
      var l = {};
      return "abcdefghijklmnopqrst".split("").forEach(function(u) {
        l[u] = u;
      }), Object.keys(Object.assign({}, l)).join("") === "abcdefghijklmnopqrst";
    } catch {
      return !1;
    }
  }
  return ya = i() ? Object.assign : function(r, o) {
    for (var a, c = s(r), l, u = 1; u < arguments.length; u++) {
      a = Object(arguments[u]);
      for (var h in a)
        t.call(a, h) && (c[h] = a[h]);
      if (e) {
        l = e(a);
        for (var d = 0; d < l.length; d++)
          n.call(a, l[d]) && (c[l[d]] = a[l[d]]);
      }
    }
    return c;
  }, ya;
}
var va, dh;
function Pl() {
  if (dh) return va;
  dh = 1;
  var e = "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED";
  return va = e, va;
}
var ba, fh;
function Gf() {
  return fh || (fh = 1, ba = Function.call.bind(Object.prototype.hasOwnProperty)), ba;
}
var xa, ph;
function o1() {
  if (ph) return xa;
  ph = 1;
  var e = function() {
  };
  if (process.env.NODE_ENV !== "production") {
    var t = /* @__PURE__ */ Pl(), n = {}, s = /* @__PURE__ */ Gf();
    e = function(r) {
      var o = "Warning: " + r;
      typeof console < "u" && console.error(o);
      try {
        throw new Error(o);
      } catch {
      }
    };
  }
  function i(r, o, a, c, l) {
    if (process.env.NODE_ENV !== "production") {
      for (var u in r)
        if (s(r, u)) {
          var h;
          try {
            if (typeof r[u] != "function") {
              var d = Error(
                (c || "React class") + ": " + a + " type `" + u + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof r[u] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`."
              );
              throw d.name = "Invariant Violation", d;
            }
            h = r[u](o, u, c, a, null, t);
          } catch (f) {
            h = f;
          }
          if (h && !(h instanceof Error) && e(
            (c || "React class") + ": type specification of " + a + " `" + u + "` is invalid; the type checker function must return `null` or an `Error` but returned a " + typeof h + ". You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument)."
          ), h instanceof Error && !(h.message in n)) {
            n[h.message] = !0;
            var p = l ? l() : "";
            e(
              "Failed " + a + " type: " + h.message + (p ?? "")
            );
          }
        }
    }
  }
  return i.resetWarningCache = function() {
    process.env.NODE_ENV !== "production" && (n = {});
  }, xa = i, xa;
}
var wa, mh;
function a1() {
  if (mh) return wa;
  mh = 1;
  var e = zf(), t = r1(), n = /* @__PURE__ */ Pl(), s = /* @__PURE__ */ Gf(), i = /* @__PURE__ */ o1(), r = function() {
  };
  process.env.NODE_ENV !== "production" && (r = function(a) {
    var c = "Warning: " + a;
    typeof console < "u" && console.error(c);
    try {
      throw new Error(c);
    } catch {
    }
  });
  function o() {
    return null;
  }
  return wa = function(a, c) {
    var l = typeof Symbol == "function" && Symbol.iterator, u = "@@iterator";
    function h(E) {
      var O = E && (l && E[l] || E[u]);
      if (typeof O == "function")
        return O;
    }
    var d = "<<anonymous>>", p = {
      array: g("array"),
      bigint: g("bigint"),
      bool: g("boolean"),
      func: g("function"),
      number: g("number"),
      object: g("object"),
      string: g("string"),
      symbol: g("symbol"),
      any: b(),
      arrayOf: v,
      element: x(),
      elementType: y(),
      instanceOf: w,
      node: R(),
      objectOf: C,
      oneOf: S,
      oneOfType: D,
      shape: I,
      exact: F
    };
    function f(E, O) {
      return E === O ? E !== 0 || 1 / E === 1 / O : E !== E && O !== O;
    }
    function _(E, O) {
      this.message = E, this.data = O && typeof O == "object" ? O : {}, this.stack = "";
    }
    _.prototype = Error.prototype;
    function m(E) {
      if (process.env.NODE_ENV !== "production")
        var O = {}, Z = 0;
      function H(X, Q, it, M, ht, tt, Tt) {
        if (M = M || d, tt = tt || it, Tt !== n) {
          if (c) {
            var U = new Error(
              "Calling PropTypes validators directly is not supported by the `prop-types` package. Use `PropTypes.checkPropTypes()` to call them. Read more at http://fb.me/use-check-prop-types"
            );
            throw U.name = "Invariant Violation", U;
          } else if (process.env.NODE_ENV !== "production" && typeof console < "u") {
            var Jt = M + ":" + it;
            !O[Jt] && // Avoid spamming the console because they are often not actionable except for lib authors
            Z < 3 && (r(
              "You are manually calling a React.PropTypes validation function for the `" + tt + "` prop on `" + M + "`. This is deprecated and will throw in the standalone `prop-types` package. You may be seeing this warning due to a third-party PropTypes library. See https://fb.me/react-warning-dont-call-proptypes for details."
            ), O[Jt] = !0, Z++);
          }
        }
        return Q[it] == null ? X ? Q[it] === null ? new _("The " + ht + " `" + tt + "` is marked as required " + ("in `" + M + "`, but its value is `null`.")) : new _("The " + ht + " `" + tt + "` is marked as required in " + ("`" + M + "`, but its value is `undefined`.")) : null : E(Q, it, M, ht, tt);
      }
      var G = H.bind(null, !1);
      return G.isRequired = H.bind(null, !0), G;
    }
    function g(E) {
      function O(Z, H, G, X, Q, it) {
        var M = Z[H], ht = W(M);
        if (ht !== E) {
          var tt = L(M);
          return new _(
            "Invalid " + X + " `" + Q + "` of type " + ("`" + tt + "` supplied to `" + G + "`, expected ") + ("`" + E + "`."),
            { expectedType: E }
          );
        }
        return null;
      }
      return m(O);
    }
    function b() {
      return m(o);
    }
    function v(E) {
      function O(Z, H, G, X, Q) {
        if (typeof E != "function")
          return new _("Property `" + Q + "` of component `" + G + "` has invalid PropType notation inside arrayOf.");
        var it = Z[H];
        if (!Array.isArray(it)) {
          var M = W(it);
          return new _("Invalid " + X + " `" + Q + "` of type " + ("`" + M + "` supplied to `" + G + "`, expected an array."));
        }
        for (var ht = 0; ht < it.length; ht++) {
          var tt = E(it, ht, G, X, Q + "[" + ht + "]", n);
          if (tt instanceof Error)
            return tt;
        }
        return null;
      }
      return m(O);
    }
    function x() {
      function E(O, Z, H, G, X) {
        var Q = O[Z];
        if (!a(Q)) {
          var it = W(Q);
          return new _("Invalid " + G + " `" + X + "` of type " + ("`" + it + "` supplied to `" + H + "`, expected a single ReactElement."));
        }
        return null;
      }
      return m(E);
    }
    function y() {
      function E(O, Z, H, G, X) {
        var Q = O[Z];
        if (!e.isValidElementType(Q)) {
          var it = W(Q);
          return new _("Invalid " + G + " `" + X + "` of type " + ("`" + it + "` supplied to `" + H + "`, expected a single ReactElement type."));
        }
        return null;
      }
      return m(E);
    }
    function w(E) {
      function O(Z, H, G, X, Q) {
        if (!(Z[H] instanceof E)) {
          var it = E.name || d, M = z(Z[H]);
          return new _("Invalid " + X + " `" + Q + "` of type " + ("`" + M + "` supplied to `" + G + "`, expected ") + ("instance of `" + it + "`."));
        }
        return null;
      }
      return m(O);
    }
    function S(E) {
      if (!Array.isArray(E))
        return process.env.NODE_ENV !== "production" && (arguments.length > 1 ? r(
          "Invalid arguments supplied to oneOf, expected an array, got " + arguments.length + " arguments. A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z])."
        ) : r("Invalid argument supplied to oneOf, expected an array.")), o;
      function O(Z, H, G, X, Q) {
        for (var it = Z[H], M = 0; M < E.length; M++)
          if (f(it, E[M]))
            return null;
        var ht = JSON.stringify(E, function(Tt, U) {
          var Jt = L(U);
          return Jt === "symbol" ? String(U) : U;
        });
        return new _("Invalid " + X + " `" + Q + "` of value `" + String(it) + "` " + ("supplied to `" + G + "`, expected one of " + ht + "."));
      }
      return m(O);
    }
    function C(E) {
      function O(Z, H, G, X, Q) {
        if (typeof E != "function")
          return new _("Property `" + Q + "` of component `" + G + "` has invalid PropType notation inside objectOf.");
        var it = Z[H], M = W(it);
        if (M !== "object")
          return new _("Invalid " + X + " `" + Q + "` of type " + ("`" + M + "` supplied to `" + G + "`, expected an object."));
        for (var ht in it)
          if (s(it, ht)) {
            var tt = E(it, ht, G, X, Q + "." + ht, n);
            if (tt instanceof Error)
              return tt;
          }
        return null;
      }
      return m(O);
    }
    function D(E) {
      if (!Array.isArray(E))
        return process.env.NODE_ENV !== "production" && r("Invalid argument supplied to oneOfType, expected an instance of array."), o;
      for (var O = 0; O < E.length; O++) {
        var Z = E[O];
        if (typeof Z != "function")
          return r(
            "Invalid argument supplied to oneOfType. Expected an array of check functions, but received " + J(Z) + " at index " + O + "."
          ), o;
      }
      function H(G, X, Q, it, M) {
        for (var ht = [], tt = 0; tt < E.length; tt++) {
          var Tt = E[tt], U = Tt(G, X, Q, it, M, n);
          if (U == null)
            return null;
          U.data && s(U.data, "expectedType") && ht.push(U.data.expectedType);
        }
        var Jt = ht.length > 0 ? ", expected one of type [" + ht.join(", ") + "]" : "";
        return new _("Invalid " + it + " `" + M + "` supplied to " + ("`" + Q + "`" + Jt + "."));
      }
      return m(H);
    }
    function R() {
      function E(O, Z, H, G, X) {
        return N(O[Z]) ? null : new _("Invalid " + G + " `" + X + "` supplied to " + ("`" + H + "`, expected a ReactNode."));
      }
      return m(E);
    }
    function A(E, O, Z, H, G) {
      return new _(
        (E || "React class") + ": " + O + " type `" + Z + "." + H + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + G + "`."
      );
    }
    function I(E) {
      function O(Z, H, G, X, Q) {
        var it = Z[H], M = W(it);
        if (M !== "object")
          return new _("Invalid " + X + " `" + Q + "` of type `" + M + "` " + ("supplied to `" + G + "`, expected `object`."));
        for (var ht in E) {
          var tt = E[ht];
          if (typeof tt != "function")
            return A(G, X, Q, ht, L(tt));
          var Tt = tt(it, ht, G, X, Q + "." + ht, n);
          if (Tt)
            return Tt;
        }
        return null;
      }
      return m(O);
    }
    function F(E) {
      function O(Z, H, G, X, Q) {
        var it = Z[H], M = W(it);
        if (M !== "object")
          return new _("Invalid " + X + " `" + Q + "` of type `" + M + "` " + ("supplied to `" + G + "`, expected `object`."));
        var ht = t({}, Z[H], E);
        for (var tt in ht) {
          var Tt = E[tt];
          if (s(E, tt) && typeof Tt != "function")
            return A(G, X, Q, tt, L(Tt));
          if (!Tt)
            return new _(
              "Invalid " + X + " `" + Q + "` key `" + tt + "` supplied to `" + G + "`.\nBad object: " + JSON.stringify(Z[H], null, "  ") + `
Valid keys: ` + JSON.stringify(Object.keys(E), null, "  ")
            );
          var U = Tt(it, tt, G, X, Q + "." + tt, n);
          if (U)
            return U;
        }
        return null;
      }
      return m(O);
    }
    function N(E) {
      switch (typeof E) {
        case "number":
        case "string":
        case "undefined":
          return !0;
        case "boolean":
          return !E;
        case "object":
          if (Array.isArray(E))
            return E.every(N);
          if (E === null || a(E))
            return !0;
          var O = h(E);
          if (O) {
            var Z = O.call(E), H;
            if (O !== E.entries) {
              for (; !(H = Z.next()).done; )
                if (!N(H.value))
                  return !1;
            } else
              for (; !(H = Z.next()).done; ) {
                var G = H.value;
                if (G && !N(G[1]))
                  return !1;
              }
          } else
            return !1;
          return !0;
        default:
          return !1;
      }
    }
    function V(E, O) {
      return E === "symbol" ? !0 : O ? O["@@toStringTag"] === "Symbol" || typeof Symbol == "function" && O instanceof Symbol : !1;
    }
    function W(E) {
      var O = typeof E;
      return Array.isArray(E) ? "array" : E instanceof RegExp ? "object" : V(O, E) ? "symbol" : O;
    }
    function L(E) {
      if (typeof E > "u" || E === null)
        return "" + E;
      var O = W(E);
      if (O === "object") {
        if (E instanceof Date)
          return "date";
        if (E instanceof RegExp)
          return "regexp";
      }
      return O;
    }
    function J(E) {
      var O = L(E);
      switch (O) {
        case "array":
        case "object":
          return "an " + O;
        case "boolean":
        case "date":
        case "regexp":
          return "a " + O;
        default:
          return O;
      }
    }
    function z(E) {
      return !E.constructor || !E.constructor.name ? d : E.constructor.name;
    }
    return p.checkPropTypes = i, p.resetWarningCache = i.resetWarningCache, p.PropTypes = p, p;
  }, wa;
}
var Ca, gh;
function c1() {
  if (gh) return Ca;
  gh = 1;
  var e = /* @__PURE__ */ Pl();
  function t() {
  }
  function n() {
  }
  return n.resetWarningCache = t, Ca = function() {
    function s(o, a, c, l, u, h) {
      if (h !== e) {
        var d = new Error(
          "Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types"
        );
        throw d.name = "Invariant Violation", d;
      }
    }
    s.isRequired = s;
    function i() {
      return s;
    }
    var r = {
      array: s,
      bigint: s,
      bool: s,
      func: s,
      number: s,
      object: s,
      string: s,
      symbol: s,
      any: s,
      arrayOf: i,
      element: s,
      elementType: s,
      instanceOf: i,
      node: s,
      objectOf: i,
      oneOf: i,
      oneOfType: i,
      shape: i,
      exact: i,
      checkPropTypes: n,
      resetWarningCache: t
    };
    return r.PropTypes = r, r;
  }, Ca;
}
var _h;
function l1() {
  if (_h) return kr.exports;
  if (_h = 1, process.env.NODE_ENV !== "production") {
    var e = zf(), t = !0;
    kr.exports = /* @__PURE__ */ a1()(e.isElement, t);
  } else
    kr.exports = /* @__PURE__ */ c1()();
  return kr.exports;
}
var u1 = /* @__PURE__ */ l1();
const Ct = /* @__PURE__ */ Zh(u1);
function cc(e, t) {
  (t == null || t > e.length) && (t = e.length);
  for (var n = 0, s = Array(t); n < t; n++) s[n] = e[n];
  return s;
}
function h1(e) {
  if (Array.isArray(e)) return e;
}
function d1(e) {
  if (Array.isArray(e)) return cc(e);
}
function zn(e, t, n) {
  return (t = b1(t)) in e ? Object.defineProperty(e, t, {
    value: n,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = n, e;
}
function f1(e) {
  if (typeof Symbol < "u" && e[Symbol.iterator] != null || e["@@iterator"] != null) return Array.from(e);
}
function p1(e, t) {
  var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
  if (n != null) {
    var s, i, r, o, a = [], c = !0, l = !1;
    try {
      if (r = (n = n.call(e)).next, t !== 0) for (; !(c = (s = r.call(n)).done) && (a.push(s.value), a.length !== t); c = !0) ;
    } catch (u) {
      l = !0, i = u;
    } finally {
      try {
        if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
      } finally {
        if (l) throw i;
      }
    }
    return a;
  }
}
function m1() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function g1() {
  throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function yh(e, t) {
  var n = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var s = Object.getOwnPropertySymbols(e);
    t && (s = s.filter(function(i) {
      return Object.getOwnPropertyDescriptor(e, i).enumerable;
    })), n.push.apply(n, s);
  }
  return n;
}
function pn(e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t] != null ? arguments[t] : {};
    t % 2 ? yh(Object(n), !0).forEach(function(s) {
      zn(e, s, n[s]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : yh(Object(n)).forEach(function(s) {
      Object.defineProperty(e, s, Object.getOwnPropertyDescriptor(n, s));
    });
  }
  return e;
}
function _1(e, t) {
  if (e == null) return {};
  var n, s, i = y1(e, t);
  if (Object.getOwnPropertySymbols) {
    var r = Object.getOwnPropertySymbols(e);
    for (s = 0; s < r.length; s++) n = r[s], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
  }
  return i;
}
function y1(e, t) {
  if (e == null) return {};
  var n = {};
  for (var s in e) if ({}.hasOwnProperty.call(e, s)) {
    if (t.indexOf(s) !== -1) continue;
    n[s] = e[s];
  }
  return n;
}
function vh(e, t) {
  return h1(e) || p1(e, t) || Zf(e, t) || m1();
}
function lc(e) {
  return d1(e) || f1(e) || Zf(e) || g1();
}
function v1(e, t) {
  if (typeof e != "object" || !e) return e;
  var n = e[Symbol.toPrimitive];
  if (n !== void 0) {
    var s = n.call(e, t);
    if (typeof s != "object") return s;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e);
}
function b1(e) {
  var t = v1(e, "string");
  return typeof t == "symbol" ? t : t + "";
}
function Jr(e) {
  "@babel/helpers - typeof";
  return Jr = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, Jr(e);
}
function Zf(e, t) {
  if (e) {
    if (typeof e == "string") return cc(e, t);
    var n = {}.toString.call(e).slice(8, -1);
    return n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set" ? Array.from(e) : n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? cc(e, t) : void 0;
  }
}
var x1 = "7.0.0", uc;
try {
  var w1 = require("@fortawesome/fontawesome-svg-core/package.json");
  uc = w1.version;
} catch {
  uc = typeof process < "u" && process.env.FA_VERSION || "7.0.0";
}
function C1(e) {
  var t = e.beat, n = e.fade, s = e.beatFade, i = e.bounce, r = e.shake, o = e.flash, a = e.spin, c = e.spinPulse, l = e.spinReverse, u = e.pulse, h = e.fixedWidth, d = e.inverse, p = e.border, f = e.listItem, _ = e.flip, m = e.size, g = e.rotation, b = e.pull, v = e.swapOpacity, x = e.rotateBy, y = e.widthAuto, w = S1(uc, x1), S = zn(zn(zn(zn(zn(zn({
    "fa-beat": t,
    "fa-fade": n,
    "fa-beat-fade": s,
    "fa-bounce": i,
    "fa-shake": r,
    "fa-flash": o,
    "fa-spin": a,
    "fa-spin-reverse": l,
    "fa-spin-pulse": c,
    "fa-pulse": u,
    "fa-fw": h,
    "fa-inverse": d,
    "fa-border": p,
    "fa-li": f,
    "fa-flip": _ === !0,
    "fa-flip-horizontal": _ === "horizontal" || _ === "both",
    "fa-flip-vertical": _ === "vertical" || _ === "both"
  }, "fa-".concat(m), typeof m < "u" && m !== null), "fa-rotate-".concat(g), typeof g < "u" && g !== null && g !== 0), "fa-pull-".concat(b), typeof b < "u" && b !== null), "fa-swap-opacity", v), "fa-rotate-by", w && x), "fa-width-auto", w && y);
  return Object.keys(S).map(function(C) {
    return S[C] ? C : null;
  }).filter(function(C) {
    return C;
  });
}
function S1(e, t) {
  for (var n = e.split("-"), s = vh(n, 2), i = s[0], r = s[1], o = t.split("-"), a = vh(o, 2), c = a[0], l = a[1], u = i.split("."), h = c.split("."), d = 0; d < Math.max(u.length, h.length); d++) {
    var p = u[d] || "0", f = h[d] || "0", _ = parseInt(p, 10), m = parseInt(f, 10);
    if (_ !== m)
      return _ > m;
  }
  for (var g = 0; g < Math.max(u.length, h.length); g++) {
    var b = u[g] || "0", v = h[g] || "0";
    if (b !== v && b.length !== v.length)
      return b.length < v.length;
  }
  return !(r && !l);
}
function T1(e) {
  return e = e - 0, e === e;
}
function Yf(e) {
  return T1(e) ? e : (e = e.replace(/[\-_\s]+(.)?/g, function(t, n) {
    return n ? n.toUpperCase() : "";
  }), e.substr(0, 1).toLowerCase() + e.substr(1));
}
var A1 = ["style"];
function k1(e) {
  return e.charAt(0).toUpperCase() + e.slice(1);
}
function I1(e) {
  return e.split(";").map(function(t) {
    return t.trim();
  }).filter(function(t) {
    return t;
  }).reduce(function(t, n) {
    var s = n.indexOf(":"), i = Yf(n.slice(0, s)), r = n.slice(s + 1).trim();
    return i.startsWith("webkit") ? t[k1(i)] = r : t[i] = r, t;
  }, {});
}
function Xf(e, t) {
  var n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
  if (typeof t == "string")
    return t;
  var s = (t.children || []).map(function(c) {
    return Xf(e, c);
  }), i = Object.keys(t.attributes || {}).reduce(function(c, l) {
    var u = t.attributes[l];
    switch (l) {
      case "class":
        c.attrs.className = u, delete t.attributes.class;
        break;
      case "style":
        c.attrs.style = I1(u);
        break;
      default:
        l.indexOf("aria-") === 0 || l.indexOf("data-") === 0 ? c.attrs[l.toLowerCase()] = u : c.attrs[Yf(l)] = u;
    }
    return c;
  }, {
    attrs: {}
  }), r = n.style, o = r === void 0 ? {} : r, a = _1(n, A1);
  return i.attrs.style = pn(pn({}, i.attrs.style), o), e.apply(void 0, [t.tag, pn(pn({}, i.attrs), a)].concat(lc(s)));
}
var Uf = !1;
try {
  Uf = process.env.NODE_ENV === "production";
} catch {
}
function E1() {
  if (!Uf && console && typeof console.error == "function") {
    var e;
    (e = console).error.apply(e, arguments);
  }
}
function bh(e) {
  if (e && Jr(e) === "object" && e.prefix && e.iconName && e.icon)
    return e;
  if (ac.icon)
    return ac.icon(e);
  if (e === null)
    return null;
  if (e && Jr(e) === "object" && e.prefix && e.iconName)
    return e;
  if (Array.isArray(e) && e.length === 2)
    return {
      prefix: e[0],
      iconName: e[1]
    };
  if (typeof e == "string")
    return {
      prefix: "fas",
      iconName: e
    };
}
function Sa(e, t) {
  return Array.isArray(t) && t.length > 0 || !Array.isArray(t) && t ? zn({}, e, t) : {};
}
var xh = {
  border: !1,
  className: "",
  mask: null,
  maskId: null,
  // the fixedWidth property has been deprecated as of version 7
  fixedWidth: !1,
  inverse: !1,
  flip: !1,
  icon: null,
  listItem: !1,
  pull: null,
  pulse: !1,
  rotation: null,
  rotateBy: !1,
  size: null,
  spin: !1,
  spinPulse: !1,
  spinReverse: !1,
  beat: !1,
  fade: !1,
  beatFade: !1,
  bounce: !1,
  shake: !1,
  symbol: !1,
  title: "",
  titleId: null,
  transform: null,
  swapOpacity: !1,
  widthAuto: !1
}, pr = /* @__PURE__ */ $t.forwardRef(function(e, t) {
  var n = pn(pn({}, xh), e), s = n.icon, i = n.mask, r = n.symbol, o = n.className, a = n.title, c = n.titleId, l = n.maskId, u = bh(s), h = Sa("classes", [].concat(lc(C1(n)), lc((o || "").split(" ")))), d = Sa("transform", typeof n.transform == "string" ? ac.transform(n.transform) : n.transform), p = Sa("mask", bh(i)), f = n1(u, pn(pn(pn(pn({}, h), d), p), {}, {
    symbol: r,
    title: a,
    titleId: c,
    maskId: l
  }));
  if (!f)
    return E1("Could not find icon", u), null;
  var _ = f.abstract, m = {
    ref: t
  };
  return Object.keys(n).forEach(function(g) {
    xh.hasOwnProperty(g) || (m[g] = n[g]);
  }), D1(_[0], m);
});
pr.displayName = "FontAwesomeIcon";
pr.propTypes = {
  beat: Ct.bool,
  border: Ct.bool,
  beatFade: Ct.bool,
  bounce: Ct.bool,
  className: Ct.string,
  fade: Ct.bool,
  flash: Ct.bool,
  mask: Ct.oneOfType([Ct.object, Ct.array, Ct.string]),
  maskId: Ct.string,
  // the fixedWidth property has been deprecated as of version 7
  fixedWidth: Ct.bool,
  inverse: Ct.bool,
  flip: Ct.oneOf([!0, !1, "horizontal", "vertical", "both"]),
  icon: Ct.oneOfType([Ct.object, Ct.array, Ct.string]),
  listItem: Ct.bool,
  pull: Ct.oneOf(["right", "left"]),
  pulse: Ct.bool,
  rotation: Ct.oneOf([0, 90, 180, 270]),
  rotateBy: Ct.bool,
  shake: Ct.bool,
  size: Ct.oneOf(["2xs", "xs", "sm", "lg", "xl", "2xl", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x"]),
  spin: Ct.bool,
  spinPulse: Ct.bool,
  spinReverse: Ct.bool,
  symbol: Ct.oneOfType([Ct.bool, Ct.string]),
  title: Ct.string,
  titleId: Ct.string,
  transform: Ct.oneOfType([Ct.string, Ct.object]),
  swapOpacity: Ct.bool,
  widthAuto: Ct.bool
};
var D1 = Xf.bind(null, $t.createElement), R1 = q.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: ${(e) => e.theme?.textColor || "#333"};
  user-select: none;
`, O1 = ({
  formattedTime: e,
  className: t
}) => /* @__PURE__ */ k.jsx(R1, { className: t, "aria-label": "Audio position", children: e }), Nl = q.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-family: ${(e) => e.theme.fontFamily};
  font-size: ${(e) => e.theme.fontSize};
  font-weight: 500;
  color: ${(e) => e.theme.buttonText};
  background-color: ${(e) => e.theme.buttonBackground};
  border: 1px solid ${(e) => e.theme.buttonBorder};
  border-radius: ${(e) => e.theme.borderRadius};
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out,
    box-shadow 0.15s ease-in-out;

  &:hover:not(:disabled) {
    background-color: ${(e) => e.theme.buttonHoverBackground};
  }

  &:focus {
    box-shadow: 0 0 0 2px ${(e) => e.theme.inputFocusBorder}33;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
q(Nl)`
  padding: 0.25rem 0.5rem;
  font-size: ${(e) => e.theme.fontSizeSmall};
`;
q(Nl)`
  padding: 0.5rem;
  min-width: 2.25rem;
  min-height: 2.25rem;
`;
q(Nl)`
  padding: 0.25rem;
  min-width: 1.75rem;
  min-height: 1.75rem;
  font-size: ${(e) => e.theme.fontSizeSmall};
`;
var Zo = q.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`, Yo = q.input`
  cursor: pointer;
  accent-color: ${(e) => e.theme.inputFocusBorder};

  &:disabled {
    cursor: not-allowed;
  }
`, Xo = q.label`
  margin: 0;
  cursor: pointer;
  user-select: none;
  font-family: ${(e) => e.theme.fontFamily};
  font-size: ${(e) => e.theme.fontSize};
  color: ${(e) => e.theme.textColor};
`, Ta = {
  primary: {
    background: "#007bff",
    hover: "#0056b3"
  },
  success: {
    background: "#28a745",
    hover: "#218838"
  },
  info: {
    background: "#17a2b8",
    hover: "#138496"
  }
}, dn = q.button`
  padding: 0.5rem 1rem;
  background: ${(e) => Ta[e.variant || "primary"].background};
  color: white;
  border: none;
  border-radius: ${(e) => e.theme.borderRadius};
  cursor: pointer;
  font-family: ${(e) => e.theme.fontFamily};
  font-size: ${(e) => e.theme.fontSize};
  font-weight: ${(e) => e.variant === "info" ? "600" : "500"};
  transition: background-color 0.15s ease-in-out;

  &:hover:not(:disabled) {
    background: ${(e) => Ta[e.variant || "primary"].hover};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(e) => Ta[e.variant || "primary"].background}66;
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
  }
`, Hf = q.input`
  padding: 0.5rem 0.75rem;
  font-family: ${(e) => e.theme.fontFamily};
  font-size: ${(e) => e.theme.fontSize};
  color: ${(e) => e.theme.inputText};
  background-color: ${(e) => e.theme.inputBackground};
  border: 1px solid ${(e) => e.theme.inputBorder};
  border-radius: ${(e) => e.theme.borderRadius};
  outline: none;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &::placeholder {
    color: ${(e) => e.theme.inputPlaceholder};
  }

  &:focus {
    border-color: ${(e) => e.theme.inputFocusBorder};
    box-shadow: 0 0 0 2px ${(e) => e.theme.inputFocusBorder}33;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
q(Hf)`
  padding: 0.25rem 0.5rem;
  font-size: ${(e) => e.theme.fontSizeSmall};
`;
var Kf = q.label`
  font-family: ${(e) => e.theme.fontFamily};
  font-size: ${(e) => e.theme.fontSizeSmall};
  font-weight: 500;
  color: ${(e) => e.theme.textColorMuted};
  margin-bottom: 0.25rem;
  display: block;
`;
q.label`
  font-family: ${(e) => e.theme.fontFamily};
  font-size: ${(e) => e.theme.fontSize};
  color: ${(e) => e.theme.textColor};
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
`;
var M1 = q.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`, Vl = q.select`
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-family: ${(e) => e.theme.fontFamily};
  font-size: ${(e) => e.theme.fontSize};
  color: ${(e) => e.theme.inputText};
  background-color: ${(e) => e.theme.inputBackground};
  border: 1px solid ${(e) => e.theme.inputBorder};
  border-radius: ${(e) => e.theme.borderRadius};
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &:focus {
    border-color: ${(e) => e.theme.inputFocusBorder};
    box-shadow: 0 0 0 2px ${(e) => e.theme.inputFocusBorder}33;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Style native option elements for dark mode support */
  option {
    color: ${(e) => e.theme.inputText};
    background-color: ${(e) => e.theme.inputBackground};
  }
`;
q(Vl)`
  padding: 0.25rem 1.75rem 0.25rem 0.5rem;
  font-size: ${(e) => e.theme.fontSizeSmall};
`;
var Qf = q.input.attrs({ type: "range" })`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: ${(e) => e.theme.sliderTrackColor};
  border-radius: 3px;
  cursor: pointer;
  outline: none;

  /* WebKit (Chrome, Safari) */
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: ${(e) => e.theme.sliderThumbColor};
    border: 2px solid ${(e) => e.theme.inputBackground};
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  &::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  /* Firefox */
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: ${(e) => e.theme.sliderThumbColor};
    border: 2px solid ${(e) => e.theme.inputBackground};
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  &::-moz-range-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &::-moz-range-track {
    background: ${(e) => e.theme.sliderTrackColor};
    border-radius: 3px;
    height: 6px;
  }

  &:focus {
    outline: none;
  }

  &:focus::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px ${(e) => e.theme.inputFocusBorder}33;
  }

  &:focus::-moz-range-thumb {
    box-shadow: 0 0 0 3px ${(e) => e.theme.inputFocusBorder}33;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:disabled::-webkit-slider-thumb {
    cursor: not-allowed;
  }

  &:disabled::-moz-range-thumb {
    cursor: not-allowed;
  }
`, F1 = ({
  checked: e,
  onChange: t,
  disabled: n = !1,
  className: s
}) => {
  const i = (r) => {
    t(r.target.checked);
  };
  return /* @__PURE__ */ k.jsxs(Zo, { className: s, children: [
    /* @__PURE__ */ k.jsx(
      Yo,
      {
        type: "checkbox",
        id: "automatic-scroll",
        className: "automatic-scroll",
        checked: e,
        onChange: i,
        disabled: n
      }
    ),
    /* @__PURE__ */ k.jsx(Xo, { htmlFor: "automatic-scroll", children: "Automatic Scroll" })
  ] });
}, wh = 1e3, P1 = q.div.attrs((e) => ({
  style: {
    width: `${e.$progress}px`,
    height: `${e.$waveHeight}px`
  }
}))`
  position: absolute;
  background: ${(e) => e.$waveProgressColor};
`, N1 = q.canvas.attrs((e) => ({
  style: {
    width: `${e.$cssWidth}px`,
    height: `${e.$waveHeight}px`
  }
}))`
  float: left;
  position: relative;
`, V1 = q.div.attrs((e) => ({
  style: {
    top: `${e.$waveHeight * e.$index}px`,
    width: `${e.$cssWidth}px`,
    height: `${e.$waveHeight}px`
  }
}))`
  position: absolute;
  background: ${(e) => e.$waveFillColor};
`, W1 = (e) => {
  const {
    data: t,
    bits: n,
    length: s,
    index: i,
    className: r,
    progress: o = 0,
    devicePixelRatio: a = 1,
    waveHeight: c = 80,
    waveProgressColor: l = "orange",
    waveOutlineColor: u = "#E0EFF1",
    waveFillColor: h = "grey"
  } = e, d = xt([]), p = rt(
    (g) => {
      if (g !== null) {
        const b = parseInt(g.dataset.index, 10);
        d.current[b] = g;
      }
    },
    []
  );
  qh(() => {
    const g = d.current;
    let b = 0;
    for (let v = 0; v < g.length; v++) {
      const x = g[v], y = x.getContext("2d"), w = Math.floor(c / 2), S = 2 ** (n - 1);
      if (y) {
        y.resetTransform(), y.clearRect(0, 0, x.width, x.height), y.imageSmoothingEnabled = !1, y.fillStyle = u, y.scale(a, a);
        const C = x.width / a;
        for (let D = 0; D < C; D += 1) {
          const R = t[(D + b) * 2] / S, A = t[(D + b) * 2 + 1] / S, I = Math.abs(R * w), F = Math.abs(A * w);
          y.fillRect(D, 0, 1, w - F), y.fillRect(D, w + I, 1, w - I);
        }
      }
      b += wh;
    }
  }, [
    t,
    n,
    c,
    u,
    a,
    s
  ]);
  let f = s, _ = 0;
  const m = [];
  for (; f > 0; ) {
    const g = Math.min(f, wh), b = /* @__PURE__ */ k.jsx(
      N1,
      {
        $cssWidth: g,
        width: g * a,
        height: c * a,
        $waveHeight: c,
        "data-index": _,
        ref: p
      },
      `${s}-${_}`
    );
    m.push(b), f -= g, _ += 1;
  }
  return /* @__PURE__ */ k.jsxs(
    V1,
    {
      $index: i,
      $cssWidth: s,
      className: r,
      $waveHeight: c,
      $waveFillColor: h,
      children: [
        /* @__PURE__ */ k.jsx(
          P1,
          {
            $progress: o,
            $waveHeight: c,
            $waveProgressColor: l
          }
        ),
        m
      ]
    }
  );
}, Jf = 22, tp = q.div`
  position: relative;
  height: ${Jf}px;
  background: ${(e) => e.$isSelected ? e.theme.selectedClipHeaderBackgroundColor : e.theme.clipHeaderBackgroundColor};
  border-bottom: 1px solid ${(e) => e.theme.clipHeaderBorderColor};
  display: flex;
  align-items: center;
  padding: 0 8px;
  cursor: ${(e) => e.$interactive ? e.$isDragging ? "grabbing" : "grab" : "default"};
  user-select: none;
  z-index: 110;
  flex-shrink: 0;

  ${(e) => e.$interactive && `
    &:hover {
      background: ${e.theme.clipHeaderBackgroundColor}dd;
    }

    &:active {
      cursor: grabbing;
    }
  `}
`, ep = q.span`
  font-size: 11px;
  font-weight: 600;
  color: ${(e) => e.theme.clipHeaderTextColor};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`, j1 = ({
  trackName: e,
  isSelected: t = !1
}) => /* @__PURE__ */ k.jsx(
  tp,
  {
    $isDragging: !1,
    $interactive: !1,
    $isSelected: t,
    children: /* @__PURE__ */ k.jsx(ep, { children: e })
  }
), L1 = ({
  clipId: e,
  trackIndex: t,
  clipIndex: n,
  trackName: s,
  isSelected: i = !1,
  disableDrag: r = !1,
  dragHandleProps: o
}) => {
  if (r || !o)
    return /* @__PURE__ */ k.jsx(
      j1,
      {
        trackName: s,
        isSelected: i
      }
    );
  const { attributes: a, listeners: c, setActivatorNodeRef: l } = o;
  return /* @__PURE__ */ k.jsx(
    tp,
    {
      ref: l,
      "data-clip-id": e,
      $interactive: !0,
      $isSelected: i,
      ...c,
      ...a,
      children: /* @__PURE__ */ k.jsx(ep, { children: s })
    }
  );
}, B1 = 8, $1 = q.div`
  position: absolute;
  ${(e) => e.$edge}: 0;
  top: 0;
  bottom: 0;
  width: ${B1}px;
  cursor: col-resize;
  user-select: none;
  z-index: 105; /* Above waveform, below header */

  /* Invisible by default, visible on hover */
  background: ${(e) => e.$isDragging ? "rgba(255, 255, 255, 0.4)" : e.$isHovered ? "rgba(255, 255, 255, 0.2)" : "transparent"};

  border-${(e) => e.$edge}: 2px solid ${(e) => e.$isDragging ? "rgba(255, 255, 255, 0.8)" : e.$isHovered ? "rgba(255, 255, 255, 0.5)" : "transparent"};

  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-${(e) => e.$edge}: 2px solid rgba(255, 255, 255, 0.5);
  }

  &:active {
    background: rgba(255, 255, 255, 0.4);
    border-${(e) => e.$edge}: 2px solid rgba(255, 255, 255, 0.8);
  }
`, Ch = ({
  clipId: e,
  trackIndex: t,
  clipIndex: n,
  edge: s,
  dragHandleProps: i
}) => {
  const [r, o] = $t.useState(!1);
  if (!i)
    return null;
  const { attributes: a, listeners: c, setActivatorNodeRef: l, isDragging: u } = i;
  return /* @__PURE__ */ k.jsx(
    $1,
    {
      ref: l,
      "data-clip-id": e,
      "data-boundary-edge": s,
      $edge: s,
      $isDragging: u,
      $isHovered: r,
      onMouseEnter: () => o(!0),
      onMouseLeave: () => o(!1),
      ...c,
      ...a
    }
  );
}, q1 = q.div.attrs((e) => ({
  style: e.$isOverlay ? {} : {
    left: `${e.$left}px`,
    width: `${e.$width}px`
  }
}))`
  position: ${(e) => e.$isOverlay ? "relative" : "absolute"};
  top: 0;
  height: ${(e) => e.$isOverlay ? "auto" : "100%"};
  width: ${(e) => e.$isOverlay ? `${e.$width}px` : "auto"};
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.05);
  cursor: crosshair; /* Indicates that pressing 'S' will split the clip */

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`, z1 = q.div`
  flex: 1;
  position: relative;
  overflow: ${(e) => e.$isOverlay ? "visible" : "hidden"};
`, Sh = ({
  children: e,
  className: t,
  clipId: n,
  trackIndex: s,
  clipIndex: i,
  trackName: r,
  startSample: o,
  durationSamples: a,
  samplesPerPixel: c,
  showHeader: l = !1,
  disableHeaderDrag: u = !1,
  isOverlay: h = !1,
  isSelected: d = !1,
  onMouseDown: p,
  trackId: f
}) => {
  const _ = Math.floor(o / c), g = Math.floor((o + a) / c) - _, b = l && !u && !h, v = `clip-${s}-${i}`, { attributes: x, listeners: y, setNodeRef: w, setActivatorNodeRef: S, transform: C, isDragging: D } = da({
    id: v,
    data: { clipId: n, trackIndex: s, clipIndex: i },
    disabled: !b
  }), R = `clip-boundary-left-${s}-${i}`, {
    attributes: A,
    listeners: I,
    setActivatorNodeRef: F,
    isDragging: N
  } = da({
    id: R,
    data: { clipId: n, trackIndex: s, clipIndex: i, boundary: "left" },
    disabled: !b
  }), V = `clip-boundary-right-${s}-${i}`, {
    attributes: W,
    listeners: L,
    setActivatorNodeRef: J,
    isDragging: z
  } = da({
    id: V,
    data: { clipId: n, trackIndex: s, clipIndex: i, boundary: "right" },
    disabled: !b
  }), E = C ? {
    transform: La.Translate.toString(C),
    zIndex: D ? 100 : void 0
    // Below controls (z-index: 999) but above other clips
  } : void 0;
  return /* @__PURE__ */ k.jsxs(
    q1,
    {
      ref: w,
      style: E,
      className: t,
      $left: _,
      $width: g,
      $isOverlay: h,
      "data-clip-container": "true",
      "data-track-id": f,
      onMouseDown: p,
      children: [
        l && /* @__PURE__ */ k.jsx(
          L1,
          {
            clipId: n,
            trackIndex: s,
            clipIndex: i,
            trackName: r,
            isSelected: d,
            disableDrag: u,
            dragHandleProps: b ? { attributes: x, listeners: y, setActivatorNodeRef: S } : void 0
          }
        ),
        /* @__PURE__ */ k.jsxs(z1, { $isOverlay: h, children: [
          e,
          l && !u && !h && /* @__PURE__ */ k.jsxs(k.Fragment, { children: [
            /* @__PURE__ */ k.jsx(
              Ch,
              {
                clipId: n,
                trackIndex: s,
                clipIndex: i,
                edge: "left",
                dragHandleProps: {
                  attributes: A,
                  listeners: I,
                  setActivatorNodeRef: F,
                  isDragging: N
                }
              }
            ),
            /* @__PURE__ */ k.jsx(
              Ch,
              {
                clipId: n,
                trackIndex: s,
                clipIndex: i,
                edge: "right",
                dragHandleProps: {
                  attributes: W,
                  listeners: L,
                  setActivatorNodeRef: J,
                  isDragging: z
                }
              }
            )
          ] })
        ] })
      ]
    }
  );
}, G1 = q.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`, Z1 = q(Kf)`
  margin: 0;
  white-space: nowrap;
`, Y1 = q(Qf)`
  width: 120px;
`, X1 = ({
  volume: e,
  onChange: t,
  disabled: n = !1,
  className: s
}) => {
  const i = (r) => {
    t(parseFloat(r.target.value) / 100);
  };
  return /* @__PURE__ */ k.jsxs(G1, { className: s, children: [
    /* @__PURE__ */ k.jsx(Z1, { htmlFor: "master-gain", children: "Master Volume" }),
    /* @__PURE__ */ k.jsx(
      Y1,
      {
        min: "0",
        max: "100",
        value: e * 100,
        onChange: i,
        disabled: n,
        id: "master-gain"
      }
    )
  ] });
}, U1 = q.div.attrs((e) => ({
  style: {
    transform: `translate3d(${e.$position}px, 0, 0)`
  }
}))`
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background: ${(e) => e.$color};
  height: 100%;
  z-index: 150;
  pointer-events: none;
  will-change: transform;
`, np = ({ position: e, color: t = "#ff0000" }) => /* @__PURE__ */ k.jsx(U1, { $position: e, $color: t }), H1 = q.div`
  overflow-y: hidden;
  overflow-x: auto;
  position: relative;
`, K1 = q.div`
  position: relative;
  background: ${(e) => e.$backgroundColor || "transparent"};
  ${(e) => e.$width !== void 0 && `width: ${e.$width}px;`}
`, Q1 = q.div`
  background: ${(e) => e.$backgroundColor || "white"};
  ${(e) => e.$width && `min-width: ${e.$width}px;`}
  width: 100%;
  overflow: visible;
`, J1 = q.div`
  position: relative;
  background: ${(e) => e.$backgroundColor || "transparent"};
  ${(e) => e.$width !== void 0 && `min-width: ${e.$width}px;`}
  width: 100%;
`, tC = q.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: crosshair;
  z-index: 100;
`, Wl = ({
  children: e,
  backgroundColor: t,
  timescaleBackgroundColor: n,
  timescale: s,
  timescaleWidth: i,
  tracksWidth: r,
  scrollContainerWidth: o,
  controlsWidth: a,
  onTracksClick: c,
  onTracksMouseDown: l,
  onTracksMouseMove: u,
  onTracksMouseUp: h,
  scrollContainerRef: d
}) => /* @__PURE__ */ k.jsx(H1, { "data-scroll-container": "true", ref: d, children: /* @__PURE__ */ k.jsxs(
  K1,
  {
    $backgroundColor: t,
    $width: o,
    children: [
      s && /* @__PURE__ */ k.jsx(Q1, { $width: i, $backgroundColor: n, children: s }),
      /* @__PURE__ */ k.jsxs(J1, { $width: r, $backgroundColor: t, children: [
        e,
        (c || l) && /* @__PURE__ */ k.jsx(
          tC,
          {
            $controlsWidth: a,
            onClick: c,
            onMouseDown: l,
            onMouseMove: u,
            onMouseUp: h
          }
        )
      ] })
    ]
  }
) });
zh(Wl);
var eC = q.div.attrs((e) => ({
  style: {
    left: `${e.$left}px`,
    width: `${e.$width}px`
  }
}))`
  position: absolute;
  top: 0;
  background: ${(e) => e.$color};
  height: 100%;
  z-index: 5;
  pointer-events: none;
  opacity: 0.3;
`, sp = ({
  startPosition: e,
  endPosition: t,
  color: n = "#00ff00"
}) => {
  const s = Math.max(0, t - e);
  return s <= 0 ? null : /* @__PURE__ */ k.jsx(eC, { $left: e, $width: s, $color: n });
};
function Ci(e, t) {
  const n = Math.floor(e / 3600) % 24, s = Math.floor(e / 60) % 60, i = (e % 60).toFixed(t);
  return String(n).padStart(2, "0") + ":" + String(s).padStart(2, "0") + ":" + i.padStart(t + 3, "0");
}
function hc(e, t) {
  switch (t) {
    case "seconds":
      return e.toFixed(0);
    case "thousandths":
      return e.toFixed(3);
    case "hh:mm:ss":
      return Ci(e, 0);
    case "hh:mm:ss.u":
      return Ci(e, 1);
    case "hh:mm:ss.uu":
      return Ci(e, 2);
    case "hh:mm:ss.uuu":
      return Ci(e, 3);
    default:
      return Ci(e, 3);
  }
}
function nC(e, t) {
  if (!e) return 0;
  switch (t) {
    case "seconds":
    case "thousandths":
      return parseFloat(e) || 0;
    case "hh:mm:ss":
    case "hh:mm:ss.u":
    case "hh:mm:ss.uu":
    case "hh:mm:ss.uuu": {
      const n = e.split(":");
      if (n.length !== 3) return 0;
      const s = parseInt(n[0], 10) || 0, i = parseInt(n[1], 10) || 0, r = parseFloat(n[2]) || 0;
      return s * 3600 + i * 60 + r;
    }
    default:
      return 0;
  }
}
var Th = ({
  id: e,
  label: t,
  value: n,
  format: s,
  className: i,
  onChange: r,
  readOnly: o = !1
}) => {
  const [a, c] = ft("");
  Ht(() => {
    const d = hc(n, s);
    c(d);
  }, [n, s, e]);
  const l = (d) => {
    const p = d.target.value;
    c(p);
  }, u = () => {
    if (r) {
      const d = nC(a, s);
      r(d);
    }
    c(hc(n, s));
  }, h = (d) => {
    d.key === "Enter" && d.currentTarget.blur();
  };
  return /* @__PURE__ */ k.jsxs(k.Fragment, { children: [
    /* @__PURE__ */ k.jsx(M1, { as: "label", htmlFor: e, children: t }),
    /* @__PURE__ */ k.jsx(
      Hf,
      {
        type: "text",
        className: i,
        id: e,
        value: a,
        onChange: l,
        onBlur: u,
        onKeyDown: h,
        readOnly: o
      }
    )
  ] });
}, sC = ({
  selectionStart: e,
  selectionEnd: t,
  onSelectionChange: n,
  className: s
}) => {
  const [i, r] = ft("hh:mm:ss.uuu");
  Ht(() => {
    const c = document.querySelector(".time-format"), l = () => {
      c && r(c.value);
    };
    return c && (r(c.value), c.addEventListener("change", l)), () => {
      c?.removeEventListener("change", l);
    };
  }, []);
  const o = (c) => {
    n && n(c, t);
  }, a = (c) => {
    n && n(e, c);
  };
  return /* @__PURE__ */ k.jsxs(k.Fragment, { children: [
    /* @__PURE__ */ k.jsx(
      Th,
      {
        id: "audio_start",
        label: "Start of audio selection",
        value: e,
        format: i,
        className: "audio-start form-control mr-sm-2",
        onChange: o
      }
    ),
    /* @__PURE__ */ k.jsx(
      Th,
      {
        id: "audio_end",
        label: "End of audio selection",
        value: t,
        format: i,
        className: "audio-end form-control mr-sm-2",
        onChange: a
      }
    )
  ] });
};
function Nr() {
  return window.devicePixelRatio;
}
var ip = Se(Nr()), rp = ({ children: e }) => {
  const [t, n] = ft(Nr());
  return matchMedia(`(resolution: ${Nr()}dppx)`).addEventListener(
    "change",
    () => {
      n(Nr());
    },
    { once: !0 }
  ), /* @__PURE__ */ k.jsx(ip.Provider, { value: Math.ceil(t), children: e });
}, op = () => we(ip), Uo = Se({
  sampleRate: 48e3,
  samplesPerPixel: 1e3,
  zoomLevels: [1e3, 1500, 2e3, 2500],
  waveHeight: 80,
  timeScaleHeight: 15,
  controls: {
    show: !1,
    width: 150
  },
  duration: 3e4
}), jl = () => we(Uo), ap = () => we(Np), Ll = Se(/* @__PURE__ */ k.jsx(Fp, {})), iC = () => we(Ll), cp = 0, lp = !1, up = 0, hp = 0, rC = {
  progress: cp,
  isPlaying: lp,
  selectionStart: up,
  selectionEnd: hp
}, dp = Se(rC), fp = Se({
  setIsPlaying: () => {
  },
  setProgress: () => {
  },
  setSelection: () => {
  }
}), oC = ({ children: e }) => {
  const [t, n] = ft(lp), [s, i] = ft(cp), [r, o] = ft(up), [a, c] = ft(hp), l = (u, h) => {
    o(u), c(h);
  };
  return /* @__PURE__ */ k.jsx(fp.Provider, { value: { setIsPlaying: n, setProgress: i, setSelection: l }, children: /* @__PURE__ */ k.jsx(dp.Provider, { value: { isPlaying: t, progress: s, selectionStart: r, selectionEnd: a }, children: e }) });
}, aC = () => we(dp), cC = () => we(fp), dc = ({ isSelected: e, ...t }) => {
  const n = ap(), { waveHeight: s } = jl(), i = op(), r = e && n ? n.selectedWaveOutlineColor : n?.waveOutlineColor, o = e && n ? n.selectedWaveFillColor : n?.waveFillColor;
  return /* @__PURE__ */ k.jsx(
    W1,
    {
      ...t,
      ...n,
      waveOutlineColor: r,
      waveFillColor: o,
      waveHeight: s,
      devicePixelRatio: i
    }
  );
};
function nn(e, t, n) {
  return Math.ceil(e * n / t);
}
function lC(e) {
  const t = Math.floor(e / 1e3), n = t % 60;
  return `${(t - n) / 60}:${String(n).padStart(2, "0")}`;
}
var uC = q.div.attrs((e) => ({
  style: {
    width: `${e.$cssWidth}px`,
    marginLeft: `${e.$controlWidth}px`,
    height: `${e.$timeScaleHeight}px`
  }
}))`
  position: relative;
  overflow: visible; /* Allow time labels to render above the container */
`, hC = q.canvas.attrs((e) => ({
  style: {
    width: `${e.$cssWidth}px`,
    height: `${e.$timeScaleHeight}px`
  }
}))`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
`, dC = q.div.attrs((e) => ({
  style: {
    left: `${e.$left + 4}px`
    // Offset 4px to the right of the tick
  }
}))`
  position: absolute;
  font-size: 0.75rem; /* Smaller font to prevent overflow */
  white-space: nowrap; /* Prevent text wrapping */
  color: ${(e) => e.theme.timeColor}; /* Use theme color instead of inheriting */
`, fC = (e) => {
  const {
    theme: { timeColor: t },
    duration: n,
    marker: s,
    bigStep: i,
    secondStep: r,
    renderTimestamp: o
  } = e, a = /* @__PURE__ */ new Map(), c = [], l = xt(null), {
    sampleRate: u,
    samplesPerPixel: h,
    timeScaleHeight: d,
    controls: { show: p, width: f }
  } = we(Uo), _ = op();
  Ht(() => {
    if (l.current !== null) {
      const v = l.current, x = v.getContext("2d");
      if (x) {
        x.resetTransform(), x.clearRect(0, 0, v.width, v.height), x.imageSmoothingEnabled = !1, x.fillStyle = t, x.scale(_, _);
        for (const [y, w] of a.entries()) {
          const S = d - w;
          x.fillRect(y, S, 1, w);
        }
      }
    }
  }, [
    n,
    _,
    t,
    d,
    i,
    r,
    s,
    a
  ]);
  const m = nn(n / 1e3, h, u), g = u / h;
  let b = 0;
  for (let v = 0; v < m; v += g * r / 1e3) {
    const x = Math.floor(v);
    if (b % s === 0) {
      const y = b, w = lC(y), S = o ? /* @__PURE__ */ k.jsx($t.Fragment, { children: o(y, x) }, `timestamp-${b}`) : /* @__PURE__ */ k.jsx(dC, { $left: x, children: w }, w);
      c.push(S), a.set(x, d);
    } else b % i === 0 ? a.set(x, Math.floor(d / 2)) : b % r === 0 && a.set(x, Math.floor(d / 5));
    b += r;
  }
  return /* @__PURE__ */ k.jsxs(
    uC,
    {
      $cssWidth: m,
      $controlWidth: p ? f : 0,
      $timeScaleHeight: d,
      children: [
        c,
        /* @__PURE__ */ k.jsx(
          hC,
          {
            $cssWidth: m,
            $timeScaleHeight: d,
            width: m * _,
            height: d * _,
            ref: l
          }
        )
      ]
    }
  );
}, pp = zh(fC), pC = q.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`, mC = [
  { value: "seconds", label: "seconds" },
  { value: "thousandths", label: "thousandths" },
  { value: "hh:mm:ss", label: "hh:mm:ss" },
  { value: "hh:mm:ss.u", label: "hh:mm:ss + tenths" },
  { value: "hh:mm:ss.uu", label: "hh:mm:ss + hundredths" },
  { value: "hh:mm:ss.uuu", label: "hh:mm:ss + milliseconds" }
], gC = ({
  value: e,
  onChange: t,
  disabled: n = !1,
  className: s
}) => {
  const i = (r) => {
    t(r.target.value);
  };
  return /* @__PURE__ */ k.jsx(pC, { className: s, children: /* @__PURE__ */ k.jsx(
    Vl,
    {
      className: "time-format",
      value: e,
      onChange: i,
      disabled: n,
      "aria-label": "Time format selection",
      children: mC.map((r) => /* @__PURE__ */ k.jsx("option", { value: r.value, children: r.label }, r.value))
    }
  ) });
}, _C = q.div.attrs((e) => ({
  style: {
    height: `${e.$waveHeight * e.$numChannels + (e.$hasClipHeaders ? Jf : 0)}px`
  }
}))`
  position: relative;
  display: flex;
  ${(e) => e.$width !== void 0 && `width: ${e.$width}px;`}
`, yC = q.div.attrs((e) => ({
  style: {
    paddingLeft: `${e.$offset || 0}px`
  }
}))`
  position: relative;
  background: ${(e) => e.$backgroundColor || "transparent"};
  flex: 1;
`, vC = q.div.attrs((e) => ({
  style: {
    width: `${e.$controlWidth}px`
  }
}))`
  position: sticky;
  z-index: 999;
  left: 0;
  height: 100%;
  flex-shrink: 0;
  pointer-events: auto;
  background: ${(e) => e.theme.surfaceColor};
  transition: background 0.15s ease-in-out;

  /* Selected track: highlighted background */
  ${(e) => e.$isSelected && `
    background: ${e.theme.selectedTrackControlsBackground};
  `}
`, mp = ({
  numChannels: e,
  children: t,
  className: n,
  backgroundColor: s,
  offset: i = 0,
  width: r,
  hasClipHeaders: o = !1,
  onClick: a,
  trackId: c,
  isSelected: l = !1
}) => {
  const {
    waveHeight: u,
    controls: { show: h, width: d }
  } = jl(), p = iC();
  return /* @__PURE__ */ k.jsxs(
    _C,
    {
      $numChannels: e,
      className: n,
      $waveHeight: u,
      $controlWidth: h ? d : 0,
      $width: r,
      $hasClipHeaders: o,
      $isSelected: l,
      children: [
        /* @__PURE__ */ k.jsx(
          vC,
          {
            $controlWidth: h ? d : 0,
            $isSelected: l,
            children: p
          }
        ),
        /* @__PURE__ */ k.jsx(
          yC,
          {
            $controlWidth: h ? d : 0,
            $backgroundColor: s,
            $offset: i,
            onClick: a,
            "data-track-id": c,
            children: t
          }
        )
      ]
    }
  );
}, to = q.button.attrs({
  type: "button"
})`
  display: inline-block;
  font-family: ${(e) => e.theme.fontFamily};
  font-weight: 500;
  text-align: center;
  vertical-align: middle;
  user-select: none;
  padding: 0.25rem 0.4rem;
  font-size: ${(e) => e.theme.fontSizeSmall};
  line-height: 1;
  border-radius: ${(e) => e.theme.borderRadius};
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out,
    border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  cursor: pointer;

  ${(e) => e.$variant === "danger" ? `
        color: #fff;
        background-color: #dc3545;
        border: 1px solid #dc3545;

        &:hover {
          background-color: #c82333;
          border-color: #bd2130;
        }

        &:focus {
          outline: none;
          box-shadow: 0 0 0 0.2rem rgba(225, 83, 97, 0.5);
        }
      ` : e.$variant === "info" ? `
        color: #fff;
        background-color: #17a2b8;
        border: 1px solid #17a2b8;

        &:hover {
          background-color: #138496;
          border-color: #117a8b;
        }

        &:focus {
          outline: none;
          box-shadow: 0 0 0 0.2rem rgba(58, 176, 195, 0.5);
        }
      ` : `
        color: ${e.theme.textColor};
        background-color: transparent;
        border: 1px solid ${e.theme.borderColor};

        &:hover {
          color: #fff;
          background-color: ${e.theme.textColor};
          border-color: ${e.theme.textColor};
        }

        &:focus {
          outline: none;
          box-shadow: 0 0 0 0.2rem ${e.theme.inputFocusBorder}33;
        }
      `}
`, bC = q.div`
  margin-bottom: 0.3rem;

  button:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  button:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
`, gp = q.div`
  background: transparent;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  box-sizing: border-box;
  text-align: center;
  border: 1px solid ${(e) => e.theme.borderColor};
  border-radius: ${(e) => e.theme.borderRadius};
`, xC = q.header`
  overflow: hidden;
  height: 26px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.2rem;
  font-size: ${(e) => e.theme.fontSizeSmall};
  color: ${(e) => e.theme.textColor};
  background-color: transparent;
`, _p = q(pr).attrs({
  icon: Qb
})``, yp = q(pr).attrs({
  icon: tx
})``;
e1.add(Hb);
q(pr).attrs({
  icon: "trash-alt"
})``;
var eo = q(Qf)`
  width: 75%;
  height: 5px;
  background: ${(e) => e.theme.sliderTrackColor};

  &::-webkit-slider-thumb {
    width: 12px;
    height: 12px;
    background: ${(e) => e.theme.sliderThumbColor};
    border: none;
    margin-top: -4px;
    cursor: ew-resize;
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: ${(e) => e.theme.sliderThumbColor};
    border: none;
    cursor: ew-resize;
  }

  &::-webkit-slider-runnable-track {
    height: 5px;
    background: ${(e) => e.theme.sliderTrackColor};
    border-radius: 3px;
  }

  &::-moz-range-track {
    height: 5px;
    background: ${(e) => e.theme.sliderTrackColor};
    border-radius: 3px;
  }

  &:focus::-webkit-slider-runnable-track {
    background: ${(e) => e.theme.inputBorder};
  }

  &:focus::-moz-range-track {
    background: ${(e) => e.theme.inputBorder};
  }

  &:focus::-webkit-slider-thumb {
    border: 2px solid ${(e) => e.theme.textColor};
  }

  &:focus::-moz-range-thumb {
    border: 2px solid ${(e) => e.theme.textColor};
  }
`, Ah = q.label`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
  margin-bottom: 0.2rem;
  font-size: 14px;
`;
q.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.5rem 0.25rem 0.5rem;
`;
q.span`
  flex: 1;
  font-weight: 600;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0 0.25rem;
`;
q.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  border-radius: 3px;
  transition: all 0.2s ease-in-out;
  flex-shrink: 0;

  &:hover {
    background: #dc3545;
    color: white;
  }

  &:active {
    transform: scale(0.9);
  }
`;
var wC = {
  waveOutlineColor: "#005BBB",
  waveFillColor: "#FFD500",
  waveProgressColor: "#ff0000",
  selectedWaveOutlineColor: "#0099ff",
  // Brighter blue for selected track waveforms
  selectedWaveFillColor: "#FFD500",
  // Same as waveFillColor - keep consistent on selection
  selectedTrackControlsBackground: "#d9e9ff",
  // Light blue background for selected track controls
  timeColor: "#000",
  timescaleBackgroundColor: "#fff",
  playheadColor: "#f00",
  selectionColor: "rgba(255, 105, 180, 0.7)",
  // hot pink - high contrast on light backgrounds
  clipHeaderBackgroundColor: "rgba(0, 0, 0, 0.1)",
  clipHeaderBorderColor: "rgba(0, 0, 0, 0.2)",
  clipHeaderTextColor: "#333",
  selectedClipHeaderBackgroundColor: "#b3d9ff",
  // Brighter blue for selected track clip headers
  // UI component colors
  backgroundColor: "#ffffff",
  surfaceColor: "#f5f5f5",
  borderColor: "#ddd",
  textColor: "#333",
  textColorMuted: "#666",
  // Interactive element colors
  inputBackground: "#ffffff",
  inputBorder: "#ccc",
  inputText: "#333",
  inputPlaceholder: "#999",
  inputFocusBorder: "#0066cc",
  // Button colors
  buttonBackground: "#f0f0f0",
  buttonText: "#333",
  buttonBorder: "#ccc",
  buttonHoverBackground: "#e0e0e0",
  // Slider colors
  sliderTrackColor: "#ddd",
  sliderThumbColor: "#daa520",
  // goldenrod
  // Annotation colors
  annotationBoxBackground: "rgba(255, 255, 255, 0.85)",
  annotationBoxActiveBackground: "rgba(255, 255, 255, 0.95)",
  annotationBoxHoverBackground: "rgba(255, 255, 255, 0.98)",
  annotationBoxBorder: "#ff9800",
  annotationBoxActiveBorder: "#d67600",
  annotationLabelColor: "#2a2a2a",
  annotationResizeHandleColor: "rgba(0, 0, 0, 0.4)",
  annotationResizeHandleActiveColor: "rgba(0, 0, 0, 0.8)",
  annotationTextItemHoverBackground: "rgba(0, 0, 0, 0.03)",
  // Spacing and sizing
  borderRadius: "4px",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  fontSize: "14px",
  fontSizeSmall: "12px"
}, kh;
(function(e) {
  e.DragStart = "dragStart", e.DragMove = "dragMove", e.DragEnd = "dragEnd", e.DragCancel = "dragCancel", e.DragOver = "dragOver", e.RegisterDroppable = "registerDroppable", e.SetDroppableDisabled = "setDroppableDisabled", e.UnregisterDroppable = "unregisterDroppable";
})(kh || (kh = {}));
function Ih() {
}
const CC = /* @__PURE__ */ Object.freeze({
  x: 0,
  y: 0
});
var Vs;
(function(e) {
  e[e.Forward = 1] = "Forward", e[e.Backward = -1] = "Backward";
})(Vs || (Vs = {}));
var Eh;
(function(e) {
  e.Click = "click", e.DragStart = "dragstart", e.Keydown = "keydown", e.ContextMenu = "contextmenu", e.Resize = "resize", e.SelectionChange = "selectionchange", e.VisibilityChange = "visibilitychange";
})(Eh || (Eh = {}));
var Gn;
(function(e) {
  e.Space = "Space", e.Down = "ArrowDown", e.Right = "ArrowRight", e.Left = "ArrowLeft", e.Up = "ArrowUp", e.Esc = "Escape", e.Enter = "Enter", e.Tab = "Tab";
})(Gn || (Gn = {}));
Gn.Space, Gn.Enter, Gn.Esc, Gn.Space, Gn.Enter, Gn.Tab;
var Dh;
(function(e) {
  e[e.RightClick = 2] = "RightClick";
})(Dh || (Dh = {}));
var Rh;
(function(e) {
  e[e.Pointer = 0] = "Pointer", e[e.DraggableRect = 1] = "DraggableRect";
})(Rh || (Rh = {}));
var Oh;
(function(e) {
  e[e.TreeOrder = 0] = "TreeOrder", e[e.ReversedTreeOrder = 1] = "ReversedTreeOrder";
})(Oh || (Oh = {}));
Vs.Backward + "", Vs.Forward + "", Vs.Backward + "", Vs.Forward + "";
var fc;
(function(e) {
  e[e.Always = 0] = "Always", e[e.BeforeDragging = 1] = "BeforeDragging", e[e.WhileDragging = 2] = "WhileDragging";
})(fc || (fc = {}));
var pc;
(function(e) {
  e.Optimized = "optimized";
})(pc || (pc = {}));
function SC(e, t) {
  return Rn(() => e.reduce((n, s) => {
    let {
      eventName: i,
      handler: r
    } = s;
    return n[i] = (o) => {
      r(o, t);
    }, n;
  }, {}), [e, t]);
}
fc.WhileDragging, pc.Optimized;
const TC = {
  activatorEvent: null,
  activators: [],
  active: null,
  activeNodeRect: null,
  ariaDescribedById: {
    draggable: ""
  },
  dispatch: Ih,
  draggableNodes: /* @__PURE__ */ new Map(),
  over: null,
  measureDroppableContainers: Ih
}, AC = /* @__PURE__ */ Se(TC), kC = /* @__PURE__ */ Se({
  ...CC,
  scaleX: 1,
  scaleY: 1
});
var Mh;
(function(e) {
  e[e.Uninitialized = 0] = "Uninitialized", e[e.Initializing = 1] = "Initializing", e[e.Initialized = 2] = "Initialized";
})(Mh || (Mh = {}));
const IC = /* @__PURE__ */ Se(null), Fh = "button", EC = "Draggable";
function Ph(e) {
  let {
    id: t,
    data: n,
    disabled: s = !1,
    attributes: i
  } = e;
  const r = lf(EC), {
    activators: o,
    activatorEvent: a,
    active: c,
    activeNodeRect: l,
    ariaDescribedById: u,
    draggableNodes: h,
    over: d
  } = we(AC), {
    role: p = Fh,
    roleDescription: f = "draggable",
    tabIndex: _ = 0
  } = i ?? {}, m = c?.id === t, g = we(m ? kC : IC), [b, v] = Hr(), [x, y] = Hr(), w = SC(o, t), S = cf(n);
  Lo(
    () => (h.set(t, {
      id: t,
      key: r,
      node: b,
      activatorNode: x,
      data: S
    }), () => {
      const D = h.get(t);
      D && D.key === r && h.delete(t);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h, t]
  );
  const C = Rn(() => ({
    role: p,
    tabIndex: _,
    "aria-disabled": s,
    "aria-pressed": m && p === Fh ? !0 : void 0,
    "aria-roledescription": f,
    "aria-describedby": u.draggable
  }), [s, p, _, m, f, u.draggable]);
  return {
    active: c,
    activatorEvent: a,
    activeNodeRect: l,
    attributes: C,
    isDragging: m,
    listeners: s ? void 0 : w,
    node: b,
    over: d,
    setNodeRef: v,
    setActivatorNodeRef: y,
    transform: g
  };
}
function DC(e) {
  return {
    id: e.id,
    start: parseFloat(e.begin),
    end: parseFloat(e.end),
    lines: e.lines,
    lang: e.language
  };
}
function RC(e) {
  return {
    id: e.id,
    begin: e.start.toFixed(3),
    end: e.end.toFixed(3),
    lines: e.lines,
    language: e.lang || "en"
  };
}
q.div.attrs((e) => ({
  style: {
    left: `${e.$left}px`,
    width: `${e.$width}px`
  }
}))`
  position: absolute;
  top: 0;
  background: ${(e) => e.$color};
  height: 100%;
  z-index: 10;
  pointer-events: auto;
  opacity: 0.3;
  border: 2px solid ${(e) => e.$color};
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    opacity: 0.5;
    border-color: ${(e) => e.$color};
  }
`;
q.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.3;
  max-height: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  white-space: pre-wrap;
  word-break: break-word;
`;
q.textarea`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.3;
  max-height: 60%;
  overflow: auto;
  border: 1px solid #fff;
  resize: none;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #4CAF50;
  }
`;
q.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  gap: 4px;
  padding: 4px;
  justify-content: flex-start;
  align-items: center;
`;
q.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
  padding: 4px 8px;
  font-size: 10px;
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: white;
  }

  &:active {
    background: rgba(255, 255, 255, 0.3);
  }
`;
var OC = q.div.attrs((e) => ({
  style: {
    left: `${e.$left}px`,
    width: `${e.$width}px`
  }
}))`
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none; /* Let events pass through to children */
`, MC = q.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  background: ${(e) => e.$isActive ? e.theme?.annotationBoxActiveBackground || "rgba(255, 255, 255, 0.95)" : e.theme?.annotationBoxBackground || "rgba(255, 255, 255, 0.85)"};
  border: 2px solid ${(e) => e.$isActive ? e.theme?.annotationBoxActiveBorder || "#d67600" : e.$color};
  border-radius: 4px;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover {
    background: ${(e) => e.theme?.annotationBoxHoverBackground || "rgba(255, 255, 255, 0.98)"};
    border-color: ${(e) => e.theme?.annotationBoxActiveBorder || "#d67600"};
    border-width: 3px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
`, FC = q.span`
  font-size: 12px;
  font-weight: 600;
  color: ${(e) => e.theme?.annotationLabelColor || "#2a2a2a"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 6px;
  letter-spacing: 0.3px;
  user-select: none;
`, Nh = q.div`
  position: absolute;
  top: 0;
  ${(e) => e.$position === "left" ? "left: -8px" : "right: -8px"};
  width: 16px;
  height: 100%;
  cursor: ew-resize;
  z-index: 120; /* Above ClickOverlay (z-index: 100) and AnnotationBoxesWrapper (z-index: 110) */
  background: ${(e) => e.$isDragging ? e.theme?.annotationResizeHandleColor || "rgba(0, 0, 0, 0.2)" : "transparent"};
  border-radius: 4px;
  touch-action: none; /* Important for @dnd-kit on touch devices */
  pointer-events: auto;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 60%;
    background: ${(e) => e.$isDragging ? e.theme?.annotationResizeHandleActiveColor || "rgba(0, 0, 0, 0.8)" : e.theme?.annotationResizeHandleColor || "rgba(0, 0, 0, 0.4)"};
    border-radius: 2px;
    opacity: ${(e) => e.$isDragging ? 1 : 0.6};
    transition: opacity 0.2s, background 0.2s;
  }

  &:hover {
    background: ${(e) => e.theme?.annotationResizeHandleColor || "rgba(0, 0, 0, 0.1)"};
  }

  &:hover::before {
    opacity: 1;
    background: ${(e) => e.theme?.annotationResizeHandleActiveColor || "rgba(0, 0, 0, 0.7)"};
  }
`, vp = ({
  annotationId: e,
  annotationIndex: t,
  startPosition: n,
  endPosition: s,
  label: i,
  color: r = "#ff9800",
  isActive: o = !1,
  onClick: a,
  editable: c = !0
}) => {
  const l = Math.max(0, s - n), u = `annotation-boundary-start-${t}`, {
    attributes: h,
    listeners: d,
    setActivatorNodeRef: p,
    isDragging: f
  } = Ph({
    id: u,
    data: { annotationId: e, annotationIndex: t, edge: "start" },
    disabled: !c
  }), _ = `annotation-boundary-end-${t}`, {
    attributes: m,
    listeners: g,
    setActivatorNodeRef: b,
    isDragging: v
  } = Ph({
    id: _,
    data: { annotationId: e, annotationIndex: t, edge: "end" },
    disabled: !c
  });
  if (l <= 0)
    return null;
  const x = (w) => (S) => {
    S.stopPropagation(), w?.(S);
  }, y = (w) => {
    w.stopPropagation();
  };
  return /* @__PURE__ */ k.jsxs(OC, { $left: n, $width: l, children: [
    /* @__PURE__ */ k.jsx(
      MC,
      {
        $color: r,
        $isActive: o,
        onClick: a,
        children: i && /* @__PURE__ */ k.jsx(FC, { children: i })
      }
    ),
    c && /* @__PURE__ */ k.jsx(
      Nh,
      {
        ref: p,
        $position: "left",
        $isDragging: f,
        onClick: y,
        ...d,
        onPointerDown: x(d?.onPointerDown),
        ...h
      }
    ),
    c && /* @__PURE__ */ k.jsx(
      Nh,
      {
        ref: b,
        $position: "right",
        $isDragging: v,
        onClick: y,
        ...g,
        onPointerDown: x(g?.onPointerDown),
        ...m
      }
    )
  ] });
}, PC = q.div.attrs((e) => ({
  style: {
    height: `${e.$height}px`
  }
}))`
  position: relative;
  display: flex;
  ${(e) => e.$width !== void 0 && `width: ${e.$width}px;`}
  background: transparent;
  z-index: 110;
`, NC = q.div`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(e) => e.$controlWidth}px;
  flex-shrink: 0;
  background: transparent;
`, VC = q.div`
  position: relative;
  flex: 1;
  padding-left: ${(e) => e.$offset || 0}px;
`, bp = ({
  children: e,
  className: t,
  height: n = 30,
  offset: s = 0,
  width: i
}) => {
  const {
    controls: { show: r, width: o }
  } = jl();
  return /* @__PURE__ */ k.jsxs(
    PC,
    {
      className: t,
      $height: n,
      $controlWidth: r ? o : 0,
      $width: i,
      children: [
        /* @__PURE__ */ k.jsx(NC, { $controlWidth: r ? o : 0 }),
        /* @__PURE__ */ k.jsx(VC, { $offset: s, children: e })
      ]
    }
  );
};
q.div.attrs((e) => ({
  style: {
    height: `${e.$height}px`
  }
}))`
  position: relative;
  display: flex;
  ${(e) => e.$width !== void 0 && `width: ${e.$width}px;`}
  background: transparent;
`;
q.div`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(e) => e.$controlWidth}px;
  flex-shrink: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: ${(e) => e.theme?.textColorMuted || "#666"};
  font-weight: bold;
`;
q.div`
  position: relative;
  flex: 1;
  padding-left: ${(e) => e.$offset || 0}px;
`;
var WC = q.div`
  background: ${(e) => e.theme?.backgroundColor || "#fff"};
  ${(e) => e.$height ? `height: ${e.$height}px;` : "max-height: 200px;"}
  overflow-y: auto;
  padding: 8px;
`, jC = q.div`
  padding: 12px;
  margin-bottom: 6px;
  border-left: 4px solid ${(e) => e.$isActive ? "#ff9800" : "transparent"};
  background: ${(e) => e.$isActive ? "rgba(255, 152, 0, 0.08)" : "transparent"};
  border-radius: 4px;
  transition: all 0.2s;
  cursor: pointer;
  box-shadow: ${(e) => e.$isActive ? "0 1px 3px rgba(255, 152, 0, 0.15)" : "none"};

  &:hover {
    background: ${(e) => e.$isActive ? "rgba(255, 152, 0, 0.12)" : e.theme?.annotationTextItemHoverBackground || "rgba(0, 0, 0, 0.03)"};
    border-left-color: ${(e) => e.$isActive ? "#ff9800" : e.theme?.borderColor || "#ddd"};
  }
`, LC = q.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`, BC = q.div`
  display: flex;
  align-items: center;
  gap: 8px;
`, $C = q.span`
  font-size: 11px;
  font-weight: 600;
  color: ${(e) => e.theme?.textColorMuted || "#666"};
  background: transparent;
  padding: 2px 6px;
  border-radius: 3px;
  min-width: 20px;
  outline: ${(e) => e.$isEditable ? `1px dashed ${e.theme?.borderColor || "#ddd"}` : "none"};

  &[contenteditable='true']:focus {
    outline: 2px solid #ff9800;
    background: rgba(255, 152, 0, 0.1);
  }
`, qC = q.span`
  font-size: 12px;
  font-weight: 500;
  color: ${(e) => e.theme?.textColorMuted || "#555"};
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  letter-spacing: 0.5px;
`, zC = q.div`
  display: flex;
  gap: 6px;
`, GC = q.button`
  background: transparent;
  border: 1px solid ${(e) => e.theme?.borderColor || "#ccc"};
  color: ${(e) => e.theme?.textColor || "#333"};
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: ${(e) => e.theme?.buttonHoverBackground || "#e8e8e8"};
    border-color: ${(e) => e.theme?.inputFocusBorder || "#999"};
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`, ZC = q.div`
  font-size: 14px;
  line-height: 1.6;
  color: ${(e) => e.theme?.textColor || "#2a2a2a"};
  white-space: pre-wrap;
  word-break: break-word;
  outline: ${(e) => e.$isEditable ? `1px dashed ${e.theme?.borderColor || "#ddd"}` : "none"};
  padding: ${(e) => e.$isEditable ? "6px" : "0"};
  border-radius: 3px;
  min-height: 20px;

  &[contenteditable='true']:focus {
    outline: 2px solid #ff9800;
    background: rgba(255, 152, 0, 0.1);
  }
`, YC = ({
  annotations: e,
  activeAnnotationId: t,
  shouldScrollToActive: n = !1,
  editable: s = !1,
  controls: i = [],
  annotationListConfig: r,
  height: o,
  onAnnotationClick: a,
  onAnnotationUpdate: c
}) => {
  const l = xt(null), u = xt(null), h = xt(void 0);
  Ht(() => {
  }), Ht(() => {
    const g = u.current;
    if (!g) return;
    const b = () => {
    };
    return g.addEventListener("scroll", b), () => g.removeEventListener("scroll", b);
  }, []), Ht(() => {
    t && l.current && n && l.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    }), h.current = t;
  }, [t, n]);
  const d = (g) => {
    if (isNaN(g) || !isFinite(g))
      return "0:00.000";
    const b = Math.floor(g / 60), v = (g % 60).toFixed(3);
    return `${b}:${v.padStart(6, "0")}`;
  }, p = (g, b) => {
    if (!s || !c) return;
    const v = [...e];
    v[g] = {
      ...v[g],
      lines: b.split(`
`)
    }, c(v);
  }, f = (g, b) => {
    if (!s || !c) return;
    const v = b.trim();
    if (!v) return;
    const x = [...e];
    x[g] = {
      ...x[g],
      id: v
    }, c(x);
  }, _ = (g, b, v) => {
    if (!c) return;
    const x = [...e];
    g.action(x[v], v, x, r || {}), c(x);
  }, m = (g) => g.replace(/\./g, " ");
  return /* @__PURE__ */ k.jsx(WC, { ref: u, $height: o, children: e.map((g, b) => {
    const v = g.id === t;
    return /* @__PURE__ */ k.jsxs(
      jC,
      {
        ref: v ? l : null,
        $isActive: v,
        children: [
          /* @__PURE__ */ k.jsxs(LC, { children: [
            /* @__PURE__ */ k.jsxs(BC, { children: [
              /* @__PURE__ */ k.jsx(
                $C,
                {
                  $isEditable: s,
                  contentEditable: s,
                  suppressContentEditableWarning: !0,
                  onBlur: (x) => f(b, x.currentTarget.textContent || ""),
                  children: g.id
                }
              ),
              /* @__PURE__ */ k.jsxs(qC, { children: [
                d(g.start),
                " - ",
                d(g.end)
              ] })
            ] }),
            i.length > 0 && /* @__PURE__ */ k.jsx(zC, { onClick: (x) => x.stopPropagation(), children: i.map((x, y) => /* @__PURE__ */ k.jsx(
              GC,
              {
                title: x.title,
                onClick: () => _(x, g, b),
                children: x.text ? x.text : /* @__PURE__ */ k.jsx("i", { className: m(x.class || "") })
              },
              y
            )) })
          ] }),
          /* @__PURE__ */ k.jsx(
            ZC,
            {
              $isEditable: s,
              contentEditable: s,
              suppressContentEditableWarning: !0,
              onBlur: (x) => p(b, x.currentTarget.textContent || ""),
              children: g.lines.join(`
`)
            }
          )
        ]
      },
      g.id
    );
  }) });
}, xp = $t.memo(YC), XC = ({
  checked: e,
  onChange: t,
  disabled: n = !1,
  className: s
}) => {
  const i = (r) => {
    t(r.target.checked);
  };
  return /* @__PURE__ */ k.jsxs(Zo, { className: s, children: [
    /* @__PURE__ */ k.jsx(
      Yo,
      {
        type: "checkbox",
        id: "continuous-play",
        className: "continuous-play",
        checked: e,
        onChange: i,
        disabled: n
      }
    ),
    /* @__PURE__ */ k.jsx(Xo, { htmlFor: "continuous-play", children: "Continuous Play" })
  ] });
}, UC = ({
  checked: e,
  onChange: t,
  disabled: n = !1,
  className: s
}) => {
  const i = (r) => {
    t(r.target.checked);
  };
  return /* @__PURE__ */ k.jsxs(Zo, { className: s, children: [
    /* @__PURE__ */ k.jsx(
      Yo,
      {
        type: "checkbox",
        id: "link-endpoints",
        className: "link-endpoints",
        checked: e,
        onChange: i,
        disabled: n
      }
    ),
    /* @__PURE__ */ k.jsx(Xo, { htmlFor: "link-endpoints", children: "Link Endpoints" })
  ] });
}, HC = ({
  checked: e,
  onChange: t,
  className: n
}) => /* @__PURE__ */ k.jsxs(Zo, { className: n, children: [
  /* @__PURE__ */ k.jsx(
    Yo,
    {
      type: "checkbox",
      id: "editable-annotations",
      checked: e,
      onChange: (s) => t(s.target.checked)
    }
  ),
  /* @__PURE__ */ k.jsx(Xo, { htmlFor: "editable-annotations", children: "Editable Annotations" })
] }), KC = ({
  annotations: e,
  filename: t = "annotations.json",
  disabled: n = !1,
  className: s,
  children: i = "Download JSON"
}) => {
  const r = () => {
    if (e.length === 0)
      return;
    const o = e.map((h) => RC(h)), a = JSON.stringify(o, null, 2), c = new Blob([a], { type: "application/json" }), l = URL.createObjectURL(c), u = document.createElement("a");
    u.href = l, u.download = t, document.body.appendChild(u), u.click(), document.body.removeChild(u), URL.revokeObjectURL(l);
  };
  return /* @__PURE__ */ k.jsx(
    dn,
    {
      variant: "info",
      onClick: r,
      disabled: n || e.length === 0,
      className: s,
      title: e.length === 0 ? "No annotations to download" : "Download the annotations as JSON",
      children: i
    }
  );
};
function QC(e) {
  let t = 1 / 0, n = -1 / 0;
  for (let s = 0; s < e.length; s++) {
    const i = e[s];
    t > i && (t = i), n < i && (n = i);
  }
  return { min: t, max: n };
}
function Vh(e, t) {
  const n = Math.pow(2, t - 1), s = e < 0 ? e * n : e * (n - 1);
  return Math.max(-n, Math.min(n - 1, s));
}
function wp(e, t) {
  switch (e) {
    case 8:
      return new Int8Array(t);
    case 16:
      return new Int16Array(t);
  }
}
function Wh(e, t, n) {
  const s = e.length, i = Math.ceil(s / t), r = wp(n, i * 2);
  for (let o = 0; o < i; o++) {
    const a = o * t, c = Math.min((o + 1) * t, s), l = e.subarray(a, c), u = QC(l), h = Vh(u.min, n), d = Vh(u.max, n);
    r[o * 2] = h, r[o * 2 + 1] = d;
  }
  return r;
}
function JC(e, t) {
  const n = e.length, s = 1 / n, i = e[0].length / 2, r = wp(t, i * 2);
  for (let o = 0; o < i; o++) {
    let a = 0, c = 0;
    for (let l = 0; l < n; l++)
      a += s * e[l][o * 2], c += s * e[l][o * 2 + 1];
    r[o * 2] = a, r[o * 2 + 1] = c;
  }
  return [r];
}
function tS(e, t = 1e3, n = !0, s = 0, i, r = 16) {
  if (r !== 8 && r !== 16)
    throw new Error("Invalid number of bits specified for peaks. Must be 8 or 16.");
  let o = [];
  if ("getChannelData" in e) {
    const c = e.numberOfChannels, l = i ?? e.length;
    for (let u = 0; u < c; u++) {
      const d = e.getChannelData(u).subarray(s, l);
      o.push(Wh(d, t, r));
    }
  } else {
    const c = i ?? e.length, l = e.subarray(s, c);
    o.push(Wh(l, t, r));
  }
  return n && o.length > 1 && (o = JC(o, r)), {
    length: o[0].length / 2,
    data: o,
    bits: r
  };
}
function mc(e, t = 1e3, n = !0, s = 8, i = 0, r) {
  const o = e.sampleRate, a = Math.floor(i * o), c = r !== void 0 ? Math.floor((i + r) * o) : void 0;
  return tS(e, t, n, a, c, s);
}
function eS() {
  const [e, t] = ft("hh:mm:ss.uuu");
  return {
    timeFormat: e,
    setTimeFormat: t,
    formatTime: (s) => hc(s, e)
  };
}
const nS = [256, 512, 1024, 2048, 4096, 8192];
function sS({
  initialSamplesPerPixel: e,
  zoomLevels: t = nS
}) {
  const [n, s] = ft(() => {
    const l = t.indexOf(e);
    return l !== -1 ? l : Math.floor(t.length / 2);
  }), i = t[n], r = n > 0, o = n < t.length - 1, a = rt(() => {
    s((l) => Math.max(0, l - 1));
  }, []), c = rt(() => {
    s((l) => Math.min(t.length - 1, l + 1));
  }, [t.length]);
  return {
    samplesPerPixel: i,
    zoomIn: a,
    zoomOut: c,
    canZoomIn: r,
    canZoomOut: o
  };
}
function iS({
  playoutRef: e,
  initialVolume: t = 1,
  onVolumeChange: n
}) {
  const [s, i] = ft(t), r = rt((o) => {
    i(o), e.current && e.current.setMasterGain(o), n?.(o);
  }, [e, n]);
  return {
    masterVolume: s,
    setMasterVolume: r
  };
}
const IT = (e = 256) => {
  const t = xt(null), n = rt((s, i, r) => {
    const o = new os("fft", e);
    return s.connect(o), s.connect(i), t.current = o, function() {
      o.dispose(), t.current = null;
    };
  }, [e]);
  return { analyserRef: t, masterEffects: n };
}, ET = (e = 1.2) => rt((n, s, i) => {
  const r = new cr({
    context: n.context,
    decay: e
  });
  return n.connect(r), r.connect(s), function() {
    r.disconnect(), r.dispose();
  };
}, [e]), DT = (e = {}) => {
  const { baseFrequency: t = 50, octaves: n = 6, sensitivity: s = -30 } = e;
  return rt((r, o, a) => {
    const c = new ar({
      context: r.context,
      baseFrequency: t,
      octaves: n,
      sensitivity: s
    });
    return r.connect(c), c.connect(o), function() {
      c.disconnect(), c.dispose();
    };
  }, [t, n, s]);
}, RT = (e) => rt((n, s, i) => {
  if (e.length === 0) {
    n.connect(s);
    return;
  }
  if (e.length === 1)
    return e[0](n, s, i);
  const r = [], o = [];
  return e.forEach((a, c) => {
    const l = new os("waveform", 1024);
    o.push(l);
    const u = a(
      c === 0 ? n : o[c - 1],
      l,
      i
    );
    u && r.push(u);
  }), o[o.length - 1].connect(s), function() {
    r.forEach((c) => c()), o.forEach((c) => c.dispose());
  };
}, [e]);
function gc(e) {
  const {
    audioBuffer: t,
    startSample: n,
    durationSamples: s = t.length,
    // Full buffer by default
    offsetSamples: i = 0,
    gain: r = 1,
    name: o,
    color: a,
    fadeIn: c,
    fadeOut: l
  } = e;
  return {
    id: Cp(),
    audioBuffer: t,
    startSample: n,
    durationSamples: s,
    offsetSamples: i,
    gain: r,
    name: o,
    color: a,
    fadeIn: c,
    fadeOut: l
  };
}
function rS(e) {
  const {
    audioBuffer: t,
    startTime: n,
    duration: s = t.duration,
    offset: i = 0,
    gain: r = 1,
    name: o,
    color: a,
    fadeIn: c,
    fadeOut: l
  } = e, u = t.sampleRate;
  return gc({
    audioBuffer: t,
    startSample: Math.round(n * u),
    durationSamples: Math.round(s * u),
    offsetSamples: Math.round(i * u),
    gain: r,
    name: o,
    color: a,
    fadeIn: c,
    fadeOut: l
  });
}
function oS(e) {
  const {
    name: t,
    clips: n = [],
    muted: s = !1,
    soloed: i = !1,
    volume: r = 1,
    pan: o = 0,
    color: a,
    height: c
  } = e;
  return {
    id: Cp(),
    name: t,
    clips: n,
    muted: s,
    soloed: i,
    volume: r,
    pan: o,
    color: a,
    height: c
  };
}
function Cp() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function OT(e) {
  const [t, n] = ft([]), [s, i] = ft(!0), [r, o] = ft(null);
  return Ht(() => {
    if (e.length === 0) {
      n([]), i(!1);
      return;
    }
    let a = !1;
    return (async () => {
      try {
        i(!0), o(null);
        const l = It().rawContext, u = e.map(async (d, p) => {
          const f = await fetch(d.src);
          if (!f.ok)
            throw new Error(`Failed to fetch ${d.src}: ${f.statusText}`);
          const _ = await f.arrayBuffer(), m = await l.decodeAudioData(_);
          if (!m || !m.sampleRate || !m.duration)
            throw new Error(`Invalid audio buffer for ${d.src}`);
          const g = rS({
            audioBuffer: m,
            startTime: d.startTime ?? 0,
            // Use config or default to 0
            duration: d.duration ?? m.duration,
            // Use config or full duration
            offset: d.offset ?? 0,
            // Use config or no trim
            name: d.name || `Track ${p + 1}`
          });
          if (isNaN(g.startSample) || isNaN(g.durationSamples) || isNaN(g.offsetSamples))
            throw console.error("Invalid clip values:", g), new Error(`Invalid clip values for ${d.src}`);
          return {
            ...oS({
              name: d.name || `Track ${p + 1}`,
              clips: [g],
              muted: d.muted ?? !1,
              soloed: d.soloed ?? !1,
              volume: d.volume ?? 1,
              pan: d.pan ?? 0,
              color: d.color
            }),
            effects: d.effects
            // Add effects if provided
          };
        }), h = await Promise.all(u);
        a || (n(h), i(!1));
      } catch (l) {
        if (!a) {
          const u = l instanceof Error ? l.message : "Unknown error loading audio";
          o(u), i(!1), console.error("Error loading audio tracks:", l);
        }
      }
    })(), () => {
      a = !0;
    };
  }, [e]), { tracks: t, loading: s, error: r };
}
function MT({
  tracks: e,
  onTracksChange: t,
  samplesPerPixel: n,
  sampleRate: s
}) {
  const i = $t.useRef(null), r = $t.useCallback(
    (l) => {
      const { transform: u, active: h } = l;
      if (!h?.data?.current) return { ...u, scaleX: 1, scaleY: 1 };
      const { trackIndex: d, clipIndex: p, boundary: f } = h.data.current;
      if (f)
        return { ...u, scaleX: 1, scaleY: 1 };
      const _ = e[d];
      if (!_) return { ...u, scaleX: 1, scaleY: 1 };
      const m = _.clips[p];
      if (!m) return { ...u, scaleX: 1, scaleY: 1 };
      const g = m.startSample / s, b = m.durationSamples / s, v = u.x * n / s;
      let x = g + v;
      const y = [..._.clips].sort((A, I) => A.startSample - I.startSample), w = y.findIndex((A) => A === m);
      x = Math.max(0, x);
      const S = w > 0 ? y[w - 1] : null;
      if (S) {
        const A = (S.startSample + S.durationSamples) / s;
        x = Math.max(x, A);
      }
      const C = w < y.length - 1 ? y[w + 1] : null;
      if (C) {
        const A = x + b, I = C.startSample / s;
        A > I && (x = I - b);
      }
      const R = (x - g) * s / n;
      return {
        ...u,
        x: R,
        scaleX: 1,
        scaleY: 1
      };
    },
    [e, n, s]
  ), o = $t.useCallback(
    (l) => {
      const { active: u } = l, { boundary: h } = u.data.current;
      if (!h) {
        i.current = null;
        return;
      }
      const { trackIndex: d, clipIndex: p } = u.data.current, _ = e[d]?.clips[p];
      _ && (i.current = {
        offsetSamples: _.offsetSamples,
        durationSamples: _.durationSamples,
        startSample: _.startSample
      });
    },
    [e]
  ), a = $t.useCallback(
    (l) => {
      const { active: u, delta: h } = l, { boundary: d } = u.data.current;
      if (!d || !i.current) return;
      const { trackIndex: p, clipIndex: f } = u.data.current, _ = h.x * n, m = Math.floor(0.1 * s), g = i.current, b = e.map((v, x) => {
        if (x !== p) return v;
        const y = [...v.clips].sort((C, D) => C.startSample - D.startSample), w = y.findIndex((C) => C === v.clips[f]), S = v.clips.map((C, D) => {
          if (D !== f) return C;
          const R = Math.floor(C.audioBuffer.duration * s);
          if (d === "left") {
            let A = Math.floor(g.offsetSamples + _), I = Math.floor(g.durationSamples - _), F = Math.floor(g.startSample + _);
            if (F < 0) {
              const V = -F;
              F = 0, A += V, I -= V;
            }
            if (A < 0) {
              const V = -A;
              A = 0, I += V, F -= V;
            }
            if (I < m) {
              const V = m - I;
              I = m, A -= V, F -= V, A = Math.max(0, A);
            }
            A + I > R && (A = R - I);
            const N = w > 0 ? y[w - 1] : null;
            if (N) {
              const V = N.startSample + N.durationSamples;
              if (F < V) {
                const W = V - F;
                F = V, A += W, I -= W, I < m && (I = m, A = Math.min(A, R - m));
              }
            }
            return {
              ...C,
              offsetSamples: A,
              durationSamples: I,
              startSample: F
            };
          } else {
            let A = Math.floor(g.durationSamples + _);
            A = Math.max(m, A), g.offsetSamples + A > R && (A = R - g.offsetSamples);
            const I = w < y.length - 1 ? y[w + 1] : null;
            return I && g.startSample + A > I.startSample && (A = I.startSample - g.startSample, A = Math.max(m, A)), { ...C, durationSamples: A };
          }
        });
        return { ...v, clips: S };
      });
      t(b);
    },
    [e, t, n, s]
  ), c = $t.useCallback(
    (l) => {
      const { active: u, delta: h } = l, { trackIndex: d, clipIndex: p, boundary: f } = u.data.current, _ = h.x * n;
      if (f) {
        i.current = null;
        return;
      }
      const m = e.map((g, b) => {
        if (b !== d) return g;
        const v = [...g.clips].sort((w, S) => w.startSample - S.startSample), x = v.findIndex((w) => w === g.clips[p]), y = g.clips.map((w, S) => {
          if (S !== p) return w;
          let C = Math.floor(w.startSample + _);
          C = Math.max(0, C);
          const D = x > 0 ? v[x - 1] : null;
          if (D) {
            const A = D.startSample + D.durationSamples;
            C = Math.max(C, A);
          }
          const R = x < v.length - 1 ? v[x + 1] : null;
          return R && C + w.durationSamples > R.startSample && (C = R.startSample - w.durationSamples), {
            ...w,
            startSample: C
          };
        });
        return {
          ...g,
          clips: y
        };
      });
      t(m);
    },
    [e, t, n, s]
  );
  return {
    onDragStart: o,
    onDragMove: a,
    onDragEnd: c,
    collisionModifier: r
  };
}
const Aa = 0.01;
function FT({
  annotations: e,
  onAnnotationsChange: t,
  samplesPerPixel: n,
  sampleRate: s,
  duration: i,
  linkEndpoints: r
}) {
  const o = $t.useRef(null), a = $t.useCallback(
    (u) => {
      const { active: h } = u, d = h.data.current;
      if (!d || d.annotationIndex === void 0) {
        o.current = null;
        return;
      }
      const p = e[d.annotationIndex];
      p && (o.current = {
        start: p.start,
        end: p.end,
        annotationIndex: d.annotationIndex
      });
    },
    [e]
  ), c = $t.useCallback(
    (u) => {
      const { active: h, delta: d } = u;
      if (!o.current)
        return;
      const p = h.data.current;
      if (!p) return;
      const { edge: f, annotationIndex: _ } = p, m = o.current, g = d.x * n / s, b = f === "start" ? m.start + g : m.end + g, v = aS({
        annotationIndex: _,
        newTime: b,
        isDraggingStart: f === "start",
        annotations: e,
        duration: i,
        linkEndpoints: r
      });
      t(v);
    },
    [e, t, n, s, i, r]
  ), l = $t.useCallback(() => {
    o.current = null;
  }, []);
  return {
    onDragStart: a,
    onDragMove: c,
    onDragEnd: l
  };
}
function aS({
  annotationIndex: e,
  newTime: t,
  isDraggingStart: n,
  annotations: s,
  duration: i,
  linkEndpoints: r
}) {
  const o = [...s], a = s[e];
  if (n) {
    const c = Math.min(a.end - 0.1, Math.max(0, t)), l = c - a.start;
    if (o[e] = {
      ...a,
      start: c
    }, r && e > 0) {
      const u = o[e - 1];
      Math.abs(u.end - a.start) < Aa ? o[e - 1] = {
        ...u,
        end: Math.max(u.start + 0.1, u.end + l)
      } : c <= u.end && (o[e] = {
        ...o[e],
        start: u.end
      });
    } else !r && e > 0 && c < o[e - 1].end && (o[e - 1] = {
      ...o[e - 1],
      end: c
    });
  } else {
    const c = Math.max(a.start + 0.1, Math.min(t, i)), l = c - a.end;
    if (o[e] = {
      ...a,
      end: c
    }, r && e < o.length - 1) {
      const u = o[e + 1];
      if (Math.abs(u.start - a.end) < Aa) {
        const h = u.start + l;
        o[e + 1] = {
          ...u,
          start: Math.min(u.end - 0.1, h)
        };
        let d = e + 1;
        for (; d < o.length - 1; ) {
          const p = o[d], f = o[d + 1];
          if (Math.abs(f.start - p.end) < Aa) {
            const _ = p.end - s[d].end;
            o[d + 1] = {
              ...f,
              start: Math.min(f.end - 0.1, f.start + _)
            }, d++;
          } else
            break;
        }
      } else c >= u.start && (o[e] = {
        ...o[e],
        end: u.start
      });
    } else if (!r && e < o.length - 1 && c > o[e + 1].start) {
      const u = o[e + 1];
      o[e + 1] = {
        ...u,
        start: c
      };
      let h = e + 1;
      for (; h < o.length - 1; ) {
        const d = o[h], p = o[h + 1];
        if (d.end > p.start)
          o[h + 1] = {
            ...p,
            start: d.end
          }, h++;
        else
          break;
      }
    }
  }
  return o;
}
function PT() {
  return Nb(
    Pb(uf, {
      activationConstraint: {
        distance: 1
        // Require 1px movement before drag starts (immediate feedback)
      }
    })
  );
}
const NT = (e) => {
  const { tracks: t, onTracksChange: n, sampleRate: s } = e, { currentTime: i } = Cn(), { selectedTrackId: r } = jn(), o = rt(
    (c, l, u) => {
      const { sampleRate: h, samplesPerPixel: d } = e, p = t[c];
      if (!p) return !1;
      const f = p.clips[l];
      if (!f) return !1;
      const _ = f.startSample / h, m = (f.startSample + f.durationSamples) / h;
      if (u <= _ || u >= m)
        return console.warn("Split time is outside clip bounds"), !1;
      const g = Math.round(u * h), b = Math.floor(g / d), v = f.startSample + f.durationSamples, x = b * d, y = f.startSample, w = x - y, S = x, C = v - S, D = x - f.startSample, R = gc({
        audioBuffer: f.audioBuffer,
        startSample: y,
        durationSamples: w,
        offsetSamples: f.offsetSamples,
        gain: f.gain,
        name: f.name ? `${f.name} (1)` : void 0,
        color: f.color,
        fadeIn: f.fadeIn
        // Note: fadeOut removed for first clip since it's cut
      }), A = gc({
        audioBuffer: f.audioBuffer,
        startSample: S,
        durationSamples: C,
        offsetSamples: f.offsetSamples + D,
        gain: f.gain,
        name: f.name ? `${f.name} (2)` : void 0,
        color: f.color,
        // Note: fadeIn removed for second clip since it's cut
        fadeOut: f.fadeOut
      }), I = [...p.clips];
      I.splice(l, 1, R, A);
      const F = [...t];
      return F[c] = {
        ...p,
        clips: I
      }, n(F), !0;
    },
    [t, n, e]
  );
  return {
    splitClipAtPlayhead: rt(() => {
      if (!r)
        return console.log("No track selected - click a clip to select a track first"), !1;
      const c = t.findIndex((u) => u.id === r);
      if (c === -1)
        return console.warn("Selected track not found"), !1;
      const l = t[c];
      for (let u = 0; u < l.clips.length; u++) {
        const h = l.clips[u], d = h.startSample / s, p = (h.startSample + h.durationSamples) / s;
        if (i > d && i < p)
          return console.log(`Splitting clip on track "${l.name}" at ${i}s`), o(c, u, i);
      }
      return console.log(`No clip found at playhead position on track "${l.name}"`), !1;
    }, [t, i, r, o, s]),
    splitClipAt: o
  };
}, cS = (e) => {
  const { shortcuts: t, enabled: n = !0 } = e, s = rt(
    (i) => {
      if (!n) return;
      const r = i.target;
      if (r.tagName === "INPUT" || r.tagName === "TEXTAREA" || r.isContentEditable)
        return;
      const o = t.find((a) => {
        const c = i.key.toLowerCase() === a.key.toLowerCase() || i.key === a.key, l = a.ctrlKey === void 0 || i.ctrlKey === a.ctrlKey, u = a.shiftKey === void 0 || i.shiftKey === a.shiftKey, h = a.metaKey === void 0 || i.metaKey === a.metaKey, d = a.altKey === void 0 || i.altKey === a.altKey;
        return c && l && u && h && d;
      });
      o && (o.preventDefault !== !1 && i.preventDefault(), o.action());
    },
    [t, n]
  );
  Ht(() => {
    if (n)
      return window.addEventListener("keydown", s), () => {
        window.removeEventListener("keydown", s);
      };
  }, [s, n]);
}, ka = 0.01, Er = 0.01;
function VT({
  annotations: e,
  activeAnnotationId: t,
  onAnnotationsChange: n,
  duration: s,
  linkEndpoints: i,
  enabled: r = !0
}) {
  const o = Rn(() => t ? e.findIndex((u) => u.id === t) : -1, [e, t]), a = rt(
    (u) => {
      if (o < 0) return;
      const h = e[o], d = Math.max(0, Math.min(h.end - 0.1, h.start + u)), p = d - h.start, f = [...e];
      if (f[o] = {
        ...h,
        start: d
      }, i && o > 0) {
        const _ = f[o - 1];
        Math.abs(_.end - h.start) < ka && (f[o - 1] = {
          ..._,
          end: Math.max(_.start + 0.1, _.end + p)
        });
      } else if (!i && o > 0) {
        const _ = f[o - 1];
        d < _.end && (f[o - 1] = {
          ..._,
          end: d
        });
      }
      n(f);
    },
    [e, o, i, n]
  ), c = rt(
    (u) => {
      if (o < 0) return;
      const h = e[o], d = Math.max(h.start + 0.1, Math.min(s, h.end + u)), p = d - h.end, f = [...e];
      if (f[o] = {
        ...h,
        end: d
      }, i && o < e.length - 1) {
        const _ = f[o + 1];
        if (Math.abs(_.start - h.end) < ka) {
          const m = Math.min(_.end - 0.1, _.start + p);
          f[o + 1] = {
            ..._,
            start: m
          };
          let g = o + 1;
          for (; g < f.length - 1; ) {
            const b = f[g], v = f[g + 1];
            if (Math.abs(v.start - e[g].end) < ka) {
              const x = b.end - e[g].end;
              f[g + 1] = {
                ...v,
                start: Math.min(v.end - 0.1, v.start + x)
              }, g++;
            } else
              break;
          }
        }
      } else if (!i && o < e.length - 1) {
        const _ = f[o + 1];
        if (d > _.start) {
          f[o + 1] = {
            ..._,
            start: d
          };
          let m = o + 1;
          for (; m < f.length - 1; ) {
            const g = f[m], b = f[m + 1];
            if (g.end > b.start)
              f[m + 1] = {
                ...b,
                start: g.end
              }, m++;
            else
              break;
          }
        }
      }
      n(f);
    },
    [e, o, s, i, n]
  ), l = Rn(
    () => [
      {
        key: "[",
        action: () => a(-Er),
        description: "Move annotation start earlier",
        preventDefault: !0
      },
      {
        key: "]",
        action: () => a(Er),
        description: "Move annotation start later",
        preventDefault: !0
      },
      {
        key: "{",
        shiftKey: !0,
        action: () => c(-Er),
        description: "Move annotation end earlier",
        preventDefault: !0
      },
      {
        key: "}",
        shiftKey: !0,
        action: () => c(Er),
        description: "Move annotation end later",
        preventDefault: !0
      }
    ],
    [a, c]
  );
  return cS({
    shortcuts: l,
    enabled: r && o >= 0
  }), {
    moveStartBoundary: a,
    moveEndBoundary: c
  };
}
function lS(e) {
  const t = e.reduce((i, r) => i + r.length, 0), n = new Float32Array(t);
  let s = 0;
  for (const i of e)
    n.set(i, s), s += i.length;
  return n;
}
function uS(e, t, n, s = 1) {
  const i = e.createBuffer(
    s,
    t.length,
    n
  ), r = new Float32Array(t);
  return i.copyToChannel(r, 0), i;
}
function jh(e, t, n = 16) {
  const s = Math.ceil(e.length / t), i = n === 8 ? new Int8Array(s * 2) : new Int16Array(s * 2), r = 2 ** (n - 1);
  for (let o = 0; o < s; o++) {
    const a = o * t, c = Math.min(a + t, e.length);
    let l = 0, u = 0;
    for (let h = a; h < c; h++) {
      const d = e[h];
      d < l && (l = d), d > u && (u = d);
    }
    i[o * 2] = Math.floor(l * r), i[o * 2 + 1] = Math.floor(u * r);
  }
  return i;
}
function hS(e, t, n, s, i = 16) {
  const r = 2 ** (i - 1), o = s % n;
  let a = 0;
  if (o > 0 && e.length > 0) {
    const u = n - o, h = Math.min(u, t.length);
    let d = e[e.length - 2] / r, p = e[e.length - 1] / r;
    for (let g = 0; g < h; g++) {
      const b = t[g];
      b < d && (d = b), b > p && (p = b);
    }
    const f = new (i === 8 ? Int8Array : Int16Array)(e.length);
    f.set(e), f[e.length - 2] = Math.floor(d * r), f[e.length - 1] = Math.floor(p * r), a = h;
    const _ = jh(t.slice(a), n, i), m = new (i === 8 ? Int8Array : Int16Array)(f.length + _.length);
    return m.set(f), m.set(_, f.length), m;
  }
  const c = jh(t.slice(a), n, i), l = new (i === 8 ? Int8Array : Int16Array)(e.length + c.length);
  return l.set(e), l.set(c, e.length), l;
}
function dS(e, t = {}) {
  const {
    channelCount: n = 1,
    samplesPerPixel: s = 1024
  } = t, [i, r] = ft(!1), [o, a] = ft(!1), [c, l] = ft(0), [u, h] = ft(new Int16Array(0)), [d, p] = ft(null), [f, _] = ft(null), [m, g] = ft(0), [b, v] = ft(0), x = 16, y = xt(!1), w = xt(null), S = xt(null), C = xt([]), D = xt(0), R = xt(null), A = xt(0), I = xt(!1), F = xt(!1), N = rt(async (z) => {
    if (!y.current)
      try {
        const E = new URL("data:text/javascript;base64,InVzZSBzdHJpY3QiOwoKLy8gc3JjL3dvcmtsZXQvcmVjb3JkaW5nLXByb2Nlc3Nvci53b3JrbGV0LnRzCnZhciBSZWNvcmRpbmdQcm9jZXNzb3IgPSBjbGFzcyBleHRlbmRzIEF1ZGlvV29ya2xldFByb2Nlc3NvciB7CiAgY29uc3RydWN0b3IoKSB7CiAgICBzdXBlcigpOwogICAgdGhpcy5idWZmZXJTaXplID0gMDsKICAgIHRoaXMuYnVmZmVycyA9IFtdOwogICAgdGhpcy5zYW1wbGVzQ29sbGVjdGVkID0gMDsKICAgIHRoaXMuaXNSZWNvcmRpbmcgPSBmYWxzZTsKICAgIHRoaXMuY2hhbm5lbENvdW50ID0gMTsKICAgIHRoaXMucG9ydC5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHsKICAgICAgY29uc3QgeyBjb21tYW5kLCBzYW1wbGVSYXRlOiBzYW1wbGVSYXRlMiwgY2hhbm5lbENvdW50IH0gPSBldmVudC5kYXRhOwogICAgICBpZiAoY29tbWFuZCA9PT0gInN0YXJ0IikgewogICAgICAgIHRoaXMuaXNSZWNvcmRpbmcgPSB0cnVlOwogICAgICAgIHRoaXMuY2hhbm5lbENvdW50ID0gY2hhbm5lbENvdW50IHx8IDE7CiAgICAgICAgdGhpcy5idWZmZXJTaXplID0gTWF0aC5mbG9vcigoc2FtcGxlUmF0ZTIgfHwgNDhlMykgKiAwLjAxNik7CiAgICAgICAgdGhpcy5idWZmZXJzID0gW107CiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNoYW5uZWxDb3VudDsgaSsrKSB7CiAgICAgICAgICB0aGlzLmJ1ZmZlcnNbaV0gPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuYnVmZmVyU2l6ZSk7CiAgICAgICAgfQogICAgICAgIHRoaXMuc2FtcGxlc0NvbGxlY3RlZCA9IDA7CiAgICAgIH0gZWxzZSBpZiAoY29tbWFuZCA9PT0gInN0b3AiKSB7CiAgICAgICAgdGhpcy5pc1JlY29yZGluZyA9IGZhbHNlOwogICAgICAgIGlmICh0aGlzLnNhbXBsZXNDb2xsZWN0ZWQgPiAwKSB7CiAgICAgICAgICB0aGlzLmZsdXNoQnVmZmVycygpOwogICAgICAgIH0KICAgICAgfQogICAgfTsKICB9CiAgcHJvY2VzcyhpbnB1dHMsIG91dHB1dHMsIHBhcmFtZXRlcnMpIHsKICAgIGlmICghdGhpcy5pc1JlY29yZGluZykgewogICAgICByZXR1cm4gdHJ1ZTsKICAgIH0KICAgIGNvbnN0IGlucHV0ID0gaW5wdXRzWzBdOwogICAgaWYgKCFpbnB1dCB8fCBpbnB1dC5sZW5ndGggPT09IDApIHsKICAgICAgcmV0dXJuIHRydWU7CiAgICB9CiAgICBjb25zdCBmcmFtZUNvdW50ID0gaW5wdXRbMF0ubGVuZ3RoOwogICAgZm9yIChsZXQgY2hhbm5lbCA9IDA7IGNoYW5uZWwgPCBNYXRoLm1pbihpbnB1dC5sZW5ndGgsIHRoaXMuY2hhbm5lbENvdW50KTsgY2hhbm5lbCsrKSB7CiAgICAgIGNvbnN0IGlucHV0Q2hhbm5lbCA9IGlucHV0W2NoYW5uZWxdOwogICAgICBjb25zdCBidWZmZXIgPSB0aGlzLmJ1ZmZlcnNbY2hhbm5lbF07CiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJhbWVDb3VudDsgaSsrKSB7CiAgICAgICAgYnVmZmVyW3RoaXMuc2FtcGxlc0NvbGxlY3RlZCArIGldID0gaW5wdXRDaGFubmVsW2ldOwogICAgICB9CiAgICB9CiAgICB0aGlzLnNhbXBsZXNDb2xsZWN0ZWQgKz0gZnJhbWVDb3VudDsKICAgIGlmICh0aGlzLnNhbXBsZXNDb2xsZWN0ZWQgPj0gdGhpcy5idWZmZXJTaXplKSB7CiAgICAgIHRoaXMuZmx1c2hCdWZmZXJzKCk7CiAgICB9CiAgICByZXR1cm4gdHJ1ZTsKICB9CiAgZmx1c2hCdWZmZXJzKCkgewogICAgY29uc3Qgc2FtcGxlcyA9IHRoaXMuYnVmZmVyc1swXS5zbGljZSgwLCB0aGlzLnNhbXBsZXNDb2xsZWN0ZWQpOwogICAgdGhpcy5wb3J0LnBvc3RNZXNzYWdlKHsKICAgICAgc2FtcGxlcywKICAgICAgc2FtcGxlUmF0ZSwKICAgICAgY2hhbm5lbENvdW50OiB0aGlzLmNoYW5uZWxDb3VudAogICAgfSk7CiAgICB0aGlzLnNhbXBsZXNDb2xsZWN0ZWQgPSAwOwogIH0KfTsKcmVnaXN0ZXJQcm9jZXNzb3IoInJlY29yZGluZy1wcm9jZXNzb3IiLCBSZWNvcmRpbmdQcm9jZXNzb3IpOwovLyMgc291cmNlTWFwcGluZ1VSTD1yZWNvcmRpbmctcHJvY2Vzc29yLndvcmtsZXQuanMubWFw", import.meta.url).href;
        await z.audioWorklet.addModule(E), y.current = !0;
      } catch (E) {
        throw console.error("Failed to load AudioWorklet module:", E), new Error("Failed to load recording processor");
      }
  }, []), V = rt(async () => {
    if (!e) {
      _(new Error("No microphone stream available"));
      return;
    }
    try {
      _(null);
      const z = Ys();
      await Mr(), await N(z);
      const E = rf(e);
      S.current = E;
      const O = new AudioWorkletNode(z, "recording-processor");
      w.current = O, E.connect(O), O.port.onmessage = (H) => {
        const { samples: G } = H.data;
        C.current.push(G), D.current += G.length, h(
          (X) => hS(
            X,
            G,
            s,
            D.current - G.length,
            x
          )
        );
      }, O.port.postMessage({
        command: "start",
        sampleRate: z.sampleRate,
        channelCount: n
      }), C.current = [], D.current = 0, h(new Int16Array(0)), p(null), g(0), v(0), I.current = !0, F.current = !1, r(!0), a(!1), A.current = performance.now();
      const Z = () => {
        if (I.current && !F.current) {
          const H = (performance.now() - A.current) / 1e3;
          l(H), R.current = requestAnimationFrame(Z);
        }
      };
      Z();
    } catch (z) {
      console.error("Failed to start recording:", z), _(z instanceof Error ? z : new Error("Failed to start recording"));
    }
  }, [e, n, s, N, i, o]), W = rt(async () => {
    if (!i)
      return null;
    try {
      if (w.current) {
        if (w.current.port.postMessage({ command: "stop" }), S.current)
          try {
            S.current.disconnect(w.current);
          } catch {
          }
        w.current.disconnect();
      }
      R.current !== null && (cancelAnimationFrame(R.current), R.current = null);
      const z = lS(C.current), E = Ys(), O = uS(
        E,
        z,
        E.sampleRate,
        n
      );
      return p(O), l(O.duration), I.current = !1, F.current = !1, r(!1), a(!1), g(0), O;
    } catch (z) {
      return console.error("Failed to stop recording:", z), _(z instanceof Error ? z : new Error("Failed to stop recording")), null;
    }
  }, [i, n]), L = rt(() => {
    i && !o && (R.current !== null && (cancelAnimationFrame(R.current), R.current = null), F.current = !0, a(!0));
  }, [i, o]), J = rt(() => {
    if (i && o) {
      F.current = !1, a(!1), A.current = performance.now() - c * 1e3;
      const z = () => {
        if (I.current && !F.current) {
          const E = (performance.now() - A.current) / 1e3;
          l(E), R.current = requestAnimationFrame(z);
        }
      };
      z();
    }
  }, [i, o, c]);
  return Ht(() => () => {
    if (w.current) {
      if (w.current.port.postMessage({ command: "stop" }), S.current)
        try {
          S.current.disconnect(w.current);
        } catch {
        }
      w.current.disconnect();
    }
    R.current !== null && cancelAnimationFrame(R.current);
  }, []), {
    isRecording: i,
    isPaused: o,
    duration: c,
    peaks: u,
    audioBuffer: d,
    level: m,
    peakLevel: b,
    startRecording: V,
    stopRecording: W,
    pauseRecording: L,
    resumeRecording: J,
    error: f
  };
}
function fS() {
  const [e, t] = ft(null), [n, s] = ft([]), [i, r] = ft(!1), [o, a] = ft(!1), [c, l] = ft(null), u = rt(async () => {
    try {
      const f = (await navigator.mediaDevices.enumerateDevices()).filter((_) => _.kind === "audioinput").map((_) => ({
        deviceId: _.deviceId,
        label: _.label || `Microphone ${_.deviceId.slice(0, 8)}`,
        groupId: _.groupId
      }));
      s(f);
    } catch (p) {
      console.error("Failed to enumerate devices:", p), l(p instanceof Error ? p : new Error("Failed to enumerate devices"));
    }
  }, []), h = rt(async (p, f) => {
    a(!0), l(null);
    try {
      e && e.getTracks().forEach((b) => b.stop());
      const m = {
        audio: {
          // Recording-optimized defaults: prioritize raw audio quality and low latency
          echoCancellation: !1,
          noiseSuppression: !1,
          autoGainControl: !1,
          latency: 0,
          // Low latency mode (not in TS types yet, but supported in modern browsers)
          // User-provided constraints override defaults
          ...f,
          // Device ID override (if specified)
          ...p && { deviceId: { exact: p } }
        },
        video: !1
      }, g = await navigator.mediaDevices.getUserMedia(m);
      t(g), r(!0), await u();
    } catch (_) {
      console.error("Failed to access microphone:", _), l(
        _ instanceof Error ? _ : new Error("Failed to access microphone")
      ), r(!1);
    } finally {
      a(!1);
    }
  }, [e, u]), d = rt(() => {
    e && (e.getTracks().forEach((p) => p.stop()), t(null), r(!1));
  }, [e]);
  return Ht(() => (u(), () => {
    e && e.getTracks().forEach((p) => p.stop());
  }), []), {
    stream: e,
    devices: n,
    hasPermission: i,
    isLoading: o,
    requestAccess: h,
    stopStream: d,
    error: c
  };
}
function pS(e, t = {}) {
  const {
    updateRate: n = 60,
    fftSize: s = 256,
    smoothingTimeConstant: i = 0.8
  } = t, [r, o] = ft(0), [a, c] = ft(0), l = xt(null), u = xt(null), h = xt(null), d = xt(null), p = () => c(0);
  return Ht(() => {
    if (!e) {
      o(0), c(0);
      return;
    }
    let f = !0;
    return (async () => {
      const m = Ys();
      if (!f) return;
      const g = m.createAnalyser();
      g.fftSize = s, g.smoothingTimeConstant = i, l.current = g;
      const b = g.frequencyBinCount, v = new Uint8Array(b);
      d.current = v;
      const x = rf(e);
      x.connect(g), u.current = x;
      const y = 1e3 / n;
      let w = 0;
      const S = (C) => {
        if (C - w >= y) {
          w = C, g.getByteTimeDomainData(v);
          let D = 0;
          for (let A = 0; A < b; A++) {
            const I = (v[A] - 128) / 128;
            D += I * I;
          }
          const R = Math.sqrt(D / b);
          o(R), c((A) => Math.max(A, R));
        }
        h.current = requestAnimationFrame(S);
      };
      h.current = requestAnimationFrame(S);
    })(), () => {
      if (f = !1, h.current && cancelAnimationFrame(h.current), l.current && u.current)
        try {
          u.current.disconnect(l.current);
        } catch {
        }
      l.current = null, u.current = null, d.current = null;
    };
  }, [e, s, i, n]), {
    level: r,
    peakLevel: a,
    resetPeak: p
  };
}
q.button`
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  background: ${(e) => e.$isRecording ? "#dc3545" : "#e74c3c"};
  color: white;

  &:hover:not(:disabled) {
    background: ${(e) => e.$isRecording ? "#c82333" : "#c0392b"};
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.3);
  }
`;
q.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
  margin-right: 0.5rem;
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
`;
q(Vl)`
  min-width: 200px;
`;
q(Kf)`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;
q.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: ${(e) => e.$isRecording ? "#fff3cd" : "transparent"};
  border-radius: 0.25rem;
  transition: background 0.2s ease-in-out;
`;
q.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${(e) => e.$isPaused ? "#ffc107" : "#dc3545"};
  opacity: ${(e) => e.$isRecording ? 1 : 0};
  transition: opacity 0.2s ease-in-out;

  ${(e) => e.$isRecording && !e.$isPaused && `
    animation: blink 1.5s ease-in-out infinite;

    @keyframes blink {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
    }
  `}
`;
q.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  min-width: 70px;
`;
q.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: ${(e) => e.$isPaused ? "#ffc107" : "#dc3545"};
  text-transform: uppercase;
`;
var mS = q.div`
  position: relative;
  width: ${(e) => e.$width}px;
  height: ${(e) => e.$height}px;
  background: #2c3e50;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
`, gS = q.div`
  position: absolute;
  left: 0;
  top: 0;
  height: ${(e) => e.$height}px;
  width: ${(e) => e.$level * 100}%;
  background: ${(e) => e.$level < 0.6 ? "linear-gradient(90deg, #27ae60, #2ecc71)" : e.$level < 0.85 ? "linear-gradient(90deg, #f39c12, #f1c40f)" : "linear-gradient(90deg, #c0392b, #e74c3c)"};
  transition: width 0.05s ease-out, background 0.1s ease-out;
  box-shadow: ${(e) => e.$level > 0.01 ? "0 0 8px rgba(255, 255, 255, 0.3)" : "none"};
`, _S = q.div`
  position: absolute;
  left: ${(e) => e.$peakLevel * 100}%;
  top: 0;
  width: 2px;
  height: ${(e) => e.$height}px;
  background: #ecf0f1;
  box-shadow: 0 0 4px rgba(236, 240, 241, 0.8);
  transition: left 0.1s ease-out;
`, yS = q.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: ${(e) => e.$height}px;
  pointer-events: none;
`, Lh = q.div`
  position: absolute;
  left: ${(e) => e.$position}%;
  top: 0;
  width: 1px;
  height: ${(e) => e.$height}px;
  background: rgba(255, 255, 255, 0.2);
`, vS = ({
  level: e,
  peakLevel: t,
  width: n = 200,
  height: s = 20,
  className: i
}) => {
  const r = Math.max(0, Math.min(1, e)), o = t !== void 0 ? Math.max(0, Math.min(1, t)) : 0;
  return /* @__PURE__ */ k.jsxs(mS, { $width: n, $height: s, className: i, children: [
    /* @__PURE__ */ k.jsx(gS, { $level: r, $height: s }),
    t !== void 0 && o > 0 && /* @__PURE__ */ k.jsx(_S, { $peakLevel: o, $height: s }),
    /* @__PURE__ */ k.jsxs(yS, { $height: s, children: [
      /* @__PURE__ */ k.jsx(Lh, { $position: 60, $height: s }),
      /* @__PURE__ */ k.jsx(Lh, { $position: 85, $height: s })
    ] })
  ] });
};
$t.memo(vS);
function WT(e, t, n, s = {}) {
  const { currentTime: i = 0, audioConstraints: r, ...o } = s, [a, c] = ft(!1), [l, u] = ft(null), {
    stream: h,
    devices: d,
    hasPermission: p,
    requestAccess: f,
    error: _
  } = fS(), { level: m, peakLevel: g } = pS(h), {
    isRecording: b,
    isPaused: v,
    duration: x,
    peaks: y,
    startRecording: w,
    stopRecording: S,
    pauseRecording: C,
    resumeRecording: D,
    error: R
  } = dS(h, o), A = rt(async () => {
    n && (a || (await Mr(), c(!0)), await w());
  }, [n, a, w]), I = rt(async () => {
    const V = await S();
    if (V && n) {
      const W = e.findIndex((H) => H.id === n);
      if (W === -1) return;
      const L = e[W], J = Math.floor(i * V.sampleRate);
      let z = 0;
      if (L.clips.length > 0) {
        const H = L.clips.map(
          (G) => G.startSample + G.durationSamples
        );
        z = Math.max(...H);
      }
      const E = Math.max(J, z), O = {
        id: `clip-${Date.now()}`,
        audioBuffer: V,
        startSample: E,
        durationSamples: V.length,
        offsetSamples: 0,
        gain: 1,
        name: `Recording ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`
      }, Z = e.map((H, G) => G === W ? {
        ...H,
        clips: [...H.clips, O]
      } : H);
      t(Z);
    }
  }, [n, e, t, i, S]);
  Ht(() => {
    p && d.length > 0 && l === null && u(d[0].deviceId);
  }, [p, d.length]);
  const F = rt(async () => {
    await f(void 0, r), await Mr(), c(!0);
  }, [f, r]), N = rt(async (V) => {
    u(V), await f(V, r), await Mr(), c(!0);
  }, [f, r]);
  return {
    // Recording state
    isRecording: b,
    isPaused: v,
    duration: x,
    level: m,
    peakLevel: g,
    error: _ || R,
    // Microphone state
    stream: h,
    devices: d,
    hasPermission: p,
    selectedDevice: l,
    // Recording controls
    startRecording: A,
    stopRecording: I,
    pauseRecording: C,
    resumeRecording: D,
    requestMicAccess: F,
    changeDevice: N,
    // Track state
    recordingPeaks: y
  };
}
const Ho = [
  // === REVERB EFFECTS ===
  {
    id: "reverb",
    name: "Reverb",
    category: "reverb",
    description: "Simple convolution reverb with adjustable decay time",
    parameters: [
      { name: "decay", label: "Decay", type: "number", min: 0.1, max: 10, step: 0.1, default: 1.5, unit: "s" },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 0.5 }
    ]
  },
  {
    id: "freeverb",
    name: "Freeverb",
    category: "reverb",
    description: "Classic Schroeder/Moorer reverb with room size and dampening",
    parameters: [
      { name: "roomSize", label: "Room Size", type: "number", min: 0, max: 1, step: 0.01, default: 0.7 },
      { name: "dampening", label: "Dampening", type: "number", min: 0, max: 1e4, step: 100, default: 3e3, unit: "Hz" },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 0.5 }
    ]
  },
  {
    id: "jcReverb",
    name: "JC Reverb",
    category: "reverb",
    description: "Attempt at Roland JC-120 chorus reverb emulation",
    parameters: [
      { name: "roomSize", label: "Room Size", type: "number", min: 0, max: 1, step: 0.01, default: 0.5 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 0.5 }
    ]
  },
  // === DELAY EFFECTS ===
  {
    id: "feedbackDelay",
    name: "Feedback Delay",
    category: "delay",
    description: "Delay line with feedback for echo effects",
    parameters: [
      { name: "delayTime", label: "Delay Time", type: "number", min: 0, max: 1, step: 0.01, default: 0.25, unit: "s" },
      { name: "feedback", label: "Feedback", type: "number", min: 0, max: 0.95, step: 0.01, default: 0.5 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 0.5 }
    ]
  },
  {
    id: "pingPongDelay",
    name: "Ping Pong Delay",
    category: "delay",
    description: "Stereo delay bouncing between left and right channels",
    parameters: [
      { name: "delayTime", label: "Delay Time", type: "number", min: 0, max: 1, step: 0.01, default: 0.25, unit: "s" },
      { name: "feedback", label: "Feedback", type: "number", min: 0, max: 0.95, step: 0.01, default: 0.5 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 0.5 }
    ]
  },
  // === MODULATION EFFECTS ===
  {
    id: "chorus",
    name: "Chorus",
    category: "modulation",
    description: "Creates thickness by layering detuned copies of the signal",
    parameters: [
      { name: "frequency", label: "Rate", type: "number", min: 0.1, max: 10, step: 0.1, default: 1.5, unit: "Hz" },
      { name: "delayTime", label: "Delay", type: "number", min: 0, max: 20, step: 0.5, default: 3.5, unit: "ms" },
      { name: "depth", label: "Depth", type: "number", min: 0, max: 1, step: 0.01, default: 0.7 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 0.5 }
    ]
  },
  {
    id: "phaser",
    name: "Phaser",
    category: "modulation",
    description: "Classic phaser effect using allpass filters",
    parameters: [
      { name: "frequency", label: "Rate", type: "number", min: 0.1, max: 10, step: 0.1, default: 0.5, unit: "Hz" },
      { name: "octaves", label: "Octaves", type: "number", min: 1, max: 6, step: 1, default: 3 },
      { name: "baseFrequency", label: "Base Freq", type: "number", min: 100, max: 2e3, step: 10, default: 350, unit: "Hz" },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 0.5 }
    ]
  },
  {
    id: "tremolo",
    name: "Tremolo",
    category: "modulation",
    description: "Rhythmic volume modulation",
    parameters: [
      { name: "frequency", label: "Rate", type: "number", min: 0.1, max: 20, step: 0.1, default: 4, unit: "Hz" },
      { name: "depth", label: "Depth", type: "number", min: 0, max: 1, step: 0.01, default: 0.5 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 1 }
    ]
  },
  {
    id: "vibrato",
    name: "Vibrato",
    category: "modulation",
    description: "Pitch modulation effect",
    parameters: [
      { name: "frequency", label: "Rate", type: "number", min: 0.1, max: 20, step: 0.1, default: 5, unit: "Hz" },
      { name: "depth", label: "Depth", type: "number", min: 0, max: 1, step: 0.01, default: 0.1 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 1 }
    ]
  },
  {
    id: "autoPanner",
    name: "Auto Panner",
    category: "modulation",
    description: "Automatic left-right panning",
    parameters: [
      { name: "frequency", label: "Rate", type: "number", min: 0.1, max: 10, step: 0.1, default: 1, unit: "Hz" },
      { name: "depth", label: "Depth", type: "number", min: 0, max: 1, step: 0.01, default: 1 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 1 }
    ]
  },
  // === FILTER EFFECTS ===
  {
    id: "autoFilter",
    name: "Auto Filter",
    category: "filter",
    description: "Automated filter sweep with LFO",
    parameters: [
      { name: "frequency", label: "Rate", type: "number", min: 0.1, max: 10, step: 0.1, default: 1, unit: "Hz" },
      { name: "baseFrequency", label: "Base Freq", type: "number", min: 20, max: 2e3, step: 10, default: 200, unit: "Hz" },
      { name: "octaves", label: "Octaves", type: "number", min: 0.5, max: 8, step: 0.5, default: 2.6 },
      { name: "depth", label: "Depth", type: "number", min: 0, max: 1, step: 0.01, default: 1 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 1 }
    ]
  },
  {
    id: "autoWah",
    name: "Auto Wah",
    category: "filter",
    description: "Envelope follower filter effect",
    parameters: [
      { name: "baseFrequency", label: "Base Freq", type: "number", min: 20, max: 500, step: 10, default: 100, unit: "Hz" },
      { name: "octaves", label: "Octaves", type: "number", min: 1, max: 8, step: 1, default: 6 },
      { name: "sensitivity", label: "Sensitivity", type: "number", min: -40, max: 0, step: 1, default: 0, unit: "dB" },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 1 }
    ]
  },
  {
    id: "eq3",
    name: "3-Band EQ",
    category: "filter",
    description: "Three band equalizer with low, mid, and high controls",
    parameters: [
      { name: "low", label: "Low", type: "number", min: -24, max: 24, step: 0.5, default: 0, unit: "dB" },
      { name: "mid", label: "Mid", type: "number", min: -24, max: 24, step: 0.5, default: 0, unit: "dB" },
      { name: "high", label: "High", type: "number", min: -24, max: 24, step: 0.5, default: 0, unit: "dB" },
      { name: "lowFrequency", label: "Low Freq", type: "number", min: 20, max: 500, step: 10, default: 400, unit: "Hz" },
      { name: "highFrequency", label: "High Freq", type: "number", min: 1e3, max: 1e4, step: 100, default: 2500, unit: "Hz" }
    ]
  },
  // === DISTORTION EFFECTS ===
  {
    id: "distortion",
    name: "Distortion",
    category: "distortion",
    description: "Wave shaping distortion effect",
    parameters: [
      { name: "distortion", label: "Drive", type: "number", min: 0, max: 1, step: 0.01, default: 0.4 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 1 }
    ]
  },
  {
    id: "bitCrusher",
    name: "Bit Crusher",
    category: "distortion",
    description: "Reduces bit depth for lo-fi digital texture",
    parameters: [
      { name: "bits", label: "Bits", type: "number", min: 1, max: 16, step: 1, default: 4 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 1 }
    ]
  },
  {
    id: "chebyshev",
    name: "Chebyshev",
    category: "distortion",
    description: "Waveshaping distortion using Chebyshev polynomials",
    parameters: [
      { name: "order", label: "Order", type: "number", min: 1, max: 100, step: 1, default: 50 },
      { name: "wet", label: "Mix", type: "number", min: 0, max: 1, step: 0.01, default: 1 }
    ]
  },
  // === DYNAMICS EFFECTS ===
  {
    id: "compressor",
    name: "Compressor",
    category: "dynamics",
    description: "Dynamic range compressor",
    parameters: [
      { name: "threshold", label: "Threshold", type: "number", min: -60, max: 0, step: 1, default: -24, unit: "dB" },
      { name: "ratio", label: "Ratio", type: "number", min: 1, max: 20, step: 0.5, default: 4 },
      { name: "attack", label: "Attack", type: "number", min: 0, max: 1, step: 1e-3, default: 3e-3, unit: "s" },
      { name: "release", label: "Release", type: "number", min: 0, max: 1, step: 0.01, default: 0.25, unit: "s" },
      { name: "knee", label: "Knee", type: "number", min: 0, max: 40, step: 1, default: 30, unit: "dB" }
    ]
  },
  {
    id: "limiter",
    name: "Limiter",
    category: "dynamics",
    description: "Hard limiter to prevent clipping",
    parameters: [
      { name: "threshold", label: "Threshold", type: "number", min: -12, max: 0, step: 0.5, default: -6, unit: "dB" }
    ]
  },
  {
    id: "gate",
    name: "Gate",
    category: "dynamics",
    description: "Noise gate to silence signal below threshold",
    parameters: [
      { name: "threshold", label: "Threshold", type: "number", min: -100, max: 0, step: 1, default: -40, unit: "dB" },
      { name: "attack", label: "Attack", type: "number", min: 0, max: 0.3, step: 1e-3, default: 1e-3, unit: "s" },
      { name: "release", label: "Release", type: "number", min: 0, max: 0.5, step: 0.01, default: 0.1, unit: "s" }
    ]
  },
  // === SPATIAL EFFECTS ===
  {
    id: "stereoWidener",
    name: "Stereo Widener",
    category: "spatial",
    description: "Expands or narrows the stereo image",
    parameters: [
      { name: "width", label: "Width", type: "number", min: 0, max: 1, step: 0.01, default: 0.5 }
    ]
  }
], Sp = (e) => Ho.find((t) => t.id === e), jT = (e) => Ho.filter((t) => t.category === e), LT = [
  { id: "reverb", name: "Reverb" },
  { id: "delay", name: "Delay" },
  { id: "modulation", name: "Modulation" },
  { id: "filter", name: "Filter" },
  { id: "distortion", name: "Distortion" },
  { id: "dynamics", name: "Dynamics" },
  { id: "spatial", name: "Spatial" }
], bS = {
  reverb: cr,
  freeverb: Io,
  jcReverb: Eo,
  feedbackDelay: ko,
  pingPongDelay: Do,
  chorus: To,
  phaser: Ro,
  tremolo: Mo,
  vibrato: Fo,
  autoPanner: wo,
  autoFilter: xo,
  autoWah: ar,
  eq3: Wo,
  distortion: Ao,
  bitCrusher: Co,
  chebyshev: So,
  compressor: yn,
  limiter: Vo,
  gate: No,
  stereoWidener: Oo
};
let xS = 0;
const wS = () => `effect_${Date.now()}_${++xS}`;
function no(e, t) {
  const n = bS[e.id];
  if (!n)
    throw new Error(`Unknown effect type: ${e.id}`);
  const s = {};
  e.parameters.forEach((o) => {
    const a = t?.[o.name] ?? o.default;
    s[o.name] = a;
  });
  const i = new n(s), r = wS();
  return {
    effect: i,
    id: e.id,
    instanceId: r,
    dispose() {
      try {
        i.disconnect(), i.dispose();
      } catch {
      }
    },
    setParameter(o, a) {
      o === "wet" && i.wet ? i.wet.value = a : i[o] !== void 0 && (i[o]?.value !== void 0 ? i[o].value = a : i[o] = a);
    },
    getParameter(o) {
      if (o === "wet" && i.wet)
        return i.wet.value;
      if (i[o] !== void 0)
        return i[o]?.value !== void 0 ? i[o].value : i[o];
    },
    connect(o) {
      i.connect(o);
    },
    disconnect() {
      try {
        i.disconnect();
      } catch {
      }
    }
  };
}
function BT(e) {
  if (e.length === 0)
    throw new Error("Cannot create effect chain with no effects");
  for (let t = 0; t < e.length - 1; t++)
    e[t].effect.connect(e[t + 1].effect);
  return {
    input: e[0].effect,
    output: e[e.length - 1].effect,
    dispose() {
      e.forEach((t) => t.dispose());
    }
  };
}
function $T(e = 256) {
  const [t, n] = ft([]), s = xt(t);
  s.current = t;
  const i = xt(/* @__PURE__ */ new Map()), r = xt(null), o = xt(null), a = rt((m) => {
    const g = o.current;
    if (!g) return;
    const { masterGainNode: b, destination: v, analyserNode: x } = g;
    try {
      b.disconnect();
    } catch {
    }
    const y = m.map((w) => i.current.get(w.instanceId)).filter((w) => w !== void 0);
    if (y.length === 0)
      b.connect(x), x.connect(v);
    else {
      let w = b;
      y.forEach((S) => {
        try {
          S.disconnect();
        } catch {
        }
        w.connect(S.effect), w = S.effect;
      }), w.connect(x), x.connect(v);
    }
  }, []), c = rt((m) => {
    const g = Sp(m);
    if (!g) {
      console.error(`Unknown effect: ${m}`);
      return;
    }
    const b = {};
    g.parameters.forEach((y) => {
      b[y.name] = y.default;
    });
    const v = no(g, b);
    i.current.set(v.instanceId, v);
    const x = {
      instanceId: v.instanceId,
      effectId: g.id,
      definition: g,
      params: b,
      bypassed: !1
    };
    n((y) => [...y, x]);
  }, []), l = rt((m) => {
    const g = i.current.get(m);
    g && (g.dispose(), i.current.delete(m)), n((b) => b.filter((v) => v.instanceId !== m));
  }, []), u = rt(
    (m, g, b) => {
      const v = i.current.get(m);
      v && v.setParameter(g, b), n(
        (x) => x.map(
          (y) => y.instanceId === m ? { ...y, params: { ...y.params, [g]: b } } : y
        )
      );
    },
    []
  ), h = rt(
    (m) => {
      const g = s.current.find((x) => x.instanceId === m);
      if (!g) return;
      const b = !g.bypassed, v = i.current.get(m);
      if (v) {
        const x = g.params.wet ?? 1;
        v.setParameter("wet", b ? 0 : x);
      }
      n(
        (x) => x.map(
          (y) => y.instanceId === m ? { ...y, bypassed: b } : y
        )
      );
    },
    []
  ), d = rt((m, g) => {
    n((b) => {
      const v = [...b], [x] = v.splice(m, 1);
      return v.splice(g, 0, x), v;
    });
  }, []), p = rt(() => {
    i.current.forEach((m) => m.dispose()), i.current.clear(), n([]);
  }, []);
  Ht(() => {
    a(t);
  }, [t, a]);
  const f = rt(
    (m, g, b) => {
      const v = new os("fft", e);
      r.current = v, o.current = {
        masterGainNode: m,
        destination: g,
        analyserNode: v
      };
      const y = s.current.map((w) => i.current.get(w.instanceId)).filter((w) => w !== void 0);
      if (y.length === 0)
        m.connect(v), v.connect(g);
      else {
        let w = m;
        y.forEach((S) => {
          w.connect(S.effect), w = S.effect;
        }), w.connect(v), v.connect(g);
      }
      return function() {
        v.dispose(), r.current = null, o.current = null;
      };
    },
    [e]
    // Only fftSize - reads effects from ref
  );
  Ht(() => () => {
    i.current.forEach((m) => m.dispose()), i.current.clear();
  }, []);
  const _ = rt(() => {
    const m = t.filter((g) => !g.bypassed);
    if (m.length !== 0)
      return (g, b, v) => {
        const x = [];
        for (const y of m) {
          const w = no(y.definition, y.params);
          x.push(w);
        }
        if (x.length === 0)
          g.connect(b);
        else {
          let y = g;
          x.forEach((w) => {
            y.connect(w.effect), y = w.effect;
          }), y.connect(b);
        }
        return function() {
          x.forEach((w) => w.dispose());
        };
      };
  }, [t]);
  return {
    activeEffects: t,
    availableEffects: Ho,
    addEffect: c,
    removeEffect: l,
    updateParameter: u,
    toggleBypass: h,
    reorderEffects: d,
    clearAllEffects: p,
    masterEffects: f,
    createOfflineEffectsFunction: _,
    analyserRef: r
  };
}
function qT() {
  const [e, t] = ft(
    /* @__PURE__ */ new Map()
  ), n = xt(/* @__PURE__ */ new Map()), s = xt(/* @__PURE__ */ new Map()), i = rt((p, f) => {
    const _ = s.current.get(p);
    if (!_) return;
    const { graphEnd: m, masterGainNode: g } = _, b = n.current.get(p);
    try {
      m.disconnect();
    } catch {
    }
    const v = f.map((x) => b?.get(x.instanceId)).filter((x) => x !== void 0);
    if (v.length === 0)
      m.connect(g);
    else {
      let x = m;
      v.forEach((y) => {
        try {
          y.disconnect();
        } catch {
        }
        x.connect(y.effect), x = y.effect;
      }), x.connect(g);
    }
  }, []), r = rt((p, f) => {
    const _ = Sp(f);
    if (!_) {
      console.error(`Unknown effect: ${f}`);
      return;
    }
    const m = {};
    _.parameters.forEach((v) => {
      m[v.name] = v.default;
    });
    const g = no(_, m);
    n.current.has(p) || n.current.set(p, /* @__PURE__ */ new Map()), n.current.get(p).set(g.instanceId, g);
    const b = {
      instanceId: g.instanceId,
      effectId: _.id,
      definition: _,
      params: m,
      bypassed: !1
    };
    t((v) => {
      const x = new Map(v), y = x.get(p) || [];
      return x.set(p, [...y, b]), x;
    });
  }, []), o = rt((p, f) => {
    const _ = n.current.get(p), m = _?.get(f);
    m && (m.dispose(), _?.delete(f)), t((g) => {
      const b = new Map(g), v = b.get(p) || [];
      return b.set(p, v.filter((x) => x.instanceId !== f)), b;
    });
  }, []), a = rt(
    (p, f, _, m) => {
      const b = n.current.get(p)?.get(f);
      b && b.setParameter(_, m), t((v) => {
        const x = new Map(v), y = x.get(p) || [];
        return x.set(
          p,
          y.map(
            (w) => w.instanceId === f ? { ...w, params: { ...w.params, [_]: m } } : w
          )
        ), x;
      });
    },
    []
  ), c = rt(
    (p, f) => {
      const m = (u.current.get(p) || []).find((x) => x.instanceId === f);
      if (!m) return;
      const g = !m.bypassed, v = n.current.get(p)?.get(f);
      if (v) {
        const x = m.params.wet ?? 1;
        v.setParameter("wet", g ? 0 : x);
      }
      t((x) => {
        const y = new Map(x), w = y.get(p) || [];
        return y.set(
          p,
          w.map(
            (S) => S.instanceId === f ? { ...S, bypassed: g } : S
          )
        ), y;
      });
    },
    []
  ), l = rt((p) => {
    const f = n.current.get(p);
    f && (f.forEach((_) => _.dispose()), f.clear()), t((_) => {
      const m = new Map(_);
      return m.set(p, []), m;
    });
  }, []), u = xt(e);
  u.current = e;
  const h = rt(
    (p) => (f, _, m) => {
      s.current.set(p, {
        graphEnd: f,
        masterGainNode: _
      });
      const g = u.current.get(p) || [], b = n.current.get(p), v = g.map((x) => b?.get(x.instanceId)).filter((x) => x !== void 0);
      if (v.length === 0)
        f.connect(_);
      else {
        let x = f;
        v.forEach((y) => {
          x.connect(y.effect), x = y.effect;
        }), x.connect(_);
      }
      return function() {
        s.current.delete(p);
      };
    },
    []
    // No dependencies - stable function that reads from refs
  );
  Ht(() => {
    e.forEach((p, f) => {
      i(f, p);
    });
  }, [e, i]), Ht(() => () => {
    n.current.forEach((p) => {
      p.forEach((f) => f.dispose()), p.clear();
    }), n.current.clear();
  }, []);
  const d = rt(
    (p) => {
      const _ = (e.get(p) || []).filter((m) => !m.bypassed);
      if (_.length !== 0)
        return (m, g, b) => {
          const v = [];
          for (const x of _) {
            const y = no(x.definition, x.params);
            v.push(y);
          }
          if (v.length === 0)
            m.connect(g);
          else {
            let x = m;
            v.forEach((y) => {
              x.connect(y.effect), x = y.effect;
            }), x.connect(g);
          }
          return function() {
            v.forEach((y) => y.dispose());
          };
        };
    },
    [e]
  );
  return {
    trackEffectsState: e,
    addEffectToTrack: r,
    removeEffectFromTrack: o,
    updateTrackEffectParameter: a,
    toggleBypass: c,
    clearTrackEffects: l,
    getTrackEffectsFunction: h,
    createOfflineTrackEffectsFunction: d,
    availableEffects: Ho
  };
}
function CS(e, t = {}) {
  const { bitDepth: n = 16 } = t, s = e.numberOfChannels, i = e.sampleRate, r = e.length, o = n / 8, a = s * o, c = i * a, l = r * a, u = 44, h = u + l, d = new ArrayBuffer(h), p = new DataView(d);
  Dr(p, 0, "RIFF"), p.setUint32(4, h - 8, !0), Dr(p, 8, "WAVE"), Dr(p, 12, "fmt "), p.setUint32(16, 16, !0), p.setUint16(20, n === 32 ? 3 : 1, !0), p.setUint16(22, s, !0), p.setUint32(24, i, !0), p.setUint32(28, c, !0), p.setUint16(32, a, !0), p.setUint16(34, n, !0), Dr(p, 36, "data"), p.setUint32(40, l, !0);
  const f = [];
  for (let m = 0; m < s; m++)
    f.push(e.getChannelData(m));
  let _ = u;
  if (n === 16)
    for (let m = 0; m < r; m++)
      for (let g = 0; g < s; g++) {
        const b = f[g][m], v = Math.max(-1, Math.min(1, b)), x = v < 0 ? v * 32768 : v * 32767;
        p.setInt16(_, x, !0), _ += 2;
      }
  else
    for (let m = 0; m < r; m++)
      for (let g = 0; g < s; g++)
        p.setFloat32(_, f[g][m], !0), _ += 4;
  return new Blob([d], { type: "audio/wav" });
}
function Dr(e, t, n) {
  for (let s = 0; s < n.length; s++)
    e.setUint8(t + s, n.charCodeAt(s));
}
function SS(e, t) {
  const n = URL.createObjectURL(e), s = document.createElement("a");
  s.href = n, s.download = t, s.style.display = "none", document.body.appendChild(s), s.click(), document.body.removeChild(s), URL.revokeObjectURL(n);
}
function TS() {
  const [e, t] = ft(!1), [n, s] = ft(0), [i, r] = ft(null);
  return {
    exportWav: rt(async (a, c, l = {}) => {
      const {
        filename: u = "export",
        mode: h = "master",
        trackIndex: d,
        autoDownload: p = !0,
        applyEffects: f = !0,
        effectsFunction: _,
        createOfflineTrackEffects: m,
        bitDepth: g = 16,
        onProgress: b
      } = l;
      t(!0), s(0), r(null);
      try {
        if (a.length === 0)
          throw new Error("No tracks to export");
        if (h === "individual" && (d === void 0 || d < 0 || d >= a.length))
          throw new Error("Invalid track index for individual export");
        const v = a[0].clips[0]?.audioBuffer.sampleRate || 44100;
        let x = 0;
        for (const A of a)
          for (const I of A.clips) {
            const F = I.startSample + I.durationSamples;
            x = Math.max(x, F);
          }
        x += Math.round(v * 0.1);
        const y = x / v, w = h === "individual" ? [{ track: a[d], state: c[d], index: d }] : a.map((A, I) => ({ track: A, state: c[I], index: I })), S = c.some((A) => A.soloed), C = !!m;
        let D;
        if ((_ || C) && f)
          D = await AS(
            w,
            c,
            S,
            y,
            v,
            _,
            m,
            (A) => {
              s(A), b?.(A);
            }
          );
        else {
          const A = new OfflineAudioContext(2, x, v);
          let I = 0;
          const F = w.reduce((N, { track: V }) => N + V.clips.length, 0);
          for (const { track: N, state: V } of w)
            if (!(V.muted && !V.soloed) && !(S && !V.soloed))
              for (const W of N.clips) {
                await IS(A, W, V, v, f), I++;
                const L = I / F * 0.5;
                s(L), b?.(L);
              }
          s(0.5), b?.(0.5), D = await A.startRendering();
        }
        s(0.9), b?.(0.9);
        const R = CS(D, { bitDepth: g });
        if (s(1), b?.(1), p) {
          const A = h === "individual" ? `${u}_${a[d].name}` : u;
          SS(R, `${A}.wav`);
        }
        return {
          audioBuffer: D,
          blob: R,
          duration: y
        };
      } catch (v) {
        const x = v instanceof Error ? v.message : "Export failed";
        throw r(x), v;
      } finally {
        t(!1);
      }
    }, []),
    isExporting: e,
    progress: n,
    error: i
  };
}
async function AS(e, t, n, s, i, r, o, a) {
  const { Offline: c, Volume: l, Gain: u, Panner: h, Player: d, ToneAudioBuffer: p } = await Promise.resolve().then(() => nf);
  a(0.1);
  let f;
  try {
    f = await c(
      async ({ transport: _, destination: m }) => {
        const g = new l(0);
        let b;
        r ? b = r(g, m, !0) : g.connect(m);
        for (const { track: v, state: x } of e) {
          if (x.muted && !x.soloed || n && !x.soloed) continue;
          const y = new l(kS(x.volume)), w = new h(x.pan), S = new u(x.muted ? 0 : 1), C = o?.(v.id);
          C ? C(S, g, !0) : S.connect(g), w.connect(S), y.connect(w);
          for (const D of v.clips) {
            const { audioBuffer: R, startSample: A, durationSamples: I, offsetSamples: F, gain: N, fadeIn: V, fadeOut: W } = D, L = A / i, J = I / i, z = F / i, E = new p(R), O = new d(E), Z = new u(N);
            if (O.connect(Z), Z.connect(y), V) {
              const H = L + V.start, G = L + V.end, X = Z.gain._param;
              X.setValueAtTime(0, H), X.linearRampToValueAtTime(N, G);
            }
            if (W) {
              const H = L + W.start, G = L + W.end, X = Z.gain._param;
              X.setValueAtTime(N, H), X.linearRampToValueAtTime(0, G);
            }
            O.start(L, z, J);
          }
        }
        _.start(0);
      },
      s,
      2,
      // stereo
      i
    );
  } catch (_) {
    throw _ instanceof Error ? _ : new Error(`Tone.Offline rendering failed: ${String(_)}`);
  }
  return a(0.9), f.get();
}
function kS(e) {
  return 20 * Math.log10(Math.max(e, 1e-4));
}
async function IS(e, t, n, s, i) {
  const { audioBuffer: r, startSample: o, durationSamples: a, offsetSamples: c, gain: l, fadeIn: u, fadeOut: h } = t, d = o / s, p = a / s, f = c / s, _ = e.createBufferSource();
  _.buffer = r;
  const m = e.createGain(), g = l * n.volume, b = e.createStereoPanner();
  if (b.pan.value = n.pan, _.connect(m), m.connect(b), b.connect(e.destination), i) {
    if (u && u.start === 0 ? m.gain.setValueAtTime(0, d) : m.gain.setValueAtTime(g, d), u) {
      const v = d + u.start, x = d + u.end;
      Bh(m.gain, v, x, 0, g, u.type);
    }
    if (h) {
      const v = d + h.start, x = d + h.end;
      (!u || u.end < h.start) && m.gain.setValueAtTime(g, v), Bh(m.gain, v, x, g, 0, h.type);
    }
  } else
    m.gain.setValueAtTime(g, d);
  _.start(d, f, p);
}
function Bh(e, t, n, s, i, r) {
  const o = n - t;
  if (!(o <= 0))
    switch (r) {
      case "linear":
        e.setValueAtTime(s, t), e.linearRampToValueAtTime(i, n);
        break;
      case "exponential":
        const a = Math.max(s, 1e-4), c = Math.max(i, 1e-4);
        e.setValueAtTime(a, t), e.exponentialRampToValueAtTime(c, n), i === 0 && e.setValueAtTime(0, n);
        break;
      case "logarithmic":
        const l = $h(s, i, 256, "logarithmic");
        e.setValueCurveAtTime(l, t, o);
        break;
      case "sCurve":
        const u = $h(s, i, 256, "sCurve");
        e.setValueCurveAtTime(u, t, o);
        break;
      default:
        e.setValueAtTime(s, t), e.linearRampToValueAtTime(i, n);
    }
}
function $h(e, t, n, s) {
  const i = new Float32Array(n), r = t - e;
  for (let o = 0; o < n; o++) {
    const a = o / (n - 1);
    let c;
    s === "logarithmic" ? r > 0 ? c = Math.log10(1 + a * 9) / Math.log10(10) : c = 1 - Math.log10(1 + (1 - a) * 9) / Math.log10(10) : c = a * a * (3 - 2 * a), i[o] = e + r * c;
  }
  return i;
}
const Tp = Se(null), Ap = Se(null), kp = Se(null), Ip = Se(null), Ep = Se(null), zT = ({
  tracks: e,
  timescale: t = !1,
  mono: n = !1,
  waveHeight: s = 80,
  samplesPerPixel: i = 1024,
  zoomLevels: r,
  automaticScroll: o = !1,
  theme: a,
  controls: c = { show: !1, width: 0 },
  annotationList: l,
  effects: u,
  onReady: h,
  onAnnotationUpdate: d,
  children: p
}) => {
  const [f, _] = ft([]), [m, g] = ft(null), [b, v] = ft(!1), [x, y] = ft(0), [w, S] = ft(0), [C, D] = ft([]), [R, A] = ft([]), [I, F] = ft([]), [N, V] = ft(0), [W, L] = ft(0), [J, z] = ft(null), [E, O] = ft(o), [Z, H] = ft(l?.isContinuousPlay ?? !1), [G, X] = ft(l?.linkEndpoints ?? !0), [Q, it] = ft(l?.editable ?? !1), M = xt(null), ht = xt(0), tt = xt(0), Tt = xt(null), U = xt(0), Jt = xt(0), fe = xt(null), Y = xt(null), ot = xt(!1), Vt = xt(l?.isContinuousPlay ?? !1), Et = xt(null), wt = xt(i), { timeFormat: et, setTimeFormat: mt, formatTime: At } = eS(), Lt = sS({ initialSamplesPerPixel: i, zoomLevels: r }), Gt = Lt.samplesPerPixel, { masterVolume: be, setMasterVolume: Wt } = iS({ playoutRef: M, initialVolume: 1 }), Xe = rt((lt) => {
    Vt.current = lt, H(lt);
  }, []), xe = rt((lt) => {
    Et.current = lt, g(lt);
  }, []);
  Ht(() => {
    ot.current = E;
  }, [E]), Ht(() => {
    if (!Y.current || !C.length) return;
    const lt = Y.current, _t = wt.current, yt = Gt;
    if (_t === yt) return;
    const Mt = c.show ? c.width : 0, ut = lt.clientWidth, Ue = lt.scrollLeft + ut / 2 - Mt, T = C[0].sampleRate, K = Ue * _t / T * T / yt, pt = Math.max(0, K + Mt - ut / 2);
    lt.scrollLeft = pt, wt.current = yt;
  }, [Gt, C, c]), Ht(() => e.length === 0 ? void 0 : ((async () => {
    try {
      const _t = [];
      e.forEach((ut) => {
        ut.clips.length > 0 && _t.push(ut.clips[0].audioBuffer);
      });
      let yt = 0;
      e.forEach((ut) => {
        ut.clips.forEach((ke) => {
          const Ue = ke.audioBuffer.sampleRate, j = (ke.startSample + ke.durationSamples) / Ue;
          yt = Math.max(yt, j);
        });
      }), D(_t), S(yt), F(e.map((ut) => ({
        name: ut.name,
        muted: ut.muted,
        soloed: ut.soloed,
        volume: ut.volume,
        pan: ut.pan
      })));
      const Mt = new sf({
        effects: u
      });
      e.forEach((ut, ke) => {
        if (ut.clips.length > 0) {
          const Ue = ut.clips[0].audioBuffer.sampleRate, T = Math.min(...ut.clips.map((vt) => vt.startSample / Ue)), j = Math.max(...ut.clips.map((vt) => (vt.startSample + vt.durationSamples) / Ue)), K = {
            id: `track-${ke}`,
            // Use consistent index-based ID for track controls
            name: ut.name,
            gain: ut.volume,
            // Use track-level volume
            muted: ut.muted,
            soloed: ut.soloed,
            stereoPan: ut.pan,
            startTime: T,
            endTime: j
          }, pt = ut.clips.map((vt) => {
            const Ot = vt.audioBuffer.sampleRate;
            return {
              buffer: vt.audioBuffer,
              startTime: vt.startSample / Ot - T,
              // Make relative to track start
              duration: vt.durationSamples / Ot,
              offset: vt.offsetSamples / Ot,
              fadeIn: vt.fadeIn,
              fadeOut: vt.fadeOut,
              gain: vt.gain
            };
          });
          Mt.addTrack({
            clips: pt,
            track: K,
            effects: ut.effects
            // Pass track effects
          });
        }
      }), M.current = Mt, h?.();
    } catch (_t) {
      console.error("Error loading audio:", _t);
    }
  })(), () => {
    Tt.current && cancelAnimationFrame(Tt.current), M.current && M.current.dispose();
  }), [e, h]), Ht(() => {
    if (e.length === 0) return;
    const lt = 16, _t = e.map((yt) => yt.clips.map((ut) => {
      const ke = ut.audioBuffer.sampleRate, Ue = mc(
        ut.audioBuffer,
        Gt,
        n,
        lt,
        ut.offsetSamples / ke,
        // Time offset into the audio file (in seconds)
        ut.durationSamples / ke
        // Duration of the clip (in seconds)
      );
      return {
        clipId: ut.id,
        trackName: yt.name,
        peaks: Ue,
        startSample: ut.startSample,
        durationSamples: ut.durationSamples
      };
    }));
    A(_t);
  }, [e, Gt, n]), Ht(() => {
    if (l?.annotations) {
      const lt = l.annotations.map((_t) => typeof _t.start == "number" ? _t : DC(_t));
      _(lt);
    }
  }, [l]);
  const Ae = rt(() => {
    const lt = () => {
      const _t = It().currentTime - U.current, yt = Jt.current + _t;
      if (tt.current = yt, y(yt), f.length > 0) {
        const Mt = f.find(
          (ut) => yt >= ut.start && yt < ut.end
        );
        if (Vt.current) {
          if (Mt && Mt.id !== Et.current)
            xe(Mt.id);
          else if (!Mt && Et.current !== null) {
            const ut = f[f.length - 1];
            if (yt >= ut.end) {
              M.current && M.current.stop(), v(!1), tt.current = ht.current, y(ht.current), xe(null);
              return;
            }
          }
        } else if (Et.current) {
          const ut = f.find((ke) => ke.id === Et.current);
          if (ut && yt >= ut.end) {
            M.current && M.current.stop(), v(!1), tt.current = ht.current, y(ht.current);
            return;
          }
        } else
          Mt && xe(Mt.id);
      }
      if (ot.current && Y.current && C.length > 0) {
        const Mt = Y.current, ut = C[0].sampleRate, ke = yt * ut / wt.current, Ue = Mt.clientWidth, T = c.show ? c.width : 0, j = ke + T, K = Math.max(0, j - Ue / 2);
        Mt.scrollLeft = K;
      }
      if (fe.current !== null && yt >= fe.current) {
        M.current && M.current.stop(), v(!1), tt.current = fe.current, y(fe.current), fe.current = null;
        return;
      }
      if (yt >= w) {
        M.current && M.current.stop(), v(!1), tt.current = ht.current, y(ht.current), xe(null);
        return;
      }
      Tt.current = requestAnimationFrame(lt);
    };
    Tt.current = requestAnimationFrame(lt);
  }, [w, C, Gt, f, Z]), te = rt(() => {
    Tt.current && (cancelAnimationFrame(Tt.current), Tt.current = null);
  }, []);
  Ht(() => {
    (async () => {
      if (b && Tt.current && M.current)
        if (Z) {
          const _t = tt.current;
          M.current.stop(), te(), await M.current.init(), M.current.setOnPlaybackComplete(() => {
          });
          const Mt = It().currentTime;
          U.current = Mt, Jt.current = _t, M.current.play(Mt, _t), Ae();
        } else
          te(), Ae();
    })();
  }, [Z, b, Ae, te]);
  const fn = rt(async (lt, _t) => {
    if (!M.current || C.length === 0) return;
    await M.current.init(), await Bc();
    const yt = lt ?? tt.current;
    ht.current = yt, M.current.setOnPlaybackComplete(() => {
    }), M.current.stop(), te();
    const ut = It().currentTime;
    U.current = ut, Jt.current = yt, fe.current = _t !== void 0 ? yt + _t : null, M.current.play(ut, yt, _t), v(!0), Ae();
  }, [C.length, Ae, te]), as = rt(() => {
    if (!M.current) return;
    const lt = It().currentTime - U.current, _t = Jt.current + lt;
    M.current.pause(), v(!1), te(), tt.current = _t, y(_t);
  }, [te]), mi = rt(() => {
    M.current && (M.current.stop(), v(!1), te(), tt.current = ht.current, y(ht.current), xe(null));
  }, [te]), Qo = rt((lt) => {
    const _t = Math.max(0, Math.min(lt, w));
    tt.current = _t, y(_t), b && M.current && (M.current.stop(), te(), fn(_t));
  }, [w, b, fn, te]), Jo = rt((lt, _t) => {
    const yt = [...I];
    if (yt[lt] = { ...yt[lt], muted: _t }, F(yt), M.current) {
      const Mt = `track-${lt}`;
      M.current.setMute(Mt, _t);
    }
  }, [I]), ta = rt((lt, _t) => {
    const yt = [...I];
    if (yt[lt] = { ...yt[lt], soloed: _t }, F(yt), M.current) {
      const Mt = `track-${lt}`;
      M.current.setSolo(Mt, _t);
    }
  }, [I]), ea = rt((lt, _t) => {
    const yt = [...I];
    if (yt[lt] = { ...yt[lt], volume: _t }, F(yt), M.current) {
      const Mt = `track-${lt}`, ut = M.current.getTrack(Mt);
      ut && ut.setVolume(_t);
    }
  }, [I]), gi = rt((lt, _t) => {
    const yt = [...I];
    if (yt[lt] = { ...yt[lt], pan: _t }, F(yt), M.current) {
      const Mt = `track-${lt}`, ut = M.current.getTrack(Mt);
      ut && ut.setPan(_t);
    }
  }, [I]), mr = rt((lt, _t) => {
    V(lt), L(_t), tt.current = lt, y(lt), b && M.current && (M.current.stop(), M.current.play(It().currentTime, lt));
  }, [b]), Ln = rt((lt) => {
    Y.current = lt;
  }, []), _i = C[0]?.sampleRate || 44100, Is = t ? 30 : 0, gr = e.length * s + Is, _r = {
    isPlaying: b,
    currentTime: x,
    currentTimeRef: tt
  }, yi = {
    continuousPlay: Z,
    linkEndpoints: G,
    annotationsEditable: Q,
    isAutomaticScroll: E,
    annotations: f,
    activeAnnotationId: m,
    selectionStart: N,
    selectionEnd: W,
    selectedTrackId: J
  }, yr = {
    // Playback controls
    play: fn,
    pause: as,
    stop: mi,
    seekTo: Qo,
    setCurrentTime: (lt) => {
      tt.current = lt, y(lt);
    },
    // Track controls
    setTrackMute: Jo,
    setTrackSolo: ta,
    setTrackVolume: ea,
    setTrackPan: gi,
    // Selection
    setSelection: mr,
    setSelectedTrackId: z,
    // Time format
    setTimeFormat: mt,
    formatTime: At,
    // Zoom
    zoomIn: Lt.zoomIn,
    zoomOut: Lt.zoomOut,
    // Master volume
    setMasterVolume: Wt,
    // Automatic scroll
    setAutomaticScroll: (lt) => {
      O(lt);
    },
    setScrollContainer: Ln,
    scrollContainerRef: Y,
    // Annotation controls
    setContinuousPlay: Xe,
    setLinkEndpoints: X,
    setAnnotationsEditable: it,
    setAnnotations: _,
    setActiveAnnotationId: xe
  }, vi = {
    duration: w,
    audioBuffers: C,
    peaksDataArray: R,
    trackStates: I,
    tracks: e,
    sampleRate: _i,
    waveHeight: s,
    timeScaleHeight: Is,
    minimumPlaylistHeight: gr,
    controls: c,
    playoutRef: M,
    samplesPerPixel: Gt,
    timeFormat: et,
    masterVolume: be,
    canZoomIn: Lt.canZoomIn,
    canZoomOut: Lt.canZoomOut
  }, vr = {
    ..._r,
    ...yi,
    ...yr,
    ...vi
  }, na = { ...wC, ...a };
  return /* @__PURE__ */ k.jsx(Gh, { theme: na, children: /* @__PURE__ */ k.jsx(Tp.Provider, { value: _r, children: /* @__PURE__ */ k.jsx(Ap.Provider, { value: yi, children: /* @__PURE__ */ k.jsx(kp.Provider, { value: yr, children: /* @__PURE__ */ k.jsx(Ip.Provider, { value: vi, children: /* @__PURE__ */ k.jsx(Ep.Provider, { value: vr, children: p }) }) }) }) }) });
}, Cn = () => {
  const e = we(Tp);
  if (!e)
    throw new Error("usePlaybackAnimation must be used within WaveformPlaylistProvider");
  return e;
}, jn = () => {
  const e = we(Ap);
  if (!e)
    throw new Error("usePlaylistState must be used within WaveformPlaylistProvider");
  return e;
}, de = () => {
  const e = we(kp);
  if (!e)
    throw new Error("usePlaylistControls must be used within WaveformPlaylistProvider");
  return e;
}, Sn = () => {
  const e = we(Ip);
  if (!e)
    throw new Error("usePlaylistData must be used within WaveformPlaylistProvider");
  return e;
}, GT = () => {
  const e = we(Ep);
  if (!e)
    throw new Error("useWaveformPlaylist must be used within WaveformPlaylistProvider");
  return e;
}, ZT = ({ className: e }) => {
  const { isPlaying: t, currentTimeRef: n } = Cn(), { selectionStart: s, selectionEnd: i } = jn(), { play: r } = de(), o = async () => {
    if (s !== i && i > s) {
      const a = i - s;
      await r(s, a);
    } else
      await r(n.current ?? 0);
  };
  return /* @__PURE__ */ k.jsx(dn, { onClick: o, disabled: t, className: e, children: "Play" });
}, YT = ({ className: e }) => {
  const { isPlaying: t } = Cn(), { pause: n } = de();
  return /* @__PURE__ */ k.jsx(dn, { onClick: n, disabled: !t, className: e, children: "Pause" });
}, XT = ({ className: e }) => {
  const { isPlaying: t } = Cn(), { stop: n } = de();
  return /* @__PURE__ */ k.jsx(dn, { onClick: n, disabled: !t, className: e, children: "Stop" });
}, UT = ({ className: e }) => {
  const { isPlaying: t } = Cn(), { play: n, setCurrentTime: s } = de(), { playoutRef: i } = Sn(), r = () => {
    s(0), t && i.current && (i.current.stop(), n(0));
  };
  return /* @__PURE__ */ k.jsx(dn, { onClick: r, className: e, children: "Rewind" });
}, HT = ({ className: e }) => {
  const { isPlaying: t } = Cn(), { play: n, setCurrentTime: s } = de(), { duration: i, playoutRef: r } = Sn(), o = () => {
    s(i), t && r.current && (r.current.stop(), n(i));
  };
  return /* @__PURE__ */ k.jsx(dn, { onClick: o, className: e, children: "Fast Forward" });
}, KT = ({
  skipAmount: e = 5,
  className: t
}) => {
  const { currentTimeRef: n, isPlaying: s } = Cn(), { play: i, setCurrentTime: r } = de(), { playoutRef: o } = Sn(), a = () => {
    const c = Math.max(0, (n.current ?? 0) - e);
    r(c), s && o.current && (o.current.stop(), i(c));
  };
  return /* @__PURE__ */ k.jsx(dn, { onClick: a, className: t, children: "Skip Backward" });
}, QT = ({
  skipAmount: e = 5,
  className: t
}) => {
  const { currentTimeRef: n, isPlaying: s } = Cn(), { play: i, setCurrentTime: r } = de(), { duration: o, playoutRef: a } = Sn(), c = () => {
    const l = Math.min(o, (n.current ?? 0) + e);
    r(l), s && a.current && (a.current.stop(), i(l));
  };
  return /* @__PURE__ */ k.jsx(dn, { onClick: c, className: t, children: "Skip Forward" });
}, JT = ({ className: e, disabled: t }) => {
  const { zoomIn: n } = de(), { canZoomIn: s } = Sn();
  return /* @__PURE__ */ k.jsx(dn, { variant: "success", onClick: n, disabled: t || !s, className: e, children: "Zoom In" });
}, tA = ({ className: e, disabled: t }) => {
  const { zoomOut: n } = de(), { canZoomOut: s } = Sn();
  return /* @__PURE__ */ k.jsx(dn, { variant: "success", onClick: n, disabled: t || !s, className: e, children: "Zoom Out" });
}, eA = ({ className: e }) => {
  const { masterVolume: t } = Sn(), { setMasterVolume: n } = de();
  return /* @__PURE__ */ k.jsx(
    X1,
    {
      volume: t,
      onChange: n,
      className: e
    }
  );
}, nA = ({ className: e }) => {
  const { timeFormat: t } = Sn(), { setTimeFormat: n } = de();
  return /* @__PURE__ */ k.jsx(
    gC,
    {
      value: t,
      onChange: n,
      className: e
    }
  );
}, sA = ({ className: e }) => {
  const { currentTime: t } = Cn(), { formatTime: n } = de();
  return /* @__PURE__ */ k.jsx(
    O1,
    {
      formattedTime: n(t),
      className: e
    }
  );
}, iA = ({ className: e }) => {
  const { selectionStart: t, selectionEnd: n } = jn(), { setSelection: s } = de();
  return /* @__PURE__ */ k.jsx(
    sC,
    {
      selectionStart: t,
      selectionEnd: n,
      onSelectionChange: s,
      className: e
    }
  );
}, rA = ({ className: e }) => {
  const { isAutomaticScroll: t } = jn(), { setAutomaticScroll: n } = de();
  return /* @__PURE__ */ k.jsx(
    F1,
    {
      checked: t,
      onChange: n,
      className: e
    }
  );
}, oA = ({ className: e }) => {
  const { continuousPlay: t } = jn(), { setContinuousPlay: n } = de();
  return /* @__PURE__ */ k.jsx(
    XC,
    {
      checked: t,
      onChange: n,
      className: e
    }
  );
}, aA = ({ className: e }) => {
  const { linkEndpoints: t } = jn(), { setLinkEndpoints: n } = de();
  return /* @__PURE__ */ k.jsx(
    UC,
    {
      checked: t,
      onChange: n,
      className: e
    }
  );
}, cA = ({ className: e }) => {
  const { annotationsEditable: t } = jn(), { setAnnotationsEditable: n } = de();
  return /* @__PURE__ */ k.jsx(
    HC,
    {
      checked: t,
      onChange: n,
      className: e
    }
  );
}, lA = ({
  filename: e,
  className: t
}) => {
  const { annotations: n } = jn();
  return /* @__PURE__ */ k.jsx(
    KC,
    {
      annotations: n,
      filename: e,
      className: t
    }
  );
}, uA = ({
  label: e = "Export WAV",
  filename: t = "export",
  mode: n = "master",
  trackIndex: s,
  bitDepth: i = 16,
  applyEffects: r = !0,
  effectsFunction: o,
  createOfflineTrackEffects: a,
  className: c,
  onExportComplete: l,
  onExportError: u
}) => {
  const { tracks: h, trackStates: d } = Sn(), { exportWav: p, isExporting: f, progress: _ } = TS(), m = async () => {
    try {
      const b = await p(h, d, {
        filename: t,
        mode: n,
        trackIndex: s,
        bitDepth: i,
        applyEffects: r,
        effectsFunction: o,
        createOfflineTrackEffects: a,
        autoDownload: !0
      });
      l?.(b.blob);
    } catch (b) {
      u?.(b instanceof Error ? b : new Error("Export failed"));
    }
  }, g = f ? `Exporting ${Math.round(_ * 100)}%` : e;
  return /* @__PURE__ */ k.jsx(
    dn,
    {
      onClick: m,
      disabled: f || h.length === 0,
      className: c,
      children: g
    }
  );
}, ES = 60, hA = ({
  renderTrackControls: e,
  renderTimestamp: t,
  annotationControls: n,
  annotationListConfig: s,
  annotationTextHeight: i,
  className: r,
  showClipHeaders: o = !1,
  interactiveClips: a = !1,
  recordingState: c
}) => {
  const l = ap(), { isPlaying: u, currentTime: h } = Cn(), {
    selectionStart: d,
    selectionEnd: p,
    annotations: f,
    activeAnnotationId: _,
    annotationsEditable: m,
    linkEndpoints: g,
    continuousPlay: b,
    selectedTrackId: v
  } = jn(), {
    setAnnotations: x,
    setActiveAnnotationId: y,
    setTrackMute: w,
    setTrackSolo: S,
    setTrackVolume: C,
    setTrackPan: D,
    setSelection: R,
    play: A,
    setScrollContainer: I,
    setSelectedTrackId: F,
    setCurrentTime: N
  } = de(), {
    audioBuffers: V,
    peaksDataArray: W,
    trackStates: L,
    tracks: J,
    duration: z,
    samplesPerPixel: E,
    sampleRate: O,
    waveHeight: Z,
    timeScaleHeight: H,
    controls: G,
    playoutRef: X
  } = Sn(), [Q, it] = ft(!1), M = xt(null), ht = rt((et) => {
    M.current = et, I(et);
  }, [I]);
  let tt = V.length > 0 ? z : ES;
  if (c?.isRecording) {
    const mt = (c.startSample + c.durationSamples) / O;
    tt = Math.max(tt, mt + 10);
  }
  const Tt = Math.floor(tt * O / E), Jt = (tt >= 3600 ? 8 : tt >= 600 ? 6 : 5) * 8 + 10, fe = async (et) => {
    console.log("Annotation clicked:", et.id), y(et.id);
    const mt = b ? void 0 : et.end - et.start;
    await A(et.start, mt);
  }, Y = rt((et, mt = "unknown") => {
    if (et >= 0 && et < J.length) {
      const At = J[et];
      console.log(`[Track Selection] ${mt}: track "${At.name}" (ID: ${At.id})`), F(At.id);
    }
  }, [J, F]), ot = (et) => {
    const mt = et.currentTarget.getBoundingClientRect(), At = G.show ? G.width : 0, Gt = (et.clientX - mt.left - At) * E / O, Wt = et.clientY - mt.top - H;
    let Xe = 0, xe = -1;
    for (let Ae = 0; Ae < W.length; Ae++) {
      const te = W[Ae], as = (te.length > 0 ? Math.max(...te.map((mi) => mi.peaks.data.length)) : 1) * Z + (o ? 22 : 0);
      if (Wt >= Xe && Wt < Xe + as) {
        xe = Ae;
        break;
      }
      Xe += as;
    }
    xe !== -1 && Y(xe, `Clicked at Y=${Wt}px`), it(!0), N(Gt), R(Gt, Gt);
  }, Vt = (et) => {
    if (!Q) return;
    const mt = et.currentTarget.getBoundingClientRect(), At = G.show ? G.width : 0, Gt = (et.clientX - mt.left - At) * E / O, be = Math.min(d, Gt), Wt = Math.max(d, Gt);
    R(be, Wt);
  }, Et = (et) => {
    if (!Q) return;
    it(!1);
    const mt = et.currentTarget.getBoundingClientRect(), At = G.show ? G.width : 0, Gt = (et.clientX - mt.left - At) * E / O, be = Math.min(d, Gt), Wt = Math.max(d, Gt);
    Math.abs(Wt - be) < 0.1 ? (N(be), u && X.current ? (X.current.stop(), A(be)) : X.current && X.current.stop()) : R(be, Wt);
  };
  return J.some((et) => et.clips.length > 0) && (V.length === 0 || W.length === 0) ? /* @__PURE__ */ k.jsx("div", { className: r, children: "Loading waveform..." }) : /* @__PURE__ */ k.jsx(rp, { children: /* @__PURE__ */ k.jsxs(
    Uo.Provider,
    {
      value: {
        samplesPerPixel: E,
        sampleRate: O,
        zoomLevels: [E],
        waveHeight: Z,
        timeScaleHeight: H,
        duration: tt,
        controls: G
      },
      children: [
        /* @__PURE__ */ k.jsx(
          Wl,
          {
            theme: l,
            backgroundColor: l.waveOutlineColor,
            timescaleBackgroundColor: l.timescaleBackgroundColor,
            scrollContainerWidth: Tt + (G.show ? G.width : 0) + Jt,
            timescaleWidth: Tt,
            tracksWidth: Tt,
            controlsWidth: G.show ? G.width : 0,
            onTracksMouseDown: ot,
            onTracksMouseMove: Vt,
            onTracksMouseUp: Et,
            scrollContainerRef: ht,
            timescale: H > 0 ? /* @__PURE__ */ k.jsx(
              pp,
              {
                duration: tt * 1e3,
                marker: 1e4,
                bigStep: 5e3,
                secondStep: 1e3,
                renderTimestamp: t
              }
            ) : void 0,
            children: /* @__PURE__ */ k.jsxs(k.Fragment, { children: [
              W.map((et, mt) => {
                const At = J[mt];
                if (!At) return null;
                const Lt = L[mt] || {
                  name: `Track ${mt + 1}`,
                  muted: !1,
                  soloed: !1,
                  volume: 1,
                  pan: 0
                }, Gt = e ? e(mt) : /* @__PURE__ */ k.jsxs(gp, { onClick: () => Y(mt, "Clicked controls"), children: [
                  /* @__PURE__ */ k.jsx(xC, { style: { justifyContent: "center" }, children: Lt.name || `Track ${mt + 1}` }),
                  /* @__PURE__ */ k.jsxs(bC, { children: [
                    /* @__PURE__ */ k.jsx(
                      to,
                      {
                        $variant: Lt.muted ? "danger" : "outline",
                        onClick: () => w(mt, !Lt.muted),
                        children: "Mute"
                      }
                    ),
                    /* @__PURE__ */ k.jsx(
                      to,
                      {
                        $variant: Lt.soloed ? "info" : "outline",
                        onClick: () => S(mt, !Lt.soloed),
                        children: "Solo"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ k.jsxs(Ah, { children: [
                    /* @__PURE__ */ k.jsx(_p, {}),
                    /* @__PURE__ */ k.jsx(
                      eo,
                      {
                        min: "0",
                        max: "1",
                        step: "0.01",
                        value: Lt.volume,
                        onChange: (Wt) => C(mt, parseFloat(Wt.target.value))
                      }
                    ),
                    /* @__PURE__ */ k.jsx(yp, {})
                  ] }),
                  /* @__PURE__ */ k.jsxs(Ah, { children: [
                    /* @__PURE__ */ k.jsx("span", { children: "L" }),
                    /* @__PURE__ */ k.jsx(
                      eo,
                      {
                        min: "-1",
                        max: "1",
                        step: "0.01",
                        value: Lt.pan,
                        onChange: (Wt) => D(mt, parseFloat(Wt.target.value))
                      }
                    ),
                    /* @__PURE__ */ k.jsx("span", { children: "R" })
                  ] })
                ] }), be = et.length > 0 ? Math.max(...et.map((Wt) => Wt.peaks.data.length)) : 1;
                return /* @__PURE__ */ k.jsx(Ll.Provider, { value: Gt, children: /* @__PURE__ */ k.jsxs(
                  mp,
                  {
                    numChannels: be,
                    backgroundColor: l.waveOutlineColor,
                    offset: 0,
                    width: Tt,
                    hasClipHeaders: o,
                    trackId: At.id,
                    isSelected: At.id === v,
                    children: [
                      et.map((Wt, Xe) => {
                        const xe = Wt.peaks, Ae = xe.length;
                        return /* @__PURE__ */ k.jsx(
                          Sh,
                          {
                            clipId: Wt.clipId,
                            trackIndex: mt,
                            clipIndex: Xe,
                            trackName: Wt.trackName,
                            startSample: Wt.startSample,
                            durationSamples: Wt.durationSamples,
                            samplesPerPixel: E,
                            showHeader: o,
                            disableHeaderDrag: !a,
                            isSelected: At.id === v,
                            trackId: At.id,
                            onMouseDown: (te) => {
                              te.target.closest('[role="button"][aria-roledescription="draggable"]') || Y(mt, "Clicked clip");
                            },
                            children: xe.data.map((te, fn) => /* @__PURE__ */ k.jsx(
                              dc,
                              {
                                index: fn,
                                data: te,
                                bits: xe.bits,
                                length: Ae,
                                progress: 0,
                                isSelected: At.id === v
                              },
                              `${mt}-${Xe}-${fn}`
                            ))
                          },
                          `${mt}-${Xe}`
                        );
                      }),
                      c?.isRecording && c.trackId === At.id && c.peaks.length > 0 && /* @__PURE__ */ k.jsx(
                        Sh,
                        {
                          clipId: "recording-preview",
                          trackIndex: mt,
                          clipIndex: et.length,
                          trackName: "Recording...",
                          startSample: c.startSample,
                          durationSamples: c.durationSamples,
                          samplesPerPixel: E,
                          showHeader: o,
                          disableHeaderDrag: !0,
                          isSelected: At.id === v,
                          trackId: At.id,
                          children: /* @__PURE__ */ k.jsx(
                            dc,
                            {
                              index: 0,
                              data: c.peaks,
                              bits: 16,
                              length: Math.floor(c.peaks.length / 2),
                              progress: 0,
                              isSelected: At.id === v
                            },
                            `${mt}-recording-0`
                          )
                        },
                        `${mt}-recording`
                      )
                    ]
                  }
                ) }, At.id);
              }),
              f.length > 0 && /* @__PURE__ */ k.jsx(bp, { height: 30, width: Tt, children: f.map((et, mt) => {
                const At = et.start * O / E, Lt = et.end * O / E;
                return /* @__PURE__ */ k.jsx(
                  vp,
                  {
                    annotationId: et.id,
                    annotationIndex: mt,
                    startPosition: At,
                    endPosition: Lt,
                    label: et.id,
                    color: "#ff9800",
                    isActive: et.id === _,
                    onClick: () => fe(et),
                    editable: m
                  },
                  et.id
                );
              }) }),
              d !== p && /* @__PURE__ */ k.jsx(
                sp,
                {
                  startPosition: Math.min(d, p) * O / E + (G.show ? G.width : 0),
                  endPosition: Math.max(d, p) * O / E + (G.show ? G.width : 0),
                  color: l.selectionColor
                }
              ),
              (u || d === p) && /* @__PURE__ */ k.jsx(
                np,
                {
                  position: h * O / E + (G.show ? G.width : 0),
                  color: l.playheadColor
                }
              )
            ] })
          }
        ),
        f.length > 0 && /* @__PURE__ */ k.jsx(
          xp,
          {
            annotations: f,
            activeAnnotationId: _ ?? void 0,
            shouldScrollToActive: !0,
            editable: m,
            controls: m ? n : void 0,
            annotationListConfig: { linkEndpoints: g, continuousPlay: b },
            height: i,
            onAnnotationUpdate: (et) => {
              x(et);
            }
          }
        )
      ]
    }
  ) });
};
function ks(e, t) {
  this._waveformData = e, this._channelIndex = t;
}
ks.prototype.min_sample = function(e) {
  var t = (e * this._waveformData.channels + this._channelIndex) * 2;
  return this._waveformData._at(t);
};
ks.prototype.max_sample = function(e) {
  var t = (e * this._waveformData.channels + this._channelIndex) * 2 + 1;
  return this._waveformData._at(t);
};
ks.prototype.set_min_sample = function(e, t) {
  var n = (e * this._waveformData.channels + this._channelIndex) * 2;
  return this._waveformData._set_at(n, t);
};
ks.prototype.set_max_sample = function(e, t) {
  var n = (e * this._waveformData.channels + this._channelIndex) * 2 + 1;
  return this._waveformData._set_at(n, t);
};
ks.prototype.min_array = function() {
  for (var e = this._waveformData.length, t = [], n = 0; n < e; n++)
    t.push(this.min_sample(n));
  return t;
};
ks.prototype.max_array = function() {
  for (var e = this._waveformData.length, t = [], n = 0; n < e; n++)
    t.push(this.max_sample(n));
  return t;
};
var DS = 127, RS = -128, OS = 32767, MS = -32768;
function FS(e, t) {
  var n = Math.floor(e / t), s = e - n * t;
  return s > 0 && n++, n;
}
function PS(e) {
  for (var t = e.scale, n = e.amplitude_scale, s = e.split_channels, i = e.length, r = e.sample_rate, o = e.channels.map(function(A) {
    return new Float32Array(A);
  }), a = s ? o.length : 1, c = 24, l = FS(i, t), u = e.bits === 8 ? 1 : 2, h = c + l * 2 * u * a, d = new ArrayBuffer(h), p = new DataView(d), f = 0, _ = c, m = new Array(a), g = new Array(a), b = 0; b < a; b++)
    m[b] = 1 / 0, g[b] = -1 / 0;
  var v = e.bits === 8 ? RS : MS, x = e.bits === 8 ? DS : OS;
  p.setInt32(0, 2, !0), p.setUint32(4, e.bits === 8, !0), p.setInt32(8, r, !0), p.setInt32(12, t, !0), p.setInt32(16, l, !0), p.setInt32(20, a, !0);
  for (var y = 0; y < i; y++) {
    var w = 0;
    if (a === 1) {
      for (var S = 0; S < o.length; ++S)
        w += o[S][y];
      w = Math.floor(x * w * n / o.length), w < m[0] && (m[0] = w, m[0] < v && (m[0] = v)), w > g[0] && (g[0] = w, g[0] > x && (g[0] = x));
    } else
      for (var C = 0; C < a; ++C)
        w = Math.floor(x * o[C][y] * n), w < m[C] && (m[C] = w, m[C] < v && (m[C] = v)), w > g[C] && (g[C] = w, g[C] > x && (g[C] = x));
    if (++f === t) {
      for (var D = 0; D < a; D++)
        e.bits === 8 ? (p.setInt8(_++, m[D]), p.setInt8(_++, g[D])) : (p.setInt16(_, m[D], !0), p.setInt16(_ + 2, g[D], !0), _ += 4), m[D] = 1 / 0, g[D] = -1 / 0;
      f = 0;
    }
  }
  if (f > 0)
    for (var R = 0; R < a; R++)
      e.bits === 8 ? (p.setInt8(_++, m[R]), p.setInt8(_++, g[R])) : (p.setInt16(_, m[R], !0), p.setInt16(_ + 2, g[R], !0));
  return d;
}
function so(e) {
  "@babel/helpers - typeof";
  return so = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, so(e);
}
function NS(e) {
  return e && so(e) === "object" && "sample_rate" in e && "samples_per_pixel" in e && "bits" in e && "length" in e && "data" in e;
}
function VS(e) {
  var t = e && so(e) === "object" && "byteLength" in e;
  if (t) {
    var n = new DataView(e), s = n.getInt32(0, !0);
    if (s !== 1 && s !== 2)
      throw new TypeError("WaveformData.create(): This waveform data version not supported");
  }
  return t;
}
function WS(e) {
  var t = e.data, n = e.channels || 1, s = 24, i = e.bits === 8 ? 1 : 2, r = e.length * 2 * n;
  if (t.length !== r)
    throw new Error("WaveformData.create(): Length mismatch in JSON waveform data");
  var o = s + t.length * i, a = new ArrayBuffer(o), c = new DataView(a);
  c.setInt32(0, 2, !0), c.setUint32(4, e.bits === 8, !0), c.setInt32(8, e.sample_rate, !0), c.setInt32(12, e.samples_per_pixel, !0), c.setInt32(16, e.length, !0), c.setInt32(20, n, !0);
  var l = s;
  if (e.bits === 8)
    for (var u = 0; u < t.length; u++)
      c.setInt8(l++, t[u], !0);
  else
    for (var h = 0; h < t.length; h++)
      c.setInt16(l, t[h], !0), l += 2;
  return a;
}
function Os(e) {
  return e == null;
}
function jS(e, t) {
  var n = atob(e);
  return n;
}
function LS(e, t, n) {
  var s = jS(e), i = s.indexOf(`
`, 10) + 1, r = s.substring(i) + "", o = new Blob([r], { type: "application/javascript" });
  return URL.createObjectURL(o);
}
function BS(e, t, n) {
  var s;
  return function(r) {
    return s = s || LS(e), new Worker(s, r);
  };
}
var $S = /* @__PURE__ */ BS("Lyogcm9sbHVwLXBsdWdpbi13ZWItd29ya2VyLWxvYWRlciAqLwooZnVuY3Rpb24gKCkgewogICd1c2Ugc3RyaWN0JzsKCiAgLyoqCiAgICogQXVkaW9CdWZmZXItYmFzZWQgV2F2ZWZvcm1EYXRhIGdlbmVyYXRvcgogICAqCiAgICogQWRhcHRlZCBmcm9tIEJsb2NrRmlsZTo6Q2FsY1N1bW1hcnkgaW4gQXVkYWNpdHksIHdpdGggcGVybWlzc2lvbi4KICAgKiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2F1ZGFjaXR5L2F1ZGFjaXR5L2Jsb2IvCiAgICogICAxMTA4YzEzNzZjMDkxNjYxNjIzMzVmYWI0NzQzMDA4Y2JhNTdjNGVlL3NyYy9CbG9ja0ZpbGUuY3BwI0wxOTgKICAgKi8KCiAgdmFyIElOVDhfTUFYID0gMTI3OwogIHZhciBJTlQ4X01JTiA9IC0xMjg7CiAgdmFyIElOVDE2X01BWCA9IDMyNzY3OwogIHZhciBJTlQxNl9NSU4gPSAtMzI3Njg7CiAgZnVuY3Rpb24gY2FsY3VsYXRlV2F2ZWZvcm1EYXRhTGVuZ3RoKGF1ZGlvX3NhbXBsZV9jb3VudCwgc2NhbGUpIHsKICAgIHZhciBkYXRhX2xlbmd0aCA9IE1hdGguZmxvb3IoYXVkaW9fc2FtcGxlX2NvdW50IC8gc2NhbGUpOwogICAgdmFyIHNhbXBsZXNfcmVtYWluaW5nID0gYXVkaW9fc2FtcGxlX2NvdW50IC0gZGF0YV9sZW5ndGggKiBzY2FsZTsKICAgIGlmIChzYW1wbGVzX3JlbWFpbmluZyA+IDApIHsKICAgICAgZGF0YV9sZW5ndGgrKzsKICAgIH0KICAgIHJldHVybiBkYXRhX2xlbmd0aDsKICB9CiAgZnVuY3Rpb24gZ2VuZXJhdGVXYXZlZm9ybURhdGEob3B0aW9ucykgewogICAgdmFyIHNjYWxlID0gb3B0aW9ucy5zY2FsZTsKICAgIHZhciBhbXBsaXR1ZGVfc2NhbGUgPSBvcHRpb25zLmFtcGxpdHVkZV9zY2FsZTsKICAgIHZhciBzcGxpdF9jaGFubmVscyA9IG9wdGlvbnMuc3BsaXRfY2hhbm5lbHM7CiAgICB2YXIgbGVuZ3RoID0gb3B0aW9ucy5sZW5ndGg7CiAgICB2YXIgc2FtcGxlX3JhdGUgPSBvcHRpb25zLnNhbXBsZV9yYXRlOwogICAgdmFyIGNoYW5uZWxzID0gb3B0aW9ucy5jaGFubmVscy5tYXAoZnVuY3Rpb24gKGNoYW5uZWwpIHsKICAgICAgcmV0dXJuIG5ldyBGbG9hdDMyQXJyYXkoY2hhbm5lbCk7CiAgICB9KTsKICAgIHZhciBvdXRwdXRfY2hhbm5lbHMgPSBzcGxpdF9jaGFubmVscyA/IGNoYW5uZWxzLmxlbmd0aCA6IDE7CiAgICB2YXIgaGVhZGVyX3NpemUgPSAyNDsKICAgIHZhciBkYXRhX2xlbmd0aCA9IGNhbGN1bGF0ZVdhdmVmb3JtRGF0YUxlbmd0aChsZW5ndGgsIHNjYWxlKTsKICAgIHZhciBieXRlc19wZXJfc2FtcGxlID0gb3B0aW9ucy5iaXRzID09PSA4ID8gMSA6IDI7CiAgICB2YXIgdG90YWxfc2l6ZSA9IGhlYWRlcl9zaXplICsgZGF0YV9sZW5ndGggKiAyICogYnl0ZXNfcGVyX3NhbXBsZSAqIG91dHB1dF9jaGFubmVsczsKICAgIHZhciBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIodG90YWxfc2l6ZSk7CiAgICB2YXIgZGF0YV92aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7CiAgICB2YXIgc2NhbGVfY291bnRlciA9IDA7CiAgICB2YXIgb2Zmc2V0ID0gaGVhZGVyX3NpemU7CiAgICB2YXIgbWluX3ZhbHVlID0gbmV3IEFycmF5KG91dHB1dF9jaGFubmVscyk7CiAgICB2YXIgbWF4X3ZhbHVlID0gbmV3IEFycmF5KG91dHB1dF9jaGFubmVscyk7CiAgICBmb3IgKHZhciBjaGFubmVsID0gMDsgY2hhbm5lbCA8IG91dHB1dF9jaGFubmVsczsgY2hhbm5lbCsrKSB7CiAgICAgIG1pbl92YWx1ZVtjaGFubmVsXSA9IEluZmluaXR5OwogICAgICBtYXhfdmFsdWVbY2hhbm5lbF0gPSAtSW5maW5pdHk7CiAgICB9CiAgICB2YXIgcmFuZ2VfbWluID0gb3B0aW9ucy5iaXRzID09PSA4ID8gSU5UOF9NSU4gOiBJTlQxNl9NSU47CiAgICB2YXIgcmFuZ2VfbWF4ID0gb3B0aW9ucy5iaXRzID09PSA4ID8gSU5UOF9NQVggOiBJTlQxNl9NQVg7CiAgICBkYXRhX3ZpZXcuc2V0SW50MzIoMCwgMiwgdHJ1ZSk7IC8vIFZlcnNpb24KICAgIGRhdGFfdmlldy5zZXRVaW50MzIoNCwgb3B0aW9ucy5iaXRzID09PSA4LCB0cnVlKTsgLy8gSXMgOCBiaXQ/CiAgICBkYXRhX3ZpZXcuc2V0SW50MzIoOCwgc2FtcGxlX3JhdGUsIHRydWUpOyAvLyBTYW1wbGUgcmF0ZQogICAgZGF0YV92aWV3LnNldEludDMyKDEyLCBzY2FsZSwgdHJ1ZSk7IC8vIFNjYWxlCiAgICBkYXRhX3ZpZXcuc2V0SW50MzIoMTYsIGRhdGFfbGVuZ3RoLCB0cnVlKTsgLy8gTGVuZ3RoCiAgICBkYXRhX3ZpZXcuc2V0SW50MzIoMjAsIG91dHB1dF9jaGFubmVscywgdHJ1ZSk7CiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7CiAgICAgIHZhciBzYW1wbGUgPSAwOwogICAgICBpZiAob3V0cHV0X2NoYW5uZWxzID09PSAxKSB7CiAgICAgICAgZm9yICh2YXIgX2NoYW5uZWwgPSAwOyBfY2hhbm5lbCA8IGNoYW5uZWxzLmxlbmd0aDsgKytfY2hhbm5lbCkgewogICAgICAgICAgc2FtcGxlICs9IGNoYW5uZWxzW19jaGFubmVsXVtpXTsKICAgICAgICB9CiAgICAgICAgc2FtcGxlID0gTWF0aC5mbG9vcihyYW5nZV9tYXggKiBzYW1wbGUgKiBhbXBsaXR1ZGVfc2NhbGUgLyBjaGFubmVscy5sZW5ndGgpOwogICAgICAgIGlmIChzYW1wbGUgPCBtaW5fdmFsdWVbMF0pIHsKICAgICAgICAgIG1pbl92YWx1ZVswXSA9IHNhbXBsZTsKICAgICAgICAgIGlmIChtaW5fdmFsdWVbMF0gPCByYW5nZV9taW4pIHsKICAgICAgICAgICAgbWluX3ZhbHVlWzBdID0gcmFuZ2VfbWluOwogICAgICAgICAgfQogICAgICAgIH0KICAgICAgICBpZiAoc2FtcGxlID4gbWF4X3ZhbHVlWzBdKSB7CiAgICAgICAgICBtYXhfdmFsdWVbMF0gPSBzYW1wbGU7CiAgICAgICAgICBpZiAobWF4X3ZhbHVlWzBdID4gcmFuZ2VfbWF4KSB7CiAgICAgICAgICAgIG1heF92YWx1ZVswXSA9IHJhbmdlX21heDsKICAgICAgICAgIH0KICAgICAgICB9CiAgICAgIH0gZWxzZSB7CiAgICAgICAgZm9yICh2YXIgX2NoYW5uZWwyID0gMDsgX2NoYW5uZWwyIDwgb3V0cHV0X2NoYW5uZWxzOyArK19jaGFubmVsMikgewogICAgICAgICAgc2FtcGxlID0gTWF0aC5mbG9vcihyYW5nZV9tYXggKiBjaGFubmVsc1tfY2hhbm5lbDJdW2ldICogYW1wbGl0dWRlX3NjYWxlKTsKICAgICAgICAgIGlmIChzYW1wbGUgPCBtaW5fdmFsdWVbX2NoYW5uZWwyXSkgewogICAgICAgICAgICBtaW5fdmFsdWVbX2NoYW5uZWwyXSA9IHNhbXBsZTsKICAgICAgICAgICAgaWYgKG1pbl92YWx1ZVtfY2hhbm5lbDJdIDwgcmFuZ2VfbWluKSB7CiAgICAgICAgICAgICAgbWluX3ZhbHVlW19jaGFubmVsMl0gPSByYW5nZV9taW47CiAgICAgICAgICAgIH0KICAgICAgICAgIH0KICAgICAgICAgIGlmIChzYW1wbGUgPiBtYXhfdmFsdWVbX2NoYW5uZWwyXSkgewogICAgICAgICAgICBtYXhfdmFsdWVbX2NoYW5uZWwyXSA9IHNhbXBsZTsKICAgICAgICAgICAgaWYgKG1heF92YWx1ZVtfY2hhbm5lbDJdID4gcmFuZ2VfbWF4KSB7CiAgICAgICAgICAgICAgbWF4X3ZhbHVlW19jaGFubmVsMl0gPSByYW5nZV9tYXg7CiAgICAgICAgICAgIH0KICAgICAgICAgIH0KICAgICAgICB9CiAgICAgIH0KICAgICAgaWYgKCsrc2NhbGVfY291bnRlciA9PT0gc2NhbGUpIHsKICAgICAgICBmb3IgKHZhciBfY2hhbm5lbDMgPSAwOyBfY2hhbm5lbDMgPCBvdXRwdXRfY2hhbm5lbHM7IF9jaGFubmVsMysrKSB7CiAgICAgICAgICBpZiAob3B0aW9ucy5iaXRzID09PSA4KSB7CiAgICAgICAgICAgIGRhdGFfdmlldy5zZXRJbnQ4KG9mZnNldCsrLCBtaW5fdmFsdWVbX2NoYW5uZWwzXSk7CiAgICAgICAgICAgIGRhdGFfdmlldy5zZXRJbnQ4KG9mZnNldCsrLCBtYXhfdmFsdWVbX2NoYW5uZWwzXSk7CiAgICAgICAgICB9IGVsc2UgewogICAgICAgICAgICBkYXRhX3ZpZXcuc2V0SW50MTYob2Zmc2V0LCBtaW5fdmFsdWVbX2NoYW5uZWwzXSwgdHJ1ZSk7CiAgICAgICAgICAgIGRhdGFfdmlldy5zZXRJbnQxNihvZmZzZXQgKyAyLCBtYXhfdmFsdWVbX2NoYW5uZWwzXSwgdHJ1ZSk7CiAgICAgICAgICAgIG9mZnNldCArPSA0OwogICAgICAgICAgfQogICAgICAgICAgbWluX3ZhbHVlW19jaGFubmVsM10gPSBJbmZpbml0eTsKICAgICAgICAgIG1heF92YWx1ZVtfY2hhbm5lbDNdID0gLUluZmluaXR5OwogICAgICAgIH0KICAgICAgICBzY2FsZV9jb3VudGVyID0gMDsKICAgICAgfQogICAgfQogICAgaWYgKHNjYWxlX2NvdW50ZXIgPiAwKSB7CiAgICAgIGZvciAodmFyIF9jaGFubmVsNCA9IDA7IF9jaGFubmVsNCA8IG91dHB1dF9jaGFubmVsczsgX2NoYW5uZWw0KyspIHsKICAgICAgICBpZiAob3B0aW9ucy5iaXRzID09PSA4KSB7CiAgICAgICAgICBkYXRhX3ZpZXcuc2V0SW50OChvZmZzZXQrKywgbWluX3ZhbHVlW19jaGFubmVsNF0pOwogICAgICAgICAgZGF0YV92aWV3LnNldEludDgob2Zmc2V0KyssIG1heF92YWx1ZVtfY2hhbm5lbDRdKTsKICAgICAgICB9IGVsc2UgewogICAgICAgICAgZGF0YV92aWV3LnNldEludDE2KG9mZnNldCwgbWluX3ZhbHVlW19jaGFubmVsNF0sIHRydWUpOwogICAgICAgICAgZGF0YV92aWV3LnNldEludDE2KG9mZnNldCArIDIsIG1heF92YWx1ZVtfY2hhbm5lbDRdLCB0cnVlKTsKICAgICAgICB9CiAgICAgIH0KICAgIH0KICAgIHJldHVybiBidWZmZXI7CiAgfQoKICBvbm1lc3NhZ2UgPSBmdW5jdGlvbiBvbm1lc3NhZ2UoZXZ0KSB7CiAgICB2YXIgYnVmZmVyID0gZ2VuZXJhdGVXYXZlZm9ybURhdGEoZXZ0LmRhdGEpOwoKICAgIC8vIFRyYW5zZmVyIGJ1ZmZlciB0byB0aGUgY2FsbGluZyB0aHJlYWQKICAgIHRoaXMucG9zdE1lc3NhZ2UoYnVmZmVyLCBbYnVmZmVyXSk7CiAgICB0aGlzLmNsb3NlKCk7CiAgfTsKCn0pKCk7Ci8vIyBzb3VyY2VNYXBwaW5nVVJMPXdhdmVmb3JtLWRhdGEtd29ya2VyLmpzLm1hcAoK");
function Ke(e) {
  if (NS(e) && (e = WS(e)), VS(e)) {
    this._data = new DataView(e), this._offset = this._version() === 2 ? 24 : 20, this._channels = [];
    for (var t = 0; t < this.channels; t++)
      this._channels[t] = new ks(this, t);
  } else
    throw new TypeError("WaveformData.create(): Unknown data format");
}
var Si = {
  scale: 512,
  bits: 8,
  amplitude_scale: 1,
  split_channels: !1,
  disable_worker: !1
};
function qS(e) {
  var t = {
    scale: e.scale || Si.scale,
    bits: e.bits || Si.bits,
    amplitude_scale: e.amplitude_scale || Si.amplitude_scale,
    split_channels: e.split_channels || Si.split_channels,
    disable_worker: e.disable_worker || Si.disable_worker
  };
  return t;
}
function zS(e) {
  for (var t = [], n = 0; n < e.numberOfChannels; ++n)
    t.push(e.getChannelData(n).buffer);
  return t;
}
function Dp(e, t, n) {
  var s = zS(e);
  if (t.disable_worker) {
    var i = PS({
      scale: t.scale,
      bits: t.bits,
      amplitude_scale: t.amplitude_scale,
      split_channels: t.split_channels,
      length: e.length,
      sample_rate: e.sampleRate,
      channels: s
    });
    n(void 0, new Ke(i), e);
  } else {
    var r = new $S();
    r.onmessage = function(o) {
      n(void 0, new Ke(o.data), e);
    }, r.postMessage({
      scale: t.scale,
      bits: t.bits,
      amplitude_scale: t.amplitude_scale,
      split_channels: t.split_channels,
      length: e.length,
      sample_rate: e.sampleRate,
      channels: s
    }, s);
  }
}
function GS(e, t, n, s) {
  function i(o) {
    o || (o = new DOMException("EncodingError")), s(o), s = function() {
    };
  }
  var r = e.decodeAudioData(t, function(o) {
    Dp(o, n, s);
  }, i);
  r && r.catch(i);
}
Ke.create = function(t) {
  return new Ke(t);
};
Ke.createFromAudio = function(e, t) {
  var n = qS(e);
  if (e.audio_context && e.array_buffer)
    return GS(e.audio_context, e.array_buffer, n, t);
  if (e.audio_buffer)
    return Dp(e.audio_buffer, n, t);
  throw new TypeError(
    // eslint-disable-next-line
    "WaveformData.createFromAudio(): Pass either an AudioContext and ArrayBuffer, or an AudioBuffer object"
  );
};
function Ko(e) {
  this._inputData = e.waveformData, this._output_samples_per_pixel = e.scale, this._scale = this._inputData.scale, this._input_buffer_size = this._inputData.length;
  var t = this._input_buffer_size * this._inputData.scale, n = Math.ceil(t / this._output_samples_per_pixel), s = 24, i = this._inputData.bits === 8 ? 1 : 2, r = s + n * 2 * this._inputData.channels * i;
  this._output_data = new ArrayBuffer(r), this.output_dataview = new DataView(this._output_data), this.output_dataview.setInt32(0, 2, !0), this.output_dataview.setUint32(4, this._inputData.bits === 8, !0), this.output_dataview.setInt32(8, this._inputData.sample_rate, !0), this.output_dataview.setInt32(12, this._output_samples_per_pixel, !0), this.output_dataview.setInt32(16, n, !0), this.output_dataview.setInt32(20, this._inputData.channels, !0), this._outputWaveformData = new Ke(this._output_data), this._input_index = 0, this._output_index = 0;
  var o = this._inputData.channels;
  this._min = new Array(o), this._max = new Array(o);
  for (var a = 0; a < o; ++a)
    this._input_buffer_size > 0 ? (this._min[a] = this._inputData.channel(a).min_sample(this._input_index), this._max[a] = this._inputData.channel(a).max_sample(this._input_index)) : (this._min[a] = 0, this._max[a] = 0);
  this._min_value = this._inputData.bits === 8 ? -128 : -32768, this._max_value = this._inputData.bits === 8 ? 127 : 32767, this._where = 0, this._prev_where = 0, this._stop = 0, this._last_input_index = 0;
}
Ko.prototype.sample_at_pixel = function(e) {
  return Math.floor(e * this._output_samples_per_pixel);
};
Ko.prototype.next = function() {
  for (var e = 0, t = 1e3, n = this._inputData.channels, s; this._input_index < this._input_buffer_size && e < t; ) {
    for (; Math.floor(this.sample_at_pixel(this._output_index) / this._scale) === this._input_index; ) {
      if (this._output_index > 0)
        for (var i = 0; i < n; ++i)
          s = this._outputWaveformData.channel(i), s.set_min_sample(this._output_index - 1, this._min[i]), s.set_max_sample(this._output_index - 1, this._max[i]);
      if (this._last_input_index = this._input_index, this._output_index++, this._where = this.sample_at_pixel(this._output_index), this._prev_where = this.sample_at_pixel(this._output_index - 1), this._where !== this._prev_where)
        for (var r = 0; r < n; ++r)
          this._min[r] = this._max_value, this._max[r] = this._min_value;
    }
    for (this._where = this.sample_at_pixel(this._output_index), this._stop = Math.floor(this._where / this._scale), this._stop > this._input_buffer_size && (this._stop = this._input_buffer_size); this._input_index < this._stop; ) {
      for (var o = 0; o < n; ++o) {
        s = this._inputData.channel(o);
        var a = s.min_sample(this._input_index);
        a < this._min[o] && (this._min[o] = a), a = s.max_sample(this._input_index), a > this._max[o] && (this._max[o] = a);
      }
      this._input_index++;
    }
    e++;
  }
  if (this._input_index < this._input_buffer_size)
    return !1;
  if (this._input_index !== this._last_input_index)
    for (var c = 0; c < n; ++c)
      s = this._outputWaveformData.channel(c), s.set_min_sample(this._output_index - 1, this._min[c]), s.set_max_sample(this._output_index - 1, this._max[c]);
  return !0;
};
Ko.prototype.getOutputData = function() {
  return this._output_data;
};
Ke.prototype = {
  _getResampleOptions: function(t) {
    var n = {};
    if (n.scale = t.scale, n.width = t.width, !Os(n.width) && (typeof n.width != "number" || n.width <= 0))
      throw new RangeError("WaveformData.resample(): width should be a positive integer value");
    if (!Os(n.scale) && (typeof n.scale != "number" || n.scale <= 0))
      throw new RangeError("WaveformData.resample(): scale should be a positive integer value");
    if (!n.scale && !n.width)
      throw new Error("WaveformData.resample(): Missing scale or width option");
    if (n.width && (n.scale = Math.floor(this.duration * this.sample_rate / n.width)), n.scale < this.scale)
      throw new Error("WaveformData.resample(): Zoom level " + n.scale + " too low, minimum: " + this.scale);
    return n.abortSignal = t.abortSignal, n;
  },
  resample: function(t) {
    t = this._getResampleOptions(t), t.waveformData = this;
    for (var n = new Ko(t); !n.next(); )
      ;
    return new Ke(n.getOutputData());
  },
  /**
   * Concatenates with one or more other waveforms, returning a new WaveformData object.
   */
  concat: function() {
    var t = this, n = Array.prototype.slice.call(arguments);
    n.forEach(function(i) {
      if (t.channels !== i.channels || t.sample_rate !== i.sample_rate || t.bits !== i.bits || t.scale !== i.scale)
        throw new Error("WaveformData.concat(): Waveforms are incompatible");
    });
    var s = this._concatBuffers.apply(this, n);
    return Ke.create(s);
  },
  /**
   * Returns a new ArrayBuffer with the concatenated waveform.
   * All waveforms must have identical metadata (version, channels, etc)
   */
  _concatBuffers: function() {
    for (var t = Array.prototype.slice.call(arguments), n = this._offset, s = n, i = 0, r = [this].concat(t).map(function(g) {
      return g._data.buffer;
    }), o = 0; o < r.length; o++) {
      var a = r[o], c = new DataView(a).getInt32(16, !0);
      s += a.byteLength - n, i += c;
    }
    for (var l = new ArrayBuffer(s), u = new DataView(r[0]), h = new DataView(l), d = 0; d < n; d++)
      h.setUint8(d, u.getUint8(d));
    h.setInt32(16, i, !0);
    for (var p = 0, f = new Uint8Array(l, n), _ = 0; _ < r.length; _++) {
      var m = r[_];
      f.set(new Uint8Array(m, n), p), p += m.byteLength - n;
    }
    return l;
  },
  slice: function(t) {
    var n = 0, s = 0;
    if (!Os(t.startIndex) && !Os(t.endIndex) ? (n = t.startIndex, s = t.endIndex) : !Os(t.startTime) && !Os(t.endTime) && (n = this.at_time(t.startTime), s = this.at_time(t.endTime)), n < 0)
      throw new RangeError("startIndex or startTime must not be negative");
    if (s < 0)
      throw new RangeError("endIndex or endTime must not be negative");
    n > this.length && (n = this.length), s > this.length && (s = this.length), n > s && (n = s);
    var i = s - n, r = 24, o = this.bits === 8 ? 1 : 2, a = r + i * 2 * this.channels * o, c = new ArrayBuffer(a), l = new DataView(c);
    l.setInt32(0, 2, !0), l.setUint32(4, this.bits === 8, !0), l.setInt32(8, this.sample_rate, !0), l.setInt32(12, this.scale, !0), l.setInt32(16, i, !0), l.setInt32(20, this.channels, !0);
    for (var u = 0; u < i * this.channels * 2; u++) {
      var h = this._at(n * this.channels * 2 + u);
      this.bits === 8 ? l.setInt8(r + u, h) : l.setInt16(r + u * 2, h, !0);
    }
    return new Ke(c);
  },
  /**
   * Returns the data format version number.
   */
  _version: function() {
    return this._data.getInt32(0, !0);
  },
  /**
   * Returns the length of the waveform, in pixels.
   */
  get length() {
    return this._data.getUint32(16, !0);
  },
  /**
   * Returns the number of bits per sample, either 8 or 16.
   */
  get bits() {
    var e = !!this._data.getUint32(4, !0);
    return e ? 8 : 16;
  },
  /**
   * Returns the (approximate) duration of the audio file, in seconds.
   */
  get duration() {
    return this.length * this.scale / this.sample_rate;
  },
  /**
   * Returns the number of pixels per second.
   */
  get pixels_per_second() {
    return this.sample_rate / this.scale;
  },
  /**
   * Returns the amount of time represented by a single pixel, in seconds.
   */
  get seconds_per_pixel() {
    return this.scale / this.sample_rate;
  },
  /**
   * Returns the number of waveform channels.
   */
  get channels() {
    return this._version() === 2 ? this._data.getInt32(20, !0) : 1;
  },
  /**
   * Returns a waveform channel.
   */
  channel: function(t) {
    if (t >= 0 && t < this._channels.length)
      return this._channels[t];
    throw new RangeError("Invalid channel: " + t);
  },
  /**
   * Returns the number of audio samples per second.
   */
  get sample_rate() {
    return this._data.getInt32(8, !0);
  },
  /**
   * Returns the number of audio samples per pixel.
   */
  get scale() {
    return this._data.getInt32(12, !0);
  },
  /**
   * Returns a waveform data value at a specific offset.
   */
  _at: function(t) {
    return this.bits === 8 ? this._data.getInt8(this._offset + t) : this._data.getInt16(this._offset + t * 2, !0);
  },
  /**
   * Sets a waveform data value at a specific offset.
   */
  _set_at: function(t, n) {
    return this.bits === 8 ? this._data.setInt8(this._offset + t, n) : this._data.setInt16(this._offset + t * 2, n, !0);
  },
  /**
   * Returns the waveform data index position for a given time.
   */
  at_time: function(t) {
    return Math.floor(t * this.sample_rate / this.scale);
  },
  /**
   * Returns the time in seconds for a given index.
   */
  time: function(t) {
    return t * this.scale / this.sample_rate;
  },
  /**
   * Returns an object containing the waveform data.
   */
  toJSON: function() {
    for (var t = {
      version: 2,
      channels: this.channels,
      sample_rate: this.sample_rate,
      samples_per_pixel: this.scale,
      bits: this.bits,
      length: this.length,
      data: []
    }, n = 0; n < this.length; n++)
      for (var s = 0; s < this.channels; s++)
        t.data.push(this.channel(s).min_sample(n)), t.data.push(this.channel(s).max_sample(n));
    return t;
  },
  /**
   * Returns the waveform data in binary format as an ArrayBuffer.
   */
  toArrayBuffer: function() {
    return this._data.buffer;
  }
};
async function Rp(e) {
  const t = await fetch(e);
  if (!t.ok)
    throw new Error(`Failed to fetch waveform data: ${t.statusText}`);
  if (e.endsWith(".dat")) {
    const s = await t.arrayBuffer();
    return Ke.create(s);
  } else {
    const s = await t.json();
    return Ke.create(s);
  }
}
function ZS(e, t = 0) {
  const n = e.channel(t), s = e.bits, i = n.min_array(), r = n.max_array(), o = i.length, a = s === 8 ? new Int8Array(o * 2) : new Int16Array(o * 2);
  for (let c = 0; c < o; c++)
    a[c * 2] = i[c], a[c * 2 + 1] = r[c];
  return {
    data: a,
    bits: s,
    length: o,
    sampleRate: e.sample_rate
  };
}
async function dA(e, t = 0) {
  const n = await Rp(e);
  return ZS(n, t);
}
async function fA(e) {
  const t = await Rp(e);
  return {
    sampleRate: t.sample_rate,
    channels: t.channels,
    duration: t.duration,
    samplesPerPixel: t.scale,
    length: t.length,
    bits: t.bits
  };
}
const YS = {
  waveOutlineColor: "#00f",
  waveFillColor: "#0ff",
  waveProgressColor: "#f00",
  timeColor: "#000"
};
class XS {
  constructor(t) {
    this.root = null, this.playout = null, this.tracks = [], this.peaksData = /* @__PURE__ */ new Map(), this.eventEmitter = null, this.playbackState = "stopped", this.currentTime = 0, this.hasSeeked = !1, this.animationFrameId = null, this.setProgressFn = null, this.setSelectionFn = null, this.setIsPlayingFn = null, this.isAutomaticScroll = !1, this.scrollContainer = null, this.selectionStart = 0, this.selectionEnd = 0, this.timeFormat = "hh:mm:ss.uuu", this.isDragging = !1, this.dragStartTime = 0, this.annotations = [], this.activeAnnotationId = null, this.lastScrolledAnnotationId = null, this.isPlayingTimedSegment = !1, this.getTimeFromMouseEvent = (n) => {
      if (!this.playout || !this.scrollContainer)
        return null;
      const s = n.currentTarget.getBoundingClientRect(), i = n.clientX - s.left, r = this.config.samplesPerPixel || 4096, o = this.playout.sampleRate / r, a = i / o, c = this.getDuration();
      return Math.max(0, Math.min(a, c));
    }, this.handleMouseDown = (n) => {
      const s = this.getTimeFromMouseEvent(n);
      s !== null && (this.isDragging = !0, this.dragStartTime = s, this.setSelection(s, s));
    }, this.handleMouseMove = (n) => {
      if (!this.isDragging) return;
      const s = this.getTimeFromMouseEvent(n);
      if (s === null) return;
      const i = Math.min(this.dragStartTime, s), r = Math.max(this.dragStartTime, s);
      this.setSelection(i, r), this.setProgressFn && this.setProgressFn(this.currentTime);
    }, this.handleMouseUp = (n) => {
      if (!this.isDragging) return;
      const s = this.getTimeFromMouseEvent(n);
      if (s === null) return;
      this.isDragging = !1;
      const i = Math.min(this.dragStartTime, s), r = Math.max(this.dragStartTime, s);
      Math.abs(r - i) < 0.1 ? (this.currentTime = i, this.setProgressFn && this.setProgressFn(i), this.eventEmitter && this.eventEmitter.emit("timeupdate", i), this.playbackState === "playing" ? this.play(i) : (this.playout && this.playout.stop(), this.hasSeeked = !0)) : (this.setSelection(i, r), this.currentTime = i, this.setProgressFn && this.setProgressFn(i));
    }, this.container = t.container, this.config = t, this.isAutomaticScroll = t.isAutomaticScroll ?? !1, t.annotationList?.annotations && (this.annotations = t.annotationList.annotations.map((n) => {
      const s = n.begin !== void 0 ? parseFloat(n.begin) : n.start, i = n.end !== void 0 && typeof n.end == "string" ? parseFloat(n.end) : n.end;
      return {
        id: n.id,
        start: s,
        end: i,
        lines: n.lines,
        language: n.language
      };
    })), this.container.innerHTML = "", this.root = Bp.createRoot(this.container), this.playout = new sf({
      effects: this.config.effects
    }), this.eventEmitter = this.createEventEmitter();
  }
  async load(t) {
    const n = It().rawContext, s = [];
    for (let i = 0; i < t.length; i++) {
      const r = t[i];
      try {
        const a = await Su.createLoader(r.src, n).load(), c = {
          id: `track-${i}`,
          name: r.name || `Track ${i + 1}`,
          src: typeof r.src == "string" ? r.src : void 0,
          gain: r.gain ?? 1,
          muted: r.muted ?? !1,
          soloed: r.soloed ?? !1,
          stereoPan: r.stereoPan ?? 0,
          startTime: r.start ?? 0,
          fadeIn: r.fadeIn ? {
            start: r.start ?? 0,
            end: (r.start ?? 0) + r.fadeIn.duration,
            type: r.fadeIn.shape ?? "logarithmic"
          } : void 0,
          fadeOut: r.fadeOut ? {
            start: a.duration - r.fadeOut.duration,
            end: a.duration,
            type: r.fadeOut.shape ?? "logarithmic"
          } : void 0
        };
        s.push(c);
        const l = this.config.samplesPerPixel || 4096, u = this.config.mono ?? !0, h = mc(a, l, u);
        this.peaksData.set(c.id, h), this.playout && this.playout.addTrack({
          buffer: a,
          track: c,
          effects: r.effects
        });
      } catch (o) {
        throw console.error(`Failed to load track ${r.src}:`, o), o;
      }
    }
    this.tracks = s, console.log("Loaded tracks:", s), console.log("Peaks data:", Array.from(this.peaksData.entries())), this.render(), console.log("Render complete"), setTimeout(() => {
      this.setupSelectionInputListeners();
    }, 0), setTimeout(() => {
      for (let i = 0; i < t.length; i++) {
        const r = t[i];
        if (r.selected) {
          this.setSelection(r.selected.start, r.selected.end);
          break;
        }
      }
    }, 100);
  }
  async addTrack(t, n) {
    const s = It().rawContext;
    try {
      const i = {
        src: t,
        name: n?.name,
        start: n?.start,
        fadeIn: n?.fadeIn,
        fadeOut: n?.fadeOut,
        gain: n?.gain,
        muted: n?.muted,
        soloed: n?.soloed,
        stereoPan: n?.stereoPan
      }, o = await Su.createLoader(i.src, s).load(), a = this.tracks.length, c = {
        id: `track-${a}`,
        name: i.name || (t instanceof File ? t.name : `Track ${a + 1}`),
        src: typeof i.src == "string" ? i.src : void 0,
        gain: i.gain ?? 1,
        muted: i.muted ?? !1,
        soloed: i.soloed ?? !1,
        stereoPan: i.stereoPan ?? 0,
        startTime: i.start ?? 0,
        fadeIn: i.fadeIn ? {
          start: i.start ?? 0,
          end: (i.start ?? 0) + i.fadeIn.duration,
          type: i.fadeIn.shape ?? "logarithmic"
        } : void 0,
        fadeOut: i.fadeOut ? {
          start: o.duration - i.fadeOut.duration,
          end: o.duration,
          type: i.fadeOut.shape ?? "logarithmic"
        } : void 0
      }, l = this.config.samplesPerPixel || 4096, u = this.config.mono ?? !0, h = mc(o, l, u);
      this.peaksData.set(c.id, h), this.playout && this.playout.addTrack({
        buffer: o,
        track: c,
        effects: i.effects
      }), this.tracks.push(c), this.render(), console.log("Added new track:", c);
    } catch (i) {
      throw console.error("Failed to load track:", i), i;
    }
  }
  render() {
    if (!this.root) return;
    const t = {
      ...YS,
      ...this.config.colors
    }, n = this.config.waveHeight || 128, s = this.config.samplesPerPixel || 4096, i = 30, r = () => {
      const { progress: o, selectionStart: a, selectionEnd: c, isPlaying: l } = aC(), { setProgress: u, setSelection: h, setIsPlaying: d } = cC();
      $t.useEffect(() => (this.setProgressFn = u, this.setSelectionFn = h, this.setIsPlayingFn = d, () => {
        this.setProgressFn = null, this.setSelectionFn = null, this.setIsPlayingFn = null;
      }), [u, h, d]);
      const p = this.config.controls?.show !== !1, f = this.config.controls?.width || 200, _ = this.config.timescale !== !1;
      let m = 0;
      this.playout && this.tracks.forEach((S) => {
        const C = this.playout?.getTrack(S.id);
        if (C) {
          const D = C.buffer.duration + S.startTime;
          m = Math.max(m, D);
        }
      });
      const g = {
        sampleRate: this.playout?.sampleRate || 44100,
        samplesPerPixel: s,
        zoomLevels: this.config.zoomLevels || [512, 1024, 2048, 4096],
        waveHeight: n,
        timeScaleHeight: i,
        duration: m,
        controls: {
          show: p,
          width: f
        }
      }, b = $t.useMemo(() => $t.memo(
        ({ trackId: S, currentTime: C, selectionStart: D, selectionEnd: R, isPlaying: A }) => {
          const I = this.peaksData.get(S);
          if (!I || !this.playout) return null;
          const F = this.playout.getTrack(S);
          if (!F) return null;
          const N = I.length, W = this.tracks.find((O) => O.id === S)?.startTime || 0, L = F.buffer.duration, z = A || !(D !== R);
          let E = 0;
          if (z && C >= W) {
            const O = C - W;
            O <= L ? E = nn(O, s, this.playout.sampleRate) : E = nn(L, s, this.playout.sampleRate), E = Math.min(E, N);
          }
          return /* @__PURE__ */ k.jsx(k.Fragment, { children: I.data.map((O, Z) => /* @__PURE__ */ k.jsx(
            dc,
            {
              index: Z,
              data: O,
              bits: I.bits,
              length: N,
              progress: E
            },
            Z
          )) });
        }
      ), [t, n, s]), v = $t.useMemo(() => ({ trackId: S, track: C }) => {
        const [D, R] = $t.useState(C.muted), [A, I] = $t.useState(C.soloed), [F, N] = $t.useState(C.gain), [V, W] = $t.useState(C.stereoPan || 0);
        return /* @__PURE__ */ k.jsxs(gp, { children: [
          /* @__PURE__ */ k.jsx("div", { style: { fontSize: "9px", fontWeight: "bold", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }, children: C.name }),
          /* @__PURE__ */ k.jsxs("div", { style: { display: "flex", gap: "3px", justifyContent: "center" }, children: [
            /* @__PURE__ */ k.jsx(
              to,
              {
                onClick: () => {
                  const L = !D;
                  R(L), this.setTrackMute(S, L);
                },
                style: {
                  padding: "2px 5px",
                  fontSize: "9px",
                  backgroundColor: D ? "#ef4444" : void 0,
                  color: D ? "#fff" : void 0
                },
                children: "Mute"
              }
            ),
            /* @__PURE__ */ k.jsx(
              to,
              {
                onClick: () => {
                  const L = !A;
                  I(L), this.setTrackSolo(S, L);
                },
                style: {
                  padding: "2px 5px",
                  fontSize: "9px",
                  backgroundColor: A ? "#3b82f6" : void 0,
                  color: A ? "#fff" : void 0
                },
                children: "Solo"
              }
            )
          ] }),
          /* @__PURE__ */ k.jsxs("div", { style: { width: "100%", display: "flex", alignItems: "center", gap: "4px", padding: "3px 8px", boxSizing: "border-box" }, children: [
            /* @__PURE__ */ k.jsx(_p, { style: { fontSize: "10px", width: "12px", flexShrink: 0, textAlign: "center" } }),
            /* @__PURE__ */ k.jsx(
              eo,
              {
                min: 0,
                max: 200,
                value: F * 100,
                onChange: (L) => {
                  const J = parseInt(L.currentTarget.value) / 100;
                  N(J), this.setTrackGain(S, J);
                },
                style: { flex: 1, minWidth: 0 }
              }
            ),
            /* @__PURE__ */ k.jsx(yp, { style: { fontSize: "10px", width: "12px", flexShrink: 0, textAlign: "center" } })
          ] }),
          /* @__PURE__ */ k.jsxs("div", { style: { width: "100%", display: "flex", alignItems: "center", gap: "4px", padding: "3px 8px", boxSizing: "border-box" }, children: [
            /* @__PURE__ */ k.jsx("span", { style: { fontSize: "8px", color: "#666", fontWeight: "bold", width: "12px", flexShrink: 0, textAlign: "center" }, children: "L" }),
            /* @__PURE__ */ k.jsx(
              eo,
              {
                min: -100,
                max: 100,
                value: V * 100,
                onChange: (L) => {
                  const J = parseInt(L.currentTarget.value) / 100;
                  W(J), this.setTrackPan(S, J);
                },
                style: { flex: 1, minWidth: 0 }
              }
            ),
            /* @__PURE__ */ k.jsx("span", { style: { fontSize: "8px", color: "#666", fontWeight: "bold", width: "12px", flexShrink: 0, textAlign: "center" }, children: "R" })
          ] })
        ] });
      }, []), w = (this.playout ? nn(m, s, this.playout.sampleRate) : 0) + (p ? f : 0);
      return /* @__PURE__ */ k.jsx(rp, { children: /* @__PURE__ */ k.jsx(Uo.Provider, { value: g, children: /* @__PURE__ */ k.jsx(Gh, { theme: t, children: /* @__PURE__ */ k.jsxs("div", { style: { fontFamily: "Arial, sans-serif" }, children: [
        /* @__PURE__ */ k.jsx(
          Wl,
          {
            theme: t,
            backgroundColor: t.waveOutlineColor || "#00f",
            scrollContainerWidth: w,
            timescaleWidth: w,
            tracksWidth: w,
            controlsWidth: p ? f : 0,
            onTracksMouseDown: this.handleMouseDown,
            onTracksMouseMove: this.handleMouseMove,
            onTracksMouseUp: this.handleMouseUp,
            scrollContainerRef: (S) => {
              this.scrollContainer = S;
            },
            timescale: _ ? /* @__PURE__ */ k.jsx(
              pp,
              {
                duration: m * 1e3,
                marker: 1e4,
                bigStep: 5e3,
                secondStep: 1e3
              }
            ) : void 0,
            children: /* @__PURE__ */ k.jsxs(k.Fragment, { children: [
              this.tracks.map((S) => {
                const C = this.peaksData.get(S.id);
                if (!C) return null;
                const D = p ? /* @__PURE__ */ k.jsx(v, { trackId: S.id, track: S }) : /* @__PURE__ */ k.jsx(k.Fragment, {}), R = this.playout ? nn(S.startTime, s, this.playout.sampleRate) : 0;
                return /* @__PURE__ */ k.jsx(Ll.Provider, { value: D, children: /* @__PURE__ */ k.jsx(
                  mp,
                  {
                    numChannels: C.data.length,
                    backgroundColor: t.waveOutlineColor || "#00f",
                    offset: R,
                    width: w,
                    children: /* @__PURE__ */ k.jsx(
                      b,
                      {
                        trackId: S.id,
                        currentTime: o,
                        selectionStart: a,
                        selectionEnd: c,
                        isPlaying: l
                      }
                    )
                  }
                ) }, S.id);
              }),
              this.annotations.length > 0 && this.playout && /* @__PURE__ */ k.jsx(
                bp,
                {
                  height: 30,
                  width: w,
                  children: this.annotations.map((S, C) => {
                    const D = nn(S.start, s, this.playout.sampleRate), R = nn(S.end, s, this.playout.sampleRate);
                    return /* @__PURE__ */ k.jsx(
                      vp,
                      {
                        annotationId: S.id,
                        annotationIndex: C,
                        startPosition: D,
                        endPosition: R,
                        label: S.id,
                        color: "#ff9800",
                        isActive: S.id === this.activeAnnotationId,
                        editable: !1,
                        onClick: async () => {
                          this.activeAnnotationId = S.id, this.lastScrolledAnnotationId = S.id;
                          const A = this.config.annotationList?.isContinuousPlay === !1 ? S.end - S.start : void 0;
                          await this.play(S.start, A), this.render();
                        }
                      },
                      S.id
                    );
                  })
                }
              ),
              this.tracks.length > 0 && this.playout && /* @__PURE__ */ k.jsxs(k.Fragment, { children: [
                a !== c && /* @__PURE__ */ k.jsx(
                  sp,
                  {
                    startPosition: nn(a, s, this.playout.sampleRate) + (p ? f : 0),
                    endPosition: nn(c, s, this.playout.sampleRate) + (p ? f : 0),
                    color: "#00ff00"
                  }
                ),
                l && /* @__PURE__ */ k.jsx(
                  np,
                  {
                    position: nn(o, s, this.playout.sampleRate) + (p ? f : 0),
                    color: t.waveProgressColor || "#f00"
                  }
                )
              ] })
            ] })
          }
        ),
        this.annotations.length > 0 && /* @__PURE__ */ k.jsx(
          xp,
          {
            annotations: this.annotations,
            activeAnnotationId: this.activeAnnotationId || void 0,
            shouldScrollToActive: this.activeAnnotationId === this.lastScrolledAnnotationId,
            editable: this.config.annotationList?.editable,
            controls: this.config.annotationList?.controls,
            annotationListConfig: this.config.annotationList,
            onAnnotationClick: (S) => {
              this.activeAnnotationId = S.id, this.seek(S.start), this.render();
            },
            onAnnotationUpdate: (S) => {
              this.annotations = S, this.render();
            }
          },
          "annotation-text-panel"
        ),
        /* @__PURE__ */ k.jsx("div", { style: { marginTop: "20px", color: "#666", fontSize: "12px", textAlign: "center" }, children: "✨ Powered by Tone.js 15.1.22 and React 18" })
      ] }) }) }) });
    };
    this.root.render(
      /* @__PURE__ */ k.jsx(oC, { children: /* @__PURE__ */ k.jsx(r, {}) })
    );
  }
  async play(t, n) {
    if (this.playout) {
      await this.playout.init(), console.log("Playing from:", { startTime: t, duration: n, playbackState: this.playbackState, currentTime: this.currentTime, hasSeeked: this.hasSeeked });
      let s;
      t !== void 0 ? s = t : this.selectionStart !== this.selectionEnd && this.currentTime < this.selectionStart ? s = this.selectionStart : s = this.currentTime, console.log("Playing from position:", s, "for duration:", n), this.playout.stop(), this.currentTime = s, this.hasSeeked = !1, n !== void 0 ? (this.isPlayingTimedSegment = !0, this.playout.setOnPlaybackComplete(() => {
        this.playbackState === "playing" && (this.isPlayingTimedSegment = !1, this.pause(!1));
      })) : this.isPlayingTimedSegment = !1, this.playout.play(fs(), s, n), this.playbackState = "playing", this.setIsPlayingFn && this.setIsPlayingFn(!0), this.startAnimation();
    }
  }
  pause(t = !0) {
    console.log("[Playlist] pause called - clearActiveAnnotation:", t, "activeAnnotationId:", this.activeAnnotationId), this.playout && (this.playout.pause(), this.playbackState = "paused", this.isPlayingTimedSegment = !1, t ? (this.activeAnnotationId = null, this.lastScrolledAnnotationId = null) : this.lastScrolledAnnotationId = null, console.log("[Playlist] after pause - activeAnnotationId:", this.activeAnnotationId), this.currentTime = 0, this.setIsPlayingFn && this.setIsPlayingFn(!1), this.setProgressFn && this.setProgressFn(0), this.stopAnimation(), this.render());
  }
  stop() {
    this.playout && (this.playout.stop(), this.playbackState = "stopped", this.isPlayingTimedSegment = !1, this.activeAnnotationId = null, this.setIsPlayingFn && this.setIsPlayingFn(!1), this.stopAnimation(), this.currentTime = 0, this.setProgressFn && this.setProgressFn(0), this.eventEmitter && this.eventEmitter.emit("timeupdate", 0), this.render(), this.scrollContainer && (this.scrollContainer.scrollLeft = 0));
  }
  seek(t) {
    this.currentTime = Math.max(0, t), this.hasSeeked = !0, this.setProgressFn && this.setProgressFn(this.currentTime), this.eventEmitter && this.eventEmitter.emit("timeupdate", this.currentTime), this.render();
  }
  startAnimation() {
    if (this.animationFrameId !== null)
      return;
    const t = () => {
      if (this.playbackState !== "playing" || !this.playout) {
        this.animationFrameId = null;
        return;
      }
      if (this.currentTime = this.playout.getCurrentTime(), this.annotations.length > 0 && this.playbackState === "playing" && !this.isPlayingTimedSegment) {
        const s = this.annotations.find(
          (r) => this.currentTime >= r.start && this.currentTime < r.end
        ), i = s ? s.id : null;
        i !== this.activeAnnotationId && (this.activeAnnotationId = i, this.render());
      }
      if (this.selectionStart !== this.selectionEnd && this.currentTime >= this.selectionEnd) {
        this.stop();
        return;
      }
      const n = this.getDuration();
      if (this.currentTime >= n) {
        this.stop();
        return;
      }
      this.setProgressFn && this.setProgressFn(this.currentTime), this.eventEmitter && this.eventEmitter.emit("timeupdate", this.currentTime), this.isAutomaticScroll && this.scrollToCurrentTime(), this.animationFrameId = requestAnimationFrame(t);
    };
    this.playbackState === "playing" && (this.animationFrameId = requestAnimationFrame(t));
  }
  scrollToCurrentTime() {
    if (!this.scrollContainer && (this.scrollContainer = this.container.querySelector('[data-scroll-container="true"]'), !this.scrollContainer) || !this.playout) return;
    const t = this.config.samplesPerPixel || 4096, n = nn(this.currentTime, t, this.playout.sampleRate), s = this.scrollContainer.clientWidth, i = this.scrollContainer.scrollLeft, r = i + s, o = s * 0.2, a = n < i, c = n > r;
    if (a || c)
      this.scrollContainer.scrollLeft = Math.max(0, n - o);
    else {
      const l = n - o;
      l > i && (this.scrollContainer.scrollLeft = Math.max(0, l));
    }
  }
  setAutomaticScroll(t) {
    this.isAutomaticScroll = t;
  }
  stopAnimation() {
    this.animationFrameId !== null && (cancelAnimationFrame(this.animationFrameId), this.animationFrameId = null);
  }
  setMasterGain(t) {
    this.playout && this.playout.setMasterGain(t);
  }
  setTrackGain(t, n) {
    if (this.playout) {
      const s = this.playout.getTrack(t);
      s && s.setVolume(n);
    }
  }
  setTrackMute(t, n) {
    this.playout && this.playout.setMute(t, n);
  }
  setTrackSolo(t, n) {
    this.playout && this.playout.setSolo(t, n);
  }
  parseTime(t) {
    const n = t.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
    if (n) {
      const i = parseInt(n[1], 10), r = parseInt(n[2], 10), o = parseFloat(n[3]);
      return i * 3600 + r * 60 + o;
    }
    const s = parseFloat(t);
    return isNaN(s) ? 0 : s;
  }
  formatTime(t) {
    const n = (r, o) => {
      const a = Math.floor(r / 3600) % 24, c = Math.floor(r / 60) % 60, l = (r % 60).toFixed(o);
      return String(a).padStart(2, "0") + ":" + String(c).padStart(2, "0") + ":" + l.padStart(o + 3, "0");
    }, s = {
      seconds: (r) => r.toFixed(0),
      thousandths: (r) => r.toFixed(3),
      "hh:mm:ss": (r) => n(r, 0),
      "hh:mm:ss.u": (r) => n(r, 1),
      "hh:mm:ss.uu": (r) => n(r, 2),
      "hh:mm:ss.uuu": (r) => n(r, 3)
    };
    return (s[this.timeFormat] || s["hh:mm:ss.uuu"])(t);
  }
  updateSelectionInputs() {
    const t = document.getElementById("audio_start"), n = document.getElementById("audio_end");
    t && (t.value = this.formatTime(this.selectionStart)), n && (n.value = this.formatTime(this.selectionEnd));
  }
  setupSelectionInputListeners() {
    const t = document.getElementById("audio_start"), n = document.getElementById("audio_end");
    t && t.addEventListener("change", () => {
      const s = this.parseTime(t.value);
      this.setSelection(s, this.selectionEnd);
    }), n && n.addEventListener("change", () => {
      const s = this.parseTime(n.value);
      this.setSelection(this.selectionStart, s);
    });
  }
  setSelection(t, n) {
    this.selectionStart = t, this.selectionEnd = n, this.updateSelectionInputs(), this.setSelectionFn && this.setSelectionFn(t, n), this.eventEmitter && this.eventEmitter.emit("select", t, n);
  }
  setTrackPan(t, n) {
    if (this.playout) {
      const s = this.playout.getTrack(t);
      s && s.setPan(n);
    }
  }
  getDuration() {
    let t = 0;
    return this.playout && this.tracks.forEach((n) => {
      const s = this.playout?.getTrack(n.id);
      if (s) {
        const i = s.buffer.duration + n.startTime;
        t = Math.max(t, i);
      }
    }), t;
  }
  rewind() {
    this.playbackState === "playing" ? (this.stop(), this.play(0)) : (this.currentTime = 0, this.setProgressFn && this.setProgressFn(0), this.eventEmitter && this.eventEmitter.emit("timeupdate", 0));
  }
  fastForward() {
    const t = this.playbackState === "playing", n = this.getDuration();
    t ? (this.stop(), this.play(n)) : (this.currentTime = n, this.setProgressFn && this.setProgressFn(n), this.eventEmitter && this.eventEmitter.emit("timeupdate", n));
  }
  getCurrentTime() {
    return this.playout ? this.playout.getCurrentTime() : 0;
  }
  getTracks() {
    return this.tracks;
  }
  createEventEmitter() {
    const t = /* @__PURE__ */ new Map(), n = this;
    return {
      on: (s, i) => {
        console.log(`Event listener registered: ${s}`), t.has(s) || t.set(s, []), t.get(s).push(i);
      },
      emit: (s, ...i) => {
        switch (t.has(s) && t.get(s).forEach((r) => r(...i)), s) {
          case "play":
            n.play();
            break;
          case "pause":
            n.pause();
            break;
          case "stop":
            n.stop();
            break;
          case "rewind":
            n.rewind();
            break;
          case "fastforward":
            n.fastForward();
            break;
          case "automaticscroll":
            n.setAutomaticScroll(i[0]);
            break;
          case "newtrack":
            i[0] && n.addTrack(i[0]).catch((r) => {
              console.error("Failed to add new track:", r);
            });
            break;
          case "durationformat":
            i[0] && (n.timeFormat = i[0], n.updateSelectionInputs());
            break;
        }
      }
    };
  }
  getEventEmitter() {
    return this.eventEmitter;
  }
  destroy() {
    this.playout && this.playout.dispose(), this.root && this.root.unmount();
  }
}
const US = {
  init: (e) => new XS(e),
  Tone: nf
}, pA = US.init;
export {
  sA as AudioPosition,
  rA as AutomaticScrollCheckbox,
  oA as ContinuousPlayCheckbox,
  lA as DownloadAnnotationsButton,
  cA as EditableCheckbox,
  uA as ExportWavButton,
  HT as FastForwardButton,
  aA as LinkEndpointsCheckbox,
  eA as MasterVolumeControl,
  YT as PauseButton,
  ZT as PlayButton,
  UT as RewindButton,
  iA as SelectionTimeInputs,
  KT as SkipBackwardButton,
  QT as SkipForwardButton,
  XT as StopButton,
  nA as TimeFormatSelect,
  nf as Tone,
  hA as Waveform,
  zT as WaveformPlaylistProvider,
  JT as ZoomInButton,
  tA as ZoomOutButton,
  BT as createEffectChain,
  no as createEffectInstance,
  US as default,
  LT as effectCategories,
  Ho as effectDefinitions,
  Sp as getEffectDefinition,
  jT as getEffectsByCategory,
  fA as getWaveformDataMetadata,
  pA as init,
  dA as loadPeaksFromWaveformData,
  Rp as loadWaveformData,
  FT as useAnnotationDragHandlers,
  VT as useAnnotationKeyboardControls,
  OT as useAudioTracks,
  MT as useClipDragHandlers,
  NT as useClipSplitting,
  PT as useDragSensors,
  $T as useDynamicEffects,
  RT as useEffectsChain,
  TS as useExportWav,
  WT as useIntegratedRecording,
  cS as useKeyboardShortcuts,
  IT as useMasterAnalyser,
  iS as useMasterVolume,
  Cn as usePlaybackAnimation,
  de as usePlaylistControls,
  Sn as usePlaylistData,
  jn as usePlaylistState,
  eS as useTimeFormat,
  DT as useTrackAutoWah,
  qT as useTrackDynamicEffects,
  ET as useTrackReverb,
  GT as useWaveformPlaylist,
  sS as useZoomControls,
  ZS as waveformDataToPeaks
};
//# sourceMappingURL=index.mjs.map
