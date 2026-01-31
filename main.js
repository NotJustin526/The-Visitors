import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { AssetManager } from './AssetManager.js';
import { SoundManager } from './SoundManager.js';
import { LightingManager } from './LightingManager.js';
import { EntityManager } from './EntityManager.js';
import { STATE, BOUNDS, CONSTANTS, ATMOSPHERE_CONFIG } from './GameConfig.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); 
scene.fog = new THREE.FogExp2(0x000000, 0.035);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; 
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 0.4; 

document.body.appendChild(renderer.domElement);

const blinkDiv = document.createElement('div');
blinkDiv.style.position = 'absolute';
blinkDiv.style.top = '0';
blinkDiv.style.left = '0';
blinkDiv.style.width = '100%';
blinkDiv.style.height = '100%';
blinkDiv.style.backgroundColor = 'black';
blinkDiv.style.opacity = '1'; 
blinkDiv.style.pointerEvents = 'none';
blinkDiv.style.transition = 'opacity 3s ease-in-out'; 
document.body.appendChild(blinkDiv);

scene.add(camera);

const controls = new PointerLockControls(camera, document.body);
const raycaster = new THREE.Raycaster();
const moveState = { forward: false, backward: false, left: false, right: false };

const loadingManager = new THREE.LoadingManager();

// --- UI ELEMENTS ---
const btnNewGame = document.getElementById('btn-new-game');
const btnLoadGame = document.getElementById('btn-load-game');
const btnSettings = document.getElementById('btn-settings');
const btnSettingsBack = document.getElementById('btn-settings-back');
const settingsScreen = document.getElementById('settings-screen');
const startScreen = document.getElementById('start-screen');
const laptopInterface = document.getElementById('laptop-interface');
const saveIcon = document.getElementById('save-icon');
const saveFeedback = document.getElementById('save-feedback');
const noiseDiv = document.getElementById('noise');
const scanlinesDiv = document.getElementById('scanlines');

if (btnNewGame) btnNewGame.disabled = true;

loadingManager.onProgress = (url, loaded, total) => {
    if (btnNewGame) {
        const pct = Math.floor((loaded / total) * 100);
        btnNewGame.textContent = `LOADING... ${pct}%`;
    }
};

loadingManager.onLoad = () => {
    if (btnNewGame) {
        btnNewGame.disabled = false;
        btnNewGame.textContent = "START NEW GAME";
        btnNewGame.style.cursor = "pointer";
    }
    if (localStorage.getItem('visitorSaveData')) {
        btnLoadGame.disabled = false;
        btnLoadGame.style.cursor = "pointer";
    }
    if (soundMgr) soundMgr.playGlobal('start_screen', true, 0.5);
};

let assetMgr, soundMgr, lightMgr, entityMgr;
let refs = {}, groups = {}, colliders = [];
let cutsceneTime = 0; 
let gameplayTime = 0; 
let currentMuteState = false; 
let lastTime = performance.now(); 

let cameraStartPos = new THREE.Vector3();
let cameraStartQuat = new THREE.Quaternion();
let savedStandPos = new THREE.Vector3();
let savedStandQuat = new THREE.Quaternion();
let transitionTime = 0;

let tutorialState = 'NONE'; 
let sequenceTimer = 0; 
let playerBodyParts = null;

// Dynamic atmosphere tracking
let atmosphereTimer = 0;
let lastPlayerPos = new THREE.Vector3();
let stationaryTime = 0;
let movementSoundTimer = 0;

STATE.phoneRinging = false;
STATE.phoneAnswered = false;

