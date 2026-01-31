import * as THREE from 'three';

export class SoundManager {
    constructor(camera, loadingManager) {
        this.camera = camera;
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.audioLoader = new THREE.AudioLoader(loadingManager);
        
        this.buffers = {};
        this.activeSounds = {}; 
        this.pending = {}; 

        // VOLUME SETTINGS (0.0 to 1.0)
        this.volumes = {
            master: 1.0,
            music: 1.0,
            ambience: 1.0,
            sfx: 1.0
        };

        // Categorize sounds for the settings menu
        this.categoryMap = {
            'start_screen': 'music',
            'ambience': 'ambience',
            'rain': 'ambience',
            'night_ambience': 'ambience',
            // Everything else defaults to 'sfx'
        };

        this.baseVolumes = {}; 
        this.loadSounds();
    }

    loadSounds() {
        const files = {
            'start_screen': 'assets/sounds/start_screen.mp3',
            
            'ambience': 'assets/sounds/ambience.mp3',
            'rain': 'assets/sounds/rain.mp3',
            'night_ambience': 'assets/sounds/night_ambience.mp3',
            
            'alarm': 'assets/sounds/alarm.mp3',
            'intro_voice': 'assets/sounds/intro_voice.mp3',
            
            'switch': 'assets/sounds/switch.mp3',
            'door_open': 'assets/sounds/door_open.mp3',
            'door_close': 'assets/sounds/door_close.mp3',
            
            'phone_ring': 'assets/sounds/phone_ring.mp3',
            'phone_pickup': 'assets/sounds/phone_pickup.mp3',
            'phone_tutorial': 'assets/sounds/phone_tutorial.mp3',
            'phone_hangup': 'assets/sounds/phone_hangup.mp3',

            // --- ENTITY SOUNDS ---
            'closet_bang': 'assets/sounds/closet_bang.mp3',
            'closet_talk': 'assets/sounds/closet_talk.mp3',
            'closet_noise': 'assets/sounds/closet_noise.mp3',
            
            // --- WINDOW ENTITY SOUNDS ---
            'window_tap': 'assets/sounds/window_tap.mp3',
            'blinds_open': 'assets/sounds/blinds_open.mp3',
            'window_jumpscare': 'assets/sounds/window_jumpscare.mp3',
            'window_voice': 'assets/sounds/window_voice.mp3',
            
            // --- SHARED ENTITY SOUNDS ---
            'whisper': 'assets/sounds/whisper.mp3',
            'hello_voice': 'assets/sounds/hello_voice.mp3',
            'door_creak': 'assets/sounds/door_creak.mp3',
            'scared_breath': 'assets/sounds/scared_breath.mp3',
            'run_footsteps': 'assets/sounds/run_footsteps.mp3',
            'slam_scream': 'assets/sounds/slam_scream.mp3',
            
            // --- ADDITIONAL ATMOSPHERIC SOUNDS (NEW) ---
            'heartbeat': 'assets/sounds/heartbeat.mp3',
            'static': 'assets/sounds/static.mp3',
            'distant_laugh': 'assets/sounds/distant_laugh.mp3',
            'creak_floor': 'assets/sounds/creak_floor.mp3'
        };

        for (const [key, path] of Object.entries(files)) {
            this.audioLoader.load(path, (buffer) => {
                this.buffers[key] = buffer;
                if (this.pending[key]) {
                    const p = this.pending[key];
                    if (p.isPositional) this.playPositional(key, p.object, p.loop, p.volume, p.refDist, p.onEndCallback);
                    else this.playGlobal(key, p.loop, p.volume, p.onEndCallback);
                    delete this.pending[key];
                }
            }, undefined, (error) => {
                // Silently fail for missing audio files - allows game to run without all assets
                console.warn(`Failed to load sound: ${key} (${path})`);
            });
        }
    }

    getEffectiveVolume(key) {
        const cat = this.categoryMap[key] || 'sfx';
        const base = this.baseVolumes[key] !== undefined ? this.baseVolumes[key] : 1.0;
        return base * this.volumes[cat] * this.volumes.master;
    }

    setVolume(category, value) {
        this.volumes[category] = value;
        // Update all currently playing sounds
        for (const [key, sound] of Object.entries(this.activeSounds)) {
            if (sound && sound.isPlaying) {
                const effective = this.getEffectiveVolume(key);
                sound.setVolume(effective);
            }
        }
    }

    setAmbienceMuted(muted) {
        if (this.activeSounds['ambience']) this.activeSounds['ambience'].setVolume(muted ? 0 : this.getEffectiveVolume('ambience'));
        if (this.activeSounds['rain']) this.activeSounds['rain'].setVolume(muted ? 0.2 : this.getEffectiveVolume('rain')); 
        if (this.activeSounds['night_ambience']) this.activeSounds['night_ambience'].setVolume(muted ? 0.5 : this.getEffectiveVolume('night_ambience'));
    }

