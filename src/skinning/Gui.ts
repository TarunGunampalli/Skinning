import { Camera } from "../lib/webglutils/Camera.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { SkinningAnimation } from "./App.js";
import { Mat4, Vec3, Vec4, Vec2, Mat2, Quat, Mat3 } from "../lib/TSM.js";
import { Bone } from "./Scene.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";
import { ConeBufferGeometry } from "../lib/threejs/src/Three.js";

/**
 * Might be useful for designing any animation GUI
 */
interface IGUI {
	viewMatrix(): Mat4;
	projMatrix(): Mat4;
	dragStart(me: MouseEvent): void;
	drag(me: MouseEvent): void;
	dragEnd(me: MouseEvent): void;
	onKeydown(ke: KeyboardEvent): void;
}

interface Ray {
	pos: Vec3;
	dir: Vec3;
}

interface Intersection {
	intersect: boolean;
	t0?: number;
	t1?: number;
}

interface BoneIntersection {
	bone: Bone;
	t: number;
	bones: Bone[];
	clicked: boolean;
}

export enum Mode {
	playback,
	edit,
}

/**
 * Handles Mouse and Button events along with
 * the the camera.
 */

export class GUI implements IGUI {
	private static readonly rotationSpeed: number = 0.05;
	private static readonly zoomSpeed: number = 0.1;
	private static readonly rollSpeed: number = 0.1;
	private static readonly panSpeed: number = 0.1;
	private static boneRadius = 0.05;

	private camera: Camera;
	private dragging: boolean;
	private fps: boolean;
	private prevX: number;
	private prevY: number;

	private height: number;
	private viewPortHeight: number;
	private width: number;

	private animation: SkinningAnimation;

	private intersectedBone: BoneIntersection;

	public time: number;

	public mode: Mode;

	public hoverX: number = 0;
	public hoverY: number = 0;

	/**
	 *
	 * @param canvas required to get the width and height of the canvas
	 * @param animation required as a back pointer for some of the controls
	 * @param sponge required for some of the controls
	 */
	constructor(canvas: HTMLCanvasElement, animation: SkinningAnimation) {
		this.height = canvas.height;
		this.viewPortHeight = this.height - 200;
		this.width = canvas.width;
		this.prevX = 0;
		this.prevY = 0;

		this.animation = animation;

		this.reset();

		this.registerEventListeners(canvas);
	}

	public getNumKeyFrames(): number {
		// TODO
		// Used in the status bar in the GUI
		return 0;
	}
	public getTime(): number {
		return this.time;
	}

	public getMaxTime(): number {
		// TODO
		// The animation should stop after the last keyframe
		return 0;
	}

	/**
	 * Resets the state of the GUI
	 */
	public reset(): void {
		this.fps = false;
		this.dragging = false;
		this.time = 0;
		this.mode = Mode.edit;
		this.intersectedBone = { bone: undefined, t: -1, bones: [], clicked: false };

		this.camera = new Camera(new Vec3([0, 0, -6]), new Vec3([0, 0, 0]), new Vec3([0, 1, 0]), 45, this.width / this.viewPortHeight, 0.1, 1000.0);
	}

	/**
	 * Sets the GUI's camera to the given camera
	 * @param cam a new camera
	 */
	public setCamera(pos: Vec3, target: Vec3, upDir: Vec3, fov: number, aspect: number, zNear: number, zFar: number) {
		this.camera = new Camera(pos, target, upDir, fov, aspect, zNear, zFar);
	}

	/**
	 * Returns the view matrix of the camera
	 */
	public viewMatrix(): Mat4 {
		return this.camera.viewMatrix();
	}

	/**
	 * Returns the projection matrix of the camera
	 */
	public projMatrix(): Mat4 {
		return this.camera.projMatrix();
	}

	/**
	 * Callback function for the start of a drag event.
	 * @param mouse
	 */
	public dragStart(mouse: MouseEvent): void {
		if (mouse.offsetY > 600) {
			// outside the main panel
			return;
		}

		// TODO
		// Some logic to rotate the bones, instead of moving the camera, if there is a currently highlighted bone
		this.intersectedBone.clicked = !!this.intersectedBone.bone;

		this.dragging = true;
		this.prevX = mouse.screenX;
		this.prevY = mouse.screenY;
	}

