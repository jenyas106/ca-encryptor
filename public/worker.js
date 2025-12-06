// public/worker.js

// Ширина автомата 256 біт (безпечний стандарт)
const CA_WIDTH = 256; 

// --- 1. КРИПТОГРАФІЧНЕ ЗЕРНО (SHA-256) ---
async function createSecureSeed(key, width, saltIndex) {
    const encoder = new TextEncoder();
    const dataToHash = encoder.encode(key + `_layer_${saltIndex}_secure`);
    
    const hashBuffer = await self.crypto.subtle.digest('SHA-256', dataToHash);
    const hashArray = new Uint8Array(hashBuffer);
    
    const seed = new Array(width).fill(0);
    for (let i = 0; i < width; i++) {
        const byteIndex = Math.floor(i / 8) % hashArray.length;
        const bitPos = i % 8;
        seed[i] = (hashArray[byteIndex] >> bitPos) & 1;
    }
    seed[Math.floor(width / 2)] = 1;
    return seed;
}

// --- 2. УНІВЕРСАЛЬНА ФУНКЦІЯ ПРАВИЛА ---
function applyGenericRule(ruleNumber, left, center, right) {
    const idx = (left << 2) | (center << 1) | right;
    return (ruleNumber >> idx) & 1;
}

function getNextGeneration(current_state, ruleNumber) {
    const width = current_state.length;
    const nextState = new Array(width);
    for (let i = 0; i < width; i++) {
        const left = current_state[(i - 1 + width) % width];
        const center = current_state[i];
        const right = current_state[(i + 1) % width];
        nextState[i] = applyGenericRule(ruleNumber, left, center, right);
    }
    return nextState;
}

// --- ГЕНЕРАЦІЯ ПОТОКУ (KEYSTREAM) ---
async function generateKeystream(byteLength, key, rulesArray, onProgress) {
    const keystream = new Uint8Array(byteLength);
    
    const currentStates = await Promise.all(
        rulesArray.map((_, idx) => createSecureSeed(key, CA_WIDTH, idx))
    );

    let bitBuffer = 0;
    let bitsFilled = 0;
    let lastProgress = 0;

    for (let i = 0; i < byteLength; i++) {
        let gammaByte = 0;
        
        for (let b = 0; b < 8; b++) {
            let gammaBit = 0;
            const centerIdx = Math.floor(CA_WIDTH / 2);
            
            for (let r = 0; r < currentStates.length; r++) {
                currentStates[r] = getNextGeneration(currentStates[r], rulesArray[r]);
                gammaBit ^= currentStates[r][centerIdx];
            }
            
            gammaByte = (gammaByte << 1) | gammaBit;
        }
        
        keystream[i] = gammaByte;

        if (onProgress && i % 5000 === 0) {
            const p = Math.floor((i / byteLength) * 100);
            if (p !== lastProgress) {
                onProgress(p);
                lastProgress = p;
            }
        }
    }
    
    return keystream;
}

// --- ХЕЛПЕРИ ДЛЯ ІМЕН ФАЙЛІВ ---
function toSafeBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromSafeBase64(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// --- ГОЛОВНИЙ ПРОЦЕС ---
self.onmessage = async function(e) {
    const { data, key, rule, mode, isBinary, fileName, operationId } = e.data;

    try {
        let rulesArray = [];
        if (typeof rule === 'string') {
             const cleanRule = rule.replace(/[^\d\s,]/g, '');
             rulesArray = cleanRule.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
        }
        
        if (!rulesArray.length) {
             if (rule === 'XOR-MIX') rulesArray = [30, 86];
             else if (rule.includes('30 86 75')) rulesArray = [30, 86, 75];
             else rulesArray = [30];
        }

        let inputBytes;
        if (isBinary) {
            inputBytes = data;
        } else {
            inputBytes = (mode === 'encrypt') 
                ? new TextEncoder().encode(data) 
                : Uint8Array.from(atob(data), c => c.charCodeAt(0));
        }

        const keystream = await generateKeystream(
            inputBytes.length, 
            key, 
            rulesArray, 
            (p) => self.postMessage({ type: 'progress', progress: p, operationId })
        );

        const outputBytes = new Uint8Array(inputBytes.length);
        for (let i = 0; i < inputBytes.length; i++) {
            outputBytes[i] = inputBytes[i] ^ keystream[i];
        }

        let resultFileName = null;
        
        if (isBinary && fileName) {
            if (mode === 'encrypt') {
                const nameBytes = new TextEncoder().encode(fileName);
                const nameKeystream = await generateKeystream(nameBytes.length, "FILENAME_" + key, rulesArray, null);
                const encryptedNameBytes = new Uint8Array(nameBytes.length);
                for(let i=0; i<nameBytes.length; i++) encryptedNameBytes[i] = nameBytes[i] ^ nameKeystream[i];
                
                // ВИПРАВЛЕНО: Більше не додаємо .enc тут, це зробить інтерфейс
                resultFileName = toSafeBase64(encryptedNameBytes); 
                
            } else {
                const cleanName = fileName.replace(/\.enc$/, '');
                try {
                    const encryptedNameBytes = fromSafeBase64(cleanName);
                    const nameKeystream = await generateKeystream(encryptedNameBytes.length, "FILENAME_" + key, rulesArray, null);
                    
                    const decryptedNameBytes = new Uint8Array(encryptedNameBytes.length);
                    for(let i=0; i<encryptedNameBytes.length; i++) decryptedNameBytes[i] = encryptedNameBytes[i] ^ nameKeystream[i];
                    
                    resultFileName = new TextDecoder().decode(decryptedNameBytes);
                } catch (e) {
                    console.error("Name decryption failed:", e);
                    resultFileName = "decrypted_file.bin";
                }
            }
        }

        if (isBinary) {
            self.postMessage({ type: 'result', result: outputBytes, fileName: resultFileName, operationId });
        } else {
            const resStr = (mode === 'encrypt') 
                ? btoa(String.fromCharCode(...outputBytes))
                : new TextDecoder().decode(outputBytes);
            self.postMessage({ type: 'result', result: resStr, operationId });
        }

    } catch (e) {
        self.postMessage({ type: 'error', message: `Worker Error: ${e.message}`, operationId });
    }
};