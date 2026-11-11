// Makes the Android app's signing key from one GitHub secret (ANDROID_KEY_SECRET).
//
// Android only installs an update over the app when both are signed with the
// same key. The build used a new throw-away key every time, so each update had
// to be installed fresh (losing the app's data). Here the key is worked out
// from the secret text, so every build gets exactly the same key, and the key
// itself never has to be stored or sent anywhere.
//
// Writes android/zevu-release.p12 (alias "zevu", password = the secret).
import { createHmac, createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import forge from 'node-forge'

const secret = process.env.ANDROID_KEY_SECRET
if (!secret || secret.length < 16) { console.error('ANDROID_KEY_SECRET missing or shorter than 16 characters'); process.exit(1) }

// A deterministic random stream (HMAC-SHA256 in counter mode) seeded by the secret.
const seed = createHash('sha256').update('zevu-android-signing-v1:' + secret).digest()
let counter = 0
let pool = Buffer.alloc(0)
const prng = {
  getBytesSync(n) {
    while (pool.length < n) pool = Buffer.concat([pool, createHmac('sha256', seed).update(String(counter++)).digest()])
    const out = pool.subarray(0, n); pool = pool.subarray(n)
    return out.toString('binary')
  },
}

const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001, prng, algorithm: 'PRIMEINC' })
const cert = forge.pki.createCertificate()
cert.publicKey = keys.publicKey
cert.serialNumber = '01'
cert.validity.notBefore = new Date('2026-01-01T00:00:00Z')
cert.validity.notAfter = new Date('2056-01-01T00:00:00Z')
const name = [{ name: 'commonName', value: 'ZEVU' }, { name: 'countryName', value: 'FI' }]
cert.setSubject(name); cert.setIssuer(name)
cert.sign(keys.privateKey, forge.md.sha256.create())

const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], secret, { algorithm: '3des', friendlyName: 'zevu' })
writeFileSync('android/zevu-release.p12', Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'))
const fp = createHash('sha256').update(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary')).digest('hex')
console.log('signing certificate sha256', fp.slice(0, 16) + '…')
