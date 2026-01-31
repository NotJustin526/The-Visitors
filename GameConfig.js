import * as THREE from 'three';

// Game constants - Fixed positions and durations
export const CONSTANTS = {
    // START: Sleeping Head Position
    BED_HEAD_POS: new THREE.Vector3(-6.5, 1.0, 5.0), 
    BED_LOOK_AT: new THREE.Vector3(-6.5, 3.0, 5.0), 

    // CUTSCENE POSITIONS
    SIT_UP_POS: new THREE.Vector3(-6.0, 2.0, 5.0),
    BED_SIDE_STAND_POS: new THREE.Vector3(-5.0, 4.0, 2.5), 
    
    // DESK / ALARM POSITIONS
    DESK_ALARM_POS: new THREE.Vector3(1.5, 4.0, 2.5),
    ALARM_LOOK_AT: new THREE.Vector3(5.0, 1.7, 0.5), 

    // SWITCH POSITIONS
    SWITCH_STAND_POS: new THREE.Vector3(2.5, 4.0, -5.0),
    SWITCH_LOOK_AT: new THREE.Vector3(2.5, 3.0, -7.5),

    // LAPTOP ZOOM POSITION
    LAPTOP_VIEW_POS: new THREE.Vector3(4.2, 2.0, 2.33), 
    LAPTOP_VIEW_LOOK: new THREE.Vector3(5.0, 1.5, 3.0), 
    
    STAND_UP_DURATION: 2.0
};

// Atmospheric effects configuration
export const ATMOSPHERE_CONFIG = {
    // Movement sound timing
    MOVEMENT_SOUND_INTERVAL: 3.0,        // Seconds between movement sounds
    MOVEMENT_SOUND_PROBABILITY: 0.3,     // Chance of floor creak when walking
    
    // Stationary effects
    HEARTBEAT_TRIGGER_TIME: 15.0,        // Seconds standing still before heartbeat starts
    
    // Random events
    RANDOM_EVENT_INTERVAL: 20.0,         // Seconds between random atmospheric events
    RANDOM_EVENT_PROBABILITY: 0.05,      // Chance of random event per interval
    STATIC_SOUND_PROBABILITY: 0.3,       // Chance of static sound in random events
    FLICKER_PROBABILITY: 0.5             // Chance of light flicker in random events
};

/**
 * Global game state - All variables initialized with safe defaults
 * Tracks game phase, door states, phone status, and laptop state
 */
export const STATE = {
    gamePhase: 'START_SCREEN',      // Current game phase
    cutsceneStage: 0,                // Cutscene progression
    lightsOn: false,                 // Bedroom lights state
    isMainDoorOpen: false,           // Main door open/closed
    isBathroomDoorOpen: false,       // Bathroom door open/closed
    closetDoorOpen: false,           // Closet door open/closed
    phoneRinging: false,             // Phone ring state
    phoneAnswered: false,            // Phone answered state
    isLaptopOpen: false              // Laptop interface active
};

// Gameplay boundaries - Used for collision detection
export const BOUNDS = {};