import { FaustUI } from './faust-ui/index.js';

/**
 * @typedef {import('./sdk-parammgr').ParamMgrNode} ParamMgrNode
 * @typedef {import('./sdk').WebAudioModule} WebAudioModule
 * @typedef {import("./faustwasm").FaustAudioWorkletNode} FaustAudioWorkletNode
 * @typedef {import('./faustwasm').FaustUIDescriptor} FaustUIDescriptor
 */

class FaustDefaultGui extends HTMLElement {
	/**
	 * @param {ParamMgrNode} wamNode
	 * @param {FaustAudioWorkletNode} faustNode
	 * @param {string} style
	 */
	constructor(wamNode, faustNode, style) {
		super();
		this.wamNode = wamNode;
		this.faustNode = faustNode;
		this.root = this.attachShadow({ mode: 'open' });
		const $style = document.createElement('style');
		$style.innerHTML = style;
		this.root.appendChild($style);
		const $container = document.createElement('div');
		$container.style.margin = '0';
		$container.style.position = 'relative';
		$container.style.overflow = 'auto';
		$container.style.display = 'flex';
		$container.style.flexDirection = 'column';
		this.faustUI = new FaustUI({
			ui: faustNode.getUI(),
			root: $container,
			listenWindowMessage: false,
			listenWindowResize: false,
		});
		this.faustUI.paramChangeByUI = (path, value) => {
			wamNode.setParamValue(path, value);
		};
		faustNode.setOutputParamHandler((path, value) => this.faustUI.paramChangeByDSP(path, value));
		$container.style.width = `${this.faustUI.minWidth}px`;
		$container.style.height = `${this.faustUI.minHeight}px`;
		this.root.appendChild($container);

		window.requestAnimationFrame(this.handleAnimationFrame);
	}

	handleAnimationFrame = async () => {
		const values = await this.wamNode.getParameterValues();
		for (const key in values) {
			const { value } = values[key];
			this.faustUI.paramChangeByDSP(key, value);
		}
		window.requestAnimationFrame(this.handleAnimationFrame);
	}

	connectedCallback() {
		this.faustUI.resize();
	}
}

/**
 * A mandatory method if you want a gui for your plugin
 * @param {WebAudioModule} plugin - the plugin instance
 * @returns {Promise<Node>} - the plugin root node that is inserted in the DOM of the host
 */
const createElement = async (plugin) => {
	const elementId = `${plugin.moduleId.toLowerCase().replace(/\W/g, "")}-ui`;
	try {
		customElements.define(elementId, FaustDefaultGui);
	} catch (e) {
		console.warn(e);
	}
	/** @type {ParamMgrNode} */
	const wamNode = plugin.audioNode;
	/** @type {FaustAudioWorkletNode} */
	const faustNode = wamNode._output;
	const style = await (await fetch(new URL('./faust-ui/index.css', import.meta.url).href)).text();
	/** @type {typeof FaustDefaultGui} */
	return new FaustDefaultGui(wamNode, faustNode, style);
};
export default createElement;