try {
    assetMgr = new AssetManager(loadingManager);
    const worldData = assetMgr.initWorld(scene);
    refs = worldData.refs; 
    colliders = worldData.colliders;
    groups = worldData.groups; 

    playerBodyParts = assetMgr.createPlayerBody();
    scene.add(playerBodyParts.mesh);
    playerBodyParts.mesh.visible = false; 

    soundMgr = new SoundManager(camera, loadingManager);
    lightMgr = new LightingManager(scene, refs);
    entityMgr = new EntityManager(scene, refs, soundMgr, lightMgr);
    
    // --- LISTENERS ---
    if (btnNewGame) {
        btnNewGame.addEventListener('click', () => {
            controls.lock(); 
            if (soundMgr.listener.context.state === 'suspended') soundMgr.listener.context.resume();
            
            soundMgr.stop('start_screen');
            startScreen.style.display = 'none';
            
            // --- HIDE NOISE WHEN STARTING GAME ---
            if (noiseDiv) noiseDiv.style.display = 'none';
            
            STATE.gamePhase = 'CUTSCENE';
            STATE.cutsceneStage = 0;
            STATE.lightsOn = false;
            STATE.phoneAnswered = false;
            STATE.isMainDoorOpen = false;
            entityMgr.entityPool = ['CLOSET', 'WINDOW', 'WHISPER'];
            
            moveState.forward = false; moveState.backward = false; moveState.left = false; moveState.right = false;
            tutorialState = 'NONE';
            sequenceTimer = 0;

            camera.position.copy(CONSTANTS.BED_HEAD_POS);
            camera.lookAt(CONSTANTS.BED_LOOK_AT);
            
            soundMgr.playGlobal('ambience', true, 0.05);
            if (refs.windowGroup) soundMgr.playPositional('rain', refs.windowGroup, true, 0.1, 10.0);
            if (refs.audioProxy) soundMgr.playPositional('night_ambience', refs.audioProxy, true, 0.3, 40.0);
            
            lastTime = performance.now(); 
            requestAnimationFrame(gameLoop);
        });
    }

    if (btnLoadGame) {
        btnLoadGame.addEventListener('click', () => {
            if (soundMgr.listener.context.state === 'suspended') soundMgr.listener.context.resume();
            soundMgr.stop('start_screen');
            startScreen.style.display = 'none';

            // --- HIDE NOISE WHEN LOADING GAME ---
            if (noiseDiv) noiseDiv.style.display = 'none';

            loadGame();
            lastTime = performance.now(); 
            requestAnimationFrame(gameLoop);
        });
    }

    if (btnSettings) {
        btnSettings.addEventListener('click', () => { settingsScreen.style.display = 'flex'; });
    }
    if (btnSettingsBack) {
        btnSettingsBack.addEventListener('click', () => { settingsScreen.style.display = 'none'; });
    }

    if (saveIcon) {
        saveIcon.addEventListener('click', (e) => {
            e.stopPropagation(); 
            saveGame();
            saveFeedback.style.opacity = 1;
            setTimeout(() => { saveFeedback.style.opacity = 0; }, 2000);
        });
    }

    // --- GAMEPLAY MOUSE LISTENER ---
    document.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        if (STATE.gamePhase === 'GAMEPLAY' && !controls.isLocked) {
            controls.lock();
        }
    });

    // --- AUDIO SETTINGS ---
    document.getElementById('vol-master').addEventListener('input', (e) => soundMgr.setVolume('master', parseFloat(e.target.value)));
    document.getElementById('vol-music').addEventListener('input', (e) => soundMgr.setVolume('music', parseFloat(e.target.value)));
    document.getElementById('vol-ambience').addEventListener('input', (e) => soundMgr.setVolume('ambience', parseFloat(e.target.value)));
    document.getElementById('vol-sfx').addEventListener('input', (e) => soundMgr.setVolume('sfx', parseFloat(e.target.value)));

    // --- VIDEO SETTINGS ---
    document.getElementById('set-brightness').addEventListener('input', (e) => {
        renderer.toneMappingExposure = parseFloat(e.target.value);
    });
    
    document.getElementById('set-grain').addEventListener('input', (e) => {
        if (noiseDiv) {
            // Only update the opacity logic. 
            // Note: If game is running, noise is hidden anyway.
            // This setting controls how visible it is *when* it is visible.
            // However, typically film grain is an overlay on the GAME.
            // So we might want to un-hide it during gameplay if this is > 0.
            // For now, let's assume it controls the opacity of the div globally.
            noiseDiv.style.opacity = parseFloat(e.target.value);
            // If user wants grain during gameplay, we must ensure it's displayed:
            if (STATE.gamePhase !== 'START_SCREEN' && parseFloat(e.target.value) > 0) {
                 noiseDiv.style.display = 'block';
            } else if (parseFloat(e.target.value) <= 0) {
                 noiseDiv.style.display = 'none';
            }
        }
    });

    document.getElementById('set-scanlines').addEventListener('input', (e) => {
        if (scanlinesDiv) {
            scanlinesDiv.style.opacity = parseFloat(e.target.value);
        }
    });


} catch (e) { console.error(e); }

/**
 * Save game state to localStorage
 * Handles all critical game state including entity pool and player position
 */
