/**
 * MotionBricks Kinematics Controller
 * Computes exact joint rotation transforms for the Unitree G1 29DOF Humanoid Robot
 * for all MotionBricks smart primitives (Walk, Run, Stealth, Crawl, Elbow Crawl, Boxing, Dance, Zombie, Gun Walk, Scared, Injured)
 * and MotionBricks dataset replay.
 * Fully compatible with static web hosting (GitHub Pages / Cloudflare Pages).
 */

export class G1Kinematics {
  constructor() {
    this.joints = {
      waist_yaw: 0, waist_roll: 0, waist_pitch: 0,
      left_hip_pitch: 0, left_hip_roll: 0, left_hip_yaw: 0, left_knee: 0, left_ankle_pitch: 0, left_ankle_roll: 0,
      right_hip_pitch: 0, right_hip_roll: 0, right_hip_yaw: 0, right_knee: 0, right_ankle_pitch: 0, right_ankle_roll: 0,
      left_shoulder_pitch: 0, left_shoulder_roll: 0.2, left_shoulder_yaw: 0, left_elbow: 0.5, left_wrist_roll: 0, left_wrist_pitch: 0, left_wrist_yaw: 0,
      right_shoulder_pitch: 0, right_shoulder_roll: -0.2, right_shoulder_yaw: 0, right_elbow: 0.5, right_wrist_roll: 0, right_wrist_pitch: 0, right_wrist_yaw: 0
    };

    this.rootHeight = 0.79;
    this.rootPitch = 0;
    this.rootRoll = 0;

    this.motionData = null;
    this.loadMotionData();
  }

  async loadMotionData() {
    try {
      // Static relative fetch for GitHub Pages & Cloudflare Pages compatibility
      const res = await fetch('./webgame/assets/sample_motion.json');
      if (res.ok) {
        this.motionData = await res.json();
        console.log("Loaded MotionBricks static dataset successfully!");
      }
    } catch (e) {
      console.warn("Could not fetch MotionBricks static dataset, falling back to procedural engine.", e);
    }
  }

