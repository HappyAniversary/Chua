import * as THREE from 'three';
import type { MonkActionState } from '../types/game';
import { motionDelta } from './playerMotion';

export const MONK_MALLET_GRIP: [number, number, number] = [0.032, -0.028, 0.007];
export const MONK_MALLET_ANGLE = Math.atan2(0.8, -0.6);
export const MONK_MALLET_HEAD_Y = 0.19;
export const MONK_FORTUNE_GRIP: [number, number, number] = [0.032, -0.028, 0.075];
export const MONK_FORTUNE_ANGLE = Math.PI / 2;

/** Centre of the beater head: the low point touches the raised drum. */
export function monkMalletTipTarget(t: number, out = new THREE.Vector3()): THREE.Vector3 {
  const lift = (Math.sin(t * 8) + 1) * 0.5;
  return out.set(0.025, 0.953 + lift * 0.14, 0.51 - lift * 0.05);
}

/** Analytic two-link reach, with an outward elbow pole and unchanged bone lengths. */
function createArmReach(scene: THREE.Object3D, chest: THREE.Bone | undefined, bones: Map<string, THREE.Bone>, side: 'L' | 'R') {
  const upper = bones.get(`UpperArm_${side}`), lower = bones.get(`LowerArm_${side}`), hand = bones.get(`Hand_${side}`);
  const goal = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const target = new THREE.Vector3(), pole = new THREE.Vector3(), direction = new THREE.Vector3(), perpendicular = new THREE.Vector3();
  const elbow = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3();
  const worldQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion(), deltaQ = new THREE.Quaternion();
  let ready = false;
  return {
    reset() { ready = false; },
    solve(localTarget: THREE.Vector3, localPole: THREE.Vector3, handWorldQ: THREE.Quaternion, alpha: number) {
      if (!chest || !upper || !lower || !hand || !upper.parent || !lower.parent || !hand.parent) return;
      scene.updateWorldMatrix(true, true);
      if (!ready) {
        hand.getWorldPosition(goal);
        chest.worldToLocal(goal);
        ready = true;
      }
      goal.lerp(localTarget, alpha);
      target.copy(goal); chest.localToWorld(target);
      pole.copy(localPole); chest.localToWorld(pole);
      upper.getWorldPosition(a); lower.getWorldPosition(b); hand.getWorldPosition(c);
      const upperLength = a.distanceTo(b), lowerLength = b.distanceTo(c);
      direction.subVectors(target, a);
      const rawDistance = direction.length();
      if (rawDistance < 1e-8 || upperLength < 1e-8 || lowerLength < 1e-8) return;
      direction.divideScalar(rawDistance);
      const distance = THREE.MathUtils.clamp(rawDistance, Math.abs(upperLength - lowerLength) + 1e-5, upperLength + lowerLength - 1e-5);
      target.copy(a).addScaledVector(direction, distance);
      perpendicular.subVectors(pole, a).addScaledVector(direction, -perpendicular.dot(direction));
      if (perpendicular.lengthSq() < 1e-10) perpendicular.set(0, 0, 1).addScaledVector(direction, -direction.z);
      perpendicular.normalize();
      const along = (upperLength * upperLength + distance * distance - lowerLength * lowerLength) / (2 * distance);
      const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
      elbow.copy(a).addScaledVector(direction, along).addScaledVector(perpendicular, height);
      from.subVectors(b, a).normalize(); to.subVectors(elbow, a).normalize();
      upper.getWorldQuaternion(worldQ);
      deltaQ.setFromUnitVectors(from, to).multiply(worldQ);
      upper.parent.getWorldQuaternion(parentQ).invert();
      upper.quaternion.copy(parentQ.multiply(deltaQ));
      upper.updateWorldMatrix(true, true);
      lower.getWorldPosition(b); hand.getWorldPosition(c);
      from.subVectors(c, b).normalize(); to.subVectors(target, b).normalize();
      lower.getWorldQuaternion(worldQ);
      deltaQ.setFromUnitVectors(from, to).multiply(worldQ);
      lower.parent.getWorldQuaternion(parentQ).invert();
      lower.quaternion.copy(parentQ.multiply(deltaQ));
      lower.updateWorldMatrix(true, true);
      hand.getWorldQuaternion(worldQ).slerp(handWorldQ, alpha);
      hand.parent.getWorldQuaternion(parentQ).invert();
      hand.quaternion.copy(parentQ.multiply(worldQ));
      hand.updateWorldMatrix(true, true);
    },
  };
}

