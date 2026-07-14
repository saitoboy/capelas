import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

// ──────────────────────────────────────────────────────────────────────────────
// Criptografia simétrica para segredos que precisam voltar em texto puro —
// hoje, só as chaves da Groq.
//
// AES-256-GCM: além de cifrar, autentica. Se o texto cifrado for adulterado no
// banco, o decrypt lança em vez de devolver lixo silenciosamente.
//
// Formato armazenado: "iv:authTag:cipherText", tudo em hex.
// ──────────────────────────────────────────────────────────────────────────────

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;   // 96 bits — recomendado para GCM
const KEY_LEN = 32;  // 256 bits

// Sal fixo: o segredo já é de alta entropia e vive só no .env, então o sal aqui
// serve apenas para esticar o segredo até 32 bytes, não para proteger senha.
const SALT = 'capela-groq-key';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      'APP_ENCRYPTION_KEY ausente ou curta demais (mínimo 16 caracteres). ' +
      'Gere uma com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  cachedKey = scryptSync(secret, SALT, KEY_LEN);
  return cachedKey;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);

  const cipherText = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), cipherText.toString('hex')].join(':');
}

export function decrypt(stored: string): string {
  const [ivHex, tagHex, dataHex] = stored.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Texto cifrado em formato inválido');
  }

  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Versão exibível de um segredo: "gsk_abc…4f2a".
 * É a única forma da chave que sai da API.
 */
export function maskSecret(secret: string): string {
  if (secret.length <= 12) return '…';
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}
