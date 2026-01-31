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

    toggleBedroom(isOn) {
        if (isOn) {
            // === LIGHTS ON ===
            
            // 1. WARM ATMOSPHERE (Hemisphere Light)
            // UPDATED: Increased from 0.6 to 1.2 for brighter ambient light
            this.hemiLight.intensity = 1.2; 
            this.hemiLight.color.setHex(0xffd1a6); // Warm Orange-ish White
            this.hemiLight.groundColor.setHex(0x332211); // Dark Warm Shadows

            // 2. MAIN BULB CAST
            // Intensity 1.0, Warm Orange Color
            this.bedroomLight.intensity = 1.0; 
            this.bedroomLight.color.setHex(0xffaa00);

            // 3. THE FIXTURE (Visual Mesh)
            if(this.refs.bulb) {
                // Set emission to match the light color exactly
                this.refs.bulb.material.emissive.setHex(0xffaa00); 
                this.refs.bulb.material.emissiveIntensity = 20.0; // Blindingly bright core
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
}