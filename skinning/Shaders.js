export const floorVSText = `
    precision mediump float;

    uniform vec4 uLightPos;
    uniform mat4 uWorld;
    uniform mat4 uView;
    uniform mat4 uProj;
    
    attribute vec4 aVertPos;

    varying vec4 vClipPos;

    void main () {

        gl_Position = uProj * uView * uWorld * aVertPos;
        vClipPos = gl_Position;
    }
`;
export const floorFSText = `
    precision mediump float;

    uniform mat4 uViewInv;
    uniform mat4 uProjInv;
    uniform vec4 uLightPos;

    varying vec4 vClipPos;

    void main() {
        vec4 wsPos = uViewInv * uProjInv * vec4(vClipPos.xyz/vClipPos.w, 1.0);
        wsPos /= wsPos.w;
        /* Determine which color square the position is in */
        float checkerWidth = 5.0;
        float i = floor(wsPos.x / checkerWidth);
        float j = floor(wsPos.z / checkerWidth);
        vec3 color = mod(i + j, 2.0) * vec3(1.0, 1.0, 1.0);

        /* Compute light fall off */
        vec4 lightDirection = uLightPos - wsPos;
        float dot_nl = dot(normalize(lightDirection), vec4(0.0, 1.0, 0.0, 0.0));
	    dot_nl = clamp(dot_nl, 0.0, 1.0);
	
        gl_FragColor = vec4(clamp(dot_nl * color, 0.0, 1.0), 1.0);
    }
`;
export const sceneVSText = `
    precision mediump float;

    attribute vec3 vertPosition;
    attribute vec2 aUV;
    attribute vec3 aNorm;
    attribute vec4 skinIndices;
    attribute vec4 skinWeights;
    attribute vec4 v0;
    attribute vec4 v1;
    attribute vec4 v2;
    attribute vec4 v3;
    
    varying vec4 lightDir;
    varying vec2 uv;
    varying vec4 normal;
 
    uniform vec4 lightPosition;
    uniform mat4 mWorld;
    uniform mat4 mView;
    uniform mat4 mProj;

    uniform vec3 jTrans[64];
    uniform vec4 jRots[64];

    // // https://www.geeks3d.com/20141201/how-to-rotate-a-vertex-by-a-quaternion-in-glsl/
    // vec3 rotVertQuat(vec4 position, vec4 q) { 
    //     vec3 v = position.xyz;
    //     return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
    // }

    vec4 multQuat(vec3 vt, vec4 qr) {
        qr = normalize(qr);
        vec4 qt = vec4(vt.xyz, 0);
        vec3 vr = vec3(qr.xyz);
        float w = qt.w * qr.w - dot(vt, vr);
        vec3 v = qt.w * vr + qr.w * vt + cross(vt, vr);
        vec4 q = vec4(v.xyz, w);
        return q;
    }

    vec3 computeVertex(vec4 v4, vec4 qd, vec4 qr) {
        vec3 v = vec3(v4.xyz);
        vec3 t = vec3(qd.xyz);
        vec3 r = vec3(qr.xyz);
        return v + 2.0 * cross(r, cross(r, v) + qr.w * v) + 2.0 * (qr.w * t - qd.w * r + cross(r, t));
    }

    vec3 computeNormal(vec4 normal, vec4 qd, vec4 qr) {
        vec3 n = vec3(normal.xyz);
        vec3 t = vec3(qd.xyz);
        vec3 r = vec3(qr.xyz);
        return n + 2.0 * cross(r, cross(r, n) + qr.w * n);
    }

    void main () {
        vec4 qdx = 0.5 * multQuat(jTrans[int(skinIndices.x)], jRots[int(skinIndices.x)]);
        vec4 qdy = 0.5 * multQuat(jTrans[int(skinIndices.y)], jRots[int(skinIndices.y)]);
        vec4 qdz = 0.5 * multQuat(jTrans[int(skinIndices.z)], jRots[int(skinIndices.z)]);
        vec4 qdw = 0.5 * multQuat(jTrans[int(skinIndices.w)], jRots[int(skinIndices.w)]);
        // vec4 qd = skinWeights.x * qdx + skinWeights.y * qdy + skinWeights.z * qdz + skinWeights.w * qdw;
        // qd /= skinWeights.x * length(qdx) + skinWeights.y * length(qdy) + skinWeights.z * length(qdz) + skinWeights.w * length(qdw);


        vec4 qrx = jRots[int(skinIndices.x)];
        vec4 qry = jRots[int(skinIndices.y)];
        vec4 qrz = jRots[int(skinIndices.z)];
        vec4 qrw = jRots[int(skinIndices.w)];
        // vec4 qr = skinWeights.x * qrx + skinWeights.y * qry + skinWeights.z * qrz + skinWeights.w * qrw;
        // qr /= length(qd);
        // qr /= skinWeights.x * length(qrx) + skinWeights.y * length(qry) + skinWeights.z * length(qrz) + skinWeights.w * length(qrw);

        // vec4 qr = jRots[int(skinIndices.x)];

        vec3 v = skinWeights.x * computeVertex(v0, qdx, qrx);
        v += skinWeights.y * computeVertex(v1, qdy, qry);
        v += skinWeights.z * computeVertex(v2, qdz, qrz);
        v += skinWeights.w * computeVertex(v3, qdw, qrw);

        vec3 n = skinWeights.x * computeNormal(normal, qdx, qrx);
        n += skinWeights.y * computeNormal(normal, qdy, qry);
        n += skinWeights.z * computeNormal(normal, qdz, qrz);
        n += skinWeights.w * computeNormal(normal, qdw, qrw);
        
        // vec3 v = vertPosition;
        // v = v + 2.0 * cross(r, cross(r, v) + qr.w * v) + 2.0 * (qr.w * t - qd.w * r + cross(r, t));
        // vec3 n = vec3(normal.xyz);
        // vec3 n = vec3((mWorld * normal).xyz);
        // n = n + 2.0 * cross(r, cross(r, n) + qr.w * n);

        // vec4 worldPosition = mWorld * vec4(trans, 1.0);
        vec4 worldPosition = mWorld * vec4(v.xyz, 1.0);
        gl_Position = mProj * mView * worldPosition;
        
        //  Compute light direction and transform to camera coordinates
        lightDir = lightPosition - worldPosition;
        
        vec4 aNorm4 = vec4(aNorm, 0.0);
        normal = normalize(mWorld * vec4(aNorm, 0.0));
        // normal = normalize(mWorld * vec4(n.xyz, 1.0));
        // normal = vec4(n.xyz, 0.0);

        uv = aUV;
    }

`;
export const sceneFSText = `
    precision mediump float;

    varying vec4 lightDir;
    varying vec2 uv;
    varying vec4 normal;

    void main () {
        gl_FragColor = vec4((normal.x + 1.0)/2.0, (normal.y + 1.0)/2.0, (normal.z + 1.0)/2.0,1.0);
    }
`;
export const skeletonVSText = `
    precision mediump float;

    attribute vec3 vertPosition;
    attribute float boneIndex;
    
    uniform mat4 mWorld;
    uniform mat4 mView;
    uniform mat4 mProj;

    uniform vec3 bTrans[64];
    uniform vec4 bRots[64];

    vec3 qtrans(vec4 q, vec3 v) {
        return v + 2.0 * cross(cross(v, q.xyz) - q.w*v, q.xyz);
    }

    void main () {
        int index = int(boneIndex);
        gl_Position = mProj * mView * mWorld * vec4(bTrans[index] + qtrans(bRots[index], vertPosition), 1.0);
    }
`;
export const skeletonFSText = `
    precision mediump float;

    void main () {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
`;
export const sBackVSText = `
    precision mediump float;

    attribute vec2 vertPosition;

    varying vec2 uv;

    void main() {
        gl_Position = vec4(vertPosition, 0.0, 1.0);
        uv = vertPosition;
        uv.x = (1.0 + uv.x) / 2.0;
        uv.y = (1.0 + uv.y) / 2.0;
    }
`;
export const sBackFSText = `
    precision mediump float;

    varying vec2 uv;

    void main () {
        gl_FragColor = vec4(0.1, 0.1, 0.1, 1.0);
        if (abs(uv.y-.33) < .005 || abs(uv.y-.67) < .005) {
            gl_FragColor = vec4(1, 1, 1, 1);
        }
    }

`;
export const cylinderVSText = `
    precision mediump float;

    attribute vec3 aVertPos;

    uniform mat4 uView;
    uniform mat4 uProj;
    
    uniform mat4 uScale;
    uniform mat4 uRot;
    uniform mat4 uTrans;

    void main() {
        gl_Position = uProj * uView * uTrans * uRot * uScale * vec4(cos(aVertPos.x), aVertPos.y, sin(aVertPos.x), 1.0);
    }
`;
export const cylinderFSText = `
    precision mediump float;

    void main () {
        gl_FragColor = vec4(0, 0, 1.0, 1.0);
    }

`;
//# sourceMappingURL=Shaders.js.map