  update(t, style, vx, vy, vrot) {
    if (this.motionData && style === 'mocap') {
      const frameIdx = Math.floor(t * this.motionData.fps) % this.motionData.frames;
      const dof = this.motionData.dof[frameIdx];

      this.joints.left_hip_pitch = dof[0];
      this.joints.left_hip_roll = dof[1];
      this.joints.left_hip_yaw = dof[2];
      this.joints.left_knee = dof[3];
      this.joints.left_ankle_pitch = dof[4];
      this.joints.left_ankle_roll = dof[5];

      this.joints.right_hip_pitch = dof[6];
      this.joints.right_hip_roll = dof[7];
      this.joints.right_hip_yaw = dof[8];
      this.joints.right_knee = dof[9];
      this.joints.right_ankle_pitch = dof[10];
      this.joints.right_ankle_roll = dof[11];

      this.joints.waist_yaw = dof[12];
      this.joints.waist_roll = dof[13];
      this.joints.waist_pitch = dof[14];

      this.joints.left_shoulder_pitch = dof[15];
      this.joints.left_shoulder_roll = dof[16];
      this.joints.left_shoulder_yaw = dof[17];
      this.joints.left_elbow = dof[18];

      this.joints.right_shoulder_pitch = dof[22];
      this.joints.right_shoulder_roll = dof[23];
      this.joints.right_shoulder_yaw = dof[24];
      this.joints.right_elbow = dof[25];

      this.rootHeight = 0.78;
      return this.joints;
    }

    const isMoving = Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05 || Math.abs(vrot) > 0.05;
    const speed = Math.sqrt(vx * vx + vy * vy);

    let freq = 2.0;
    let stride = 0.4 * Math.min(speed, 1.2);
    let armSwing = 0.4;
    let kneeBend = 0.25;
    let baseHeight = 0.78;
    let bodyLean = vx * 0.08;

    switch (style) {
      case 'run':
        freq = 3.2; stride = 0.65; armSwing = 0.8; kneeBend = 0.45; baseHeight = 0.74; bodyLean = 0.25; break;
      case 'crawl':
        freq = 1.2; stride = 0.25; armSwing = 0.5; kneeBend = 1.2; baseHeight = 0.45; bodyLean = 0.5; break;
      case 'elbow_crawl':
        freq = 1.0; stride = 0.2; armSwing = 0.6; kneeBend = 1.4; baseHeight = 0.38; bodyLean = 0.6; break;
      case 'stealth':
        freq = 1.1; stride = 0.2; armSwing = 0.2; kneeBend = 0.7; baseHeight = 0.62; bodyLean = 0.25; break;
      case 'boxing':
        freq = 2.2; stride = 0.3; armSwing = 0.1; kneeBend = 0.35; baseHeight = 0.72; break;
      case 'happy':
        freq = 2.5; stride = 0.4; armSwing = 0.6; kneeBend = 0.3; baseHeight = 0.78; break;
      case 'zombie':
        freq = 0.8; stride = 0.2; armSwing = 0.05; kneeBend = 0.15; baseHeight = 0.76; break;
      case 'gun':
        freq = 1.8; stride = 0.35; armSwing = 0.05; kneeBend = 0.3; baseHeight = 0.76; bodyLean = 0.1; break;
      case 'scared':
        freq = 2.4; stride = 0.25; armSwing = 0.2; kneeBend = 0.5; baseHeight = 0.68; bodyLean = -0.1; break;
      case 'injured':
        freq = 1.2; stride = 0.25; armSwing = 0.2; kneeBend = 0.4; baseHeight = 0.72; bodyLean = 0.15; break;
      case 'walk':
      default:
        freq = 2.0; stride = 0.4 * Math.max(speed, 0.4); armSwing = 0.4; kneeBend = 0.25; baseHeight = 0.78; break;
    }

    if (!isMoving) { freq = 1.0; stride = 0; armSwing = 0; }

    const phase = t * freq * Math.PI * 2;
    const sinP = Math.sin(phase);
    const cosP = Math.cos(phase);

    this.rootHeight = baseHeight + (isMoving ? Math.abs(sinP) * 0.03 : Math.sin(t * 2) * 0.005);
    this.rootPitch = bodyLean + (isMoving ? sinP * 0.02 : 0);
    this.rootRoll = isMoving ? cosP * 0.02 : 0;

    this.joints.waist_yaw = isMoving ? -cosP * 0.1 : 0;
    this.joints.waist_pitch = bodyLean * 0.5;

    const lPhase = sinP;
    const rPhase = -sinP;

    if (style === 'injured') {
      this.joints.left_hip_pitch = -lPhase * stride * 1.2 - kneeBend * 0.3;
      this.joints.left_knee = kneeBend + Math.max(0, lPhase) * stride * 1.5;
      this.joints.left_ankle_pitch = -this.joints.left_hip_pitch * 0.5;

      this.joints.right_hip_pitch = -rPhase * stride * 0.5 - kneeBend * 0.1;
      this.joints.right_knee = kneeBend * 0.5;
      this.joints.right_ankle_pitch = -this.joints.right_hip_pitch * 0.3;
    } else {
      this.joints.left_hip_pitch = -lPhase * stride - kneeBend * 0.3;
      this.joints.left_knee = kneeBend + Math.max(0, lPhase) * stride * 1.2;
      this.joints.left_ankle_pitch = -this.joints.left_hip_pitch * 0.5 - this.joints.left_knee * 0.4;

      this.joints.right_hip_pitch = -rPhase * stride - kneeBend * 0.3;
      this.joints.right_knee = kneeBend + Math.max(0, rPhase) * stride * 1.2;
      this.joints.right_ankle_pitch = -this.joints.right_hip_pitch * 0.5 - this.joints.right_knee * 0.4;
    }

    if (style === 'boxing') {
      const jabL = Math.max(0, Math.sin(t * 8));
      const jabR = Math.max(0, Math.sin(t * 8 + Math.PI));
      this.joints.left_shoulder_pitch = -0.8 - jabL * 0.5;
      this.joints.left_elbow = 1.6 - jabL * 0.8;
      this.joints.right_shoulder_pitch = -0.8 - jabR * 0.5;
      this.joints.right_elbow = 1.6 - jabR * 0.8;
    } else if (style === 'gun') {
      this.joints.left_shoulder_pitch = -1.2;
      this.joints.left_shoulder_roll = 0.3;
      this.joints.left_elbow = 1.2;
      this.joints.right_shoulder_pitch = -1.4;
      this.joints.right_shoulder_roll = -0.2;
      this.joints.right_elbow = 1.4;
    } else if (style === 'scared') {
      this.joints.left_shoulder_pitch = -1.8;
      this.joints.left_shoulder_roll = 0.5;
      this.joints.left_elbow = 1.8;
      this.joints.right_shoulder_pitch = -1.8;
      this.joints.right_shoulder_roll = -0.5;
      this.joints.right_elbow = 1.8;
    } else if (style === 'zombie') {
      this.joints.left_shoulder_pitch = -1.3;
      this.joints.left_elbow = 0.2;
      this.joints.right_shoulder_pitch = -1.3;
      this.joints.right_elbow = 0.2;
    } else if (style === 'happy') {
      this.joints.left_shoulder_pitch = -2.2 + Math.sin(t * 6) * 0.3;
      this.joints.left_elbow = 0.8;
      this.joints.right_shoulder_pitch = -2.2 + Math.cos(t * 6) * 0.3;
      this.joints.right_elbow = 0.8;
    } else if (style === 'elbow_crawl') {
      this.joints.left_shoulder_pitch = -0.4 + rPhase * 0.5;
      this.joints.left_elbow = 1.6;
      this.joints.right_shoulder_pitch = -0.4 + lPhase * 0.5;
      this.joints.right_elbow = 1.6;
    } else {
      this.joints.left_shoulder_pitch = rPhase * armSwing;
      this.joints.left_elbow = 0.4 + Math.abs(rPhase) * armSwing * 0.5;
      this.joints.right_shoulder_pitch = lPhase * armSwing;
      this.joints.right_elbow = 0.4 + Math.abs(lPhase) * armSwing * 0.5;
    }

    return this.joints;
  }
}
