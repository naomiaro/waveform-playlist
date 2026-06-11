/**
 * @typedef {import('./sdk-parammgr').ParamMgrNode} ParamMgrNode
 * @typedef {import("./types").FaustDspDistribution} FaustDspDistribution
 * @typedef {import("./faustwasm").FaustAudioWorkletNode} FaustAudioWorkletNode
 * @typedef {import("./faustwasm").FaustDspMeta} FaustDspMeta
 * @typedef {import("./faustwasm").FaustUIDescriptor} FaustUIDescriptor
 * @typedef {import("./faustwasm").FaustUIGroup} IFaustUIGroup
 * @typedef {import("./faustwasm").FaustUIItem} IFaustUIItem
 */

import { WebAudioModule } from './sdk/index.js';
import { CompositeAudioNode, ParamMgrFactory } from './sdk-parammgr/index.js';
import { FaustMonoDspGenerator, FaustPolyDspGenerator } from "./faustwasm/index.js";
import createElement from './gui.js';

class FaustCompositeAudioNode extends CompositeAudioNode {
	/**
	 * @param {FaustAudioWorkletNode} output
	 * @param {ParamMgrNode} paramMgr
	 */
	setup(output, paramMgr) {
		if (output.numberOfInputs > 0) this.connect(output, 0, 0);
		output.setupWamEventHandler();
		// paramMgr.addEventListener('wam-midi', (e) => output.midiMessage(e.detail.data.bytes));
		/** @type {ParamMgrNode} */
		this._wamNode = paramMgr;
		/** @type {FaustAudioWorkletNode} */
		this._output = output;
	}

	destroy() {
		super.destroy();
		if (this._output) this._output.destroy();
	}

	/**
	 * @param {string} name
	 */
	getParamValue(name) {
		return this._wamNode.getParamValue(name);
	}

	/**
	 * @param {string} name
	 * @param {number} value
	 */
	setParamValue(name, value) {
		return this._wamNode.setParamValue(name, value);
	}
}

/**
 * @param {URL} relativeURL
 * @returns {string}
 */
const getBasetUrl = (relativeURL) => {
	const baseURL = relativeURL.href.substring(0, relativeURL.href.lastIndexOf('/'));
	return baseURL;
};

export default class FaustPlugin extends WebAudioModule {
	/**
	 * Faust generated WebAudio AudioWorkletNode Constructor
	 */
	_PluginFactory;

	_baseURL = getBasetUrl(new URL('.', import.meta.url));

	_descriptorUrl = `${this._baseURL}/descriptor.json`;

	async initialize(state) {
		await this._loadDescriptor();
		return super.initialize(state);
	}

	async createAudioNode(initialState) {
		const { moduleId, instanceId } = this;
		const dspName = this.descriptor.name;
		const dspMeta = await (await fetch(`${this._baseURL}/dsp-meta.json`)).json();
		const dspModule = await WebAssembly.compileStreaming(await fetch(`${this._baseURL}/dsp-module.wasm`));
		/** @type {FaustDspDistribution} */
		const faustDsp = { dspMeta, dspModule };
		if (this.descriptor.faustMeta?.effect) {
			faustDsp.effectMeta = await (await fetch(`${this._baseURL}/effect-meta.json`)).json();
			faustDsp.effectModule = await WebAssembly.compileStreaming(await fetch(`${this._baseURL}/effect-module.wasm`));
		}
		if (this.descriptor.faustMeta?.poly) {
			faustDsp.mixerModule = await WebAssembly.compileStreaming(await fetch(`${this._baseURL}/mixer-module.wasm`));
		}
		const fft = !!this.descriptor.faustMeta?.fft;
		const voices = faustDsp.mixerModule ? +(faustDsp.dspMeta.meta.find(obj => !!obj?.options)?.options.match(/\[nvoices:(\d+)\]/)?.[1] || 64) : 0;

		/** @type {FaustAudioWorkletNode} */
		let faustNode;
		if (fft) {
			await this.audioContext.audioWorklet?.addModule(`${this._baseURL}/fftw/index.js`);
			const FFTUtils = class {
				static get windowFunctions() {
					return [
						// blackman
						(i, N) => {
							const a0 = 0.42;
							const a1 = 0.5;
							const a2 = 0.08;
							const f = 6.283185307179586 * i / (N - 1);
							return a0 - a1 * Math.cos(f) + a2 * Math.cos(2 * f);
						},
						// hamming
						(i, N) => 0.54 - 0.46 * Math.cos(6.283185307179586 * i / (N - 1)),
						// hann
						(i, N) => 0.5 * (1 - Math.cos(6.283185307179586 * i / (N - 1))),
						// triangular
						(i, N) => 1 - Math.abs(2 * (i - 0.5 * (N - 1)) / N)
					];
				}
				static async getFFT() {
					const { instantiateFFTWModule, FFTW } = globalThis.fftwwasm;
					const Module = await instantiateFFTWModule();
					const fftw = new FFTW(Module);
					return fftw.r2r.FFT1D;
				}
				static fftToSignal(f, r, i, b) {
					const fftSize = f.length;
					const len = fftSize / 2 + 1;
					const invFFTSize = 1 / fftSize;
					for (let j = 0; j < len; j++) {
						r[j] = f[j] * invFFTSize;
						if (i) i[j] = (j === 0 || j === len - 1) ? 0 : f[fftSize - j] * invFFTSize;
						if (b) b[j] = j;
					}
				}
				static signalToFFT(r, i, f) {
					const len = (r.length - 1) * 2;
					f.set(r);
					if (!i) return;
					for (let j = 1; j < i.length - 1; j++) {
						f[len - j] = i[j];
					}
				}
				static signalToNoFFT(r, i, f) {
					f.set(r.subarray(1, r.length));
					if (i) f.set(i.subarray(0, i.length - 1), r.length - 1);
				}
			};
			const generator = new FaustMonoDspGenerator();
			faustNode = await generator.createFFTNode(
				this.audioContext,
				FFTUtils,
				`${moduleId}FaustFFT`,
				{ module: faustDsp.dspModule, json: JSON.stringify(faustDsp.dspMeta), soundfiles: {} },
				undefined,
				undefined,
				{ moduleId, instanceId }
			);
		} else if (voices) {
			const generator = new FaustPolyDspGenerator();
			faustNode = await generator.createNode(
				this.audioContext,
				voices,
				`${moduleId}Faust`,
				{ module: faustDsp.dspModule, json: JSON.stringify(faustDsp.dspMeta), soundfiles: {} },
				faustDsp.mixerModule,
				faustDsp.effectModule ? { module: faustDsp.effectModule, json: JSON.stringify(faustDsp.effectMeta), soundfiles: {} } : undefined,
				false,
				undefined,
				undefined,
				{ moduleId, instanceId }
			);
		} else {
			const generator = new FaustMonoDspGenerator();
			faustNode = await generator.createNode(
				this.audioContext,
				`${moduleId}Faust`,
				{ module: faustDsp.dspModule, json: JSON.stringify(faustDsp.dspMeta), soundfiles: {} },
				undefined,
				undefined,
				undefined,
				{ moduleId, instanceId }
			);
		}
		const paramMgrNode = await ParamMgrFactory.create(this, { internalParamsConfig: Object.fromEntries(faustNode.parameters) });
		const node = new FaustCompositeAudioNode(this.audioContext);
		node.setup(faustNode, paramMgrNode);
		if (initialState) node.setState(initialState);
		return node;
	}

	createGui() {
		return createElement(this);
	}
}
