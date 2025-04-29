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
        this.searchBox = null;
        this.searchResults = null;
        this.isLoaded = false;
        
        // Create UI elements
        this.createSearchUI();
        
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
        const API_KEY = ''; // Add your Google Maps API key here
        
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
    
    createSearchUI() {
        // Create search container
        const searchContainer = document.createElement('div');
        searchContainer.id = 'search-container';
        searchContainer.style.position = 'absolute';
        searchContainer.style.top = '20px';
        searchContainer.style.left = '50%';
        searchContainer.style.transform = 'translateX(-50%)';
        searchContainer.style.zIndex = '1000';
        searchContainer.style.width = '80%';
        searchContainer.style.maxWidth = '600px';
        
        // Create search input
        const searchBox = document.createElement('input');
        searchBox.id = 'search-box';
        searchBox.type = 'text';
        searchBox.placeholder = 'Search for a location...';
        searchBox.style.width = '100%';
        searchBox.style.padding = '10px';
        searchBox.style.fontSize = '16px';
        searchBox.style.borderRadius = '4px';
        searchBox.style.border = '1px solid #ccc';
        searchBox.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
        
        // Create search results container
        const searchResults = document.createElement('div');
        searchResults.id = 'search-results';
        searchResults.style.width = '100%';
        searchResults.style.maxHeight = '300px';
        searchResults.style.overflowY = 'auto';
        searchResults.style.backgroundColor = 'white';
        searchResults.style.borderRadius = '0 0 4px 4px';
        searchResults.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
        searchResults.style.display = 'none';
        
        // Create error message element
        const errorElement = document.createElement('div');
        errorElement.id = 'search-error';
        errorElement.style.color = 'red';
        errorElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        errorElement.style.padding = '5px';
        errorElement.style.marginTop = '5px';
        errorElement.style.borderRadius = '4px';
        errorElement.style.display = 'none';
        
        // Add elements to container
        searchContainer.appendChild(searchBox);
        searchContainer.appendChild(searchResults);
        searchContainer.appendChild(errorElement);
        
        // Add container to body
        document.body.appendChild(searchContainer);
        
        // Store references
        this.searchBox = searchBox;
        this.searchResults = searchResults;
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
            resultItem.style.padding = '10px';
            resultItem.style.borderBottom = '1px solid #eee';
            resultItem.style.cursor = 'pointer';
            
            // Add hover effect
            resultItem.addEventListener('mouseenter', () => {
                resultItem.style.backgroundColor = '#f5f5f5';
            });
            
            resultItem.addEventListener('mouseleave', () => {
                resultItem.style.backgroundColor = 'white';
            });
            
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
}
}