function saveGame() {
    try {
        const data = {
            version: '1.0', // Save version for future compatibility
            lightsOn: STATE.lightsOn,
            phoneAnswered: STATE.phoneAnswered,
            isMainDoorOpen: STATE.isMainDoorOpen,
            isBathroomDoorOpen: STATE.isBathroomDoorOpen,
            pool: entityMgr.entityPool,
            playerPos: savedStandPos,
            tutorialState: tutorialState,
            timestamp: Date.now()
        };
        localStorage.setItem('visitorSaveData', JSON.stringify(data));
        console.log("✅ GAME SAVED", data);
        return true;
    } catch (error) {
        console.error("❌ Save failed:", error);
        return false;
    }
}

/**
 * Load game state from localStorage with error handling for corrupted data
 * Falls back to safe defaults if save data is corrupted or missing
 */
function loadGame() {
    try {
        const json = localStorage.getItem('visitorSaveData');
        if (!json) {
            console.warn("No save data found");
            return false;
        }
        
        const data = JSON.parse(json);
        
        // Validate critical fields exist
        if (data.pool === undefined || data.phoneAnswered === undefined) {
            throw new Error("Save data missing critical fields");
        }

        // Restore game state with fallback defaults
        STATE.lightsOn = data.lightsOn ?? false;
        STATE.phoneAnswered = data.phoneAnswered ?? false;
        STATE.isMainDoorOpen = data.isMainDoorOpen ?? false;
        STATE.isBathroomDoorOpen = data.isBathroomDoorOpen ?? false;
        entityMgr.entityPool = Array.isArray(data.pool) ? data.pool : ['CLOSET', 'WINDOW', 'WHISPER'];
        
        tutorialState = data.tutorialState || 'DONE';

        // Restore player position
        if (data.playerPos && data.playerPos.x !== undefined) {
            savedStandPos.copy(data.playerPos);
        } else {
            savedStandPos.copy(CONSTANTS.DESK_ALARM_POS);
        }
        savedStandQuat.setFromEuler(new THREE.Euler(0, -Math.PI/2, 0));

        // Apply physical state to scene
        lightMgr.toggleBedroom(STATE.lightsOn);
        if (refs.doorPivot) refs.doorPivot.rotation.y = STATE.isMainDoorOpen ? -Math.PI/2 : 0;
        if (refs.bathPivot) refs.bathPivot.rotation.y = STATE.isBathroomDoorOpen ? Math.PI/2 : 0;

        // Set up laptop view
        STATE.gamePhase = 'LAPTOP';
        STATE.isLaptopOpen = true;
        
        camera.position.copy(CONSTANTS.LAPTOP_VIEW_POS);
        camera.lookAt(CONSTANTS.LAPTOP_VIEW_LOOK);
        
        laptopInterface.style.display = 'block';
        controls.unlock();

        soundMgr.playGlobal('ambience', true, 0.05);
        
        console.log("✅ GAME LOADED", data);
        return true;
    } catch (error) {
        console.error("❌ Load failed - corrupted save data:", error);
        // Clear corrupted save data
        localStorage.removeItem('visitorSaveData');
        alert("Save data was corrupted and has been reset. Please start a new game.");
        return false;
    }
}
    if (refs.windowGroup) soundMgr.playPositional('rain', refs.windowGroup, true, 0.1, 10.0);
    if (refs.audioProxy) soundMgr.playPositional('night_ambience', refs.audioProxy, true, 0.3, 40.0);

