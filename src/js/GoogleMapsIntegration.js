// GoogleMapsIntegration.js
import { MathUtils, Vector3 } from 'three';
import { WGS84_ELLIPSOID, CAMERA_FRAME } from '3d-tiles-renderer';

export default class GoogleMapsIntegration {
    constructor(sceneRenderer) {
        this.sceneRenderer = sceneRenderer;
        this.geocoder = null;
        this.autocompleteService = null;
        this.placesService = null;
        this.map = null;
        this.isLoaded = false;
        
        // Find existing UI elements instead of creating new ones
        this.initSearchUI();
        
        // Load Google Maps API
        this.loadGoogleMapsAPI();
    }
    
    loadGoogleMapsAPI() {
        console.log('Loading Google Maps API...');
        
        // Check if the API is already loaded
        if (window.google && window.google.maps) {
            this.initGoogleMaps();
            return;
        }
        
        // Create the script element
        const script = document.createElement('script');
        const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY; // Add your Google Maps API key here
        
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        
        // Initialize Google Maps when script loads
        script.onload = () => {
            this.initGoogleMaps();
        };
        
        script.onerror = (error) => {
            console.error('Error loading Google Maps API:', error);
            document.getElementById('search-error').textContent = 'Failed to load Google Maps API';
            document.getElementById('search-error').style.display = 'block';
        };
        
        // Add the script to the document
        document.head.appendChild(script);
    }
    
    initGoogleMaps() {
        console.log('Initializing Google Maps services...');
        
        try {
            // Initialize Google Maps services
            this.geocoder = new google.maps.Geocoder();
            this.autocompleteService = new google.maps.places.AutocompleteService();
            
            // Create a hidden map element for PlacesService
            const mapDiv = document.createElement('div');
            mapDiv.style.display = 'none';
            document.body.appendChild(mapDiv);
            
            this.map = new google.maps.Map(mapDiv, {
                center: { lat: 0, lng: 0 },
                zoom: 2,
                disableDefaultUI: true
            });
            
            this.placesService = new google.maps.places.PlacesService(this.map);
            
            // Initialize autocomplete for the search box
            this.initAutocomplete();
            
            // Mark as loaded
            this.isLoaded = true;
            
            console.log('Google Maps services initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Google Maps services:', error);
            document.getElementById('search-error').textContent = 'Failed to initialize Google Maps';
            document.getElementById('search-error').style.display = 'block';
        }
    }
    
    initSearchUI() {
        // Find existing elements instead of creating new ones
        this.searchContainer = document.getElementById('search-container');
        this.searchBox = document.getElementById('search-box');
        this.searchResults = document.getElementById('search-results');
        
        if (!this.searchContainer || !this.searchBox || !this.searchResults) {
            console.error('Search UI elements not found in the DOM');
        }
    }
    
    initAutocomplete() {
        if (!this.searchBox || !this.autocompleteService) {
            return;
        }
        
        // Variable to store the current timeout
        let timeout = null;
        
        // Add input event listener for search box
        this.searchBox.addEventListener('input', () => {
            // Clear previous timeout
            if (timeout) {
                clearTimeout(timeout);
            }
            
            const query = this.searchBox.value.trim();
            
            // Clear results if query is empty
            if (!query) {
                this.searchResults.innerHTML = '';
                this.searchResults.style.display = 'none';
                return;
            }
            
            // Set a timeout to avoid too many requests
            timeout = setTimeout(() => {
                this.getPlacePredictions(query);
            }, 300);
        });
        
        // Add focus event listener to show results if available
        this.searchBox.addEventListener('focus', () => {
            if (this.searchResults.innerHTML) {
                this.searchResults.style.display = 'block';
            }
        });
        
        // Add blur event listener to hide results when clicked outside
        document.addEventListener('click', (event) => {
            if (!this.searchContainer.contains(event.target)) {
                this.searchResults.style.display = 'none';
            }
        });
    }
    
