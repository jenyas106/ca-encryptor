// public/worker.js

const CA_WIDTH = 256; 

// --- 1. КРИПТОГРАФІЧНЕ ЗЕРНО (SHA-256) ---
// Залишаємо це, бо це гарантує надійність шифрування
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

// --- 2. ЛОГІКА АВТОМАТА ---
function getNextGeneration(current_state, ruleNumber) {
    const width = current_state.length;
    const nextState = new Array(width);
    for (let i = 0; i < width; i++) {
        const left = current_state[(i - 1 + width) % width];
        const center = current_state[i];
        const right = current_state[(i + 1) % width];
        const idx = (left << 2) | (center << 1) | right;
        nextState[i] = (ruleNumber >> idx) & 1;
    }
    return nextState;
}

// --- ГОЛОВНИЙ ПРОЦЕС ---
self.onmessage = async function(e) {
    const { data, key, rule, mode, isBinary, fileName, operationId } = e.data;

    try {
        // А. Розпізнаємо правила
        let rulesArray = [];
        if (rule === 'XOR-MIX') rulesArray = [30, 86];
        else if (rule === 'TRIPLE-MIX') rulesArray = [30, 86, 101];
        else if (rule === 'R30') rulesArray = [30];
        else if (rule === 'R22') rulesArray = [22];
        else {
            // Custom
            rulesArray = rule.toString().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            if (!rulesArray.length) rulesArray = [30];
        }

        // Б. Підготовка даних
        let inputBytes;
        if (isBinary) {
            inputBytes = data;
        } else {
            inputBytes = (mode === 'encrypt') 
                ? new TextEncoder().encode(data) 
                : Uint8Array.from(atob(data), c => c.charCodeAt(0));
        }

        // В. Ініціалізація станів
        const currentStates = await Promise.all(
            rulesArray.map((_, idx) => createSecureSeed(key, CA_WIDTH, idx))
        );

        const outputBytes = new Uint8Array(inputBytes.length);
        
        let byteIndex = 0;
        let bitBuffer = 0;
        let bitsFilled = 0;
        let lastProgress = 0;

        // Г. Генерація потоку
        while (byteIndex < inputBytes.length) {
            let gammaBit = 0;
            const centerIdx = Math.floor(CA_WIDTH / 2);
            
            for (let r = 0; r < currentStates.length; r++) {
                currentStates[r] = getNextGeneration(currentStates[r], rulesArray[r]);
                gammaBit ^= currentStates[r][centerIdx];
            }

            bitBuffer = (bitBuffer << 1) | gammaBit;
            bitsFilled++;

            if (bitsFilled === 8) {
                const gammaByte = bitBuffer;
                
                // XOR з файлом
                outputBytes[byteIndex] = inputBytes[byteIndex] ^ gammaByte;

                byteIndex++;
                bitBuffer = 0;
                bitsFilled = 0;

                // Оновлення прогресу
                if (byteIndex % 5000 === 0) {
                    const p = Math.floor((byteIndex / inputBytes.length) * 100);
                    if (p !== lastProgress) {
                        self.postMessage({ type: 'progress', progress: p, operationId });
                        lastProgress = p;
                    }
                }
            }
        }

        // Д. Відправка результату (БЕЗ аналізу ентропії)
        let resultFileName = null;
        if (isBinary && fileName) {
             resultFileName = (mode === 'encrypt') ? fileName + ".enc" : fileName.replace(/\.enc$/, '');
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