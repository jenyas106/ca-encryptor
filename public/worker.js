// public/worker.js

const CA_WIDTH = 101; 

// --- ФУНКЦІЇ ПРАВИЛ ---

// Rule 30: Chaos
function applyRule30(left, center, right) {
  return left ^ (center | right);
}

// Rule 110: Complexity
function applyRule110(left, center, right) {
  const pattern = (left << 2) | (center << 1) | right;
  return (pattern === 1 || pattern === 2 || pattern === 3 || pattern === 5 || pattern === 6) ? 1 : 0;
}

// Rule 45: Aggressive Chaos (Class III)
// Бінарний код: 00101101 -> Активні патерни: 0, 2, 3, 5
function applyRule45(left, center, right) {
  const pattern = (left << 2) | (center << 1) | right;
  // Живі клітини: 000, 010, 011, 101
  return (pattern === 0 || pattern === 2 || pattern === 3 || pattern === 5) ? 1 : 0;
}

// Rule 90: Fractal / Linear (Left XOR Right)
function applyRule90(left, center, right) {
  return left ^ right;
}

// --- ВИБІР ПРАВИЛА ---

function getRuleFunction(ruleName) {
  switch (ruleName) {
    case 'R110': return applyRule110;
    case 'R45':  return applyRule45;
    case 'R90':  return applyRule90;
    case 'R30': 
    default: return applyRule30;
  }
}

// --- ГЕНЕРАЦІЯ ПОКОЛІННЯ ---

function getNextGeneration(current_state, ruleName, rowIndex) {
  const width = current_state.length;
  const nextState = new Array(width).fill(0);
  
  let ruleFunc;
  
  if (ruleName === 'Hybrid') {
     // Гібрид А (Класичний): 30 + 110
     ruleFunc = (rowIndex % 2 === 0) ? applyRule30 : applyRule110;
  } else if (ruleName === 'HybridFast') {
     // Гібрид Б (Швидкий): 90 + 45
     // R90 швидко розносить біти, R45 заплутує
     ruleFunc = (rowIndex % 2 === 0) ? applyRule90 : applyRule45;
  } else {
     // Одиночні правила
     ruleFunc = getRuleFunction(ruleName);
  }

  for (let i = 0; i < width; i++) {
    const left = current_state[(i - 1 + width) % width];
    const center = current_state[i];
    const right = current_state[(i + 1) % width];
    nextState[i] = ruleFunc(left, center, right);
  }
  return nextState;
}

// ... (Решта коду worker.js залишається без змін: createSeedFromKey, generateKeystream, performXor, onmessage)
// Скопіюй нижню частину зі свого попереднього файлу, вона не змінилася.
// Але якщо треба - я скину повний файл.

// --- ІНІЦІАЛІЗАЦІЯ (SEED) ---

function createSeedFromKey(key, width) {
  const seed = new Array(width).fill(0);
  if (!key) { seed[Math.floor(width / 2)] = 1; return seed; }
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  for (let i = 0; i < width; i++) {
    seed[i] = keyBytes[i % keyBytes.length] % 2;
  }
  return seed;
}

// --- ГЕНЕРАЦІЯ ПОТОКУ КЛЮЧА ---

function generateKeystream(seed, byteLength, ruleName, onProgress) {
  const keystream = new Uint8Array(byteLength);
  let currentState = [...seed];
  let bitBuffer = [];
  let byteIndex = 0;
  let lastProgress = 0;
  let rowIndex = 0; // Лічильник рядків для гібрида

  const reportInterval = Math.max(1, Math.floor(byteLength / 50));

  while (byteIndex < byteLength) {
    currentState = getNextGeneration(currentState, ruleName, rowIndex);
    rowIndex++;

    bitBuffer.push(currentState[Math.floor(currentState.length / 2)]);

    if (bitBuffer.length === 8) {
      keystream[byteIndex] = parseInt(bitBuffer.join(''), 2);
      byteIndex++;
      bitBuffer = [];

      if (onProgress && byteIndex % reportInterval === 0) {
          const currentProgress = Math.floor((byteIndex / byteLength) * 100);
          if (currentProgress !== lastProgress) {
             onProgress(currentProgress);
             lastProgress = currentProgress;
          }
      }
    }
  }
  return keystream;
}

// --- ХЕЛПЕРИ ---
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
    const seed = createSeedFromKey(key, CA_WIDTH);
    const keystream = generateKeystream(seed, inputBytes.length, ruleName, onProgress);
    
    const outputBytes = new Uint8Array(inputBytes.length);
    for (let i = 0; i < inputBytes.length; i++) {
        outputBytes[i] = inputBytes[i] ^ keystream[i];
    }
    return outputBytes;
}

// --- ГОЛОВНА ЛОГІКА ---
self.onmessage = function(e) {
    const { data, key, rule, mode, isBinary, fileName, operationId } = e.data;

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
                const encryptedNameBytes = performXor(nameBytes, key, rule, null);
                resultFileName = toSafeFileName(bytesToBase64(encryptedNameBytes));
            } else {
                try {
                    const encryptedNameBytes = base64ToBytes(fromSafeFileName(fileName));
                    const decryptedNameBytes = performXor(encryptedNameBytes, key, rule, null);
                    resultFileName = new TextDecoder().decode(decryptedNameBytes);
                } catch (err) {
                    resultFileName = "decrypted_file"; 
                }
            }
        }

        if (isBinary) {
            self.postMessage({
                type: 'result',
                result: processedBytes,
                fileName: resultFileName, 
                operationId
            });
        } else {
            const textResult = (mode === 'encrypt') 
                ? bytesToBase64(processedBytes) 
                : new TextDecoder().decode(processedBytes);
                
            self.postMessage({
                type: 'result',
                result: textResult,
                operationId
            });
        }

    } catch (error) {
        self.postMessage({ type: 'error', message: error.message, operationId });
    }
};