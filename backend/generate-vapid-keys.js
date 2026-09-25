import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });

if (!publicJwk.x || !publicJwk.y || !privateJwk.d) {
  throw new Error('Could not generate VAPID keys.');
}

const publicBytes = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(publicJwk.x, 'base64url'),
  Buffer.from(publicJwk.y, 'base64url'),
]);

console.log('VAPID_PUBLIC_KEY=' + publicBytes.toString('base64url'));
console.log('VAPID_PRIVATE_KEY=' + privateJwk.d);
console.log('VAPID_SUBJECT=mailto:request4.support@gmail.com');
