/**
 * MotionBricks Web Engine - Three.js WebGL Client
 * Real-time rendering of the Unitree G1 Humanoid Robot with dual WASD / Mobile Touch Joystick support.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { G1Kinematics } from './kinematics.js';

class MotionBricksApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.currentStyle = 'walk';
    this.kinematics = new G1Kinematics();

    this.keys = { w: false, a: false, s: false, d: false };
    this.joystickVector = { x: 0, y: 0 };
    this.characterPos = new THREE.Vector3(0, 0, 0);
    this.characterRotation = 0;

    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.fps = 60;

    this.initScene();
    this.initLighting();
    this.initGround();
    this.initRobot();
    this.initInputControls();
    this.initUI();

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate(0);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);
    this.scene.fog = new THREE.FogExp2(0x0a0e17, 0.03);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.8, 3.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.orbitControls.minDistance = 1.2;
    this.orbitControls.maxDistance = 10;
  }

  initLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    const d = 6;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    const rimLight = new THREE.PointLight(0x76b900, 2.5, 10);
    rimLight.position.set(-3, 3, -3);
    this.scene.add(rimLight);
  }

  initGround() {
    const gridHelper = new THREE.GridHelper(50, 50, 0x76b900, 0x1f293d);
    gridHelper.position.y = 0;
    this.scene.add(gridHelper);

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

  initRobot() {
    this.robotGroup = new THREE.Group();
    this.scene.add(this.robotGroup);

    const stlLoader = new STLLoader();

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.4, metalness: 0.8 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc0c6ce, roughness: 0.3, metalness: 0.9 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x76b900, roughness: 0.2, metalness: 0.5, emissive: 0x112200 });

    const loadMesh = (filename, material, parent, pos = [0, 0, 0], rot = [0, 0, 0]) => {
      const meshGroup = new THREE.Group();
      meshGroup.position.set(pos[0], pos[2], -pos[1]);
      meshGroup.rotation.set(rot[0], rot[2], -rot[1]);
      parent.add(meshGroup);

      stlLoader.load(`/assets/stl/${filename}`, (geometry) => {
        geometry.computeVertexNormals();
        geometry.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshGroup.add(mesh);
      }, undefined, (err) => {
        console.warn(`Fallback for STL ${filename}:`, err);
      });

      return meshGroup;
    };

    // Pelvis
    this.pelvis = new THREE.Group();
    this.robotGroup.add(this.pelvis);
    loadMesh('pelvis.STL', darkMat, this.pelvis);
    loadMesh('pelvis_contour_link.STL', silverMat, this.pelvis);

    // Torso
    this.torso = new THREE.Group();
    this.torso.position.set(-0.0039635, 0.054, 0);
    this.pelvis.add(this.torso);

    loadMesh('torso_link.STL', silverMat, this.torso);
    loadMesh('logo_link.STL', accentMat, this.torso, [0.0039635, 0, -0.054]);
    loadMesh('head_link.STL', darkMat, this.torso, [0.0039635, 0, -0.054]);
    loadMesh('waist_support_link.STL', silverMat, this.torso, [0.0039635, 0, -0.054]);

    const createLeg = (isLeft) => {
      const side = isLeft ? 1 : -1;
      const sideName = isLeft ? 'left' : 'right';

      const hipPitchGroup = new THREE.Group();
      hipPitchGroup.position.set(0, -0.1027, -0.064452 * side);
      this.pelvis.add(hipPitchGroup);
      loadMesh(`${sideName}_hip_pitch_link.STL`, darkMat, hipPitchGroup);

      const hipRollGroup = new THREE.Group();
      hipRollGroup.position.set(0, -0.030465, -0.052 * side);
      hipPitchGroup.add(hipRollGroup);
      loadMesh(`${sideName}_hip_roll_link.STL`, silverMat, hipRollGroup);

      const hipYawGroup = new THREE.Group();
      hipYawGroup.position.set(0.025001, -0.12412, 0);
      hipRollGroup.add(hipYawGroup);
      loadMesh(`${sideName}_hip_yaw_link.STL`, silverMat, hipYawGroup);

      const kneeGroup = new THREE.Group();
      kneeGroup.position.set(-0.078273, -0.17734, -0.0021489 * side);
      hipYawGroup.add(kneeGroup);
      loadMesh(`${sideName}_knee_link.STL`, silverMat, kneeGroup);

      const anklePitchGroup = new THREE.Group();
      anklePitchGroup.position.set(0, -0.30001, 9.4445e-05 * side);
      kneeGroup.add(anklePitchGroup);
      loadMesh(`${sideName}_ankle_pitch_link.STL`, silverMat, anklePitchGroup);

      const ankleRollGroup = new THREE.Group();
      ankleRollGroup.position.set(0, -0.017558, 0);
      anklePitchGroup.add(ankleRollGroup);
      loadMesh(`${sideName}_ankle_roll_link.STL`, darkMat, ankleRollGroup);

      return { hipPitchGroup, hipRollGroup, hipYawGroup, kneeGroup, anklePitchGroup, ankleRollGroup };
    };

    const createArm = (isLeft) => {
      const side = isLeft ? 1 : -1;
      const sideName = isLeft ? 'left' : 'right';

      const shoulderPitchGroup = new THREE.Group();
      shoulderPitchGroup.position.set(0.0039563, 0.23778, -0.10022 * side);
      this.torso.add(shoulderPitchGroup);
      loadMesh(`${sideName}_shoulder_pitch_link.STL`, silverMat, shoulderPitchGroup);

      const shoulderRollGroup = new THREE.Group();
      shoulderRollGroup.position.set(0, -0.013831, -0.038 * side);
      shoulderPitchGroup.add(shoulderRollGroup);
      loadMesh(`${sideName}_shoulder_roll_link.STL`, silverMat, shoulderRollGroup);

      const shoulderYawGroup = new THREE.Group();
      shoulderYawGroup.position.set(0, -0.1032, -0.00624 * side);
      shoulderRollGroup.add(shoulderYawGroup);
      loadMesh(`${sideName}_shoulder_yaw_link.STL`, silverMat, shoulderYawGroup);

      const elbowGroup = new THREE.Group();
      elbowGroup.position.set(0.015783, -0.080518, 0);
      shoulderYawGroup.add(elbowGroup);
      loadMesh(`${sideName}_elbow_link.STL`, silverMat, elbowGroup);

      const wristRollGroup = new THREE.Group();
      wristRollGroup.position.set(0.1, -0.01, -0.00188791 * side);
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
      loadMesh(`${sideName}_rubber_hand.STL`, darkMat, wristYawGroup, [0.0415, 0, -0.003 * side]);

      return { shoulderPitchGroup, shoulderRollGroup, shoulderYawGroup, elbowGroup, wristRollGroup, wristPitchGroup, wristYawGroup };
    };

    this.leftLeg = createLeg(true);
    this.rightLeg = createLeg(false);
    this.leftArm = createArm(true);
    this.rightArm = createArm(false);
  }

  initInputControls() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
    });

    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');

    if (base && stick) {
      let active = false;
      let touchId = null;
      const maxRadius = 50;

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

    if (Math.abs(this.joystickVector.x) > 0.1) vx = this.joystickVector.x;
    if (Math.abs(this.joystickVector.y) > 0.1) vy = this.joystickVector.y;

    return { vx, vy };
  }

  animate(time) {
    requestAnimationFrame((t) => this.animate(t));

    const seconds = time * 0.001;
    const { vx, vy } = this.getMovementVector();

    const j = this.kinematics.update(seconds, this.currentStyle, vx, vy, 0);

    this.pelvis.position.y = this.kinematics.rootHeight;
    this.pelvis.rotation.x = this.kinematics.rootPitch;
    this.pelvis.rotation.z = this.kinematics.rootRoll;

    this.torso.rotation.y = j.waist_yaw;
    this.torso.rotation.x = j.waist_pitch;

    this.leftLeg.hipPitchGroup.rotation.z = j.left_hip_pitch;
    this.leftLeg.hipRollGroup.rotation.x = j.left_hip_roll;
    this.leftLeg.hipYawGroup.rotation.y = j.left_hip_yaw;
    this.leftLeg.kneeGroup.rotation.z = j.left_knee;
    this.leftLeg.anklePitchGroup.rotation.z = j.left_ankle_pitch;
    this.leftLeg.ankleRollGroup.rotation.x = j.left_ankle_roll;

    this.rightLeg.hipPitchGroup.rotation.z = j.right_hip_pitch;
    this.rightLeg.hipRollGroup.rotation.x = j.right_hip_roll;
    this.rightLeg.hipYawGroup.rotation.y = j.right_hip_yaw;
    this.rightLeg.kneeGroup.rotation.z = j.right_knee;
    this.rightLeg.anklePitchGroup.rotation.z = j.right_ankle_pitch;
    this.rightLeg.ankleRollGroup.rotation.x = j.right_ankle_roll;

    this.leftArm.shoulderPitchGroup.rotation.z = j.left_shoulder_pitch;
    this.leftArm.shoulderRollGroup.rotation.x = j.left_shoulder_roll;
    this.leftArm.shoulderYawGroup.rotation.y = j.left_shoulder_yaw;
    this.leftArm.elbowGroup.rotation.z = j.left_elbow;

    this.rightArm.shoulderPitchGroup.rotation.z = j.right_shoulder_pitch;
    this.rightArm.shoulderRollGroup.rotation.x = j.right_shoulder_roll;
    this.rightArm.shoulderYawGroup.rotation.y = j.right_shoulder_yaw;
    this.rightArm.elbowGroup.rotation.z = j.right_elbow;

    const moveSpeed = (this.currentStyle === 'run' ? 2.5 : 1.2) * 0.016;
    if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
      const targetAngle = Math.atan2(vx, vy);
      this.characterRotation += (targetAngle - this.characterRotation) * 0.1;
      this.robotGroup.rotation.y = this.characterRotation;

      this.characterPos.x += Math.sin(this.characterRotation) * moveSpeed;
      this.characterPos.z += Math.cos(this.characterRotation) * moveSpeed;
      this.robotGroup.position.copy(this.characterPos);

      this.orbitControls.target.lerp(
        new THREE.Vector3(this.characterPos.x, this.characterPos.y + 0.8, this.characterPos.z),
        0.1
      );
    }

    this.orbitControls.update();
    this.renderer.render(this.scene, this.camera);

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
  new MotionBricksApp();
});
