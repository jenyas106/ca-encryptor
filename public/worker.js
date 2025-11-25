// public/worker.js

const CA_WIDTH = 101; 
const CA_2D_SIZE = 32;

// --- ФУНКЦІЇ ПРАВИЛ ---

function applyRule30(l, c, r) { return l ^ (c | r); }

// R45: High Diffusion
function applyRule45(l, c, r) {
  return ((1^l) & (1^r)) | ((1^l) & c) | (l & (1^c) & r);
}

// R86: Asymmetric
function applyRule86(l, c, r) { return (l | c) ^ r; }

// R90: Linear
function applyRule90(l, c, r) { return l ^ r; }

// R110: Complex
function applyRule110(l, c, r) { return (c & (1^l)) | (c ^ r); }

// R135: Inverse 120
function applyRule135(l, c, r) { return ((1^l) & ((1^c) | (1^r))) | (l & c & r); }

// --- ГЕНЕРАЦІЯ 1D ---

function getNextGeneration(current_state, ruleName, rowIndex) {
  const width = current_state.length;
  const nextState = new Array(width).fill(0);
  let ruleFunc;
  
  switch (ruleName) {
      case 'R30': ruleFunc = applyRule30; break;
      case 'R45': ruleFunc = applyRule45; break;
      case 'R90': ruleFunc = applyRule90; break;
      case 'R110': ruleFunc = applyRule110; break;
      
      case 'Hybrid30_45': 
          ruleFunc = (rowIndex % 2 === 0) ? applyRule30 : applyRule45; 
          break;
          
      case 'HybridTriad': 
          const mod3 = rowIndex % 3;
          if (mod3 === 0) ruleFunc = applyRule30;
          else if (mod3 === 1) ruleFunc = applyRule86;
          else ruleFunc = applyRule135;
          break;
          
      default: ruleFunc = applyRule30;
  }

  for (let i = 0; i < width; i++) {
    const left = current_state[(i - 1 + width) % width];
    const center = current_state[i];
    const right = current_state[(i + 1) % width];
    nextState[i] = ruleFunc(left, center, right);
  }
  return nextState;
}

// --- 2D GENERATION ---
function getNextGeneration2D(grid) {
    const size = grid.length;
    const newGrid = Array(size).fill(0).map(() => Array(size).fill(0));

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let neighbors = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const ny = (y + dy + size) % size;
                    const nx = (x + dx + size) % size;
                    neighbors += grid[ny][nx];
                }
            }
            const cell = grid[y][x];
            if (cell === 1 && (neighbors === 2 || neighbors === 3)) {
                newGrid[y][x] = 1;
            } else if (cell === 0 && neighbors === 3) {
                newGrid[y][x] = 1;
            } else {
                newGrid[y][x] = 0;
            }
        }
    }
    return newGrid;
}

// --- SEED ---

function createSeedFromKey(key, width) {
  const seed = new Array(width).fill(0);
  if (!key) { seed[Math.floor(width / 2)] = 1; return seed; }
  
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  let val = 0x9E3779B9; 
  for (let i = 0; i < width; i++) {
      val = (val ^ keyBytes[i % keyBytes.length]) * 1664525 + 1013904223;
      seed[i] = (val >>> 31) & 1; 
  }
  return seed;
}

function create2DSeedFromKey(key, size) {
    const grid = Array(size).fill(0).map(() => Array(size).fill(0));
    const flatSeed = createSeedFromKey(key, size * size);
    let idx = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            grid[y][x] = flatSeed[idx++];
        }
    }
    return grid;
}

// --- KEYSTREAM ---

