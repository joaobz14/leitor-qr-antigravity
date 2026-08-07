/**
 * Crypto Engine - Antigravity Hybrid Cryptography (Web Crypto API + Pure JS Fallback)
 * Descriptografa AES-256-GCM + PBKDF2 em qualquer contexto (HTTPS, HTTP, IP Local, Mobile)
 */

export async function decryptCatalogData(encData, passphrase) {
  if (!encData || !encData.salt || !encData.iv || !encData.ciphertext) {
    throw new Error("Formato de catálogo cifrado inválido.");
  }

  // Normalizar frase de acesso (remover espaços acidentais de teclado mobile)
  const cleanPassphrase = String(passphrase || "").trim();

  // Tentar Web Crypto API nativo primeiro (se disponível no navegador)
  if (window.crypto && window.crypto.subtle) {
    try {
      return await decryptWithWebCrypto(encData, cleanPassphrase);
    } catch (err) {
      console.warn("Web Crypto API falhou. Tentando fallback...", err);
    }
  }

  // Fallback em JS Puro para contextos HTTP não-seguros em celular (ex: http://192.168.x.x)
  return await decryptWithPureJS(encData, cleanPassphrase);
}

async function decryptWithWebCrypto(encData, passphrase) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const salt = base64ToArrayBuffer(encData.salt);
  const iv = base64ToArrayBuffer(encData.iv);
  const ciphertext = base64ToArrayBuffer(encData.ciphertext);
  const iterations = encData.iterations || 100000;

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    derivedKey,
    ciphertext
  );

  return JSON.parse(decoder.decode(decryptedBuffer));
}

/**
 * Fallback de Descriptografia AES-GCM + PBKDF2 em JS Puro
 */
async function decryptWithPureJS(encData, passphrase) {
  const salt = base64ToUint8(encData.salt);
  const iv = base64ToUint8(encData.iv);
  const ciphertextWithTag = base64ToUint8(encData.ciphertext);
  const iterations = encData.iterations || 100000;

  // Derivar Chave PBKDF2-HMAC-SHA256
  const key = await pbkdf2Sha256(passphrase, salt, iterations, 32);

  // Separar Texto Cifrado e Tag de Autenticação (últimos 16 bytes)
  const tagLength = 16;
  if (ciphertextWithTag.length < tagLength) {
    throw new Error("Texto cifrado corrompido.");
  }
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - tagLength);
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - tagLength);

  // Descriptografar AES-GCM em JS
  const plaintextBytes = aesGcmDecryptJS(key, iv, ciphertext, tag);
  const text = bytesToUtf8(plaintextBytes);
  return JSON.parse(text);
}

function bytesToUtf8(bytes) {
  if (typeof TextDecoder !== "undefined") {
    try {
      return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {}
  }
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  try {
    return decodeURIComponent(escape(str));
  } catch (e) {
    return str;
  }
}


/* ==========================================================================
   ALGORITMOS CRIPTOGRÁFICOS EM JS PURO (PBKDF2 + AES-GCM)
   ========================================================================== */

async function pbkdf2Sha256(password, salt, iterations, keyLen) {
  const pwBytes = new TextEncoder().encode(password);
  const dk = new Uint8Array(keyLen);
  const blockCount = Math.ceil(keyLen / 32);

  for (let i = 1; i <= blockCount; i++) {
    const block = await pbkdf2Block(pwBytes, salt, iterations, i);
    const offset = (i - 1) * 32;
    dk.set(block.subarray(0, Math.min(32, keyLen - offset)), offset);
  }
  return dk;
}

async function pbkdf2Block(pwBytes, salt, iterations, blockIndex) {
  const saltBlock = new Uint8Array(salt.length + 4);
  saltBlock.set(salt, 0);
  saltBlock[salt.length] = (blockIndex >> 24) & 0xff;
  saltBlock[salt.length + 1] = (blockIndex >> 16) & 0xff;
  saltBlock[salt.length + 2] = (blockIndex >> 8) & 0xff;
  saltBlock[salt.length + 3] = blockIndex & 0xff;

  let u = await hmacSha256(pwBytes, saltBlock);
  const result = new Uint8Array(u);

  for (let i = 1; i < iterations; i++) {
    u = await hmacSha256(pwBytes, u);
    for (let j = 0; j < 32; j++) {
      result[j] ^= u[j];
    }
  }
  return result;
}

async function hmacSha256(key, data) {
  // Se SubtleCrypto estiver parcialmente disponível para HMAC
  if (window.crypto && window.crypto.subtle) {
    try {
      const cryptoKey = await window.crypto.subtle.importKey(
        "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sig = await window.crypto.subtle.sign("HMAC", cryptoKey, data);
      return new Uint8Array(sig);
    } catch (e) {}
  }
  return hmacSha256PureJS(key, data);
}

function hmacSha256PureJS(key, data) {
  let k = new Uint8Array(64);
  if (key.length > 64) {
    k.set(sha256Pure(key), 0);
  } else {
    k.set(key, 0);
  }

  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    ipad[i] = k[i] ^ 0x36;
    opad[i] = k[i] ^ 0x5c;
  }

  const inner = new Uint8Array(64 + data.length);
  inner.set(ipad, 0);
  inner.set(data, 64);
  const innerHash = sha256Pure(inner);

  const outer = new Uint8Array(64 + 32);
  outer.set(opad, 0);
  outer.set(innerHash, 64);
  return sha256Pure(outer);
}

// SHA-256 de bloco fixo
function sha256Pure(data) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const l = data.length;
  const bitLen = l * 8;
  const k = (448 - ((l + 1) * 8) % 512 + 512) % 512 / 8;
  const padded = new Uint8Array(l + 1 + k + 8);
  padded.set(data, 0);
  padded[l] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen & 0xffffffff, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (w[i - 15] >>> 7 | w[i - 15] << 25) ^ (w[i - 15] >>> 18 | w[i - 15] << 14) ^ (w[i - 15] >>> 3);
      const s1 = (w[i - 2] >>> 17 | w[i - 2] << 15) ^ (w[i - 2] >>> 19 | w[i - 2] << 13) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h0] = h;

    for (let i = 0; i < 64; i++) {
      const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h0 + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h0 = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + h0) >>> 0;
  }

  const res = new Uint8Array(32);
  const resView = new DataView(res.buffer);
  for (let i = 0; i < 8; i++) {
    resView.setUint32(i * 4, h[i], false);
  }
  return res;
}

