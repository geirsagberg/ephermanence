import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'

import { syncButtonClass, syncDialogClass, syncErrorClass, syncQuietButtonClass } from './SyncDialog.css'
import type { SyncRuntime } from './syncRuntime'

export function useSyncStatus(sync: SyncRuntime) {
  return useSyncExternalStore(sync.subscribe, sync.read)
}

/** Sign-in and passkey setup. Closes itself once this device is connected. */
export function SyncDialog({ sync, open, onClose }: { sync: SyncRuntime; open: boolean; onClose: () => void }) {
  const status = useSyncStatus(sync)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status.type !== 'signed-out') {
      setCodeSent(false)
      setCode('')
    }
  }, [status.type])

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && status.type !== 'connected') {
      if (!dialog?.open) dialog?.showModal()
    } else {
      dialog?.close()
    }
  }, [open, status.type])

  const run = (action: () => Promise<void>) => async (event?: FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialogRef} className={syncDialogClass} aria-label="Sync" onClose={onClose}>
      {status.type === 'signed-out' && !codeSent && (
        <form
          onSubmit={run(async () => {
            await sync.sendCode(email)
            setCodeSent(true)
          })}
        >
          <p>Sync your space between your devices. It is encrypted before it leaves this one.</p>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className={syncButtonClass} disabled={busy}>
            Send code
          </button>
          <button type="button" className={syncQuietButtonClass} disabled={busy} onClick={run(sync.unlock)}>
            Sign in with passkey
          </button>
        </form>
      )}
      {status.type === 'signed-out' && codeSent && (
        <form onSubmit={run(() => sync.verifyCode(email, code.trim()))}>
          <p>Enter the code sent to {email}.</p>
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button type="submit" className={syncButtonClass} disabled={busy}>
            Continue
          </button>
          <button
            type="button"
            className={syncQuietButtonClass}
            onClick={() => {
              setCodeSent(false)
              setCode('')
            }}
          >
            Use another email
          </button>
        </form>
      )}
      {status.type === 'setup' && (
        <form onSubmit={run(status.hasSpace ? sync.unlock : sync.createPasskey)}>
          {status.hasSpace ? (
            <p>Unlock your synced space with your passkey.</p>
          ) : (
            <p>
              Create a passkey to encrypt your space. It is the only key: if you lose it, your synced space is lost.
            </p>
          )}
          <button type="submit" className={syncButtonClass} disabled={busy}>
            {status.hasSpace ? 'Unlock' : 'Create passkey'}
          </button>
        </form>
      )}
      {error && (
        <p className={syncErrorClass} role="alert">
          {error}
        </p>
      )}
    </dialog>
  )
}
