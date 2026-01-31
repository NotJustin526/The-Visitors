import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

export class AssetManager {
    constructor(loadingManager) {
        this.colliders = [];
        this.refs = {}; 
        this.texLoader = new THREE.TextureLoader(loadingManager); 
        this.gltfLoader = new GLTFLoader(loadingManager);
        console.log("✅ AssetManager initialized");
    }

    createCollider(x, z, width, depth) {
        const box = new THREE.Box3();
        box.setFromCenterAndSize(new THREE.Vector3(x, 2.5, z), new THREE.Vector3(width, 5, depth));
        this.colliders.push(box);
    }

    loadMaterialSet(baseName, repeat = 1) {
        const colorMap = this.texLoader.load(`assets/textures/${baseName}_color.jpg`);
        const normalMap = this.texLoader.load(`assets/textures/${baseName}_normal.jpg`);
        const roughMap = this.texLoader.load(`assets/textures/${baseName}_rough.jpg`);
        const aoMap = this.texLoader.load(`assets/textures/${baseName}_ao.png`); 
        
        [colorMap, normalMap, roughMap, aoMap].forEach(tex => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(repeat, repeat);
        });

        colorMap.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorMap,
            normalMap: normalMap,
            roughnessMap: roughMap,
            aoMap: aoMap,            
            aoMapIntensity: 1.0,     
            roughness: 1.0, 
            color: 0xffffff
        });
    }

    loadProp(path, parent, pos = [0,0,0], rot = [0,0,0], scale = [1,1,1], overrideMat = null) {
        this.gltfLoader.load(path, (gltf) => {
            const model = gltf.scene;
            
            model.position.set(pos[0], pos[1], pos[2]);
            model.rotation.set(rot[0], rot[1], rot[2]);
            model.scale.set(scale[0], scale[1], scale[2]);

            // --- DEBUG SIZE LOGGING ---
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            // console.log(`📏 MODEL LOADED: ${path} | Size: ${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}`);
            // ---------------------------

            model.traverse((child) => {
                if (child.isMesh) {
                    if (overrideMat) child.material = overrideMat;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if(child.material) child.material.envMapIntensity = 1.0;
                }
            });

            parent.add(model);
        }, undefined, (error) => {
            console.error(`❌ FAILED TO LOAD MODEL: ${path}`, error);
        });
    }

    createPlayerBody() {
        const bodyGroup = new THREE.Group();
        // Empty group for player logic (no visible mesh, no procedural legs)
        return { mesh: bodyGroup };
    }

    initWorld(scene) {
        try {
            // --- NOISE GENERATION REMOVED (Handled by CSS now) ---

            const spawn = (geo, mat, parent, pos = [0,0,0], rot = [0,0,0], scale = [1,1,1]) => {
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(pos[0], pos[1], pos[2]);
                mesh.rotation.set(rot[0], rot[1], rot[2]);
                mesh.scale.set(scale[0], scale[1], scale[2]);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                parent.add(mesh);
                return mesh;
            };

            const createPainting = (texName, parent, pos, rot, size=[1.5, 2, 0.1]) => {
                const grp = new THREE.Group();
                grp.position.set(pos[0], pos[1], pos[2]);
                grp.rotation.set(rot[0], rot[1], rot[2]);
                spawn(new THREE.BoxGeometry(size[0], size[1], size[2]), this.refs.materials.paintFrameMat, grp);
                const pTex = this.texLoader.load(`assets/textures/${texName}`);
                pTex.colorSpace = THREE.SRGBColorSpace;
                const canvasMat = new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.8 });
                spawn(new THREE.PlaneGeometry(size[0]-0.2, size[1]-0.2), canvasMat, grp, [0, 0, size[2]/2 + 0.01]);
                parent.add(grp);
            };

            const floorMat = this.loadMaterialSet('floor', 4); 
            const wallMat = this.loadMaterialSet('wall', 3);
            const ceilMat = this.loadMaterialSet('ceiling', 3);
            
            // --- REMOVED: deskPBRMat loading (Deleted per request) ---
            
            const doorPBRMat = this.loadMaterialSet('door', 1);
            const tileMat = this.loadMaterialSet('tile', 2);

            // --- KEPT: Desktop Texture for Laptop Screen ---
            const desktopTex = this.texLoader.load('assets/textures/desktop.png'); 
            desktopTex.colorSpace = THREE.SRGBColorSpace;

            const rugTex = this.texLoader.load('assets/textures/rug.png');
            const faceTex = this.texLoader.load('assets/textures/entity_face.png'); faceTex.colorSpace = THREE.SRGBColorSpace;
            const skinTex = this.texLoader.load('assets/textures/entity_skin.png'); skinTex.colorSpace = THREE.SRGBColorSpace;

            const mats = {
                wallsMat: wallMat,
                floorMat: floorMat,
                ceilMat: ceilMat,
                bathFloorMat: tileMat,
                doorWoodMat: doorPBRMat,
                // --- REMOVED: deskMat (Deleted per request) ---
                rugMat: new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1.0, bumpMap: rugTex, bumpScale: 0.05 }),
                trimMat: new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.BackSide }),
                panelMat: new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 }),
                frameMatBed: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }),
                cLeather: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }), 
                cPlastic: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }), 
                cMetal: new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 }),
                legMatDesk: new THREE.MeshStandardMaterial({ color: 0x111111 }),
                lapMat: new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9, metalness: 0.1 }),
                brassMat: new THREE.MeshStandardMaterial({ color: 0xbfa842, metalness: 0.8, roughness: 0.3 }),
                glassMat: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffaa00, emissiveIntensity: 1.0, transparent: true, opacity: 0.9, roughness: 0.1, metalness: 0.1 }),
                kGlassMat: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffaa00, emissiveIntensity: 1.0, transparent: true, opacity: 0.9, roughness: 0.1, metalness: 0.1 }),
                winGlassMat: new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.1, roughness: 0.1, metalness: 0.9 }),
                cEyeMat: new THREE.MeshBasicMaterial({ color: 0xff0000 }), 
                keyMat: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }), 
                paintFrameMat: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }), 
                wheelMat: new THREE.MeshStandardMaterial({ color: 0xdddddd, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.5 }),
                holeMat: new THREE.MeshBasicMaterial({ color: 0x000000 }),
                cordMat: new THREE.MeshBasicMaterial({ color: 0x333333 }),
                slatMatW: new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 }),
                casingMat: new THREE.MeshStandardMaterial({ color: 0x909090 }),
                phone: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.5 }),
                whiteCeramic: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
                chrome: new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 }),
                mirror: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.0 }),
                tvScreen: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 }),
                fridgeMat: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }),
                monsterSkin: new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.7, color: 0x888888 }), 
                monsterFace: [
                    new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.7, color: 0x888888 }), 
                    new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.7, color: 0x888888 }), 
                    new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.7, color: 0x888888 }), 
                    new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.7, color: 0x888888 }), 
                    new THREE.MeshBasicMaterial({ map: faceTex }), 
                    new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.7, color: 0x888888 }), 
                ],
                rainVertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                rainFragmentShader: `uniform float uTime; uniform float uSpeed; uniform float uOpacity; uniform vec3 uColor; varying vec2 vUv;
                vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx+p3.yz)*p3.zy); }
                float Layer(vec2 uv, float t) { vec2 aspect = vec2(3.0, 1.0); vec2 uv2 = uv * vec2(50.0, 10.0); vec2 id = floor(uv2); uv2.y += t * hash22(id).y; 
                vec2 gv = fract(uv2) - 0.5; id = floor(uv2); vec2 n = hash22(id); float dropTime = fract(t + n.x * 10.0); float yPos = -0.5 + pow(dropTime, 3.0); float xPos = (n.x - 0.5) * 0.4; 
                vec2 dropPos = (gv - vec2(xPos, yPos)) / aspect; float drop = smoothstep(0.04, 0.02, length(dropPos)); vec2 trailPos = (gv - vec2(xPos, yPos)) / aspect; trailPos.y = (fract(trailPos.y * 10.0) - 0.5) / 10.0;
                float trail = smoothstep(0.02, 0.01, length(trailPos)); trail *= smoothstep(yPos, yPos + 0.5, gv.y); return drop + trail * 0.7; }
                void main() { vec2 uv = vUv; uv.y = 1.0 - uv.y; float t = uTime * uSpeed; float rain = 0.0; rain += Layer(uv, t); rain += Layer(uv * 1.5 + 5.0, t * 1.2); vec3 col = uColor * rain; gl_FragColor = vec4(col, rain * uOpacity); }`
            };
            mats.rainGlassMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0.0 }, uSpeed: { value: 1.0 }, uOpacity: { value: 0.75 }, uColor: { value: new THREE.Color(0xadb9c4) } }, vertexShader: mats.rainVertexShader, fragmentShader: mats.rainFragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending });
            this.refs.materials = mats;

            const geos = { legBed: new THREE.BoxGeometry(0.2, 0.8, 0.2), legDesk: new THREE.BoxGeometry(0.1, 1.5, 0.1), slatC: new THREE.BoxGeometry(0.02, 0.15, 0.85), slatW: new THREE.BoxGeometry(3, 0.12, 0.05), cord: new THREE.CylinderGeometry(0.01, 0.01, 4), rain: new THREE.PlaneGeometry(3.0, 4.0), spoke: new THREE.BoxGeometry(0.06, 0.05, 0.7), wheel: new THREE.CylinderGeometry(0.06, 0.06, 0.05), armSup: new THREE.CylinderGeometry(0.03, 0.03, 0.35), armPad: new THREE.BoxGeometry(0.1, 0.05, 0.5), key: new THREE.BoxGeometry(0.045, 0.01, 0.045), modKey: new THREE.BoxGeometry(0.06, 0.01, 0.045), space: new THREE.BoxGeometry(0.35, 0.01, 0.045), pad: new THREE.BoxGeometry(0.25, 0.005, 0.15), hole: new THREE.TorusGeometry(0.015, 0.003, 8, 16) };
            const groups = { door: new THREE.Group(), bathDoor: new THREE.Group(), closet: new THREE.Group(), closetDoor: new THREE.Group(), closetPivot: new THREE.Group(), window: new THREE.Group(), blinds: new THREE.Group(), bed: new THREE.Group(), desk: new THREE.Group(), chair: new THREE.Group(), laptop: new THREE.Group(), phone: new THREE.Group(), clock: new THREE.Group(), light: new THREE.Group(), switch: new THREE.Group(), hallway: new THREE.Group(), living: new THREE.Group(), kitchen: new THREE.Group(), bath: new THREE.Group(), kLight: new THREE.Group(), kSwitch: new THREE.Group() };

            const floorMesh = spawn(new THREE.PlaneGeometry(15, 15), mats.floorMat, scene, [0, 0.01, 0], [-Math.PI/2, 0, 0]);
            const ceilMesh = spawn(new THREE.PlaneGeometry(15, 15), mats.ceilMat, scene, [0, 9.99, 0], [Math.PI/2, 0, 0]);
            
            const backWallShape = new THREE.Shape(); backWallShape.moveTo(-7.5, 0); backWallShape.lineTo(7.5, 0); backWallShape.lineTo(7.5, 10); backWallShape.lineTo(-7.5, 10); backWallShape.lineTo(-7.5, 0);
            const doorPath = new THREE.Path(); doorPath.moveTo(-1.5, 0); doorPath.lineTo(1.5, 0); doorPath.lineTo(1.5, 5.2); doorPath.lineTo(-1.5, 5.2); doorPath.lineTo(-1.5, 0); backWallShape.holes.push(doorPath);
            const backWall = new THREE.Mesh(new THREE.ShapeGeometry(backWallShape), mats.wallsMat); backWall.position.set(0, 0, -7.5); backWall.receiveShadow = true; scene.add(backWall);
            spawn(new THREE.PlaneGeometry(15, 10), mats.wallsMat, scene, [0, 5, 7.5], [0, Math.PI, 0]);
            
            const leftWallShape = new THREE.Shape(); leftWallShape.moveTo(-7.5, 0); leftWallShape.lineTo(7.5, 0); leftWallShape.lineTo(7.5, 10); leftWallShape.lineTo(-7.5, 10); leftWallShape.lineTo(-7.5, 0);
            const closetPath = new THREE.Path(); closetPath.moveTo(-2, 0); closetPath.lineTo(2, 0); closetPath.lineTo(2, 6); closetPath.lineTo(-2, 6); closetPath.lineTo(-2, 0); leftWallShape.holes.push(closetPath);
            const leftWall = new THREE.Mesh(new THREE.ShapeGeometry(leftWallShape), mats.wallsMat); leftWall.rotation.y = Math.PI/2; leftWall.position.set(-7.5, 0, 0); leftWall.receiveShadow = true; scene.add(leftWall);
            
            const rightWallShape = new THREE.Shape(); rightWallShape.moveTo(-7.5, 0); rightWallShape.lineTo(7.5, 0); rightWallShape.lineTo(7.5, 10); rightWallShape.lineTo(-7.5, 10); rightWallShape.lineTo(-7.5, 0);
            const winPath = new THREE.Path(); winPath.moveTo(-1.5, 2); winPath.lineTo(1.5, 2); winPath.lineTo(1.5, 6); winPath.lineTo(-1.5, 6); winPath.lineTo(-1.5, 2); rightWallShape.holes.push(winPath);
            const rightWall = new THREE.Mesh(new THREE.ShapeGeometry(rightWallShape), mats.wallsMat); rightWall.rotation.y = -Math.PI/2; rightWall.position.set(7.5, 0, 0); rightWall.receiveShadow = true; scene.add(rightWall);
            
            spawn(new THREE.BoxGeometry(15, 0.4, 15), mats.trimMat, scene, [0, 0.2, 0]);
            this.refs.audioProxy = spawn(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ visible: false }), scene, [20, 0, 0]);

            groups.hallway.position.set(0, 0, -7.5); scene.add(groups.hallway);
            spawn(new THREE.PlaneGeometry(3, 20), mats.floorMat, groups.hallway, [0, 0.01, -10], [-Math.PI/2, 0, 0]); 
            spawn(new THREE.PlaneGeometry(3, 20), mats.ceilMat, groups.hallway, [0, 5, -10], [Math.PI/2, 0, 0]);   
            spawn(new THREE.PlaneGeometry(20, 10), mats.wallsMat, groups.hallway, [1.5, 5, -10], [0, -Math.PI/2, 0]); 
            spawn(new THREE.PlaneGeometry(13.5, 10), mats.wallsMat, groups.hallway, [-1.5, 5, -6.75], [0, Math.PI/2, 0]); 
            spawn(new THREE.PlaneGeometry(3.5, 10), mats.wallsMat, groups.hallway, [-1.5, 5, -18.25], [0, Math.PI/2, 0]); 
            spawn(new THREE.PlaneGeometry(3, 4.8), mats.wallsMat, groups.hallway, [-1.5, 7.6, -15.0], [0, Math.PI/2, 0]); 

            groups.bath.position.set(-5.5, 0, -22.5); scene.add(groups.bath);
            spawn(new THREE.PlaneGeometry(8, 8), mats.bathFloorMat, groups.bath, [0, 0.01, 0], [-Math.PI/2, 0, 0]);
            spawn(new THREE.PlaneGeometry(8, 8), mats.ceilMat, groups.bath, [0, 5, 0], [Math.PI/2, 0, 0]);
            spawn(new THREE.PlaneGeometry(8, 10), mats.wallsMat, groups.bath, [0, 5, -4], [0, 0, 0]); 
            spawn(new THREE.PlaneGeometry(8, 10), mats.wallsMat, groups.bath, [-4, 5, 0], [0, Math.PI/2, 0]); 
            spawn(new THREE.PlaneGeometry(8, 10), mats.wallsMat, groups.bath, [0, 5, 4], [0, Math.PI, 0]); 
            spawn(new THREE.PlaneGeometry(2.5, 10), mats.wallsMat, groups.bath, [4, 5, -2.75], [0, -Math.PI/2, 0]);
            spawn(new THREE.PlaneGeometry(2.5, 10), mats.wallsMat, groups.bath, [4, 5, 2.75], [0, -Math.PI/2, 0]);
            spawn(new THREE.PlaneGeometry(3, 4.8), mats.wallsMat, groups.bath, [4, 7.6, 0], [0, -Math.PI/2, 0]);
            
            // --- 3D MODELS FOR BATHROOM ---
            // 1. BATHTUB SHOWER 
            // Position: [-0.3, 0, 2.0]
            this.loadProp('assets/models/bath_shower.glb', groups.bath, [-0.3, 0, 2.0], [0, Math.PI / 2, 0], [2.4, 2.4, 2.4]);

            // 2. TOILET 
            const toiletGroup = new THREE.Group(); toiletGroup.position.set(3, 0, -3); groups.bath.add(toiletGroup);
            spawn(new THREE.CylinderGeometry(0.4, 0.35, 0.5), mats.whiteCeramic, toiletGroup, [0, 0.25, 0]);
            spawn(new THREE.BoxGeometry(0.8, 0.6, 0.3), mats.whiteCeramic, toiletGroup, [0, 0.8, -0.4]);
            spawn(new THREE.BoxGeometry(0.5, 0.05, 0.6), mats.whiteCeramic, toiletGroup, [0, 0.5, 0.1]);

            // 3. SINK (POS: 0, 1.8, -2.7)
            this.loadProp('assets/models/sink.glb', groups.bath, [0, 1.8, -2.7], [0, Math.PI * 1.5, 0], [0.035, 0.035, 0.035]);

            // 4. MIRROR (With Real-Time Reflection)
            const mirrorGroup = new THREE.Group();
            mirrorGroup.position.set(0, 3.6, -3.95);
            mirrorGroup.scale.set(1.8, 1.8, 1.8);
            groups.bath.add(mirrorGroup);

            // A. Load the Frame Model
            this.gltfLoader.load('assets/models/mirror.glb', (gltf) => {
                const model = gltf.scene;
                // Basic cleanup of the model
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                mirrorGroup.add(model);
            });

            // B. Create the Reflector (The "Glass")
            const mirrorGeo = new THREE.PlaneGeometry(0.75, 1.1); // Width 0.75, Height 1.1
            const mirrorReflector = new Reflector(mirrorGeo, {
                clipBias: 0.003,
                textureWidth: 2048, // High Res for "Good" quality
                textureHeight: 2048,
                color: 0x889999    // Slight blue-grey tint for realism
            });
            // MOVE REFLECTOR FORWARD to overlay on the screen (set to 0.095)
            mirrorReflector.position.set(0, 0, 0.095); 
            mirrorGroup.add(mirrorReflector);


            const bathDoorPivot = new THREE.Group(); bathDoorPivot.position.set(-1.5, 0, -21.0); scene.add(bathDoorPivot);
            const bCol = spawn(new THREE.BoxGeometry(0.5, 5.0, 3.0), new THREE.MeshBasicMaterial({visible:false}), bathDoorPivot, [0, 2.5, -1.5]);
            spawn(new THREE.BoxGeometry(3.0, 5.0, 0.15), mats.doorWoodMat, bathDoorPivot, [0, 2.5, -1.5], [0, Math.PI/2, 0]); 
            const bKnobGroup = new THREE.Group(); bKnobGroup.position.set(0, 2.5, -2.6); bKnobGroup.rotation.y = Math.PI/2; bathDoorPivot.add(bKnobGroup);
            spawn(new THREE.CylinderGeometry(0.12, 0.15, 0.02, 16), mats.brassMat, bKnobGroup, [0,0,0], [Math.PI/2, 0, 0]); 
            spawn(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), mats.brassMat, bKnobGroup, [0,0,0.06], [Math.PI/2,0,0]); 
            spawn(new THREE.SphereGeometry(0.14, 32, 32), mats.brassMat, bKnobGroup, [0,0,0.16], [0,0,0], [1,1,0.8]); 
            spawn(new THREE.CylinderGeometry(0.12, 0.15, 0.02, 16), mats.brassMat, bKnobGroup, [0,0,-0.16], [Math.PI/2, 0, 0]); 
            spawn(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), mats.brassMat, bKnobGroup, [0,0,-0.22], [Math.PI/2,0,0]); 
            spawn(new THREE.SphereGeometry(0.14, 32, 32), mats.brassMat, bKnobGroup, [0,0,-0.32], [0,0,0], [1,1,0.8]); 
            bCol.userData = { type: 'BATHROOM_DOOR' };
            this.refs.bathPivot = bathDoorPivot; this.refs.bathCollider = bCol;

            groups.living.position.set(0, 0, -35.0); scene.add(groups.living);
            spawn(new THREE.PlaneGeometry(20, 20), mats.floorMat, groups.living, [0, 0.01, 0], [-Math.PI/2, 0, 0]);
            spawn(new THREE.PlaneGeometry(20, 20), mats.ceilMat, groups.living, [0, 10, 0], [Math.PI/2, 0, 0]);
            spawn(new THREE.PlaneGeometry(20, 10), mats.wallsMat, groups.living, [0, 5, -10]); 
            spawn(new THREE.PlaneGeometry(20, 10), mats.wallsMat, groups.living, [-10, 5, 0], [0, Math.PI/2, 0]); 
            const couch = new THREE.Group(); couch.position.set(0, 0, 5); groups.living.add(couch);
            spawn(new THREE.BoxGeometry(6, 1, 2), mats.cLeather, couch, [0, 0.5, 0]); 
            spawn(new THREE.BoxGeometry(6, 2, 0.5), mats.cLeather, couch, [0, 1, 1]); 
            spawn(new THREE.BoxGeometry(1, 1.5, 2.5), mats.cLeather, couch, [-3.5, 0.75, 0]); 
            spawn(new THREE.BoxGeometry(1, 1.5, 2.5), mats.cLeather, couch, [3.5, 0.75, 0]); 
            spawn(new THREE.BoxGeometry(4, 1, 1.5), mats.doorWoodMat, groups.living, [0, 0.5, -9]);
            spawn(new THREE.BoxGeometry(3.5, 2, 0.2), mats.tvScreen, groups.living, [0, 2, -9]);

            groups.kitchen.position.set(15, 0, -35.0); scene.add(groups.kitchen);
            spawn(new THREE.PlaneGeometry(10, 20), mats.bathFloorMat, groups.kitchen, [0, 0.01, 0], [-Math.PI/2, 0, 0]);
            spawn(new THREE.PlaneGeometry(10, 20), mats.ceilMat, groups.kitchen, [0, 10, 0], [Math.PI/2, 0, 0]);
            spawn(new THREE.PlaneGeometry(20, 10), mats.wallsMat, groups.kitchen, [5, 5, 0], [0, -Math.PI/2, 0]); 
            spawn(new THREE.PlaneGeometry(10, 10), mats.wallsMat, groups.kitchen, [0, 5, -10]); 
            spawn(new THREE.BoxGeometry(2, 4, 2), mats.fridgeMat, groups.kitchen, [3, 2, -8]); 
            spawn(new THREE.BoxGeometry(8, 2, 2), mats.whiteCeramic, groups.kitchen, [-1, 1, -8]); 
            spawn(new THREE.BoxGeometry(2, 2, 2), mats.chrome, groups.kitchen, [-3, 1, -8]); 

            groups.closet.position.set(-8.5, 3.0, 0); scene.add(groups.closet);
            spawn(new THREE.BoxGeometry(2, 6, 4), new THREE.MeshStandardMaterial({color:0x050505, side: THREE.BackSide}), groups.closet);
            const cEyesGroup = new THREE.Group(); cEyesGroup.position.set(0.2, 1.5, 0); cEyesGroup.visible = false; groups.closet.add(cEyesGroup);
            spawn(new THREE.SphereGeometry(0.05), mats.cEyeMat, cEyesGroup, [0,0,-0.15]);
            spawn(new THREE.SphereGeometry(0.05), mats.cEyeMat, cEyesGroup, [0,0,0.15]);
            this.refs.cEyes = cEyesGroup;
            groups.closetPivot.position.set(-7.5, 0, -2.0); scene.add(groups.closetPivot);
            groups.closetPivot.add(groups.closetDoor);
            spawn(new THREE.BoxGeometry(0.15, 6, 0.2), mats.doorWoodMat, groups.closetDoor, [0, 3, 0.1]); 
            spawn(new THREE.BoxGeometry(0.15, 6, 0.2), mats.doorWoodMat, groups.closetDoor, [0, 3, 3.9]);
            spawn(new THREE.BoxGeometry(0.15, 0.2, 4.0), mats.doorWoodMat, groups.closetDoor, [0, 5.9, 2.0]);
            spawn(new THREE.BoxGeometry(0.15, 0.2, 4.0), mats.doorWoodMat, groups.closetDoor, [0, 0.1, 2.0]);
            for(let i=0; i<25; i++) spawn(geos.slatC, mats.doorWoodMat, groups.closetDoor, [0, 0.5 + (i * 0.22), 2.0], [0,0,-0.5], [1, 1, 4.2]);
            this.refs.closetCollider = spawn(new THREE.BoxGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ visible: false }), scene, [-7.5, 3, 0]);
            this.refs.closetCollider.userData = { type: 'CLOSET' };
            this.refs.closetPivot = groups.closetPivot; 
            this.refs.closetGroup = groups.closet;
            this.refs.closetDoor = groups.closetDoor; 

            // --- BEDROOM DOOR REPLACEMENT ---
            
            // 1. RE-ADD THE DOOR FRAME (CASING) - RESET TO ORIGINAL 3.0 WIDTH
            groups.door.position.set(0, 2.5, -7.5); 
            scene.add(groups.door);
            
            // Frame Left/Right Jambs at 1.48 (Original locations for 3.0 width)
            spawn(new THREE.BoxGeometry(0.15, 5.3, 0.1), mats.casingMat, groups.door, [-1.48, 0.1, -0.05]);
            spawn(new THREE.BoxGeometry(0.15, 5.3, 0.1), mats.casingMat, groups.door, [1.48, 0.1, -0.05]);
            // Frame Header at 3.1 width (Original)
            spawn(new THREE.BoxGeometry(3.1, 0.15, 0.1), mats.casingMat, groups.door, [0, 2.7, -0.05]);

            // 2. CREATE THE HINGE (PIVOT GROUP)
            const doorPivot = new THREE.Group();
            doorPivot.position.set(-1.4, 0, 0.05); // Hinge location relative to door group (pushed back 'a hair' to 0.05)
            groups.door.add(doorPivot);

            // 3. ADD THE HITBOX (INVISIBLE)
            const doorCollider = spawn(new THREE.BoxGeometry(3.0, 5.0, 0.5), new THREE.MeshBasicMaterial({ visible: false }), groups.door);
            doorCollider.userData = { type: 'DOOR', state: 'closed', parentGroup: doorPivot };

            // 4. LOAD THE NEW DOOR MODEL (Frame-less)
            // Offset X: 1.44 (Shifted left a 'hair' to align better with frame)
            // Scale: [2.2, 2.1, 2.1] (Non-uniform scale)
            // Position Y: -2.65 (Lowered to sit on floor)
            // Position Z: 0.03 (Pushed door mesh itself back a hair relative to pivot)
            // Material: mats.doorWoodMat (Applied override)
            this.loadProp('assets/models/door.glb', doorPivot, [1.44, -2.65, 0.03], [0, -Math.PI / 2, 0], [2.2, 2.1, 2.1], mats.doorWoodMat);

            this.refs.doorCollider = doorCollider;
            this.refs.doorPivot = doorPivot;
            this.refs.doorGroup = groups.door;

            groups.window.position.set(7.35, 4, 0); groups.window.rotation.y = -Math.PI/2; scene.add(groups.window);
            spawn(new THREE.BoxGeometry(3.2, 4.2, 0.2), new THREE.MeshStandardMaterial({color:0x333333}), groups.window, [0,0,-0.15]);
            spawn(geos.rain, mats.rainGlassMat, groups.window, [0,0,-0.05]);
            groups.blinds.userData = { type: 'BLINDS' }; groups.window.add(groups.blinds);
            for (let i = 0; i < 25; i++) spawn(geos.slatW, mats.slatMatW, groups.blinds, [0, 2.0 - (i * 0.16), 0]);
            spawn(geos.cord, mats.cordMat, groups.blinds, [-1, 0, 0.06]);
            spawn(geos.cord, mats.cordMat, groups.blinds, [1, 0, 0.06]);
            this.refs.blindHitbox = spawn(new THREE.BoxGeometry(3, 4, 0.1), new THREE.MeshBasicMaterial({ visible: false }), groups.blinds);
            this.refs.blindHitbox.userData = { type: 'BLINDS' };
            this.refs.windowGroup = groups.window; this.refs.blinds = groups.blinds;

            groups.light.position.set(0, 10, 0); scene.add(groups.light);
            spawn(geos.cord, new THREE.MeshStandardMaterial({color:0x111111}), groups.light, [0,-0.75,0], [0,0,0], [1,0.4,1]);
            spawn(new THREE.CylinderGeometry(0.06, 0.06, 0.15), new THREE.MeshStandardMaterial({color:0xbfa842}), groups.light, [0,-1.55,0]);
            this.refs.bulb = spawn(new THREE.SphereGeometry(0.15, 32, 32), mats.glassMat, groups.light, [0,-1.7,0]);

            groups.switch.position.set(2.5, 3, -7.42); scene.add(groups.switch);
            spawn(new THREE.BoxGeometry(0.4, 0.6, 0.05), new THREE.MeshStandardMaterial({color:0xeeeeee}), groups.switch);
            this.refs.switchToggle = spawn(new THREE.BoxGeometry(0.1, 0.2, 0.1), new THREE.MeshStandardMaterial({color:0xffffff}), groups.switch, [0,0,0.05]);
            this.refs.switchCollider = spawn(new THREE.BoxGeometry(0.5, 0.7, 0.2), new THREE.MeshBasicMaterial({visible:false}), groups.switch);
            this.refs.switchCollider.userData = {type:'SWITCH'};

            groups.bed.position.set(-4.5, 0.0, 5.5); 
            groups.bed.rotation.y = Math.PI; 
            scene.add(groups.bed);

            this.loadProp('assets/models/bed.glb', groups.bed, [0, 0, 0], [0, 0, 0], [0.023, 0.023, 0.023]);

            spawn(new THREE.BoxGeometry(9, 0.02, 12), mats.rugMat, scene, [0, 0.035, 0]);

            groups.desk.position.set(5, 0, 3); groups.desk.rotation.y = -Math.PI / 4; scene.add(groups.desk);
            
            // --- DESK REPLACEMENT ---
            // SCALE: 2.1
            // POS: [0, 0.0, 0] (Raised to 0.0)
            this.loadProp('assets/models/desk.glb', groups.desk, [0, 0.0, 0], [0, 0, 0], [2.1, 2.1, 2.1]);

            // --- CHAIR REPLACEMENT ---
            // Group Position: X moved RIGHT (2.5 -> 2.6), Z (1.2)
            // Group Rotation: Turned Clockwise (Math.PI / 2)
            groups.chair.position.set(2.6, 0, 1.2); 
            groups.chair.rotation.y = Math.PI / 2; 
            groups.desk.add(groups.chair);

            // Load Chair Model
            // SCALE: 0.025 
            // POS: [0, 0.3, 0]
            this.loadProp('assets/models/chair.glb', groups.chair, [0, 0.3, 0], [0, 0, 0], [0.025, 0.025, 0.025]);

            groups.laptop.position.set(0, 1.55, 0); groups.desk.add(groups.laptop);
            const base = spawn(new THREE.BoxGeometry(0.8, 0.05, 0.6), mats.lapMat, groups.laptop, [0,0,-0.04]);
            const lid = spawn(new THREE.BoxGeometry(0.8, 0.05, 0.6), mats.lapMat, groups.laptop, [0, 0.3, -0.40], [Math.PI/2 - 0.3, 0, 0]);
            
            // --- UPDATED: Using desktopTex for the laptop screen ---
            spawn(new THREE.BoxGeometry(0.7, 0.01, 0.5), new THREE.MeshBasicMaterial({ map: desktopTex }), lid, [0, 0.026, 0]);
            
            lid.add(new THREE.PointLight(0xccccff, 0.8, 4, 2).translateX(0).translateY(0.6).translateZ(0.2));
            
            for(let i=0; i<14; i++) spawn(geos.key, mats.keyMat, base, [-0.35+(i*0.054), 0.03, -0.22]);
            for(let i=0; i<14; i++) spawn(geos.key, mats.keyMat, base, [-0.35+(i*0.054), 0.03, -0.16]);
            for(let i=0; i<14; i++) spawn(geos.key, mats.keyMat, base, [-0.35+(i*0.054), 0.03, -0.10]);
            for(let i=0; i<13; i++) spawn(geos.key, mats.keyMat, base, [-0.32+(i*0.054), 0.03, -0.04]);
            spawn(geos.pad, new THREE.MeshStandardMaterial({color:0x222222}), base, [0, 0.026, 0.08]);

            const lapCol = spawn(new THREE.BoxGeometry(1.0, 1.0, 1.0), new THREE.MeshBasicMaterial({ visible: false }), groups.desk, [0, 1.8, 0]);
            lapCol.userData = { type: 'LAPTOP' };
            this.refs.laptopCollider = lapCol;

            // --- PHONE REPLACEMENT ---
            groups.phone.position.set(1.2, 1.6, 0); 
            groups.phone.rotation.y = -Math.PI / 4; 
            groups.desk.add(groups.phone);

            // Load Phone Model - Scaled to 0.02 (Set back as requested)
            this.loadProp('assets/models/phone.glb', groups.phone, [0, 0, 0], [0, 0, 0], [0.02, 0.02, 0.02]); 

            // Preserve Phone Collider (Hitbox) - NO LIGHT LOGIC
            this.refs.phoneCollider = spawn(new THREE.BoxGeometry(0.6, 0.5, 0.6), new THREE.MeshBasicMaterial({ visible: false }), groups.phone);
            this.refs.phoneCollider.userData = { type: 'PHONE' };

            groups.clock.position.set(-1, 1.7, 0.5); 
            groups.clock.rotation.y = Math.PI * 1.5;
            groups.desk.add(groups.clock);
            spawn(new THREE.BoxGeometry(0.6, 0.3, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111 }), groups.clock);
            const clockCanvas = document.createElement('canvas'); clockCanvas.width = 256; clockCanvas.height = 128; const clockCtx = clockCanvas.getContext('2d'); 
            clockCtx.fillStyle = '#000000'; clockCtx.fillRect(0, 0, 256, 128); clockCtx.fillStyle = '#ff0000'; clockCtx.font = 'bold 60px Arial'; clockCtx.textAlign = 'center'; clockCtx.textBaseline = 'middle'; clockCtx.fillText("11:59", 128, 64);
            const clockTexture = new THREE.CanvasTexture(clockCanvas);
            spawn(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ map: clockTexture }), groups.clock, [0, 0, 0.101]);
            this.refs.clockTexture = clockTexture; this.refs.clockCtx = clockCtx;

            createPainting('painting1.png', scene, [-6.5, 3.5, 7.35], [0, Math.PI, 0]);
            createPainting('painting2.png', groups.hallway, [1.35, 3.0, -10], [0, -Math.PI/2, 0]);
            createPainting('painting3.png', groups.living, [-9.85, 3.5, 5], [0, Math.PI/2, 0]);

            this.createCollider(-4.5, 5.5, 8.0, 5.5); 
            this.createCollider(5, 3, 5.5, 4.5); 
            
            console.log("✅ AssetManager: World built successfully");
            return { colliders: this.colliders, refs: this.refs, groups: groups };
        } catch (error) { console.error("❌ AssetManager Error", error); return null; }
    }
}