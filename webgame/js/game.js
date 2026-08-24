/**
 * Main Web Game Engine using Three.js & G1 Kinematics
 * Renders the exact high-fidelity Unitree G1 robot STL meshes from the repository.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
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

    const stlLoader = new STLLoader();

    // High fidelity materials matching G1 official design
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.4, metalness: 0.8 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc0c6ce, roughness: 0.3, metalness: 0.9 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x76b900, roughness: 0.2, metalness: 0.5, emissive: 0x112200 });

    const loadMesh = (filename, material, parent, pos = [0, 0, 0], rot = [0, 0, 0]) => {
      const meshGroup = new THREE.Group();
      meshGroup.position.set(...pos);
      meshGroup.rotation.set(...rot);
      parent.add(meshGroup);

      stlLoader.load(`webgame/assets/stl/${filename}`, (geometry) => {
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshGroup.add(mesh);
      }, undefined, (err) => {
        console.warn(`Fallback for STL ${filename}:`, err);
      });

      return meshGroup;
    };

    // Root / Pelvis
    this.pelvis = new THREE.Group();
    this.robotGroup.add(this.pelvis);
    loadMesh('pelvis.STL', darkMat, this.pelvis);
    loadMesh('pelvis_contour_link.STL', silverMat, this.pelvis);

    // Torso
    this.torso = new THREE.Group();
    this.torso.position.set(-0.0039635, 0, 0.054);
    this.pelvis.add(this.torso);

    loadMesh('torso_link.STL', silverMat, this.torso);
    loadMesh('logo_link.STL', accentMat, this.torso, [0.0039635, 0, -0.054]);
    loadMesh('head_link.STL', darkMat, this.torso, [0.0039635, 0, -0.054]);
    loadMesh('waist_support_link.STL', silverMat, this.torso, [0.0039635, 0, -0.054]);

    // Helper for creating leg hierarchy with exact STL meshes
    const createLeg = (isLeft) => {
      const side = isLeft ? 1 : -1;
      const sideName = isLeft ? 'left' : 'right';

      const hipPitchGroup = new THREE.Group();
      hipPitchGroup.position.set(0, 0.064452 * side, -0.1027);
      this.pelvis.add(hipPitchGroup);
      loadMesh(`${sideName}_hip_pitch_link.STL`, darkMat, hipPitchGroup);

      const hipRollGroup = new THREE.Group();
      hipRollGroup.position.set(0, 0.052 * side, -0.030465);
      hipPitchGroup.add(hipRollGroup);
      loadMesh(`${sideName}_hip_roll_link.STL`, silverMat, hipRollGroup);

      const hipYawGroup = new THREE.Group();
      hipYawGroup.position.set(0.025001, 0, -0.12412);
      hipRollGroup.add(hipYawGroup);
      loadMesh(`${sideName}_hip_yaw_link.STL`, silverMat, hipYawGroup);

      const kneeGroup = new THREE.Group();
      kneeGroup.position.set(-0.078273, 0.0021489 * side, -0.17734);
      hipYawGroup.add(kneeGroup);
      loadMesh(`${sideName}_knee_link.STL`, silverMat, kneeGroup);

      const anklePitchGroup = new THREE.Group();
      anklePitchGroup.position.set(0, -9.4445e-05 * side, -0.30001);
      kneeGroup.add(anklePitchGroup);
      loadMesh(`${sideName}_ankle_pitch_link.STL`, silverMat, anklePitchGroup);

      const ankleRollGroup = new THREE.Group();
      ankleRollGroup.position.set(0, 0, -0.017558);
      anklePitchGroup.add(ankleRollGroup);
      loadMesh(`${sideName}_ankle_roll_link.STL`, darkMat, ankleRollGroup);

      return { hipPitchGroup, hipRollGroup, hipYawGroup, kneeGroup, anklePitchGroup, ankleRollGroup };
    };

    // Helper for creating arm hierarchy with exact STL meshes
    const createArm = (isLeft) => {
      const side = isLeft ? 1 : -1;
      const sideName = isLeft ? 'left' : 'right';

      const shoulderPitchGroup = new THREE.Group();
      shoulderPitchGroup.position.set(0.0039563, 0.10022 * side, 0.23778);
      this.torso.add(shoulderPitchGroup);
      loadMesh(`${sideName}_shoulder_pitch_link.STL`, silverMat, shoulderPitchGroup);

      const shoulderRollGroup = new THREE.Group();
      shoulderRollGroup.position.set(0, 0.038 * side, -0.013831);
      shoulderPitchGroup.add(shoulderRollGroup);
      loadMesh(`${sideName}_shoulder_roll_link.STL`, silverMat, shoulderRollGroup);

      const shoulderYawGroup = new THREE.Group();
      shoulderYawGroup.position.set(0, 0.00624 * side, -0.1032);
      shoulderRollGroup.add(shoulderYawGroup);
      loadMesh(`${sideName}_shoulder_yaw_link.STL`, silverMat, shoulderYawGroup);

      const elbowGroup = new THREE.Group();
      elbowGroup.position.set(0.015783, 0, -0.080518);
      shoulderYawGroup.add(elbowGroup);
      loadMesh(`${sideName}_elbow_link.STL`, silverMat, elbowGroup);

      const wristRollGroup = new THREE.Group();
      wristRollGroup.position.set(0.1, 0.00188791 * side, -0.01);
      elbowGroup.add(wristRollGroup);
      loadMesh(`${sideName}_wrist_roll_link.STL`, silverMat, wristRollGroup);

      const wristPitchGroup = new THREE.Group();
      wristPitchGroup.position.set(0.038, 0, 0);
      wristRollGroup.add(wristPitchGroup);
      loadMesh(`${sideName}_wrist_pitch_link.STL`, silverMat, wristPitchGroup);

      const wristYawGroup = new THREE.Group();
      wristYawGroup.position.set(0.046, 0, 0);
      wristPitchGroup.add(wristYawGroup);
      loadMesh(`${sideName}_wrist_yaw_link.STL`, silverMat, wristYawGroup);
      loadMesh(`${sideName}_rubber_hand.STL`, darkMat, wristYawGroup, [0.0415, 0.003 * side, 0]);

      return { shoulderPitchGroup, shoulderRollGroup, shoulderYawGroup, elbowGroup, wristRollGroup, wristPitchGroup, wristYawGroup };
    };

    this.leftLeg = createLeg(true);
    this.rightLeg = createLeg(false);
    this.leftArm = createArm(true);
    this.rightArm = createArm(false);
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

    // Apply joint angles to STL Robot mesh hierarchy
    this.pelvis.position.y = this.kinematics.rootHeight;
    this.pelvis.rotation.x = this.kinematics.rootPitch;
    this.pelvis.rotation.z = this.kinematics.rootRoll;

    this.torso.rotation.y = j.waist_yaw;
    this.torso.rotation.x = j.waist_pitch;

    // Left Leg
    this.leftLeg.hipPitchGroup.rotation.y = j.left_hip_pitch;
    this.leftLeg.hipRollGroup.rotation.x = j.left_hip_roll;
    this.leftLeg.hipYawGroup.rotation.z = j.left_hip_yaw;
    this.leftLeg.kneeGroup.rotation.y = j.left_knee;
    this.leftLeg.anklePitchGroup.rotation.y = j.left_ankle_pitch;
    this.leftLeg.ankleRollGroup.rotation.x = j.left_ankle_roll;

    // Right Leg
    this.rightLeg.hipPitchGroup.rotation.y = j.right_hip_pitch;
    this.rightLeg.hipRollGroup.rotation.x = j.right_hip_roll;
    this.rightLeg.hipYawGroup.rotation.z = j.right_hip_yaw;
    this.rightLeg.kneeGroup.rotation.y = j.right_knee;
    this.rightLeg.anklePitchGroup.rotation.y = j.right_ankle_pitch;
    this.rightLeg.ankleRollGroup.rotation.x = j.right_ankle_roll;

    // Left Arm
    this.leftArm.shoulderPitchGroup.rotation.y = j.left_shoulder_pitch;
    this.leftArm.shoulderRollGroup.rotation.x = j.left_shoulder_roll;
    this.leftArm.shoulderYawGroup.rotation.z = j.left_shoulder_yaw;
    this.leftArm.elbowGroup.rotation.y = j.left_elbow;

    // Right Arm
    this.rightArm.shoulderPitchGroup.rotation.y = j.right_shoulder_pitch;
    this.rightArm.shoulderRollGroup.rotation.x = j.right_shoulder_roll;
    this.rightArm.shoulderYawGroup.rotation.z = j.right_shoulder_yaw;
    this.rightArm.elbowGroup.rotation.y = j.right_elbow;

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
