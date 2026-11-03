# Secure sync capability spike

Status: partial; browser/provider compatibility and live Supabase verification are
not established. Tracks [issue #1](https://github.com/geirsagberg/ephermanence/issues/1).
The app still stores spaces locally. Do not implement production sync until the
compatibility prerequisite passes.

## Run the probe

Run `bun run dev` and open `http://localhost:5173/passkey-probe.html`.
This development-only page is excluded from the normal production build. It never
loads the app's space storage and makes no authentication or persistence requests.

1. Create a disposable passkey, explicitly selecting 1Password as its provider.
   The browser will prompt again to evaluate PRF after registration.
2. Verify decryption in the original browser. Copy the complete encrypted JSON.
3. Open the page under the same hostname in each other browser, paste the JSON,
   and verify using the same synced credential. Do not register a replacement.
4. Repeat after closing and reopening the browser. Record browser, OS and
   1Password versions and the exact success or failure message.
5. Keep the disposable credential until testing is complete, then remove it from
   1Password manually. No real space data or account is involved.

For Android, serve the development page through a trusted HTTPS origin accessible
from both devices. Use that hostname from the beginning, including registration;
a localhost credential cannot be used on a different hostname. Do not expose the
Vite development server publicly without access controls. Hosting and the stable
production relying-party domain still need to be chosen.

Record actual decryption, not just a successful passkey prompt:

- Zen desktop: not tested with 1Password.
- Helium desktop: not tested with 1Password.
- Chrome desktop: not tested with 1Password.
- Brave desktop: not tested with 1Password.
- Firefox Android: not tested with 1Password.
- Brave Android: not tested with 1Password.

The fixture contains a credential ID, hostname, random salt, IV, and ciphertext.
PRF output is used locally with HKDF-SHA-256 and AES-GCM, never serialized. It
protects a fixed test message, not a space key. This disposable format is not the
production encryption format. It does not authenticate a user to any server.
Unsupported PRF, cancellation, wrong credentials, and failed decryption must be
reported as failures, never treated as compatible environments.

## Supabase prerequisite

[Supabase's passkey documentation](https://supabase.com/docs/guides/auth/passkeys)
was checked on 3 November 2026. Support is experimental and requires an explicit
client opt-in. Registration requires an existing confirmed, non-anonymous user.
Its two-step API allows the application to run the credential ceremony itself,
then send a response to `verifyRegistration` or `verifyAuthentication`.

That API is a candidate, not proof of a safe integration. The next backend spike
must use a disposable confirmed account and a development Supabase project:

1. Obtain server-generated registration options; request PRF in the local ceremony.
2. Serialize verification fields explicitly. Never send the whole credential or
   unfiltered extension results; PRF results contain the unlocking secret.
3. Authenticate with a fresh server challenge and evaluate PRF locally.
4. Capture outbound requests and establish that neither PRF output nor derived
   keys are present. Verify the session and decrypt the original fixture on a
   second device with the synced credential.

Do not substitute the probe's random local challenges for server authentication.
No Supabase project was configured or changed by this spike. Enrollment, recovery,
lock/sign-out behavior, and conflict UX remain unresolved as recorded in the issue.

[1Password describes PRF-backed encryption](https://1password.com/blog/encrypt-data-saved-passkeys),
but that announcement is not evidence for the user's current browser matrix.

## Observed proof

- Real Web Crypto tests decrypt a transferred fixture and reject a different key
  and tampered ciphertext. Parser checks reject malformed/wrong-host fixtures.
- Repository formatting, lint and type checks pass; the production build passes
  and does not include the probe page.
- The probe page loads in T3's preview browser. Browser Web Crypto round-trip and
  invalid-input feedback are checked there. This is not a 1Password compatibility
  result and does not establish cross-device behavior.

Remaining gate: run the named browser/device checks with 1Password and the live
Supabase ceremony before selecting the final sync implementation.
