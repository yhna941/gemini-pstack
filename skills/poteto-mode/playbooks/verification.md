### Verification

Upstream pstack has no playbook with this name. This file is the Gemini CLI port's verification playbook. It composes the prove step shared by Feature and Bug fix.

Use it when the user asked you to prove a change and did not ask you to build one. When the user asked you to build the change, stay in Feature or Bug fix. Those playbooks already contain the prove step.

**You own the proof. Run it.**

1. Name the behavior and the interface a person uses to reach it.
2. Follow the **principle-prove-it-works** skill. Run that interface. Read the output. A compile, a typecheck, or a self-report is not the proof. If the check is inconclusive or on the wrong interface, say so and do not call it a pass.
3. A number you measured goes through the **benchmark-checklist** skill before you trust it, report it, or act on it.
4. A small diff you do not trust goes through the **blast-radius** skill.
5. If the repo has no scripted way to drive the app, follow the **create-verification-skill** skill and write the generated skill under `.gemini/skills/` (see `docs/harness/gemini-cli.md`). Do that when the user asked for a verification skill, or when the check cannot run any other way. Otherwise say the check is inconclusive.
6. If a verification skill already exists and the user asked to audit it, follow the **maintain-verification-skill** skill.
7. Apply the **unslop** skill to the reply.

**Reply:** the command you ran, the output that decides the verdict, and the verdict.
