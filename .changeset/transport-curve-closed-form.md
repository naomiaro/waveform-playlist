---
'@dawcore/transport': patch
---

Curved tempo segments now integrate with an exact closed form in both directions instead of a fixed 64-step trapezoid and a bisection inverse. The Möbius-Ease curve is `A + B·e^(c·x)`, whose reciprocal has an analytic antiderivative that also inverts algebraically, so `ticksToSeconds`/`secondsToTicks` over a `{ type: 'curve' }` segment are accurate to floating-point precision (~1e-15 relative) regardless of segment length and cost O(1). The trapezoid drifted ~5e-4 relative (0.7 ms per bar at steep slopes, 184 ms over a 256-bar ramp). Coefficients are carried as `c·A`/`c·B` and each direction picks between two algebraically equal forms per call so neither the slope → 0.5 nor the `A → 0` limit cancels; only `|slope − 0.5| < 1e-12` routes to the linear integral.
