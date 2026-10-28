---
'@dawcore/transport': patch
---

Curved tempo segments now integrate with an exact closed form instead of a fixed 64-step trapezoid. The Möbius-Ease curve is `A + B·e^(c·x)`, whose reciprocal has an analytic antiderivative, so `ticksToSeconds`/`secondsToTicks` over a `{ type: 'curve' }` segment are accurate to floating-point precision regardless of segment length. The trapezoid drifted ~5e-4 relative (0.7 ms per bar at steep slopes, 184 ms over a 256-bar ramp). Slopes within 1e-6 of 0.5 route to the exact linear integral; the pure-exponential case (bpm0 equal to the curve offset) uses a first-order series.
