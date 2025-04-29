import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { Vector3 } from 'three';

export function setupGUI(sceneRenderer) {
	const gui = new GUI();
	gui.width = 300;
	
	// Camera controls folder
	addCameraControls(gui, sceneRenderer);
	
	// Maps options folder
	addMapsOptions(gui, sceneRenderer);

	// Debug options folder
	addDebugOptions(gui, sceneRenderer);
	
	return gui;
}

function addCameraControls(gui, sceneRenderer) {
	const cameraFolder = gui.addFolder('Camera Controls');
	
	cameraFolder.add(sceneRenderer.params, 'orthographic').onChange(() => {
		handleOrthographicChange(sceneRenderer);
	});
	
	// Add zoom speed control
	cameraFolder.add(sceneRenderer.params, 'zoomSpeed', 0.1, 10.0, 0.1).onChange(value => {
		sceneRenderer.controls.zoomSpeed = value;
	});
	
	// Add rotation speed control
	cameraFolder.add(sceneRenderer.controls, 'rotateSpeed', 0.1, 5.0, 0.1).name('Rotate Speed');
}

function handleOrthographicChange(sceneRenderer) {
	sceneRenderer.controls.getPivotPoint(sceneRenderer.transition.fixedPoint);
	
	// Don't update the cameras if they are already being animated
	if (!sceneRenderer.transition.animating) {
		// Sync the camera positions and then adjust the camera views
		sceneRenderer.transition.syncCameras();
		sceneRenderer.controls.adjustCamera(sceneRenderer.transition.perspectiveCamera);
		sceneRenderer.controls.adjustCamera(sceneRenderer.transition.orthographicCamera);
	}
	
	sceneRenderer.transition.toggle();
}

function addMapsOptions(gui, sceneRenderer) {
	const mapsOptions = gui.addFolder('Google Photorealistic Tiles');
	mapsOptions.add(sceneRenderer.params, 'useBatchedMesh').listen();
	mapsOptions.add(sceneRenderer.params, 'reload');
}

function addDebugOptions(gui, sceneRenderer) {
	const debugOptions = gui.addFolder('Debug Options');
	debugOptions.add(sceneRenderer.params, 'enableCacheDisplay');
	debugOptions.add(sceneRenderer.params, 'enableRendererStats');
	debugOptions.add(sceneRenderer.params, 'errorTarget', 5, 100, 1).onChange(() => {
		if (sceneRenderer.tiles && sceneRenderer.tiles.getPluginByName) {
			const plugin = sceneRenderer.tiles.getPluginByName('UPDATE_ON_CHANGE_PLUGIN');
			if (plugin) {
				plugin.needsUpdate = true;
			}
		}
	});
	
	// Add option to enable mouse event debugging
	debugOptions.add({
		enableMouseDebug: () => {
			enableMouseDebug(sceneRenderer.container);
		}
	}, 'enableMouseDebug').name('Debug Mouse Events');
}

function enableMouseDebug(container) {
	const mouseEvents = [
		'mousedown', 'mousemove', 'mouseup', 
		'contextmenu', 'wheel', 'touchstart', 
		'touchmove', 'touchend'
	];
	
	mouseEvents.forEach(eventType => {
		container.addEventListener(eventType, (event) => {
			if (eventType === 'mousedown') {
				console.log(`${eventType}: Button=${event.button}, clientX=${event.clientX}, clientY=${event.clientY}`);
			}
		});
	});
	
	console.log('Mouse event debugging enabled');
}

export function createInfoDisplay() {
	const statsContainer = document.createElement('div');
	document.getElementById('info').appendChild(statsContainer);
	return statsContainer;
}

// Zoom slider functionality removed

export function updateStatsDisplay(sceneRenderer, statsContainer) {
	let str = '';
	
	if (sceneRenderer.params.enableCacheDisplay && sceneRenderer.tiles) {
		const lruCache = sceneRenderer.tiles.lruCache;
		const cacheFullness = lruCache.cachedBytes / lruCache.maxBytesSize;
		str += `Downloading: ${sceneRenderer.tiles.stats.downloading} Parsing: ${sceneRenderer.tiles.stats.parsing} Visible: ${sceneRenderer.tiles.visibleTiles.size}<br/>`;
		str += `Cache: ${(100 * cacheFullness).toFixed(2)}% ~${(lruCache.cachedBytes / 1000 / 1000).toFixed(2)}mb<br/>`;
	}
	
	if (sceneRenderer.params.enableRendererStats && sceneRenderer.renderer) {
		const memory = sceneRenderer.renderer.info.memory;
		const render = sceneRenderer.renderer.info.render;
		const programCount = sceneRenderer.renderer.info.programs.length;
		str += `Geometries: ${memory.geometries} Textures: ${memory.textures} Programs: ${programCount} Draw Calls: ${render.calls}`;
		
		// Add batched info if available
		const batchedInfo = getBatchedMeshInfo(sceneRenderer);
		if (batchedInfo) {
			str += ', Batched: ' + batchedInfo;
		}
	}
	
	return str;
}

function getBatchedMeshInfo(sceneRenderer) {
	if (!sceneRenderer.tiles) {
		return null;
	}
	
	const batchPlugin = sceneRenderer.tiles.getPluginByName('BATCHED_TILES_PLUGIN');
	const fadePlugin = sceneRenderer.tiles.getPluginByName('FADE_TILES_PLUGIN');
	
	if (!batchPlugin && !fadePlugin) {
		return null;
	}
	
	let total = 0;
	
	if (batchPlugin && batchPlugin.batchedMesh && batchPlugin.batchedMesh._instanceInfo) {
		batchPlugin.batchedMesh._instanceInfo.forEach(info => {
			if (info.visible && info.active) total++;
		});
	}
	
	if (fadePlugin && fadePlugin.batchedMesh && fadePlugin.batchedMesh._instanceInfo) {
		fadePlugin.batchedMesh._instanceInfo.forEach(info => {
			if (info.visible && info.active) total++;
		});
	}
	
	return total > 0 ? total : null;
}