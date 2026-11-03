import { createProbe, parseProbe, verifyProbe } from './passkeyProbe'

const create = document.querySelector<HTMLButtonElement>('#create')!
const verify = document.querySelector<HTMLButtonElement>('#verify')!
const probe = document.querySelector<HTMLTextAreaElement>('#probe')!
const status = document.querySelector<HTMLParagraphElement>('#status')!

async function run(operation: () => Promise<string>) {
  create.disabled = verify.disabled = true
  status.textContent = 'Waiting for passkey…'
  try {
    status.textContent = await operation()
  } catch (error) {
    status.textContent = error instanceof Error ? `${error.name}: ${error.message}` : 'Probe failed.'
  } finally {
    create.disabled = verify.disabled = false
  }
}

if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials) {
  create.disabled = verify.disabled = true
  status.textContent = 'WebAuthn requires a supported browser and HTTPS (or localhost).'
} else {
  create.onclick = () =>
    void run(async () => {
      const result = await createProbe()
      probe.value = JSON.stringify(result, null, 2)
      return 'Probe created. Verify here, then copy to another browser or device. Keep this disposable passkey until testing is complete.'
    })
  verify.onclick = () =>
    void run(async () => {
      await verifyProbe(parseProbe(probe.value, location.hostname))
      return 'PASS: the selected passkey decrypted the original probe.'
    })
}
