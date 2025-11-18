// lib/rule30.ts

/**
 * Застосовує Правило 30 Вольфрама.
 * p' = (p_left XOR (p_center OR p_right))
 */
function applyRule30(left: number, center: number, right: number): number {
  return left ^ (center | right);
}

/**
 * НОВЕ: Застосовує Правило 22 Вольфрама.
 * Двійкове представлення: 00010110
 */
function applyRule22(left: number, center: number, right: number): number {
  const pattern = (left << 2) | (center << 1) | right;
  // Ми можемо використовувати бітову маску. 22 = 0b00010110
  // 111(7) -> 0
  // 110(6) -> 0
  // 101(5) -> 0
  // 100(4) -> 1  (біт 4 встановлено)
  // 011(3) -> 0
  // 010(2) -> 1  (біт 2 встановлено)
  // 001(1) -> 1  (біт 1 встановлено)
  // 000(0) -> 0
  if (pattern === 4 || pattern === 2 || pattern === 1) {
    return 1;
  }
  return 0;
  
  /* // Або можна так, через switch (легше читати):
  const patternStr = `${left}${center}${right}`;
  switch (patternStr) {
    case '100': return 1; // 00010110 (біт 4)
    case '010': return 1; // 00010110 (біт 2)
    case '001': return 1; // 00010110 (біт 1)
    default: return 0;
  }
  */
}

/**
 * ЗМІНЕНО: Тепер приймає функцію правила як аргумент
 */
function getNextGeneration(
  currentState: number[], 
  ruleFunc: (l: number, c: number, r: number) => number // <-- ЗМІНЕНО
): number[] {
  const width = currentState.length;
  const nextState = new Array(width).fill(0);

  for (let i = 0; i < width; i++) {
    const left = currentState[(i - 1 + width) % width];
    const center = currentState[i];
    const right = currentState[(i + 1) % width];

    // ЗМІНЕНО: Викликаємо передану функцію правила
    nextState[i] = ruleFunc(left, center, right);
  }
  return nextState;
}

/**
 * (Ця функція без змін)
 * Створює початковий "seed" (зерно) для автомата з ключа користувача.
 */
export function createSeedFromKey(key: string, width: number): number[] {
  const seed = new Array(width).fill(0);
  if (!key) {
    seed[Math.floor(width / 2)] = 1;
    return seed;
  }

  const keyBytes = new TextEncoder().encode(key);
  for (let i = 0; i < width; i++) {
    seed[i] = keyBytes[i % keyBytes.length] % 2;
  }
  return seed;
}

/**
 * ЗМІНЕНО: Тепер приймає функцію правила як аргумент
 */
export function generateKeystream(
  seed: number[], 
  byteLength: number,
  ruleFunc: (l: number, c: number, r: number) => number // <-- ЗМІНЕНО
): Uint8Array {
  const keystream = new Uint8Array(byteLength);
  let currentState = [...seed];
  let bitBuffer: number[] = [];

  let byteIndex = 0;
  while (byteIndex < byteLength) {
    // ЗМІНЕНО: Передаємо 'ruleFunc'
    currentState = getNextGeneration(currentState, ruleFunc);
    
    const centralBit = currentState[Math.floor(currentState.length / 2)];
    bitBuffer.push(centralBit);

    if (bitBuffer.length === 8) {
      const byteValue = parseInt(bitBuffer.join(''), 2);
      keystream[byteIndex] = byteValue;
      
      byteIndex++;
      bitBuffer = [];
    }
  }

  return keystream;
}

// --- ГОЛОВНІ ФУНКЦІЇ ШИФРУВАННЯ ---

const CA_WIDTH = 101; 

// НОВЕ: Тип для вибору правила
export type AutomataRule = 'R30' | 'R22';

// НОВЕ: Допоміжна функція для вибору функції правила
export function getRuleFunction(rule: AutomataRule) {
  switch (rule) {
    case 'R22':
      return applyRule22;
    case 'R30':
    default:
      return applyRule30;
  }
}

// lib/rule30.ts

// ... (Весь код до функції encrypt залишається без змін)

// НОВЕ: Уніфікований тип вхідних/вихідних даних
type CipherData = string | Uint8Array;

/**
 * УНІВЕРСАЛЬНА функція шифрування
 * @param inputData Вхідні дані (TextEncoder().encode(string) або ArrayBuffer)
 * @param key Ключ
 * @param rule Правило автомата
 * @param isBinary Якщо true, повертає Uint8Array. Інакше повертає Base64-рядок.
 */
export function encrypt(
  inputData: CipherData, 
  key: string, 
  rule: AutomataRule = 'R30',
  isBinary: boolean = false // <-- НОВИЙ АРГУМЕНТ
): CipherData {
    
  // 1. Уніфікація вхідних даних у Uint8Array
  const inputBytes = typeof inputData === 'string' 
    ? new TextEncoder().encode(inputData) 
    : inputData;
    
  const seed = createSeedFromKey(key, CA_WIDTH);
  const ruleFunc = getRuleFunction(rule);

  // 2. Генеруємо keystream тої ж довжини
  const keystream = generateKeystream(seed, inputBytes.length, ruleFunc);

  // 3. Застосовуємо XOR
  const cipherBytes = new Uint8Array(inputBytes.length);
  for (let i = 0; i < inputBytes.length; i++) {
    cipherBytes[i] = inputBytes[i] ^ keystream[i];
  }

  // 4. Вихід: Uint8Array для файлів або Base64 для тексту
  if (isBinary) {
    return cipherBytes;
  } else {
    return btoa(String.fromCharCode.apply(null, Array.from(cipherBytes)));
  }
}

/**
 * УНІВЕРСАЛЬНА функція дешифрування
 */
export function decrypt(
  inputData: CipherData, 
  key: string, 
  rule: AutomataRule = 'R30',
  isBinary: boolean = false // <-- НОВИЙ АРГУМЕНТ
): CipherData {
  
  // 1. Уніфікація вхідних даних у Uint8Array
  const cipherBytes = typeof inputData === 'string'
    ? new Uint8Array(Array.from(atob(inputData), c => c.charCodeAt(0)))
    : inputData;

  const seed = createSeedFromKey(key, CA_WIDTH);
  const ruleFunc = getRuleFunction(rule);

  // 2. Генеруємо ТОЙ САМИЙ keystream
  const keystream = generateKeystream(seed, cipherBytes.length, ruleFunc);

  // 3. Застосовуємо XOR
  const textBytes = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) {
    textBytes[i] = cipherBytes[i] ^ keystream[i];
  }

  // 4. Вихід: Uint8Array для файлів або рядок для тексту
  if (isBinary) {
    return textBytes;
  } else {
    return new TextDecoder().decode(textBytes);
  }
}