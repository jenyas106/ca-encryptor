// public/worker.js

const CA_WIDTH = 101; 

// --- ФУНКЦІЇ ПРАВИЛ ---
function applyRule30(left, center, right) { return left ^ (center | right); }

function applyRule22(left, center, right) {
  const pattern = (left << 2) | (center << 1) | right;
  return (pattern === 4 || pattern === 2 || pattern === 1) ? 1 : 0;
}

function getRuleFunction(rule) {
  switch (rule) {
    case 'R22': return applyRule22;
    case 'R30': default: return applyRule30;
  }
}

function getNextGeneration(current_state, ruleFunc) {
  const width = current_state.length;
  const nextState = new Array(width).fill(0);
  for (let i = 0; i < width; i++) {
    const left = current_state[(i - 1 + width) % width];
    const center = current_state[i];
    const right = current_state[(i + 1) % width];
    nextState[i] = ruleFunc(left, center, right);
  }
  return nextState;
}

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
function generateKeystream(seed, byteLength, ruleFunc, onProgress) {
  const keystream = new Uint8Array(byteLength);
  let currentState = [...seed];
  let bitBuffer = [];
  let byteIndex = 0;
  let lastProgress = 0;
  const reportInterval = Math.max(1, Math.floor(byteLength / 50));

  while (byteIndex < byteLength) {
    currentState = getNextGeneration(currentState, ruleFunc);
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

// --- ХЕЛПЕРИ BASE64 (URL SAFE для імен файлів) ---
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

// Заміна символів, щоб назва файлу була валідною (замість / ставимо _)
function toSafeFileName(base64) {
    return base64.replace(/\//g, '_').replace(/\+/g, '-');
}

function fromSafeFileName(safeBase64) {
    return safeBase64.replace(/_/g, '/').replace(/-/g, '+');
}

// --- УНІВЕРСАЛЬНА ФУНКЦІЯ XOR ---
function performXor(inputBytes, key, rule, onProgress) {
    const seed = createSeedFromKey(key, CA_WIDTH);
    const ruleFunc = getRuleFunction(rule);
    const keystream = generateKeystream(seed, inputBytes.length, ruleFunc, onProgress);
    
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
        let resultData;
        let resultFileName = null;

        // 1. ОБРОБКА ВМІСТУ ФАЙЛУ / ТЕКСТУ
        let inputBytes;
        if (isBinary) {
            inputBytes = data;
        } else {
            inputBytes = (mode === 'encrypt') ? new TextEncoder().encode(data) : base64ToBytes(data);
        }

        // Шифруємо/Дешифруємо основні дані
        const processedBytes = performXor(
            inputBytes, 
            key, 
            rule, 
            (p) => self.postMessage({ type: 'progress', progress: p })
        );

        // 2. ОБРОБКА НАЗВИ ФАЙЛУ (Тільки для бінарного режиму)
        if (isBinary && fileName) {
            if (mode === 'encrypt') {
                // Шифруємо назву: "photo.jpg" -> Bytes -> XOR -> Base64Safe
                const nameBytes = new TextEncoder().encode(fileName);
                // Використовуємо той самий ключ і правило для назви
                const encryptedNameBytes = performXor(nameBytes, key, rule, null); 
                resultFileName = toSafeFileName(bytesToBase64(encryptedNameBytes));
            } else {
                // Дешифруємо назву: "SafeBase64" -> Bytes -> XOR -> "photo.jpg"
                // Спочатку прибираємо розширення .enc (це робиться в page.tsx, сюди приходить чисте ім'я)
                try {
                    const encryptedNameBytes = base64ToBytes(fromSafeFileName(fileName));
                    const decryptedNameBytes = performXor(encryptedNameBytes, key, rule, null);
                    resultFileName = new TextDecoder().decode(decryptedNameBytes);
                } catch (err) {
                    // Якщо назва не зашифрована, або пошкоджена - залишаємо як є або ставимо дефолт
                    console.error("Не вдалося розшифрувати назву", err);
                    resultFileName = "decrypted_file"; 
                }
            }
        }

        // 3. ФОРМУВАННЯ ВІДПОВІДІ
        if (isBinary) {
            self.postMessage({
                type: 'result',
                result: processedBytes, // Uint8Array
                fileName: resultFileName, // Зашифрована або розшифрована назва
                operationId
            });
        } else {
            // Текстовий режим
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