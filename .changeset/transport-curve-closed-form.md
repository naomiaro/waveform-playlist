---
'@dawcore/transport': patch
---

Curved tempo segments now integrate with an exact closed form in both directions instead of a fixed 64-step trapezoid and a bisection inverse. The Möbius-Ease curve is `A + B·e^(c·x)`, whose reciprocal has an analytic antiderivative that also inverts algebraically, so `ticksToSeconds`/`secondsToTicks` over a `{ type: 'curve' }` segment are accurate to floating-point precision (~1e-15 relative) regardless of segment length and cost O(1). The trapezoid drifted by up to ~2e-3 relative (2.8 ms per bar at steep slopes, 0.7 s over a 256-bar ramp). Coefficients are carried as `c·A`/`c·B` so the slope → 0.5 limit stays finite, and each direction picks between two algebraically equal forms per call so neither the `A → 0` limit nor a tiny `1 + y` cancels; only `|slope − 0.5| < 1e-12` routes to the linear integral. Non-finite input, or finite input outside a ramp's domain, now throws instead of returning NaN.
