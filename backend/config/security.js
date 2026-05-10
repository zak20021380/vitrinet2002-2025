const DEVELOPMENT_DEFAULTS = {
  JWT_SECRET: 'vitrinet_secret_key',
  CSRF_SECRET: 'vitrinet_csrf_secret_key_2024',
  OTP_HASH_SECRET: 'vitrinet_secret_key'
};

const REQUIRED_SECRET_NAMES = ['JWT_SECRET', 'CSRF_SECRET', 'OTP_HASH_SECRET'];
const MIN_PRODUCTION_SECRET_LENGTH = 32;
const KNOWN_DEVELOPMENT_DEFAULTS = new Set(Object.values(DEVELOPMENT_DEFAULTS));

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

function readRawSecret(name) {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return '';
}

function validateProductionSecrets(rawSecrets) {
  const invalidSecrets = [];

  for (const name of REQUIRED_SECRET_NAMES) {
    const value = rawSecrets[name];
    if (!value) {
      invalidSecrets.push(`${name} is missing`);
    } else if (KNOWN_DEVELOPMENT_DEFAULTS.has(value)) {
      invalidSecrets.push(`${name} cannot use a development default`);
    } else if (value.length < MIN_PRODUCTION_SECRET_LENGTH) {
      invalidSecrets.push(`${name} must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters`);
    }
  }

  if (invalidSecrets.length) {
    throw new Error(`Invalid production security configuration: ${invalidSecrets.join('; ')}.`);
  }
}

const rawSecrets = {
  JWT_SECRET: readRawSecret('JWT_SECRET'),
  CSRF_SECRET: readRawSecret('CSRF_SECRET'),
  OTP_HASH_SECRET: readRawSecret('OTP_HASH_SECRET')
};

if (isProduction) {
  validateProductionSecrets(rawSecrets);
}

const JWT_SECRET = rawSecrets.JWT_SECRET || DEVELOPMENT_DEFAULTS.JWT_SECRET;
const CSRF_SECRET = rawSecrets.CSRF_SECRET || DEVELOPMENT_DEFAULTS.CSRF_SECRET;
const OTP_HASH_SECRET = rawSecrets.OTP_HASH_SECRET || rawSecrets.JWT_SECRET || DEVELOPMENT_DEFAULTS.OTP_HASH_SECRET;

const securityConfig = {
  JWT_SECRET,
  CSRF_SECRET,
  OTP_HASH_SECRET
};

module.exports = securityConfig;
