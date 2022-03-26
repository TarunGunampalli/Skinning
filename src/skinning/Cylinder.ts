import { Mat3, Mat4, Vec3, Vec4 } from "../lib/TSM.js";

/* A potential interface that students should implement */
interface ICylinder {
	positionsFlat(): Float32Array;
	indicesFlat(): Uint32Array;
}

/**
 * Represents a Menger Sponge
 */
export class Cylinder implements ICylinder {
	// TODO: cylinder data structures
	positions: number[];
	indices: number[];

	constructor() {
		// TODO: other initialization
		this.positions = [];
		this.indices = [];
		this.setVBAs();
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
		const n = 10;
		const inc = (2 * Math.PI) / n;
		this.positions.push(1, 0, 0, 0, 1, 0.5, 0, 0, 1, 1, 0, 0);
		for (let theta = inc; theta < 2 * Math.PI; theta += inc) {
			const s = this.positions.length / 4;
			this.positions.push(
				Math.cos(theta + inc),
				0,
				Math.sin(theta + inc),
				0,
				Math.cos(theta + inc),
				0.5,
				Math.sin(theta + inc),
				0,
				Math.cos(theta + inc),
				1,
				Math.sin(theta + inc),
				0
			);
			[0, 3, 1, 3, 4, 1, 1, 4, 2, 4, 5, 2].forEach((i) => this.indices.push(s - 3 + i));
		}
	}
}