/** The game and Figure Lab deliberately run the same procedural pose driver. */
export function createFigureAnimator(scene: THREE.Object3D) {
  const bonesMap = new Map<string, THREE.Bone>();
  const bind = new Map<THREE.Bone, { position: THREE.Vector3; quaternion: THREE.Quaternion; rotation: THREE.Euler; scale: THREE.Vector3 }>();
  scene.traverse((object) => {
    if (!(object as THREE.Bone).isBone) return;
    const bone = object as THREE.Bone;
    bonesMap.set(bone.name, bone);
    bind.set(bone, { position: bone.position.clone(), quaternion: bone.quaternion.clone(), rotation: bone.rotation.clone(), scale: bone.scale.clone() });
  });
  const chestBone = bonesMap.get('Chest');
  const leftReach = createArmReach(scene, chestBone, bonesMap, 'L');
  const rightReach = createArmReach(scene, chestBone, bonesMap, 'R');
  const armTarget = new THREE.Vector3(), armPole = new THREE.Vector3(), modelPoint = new THREE.Vector3();
  const modelQ = new THREE.Quaternion(), chestQ = new THREE.Quaternion(), handQ = new THREE.Quaternion();
  const leftPrayerQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI));
  const rightPrayerQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, Math.PI));
  const leftFortuneQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  const rightFortuneQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
  let previousAction: MonkActionState | 'none' = 'none';
  return (currentAction: MonkActionState | 'none', t: number, delta: number, walkPhase = t * 7) => {
    if (currentAction !== previousAction) { leftReach.reset(); rightReach.reset(); previousAction = currentAction; }
    if (currentAction === 'none') {
      bind.forEach((pose, bone) => {
        bone.position.copy(pose.position);
        bone.quaternion.copy(pose.quaternion);
        bone.scale.copy(pose.scale);
      });
      return;
    }
    delta = motionDelta(delta);
    const hips = bonesMap.get('Hips');
    const spine = bonesMap.get('Spine');
    const chest = bonesMap.get('Chest');
    const neck = bonesMap.get('Neck');
    const head = bonesMap.get('Head');

    const armL = bonesMap.get('UpperArm_L');
    const lowerArmL = bonesMap.get('LowerArm_L');
    const handL = bonesMap.get('Hand_L');
    const sleeveL = bonesMap.get('Sleeve_L');

    const armR = bonesMap.get('UpperArm_R');
    const lowerArmR = bonesMap.get('LowerArm_R');
    const handR = bonesMap.get('Hand_R');
    const sleeveR = bonesMap.get('Sleeve_R');

    const legL = bonesMap.get('UpperLeg_L');
    const lowerLegL = bonesMap.get('LowerLeg_L');
    const footL = bonesMap.get('Foot_L');

    const legR = bonesMap.get('UpperLeg_R');
    const lowerLegR = bonesMap.get('LowerLeg_R');
    const footR = bonesMap.get('Foot_R');

    if (!hips || !spine || !chest || !head) return;

    const animLerp = 1 - Math.exp(-14 * delta);

    // Giá trị mục tiêu
    const restHipsY = bind.get(hips)!.position.y;
    let targetHipsY = restHipsY;
    let targetHipsRotY = 0;
    let targetHipsRotZ = 0;

    let targetSpineRotX = 0;
    let targetSpineRotY = 0;
    let targetChestRotX = 0;
    let targetChestRotY = 0;
    let targetNeckRotX = 0;
    let targetHeadRotX = 0;
    let targetHeadRotY = 0;

    let targetArmL_X = 0;
    let targetArmL_Y = 0;
    let targetArmL_Z = 0;
    let targetLowerArmL_X = 0;
    let targetLowerArmL_Y = 0;
    let targetHandL_X = 0;

    let targetArmR_X = 0;
    let targetArmR_Y = 0;
    let targetArmR_Z = 0;
    let targetLowerArmR_X = 0;
    let targetLowerArmR_Y = 0;
    let targetHandR_X = 0;

    let targetLegL_X = 0;
    let targetLowerLegL_X = 0;
    let targetFootL_X = 0;

    let targetLegR_X = 0;
    let targetLowerLegR_X = 0;
    let targetFootR_X = 0;

    switch (currentAction) {
      case 'idle': {
        // Hơi thở nhẹ nhàng: lồng ngực nở, đầu nghiêng nhẹ, hai tay chắp trước bụng thanh tịnh
        const breath = Math.sin(t * 2.2);
        targetHipsY = restHipsY + breath * 0.008;
        targetChestRotX = 0.02 + breath * 0.02;
        targetSpineRotX = 0.01 + breath * 0.01;
        targetHeadRotX = Math.sin(t * 1.4) * 0.02;
        targetHeadRotY = Math.sin(t * 0.8) * 0.035;

        targetArmL_X = -0.38 + breath * 0.015;
        targetArmL_Y = 0.22;
        targetArmL_Z = -0.16;
        targetLowerArmL_X = -0.52;
        targetLowerArmL_Y = 0.35;
        targetHandL_X = -0.1;

        targetArmR_X = -0.38 + breath * 0.015;
        targetArmR_Y = -0.22;
        targetArmR_Z = 0.16;
        targetLowerArmR_X = -0.52;
        targetLowerArmR_Y = -0.35;
        targetHandR_X = -0.1;
        break;
      }

      case 'walking': {
        // Bước đi khoan thai thanh tịnh: chân bước đều, cánh tay vung nhịp nhàng ngược pha, hông lắc nhẹ, xương sống xoay đối trọng
        const walkCycle = walkPhase;
        const swing = Math.sin(walkCycle);
        const bounce = Math.abs(Math.sin(walkCycle * 2));

        targetHipsY = restHipsY + bounce * 0.035;
        targetHipsRotY = swing * 0.07;
        targetHipsRotZ = -swing * 0.025;

        targetSpineRotX = 0.05;
        targetSpineRotY = -swing * 0.05;
        targetChestRotY = -swing * 0.03;
        targetHeadRotX = -0.02 + bounce * 0.02;
        targetHeadRotY = swing * 0.02;

        targetLegL_X = swing * 0.52;
        targetLowerLegL_X = Math.max(0, -swing) * 0.55;
        targetFootL_X = -swing * 0.15;

        targetLegR_X = -swing * 0.52;
        targetLowerLegR_X = Math.max(0, swing) * 0.55;
        targetFootR_X = swing * 0.15;

        targetArmL_X = -swing * 0.42 - 0.1;
        targetArmL_Z = -0.06;
        targetLowerArmL_X = -0.22 - Math.max(0, -swing) * 0.22;

        targetArmR_X = swing * 0.42 - 0.1;
        targetArmR_Z = 0.06;
        targetLowerArmR_X = -0.22 - Math.max(0, swing) * 0.22;
        break;
      }

      case 'praying': {
        // Hai tay chắp trước ngực hình búp sen (Anjali Mudra), đầu hơi cúi cung kính, cúi gập người lễ Phật chí thành
        const bow = (Math.sin(t * 3.0) + 1.0) * 0.5; // 0 -> 1
        targetHipsY = restHipsY - bow * 0.03;
        targetSpineRotX = 0.12 + bow * 0.32;
        targetChestRotX = 0.06 + bow * 0.15;
        targetNeckRotX = 0.04 + bow * 0.1;
        targetHeadRotX = 0.1 + bow * 0.18;

        targetArmL_X = -1.05 - bow * 0.15;
        targetArmL_Y = 0.48;
        targetArmL_Z = -0.3;
        targetLowerArmL_X = -0.65;
        targetLowerArmL_Y = 0.38;
        targetHandL_X = -0.18;

        targetArmR_X = -1.05 - bow * 0.15;
        targetArmR_Y = -0.48;
        targetArmR_Z = 0.3;
        targetLowerArmR_X = -0.65;
        targetLowerArmR_Y = -0.38;
        targetHandR_X = -0.18;
        break;
      }

      case 'wooden_fish': {
        // A soft standing bow keeps the long robe clear of the floor.
        const tapBeat = Math.sin(t * 8.0);
        targetHipsY = restHipsY - 0.025;

        targetSpineRotX = 0.1;
        targetHeadRotX = 0.16 + Math.max(0, tapBeat) * 0.03;

        targetArmL_X = -0.65;
        targetArmL_Y = 0.35;
        targetLowerArmL_X = -0.6;

        targetArmR_X = -0.82 + Math.max(0, tapBeat) * 0.18;
        targetArmR_Y = -0.18;
        targetLowerArmR_X = -0.48 + tapBeat * 0.32;
        targetHandR_X = tapBeat * 0.25;
        break;
      }

      case 'fortune': {
        // Hai tay nâng ống xăm lắc đều đặn Math.sin(t * 14)
        const shake = Math.sin(t * 14.0);
        targetHipsY = restHipsY + Math.abs(shake) * 0.012;
        targetSpineRotX = 0.08 + Math.abs(shake) * 0.03;
        targetHeadRotX = 0.14 + shake * 0.035;

        targetArmL_X = -1.02 + shake * 0.2;
        targetArmL_Y = 0.38;
        targetArmL_Z = -0.22;
        targetLowerArmL_X = -0.52 + shake * 0.15;

        targetArmR_X = -1.02 + shake * 0.2;
        targetArmR_Y = -0.38;
        targetArmR_Z = 0.22;
        targetLowerArmR_X = -0.52 + shake * 0.15;
        break;
      }

      case 'bell': {
        // Hai tay đẩy chày chuông theo nhịp ngân
        const push = Math.sin(t * 3.2);
        targetHipsY = restHipsY;
        targetSpineRotX = 0.12 + push * 0.16;
        targetHeadRotX = 0.05 + push * 0.06;

        targetArmL_X = -1.22 + push * 0.32;
        targetArmL_Y = 0.15;
        targetLowerArmL_X = -0.38;

        targetArmR_X = -1.22 + push * 0.32;
        targetArmR_Y = -0.15;
        targetLowerArmR_X = -0.38;

        targetLegL_X = -0.12;
        targetLegR_X = 0.15;
        break;
      }
    }

    // Lerp mượt mà cho từng xương
    hips.position.y = THREE.MathUtils.lerp(hips.position.y, targetHipsY, animLerp);
    hips.rotation.y = THREE.MathUtils.lerp(hips.rotation.y, bind.get(hips)!.rotation.y + targetHipsRotY, animLerp);
    hips.rotation.z = THREE.MathUtils.lerp(hips.rotation.z, bind.get(hips)!.rotation.z + targetHipsRotZ, animLerp);

    spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, bind.get(spine)!.rotation.x + targetSpineRotX, animLerp);
    spine.rotation.y = THREE.MathUtils.lerp(spine.rotation.y, bind.get(spine)!.rotation.y + targetSpineRotY, animLerp);

    chest.rotation.x = THREE.MathUtils.lerp(chest.rotation.x, bind.get(chest)!.rotation.x + targetChestRotX, animLerp);
    chest.rotation.y = THREE.MathUtils.lerp(chest.rotation.y, bind.get(chest)!.rotation.y + targetChestRotY, animLerp);

    if (neck) neck.rotation.x = THREE.MathUtils.lerp(neck.rotation.x, bind.get(neck)!.rotation.x + targetNeckRotX, animLerp);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, bind.get(head)!.rotation.x + targetHeadRotX, animLerp);
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, bind.get(head)!.rotation.y + targetHeadRotY, animLerp);

    const reachesProp = currentAction === 'praying' || currentAction === 'wooden_fish' || currentAction === 'fortune';
    if (!reachesProp && armL) {
      armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, bind.get(armL)!.rotation.x + targetArmL_X, animLerp);
      armL.rotation.y = THREE.MathUtils.lerp(armL.rotation.y, bind.get(armL)!.rotation.y + targetArmL_Y, animLerp);
      armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, bind.get(armL)!.rotation.z + targetArmL_Z, animLerp);
    }
    if (!reachesProp && lowerArmL) {
      lowerArmL.rotation.x = THREE.MathUtils.lerp(lowerArmL.rotation.x, bind.get(lowerArmL)!.rotation.x + targetLowerArmL_X, animLerp);
      lowerArmL.rotation.y = THREE.MathUtils.lerp(lowerArmL.rotation.y, bind.get(lowerArmL)!.rotation.y + targetLowerArmL_Y, animLerp);
    }
    if (!reachesProp && handL) handL.rotation.x = THREE.MathUtils.lerp(handL.rotation.x, bind.get(handL)!.rotation.x + targetHandL_X, animLerp);
    if (sleeveL) sleeveL.quaternion.copy(bind.get(sleeveL)!.quaternion);

    if (!reachesProp && armR) {
      armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, bind.get(armR)!.rotation.x + targetArmR_X, animLerp);
      armR.rotation.y = THREE.MathUtils.lerp(armR.rotation.y, bind.get(armR)!.rotation.y + targetArmR_Y, animLerp);
      armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, bind.get(armR)!.rotation.z + targetArmR_Z, animLerp);
    }
    if (!reachesProp && lowerArmR) {
      lowerArmR.rotation.x = THREE.MathUtils.lerp(lowerArmR.rotation.x, bind.get(lowerArmR)!.rotation.x + targetLowerArmR_X, animLerp);
      lowerArmR.rotation.y = THREE.MathUtils.lerp(lowerArmR.rotation.y, bind.get(lowerArmR)!.rotation.y + targetLowerArmR_Y, animLerp);
    }
    if (!reachesProp && handR) handR.rotation.x = THREE.MathUtils.lerp(handR.rotation.x, bind.get(handR)!.rotation.x + targetHandR_X, animLerp);
    if (sleeveR) sleeveR.quaternion.copy(bind.get(sleeveR)!.quaternion);

    if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, bind.get(legL)!.rotation.x + targetLegL_X, animLerp);
    if (lowerLegL) lowerLegL.rotation.x = THREE.MathUtils.lerp(lowerLegL.rotation.x, bind.get(lowerLegL)!.rotation.x + targetLowerLegL_X, animLerp);
    if (footL) footL.rotation.x = THREE.MathUtils.lerp(footL.rotation.x, bind.get(footL)!.rotation.x + targetFootL_X, animLerp);

    if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, bind.get(legR)!.rotation.x + targetLegR_X, animLerp);
    if (lowerLegR) lowerLegR.rotation.x = THREE.MathUtils.lerp(lowerLegR.rotation.x, bind.get(lowerLegR)!.rotation.x + targetLowerLegR_X, animLerp);
    if (footR) footR.rotation.x = THREE.MathUtils.lerp(footR.rotation.x, bind.get(footR)!.rotation.x + targetFootR_X, animLerp);

    if (reachesProp) {
      scene.updateWorldMatrix(true, true);
      chest.getWorldQuaternion(chestQ);
      if (currentAction === 'praying') {
        handQ.copy(chestQ).multiply(leftPrayerQ);
        leftReach.solve(armTarget.set(-0.072, -0.11, 0.292), armPole.set(-0.42, -0.10, 0.04), handQ, animLerp);
        handQ.copy(chestQ).multiply(rightPrayerQ);
        rightReach.solve(armTarget.set(0.072, -0.11, 0.292), armPole.set(0.42, -0.10, 0.04), handQ, animLerp);
      } else if (currentAction === 'fortune') {
        // Both palms hug the tube sides, and their shared lift keeps the prop supported.
        const lift = -0.03 + Math.sin(t * 14) * 0.02;
        handQ.copy(chestQ).multiply(leftFortuneQ);
        leftReach.solve(armTarget.set(-0.115, lift, 0.34), armPole.set(-0.43, -0.10, 0.08), handQ, animLerp);
        handQ.copy(chestQ).multiply(rightFortuneQ);
        rightReach.solve(armTarget.set(0.115, lift, 0.34), armPole.set(0.43, -0.10, 0.08), handQ, animLerp);
      } else {
        scene.getWorldQuaternion(modelQ);
        // The prop is anchored in model-space; torso bowing never moves its strike point.
        monkMalletTipTarget(t, modelPoint).sub(armTarget.set(0.032, -0.202, 0.199));
        scene.localToWorld(modelPoint); chest.worldToLocal(modelPoint);
        rightReach.solve(modelPoint, armPole.set(0.44, -0.15, 0.04), modelQ, 1 - Math.exp(-24 * delta));
        modelPoint.set(-0.18, 1.02, 0.15); scene.localToWorld(modelPoint); chest.worldToLocal(modelPoint);
        leftReach.solve(modelPoint, armPole.set(-0.44, -0.18, 0.02), modelQ, animLerp);
      }
    }
  };
}
