/**
 * Main Web Game Engine using Three.js & G1 Kinematics
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { G1Kinematics } from './kinematics.js';

class MotionBricksGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.currentStyle = 'walk';
    this.kinematics = new G1Kinematics();

    // Input state
    this.keys = { w: false, a: false, s: false, d: false };
    this.joystickVector = { x: 0, y: 0 };
    this.characterPos = new THREE.Vector3(0, 0, 0);
    this.characterRotation = 0;

    // Performance tracking
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.fps = 60;

    this.initScene();
    this.initLighting();
    this.initGround();
    this.initCharacter();
    this.initControls();
    this.initUI();

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate(0);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);
    this.scene.fog = new THREE.FogExp2(0x0a0e17, 0.035);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 2.2, 4.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
    this.orbitControls.minDistance = 1.5;
    this.orbitControls.maxDistance = 12;
  }

  initLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    const d = 8;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Accent Rim Light (NVIDIA Green)
    const rimLight = new THREE.PointLight(0x76b900, 2, 10);
    rimLight.position.set(-3, 3, -3);
    this.scene.add(rimLight);
  }

  initGround() {
    // Grid floor
    const gridHelper = new THREE.GridHelper(50, 50, 0x76b900, 0x1f293d);
    gridHelper.position.y = 0;
    this.scene.add(gridHelper);

    // Ground plane for shadows
    const planeGeo = new THREE.PlaneGeometry(100, 100);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x0e1420,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(planeGeo, planeMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  initCharacter() {
    this.robotGroup = new THREE.Group();
    this.scene.add(this.robotGroup);

    // Materials
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.4, metalness: 0.8 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc0c6ce, roughness: 0.3, metalness: 0.9 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x76b900, roughness: 0.2, metalness: 0.5, emissive: 0x224400 });

    // Root / Pelvis
    this.pelvis = new THREE.Group();
    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.18), darkMat);
    pelvisMesh.castShadow = true;
    this.pelvis.add(pelvisMesh);
    this.robotGroup.add(this.pelvis);

    // Torso
    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.22, 0);
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.2), silverMat);
    torsoMesh.castShadow = true;
    this.torso.add(torsoMesh);

    // Head / Sensor Visor
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), darkMat);
    headMesh.position.set(0, 0.26, 0.02);
    headMesh.castShadow = true;
    this.torso.add(headMesh);

    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.02), accentMat);
    visorMesh.position.set(0, 0.26, 0.101);
    this.torso.add(visorMesh);

    this.pelvis.add(this.torso);

    // Helper for creating leg hierarchy
    const createLeg = (isLeft) => {
      const legGroup = new THREE.Group();
      const side = isLeft ? 1 : -1;
      legGroup.position.set(0.1 * side, -0.05, 0);

      const hipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.12), darkMat);
      hipMesh.castShadow = true;
      legGroup.add(hipMesh);

      const thigh = new THREE.Group();
      thigh.position.set(0, -0.05, 0);
      const thighMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.28, 0.09), silverMat);
      thighMesh.position.y = -0.12;
      thighMesh.castShadow = true;
      thigh.add(thighMesh);
      legGroup.add(thigh);

      const shin = new THREE.Group();
      shin.position.set(0, -0.28, 0);
      const shinMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), silverMat);
      shinMesh.position.y = -0.12;
      shinMesh.castShadow = true;
      shin.add(shinMesh);
      thigh.add(shin);

      const foot = new THREE.Group();
      foot.position.set(0, -0.28, 0.02);
      const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.22), darkMat);
      footMesh.position.set(0, -0.025, 0.04);
      footMesh.castShadow = true;
      foot.add(footMesh);
      shin.add(foot);

      return { legGroup, thigh, shin, foot };
    };

    // Helper for creating arm hierarchy
    const createArm = (isLeft) => {
      const armGroup = new THREE.Group();
      const side = isLeft ? 1 : -1;
      armGroup.position.set(0.18 * side, 0.12, 0);

      const shoulderMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), accentMat);
      shoulderMesh.castShadow = true;
      armGroup.add(shoulderMesh);

      const upperArm = new THREE.Group();
      const upperArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.22, 12), silverMat);
      upperArmMesh.position.y = -0.11;
      upperArmMesh.castShadow = true;
      upperArm.add(upperArmMesh);
      armGroup.add(upperArm);

      const forearm = new THREE.Group();
      forearm.position.set(0, -0.22, 0);
      const forearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.2, 12), darkMat);
      forearmMesh.position.y = -0.1;
      forearmMesh.castShadow = true;
      forearm.add(forearmMesh);
      upperArm.add(forearm);

      return { armGroup, upperArm, forearm };
    };

    this.leftLeg = createLeg(true);
    this.rightLeg = createLeg(false);
    this.pelvis.add(this.leftLeg.legGroup);
    this.pelvis.add(this.rightLeg.legGroup);

    this.leftArm = createArm(true);
    this.rightArm = createArm(false);
    this.torso.add(this.leftArm.armGroup);
    this.torso.add(this.rightArm.armGroup);
  }

  initControls() {
    // Keyboard listener
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
    });

    // Touch Virtual Joystick
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');

    if (base && stick) {
      let active = false;
      let touchId = null;
      const baseRect = base.getBoundingClientRect();
      const center = { x: baseRect.width / 2, y: baseRect.height / 2 };
      const maxRadius = baseRect.width / 2;

      const handleTouch = (clientX, clientY) => {
        const rect = base.getBoundingClientRect();
        let dx = clientX - (rect.left + rect.width / 2);
        let dy = clientY - (rect.top + rect.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxRadius) {
          dx = (dx / dist) * maxRadius;
          dy = (dy / dist) * maxRadius;
        }

        stick.style.transform = `translate(${dx}px, ${dy}px)`;
        this.joystickVector.x = dx / maxRadius;
        this.joystickVector.y = -dy / maxRadius;
      };

      base.addEventListener('touchstart', (e) => {
        active = true;
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        handleTouch(touch.clientX, touch.clientY);
      });

      window.addEventListener('touchmove', (e) => {
        if (!active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            handleTouch(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
            break;
          }
        }
      });

      const resetJoystick = () => {
        active = false;
        touchId = null;
        stick.style.transform = 'translate(0px, 0px)';
        this.joystickVector = { x: 0, y: 0 };
      };

      window.addEventListener('touchend', resetJoystick);
      window.addEventListener('touchcancel', resetJoystick);
    }
  }

  initUI() {
    const styleBtns = document.querySelectorAll('.style-btn');
    styleBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        styleBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentStyle = btn.dataset.style;
      });
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  getMovementVector() {
    let vx = 0;
    let vy = 0;

    if (this.keys.w) vy += 1;
    if (this.keys.s) vy -= 1;
    if (this.keys.a) vx -= 1;
    if (this.keys.d) vx += 1;

    // Combine keyboard and joystick
    if (Math.abs(this.joystickVector.x) > 0.1) vx = this.joystickVector.x;
    if (Math.abs(this.joystickVector.y) > 0.1) vy = this.joystickVector.y;

    return { vx, vy };
  }

  animate(time) {
    requestAnimationFrame((t) => this.animate(t));

    const seconds = time * 0.001;
    const { vx, vy } = this.getMovementVector();

    // Update Kinematics
    const j = this.kinematics.update(seconds, this.currentStyle, vx, vy, 0);

    // Apply joint angles to Three.js Robot hierarchy
    this.pelvis.position.y = this.kinematics.rootHeight;
    this.pelvis.rotation.x = this.kinematics.rootPitch;
    this.pelvis.rotation.z = this.kinematics.rootRoll;

    this.torso.rotation.y = j.waist_yaw;
    this.torso.rotation.x = j.waist_pitch;

    // Left Leg
    this.leftLeg.legGroup.rotation.x = j.left_hip_pitch;
    this.leftLeg.legGroup.rotation.z = j.left_hip_roll;
    this.leftLeg.thigh.rotation.x = j.left_knee * 0.5;
    this.leftLeg.shin.rotation.x = j.left_knee;
    this.leftLeg.foot.rotation.x = j.left_ankle_pitch;

    // Right Leg
    this.rightLeg.legGroup.rotation.x = j.right_hip_pitch;
    this.rightLeg.legGroup.rotation.z = j.right_hip_roll;
    this.rightLeg.thigh.rotation.x = j.right_knee * 0.5;
    this.rightLeg.shin.rotation.x = j.right_knee;
    this.rightLeg.foot.rotation.x = j.right_ankle_pitch;

    // Left Arm
    this.leftArm.armGroup.rotation.x = j.left_shoulder_pitch;
    this.leftArm.armGroup.rotation.z = j.left_shoulder_roll;
    this.leftArm.forearm.rotation.x = j.left_elbow;

    // Right Arm
    this.rightArm.armGroup.rotation.x = j.right_shoulder_pitch;
    this.rightArm.armGroup.rotation.z = j.right_shoulder_roll;
    this.rightArm.forearm.rotation.x = j.right_elbow;

    // Move character in world space based on direction & speed
    const moveSpeed = (this.currentStyle === 'run' ? 2.5 : 1.2) * 0.016;
    if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
      const targetAngle = Math.atan2(vx, vy);
      this.characterRotation += (targetAngle - this.characterRotation) * 0.1;
      this.robotGroup.rotation.y = this.characterRotation;

      this.characterPos.x += Math.sin(this.characterRotation) * moveSpeed;
      this.characterPos.z += Math.cos(this.characterRotation) * moveSpeed;
      this.robotGroup.position.copy(this.characterPos);

      // Smooth camera follow
      this.orbitControls.target.lerp(
        new THREE.Vector3(this.characterPos.x, this.characterPos.y + 0.8, this.characterPos.z),
        0.1
      );
    }

    this.orbitControls.update();
    this.renderer.render(this.scene, this.camera);

    // FPS Meter
    this.frameCount++;
    if (performance.now() - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = performance.now();
      const fpsElem = document.getElementById('fps-counter');
      if (fpsElem) fpsElem.innerText = `${this.fps} FPS`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new MotionBricksGame();
});