function generateKeystream(seed, byteLength, ruleName, onProgress) {
  const keystream = new Uint8Array(byteLength);
  let bitBuffer = [];
  let byteIndex = 0;
  
  // Оновлюємо прогрес кожні 1% або мінімум кожні 1024 байти
  const updateInterval = Math.max(1024, Math.floor(byteLength / 100)); 
  let nextUpdate = updateInterval;

  let currentState = Array.isArray(seed[0]) ? null : [...seed];
  let currentGrid = Array.isArray(seed[0]) ? seed.map(row => [...row]) : null;
  let rowIndex = 0;

  while (byteIndex < byteLength) {
    let outputBit = 0;

    if (ruleName === '2D_Life') {
        currentGrid = getNextGeneration2D(currentGrid);
        outputBit = currentGrid[Math.floor(CA_2D_SIZE/2)][Math.floor(CA_2D_SIZE/2)];
    } else {
        currentState = getNextGeneration(currentState, ruleName, rowIndex);
        outputBit = currentState[Math.floor(currentState.length / 2)];
    }
    
    rowIndex++;
    bitBuffer.push(outputBit);

    if (bitBuffer.length === 8) {
      keystream[byteIndex] = parseInt(bitBuffer.join(''), 2);
      byteIndex++;
      bitBuffer = [];

      if (byteIndex >= nextUpdate) {
          const percent = Math.round((byteIndex / byteLength) * 100);
          onProgress(percent);
          nextUpdate += updateInterval;
      }
    }
  }
  return keystream;
}

// --- HELPERS ---
function bytesToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToBytes(base64) {
    const cleanBase64 = base64.replace(/\s/g, '');
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
}

function toSafeFileName(base64) { return base64.replace(/\//g, '_').replace(/\+/g, '-'); }
function fromSafeFileName(safeBase64) { return safeBase64.replace(/_/g, '/').replace(/-/g, '+'); }

function performXor(inputBytes, key, ruleName, onProgress) {
    let seed;
    if (ruleName === '2D_Life') {
        seed = create2DSeedFromKey(key, CA_2D_SIZE);
    } else {
        seed = createSeedFromKey(key, CA_WIDTH);
    }

    const keystream = generateKeystream(seed, inputBytes.length, ruleName, onProgress);
    
    const outputBytes = new Uint8Array(inputBytes.length);
    for (let i = 0; i < inputBytes.length; i++) {
        outputBytes[i] = inputBytes[i] ^ keystream[i];
    }
    return outputBytes;
}

// --- MAIN HANDLER ---
self.onmessage = function(e) {
    const { data, key, rule, mode, isBinary, fileName, operationId } = e.data;
    
    const startTime = performance.now(); // Start Timer

    try {
        let resultFileName = null;
        let inputBytes;

        if (isBinary) {
            inputBytes = data;
        } else {
            inputBytes = (mode === 'encrypt') ? new TextEncoder().encode(data) : base64ToBytes(data);
        }

        const processedBytes = performXor(
            inputBytes, 
            key, 
            rule, 
            (p) => self.postMessage({ type: 'progress', progress: p })
        );

        if (isBinary && fileName) {
            if (mode === 'encrypt') {
                const nameBytes = new TextEncoder().encode(fileName);
                const encryptedNameBytes = performXor(nameBytes, key, rule, () => {}); 
                resultFileName = toSafeFileName(bytesToBase64(encryptedNameBytes));
            } else {
                try {
                    const encryptedNameBytes = base64ToBytes(fromSafeFileName(fileName));
                    const decryptedNameBytes = performXor(encryptedNameBytes, key, rule, () => {});
                    resultFileName = new TextDecoder().decode(decryptedNameBytes);
                } catch (err) {
                    resultFileName = "decrypted_file"; 
                }
            }
        }
        
        const endTime = performance.now();
        const timeTaken = (endTime - startTime).toFixed(2); // Calculate duration

        const message = {
            type: 'result',
            operationId,
            timeTaken, // Send time back
            fileName: resultFileName
        };

        if (isBinary) {
            message.result = processedBytes;
        } else {
            message.result = (mode === 'encrypt') 
                ? bytesToBase64(processedBytes) 
                : new TextDecoder().decode(processedBytes);
        }
        
        self.postMessage(message);

    } catch (error) {
        self.postMessage({ type: 'error', message: error.message, operationId });
    }
};