/**
 * MotionBricks Kinematics Engine
 * Real-time procedural joint computation for the Unitree G1 Humanoid Robot.
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

    this.rootHeight = 0.78;
    this.rootPitch = 0;
    this.rootRoll = 0;
  }

  update(t, style, vx, vy, vrot) {
    const isMoving = Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05 || Math.abs(vrot) > 0.05;
    const speed = Math.sqrt(vx * vx + vy * vy);

    let freq = 2.0;
    let stride = 0.4 * Math.min(speed, 1.2);
    let armSwing = 0.4;
    let kneeBend = 0.25;
    let baseHeight = 0.78;
    let bodyLean = vy * 0.1;

    switch (style) {
      case 'run':
        freq = 3.2; stride = 0.65; armSwing = 0.8; kneeBend = 0.45; baseHeight = 0.74; bodyLean = 0.25; break;
      case 'crawl':
        freq = 1.2; stride = 0.25; armSwing = 0.5; kneeBend = 1.2; baseHeight = 0.45; bodyLean = 0.5; break;
      case 'stealth':
        freq = 1.1; stride = 0.2; armSwing = 0.2; kneeBend = 0.7; baseHeight = 0.62; bodyLean = 0.25; break;
      case 'boxing':
        freq = 2.2; stride = 0.3; armSwing = 0.1; kneeBend = 0.35; baseHeight = 0.72; break;
      case 'happy':
        freq = 2.5; stride = 0.4; armSwing = 0.6; kneeBend = 0.3; baseHeight = 0.78; break;
      case 'zombie':
        freq = 0.8; stride = 0.2; armSwing = 0.05; kneeBend = 0.15; baseHeight = 0.76; break;
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

    this.joints.left_hip_pitch = -lPhase * stride - kneeBend * 0.3;
    this.joints.left_knee = kneeBend + Math.max(0, lPhase) * stride * 1.2;
    this.joints.left_ankle_pitch = -this.joints.left_hip_pitch * 0.5 - this.joints.left_knee * 0.4;

    this.joints.right_hip_pitch = -rPhase * stride - kneeBend * 0.3;
    this.joints.right_knee = kneeBend + Math.max(0, rPhase) * stride * 1.2;
    this.joints.right_ankle_pitch = -this.joints.right_hip_pitch * 0.5 - this.joints.right_knee * 0.4;

    if (style === 'boxing') {
      const jabL = Math.max(0, Math.sin(t * 8));
      const jabR = Math.max(0, Math.sin(t * 8 + Math.PI));
      this.joints.left_shoulder_pitch = -0.8 - jabL * 0.5;
      this.joints.left_elbow = 1.6 - jabL * 0.8;
      this.joints.right_shoulder_pitch = -0.8 - jabR * 0.5;
      this.joints.right_elbow = 1.6 - jabR * 0.8;
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
    } else {
      this.joints.left_shoulder_pitch = rPhase * armSwing;
      this.joints.left_elbow = 0.4 + Math.abs(rPhase) * armSwing * 0.5;
      this.joints.right_shoulder_pitch = lPhase * armSwing;
      this.joints.right_elbow = 0.4 + Math.abs(lPhase) * armSwing * 0.5;
    }

    return this.joints;
  }
}