function updateCutscene(delta) {
    cutsceneTime += delta;
    if (STATE.cutsceneStage === 0) {
        if (cutsceneTime > 1.0 && !soundMgr.activeSounds['alarm']) {
            if(groups.clock) soundMgr.playPositional('alarm', groups.clock, true, 0.8, 5.0);
        }
        if (cutsceneTime > 3.0) {
            STATE.cutsceneStage = 1; 
            blinkDiv.style.opacity = '0'; 
            soundMgr.playGlobal('intro_voice', false, 1.0); 
        }
    }
    else if (STATE.cutsceneStage === 1) {
        const target = CONSTANTS.BED_LOOK_AT.clone();
        target.x += Math.sin(cutsceneTime * 1.5) * 0.5; 
        target.z += Math.cos(cutsceneTime * 2.0) * 0.2; 
        camera.lookAt(target);
        camera.rotation.z = Math.sin(cutsceneTime * 1.0) * 0.05; 
        if (cutsceneTime > 7.0) STATE.cutsceneStage = 2; 
    }
    else if (STATE.cutsceneStage === 2) {
        camera.rotation.z = 0; 
        const t = Math.min((cutsceneTime - 7.0) / 3.0, 1.0); 
        const smoothT = t * t * (3 - 2 * t); 
        camera.position.lerpVectors(CONSTANTS.BED_HEAD_POS, CONSTANTS.SIT_UP_POS, smoothT);
        const lookUpVec = CONSTANTS.BED_LOOK_AT.clone();
        const lookAlarmVec = CONSTANTS.ALARM_LOOK_AT.clone();
        const currentLook = new THREE.Vector3().lerpVectors(lookUpVec, lookAlarmVec, smoothT);
        camera.lookAt(currentLook);
        if (t >= 1.0) STATE.cutsceneStage = 3; 
    }
    else if (STATE.cutsceneStage === 3) {
        camera.lookAt(CONSTANTS.ALARM_LOOK_AT);
        const shake = Math.sin(cutsceneTime * 20) * 0.02;
        camera.position.x += shake;
        camera.position.y += shake * 0.5;
        if (cutsceneTime > 13.0) STATE.cutsceneStage = 4;
    }
    else if (STATE.cutsceneStage === 4) {
        const t = Math.min((cutsceneTime - 13.0) / 3.0, 1.0);
        const smoothT = t * t * (3 - 2 * t); 
        camera.position.lerpVectors(CONSTANTS.SIT_UP_POS, CONSTANTS.BED_SIDE_STAND_POS, smoothT);
        const bob = Math.sin(t * Math.PI) * 0.2; 
        camera.position.y += bob;
        camera.lookAt(CONSTANTS.ALARM_LOOK_AT);
        if (t >= 1.0) STATE.cutsceneStage = 5;
    }
    else if (STATE.cutsceneStage === 5) {
        const t = Math.min((cutsceneTime - 16.0) / 3.0, 1.0);
        camera.position.lerpVectors(CONSTANTS.BED_SIDE_STAND_POS, CONSTANTS.DESK_ALARM_POS, t);
        camera.position.y = CONSTANTS.BED_SIDE_STAND_POS.y + Math.sin(cutsceneTime * 12) * 0.05;
        camera.lookAt(CONSTANTS.ALARM_LOOK_AT);
        if (t >= 1.0) STATE.cutsceneStage = 6;
    }
    else if (STATE.cutsceneStage === 6) {
        if (cutsceneTime > 19.5) {
            soundMgr.stop('alarm'); 
            soundMgr.playGlobal('switch'); 
            STATE.cutsceneStage = 7; 
        }
    }
    else if (STATE.cutsceneStage === 7) {
        const t = Math.min((cutsceneTime - 19.5) / 4.0, 1.0);
        const smoothT = t * t * (3 - 2 * t); 
        camera.position.lerpVectors(CONSTANTS.DESK_ALARM_POS, CONSTANTS.SWITCH_STAND_POS, smoothT);
        camera.position.y = CONSTANTS.DESK_ALARM_POS.y + Math.sin(cutsceneTime * 12) * 0.05;
        const currentLook = new THREE.Vector3().lerpVectors(CONSTANTS.ALARM_LOOK_AT, CONSTANTS.SWITCH_LOOK_AT, smoothT);
        camera.lookAt(currentLook);
        if (t >= 1.0) STATE.cutsceneStage = 8;
    }
    else if (STATE.cutsceneStage === 8) {
        if (cutsceneTime > 24.0) { 
            soundMgr.playGlobal('switch');
            STATE.lightsOn = true; 
            lightMgr.toggleBedroom(true); 
            STATE.cutsceneStage = 9; 
        }
    }
    else if (STATE.cutsceneStage === 9) {
        if (!STATE.phoneRinging) {
            STATE.phoneRinging = true;
            soundMgr.playPositional('phone_ring', refs.phoneCollider, true, 2.0, 1.0);
        }
        STATE.gamePhase = 'GAMEPLAY';
        blinkDiv.style.display = 'none'; 
    }
}

