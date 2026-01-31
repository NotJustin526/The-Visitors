import * as THREE from 'three';
import { STATE } from './GameConfig.js';

export class EntityManager {
    constructor(scene, refs, soundMgr, lightMgr) {
        this.scene = scene;
        this.refs = refs;
        this.soundMgr = soundMgr; // Has reference to this.soundMgr.camera
        this.lightMgr = lightMgr; 

        // TIMING CONFIGURATION
        this.PHONE_DURATION = 157.0; 
        this.GRACE_PERIOD = 10.0;    
        this.COOLDOWN_DURATION = 15.0; 
        
        this.timers = { introTimer: 0, graceTimer: 0, cooldownTimer: 0, eventDelay: 0 };
        
        this.status = 'WAITING_FOR_PHONE'; 
        this.currentEntity = null;
        this.encounterStage = 0;
        
        // --- ENTITY POOL ---
        this.entityPool = ['CLOSET', 'WINDOW', 'WHISPER'];

        // State Flags
        this.slamSoundPlayed = false;
        this.breathTriggered = false; 

        // Visuals
        this.handMesh = this.createHandVisual();
        this.shadowMan = this.createShadowManVisual();
        this.whisperEyes = this.createWhisperEyesVisual();
    }

    createHandVisual() {
        const handGroup = new THREE.Group();
        const armGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.5);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x880000, roughness: 0.8 });
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.rotation.z = Math.PI / 2; 
        handGroup.add(arm);
        
        if (this.refs.closetPivot) {
            this.refs.closetPivot.add(handGroup);
            handGroup.position.set(0.2, 3.5, 2.0); 
            handGroup.visible = false;
        }
        return handGroup;
    }

    createWhisperEyesVisual() {
        const group = new THREE.Group();
        const eyeGeo = new THREE.SphereGeometry(0.05, 16, 16);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.15, 0, 0);
        
        // --- OVAL SHAPE ---
        // Scale X up (wider), Scale Y down (narrower)
        leftEye.scale.set(1.3, 0.6, 1.0); 
        group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.15, 0, 0);
        
        // --- OVAL SHAPE ---
        rightEye.scale.set(1.3, 0.6, 1.0);
        group.add(rightEye);

        // Position: Back Corner of Bedroom
        group.position.set(-6.5, 2.5, 6.5);
        // Initial look (will be updated every frame)
        group.lookAt(0, 4.0, 0); 
        
        group.visible = false;
        this.scene.add(group);
        return group;
    }

    createShadowManVisual() {
        const group = new THREE.Group();
        
        // 1. HEAD 
        const headGeo = new THREE.BoxGeometry(0.5, 0.6, 0.5);
        const head = new THREE.Mesh(headGeo, this.refs.materials.monsterFace);
        head.position.y = 3.8; 
        group.add(head);
        this.manHead = head; 

        // 2. TORSO 
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.35, 2.5, 8);
        const body = new THREE.Mesh(bodyGeo, this.refs.materials.monsterSkin);
        body.position.y = 2.3; 
        group.add(body);

        // 3. ARMS 
        const armGeo = new THREE.CylinderGeometry(0.12, 0.1, 2.8); 
        const lArm = new THREE.Group();
        lArm.position.set(-0.6, 3.4, 0); 
        const lMesh = new THREE.Mesh(armGeo, this.refs.materials.monsterSkin);
        lMesh.position.y = -1.2; 
        lArm.add(lMesh);
        group.add(lArm);
        this.manLArm = lArm;

        const rArm = new THREE.Group();
        rArm.position.set(0.6, 3.4, 0);
        const rMesh = new THREE.Mesh(armGeo, this.refs.materials.monsterSkin);
        rMesh.position.y = -1.2; 
        rArm.add(rMesh);
        group.add(rArm);
        this.manRArm = rArm;

        // SCALE
        group.scale.set(1.3, 1.3, 1.3);
        group.visible = false;
        this.scene.add(group);
        return group;
    }

    skipIntro() {
        if (this.status === 'INTRO_COOLDOWN') {
            console.log("⏩ Tutorial Skipped by User");
            this.timers.introTimer = this.PHONE_DURATION; 
            this.soundMgr.stop('phone_tutorial'); 
        }
    }

    triggerRandomEncounter() {
        if (this.entityPool.length === 0) {
            console.log("🎉 Player Survived! No entities left in pool.");
            this.status = 'SURVIVED'; 
            return;
        }

        const index = Math.floor(Math.random() * this.entityPool.length);
        const type = this.entityPool[index];
        this.entityPool.splice(index, 1); 

        this.triggerEncounter(type);
    }

    update(delta) {
        // --- EYE TRACKING ---
        // If the eyes are visible, make them stare at the player's camera
        if (this.whisperEyes && this.whisperEyes.visible) {
            this.whisperEyes.lookAt(this.soundMgr.camera.position);
        }

        if (!STATE.phoneAnswered) return; 

        if (this.status === 'WAITING_FOR_PHONE') this.status = 'INTRO_COOLDOWN';

        if (this.status === 'INTRO_COOLDOWN') {
            this.timers.introTimer += delta;
            if (this.timers.introTimer >= this.PHONE_DURATION) {
                console.log("👻 Intro Finished. Entering Grace Period.");
                this.status = 'GRACE';
            }
        }
        else if (this.status === 'GRACE') {
            this.timers.graceTimer += delta;
            if (this.timers.graceTimer >= this.GRACE_PERIOD) {
                console.log("👻 Grace Period Over. Picking First Entity...");
                this.triggerRandomEncounter();
            }
        }
        else if (this.status === 'COOLDOWN') {
            this.timers.cooldownTimer += delta;
            if (this.timers.cooldownTimer >= this.COOLDOWN_DURATION) {
                console.log("👻 Cooldown Over. Picking Next Entity...");
                this.timers.cooldownTimer = 0;
                this.triggerRandomEncounter();
            }
        }
        else if (this.status === 'ENCOUNTER') {
            if (this.currentEntity === 'CLOSET') this.updateClosetEncounter(delta);
            else if (this.currentEntity === 'WINDOW') this.updateWindowEncounter(delta);
            else if (this.currentEntity === 'WHISPER') this.updateWhisperEncounter(delta);
        }
    }

    triggerEncounter(type) {
        this.status = 'ENCOUNTER';
        this.currentEntity = type;
        this.encounterStage = 0;
        this.timers.eventDelay = 0;
        console.log(`👻 Starting Encounter: ${type} (Remaining: ${this.entityPool})`);
    }

    // --- WHISPER ENTITY (UPDATED) ---
    updateWhisperEncounter(delta) {
        // 0: Start - Lights Off, Show Eyes, Play Sound
        if (this.encounterStage === 0) {
            console.log("👻 Whisper Entity Started");
            this.lightMgr.toggleBedroom(false);
            STATE.lightsOn = false;
            this.whisperEyes.visible = true;

            this.soundMgr.playPositional('whisper', this.whisperEyes, false, 2.5, 5.0, () => {
                this.encounterStage = 1;
            });
            this.encounterStage = -1; 
        }
        // 1: Sound Finished - Hide Eyes, Start Timer
        else if (this.encounterStage === 1) {
            console.log("👻 Whisper Finished. Waiting for lights...");
            this.whisperEyes.visible = false;
            this.timers.eventDelay = 0; 
            this.encounterStage = 2; 
        }
        // 2: Wait 5 Seconds OR Player turns lights on
        else if (this.encounterStage === 2) {
            // A. Did the player turn them on manually?
            if (STATE.lightsOn) {
                 console.log("💡 Player turned lights on. Good.");
                 this.encounterStage = 3;
                 return;
            }

            // B. Wait 5 seconds, then force them on
            this.timers.eventDelay += delta;
            if (this.timers.eventDelay >= 5.0) {
                console.log("💡 Whisper Timeout -> Lights Auto-Restore");
                this.lightMgr.toggleBedroom(true);
                STATE.lightsOn = true;
                this.encounterStage = 3;
            }
        }
        // 3: Cleanup & Cooldown
        else if (this.encounterStage === 3) {
            this.status = 'COOLDOWN';
            this.timers.cooldownTimer = 0;
            this.currentEntity = null;
            this.encounterStage = 0;
        }
    }

    // --- WINDOW ENTITY ---
    updateWindowEncounter(delta) {
        if (this.encounterStage === 0) {
            this.shadowMan.position.set(9.0, 0, 0); 
            this.manLArm.rotation.set(0,0,0);
            this.manRArm.rotation.set(0,0,0);
            this.shadowMan.visible = true;
            
            if(this.refs.windowGroup) {
                this.soundMgr.playPositional('window_voice', this.refs.windowGroup, false, 2.0, 2.0, () => {
                    this.encounterStage = 1;
                });
            }
            this.encounterStage = -1;
        }
        else if (this.encounterStage === 1) {
            this.shadowMan.visible = false;
            this.timers.eventDelay += delta;
            if (this.timers.eventDelay >= 2.0) { this.encounterStage = 2; this.timers.eventDelay = 0; }
        }
        else if (this.encounterStage === 2) {
            this.lightMgr.toggleBedroom(false);
            STATE.lightsOn = false; 
            this.soundMgr.playGlobal('hello_voice', false, 1.0, () => { this.encounterStage = 2.5; });
            this.encounterStage = -1;
        }
        else if (this.encounterStage === 2.5) {
            this.timers.eventDelay += delta;
            if (this.timers.eventDelay >= 1.0) { this.encounterStage = 3; this.timers.eventDelay = 0; }
        }
        else if (this.encounterStage === 3) {
            STATE.isMainDoorOpen = true; 
            this.soundMgr.playPositional('door_creak', this.refs.doorGroup, false, 2.0, 2.0);
            this.shadowMan.position.set(0, 0, -20.0);
            this.shadowMan.visible = true;
            this.breathTriggered = false; 
            this.encounterStage = 3.5; 
        }
        else if (this.encounterStage === 3.5) {
            if (this.refs.doorPivot) {
                this.refs.doorPivot.rotation.y = THREE.MathUtils.lerp(this.refs.doorPivot.rotation.y, -Math.PI/2, delta * 0.5);
                if (!this.breathTriggered && this.refs.doorPivot.rotation.y < -0.3) {
                    this.breathTriggered = true;
                    this.soundMgr.playGlobal('scared_breath', false, 1.0, () => { this.encounterStage = 4; });
                }
            }
        }
        else if (this.encounterStage === 4) {
            if (!STATE.lightsOn) {
                this.lightMgr.toggleBedroom(true);
                STATE.lightsOn = true;
            }
            this.encounterStage = 5;
        }
        else if (this.encounterStage === 5) {
            this.soundMgr.playGlobal('run_footsteps');
            this.slamSoundPlayed = false; 
            this.encounterStage = 5.5; 
        }
        else if (this.encounterStage === 5.5) {
            const time = Date.now() * 0.02; 
            this.shadowMan.position.z += delta * 8.0; 
            this.shadowMan.position.y = Math.abs(Math.sin(time * 0.8)) * 0.15; 
            this.manLArm.rotation.x = Math.sin(time * 0.8) * 1.5; 
            this.manRArm.rotation.x = Math.cos(time * 0.8) * 1.5; 
            this.manLArm.rotation.z = 0.2; 
            this.manRArm.rotation.z = -0.2;
            this.manHead.rotation.z = Math.sin(time * 2) * 0.15; 
            this.manHead.rotation.y = Math.cos(time * 1.5) * 0.15;

            if (!this.slamSoundPlayed && this.shadowMan.position.z > -12.0) {
                this.soundMgr.playPositional('slam_scream', this.refs.doorGroup, false, 5.0, 5.0);
                this.slamSoundPlayed = true; 
            }
            if (this.shadowMan.position.z > -8.0) {
                this.encounterStage = 6;
            }
        }
        else if (this.encounterStage === 6) {
            STATE.isMainDoorOpen = false;
            if (this.refs.doorPivot) this.refs.doorPivot.rotation.y = 0; 
            this.shadowMan.visible = false; 
            this.encounterStage = 7;
        }
        else if (this.encounterStage === 7) {
            this.status = 'COOLDOWN';
            this.timers.cooldownTimer = 0;
            this.currentEntity = null;
            this.encounterStage = 0;
        }
    }

    updateClosetEncounter(delta) {
        if (this.encounterStage === 0) {
            if (this.refs.closetGroup) {
                this.soundMgr.playPositional('closet_noise', this.refs.closetGroup, false, 2.0, 2.0, () => { this.encounterStage = 1; });
                this.encounterStage = -1; 
            }
        }
        else if (this.encounterStage === 1) {
            this.timers.eventDelay += delta;
            if (this.timers.eventDelay >= 1.0) { this.encounterStage = 2; this.timers.eventDelay = 0; }
        }
        else if (this.encounterStage === 2) {
            this.soundMgr.playPositional('closet_talk', this.refs.closetGroup, false, 3.0, 3.0, () => { this.encounterStage = 3; });
            this.encounterStage = -1; 
        }
        else if (this.encounterStage === 3) {
            this.soundMgr.playPositional('closet_bang', this.refs.closetGroup, false, 4.0, 4.0, () => { this.encounterStage = 4; });
            this.handMesh.visible = true; 
            this.encounterStage = 3.5; 
        }
        else if (this.encounterStage === 3.5) {
            const time = Date.now();
            this.handMesh.position.x = 0.2 + Math.sin(time * 0.05) * 0.1; 
            this.handMesh.position.z = 2.0 + Math.cos(time * 0.05) * 0.05;

            if (this.refs.closetDoor) {
                this.refs.closetDoor.rotation.y = (Math.random() - 0.5) * 0.1; 
                this.refs.closetDoor.position.x = (Math.random() - 0.5) * 0.05; 
                this.refs.closetDoor.position.z = (Math.random() - 0.5) * 0.05; 
            }
        }
        else if (this.encounterStage === 4) {
            this.handMesh.visible = false; 
            if (this.refs.closetDoor) {
                this.refs.closetDoor.rotation.set(0, 0, 0);
                this.refs.closetDoor.position.set(0, 0, 0);
            }
            this.status = 'COOLDOWN'; 
            this.timers.cooldownTimer = 0;
            this.currentEntity = null;
            this.encounterStage = 0;
        }
    }
}