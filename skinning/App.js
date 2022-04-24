import { Debugger } from "../lib/webglutils/Debugging.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { Floor } from "../lib/webglutils/Floor.js";
import { GUI, Mode } from "./Gui.js";
import { sceneFSText, sceneFSTextureText, sceneVSText, floorFSText, floorVSText, skeletonFSText, skeletonVSText, sBackVSText, sBackFSText, cylinderVSText, cylinderFSText, keyFramesFSText, keyFramesVSText, timelineFSText, timelineVSText, scrubberFSText, scrubberVSText, } from "./Shaders.js";
import { Mat4, Vec4 } from "../lib/TSM.js";
import { CLoader } from "./AnimationFileLoader.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";
import { Cylinder } from "./Cylinder.js";
import { Timeline } from "./Timeline.js";
export class SkinningAnimation extends CanvasAnimation {
    constructor(canvas) {
        super(canvas);
        this.canvas2d = document.getElementById("textCanvas");
        this.ctx2 = this.canvas2d.getContext("2d");
        if (this.ctx2) {
            this.ctx2.font = "25px serif";
            this.ctx2.fillStyle = "#ffffffff";
        }
        this.ctx = Debugger.makeDebugContext(this.ctx);
        let gl = this.ctx;
        this.times = [];
        this.lockedTimes = [];
        this.floor = new Floor();
        this.cylinder = new Cylinder();
        this.timeline = new Timeline(this.times);
        this.floorRenderPass = new RenderPass(this.extVAO, gl, floorVSText, floorFSText);
        this.sceneRenderPass = new RenderPass(this.extVAO, gl, sceneVSText, sceneFSText);
        this.skeletonRenderPass = new RenderPass(this.extVAO, gl, skeletonVSText, skeletonFSText);
        this.cylinderRenderPass = new RenderPass(this.extVAO, gl, cylinderVSText, cylinderFSText);
        this.gui = new GUI(this.canvas2d, this);
        this.lightPosition = new Vec4([-10, 10, -10, 1]);
        this.backgroundColor = new Vec4([0.0, 0.37254903, 0.37254903, 1.0]);
        this.initFloor();
        this.scene = new CLoader("");
        // Status bar
        this.sBackRenderPass = new RenderPass(this.extVAO, gl, sBackVSText, sBackFSText);
        this.timelineRenderPass = new RenderPass(this.extVAO, gl, timelineVSText, timelineFSText);
        this.scrubberRenderPass = new RenderPass(this.extVAO, gl, scrubberVSText, scrubberFSText);
        // TODO
        // Other initialization, for instance, for the bone highlighting
        this.keyFrameStart = 1;
        this.panelWidth = 320;
        this.panelHeight = 800;
        this.frameWidth = 260;
        this.frameHeight = 195;
        this.framePadding = 25;
        this.initGui();
        this.millis = new Date().getTime();
    }
    getScene() {
        return this.scene;
    }
    /**
     * Setup the animation. This can be called again to reset the animation.
     */
    reset() {
        this.times = [];
        this.gui.reset();
        this.setScene(this.loadedScene);
    }
    initGui() {
        // Status bar background
        let verts = new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]);
        this.sBackRenderPass.setIndexBufferData(new Uint32Array([1, 0, 2, 2, 0, 3]));
        this.sBackRenderPass.addAttribute("vertPosition", 2, this.ctx.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, verts);
        this.sBackRenderPass.setDrawData(this.ctx.TRIANGLES, 6, this.ctx.UNSIGNED_INT, 0);
        this.sBackRenderPass.setup();
        this.cylinderRenderPass.setIndexBufferData(this.cylinder.indicesFlat());
        this.cylinderRenderPass.addAttribute("aVertPos", 4, this.ctx.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.cylinder.positionsFlat());
        this.cylinderRenderPass.addUniform("uProj", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().all()));
        });
        this.cylinderRenderPass.addUniform("uView", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
        });
        this.cylinderRenderPass.setDrawData(this.ctx.LINES, this.cylinder.indicesFlat().length, this.ctx.UNSIGNED_INT, 0);
    }
    initScene() {
        if (this.scene.meshes.length === 0) {
            return;
        }
        this.initModel();
        this.initSkeleton();
        this.initKeyFrames();
        this.gui.reset();
    }
    /**
     * Sets up the mesh and mesh drawing
     */
    initModel() {
        this.sceneRenderPass = new RenderPass(this.extVAO, this.ctx, sceneVSText, sceneFSText);
        let faceCount = this.scene.meshes[0].geometry.position.count / 3;
        let fIndices = new Uint32Array(faceCount * 3);
        for (let i = 0; i < faceCount * 3; i += 3) {
            fIndices[i] = i;
            fIndices[i + 1] = i + 1;
            fIndices[i + 2] = i + 2;
        }
        this.sceneRenderPass.setIndexBufferData(fIndices);
        this.sceneRenderPass.addAttribute("vertPosition", 3, this.ctx.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.position.values);
        this.sceneRenderPass.addAttribute("aNorm", 3, this.ctx.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.normal.values);
        if (this.scene.meshes[0].geometry.uv) {
            this.sceneRenderPass.addAttribute("aUV", 2, this.ctx.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.uv.values);
        }
        else {
            this.sceneRenderPass.addAttribute("aUV", 2, this.ctx.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, new Float32Array(this.scene.meshes[0].geometry.normal.values.length));
        }
        this.sceneRenderPass.addAttribute("skinIndices", 4, this.ctx.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.skinIndex.values);
        this.sceneRenderPass.addAttribute("skinWeights", 4, this.ctx.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.skinWeight.values);
        this.sceneRenderPass.addAttribute("v0", 3, this.ctx.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.v0.values);
        this.sceneRenderPass.addAttribute("v1", 3, this.ctx.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.v1.values);
        this.sceneRenderPass.addAttribute("v2", 3, this.ctx.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.v2.values);
        this.sceneRenderPass.addAttribute("v3", 3, this.ctx.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].geometry.v3.values);
        this.sceneRenderPass.addUniform("lightPosition", (gl, loc) => {
            gl.uniform4fv(loc, this.lightPosition.xyzw);
        });
        this.sceneRenderPass.addUniform("mWorld", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(new Mat4().setIdentity().all()));
        });
        this.sceneRenderPass.addUniform("mProj", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().all()));
        });
        this.sceneRenderPass.addUniform("mView", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
        });
        this.sceneRenderPass.addUniform("jTrans", (gl, loc) => {
            gl.uniform3fv(loc, this.scene.meshes[0].getBoneTranslations());
        });
        this.sceneRenderPass.addUniform("jRots", (gl, loc) => {
            gl.uniform4fv(loc, this.scene.meshes[0].getBoneRotations());
        });
        if (this.scene.meshes[0].imgSrc) {
            this.sceneRenderPass.addTextureMap(this.scene.meshes[0].imgSrc, sceneVSText, sceneFSTextureText);
        }
        this.sceneRenderPass.setDrawData(this.ctx.TRIANGLES, this.scene.meshes[0].geometry.position.count, this.ctx.UNSIGNED_INT, 0);
        this.sceneRenderPass.setup();
    }
    /**
     * Sets up the skeleton drawing
     */
    initSkeleton() {
        this.skeletonRenderPass.setIndexBufferData(this.scene.meshes[0].getBoneIndices());
        this.skeletonRenderPass.addAttribute("vertPosition", 3, this.ctx.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].getBonePositions());
        this.skeletonRenderPass.addAttribute("boneIndex", 1, this.ctx.FLOAT, false, 1 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.scene.meshes[0].getBoneIndexAttribute());
        this.skeletonRenderPass.addUniform("mWorld", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(Mat4.identity.all()));
        });
        this.skeletonRenderPass.addUniform("mProj", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().all()));
        });
        this.skeletonRenderPass.addUniform("mView", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
        });
        this.skeletonRenderPass.addUniform("bTrans", (gl, loc) => {
            gl.uniform3fv(loc, this.getScene().meshes[0].getBoneTranslations());
        });
        this.skeletonRenderPass.addUniform("bRots", (gl, loc) => {
            gl.uniform4fv(loc, this.getScene().meshes[0].getBoneRotations());
        });
        this.skeletonRenderPass.setDrawData(this.ctx.LINES, this.scene.meshes[0].getBoneIndices().length, this.ctx.UNSIGNED_INT, 0);
        this.skeletonRenderPass.setup();
    }
    /**
     * Sets up the floor drawing
     */
    initFloor() {
        this.floorRenderPass.setIndexBufferData(this.floor.indicesFlat());
        this.floorRenderPass.addAttribute("aVertPos", 4, this.ctx.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.floor.positionsFlat());
        this.floorRenderPass.addUniform("uLightPos", (gl, loc) => {
            gl.uniform4fv(loc, this.lightPosition.xyzw);
        });
        this.floorRenderPass.addUniform("uWorld", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(Mat4.identity.all()));
        });
        this.floorRenderPass.addUniform("uProj", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().all()));
        });
        this.floorRenderPass.addUniform("uView", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
        });
        this.floorRenderPass.addUniform("uProjInv", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().inverse().all()));
        });
        this.floorRenderPass.addUniform("uViewInv", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().inverse().all()));
        });
        this.floorRenderPass.setDrawData(this.ctx.TRIANGLES, this.floor.indicesFlat().length, this.ctx.UNSIGNED_INT, 0);
        this.floorRenderPass.setup();
    }
    /**
     * Sets up the cylinder drawing
     */
    initCylinder(scale, rot, trans) {
        this.cylinderRenderPass.addUniform("uScale", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(scale.all()));
        });
        this.cylinderRenderPass.addUniform("uRot", (gl, loc) => {
            gl.uniform4fv(loc, new Float32Array(rot.xyzw));
        });
        this.cylinderRenderPass.addUniform("uTrans", (gl, loc) => {
            gl.uniformMatrix4fv(loc, false, new Float32Array(trans.all()));
        });
        this.cylinderRenderPass.setup();
    }
    /**
     * Sets up the key frames drawing
     */
    initKeyFrames() {
        const numFrames = this.getGUI().getNumKeyFrames();
        const keyFrameTextures = this.getGUI().keyFrameTextures;
        const w = this.frameWidth / this.panelWidth;
        const h = (2 * this.frameHeight) / this.panelHeight;
        const p = (2 * this.framePadding) / this.panelHeight;
        this.keyFrameRenderPasses = [];
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
            keyFrameRenderPass.addUniform("w", (gl, loc) => {
                gl.uniform1f(loc, i == this.getGUI().selectedKeyFrame ? 0.8 : 1);
            });
            keyFrameRenderPass.setIndexBufferData(new Uint32Array(indicesFlat));
            keyFrameRenderPass.addUniform("origin", (gl, loc) => {
                gl.uniform2fv(loc, new Float32Array(origin));
            });
            keyFrameRenderPass.addAttribute("vertPosition", 2, this.ctx.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, new Float32Array(positionsFlat));
            keyFrameRenderPass.setDrawData(this.ctx.TRIANGLES, indicesFlat.length, this.ctx.UNSIGNED_INT, 0);
            keyFrameRenderPass.setup();
            this.keyFrameRenderPasses[i] = keyFrameRenderPass;
        }
        this.initTimeline();
    }
    renderTexture() {
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
        const bg = this.backgroundColor;
        gl.clearColor(bg.r, bg.g, bg.b, bg.a);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CCW);
        gl.cullFace(gl.BACK);
        this.drawScene(0, 0, 260, 195);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fb);
        return targetTexture;
    }
    initTimeline() {
        this.timelineRenderPass = new RenderPass(this.extVAO, this.ctx, timelineVSText, timelineFSText);
        this.timeline.setVBAs(this.times);
        this.timelineRenderPass.setIndexBufferData(this.timeline.indicesFlat());
        this.timelineRenderPass.addAttribute("vertPosition", 2, this.ctx.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, this.timeline.positionsFlat());
        const colorIndices = [];
        for (let i = 0; i < (this.times.length + 1) * 2; i++) {
            colorIndices.push(i);
        }
        this.timelineRenderPass.addAttribute("index", 1, this.ctx.FLOAT, false, Float32Array.BYTES_PER_ELEMENT, 0, undefined, new Float32Array(colorIndices));
        const selected = this.getGUI().selectedKeyFrame == -1 ? -1 : (this.timeline.transform(this.times[this.getGUI().selectedKeyFrame]) / 2 + 0.4) * 1.25;
        const hovered = this.getGUI().hoveredTick == -1 ? -1 : (this.timeline.transform(this.times[this.getGUI().hoveredTick]) / 2 + 0.4) * 1.25;
        const colors = [1, 1, 1, 1, 1, 1, 1, 1];
        this.times.forEach((t, i) => {
            if (Math.abs(t - selected) < 0.001) {
                colors.push(0, 1, 0, 1, 0, 1, 0, 1);
            }
            else if (Math.abs(t - hovered) < 0.001) {
                colors.push(0, 1, 0, 0.5, 0, 1, 0, 0.5);
            }
            else if (this.lockedTimes[i]) {
                colors.push(1, 0, 0, 1, 1, 0, 0, 1);
            }
            else {
                colors.push(1, 1, 1, 1, 1, 1, 1, 1);
            }
        });
        this.timelineRenderPass.addUniform("colors", (gl, loc) => {
            gl.uniform4fv(loc, new Float32Array(colors));
        });
        this.timelineRenderPass.setDrawData(this.ctx.LINES, this.timeline.indicesFlat().length, this.ctx.UNSIGNED_INT, 0);
        this.timelineRenderPass.setup();
    }
    setTime(index, time) {
        if (index <= 0 || index >= this.times.length - 1)
            return;
        const curTime = this.times[index];
        const prevIndex = [...this.times].reverse().findIndex((t, i) => i < index && this.lockedTimes[i]);
        const p = this.times[prevIndex];
        const nextIndex = this.times.findIndex((t, i) => i > index && this.lockedTimes[i]);
        const n = this.times[nextIndex];
        if (time < p || time > n)
            return;
        const prevScale = (time - p) / (curTime - p);
        const nextScale = (n - time) / (n - curTime);
        this.times.forEach((t, i) => {
            if (i <= prevIndex || i >= nextIndex)
                return;
            if (i <= index) {
                this.times[i] = p + (t - p) * prevScale;
            }
            else {
                this.times[i] = n - (n - t) * nextScale;
            }
        });
        this.initTimeline();
    }
    initScrubber() {
        this.scrubberRenderPass = new RenderPass(this.extVAO, this.ctx, scrubberVSText, scrubberFSText);
        this.scrubberRenderPass.setIndexBufferData(new Uint32Array([0, 1]));
        const time = this.timeline.transform(this.getGUI().getTime() / this.getGUI().getMaxTime());
        this.scrubberRenderPass.addAttribute("vertPosition", 2, this.ctx.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0, undefined, new Float32Array([time, 0.53, time, 0.83]));
        this.scrubberRenderPass.setDrawData(this.ctx.LINES, 2, this.ctx.UNSIGNED_INT, 0);
        this.scrubberRenderPass.setup();
    }
    /** @internal
     * Draws a single frame
     *
     */
    draw() {
        const GUI = this.getGUI();
        // Advance to the next time step
        let curr = new Date().getTime();
        let deltaT = curr - this.millis;
        this.millis = curr;
        deltaT /= 1000;
        GUI.incrementTime(deltaT);
        // TODO
        // If the mesh is animating, probably you want to do some updating of the skeleton state here
        if (GUI.mode === Mode.playback) {
            GUI.setSkeleton(this.getScene().meshes[0].bones.findIndex((b) => b.parent == -1), GUI.getTime());
        }
        // draw the status message
        if (this.ctx2) {
            this.ctx2.clearRect(0, 0, this.ctx2.canvas.width, this.ctx2.canvas.height);
            if (this.scene.meshes.length > 0) {
                this.ctx2.fillText(this.getGUI().getModeString(), 50, 710);
            }
        }
        // Drawing
        const gl = this.ctx;
        const bg = this.backgroundColor;
        gl.clearColor(bg.r, bg.g, bg.b, bg.a);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.frontFace(gl.CCW);
        gl.cullFace(gl.BACK);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // null is the default frame buffer
        this.drawScene(0, 200, 800, 600);
        /* Draw status bar */
        if (this.scene.meshes.length > 0) {
            gl.viewport(0, 0, 800, 200);
            if (GUI.mode === Mode.playback) {
                this.initScrubber();
                this.scrubberRenderPass.draw();
            }
            this.timelineRenderPass.draw();
            this.sBackRenderPass.draw();
        }
        if (this.getGUI().getNumKeyFrames() > 0) {
            gl.viewport(800, 0, this.panelWidth, this.panelHeight);
            this.keyFrameRenderPasses.forEach((rp) => {
                rp.draw();
            });
            // gl.clear();
        }
    }
    drawScene(x, y, width, height) {
        const gl = this.ctx;
        gl.viewport(x, y, width, height);
        this.floorRenderPass.draw();
        /* Draw Scene */
        if (this.scene.meshes.length > 0) {
            this.sceneRenderPass.draw();
            gl.disable(gl.DEPTH_TEST);
            this.skeletonRenderPass.draw();
            // TODO
            // Also draw the highlighted bone (if applicable)
            if (this.cylinder.draw && this.getGUI().mode === Mode.edit)
                this.cylinderRenderPass.draw();
            gl.enable(gl.DEPTH_TEST);
        }
    }
    getGUI() {
        return this.gui;
    }
    /**
     * Loads and sets the scene from a Collada file
     * @param fileLocation URI for the Collada file
     */
    setScene(fileLocation) {
        this.loadedScene = fileLocation;
        this.scene = new CLoader(fileLocation);
        this.scene.load(() => this.initScene());
    }
}
export function initializeCanvas() {
    const canvas = document.getElementById("glCanvas");
    /* Start drawing */
    const canvasAnimation = new SkinningAnimation(canvas);
    canvasAnimation.start();
    canvasAnimation.setScene("/static/assets/skinning/split_cube.dae");
}
//# sourceMappingURL=App.js.map