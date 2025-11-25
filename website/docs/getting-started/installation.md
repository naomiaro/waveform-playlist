---
sidebar_position: 1
---

# Installation

## Package Manager

Install the main package using your preferred package manager:

```bash npm2yarn
npm install @waveform-playlist/browser
```

This will install the browser package along with its peer dependencies.

## Peer Dependencies

Waveform Playlist requires the following peer dependencies:

```bash npm2yarn
npm install react react-dom styled-components tone
```

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.0.0 | UI framework |
| `react-dom` | ^18.0.0 | React DOM rendering |
| `styled-components` | ^6.0.0 | CSS-in-JS styling |
| `tone` | ^15.0.0 | Web Audio framework |

## Additional Packages

Depending on your needs, you may want to install additional packages:

### Annotations

For time-synchronized annotations:

```bash npm2yarn
npm install @waveform-playlist/annotations
```

### Recording

For microphone recording:

```bash npm2yarn
npm install @waveform-playlist/recording
```

## TypeScript

All packages include TypeScript definitions. No additional `@types` packages are needed.

## CDN Usage

For quick prototyping, you can use the UMD build from a CDN:

```html
<script src="https://unpkg.com/@waveform-playlist/browser/dist/index.umd.js"></script>
```

Note: CDN usage is not recommended for production applications.

## Next Steps

- [Basic Usage](/getting-started/basic-usage) - Create your first playlist