	public incrementTime(dT: number): void {
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
	public drag(mouse: MouseEvent): void {
		const mouseRay = this.getMouseRay(mouse.offsetX, mouse.offsetY);

		if (this.dragging) {
			const dx = mouse.screenX - this.prevX;
			const dy = mouse.screenY - this.prevY;
			this.prevX = mouse.screenX;
			this.prevY = mouse.screenY;

			/* Left button, or primary button */
			const mouseDir: Vec3 = this.camera.right();
			mouseDir.scale(-dx);
			mouseDir.add(this.camera.up().scale(dy));
			const mouseLength = mouseDir.length();
			mouseDir.normalize();

			if (dx === 0 && dy === 0) {
				return;
			}

			switch (mouse.buttons) {
				case 1: {
					const { bone, bones, t, clicked } = this.intersectedBone;
					if (clicked) {
						// rotate bone
						const b = Vec3.difference(bone.endpoint, bone.position);
						const l = b.length();
						b.normalize();
						const end = Vec3.sum(mouseRay.pos, mouseRay.dir.scale(t, new Vec3()));
						const newB = Vec3.difference(end, bone.position).normalize();
						const w = Vec3.dot(b, newB);
						const [x, y, z] = Vec3.cross(b, newB).xyz;
						const rotQuat = new Quat([x, y, z, w + 1]);

						this.rotateBone(bone, bones, rotQuat, bone.position);
					} else {
						this.rotateCamera(mouseDir);
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
		if (!this.intersectedBone.clicked) {
			this.intersectedBone = this.findBone(mouseRay);
		}
		this.animation.cylinder.setDraw(!!this.intersectedBone.bone);
		if (this.intersectedBone.bone) {
			this.animation.initCylinder(...this.getBoneMatrices(this.intersectedBone.bone));
		}
	}

	private rotateBone(bone: Bone, bones: Bone[], rotQuat: Quat, newPos: Vec3, roll?: number) {
		rotQuat.normalize();
		// console.log(rotQuat.xyzw);
		const initialB = Vec3.difference(bone.initialEndpoint, bone.initialPosition);
		const l = initialB.length();
		initialB.normalize();
		if (roll) {
			bone.theta += roll;
			bone.rotation = Quat.product(rotQuat, bone.rotation);
			// bone.rotation = this.getRotQuat(bone, true, initialB);
			// const rollQuat = Quat.fromAxisAngle(initialB, bone.theta).normalize();
			// bone.rotation.multiply(rollQuat);
			bone.position = newPos;
			bone.endpoint = Vec3.sum(bone.position, initialB.multiplyByQuat(bone.rotation).normalize().scale(l));
		} else {
			const b = Vec3.difference(bone.endpoint, bone.position).multiplyByQuat(rotQuat).normalize().scale(l);
			bone.position = newPos;
			bone.endpoint = Vec3.sum(bone.position, b);
			const roll = Quat.fromAxisAngle(initialB, bone.theta);
			bone.rotation = this.getRotQuat(bone, true, initialB).multiply(roll);
		}

		bone.children.forEach((c) => {
			const child = bones[c];
			const offset = Vec3.difference(child.initialPosition, bone.initialEndpoint);
			const o = offset.length();
			console.log(o);
			offset.multiplyByQuat(bone.rotation).normalize().scale(o);
			this.rotateBone(child, bones, rotQuat, Vec3.sum(bone.endpoint, offset), roll);
		});
	}

	private rotateCamera(mouseDir: Vec3): void {
		let rotAxis: Vec3 = Vec3.cross(this.camera.forward(), mouseDir);
		rotAxis = rotAxis.normalize();

		if (this.fps) {
			this.camera.rotate(rotAxis, GUI.rotationSpeed);
		} else {
			this.camera.orbitTarget(rotAxis, GUI.rotationSpeed);
		}
	}

	private getMouseRay(x: number, y: number): Ray {
		const ndcX = (2 * x) / this.width - 1;
		const ndcY = 1 - (2 * y) / this.viewPortHeight;
		let mouseDir = new Vec4([ndcX, ndcY, -1, 1]);
		mouseDir.multiplyMat4(this.projMatrix().inverse());
		mouseDir = new Vec4([...mouseDir.xy, -1, 0]);
		mouseDir.multiplyMat4(this.viewMatrix().inverse());
		const dir = new Vec3(mouseDir.xyz).normalize();
		return { pos: this.camera.pos(), dir };
	}

	private findBone(mouseRay: Ray): BoneIntersection {
		const scene = this.animation.getScene();
		let intersectedBone: BoneIntersection = { bone: undefined, t: -1, bones: [], clicked: this.intersectedBone.clicked };
		scene.meshes[0].bones.forEach((bone) => {
			const { intersect, t0: t } = this.boneIntersect(bone, mouseRay);
			if (intersect) {
				if (intersectedBone.t == -1 || t < intersectedBone.t) {
					intersectedBone = {
						bone: this.intersectedBone.clicked ? this.intersectedBone.bone : bone,
						t,
						bones: scene.meshes[0].bones,
						clicked: intersectedBone.clicked,
					};
				}
			}
		});
		return intersectedBone;
	}

	private boneIntersect(bone: Bone, ray: Ray): Intersection {
		const rotQuat = this.getRotQuat(bone, false);
		const p = Vec3.difference(ray.pos, bone.position).multiplyByQuat(rotQuat);
		const d = ray.dir.multiplyByQuat(rotQuat, new Vec3()).normalize();

		const O = new Vec2([p.x, p.z]);
		const D = new Vec2([d.x, d.z]).normalize();
		const circleIntersect = this.circleIntersect(O, D);
		if (!circleIntersect.intersect) return { intersect: false };
		let { t0, t1 } = circleIntersect;
		t0 *= D.x / d.x;
		t1 *= D.x / d.x;
		const y0 = p.y + Math.min(t0 * d.y, t1 * d.y);
		const y1 = p.y + Math.max(t0 * d.y, t1 * d.y);
		const b = Vec3.difference(bone.endpoint, bone.position).length();
		const intersectT0 = y0 >= 0 && y0 <= b;
		const intersectT1 = y1 >= 0 && y1 <= b;
		const intersectCaps = y0 <= 0 && y1 >= b;
		if (!intersectT0 && !intersectT1 && !intersectCaps) return { intersect: false, t0: Math.min(t0, t1) };
		else if (intersectT0) return { intersect: true, t0 };
		else if (intersectT1) return { intersect: true, t0: t1 };
		else if (intersectCaps) return { intersect: true, t0: Math.min(-p.y / d.y, (b - p.y) / d.y) };
		else return { intersect: true, t0: Math.min(t0, t1) };
	}

	private circleIntersect(O: Vec2, D: Vec2): Intersection {
		const b = Vec2.dot(O, D);
		if (b > 0) return { intersect: false };
		const c = O.squaredLength() - 2 * GUI.boneRadius * GUI.boneRadius;
		if (c > b * b) return { intersect: false };
		const t = Math.sqrt(b * b - c);
		return { intersect: true, t0: -b - t, t1: -b + t };
	}

	private getBoneMatrices(bone: Bone): [Mat4, Quat, Mat4] {
		const b = Vec3.difference(bone.endpoint, bone.position);
		const scale = new Mat4([GUI.boneRadius, 0, 0, 0, 0, b.length(), 0, 0, 0, 0, GUI.boneRadius, 0, 0, 0, 0, 1]);
		const rot = this.getRotQuat(bone, true);
		const trans = new Mat4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ...bone.position.xyz, 1]);
		return [scale, rot, trans];
	}

	private getRotQuat(bone: Bone, inverse: Boolean, o?: Vec3): Quat {
		if (!o) o = new Vec3([0, 1, 0]);
		o.normalize();
		const b = Vec3.difference(bone.endpoint, bone.position).normalize();
		const w = Vec3.dot(b, o);
		const [x, y, z] = inverse ? Vec3.cross(o, b).xyz : Vec3.cross(b, o).xyz;
		const rotQuat = new Quat([x, y, z, w + 1]);
		return rotQuat.normalize();
	}

	public getModeString(): string {
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
	public dragEnd(mouse: MouseEvent): void {
		this.dragging = false;
		this.prevX = 0;
		this.prevY = 0;

		// TODO
		// Maybe your bone highlight/dragging logic needs to do stuff here too
		this.intersectedBone.clicked = false;
	}

	/**
	 * Callback function for a key press event
	 * @param key
	 */
	public onKeydown(key: KeyboardEvent): void {
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
					const rotQuat = Quat.fromAxisAngle(rotAxis, -GUI.rollSpeed);
					this.rotateBone(bone, this.intersectedBone.bones, rotQuat, bone.position, -GUI.rollSpeed);
					this.animation.initCylinder(...this.getBoneMatrices(this.intersectedBone.bone));
				} else {
					this.camera.roll(GUI.rollSpeed, false);
				}
				break;
			}
			case "ArrowRight": {
				if (this.intersectedBone.bone) {
					const bone = this.intersectedBone.bone;
					const rotAxis = Vec3.difference(bone.endpoint, bone.initialPosition);
					const rotQuat = Quat.fromAxisAngle(rotAxis, GUI.rollSpeed);
					this.rotateBone(bone, this.intersectedBone.bones, rotQuat, bone.position, GUI.rollSpeed);
					this.animation.initCylinder(...this.getBoneMatrices(this.intersectedBone.bone));
				} else {
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
				if (this.mode === Mode.edit) {
					// TODO
					// Add keyframe
				}
				break;
			}
			case "KeyP": {
				if (this.mode === Mode.edit && this.getNumKeyFrames() > 1) {
					this.mode = Mode.playback;
					this.time = 0;
				} else if (this.mode === Mode.playback) {
					this.mode = Mode.edit;
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
	private registerEventListeners(canvas: HTMLCanvasElement): void {
		/* Event listener for key controls */
		window.addEventListener("keydown", (key: KeyboardEvent) => this.onKeydown(key));

		/* Event listener for mouse controls */
		canvas.addEventListener("mousedown", (mouse: MouseEvent) => this.dragStart(mouse));

		canvas.addEventListener("mousemove", (mouse: MouseEvent) => this.drag(mouse));

		canvas.addEventListener("mouseup", (mouse: MouseEvent) => this.dragEnd(mouse));

		/* Event listener to stop the right click menu */
		canvas.addEventListener("contextmenu", (event: any) => event.preventDefault());
	}
}
