import { Camera } from "../lib/webglutils/Camera.js";
import { Mat4, Vec3, Vec4, Vec2, Quat } from "../lib/TSM.js";
export var Mode;
(function (Mode) {
    Mode[Mode["playback"] = 0] = "playback";
    Mode[Mode["edit"] = 1] = "edit";
})(Mode || (Mode = {}));
/**
 * Handles Mouse and Button events along with
 * the the camera.
 */
export class GUI {
    /**
     *
     * @param canvas required to get the width and height of the canvas
     * @param animation required as a back pointer for some of the controls
     * @param sponge required for some of the controls
     */
    constructor(canvas, animation) {
        this.hoverX = 0;
        this.hoverY = 0;
        this.height = canvas.height;
        this.viewPortHeight = this.height - 200;
        this.viewPortWidth = 800;
        this.prevX = 0;
        this.prevY = 0;
        this.animation = animation;
        this.reset();
        this.registerEventListeners(canvas);
    }
    getNumKeyFrames() {
        // TODO
        // Used in the status bar in the GUI
        return this.keyFrames.length;
    }
    getTime() {
        return this.time;
    }
    getMaxTime() {
        // TODO
        // The animation should stop after the last keyframe
        return this.keyFrames.length - 1;
    }
    /**
     * Resets the state of the GUI
     */
    reset() {
        this.fps = false;
        this.dragging = false;
        this.time = 0;
        this.mode = Mode.edit;
        this.intersectedBone = { bone: undefined, t: -1 };
        this.clicked = false;
        this.keyFrames = [];
        this.animation.cylinder.setDraw(false);
        this.keyFrames = [];
        this.keyFrameTextures = [];
        this.selectedKeyFrame = -1;
        this.hoveredTick = -1;
        this.camera = new Camera(new Vec3([0, 0, -6]), new Vec3([0, 0, 0]), new Vec3([0, 1, 0]), 45, this.viewPortWidth / this.viewPortHeight, 0.1, 1000.0);
    }
    /**
     * Sets the GUI's camera to the given camera
     * @param cam a new camera
     */
    setCamera(pos, target, upDir, fov, aspect, zNear, zFar) {
        this.camera = new Camera(pos, target, upDir, fov, aspect, zNear, zFar);
    }
    /**
     * Returns the view matrix of the camera
     */
    viewMatrix() {
        return this.camera.viewMatrix();
    }
    /**
     * Returns the projection matrix of the camera
     */
    projMatrix() {
        return this.camera.projMatrix();
    }
    /**
     * Callback function for the start of a drag event.
     * @param mouse
     */
    dragStart(mouse) {
        if (mouse.offsetY > 800) {
            // outside the main panel
            return;
        }
        this.dragging = true;
        if (mouse.offsetX > 800) {
            this.selectedKeyFrame = this.clickKeyFrame(mouse.offsetX, mouse.offsetY);
        }
        else if (mouse.offsetY > 600) {
            const selectedTick = this.findTick(mouse.offsetX, mouse.offsetY);
            this.selectedKeyFrame = selectedTick;
            this.animation.initTimeline();
        }
        else {
            // TODO
            // Some logic to rotate the bones, instead of moving the camera, if there is a currently highlighted bone
            this.clicked = !!this.intersectedBone.bone;
            this.prevX = mouse.screenX;
            this.prevY = mouse.screenY;
            this.selectedKeyFrame = -1;
        }
    }
    findTick(x, y) {
        const tickTop = 700 - 0.58 * 200 * 0.5;
        const tickBottom = 700 - 0.78 * 200 * 0.5;
        if (y < tickBottom || y > tickTop)
            return -1;
        const start = 0.1 * 800;
        const end = 0.9 * 800;
        const l = end - start;
        return this.animation.times.findIndex((t) => {
            const tickX = start + t * l;
            return x > tickX - 10 && x < tickX + 10;
        });
    }
    clickKeyFrame(x, y) {
        const a = this.animation;
        const frameHeight = a.frameHeight + a.framePadding;
        const x0 = this.viewPortWidth + a.panelWidth / 2 - a.frameWidth / 2;
        const x1 = this.viewPortWidth + a.panelWidth / 2 + a.frameWidth / 2;
        const offsetY = y + (a.keyFrameStart - 1) * a.panelHeight * 0.5;
        const frameNum = Math.floor(offsetY / frameHeight);
        let clickedKeyFrame = x >= x0 && x <= x1 && offsetY % frameHeight >= a.framePadding && frameNum < this.getNumKeyFrames();
        return clickedKeyFrame ? frameNum : -1;
    }
    incrementTime(dT) {
        if (this.mode === Mode.playback) {
            this.time += dT;
            if (this.time >= this.getMaxTime()) {
                this.time = 0;
                this.mode = Mode.edit;
            }
        }
    }
    /**
     * The callback function for a drag event.
     * This event happens after dragStart and
     * before dragEnd.
     * @param mouse
     */
    drag(mouse) {
        if (this.mode !== Mode.edit || mouse.offsetX > 800)
            return;
        const mouseRay = this.getMouseRay(mouse.offsetX, mouse.offsetY);
        if (this.dragging) {
            const dx = mouse.screenX - this.prevX;
            const dy = mouse.screenY - this.prevY;
            this.prevX = mouse.screenX;
            this.prevY = mouse.screenY;
            /* Left button, or primary button */
            const mouseDir = this.camera.right();
            mouseDir.scale(-dx);
            mouseDir.add(this.camera.up().scale(dy));
            mouseDir.normalize();
            if (dx === 0 && dy === 0) {
                return;
            }
            switch (mouse.buttons) {
                case 1: {
                    if (mouse.offsetY > 600 && mouse.offsetX < 800) {
                        if (this.selectedKeyFrame) {
                            const start = -0.8;
                            const end = 0.8;
                            const l = end - start;
                            let x = (2 * mouse.offsetX) / 800 - 1;
                            x -= start;
                            x /= l;
                            // const tickX = start + t * l;
                            if (!this.animation.lockedTimes[this.selectedKeyFrame])
                                this.animation.setTime(this.selectedKeyFrame, x);
                        }
                        return;
                    }
                    const { bone, t } = this.intersectedBone;
                    if (this.clicked) {
                        // rotate bone
                        const lookDir = this.camera.forward().copy().normalize();
                        const vBone = Vec3.difference(bone.endpoint, bone.position);
                        const end = Vec3.sum(mouseRay.pos, mouseRay.dir.scale(t, new Vec3()));
                        const b = Vec3.difference(end, bone.position).normalize();
                        b.subtract(lookDir.scale(Vec3.dot(lookDir, b), new Vec3()));
                        b.normalize().scale(Vec3.cross(lookDir, vBone).length());
                        b.add(lookDir.scale(Vec3.dot(lookDir, vBone)));
                        const rotQuat = this.getRotQuat(bone, false, b);
                        this.rotateBone(bone, rotQuat);
                    }
                    else {
                        let rotAxis = Vec3.cross(this.camera.forward(), mouseDir);
                        rotAxis = rotAxis.normalize();
                        if (this.fps) {
                            this.camera.rotate(rotAxis, GUI.rotationSpeed);
                        }
                        else {
                            this.camera.orbitTarget(rotAxis, GUI.rotationSpeed);
                        }
                    }
                    break;
                }
                case 2: {
                    /* Right button, or secondary button */
                    this.camera.offsetDist(Math.sign(mouseDir.y) * GUI.zoomSpeed);
                    break;
                }
                default: {
                    break;
                }
            }
        }
        // TODO
        // You will want logic here:
        // 1) To highlight a bone, if the mouse is hovering over a bone;
        // 2) To rotate a bone, if the mouse button is pressed and currently highlighting a bone.
        if (!this.clicked) {
            this.intersectedBone = this.findBone(mouseRay);
        }
        this.animation.cylinder.setDraw(!!this.intersectedBone.bone);
        if (this.intersectedBone.bone) {
            this.animation.initCylinder(...this.getBoneTransformation(this.intersectedBone.bone));
        }
        this.hoveredTick = this.findTick(mouse.offsetX, mouse.offsetY);
        this.animation.initTimeline();
    }
    getMouseRay(x, y) {
        const ndcX = (2 * x) / this.viewPortWidth - 1;
        const ndcY = 1 - (2 * y) / this.viewPortHeight;
        let mouseDir = new Vec4([ndcX, ndcY, -1, 1]);
        mouseDir.multiplyMat4(this.projMatrix().inverse());
        mouseDir = new Vec4([...mouseDir.xy, -1, 0]);
        mouseDir.multiplyMat4(this.viewMatrix().inverse());
        const dir = new Vec3(mouseDir.xyz).normalize();
        return { pos: this.camera.pos(), dir };
    }
    rotateBone(bone, rotQuat) {
        const initialB = Vec3.difference(bone.initialEndpoint, bone.initialPosition);
        bone.rotation = Quat.product(rotQuat, bone.rotation).normalize();
        if (bone.rotation.w < 0)
            bone.rotation = new Quat([-bone.rotation.x, -bone.rotation.y, -bone.rotation.z, -bone.rotation.w]);
        bone.endpoint = Vec3.sum(bone.position, initialB.multiplyByQuat(bone.rotation));
        bone.children.forEach((c) => {
            const child = this.animation.getScene().meshes[0].bones[c];
            const offset = Vec3.difference(child.initialPosition, bone.initialEndpoint);
            offset.multiplyByQuat(bone.rotation);
            child.position = Vec3.sum(bone.endpoint, offset);
            this.rotateBone(child, rotQuat);
        });
    }
    findBone(mouseRay) {
        const scene = this.animation.getScene();
        let intersectedBone = { bone: undefined, t: -1 };
        scene.meshes[0].bones.forEach((bone) => {
            const { intersect, t0: t } = this.boneIntersect(bone, mouseRay);
            if (intersect) {
                if (intersectedBone.t == -1 || t < intersectedBone.t) {
                    intersectedBone = { bone, t };
                }
            }
        });
        return intersectedBone;
    }
    boneIntersect(bone, ray) {
        const rotQuat = this.getRotQuat(bone, false);
        const p = Vec3.difference(ray.pos, bone.position).multiplyByQuat(rotQuat);
        const d = ray.dir.multiplyByQuat(rotQuat, new Vec3()).normalize();
        const O = new Vec2([p.x, p.z]);
        const D = new Vec2([d.x, d.z]).normalize();
        const circleIntersect = this.circleIntersect(O, D);
        if (!circleIntersect.intersect)
            return { intersect: false };
        let { t0, t1 } = circleIntersect;
        t0 *= D.x / d.x;
        t1 *= D.x / d.x;
        const y0 = p.y + Math.min(t0 * d.y, t1 * d.y);
        const y1 = p.y + Math.max(t0 * d.y, t1 * d.y);
        const b = Vec3.difference(bone.endpoint, bone.position).length();
        const intersectT0 = y0 >= 0 && y0 <= b;
        const intersectT1 = y1 >= 0 && y1 <= b;
        const intersectCaps = y0 <= 0 && y1 >= b;
        if (!intersectT0 && !intersectT1 && !intersectCaps)
            return { intersect: false, t0: Math.min(t0, t1) };
        else if (intersectT0)
            return { intersect: true, t0 };
        else if (intersectT1)
            return { intersect: true, t0: t1 };
        else if (intersectCaps)
            return { intersect: true, t0: Math.min(-p.y / d.y, (b - p.y) / d.y) };
        else
            return { intersect: true, t0: Math.min(t0, t1) };
    }
    circleIntersect(O, D) {
        const b = Vec2.dot(O, D);
        if (b > 0)
            return { intersect: false };
        const c = O.squaredLength() - GUI.boneRadius * GUI.boneRadius;
        if (c > b * b)
            return { intersect: false };
        const t = Math.sqrt(b * b - c);
        return { intersect: true, t0: -b - t, t1: -b + t };
    }
    getRotQuat(bone, inverse, target) {
        if (!target)
            target = new Vec3([0, 1, 0]);
        target.normalize();
        const b = Vec3.difference(bone.endpoint, bone.position).normalize();
        const w = Vec3.dot(b, target);
        const [x, y, z] = inverse ? Vec3.cross(target, b).xyz : Vec3.cross(b, target).xyz;
        const rotQuat = new Quat([x, y, z, w + 1]);
        return rotQuat.normalize();
    }
    getBoneTransformation(bone) {
        const b = Vec3.difference(bone.endpoint, bone.position);
        const scale = new Mat4([GUI.boneRadius, 0, 0, 0, 0, b.length(), 0, 0, 0, 0, GUI.boneRadius, 0, 0, 0, 0, 1]);
        const rot = this.getRotQuat(bone, true);
        const trans = new Mat4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ...bone.position.xyz, 1]);
        return [scale, rot, trans];
    }
    getModeString() {
        switch (this.mode) {
            case Mode.edit: {
                return "edit: " + this.getNumKeyFrames() + " keyframes";
            }
            case Mode.playback: {
                return "playback: " + this.getTime().toFixed(2) + " / " + this.getMaxTime().toFixed(2);
            }
        }
    }
    /**
     * Callback function for the end of a drag event
     * @param mouse
     */
    dragEnd(mouse) {
        this.dragging = false;
        this.prevX = 0;
        this.prevY = 0;
        // TODO
        // Maybe your bone highlight/dragging logic needs to do stuff here too
        this.clicked = false;
    }
    scroll(scroll) {
        if (scroll.offsetX < 800)
            return;
        scroll.preventDefault();
        const h = (2 * this.animation.frameHeight) / this.animation.panelHeight;
        const p = (2 * this.animation.framePadding) / this.animation.panelHeight;
        this.animation.keyFrameStart += scroll.deltaY * 0.001;
        const top = this.animation.keyFrameStart;
        const bottom = this.animation.keyFrameStart - this.getNumKeyFrames() * (h + p);
        const maxTop = top - bottom - 1 + p;
        if (top < 1 || top - bottom < 2) {
            this.animation.keyFrameStart = 1;
        }
        else if (top > maxTop) {
            this.animation.keyFrameStart = maxTop;
        }
        this.animation.initKeyFrames();
    }
    setSkeleton(index, t) {
        // const frame = Math.floor(t);
        const frame = this.animation.times.findIndex((time) => time >= t / this.getMaxTime()) - 1;
        const time = this.animation.times[frame];
        const nextTime = this.animation.times[frame + 1];
        const slerpT = (t / this.getMaxTime() - time) / (nextTime - time);
        const bone = this.animation.getScene().meshes[0].bones[index];
        const initialB = Vec3.difference(bone.initialEndpoint, bone.initialPosition);
        bone.rotation = Quat.slerp(this.keyFrames[frame][index], this.keyFrames[frame + 1][index], slerpT).normalize();
        bone.endpoint = Vec3.sum(bone.position, initialB.multiplyByQuat(bone.rotation));
        bone.children.forEach((c) => {
            const child = this.animation.getScene().meshes[0].bones[c];
            const offset = Vec3.difference(child.initialPosition, bone.initialEndpoint);
            offset.multiplyByQuat(bone.rotation);
            child.position = Vec3.sum(bone.endpoint, offset);
            this.setSkeleton(c, t);
        });
    }
    /**
     * Callback function for a key press event
     * @param key
     */
    onKeydown(key) {
        switch (key.code) {
            case "Digit1": {
                this.animation.setScene("/static/assets/skinning/split_cube.dae");
                break;
            }
            case "Digit2": {
                this.animation.setScene("/static/assets/skinning/long_cubes.dae");
                break;
            }
            case "Digit3": {
                this.animation.setScene("/static/assets/skinning/simple_art.dae");
                break;
            }
            case "Digit4": {
                this.animation.setScene("/static/assets/skinning/mapped_cube.dae");
                break;
            }
            case "Digit5": {
                this.animation.setScene("/static/assets/skinning/robot.dae");
                break;
            }
            case "Digit6": {
                this.animation.setScene("/static/assets/skinning/head.dae");
                break;
            }
            case "Digit7": {
                this.animation.setScene("/static/assets/skinning/wolf.dae");
                break;
            }
            case "KeyW": {
                this.camera.offset(this.camera.forward().negate(), GUI.zoomSpeed, true);
                break;
            }
            case "KeyA": {
                this.camera.offset(this.camera.right().negate(), GUI.zoomSpeed, true);
                break;
            }
            case "KeyS": {
                this.camera.offset(this.camera.forward(), GUI.zoomSpeed, true);
                break;
            }
            case "KeyD": {
                this.camera.offset(this.camera.right(), GUI.zoomSpeed, true);
                break;
            }
            case "KeyR": {
                this.animation.reset();
                break;
            }
            case "ArrowLeft": {
                if (this.intersectedBone.bone) {
                    const bone = this.intersectedBone.bone;
                    const rotAxis = Vec3.difference(bone.endpoint, bone.position);
                    const rotQuat = Quat.fromAxisAngle(rotAxis, -GUI.rollSpeed).normalize();
                    this.rotateBone(bone, rotQuat);
                    this.animation.initCylinder(...this.getBoneTransformation(this.intersectedBone.bone));
                }
                else {
                    this.camera.roll(GUI.rollSpeed, false);
                }
                break;
            }
            case "ArrowRight": {
                if (this.intersectedBone.bone) {
                    const bone = this.intersectedBone.bone;
                    const rotAxis = Vec3.difference(bone.endpoint, bone.position);
                    const rotQuat = Quat.fromAxisAngle(rotAxis, GUI.rollSpeed).normalize();
                    this.rotateBone(bone, rotQuat);
                    this.animation.initCylinder(...this.getBoneTransformation(this.intersectedBone.bone));
                }
                else {
                    this.camera.roll(GUI.rollSpeed, true);
                }
                break;
            }
            case "ArrowUp": {
                this.camera.offset(this.camera.up(), GUI.zoomSpeed, true);
                break;
            }
            case "ArrowDown": {
                this.camera.offset(this.camera.up().negate(), GUI.zoomSpeed, true);
                break;
            }
            case "KeyC": {
                this.fps = !this.fps;
                break;
            }
            case "KeyK": {
                if (this.mode === Mode.edit && this.getNumKeyFrames() < 64) {
                    // TODO
                    // Add keyframe
                    const frame = this.animation.getScene().meshes[0].bones.map((bone) => bone.rotation);
                    this.keyFrames.push(frame);
                    this.keyFrameTextures.push(this.animation.renderTexture());
                    let prev;
                    for (let i = this.animation.times.length - 2; i >= 0; i--) {
                        if (this.animation.lockedTimes[i]) {
                            prev = i;
                            break;
                        }
                    }
                    const p = this.animation.times[prev];
                    const numTicks = this.animation.times.length - prev;
                    let scale = (1 - (1 - p) / numTicks - p) / (1 - p);
                    console.log(p, numTicks, scale);
                    this.animation.times = this.animation.times.map((t, i) => {
                        if (i > prev)
                            return p + (t - p) * scale;
                        return t;
                    });
                    this.animation.times.push(this.animation.times.length ? 1 : 0);
                    if (this.animation.lockedTimes.length > 1)
                        this.animation.lockedTimes[this.animation.lockedTimes.length - 1] = false;
                    this.animation.lockedTimes.push(true);
                    this.animation.initKeyFrames();
                }
                break;
            }
            case "KeyP": {
                if (this.mode === Mode.edit && this.getNumKeyFrames() > 1) {
                    this.mode = Mode.playback;
                    this.time = 0;
                    this.selectedKeyFrame = -1;
                    this.hoveredTick = -1;
                }
                else if (this.mode === Mode.playback) {
                    this.mode = Mode.edit;
                }
                break;
            }
            case "KeyL": {
                if (this.mode === Mode.edit && this.selectedKeyFrame != -1) {
                    this.animation.lockedTimes[this.selectedKeyFrame] = !this.animation.lockedTimes[this.selectedKeyFrame];
                    this.selectedKeyFrame = -1;
                }
            }
            case "KeyU": {
                // update the currently selected keyframe
                // (replace the stored joint orientations with the current ones)
                if (this.selectedKeyFrame != -1) {
                    const frame = this.animation.getScene().meshes[0].bones.map((bone) => bone.rotation);
                    this.keyFrames[this.selectedKeyFrame] = frame;
                    this.keyFrameTextures[this.selectedKeyFrame] = this.animation.renderTexture();
                    this.animation.initKeyFrames();
                    break;
                }
            }
            case "Delete": {
                // delete the selected keyframe
                if (this.selectedKeyFrame != -1) {
                    this.keyFrames.splice(this.selectedKeyFrame, 1);
                    this.keyFrameTextures.splice(this.selectedKeyFrame, 1);
                    this.animation.times.splice(this.selectedKeyFrame, 1);
                    this.animation.lockedTimes.splice(this.selectedKeyFrame, 1);
                    if (this.selectedKeyFrame > this.getNumKeyFrames())
                        this.selectedKeyFrame = -1;
                    const scale = 1 / this.animation.times[this.animation.times.length - 1];
                    this.animation.times = this.animation.times.map((t) => t * scale);
                    if (this.animation.times[0]) {
                        const offset = this.animation.times[0];
                        this.animation.times = this.animation.times.map((t) => t - offset);
                        const scale = 1 / this.animation.times[this.animation.times.length - 1];
                        this.animation.times = this.animation.times.map((t) => t * scale);
                    }
                    this.animation.initKeyFrames();
                }
                break;
            }
            case "Equal": {
                // set the character's pose (in the main window)
                // to that stored in the selected keyframe
                if (this.selectedKeyFrame != -1) {
                    // set skeleton to selected keyframe
                    this.setSkeleton(this.animation.getScene().meshes[0].bones.findIndex((b) => b.parent == -1), this.selectedKeyFrame);
                }
                break;
            }
            default: {
                console.log("Key : '", key.code, "' was pressed.");
                break;
            }
        }
    }
    /**
     * Registers all event listeners for the GUI
     * @param canvas The canvas being used
     */
    registerEventListeners(canvas) {
        /* Event listener for key controls */
        window.addEventListener("keydown", (key) => this.onKeydown(key));
        /* Event listener for mouse controls */
        canvas.addEventListener("mousedown", (mouse) => this.dragStart(mouse));
        canvas.addEventListener("mousemove", (mouse) => this.drag(mouse));
        canvas.addEventListener("mouseup", (mouse) => this.dragEnd(mouse));
        canvas.addEventListener("wheel", (scroll) => this.scroll(scroll));
        /* Event listener to stop the right click menu */
        canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    }
}
GUI.rotationSpeed = 0.05;
GUI.zoomSpeed = 0.1;
GUI.rollSpeed = 0.1;
GUI.panSpeed = 0.1;
GUI.boneRadius = 0.07;
//# sourceMappingURL=Gui.js.map