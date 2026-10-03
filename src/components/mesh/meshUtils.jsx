// Parse binary or ASCII STL
export function parseSTL(buffer) {
  const view = new DataView(buffer);
  // Check if binary STL
  const numTriangles = view.getUint32(80, true);
  const expectedSize = 80 + 4 + numTriangles * 50;

  if (buffer.byteLength === expectedSize || buffer.byteLength === expectedSize + 2) {
    return parseBinarySTL(view, numTriangles);
  }
  // Try ASCII
  const text = new TextDecoder().decode(buffer);
  if (text.trim().startsWith('solid')) {
    return parseASCIISTL(text);
  }
  return parseBinarySTL(view, numTriangles);
}

function parseBinarySTL(view, numTriangles) {
  const vertices = [];
  const faces = [];
  const vertexMap = new Map();

  function getVertexIndex(x, y, z) {
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
    if (vertexMap.has(key)) return vertexMap.get(key);
    const idx = vertices.length;
    vertices.push([x, y, z]);
    vertexMap.set(key, idx);
    return idx;
  }

  let offset = 84;
  for (let i = 0; i < numTriangles; i++) {
    offset += 12; // skip normal
    const faceIndices = [];
    for (let j = 0; j < 3; j++) {
      const x = view.getFloat32(offset, true); offset += 4;
      const y = view.getFloat32(offset, true); offset += 4;
      const z = view.getFloat32(offset, true); offset += 4;
      faceIndices.push(getVertexIndex(x, y, z));
    }
    offset += 2; // attribute byte count
    faces.push(faceIndices);
  }

  return { vertices, faces };
}

function parseASCIISTL(text) {
  const vertices = [];
  const faces = [];
  const vertexMap = new Map();

  function getVertexIndex(x, y, z) {
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
    if (vertexMap.has(key)) return vertexMap.get(key);
    const idx = vertices.length;
    vertices.push([x, y, z]);
    vertexMap.set(key, idx);
    return idx;
  }

  const vertexRegex = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
  let match;
  let currentFace = [];

  while ((match = vertexRegex.exec(text)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const z = parseFloat(match[3]);
    currentFace.push(getVertexIndex(x, y, z));
    if (currentFace.length === 3) {
      faces.push(currentFace);
      currentFace = [];
    }
  }

  return { vertices, faces };
}

// Parse OBJ file
export function parseOBJ(text) {
  const vertices = [];
  const faces = [];

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('v ')) {
      const parts = trimmed.split(/\s+/);
      vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (trimmed.startsWith('f ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      const faceIndices = parts.map(p => {
        const idx = parseInt(p.split('/')[0]);
        return idx > 0 ? idx - 1 : vertices.length + idx;
      });
      // Triangulate if needed
      for (let i = 1; i < faceIndices.length - 1; i++) {
        faces.push([faceIndices[0], faceIndices[i], faceIndices[i + 1]]);
      }
    }
  }

  return { vertices, faces };
}

// Vertex clustering decimation (legacy fallback, not used with WASM engine)
export function decimateMesh(vertices, faces, ratio) {
  if (ratio >= 1) return { vertices: [...vertices], faces: [...faces] };
  if (faces.length < 4) return { vertices: [...vertices], faces: [...faces] };

  // Find bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const [x, y, z] of vertices) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  // Calculate grid resolution based on ratio
  const targetFaces = Math.max(4, Math.round(faces.length * ratio));
  // Approximate: each cell produces ~2 faces, so grid cells ~ targetFaces / 2
  const targetCells = Math.max(2, Math.round(Math.cbrt(targetFaces / 2)));
  const cellSize = [
    (maxX - minX) / targetCells || 1,
    (maxY - minY) / targetCells || 1,
    (maxZ - minZ) / targetCells || 1,
  ];

  // Assign vertices to grid cells
  const cellMap = new Map();
  const vertexToCell = new Array(vertices.length);

  for (let i = 0; i < vertices.length; i++) {
    const [x, y, z] = vertices[i];
    const cx = Math.floor((x - minX) / cellSize[0]);
    const cy = Math.floor((y - minY) / cellSize[1]);
    const cz = Math.floor((z - minZ) / cellSize[2]);
    const key = `${cx},${cy},${cz}`;
    vertexToCell[i] = key;

    if (!cellMap.has(key)) {
      cellMap.set(key, { sum: [0, 0, 0], count: 0, index: -1 });
    }
    const cell = cellMap.get(key);
    cell.sum[0] += x;
    cell.sum[1] += y;
    cell.sum[2] += z;
    cell.count++;
  }

  // Create new vertices from cell centroids
  const newVertices = [];
  for (const [key, cell] of cellMap) {
    cell.index = newVertices.length;
    newVertices.push([
      cell.sum[0] / cell.count,
      cell.sum[1] / cell.count,
      cell.sum[2] / cell.count,
    ]);
  }

  // Remap faces
  const newFaces = [];
  const faceSet = new Set();
  for (const face of faces) {
    const a = cellMap.get(vertexToCell[face[0]]).index;
    const b = cellMap.get(vertexToCell[face[1]]).index;
    const c = cellMap.get(vertexToCell[face[2]]).index;
    // Skip degenerate faces
    if (a === b || b === c || a === c) continue;
    const sorted = [a, b, c].sort((x, y) => x - y).join(',');
    if (!faceSet.has(sorted)) {
      faceSet.add(sorted);
      newFaces.push([a, b, c]);
    }
  }

  return { vertices: newVertices, faces: newFaces };
}

// Export to binary STL
export function exportSTL(vertices, faces) {
  const numTriangles = faces.length;
  const bufferSize = 80 + 4 + numTriangles * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // Header
  const header = 'Simplified by Mr Myers Educational Simplifier';
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  }
  view.setUint32(80, numTriangles, true);

  let offset = 84;
  for (const face of faces) {
    const v0 = vertices[face[0]];
    const v1 = vertices[face[1]];
    const v2 = vertices[face[2]];

    // Compute normal
    const ax = v1[0] - v0[0], ay = v1[1] - v0[1], az = v1[2] - v0[2];
    const bx = v2[0] - v0[0], by = v2[1] - v0[1], bz = v2[2] - v0[2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    view.setFloat32(offset, nx / len, true); offset += 4;
    view.setFloat32(offset, ny / len, true); offset += 4;
    view.setFloat32(offset, nz / len, true); offset += 4;

    for (const vi of face) {
      const v = vertices[vi];
      view.setFloat32(offset, v[0], true); offset += 4;
      view.setFloat32(offset, v[1], true); offset += 4;
      view.setFloat32(offset, v[2], true); offset += 4;
    }
    view.setUint16(offset, 0, true); offset += 2;
  }

  return buffer;
}

// Export to OBJ
export function exportOBJ(vertices, faces) {
  let out = '# Simplified by Mr Myers Educational Simplifier\n';
  for (const v of vertices) {
    out += `v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}\n`;
  }
  for (const f of faces) {
    out += `f ${f[0] + 1} ${f[1] + 1} ${f[2] + 1}\n`;
  }
  return out;
}