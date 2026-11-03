# Secure sync capability spike

Status: core capability demonstrated. Zen and Chrome desktop decryption with the
same 1Password passkey is verified. Live Supabase passkey authentication and
local decryption of the downloaded fixture passed (user-reported, 3 November 2026). Restart persistence and cross-device support are assumed unless a
failure is observed; further compatibility testing is not a prerequisite. Tracks [issue #1](https://github.com/geirsagberg/ephermanence/issues/1).
The app still stores spaces locally. Production sync design remains separate from
this disposable capability spike.

## Run the probe

Run `bun run dev` and open `http://localhost:5173/passkey-probe.html`.
This development-only page is excluded from the normal production build. It never
loads the app's space storage and makes no authentication or persistence requests.

1. Create a disposable passkey, explicitly selecting 1Password as its provider.
   The browser will prompt again to evaluate PRF after registration.
2. Verify decryption in the original browser. Copy the complete encrypted JSON.
3. For optional compatibility diagnosis, open the page under the same hostname
   in another browser, paste the JSON, and verify using the same credential.
   Record browser, OS and 1Password versions and the exact result.
4. Keep the disposable credential until testing is complete, then remove it from
   1Password manually. No real space data or account is involved.

If Android compatibility diagnosis becomes necessary, serve the development page through a trusted HTTPS origin accessible
from both devices. Use that hostname from the beginning, including registration;
a localhost credential cannot be used on a different hostname. Do not expose the
Vite development server publicly without access controls. Hosting and the stable
production relying-party domain still need to be chosen.

Record actual decryption, not just a successful passkey prompt:

- Zen desktop: PASS with 1Password (user-reported, 3 November 2026).
- Helium desktop: not tested with 1Password.
- Chrome desktop: PASS with the same 1Password passkey and fixture as Zen
  (user-reported, 3 November 2026).
- Brave desktop: not tested with 1Password.
- Firefox Android: not tested with 1Password.
- Brave Android: not tested with 1Password.

Both desktop checks returned `PASS: the selected passkey decrypted the original probe.`
Browser, OS and extension versions were not recorded. Restart persistence and
cross-device decryption are assumed to work unless a failure is observed; they
have not been verified and are not required checks. The probe accepts 1Password’s plain
array PRF output after validating that it contains exactly 32 integer bytes.

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

The development-only integration page is `/supabase-probe.html`. It uses the
installed Supabase client’s two-step passkey API, with PRF evaluated locally.
Credential verification payloads contain explicitly selected fields and empty
extension results. The client never serializes a whole credential.

### Development project setup

1. Create a disposable Supabase development project.
2. Enable Authentication → Passkeys with display name `Ephermanence probe`,
   relying party ID `localhost`, and origin `http://localhost:5173`.
3. Run `supabase/secure-sync-probe.sql` in that project's SQL editor. It creates
   one fixture row per user, with row-level security for the owning user.
4. Create a disposable confirmed email/password account in the project.
5. Open `http://localhost:5173/supabase-probe.html`. Enter the project URL,
   publishable key (`sb_publishable_…`), and disposable account credentials.
6. Select **Sign in and register passkey**, choosing 1Password. Registration is
   followed by a server-challenged authentication ceremony that evaluates PRF.
   The encrypted fixture is then uploaded to Supabase.
7. Select **Sign in with passkey and decrypt**. This creates a fresh session,
   downloads the user's fixture and decrypts it locally. A PASS requires both
   server authentication and successful decryption of the downloaded ciphertext.

The local-only probe's passkey is not registered with Supabase; enroll a new one
on this page. Keep the fixture text in the page between registration and
verification: it supplies the credential ID and PRF salt. Sessions are held in
memory and signed out after each operation. The table contains only an owner ID
and the encrypted fixture's public metadata. No space data is read or written.
The page is excluded from the normal production build.

Automated tests exercise the actual Supabase client against a simulated server,
capture outgoing request bodies, and verify server-challenge forwarding, explicit
credential serialization, encryption/upload/download/decryption, PRF buffer
clearing, rejected authentication and tampered ciphertext. They do not establish
live Supabase behavior or enforcement of the SQL policies. Live verification
requires the development project and user-approved passkey prompts.

The development project `ulfoxuxzaqjomwnyogdg` is configured with passkeys enabled,
RP ID `localhost`, and origin `http://localhost:5173`. The probe table exists;
RLS and its owner-only policy were confirmed through the Management API. The user
completed the live ceremony and reported:

> PASS: Supabase authenticated the passkey and the downloaded fixture decrypted locally.

This confirms authentication and decryption of the server-stored fixture. Live
network-payload inspection and cross-user RLS enforcement were not tested.
Enrollment, recovery, lock/sign-out behavior for the application, and conflict UX
remain unresolved.

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

The core capability spike has passed. Saved-JSON restart checks and cross-device
testing are out of scope unless a failure is observed. Production work still
needs decisions on enrollment, recovery, space-key management and conflicts.