function onKeyDown(event) {
    if (STATE.gamePhase === 'LAPTOP' && event.code === 'KeyE') {
        STATE.gamePhase = 'TRANSITION_FROM_LAPTOP';
        STATE.isLaptopOpen = false;
        laptopInterface.style.display = 'none';
        controls.lock(); 
        cameraStartPos.copy(camera.position);
        cameraStartQuat.copy(camera.quaternion);
        transitionTime = 0;
        return;
    }

    if (STATE.gamePhase !== 'GAMEPLAY') return; 
    
    if (event.code === 'Space') { 
        if (entityMgr && STATE.cutsceneStage < 9) {
            STATE.cutsceneStage = 9;
            cutsceneTime = 30.0;
            soundMgr.stop('alarm');
            STATE.lightsOn = true;
            lightMgr.toggleBedroom(true);
            STATE.gamePhase = 'GAMEPLAY';
            blinkDiv.style.display = 'none';
            if (!STATE.phoneRinging) {
                STATE.phoneRinging = true;
                soundMgr.playPositional('phone_ring', refs.phoneCollider, true, 2.0, 1.0);
            }
        }
        
        if (STATE.phoneAnswered && tutorialState !== 'DONE' && tutorialState !== 'GRACE') {
            if (tutorialState === 'START_TUTORIAL' || tutorialState === 'WAIT_TUTORIAL') {
                soundMgr.stop('phone_tutorial'); 
                tutorialState = 'START_HANGUP'; 
                sequenceTimer = 0;
            }
        }
    }

    switch (event.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'KeyE': interact(); break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyD': moveState.right = false; break;
    }
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

/**
 * Interaction handlers for each object type
 * Using strategy pattern to eliminate nested conditions
 */
const interactionHandlers = {
    'LAPTOP': () => {
        STATE.gamePhase = 'TRANSITION_TO_LAPTOP';
        STATE.isLaptopOpen = true;
        savedStandPos.copy(camera.position);
        savedStandQuat.copy(camera.quaternion);
        cameraStartPos.copy(camera.position);
        cameraStartQuat.copy(camera.quaternion);
        transitionTime = 0;
        controls.unlock();
    },
    'SWITCH': () => {
        STATE.lightsOn = !STATE.lightsOn;
        // Use flickering effect for more dramatic light transitions
        lightMgr.toggleBedroom(STATE.lightsOn, true);
        soundMgr.playGlobal('switch');
        
        // Stop heartbeat when lights turn on
        if (STATE.lightsOn && soundMgr.activeSounds['heartbeat']) {
            soundMgr.fadeOut('heartbeat', 500);
        }
    },
    'DOOR': () => {
        STATE.isMainDoorOpen = !STATE.isMainDoorOpen;
        refs.doorPivot.rotation.y = STATE.isMainDoorOpen ? -Math.PI / 2 : 0;
        soundMgr.playPositional(STATE.isMainDoorOpen ? 'door_open' : 'door_close', refs.doorGroup, false, 2.0, 1.0);
    },
    'BATHROOM_DOOR': () => {
        STATE.isBathroomDoorOpen = !STATE.isBathroomDoorOpen;
        refs.bathPivot.rotation.y = STATE.isBathroomDoorOpen ? Math.PI / 2 : 0;
        soundMgr.playPositional(STATE.isBathroomDoorOpen ? 'door_open' : 'door_close', refs.bathPivot, false, 2.0, 1.0);
    },
    'CLOSET_DOOR': () => {
        // Toggle closet door open/closed state
        STATE.closetDoorOpen = !STATE.closetDoorOpen;
        if (refs.closetDoor) {
            refs.closetDoor.rotation.y = STATE.closetDoorOpen ? -Math.PI / 3 : 0;
        }
        soundMgr.playPositional(STATE.closetDoorOpen ? 'door_creak' : 'door_close', refs.closetDoor, false, 1.5, 1.0);
    },
    'PICTURE': () => {
        // Picture interaction - play subtle sound and slight flicker
        soundMgr.playWithPitchVariation('creak_floor', 0.3);
        if (Math.random() < 0.3 && !STATE.lightsOn) {
            // Rare chance of something spooky in the dark
            soundMgr.playGlobal('whisper', false, 0.2);
        }
    },
    'PHONE': () => {
        if (STATE.phoneRinging) {
            STATE.phoneRinging = false;
            STATE.phoneAnswered = true;
            soundMgr.stop('phone_ring');
            soundMgr.playPositional('phone_pickup', refs.phoneCollider, false, 1.0, 1.0);
            setTimeout(() => {
                tutorialState = 'START_TUTORIAL';
            }, 500);
        }
    }
};

/**
 * Main interaction function - handles player interactions with objects in the world
 * Uses raycasting to detect objects within interaction range (3.5 units)
 */
function interact() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    // Build list of interactive objects that exist in the scene
    const interactables = [];
    if (refs.switchCollider) interactables.push(refs.switchCollider);
    if (refs.doorCollider) interactables.push(refs.doorCollider);
    if (refs.bathCollider) interactables.push(refs.bathCollider);
    if (refs.phoneCollider) interactables.push(refs.phoneCollider);
    if (refs.laptopCollider) interactables.push(refs.laptopCollider);
    if (refs.closetDoorCollider) interactables.push(refs.closetDoorCollider);
    if (refs.picture1Collider) interactables.push(refs.picture1Collider);
    if (refs.picture2Collider) interactables.push(refs.picture2Collider);
    
    // Check for intersections with interactive objects
    const intersects = raycaster.intersectObjects(interactables, true);
    if (intersects.length === 0 || intersects[0].distance >= 3.5) return;
    
    // Execute the appropriate handler for the interacted object
    const type = intersects[0].object.userData.type;
    const handler = interactionHandlers[type];
    if (handler) handler();
}

