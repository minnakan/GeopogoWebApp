import {
	Scene as THREE_Scene,
	WebGLRenderer,
	AmbientLight,
	DirectionalLight,
	Vector3,
	MathUtils
} from 'three';
import {
	WGS84_ELLIPSOID,
	CAMERA_FRAME
} from '3d-tiles-renderer';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import { setupCamera, createControls } from './Controls.js';
import { createTilesRenderer, registerPlugins } from './TileSystem.js';
import { setupGUI, createInfoDisplay} from './Ui.js';
import GoogleMapsIntegration from './GoogleMapsIntegration.js';

export default class SceneRenderer {
	constructor(container) {
		console.log('Initializing SceneRenderer');
		
		this.container = container;
		this.params = {
			orthographic: false,
			enableCacheDisplay: false,
			enableRendererStats: false,
			useBatchedMesh: Boolean(new URLSearchParams(window.location.hash.replace(/^#/, '')).get('batched')),
			errorTarget: 40,
			zoomSpeed: 1.0,
			reload: () => this.reinstantiateTiles(),
		};
		
		this.scene = null;
		this.renderer = null;
		this.tiles = null;
		this.transition = null;
		this.controls = null;
		this.stats = null;
		this.statsContainer = null;
		this.googleMaps = null;
		
		// Performance optimization
		this.lastHashUpdate = 0;
		this.lastInfoUpdate = 0;
		
		try {
			this.init();
			this.animate();
			console.log('SceneRenderer initialized successfully');
		} catch (error) {
			console.error('Failed to initialize SceneRenderer:', error);
		}
	}

	init() {
		// Initialize renderer
		this.setupRenderer();
		
		// Initialize scene and add lighting
		this.setupScene();
		
		// Set up camera and controls
		const { transition, controls } = setupCamera(this.scene, this.renderer);
		this.transition = transition;
		this.controls = controls;
		
		// Initialize tiles
		this.reinstantiateTiles();
		
		// Set up UI elements
		this.setupUI();
		
		// Initialize Google Maps integration
		this.initGoogleMaps();
		
		// Set up window events
		window.addEventListener('resize', () => this.onWindowResize(), false);
		window.addEventListener('hashchange', () => this.initFromHash());
		this.onWindowResize();
		
		// Initialize from hash
		this.initFromHash();
		// Hash will be updated in the animation loop when needed, not on a timer
	}
	
	initGoogleMaps() {
		// Initialize Google Maps integration after tiles are loaded
		if (this.tiles) {
			this.googleMaps = new GoogleMapsIntegration(this);
		} else {
			console.warn('Tiles not initialized, deferring Google Maps integration');
			
			// Retry after a delay
			setTimeout(() => {
				if (this.tiles) {
					this.googleMaps = new GoogleMapsIntegration(this);
				} else {
					console.error('Failed to initialize Google Maps integration: tiles not available');
				}
			}, 2000);
		}
	}
	
	setupRenderer() {
		this.renderer = new WebGLRenderer({ 
			antialias: true, 
			alpha: false,
			canvas: this.container,
			powerPreference: 'high-performance'
		});
		
		this.renderer.setClearColor(0x151c1f);
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setPixelRatio(window.devicePixelRatio);
	}
	
	setupScene() {
		this.scene = new THREE_Scene();
		
		// Add ambient light
		const ambientLight = new AmbientLight(0xffffff, 0.5);
		this.scene.add(ambientLight);
		
		// Add directional light
		const directionalLight = new DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(0, 1, 1).normalize();
		this.scene.add(directionalLight);
	}
	
	setupUI() {
		// Set up GUI
		setupGUI(this);
		
		// Set up stats
		this.stats = new Stats();
		this.stats.showPanel(0);
		document.body.appendChild(this.stats.dom);
		
		// Create info display
		this.statsContainer = createInfoDisplay();
	}

	reinstantiateTiles() {
		console.log('Reinstantiating tiles');
		
		if (this.tiles) {
			this.scene.remove(this.tiles.group);
			this.tiles.dispose();
			this.tiles = null;
		}
		
		// Remove any test spheres from the scene
		this.scene.children.forEach(child => {
			if (child.geometry && child.geometry.type === 'SphereGeometry') {
				this.scene.remove(child);
			}
		});
		
		// Create and configure tiles
		this.tiles = createTilesRenderer(this);
		
		if (this.tiles) {
			// Register necessary plugins
			registerPlugins(this);
			
			// Add to scene
			this.scene.add(this.tiles.group);
			
			// Reinitialize Google Maps integration if necessary
			if (!this.googleMaps) {
				this.initGoogleMaps();
			}
		}
	}

	onWindowResize() {
		const { perspectiveCamera, orthographicCamera } = this.transition;
		
		// Get dimensions of actual container (now this is the main element inside scene-container)
		const mainElement = this.container.parentElement;
		const width = mainElement.clientWidth;
		const height = mainElement.clientHeight;
		
		// The aspect ratio should be 16:9 (or very close)
		const aspect = width / height;
		
		// Update perspective camera
		perspectiveCamera.aspect = aspect;
		perspectiveCamera.updateProjectionMatrix();
		
		// Update orthographic camera
		orthographicCamera.left = -orthographicCamera.top * aspect;
		orthographicCamera.right = -orthographicCamera.left;
		orthographicCamera.updateProjectionMatrix();
		
		// Update renderer size to match container
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		
		// If using tiles, update them
		if (this.tiles) {
			this.tiles.setResolutionFromRenderer(this.transition.camera, this.renderer);
		}
		
		console.log(`Canvas resized to: ${width}x${height}, aspect ratio: ${aspect.toFixed(2)}`);
	}

	updateHash() {
		if (!this.tiles) {
			return;
		}

		const urlParams = new URLSearchParams();
		
		// Get camera position and orientation data
		const { lat, lon, height, az, el, roll } = this.getCameraPositionData();
		
		// Update URL parameters
		urlParams.set('lat', lat.toFixed(4));
		urlParams.set('lon', lon.toFixed(4));
		urlParams.set('height', height.toFixed(2));
		urlParams.set('az', az.toFixed(2));
		urlParams.set('el', el.toFixed(2));
		urlParams.set('roll', roll.toFixed(2));
		
		if (this.params.useBatchedMesh) {
			urlParams.set('batched', 1);
		}
		
		window.history.replaceState(undefined, undefined, `#${urlParams}`);
	}
	
	getCameraPositionData() {
		// Use TileSystem utility functions to get proper camera coordinates
		if (!this.tiles || !this.transition || !this.transition.camera) {
			return {
				lat: 0,
				lon: 0,
				height: 1000,
				az: 0,
				el: 0,
				roll: 0
			};
		}
		
		const camera = this.transition.camera;
		const cartographicResult = {};
		const orientationResult = {};
		const tilesMatInv = this.tiles.group.matrixWorld.clone().invert();
		const localCameraPos = camera.position.clone().applyMatrix4(tilesMatInv);
		const localCameraMat = camera.matrixWorld.clone().premultiply(tilesMatInv);
		
		// Get the data
		WGS84_ELLIPSOID.getPositionToCartographic(localCameraPos, cartographicResult);
		WGS84_ELLIPSOID.getAzElRollFromRotationMatrix(
			cartographicResult.lat, cartographicResult.lon, localCameraMat,
			orientationResult, CAMERA_FRAME,
		);
		
		// Convert to DEG
		orientationResult.azimuth *= MathUtils.RAD2DEG;
		orientationResult.elevation *= MathUtils.RAD2DEG;
		orientationResult.roll *= MathUtils.RAD2DEG;
		cartographicResult.lat *= MathUtils.RAD2DEG;
		cartographicResult.lon *= MathUtils.RAD2DEG;
		
		return {
			lat: cartographicResult.lat,
			lon: cartographicResult.lon,
			height: cartographicResult.height,
			az: orientationResult.azimuth,
			el: orientationResult.elevation,
			roll: orientationResult.roll
		};
	}

	initFromHash() {
		if (!this.tiles) {
			console.warn('Cannot initialize from hash: tiles not yet created');
			return;
		}

		const hash = window.location.hash.replace(/^#/, '');
		const urlParams = new URLSearchParams(hash);
		
		if (urlParams.has('batched')) {
			this.params.useBatchedMesh = Boolean(urlParams.get('batched'));
		}
		
		if (!urlParams.has('lat') || !urlParams.has('lon')) {
			return;
		}
		
		// Position camera based on hash parameters
		this.positionCameraFromHash(urlParams);
	}
	
	positionCameraFromHash(urlParams) {
		// Update the tiles matrix world so we can use it
		this.tiles.group.updateMatrixWorld();
		
		// Get the position fields
		const camera = this.transition.camera;
		const lat = parseFloat(urlParams.get('lat'));
		const lon = parseFloat(urlParams.get('lon'));
		const height = parseFloat(urlParams.get('height')) || 1000;
		
		if (urlParams.has('az') && urlParams.has('el')) {
			// Get the az el fields for rotation if present
			const az = parseFloat(urlParams.get('az'));
			const el = parseFloat(urlParams.get('el'));
			const roll = parseFloat(urlParams.get('roll')) || 0;
			
			// Extract the east-north-up frame into matrix world
			WGS84_ELLIPSOID.getRotationMatrixFromAzElRoll(
				lat * MathUtils.DEG2RAD, lon * MathUtils.DEG2RAD,
				az * MathUtils.DEG2RAD, el * MathUtils.DEG2RAD, roll * MathUtils.DEG2RAD,
				camera.matrixWorld, CAMERA_FRAME,
			);
			
			// Apply the necessary tiles transform
			camera.matrixWorld.premultiply(this.tiles.group.matrixWorld);
			camera.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale);
			
			// Get the height
			WGS84_ELLIPSOID.getCartographicToPosition(lat * MathUtils.DEG2RAD, lon * MathUtils.DEG2RAD, height, camera.position);
			camera.position.applyMatrix4(this.tiles.group.matrixWorld);
		} else {
			// Default to looking down if no az el are present
			WGS84_ELLIPSOID.getCartographicToPosition(lat * MathUtils.DEG2RAD, lon * MathUtils.DEG2RAD, height, camera.position);
			camera.position.applyMatrix4(this.tiles.group.matrixWorld);
			camera.lookAt(0, 0, 0);
		}
	}

	animate() {
		requestAnimationFrame(() => this.animate());
		
		if (!this.tiles) {
			return;
		}
		
		// Update controls
		this.controls.enabled = !this.transition.animating;
		this.controls.update();
		this.transition.update();
		
		// Update tiles only when necessary
		this.updateTiles();
		
		// Render the scene
		this.renderer.render(this.scene, this.transition.camera);
		
		// Update stats
		this.stats.update();
		
		// Throttle HTML updates to reduce overhead
		const now = performance.now();
		if (now - this.lastInfoUpdate > 200) { // Update every 200ms
			this.updateHtml();
			this.lastInfoUpdate = now;
		}
		
		// Only update hash when camera has moved and not too frequently
		if (this.controls.hasChanged && now - this.lastHashUpdate > 1000) {
			this.updateHash();
			this.lastHashUpdate = now;
		}
	}
	
	updateTiles() {
		const camera = this.transition.camera;
		this.tiles.setResolutionFromRenderer(camera, this.renderer);
		this.tiles.setCamera(camera);
		
		camera.updateMatrixWorld();
		this.tiles.errorTarget = this.params.errorTarget;
		this.tiles.update();
	}

	updateHtml() {
		// Render html text updates
		let str = '';
		
		if (this.params.enableCacheDisplay) {
			const lruCache = this.tiles.lruCache;
			const cacheFullness = lruCache.cachedBytes / lruCache.maxBytesSize;
			str += `Downloading: ${this.tiles.stats.downloading} Parsing: ${this.tiles.stats.parsing} Visible: ${this.tiles.visibleTiles.size}<br/>`;
			str += `Cache: ${(100 * cacheFullness).toFixed(2)}% ~${(lruCache.cachedBytes / 1000 / 1000).toFixed(2)}mb<br/>`;
		}
		
		if (this.params.enableRendererStats) {
			const memory = this.renderer.info.memory;
			const render = this.renderer.info.render;
			const programCount = this.renderer.info.programs.length;
			str += `Geometries: ${memory.geometries} Textures: ${memory.textures} Programs: ${programCount} Draw Calls: ${render.calls}`;
			
			// Add batched mesh info if available
			this.addBatchedMeshInfo(str);
		}
		
		if (this.statsContainer.innerHTML !== str) {
			this.statsContainer.innerHTML = str;
		}
		
		// Update credits
		this.updateCredits();
	}
	
	addBatchedMeshInfo(str) {
		// Would add batched mesh info
	}
	
	updateCredits() {
		// Would update credits
		document.getElementById('credits').innerText = 'Credits';
	}
}