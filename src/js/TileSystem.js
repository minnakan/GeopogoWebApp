import {
	TilesRenderer,
	WGS84_ELLIPSOID,
	GeoUtils
} from '3d-tiles-renderer';
import {
	TilesFadePlugin,
	UpdateOnChangePlugin,
	TileCompressionPlugin,
	UnloadTilesPlugin,
	GLTFExtensionsPlugin,
	BatchedTilesPlugin,
	CesiumIonAuthPlugin,
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MathUtils } from 'three';

export function createTilesRenderer(sceneRenderer) {
	// Create a new tiles renderer
	const tiles = new TilesRenderer();
	
	// Add Cesium Ion authentication
	try {
		const apiToken = import.meta.env.VITE_ION_KEY;
		
		if (!apiToken) {
			console.error('No Cesium Ion API key found in environment variables');
			document.getElementById('info').innerText = 'Error: Missing Cesium Ion API key';
			return null;
		}
		
		console.log('Using Cesium Ion API key', apiToken.substring(0, 4) + '...');
		
		// Configure the tiles renderer
		tiles.group.rotation.x = -Math.PI / 2;
		
		// Set up the camera for the tiles
		tiles.setResolutionFromRenderer(sceneRenderer.transition.camera, sceneRenderer.renderer);
		tiles.setCamera(sceneRenderer.transition.camera);
		
		// Configure the controls for the tiles
		sceneRenderer.controls.setTilesRenderer(tiles);
		
		// Add event listeners for debugging
		setupTileEventListeners(tiles);
		
		return tiles;
	} catch (error) {
		console.error('Failed to initialize tiles:', error);
		document.getElementById('info').innerText = 'Error loading 3D tiles: ' + error.message;
		return null;
	}
}

function setupTileEventListeners(tiles) {
	tiles.addEventListener('load-tile-set', (e) => {
		console.log('Tile set loaded successfully:', e.url);
	});
	
	tiles.addEventListener('load-error', (e) => {
		console.error('Error loading tile:', e.url, e.error);
	});
}

export function registerPlugins(sceneRenderer) {
	const tiles = sceneRenderer.tiles;
	
	if (!tiles) {
		return;
	}
	
	// Register the Cesium Ion authentication plugin
	const apiToken = import.meta.env.VITE_ION_KEY;
	
	tiles.registerPlugin(new CesiumIonAuthPlugin({ 
		apiToken: apiToken, 
		assetId: '2275207', 
		autoRefreshToken: true 
	}));
	
	// Register common plugins
	registerCommonPlugins(tiles);
	
	// Add BatchedTilesPlugin if required
	if (sceneRenderer.params.useBatchedMesh) {
		tiles.registerPlugin(new BatchedTilesPlugin({
			renderer: sceneRenderer.renderer,
			discardOriginalContent: false,
			instanceCount: 250,
		}));
	}
}

function registerCommonPlugins(tiles) {
	// Register all common plugins needed for tiles to work
	tiles.registerPlugin(new TileCompressionPlugin());
	tiles.registerPlugin(new UpdateOnChangePlugin());
	tiles.registerPlugin(new UnloadTilesPlugin());
	tiles.registerPlugin(new TilesFadePlugin());
	tiles.registerPlugin(new GLTFExtensionsPlugin({
		dracoLoader: new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.153.0/examples/jsm/libs/draco/gltf/')
	}));
}

// Utility functions for working with cartographic coordinates

export function cartographicToDegrees(cartographic) {
	return {
		lat: cartographic.lat * MathUtils.RAD2DEG,
		lon: cartographic.lon * MathUtils.RAD2DEG,
		height: cartographic.height
	};
}

export function degreesToCartographic(degrees) {
	return {
		lat: degrees.lat * MathUtils.DEG2RAD,
		lon: degrees.lon * MathUtils.DEG2RAD,
		height: degrees.height
	};
}

export function getCameraCartographicPosition(tiles, camera) {
	if (!tiles || !tiles.group) {
		return { lat: 0, lon: 0, height: 0 };
	}
	
	const tilesMatInv = tiles.group.matrixWorld.clone().invert();
	const localCameraPos = camera.position.clone().applyMatrix4(tilesMatInv);
	
	const cartographicResult = {};
	WGS84_ELLIPSOID.getPositionToCartographic(localCameraPos, cartographicResult);
	
	return cartographicResult;
}

export function formatCoordinatesForDisplay(cartographic) {
	const degrees = cartographicToDegrees(cartographic);
	return GeoUtils.toLatLonString(cartographic.lat, cartographic.lon);
}