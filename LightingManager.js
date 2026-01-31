import * as THREE from 'three';

export class LightingManager {
    constructor(scene, refs) {
        this.scene = scene;
        this.refs = refs;
        
        // 1. HEMISPHERE LIGHT (The "Realism" Polish)
        // Replaces basic AmbientLight.
        // SkyColor (0xffd1a6): Warm, soft orange (matches bounce from bulb).
        // GroundColor (0x332211): Dark, warm brown (richer shadows).
        this.hemiLight = new THREE.HemisphereLight(0xffd1a6, 0x332211, 0.4);
        this.scene.add(this.hemiLight);

        // 2. Main Bedroom Light (The Bulb Source)
        // Color: 0xffaa00 (Deep warm orange/yellow)
        this.bedroomLight = new THREE.PointLight(0xffaa00, 0, 25);
        this.bedroomLight.position.set(0, 9, 0);
        this.bedroomLight.castShadow = true;
        
        // Soften shadows for realism
        this.bedroomLight.shadow.mapSize.width = 1024;
        this.bedroomLight.shadow.mapSize.height = 1024;
        this.bedroomLight.shadow.radius = 8; // Softer edges
        this.bedroomLight.shadow.bias = -0.0001; // Fix shadow acne
        this.scene.add(this.bedroomLight);

        // 3. Laptop Light
        this.laptopLight = new THREE.PointLight(0x4488ff, 2.0, 5); 
        this.laptopLight.position.set(0, 2.0, 3.0); 
        this.scene.add(this.laptopLight);

        // 4. Switch "Ghost Box" Indicator
        const glowGeo = new THREE.BoxGeometry(0.5, 0.7, 0.15);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,      
            transparent: true,    
            opacity: 0.0,         
            depthWrite: false,    
            side: THREE.FrontSide
        });
        this.switchGlow = new THREE.Mesh(glowGeo, glowMat);
        this.switchGlow.position.set(2.5, 3.0, -7.42);
        this.scene.add(this.switchGlow);

        this.toggleBedroom(false);
    }

    /**
     * Toggle bedroom lights on/off with optional flickering effect
     * @param {boolean} isOn - Light state (true = on, false = off)
     * @param {boolean} flicker - Optional flickering effect during transition
     */
    toggleBedroom(isOn, flicker = false) {
        if (flicker) {
            // Create flickering effect before final state
            this.flickerLights(isOn);
        } else {
            this.applyLightState(isOn);
        }
    }

    /**
     * Apply lighting state without effects
     * @param {boolean} isOn - Target light state
     */
    applyLightState(isOn) {
        if (isOn) {
            // === LIGHTS ON ===
            
            // 1. WARM ATMOSPHERE (Hemisphere Light)
            this.hemiLight.intensity = 1.2; 
            this.hemiLight.color.setHex(0xffd1a6); // Warm Orange-ish White
            this.hemiLight.groundColor.setHex(0x332211); // Dark Warm Shadows

            // 2. MAIN BULB CAST
            this.bedroomLight.intensity = 1.0; 
            this.bedroomLight.color.setHex(0xffaa00);

            // 3. THE FIXTURE (Visual Mesh)
            if(this.refs.bulb) {
                this.refs.bulb.material.emissive.setHex(0xffaa00); 
                this.refs.bulb.material.emissiveIntensity = 20.0;
            }
            
            this.laptopLight.intensity = 0.5;
            this.switchGlow.material.opacity = 0.0;
        } else {
            // === LIGHTS OFF ===
            
            // Cold, dark night atmosphere
            this.hemiLight.intensity = 0.05; 
            this.hemiLight.color.setHex(0x0a0a18); // Blue-ish moonlight
            this.hemiLight.groundColor.setHex(0x000000); // Pitch black floor

            this.bedroomLight.intensity = 0;
            
            if(this.refs.bulb) {
                this.refs.bulb.material.emissiveIntensity = 0.0;
            }
            
            this.laptopLight.intensity = 4.0; 
            this.laptopLight.distance = 8.0; 

            this.switchGlow.material.opacity = 0.03; 
        }
    }

    /**
     * Create a flickering effect when changing light states
     * Simulates electrical instability for horror atmosphere
     * @param {boolean} finalState - Target state after flickering
     */
    flickerLights(finalState) {
        const flickerSequence = [false, true, false, true, false, finalState];
        const flickerDelay = 100; // milliseconds between flickers
        
        flickerSequence.forEach((state, index) => {
            setTimeout(() => {
                this.applyLightState(state);
            }, flickerDelay * index);
        });
    }

    /**
     * Gradually dim or brighten lights over time
     * Creates tension by slowly changing lighting
     * @param {number} targetIntensity - Target intensity (0.0 to 1.0)
     * @param {number} duration - Duration in milliseconds
     */
    fadeLights(targetIntensity, duration = 1000) {
        const startIntensity = this.bedroomLight.intensity;
        const startTime = Date.now();
        
        const fadeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1.0);
            
            this.bedroomLight.intensity = startIntensity + (targetIntensity - startIntensity) * progress;
            
            if (progress >= 1.0) {
                clearInterval(fadeInterval);
            }
        }, 16); // ~60fps
    }

    /**
     * Create a brief flash effect (e.g., lightning, jumpscare)
     * @param {number} intensity - Flash brightness (default: 10.0)
     * @param {number} duration - Flash duration in ms (default: 100)
     */
    flash(intensity = 10.0, duration = 100) {
        const originalIntensity = this.hemiLight.intensity;
        this.hemiLight.intensity = intensity;
        
        setTimeout(() => {
            this.hemiLight.intensity = originalIntensity;
        }, duration);
    }
}