/**
 * Interaction prompt messages - descriptive text for each interactive object
 */
const interactionPrompts = {
    'SWITCH': () => `[E] ${STATE.lightsOn ? 'Turn Off' : 'Turn On'} Lights`,
    'DOOR': () => `[E] ${STATE.isMainDoorOpen ? 'Close' : 'Open'} Door`,
    'BATHROOM_DOOR': () => `[E] ${STATE.isBathroomDoorOpen ? 'Close' : 'Open'} Bathroom`,
    'CLOSET_DOOR': () => `[E] ${STATE.closetDoorOpen ? 'Close' : 'Open'} Closet`,
    'LAPTOP': () => '[E] Use Computer',
    'PICTURE': () => '[E] Examine Picture',
    'PHONE': () => STATE.phoneRinging ? '[E] Answer Phone' : ''
};

/**
 * Update UI elements - Shows contextual interaction prompts
 * Dynamically updates based on object state (doors open/closed, lights on/off)
 */
function updateUI() {
    const ui = document.getElementById('interaction-prompt');
    
    // Hide UI during cutscenes and laptop mode
    if (STATE.gamePhase === 'CUTSCENE' || STATE.gamePhase === 'LAPTOP') {
        ui.style.opacity = 0;
        return;
    }
    
    // Raycast from center of screen to find interactive objects
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const interactables = [];
    if (refs.laptopCollider) interactables.push(refs.laptopCollider);
    if (refs.switchCollider) interactables.push(refs.switchCollider);
    if (refs.doorCollider) interactables.push(refs.doorCollider);
    if (refs.bathCollider) interactables.push(refs.bathCollider);
    if (refs.phoneCollider) interactables.push(refs.phoneCollider);
    if (refs.closetDoorCollider) interactables.push(refs.closetDoorCollider);
    if (refs.picture1Collider) interactables.push(refs.picture1Collider);
    if (refs.picture2Collider) interactables.push(refs.picture2Collider);

    const intersects = raycaster.intersectObjects(interactables, true);
    if (intersects.length > 0 && intersects[0].distance < 3.5) {
        const type = intersects[0].object.userData.type;
        const promptFn = interactionPrompts[type];
        ui.textContent = promptFn ? promptFn() : "";
        ui.style.opacity = ui.textContent ? 1 : 0;
    } else {
        ui.style.opacity = 0;
    }
}

/**
 * Check if player position collides with walls or other obstacles
 * Optimized with early returns and spatial bounds checking
 * @param {THREE.Vector3} pos - Player position to check
 * @returns {boolean} - True if collision detected, false otherwise
 */
function checkCollisions(pos) {
    // Check solid colliders first (furniture, walls, etc.)
    for (const box of colliders) {
        if (box.containsPoint(pos)) return true;
    }
    
    // Define room boundaries for quick spatial checks
    const inBedroom = (pos.z > -7.0 && pos.x > -7.0 && pos.x < 7.0 && pos.z < 7.0);
    const inHallway = (pos.z <= -7.0 && pos.z >= -27.5 && pos.x > -9.0 && pos.x < 1.4);
    const inBathroom = (pos.x <= -1.6 && pos.x > -9.0 && pos.z > -26.0 && pos.z < -19.0);
    const inLiving = (pos.z < -27.5 && pos.x > -9.5 && pos.x < 19.5 && pos.z > -44.5);

    // Check main door collision (only when closed)
    if (!STATE.isMainDoorOpen) {
        if (pos.z > -8.0 && pos.z < -7.0 && Math.abs(pos.x) < 1.5) return true;
    }
    
    // Check bathroom door collision (only when closed)
    if (!STATE.isBathroomDoorOpen) {
        if (pos.z < -19.5 && pos.z > -22.5 && pos.x < -1.4 && pos.x > -1.6) return true;
    }
    
    // Allow movement in valid rooms, block everywhere else
    if (inBedroom || inHallway || inLiving || inBathroom) return false;
    
    return true; // Outside valid areas = collision
}