    getPlacePredictions(query) {
        if (!this.autocompleteService) {
            console.error('Autocomplete service not initialized');
            return;
        }
        
        this.autocompleteService.getPlacePredictions(
            { input: query },
            (predictions, status) => {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
                    console.warn('No place predictions found:', status);
                    this.searchResults.innerHTML = '<div class="search-result">No results found</div>';
                    this.searchResults.style.display = 'block';
                    return;
                }
                
                // Display predictions
                this.displayPredictions(predictions);
            }
        );
    }
    
    displayPredictions(predictions) {
        // Clear previous results
        this.searchResults.innerHTML = '';
        
        // Add each prediction as a result item
        predictions.forEach(prediction => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result';
            resultItem.textContent = prediction.description;
            
            // Add click event to select this place
            resultItem.addEventListener('click', () => {
                this.selectPlace(prediction);
            });
            
            this.searchResults.appendChild(resultItem);
        });
        
        // Show results
        this.searchResults.style.display = 'block';
    }
    
    selectPlace(prediction) {
        // Close the results dropdown
        this.searchResults.style.display = 'none';
        
        // Update search box with selected place
        this.searchBox.value = prediction.description;
        
        // Get place details and fly to location
        this.geocoder.geocode(
            { placeId: prediction.place_id },
            (results, status) => {
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;
                    const lat = location.lat();
                    const lng = location.lng();
                    
                    // Get elevation data (optional)
                    this.getElevation(lat, lng, (elevation) => {
                        // Default elevation if not found
                        const height = elevation || 1000;
                        
                        // Fly to the location
                        this.flyToLocation(lat, lng, height);
                    });
                } else {
                    console.error('Geocode failed:', status);
                    document.getElementById('search-error').textContent = 'Failed to find location';
                    document.getElementById('search-error').style.display = 'block';
                    
                    // Hide error after 3 seconds
                    setTimeout(() => {
                        document.getElementById('search-error').style.display = 'none';
                    }, 3000);
                }
            }
        );
    }
    
    getElevation(lat, lng, callback) {
        // Use Google Maps Elevation API to get the elevation
        const elevator = new google.maps.ElevationService();
        
        elevator.getElevationForLocations(
            {
                locations: [{ lat, lng }]
            },
            (results, status) => {
                if (status === 'OK' && results[0]) {
                    // Use the elevation as the height
                    callback(results[0].elevation);
                } else {
                    // Default height if elevation service fails
                    callback(null);
                }
            }
        );
    }
    
    flyToLocation(lat, lng, height) {
        if (!this.sceneRenderer.tiles) {
            console.error('Tiles renderer not initialized');
            return;
        }
        
        console.log(`Flying to location: ${lat}, ${lng}, height: ${height}`);
        
        // Get the scene renderer components
        const { transition, controls } = this.sceneRenderer;
        const camera = transition.camera;
        
        // Update the tiles matrix world so we can use it
        this.sceneRenderer.tiles.group.updateMatrixWorld();
        
        // Convert to radians
        const latRad = lat * MathUtils.DEG2RAD;
        const lngRad = lng * MathUtils.DEG2RAD;
        
        // Get a good viewing height (adjust as needed based on terrain)
        const viewingHeight = height + 1000;
        
        // Position for looking at target from an angle
        const azimuth = 0; // Looking north
        const elevation = -30 * MathUtils.DEG2RAD; // 30 degrees down
        const roll = 0;
        
        // Get the current camera position and orientation
        const currentCartographic = {};
        const currentOrientation = {};
        const tilesMatInv = this.sceneRenderer.tiles.group.matrixWorld.clone().invert();
        const localCameraPos = camera.position.clone().applyMatrix4(tilesMatInv);
        const localCameraMat = camera.matrixWorld.clone().premultiply(tilesMatInv);
        
        WGS84_ELLIPSOID.getPositionToCartographic(localCameraPos, currentCartographic);
        WGS84_ELLIPSOID.getAzElRollFromRotationMatrix(
            currentCartographic.lat, currentCartographic.lon, localCameraMat,
            currentOrientation, CAMERA_FRAME
        );
        
        // Create a status message for flying animation
        const statusElement = document.createElement('div');
        statusElement.className = 'location-notification';
        statusElement.textContent = `Flying to ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        document.body.appendChild(statusElement);
        
        // Set up animation parameters
        const animationDuration = 3000; // 3 seconds
        const startTime = performance.now();
        
        // Store target state for animation
        const targetState = {
            lat: latRad,
            lng: lngRad,
            height: viewingHeight,
            azimuth: azimuth,
            elevation: elevation,
            roll: roll
        };
        
        // Store start state for animation
        const startState = {
            lat: currentCartographic.lat,
            lng: currentCartographic.lon,
            height: currentCartographic.height,
            azimuth: currentOrientation.azimuth,
            elevation: currentOrientation.elevation,
            roll: currentOrientation.roll
        };
        
        // Animation function
        const animateCamera = (timestamp) => {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            
            // Use an easing function for smoother motion
            const easeProgress = this.easeInOutCubic(progress);
            
            // Interpolate between start and target states
            const currentState = {
                lat: this.lerp(startState.lat, targetState.lat, easeProgress),
                lng: this.lerp(startState.lng, targetState.lng, easeProgress),
                height: this.lerp(startState.height, targetState.height, easeProgress),
                azimuth: this.lerp(startState.azimuth, targetState.azimuth, easeProgress),
                elevation: this.lerp(startState.elevation, targetState.elevation, easeProgress),
                roll: this.lerp(startState.roll, targetState.roll, easeProgress)
            };
            
            // Update the camera position
            this.updateCameraPosition(currentState);
            
            // Continue animation if not complete
            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            } else {
                // Animation complete
                console.log('Animation complete');
                
                // Update the notification message
                statusElement.textContent = `Arrived at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                
                // Remove notification after a delay
                setTimeout(() => {
                    if (document.body.contains(statusElement)) {
                        document.body.removeChild(statusElement);
                    }
                }, 2000);
            }
        };
        
        // Start the animation
        requestAnimationFrame(animateCamera);
    }
    
    updateCameraPosition(state) {
        const { transition } = this.sceneRenderer;
        const camera = transition.camera;
        
        // Extract the east-north-up frame into matrix world
        WGS84_ELLIPSOID.getRotationMatrixFromAzElRoll(
            state.lat, state.lng, state.azimuth, state.elevation, state.roll,
            camera.matrixWorld, CAMERA_FRAME
        );
        
        // Apply the necessary tiles transform
        camera.matrixWorld.premultiply(this.sceneRenderer.tiles.group.matrixWorld);
        camera.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale);
        
        // Get the position
        WGS84_ELLIPSOID.getCartographicToPosition(state.lat, state.lng, state.height, camera.position);
        camera.position.applyMatrix4(this.sceneRenderer.tiles.group.matrixWorld);
    }
    
    // Utility functions for animation
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}