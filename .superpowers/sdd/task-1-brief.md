### Task 1: Scaffold + vendor #47 prosody + provenance + standalone regression test

Stand up Vite+TS+vitest + Supabase client, and bring in #47's prosody verbatim with a test proving it imports self-contained.

**Files:**
- Create: `project-48-torklon/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/style.css` (stub), `src/main.ts` (stub), `.github/workflows/deploy.yml`, `public/CNAME`
- Copy in (from shipped #47): `src/prosody/**` (all libs + `data/*.json`) + `tests/prosody/**`
- Create: `src/prosody/PROVENANCE.md`, `src/config/supabase.ts` (URL + anon key), `src/types.ts`
- Test: `tests/prosody-standalone.test.ts`

**Interfaces:**
- `src/types.ts`:
  ```ts
  import type { FormId, Diagnostic } from "./prosody";
  export interface Player { id: string; nickname: string }
  export interface Line { text: string; authorId: string; index: number } // one บาท (its วรรค joined by "\n" or " / ")
  export type RoomStatus = "open" | "ended";
  export interface Room {
    id: string; form: FormId; hostId: string; status: RoomStatus;
    lines: Line[]; turnOrder: string[]; turnIndex: number;
    players: Player[]; createdAt: string;
  }
  export interface SubmitResult { accepted: boolean; diagnostics: Diagnostic[]; line?: Line }
  ```
- `src/config/supabase.ts`: `export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);` (both public-safe constants).

- [ ] **Step 1: Scaffold tooling** — mirror `project-44-klon`/`project-42-ads`. `package.json` scripts `dev/build/preview/test` (`build` = `tsc --noEmit && vite build`), devDeps `@types/node jsdom typescript vite vitest`, dep `@supabase/supabase-js`. `tsconfig.json` strict + DOM libs + `resolveJsonModule`. `vite.config.ts` `test: { environment: "jsdom" }`. `public/CNAME` = `torklon.peerapongsm.dev`. Pages workflow copied from ads. `index.html` `<div id="app"></div>` + umami snippet. `npm install`.

- [ ] **Step 2: Vendor #47 prosody** — copy the entire `src/prosody/` folder and `tests/prosody/` from the shipped klon repo. Write `src/prosody/PROVENANCE.md`: source repo `peerapongsm/klon`, commit sha, date, and the rule "do not edit here; fix upstream + re-vendor." Do NOT alter any prosody file.

- [ ] **Step 3: Write the standalone-import regression test**

```ts
// tests/prosody-standalone.test.ts
import { describe, it, expect } from "vitest";
import * as prosody from "../src/prosody/index";
describe("vendored prosody imports self-contained", () => {
  it("exposes the reusable API", () => {
    for (const k of ["validate", "parseSyllables", "rhymes", "suggest", "FORMS"]) expect(k in prosody).toBe(true);
  });
  it("validates a known-good line without throwing", () => {
    expect(() => prosody.validate("รักเธอหมดใจ", prosody.FORMS.klon8)).not.toThrow();
  });
});
```
Also add a grep guard step: `grep -rE "from \"\.\./(ui|net|main)" src/prosody/ && echo LEAK || echo clean` must print `clean`.

- [ ] **Step 4: Run — expect pass** → `npx vitest run tests/prosody-standalone.test.ts tests/prosody/` (the vendored prosody suite also passes).

- [ ] **Step 5: Commit**

```bash
cd project-48-torklon && git init && git add -A
git commit -m "chore: scaffold torklon + vendor #47 prosody (verbatim) + provenance + standalone test"
```

---