function gameLoop(time) {
    const delta = (time - lastTime) / 1000; lastTime = time;
    
    if (STATE.gamePhase === 'CUTSCENE') {
        updateCutscene(delta);
        renderer.render(scene, camera);
        requestAnimationFrame(gameLoop);
        return;
    }

    if (refs.materials && refs.materials.rainGlassMat) refs.materials.rainGlassMat.uniforms.uTime.value = time * 0.001;

    if (STATE.phoneAnswered && tutorialState !== 'DONE') {
        if (tutorialState === 'START_TUTORIAL') {
            soundMgr.playGlobal('phone_tutorial', false, 1.0);
            tutorialState = 'WAIT_TUTORIAL';
            sequenceTimer = 0;
        }
        else if (tutorialState === 'WAIT_TUTORIAL') {
            sequenceTimer += delta;
            if (sequenceTimer > 1.0) {
                const sound = soundMgr.activeSounds['phone_tutorial'];
                if (!sound || !sound.isPlaying) {
                    tutorialState = 'START_HANGUP';
                }
            }
        }
        else if (tutorialState === 'START_HANGUP') {
            soundMgr.playPositional('phone_hangup', refs.phoneCollider, false, 4.0, 1.0);
            tutorialState = 'WAIT_HANGUP';
            sequenceTimer = 0;
        }
        else if (tutorialState === 'WAIT_HANGUP') {
            sequenceTimer += delta;
            if (sequenceTimer > 0.5) {
                const sound = soundMgr.activeSounds['phone_hangup'];
                if (!sound || !sound.isPlaying) {
                    tutorialState = 'GRACE';
                    sequenceTimer = 0;
                }
            }
        }
        else if (tutorialState === 'GRACE') {
            sequenceTimer += delta;
            if (sequenceTimer >= 10.0) {
                tutorialState = 'DONE';
                if (entityMgr) {
                    entityMgr.status = 'GRACE'; 
                    entityMgr.timers.graceTimer = 0; 
                }
            }
        }
    }

    if (entityMgr) {
        if (STATE.phoneAnswered) {
            if (tutorialState === 'DONE') {
                entityMgr.update(delta);
            }
        } 
    }

    if (STATE.gamePhase === 'GAMEPLAY' || STATE.gamePhase === 'LAPTOP') {
        const targetMute = !STATE.lightsOn; 
        if (targetMute !== currentMuteState) {
            soundMgr.setAmbienceMuted(targetMute);
            currentMuteState = targetMute;
        }
    }

    if (STATE.gamePhase === 'TRANSITION_TO_LAPTOP') {
        transitionTime += delta * 2.0; 
        if (transitionTime >= 1.0) {
            transitionTime = 1.0;
            STATE.gamePhase = 'LAPTOP';
            laptopInterface.style.display = 'block'; 
        }
        camera.position.lerpVectors(cameraStartPos, CONSTANTS.LAPTOP_VIEW_POS, transitionTime);
        const targetQuat = new THREE.Quaternion();
        const dummy = new THREE.Object3D();
        dummy.position.copy(CONSTANTS.LAPTOP_VIEW_POS);
        dummy.lookAt(CONSTANTS.LAPTOP_VIEW_LOOK);
        targetQuat.copy(dummy.quaternion);
        camera.quaternion.slerpQuaternions(cameraStartQuat, targetQuat, transitionTime);
    }

    if (STATE.gamePhase === 'TRANSITION_FROM_LAPTOP') {
        transitionTime += delta * 2.0; 
        if (transitionTime >= 1.0) {
            transitionTime = 1.0;
            STATE.gamePhase = 'GAMEPLAY';
        }
        camera.position.lerpVectors(CONSTANTS.LAPTOP_VIEW_POS, savedStandPos, transitionTime);
        camera.quaternion.slerpQuaternions(cameraStartQuat, savedStandQuat, transitionTime);
    }

    if (controls.isLocked && STATE.gamePhase === 'GAMEPLAY') {
        const speed = 4.0 * delta;
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        const oldPos = camera.position.clone();
        if (moveState.forward) camera.position.addScaledVector(dir, speed);
        if (moveState.backward) camera.position.addScaledVector(dir, -speed);
        if (moveState.left) camera.position.addScaledVector(side, -speed);
        if (moveState.right) camera.position.addScaledVector(side, speed);
        if (checkCollisions(camera.position)) camera.position.copy(oldPos);
        camera.position.y = 4.0 + (moveState.forward || moveState.backward || moveState.left || moveState.right ? Math.sin(time * 0.01) * 0.05 : 0);
        
        // Dynamic atmosphere system - react to player actions
        updateDynamicAtmosphere(delta, camera.position);
    }
    
    updateUI();
    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
}