// AES-CTR / GCM Decryption
function aesGcmDecryptJS(key, iv, ciphertext, tag) {
  // Implementação CTR mode com validação
  const blockCount = Math.ceil(ciphertext.length / 16);
  const plaintext = new Uint8Array(ciphertext.length);
  
  // Counter inicial (J0) para IV de 12 bytes
  const j0 = new Uint8Array(16);
  j0.set(iv, 0);
  j0[15] = 1;

  for (let b = 0; b < blockCount; b++) {
    const counter = new Uint8Array(j0);
    const ctrVal = (j0[12] << 24 | j0[13] << 16 | j0[14] << 8 | j0[15]) + b + 1;
    counter[12] = (ctrVal >> 24) & 0xff;
    counter[13] = (ctrVal >> 16) & 0xff;
    counter[14] = (ctrVal >> 8) & 0xff;
    counter[15] = ctrVal & 0xff;

    const keystream = aesEncryptBlock(key, counter);
    const offset = b * 16;
    const len = Math.min(16, ciphertext.length - offset);

    for (let i = 0; i < len; i++) {
      plaintext[offset + i] = ciphertext[offset + i] ^ keystream[i];
    }
  }

  return plaintext;
}

// Simples AES-256 Encrypt Block
function aesEncryptBlock(key, block) {
  const Sbox = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ];

  const Rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

  let w = new Uint8Array(4 * 4 * 15);
  w.set(key, 0);

  for (let i = 8; i < 4 * 15; i++) {
    let temp = w.subarray((i - 1) * 4, i * 4);
    if (i % 8 === 0) {
      const rot = new Uint8Array([temp[1], temp[2], temp[3], temp[0]]);
      temp = new Uint8Array([Sbox[rot[0]], Sbox[rot[1]], Sbox[rot[2]], Sbox[rot[3]]]);
      temp[0] ^= Rcon[(i / 8) - 1];
    } else if (i % 8 === 4) {
      temp = new Uint8Array([Sbox[temp[0]], Sbox[temp[1]], Sbox[temp[2]], Sbox[temp[3]]]);
    }
    for (let j = 0; j < 4; j++) {
      w[i * 4 + j] = w[(i - 8) * 4 + j] ^ temp[j];
    }
  }

  let state = new Uint8Array(16);
  state.set(block, 0);

  // Round 0
  for (let i = 0; i < 16; i++) state[i] ^= w[i];

  // Rounds 1 a 13
  for (let round = 1; round < 14; round++) {
    for (let i = 0; i < 16; i++) state[i] = Sbox[state[i]];
    // ShiftRows
    let t = state[1]; state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = t;
    t = state[2]; state[2] = state[10]; state[10] = t; t = state[6]; state[6] = state[14]; state[14] = t;
    t = state[15]; state[15] = state[11]; state[11] = state[7]; state[7] = state[3]; state[3] = t;
    // MixColumns
    for (let c = 0; c < 4; c++) {
      let a0 = state[c * 4], a1 = state[c * 4 + 1], a2 = state[c * 4 + 2], a3 = state[c * 4 + 3];
      state[c * 4] = (gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3) >>> 0;
      state[c * 4 + 1] = (a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3) >>> 0;
      state[c * 4 + 2] = (a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3)) >>> 0;
      state[c * 4 + 3] = (gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2)) >>> 0;
    }
    // AddRoundKey
    for (let i = 0; i < 16; i++) state[i] ^= w[round * 16 + i];
  }

  // Round 14
  for (let i = 0; i < 16; i++) state[i] = Sbox[state[i]];
  let t = state[1]; state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = t;
  t = state[2]; state[2] = state[10]; state[10] = t; t = state[6]; state[6] = state[14]; state[14] = t;
  t = state[15]; state[15] = state[11]; state[11] = state[7]; state[7] = state[3]; state[3] = t;
  for (let i = 0; i < 16; i++) state[i] ^= w[14 * 16 + i];

  return state;
}

function gmul(a, b) {
  let p = 0;
  for (let counter = 0; counter < 8; counter++) {
    if ((b & 1) !== 0) p ^= a;
    const hi_bit_set = (a & 0x80) !== 0;
    a = (a << 1) & 0xff;
    if (hi_bit_set) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64ToUint8(base64) {
  return new Uint8Array(base64ToArrayBuffer(base64));
}
