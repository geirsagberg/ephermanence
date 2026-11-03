import { parseProbe } from './passkeyProbe'
import { probeClient, registerSupabaseProbe, verifySupabaseProbe } from './supabaseProbe'

const input = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!
const fixture = document.querySelector<HTMLTextAreaElement>('#fixture')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const buttons = document.querySelectorAll<HTMLButtonElement>('button')

async function run(enroll: boolean) {
  buttons.forEach((button) => { button.disabled = true })
  status.textContent = 'Waiting for Supabase and 1Password…'
  let client: ReturnType<typeof probeClient> | undefined
  try {
    client = probeClient(input('url').value.trim(), input('key').value.trim())
    if (enroll) {
      const password = input('password').value
      input('password').value = ''
      const { error } = await client.auth.signInWithPassword({ email: input('email').value.trim(), password })
      if (error) throw error
      fixture.value = JSON.stringify(await registerSupabaseProbe(client), null, 2)
      status.textContent = 'Registered and encrypted fixture stored. Now verify with the same passkey.'
    } else {
      await verifySupabaseProbe(client, parseProbe(fixture.value, location.hostname))
      status.textContent = 'PASS: Supabase authenticated the passkey and the downloaded fixture decrypted locally.'
    }
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Probe failed.'
  } finally {
    if (client) await client.auth.signOut({ scope: 'local' })
    buttons.forEach((button) => { button.disabled = false })
  }
}

document.querySelector<HTMLFormElement>('#enroll')!.onsubmit = (event) => {
  event.preventDefault()
  void run(true)
}
document.querySelector<HTMLButtonElement>('#verify')!.onclick = () => { void run(false) }