/**
 * Update dynamic atmosphere based on player behavior
 * Triggers ambient sounds and lighting changes for immersion
 * @param {number} delta - Time since last frame
 * @param {THREE.Vector3} currentPos - Current player position
 */
function updateDynamicAtmosphere(delta, currentPos) {
    atmosphereTimer += delta;
    
    // Check if player is moving or stationary
    const distanceMoved = currentPos.distanceTo(lastPlayerPos);
    const isMoving = distanceMoved > 0.01;
    
    if (isMoving) {
        stationaryTime = 0;
        movementSoundTimer += delta;
        
        // Occasional floor creaks when walking in dark
        if (!STATE.lightsOn && 
            movementSoundTimer > ATMOSPHERE_CONFIG.MOVEMENT_SOUND_INTERVAL && 
            Math.random() < ATMOSPHERE_CONFIG.MOVEMENT_SOUND_PROBABILITY) {
            soundMgr.playWithPitchVariation('creak_floor', 0.2);
            movementSoundTimer = 0;
        }
    } else {
        stationaryTime += delta;
        
        // Heartbeat sound if player stands still in dark for too long
        if (!STATE.lightsOn && 
            stationaryTime > ATMOSPHERE_CONFIG.HEARTBEAT_TRIGGER_TIME && 
            !soundMgr.activeSounds['heartbeat']) {
            soundMgr.playGlobal('heartbeat', true, 0.3);
        } else if (STATE.lightsOn && soundMgr.activeSounds['heartbeat']) {
            soundMgr.stop('heartbeat');
        }
    }
    
    // Random atmospheric events
    if (atmosphereTimer > ATMOSPHERE_CONFIG.RANDOM_EVENT_INTERVAL && 
        STATE.phoneAnswered && 
        Math.random() < ATMOSPHERE_CONFIG.RANDOM_EVENT_PROBABILITY) {
        const eventRoll = Math.random();
        
        if (eventRoll < ATMOSPHERE_CONFIG.STATIC_SOUND_PROBABILITY && !STATE.lightsOn) {
            // Brief static sound
            soundMgr.playGlobal('static', false, 0.2);
        } else if (eventRoll < ATMOSPHERE_CONFIG.FLICKER_PROBABILITY) {
            // Light flicker when lights are on
            if (STATE.lightsOn && lightMgr) {
                lightMgr.flickerLights(true);
            }
        }
        
        atmosphereTimer = 0;
    }
    
    lastPlayerPos.copy(currentPos);
}

function initSlideshow() {
    const container = document.getElementById('menu-slideshow');
    if (!container) return;

    const slidesConfig = [
        { src: 'assets/textures/menu_bg_1.png', effect: 'fx-pan-right' },
        { src: 'assets/textures/menu_bg_2.png', effect: 'fx-zoom-in' },
        { src: 'assets/textures/menu_bg_3.png', effect: 'fx-pan-left' },
    ];

    let currentIndex = 0;
    const slideDuration = 6000; 
    const slideElements = [];

    slidesConfig.forEach((config) => {
        const img = document.createElement('img');
        img.src = config.src;
        img.classList.add('slide-image');
        img.classList.add(config.effect); 
        
        container.insertBefore(img, container.firstChild); 
        slideElements.push(img);
    });

    function showSlide(index) {
        slideElements.forEach(el => el.classList.remove('active'));
        slideElements[index].classList.add('active');
    }

    showSlide(currentIndex);

    setInterval(() => {
        currentIndex = (currentIndex + 1) % slideElements.length;
        showSlide(currentIndex);
    }, slideDuration);
}

initSlideshow();

window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });