import {
	PerspectiveCamera,
	OrthographicCamera,
	MathUtils,
	Vector3
} from 'three';
import {
	GlobeControls,
	CameraTransitionManager,
	CAMERA_FRAME
} from '3d-tiles-renderer';

export function setupCamera(scene, renderer) {
	// Set up camera and transition with much larger far plane
	const aspectRatio = window.innerWidth / window.innerHeight;
	const transition = new CameraTransitionManager(
		new PerspectiveCamera(60, aspectRatio, 1, 200000000),
		new OrthographicCamera(-1, 1, 1, -1, 1, 200000000)
	);
	
	// Position camera
	transition.perspectiveCamera.position.set(4800000, 2570000, 14720000);
	transition.perspectiveCamera.lookAt(0, 0, 0);
	transition.autoSync = false;
	transition.orthographicPositionalZoom = false;

	// Create and configure controls
	const controls = createControls(scene, transition, renderer.domElement);
	
	// Connect camera and controls
	transition.addEventListener('camera-change', ({ camera, prevCamera }) => {
		handleCameraChange(camera, prevCamera, controls);
	});
	
	return { transition, controls };
}

function handleCameraChange(camera, prevCamera, controls) {
	if (controls.tilesRenderer) {
		controls.tilesRenderer.deleteCamera(prevCamera);
		controls.tilesRenderer.setCamera(camera);
	}
	controls.setCamera(camera);
}

export function createControls(scene, transition, domElement) {
	// Create the controls
	const controls = new GlobeControls(scene, transition.camera, domElement, null);
	
	// Basic control settings
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;
	controls.rotateSpeed = 0.8;
	controls.zoomSpeed = 1.0;
	
	// Increase distance limits to allow both closer and farther views
	controls.minDistance = 10;  // Allow closer zoom
	controls.maxDistance = 40000000;  // Allow much farther view
	
	// Improve right-click at far distances
	controls.enablePan = true;
	controls.screenSpacePanning = true;
	controls.panSpeed = 2.0;  // Increase pan speed
	controls.raycastDistanceMultiplier = 10.0;  // Extend raycast distance for better detection
	controls.raycastDepth = 5;  // Increase raycast depth for better hit detection
	
	// Add property to track camera changes
	controls.hasChanged = false;
	
	// Store original update method
	const originalUpdate = controls.update;
	
	// Override update method to track changes
	controls.update = function() {
		const prevPosition = transition.camera.position.clone();
		const prevQuaternion = transition.camera.quaternion.clone();
		
		// Call original update
		const result = originalUpdate.apply(this, arguments);
		
		// Check if camera moved
		if (!prevPosition.equals(transition.camera.position) || 
			!prevQuaternion.equals(transition.camera.quaternion)) {
			controls.hasChanged = true;
		} else {
			controls.hasChanged = false;
		}
		
		return result;
	};
	
	// Set mouse buttons
	if (typeof controls.mouseButtons === 'object') {
		controls.mouseButtons = {
			LEFT: 0,
			MIDDLE: 1,
			RIGHT: 2
		};
	}
	
	// Prevent default context menu to ensure right-click works
	domElement.addEventListener('contextmenu', (event) => {
		event.preventDefault();
	}, false);
	
	return controls;
}

export function getCameraCartographicPosition(tiles, camera) {
	if (!tiles || !tiles.group) {
		return { lat: 0, lon: 0, height: 0 };
	}
	
	// This function would get camera position in cartographic coordinates
	// Actual implementation would use WGS84_ELLIPSOID and other utilities
	// For now returning a placeholder
	return {
		lat: 0,
		lon: 0,
		height: 1000
	};
}

export function getCameraOrientation(tiles, camera, cartographicPosition) {
	if (!tiles || !tiles.group) {
		return { azimuth: 0, elevation: 0, roll: 0 };
	}
	
	// This function would get camera orientation
	// Actual implementation would use WGS84_ELLIPSOID and other utilities
	// For now returning a placeholder
	return {
		azimuth: 0,
		elevation: 0,
		roll: 0
	};
}

export function positionCameraFromCartographic(tiles, camera, lat, lon, height, az, el, roll) {
	if (!tiles || !tiles.group) {
		return;
	}
	
	// This function would position camera based on cartographic coordinates
	// Actual implementation would use WGS84_ELLIPSOID and other utilities
	console.log('Positioning camera at', lat, lon, height);
}