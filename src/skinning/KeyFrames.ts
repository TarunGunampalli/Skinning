import { Mat3, Mat4, Quat, Vec3, Vec4 } from "../lib/TSM.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";

/* A potential interface that students should implement */
interface IKeyFrames {
	positionsFlat(): Float32Array;
	indicesFlat(): Uint32Array;
}

/**
 * Represents a Menger Sponge
 */
export class KeyFrames implements IKeyFrames {
	// TODO: cylinder data structures
	positions: number[];
	indices: number[];
	ctx: WebGLRenderingContext;
	frames: Quat[][];
	textures: WebGLTexture[];
	keyFrameStart: number;
	panelWidth: number;
	panelHeight: number;
	frameWidth: number;
	frameHeight: number;
	framePadding: number;
	viewPortWidth: number;

	constructor(ctx: WebGLRenderingContext) {
		// TODO: other initialization
		this.positions = [];
		this.indices = [];
		this.ctx = ctx;
		this.frames = [];
		this.keyFrameStart = 1;
		this.panelWidth = 320;
		this.panelHeight = 800;
		this.frameWidth = 260;
		this.frameHeight = 195;
		this.framePadding = 25;
		this.setVBAs();
	}

	public length(): number {
		return this.frames.length;
	}

	/* Returns a flat Float32Array of the cylinder's vertex positions */
	public positionsFlat(): Float32Array {
		return new Float32Array(this.positions);
	}

	/**
	 * Returns a flat Uint32Array of the cylinder's face indices
	 */
	public indicesFlat(): Uint32Array {
		return new Uint32Array(this.indices);
	}

	/**
	 * Returns the model matrix of the cylinder
	 */
	public uMatrix(): Mat4 {
		// TODO: change this, if it's useful
		const ret: Mat4 = new Mat4().setIdentity();

		return ret;
	}

	private setVBAs() {
		const n = 6;
		const inc = (2 * Math.PI) / n;
		this.positions.push(0, 0, 0, 0, 0, 0.5, 0, 0, 0, 1, 0, 0);
		for (let theta = inc; theta <= 2 * Math.PI; theta += inc) {
			const s = this.positions.length / 4;
			this.positions.push(theta, 0, 0, 0, theta, 0.5, 0, 0, theta, 1, 0, 0);
			[0, 1, 1, 2, 3, 4, 4, 5, 0, 3, 1, 4, 2, 5].forEach((i) => this.indices.push(s - 3 + i));
		}
	}

	public initKeyFrames(): RenderPass[] {
		const numFrames = this.frames.length;
		const keyFrameTextures = this.textures;
		const w = this.frameWidth / this.panelWidth;
		const h = (2 * this.frameHeight) / this.panelHeight;
		const p = (2 * this.framePadding) / this.panelHeight;
		const keyFrameRenderPasses: RenderPass[] = [];

		for (let i = 0; i < numFrames; i++) {
			const keyFrameRenderPass = new RenderPass(this.extVAO, this.ctx, keyFramesVSText, keyFramesFSText);
			const positionsFlat = [
				-w,
				this.keyFrameStart - (i + 1) * p - i * h,
				-w,
				this.keyFrameStart - (i + 1) * (p + h),
				w,
				this.keyFrameStart - (i + 1) * p - i * h,
				w,
				this.keyFrameStart - (i + 1) * (p + h),
			];
			const origin = [-w, this.keyFrameStart - (i + 1) * p - (i + 1) * h];
			const indicesFlat = [0, 1, 2, 2, 1, 3];
			keyFrameRenderPass.addTexture(keyFrameTextures[i]);
			keyFrameRenderPass.addUniform("w", (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
				gl.uniform1f(loc, i == this.getGUI().selectedKeyFrame ? 0.8 : 1);
			});
			keyFrameRenderPass.setIndexBufferData(new Uint32Array(indicesFlat));
			keyFrameRenderPass.addUniform("origin", (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
				gl.uniform2fv(loc, new Float32Array(origin));
			});
			keyFrameRenderPass.addAttribute(
				"vertPosition",
				2,
				this.ctx.FLOAT,
				false,
				2 * Float32Array.BYTES_PER_ELEMENT,
				0,
				undefined,
				new Float32Array(positionsFlat)
			);

			keyFrameRenderPass.setDrawData(this.ctx.TRIANGLES, indicesFlat.length, this.ctx.UNSIGNED_INT, 0);
			keyFrameRenderPass.setup();
			keyFrameRenderPasses[i] = keyFrameRenderPass;
		}

		return keyFrameRenderPasses;
	}

	public renderTexture() {
		const gl = this.ctx;
		const targetTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, targetTexture);
		// define size and format of level 0
		const level = 0;
		const internalFormat = gl.RGBA;
		const border = 0;
		const format = gl.RGBA;
		const type = gl.UNSIGNED_BYTE;
		const data = null;
		gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, this.frameWidth, this.frameHeight, border, format, type, data);

		// set the filtering so we don't need mips
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		// Create and bind the framebuffer
		const fb = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

		// attach the texture as the first color attachment
		const attachmentPoint = gl.COLOR_ATTACHMENT0;
		gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, level);

		var renderbuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.frameWidth, this.frameHeight);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

		const bg: Vec4 = this.backgroundColor;
		gl.clearColor(bg.r, bg.g, bg.b, bg.a);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		gl.frontFace(gl.CCW);
		gl.cullFace(gl.BACK);

		this.drawScene(0, 0, this.frameWidth, this.frameHeight);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.deleteFramebuffer(fb);
		return targetTexture;
	}

	public clickKeyFrame(x: number, y: number) {
		const frameHeight = this.frameHeight + this.framePadding;
		const x0 = this.viewPortWidth + this.panelWidth / 2 - this.frameWidth / 2;
		const x1 = this.viewPortWidth + this.panelWidth / 2 + this.frameWidth / 2;
		const offsetY = y + (this.keyFrameStart - 1) * this.panelHeight * 0.5;
		const frameNum = Math.floor(offsetY / frameHeight);
		let clickedKeyFrame = x >= x0 && x <= x1 && offsetY % frameHeight >= this.framePadding && frameNum < this.getNumKeyFrames();
		return clickedKeyFrame ? frameNum : -1;
	}

	public scroll(scroll: WheelEvent): void {
		if (scroll.offsetX < 800) return;
		scroll.preventDefault();

		const h = (2 * this.frameHeight) / this.panelHeight;
		const p = (2 * this.framePadding) / this.panelHeight;

		this.keyFrameStart += scroll.deltaY * 0.001;
		const top = this.keyFrameStart;
		const bottom = this.keyFrameStart - this.getNumKeyFrames() * (h + p);
		const maxTop = top - bottom - 1 + p;

		if (top < 1 || top - bottom < 2) {
			this.keyFrameStart = 1;
		} else if (top > maxTop) {
			this.keyFrameStart = maxTop;
		}

		this.initKeyFrames();
	}
}