    stop(key) {
        if (this.activeSounds[key]) {
            this.activeSounds[key].stop();
            delete this.activeSounds[key];
        }
    }

    playGlobal(key, loop = false, volume = 1.0, onEndCallback = null) {
        if (!this.buffers[key]) {
            this.pending[key] = { isPositional: false, loop, volume, onEndCallback };
            return;
        }
        if (loop && this.activeSounds[key] && this.activeSounds[key].isPlaying) return;

        this.baseVolumes[key] = volume;

        const sound = new THREE.Audio(this.listener);
        sound.setBuffer(this.buffers[key]);
        sound.setLoop(loop);
        sound.setVolume(this.getEffectiveVolume(key));

        sound.onEnded = () => { if (onEndCallback) onEndCallback(); };
        sound.play();
        this.activeSounds[key] = sound;
        return sound;
    }

    /**
     * Play positional 3D sound attached to an object
     * @param {string} key - Sound identifier
     * @param {THREE.Object3D} object - 3D object to attach sound to
     * @param {boolean} loop - Loop the sound
     * @param {number} volume - Base volume (0.0 to 1.0+)
     * @param {number} refDist - Reference distance for 3D audio falloff
     * @param {Function} onEndCallback - Callback when sound ends
     * @returns {THREE.PositionalAudio} The created audio object
     */
    playPositional(key, object, loop = false, volume = 1.0, refDist = 1.0, onEndCallback = null) {
        if (!this.buffers[key]) {
            this.pending[key] = { isPositional: true, object, loop, volume, refDist, onEndCallback };
            return;
        }
        if (loop && this.activeSounds[key] && this.activeSounds[key].isPlaying) {
            return this.activeSounds[key];
        }
        if (this.activeSounds[key] && this.activeSounds[key].isPlaying) {
            this.activeSounds[key].stop();
        }

        this.baseVolumes[key] = volume;

        const sound = new THREE.PositionalAudio(this.listener);
        sound.setBuffer(this.buffers[key]);
        sound.setRefDistance(refDist);
        sound.setLoop(loop);
        sound.setVolume(this.getEffectiveVolume(key));
        object.add(sound);
        
        sound.onEnded = () => {
            sound.disconnect(); 
            object.remove(sound); 
            if (onEndCallback) onEndCallback(); 
        };

        sound.play();
        this.activeSounds[key] = sound;
        return sound;
    }

    /**
     * Play a sound with a random pitch variation for variety
     * Creates more organic and less repetitive soundscapes
     * @param {string} key - Sound identifier
     * @param {number} pitchVariation - Max pitch variation (default: 0.1)
     */
    playWithPitchVariation(key, pitchVariation = 0.1) {
        const sound = this.playGlobal(key, false, 1.0);
        if (sound) {
            const randomPitch = 1.0 + (Math.random() - 0.5) * pitchVariation;
            sound.setPlaybackRate(randomPitch);
        }
        return sound;
    }

    /**
     * Play a random sound from a set for variety
     * Useful for footsteps, breathing, ambient noises
     * @param {string[]} soundKeys - Array of sound identifiers to choose from
     */
    playRandom(soundKeys) {
        if (soundKeys.length === 0) return;
        const randomKey = soundKeys[Math.floor(Math.random() * soundKeys.length)];
        return this.playGlobal(randomKey);
    }

    /**
     * Fade in a sound gradually
     * @param {string} key - Sound identifier
     * @param {number} duration - Fade duration in milliseconds
     * @param {number} targetVolume - Target volume (0.0 to 1.0)
     */
    fadeIn(key, duration = 1000, targetVolume = 1.0) {
        const sound = this.playGlobal(key, false, 0.0);
        if (!sound) return;
        
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1.0);
            
            this.baseVolumes[key] = targetVolume * progress;
            sound.setVolume(this.getEffectiveVolume(key));
            
            if (progress >= 1.0) {
                clearInterval(interval);
            }
        }, 16);
    }

    /**
     * Fade out and stop a sound gradually
     * @param {string} key - Sound identifier
     * @param {number} duration - Fade duration in milliseconds
     */
    fadeOut(key, duration = 1000) {
        const sound = this.activeSounds[key];
        if (!sound || !sound.isPlaying) return;
        
        const startVolume = this.baseVolumes[key] || 1.0;
        const startTime = Date.now();
        
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1.0);
            
            this.baseVolumes[key] = startVolume * (1.0 - progress);
            sound.setVolume(this.getEffectiveVolume(key));
            
            if (progress >= 1.0) {
                clearInterval(interval);
                this.stop(key);
            }
        }, 16);
    }
}