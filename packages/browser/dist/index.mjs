import Kt, { useLayoutEffect as ip, useEffect as oe, useMemo as $i, useRef as Et, useCallback as xt, createContext as Xe, useContext as je, Fragment as rp, useState as pt } from "react";
import op from "react-dom";
import X, { withTheme as xh, ThemeContext as ap, ThemeProvider as wh } from "styled-components";
function Ch(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var br = { exports: {} }, wi = {};
var Il;
function cp() {
  if (Il) return wi;
  Il = 1;
  var n = Kt, t = Symbol.for("react.element"), e = Symbol.for("react.fragment"), s = Object.prototype.hasOwnProperty, i = n.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, r = { key: !0, ref: !0, __self: !0, __source: !0 };
  function o(a, c, l) {
    var u, h = {}, d = null, f = null;
    l !== void 0 && (d = "" + l), c.key !== void 0 && (d = "" + c.key), c.ref !== void 0 && (f = c.ref);
    for (u in c) s.call(c, u) && !r.hasOwnProperty(u) && (h[u] = c[u]);
    if (a && a.defaultProps) for (u in c = a.defaultProps, c) h[u] === void 0 && (h[u] = c[u]);
    return { $$typeof: t, type: a, key: d, ref: f, props: h, _owner: i.current };
  }
  return wi.Fragment = e, wi.jsx = o, wi.jsxs = o, wi;
}
var Ci = {};
var El;
function lp() {
  return El || (El = 1, process.env.NODE_ENV !== "production" && (function() {
    var n = Kt, t = Symbol.for("react.element"), e = Symbol.for("react.portal"), s = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), r = Symbol.for("react.profiler"), o = Symbol.for("react.provider"), a = Symbol.for("react.context"), c = Symbol.for("react.forward_ref"), l = Symbol.for("react.suspense"), u = Symbol.for("react.suspense_list"), h = Symbol.for("react.memo"), d = Symbol.for("react.lazy"), f = Symbol.for("react.offscreen"), p = Symbol.iterator, m = "@@iterator";
    function g(C) {
      if (C === null || typeof C != "object")
        return null;
      var V = p && C[p] || C[m];
      return typeof V == "function" ? V : null;
    }
    var _ = n.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    function v(C) {
      {
        for (var V = arguments.length, U = new Array(V > 1 ? V - 1 : 0), ft = 1; ft < V; ft++)
          U[ft - 1] = arguments[ft];
        x("error", C, U);
      }
    }
    function x(C, V, U) {
      {
        var ft = _.ReactDebugCurrentFrame, yt = ft.getStackAddendum();
        yt !== "" && (V += "%s", U = U.concat([yt]));
        var Rt = U.map(function(It) {
          return String(It);
        });
        Rt.unshift("Warning: " + V), Function.prototype.apply.call(console[C], console, Rt);
      }
    }
    var T = !1, y = !1, w = !1, S = !1, b = !1, O;
    O = Symbol.for("react.module.reference");
    function D(C) {
      return !!(typeof C == "string" || typeof C == "function" || C === s || C === r || b || C === i || C === l || C === u || S || C === f || T || y || w || typeof C == "object" && C !== null && (C.$$typeof === d || C.$$typeof === h || C.$$typeof === o || C.$$typeof === a || C.$$typeof === c || // This needs to include all possible module reference object
      // types supported by any Flight configuration anywhere since
      // we don't know which Flight build this will end up being used
      // with.
      C.$$typeof === O || C.getModuleId !== void 0));
    }
    function k(C, V, U) {
      var ft = C.displayName;
      if (ft)
        return ft;
      var yt = V.displayName || V.name || "";
      return yt !== "" ? U + "(" + yt + ")" : U;
    }
    function I(C) {
      return C.displayName || "Context";
    }
    function N(C) {
      if (C == null)
        return null;
      if (typeof C.tag == "number" && v("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), typeof C == "function")
        return C.displayName || C.name || null;
      if (typeof C == "string")
        return C;
      switch (C) {
        case s:
          return "Fragment";
        case e:
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
      if (typeof C == "object")
        switch (C.$$typeof) {
          case a:
            var V = C;
            return I(V) + ".Consumer";
          case o:
            var U = C;
            return I(U._context) + ".Provider";
          case c:
            return k(C, C.render, "ForwardRef");
          case h:
            var ft = C.displayName || null;
            return ft !== null ? ft : N(C.type) || "Memo";
          case d: {
            var yt = C, Rt = yt._payload, It = yt._init;
            try {
              return N(It(Rt));
            } catch {
              return null;
            }
          }
        }
      return null;
    }
    var F = Object.assign, $ = 0, L, q, tt, j, E, R, B;
    function Q() {
    }
    Q.__reactDisabledLog = !0;
    function K() {
      {
        if ($ === 0) {
          L = console.log, q = console.info, tt = console.warn, j = console.error, E = console.group, R = console.groupCollapsed, B = console.groupEnd;
          var C = {
            configurable: !0,
            enumerable: !0,
            value: Q,
            writable: !0
          };
          Object.defineProperties(console, {
            info: C,
            log: C,
            warn: C,
            error: C,
            group: C,
            groupCollapsed: C,
            groupEnd: C
          });
        }
        $++;
      }
    }
    function z() {
      {
        if ($--, $ === 0) {
          var C = {
            configurable: !0,
            enumerable: !0,
            writable: !0
          };
          Object.defineProperties(console, {
            log: F({}, C, {
              value: L
            }),
            info: F({}, C, {
              value: q
            }),
            warn: F({}, C, {
              value: tt
            }),
            error: F({}, C, {
              value: j
            }),
            group: F({}, C, {
              value: E
            }),
            groupCollapsed: F({}, C, {
              value: R
            }),
            groupEnd: F({}, C, {
              value: B
            })
          });
        }
        $ < 0 && v("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
      }
    }
    var H = _.ReactCurrentDispatcher, st;
    function M(C, V, U) {
      {
        if (st === void 0)
          try {
            throw Error();
          } catch (yt) {
            var ft = yt.stack.trim().match(/\n( *(at )?)/);
            st = ft && ft[1] || "";
          }
        return `
` + st + C;
      }
    }
    var ct = !1, et;
    {
      var Tt = typeof WeakMap == "function" ? WeakMap : Map;
      et = new Tt();
    }
    function Y(C, V) {
      if (!C || ct)
        return "";
      {
        var U = et.get(C);
        if (U !== void 0)
          return U;
      }
      var ft;
      ct = !0;
      var yt = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      var Rt;
      Rt = H.current, H.current = null, K();
      try {
        if (V) {
          var It = function() {
            throw Error();
          };
          if (Object.defineProperty(It.prototype, "props", {
            set: function() {
              throw Error();
            }
          }), typeof Reflect == "object" && Reflect.construct) {
            try {
              Reflect.construct(It, []);
            } catch (Fe) {
              ft = Fe;
            }
            Reflect.construct(C, [], It);
          } else {
            try {
              It.call();
            } catch (Fe) {
              ft = Fe;
            }
            C.call(It.prototype);
          }
        } else {
          try {
            throw Error();
          } catch (Fe) {
            ft = Fe;
          }
          C();
        }
      } catch (Fe) {
        if (Fe && ft && typeof Fe.stack == "string") {
          for (var St = Fe.stack.split(`
`), ke = ft.stack.split(`
`), ee = St.length - 1, ie = ke.length - 1; ee >= 1 && ie >= 0 && St[ee] !== ke[ie]; )
            ie--;
          for (; ee >= 1 && ie >= 0; ee--, ie--)
            if (St[ee] !== ke[ie]) {
              if (ee !== 1 || ie !== 1)
                do
                  if (ee--, ie--, ie < 0 || St[ee] !== ke[ie]) {
                    var Qe = `
` + St[ee].replace(" at new ", " at ");
                    return C.displayName && Qe.includes("<anonymous>") && (Qe = Qe.replace("<anonymous>", C.displayName)), typeof C == "function" && et.set(C, Qe), Qe;
                  }
                while (ee >= 1 && ie >= 0);
              break;
            }
        }
      } finally {
        ct = !1, H.current = Rt, z(), Error.prepareStackTrace = yt;
      }
      var Ns = C ? C.displayName || C.name : "", ds = Ns ? M(Ns) : "";
      return typeof C == "function" && et.set(C, ds), ds;
    }
    function te(C, V, U) {
      return Y(C, !1);
    }
    function Ut(C) {
      var V = C.prototype;
      return !!(V && V.isReactComponent);
    }
    function Z(C, V, U) {
      if (C == null)
        return "";
      if (typeof C == "function")
        return Y(C, Ut(C));
      if (typeof C == "string")
        return M(C);
      switch (C) {
        case l:
          return M("Suspense");
        case u:
          return M("SuspenseList");
      }
      if (typeof C == "object")
        switch (C.$$typeof) {
          case c:
            return te(C.render);
          case h:
            return Z(C.type, V, U);
          case d: {
            var ft = C, yt = ft._payload, Rt = ft._init;
            try {
              return Z(Rt(yt), V, U);
            } catch {
            }
          }
        }
      return "";
    }
    var rt = Object.prototype.hasOwnProperty, Wt = {}, kt = _.ReactDebugCurrentFrame;
    function bt(C) {
      if (C) {
        var V = C._owner, U = Z(C.type, C._source, V ? V.type : null);
        kt.setExtraStackFrame(U);
      } else
        kt.setExtraStackFrame(null);
    }
    function Ft(C, V, U, ft, yt) {
      {
        var Rt = Function.call.bind(rt);
        for (var It in C)
          if (Rt(C, It)) {
            var St = void 0;
            try {
              if (typeof C[It] != "function") {
                var ke = Error((ft || "React class") + ": " + U + " type `" + It + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof C[It] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                throw ke.name = "Invariant Violation", ke;
              }
              St = C[It](V, It, ft, U, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
            } catch (ee) {
              St = ee;
            }
            St && !(St instanceof Error) && (bt(yt), v("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", ft || "React class", U, It, typeof St), bt(null)), St instanceof Error && !(St.message in Wt) && (Wt[St.message] = !0, bt(yt), v("Failed %s type: %s", U, St.message), bt(null));
          }
      }
    }
    var ue = Array.isArray;
    function he(C) {
      return ue(C);
    }
    function Te(C) {
      {
        var V = typeof Symbol == "function" && Symbol.toStringTag, U = V && C[Symbol.toStringTag] || C.constructor.name || "Object";
        return U;
      }
    }
    function Pe(C) {
      try {
        return zn(C), !1;
      } catch {
        return !0;
      }
    }
    function zn(C) {
      return "" + C;
    }
    function us(C) {
      if (Pe(C))
        return v("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", Te(C)), zn(C);
    }
    var dt = _.ReactCurrentOwner, ot = {
      key: !0,
      ref: !0,
      __self: !0,
      __source: !0
    }, Ot, Lt;
    function Ht(C) {
      if (rt.call(C, "ref")) {
        var V = Object.getOwnPropertyDescriptor(C, "ref").get;
        if (V && V.isReactWarning)
          return !1;
      }
      return C.ref !== void 0;
    }
    function qt(C) {
      if (rt.call(C, "key")) {
        var V = Object.getOwnPropertyDescriptor(C, "key").get;
        if (V && V.isReactWarning)
          return !1;
      }
      return C.key !== void 0;
    }
    function me(C, V) {
      typeof C.ref == "string" && dt.current;
    }
    function rn(C, V) {
      {
        var U = function() {
          Ot || (Ot = !0, v("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", V));
        };
        U.isReactWarning = !0, Object.defineProperty(C, "key", {
          get: U,
          configurable: !0
        });
      }
    }
    function kn(C, V) {
      {
        var U = function() {
          Lt || (Lt = !0, v("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", V));
        };
        U.isReactWarning = !0, Object.defineProperty(C, "ref", {
          get: U,
          configurable: !0
        });
      }
    }
    var on = function(C, V, U, ft, yt, Rt, It) {
      var St = {
        // This tag allows us to uniquely identify this as a React Element
        $$typeof: t,
        // Built-in properties that belong on the element
        type: C,
        key: V,
        ref: U,
        props: It,
        // Record the component responsible for creating this element.
        _owner: Rt
      };
      return St._store = {}, Object.defineProperty(St._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: !1
      }), Object.defineProperty(St, "_self", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: ft
      }), Object.defineProperty(St, "_source", {
        configurable: !1,
        enumerable: !1,
        writable: !1,
        value: yt
      }), Object.freeze && (Object.freeze(St.props), Object.freeze(St)), St;
    };
    function He(C, V, U, ft, yt) {
      {
        var Rt, It = {}, St = null, ke = null;
        U !== void 0 && (us(U), St = "" + U), qt(V) && (us(V.key), St = "" + V.key), Ht(V) && (ke = V.ref, me(V, yt));
        for (Rt in V)
          rt.call(V, Rt) && !ot.hasOwnProperty(Rt) && (It[Rt] = V[Rt]);
        if (C && C.defaultProps) {
          var ee = C.defaultProps;
          for (Rt in ee)
            It[Rt] === void 0 && (It[Rt] = ee[Rt]);
        }
        if (St || ke) {
          var ie = typeof C == "function" ? C.displayName || C.name || "Unknown" : C;
          St && rn(It, ie), ke && kn(It, ie);
        }
        return on(C, St, ke, yt, ft, dt.current, It);
      }
    }
    var In = _.ReactCurrentOwner, vi = _.ReactDebugCurrentFrame;
    function an(C) {
      if (C) {
        var V = C._owner, U = Z(C.type, C._source, V ? V.type : null);
        vi.setExtraStackFrame(U);
      } else
        vi.setExtraStackFrame(null);
    }
    var hs;
    hs = !1;
    function Ms(C) {
      return typeof C == "object" && C !== null && C.$$typeof === t;
    }
    function gr() {
      {
        if (In.current) {
          var C = N(In.current.type);
          if (C)
            return `

Check the render method of \`` + C + "`.";
        }
        return "";
      }
    }
    function _r(C) {
      return "";
    }
    var bi = {};
    function yr(C) {
      {
        var V = gr();
        if (!V) {
          var U = typeof C == "string" ? C : C.displayName || C.name;
          U && (V = `

Check the top-level render call using <` + U + ">.");
        }
        return V;
      }
    }
    function xi(C, V) {
      {
        if (!C._store || C._store.validated || C.key != null)
          return;
        C._store.validated = !0;
        var U = yr(V);
        if (bi[U])
          return;
        bi[U] = !0;
        var ft = "";
        C && C._owner && C._owner !== In.current && (ft = " It was passed a child from " + N(C._owner.type) + "."), an(C), v('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', U, ft), an(null);
      }
    }
    function vr(C, V) {
      {
        if (typeof C != "object")
          return;
        if (he(C))
          for (var U = 0; U < C.length; U++) {
            var ft = C[U];
            Ms(ft) && xi(ft, V);
          }
        else if (Ms(C))
          C._store && (C._store.validated = !0);
        else if (C) {
          var yt = g(C);
          if (typeof yt == "function" && yt !== C.entries)
            for (var Rt = yt.call(C), It; !(It = Rt.next()).done; )
              Ms(It.value) && xi(It.value, V);
        }
      }
    }
    function Io(C) {
      {
        var V = C.type;
        if (V == null || typeof V == "string")
          return;
        var U;
        if (typeof V == "function")
          U = V.propTypes;
        else if (typeof V == "object" && (V.$$typeof === c || // Note: Memo only checks outer props here.
        // Inner props are checked in the reconciler.
        V.$$typeof === h))
          U = V.propTypes;
        else
          return;
        if (U) {
          var ft = N(V);
          Ft(U, C.props, "prop", ft, C);
        } else if (V.PropTypes !== void 0 && !hs) {
          hs = !0;
          var yt = N(V);
          v("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", yt || "Unknown");
        }
        typeof V.getDefaultProps == "function" && !V.getDefaultProps.isReactClassApproved && v("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
      }
    }
    function lt(C) {
      {
        for (var V = Object.keys(C.props), U = 0; U < V.length; U++) {
          var ft = V[U];
          if (ft !== "children" && ft !== "key") {
            an(C), v("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", ft), an(null);
            break;
          }
        }
        C.ref !== null && (an(C), v("Invalid attribute `ref` supplied to `React.Fragment`."), an(null));
      }
    }
    var gt = {};
    function _t(C, V, U, ft, yt, Rt) {
      {
        var It = D(C);
        if (!It) {
          var St = "";
          (C === void 0 || typeof C == "object" && C !== null && Object.keys(C).length === 0) && (St += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.");
          var ke = _r();
          ke ? St += ke : St += gr();
          var ee;
          C === null ? ee = "null" : he(C) ? ee = "array" : C !== void 0 && C.$$typeof === t ? (ee = "<" + (N(C.type) || "Unknown") + " />", St = " Did you accidentally export a JSX literal instead of a component?") : ee = typeof C, v("React.jsx: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", ee, St);
        }
        var ie = He(C, V, U, yt, Rt);
        if (ie == null)
          return ie;
        if (It) {
          var Qe = V.children;
          if (Qe !== void 0)
            if (ft)
              if (he(Qe)) {
                for (var Ns = 0; Ns < Qe.length; Ns++)
                  vr(Qe[Ns], C);
                Object.freeze && Object.freeze(Qe);
              } else
                v("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
            else
              vr(Qe, C);
        }
        if (rt.call(V, "key")) {
          var ds = N(C), Fe = Object.keys(V).filter(function(sp) {
            return sp !== "key";
          }), Eo = Fe.length > 0 ? "{key: someKey, " + Fe.join(": ..., ") + ": ...}" : "{key: someKey}";
          if (!gt[ds + Eo]) {
            var np = Fe.length > 0 ? "{" + Fe.join(": ..., ") + ": ...}" : "{}";
            v(`A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`, Eo, ds, np, ds), gt[ds + Eo] = !0;
          }
        }
        return C === s ? lt(ie) : Io(ie), ie;
      }
    }
    function Mt(C, V, U) {
      return _t(C, V, U, !0);
    }
    function ut(C, V, U) {
      return _t(C, V, U, !1);
    }
    var Ae = ut, Ke = Mt;
    Ci.Fragment = s, Ci.jsx = Ae, Ci.jsxs = Ke;
  })()), Ci;
}
var Dl;
function up() {
  return Dl || (Dl = 1, process.env.NODE_ENV === "production" ? br.exports = cp() : br.exports = lp()), br.exports;
}
var A = up(), Ps = {}, Ol;
function hp() {
  if (Ol) return Ps;
  Ol = 1;
  var n = op;
  if (process.env.NODE_ENV === "production")
    Ps.createRoot = n.createRoot, Ps.hydrateRoot = n.hydrateRoot;
  else {
    var t = n.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    Ps.createRoot = function(e, s) {
      t.usingClientEntryPoint = !0;
      try {
        return n.createRoot(e, s);
      } finally {
        t.usingClientEntryPoint = !1;
      }
    }, Ps.hydrateRoot = function(e, s, i) {
      t.usingClientEntryPoint = !0;
      try {
        return n.hydrateRoot(e, s, i);
      } finally {
        t.usingClientEntryPoint = !1;
      }
    };
  }
  return Ps;
}
var dp = hp();
const ja = "15.1.22", Rl = (n, t, e) => ({ endTime: t, insertTime: e, type: "exponentialRampToValue", value: n }), Ml = (n, t, e) => ({ endTime: t, insertTime: e, type: "linearRampToValue", value: n }), Qo = (n, t) => ({ startTime: t, type: "setValue", value: n }), Sh = (n, t, e) => ({ duration: e, startTime: t, type: "setValueCurve", values: n }), Th = (n, t, { startTime: e, target: s, timeConstant: i }) => s + (t - s) * Math.exp((e - n) / i), js = (n) => n.type === "exponentialRampToValue", Pr = (n) => n.type === "linearRampToValue", Yn = (n) => js(n) || Pr(n), La = (n) => n.type === "setValue", Dn = (n) => n.type === "setValueCurve", Fr = (n, t, e, s) => {
  const i = n[t];
  return i === void 0 ? s : Yn(i) || La(i) ? i.value : Dn(i) ? i.values[i.values.length - 1] : Th(e, Fr(n, t - 1, i.startTime, s), i);
}, Nl = (n, t, e, s, i) => e === void 0 ? [s.insertTime, i] : Yn(e) ? [e.endTime, e.value] : La(e) ? [e.startTime, e.value] : Dn(e) ? [
  e.startTime + e.duration,
  e.values[e.values.length - 1]
] : [
  e.startTime,
  Fr(n, t - 1, e.startTime, i)
], Jo = (n) => n.type === "cancelAndHold", ta = (n) => n.type === "cancelScheduledValues", Gn = (n) => Jo(n) || ta(n) ? n.cancelTime : js(n) || Pr(n) ? n.endTime : n.startTime, Pl = (n, t, e, { endTime: s, value: i }) => e === i ? i : 0 < e && 0 < i || e < 0 && i < 0 ? e * (i / e) ** ((n - t) / (s - t)) : 0, Fl = (n, t, e, { endTime: s, value: i }) => e + (n - t) / (s - t) * (i - e), fp = (n, t) => {
  const e = Math.floor(t), s = Math.ceil(t);
  return e === s ? n[e] : (1 - (t - e)) * n[e] + (1 - (s - t)) * n[s];
}, pp = (n, { duration: t, startTime: e, values: s }) => {
  const i = (n - e) / t * (s.length - 1);
  return fp(s, i);
}, xr = (n) => n.type === "setTarget";
class mp {
  constructor(t) {
    this._automationEvents = [], this._currenTime = 0, this._defaultValue = t;
  }
  [Symbol.iterator]() {
    return this._automationEvents[Symbol.iterator]();
  }
  add(t) {
    const e = Gn(t);
    if (Jo(t) || ta(t)) {
      const s = this._automationEvents.findIndex((r) => ta(t) && Dn(r) ? r.startTime + r.duration >= e : Gn(r) >= e), i = this._automationEvents[s];
      if (s !== -1 && (this._automationEvents = this._automationEvents.slice(0, s)), Jo(t)) {
        const r = this._automationEvents[this._automationEvents.length - 1];
        if (i !== void 0 && Yn(i)) {
          if (r !== void 0 && xr(r))
            throw new Error("The internal list is malformed.");
          const o = r === void 0 ? i.insertTime : Dn(r) ? r.startTime + r.duration : Gn(r), a = r === void 0 ? this._defaultValue : Dn(r) ? r.values[r.values.length - 1] : r.value, c = js(i) ? Pl(e, o, a, i) : Fl(e, o, a, i), l = js(i) ? Rl(c, e, this._currenTime) : Ml(c, e, this._currenTime);
          this._automationEvents.push(l);
        }
        if (r !== void 0 && xr(r) && this._automationEvents.push(Qo(this.getValue(e), e)), r !== void 0 && Dn(r) && r.startTime + r.duration > e) {
          const o = e - r.startTime, a = (r.values.length - 1) / r.duration, c = Math.max(2, 1 + Math.ceil(o * a)), l = o / (c - 1) * a, u = r.values.slice(0, c);
          if (l < 1)
            for (let h = 1; h < c; h += 1) {
              const d = l * h % 1;
              u[h] = r.values[h - 1] * (1 - d) + r.values[h] * d;
            }
          this._automationEvents[this._automationEvents.length - 1] = Sh(u, r.startTime, o);
        }
      }
    } else {
      const s = this._automationEvents.findIndex((o) => Gn(o) > e), i = s === -1 ? this._automationEvents[this._automationEvents.length - 1] : this._automationEvents[s - 1];
      if (i !== void 0 && Dn(i) && Gn(i) + i.duration > e)
        return !1;
      const r = js(t) ? Rl(t.value, t.endTime, this._currenTime) : Pr(t) ? Ml(t.value, e, this._currenTime) : t;
      if (s === -1)
        this._automationEvents.push(r);
      else {
        if (Dn(t) && e + t.duration > Gn(this._automationEvents[s]))
          return !1;
        this._automationEvents.splice(s, 0, r);
      }
    }
    return !0;
  }
  flush(t) {
    const e = this._automationEvents.findIndex((s) => Gn(s) > t);
    if (e > 1) {
      const s = this._automationEvents.slice(e - 1), i = s[0];
      xr(i) && s.unshift(Qo(Fr(this._automationEvents, e - 2, i.startTime, this._defaultValue), i.startTime)), this._automationEvents = s;
    }
  }
  getValue(t) {
    if (this._automationEvents.length === 0)
      return this._defaultValue;
    const e = this._automationEvents.findIndex((o) => Gn(o) > t), s = this._automationEvents[e], i = (e === -1 ? this._automationEvents.length : e) - 1, r = this._automationEvents[i];
    if (r !== void 0 && xr(r) && (s === void 0 || !Yn(s) || s.insertTime > t))
      return Th(t, Fr(this._automationEvents, i - 1, r.startTime, this._defaultValue), r);
    if (r !== void 0 && La(r) && (s === void 0 || !Yn(s)))
      return r.value;
    if (r !== void 0 && Dn(r) && (s === void 0 || !Yn(s) || r.startTime + r.duration > t))
      return t < r.startTime + r.duration ? pp(t, r) : r.values[r.values.length - 1];
    if (r !== void 0 && Yn(r) && (s === void 0 || !Yn(s)))
      return r.value;
    if (s !== void 0 && js(s)) {
      const [o, a] = Nl(this._automationEvents, i, r, s, this._defaultValue);
      return Pl(t, o, a, s);
    }
    if (s !== void 0 && Pr(s)) {
      const [o, a] = Nl(this._automationEvents, i, r, s, this._defaultValue);
      return Fl(t, o, a, s);
    }
    return this._defaultValue;
  }
}
const gp = (n) => ({ cancelTime: n, type: "cancelAndHold" }), _p = (n) => ({ cancelTime: n, type: "cancelScheduledValues" }), yp = (n, t) => ({ endTime: t, type: "exponentialRampToValue", value: n }), vp = (n, t) => ({ endTime: t, type: "linearRampToValue", value: n }), bp = (n, t, e) => ({ startTime: t, target: n, timeConstant: e, type: "setTarget" }), xp = () => new DOMException("", "AbortError"), wp = (n) => (t, e, [s, i, r], o) => {
  n(t[i], [e, s, r], (a) => a[0] === e && a[1] === s, o);
}, Cp = (n) => (t, e, s) => {
  const i = [];
  for (let r = 0; r < s.numberOfInputs; r += 1)
    i.push(/* @__PURE__ */ new Set());
  n.set(t, {
    activeInputs: i,
    outputs: /* @__PURE__ */ new Set(),
    passiveInputs: /* @__PURE__ */ new WeakMap(),
    renderer: e
  });
}, Sp = (n) => (t, e) => {
  n.set(t, { activeInputs: /* @__PURE__ */ new Set(), passiveInputs: /* @__PURE__ */ new WeakMap(), renderer: e });
}, $s = /* @__PURE__ */ new WeakSet(), Ah = /* @__PURE__ */ new WeakMap(), qa = /* @__PURE__ */ new WeakMap(), kh = /* @__PURE__ */ new WeakMap(), Ba = /* @__PURE__ */ new WeakMap(), to = /* @__PURE__ */ new WeakMap(), Ih = /* @__PURE__ */ new WeakMap(), ea = /* @__PURE__ */ new WeakMap(), na = /* @__PURE__ */ new WeakMap(), sa = /* @__PURE__ */ new WeakMap(), Eh = {
  construct() {
    return Eh;
  }
}, Tp = (n) => {
  try {
    const t = new Proxy(n, Eh);
    new t();
  } catch {
    return !1;
  }
  return !0;
}, Vl = /^import(?:(?:[\s]+[\w]+|(?:[\s]+[\w]+[\s]*,)?[\s]*\{[\s]*[\w]+(?:[\s]+as[\s]+[\w]+)?(?:[\s]*,[\s]*[\w]+(?:[\s]+as[\s]+[\w]+)?)*[\s]*}|(?:[\s]+[\w]+[\s]*,)?[\s]*\*[\s]+as[\s]+[\w]+)[\s]+from)?(?:[\s]*)("([^"\\]|\\.)+"|'([^'\\]|\\.)+')(?:[\s]*);?/, Wl = (n, t) => {
  const e = [];
  let s = n.replace(/^[\s]+/, ""), i = s.match(Vl);
  for (; i !== null; ) {
    const r = i[1].slice(1, -1), o = i[0].replace(/([\s]+)?;?$/, "").replace(r, new URL(r, t).toString());
    e.push(o), s = s.slice(i[0].length).replace(/^[\s]+/, ""), i = s.match(Vl);
  }
  return [e.join(";"), s];
}, jl = (n) => {
  if (n !== void 0 && !Array.isArray(n))
    throw new TypeError("The parameterDescriptors property of given value for processorCtor is not an array.");
}, Ll = (n) => {
  if (!Tp(n))
    throw new TypeError("The given value for processorCtor should be a constructor.");
  if (n.prototype === null || typeof n.prototype != "object")
    throw new TypeError("The given value for processorCtor should have a prototype.");
}, Ap = (n, t, e, s, i, r, o, a, c, l, u, h, d) => {
  let f = 0;
  return (p, m, g = { credentials: "omit" }) => {
    const _ = u.get(p);
    if (_ !== void 0 && _.has(m))
      return Promise.resolve();
    const v = l.get(p);
    if (v !== void 0) {
      const y = v.get(m);
      if (y !== void 0)
        return y;
    }
    const x = r(p), T = x.audioWorklet === void 0 ? i(m).then(([y, w]) => {
      const [S, b] = Wl(y, w), O = `${S};((a,b)=>{(a[b]=a[b]||[]).push((AudioWorkletProcessor,global,registerProcessor,sampleRate,self,window)=>{${b}
})})(window,'_AWGS')`;
      return e(O);
    }).then(() => {
      const y = d._AWGS.pop();
      if (y === void 0)
        throw new SyntaxError();
      s(x.currentTime, x.sampleRate, () => y(class {
      }, void 0, (w, S) => {
        if (w.trim() === "")
          throw t();
        const b = na.get(x);
        if (b !== void 0) {
          if (b.has(w))
            throw t();
          Ll(S), jl(S.parameterDescriptors), b.set(w, S);
        } else
          Ll(S), jl(S.parameterDescriptors), na.set(x, /* @__PURE__ */ new Map([[w, S]]));
      }, x.sampleRate, void 0, void 0));
    }) : Promise.all([
      i(m),
      Promise.resolve(n(h, h))
    ]).then(([[y, w], S]) => {
      const b = f + 1;
      f = b;
      const [O, D] = Wl(y, w), F = `${O};((AudioWorkletProcessor,registerProcessor)=>{${D}
})(${S ? "AudioWorkletProcessor" : "class extends AudioWorkletProcessor {__b=new WeakSet();constructor(){super();(p=>p.postMessage=(q=>(m,t)=>q.call(p,m,t?t.filter(u=>!this.__b.has(u)):t))(p.postMessage))(this.port)}}"},(n,p)=>registerProcessor(n,class extends p{${S ? "" : "__c = (a) => a.forEach(e=>this.__b.add(e.buffer));"}process(i,o,p){${S ? "" : "i.forEach(this.__c);o.forEach(this.__c);this.__c(Object.values(p));"}return super.process(i.map(j=>j.some(k=>k.length===0)?[]:j),o,p)}}));registerProcessor('__sac${b}',class extends AudioWorkletProcessor{process(){return !1}})`, $ = new Blob([F], { type: "application/javascript; charset=utf-8" }), L = URL.createObjectURL($);
      return x.audioWorklet.addModule(L, g).then(() => {
        if (a(x))
          return x;
        const q = o(x);
        return q.audioWorklet.addModule(L, g).then(() => q);
      }).then((q) => {
        if (c === null)
          throw new SyntaxError();
        try {
          new c(q, `__sac${b}`);
        } catch {
          throw new SyntaxError();
        }
      }).finally(() => URL.revokeObjectURL(L));
    });
    return v === void 0 ? l.set(p, /* @__PURE__ */ new Map([[m, T]])) : v.set(m, T), T.then(() => {
      const y = u.get(p);
      y === void 0 ? u.set(p, /* @__PURE__ */ new Set([m])) : y.add(m);
    }).finally(() => {
      const y = l.get(p);
      y !== void 0 && y.delete(m);
    }), T;
  };
}, un = (n, t) => {
  const e = n.get(t);
  if (e === void 0)
    throw new Error("A value with the given key could not be found.");
  return e;
}, eo = (n, t) => {
  const e = Array.from(n).filter(t);
  if (e.length > 1)
    throw Error("More than one element was found.");
  if (e.length === 0)
    throw Error("No element was found.");
  const [s] = e;
  return n.delete(s), s;
}, Dh = (n, t, e, s) => {
  const i = un(n, t), r = eo(i, (o) => o[0] === e && o[1] === s);
  return i.size === 0 && n.delete(t), r;
}, zi = (n) => un(Ih, n), zs = (n) => {
  if ($s.has(n))
    throw new Error("The AudioNode is already stored.");
  $s.add(n), zi(n).forEach((t) => t(!0));
}, Oh = (n) => "port" in n, Gi = (n) => {
  if (!$s.has(n))
    throw new Error("The AudioNode is not stored.");
  $s.delete(n), zi(n).forEach((t) => t(!1));
}, ia = (n, t) => {
  !Oh(n) && t.every((e) => e.size === 0) && Gi(n);
}, kp = (n, t, e, s, i, r, o, a, c, l, u, h, d) => {
  const f = /* @__PURE__ */ new WeakMap();
  return (p, m, g, _, v) => {
    const { activeInputs: x, passiveInputs: T } = r(m), { outputs: y } = r(p), w = a(p), S = (b) => {
      const O = c(m), D = c(p);
      if (b) {
        const k = Dh(T, p, g, _);
        n(x, p, k, !1), !v && !h(p) && e(D, O, g, _), d(m) && zs(m);
      } else {
        const k = s(x, p, g, _);
        t(T, _, k, !1), !v && !h(p) && i(D, O, g, _);
        const I = o(m);
        if (I === 0)
          u(m) && ia(m, x);
        else {
          const N = f.get(m);
          N !== void 0 && clearTimeout(N), f.set(m, setTimeout(() => {
            u(m) && ia(m, x);
          }, I * 1e3));
        }
      }
    };
    return l(y, [m, g, _], (b) => b[0] === m && b[1] === g && b[2] === _, !0) ? (w.add(S), u(p) ? n(x, p, [g, _, S], !0) : t(T, _, [p, g, S], !0), !0) : !1;
  };
}, Ip = (n) => (t, e, [s, i, r], o) => {
  const a = t.get(s);
  a === void 0 ? t.set(s, /* @__PURE__ */ new Set([[i, e, r]])) : n(a, [i, e, r], (c) => c[0] === i && c[1] === e, o);
}, Ep = (n) => (t, e) => {
  const s = n(t, {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "discrete",
    gain: 0
  });
  e.connect(s).connect(t.destination);
  const i = () => {
    e.removeEventListener("ended", i), e.disconnect(s), s.disconnect();
  };
  e.addEventListener("ended", i);
}, Dp = (n) => (t, e) => {
  n(t).add(e);
}, Op = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  fftSize: 2048,
  maxDecibels: -30,
  minDecibels: -100,
  smoothingTimeConstant: 0.8
}, Rp = (n, t, e, s, i, r) => class extends n {
  constructor(a, c) {
    const l = i(a), u = { ...Op, ...c }, h = s(l, u), d = r(l) ? t() : null;
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
      throw this._nativeAnalyserNode.maxDecibels = c, e();
  }
  get minDecibels() {
    return this._nativeAnalyserNode.minDecibels;
  }
  set minDecibels(a) {
    const c = this._nativeAnalyserNode.minDecibels;
    if (this._nativeAnalyserNode.minDecibels = a, !(this._nativeAnalyserNode.maxDecibels > a))
      throw this._nativeAnalyserNode.minDecibels = c, e();
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
}, Se = (n, t) => n.context === t, Mp = (n, t, e) => () => {
  const s = /* @__PURE__ */ new WeakMap(), i = async (r, o) => {
    let a = t(r);
    if (!Se(a, o)) {
      const l = {
        channelCount: a.channelCount,
        channelCountMode: a.channelCountMode,
        channelInterpretation: a.channelInterpretation,
        fftSize: a.fftSize,
        maxDecibels: a.maxDecibels,
        minDecibels: a.minDecibels,
        smoothingTimeConstant: a.smoothingTimeConstant
      };
      a = n(o, l);
    }
    return s.set(o, a), await e(r, o, a), a;
  };
  return {
    render(r, o) {
      const a = s.get(o);
      return a !== void 0 ? Promise.resolve(a) : i(r, o);
    }
  };
}, Vr = (n) => {
  try {
    n.copyToChannel(new Float32Array(1), 0, -1);
  } catch {
    return !1;
  }
  return !0;
}, wn = () => new DOMException("", "IndexSizeError"), $a = (n) => {
  n.getChannelData = /* @__PURE__ */ ((t) => (e) => {
    try {
      return t.call(n, e);
    } catch (s) {
      throw s.code === 12 ? wn() : s;
    }
  })(n.getChannelData);
}, Np = {
  numberOfChannels: 1
}, Pp = (n, t, e, s, i, r, o, a) => {
  let c = null;
  return class Rh {
    constructor(u) {
      if (i === null)
        throw new Error("Missing the native OfflineAudioContext constructor.");
      const { length: h, numberOfChannels: d, sampleRate: f } = { ...Np, ...u };
      c === null && (c = new i(1, 1, 44100));
      const p = s !== null && t(r, r) ? new s({ length: h, numberOfChannels: d, sampleRate: f }) : c.createBuffer(d, h, f);
      if (p.numberOfChannels === 0)
        throw e();
      return typeof p.copyFromChannel != "function" ? (o(p), $a(p)) : t(Vr, () => Vr(p)) || a(p), n.add(p), p;
    }
    static [Symbol.hasInstance](u) {
      return u !== null && typeof u == "object" && Object.getPrototypeOf(u) === Rh.prototype || n.has(u);
    }
  };
}, Ve = -34028234663852886e22, Ie = -Ve, Mn = (n) => $s.has(n), Fp = {
  buffer: null,
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  // Bug #149: Safari does not yet support the detune AudioParam.
  loop: !1,
  loopEnd: 0,
  loopStart: 0,
  playbackRate: 1
}, Vp = (n, t, e, s, i, r, o, a) => class extends n {
  constructor(l, u) {
    const h = r(l), d = { ...Fp, ...u }, f = i(h, d), p = o(h), m = p ? t() : null;
    super(l, !1, f, m), this._audioBufferSourceNodeRenderer = m, this._isBufferNullified = !1, this._isBufferSet = d.buffer !== null, this._nativeAudioBufferSourceNode = f, this._onended = null, this._playbackRate = e(this, p, f.playbackRate, Ie, Ve);
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
      zs(this);
      const d = () => {
        this._nativeAudioBufferSourceNode.removeEventListener("ended", d), Mn(this) && Gi(this);
      };
      this._nativeAudioBufferSourceNode.addEventListener("ended", d);
    }
  }
  stop(l = 0) {
    this._nativeAudioBufferSourceNode.stop(l), this._audioBufferSourceNodeRenderer !== null && (this._audioBufferSourceNodeRenderer.stop = l);
  }
}, Wp = (n, t, e, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap();
  let o = null, a = null;
  const c = async (l, u) => {
    let h = e(l);
    const d = Se(h, u);
    if (!d) {
      const f = {
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
      h = t(u, f), o !== null && h.start(...o), a !== null && h.stop(a);
    }
    return r.set(u, h), d ? await n(u, l.playbackRate, h.playbackRate) : await s(u, l.playbackRate, h.playbackRate), await i(l, u, h), h;
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
}, jp = (n) => "playbackRate" in n, Lp = (n) => "frequency" in n && "gain" in n, qp = (n) => "offset" in n, Bp = (n) => !("frequency" in n) && "gain" in n, $p = (n) => "detune" in n && "frequency" in n && !("gain" in n), zp = (n) => "pan" in n, De = (n) => un(Ah, n), Zi = (n) => un(kh, n), ra = (n, t) => {
  const { activeInputs: e } = De(n);
  e.forEach((i) => i.forEach(([r]) => {
    t.includes(n) || ra(r, [...t, n]);
  }));
  const s = jp(n) ? [
    // Bug #149: Safari does not yet support the detune AudioParam.
    n.playbackRate
  ] : Oh(n) ? Array.from(n.parameters.values()) : Lp(n) ? [n.Q, n.detune, n.frequency, n.gain] : qp(n) ? [n.offset] : Bp(n) ? [n.gain] : $p(n) ? [n.detune, n.frequency] : zp(n) ? [n.pan] : [];
  for (const i of s) {
    const r = Zi(i);
    r !== void 0 && r.activeInputs.forEach(([o]) => ra(o, t));
  }
  Mn(n) && Gi(n);
}, Mh = (n) => {
  ra(n.destination, []);
}, Gp = (n) => n === void 0 || typeof n == "number" || typeof n == "string" && (n === "balanced" || n === "interactive" || n === "playback"), Zp = (n, t, e, s, i, r, o, a, c) => class extends n {
  constructor(u = {}) {
    if (c === null)
      throw new Error("Missing the native AudioContext constructor.");
    let h;
    try {
      h = new c(u);
    } catch (p) {
      throw p.code === 12 && p.message === "sampleRate is not in range" ? e() : p;
    }
    if (h === null)
      throw s();
    if (!Gp(u.latencyHint))
      throw new TypeError(`The provided value '${u.latencyHint}' is not a valid enum value of type AudioContextLatencyCategory.`);
    if (u.sampleRate !== void 0 && h.sampleRate !== u.sampleRate)
      throw e();
    super(h, 2);
    const { latencyHint: d } = u, { sampleRate: f } = h;
    if (this._baseLatency = typeof h.baseLatency == "number" ? h.baseLatency : d === "balanced" ? 512 / f : d === "interactive" || d === void 0 ? 256 / f : d === "playback" ? 1024 / f : (
      /*
       * @todo The min (256) and max (16384) values are taken from the allowed bufferSize values of a
       * ScriptProcessorNode.
       */
      Math.max(2, Math.min(128, Math.round(d * f / 128))) * 128 / f
    ), this._nativeAudioContext = h, c.name === "webkitAudioContext" ? (this._nativeGainNode = h.createGain(), this._nativeOscillatorNode = h.createOscillator(), this._nativeGainNode.gain.value = 1e-37, this._nativeOscillatorNode.connect(this._nativeGainNode).connect(h.destination), this._nativeOscillatorNode.start()) : (this._nativeGainNode = null, this._nativeOscillatorNode = null), this._state = null, h.state === "running") {
      this._state = "suspended";
      const p = () => {
        this._state === "suspended" && (this._state = null), h.removeEventListener("statechange", p);
      };
      h.addEventListener("statechange", p);
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
      this._nativeGainNode !== null && this._nativeOscillatorNode !== null && (this._nativeOscillatorNode.stop(), this._nativeGainNode.disconnect(), this._nativeOscillatorNode.disconnect()), Mh(this);
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
}, Yp = (n, t, e, s, i, r, o, a) => class extends n {
  constructor(l, u) {
    const h = r(l), d = o(h), f = i(h, u, d), p = d ? t(a) : null;
    super(l, !1, f, p), this._isNodeOfNativeOfflineAudioContext = d, this._nativeAudioDestinationNode = f;
  }
  get channelCount() {
    return this._nativeAudioDestinationNode.channelCount;
  }
  set channelCount(l) {
    if (this._isNodeOfNativeOfflineAudioContext)
      throw s();
    if (l > this._nativeAudioDestinationNode.maxChannelCount)
      throw e();
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
}, Xp = (n) => {
  const t = /* @__PURE__ */ new WeakMap(), e = async (s, i) => {
    const r = i.destination;
    return t.set(i, r), await n(s, i, r), r;
  };
  return {
    render(s, i) {
      const r = t.get(i);
      return r !== void 0 ? Promise.resolve(r) : e(s, i);
    }
  };
}, Up = (n, t, e, s, i, r, o, a) => (c, l) => {
  const u = l.listener, h = () => {
    const y = new Float32Array(1), w = t(l, {
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      numberOfInputs: 9
    }), S = o(l);
    let b = !1, O = [0, 0, -1, 0, 1, 0], D = [0, 0, 0];
    const k = () => {
      if (b)
        return;
      b = !0;
      const $ = s(l, 256, 9, 0);
      $.onaudioprocess = ({ inputBuffer: L }) => {
        const q = [
          r(L, y, 0),
          r(L, y, 1),
          r(L, y, 2),
          r(L, y, 3),
          r(L, y, 4),
          r(L, y, 5)
        ];
        q.some((j, E) => j !== O[E]) && (u.setOrientation(...q), O = q);
        const tt = [
          r(L, y, 6),
          r(L, y, 7),
          r(L, y, 8)
        ];
        tt.some((j, E) => j !== D[E]) && (u.setPosition(...tt), D = tt);
      }, w.connect($);
    }, I = ($) => (L) => {
      L !== O[$] && (O[$] = L, u.setOrientation(...O));
    }, N = ($) => (L) => {
      L !== D[$] && (D[$] = L, u.setPosition(...D));
    }, F = ($, L, q) => {
      const tt = e(l, {
        channelCount: 1,
        channelCountMode: "explicit",
        channelInterpretation: "discrete",
        offset: L
      });
      tt.connect(w, 0, $), tt.start(), Object.defineProperty(tt.offset, "defaultValue", {
        get() {
          return L;
        }
      });
      const j = n({ context: c }, S, tt.offset, Ie, Ve);
      return a(j, "value", (E) => () => E.call(j), (E) => (R) => {
        try {
          E.call(j, R);
        } catch (B) {
          if (B.code !== 9)
            throw B;
        }
        k(), S && q(R);
      }), j.cancelAndHoldAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...R) => {
        const B = E.apply(j, R);
        return k(), B;
      })(j.cancelAndHoldAtTime), j.cancelScheduledValues = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...R) => {
        const B = E.apply(j, R);
        return k(), B;
      })(j.cancelScheduledValues), j.exponentialRampToValueAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...R) => {
        const B = E.apply(j, R);
        return k(), B;
      })(j.exponentialRampToValueAtTime), j.linearRampToValueAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...R) => {
        const B = E.apply(j, R);
        return k(), B;
      })(j.linearRampToValueAtTime), j.setTargetAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...R) => {
        const B = E.apply(j, R);
        return k(), B;
      })(j.setTargetAtTime), j.setValueAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...R) => {
        const B = E.apply(j, R);
        return k(), B;
      })(j.setValueAtTime), j.setValueCurveAtTime = /* @__PURE__ */ ((E) => S ? () => {
        throw i();
      } : (...R) => {
        const B = E.apply(j, R);
        return k(), B;
      })(j.setValueCurveAtTime), j;
    };
    return {
      forwardX: F(0, 0, I(0)),
      forwardY: F(1, 0, I(1)),
      forwardZ: F(2, -1, I(2)),
      positionX: F(6, 0, N(0)),
      positionY: F(7, 0, N(1)),
      positionZ: F(8, 0, N(2)),
      upX: F(3, 0, I(3)),
      upY: F(4, 1, I(4)),
      upZ: F(5, 0, I(5))
    };
  }, { forwardX: d, forwardY: f, forwardZ: p, positionX: m, positionY: g, positionZ: _, upX: v, upY: x, upZ: T } = u.forwardX === void 0 ? h() : u;
  return {
    get forwardX() {
      return d;
    },
    get forwardY() {
      return f;
    },
    get forwardZ() {
      return p;
    },
    get positionX() {
      return m;
    },
    get positionY() {
      return g;
    },
    get positionZ() {
      return _;
    },
    get upX() {
      return v;
    },
    get upY() {
      return x;
    },
    get upZ() {
      return T;
    }
  };
}, Wr = (n) => "context" in n, Yi = (n) => Wr(n[0]), Cs = (n, t, e, s) => {
  for (const i of n)
    if (e(i)) {
      if (s)
        return !1;
      throw Error("The set contains at least one similar element.");
    }
  return n.add(t), !0;
}, ql = (n, t, [e, s], i) => {
  Cs(n, [t, e, s], (r) => r[0] === t && r[1] === e, i);
}, Bl = (n, [t, e, s], i) => {
  const r = n.get(t);
  r === void 0 ? n.set(t, /* @__PURE__ */ new Set([[e, s]])) : Cs(r, [e, s], (o) => o[0] === e, i);
}, Js = (n) => "inputs" in n, jr = (n, t, e, s) => {
  if (Js(t)) {
    const i = t.inputs[s];
    return n.connect(i, e, 0), [i, e, 0];
  }
  return n.connect(t, e, s), [t, e, s];
}, Nh = (n, t, e) => {
  for (const s of n)
    if (s[0] === t && s[1] === e)
      return n.delete(s), s;
  return null;
}, Hp = (n, t, e) => eo(n, (s) => s[0] === t && s[1] === e), Ph = (n, t) => {
  if (!zi(n).delete(t))
    throw new Error("Missing the expected event listener.");
}, Fh = (n, t, e) => {
  const s = un(n, t), i = eo(s, (r) => r[0] === e);
  return s.size === 0 && n.delete(t), i;
}, Lr = (n, t, e, s) => {
  Js(t) ? n.disconnect(t.inputs[s], e, 0) : n.disconnect(t, e, s);
}, zt = (n) => un(qa, n), Mi = (n) => un(Ba, n), vs = (n) => ea.has(n), Er = (n) => !$s.has(n), $l = (n, t) => new Promise((e) => {
  if (t !== null)
    e(!0);
  else {
    const s = n.createScriptProcessor(256, 1, 1), i = n.createGain(), r = n.createBuffer(1, 2, 44100), o = r.getChannelData(0);
    o[0] = 1, o[1] = 1;
    const a = n.createBufferSource();
    a.buffer = r, a.loop = !0, a.connect(s).connect(n.destination), a.connect(i), a.disconnect(i), s.onaudioprocess = (c) => {
      const l = c.inputBuffer.getChannelData(0);
      Array.prototype.some.call(l, (u) => u === 1) ? e(!0) : e(!1), a.stop(), s.onaudioprocess = null, a.disconnect(s), s.disconnect(n.destination);
    }, a.start();
  }
}), Do = (n, t) => {
  const e = /* @__PURE__ */ new Map();
  for (const s of n)
    for (const i of s) {
      const r = e.get(i);
      e.set(i, r === void 0 ? 1 : r + 1);
    }
  e.forEach((s, i) => t(i, s));
}, qr = (n) => "context" in n, Kp = (n) => {
  const t = /* @__PURE__ */ new Map();
  n.connect = /* @__PURE__ */ ((e) => (s, i = 0, r = 0) => {
    const o = qr(s) ? e(s, i, r) : e(s, i), a = t.get(s);
    return a === void 0 ? t.set(s, [{ input: r, output: i }]) : a.every((c) => c.input !== r || c.output !== i) && a.push({ input: r, output: i }), o;
  })(n.connect.bind(n)), n.disconnect = /* @__PURE__ */ ((e) => (s, i, r) => {
    if (e.apply(n), s === void 0)
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
        qr(o) ? n.connect(o, c.output, c.input) : n.connect(o, c.output);
      });
  })(n.disconnect);
}, Qp = (n, t, e, s) => {
  const { activeInputs: i, passiveInputs: r } = Zi(t), { outputs: o } = De(n), a = zi(n), c = (l) => {
    const u = zt(n), h = Mi(t);
    if (l) {
      const d = Fh(r, n, e);
      ql(i, n, d, !1), !s && !vs(n) && u.connect(h, e);
    } else {
      const d = Hp(i, n, e);
      Bl(r, d, !1), !s && !vs(n) && u.disconnect(h, e);
    }
  };
  return Cs(o, [t, e], (l) => l[0] === t && l[1] === e, !0) ? (a.add(c), Mn(n) ? ql(i, n, [e, c], !0) : Bl(r, [n, e, c], !0), !0) : !1;
}, Jp = (n, t, e, s) => {
  const { activeInputs: i, passiveInputs: r } = De(t), o = Nh(i[s], n, e);
  return o === null ? [Dh(r, n, e, s)[2], !1] : [o[2], !0];
}, tm = (n, t, e) => {
  const { activeInputs: s, passiveInputs: i } = Zi(t), r = Nh(s, n, e);
  return r === null ? [Fh(i, n, e)[1], !1] : [r[2], !0];
}, za = (n, t, e, s, i) => {
  const [r, o] = Jp(n, e, s, i);
  if (r !== null && (Ph(n, r), o && !t && !vs(n) && Lr(zt(n), zt(e), s, i)), Mn(e)) {
    const { activeInputs: a } = De(e);
    ia(e, a);
  }
}, Ga = (n, t, e, s) => {
  const [i, r] = tm(n, e, s);
  i !== null && (Ph(n, i), r && !t && !vs(n) && zt(n).disconnect(Mi(e), s));
}, em = (n, t) => {
  const e = De(n), s = [];
  for (const i of e.outputs)
    Yi(i) ? za(n, t, ...i) : Ga(n, t, ...i), s.push(i[0]);
  return e.outputs.clear(), s;
}, nm = (n, t, e) => {
  const s = De(n), i = [];
  for (const r of s.outputs)
    r[1] === e && (Yi(r) ? za(n, t, ...r) : Ga(n, t, ...r), i.push(r[0]), s.outputs.delete(r));
  return i;
}, sm = (n, t, e, s, i) => {
  const r = De(n);
  return Array.from(r.outputs).filter((o) => o[0] === e && (s === void 0 || o[1] === s) && (i === void 0 || o[2] === i)).map((o) => (Yi(o) ? za(n, t, ...o) : Ga(n, t, ...o), r.outputs.delete(o), o[0]));
}, im = (n, t, e, s, i, r, o, a, c, l, u, h, d, f, p, m) => class extends l {
  constructor(_, v, x, T) {
    super(x), this._context = _, this._nativeAudioNode = x;
    const y = u(_);
    h(y) && e($l, () => $l(y, m)) !== !0 && Kp(x), qa.set(this, x), Ih.set(this, /* @__PURE__ */ new Set()), _.state !== "closed" && v && zs(this), n(this, T, x);
  }
  get channelCount() {
    return this._nativeAudioNode.channelCount;
  }
  set channelCount(_) {
    this._nativeAudioNode.channelCount = _;
  }
  get channelCountMode() {
    return this._nativeAudioNode.channelCountMode;
  }
  set channelCountMode(_) {
    this._nativeAudioNode.channelCountMode = _;
  }
  get channelInterpretation() {
    return this._nativeAudioNode.channelInterpretation;
  }
  set channelInterpretation(_) {
    this._nativeAudioNode.channelInterpretation = _;
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
  connect(_, v = 0, x = 0) {
    if (v < 0 || v >= this._nativeAudioNode.numberOfOutputs)
      throw i();
    const T = u(this._context), y = p(T);
    if (d(_) || f(_))
      throw r();
    if (Wr(_)) {
      const b = zt(_);
      try {
        const D = jr(this._nativeAudioNode, b, v, x), k = Er(this);
        (y || k) && this._nativeAudioNode.disconnect(...D), this.context.state !== "closed" && !k && Er(_) && zs(_);
      } catch (D) {
        throw D.code === 12 ? r() : D;
      }
      if (t(this, _, v, x, y)) {
        const D = c([this], _);
        Do(D, s(y));
      }
      return _;
    }
    const w = Mi(_);
    if (w.name === "playbackRate" && w.maxValue === 1024)
      throw o();
    try {
      this._nativeAudioNode.connect(w, v), (y || Er(this)) && this._nativeAudioNode.disconnect(w, v);
    } catch (b) {
      throw b.code === 12 ? r() : b;
    }
    if (Qp(this, _, v, y)) {
      const b = c([this], _);
      Do(b, s(y));
    }
  }
  disconnect(_, v, x) {
    let T;
    const y = u(this._context), w = p(y);
    if (_ === void 0)
      T = em(this, w);
    else if (typeof _ == "number") {
      if (_ < 0 || _ >= this.numberOfOutputs)
        throw i();
      T = nm(this, w, _);
    } else {
      if (v !== void 0 && (v < 0 || v >= this.numberOfOutputs) || Wr(_) && x !== void 0 && (x < 0 || x >= _.numberOfInputs))
        throw i();
      if (T = sm(this, w, _, v, x), T.length === 0)
        throw r();
    }
    for (const S of T) {
      const b = c([this], S);
      Do(b, a);
    }
  }
}, rm = (n, t, e, s, i, r, o, a, c, l, u, h, d) => (f, p, m, g = null, _ = null) => {
  const v = m.value, x = new mp(v), T = p ? s(x) : null, y = {
    get defaultValue() {
      return v;
    },
    get maxValue() {
      return g === null ? m.maxValue : g;
    },
    get minValue() {
      return _ === null ? m.minValue : _;
    },
    get value() {
      return m.value;
    },
    set value(w) {
      m.value = w, y.setValueAtTime(w, f.context.currentTime);
    },
    cancelAndHoldAtTime(w) {
      if (typeof m.cancelAndHoldAtTime == "function")
        T === null && x.flush(f.context.currentTime), x.add(i(w)), m.cancelAndHoldAtTime(w);
      else {
        const S = Array.from(x).pop();
        T === null && x.flush(f.context.currentTime), x.add(i(w));
        const b = Array.from(x).pop();
        m.cancelScheduledValues(w), S !== b && b !== void 0 && (b.type === "exponentialRampToValue" ? m.exponentialRampToValueAtTime(b.value, b.endTime) : b.type === "linearRampToValue" ? m.linearRampToValueAtTime(b.value, b.endTime) : b.type === "setValue" ? m.setValueAtTime(b.value, b.startTime) : b.type === "setValueCurve" && m.setValueCurveAtTime(b.values, b.startTime, b.duration));
      }
      return y;
    },
    cancelScheduledValues(w) {
      return T === null && x.flush(f.context.currentTime), x.add(r(w)), m.cancelScheduledValues(w), y;
    },
    exponentialRampToValueAtTime(w, S) {
      if (w === 0)
        throw new RangeError();
      if (!Number.isFinite(S) || S < 0)
        throw new RangeError();
      const b = f.context.currentTime;
      return T === null && x.flush(b), Array.from(x).length === 0 && (x.add(l(v, b)), m.setValueAtTime(v, b)), x.add(o(w, S)), m.exponentialRampToValueAtTime(w, S), y;
    },
    linearRampToValueAtTime(w, S) {
      const b = f.context.currentTime;
      return T === null && x.flush(b), Array.from(x).length === 0 && (x.add(l(v, b)), m.setValueAtTime(v, b)), x.add(a(w, S)), m.linearRampToValueAtTime(w, S), y;
    },
    setTargetAtTime(w, S, b) {
      return T === null && x.flush(f.context.currentTime), x.add(c(w, S, b)), m.setTargetAtTime(w, S, b), y;
    },
    setValueAtTime(w, S) {
      return T === null && x.flush(f.context.currentTime), x.add(l(w, S)), m.setValueAtTime(w, S), y;
    },
    setValueCurveAtTime(w, S, b) {
      const O = w instanceof Float32Array ? w : new Float32Array(w);
      if (h !== null && h.name === "webkitAudioContext") {
        const D = S + b, k = f.context.sampleRate, I = Math.ceil(S * k), N = Math.floor(D * k), F = N - I, $ = new Float32Array(F);
        for (let q = 0; q < F; q += 1) {
          const tt = (O.length - 1) / b * ((I + q) / k - S), j = Math.floor(tt), E = Math.ceil(tt);
          $[q] = j === E ? O[j] : (1 - (tt - j)) * O[j] + (1 - (E - tt)) * O[E];
        }
        T === null && x.flush(f.context.currentTime), x.add(u($, S, b)), m.setValueCurveAtTime($, S, b);
        const L = N / k;
        L < D && d(y, $[$.length - 1], L), d(y, O[O.length - 1], D);
      } else
        T === null && x.flush(f.context.currentTime), x.add(u(O, S, b)), m.setValueCurveAtTime(O, S, b);
      return y;
    }
  };
  return e.set(y, m), t.set(y, f), n(y, T), y;
}, om = (n) => ({
  replay(t) {
    for (const e of n)
      if (e.type === "exponentialRampToValue") {
        const { endTime: s, value: i } = e;
        t.exponentialRampToValueAtTime(i, s);
      } else if (e.type === "linearRampToValue") {
        const { endTime: s, value: i } = e;
        t.linearRampToValueAtTime(i, s);
      } else if (e.type === "setTarget") {
        const { startTime: s, target: i, timeConstant: r } = e;
        t.setTargetAtTime(i, s, r);
      } else if (e.type === "setValue") {
        const { startTime: s, value: i } = e;
        t.setValueAtTime(i, s);
      } else if (e.type === "setValueCurve") {
        const { duration: s, startTime: i, values: r } = e;
        t.setValueCurveAtTime(r, i, s);
      } else
        throw new Error("Can't apply an unknown automation.");
  }
});
class Vh {
  constructor(t) {
    this._map = new Map(t);
  }
  get size() {
    return this._map.size;
  }
  entries() {
    return this._map.entries();
  }
  forEach(t, e = null) {
    return this._map.forEach((s, i) => t.call(e, s, i, this));
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
const am = {
  channelCount: 2,
  // Bug #61: The channelCountMode should be 'max' according to the spec but is set to 'explicit' to achieve consistent behavior.
  channelCountMode: "explicit",
  channelInterpretation: "speakers",
  numberOfInputs: 1,
  numberOfOutputs: 1,
  parameterData: {},
  processorOptions: {}
}, cm = (n, t, e, s, i, r, o, a, c, l, u, h, d, f) => class extends t {
  constructor(m, g, _) {
    var v;
    const x = a(m), T = c(x), y = u({ ...am, ..._ });
    d(y);
    const w = na.get(x), S = w?.get(g), b = T || x.state !== "closed" ? x : (v = o(x)) !== null && v !== void 0 ? v : x, O = i(b, T ? null : m.baseLatency, l, g, S, y), D = T ? s(g, y, S) : null;
    super(m, !0, O, D);
    const k = [];
    O.parameters.forEach((N, F) => {
      const $ = e(this, T, N);
      k.push([F, $]);
    }), this._nativeAudioWorkletNode = O, this._onprocessorerror = null, this._parameters = new Vh(k), T && n(x, this);
    const { activeInputs: I } = r(this);
    h(O, I);
  }
  get onprocessorerror() {
    return this._onprocessorerror;
  }
  set onprocessorerror(m) {
    const g = typeof m == "function" ? f(this, m) : null;
    this._nativeAudioWorkletNode.onprocessorerror = g;
    const _ = this._nativeAudioWorkletNode.onprocessorerror;
    this._onprocessorerror = _ !== null && _ === g ? m : _;
  }
  get parameters() {
    return this._parameters === null ? this._nativeAudioWorkletNode.parameters : this._parameters;
  }
  get port() {
    return this._nativeAudioWorkletNode.port;
  }
};
function Br(n, t, e, s, i) {
  if (typeof n.copyFromChannel == "function")
    t[e].byteLength === 0 && (t[e] = new Float32Array(128)), n.copyFromChannel(t[e], s, i);
  else {
    const r = n.getChannelData(s);
    if (t[e].byteLength === 0)
      t[e] = r.slice(i, i + 128);
    else {
      const o = new Float32Array(r.buffer, i * Float32Array.BYTES_PER_ELEMENT, 128);
      t[e].set(o);
    }
  }
}
const Wh = (n, t, e, s, i) => {
  typeof n.copyToChannel == "function" ? t[e].byteLength !== 0 && n.copyToChannel(t[e], s, i) : t[e].byteLength !== 0 && n.getChannelData(s).set(t[e], i);
}, $r = (n, t) => {
  const e = [];
  for (let s = 0; s < n; s += 1) {
    const i = [], r = typeof t == "number" ? t : t[s];
    for (let o = 0; o < r; o += 1)
      i.push(new Float32Array(128));
    e.push(i);
  }
  return e;
}, lm = (n, t) => {
  const e = un(sa, n), s = zt(t);
  return un(e, s);
}, um = async (n, t, e, s, i, r, o) => {
  const a = t === null ? Math.ceil(n.context.length / 128) * 128 : t.length, c = s.channelCount * s.numberOfInputs, l = i.reduce((g, _) => g + _, 0), u = l === 0 ? null : e.createBuffer(l, a, e.sampleRate);
  if (r === void 0)
    throw new Error("Missing the processor constructor.");
  const h = De(n), d = await lm(e, n), f = $r(s.numberOfInputs, s.channelCount), p = $r(s.numberOfOutputs, i), m = Array.from(n.parameters.keys()).reduce((g, _) => ({ ...g, [_]: new Float32Array(128) }), {});
  for (let g = 0; g < a; g += 128) {
    if (s.numberOfInputs > 0 && t !== null)
      for (let _ = 0; _ < s.numberOfInputs; _ += 1)
        for (let v = 0; v < s.channelCount; v += 1)
          Br(t, f[_], v, v, g);
    r.parameterDescriptors !== void 0 && t !== null && r.parameterDescriptors.forEach(({ name: _ }, v) => {
      Br(t, m, _, c + v, g);
    });
    for (let _ = 0; _ < s.numberOfInputs; _ += 1)
      for (let v = 0; v < i[_]; v += 1)
        p[_][v].byteLength === 0 && (p[_][v] = new Float32Array(128));
    try {
      const _ = f.map((x, T) => h.activeInputs[T].size === 0 ? [] : x), v = o(g / e.sampleRate, e.sampleRate, () => d.process(_, p, m));
      if (u !== null)
        for (let x = 0, T = 0; x < s.numberOfOutputs; x += 1) {
          for (let y = 0; y < i[x]; y += 1)
            Wh(u, p[x], y, T + y, g);
          T += i[x];
        }
      if (!v)
        break;
    } catch (_) {
      n.dispatchEvent(new ErrorEvent("processorerror", {
        colno: _.colno,
        filename: _.filename,
        lineno: _.lineno,
        message: _.message
      }));
      break;
    }
  }
  return u;
}, hm = (n, t, e, s, i, r, o, a, c, l, u, h, d, f, p, m) => (g, _, v) => {
  const x = /* @__PURE__ */ new WeakMap();
  let T = null;
  const y = async (w, S) => {
    let b = u(w), O = null;
    const D = Se(b, S), k = Array.isArray(_.outputChannelCount) ? _.outputChannelCount : Array.from(_.outputChannelCount);
    if (h === null) {
      const I = k.reduce((L, q) => L + q, 0), N = i(S, {
        channelCount: Math.max(1, I),
        channelCountMode: "explicit",
        channelInterpretation: "discrete",
        numberOfOutputs: Math.max(1, I)
      }), F = [];
      for (let L = 0; L < w.numberOfOutputs; L += 1)
        F.push(s(S, {
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "speakers",
          numberOfInputs: k[L]
        }));
      const $ = o(S, {
        channelCount: _.channelCount,
        channelCountMode: _.channelCountMode,
        channelInterpretation: _.channelInterpretation,
        gain: 1
      });
      $.connect = t.bind(null, F), $.disconnect = c.bind(null, F), O = [N, F, $];
    } else D || (b = new h(S, g));
    if (x.set(S, O === null ? b : O[2]), O !== null) {
      if (T === null) {
        if (v === void 0)
          throw new Error("Missing the processor constructor.");
        if (d === null)
          throw new Error("Missing the native OfflineAudioContext constructor.");
        const q = w.channelCount * w.numberOfInputs, tt = v.parameterDescriptors === void 0 ? 0 : v.parameterDescriptors.length, j = q + tt;
        T = um(w, j === 0 ? null : await (async () => {
          const R = new d(
            j,
            // Ceil the length to the next full render quantum.
            // Bug #17: Safari does not yet expose the length.
            Math.ceil(w.context.length / 128) * 128,
            S.sampleRate
          ), B = [], Q = [];
          for (let H = 0; H < _.numberOfInputs; H += 1)
            B.push(o(R, {
              channelCount: _.channelCount,
              channelCountMode: _.channelCountMode,
              channelInterpretation: _.channelInterpretation,
              gain: 1
            })), Q.push(i(R, {
              channelCount: _.channelCount,
              channelCountMode: "explicit",
              channelInterpretation: "discrete",
              numberOfOutputs: _.channelCount
            }));
          const K = await Promise.all(Array.from(w.parameters.values()).map(async (H) => {
            const st = r(R, {
              channelCount: 1,
              channelCountMode: "explicit",
              channelInterpretation: "discrete",
              offset: H.value
            });
            return await f(R, H, st.offset), st;
          })), z = s(R, {
            channelCount: 1,
            channelCountMode: "explicit",
            channelInterpretation: "speakers",
            numberOfInputs: Math.max(1, q + tt)
          });
          for (let H = 0; H < _.numberOfInputs; H += 1) {
            B[H].connect(Q[H]);
            for (let st = 0; st < _.channelCount; st += 1)
              Q[H].connect(z, st, H * _.channelCount + st);
          }
          for (const [H, st] of K.entries())
            st.connect(z, 0, q + H), st.start(0);
          return z.connect(R.destination), await Promise.all(B.map((H) => p(w, R, H))), m(R);
        })(), S, _, k, v, l);
      }
      const I = await T, N = e(S, {
        buffer: null,
        channelCount: 2,
        channelCountMode: "max",
        channelInterpretation: "speakers",
        loop: !1,
        loopEnd: 0,
        loopStart: 0,
        playbackRate: 1
      }), [F, $, L] = O;
      I !== null && (N.buffer = I, N.start(0)), N.connect(F);
      for (let q = 0, tt = 0; q < w.numberOfOutputs; q += 1) {
        const j = $[q];
        for (let E = 0; E < k[q]; E += 1)
          F.connect(j, tt + E, E);
        tt += k[q];
      }
      return L;
    }
    if (D)
      for (const [I, N] of w.parameters.entries())
        await n(
          S,
          N,
          // @todo The definition that TypeScript uses of the AudioParamMap is lacking many methods.
          b.parameters.get(I)
        );
    else
      for (const [I, N] of w.parameters.entries())
        await f(
          S,
          N,
          // @todo The definition that TypeScript uses of the AudioParamMap is lacking many methods.
          b.parameters.get(I)
        );
    return await p(w, S, b), b;
  };
  return {
    render(w, S) {
      a(S, w);
      const b = x.get(S);
      return b !== void 0 ? Promise.resolve(b) : y(w, S);
    }
  };
}, dm = (n, t, e, s, i, r, o, a, c, l, u, h, d, f, p, m, g, _, v, x) => class extends p {
  constructor(y, w) {
    super(y, w), this._nativeContext = y, this._audioWorklet = n === void 0 ? void 0 : {
      addModule: (S, b) => n(this, S, b)
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
    return new e({ length: w, numberOfChannels: y, sampleRate: S });
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
    return new f(this, { feedback: w, feedforward: y });
  }
  createOscillator() {
    return new m(this);
  }
  createPanner() {
    return new g(this);
  }
  createPeriodicWave(y, w, S = { disableNormalization: !1 }) {
    return new _(this, { ...S, imag: w, real: y });
  }
  createStereoPanner() {
    return new v(this);
  }
  createWaveShaper() {
    return new x(this);
  }
  decodeAudioData(y, w, S) {
    return l(this._nativeContext, y).then((b) => (typeof w == "function" && w(b), b), (b) => {
      throw typeof S == "function" && S(b), b;
    });
  }
}, fm = {
  Q: 1,
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  detune: 0,
  frequency: 350,
  gain: 0,
  type: "lowpass"
}, pm = (n, t, e, s, i, r, o, a) => class extends n {
  constructor(l, u) {
    const h = r(l), d = { ...fm, ...u }, f = i(h, d), p = o(h), m = p ? e() : null;
    super(l, !1, f, m), this._Q = t(this, p, f.Q, Ie, Ve), this._detune = t(this, p, f.detune, 1200 * Math.log2(Ie), -1200 * Math.log2(Ie)), this._frequency = t(this, p, f.frequency, l.sampleRate / 2, 0), this._gain = t(this, p, f.gain, 40 * Math.log10(Ie), Ve), this._nativeBiquadFilterNode = f, a(this, 1);
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
}, mm = (n, t, e, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap(), o = async (a, c) => {
    let l = e(a);
    const u = Se(l, c);
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
    return r.set(c, l), u ? (await n(c, a.Q, l.Q), await n(c, a.detune, l.detune), await n(c, a.frequency, l.frequency), await n(c, a.gain, l.gain)) : (await s(c, a.Q, l.Q), await s(c, a.detune, l.detune), await s(c, a.frequency, l.frequency), await s(c, a.gain, l.gain)), await i(a, c, l), l;
  };
  return {
    render(a, c) {
      const l = r.get(c);
      return l !== void 0 ? Promise.resolve(l) : o(a, c);
    }
  };
}, gm = (n, t) => (e, s) => {
  const i = t.get(e);
  if (i !== void 0)
    return i;
  const r = n.get(e);
  if (r !== void 0)
    return r;
  try {
    const o = s();
    return o instanceof Promise ? (n.set(e, o), o.catch(() => !1).then((a) => (n.delete(e), t.set(e, a), a))) : (t.set(e, o), o);
  } catch {
    return t.set(e, !1), !1;
  }
}, _m = {
  channelCount: 1,
  channelCountMode: "explicit",
  channelInterpretation: "speakers",
  numberOfInputs: 6
}, ym = (n, t, e, s, i) => class extends n {
  constructor(o, a) {
    const c = s(o), l = { ..._m, ...a }, u = e(c, l), h = i(c) ? t() : null;
    super(o, !1, u, h);
  }
}, vm = (n, t, e) => () => {
  const s = /* @__PURE__ */ new WeakMap(), i = async (r, o) => {
    let a = t(r);
    if (!Se(a, o)) {
      const l = {
        channelCount: a.channelCount,
        channelCountMode: a.channelCountMode,
        channelInterpretation: a.channelInterpretation,
        numberOfInputs: a.numberOfInputs
      };
      a = n(o, l);
    }
    return s.set(o, a), await e(r, o, a), a;
  };
  return {
    render(r, o) {
      const a = s.get(o);
      return a !== void 0 ? Promise.resolve(a) : i(r, o);
    }
  };
}, bm = {
  channelCount: 6,
  channelCountMode: "explicit",
  channelInterpretation: "discrete",
  numberOfOutputs: 6
}, xm = (n, t, e, s, i, r) => class extends n {
  constructor(a, c) {
    const l = s(a), u = r({ ...bm, ...c }), h = e(l, u), d = i(l) ? t() : null;
    super(a, !1, h, d);
  }
}, wm = (n, t, e) => () => {
  const s = /* @__PURE__ */ new WeakMap(), i = async (r, o) => {
    let a = t(r);
    if (!Se(a, o)) {
      const l = {
        channelCount: a.channelCount,
        channelCountMode: a.channelCountMode,
        channelInterpretation: a.channelInterpretation,
        numberOfOutputs: a.numberOfOutputs
      };
      a = n(o, l);
    }
    return s.set(o, a), await e(r, o, a), a;
  };
  return {
    render(r, o) {
      const a = s.get(o);
      return a !== void 0 ? Promise.resolve(a) : i(r, o);
    }
  };
}, Cm = (n) => (t, e, s) => n(e, t, s), Sm = (n) => (t, e, s = 0, i = 0) => {
  const r = t[s];
  if (r === void 0)
    throw n();
  return qr(e) ? r.connect(e, 0, i) : r.connect(e, 0);
}, Tm = (n) => (t, e) => {
  const s = n(t, {
    buffer: null,
    channelCount: 2,
    channelCountMode: "max",
    channelInterpretation: "speakers",
    loop: !1,
    loopEnd: 0,
    loopStart: 0,
    playbackRate: 1
  }), i = t.createBuffer(1, 2, 44100);
  return s.buffer = i, s.loop = !0, s.connect(e), s.start(), () => {
    s.stop(), s.disconnect(e);
  };
}, Am = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  offset: 1
}, km = (n, t, e, s, i, r, o) => class extends n {
  constructor(c, l) {
    const u = i(c), h = { ...Am, ...l }, d = s(u, h), f = r(u), p = f ? e() : null;
    super(c, !1, d, p), this._constantSourceNodeRenderer = p, this._nativeConstantSourceNode = d, this._offset = t(this, f, d.offset, Ie, Ve), this._onended = null;
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
      zs(this);
      const l = () => {
        this._nativeConstantSourceNode.removeEventListener("ended", l), Mn(this) && Gi(this);
      };
      this._nativeConstantSourceNode.addEventListener("ended", l);
    }
  }
  stop(c = 0) {
    this._nativeConstantSourceNode.stop(c), this._constantSourceNodeRenderer !== null && (this._constantSourceNodeRenderer.stop = c);
  }
}, Im = (n, t, e, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap();
  let o = null, a = null;
  const c = async (l, u) => {
    let h = e(l);
    const d = Se(h, u);
    if (!d) {
      const f = {
        channelCount: h.channelCount,
        channelCountMode: h.channelCountMode,
        channelInterpretation: h.channelInterpretation,
        offset: h.offset.value
      };
      h = t(u, f), o !== null && h.start(o), a !== null && h.stop(a);
    }
    return r.set(u, h), d ? await n(u, l.offset, h.offset) : await s(u, l.offset, h.offset), await i(l, u, h), h;
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
}, Em = (n) => (t) => (n[0] = t, n[0]), Dm = {
  buffer: null,
  channelCount: 2,
  channelCountMode: "clamped-max",
  channelInterpretation: "speakers",
  disableNormalization: !1
}, Om = (n, t, e, s, i, r) => class extends n {
  constructor(a, c) {
    const l = s(a), u = { ...Dm, ...c }, h = e(l, u), f = i(l) ? t() : null;
    super(a, !1, h, f), this._isBufferNullified = !1, this._nativeConvolverNode = h, u.buffer !== null && r(this, u.buffer.duration);
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
}, Rm = (n, t, e) => () => {
  const s = /* @__PURE__ */ new WeakMap(), i = async (r, o) => {
    let a = t(r);
    if (!Se(a, o)) {
      const l = {
        buffer: a.buffer,
        channelCount: a.channelCount,
        channelCountMode: a.channelCountMode,
        channelInterpretation: a.channelInterpretation,
        disableNormalization: !a.normalize
      };
      a = n(o, l);
    }
    return s.set(o, a), Js(a) ? await e(r, o, a.inputs[0]) : await e(r, o, a), a;
  };
  return {
    render(r, o) {
      const a = s.get(o);
      return a !== void 0 ? Promise.resolve(a) : i(r, o);
    }
  };
}, Mm = (n, t) => (e, s, i) => {
  if (t === null)
    throw new Error("Missing the native OfflineAudioContext constructor.");
  try {
    return new t(e, s, i);
  } catch (r) {
    throw r.name === "SyntaxError" ? n() : r;
  }
}, Nm = () => new DOMException("", "DataCloneError"), zl = (n) => {
  const { port1: t, port2: e } = new MessageChannel();
  return new Promise((s) => {
    const i = () => {
      e.onmessage = null, t.close(), e.close(), s();
    };
    e.onmessage = () => i();
    try {
      t.postMessage(n, [n]);
    } catch {
    } finally {
      i();
    }
  });
}, Pm = (n, t, e, s, i, r, o, a, c, l, u) => (h, d) => {
  const f = o(h) ? h : r(h);
  if (i.has(d)) {
    const p = e();
    return Promise.reject(p);
  }
  try {
    i.add(d);
  } catch {
  }
  return t(c, () => c(f)) ? f.decodeAudioData(d).then((p) => (zl(d).catch(() => {
  }), t(a, () => a(p)) || u(p), n.add(p), p)) : new Promise((p, m) => {
    const g = async () => {
      try {
        await zl(d);
      } catch {
      }
    }, _ = (v) => {
      m(v), g();
    };
    try {
      f.decodeAudioData(d, (v) => {
        typeof v.copyFromChannel != "function" && (l(v), $a(v)), n.add(v), g().then(() => p(v));
      }, (v) => {
        _(v === null ? s() : v);
      });
    } catch (v) {
      _(v);
    }
  });
}, Fm = (n, t, e, s, i, r, o, a) => (c, l) => {
  const u = t.get(c);
  if (u === void 0)
    throw new Error("Missing the expected cycle count.");
  const h = r(c.context), d = a(h);
  if (u === l) {
    if (t.delete(c), !d && o(c)) {
      const f = s(c), { outputs: p } = e(c);
      for (const m of p)
        if (Yi(m)) {
          const g = s(m[0]);
          n(f, g, m[1], m[2]);
        } else {
          const g = i(m[0]);
          f.connect(g, m[1]);
        }
    }
  } else
    t.set(c, u - l);
}, Vm = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  delayTime: 0,
  maxDelayTime: 1
}, Wm = (n, t, e, s, i, r, o) => class extends n {
  constructor(c, l) {
    const u = i(c), h = { ...Vm, ...l }, d = s(u, h), f = r(u), p = f ? e(h.maxDelayTime) : null;
    super(c, !1, d, p), this._delayTime = t(this, f, d.delayTime), o(this, h.maxDelayTime);
  }
  get delayTime() {
    return this._delayTime;
  }
}, jm = (n, t, e, s, i) => (r) => {
  const o = /* @__PURE__ */ new WeakMap(), a = async (c, l) => {
    let u = e(c);
    const h = Se(u, l);
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
    return o.set(l, u), h ? await n(l, c.delayTime, u.delayTime) : await s(l, c.delayTime, u.delayTime), await i(c, l, u), u;
  };
  return {
    render(c, l) {
      const u = o.get(l);
      return u !== void 0 ? Promise.resolve(u) : a(c, l);
    }
  };
}, Lm = (n) => (t, e, s, i) => n(t[i], (r) => r[0] === e && r[1] === s), qm = (n) => (t, e) => {
  n(t).delete(e);
}, Bm = (n) => "delayTime" in n, $m = (n, t, e) => function s(i, r) {
  const o = Wr(r) ? r : e(n, r);
  if (Bm(o))
    return [];
  if (i[0] === o)
    return [i];
  if (i.includes(o))
    return [];
  const { outputs: a } = t(o);
  return Array.from(a).map((c) => s([...i, o], c[0])).reduce((c, l) => c.concat(l), []);
}, wr = (n, t, e) => {
  const s = t[e];
  if (s === void 0)
    throw n();
  return s;
}, zm = (n) => (t, e = void 0, s = void 0, i = 0) => e === void 0 ? t.forEach((r) => r.disconnect()) : typeof e == "number" ? wr(n, t, e).disconnect() : qr(e) ? s === void 0 ? t.forEach((r) => r.disconnect(e)) : i === void 0 ? wr(n, t, s).disconnect(e, 0) : wr(n, t, s).disconnect(e, 0, i) : s === void 0 ? t.forEach((r) => r.disconnect(e)) : wr(n, t, s).disconnect(e, 0), Gm = {
  attack: 3e-3,
  channelCount: 2,
  channelCountMode: "clamped-max",
  channelInterpretation: "speakers",
  knee: 30,
  ratio: 12,
  release: 0.25,
  threshold: -24
}, Zm = (n, t, e, s, i, r, o, a) => class extends n {
  constructor(l, u) {
    const h = r(l), d = { ...Gm, ...u }, f = s(h, d), p = o(h), m = p ? e() : null;
    super(l, !1, f, m), this._attack = t(this, p, f.attack), this._knee = t(this, p, f.knee), this._nativeDynamicsCompressorNode = f, this._ratio = t(this, p, f.ratio), this._release = t(this, p, f.release), this._threshold = t(this, p, f.threshold), a(this, 6e-3);
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
}, Ym = (n, t, e, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap(), o = async (a, c) => {
    let l = e(a);
    const u = Se(l, c);
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
    return r.set(c, l), u ? (await n(c, a.attack, l.attack), await n(c, a.knee, l.knee), await n(c, a.ratio, l.ratio), await n(c, a.release, l.release), await n(c, a.threshold, l.threshold)) : (await s(c, a.attack, l.attack), await s(c, a.knee, l.knee), await s(c, a.ratio, l.ratio), await s(c, a.release, l.release), await s(c, a.threshold, l.threshold)), await i(a, c, l), l;
  };
  return {
    render(a, c) {
      const l = r.get(c);
      return l !== void 0 ? Promise.resolve(l) : o(a, c);
    }
  };
}, Xm = () => new DOMException("", "EncodingError"), Um = (n) => (t) => new Promise((e, s) => {
  if (n === null) {
    s(new SyntaxError());
    return;
  }
  const i = n.document.head;
  if (i === null)
    s(new SyntaxError());
  else {
    const r = n.document.createElement("script"), o = new Blob([t], { type: "application/javascript" }), a = URL.createObjectURL(o), c = n.onerror, l = () => {
      n.onerror = c, URL.revokeObjectURL(a);
    };
    n.onerror = (u, h, d, f, p) => {
      if (h === a || h === n.location.href && d === 1 && f === 1)
        return l(), s(p), !1;
      if (c !== null)
        return c(u, h, d, f, p);
    }, r.onerror = () => {
      l(), s(new SyntaxError());
    }, r.onload = () => {
      l(), e();
    }, r.src = a, r.type = "module", i.appendChild(r);
  }
}), Hm = (n) => class {
  constructor(e) {
    this._nativeEventTarget = e, this._listeners = /* @__PURE__ */ new WeakMap();
  }
  addEventListener(e, s, i) {
    if (s !== null) {
      let r = this._listeners.get(s);
      r === void 0 && (r = n(this, s), typeof s == "function" && this._listeners.set(s, r)), this._nativeEventTarget.addEventListener(e, r, i);
    }
  }
  dispatchEvent(e) {
    return this._nativeEventTarget.dispatchEvent(e);
  }
  removeEventListener(e, s, i) {
    const r = s === null ? void 0 : this._listeners.get(s);
    this._nativeEventTarget.removeEventListener(e, r === void 0 ? null : r, i);
  }
}, Km = (n) => (t, e, s) => {
  Object.defineProperties(n, {
    currentFrame: {
      configurable: !0,
      get() {
        return Math.round(t * e);
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
    n !== null && (delete n.currentFrame, delete n.currentTime);
  }
}, Qm = (n) => async (t) => {
  try {
    const e = await fetch(t);
    if (e.ok)
      return [await e.text(), e.url];
  } catch {
  }
  throw n();
}, Jm = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  gain: 1
}, tg = (n, t, e, s, i, r) => class extends n {
  constructor(a, c) {
    const l = i(a), u = { ...Jm, ...c }, h = s(l, u), d = r(l), f = d ? e() : null;
    super(a, !1, h, f), this._gain = t(this, d, h.gain, Ie, Ve);
  }
  get gain() {
    return this._gain;
  }
}, eg = (n, t, e, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap(), o = async (a, c) => {
    let l = e(a);
    const u = Se(l, c);
    if (!u) {
      const h = {
        channelCount: l.channelCount,
        channelCountMode: l.channelCountMode,
        channelInterpretation: l.channelInterpretation,
        gain: l.gain.value
      };
      l = t(c, h);
    }
    return r.set(c, l), u ? await n(c, a.gain, l.gain) : await s(c, a.gain, l.gain), await i(a, c, l), l;
  };
  return {
    render(a, c) {
      const l = r.get(c);
      return l !== void 0 ? Promise.resolve(l) : o(a, c);
    }
  };
}, ng = (n, t) => (e) => t(n, e), sg = (n) => (t) => {
  const e = n(t);
  if (e.renderer === null)
    throw new Error("Missing the renderer of the given AudioNode in the audio graph.");
  return e.renderer;
}, ig = (n) => (t) => {
  var e;
  return (e = n.get(t)) !== null && e !== void 0 ? e : 0;
}, rg = (n) => (t) => {
  const e = n(t);
  if (e.renderer === null)
    throw new Error("Missing the renderer of the given AudioParam in the audio graph.");
  return e.renderer;
}, og = (n) => (t) => n.get(t), fe = () => new DOMException("", "InvalidStateError"), ag = (n) => (t) => {
  const e = n.get(t);
  if (e === void 0)
    throw fe();
  return e;
}, cg = (n, t) => (e) => {
  let s = n.get(e);
  if (s !== void 0)
    return s;
  if (t === null)
    throw new Error("Missing the native OfflineAudioContext constructor.");
  return s = new t(1, 1, 44100), n.set(e, s), s;
}, lg = (n) => (t) => {
  const e = n.get(t);
  if (e === void 0)
    throw new Error("The context has no set of AudioWorkletNodes.");
  return e;
}, no = () => new DOMException("", "InvalidAccessError"), ug = (n) => {
  n.getFrequencyResponse = /* @__PURE__ */ ((t) => (e, s, i) => {
    if (e.length !== s.length || s.length !== i.length)
      throw no();
    return t.call(n, e, s, i);
  })(n.getFrequencyResponse);
}, hg = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers"
}, dg = (n, t, e, s, i, r) => class extends n {
  constructor(a, c) {
    const l = s(a), u = i(l), h = { ...hg, ...c }, d = t(l, u ? null : a.baseLatency, h), f = u ? e(h.feedback, h.feedforward) : null;
    super(a, !1, d, f), ug(d), this._nativeIIRFilterNode = d, r(this, 1);
  }
  getFrequencyResponse(a, c, l) {
    return this._nativeIIRFilterNode.getFrequencyResponse(a, c, l);
  }
}, jh = (n, t, e, s, i, r, o, a, c, l, u) => {
  const h = l.length;
  let d = a;
  for (let f = 0; f < h; f += 1) {
    let p = e[0] * l[f];
    for (let m = 1; m < i; m += 1) {
      const g = d - m & c - 1;
      p += e[m] * r[g], p -= n[m] * o[g];
    }
    for (let m = i; m < s; m += 1)
      p += e[m] * r[d - m & c - 1];
    for (let m = i; m < t; m += 1)
      p -= n[m] * o[d - m & c - 1];
    r[d] = l[f], o[d] = p, d = d + 1 & c - 1, u[f] = p;
  }
  return d;
}, fg = (n, t, e, s) => {
  const i = e instanceof Float64Array ? e : new Float64Array(e), r = s instanceof Float64Array ? s : new Float64Array(s), o = i.length, a = r.length, c = Math.min(o, a);
  if (i[0] !== 1) {
    for (let p = 0; p < o; p += 1)
      r[p] /= i[0];
    for (let p = 1; p < a; p += 1)
      i[p] /= i[0];
  }
  const l = 32, u = new Float32Array(l), h = new Float32Array(l), d = t.createBuffer(n.numberOfChannels, n.length, n.sampleRate), f = n.numberOfChannels;
  for (let p = 0; p < f; p += 1) {
    const m = n.getChannelData(p), g = d.getChannelData(p);
    u.fill(0), h.fill(0), jh(i, o, r, a, c, u, h, 0, l, m, g);
  }
  return d;
}, pg = (n, t, e, s, i) => (r, o) => {
  const a = /* @__PURE__ */ new WeakMap();
  let c = null;
  const l = async (u, h) => {
    let d = null, f = t(u);
    const p = Se(f, h);
    if (h.createIIRFilter === void 0 ? d = n(h, {
      buffer: null,
      channelCount: 2,
      channelCountMode: "max",
      channelInterpretation: "speakers",
      loop: !1,
      loopEnd: 0,
      loopStart: 0,
      playbackRate: 1
    }) : p || (f = h.createIIRFilter(o, r)), a.set(h, d === null ? f : d), d !== null) {
      if (c === null) {
        if (e === null)
          throw new Error("Missing the native OfflineAudioContext constructor.");
        const g = new e(
          // Bug #47: The AudioDestinationNode in Safari gets not initialized correctly.
          u.context.destination.channelCount,
          // Bug #17: Safari does not yet expose the length.
          u.context.length,
          h.sampleRate
        );
        c = (async () => {
          await s(u, g, g.destination);
          const _ = await i(g);
          return fg(_, h, r, o);
        })();
      }
      const m = await c;
      return d.buffer = m, d.start(0), d;
    }
    return await s(u, h, f), f;
  };
  return {
    render(u, h) {
      const d = a.get(h);
      return d !== void 0 ? Promise.resolve(d) : l(u, h);
    }
  };
}, mg = (n, t, e, s, i, r) => (o) => (a, c) => {
  const l = n.get(a);
  if (l === void 0) {
    if (!o && r(a)) {
      const u = s(a), { outputs: h } = e(a);
      for (const d of h)
        if (Yi(d)) {
          const f = s(d[0]);
          t(u, f, d[1], d[2]);
        } else {
          const f = i(d[0]);
          u.disconnect(f, d[1]);
        }
    }
    n.set(a, c);
  } else
    n.set(a, l + c);
}, gg = (n, t) => (e) => {
  const s = n.get(e);
  return t(s) || t(e);
}, _g = (n, t) => (e) => n.has(e) || t(e), yg = (n, t) => (e) => n.has(e) || t(e), vg = (n, t) => (e) => {
  const s = n.get(e);
  return t(s) || t(e);
}, bg = (n) => (t) => n !== null && t instanceof n, xg = (n) => (t) => n !== null && typeof n.AudioNode == "function" && t instanceof n.AudioNode, wg = (n) => (t) => n !== null && typeof n.AudioParam == "function" && t instanceof n.AudioParam, Cg = (n, t) => (e) => n(e) || t(e), Sg = (n) => (t) => n !== null && t instanceof n, Tg = (n) => n !== null && n.isSecureContext, Ag = async (n, t, e, s, i, r, o, a, c, l, u, h, d, f, p, m) => n(t, t) && n(e, e) && n(i, i) && n(r, r) && n(a, a) && n(c, c) && n(l, l) && n(u, u) && n(h, h) && n(d, d) && n(f, f) ? (await Promise.all([
  n(s, s),
  n(o, o),
  n(p, p),
  n(m, m)
])).every((_) => _) : !1, kg = (n, t, e, s) => class extends n {
  constructor(r, o) {
    const a = e(r), c = t(a, o);
    if (s(a))
      throw TypeError();
    super(r, !0, c, null), this._nativeMediaElementAudioSourceNode = c;
  }
  get mediaElement() {
    return this._nativeMediaElementAudioSourceNode.mediaElement;
  }
}, Ig = {
  channelCount: 2,
  channelCountMode: "explicit",
  channelInterpretation: "speakers"
}, Eg = (n, t, e, s) => class extends n {
  constructor(r, o) {
    const a = e(r);
    if (s(a))
      throw new TypeError();
    const c = { ...Ig, ...o }, l = t(a, c);
    super(r, !1, l, null), this._nativeMediaStreamAudioDestinationNode = l;
  }
  get stream() {
    return this._nativeMediaStreamAudioDestinationNode.stream;
  }
}, Dg = (n, t, e, s) => class extends n {
  constructor(r, o) {
    const a = e(r), c = t(a, o);
    if (s(a))
      throw new TypeError();
    super(r, !0, c, null), this._nativeMediaStreamAudioSourceNode = c;
  }
  get mediaStream() {
    return this._nativeMediaStreamAudioSourceNode.mediaStream;
  }
}, Og = (n, t, e) => class extends n {
  constructor(i, r) {
    const o = e(i), a = t(o, r);
    super(i, !0, a, null);
  }
}, Rg = (n, t, e, s, i, r) => class extends e {
  constructor(a, c) {
    super(a), this._nativeContext = a, to.set(this, a), s(a) && i.set(a, /* @__PURE__ */ new Set()), this._destination = new n(this, c), this._listener = t(this, a), this._onstatechange = null;
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
}, Ni = (n) => {
  const t = new Uint32Array([1179011410, 40, 1163280727, 544501094, 16, 131073, 44100, 176400, 1048580, 1635017060, 4, 0]);
  try {
    const e = n.decodeAudioData(t.buffer, () => {
    });
    return e === void 0 ? !1 : (e.catch(() => {
    }), !0);
  } catch {
  }
  return !1;
}, Mg = (n, t) => (e, s, i) => {
  const r = /* @__PURE__ */ new Set();
  return e.connect = /* @__PURE__ */ ((o) => (a, c = 0, l = 0) => {
    const u = r.size === 0;
    if (t(a))
      return o.call(e, a, c, l), n(r, [a, c, l], (h) => h[0] === a && h[1] === c && h[2] === l, !0), u && s(), a;
    o.call(e, a, c), n(r, [a, c], (h) => h[0] === a && h[1] === c, !0), u && s();
  })(e.connect), e.disconnect = /* @__PURE__ */ ((o) => (a, c, l) => {
    const u = r.size > 0;
    if (a === void 0)
      o.apply(e), r.clear();
    else if (typeof a == "number") {
      o.call(e, a);
      for (const d of r)
        d[1] === a && r.delete(d);
    } else {
      t(a) ? o.call(e, a, c, l) : o.call(e, a, c);
      for (const d of r)
        d[0] === a && (c === void 0 || d[1] === c) && (l === void 0 || d[2] === l) && r.delete(d);
    }
    const h = r.size === 0;
    u && h && i();
  })(e.disconnect), e;
}, Gt = (n, t, e) => {
  const s = t[e];
  s !== void 0 && s !== n[e] && (n[e] = s);
}, ce = (n, t) => {
  Gt(n, t, "channelCount"), Gt(n, t, "channelCountMode"), Gt(n, t, "channelInterpretation");
}, Gl = (n) => typeof n.getFloatTimeDomainData == "function", Ng = (n) => {
  n.getFloatTimeDomainData = (t) => {
    const e = new Uint8Array(t.length);
    n.getByteTimeDomainData(e);
    const s = Math.max(e.length, n.fftSize);
    for (let i = 0; i < s; i += 1)
      t[i] = (e[i] - 128) * 78125e-7;
    return t;
  };
}, Pg = (n, t) => (e, s) => {
  const i = e.createAnalyser();
  if (ce(i, s), !(s.maxDecibels > s.minDecibels))
    throw t();
  return Gt(i, s, "fftSize"), Gt(i, s, "maxDecibels"), Gt(i, s, "minDecibels"), Gt(i, s, "smoothingTimeConstant"), n(Gl, () => Gl(i)) || Ng(i), i;
}, Fg = (n) => n === null ? null : n.hasOwnProperty("AudioBuffer") ? n.AudioBuffer : null, Qt = (n, t, e) => {
  const s = t[e];
  s !== void 0 && s !== n[e].value && (n[e].value = s);
}, Vg = (n) => {
  n.start = /* @__PURE__ */ ((t) => {
    let e = !1;
    return (s = 0, i = 0, r) => {
      if (e)
        throw fe();
      t.call(n, s, i, r), e = !0;
    };
  })(n.start);
}, Za = (n) => {
  n.start = /* @__PURE__ */ ((t) => (e = 0, s = 0, i) => {
    if (typeof i == "number" && i < 0 || s < 0 || e < 0)
      throw new RangeError("The parameters can't be negative.");
    t.call(n, e, s, i);
  })(n.start);
}, Ya = (n) => {
  n.stop = /* @__PURE__ */ ((t) => (e = 0) => {
    if (e < 0)
      throw new RangeError("The parameter can't be negative.");
    t.call(n, e);
  })(n.stop);
}, Wg = (n, t, e, s, i, r, o, a, c, l, u) => (h, d) => {
  const f = h.createBufferSource();
  return ce(f, d), Qt(f, d, "playbackRate"), Gt(f, d, "buffer"), Gt(f, d, "loop"), Gt(f, d, "loopEnd"), Gt(f, d, "loopStart"), t(e, () => e(h)) || Vg(f), t(s, () => s(h)) || c(f), t(i, () => i(h)) || l(f, h), t(r, () => r(h)) || Za(f), t(o, () => o(h)) || u(f, h), t(a, () => a(h)) || Ya(f), n(h, f), f;
}, jg = (n) => n === null ? null : n.hasOwnProperty("AudioContext") ? n.AudioContext : n.hasOwnProperty("webkitAudioContext") ? n.webkitAudioContext : null, Lg = (n, t) => (e, s, i) => {
  const r = e.destination;
  if (r.channelCount !== s)
    try {
      r.channelCount = s;
    } catch {
    }
  i && r.channelCountMode !== "explicit" && (r.channelCountMode = "explicit"), r.maxChannelCount === 0 && Object.defineProperty(r, "maxChannelCount", {
    value: s
  });
  const o = n(e, {
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
}, qg = (n) => n === null ? null : n.hasOwnProperty("AudioWorkletNode") ? n.AudioWorkletNode : null, Bg = (n) => {
  const { port1: t } = new MessageChannel();
  try {
    t.postMessage(n);
  } finally {
    t.close();
  }
}, $g = (n, t, e, s, i) => (r, o, a, c, l, u) => {
  if (a !== null)
    try {
      const h = new a(r, c, u), d = /* @__PURE__ */ new Map();
      let f = null;
      if (Object.defineProperties(h, {
        /*
         * Bug #61: Overwriting the property accessors for channelCount and channelCountMode is necessary as long as some
         * browsers have no native implementation to achieve a consistent behavior.
         */
        channelCount: {
          get: () => u.channelCount,
          set: () => {
            throw n();
          }
        },
        channelCountMode: {
          get: () => "explicit",
          set: () => {
            throw n();
          }
        },
        // Bug #156: Chrome and Edge do not yet fire an ErrorEvent.
        onprocessorerror: {
          get: () => f,
          set: (p) => {
            typeof f == "function" && h.removeEventListener("processorerror", f), f = typeof p == "function" ? p : null, typeof f == "function" && h.addEventListener("processorerror", f);
          }
        }
      }), h.addEventListener = /* @__PURE__ */ ((p) => (...m) => {
        if (m[0] === "processorerror") {
          const g = typeof m[1] == "function" ? m[1] : typeof m[1] == "object" && m[1] !== null && typeof m[1].handleEvent == "function" ? m[1].handleEvent : null;
          if (g !== null) {
            const _ = d.get(m[1]);
            _ !== void 0 ? m[1] = _ : (m[1] = (v) => {
              v.type === "error" ? (Object.defineProperties(v, {
                type: { value: "processorerror" }
              }), g(v)) : g(new ErrorEvent(m[0], { ...v }));
            }, d.set(g, m[1]));
          }
        }
        return p.call(h, "error", m[1], m[2]), p.call(h, ...m);
      })(h.addEventListener), h.removeEventListener = /* @__PURE__ */ ((p) => (...m) => {
        if (m[0] === "processorerror") {
          const g = d.get(m[1]);
          g !== void 0 && (d.delete(m[1]), m[1] = g);
        }
        return p.call(h, "error", m[1], m[2]), p.call(h, m[0], m[1], m[2]);
      })(h.removeEventListener), u.numberOfOutputs !== 0) {
        const p = e(r, {
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "discrete",
          gain: 0
        });
        return h.connect(p).connect(r.destination), i(h, () => p.disconnect(), () => p.connect(r.destination));
      }
      return h;
    } catch (h) {
      throw h.code === 11 ? s() : h;
    }
  if (l === void 0)
    throw s();
  return Bg(u), t(r, o, l, u);
}, Lh = (n, t) => n === null ? 512 : Math.max(512, Math.min(16384, Math.pow(2, Math.round(Math.log2(n * t))))), zg = (n) => new Promise((t, e) => {
  const { port1: s, port2: i } = new MessageChannel();
  s.onmessage = ({ data: r }) => {
    s.close(), i.close(), t(r);
  }, s.onmessageerror = ({ data: r }) => {
    s.close(), i.close(), e(r);
  }, i.postMessage(n);
}), Gg = async (n, t) => {
  const e = await zg(t);
  return new n(e);
}, Zg = (n, t, e, s) => {
  let i = sa.get(n);
  i === void 0 && (i = /* @__PURE__ */ new WeakMap(), sa.set(n, i));
  const r = Gg(e, s);
  return i.set(t, r), r;
}, Yg = (n, t, e, s, i, r, o, a, c, l, u, h, d) => (f, p, m, g) => {
  if (g.numberOfInputs === 0 && g.numberOfOutputs === 0)
    throw c();
  const _ = Array.isArray(g.outputChannelCount) ? g.outputChannelCount : Array.from(g.outputChannelCount);
  if (_.some((Z) => Z < 1))
    throw c();
  if (_.length !== g.numberOfOutputs)
    throw t();
  if (g.channelCountMode !== "explicit")
    throw c();
  const v = g.channelCount * g.numberOfInputs, x = _.reduce((Z, rt) => Z + rt, 0), T = m.parameterDescriptors === void 0 ? 0 : m.parameterDescriptors.length;
  if (v + T > 6 || x > 6)
    throw c();
  const y = new MessageChannel(), w = [], S = [];
  for (let Z = 0; Z < g.numberOfInputs; Z += 1)
    w.push(o(f, {
      channelCount: g.channelCount,
      channelCountMode: g.channelCountMode,
      channelInterpretation: g.channelInterpretation,
      gain: 1
    })), S.push(i(f, {
      channelCount: g.channelCount,
      channelCountMode: "explicit",
      channelInterpretation: "discrete",
      numberOfOutputs: g.channelCount
    }));
  const b = [];
  if (m.parameterDescriptors !== void 0)
    for (const { defaultValue: Z, maxValue: rt, minValue: Wt, name: kt } of m.parameterDescriptors) {
      const bt = r(f, {
        channelCount: 1,
        channelCountMode: "explicit",
        channelInterpretation: "discrete",
        offset: g.parameterData[kt] !== void 0 ? g.parameterData[kt] : Z === void 0 ? 0 : Z
      });
      Object.defineProperties(bt.offset, {
        defaultValue: {
          get: () => Z === void 0 ? 0 : Z
        },
        maxValue: {
          get: () => rt === void 0 ? Ie : rt
        },
        minValue: {
          get: () => Wt === void 0 ? Ve : Wt
        }
      }), b.push(bt);
    }
  const O = s(f, {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "speakers",
    numberOfInputs: Math.max(1, v + T)
  }), D = Lh(p, f.sampleRate), k = a(
    f,
    D,
    v + T,
    // Bug #87: Only Firefox will fire an AudioProcessingEvent if there is no connected output.
    Math.max(1, x)
  ), I = i(f, {
    channelCount: Math.max(1, x),
    channelCountMode: "explicit",
    channelInterpretation: "discrete",
    numberOfOutputs: Math.max(1, x)
  }), N = [];
  for (let Z = 0; Z < g.numberOfOutputs; Z += 1)
    N.push(s(f, {
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      numberOfInputs: _[Z]
    }));
  for (let Z = 0; Z < g.numberOfInputs; Z += 1) {
    w[Z].connect(S[Z]);
    for (let rt = 0; rt < g.channelCount; rt += 1)
      S[Z].connect(O, rt, Z * g.channelCount + rt);
  }
  const F = new Vh(m.parameterDescriptors === void 0 ? [] : m.parameterDescriptors.map(({ name: Z }, rt) => {
    const Wt = b[rt];
    return Wt.connect(O, 0, v + rt), Wt.start(0), [Z, Wt.offset];
  }));
  O.connect(k);
  let $ = g.channelInterpretation, L = null;
  const q = g.numberOfOutputs === 0 ? [k] : N, tt = {
    get bufferSize() {
      return D;
    },
    get channelCount() {
      return g.channelCount;
    },
    set channelCount(Z) {
      throw e();
    },
    get channelCountMode() {
      return g.channelCountMode;
    },
    set channelCountMode(Z) {
      throw e();
    },
    get channelInterpretation() {
      return $;
    },
    set channelInterpretation(Z) {
      for (const rt of w)
        rt.channelInterpretation = Z;
      $ = Z;
    },
    get context() {
      return k.context;
    },
    get inputs() {
      return w;
    },
    get numberOfInputs() {
      return g.numberOfInputs;
    },
    get numberOfOutputs() {
      return g.numberOfOutputs;
    },
    get onprocessorerror() {
      return L;
    },
    set onprocessorerror(Z) {
      typeof L == "function" && tt.removeEventListener("processorerror", L), L = typeof Z == "function" ? Z : null, typeof L == "function" && tt.addEventListener("processorerror", L);
    },
    get parameters() {
      return F;
    },
    get port() {
      return y.port2;
    },
    addEventListener(...Z) {
      return k.addEventListener(Z[0], Z[1], Z[2]);
    },
    connect: n.bind(null, q),
    disconnect: l.bind(null, q),
    dispatchEvent(...Z) {
      return k.dispatchEvent(Z[0]);
    },
    removeEventListener(...Z) {
      return k.removeEventListener(Z[0], Z[1], Z[2]);
    }
  }, j = /* @__PURE__ */ new Map();
  y.port1.addEventListener = /* @__PURE__ */ ((Z) => (...rt) => {
    if (rt[0] === "message") {
      const Wt = typeof rt[1] == "function" ? rt[1] : typeof rt[1] == "object" && rt[1] !== null && typeof rt[1].handleEvent == "function" ? rt[1].handleEvent : null;
      if (Wt !== null) {
        const kt = j.get(rt[1]);
        kt !== void 0 ? rt[1] = kt : (rt[1] = (bt) => {
          u(f.currentTime, f.sampleRate, () => Wt(bt));
        }, j.set(Wt, rt[1]));
      }
    }
    return Z.call(y.port1, rt[0], rt[1], rt[2]);
  })(y.port1.addEventListener), y.port1.removeEventListener = /* @__PURE__ */ ((Z) => (...rt) => {
    if (rt[0] === "message") {
      const Wt = j.get(rt[1]);
      Wt !== void 0 && (j.delete(rt[1]), rt[1] = Wt);
    }
    return Z.call(y.port1, rt[0], rt[1], rt[2]);
  })(y.port1.removeEventListener);
  let E = null;
  Object.defineProperty(y.port1, "onmessage", {
    get: () => E,
    set: (Z) => {
      typeof E == "function" && y.port1.removeEventListener("message", E), E = typeof Z == "function" ? Z : null, typeof E == "function" && (y.port1.addEventListener("message", E), y.port1.start());
    }
  }), m.prototype.port = y.port1;
  let R = null;
  Zg(f, tt, m, g).then((Z) => R = Z);
  const Q = $r(g.numberOfInputs, g.channelCount), K = $r(g.numberOfOutputs, _), z = m.parameterDescriptors === void 0 ? [] : m.parameterDescriptors.reduce((Z, { name: rt }) => ({ ...Z, [rt]: new Float32Array(128) }), {});
  let H = !0;
  const st = () => {
    g.numberOfOutputs > 0 && k.disconnect(I);
    for (let Z = 0, rt = 0; Z < g.numberOfOutputs; Z += 1) {
      const Wt = N[Z];
      for (let kt = 0; kt < _[Z]; kt += 1)
        I.disconnect(Wt, rt + kt, kt);
      rt += _[Z];
    }
  }, M = /* @__PURE__ */ new Map();
  k.onaudioprocess = ({ inputBuffer: Z, outputBuffer: rt }) => {
    if (R !== null) {
      const Wt = h(tt);
      for (let kt = 0; kt < D; kt += 128) {
        for (let bt = 0; bt < g.numberOfInputs; bt += 1)
          for (let Ft = 0; Ft < g.channelCount; Ft += 1)
            Br(Z, Q[bt], Ft, Ft, kt);
        m.parameterDescriptors !== void 0 && m.parameterDescriptors.forEach(({ name: bt }, Ft) => {
          Br(Z, z, bt, v + Ft, kt);
        });
        for (let bt = 0; bt < g.numberOfInputs; bt += 1)
          for (let Ft = 0; Ft < _[bt]; Ft += 1)
            K[bt][Ft].byteLength === 0 && (K[bt][Ft] = new Float32Array(128));
        try {
          const bt = Q.map((ue, he) => {
            if (Wt[he].size > 0)
              return M.set(he, D / 128), ue;
            const Pe = M.get(he);
            return Pe === void 0 ? [] : (ue.every((zn) => zn.every((us) => us === 0)) && (Pe === 1 ? M.delete(he) : M.set(he, Pe - 1)), ue);
          });
          H = u(f.currentTime + kt / f.sampleRate, f.sampleRate, () => R.process(bt, K, z));
          for (let ue = 0, he = 0; ue < g.numberOfOutputs; ue += 1) {
            for (let Te = 0; Te < _[ue]; Te += 1)
              Wh(rt, K[ue], Te, he + Te, kt);
            he += _[ue];
          }
        } catch (bt) {
          H = !1, tt.dispatchEvent(new ErrorEvent("processorerror", {
            colno: bt.colno,
            filename: bt.filename,
            lineno: bt.lineno,
            message: bt.message
          }));
        }
        if (!H) {
          for (let bt = 0; bt < g.numberOfInputs; bt += 1) {
            w[bt].disconnect(S[bt]);
            for (let Ft = 0; Ft < g.channelCount; Ft += 1)
              S[kt].disconnect(O, Ft, bt * g.channelCount + Ft);
          }
          if (m.parameterDescriptors !== void 0) {
            const bt = m.parameterDescriptors.length;
            for (let Ft = 0; Ft < bt; Ft += 1) {
              const ue = b[Ft];
              ue.disconnect(O, 0, v + Ft), ue.stop();
            }
          }
          O.disconnect(k), k.onaudioprocess = null, ct ? st() : Y();
          break;
        }
      }
    }
  };
  let ct = !1;
  const et = o(f, {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "discrete",
    gain: 0
  }), Tt = () => k.connect(et).connect(f.destination), Y = () => {
    k.disconnect(et), et.disconnect();
  }, te = () => {
    if (H) {
      Y(), g.numberOfOutputs > 0 && k.connect(I);
      for (let Z = 0, rt = 0; Z < g.numberOfOutputs; Z += 1) {
        const Wt = N[Z];
        for (let kt = 0; kt < _[Z]; kt += 1)
          I.connect(Wt, rt + kt, kt);
        rt += _[Z];
      }
    }
    ct = !0;
  }, Ut = () => {
    H && (Tt(), st()), ct = !1;
  };
  return Tt(), d(tt, te, Ut);
}, qh = (n, t) => {
  const e = n.createBiquadFilter();
  return ce(e, t), Qt(e, t, "Q"), Qt(e, t, "detune"), Qt(e, t, "frequency"), Qt(e, t, "gain"), Gt(e, t, "type"), e;
}, Xg = (n, t) => (e, s) => {
  const i = e.createChannelMerger(s.numberOfInputs);
  return n !== null && n.name === "webkitAudioContext" && t(e, i), ce(i, s), i;
}, Ug = (n) => {
  const t = n.numberOfOutputs;
  Object.defineProperty(n, "channelCount", {
    get: () => t,
    set: (e) => {
      if (e !== t)
        throw fe();
    }
  }), Object.defineProperty(n, "channelCountMode", {
    get: () => "explicit",
    set: (e) => {
      if (e !== "explicit")
        throw fe();
    }
  }), Object.defineProperty(n, "channelInterpretation", {
    get: () => "discrete",
    set: (e) => {
      if (e !== "discrete")
        throw fe();
    }
  });
}, Xi = (n, t) => {
  const e = n.createChannelSplitter(t.numberOfOutputs);
  return ce(e, t), Ug(e), e;
}, Hg = (n, t, e, s, i) => (r, o) => {
  if (r.createConstantSource === void 0)
    return e(r, o);
  const a = r.createConstantSource();
  return ce(a, o), Qt(a, o, "offset"), t(s, () => s(r)) || Za(a), t(i, () => i(r)) || Ya(a), n(r, a), a;
}, ti = (n, t) => (n.connect = t.connect.bind(t), n.disconnect = t.disconnect.bind(t), n), Kg = (n, t, e, s) => (i, { offset: r, ...o }) => {
  const a = i.createBuffer(1, 2, 44100), c = t(i, {
    buffer: null,
    channelCount: 2,
    channelCountMode: "max",
    channelInterpretation: "speakers",
    loop: !1,
    loopEnd: 0,
    loopStart: 0,
    playbackRate: 1
  }), l = e(i, { ...o, gain: r }), u = a.getChannelData(0);
  u[0] = 1, u[1] = 1, c.buffer = a, c.loop = !0;
  const h = {
    get bufferSize() {
    },
    get channelCount() {
      return l.channelCount;
    },
    set channelCount(p) {
      l.channelCount = p;
    },
    get channelCountMode() {
      return l.channelCountMode;
    },
    set channelCountMode(p) {
      l.channelCountMode = p;
    },
    get channelInterpretation() {
      return l.channelInterpretation;
    },
    set channelInterpretation(p) {
      l.channelInterpretation = p;
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
    set onended(p) {
      c.onended = p;
    },
    addEventListener(...p) {
      return c.addEventListener(p[0], p[1], p[2]);
    },
    dispatchEvent(...p) {
      return c.dispatchEvent(p[0]);
    },
    removeEventListener(...p) {
      return c.removeEventListener(p[0], p[1], p[2]);
    },
    start(p = 0) {
      c.start.call(c, p);
    },
    stop(p = 0) {
      c.stop.call(c, p);
    }
  }, d = () => c.connect(l), f = () => c.disconnect(l);
  return n(i, c), s(ti(h, l), d, f);
}, Qg = (n, t) => (e, s) => {
  const i = e.createConvolver();
  if (ce(i, s), s.disableNormalization === i.normalize && (i.normalize = !s.disableNormalization), Gt(i, s, "buffer"), s.channelCount > 2 || (t(i, "channelCount", (r) => () => r.call(i), (r) => (o) => {
    if (o > 2)
      throw n();
    return r.call(i, o);
  }), s.channelCountMode === "max"))
    throw n();
  return t(i, "channelCountMode", (r) => () => r.call(i), (r) => (o) => {
    if (o === "max")
      throw n();
    return r.call(i, o);
  }), i;
}, Bh = (n, t) => {
  const e = n.createDelay(t.maxDelayTime);
  return ce(e, t), Qt(e, t, "delayTime"), e;
}, Jg = (n) => (t, e) => {
  const s = t.createDynamicsCompressor();
  if (ce(s, e), e.channelCount > 2 || e.channelCountMode === "max")
    throw n();
  return Qt(s, e, "attack"), Qt(s, e, "knee"), Qt(s, e, "ratio"), Qt(s, e, "release"), Qt(s, e, "threshold"), s;
}, Le = (n, t) => {
  const e = n.createGain();
  return ce(e, t), Qt(e, t, "gain"), e;
}, t_ = (n) => (t, e, s) => {
  if (t.createIIRFilter === void 0)
    return n(t, e, s);
  const i = t.createIIRFilter(s.feedforward, s.feedback);
  return ce(i, s), i;
};
function e_(n, t) {
  const e = t[0] * t[0] + t[1] * t[1];
  return [(n[0] * t[0] + n[1] * t[1]) / e, (n[1] * t[0] - n[0] * t[1]) / e];
}
function n_(n, t) {
  return [n[0] * t[0] - n[1] * t[1], n[0] * t[1] + n[1] * t[0]];
}
function Zl(n, t) {
  let e = [0, 0];
  for (let s = n.length - 1; s >= 0; s -= 1)
    e = n_(e, t), e[0] += n[s];
  return e;
}
const s_ = (n, t, e, s) => (i, r, { channelCount: o, channelCountMode: a, channelInterpretation: c, feedback: l, feedforward: u }) => {
  const h = Lh(r, i.sampleRate), d = l instanceof Float64Array ? l : new Float64Array(l), f = u instanceof Float64Array ? u : new Float64Array(u), p = d.length, m = f.length, g = Math.min(p, m);
  if (p === 0 || p > 20)
    throw s();
  if (d[0] === 0)
    throw t();
  if (m === 0 || m > 20)
    throw s();
  if (f[0] === 0)
    throw t();
  if (d[0] !== 1) {
    for (let b = 0; b < m; b += 1)
      f[b] /= d[0];
    for (let b = 1; b < p; b += 1)
      d[b] /= d[0];
  }
  const _ = e(i, h, o, o);
  _.channelCount = o, _.channelCountMode = a, _.channelInterpretation = c;
  const v = 32, x = [], T = [], y = [];
  for (let b = 0; b < o; b += 1) {
    x.push(0);
    const O = new Float32Array(v), D = new Float32Array(v);
    O.fill(0), D.fill(0), T.push(O), y.push(D);
  }
  _.onaudioprocess = (b) => {
    const O = b.inputBuffer, D = b.outputBuffer, k = O.numberOfChannels;
    for (let I = 0; I < k; I += 1) {
      const N = O.getChannelData(I), F = D.getChannelData(I);
      x[I] = jh(d, p, f, m, g, T[I], y[I], x[I], v, N, F);
    }
  };
  const w = i.sampleRate / 2;
  return ti({
    get bufferSize() {
      return h;
    },
    get channelCount() {
      return _.channelCount;
    },
    set channelCount(b) {
      _.channelCount = b;
    },
    get channelCountMode() {
      return _.channelCountMode;
    },
    set channelCountMode(b) {
      _.channelCountMode = b;
    },
    get channelInterpretation() {
      return _.channelInterpretation;
    },
    set channelInterpretation(b) {
      _.channelInterpretation = b;
    },
    get context() {
      return _.context;
    },
    get inputs() {
      return [_];
    },
    get numberOfInputs() {
      return _.numberOfInputs;
    },
    get numberOfOutputs() {
      return _.numberOfOutputs;
    },
    addEventListener(...b) {
      return _.addEventListener(b[0], b[1], b[2]);
    },
    dispatchEvent(...b) {
      return _.dispatchEvent(b[0]);
    },
    getFrequencyResponse(b, O, D) {
      if (b.length !== O.length || O.length !== D.length)
        throw n();
      const k = b.length;
      for (let I = 0; I < k; I += 1) {
        const N = -Math.PI * (b[I] / w), F = [Math.cos(N), Math.sin(N)], $ = Zl(f, F), L = Zl(d, F), q = e_($, L);
        O[I] = Math.sqrt(q[0] * q[0] + q[1] * q[1]), D[I] = Math.atan2(q[1], q[0]);
      }
    },
    removeEventListener(...b) {
      return _.removeEventListener(b[0], b[1], b[2]);
    }
  }, _);
}, i_ = (n, t) => n.createMediaElementSource(t.mediaElement), r_ = (n, t) => {
  const e = n.createMediaStreamDestination();
  return ce(e, t), e.numberOfOutputs === 1 && Object.defineProperty(e, "numberOfOutputs", { get: () => 0 }), e;
}, o_ = (n, { mediaStream: t }) => {
  const e = t.getAudioTracks();
  e.sort((r, o) => r.id < o.id ? -1 : r.id > o.id ? 1 : 0);
  const s = e.slice(0, 1), i = n.createMediaStreamSource(new MediaStream(s));
  return Object.defineProperty(i, "mediaStream", { value: t }), i;
}, a_ = (n, t) => (e, { mediaStreamTrack: s }) => {
  if (typeof e.createMediaStreamTrackSource == "function")
    return e.createMediaStreamTrackSource(s);
  const i = new MediaStream([s]), r = e.createMediaStreamSource(i);
  if (s.kind !== "audio")
    throw n();
  if (t(e))
    throw new TypeError();
  return r;
}, c_ = (n) => n === null ? null : n.hasOwnProperty("OfflineAudioContext") ? n.OfflineAudioContext : n.hasOwnProperty("webkitOfflineAudioContext") ? n.webkitOfflineAudioContext : null, l_ = (n, t, e, s, i, r) => (o, a) => {
  const c = o.createOscillator();
  return ce(c, a), Qt(c, a, "detune"), Qt(c, a, "frequency"), a.periodicWave !== void 0 ? c.setPeriodicWave(a.periodicWave) : Gt(c, a, "type"), t(e, () => e(o)) || Za(c), t(s, () => s(o)) || r(c, o), t(i, () => i(o)) || Ya(c), n(o, c), c;
}, u_ = (n) => (t, e) => {
  const s = t.createPanner();
  return s.orientationX === void 0 ? n(t, e) : (ce(s, e), Qt(s, e, "orientationX"), Qt(s, e, "orientationY"), Qt(s, e, "orientationZ"), Qt(s, e, "positionX"), Qt(s, e, "positionY"), Qt(s, e, "positionZ"), Gt(s, e, "coneInnerAngle"), Gt(s, e, "coneOuterAngle"), Gt(s, e, "coneOuterGain"), Gt(s, e, "distanceModel"), Gt(s, e, "maxDistance"), Gt(s, e, "panningModel"), Gt(s, e, "refDistance"), Gt(s, e, "rolloffFactor"), s);
}, h_ = (n, t, e, s, i, r, o, a, c, l) => (u, { coneInnerAngle: h, coneOuterAngle: d, coneOuterGain: f, distanceModel: p, maxDistance: m, orientationX: g, orientationY: _, orientationZ: v, panningModel: x, positionX: T, positionY: y, positionZ: w, refDistance: S, rolloffFactor: b, ...O }) => {
  const D = u.createPanner();
  if (O.channelCount > 2 || O.channelCountMode === "max")
    throw o();
  ce(D, O);
  const k = {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "discrete"
  }, I = e(u, {
    ...k,
    channelInterpretation: "speakers",
    numberOfInputs: 6
  }), N = s(u, { ...O, gain: 1 }), F = s(u, { ...k, gain: 1 }), $ = s(u, { ...k, gain: 0 }), L = s(u, { ...k, gain: 0 }), q = s(u, { ...k, gain: 0 }), tt = s(u, { ...k, gain: 0 }), j = s(u, { ...k, gain: 0 }), E = i(u, 256, 6, 1), R = r(u, {
    ...k,
    curve: new Float32Array([1, 1]),
    oversample: "none"
  });
  let B = [g, _, v], Q = [T, y, w];
  const K = new Float32Array(1);
  E.onaudioprocess = ({ inputBuffer: M }) => {
    const ct = [
      c(M, K, 0),
      c(M, K, 1),
      c(M, K, 2)
    ];
    ct.some((Tt, Y) => Tt !== B[Y]) && (D.setOrientation(...ct), B = ct);
    const et = [
      c(M, K, 3),
      c(M, K, 4),
      c(M, K, 5)
    ];
    et.some((Tt, Y) => Tt !== Q[Y]) && (D.setPosition(...et), Q = et);
  }, Object.defineProperty($.gain, "defaultValue", { get: () => 0 }), Object.defineProperty(L.gain, "defaultValue", { get: () => 0 }), Object.defineProperty(q.gain, "defaultValue", { get: () => 0 }), Object.defineProperty(tt.gain, "defaultValue", { get: () => 0 }), Object.defineProperty(j.gain, "defaultValue", { get: () => 0 });
  const z = {
    get bufferSize() {
    },
    get channelCount() {
      return D.channelCount;
    },
    set channelCount(M) {
      if (M > 2)
        throw o();
      N.channelCount = M, D.channelCount = M;
    },
    get channelCountMode() {
      return D.channelCountMode;
    },
    set channelCountMode(M) {
      if (M === "max")
        throw o();
      N.channelCountMode = M, D.channelCountMode = M;
    },
    get channelInterpretation() {
      return D.channelInterpretation;
    },
    set channelInterpretation(M) {
      N.channelInterpretation = M, D.channelInterpretation = M;
    },
    get coneInnerAngle() {
      return D.coneInnerAngle;
    },
    set coneInnerAngle(M) {
      D.coneInnerAngle = M;
    },
    get coneOuterAngle() {
      return D.coneOuterAngle;
    },
    set coneOuterAngle(M) {
      D.coneOuterAngle = M;
    },
    get coneOuterGain() {
      return D.coneOuterGain;
    },
    set coneOuterGain(M) {
      if (M < 0 || M > 1)
        throw t();
      D.coneOuterGain = M;
    },
    get context() {
      return D.context;
    },
    get distanceModel() {
      return D.distanceModel;
    },
    set distanceModel(M) {
      D.distanceModel = M;
    },
    get inputs() {
      return [N];
    },
    get maxDistance() {
      return D.maxDistance;
    },
    set maxDistance(M) {
      if (M < 0)
        throw new RangeError();
      D.maxDistance = M;
    },
    get numberOfInputs() {
      return D.numberOfInputs;
    },
    get numberOfOutputs() {
      return D.numberOfOutputs;
    },
    get orientationX() {
      return F.gain;
    },
    get orientationY() {
      return $.gain;
    },
    get orientationZ() {
      return L.gain;
    },
    get panningModel() {
      return D.panningModel;
    },
    set panningModel(M) {
      D.panningModel = M;
    },
    get positionX() {
      return q.gain;
    },
    get positionY() {
      return tt.gain;
    },
    get positionZ() {
      return j.gain;
    },
    get refDistance() {
      return D.refDistance;
    },
    set refDistance(M) {
      if (M < 0)
        throw new RangeError();
      D.refDistance = M;
    },
    get rolloffFactor() {
      return D.rolloffFactor;
    },
    set rolloffFactor(M) {
      if (M < 0)
        throw new RangeError();
      D.rolloffFactor = M;
    },
    addEventListener(...M) {
      return N.addEventListener(M[0], M[1], M[2]);
    },
    dispatchEvent(...M) {
      return N.dispatchEvent(M[0]);
    },
    removeEventListener(...M) {
      return N.removeEventListener(M[0], M[1], M[2]);
    }
  };
  h !== z.coneInnerAngle && (z.coneInnerAngle = h), d !== z.coneOuterAngle && (z.coneOuterAngle = d), f !== z.coneOuterGain && (z.coneOuterGain = f), p !== z.distanceModel && (z.distanceModel = p), m !== z.maxDistance && (z.maxDistance = m), g !== z.orientationX.value && (z.orientationX.value = g), _ !== z.orientationY.value && (z.orientationY.value = _), v !== z.orientationZ.value && (z.orientationZ.value = v), x !== z.panningModel && (z.panningModel = x), T !== z.positionX.value && (z.positionX.value = T), y !== z.positionY.value && (z.positionY.value = y), w !== z.positionZ.value && (z.positionZ.value = w), S !== z.refDistance && (z.refDistance = S), b !== z.rolloffFactor && (z.rolloffFactor = b), (B[0] !== 1 || B[1] !== 0 || B[2] !== 0) && D.setOrientation(...B), (Q[0] !== 0 || Q[1] !== 0 || Q[2] !== 0) && D.setPosition(...Q);
  const H = () => {
    N.connect(D), n(N, R, 0, 0), R.connect(F).connect(I, 0, 0), R.connect($).connect(I, 0, 1), R.connect(L).connect(I, 0, 2), R.connect(q).connect(I, 0, 3), R.connect(tt).connect(I, 0, 4), R.connect(j).connect(I, 0, 5), I.connect(E).connect(u.destination);
  }, st = () => {
    N.disconnect(D), a(N, R, 0, 0), R.disconnect(F), F.disconnect(I), R.disconnect($), $.disconnect(I), R.disconnect(L), L.disconnect(I), R.disconnect(q), q.disconnect(I), R.disconnect(tt), tt.disconnect(I), R.disconnect(j), j.disconnect(I), I.disconnect(E), E.disconnect(u.destination);
  };
  return l(ti(z, D), H, st);
}, d_ = (n) => (t, { disableNormalization: e, imag: s, real: i }) => {
  const r = s instanceof Float32Array ? s : new Float32Array(s), o = i instanceof Float32Array ? i : new Float32Array(i), a = t.createPeriodicWave(o, r, { disableNormalization: e });
  if (Array.from(s).length < 2)
    throw n();
  return a;
}, Ui = (n, t, e, s) => n.createScriptProcessor(t, e, s), f_ = (n, t) => (e, s) => {
  const i = s.channelCountMode;
  if (i === "clamped-max")
    throw t();
  if (e.createStereoPanner === void 0)
    return n(e, s);
  const r = e.createStereoPanner();
  return ce(r, s), Qt(r, s, "pan"), Object.defineProperty(r, "channelCountMode", {
    get: () => i,
    set: (o) => {
      if (o !== i)
        throw t();
    }
  }), r;
}, p_ = (n, t, e, s, i, r) => {
  const a = new Float32Array([1, 1]), c = Math.PI / 2, l = { channelCount: 1, channelCountMode: "explicit", channelInterpretation: "discrete" }, u = { ...l, oversample: "none" }, h = (p, m, g, _) => {
    const v = new Float32Array(16385), x = new Float32Array(16385);
    for (let O = 0; O < 16385; O += 1) {
      const D = O / 16384 * c;
      v[O] = Math.cos(D), x[O] = Math.sin(D);
    }
    const T = e(p, { ...l, gain: 0 }), y = s(p, { ...u, curve: v }), w = s(p, { ...u, curve: a }), S = e(p, { ...l, gain: 0 }), b = s(p, { ...u, curve: x });
    return {
      connectGraph() {
        m.connect(T), m.connect(w.inputs === void 0 ? w : w.inputs[0]), m.connect(S), w.connect(g), g.connect(y.inputs === void 0 ? y : y.inputs[0]), g.connect(b.inputs === void 0 ? b : b.inputs[0]), y.connect(T.gain), b.connect(S.gain), T.connect(_, 0, 0), S.connect(_, 0, 1);
      },
      disconnectGraph() {
        m.disconnect(T), m.disconnect(w.inputs === void 0 ? w : w.inputs[0]), m.disconnect(S), w.disconnect(g), g.disconnect(y.inputs === void 0 ? y : y.inputs[0]), g.disconnect(b.inputs === void 0 ? b : b.inputs[0]), y.disconnect(T.gain), b.disconnect(S.gain), T.disconnect(_, 0, 0), S.disconnect(_, 0, 1);
      }
    };
  }, d = (p, m, g, _) => {
    const v = new Float32Array(16385), x = new Float32Array(16385), T = new Float32Array(16385), y = new Float32Array(16385), w = Math.floor(16385 / 2);
    for (let q = 0; q < 16385; q += 1)
      if (q > w) {
        const tt = (q - w) / (16384 - w) * c;
        v[q] = Math.cos(tt), x[q] = Math.sin(tt), T[q] = 0, y[q] = 1;
      } else {
        const tt = q / (16384 - w) * c;
        v[q] = 1, x[q] = 0, T[q] = Math.cos(tt), y[q] = Math.sin(tt);
      }
    const S = t(p, {
      channelCount: 2,
      channelCountMode: "explicit",
      channelInterpretation: "discrete",
      numberOfOutputs: 2
    }), b = e(p, { ...l, gain: 0 }), O = s(p, {
      ...u,
      curve: v
    }), D = e(p, { ...l, gain: 0 }), k = s(p, {
      ...u,
      curve: x
    }), I = s(p, { ...u, curve: a }), N = e(p, { ...l, gain: 0 }), F = s(p, {
      ...u,
      curve: T
    }), $ = e(p, { ...l, gain: 0 }), L = s(p, {
      ...u,
      curve: y
    });
    return {
      connectGraph() {
        m.connect(S), m.connect(I.inputs === void 0 ? I : I.inputs[0]), S.connect(b, 0), S.connect(D, 0), S.connect(N, 1), S.connect($, 1), I.connect(g), g.connect(O.inputs === void 0 ? O : O.inputs[0]), g.connect(k.inputs === void 0 ? k : k.inputs[0]), g.connect(F.inputs === void 0 ? F : F.inputs[0]), g.connect(L.inputs === void 0 ? L : L.inputs[0]), O.connect(b.gain), k.connect(D.gain), F.connect(N.gain), L.connect($.gain), b.connect(_, 0, 0), N.connect(_, 0, 0), D.connect(_, 0, 1), $.connect(_, 0, 1);
      },
      disconnectGraph() {
        m.disconnect(S), m.disconnect(I.inputs === void 0 ? I : I.inputs[0]), S.disconnect(b, 0), S.disconnect(D, 0), S.disconnect(N, 1), S.disconnect($, 1), I.disconnect(g), g.disconnect(O.inputs === void 0 ? O : O.inputs[0]), g.disconnect(k.inputs === void 0 ? k : k.inputs[0]), g.disconnect(F.inputs === void 0 ? F : F.inputs[0]), g.disconnect(L.inputs === void 0 ? L : L.inputs[0]), O.disconnect(b.gain), k.disconnect(D.gain), F.disconnect(N.gain), L.disconnect($.gain), b.disconnect(_, 0, 0), N.disconnect(_, 0, 0), D.disconnect(_, 0, 1), $.disconnect(_, 0, 1);
      }
    };
  }, f = (p, m, g, _, v) => {
    if (m === 1)
      return h(p, g, _, v);
    if (m === 2)
      return d(p, g, _, v);
    throw i();
  };
  return (p, { channelCount: m, channelCountMode: g, pan: _, ...v }) => {
    if (g === "max")
      throw i();
    const x = n(p, {
      ...v,
      channelCount: 1,
      channelCountMode: g,
      numberOfInputs: 2
    }), T = e(p, { ...v, channelCount: m, channelCountMode: g, gain: 1 }), y = e(p, {
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "discrete",
      gain: _
    });
    let { connectGraph: w, disconnectGraph: S } = f(p, m, T, y, x);
    Object.defineProperty(y.gain, "defaultValue", { get: () => 0 }), Object.defineProperty(y.gain, "maxValue", { get: () => 1 }), Object.defineProperty(y.gain, "minValue", { get: () => -1 });
    const b = {
      get bufferSize() {
      },
      get channelCount() {
        return T.channelCount;
      },
      set channelCount(I) {
        T.channelCount !== I && (O && S(), { connectGraph: w, disconnectGraph: S } = f(p, I, T, y, x), O && w()), T.channelCount = I;
      },
      get channelCountMode() {
        return T.channelCountMode;
      },
      set channelCountMode(I) {
        if (I === "clamped-max" || I === "max")
          throw i();
        T.channelCountMode = I;
      },
      get channelInterpretation() {
        return T.channelInterpretation;
      },
      set channelInterpretation(I) {
        T.channelInterpretation = I;
      },
      get context() {
        return T.context;
      },
      get inputs() {
        return [T];
      },
      get numberOfInputs() {
        return T.numberOfInputs;
      },
      get numberOfOutputs() {
        return T.numberOfOutputs;
      },
      get pan() {
        return y.gain;
      },
      addEventListener(...I) {
        return T.addEventListener(I[0], I[1], I[2]);
      },
      dispatchEvent(...I) {
        return T.dispatchEvent(I[0]);
      },
      removeEventListener(...I) {
        return T.removeEventListener(I[0], I[1], I[2]);
      }
    };
    let O = !1;
    const D = () => {
      w(), O = !0;
    }, k = () => {
      S(), O = !1;
    };
    return r(ti(b, x), D, k);
  };
}, m_ = (n, t, e, s, i, r, o) => (a, c) => {
  const l = a.createWaveShaper();
  if (r !== null && r.name === "webkitAudioContext" && a.createGain().gain.automationRate === void 0)
    return e(a, c);
  ce(l, c);
  const u = c.curve === null || c.curve instanceof Float32Array ? c.curve : new Float32Array(c.curve);
  if (u !== null && u.length < 2)
    throw t();
  Gt(l, { curve: u }, "curve"), Gt(l, c, "oversample");
  let h = null, d = !1;
  return o(l, "curve", (m) => () => m.call(l), (m) => (g) => (m.call(l, g), d && (s(g) && h === null ? h = n(a, l) : !s(g) && h !== null && (h(), h = null)), g)), i(l, () => {
    d = !0, s(l.curve) && (h = n(a, l));
  }, () => {
    d = !1, h !== null && (h(), h = null);
  });
}, g_ = (n, t, e, s, i) => (r, { curve: o, oversample: a, ...c }) => {
  const l = r.createWaveShaper(), u = r.createWaveShaper();
  ce(l, c), ce(u, c);
  const h = e(r, { ...c, gain: 1 }), d = e(r, { ...c, gain: -1 }), f = e(r, { ...c, gain: 1 }), p = e(r, { ...c, gain: -1 });
  let m = null, g = !1, _ = null;
  const v = {
    get bufferSize() {
    },
    get channelCount() {
      return l.channelCount;
    },
    set channelCount(y) {
      h.channelCount = y, d.channelCount = y, l.channelCount = y, f.channelCount = y, u.channelCount = y, p.channelCount = y;
    },
    get channelCountMode() {
      return l.channelCountMode;
    },
    set channelCountMode(y) {
      h.channelCountMode = y, d.channelCountMode = y, l.channelCountMode = y, f.channelCountMode = y, u.channelCountMode = y, p.channelCountMode = y;
    },
    get channelInterpretation() {
      return l.channelInterpretation;
    },
    set channelInterpretation(y) {
      h.channelInterpretation = y, d.channelInterpretation = y, l.channelInterpretation = y, f.channelInterpretation = y, u.channelInterpretation = y, p.channelInterpretation = y;
    },
    get context() {
      return l.context;
    },
    get curve() {
      return _;
    },
    set curve(y) {
      if (y !== null && y.length < 2)
        throw t();
      if (y === null)
        l.curve = y, u.curve = y;
      else {
        const w = y.length, S = new Float32Array(w + 2 - w % 2), b = new Float32Array(w + 2 - w % 2);
        S[0] = y[0], b[0] = -y[w - 1];
        const O = Math.ceil((w + 1) / 2), D = (w + 1) / 2 - 1;
        for (let k = 1; k < O; k += 1) {
          const I = k / O * D, N = Math.floor(I), F = Math.ceil(I);
          S[k] = N === F ? y[N] : (1 - (I - N)) * y[N] + (1 - (F - I)) * y[F], b[k] = N === F ? -y[w - 1 - N] : -((1 - (I - N)) * y[w - 1 - N]) - (1 - (F - I)) * y[w - 1 - F];
        }
        S[O] = w % 2 === 1 ? y[O - 1] : (y[O - 2] + y[O - 1]) / 2, l.curve = S, u.curve = b;
      }
      _ = y, g && (s(_) && m === null ? m = n(r, h) : m !== null && (m(), m = null));
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
  o !== null && (v.curve = o instanceof Float32Array ? o : new Float32Array(o)), a !== v.oversample && (v.oversample = a);
  const x = () => {
    h.connect(l).connect(f), h.connect(d).connect(u).connect(p).connect(f), g = !0, s(_) && (m = n(r, h));
  }, T = () => {
    h.disconnect(l), l.disconnect(f), h.disconnect(d), d.disconnect(u), u.disconnect(p), p.disconnect(f), g = !1, m !== null && (m(), m = null);
  };
  return i(ti(v, f), x, T);
}, Ne = () => new DOMException("", "NotSupportedError"), __ = {
  numberOfChannels: 1
}, y_ = (n, t, e, s, i) => class extends n {
  constructor(o, a, c) {
    let l;
    if (typeof o == "number" && a !== void 0 && c !== void 0)
      l = { length: a, numberOfChannels: o, sampleRate: c };
    else if (typeof o == "object")
      l = o;
    else
      throw new Error("The given parameters are not valid.");
    const { length: u, numberOfChannels: h, sampleRate: d } = { ...__, ...l }, f = s(h, u, d);
    t(Ni, () => Ni(f)) || f.addEventListener("statechange", /* @__PURE__ */ (() => {
      let p = 0;
      const m = (g) => {
        this._state === "running" && (p > 0 ? (f.removeEventListener("statechange", m), g.stopImmediatePropagation(), this._waitForThePromiseToSettle(g)) : p += 1);
      };
      return m;
    })()), super(f, h), this._length = u, this._nativeOfflineAudioContext = f, this._state = null;
  }
  get length() {
    return this._nativeOfflineAudioContext.length === void 0 ? this._length : this._nativeOfflineAudioContext.length;
  }
  get state() {
    return this._state === null ? this._nativeOfflineAudioContext.state : this._state;
  }
  startRendering() {
    return this._state === "running" ? Promise.reject(e()) : (this._state = "running", i(this.destination, this._nativeOfflineAudioContext).finally(() => {
      this._state = null, Mh(this);
    }));
  }
  _waitForThePromiseToSettle(o) {
    this._state === null ? this._nativeOfflineAudioContext.dispatchEvent(o) : setTimeout(() => this._waitForThePromiseToSettle(o));
  }
}, v_ = {
  channelCount: 2,
  channelCountMode: "max",
  // This attribute has no effect for nodes with no inputs.
  channelInterpretation: "speakers",
  // This attribute has no effect for nodes with no inputs.
  detune: 0,
  frequency: 440,
  periodicWave: void 0,
  type: "sine"
}, b_ = (n, t, e, s, i, r, o) => class extends n {
  constructor(c, l) {
    const u = i(c), h = { ...v_, ...l }, d = e(u, h), f = r(u), p = f ? s() : null, m = c.sampleRate / 2;
    super(c, !1, d, p), this._detune = t(this, f, d.detune, 153600, -153600), this._frequency = t(this, f, d.frequency, m, -m), this._nativeOscillatorNode = d, this._onended = null, this._oscillatorNodeRenderer = p, this._oscillatorNodeRenderer !== null && h.periodicWave !== void 0 && (this._oscillatorNodeRenderer.periodicWave = h.periodicWave);
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
      zs(this);
      const l = () => {
        this._nativeOscillatorNode.removeEventListener("ended", l), Mn(this) && Gi(this);
      };
      this._nativeOscillatorNode.addEventListener("ended", l);
    }
  }
  stop(c = 0) {
    this._nativeOscillatorNode.stop(c), this._oscillatorNodeRenderer !== null && (this._oscillatorNodeRenderer.stop = c);
  }
}, x_ = (n, t, e, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap();
  let o = null, a = null, c = null;
  const l = async (u, h) => {
    let d = e(u);
    const f = Se(d, h);
    if (!f) {
      const p = {
        channelCount: d.channelCount,
        channelCountMode: d.channelCountMode,
        channelInterpretation: d.channelInterpretation,
        detune: d.detune.value,
        frequency: d.frequency.value,
        periodicWave: o === null ? void 0 : o,
        type: d.type
      };
      d = t(h, p), a !== null && d.start(a), c !== null && d.stop(c);
    }
    return r.set(h, d), f ? (await n(h, u.detune, d.detune), await n(h, u.frequency, d.frequency)) : (await s(h, u.detune, d.detune), await s(h, u.frequency, d.frequency)), await i(u, h, d), d;
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
}, w_ = {
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
}, C_ = (n, t, e, s, i, r, o) => class extends n {
  constructor(c, l) {
    const u = i(c), h = { ...w_, ...l }, d = e(u, h), f = r(u), p = f ? s() : null;
    super(c, !1, d, p), this._nativePannerNode = d, this._orientationX = t(this, f, d.orientationX, Ie, Ve), this._orientationY = t(this, f, d.orientationY, Ie, Ve), this._orientationZ = t(this, f, d.orientationZ, Ie, Ve), this._positionX = t(this, f, d.positionX, Ie, Ve), this._positionY = t(this, f, d.positionY, Ie, Ve), this._positionZ = t(this, f, d.positionZ, Ie, Ve), o(this, 1);
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
}, S_ = (n, t, e, s, i, r, o, a, c, l) => () => {
  const u = /* @__PURE__ */ new WeakMap();
  let h = null;
  const d = async (f, p) => {
    let m = null, g = r(f);
    const _ = {
      channelCount: g.channelCount,
      channelCountMode: g.channelCountMode,
      channelInterpretation: g.channelInterpretation
    }, v = {
      ..._,
      coneInnerAngle: g.coneInnerAngle,
      coneOuterAngle: g.coneOuterAngle,
      coneOuterGain: g.coneOuterGain,
      distanceModel: g.distanceModel,
      maxDistance: g.maxDistance,
      panningModel: g.panningModel,
      refDistance: g.refDistance,
      rolloffFactor: g.rolloffFactor
    }, x = Se(g, p);
    if ("bufferSize" in g)
      m = s(p, { ..._, gain: 1 });
    else if (!x) {
      const T = {
        ...v,
        orientationX: g.orientationX.value,
        orientationY: g.orientationY.value,
        orientationZ: g.orientationZ.value,
        positionX: g.positionX.value,
        positionY: g.positionY.value,
        positionZ: g.positionZ.value
      };
      g = i(p, T);
    }
    if (u.set(p, m === null ? g : m), m !== null) {
      if (h === null) {
        if (o === null)
          throw new Error("Missing the native OfflineAudioContext constructor.");
        const k = new o(
          6,
          // Bug #17: Safari does not yet expose the length.
          f.context.length,
          p.sampleRate
        ), I = t(k, {
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "speakers",
          numberOfInputs: 6
        });
        I.connect(k.destination), h = (async () => {
          const N = await Promise.all([
            f.orientationX,
            f.orientationY,
            f.orientationZ,
            f.positionX,
            f.positionY,
            f.positionZ
          ].map(async (F, $) => {
            const L = e(k, {
              channelCount: 1,
              channelCountMode: "explicit",
              channelInterpretation: "discrete",
              offset: $ === 0 ? 1 : 0
            });
            return await a(k, F, L.offset), L;
          }));
          for (let F = 0; F < 6; F += 1)
            N[F].connect(I, 0, F), N[F].start(0);
          return l(k);
        })();
      }
      const T = await h, y = s(p, { ..._, gain: 1 });
      await c(f, p, y);
      const w = [];
      for (let k = 0; k < T.numberOfChannels; k += 1)
        w.push(T.getChannelData(k));
      let S = [w[0][0], w[1][0], w[2][0]], b = [w[3][0], w[4][0], w[5][0]], O = s(p, { ..._, gain: 1 }), D = i(p, {
        ...v,
        orientationX: S[0],
        orientationY: S[1],
        orientationZ: S[2],
        positionX: b[0],
        positionY: b[1],
        positionZ: b[2]
      });
      y.connect(O).connect(D.inputs[0]), D.connect(m);
      for (let k = 128; k < T.length; k += 128) {
        const I = [w[0][k], w[1][k], w[2][k]], N = [w[3][k], w[4][k], w[5][k]];
        if (I.some((F, $) => F !== S[$]) || N.some((F, $) => F !== b[$])) {
          S = I, b = N;
          const F = k / p.sampleRate;
          O.gain.setValueAtTime(0, F), O = s(p, { ..._, gain: 0 }), D = i(p, {
            ...v,
            orientationX: S[0],
            orientationY: S[1],
            orientationZ: S[2],
            positionX: b[0],
            positionY: b[1],
            positionZ: b[2]
          }), O.gain.setValueAtTime(1, F), y.connect(O).connect(D.inputs[0]), D.connect(m);
        }
      }
      return m;
    }
    return x ? (await n(p, f.orientationX, g.orientationX), await n(p, f.orientationY, g.orientationY), await n(p, f.orientationZ, g.orientationZ), await n(p, f.positionX, g.positionX), await n(p, f.positionY, g.positionY), await n(p, f.positionZ, g.positionZ)) : (await a(p, f.orientationX, g.orientationX), await a(p, f.orientationY, g.orientationY), await a(p, f.orientationZ, g.orientationZ), await a(p, f.positionX, g.positionX), await a(p, f.positionY, g.positionY), await a(p, f.positionZ, g.positionZ)), Js(g) ? await c(f, p, g.inputs[0]) : await c(f, p, g), g;
  };
  return {
    render(f, p) {
      const m = u.get(p);
      return m !== void 0 ? Promise.resolve(m) : d(f, p);
    }
  };
}, T_ = {
  disableNormalization: !1
}, A_ = (n, t, e, s) => class $h {
  constructor(r, o) {
    const a = t(r), c = s({ ...T_, ...o }), l = n(a, c);
    return e.add(l), l;
  }
  static [Symbol.hasInstance](r) {
    return r !== null && typeof r == "object" && Object.getPrototypeOf(r) === $h.prototype || e.has(r);
  }
}, k_ = (n, t) => (e, s, i) => (n(s).replay(i), t(s, e, i)), I_ = (n, t, e) => async (s, i, r) => {
  const o = n(s);
  await Promise.all(o.activeInputs.map((a, c) => Array.from(a).map(async ([l, u]) => {
    const d = await t(l).render(l, i), f = s.context.destination;
    !e(l) && (s !== f || !e(s)) && d.connect(r, u, c);
  })).reduce((a, c) => [...a, ...c], []));
}, E_ = (n, t, e) => async (s, i, r) => {
  const o = t(s);
  await Promise.all(Array.from(o.activeInputs).map(async ([a, c]) => {
    const u = await n(a).render(a, i);
    e(a) || u.connect(r, c);
  }));
}, D_ = (n, t, e, s) => (i) => n(Ni, () => Ni(i)) ? Promise.resolve(n(s, s)).then((r) => {
  if (!r) {
    const o = e(i, 512, 0, 1);
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
}), O_ = (n) => (t, e) => {
  n.set(t, e);
}, R_ = (n) => (t, e) => n.set(t, e), M_ = (n, t, e, s, i, r, o, a) => (c, l) => e(c).render(c, l).then(() => Promise.all(Array.from(s(l)).map((u) => e(u).render(u, l)))).then(() => i(l)).then((u) => (typeof u.copyFromChannel != "function" ? (o(u), $a(u)) : t(r, () => r(u)) || a(u), n.add(u), u)), N_ = {
  channelCount: 2,
  /*
   * Bug #105: The channelCountMode should be 'clamped-max' according to the spec but is set to 'explicit' to achieve consistent
   * behavior.
   */
  channelCountMode: "explicit",
  channelInterpretation: "speakers",
  pan: 0
}, P_ = (n, t, e, s, i, r) => class extends n {
  constructor(a, c) {
    const l = i(a), u = { ...N_, ...c }, h = e(l, u), d = r(l), f = d ? s() : null;
    super(a, !1, h, f), this._pan = t(this, d, h.pan);
  }
  get pan() {
    return this._pan;
  }
}, F_ = (n, t, e, s, i) => () => {
  const r = /* @__PURE__ */ new WeakMap(), o = async (a, c) => {
    let l = e(a);
    const u = Se(l, c);
    if (!u) {
      const h = {
        channelCount: l.channelCount,
        channelCountMode: l.channelCountMode,
        channelInterpretation: l.channelInterpretation,
        pan: l.pan.value
      };
      l = t(c, h);
    }
    return r.set(c, l), u ? await n(c, a.pan, l.pan) : await s(c, a.pan, l.pan), Js(l) ? await i(a, c, l.inputs[0]) : await i(a, c, l), l;
  };
  return {
    render(a, c) {
      const l = r.get(c);
      return l !== void 0 ? Promise.resolve(l) : o(a, c);
    }
  };
}, V_ = (n) => () => {
  if (n === null)
    return !1;
  try {
    new n({ length: 1, sampleRate: 44100 });
  } catch {
    return !1;
  }
  return !0;
}, W_ = (n) => () => {
  if (n === null)
    return !1;
  const e = new n(1, 1, 44100).createBuffer(1, 1, 44100);
  if (e.copyToChannel === void 0)
    return !0;
  const s = new Float32Array(2);
  try {
    e.copyFromChannel(s, 0, 0);
  } catch {
    return !1;
  }
  return !0;
}, j_ = (n) => () => {
  if (n === null)
    return !1;
  if (n.prototype !== void 0 && n.prototype.close !== void 0)
    return !0;
  const t = new n(), e = t.close !== void 0;
  try {
    t.close();
  } catch {
  }
  return e;
}, L_ = (n) => () => {
  if (n === null)
    return Promise.resolve(!1);
  const t = new n(1, 1, 44100);
  return new Promise((e) => {
    let s = !0;
    const i = (o) => {
      s && (s = !1, t.startRendering(), e(o instanceof TypeError));
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
}, q_ = (n) => () => {
  if (n === null)
    return !1;
  let t;
  try {
    t = new n({ latencyHint: "balanced" });
  } catch {
    return !1;
  }
  return t.close(), !0;
}, B_ = (n) => () => {
  if (n === null)
    return !1;
  const e = new n(1, 1, 44100).createGain(), s = e.connect(e) === e;
  return e.disconnect(e), s;
}, $_ = (n, t) => async () => {
  if (n === null)
    return !0;
  if (t === null)
    return !1;
  const e = new Blob([
    'let c,p;class A extends AudioWorkletProcessor{constructor(){super();this.port.onmessage=(e)=>{p=e.data;p.onmessage=()=>{p.postMessage(c);p.close()};this.port.postMessage(0)}}process(){c=1}}registerProcessor("a",A)'
  ], {
    type: "application/javascript; charset=utf-8"
  }), s = new MessageChannel(), i = new t(1, 128, 44100), r = URL.createObjectURL(e);
  let o = !1;
  try {
    await i.audioWorklet.addModule(r);
    const a = new n(i, "a", { numberOfOutputs: 0 }), c = i.createOscillator();
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
}, z_ = (n, t) => async () => {
  if (n === null)
    return !0;
  if (t === null)
    return !1;
  const e = new Blob(['class A extends AudioWorkletProcessor{process(i){this.port.postMessage(i,[i[0][0].buffer])}}registerProcessor("a",A)'], {
    type: "application/javascript; charset=utf-8"
  }), s = new t(1, 128, 44100), i = URL.createObjectURL(e);
  let r = !1, o = !1;
  try {
    await s.audioWorklet.addModule(i);
    const a = new n(s, "a", { numberOfOutputs: 0 }), c = s.createOscillator();
    a.port.onmessage = () => r = !0, a.onprocessorerror = () => o = !0, c.connect(a), c.start(0), await s.startRendering(), await new Promise((l) => setTimeout(l));
  } catch {
  } finally {
    URL.revokeObjectURL(i);
  }
  return r && !o;
}, G_ = (n) => () => {
  if (n === null)
    return !1;
  const e = new n(1, 1, 44100).createChannelMerger();
  if (e.channelCountMode === "max")
    return !0;
  try {
    e.channelCount = 2;
  } catch {
    return !0;
  }
  return !1;
}, Z_ = (n) => () => {
  if (n === null)
    return !1;
  const t = new n(1, 1, 44100);
  return t.createConstantSource === void 0 ? !0 : t.createConstantSource().offset.maxValue !== Number.POSITIVE_INFINITY;
}, Y_ = (n) => () => {
  if (n === null)
    return !1;
  const t = new n(1, 1, 44100), e = t.createConvolver();
  e.buffer = t.createBuffer(1, 1, t.sampleRate);
  try {
    e.buffer = t.createBuffer(1, 1, t.sampleRate);
  } catch {
    return !1;
  }
  return !0;
}, X_ = (n) => () => {
  if (n === null)
    return !1;
  const e = new n(1, 1, 44100).createConvolver();
  try {
    e.channelCount = 1;
  } catch {
    return !1;
  }
  return !0;
}, U_ = (n) => () => n !== null && n.hasOwnProperty("isSecureContext"), H_ = (n) => () => {
  if (n === null)
    return !1;
  const t = new n();
  try {
    return t.createMediaStreamSource(new MediaStream()), !1;
  } catch {
    return !0;
  } finally {
    t.close();
  }
}, K_ = (n, t) => () => {
  if (t === null)
    return Promise.resolve(!1);
  const e = new t(1, 1, 44100), s = n(e, {
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "discrete",
    gain: 0
  });
  return new Promise((i) => {
    e.oncomplete = () => {
      s.disconnect(), i(e.currentTime !== 0);
    }, e.startRendering();
  });
}, Q_ = (n) => () => {
  if (n === null)
    return Promise.resolve(!1);
  const t = new n(1, 1, 44100);
  if (t.createStereoPanner === void 0 || t.createConstantSource === void 0)
    return Promise.resolve(!0);
  const e = t.createConstantSource(), s = t.createStereoPanner();
  return e.channelCount = 1, e.offset.value = 1, s.channelCount = 1, e.start(), e.connect(s).connect(t.destination), t.startRendering().then((i) => i.getChannelData(0)[0] !== 1);
}, J_ = () => new DOMException("", "UnknownError"), ty = {
  channelCount: 2,
  channelCountMode: "max",
  channelInterpretation: "speakers",
  curve: null,
  oversample: "none"
}, ey = (n, t, e, s, i, r, o) => class extends n {
  constructor(c, l) {
    const u = i(c), h = { ...ty, ...l }, d = e(u, h), p = r(u) ? s() : null;
    super(c, !0, d, p), this._isCurveNullified = !1, this._nativeWaveShaperNode = d, o(this, 1);
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
}, ny = (n, t, e) => () => {
  const s = /* @__PURE__ */ new WeakMap(), i = async (r, o) => {
    let a = t(r);
    if (!Se(a, o)) {
      const l = {
        channelCount: a.channelCount,
        channelCountMode: a.channelCountMode,
        channelInterpretation: a.channelInterpretation,
        curve: a.curve,
        oversample: a.oversample
      };
      a = n(o, l);
    }
    return s.set(o, a), Js(a) ? await e(r, o, a.inputs[0]) : await e(r, o, a), a;
  };
  return {
    render(r, o) {
      const a = s.get(o);
      return a !== void 0 ? Promise.resolve(a) : i(r, o);
    }
  };
}, sy = () => typeof window > "u" ? null : window, iy = (n, t) => (e) => {
  e.copyFromChannel = (s, i, r = 0) => {
    const o = n(r), a = n(i);
    if (a >= e.numberOfChannels)
      throw t();
    const c = e.length, l = e.getChannelData(a), u = s.length;
    for (let h = o < 0 ? -o : 0; h + o < c && h < u; h += 1)
      s[h] = l[h + o];
  }, e.copyToChannel = (s, i, r = 0) => {
    const o = n(r), a = n(i);
    if (a >= e.numberOfChannels)
      throw t();
    const c = e.length, l = e.getChannelData(a), u = s.length;
    for (let h = o < 0 ? -o : 0; h + o < c && h < u; h += 1)
      l[h + o] = s[h];
  };
}, ry = (n) => (t) => {
  t.copyFromChannel = /* @__PURE__ */ ((e) => (s, i, r = 0) => {
    const o = n(r), a = n(i);
    if (o < t.length)
      return e.call(t, s, a, o);
  })(t.copyFromChannel), t.copyToChannel = /* @__PURE__ */ ((e) => (s, i, r = 0) => {
    const o = n(r), a = n(i);
    if (o < t.length)
      return e.call(t, s, a, o);
  })(t.copyToChannel);
}, oy = (n) => (t, e) => {
  const s = e.createBuffer(1, 1, 44100);
  t.buffer === null && (t.buffer = s), n(t, "buffer", (i) => () => {
    const r = i.call(t);
    return r === s ? null : r;
  }, (i) => (r) => i.call(t, r === null ? s : r));
}, ay = (n, t) => (e, s) => {
  s.channelCount = 1, s.channelCountMode = "explicit", Object.defineProperty(s, "channelCount", {
    get: () => 1,
    set: () => {
      throw n();
    }
  }), Object.defineProperty(s, "channelCountMode", {
    get: () => "explicit",
    set: () => {
      throw n();
    }
  });
  const i = e.createBufferSource();
  t(s, () => {
    const a = s.numberOfInputs;
    for (let c = 0; c < a; c += 1)
      i.connect(s, 0, c);
  }, () => i.disconnect(s));
}, zh = (n, t, e) => n.copyFromChannel === void 0 ? n.getChannelData(e)[0] : (n.copyFromChannel(t, e), t[0]), Gh = (n) => {
  if (n === null)
    return !1;
  const t = n.length;
  return t % 2 !== 0 ? n[Math.floor(t / 2)] !== 0 : n[t / 2 - 1] + n[t / 2] !== 0;
}, Hi = (n, t, e, s) => {
  let i = n;
  for (; !i.hasOwnProperty(t); )
    i = Object.getPrototypeOf(i);
  const { get: r, set: o } = Object.getOwnPropertyDescriptor(i, t);
  Object.defineProperty(n, t, { get: e(r), set: s(o) });
}, cy = (n) => ({
  ...n,
  outputChannelCount: n.outputChannelCount !== void 0 ? n.outputChannelCount : n.numberOfInputs === 1 && n.numberOfOutputs === 1 ? (
    /*
     * Bug #61: This should be the computedNumberOfChannels, but unfortunately that is almost impossible to fake. That's why
     * the channelCountMode is required to be 'explicit' as long as there is not a native implementation in every browser. That
     * makes sure the computedNumberOfChannels is equivilant to the channelCount which makes it much easier to compute.
     */
    [n.channelCount]
  ) : Array.from({ length: n.numberOfOutputs }, () => 1)
}), ly = (n) => ({ ...n, channelCount: n.numberOfOutputs }), uy = (n) => {
  const { imag: t, real: e } = n;
  return t === void 0 ? e === void 0 ? { ...n, imag: [0, 0], real: [0, 0] } : { ...n, imag: Array.from(e, () => 0), real: e } : e === void 0 ? { ...n, imag: t, real: Array.from(t, () => 0) } : { ...n, imag: t, real: e };
}, Zh = (n, t, e) => {
  try {
    n.setValueAtTime(t, e);
  } catch (s) {
    if (s.code !== 9)
      throw s;
    Zh(n, t, e + 1e-7);
  }
}, hy = (n) => {
  const t = n.createBufferSource();
  t.start();
  try {
    t.start();
  } catch {
    return !0;
  }
  return !1;
}, dy = (n) => {
  const t = n.createBufferSource(), e = n.createBuffer(1, 1, 44100);
  t.buffer = e;
  try {
    t.start(0, 1);
  } catch {
    return !1;
  }
  return !0;
}, fy = (n) => {
  const t = n.createBufferSource();
  t.start();
  try {
    t.stop();
  } catch {
    return !1;
  }
  return !0;
}, Xa = (n) => {
  const t = n.createOscillator();
  try {
    t.start(-1);
  } catch (e) {
    return e instanceof RangeError;
  }
  return !1;
}, Yh = (n) => {
  const t = n.createBuffer(1, 1, 44100), e = n.createBufferSource();
  e.buffer = t, e.start(), e.stop();
  try {
    return e.stop(), !0;
  } catch {
    return !1;
  }
}, Ua = (n) => {
  const t = n.createOscillator();
  try {
    t.stop(-1);
  } catch (e) {
    return e instanceof RangeError;
  }
  return !1;
}, py = (n) => {
  const { port1: t, port2: e } = new MessageChannel();
  try {
    t.postMessage(n);
  } finally {
    t.close(), e.close();
  }
}, my = () => {
  try {
    new DOMException();
  } catch {
    return !1;
  }
  return !0;
}, gy = () => new Promise((n) => {
  const t = new ArrayBuffer(0), { port1: e, port2: s } = new MessageChannel();
  e.onmessage = ({ data: i }) => n(i !== null), s.postMessage(t, [t]);
}), _y = (n) => {
  n.start = /* @__PURE__ */ ((t) => (e = 0, s = 0, i) => {
    const r = n.buffer, o = r === null ? s : Math.min(r.duration, s);
    r !== null && o > r.duration - 0.5 / n.context.sampleRate ? t.call(n, e, 0, 0) : t.call(n, e, o, i);
  })(n.start);
}, Xh = (n, t) => {
  const e = t.createGain();
  n.connect(e);
  const s = /* @__PURE__ */ ((i) => () => {
    i.call(n, e), n.removeEventListener("ended", s);
  })(n.disconnect);
  n.addEventListener("ended", s), ti(n, e), n.stop = /* @__PURE__ */ ((i) => {
    let r = !1;
    return (o = 0) => {
      if (r)
        try {
          i.call(n, o);
        } catch {
          e.gain.setValueAtTime(0, o);
        }
      else
        i.call(n, o), r = !0;
    };
  })(n.stop);
}, ei = (n, t) => (e) => {
  const s = { value: n };
  return Object.defineProperties(e, {
    currentTarget: s,
    target: s
  }), typeof t == "function" ? t.call(n, e) : t.handleEvent.call(n, e);
}, yy = wp(Cs), vy = Ip(Cs), by = Lm(eo), Uh = /* @__PURE__ */ new WeakMap(), xy = ig(Uh), sn = gm(/* @__PURE__ */ new Map(), /* @__PURE__ */ new WeakMap()), hn = sy(), Hh = Pg(sn, wn), Ha = sg(De), xe = I_(De, Ha, vs), wy = Mp(Hh, zt, xe), Bt = ag(to), de = c_(hn), Vt = Sg(de), Kh = /* @__PURE__ */ new WeakMap(), Qh = Hm(ei), Hn = jg(hn), Ka = bg(Hn), Qa = xg(hn), Jh = wg(hn), Gs = qg(hn), se = im(Cp(Ah), kp(yy, vy, jr, by, Lr, De, xy, zi, zt, Cs, Mn, vs, Er), sn, mg(ea, Lr, De, zt, Mi, Mn), wn, no, Ne, Fm(jr, ea, De, zt, Mi, Bt, Mn, Vt), $m(Kh, De, un), Qh, Bt, Ka, Qa, Jh, Vt, Gs), Cy = Rp(se, wy, wn, Hh, Bt, Vt), Ja = /* @__PURE__ */ new WeakSet(), Yl = Fg(hn), td = Em(new Uint32Array(1)), tc = iy(td, wn), ec = ry(td), ed = Pp(Ja, sn, Ne, Yl, de, V_(Yl), tc, ec), so = Ep(Le), nd = E_(Ha, Zi, vs), Cn = Cm(nd), ni = Wg(so, sn, hy, dy, fy, Xa, Yh, Ua, _y, oy(Hi), Xh), Sn = k_(rg(Zi), nd), Sy = Wp(Cn, ni, zt, Sn, xe), fn = rm(Sp(kh), Kh, Ba, om, gp, _p, yp, vp, bp, Qo, Sh, Hn, Zh), Ty = Vp(se, Sy, fn, fe, ni, Bt, Vt, ei), Ay = Yp(se, Xp, wn, fe, Lg(Le, Hi), Bt, Vt, xe), ky = mm(Cn, qh, zt, Sn, xe), Ss = R_(Uh), Iy = pm(se, fn, ky, no, qh, Bt, Vt, Ss), rs = Mg(Cs, Qa), Ey = ay(fe, rs), os = Xg(Hn, Ey), Dy = vm(os, zt, xe), Oy = ym(se, Dy, os, Bt, Vt), Ry = wm(Xi, zt, xe), My = xm(se, Ry, Xi, Bt, Vt, ly), Ny = Kg(so, ni, Le, rs), si = Hg(so, sn, Ny, Xa, Ua), Py = Im(Cn, si, zt, Sn, xe), Fy = km(se, fn, Py, si, Bt, Vt, ei), sd = Qg(Ne, Hi), Vy = Rm(sd, zt, xe), Wy = Om(se, Vy, sd, Bt, Vt, Ss), jy = jm(Cn, Bh, zt, Sn, xe), Ly = Wm(se, fn, jy, Bh, Bt, Vt, Ss), id = Jg(Ne), qy = Ym(Cn, id, zt, Sn, xe), By = Zm(se, fn, qy, id, Ne, Bt, Vt, Ss), $y = eg(Cn, Le, zt, Sn, xe), zy = tg(se, fn, $y, Le, Bt, Vt), Gy = s_(no, fe, Ui, Ne), io = D_(sn, Le, Ui, K_(Le, de)), Zy = pg(ni, zt, de, xe, io), Yy = t_(Gy), Xy = dg(se, Yy, Zy, Bt, Vt, Ss), Uy = Up(fn, os, si, Ui, Ne, zh, Vt, Hi), rd = /* @__PURE__ */ new WeakMap(), Hy = Rg(Ay, Uy, Qh, Vt, rd, ei), od = l_(so, sn, Xa, Yh, Ua, Xh), Ky = x_(Cn, od, zt, Sn, xe), Qy = b_(se, fn, od, Ky, Bt, Vt, ei), ad = Tm(ni), Jy = g_(ad, fe, Le, Gh, rs), ro = m_(ad, fe, Jy, Gh, rs, Hn, Hi), tv = h_(jr, fe, os, Le, Ui, ro, Ne, Lr, zh, rs), cd = u_(tv), ev = S_(Cn, os, si, Le, cd, zt, de, Sn, xe, io), nv = C_(se, fn, cd, ev, Bt, Vt, Ss), sv = d_(wn), iv = A_(sv, Bt, /* @__PURE__ */ new WeakSet(), uy), rv = p_(os, Xi, Le, ro, Ne, rs), ld = f_(rv, Ne), ov = F_(Cn, ld, zt, Sn, xe), av = P_(se, fn, ld, ov, Bt, Vt), cv = ny(ro, zt, xe), lv = ey(se, fe, ro, cv, Bt, Vt, Ss), ud = Tg(hn), nc = Km(hn), hd = /* @__PURE__ */ new WeakMap(), uv = cg(hd, de), hv = ud ? Ap(
  sn,
  Ne,
  Um(hn),
  nc,
  Qm(xp),
  Bt,
  uv,
  Vt,
  Gs,
  /* @__PURE__ */ new WeakMap(),
  /* @__PURE__ */ new WeakMap(),
  z_(Gs, de),
  // @todo window is guaranteed to be defined because isSecureContext checks that as well.
  hn
) : void 0, dv = Cg(Ka, Vt), fv = Pm(Ja, sn, Nm, Xm, /* @__PURE__ */ new WeakSet(), Bt, dv, Vr, Ni, tc, ec), dd = dm(hv, Cy, ed, Ty, Iy, Oy, My, Fy, Wy, fv, Ly, By, zy, Xy, Hy, Qy, nv, iv, av, lv), pv = kg(se, i_, Bt, Vt), mv = Eg(se, r_, Bt, Vt), gv = Dg(se, o_, Bt, Vt), _v = a_(fe, Vt), yv = Og(se, _v, Bt), vv = Zp(dd, fe, Ne, J_, pv, mv, gv, yv, Hn), sc = lg(rd), bv = Dp(sc), fd = Sm(wn), xv = qm(sc), pd = zm(wn), md = /* @__PURE__ */ new WeakMap(), wv = ng(md, un), Cv = Yg(fd, wn, fe, os, Xi, si, Le, Ui, Ne, pd, nc, wv, rs), Sv = $g(fe, Cv, Le, Ne, rs), Tv = hm(Cn, fd, ni, os, Xi, si, Le, xv, pd, nc, zt, Gs, de, Sn, xe, io), Av = og(hd), kv = O_(md), Xl = ud ? cm(bv, se, fn, Tv, Sv, De, Av, Bt, Vt, Gs, cy, kv, py, ei) : void 0, Iv = Mm(Ne, de), Ev = M_(Ja, sn, Ha, sc, io, Vr, tc, ec), Dv = y_(dd, sn, fe, Iv, Ev), Ov = gg(to, Ka), Rv = _g(qa, Qa), Mv = yg(Ba, Jh), Nv = vg(to, Vt), Pv = () => Ag(sn, W_(de), j_(Hn), L_(de), q_(Hn), B_(de), $_(Gs, de), G_(de), Z_(de), Y_(de), X_(de), my, U_(hn), H_(Hn), Q_(de), gy);
function We(n) {
  return n === void 0;
}
function vt(n) {
  return n !== void 0;
}
function gd(n) {
  return typeof n == "function";
}
function Ge(n) {
  return typeof n == "number";
}
function Nn(n) {
  return Object.prototype.toString.call(n) === "[object Object]" && n.constructor === Object;
}
function ic(n) {
  return typeof n == "boolean";
}
function ve(n) {
  return Array.isArray(n);
}
function dn(n) {
  return typeof n == "string";
}
function ki(n) {
  return dn(n) && /^([a-g]{1}(?:b|#|x|bb)?)(-?[0-9]+)/i.test(n);
}
function nt(n, t) {
  if (!n)
    throw new Error(t);
}
function ae(n, t, e = 1 / 0) {
  if (!(t <= n && n <= e))
    throw new RangeError(`Value must be within [${t}, ${e}], got: ${n}`);
}
function rc(n) {
  !n.isOffline && n.state !== "running" && ii('The AudioContext is "suspended". Invoke Tone.start() from a user action to start the audio.');
}
let _d = !1, Ul = !1;
function oa(n) {
  _d = n;
}
function yd(n) {
  We(n) && _d && !Ul && (Ul = !0, ii("Events scheduled inside of scheduled callbacks should use the passed in scheduling time. See https://github.com/Tonejs/Tone.js/wiki/Accurate-Timing"));
}
let oc = console;
function Fv(n) {
  oc = n;
}
function vd(...n) {
  oc.log(...n);
}
function ii(...n) {
  oc.warn(...n);
}
const Vv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  assert: nt,
  assertContextRunning: rc,
  assertRange: ae,
  assertUsedScheduleTime: yd,
  enterScheduledCallback: oa,
  log: vd,
  setLogger: Fv,
  warn: ii
}, Symbol.toStringTag, { value: "Module" }));
function Wv(n) {
  return new vv(n);
}
function jv(n, t, e) {
  return new Dv(n, t, e);
}
const Ee = typeof self == "object" ? self : null, Lv = Ee && (Ee.hasOwnProperty("AudioContext") || Ee.hasOwnProperty("webkitAudioContext"));
function qv(n, t, e) {
  return nt(vt(Xl), "AudioWorkletNode only works in a secure context (https or localhost)"), new (n instanceof Ee?.BaseAudioContext ? Ee?.AudioWorkletNode : Xl)(n, t, e);
}
function pn(n, t, e, s) {
  var i = arguments.length, r = i < 3 ? t : s === null ? s = Object.getOwnPropertyDescriptor(t, e) : s, o;
  if (typeof Reflect == "object" && typeof Reflect.decorate == "function") r = Reflect.decorate(n, t, e, s);
  else for (var a = n.length - 1; a >= 0; a--) (o = n[a]) && (r = (i < 3 ? o(r) : i > 3 ? o(t, e, r) : o(t, e)) || r);
  return i > 3 && r && Object.defineProperty(t, e, r), r;
}
function jt(n, t, e, s) {
  function i(r) {
    return r instanceof e ? r : new e(function(o) {
      o(r);
    });
  }
  return new (e || (e = Promise))(function(r, o) {
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
    l((s = s.apply(n, t || [])).next());
  });
}
class Bv {
  constructor(t, e, s, i) {
    this._callback = t, this._type = e, this._minimumUpdateInterval = Math.max(128 / (i || 44100), 1e-3), this.updateInterval = s, this._createClock();
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
    ], { type: "text/javascript" }), e = URL.createObjectURL(t), s = new Worker(e);
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
    var e;
    this._updateInterval = Math.max(t, this._minimumUpdateInterval), this._type === "worker" && ((e = this._worker) === null || e === void 0 || e.postMessage(this._updateInterval * 1e3));
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
function bs(n) {
  return Mv(n);
}
function Kn(n) {
  return Rv(n);
}
function Dr(n) {
  return Nv(n);
}
function Ws(n) {
  return Ov(n);
}
function $v(n) {
  return n instanceof ed;
}
function zv(n, t) {
  return n === "value" || bs(t) || Kn(t) || $v(t);
}
function tn(n, ...t) {
  if (!t.length)
    return n;
  const e = t.shift();
  if (Nn(n) && Nn(e))
    for (const s in e)
      zv(s, e[s]) ? n[s] = e[s] : Nn(e[s]) ? (n[s] || Object.assign(n, { [s]: {} }), tn(n[s], e[s])) : Object.assign(n, { [s]: e[s] });
  return tn(n, ...t);
}
function Gv(n, t) {
  return n.length === t.length && n.every((e, s) => t[s] === e);
}
function P(n, t, e = [], s) {
  const i = {}, r = Array.from(t);
  if (Nn(r[0]) && s && !Reflect.has(r[0], s) && (Object.keys(r[0]).some((a) => Reflect.has(n, a)) || (tn(i, { [s]: r[0] }), e.splice(e.indexOf(s), 1), r.shift())), r.length === 1 && Nn(r[0]))
    tn(i, r[0]);
  else
    for (let o = 0; o < e.length; o++)
      vt(r[o]) && (i[e[o]] = r[o]);
  return tn(n, i);
}
function Zv(n) {
  return n.constructor.getDefaults();
}
function en(n, t) {
  return We(n) ? t : n;
}
function _e(n, t) {
  return t.forEach((e) => {
    Reflect.has(n, e) && delete n[e];
  }), n;
}
let Ln = class {
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
    (this.debug || Ee && this.toString() === Ee.TONE_DEBUG_CLASS) && vd(this, ...t);
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
Ln.version = ja;
const ac = 1e-6;
function Zs(n, t) {
  return n > t + ac;
}
function aa(n, t) {
  return Zs(n, t) || ln(n, t);
}
function zr(n, t) {
  return n + ac < t;
}
function ln(n, t) {
  return Math.abs(n - t) < ac;
}
function Ts(n, t, e) {
  return Math.max(Math.min(n, e), t);
}
class $e extends Ln {
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
    if (nt(Reflect.has(t, "time"), "Timeline: events must have a time attribute"), t.time = t.time.valueOf(), this.increasing && this.length) {
      const e = this._timeline[this.length - 1];
      nt(aa(t.time, e.time), "The time must be greater than or equal to the last scheduled time"), this._timeline.push(t);
    } else {
      const e = this._search(t.time);
      this._timeline.splice(e + 1, 0, t);
    }
    if (this.length > this.memory) {
      const e = this.length - this.memory;
      this._timeline.splice(0, e);
    }
    return this;
  }
  /**
   * Remove an event from the timeline.
   * @param  {Object}  event  The event object to remove from the list.
   * @returns {Timeline} this
   */
  remove(t) {
    const e = this._timeline.indexOf(t);
    return e !== -1 && this._timeline.splice(e, 1), this;
  }
  /**
   * Get the nearest event whose time is less than or equal to the given time.
   * @param  time  The time to query.
   */
  get(t, e = "time") {
    const s = this._search(t, e);
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
  getAfter(t, e = "time") {
    const s = this._search(t, e);
    return s + 1 < this._timeline.length ? this._timeline[s + 1] : null;
  }
  /**
   * Get the event before the event at the given time.
   * @param  time  The time to query.
   */
  getBefore(t) {
    const e = this._timeline.length;
    if (e > 0 && this._timeline[e - 1].time < t)
      return this._timeline[e - 1];
    const s = this._search(t);
    return s - 1 >= 0 ? this._timeline[s - 1] : null;
  }
  /**
   * Cancel events at and after the given time
   * @param  after  The time to query.
   */
  cancel(t) {
    if (this._timeline.length > 1) {
      let e = this._search(t);
      if (e >= 0)
        if (ln(this._timeline[e].time, t)) {
          for (let s = e; s >= 0 && ln(this._timeline[s].time, t); s--)
            e = s;
          this._timeline = this._timeline.slice(0, e);
        } else
          this._timeline = this._timeline.slice(0, e + 1);
      else
        this._timeline = [];
    } else this._timeline.length === 1 && aa(this._timeline[0].time, t) && (this._timeline = []);
    return this;
  }
  /**
   * Cancel events before or equal to the given time.
   * @param  time  The time to cancel before.
   */
  cancelBefore(t) {
    const e = this._search(t);
    return e >= 0 && (this._timeline = this._timeline.slice(e + 1)), this;
  }
  /**
   * Returns the previous event if there is one. null otherwise
   * @param  event The event to find the previous one of
   * @return The event right before the given event
   */
  previousEvent(t) {
    const e = this._timeline.indexOf(t);
    return e > 0 ? this._timeline[e - 1] : null;
  }
  /**
   * Does a binary search on the timeline array and returns the
   * nearest event index whose time is after or equal to the given time.
   * If a time is searched before the first index in the timeline, -1 is returned.
   * If the time is after the end, the index of the last item is returned.
   */
  _search(t, e = "time") {
    if (this._timeline.length === 0)
      return -1;
    let s = 0;
    const i = this._timeline.length;
    let r = i;
    if (i > 0 && this._timeline[i - 1][e] <= t)
      return i - 1;
    for (; s < r; ) {
      let o = Math.floor(s + (r - s) / 2);
      const a = this._timeline[o], c = this._timeline[o + 1];
      if (ln(a[e], t)) {
        for (let l = o; l < this._timeline.length; l++) {
          const u = this._timeline[l];
          if (ln(u[e], t))
            o = l;
          else
            break;
        }
        return o;
      } else {
        if (zr(a[e], t) && Zs(c[e], t))
          return o;
        Zs(a[e], t) ? r = o : s = o + 1;
      }
    }
    return -1;
  }
  /**
   * Internal iterator. Applies extra safety checks for
   * removing items from the array.
   */
  _iterate(t, e = 0, s = this._timeline.length - 1) {
    this._timeline.slice(e, s + 1).forEach(t);
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
  forEachBefore(t, e) {
    const s = this._search(t);
    return s !== -1 && this._iterate(e, 0, s), this;
  }
  /**
   * Iterate over everything in the array after the given time.
   * @param  time The time to check if items are before
   * @param  callback The callback to invoke with every item
   */
  forEachAfter(t, e) {
    const s = this._search(t);
    return this._iterate(e, s + 1), this;
  }
  /**
   * Iterate over everything in the array between the startTime and endTime.
   * The timerange is inclusive of the startTime, but exclusive of the endTime.
   * range = [startTime, endTime).
   * @param  startTime The time to check if items are before
   * @param  endTime The end of the test interval.
   * @param  callback The callback to invoke with every item
   */
  forEachBetween(t, e, s) {
    let i = this._search(t), r = this._search(e);
    return i !== -1 && r !== -1 ? (this._timeline[i].time !== t && (i += 1), this._timeline[r].time === e && (r -= 1), this._iterate(s, i, r)) : i === -1 && this._iterate(s, 0, r), this;
  }
  /**
   * Iterate over everything in the array at or after the given time. Similar to
   * forEachAfter, but includes the item(s) at the given time.
   * @param  time The time to check if items are before
   * @param  callback The callback to invoke with every item
   */
  forEachFrom(t, e) {
    let s = this._search(t);
    for (; s >= 0 && this._timeline[s].time >= t; )
      s--;
    return this._iterate(e, s + 1), this;
  }
  /**
   * Iterate over everything in the array at the given time
   * @param  time The time to check if items are before
   * @param  callback The callback to invoke with every item
   */
  forEachAtTime(t, e) {
    const s = this._search(t);
    if (s !== -1 && ln(this._timeline[s].time, t)) {
      let i = s;
      for (let r = s; r >= 0 && ln(this._timeline[r].time, t); r--)
        i = r;
      this._iterate((r) => {
        e(r);
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
const bd = [];
function oo(n) {
  bd.push(n);
}
function Yv(n) {
  bd.forEach((t) => t(n));
}
const xd = [];
function ao(n) {
  xd.push(n);
}
function Xv(n) {
  xd.forEach((t) => t(n));
}
class ri extends Ln {
  constructor() {
    super(...arguments), this.name = "Emitter";
  }
  /**
   * Bind a callback to a specific event.
   * @param  event     The name of the event to listen for.
   * @param  callback  The callback to invoke when the event is emitted
   */
  on(t, e) {
    return t.split(/\W+/).forEach((i) => {
      We(this._events) && (this._events = {}), this._events.hasOwnProperty(i) || (this._events[i] = []), this._events[i].push(e);
    }), this;
  }
  /**
   * Bind a callback which is only invoked once
   * @param  event     The name of the event to listen for.
   * @param  callback  The callback to invoke when the event is emitted
   */
  once(t, e) {
    const s = (...i) => {
      e(...i), this.off(t, s);
    };
    return this.on(t, s), this;
  }
  /**
   * Remove the event listener.
   * @param  event     The event to stop listening to.
   * @param  callback  The callback which was bound to the event with Emitter.on.
   *                   If no callback is given, all callbacks events are removed.
   */
  off(t, e) {
    return t.split(/\W+/).forEach((i) => {
      if (We(this._events) && (this._events = {}), this._events.hasOwnProperty(i))
        if (We(e))
          this._events[i] = [];
        else {
          const r = this._events[i];
          for (let o = r.length - 1; o >= 0; o--)
            r[o] === e && r.splice(o, 1);
        }
    }), this;
  }
  /**
   * Invoke all of the callbacks bound to the event
   * with any arguments passed in.
   * @param  event  The name of the event.
   * @param args The arguments to pass to the functions listening.
   */
  emit(t, ...e) {
    if (this._events && this._events.hasOwnProperty(t)) {
      const s = this._events[t].slice(0);
      for (let i = 0, r = s.length; i < r; i++)
        s[i].apply(this, e);
    }
    return this;
  }
  /**
   * Add Emitter functions (on/off/emit) to the object
   */
  static mixin(t) {
    ["on", "once", "off", "emit"].forEach((e) => {
      const s = Object.getOwnPropertyDescriptor(ri.prototype, e);
      Object.defineProperty(t.prototype, e, s);
    });
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this._events = void 0, this;
  }
}
class cc extends ri {
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
class oi extends cc {
  constructor() {
    var t, e;
    super(), this.name = "Context", this._constants = /* @__PURE__ */ new Map(), this._timeouts = new $e(), this._timeoutIds = 0, this._initialized = !1, this._closeStarted = !1, this.isOffline = !1, this._workletPromise = null;
    const s = P(oi.getDefaults(), arguments, [
      "context"
    ]);
    s.context ? (this._context = s.context, this._latencyHint = ((t = arguments[0]) === null || t === void 0 ? void 0 : t.latencyHint) || "") : (this._context = Wv({
      latencyHint: s.latencyHint
    }), this._latencyHint = s.latencyHint), this._ticker = new Bv(this.emit.bind(this, "tick"), s.clockSource, s.updateInterval, this._context.sampleRate), this.on("tick", this._timeoutLoop.bind(this)), this._context.onstatechange = () => {
      this.emit("statechange", this.state);
    }, this[!((e = arguments[0]) === null || e === void 0) && e.hasOwnProperty("updateInterval") ? "_lookAhead" : "lookAhead"] = s.lookAhead;
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
    return this._initialized || (Yv(this), this._initialized = !0), this;
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
  createBuffer(t, e, s) {
    return this._context.createBuffer(t, e, s);
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
  createIIRFilter(t, e) {
    return this._context.createIIRFilter(t, e);
  }
  createPanner() {
    return this._context.createPanner();
  }
  createPeriodicWave(t, e, s) {
    return this._context.createPeriodicWave(t, e, s);
  }
  createStereoPanner() {
    return this._context.createStereoPanner();
  }
  createWaveShaper() {
    return this._context.createWaveShaper();
  }
  createMediaStreamSource(t) {
    return nt(Ws(this._context), "Not available if OfflineAudioContext"), this._context.createMediaStreamSource(t);
  }
  createMediaElementSource(t) {
    return nt(Ws(this._context), "Not available if OfflineAudioContext"), this._context.createMediaElementSource(t);
  }
  createMediaStreamDestination() {
    return nt(Ws(this._context), "Not available if OfflineAudioContext"), this._context.createMediaStreamDestination();
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
    nt(!this._initialized, "The listener cannot be set after initialization."), this._listener = t;
  }
  /**
   * There is only one Transport per Context. It is created on initialization.
   */
  get transport() {
    return this.initialize(), this._transport;
  }
  set transport(t) {
    nt(!this._initialized, "The transport cannot be set after initialization."), this._transport = t;
  }
  /**
   * This is the Draw object for the context which is useful for synchronizing the draw frame with the Tone.js clock.
   */
  get draw() {
    return this.initialize(), this._draw;
  }
  set draw(t) {
    nt(!this._initialized, "Draw cannot be set after initialization."), this._draw = t;
  }
  /**
   * A reference to the Context's destination node.
   */
  get destination() {
    return this.initialize(), this._destination;
  }
  set destination(t) {
    nt(!this._initialized, "The destination cannot be set after initialization."), this._destination = t;
  }
  /**
   * Create an audio worklet node from a name and options. The module
   * must first be loaded using {@link addAudioWorkletModule}.
   */
  createAudioWorkletNode(t, e) {
    return qv(this.rawContext, t, e);
  }
  /**
   * Add an AudioWorkletProcessor module
   * @param url The url of the module
   */
  addAudioWorkletModule(t) {
    return jt(this, void 0, void 0, function* () {
      nt(vt(this.rawContext.audioWorklet), "AudioWorkletNode is only available in a secure context (https or localhost)"), this._workletPromise || (this._workletPromise = this.rawContext.audioWorklet.addModule(t)), yield this._workletPromise;
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
    return Ws(this._context) ? this._context.resume() : Promise.resolve();
  }
  /**
   * Close the context. Once closed, the context can no longer be used and
   * any AudioNodes created from the context will be silent.
   */
  close() {
    return jt(this, void 0, void 0, function* () {
      Ws(this._context) && this.state !== "closed" && !this._closeStarted && (this._closeStarted = !0, yield this._context.close()), this._initialized && Xv(this);
    });
  }
  /**
   * **Internal** Generate a looped buffer at some constant value.
   */
  getConstant(t) {
    if (this._constants.has(t))
      return this._constants.get(t);
    {
      const e = this._context.createBuffer(1, 128, this._context.sampleRate), s = e.getChannelData(0);
      for (let r = 0; r < s.length; r++)
        s[r] = t;
      const i = this._context.createBufferSource();
      return i.channelCount = 1, i.channelCountMode = "explicit", i.buffer = e, i.loop = !0, i.start(0), this._constants.set(t, i), i;
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
    this._timeouts.forEachBefore(t, (e) => {
      e.callback(), this._timeouts.remove(e);
    });
  }
  /**
   * A setTimeout which is guaranteed by the clock source.
   * Also runs in the offline context.
   * @param  fn       The callback to invoke
   * @param  timeout  The timeout in seconds
   * @returns ID to use when invoking Context.clearTimeout
   */
  setTimeout(t, e) {
    this._timeoutIds++;
    const s = this.now();
    return this._timeouts.add({
      callback: t,
      id: this._timeoutIds,
      time: s + e
    }), this._timeoutIds;
  }
  /**
   * Clears a previously scheduled timeout with Tone.context.setTimeout
   * @param  id  The ID returned from setTimeout
   */
  clearTimeout(t) {
    return this._timeouts.forEach((e) => {
      e.id === t && this._timeouts.remove(e);
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
  setInterval(t, e) {
    const s = ++this._timeoutIds, i = () => {
      const r = this.now();
      this._timeouts.add({
        callback: () => {
          t(), i();
        },
        id: s,
        time: r + e
      });
    };
    return i(), s;
  }
}
class Uv extends cc {
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
  createBuffer(t, e, s) {
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
  createIIRFilter(t, e) {
    return {};
  }
  createPanner() {
    return {};
  }
  createPeriodicWave(t, e, s) {
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
  createAudioWorkletNode(t, e) {
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
  setTimeout(t, e) {
    return 0;
  }
  clearTimeout(t) {
    return this;
  }
  setInterval(t, e) {
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
function at(n, t) {
  ve(t) ? t.forEach((e) => at(n, e)) : Object.defineProperty(n, t, {
    enumerable: !0,
    writable: !1
  });
}
function Ki(n, t) {
  ve(t) ? t.forEach((e) => Ki(n, e)) : Object.defineProperty(n, t, {
    writable: !0
  });
}
const Ct = () => {
};
class Dt extends Ln {
  constructor() {
    super(), this.name = "ToneAudioBuffer", this.onload = Ct;
    const t = P(Dt.getDefaults(), arguments, ["url", "onload", "onerror"]);
    this.reverse = t.reverse, this.onload = t.onload, dn(t.url) ? this.load(t.url).catch(t.onerror) : t.url && this.set(t.url);
  }
  static getDefaults() {
    return {
      onerror: Ct,
      onload: Ct,
      reverse: !1
    };
  }
  /**
   * The sample rate of the AudioBuffer
   */
  get sampleRate() {
    return this._buffer ? this._buffer.sampleRate : At().sampleRate;
  }
  /**
   * Pass in an AudioBuffer or ToneAudioBuffer to set the value of this buffer.
   */
  set(t) {
    return t instanceof Dt ? t.loaded ? this._buffer = t.get() : t.onload = () => {
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
      const e = Dt.load(t).then((s) => {
        this.set(s), this.onload(this);
      });
      Dt.downloads.push(e);
      try {
        yield e;
      } finally {
        const s = Dt.downloads.indexOf(e);
        Dt.downloads.splice(s, 1);
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
    const e = ve(t) && t[0].length > 0, s = e ? t.length : 1, i = e ? t[0].length : t.length, r = At(), o = r.createBuffer(s, i, r.sampleRate), a = !e && s === 1 ? [t] : t;
    for (let c = 0; c < s; c++)
      o.copyToChannel(a[c], c);
    return this._buffer = o, this;
  }
  /**
   * Sums multiple channels into 1 channel
   * @param chanNum Optionally only copy a single channel from the array.
   */
  toMono(t) {
    if (Ge(t))
      this.fromArray(this.toArray(t));
    else {
      let e = new Float32Array(this.length);
      const s = this.numberOfChannels;
      for (let i = 0; i < s; i++) {
        const r = this.toArray(i);
        for (let o = 0; o < r.length; o++)
          e[o] += r[o];
      }
      e = e.map((i) => i / s), this.fromArray(e);
    }
    return this;
  }
  /**
   * Get the buffer as an array. Single channel buffers will return a 1-dimensional
   * Float32Array, and multichannel buffers will return multidimensional arrays.
   * @param channel Optionally only copy a single channel from the array.
   */
  toArray(t) {
    if (Ge(t))
      return this.getChannelData(t);
    if (this.numberOfChannels === 1)
      return this.toArray(0);
    {
      const e = [];
      for (let s = 0; s < this.numberOfChannels; s++)
        e[s] = this.getChannelData(s);
      return e;
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
  slice(t, e = this.duration) {
    nt(this.loaded, "Buffer is not loaded");
    const s = Math.floor(t * this.sampleRate), i = Math.floor(e * this.sampleRate);
    nt(s < i, "The start time must be less than the end time");
    const r = i - s, o = At().createBuffer(this.numberOfChannels, r, this.sampleRate);
    for (let a = 0; a < this.numberOfChannels; a++)
      o.copyToChannel(this.getChannelData(a).subarray(s, i), a);
    return new Dt(o);
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
    return new Dt().fromArray(t);
  }
  /**
   * Creates a ToneAudioBuffer from a URL, returns a promise which resolves to a ToneAudioBuffer
   * @param  url The url to load.
   * @return A promise which resolves to a ToneAudioBuffer
   */
  static fromUrl(t) {
    return jt(this, void 0, void 0, function* () {
      return yield new Dt().load(t);
    });
  }
  /**
   * Loads a url using fetch and returns the AudioBuffer.
   */
  static load(t) {
    return jt(this, void 0, void 0, function* () {
      const e = Dt.baseUrl === "" || Dt.baseUrl.endsWith("/") ? Dt.baseUrl : Dt.baseUrl + "/", s = yield fetch(e + t);
      if (!s.ok)
        throw new Error(`could not load url: ${t}`);
      const i = yield s.arrayBuffer();
      return yield At().decodeAudioData(i);
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
    const e = t.split("."), s = e[e.length - 1];
    return document.createElement("audio").canPlayType("audio/" + s) !== "";
  }
  /**
   * Returns a Promise which resolves when all of the buffers have loaded
   */
  static loaded() {
    return jt(this, void 0, void 0, function* () {
      for (yield Promise.resolve(); Dt.downloads.length; )
        yield Dt.downloads[0];
    });
  }
}
Dt.baseUrl = "";
Dt.downloads = [];
class ai extends oi {
  constructor() {
    super({
      clockSource: "offline",
      context: Dr(arguments[0]) ? arguments[0] : jv(arguments[0], arguments[1] * arguments[2], arguments[2]),
      lookAhead: 0,
      updateInterval: Dr(arguments[0]) ? 128 / arguments[0].sampleRate : 128 / arguments[2]
    }), this.name = "OfflineContext", this._currentTime = 0, this.isOffline = !0, this._duration = Dr(arguments[0]) ? arguments[0].length / arguments[0].sampleRate : arguments[1];
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
      let e = 0;
      for (; this._duration - this._currentTime >= 0; ) {
        this.emit("tick"), this._currentTime += 128 / this.sampleRate, e++;
        const s = Math.floor(this.sampleRate / 128);
        t && e % s === 0 && (yield new Promise((i) => setTimeout(i, 1)));
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
      const e = yield this._context.startRendering();
      return new Dt(e);
    });
  }
  /**
   * Close the context
   */
  close() {
    return Promise.resolve();
  }
}
const wd = new Uv();
let ms = wd;
function At() {
  return ms === wd && Lv && Pi(new oi()), ms;
}
function Pi(n, t = !1) {
  t && ms.dispose(), Ws(n) ? ms = new oi(n) : Dr(n) ? ms = new ai(n) : ms = n;
}
function lc() {
  return ms.resume();
}
if (Ee && !Ee.TONE_SILENCE_LOGGING) {
  const t = ` * Tone.js v${ja} * `;
  console.log(`%c${t}`, "background: #000; color: #fff");
}
function Ys(n) {
  return Math.pow(10, n / 20);
}
function Qi(n) {
  return 20 * (Math.log(n) / Math.LN10);
}
function Xs(n) {
  return Math.pow(2, n / 12);
}
let co = 440;
function Hv() {
  return co;
}
function Kv(n) {
  co = n;
}
function Un(n) {
  return Math.round(Cd(n));
}
function Cd(n) {
  return 69 + 12 * Math.log2(n / co);
}
function uc(n) {
  return co * Math.pow(2, (n - 69) / 12);
}
class hc extends Ln {
  /**
   * @param context The context associated with the time value. Used to compute
   * Transport and context-relative timing.
   * @param  value  The time value as a number, string or object
   * @param  units  Unit values
   */
  constructor(t, e, s) {
    super(), this.defaultUnits = "s", this._val = e, this._units = s, this.context = t, this._expressions = this._getExpressions();
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
        method: (t, e) => {
          const s = parseInt(t, 10), i = e === "." ? 1.5 : 1;
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
          const e = parseInt(t, 10);
          return this._beatsToUnits(8 / (Math.floor(e) * 3));
        },
        regexp: /^(\d+)t$/i
      },
      tr: {
        method: (t, e, s) => {
          let i = 0;
          return t && t !== "0" && (i += this._beatsToUnits(this._getTimeSignature() * parseFloat(t))), e && e !== "0" && (i += this._beatsToUnits(parseFloat(e))), s && s !== "0" && (i += this._beatsToUnits(parseFloat(s) / 4)), i;
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
    if (this._val instanceof hc && this.fromType(this._val), We(this._val))
      return this._noArg();
    if (dn(this._val) && We(this._units)) {
      for (const t in this._expressions)
        if (this._expressions[t].regexp.test(this._val.trim())) {
          this._units = t;
          break;
        }
    } else if (Nn(this._val)) {
      let t = 0;
      for (const e in this._val)
        if (vt(this._val[e])) {
          const s = this._val[e], i = (
            // @ts-ignore
            new this.constructor(this.context, e).valueOf() * s
          );
          t += i;
        }
      return t;
    }
    if (vt(this._units)) {
      const t = this._expressions[this._units], e = this._val.toString().trim().match(t.regexp);
      return e ? t.method.apply(this, e.slice(1)) : t.method.call(this, this._val);
    } else return dn(this._val) ? parseFloat(this._val) : this._val;
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
class qe extends hc {
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
          const e = new qe(this.context, t).valueOf();
          return this._secondsToUnits(this.context.transport.nextSubdivision(e));
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
  quantize(t, e = 1) {
    const s = new this.constructor(this.context, t).valueOf(), i = this.valueOf(), a = Math.round(i / s) * s - i;
    return i + a * e;
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
    const t = this.toSeconds(), e = ["1m"];
    for (let r = 1; r < 9; r++) {
      const o = Math.pow(2, r);
      e.push(o + "n."), e.push(o + "n"), e.push(o + "t");
    }
    e.push("0");
    let s = e[0], i = new qe(this.context, e[0]).toSeconds();
    return e.forEach((r) => {
      const o = new qe(this.context, r).toSeconds();
      Math.abs(o - t) < Math.abs(i - t) && (s = r, i = o);
    }), s;
  }
  /**
   * Return the time encoded as Bars:Beats:Sixteenths.
   */
  toBarsBeatsSixteenths() {
    const t = this._beatsToUnits(1);
    let e = this.valueOf() / t;
    e = parseFloat(e.toFixed(4));
    const s = Math.floor(e / this._getTimeSignature());
    let i = e % 1 * 4;
    e = Math.floor(e) % this._getTimeSignature();
    const r = i.toString();
    return r.length > 3 && (i = parseFloat(parseFloat(r).toFixed(3))), [s, e, i].join(":");
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
    return Un(this.toFrequency());
  }
  _now() {
    return this.context.now();
  }
}
function Qv(n, t) {
  return new qe(At(), n, t);
}
class Oe extends qe {
  constructor() {
    super(...arguments), this.name = "Frequency", this.defaultUnits = "hz";
  }
  /**
   * The [concert tuning pitch](https://en.wikipedia.org/wiki/Concert_pitch) which is used
   * to generate all the other pitch values from notes. A4's values in Hertz.
   */
  static get A4() {
    return Hv();
  }
  static set A4(t) {
    Kv(t);
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
        method(t, e) {
          const i = Jv[t.toLowerCase()] + (parseInt(e, 10) + 1) * 12;
          return this.defaultUnits === "midi" ? i : Oe.mtof(i);
        }
      },
      tr: {
        regexp: /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):?(\d+(?:\.\d+)?)?/,
        method(t, e, s) {
          let i = 1;
          return t && t !== "0" && (i *= this._beatsToUnits(this._getTimeSignature() * parseFloat(t))), e && e !== "0" && (i *= this._beatsToUnits(parseFloat(e))), s && s !== "0" && (i *= this._beatsToUnits(parseFloat(s) / 4)), i;
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
    return new Oe(this.context, this.valueOf() * Xs(t));
  }
  /**
   * Takes an array of semitone intervals and returns
   * an array of frequencies transposed by those intervals.
   * @return  Returns an array of Frequencies
   * @example
   * Tone.Frequency("A4").harmonize([0, 3, 7]); // ["A4", "C5", "E5"]
   */
  harmonize(t) {
    return t.map((e) => this.transpose(e));
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
    return Un(this.valueOf());
  }
  /**
   * Return the value of the frequency in Scientific Pitch Notation
   * @example
   * Tone.Frequency(69, "midi").toNote(); // "A4"
   */
  toNote() {
    const t = this.toFrequency(), e = Math.log2(t / Oe.A4);
    let s = Math.round(12 * e) + 57;
    const i = Math.floor(s / 12);
    return i < 0 && (s += -12 * i), t0[s % 12] + i.toString();
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
    const t = this._beatsToUnits(1), e = this.valueOf() / t;
    return Math.floor(e * this._getPPQ());
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
    return uc(t);
  }
  /**
   * Convert a frequency value to a MIDI note.
   * @param frequency The value to frequency value to convert.
   */
  static ftom(t) {
    return Un(t);
  }
}
const Jv = {
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
}, t0 = [
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
function e0(n, t) {
  return new Oe(At(), n, t);
}
class re extends qe {
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
function n0(n, t) {
  return new re(At(), n, t);
}
class pe extends Ln {
  constructor() {
    super();
    const t = P(pe.getDefaults(), arguments, ["context"]);
    this.defaultContext ? this.context = this.defaultContext : this.context = t.context;
  }
  static getDefaults() {
    return {
      context: At()
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
    return yd(t), new qe(this.context, t).toSeconds();
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
    const e = this.get();
    return Object.keys(e).forEach((s) => {
      We(t[s]) && delete e[s];
    }), e;
  }
  /**
   * Get the object's attributes.
   * @example
   * const osc = new Tone.Oscillator();
   * console.log(osc.get());
   */
  get() {
    const t = Zv(this);
    return Object.keys(t).forEach((e) => {
      if (Reflect.has(this, e)) {
        const s = this[e];
        vt(s) && vt(s.value) && vt(s.setValueAtTime) ? t[e] = s.value : s instanceof pe ? t[e] = s._getPartialProperties(t[e]) : ve(s) || Ge(s) || dn(s) || ic(s) ? t[e] = s : delete t[e];
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
    return Object.keys(t).forEach((e) => {
      Reflect.has(this, e) && vt(this[e]) && (this[e] && vt(this[e].value) && vt(this[e].setValueAtTime) ? this[e].value !== t[e] && (this[e].value = t[e]) : this[e] instanceof pe ? this[e].set(t[e]) : this[e] = t[e]);
    }), this;
  }
}
class ci extends $e {
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
    const e = this.get(t);
    return e !== null ? e.state : this._initial;
  }
  /**
   * Add a state to the timeline.
   * @param  state The name of the state to set.
   * @param  time  The time to query.
   * @param options Any additional options that are needed in the timeline.
   */
  setStateAtTime(t, e, s) {
    return ae(e, 0), this.add(Object.assign({}, s, {
      state: t,
      time: e
    })), this;
  }
  /**
   * Return the event before the time with the given state
   * @param  state The state to look for
   * @param  time  When to check before
   * @return  The event with the given state before the time
   */
  getLastState(t, e) {
    const s = this._search(e);
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
  getNextState(t, e) {
    const s = this._search(e);
    if (s !== -1)
      for (let i = s; i < this._timeline.length; i++) {
        const r = this._timeline[i];
        if (r.state === t)
          return r;
      }
  }
}
class mt extends pe {
  constructor() {
    const t = P(mt.getDefaults(), arguments, [
      "param",
      "units",
      "convert"
    ]);
    for (super(t), this.name = "Param", this.overridden = !1, this._minOutput = 1e-7, nt(vt(t.param) && (bs(t.param) || t.param instanceof mt), "param must be an AudioParam"); !bs(t.param); )
      t.param = t.param._param;
    this._swappable = vt(t.swappable) ? t.swappable : !1, this._swappable ? (this.input = this.context.createGain(), this._param = t.param, this.input.connect(this._param)) : this._param = this.input = t.param, this._events = new $e(1e3), this._initialValue = this._param.defaultValue, this.units = t.units, this.convert = t.convert, this._minValue = t.minValue, this._maxValue = t.maxValue, vt(t.value) && t.value !== this._toType(this._initialValue) && this.setValueAtTime(t.value, 0);
  }
  static getDefaults() {
    return Object.assign(pe.getDefaults(), {
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
    return vt(this._minValue) ? this._minValue : this.units === "time" || this.units === "frequency" || this.units === "normalRange" || this.units === "positive" || this.units === "transportTime" || this.units === "ticks" || this.units === "bpm" || this.units === "hertz" || this.units === "samples" ? 0 : this.units === "audioRange" ? -1 : this.units === "decibels" ? -1 / 0 : this._param.minValue;
  }
  get maxValue() {
    return vt(this._maxValue) ? this._maxValue : this.units === "normalRange" || this.units === "audioRange" ? 1 : this._param.maxValue;
  }
  /**
   * Type guard based on the unit name
   */
  _is(t, e) {
    return this.units === e;
  }
  /**
   * Make sure the value is always in the defined range
   */
  _assertRange(t) {
    return vt(this.maxValue) && vt(this.minValue) && ae(t, this._fromType(this.minValue), this._fromType(this.maxValue)), t;
  }
  /**
   * Convert the given value from the type specified by Param.units
   * into the destination value (such as Gain or Frequency).
   */
  _fromType(t) {
    return this.convert && !this.overridden ? this._is(t, "time") ? this.toSeconds(t) : this._is(t, "decibels") ? Ys(t) : this._is(t, "frequency") ? this.toFrequency(t) : t : this.overridden ? 0 : t;
  }
  /**
   * Convert the parameters value into the units specified by Param.units.
   */
  _toType(t) {
    return this.convert && this.units === "decibels" ? Qi(t) : t;
  }
  //-------------------------------------
  // ABSTRACT PARAM INTERFACE
  // all docs are generated from ParamInterface.ts
  //-------------------------------------
  setValueAtTime(t, e) {
    const s = this.toSeconds(e), i = this._fromType(t);
    return nt(isFinite(i) && isFinite(s), `Invalid argument(s) to setValueAtTime: ${JSON.stringify(t)}, ${JSON.stringify(e)}`), this._assertRange(i), this.log(this.units, "setValueAtTime", t, s), this._events.add({
      time: s,
      type: "setValueAtTime",
      value: i
    }), this._param.setValueAtTime(i, s), this;
  }
  getValueAtTime(t) {
    const e = Math.max(this.toSeconds(t), 0), s = this._events.getAfter(e), i = this._events.get(e);
    let r = this._initialValue;
    if (i === null)
      r = this._initialValue;
    else if (i.type === "setTargetAtTime" && (s === null || s.type === "setValueAtTime")) {
      const o = this._events.getBefore(i.time);
      let a;
      o === null ? a = this._initialValue : a = o.value, i.type === "setTargetAtTime" && (r = this._exponentialApproach(i.time, a, i.value, i.constant, e));
    } else if (s === null)
      r = i.value;
    else if (s.type === "linearRampToValueAtTime" || s.type === "exponentialRampToValueAtTime") {
      let o = i.value;
      if (i.type === "setTargetAtTime") {
        const a = this._events.getBefore(i.time);
        a === null ? o = this._initialValue : o = a.value;
      }
      s.type === "linearRampToValueAtTime" ? r = this._linearInterpolate(i.time, o, s.time, s.value, e) : r = this._exponentialInterpolate(i.time, o, s.time, s.value, e);
    } else
      r = i.value;
    return this._toType(r);
  }
  setRampPoint(t) {
    t = this.toSeconds(t);
    let e = this.getValueAtTime(t);
    return this.cancelAndHoldAtTime(t), this._fromType(e) === 0 && (e = this._toType(this._minOutput)), this.setValueAtTime(e, t), this;
  }
  linearRampToValueAtTime(t, e) {
    const s = this._fromType(t), i = this.toSeconds(e);
    return nt(isFinite(s) && isFinite(i), `Invalid argument(s) to linearRampToValueAtTime: ${JSON.stringify(t)}, ${JSON.stringify(e)}`), this._assertRange(s), this._events.add({
      time: i,
      type: "linearRampToValueAtTime",
      value: s
    }), this.log(this.units, "linearRampToValueAtTime", t, i), this._param.linearRampToValueAtTime(s, i), this;
  }
  exponentialRampToValueAtTime(t, e) {
    let s = this._fromType(t);
    s = ln(s, 0) ? this._minOutput : s, this._assertRange(s);
    const i = this.toSeconds(e);
    return nt(isFinite(s) && isFinite(i), `Invalid argument(s) to exponentialRampToValueAtTime: ${JSON.stringify(t)}, ${JSON.stringify(e)}`), this._events.add({
      time: i,
      type: "exponentialRampToValueAtTime",
      value: s
    }), this.log(this.units, "exponentialRampToValueAtTime", t, i), this._param.exponentialRampToValueAtTime(s, i), this;
  }
  exponentialRampTo(t, e, s) {
    return s = this.toSeconds(s), this.setRampPoint(s), this.exponentialRampToValueAtTime(t, s + this.toSeconds(e)), this;
  }
  linearRampTo(t, e, s) {
    return s = this.toSeconds(s), this.setRampPoint(s), this.linearRampToValueAtTime(t, s + this.toSeconds(e)), this;
  }
  targetRampTo(t, e, s) {
    return s = this.toSeconds(s), this.setRampPoint(s), this.exponentialApproachValueAtTime(t, s, e), this;
  }
  exponentialApproachValueAtTime(t, e, s) {
    e = this.toSeconds(e), s = this.toSeconds(s);
    const i = Math.log(s + 1) / Math.log(200);
    return this.setTargetAtTime(t, e, i), this.cancelAndHoldAtTime(e + s * 0.9), this.linearRampToValueAtTime(t, e + s), this;
  }
  setTargetAtTime(t, e, s) {
    const i = this._fromType(t);
    nt(isFinite(s) && s > 0, "timeConstant must be a number greater than 0");
    const r = this.toSeconds(e);
    return this._assertRange(i), nt(isFinite(i) && isFinite(r), `Invalid argument(s) to setTargetAtTime: ${JSON.stringify(t)}, ${JSON.stringify(e)}`), this._events.add({
      constant: s,
      time: r,
      type: "setTargetAtTime",
      value: i
    }), this.log(this.units, "setTargetAtTime", t, r, s), this._param.setTargetAtTime(i, r, s), this;
  }
  setValueCurveAtTime(t, e, s, i = 1) {
    s = this.toSeconds(s), e = this.toSeconds(e);
    const r = this._fromType(t[0]) * i;
    this.setValueAtTime(this._toType(r), e);
    const o = s / (t.length - 1);
    for (let a = 1; a < t.length; a++) {
      const c = this._fromType(t[a]) * i;
      this.linearRampToValueAtTime(this._toType(c), e + a * o);
    }
    return this;
  }
  cancelScheduledValues(t) {
    const e = this.toSeconds(t);
    return nt(isFinite(e), `Invalid argument to cancelScheduledValues: ${JSON.stringify(t)}`), this._events.cancel(e), this._param.cancelScheduledValues(e), this.log(this.units, "cancelScheduledValues", e), this;
  }
  cancelAndHoldAtTime(t) {
    const e = this.toSeconds(t), s = this._fromType(this.getValueAtTime(e));
    nt(isFinite(e), `Invalid argument to cancelAndHoldAtTime: ${JSON.stringify(t)}`), this.log(this.units, "cancelAndHoldAtTime", e, "value=" + s);
    const i = this._events.get(e), r = this._events.getAfter(e);
    return i && ln(i.time, e) ? r ? (this._param.cancelScheduledValues(r.time), this._events.cancel(r.time)) : (this._param.cancelAndHoldAtTime(e), this._events.cancel(e + this.sampleTime)) : r && (this._param.cancelScheduledValues(r.time), this._events.cancel(r.time), r.type === "linearRampToValueAtTime" ? this.linearRampToValueAtTime(this._toType(s), e) : r.type === "exponentialRampToValueAtTime" && this.exponentialRampToValueAtTime(this._toType(s), e)), this._events.add({
      time: e,
      type: "setValueAtTime",
      value: s
    }), this._param.setValueAtTime(s, e), this;
  }
  rampTo(t, e = 0.1, s) {
    return this.units === "frequency" || this.units === "bpm" || this.units === "decibels" ? this.exponentialRampTo(t, e, s) : this.linearRampTo(t, e, s), this;
  }
  /**
   * Apply all of the previously scheduled events to the passed in Param or AudioParam.
   * The applied values will start at the context's current time and schedule
   * all of the events which are scheduled on this Param onto the passed in param.
   */
  apply(t) {
    const e = this.context.currentTime;
    t.setValueAtTime(this.getValueAtTime(e), e);
    const s = this._events.get(e);
    if (s && s.type === "setTargetAtTime") {
      const i = this._events.getAfter(s.time), r = i ? i.time : e + 2, o = (r - e) / 10;
      for (let a = e; a < r; a += o)
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
    nt(this._swappable, "The Param must be assigned as 'swappable' in the constructor");
    const e = this.input;
    return e.disconnect(this._param), this.apply(t), this._param = t, e.connect(this._param), this;
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
  _exponentialApproach(t, e, s, i, r) {
    return s + (e - s) * Math.exp(-(r - t) / i);
  }
  // Calculates the the value along the curve produced by linearRampToValueAtTime
  _linearInterpolate(t, e, s, i, r) {
    return e + (i - e) * ((r - t) / (s - t));
  }
  // Calculates the the value along the curve produced by exponentialRampToValueAtTime
  _exponentialInterpolate(t, e, s, i, r) {
    return e * Math.pow(i / e, (r - t) / (s - t));
  }
}
class W extends pe {
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
    return vt(this.input) ? bs(this.input) || this.input instanceof mt ? 1 : this.input.numberOfInputs : 0;
  }
  /**
   * The number of outputs of the AudioNode.
   * @example
   * const node = new Tone.Gain();
   * console.log(node.numberOfOutputs);
   */
  get numberOfOutputs() {
    return vt(this.output) ? this.output.numberOfOutputs : 0;
  }
  //-------------------------------------
  // AUDIO PROPERTIES
  //-------------------------------------
  /**
   * Used to decide which nodes to get/set properties on
   */
  _isAudioNode(t) {
    return vt(t) && (t instanceof W || Kn(t));
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
    nt(t.length > 0, "ToneAudioNode does not have any internal nodes");
    const e = t[0];
    return {
      channelCount: e.channelCount,
      channelCountMode: e.channelCountMode,
      channelInterpretation: e.channelInterpretation
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
    const e = this._getChannelProperties();
    this._setChannelProperties(Object.assign(e, { channelCount: t }));
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
    const e = this._getChannelProperties();
    this._setChannelProperties(Object.assign(e, { channelCountMode: t }));
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
    const e = this._getChannelProperties();
    this._setChannelProperties(Object.assign(e, { channelInterpretation: t }));
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
  connect(t, e = 0, s = 0) {
    return Me(this, t, e, s), this;
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
    return ii("toMaster() has been renamed toDestination()"), this.toDestination();
  }
  /**
   * disconnect the output
   */
  disconnect(t, e = 0, s = 0) {
    return dc(this, t, e, s), this;
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
    return Ze(this, ...t), this;
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
    return t.forEach((e) => this.connect(e)), this;
  }
  /**
   * Dispose and disconnect
   */
  dispose() {
    return super.dispose(), vt(this.input) && (this.input instanceof W ? this.input.dispose() : Kn(this.input) && this.input.disconnect()), vt(this.output) && (this.output instanceof W ? this.output.dispose() : Kn(this.output) && this.output.disconnect()), this._internalChannels = [], this;
  }
}
function Ze(...n) {
  const t = n.shift();
  n.reduce((e, s) => (e instanceof W ? e.connect(s) : Kn(e) && Me(e, s), s), t);
}
function Me(n, t, e = 0, s = 0) {
  for (nt(vt(n), "Cannot connect from undefined node"), nt(vt(t), "Cannot connect to undefined node"), (t instanceof W || Kn(t)) && nt(t.numberOfInputs > 0, "Cannot connect to node with no inputs"), nt(n.numberOfOutputs > 0, "Cannot connect from node with no outputs"); t instanceof W || t instanceof mt; )
    vt(t.input) && (t = t.input);
  for (; n instanceof W; )
    vt(n.output) && (n = n.output);
  bs(t) ? n.connect(t, e) : n.connect(t, e, s);
}
function dc(n, t, e = 0, s = 0) {
  if (vt(t))
    for (; t instanceof W; )
      t = t.input;
  for (; !Kn(n); )
    vt(n.output) && (n = n.output);
  bs(t) ? n.disconnect(t, e) : Kn(t) ? n.disconnect(t, e, s) : n.disconnect();
}
function s0(...n) {
  const t = n.pop();
  vt(t) && n.forEach((e) => Me(e, t));
}
class J extends W {
  constructor() {
    const t = P(J.getDefaults(), arguments, [
      "gain",
      "units"
    ]);
    super(t), this.name = "Gain", this._gainNode = this.context.createGain(), this.input = this._gainNode, this.output = this._gainNode, this.gain = new mt({
      context: this.context,
      convert: t.convert,
      param: this._gainNode.gain,
      units: t.units,
      value: t.gain,
      minValue: t.minValue,
      maxValue: t.maxValue
    }), at(this, "gain");
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
class Us extends W {
  constructor(t) {
    super(t), this.onended = Ct, this._startTime = -1, this._stopTime = -1, this._timeout = -1, this.output = new J({
      context: this.context,
      gain: 0
    }), this._gainNode = this.output, this.getStateAtTime = function(e) {
      const s = this.toSeconds(e);
      return this._startTime !== -1 && s >= this._startTime && (this._stopTime === -1 || s <= this._stopTime) ? "started" : "stopped";
    }, this._fadeIn = t.fadeIn, this._fadeOut = t.fadeOut, this._curve = t.curve, this.onended = t.onended;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      curve: "linear",
      fadeIn: 0,
      fadeOut: 0,
      onended: Ct
    });
  }
  /**
   * Start the source at the given time
   * @param  time When to start the source
   */
  _startGain(t, e = 1) {
    nt(this._startTime === -1, "Source cannot be started more than once");
    const s = this.toSeconds(this._fadeIn);
    return this._startTime = t + s, this._startTime = Math.max(this._startTime, this.context.currentTime), s > 0 ? (this._gainNode.gain.setValueAtTime(0, t), this._curve === "linear" ? this._gainNode.gain.linearRampToValueAtTime(e, t + s) : this._gainNode.gain.exponentialApproachValueAtTime(e, t, s)) : this._gainNode.gain.setValueAtTime(e, t), this;
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
    nt(this._startTime !== -1, "'start' must be called before 'stop'"), this.cancelStop();
    const e = this.toSeconds(this._fadeOut);
    return this._stopTime = this.toSeconds(t) + e, this._stopTime = Math.max(this._stopTime, this.now()), e > 0 ? this._curve === "linear" ? this._gainNode.gain.linearRampTo(0, e, t) : this._gainNode.gain.targetRampTo(0, e, t) : (this._gainNode.gain.cancelAndHoldAtTime(t), this._gainNode.gain.setValueAtTime(0, t)), this.context.clearTimeout(this._timeout), this._timeout = this.context.setTimeout(() => {
      const s = this._curve === "exponential" ? e * 2 : 0;
      this._stopSource(this.now() + s), this._onended();
    }, this._stopTime - this.context.currentTime), this;
  }
  /**
   * Invoke the onended callback
   */
  _onended() {
    if (this.onended !== Ct && (this.onended(this), this.onended = Ct, !this.context.isOffline)) {
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
    return this.log("cancelStop"), nt(this._startTime !== -1, "Source is not started"), this._gainNode.gain.cancelScheduledValues(this._startTime + this.sampleTime), this.context.clearTimeout(this._timeout), this._stopTime = -1, this;
  }
  dispose() {
    return super.dispose(), this._gainNode.dispose(), this.onended = Ct, this;
  }
}
class lo extends Us {
  constructor() {
    const t = P(lo.getDefaults(), arguments, ["offset"]);
    super(t), this.name = "ToneConstantSource", this._source = this.context.createConstantSource(), Me(this._source, this._gainNode), this.offset = new mt({
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
    return Object.assign(Us.getDefaults(), {
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
    const e = this.toSeconds(t);
    return this.log("start", e), this._startGain(e), this._source.start(e), this;
  }
  _stopSource(t) {
    this._source.stop(t);
  }
  dispose() {
    return super.dispose(), this.state === "started" && this.stop(), this._source.disconnect(), this.offset.dispose(), this;
  }
}
class ht extends W {
  constructor() {
    const t = P(ht.getDefaults(), arguments, [
      "value",
      "units"
    ]);
    super(t), this.name = "Signal", this.override = !0, this.output = this._constantSource = new lo({
      context: this.context,
      convert: t.convert,
      offset: t.value,
      units: t.units,
      minValue: t.minValue,
      maxValue: t.maxValue
    }), this._constantSource.start(0), this.input = this._param = this._constantSource.offset;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      convert: !0,
      units: "number",
      value: 0
    });
  }
  connect(t, e = 0, s = 0) {
    return Ji(this, t, e, s), this;
  }
  dispose() {
    return super.dispose(), this._param.dispose(), this._constantSource.dispose(), this;
  }
  //-------------------------------------
  // ABSTRACT PARAM INTERFACE
  // just a proxy for the ConstantSourceNode's offset AudioParam
  // all docs are generated from AbstractParam.ts
  //-------------------------------------
  setValueAtTime(t, e) {
    return this._param.setValueAtTime(t, e), this;
  }
  getValueAtTime(t) {
    return this._param.getValueAtTime(t);
  }
  setRampPoint(t) {
    return this._param.setRampPoint(t), this;
  }
  linearRampToValueAtTime(t, e) {
    return this._param.linearRampToValueAtTime(t, e), this;
  }
  exponentialRampToValueAtTime(t, e) {
    return this._param.exponentialRampToValueAtTime(t, e), this;
  }
  exponentialRampTo(t, e, s) {
    return this._param.exponentialRampTo(t, e, s), this;
  }
  linearRampTo(t, e, s) {
    return this._param.linearRampTo(t, e, s), this;
  }
  targetRampTo(t, e, s) {
    return this._param.targetRampTo(t, e, s), this;
  }
  exponentialApproachValueAtTime(t, e, s) {
    return this._param.exponentialApproachValueAtTime(t, e, s), this;
  }
  setTargetAtTime(t, e, s) {
    return this._param.setTargetAtTime(t, e, s), this;
  }
  setValueCurveAtTime(t, e, s, i) {
    return this._param.setValueCurveAtTime(t, e, s, i), this;
  }
  cancelScheduledValues(t) {
    return this._param.cancelScheduledValues(t), this;
  }
  cancelAndHoldAtTime(t) {
    return this._param.cancelAndHoldAtTime(t), this;
  }
  rampTo(t, e, s) {
    return this._param.rampTo(t, e, s), this;
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
function Ji(n, t, e, s) {
  (t instanceof mt || bs(t) || t instanceof ht && t.override) && (t.cancelScheduledValues(0), t.setValueAtTime(0, 0), t instanceof ht && (t.overridden = !0)), Me(n, t, e, s);
}
class fc extends mt {
  constructor() {
    const t = P(fc.getDefaults(), arguments, ["value"]);
    super(t), this.name = "TickParam", this._events = new $e(1 / 0), this._multiplier = 1, this._multiplier = t.multiplier, this._events.cancel(0), this._events.add({
      ticks: 0,
      time: 0,
      type: "setValueAtTime",
      value: this._fromType(t.value)
    }), this.setValueAtTime(t.value, 0);
  }
  static getDefaults() {
    return Object.assign(mt.getDefaults(), {
      multiplier: 1,
      units: "hertz",
      value: 1
    });
  }
  setTargetAtTime(t, e, s) {
    e = this.toSeconds(e), this.setRampPoint(e);
    const i = this._fromType(t), r = this._events.get(e), o = Math.round(Math.max(1 / s, 1));
    for (let a = 0; a <= o; a++) {
      const c = s * a + e, l = this._exponentialApproach(r.time, r.value, i, s, c);
      this.linearRampToValueAtTime(this._toType(l), c);
    }
    return this;
  }
  setValueAtTime(t, e) {
    const s = this.toSeconds(e);
    super.setValueAtTime(t, e);
    const i = this._events.get(s), r = this._events.previousEvent(i), o = this._getTicksUntilEvent(r, s);
    return i.ticks = Math.max(o, 0), this;
  }
  linearRampToValueAtTime(t, e) {
    const s = this.toSeconds(e);
    super.linearRampToValueAtTime(t, e);
    const i = this._events.get(s), r = this._events.previousEvent(i), o = this._getTicksUntilEvent(r, s);
    return i.ticks = Math.max(o, 0), this;
  }
  exponentialRampToValueAtTime(t, e) {
    e = this.toSeconds(e);
    const s = this._fromType(t), i = this._events.get(e), r = Math.round(Math.max((e - i.time) * 10, 1)), o = (e - i.time) / r;
    for (let a = 0; a <= r; a++) {
      const c = o * a + i.time, l = this._exponentialInterpolate(i.time, i.value, e, s, c);
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
  _getTicksUntilEvent(t, e) {
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
    let i = this._fromType(this.getValueAtTime(e));
    const r = this._events.get(e);
    return r && r.time === e && r.type === "setValueAtTime" && (i = this._fromType(this.getValueAtTime(e - this.sampleTime))), 0.5 * (e - t.time) * (s + i) + t.ticks;
  }
  /**
   * Returns the tick value at the time. Takes into account
   * any automation curves scheduled on the signal.
   * @param  time The time to get the tick count at
   * @return The number of ticks which have elapsed at the time given any automations.
   */
  getTicksAtTime(t) {
    const e = this.toSeconds(t), s = this._events.get(e);
    return Math.max(this._getTicksUntilEvent(s, e), 0);
  }
  /**
   * Return the elapsed time of the number of ticks from the given time
   * @param ticks The number of ticks to calculate
   * @param  time The time to get the next tick from
   * @return The duration of the number of ticks from the given time in seconds
   */
  getDurationOfTicks(t, e) {
    const s = this.toSeconds(e), i = this.getTicksAtTime(e);
    return this.getTimeOfTick(i + t) - s;
  }
  /**
   * Given a tick, returns the time that tick occurs at.
   * @return The time that the tick occurs.
   */
  getTimeOfTick(t) {
    const e = this._events.get(t, "ticks"), s = this._events.getAfter(t, "ticks");
    if (e && e.ticks === t)
      return e.time;
    if (e && s && s.type === "linearRampToValueAtTime" && e.value !== s.value) {
      const i = this._fromType(this.getValueAtTime(e.time)), o = (this._fromType(this.getValueAtTime(s.time)) - i) / (s.time - e.time), a = Math.sqrt(Math.pow(i, 2) - 2 * o * (e.ticks - t)), c = (-i + a) / o, l = (-i - a) / o;
      return (c > 0 ? c : l) + e.time;
    } else return e ? e.value === 0 ? 1 / 0 : e.time + (t - e.ticks) / e.value : t / this._initialValue;
  }
  /**
   * Convert some number of ticks their the duration in seconds accounting
   * for any automation curves starting at the given time.
   * @param  ticks The number of ticks to convert to seconds.
   * @param  when  When along the automation timeline to convert the ticks.
   * @return The duration in seconds of the ticks.
   */
  ticksToTime(t, e) {
    return this.getDurationOfTicks(t, e);
  }
  /**
   * The inverse of {@link ticksToTime}. Convert a duration in
   * seconds to the corresponding number of ticks accounting for any
   * automation curves starting at the given time.
   * @param  duration The time interval to convert to ticks.
   * @param  when When along the automation timeline to convert the ticks.
   * @return The duration in ticks.
   */
  timeToTicks(t, e) {
    const s = this.toSeconds(e), i = this.toSeconds(t), r = this.getTicksAtTime(s);
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
    const e = this.value;
    this._multiplier = t, this.cancelScheduledValues(0), this.setValueAtTime(e, 0);
  }
}
class pc extends ht {
  constructor() {
    const t = P(pc.getDefaults(), arguments, ["value"]);
    super(t), this.name = "TickSignal", this.input = this._param = new fc({
      context: this.context,
      convert: t.convert,
      multiplier: t.multiplier,
      param: this._constantSource.offset,
      units: t.units,
      value: t.value
    });
  }
  static getDefaults() {
    return Object.assign(ht.getDefaults(), {
      multiplier: 1,
      units: "hertz",
      value: 1
    });
  }
  ticksToTime(t, e) {
    return this._param.ticksToTime(t, e);
  }
  timeToTicks(t, e) {
    return this._param.timeToTicks(t, e);
  }
  getTimeOfTick(t) {
    return this._param.getTimeOfTick(t);
  }
  getDurationOfTicks(t, e) {
    return this._param.getDurationOfTicks(t, e);
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
class mc extends pe {
  constructor() {
    const t = P(mc.getDefaults(), arguments, ["frequency"]);
    super(t), this.name = "TickSource", this._state = new ci(), this._tickOffset = new $e(), this._ticksAtTime = new $e(), this._secondsAtTime = new $e(), this.frequency = new pc({
      context: this.context,
      units: t.units,
      value: t.frequency
    }), at(this, "frequency"), this._state.setStateAtTime("stopped", 0), this.setTicksAtTime(0, 0);
  }
  static getDefaults() {
    return Object.assign({
      frequency: 1,
      units: "hertz"
    }, pe.getDefaults());
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
  start(t, e) {
    const s = this.toSeconds(t);
    return this._state.getValueAtTime(s) !== "started" && (this._state.setStateAtTime("started", s), vt(e) && this.setTicksAtTime(e, s), this._ticksAtTime.cancel(s), this._secondsAtTime.cancel(s)), this;
  }
  /**
   * Stop the clock. Stopping the clock resets the tick counter to 0.
   * @param time The time when the clock should stop.
   */
  stop(t) {
    const e = this.toSeconds(t);
    if (this._state.getValueAtTime(e) === "stopped") {
      const s = this._state.get(e);
      s && s.time > 0 && (this._tickOffset.cancel(s.time), this._state.cancel(s.time));
    }
    return this._state.cancel(e), this._state.setStateAtTime("stopped", e), this.setTicksAtTime(0, e), this._ticksAtTime.cancel(e), this._secondsAtTime.cancel(e), this;
  }
  /**
   * Pause the clock. Pausing does not reset the tick counter.
   * @param time The time when the clock should stop.
   */
  pause(t) {
    const e = this.toSeconds(t);
    return this._state.getValueAtTime(e) === "started" && (this._state.setStateAtTime("paused", e), this._ticksAtTime.cancel(e), this._secondsAtTime.cancel(e)), this;
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
    const e = this.toSeconds(t), s = this._state.getLastState("stopped", e), i = this._ticksAtTime.get(e), r = {
      state: "paused",
      time: e
    };
    this._state.add(r);
    let o = i || s, a = i ? i.ticks : 0, c = null;
    return this._state.forEachBetween(o.time, e + this.sampleTime, (l) => {
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
    const e = this.now(), s = this.frequency.timeToTicks(t, e);
    this.setTicksAtTime(s, e);
  }
  /**
   * Return the elapsed seconds at the given time.
   * @param  time  When to get the elapsed seconds
   * @return  The number of elapsed seconds
   */
  getSecondsAtTime(t) {
    t = this.toSeconds(t);
    const e = this._state.getLastState("stopped", t), s = { state: "paused", time: t };
    this._state.add(s);
    const i = this._secondsAtTime.get(t);
    let r = i || e, o = i ? i.seconds : 0, a = null;
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
  setTicksAtTime(t, e) {
    return e = this.toSeconds(e), this._tickOffset.cancel(e), this._tickOffset.add({
      seconds: this.frequency.getDurationOfTicks(t, e),
      ticks: t,
      time: e
    }), this._ticksAtTime.cancel(e), this._secondsAtTime.cancel(e), this;
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
  getTimeOfTick(t, e = this.now()) {
    const s = this._tickOffset.get(e), i = this._state.get(e), r = Math.max(s.time, i.time), o = this.frequency.getTicksAtTime(r) + t - s.ticks;
    return this.frequency.getTimeOfTick(o);
  }
  /**
   * Invoke the callback event at all scheduled ticks between the
   * start time and the end time
   * @param  startTime  The beginning of the search range
   * @param  endTime    The end of the search range
   * @param  callback   The callback to invoke with each tick
   */
  forEachTickBetween(t, e, s) {
    let i = this._state.get(t);
    this._state.forEachBetween(t, e, (o) => {
      i && i.state === "started" && o.state !== "started" && this.forEachTickBetween(Math.max(i.time, t), o.time - this.sampleTime, s), i = o;
    });
    let r = null;
    if (i && i.state === "started") {
      const o = Math.max(i.time, t), a = this.frequency.getTicksAtTime(o), c = this.frequency.getTicksAtTime(i.time), l = a - c;
      let u = Math.ceil(l) - l;
      u = ln(u, 1) ? 0 : u;
      let h = this.frequency.getTimeOfTick(a + u);
      for (; h < e; ) {
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
class li extends pe {
  constructor() {
    const t = P(li.getDefaults(), arguments, [
      "callback",
      "frequency"
    ]);
    super(t), this.name = "Clock", this.callback = Ct, this._lastUpdate = 0, this._state = new ci("stopped"), this._boundLoop = this._loop.bind(this), this.callback = t.callback, this._tickSource = new mc({
      context: this.context,
      frequency: t.frequency,
      units: t.units
    }), this._lastUpdate = 0, this.frequency = this._tickSource.frequency, at(this, "frequency"), this._state.setStateAtTime("stopped", 0), this.context.on("tick", this._boundLoop);
  }
  static getDefaults() {
    return Object.assign(pe.getDefaults(), {
      callback: Ct,
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
  start(t, e) {
    rc(this.context);
    const s = this.toSeconds(t);
    return this.log("start", s), this._state.getValueAtTime(s) !== "started" && (this._state.setStateAtTime("started", s), this._tickSource.start(s, e), s < this._lastUpdate && this.emit("start", s, e)), this;
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
    const e = this.toSeconds(t);
    return this.log("stop", e), this._state.cancel(e), this._state.setStateAtTime("stopped", e), this._tickSource.stop(e), e < this._lastUpdate && this.emit("stop", e), this;
  }
  /**
   * Pause the clock. Pausing does not reset the tick counter.
   * @param time The time when the clock should stop.
   */
  pause(t) {
    const e = this.toSeconds(t);
    return this._state.getValueAtTime(e) === "started" && (this._state.setStateAtTime("paused", e), this._tickSource.pause(e), e < this._lastUpdate && this.emit("pause", e)), this;
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
  setTicksAtTime(t, e) {
    return this._tickSource.setTicksAtTime(t, e), this;
  }
  /**
   * Get the time of the given tick. The second argument
   * is when to test before. Since ticks can be set (with setTicksAtTime)
   * there may be multiple times for a given tick value.
   * @param  tick The tick number.
   * @param  before When to measure the tick value from.
   * @return The time of the tick
   */
  getTimeOfTick(t, e = this.now()) {
    return this._tickSource.getTimeOfTick(t, e);
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
  nextTickTime(t, e) {
    const s = this.toSeconds(e), i = this.getTicksAtTime(s);
    return this._tickSource.getTimeOfTick(i + t, s);
  }
  /**
   * The scheduling loop.
   */
  _loop() {
    const t = this._lastUpdate, e = this.now();
    this._lastUpdate = e, this.log("loop", t, e), t !== e && (this._state.forEachBetween(t, e, (s) => {
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
    }), this._tickSource.forEachTickBetween(t, e, (s, i) => {
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
    const e = this.toSeconds(t);
    return this._state.getValueAtTime(e);
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this.context.off("tick", this._boundLoop), this._tickSource.dispose(), this._state.dispose(), this;
  }
}
ri.mixin(li);
class ze extends W {
  constructor() {
    const t = P(ze.getDefaults(), arguments, [
      "delayTime",
      "maxDelay"
    ]);
    super(t), this.name = "Delay";
    const e = this.toSeconds(t.maxDelay);
    this._maxDelay = Math.max(e, this.toSeconds(t.delayTime)), this._delayNode = this.input = this.output = this.context.createDelay(e), this.delayTime = new mt({
      context: this.context,
      param: this._delayNode.delayTime,
      units: "time",
      value: t.delayTime,
      minValue: 0,
      maxValue: this.maxDelay
    }), at(this, "delayTime");
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
class mn extends W {
  constructor() {
    const t = P(mn.getDefaults(), arguments, [
      "volume"
    ]);
    super(t), this.name = "Volume", this.input = this.output = new J({
      context: this.context,
      gain: t.volume,
      units: "decibels"
    }), this.volume = this.output.gain, at(this, "volume"), this._unmutedVolume = t.volume, this.mute = t.mute;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
class gc extends W {
  constructor() {
    const t = P(gc.getDefaults(), arguments);
    super(t), this.name = "Destination", this.input = new mn({ context: this.context }), this.output = new J({ context: this.context }), this.volume = this.input.volume, Ze(this.input, this.output, this.context.rawContext.destination), this.mute = t.mute, this._internalChannels = [
      this.input,
      this.context.rawContext.destination,
      this.output
    ];
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
    return this.input.disconnect(), t.unshift(this.input), t.push(this.output), Ze(...t), this;
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
oo((n) => {
  n.destination = new gc({ context: n });
});
ao((n) => {
  n.destination.dispose();
});
class i0 extends W {
  constructor() {
    super(...arguments), this.name = "Listener", this.positionX = new mt({
      context: this.context,
      param: this.context.rawContext.listener.positionX
    }), this.positionY = new mt({
      context: this.context,
      param: this.context.rawContext.listener.positionY
    }), this.positionZ = new mt({
      context: this.context,
      param: this.context.rawContext.listener.positionZ
    }), this.forwardX = new mt({
      context: this.context,
      param: this.context.rawContext.listener.forwardX
    }), this.forwardY = new mt({
      context: this.context,
      param: this.context.rawContext.listener.forwardY
    }), this.forwardZ = new mt({
      context: this.context,
      param: this.context.rawContext.listener.forwardZ
    }), this.upX = new mt({
      context: this.context,
      param: this.context.rawContext.listener.upX
    }), this.upY = new mt({
      context: this.context,
      param: this.context.rawContext.listener.upY
    }), this.upZ = new mt({
      context: this.context,
      param: this.context.rawContext.listener.upZ
    });
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
oo((n) => {
  n.listener = new i0({ context: n });
});
ao((n) => {
  n.listener.dispose();
});
function r0(n, t) {
  return jt(this, arguments, void 0, function* (e, s, i = 2, r = At().sampleRate) {
    const o = At(), a = new ai(i, s, r);
    Pi(a), yield e(a);
    const c = a.render();
    Pi(o);
    const l = yield c;
    return new Dt(l);
  });
}
class ui extends Ln {
  constructor() {
    super(), this.name = "ToneAudioBuffers", this._buffers = /* @__PURE__ */ new Map(), this._loadingCount = 0;
    const t = P(ui.getDefaults(), arguments, ["urls", "onload", "baseUrl"], "urls");
    this.baseUrl = t.baseUrl, Object.keys(t.urls).forEach((e) => {
      this._loadingCount++;
      const s = t.urls[e];
      this.add(e, s, this._bufferLoaded.bind(this, t.onload), t.onerror);
    });
  }
  static getDefaults() {
    return {
      baseUrl: "",
      onerror: Ct,
      onload: Ct,
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
    return nt(this.has(t), `ToneAudioBuffers has no buffer named: ${t}`), this._buffers.get(t.toString());
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
    return Array.from(this._buffers).every(([t, e]) => e.loaded);
  }
  /**
   * Add a buffer by name and url to the Buffers
   * @param  name      A unique name to give the buffer
   * @param  url  Either the url of the bufer, or a buffer which will be added with the given name.
   * @param  callback  The callback to invoke when the url is loaded.
   * @param  onerror  Invoked if the buffer can't be loaded
   */
  add(t, e, s = Ct, i = Ct) {
    return dn(e) ? (this.baseUrl && e.trim().substring(0, 11).toLowerCase() === "data:audio/" && (this.baseUrl = ""), this._buffers.set(t.toString(), new Dt(this.baseUrl + e, s, i))) : this._buffers.set(t.toString(), new Dt(e, s, i)), this;
  }
  dispose() {
    return super.dispose(), this._buffers.forEach((t) => t.dispose()), this._buffers.clear(), this;
  }
}
class Hs extends Oe {
  constructor() {
    super(...arguments), this.name = "MidiClass", this.defaultUnits = "midi";
  }
  /**
   * Returns the value of a frequency in the current units
   */
  _frequencyToUnits(t) {
    return Un(super._frequencyToUnits(t));
  }
  /**
   * Returns the value of a tick in the current time units
   */
  _ticksToUnits(t) {
    return Un(super._ticksToUnits(t));
  }
  /**
   * Return the value of the beats in the current units
   */
  _beatsToUnits(t) {
    return Un(super._beatsToUnits(t));
  }
  /**
   * Returns the value of a second in the current units
   */
  _secondsToUnits(t) {
    return Un(super._secondsToUnits(t));
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
    return uc(this.toMidi());
  }
  /**
   * Transposes the frequency by the given number of semitones.
   * @return A new transposed MidiClass
   * @example
   * Tone.Midi("A4").transpose(3); // "C5"
   */
  transpose(t) {
    return new Hs(this.context, this.toMidi() + t);
  }
}
function o0(n, t) {
  return new Hs(At(), n, t);
}
class Zt extends re {
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
function a0(n, t) {
  return new Zt(At(), n, t);
}
class c0 extends pe {
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
  schedule(t, e) {
    return this._events.add({
      callback: t,
      time: this.toSeconds(e)
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
    this._events.forEachBefore(t + this.anticipation, (e) => {
      t - e.time <= this.expiration && e.callback(), this._events.remove(e);
    }), this._events.length > 0 && (this._animationFrame = requestAnimationFrame(this._boundDrawLoop));
  }
  dispose() {
    return super.dispose(), this._events.dispose(), cancelAnimationFrame(this._animationFrame), this;
  }
}
oo((n) => {
  n.draw = new c0({ context: n });
});
ao((n) => {
  n.draw.dispose();
});
class Sd extends Ln {
  constructor() {
    super(...arguments), this.name = "IntervalTimeline", this._root = null, this._length = 0;
  }
  /**
   * The event to add to the timeline. All events must
   * have a time and duration value
   * @param  event  The event to add to the timeline
   */
  add(t) {
    nt(vt(t.time), "Events must have a time property"), nt(vt(t.duration), "Events must have a duration parameter"), t.time = t.time.valueOf();
    let e = new l0(t.time, t.time + t.duration, t);
    for (this._root === null ? this._root = e : this._root.insert(e), this._length++; e !== null; )
      e.updateHeight(), e.updateMax(), this._rebalance(e), e = e.parent;
    return this;
  }
  /**
   * Remove an event from the timeline.
   * @param  event  The event to remove from the timeline
   */
  remove(t) {
    if (this._root !== null) {
      const e = [];
      this._root.search(t.time, e);
      for (const s of e)
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
    return this.forEachFrom(t, (e) => this.remove(e)), this;
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
  _replaceNodeInParent(t, e) {
    t.parent !== null ? (t.isLeftChild() ? t.parent.left = e : t.parent.right = e, this._rebalance(t.parent)) : this._setRoot(e);
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
      const e = t.getBalance();
      let s, i = null;
      if (e > 0)
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
    const e = t.parent, s = t.isLeftChild(), i = t.right;
    i && (t.right = i.left, i.left = t), e !== null ? s ? e.left = i : e.right = i : this._setRoot(i);
  }
  /**
   * Rotate the tree to the right
   */
  _rotateRight(t) {
    const e = t.parent, s = t.isLeftChild(), i = t.left;
    i && (t.left = i.right, i.right = t), e !== null ? s ? e.left = i : e.right = i : this._setRoot(i);
  }
  /**
   * Balance the BST
   */
  _rebalance(t) {
    const e = t.getBalance();
    e > 1 && t.left ? t.left.getBalance() < 0 ? this._rotateLeft(t.left) : this._rotateRight(t) : e < -1 && t.right && (t.right.getBalance() > 0 ? this._rotateRight(t.right) : this._rotateLeft(t));
  }
  /**
   * Get an event whose time and duration span the give time. Will
   * return the match whose "time" value is closest to the given time.
   * @return  The event which spans the desired time
   */
  get(t) {
    if (this._root !== null) {
      const e = [];
      if (this._root.search(t, e), e.length > 0) {
        let s = e[0];
        for (let i = 1; i < e.length; i++)
          e[i].low > s.low && (s = e[i]);
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
      const e = [];
      this._root.traverse((s) => e.push(s)), e.forEach((s) => {
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
  forEachAtTime(t, e) {
    if (this._root !== null) {
      const s = [];
      this._root.search(t, s), s.forEach((i) => {
        i.event && e(i.event);
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
  forEachFrom(t, e) {
    if (this._root !== null) {
      const s = [];
      this._root.searchAfter(t, s), s.forEach((i) => {
        i.event && e(i.event);
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
class l0 {
  constructor(t, e, s) {
    this._left = null, this._right = null, this.parent = null, this.height = 0, this.event = s, this.low = t, this.high = e, this.max = this.high;
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
  search(t, e) {
    t > this.max || (this.left !== null && this.left.search(t, e), this.low <= t && this.high > t && e.push(this), !(this.low > t) && this.right !== null && this.right.search(t, e));
  }
  /**
   * Search the tree for nodes which are less
   * than the given point
   * @param  point  The point to query
   * @param  results  The array to put the results
   */
  searchAfter(t, e) {
    this.low >= t && (e.push(this), this.left !== null && this.left.searchAfter(t, e)), this.right !== null && this.right.searchAfter(t, e);
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
const u0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null
}, Symbol.toStringTag, { value: "Module" }));
class h0 extends Ln {
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
  set(t, e) {
    return this._timeline.add({
      value: t,
      time: e
    }), this;
  }
  /**
   * Get the value at the given time
   */
  get(t) {
    const e = this._timeline.get(t);
    return e ? e.value : this._initialValue;
  }
}
class Ye extends W {
  constructor() {
    super(P(Ye.getDefaults(), arguments, [
      "context"
    ]));
  }
  connect(t, e = 0, s = 0) {
    return Ji(this, t, e, s), this;
  }
}
class gn extends Ye {
  constructor() {
    const t = P(gn.getDefaults(), arguments, ["mapping", "length"]);
    super(t), this.name = "WaveShaper", this._shaper = this.context.createWaveShaper(), this.input = this._shaper, this.output = this._shaper, ve(t.mapping) || t.mapping instanceof Float32Array ? this.curve = Float32Array.from(t.mapping) : gd(t.mapping) && this.setMap(t.mapping, t.length);
  }
  static getDefaults() {
    return Object.assign(ht.getDefaults(), {
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
  setMap(t, e = 1024) {
    const s = new Float32Array(e);
    for (let i = 0, r = e; i < r; i++) {
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
    const e = ["none", "2x", "4x"].some((s) => s.includes(t));
    nt(e, "oversampling must be either 'none', '2x', or '4x'"), this._shaper.oversample = t;
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._shaper.disconnect(), this;
  }
}
class hi extends Ye {
  constructor() {
    const t = P(hi.getDefaults(), arguments, [
      "value"
    ]);
    super(t), this.name = "Pow", this._exponentScaler = this.input = this.output = new gn({
      context: this.context,
      mapping: this._expFunc(t.value),
      length: 8192
    }), this._exponent = t.value;
  }
  static getDefaults() {
    return Object.assign(Ye.getDefaults(), {
      value: 1
    });
  }
  /**
   * the function which maps the waveshaper
   * @param exponent exponent value
   */
  _expFunc(t) {
    return (e) => Math.pow(Math.abs(e), t);
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
class Qn {
  /**
   * @param transport The transport object which the event belongs to
   */
  constructor(t, e) {
    this.id = Qn._eventId++, this._remainderTime = 0;
    const s = Object.assign(Qn.getDefaults(), e);
    this.transport = t, this.callback = s.callback, this._once = s.once, this.time = Math.floor(s.time), this._remainderTime = s.time - this.time;
  }
  static getDefaults() {
    return {
      callback: Ct,
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
      const e = this.transport.bpm.getDurationOfTicks(1, t);
      this.callback(t + this._remainderTime * e), this._once && this.transport.clear(this.id);
    }
  }
  /**
   * Clean up
   */
  dispose() {
    return this.callback = void 0, this;
  }
}
Qn._eventId = 0;
class _c extends Qn {
  /**
   * @param transport The transport object which the event belongs to
   */
  constructor(t, e) {
    super(t, e), this._currentId = -1, this._nextId = -1, this._nextTick = this.time, this._boundRestart = this._restart.bind(this);
    const s = Object.assign(_c.getDefaults(), e);
    this.duration = s.duration, this._interval = s.interval, this._nextTick = s.time, this.transport.on("start", this._boundRestart), this.transport.on("loopStart", this._boundRestart), this.transport.on("ticks", this._boundRestart), this.context = this.transport.context, this._restart();
  }
  static getDefaults() {
    return Object.assign({}, Qn.getDefaults(), {
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
    return zr(this._nextTick, this.floatTime + this.duration) ? this.transport.scheduleOnce(this.invoke.bind(this), new Zt(this.context, this._nextTick).toSeconds()) : -1;
  }
  /**
   * Push more events onto the timeline to keep up with the position of the timeline
   */
  _createEvents(t) {
    zr(this._nextTick + this._interval, this.floatTime + this.duration) && (this._nextTick += this._interval, this._currentId = this._nextId, this._nextId = this.transport.scheduleOnce(this.invoke.bind(this), new Zt(this.context, this._nextTick).toSeconds()));
  }
  /**
   * Re-compute the events when the transport time has changed from a start/ticks/loopStart event
   */
  _restart(t) {
    this.transport.clear(this._currentId), this.transport.clear(this._nextId), this._nextTick = this.floatTime;
    const e = this.transport.getTicksAtTime(t);
    Zs(e, this.time) && (this._nextTick = this.floatTime + Math.ceil((e - this.floatTime) / this._interval) * this._interval), this._currentId = this._createEvent(), this._nextTick += this._interval, this._nextId = this._createEvent();
  }
  /**
   * Clean up
   */
  dispose() {
    return super.dispose(), this.transport.clear(this._currentId), this.transport.clear(this._nextId), this.transport.off("start", this._boundRestart), this.transport.off("loopStart", this._boundRestart), this.transport.off("ticks", this._boundRestart), this;
  }
}
class uo extends pe {
  constructor() {
    const t = P(uo.getDefaults(), arguments);
    super(t), this.name = "Transport", this._loop = new h0(!1), this._loopStart = 0, this._loopEnd = 0, this._scheduledEvents = {}, this._timeline = new $e(), this._repeatedEvents = new Sd(), this._syncedSignals = [], this._swingAmount = 0, this._ppq = t.ppq, this._clock = new li({
      callback: this._processTick.bind(this),
      context: this.context,
      frequency: 0,
      units: "bpm"
    }), this._bindClockEvents(), this.bpm = this._clock.frequency, this._clock.frequency.multiplier = t.ppq, this.bpm.setValueAtTime(t.bpm, 0), at(this, "bpm"), this._timeSignature = t.timeSignature, this._swingTicks = t.ppq / 2;
  }
  static getDefaults() {
    return Object.assign(pe.getDefaults(), {
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
  _processTick(t, e) {
    if (this._loop.get(t) && e >= this._loopEnd && (this.emit("loopEnd", t), this._clock.setTicksAtTime(this._loopStart, t), e = this._loopStart, this.emit("loopStart", t, this._clock.getSecondsAtTime(t)), this.emit("loop", t)), this._swingAmount > 0 && e % this._ppq !== 0 && // not on a downbeat
    e % (this._swingTicks * 2) !== 0) {
      const s = e % (this._swingTicks * 2) / (this._swingTicks * 2), i = Math.sin(s * Math.PI) * this._swingAmount;
      t += new Zt(this.context, this._swingTicks * 2 / 3).toSeconds() * i;
    }
    oa(!0), this._timeline.forEachAtTime(e, (s) => s.invoke(t)), oa(!1);
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
  schedule(t, e) {
    const s = new Qn(this, {
      callback: t,
      time: new re(this.context, e).toTicks()
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
  scheduleRepeat(t, e, s, i = 1 / 0) {
    const r = new _c(this, {
      callback: t,
      duration: new qe(this.context, i).toTicks(),
      interval: new qe(this.context, e).toTicks(),
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
  scheduleOnce(t, e) {
    const s = new Qn(this, {
      callback: t,
      once: !0,
      time: new re(this.context, e).toTicks()
    });
    return this._addEvent(s, this._timeline);
  }
  /**
   * Clear the passed in event id from the timeline
   * @param eventId The id of the event.
   */
  clear(t) {
    if (this._scheduledEvents.hasOwnProperty(t)) {
      const e = this._scheduledEvents[t.toString()];
      e.timeline.remove(e.event), e.event.dispose(), delete this._scheduledEvents[t.toString()];
    }
    return this;
  }
  /**
   * Add an event to the correct timeline. Keep track of the
   * timeline it was added to.
   * @returns the event id which was just added
   */
  _addEvent(t, e) {
    return this._scheduledEvents[t.id.toString()] = {
      event: t,
      timeline: e
    }, e.add(t), t.id;
  }
  /**
   * Remove scheduled events from the timeline after
   * the given time. Repeated events will be removed
   * if their startTime is after the given time
   * @param after Clear all events after this time.
   */
  cancel(t = 0) {
    const e = this.toTicks(t);
    return this._timeline.forEachFrom(e, (s) => this.clear(s.id)), this._repeatedEvents.forEachFrom(e, (s) => this.clear(s.id)), this;
  }
  //-------------------------------------
  // 	START/STOP/PAUSE
  //-------------------------------------
  /**
   * Bind start/stop/pause events from the clock and emit them.
   */
  _bindClockEvents() {
    this._clock.on("start", (t, e) => {
      e = new Zt(this.context, e).toSeconds(), this.emit("start", t, e);
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
  start(t, e) {
    this.context.resume();
    let s;
    return vt(e) && (s = this.toTicks(e)), this._clock.start(t, s), this;
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
    ve(t) && (t = t[0] / t[1] * 4), this._timeSignature = t;
  }
  /**
   * When the Transport.loop = true, this is the starting position of the loop.
   */
  get loopStart() {
    return new qe(this.context, this._loopStart, "i").toSeconds();
  }
  set loopStart(t) {
    this._loopStart = this.toTicks(t);
  }
  /**
   * When the Transport.loop = true, this is the ending position of the loop.
   */
  get loopEnd() {
    return new qe(this.context, this._loopEnd, "i").toSeconds();
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
  setLoopPoints(t, e) {
    return this.loopStart = t, this.loopEnd = e, this;
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
    return new Zt(this.context, this._swingTicks).toNotation();
  }
  set swingSubdivision(t) {
    this._swingTicks = this.toTicks(t);
  }
  /**
   * The Transport's position in Bars:Beats:Sixteenths.
   * Setting the value will jump to that position right away.
   */
  get position() {
    const t = this.now(), e = this._clock.getTicksAtTime(t);
    return new Zt(this.context, e).toBarsBeatsSixteenths();
  }
  set position(t) {
    const e = this.toTicks(t);
    this.ticks = e;
  }
  /**
   * The Transport's position in seconds.
   * Setting the value will jump to that position right away.
   */
  get seconds() {
    return this._clock.seconds;
  }
  set seconds(t) {
    const e = this.now(), s = this._clock.frequency.timeToTicks(t, e);
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
      const e = this.now();
      if (this.state === "started") {
        const s = this._clock.getTicksAtTime(e), i = this._clock.frequency.getDurationOfTicks(Math.ceil(s) - s, e), r = e + i;
        this.emit("stop", r), this._clock.setTicksAtTime(t, r), this.emit("start", r, this._clock.getSecondsAtTime(r));
      } else
        this.emit("ticks", e), this._clock.setTicksAtTime(t, e);
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
      const e = this.now(), s = this.getTicksAtTime(e), i = t - s % t;
      return this._clock.nextTickTime(i, e);
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
  syncSignal(t, e) {
    const s = this.now();
    let i = this.bpm, r = 1 / (60 / i.getValueAtTime(s) / this.PPQ), o = [];
    if (t.units === "time") {
      const c = 0.015625 / r, l = new J(c), u = new hi(-1), h = new J(c);
      i.chain(l, u, h), i = h, r = 1 / r, o = [l, u, h];
    }
    e || (t.getValueAtTime(s) !== 0 ? e = t.getValueAtTime(s) / r : e = 0);
    const a = new J(e);
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
    for (let e = this._syncedSignals.length - 1; e >= 0; e--) {
      const s = this._syncedSignals[e];
      s.signal === t && (s.nodes.forEach((i) => i.dispose()), s.signal.value = s.initial, this._syncedSignals.splice(e, 1));
    }
    return this;
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._clock.dispose(), Ki(this, "bpm"), this._timeline.dispose(), this._repeatedEvents.dispose(), this;
  }
}
ri.mixin(uo);
oo((n) => {
  n.transport = new uo({ context: n });
});
ao((n) => {
  n.transport.dispose();
});
class Jt extends W {
  constructor(t) {
    super(t), this.input = void 0, this._state = new ci("stopped"), this._synced = !1, this._scheduled = [], this._syncedStart = Ct, this._syncedStop = Ct, this._state.memory = 100, this._state.increasing = !0, this._volume = this.output = new mn({
      context: this.context,
      mute: t.mute,
      volume: t.volume
    }), this.volume = this._volume.volume, at(this, "volume"), this.onstop = t.onstop;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      mute: !1,
      onstop: Ct,
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
  start(t, e, s) {
    let i = We(t) && this._synced ? this.context.transport.seconds : this.toSeconds(t);
    if (i = this._clampToCurrentTime(i), !this._synced && this._state.getValueAtTime(i) === "started")
      nt(Zs(i, this._state.get(i).time), "Start time must be strictly greater than previous start time"), this._state.cancel(i), this._state.setStateAtTime("started", i), this.log("restart", i), this.restart(i, e, s);
    else if (this.log("start", i), this._state.setStateAtTime("started", i), this._synced) {
      const r = this._state.get(i);
      r && (r.offset = this.toSeconds(en(e, 0)), r.duration = s ? this.toSeconds(s) : void 0);
      const o = this.context.transport.schedule((a) => {
        this._start(a, e, s);
      }, i);
      this._scheduled.push(o), this.context.transport.state === "started" && this.context.transport.getSecondsAtTime(this.immediate()) > i && this._syncedStart(this.now(), this.context.transport.seconds);
    } else
      rc(this.context), this._start(i, e, s);
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
    let e = We(t) && this._synced ? this.context.transport.seconds : this.toSeconds(t);
    if (e = this._clampToCurrentTime(e), this._state.getValueAtTime(e) === "started" || vt(this._state.getNextState("started", e))) {
      if (this.log("stop", e), !this._synced)
        this._stop(e);
      else {
        const s = this.context.transport.schedule(this._stop.bind(this), e);
        this._scheduled.push(s);
      }
      this._state.cancel(e), this._state.setStateAtTime("stopped", e);
    }
    return this;
  }
  /**
   * Restart the source.
   */
  restart(t, e, s) {
    return t = this.toSeconds(t), this._state.getValueAtTime(t) === "started" && (this._state.cancel(t), this._restart(t, e, s)), this;
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
    return this._synced || (this._synced = !0, this._syncedStart = (t, e) => {
      if (Zs(e, 0)) {
        const s = this._state.get(e);
        if (s && s.state === "started" && s.time !== e) {
          const i = e - this.toSeconds(s.time);
          let r;
          s.duration && (r = this.toSeconds(s.duration) - i), this._start(t, this.toSeconds(s.offset) + i, r);
        }
      }
    }, this._syncedStop = (t) => {
      const e = this.context.transport.getSecondsAtTime(Math.max(t - this.sampleTime, 0));
      this._state.getValueAtTime(e) === "started" && this._stop(t);
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
    return super.dispose(), this.onstop = Ct, this.unsync(), this._volume.dispose(), this._state.dispose(), this;
  }
}
class as extends Us {
  constructor() {
    const t = P(as.getDefaults(), arguments, ["url", "onload"]);
    super(t), this.name = "ToneBufferSource", this._source = this.context.createBufferSource(), this._internalChannels = [this._source], this._sourceStarted = !1, this._sourceStopped = !1, Me(this._source, this._gainNode), this._source.onended = () => this._stopSource(), this.playbackRate = new mt({
      context: this.context,
      param: this._source.playbackRate,
      units: "positive",
      value: t.playbackRate
    }), this.loop = t.loop, this.loopStart = t.loopStart, this.loopEnd = t.loopEnd, this._buffer = new Dt(t.url, t.onload, t.onerror), this._internalChannels.push(this._source);
  }
  static getDefaults() {
    return Object.assign(Us.getDefaults(), {
      url: new Dt(),
      loop: !1,
      loopEnd: 0,
      loopStart: 0,
      onload: Ct,
      onerror: Ct,
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
  start(t, e, s, i = 1) {
    nt(this.buffer.loaded, "buffer is either not set or not loaded");
    const r = this.toSeconds(t);
    this._startGain(r, i), this.loop ? e = en(e, this.loopStart) : e = en(e, 0);
    let o = Math.max(this.toSeconds(e), 0);
    if (this.loop) {
      const a = this.toSeconds(this.loopEnd) || this.buffer.duration, c = this.toSeconds(this.loopStart), l = a - c;
      aa(o, a) && (o = (o - c) % l + c), ln(o, this.buffer.duration) && (o = 0);
    }
    if (this._source.buffer = this.buffer.get(), this._source.loopEnd = this.toSeconds(this.loopEnd) || this.buffer.duration, zr(o, this.buffer.duration) && (this._sourceStarted = !0, this._source.start(r, o)), vt(s)) {
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
class Jn extends Jt {
  constructor() {
    const t = P(Jn.getDefaults(), arguments, [
      "type"
    ]);
    super(t), this.name = "Noise", this._source = null, this._playbackRate = t.playbackRate, this.type = t.type, this._fadeIn = t.fadeIn, this._fadeOut = t.fadeOut;
  }
  static getDefaults() {
    return Object.assign(Jt.getDefaults(), {
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
    if (nt(t in Hl, "Noise: invalid type: " + t), this._type !== t && (this._type = t, this.state === "started")) {
      const e = this.now();
      this._stop(e), this._start(e);
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
    const e = Hl[this._type];
    this._source = new as({
      url: e,
      context: this.context,
      fadeIn: this._fadeIn,
      fadeOut: this._fadeOut,
      loop: !0,
      onended: () => this.onstop(this),
      playbackRate: this._playbackRate
    }).connect(this.output), this._source.start(this.toSeconds(t), Math.random() * (e.duration - 1e-3));
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
const Fs = 44100 * 5, Oo = 2, En = {
  brown: null,
  pink: null,
  white: null
}, Hl = {
  get brown() {
    if (!En.brown) {
      const n = [];
      for (let t = 0; t < Oo; t++) {
        const e = new Float32Array(Fs);
        n[t] = e;
        let s = 0;
        for (let i = 0; i < Fs; i++) {
          const r = Math.random() * 2 - 1;
          e[i] = (s + 0.02 * r) / 1.02, s = e[i], e[i] *= 3.5;
        }
      }
      En.brown = new Dt().fromArray(n);
    }
    return En.brown;
  },
  get pink() {
    if (!En.pink) {
      const n = [];
      for (let t = 0; t < Oo; t++) {
        const e = new Float32Array(Fs);
        n[t] = e;
        let s, i, r, o, a, c, l;
        s = i = r = o = a = c = l = 0;
        for (let u = 0; u < Fs; u++) {
          const h = Math.random() * 2 - 1;
          s = 0.99886 * s + h * 0.0555179, i = 0.99332 * i + h * 0.0750759, r = 0.969 * r + h * 0.153852, o = 0.8665 * o + h * 0.3104856, a = 0.55 * a + h * 0.5329522, c = -0.7616 * c - h * 0.016898, e[u] = s + i + r + o + a + c + l + h * 0.5362, e[u] *= 0.11, l = h * 0.115926;
        }
      }
      En.pink = new Dt().fromArray(n);
    }
    return En.pink;
  },
  get white() {
    if (!En.white) {
      const n = [];
      for (let t = 0; t < Oo; t++) {
        const e = new Float32Array(Fs);
        n[t] = e;
        for (let s = 0; s < Fs; s++)
          e[s] = Math.random() * 2 - 1;
      }
      En.white = new Dt().fromArray(n);
    }
    return En.white;
  }
};
class Di extends W {
  constructor() {
    const t = P(Di.getDefaults(), arguments, ["volume"]);
    super(t), this.name = "UserMedia", this._volume = this.output = new mn({
      context: this.context,
      volume: t.volume
    }), this.volume = this._volume.volume, at(this, "volume"), this.mute = t.mute;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
      nt(Di.supported, "UserMedia is not supported"), this.state === "started" && this.close();
      const e = yield Di.enumerateDevices();
      Ge(t) ? this._device = e[t] : (this._device = e.find((r) => r.label === t || r.deviceId === t), !this._device && e.length > 0 && (this._device = e[0]), nt(vt(this._device), `No matching device ${t}`));
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
        Me(r, this.output), this._mediaStream = r;
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
      return (yield navigator.mediaDevices.enumerateDevices()).filter((e) => e.kind === "audioinput");
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
    return vt(navigator.mediaDevices) && vt(navigator.mediaDevices.getUserMedia);
  }
}
function As(n, t) {
  return jt(this, void 0, void 0, function* () {
    const e = t / n.context.sampleRate, s = new ai(1, e, n.context.sampleRate);
    return new n.constructor(Object.assign(n.get(), {
      // should do 2 iterations
      frequency: 2 / e,
      // zero out the detune
      detune: 0,
      context: s
    })).toDestination().start(0), (yield s.render()).getChannelData(0);
  });
}
class tr extends Us {
  constructor() {
    const t = P(tr.getDefaults(), arguments, ["frequency", "type"]);
    super(t), this.name = "ToneOscillatorNode", this._oscillator = this.context.createOscillator(), this._internalChannels = [this._oscillator], Me(this._oscillator, this._gainNode), this.type = t.type, this.frequency = new mt({
      context: this.context,
      param: this._oscillator.frequency,
      units: "frequency",
      value: t.frequency
    }), this.detune = new mt({
      context: this.context,
      param: this._oscillator.detune,
      units: "cents",
      value: t.detune
    }), at(this, ["frequency", "detune"]);
  }
  static getDefaults() {
    return Object.assign(Us.getDefaults(), {
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
    const e = this.toSeconds(t);
    return this.log("start", e), this._startGain(e), this._oscillator.start(e), this;
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
class Yt extends Jt {
  constructor() {
    const t = P(Yt.getDefaults(), arguments, ["frequency", "type"]);
    super(t), this.name = "Oscillator", this._oscillator = null, this.frequency = new ht({
      context: this.context,
      units: "frequency",
      value: t.frequency
    }), at(this, "frequency"), this.detune = new ht({
      context: this.context,
      units: "cents",
      value: t.detune
    }), at(this, "detune"), this._partials = t.partials, this._partialCount = t.partialCount, this._type = t.type, t.partialCount && t.type !== "custom" && (this._type = this.baseType + t.partialCount.toString()), this.phase = t.phase;
  }
  static getDefaults() {
    return Object.assign(Jt.getDefaults(), {
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
    const e = this.toSeconds(t), s = new tr({
      context: this.context,
      onended: () => this.onstop(this)
    });
    this._oscillator = s, this._wave ? this._oscillator.setPeriodicWave(this._wave) : this._oscillator.type = this._type, this._oscillator.connect(this.output), this.frequency.connect(this._oscillator.frequency), this.detune.connect(this._oscillator.detune), this._oscillator.start(e);
  }
  /**
   * stop the oscillator
   */
  _stop(t) {
    const e = this.toSeconds(t);
    this._oscillator && this._oscillator.stop(e);
  }
  /**
   * Restart the oscillator. Does not stop the oscillator, but instead
   * just cancels any scheduled 'stop' from being invoked.
   */
  _restart(t) {
    const e = this.toSeconds(t);
    return this.log("restart", e), this._oscillator && this._oscillator.cancelStop(), this._state.cancel(e), this;
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
      return Yt._periodicWaveCache.find((e) => e.phase === this._phase && Gv(e.partials, this._partials));
    {
      const t = Yt._periodicWaveCache.find((e) => e.type === this._type && e.phase === this._phase);
      return this._partialCount = t ? t.partialCount : this._partialCount, t;
    }
  }
  get type() {
    return this._type;
  }
  set type(t) {
    this._type = t;
    const e = ["sine", "square", "sawtooth", "triangle"].indexOf(t) !== -1;
    if (this._phase === 0 && e)
      this._wave = void 0, this._partialCount = 0, this._oscillator !== null && (this._oscillator.type = t);
    else {
      const s = this._getCachedPeriodicWave();
      if (vt(s)) {
        const { partials: i, wave: r } = s;
        this._wave = r, this._partials = i, this._oscillator !== null && this._oscillator.setPeriodicWave(this._wave);
      } else {
        const [i, r] = this._getRealImaginary(t, this._phase), o = this.context.createPeriodicWave(i, r);
        this._wave = o, this._oscillator !== null && this._oscillator.setPeriodicWave(this._wave), Yt._periodicWaveCache.push({
          imag: r,
          partialCount: this._partialCount,
          partials: this._partials,
          phase: this._phase,
          real: i,
          type: this._type,
          wave: this._wave
        }), Yt._periodicWaveCache.length > 100 && Yt._periodicWaveCache.shift();
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
    ae(t, 0);
    let e = this._type;
    const s = /^(sine|triangle|square|sawtooth)(\d+)$/.exec(this._type);
    if (s && (e = s[1]), this._type !== "custom")
      t === 0 ? this.type = e : this.type = e + t.toString();
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
  _getRealImaginary(t, e) {
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
      u !== 0 ? (r[c] = -u * Math.sin(e * c), o[c] = u * Math.cos(e * c)) : (r[c] = 0, o[c] = 0);
    }
    return [r, o];
  }
  /**
   * Compute the inverse FFT for a given phase.
   */
  _inverseFFT(t, e, s) {
    let i = 0;
    const r = t.length;
    for (let o = 0; o < r; o++)
      i += t[o] * Math.cos(o * s) + e[o] * Math.sin(o * s);
    return i;
  }
  /**
   * Returns the initial value of the oscillator when stopped.
   * E.g. a "sine" oscillator with phase = 90 would return an initial value of -1.
   */
  getInitialValue() {
    const [t, e] = this._getRealImaginary(this._type, 0);
    let s = 0;
    const i = Math.PI * 2, r = 32;
    for (let o = 0; o < r; o++)
      s = Math.max(this._inverseFFT(t, e, o / r * i), s);
    return Ts(-this._inverseFFT(t, e, this._phase) / s, -1, 1);
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
      return As(this, t);
    });
  }
  dispose() {
    return super.dispose(), this._oscillator !== null && this._oscillator.dispose(), this._wave = void 0, this.frequency.dispose(), this.detune.dispose(), this;
  }
}
Yt._periodicWaveCache = [];
class ho extends Ye {
  constructor() {
    super(...arguments), this.name = "AudioToGain", this._norm = new gn({
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
class Xt extends ht {
  constructor() {
    const t = P(Xt.getDefaults(), arguments, ["value"]);
    super(t), this.name = "Multiply", this.override = !1, this._mult = this.input = this.output = new J({
      context: this.context,
      minValue: t.minValue,
      maxValue: t.maxValue
    }), this.factor = this._param = this._mult.gain, this.factor.setValueAtTime(t.value, 0);
  }
  static getDefaults() {
    return Object.assign(ht.getDefaults(), {
      value: 0
    });
  }
  dispose() {
    return super.dispose(), this._mult.dispose(), this;
  }
}
class er extends Jt {
  constructor() {
    const t = P(er.getDefaults(), arguments, ["frequency", "type", "modulationType"]);
    super(t), this.name = "AMOscillator", this._modulationScale = new ho({ context: this.context }), this._modulationNode = new J({
      context: this.context
    }), this._carrier = new Yt({
      context: this.context,
      detune: t.detune,
      frequency: t.frequency,
      onstop: () => this.onstop(this),
      phase: t.phase,
      type: t.type
    }), this.frequency = this._carrier.frequency, this.detune = this._carrier.detune, this._modulator = new Yt({
      context: this.context,
      phase: t.phase,
      type: t.modulationType
    }), this.harmonicity = new Xt({
      context: this.context,
      units: "positive",
      value: t.harmonicity
    }), this.frequency.chain(this.harmonicity, this._modulator.frequency), this._modulator.chain(this._modulationScale, this._modulationNode.gain), this._carrier.chain(this._modulationNode, this.output), at(this, ["frequency", "detune", "harmonicity"]);
  }
  static getDefaults() {
    return Object.assign(Yt.getDefaults(), {
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
      return As(this, t);
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this.frequency.dispose(), this.detune.dispose(), this.harmonicity.dispose(), this._carrier.dispose(), this._modulator.dispose(), this._modulationNode.dispose(), this._modulationScale.dispose(), this;
  }
}
class di extends Jt {
  constructor() {
    const t = P(di.getDefaults(), arguments, ["frequency", "type", "modulationType"]);
    super(t), this.name = "FMOscillator", this._modulationNode = new J({
      context: this.context,
      gain: 0
    }), this._carrier = new Yt({
      context: this.context,
      detune: t.detune,
      frequency: 0,
      onstop: () => this.onstop(this),
      phase: t.phase,
      type: t.type
    }), this.detune = this._carrier.detune, this.frequency = new ht({
      context: this.context,
      units: "frequency",
      value: t.frequency
    }), this._modulator = new Yt({
      context: this.context,
      phase: t.phase,
      type: t.modulationType
    }), this.harmonicity = new Xt({
      context: this.context,
      units: "positive",
      value: t.harmonicity
    }), this.modulationIndex = new Xt({
      context: this.context,
      units: "positive",
      value: t.modulationIndex
    }), this.frequency.connect(this._carrier.frequency), this.frequency.chain(this.harmonicity, this._modulator.frequency), this.frequency.chain(this.modulationIndex, this._modulationNode), this._modulator.connect(this._modulationNode.gain), this._modulationNode.connect(this._carrier.frequency), this._carrier.connect(this.output), this.detune.connect(this._modulator.detune), at(this, [
      "modulationIndex",
      "frequency",
      "detune",
      "harmonicity"
    ]);
  }
  static getDefaults() {
    return Object.assign(Yt.getDefaults(), {
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
      return As(this, t);
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this.frequency.dispose(), this.harmonicity.dispose(), this._carrier.dispose(), this._modulator.dispose(), this._modulationNode.dispose(), this.modulationIndex.dispose(), this;
  }
}
class fi extends Jt {
  constructor() {
    const t = P(fi.getDefaults(), arguments, ["frequency", "width"]);
    super(t), this.name = "PulseOscillator", this._widthGate = new J({
      context: this.context,
      gain: 0
    }), this._thresh = new gn({
      context: this.context,
      mapping: (e) => e <= 0 ? -1 : 1
    }), this.width = new ht({
      context: this.context,
      units: "audioRange",
      value: t.width
    }), this._triangle = new Yt({
      context: this.context,
      detune: t.detune,
      frequency: t.frequency,
      onstop: () => this.onstop(this),
      phase: t.phase,
      type: "triangle"
    }), this.frequency = this._triangle.frequency, this.detune = this._triangle.detune, this._triangle.chain(this._thresh, this.output), this.width.chain(this._widthGate, this._thresh), at(this, ["width", "frequency", "detune"]);
  }
  static getDefaults() {
    return Object.assign(Jt.getDefaults(), {
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
      return As(this, t);
    });
  }
  /**
   * Clean up method.
   */
  dispose() {
    return super.dispose(), this._triangle.dispose(), this.width.dispose(), this._widthGate.dispose(), this._thresh.dispose(), this;
  }
}
class nr extends Jt {
  constructor() {
    const t = P(nr.getDefaults(), arguments, ["frequency", "type", "spread"]);
    super(t), this.name = "FatOscillator", this._oscillators = [], this.frequency = new ht({
      context: this.context,
      units: "frequency",
      value: t.frequency
    }), this.detune = new ht({
      context: this.context,
      units: "cents",
      value: t.detune
    }), this._spread = t.spread, this._type = t.type, this._phase = t.phase, this._partials = t.partials, this._partialCount = t.partialCount, this.count = t.count, at(this, ["frequency", "detune"]);
  }
  static getDefaults() {
    return Object.assign(Yt.getDefaults(), {
      count: 3,
      spread: 20,
      type: "sawtooth"
    });
  }
  /**
   * start the oscillator
   */
  _start(t) {
    t = this.toSeconds(t), this._forEach((e) => e.start(t));
  }
  /**
   * stop the oscillator
   */
  _stop(t) {
    t = this.toSeconds(t), this._forEach((e) => e.stop(t));
  }
  _restart(t) {
    this._forEach((e) => e.restart(t));
  }
  /**
   * Iterate over all of the oscillators
   */
  _forEach(t) {
    for (let e = 0; e < this._oscillators.length; e++)
      t(this._oscillators[e], e);
  }
  /**
   * The type of the oscillator
   */
  get type() {
    return this._type;
  }
  set type(t) {
    this._type = t, this._forEach((e) => e.type = t);
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
      const e = -t / 2, s = t / (this._oscillators.length - 1);
      this._forEach((i, r) => i.detune.value = e + s * r);
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
    if (ae(t, 1), this._oscillators.length !== t) {
      this._forEach((e) => e.dispose()), this._oscillators = [];
      for (let e = 0; e < t; e++) {
        const s = new Yt({
          context: this.context,
          volume: -6 - t * 1.1,
          type: this._type,
          phase: this._phase + e / t * 360,
          partialCount: this._partialCount,
          onstop: e === 0 ? () => this.onstop(this) : Ct
        });
        this.type === "custom" && (s.partials = this._partials), this.frequency.connect(s.frequency), this.detune.connect(s.detune), s.detune.overridden = !1, s.connect(this.output), this._oscillators[e] = s;
      }
      this.spread = this._spread, this.state === "started" && this._forEach((e) => e.start());
    }
  }
  get phase() {
    return this._phase;
  }
  set phase(t) {
    this._phase = t, this._forEach((e, s) => e.phase = this._phase + s / this.count * 360);
  }
  get baseType() {
    return this._oscillators[0].baseType;
  }
  set baseType(t) {
    this._forEach((e) => e.baseType = t), this._type = this._oscillators[0].type;
  }
  get partials() {
    return this._oscillators[0].partials;
  }
  set partials(t) {
    this._partials = t, this._partialCount = this._partials.length, t.length && (this._type = "custom", this._forEach((e) => e.partials = t));
  }
  get partialCount() {
    return this._oscillators[0].partialCount;
  }
  set partialCount(t) {
    this._partialCount = t, this._forEach((e) => e.partialCount = t), this._type = this._oscillators[0].type;
  }
  asArray() {
    return jt(this, arguments, void 0, function* (t = 1024) {
      return As(this, t);
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this.frequency.dispose(), this.detune.dispose(), this._forEach((t) => t.dispose()), this;
  }
}
class sr extends Jt {
  constructor() {
    const t = P(sr.getDefaults(), arguments, ["frequency", "modulationFrequency"]);
    super(t), this.name = "PWMOscillator", this.sourceType = "pwm", this._scale = new Xt({
      context: this.context,
      value: 2
    }), this._pulse = new fi({
      context: this.context,
      frequency: t.modulationFrequency
    }), this._pulse.carrierType = "sine", this.modulationFrequency = this._pulse.frequency, this._modulator = new Yt({
      context: this.context,
      detune: t.detune,
      frequency: t.frequency,
      onstop: () => this.onstop(this),
      phase: t.phase
    }), this.frequency = this._modulator.frequency, this.detune = this._modulator.detune, this._modulator.chain(this._scale, this._pulse.width), this._pulse.connect(this.output), at(this, ["modulationFrequency", "frequency", "detune"]);
  }
  static getDefaults() {
    return Object.assign(Jt.getDefaults(), {
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
      return As(this, t);
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._pulse.dispose(), this._scale.dispose(), this._modulator.dispose(), this;
  }
}
const Kl = {
  am: er,
  fat: nr,
  fm: di,
  oscillator: Yt,
  pulse: fi,
  pwm: sr
};
class Fn extends Jt {
  constructor() {
    const t = P(Fn.getDefaults(), arguments, ["frequency", "type"]);
    super(t), this.name = "OmniOscillator", this.frequency = new ht({
      context: this.context,
      units: "frequency",
      value: t.frequency
    }), this.detune = new ht({
      context: this.context,
      units: "cents",
      value: t.detune
    }), at(this, ["frequency", "detune"]), this.set(t);
  }
  static getDefaults() {
    return Object.assign(Yt.getDefaults(), di.getDefaults(), er.getDefaults(), nr.getDefaults(), fi.getDefaults(), sr.getDefaults());
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
    return ["am", "fm", "fat"].some((e) => this._sourceType === e) && (t = this._sourceType), t + this._oscillator.type;
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
      const e = Kl[t], s = this.now();
      if (this._oscillator) {
        const i = this._oscillator;
        i.stop(s), this.context.setTimeout(() => i.dispose(), this.blockTime);
      }
      this._oscillator = new e({
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
    let e = "sine";
    this._oscillator.type !== "pwm" && this._oscillator.type !== "pulse" && (e = this._oscillator.type), t === "fm" ? this.type = "fm" + e : t === "am" ? this.type = "am" + e : t === "fat" ? this.type = "fat" + e : t === "oscillator" ? this.type = e : t === "pulse" ? this.type = "pulse" : t === "pwm" && (this.type = "pwm");
  }
  _getOscType(t, e) {
    return t instanceof Kl[e];
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
    this._getOscType(this._oscillator, "fat") && Ge(t) && (this._oscillator.count = t);
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
    this._getOscType(this._oscillator, "fat") && Ge(t) && (this._oscillator.spread = t);
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
    (this._getOscType(this._oscillator, "fm") || this._getOscType(this._oscillator, "am")) && dn(t) && (this._oscillator.modulationType = t);
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
      return As(this, t);
    });
  }
  dispose() {
    return super.dispose(), this.detune.dispose(), this.frequency.dispose(), this._oscillator.dispose(), this;
  }
}
class ks extends ht {
  constructor() {
    super(P(ks.getDefaults(), arguments, ["value"])), this.override = !1, this.name = "Add", this._sum = new J({ context: this.context }), this.input = this._sum, this.output = this._sum, this.addend = this._param, Ze(this._constantSource, this._sum);
  }
  static getDefaults() {
    return Object.assign(ht.getDefaults(), {
      value: 0
    });
  }
  dispose() {
    return super.dispose(), this._sum.dispose(), this;
  }
}
class Vn extends Ye {
  constructor() {
    const t = P(Vn.getDefaults(), arguments, [
      "min",
      "max"
    ]);
    super(t), this.name = "Scale", this._mult = this.input = new Xt({
      context: this.context,
      value: t.max - t.min
    }), this._add = this.output = new ks({
      context: this.context,
      value: t.min
    }), this._min = t.min, this._max = t.max, this.input.connect(this.output);
  }
  static getDefaults() {
    return Object.assign(Ye.getDefaults(), {
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
class fo extends Ye {
  constructor() {
    super(P(fo.getDefaults(), arguments)), this.name = "Zero", this._gain = new J({ context: this.context }), this.output = this._gain, this.input = void 0, Me(this.context.getConstant(0), this._gain);
  }
  /**
   * clean up
   */
  dispose() {
    return super.dispose(), dc(this.context.getConstant(0), this._gain), this;
  }
}
class Re extends W {
  constructor() {
    const t = P(Re.getDefaults(), arguments, [
      "frequency",
      "min",
      "max"
    ]);
    super(t), this.name = "LFO", this._stoppedValue = 0, this._units = "number", this.convert = !0, this._fromType = mt.prototype._fromType, this._toType = mt.prototype._toType, this._is = mt.prototype._is, this._clampValue = mt.prototype._clampValue, this._oscillator = new Yt(t), this.frequency = this._oscillator.frequency, this._amplitudeGain = new J({
      context: this.context,
      gain: t.amplitude,
      units: "normalRange"
    }), this.amplitude = this._amplitudeGain.gain, this._stoppedSignal = new ht({
      context: this.context,
      units: "audioRange",
      value: 0
    }), this._zeros = new fo({ context: this.context }), this._a2g = new ho({ context: this.context }), this._scaler = this.output = new Vn({
      context: this.context,
      max: t.max,
      min: t.min
    }), this.units = t.units, this.min = t.min, this.max = t.max, this._oscillator.chain(this._amplitudeGain, this._a2g, this._scaler), this._zeros.connect(this._a2g), this._stoppedSignal.connect(this._a2g), at(this, ["amplitude", "frequency"]), this.phase = t.phase;
  }
  static getDefaults() {
    return Object.assign(Yt.getDefaults(), {
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
    const e = this.min, s = this.max;
    this._units = t, this.min = e, this.max = s;
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
  connect(t, e, s) {
    return (t instanceof mt || t instanceof ht) && (this.convert = t.convert, this.units = t.units), Ji(this, t, e, s), this;
  }
  dispose() {
    return super.dispose(), this._oscillator.dispose(), this._stoppedSignal.dispose(), this._zeros.dispose(), this._scaler.dispose(), this._a2g.dispose(), this._amplitudeGain.dispose(), this.amplitude.dispose(), this;
  }
}
function Td(n, t = 1 / 0) {
  const e = /* @__PURE__ */ new WeakMap();
  return function(s, i) {
    Reflect.defineProperty(s, i, {
      configurable: !0,
      enumerable: !0,
      get: function() {
        return e.get(this);
      },
      set: function(r) {
        ae(r, n, t), e.set(this, r);
      }
    });
  };
}
function qn(n, t = 1 / 0) {
  const e = /* @__PURE__ */ new WeakMap();
  return function(s, i) {
    Reflect.defineProperty(s, i, {
      configurable: !0,
      enumerable: !0,
      get: function() {
        return e.get(this);
      },
      set: function(r) {
        ae(this.toSeconds(r), n, t), e.set(this, r);
      }
    });
  };
}
class Is extends Jt {
  constructor() {
    const t = P(Is.getDefaults(), arguments, [
      "url",
      "onload"
    ]);
    super(t), this.name = "Player", this._activeSources = /* @__PURE__ */ new Set(), this._buffer = new Dt({
      onload: this._onload.bind(this, t.onload),
      onerror: t.onerror,
      reverse: t.reverse,
      url: t.url
    }), this.autostart = t.autostart, this._loop = t.loop, this._loopStart = t.loopStart, this._loopEnd = t.loopEnd, this._playbackRate = t.playbackRate, this.fadeIn = t.fadeIn, this.fadeOut = t.fadeOut;
  }
  static getDefaults() {
    return Object.assign(Jt.getDefaults(), {
      autostart: !1,
      fadeIn: 0,
      fadeOut: 0,
      loop: !1,
      loopEnd: 0,
      loopStart: 0,
      onload: Ct,
      onerror: Ct,
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
  _onload(t = Ct) {
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
  start(t, e, s) {
    return super.start(t, e, s), this;
  }
  /**
   * Internal start method
   */
  _start(t, e, s) {
    this._loop ? e = en(e, this._loopStart) : e = en(e, 0);
    const i = this.toSeconds(e), r = s;
    s = en(s, Math.max(this._buffer.duration - i, 0));
    let o = this.toSeconds(s);
    o = o / this._playbackRate, t = this.toSeconds(t);
    const a = new as({
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
    const e = this.toSeconds(t);
    this._activeSources.forEach((s) => s.stop(e));
  }
  /**
   * Stop and then restart the player from the beginning (or offset)
   * @param  time When the player should start.
   * @param  offset The offset from the beginning of the sample to start at.
   * @param  duration How long the sample should play. If no duration is given,
   * 					it will default to the full length of the sample (minus any offset)
   */
  restart(t, e, s) {
    return super.restart(t, e, s), this;
  }
  _restart(t, e, s) {
    var i;
    (i = [...this._activeSources].pop()) === null || i === void 0 || i.stop(t), this._start(t, e, s);
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
  seek(t, e) {
    const s = this.toSeconds(e);
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
  setLoopPoints(t, e) {
    return this.loopStart = t, this.loopEnd = e, this;
  }
  /**
   * If loop is true, the loop will start at this position.
   */
  get loopStart() {
    return this._loopStart;
  }
  set loopStart(t) {
    this._loopStart = t, this.buffer.loaded && ae(this.toSeconds(t), 0, this.buffer.duration), this._activeSources.forEach((e) => {
      e.loopStart = t;
    });
  }
  /**
   * If loop is true, the loop will end at this position.
   */
  get loopEnd() {
    return this._loopEnd;
  }
  set loopEnd(t) {
    this._loopEnd = t, this.buffer.loaded && ae(this.toSeconds(t), 0, this.buffer.duration), this._activeSources.forEach((e) => {
      e.loopEnd = t;
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
    if (this._loop !== t && (this._loop = t, this._activeSources.forEach((e) => {
      e.loop = t;
    }), t)) {
      const e = this._state.getNextState("stopped", this.now());
      e && this._state.cancel(e.time);
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
    const e = this.now(), s = this._state.getNextState("stopped", e);
    s && s.implicitEnd && (this._state.cancel(s.time), this._activeSources.forEach((i) => i.cancelStop())), this._activeSources.forEach((i) => {
      i.playbackRate.setValueAtTime(t, e);
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
pn([
  qn(0)
], Is.prototype, "fadeIn", void 0);
pn([
  qn(0)
], Is.prototype, "fadeOut", void 0);
class yc extends W {
  constructor() {
    const t = P(yc.getDefaults(), arguments, ["urls", "onload"], "urls");
    super(t), this.name = "Players", this.input = void 0, this._players = /* @__PURE__ */ new Map(), this._volume = this.output = new mn({
      context: this.context,
      volume: t.volume
    }), this.volume = this._volume.volume, at(this, "volume"), this._buffers = new ui({
      urls: t.urls,
      onload: t.onload,
      baseUrl: t.baseUrl,
      onerror: t.onerror
    }), this.mute = t.mute, this._fadeIn = t.fadeIn, this._fadeOut = t.fadeOut;
  }
  static getDefaults() {
    return Object.assign(Jt.getDefaults(), {
      baseUrl: "",
      fadeIn: 0,
      fadeOut: 0,
      mute: !1,
      onload: Ct,
      onerror: Ct,
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
    this._fadeIn = t, this._players.forEach((e) => {
      e.fadeIn = t;
    });
  }
  /**
   * The fadeOut time of the each of the sources.
   */
  get fadeOut() {
    return this._fadeOut;
  }
  set fadeOut(t) {
    this._fadeOut = t, this._players.forEach((e) => {
      e.fadeOut = t;
    });
  }
  /**
   * The state of the players object. Returns "started" if any of the players are playing.
   */
  get state() {
    return Array.from(this._players).some(([e, s]) => s.state === "started") ? "started" : "stopped";
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
    if (nt(this.has(t), `No Player with the name ${t} exists on this object`), !this._players.has(t)) {
      const e = new Is({
        context: this.context,
        fadeIn: this._fadeIn,
        fadeOut: this._fadeOut,
        url: this._buffers.get(t)
      }).connect(this.output);
      this._players.set(t, e);
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
  add(t, e, s) {
    return nt(!this._buffers.has(t), "A buffer with that name already exists on this object"), this._buffers.add(t, e, s), this;
  }
  /**
   * Stop all of the players at the given time
   * @param time The time to stop all of the players.
   */
  stopAll(t) {
    return this._players.forEach((e) => e.stop(t)), this;
  }
  dispose() {
    return super.dispose(), this._volume.dispose(), this.volume.dispose(), this._players.forEach((t) => t.dispose()), this._buffers.dispose(), this;
  }
}
class vc extends Jt {
  constructor() {
    const t = P(vc.getDefaults(), arguments, ["url", "onload"]);
    super(t), this.name = "GrainPlayer", this._loopStart = 0, this._loopEnd = 0, this._activeSources = [], this.buffer = new Dt({
      onload: t.onload,
      onerror: t.onerror,
      reverse: t.reverse,
      url: t.url
    }), this._clock = new li({
      context: this.context,
      callback: this._tick.bind(this),
      frequency: 1 / t.grainSize
    }), this._playbackRate = t.playbackRate, this._grainSize = t.grainSize, this._overlap = t.overlap, this.detune = t.detune, this.overlap = t.overlap, this.loop = t.loop, this.playbackRate = t.playbackRate, this.grainSize = t.grainSize, this.loopStart = t.loopStart, this.loopEnd = t.loopEnd, this.reverse = t.reverse, this._clock.on("stop", this._onstop.bind(this));
  }
  static getDefaults() {
    return Object.assign(Jt.getDefaults(), {
      onload: Ct,
      onerror: Ct,
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
  _start(t, e, s) {
    e = en(e, 0), e = this.toSeconds(e), t = this.toSeconds(t);
    const i = 1 / this._clock.frequency.getValueAtTime(t);
    this._clock.start(t, e / i), s && this.stop(t + this.toSeconds(s));
  }
  /**
   * Stop and then restart the player from the beginning (or offset)
   * @param  time When the player should start.
   * @param  offset The offset from the beginning of the sample to start at.
   * @param  duration How long the sample should play. If no duration is given,
   * 					it will default to the full length of the sample (minus any offset)
   */
  restart(t, e, s) {
    return super.restart(t, e, s), this;
  }
  _restart(t, e, s) {
    this._stop(t), this._start(t, e, s);
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
    this._activeSources.forEach((e) => {
      e.fadeOut = 0, e.stop(t);
    }), this.onstop(this);
  }
  /**
   * Invoked on each clock tick. scheduled a new grain at this time.
   */
  _tick(t) {
    const e = this._clock.getTicksAtTime(t), s = e * this._grainSize;
    if (this.log("offset", s), !this.loop && s > this.buffer.duration) {
      this.stop(t);
      return;
    }
    const i = s < this._overlap ? 0 : this._overlap, r = new as({
      context: this.context,
      url: this.buffer,
      fadeIn: i,
      fadeOut: this._overlap,
      loop: this.loop,
      loopStart: this._loopStart,
      loopEnd: this._loopEnd,
      // compute the playbackRate based on the detune
      playbackRate: Xs(this.detune / 100)
    }).connect(this.output);
    r.start(t, this._grainSize * e), r.stop(t + this._grainSize / this.playbackRate), this._activeSources.push(r), r.onended = () => {
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
    ae(t, 1e-3), this._playbackRate = t, this.grainSize = this._grainSize;
  }
  /**
   * The loop start time.
   */
  get loopStart() {
    return this._loopStart;
  }
  set loopStart(t) {
    this.buffer.loaded && ae(this.toSeconds(t), 0, this.buffer.duration), this._loopStart = this.toSeconds(t);
  }
  /**
   * The loop end time.
   */
  get loopEnd() {
    return this._loopEnd;
  }
  set loopEnd(t) {
    this.buffer.loaded && ae(this.toSeconds(t), 0, this.buffer.duration), this._loopEnd = this.toSeconds(t);
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
    const e = this.toSeconds(t);
    ae(e, 0), this._overlap = e;
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
class Ad extends Ye {
  constructor() {
    super(...arguments), this.name = "Abs", this._abs = new gn({
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
class kd extends Ye {
  constructor() {
    super(...arguments), this.name = "GainToAudio", this._norm = new gn({
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
class bc extends Ye {
  constructor() {
    super(...arguments), this.name = "Negate", this._multiply = new Xt({
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
class Es extends ht {
  constructor() {
    super(P(Es.getDefaults(), arguments, ["value"])), this.override = !1, this.name = "Subtract", this._sum = new J({ context: this.context }), this.input = this._sum, this.output = this._sum, this._neg = new bc({ context: this.context }), this.subtrahend = this._param, Ze(this._constantSource, this._neg, this._sum);
  }
  static getDefaults() {
    return Object.assign(ht.getDefaults(), {
      value: 0
    });
  }
  dispose() {
    return super.dispose(), this._neg.dispose(), this._sum.dispose(), this;
  }
}
class po extends Ye {
  constructor() {
    super(P(po.getDefaults(), arguments)), this.name = "GreaterThanZero", this._thresh = this.output = new gn({
      context: this.context,
      length: 127,
      mapping: (t) => t <= 0 ? 0 : 1
    }), this._scale = this.input = new Xt({
      context: this.context,
      value: 1e4
    }), this._scale.connect(this._thresh);
  }
  dispose() {
    return super.dispose(), this._scale.dispose(), this._thresh.dispose(), this;
  }
}
class mo extends ht {
  constructor() {
    const t = P(mo.getDefaults(), arguments, ["value"]);
    super(t), this.name = "GreaterThan", this.override = !1, this._subtract = this.input = new Es({
      context: this.context,
      value: t.value
    }), this._gtz = this.output = new po({
      context: this.context
    }), this.comparator = this._param = this._subtract.subtrahend, at(this, "comparator"), this._subtract.connect(this._gtz);
  }
  static getDefaults() {
    return Object.assign(ht.getDefaults(), {
      value: 0
    });
  }
  dispose() {
    return super.dispose(), this._gtz.dispose(), this._subtract.dispose(), this.comparator.dispose(), this;
  }
}
class go extends Vn {
  constructor() {
    const t = P(go.getDefaults(), arguments, ["min", "max", "exponent"]);
    super(t), this.name = "ScaleExp", this.input = this._exp = new hi({
      context: this.context,
      value: t.exponent
    }), this._exp.connect(this._mult);
  }
  static getDefaults() {
    return Object.assign(Vn.getDefaults(), {
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
class d0 extends ht {
  constructor() {
    const t = P(ht.getDefaults(), arguments, [
      "value",
      "units"
    ]);
    super(t), this.name = "SyncedSignal", this.override = !1, this._lastVal = t.value, this._synced = this.context.transport.scheduleRepeat(this._onTick.bind(this), "1i"), this._syncedCallback = this._anchorValue.bind(this), this.context.transport.on("start", this._syncedCallback), this.context.transport.on("pause", this._syncedCallback), this.context.transport.on("stop", this._syncedCallback), this._constantSource.disconnect(), this._constantSource.stop(0), this._constantSource = this.output = new lo({
      context: this.context,
      offset: t.value,
      units: t.units
    }).start(0), this.setValueAtTime(t.value, 0);
  }
  /**
   * Callback which is invoked every tick.
   */
  _onTick(t) {
    const e = super.getValueAtTime(this.context.transport.seconds);
    this._lastVal !== e && (this._lastVal = e, this._constantSource.offset.setValueAtTime(e, t));
  }
  /**
   * Anchor the value at the start and stop of the Transport
   */
  _anchorValue(t) {
    const e = super.getValueAtTime(this.context.transport.seconds);
    this._lastVal = e, this._constantSource.offset.cancelAndHoldAtTime(t), this._constantSource.offset.setValueAtTime(e, t);
  }
  getValueAtTime(t) {
    const e = new re(this.context, t).toSeconds();
    return super.getValueAtTime(e);
  }
  setValueAtTime(t, e) {
    const s = new re(this.context, e).toSeconds();
    return super.setValueAtTime(t, s), this;
  }
  linearRampToValueAtTime(t, e) {
    const s = new re(this.context, e).toSeconds();
    return super.linearRampToValueAtTime(t, s), this;
  }
  exponentialRampToValueAtTime(t, e) {
    const s = new re(this.context, e).toSeconds();
    return super.exponentialRampToValueAtTime(t, s), this;
  }
  setTargetAtTime(t, e, s) {
    const i = new re(this.context, e).toSeconds();
    return super.setTargetAtTime(t, i, s), this;
  }
  cancelScheduledValues(t) {
    const e = new re(this.context, t).toSeconds();
    return super.cancelScheduledValues(e), this;
  }
  setValueCurveAtTime(t, e, s, i) {
    const r = new re(this.context, e).toSeconds();
    return s = this.toSeconds(s), super.setValueCurveAtTime(t, r, s, i), this;
  }
  cancelAndHoldAtTime(t) {
    const e = new re(this.context, t).toSeconds();
    return super.cancelAndHoldAtTime(e), this;
  }
  setRampPoint(t) {
    const e = new re(this.context, t).toSeconds();
    return super.setRampPoint(e), this;
  }
  exponentialRampTo(t, e, s) {
    const i = new re(this.context, s).toSeconds();
    return super.exponentialRampTo(t, e, i), this;
  }
  linearRampTo(t, e, s) {
    const i = new re(this.context, s).toSeconds();
    return super.linearRampTo(t, e, i), this;
  }
  targetRampTo(t, e, s) {
    const i = new re(this.context, s).toSeconds();
    return super.targetRampTo(t, e, i), this;
  }
  dispose() {
    return super.dispose(), this.context.transport.clear(this._synced), this.context.transport.off("start", this._syncedCallback), this.context.transport.off("pause", this._syncedCallback), this.context.transport.off("stop", this._syncedCallback), this._constantSource.dispose(), this;
  }
}
class be extends W {
  constructor() {
    const t = P(be.getDefaults(), arguments, ["attack", "decay", "sustain", "release"]);
    super(t), this.name = "Envelope", this._sig = new ht({
      context: this.context,
      value: 0
    }), this.output = this._sig, this.input = void 0, this.attack = t.attack, this.decay = t.decay, this.sustain = t.sustain, this.release = t.release, this.attackCurve = t.attackCurve, this.releaseCurve = t.releaseCurve, this.decayCurve = t.decayCurve;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
  _getCurve(t, e) {
    if (dn(t))
      return t;
    {
      let s;
      for (s in Cr)
        if (Cr[s][e] === t)
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
  _setCurve(t, e, s) {
    if (dn(s) && Reflect.has(Cr, s)) {
      const i = Cr[s];
      Nn(i) ? t !== "_decayCurve" && (this[t] = i[e]) : this[t] = i;
    } else if (ve(s) && t !== "_decayCurve")
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
  triggerAttack(t, e = 1) {
    this.log("triggerAttack", t, e), t = this.toSeconds(t);
    let i = this.toSeconds(this.attack);
    const r = this.toSeconds(this.decay), o = this.getValueAtTime(t);
    if (o > 0) {
      const a = 1 / i;
      i = (1 - o) / a;
    }
    if (i < this.sampleTime)
      this._sig.cancelScheduledValues(t), this._sig.setValueAtTime(e, t);
    else if (this._attackCurve === "linear")
      this._sig.linearRampTo(e, i, t);
    else if (this._attackCurve === "exponential")
      this._sig.targetRampTo(e, i, t);
    else {
      this._sig.cancelAndHoldAtTime(t);
      let a = this._attackCurve;
      for (let c = 1; c < a.length; c++)
        if (a[c - 1] <= o && o <= a[c]) {
          a = this._attackCurve.slice(c), a[0] = o;
          break;
        }
      this._sig.setValueCurveAtTime(a, t, i, e);
    }
    if (r && this.sustain < 1) {
      const a = e * this.sustain, c = t + i;
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
    const e = this.getValueAtTime(t);
    if (e > 0) {
      const s = this.toSeconds(this.release);
      s < this.sampleTime ? this._sig.setValueAtTime(0, t) : this._releaseCurve === "linear" ? this._sig.linearRampTo(0, s, t) : this._releaseCurve === "exponential" ? this._sig.targetRampTo(0, s, t) : (nt(ve(this._releaseCurve), "releaseCurve must be either 'linear', 'exponential' or an array"), this._sig.cancelAndHoldAtTime(t), this._sig.setValueCurveAtTime(this._releaseCurve, t, s, e));
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
  triggerAttackRelease(t, e, s = 1) {
    return e = this.toSeconds(e), this.triggerAttack(e, s), this.triggerRelease(e + this.toSeconds(t)), this;
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
  connect(t, e = 0, s = 0) {
    return Ji(this, t, e, s), this;
  }
  /**
   * Render the envelope curve to an array of the given length.
   * Good for visualizing the envelope curve. Rescales the duration of the
   * envelope to fit the length.
   */
  asArray() {
    return jt(this, arguments, void 0, function* (t = 1024) {
      const e = t / this.context.sampleRate, s = new ai(1, e, this.context.sampleRate), i = this.toSeconds(this.attack) + this.toSeconds(this.decay), r = i + this.toSeconds(this.release), o = r * 0.1, a = r + o, c = new this.constructor(Object.assign(this.get(), {
        attack: e * this.toSeconds(this.attack) / a,
        decay: e * this.toSeconds(this.decay) / a,
        release: e * this.toSeconds(this.release) / a,
        context: s
      }));
      return c._sig.toDestination(), c.triggerAttackRelease(e * (i + o) / a, 0), (yield s.render()).getChannelData(0);
    });
  }
  dispose() {
    return super.dispose(), this._sig.dispose(), this;
  }
}
pn([
  qn(0)
], be.prototype, "attack", void 0);
pn([
  qn(0)
], be.prototype, "decay", void 0);
pn([
  Td(0, 1)
], be.prototype, "sustain", void 0);
pn([
  qn(0)
], be.prototype, "release", void 0);
const Cr = (() => {
  let t, e;
  const s = [];
  for (t = 0; t < 128; t++)
    s[t] = Math.sin(t / 127 * (Math.PI / 2));
  const i = [], r = 6.4;
  for (t = 0; t < 127; t++) {
    e = t / 127;
    const d = Math.sin(e * (Math.PI * 2) * r - Math.PI / 2) + 1;
    i[t] = d / 10 + e * 0.83;
  }
  i[127] = 1;
  const o = [], a = 5;
  for (t = 0; t < 128; t++)
    o[t] = Math.ceil(t / 127 * a) / a;
  const c = [];
  for (t = 0; t < 128; t++)
    e = t / 127, c[t] = 0.5 * (1 - Math.cos(Math.PI * e));
  const l = [];
  for (t = 0; t < 128; t++) {
    e = t / 127;
    const d = Math.pow(e, 3) * 4 + 0.2, f = Math.cos(d * Math.PI * 2 * e);
    l[t] = Math.abs(f * (1 - e));
  }
  function u(d) {
    const f = new Array(d.length);
    for (let p = 0; p < d.length; p++)
      f[p] = 1 - d[p];
    return f;
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
class nn extends W {
  constructor() {
    const t = P(nn.getDefaults(), arguments);
    super(t), this._scheduledEvents = [], this._synced = !1, this._original_triggerAttack = this.triggerAttack, this._original_triggerRelease = this.triggerRelease, this._syncedRelease = (e) => this._original_triggerRelease(e), this._volume = this.output = new mn({
      context: this.context,
      volume: t.volume
    }), this.volume = this._volume.volume, at(this, "volume");
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
  _syncMethod(t, e) {
    const s = this["_original_" + t] = this[t];
    this[t] = (...i) => {
      const r = i[e], o = this.context.transport.schedule((a) => {
        i[e] = a, s.apply(this, i);
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
  triggerAttackRelease(t, e, s, i) {
    const r = this.toSeconds(s), o = this.toSeconds(e);
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
class ye extends nn {
  constructor() {
    const t = P(ye.getDefaults(), arguments);
    super(t), this.portamento = t.portamento, this.onsilence = t.onsilence;
  }
  static getDefaults() {
    return Object.assign(nn.getDefaults(), {
      detune: 0,
      onsilence: Ct,
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
  triggerAttack(t, e, s = 1) {
    this.log("triggerAttack", t, e, s);
    const i = this.toSeconds(e);
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
    const e = this.toSeconds(t);
    return this._triggerEnvelopeRelease(e), this;
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
  setNote(t, e) {
    const s = this.toSeconds(e), i = t instanceof Oe ? t.toFrequency() : t;
    if (this.portamento > 0 && this.getLevelAtTime(s) > 0.05) {
      const r = this.toSeconds(this.portamento);
      this.frequency.exponentialRampTo(i, r, s);
    } else
      this.frequency.setValueAtTime(i, s);
    return this;
  }
}
pn([
  qn(0)
], ye.prototype, "portamento", void 0);
class pi extends be {
  constructor() {
    super(P(pi.getDefaults(), arguments, [
      "attack",
      "decay",
      "sustain",
      "release"
    ])), this.name = "AmplitudeEnvelope", this._gainNode = new J({
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
class ts extends ye {
  constructor() {
    const t = P(ts.getDefaults(), arguments);
    super(t), this.name = "Synth", this.oscillator = new Fn(Object.assign({
      context: this.context,
      detune: t.detune,
      onstop: () => this.onsilence(this)
    }, t.oscillator)), this.frequency = this.oscillator.frequency, this.detune = this.oscillator.detune, this.envelope = new pi(Object.assign({
      context: this.context
    }, t.envelope)), this.oscillator.chain(this.envelope, this.output), at(this, ["oscillator", "frequency", "detune", "envelope"]);
  }
  static getDefaults() {
    return Object.assign(ye.getDefaults(), {
      envelope: Object.assign(_e(be.getDefaults(), Object.keys(W.getDefaults())), {
        attack: 5e-3,
        decay: 0.1,
        release: 1,
        sustain: 0.3
      }),
      oscillator: Object.assign(_e(Fn.getDefaults(), [
        ...Object.keys(Jt.getDefaults()),
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
  _triggerEnvelopeAttack(t, e) {
    if (this.envelope.triggerAttack(t, e), this.oscillator.start(t), this.envelope.sustain === 0) {
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
class Fi extends ye {
  constructor() {
    const t = P(Fi.getDefaults(), arguments);
    super(t), this.name = "ModulationSynth", this._carrier = new ts({
      context: this.context,
      oscillator: t.oscillator,
      envelope: t.envelope,
      onsilence: () => this.onsilence(this),
      volume: -10
    }), this._modulator = new ts({
      context: this.context,
      oscillator: t.modulation,
      envelope: t.modulationEnvelope,
      volume: -10
    }), this.oscillator = this._carrier.oscillator, this.envelope = this._carrier.envelope, this.modulation = this._modulator.oscillator, this.modulationEnvelope = this._modulator.envelope, this.frequency = new ht({
      context: this.context,
      units: "frequency"
    }), this.detune = new ht({
      context: this.context,
      value: t.detune,
      units: "cents"
    }), this.harmonicity = new Xt({
      context: this.context,
      value: t.harmonicity,
      minValue: 0
    }), this._modulationNode = new J({
      context: this.context,
      gain: 0
    }), at(this, [
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
    return Object.assign(ye.getDefaults(), {
      harmonicity: 3,
      oscillator: Object.assign(_e(Fn.getDefaults(), [
        ...Object.keys(Jt.getDefaults()),
        "frequency",
        "detune"
      ]), {
        type: "sine"
      }),
      envelope: Object.assign(_e(be.getDefaults(), Object.keys(W.getDefaults())), {
        attack: 0.01,
        decay: 0.01,
        sustain: 1,
        release: 0.5
      }),
      modulation: Object.assign(_e(Fn.getDefaults(), [
        ...Object.keys(Jt.getDefaults()),
        "frequency",
        "detune"
      ]), {
        type: "square"
      }),
      modulationEnvelope: Object.assign(_e(be.getDefaults(), Object.keys(W.getDefaults())), {
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
  _triggerEnvelopeAttack(t, e) {
    this._carrier._triggerEnvelopeAttack(t, e), this._modulator._triggerEnvelopeAttack(t, e);
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
class xc extends Fi {
  constructor() {
    super(P(xc.getDefaults(), arguments)), this.name = "AMSynth", this._modulationScale = new ho({
      context: this.context
    }), this.frequency.connect(this._carrier.frequency), this.frequency.chain(this.harmonicity, this._modulator.frequency), this.detune.fan(this._carrier.detune, this._modulator.detune), this._modulator.chain(this._modulationScale, this._modulationNode.gain), this._carrier.chain(this._modulationNode, this.output);
  }
  dispose() {
    return super.dispose(), this._modulationScale.dispose(), this;
  }
}
class Vi extends W {
  constructor() {
    const t = P(Vi.getDefaults(), arguments, ["frequency", "type"]);
    super(t), this.name = "BiquadFilter", this._filter = this.context.createBiquadFilter(), this.input = this.output = this._filter, this.Q = new mt({
      context: this.context,
      units: "number",
      value: t.Q,
      param: this._filter.Q
    }), this.frequency = new mt({
      context: this.context,
      units: "frequency",
      value: t.frequency,
      param: this._filter.frequency
    }), this.detune = new mt({
      context: this.context,
      units: "cents",
      value: t.detune,
      param: this._filter.detune
    }), this.gain = new mt({
      context: this.context,
      units: "decibels",
      convert: !1,
      value: t.gain,
      param: this._filter.gain
    }), this.type = t.type;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
    nt([
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
    const e = new Float32Array(t);
    for (let o = 0; o < t; o++) {
      const c = Math.pow(o / t, 2) * 19980 + 20;
      e[o] = c;
    }
    const s = new Float32Array(t), i = new Float32Array(t), r = this.context.createBiquadFilter();
    return r.type = this.type, r.Q.value = this.Q.value, r.frequency.value = this.frequency.value, r.gain.value = this.gain.value, r.getFrequencyResponse(e, s, i), s;
  }
  dispose() {
    return super.dispose(), this._filter.disconnect(), this.Q.dispose(), this.frequency.dispose(), this.gain.dispose(), this.detune.dispose(), this;
  }
}
class Be extends W {
  constructor() {
    const t = P(Be.getDefaults(), arguments, [
      "frequency",
      "type",
      "rolloff"
    ]);
    super(t), this.name = "Filter", this.input = new J({ context: this.context }), this.output = new J({ context: this.context }), this._filters = [], this._filters = [], this.Q = new ht({
      context: this.context,
      units: "positive",
      value: t.Q
    }), this.frequency = new ht({
      context: this.context,
      units: "frequency",
      value: t.frequency
    }), this.detune = new ht({
      context: this.context,
      units: "cents",
      value: t.detune
    }), this.gain = new ht({
      context: this.context,
      units: "decibels",
      convert: !1,
      value: t.gain
    }), this._type = t.type, this.rolloff = t.rolloff, at(this, ["detune", "frequency", "gain", "Q"]);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
    nt([
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
    const e = Ge(t) ? t : parseInt(t, 10), s = [-12, -24, -48, -96];
    let i = s.indexOf(e);
    nt(i !== -1, `rolloff can only be ${s.join(", ")}`), i += 1, this._rolloff = e, this.input.disconnect(), this._filters.forEach((r) => r.disconnect()), this._filters = new Array(i);
    for (let r = 0; r < i; r++) {
      const o = new Vi({
        context: this.context
      });
      o.type = this._type, this.frequency.connect(o.frequency), this.detune.connect(o.detune), this.Q.connect(o.Q), this.gain.connect(o.gain), this._filters[r] = o;
    }
    this._internalChannels = this._filters, Ze(this.input, ...this._internalChannels, this.output);
  }
  /**
   * Get the frequency response curve. This curve represents how the filter
   * responses to frequencies between 20hz-20khz.
   * @param  len The number of values to return
   * @return The frequency response curve between 20-20kHz
   */
  getFrequencyResponse(t = 128) {
    const e = new Vi({
      context: this.context,
      frequency: this.frequency.value,
      gain: this.gain.value,
      Q: this.Q.value,
      type: this._type,
      detune: this.detune.value
    }), s = new Float32Array(t).map(() => 1);
    return this._filters.forEach(() => {
      e.getFrequencyResponse(t).forEach((r, o) => s[o] *= r);
    }), e.dispose(), s;
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._filters.forEach((t) => {
      t.dispose();
    }), Ki(this, ["detune", "frequency", "gain", "Q"]), this.frequency.dispose(), this.Q.dispose(), this.detune.dispose(), this.gain.dispose(), this;
  }
}
class Wi extends be {
  constructor() {
    const t = P(Wi.getDefaults(), arguments, ["attack", "decay", "sustain", "release"]);
    super(t), this.name = "FrequencyEnvelope", this._octaves = t.octaves, this._baseFrequency = this.toFrequency(t.baseFrequency), this._exponent = this.input = new hi({
      context: this.context,
      value: t.exponent
    }), this._scale = this.output = new Vn({
      context: this.context,
      min: this._baseFrequency,
      max: this._baseFrequency * Math.pow(2, this._octaves)
    }), this._sig.chain(this._exponent, this._scale);
  }
  static getDefaults() {
    return Object.assign(be.getDefaults(), {
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
    const e = this.toFrequency(t);
    ae(e, 0), this._baseFrequency = e, this._scale.min = this._baseFrequency, this.octaves = this._octaves;
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
class gs extends ye {
  constructor() {
    const t = P(gs.getDefaults(), arguments);
    super(t), this.name = "MonoSynth", this.oscillator = new Fn(Object.assign(t.oscillator, {
      context: this.context,
      detune: t.detune,
      onstop: () => this.onsilence(this)
    })), this.frequency = this.oscillator.frequency, this.detune = this.oscillator.detune, this.filter = new Be(Object.assign(t.filter, { context: this.context })), this.filterEnvelope = new Wi(Object.assign(t.filterEnvelope, { context: this.context })), this.envelope = new pi(Object.assign(t.envelope, { context: this.context })), this.oscillator.chain(this.filter, this.envelope, this.output), this.filterEnvelope.connect(this.filter.frequency), at(this, [
      "oscillator",
      "frequency",
      "detune",
      "filter",
      "filterEnvelope",
      "envelope"
    ]);
  }
  static getDefaults() {
    return Object.assign(ye.getDefaults(), {
      envelope: Object.assign(_e(be.getDefaults(), Object.keys(W.getDefaults())), {
        attack: 5e-3,
        decay: 0.1,
        release: 1,
        sustain: 0.9
      }),
      filter: Object.assign(_e(Be.getDefaults(), Object.keys(W.getDefaults())), {
        Q: 1,
        rolloff: -12,
        type: "lowpass"
      }),
      filterEnvelope: Object.assign(_e(Wi.getDefaults(), Object.keys(W.getDefaults())), {
        attack: 0.6,
        baseFrequency: 200,
        decay: 0.2,
        exponent: 2,
        octaves: 3,
        release: 2,
        sustain: 0.5
      }),
      oscillator: Object.assign(_e(Fn.getDefaults(), Object.keys(Jt.getDefaults())), {
        type: "sawtooth"
      })
    });
  }
  /**
   * start the attack portion of the envelope
   * @param time the time the attack should start
   * @param velocity the velocity of the note (0-1)
   */
  _triggerEnvelopeAttack(t, e = 1) {
    if (this.envelope.triggerAttack(t, e), this.filterEnvelope.triggerAttack(t), this.oscillator.start(t), this.envelope.sustain === 0) {
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
class wc extends ye {
  constructor() {
    const t = P(wc.getDefaults(), arguments);
    super(t), this.name = "DuoSynth", this.voice0 = new gs(Object.assign(t.voice0, {
      context: this.context,
      onsilence: () => this.onsilence(this)
    })), this.voice1 = new gs(Object.assign(t.voice1, {
      context: this.context
    })), this.harmonicity = new Xt({
      context: this.context,
      units: "positive",
      value: t.harmonicity
    }), this._vibrato = new Re({
      frequency: t.vibratoRate,
      context: this.context,
      min: -50,
      max: 50
    }), this._vibrato.start(), this.vibratoRate = this._vibrato.frequency, this._vibratoGain = new J({
      context: this.context,
      units: "normalRange",
      gain: t.vibratoAmount
    }), this.vibratoAmount = this._vibratoGain.gain, this.frequency = new ht({
      context: this.context,
      units: "frequency",
      value: 440
    }), this.detune = new ht({
      context: this.context,
      units: "cents",
      value: t.detune
    }), this.frequency.connect(this.voice0.frequency), this.frequency.chain(this.harmonicity, this.voice1.frequency), this._vibrato.connect(this._vibratoGain), this._vibratoGain.fan(this.voice0.detune, this.voice1.detune), this.detune.fan(this.voice0.detune, this.voice1.detune), this.voice0.connect(this.output), this.voice1.connect(this.output), at(this, [
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
    return tn(ye.getDefaults(), {
      vibratoAmount: 0.5,
      vibratoRate: 5,
      harmonicity: 1.5,
      voice0: tn(_e(gs.getDefaults(), Object.keys(ye.getDefaults())), {
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
      voice1: tn(_e(gs.getDefaults(), Object.keys(ye.getDefaults())), {
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
  _triggerEnvelopeAttack(t, e) {
    this.voice0._triggerEnvelopeAttack(t, e), this.voice1._triggerEnvelopeAttack(t, e);
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
class Cc extends Fi {
  constructor() {
    const t = P(Cc.getDefaults(), arguments);
    super(t), this.name = "FMSynth", this.modulationIndex = new Xt({
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
const Ql = [1, 1.483, 1.932, 2.546, 2.63, 3.897];
class Sc extends ye {
  constructor() {
    const t = P(Sc.getDefaults(), arguments);
    super(t), this.name = "MetalSynth", this._oscillators = [], this._freqMultipliers = [], this.detune = new ht({
      context: this.context,
      units: "cents",
      value: t.detune
    }), this.frequency = new ht({
      context: this.context,
      units: "frequency"
    }), this._amplitude = new J({
      context: this.context,
      gain: 0
    }).connect(this.output), this._highpass = new Be({
      // Q: -3.0102999566398125,
      Q: 0,
      context: this.context,
      type: "highpass"
    }).connect(this._amplitude);
    for (let e = 0; e < Ql.length; e++) {
      const s = new di({
        context: this.context,
        harmonicity: t.harmonicity,
        modulationIndex: t.modulationIndex,
        modulationType: "square",
        onstop: e === 0 ? () => this.onsilence(this) : Ct,
        type: "square"
      });
      s.connect(this._highpass), this._oscillators[e] = s;
      const i = new Xt({
        context: this.context,
        value: Ql[e]
      });
      this._freqMultipliers[e] = i, this.frequency.chain(i, s.frequency), this.detune.connect(s.detune);
    }
    this._filterFreqScaler = new Vn({
      context: this.context,
      max: 7e3,
      min: this.toFrequency(t.resonance)
    }), this.envelope = new be({
      attack: t.envelope.attack,
      attackCurve: "linear",
      context: this.context,
      decay: t.envelope.decay,
      release: t.envelope.release,
      sustain: 0
    }), this.envelope.chain(this._filterFreqScaler, this._highpass.frequency), this.envelope.connect(this._amplitude.gain), this._octaves = t.octaves, this.octaves = t.octaves;
  }
  static getDefaults() {
    return tn(ye.getDefaults(), {
      envelope: Object.assign(_e(be.getDefaults(), Object.keys(W.getDefaults())), {
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
  _triggerEnvelopeAttack(t, e = 1) {
    return this.envelope.triggerAttack(t, e), this._oscillators.forEach((s) => s.start(t)), this.envelope.sustain === 0 && this._oscillators.forEach((s) => {
      s.stop(t + this.toSeconds(this.envelope.attack) + this.toSeconds(this.envelope.decay));
    }), this;
  }
  /**
   * Trigger the release of the envelope.
   * @param time When the release should be triggered.
   */
  _triggerEnvelopeRelease(t) {
    return this.envelope.triggerRelease(t), this._oscillators.forEach((e) => e.stop(t + this.toSeconds(this.envelope.release))), this;
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
    this._oscillators.forEach((e) => e.modulationIndex.value = t);
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
    this._oscillators.forEach((e) => e.harmonicity.value = t);
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
class ir extends ts {
  constructor() {
    const t = P(ir.getDefaults(), arguments);
    super(t), this.name = "MembraneSynth", this.portamento = 0, this.pitchDecay = t.pitchDecay, this.octaves = t.octaves, at(this, ["oscillator", "envelope"]);
  }
  static getDefaults() {
    return tn(ye.getDefaults(), ts.getDefaults(), {
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
  setNote(t, e) {
    const s = this.toSeconds(e), i = this.toFrequency(t instanceof Oe ? t.toFrequency() : t), r = i * this.octaves;
    return this.oscillator.frequency.setValueAtTime(r, s), this.oscillator.frequency.exponentialRampToValueAtTime(i, s + this.toSeconds(this.pitchDecay)), this;
  }
  dispose() {
    return super.dispose(), this;
  }
}
pn([
  Td(0)
], ir.prototype, "octaves", void 0);
pn([
  qn(0)
], ir.prototype, "pitchDecay", void 0);
class Tc extends nn {
  constructor() {
    const t = P(Tc.getDefaults(), arguments);
    super(t), this.name = "NoiseSynth", this.noise = new Jn(Object.assign({
      context: this.context
    }, t.noise)), this.envelope = new pi(Object.assign({
      context: this.context
    }, t.envelope)), this.noise.chain(this.envelope, this.output);
  }
  static getDefaults() {
    return Object.assign(nn.getDefaults(), {
      envelope: Object.assign(_e(be.getDefaults(), Object.keys(W.getDefaults())), {
        decay: 0.1,
        sustain: 0
      }),
      noise: Object.assign(_e(Jn.getDefaults(), Object.keys(Jt.getDefaults())), {
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
  triggerAttack(t, e = 1) {
    return t = this.toSeconds(t), this.envelope.triggerAttack(t, e), this.noise.start(t), this.envelope.sustain === 0 && this.noise.stop(t + this.toSeconds(this.envelope.attack) + this.toSeconds(this.envelope.decay)), this;
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
  triggerAttackRelease(t, e, s = 1) {
    return e = this.toSeconds(e), t = this.toSeconds(t), this.triggerAttack(e, s), this.triggerRelease(e + t), this;
  }
  dispose() {
    return super.dispose(), this.noise.dispose(), this.envelope.dispose(), this;
  }
}
const Ac = /* @__PURE__ */ new Set();
function kc(n) {
  Ac.add(n);
}
function Id(n, t) {
  const e = (
    /* javascript */
    `registerProcessor("${n}", ${t})`
  );
  Ac.add(e);
}
function f0() {
  return Array.from(Ac).join(`
`);
}
class ca extends W {
  constructor(t) {
    super(t), this.name = "ToneAudioWorklet", this.workletOptions = {}, this.onprocessorerror = Ct;
    const e = URL.createObjectURL(new Blob([f0()], { type: "text/javascript" })), s = this._audioWorkletName();
    this._dummyGain = this.context.createGain(), this._dummyParam = this._dummyGain.gain, this.context.addAudioWorkletModule(e).then(() => {
      this.disposed || (this._worklet = this.context.createAudioWorkletNode(s, this.workletOptions), this._worklet.onprocessorerror = this.onprocessorerror.bind(this), this.onReady(this._worklet));
    });
  }
  dispose() {
    return super.dispose(), this._dummyGain.disconnect(), this._worklet && (this._worklet.port.postMessage("dispose"), this._worklet.disconnect()), this;
  }
}
const p0 = (
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
kc(p0);
const m0 = (
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
kc(m0);
const g0 = (
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
kc(g0);
const Ed = "feedback-comb-filter", _0 = (
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
Id(Ed, _0);
class rr extends ca {
  constructor() {
    const t = P(rr.getDefaults(), arguments, ["delayTime", "resonance"]);
    super(t), this.name = "FeedbackCombFilter", this.input = new J({ context: this.context }), this.output = new J({ context: this.context }), this.delayTime = new mt({
      context: this.context,
      value: t.delayTime,
      units: "time",
      minValue: 0,
      maxValue: 1,
      param: this._dummyParam,
      swappable: !0
    }), this.resonance = new mt({
      context: this.context,
      value: t.resonance,
      units: "normalRange",
      param: this._dummyParam,
      swappable: !0
    }), at(this, ["resonance", "delayTime"]);
  }
  _audioWorkletName() {
    return Ed;
  }
  /**
   * The default parameters
   */
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      delayTime: 0.1,
      resonance: 0.5
    });
  }
  onReady(t) {
    Ze(this.input, t, this.output);
    const e = t.parameters.get("delayTime");
    this.delayTime.setParam(e);
    const s = t.parameters.get("feedback");
    this.resonance.setParam(s);
  }
  dispose() {
    return super.dispose(), this.input.dispose(), this.output.dispose(), this.delayTime.dispose(), this.resonance.dispose(), this;
  }
}
class or extends W {
  constructor() {
    const t = P(or.getDefaults(), arguments, ["frequency", "type"]);
    super(t), this.name = "OnePoleFilter", this._frequency = t.frequency, this._type = t.type, this.input = new J({ context: this.context }), this.output = new J({ context: this.context }), this._createFilter();
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      frequency: 880,
      type: "lowpass"
    });
  }
  /**
   * Create a filter and dispose the old one
   */
  _createFilter() {
    const t = this._filter, e = this.toFrequency(this._frequency), s = 1 / (2 * Math.PI * e);
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
    const e = new Float32Array(t);
    for (let r = 0; r < t; r++) {
      const a = Math.pow(r / t, 2) * 19980 + 20;
      e[r] = a;
    }
    const s = new Float32Array(t), i = new Float32Array(t);
    return this._filter.getFrequencyResponse(e, s, i), s;
  }
  dispose() {
    return super.dispose(), this.input.dispose(), this.output.dispose(), this._filter.disconnect(), this;
  }
}
class ar extends W {
  constructor() {
    const t = P(ar.getDefaults(), arguments, ["delayTime", "resonance", "dampening"]);
    super(t), this.name = "LowpassCombFilter", this._combFilter = this.output = new rr({
      context: this.context,
      delayTime: t.delayTime,
      resonance: t.resonance
    }), this.delayTime = this._combFilter.delayTime, this.resonance = this._combFilter.resonance, this._lowpass = this.input = new or({
      context: this.context,
      frequency: t.dampening,
      type: "lowpass"
    }), this._lowpass.connect(this._combFilter);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
class Ic extends nn {
  constructor() {
    const t = P(Ic.getDefaults(), arguments);
    super(t), this.name = "PluckSynth", this._noise = new Jn({
      context: this.context,
      type: "pink"
    }), this.attackNoise = t.attackNoise, this._lfcf = new ar({
      context: this.context,
      dampening: t.dampening,
      resonance: t.resonance
    }), this.resonance = t.resonance, this.release = t.release, this._noise.connect(this._lfcf), this._lfcf.connect(this.output);
  }
  static getDefaults() {
    return tn(nn.getDefaults(), {
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
  triggerAttack(t, e) {
    const s = this.toFrequency(t);
    e = this.toSeconds(e);
    const i = 1 / s;
    return this._lfcf.delayTime.setValueAtTime(i, e), this._noise.start(e), this._noise.stop(e + i * this.attackNoise), this._lfcf.resonance.cancelScheduledValues(e), this._lfcf.resonance.setValueAtTime(this.resonance, e), this;
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
class Ec extends nn {
  constructor() {
    const t = P(Ec.getDefaults(), arguments, ["voice", "options"]);
    super(t), this.name = "PolySynth", this._availableVoices = [], this._activeVoices = [], this._voices = [], this._gcTimeout = -1, this._averageActiveVoices = 0, this._syncedRelease = (i) => this.releaseAll(i), nt(!Ge(t.voice), "DEPRECATED: The polyphony count is no longer the first argument.");
    const e = t.voice.getDefaults();
    this.options = Object.assign(e, t.options), this.voice = t.voice, this.maxPolyphony = t.maxPolyphony, this._dummyVoice = this._getNextAvailableVoice();
    const s = this._voices.indexOf(this._dummyVoice);
    this._voices.splice(s, 1), this._gcTimeout = this.context.setInterval(this._collectGarbage.bind(this), 1);
  }
  static getDefaults() {
    return Object.assign(nn.getDefaults(), {
      maxPolyphony: 32,
      options: {},
      voice: ts
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
    const e = this._activeVoices.findIndex((s) => s.voice === t);
    this._activeVoices.splice(e, 1);
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
      return nt(t instanceof ye, "Voice must extend Monophonic class"), t.connect(this.output), this._voices.push(t), t;
    } else
      ii("Max polyphony exceeded. Note dropped.");
  }
  /**
   * Occasionally check if there are any allocated voices which can be cleaned up.
   */
  _collectGarbage() {
    if (this._averageActiveVoices = Math.max(this._averageActiveVoices * 0.95, this.activeVoices), this._availableVoices.length && this._voices.length > Math.ceil(this._averageActiveVoices + 1)) {
      const t = this._availableVoices.shift(), e = this._voices.indexOf(t);
      this._voices.splice(e, 1), this.context.isOffline || t.dispose();
    }
  }
  /**
   * Internal method which triggers the attack
   */
  _triggerAttack(t, e, s) {
    t.forEach((i) => {
      const r = new Hs(this.context, i).toMidi(), o = this._getNextAvailableVoice();
      o && (o.triggerAttack(i, e, s), this._activeVoices.push({
        midi: r,
        voice: o,
        released: !1
      }), this.log("triggerAttack", i, e));
    });
  }
  /**
   * Internal method which triggers the release
   */
  _triggerRelease(t, e) {
    t.forEach((s) => {
      const i = new Hs(this.context, s).toMidi(), r = this._activeVoices.find(({ midi: o, released: a }) => o === i && !a);
      r && (r.voice.triggerRelease(e), r.released = !0, this.log("triggerRelease", s, e));
    });
  }
  /**
   * Schedule the attack/release events. If the time is in the future, then it should set a timeout
   * to wait for just-in-time scheduling
   */
  _scheduleEvent(t, e, s, i) {
    nt(!this.disposed, "Synth was already disposed"), s <= this.now() ? t === "attack" ? this._triggerAttack(e, s, i) : this._triggerRelease(e, s) : this.context.setTimeout(() => {
      this.disposed || this._scheduleEvent(t, e, s, i);
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
  triggerAttack(t, e, s) {
    Array.isArray(t) || (t = [t]);
    const i = this.toSeconds(e);
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
  triggerRelease(t, e) {
    Array.isArray(t) || (t = [t]);
    const s = this.toSeconds(e);
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
  triggerAttackRelease(t, e, s, i) {
    const r = this.toSeconds(s);
    if (this.triggerAttack(t, r, i), ve(e)) {
      nt(ve(t), "If the duration is an array, the notes must also be an array"), t = t;
      for (let o = 0; o < t.length; o++) {
        const a = e[Math.min(o, e.length - 1)], c = this.toSeconds(a);
        nt(c > 0, "The duration must be greater than 0"), this.triggerRelease(t[o], r + c);
      }
    } else {
      const o = this.toSeconds(e);
      nt(o > 0, "The duration must be greater than 0"), this.triggerRelease(t, r + o);
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
    const e = _e(t, [
      "onsilence",
      "context"
    ]);
    return this.options = tn(this.options, e), this._voices.forEach((s) => s.set(e)), this._dummyVoice.set(e), this;
  }
  get() {
    return this._dummyVoice.get();
  }
  /**
   * Trigger the release portion of all the currently active voices immediately.
   * Useful for silencing the synth.
   */
  releaseAll(t) {
    const e = this.toSeconds(t);
    return this._activeVoices.forEach(({ voice: s }) => {
      s.triggerRelease(e);
    }), this;
  }
  dispose() {
    return super.dispose(), this._dummyVoice.dispose(), this._voices.forEach((t) => t.dispose()), this._activeVoices = [], this._availableVoices = [], this.context.clearInterval(this._gcTimeout), this;
  }
}
class cr extends nn {
  constructor() {
    const t = P(cr.getDefaults(), arguments, ["urls", "onload", "baseUrl"], "urls");
    super(t), this.name = "Sampler", this._activeSources = /* @__PURE__ */ new Map();
    const e = {};
    Object.keys(t.urls).forEach((s) => {
      const i = parseInt(s, 10);
      if (nt(ki(s) || Ge(i) && isFinite(i), `url key is neither a note or midi pitch: ${s}`), ki(s)) {
        const r = new Oe(this.context, s).toMidi();
        e[r] = t.urls[s];
      } else Ge(i) && isFinite(i) && (e[i] = t.urls[i]);
    }), this._buffers = new ui({
      urls: e,
      onload: t.onload,
      baseUrl: t.baseUrl,
      onerror: t.onerror
    }), this.attack = t.attack, this.release = t.release, this.curve = t.curve, this._buffers.loaded && Promise.resolve().then(t.onload);
  }
  static getDefaults() {
    return Object.assign(nn.getDefaults(), {
      attack: 0,
      baseUrl: "",
      curve: "exponential",
      onload: Ct,
      onerror: Ct,
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
  triggerAttack(t, e, s = 1) {
    return this.log("triggerAttack", t, e, s), Array.isArray(t) || (t = [t]), t.forEach((i) => {
      const r = Cd(new Oe(this.context, i).toFrequency()), o = Math.round(r), a = r - o, c = this._findClosest(o), l = o - c, u = this._buffers.get(l), h = Xs(c + a), d = new as({
        url: u,
        context: this.context,
        curve: this.curve,
        fadeIn: this.attack,
        fadeOut: this.release,
        playbackRate: h
      }).connect(this.output);
      d.start(e, 0, u.duration / h, s), ve(this._activeSources.get(o)) || this._activeSources.set(o, []), this._activeSources.get(o).push(d), d.onended = () => {
        if (this._activeSources && this._activeSources.has(o)) {
          const f = this._activeSources.get(o), p = f.indexOf(d);
          p !== -1 && f.splice(p, 1);
        }
      };
    }), this;
  }
  /**
   * @param  notes	The note to release, or an array of notes.
   * @param  time     	When to release the note.
   */
  triggerRelease(t, e) {
    return this.log("triggerRelease", t, e), Array.isArray(t) || (t = [t]), t.forEach((s) => {
      const i = new Oe(this.context, s).toMidi();
      if (this._activeSources.has(i) && this._activeSources.get(i).length) {
        const r = this._activeSources.get(i);
        e = this.toSeconds(e), r.forEach((o) => {
          o.stop(e);
        }), this._activeSources.set(i, []);
      }
    }), this;
  }
  /**
   * Release all currently active notes.
   * @param  time     	When to release the notes.
   */
  releaseAll(t) {
    const e = this.toSeconds(t);
    return this._activeSources.forEach((s) => {
      for (; s.length; )
        s.shift().stop(e);
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
  triggerAttackRelease(t, e, s, i = 1) {
    const r = this.toSeconds(s);
    return this.triggerAttack(t, r, i), ve(e) ? (nt(ve(t), "notes must be an array when duration is array"), t.forEach((o, a) => {
      const c = e[Math.min(a, e.length - 1)];
      this.triggerRelease(o, r + this.toSeconds(c));
    })) : this.triggerRelease(t, r + this.toSeconds(e)), this;
  }
  /**
   * Add a note to the sampler.
   * @param  note      The buffer's pitch.
   * @param  url  Either the url of the buffer, or a buffer which will be added with the given name.
   * @param  callback  The callback to invoke when the url is loaded.
   */
  add(t, e, s) {
    if (nt(ki(t) || isFinite(t), `note must be a pitch or midi: ${t}`), ki(t)) {
      const i = new Oe(this.context, t).toMidi();
      this._buffers.add(i, e, s);
    } else
      this._buffers.add(t, e, s);
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
      t.forEach((e) => e.dispose());
    }), this._activeSources.clear(), this;
  }
}
pn([
  qn(0)
], cr.prototype, "attack", void 0);
pn([
  qn(0)
], cr.prototype, "release", void 0);
class yn extends pe {
  constructor() {
    const t = P(yn.getDefaults(), arguments, ["callback", "value"]);
    super(t), this.name = "ToneEvent", this._state = new ci("stopped"), this._startOffset = 0, this._loop = t.loop, this.callback = t.callback, this.value = t.value, this._loopStart = this.toTicks(t.loopStart), this._loopEnd = this.toTicks(t.loopEnd), this._playbackRate = t.playbackRate, this._probability = t.probability, this._humanize = t.humanize, this.mute = t.mute, this._playbackRate = t.playbackRate, this._state.increasing = !0, this._rescheduleEvents();
  }
  static getDefaults() {
    return Object.assign(pe.getDefaults(), {
      callback: Ct,
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
    this._state.forEachFrom(t, (e) => {
      let s;
      if (e.state === "started") {
        e.id !== -1 && this.context.transport.clear(e.id);
        const i = e.time + Math.round(this.startOffset / this._playbackRate);
        if (this._loop === !0 || Ge(this._loop) && this._loop > 1) {
          s = 1 / 0, Ge(this._loop) && (s = this._loop * this._getLoopDuration());
          const r = this._state.getAfter(i);
          r !== null && (s = Math.min(s, r.time - i)), s !== 1 / 0 && (s = new Zt(this.context, s));
          const o = new Zt(this.context, this._getLoopDuration());
          e.id = this.context.transport.scheduleRepeat(this._tick.bind(this), o, new Zt(this.context, i), s);
        } else
          e.id = this.context.transport.schedule(this._tick.bind(this), new Zt(this.context, i));
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
    const e = this.toTicks(t);
    return this._state.getValueAtTime(e) === "stopped" && (this._state.add({
      id: -1,
      state: "started",
      time: e
    }), this._rescheduleEvents(e)), this;
  }
  /**
   * Stop the Event at the given time.
   * @param  time  When the event should stop.
   */
  stop(t) {
    this.cancel(t);
    const e = this.toTicks(t);
    if (this._state.getValueAtTime(e) === "started") {
      this._state.setStateAtTime("stopped", e, { id: -1 });
      const s = this._state.getBefore(e);
      let i = e;
      s !== null && (i = s.time), this._rescheduleEvents(i);
    }
    return this;
  }
  /**
   * Cancel all scheduled events greater than or equal to the given time
   * @param  time  The time after which events will be cancel.
   */
  cancel(t) {
    t = en(t, -1 / 0);
    const e = this.toTicks(t);
    return this._state.forEachFrom(e, (s) => {
      this.context.transport.clear(s.id);
    }), this._state.cancel(e), this;
  }
  /**
   * The callback function invoker. Also
   * checks if the Event is done playing
   * @param  time  The time of the event in seconds
   */
  _tick(t) {
    const e = this.context.transport.getTicksAtTime(t);
    if (!this.mute && this._state.getValueAtTime(e) === "started") {
      if (this.probability < 1 && Math.random() > this.probability)
        return;
      if (this.humanize) {
        let s = 0.02;
        ic(this.humanize) || (s = this.toSeconds(this.humanize)), t += (Math.random() * 2 - 1) * s;
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
    return new Zt(this.context, this._loopEnd).toSeconds();
  }
  set loopEnd(t) {
    this._loopEnd = this.toTicks(t), this._loop && this._rescheduleEvents();
  }
  /**
   * The time when the loop should start.
   */
  get loopStart() {
    return new Zt(this.context, this._loopStart).toSeconds();
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
      const t = this.context.transport.ticks, e = this._state.get(t);
      if (e !== null && e.state === "started") {
        const s = this._getLoopDuration();
        return (t - e.time) % s / s;
      } else
        return 0;
    } else
      return 0;
  }
  dispose() {
    return super.dispose(), this.cancel(), this._state.dispose(), this;
  }
}
class ji extends pe {
  constructor() {
    const t = P(ji.getDefaults(), arguments, [
      "callback",
      "interval"
    ]);
    super(t), this.name = "Loop", this._event = new yn({
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
    return Object.assign(pe.getDefaults(), {
      interval: "4n",
      callback: Ct,
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
class Li extends yn {
  constructor() {
    const t = P(Li.getDefaults(), arguments, [
      "callback",
      "events"
    ]);
    super(t), this.name = "Part", this._state = new ci("stopped"), this._events = /* @__PURE__ */ new Set(), this._state.increasing = !0, t.events.forEach((e) => {
      ve(e) ? this.add(e[0], e[1]) : this.add(e);
    });
  }
  static getDefaults() {
    return Object.assign(yn.getDefaults(), {
      events: []
    });
  }
  /**
   * Start the part at the given time.
   * @param  time    When to start the part.
   * @param  offset  The offset from the start of the part to begin playing at.
   */
  start(t, e) {
    const s = this.toTicks(t);
    if (this._state.getValueAtTime(s) !== "started") {
      e = en(e, this._loop ? this._loopStart : 0), this._loop ? e = en(e, this._loopStart) : e = en(e, 0);
      const i = this.toTicks(e);
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
  _startNote(t, e, s) {
    e -= s, this._loop ? t.startOffset >= this._loopStart && t.startOffset < this._loopEnd ? (t.startOffset < s && (e += this._getLoopDuration()), t.start(new Zt(this.context, e))) : t.startOffset < this._loopStart && t.startOffset >= s && (t.loop = !1, t.start(new Zt(this.context, e))) : t.startOffset >= s && t.start(new Zt(this.context, e));
  }
  get startOffset() {
    return this._startOffset;
  }
  set startOffset(t) {
    this._startOffset = t, this._forEach((e) => {
      e.startOffset += this._startOffset;
    });
  }
  /**
   * Stop the part at the given time.
   * @param  time  When to stop the part.
   */
  stop(t) {
    const e = this.toTicks(t);
    return this._state.cancel(e), this._state.setStateAtTime("stopped", e), this._forEach((s) => {
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
  at(t, e) {
    const s = new re(this.context, t).toTicks(), i = new Zt(this.context, 1).toSeconds(), r = this._events.values();
    let o = r.next();
    for (; !o.done; ) {
      const a = o.value;
      if (Math.abs(s - a.startOffset) < i)
        return vt(e) && (a.value = e), a;
      o = r.next();
    }
    return vt(e) ? (this.add(t, e), this.at(t)) : null;
  }
  add(t, e) {
    t instanceof Object && Reflect.has(t, "time") && (e = t, t = e.time);
    const s = this.toTicks(t);
    let i;
    return e instanceof yn ? (i = e, i.callback = this._tick.bind(this)) : i = new yn({
      callback: this._tick.bind(this),
      context: this.context,
      value: e
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
    this._state.forEach((e) => {
      e.state === "started" ? this._startNote(t, e.time, e.offset) : t.stop(new Zt(this.context, e.time));
    });
  }
  remove(t, e) {
    return Nn(t) && t.hasOwnProperty("time") && (e = t, t = e.time), t = this.toTicks(t), this._events.forEach((s) => {
      s.startOffset === t && (We(e) || vt(e) && s.value === e) && (this._events.delete(s), s.dispose());
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
    return this._forEach((e) => e.cancel(t)), this._state.cancel(this.toTicks(t)), this;
  }
  /**
   * Iterate over all of the events
   */
  _forEach(t) {
    return this._events && this._events.forEach((e) => {
      e instanceof Li ? e._forEach(t) : t(e);
    }), this;
  }
  /**
   * Set the attribute of all of the events
   * @param  attr  the attribute to set
   * @param  value      The value to set it to
   */
  _setAll(t, e) {
    this._forEach((s) => {
      s[t] = e;
    });
  }
  /**
   * Internal tick method
   * @param  time  The time of the event in seconds
   */
  _tick(t, e) {
    this.mute || this.callback(t, e);
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
    this._loop = t, this._forEach((e) => {
      e.loopStart = this.loopStart, e.loopEnd = this.loopEnd, e.loop = t, this._testLoopBoundries(e);
    });
  }
  /**
   * The loopEnd point determines when it will
   * loop if Part.loop is true.
   */
  get loopEnd() {
    return new Zt(this.context, this._loopEnd).toSeconds();
  }
  set loopEnd(t) {
    this._loopEnd = this.toTicks(t), this._loop && this._forEach((e) => {
      e.loopEnd = t, this._testLoopBoundries(e);
    });
  }
  /**
   * The loopStart point determines when it will
   * loop if Part.loop is true.
   */
  get loopStart() {
    return new Zt(this.context, this._loopStart).toSeconds();
  }
  set loopStart(t) {
    this._loopStart = this.toTicks(t), this._loop && this._forEach((e) => {
      e.loopStart = this.loopStart, this._testLoopBoundries(e);
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
function* y0(n) {
  let t = 0;
  for (; t < n; )
    t = Ts(t, 0, n - 1), yield t, t++;
}
function* v0(n) {
  let t = n - 1;
  for (; t >= 0; )
    t = Ts(t, 0, n - 1), yield t, t--;
}
function* Si(n, t) {
  for (; ; )
    yield* t(n);
}
function* Jl(n, t) {
  let e = t ? 0 : n - 1;
  for (; ; )
    e = Ts(e, 0, n - 1), yield e, t ? (e++, e >= n - 1 && (t = !1)) : (e--, e <= 0 && (t = !0));
}
function* b0(n) {
  let t = 0, e = 0;
  for (; t < n; )
    t = Ts(t, 0, n - 1), yield t, e++, t += e % 2 ? 2 : -1;
}
function* x0(n) {
  let t = n - 1, e = 0;
  for (; t >= 0; )
    t = Ts(t, 0, n - 1), yield t, e++, t += e % 2 ? -2 : 1;
}
function* w0(n) {
  for (; ; )
    yield Math.floor(Math.random() * n);
}
function* C0(n) {
  const t = [];
  for (let e = 0; e < n; e++)
    t.push(e);
  for (; t.length > 0; ) {
    const e = t.splice(Math.floor(t.length * Math.random()), 1);
    yield Ts(e[0], 0, n - 1);
  }
}
function* S0(n) {
  let t = Math.floor(Math.random() * n);
  for (; ; )
    t === 0 ? t++ : t === n - 1 || Math.random() < 0.5 ? t-- : t++, yield t;
}
function* tu(n, t = "up", e = 0) {
  switch (nt(n >= 1, "The number of values must be at least one"), t) {
    case "up":
      yield* Si(n, y0);
    case "down":
      yield* Si(n, v0);
    case "upDown":
      yield* Jl(n, !0);
    case "downUp":
      yield* Jl(n, !1);
    case "alternateUp":
      yield* Si(n, b0);
    case "alternateDown":
      yield* Si(n, x0);
    case "random":
      yield* w0(n);
    case "randomOnce":
      yield* Si(n, C0);
    case "randomWalk":
      yield* S0(n);
  }
}
class Dc extends ji {
  constructor() {
    const t = P(Dc.getDefaults(), arguments, [
      "callback",
      "values",
      "pattern"
    ]);
    super(t), this.name = "Pattern", this.callback = t.callback, this._values = t.values, this._pattern = tu(t.values.length, t.pattern), this._type = t.pattern;
  }
  static getDefaults() {
    return Object.assign(ji.getDefaults(), {
      pattern: "up",
      values: [],
      callback: Ct
    });
  }
  /**
   * Internal function called when the notes should be called
   */
  _tick(t) {
    const e = this._pattern.next();
    this._index = e.value, this._value = this._values[e.value], this.callback(t, this._value);
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
    this._type = t, this._pattern = tu(this._values.length, this._type);
  }
}
class Oc extends yn {
  constructor() {
    const t = P(Oc.getDefaults(), arguments, ["callback", "events", "subdivision"]);
    super(t), this.name = "Sequence", this._part = new Li({
      callback: this._seqCallback.bind(this),
      context: this.context
    }), this._events = [], this._eventsArray = [], this._subdivision = this.toTicks(t.subdivision), this.events = t.events, this.loop = t.loop, this.loopStart = t.loopStart, this.loopEnd = t.loopEnd, this.playbackRate = t.playbackRate, this.probability = t.probability, this.humanize = t.humanize, this.mute = t.mute, this.playbackRate = t.playbackRate;
  }
  static getDefaults() {
    return Object.assign(_e(yn.getDefaults(), ["value"]), {
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
  _seqCallback(t, e) {
    e !== null && !this.mute && this.callback(t, e);
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
  start(t, e) {
    return this._part.start(t, e && this._indexTime(e)), this;
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
    return new Zt(this.context, this._subdivision).toSeconds();
  }
  /**
   * Create a sequence proxy which can be monitored to create subsequences
   */
  _createSequence(t) {
    return new Proxy(t, {
      get: (e, s) => e[s],
      set: (e, s, i) => (dn(s) && isFinite(parseInt(s, 10)) && ve(i) ? e[s] = this._createSequence(i) : e[s] = i, this._eventsUpdated(), !0)
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
  _rescheduleSequence(t, e, s) {
    t.forEach((i, r) => {
      const o = r * e + s;
      if (ve(i))
        this._rescheduleSequence(i, e / i.length, o);
      else {
        const a = new Zt(this.context, o, "i").toSeconds();
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
    return new Zt(this.context, t * this._subdivision + this.startOffset).toSeconds();
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
class mi extends W {
  constructor() {
    const t = P(mi.getDefaults(), arguments, ["fade"]);
    super(t), this.name = "CrossFade", this._panner = this.context.createStereoPanner(), this._split = this.context.createChannelSplitter(2), this._g2a = new kd({ context: this.context }), this.a = new J({
      context: this.context,
      gain: 0
    }), this.b = new J({
      context: this.context,
      gain: 0
    }), this.output = new J({ context: this.context }), this._internalChannels = [this.a, this.b], this.fade = new ht({
      context: this.context,
      units: "normalRange",
      value: t.fade
    }), at(this, "fade"), this.context.getConstant(1).connect(this._panner), this._panner.connect(this._split), this._panner.channelCount = 1, this._panner.channelCountMode = "explicit", Me(this._split, this.a.gain, 0), Me(this._split, this.b.gain, 1), this.fade.chain(this._g2a, this._panner.pan), this.a.connect(this.output), this.b.connect(this.output);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      fade: 0.5
    });
  }
  dispose() {
    return super.dispose(), this.a.dispose(), this.b.dispose(), this.output.dispose(), this.fade.dispose(), this._g2a.dispose(), this._panner.disconnect(), this._split.disconnect(), this;
  }
}
class le extends W {
  constructor(t) {
    super(t), this.name = "Effect", this._dryWet = new mi({ context: this.context }), this.wet = this._dryWet.fade, this.effectSend = new J({ context: this.context }), this.effectReturn = new J({ context: this.context }), this.input = new J({ context: this.context }), this.output = this._dryWet, this.input.fan(this._dryWet.a, this.effectSend), this.effectReturn.connect(this._dryWet.b), this.wet.setValueAtTime(t.wet, 0), this._internalChannels = [this.effectReturn, this.effectSend], at(this, "wet");
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
class Gr extends le {
  constructor(t) {
    super(t), this.name = "LFOEffect", this._lfo = new Re({
      context: this.context,
      frequency: t.frequency,
      amplitude: t.depth
    }), this.depth = this._lfo.amplitude, this.frequency = this._lfo.frequency, this.type = t.type, at(this, ["frequency", "depth"]);
  }
  static getDefaults() {
    return Object.assign(le.getDefaults(), {
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
class Rc extends Gr {
  constructor() {
    const t = P(Rc.getDefaults(), arguments, ["frequency", "baseFrequency", "octaves"]);
    super(t), this.name = "AutoFilter", this.filter = new Be(Object.assign(t.filter, {
      context: this.context
    })), this.connectEffect(this.filter), this._lfo.connect(this.filter.frequency), this.octaves = t.octaves, this.baseFrequency = t.baseFrequency;
  }
  static getDefaults() {
    return Object.assign(Gr.getDefaults(), {
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
class gi extends W {
  constructor() {
    const t = P(gi.getDefaults(), arguments, [
      "pan"
    ]);
    super(t), this.name = "Panner", this._panner = this.context.createStereoPanner(), this.input = this._panner, this.output = this._panner, this.pan = new mt({
      context: this.context,
      param: this._panner.pan,
      value: t.pan,
      minValue: -1,
      maxValue: 1
    }), this._panner.channelCount = t.channelCount, this._panner.channelCountMode = "explicit", at(this, "pan");
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      pan: 0,
      channelCount: 1
    });
  }
  dispose() {
    return super.dispose(), this._panner.disconnect(), this.pan.dispose(), this;
  }
}
class Mc extends Gr {
  constructor() {
    const t = P(Mc.getDefaults(), arguments, ["frequency"]);
    super(t), this.name = "AutoPanner", this._panner = new gi({
      context: this.context,
      channelCount: t.channelCount
    }), this.connectEffect(this._panner), this._lfo.connect(this._panner.pan), this._lfo.min = -1, this._lfo.max = 1;
  }
  static getDefaults() {
    return Object.assign(Gr.getDefaults(), {
      channelCount: 1
    });
  }
  dispose() {
    return super.dispose(), this._panner.dispose(), this;
  }
}
class lr extends W {
  constructor() {
    const t = P(lr.getDefaults(), arguments, ["smoothing"]);
    super(t), this.name = "Follower", this._abs = this.input = new Ad({ context: this.context }), this._lowpass = this.output = new or({
      context: this.context,
      frequency: 1 / this.toSeconds(t.smoothing),
      type: "lowpass"
    }), this._abs.connect(this._lowpass), this._smoothing = t.smoothing;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
class _o extends le {
  constructor() {
    const t = P(_o.getDefaults(), arguments, [
      "baseFrequency",
      "octaves",
      "sensitivity"
    ]);
    super(t), this.name = "AutoWah", this._follower = new lr({
      context: this.context,
      smoothing: t.follower
    }), this._sweepRange = new go({
      context: this.context,
      min: 0,
      max: 1,
      exponent: 0.5
    }), this._baseFrequency = this.toFrequency(t.baseFrequency), this._octaves = t.octaves, this._inputBoost = new J({ context: this.context }), this._bandpass = new Be({
      context: this.context,
      rolloff: -48,
      frequency: 0,
      Q: t.Q
    }), this._peaking = new Be({
      context: this.context,
      type: "peaking"
    }), this._peaking.gain.value = t.gain, this.gain = this._peaking.gain, this.Q = this._bandpass.Q, this.effectSend.chain(this._inputBoost, this._follower, this._sweepRange), this._sweepRange.connect(this._bandpass.frequency), this._sweepRange.connect(this._peaking.frequency), this.effectSend.chain(this._bandpass, this._peaking, this.effectReturn), this._setSweepRange(), this.sensitivity = t.sensitivity, at(this, ["gain", "Q"]);
  }
  static getDefaults() {
    return Object.assign(le.getDefaults(), {
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
    return Qi(1 / this._inputBoost.gain.value);
  }
  set sensitivity(t) {
    this._inputBoost.gain.value = 1 / Ys(t);
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
const Dd = "bit-crusher", T0 = (
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
Id(Dd, T0);
class Nc extends le {
  constructor() {
    const t = P(Nc.getDefaults(), arguments, ["bits"]);
    super(t), this.name = "BitCrusher", this._bitCrusherWorklet = new Pc({
      context: this.context,
      bits: t.bits
    }), this.connectEffect(this._bitCrusherWorklet), this.bits = this._bitCrusherWorklet.bits;
  }
  static getDefaults() {
    return Object.assign(le.getDefaults(), {
      bits: 4
    });
  }
  dispose() {
    return super.dispose(), this._bitCrusherWorklet.dispose(), this;
  }
}
class Pc extends ca {
  constructor() {
    const t = P(Pc.getDefaults(), arguments);
    super(t), this.name = "BitCrusherWorklet", this.input = new J({ context: this.context }), this.output = new J({ context: this.context }), this.bits = new mt({
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
    return Object.assign(ca.getDefaults(), {
      bits: 12
    });
  }
  _audioWorkletName() {
    return Dd;
  }
  onReady(t) {
    Ze(this.input, t, this.output);
    const e = t.parameters.get("bits");
    this.bits.setParam(e);
  }
  dispose() {
    return super.dispose(), this.input.dispose(), this.output.dispose(), this.bits.dispose(), this;
  }
}
class Fc extends le {
  constructor() {
    const t = P(Fc.getDefaults(), arguments, ["order"]);
    super(t), this.name = "Chebyshev", this._shaper = new gn({
      context: this.context,
      length: 4096
    }), this._order = t.order, this.connectEffect(this._shaper), this.order = t.order, this.oversample = t.oversample;
  }
  static getDefaults() {
    return Object.assign(le.getDefaults(), {
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
  _getCoefficient(t, e, s) {
    return s.has(e) || (e === 0 ? s.set(e, 0) : e === 1 ? s.set(e, t) : s.set(e, 2 * t * this._getCoefficient(t, e - 1, s) - this._getCoefficient(t, e - 2, s))), s.get(e);
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
    nt(Number.isInteger(t), "'order' must be an integer"), this._order = t, this._shaper.setMap((e) => this._getCoefficient(e, t, /* @__PURE__ */ new Map()));
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
class Ds extends W {
  constructor() {
    const t = P(Ds.getDefaults(), arguments, [
      "channels"
    ]);
    super(t), this.name = "Split", this._splitter = this.input = this.output = this.context.createChannelSplitter(t.channels), this._internalChannels = [this._splitter];
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      channels: 2
    });
  }
  dispose() {
    return super.dispose(), this._splitter.disconnect(), this;
  }
}
class cs extends W {
  constructor() {
    const t = P(cs.getDefaults(), arguments, [
      "channels"
    ]);
    super(t), this.name = "Merge", this._merger = this.output = this.input = this.context.createChannelMerger(t.channels);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      channels: 2
    });
  }
  dispose() {
    return super.dispose(), this._merger.disconnect(), this;
  }
}
class xn extends W {
  constructor(t) {
    super(t), this.name = "StereoEffect", this.input = new J({ context: this.context }), this.input.channelCount = 2, this.input.channelCountMode = "explicit", this._dryWet = this.output = new mi({
      context: this.context,
      fade: t.wet
    }), this.wet = this._dryWet.fade, this._split = new Ds({ context: this.context, channels: 2 }), this._merge = new cs({ context: this.context, channels: 2 }), this.input.connect(this._split), this.input.connect(this._dryWet.a), this._merge.connect(this._dryWet.b), at(this, ["wet"]);
  }
  /**
   * Connect the left part of the effect
   */
  connectEffectLeft(...t) {
    this._split.connect(t[0], 0, 0), Ze(...t), Me(t[t.length - 1], this._merge, 0, 0);
  }
  /**
   * Connect the right part of the effect
   */
  connectEffectRight(...t) {
    this._split.connect(t[0], 1, 0), Ze(...t), Me(t[t.length - 1], this._merge, 0, 1);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      wet: 1
    });
  }
  dispose() {
    return super.dispose(), this._dryWet.dispose(), this._split.dispose(), this._merge.dispose(), this;
  }
}
class la extends xn {
  constructor(t) {
    super(t), this.feedback = new ht({
      context: this.context,
      value: t.feedback,
      units: "normalRange"
    }), this._feedbackL = new J({ context: this.context }), this._feedbackR = new J({ context: this.context }), this._feedbackSplit = new Ds({ context: this.context, channels: 2 }), this._feedbackMerge = new cs({ context: this.context, channels: 2 }), this._merge.connect(this._feedbackSplit), this._feedbackMerge.connect(this._split), this._feedbackSplit.connect(this._feedbackL, 0, 0), this._feedbackL.connect(this._feedbackMerge, 0, 0), this._feedbackSplit.connect(this._feedbackR, 1, 0), this._feedbackR.connect(this._feedbackMerge, 0, 1), this.feedback.fan(this._feedbackL.gain, this._feedbackR.gain), at(this, ["feedback"]);
  }
  static getDefaults() {
    return Object.assign(xn.getDefaults(), {
      feedback: 0.5
    });
  }
  dispose() {
    return super.dispose(), this.feedback.dispose(), this._feedbackL.dispose(), this._feedbackR.dispose(), this._feedbackSplit.dispose(), this._feedbackMerge.dispose(), this;
  }
}
class Vc extends la {
  constructor() {
    const t = P(Vc.getDefaults(), arguments, [
      "frequency",
      "delayTime",
      "depth"
    ]);
    super(t), this.name = "Chorus", this._depth = t.depth, this._delayTime = t.delayTime / 1e3, this._lfoL = new Re({
      context: this.context,
      frequency: t.frequency,
      min: 0,
      max: 1
    }), this._lfoR = new Re({
      context: this.context,
      frequency: t.frequency,
      min: 0,
      max: 1,
      phase: 180
    }), this._delayNodeL = new ze({ context: this.context }), this._delayNodeR = new ze({ context: this.context }), this.frequency = this._lfoL.frequency, at(this, ["frequency"]), this._lfoL.frequency.connect(this._lfoR.frequency), this.connectEffectLeft(this._delayNodeL), this.connectEffectRight(this._delayNodeR), this._lfoL.connect(this._delayNodeL.delayTime), this._lfoR.connect(this._delayNodeR.delayTime), this.depth = this._depth, this.type = t.type, this.spread = t.spread;
  }
  static getDefaults() {
    return Object.assign(la.getDefaults(), {
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
    const e = this._delayTime * t;
    this._lfoL.min = Math.max(this._delayTime - e, 0), this._lfoL.max = this._delayTime + e, this._lfoR.min = Math.max(this._delayTime - e, 0), this._lfoR.max = this._delayTime + e;
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
class Wc extends le {
  constructor() {
    const t = P(Wc.getDefaults(), arguments, ["distortion"]);
    super(t), this.name = "Distortion", this._shaper = new gn({
      context: this.context,
      length: 4096
    }), this._distortion = t.distortion, this.connectEffect(this._shaper), this.distortion = t.distortion, this.oversample = t.oversample;
  }
  static getDefaults() {
    return Object.assign(le.getDefaults(), {
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
    const e = t * 100, s = Math.PI / 180;
    this._shaper.setMap((i) => Math.abs(i) < 1e-3 ? 0 : (3 + e) * i * 20 * s / (Math.PI + e * Math.abs(i)));
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
class Zr extends le {
  constructor(t) {
    super(t), this.name = "FeedbackEffect", this._feedbackGain = new J({
      context: this.context,
      gain: t.feedback,
      units: "normalRange"
    }), this.feedback = this._feedbackGain.gain, at(this, "feedback"), this.effectReturn.chain(this._feedbackGain, this.effectSend);
  }
  static getDefaults() {
    return Object.assign(le.getDefaults(), {
      feedback: 0.125
    });
  }
  dispose() {
    return super.dispose(), this._feedbackGain.dispose(), this.feedback.dispose(), this;
  }
}
class jc extends Zr {
  constructor() {
    const t = P(jc.getDefaults(), arguments, ["delayTime", "feedback"]);
    super(t), this.name = "FeedbackDelay", this._delayNode = new ze({
      context: this.context,
      delayTime: t.delayTime,
      maxDelay: t.maxDelay
    }), this.delayTime = this._delayNode.delayTime, this.connectEffect(this._delayNode), at(this, "delayTime");
  }
  static getDefaults() {
    return Object.assign(Zr.getDefaults(), {
      delayTime: 0.25,
      maxDelay: 1
    });
  }
  dispose() {
    return super.dispose(), this._delayNode.dispose(), this.delayTime.dispose(), this;
  }
}
class A0 extends W {
  constructor(t) {
    super(t), this.name = "PhaseShiftAllpass", this.input = new J({ context: this.context }), this.output = new J({ context: this.context }), this.offset90 = new J({ context: this.context });
    const e = [
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
    this._bank0 = this._createAllPassFilterBank(e), this._bank1 = this._createAllPassFilterBank(s), this._oneSampleDelay = this.context.createIIRFilter([0, 1], [1, 0]), Ze(this.input, ...this._bank0, this._oneSampleDelay, this.output), Ze(this.input, ...this._bank1, this.offset90);
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
class Lc extends le {
  constructor() {
    const t = P(Lc.getDefaults(), arguments, ["frequency"]);
    super(t), this.name = "FrequencyShifter", this.frequency = new ht({
      context: this.context,
      units: "frequency",
      value: t.frequency,
      minValue: -this.context.sampleRate / 2,
      maxValue: this.context.sampleRate / 2
    }), this._sine = new tr({
      context: this.context,
      type: "sine"
    }), this._cosine = new Yt({
      context: this.context,
      phase: -90,
      type: "sine"
    }), this._sineMultiply = new Xt({ context: this.context }), this._cosineMultiply = new Xt({ context: this.context }), this._negate = new bc({ context: this.context }), this._add = new ks({ context: this.context }), this._phaseShifter = new A0({ context: this.context }), this.effectSend.connect(this._phaseShifter), this.frequency.fan(this._sine.frequency, this._cosine.frequency), this._phaseShifter.offset90.connect(this._cosineMultiply), this._cosine.connect(this._cosineMultiply.factor), this._phaseShifter.connect(this._sineMultiply), this._sine.connect(this._sineMultiply.factor), this._sineMultiply.connect(this._negate), this._cosineMultiply.connect(this._add), this._negate.connect(this._add.addend), this._add.connect(this.effectReturn);
    const e = this.immediate();
    this._sine.start(e), this._cosine.start(e);
  }
  static getDefaults() {
    return Object.assign(le.getDefaults(), {
      frequency: 0
    });
  }
  dispose() {
    return super.dispose(), this.frequency.dispose(), this._add.dispose(), this._cosine.dispose(), this._cosineMultiply.dispose(), this._negate.dispose(), this._phaseShifter.dispose(), this._sine.dispose(), this._sineMultiply.dispose(), this;
  }
}
const eu = [
  1557 / 44100,
  1617 / 44100,
  1491 / 44100,
  1422 / 44100,
  1277 / 44100,
  1356 / 44100,
  1188 / 44100,
  1116 / 44100
], nu = [225, 556, 441, 341];
class qc extends xn {
  constructor() {
    const t = P(qc.getDefaults(), arguments, ["roomSize", "dampening"]);
    super(t), this.name = "Freeverb", this._combFilters = [], this._allpassFiltersL = [], this._allpassFiltersR = [], this.roomSize = new ht({
      context: this.context,
      value: t.roomSize,
      units: "normalRange"
    }), this._allpassFiltersL = nu.map((e) => {
      const s = this.context.createBiquadFilter();
      return s.type = "allpass", s.frequency.value = e, s;
    }), this._allpassFiltersR = nu.map((e) => {
      const s = this.context.createBiquadFilter();
      return s.type = "allpass", s.frequency.value = e, s;
    }), this._combFilters = eu.map((e, s) => {
      const i = new ar({
        context: this.context,
        dampening: t.dampening,
        delayTime: e
      });
      return s < eu.length / 2 ? this.connectEffectLeft(i, ...this._allpassFiltersL) : this.connectEffectRight(i, ...this._allpassFiltersR), this.roomSize.connect(i.resonance), i;
    }), at(this, ["roomSize"]);
  }
  static getDefaults() {
    return Object.assign(xn.getDefaults(), {
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
    this._combFilters.forEach((e) => e.dampening = t);
  }
  dispose() {
    return super.dispose(), this._allpassFiltersL.forEach((t) => t.disconnect()), this._allpassFiltersR.forEach((t) => t.disconnect()), this._combFilters.forEach((t) => t.dispose()), this.roomSize.dispose(), this;
  }
}
const su = [
  1687 / 25e3,
  1601 / 25e3,
  2053 / 25e3,
  2251 / 25e3
], k0 = [0.773, 0.802, 0.753, 0.733], I0 = [347, 113, 37];
class Bc extends xn {
  constructor() {
    const t = P(Bc.getDefaults(), arguments, ["roomSize"]);
    super(t), this.name = "JCReverb", this._allpassFilters = [], this._feedbackCombFilters = [], this.roomSize = new ht({
      context: this.context,
      value: t.roomSize,
      units: "normalRange"
    }), this._scaleRoomSize = new Vn({
      context: this.context,
      min: -0.733,
      max: 0.197
    }), this._allpassFilters = I0.map((e) => {
      const s = this.context.createBiquadFilter();
      return s.type = "allpass", s.frequency.value = e, s;
    }), this._feedbackCombFilters = su.map((e, s) => {
      const i = new rr({
        context: this.context,
        delayTime: e
      });
      return this._scaleRoomSize.connect(i.resonance), i.resonance.value = k0[s], s < su.length / 2 ? this.connectEffectLeft(...this._allpassFilters, i) : this.connectEffectRight(...this._allpassFilters, i), i;
    }), this.roomSize.connect(this._scaleRoomSize), at(this, ["roomSize"]);
  }
  static getDefaults() {
    return Object.assign(xn.getDefaults(), {
      roomSize: 0.5
    });
  }
  dispose() {
    return super.dispose(), this._allpassFilters.forEach((t) => t.disconnect()), this._feedbackCombFilters.forEach((t) => t.dispose()), this.roomSize.dispose(), this._scaleRoomSize.dispose(), this;
  }
}
class iu extends la {
  constructor(t) {
    super(t), this._feedbackL.disconnect(), this._feedbackL.connect(this._feedbackMerge, 0, 1), this._feedbackR.disconnect(), this._feedbackR.connect(this._feedbackMerge, 0, 0), at(this, ["feedback"]);
  }
}
class $c extends iu {
  constructor() {
    const t = P($c.getDefaults(), arguments, ["delayTime", "feedback"]);
    super(t), this.name = "PingPongDelay", this._leftDelay = new ze({
      context: this.context,
      maxDelay: t.maxDelay
    }), this._rightDelay = new ze({
      context: this.context,
      maxDelay: t.maxDelay
    }), this._rightPreDelay = new ze({
      context: this.context,
      maxDelay: t.maxDelay
    }), this.delayTime = new ht({
      context: this.context,
      units: "time",
      value: t.delayTime
    }), this.connectEffectLeft(this._leftDelay), this.connectEffectRight(this._rightPreDelay, this._rightDelay), this.delayTime.fan(this._leftDelay.delayTime, this._rightDelay.delayTime, this._rightPreDelay.delayTime), this._feedbackL.disconnect(), this._feedbackL.connect(this._rightDelay), at(this, ["delayTime"]);
  }
  static getDefaults() {
    return Object.assign(iu.getDefaults(), {
      delayTime: 0.25,
      maxDelay: 1
    });
  }
  dispose() {
    return super.dispose(), this._leftDelay.dispose(), this._rightDelay.dispose(), this._rightPreDelay.dispose(), this.delayTime.dispose(), this;
  }
}
class zc extends Zr {
  constructor() {
    const t = P(zc.getDefaults(), arguments, ["pitch"]);
    super(t), this.name = "PitchShift", this._frequency = new ht({ context: this.context }), this._delayA = new ze({
      maxDelay: 1,
      context: this.context
    }), this._lfoA = new Re({
      context: this.context,
      min: 0,
      max: 0.1,
      type: "sawtooth"
    }).connect(this._delayA.delayTime), this._delayB = new ze({
      maxDelay: 1,
      context: this.context
    }), this._lfoB = new Re({
      context: this.context,
      min: 0,
      max: 0.1,
      type: "sawtooth",
      phase: 180
    }).connect(this._delayB.delayTime), this._crossFade = new mi({ context: this.context }), this._crossFadeLFO = new Re({
      context: this.context,
      min: 0,
      max: 1,
      type: "triangle",
      phase: 90
    }).connect(this._crossFade.fade), this._feedbackDelay = new ze({
      delayTime: t.delayTime,
      context: this.context
    }), this.delayTime = this._feedbackDelay.delayTime, at(this, "delayTime"), this._pitch = t.pitch, this._windowSize = t.windowSize, this._delayA.connect(this._crossFade.a), this._delayB.connect(this._crossFade.b), this._frequency.fan(this._lfoA.frequency, this._lfoB.frequency, this._crossFadeLFO.frequency), this.effectSend.fan(this._delayA, this._delayB), this._crossFade.chain(this._feedbackDelay, this.effectReturn);
    const e = this.now();
    this._lfoA.start(e), this._lfoB.start(e), this._crossFadeLFO.start(e), this.windowSize = this._windowSize;
  }
  static getDefaults() {
    return Object.assign(Zr.getDefaults(), {
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
    let e = 0;
    t < 0 ? (this._lfoA.min = 0, this._lfoA.max = this._windowSize, this._lfoB.min = 0, this._lfoB.max = this._windowSize, e = Xs(t - 1) + 1) : (this._lfoA.min = this._windowSize, this._lfoA.max = 0, this._lfoB.min = this._windowSize, this._lfoB.max = 0, e = Xs(t) - 1), this._frequency.value = e * (1.2 / this._windowSize);
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
class Gc extends xn {
  constructor() {
    const t = P(Gc.getDefaults(), arguments, [
      "frequency",
      "octaves",
      "baseFrequency"
    ]);
    super(t), this.name = "Phaser", this._lfoL = new Re({
      context: this.context,
      frequency: t.frequency,
      min: 0,
      max: 1
    }), this._lfoR = new Re({
      context: this.context,
      frequency: t.frequency,
      min: 0,
      max: 1,
      phase: 180
    }), this._baseFrequency = this.toFrequency(t.baseFrequency), this._octaves = t.octaves, this.Q = new ht({
      context: this.context,
      value: t.Q,
      units: "positive"
    }), this._filtersL = this._makeFilters(t.stages, this._lfoL), this._filtersR = this._makeFilters(t.stages, this._lfoR), this.frequency = this._lfoL.frequency, this.frequency.value = t.frequency, this.connectEffectLeft(...this._filtersL), this.connectEffectRight(...this._filtersR), this._lfoL.frequency.connect(this._lfoR.frequency), this.baseFrequency = t.baseFrequency, this.octaves = t.octaves, this._lfoL.start(), this._lfoR.start(), at(this, ["frequency", "Q"]);
  }
  static getDefaults() {
    return Object.assign(xn.getDefaults(), {
      frequency: 0.5,
      octaves: 3,
      stages: 10,
      Q: 10,
      baseFrequency: 350
    });
  }
  _makeFilters(t, e) {
    const s = [];
    for (let i = 0; i < t; i++) {
      const r = this.context.createBiquadFilter();
      r.type = "allpass", this.Q.connect(r.Q), e.connect(r.frequency), s.push(r);
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
    const e = this._baseFrequency * Math.pow(2, t);
    this._lfoL.max = e, this._lfoR.max = e;
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
class yo extends le {
  constructor() {
    const t = P(yo.getDefaults(), arguments, [
      "decay"
    ]);
    super(t), this.name = "Reverb", this._convolver = this.context.createConvolver(), this.ready = Promise.resolve();
    const e = this.toSeconds(t.decay);
    ae(e, 1e-3), this._decay = e;
    const s = this.toSeconds(t.preDelay);
    ae(s, 0), this._preDelay = s, this.generate(), this.connectEffect(this._convolver);
  }
  static getDefaults() {
    return Object.assign(le.getDefaults(), {
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
    t = this.toSeconds(t), ae(t, 1e-3), this._decay = t, this.generate();
  }
  /**
   * The amount of time before the reverb is fully ramped in.
   */
  get preDelay() {
    return this._preDelay;
  }
  set preDelay(t) {
    t = this.toSeconds(t), ae(t, 0), this._preDelay = t, this.generate();
  }
  /**
   * Generate the Impulse Response. Returns a promise while the IR is being generated.
   * @return Promise which returns this object.
   */
  generate() {
    return jt(this, void 0, void 0, function* () {
      const t = this.ready, e = new ai(2, this._decay + this._preDelay, this.context.sampleRate), s = new Jn({ context: e }), i = new Jn({ context: e }), r = new cs({ context: e });
      s.connect(r, 0, 0), i.connect(r, 0, 1);
      const o = new J({ context: e }).toDestination();
      r.connect(o), s.start(0), i.start(0), o.gain.setValueAtTime(0, 0), o.gain.setValueAtTime(1, this._preDelay), o.gain.exponentialApproachValueAtTime(0, this._preDelay, this.decay);
      const a = e.render();
      return this.ready = a.then(Ct), yield t, this._convolver.buffer = (yield a).get(), this;
    });
  }
  dispose() {
    return super.dispose(), this._convolver.disconnect(), this;
  }
}
class ur extends W {
  constructor() {
    super(P(ur.getDefaults(), arguments)), this.name = "MidSideSplit", this._split = this.input = new Ds({
      channels: 2,
      context: this.context
    }), this._midAdd = new ks({ context: this.context }), this.mid = new Xt({
      context: this.context,
      value: Math.SQRT1_2
    }), this._sideSubtract = new Es({ context: this.context }), this.side = new Xt({
      context: this.context,
      value: Math.SQRT1_2
    }), this._split.connect(this._midAdd, 0), this._split.connect(this._midAdd.addend, 1), this._split.connect(this._sideSubtract, 0), this._split.connect(this._sideSubtract.subtrahend, 1), this._midAdd.connect(this.mid), this._sideSubtract.connect(this.side);
  }
  dispose() {
    return super.dispose(), this.mid.dispose(), this.side.dispose(), this._midAdd.dispose(), this._sideSubtract.dispose(), this._split.dispose(), this;
  }
}
class hr extends W {
  constructor() {
    super(P(hr.getDefaults(), arguments)), this.name = "MidSideMerge", this.mid = new J({ context: this.context }), this.side = new J({ context: this.context }), this._left = new ks({ context: this.context }), this._leftMult = new Xt({
      context: this.context,
      value: Math.SQRT1_2
    }), this._right = new Es({ context: this.context }), this._rightMult = new Xt({
      context: this.context,
      value: Math.SQRT1_2
    }), this._merge = this.output = new cs({ context: this.context }), this.mid.fan(this._left), this.side.connect(this._left.addend), this.mid.connect(this._right), this.side.connect(this._right.subtrahend), this._left.connect(this._leftMult), this._right.connect(this._rightMult), this._leftMult.connect(this._merge, 0, 0), this._rightMult.connect(this._merge, 0, 1);
  }
  dispose() {
    return super.dispose(), this.mid.dispose(), this.side.dispose(), this._leftMult.dispose(), this._rightMult.dispose(), this._left.dispose(), this._right.dispose(), this;
  }
}
class ru extends le {
  constructor(t) {
    super(t), this.name = "MidSideEffect", this._midSideMerge = new hr({ context: this.context }), this._midSideSplit = new ur({ context: this.context }), this._midSend = this._midSideSplit.mid, this._sideSend = this._midSideSplit.side, this._midReturn = this._midSideMerge.mid, this._sideReturn = this._midSideMerge.side, this.effectSend.connect(this._midSideSplit), this._midSideMerge.connect(this.effectReturn);
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
class Zc extends ru {
  constructor() {
    const t = P(Zc.getDefaults(), arguments, ["width"]);
    super(t), this.name = "StereoWidener", this.width = new ht({
      context: this.context,
      value: t.width,
      units: "normalRange"
    }), at(this, ["width"]), this._twoTimesWidthMid = new Xt({
      context: this.context,
      value: 2
    }), this._twoTimesWidthSide = new Xt({
      context: this.context,
      value: 2
    }), this._midMult = new Xt({ context: this.context }), this._twoTimesWidthMid.connect(this._midMult.factor), this.connectEffectMid(this._midMult), this._oneMinusWidth = new Es({ context: this.context }), this._oneMinusWidth.connect(this._twoTimesWidthMid), Me(this.context.getConstant(1), this._oneMinusWidth), this.width.connect(this._oneMinusWidth.subtrahend), this._sideMult = new Xt({ context: this.context }), this.width.connect(this._twoTimesWidthSide), this._twoTimesWidthSide.connect(this._sideMult.factor), this.connectEffectSide(this._sideMult);
  }
  static getDefaults() {
    return Object.assign(ru.getDefaults(), {
      width: 0.5
    });
  }
  dispose() {
    return super.dispose(), this.width.dispose(), this._midMult.dispose(), this._sideMult.dispose(), this._twoTimesWidthMid.dispose(), this._twoTimesWidthSide.dispose(), this._oneMinusWidth.dispose(), this;
  }
}
class Yc extends xn {
  constructor() {
    const t = P(Yc.getDefaults(), arguments, [
      "frequency",
      "depth"
    ]);
    super(t), this.name = "Tremolo", this._lfoL = new Re({
      context: this.context,
      type: t.type,
      min: 1,
      max: 0
    }), this._lfoR = new Re({
      context: this.context,
      type: t.type,
      min: 1,
      max: 0
    }), this._amplitudeL = new J({ context: this.context }), this._amplitudeR = new J({ context: this.context }), this.frequency = new ht({
      context: this.context,
      value: t.frequency,
      units: "frequency"
    }), this.depth = new ht({
      context: this.context,
      value: t.depth,
      units: "normalRange"
    }), at(this, ["frequency", "depth"]), this.connectEffectLeft(this._amplitudeL), this.connectEffectRight(this._amplitudeR), this._lfoL.connect(this._amplitudeL.gain), this._lfoR.connect(this._amplitudeR.gain), this.frequency.fan(this._lfoL.frequency, this._lfoR.frequency), this.depth.fan(this._lfoR.amplitude, this._lfoL.amplitude), this.spread = t.spread;
  }
  static getDefaults() {
    return Object.assign(xn.getDefaults(), {
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
class Xc extends le {
  constructor() {
    const t = P(Xc.getDefaults(), arguments, [
      "frequency",
      "depth"
    ]);
    super(t), this.name = "Vibrato", this._delayNode = new ze({
      context: this.context,
      delayTime: 0,
      maxDelay: t.maxDelay
    }), this._lfo = new Re({
      context: this.context,
      type: t.type,
      min: 0,
      max: t.maxDelay,
      frequency: t.frequency,
      phase: -90
      // offse the phase so the resting position is in the center
    }).start().connect(this._delayNode.delayTime), this.frequency = this._lfo.frequency, this.depth = this._lfo.amplitude, this.depth.value = t.depth, at(this, ["frequency", "depth"]), this.effectSend.chain(this._delayNode, this.effectReturn);
  }
  static getDefaults() {
    return Object.assign(le.getDefaults(), {
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
class Os extends W {
  constructor() {
    const t = P(Os.getDefaults(), arguments, ["type", "size"]);
    super(t), this.name = "Analyser", this._analysers = [], this._buffers = [], this.input = this.output = this._gain = new J({ context: this.context }), this._split = new Ds({
      context: this.context,
      channels: t.channels
    }), this.input.connect(this._split), ae(t.channels, 1);
    for (let e = 0; e < t.channels; e++)
      this._analysers[e] = this.context.createAnalyser(), this._split.connect(this._analysers[e], e, 0);
    this.size = t.size, this.type = t.type, this.smoothing = t.smoothing;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
    return this._analysers.forEach((t, e) => {
      const s = this._buffers[e];
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
    this._analysers.forEach((e, s) => {
      e.fftSize = t * 2, this._buffers[s] = new Float32Array(t);
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
    nt(t === "waveform" || t === "fft", `Analyser: invalid type: ${t}`), this._type = t;
  }
  /**
   * 0 represents no time averaging with the last analysis frame.
   */
  get smoothing() {
    return this._analysers[0].smoothingTimeConstant;
  }
  set smoothing(t) {
    this._analysers.forEach((e) => e.smoothingTimeConstant = t);
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), this._analysers.forEach((t) => t.disconnect()), this._split.dispose(), this._gain.dispose(), this;
  }
}
class es extends W {
  constructor() {
    super(P(es.getDefaults(), arguments)), this.name = "MeterBase", this.input = this.output = this._analyser = new Os({
      context: this.context,
      size: 256,
      type: "waveform"
    });
  }
  dispose() {
    return super.dispose(), this._analyser.dispose(), this;
  }
}
class Uc extends es {
  constructor() {
    const t = P(Uc.getDefaults(), arguments, [
      "smoothing"
    ]);
    super(t), this.name = "Meter", this.input = this.output = this._analyser = new Os({
      context: this.context,
      size: 256,
      type: "waveform",
      channels: t.channelCount
    }), this.smoothing = t.smoothing, this.normalRange = t.normalRange, this._rms = new Array(t.channelCount), this._rms.fill(0);
  }
  static getDefaults() {
    return Object.assign(es.getDefaults(), {
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
    return ii("'getLevel' has been changed to 'getValue'"), this.getValue();
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
      return this._rms[r] = Math.max(a, this._rms[r] * this.smoothing), this.normalRange ? this._rms[r] : Qi(this._rms[r]);
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
class Hc extends es {
  constructor() {
    const t = P(Hc.getDefaults(), arguments, [
      "size"
    ]);
    super(t), this.name = "FFT", this.normalRange = t.normalRange, this._analyser.type = "fft", this.size = t.size;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
    return this._analyser.getValue().map((e) => this.normalRange ? Ys(e) : e);
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
    return nt(0 <= t && t < this.size, `index must be greater than or equal to 0 and less than ${this.size}`), t * this.context.sampleRate / (this.size * 2);
  }
}
class Kc extends es {
  constructor() {
    super(P(Kc.getDefaults(), arguments)), this.name = "DCMeter", this._analyser.type = "waveform", this._analyser.size = 256;
  }
  /**
   * Get the signal value of the incoming signal
   */
  getValue() {
    return this._analyser.getValue()[0];
  }
}
let E0 = class Od extends es {
  constructor() {
    const t = P(Od.getDefaults(), arguments, ["size"]);
    super(t), this.name = "Waveform", this._analyser.type = "waveform", this.size = t.size;
  }
  static getDefaults() {
    return Object.assign(es.getDefaults(), {
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
class ne extends W {
  constructor() {
    const t = P(ne.getDefaults(), arguments, [
      "solo"
    ]);
    super(t), this.name = "Solo", this.input = this.output = new J({
      context: this.context
    }), ne._allSolos.has(this.context) || ne._allSolos.set(this.context, /* @__PURE__ */ new Set()), ne._allSolos.get(this.context).add(this), this.solo = t.solo;
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
    t ? this._addSolo() : this._removeSolo(), ne._allSolos.get(this.context).forEach((e) => e._updateSolo());
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
class vo extends W {
  constructor() {
    const t = P(vo.getDefaults(), arguments, [
      "pan",
      "volume"
    ]);
    super(t), this.name = "PanVol", this._panner = this.input = new gi({
      context: this.context,
      pan: t.pan,
      channelCount: t.channelCount
    }), this.pan = this._panner.pan, this._volume = this.output = new mn({
      context: this.context,
      volume: t.volume
    }), this.volume = this._volume.volume, this._panner.connect(this._volume), this.mute = t.mute, at(this, ["pan", "volume"]);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
let Rd = class Ii extends W {
  constructor() {
    const t = P(Ii.getDefaults(), arguments, [
      "volume",
      "pan"
    ]);
    super(t), this.name = "Channel", this._solo = this.input = new ne({
      solo: t.solo,
      context: this.context
    }), this._panVol = this.output = new vo({
      context: this.context,
      pan: t.pan,
      volume: t.volume,
      mute: t.mute,
      channelCount: t.channelCount
    }), this.pan = this._panVol.pan, this.volume = this._panVol.volume, this._solo.connect(this._panVol), at(this, ["pan", "volume"]);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
    return Ii.buses.has(t) || Ii.buses.set(t, new J({ context: this.context })), Ii.buses.get(t);
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
  send(t, e = 0) {
    const s = this._getBus(t), i = new J({
      context: this.context,
      units: "decibels",
      gain: e
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
Rd.buses = /* @__PURE__ */ new Map();
class Qc extends W {
  constructor() {
    super(P(Qc.getDefaults(), arguments)), this.name = "Mono", this.input = new J({ context: this.context }), this._merge = this.output = new cs({
      channels: 2,
      context: this.context
    }), this.input.connect(this._merge, 0, 0), this.input.connect(this._merge, 0, 1);
  }
  dispose() {
    return super.dispose(), this._merge.dispose(), this.input.dispose(), this;
  }
}
class dr extends W {
  constructor() {
    const t = P(dr.getDefaults(), arguments, ["lowFrequency", "highFrequency"]);
    super(t), this.name = "MultibandSplit", this.input = new J({ context: this.context }), this.output = void 0, this.low = new Be({
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
    }), this._internalChannels = [this.low, this.mid, this.high], this.lowFrequency = new ht({
      context: this.context,
      units: "frequency",
      value: t.lowFrequency
    }), this.highFrequency = new ht({
      context: this.context,
      units: "frequency",
      value: t.highFrequency
    }), this.Q = new ht({
      context: this.context,
      units: "positive",
      value: t.Q
    }), this.input.fan(this.low, this.high), this.input.chain(this._lowMidFilter, this.mid), this.lowFrequency.fan(this.low.frequency, this._lowMidFilter.frequency), this.highFrequency.fan(this.mid.frequency, this.high.frequency), this.Q.connect(this.low.Q), this.Q.connect(this._lowMidFilter.Q), this.Q.connect(this.mid.Q), this.Q.connect(this.high.Q), at(this, ["high", "mid", "low", "highFrequency", "lowFrequency"]);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      Q: 1,
      highFrequency: 2500,
      lowFrequency: 400
    });
  }
  /**
   * Clean up.
   */
  dispose() {
    return super.dispose(), Ki(this, ["high", "mid", "low", "highFrequency", "lowFrequency"]), this.low.dispose(), this._lowMidFilter.dispose(), this.mid.dispose(), this.high.dispose(), this.lowFrequency.dispose(), this.highFrequency.dispose(), this.Q.dispose(), this;
  }
}
class Jc extends W {
  constructor() {
    const t = P(Jc.getDefaults(), arguments, ["positionX", "positionY", "positionZ"]);
    super(t), this.name = "Panner3D", this._panner = this.input = this.output = this.context.createPanner(), this.panningModel = t.panningModel, this.maxDistance = t.maxDistance, this.distanceModel = t.distanceModel, this.coneOuterGain = t.coneOuterGain, this.coneOuterAngle = t.coneOuterAngle, this.coneInnerAngle = t.coneInnerAngle, this.refDistance = t.refDistance, this.rolloffFactor = t.rolloffFactor, this.positionX = new mt({
      context: this.context,
      param: this._panner.positionX,
      value: t.positionX
    }), this.positionY = new mt({
      context: this.context,
      param: this._panner.positionY,
      value: t.positionY
    }), this.positionZ = new mt({
      context: this.context,
      param: this._panner.positionZ,
      value: t.positionZ
    }), this.orientationX = new mt({
      context: this.context,
      param: this._panner.orientationX,
      value: t.orientationX
    }), this.orientationY = new mt({
      context: this.context,
      param: this._panner.orientationY,
      value: t.orientationY
    }), this.orientationZ = new mt({
      context: this.context,
      param: this._panner.orientationZ,
      value: t.orientationZ
    });
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
  setPosition(t, e, s) {
    return this.positionX.value = t, this.positionY.value = e, this.positionZ.value = s, this;
  }
  /**
   * Sets the orientation of the source in 3d space.
   */
  setOrientation(t, e, s) {
    return this.orientationX.value = t, this.orientationY.value = e, this.orientationZ.value = s, this;
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
class Yr extends W {
  constructor() {
    const t = P(Yr.getDefaults(), arguments);
    super(t), this.name = "Recorder", this.input = new J({
      context: this.context
    }), nt(Yr.supported, "Media Recorder API is not available"), this._stream = this.context.createMediaStreamDestination(), this.input.connect(this._stream), this._recorder = new MediaRecorder(this._stream.stream, {
      mimeType: t.mimeType
    });
  }
  static getDefaults() {
    return W.getDefaults();
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
    return Ee !== null && Reflect.has(Ee, "MediaRecorder");
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
      nt(this.state !== "started", "Recorder is already started");
      const t = new Promise((e) => {
        const s = () => {
          this._recorder.removeEventListener("start", s, !1), e();
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
      nt(this.state !== "stopped", "Recorder is not started");
      const t = new Promise((e) => {
        const s = (i) => {
          this._recorder.removeEventListener("dataavailable", s, !1), e(i.data);
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
    return nt(this.state === "started", "Recorder must be started"), this._recorder.pause(), this;
  }
  dispose() {
    return super.dispose(), this.input.dispose(), this._stream.disconnect(), this;
  }
}
class Pn extends W {
  constructor() {
    const t = P(Pn.getDefaults(), arguments, ["threshold", "ratio"]);
    super(t), this.name = "Compressor", this._compressor = this.context.createDynamicsCompressor(), this.input = this._compressor, this.output = this._compressor, this.threshold = new mt({
      minValue: this._compressor.threshold.minValue,
      maxValue: this._compressor.threshold.maxValue,
      context: this.context,
      convert: !1,
      param: this._compressor.threshold,
      units: "decibels",
      value: t.threshold
    }), this.attack = new mt({
      minValue: this._compressor.attack.minValue,
      maxValue: this._compressor.attack.maxValue,
      context: this.context,
      param: this._compressor.attack,
      units: "time",
      value: t.attack
    }), this.release = new mt({
      minValue: this._compressor.release.minValue,
      maxValue: this._compressor.release.maxValue,
      context: this.context,
      param: this._compressor.release,
      units: "time",
      value: t.release
    }), this.knee = new mt({
      minValue: this._compressor.knee.minValue,
      maxValue: this._compressor.knee.maxValue,
      context: this.context,
      convert: !1,
      param: this._compressor.knee,
      units: "decibels",
      value: t.knee
    }), this.ratio = new mt({
      minValue: this._compressor.ratio.minValue,
      maxValue: this._compressor.ratio.maxValue,
      context: this.context,
      convert: !1,
      param: this._compressor.ratio,
      units: "positive",
      value: t.ratio
    }), at(this, ["knee", "release", "attack", "ratio", "threshold"]);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
class tl extends W {
  constructor() {
    const t = P(tl.getDefaults(), arguments, [
      "threshold",
      "smoothing"
    ]);
    super(t), this.name = "Gate", this._follower = new lr({
      context: this.context,
      smoothing: t.smoothing
    }), this._gt = new mo({
      context: this.context,
      value: Ys(t.threshold)
    }), this.input = new J({ context: this.context }), this._gate = this.output = new J({ context: this.context }), this.input.connect(this._gate), this.input.chain(this._follower, this._gt, this._gate.gain);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      smoothing: 0.1,
      threshold: -40
    });
  }
  /**
   * The threshold of the gate in decibels
   */
  get threshold() {
    return Qi(this._gt.value);
  }
  set threshold(t) {
    this._gt.value = Ys(t);
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
class el extends W {
  constructor() {
    const t = P(el.getDefaults(), arguments, [
      "threshold"
    ]);
    super(t), this.name = "Limiter", this._compressor = this.input = this.output = new Pn({
      context: this.context,
      ratio: 20,
      attack: 3e-3,
      release: 0.01,
      threshold: t.threshold
    }), this.threshold = this._compressor.threshold, at(this, "threshold");
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
class nl extends W {
  constructor() {
    const t = P(nl.getDefaults(), arguments);
    super(t), this.name = "MidSideCompressor", this._midSideSplit = this.input = new ur({
      context: this.context
    }), this._midSideMerge = this.output = new hr({
      context: this.context
    }), this.mid = new Pn(Object.assign(t.mid, { context: this.context })), this.side = new Pn(Object.assign(t.side, { context: this.context })), this._midSideSplit.mid.chain(this.mid, this._midSideMerge.mid), this._midSideSplit.side.chain(this.side, this._midSideMerge.side), at(this, ["mid", "side"]);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
class sl extends W {
  constructor() {
    const t = P(sl.getDefaults(), arguments);
    super(t), this.name = "MultibandCompressor", this._splitter = this.input = new dr({
      context: this.context,
      lowFrequency: t.lowFrequency,
      highFrequency: t.highFrequency
    }), this.lowFrequency = this._splitter.lowFrequency, this.highFrequency = this._splitter.highFrequency, this.output = new J({ context: this.context }), this.low = new Pn(Object.assign(t.low, { context: this.context })), this.mid = new Pn(Object.assign(t.mid, { context: this.context })), this.high = new Pn(Object.assign(t.high, { context: this.context })), this._splitter.low.chain(this.low, this.output), this._splitter.mid.chain(this.mid, this.output), this._splitter.high.chain(this.high, this.output), at(this, ["high", "mid", "low", "highFrequency", "lowFrequency"]);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
class il extends W {
  constructor() {
    const t = P(il.getDefaults(), arguments, [
      "low",
      "mid",
      "high"
    ]);
    super(t), this.name = "EQ3", this.output = new J({ context: this.context }), this._internalChannels = [], this.input = this._multibandSplit = new dr({
      context: this.context,
      highFrequency: t.highFrequency,
      lowFrequency: t.lowFrequency
    }), this._lowGain = new J({
      context: this.context,
      gain: t.low,
      units: "decibels"
    }), this._midGain = new J({
      context: this.context,
      gain: t.mid,
      units: "decibels"
    }), this._highGain = new J({
      context: this.context,
      gain: t.high,
      units: "decibels"
    }), this.low = this._lowGain.gain, this.mid = this._midGain.gain, this.high = this._highGain.gain, this.Q = this._multibandSplit.Q, this.lowFrequency = this._multibandSplit.lowFrequency, this.highFrequency = this._multibandSplit.highFrequency, this._multibandSplit.low.chain(this._lowGain, this.output), this._multibandSplit.mid.chain(this._midGain, this.output), this._multibandSplit.high.chain(this._highGain, this.output), at(this, ["low", "mid", "high", "lowFrequency", "highFrequency"]), this._internalChannels = [this._multibandSplit];
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
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
    return super.dispose(), Ki(this, ["low", "mid", "high", "lowFrequency", "highFrequency"]), this._multibandSplit.dispose(), this.lowFrequency.dispose(), this.highFrequency.dispose(), this._lowGain.dispose(), this._midGain.dispose(), this._highGain.dispose(), this.low.dispose(), this.mid.dispose(), this.high.dispose(), this.Q.dispose(), this;
  }
}
class rl extends W {
  constructor() {
    const t = P(rl.getDefaults(), arguments, ["url", "onload"]);
    super(t), this.name = "Convolver", this._convolver = this.context.createConvolver(), this._buffer = new Dt(t.url, (e) => {
      this.buffer = e, t.onload();
    }), this.input = new J({ context: this.context }), this.output = new J({ context: this.context }), this._buffer.loaded && (this.buffer = this._buffer), this.normalize = t.normalize, this.input.chain(this._convolver, this.output);
  }
  static getDefaults() {
    return Object.assign(W.getDefaults(), {
      normalize: !0,
      onload: Ct
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
    const e = this._buffer.get();
    this._convolver.buffer = e || null;
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
function _s() {
  return At().now();
}
function D0() {
  return At().immediate();
}
const O0 = At().transport;
function ps() {
  return At().transport;
}
const R0 = At().destination, M0 = At().destination;
function ol() {
  return At().destination;
}
const N0 = At().listener;
function P0() {
  return At().listener;
}
const F0 = At().draw;
function V0() {
  return At().draw;
}
const W0 = At();
function j0() {
  return Dt.loaded();
}
const L0 = Dt, q0 = ui, B0 = as, $0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AMOscillator: er,
  AMSynth: xc,
  Abs: Ad,
  Add: ks,
  AmplitudeEnvelope: pi,
  Analyser: Os,
  AudioToGain: ho,
  AutoFilter: Rc,
  AutoPanner: Mc,
  AutoWah: _o,
  BaseContext: cc,
  BiquadFilter: Vi,
  BitCrusher: Nc,
  Buffer: L0,
  BufferSource: B0,
  Buffers: q0,
  Channel: Rd,
  Chebyshev: Fc,
  Chorus: Vc,
  Clock: li,
  Compressor: Pn,
  Context: oi,
  Convolver: rl,
  CrossFade: mi,
  DCMeter: Kc,
  Delay: ze,
  Destination: R0,
  Distortion: Wc,
  Draw: F0,
  DuoSynth: wc,
  EQ3: il,
  Emitter: ri,
  Envelope: be,
  FFT: Hc,
  FMOscillator: di,
  FMSynth: Cc,
  FatOscillator: nr,
  FeedbackCombFilter: rr,
  FeedbackDelay: jc,
  Filter: Be,
  Follower: lr,
  Freeverb: qc,
  Frequency: e0,
  FrequencyClass: Oe,
  FrequencyEnvelope: Wi,
  FrequencyShifter: Lc,
  Gain: J,
  GainToAudio: kd,
  Gate: tl,
  GrainPlayer: vc,
  GreaterThan: mo,
  GreaterThanZero: po,
  IntervalTimeline: Sd,
  JCReverb: Bc,
  LFO: Re,
  Limiter: el,
  Listener: N0,
  Loop: ji,
  LowpassCombFilter: ar,
  Master: M0,
  MembraneSynth: ir,
  Merge: cs,
  MetalSynth: Sc,
  Meter: Uc,
  MidSideCompressor: nl,
  MidSideMerge: hr,
  MidSideSplit: ur,
  Midi: o0,
  MidiClass: Hs,
  Mono: Qc,
  MonoSynth: gs,
  MultibandCompressor: sl,
  MultibandSplit: dr,
  Multiply: Xt,
  Negate: bc,
  Noise: Jn,
  NoiseSynth: Tc,
  Offline: r0,
  OfflineContext: ai,
  OmniOscillator: Fn,
  OnePoleFilter: or,
  Oscillator: Yt,
  PWMOscillator: sr,
  PanVol: vo,
  Panner: gi,
  Panner3D: Jc,
  Param: mt,
  Part: Li,
  Pattern: Dc,
  Phaser: Gc,
  PingPongDelay: $c,
  PitchShift: zc,
  Player: Is,
  Players: yc,
  PluckSynth: Ic,
  PolySynth: Ec,
  Pow: hi,
  PulseOscillator: fi,
  Recorder: Yr,
  Reverb: yo,
  Sampler: cr,
  Scale: Vn,
  ScaleExp: go,
  Sequence: Oc,
  Signal: ht,
  Solo: ne,
  Split: Ds,
  StateTimeline: ci,
  StereoWidener: Zc,
  Subtract: Es,
  SyncedSignal: d0,
  Synth: ts,
  Ticks: a0,
  TicksClass: Zt,
  Time: Qv,
  TimeClass: qe,
  Timeline: $e,
  ToneAudioBuffer: Dt,
  ToneAudioBuffers: ui,
  ToneAudioNode: W,
  ToneBufferSource: as,
  ToneEvent: yn,
  ToneOscillatorNode: tr,
  Transport: O0,
  TransportTime: n0,
  TransportTimeClass: re,
  Tremolo: Yc,
  Unit: u0,
  UserMedia: Di,
  Vibrato: Xc,
  Volume: mn,
  WaveShaper: gn,
  Waveform: E0,
  Zero: fo,
  connect: Me,
  connectSeries: Ze,
  connectSignal: Ji,
  context: W0,
  dbToGain: Ys,
  debug: Vv,
  defaultArg: en,
  disconnect: dc,
  fanIn: s0,
  ftom: Un,
  gainToDb: Qi,
  getContext: At,
  getDestination: ol,
  getDraw: V0,
  getListener: P0,
  getTransport: ps,
  immediate: D0,
  intervalToFrequencyRatio: Xs,
  isArray: ve,
  isBoolean: ic,
  isDefined: vt,
  isFunction: gd,
  isNote: ki,
  isNumber: Ge,
  isObject: Nn,
  isString: dn,
  isUndef: We,
  loaded: j0,
  mtof: uc,
  now: _s,
  optionsFromArguments: P,
  setContext: Pi,
  start: lc,
  supported: Pv,
  version: ja
}, Symbol.toStringTag, { value: "Module" }));
var ge = {}, fs = {}, ou;
function z0() {
  if (ou) return fs;
  ou = 1, Object.defineProperty(fs, "__esModule", {
    value: !0
  }), fs.linear = n, fs.exponential = t, fs.sCurve = e, fs.logarithmic = s;
  function n(i, r) {
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
  function e(i, r) {
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
  return fs;
}
var au;
function G0() {
  if (au) return ge;
  au = 1, Object.defineProperty(ge, "__esModule", {
    value: !0
  }), ge.FADEOUT = ge.FADEIN = ge.LOGARITHMIC = ge.EXPONENTIAL = ge.LINEAR = ge.SCURVE = void 0, ge.createFadeIn = f, ge.createFadeOut = p;
  var n = z0(), t = ge.SCURVE = "sCurve", e = ge.LINEAR = "linear", s = ge.EXPONENTIAL = "exponential", i = ge.LOGARITHMIC = "logarithmic";
  ge.FADEIN = "FadeIn", ge.FADEOUT = "FadeOut";
  function r(m, g) {
    var _ = (0, n.sCurve)(1e4, 1);
    this.setValueCurveAtTime(_, m, g);
  }
  function o(m, g) {
    var _ = (0, n.sCurve)(1e4, -1);
    this.setValueCurveAtTime(_, m, g);
  }
  function a(m, g) {
    this.linearRampToValueAtTime(0, m), this.linearRampToValueAtTime(1, m + g);
  }
  function c(m, g) {
    this.linearRampToValueAtTime(1, m), this.linearRampToValueAtTime(0, m + g);
  }
  function l(m, g) {
    this.exponentialRampToValueAtTime(0.01, m), this.exponentialRampToValueAtTime(1, m + g);
  }
  function u(m, g) {
    this.exponentialRampToValueAtTime(1, m), this.exponentialRampToValueAtTime(0.01, m + g);
  }
  function h(m, g) {
    var _ = (0, n.logarithmic)(1e4, 10, 1);
    this.setValueCurveAtTime(_, m, g);
  }
  function d(m, g) {
    var _ = (0, n.logarithmic)(1e4, 10, -1);
    this.setValueCurveAtTime(_, m, g);
  }
  function f(m, g, _, v) {
    switch (g) {
      case t:
        r.call(m, _, v);
        break;
      case e:
        a.call(m, _, v);
        break;
      case s:
        l.call(m, _, v);
        break;
      case i:
        h.call(m, _, v);
        break;
      default:
        throw new Error("Unsupported Fade type");
    }
  }
  function p(m, g, _, v) {
    switch (g) {
      case t:
        o.call(m, _, v);
        break;
      case e:
        c.call(m, _, v);
        break;
      case s:
        u.call(m, _, v);
        break;
      case i:
        d.call(m, _, v);
        break;
      default:
        throw new Error("Unsupported Fade type");
    }
  }
  return ge;
}
var cu = G0(), Ro = null;
function Ks() {
  return Ro || (Ro = new AudioContext()), Ro;
}
async function Or() {
  const n = Ks();
  n.state !== "running" && await n.resume();
}
var Z0 = class {
  // Count of currently playing clips
  constructor(n) {
    this.activePlayers = 0, this.track = n.track, this.volumeNode = new mn(this.gainToDb(n.track.gain)), this.panNode = new gi(n.track.stereoPan), this.muteGain = new J(n.track.muted ? 0 : 1);
    const t = n.destination || ol();
    if (n.effects) {
      const s = n.effects(this.muteGain, t, !1);
      s && (this.effectsCleanup = s);
    } else
      this.muteGain.connect(t);
    const e = n.clips || (n.buffer ? [{
      buffer: n.buffer,
      startTime: 0,
      // Legacy: single buffer starts at timeline position 0
      duration: n.buffer.duration,
      // Legacy: play full buffer duration
      offset: 0,
      fadeIn: n.track.fadeIn,
      fadeOut: n.track.fadeOut,
      gain: 1
    }] : []);
    this.clips = e.map((s) => {
      const i = new Is({
        url: s.buffer,
        loop: !1,
        onstop: () => {
          this.activePlayers--, this.activePlayers === 0 && this.onStopCallback && this.onStopCallback();
        }
      }), r = new J(s.gain);
      if (i.connect(r), r.chain(this.volumeNode, this.panNode, this.muteGain), s.fadeIn) {
        const o = r.gain._param;
        cu.createFadeIn(
          o,
          s.fadeIn.type,
          s.fadeIn.start,
          s.fadeIn.end - s.fadeIn.start
        );
      }
      if (s.fadeOut) {
        const o = r.gain._param;
        cu.createFadeOut(
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
  gainToDb(n) {
    return 20 * Math.log10(n);
  }
  setVolume(n) {
    this.track.gain = n, this.volumeNode.volume.value = this.gainToDb(n);
  }
  setPan(n) {
    this.track.stereoPan = n, this.panNode.pan.value = n;
  }
  setMute(n) {
    this.track.muted = n, this.muteGain.gain.value = n ? 0 : 1;
  }
  setSolo(n) {
    this.track.soloed = n;
  }
  play(n = _s(), t = 0, e) {
    this.isPlaying || (this.activePlayers = 0, this.clips.forEach((s) => {
      const { player: i, clipInfo: r } = s, o = t, a = r.startTime, c = r.startTime + r.duration;
      if ((isNaN(n) || isNaN(o) || isNaN(a) || isNaN(r.offset) || isNaN(r.duration)) && console.error("NaN detected in ToneTrack.play:", {
        when: n,
        offset: t,
        duration: e,
        playbackPosition: o,
        clipStart: a,
        clipEnd: c,
        clipInfo: r
      }), o < c)
        if (this.activePlayers++, s.playStartTime = _s(), o >= a) {
          const l = o - a + r.offset, u = r.duration - (o - a), h = e ? Math.min(e, u) : u;
          s.pausedPosition = l, i.start(n, l, h);
        } else {
          const l = a - o, u = e ? Math.min(e - l, r.duration) : r.duration;
          l < (e ?? 1 / 0) ? (s.pausedPosition = r.offset, i.start(n + l, r.offset, u)) : this.activePlayers--;
        }
    }));
  }
  pause() {
    this.isPlaying && (this.clips.forEach((n) => {
      if (n.player.state === "started") {
        const t = (_s() - n.playStartTime) * n.player.playbackRate;
        n.pausedPosition = n.pausedPosition + t, n.player.stop();
      }
    }), this.activePlayers = 0);
  }
  stop(n = _s()) {
    this.clips.forEach((t) => {
      t.player.stop(n), t.pausedPosition = 0;
    }), this.activePlayers = 0;
  }
  dispose() {
    this.effectsCleanup && this.effectsCleanup(), this.clips.forEach((n) => {
      n.player.dispose(), n.fadeGain.dispose();
    }), this.volumeNode.dispose(), this.panNode.dispose(), this.muteGain.dispose();
  }
  get id() {
    return this.track.id;
  }
  get duration() {
    if (this.clips.length === 0) return 0;
    const n = this.clips[this.clips.length - 1];
    return n.clipInfo.startTime + n.clipInfo.duration;
  }
  get buffer() {
    return this.clips[0]?.clipInfo.buffer;
  }
  get isPlaying() {
    return this.clips.some((n) => n.player.state === "started");
  }
  get muted() {
    return this.track.muted;
  }
  get startTime() {
    return this.track.startTime;
  }
  setOnStopCallback(n) {
    this.onStopCallback = n;
  }
}, Md = class {
  constructor(n = {}) {
    if (this.tracks = /* @__PURE__ */ new Map(), this.isInitialized = !1, this.soloedTracks = /* @__PURE__ */ new Set(), this.manualMuteState = /* @__PURE__ */ new Map(), this.activeTracks = /* @__PURE__ */ new Map(), this.playbackSessionId = 0, this.masterVolume = new mn(this.gainToDb(n.masterGain ?? 1)), n.effects) {
      const t = n.effects(this.masterVolume, ol(), !1);
      t && (this.effectsCleanup = t);
    } else
      this.masterVolume.toDestination();
    n.tracks && n.tracks.forEach((t) => {
      this.tracks.set(t.id, t), this.manualMuteState.set(t.id, t.muted);
    });
  }
  gainToDb(n) {
    return 20 * Math.log10(n);
  }
  async init() {
    this.isInitialized || (await lc(), this.isInitialized = !0);
  }
  addTrack(n) {
    const t = {
      ...n,
      destination: this.masterVolume
    }, e = new Z0(t);
    return this.tracks.set(e.id, e), this.manualMuteState.set(e.id, n.track.muted ?? !1), e;
  }
  removeTrack(n) {
    const t = this.tracks.get(n);
    t && (t.dispose(), this.tracks.delete(n), this.manualMuteState.delete(n), this.soloedTracks.delete(n));
  }
  getTrack(n) {
    return this.tracks.get(n);
  }
  play(n = _s(), t, e) {
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
        e !== void 0 && (this.activeTracks.set(r.id, i), r.setOnStopCallback(() => {
          this.activeTracks.get(r.id) === i && (this.activeTracks.delete(r.id), this.activeTracks.size === 0 && this.onPlaybackCompleteCallback && this.onPlaybackCompleteCallback());
        })), r.play(n, a, e);
      } else {
        const a = o - s;
        e !== void 0 && (this.activeTracks.set(r.id, i), r.setOnStopCallback(() => {
          this.activeTracks.get(r.id) === i && (this.activeTracks.delete(r.id), this.activeTracks.size === 0 && this.onPlaybackCompleteCallback && this.onPlaybackCompleteCallback());
        })), r.play(n + a, 0, e);
      }
    }), t !== void 0 ? ps().start(n, t) : ps().start(n);
  }
  pause() {
    ps().pause(), this.tracks.forEach((n) => {
      n.pause();
    });
  }
  stop() {
    ps().stop(), this.tracks.forEach((n) => {
      n.stop();
    });
  }
  setMasterGain(n) {
    this.masterVolume.volume.value = this.gainToDb(n);
  }
  setSolo(n, t) {
    const e = this.tracks.get(n);
    e && (e.setSolo(t), t ? this.soloedTracks.add(n) : this.soloedTracks.delete(n), this.updateSoloMuting());
  }
  updateSoloMuting() {
    const n = this.soloedTracks.size > 0;
    this.tracks.forEach((t, e) => {
      if (n)
        if (!this.soloedTracks.has(e))
          t.setMute(!0);
        else {
          const s = this.manualMuteState.get(e) ?? !1;
          t.setMute(s);
        }
      else {
        const s = this.manualMuteState.get(e) ?? !1;
        t.setMute(s);
      }
    });
  }
  setMute(n, t) {
    const e = this.tracks.get(n);
    e && (this.manualMuteState.set(n, t), e.setMute(t));
  }
  getCurrentTime() {
    return ps().seconds;
  }
  seekTo(n) {
    ps().seconds = n;
  }
  dispose() {
    this.tracks.forEach((n) => {
      n.dispose();
    }), this.tracks.clear(), this.effectsCleanup && this.effectsCleanup(), this.masterVolume.dispose();
  }
  get context() {
    return At();
  }
  get sampleRate() {
    return At().sampleRate;
  }
  setOnPlaybackComplete(n) {
    this.onPlaybackCompleteCallback = n;
  }
}, Sr = /* @__PURE__ */ new Map(), lu = /* @__PURE__ */ new Map();
function Nd(n) {
  if (Sr.has(n))
    return Sr.get(n);
  const e = Ks().createMediaStreamSource(n);
  Sr.set(n, e);
  const s = () => {
    e.disconnect(), Sr.delete(n), lu.delete(n), n.removeEventListener("ended", s), n.removeEventListener("inactive", s);
  };
  return lu.set(n, s), n.addEventListener("ended", s), n.addEventListener("inactive", s), e;
}
Pi(Ks());
var Mo = { exports: {} }, uu;
function Y0() {
  return uu || (uu = 1, (function(n) {
    var t = Object.prototype.hasOwnProperty, e = "~";
    function s() {
    }
    Object.create && (s.prototype = /* @__PURE__ */ Object.create(null), new s().__proto__ || (e = !1));
    function i(c, l, u) {
      this.fn = c, this.context = l, this.once = u || !1;
    }
    function r(c, l, u, h, d) {
      if (typeof u != "function")
        throw new TypeError("The listener must be a function");
      var f = new i(u, h || c, d), p = e ? e + l : l;
      return c._events[p] ? c._events[p].fn ? c._events[p] = [c._events[p], f] : c._events[p].push(f) : (c._events[p] = f, c._eventsCount++), c;
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
        t.call(u, h) && l.push(e ? h.slice(1) : h);
      return Object.getOwnPropertySymbols ? l.concat(Object.getOwnPropertySymbols(u)) : l;
    }, a.prototype.listeners = function(l) {
      var u = e ? e + l : l, h = this._events[u];
      if (!h) return [];
      if (h.fn) return [h.fn];
      for (var d = 0, f = h.length, p = new Array(f); d < f; d++)
        p[d] = h[d].fn;
      return p;
    }, a.prototype.listenerCount = function(l) {
      var u = e ? e + l : l, h = this._events[u];
      return h ? h.fn ? 1 : h.length : 0;
    }, a.prototype.emit = function(l, u, h, d, f, p) {
      var m = e ? e + l : l;
      if (!this._events[m]) return !1;
      var g = this._events[m], _ = arguments.length, v, x;
      if (g.fn) {
        switch (g.once && this.removeListener(l, g.fn, void 0, !0), _) {
          case 1:
            return g.fn.call(g.context), !0;
          case 2:
            return g.fn.call(g.context, u), !0;
          case 3:
            return g.fn.call(g.context, u, h), !0;
          case 4:
            return g.fn.call(g.context, u, h, d), !0;
          case 5:
            return g.fn.call(g.context, u, h, d, f), !0;
          case 6:
            return g.fn.call(g.context, u, h, d, f, p), !0;
        }
        for (x = 1, v = new Array(_ - 1); x < _; x++)
          v[x - 1] = arguments[x];
        g.fn.apply(g.context, v);
      } else {
        var T = g.length, y;
        for (x = 0; x < T; x++)
          switch (g[x].once && this.removeListener(l, g[x].fn, void 0, !0), _) {
            case 1:
              g[x].fn.call(g[x].context);
              break;
            case 2:
              g[x].fn.call(g[x].context, u);
              break;
            case 3:
              g[x].fn.call(g[x].context, u, h);
              break;
            case 4:
              g[x].fn.call(g[x].context, u, h, d);
              break;
            default:
              if (!v) for (y = 1, v = new Array(_ - 1); y < _; y++)
                v[y - 1] = arguments[y];
              g[x].fn.apply(g[x].context, v);
          }
      }
      return !0;
    }, a.prototype.on = function(l, u, h) {
      return r(this, l, u, h, !1);
    }, a.prototype.once = function(l, u, h) {
      return r(this, l, u, h, !0);
    }, a.prototype.removeListener = function(l, u, h, d) {
      var f = e ? e + l : l;
      if (!this._events[f]) return this;
      if (!u)
        return o(this, f), this;
      var p = this._events[f];
      if (p.fn)
        p.fn === u && (!d || p.once) && (!h || p.context === h) && o(this, f);
      else {
        for (var m = 0, g = [], _ = p.length; m < _; m++)
          (p[m].fn !== u || d && !p[m].once || h && p[m].context !== h) && g.push(p[m]);
        g.length ? this._events[f] = g.length === 1 ? g[0] : g : o(this, f);
      }
      return this;
    }, a.prototype.removeAllListeners = function(l) {
      var u;
      return l ? (u = e ? e + l : l, this._events[u] && o(this, u)) : (this._events = new s(), this._eventsCount = 0), this;
    }, a.prototype.off = a.prototype.removeListener, a.prototype.addListener = a.prototype.on, a.prefixed = e, a.EventEmitter = a, n.exports = a;
  })(Mo)), Mo.exports;
}
var X0 = Y0();
const U0 = /* @__PURE__ */ Ch(X0);
var Pd = class extends U0 {
  constructor(n, t) {
    super(), this.src = n, this.ac = t, this.audioRequestState = "uninitialized";
  }
  setStateChange(n) {
    this.audioRequestState = n, this.emit("audiorequeststatechange", this.audioRequestState, this.src);
  }
  fileProgress(n) {
    let t = 0;
    this.audioRequestState === "uninitialized" && this.setStateChange(
      "loading"
      /* LOADING */
    ), n.lengthComputable && (t = n.loaded / n.total * 100), this.emit("loadprogress", t, this.src);
  }
  async fileLoad(n) {
    this.setStateChange(
      "decoding"
      /* DECODING */
    );
    try {
      const t = await this.ac.decodeAudioData(n);
      return this.audioBuffer = t, this.setStateChange(
        "finished"
        /* FINISHED */
      ), t;
    } catch (t) {
      this.setStateChange(
        "error"
        /* ERROR */
      );
      const e = t instanceof Error ? t : new Error("Failed to decode audio data");
      throw this.emit("error", e), e;
    }
  }
  getState() {
    return this.audioRequestState;
  }
  getAudioBuffer() {
    return this.audioBuffer;
  }
}, H0 = class extends Pd {
  constructor(n, t) {
    super(n, t), this.url = n;
  }
  async load() {
    return new Promise((n, t) => {
      const e = new XMLHttpRequest();
      e.open("GET", this.url, !0), e.responseType = "arraybuffer", e.addEventListener("progress", (s) => {
        this.fileProgress(s);
      }), e.addEventListener("load", async (s) => {
        const i = s.target;
        if (i.status >= 200 && i.status < 300)
          try {
            const r = await this.fileLoad(i.response);
            n(r);
          } catch (r) {
            t(r);
          }
        else {
          const r = new Error(`HTTP ${i.status}: ${i.statusText}`);
          this.emit("error", r), t(r);
        }
      }), e.addEventListener("error", () => {
        const s = new Error("Network error while loading audio file");
        this.emit("error", s), t(s);
      }), e.addEventListener("abort", () => {
        const s = new Error("Audio file loading was aborted");
        this.emit("error", s), t(s);
      }), e.send();
    });
  }
}, K0 = class extends Pd {
  constructor(n, t) {
    super(n, t), this.blob = n;
  }
  async load() {
    return new Promise((n, t) => {
      if (this.blob.type.match(/audio.*/) || // Added for problems with Firefox mime types + ogg
      this.blob.type.match(/video\/ogg/)) {
        const e = new FileReader();
        e.addEventListener("progress", (s) => {
          this.fileProgress(s);
        }), e.addEventListener("load", async () => {
          try {
            const s = await this.fileLoad(e.result);
            n(s);
          } catch (s) {
            t(s);
          }
        }), e.addEventListener("error", () => {
          const s = new Error("Failed to read audio file");
          this.emit("error", s), t(s);
        }), e.readAsArrayBuffer(this.blob);
      } else {
        const e = new Error(`Unsupported file type: ${this.blob.type}`);
        this.emit("error", e), t(e);
      }
    });
  }
}, hu = class {
  static createLoader(n, t) {
    if (typeof n == "string")
      return new H0(n, t);
    if (n instanceof Blob)
      return new K0(n, t);
    throw new Error("Invalid audio source. Must be a URL string or Blob.");
  }
};
const Q0 = typeof window < "u" && typeof window.document < "u" && typeof window.document.createElement < "u";
function al(n) {
  const t = Object.prototype.toString.call(n);
  return t === "[object Window]" || // In Electron context the Window object serializes to [object global]
  t === "[object global]";
}
function Fd(n) {
  return "nodeType" in n;
}
function _i(n) {
  var t, e;
  return n ? al(n) ? n : Fd(n) && (t = (e = n.ownerDocument) == null ? void 0 : e.defaultView) != null ? t : window : window;
}
function J0(n) {
  const {
    Document: t
  } = _i(n);
  return n instanceof t;
}
function tb(n) {
  return al(n) ? !1 : n instanceof _i(n).HTMLElement;
}
function eb(n) {
  return n instanceof _i(n).SVGElement;
}
function bo(n) {
  return n ? al(n) ? n.document : Fd(n) ? J0(n) ? n : tb(n) || eb(n) ? n.ownerDocument : document : document : document;
}
const cl = Q0 ? ip : oe;
function nb(n) {
  const t = Et(n);
  return cl(() => {
    t.current = n;
  }), xt(function() {
    for (var e = arguments.length, s = new Array(e), i = 0; i < e; i++)
      s[i] = arguments[i];
    return t.current == null ? void 0 : t.current(...s);
  }, []);
}
function sb(n, t) {
  t === void 0 && (t = [n]);
  const e = Et(n);
  return cl(() => {
    e.current !== n && (e.current = n);
  }, t), e;
}
function du(n) {
  const t = nb(n), e = Et(null), s = xt(
    (i) => {
      i !== e.current && t?.(i, e.current), e.current = i;
    },
    //eslint-disable-next-line
    []
  );
  return [e, s];
}
let No = {};
function ib(n, t) {
  return $i(() => {
    const e = No[n] == null ? 0 : No[n] + 1;
    return No[n] = e, n + "-" + e;
  }, [n, t]);
}
function rb(n) {
  return function(t) {
    for (var e = arguments.length, s = new Array(e > 1 ? e - 1 : 0), i = 1; i < e; i++)
      s[i - 1] = arguments[i];
    return s.reduce((r, o) => {
      const a = Object.entries(o);
      for (const [c, l] of a) {
        const u = r[c];
        u != null && (r[c] = u + n * l);
      }
      return r;
    }, {
      ...t
    });
  };
}
const ob = /* @__PURE__ */ rb(-1);
function ab(n) {
  return "clientX" in n && "clientY" in n;
}
function cb(n) {
  if (!n)
    return !1;
  const {
    TouchEvent: t
  } = _i(n.target);
  return t && n instanceof t;
}
function fu(n) {
  if (cb(n)) {
    if (n.touches && n.touches.length) {
      const {
        clientX: t,
        clientY: e
      } = n.touches[0];
      return {
        x: t,
        y: e
      };
    } else if (n.changedTouches && n.changedTouches.length) {
      const {
        clientX: t,
        clientY: e
      } = n.changedTouches[0];
      return {
        x: t,
        y: e
      };
    }
  }
  return ab(n) ? {
    x: n.clientX,
    y: n.clientY
  } : null;
}
const ua = /* @__PURE__ */ Object.freeze({
  Translate: {
    toString(n) {
      if (!n)
        return;
      const {
        x: t,
        y: e
      } = n;
      return "translate3d(" + (t ? Math.round(t) : 0) + "px, " + (e ? Math.round(e) : 0) + "px, 0)";
    }
  },
  Scale: {
    toString(n) {
      if (!n)
        return;
      const {
        scaleX: t,
        scaleY: e
      } = n;
      return "scaleX(" + t + ") scaleY(" + e + ")";
    }
  },
  Transform: {
    toString(n) {
      if (n)
        return [ua.Translate.toString(n), ua.Scale.toString(n)].join(" ");
    }
  },
  Transition: {
    toString(n) {
      let {
        property: t,
        duration: e,
        easing: s
      } = n;
      return t + " " + e + "ms " + s;
    }
  }
});
var pu;
(function(n) {
  n.DragStart = "dragStart", n.DragMove = "dragMove", n.DragEnd = "dragEnd", n.DragCancel = "dragCancel", n.DragOver = "dragOver", n.RegisterDroppable = "registerDroppable", n.SetDroppableDisabled = "setDroppableDisabled", n.UnregisterDroppable = "unregisterDroppable";
})(pu || (pu = {}));
function mu() {
}
function lb(n, t) {
  return $i(
    () => ({
      sensor: n,
      options: t ?? {}
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n, t]
  );
}
function ub() {
  for (var n = arguments.length, t = new Array(n), e = 0; e < n; e++)
    t[e] = arguments[e];
  return $i(
    () => [...t].filter((s) => s != null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...t]
  );
}
const ha = /* @__PURE__ */ Object.freeze({
  x: 0,
  y: 0
});
var Ls;
(function(n) {
  n[n.Forward = 1] = "Forward", n[n.Backward = -1] = "Backward";
})(Ls || (Ls = {}));
class Po {
  constructor(t) {
    this.target = void 0, this.listeners = [], this.removeAll = () => {
      this.listeners.forEach((e) => {
        var s;
        return (s = this.target) == null ? void 0 : s.removeEventListener(...e);
      });
    }, this.target = t;
  }
  add(t, e, s) {
    var i;
    (i = this.target) == null || i.addEventListener(t, e, s), this.listeners.push([t, e, s]);
  }
}
function hb(n) {
  const {
    EventTarget: t
  } = _i(n);
  return n instanceof t ? n : bo(n);
}
function Fo(n, t) {
  const e = Math.abs(n.x), s = Math.abs(n.y);
  return typeof t == "number" ? Math.sqrt(e ** 2 + s ** 2) > t : "x" in t && "y" in t ? e > t.x && s > t.y : "x" in t ? e > t.x : "y" in t ? s > t.y : !1;
}
var On;
(function(n) {
  n.Click = "click", n.DragStart = "dragstart", n.Keydown = "keydown", n.ContextMenu = "contextmenu", n.Resize = "resize", n.SelectionChange = "selectionchange", n.VisibilityChange = "visibilitychange";
})(On || (On = {}));
function gu(n) {
  n.preventDefault();
}
function db(n) {
  n.stopPropagation();
}
var Rn;
(function(n) {
  n.Space = "Space", n.Down = "ArrowDown", n.Right = "ArrowRight", n.Left = "ArrowLeft", n.Up = "ArrowUp", n.Esc = "Escape", n.Enter = "Enter", n.Tab = "Tab";
})(Rn || (Rn = {}));
Rn.Space, Rn.Enter, Rn.Esc, Rn.Space, Rn.Enter, Rn.Tab;
function _u(n) {
  return !!(n && "distance" in n);
}
function yu(n) {
  return !!(n && "delay" in n);
}
class ll {
  constructor(t, e, s) {
    var i;
    s === void 0 && (s = hb(t.event.target)), this.props = void 0, this.events = void 0, this.autoScrollEnabled = !0, this.document = void 0, this.activated = !1, this.initialCoordinates = void 0, this.timeoutId = null, this.listeners = void 0, this.documentListeners = void 0, this.windowListeners = void 0, this.props = t, this.events = e;
    const {
      event: r
    } = t, {
      target: o
    } = r;
    this.props = t, this.events = e, this.document = bo(o), this.documentListeners = new Po(this.document), this.listeners = new Po(s), this.windowListeners = new Po(_i(o)), this.initialCoordinates = (i = fu(r)) != null ? i : ha, this.handleStart = this.handleStart.bind(this), this.handleMove = this.handleMove.bind(this), this.handleEnd = this.handleEnd.bind(this), this.handleCancel = this.handleCancel.bind(this), this.handleKeydown = this.handleKeydown.bind(this), this.removeTextSelection = this.removeTextSelection.bind(this), this.attach();
  }
  attach() {
    const {
      events: t,
      props: {
        options: {
          activationConstraint: e,
          bypassActivationConstraint: s
        }
      }
    } = this;
    if (this.listeners.add(t.move.name, this.handleMove, {
      passive: !1
    }), this.listeners.add(t.end.name, this.handleEnd), t.cancel && this.listeners.add(t.cancel.name, this.handleCancel), this.windowListeners.add(On.Resize, this.handleCancel), this.windowListeners.add(On.DragStart, gu), this.windowListeners.add(On.VisibilityChange, this.handleCancel), this.windowListeners.add(On.ContextMenu, gu), this.documentListeners.add(On.Keydown, this.handleKeydown), e) {
      if (s != null && s({
        event: this.props.event,
        activeNode: this.props.activeNode,
        options: this.props.options
      }))
        return this.handleStart();
      if (yu(e)) {
        this.timeoutId = setTimeout(this.handleStart, e.delay), this.handlePending(e);
        return;
      }
      if (_u(e)) {
        this.handlePending(e);
        return;
      }
    }
    this.handleStart();
  }
  detach() {
    this.listeners.removeAll(), this.windowListeners.removeAll(), setTimeout(this.documentListeners.removeAll, 50), this.timeoutId !== null && (clearTimeout(this.timeoutId), this.timeoutId = null);
  }
  handlePending(t, e) {
    const {
      active: s,
      onPending: i
    } = this.props;
    i(s, t, this.initialCoordinates, e);
  }
  handleStart() {
    const {
      initialCoordinates: t
    } = this, {
      onStart: e
    } = this.props;
    t && (this.activated = !0, this.documentListeners.add(On.Click, db, {
      capture: !0
    }), this.removeTextSelection(), this.documentListeners.add(On.SelectionChange, this.removeTextSelection), e(t));
  }
  handleMove(t) {
    var e;
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
    const c = (e = fu(t)) != null ? e : ha, l = ob(i, c);
    if (!s && a) {
      if (_u(a)) {
        if (a.tolerance != null && Fo(l, a.tolerance))
          return this.handleCancel();
        if (Fo(l, a.distance))
          return this.handleStart();
      }
      if (yu(a) && Fo(l, a.tolerance))
        return this.handleCancel();
      this.handlePending(a, l);
      return;
    }
    t.cancelable && t.preventDefault(), o(c);
  }
  handleEnd() {
    const {
      onAbort: t,
      onEnd: e
    } = this.props;
    this.detach(), this.activated || t(this.props.active), e();
  }
  handleCancel() {
    const {
      onAbort: t,
      onCancel: e
    } = this.props;
    this.detach(), this.activated || t(this.props.active), e();
  }
  handleKeydown(t) {
    t.code === Rn.Esc && this.handleCancel();
  }
  removeTextSelection() {
    var t;
    (t = this.document.getSelection()) == null || t.removeAllRanges();
  }
}
const fb = {
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
class Vd extends ll {
  constructor(t) {
    const {
      event: e
    } = t, s = bo(e.target);
    super(t, fb, s);
  }
}
Vd.activators = [{
  eventName: "onPointerDown",
  handler: (n, t) => {
    let {
      nativeEvent: e
    } = n, {
      onActivation: s
    } = t;
    return !e.isPrimary || e.button !== 0 ? !1 : (s?.({
      event: e
    }), !0);
  }
}];
const pb = {
  move: {
    name: "mousemove"
  },
  end: {
    name: "mouseup"
  }
};
var da;
(function(n) {
  n[n.RightClick = 2] = "RightClick";
})(da || (da = {}));
class mb extends ll {
  constructor(t) {
    super(t, pb, bo(t.event.target));
  }
}
mb.activators = [{
  eventName: "onMouseDown",
  handler: (n, t) => {
    let {
      nativeEvent: e
    } = n, {
      onActivation: s
    } = t;
    return e.button === da.RightClick ? !1 : (s?.({
      event: e
    }), !0);
  }
}];
const Vo = {
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
class gb extends ll {
  constructor(t) {
    super(t, Vo);
  }
  static setup() {
    return window.addEventListener(Vo.move.name, t, {
      capture: !1,
      passive: !1
    }), function() {
      window.removeEventListener(Vo.move.name, t);
    };
    function t() {
    }
  }
}
gb.activators = [{
  eventName: "onTouchStart",
  handler: (n, t) => {
    let {
      nativeEvent: e
    } = n, {
      onActivation: s
    } = t;
    const {
      touches: i
    } = e;
    return i.length > 1 ? !1 : (s?.({
      event: e
    }), !0);
  }
}];
var vu;
(function(n) {
  n[n.Pointer = 0] = "Pointer", n[n.DraggableRect = 1] = "DraggableRect";
})(vu || (vu = {}));
var bu;
(function(n) {
  n[n.TreeOrder = 0] = "TreeOrder", n[n.ReversedTreeOrder = 1] = "ReversedTreeOrder";
})(bu || (bu = {}));
Ls.Backward + "", Ls.Forward + "", Ls.Backward + "", Ls.Forward + "";
var fa;
(function(n) {
  n[n.Always = 0] = "Always", n[n.BeforeDragging = 1] = "BeforeDragging", n[n.WhileDragging = 2] = "WhileDragging";
})(fa || (fa = {}));
var pa;
(function(n) {
  n.Optimized = "optimized";
})(pa || (pa = {}));
function _b(n, t) {
  return $i(() => n.reduce((e, s) => {
    let {
      eventName: i,
      handler: r
    } = s;
    return e[i] = (o) => {
      r(o, t);
    }, e;
  }, {}), [n, t]);
}
fa.WhileDragging, pa.Optimized;
const yb = {
  activatorEvent: null,
  activators: [],
  active: null,
  activeNodeRect: null,
  ariaDescribedById: {
    draggable: ""
  },
  dispatch: mu,
  draggableNodes: /* @__PURE__ */ new Map(),
  over: null,
  measureDroppableContainers: mu
}, vb = /* @__PURE__ */ Xe(yb), bb = /* @__PURE__ */ Xe({
  ...ha,
  scaleX: 1,
  scaleY: 1
});
var xu;
(function(n) {
  n[n.Uninitialized = 0] = "Uninitialized", n[n.Initializing = 1] = "Initializing", n[n.Initialized = 2] = "Initialized";
})(xu || (xu = {}));
const xb = /* @__PURE__ */ Xe(null), wu = "button", wb = "Draggable";
function Wo(n) {
  let {
    id: t,
    data: e,
    disabled: s = !1,
    attributes: i
  } = n;
  const r = ib(wb), {
    activators: o,
    activatorEvent: a,
    active: c,
    activeNodeRect: l,
    ariaDescribedById: u,
    draggableNodes: h,
    over: d
  } = je(vb), {
    role: f = wu,
    roleDescription: p = "draggable",
    tabIndex: m = 0
  } = i ?? {}, g = c?.id === t, _ = je(g ? bb : xb), [v, x] = du(), [T, y] = du(), w = _b(o, t), S = sb(e);
  cl(
    () => (h.set(t, {
      id: t,
      key: r,
      node: v,
      activatorNode: T,
      data: S
    }), () => {
      const O = h.get(t);
      O && O.key === r && h.delete(t);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h, t]
  );
  const b = $i(() => ({
    role: f,
    tabIndex: m,
    "aria-disabled": s,
    "aria-pressed": g && f === wu ? !0 : void 0,
    "aria-roledescription": p,
    "aria-describedby": u.draggable
  }), [s, f, m, g, p, u.draggable]);
  return {
    active: c,
    activatorEvent: a,
    activeNodeRect: l,
    attributes: b,
    isDragging: g,
    listeners: s ? void 0 : w,
    node: v,
    over: d,
    setNodeRef: x,
    setActivatorNodeRef: y,
    transform: _
  };
}
const Cb = {
  prefix: "fas",
  iconName: "trash-can",
  icon: [448, 512, [61460, "trash-alt"], "f2ed", "M135.2 17.7C140.6 6.8 151.7 0 163.8 0L284.2 0c12.1 0 23.2 6.8 28.6 17.7L320 32l96 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 7.2-14.3zM32 128l384 0 0 320c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-320zm96 64c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16z"]
}, Sb = Cb, Tb = {
  prefix: "fas",
  iconName: "volume-low",
  icon: [448, 512, [128264, "volume-down"], "f027", "M301.1 34.8C312.6 40 320 51.4 320 64l0 384c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352 64 352c-35.3 0-64-28.7-64-64l0-64c0-35.3 28.7-64 64-64l67.8 0L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3zM412.6 181.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5z"]
}, Ab = Tb, kb = {
  prefix: "fas",
  iconName: "volume-high",
  icon: [640, 512, [128266, "volume-up"], "f028", "M533.6 32.5C598.5 85.2 640 165.8 640 256s-41.5 170.7-106.4 223.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C557.5 398.2 592 331.2 592 256s-34.5-142.2-88.7-186.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM473.1 107c43.2 35.2 70.9 88.9 70.9 149s-27.7 113.8-70.9 149c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C475.3 341.3 496 301.1 496 256s-20.7-85.3-53.2-111.8c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zm-60.5 74.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM301.1 34.8C312.6 40 320 51.4 320 64l0 384c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352 64 352c-35.3 0-64-28.7-64-64l0-64c0-35.3 28.7-64 64-64l67.8 0L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3z"]
}, Ib = kb;
function Eb(n, t, e) {
  return (t = Ob(t)) in n ? Object.defineProperty(n, t, {
    value: e,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : n[t] = e, n;
}
function Cu(n, t) {
  var e = Object.keys(n);
  if (Object.getOwnPropertySymbols) {
    var s = Object.getOwnPropertySymbols(n);
    t && (s = s.filter(function(i) {
      return Object.getOwnPropertyDescriptor(n, i).enumerable;
    })), e.push.apply(e, s);
  }
  return e;
}
function G(n) {
  for (var t = 1; t < arguments.length; t++) {
    var e = arguments[t] != null ? arguments[t] : {};
    t % 2 ? Cu(Object(e), !0).forEach(function(s) {
      Eb(n, s, e[s]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(n, Object.getOwnPropertyDescriptors(e)) : Cu(Object(e)).forEach(function(s) {
      Object.defineProperty(n, s, Object.getOwnPropertyDescriptor(e, s));
    });
  }
  return n;
}
function Db(n, t) {
  if (typeof n != "object" || !n) return n;
  var e = n[Symbol.toPrimitive];
  if (e !== void 0) {
    var s = e.call(n, t);
    if (typeof s != "object") return s;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(n);
}
function Ob(n) {
  var t = Db(n, "string");
  return typeof t == "symbol" ? t : t + "";
}
const Su = () => {
};
let ul = {}, Wd = {}, jd = null, Ld = {
  mark: Su,
  measure: Su
};
try {
  typeof window < "u" && (ul = window), typeof document < "u" && (Wd = document), typeof MutationObserver < "u" && (jd = MutationObserver), typeof performance < "u" && (Ld = performance);
} catch {
}
const {
  userAgent: Tu = ""
} = ul.navigator || {}, ns = ul, $t = Wd, Au = jd, Tr = Ld;
ns.document;
const Bn = !!$t.documentElement && !!$t.head && typeof $t.addEventListener == "function" && typeof $t.createElement == "function", qd = ~Tu.indexOf("MSIE") || ~Tu.indexOf("Trident/");
var Rb = /fa(s|r|l|t|d|dr|dl|dt|b|k|kd|ss|sr|sl|st|sds|sdr|sdl|sdt)?[\-\ ]/, Mb = /Font ?Awesome ?([56 ]*)(Solid|Regular|Light|Thin|Duotone|Brands|Free|Pro|Sharp Duotone|Sharp|Kit)?.*/i, Bd = {
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
}, Nb = {
  GROUP: "duotone-group",
  PRIMARY: "primary",
  SECONDARY: "secondary"
}, $d = ["fa-classic", "fa-duotone", "fa-sharp", "fa-sharp-duotone"], Ce = "classic", xo = "duotone", Pb = "sharp", Fb = "sharp-duotone", zd = [Ce, xo, Pb, Fb], Vb = {
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
}, Wb = {
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
}, jb = /* @__PURE__ */ new Map([["classic", {
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
}]]), Lb = {
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
}, qb = ["fak", "fa-kit", "fakd", "fa-kit-duotone"], ku = {
  kit: {
    fak: "kit",
    "fa-kit": "kit"
  },
  "kit-duotone": {
    fakd: "kit-duotone",
    "fa-kit-duotone": "kit-duotone"
  }
}, Bb = ["kit"], $b = {
  kit: {
    "fa-kit": "fak"
  }
}, zb = ["fak", "fakd"], Gb = {
  kit: {
    fak: "fa-kit"
  }
}, Iu = {
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
}, Zb = ["fa-classic", "fa-duotone", "fa-sharp", "fa-sharp-duotone"], Yb = ["fak", "fa-kit", "fakd", "fa-kit-duotone"], Xb = {
  "Font Awesome Kit": {
    400: "fak",
    normal: "fak"
  },
  "Font Awesome Kit Duotone": {
    400: "fakd",
    normal: "fakd"
  }
}, Ub = {
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
}, Hb = {
  classic: ["fas", "far", "fal", "fat", "fad"],
  duotone: ["fadr", "fadl", "fadt"],
  sharp: ["fass", "fasr", "fasl", "fast"],
  "sharp-duotone": ["fasds", "fasdr", "fasdl", "fasdt"]
}, ma = {
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
}, Kb = ["fa-solid", "fa-regular", "fa-light", "fa-thin", "fa-duotone", "fa-brands"], ga = ["fa", "fas", "far", "fal", "fat", "fad", "fadr", "fadl", "fadt", "fab", "fass", "fasr", "fasl", "fast", "fasds", "fasdr", "fasdl", "fasdt", ...Zb, ...Kb], Qb = ["solid", "regular", "light", "thin", "duotone", "brands"], Gd = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], Jb = Gd.concat([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]), tx = [...Object.keys(Hb), ...Qb, "2xs", "xs", "sm", "lg", "xl", "2xl", "beat", "border", "fade", "beat-fade", "bounce", "flip-both", "flip-horizontal", "flip-vertical", "flip", "fw", "inverse", "layers-counter", "layers-text", "layers", "li", "pull-left", "pull-right", "pulse", "rotate-180", "rotate-270", "rotate-90", "rotate-by", "shake", "spin-pulse", "spin-reverse", "spin", "stack-1x", "stack-2x", "stack", "ul", Ar.GROUP, Ar.SWAP_OPACITY, Ar.PRIMARY, Ar.SECONDARY].concat(Gd.map((n) => "".concat(n, "x"))).concat(Jb.map((n) => "w-".concat(n))), ex = {
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
const Wn = "___FONT_AWESOME___", _a = 16, Zd = "fa", Yd = "svg-inline--fa", xs = "data-fa-i2svg", ya = "data-fa-pseudo-element", nx = "data-fa-pseudo-element-pending", hl = "data-prefix", dl = "data-icon", Eu = "fontawesome-i2svg", sx = "async", ix = ["HTML", "HEAD", "STYLE", "SCRIPT"], Xd = (() => {
  try {
    return process.env.NODE_ENV === "production";
  } catch {
    return !1;
  }
})();
function fr(n) {
  return new Proxy(n, {
    get(t, e) {
      return e in t ? t[e] : t[Ce];
    }
  });
}
const Ud = G({}, Bd);
Ud[Ce] = G(G(G(G({}, {
  "fa-duotone": "duotone"
}), Bd[Ce]), ku.kit), ku["kit-duotone"]);
const rx = fr(Ud), va = G({}, Lb);
va[Ce] = G(G(G(G({}, {
  duotone: "fad"
}), va[Ce]), Iu.kit), Iu["kit-duotone"]);
const Du = fr(va), ba = G({}, ma);
ba[Ce] = G(G({}, ba[Ce]), Gb.kit);
const fl = fr(ba), xa = G({}, Ub);
xa[Ce] = G(G({}, xa[Ce]), $b.kit);
fr(xa);
const ox = Rb, Hd = "fa-layers-text", ax = Mb, cx = G({}, Vb);
fr(cx);
const lx = ["class", "data-prefix", "data-icon", "data-fa-transform", "data-fa-mask"], jo = Nb, ux = [...Bb, ...tx], Oi = ns.FontAwesomeConfig || {};
function hx(n) {
  var t = $t.querySelector("script[" + n + "]");
  if (t)
    return t.getAttribute(n);
}
function dx(n) {
  return n === "" ? !0 : n === "false" ? !1 : n === "true" ? !0 : n;
}
$t && typeof $t.querySelector == "function" && [["data-family-prefix", "familyPrefix"], ["data-css-prefix", "cssPrefix"], ["data-family-default", "familyDefault"], ["data-style-default", "styleDefault"], ["data-replacement-class", "replacementClass"], ["data-auto-replace-svg", "autoReplaceSvg"], ["data-auto-add-css", "autoAddCss"], ["data-auto-a11y", "autoA11y"], ["data-search-pseudo-elements", "searchPseudoElements"], ["data-observe-mutations", "observeMutations"], ["data-mutate-approach", "mutateApproach"], ["data-keep-original-source", "keepOriginalSource"], ["data-measure-performance", "measurePerformance"], ["data-show-missing-icons", "showMissingIcons"]].forEach((t) => {
  let [e, s] = t;
  const i = dx(hx(e));
  i != null && (Oi[s] = i);
});
const Kd = {
  styleDefault: "solid",
  familyDefault: Ce,
  cssPrefix: Zd,
  replacementClass: Yd,
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
Oi.familyPrefix && (Oi.cssPrefix = Oi.familyPrefix);
const Qs = G(G({}, Kd), Oi);
Qs.autoReplaceSvg || (Qs.observeMutations = !1);
const it = {};
Object.keys(Kd).forEach((n) => {
  Object.defineProperty(it, n, {
    enumerable: !0,
    set: function(t) {
      Qs[n] = t, Ri.forEach((e) => e(it));
    },
    get: function() {
      return Qs[n];
    }
  });
});
Object.defineProperty(it, "familyPrefix", {
  enumerable: !0,
  set: function(n) {
    Qs.cssPrefix = n, Ri.forEach((t) => t(it));
  },
  get: function() {
    return Qs.cssPrefix;
  }
});
ns.FontAwesomeConfig = it;
const Ri = [];
function fx(n) {
  return Ri.push(n), () => {
    Ri.splice(Ri.indexOf(n), 1);
  };
}
const Zn = _a, vn = {
  size: 16,
  x: 0,
  y: 0,
  rotate: 0,
  flipX: !1,
  flipY: !1
};
function px(n) {
  if (!n || !Bn)
    return;
  const t = $t.createElement("style");
  t.setAttribute("type", "text/css"), t.innerHTML = n;
  const e = $t.head.childNodes;
  let s = null;
  for (let i = e.length - 1; i > -1; i--) {
    const r = e[i], o = (r.tagName || "").toUpperCase();
    ["STYLE", "LINK"].indexOf(o) > -1 && (s = r);
  }
  return $t.head.insertBefore(t, s), n;
}
const mx = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function qi() {
  let n = 12, t = "";
  for (; n-- > 0; )
    t += mx[Math.random() * 62 | 0];
  return t;
}
function yi(n) {
  const t = [];
  for (let e = (n || []).length >>> 0; e--; )
    t[e] = n[e];
  return t;
}
function pl(n) {
  return n.classList ? yi(n.classList) : (n.getAttribute("class") || "").split(" ").filter((t) => t);
}
function Qd(n) {
  return "".concat(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function gx(n) {
  return Object.keys(n || {}).reduce((t, e) => t + "".concat(e, '="').concat(Qd(n[e]), '" '), "").trim();
}
function wo(n) {
  return Object.keys(n || {}).reduce((t, e) => t + "".concat(e, ": ").concat(n[e].trim(), ";"), "");
}
function ml(n) {
  return n.size !== vn.size || n.x !== vn.x || n.y !== vn.y || n.rotate !== vn.rotate || n.flipX || n.flipY;
}
function _x(n) {
  let {
    transform: t,
    containerWidth: e,
    iconWidth: s
  } = n;
  const i = {
    transform: "translate(".concat(e / 2, " 256)")
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
function yx(n) {
  let {
    transform: t,
    width: e = _a,
    height: s = _a,
    startCentered: i = !1
  } = n, r = "";
  return i && qd ? r += "translate(".concat(t.x / Zn - e / 2, "em, ").concat(t.y / Zn - s / 2, "em) ") : i ? r += "translate(calc(-50% + ".concat(t.x / Zn, "em), calc(-50% + ").concat(t.y / Zn, "em)) ") : r += "translate(".concat(t.x / Zn, "em, ").concat(t.y / Zn, "em) "), r += "scale(".concat(t.size / Zn * (t.flipX ? -1 : 1), ", ").concat(t.size / Zn * (t.flipY ? -1 : 1), ") "), r += "rotate(".concat(t.rotate, "deg) "), r;
}
var vx = `:root, :host {
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
function Jd() {
  const n = Zd, t = Yd, e = it.cssPrefix, s = it.replacementClass;
  let i = vx;
  if (e !== n || s !== t) {
    const r = new RegExp("\\.".concat(n, "\\-"), "g"), o = new RegExp("\\--".concat(n, "\\-"), "g"), a = new RegExp("\\.".concat(t), "g");
    i = i.replace(r, ".".concat(e, "-")).replace(o, "--".concat(e, "-")).replace(a, ".".concat(s));
  }
  return i;
}
let Ou = !1;
function Lo() {
  it.autoAddCss && !Ou && (px(Jd()), Ou = !0);
}
var bx = {
  mixout() {
    return {
      dom: {
        css: Jd,
        insertCss: Lo
      }
    };
  },
  hooks() {
    return {
      beforeDOMElementCreation() {
        Lo();
      },
      beforeI2svg() {
        Lo();
      }
    };
  }
};
const jn = ns || {};
jn[Wn] || (jn[Wn] = {});
jn[Wn].styles || (jn[Wn].styles = {});
jn[Wn].hooks || (jn[Wn].hooks = {});
jn[Wn].shims || (jn[Wn].shims = []);
var bn = jn[Wn];
const tf = [], ef = function() {
  $t.removeEventListener("DOMContentLoaded", ef), Xr = 1, tf.map((n) => n());
};
let Xr = !1;
Bn && (Xr = ($t.documentElement.doScroll ? /^loaded|^c/ : /^loaded|^i|^c/).test($t.readyState), Xr || $t.addEventListener("DOMContentLoaded", ef));
function xx(n) {
  Bn && (Xr ? setTimeout(n, 0) : tf.push(n));
}
function pr(n) {
  const {
    tag: t,
    attributes: e = {},
    children: s = []
  } = n;
  return typeof n == "string" ? Qd(n) : "<".concat(t, " ").concat(gx(e), ">").concat(s.map(pr).join(""), "</").concat(t, ">");
}
function Ru(n, t, e) {
  if (n && n[t] && n[t][e])
    return {
      prefix: t,
      iconName: e,
      icon: n[t][e]
    };
}
var qo = function(t, e, s, i) {
  var r = Object.keys(t), o = r.length, a = e, c, l, u;
  for (s === void 0 ? (c = 1, u = t[r[0]]) : (c = 0, u = s); c < o; c++)
    l = r[c], u = a(u, t[l], l, t);
  return u;
};
function wx(n) {
  const t = [];
  let e = 0;
  const s = n.length;
  for (; e < s; ) {
    const i = n.charCodeAt(e++);
    if (i >= 55296 && i <= 56319 && e < s) {
      const r = n.charCodeAt(e++);
      (r & 64512) == 56320 ? t.push(((i & 1023) << 10) + (r & 1023) + 65536) : (t.push(i), e--);
    } else
      t.push(i);
  }
  return t;
}
function wa(n) {
  const t = wx(n);
  return t.length === 1 ? t[0].toString(16) : null;
}
function Cx(n, t) {
  const e = n.length;
  let s = n.charCodeAt(t), i;
  return s >= 55296 && s <= 56319 && e > t + 1 && (i = n.charCodeAt(t + 1), i >= 56320 && i <= 57343) ? (s - 55296) * 1024 + i - 56320 + 65536 : s;
}
function Mu(n) {
  return Object.keys(n).reduce((t, e) => {
    const s = n[e];
    return !!s.icon ? t[s.iconName] = s.icon : t[e] = s, t;
  }, {});
}
function Ca(n, t) {
  let e = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
  const {
    skipHooks: s = !1
  } = e, i = Mu(t);
  typeof bn.hooks.addPack == "function" && !s ? bn.hooks.addPack(n, Mu(t)) : bn.styles[n] = G(G({}, bn.styles[n] || {}), i), n === "fas" && Ca("fa", t);
}
const {
  styles: Bi,
  shims: Sx
} = bn, nf = Object.keys(fl), Tx = nf.reduce((n, t) => (n[t] = Object.keys(fl[t]), n), {});
let gl = null, sf = {}, rf = {}, of = {}, af = {}, cf = {};
function Ax(n) {
  return ~ux.indexOf(n);
}
function kx(n, t) {
  const e = t.split("-"), s = e[0], i = e.slice(1).join("-");
  return s === n && i !== "" && !Ax(i) ? i : null;
}
const lf = () => {
  const n = (s) => qo(Bi, (i, r, o) => (i[o] = qo(r, s, {}), i), {});
  sf = n((s, i, r) => (i[3] && (s[i[3]] = r), i[2] && i[2].filter((a) => typeof a == "number").forEach((a) => {
    s[a.toString(16)] = r;
  }), s)), rf = n((s, i, r) => (s[r] = r, i[2] && i[2].filter((a) => typeof a == "string").forEach((a) => {
    s[a] = r;
  }), s)), cf = n((s, i, r) => {
    const o = i[2];
    return s[r] = r, o.forEach((a) => {
      s[a] = r;
    }), s;
  });
  const t = "far" in Bi || it.autoFetchSvg, e = qo(Sx, (s, i) => {
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
  of = e.names, af = e.unicodes, gl = Co(it.styleDefault, {
    family: it.familyDefault
  });
};
fx((n) => {
  gl = Co(n.styleDefault, {
    family: it.familyDefault
  });
});
lf();
function _l(n, t) {
  return (sf[n] || {})[t];
}
function Ix(n, t) {
  return (rf[n] || {})[t];
}
function ys(n, t) {
  return (cf[n] || {})[t];
}
function uf(n) {
  return of[n] || {
    prefix: null,
    iconName: null
  };
}
function Ex(n) {
  const t = af[n], e = _l("fas", n);
  return t || (e ? {
    prefix: "fas",
    iconName: e
  } : null) || {
    prefix: null,
    iconName: null
  };
}
function ss() {
  return gl;
}
const hf = () => ({
  prefix: null,
  iconName: null,
  rest: []
});
function Dx(n) {
  let t = Ce;
  const e = nf.reduce((s, i) => (s[i] = "".concat(it.cssPrefix, "-").concat(i), s), {});
  return zd.forEach((s) => {
    (n.includes(e[s]) || n.some((i) => Tx[s].includes(i))) && (t = s);
  }), t;
}
function Co(n) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  const {
    family: e = Ce
  } = t, s = rx[e][n];
  if (e === xo && !n)
    return "fad";
  const i = Du[e][n] || Du[e][s], r = n in bn.styles ? n : null;
  return i || r || null;
}
function Ox(n) {
  let t = [], e = null;
  return n.forEach((s) => {
    const i = kx(it.cssPrefix, s);
    i ? e = i : s && t.push(s);
  }), {
    iconName: e,
    rest: t
  };
}
function Nu(n) {
  return n.sort().filter((t, e, s) => s.indexOf(t) === e);
}
function So(n) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  const {
    skipLookups: e = !1
  } = t;
  let s = null;
  const i = ga.concat(Yb), r = Nu(n.filter((h) => i.includes(h))), o = Nu(n.filter((h) => !ga.includes(h))), a = r.filter((h) => (s = h, !$d.includes(h))), [c = null] = a, l = Dx(r), u = G(G({}, Ox(o)), {}, {
    prefix: Co(c, {
      family: l
    })
  });
  return G(G(G({}, u), Px({
    values: n,
    family: l,
    styles: Bi,
    config: it,
    canonical: u,
    givenPrefix: s
  })), Rx(e, s, u));
}
function Rx(n, t, e) {
  let {
    prefix: s,
    iconName: i
  } = e;
  if (n || !s || !i)
    return {
      prefix: s,
      iconName: i
    };
  const r = t === "fa" ? uf(i) : {}, o = ys(s, i);
  return i = r.iconName || o || i, s = r.prefix || s, s === "far" && !Bi.far && Bi.fas && !it.autoFetchSvg && (s = "fas"), {
    prefix: s,
    iconName: i
  };
}
const Mx = zd.filter((n) => n !== Ce || n !== xo), Nx = Object.keys(ma).filter((n) => n !== Ce).map((n) => Object.keys(ma[n])).flat();
function Px(n) {
  const {
    values: t,
    family: e,
    canonical: s,
    givenPrefix: i = "",
    styles: r = {},
    config: o = {}
  } = n, a = e === xo, c = t.includes("fa-duotone") || t.includes("fad"), l = o.familyDefault === "duotone", u = s.prefix === "fad" || s.prefix === "fa-duotone";
  if (!a && (c || l || u) && (s.prefix = "fad"), (t.includes("fa-brands") || t.includes("fab")) && (s.prefix = "fab"), !s.prefix && Mx.includes(e) && (Object.keys(r).find((d) => Nx.includes(d)) || o.autoFetchSvg)) {
    const d = jb.get(e).defaultShortPrefixId;
    s.prefix = d, s.iconName = ys(s.prefix, s.iconName) || s.iconName;
  }
  return (s.prefix === "fa" || i === "fa") && (s.prefix = ss() || "fas"), s;
}
class Fx {
  constructor() {
    this.definitions = {};
  }
  add() {
    for (var t = arguments.length, e = new Array(t), s = 0; s < t; s++)
      e[s] = arguments[s];
    const i = e.reduce(this._pullDefinitions, {});
    Object.keys(i).forEach((r) => {
      this.definitions[r] = G(G({}, this.definitions[r] || {}), i[r]), Ca(r, i[r]);
      const o = fl[Ce][r];
      o && Ca(o, i[r]), lf();
    });
  }
  reset() {
    this.definitions = {};
  }
  _pullDefinitions(t, e) {
    const s = e.prefix && e.iconName && e.icon ? {
      0: e
    } : e;
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
let Pu = [], qs = {};
const Bs = {}, Vx = Object.keys(Bs);
function Wx(n, t) {
  let {
    mixoutsTo: e
  } = t;
  return Pu = n, qs = {}, Object.keys(Bs).forEach((s) => {
    Vx.indexOf(s) === -1 && delete Bs[s];
  }), Pu.forEach((s) => {
    const i = s.mixout ? s.mixout() : {};
    if (Object.keys(i).forEach((r) => {
      typeof i[r] == "function" && (e[r] = i[r]), typeof i[r] == "object" && Object.keys(i[r]).forEach((o) => {
        e[r] || (e[r] = {}), e[r][o] = i[r][o];
      });
    }), s.hooks) {
      const r = s.hooks();
      Object.keys(r).forEach((o) => {
        qs[o] || (qs[o] = []), qs[o].push(r[o]);
      });
    }
    s.provides && s.provides(Bs);
  }), e;
}
function Sa(n, t) {
  for (var e = arguments.length, s = new Array(e > 2 ? e - 2 : 0), i = 2; i < e; i++)
    s[i - 2] = arguments[i];
  return (qs[n] || []).forEach((o) => {
    t = o.apply(null, [t, ...s]);
  }), t;
}
function ws(n) {
  for (var t = arguments.length, e = new Array(t > 1 ? t - 1 : 0), s = 1; s < t; s++)
    e[s - 1] = arguments[s];
  (qs[n] || []).forEach((r) => {
    r.apply(null, e);
  });
}
function is() {
  const n = arguments[0], t = Array.prototype.slice.call(arguments, 1);
  return Bs[n] ? Bs[n].apply(null, t) : void 0;
}
function Ta(n) {
  n.prefix === "fa" && (n.prefix = "fas");
  let {
    iconName: t
  } = n;
  const e = n.prefix || ss();
  if (t)
    return t = ys(e, t) || t, Ru(df.definitions, e, t) || Ru(bn.styles, e, t);
}
const df = new Fx(), jx = () => {
  it.autoReplaceSvg = !1, it.observeMutations = !1, ws("noAuto");
}, Lx = {
  i2svg: function() {
    let n = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    return Bn ? (ws("beforeI2svg", n), is("pseudoElements2svg", n), is("i2svg", n)) : Promise.reject(new Error("Operation requires a DOM of some kind."));
  },
  watch: function() {
    let n = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    const {
      autoReplaceSvgRoot: t
    } = n;
    it.autoReplaceSvg === !1 && (it.autoReplaceSvg = !0), it.observeMutations = !0, xx(() => {
      Bx({
        autoReplaceSvgRoot: t
      }), ws("watch", n);
    });
  }
}, qx = {
  icon: (n) => {
    if (n === null)
      return null;
    if (typeof n == "object" && n.prefix && n.iconName)
      return {
        prefix: n.prefix,
        iconName: ys(n.prefix, n.iconName) || n.iconName
      };
    if (Array.isArray(n) && n.length === 2) {
      const t = n[1].indexOf("fa-") === 0 ? n[1].slice(3) : n[1], e = Co(n[0]);
      return {
        prefix: e,
        iconName: ys(e, t) || t
      };
    }
    if (typeof n == "string" && (n.indexOf("".concat(it.cssPrefix, "-")) > -1 || n.match(ox))) {
      const t = So(n.split(" "), {
        skipLookups: !0
      });
      return {
        prefix: t.prefix || ss(),
        iconName: ys(t.prefix, t.iconName) || t.iconName
      };
    }
    if (typeof n == "string") {
      const t = ss();
      return {
        prefix: t,
        iconName: ys(t, n) || n
      };
    }
  }
}, Ue = {
  noAuto: jx,
  config: it,
  dom: Lx,
  parse: qx,
  library: df,
  findIconDefinition: Ta,
  toHtml: pr
}, Bx = function() {
  let n = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
  const {
    autoReplaceSvgRoot: t = $t
  } = n;
  (Object.keys(bn.styles).length > 0 || it.autoFetchSvg) && Bn && it.autoReplaceSvg && Ue.dom.i2svg({
    node: t
  });
};
function To(n, t) {
  return Object.defineProperty(n, "abstract", {
    get: t
  }), Object.defineProperty(n, "html", {
    get: function() {
      return n.abstract.map((e) => pr(e));
    }
  }), Object.defineProperty(n, "node", {
    get: function() {
      if (!Bn) return;
      const e = $t.createElement("div");
      return e.innerHTML = n.html, e.children;
    }
  }), n;
}
function $x(n) {
  let {
    children: t,
    main: e,
    mask: s,
    attributes: i,
    styles: r,
    transform: o
  } = n;
  if (ml(o) && e.found && !s.found) {
    const {
      width: a,
      height: c
    } = e, l = {
      x: a / c / 2,
      y: 0.5
    };
    i.style = wo(G(G({}, r), {}, {
      "transform-origin": "".concat(l.x + o.x / 16, "em ").concat(l.y + o.y / 16, "em")
    }));
  }
  return [{
    tag: "svg",
    attributes: i,
    children: t
  }];
}
function zx(n) {
  let {
    prefix: t,
    iconName: e,
    children: s,
    attributes: i,
    symbol: r
  } = n;
  const o = r === !0 ? "".concat(t, "-").concat(it.cssPrefix, "-").concat(e) : r;
  return [{
    tag: "svg",
    attributes: {
      style: "display: none;"
    },
    children: [{
      tag: "symbol",
      attributes: G(G({}, i), {}, {
        id: o
      }),
      children: s
    }]
  }];
}
function yl(n) {
  const {
    icons: {
      main: t,
      mask: e
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
  } = n, {
    width: d,
    height: f
  } = e.found ? e : t, p = zb.includes(s), m = [it.replacementClass, i ? "".concat(it.cssPrefix, "-").concat(i) : ""].filter((y) => u.classes.indexOf(y) === -1).filter((y) => y !== "" || !!y).concat(u.classes).join(" ");
  let g = {
    children: [],
    attributes: G(G({}, u.attributes), {}, {
      "data-prefix": s,
      "data-icon": i,
      class: m,
      role: u.attributes.role || "img",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 ".concat(d, " ").concat(f)
    })
  };
  const _ = p && !~u.classes.indexOf("fa-fw") ? {
    width: "".concat(d / f * 16 * 0.0625, "em")
  } : {};
  h && (g.attributes[xs] = ""), a && (g.children.push({
    tag: "title",
    attributes: {
      id: g.attributes["aria-labelledby"] || "title-".concat(l || qi())
    },
    children: [a]
  }), delete g.attributes.title);
  const v = G(G({}, g), {}, {
    prefix: s,
    iconName: i,
    main: t,
    mask: e,
    maskId: c,
    transform: r,
    symbol: o,
    styles: G(G({}, _), u.styles)
  }), {
    children: x,
    attributes: T
  } = e.found && t.found ? is("generateAbstractMask", v) || {
    children: [],
    attributes: {}
  } : is("generateAbstractIcon", v) || {
    children: [],
    attributes: {}
  };
  return v.children = x, v.attributes = T, o ? zx(v) : $x(v);
}
function Fu(n) {
  const {
    content: t,
    width: e,
    height: s,
    transform: i,
    title: r,
    extra: o,
    watchable: a = !1
  } = n, c = G(G(G({}, o.attributes), r ? {
    title: r
  } : {}), {}, {
    class: o.classes.join(" ")
  });
  a && (c[xs] = "");
  const l = G({}, o.styles);
  ml(i) && (l.transform = yx({
    transform: i,
    startCentered: !0,
    width: e,
    height: s
  }), l["-webkit-transform"] = l.transform);
  const u = wo(l);
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
function Gx(n) {
  const {
    content: t,
    title: e,
    extra: s
  } = n, i = G(G(G({}, s.attributes), e ? {
    title: e
  } : {}), {}, {
    class: s.classes.join(" ")
  }), r = wo(s.styles);
  r.length > 0 && (i.style = r);
  const o = [];
  return o.push({
    tag: "span",
    attributes: i,
    children: [t]
  }), e && o.push({
    tag: "span",
    attributes: {
      class: "sr-only"
    },
    children: [e]
  }), o;
}
const {
  styles: Bo
} = bn;
function Aa(n) {
  const t = n[0], e = n[1], [s] = n.slice(4);
  let i = null;
  return Array.isArray(s) ? i = {
    tag: "g",
    attributes: {
      class: "".concat(it.cssPrefix, "-").concat(jo.GROUP)
    },
    children: [{
      tag: "path",
      attributes: {
        class: "".concat(it.cssPrefix, "-").concat(jo.SECONDARY),
        fill: "currentColor",
        d: s[0]
      }
    }, {
      tag: "path",
      attributes: {
        class: "".concat(it.cssPrefix, "-").concat(jo.PRIMARY),
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
    height: e,
    icon: i
  };
}
const Zx = {
  found: !1,
  width: 512,
  height: 512
};
function Yx(n, t) {
  !Xd && !it.showMissingIcons && n && console.error('Icon with name "'.concat(n, '" and prefix "').concat(t, '" is missing.'));
}
function ka(n, t) {
  let e = t;
  return t === "fa" && it.styleDefault !== null && (t = ss()), new Promise((s, i) => {
    if (e === "fa") {
      const r = uf(n) || {};
      n = r.iconName || n, t = r.prefix || t;
    }
    if (n && t && Bo[t] && Bo[t][n]) {
      const r = Bo[t][n];
      return s(Aa(r));
    }
    Yx(n, t), s(G(G({}, Zx), {}, {
      icon: it.showMissingIcons && n ? is("missingIconAbstract") || {} : {}
    }));
  });
}
const Vu = () => {
}, Ia = it.measurePerformance && Tr && Tr.mark && Tr.measure ? Tr : {
  mark: Vu,
  measure: Vu
}, Ei = 'FA "6.7.2"', Xx = (n) => (Ia.mark("".concat(Ei, " ").concat(n, " begins")), () => ff(n)), ff = (n) => {
  Ia.mark("".concat(Ei, " ").concat(n, " ends")), Ia.measure("".concat(Ei, " ").concat(n), "".concat(Ei, " ").concat(n, " begins"), "".concat(Ei, " ").concat(n, " ends"));
};
var vl = {
  begin: Xx,
  end: ff
};
const Rr = () => {
};
function Wu(n) {
  return typeof (n.getAttribute ? n.getAttribute(xs) : null) == "string";
}
function Ux(n) {
  const t = n.getAttribute ? n.getAttribute(hl) : null, e = n.getAttribute ? n.getAttribute(dl) : null;
  return t && e;
}
function Hx(n) {
  return n && n.classList && n.classList.contains && n.classList.contains(it.replacementClass);
}
function Kx() {
  return it.autoReplaceSvg === !0 ? Mr.replace : Mr[it.autoReplaceSvg] || Mr.replace;
}
function Qx(n) {
  return $t.createElementNS("http://www.w3.org/2000/svg", n);
}
function Jx(n) {
  return $t.createElement(n);
}
function pf(n) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  const {
    ceFn: e = n.tag === "svg" ? Qx : Jx
  } = t;
  if (typeof n == "string")
    return $t.createTextNode(n);
  const s = e(n.tag);
  return Object.keys(n.attributes || []).forEach(function(r) {
    s.setAttribute(r, n.attributes[r]);
  }), (n.children || []).forEach(function(r) {
    s.appendChild(pf(r, {
      ceFn: e
    }));
  }), s;
}
function tw(n) {
  let t = " ".concat(n.outerHTML, " ");
  return t = "".concat(t, "Font Awesome fontawesome.com "), t;
}
const Mr = {
  replace: function(n) {
    const t = n[0];
    if (t.parentNode)
      if (n[1].forEach((e) => {
        t.parentNode.insertBefore(pf(e), t);
      }), t.getAttribute(xs) === null && it.keepOriginalSource) {
        let e = $t.createComment(tw(t));
        t.parentNode.replaceChild(e, t);
      } else
        t.remove();
  },
  nest: function(n) {
    const t = n[0], e = n[1];
    if (~pl(t).indexOf(it.replacementClass))
      return Mr.replace(n);
    const s = new RegExp("".concat(it.cssPrefix, "-.*"));
    if (delete e[0].attributes.id, e[0].attributes.class) {
      const r = e[0].attributes.class.split(" ").reduce((o, a) => (a === it.replacementClass || a.match(s) ? o.toSvg.push(a) : o.toNode.push(a), o), {
        toNode: [],
        toSvg: []
      });
      e[0].attributes.class = r.toSvg.join(" "), r.toNode.length === 0 ? t.removeAttribute("class") : t.setAttribute("class", r.toNode.join(" "));
    }
    const i = e.map((r) => pr(r)).join(`
`);
    t.setAttribute(xs, ""), t.innerHTML = i;
  }
};
function ju(n) {
  n();
}
function mf(n, t) {
  const e = typeof t == "function" ? t : Rr;
  if (n.length === 0)
    e();
  else {
    let s = ju;
    it.mutateApproach === sx && (s = ns.requestAnimationFrame || ju), s(() => {
      const i = Kx(), r = vl.begin("mutate");
      n.map(i), r(), e();
    });
  }
}
let bl = !1;
function gf() {
  bl = !0;
}
function Ea() {
  bl = !1;
}
let Ur = null;
function Lu(n) {
  if (!Au || !it.observeMutations)
    return;
  const {
    treeCallback: t = Rr,
    nodeCallback: e = Rr,
    pseudoElementsCallback: s = Rr,
    observeMutationsRoot: i = $t
  } = n;
  Ur = new Au((r) => {
    if (bl) return;
    const o = ss();
    yi(r).forEach((a) => {
      if (a.type === "childList" && a.addedNodes.length > 0 && !Wu(a.addedNodes[0]) && (it.searchPseudoElements && s(a.target), t(a.target)), a.type === "attributes" && a.target.parentNode && it.searchPseudoElements && s(a.target.parentNode), a.type === "attributes" && Wu(a.target) && ~lx.indexOf(a.attributeName))
        if (a.attributeName === "class" && Ux(a.target)) {
          const {
            prefix: c,
            iconName: l
          } = So(pl(a.target));
          a.target.setAttribute(hl, c || o), l && a.target.setAttribute(dl, l);
        } else Hx(a.target) && e(a.target);
    });
  }), Bn && Ur.observe(i, {
    childList: !0,
    attributes: !0,
    characterData: !0,
    subtree: !0
  });
}
function ew() {
  Ur && Ur.disconnect();
}
function nw(n) {
  const t = n.getAttribute("style");
  let e = [];
  return t && (e = t.split(";").reduce((s, i) => {
    const r = i.split(":"), o = r[0], a = r.slice(1);
    return o && a.length > 0 && (s[o] = a.join(":").trim()), s;
  }, {})), e;
}
function sw(n) {
  const t = n.getAttribute("data-prefix"), e = n.getAttribute("data-icon"), s = n.innerText !== void 0 ? n.innerText.trim() : "";
  let i = So(pl(n));
  return i.prefix || (i.prefix = ss()), t && e && (i.prefix = t, i.iconName = e), i.iconName && i.prefix || (i.prefix && s.length > 0 && (i.iconName = Ix(i.prefix, n.innerText) || _l(i.prefix, wa(n.innerText))), !i.iconName && it.autoFetchSvg && n.firstChild && n.firstChild.nodeType === Node.TEXT_NODE && (i.iconName = n.firstChild.data)), i;
}
function iw(n) {
  const t = yi(n.attributes).reduce((i, r) => (i.name !== "class" && i.name !== "style" && (i[r.name] = r.value), i), {}), e = n.getAttribute("title"), s = n.getAttribute("data-fa-title-id");
  return it.autoA11y && (e ? t["aria-labelledby"] = "".concat(it.replacementClass, "-title-").concat(s || qi()) : (t["aria-hidden"] = "true", t.focusable = "false")), t;
}
function rw() {
  return {
    iconName: null,
    title: null,
    titleId: null,
    prefix: null,
    transform: vn,
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
function qu(n) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {
    styleParser: !0
  };
  const {
    iconName: e,
    prefix: s,
    rest: i
  } = sw(n), r = iw(n), o = Sa("parseNodeAttributes", {}, n);
  let a = t.styleParser ? nw(n) : [];
  return G({
    iconName: e,
    title: n.getAttribute("title"),
    titleId: n.getAttribute("data-fa-title-id"),
    prefix: s,
    transform: vn,
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
  styles: ow
} = bn;
function _f(n) {
  const t = it.autoReplaceSvg === "nest" ? qu(n, {
    styleParser: !1
  }) : qu(n);
  return ~t.extra.classes.indexOf(Hd) ? is("generateLayersText", n, t) : is("generateSvgReplacementMutation", n, t);
}
function aw() {
  return [...qb, ...ga];
}
function Bu(n) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
  if (!Bn) return Promise.resolve();
  const e = $t.documentElement.classList, s = (u) => e.add("".concat(Eu, "-").concat(u)), i = (u) => e.remove("".concat(Eu, "-").concat(u)), r = it.autoFetchSvg ? aw() : $d.concat(Object.keys(ow));
  r.includes("fa") || r.push("fa");
  const o = [".".concat(Hd, ":not([").concat(xs, "])")].concat(r.map((u) => ".".concat(u, ":not([").concat(xs, "])"))).join(", ");
  if (o.length === 0)
    return Promise.resolve();
  let a = [];
  try {
    a = yi(n.querySelectorAll(o));
  } catch {
  }
  if (a.length > 0)
    s("pending"), i("complete");
  else
    return Promise.resolve();
  const c = vl.begin("onTree"), l = a.reduce((u, h) => {
    try {
      const d = _f(h);
      d && u.push(d);
    } catch (d) {
      Xd || d.name === "MissingIcon" && console.error(d);
    }
    return u;
  }, []);
  return new Promise((u, h) => {
    Promise.all(l).then((d) => {
      mf(d, () => {
        s("active"), s("complete"), i("pending"), typeof t == "function" && t(), c(), u();
      });
    }).catch((d) => {
      c(), h(d);
    });
  });
}
function cw(n) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
  _f(n).then((e) => {
    e && mf([e], t);
  });
}
function lw(n) {
  return function(t) {
    let e = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    const s = (t || {}).icon ? t : Ta(t || {});
    let {
      mask: i
    } = e;
    return i && (i = (i || {}).icon ? i : Ta(i || {})), n(s, G(G({}, e), {}, {
      mask: i
    }));
  };
}
const uw = function(n) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  const {
    transform: e = vn,
    symbol: s = !1,
    mask: i = null,
    maskId: r = null,
    title: o = null,
    titleId: a = null,
    classes: c = [],
    attributes: l = {},
    styles: u = {}
  } = t;
  if (!n) return;
  const {
    prefix: h,
    iconName: d,
    icon: f
  } = n;
  return To(G({
    type: "icon"
  }, n), () => (ws("beforeDOMElementCreation", {
    iconDefinition: n,
    params: t
  }), it.autoA11y && (o ? l["aria-labelledby"] = "".concat(it.replacementClass, "-title-").concat(a || qi()) : (l["aria-hidden"] = "true", l.focusable = "false")), yl({
    icons: {
      main: Aa(f),
      mask: i ? Aa(i.icon) : {
        found: !1,
        width: null,
        height: null,
        icon: {}
      }
    },
    prefix: h,
    iconName: d,
    transform: G(G({}, vn), e),
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
var hw = {
  mixout() {
    return {
      icon: lw(uw)
    };
  },
  hooks() {
    return {
      mutationObserverCallbacks(n) {
        return n.treeCallback = Bu, n.nodeCallback = cw, n;
      }
    };
  },
  provides(n) {
    n.i2svg = function(t) {
      const {
        node: e = $t,
        callback: s = () => {
        }
      } = t;
      return Bu(e, s);
    }, n.generateSvgReplacementMutation = function(t, e) {
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
      } = e;
      return new Promise((d, f) => {
        Promise.all([ka(s, o), l.iconName ? ka(l.iconName, l.prefix) : Promise.resolve({
          found: !1,
          width: 512,
          height: 512,
          icon: {}
        })]).then((p) => {
          let [m, g] = p;
          d([t, yl({
            icons: {
              main: m,
              mask: g
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
        }).catch(f);
      });
    }, n.generateAbstractIcon = function(t) {
      let {
        children: e,
        attributes: s,
        main: i,
        transform: r,
        styles: o
      } = t;
      const a = wo(o);
      a.length > 0 && (s.style = a);
      let c;
      return ml(r) && (c = is("generateAbstractTransformGrouping", {
        main: i,
        transform: r,
        containerWidth: i.width,
        iconWidth: i.width
      })), e.push(c || i.icon), {
        children: e,
        attributes: s
      };
    };
  }
}, dw = {
  mixout() {
    return {
      layer(n) {
        let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        const {
          classes: e = []
        } = t;
        return To({
          type: "layer"
        }, () => {
          ws("beforeDOMElementCreation", {
            assembler: n,
            params: t
          });
          let s = [];
          return n((i) => {
            Array.isArray(i) ? i.map((r) => {
              s = s.concat(r.abstract);
            }) : s = s.concat(i.abstract);
          }), [{
            tag: "span",
            attributes: {
              class: ["".concat(it.cssPrefix, "-layers"), ...e].join(" ")
            },
            children: s
          }];
        });
      }
    };
  }
}, fw = {
  mixout() {
    return {
      counter(n) {
        let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        const {
          title: e = null,
          classes: s = [],
          attributes: i = {},
          styles: r = {}
        } = t;
        return To({
          type: "counter",
          content: n
        }, () => (ws("beforeDOMElementCreation", {
          content: n,
          params: t
        }), Gx({
          content: n.toString(),
          title: e,
          extra: {
            attributes: i,
            styles: r,
            classes: ["".concat(it.cssPrefix, "-layers-counter"), ...s]
          }
        })));
      }
    };
  }
}, pw = {
  mixout() {
    return {
      text(n) {
        let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        const {
          transform: e = vn,
          title: s = null,
          classes: i = [],
          attributes: r = {},
          styles: o = {}
        } = t;
        return To({
          type: "text",
          content: n
        }, () => (ws("beforeDOMElementCreation", {
          content: n,
          params: t
        }), Fu({
          content: n,
          transform: G(G({}, vn), e),
          title: s,
          extra: {
            attributes: r,
            styles: o,
            classes: ["".concat(it.cssPrefix, "-layers-text"), ...i]
          }
        })));
      }
    };
  },
  provides(n) {
    n.generateLayersText = function(t, e) {
      const {
        title: s,
        transform: i,
        extra: r
      } = e;
      let o = null, a = null;
      if (qd) {
        const c = parseInt(getComputedStyle(t).fontSize, 10), l = t.getBoundingClientRect();
        o = l.width / c, a = l.height / c;
      }
      return it.autoA11y && !s && (r.attributes["aria-hidden"] = "true"), Promise.resolve([t, Fu({
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
const mw = new RegExp('"', "ug"), $u = [1105920, 1112319], zu = G(G(G(G({}, {
  FontAwesome: {
    normal: "fas",
    400: "fas"
  }
}), Wb), ex), Xb), Da = Object.keys(zu).reduce((n, t) => (n[t.toLowerCase()] = zu[t], n), {}), gw = Object.keys(Da).reduce((n, t) => {
  const e = Da[t];
  return n[t] = e[900] || [...Object.entries(e)][0][1], n;
}, {});
function _w(n) {
  const t = n.replace(mw, ""), e = Cx(t, 0), s = e >= $u[0] && e <= $u[1], i = t.length === 2 ? t[0] === t[1] : !1;
  return {
    value: wa(i ? t[0] : t),
    isSecondary: s || i
  };
}
function yw(n, t) {
  const e = n.replace(/^['"]|['"]$/g, "").toLowerCase(), s = parseInt(t), i = isNaN(s) ? "normal" : s;
  return (Da[e] || {})[i] || gw[e];
}
function Gu(n, t) {
  const e = "".concat(nx).concat(t.replace(":", "-"));
  return new Promise((s, i) => {
    if (n.getAttribute(e) !== null)
      return s();
    const o = yi(n.children).filter((d) => d.getAttribute(ya) === t)[0], a = ns.getComputedStyle(n, t), c = a.getPropertyValue("font-family"), l = c.match(ax), u = a.getPropertyValue("font-weight"), h = a.getPropertyValue("content");
    if (o && !l)
      return n.removeChild(o), s();
    if (l && h !== "none" && h !== "") {
      const d = a.getPropertyValue("content");
      let f = yw(c, u);
      const {
        value: p,
        isSecondary: m
      } = _w(d), g = l[0].startsWith("FontAwesome");
      let _ = _l(f, p), v = _;
      if (g) {
        const x = Ex(p);
        x.iconName && x.prefix && (_ = x.iconName, f = x.prefix);
      }
      if (_ && !m && (!o || o.getAttribute(hl) !== f || o.getAttribute(dl) !== v)) {
        n.setAttribute(e, v), o && n.removeChild(o);
        const x = rw(), {
          extra: T
        } = x;
        T.attributes[ya] = t, ka(_, f).then((y) => {
          const w = yl(G(G({}, x), {}, {
            icons: {
              main: y,
              mask: hf()
            },
            prefix: f,
            iconName: v,
            extra: T,
            watchable: !0
          })), S = $t.createElementNS("http://www.w3.org/2000/svg", "svg");
          t === "::before" ? n.insertBefore(S, n.firstChild) : n.appendChild(S), S.outerHTML = w.map((b) => pr(b)).join(`
`), n.removeAttribute(e), s();
        }).catch(i);
      } else
        s();
    } else
      s();
  });
}
function vw(n) {
  return Promise.all([Gu(n, "::before"), Gu(n, "::after")]);
}
function bw(n) {
  return n.parentNode !== document.head && !~ix.indexOf(n.tagName.toUpperCase()) && !n.getAttribute(ya) && (!n.parentNode || n.parentNode.tagName !== "svg");
}
function Zu(n) {
  if (Bn)
    return new Promise((t, e) => {
      const s = yi(n.querySelectorAll("*")).filter(bw).map(vw), i = vl.begin("searchPseudoElements");
      gf(), Promise.all(s).then(() => {
        i(), Ea(), t();
      }).catch(() => {
        i(), Ea(), e();
      });
    });
}
var xw = {
  hooks() {
    return {
      mutationObserverCallbacks(n) {
        return n.pseudoElementsCallback = Zu, n;
      }
    };
  },
  provides(n) {
    n.pseudoElements2svg = function(t) {
      const {
        node: e = $t
      } = t;
      it.searchPseudoElements && Zu(e);
    };
  }
};
let Yu = !1;
var ww = {
  mixout() {
    return {
      dom: {
        unwatch() {
          gf(), Yu = !0;
        }
      }
    };
  },
  hooks() {
    return {
      bootstrap() {
        Lu(Sa("mutationObserverCallbacks", {}));
      },
      noAuto() {
        ew();
      },
      watch(n) {
        const {
          observeMutationsRoot: t
        } = n;
        Yu ? Ea() : Lu(Sa("mutationObserverCallbacks", {
          observeMutationsRoot: t
        }));
      }
    };
  }
};
const Xu = (n) => {
  let t = {
    size: 16,
    x: 0,
    y: 0,
    flipX: !1,
    flipY: !1,
    rotate: 0
  };
  return n.toLowerCase().split(" ").reduce((e, s) => {
    const i = s.toLowerCase().split("-"), r = i[0];
    let o = i.slice(1).join("-");
    if (r && o === "h")
      return e.flipX = !0, e;
    if (r && o === "v")
      return e.flipY = !0, e;
    if (o = parseFloat(o), isNaN(o))
      return e;
    switch (r) {
      case "grow":
        e.size = e.size + o;
        break;
      case "shrink":
        e.size = e.size - o;
        break;
      case "left":
        e.x = e.x - o;
        break;
      case "right":
        e.x = e.x + o;
        break;
      case "up":
        e.y = e.y - o;
        break;
      case "down":
        e.y = e.y + o;
        break;
      case "rotate":
        e.rotate = e.rotate + o;
        break;
    }
    return e;
  }, t);
};
var Cw = {
  mixout() {
    return {
      parse: {
        transform: (n) => Xu(n)
      }
    };
  },
  hooks() {
    return {
      parseNodeAttributes(n, t) {
        const e = t.getAttribute("data-fa-transform");
        return e && (n.transform = Xu(e)), n;
      }
    };
  },
  provides(n) {
    n.generateAbstractTransformGrouping = function(t) {
      let {
        main: e,
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
        attributes: G({}, d.outer),
        children: [{
          tag: "g",
          attributes: G({}, d.inner),
          children: [{
            tag: e.icon.tag,
            children: e.icon.children,
            attributes: G(G({}, e.icon.attributes), d.path)
          }]
        }]
      };
    };
  }
};
const $o = {
  x: 0,
  y: 0,
  width: "100%",
  height: "100%"
};
function Uu(n) {
  let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : !0;
  return n.attributes && (n.attributes.fill || t) && (n.attributes.fill = "black"), n;
}
function Sw(n) {
  return n.tag === "g" ? n.children : [n];
}
var Tw = {
  hooks() {
    return {
      parseNodeAttributes(n, t) {
        const e = t.getAttribute("data-fa-mask"), s = e ? So(e.split(" ").map((i) => i.trim())) : hf();
        return s.prefix || (s.prefix = ss()), n.mask = s, n.maskId = t.getAttribute("data-fa-mask-id"), n;
      }
    };
  },
  provides(n) {
    n.generateAbstractMask = function(t) {
      let {
        children: e,
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
      } = r, d = _x({
        transform: a,
        containerWidth: u,
        iconWidth: c
      }), f = {
        tag: "rect",
        attributes: G(G({}, $o), {}, {
          fill: "white"
        })
      }, p = l.children ? {
        children: l.children.map(Uu)
      } : {}, m = {
        tag: "g",
        attributes: G({}, d.inner),
        children: [Uu(G({
          tag: l.tag,
          attributes: G(G({}, l.attributes), d.path)
        }, p))]
      }, g = {
        tag: "g",
        attributes: G({}, d.outer),
        children: [m]
      }, _ = "mask-".concat(o || qi()), v = "clip-".concat(o || qi()), x = {
        tag: "mask",
        attributes: G(G({}, $o), {}, {
          id: _,
          maskUnits: "userSpaceOnUse",
          maskContentUnits: "userSpaceOnUse"
        }),
        children: [f, g]
      }, T = {
        tag: "defs",
        children: [{
          tag: "clipPath",
          attributes: {
            id: v
          },
          children: Sw(h)
        }, x]
      };
      return e.push(T, {
        tag: "rect",
        attributes: G({
          fill: "currentColor",
          "clip-path": "url(#".concat(v, ")"),
          mask: "url(#".concat(_, ")")
        }, $o)
      }), {
        children: e,
        attributes: s
      };
    };
  }
}, Aw = {
  provides(n) {
    let t = !1;
    ns.matchMedia && (t = ns.matchMedia("(prefers-reduced-motion: reduce)").matches), n.missingIconAbstract = function() {
      const e = [], s = {
        fill: "currentColor"
      }, i = {
        attributeType: "XML",
        repeatCount: "indefinite",
        dur: "2s"
      };
      e.push({
        tag: "path",
        attributes: G(G({}, s), {}, {
          d: "M156.5,447.7l-12.6,29.5c-18.7-9.5-35.9-21.2-51.5-34.9l22.7-22.7C127.6,430.5,141.5,440,156.5,447.7z M40.6,272H8.5 c1.4,21.2,5.4,41.7,11.7,61.1L50,321.2C45.1,305.5,41.8,289,40.6,272z M40.6,240c1.4-18.8,5.2-37,11.1-54.1l-29.5-12.6 C14.7,194.3,10,216.7,8.5,240H40.6z M64.3,156.5c7.8-14.9,17.2-28.8,28.1-41.5L69.7,92.3c-13.7,15.6-25.5,32.8-34.9,51.5 L64.3,156.5z M397,419.6c-13.9,12-29.4,22.3-46.1,30.4l11.9,29.8c20.7-9.9,39.8-22.6,56.9-37.6L397,419.6z M115,92.4 c13.9-12,29.4-22.3,46.1-30.4l-11.9-29.8c-20.7,9.9-39.8,22.6-56.8,37.6L115,92.4z M447.7,355.5c-7.8,14.9-17.2,28.8-28.1,41.5 l22.7,22.7c13.7-15.6,25.5-32.9,34.9-51.5L447.7,355.5z M471.4,272c-1.4,18.8-5.2,37-11.1,54.1l29.5,12.6 c7.5-21.1,12.2-43.5,13.6-66.8H471.4z M321.2,462c-15.7,5-32.2,8.2-49.2,9.4v32.1c21.2-1.4,41.7-5.4,61.1-11.7L321.2,462z M240,471.4c-18.8-1.4-37-5.2-54.1-11.1l-12.6,29.5c21.1,7.5,43.5,12.2,66.8,13.6V471.4z M462,190.8c5,15.7,8.2,32.2,9.4,49.2h32.1 c-1.4-21.2-5.4-41.7-11.7-61.1L462,190.8z M92.4,397c-12-13.9-22.3-29.4-30.4-46.1l-29.8,11.9c9.9,20.7,22.6,39.8,37.6,56.9 L92.4,397z M272,40.6c18.8,1.4,36.9,5.2,54.1,11.1l12.6-29.5C317.7,14.7,295.3,10,272,8.5V40.6z M190.8,50 c15.7-5,32.2-8.2,49.2-9.4V8.5c-21.2,1.4-41.7,5.4-61.1,11.7L190.8,50z M442.3,92.3L419.6,115c12,13.9,22.3,29.4,30.5,46.1 l29.8-11.9C470,128.5,457.3,109.4,442.3,92.3z M397,92.4l22.7-22.7c-15.6-13.7-32.8-25.5-51.5-34.9l-12.6,29.5 C370.4,72.1,384.4,81.5,397,92.4z"
        })
      });
      const r = G(G({}, i), {}, {
        attributeName: "opacity"
      }), o = {
        tag: "circle",
        attributes: G(G({}, s), {}, {
          cx: "256",
          cy: "364",
          r: "28"
        }),
        children: []
      };
      return t || o.children.push({
        tag: "animate",
        attributes: G(G({}, i), {}, {
          attributeName: "r",
          values: "28;14;28;28;14;28;"
        })
      }, {
        tag: "animate",
        attributes: G(G({}, r), {}, {
          values: "1;0;1;1;0;1;"
        })
      }), e.push(o), e.push({
        tag: "path",
        attributes: G(G({}, s), {}, {
          opacity: "1",
          d: "M263.7,312h-16c-6.6,0-12-5.4-12-12c0-71,77.4-63.9,77.4-107.8c0-20-17.8-40.2-57.4-40.2c-29.1,0-44.3,9.6-59.2,28.7 c-3.9,5-11.1,6-16.2,2.4l-13.1-9.2c-5.6-3.9-6.9-11.8-2.6-17.2c21.2-27.2,46.4-44.7,91.2-44.7c52.3,0,97.4,29.8,97.4,80.2 c0,67.6-77.4,63.5-77.4,107.8C275.7,306.6,270.3,312,263.7,312z"
        }),
        children: t ? [] : [{
          tag: "animate",
          attributes: G(G({}, r), {}, {
            values: "1;0;0;0;0;1;"
          })
        }]
      }), t || e.push({
        tag: "path",
        attributes: G(G({}, s), {}, {
          opacity: "0",
          d: "M232.5,134.5l7,168c0.3,6.4,5.6,11.5,12,11.5h9c6.4,0,11.7-5.1,12-11.5l7-168c0.3-6.8-5.2-12.5-12-12.5h-23 C237.7,122,232.2,127.7,232.5,134.5z"
        }),
        children: [{
          tag: "animate",
          attributes: G(G({}, r), {}, {
            values: "0;0;1;1;0;0;"
          })
        }]
      }), {
        tag: "g",
        attributes: {
          class: "missing"
        },
        children: e
      };
    };
  }
}, kw = {
  hooks() {
    return {
      parseNodeAttributes(n, t) {
        const e = t.getAttribute("data-fa-symbol"), s = e === null ? !1 : e === "" ? !0 : e;
        return n.symbol = s, n;
      }
    };
  }
}, Iw = [bx, hw, dw, fw, pw, xw, ww, Cw, Tw, Aw, kw];
Wx(Iw, {
  mixoutsTo: Ue
});
Ue.noAuto;
Ue.config;
const Ew = Ue.library;
Ue.dom;
const Oa = Ue.parse;
Ue.findIconDefinition;
Ue.toHtml;
const Dw = Ue.icon;
Ue.layer;
Ue.text;
Ue.counter;
var kr = { exports: {} }, Ir = { exports: {} }, Nt = {};
var Hu;
function Ow() {
  if (Hu) return Nt;
  Hu = 1;
  var n = typeof Symbol == "function" && Symbol.for, t = n ? Symbol.for("react.element") : 60103, e = n ? Symbol.for("react.portal") : 60106, s = n ? Symbol.for("react.fragment") : 60107, i = n ? Symbol.for("react.strict_mode") : 60108, r = n ? Symbol.for("react.profiler") : 60114, o = n ? Symbol.for("react.provider") : 60109, a = n ? Symbol.for("react.context") : 60110, c = n ? Symbol.for("react.async_mode") : 60111, l = n ? Symbol.for("react.concurrent_mode") : 60111, u = n ? Symbol.for("react.forward_ref") : 60112, h = n ? Symbol.for("react.suspense") : 60113, d = n ? Symbol.for("react.suspense_list") : 60120, f = n ? Symbol.for("react.memo") : 60115, p = n ? Symbol.for("react.lazy") : 60116, m = n ? Symbol.for("react.block") : 60121, g = n ? Symbol.for("react.fundamental") : 60117, _ = n ? Symbol.for("react.responder") : 60118, v = n ? Symbol.for("react.scope") : 60119;
  function x(y) {
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
                case p:
                case f:
                case o:
                  return y;
                default:
                  return w;
              }
          }
        case e:
          return w;
      }
    }
  }
  function T(y) {
    return x(y) === l;
  }
  return Nt.AsyncMode = c, Nt.ConcurrentMode = l, Nt.ContextConsumer = a, Nt.ContextProvider = o, Nt.Element = t, Nt.ForwardRef = u, Nt.Fragment = s, Nt.Lazy = p, Nt.Memo = f, Nt.Portal = e, Nt.Profiler = r, Nt.StrictMode = i, Nt.Suspense = h, Nt.isAsyncMode = function(y) {
    return T(y) || x(y) === c;
  }, Nt.isConcurrentMode = T, Nt.isContextConsumer = function(y) {
    return x(y) === a;
  }, Nt.isContextProvider = function(y) {
    return x(y) === o;
  }, Nt.isElement = function(y) {
    return typeof y == "object" && y !== null && y.$$typeof === t;
  }, Nt.isForwardRef = function(y) {
    return x(y) === u;
  }, Nt.isFragment = function(y) {
    return x(y) === s;
  }, Nt.isLazy = function(y) {
    return x(y) === p;
  }, Nt.isMemo = function(y) {
    return x(y) === f;
  }, Nt.isPortal = function(y) {
    return x(y) === e;
  }, Nt.isProfiler = function(y) {
    return x(y) === r;
  }, Nt.isStrictMode = function(y) {
    return x(y) === i;
  }, Nt.isSuspense = function(y) {
    return x(y) === h;
  }, Nt.isValidElementType = function(y) {
    return typeof y == "string" || typeof y == "function" || y === s || y === l || y === r || y === i || y === h || y === d || typeof y == "object" && y !== null && (y.$$typeof === p || y.$$typeof === f || y.$$typeof === o || y.$$typeof === a || y.$$typeof === u || y.$$typeof === g || y.$$typeof === _ || y.$$typeof === v || y.$$typeof === m);
  }, Nt.typeOf = x, Nt;
}
var Pt = {};
var Ku;
function Rw() {
  return Ku || (Ku = 1, process.env.NODE_ENV !== "production" && (function() {
    var n = typeof Symbol == "function" && Symbol.for, t = n ? Symbol.for("react.element") : 60103, e = n ? Symbol.for("react.portal") : 60106, s = n ? Symbol.for("react.fragment") : 60107, i = n ? Symbol.for("react.strict_mode") : 60108, r = n ? Symbol.for("react.profiler") : 60114, o = n ? Symbol.for("react.provider") : 60109, a = n ? Symbol.for("react.context") : 60110, c = n ? Symbol.for("react.async_mode") : 60111, l = n ? Symbol.for("react.concurrent_mode") : 60111, u = n ? Symbol.for("react.forward_ref") : 60112, h = n ? Symbol.for("react.suspense") : 60113, d = n ? Symbol.for("react.suspense_list") : 60120, f = n ? Symbol.for("react.memo") : 60115, p = n ? Symbol.for("react.lazy") : 60116, m = n ? Symbol.for("react.block") : 60121, g = n ? Symbol.for("react.fundamental") : 60117, _ = n ? Symbol.for("react.responder") : 60118, v = n ? Symbol.for("react.scope") : 60119;
    function x(Y) {
      return typeof Y == "string" || typeof Y == "function" || // Note: its typeof might be other than 'symbol' or 'number' if it's a polyfill.
      Y === s || Y === l || Y === r || Y === i || Y === h || Y === d || typeof Y == "object" && Y !== null && (Y.$$typeof === p || Y.$$typeof === f || Y.$$typeof === o || Y.$$typeof === a || Y.$$typeof === u || Y.$$typeof === g || Y.$$typeof === _ || Y.$$typeof === v || Y.$$typeof === m);
    }
    function T(Y) {
      if (typeof Y == "object" && Y !== null) {
        var te = Y.$$typeof;
        switch (te) {
          case t:
            var Ut = Y.type;
            switch (Ut) {
              case c:
              case l:
              case s:
              case r:
              case i:
              case h:
                return Ut;
              default:
                var Z = Ut && Ut.$$typeof;
                switch (Z) {
                  case a:
                  case u:
                  case p:
                  case f:
                  case o:
                    return Z;
                  default:
                    return te;
                }
            }
          case e:
            return te;
        }
      }
    }
    var y = c, w = l, S = a, b = o, O = t, D = u, k = s, I = p, N = f, F = e, $ = r, L = i, q = h, tt = !1;
    function j(Y) {
      return tt || (tt = !0, console.warn("The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 17+. Update your code to use ReactIs.isConcurrentMode() instead. It has the exact same API.")), E(Y) || T(Y) === c;
    }
    function E(Y) {
      return T(Y) === l;
    }
    function R(Y) {
      return T(Y) === a;
    }
    function B(Y) {
      return T(Y) === o;
    }
    function Q(Y) {
      return typeof Y == "object" && Y !== null && Y.$$typeof === t;
    }
    function K(Y) {
      return T(Y) === u;
    }
    function z(Y) {
      return T(Y) === s;
    }
    function H(Y) {
      return T(Y) === p;
    }
    function st(Y) {
      return T(Y) === f;
    }
    function M(Y) {
      return T(Y) === e;
    }
    function ct(Y) {
      return T(Y) === r;
    }
    function et(Y) {
      return T(Y) === i;
    }
    function Tt(Y) {
      return T(Y) === h;
    }
    Pt.AsyncMode = y, Pt.ConcurrentMode = w, Pt.ContextConsumer = S, Pt.ContextProvider = b, Pt.Element = O, Pt.ForwardRef = D, Pt.Fragment = k, Pt.Lazy = I, Pt.Memo = N, Pt.Portal = F, Pt.Profiler = $, Pt.StrictMode = L, Pt.Suspense = q, Pt.isAsyncMode = j, Pt.isConcurrentMode = E, Pt.isContextConsumer = R, Pt.isContextProvider = B, Pt.isElement = Q, Pt.isForwardRef = K, Pt.isFragment = z, Pt.isLazy = H, Pt.isMemo = st, Pt.isPortal = M, Pt.isProfiler = ct, Pt.isStrictMode = et, Pt.isSuspense = Tt, Pt.isValidElementType = x, Pt.typeOf = T;
  })()), Pt;
}
var Qu;
function yf() {
  return Qu || (Qu = 1, process.env.NODE_ENV === "production" ? Ir.exports = Ow() : Ir.exports = Rw()), Ir.exports;
}
var zo, Ju;
function Mw() {
  if (Ju) return zo;
  Ju = 1;
  var n = Object.getOwnPropertySymbols, t = Object.prototype.hasOwnProperty, e = Object.prototype.propertyIsEnumerable;
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
  return zo = i() ? Object.assign : function(r, o) {
    for (var a, c = s(r), l, u = 1; u < arguments.length; u++) {
      a = Object(arguments[u]);
      for (var h in a)
        t.call(a, h) && (c[h] = a[h]);
      if (n) {
        l = n(a);
        for (var d = 0; d < l.length; d++)
          e.call(a, l[d]) && (c[l[d]] = a[l[d]]);
      }
    }
    return c;
  }, zo;
}
var Go, th;
function xl() {
  if (th) return Go;
  th = 1;
  var n = "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED";
  return Go = n, Go;
}
var Zo, eh;
function vf() {
  return eh || (eh = 1, Zo = Function.call.bind(Object.prototype.hasOwnProperty)), Zo;
}
var Yo, nh;
function Nw() {
  if (nh) return Yo;
  nh = 1;
  var n = function() {
  };
  if (process.env.NODE_ENV !== "production") {
    var t = /* @__PURE__ */ xl(), e = {}, s = /* @__PURE__ */ vf();
    n = function(r) {
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
          } catch (p) {
            h = p;
          }
          if (h && !(h instanceof Error) && n(
            (c || "React class") + ": type specification of " + a + " `" + u + "` is invalid; the type checker function must return `null` or an `Error` but returned a " + typeof h + ". You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument)."
          ), h instanceof Error && !(h.message in e)) {
            e[h.message] = !0;
            var f = l ? l() : "";
            n(
              "Failed " + a + " type: " + h.message + (f ?? "")
            );
          }
        }
    }
  }
  return i.resetWarningCache = function() {
    process.env.NODE_ENV !== "production" && (e = {});
  }, Yo = i, Yo;
}
var Xo, sh;
function Pw() {
  if (sh) return Xo;
  sh = 1;
  var n = yf(), t = Mw(), e = /* @__PURE__ */ xl(), s = /* @__PURE__ */ vf(), i = /* @__PURE__ */ Nw(), r = function() {
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
  return Xo = function(a, c) {
    var l = typeof Symbol == "function" && Symbol.iterator, u = "@@iterator";
    function h(E) {
      var R = E && (l && E[l] || E[u]);
      if (typeof R == "function")
        return R;
    }
    var d = "<<anonymous>>", f = {
      array: _("array"),
      bigint: _("bigint"),
      bool: _("boolean"),
      func: _("function"),
      number: _("number"),
      object: _("object"),
      string: _("string"),
      symbol: _("symbol"),
      any: v(),
      arrayOf: x,
      element: T(),
      elementType: y(),
      instanceOf: w,
      node: D(),
      objectOf: b,
      oneOf: S,
      oneOfType: O,
      shape: I,
      exact: N
    };
    function p(E, R) {
      return E === R ? E !== 0 || 1 / E === 1 / R : E !== E && R !== R;
    }
    function m(E, R) {
      this.message = E, this.data = R && typeof R == "object" ? R : {}, this.stack = "";
    }
    m.prototype = Error.prototype;
    function g(E) {
      if (process.env.NODE_ENV !== "production")
        var R = {}, B = 0;
      function Q(z, H, st, M, ct, et, Tt) {
        if (M = M || d, et = et || st, Tt !== e) {
          if (c) {
            var Y = new Error(
              "Calling PropTypes validators directly is not supported by the `prop-types` package. Use `PropTypes.checkPropTypes()` to call them. Read more at http://fb.me/use-check-prop-types"
            );
            throw Y.name = "Invariant Violation", Y;
          } else if (process.env.NODE_ENV !== "production" && typeof console < "u") {
            var te = M + ":" + st;
            !R[te] && // Avoid spamming the console because they are often not actionable except for lib authors
            B < 3 && (r(
              "You are manually calling a React.PropTypes validation function for the `" + et + "` prop on `" + M + "`. This is deprecated and will throw in the standalone `prop-types` package. You may be seeing this warning due to a third-party PropTypes library. See https://fb.me/react-warning-dont-call-proptypes for details."
            ), R[te] = !0, B++);
          }
        }
        return H[st] == null ? z ? H[st] === null ? new m("The " + ct + " `" + et + "` is marked as required " + ("in `" + M + "`, but its value is `null`.")) : new m("The " + ct + " `" + et + "` is marked as required in " + ("`" + M + "`, but its value is `undefined`.")) : null : E(H, st, M, ct, et);
      }
      var K = Q.bind(null, !1);
      return K.isRequired = Q.bind(null, !0), K;
    }
    function _(E) {
      function R(B, Q, K, z, H, st) {
        var M = B[Q], ct = L(M);
        if (ct !== E) {
          var et = q(M);
          return new m(
            "Invalid " + z + " `" + H + "` of type " + ("`" + et + "` supplied to `" + K + "`, expected ") + ("`" + E + "`."),
            { expectedType: E }
          );
        }
        return null;
      }
      return g(R);
    }
    function v() {
      return g(o);
    }
    function x(E) {
      function R(B, Q, K, z, H) {
        if (typeof E != "function")
          return new m("Property `" + H + "` of component `" + K + "` has invalid PropType notation inside arrayOf.");
        var st = B[Q];
        if (!Array.isArray(st)) {
          var M = L(st);
          return new m("Invalid " + z + " `" + H + "` of type " + ("`" + M + "` supplied to `" + K + "`, expected an array."));
        }
        for (var ct = 0; ct < st.length; ct++) {
          var et = E(st, ct, K, z, H + "[" + ct + "]", e);
          if (et instanceof Error)
            return et;
        }
        return null;
      }
      return g(R);
    }
    function T() {
      function E(R, B, Q, K, z) {
        var H = R[B];
        if (!a(H)) {
          var st = L(H);
          return new m("Invalid " + K + " `" + z + "` of type " + ("`" + st + "` supplied to `" + Q + "`, expected a single ReactElement."));
        }
        return null;
      }
      return g(E);
    }
    function y() {
      function E(R, B, Q, K, z) {
        var H = R[B];
        if (!n.isValidElementType(H)) {
          var st = L(H);
          return new m("Invalid " + K + " `" + z + "` of type " + ("`" + st + "` supplied to `" + Q + "`, expected a single ReactElement type."));
        }
        return null;
      }
      return g(E);
    }
    function w(E) {
      function R(B, Q, K, z, H) {
        if (!(B[Q] instanceof E)) {
          var st = E.name || d, M = j(B[Q]);
          return new m("Invalid " + z + " `" + H + "` of type " + ("`" + M + "` supplied to `" + K + "`, expected ") + ("instance of `" + st + "`."));
        }
        return null;
      }
      return g(R);
    }
    function S(E) {
      if (!Array.isArray(E))
        return process.env.NODE_ENV !== "production" && (arguments.length > 1 ? r(
          "Invalid arguments supplied to oneOf, expected an array, got " + arguments.length + " arguments. A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z])."
        ) : r("Invalid argument supplied to oneOf, expected an array.")), o;
      function R(B, Q, K, z, H) {
        for (var st = B[Q], M = 0; M < E.length; M++)
          if (p(st, E[M]))
            return null;
        var ct = JSON.stringify(E, function(Tt, Y) {
          var te = q(Y);
          return te === "symbol" ? String(Y) : Y;
        });
        return new m("Invalid " + z + " `" + H + "` of value `" + String(st) + "` " + ("supplied to `" + K + "`, expected one of " + ct + "."));
      }
      return g(R);
    }
    function b(E) {
      function R(B, Q, K, z, H) {
        if (typeof E != "function")
          return new m("Property `" + H + "` of component `" + K + "` has invalid PropType notation inside objectOf.");
        var st = B[Q], M = L(st);
        if (M !== "object")
          return new m("Invalid " + z + " `" + H + "` of type " + ("`" + M + "` supplied to `" + K + "`, expected an object."));
        for (var ct in st)
          if (s(st, ct)) {
            var et = E(st, ct, K, z, H + "." + ct, e);
            if (et instanceof Error)
              return et;
          }
        return null;
      }
      return g(R);
    }
    function O(E) {
      if (!Array.isArray(E))
        return process.env.NODE_ENV !== "production" && r("Invalid argument supplied to oneOfType, expected an instance of array."), o;
      for (var R = 0; R < E.length; R++) {
        var B = E[R];
        if (typeof B != "function")
          return r(
            "Invalid argument supplied to oneOfType. Expected an array of check functions, but received " + tt(B) + " at index " + R + "."
          ), o;
      }
      function Q(K, z, H, st, M) {
        for (var ct = [], et = 0; et < E.length; et++) {
          var Tt = E[et], Y = Tt(K, z, H, st, M, e);
          if (Y == null)
            return null;
          Y.data && s(Y.data, "expectedType") && ct.push(Y.data.expectedType);
        }
        var te = ct.length > 0 ? ", expected one of type [" + ct.join(", ") + "]" : "";
        return new m("Invalid " + st + " `" + M + "` supplied to " + ("`" + H + "`" + te + "."));
      }
      return g(Q);
    }
    function D() {
      function E(R, B, Q, K, z) {
        return F(R[B]) ? null : new m("Invalid " + K + " `" + z + "` supplied to " + ("`" + Q + "`, expected a ReactNode."));
      }
      return g(E);
    }
    function k(E, R, B, Q, K) {
      return new m(
        (E || "React class") + ": " + R + " type `" + B + "." + Q + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + K + "`."
      );
    }
    function I(E) {
      function R(B, Q, K, z, H) {
        var st = B[Q], M = L(st);
        if (M !== "object")
          return new m("Invalid " + z + " `" + H + "` of type `" + M + "` " + ("supplied to `" + K + "`, expected `object`."));
        for (var ct in E) {
          var et = E[ct];
          if (typeof et != "function")
            return k(K, z, H, ct, q(et));
          var Tt = et(st, ct, K, z, H + "." + ct, e);
          if (Tt)
            return Tt;
        }
        return null;
      }
      return g(R);
    }
    function N(E) {
      function R(B, Q, K, z, H) {
        var st = B[Q], M = L(st);
        if (M !== "object")
          return new m("Invalid " + z + " `" + H + "` of type `" + M + "` " + ("supplied to `" + K + "`, expected `object`."));
        var ct = t({}, B[Q], E);
        for (var et in ct) {
          var Tt = E[et];
          if (s(E, et) && typeof Tt != "function")
            return k(K, z, H, et, q(Tt));
          if (!Tt)
            return new m(
              "Invalid " + z + " `" + H + "` key `" + et + "` supplied to `" + K + "`.\nBad object: " + JSON.stringify(B[Q], null, "  ") + `
Valid keys: ` + JSON.stringify(Object.keys(E), null, "  ")
            );
          var Y = Tt(st, et, K, z, H + "." + et, e);
          if (Y)
            return Y;
        }
        return null;
      }
      return g(R);
    }
    function F(E) {
      switch (typeof E) {
        case "number":
        case "string":
        case "undefined":
          return !0;
        case "boolean":
          return !E;
        case "object":
          if (Array.isArray(E))
            return E.every(F);
          if (E === null || a(E))
            return !0;
          var R = h(E);
          if (R) {
            var B = R.call(E), Q;
            if (R !== E.entries) {
              for (; !(Q = B.next()).done; )
                if (!F(Q.value))
                  return !1;
            } else
              for (; !(Q = B.next()).done; ) {
                var K = Q.value;
                if (K && !F(K[1]))
                  return !1;
              }
          } else
            return !1;
          return !0;
        default:
          return !1;
      }
    }
    function $(E, R) {
      return E === "symbol" ? !0 : R ? R["@@toStringTag"] === "Symbol" || typeof Symbol == "function" && R instanceof Symbol : !1;
    }
    function L(E) {
      var R = typeof E;
      return Array.isArray(E) ? "array" : E instanceof RegExp ? "object" : $(R, E) ? "symbol" : R;
    }
    function q(E) {
      if (typeof E > "u" || E === null)
        return "" + E;
      var R = L(E);
      if (R === "object") {
        if (E instanceof Date)
          return "date";
        if (E instanceof RegExp)
          return "regexp";
      }
      return R;
    }
    function tt(E) {
      var R = q(E);
      switch (R) {
        case "array":
        case "object":
          return "an " + R;
        case "boolean":
        case "date":
        case "regexp":
          return "a " + R;
        default:
          return R;
      }
    }
    function j(E) {
      return !E.constructor || !E.constructor.name ? d : E.constructor.name;
    }
    return f.checkPropTypes = i, f.resetWarningCache = i.resetWarningCache, f.PropTypes = f, f;
  }, Xo;
}
var Uo, ih;
function Fw() {
  if (ih) return Uo;
  ih = 1;
  var n = /* @__PURE__ */ xl();
  function t() {
  }
  function e() {
  }
  return e.resetWarningCache = t, Uo = function() {
    function s(o, a, c, l, u, h) {
      if (h !== n) {
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
      checkPropTypes: e,
      resetWarningCache: t
    };
    return r.PropTypes = r, r;
  }, Uo;
}
var rh;
function Vw() {
  if (rh) return kr.exports;
  if (rh = 1, process.env.NODE_ENV !== "production") {
    var n = yf(), t = !0;
    kr.exports = /* @__PURE__ */ Pw()(n.isElement, t);
  } else
    kr.exports = /* @__PURE__ */ Fw()();
  return kr.exports;
}
var Ww = /* @__PURE__ */ Vw();
const wt = /* @__PURE__ */ Ch(Ww);
function Ra(n, t) {
  (t == null || t > n.length) && (t = n.length);
  for (var e = 0, s = Array(t); e < t; e++) s[e] = n[e];
  return s;
}
function jw(n) {
  if (Array.isArray(n)) return n;
}
function Lw(n) {
  if (Array.isArray(n)) return Ra(n);
}
function Xn(n, t, e) {
  return (t = Xw(t)) in n ? Object.defineProperty(n, t, {
    value: e,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : n[t] = e, n;
}
function qw(n) {
  if (typeof Symbol < "u" && n[Symbol.iterator] != null || n["@@iterator"] != null) return Array.from(n);
}
function Bw(n, t) {
  var e = n == null ? null : typeof Symbol < "u" && n[Symbol.iterator] || n["@@iterator"];
  if (e != null) {
    var s, i, r, o, a = [], c = !0, l = !1;
    try {
      if (r = (e = e.call(n)).next, t !== 0) for (; !(c = (s = r.call(e)).done) && (a.push(s.value), a.length !== t); c = !0) ;
    } catch (u) {
      l = !0, i = u;
    } finally {
      try {
        if (!c && e.return != null && (o = e.return(), Object(o) !== o)) return;
      } finally {
        if (l) throw i;
      }
    }
    return a;
  }
}
function $w() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function zw() {
  throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function oh(n, t) {
  var e = Object.keys(n);
  if (Object.getOwnPropertySymbols) {
    var s = Object.getOwnPropertySymbols(n);
    t && (s = s.filter(function(i) {
      return Object.getOwnPropertyDescriptor(n, i).enumerable;
    })), e.push.apply(e, s);
  }
  return e;
}
function _n(n) {
  for (var t = 1; t < arguments.length; t++) {
    var e = arguments[t] != null ? arguments[t] : {};
    t % 2 ? oh(Object(e), !0).forEach(function(s) {
      Xn(n, s, e[s]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(n, Object.getOwnPropertyDescriptors(e)) : oh(Object(e)).forEach(function(s) {
      Object.defineProperty(n, s, Object.getOwnPropertyDescriptor(e, s));
    });
  }
  return n;
}
function Gw(n, t) {
  if (n == null) return {};
  var e, s, i = Zw(n, t);
  if (Object.getOwnPropertySymbols) {
    var r = Object.getOwnPropertySymbols(n);
    for (s = 0; s < r.length; s++) e = r[s], t.indexOf(e) === -1 && {}.propertyIsEnumerable.call(n, e) && (i[e] = n[e]);
  }
  return i;
}
function Zw(n, t) {
  if (n == null) return {};
  var e = {};
  for (var s in n) if ({}.hasOwnProperty.call(n, s)) {
    if (t.indexOf(s) !== -1) continue;
    e[s] = n[s];
  }
  return e;
}
function ah(n, t) {
  return jw(n) || Bw(n, t) || bf(n, t) || $w();
}
function Ma(n) {
  return Lw(n) || qw(n) || bf(n) || zw();
}
function Yw(n, t) {
  if (typeof n != "object" || !n) return n;
  var e = n[Symbol.toPrimitive];
  if (e !== void 0) {
    var s = e.call(n, t);
    if (typeof s != "object") return s;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(n);
}
function Xw(n) {
  var t = Yw(n, "string");
  return typeof t == "symbol" ? t : t + "";
}
function Hr(n) {
  "@babel/helpers - typeof";
  return Hr = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, Hr(n);
}
function bf(n, t) {
  if (n) {
    if (typeof n == "string") return Ra(n, t);
    var e = {}.toString.call(n).slice(8, -1);
    return e === "Object" && n.constructor && (e = n.constructor.name), e === "Map" || e === "Set" ? Array.from(n) : e === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e) ? Ra(n, t) : void 0;
  }
}
var Uw = "7.0.0", Na;
try {
  var Hw = require("@fortawesome/fontawesome-svg-core/package.json");
  Na = Hw.version;
} catch {
  Na = typeof process < "u" && process.env.FA_VERSION || "7.0.0";
}
function Kw(n) {
  var t = n.beat, e = n.fade, s = n.beatFade, i = n.bounce, r = n.shake, o = n.flash, a = n.spin, c = n.spinPulse, l = n.spinReverse, u = n.pulse, h = n.fixedWidth, d = n.inverse, f = n.border, p = n.listItem, m = n.flip, g = n.size, _ = n.rotation, v = n.pull, x = n.swapOpacity, T = n.rotateBy, y = n.widthAuto, w = Qw(Na, Uw), S = Xn(Xn(Xn(Xn(Xn(Xn({
    "fa-beat": t,
    "fa-fade": e,
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
    "fa-border": f,
    "fa-li": p,
    "fa-flip": m === !0,
    "fa-flip-horizontal": m === "horizontal" || m === "both",
    "fa-flip-vertical": m === "vertical" || m === "both"
  }, "fa-".concat(g), typeof g < "u" && g !== null), "fa-rotate-".concat(_), typeof _ < "u" && _ !== null && _ !== 0), "fa-pull-".concat(v), typeof v < "u" && v !== null), "fa-swap-opacity", x), "fa-rotate-by", w && T), "fa-width-auto", w && y);
  return Object.keys(S).map(function(b) {
    return S[b] ? b : null;
  }).filter(function(b) {
    return b;
  });
}
function Qw(n, t) {
  for (var e = n.split("-"), s = ah(e, 2), i = s[0], r = s[1], o = t.split("-"), a = ah(o, 2), c = a[0], l = a[1], u = i.split("."), h = c.split("."), d = 0; d < Math.max(u.length, h.length); d++) {
    var f = u[d] || "0", p = h[d] || "0", m = parseInt(f, 10), g = parseInt(p, 10);
    if (m !== g)
      return m > g;
  }
  for (var _ = 0; _ < Math.max(u.length, h.length); _++) {
    var v = u[_] || "0", x = h[_] || "0";
    if (v !== x && v.length !== x.length)
      return v.length < x.length;
  }
  return !(r && !l);
}
function Jw(n) {
  return n = n - 0, n === n;
}
function xf(n) {
  return Jw(n) ? n : (n = n.replace(/[\-_\s]+(.)?/g, function(t, e) {
    return e ? e.toUpperCase() : "";
  }), n.substr(0, 1).toLowerCase() + n.substr(1));
}
var t1 = ["style"];
function e1(n) {
  return n.charAt(0).toUpperCase() + n.slice(1);
}
function n1(n) {
  return n.split(";").map(function(t) {
    return t.trim();
  }).filter(function(t) {
    return t;
  }).reduce(function(t, e) {
    var s = e.indexOf(":"), i = xf(e.slice(0, s)), r = e.slice(s + 1).trim();
    return i.startsWith("webkit") ? t[e1(i)] = r : t[i] = r, t;
  }, {});
}
function wf(n, t) {
  var e = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
  if (typeof t == "string")
    return t;
  var s = (t.children || []).map(function(c) {
    return wf(n, c);
  }), i = Object.keys(t.attributes || {}).reduce(function(c, l) {
    var u = t.attributes[l];
    switch (l) {
      case "class":
        c.attrs.className = u, delete t.attributes.class;
        break;
      case "style":
        c.attrs.style = n1(u);
        break;
      default:
        l.indexOf("aria-") === 0 || l.indexOf("data-") === 0 ? c.attrs[l.toLowerCase()] = u : c.attrs[xf(l)] = u;
    }
    return c;
  }, {
    attrs: {}
  }), r = e.style, o = r === void 0 ? {} : r, a = Gw(e, t1);
  return i.attrs.style = _n(_n({}, i.attrs.style), o), n.apply(void 0, [t.tag, _n(_n({}, i.attrs), a)].concat(Ma(s)));
}
var Cf = !1;
try {
  Cf = process.env.NODE_ENV === "production";
} catch {
}
function s1() {
  if (!Cf && console && typeof console.error == "function") {
    var n;
    (n = console).error.apply(n, arguments);
  }
}
function ch(n) {
  if (n && Hr(n) === "object" && n.prefix && n.iconName && n.icon)
    return n;
  if (Oa.icon)
    return Oa.icon(n);
  if (n === null)
    return null;
  if (n && Hr(n) === "object" && n.prefix && n.iconName)
    return n;
  if (Array.isArray(n) && n.length === 2)
    return {
      prefix: n[0],
      iconName: n[1]
    };
  if (typeof n == "string")
    return {
      prefix: "fas",
      iconName: n
    };
}
function Ho(n, t) {
  return Array.isArray(t) && t.length > 0 || !Array.isArray(t) && t ? Xn({}, n, t) : {};
}
var lh = {
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
}, mr = /* @__PURE__ */ Kt.forwardRef(function(n, t) {
  var e = _n(_n({}, lh), n), s = e.icon, i = e.mask, r = e.symbol, o = e.className, a = e.title, c = e.titleId, l = e.maskId, u = ch(s), h = Ho("classes", [].concat(Ma(Kw(e)), Ma((o || "").split(" ")))), d = Ho("transform", typeof e.transform == "string" ? Oa.transform(e.transform) : e.transform), f = Ho("mask", ch(i)), p = Dw(u, _n(_n(_n(_n({}, h), d), f), {}, {
    symbol: r,
    title: a,
    titleId: c,
    maskId: l
  }));
  if (!p)
    return s1("Could not find icon", u), null;
  var m = p.abstract, g = {
    ref: t
  };
  return Object.keys(e).forEach(function(_) {
    lh.hasOwnProperty(_) || (g[_] = e[_]);
  }), i1(m[0], g);
});
mr.displayName = "FontAwesomeIcon";
mr.propTypes = {
  beat: wt.bool,
  border: wt.bool,
  beatFade: wt.bool,
  bounce: wt.bool,
  className: wt.string,
  fade: wt.bool,
  flash: wt.bool,
  mask: wt.oneOfType([wt.object, wt.array, wt.string]),
  maskId: wt.string,
  // the fixedWidth property has been deprecated as of version 7
  fixedWidth: wt.bool,
  inverse: wt.bool,
  flip: wt.oneOf([!0, !1, "horizontal", "vertical", "both"]),
  icon: wt.oneOfType([wt.object, wt.array, wt.string]),
  listItem: wt.bool,
  pull: wt.oneOf(["right", "left"]),
  pulse: wt.bool,
  rotation: wt.oneOf([0, 90, 180, 270]),
  rotateBy: wt.bool,
  shake: wt.bool,
  size: wt.oneOf(["2xs", "xs", "sm", "lg", "xl", "2xl", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x"]),
  spin: wt.bool,
  spinPulse: wt.bool,
  spinReverse: wt.bool,
  symbol: wt.oneOfType([wt.bool, wt.string]),
  title: wt.string,
  titleId: wt.string,
  transform: wt.oneOfType([wt.string, wt.object]),
  swapOpacity: wt.bool,
  widthAuto: wt.bool
};
var i1 = wf.bind(null, Kt.createElement), r1 = X.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
  user-select: none;
`, o1 = ({
  formattedTime: n,
  className: t
}) => /* @__PURE__ */ A.jsx(r1, { className: t, "aria-label": "Audio position", children: n }), wl = X.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`, Cl = X.input`
  cursor: pointer;
`, Sl = X.label`
  margin: 0;
  cursor: pointer;
  user-select: none;
`, a1 = ({
  checked: n,
  onChange: t,
  disabled: e = !1,
  className: s
}) => {
  const i = (r) => {
    t(r.target.checked);
  };
  return /* @__PURE__ */ A.jsxs(wl, { className: s, children: [
    /* @__PURE__ */ A.jsx(
      Cl,
      {
        type: "checkbox",
        id: "automatic-scroll",
        className: "automatic-scroll",
        checked: n,
        onChange: i,
        disabled: e
      }
    ),
    /* @__PURE__ */ A.jsx(Sl, { htmlFor: "automatic-scroll", children: "Automatic Scroll" })
  ] });
}, uh = 1e3, c1 = X.div.attrs((n) => ({
  style: {
    width: `${n.$progress}px`,
    height: `${n.$waveHeight}px`
  }
}))`
  position: absolute;
  background: ${(n) => n.$waveProgressColor};
`, l1 = X.canvas.attrs((n) => ({
  style: {
    width: `${n.$cssWidth}px`,
    height: `${n.$waveHeight}px`
  }
}))`
  float: left;
  position: relative;
`, u1 = X.div.attrs((n) => ({
  style: {
    top: `${n.$waveHeight * n.$index}px`,
    width: `${n.$cssWidth}px`,
    height: `${n.$waveHeight}px`
  }
}))`
  position: absolute;
  background: ${(n) => n.$waveFillColor};
`, h1 = (n) => {
  const {
    data: t,
    bits: e,
    length: s,
    index: i,
    className: r,
    progress: o = 0,
    devicePixelRatio: a = 1,
    waveHeight: c = 80,
    waveProgressColor: l = "orange",
    waveOutlineColor: u = "#E0EFF1",
    waveFillColor: h = "grey"
  } = n, d = [], f = xt(
    (_) => {
      if (_ !== null) {
        const v = parseInt(_.dataset.index, 10);
        d[v] = _;
      }
    },
    [d]
  );
  oe(() => {
    let _ = 0;
    for (let v = 0; v < d.length; v++) {
      const x = d[v], T = x.getContext("2d"), y = Math.floor(c / 2), w = 2 ** (e - 1);
      if (T) {
        T.resetTransform(), T.clearRect(0, 0, x.width, x.height), T.imageSmoothingEnabled = !1, T.fillStyle = u, T.scale(a, a);
        const S = x.width / a;
        for (let b = 0; b < S; b += 1) {
          const O = t[(b + _) * 2] / w, D = t[(b + _) * 2 + 1] / w, k = Math.abs(O * y), I = Math.abs(D * y);
          T.fillRect(b, 0, 1, y - I), T.fillRect(b, y + k, 1, y - k);
        }
      }
      _ += uh;
    }
  }, [
    t,
    e,
    c,
    u,
    a,
    s,
    d
  ]);
  let p = s, m = 0;
  const g = [];
  for (; p > 0; ) {
    const _ = Math.min(p, uh), v = /* @__PURE__ */ A.jsx(
      l1,
      {
        $cssWidth: _,
        width: _ * a,
        height: c * a,
        $waveHeight: c,
        "data-index": m,
        ref: f
      },
      `${s}-${m}`
    );
    g.push(v), p -= _, m += 1;
  }
  return /* @__PURE__ */ A.jsxs(
    u1,
    {
      $index: i,
      $cssWidth: s,
      className: r,
      $waveHeight: c,
      $waveFillColor: h,
      children: [
        /* @__PURE__ */ A.jsx(
          c1,
          {
            $progress: o,
            $waveHeight: c,
            $waveProgressColor: l
          }
        ),
        g
      ]
    }
  );
}, Sf = 22, Tf = X.div`
  position: relative;
  height: ${Sf}px;
  background: ${(n) => n.$isSelected ? n.theme.selectedClipHeaderBackgroundColor : n.theme.clipHeaderBackgroundColor};
  border-bottom: 1px solid ${(n) => n.theme.clipHeaderBorderColor};
  display: flex;
  align-items: center;
  padding: 0 8px;
  cursor: ${(n) => n.$interactive ? n.$isDragging ? "grabbing" : "grab" : "default"};
  user-select: none;
  z-index: 110;
  flex-shrink: 0;

  ${(n) => n.$interactive && `
    &:hover {
      background: ${n.theme.clipHeaderBackgroundColor}dd;
    }

    &:active {
      cursor: grabbing;
    }
  `}
`, Af = X.span`
  font-size: 11px;
  font-weight: 600;
  color: ${(n) => n.theme.clipHeaderTextColor};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`, d1 = ({
  trackName: n,
  isSelected: t = !1
}) => /* @__PURE__ */ A.jsx(
  Tf,
  {
    $isDragging: !1,
    $interactive: !1,
    $isSelected: t,
    children: /* @__PURE__ */ A.jsx(Af, { children: n })
  }
), f1 = ({
  clipId: n,
  trackIndex: t,
  clipIndex: e,
  trackName: s,
  isSelected: i = !1,
  disableDrag: r = !1,
  dragHandleProps: o
}) => {
  if (r || !o)
    return /* @__PURE__ */ A.jsx(
      d1,
      {
        trackName: s,
        isSelected: i
      }
    );
  const { attributes: a, listeners: c, setActivatorNodeRef: l } = o;
  return /* @__PURE__ */ A.jsx(
    Tf,
    {
      ref: l,
      "data-clip-id": n,
      $interactive: !0,
      $isSelected: i,
      ...c,
      ...a,
      children: /* @__PURE__ */ A.jsx(Af, { children: s })
    }
  );
}, p1 = 8, m1 = X.div`
  position: absolute;
  ${(n) => n.$edge}: 0;
  top: 0;
  bottom: 0;
  width: ${p1}px;
  cursor: col-resize;
  user-select: none;
  z-index: 105; /* Above waveform, below header */

  /* Invisible by default, visible on hover */
  background: ${(n) => n.$isDragging ? "rgba(255, 255, 255, 0.4)" : n.$isHovered ? "rgba(255, 255, 255, 0.2)" : "transparent"};

  border-${(n) => n.$edge}: 2px solid ${(n) => n.$isDragging ? "rgba(255, 255, 255, 0.8)" : n.$isHovered ? "rgba(255, 255, 255, 0.5)" : "transparent"};

  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-${(n) => n.$edge}: 2px solid rgba(255, 255, 255, 0.5);
  }

  &:active {
    background: rgba(255, 255, 255, 0.4);
    border-${(n) => n.$edge}: 2px solid rgba(255, 255, 255, 0.8);
  }
`, hh = ({
  clipId: n,
  trackIndex: t,
  clipIndex: e,
  edge: s,
  dragHandleProps: i
}) => {
  const [r, o] = Kt.useState(!1);
  if (!i)
    return null;
  const { attributes: a, listeners: c, setActivatorNodeRef: l, isDragging: u } = i;
  return /* @__PURE__ */ A.jsx(
    m1,
    {
      ref: l,
      "data-clip-id": n,
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
}, g1 = X.div.attrs((n) => ({
  style: n.$isOverlay ? {} : {
    left: `${n.$left}px`,
    width: `${n.$width}px`
  }
}))`
  position: ${(n) => n.$isOverlay ? "relative" : "absolute"};
  top: 0;
  height: ${(n) => n.$isOverlay ? "auto" : "100%"};
  width: ${(n) => n.$isOverlay ? `${n.$width}px` : "auto"};
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.05);
  cursor: crosshair; /* Indicates that pressing 'S' will split the clip */

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`, _1 = X.div`
  flex: 1;
  position: relative;
  overflow: ${(n) => n.$isOverlay ? "visible" : "hidden"};
`, dh = ({
  children: n,
  className: t,
  clipId: e,
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
  onMouseDown: f,
  trackId: p
}) => {
  const m = Math.floor(o / c), _ = Math.floor((o + a) / c) - m, v = l && !u && !h, x = `clip-${s}-${i}`, { attributes: T, listeners: y, setNodeRef: w, setActivatorNodeRef: S, transform: b, isDragging: O } = Wo({
    id: x,
    data: { clipId: e, trackIndex: s, clipIndex: i },
    disabled: !v
  }), D = `clip-boundary-left-${s}-${i}`, {
    attributes: k,
    listeners: I,
    setActivatorNodeRef: N,
    isDragging: F
  } = Wo({
    id: D,
    data: { clipId: e, trackIndex: s, clipIndex: i, boundary: "left" },
    disabled: !v
  }), $ = `clip-boundary-right-${s}-${i}`, {
    attributes: L,
    listeners: q,
    setActivatorNodeRef: tt,
    isDragging: j
  } = Wo({
    id: $,
    data: { clipId: e, trackIndex: s, clipIndex: i, boundary: "right" },
    disabled: !v
  }), E = b ? {
    transform: ua.Translate.toString(b),
    zIndex: O ? 100 : void 0
    // Below controls (z-index: 999) but above other clips
  } : void 0;
  return /* @__PURE__ */ A.jsxs(
    g1,
    {
      ref: w,
      style: E,
      className: t,
      $left: m,
      $width: _,
      $isOverlay: h,
      "data-clip-container": "true",
      "data-track-id": p,
      onMouseDown: f,
      children: [
        l && /* @__PURE__ */ A.jsx(
          f1,
          {
            clipId: e,
            trackIndex: s,
            clipIndex: i,
            trackName: r,
            isSelected: d,
            disableDrag: u,
            dragHandleProps: v ? { attributes: T, listeners: y, setActivatorNodeRef: S } : void 0
          }
        ),
        /* @__PURE__ */ A.jsxs(_1, { $isOverlay: h, children: [
          n,
          l && !u && !h && /* @__PURE__ */ A.jsxs(A.Fragment, { children: [
            /* @__PURE__ */ A.jsx(
              hh,
              {
                clipId: e,
                trackIndex: s,
                clipIndex: i,
                edge: "left",
                dragHandleProps: {
                  attributes: k,
                  listeners: I,
                  setActivatorNodeRef: N,
                  isDragging: F
                }
              }
            ),
            /* @__PURE__ */ A.jsx(
              hh,
              {
                clipId: e,
                trackIndex: s,
                clipIndex: i,
                edge: "right",
                dragHandleProps: {
                  attributes: L,
                  listeners: q,
                  setActivatorNodeRef: tt,
                  isDragging: j
                }
              }
            )
          ] })
        ] })
      ]
    }
  );
}, y1 = X.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`, v1 = X.label`
  margin: 0;
  white-space: nowrap;
`, b1 = X.input`
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`, x1 = ({
  volume: n,
  onChange: t,
  disabled: e = !1,
  className: s
}) => {
  const i = (r) => {
    t(parseFloat(r.target.value) / 100);
  };
  return /* @__PURE__ */ A.jsxs(y1, { className: s, children: [
    /* @__PURE__ */ A.jsx(v1, { htmlFor: "master-gain", children: "Master Volume" }),
    /* @__PURE__ */ A.jsx(
      b1,
      {
        type: "range",
        min: "0",
        max: "100",
        value: n * 100,
        onChange: i,
        disabled: e,
        id: "master-gain",
        className: "master-gain form-control"
      }
    )
  ] });
}, w1 = X.div.attrs((n) => ({
  style: {
    transform: `translate3d(${n.$position}px, 0, 0)`
  }
}))`
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background: ${(n) => n.$color};
  height: 100%;
  z-index: 150;
  pointer-events: none;
  will-change: transform;
`, kf = ({ position: n, color: t = "#ff0000" }) => /* @__PURE__ */ A.jsx(w1, { $position: n, $color: t }), C1 = X.div`
  overflow-y: hidden;
  overflow-x: auto;
  position: relative;
`, S1 = X.div`
  position: relative;
  background: ${(n) => n.$backgroundColor || "transparent"};
  ${(n) => n.$width !== void 0 && `width: ${n.$width}px;`}
`, T1 = X.div`
  background: ${(n) => n.$backgroundColor || "white"};
  ${(n) => n.$width && `min-width: ${n.$width}px;`}
  width: 100%;
  overflow: visible;
`, A1 = X.div`
  position: relative;
  background: ${(n) => n.$backgroundColor || "transparent"};
  ${(n) => n.$width !== void 0 && `min-width: ${n.$width}px;`}
  width: 100%;
`, k1 = X.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: crosshair;
  z-index: 100;
`, Tl = ({
  children: n,
  backgroundColor: t,
  timescaleBackgroundColor: e,
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
}) => /* @__PURE__ */ A.jsx(C1, { "data-scroll-container": "true", ref: d, children: /* @__PURE__ */ A.jsxs(
  S1,
  {
    $backgroundColor: t,
    $width: o,
    children: [
      s && /* @__PURE__ */ A.jsx(T1, { $width: i, $backgroundColor: e, children: s }),
      /* @__PURE__ */ A.jsxs(A1, { $width: r, $backgroundColor: t, children: [
        n,
        (c || l) && /* @__PURE__ */ A.jsx(
          k1,
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
xh(Tl);
var I1 = X.div.attrs((n) => ({
  style: {
    left: `${n.$left}px`,
    width: `${n.$width}px`
  }
}))`
  position: absolute;
  top: 0;
  background: ${(n) => n.$color};
  height: 100%;
  z-index: 5;
  pointer-events: none;
  opacity: 0.3;
`, If = ({
  startPosition: n,
  endPosition: t,
  color: e = "#00ff00"
}) => {
  const s = Math.max(0, t - n);
  return s <= 0 ? null : /* @__PURE__ */ A.jsx(I1, { $left: n, $width: s, $color: e });
};
function Ti(n, t) {
  const e = Math.floor(n / 3600) % 24, s = Math.floor(n / 60) % 60, i = (n % 60).toFixed(t);
  return String(e).padStart(2, "0") + ":" + String(s).padStart(2, "0") + ":" + i.padStart(t + 3, "0");
}
function Pa(n, t) {
  switch (t) {
    case "seconds":
      return n.toFixed(0);
    case "thousandths":
      return n.toFixed(3);
    case "hh:mm:ss":
      return Ti(n, 0);
    case "hh:mm:ss.u":
      return Ti(n, 1);
    case "hh:mm:ss.uu":
      return Ti(n, 2);
    case "hh:mm:ss.uuu":
      return Ti(n, 3);
    default:
      return Ti(n, 3);
  }
}
function E1(n, t) {
  if (!n) return 0;
  switch (t) {
    case "seconds":
    case "thousandths":
      return parseFloat(n) || 0;
    case "hh:mm:ss":
    case "hh:mm:ss.u":
    case "hh:mm:ss.uu":
    case "hh:mm:ss.uuu": {
      const e = n.split(":");
      if (e.length !== 3) return 0;
      const s = parseInt(e[0], 10) || 0, i = parseInt(e[1], 10) || 0, r = parseFloat(e[2]) || 0;
      return s * 3600 + i * 60 + r;
    }
    default:
      return 0;
  }
}
var fh = ({
  id: n,
  label: t,
  value: e,
  format: s,
  className: i = "form-control mr-sm-2",
  onChange: r,
  readOnly: o = !1
}) => {
  const [a, c] = pt("");
  oe(() => {
    const d = Pa(e, s);
    c(d);
  }, [e, s, n]);
  const l = (d) => {
    const f = d.target.value;
    c(f);
  }, u = () => {
    if (r) {
      const d = E1(a, s);
      r(d);
    }
    c(Pa(e, s));
  }, h = (d) => {
    d.key === "Enter" && d.currentTarget.blur();
  };
  return /* @__PURE__ */ A.jsxs(A.Fragment, { children: [
    /* @__PURE__ */ A.jsx("label", { className: "sr-only", htmlFor: n, children: t }),
    /* @__PURE__ */ A.jsx(
      "input",
      {
        type: "text",
        className: i,
        id: n,
        value: a,
        onChange: l,
        onBlur: u,
        onKeyDown: h,
        readOnly: o
      }
    )
  ] });
}, D1 = ({
  selectionStart: n,
  selectionEnd: t,
  onSelectionChange: e,
  className: s
}) => {
  const [i, r] = pt("hh:mm:ss.uuu");
  oe(() => {
    const c = document.querySelector(".time-format"), l = () => {
      c && r(c.value);
    };
    return c && (r(c.value), c.addEventListener("change", l)), () => {
      c?.removeEventListener("change", l);
    };
  }, []);
  const o = (c) => {
    e && e(c, t);
  }, a = (c) => {
    e && e(n, c);
  };
  return /* @__PURE__ */ A.jsxs(A.Fragment, { children: [
    /* @__PURE__ */ A.jsx(
      fh,
      {
        id: "audio_start",
        label: "Start of audio selection",
        value: n,
        format: i,
        className: "audio-start form-control mr-sm-2",
        onChange: o
      }
    ),
    /* @__PURE__ */ A.jsx(
      fh,
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
var Ef = Xe(Nr()), Df = ({ children: n }) => {
  const [t, e] = pt(Nr());
  return matchMedia(`(resolution: ${Nr()}dppx)`).addEventListener(
    "change",
    () => {
      e(Nr());
    },
    { once: !0 }
  ), /* @__PURE__ */ A.jsx(Ef.Provider, { value: Math.ceil(t), children: n });
}, Of = () => je(Ef), Ao = Xe({
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
}), Al = () => je(Ao), Rf = () => je(ap), kl = Xe(/* @__PURE__ */ A.jsx(rp, {})), O1 = () => je(kl), Mf = 0, Nf = !1, Pf = 0, Ff = 0, R1 = {
  progress: Mf,
  isPlaying: Nf,
  selectionStart: Pf,
  selectionEnd: Ff
}, Vf = Xe(R1), Wf = Xe({
  setIsPlaying: () => {
  },
  setProgress: () => {
  },
  setSelection: () => {
  }
}), M1 = ({ children: n }) => {
  const [t, e] = pt(Nf), [s, i] = pt(Mf), [r, o] = pt(Pf), [a, c] = pt(Ff), l = (u, h) => {
    o(u), c(h);
  };
  return /* @__PURE__ */ A.jsx(Wf.Provider, { value: { setIsPlaying: e, setProgress: i, setSelection: l }, children: /* @__PURE__ */ A.jsx(Vf.Provider, { value: { isPlaying: t, progress: s, selectionStart: r, selectionEnd: a }, children: n }) });
}, N1 = () => je(Vf), P1 = () => je(Wf), Fa = ({ isSelected: n, ...t }) => {
  const e = Rf(), { waveHeight: s } = Al(), i = Of(), r = n && e ? e.selectedWaveOutlineColor : e?.waveOutlineColor, o = n && e ? e.selectedWaveFillColor : e?.waveFillColor;
  return /* @__PURE__ */ A.jsx(
    h1,
    {
      ...t,
      ...e,
      waveOutlineColor: r,
      waveFillColor: o,
      waveHeight: s,
      devicePixelRatio: i
    }
  );
};
function cn(n, t, e) {
  return Math.ceil(n * e / t);
}
function F1(n) {
  const t = Math.floor(n / 1e3), e = t % 60;
  return `${(t - e) / 60}:${String(e).padStart(2, "0")}`;
}
var V1 = X.div.attrs((n) => ({
  style: {
    width: `${n.$cssWidth}px`,
    marginLeft: `${n.$controlWidth}px`,
    height: `${n.$timeScaleHeight}px`
  }
}))`
  position: relative;
  overflow: visible; /* Allow time labels to render above the container */
`, W1 = X.canvas.attrs((n) => ({
  style: {
    width: `${n.$cssWidth}px`,
    height: `${n.$timeScaleHeight}px`
  }
}))`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
`, j1 = X.div.attrs((n) => ({
  style: {
    left: `${n.$left + 4}px`
    // Offset 4px to the right of the tick
  }
}))`
  position: absolute;
  font-size: 0.75rem; /* Smaller font to prevent overflow */
  white-space: nowrap; /* Prevent text wrapping */
  color: ${(n) => n.theme.timeColor}; /* Use theme color instead of inheriting */
`, L1 = (n) => {
  const {
    theme: { timeColor: t },
    duration: e,
    marker: s,
    bigStep: i,
    secondStep: r,
    renderTimestamp: o
  } = n, a = /* @__PURE__ */ new Map(), c = [], l = Et(null), {
    sampleRate: u,
    samplesPerPixel: h,
    timeScaleHeight: d,
    controls: { show: f, width: p }
  } = je(Ao), m = Of();
  oe(() => {
    if (l.current !== null) {
      const x = l.current, T = x.getContext("2d");
      if (T) {
        T.resetTransform(), T.clearRect(0, 0, x.width, x.height), T.imageSmoothingEnabled = !1, T.fillStyle = t, T.scale(m, m);
        for (const [y, w] of a.entries()) {
          const S = d - w;
          T.fillRect(y, S, 1, w);
        }
      }
    }
  }, [
    e,
    m,
    t,
    d,
    i,
    r,
    s,
    a
  ]);
  const g = cn(e / 1e3, h, u), _ = u / h;
  let v = 0;
  for (let x = 0; x < g; x += _ * r / 1e3) {
    const T = Math.floor(x);
    if (v % s === 0) {
      const y = v, w = F1(y), S = o ? /* @__PURE__ */ A.jsx(Kt.Fragment, { children: o(y, T) }, `timestamp-${v}`) : /* @__PURE__ */ A.jsx(j1, { $left: T, children: w }, w);
      c.push(S), a.set(T, d);
    } else v % i === 0 ? a.set(T, Math.floor(d / 2)) : v % r === 0 && a.set(T, Math.floor(d / 5));
    v += r;
  }
  return /* @__PURE__ */ A.jsxs(
    V1,
    {
      $cssWidth: g,
      $controlWidth: f ? p : 0,
      $timeScaleHeight: d,
      children: [
        c,
        /* @__PURE__ */ A.jsx(
          W1,
          {
            $cssWidth: g,
            $timeScaleHeight: d,
            width: g * m,
            height: d * m,
            ref: l
          }
        )
      ]
    }
  );
}, jf = xh(L1), q1 = X.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`, B1 = X.select`
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  cursor: pointer;

  &:focus {
    border-color: #80bdff;
    outline: 0;
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
  }

  &:disabled {
    background-color: #e9ecef;
    cursor: not-allowed;
  }
`, $1 = [
  { value: "seconds", label: "seconds" },
  { value: "thousandths", label: "thousandths" },
  { value: "hh:mm:ss", label: "hh:mm:ss" },
  { value: "hh:mm:ss.u", label: "hh:mm:ss + tenths" },
  { value: "hh:mm:ss.uu", label: "hh:mm:ss + hundredths" },
  { value: "hh:mm:ss.uuu", label: "hh:mm:ss + milliseconds" }
], z1 = ({
  value: n,
  onChange: t,
  disabled: e = !1,
  className: s
}) => {
  const i = (r) => {
    t(r.target.value);
  };
  return /* @__PURE__ */ A.jsx(q1, { className: s, children: /* @__PURE__ */ A.jsx(
    B1,
    {
      className: "time-format",
      value: n,
      onChange: i,
      disabled: e,
      "aria-label": "Time format selection",
      children: $1.map((r) => /* @__PURE__ */ A.jsx("option", { value: r.value, children: r.label }, r.value))
    }
  ) });
}, G1 = X.div.attrs((n) => ({
  style: {
    height: `${n.$waveHeight * n.$numChannels + (n.$hasClipHeaders ? Sf : 0)}px`
  }
}))`
  position: relative;
  display: flex;
  ${(n) => n.$width !== void 0 && `width: ${n.$width}px;`}
`, Z1 = X.div.attrs((n) => ({
  style: {
    paddingLeft: `${n.$offset || 0}px`
  }
}))`
  position: relative;
  background: ${(n) => n.$backgroundColor || "transparent"};
  flex: 1;
`, Y1 = X.div.attrs((n) => ({
  style: {
    width: `${n.$controlWidth}px`
  }
}))`
  position: sticky;
  z-index: 999;
  left: 0;
  height: 100%;
  flex-shrink: 0;
  pointer-events: auto;
  background: #fff;

  /* Selected track: highlighted background */
  ${(n) => n.$isSelected && `
    background: ${n.theme.selectedTrackControlsBackground};
    transition: background 0.15s ease-in-out;
  `}
`, Lf = ({
  numChannels: n,
  children: t,
  className: e,
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
  } = Al(), f = O1();
  return /* @__PURE__ */ A.jsxs(
    G1,
    {
      $numChannels: n,
      className: e,
      $waveHeight: u,
      $controlWidth: h ? d : 0,
      $width: r,
      $hasClipHeaders: o,
      $isSelected: l,
      children: [
        /* @__PURE__ */ A.jsx(
          Y1,
          {
            $controlWidth: h ? d : 0,
            $isSelected: l,
            children: f
          }
        ),
        /* @__PURE__ */ A.jsx(
          Z1,
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
}, Kr = X.button.attrs({
  type: "button"
})`
  display: inline-block;
  font-weight: 400;
  text-align: center;
  vertical-align: middle;
  user-select: none;
  padding: 0.25rem 0.4rem;
  font-size: 0.875rem;
  line-height: 0.5;
  border-radius: 0.2rem;
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out,
    border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  cursor: pointer;

  ${(n) => n.$variant === "danger" ? `
        color: #fff;
        background-color: #dc3545;
        border: 1px solid #dc3545;

        &:hover {
          background-color: #c82333;
          border-color: #bd2130;
        }

        &:active:focus, &:focus {
          box-shadow: 0 0 0 0.2rem rgba(225, 83, 97, 0.5);
        }
      ` : n.$variant === "info" ? `
        color: #fff;
        background-color: #17a2b8;
        border: 1px solid #17a2b8;

        &:hover {
          background-color: #138496;
          border-color: #117a8b;
        }

        &:active:focus, &:focus {
          box-shadow: 0 0 0 0.2rem rgba(58, 176, 195, 0.5);
        }
      ` : `
        color: #343a40;
        background-color: transparent;
        border: 1px solid #343a40;

        &:hover {
          color: #fff;
          background-color: #343a40;
          border-color: #343a40;
        }

        &:active:focus, &:focus {
          box-shadow: 0 0 0 0.2rem rgba(52, 58, 64, 0.5);
        }
      `}
`, X1 = X.div`
  margin-bottom: 0.3rem;

  button:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  button:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
`, qf = X.div`
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
  border: 1px solid #000;
  border-radius: 0.2rem;
`, U1 = X.header`
  overflow: hidden;
  height: 26px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.2rem;
  font-size: 0.75rem;
  color: #000;
  background-color: transparent;
`, Bf = X(mr).attrs({
  icon: Ab
})``, $f = X(mr).attrs({
  icon: Ib
})``;
Ew.add(Sb);
X(mr).attrs({
  icon: "trash-alt"
})``;
var Qr = X.input.attrs({
  type: "range"
})`
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  display: inline-block;
  width: 75%;

  &::-webkit-slider-runnable-track {
    height: 5px;
    background: #ddd;
    border: none;
    border-radius: 3px;
  }

  &::-moz-range-track {
    height: 5px;
    background: #ddd;
    border: none;
    border-radius: 3px;
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border: none;
    height: 12px;
    width: 12px;
    border-radius: 50%;
    background: goldenrod;
    margin-top: -5px;
    cursor: ew-resize;
  }

  &::-moz-range-thumb {
    border: none;
    height: 12px;
    width: 12px;
    border-radius: 50%;
    background: goldenrod;
    cursor: ew-resize;
  }

  &:focus {
    outline: none;
  }

  &:focus::-webkit-slider-runnable-track {
    background: #bbb;
  }

  &:focus::-moz-range-track {
    background: #bbb;
  }

  &:focus::-webkit-slider-thumb {
    border: 2px solid black;
  }

  &:focus::-moz-range-thumb {
    border: 2px solid black;
  }
`, ph = X.label`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
  margin-bottom: 0.2rem;
  font-size: 14px;
`;
X.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;
X.svg`
  cursor: pointer;
  user-select: none;
`;
X.span`
  font-size: 9px;
  color: #666;
  font-weight: bold;
  text-transform: uppercase;
`;
X.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.5rem 0.25rem 0.5rem;
`;
X.span`
  flex: 1;
  font-weight: 600;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0 0.25rem;
`;
X.button`
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
var mh = {
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
}, Tn = X.button`
  padding: 0.5rem 1rem;
  background: ${(n) => mh[n.variant || "primary"].background};
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: ${(n) => n.variant === "info" ? "600" : "normal"};

  &:hover:not(:disabled) {
    background: ${(n) => mh[n.variant || "primary"].hover};
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    opacity: ${(n) => n.variant === "info" ? "0.6" : "1"};
  }
`, H1 = {
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
  selectionColor: "rgba(0, 255, 0, 0.3)",
  clipHeaderBackgroundColor: "rgba(0, 0, 0, 0.1)",
  clipHeaderBorderColor: "rgba(0, 0, 0, 0.2)",
  clipHeaderTextColor: "#333",
  selectedClipHeaderBackgroundColor: "#b3d9ff"
  // Brighter blue for selected track clip headers
};
function K1(n) {
  return {
    id: n.id,
    start: parseFloat(n.begin),
    end: parseFloat(n.end),
    lines: n.lines,
    lang: n.language
  };
}
function Q1(n) {
  return {
    id: n.id,
    begin: n.start.toFixed(3),
    end: n.end.toFixed(3),
    lines: n.lines,
    language: n.lang || "en"
  };
}
X.div.attrs((n) => ({
  style: {
    left: `${n.$left}px`,
    width: `${n.$width}px`
  }
}))`
  position: absolute;
  top: 0;
  background: ${(n) => n.$color};
  height: 100%;
  z-index: 10;
  pointer-events: auto;
  opacity: 0.3;
  border: 2px solid ${(n) => n.$color};
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    opacity: 0.5;
    border-color: ${(n) => n.$color};
  }
`;
X.div`
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
X.textarea`
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
X.div`
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
X.button`
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
var J1 = X.div.attrs((n) => ({
  style: {
    left: `${n.$left}px`,
    width: `${n.$width}px`
  }
}))`
  position: absolute;
  top: 0;
  height: 100%;
  background: ${(n) => n.$isActive ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.85)"};
  border: 2px solid ${(n) => n.$isActive ? "#d67600" : n.$color};
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
    background: rgba(255, 255, 255, 0.98);
    border-color: #d67600;
    border-width: 3px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
`, tC = X.span`
  font-size: 12px;
  font-weight: 600;
  color: #2a2a2a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 6px;
  letter-spacing: 0.3px;
  user-select: none;
`, gh = X.div`
  position: absolute;
  top: 0;
  ${(n) => n.$position}: -15px;
  width: 30px;
  height: 100%;
  cursor: ew-resize;
  z-index: 2;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 70%;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 3px;
    opacity: 0.7;
    transition: opacity 0.2s, background 0.2s;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.15);
  }

  &:hover::before {
    opacity: 1;
    background: rgba(0, 0, 0, 0.8);
  }
`, zf = ({
  startPosition: n,
  endPosition: t,
  label: e,
  color: s = "#ff9800",
  isActive: i = !1,
  onClick: r,
  onDragStart: o,
  onDrag: a,
  onDragEnd: c
}) => {
  const l = Math.max(0, t - n);
  if (l <= 0)
    return null;
  const u = (d) => (f) => {
    const p = document.createElement("div");
    p.style.position = "absolute", p.style.top = "-9999px", p.style.width = "1px", p.style.height = "1px", p.style.opacity = "0", document.body.appendChild(p), f.dataTransfer.setDragImage(p, 0, 0), f.dataTransfer.effectAllowed = "move", setTimeout(() => {
      document.body.removeChild(p);
    }, 0), o && o(d, f);
  }, h = (d) => {
    d.stopPropagation();
  };
  return /* @__PURE__ */ A.jsxs(
    J1,
    {
      $left: n,
      $width: l,
      $color: s,
      $isActive: i,
      onClick: r,
      children: [
        /* @__PURE__ */ A.jsx(
          gh,
          {
            $position: "left",
            draggable: "true",
            onDragStart: u("start"),
            onDrag: a,
            onDragEnd: c,
            onClick: h
          }
        ),
        e && /* @__PURE__ */ A.jsx(tC, { children: e }),
        /* @__PURE__ */ A.jsx(
          gh,
          {
            $position: "right",
            draggable: "true",
            onDragStart: u("end"),
            onDrag: a,
            onDragEnd: c,
            onClick: h
          }
        )
      ]
    }
  );
}, eC = X.div.attrs((n) => ({
  style: {
    height: `${n.$height}px`
  }
}))`
  position: relative;
  display: flex;
  ${(n) => n.$width !== void 0 && `width: ${n.$width}px;`}
  background: #f5f5f5;
  border-top: 2px solid #ddd;
  border-bottom: 1px solid #ddd;
  z-index: 110;
`, nC = X.div`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(n) => n.$controlWidth}px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #ddd;
`, sC = X.div`
  position: relative;
  flex: 1;
  padding-left: ${(n) => n.$offset || 0}px;
`, Gf = ({
  children: n,
  className: t,
  height: e = 30,
  offset: s = 0,
  width: i
}) => {
  const {
    controls: { show: r, width: o }
  } = Al();
  return /* @__PURE__ */ A.jsxs(
    eC,
    {
      className: t,
      $height: e,
      $controlWidth: r ? o : 0,
      $width: i,
      children: [
        /* @__PURE__ */ A.jsx(nC, { $controlWidth: r ? o : 0 }),
        /* @__PURE__ */ A.jsx(sC, { $offset: s, children: n })
      ]
    }
  );
};
X.div.attrs((n) => ({
  style: {
    height: `${n.$height}px`
  }
}))`
  position: relative;
  display: flex;
  ${(n) => n.$width !== void 0 && `width: ${n.$width}px;`}
  background: #f5f5f5;
  border-top: 2px solid #ddd;
`;
X.div`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(n) => n.$controlWidth}px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666;
  font-weight: bold;
`;
X.div`
  position: relative;
  flex: 1;
  padding-left: ${(n) => n.$offset || 0}px;
`;
var iC = X.div`
  background: #fff;
  border-top: 2px solid #ddd;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
`, rC = X.div`
  padding: 12px;
  margin-bottom: 6px;
  border-left: 4px solid ${(n) => n.$isActive ? "#ff9800" : "#ccc"};
  background: ${(n) => n.$isActive ? "#fff3e0" : "#f9f9f9"};
  border-radius: 4px;
  transition: all 0.2s;
  cursor: pointer;
  box-shadow: ${(n) => n.$isActive ? "0 2px 4px rgba(255, 152, 0, 0.2)" : "none"};

  &:hover {
    background: ${(n) => n.$isActive ? "#ffe9cc" : "#f0f0f0"};
    border-left-color: #ff9800;
  }
`, oC = X.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`, aC = X.span`
  font-size: 12px;
  font-weight: 500;
  color: #555;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  letter-spacing: 0.5px;
`, cC = X.div`
  display: flex;
  gap: 6px;
`, lC = X.button`
  background: transparent;
  border: 1px solid #ccc;
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: #e8e8e8;
    border-color: #999;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`, uC = X.div`
  font-size: 14px;
  line-height: 1.6;
  color: #2a2a2a;
  white-space: pre-wrap;
  word-break: break-word;
  outline: ${(n) => n.$isEditable ? "1px dashed #ddd" : "none"};
  padding: ${(n) => n.$isEditable ? "6px" : "0"};
  border-radius: 3px;
  min-height: 20px;

  &[contenteditable='true']:focus {
    outline: 2px solid #ff9800;
    background: #fffef7;
  }
`, hC = ({
  annotations: n,
  activeAnnotationId: t,
  shouldScrollToActive: e = !1,
  editable: s = !1,
  controls: i = [],
  annotationListConfig: r,
  onAnnotationClick: o,
  onAnnotationUpdate: a
}) => {
  const c = Et(null), l = Et(null), u = Et(void 0);
  oe(() => {
  }), oe(() => {
    const m = l.current;
    if (!m) return;
    const g = () => {
    };
    return m.addEventListener("scroll", g), () => m.removeEventListener("scroll", g);
  }, []), oe(() => {
    t && c.current && e && c.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    }), u.current = t;
  }, [t, e]);
  const h = (m) => {
    if (isNaN(m) || !isFinite(m))
      return "0:00.000";
    const g = Math.floor(m / 60), _ = (m % 60).toFixed(3);
    return `${g}:${_.padStart(6, "0")}`;
  }, d = (m, g) => {
    if (!s || !a) return;
    const _ = [...n];
    _[m] = {
      ..._[m],
      lines: g.split(`
`)
    }, a(_);
  }, f = (m, g, _) => {
    if (!a) return;
    const v = [...n];
    m.action(v[_], _, v, r || {}), a(v);
  }, p = (m) => m.replace(/\./g, " ");
  return /* @__PURE__ */ A.jsx(iC, { ref: l, children: n.map((m, g) => {
    const _ = m.id === t;
    return /* @__PURE__ */ A.jsxs(
      rC,
      {
        ref: _ ? c : null,
        $isActive: _,
        children: [
          /* @__PURE__ */ A.jsxs(oC, { children: [
            /* @__PURE__ */ A.jsxs(aC, { children: [
              h(m.start),
              " - ",
              h(m.end)
            ] }),
            i.length > 0 && /* @__PURE__ */ A.jsx(cC, { onClick: (v) => v.stopPropagation(), children: i.map((v, x) => /* @__PURE__ */ A.jsx(
              lC,
              {
                title: v.title,
                onClick: () => f(v, m, g),
                children: v.text ? v.text : /* @__PURE__ */ A.jsx("i", { className: p(v.class || "") })
              },
              x
            )) })
          ] }),
          /* @__PURE__ */ A.jsx(
            uC,
            {
              $isEditable: s,
              contentEditable: s,
              suppressContentEditableWarning: !0,
              onBlur: (v) => d(g, v.currentTarget.textContent || ""),
              children: m.lines.join(`
`)
            }
          )
        ]
      },
      m.id
    );
  }) });
}, Zf = Kt.memo(hC), dC = ({
  checked: n,
  onChange: t,
  disabled: e = !1,
  className: s
}) => {
  const i = (r) => {
    t(r.target.checked);
  };
  return /* @__PURE__ */ A.jsxs(wl, { className: s, children: [
    /* @__PURE__ */ A.jsx(
      Cl,
      {
        type: "checkbox",
        id: "continuous-play",
        className: "continuous-play",
        checked: n,
        onChange: i,
        disabled: e
      }
    ),
    /* @__PURE__ */ A.jsx(Sl, { htmlFor: "continuous-play", children: "Continuous Play" })
  ] });
}, fC = ({
  checked: n,
  onChange: t,
  disabled: e = !1,
  className: s
}) => {
  const i = (r) => {
    t(r.target.checked);
  };
  return /* @__PURE__ */ A.jsxs(wl, { className: s, children: [
    /* @__PURE__ */ A.jsx(
      Cl,
      {
        type: "checkbox",
        id: "link-endpoints",
        className: "link-endpoints",
        checked: n,
        onChange: i,
        disabled: e
      }
    ),
    /* @__PURE__ */ A.jsx(Sl, { htmlFor: "link-endpoints", children: "Link Endpoints" })
  ] });
}, pC = ({
  annotations: n,
  filename: t = "annotations.json",
  disabled: e = !1,
  className: s,
  children: i = "Download JSON"
}) => {
  const r = () => {
    if (n.length === 0)
      return;
    const o = n.map((h) => Q1(h)), a = JSON.stringify(o, null, 2), c = new Blob([a], { type: "application/json" }), l = URL.createObjectURL(c), u = document.createElement("a");
    u.href = l, u.download = t, document.body.appendChild(u), u.click(), document.body.removeChild(u), URL.revokeObjectURL(l);
  };
  return /* @__PURE__ */ A.jsx(
    Tn,
    {
      variant: "info",
      onClick: r,
      disabled: e || n.length === 0,
      className: s,
      title: n.length === 0 ? "No annotations to download" : "Download the annotations as JSON",
      children: i
    }
  );
}, Ko = 0.01, mC = (n = {}) => {
  const {
    initialContinuousPlay: t = !1,
    initialLinkEndpoints: e = !0
  } = n, [s, i] = pt(t), [r, o] = pt(e), a = xt(
    ({
      annotationIndex: c,
      newTime: l,
      isDraggingStart: u,
      annotations: h,
      duration: d
    }) => {
      const f = [...h], p = h[c];
      if (u) {
        const m = Math.min(p.end - 0.1, Math.max(0, l)), g = m - p.start;
        if (f[c] = {
          ...p,
          start: m
        }, r && c > 0) {
          const _ = f[c - 1];
          Math.abs(_.end - p.start) < Ko && (f[c - 1] = {
            ..._,
            end: Math.max(_.start + 0.1, _.end + g)
          });
        } else !r && c > 0 && m < f[c - 1].end && (f[c - 1] = {
          ...f[c - 1],
          end: m
        });
      } else {
        const m = Math.max(p.start + 0.1, Math.min(l, d)), g = m - p.end;
        if (f[c] = {
          ...p,
          end: m
        }, r && c < f.length - 1) {
          const _ = f[c + 1];
          if (Math.abs(_.start - p.end) < Ko) {
            const v = _.start + g;
            f[c + 1] = {
              ..._,
              start: Math.min(_.end - 0.1, v)
            };
            let x = c + 1;
            for (; x < f.length - 1; ) {
              const T = f[x], y = f[x + 1];
              if (Math.abs(y.start - T.end) < Ko) {
                const w = T.end - h[x].end;
                f[x + 1] = {
                  ...y,
                  start: Math.min(y.end - 0.1, y.start + w)
                }, x++;
              } else
                break;
            }
          }
        } else if (!r && c < f.length - 1 && m > f[c + 1].start) {
          const _ = f[c + 1];
          f[c + 1] = {
            ..._,
            start: m
          };
          let v = c + 1;
          for (; v < f.length - 1; ) {
            const x = f[v], T = f[v + 1];
            if (x.end > T.start)
              f[v + 1] = {
                ...T,
                start: x.end
              }, v++;
            else
              break;
          }
        }
      }
      return f;
    },
    [r]
  );
  return {
    continuousPlay: s,
    linkEndpoints: r,
    setContinuousPlay: i,
    setLinkEndpoints: o,
    updateAnnotationBoundaries: a
  };
};
function gC(n) {
  let t = 1 / 0, e = -1 / 0;
  for (let s = 0; s < n.length; s++) {
    const i = n[s];
    t > i && (t = i), e < i && (e = i);
  }
  return { min: t, max: e };
}
function _h(n, t) {
  const e = Math.pow(2, t - 1), s = n < 0 ? n * e : n * (e - 1);
  return Math.max(-e, Math.min(e - 1, s));
}
function Yf(n, t) {
  switch (n) {
    case 8:
      return new Int8Array(t);
    case 16:
      return new Int16Array(t);
  }
}
function yh(n, t, e) {
  const s = n.length, i = Math.ceil(s / t), r = Yf(e, i * 2);
  for (let o = 0; o < i; o++) {
    const a = o * t, c = Math.min((o + 1) * t, s), l = n.subarray(a, c), u = gC(l), h = _h(u.min, e), d = _h(u.max, e);
    r[o * 2] = h, r[o * 2 + 1] = d;
  }
  return r;
}
function _C(n, t) {
  const e = n.length, s = 1 / e, i = n[0].length / 2, r = Yf(t, i * 2);
  for (let o = 0; o < i; o++) {
    let a = 0, c = 0;
    for (let l = 0; l < e; l++)
      a += s * n[l][o * 2], c += s * n[l][o * 2 + 1];
    r[o * 2] = a, r[o * 2 + 1] = c;
  }
  return [r];
}
function yC(n, t = 1e3, e = !0, s = 0, i, r = 16) {
  if (r !== 8 && r !== 16)
    throw new Error("Invalid number of bits specified for peaks. Must be 8 or 16.");
  let o = [];
  if ("getChannelData" in n) {
    const c = n.numberOfChannels, l = i ?? n.length;
    for (let u = 0; u < c; u++) {
      const d = n.getChannelData(u).subarray(s, l);
      o.push(yh(d, t, r));
    }
  } else {
    const c = i ?? n.length, l = n.subarray(s, c);
    o.push(yh(l, t, r));
  }
  return e && o.length > 1 && (o = _C(o, r)), {
    length: o[0].length / 2,
    data: o,
    bits: r
  };
}
function Va(n, t = 1e3, e = !0, s = 8, i = 0, r) {
  const o = n.sampleRate, a = Math.floor(i * o), c = r !== void 0 ? Math.floor((i + r) * o) : void 0;
  return yC(n, t, e, a, c, s);
}
function vC() {
  const [n, t] = pt("hh:mm:ss.uuu");
  return {
    timeFormat: n,
    setTimeFormat: t,
    formatTime: (s) => Pa(s, n)
  };
}
const bC = [256, 512, 1024, 2048, 4096, 8192];
function xC({
  initialSamplesPerPixel: n,
  zoomLevels: t = bC
}) {
  const [e, s] = pt(() => {
    const l = t.indexOf(n);
    return l !== -1 ? l : Math.floor(t.length / 2);
  }), i = t[e], r = e > 0, o = e < t.length - 1, a = xt(() => {
    s((l) => Math.max(0, l - 1));
  }, []), c = xt(() => {
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
function wC({
  playoutRef: n,
  initialVolume: t = 1,
  onVolumeChange: e
}) {
  const [s, i] = pt(t), r = xt((o) => {
    i(o), n.current && n.current.setMasterGain(o), e?.(o);
  }, [n, e]);
  return {
    masterVolume: s,
    setMasterVolume: r
  };
}
const PS = (n = 256) => {
  const t = Et(null), e = xt((s, i, r) => {
    const o = new Os("fft", n);
    return s.connect(o), s.connect(i), t.current = o, function() {
      o.dispose(), t.current = null;
    };
  }, [n]);
  return { analyserRef: t, masterEffects: e };
}, FS = (n = 1.2) => xt((e, s, i) => {
  const r = new yo({
    context: e.context,
    decay: n
  });
  return e.connect(r), r.connect(s), function() {
    r.disconnect(), r.dispose();
  };
}, [n]), VS = (n = {}) => {
  const { baseFrequency: t = 50, octaves: e = 6, sensitivity: s = -30 } = n;
  return xt((r, o, a) => {
    const c = new _o({
      context: r.context,
      baseFrequency: t,
      octaves: e,
      sensitivity: s
    });
    return r.connect(c), c.connect(o), function() {
      c.disconnect(), c.dispose();
    };
  }, [t, e, s]);
}, WS = (n) => xt((e, s, i) => {
  if (n.length === 0) {
    e.connect(s);
    return;
  }
  if (n.length === 1)
    return n[0](e, s, i);
  const r = [], o = [];
  return n.forEach((a, c) => {
    const l = new Os("waveform", 1024);
    o.push(l);
    const u = a(
      c === 0 ? e : o[c - 1],
      l,
      i
    );
    u && r.push(u);
  }), o[o.length - 1].connect(s), function() {
    r.forEach((c) => c()), o.forEach((c) => c.dispose());
  };
}, [n]);
function Wa(n) {
  const {
    audioBuffer: t,
    startSample: e,
    durationSamples: s = t.length,
    // Full buffer by default
    offsetSamples: i = 0,
    gain: r = 1,
    name: o,
    color: a,
    fadeIn: c,
    fadeOut: l
  } = n;
  return {
    id: Xf(),
    audioBuffer: t,
    startSample: e,
    durationSamples: s,
    offsetSamples: i,
    gain: r,
    name: o,
    color: a,
    fadeIn: c,
    fadeOut: l
  };
}
function CC(n) {
  const {
    audioBuffer: t,
    startTime: e,
    duration: s = t.duration,
    offset: i = 0,
    gain: r = 1,
    name: o,
    color: a,
    fadeIn: c,
    fadeOut: l
  } = n, u = t.sampleRate;
  return Wa({
    audioBuffer: t,
    startSample: Math.round(e * u),
    durationSamples: Math.round(s * u),
    offsetSamples: Math.round(i * u),
    gain: r,
    name: o,
    color: a,
    fadeIn: c,
    fadeOut: l
  });
}
function SC(n) {
  const {
    name: t,
    clips: e = [],
    muted: s = !1,
    soloed: i = !1,
    volume: r = 1,
    pan: o = 0,
    color: a,
    height: c
  } = n;
  return {
    id: Xf(),
    name: t,
    clips: e,
    muted: s,
    soloed: i,
    volume: r,
    pan: o,
    color: a,
    height: c
  };
}
function Xf() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function jS(n) {
  const [t, e] = pt([]), [s, i] = pt(!0), [r, o] = pt(null);
  return oe(() => {
    if (n.length === 0) {
      e([]), i(!1);
      return;
    }
    let a = !1;
    return (async () => {
      try {
        i(!0), o(null);
        const l = At().rawContext, u = n.map(async (d, f) => {
          const p = await fetch(d.src);
          if (!p.ok)
            throw new Error(`Failed to fetch ${d.src}: ${p.statusText}`);
          const m = await p.arrayBuffer(), g = await l.decodeAudioData(m);
          if (!g || !g.sampleRate || !g.duration)
            throw new Error(`Invalid audio buffer for ${d.src}`);
          const _ = CC({
            audioBuffer: g,
            startTime: d.startTime ?? 0,
            // Use config or default to 0
            duration: d.duration ?? g.duration,
            // Use config or full duration
            offset: d.offset ?? 0,
            // Use config or no trim
            name: d.name || `Track ${f + 1}`
          });
          if (isNaN(_.startSample) || isNaN(_.durationSamples) || isNaN(_.offsetSamples))
            throw console.error("Invalid clip values:", _), new Error(`Invalid clip values for ${d.src}`);
          return {
            ...SC({
              name: d.name || `Track ${f + 1}`,
              clips: [_],
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
        a || (e(h), i(!1));
      } catch (l) {
        if (!a) {
          const u = l instanceof Error ? l.message : "Unknown error loading audio";
          o(u), i(!1), console.error("Error loading audio tracks:", l);
        }
      }
    })(), () => {
      a = !0;
    };
  }, [n]), { tracks: t, loading: s, error: r };
}
function LS({
  tracks: n,
  onTracksChange: t,
  samplesPerPixel: e,
  sampleRate: s
}) {
  const i = Kt.useRef(null), r = Kt.useCallback(
    (l) => {
      const { transform: u, active: h } = l;
      if (!h?.data?.current) return { ...u, scaleX: 1, scaleY: 1 };
      const { trackIndex: d, clipIndex: f, boundary: p } = h.data.current;
      if (p)
        return { ...u, scaleX: 1, scaleY: 1 };
      const m = n[d];
      if (!m) return { ...u, scaleX: 1, scaleY: 1 };
      const g = m.clips[f];
      if (!g) return { ...u, scaleX: 1, scaleY: 1 };
      const _ = g.startSample / s, v = g.durationSamples / s, x = u.x * e / s;
      let T = _ + x;
      const y = [...m.clips].sort((k, I) => k.startSample - I.startSample), w = y.findIndex((k) => k === g);
      T = Math.max(0, T);
      const S = w > 0 ? y[w - 1] : null;
      if (S) {
        const k = (S.startSample + S.durationSamples) / s;
        T = Math.max(T, k);
      }
      const b = w < y.length - 1 ? y[w + 1] : null;
      if (b) {
        const k = T + v, I = b.startSample / s;
        k > I && (T = I - v);
      }
      const D = (T - _) * s / e;
      return {
        ...u,
        x: D,
        scaleX: 1,
        scaleY: 1
      };
    },
    [n, e, s]
  ), o = Kt.useCallback(
    (l) => {
      const { active: u } = l, { boundary: h } = u.data.current;
      if (!h) {
        i.current = null;
        return;
      }
      const { trackIndex: d, clipIndex: f } = u.data.current, m = n[d]?.clips[f];
      m && (i.current = {
        offsetSamples: m.offsetSamples,
        durationSamples: m.durationSamples,
        startSample: m.startSample
      });
    },
    [n]
  ), a = Kt.useCallback(
    (l) => {
      const { active: u, delta: h } = l, { boundary: d } = u.data.current;
      if (!d || !i.current) return;
      const { trackIndex: f, clipIndex: p } = u.data.current, m = h.x * e, g = Math.floor(0.1 * s), _ = i.current, v = n.map((x, T) => {
        if (T !== f) return x;
        const y = [...x.clips].sort((b, O) => b.startSample - O.startSample), w = y.findIndex((b) => b === x.clips[p]), S = x.clips.map((b, O) => {
          if (O !== p) return b;
          const D = Math.floor(b.audioBuffer.duration * s);
          if (d === "left") {
            let k = Math.floor(_.offsetSamples + m), I = Math.floor(_.durationSamples - m), N = Math.floor(_.startSample + m);
            if (N < 0) {
              const $ = -N;
              N = 0, k += $, I -= $;
            }
            if (k < 0) {
              const $ = -k;
              k = 0, I += $, N -= $;
            }
            if (I < g) {
              const $ = g - I;
              I = g, k -= $, N -= $, k = Math.max(0, k);
            }
            k + I > D && (k = D - I);
            const F = w > 0 ? y[w - 1] : null;
            if (F) {
              const $ = F.startSample + F.durationSamples;
              if (N < $) {
                const L = $ - N;
                N = $, k += L, I -= L, I < g && (I = g, k = Math.min(k, D - g));
              }
            }
            return {
              ...b,
              offsetSamples: k,
              durationSamples: I,
              startSample: N
            };
          } else {
            let k = Math.floor(_.durationSamples + m);
            k = Math.max(g, k), _.offsetSamples + k > D && (k = D - _.offsetSamples);
            const I = w < y.length - 1 ? y[w + 1] : null;
            return I && _.startSample + k > I.startSample && (k = I.startSample - _.startSample, k = Math.max(g, k)), { ...b, durationSamples: k };
          }
        });
        return { ...x, clips: S };
      });
      t(v);
    },
    [n, t, e, s]
  ), c = Kt.useCallback(
    (l) => {
      const { active: u, delta: h } = l, { trackIndex: d, clipIndex: f, boundary: p } = u.data.current, m = h.x * e;
      if (p) {
        i.current = null;
        return;
      }
      const g = n.map((_, v) => {
        if (v !== d) return _;
        const x = [..._.clips].sort((w, S) => w.startSample - S.startSample), T = x.findIndex((w) => w === _.clips[f]), y = _.clips.map((w, S) => {
          if (S !== f) return w;
          let b = Math.floor(w.startSample + m);
          b = Math.max(0, b);
          const O = T > 0 ? x[T - 1] : null;
          if (O) {
            const k = O.startSample + O.durationSamples;
            b = Math.max(b, k);
          }
          const D = T < x.length - 1 ? x[T + 1] : null;
          return D && b + w.durationSamples > D.startSample && (b = D.startSample - w.durationSamples), {
            ...w,
            startSample: b
          };
        });
        return {
          ..._,
          clips: y
        };
      });
      t(g);
    },
    [n, t, e, s]
  );
  return {
    onDragStart: o,
    onDragMove: a,
    onDragEnd: c,
    collisionModifier: r
  };
}
function qS() {
  return ub(
    lb(Vd, {
      activationConstraint: {
        distance: 1
        // Require 1px movement before drag starts (immediate feedback)
      }
    })
  );
}
const BS = (n) => {
  const { tracks: t, onTracksChange: e, sampleRate: s } = n, { currentTime: i } = An(), { selectedTrackId: r } = ls(), o = xt(
    (c, l, u) => {
      const { sampleRate: h, samplesPerPixel: d } = n, f = t[c];
      if (!f) return !1;
      const p = f.clips[l];
      if (!p) return !1;
      const m = p.startSample / h, g = (p.startSample + p.durationSamples) / h;
      if (u <= m || u >= g)
        return console.warn("Split time is outside clip bounds"), !1;
      const _ = Math.round(u * h);
      Math.floor(p.startSample / d);
      const v = Math.floor(_ / d), x = p.startSample + p.durationSamples, T = v * d, y = p.startSample, w = T - y, S = T, b = x - S, O = T - p.startSample, D = Wa({
        audioBuffer: p.audioBuffer,
        startSample: y,
        durationSamples: w,
        offsetSamples: p.offsetSamples,
        gain: p.gain,
        name: p.name ? `${p.name} (1)` : void 0,
        color: p.color,
        fadeIn: p.fadeIn
        // Note: fadeOut removed for first clip since it's cut
      }), k = Wa({
        audioBuffer: p.audioBuffer,
        startSample: S,
        durationSamples: b,
        offsetSamples: p.offsetSamples + O,
        gain: p.gain,
        name: p.name ? `${p.name} (2)` : void 0,
        color: p.color,
        // Note: fadeIn removed for second clip since it's cut
        fadeOut: p.fadeOut
      }), I = [...f.clips];
      I.splice(l, 1, D, k);
      const N = [...t];
      return N[c] = {
        ...f,
        clips: I
      }, e(N), !0;
    },
    [t, e, n]
  );
  return {
    splitClipAtPlayhead: xt(() => {
      if (!r)
        return console.log("No track selected - click a clip to select a track first"), !1;
      const c = t.findIndex((u) => u.id === r);
      if (c === -1)
        return console.warn("Selected track not found"), !1;
      const l = t[c];
      for (let u = 0; u < l.clips.length; u++) {
        const h = l.clips[u], d = h.startSample / s, f = (h.startSample + h.durationSamples) / s;
        if (i > d && i < f)
          return console.log(`Splitting clip on track "${l.name}" at ${i}s`), o(c, u, i);
      }
      return console.log(`No clip found at playhead position on track "${l.name}"`), !1;
    }, [t, i, r, o, s]),
    splitClipAt: o
  };
}, $S = (n) => {
  const { shortcuts: t, enabled: e = !0 } = n, s = xt(
    (i) => {
      if (!e) return;
      const r = i.target;
      if (r.tagName === "INPUT" || r.tagName === "TEXTAREA" || r.isContentEditable)
        return;
      const o = t.find((a) => {
        const c = i.key.toLowerCase() === a.key.toLowerCase() || i.key === a.key, l = a.ctrlKey === void 0 || i.ctrlKey === a.ctrlKey, u = a.shiftKey === void 0 || i.shiftKey === a.shiftKey, h = a.metaKey === void 0 || i.metaKey === a.metaKey, d = a.altKey === void 0 || i.altKey === a.altKey;
        return c && l && u && h && d;
      });
      o && (o.preventDefault !== !1 && i.preventDefault(), o.action());
    },
    [t, e]
  );
  oe(() => {
    if (e)
      return window.addEventListener("keydown", s), () => {
        window.removeEventListener("keydown", s);
      };
  }, [s, e]);
};
function TC(n) {
  const t = n.reduce((i, r) => i + r.length, 0), e = new Float32Array(t);
  let s = 0;
  for (const i of n)
    e.set(i, s), s += i.length;
  return e;
}
function AC(n, t, e, s = 1) {
  const i = n.createBuffer(
    s,
    t.length,
    e
  ), r = new Float32Array(t);
  return i.copyToChannel(r, 0), i;
}
function vh(n, t, e = 16) {
  const s = Math.ceil(n.length / t), i = e === 8 ? new Int8Array(s * 2) : new Int16Array(s * 2), r = 2 ** (e - 1);
  for (let o = 0; o < s; o++) {
    const a = o * t, c = Math.min(a + t, n.length);
    let l = 0, u = 0;
    for (let h = a; h < c; h++) {
      const d = n[h];
      d < l && (l = d), d > u && (u = d);
    }
    i[o * 2] = Math.floor(l * r), i[o * 2 + 1] = Math.floor(u * r);
  }
  return i;
}
function kC(n, t, e, s, i = 16) {
  const r = 2 ** (i - 1), o = s % e;
  let a = 0;
  if (o > 0 && n.length > 0) {
    const u = e - o, h = Math.min(u, t.length);
    let d = n[n.length - 2] / r, f = n[n.length - 1] / r;
    for (let _ = 0; _ < h; _++) {
      const v = t[_];
      v < d && (d = v), v > f && (f = v);
    }
    const p = new (i === 8 ? Int8Array : Int16Array)(n.length);
    p.set(n), p[n.length - 2] = Math.floor(d * r), p[n.length - 1] = Math.floor(f * r), a = h;
    const m = vh(t.slice(a), e, i), g = new (i === 8 ? Int8Array : Int16Array)(p.length + m.length);
    return g.set(p), g.set(m, p.length), g;
  }
  const c = vh(t.slice(a), e, i), l = new (i === 8 ? Int8Array : Int16Array)(n.length + c.length);
  return l.set(n), l.set(c, n.length), l;
}
function IC(n, t = {}) {
  const {
    channelCount: e = 1,
    samplesPerPixel: s = 1024
  } = t, [i, r] = pt(!1), [o, a] = pt(!1), [c, l] = pt(0), [u, h] = pt(new Int16Array(0)), [d, f] = pt(null), [p, m] = pt(null), [g, _] = pt(0), [v, x] = pt(0), T = 16, y = Et(!1), w = Et(null), S = Et(null), b = Et([]), O = Et(0), D = Et(null), k = Et(0), I = Et(!1), N = Et(!1), F = xt(async (j) => {
    if (!y.current)
      try {
        const E = new URL("data:text/javascript;base64,InVzZSBzdHJpY3QiOwoKLy8gc3JjL3dvcmtsZXQvcmVjb3JkaW5nLXByb2Nlc3Nvci53b3JrbGV0LnRzCnZhciBSZWNvcmRpbmdQcm9jZXNzb3IgPSBjbGFzcyBleHRlbmRzIEF1ZGlvV29ya2xldFByb2Nlc3NvciB7CiAgY29uc3RydWN0b3IoKSB7CiAgICBzdXBlcigpOwogICAgdGhpcy5idWZmZXJTaXplID0gMDsKICAgIHRoaXMuYnVmZmVycyA9IFtdOwogICAgdGhpcy5zYW1wbGVzQ29sbGVjdGVkID0gMDsKICAgIHRoaXMuaXNSZWNvcmRpbmcgPSBmYWxzZTsKICAgIHRoaXMuY2hhbm5lbENvdW50ID0gMTsKICAgIHRoaXMucG9ydC5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHsKICAgICAgY29uc3QgeyBjb21tYW5kLCBzYW1wbGVSYXRlOiBzYW1wbGVSYXRlMiwgY2hhbm5lbENvdW50IH0gPSBldmVudC5kYXRhOwogICAgICBpZiAoY29tbWFuZCA9PT0gInN0YXJ0IikgewogICAgICAgIHRoaXMuaXNSZWNvcmRpbmcgPSB0cnVlOwogICAgICAgIHRoaXMuY2hhbm5lbENvdW50ID0gY2hhbm5lbENvdW50IHx8IDE7CiAgICAgICAgdGhpcy5idWZmZXJTaXplID0gTWF0aC5mbG9vcigoc2FtcGxlUmF0ZTIgfHwgNDhlMykgKiAwLjAxNik7CiAgICAgICAgdGhpcy5idWZmZXJzID0gW107CiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNoYW5uZWxDb3VudDsgaSsrKSB7CiAgICAgICAgICB0aGlzLmJ1ZmZlcnNbaV0gPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuYnVmZmVyU2l6ZSk7CiAgICAgICAgfQogICAgICAgIHRoaXMuc2FtcGxlc0NvbGxlY3RlZCA9IDA7CiAgICAgIH0gZWxzZSBpZiAoY29tbWFuZCA9PT0gInN0b3AiKSB7CiAgICAgICAgdGhpcy5pc1JlY29yZGluZyA9IGZhbHNlOwogICAgICAgIGlmICh0aGlzLnNhbXBsZXNDb2xsZWN0ZWQgPiAwKSB7CiAgICAgICAgICB0aGlzLmZsdXNoQnVmZmVycygpOwogICAgICAgIH0KICAgICAgfQogICAgfTsKICB9CiAgcHJvY2VzcyhpbnB1dHMsIG91dHB1dHMsIHBhcmFtZXRlcnMpIHsKICAgIGlmICghdGhpcy5pc1JlY29yZGluZykgewogICAgICByZXR1cm4gdHJ1ZTsKICAgIH0KICAgIGNvbnN0IGlucHV0ID0gaW5wdXRzWzBdOwogICAgaWYgKCFpbnB1dCB8fCBpbnB1dC5sZW5ndGggPT09IDApIHsKICAgICAgcmV0dXJuIHRydWU7CiAgICB9CiAgICBjb25zdCBmcmFtZUNvdW50ID0gaW5wdXRbMF0ubGVuZ3RoOwogICAgZm9yIChsZXQgY2hhbm5lbCA9IDA7IGNoYW5uZWwgPCBNYXRoLm1pbihpbnB1dC5sZW5ndGgsIHRoaXMuY2hhbm5lbENvdW50KTsgY2hhbm5lbCsrKSB7CiAgICAgIGNvbnN0IGlucHV0Q2hhbm5lbCA9IGlucHV0W2NoYW5uZWxdOwogICAgICBjb25zdCBidWZmZXIgPSB0aGlzLmJ1ZmZlcnNbY2hhbm5lbF07CiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJhbWVDb3VudDsgaSsrKSB7CiAgICAgICAgYnVmZmVyW3RoaXMuc2FtcGxlc0NvbGxlY3RlZCArIGldID0gaW5wdXRDaGFubmVsW2ldOwogICAgICB9CiAgICB9CiAgICB0aGlzLnNhbXBsZXNDb2xsZWN0ZWQgKz0gZnJhbWVDb3VudDsKICAgIGlmICh0aGlzLnNhbXBsZXNDb2xsZWN0ZWQgPj0gdGhpcy5idWZmZXJTaXplKSB7CiAgICAgIHRoaXMuZmx1c2hCdWZmZXJzKCk7CiAgICB9CiAgICByZXR1cm4gdHJ1ZTsKICB9CiAgZmx1c2hCdWZmZXJzKCkgewogICAgY29uc3Qgc2FtcGxlcyA9IHRoaXMuYnVmZmVyc1swXS5zbGljZSgwLCB0aGlzLnNhbXBsZXNDb2xsZWN0ZWQpOwogICAgdGhpcy5wb3J0LnBvc3RNZXNzYWdlKHsKICAgICAgc2FtcGxlcywKICAgICAgc2FtcGxlUmF0ZSwKICAgICAgY2hhbm5lbENvdW50OiB0aGlzLmNoYW5uZWxDb3VudAogICAgfSk7CiAgICB0aGlzLnNhbXBsZXNDb2xsZWN0ZWQgPSAwOwogIH0KfTsKcmVnaXN0ZXJQcm9jZXNzb3IoInJlY29yZGluZy1wcm9jZXNzb3IiLCBSZWNvcmRpbmdQcm9jZXNzb3IpOwovLyMgc291cmNlTWFwcGluZ1VSTD1yZWNvcmRpbmctcHJvY2Vzc29yLndvcmtsZXQuanMubWFw", import.meta.url).href;
        await j.audioWorklet.addModule(E), y.current = !0;
      } catch (E) {
        throw console.error("Failed to load AudioWorklet module:", E), new Error("Failed to load recording processor");
      }
  }, []), $ = xt(async () => {
    if (!n) {
      m(new Error("No microphone stream available"));
      return;
    }
    try {
      m(null);
      const j = Ks();
      await Or(), await F(j);
      const E = Nd(n);
      S.current = E;
      const R = new AudioWorkletNode(j, "recording-processor");
      w.current = R, E.connect(R), R.port.onmessage = (Q) => {
        const { samples: K } = Q.data;
        b.current.push(K), O.current += K.length, h(
          (z) => kC(
            z,
            K,
            s,
            O.current - K.length,
            T
          )
        );
      }, R.port.postMessage({
        command: "start",
        sampleRate: j.sampleRate,
        channelCount: e
      }), b.current = [], O.current = 0, h(new Int16Array(0)), f(null), _(0), x(0), I.current = !0, N.current = !1, r(!0), a(!1), k.current = performance.now();
      const B = () => {
        if (I.current && !N.current) {
          const Q = (performance.now() - k.current) / 1e3;
          l(Q), D.current = requestAnimationFrame(B);
        }
      };
      B();
    } catch (j) {
      console.error("Failed to start recording:", j), m(j instanceof Error ? j : new Error("Failed to start recording"));
    }
  }, [n, e, s, F, i, o]), L = xt(async () => {
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
      D.current !== null && (cancelAnimationFrame(D.current), D.current = null);
      const j = TC(b.current), E = Ks(), R = AC(
        E,
        j,
        E.sampleRate,
        e
      );
      return f(R), l(R.duration), I.current = !1, N.current = !1, r(!1), a(!1), _(0), R;
    } catch (j) {
      return console.error("Failed to stop recording:", j), m(j instanceof Error ? j : new Error("Failed to stop recording")), null;
    }
  }, [i, e]), q = xt(() => {
    i && !o && (D.current !== null && (cancelAnimationFrame(D.current), D.current = null), N.current = !0, a(!0));
  }, [i, o]), tt = xt(() => {
    if (i && o) {
      N.current = !1, a(!1), k.current = performance.now() - c * 1e3;
      const j = () => {
        if (I.current && !N.current) {
          const E = (performance.now() - k.current) / 1e3;
          l(E), D.current = requestAnimationFrame(j);
        }
      };
      j();
    }
  }, [i, o, c]);
  return oe(() => () => {
    if (w.current) {
      if (w.current.port.postMessage({ command: "stop" }), S.current)
        try {
          S.current.disconnect(w.current);
        } catch {
        }
      w.current.disconnect();
    }
    D.current !== null && cancelAnimationFrame(D.current);
  }, []), {
    isRecording: i,
    isPaused: o,
    duration: c,
    peaks: u,
    audioBuffer: d,
    level: g,
    peakLevel: v,
    startRecording: $,
    stopRecording: L,
    pauseRecording: q,
    resumeRecording: tt,
    error: p
  };
}
function EC() {
  const [n, t] = pt(null), [e, s] = pt([]), [i, r] = pt(!1), [o, a] = pt(!1), [c, l] = pt(null), u = xt(async () => {
    try {
      const p = (await navigator.mediaDevices.enumerateDevices()).filter((m) => m.kind === "audioinput").map((m) => ({
        deviceId: m.deviceId,
        label: m.label || `Microphone ${m.deviceId.slice(0, 8)}`,
        groupId: m.groupId
      }));
      s(p);
    } catch (f) {
      console.error("Failed to enumerate devices:", f), l(f instanceof Error ? f : new Error("Failed to enumerate devices"));
    }
  }, []), h = xt(async (f, p) => {
    a(!0), l(null);
    try {
      n && n.getTracks().forEach((v) => v.stop());
      const g = {
        audio: {
          // Recording-optimized defaults: prioritize raw audio quality and low latency
          echoCancellation: !1,
          noiseSuppression: !1,
          autoGainControl: !1,
          latency: 0,
          // Low latency mode (not in TS types yet, but supported in modern browsers)
          // User-provided constraints override defaults
          ...p,
          // Device ID override (if specified)
          ...f && { deviceId: { exact: f } }
        },
        video: !1
      }, _ = await navigator.mediaDevices.getUserMedia(g);
      t(_), r(!0), await u();
    } catch (m) {
      console.error("Failed to access microphone:", m), l(
        m instanceof Error ? m : new Error("Failed to access microphone")
      ), r(!1);
    } finally {
      a(!1);
    }
  }, [n, u]), d = xt(() => {
    n && (n.getTracks().forEach((f) => f.stop()), t(null), r(!1));
  }, [n]);
  return oe(() => (u(), () => {
    n && n.getTracks().forEach((f) => f.stop());
  }), []), {
    stream: n,
    devices: e,
    hasPermission: i,
    isLoading: o,
    requestAccess: h,
    stopStream: d,
    error: c
  };
}
function DC(n, t = {}) {
  const {
    updateRate: e = 60,
    fftSize: s = 256,
    smoothingTimeConstant: i = 0.8
  } = t, [r, o] = pt(0), [a, c] = pt(0), l = Et(null), u = Et(null), h = Et(null), d = Et(null), f = () => c(0);
  return oe(() => {
    if (!n) {
      o(0), c(0);
      return;
    }
    let p = !0;
    return (async () => {
      const g = Ks();
      if (!p) return;
      const _ = g.createAnalyser();
      _.fftSize = s, _.smoothingTimeConstant = i, l.current = _;
      const v = _.frequencyBinCount, x = new Uint8Array(v);
      d.current = x;
      const T = Nd(n);
      T.connect(_), u.current = T;
      const y = 1e3 / e;
      let w = 0;
      const S = (b) => {
        if (b - w >= y) {
          w = b, _.getByteTimeDomainData(x);
          let O = 0;
          for (let k = 0; k < v; k++) {
            const I = (x[k] - 128) / 128;
            O += I * I;
          }
          const D = Math.sqrt(O / v);
          o(D), c((k) => Math.max(k, D));
        }
        h.current = requestAnimationFrame(S);
      };
      h.current = requestAnimationFrame(S);
    })(), () => {
      if (p = !1, h.current && cancelAnimationFrame(h.current), l.current && u.current)
        try {
          u.current.disconnect(l.current);
        } catch {
        }
      l.current = null, u.current = null, d.current = null;
    };
  }, [n, s, i, e]), {
    level: r,
    peakLevel: a,
    resetPeak: f
  };
}
X.button`
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  background: ${(n) => n.$isRecording ? "#dc3545" : "#e74c3c"};
  color: white;

  &:hover:not(:disabled) {
    background: ${(n) => n.$isRecording ? "#c82333" : "#c0392b"};
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
X.span`
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
X.select`
  padding: 0.5rem;
  font-size: 0.875rem;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  background: white;
  cursor: pointer;
  min-width: 200px;

  &:hover:not(:disabled) {
    border-color: #adb5bd;
  }

  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f8f9fa;
  }
`;
X.label`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
`;
X.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: ${(n) => n.$isRecording ? "#fff3cd" : "transparent"};
  border-radius: 0.25rem;
  transition: background 0.2s ease-in-out;
`;
X.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${(n) => n.$isPaused ? "#ffc107" : "#dc3545"};
  opacity: ${(n) => n.$isRecording ? 1 : 0};
  transition: opacity 0.2s ease-in-out;

  ${(n) => n.$isRecording && !n.$isPaused && `
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
X.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  min-width: 70px;
`;
X.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: ${(n) => n.$isPaused ? "#ffc107" : "#dc3545"};
  text-transform: uppercase;
`;
var OC = X.div`
  position: relative;
  width: ${(n) => n.$width}px;
  height: ${(n) => n.$height}px;
  background: #2c3e50;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
`, RC = X.div`
  position: absolute;
  left: 0;
  top: 0;
  height: ${(n) => n.$height}px;
  width: ${(n) => n.$level * 100}%;
  background: ${(n) => n.$level < 0.6 ? "linear-gradient(90deg, #27ae60, #2ecc71)" : n.$level < 0.85 ? "linear-gradient(90deg, #f39c12, #f1c40f)" : "linear-gradient(90deg, #c0392b, #e74c3c)"};
  transition: width 0.05s ease-out, background 0.1s ease-out;
  box-shadow: ${(n) => n.$level > 0.01 ? "0 0 8px rgba(255, 255, 255, 0.3)" : "none"};
`, MC = X.div`
  position: absolute;
  left: ${(n) => n.$peakLevel * 100}%;
  top: 0;
  width: 2px;
  height: ${(n) => n.$height}px;
  background: #ecf0f1;
  box-shadow: 0 0 4px rgba(236, 240, 241, 0.8);
  transition: left 0.1s ease-out;
`, NC = X.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: ${(n) => n.$height}px;
  pointer-events: none;
`, bh = X.div`
  position: absolute;
  left: ${(n) => n.$position}%;
  top: 0;
  width: 1px;
  height: ${(n) => n.$height}px;
  background: rgba(255, 255, 255, 0.2);
`, PC = ({
  level: n,
  peakLevel: t,
  width: e = 200,
  height: s = 20,
  className: i
}) => {
  const r = Math.max(0, Math.min(1, n)), o = t !== void 0 ? Math.max(0, Math.min(1, t)) : 0;
  return /* @__PURE__ */ A.jsxs(OC, { $width: e, $height: s, className: i, children: [
    /* @__PURE__ */ A.jsx(RC, { $level: r, $height: s }),
    t !== void 0 && o > 0 && /* @__PURE__ */ A.jsx(MC, { $peakLevel: o, $height: s }),
    /* @__PURE__ */ A.jsxs(NC, { $height: s, children: [
      /* @__PURE__ */ A.jsx(bh, { $position: 60, $height: s }),
      /* @__PURE__ */ A.jsx(bh, { $position: 85, $height: s })
    ] })
  ] });
};
Kt.memo(PC);
function zS(n, t, e, s = {}) {
  const { currentTime: i = 0, audioConstraints: r, ...o } = s, [a, c] = pt(!1), [l, u] = pt(null), {
    stream: h,
    devices: d,
    hasPermission: f,
    requestAccess: p,
    error: m
  } = EC(), { level: g, peakLevel: _ } = DC(h), {
    isRecording: v,
    isPaused: x,
    duration: T,
    peaks: y,
    startRecording: w,
    stopRecording: S,
    pauseRecording: b,
    resumeRecording: O,
    error: D
  } = IC(h, o), k = xt(async () => {
    e && (a || (await Or(), c(!0)), await w());
  }, [e, a, w]), I = xt(async () => {
    const $ = await S();
    if ($ && e) {
      const L = n.findIndex((Q) => Q.id === e);
      if (L === -1) return;
      const q = n[L], tt = Math.floor(i * $.sampleRate);
      let j = 0;
      if (q.clips.length > 0) {
        const Q = q.clips.map(
          (K) => K.startSample + K.durationSamples
        );
        j = Math.max(...Q);
      }
      const E = Math.max(tt, j), R = {
        id: `clip-${Date.now()}`,
        audioBuffer: $,
        startSample: E,
        durationSamples: $.length,
        offsetSamples: 0,
        gain: 1,
        name: `Recording ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`
      }, B = n.map((Q, K) => K === L ? {
        ...Q,
        clips: [...Q.clips, R]
      } : Q);
      t(B);
    }
  }, [e, n, t, i, S]);
  oe(() => {
    f && d.length > 0 && l === null && u(d[0].deviceId);
  }, [f, d.length]);
  const N = xt(async () => {
    await p(void 0, r), await Or(), c(!0);
  }, [p, r]), F = xt(async ($) => {
    u($), await p($, r), await Or(), c(!0);
  }, [p, r]);
  return {
    // Recording state
    isRecording: v,
    isPaused: x,
    duration: T,
    level: g,
    peakLevel: _,
    error: m || D,
    // Microphone state
    stream: h,
    devices: d,
    hasPermission: f,
    selectedDevice: l,
    // Recording controls
    startRecording: k,
    stopRecording: I,
    pauseRecording: b,
    resumeRecording: O,
    requestMicAccess: N,
    changeDevice: F,
    // Track state
    recordingPeaks: y
  };
}
const Uf = Xe(null), Hf = Xe(null), Kf = Xe(null), Qf = Xe(null), Jf = Xe(null), GS = ({
  tracks: n,
  timescale: t = !0,
  mono: e = !0,
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
  children: f
}) => {
  const [p, m] = pt([]), [g, _] = pt(null), [v, x] = pt(!1), [T, y] = pt(0), [w, S] = pt(0), [b, O] = pt([]), [D, k] = pt([]), [I, N] = pt([]), [F, $] = pt(0), [L, q] = pt(0), [tt, j] = pt(null), [E, R] = pt(o), [B, Q] = pt(l?.isContinuousPlay ?? !1), [K, z] = pt(l?.linkEndpoints ?? !0), [H, st] = pt(l?.editable ?? !1), M = Et(null), ct = Et(0), et = Et(0), Tt = Et(null), Y = Et(0), te = Et(0), Ut = Et(null), Z = Et(null), rt = Et(!1), Wt = Et(l?.isContinuousPlay ?? !1), kt = Et(null), bt = Et(i), { timeFormat: Ft, setTimeFormat: ue, formatTime: he } = vC(), Te = xC({ initialSamplesPerPixel: i, zoomLevels: r }), Pe = Te.samplesPerPixel, { masterVolume: zn, setMasterVolume: us } = wC({ playoutRef: M, initialVolume: 1 }), dt = xt((lt) => {
    Wt.current = lt, Q(lt);
  }, []), ot = xt((lt) => {
    kt.current = lt, _(lt);
  }, []);
  oe(() => {
    rt.current = E;
  }, [E]), oe(() => {
    if (!Z.current || !b.length) return;
    const lt = Z.current, gt = bt.current, _t = Pe;
    if (gt === _t) return;
    const Mt = c.show ? c.width : 0, ut = lt.clientWidth, Ke = lt.scrollLeft + ut / 2 - Mt, C = b[0].sampleRate, U = Ke * gt / C * C / _t, ft = Math.max(0, U + Mt - ut / 2);
    lt.scrollLeft = ft, bt.current = _t;
  }, [Pe, b, c]), oe(() => n.length === 0 ? void 0 : ((async () => {
    try {
      const gt = [];
      n.forEach((ut) => {
        ut.clips.length > 0 && gt.push(ut.clips[0].audioBuffer);
      });
      let _t = 0;
      n.forEach((ut) => {
        ut.clips.forEach((Ae) => {
          const Ke = Ae.audioBuffer.sampleRate, V = (Ae.startSample + Ae.durationSamples) / Ke;
          _t = Math.max(_t, V);
        });
      }), O(gt), S(_t), N(n.map((ut) => ({
        name: ut.name,
        muted: ut.muted,
        soloed: ut.soloed,
        volume: ut.volume,
        pan: ut.pan
      })));
      const Mt = new Md({
        effects: u
      });
      n.forEach((ut, Ae) => {
        if (ut.clips.length > 0) {
          const Ke = ut.clips[0].audioBuffer.sampleRate, C = Math.min(...ut.clips.map((yt) => yt.startSample / Ke)), V = Math.max(...ut.clips.map((yt) => (yt.startSample + yt.durationSamples) / Ke)), U = {
            id: `track-${Ae}`,
            // Use consistent index-based ID for track controls
            name: ut.name,
            gain: ut.volume,
            // Use track-level volume
            muted: ut.muted,
            soloed: ut.soloed,
            stereoPan: ut.pan,
            startTime: C,
            endTime: V
          }, ft = ut.clips.map((yt) => {
            const Rt = yt.audioBuffer.sampleRate;
            return {
              buffer: yt.audioBuffer,
              startTime: yt.startSample / Rt - C,
              // Make relative to track start
              duration: yt.durationSamples / Rt,
              offset: yt.offsetSamples / Rt,
              fadeIn: yt.fadeIn,
              fadeOut: yt.fadeOut,
              gain: yt.gain
            };
          });
          Mt.addTrack({
            clips: ft,
            track: U,
            effects: ut.effects
            // Pass track effects
          });
        }
      }), M.current = Mt, h?.();
    } catch (gt) {
      console.error("Error loading audio:", gt);
    }
  })(), () => {
    Tt.current && cancelAnimationFrame(Tt.current), M.current && M.current.dispose();
  }), [n, h]), oe(() => {
    if (n.length === 0) return;
    const lt = 16, gt = n.map((_t) => _t.clips.map((ut) => {
      const Ae = ut.audioBuffer.sampleRate, Ke = Va(
        ut.audioBuffer,
        Pe,
        e,
        lt,
        ut.offsetSamples / Ae,
        // Time offset into the audio file (in seconds)
        ut.durationSamples / Ae
        // Duration of the clip (in seconds)
      );
      return {
        clipId: ut.id,
        trackName: _t.name,
        peaks: Ke,
        startSample: ut.startSample,
        durationSamples: ut.durationSamples
      };
    }));
    k(gt);
  }, [n, Pe, e]), oe(() => {
    if (l?.annotations) {
      const lt = l.annotations.map((gt) => typeof gt.start == "number" ? gt : K1(gt));
      m(lt);
    }
  }, [l]);
  const Ot = xt(() => {
    const lt = () => {
      const gt = At().currentTime - Y.current, _t = te.current + gt;
      if (et.current = _t, y(_t), p.length > 0) {
        const Mt = p.find(
          (ut) => _t >= ut.start && _t < ut.end
        );
        if (Wt.current) {
          if (Mt && Mt.id !== kt.current)
            ot(Mt.id);
          else if (!Mt && kt.current !== null) {
            const ut = p[p.length - 1];
            if (_t >= ut.end) {
              M.current && M.current.stop(), x(!1), et.current = ct.current, y(ct.current), ot(null);
              return;
            }
          }
        } else if (kt.current) {
          const ut = p.find((Ae) => Ae.id === kt.current);
          if (ut && _t >= ut.end) {
            M.current && M.current.stop(), x(!1), et.current = ct.current, y(ct.current);
            return;
          }
        } else
          Mt && ot(Mt.id);
      }
      if (rt.current && Z.current && b.length > 0) {
        const Mt = Z.current, ut = b[0].sampleRate, Ae = _t * ut / bt.current, Ke = Mt.clientWidth, C = c.show ? c.width : 0, V = Ae + C, U = Math.max(0, V - Ke / 2);
        Mt.scrollLeft = U;
      }
      if (Ut.current !== null && _t >= Ut.current) {
        M.current && M.current.stop(), x(!1), et.current = Ut.current, y(Ut.current), Ut.current = null;
        return;
      }
      if (_t >= w) {
        M.current && M.current.stop(), x(!1), et.current = ct.current, y(ct.current), ot(null);
        return;
      }
      Tt.current = requestAnimationFrame(lt);
    };
    Tt.current = requestAnimationFrame(lt);
  }, [w, b, Pe, p, B]), Lt = xt(() => {
    Tt.current && (cancelAnimationFrame(Tt.current), Tt.current = null);
  }, []);
  oe(() => {
    (async () => {
      if (v && Tt.current && M.current)
        if (B) {
          const gt = et.current;
          M.current.stop(), Lt(), await M.current.init(), M.current.setOnPlaybackComplete(() => {
          });
          const Mt = At().currentTime;
          Y.current = Mt, te.current = gt, M.current.play(Mt, gt), Ot();
        } else
          Lt(), Ot();
    })();
  }, [B, v, Ot, Lt]);
  const Ht = xt(async (lt, gt) => {
    if (!M.current || b.length === 0) return;
    await M.current.init(), await lc();
    const _t = lt ?? et.current;
    ct.current = _t, M.current.setOnPlaybackComplete(() => {
    }), M.current.stop(), Lt();
    const ut = At().currentTime;
    Y.current = ut, te.current = _t, Ut.current = gt !== void 0 ? _t + gt : null, M.current.play(ut, _t, gt), x(!0), Ot();
  }, [b.length, Ot, Lt]), qt = xt(() => {
    if (!M.current) return;
    const lt = At().currentTime - Y.current, gt = te.current + lt;
    M.current.pause(), x(!1), Lt(), et.current = gt, y(gt);
  }, [Lt]), me = xt(() => {
    M.current && (M.current.stop(), x(!1), Lt(), et.current = ct.current, y(ct.current), ot(null));
  }, [Lt]), rn = xt((lt) => {
    const gt = Math.max(0, Math.min(lt, w));
    et.current = gt, y(gt), v && M.current && (M.current.stop(), Lt(), Ht(gt));
  }, [w, v, Ht, Lt]), kn = xt((lt, gt) => {
    const _t = [...I];
    if (_t[lt] = { ..._t[lt], muted: gt }, N(_t), M.current) {
      const Mt = `track-${lt}`;
      M.current.setMute(Mt, gt);
    }
  }, [I]), on = xt((lt, gt) => {
    const _t = [...I];
    if (_t[lt] = { ..._t[lt], soloed: gt }, N(_t), M.current) {
      const Mt = `track-${lt}`;
      M.current.setSolo(Mt, gt);
    }
  }, [I]), He = xt((lt, gt) => {
    const _t = [...I];
    if (_t[lt] = { ..._t[lt], volume: gt }, N(_t), M.current) {
      const Mt = `track-${lt}`, ut = M.current.getTrack(Mt);
      ut && ut.setVolume(gt);
    }
  }, [I]), In = xt((lt, gt) => {
    const _t = [...I];
    if (_t[lt] = { ..._t[lt], pan: gt }, N(_t), M.current) {
      const Mt = `track-${lt}`, ut = M.current.getTrack(Mt);
      ut && ut.setPan(gt);
    }
  }, [I]), vi = xt((lt, gt) => {
    $(lt), q(gt), et.current = lt, y(lt), v && M.current && (M.current.stop(), M.current.play(At().currentTime, lt));
  }, [v]), an = xt((lt) => {
    Z.current = lt;
  }, []), hs = b[0]?.sampleRate || 44100, Ms = t ? 30 : 0, gr = n.length * s + Ms, _r = {
    isPlaying: v,
    currentTime: T,
    currentTimeRef: et
  }, bi = {
    continuousPlay: B,
    linkEndpoints: K,
    annotationsEditable: H,
    isAutomaticScroll: E,
    annotations: p,
    activeAnnotationId: g,
    selectionStart: F,
    selectionEnd: L,
    selectedTrackId: tt
  }, yr = {
    // Playback controls
    play: Ht,
    pause: qt,
    stop: me,
    seekTo: rn,
    setCurrentTime: (lt) => {
      et.current = lt, y(lt);
    },
    // Track controls
    setTrackMute: kn,
    setTrackSolo: on,
    setTrackVolume: He,
    setTrackPan: In,
    // Selection
    setSelection: vi,
    setSelectedTrackId: j,
    // Time format
    setTimeFormat: ue,
    formatTime: he,
    // Zoom
    zoomIn: Te.zoomIn,
    zoomOut: Te.zoomOut,
    // Master volume
    setMasterVolume: us,
    // Automatic scroll
    setAutomaticScroll: (lt) => {
      R(lt);
    },
    setScrollContainer: an,
    scrollContainerRef: Z,
    // Annotation controls
    setContinuousPlay: dt,
    setLinkEndpoints: z,
    setAnnotationsEditable: st,
    setAnnotations: m,
    setActiveAnnotationId: ot
  }, xi = {
    duration: w,
    audioBuffers: b,
    peaksDataArray: D,
    trackStates: I,
    tracks: n,
    sampleRate: hs,
    waveHeight: s,
    timeScaleHeight: Ms,
    minimumPlaylistHeight: gr,
    controls: c,
    playoutRef: M,
    samplesPerPixel: Pe,
    timeFormat: Ft,
    masterVolume: zn,
    canZoomIn: Te.canZoomIn,
    canZoomOut: Te.canZoomOut
  }, vr = {
    ..._r,
    ...bi,
    ...yr,
    ...xi
  }, Io = { ...H1, ...a };
  return /* @__PURE__ */ A.jsx(wh, { theme: Io, children: /* @__PURE__ */ A.jsx(Uf.Provider, { value: _r, children: /* @__PURE__ */ A.jsx(Hf.Provider, { value: bi, children: /* @__PURE__ */ A.jsx(Kf.Provider, { value: yr, children: /* @__PURE__ */ A.jsx(Qf.Provider, { value: xi, children: /* @__PURE__ */ A.jsx(Jf.Provider, { value: vr, children: f }) }) }) }) }) });
}, An = () => {
  const n = je(Uf);
  if (!n)
    throw new Error("usePlaybackAnimation must be used within WaveformPlaylistProvider");
  return n;
}, ls = () => {
  const n = je(Hf);
  if (!n)
    throw new Error("usePlaylistState must be used within WaveformPlaylistProvider");
  return n;
}, we = () => {
  const n = je(Kf);
  if (!n)
    throw new Error("usePlaylistControls must be used within WaveformPlaylistProvider");
  return n;
}, $n = () => {
  const n = je(Qf);
  if (!n)
    throw new Error("usePlaylistData must be used within WaveformPlaylistProvider");
  return n;
}, ZS = () => {
  const n = je(Jf);
  if (!n)
    throw new Error("useWaveformPlaylist must be used within WaveformPlaylistProvider");
  return n;
}, YS = ({ className: n }) => {
  const { isPlaying: t, currentTimeRef: e } = An(), { selectionStart: s, selectionEnd: i } = ls(), { play: r } = we(), o = async () => {
    if (s !== i && i > s) {
      const a = i - s;
      await r(s, a);
    } else
      await r(e.current ?? 0);
  };
  return /* @__PURE__ */ A.jsx(Tn, { onClick: o, disabled: t, className: n, children: "Play" });
}, XS = ({ className: n }) => {
  const { isPlaying: t } = An(), { pause: e } = we();
  return /* @__PURE__ */ A.jsx(Tn, { onClick: e, disabled: !t, className: n, children: "Pause" });
}, US = ({ className: n }) => {
  const { isPlaying: t } = An(), { stop: e } = we();
  return /* @__PURE__ */ A.jsx(Tn, { onClick: e, disabled: !t, className: n, children: "Stop" });
}, HS = ({ className: n }) => {
  const { isPlaying: t } = An(), { play: e, setCurrentTime: s } = we(), { playoutRef: i } = $n(), r = () => {
    s(0), t && i.current && (i.current.stop(), e(0));
  };
  return /* @__PURE__ */ A.jsx(Tn, { onClick: r, className: n, children: "Rewind" });
}, KS = ({ className: n }) => {
  const { isPlaying: t } = An(), { play: e, setCurrentTime: s } = we(), { duration: i, playoutRef: r } = $n(), o = () => {
    s(i), t && r.current && (r.current.stop(), e(i));
  };
  return /* @__PURE__ */ A.jsx(Tn, { onClick: o, className: n, children: "Fast Forward" });
}, QS = ({
  skipAmount: n = 5,
  className: t
}) => {
  const { currentTimeRef: e, isPlaying: s } = An(), { play: i, setCurrentTime: r } = we(), { playoutRef: o } = $n(), a = () => {
    const c = Math.max(0, (e.current ?? 0) - n);
    r(c), s && o.current && (o.current.stop(), i(c));
  };
  return /* @__PURE__ */ A.jsx(Tn, { onClick: a, className: t, children: "Skip Backward" });
}, JS = ({
  skipAmount: n = 5,
  className: t
}) => {
  const { currentTimeRef: e, isPlaying: s } = An(), { play: i, setCurrentTime: r } = we(), { duration: o, playoutRef: a } = $n(), c = () => {
    const l = Math.min(o, (e.current ?? 0) + n);
    r(l), s && a.current && (a.current.stop(), i(l));
  };
  return /* @__PURE__ */ A.jsx(Tn, { onClick: c, className: t, children: "Skip Forward" });
}, tT = ({ className: n, disabled: t }) => {
  const { zoomIn: e } = we(), { canZoomIn: s } = $n();
  return /* @__PURE__ */ A.jsx(Tn, { variant: "success", onClick: e, disabled: t || !s, className: n, children: "Zoom In" });
}, eT = ({ className: n, disabled: t }) => {
  const { zoomOut: e } = we(), { canZoomOut: s } = $n();
  return /* @__PURE__ */ A.jsx(Tn, { variant: "success", onClick: e, disabled: t || !s, className: n, children: "Zoom Out" });
}, nT = ({ className: n }) => {
  const { masterVolume: t } = $n(), { setMasterVolume: e } = we();
  return /* @__PURE__ */ A.jsx(
    x1,
    {
      volume: t,
      onChange: e,
      className: n
    }
  );
}, sT = ({ className: n }) => {
  const { timeFormat: t } = $n(), { setTimeFormat: e } = we();
  return /* @__PURE__ */ A.jsx(
    z1,
    {
      value: t,
      onChange: e,
      className: n
    }
  );
}, iT = ({ className: n }) => {
  const { currentTime: t } = An(), { formatTime: e } = we();
  return /* @__PURE__ */ A.jsx(
    o1,
    {
      formattedTime: e(t),
      className: n
    }
  );
}, rT = ({ className: n }) => {
  const { selectionStart: t, selectionEnd: e } = ls(), { setSelection: s } = we();
  return /* @__PURE__ */ A.jsx(
    D1,
    {
      selectionStart: t,
      selectionEnd: e,
      onSelectionChange: s,
      className: n
    }
  );
}, oT = ({ className: n }) => {
  const { isAutomaticScroll: t } = ls(), { setAutomaticScroll: e } = we();
  return /* @__PURE__ */ A.jsx(
    a1,
    {
      checked: t,
      onChange: e,
      className: n
    }
  );
}, aT = ({ className: n }) => {
  const { continuousPlay: t } = ls(), { setContinuousPlay: e } = we();
  return /* @__PURE__ */ A.jsx(
    dC,
    {
      checked: t,
      onChange: e,
      className: n
    }
  );
}, cT = ({ className: n }) => {
  const { linkEndpoints: t } = ls(), { setLinkEndpoints: e } = we();
  return /* @__PURE__ */ A.jsx(
    fC,
    {
      checked: t,
      onChange: e,
      className: n
    }
  );
}, lT = ({
  filename: n,
  className: t
}) => {
  const { annotations: e } = ls();
  return /* @__PURE__ */ A.jsx(
    pC,
    {
      annotations: e,
      filename: n,
      className: t
    }
  );
}, FC = 60, uT = ({
  timescale: n = !0,
  renderTrackControls: t,
  renderTimestamp: e,
  annotationControls: s,
  annotationListConfig: i,
  className: r,
  showClipHeaders: o = !1,
  interactiveClips: a = !0,
  // Default to true for backwards compatibility
  recordingState: c
}) => {
  const l = Rf(), { isPlaying: u, currentTime: h, currentTimeRef: d } = An(), {
    selectionStart: f,
    selectionEnd: p,
    annotations: m,
    activeAnnotationId: g,
    annotationsEditable: _,
    linkEndpoints: v,
    continuousPlay: x,
    selectedTrackId: T
  } = ls(), {
    setAnnotations: y,
    setActiveAnnotationId: w,
    setTrackMute: S,
    setTrackSolo: b,
    setTrackVolume: O,
    setTrackPan: D,
    setSelection: k,
    play: I,
    setScrollContainer: N,
    setSelectedTrackId: F,
    setCurrentTime: $
  } = we(), {
    audioBuffers: L,
    peaksDataArray: q,
    trackStates: tt,
    tracks: j,
    duration: E,
    samplesPerPixel: R,
    sampleRate: B,
    waveHeight: Q,
    timeScaleHeight: K,
    controls: z,
    playoutRef: H
  } = $n(), { updateAnnotationBoundaries: st } = mC({
    initialContinuousPlay: x,
    initialLinkEndpoints: v
  }), [M, ct] = pt(!1), [et, Tt] = pt(null), Y = Et(null), te = xt((dt) => {
    Y.current = dt, N(dt);
  }, [N]);
  let Ut = L.length > 0 ? E : FC;
  if (c?.isRecording) {
    const ot = (c.startSample + c.durationSamples) / B;
    Ut = Math.max(Ut, ot + 10);
  }
  const Z = Math.floor(Ut * B / R), Wt = (Ut >= 3600 ? 8 : Ut >= 600 ? 6 : 5) * 8 + 10, kt = async (dt) => {
    console.log("Annotation clicked:", dt.id), w(dt.id);
    const ot = x ? void 0 : dt.end - dt.start;
    await I(dt.start, ot);
  }, bt = (dt, ot, Ot) => {
    const Lt = m.find((Ht) => Ht.id === dt);
    Lt && Tt({
      id: dt,
      edge: ot,
      originalStart: Lt.start,
      originalEnd: Lt.end,
      startX: Ot.clientX
    });
  }, Ft = (dt) => {
    if (!et || dt.clientX === 0) return;
    const ot = Y.current;
    if (!ot) return;
    const Ot = ot.getBoundingClientRect(), Ht = (dt.clientX - Ot.left + ot.scrollLeft) * R / B, qt = m.findIndex((me) => me.id === et.id);
    if (qt !== -1) {
      const me = st({
        annotationIndex: qt,
        newTime: Ht,
        isDraggingStart: et.edge === "start",
        annotations: m,
        duration: E
      });
      y(me);
    }
  }, ue = () => {
    Tt(null);
  }, he = xt((dt, ot = "unknown") => {
    if (dt >= 0 && dt < j.length) {
      const Ot = j[dt];
      console.log(`[Track Selection] ${ot}: track "${Ot.name}" (ID: ${Ot.id})`), F(Ot.id);
    }
  }, [j, F]), Te = (dt) => {
    const ot = dt.currentTarget.getBoundingClientRect(), Ot = z.show ? z.width : 0, Ht = (dt.clientX - ot.left - Ot) * R / B, rn = dt.clientY - ot.top - (n ? K : 0);
    let kn = 0, on = -1;
    for (let He = 0; He < q.length; He++) {
      const In = q[He], an = (In.length > 0 ? Math.max(...In.map((hs) => hs.peaks.data.length)) : 1) * Q + (o ? 22 : 0);
      if (rn >= kn && rn < kn + an) {
        on = He;
        break;
      }
      kn += an;
    }
    on !== -1 && he(on, `Clicked at Y=${rn}px`), ct(!0), $(Ht), k(Ht, Ht);
  }, Pe = (dt) => {
    if (!M) return;
    const ot = dt.currentTarget.getBoundingClientRect(), Ot = z.show ? z.width : 0, Ht = (dt.clientX - ot.left - Ot) * R / B, qt = Math.min(f, Ht), me = Math.max(f, Ht);
    k(qt, me);
  }, zn = (dt) => {
    if (!M) return;
    ct(!1);
    const ot = dt.currentTarget.getBoundingClientRect(), Ot = z.show ? z.width : 0, Ht = (dt.clientX - ot.left - Ot) * R / B, qt = Math.min(f, Ht), me = Math.max(f, Ht);
    Math.abs(me - qt) < 0.1 ? ($(qt), u && H.current ? (H.current.stop(), I(qt)) : H.current && H.current.stop()) : k(qt, me);
  };
  return j.some((dt) => dt.clips.length > 0) && (L.length === 0 || q.length === 0) ? /* @__PURE__ */ A.jsx("div", { className: r, children: "Loading waveform..." }) : /* @__PURE__ */ A.jsx(Df, { children: /* @__PURE__ */ A.jsxs(
    Ao.Provider,
    {
      value: {
        samplesPerPixel: R,
        sampleRate: B,
        zoomLevels: [R],
        waveHeight: Q,
        timeScaleHeight: K,
        duration: Ut,
        controls: z
      },
      children: [
        /* @__PURE__ */ A.jsx(
          Tl,
          {
            theme: l,
            backgroundColor: l.waveOutlineColor,
            timescaleBackgroundColor: l.timescaleBackgroundColor,
            scrollContainerWidth: Z + (z.show ? z.width : 0) + Wt,
            timescaleWidth: Z,
            tracksWidth: Z,
            controlsWidth: z.show ? z.width : 0,
            onTracksMouseDown: Te,
            onTracksMouseMove: Pe,
            onTracksMouseUp: zn,
            scrollContainerRef: te,
            timescale: n ? /* @__PURE__ */ A.jsx(
              jf,
              {
                duration: Ut * 1e3,
                marker: 1e4,
                bigStep: 5e3,
                secondStep: 1e3,
                renderTimestamp: e
              }
            ) : void 0,
            children: /* @__PURE__ */ A.jsxs(A.Fragment, { children: [
              q.map((dt, ot) => {
                const Ot = tt[ot] || {
                  name: `Track ${ot + 1}`,
                  muted: !1,
                  soloed: !1,
                  volume: 1,
                  pan: 0
                }, Lt = t ? t(ot) : /* @__PURE__ */ A.jsxs(qf, { onClick: () => he(ot, "Clicked controls"), children: [
                  /* @__PURE__ */ A.jsx(U1, { style: { justifyContent: "center" }, children: Ot.name || `Track ${ot + 1}` }),
                  /* @__PURE__ */ A.jsxs(X1, { children: [
                    /* @__PURE__ */ A.jsx(
                      Kr,
                      {
                        $variant: Ot.muted ? "danger" : "outline",
                        onClick: () => S(ot, !Ot.muted),
                        children: "Mute"
                      }
                    ),
                    /* @__PURE__ */ A.jsx(
                      Kr,
                      {
                        $variant: Ot.soloed ? "info" : "outline",
                        onClick: () => b(ot, !Ot.soloed),
                        children: "Solo"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ A.jsxs(ph, { children: [
                    /* @__PURE__ */ A.jsx(Bf, {}),
                    /* @__PURE__ */ A.jsx(
                      Qr,
                      {
                        min: "0",
                        max: "1",
                        step: "0.01",
                        value: Ot.volume,
                        onChange: (qt) => O(ot, parseFloat(qt.target.value))
                      }
                    ),
                    /* @__PURE__ */ A.jsx($f, {})
                  ] }),
                  /* @__PURE__ */ A.jsxs(ph, { children: [
                    /* @__PURE__ */ A.jsx("span", { children: "L" }),
                    /* @__PURE__ */ A.jsx(
                      Qr,
                      {
                        min: "-1",
                        max: "1",
                        step: "0.01",
                        value: Ot.pan,
                        onChange: (qt) => D(ot, parseFloat(qt.target.value))
                      }
                    ),
                    /* @__PURE__ */ A.jsx("span", { children: "R" })
                  ] })
                ] }), Ht = dt.length > 0 ? Math.max(...dt.map((qt) => qt.peaks.data.length)) : 1;
                return /* @__PURE__ */ A.jsx(kl.Provider, { value: Lt, children: /* @__PURE__ */ A.jsxs(
                  Lf,
                  {
                    numChannels: Ht,
                    backgroundColor: l.waveOutlineColor,
                    offset: 0,
                    width: Z,
                    hasClipHeaders: o,
                    trackId: j[ot].id,
                    isSelected: j[ot].id === T,
                    children: [
                      dt.map((qt, me) => {
                        const rn = qt.peaks, kn = rn.length;
                        return /* @__PURE__ */ A.jsx(
                          dh,
                          {
                            clipId: qt.clipId,
                            trackIndex: ot,
                            clipIndex: me,
                            trackName: qt.trackName,
                            startSample: qt.startSample,
                            durationSamples: qt.durationSamples,
                            samplesPerPixel: R,
                            showHeader: o,
                            disableHeaderDrag: !a,
                            isSelected: j[ot].id === T,
                            trackId: j[ot].id,
                            onMouseDown: (on) => {
                              on.target.closest('[role="button"][aria-roledescription="draggable"]') || he(ot, "Clicked clip");
                            },
                            children: rn.data.map((on, He) => /* @__PURE__ */ A.jsx(
                              Fa,
                              {
                                index: He,
                                data: on,
                                bits: rn.bits,
                                length: kn,
                                progress: 0,
                                isSelected: j[ot].id === T
                              },
                              `${ot}-${me}-${He}`
                            ))
                          },
                          `${ot}-${me}`
                        );
                      }),
                      c?.isRecording && c.trackId === j[ot].id && c.peaks.length > 0 && /* @__PURE__ */ A.jsx(
                        dh,
                        {
                          clipId: "recording-preview",
                          trackIndex: ot,
                          clipIndex: dt.length,
                          trackName: "Recording...",
                          startSample: c.startSample,
                          durationSamples: c.durationSamples,
                          samplesPerPixel: R,
                          showHeader: o,
                          disableHeaderDrag: !0,
                          isSelected: j[ot].id === T,
                          trackId: j[ot].id,
                          children: /* @__PURE__ */ A.jsx(
                            Fa,
                            {
                              index: 0,
                              data: c.peaks,
                              bits: 16,
                              length: Math.floor(c.peaks.length / 2),
                              progress: 0,
                              isSelected: j[ot].id === T
                            },
                            `${ot}-recording-0`
                          )
                        },
                        `${ot}-recording`
                      )
                    ]
                  }
                ) }, ot);
              }),
              m.length > 0 && /* @__PURE__ */ A.jsx(Gf, { height: 30, width: Z, children: m.map((dt) => {
                const ot = dt.start * B / R, Ot = dt.end * B / R;
                return /* @__PURE__ */ A.jsx(
                  zf,
                  {
                    startPosition: ot,
                    endPosition: Ot,
                    label: dt.id,
                    color: "#ff9800",
                    isActive: dt.id === g,
                    onClick: () => kt(dt),
                    onDragStart: (Lt, Ht) => bt(dt.id, Lt, Ht),
                    onDrag: Ft,
                    onDragEnd: ue
                  },
                  dt.id
                );
              }) }),
              f !== p && /* @__PURE__ */ A.jsx(
                If,
                {
                  startPosition: Math.min(f, p) * B / R + (z.show ? z.width : 0),
                  endPosition: Math.max(f, p) * B / R + (z.show ? z.width : 0),
                  color: l.selectionColor
                }
              ),
              (u || f === p) && /* @__PURE__ */ A.jsx(
                kf,
                {
                  position: h * B / R + (z.show ? z.width : 0),
                  color: l.playheadColor
                }
              )
            ] })
          }
        ),
        m.length > 0 && /* @__PURE__ */ A.jsx(
          Zf,
          {
            annotations: m,
            activeAnnotationId: g ?? void 0,
            shouldScrollToActive: !0,
            editable: _,
            controls: _ ? s : void 0,
            annotationListConfig: { linkEndpoints: v, continuousPlay: x },
            onAnnotationUpdate: (dt) => {
              y(dt);
            }
          }
        )
      ]
    }
  ) });
};
function Rs(n, t) {
  this._waveformData = n, this._channelIndex = t;
}
Rs.prototype.min_sample = function(n) {
  var t = (n * this._waveformData.channels + this._channelIndex) * 2;
  return this._waveformData._at(t);
};
Rs.prototype.max_sample = function(n) {
  var t = (n * this._waveformData.channels + this._channelIndex) * 2 + 1;
  return this._waveformData._at(t);
};
Rs.prototype.set_min_sample = function(n, t) {
  var e = (n * this._waveformData.channels + this._channelIndex) * 2;
  return this._waveformData._set_at(e, t);
};
Rs.prototype.set_max_sample = function(n, t) {
  var e = (n * this._waveformData.channels + this._channelIndex) * 2 + 1;
  return this._waveformData._set_at(e, t);
};
Rs.prototype.min_array = function() {
  for (var n = this._waveformData.length, t = [], e = 0; e < n; e++)
    t.push(this.min_sample(e));
  return t;
};
Rs.prototype.max_array = function() {
  for (var n = this._waveformData.length, t = [], e = 0; e < n; e++)
    t.push(this.max_sample(e));
  return t;
};
var VC = 127, WC = -128, jC = 32767, LC = -32768;
function qC(n, t) {
  var e = Math.floor(n / t), s = n - e * t;
  return s > 0 && e++, e;
}
function BC(n) {
  for (var t = n.scale, e = n.amplitude_scale, s = n.split_channels, i = n.length, r = n.sample_rate, o = n.channels.map(function(k) {
    return new Float32Array(k);
  }), a = s ? o.length : 1, c = 24, l = qC(i, t), u = n.bits === 8 ? 1 : 2, h = c + l * 2 * u * a, d = new ArrayBuffer(h), f = new DataView(d), p = 0, m = c, g = new Array(a), _ = new Array(a), v = 0; v < a; v++)
    g[v] = 1 / 0, _[v] = -1 / 0;
  var x = n.bits === 8 ? WC : LC, T = n.bits === 8 ? VC : jC;
  f.setInt32(0, 2, !0), f.setUint32(4, n.bits === 8, !0), f.setInt32(8, r, !0), f.setInt32(12, t, !0), f.setInt32(16, l, !0), f.setInt32(20, a, !0);
  for (var y = 0; y < i; y++) {
    var w = 0;
    if (a === 1) {
      for (var S = 0; S < o.length; ++S)
        w += o[S][y];
      w = Math.floor(T * w * e / o.length), w < g[0] && (g[0] = w, g[0] < x && (g[0] = x)), w > _[0] && (_[0] = w, _[0] > T && (_[0] = T));
    } else
      for (var b = 0; b < a; ++b)
        w = Math.floor(T * o[b][y] * e), w < g[b] && (g[b] = w, g[b] < x && (g[b] = x)), w > _[b] && (_[b] = w, _[b] > T && (_[b] = T));
    if (++p === t) {
      for (var O = 0; O < a; O++)
        n.bits === 8 ? (f.setInt8(m++, g[O]), f.setInt8(m++, _[O])) : (f.setInt16(m, g[O], !0), f.setInt16(m + 2, _[O], !0), m += 4), g[O] = 1 / 0, _[O] = -1 / 0;
      p = 0;
    }
  }
  if (p > 0)
    for (var D = 0; D < a; D++)
      n.bits === 8 ? (f.setInt8(m++, g[D]), f.setInt8(m++, _[D])) : (f.setInt16(m, g[D], !0), f.setInt16(m + 2, _[D], !0));
  return d;
}
function Jr(n) {
  "@babel/helpers - typeof";
  return Jr = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, Jr(n);
}
function $C(n) {
  return n && Jr(n) === "object" && "sample_rate" in n && "samples_per_pixel" in n && "bits" in n && "length" in n && "data" in n;
}
function zC(n) {
  var t = n && Jr(n) === "object" && "byteLength" in n;
  if (t) {
    var e = new DataView(n), s = e.getInt32(0, !0);
    if (s !== 1 && s !== 2)
      throw new TypeError("WaveformData.create(): This waveform data version not supported");
  }
  return t;
}
function GC(n) {
  var t = n.data, e = n.channels || 1, s = 24, i = n.bits === 8 ? 1 : 2, r = n.length * 2 * e;
  if (t.length !== r)
    throw new Error("WaveformData.create(): Length mismatch in JSON waveform data");
  var o = s + t.length * i, a = new ArrayBuffer(o), c = new DataView(a);
  c.setInt32(0, 2, !0), c.setUint32(4, n.bits === 8, !0), c.setInt32(8, n.sample_rate, !0), c.setInt32(12, n.samples_per_pixel, !0), c.setInt32(16, n.length, !0), c.setInt32(20, e, !0);
  var l = s;
  if (n.bits === 8)
    for (var u = 0; u < t.length; u++)
      c.setInt8(l++, t[u], !0);
  else
    for (var h = 0; h < t.length; h++)
      c.setInt16(l, t[h], !0), l += 2;
  return a;
}
function Vs(n) {
  return n == null;
}
function ZC(n, t) {
  var e = atob(n);
  return e;
}
function YC(n, t, e) {
  var s = ZC(n), i = s.indexOf(`
`, 10) + 1, r = s.substring(i) + "", o = new Blob([r], { type: "application/javascript" });
  return URL.createObjectURL(o);
}
function XC(n, t, e) {
  var s;
  return function(r) {
    return s = s || YC(n), new Worker(s, r);
  };
}
var UC = /* @__PURE__ */ XC("Lyogcm9sbHVwLXBsdWdpbi13ZWItd29ya2VyLWxvYWRlciAqLwooZnVuY3Rpb24gKCkgewogICd1c2Ugc3RyaWN0JzsKCiAgLyoqCiAgICogQXVkaW9CdWZmZXItYmFzZWQgV2F2ZWZvcm1EYXRhIGdlbmVyYXRvcgogICAqCiAgICogQWRhcHRlZCBmcm9tIEJsb2NrRmlsZTo6Q2FsY1N1bW1hcnkgaW4gQXVkYWNpdHksIHdpdGggcGVybWlzc2lvbi4KICAgKiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2F1ZGFjaXR5L2F1ZGFjaXR5L2Jsb2IvCiAgICogICAxMTA4YzEzNzZjMDkxNjYxNjIzMzVmYWI0NzQzMDA4Y2JhNTdjNGVlL3NyYy9CbG9ja0ZpbGUuY3BwI0wxOTgKICAgKi8KCiAgdmFyIElOVDhfTUFYID0gMTI3OwogIHZhciBJTlQ4X01JTiA9IC0xMjg7CiAgdmFyIElOVDE2X01BWCA9IDMyNzY3OwogIHZhciBJTlQxNl9NSU4gPSAtMzI3Njg7CiAgZnVuY3Rpb24gY2FsY3VsYXRlV2F2ZWZvcm1EYXRhTGVuZ3RoKGF1ZGlvX3NhbXBsZV9jb3VudCwgc2NhbGUpIHsKICAgIHZhciBkYXRhX2xlbmd0aCA9IE1hdGguZmxvb3IoYXVkaW9fc2FtcGxlX2NvdW50IC8gc2NhbGUpOwogICAgdmFyIHNhbXBsZXNfcmVtYWluaW5nID0gYXVkaW9fc2FtcGxlX2NvdW50IC0gZGF0YV9sZW5ndGggKiBzY2FsZTsKICAgIGlmIChzYW1wbGVzX3JlbWFpbmluZyA+IDApIHsKICAgICAgZGF0YV9sZW5ndGgrKzsKICAgIH0KICAgIHJldHVybiBkYXRhX2xlbmd0aDsKICB9CiAgZnVuY3Rpb24gZ2VuZXJhdGVXYXZlZm9ybURhdGEob3B0aW9ucykgewogICAgdmFyIHNjYWxlID0gb3B0aW9ucy5zY2FsZTsKICAgIHZhciBhbXBsaXR1ZGVfc2NhbGUgPSBvcHRpb25zLmFtcGxpdHVkZV9zY2FsZTsKICAgIHZhciBzcGxpdF9jaGFubmVscyA9IG9wdGlvbnMuc3BsaXRfY2hhbm5lbHM7CiAgICB2YXIgbGVuZ3RoID0gb3B0aW9ucy5sZW5ndGg7CiAgICB2YXIgc2FtcGxlX3JhdGUgPSBvcHRpb25zLnNhbXBsZV9yYXRlOwogICAgdmFyIGNoYW5uZWxzID0gb3B0aW9ucy5jaGFubmVscy5tYXAoZnVuY3Rpb24gKGNoYW5uZWwpIHsKICAgICAgcmV0dXJuIG5ldyBGbG9hdDMyQXJyYXkoY2hhbm5lbCk7CiAgICB9KTsKICAgIHZhciBvdXRwdXRfY2hhbm5lbHMgPSBzcGxpdF9jaGFubmVscyA/IGNoYW5uZWxzLmxlbmd0aCA6IDE7CiAgICB2YXIgaGVhZGVyX3NpemUgPSAyNDsKICAgIHZhciBkYXRhX2xlbmd0aCA9IGNhbGN1bGF0ZVdhdmVmb3JtRGF0YUxlbmd0aChsZW5ndGgsIHNjYWxlKTsKICAgIHZhciBieXRlc19wZXJfc2FtcGxlID0gb3B0aW9ucy5iaXRzID09PSA4ID8gMSA6IDI7CiAgICB2YXIgdG90YWxfc2l6ZSA9IGhlYWRlcl9zaXplICsgZGF0YV9sZW5ndGggKiAyICogYnl0ZXNfcGVyX3NhbXBsZSAqIG91dHB1dF9jaGFubmVsczsKICAgIHZhciBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIodG90YWxfc2l6ZSk7CiAgICB2YXIgZGF0YV92aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7CiAgICB2YXIgc2NhbGVfY291bnRlciA9IDA7CiAgICB2YXIgb2Zmc2V0ID0gaGVhZGVyX3NpemU7CiAgICB2YXIgbWluX3ZhbHVlID0gbmV3IEFycmF5KG91dHB1dF9jaGFubmVscyk7CiAgICB2YXIgbWF4X3ZhbHVlID0gbmV3IEFycmF5KG91dHB1dF9jaGFubmVscyk7CiAgICBmb3IgKHZhciBjaGFubmVsID0gMDsgY2hhbm5lbCA8IG91dHB1dF9jaGFubmVsczsgY2hhbm5lbCsrKSB7CiAgICAgIG1pbl92YWx1ZVtjaGFubmVsXSA9IEluZmluaXR5OwogICAgICBtYXhfdmFsdWVbY2hhbm5lbF0gPSAtSW5maW5pdHk7CiAgICB9CiAgICB2YXIgcmFuZ2VfbWluID0gb3B0aW9ucy5iaXRzID09PSA4ID8gSU5UOF9NSU4gOiBJTlQxNl9NSU47CiAgICB2YXIgcmFuZ2VfbWF4ID0gb3B0aW9ucy5iaXRzID09PSA4ID8gSU5UOF9NQVggOiBJTlQxNl9NQVg7CiAgICBkYXRhX3ZpZXcuc2V0SW50MzIoMCwgMiwgdHJ1ZSk7IC8vIFZlcnNpb24KICAgIGRhdGFfdmlldy5zZXRVaW50MzIoNCwgb3B0aW9ucy5iaXRzID09PSA4LCB0cnVlKTsgLy8gSXMgOCBiaXQ/CiAgICBkYXRhX3ZpZXcuc2V0SW50MzIoOCwgc2FtcGxlX3JhdGUsIHRydWUpOyAvLyBTYW1wbGUgcmF0ZQogICAgZGF0YV92aWV3LnNldEludDMyKDEyLCBzY2FsZSwgdHJ1ZSk7IC8vIFNjYWxlCiAgICBkYXRhX3ZpZXcuc2V0SW50MzIoMTYsIGRhdGFfbGVuZ3RoLCB0cnVlKTsgLy8gTGVuZ3RoCiAgICBkYXRhX3ZpZXcuc2V0SW50MzIoMjAsIG91dHB1dF9jaGFubmVscywgdHJ1ZSk7CiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7CiAgICAgIHZhciBzYW1wbGUgPSAwOwogICAgICBpZiAob3V0cHV0X2NoYW5uZWxzID09PSAxKSB7CiAgICAgICAgZm9yICh2YXIgX2NoYW5uZWwgPSAwOyBfY2hhbm5lbCA8IGNoYW5uZWxzLmxlbmd0aDsgKytfY2hhbm5lbCkgewogICAgICAgICAgc2FtcGxlICs9IGNoYW5uZWxzW19jaGFubmVsXVtpXTsKICAgICAgICB9CiAgICAgICAgc2FtcGxlID0gTWF0aC5mbG9vcihyYW5nZV9tYXggKiBzYW1wbGUgKiBhbXBsaXR1ZGVfc2NhbGUgLyBjaGFubmVscy5sZW5ndGgpOwogICAgICAgIGlmIChzYW1wbGUgPCBtaW5fdmFsdWVbMF0pIHsKICAgICAgICAgIG1pbl92YWx1ZVswXSA9IHNhbXBsZTsKICAgICAgICAgIGlmIChtaW5fdmFsdWVbMF0gPCByYW5nZV9taW4pIHsKICAgICAgICAgICAgbWluX3ZhbHVlWzBdID0gcmFuZ2VfbWluOwogICAgICAgICAgfQogICAgICAgIH0KICAgICAgICBpZiAoc2FtcGxlID4gbWF4X3ZhbHVlWzBdKSB7CiAgICAgICAgICBtYXhfdmFsdWVbMF0gPSBzYW1wbGU7CiAgICAgICAgICBpZiAobWF4X3ZhbHVlWzBdID4gcmFuZ2VfbWF4KSB7CiAgICAgICAgICAgIG1heF92YWx1ZVswXSA9IHJhbmdlX21heDsKICAgICAgICAgIH0KICAgICAgICB9CiAgICAgIH0gZWxzZSB7CiAgICAgICAgZm9yICh2YXIgX2NoYW5uZWwyID0gMDsgX2NoYW5uZWwyIDwgb3V0cHV0X2NoYW5uZWxzOyArK19jaGFubmVsMikgewogICAgICAgICAgc2FtcGxlID0gTWF0aC5mbG9vcihyYW5nZV9tYXggKiBjaGFubmVsc1tfY2hhbm5lbDJdW2ldICogYW1wbGl0dWRlX3NjYWxlKTsKICAgICAgICAgIGlmIChzYW1wbGUgPCBtaW5fdmFsdWVbX2NoYW5uZWwyXSkgewogICAgICAgICAgICBtaW5fdmFsdWVbX2NoYW5uZWwyXSA9IHNhbXBsZTsKICAgICAgICAgICAgaWYgKG1pbl92YWx1ZVtfY2hhbm5lbDJdIDwgcmFuZ2VfbWluKSB7CiAgICAgICAgICAgICAgbWluX3ZhbHVlW19jaGFubmVsMl0gPSByYW5nZV9taW47CiAgICAgICAgICAgIH0KICAgICAgICAgIH0KICAgICAgICAgIGlmIChzYW1wbGUgPiBtYXhfdmFsdWVbX2NoYW5uZWwyXSkgewogICAgICAgICAgICBtYXhfdmFsdWVbX2NoYW5uZWwyXSA9IHNhbXBsZTsKICAgICAgICAgICAgaWYgKG1heF92YWx1ZVtfY2hhbm5lbDJdID4gcmFuZ2VfbWF4KSB7CiAgICAgICAgICAgICAgbWF4X3ZhbHVlW19jaGFubmVsMl0gPSByYW5nZV9tYXg7CiAgICAgICAgICAgIH0KICAgICAgICAgIH0KICAgICAgICB9CiAgICAgIH0KICAgICAgaWYgKCsrc2NhbGVfY291bnRlciA9PT0gc2NhbGUpIHsKICAgICAgICBmb3IgKHZhciBfY2hhbm5lbDMgPSAwOyBfY2hhbm5lbDMgPCBvdXRwdXRfY2hhbm5lbHM7IF9jaGFubmVsMysrKSB7CiAgICAgICAgICBpZiAob3B0aW9ucy5iaXRzID09PSA4KSB7CiAgICAgICAgICAgIGRhdGFfdmlldy5zZXRJbnQ4KG9mZnNldCsrLCBtaW5fdmFsdWVbX2NoYW5uZWwzXSk7CiAgICAgICAgICAgIGRhdGFfdmlldy5zZXRJbnQ4KG9mZnNldCsrLCBtYXhfdmFsdWVbX2NoYW5uZWwzXSk7CiAgICAgICAgICB9IGVsc2UgewogICAgICAgICAgICBkYXRhX3ZpZXcuc2V0SW50MTYob2Zmc2V0LCBtaW5fdmFsdWVbX2NoYW5uZWwzXSwgdHJ1ZSk7CiAgICAgICAgICAgIGRhdGFfdmlldy5zZXRJbnQxNihvZmZzZXQgKyAyLCBtYXhfdmFsdWVbX2NoYW5uZWwzXSwgdHJ1ZSk7CiAgICAgICAgICAgIG9mZnNldCArPSA0OwogICAgICAgICAgfQogICAgICAgICAgbWluX3ZhbHVlW19jaGFubmVsM10gPSBJbmZpbml0eTsKICAgICAgICAgIG1heF92YWx1ZVtfY2hhbm5lbDNdID0gLUluZmluaXR5OwogICAgICAgIH0KICAgICAgICBzY2FsZV9jb3VudGVyID0gMDsKICAgICAgfQogICAgfQogICAgaWYgKHNjYWxlX2NvdW50ZXIgPiAwKSB7CiAgICAgIGZvciAodmFyIF9jaGFubmVsNCA9IDA7IF9jaGFubmVsNCA8IG91dHB1dF9jaGFubmVsczsgX2NoYW5uZWw0KyspIHsKICAgICAgICBpZiAob3B0aW9ucy5iaXRzID09PSA4KSB7CiAgICAgICAgICBkYXRhX3ZpZXcuc2V0SW50OChvZmZzZXQrKywgbWluX3ZhbHVlW19jaGFubmVsNF0pOwogICAgICAgICAgZGF0YV92aWV3LnNldEludDgob2Zmc2V0KyssIG1heF92YWx1ZVtfY2hhbm5lbDRdKTsKICAgICAgICB9IGVsc2UgewogICAgICAgICAgZGF0YV92aWV3LnNldEludDE2KG9mZnNldCwgbWluX3ZhbHVlW19jaGFubmVsNF0sIHRydWUpOwogICAgICAgICAgZGF0YV92aWV3LnNldEludDE2KG9mZnNldCArIDIsIG1heF92YWx1ZVtfY2hhbm5lbDRdLCB0cnVlKTsKICAgICAgICB9CiAgICAgIH0KICAgIH0KICAgIHJldHVybiBidWZmZXI7CiAgfQoKICBvbm1lc3NhZ2UgPSBmdW5jdGlvbiBvbm1lc3NhZ2UoZXZ0KSB7CiAgICB2YXIgYnVmZmVyID0gZ2VuZXJhdGVXYXZlZm9ybURhdGEoZXZ0LmRhdGEpOwoKICAgIC8vIFRyYW5zZmVyIGJ1ZmZlciB0byB0aGUgY2FsbGluZyB0aHJlYWQKICAgIHRoaXMucG9zdE1lc3NhZ2UoYnVmZmVyLCBbYnVmZmVyXSk7CiAgICB0aGlzLmNsb3NlKCk7CiAgfTsKCn0pKCk7Ci8vIyBzb3VyY2VNYXBwaW5nVVJMPXdhdmVmb3JtLWRhdGEtd29ya2VyLmpzLm1hcAoK");
function Je(n) {
  if ($C(n) && (n = GC(n)), zC(n)) {
    this._data = new DataView(n), this._offset = this._version() === 2 ? 24 : 20, this._channels = [];
    for (var t = 0; t < this.channels; t++)
      this._channels[t] = new Rs(this, t);
  } else
    throw new TypeError("WaveformData.create(): Unknown data format");
}
var Ai = {
  scale: 512,
  bits: 8,
  amplitude_scale: 1,
  split_channels: !1,
  disable_worker: !1
};
function HC(n) {
  var t = {
    scale: n.scale || Ai.scale,
    bits: n.bits || Ai.bits,
    amplitude_scale: n.amplitude_scale || Ai.amplitude_scale,
    split_channels: n.split_channels || Ai.split_channels,
    disable_worker: n.disable_worker || Ai.disable_worker
  };
  return t;
}
function KC(n) {
  for (var t = [], e = 0; e < n.numberOfChannels; ++e)
    t.push(n.getChannelData(e).buffer);
  return t;
}
function tp(n, t, e) {
  var s = KC(n);
  if (t.disable_worker) {
    var i = BC({
      scale: t.scale,
      bits: t.bits,
      amplitude_scale: t.amplitude_scale,
      split_channels: t.split_channels,
      length: n.length,
      sample_rate: n.sampleRate,
      channels: s
    });
    e(void 0, new Je(i), n);
  } else {
    var r = new UC();
    r.onmessage = function(o) {
      e(void 0, new Je(o.data), n);
    }, r.postMessage({
      scale: t.scale,
      bits: t.bits,
      amplitude_scale: t.amplitude_scale,
      split_channels: t.split_channels,
      length: n.length,
      sample_rate: n.sampleRate,
      channels: s
    }, s);
  }
}
function QC(n, t, e, s) {
  function i(o) {
    o || (o = new DOMException("EncodingError")), s(o), s = function() {
    };
  }
  var r = n.decodeAudioData(t, function(o) {
    tp(o, e, s);
  }, i);
  r && r.catch(i);
}
Je.create = function(t) {
  return new Je(t);
};
Je.createFromAudio = function(n, t) {
  var e = HC(n);
  if (n.audio_context && n.array_buffer)
    return QC(n.audio_context, n.array_buffer, e, t);
  if (n.audio_buffer)
    return tp(n.audio_buffer, e, t);
  throw new TypeError(
    // eslint-disable-next-line
    "WaveformData.createFromAudio(): Pass either an AudioContext and ArrayBuffer, or an AudioBuffer object"
  );
};
function ko(n) {
  this._inputData = n.waveformData, this._output_samples_per_pixel = n.scale, this._scale = this._inputData.scale, this._input_buffer_size = this._inputData.length;
  var t = this._input_buffer_size * this._inputData.scale, e = Math.ceil(t / this._output_samples_per_pixel), s = 24, i = this._inputData.bits === 8 ? 1 : 2, r = s + e * 2 * this._inputData.channels * i;
  this._output_data = new ArrayBuffer(r), this.output_dataview = new DataView(this._output_data), this.output_dataview.setInt32(0, 2, !0), this.output_dataview.setUint32(4, this._inputData.bits === 8, !0), this.output_dataview.setInt32(8, this._inputData.sample_rate, !0), this.output_dataview.setInt32(12, this._output_samples_per_pixel, !0), this.output_dataview.setInt32(16, e, !0), this.output_dataview.setInt32(20, this._inputData.channels, !0), this._outputWaveformData = new Je(this._output_data), this._input_index = 0, this._output_index = 0;
  var o = this._inputData.channels;
  this._min = new Array(o), this._max = new Array(o);
  for (var a = 0; a < o; ++a)
    this._input_buffer_size > 0 ? (this._min[a] = this._inputData.channel(a).min_sample(this._input_index), this._max[a] = this._inputData.channel(a).max_sample(this._input_index)) : (this._min[a] = 0, this._max[a] = 0);
  this._min_value = this._inputData.bits === 8 ? -128 : -32768, this._max_value = this._inputData.bits === 8 ? 127 : 32767, this._where = 0, this._prev_where = 0, this._stop = 0, this._last_input_index = 0;
}
ko.prototype.sample_at_pixel = function(n) {
  return Math.floor(n * this._output_samples_per_pixel);
};
ko.prototype.next = function() {
  for (var n = 0, t = 1e3, e = this._inputData.channels, s; this._input_index < this._input_buffer_size && n < t; ) {
    for (; Math.floor(this.sample_at_pixel(this._output_index) / this._scale) === this._input_index; ) {
      if (this._output_index > 0)
        for (var i = 0; i < e; ++i)
          s = this._outputWaveformData.channel(i), s.set_min_sample(this._output_index - 1, this._min[i]), s.set_max_sample(this._output_index - 1, this._max[i]);
      if (this._last_input_index = this._input_index, this._output_index++, this._where = this.sample_at_pixel(this._output_index), this._prev_where = this.sample_at_pixel(this._output_index - 1), this._where !== this._prev_where)
        for (var r = 0; r < e; ++r)
          this._min[r] = this._max_value, this._max[r] = this._min_value;
    }
    for (this._where = this.sample_at_pixel(this._output_index), this._stop = Math.floor(this._where / this._scale), this._stop > this._input_buffer_size && (this._stop = this._input_buffer_size); this._input_index < this._stop; ) {
      for (var o = 0; o < e; ++o) {
        s = this._inputData.channel(o);
        var a = s.min_sample(this._input_index);
        a < this._min[o] && (this._min[o] = a), a = s.max_sample(this._input_index), a > this._max[o] && (this._max[o] = a);
      }
      this._input_index++;
    }
    n++;
  }
  if (this._input_index < this._input_buffer_size)
    return !1;
  if (this._input_index !== this._last_input_index)
    for (var c = 0; c < e; ++c)
      s = this._outputWaveformData.channel(c), s.set_min_sample(this._output_index - 1, this._min[c]), s.set_max_sample(this._output_index - 1, this._max[c]);
  return !0;
};
ko.prototype.getOutputData = function() {
  return this._output_data;
};
Je.prototype = {
  _getResampleOptions: function(t) {
    var e = {};
    if (e.scale = t.scale, e.width = t.width, !Vs(e.width) && (typeof e.width != "number" || e.width <= 0))
      throw new RangeError("WaveformData.resample(): width should be a positive integer value");
    if (!Vs(e.scale) && (typeof e.scale != "number" || e.scale <= 0))
      throw new RangeError("WaveformData.resample(): scale should be a positive integer value");
    if (!e.scale && !e.width)
      throw new Error("WaveformData.resample(): Missing scale or width option");
    if (e.width && (e.scale = Math.floor(this.duration * this.sample_rate / e.width)), e.scale < this.scale)
      throw new Error("WaveformData.resample(): Zoom level " + e.scale + " too low, minimum: " + this.scale);
    return e.abortSignal = t.abortSignal, e;
  },
  resample: function(t) {
    t = this._getResampleOptions(t), t.waveformData = this;
    for (var e = new ko(t); !e.next(); )
      ;
    return new Je(e.getOutputData());
  },
  /**
   * Concatenates with one or more other waveforms, returning a new WaveformData object.
   */
  concat: function() {
    var t = this, e = Array.prototype.slice.call(arguments);
    e.forEach(function(i) {
      if (t.channels !== i.channels || t.sample_rate !== i.sample_rate || t.bits !== i.bits || t.scale !== i.scale)
        throw new Error("WaveformData.concat(): Waveforms are incompatible");
    });
    var s = this._concatBuffers.apply(this, e);
    return Je.create(s);
  },
  /**
   * Returns a new ArrayBuffer with the concatenated waveform.
   * All waveforms must have identical metadata (version, channels, etc)
   */
  _concatBuffers: function() {
    for (var t = Array.prototype.slice.call(arguments), e = this._offset, s = e, i = 0, r = [this].concat(t).map(function(_) {
      return _._data.buffer;
    }), o = 0; o < r.length; o++) {
      var a = r[o], c = new DataView(a).getInt32(16, !0);
      s += a.byteLength - e, i += c;
    }
    for (var l = new ArrayBuffer(s), u = new DataView(r[0]), h = new DataView(l), d = 0; d < e; d++)
      h.setUint8(d, u.getUint8(d));
    h.setInt32(16, i, !0);
    for (var f = 0, p = new Uint8Array(l, e), m = 0; m < r.length; m++) {
      var g = r[m];
      p.set(new Uint8Array(g, e), f), f += g.byteLength - e;
    }
    return l;
  },
  slice: function(t) {
    var e = 0, s = 0;
    if (!Vs(t.startIndex) && !Vs(t.endIndex) ? (e = t.startIndex, s = t.endIndex) : !Vs(t.startTime) && !Vs(t.endTime) && (e = this.at_time(t.startTime), s = this.at_time(t.endTime)), e < 0)
      throw new RangeError("startIndex or startTime must not be negative");
    if (s < 0)
      throw new RangeError("endIndex or endTime must not be negative");
    e > this.length && (e = this.length), s > this.length && (s = this.length), e > s && (e = s);
    var i = s - e, r = 24, o = this.bits === 8 ? 1 : 2, a = r + i * 2 * this.channels * o, c = new ArrayBuffer(a), l = new DataView(c);
    l.setInt32(0, 2, !0), l.setUint32(4, this.bits === 8, !0), l.setInt32(8, this.sample_rate, !0), l.setInt32(12, this.scale, !0), l.setInt32(16, i, !0), l.setInt32(20, this.channels, !0);
    for (var u = 0; u < i * this.channels * 2; u++) {
      var h = this._at(e * this.channels * 2 + u);
      this.bits === 8 ? l.setInt8(r + u, h) : l.setInt16(r + u * 2, h, !0);
    }
    return new Je(c);
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
    var n = !!this._data.getUint32(4, !0);
    return n ? 8 : 16;
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
  _set_at: function(t, e) {
    return this.bits === 8 ? this._data.setInt8(this._offset + t, e) : this._data.setInt16(this._offset + t * 2, e, !0);
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
    }, e = 0; e < this.length; e++)
      for (var s = 0; s < this.channels; s++)
        t.data.push(this.channel(s).min_sample(e)), t.data.push(this.channel(s).max_sample(e));
    return t;
  },
  /**
   * Returns the waveform data in binary format as an ArrayBuffer.
   */
  toArrayBuffer: function() {
    return this._data.buffer;
  }
};
async function ep(n) {
  const t = await fetch(n);
  if (!t.ok)
    throw new Error(`Failed to fetch waveform data: ${t.statusText}`);
  if (n.endsWith(".dat")) {
    const s = await t.arrayBuffer();
    return Je.create(s);
  } else {
    const s = await t.json();
    return Je.create(s);
  }
}
function JC(n, t = 0) {
  const e = n.channel(t), s = e.min_array(), i = e.max_array(), r = s.length, o = new Int16Array(r * 2);
  for (let a = 0; a < r; a++)
    o[a * 2] = s[a] * 256, o[a * 2 + 1] = i[a] * 256;
  return {
    data: o,
    bits: 16,
    length: r,
    sampleRate: n.sample_rate
  };
}
async function hT(n, t = 0) {
  const e = await ep(n);
  return JC(e, t);
}
async function dT(n) {
  const t = await ep(n);
  return {
    sampleRate: t.sample_rate,
    channels: t.channels,
    duration: t.duration,
    samplesPerPixel: t.scale,
    length: t.length
  };
}
const tS = {
  waveOutlineColor: "#00f",
  waveFillColor: "#0ff",
  waveProgressColor: "#f00",
  timeColor: "#000"
};
class eS {
  constructor(t) {
    this.root = null, this.playout = null, this.tracks = [], this.peaksData = /* @__PURE__ */ new Map(), this.eventEmitter = null, this.playbackState = "stopped", this.currentTime = 0, this.hasSeeked = !1, this.animationFrameId = null, this.setProgressFn = null, this.setSelectionFn = null, this.setIsPlayingFn = null, this.isAutomaticScroll = !1, this.scrollContainer = null, this.selectionStart = 0, this.selectionEnd = 0, this.timeFormat = "hh:mm:ss.uuu", this.isDragging = !1, this.dragStartTime = 0, this.annotations = [], this.activeAnnotationId = null, this.setAnnotationsFn = null, this.lastScrolledAnnotationId = null, this.isPlayingTimedSegment = !1, this.getTimeFromMouseEvent = (e) => {
      if (!this.playout || !this.scrollContainer)
        return null;
      const s = e.currentTarget.getBoundingClientRect(), i = e.clientX - s.left, r = this.config.samplesPerPixel || 4096, o = this.playout.sampleRate / r, a = i / o, c = this.getDuration();
      return Math.max(0, Math.min(a, c));
    }, this.handleMouseDown = (e) => {
      const s = this.getTimeFromMouseEvent(e);
      s !== null && (this.isDragging = !0, this.dragStartTime = s, this.setSelection(s, s));
    }, this.handleMouseMove = (e) => {
      if (!this.isDragging) return;
      const s = this.getTimeFromMouseEvent(e);
      if (s === null) return;
      const i = Math.min(this.dragStartTime, s), r = Math.max(this.dragStartTime, s);
      this.setSelection(i, r), this.setProgressFn && this.setProgressFn(this.currentTime);
    }, this.handleMouseUp = (e) => {
      if (!this.isDragging) return;
      const s = this.getTimeFromMouseEvent(e);
      if (s === null) return;
      this.isDragging = !1;
      const i = Math.min(this.dragStartTime, s), r = Math.max(this.dragStartTime, s);
      Math.abs(r - i) < 0.1 ? (this.currentTime = i, this.setProgressFn && this.setProgressFn(i), this.eventEmitter && this.eventEmitter.emit("timeupdate", i), this.playbackState === "playing" ? this.play(i) : (this.playout && this.playout.stop(), this.hasSeeked = !0)) : (this.setSelection(i, r), this.currentTime = i, this.setProgressFn && this.setProgressFn(i));
    }, this.container = t.container, this.config = t, this.isAutomaticScroll = t.isAutomaticScroll ?? !1, t.annotationList?.annotations && (this.annotations = t.annotationList.annotations.map((e) => {
      const s = e.begin !== void 0 ? parseFloat(e.begin) : e.start, i = e.end !== void 0 && typeof e.end == "string" ? parseFloat(e.end) : e.end;
      return {
        id: e.id,
        start: s,
        end: i,
        lines: e.lines,
        language: e.language
      };
    })), this.container.innerHTML = "", this.root = dp.createRoot(this.container), this.playout = new Md({
      effects: this.config.effects
    }), this.eventEmitter = this.createEventEmitter();
  }
  async load(t) {
    const e = At().rawContext, s = [];
    for (let i = 0; i < t.length; i++) {
      const r = t[i];
      try {
        const a = await hu.createLoader(r.src, e).load(), c = {
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
        const l = this.config.samplesPerPixel || 4096, u = this.config.mono ?? !0, h = Va(a, l, u);
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
  async addTrack(t, e) {
    const s = At().rawContext;
    try {
      const i = {
        src: t,
        name: e?.name,
        start: e?.start,
        fadeIn: e?.fadeIn,
        fadeOut: e?.fadeOut,
        gain: e?.gain,
        muted: e?.muted,
        soloed: e?.soloed,
        stereoPan: e?.stereoPan
      }, o = await hu.createLoader(i.src, s).load(), a = this.tracks.length, c = {
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
      }, l = this.config.samplesPerPixel || 4096, u = this.config.mono ?? !0, h = Va(o, l, u);
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
      ...tS,
      ...this.config.colors
    }, e = this.config.waveHeight || 128, s = this.config.samplesPerPixel || 4096, i = 30, r = () => {
      const { progress: o, selectionStart: a, selectionEnd: c, isPlaying: l } = N1(), { setProgress: u, setSelection: h, setIsPlaying: d } = P1();
      Kt.useRef(null), Kt.useEffect(() => (this.setProgressFn = u, this.setSelectionFn = h, this.setIsPlayingFn = d, () => {
        this.setProgressFn = null, this.setSelectionFn = null, this.setIsPlayingFn = null;
      }), [u, h, d]);
      const f = this.config.controls?.show !== !1, p = this.config.controls?.width || 200, m = this.config.timescale !== !1;
      let g = 0;
      this.playout && this.tracks.forEach((S) => {
        const b = this.playout?.getTrack(S.id);
        if (b) {
          const O = b.buffer.duration + S.startTime;
          g = Math.max(g, O);
        }
      });
      const _ = {
        sampleRate: this.playout?.sampleRate || 44100,
        samplesPerPixel: s,
        zoomLevels: this.config.zoomLevels || [512, 1024, 2048, 4096],
        waveHeight: e,
        timeScaleHeight: i,
        duration: g,
        controls: {
          show: f,
          width: p
        }
      }, v = Kt.useMemo(() => Kt.memo(
        ({ trackId: S, currentTime: b, selectionStart: O, selectionEnd: D, isPlaying: k }) => {
          const I = this.peaksData.get(S);
          if (!I || !this.playout) return null;
          const N = this.playout.getTrack(S);
          if (!N) return null;
          const F = I.length, L = this.tracks.find((R) => R.id === S)?.startTime || 0, q = N.buffer.duration, j = k || !(O !== D);
          let E = 0;
          if (j && b >= L) {
            const R = b - L;
            R <= q ? E = cn(R, s, this.playout.sampleRate) : E = cn(q, s, this.playout.sampleRate), E = Math.min(E, F);
          }
          return /* @__PURE__ */ A.jsx(A.Fragment, { children: I.data.map((R, B) => /* @__PURE__ */ A.jsx(
            Fa,
            {
              index: B,
              data: R,
              bits: I.bits,
              length: F,
              progress: E
            },
            B
          )) });
        }
      ), [t, e, s]), x = Kt.useMemo(() => ({ trackId: S, track: b }) => {
        const [O, D] = Kt.useState(b.muted), [k, I] = Kt.useState(b.soloed), [N, F] = Kt.useState(b.gain), [$, L] = Kt.useState(b.stereoPan || 0);
        return /* @__PURE__ */ A.jsxs(qf, { children: [
          /* @__PURE__ */ A.jsx("div", { style: { fontSize: "9px", fontWeight: "bold", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }, children: b.name }),
          /* @__PURE__ */ A.jsxs("div", { style: { display: "flex", gap: "3px", justifyContent: "center" }, children: [
            /* @__PURE__ */ A.jsx(
              Kr,
              {
                onClick: () => {
                  const q = !O;
                  D(q), this.setTrackMute(S, q);
                },
                style: {
                  padding: "2px 5px",
                  fontSize: "9px",
                  backgroundColor: O ? "#ef4444" : void 0,
                  color: O ? "#fff" : void 0
                },
                children: "Mute"
              }
            ),
            /* @__PURE__ */ A.jsx(
              Kr,
              {
                onClick: () => {
                  const q = !k;
                  I(q), this.setTrackSolo(S, q);
                },
                style: {
                  padding: "2px 5px",
                  fontSize: "9px",
                  backgroundColor: k ? "#3b82f6" : void 0,
                  color: k ? "#fff" : void 0
                },
                children: "Solo"
              }
            )
          ] }),
          /* @__PURE__ */ A.jsxs("div", { style: { width: "100%", display: "flex", alignItems: "center", gap: "4px", padding: "3px 8px", boxSizing: "border-box" }, children: [
            /* @__PURE__ */ A.jsx(Bf, { style: { fontSize: "10px", width: "12px", flexShrink: 0, textAlign: "center" } }),
            /* @__PURE__ */ A.jsx(
              Qr,
              {
                min: 0,
                max: 200,
                value: N * 100,
                onChange: (q) => {
                  const tt = parseInt(q.currentTarget.value) / 100;
                  F(tt), this.setTrackGain(S, tt);
                },
                style: { flex: 1, minWidth: 0 }
              }
            ),
            /* @__PURE__ */ A.jsx($f, { style: { fontSize: "10px", width: "12px", flexShrink: 0, textAlign: "center" } })
          ] }),
          /* @__PURE__ */ A.jsxs("div", { style: { width: "100%", display: "flex", alignItems: "center", gap: "4px", padding: "3px 8px", boxSizing: "border-box" }, children: [
            /* @__PURE__ */ A.jsx("span", { style: { fontSize: "8px", color: "#666", fontWeight: "bold", width: "12px", flexShrink: 0, textAlign: "center" }, children: "L" }),
            /* @__PURE__ */ A.jsx(
              Qr,
              {
                min: -100,
                max: 100,
                value: $ * 100,
                onChange: (q) => {
                  const tt = parseInt(q.currentTarget.value) / 100;
                  L(tt), this.setTrackPan(S, tt);
                },
                style: { flex: 1, minWidth: 0 }
              }
            ),
            /* @__PURE__ */ A.jsx("span", { style: { fontSize: "8px", color: "#666", fontWeight: "bold", width: "12px", flexShrink: 0, textAlign: "center" }, children: "R" })
          ] })
        ] });
      }, []), w = (this.playout ? cn(g, s, this.playout.sampleRate) : 0) + (f ? p : 0);
      return /* @__PURE__ */ A.jsx(Df, { children: /* @__PURE__ */ A.jsx(Ao.Provider, { value: _, children: /* @__PURE__ */ A.jsx(wh, { theme: t, children: /* @__PURE__ */ A.jsxs("div", { style: { fontFamily: "Arial, sans-serif" }, children: [
        /* @__PURE__ */ A.jsx(
          Tl,
          {
            theme: t,
            backgroundColor: t.waveOutlineColor || "#00f",
            scrollContainerWidth: w,
            timescaleWidth: w,
            tracksWidth: w,
            controlsWidth: f ? p : 0,
            onTracksMouseDown: this.handleMouseDown,
            onTracksMouseMove: this.handleMouseMove,
            onTracksMouseUp: this.handleMouseUp,
            scrollContainerRef: (S) => {
              this.scrollContainer = S;
            },
            timescale: m ? /* @__PURE__ */ A.jsx(
              jf,
              {
                duration: g * 1e3,
                marker: 1e4,
                bigStep: 5e3,
                secondStep: 1e3
              }
            ) : void 0,
            children: /* @__PURE__ */ A.jsxs(A.Fragment, { children: [
              this.tracks.map((S) => {
                const b = this.peaksData.get(S.id);
                if (!b) return null;
                const O = f ? /* @__PURE__ */ A.jsx(x, { trackId: S.id, track: S }) : /* @__PURE__ */ A.jsx(A.Fragment, {}), D = this.playout ? cn(S.startTime, s, this.playout.sampleRate) : 0;
                return /* @__PURE__ */ A.jsx(kl.Provider, { value: O, children: /* @__PURE__ */ A.jsx(
                  Lf,
                  {
                    numChannels: b.data.length,
                    backgroundColor: t.waveOutlineColor || "#00f",
                    offset: D,
                    width: w,
                    children: /* @__PURE__ */ A.jsx(
                      v,
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
              this.annotations.length > 0 && this.playout && /* @__PURE__ */ A.jsx(
                Gf,
                {
                  height: 30,
                  width: w,
                  children: this.annotations.map((S) => {
                    const b = cn(S.start, s, this.playout.sampleRate), O = cn(S.end, s, this.playout.sampleRate);
                    return /* @__PURE__ */ A.jsx(
                      zf,
                      {
                        startPosition: b,
                        endPosition: O,
                        label: S.id,
                        color: "#ff9800",
                        isActive: S.id === this.activeAnnotationId,
                        onClick: async () => {
                          this.activeAnnotationId = S.id, this.lastScrolledAnnotationId = S.id;
                          const D = this.config.annotationList?.isContinuousPlay === !1 ? S.end - S.start : void 0;
                          await this.play(S.start, D), this.render();
                        }
                      },
                      S.id
                    );
                  })
                }
              ),
              this.tracks.length > 0 && this.playout && /* @__PURE__ */ A.jsxs(A.Fragment, { children: [
                a !== c && /* @__PURE__ */ A.jsx(
                  If,
                  {
                    startPosition: cn(a, s, this.playout.sampleRate) + (f ? p : 0),
                    endPosition: cn(c, s, this.playout.sampleRate) + (f ? p : 0),
                    color: "#00ff00"
                  }
                ),
                l && /* @__PURE__ */ A.jsx(
                  kf,
                  {
                    position: cn(o, s, this.playout.sampleRate) + (f ? p : 0),
                    color: t.waveProgressColor || "#f00"
                  }
                )
              ] })
            ] })
          }
        ),
        this.annotations.length > 0 && /* @__PURE__ */ A.jsx(
          Zf,
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
        /* @__PURE__ */ A.jsx("div", { style: { marginTop: "20px", color: "#666", fontSize: "12px", textAlign: "center" }, children: "✨ Powered by Tone.js 15.1.22 and React 18" })
      ] }) }) }) });
    };
    this.root.render(
      /* @__PURE__ */ A.jsx(M1, { children: /* @__PURE__ */ A.jsx(r, {}) })
    );
  }
  async play(t, e) {
    if (this.playout) {
      await this.playout.init(), console.log("Playing from:", { startTime: t, duration: e, playbackState: this.playbackState, currentTime: this.currentTime, hasSeeked: this.hasSeeked });
      let s;
      t !== void 0 ? s = t : this.selectionStart !== this.selectionEnd && this.currentTime < this.selectionStart ? s = this.selectionStart : s = this.currentTime, console.log("Playing from position:", s, "for duration:", e), this.playout.stop(), this.currentTime = s, this.hasSeeked = !1, e !== void 0 ? (this.isPlayingTimedSegment = !0, this.playout.setOnPlaybackComplete(() => {
        this.playbackState === "playing" && (this.isPlayingTimedSegment = !1, this.pause(!1));
      })) : this.isPlayingTimedSegment = !1, this.playout.play(_s(), s, e), this.playbackState = "playing", this.setIsPlayingFn && this.setIsPlayingFn(!0), this.startAnimation();
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
      const e = this.getDuration();
      if (this.currentTime >= e) {
        this.stop();
        return;
      }
      this.setProgressFn && this.setProgressFn(this.currentTime), this.eventEmitter && this.eventEmitter.emit("timeupdate", this.currentTime), this.isAutomaticScroll && this.scrollToCurrentTime(), this.animationFrameId = requestAnimationFrame(t);
    };
    this.playbackState === "playing" && (this.animationFrameId = requestAnimationFrame(t));
  }
  scrollToCurrentTime() {
    if (!this.scrollContainer && (this.scrollContainer = this.container.querySelector('[data-scroll-container="true"]'), !this.scrollContainer) || !this.playout) return;
    const t = this.config.samplesPerPixel || 4096, e = cn(this.currentTime, t, this.playout.sampleRate), s = this.scrollContainer.clientWidth, i = this.scrollContainer.scrollLeft, r = i + s, o = s * 0.2, a = e < i, c = e > r;
    if (a || c)
      this.scrollContainer.scrollLeft = Math.max(0, e - o);
    else {
      const l = e - o;
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
  setTrackGain(t, e) {
    if (this.playout) {
      const s = this.playout.getTrack(t);
      s && s.setVolume(e);
    }
  }
  setTrackMute(t, e) {
    this.playout && this.playout.setMute(t, e);
  }
  setTrackSolo(t, e) {
    this.playout && this.playout.setSolo(t, e);
  }
  parseTime(t) {
    const e = t.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
    if (e) {
      const i = parseInt(e[1], 10), r = parseInt(e[2], 10), o = parseFloat(e[3]);
      return i * 3600 + r * 60 + o;
    }
    const s = parseFloat(t);
    return isNaN(s) ? 0 : s;
  }
  formatTime(t) {
    const e = (r, o) => {
      const a = Math.floor(r / 3600) % 24, c = Math.floor(r / 60) % 60, l = (r % 60).toFixed(o);
      return String(a).padStart(2, "0") + ":" + String(c).padStart(2, "0") + ":" + l.padStart(o + 3, "0");
    }, s = {
      seconds: (r) => r.toFixed(0),
      thousandths: (r) => r.toFixed(3),
      "hh:mm:ss": (r) => e(r, 0),
      "hh:mm:ss.u": (r) => e(r, 1),
      "hh:mm:ss.uu": (r) => e(r, 2),
      "hh:mm:ss.uuu": (r) => e(r, 3)
    };
    return (s[this.timeFormat] || s["hh:mm:ss.uuu"])(t);
  }
  updateSelectionInputs() {
    const t = document.getElementById("audio_start"), e = document.getElementById("audio_end");
    t && (t.value = this.formatTime(this.selectionStart)), e && (e.value = this.formatTime(this.selectionEnd));
  }
  setupSelectionInputListeners() {
    const t = document.getElementById("audio_start"), e = document.getElementById("audio_end");
    t && t.addEventListener("change", () => {
      const s = this.parseTime(t.value);
      this.setSelection(s, this.selectionEnd);
    }), e && e.addEventListener("change", () => {
      const s = this.parseTime(e.value);
      this.setSelection(this.selectionStart, s);
    });
  }
  setSelection(t, e) {
    this.selectionStart = t, this.selectionEnd = e, this.updateSelectionInputs(), this.setSelectionFn && this.setSelectionFn(t, e), this.eventEmitter && this.eventEmitter.emit("select", t, e);
  }
  setTrackPan(t, e) {
    if (this.playout) {
      const s = this.playout.getTrack(t);
      s && s.setPan(e);
    }
  }
  getDuration() {
    let t = 0;
    return this.playout && this.tracks.forEach((e) => {
      const s = this.playout?.getTrack(e.id);
      if (s) {
        const i = s.buffer.duration + e.startTime;
        t = Math.max(t, i);
      }
    }), t;
  }
  rewind() {
    this.playbackState === "playing" ? (this.stop(), this.play(0)) : (this.currentTime = 0, this.setProgressFn && this.setProgressFn(0), this.eventEmitter && this.eventEmitter.emit("timeupdate", 0));
  }
  fastForward() {
    const t = this.playbackState === "playing", e = this.getDuration();
    t ? (this.stop(), this.play(e)) : (this.currentTime = e, this.setProgressFn && this.setProgressFn(e), this.eventEmitter && this.eventEmitter.emit("timeupdate", e));
  }
  getCurrentTime() {
    return this.playout ? this.playout.getCurrentTime() : 0;
  }
  getTracks() {
    return this.tracks;
  }
  createEventEmitter() {
    const t = /* @__PURE__ */ new Map(), e = this;
    return {
      on: (s, i) => {
        console.log(`Event listener registered: ${s}`), t.has(s) || t.set(s, []), t.get(s).push(i);
      },
      emit: (s, ...i) => {
        switch (t.has(s) && t.get(s).forEach((r) => r(...i)), s) {
          case "play":
            e.play();
            break;
          case "pause":
            e.pause();
            break;
          case "stop":
            e.stop();
            break;
          case "rewind":
            e.rewind();
            break;
          case "fastforward":
            e.fastForward();
            break;
          case "automaticscroll":
            e.setAutomaticScroll(i[0]);
            break;
          case "newtrack":
            i[0] && e.addTrack(i[0]).catch((r) => {
              console.error("Failed to add new track:", r);
            });
            break;
          case "durationformat":
            i[0] && (e.timeFormat = i[0], e.updateSelectionInputs());
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
const nS = {
  init: (n) => new eS(n),
  Tone: $0
}, fT = nS.init;
export {
  iT as AudioPosition,
  oT as AutomaticScrollCheckbox,
  aT as ContinuousPlayCheckbox,
  lT as DownloadAnnotationsButton,
  KS as FastForwardButton,
  cT as LinkEndpointsCheckbox,
  nT as MasterVolumeControl,
  XS as PauseButton,
  YS as PlayButton,
  HS as RewindButton,
  rT as SelectionTimeInputs,
  QS as SkipBackwardButton,
  JS as SkipForwardButton,
  US as StopButton,
  sT as TimeFormatSelect,
  $0 as Tone,
  uT as Waveform,
  GS as WaveformPlaylistProvider,
  tT as ZoomInButton,
  eT as ZoomOutButton,
  nS as default,
  dT as getWaveformDataMetadata,
  fT as init,
  hT as loadPeaksFromWaveformData,
  ep as loadWaveformData,
  jS as useAudioTracks,
  LS as useClipDragHandlers,
  BS as useClipSplitting,
  qS as useDragSensors,
  WS as useEffectsChain,
  zS as useIntegratedRecording,
  $S as useKeyboardShortcuts,
  PS as useMasterAnalyser,
  wC as useMasterVolume,
  An as usePlaybackAnimation,
  we as usePlaylistControls,
  $n as usePlaylistData,
  ls as usePlaylistState,
  vC as useTimeFormat,
  VS as useTrackAutoWah,
  FS as useTrackReverb,
  ZS as useWaveformPlaylist,
  xC as useZoomControls,
  JC as waveformDataToPeaks
};
//# sourceMappingURL=index.mjs.map
