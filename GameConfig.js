import * as THREE from 'three';

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

    // --- FIX: LAPTOP ZOOM POSITION ---
    // Moved X back from 5.67 to 4.2 to pull camera to the "Room Side" of the desk.
    LAPTOP_VIEW_POS: new THREE.Vector3(4.2, 2.0, 2.33), 
    
    // Look Target remains Desk Center
    LAPTOP_VIEW_LOOK: new THREE.Vector3(5.0, 1.5, 3.0), 
    
    STAND_UP_DURATION: 2.0
};

export const STATE = {
    gamePhase: 'START_SCREEN', 
    cutsceneStage: 0,
    lightsOn: false,
    isMainDoorOpen: false,
    isBathroomDoorOpen: false,
    phoneRinging: false,
    phoneAnswered: false,
    
    // TRACKING
    isLaptopOpen: false
};

export const BOUNDS = {};